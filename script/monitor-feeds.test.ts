import { afterEach, describe, expect, it, vi } from "vitest";
import { checkEndpoint, endpoints, type FeedEndpoint } from "./monitor-feeds";

const productionUrl = "https://production.test";

function createEndpoint(overrides: Partial<FeedEndpoint> = {}): FeedEndpoint {
  return {
    series: "test",
    path: "/api/events?series=test",
    handler: "ecal",
    ...overrides,
  };
}

function createResponse(body: unknown, status = 200) {
  return {
    status,
    json: vi.fn().mockResolvedValue(body),
  };
}

describe("checkEndpoint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts an empty response for an expected-empty endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createResponse([])));

    const result = await checkEndpoint(createEndpoint({ allowEmpty: true }), productionUrl);

    expect(result).toMatchObject({
      ok: true,
      eventCount: 0,
      expectedEmpty: true,
    });
  });

  it("rejects an empty response for a strict endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createResponse([])));

    const result = await checkEndpoint(createEndpoint(), productionUrl);

    expect(result).toMatchObject({
      ok: false,
      eventCount: 0,
      error: "Response array is empty",
    });
  });

  it("rejects a non-array response even for an expected-empty endpoint", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(createResponse({ events: [] })));

    const result = await checkEndpoint(createEndpoint({ allowEmpty: true }), productionUrl);

    expect(result).toMatchObject({
      ok: false,
      error: "Response is not a JSON array",
    });
  });
});

describe("monitor endpoints", () => {
  it("includes F2 as a strict ECAL probe", () => {
    expect(endpoints).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          series: "f2",
          handler: "ecal",
        }),
      ]),
    );
    expect(endpoints.find((endpoint) => endpoint.series === "f2")?.allowEmpty).toBeUndefined();
  });
});
