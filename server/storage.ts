import { type UserPreferences, type InsertUserPreferences, userPreferences } from "@shared/schema";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import { eq } from "drizzle-orm";

const sqlite = new Database("data.db");
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite);

export interface IStorage {
  getPreferences(): Promise<UserPreferences | undefined>;
  savePreferences(prefs: InsertUserPreferences): Promise<UserPreferences>;
}

export class DatabaseStorage implements IStorage {
  async getPreferences(): Promise<UserPreferences | undefined> {
    return db.select().from(userPreferences).where(eq(userPreferences.id, 1)).get();
  }

  async savePreferences(prefs: InsertUserPreferences): Promise<UserPreferences> {
    const existing = await this.getPreferences();
    if (existing) {
      return db
        .update(userPreferences)
        .set({ enabledSeries: prefs.enabledSeries })
        .where(eq(userPreferences.id, 1))
        .returning()
        .get();
    } else {
      return db.insert(userPreferences).values(prefs).returning().get();
    }
  }
}

export const storage = new DatabaseStorage();
