import type { FeedHandler } from "./types";
import type { CalendarEvent, SeriesInfo } from "@shared/schema";
import ICAL from "ical.js";
import { fetchICSData } from "../icsFetcher";
import { filterEventsBySessionNames, normalizeSessionName, normalizeSessionNames } from "./sessionLabels";

// List of words to ignore in event titles - can be extended in the future
const IGNORED_TITLE_WORDS = ["calendar", "Welcome"];

function removeEmojis(text: string): string {
  return text.replace(/[\p{Emoji}\p{Emoji_Component}\uFE0F\u200D]/gu, '').trim();
}

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

      let location =
        (vevent.getFirstPropertyValue("location") as string | null) || undefined;
      const description =
        (vevent.getFirstPropertyValue("description") as string | null) || undefined;

      const summary = event.summary || "Untitled Event";

      // Ignore events with titles containing specified words
      if (IGNORED_TITLE_WORDS.some(word => summary.toLowerCase().includes(word.toLowerCase()))) continue;

      // Override location if it contains separator patterns
      if (location) {
        // First, remove text to the left of "|"
        if (location.includes("|")) {
          location = location.split("|")[0].trim();
        }
        
        // Then try different separators in order of specificity
        const separators = ["@ ", "at the ", "at ", "on the ", "on "];
        for (const sep of separators) {
          const index = location.toLowerCase().indexOf(sep.toLowerCase());
          if (index !== -1) {
            location = location.substring(index + sep.length).trim();
            break;
          }
        }
      }

      // Try to detect session type from the title and normalize it to the shared registry
      const sessionType = normalizeSessionName(detectSessionType(summary));

      // Extract race name by removing session type from title
      let raceName: string | undefined;
      if (sessionType) {
        // Remove the session type from the title to get race name
        const escapedSessionType = sessionType.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        raceName = summary.replace(new RegExp(`\\b${escapedSessionType}\\b`, 'gi'), '').trim();
        // Remove trailing separators like | : -
        raceName = raceName.replace(/[|:-]+$/, '').trim();
        // Remove emojis
        raceName = removeEmojis(raceName);
        // If raceName is empty or same as series short name, don't set it
        if (!raceName || raceName.toLowerCase() === series.shortName.toLowerCase()) {
          raceName = undefined;
        }
      }

      // Override title with standardized format
      let title = location && sessionType 
        ? `${series.shortName} | ${location} ${sessionType}`
        : summary;
      
      // Remove emojis from title
      title = removeEmojis(title);

      // For IndyCar, use the final title as raceName for grouping
      if (series.shortName === "INDY") {
        raceName = `${series.name} - ${location}`
      }

      events.push({
        id: `${series.id}-${event.uid || Math.random().toString(36).substring(2)}`,
        seriesId: series.id,
        seriesName: series.name,
        seriesShortName: series.shortName,
        seriesColor: series.color,
        title: title,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        location,
        //description,
        isAllDay,
        sessionType,
        raceName,
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
  if (lower.includes("practice 1") || lower.includes("fp1")) return "Practice 1";
  if (lower.includes("practice")) return "Practice";
  if (lower.includes("test")) return "Test";
  if (lower.includes("warm")) return "Warm Up";
  return undefined;
}

export class ECALHandler implements FeedHandler {
  name = "ecal";

  async fetchEvents(series: SeriesInfo, params: Record<string, any>, year: number): Promise<CalendarEvent[]> {
    const url = params.url;
    if (!url) {
      throw new Error("ECAL handler requires 'url' parameter");
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