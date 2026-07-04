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

  it("sets Strict-Transport-Security header", () => {
    const headers = new Headers();
    setSecurityHeaders(headers);
    expect(headers.get("Strict-Transport-Security")).toBe("max-age=31536000; includeSubDomains");
  });
});

describe("getProductionCsp", () => {
  it("returns a string", () => {
    expect(typeof getProductionCsp()).toBe("string");
  });

  it("contains script-src 'self'", () => {
    expect(getProductionCsp()).toContain("script-src 'self'");
  });

  it("contains style-src with 'unsafe-inline' and Fontshare", () => {
    expect(getProductionCsp()).toContain("style-src 'self' 'unsafe-inline' https://api.fontshare.com");
  });

  it("contains 'unsafe-inline' for inline React styles", () => {
    expect(getProductionCsp()).toContain("'unsafe-inline'");
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
    expect(csp).toContain("frame-ancestors 'none'");
  });
});
