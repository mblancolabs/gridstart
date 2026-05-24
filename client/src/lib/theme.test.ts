import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { ThemeProvider, useTheme } from "./theme";

describe("ThemeProvider and useTheme", () => {
  beforeEach(() => {
    // Clear dark class before each test
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    // Clean up after each test
    document.documentElement.classList.remove("dark");
  });

  describe("ThemeProvider initialization", () => {
    it("should default to dark theme and set document class", async () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.theme).toBe("dark");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
      });
    });

    it("should initialize with toggleTheme function", () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      expect(typeof result.current.toggleTheme).toBe("function");
    });
  });

  describe("Theme toggling", () => {
    it("should toggle theme from dark to light", async () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      act(() => {
        result.current.toggleTheme();
      });

      await waitFor(() => {
        expect(result.current.theme).toBe("light");
        expect(document.documentElement.classList.contains("dark")).toBe(false);
      });
    });

    it("should toggle theme from light back to dark", async () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      // First toggle: dark -> light
      act(() => {
        result.current.toggleTheme();
      });

      await waitFor(() => {
        expect(result.current.theme).toBe("light");
      });

      // Second toggle: light -> dark
      act(() => {
        result.current.toggleTheme();
      });

      await waitFor(() => {
        expect(result.current.theme).toBe("dark");
        expect(document.documentElement.classList.contains("dark")).toBe(true);
      });
    });

    it("should handle multiple rapid toggles", async () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      act(() => {
        result.current.toggleTheme(); // dark -> light
        result.current.toggleTheme(); // light -> dark
        result.current.toggleTheme(); // dark -> light
      });

      await waitFor(() => {
        expect(result.current.theme).toBe("light");
        expect(document.documentElement.classList.contains("dark")).toBe(false);
      });
    });
  });

  describe("Document class synchronization", () => {
    it("should add dark class when theme is dark", async () => {
      renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains("dark")).toBe(true);
      });
    });

    it("should remove dark class when theme is light", async () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      act(() => {
        result.current.toggleTheme();
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains("dark")).toBe(false);
      });
    });

    it("should update document class on every toggle", async () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      expect(document.documentElement.classList.contains("dark")).toBe(true);

      act(() => {
        result.current.toggleTheme();
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains("dark")).toBe(false);
      });

      act(() => {
        result.current.toggleTheme();
      });

      await waitFor(() => {
        expect(document.documentElement.classList.contains("dark")).toBe(true);
      });
    });
  });

  describe("Context value stability", () => {
    it("should provide stable context values", () => {
      const { result, rerender } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      const initialValue = result.current;

      rerender();

      // Context value should be consistent across rerenders
      expect(result.current.theme).toBe(initialValue.theme);
      expect(typeof result.current.toggleTheme).toBe("function");
    });
  });
});
