import type { CacheProvider } from "./types";
import { MemoryCache } from "./memory";
import { RedisCache } from "./redis";

const CACHE_TTL_SECONDS = parseInt(process.env.CACHE_TTL || "3600", 10) || 3600;
export const CACHE_TTL_MS = CACHE_TTL_SECONDS * 1000;

let cacheInstance: CacheProvider | null = null;

export function getCache(): CacheProvider {
  if (!cacheInstance) {
    const redisUrl = process.env.REDIS_URL || process.env.KV_REST_API_URL;
    const redisToken = process.env.REDIS_TOKEN || process.env.KV_REST_API_TOKEN;

    if (redisUrl && redisToken) {
      cacheInstance = new RedisCache(redisUrl, redisToken, CACHE_TTL_SECONDS);
    } else {
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
