import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { MotoGPICSHandler, parseMotoGPICSEvents } from "./motogpics";
import type { SeriesInfo } from "@shared/schema";

const fixture = readFileSync(new URL("./fixtures/motogp-sample.ics", import.meta.url), "utf8");

const motogpSeries: SeriesInfo = {
  id: "motogp",
  name: "MotoGP",
  shortName: "MotoGP",
  color: "#D50041",
  category: "Motorcycles",
  handler: "motogpics",
  params: {},
  enabled: true,
};

describe("parseMotoGPICSEvents", () => {
  it("parses all sessions of a round", () => {
    const events = parseMotoGPICSEvents(fixture, motogpSeries, 2026, "MotoGP");
    expect(events).toHaveLength(8);
  });

  it("maps session types with parity to the previous PulseLive output", () => {
    const events = parseMotoGPICSEvents(fixture, motogpSeries, 2026, "MotoGP");
    const byTitle = new Map(events.map((e) => [e.title, e.sessionType]));
    expect(byTitle.get("MotoGP | Thailand Practice 1")).toBe("Practice 1");
    expect(byTitle.get("MotoGP | Thailand Practice")).toBe("Practice");
    expect(byTitle.get("MotoGP | Thailand Practice 2")).toBe("Practice 2");
    expect(byTitle.get("MotoGP | Thailand Qualifying 1")).toBe("Qualifying 1");
    expect(byTitle.get("MotoGP | Thailand Qualifying 2")).toBe("Qualifying 2");
    expect(byTitle.get("MotoGP | Thailand Sprint")).toBe("Sprint");
    expect(byTitle.get("MotoGP | Thailand Warm Up")).toBe("Warm Up");
    expect(byTitle.get("MotoGP | Thailand Race")).toBe("Race");
  });

  it("sets race grouping fields from the feed", () => {
    const events = parseMotoGPICSEvents(fixture, motogpSeries, 2026, "MotoGP");
    for (const event of events) {
      expect(event.raceName).toBe("Thailand");
      expect(event.location).toBe("Thailand");
      expect(event.round).toBe(1);
      expect(event.isAllDay).toBe(false);
    }
  });

  it("preserves UTC start/end times from the feed", () => {
    const events = parseMotoGPICSEvents(fixture, motogpSeries, 2026, "MotoGP");
    const fp1 = events.find((e) => e.sessionType === "Practice 1")!;
    expect(fp1.startDate).toBe("2026-02-27T03:45:00.000Z");
    expect(fp1.endDate).toBe("2026-02-27T04:30:00.000Z");
    const race = events.find((e) => e.sessionType === "Race")!;
    expect(race.startDate).toBe("2026-03-01T08:00:00.000Z");
  });

  it("generates stable unique ids matching the previous scheme", () => {
    const events = parseMotoGPICSEvents(fixture, motogpSeries, 2026, "MotoGP");
    const ids = events.map((e) => e.id);
    expect(new Set(ids).size).toBe(8);
    expect(ids).toContain("motogp-motogp-2026-r1-FP1");
    expect(ids).toContain("motogp-motogp-2026-r1-Q1");
    expect(ids).toContain("motogp-motogp-2026-r1-RAC");
  });

  it("filters events to the requested year", () => {
    const events = parseMotoGPICSEvents(fixture, motogpSeries, 2025, "MotoGP");
    expect(events).toHaveLength(0);
  });

  it("disambiguates raceName for locations hosting multiple rounds", () => {
    const multiSpain = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:http://2026.motogpcal.com/#GP3_2026_race
DTSTART:20260426T130000Z
DTEND:20260426T140000Z
LOCATION:Spain
CATEGORIES:Race,MOTOGP
END:VEVENT
BEGIN:VEVENT
UID:http://2026.motogpcal.com/#GP5_2026_race
DTSTART:20260510T130000Z
DTEND:20260510T140000Z
LOCATION:Spain
CATEGORIES:Race,MOTOGP
END:VEVENT
BEGIN:VEVENT
UID:http://2026.motogpcal.com/#GP6_2026_race
DTSTART:20260531T130000Z
DTEND:20260531T140000Z
LOCATION:Italy
CATEGORIES:Race,MOTOGP
END:VEVENT
END:VCALENDAR`;

    const events = parseMotoGPICSEvents(multiSpain, motogpSeries, 2026, "MotoGP");
    expect(events).toHaveLength(3);
    expect(events[0].round).toBe(4);
    expect(events[1].round).toBe(6);
    expect(events[2].round).toBe(7);
    expect(events[0].raceName).toBe("Spain GP 4");
    expect(events[1].raceName).toBe("Spain GP 6");
    expect(events[2].raceName).toBe("Italy");
  });

  it("handles malformed ICS data gracefully", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const events = parseMotoGPICSEvents("not valid ics data", motogpSeries, 2026, "MotoGP");
    expect(events).toEqual([]);
    vi.restoreAllMocks();
  });
});

describe("MotoGPICSHandler", () => {
  const originalFetch = global.fetch;
  const handler = new MotoGPICSHandler();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function mockFetchOnce(): vi.fn {
    const fetchMock = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    global.fetch = fetchMock as any;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      text: vi.fn().mockResolvedValue(fixture) as any,
    });
    return fetchMock;
  }

  it("fetches the default feed URL when params.url is not provided", async () => {
    const fetchMock = mockFetchOnce();
    const events = await handler.fetchEvents(
      { ...motogpSeries, id: "motogp-default" },
      { class: "MotoGP" },
      2026,
    );
    expect(events).toHaveLength(8);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0];
    expect(calledUrl).toBe(
      "https://files-motogp.motorsportcalendars.com/motogp-calendar_p1_p2_practice_qualifying1_qualifying2_sprint_warmup_race.ics",
    );
  });

  it("uses params.url when provided", async () => {
    const fetchMock = mockFetchOnce();
    const events = await handler.fetchEvents(
      { ...motogpSeries, id: "motogp-custom" },
      { class: "MotoGP", url: "https://example.com/custom.ics" },
      2026,
    );
    expect(events).toHaveLength(8);
    expect(fetchMock.mock.calls[0][0]).toBe("https://example.com/custom.ics");
  });

  it("filters events by session names when params.sessionNames is provided", async () => {
    mockFetchOnce();
    const events = await handler.fetchEvents(
      { ...motogpSeries, id: "motogp-filter" },
      { class: "MotoGP", sessionNames: ["Practice"] },
      2026,
    );
    expect(events).toHaveLength(3);
    expect(new Set(events.map((e) => e.sessionType))).toEqual(
      new Set(["Practice 1", "Practice", "Practice 2"]),
    );
  });

  it("rejects unsupported classes", async () => {
    await expect(
      handler.fetchEvents({ ...motogpSeries, id: "moto2" }, { class: "Moto2" }, 2026),
    ).rejects.toThrow("does not support class");
  });
});