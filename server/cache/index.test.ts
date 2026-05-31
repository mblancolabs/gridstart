import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryCache } from "./memory";
import { RedisCache } from "./redis";
import { getCache, clearCacheInstance } from "./index";

describe("getCache", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearCacheInstance();
    delete process.env.REDIS_URL;
    delete process.env.REDIS_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.CACHE_TTL;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    clearCacheInstance();
  });

  it("returns MemoryCache when REDIS_URL not set", () => {
    const cache = getCache();
    expect(cache.constructor.name).toBe("MemoryCache");
  });

  it("returns RedisCache when REDIS_URL is set", () => {
    process.env.REDIS_URL = "https://mock.redis.io";
    process.env.REDIS_TOKEN = "test-token";
    process.env.CACHE_TTL = "3600";
    clearCacheInstance();

    const cache = getCache();
    expect(cache.constructor.name).toBe("RedisCache");
  });

  it("returns same instance on repeated calls", () => {
    clearCacheInstance();
    const a = getCache();
    const b = getCache();
    expect(a).toBe(b);
  });

  it("returns MemoryCache after clearing env and clearing instance", () => {
    process.env.REDIS_URL = "https://mock.redis.io";
    process.env.REDIS_TOKEN = "test-token";
    clearCacheInstance();

    const redisCache = getCache();
    expect(redisCache.constructor.name).toBe("RedisCache");

    delete process.env.REDIS_URL;
    delete process.env.REDIS_TOKEN;
    clearCacheInstance();

    const memoryCache = getCache();
    expect(memoryCache.constructor.name).toBe("MemoryCache");
  });

  it("returns RedisCache when Vercel KV vars are set without REDIS_ vars", () => {
    process.env.KV_REST_API_URL = "https://mock.vercel-kv.io";
    process.env.KV_REST_API_TOKEN = "kv-token";
    clearCacheInstance();

    const cache = getCache();
    expect(cache.constructor.name).toBe("RedisCache");
  });

  it("prefers REDIS_ vars over KV_REST_API_ vars when both are set", () => {
    process.env.REDIS_URL = "https://redis.example.com";
    process.env.REDIS_TOKEN = "redis-token";
    process.env.KV_REST_API_URL = "https://kv.example.com";
    process.env.KV_REST_API_TOKEN = "kv-token";
    clearCacheInstance();

    const cache = getCache();
    expect(cache.constructor.name).toBe("RedisCache");
  });
});
