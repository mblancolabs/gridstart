import { describe, it, expect } from "vitest";
import { setSecurityHeaders, getProductionCsp } from "./security-headers";

describe("setSecurityHeaders", () => {
  it("sets X-Content-Type-Options header", () => {
    const headers = new Headers();
    setSecurityHeaders(headers);
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("sets X-Frame-Options header", () => {
    const headers = new Headers();
    setSecurityHeaders(headers);
    expect(headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("sets Referrer-Policy header", () => {
    const headers = new Headers();
    setSecurityHeaders(headers);
    expect(headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  it("sets Permissions-Policy header", () => {
    const headers = new Headers();
    setSecurityHeaders(headers);
    expect(headers.get("Permissions-Policy")).toBe("geolocation=(), microphone=(), camera=()");
  });
});

describe("getProductionCsp", () => {
  it("returns a string", () => {
    expect(typeof getProductionCsp()).toBe("string");
  });

  it("contains script-src 'self'", () => {
    expect(getProductionCsp()).toContain("script-src 'self'");
  });

  it("contains style-src 'self' https://api.fontshare.com", () => {
    expect(getProductionCsp()).toContain("style-src 'self' https://api.fontshare.com");
  });

  it("does not contain 'unsafe-inline'", () => {
    expect(getProductionCsp()).not.toContain("'unsafe-inline'");
  });

  it("contains all required directives", () => {
    const csp = getProductionCsp();
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("font-src 'self'");
    expect(csp).toContain("img-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("worker-src 'self'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
  });
});
