import { describe, it, expect, vi, beforeEach } from "vitest";
import { apiRequest, getQueryFn } from "./queryClient";

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("queryClient", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset document.cookie mock
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
  });

  describe("apiRequest", () => {
    it("makes GET request without body", async () => {
      const mockResponse = { ok: true };
      fetchMock.mockResolvedValue(mockResponse);

      const result = await apiRequest("GET", "/api/test");

      expect(fetchMock).toHaveBeenCalledWith("./api/test", {
        method: "GET",
        headers: {},
        body: undefined,
      });
      expect(result).toBe(mockResponse);
    });

    it("makes POST request with JSON body and CSRF header when token exists", async () => {
      // Mock document.cookie to contain CSRF token
      Object.defineProperty(document, "cookie", {
        writable: true,
        value: "csrf-token=abc123",
      });

      const mockResponse = { ok: true };
      fetchMock.mockResolvedValue(mockResponse);

      const result = await apiRequest("POST", "/api/test", { key: "value" });

      expect(fetchMock).toHaveBeenCalledWith("./api/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": "abc123",
        },
        body: JSON.stringify({ key: "value" }),
      });
      expect(result).toBe(mockResponse);
    });

    it("makes POST request without CSRF header when no token", async () => {
      const mockResponse = { ok: true };
      fetchMock.mockResolvedValue(mockResponse);

      const result = await apiRequest("POST", "/api/test", { key: "value" });

      expect(fetchMock).toHaveBeenCalledWith("./api/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ key: "value" }),
      });
      expect(result).toBe(mockResponse);
    });

    it("throws on non-ok response", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: "Not Found",
        text: vi.fn().mockResolvedValue("Not found"),
      };
      fetchMock.mockResolvedValue(mockResponse);

      await expect(apiRequest("GET", "/api/test")).rejects.toThrow("404: Not found");
    });
  });

  describe("getQueryFn", () => {
    it("returns JSON on success", async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ data: "test" }),
      };
      fetchMock.mockResolvedValue(mockResponse);

      const queryFn = getQueryFn({ on401: "throw" });
      const result = await queryFn({ queryKey: ["api", "test"] });

      expect(fetchMock).toHaveBeenCalledWith(".api/test");
      expect(result).toBeDefined();
      expect(mockResponse.json).toHaveBeenCalled();
    });

    it("returns null on 401 when on401 is returnNull", async () => {
      const mockResponse = {
        ok: false,
        status: 401,
      };
      fetchMock.mockResolvedValue(mockResponse);

      const queryFn = getQueryFn({ on401: "returnNull" });
      const result = await queryFn({ queryKey: ["api", "test"] });

      expect(result).toBeNull();
    });

    it("throws for other error statuses", async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: vi.fn().mockResolvedValue("Server error"),
      };
      fetchMock.mockResolvedValue(mockResponse);

      const queryFn = getQueryFn({ on401: "throw" });

      await expect(queryFn({ queryKey: ["api", "test"] })).rejects.toThrow("500: Server error");
    });
  });
});