import type { FeedHandler } from "./types";

export class HandlerRegistry {
  private handlers = new Map<string, FeedHandler>();

  register(handler: FeedHandler): void {
    this.handlers.set(handler.name, handler);
  }

  get(name: string): FeedHandler | undefined {
    return this.handlers.get(name);
  }

  list(): string[] {
    return Array.from(this.handlers.keys());
  }
}