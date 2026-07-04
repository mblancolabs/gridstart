import { describe, it, expect } from "vitest";
import {
  jolpicaSessionSchema,
  jolpicaRaceSchema,
  jolpicaResponseSchema,
  motogpSeasonSchema,
  motogpEventSchema,
  motogpSessionSchema,
} from "./feed-schemas";

describe("jolpicaSessionSchema", () => {
  it("accepts valid session with date and time", () => {
    const result = jolpicaSessionSchema.safeParse({ date: "2026-03-14", time: "15:00:00Z" });
    expect(result.success).toBe(true);
  });

  it("accepts valid session with date only", () => {
    const result = jolpicaSessionSchema.safeParse({ date: "2026-03-14" });
    expect(result.success).toBe(true);
  });

  it("rejects session with missing date", () => {
    const result = jolpicaSessionSchema.safeParse({ time: "15:00:00Z" });
    expect(result.success).toBe(false);
  });
});

describe("jolpicaRaceSchema", () => {
  const validRace = {
    season: "2026",
    round: "1",
    raceName: "Bahrain Grand Prix",
    Circuit: {
      circuitId: "bahrain",
      circuitName: "Bahrain International Circuit",
      Location: { lat: "26.0325", long: "50.5106", locality: "Sakhir", country: "Bahrain" },
    },
    date: "2026-04-12",
    time: "15:00:00Z",
    FirstPractice: { date: "2026-04-10", time: "13:30:00Z" },
    Qualifying: { date: "2026-04-11", time: "16:00:00Z" },
  };

  it("accepts valid race with all fields", () => {
    const result = jolpicaRaceSchema.safeParse(validRace);
    expect(result.success).toBe(true);
  });

  it("accepts race without optional sessions", () => {
    const minimalRace = {
      season: "2026",
      round: "1",
      raceName: "Bahrain Grand Prix",
      Circuit: {
        circuitId: "bahrain",
        circuitName: "Bahrain International Circuit",
        Location: { lat: "26.0325", long: "50.5106", locality: "Sakhir", country: "Bahrain" },
      },
      date: "2026-04-12",
    };
    const result = jolpicaRaceSchema.safeParse(minimalRace);
    expect(result.success).toBe(true);
  });

  it("rejects race with missing circuitId", () => {
    const invalid = {
      ...validRace,
      Circuit: { ...validRace.Circuit, circuitId: undefined },
    };
    const result = jolpicaRaceSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects race with wrong round type", () => {
    const invalid = { ...validRace, round: 1 };
    const result = jolpicaRaceSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("jolpicaResponseSchema", () => {
  it("accepts valid full response", () => {
    const response = {
      MRData: {
        RaceTable: {
          Races: [
            {
              season: "2026",
              round: "1",
              raceName: "Bahrain Grand Prix",
              Circuit: {
                circuitId: "bahrain",
                circuitName: "Bahrain International Circuit",
                Location: { lat: "26.0325", long: "50.5106", locality: "Sakhir", country: "Bahrain" },
              },
              date: "2026-04-12",
              time: "15:00:00Z",
            },
          ],
        },
      },
    };
    const result = jolpicaResponseSchema.safeParse(response);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.MRData.RaceTable.Races).toHaveLength(1);
    }
  });

  it("rejects response with missing MRData", () => {
    const result = jolpicaResponseSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects response with empty Races when field is missing", () => {
    const result = jolpicaResponseSchema.safeParse({
      MRData: { RaceTable: {} },
    });
    expect(result.success).toBe(false);
  });
});

describe("motogpSeasonSchema", () => {
  it("accepts valid season", () => {
    const result = motogpSeasonSchema.safeParse({ id: "abc123", year: 2026 });
    expect(result.success).toBe(true);
  });

  it("rejects season with string year", () => {
    const result = motogpSeasonSchema.safeParse({ id: "abc123", year: "2026" });
    expect(result.success).toBe(false);
  });

  it("rejects season with missing id", () => {
    const result = motogpSeasonSchema.safeParse({ year: 2026 });
    expect(result.success).toBe(false);
  });
});

describe("motogpEventSchema", () => {
  const validEvent = {
    id: "event-1",
    name: "Grand Prix of the Americas",
    sponsored_name: "Red Bull Grand Prix of the Americas",
    short_name: "Americas GP",
    date_start: "2026-03-20T00:00:00+00:00",
    date_end: "2026-03-22T00:00:00+00:00",
    test: false,
    circuit: { id: "c1", name: "Circuit of the Americas", place: "Austin", nation: "USA" },
    country: { iso: "US", name: "United States" },
  };

  it("accepts valid event", () => {
    const result = motogpEventSchema.safeParse(validEvent);
    expect(result.success).toBe(true);
  });

  it("rejects event with missing circuit fields", () => {
    const invalid = { ...validEvent, circuit: { id: "c1" } };
    const result = motogpEventSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it("rejects event with non-boolean test field", () => {
    const invalid = { ...validEvent, test: "yes" };
    const result = motogpEventSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

describe("motogpSessionSchema", () => {
  const validSession = {
    id: "s1",
    date: "2026-03-20T10:00:00Z",
    number: 1,
    type: "FP",
    status: "SCHEDULED",
  };

  it("accepts valid session", () => {
    const result = motogpSessionSchema.safeParse(validSession);
    expect(result.success).toBe(true);
  });

  it("accepts session with null number", () => {
    const result = motogpSessionSchema.safeParse({ ...validSession, number: null });
    expect(result.success).toBe(true);
  });

  it("rejects session with missing date", () => {
    const result = motogpSessionSchema.safeParse({ id: "s1", number: 1, type: "RAC", status: "SCHEDULED" });
    expect(result.success).toBe(false);
  });

  it("rejects session with non-nullable number as string", () => {
    const result = motogpSessionSchema.safeParse({ ...validSession, number: "1" });
    expect(result.success).toBe(false);
  });
});
