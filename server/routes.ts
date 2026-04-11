import { z } from "zod";
import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertUserPreferencesSchema, eventsQuerySchema, exportIcsQuerySchema } from "@shared/schema";
import type { CalendarEvent, SeriesInfo } from "@shared/schema";
import ICAL from "ical.js";
import fs from "fs";
import path from "path";
import { safeLoadJsonFile } from "./utils";

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
      result.push({
        id: series.id,
        name: series.name,
        shortName: series.shortName,
        color: series.color,
        category: category.name,
        icsUrl: series.icsUrl,
        enabled: series.enabled,
      });
    }
  }
  return result;
}

const allSeries = getAllSeries();

// Series that use dedicated APIs for session-level data with exact times
const JOLPICA_SERIES = new Set(["f1"]);
const MOTOGP_SERIES = new Set(["motogp"]);

// MotoGP API constants
const MOTOGP_API_BASE = "https://api.motogp.pulselive.com/motogp/v1";
const MOTOGP_CATEGORY_ID = "e8c110ad-64aa-4e8e-8a86-f2f152f6a942"; // MotoGP class

// ---------- Caching ----------
const icsCache = new Map<string, { data: string; fetchedAt: number }>();
const jolpicaCache = new Map<string, { data: CalendarEvent[]; fetchedAt: number }>();
const motogpCache = new Map<string, { data: CalendarEvent[]; fetchedAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

async function fetchICSData(seriesId: string, icsUrl: string): Promise<string> {
  const cached = icsCache.get(seriesId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(icsUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const text = await res.text();
    icsCache.set(seriesId, { data: text, fetchedAt: Date.now() });
    return text;
  } catch (err) {
    // Return cached data even if stale, if available
    if (cached) {
      return cached.data;
    }
    throw err;
  }
}

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

async function fetchF1Sessions(
  series: SeriesInfo,
  year: number
): Promise<CalendarEvent[]> {
  const cacheKey = `f1-${year}`;
  const cached = jolpicaCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`https://api.jolpi.ca/ergast/f1/${year}.json`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Jolpica HTTP ${res.status}`);

    const json = await res.json();
    const races: JolpicaRace[] = json?.MRData?.RaceTable?.Races || [];

    const events: CalendarEvent[] = [];

    for (const race of races) {
      const round = parseInt(race.round, 10);
      const location = `${race.Circuit.Location.locality}, ${race.Circuit.Location.country}`;
      const circuitName = race.Circuit.circuitName;

      // Determine if this is a sprint weekend
      const isSprint = !!race.Sprint;

      // Session type definitions with their data and labels
      const sessions: { key: string; label: string; data?: JolpicaSession }[] =
        isSprint
          ? [
              { key: "fp1", label: "Practice", data: race.FirstPractice },
              {
                key: "sprint-quali",
                label: "Sprint Qualifying",
                data: race.SprintQualifying || race.SprintShootout,
              },
              { key: "sprint", label: "Sprint", data: race.Sprint },
              { key: "quali", label: "Qualifying", data: race.Qualifying },
              {
                key: "race",
                label: "Race",
                data: { date: race.date, time: race.time },
              },
            ]
          : [
              { key: "fp1", label: "Practice 1", data: race.FirstPractice },
              {
                key: "fp2",
                label: "Practice 2",
                data: race.SecondPractice,
              },
              {
                key: "fp3",
                label: "Practice 3",
                data: race.ThirdPractice,
              },
              { key: "quali", label: "Qualifying", data: race.Qualifying },
              {
                key: "race",
                label: "Race",
                data: { date: race.date, time: race.time },
              },
            ];

      for (const session of sessions) {
        if (!session.data?.date) continue;

        const hasTime = !!session.data.time;
        let startDate: string;
        let endDate: string;

        if (hasTime) {
          // Jolpica times are in UTC (e.g. "05:00:00Z")
          const timeStr = session.data.time!.replace("Z", "");
          startDate = `${session.data.date}T${timeStr}Z`;
          // Estimate session duration
          const durationMinutes = getDurationForSession(session.key);
          const start = new Date(startDate);
          endDate = new Date(
            start.getTime() + durationMinutes * 60 * 1000
          ).toISOString();
        } else {
          startDate = `${session.data.date}T00:00:00Z`;
          endDate = `${session.data.date}T23:59:59Z`;
        }

        events.push({
          id: `f1-${year}-r${round}-${session.key}`,
          seriesId: series.id,
          seriesName: series.name,
          seriesShortName: series.shortName,
          seriesColor: series.color,
          title: `${race.raceName} — ${session.label}`,
          startDate,
          endDate,
          location: `${circuitName}, ${location}`,
          isAllDay: !hasTime,
          sessionType: session.label,
          round,
          raceName: race.raceName,
        });
      }
    }

    jolpicaCache.set(cacheKey, { data: events, fetchedAt: Date.now() });
    return events;
  } catch (err) {
    console.error("Failed to fetch Jolpica F1 data:", err);
    if (cached) return cached.data;
    return [];
  }
}

function getDurationForSession(sessionKey: string): number {
  switch (sessionKey) {
    case "fp1":
    case "fp2":
    case "fp3":
      return 60; // 60 minutes
    case "quali":
    case "sprint-quali":
      return 70; // ~70 minutes
    case "sprint":
      return 45; // ~45 minutes
    case "race":
      return 120; // ~2 hours
    default:
      return 60;
  }
}

// ---------- MotoGP Pulselive API ----------

interface MotoGPSeason {
  id: string;
  year: number;
}

interface MotoGPEvent {
  id: string;
  name: string;
  sponsored_name: string;
  short_name: string;
  date_start: string;
  date_end: string;
  test: boolean;
  circuit: {
    id: string;
    name: string;
    place: string;
    nation: string;
  };
  country: {
    iso: string;
    name: string;
  };
}

interface MotoGPSession {
  id: string;
  date: string; // ISO 8601 with timezone e.g. "2026-03-27T10:45:00+00:00"
  number: number | null;
  type: string; // "FP", "PR", "Q", "SPR", "WUP", "RAC"
  status: string;
}

const MOTOGP_SESSION_LABELS: Record<string, string> = {
  FP: "Practice",
  PR: "Practice",
  Q: "Qualifying",
  SPR: "Sprint",
  WUP: "Warm Up",
  RAC: "Race",
};

function getMotoGPSessionDuration(type: string): number {
  switch (type) {
    case "FP": return 45;
    case "PR": return 60;
    case "Q": return 15;
    case "SPR": return 30;
    case "WUP": return 15;
    case "RAC": return 105;
    default: return 45;
  }
}

async function fetchMotoGPSessions(
  series: SeriesInfo,
  year: number
): Promise<CalendarEvent[]> {
  const cacheKey = `motogp-${year}`;
  const cached = motogpCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  try {
    // 1. Find the season UUID for the year
    const seasonsRes = await fetch(`${MOTOGP_API_BASE}/results/seasons`);
    if (!seasonsRes.ok) throw new Error(`Seasons HTTP ${seasonsRes.status}`);
    const seasons: MotoGPSeason[] = await seasonsRes.json();
    const season = seasons.find((s) => s.year === year);
    if (!season) {
      console.log(`No MotoGP season found for ${year}`);
      return cached?.data || [];
    }

    // 2. Get all events (both finished and not-finished)
    const [finishedRes, upcomingRes] = await Promise.all([
      fetch(`${MOTOGP_API_BASE}/results/events?seasonUuid=${season.id}&isFinished=true`),
      fetch(`${MOTOGP_API_BASE}/results/events?seasonUuid=${season.id}&isFinished=false`),
    ]);

    let allMotoGPEvents: MotoGPEvent[] = [];
    if (finishedRes.ok) {
      const finished: MotoGPEvent[] = await finishedRes.json();
      allMotoGPEvents.push(...finished);
    }
    if (upcomingRes.ok) {
      const upcoming: MotoGPEvent[] = await upcomingRes.json();
      allMotoGPEvents.push(...upcoming);
    }

    // Filter out test events
    allMotoGPEvents = allMotoGPEvents.filter((e) => !e.test);

    const events: CalendarEvent[] = [];
    let roundNum = 0;

    // 3. For each event, get MotoGP sessions
    for (const mgpEvent of allMotoGPEvents) {
      roundNum++;

      try {
        const sessionsRes = await fetch(
          `${MOTOGP_API_BASE}/results/sessions?eventUuid=${mgpEvent.id}&categoryUuid=${MOTOGP_CATEGORY_ID}`
        );
        if (!sessionsRes.ok) continue;

        const sessions: MotoGPSession[] = await sessionsRes.json();
        const raceName = mgpEvent.sponsored_name || mgpEvent.name;
        const location = `${mgpEvent.circuit.name}, ${mgpEvent.circuit.place}, ${mgpEvent.country.name}`;

        for (const session of sessions) {
          if (!session.date) continue;

          // Parse session label: combine type and number
          let label = MOTOGP_SESSION_LABELS[session.type] || session.type;
          if (session.number && session.type === "FP") {
            label = `Practice ${session.number}`;
          } else if (session.number && session.type === "Q") {
            label = `Qualifying ${session.number}`;
          }

          // Parse the date — MotoGP API returns "+00:00" format
          const startDate = new Date(session.date).toISOString();
          const durationMs = getMotoGPSessionDuration(session.type) * 60 * 1000;
          const endDate = new Date(
            new Date(session.date).getTime() + durationMs
          ).toISOString();

          events.push({
            id: `motogp-${year}-r${roundNum}-${session.type}${session.number || ""}`,
            seriesId: series.id,
            seriesName: series.name,
            seriesShortName: series.shortName,
            seriesColor: series.color,
            title: `${raceName} — ${label}`,
            startDate,
            endDate,
            location,
            isAllDay: false,
            sessionType: label,
            round: roundNum,
            raceName,
          });
        }
      } catch (sessionErr) {
        console.error(
          `Failed to fetch sessions for MotoGP event ${mgpEvent.name}:`,
          sessionErr
        );
      }
    }

    motogpCache.set(cacheKey, { data: events, fetchedAt: Date.now() });
    return events;
  } catch (err) {
    console.error("Failed to fetch MotoGP data:", err);
    if (cached) return cached.data;
    return [];
  }
}

// ---------- ICS parsing (other series) ----------

function parseICSEvents(
  icsData: string,
  series: SeriesInfo,
  fromDate?: Date,
  toDate?: Date
): CalendarEvent[] {
  const events: CalendarEvent[] = [];

  try {
    const jcalData = ICAL.parse(icsData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents("vevent");

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      const dtstart = vevent.getFirstProperty("dtstart");
      if (!dtstart) continue;

      // Check if this is an all-day event (VALUE=DATE vs datetime)
      const isAllDay = dtstart.type === "date";

      const startDate = event.startDate?.toJSDate();
      const endDate = event.endDate?.toJSDate() || startDate;

      if (!startDate) continue;

      // Filter by date range if provided
      if (fromDate && endDate < fromDate) continue;
      if (toDate && startDate > toDate) continue;

      const location =
        (vevent.getFirstPropertyValue("location") as string | null) || undefined;
      const description =
        (vevent.getFirstPropertyValue("description") as string | null) || undefined;

      const summary = event.summary || "Untitled Event";

      // Try to detect session type from the title
      const sessionType = detectSessionType(summary);

      events.push({
        id: `${series.id}-${event.uid || Math.random().toString(36).substring(2)}`,
        seriesId: series.id,
        seriesName: series.name,
        seriesShortName: series.shortName,
        seriesColor: series.color,
        title: summary,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        location,
        description,
        isAllDay,
        sessionType,
      });
    }
  } catch (err) {
    console.error(`Error parsing ICS for ${series.id}:`, err);
  }

  return events;
}

function detectSessionType(title: string): string | undefined {
  const lower = title.toLowerCase();
  if (lower.includes("race") || lower.includes("grand prix") || lower.includes("gp")) return "Race";
  if (lower.includes("sprint quali") || lower.includes("sprint shootout")) return "Sprint Qualifying";
  if (lower.includes("sprint")) return "Sprint";
  if (lower.includes("qualifying") || lower.includes("quali")) return "Qualifying";
  if (lower.includes("practice 3") || lower.includes("fp3")) return "Practice 3";
  if (lower.includes("practice 2") || lower.includes("fp2")) return "Practice 2";
  if (lower.includes("practice 1") || lower.includes("fp1") || lower.includes("practice")) return "Practice";
  if (lower.includes("test")) return "Test";
  if (lower.includes("warm")) return "Warm Up";
  return undefined;
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
      `[${event.seriesShortName}] ${event.title}`
    );

    if (event.isAllDay) {
      // All-day event — use VALUE=DATE
      const d = new Date(event.startDate);
      const dateStr = `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}`;
      const dtstart = vevent.addPropertyWithValue("dtstart", ICAL.Time.fromDateString(dateStr));
      
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

  if (JOLPICA_SERIES.has(series.id)) {
    // Use Jolpica API for F1 session-level data
    let allEvents: CalendarEvent[] = [];
    for (const year of Array.from(years)) {
      const events = await fetchF1Sessions(series, year);
      allEvents.push(...events);
    }
    return filterByDateRange(allEvents, fromDate, toDate);
  }

  if (MOTOGP_SERIES.has(series.id)) {
    // Use MotoGP Pulselive API for session-level data
    let allEvents: CalendarEvent[] = [];
    for (const year of Array.from(years)) {
      const events = await fetchMotoGPSessions(series, year);
      allEvents.push(...events);
    }
    return filterByDateRange(allEvents, fromDate, toDate);
  }

  // Default: use ICS feed
  const icsData = await fetchICSData(series.id, series.icsUrl);
  return parseICSEvents(icsData, series, fromDate, toDate);
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
  app.get("/api/series", (_req: Request, res: Response) => {
    res.json(allSeries);
  });

  // GET /api/events?series=f1,motogp&from=2026-01-01&to=2026-12-31
  app.get("/api/events", async (req: Request, res: Response) => {
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
        return res.status(400).json({ message: "Invalid series IDs: " + invalidSeries.join(", ") });
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
          console.error(`Failed to fetch events for ${seriesId}:`, err);
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
      console.error("Error fetching events:", err);
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid query parameters" });
      }
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // GET /api/preferences
  app.get("/api/preferences", async (_req: Request, res: Response) => {
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
  app.put("/api/preferences", async (req: Request, res: Response) => {
    try {
      const parsed = insertUserPreferencesSchema.parse(req.body);
      const saved = await storage.savePreferences(parsed);
      res.json(saved);
    } catch (err) {
      res.status(400).json({ message: "Invalid preferences data" });
    }
  });

  // GET /api/export.ics?series=f1,motogp
  app.get("/api/export.ics", async (req: Request, res: Response) => {
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
        res.set("Content-Type", "text/plain");
        return res.status(400).send("Invalid series IDs: " + invalidSeries.join(", "));
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
          console.error(
            `Failed to fetch events for export ${seriesId}:`,
            err
          );
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
      console.error("Error exporting ICS:", err);
      if (err instanceof z.ZodError) {
        res.set("Content-Type", "text/plain");
        return res.status(400).send("Invalid query parameters");
      }
      res.status(500).json({ message: "Failed to export calendar" });
    }
  });

  return httpServer;
}
