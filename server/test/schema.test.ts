import { describe, it, expect } from "vitest";
import { eventsQuerySchema, exportIcsQuerySchema } from "@shared/schema";

describe("eventsQuerySchema", () => {
  it("validates correct query parameters", () => {
    const validQuery = { series: "f1", from: "2024-01-01", to: "2024-12-31" };
    const result = eventsQuerySchema.safeParse(validQuery);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validQuery);
  });

  it("requires series parameter", () => {
    const invalidQuery = { from: "2024-01-01" };
    const result = eventsQuerySchema.safeParse(invalidQuery);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Invalid input: expected string, received undefined");
  });

  it("validates date format for from parameter", () => {
    const invalidQuery = { series: "f1", from: "01-01-2024" };
    const result = eventsQuerySchema.safeParse(invalidQuery);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Invalid date format, expected YYYY-MM-DD");
  });

  it("validates date format for to parameter", () => {
    const invalidQuery = { series: "f1", to: "2024/12/31" };
    const result = eventsQuerySchema.safeParse(invalidQuery);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Invalid date format, expected YYYY-MM-DD");
  });

  it("allows optional from and to parameters", () => {
    const validQuery = { series: "f1" };
    const result = eventsQuerySchema.safeParse(validQuery);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validQuery);
  });
});

describe("exportIcsQuerySchema", () => {
  it("validates correct query parameters", () => {
    const validQuery = { series: "f1" };
    const result = exportIcsQuerySchema.safeParse(validQuery);
    expect(result.success).toBe(true);
    expect(result.data).toEqual(validQuery);
  });

  it("requires series parameter", () => {
    const invalidQuery = {};
    const result = exportIcsQuerySchema.safeParse(invalidQuery);
    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe("Invalid input: expected string, received undefined");
  });
});