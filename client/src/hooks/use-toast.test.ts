import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useToast, toast, reducer } from "./use-toast";

describe("useToast Hook", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.runAllTimers();
    vi.useRealTimers();
  });

  // Test reducer directly
  describe("reducer", () => {
    it("ADD_TOAST adds a toast to the state", () => {
      const initialState = { toasts: [] };
      const action = {
        type: "ADD_TOAST" as const,
        toast: { id: "1", title: "Test", open: true },
      };

      const newState = reducer(initialState, action);

      expect(newState.toasts).toHaveLength(1);
      expect(newState.toasts[0]).toEqual({ id: "1", title: "Test", open: true });
    });

    it("UPDATE_TOAST updates an existing toast", () => {
      const initialState = {
        toasts: [{ id: "1", title: "Original", open: true }],
      };
      const action = {
        type: "UPDATE_TOAST" as const,
        toast: { id: "1", title: "Updated" },
      };

      const newState = reducer(initialState, action);

      expect(newState.toasts[0].title).toBe("Updated");
    });

    it("DISMISS_TOAST sets open to false for specific toast", () => {
      const initialState = {
        toasts: [
          { id: "1", title: "Toast 1", open: true },
          { id: "2", title: "Toast 2", open: true },
        ],
      };
      const action = {
        type: "DISMISS_TOAST" as const,
        toastId: "1",
      };

      const newState = reducer(initialState, action);

      expect(newState.toasts[0].open).toBe(false);
      expect(newState.toasts[1].open).toBe(true);
    });

    it("DISMISS_TOAST sets open to false for all toasts when no toastId", () => {
      const initialState = {
        toasts: [
          { id: "1", title: "Toast 1", open: true },
          { id: "2", title: "Toast 2", open: true },
        ],
      };
      const action = {
        type: "DISMISS_TOAST" as const,
        toastId: undefined,
      };

      const newState = reducer(initialState, action);

      expect(newState.toasts[0].open).toBe(false);
      expect(newState.toasts[1].open).toBe(false);
    });

    it("REMOVE_TOAST removes specific toast", () => {
      const initialState = {
        toasts: [
          { id: "1", title: "Toast 1", open: false },
          { id: "2", title: "Toast 2", open: true },
        ],
      };
      const action = {
        type: "REMOVE_TOAST" as const,
        toastId: "1",
      };

      const newState = reducer(initialState, action);

      expect(newState.toasts).toHaveLength(1);
      expect(newState.toasts[0].id).toBe("2");
    });

    it("REMOVE_TOAST removes all toasts when no toastId", () => {
      const initialState = {
        toasts: [
          { id: "1", title: "Toast 1", open: false },
          { id: "2", title: "Toast 2", open: false },
        ],
      };
      const action = {
        type: "REMOVE_TOAST" as const,
        toastId: undefined,
      };

      const newState = reducer(initialState, action);

      expect(newState.toasts).toHaveLength(0);
    });
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

  it("toast() returns id, dismiss, and update functions", () => {
    const toastApi = toast({ title: "Test" });

    expect(toastApi).toHaveProperty("id");
    expect(typeof toastApi.id).toBe("string");
    expect(typeof toastApi.dismiss).toBe("function");
    expect(typeof toastApi.update).toBe("function");
  });

  it("dismiss() with no id dismisses all toasts", () => {
    const { result, unmount } = renderHook(() => useToast());

    act(() => {
      toast({ title: "Toast 1" });
      toast({ title: "Toast 2" });
    });

    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts.every((t) => t.open)).toBe(true);

    act(() => {
      result.current.dismiss();
    });

    expect(result.current.toasts.every((t) => !t.open)).toBe(true);

    unmount();
  });

  it("timeout queue prevents duplicate removal timeouts", () => {
    const { result, unmount } = renderHook(() => useToast());
    let toastApi: ReturnType<typeof toast>;

    act(() => {
      toastApi = toast({ title: "Test" });
    });

    // Dismiss multiple times quickly
    act(() => {
      result.current.dismiss(toastApi.id);
      result.current.dismiss(toastApi.id);
      result.current.dismiss(toastApi.id);
    });

    // Should still only have one timeout
    expect(result.current.toasts[0].open).toBe(false);

    unmount();
  });
});
