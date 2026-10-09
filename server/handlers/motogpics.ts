import type { FeedHandler } from "./types";
import type { CalendarEvent, SeriesInfo } from "@shared/schema";
import ICAL from "ical.js";
import { fetchICSData } from "../icsFetcher";
import { filterEventsBySessionNames, normalizeSessionNames } from "./sessionLabels";

export const MOTOGP_ICS_DEFAULT_URL =
  "https://files-motogp.motorsportcalendars.com/motogp-calendar_p1_p2_practice_qualifying1_qualifying2_sprint_warmup_race.ics";

const MOTOGP_ICS_SESSION_KEYS = new Set([
  "fp1",
  "fp2",
  "practice",
  "qualifying1",
  "qualifying2",
  "sprint",
  "warmup",
  "race",
]);

const MOTOGP_ICS_SESSION_LABELS: Record<string, string> = {
  fp1: "Practice 1",
  fp2: "Practice 2",
  practice: "Practice",
  qualifying1: "Qualifying 1",
  qualifying2: "Qualifying 2",
  sprint: "Sprint",
  warmup: "Warm Up",
  race: "Race",
};

const MOTOGP_ICS_SESSION_CODES: Record<string, string> = {
  fp1: "FP1",
  fp2: "FP2",
  practice: "PR",
  qualifying1: "Q1",
  qualifying2: "Q2",
  sprint: "SPR",
  warmup: "WUP",
  race: "RAC",
};

function normalizeSessionKey(value: string): string {
  return value.toLowerCase().replace(/\s+/g, "");
}

function getSessionKey(vevent: ICAL.Component): string | undefined {
  const categoriesProp = vevent.getFirstProperty("categories");
  if (categoriesProp) {
    const values = categoriesProp.getValues();
    const categories = Array.isArray(values) ? values.map(String) : [String(values)];
    for (const category of categories) {
      const key = normalizeSessionKey(category);
      if (MOTOGP_ICS_SESSION_KEYS.has(key)) return key;
    }
  }

  // Fallback: derive the session key from the UID suffix (e.g. ".../#GP0_2026_fp1")
  const uid = vevent.getFirstPropertyValue("uid") as string | null;
  if (uid) {
    const suffix = uid.split("_").pop();
    if (suffix) {
      const key = normalizeSessionKey(suffix);
      if (MOTOGP_ICS_SESSION_KEYS.has(key)) return key;
    }
  }

  return undefined;
}

function getRound(vevent: ICAL.Component, location: string, locationRound: Map<string, number>): number {
  const uid = (vevent.getFirstPropertyValue("uid") as string | null) || "";
  const match = uid.match(/GP(\d+)_/i);
  if (match) {
    const index = Number(match[1]);
    if (Number.isInteger(index) && index >= 0) return index + 1;
  }

  if (!locationRound.has(location)) {
    locationRound.set(location, locationRound.size + 1);
  }
  return locationRound.get(location)!;
}

export function parseMotoGPICSEvents(
  icsData: string,
  series: SeriesInfo,
  year: number,
  className: string,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const locationRound = new Map<string, number>();

  try {
    const jcalData = ICAL.parse(icsData);
    const comp = new ICAL.Component(jcalData);
    const vevents = comp.getAllSubcomponents("vevent");

    const parsed: Array<{
      startDate: Date;
      endDate: Date;
      location: string;
      sessionLabel: string;
      sessionCode: string;
      round: number;
    }> = [];

    for (const vevent of vevents) {
      const event = new ICAL.Event(vevent);

      const dtstart = event.startDate ? event.startDate.toJSDate() : undefined;
      if (!dtstart) continue;

      // The feed covers the current season; filter to the requested year so
      // multi-year requests don't produce duplicate events.
      if (dtstart.getUTCFullYear() !== year) continue;

      const sessionKey = getSessionKey(vevent);
      if (!sessionKey) continue;

      const endDate = event.endDate?.toJSDate() || dtstart;
      const location = (vevent.getFirstPropertyValue("location") as string | null) || undefined;

      if (!location) continue;

      parsed.push({
        startDate: dtstart,
        endDate,
        location,
        sessionLabel: MOTOGP_ICS_SESSION_LABELS[sessionKey],
        sessionCode: MOTOGP_ICS_SESSION_CODES[sessionKey],
        round: getRound(vevent, location, locationRound),
      });
    }

    // A location (country) can host multiple rounds in one season (e.g. several
    // Spanish GPs). Keep raceName unique per round so the client doesn't merge
    // separate weekends.
    const roundsByLocation = new Map<string, Set<number>>();
    for (const event of parsed) {
      if (!roundsByLocation.has(event.location)) roundsByLocation.set(event.location, new Set());
      roundsByLocation.get(event.location)!.add(event.round);
    }

    for (const event of parsed) {
      const raceName =
        roundsByLocation.get(event.location)!.size > 1
          ? `${event.location} GP ${event.round}`
          : event.location;

      events.push({
        id: `motogp-${className.toLowerCase()}-${year}-r${event.round}-${event.sessionCode}`,
        seriesId: series.id,
        seriesName: series.name,
        seriesShortName: series.shortName,
        seriesColor: series.color,
        title: `${series.shortName} | ${event.location} ${event.sessionLabel}`,
        startDate: event.startDate.toISOString(),
        endDate: event.endDate.toISOString(),
        location: event.location,
        isAllDay: false,
        sessionType: event.sessionLabel,
        round: event.round,
        raceName,
      });
    }
  } catch (err) {
    console.error(`Error parsing MotoGP ICS for ${series.id}`, err);
  }

  return events;
}

export class MotoGPICSHandler implements FeedHandler {
  name = "motogpics";

  async fetchEvents(series: SeriesInfo, params: Record<string, unknown>, year: number): Promise<CalendarEvent[]> {
    const url = (params.url as string | undefined) || MOTOGP_ICS_DEFAULT_URL;
    const className = (params.class as string) || "MotoGP";
    if (className !== "MotoGP") {
      throw new Error(`MotoGP ICS feed does not support class: ${className}`);
    }

    const icsData = await fetchICSData(series.id, url);
    const events = parseMotoGPICSEvents(icsData, series, year, className);

    const requestedSessionNames = normalizeSessionNames(params.sessionNames as string[] | undefined);
    return requestedSessionNames ? filterEventsBySessionNames(events, requestedSessionNames) : events;
  }
}