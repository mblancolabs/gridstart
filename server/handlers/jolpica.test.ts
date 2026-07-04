import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { JolpicaHandler } from "./jolpica";
import { clearCacheInstance } from "../cache";

const year = new Date().getFullYear();

const testSeries = {
  id: "f1",
  name: "Formula 1",
  shortName: "F1",
  color: "#E10600",
  category: "Open Wheel",
  handler: "jolpica",
  params: {},
  enabled: true,
};

const validRace = {
  season: String(year),
  round: "1",
  raceName: "Bahrain Grand Prix",
  Circuit: {
    circuitId: "bahrain",
    circuitName: "Bahrain International Circuit",
    Location: { lat: "26.0325", long: "50.5106", locality: "Sakhir", country: "Bahrain" },
  },
  date: "2026-04-12",
  time: "15:00:00Z",
  FirstPractice: { date: "2026-04-10", time: "11:30:00Z" },
  SecondPractice: { date: "2026-04-10", time: "15:00:00Z" },
  ThirdPractice: { date: "2026-04-11", time: "12:30:00Z" },
  Qualifying: { date: "2026-04-11", time: "16:00:00Z" },
};

function buildJolpicaResponse(races: unknown[]) {
  return {
    MRData: {
      RaceTable: { Races: races },
    },
  };
}

describe("JolpicaHandler", () => {
  const handler = new JolpicaHandler();
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    clearCacheInstance();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns parsed events for a valid response", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => buildJolpicaResponse([validRace]),
    });

    const result = await handler.fetchEvents(testSeries, {}, year);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toMatchObject({
      seriesId: "f1",
      sessionType: "Practice 1",
    });
  });

  it("returns empty array on HTTP error", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    vi.spyOn(console, "error").mockImplementation(() => {});

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });

    const result = await handler.fetchEvents(testSeries, {}, year);
    expect(result).toEqual([]);
  });

  it("returns empty array when upstream returns malformed JSON (missing MRData)", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    vi.spyOn(console, "error").mockImplementation(() => {});

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await handler.fetchEvents(testSeries, {}, year);
    expect(result).toEqual([]);
  });

  it("returns empty array when upstream returns malformed JSON (missing Races)", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    vi.spyOn(console, "error").mockImplementation(() => {});

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => buildJolpicaResponse(null),
    });

    const result = await handler.fetchEvents(testSeries, {}, year);
    expect(result).toEqual([]);
  });

  it("filters events by session names when params.sessionNames is provided", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    // Only include FirstPractice so only "Practice 1" is available
    const raceWithoutSecondPractice = {
      ...validRace,
      SecondPractice: undefined,
      ThirdPractice: undefined,
    };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => buildJolpicaResponse([raceWithoutSecondPractice]),
    });

    const result = await handler.fetchEvents(testSeries, { sessionNames: ["Practice 1"] }, year);

    expect(result.length).toBeGreaterThan(0);
    for (const event of result) {
      expect(event.sessionType).toBe("Practice 1");
    }
  });
});
