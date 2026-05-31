import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { act, renderWithProviders, screen, waitFor, userEvent } from "../test/utils/test-utils";
import { SyncDialog } from "./SyncDialog";
import { createMockPreferences } from "../test/utils/mocks";
import * as hooks from "../lib/hooks";

// Mock the hooks module
vi.mock("../lib/hooks", async () => {
  const actual = await vi.importActual("../lib/hooks");
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

  it("should copy URL successfully with clipboard API", async () => {
    const user = userEvent.setup();
    
    // Mock clipboard API
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
    });

    renderWithProviders(<SyncDialog />);
    
    const syncButton = screen.getByTestId("button-sync-calendar");
    await user.click(syncButton);

    await waitFor(() => {
      const copyButton = screen.getByTestId("button-copy-url");
      expect(copyButton).toBeInTheDocument();
    });

    const copyButton = screen.getByTestId("button-copy-url");
    await user.click(copyButton);

    // Should call clipboard API
    expect(mockClipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("/api/export.ics?series=f1,f2")
    );

    // Should show check icon
    await waitFor(() => {
      expect(screen.getByTestId("button-copy-url")).toBeInTheDocument();
    });
  });

  it("should fallback to DOM copy when clipboard API fails", async () => {
    const user = userEvent.setup();
    
    // Mock clipboard API to fail
    const mockClipboard = {
      writeText: vi.fn().mockRejectedValue(new Error("Clipboard not supported")),
    };
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
    });

    // Mock document.execCommand
    const mockExecCommand = vi.fn().mockReturnValue(true);
    Object.defineProperty(document, "execCommand", {
      value: mockExecCommand,
      writable: true,
    });

    renderWithProviders(<SyncDialog />);
    
    const syncButton = screen.getByTestId("button-sync-calendar");
    await user.click(syncButton);

    await waitFor(() => {
      const copyButton = screen.getByTestId("button-copy-url");
      expect(copyButton).toBeInTheDocument();
    });

    const copyButton = screen.getByTestId("button-copy-url");
    await user.click(copyButton);

    // Should create and remove input element
    expect(mockExecCommand).toHaveBeenCalledWith("copy");

    // Should show check icon
    await waitFor(() => {
      expect(screen.getByTestId("button-copy-url")).toBeInTheDocument();
    });
  });

  it("should reset copied state after timeout", async () => {
    const user = userEvent.setup();
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");

    // Mock clipboard API
    const mockClipboard = {
      writeText: vi.fn().mockResolvedValue(undefined),
    };
    Object.defineProperty(navigator, "clipboard", {
      value: mockClipboard,
      writable: true,
    });

    renderWithProviders(<SyncDialog />);
    
    const syncButton = screen.getByTestId("button-sync-calendar");
    await user.click(syncButton);

    await waitFor(() => {
      const copyButton = screen.getByTestId("button-copy-url");
      expect(copyButton).toBeInTheDocument();
    });

    const copyButton = screen.getByTestId("button-copy-url");
    await user.click(copyButton);

    // Should call setTimeout for copied reset
    expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 2000);

    // Should show check icon initially
    await waitFor(() => {
      const checkIcon = document.querySelector(".text-green-500");
      expect(checkIcon).toBeInTheDocument();
    });

    // Invoke the component timeout callback directly
    const timeoutCall = setTimeoutSpy.mock.calls.find((call) => call[1] === 2000);
    expect(timeoutCall).toBeDefined();
    const timeoutCallback = timeoutCall?.[0] as () => void;

    await act(() => {
      timeoutCallback();
    });

    // Should reset to copy icon
    await waitFor(() => {
      const checkIcon = document.querySelector(".text-green-500");
      expect(checkIcon).not.toBeInTheDocument();
    });

    setTimeoutSpy.mockRestore();
  });
});

