import { z } from "zod";
import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { generalApiLimiter, exportLimiter, preferencesLimiter } from "./middleware/rateLimit";
import { insertUserPreferencesSchema, eventsQuerySchema, exportIcsQuerySchema } from "@shared/schema";
import type { CalendarEvent, SeriesInfo } from "@shared/schema";
import { BadRequestError } from "./errors";
import { safeLoadJsonFile } from "./utils";
import * as logger from "./logger";
import ICAL from "ical.js";
import path from "path";
import { HandlerRegistry } from "./handlers/registry";
import { ICSHandler } from "./handlers/ics";
import { JolpicaHandler } from "./handlers/jolpica";
import { MotoGPHandler } from "./handlers/motogp";
import { normalizeSessionNames } from "./handlers/sessionLabels";
export { fetchICSData } from "./icsFetcher";

// Load ICS feeds config with validation
const feedsPath = path.resolve(process.cwd(), "ics-feeds.json");
const feedsConfig = safeLoadJsonFile(feedsPath, process.cwd());

// Basic structure validation
if (!feedsConfig.categories || !Array.isArray(feedsConfig.categories)) {
  throw new Error("Invalid feeds configuration: missing or invalid categories array");
}

// Build flat series list from categories
function getAllSeries(): SeriesInfo[] {
  const result: SeriesInfo[] = [];
  for (const category of feedsConfig.categories) {
    for (const series of category.series) {
      const rawSessionNames = series.params?.sessionNames;
      const normalizedSessionNames =
        rawSessionNames === undefined
          ? undefined
          : Array.isArray(rawSessionNames)
          ? normalizeSessionNames(rawSessionNames)
          : undefined;

      if (rawSessionNames !== undefined && !Array.isArray(rawSessionNames)) {
        throw new Error(`Invalid sessionNames for ${series.id}: must be an array`);
      }

      if (
        Array.isArray(rawSessionNames) &&
        (!normalizedSessionNames || normalizedSessionNames.length !== rawSessionNames.length)
      ) {
        throw new Error(
          `Invalid sessionNames for ${series.id}: unsupported session names`
        );
      }

      result.push({
        id: series.id,
        name: series.name,
        shortName: series.shortName,
        color: series.color,
        category: category.name,
        handler: series.handler,
        params: series.params,
        enabled: series.enabled,
        sessionNames: normalizedSessionNames,
      });
    }
  }
  return result;
}

const allSeries = getAllSeries();

// Initialize handler registry
const handlerRegistry = new HandlerRegistry();
handlerRegistry.register(new ICSHandler());
handlerRegistry.register(new JolpicaHandler());
handlerRegistry.register(new MotoGPHandler());

// ---------- Caching ----------
//const jolpicaCache = new Map<string, { data: CalendarEvent[]; fetchedAt: number }>();
//const motogpCache = new Map<string, { data: CalendarEvent[]; fetchedAt: number }>();

// ---------- Jolpica API (F1 session times) ----------

interface JolpicaSession {
  date: string;
  time?: string;
}

interface JolpicaRace {
  season: string;
  round: string;
  raceName: string;
  Circuit: {
    circuitId: string;
    circuitName: string;
    Location: {
      lat: string;
      long: string;
      locality: string;
      country: string;
    };
  };
  date: string;
  time?: string;
  FirstPractice?: JolpicaSession;
  SecondPractice?: JolpicaSession;
  ThirdPractice?: JolpicaSession;
  Qualifying?: JolpicaSession;
  Sprint?: JolpicaSession;
  SprintQualifying?: JolpicaSession;
  SprintShootout?: JolpicaSession;
}

// ---------- ICS export ----------

function generateICS(events: CalendarEvent[]): string {
  const cal = new ICAL.Component(["vcalendar", [], []]);
  cal.updatePropertyWithValue("prodid", "-//GridStart//Motorsport Calendar//EN");
  cal.updatePropertyWithValue("version", "2.0");
  cal.updatePropertyWithValue("calscale", "GREGORIAN");
  cal.updatePropertyWithValue("method", "PUBLISH");
  cal.updatePropertyWithValue("x-wr-calname", "GridStart Motorsport Calendar");

  for (const event of events) {
    const vevent = new ICAL.Component("vevent");
    vevent.updatePropertyWithValue("uid", event.id);
    vevent.updatePropertyWithValue(
      "summary",
      `${event.title}`
    );

    if (event.isAllDay) {
      // All-day event — use VALUE=DATE
      const d = new Date(event.startDate);
      const dateStr = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
      //const dtstart = vevent.addPropertyWithValue("dtstart", ICAL.Time.fromDateString(dateStr));
      
      const dEnd = new Date(event.endDate);
      const endDateStr = `${dEnd.getUTCFullYear()}${String(dEnd.getUTCMonth() + 1).padStart(2, "0")}${String(dEnd.getUTCDate()).padStart(2, "0")}`;
      vevent.addPropertyWithValue("dtend", ICAL.Time.fromDateString(endDateStr));
    } else {
      // Timed event in UTC
      const dtstart = ICAL.Time.fromJSDate(new Date(event.startDate), true);
      vevent.updatePropertyWithValue("dtstart", dtstart);
      const dtend = ICAL.Time.fromJSDate(new Date(event.endDate), true);
      vevent.updatePropertyWithValue("dtend", dtend);
    }

    if (event.location) {
      vevent.updatePropertyWithValue("location", event.location);
    }
    if (event.description) {
      vevent.updatePropertyWithValue("description", event.description);
    }

    cal.addSubcomponent(vevent);
  }

  return cal.toString();
}

