import type { CacheProvider } from "./types";
import type { KVNamespace } from "@cloudflare/workers-types";
import { MemoryCache } from "./memory";
import { RedisCache } from "./redis";
import { KVCache } from "./kv";

const CACHE_TTL_SECONDS = parseInt(process.env.CACHE_TTL || "3600", 10) || 3600;
export const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;

let cacheInstance: CacheProvider | null = null;

declare global {
  // eslint-disable-next-line no-var
  var __GRIDSTART_CACHE_KV: KVNamespace | undefined;
}

export function setKvNamespace(kv: KVNamespace): void {
  globalThis.__GRIDSTART_CACHE_KV = kv;
}

export function getCache(): CacheProvider {
  if (!cacheInstance) {
    const provider = process.env.CACHE_PROVIDER || "memory";

    if (provider === "kv") {
      const kv = globalThis.__GRIDSTART_CACHE_KV;
      if (kv) {
        cacheInstance = new KVCache(kv, CACHE_TTL_SECONDS);
      } else {
        console.warn(
          "CACHE_PROVIDER=kv but no CACHE_KV namespace binding found, falling back to MemoryCache. " +
            "Ensure the binding is configured in the Cloudflare Pages dashboard (Settings → Functions → KV namespace bindings) and injected in worker.ts.",
        );
        cacheInstance = new MemoryCache();
      }
    } else if (provider === "redis") {
      const redisUrl = process.env.REDIS_URL || process.env.KV_REST_API_URL;
      const redisToken = process.env.REDIS_TOKEN || process.env.KV_REST_API_TOKEN;

      if (redisUrl && redisToken) {
        cacheInstance = new RedisCache(redisUrl, redisToken, CACHE_TTL_SECONDS);
      } else {
        console.warn(
          "CACHE_PROVIDER=redis but REDIS_URL and/or REDIS_TOKEN are not set, falling back to MemoryCache.",
        );
        cacheInstance = new MemoryCache();
      }
    } else if (provider === "memory") {
      cacheInstance = new MemoryCache();
    } else {
      console.warn(
        `Unknown CACHE_PROVIDER "${provider}", falling back to MemoryCache. ` +
          "Valid values: memory, redis, kv.",
      );
      cacheInstance = new MemoryCache();
    }
  }
  return cacheInstance;
}

export function clearCacheInstance(): void {
  cacheInstance = null;
  pendingFetches.clear();
}

const pendingFetches = new Map<string, Promise<unknown>>();

export async function getOrSet<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  const cache = getCache();

  const existing = pendingFetches.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const cached = await cache.get<T>(key);
  if (cached && Date.now() - cached.fetchedAt < ttlMs) {
    return cached.data;
  }

  const existingAfterCheck = pendingFetches.get(key) as Promise<T> | undefined;
  if (existingAfterCheck) return existingAfterCheck;

  const promise = (async (): Promise<T> => {
    try {
      const data = await fetcher();
      await cache.set(key, { data, fetchedAt: Date.now() });
      return data;
    } catch (err) {
      if (cached) return cached.data;
      throw err;
    } finally {
      pendingFetches.delete(key);
    }
  })();

  pendingFetches.set(key, promise);
  return promise;
}

export type { CacheProvider, CacheEntry } from "./types";
