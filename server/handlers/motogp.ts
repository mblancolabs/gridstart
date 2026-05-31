import type { FeedHandler } from "./types";
import type { CalendarEvent, SeriesInfo } from "@shared/schema";
import * as logger from "../logger";
import { filterEventsBySessionNames, normalizeSessionNames } from "./sessionLabels";

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
  date: string; // ISO 8601 with timezone, often reported as +00:00 even when the time is local
  number: number | null;
  type: string; // "FP", "PR", "Q", "SPR", "WUP", "RAC"
  status: string;
}

const MOTOGP_API_BASE = "https://api.motogp.pulselive.com/motogp/v1";
const MOTOGP_CATEGORY_IDS: Record<string, string> = {
  "MotoGP": "e8c110ad-64aa-4e8e-8a86-f2f152f6a942",
  "Moto2": "549640b8-fd9c-4245-acfd-60e4bc38b25c",
  "Moto3": "954f7e65-2ef2-4423-b949-4961cc603e45",
};

const MOTOGP_SESSION_LABELS: Record<string, string> = {
  FP: "Practice",
  PR: "Practice",
  Q: "Qualifying",
  SPR: "Sprint",
  WUP: "Warm Up",
  RAC: "Race",
};

const MOTOGP_SESSION_DURATIONS: Record<string, number> = {
  FP: 45,
  PR: 60,
  Q: 15,
  SPR: 30,
  WUP: 15,
  RAC: 105,
};

const MOTOGP_TIMEZONE_OVERRIDES: Record<string, string> = {
  Austin: "America/Chicago",
  "Phillip Island": "Australia/Melbourne",
  Lombok: "Asia/Makassar",
  Sepang: "Asia/Kuala_Lumpur",
  Doha: "Asia/Qatar",
  Buriram: "Asia/Bangkok",
  Goiania: "America/Sao_Paulo",
  Motegi: "Asia/Tokyo",
};

const MOTOGP_COUNTRY_TIMEZONES: Record<string, string> = {
  AT: "Europe/Vienna",
  AU: "Australia/Melbourne",
  BR: "America/Sao_Paulo",
  CZ: "Europe/Prague",
  DE: "Europe/Berlin",
  ES: "Europe/Madrid",
  FR: "Europe/Paris",
  GB: "Europe/London",
  HU: "Europe/Budapest",
  ID: "Asia/Makassar",
  IT: "Europe/Rome",
  JP: "Asia/Tokyo",
  MY: "Asia/Kuala_Lumpur",
  NL: "Europe/Amsterdam",
  PT: "Europe/Lisbon",
  QA: "Asia/Qatar",
  TH: "Asia/Bangkok",
  US: "America/Chicago",
  SM: "Europe/Rome",
};

function getMotoGPTimeZone(event: MotoGPEvent): string | undefined {
  return (
    MOTOGP_TIMEZONE_OVERRIDES[event.circuit.place] ||
    MOTOGP_COUNTRY_TIMEZONES[event.country.iso]
  );
}

function getTimeZoneOffsetMs(date: Date, timeZone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const tzPart = parts.find((part) => part.type === "timeZoneName")?.value;
  if (!tzPart) return 0;

  const match = tzPart.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/);
  if (!match) return 0;

  const sign = match[1].startsWith("-") ? -1 : 1;
  const hours = Math.abs(Number(match[1]));
  const minutes = Number(match[2] || "0");
  return sign * (hours * 60 + minutes) * 60 * 1000;
}

function parseMotoGPSessionDate(sessionDate: string, event: MotoGPEvent): string {
  const localDate = sessionDate.replace(/([+-]\d{2}:?\d{2}|Z)$/, "");
  const candidateUtc = new Date(`${localDate}Z`);
  const timeZone = getMotoGPTimeZone(event);
  if (!timeZone || Number.isNaN(candidateUtc.getTime())) {
    return candidateUtc.toISOString();
  }

  const offsetMs = getTimeZoneOffsetMs(candidateUtc, timeZone);
  return new Date(candidateUtc.getTime() - offsetMs).toISOString();
}

export class MotoGPHandler implements FeedHandler {
  name = "motogp";

  async fetchEvents(series: SeriesInfo, params: Record<string, any>, year: number): Promise<CalendarEvent[]> {
    const className = params.class || "MotoGP";
    const categoryId = MOTOGP_CATEGORY_IDS[className];
    if (!categoryId) {
      throw new Error(`Unknown MotoGP class: ${className}`);
    }

    try {
      // 1. Find the season UUID for the year
      const seasonsRes = await fetch(`${MOTOGP_API_BASE}/results/seasons`);
      if (!seasonsRes.ok) throw new Error(`Seasons HTTP ${seasonsRes.status}`);
      const seasons: MotoGPSeason[] = await seasonsRes.json();
      const season = seasons.find((s) => s.year === year);
      if (!season) {
        console.log(`No MotoGP season found for ${year}`);
        return [];
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
            `${MOTOGP_API_BASE}/results/sessions?eventUuid=${mgpEvent.id}&categoryUuid=${categoryId}`
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

            // Parse the date — MotoGP API returns local session times labeled as UTC.
            const startDate = parseMotoGPSessionDate(session.date, mgpEvent);
            const durationMs = MOTOGP_SESSION_DURATIONS[session.type] * 60 * 1000;
            const endDate = new Date(new Date(startDate).getTime() + durationMs).toISOString();

            events.push({
              id: `motogp-${className.toLowerCase()}-${year}-r${roundNum}-${session.type}${session.number || ""}`,
              seriesId: series.id,
              seriesName: series.name,
              seriesShortName: series.shortName,
              seriesColor: series.color,
              title: `${series.shortName} | ${raceName.split(' of ').pop()} ${label}`,
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
          logger.warn(`Failed to fetch sessions for MotoGP event ${mgpEvent.name}`, {
            seriesId: series.id,
            eventName: mgpEvent.name,
            error: sessionErr instanceof Error ? sessionErr.message : String(sessionErr),
          });
        }
      }

      const requestedSessionNames = normalizeSessionNames(params.sessionNames);
      return requestedSessionNames
        ? filterEventsBySessionNames(events, requestedSessionNames)
        : events;
    } catch (err) {
      logger.error(err, "Failed to fetch MotoGP data", { seriesId: series.id });
      return [];
    }
  }
}