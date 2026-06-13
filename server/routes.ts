import type { Hono } from "hono";
import type { Context } from "hono";
import { z } from "zod";
import { eventsQuerySchema, exportIcsQuerySchema } from "@shared/schema";
import type { CalendarEvent, SeriesInfo } from "@shared/schema";
import { BadRequestError } from "./errors";
import * as logger from "./logger";
import ICAL from "ical.js";
import { HandlerRegistry } from "./handlers/registry";
import { ICSHandler } from "./handlers/ics";
import { ECALHandler } from "./handlers/ecal";
import { JolpicaHandler } from "./handlers/jolpica";
import { MotoGPHandler } from "./handlers/motogp";
import { normalizeSessionNames } from "./handlers/sessionLabels";
import { getOrSet, CACHE_TTL_MS } from "./cache";
import { exportLimiter } from "./middleware/rateLimit";
export { fetchICSData } from "./icsFetcher";

interface FeedsCategory {
  name: string;
  series: Array<{
    id: string;
    name: string;
    shortName: string;
    color: string;
    handler: string;
    params: Record<string, unknown>;
    enabled: boolean;
  }>;
}

function getFeedsConfig(): { categories: FeedsCategory[] } {
  const raw = (globalThis as Record<string, unknown>).__CONFIG_FEEDS__;
  if (typeof raw === "string") {
    return JSON.parse(raw);
  }
  throw new Error("Feeds configuration not loaded");
}

const feedsConfig = getFeedsConfig();

function buildAllSeries(config: { categories: FeedsCategory[] }): SeriesInfo[] {
  const result: SeriesInfo[] = [];
  for (const category of config.categories) {
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
        throw new Error(`Invalid sessionNames for ${series.id}: unsupported session names`);
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

const allSeries = buildAllSeries(feedsConfig);

const handlerRegistry = new HandlerRegistry();
handlerRegistry.register(new ICSHandler());
handlerRegistry.register(new ECALHandler());
handlerRegistry.register(new JolpicaHandler());
handlerRegistry.register(new MotoGPHandler());

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
    vevent.updatePropertyWithValue("summary", `${event.title}`);

    if (event.isAllDay) {
      const dStart = new Date(event.startDate);
      const dEnd = new Date(event.endDate);
      const startDateStr = `${dStart.getUTCFullYear()}-${String(dStart.getUTCMonth() + 1).padStart(2, "0")}-${String(dStart.getUTCDate()).padStart(2, "0")}`;
      const endDateStr = `${dEnd.getUTCFullYear()}-${String(dEnd.getUTCMonth() + 1).padStart(2, "0")}-${String(dEnd.getUTCDate()).padStart(2, "0")}`;
      vevent.addPropertyWithValue("dtstart", ICAL.Time.fromDateString(startDateStr));
      vevent.addPropertyWithValue("dtend", ICAL.Time.fromDateString(endDateStr));
    } else {
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

async function fetchEventsForSeries(series: SeriesInfo, fromDate?: Date, toDate?: Date): Promise<CalendarEvent[]> {
  const years = new Set<number>();
  const currentYear = new Date().getFullYear();
  years.add(currentYear);
  if (fromDate) years.add(fromDate.getFullYear());
  if (toDate) years.add(toDate.getFullYear());

  const handler = handlerRegistry.get(series.handler);
  if (!handler) {
    throw new Error(`Unknown handler: ${series.handler}`);
  }

  const allEvents: CalendarEvent[] = [];
  for (const year of Array.from(years)) {
    const events = await handler.fetchEvents(series, series.params, year);
    allEvents.push(...events);
  }

  return filterByDateRange(allEvents, fromDate, toDate);
}

function filterByDateRange(events: CalendarEvent[], fromDate?: Date, toDate?: Date): CalendarEvent[] {
  if (!fromDate && !toDate) return events;
  return events.filter((e) => {
    const start = new Date(e.startDate);
    const end = new Date(e.endDate);
    if (fromDate && end < fromDate) return false;
    if (toDate && start > toDate) return false;
    return true;
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function registerRoutes(app: Hono<any, any, any>): Promise<void> {
  app.get("/api/series", async (c: Context) => {
    c.header("Access-Control-Allow-Origin", process.env.CORS_ORIGIN || "*");
    return c.json(allSeries);
  });

  app.get("/api/events", async (c: Context) => {
    try {
      const query = eventsQuerySchema.parse(c.req.query());
      const seriesIds = query.series
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

      const validSeriesIds = allSeries.map((s) => s.id);
      const invalidSeries = seriesIds.filter((id: string) => !validSeriesIds.includes(id));
      if (invalidSeries.length > 0) {
        throw new BadRequestError("Invalid series IDs: " + invalidSeries.join(", "));
      }

      if (seriesIds.length === 0) {
        return c.json([]);
      }

      const fromDate = query.from ? new Date(query.from) : undefined;
      const toDate = query.to ? new Date(query.to) : undefined;

      const allEvents: CalendarEvent[] = [];

      const fetchPromises = seriesIds.map(async (seriesId: string) => {
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

      allEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

      return c.json(allEvents);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new BadRequestError("Invalid query parameters");
      }
      throw err;
    }
  });

  const exportIcsHandler = async (c: Context) => {
    try {
      const query = exportIcsQuerySchema.parse(c.req.query());
      const seriesIds = query.series
        .split(",")
        .map((s: string) => s.trim())
        .filter(Boolean);

      const validSeriesIds = allSeries.map((s) => s.id);
      const invalidSeries = seriesIds.filter((id: string) => !validSeriesIds.includes(id));
      if (invalidSeries.length > 0) {
        throw new BadRequestError("Invalid series IDs: " + invalidSeries.join(", "));
      }

      if (seriesIds.length === 0) {
        c.header("Content-Type", "text/calendar; charset=utf-8");
        c.header("Content-Disposition", 'attachment; filename="gridstart.ics"');
        return c.body("BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//GridStart//EN\r\nEND:VCALENDAR");
      }

      const sortedIds = [...seriesIds].sort().join(",");
      const icsString = await getOrSet(`ics-export-${sortedIds}`, CACHE_TTL_MS, async () => {
        const allEvents: CalendarEvent[] = [];

        const fetchPromises = seriesIds.map(async (seriesId: string) => {
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

        allEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());

        return generateICS(allEvents);
      });

      c.header("Content-Type", "text/calendar; charset=utf-8");
      c.header("Content-Disposition", 'attachment; filename="gridstart.ics"');
      return c.body(icsString);
    } catch (err) {
      if (err instanceof z.ZodError) {
        throw new BadRequestError("Invalid query parameters");
      }
      throw err;
    }
  };

  app.use("/api/export.ics", exportLimiter);
  app.get("/api/export.ics", exportIcsHandler);
  app.use("/export.ics", exportLimiter);
  app.get("/export.ics", exportIcsHandler);
}

export function getSeriesList(): SeriesInfo[] {
  return allSeries;
}
