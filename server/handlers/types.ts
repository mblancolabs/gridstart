import type { CalendarEvent, SeriesInfo } from "@shared/schema";

export interface FeedHandler {
  name: string;
  fetchEvents(series: SeriesInfo, params: Record<string, unknown>, year: number): Promise<CalendarEvent[]>;
}

export interface HandlerConfig {
  cacheTtl?: number; // in milliseconds
  timeout?: number; // in milliseconds
}
