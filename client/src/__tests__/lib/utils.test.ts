import { describe, it, expect } from "vitest";
import { cn } from "../../lib/utils";

describe("cn - Tailwind class merger", () => {
  it("should merge simple class names", () => {
    const result = cn("px-2", "py-1");
    expect(result).toContain("px-2");
    expect(result).toContain("py-1");
  });

  it("should handle conditional classes", () => {
    const isActive = true;
    const result = cn("base-class", isActive && "active-class");
    expect(result).toContain("base-class");
    expect(result).toContain("active-class");
  });

  it("should exclude false conditional classes", () => {
    const isActive = false;
    const result = cn("base-class", isActive && "active-class");
    expect(result).toContain("base-class");
    expect(result).not.toContain("active-class");
  });

  it("should handle array of classes", () => {
    const result = cn(["px-2", "py-1"], "mx-auto");
    expect(result).toContain("px-2");
    expect(result).toContain("py-1");
    expect(result).toContain("mx-auto");
  });

  it("should merge and override conflicting Tailwind classes", () => {
    const result = cn("px-2 py-1", "px-4");
    // px-4 should override px-2
    expect(result).toContain("px-4");
    expect(result).toContain("py-1");
    // Ensure px-2 is removed by tailwind-merge
    expect(result).not.toMatch(/\bpx-2\b/);
  });

  it("should handle undefined and null values", () => {
    const result = cn("px-2", undefined, null, "py-1");
    expect(result).toContain("px-2");
    expect(result).toContain("py-1");
  });

  it("should handle object notation from clsx", () => {
    const result = cn({
      "px-2": true,
      "py-1": false,
      "mx-auto": true,
    });
    expect(result).toContain("px-2");
    expect(result).not.toContain("py-1");
    expect(result).toContain("mx-auto");
  });

  it("should return empty string when no classes provided", () => {
    const result = cn();
    expect(result).toBe("");
  });

  it("should handle complex nested conditionals", () => {
    const size = "lg" as "lg" | "sm";
    const variant = "primary" as "primary" | "secondary";
    const disabled = false;

    const result = cn(
      "button",
      size === "lg" ? "px-4 py-2" : undefined,
      size === "sm" ? "px-2 py-1" : undefined,
      variant === "primary" ? "bg-blue-500" : undefined,
      variant === "secondary" ? "bg-gray-500" : undefined,
      disabled ? "opacity-50" : undefined
    );

    expect(result).toContain("button");
    expect(result).toContain("px-4");
    expect(result).toContain("py-2");
    expect(result).toContain("bg-blue-500");
    expect(result).not.toContain("opacity-50");
  });
});
