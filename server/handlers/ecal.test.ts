import { afterEach, describe, expect, it, vi } from "vitest";
import { parseICSEvents, ECALHandler } from "./ecal";

const testSeries = {
  id: "f2",
  name: "Formula 2",
  shortName: "F2",
  color: "#00AEEF",
  category: "Open Wheel",
  handler: "ecal",
  params: {},
  enabled: true,
};

describe("parseICSEvents (ECAL)", () => {
  it("detects diverse session types", () => {
    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20260601T100000Z
DTEND:20260601T110000Z
SUMMARY:Sprint Shootout
LOCATION:Circuit
END:VEVENT
BEGIN:VEVENT
UID:2
DTSTART:20260601T120000Z
DTEND:20260601T130000Z
SUMMARY:Test Session
LOCATION:Circuit
END:VEVENT
END:VCALENDAR`;

    const events = parseICSEvents(calendar, testSeries);
    expect(events).toHaveLength(2);
    expect(events[0].sessionType).toBe("Sprint Qualifying");
    expect(events[1].sessionType).toBe("Test");
  });

  it("handles date range filtering", () => {
    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20260601T120000Z
DTEND:20260601T130000Z
SUMMARY:Race
LOCATION:Circuit
END:VEVENT
END:VCALENDAR`;

    const fromDate = new Date("2026-07-01");
    const events = parseICSEvents(calendar, testSeries, fromDate);
    expect(events).toHaveLength(0);
  });
  it("preserves numeric series suffixes when stripping emojis", () => {
    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20260601T120000Z
DTEND:20260601T130000Z
SUMMARY:FIA FORMULA 2️⃣ : The Championship United States Practice
LOCATION:United States
END:VEVENT
END:VCALENDAR`;

    const events = parseICSEvents(calendar, testSeries);

    expect(events).toHaveLength(1);
    expect(events[0].raceName).toBe("FIA FORMULA 2 : The Championship United States");
    expect(events[0].title).toBe("F2 | United States Practice");
  });

  it("parses location with pipe separator taking left side", () => {
    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20260601T120000Z
DTEND:20260601T130000Z
SUMMARY:Race
LOCATION:Left Text | Right Place
END:VEVENT
END:VCALENDAR`;

    const events = parseICSEvents(calendar, testSeries);
    expect(events).toHaveLength(1);
    expect(events[0].location).toBe("Left Text");
  });

  it("parses location with at separator", () => {
    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20260601T120000Z
DTEND:20260601T130000Z
SUMMARY:Race
LOCATION:Series @ Silverstone
END:VEVENT
END:VCALENDAR`;

    const events = parseICSEvents(calendar, testSeries);
    expect(events).toHaveLength(1);
    expect(events[0].location).toBe("Silverstone");
  });

  it("ignores events with filtered title words", () => {
    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20260601T120000Z
DTEND:20260601T130000Z
SUMMARY:Calendar Overview
LOCATION:Somewhere
END:VEVENT
END:VCALENDAR`;

    const events = parseICSEvents(calendar, testSeries);
    expect(events).toHaveLength(0);
  });

  it("handles malformed ICS data gracefully", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const events = parseICSEvents("not valid ics data", testSeries);
    expect(events).toEqual([]);
  });

  it("sets raceName for IndyCar series", () => {
    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20260601T120000Z
DTEND:20260601T130000Z
SUMMARY:Race
LOCATION:Indianapolis
END:VEVENT
END:VCALENDAR`;

    const events = parseICSEvents(calendar, {
      id: "indycar",
      name: "IndyCar Series",
      shortName: "INDY",
      color: "#FF0000",
      category: "Open Wheel",
      handler: "ecal",
      params: {},
      enabled: true,
    });

    expect(events).toHaveLength(1);
    expect(events[0].raceName).toContain("IndyCar Series");
    expect(events[0].location).toBe("Indianapolis");
  });
});

describe("ECAL parseICSEvents (additional edge cases)", () => {
  it("detects Warm Up from title containing 'warm'", () => {
    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20260601T100000Z
DTEND:20260601T110000Z
SUMMARY:Morning Warm Up
LOCATION:Circuit
END:VEVENT
END:VCALENDAR`;

    const events = parseICSEvents(calendar, testSeries);
    expect(events).toHaveLength(1);
    expect(events[0].sessionType).toBe("Warm Up");
  });

  it("defaults to Race for unrecognizable session title", () => {
    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20260601T100000Z
DTEND:20260601T110000Z
SUMMARY:Driver Parade
LOCATION:Circuit
END:VEVENT
END:VCALENDAR`;

    const events = parseICSEvents(calendar, testSeries);
    expect(events).toHaveLength(1);
    expect(events[0].sessionType).toBe("Race");
  });

  it("detects GP in title and returns Race", () => {
    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20260601T100000Z
DTEND:20260601T110000Z
SUMMARY:Australian GP
LOCATION:Melbourne
END:VEVENT
END:VCALENDAR`;

    const events = parseICSEvents(calendar, testSeries);
    expect(events).toHaveLength(1);
    expect(events[0].sessionType).toBe("Race");
  });
});

describe("ECALHandler", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("throws when url param is missing", async () => {
    const handler = new ECALHandler();
    await expect(handler.fetchEvents(testSeries, {}, 2026)).rejects.toThrow("ECAL handler requires 'url' parameter");
  });

  it("filters events by session names when params.sessionNames is provided", async () => {
    const handler = new ECALHandler();
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20260601T100000Z
DTEND:20260601T110000Z
SUMMARY:Free Practice 1
LOCATION:Circuit
END:VEVENT
BEGIN:VEVENT
UID:2
DTSTART:20260601T120000Z
DTEND:20260601T130000Z
SUMMARY:Qualifying
LOCATION:Circuit
END:VEVENT
END:VCALENDAR`),
    });

    const result = await handler.fetchEvents(
      {
        id: "test-ecal",
        name: "Test ECAL",
        shortName: "TEC",
        color: "#000",
        category: "Test",
        handler: "ecal",
        params: {},
        enabled: true,
      },
      { url: "https://example.com/test.ics", sessionNames: ["Practice"] },
      2026,
    );

    expect(result).toHaveLength(1);
    expect(result[0].sessionType).toBe("Practice 1");
  });
});
