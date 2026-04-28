import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const userPreferences = sqliteTable("user_preferences", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  enabledSeries: text("enabled_series").notNull(), // JSON array of series IDs
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({ id: true });
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;

// API Query Schemas
export const eventsQuerySchema = z.object({
  series: z.string().min(1, "Series parameter is required"),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, expected YYYY-MM-DD").optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format, expected YYYY-MM-DD").optional(),
});

export const exportIcsQuerySchema = z.object({
  series: z.string().min(1, "Series parameter is required"),
});

export type EventsQuery = z.infer<typeof eventsQuerySchema>;
export type ExportIcsQuery = z.infer<typeof exportIcsQuerySchema>;

// Types for the API responses (not DB tables)
export interface CalendarEvent {
  id: string;
  seriesId: string;
  seriesName: string;
  seriesShortName: string;
  seriesColor: string;
  title: string;
  startDate: string; // ISO string in UTC
  endDate: string; // ISO string in UTC
  location?: string;
  description?: string;
  isAllDay: boolean; // true if no specific time (date-only from ICS)
  sessionType?: string; // e.g. "Race", "Qualifying", "FP1", "Sprint", etc.
  round?: number; // round number in the championship
  raceName?: string; // parent race name (e.g. "Australian Grand Prix")
}

export interface SeriesInfo {
  id: string;
  name: string;
  shortName: string;
  color: string;
  category: string;
  handler: string;
  params: Record<string, any>;
  enabled: boolean;
  sessionNames?: string[];
}
