import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useIsMobile } from "../../hooks/use-mobile";

describe("useIsMobile Hook", () => {
  const MOBILE_BREAKPOINT = 768;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.innerWidth
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should return false on desktop screen", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("should return true on mobile screen", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 500,
    });

    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("should detect mobile at breakpoint boundary (767px)", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 767,
    });

    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("should not detect mobile just above breakpoint (768px)", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 768,
    });

    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("should update on window resize", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());

    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 500,
      });
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("should handle multiple resize events", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });

    const { result } = renderHook(() => useIsMobile());

    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 500,
      });
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(result.current).toBe(true);
    });

    act(() => {
      Object.defineProperty(window, "innerWidth", {
        writable: true,
        configurable: true,
        value: 1024,
      });
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("should handle small mobile screens", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 320,
    });

    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => {
      expect(result.current).toBe(true);
    });
  });

  it("should handle large desktop screens", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1920,
    });

    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => {
      expect(result.current).toBe(false);
    });
  });

  it("should handle tablet screens at breakpoint", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 768,
    });

    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => {
      // 768px is not mobile (breakpoint is 768 - 1 = 767)
      expect(result.current).toBe(false);
    });
  });

  it("should start with initial value based on innerWidth", async () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 500,
    });

    const { result } = renderHook(() => useIsMobile());

    await waitFor(() => {
      expect(typeof result.current).toBe("boolean");
      expect(result.current).toBe(true);
    });
  });

  it("should use matchMedia addEventListener when available", async () => {
    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    });

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: mockMatchMedia,
    });

    renderHook(() => useIsMobile());

    expect(mockMatchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });

  it("should use matchMedia addListener as fallback", async () => {
    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: false,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: undefined, // Not available
    });

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: mockMatchMedia,
    });

    renderHook(() => useIsMobile());

    expect(mockMatchMedia).toHaveBeenCalledWith("(max-width: 767px)");
  });

  it("should register and cleanup matchMedia listeners", async () => {
    const addEventListenerSpy = vi.fn();
    const removeEventListenerSpy = vi.fn();

    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: false,
      addEventListener: addEventListenerSpy,
      removeEventListener: removeEventListenerSpy,
    });

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: mockMatchMedia,
    });

    const { unmount } = renderHook(() => useIsMobile());

    expect(addEventListenerSpy).toHaveBeenCalledWith("change", expect.any(Function));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith("change", expect.any(Function));
  });

  it("should register and cleanup fallback matchMedia listeners", async () => {
    const addListenerSpy = vi.fn();
    const removeListenerSpy = vi.fn();

    const mockMatchMedia = vi.fn().mockReturnValue({
      matches: false,
      addListener: addListenerSpy,
      removeListener: removeListenerSpy,
      addEventListener: undefined, // Not available
    });

    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: mockMatchMedia,
    });

    const { unmount } = renderHook(() => useIsMobile());

    expect(addListenerSpy).toHaveBeenCalledWith(expect.any(Function));

    unmount();

    expect(removeListenerSpy).toHaveBeenCalledWith(expect.any(Function));
  });
});
