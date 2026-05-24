import { describe, it, expect } from "vitest";
import { HandlerRegistry } from "./registry";
import type { FeedHandler } from "./types";

function createMockHandler(name: string): FeedHandler {
  return {
    name,
    async fetchEvents() {
      return [];
    },
  };
}

describe("HandlerRegistry", () => {
  it("registers and retrieves a handler by name", () => {
    const registry = new HandlerRegistry();
    const handler = createMockHandler("test-handler");
    registry.register(handler);

    expect(registry.get("test-handler")).toBe(handler);
  });

  it("returns undefined for unregistered handler", () => {
    const registry = new HandlerRegistry();
    expect(registry.get("nonexistent")).toBeUndefined();
  });

  it("lists all registered handler names", () => {
    const registry = new HandlerRegistry();
    registry.register(createMockHandler("handler-a"));
    registry.register(createMockHandler("handler-b"));

    const names = registry.list();
    expect(names).toHaveLength(2);
    expect(names).toContain("handler-a");
    expect(names).toContain("handler-b");
  });

  it("overwrites handler when registering same name", () => {
    const registry = new HandlerRegistry();
    const first = createMockHandler("dup");
    const second = createMockHandler("dup");
    registry.register(first);
    registry.register(second);

    expect(registry.get("dup")).toBe(second);
  });

  it("returns empty list when no handlers registered", () => {
    const registry = new HandlerRegistry();
    expect(registry.list()).toEqual([]);
  });
});