// ---------- Fetch events for a series ----------

async function fetchEventsForSeries(
  series: SeriesInfo,
  fromDate?: Date,
  toDate?: Date
): Promise<CalendarEvent[]> {
  // Determine which years to fetch
  const years = new Set<number>();
  const currentYear = new Date().getFullYear();
  years.add(currentYear);
  if (fromDate) years.add(fromDate.getFullYear());
  if (toDate) years.add(toDate.getFullYear());

  const handler = handlerRegistry.get(series.handler);
  if (!handler) {
    throw new Error(`Unknown handler: ${series.handler}`);
  }

  let allEvents: CalendarEvent[] = [];
  for (const year of Array.from(years)) {
    const events = await handler.fetchEvents(series, series.params, year);
    allEvents.push(...events);
  }

  return filterByDateRange(allEvents, fromDate, toDate);
}

function filterByDateRange(
  events: CalendarEvent[],
  fromDate?: Date,
  toDate?: Date
): CalendarEvent[] {
  if (!fromDate && !toDate) return events;
  return events.filter((e) => {
    const start = new Date(e.startDate);
    const end = new Date(e.endDate);
    if (fromDate && end < fromDate) return false;
    if (toDate && start > toDate) return false;
    return true;
  });
}

// ---------- Routes ----------

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // GET /api/series — list all series
  app.get("/api/series", generalApiLimiter, (_req: Request, res: Response) => {
    res.json(allSeries);
  });

  // GET /api/events?series=f1,motogp&from=2026-01-01&to=2026-12-31
  app.get("/api/events", generalApiLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = eventsQuerySchema.parse(req.query);
      const seriesIds = query.series
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // Validate series IDs exist
      const validSeriesIds = allSeries.map(s => s.id);
      const invalidSeries = seriesIds.filter(id => !validSeriesIds.includes(id));
      if (invalidSeries.length > 0) {
        throw new BadRequestError("Invalid series IDs: " + invalidSeries.join(", "));
      }

      if (seriesIds.length === 0) {
        return res.json([]);
      }

      const fromDate = query.from ? new Date(query.from) : undefined;
      const toDate = query.to ? new Date(query.to) : undefined;

      const allEvents: CalendarEvent[] = [];

      const fetchPromises = seriesIds.map(async (seriesId) => {
        const series = allSeries.find((s) => s.id === seriesId);
        if (!series) return;

        try {
          const events = await fetchEventsForSeries(series, fromDate, toDate);
          allEvents.push(...events);
        } catch (err) {
          logger.error(err, `Failed to fetch events for ${seriesId}`, { seriesId });
        }
      });

      await Promise.all(fetchPromises);

      // Sort by start date
      allEvents.sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );

      res.json(allEvents);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new BadRequestError("Invalid query parameters"));
      }
      next(err);
    }
  });

  // GET /api/preferences
  app.get("/api/preferences", generalApiLimiter, async (_req: Request, res: Response) => {
    const prefs = await storage.getPreferences();
    if (prefs) {
      res.json(prefs);
    } else {
      // Return default preferences
      const defaultEnabled = allSeries
        .filter((s) => s.enabled)
        .map((s) => s.id);
      res.json({ id: 0, enabledSeries: JSON.stringify(defaultEnabled) });
    }
  });

  // PUT /api/preferences
  app.put("/api/preferences", preferencesLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const parsed = insertUserPreferencesSchema.parse(req.body);
      const saved = await storage.savePreferences(parsed);
      res.json(saved);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new BadRequestError("Invalid preferences data"));
      }
      next(err);
    }
  });

  // GET /api/export.ics?series=f1,motogp
  app.get("/api/export.ics", exportLimiter, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const query = exportIcsQuerySchema.parse(req.query);
      const seriesIds = query.series
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);

      // Validate series IDs exist
      const validSeriesIds = allSeries.map(s => s.id);
      const invalidSeries = seriesIds.filter(id => !validSeriesIds.includes(id));
      if (invalidSeries.length > 0) {
        throw new BadRequestError("Invalid series IDs: " + invalidSeries.join(", "));
      }

      if (seriesIds.length === 0) {
        res.set("Content-Type", "text/calendar; charset=utf-8");
        res.set(
          "Content-Disposition",
          'attachment; filename="gridstart.ics"'
        );
        return res.send(
          "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//GridStart//EN\r\nEND:VCALENDAR"
        );
      }

      const allEvents: CalendarEvent[] = [];

      const fetchPromises = seriesIds.map(async (seriesId) => {
        const series = allSeries.find((s) => s.id === seriesId);
        if (!series) return;

        try {
          const events = await fetchEventsForSeries(series);
          allEvents.push(...events);
        } catch (err) {
          logger.error(err, `Failed to fetch events for export ${seriesId}`, { seriesId });
        }
      });

      await Promise.all(fetchPromises);

      allEvents.sort(
        (a, b) =>
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
      );

      const icsString = generateICS(allEvents);

      res.set("Content-Type", "text/calendar; charset=utf-8");
      res.set(
        "Content-Disposition",
        'attachment; filename="gridstart.ics"'
      );
      res.send(icsString);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return next(new BadRequestError("Invalid query parameters"));
      }
      next(err);
    }
  });

  return httpServer;
}
