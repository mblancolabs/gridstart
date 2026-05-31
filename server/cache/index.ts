import type { CacheProvider } from "./types";
import { MemoryCache } from "./memory";
import { RedisCache } from "./redis";

let cacheInstance: CacheProvider | null = null;

export function getCache(): CacheProvider {
  if (!cacheInstance) {
    const redisUrl = process.env.REDIS_URL || process.env.KV_REST_API_URL;
    const redisToken = process.env.REDIS_TOKEN || process.env.KV_REST_API_TOKEN;

    if (redisUrl && redisToken) {
      cacheInstance = new RedisCache(redisUrl, redisToken, parseInt(process.env.CACHE_TTL || "3600", 10));
    } else {
      cacheInstance = new MemoryCache();
    }
  }
  return cacheInstance;
}

export function clearCacheInstance(): void {
  cacheInstance = null;
}

export type { CacheProvider, CacheEntry } from "./types";
