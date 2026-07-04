export interface RateLimitEntry {
  count: number;
  resetAt: number;
}

export interface RateLimitStore {
  increment(key: string, windowMs: number): Promise<RateLimitEntry>;
}

export class MemoryRateLimitStore implements RateLimitStore {
  private store = new Map<string, { count: number; resetAt: number }>();

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const now = Date.now();
    let entry = this.store.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 1, resetAt: now + windowMs };
      this.store.set(key, entry);
      return entry;
    }
    entry.count++;
    return entry;
  }

  reset(): void {
    this.store.clear();
  }
}

export class RedisRateLimitStore implements RateLimitStore {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url;
    this.token = token;
  }

  private async cmd(command: string, ...args: string[]): Promise<unknown> {
    const res = await fetch(this.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ command, args }),
    });
    if (!res.ok) throw new Error(`Redis ${command} failed: ${res.status}`);
    const json = await res.json() as { result: unknown; error?: string };
    if (json.error) throw new Error(`Redis ${command} error: ${json.error}`);
    return json.result;
  }

  async increment(key: string, windowMs: number): Promise<RateLimitEntry> {
    const redisKey = `rl:${key}`;
    const windowSecs = Math.ceil(windowMs / 1000);

    let count: number;
    try {
      count = await this.cmd("INCR", redisKey) as number;
    } catch {
      return { count: 0, resetAt: Date.now() + windowMs };
    }

    let resetAt: number;
    if (count === 1) {
      try {
        await this.cmd("EXPIRE", redisKey, String(windowSecs));
      } catch {
        /* best-effort */
      }
      resetAt = Date.now() + windowMs;
    } else {
      let ttl: number;
      try {
        ttl = await this.cmd("TTL", redisKey) as number;
      } catch {
        ttl = windowSecs;
      }
      resetAt = Date.now() + Math.max(0, ttl) * 1000;
    }

    return { count, resetAt };
  }
}

let storeInstance: RateLimitStore | null = null;

export function getRateLimitStore(): RateLimitStore {
  if (!storeInstance) {
    const redisUrl = process.env.REDIS_URL || process.env.KV_REST_API_URL;
    const redisToken = process.env.REDIS_TOKEN || process.env.KV_REST_API_TOKEN;
    if (redisUrl && redisToken) {
      storeInstance = new RedisRateLimitStore(redisUrl, redisToken);
    } else {
      storeInstance = new MemoryRateLimitStore();
    }
  }
  return storeInstance;
}

export function clearRateLimitStore(): void {
  storeInstance = null;
}
