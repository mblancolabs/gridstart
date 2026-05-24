import React from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderWithProviders, screen, waitFor } from "../test/utils/test-utils";
import { Toaster } from "@/components/ui/toaster";
import { PwaUpdatePrompt, PwaInstallButton, captureInstallPrompt, resetInstallPrompt } from "./PwaUpdatePrompt";

const mockUpdateSW = vi.fn();

vi.mock("virtual:pwa-register/react", () => ({
  useRegisterSW: vi.fn(),
}));

import { useRegisterSW } from "virtual:pwa-register/react";

function renderWithToaster(element: React.ReactElement) {
  return renderWithProviders(
    <>
      <Toaster />
      {element}
    </>,
  );
}

describe("captureInstallPrompt", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetInstallPrompt();
  });

  it("should prevent default and store the event", () => {
    const preventDefault = vi.fn();
    const event = new Event("beforeinstallprompt");
    Object.assign(event, { preventDefault, prompt: vi.fn(), userChoice: Promise.resolve({ outcome: "accepted" }) });

    captureInstallPrompt();
    window.dispatchEvent(event);

    expect(preventDefault).toHaveBeenCalled();
  });
});

describe("PwaInstallButton", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    resetInstallPrompt();
  });

  it("should not render when no install prompt is available", () => {
    const { container } = renderWithProviders(<PwaInstallButton />);
    expect(container.textContent).toBe("");
  });

  it("should render when beforeinstallprompt fires", async () => {
    renderWithProviders(<PwaInstallButton />);

    const event = new Event("beforeinstallprompt");
    Object.assign(event, { preventDefault: vi.fn(), prompt: vi.fn(), userChoice: Promise.resolve({ outcome: "dismissed" }) });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /install app/i })).toBeInTheDocument();
    });
  });

  it("should call prompt when clicked", async () => {
    const promptFn = vi.fn();
    const userChoice = Promise.resolve({ outcome: "accepted" });

    renderWithProviders(<PwaInstallButton />);

    const event = new Event("beforeinstallprompt");
    Object.assign(event, { preventDefault: vi.fn(), prompt: promptFn, userChoice });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /install app/i })).toBeInTheDocument();
    });

    screen.getByRole("button", { name: /install app/i }).click();
    expect(promptFn).toHaveBeenCalled();
  });

  it("should hide button after user accepts", async () => {
    const userChoice = Promise.resolve({ outcome: "accepted" });

    renderWithProviders(<PwaInstallButton />);

    const event = new Event("beforeinstallprompt");
    Object.assign(event, { preventDefault: vi.fn(), prompt: vi.fn(), userChoice });
    window.dispatchEvent(event);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /install app/i })).toBeInTheDocument();
    });

    screen.getByRole("button", { name: /install app/i }).click();

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /install app/i })).not.toBeInTheDocument();
    });
  });
});

describe("PwaUpdatePrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetInstallPrompt();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should not show toast when no update is available", () => {
    vi.mocked(useRegisterSW).mockReturnValue({
      needRefresh: [false, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: mockUpdateSW,
    });

    const { container } = renderWithToaster(<PwaUpdatePrompt />);
    expect(container.textContent).toBe("");
    expect(screen.queryByText("Update available")).not.toBeInTheDocument();
  });

  it("should show toast when update is available", () => {
    vi.mocked(useRegisterSW).mockReturnValue({
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: mockUpdateSW,
    });

    renderWithToaster(<PwaUpdatePrompt />);
    expect(screen.getByText("Update available")).toBeInTheDocument();
    expect(
      screen.getByText("A new version of GridStart is ready."),
    ).toBeInTheDocument();
  });

  it("should call updateServiceWorker when update button is clicked", async () => {
    vi.mocked(useRegisterSW).mockReturnValue({
      needRefresh: [true, vi.fn()],
      offlineReady: [false, vi.fn()],
      updateServiceWorker: mockUpdateSW,
    });

    renderWithToaster(<PwaUpdatePrompt />);

    const updateButton = screen.getByRole("button", { name: "Update" });
    updateButton.click();

    expect(mockUpdateSW).toHaveBeenCalledWith(true);
  });
});
