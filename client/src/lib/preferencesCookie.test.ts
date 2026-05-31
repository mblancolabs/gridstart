import { describe, it, expect, beforeEach } from "vitest";
import { getEnabledSeriesFromCookie, setEnabledSeriesCookie } from "./preferencesCookie";

const COOKIE_NAME = "gridstart_enabled_series";

function setRawCookie(value: string) {
  document.cookie = value;
}

describe("getEnabledSeriesFromCookie", () => {
  beforeEach(() => {
    // Clear all cookies
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
    });
  });

  it("returns parsed array when cookie exists with valid JSON array", () => {
    setRawCookie(`${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(["f1", "motogp"]))}`);
    expect(getEnabledSeriesFromCookie()).toEqual(["f1", "motogp"]);
  });

  it("returns null when cookie has invalid JSON", () => {
    setRawCookie(`${COOKIE_NAME}=${encodeURIComponent("not-json")}`);
    expect(getEnabledSeriesFromCookie()).toBeNull();
  });

  it("returns null when cookie value is JSON but not an array", () => {
    setRawCookie(`${COOKIE_NAME}=${encodeURIComponent(JSON.stringify({ series: "f1" }))}`);
    expect(getEnabledSeriesFromCookie()).toBeNull();
  });

  it("returns null when cookie does not exist", () => {
    expect(getEnabledSeriesFromCookie()).toBeNull();
  });

  it("returns null when there are no cookies at all", () => {
    expect(document.cookie).toBe("");
    expect(getEnabledSeriesFromCookie()).toBeNull();
  });

  it("ignores other cookies and finds the right one", () => {
    setRawCookie("other_cookie=value");
    setRawCookie(`${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(["wec"]))}`);
    setRawCookie("another=thing");
    expect(getEnabledSeriesFromCookie()).toEqual(["wec"]);
  });

  it("handles single-element array", () => {
    setRawCookie(`${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(["f1"]))}`);
    expect(getEnabledSeriesFromCookie()).toEqual(["f1"]);
  });

  it("handles empty array", () => {
    setRawCookie(`${COOKIE_NAME}=${encodeURIComponent(JSON.stringify([]))}`);
    expect(getEnabledSeriesFromCookie()).toEqual([]);
  });
});

describe("setEnabledSeriesCookie", () => {
  beforeEach(() => {
    document.cookie.split(";").forEach((c) => {
      document.cookie = c
        .replace(/^ +/, "")
        .replace(/=.*/, `=;expires=${new Date(0).toUTCString()};path=/`);
    });
  });

  it("writes cookie with JSON-encoded series", () => {
    setEnabledSeriesCookie(["f1", "motogp"]);
    const result = getEnabledSeriesFromCookie();
    expect(result).toEqual(["f1", "motogp"]);
  });

  it("writes cookie with single series", () => {
    setEnabledSeriesCookie(["wec"]);
    expect(getEnabledSeriesFromCookie()).toEqual(["wec"]);
  });

  it("writes cookie with empty array", () => {
    setEnabledSeriesCookie([]);
    expect(getEnabledSeriesFromCookie()).toEqual([]);
  });

  it("sets cookie path to root", () => {
    const mockSet = vi.fn();
    const originalCookie = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!;
    Object.defineProperty(document, "cookie", {
      get: () => "",
      set: mockSet,
      configurable: true,
    });

    setEnabledSeriesCookie(["f1"]);

    expect(mockSet).toHaveBeenCalledWith(
      expect.stringContaining("path=/")
    );

    Object.defineProperty(document, "cookie", originalCookie);
  });

  it("sets cookie with one-year max-age", () => {
    const mockSet = vi.fn();
    const originalCookie = Object.getOwnPropertyDescriptor(Document.prototype, "cookie")!;
    Object.defineProperty(document, "cookie", {
      get: () => "",
      set: mockSet,
      configurable: true,
    });

    setEnabledSeriesCookie(["f1"]);

    const setCall = mockSet.mock.calls[0][0] as string;
    const maxAge = parseInt(setCall.match(/max-age=(\d+)/)?.[1] ?? "0", 10);
    const oneYear = 60 * 60 * 24 * 365;
    expect(maxAge).toBe(oneYear);

    Object.defineProperty(document, "cookie", originalCookie);
  });
});
