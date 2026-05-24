import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderWithProviders, screen, userEvent } from "../test/utils/test-utils";
import { run } from "axe-core";
import { SyncDialog } from "./SyncDialog";
import * as hooks from "../lib/hooks";

// Mock the hooks module used by SyncDialog
vi.mock("../lib/hooks", async () => {
  const actual = await vi.importActual("../lib/hooks");
  return {
    ...actual,
    useSyncEvents: vi.fn(),
    usePreferences: vi.fn(),
  };
});

describe("SyncDialog Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // @ts-ignore
    hooks.useSyncEvents.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
    // @ts-ignore
    hooks.usePreferences.mockReturnValue({
      data: { id: 1, enabledSeries: JSON.stringify(["f1", "motogp"]) },
      isLoading: false,
      error: null,
    });
  });

  it("should have no accessibility violations when closed", async () => {
    const { container } = renderWithProviders(<SyncDialog />);
    const results = await run(container);

    expect(results.violations).toHaveLength(0);
  });

  it("should have no accessibility violations when open", async () => {
    const { container } = renderWithProviders(<SyncDialog />);
    const trigger = screen.getByRole("button", { name: /sync/i });
    await userEvent.click(trigger);

    const results = await run(container);

    expect(results.violations).toHaveLength(0);
  });
});