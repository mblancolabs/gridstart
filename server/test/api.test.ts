import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { clearCacheInstance } from "../cache";
import { getDurationForSession } from "../handlers/jolpica";
import { JolpicaHandler } from "../handlers/jolpica";
import { filterEventsBySessionNames, normalizeSessionName, normalizeSessionNames } from "../handlers/sessionLabels";
import { parseICSEvents } from "../handlers/ics";

vi.hoisted(() => {
  globalThis.__CONFIG_FEEDS__ = JSON.stringify({
    categories: [{ name: "Test", series: [] }],
  });
});

const { fetchICSData } = await import("../routes");

const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("API logic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearCacheInstance();
  });

  afterEach(() => {
    global.fetch = fetchMock;
  });

  describe("fetchICSData", () => {
    it("fetches and caches ICS data on first call", async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue("MOCKED ICS DATA"),
      };
      fetchMock.mockResolvedValue(mockResponse);

      const result = await fetchICSData("f1", "https://example.com/f1.ics");

      expect(fetchMock).toHaveBeenCalledWith("https://example.com/f1.ics", {
        signal: expect.any(AbortSignal),
      });
      expect(result).toBe("MOCKED ICS DATA");
    });

    it("returns cached data on subsequent calls within TTL", async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue("MOCKED ICS DATA"),
      };
      fetchMock.mockResolvedValue(mockResponse);

      await fetchICSData("f1-cache", "https://example.com/f1.ics");
      const result = await fetchICSData("f1-cache", "https://example.com/f1.ics");

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(result).toBe("MOCKED ICS DATA");
    });

    it("refetches when cache is stale", async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue("FRESH ICS DATA"),
      };
      fetchMock.mockResolvedValue(mockResponse);

      const originalNow = Date.now;
      const mockNow = vi.fn();
      Date.now = mockNow;
      mockNow.mockReturnValue(0);
      await fetchICSData("f1-stale", "https://example.com/f1.ics");

      mockNow.mockReturnValue(61 * 60 * 1000);
      const result = await fetchICSData("f1-stale", "https://example.com/f1.ics");

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result).toBe("FRESH ICS DATA");

      Date.now = originalNow;
    });

    it("returns stale cached data when fetch fails", async () => {
      const mockResponse = {
        ok: true,
        text: vi.fn().mockResolvedValue("CACHED ICS DATA"),
      };
      fetchMock.mockResolvedValueOnce(mockResponse);

      await fetchICSData("f1-fail", "https://example.com/f1.ics");

      fetchMock.mockRejectedValueOnce(new Error("Network error"));
      const result = await fetchICSData("f1-fail", "https://example.com/f1.ics");

      expect(result).toBe("CACHED ICS DATA");
    });

    it("throws error when no cache and fetch fails", async () => {
      fetchMock.mockImplementation(() => Promise.reject(new Error("Network error")));

      await expect(fetchICSData("no-cache-series", "https://example.com/new.ics")).rejects.toThrow("Network error");
    });
  });

  describe("getDurationForSession", () => {
    it("returns correct duration for FP1", () => {
      expect(getDurationForSession("fp1")).toBe(60);
    });

    it("returns correct duration for qualifying", () => {
      expect(getDurationForSession("quali")).toBe(70);
    });

    it("returns correct duration for sprint", () => {
      expect(getDurationForSession("sprint")).toBe(45);
    });

    it("returns correct duration for race", () => {
      expect(getDurationForSession("race")).toBe(120);
    });

    it("returns default duration for unknown session", () => {
      expect(getDurationForSession("unknown")).toBe(60);
    });
  });

  describe("session label normalization", () => {
    it("normalizes practice and qualifying aliases", () => {
      expect(normalizeSessionName("FP1")).toBe("Practice 1");
      expect(normalizeSessionName("practice 2")).toBe("Practice 2");
      expect(normalizeSessionName("Qualifying 1")).toBe("Qualifying");
      expect(normalizeSessionName("sprint shootout")).toBe("Sprint Qualifying");
      expect(normalizeSessionName("warm up")).toBe("Warm Up");
    });

    it("matches numbered session types against canonical filters", () => {
      const allowed = normalizeSessionNames(["Practice", "Qualifying"]);
      expect(allowed).toEqual(["Practice", "Qualifying"]);
      expect(
        filterEventsBySessionNames(
          [
            {
              id: "1",
              seriesId: "test",
              seriesName: "Test",
              seriesShortName: "T",
              seriesColor: "#000",
              title: "Test",
              startDate: "2026-01-01T00:00:00Z",
              endDate: "2026-01-01T01:00:00Z",
              isAllDay: false,
              sessionType: "Practice 1",
            },
          ],
          allowed || [],
        ),
      ).toHaveLength(1);
      expect(
        filterEventsBySessionNames(
          [
            {
              id: "2",
              seriesId: "test",
              seriesName: "Test",
              seriesShortName: "T",
              seriesColor: "#000",
              title: "Test",
              startDate: "2026-01-01T00:00:00Z",
              endDate: "2026-01-01T01:00:00Z",
              isAllDay: false,
              sessionType: "Qualifying 2",
            },
          ],
          allowed || [],
        ),
      ).toHaveLength(1);
    });
  });

  describe("ICS session filtering", () => {
    it("filters ICS events by configured sessionNames", () => {
      const events = parseICSEvents(
        `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20240601T120000Z
DTEND:20240601T130000Z
SUMMARY:Free Practice 1
END:VEVENT
BEGIN:VEVENT
UID:2
DTSTART:20240601T140000Z
DTEND:20240601T150000Z
SUMMARY:Qualifying 1
END:VEVENT
END:VCALENDAR`,
        {
          id: "test",
          name: "Test Series",
          shortName: "TST",
          color: "#000000",
          category: "Test",
          handler: "ics",
          params: {},
          enabled: true,
        },
      );

      const filtered = filterEventsBySessionNames(events, ["Practice 1"]);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.sessionType).toBe("Practice 1");
    });
  });

  describe("JolpicaHandler", () => {
    const mockSeries = {
      id: "f1",
      name: "Formula 1",
      shortName: "F1",
      color: "#e10600",
      category: "Formula",
      handler: "jolpica",
      params: {},
      enabled: true,
    };

    const handler = new JolpicaHandler();

    it("fetches and parses F1 race data", async () => {
      const mockApiResponse = {
        MRData: {
          RaceTable: {
            Races: [
              {
                season: "2024",
                round: "1",
                raceName: "Bahrain Grand Prix",
                Circuit: {
                  circuitId: "bahrain",
                  circuitName: "Bahrain International Circuit",
                  Location: { lat: "26.0325", long: "50.5106", locality: "Sakhir", country: "Bahrain" },
                },
                date: "2024-03-02",
                time: "15:00:00Z",
                FirstPractice: { date: "2024-02-29", time: "11:30:00Z" },
                SecondPractice: { date: "2024-02-29", time: "15:00:00Z" },
                ThirdPractice: { date: "2024-03-01", time: "12:30:00Z" },
                Qualifying: { date: "2024-03-01", time: "16:00:00Z" },
              },
            ],
          },
        },
      };

      fetchMock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponse),
        }),
      );

      const result = await handler.fetchEvents(mockSeries, {}, 2024);

      expect(result).toHaveLength(5);
      expect(result[0]).toMatchObject({
        seriesId: "f1",
        title: "F1 | Bahrain GP Practice 1",
        sessionType: "Practice 1",
        round: 1,
        raceName: "Bahrain Grand Prix",
        isAllDay: false,
      });
    });

    it("handles sprint weekend format", async () => {
      const mockApiResponse = {
        MRData: {
          RaceTable: {
            Races: [
              {
                season: "2024",
                round: "10",
                raceName: "Austrian Grand Prix",
                Circuit: {
                  circuitId: "red_bull_ring",
                  circuitName: "Red Bull Ring",
                  Location: { lat: "47.2197", long: "14.7647", locality: "Spielberg", country: "Austria" },
                },
                date: "2024-06-30",
                time: "14:00:00Z",
                FirstPractice: { date: "2024-06-28", time: "11:30:00Z" },
                SprintQualifying: { date: "2024-06-29", time: "12:30:00Z" },
                Sprint: { date: "2024-06-29", time: "17:30:00Z" },
              },
            ],
          },
        },
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockApiResponse),
      });

      const result = await handler.fetchEvents(mockSeries, {}, 2025);

      expect(result).toHaveLength(4);
      const sprintQuali = result.find((e) => e.sessionType === "Sprint Qualifying");
      expect(sprintQuali).toBeDefined();
    });

    it("handles all-day events when time is missing", async () => {
      const mockApiResponse = {
        MRData: {
          RaceTable: {
            Races: [
              {
                season: "2024",
                round: "1",
                raceName: "Test Race",
                Circuit: {
                  circuitId: "test_circuit",
                  circuitName: "Test Circuit",
                  Location: { lat: "0.0000", long: "0.0000", locality: "Test City", country: "Test Country" },
                },
                date: "2024-03-02",
                FirstPractice: { date: "2024-02-29" },
              },
            ],
          },
        },
      };

      fetchMock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponse),
        }),
      );

      const result = await handler.fetchEvents(mockSeries, {}, 2026);

      expect(result).toHaveLength(2);
      const fp1 = result.find((e) => e.sessionType === "Practice 1");
      expect(fp1?.isAllDay).toBe(true);
      expect(fp1?.startDate).toBe("2024-02-29T00:00:00Z");
      expect(fp1?.endDate).toBe("2024-02-29T23:59:59Z");
    });

    it("returns cached data when available", async () => {
      const mockApiResponse = {
        MRData: {
          RaceTable: { Races: [] },
        },
      };

      fetchMock.mockImplementation(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockApiResponse),
        }),
      );

      await handler.fetchEvents(mockSeries, {}, 2027);
      await handler.fetchEvents(mockSeries, {}, 2027);

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("returns empty array when API fails and no cache", async () => {
      vi.spyOn(console, "error").mockImplementation(() => {});
      fetchMock.mockImplementation(() => Promise.reject(new Error("Network error")));

      const result = await handler.fetchEvents(mockSeries, {}, 2028);

      expect(result).toEqual([]);
    });

    it("throws on non-ok HTTP response from Jolpica API", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const result = await handler.fetchEvents(mockSeries, {}, 2029);

      expect(result).toEqual([]);
    });

    it("handles malformed JSON from Jolpica API", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ MRData: {} }),
      });

      const result = await handler.fetchEvents(mockSeries, {}, 2030);

      expect(result).toEqual([]);
    });

    it("returns stale cached data when re-fetch fails", async () => {
      const mockApiResponse = {
        MRData: {
          RaceTable: {
            Races: [
              {
                season: "2031",
                round: "1",
                raceName: "Cache Test Grand Prix",
                Circuit: {
                  circuitId: "cache_circuit",
                  circuitName: "Cache Circuit",
                  Location: { lat: "1.0000", long: "2.0000", locality: "Cache City", country: "Cacheland" },
                },
                date: "2031-03-01",
                time: "15:00:00Z",
                FirstPractice: { date: "2031-02-28", time: "11:30:00Z" },
                SecondPractice: { date: "2031-02-28", time: "15:00:00Z" },
                ThirdPractice: { date: "2031-03-01", time: "12:30:00Z" },
                Qualifying: { date: "2031-03-01", time: "16:00:00Z" },
              },
            ],
          },
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue(mockApiResponse),
      });

      const firstResult = await handler.fetchEvents(mockSeries, {}, 2031);
      expect(firstResult.length).toBeGreaterThan(0);

      fetchMock.mockRejectedValueOnce(new Error("Network error"));
      const secondResult = await handler.fetchEvents(mockSeries, {}, 2031);

      expect(secondResult).toEqual(firstResult);
    });

    it("filters events by session names when params.sessionNames is provided", async () => {
      fetchMock.mockReset();

      const mockApiResponse = {
        MRData: {
          RaceTable: {
            Races: [
              {
                season: "2032",
                round: "1",
                raceName: "Filter Test Grand Prix",
                Circuit: {
                  circuitId: "filter_circuit",
                  circuitName: "Filter Circuit",
                  Location: { lat: "3.0000", long: "4.0000", locality: "Filter City", country: "Filterland" },
                },
                date: "2032-03-01",
                time: "15:00:00Z",
                FirstPractice: { date: "2032-02-28", time: "11:30:00Z" },
                Qualifying: { date: "2032-03-01", time: "16:00:00Z" },
              },
            ],
          },
        },
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockApiResponse),
      });

      const result = await handler.fetchEvents(mockSeries, { sessionNames: ["Practice"] }, 2032);

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((e) => e.sessionType?.includes("Practice"))).toBe(true);
    });
  });
});
