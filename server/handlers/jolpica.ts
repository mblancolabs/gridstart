import type { FeedHandler } from "./types";
import type { CalendarEvent, SeriesInfo } from "@shared/schema";
import * as logger from "../logger";

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

const JOLPICA_SESSION_DURATIONS: Record<string, number> = {
  "fp1": 60,
  "fp2": 60,
  "fp3": 60,
  "quali": 70,
  "sprint-quali": 70,
  "sprint": 45,
  "race": 120,
};

function getDurationForSession(sessionKey: string): number {
  return JOLPICA_SESSION_DURATIONS[sessionKey] || 60;
}

export { getDurationForSession };

const jolpicaCache = new Map<string, { data: CalendarEvent[]; fetchedAt: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export { jolpicaCache };

export class JolpicaHandler implements FeedHandler {
  name = "jolpica";

  async fetchEvents(series: SeriesInfo, params: Record<string, any>, year: number): Promise<CalendarEvent[]> {
    const cacheKey = `jolpica-${series.id}-${year}`;
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
            id: `jolpica-${year}-r${round}-${session.key}`,
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
      logger.error(err, "Failed to fetch Jolpica data", { seriesId: series.id });
      if (cached) return cached.data;
      return [];
    }
  }
}