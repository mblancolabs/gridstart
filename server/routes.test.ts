import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { Hono } from "hono";
import { errorHandler } from "./errorHandler";
import { clearCacheInstance } from "./cache";

vi.hoisted(() => {
  globalThis.__CONFIG_FEEDS__ = JSON.stringify({
    categories: [
      {
        name: "Open Wheel",
        series: [
          { id: "f1", name: "Formula 1", shortName: "F1", color: "#E10600", handler: "jolpica", params: {}, enabled: true },
        ],
      },
      {
        name: "Motorcycles",
        series: [
          { id: "motogp", name: "MotoGP", shortName: "MGP", color: "#FF0000", handler: "motogp", params: {}, enabled: true },
        ],
      },
    ],
  });
});

const { registerRoutes } = await import("./routes");

const originalFetch = global.fetch;

describe("API routes", () => {
  let app: Hono;

  beforeEach(async () => {
    vi.clearAllMocks();
    global.fetch = vi.fn() as unknown as typeof global.fetch;
    clearCacheInstance();
    app = new Hono();
    await registerRoutes(app);
    app.onError(errorHandler);
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns configured series from /api/series", async () => {
    const res = await app.request("/api/series");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "f1", name: "Formula 1" }),
        expect.objectContaining({ id: "motogp", name: "MotoGP" }),
      ]),
    );
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
                      Location: { locality: "Test City", country: "Testland" },
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

    const res = await app.request(`/api/export.ics?series=f1`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    expect(res.headers.get("content-disposition")).toContain("gridstart.ics");
    const text = await res.text();
    expect(text).toContain("BEGIN:VCALENDAR");
  });

  it("returns events for a valid /api/events request", async () => {
    const year = new Date().getFullYear();
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((url: string) => {
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
                      Location: { locality: "Test City", country: "Testland" },
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
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    const res = await app.request(`/api/events?series=f1`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect(body[0]).toHaveProperty("seriesId", "f1");
  });

  it("returns validation error for invalid series IDs", async () => {
    const res = await app.request("/api/events?series=unknown");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("Invalid series IDs");
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
                Races: [
                  {
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
                  },
                ],
              },
            },
          }),
        });
      }
      return Promise.resolve({ ok: true, json: async () => [] });
    });

    const res = await app.request(`/api/events?series=f1&from=2026-01-01&to=2026-12-31`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  it("handles fetch failure gracefully in events endpoint", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockRejectedValue(new Error("Network error"));

    const res = await app.request("/api/events?series=f1");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns minimal ICS for empty series export", async () => {
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ MRData: { RaceTable: { Races: [] } } }),
    });

    const res = await app.request("/api/export.ics?series=f1");
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("BEGIN:VCALENDAR");
  });

  it("returns validation error for non-existent series in export", async () => {
    const res = await app.request("/api/export.ics?series=nonexistent");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("Invalid series IDs");
  });

  it("returns empty array for events with only commas in series parameter", async () => {
    const res = await app.request("/api/events?series=,,");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns bad request for invalid date format in events query", async () => {
    const res = await app.request("/api/events?series=f1&from=01-01-2024");
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("Invalid query parameters");
  });

  it("returns minimal ICS for only commas in export", async () => {
    const res = await app.request("/api/export.ics?series=,,");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/calendar");
    const text = await res.text();
    expect(text).toContain("BEGIN:VCALENDAR");
  });

  it("handles all-day events in ICS export", async () => {
    const year = new Date().getFullYear();
    const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;
    fetchMock.mockImplementation((url: string) => {
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
                    raceName: "All-Day Grand Prix",
                    Circuit: {
                      circuitName: "Circuit",
                      Location: { locality: "City", country: "Country" },
                    },
                    date: `${year}-03-01`,
                  },
                ],
              },
            },
          }),
        });
      }
      return Promise.reject(new Error(`Unexpected url ${url}`));
    });

    const res = await app.request(`/api/export.ics?series=f1`);
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("DTSTART;VALUE=DATE");
    expect(text).toContain("DTEND;VALUE=DATE");
  });
});
