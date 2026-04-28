import type { FeedHandler } from "./types";
import type { CalendarEvent, SeriesInfo } from "@shared/schema";
import ICAL from "ical.js";
import { fetchICSData } from "../routes"; // We'll keep this function in routes for now, or move it
import { filterEventsBySessionNames, normalizeSessionName, normalizeSessionNames } from "./sessionLabels";

export function parseICSEvents(
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

      // Try to detect session type from the title and normalize it to the shared registry
      const sessionType = normalizeSessionName(detectSessionType(summary));

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
    console.error(`Error parsing ICS for ${series.id}`, err);
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

export class ICSHandler implements FeedHandler {
  name = "ics";

  async fetchEvents(series: SeriesInfo, params: Record<string, any>, year: number): Promise<CalendarEvent[]> {
    const url = params.url;
    if (!url) {
      throw new Error("ICS handler requires 'url' parameter");
    }

    // For now, fetch current year only. Could be enhanced to fetch multiple years
    const icsData = await fetchICSData(series.id, url);
    const events = parseICSEvents(icsData, series);
    const requestedSessionNames = normalizeSessionNames(params.sessionNames);
    return requestedSessionNames
      ? filterEventsBySessionNames(events, requestedSessionNames)
      : events;
  }
}