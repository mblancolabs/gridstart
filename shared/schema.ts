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
  icsUrl: string;
  enabled: boolean;
}
