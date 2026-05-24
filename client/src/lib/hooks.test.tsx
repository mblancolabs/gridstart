import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSeries, usePreferences, useSavePreferences, useEvents } from "./hooks";

const { mockApiRequest, mockInvalidateQueries, mockGetCookie, mockSetCookie } = vi.hoisted(
  () => ({
    mockApiRequest: vi.fn(),
    mockInvalidateQueries: vi.fn(),
    mockGetCookie: vi.fn(),
    mockSetCookie: vi.fn(),
  })
);

vi.mock("./queryClient", () => ({
  apiRequest: mockApiRequest,
  queryClient: {
    invalidateQueries: mockInvalidateQueries,
  },
}));

vi.mock("./preferencesCookie", () => ({
  getEnabledSeriesFromCookie: mockGetCookie,
  setEnabledSeriesCookie: mockSetCookie,
}));

const fetchMock = vi.fn();
global.fetch = fetchMock;

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        queryFn: async ({ queryKey }) => {
          const path = queryKey.join("/").replace(/\/\/+/g, "/");
          const res = await fetch(`.${path}`);
          if (!res.ok) {
            const text = await res.text();
            throw new Error(`${res.status}: ${text}`);
          }
          return res.json();
        },
      },
      mutations: { retry: false },
    },
  });
}

function createWrapper(queryClient?: QueryClient) {
  const qc = queryClient ?? createQueryClient();
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

describe("hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useSeries", () => {
    it("fetches series from API", async () => {
      const seriesData = [{ id: "f1", name: "Formula 1" }];
      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(seriesData),
      });

      const { result } = renderHook(() => useSeries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(seriesData);
      expect(fetchMock).toHaveBeenCalledWith("./api/series");
    });

    it("handles fetch error", async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: "Server Error",
        text: vi.fn().mockResolvedValue("Server error"),
      });

      const { result } = renderHook(() => useSeries(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("usePreferences", () => {
    it("reads enabled series from cookie", async () => {
      mockGetCookie.mockReturnValue(["f1", "motogp"]);

      const { result } = renderHook(() => usePreferences(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({
        id: 0,
        enabledSeries: JSON.stringify(["f1", "motogp"]),
      });
    });

    it("returns empty array when cookie returns null", async () => {
      mockGetCookie.mockReturnValue(null);

      const { result } = renderHook(() => usePreferences(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({
        id: 0,
        enabledSeries: JSON.stringify([]),
      });
    });

    it("returns empty array when cookie returns empty array", async () => {
      mockGetCookie.mockReturnValue([]);

      const { result } = renderHook(() => usePreferences(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual({
        id: 0,
        enabledSeries: JSON.stringify([]),
      });
    });
  });

  describe("useEvents", () => {
    it("fetches events for given series and date range", async () => {
      const eventsData = [{ id: "1", title: "Bahrain GP" }];
      mockApiRequest.mockResolvedValue({
        json: vi.fn().mockResolvedValue(eventsData),
      });

      const { result } = renderHook(
        () => useEvents(["f1", "motogp"], "2024-01-01", "2024-01-31"),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(eventsData);
      expect(mockApiRequest).toHaveBeenCalledWith(
        "GET",
        "/api/events?series=f1,motogp&from=2024-01-01&to=2024-01-31"
      );
    });

    it("returns empty array when seriesIds is empty", () => {
      const { result } = renderHook(
        () => useEvents([], "2024-01-01", "2024-01-31"),
        { wrapper: createWrapper() }
      );

      expect(result.current.data).toEqual([]);
      expect(mockApiRequest).not.toHaveBeenCalled();
    });

    it("handles API error gracefully", async () => {
      mockApiRequest.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(
        () => useEvents(["f1"], "2024-01-01", "2024-01-31"),
        { wrapper: createWrapper() }
      );

      await waitFor(() => expect(result.current.isError).toBe(true));
    });
  });

  describe("useSavePreferences", () => {
    it("writes cookie with correct series", async () => {
      const { result } = renderHook(() => useSavePreferences(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync(["f1", "motogp"]);

      expect(mockSetCookie).toHaveBeenCalledWith(["f1", "motogp"]);
    });

    it("invalidates preferences and events on success", async () => {
      const { result } = renderHook(() => useSavePreferences(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync(["f1"]);

      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["/api/preferences"],
      });
      expect(mockInvalidateQueries).toHaveBeenCalledWith({
        queryKey: ["/api/events"],
      });
    });

    it("handles empty series list", async () => {
      const { result } = renderHook(() => useSavePreferences(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync([]);

      expect(mockSetCookie).toHaveBeenCalledWith([]);
    });
  });
});
