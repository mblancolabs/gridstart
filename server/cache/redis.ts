import type { CacheEntry, CacheProvider } from "./types";

const KEY_PREFIX = "cache:";

export class RedisCache implements CacheProvider {
  private redis: {
    get: (key: string) => Promise<string | null>;
    set: (key: string, value: string, opts: { ex: number }) => Promise<any>;
  };
  private defaultTtl: number;

  constructor(url: string, token: string, defaultTtl: number) {
    this.defaultTtl = defaultTtl;
    this.redis = {
      get: async (key: string) => {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ command: "GET", args: [key] }),
        });
        if (!res.ok) return null;
        const json = await res.json();
        return json.result ?? null;
      },
      set: async (key: string, value: string, opts: { ex: number }) => {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ command: "SET", args: [key, value, "EX", opts.ex] }),
        });
        if (!res.ok) {
          throw new Error(`Redis SET failed: ${res.status}`);
        }
        return res.json();
      },
    };
  }

  async get<T>(key: string): Promise<CacheEntry<T> | undefined> {
    const raw = await this.redis.get(`${KEY_PREFIX}${key}`);
    if (!raw) return undefined;
    try {
      return JSON.parse(raw) as CacheEntry<T>;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const raw = JSON.stringify(entry);
    await this.redis.set(`${KEY_PREFIX}${key}`, raw, { ex: this.defaultTtl * 2 });
  }
}
