import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderWithProviders, screen, fireEvent, waitFor } from "../test/utils/test-utils";
import { SeriesSidebar } from "./SeriesSidebar";
import { createMockSeries, createMockPreferences } from "../test/utils/mocks";
import * as hooks from "../lib/hooks";

// Mock the hooks module
vi.mock("../lib/hooks", async () => {
  const actual = await vi.importActual("../lib/hooks");
  return {
    ...actual,
    useSeries: vi.fn(),
    usePreferences: vi.fn(),
    useSavePreferences: vi.fn(),
  };
});

describe("SeriesSidebar Component", () => {
  const mockSeries = [
    createMockSeries({ id: "f1", name: "Formula 1", category: "Motorsports" }),
    createMockSeries({ id: "f2", name: "Formula 2", category: "Motorsports" }),
    createMockSeries({ id: "moto", name: "MotoGP", category: "Motorsports" }),
    createMockSeries({ id: "indycar", name: "IndyCar", category: "Racing" }),
  ];

  const mockPrefs = createMockPreferences({
    enabledSeries: JSON.stringify(["f1", "moto"]),
  });

  const mockSavePrefs = {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    hooks.useSeries.mockReturnValue({
      data: mockSeries,
      isLoading: false,
      error: null,
    });
    // @ts-ignore
    hooks.usePreferences.mockReturnValue({
      data: mockPrefs,
      isLoading: false,
      error: null,
    });
    // @ts-ignore
    hooks.useSavePreferences.mockReturnValue(mockSavePrefs);
  });

  it("should render without crashing", () => {
    renderWithProviders(<SeriesSidebar />);
    expect(screen.getByText("Racing Series")).toBeInTheDocument();
  });

  it("should display loading state when series is loading", () => {
    // @ts-ignore
    hooks.useSeries.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    renderWithProviders(<SeriesSidebar />);
    // When loading, series items should not be displayed
    expect(screen.queryByText("Formula 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Formula 2")).not.toBeInTheDocument();
  });

  it("should display loading state when preferences are loading", () => {
    // @ts-ignore
    hooks.usePreferences.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    renderWithProviders(<SeriesSidebar />);
    // When loading, series items should not be displayed
    expect(screen.queryByText("Formula 1")).not.toBeInTheDocument();
    expect(screen.queryByText("Formula 2")).not.toBeInTheDocument();
  });

  it("should group series by category", () => {
    renderWithProviders(<SeriesSidebar />);
    
    expect(screen.getByText("Motorsports")).toBeInTheDocument();
    expect(screen.getByText("Racing")).toBeInTheDocument();
  });

  it("should display all series items", () => {
    renderWithProviders(<SeriesSidebar />);
    
    expect(screen.getByText("Formula 1")).toBeInTheDocument();
    expect(screen.getByText("Formula 2")).toBeInTheDocument();
    expect(screen.getByText("MotoGP")).toBeInTheDocument();
    expect(screen.getByText("IndyCar")).toBeInTheDocument();
  });

  it("should have correct series status in toggles", () => {
    renderWithProviders(<SeriesSidebar />);
    
    const f1Switch = screen.getByTestId("sidebar-switch-f1");
    const f2Switch = screen.getByTestId("sidebar-switch-f2");
    const motoSwitch = screen.getByTestId("sidebar-switch-moto");
    const indycarSwitch = screen.getByTestId("sidebar-switch-indycar");

    // F1 and MotoGP should be enabled
    expect(f1Switch).toHaveAttribute("data-state", "checked");
    expect(motoSwitch).toHaveAttribute("data-state", "checked");
    
    // F2 and IndyCar should be disabled
    expect(f2Switch).toHaveAttribute("data-state", "unchecked");
    expect(indycarSwitch).toHaveAttribute("data-state", "unchecked");
  });

  it("should toggle series when switch is clicked", async () => {
    renderWithProviders(<SeriesSidebar />);
    
    const f2Switch = screen.getByTestId("sidebar-switch-f2");
    fireEvent.click(f2Switch);

    await waitFor(() => {
      expect(mockSavePrefs.mutate).toHaveBeenCalledWith(["f1", "moto", "f2"]);
    });
  });

  it("should remove series from enabled when toggling off", async () => {
    renderWithProviders(<SeriesSidebar />);
    
    const f1Switch = screen.getByTestId("sidebar-switch-f1");
    fireEvent.click(f1Switch);

    await waitFor(() => {
      expect(mockSavePrefs.mutate).toHaveBeenCalledWith(["moto"]);
    });
  });

  it("should render settings button with correct link", () => {
    renderWithProviders(<SeriesSidebar />);
    
    const settingsButton = screen.getByTestId("button-settings-link");
    expect(settingsButton).toBeInTheDocument();
    expect(settingsButton.closest("a")).toHaveAttribute("href", "/settings");
  });

  it("should have correct aria labels for series", () => {
    renderWithProviders(<SeriesSidebar />);
    
    expect(screen.getByTestId("sidebar-series-f1")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-series-f2")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-series-moto")).toBeInTheDocument();
    expect(screen.getByTestId("sidebar-series-indycar")).toBeInTheDocument();
  });

  it("should handle invalid enabledSeries JSON gracefully", () => {
    // @ts-ignore
    hooks.usePreferences.mockReturnValue({
      data: { ...mockPrefs, enabledSeries: "invalid json" },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<SeriesSidebar />);
    
    // Should render without crashing and all switches should be unchecked
    const f1Switch = screen.getByTestId("sidebar-switch-f1");
    expect(f1Switch).toHaveAttribute("data-state", "unchecked");
  });

  it("should handle empty series list", () => {
    // @ts-ignore
    hooks.useSeries.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithProviders(<SeriesSidebar />);
    expect(screen.getByText("Racing Series")).toBeInTheDocument();
  });

  it("should have correct testid for category triggers", () => {
    renderWithProviders(<SeriesSidebar />);
    
    expect(screen.getByTestId("trigger-category-motorsports")).toBeInTheDocument();
    expect(screen.getByTestId("trigger-category-racing")).toBeInTheDocument();
  });

  it("should display series color indicator", () => {
    renderWithProviders(<SeriesSidebar />);
    
    const f1Item = screen.getByTestId("sidebar-series-f1");
    const colorSpan = f1Item.querySelector("span[style]");
    expect(colorSpan).toBeInTheDocument();
    expect(colorSpan).toHaveAttribute("style", expect.stringContaining("background-color"));
  });
});
