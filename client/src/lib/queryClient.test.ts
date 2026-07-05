import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiRequest, getQueryFn, __resetCsrfToken, __setCsrfToken } from "./queryClient";

const fetchMock = vi.fn();
global.fetch = fetchMock;

function mockResponse(overrides: Record<string, unknown> = {}): Response {
  const headers = new Headers();
  const overrideHeaders = overrides.headers as Record<string, string> | undefined;
  if (overrideHeaders) {
    for (const [key, value] of Object.entries(overrideHeaders)) {
      headers.set(key, value);
    }
  }
  const { headers: _ignored, ...rest } = overrides;
  return {
    ok: true,
    status: 200,
    headers,
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(""),
    ...rest,
  } as unknown as Response;
}

describe("queryClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    __resetCsrfToken();
  });

  describe("apiRequest", () => {
    it("makes GET request without body", async () => {
      const mockRes = mockResponse();
      fetchMock.mockResolvedValue(mockRes);

      const result = await apiRequest("GET", "/api/test");

      expect(fetchMock).toHaveBeenCalledWith("./api/test", {
        method: "GET",
        headers: {},
        body: undefined,
      });
      expect(result).toBe(mockRes);
    });

    it("bootstraps CSRF token on first POST and uses cached token thereafter", async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(mockResponse({ headers: { "X-CSRF-Token": "tok1" } })),
      );

      const result = await apiRequest("POST", "/api/test", { key: "value" });

      expect(fetchMock.mock.calls[0][0]).toBe("./api/events?limit=1");
      expect(fetchMock.mock.calls[1][0]).toBe("./api/test");
      expect(fetchMock.mock.calls[1][1]).toMatchObject({
        method: "POST",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": "tok1" },
        body: JSON.stringify({ key: "value" }),
      });
      expect(result).toBeDefined();
    });

    it("uses cached CSRF token without bootstrapping again", async () => {
      __setCsrfToken("cached-token");

      const mockRes = mockResponse();
      fetchMock.mockResolvedValue(mockRes);

      await apiRequest("POST", "/api/test", { key: "value" });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith("./api/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "cached-token",
        },
        body: JSON.stringify({ key: "value" }),
      });
    });

    it("makes POST request without CSRF header when bootstrap returns no token", async () => {
      fetchMock.mockResolvedValue(mockResponse());

      const result = await apiRequest("POST", "/api/test", { key: "value" });

      expect(fetchMock).toHaveBeenCalledWith("./api/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key: "value" }),
      });
      expect(result).toBeDefined();
    });

    it("throws on non-ok response", async () => {
      const mockRes = {
        ok: false,
        status: 404,
        statusText: "Not Found",
        headers: new Headers(),
        text: vi.fn().mockResolvedValue("Not found"),
      };
      fetchMock.mockResolvedValue(mockRes);

      await expect(apiRequest("GET", "/api/test")).rejects.toThrow("404: Not found");
    });

    it("captures CSRF token from response headers on GET", async () => {
      fetchMock.mockImplementation(() =>
        Promise.resolve(mockResponse({ headers: { "X-CSRF-Token": "tok-from-get" } })),
      );

      await apiRequest("GET", "/api/test");

      // Reset mock call count to test that the token was cached from the GET
      fetchMock.mockReset();
      fetchMock.mockImplementation(() => Promise.resolve(mockResponse()));

      await apiRequest("POST", "/api/submit");

      expect(fetchMock).toHaveBeenCalledWith("./api/submit", {
        method: "POST",
        headers: { "X-CSRF-Token": "tok-from-get" },
        body: undefined,
      });
    });
  });

  describe("getQueryFn", () => {
    it("returns JSON on success", async () => {
      const mockRes = {
        ok: true,
        headers: new Headers(),
        json: vi.fn().mockResolvedValue({ data: "test" }),
      };
      fetchMock.mockResolvedValue(mockRes);

      const queryFn = getQueryFn({ on401: "throw" });
      const result = await queryFn({ queryKey: ["api", "test"] });

      expect(fetchMock).toHaveBeenCalledWith(".api/test");
      expect(result).toBeDefined();
      expect(mockRes.json).toHaveBeenCalled();
    });

    it("captures CSRF token from query responses", async () => {
      const mockRes = {
        ok: true,
        headers: new Headers({ "X-CSRF-Token": "query-token" }),
        json: vi.fn().mockResolvedValue({ data: "test" }),
      };
      fetchMock.mockResolvedValue(mockRes);

      const queryFn = getQueryFn({ on401: "throw" });
      await queryFn({ queryKey: ["api", "events"] });

      const postRes = { ok: true, headers: new Headers(), text: vi.fn().mockResolvedValue("") };
      fetchMock.mockResolvedValueOnce(postRes);
      await apiRequest("POST", "/api/preferences");

      expect(fetchMock).toHaveBeenLastCalledWith("./api/preferences", {
        method: "POST",
        headers: { "X-CSRF-Token": "query-token" },
        body: undefined,
      });
    });

    it("returns null on 401 when on401 is returnNull", async () => {
      const mockRes = {
        ok: false,
        status: 401,
        headers: new Headers(),
      };
      fetchMock.mockResolvedValue(mockRes);

      const queryFn = getQueryFn({ on401: "returnNull" });
      const result = await queryFn({ queryKey: ["api", "test"] });

      expect(result).toBeNull();
    });

    it("throws for other error statuses", async () => {
      const mockRes = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        headers: new Headers(),
        text: vi.fn().mockResolvedValue("Server error"),
      };
      fetchMock.mockResolvedValue(mockRes);

      const queryFn = getQueryFn({ on401: "throw" });

      await expect(queryFn({ queryKey: ["api", "test"] })).rejects.toThrow("500: Server error");
    });
  });
});


