import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderWithProviders, screen, fireEvent, waitFor } from "../test/utils/test-utils";
import Settings from "./settings";
import { createMockSeries, createMockPreferences } from "../test/utils/mocks";
import * as hooks from "../lib/hooks";

vi.mock("../lib/hooks", async () => {
  const actual = await vi.importActual("../lib/hooks");
  return {
    ...actual,
    useSeries: vi.fn(),
    usePreferences: vi.fn(),
    useSavePreferences: vi.fn(),
  };
});

describe("Settings Page", () => {
  const mockSeries = [
    createMockSeries({
      id: "f1",
      name: "Formula 1",
      shortName: "F1",
      category: "Motorsports",
    }),
    createMockSeries({
      id: "moto",
      name: "MotoGP",
      shortName: "MotoGP",
      category: "Motorsports",
    }),
    createMockSeries({
      id: "indy",
      name: "IndyCar",
      shortName: "Indy",
      category: "Open Wheel",
    }),
  ];

  const mockPrefs = createMockPreferences({
    enabledSeries: JSON.stringify(["f1"]),
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

  it("renders the settings page title and back button", () => {
    renderWithProviders(<Settings />);

    expect(screen.getByTestId("text-settings-title")).toHaveTextContent(
      "Series Configuration"
    );
    expect(screen.getByTestId("button-back")).toBeInTheDocument();
  });

  it("renders series categories and switch controls after loading", () => {
    renderWithProviders(<Settings />);

    expect(screen.getByText("Motorsports")).toBeInTheDocument();
    expect(screen.getByText("Open Wheel")).toBeInTheDocument();
    expect(screen.getByTestId("switch-series-f1")).toHaveAttribute(
      "data-state",
      "checked"
    );
    expect(screen.getByTestId("switch-series-moto")).toHaveAttribute(
      "data-state",
      "unchecked"
    );
    expect(screen.getByTestId("switch-series-indy")).toHaveAttribute(
      "data-state",
      "unchecked"
    );
  });

  it("toggles an individual series and calls mutate with updated values", async () => {
    renderWithProviders(<Settings />);

    fireEvent.click(screen.getByTestId("switch-series-moto"));

    await waitFor(() => {
      expect(mockSavePrefs.mutate).toHaveBeenCalledWith(["f1", "moto"]);
    });
  });

  it("toggles category selection using the Select All button", async () => {
    renderWithProviders(<Settings />);

    fireEvent.click(screen.getByTestId("button-toggle-category-motorsports"));

    await waitFor(() => {
      expect(mockSavePrefs.mutate).toHaveBeenCalledWith(["f1", "moto"]);
    });
  });

  it("shows loading skeletons when series or preferences are loading", () => {
    // @ts-ignore
    hooks.useSeries.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    renderWithProviders(<Settings />);

    expect(screen.queryByText("Motorsports")).not.toBeInTheDocument();
    expect(screen.queryByText("Open Wheel")).not.toBeInTheDocument();
    expect(screen.getByText("Series Configuration")).toBeInTheDocument();
  });

  it("handles invalid preferences JSON gracefully", () => {
    // @ts-ignore
    hooks.usePreferences.mockReturnValue({
      data: { ...mockPrefs, enabledSeries: "invalid json" },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<Settings />);

    expect(screen.getByTestId("switch-series-f1")).toHaveAttribute(
      "data-state",
      "unchecked"
    );
    expect(screen.getByTestId("switch-series-moto")).toBeInTheDocument();
  });
});
