import { vi } from "vitest";

// Mock API responses for common endpoints
export const mockApiResponses = {
  events: [
    {
      id: "1",
      title: "Event 1",
      start: "2024-01-15T10:00:00Z",
      end: "2024-01-15T11:00:00Z",
      series: "F1",
    },
    {
      id: "2",
      title: "Event 2",
      start: "2024-01-22T14:00:00Z",
      end: "2024-01-22T15:00:00Z",
      series: "F1",
    },
  ],
  preferences: {
    theme: "light",
    notificationsEnabled: true,
    selectedSeries: ["F1"],
  },
  syncStatus: {
    lastSync: "2024-01-10T12:00:00Z",
    status: "success",
    message: "Sync completed successfully",
  },
};

// Factory function for creating mock series data
export function createMockSeries(overrides = {}) {
  return {
    id: "f1",
    name: "Formula 1",
    color: "#FF0000",
    enabled: true,
    ...overrides,
  };
}

// Factory function for creating mock events
export function createMockEvent(overrides = {}) {
  return {
    id: "evt-1",
    title: "Monaco Grand Prix",
    start: new Date("2024-05-26T14:00:00Z"),
    end: new Date("2024-05-26T16:00:00Z"),
    series: "F1",
    description: "Test event",
    ...overrides,
  };
}

// Factory function for creating mock preferences
export function createMockPreferences(overrides = {}) {
  return {
    theme: "light" as const,
    notificationsEnabled: true,
    selectedSeries: ["f1"],
    autoSync: true,
    syncInterval: 3600,
    ...overrides,
  };
}

// Mock fetch responses
export function mockFetch(responses: Record<string, any>) {
  return vi.fn((url: string) => {
    const matchedUrl = Object.keys(responses).find((key) => url.includes(key));
    if (matchedUrl) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve(responses[matchedUrl]),
        text: () => Promise.resolve(JSON.stringify(responses[matchedUrl])),
      });
    }
    return Promise.reject(new Error(`No mock for ${url}`));
  });
}

// Mock React Query hooks data
export function createMockQueryData<T>(data: T) {
  return {
    data,
    isLoading: false,
    isError: false,
    error: null,
    isFetching: false,
    status: "success" as const,
  };
}

// Mock React Query hooks error
export function createMockQueryError(message = "An error occurred") {
  return {
    data: undefined,
    isLoading: false,
    isError: true,
    error: new Error(message),
    isFetching: false,
    status: "error" as const,
  };
}

// Mock React Query hooks loading state
export function createMockQueryLoading() {
  return {
    data: undefined,
    isLoading: true,
    isError: false,
    error: null,
    isFetching: true,
    status: "pending" as const,
  };
}
