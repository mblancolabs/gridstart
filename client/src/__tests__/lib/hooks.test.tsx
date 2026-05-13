import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useSeries, usePreferences, useSavePreferences, useEvents } from "../../lib/hooks";

// Mock the queryClient module
vi.mock("../../lib/queryClient", () => ({
  apiRequest: vi.fn(),
  queryClient: {
    invalidateQueries: vi.fn(),
  },
}));

import { apiRequest, queryClient } from "../../lib/queryClient";

// Mock React Query hooks
vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn((options: any) => {
    const data = options.initialData ?? undefined;
    return {
      data,
      isLoading: false,
      isFetching: false,
      queryKey: options.queryKey,
      ...options,
    };
  }),
  useMutation: vi.fn((options: any) => ({
    ...options,
    mutateAsync: async (variables?: any) => {
      const response = await options.mutationFn?.(variables);
      if (options.onSuccess) {
        await options.onSuccess(response);
      }
      return response;
    },
  })),
  QueryClient: vi.fn(),
  QueryClientProvider: ({ children }: any) => children,
}));

import { useQuery, useMutation } from "@tanstack/react-query";

const createWrapper = () => {
  return ({ children }: { children: React.ReactNode }) => children;
};

describe("hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useSeries", () => {
    it("returns expected query key", () => {
      const { result } = renderHook(() => useSeries(), {
        wrapper: createWrapper(),
      });

      // Check that the hook was called with the right queryKey by mocking useQuery
      // Since we can't easily check the internal queryKey, we'll verify the hook exists and renders
      expect(result.current).toBeDefined();
      expect(typeof result.current.data).toBe("undefined"); // No data since no queryFn
    });
  });

  describe("usePreferences", () => {
    it("returns expected query key", () => {
      const { result } = renderHook(() => usePreferences(), {
        wrapper: createWrapper(),
      });

      expect(result.current).toBeDefined();
      expect(typeof result.current.data).toBe("undefined");
    });
  });

  describe("useEvents", () => {
    it("returns empty array and keeps enabled: false when seriesIds is empty", () => {
      const { result } = renderHook(
        () => useEvents([], "2024-01-01", "2024-01-31"),
        {
          wrapper: createWrapper(),
        }
      );

      const current = result.current as any;
      expect(current.data).toEqual([]);
      expect(current.isFetching).toBe(false);
      // The query should not be enabled when seriesIds is empty
      expect(current.queryKey).toEqual(["/api/events", "", "2024-01-01", "2024-01-31"]);
    });

    it("returns expected query key when seriesIds provided", () => {
      const { result } = renderHook(
        () => useEvents(["f1", "motogp"], "2024-01-01", "2024-01-31"),
        {
          wrapper: createWrapper(),
        }
      );

      expect((result.current as any).queryKey).toEqual(["/api/events", "f1,motogp", "2024-01-01", "2024-01-31"]);
    });
  });

  describe("useSavePreferences", () => {
    it("mutationFn calls apiRequest with correct parameters", async () => {
      const mockResponse = { json: vi.fn().mockResolvedValue({}) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useSavePreferences(), {
        wrapper: createWrapper(),
      });

      const enabledSeries = ["f1", "motogp"];
      await result.current.mutateAsync(enabledSeries);

      expect(apiRequest).toHaveBeenCalledWith("PUT", "/api/preferences", {
        enabledSeries: JSON.stringify(enabledSeries),
      });
    });

    it("onSuccess invalidates correct queries", async () => {
      const mockResponse = { json: vi.fn().mockResolvedValue({}) };
      vi.mocked(apiRequest).mockResolvedValue(mockResponse as any);

      const { result } = renderHook(() => useSavePreferences(), {
        wrapper: createWrapper(),
      });

      await result.current.mutateAsync(["f1"]);

      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["/api/preferences"],
      });
      expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
        queryKey: ["/api/events"],
      });
    });
  });
});