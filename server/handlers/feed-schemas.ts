import { z } from "zod";

// ── Jolpica API ──────────────────────────────────────────────

export const jolpicaSessionSchema = z.object({
  date: z.string(),
  time: z.string().optional(),
});

export const jolpicaLocationSchema = z.object({
  lat: z.string(),
  long: z.string(),
  locality: z.string(),
  country: z.string(),
});

export const jolpicaCircuitSchema = z.object({
  circuitId: z.string(),
  circuitName: z.string(),
  Location: jolpicaLocationSchema,
});

export const jolpicaRaceSchema = z.object({
  season: z.string(),
  round: z.string(),
  raceName: z.string(),
  Circuit: jolpicaCircuitSchema,
  date: z.string(),
  time: z.string().optional(),
  FirstPractice: jolpicaSessionSchema.optional(),
  SecondPractice: jolpicaSessionSchema.optional(),
  ThirdPractice: jolpicaSessionSchema.optional(),
  Qualifying: jolpicaSessionSchema.optional(),
  Sprint: jolpicaSessionSchema.optional(),
  SprintQualifying: jolpicaSessionSchema.optional(),
  SprintShootout: jolpicaSessionSchema.optional(),
});

export const jolpicaRaceTableSchema = z.object({
  Races: z.array(jolpicaRaceSchema),
});

export const jolpicaMRDataSchema = z.object({
  RaceTable: jolpicaRaceTableSchema,
});

export const jolpicaResponseSchema = z.object({
  MRData: jolpicaMRDataSchema,
});

export type JolpicaSession = z.infer<typeof jolpicaSessionSchema>;
export type JolpicaRace = z.infer<typeof jolpicaRaceSchema>;

// ── MotoGP API ──────────────────────────────────────────────

export const motogpSeasonSchema = z.object({
  id: z.string(),
  year: z.number(),
});

export const motogpCircuitSchema = z.object({
  id: z.string(),
  name: z.string(),
  place: z.string(),
  nation: z.string(),
});

export const motogpCountrySchema = z.object({
  iso: z.string(),
  name: z.string(),
});

export const motogpEventSchema = z.object({
  id: z.string(),
  name: z.string(),
  sponsored_name: z.string(),
  short_name: z.string(),
  date_start: z.string(),
  date_end: z.string(),
  test: z.boolean(),
  circuit: motogpCircuitSchema,
  country: motogpCountrySchema,
});

export const motogpSessionSchema = z.object({
  id: z.string(),
  date: z.string(),
  number: z.number().nullable(),
  type: z.string(),
  status: z.string(),
});

export type MotoGPSeason = z.infer<typeof motogpSeasonSchema>;
export type MotoGPEvent = z.infer<typeof motogpEventSchema>;
export type MotoGPSession = z.infer<typeof motogpSessionSchema>;
