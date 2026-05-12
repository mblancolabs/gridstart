import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderWithProviders, screen, fireEvent, waitFor, userEvent } from "../utils/test-utils";
import { SyncDialog } from "../../components/SyncDialog";
import { createMockPreferences } from "../utils/mocks";
import * as hooks from "../../lib/hooks";

// Mock the hooks module
vi.mock("../../lib/hooks", async () => {
  const actual = await vi.importActual("../../lib/hooks");
  return {
    ...actual,
    usePreferences: vi.fn(),
  };
});

describe("SyncDialog Component", () => {
  const mockPrefs = createMockPreferences({
    enabledSeries: JSON.stringify(["f1", "f2"]),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    hooks.usePreferences.mockReturnValue({
      data: mockPrefs,
      isLoading: false,
      error: null,
    });

    // Mock window.location.origin
    Object.defineProperty(window, "location", {
      value: {
        origin: "http://localhost:5173",
      },
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should render sync button", () => {
    renderWithProviders(<SyncDialog />);
    expect(screen.getByTestId("button-sync-calendar")).toBeInTheDocument();
  });

  it("should open dialog when sync button is clicked", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SyncDialog />);
    
    const syncButton = screen.getByTestId("button-sync-calendar");
    await user.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText("Sync with Calendar")).toBeInTheDocument();
    });
  });

  it("should display subscription URL with correct series", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SyncDialog />);
    
    const syncButton = screen.getByTestId("button-sync-calendar");
    await user.click(syncButton);

    await waitFor(() => {
      const urlElement = screen.getByTestId("text-subscription-url");
      expect(urlElement.textContent).toContain("f1,f2");
    });
  });

  it("should have copy button in dialog", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SyncDialog />);
    
    const syncButton = screen.getByTestId("button-sync-calendar");
    await user.click(syncButton);

    await waitFor(() => {
      const copyButton = screen.getByTestId("button-copy-url");
      expect(copyButton).toBeInTheDocument();
    });
  });

  it("should display Google Calendar link", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SyncDialog />);
    
    const syncButton = screen.getByTestId("button-sync-calendar");
    await user.click(syncButton);

    await waitFor(() => {
      const googleLink = screen.getByTestId("link-google-calendar");
      expect(googleLink).toBeInTheDocument();
      expect(googleLink).toHaveAttribute("href", expect.stringContaining("calendar.google.com"));
    });
  });

  it("should open Google Calendar link in new tab", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SyncDialog />);
    
    const syncButton = screen.getByTestId("button-sync-calendar");
    await user.click(syncButton);

    await waitFor(() => {
      const googleLink = screen.getByTestId("link-google-calendar");
      expect(googleLink).toHaveAttribute("target", "_blank");
      expect(googleLink).toHaveAttribute("rel", "noopener noreferrer");
    });
  });

  it("should display subscription instructions", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SyncDialog />);
    
    const syncButton = screen.getByTestId("button-sync-calendar");
    await user.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText(/Apple Calendar:/)).toBeInTheDocument();
      expect(screen.getByText(/Google Calendar:/)).toBeInTheDocument();
      expect(screen.getByText(/Outlook:/)).toBeInTheDocument();
    });
  });

  it("should handle empty series list", async () => {
    // @ts-ignore
    hooks.usePreferences.mockReturnValue({
      data: createMockPreferences({ enabledSeries: JSON.stringify([]) }),
      isLoading: false,
      error: null,
    });

    const user = userEvent.setup();
    renderWithProviders(<SyncDialog />);
    
    const syncButton = screen.getByTestId("button-sync-calendar");
    await user.click(syncButton);

    await waitFor(() => {
      const urlElement = screen.getByTestId("text-subscription-url");
      expect(urlElement).toBeInTheDocument();
    });
  });

  it("should display dialog description", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SyncDialog />);
    
    const syncButton = screen.getByTestId("button-sync-calendar");
    await user.click(syncButton);

    await waitFor(() => {
      expect(
        screen.getByText(/Subscribe to your selected series in your preferred calendar app/)
      ).toBeInTheDocument();
    });
  });

  it("should have proper dialog header", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SyncDialog />);
    
    const syncButton = screen.getByTestId("button-sync-calendar");
    await user.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText("Sync with Calendar")).toBeInTheDocument();
      expect(screen.getByText("Subscription URL")).toBeInTheDocument();
    });
  });

  it("should display quick subscribe label", async () => {
    const user = userEvent.setup();
    renderWithProviders(<SyncDialog />);
    
    const syncButton = screen.getByTestId("button-sync-calendar");
    await user.click(syncButton);

    await waitFor(() => {
      expect(screen.getByText("Quick Subscribe")).toBeInTheDocument();
      expect(screen.getByText("Open in Google Calendar")).toBeInTheDocument();
    });
  });
});
