import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToast, toast } from "../../hooks/use-toast";

describe("useToast Hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it("should add a toast and expose it via the hook state", () => {
    const { result, unmount } = renderHook(() => useToast());

    act(() => {
      toast({ title: "Hello Toast", description: "Toast description" });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].title).toBe("Hello Toast");
    expect(result.current.toasts[0].description).toBe("Toast description");
    expect(result.current.toasts[0].open).toBe(true);

    unmount();
  });

  it("should update an existing toast through the returned update function", () => {
    const { result, unmount } = renderHook(() => useToast());
    let toastApi: ReturnType<typeof toast>;

    act(() => {
      toastApi = toast({ title: "Original" });
    });

    expect(result.current.toasts[0].title).toBe("Original");

    act(() => {
      toastApi.update({ title: "Updated" });
    });

    expect(result.current.toasts[0].title).toBe("Updated");

    unmount();
  });

  it("should dismiss a toast and remove it after the timeout", () => {
    const { result, unmount } = renderHook(() => useToast());
    let toastApi: ReturnType<typeof toast>;

    act(() => {
      toastApi = toast({ title: "Dismissible" });
    });

    expect(result.current.toasts[0].open).toBe(true);

    act(() => {
      result.current.dismiss(toastApi.id);
    });

    expect(result.current.toasts[0].open).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1000000);
    });

    expect(result.current.toasts).toHaveLength(0);

    unmount();
  });
});
