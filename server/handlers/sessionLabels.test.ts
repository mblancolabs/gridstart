import { describe, it, expect } from "vitest";
import {
  filterEventsBySessionNames,
  normalizeSessionName,
  normalizeSessionNames,
  sessionNameMatches,
} from "./sessionLabels";

describe("normalizeSessionName", () => {
  it("maps common aliases to canonical session names", () => {
    expect(normalizeSessionName("fp1")).toBe("Practice 1");
    expect(normalizeSessionName("FP2")).toBe("Practice 2");
    expect(normalizeSessionName("qualifying 1")).toBe("Qualifying");
    expect(normalizeSessionName("sprint shootout")).toBe("Sprint Qualifying");
    expect(normalizeSessionName("warm")).toBe("Warm Up");
  });

  it("returns undefined for unsupported labels", () => {
    expect(normalizeSessionName("undefined session")).toBeUndefined();
  });
});

describe("normalizeSessionNames", () => {
  it("normalizes an array of session labels and removes duplicates", () => {
    const normalized = normalizeSessionNames(["FP1", "Qualifying", "fp1", "sprint"]);
    expect(normalized).toEqual(["Practice 1", "Qualifying", "Sprint"]);
  });

  it("returns undefined for non-array input", () => {
    expect(normalizeSessionNames(undefined)).toBeUndefined();
    expect(normalizeSessionNames("Practice")).toBeUndefined();
  });
});

describe("sessionNameMatches", () => {
  it("matches exact normalized session names", () => {
    expect(sessionNameMatches("Practice 1", ["Practice 1"])).toBe(true);
    expect(sessionNameMatches("Qualifying", ["Qualifying"])).toBe(true);
  });

  it("matches numbered session types against parent category filters", () => {
    expect(sessionNameMatches("Practice 2", ["Practice"])).toBe(true);
    expect(sessionNameMatches("Qualifying 3", ["Qualifying"])).toBe(true);
    expect(sessionNameMatches("Sprint", ["Practice"])).toBe(false);
  });
});

describe("filterEventsBySessionNames", () => {
  const events = [
    {
      id: "1",
      seriesId: "test",
      seriesName: "Test Series",
      seriesShortName: "TST",
      seriesColor: "#000000",
      title: "FP1",
      startDate: "2026-01-01T10:00:00Z",
      endDate: "2026-01-01T11:00:00Z",
      isAllDay: false,
      sessionType: "Practice 1",
    },
    {
      id: "2",
      seriesId: "test",
      seriesName: "Test Series",
      seriesShortName: "TST",
      seriesColor: "#000000",
      title: "Qualifying",
      startDate: "2026-01-01T12:00:00Z",
      endDate: "2026-01-01T13:00:00Z",
      isAllDay: false,
      sessionType: "Qualifying",
    },
  ];

  it("returns only events that match allowed session names", () => {
    const filtered = filterEventsBySessionNames(events, ["Practice"]);
    expect(filtered).toHaveLength(1);
    expect(filtered[0].sessionType).toBe("Practice 1");
  });

  it("returns an empty array if no events match", () => {
    const filtered = filterEventsBySessionNames(events, ["Sprint"]);
    expect(filtered).toEqual([]);
  });
});
