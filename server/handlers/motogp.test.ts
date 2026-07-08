import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MotoGPHandler } from "./motogp";
import { clearCacheInstance } from "../cache";

const year = new Date().getFullYear();
const testSeries = {
  id: "motogp",
  name: "MotoGP",
  shortName: "MotoGP",
  color: "#BE0A18",
  category: "Motorcycles",
  handler: "motogp",
  params: { class: "MotoGP" },
  enabled: true,
};

describe("MotoGPHandler", () => {
  const handler = new MotoGPHandler();
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    clearCacheInstance();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns an empty array when no season is available", async () => {
    const fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = fetchMock as any;
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => [] });

    const result = await handler.fetchEvents(testSeries, {}, year);
    expect(result).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws for unknown MotoGP class", async () => {
    const fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = fetchMock as any;

    await expect(handler.fetchEvents(testSeries, { class: "MotoE" }, year)).rejects.toThrow(
      "Unknown MotoGP class: MotoE",
    );
  });

  it("returns empty array when seasons API fails", async () => {
    const fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = fetchMock as any;
    vi.spyOn(console, "error").mockImplementation(() => {});

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      statusText: "Server Error",
    });

    const result = await handler.fetchEvents(testSeries, {}, year);
    expect(result).toEqual([]);
  });

  it("returns empty array when seasons API returns malformed JSON", async () => {
    const fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = fetchMock as any;
    vi.spyOn(console, "error").mockImplementation(() => {});

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => [{ id: "season-2026" }], // missing 'year' field
    });

    const result = await handler.fetchEvents(testSeries, {}, year);
    expect(result).toEqual([]);
  });

  it("handles malformed events response gracefully", async () => {
    const fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = fetchMock as any;
    vi.spyOn(console, "error").mockImplementation(() => {});

    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/results/seasons")) {
        return Promise.resolve({ ok: true, json: async () => [{ id: "season-2026", year }] });
      }
      if (url.includes("/results/events?seasonUuid=") && url.includes("isFinished=true")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              // missing 'circuit' and 'country' fields
              id: "event-1",
              name: "Grand Prix of Test",
              sponsored_name: "Test GP",
              short_name: "TGP",
              date_start: "2026-03-20T00:00:00+00:00",
              date_end: "2026-03-22T00:00:00+00:00",
              test: false,
            },
          ],
        });
      }
      if (url.includes("/results/events?seasonUuid=") && url.includes("isFinished=false")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    const result = await handler.fetchEvents(testSeries, {}, year);

    // Should still return empty gracefully since all events failed validation
    expect(result).toEqual([]);
  });

  it("handles malformed sessions response gracefully without breaking other events", async () => {
    const fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = fetchMock as any;
    vi.spyOn(console, "warn").mockImplementation(() => {});

    let callCount = 0;
    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/results/seasons")) {
        return Promise.resolve({ ok: true, json: async () => [{ id: "season-2026", year }] });
      }
      if (url.includes("/results/events?seasonUuid=") && url.includes("isFinished=true")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: "event-1",
              name: "Good GP",
              sponsored_name: "Good GP",
              short_name: "GGP",
              date_start: "2026-03-20T00:00:00+00:00",
              date_end: "2026-03-22T00:00:00+00:00",
              test: false,
              circuit: { id: "c1", name: "Circuit", place: "Place", nation: "Nation" },
              country: { iso: "XX", name: "Test" },
            },
          ],
        });
      }
      if (url.includes("/results/events?seasonUuid=") && url.includes("isFinished=false")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes("/results/sessions?eventUuid=")) {
        callCount++;
        if (callCount === 1) {
          // First event's sessions are malformed (missing 'date')
          return Promise.resolve({
            ok: true,
            json: async () => [
              { id: "s-bad", number: 1, type: "RAC", status: "SCHEDULED" },
            ],
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => [],
        });
      }
      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    const result = await handler.fetchEvents(testSeries, {}, year);

    // Should not throw — session validation error is caught and logged as warning
    expect(Array.isArray(result)).toBe(true);
  });

  it("deduplicates events returned by both finished and upcoming endpoints", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;

    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/results/seasons")) {
        return Promise.resolve({ ok: true, json: async () => [{ id: "season-2026", year }] });
      }
      if (url.includes("/results/events?seasonUuid=") && url.includes("isFinished=true")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: "event-1",
              name: "Grand Prix of Test",
              sponsored_name: "MotoGP Test Championship",
              short_name: "Test GP",
              date_start: "2026-03-20T00:00:00+00:00",
              date_end: "2026-03-22T00:00:00+00:00",
              test: false,
              circuit: { id: "c1", name: "Test Circuit", place: "Austin", nation: "Testland" },
              country: { iso: "US", name: "United States" },
            },
          ],
        });
      }
      if (url.includes("/results/events?seasonUuid=") && url.includes("isFinished=false")) {
        // Same event returned here too — this is what causes duplication
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: "event-1",
              name: "Grand Prix of Test",
              sponsored_name: "MotoGP Test Championship",
              short_name: "Test GP",
              date_start: "2026-03-20T00:00:00+00:00",
              date_end: "2026-03-22T00:00:00+00:00",
              test: false,
              circuit: { id: "c1", name: "Test Circuit", place: "Austin", nation: "Testland" },
              country: { iso: "US", name: "United States" },
            },
          ],
        });
      }
      if (url.includes("/results/sessions?eventUuid=")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            { id: "s1", date: "2026-03-20T10:00:00Z", number: 1, type: "FP", status: "SCHEDULED" },
            { id: "s2", date: "2026-03-20T14:00:00Z", number: 1, type: "RAC", status: "SCHEDULED" },
          ],
        });
      }
      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    const result = await handler.fetchEvents(testSeries, {}, year);

    // Sessions should only be fetched once (even though the event appears in both responses)
    expect(fetchMock).toHaveBeenCalledTimes(4); // seasons + 2x events + 1x sessions
    expect(result).toHaveLength(2);
    // Both sessions should be round 1, not round 1 and round 2
    expect(result[0].round).toBe(1);
    expect(result[1].round).toBe(1);
  });

  it("fetches MotoGP events and maps sessions correctly", async () => {
    const fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = fetchMock as any;

    fetchMock.mockImplementation((url: string) => {
      if (url.includes("/results/seasons")) {
        return Promise.resolve({ ok: true, json: async () => [{ id: "season-2026", year }] });
      }
      if (url.includes("/results/events?seasonUuid=") && url.includes("isFinished=true")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: "event-1",
              name: "Grand Prix of Test",
              sponsored_name: "MotoGP Test Championship",
              short_name: "Test GP",
              date_start: "2026-03-20T00:00:00+00:00",
              date_end: "2026-03-22T00:00:00+00:00",
              test: false,
              circuit: {
                id: "c1",
                name: "Test Circuit",
                place: "Austin",
                nation: "Testland",
              },
              country: {
                iso: "US",
                name: "United States",
              },
            },
          ],
        });
      }
      if (url.includes("/results/events?seasonUuid=") && url.includes("isFinished=false")) {
        return Promise.resolve({ ok: true, json: async () => [] });
      }
      if (url.includes("/results/sessions?eventUuid=")) {
        return Promise.resolve({
          ok: true,
          json: async () => [
            {
              id: "s1",
              date: "2026-03-20T10:00:00Z",
              number: 1,
              type: "FP",
              status: "SCHEDULED",
            },
            {
              id: "s2",
              date: "2026-03-20T14:00:00Z",
              number: 1,
              type: "Q",
              status: "SCHEDULED",
            },
          ],
        });
      }
      return Promise.reject(new Error(`Unexpected fetch call: ${url}`));
    });

    const result = await handler.fetchEvents(testSeries, {}, year);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      seriesId: "motogp",
      sessionType: "Practice 1",
      title: expect.stringContaining("Practice 1"),
    });
    expect(result[1]).toMatchObject({
      seriesId: "motogp",
      sessionType: "Qualifying 1",
      title: expect.stringContaining("Qualifying 1"),
    });
  });
});
