import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("logger", () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe("writeLog", () => {
    it("logs info messages to console.log", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { info } = await import("./logger");

      info("test info message");

      expect(spy).toHaveBeenCalledOnce();
      const entry = JSON.parse(spy.mock.calls[0][0]);
      expect(entry.level).toBe("info");
      expect(entry.message).toBe("test info message");
      expect(entry.timestamp).toBeDefined();
    });

    it("logs error messages to console.error", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { error } = await import("./logger");

      error(new Error("test error"), "Something failed");

      expect(spy).toHaveBeenCalledOnce();
      const entry = JSON.parse(spy.mock.calls[0][0]);
      expect(entry.level).toBe("error");
      expect(entry.message).toBe("Something failed");
      expect(entry.error).toBeDefined();
      expect(entry.error.message).toBe("test error");
    });

    it("includes metadata in log entry", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { warn } = await import("./logger");

      warn("warning", { requestId: "abc-123", statusCode: 404 });

      const entry = JSON.parse(spy.mock.calls[0][0]);
      expect(entry.requestId).toBe("abc-123");
      expect(entry.statusCode).toBe(404);
    });
  });

  describe("getErrorDetails", () => {
    it("includes stack trace in development", async () => {
      process.env.NODE_ENV = "development";
      vi.resetModules();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { error } = await import("./logger");

      error(new Error("dev error"), "test");

      const entry = JSON.parse(spy.mock.calls[0][0]);
      expect(entry.error.message).toBe("dev error");
      expect(entry.error.stack).toBeDefined();
      expect(typeof entry.error.stack).toBe("string");
    });

    it("excludes stack trace in production", async () => {
      process.env.NODE_ENV = "production";
      vi.resetModules();
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { error } = await import("./logger");

      error(new Error("prod error"), "test");

      const entry = JSON.parse(spy.mock.calls[0][0]);
      expect(entry.error.message).toBe("prod error");
      expect(entry.error.stack).toBeUndefined();
    });

    it("handles non-Error thrown values", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { error } = await import("./logger");

      error("string error", "non-error");

      const entry = JSON.parse(spy.mock.calls[0][0]);
      expect(entry.error.message).toBe("string error");
    });

    it("handles object thrown values", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { error } = await import("./logger");

      error({ code: 500, detail: "bad" }, "object error");

      const entry = JSON.parse(spy.mock.calls[0][0]);
      expect(entry.error.code).toBe(500);
      expect(entry.error.detail).toBe("bad");
    });
  });

  describe("requestComplete", () => {
    it("logs request completion with duration", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { requestComplete } = await import("./logger");

      requestComplete("req-1", 200, 42);

      const entry = JSON.parse(spy.mock.calls[0][0]);
      expect(entry.requestId).toBe("req-1");
      expect(entry.statusCode).toBe(200);
      expect(entry.durationMs).toBe(42);
    });

    it("includes response body when provided", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { requestComplete } = await import("./logger");

      requestComplete("req-2", 500, 100, { error: "timeout" });

      const entry = JSON.parse(spy.mock.calls[0][0]);
      expect(entry.responseBody).toEqual({ error: "timeout" });
    });
  });

  describe("requestStarted", () => {
    it("logs request start with method and path", async () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      const { requestStarted } = await import("./logger");

      requestStarted("req-3", "GET", "/api/series");

      const entry = JSON.parse(spy.mock.calls[0][0]);
      expect(entry.level).toBe("info");
      expect(entry.message).toBe("Request started");
      expect(entry.requestId).toBe("req-3");
      expect(entry.method).toBe("GET");
      expect(entry.path).toBe("/api/series");
    });
  });
});
