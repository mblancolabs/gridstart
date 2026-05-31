import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderWithProviders } from "../test/utils/test-utils";
import { run } from "axe-core";
import { SeriesSidebar } from "./SeriesSidebar";
import { createMockSeries, createMockPreferences } from "../test/utils/mocks";
import * as hooks from "../lib/hooks";

// Mock the hooks module used by SeriesSidebar
vi.mock("../lib/hooks", async () => {
  const actual = await vi.importActual("../lib/hooks");
  return {
    ...actual,
    useSeries: vi.fn(),
    usePreferences: vi.fn(),
    useSavePreferences: vi.fn(),
  };
});

describe("SeriesSidebar Accessibility", () => {
  const mockSeries = [
    createMockSeries({ id: "f1", name: "Formula 1", category: "Motorsports" }),
    createMockSeries({ id: "f2", name: "Formula 2", category: "Motorsports" }),
    createMockSeries({ id: "moto", name: "MotoGP", category: "Motorsports" }),
    createMockSeries({ id: "indycar", name: "IndyCar", category: "Racing" }),
  ];

  const mockPrefs = createMockPreferences({
    enabledSeries: JSON.stringify(["f1", "moto"]),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-expect-error
    hooks.useSeries.mockReturnValue({
      data: mockSeries,
      isLoading: false,
      error: null,
    });
    // @ts-expect-error
    hooks.usePreferences.mockReturnValue({
      data: mockPrefs,
      isLoading: false,
      error: null,
    });
    // @ts-expect-error
    hooks.useSavePreferences.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
  });

  it("should have no accessibility violations", async () => {
    const { container } = renderWithProviders(<SeriesSidebar />);
    const results = await run(container);

    expect(results.violations).toHaveLength(0);
  });
});
