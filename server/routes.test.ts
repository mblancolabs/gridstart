import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import express from "express";
import request from "supertest";
import { createServer } from "http";
import { registerRoutes } from "./routes";
import { storage } from "./storage";
import { errorHandler } from "./errorHandler";
import { jolpicaCache } from "./handlers/jolpica";

const originalFetch = global.fetch;

describe("API routes", () => {
  let app: express.Express;

  beforeEach(async () => {
    vi.clearAllMocks();
    global.fetch = vi.fn() as any;
    jolpicaCache.clear();
    app = express();
    app.use(express.json());
    await registerRoutes(createServer(), app);
    app.use(errorHandler);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns configured series from /api/series", async () => {
    const res = await request(app).get("/api/series");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "f1", name: "Formula 1" }),
        expect.objectContaining({ id: "motogp", name: "MotoGP" }),
      ]),
    );
  });

  it("returns default preferences when none are stored", async () => {
    vi.spyOn(storage, "getPreferences").mockResolvedValue(undefined);

    const res = await request(app).get("/api/preferences");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("enabledSeries");
    expect(typeof res.body.enabledSeries).toBe("string");
  });

  it("saves preferences with PUT /api/preferences", async () => {
    const saved = { id: 1, enabledSeries: JSON.stringify(["f1"]) };
    vi.spyOn(storage, "savePreferences").mockResolvedValue(saved as any);

    const res = await request(app)
      .put("/api/preferences")
      .send({ enabledSeries: JSON.stringify(["f1"]) });

    expect(res.status).toBe(200);
    expect(res.body).toEqual(saved);
  });

  it("returns validation error for invalid preferences payload", async () => {
    const res = await request(app)
      .put("/api/preferences")
      .send({ invalidField: true });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid preferences data");
  });

  it("returns ICS content for a valid export request", async () => {
    const year = new Date().getFullYear();
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((url: string) => {
      if (typeof url !== "string") {
        return Promise.reject(new Error("Unexpected fetch url"));
      }
      if (url.includes(`/ergast/f1/${year}.json`)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            MRData: {
              RaceTable: {
                Races: [
                  {
                    season: `${year}`,
                    round: "1",
                    raceName: "Test Grand Prix",
                    Circuit: {
                      circuitName: "Test Circuit",
                      Location: {
                        locality: "Test City",
                        country: "Testland",
                      },
                    },
                    date: `${year}-03-01`,
                    time: "15:00:00Z",
                    FirstPractice: { date: `${year}-02-28`, time: "11:30:00Z" },
                    SecondPractice: { date: `${year}-02-28`, time: "15:00:00Z" },
                    ThirdPractice: { date: `${year}-02-29`, time: "12:30:00Z" },
                    Qualifying: { date: `${year}-03-01`, time: "16:00:00Z" },
                  },
                ],
              },
            },
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch url ${url}`));
    });

    const res = await request(app).get("/api/export.ics?series=f1");
    expect(res.status).toBe(200);
    expect(res.header["content-type"]).toContain("text/calendar");
    expect(res.header["content-disposition"]).toContain("gridstart.ics");
    expect(res.text).toContain("BEGIN:VCALENDAR");
  });

  it("returns events for a valid /api/events request", async () => {
    const year = new Date().getFullYear();
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((url: string) => {
      if (typeof url !== "string") {
        return Promise.reject(new Error("Unexpected fetch url"));
      }
      if (url.includes(`/ergast/f1/${year}.json`)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            MRData: {
              RaceTable: {
                Races: [
                  {
                    season: `${year}`,
                    round: "1",
                    raceName: "Test Grand Prix",
                    Circuit: {
                      circuitName: "Test Circuit",
                      Location: {
                        locality: "Test City",
                        country: "Testland",
                      },
                    },
                    date: `${year}-03-01`,
                    time: "15:00:00Z",
                    FirstPractice: { date: `${year}-02-28`, time: "11:30:00Z" },
                    SecondPractice: { date: `${year}-02-28`, time: "15:00:00Z" },
                    ThirdPractice: { date: `${year}-02-29`, time: "12:30:00Z" },
                    Qualifying: { date: `${year}-03-01`, time: "16:00:00Z" },
                  },
                ],
              },
            },
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected fetch url ${url}`));
    });

    const res = await request(app).get("/api/events?series=f1");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
    expect(res.body[0]).toHaveProperty("seriesId", "f1");
  });

  it("returns validation error for invalid series IDs", async () => {
    const res = await request(app).get("/api/events?series=unknown");
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid series IDs");
  });

  it("returns events filtered by date range", async () => {
    const year = new Date().getFullYear();
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes(`/ergast/f1/${year}.json`)) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            MRData: {
              RaceTable: {
                Races: [{
                  season: `${year}`,
                  round: "1",
                  raceName: "Test Grand Prix",
                  Circuit: {
                    circuitName: "Test Circuit",
                    Location: { locality: "City", country: "Country" },
                  },
                  date: `${year}-03-01`,
                  time: "15:00:00Z",
                  FirstPractice: { date: `${year}-02-28`, time: "11:30:00Z" },
                }],
              },
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    const res = await request(app).get("/api/events?series=f1&from=2026-01-01&to=2026-12-31");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("handles fetch failure gracefully in events endpoint", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(new Error("Network error"));

    const res = await request(app).get("/api/events?series=f1");
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it("returns minimal ICS for empty series export", async () => {
    const res = await request(app).get("/api/export.ics?series=f1");
    expect(res.status).toBe(200);
    expect(res.text).toContain("BEGIN:VCALENDAR");
  });

  it("returns validation error for non-existent series in export", async () => {
    const res = await request(app).get("/api/export.ics?series=nonexistent");
    expect(res.status).toBe(400);
    expect(res.body.message).toContain("Invalid series IDs");
  });

  it("returns preferences when stored in database", async () => {
    const prefs = { id: 1, enabledSeries: JSON.stringify(["f1", "motogp"]) };
    vi.spyOn(storage, "getPreferences").mockResolvedValue(prefs as any);

    const res = await request(app).get("/api/preferences");
    expect(res.status).toBe(200);
    expect(res.body.enabledSeries).toBe(JSON.stringify(["f1", "motogp"]));
  });
});
