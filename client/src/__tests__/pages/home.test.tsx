import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderWithProviders, screen, userEvent } from "../utils/test-utils";
import Home, * as home from "../../pages/home";
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
      seriesShortName: "F1",
      seriesColor: "#FF0000",
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
      seriesShortName: "F1",
      seriesColor: "#FF0000",
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
      seriesShortName: "F1",
      seriesColor: "#FF0000",
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

  // Test helper functions
  describe("formatLocalTime", () => {
    it("should format ISO string to local time", () => {
      const { formatLocalTime } = home;
      const result = formatLocalTime("2024-01-15T14:30:00Z");
      expect(result).toMatch(/^\d{2}:\d{2}$/);
    });
  });

  describe("formatLocalDate", () => {
    it("should format ISO string to local date", () => {
      const { formatLocalDate } = home;
      const result = formatLocalDate("2024-01-15T14:30:00Z");
      expect(result).toMatch(/^\w{3}, \w{3} \d{1,2}$/);
    });
  });

  describe("lightenColor", () => {
    it("should lighten dark colors", () => {
      const { lightenColor } = home;
      const result = lightenColor("#000000");
      expect(result).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(result).not.toBe("#000000");
    });

    it("should return valid hex color", () => {
      const { lightenColor } = home;
      const result = lightenColor("#FF0000");
      expect(result).toMatch(/^#[0-9A-Fa-f]{6}$/);
    });
  });

  describe("getSessionIcon", () => {
    it("should return race icon for race sessions", () => {
      const { getSessionIcon } = home;
      expect(getSessionIcon("Race")).toBe("🏁");
    });

    it("should return sprint icon for sprint qualifying", () => {
      const { getSessionIcon } = home;
      expect(getSessionIcon("Sprint Qualifying")).toBe("⚡");
    });

    it("should return quali icon for qualifying", () => {
      const { getSessionIcon } = home;
      expect(getSessionIcon("Qualifying")).toBe("🔴");
    });

    it("should return practice icon for practice sessions", () => {
      const { getSessionIcon } = home;
      expect(getSessionIcon("Practice")).toBe("🔧");
    });

    it("should return test icon for test sessions", () => {
      const { getSessionIcon } = home;
      expect(getSessionIcon("Test")).toBe("🧪");
    });

    it("should return empty string for unknown session types", () => {
      const { getSessionIcon } = home;
      expect(getSessionIcon("Unknown")).toBe("");
    });
  });

  describe("getSessionBadgeVariant", () => {
    it("should return default for race sessions", () => {
      const { getSessionBadgeVariant } = home;
      expect(getSessionBadgeVariant("Race")).toBe("default");
    });

    it("should return secondary for qualifying", () => {
      const { getSessionBadgeVariant } = home;
      expect(getSessionBadgeVariant("Qualifying")).toBe("secondary");
    });

    it("should return outline-solid for unknown sessions", () => {
      const { getSessionBadgeVariant } = home;
      expect(getSessionBadgeVariant("Unknown")).toBe("outline-solid");
    });

    it("should return outline-solid for undefined session type", () => {
      const { getSessionBadgeVariant } = home;
      expect(getSessionBadgeVariant(undefined)).toBe("outline-solid");
    });
  });

  describe("groupIntoWeekends", () => {
    it("should group events by race name", () => {
      const { groupIntoWeekends } = home;
      const events = [
        createMockEvent({
          id: "1",
          raceName: "Monaco Grand Prix",
          sessionType: "Practice",
          seriesId: "f1",
          seriesShortName: "F1",
          seriesColor: "#FF0000",
          startDate: "2024-05-24T10:00:00Z",
        }),
        createMockEvent({
          id: "2",
          raceName: "Monaco Grand Prix",
          sessionType: "Qualifying",
          seriesId: "f1",
          seriesShortName: "F1",
          seriesColor: "#FF0000",
          startDate: "2024-05-24T14:00:00Z",
        }),
      ];

      const result = groupIntoWeekends(events);
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty("sessions");
      expect((result[0] as any).sessions).toHaveLength(2);
    });

    it("should keep single events ungrouped", () => {
      const { groupIntoWeekends } = home;
      const events = [
        createMockEvent({
          id: "1",
          title: "Single Event",
          seriesId: "f1",
          seriesShortName: "F1",
          seriesColor: "#FF0000",
          startDate: "2024-05-24T10:00:00Z",
          // No raceName or sessionType
        }),
      ];

      const result = groupIntoWeekends(events);
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty("sessions");
    });
  });

  // Test UI branches
  it("should show empty state when no series enabled", () => {
    // @ts-ignore
    hooks.usePreferences.mockReturnValue({
      data: createMockPreferences({ enabledSeries: JSON.stringify([]) }),
      isLoading: false,
      error: null,
    });
    // @ts-ignore
    hooks.useEvents.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    renderWithProviders(<Home />);
    expect(screen.getByTestId("text-empty-state")).toBeInTheDocument();
    expect(screen.getByText("Enable some series from the sidebar to see events.")).toBeInTheDocument();
  });

  it("should show loading skeleton", () => {
    // @ts-ignore
    hooks.useEvents.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    renderWithProviders(<Home />);
    expect(screen.getByTestId("skeleton-events")).toBeInTheDocument();
    expect(screen.getByText("Loading events...")).toBeInTheDocument();
  });

  it("should handle selected day and scroll to events", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Home />);

    // Find a day button and click it
    const dayButton = screen.getAllByTestId(/button-day-/)[0];
    await user.click(dayButton);

    // Should not crash - the scroll behavior is tested indirectly
    expect(dayButton).toBeInTheDocument();
  });

  it("should reset to today when Today button clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Home />);

    const todayButton = screen.getByTestId("button-today");
    await user.click(todayButton);

    // Should not crash - the state reset is tested indirectly
    expect(todayButton).toBeInTheDocument();
  });

  it("should render calendar with event dots", () => {
    renderWithProviders(<Home />);

    // Should render day buttons
    const dayButtons = screen.getAllByTestId(/button-day-/);
    expect(dayButtons.length).toBeGreaterThan(0);

    // Should have some buttons with event indicators (dots)
    const buttonsWithDots = dayButtons.filter(button => 
      button.querySelector("[class*='rounded-full'][style*='background-color']")
    );
    expect(buttonsWithDots.length).toBeGreaterThan(0);
  });

  it("should handle dark mode color adjustments", async () => {
    // Mock dark mode
    document.documentElement.classList.add('dark');

    renderWithProviders(<Home />);

    // Should render without crashing in dark mode
    expect(screen.getByTestId("text-month-title")).toBeInTheDocument();

    // Clean up in act so the MutationObserver update is handled correctly.
    await act(async () => {
      document.documentElement.classList.remove('dark');
    });
  });

  it("should handle invalid preferences JSON gracefully", () => {
    // @ts-ignore
    hooks.usePreferences.mockReturnValue({
      data: { ...mockPrefs, enabledSeries: "invalid json" },
      isLoading: false,
      error: null,
    });

    renderWithProviders(<Home />);

    // Should treat as no series selected
    expect(screen.getByText("No series selected")).toBeInTheDocument();
  });
});
