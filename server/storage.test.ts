import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("DatabaseStorage", () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.SQLITE_FILE_PATH = ":memory:";
  });

  afterEach(() => {
    delete process.env.SQLITE_FILE_PATH;
  });

  async function createFreshStorage() {
    const { db } = await import("./storage");
    db.run(
      "CREATE TABLE IF NOT EXISTS user_preferences (id INTEGER PRIMARY KEY AUTOINCREMENT, enabled_series TEXT NOT NULL)",
    );
    const { DatabaseStorage } = await import("./storage");
    return new DatabaseStorage();
  }

  it("returns undefined when no preferences exist", async () => {
    const storage = await createFreshStorage();
    const prefs = await storage.getPreferences();
    expect(prefs).toBeUndefined();
  });

  it("saves and retrieves preferences", async () => {
    const storage = await createFreshStorage();
    const saved = await storage.savePreferences({
      enabledSeries: JSON.stringify(["f1", "motogp"]),
    });
    expect(saved.id).toBe(1);
    expect(saved.enabledSeries).toBe(JSON.stringify(["f1", "motogp"]));

    const retrieved = await storage.getPreferences();
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(1);
    expect(retrieved!.enabledSeries).toBe(JSON.stringify(["f1", "motogp"]));
  });

  it("updates existing preferences", async () => {
    const storage = await createFreshStorage();
    await storage.savePreferences({
      enabledSeries: JSON.stringify(["f1"]),
    });
    const updated = await storage.savePreferences({
      enabledSeries: JSON.stringify(["f1", "motogp", "indycar"]),
    });
    expect(updated.id).toBe(1);
    expect(updated.enabledSeries).toBe(JSON.stringify(["f1", "motogp", "indycar"]));
  });

  it("stores multiple preference updates independently", async () => {
    const storage = await createFreshStorage();
    await storage.savePreferences({ enabledSeries: JSON.stringify(["a"]) });
    const firstRead = await storage.getPreferences();
    expect(firstRead!.enabledSeries).toBe(JSON.stringify(["a"]));

    await storage.savePreferences({ enabledSeries: JSON.stringify(["b"]) });
    const secondRead = await storage.getPreferences();
    expect(secondRead!.enabledSeries).toBe(JSON.stringify(["b"]));
  });
});
