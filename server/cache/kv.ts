import type { CacheEntry, CacheProvider } from "./types";
import type { KVNamespace } from "@cloudflare/workers-types";

const KEY_PREFIX = "cache:";

export class KVCache implements CacheProvider {
  private kv: KVNamespace;
  private defaultTtl: number;

  constructor(kv: KVNamespace, defaultTtl: number) {
    this.kv = kv;
    this.defaultTtl = defaultTtl;
  }

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const raw = await this.kv.get(`${KEY_PREFIX}${key}`);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as CacheEntry<T>;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const raw = JSON.stringify(entry);
    await this.kv.put(`${KEY_PREFIX}${key}`, raw, {
      expirationTtl: this.defaultTtl * 2,
    });
  }
}
