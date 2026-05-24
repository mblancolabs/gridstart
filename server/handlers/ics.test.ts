import { beforeEach, describe, expect, it, vi, afterEach } from "vitest";
import { ICSHandler, parseICSEvents } from "./ics";

describe("ICS handler", () => {
  const originalFetch = global.fetch;
  const handler = new ICSHandler();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("parses timed ICS events and detects session types", () => {
    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20240601T120000Z
DTEND:20240601T130000Z
SUMMARY:Free Practice 1
END:VEVENT
BEGIN:VEVENT
UID:2
DTSTART;VALUE=DATE:20240602
DTEND;VALUE=DATE:20240603
SUMMARY:Race
END:VEVENT
END:VCALENDAR`;

    const events = parseICSEvents(calendar, {
      id: "test-ics",
      name: "Test Series",
      shortName: "TST",
      color: "#000000",
      category: "Test",
      handler: "ics",
      params: {},
      enabled: true,
    });

    expect(events).toHaveLength(2);
    expect(events[0].sessionType).toBe("Practice 1");
    expect(events[1].isAllDay).toBe(true);
  });

  it("throws when params.url is missing", async () => {
    await expect(
      handler.fetchEvents(
        {
          id: "missing-url",
          name: "Test Series",
          shortName: "TST",
          color: "#000000",
          category: "Test",
          handler: "ics",
          params: {},
          enabled: true,
        },
        {},
        2026,
      ),
    ).rejects.toThrow("ICS handler requires 'url' parameter");
  });

  it("detects various session types from event summaries", () => {
    const calendar = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20240601T120000Z
DTEND:20240601T130000Z
SUMMARY:Grand Prix
END:VEVENT
BEGIN:VEVENT
UID:2
DTSTART:20240601T140000Z
DTEND:20240601T150000Z
SUMMARY:Sprint
END:VEVENT
BEGIN:VEVENT
UID:3
DTSTART:20240601T160000Z
DTEND:20240601T170000Z
SUMMARY:Practice 3
END:VEVENT
BEGIN:VEVENT
UID:4
DTSTART:20240601T180000Z
DTEND:20240601T190000Z
SUMMARY:Warm Up
END:VEVENT
BEGIN:VEVENT
UID:5
DTSTART:20240601T200000Z
DTEND:20240601T210000Z
SUMMARY:Test Session
END:VEVENT
END:VCALENDAR`;

    const events = parseICSEvents(calendar, {
      id: "test-ics",
      name: "Test Series",
      shortName: "TST",
      color: "#000000",
      category: "Test",
      handler: "ics",
      params: {},
      enabled: true,
    });

    expect(events).toHaveLength(5);
    expect(events[0].sessionType).toBe("Race");
    expect(events[1].sessionType).toBe("Sprint");
    expect(events[2].sessionType).toBe("Practice 3");
    expect(events[3].sessionType).toBe("Warm Up");
    expect(events[4].sessionType).toBe("Test");
  });

  it("handles malformed ICS data gracefully", () => {
    const events = parseICSEvents("not valid ics data", {
      id: "test-ics",
      name: "Test Series",
      shortName: "TST",
      color: "#000000",
      category: "Test",
      handler: "ics",
      params: {},
      enabled: true,
    });
    expect(events).toEqual([]);
  });

  it("filters events by session names when params.sessionNames is provided", async () => {
    const fetchMock = vi.fn();
    global.fetch = fetchMock as any;
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValue(`BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
UID:1
DTSTART:20240601T120000Z
DTEND:20240601T130000Z
SUMMARY:Free Practice 1
END:VEVENT
BEGIN:VEVENT
UID:2
DTSTART:20240602T140000Z
DTEND:20240602T150000Z
SUMMARY:Qualifying
END:VEVENT
END:VCALENDAR`),
    });

    const result = await handler.fetchEvents(
      {
        id: "filtered-ics",
        name: "Test Series",
        shortName: "TST",
        color: "#000000",
        category: "Test",
        handler: "ics",
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
