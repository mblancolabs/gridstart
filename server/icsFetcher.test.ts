import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockIcsData = "BEGIN:VCALENDAR\nVERSION:2.0\nEND:VCALENDAR";

describe("fetchICSData", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetches ICS data on first call", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      text: vi.fn().mockResolvedValue(mockIcsData),
    });

    const { fetchICSData } = await import("./icsFetcher");
    const result = await fetchICSData("test-series", "https://example.com/test.ics");

    expect(result).toBe(mockIcsData);
    expect(global.fetch).toHaveBeenCalledOnce();
  });

  it("returns cached data on subsequent calls within TTL", async () => {
    let callCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      callCount++;
      return Promise.resolve({
        ok: true,
        text: vi.fn().mockResolvedValue(mockIcsData),
      });
    });

    const { fetchICSData } = await import("./icsFetcher");
    await fetchICSData("cached-series", "https://example.com/cached.ics");
    const result = await fetchICSData("cached-series", "https://example.com/cached.ics");

    expect(result).toBe(mockIcsData);
    expect(callCount).toBe(1);
  });

  it("throws on HTTP error with no cached fallback", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { fetchICSData } = await import("./icsFetcher");
    await expect(
      fetchICSData("error-series", "https://example.com/error.ics"),
    ).rejects.toThrow("HTTP 500");
  });

  it("returns stale cached data when fetch fails", async () => {
    let fetchCount = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      fetchCount++;
      if (fetchCount === 1) {
        return Promise.resolve({
          ok: true,
          text: vi.fn().mockResolvedValue(mockIcsData),
        });
      }
      return Promise.reject(new Error("Network failure"));
    });

    const { fetchICSData } = await import("./icsFetcher");
    await fetchICSData("stale-series", "https://example.com/stale.ics");

    global.fetch = vi.fn().mockRejectedValue(new Error("Network failure"));

    const result = await fetchICSData("stale-series", "https://example.com/stale.ics");
    expect(result).toBe(mockIcsData);
  });
});
