import type { CacheEntry, CacheProvider } from "./types";

export class MemoryCache implements CacheProvider {
  private store = new Map<string, CacheEntry<unknown>>();

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    return this.store.get(key) as CacheEntry<T> | undefined;
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    this.store.set(key, entry);
  }
}
