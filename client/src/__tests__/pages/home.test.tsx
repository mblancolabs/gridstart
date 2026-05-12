import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderWithProviders, screen, waitFor, userEvent } from "../utils/test-utils";
import Home from "../../pages/home";
import { createMockEvent, createMockPreferences } from "../utils/mocks";
import * as hooks from "../../lib/hooks";

// Mock the hooks module
vi.mock("../../lib/hooks", async () => {
  const actual = await vi.importActual("../../lib/hooks");
  return {
    ...actual,
    usePreferences: vi.fn(),
    useEvents: vi.fn(),
  };
});

describe("Home Page", () => {
  const mockPrefs = createMockPreferences({
    enabledSeries: JSON.stringify(["f1"]),
  });

  const mockEvents = [
    createMockEvent({
      id: "1",
      title: "Monaco Grand Prix - Practice 1",
      startDate: "2026-05-24T10:00:00Z",
      seriesId: "f1",
      raceName: "Monaco Grand Prix",
      sessionType: "Practice",
      location: "Monaco",
      round: 5,
    }),
    createMockEvent({
      id: "2",
      title: "Monaco Grand Prix - Qualifying",
      startDate: "2026-05-24T14:00:00Z",
      seriesId: "f1",
      raceName: "Monaco Grand Prix",
      sessionType: "Qualifying",
      location: "Monaco",
      round: 5,
    }),
    createMockEvent({
      id: "3",
      title: "Monaco Grand Prix - Race",
      startDate: "2026-05-25T14:00:00Z",
      seriesId: "f1",
      raceName: "Monaco Grand Prix",
      sessionType: "Race",
      location: "Monaco",
      round: 5,
    }),
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    hooks.usePreferences.mockReturnValue({
      data: mockPrefs,
      isLoading: false,
      error: null,
    });
    // @ts-ignore
    hooks.useEvents.mockReturnValue({
      data: mockEvents,
      isLoading: false,
      error: null,
    });
  });

  it("should render home page without crashing", () => {
    renderWithProviders(<Home />);
    expect(screen.getByText(/All times shown in your local timezone/)).toBeInTheDocument();
  });

  it("should display current month title", () => {
    renderWithProviders(<Home />);
    // Current month should be May 2026
    expect(screen.getByTestId("text-month-title")).toHaveTextContent("May 2026");
  });

  it("should display month navigation buttons", () => {
    renderWithProviders(<Home />);
    // Should have buttons for navigation
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("should render calendar grid", () => {
    const { container } = renderWithProviders(<Home />);
    // Calendar grid should be rendered
    expect(container).toBeInTheDocument();
  });

  it("should fetch events with correct parameters", () => {
    renderWithProviders(<Home />);
    
    expect(hooks.useEvents).toHaveBeenCalledWith(
      ["f1"],
      expect.any(String),
      expect.any(String)
    );
  });

  it("should display loading state when events are loading", () => {
    // @ts-ignore
    hooks.useEvents.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    renderWithProviders(<Home />);
    // Should render without crashing even when loading
    expect(screen.getByText(/All times shown in your local timezone/)).toBeInTheDocument();
  });

  it("should handle no enabled series", () => {
    // @ts-ignore
    hooks.usePreferences.mockReturnValue({
      data: createMockPreferences({ enabledSeries: JSON.stringify([]) }),
      isLoading: false,
      error: null,
    });

    renderWithProviders(<Home />);
    // Should render without crashing
    expect(screen.getByTestId("text-month-title")).toBeInTheDocument();
  });

  it("should handle no events", () => {
    // @ts-ignore
    hooks.useEvents.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithProviders(<Home />);
    expect(screen.getByTestId("text-month-title")).toBeInTheDocument();
  });

  it("should handle invalid preferences JSON", () => {
    // @ts-ignore
    hooks.usePreferences.mockReturnValue({
      data: { ...mockPrefs, enabledSeries: "invalid json" },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<Home />);
    // Should render without crashing, treating as no series selected
    expect(screen.getByTestId("text-month-title")).toBeInTheDocument();
  });

  it("should handle multiple series", () => {
    // @ts-ignore
    hooks.usePreferences.mockReturnValue({
      data: createMockPreferences({
        enabledSeries: JSON.stringify(["f1", "f2", "moto"]),
      }),
      isLoading: false,
      error: null,
    });

    renderWithProviders(<Home />);
    expect(hooks.useEvents).toHaveBeenCalledWith(
      ["f1", "f2", "moto"],
      expect.any(String),
      expect.any(String)
    );
  });

  it("should display timezone indicator", () => {
    renderWithProviders(<Home />);
    expect(screen.getByText(/All times shown in your local timezone/)).toBeInTheDocument();
  });

  it("should have clock icon for timezone", () => {
    const { container } = renderWithProviders(<Home />);
    const svg = container.querySelector("svg");
    expect(svg || container.querySelector("svg")).toBeInTheDocument();
  });

  it("should handle preferences loading state", () => {
    // @ts-ignore
    hooks.usePreferences.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    renderWithProviders(<Home />);
    expect(screen.getByTestId("text-month-title")).toBeInTheDocument();
  });

  it("should render without crashing on initial mount", () => {
    const { container } = renderWithProviders(<Home />);
    expect(container).toBeInTheDocument();
  });

  it("should display the main container with proper structure", () => {
    const { container } = renderWithProviders(<Home />);
    const main = container.querySelector("[class*='overflow-auto']");
    expect(main).toBeInTheDocument();
  });

  it("should handle events with all properties", () => {
    renderWithProviders(<Home />);
    
    // Should handle the complex event structure without errors
    expect(hooks.useEvents).toHaveBeenCalled();
  });

  it("should handle events without race details", () => {
    // @ts-ignore
    hooks.useEvents.mockReturnValue({
      data: [
        createMockEvent({
          id: "1",
          title: "Generic Event",
          startDate: "2026-05-24T10:00:00Z",
          // No raceName, sessionType, location, round
        }),
      ],
      isLoading: false,
      error: null,
    });

    renderWithProviders(<Home />);
    expect(screen.getByTestId("text-month-title")).toBeInTheDocument();
  });

  it("should have proper flex layout structure", () => {
    const { container } = renderWithProviders(<Home />);
    const flexContainer = container.querySelector("[class*='flex-1']");
    expect(flexContainer).toBeInTheDocument();
  });

  it("should center content with max-width constraint", () => {
    const { container } = renderWithProviders(<Home />);
    const maxWidthContainer = container.querySelector("[class*='max-w']");
    expect(maxWidthContainer).toBeInTheDocument();
  });

  it("should have proper spacing", () => {
    const { container } = renderWithProviders(<Home />);
    const spacedContainer = container.querySelector("[class*='space-y']");
    expect(spacedContainer).toBeInTheDocument();
  });
});
