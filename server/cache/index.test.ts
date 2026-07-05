import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getCache, clearCacheInstance, getOrSet, setKvNamespace } from "./index";

describe("getCache", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    clearCacheInstance();
    delete process.env.CACHE_PROVIDER;
    delete process.env.REDIS_URL;
    delete process.env.REDIS_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;
    delete process.env.CACHE_TTL;
    delete globalThis.__GRIDSTART_CACHE_KV;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    clearCacheInstance();
  });

  it("returns MemoryCache when CACHE_PROVIDER is unset", () => {
    const cache = getCache();
    expect(cache.constructor.name).toBe("MemoryCache");
  });

  it("returns MemoryCache when CACHE_PROVIDER=memory", () => {
    process.env.CACHE_PROVIDER = "memory";
    const cache = getCache();
    expect(cache.constructor.name).toBe("MemoryCache");
  });

  it("returns RedisCache when CACHE_PROVIDER=redis and env vars are set", () => {
    process.env.CACHE_PROVIDER = "redis";
    process.env.REDIS_URL = "https://mock.redis.io";
    process.env.REDIS_TOKEN = "test-token";
    process.env.CACHE_TTL = "3600";
    clearCacheInstance();

    const cache = getCache();
    expect(cache.constructor.name).toBe("RedisCache");
  });

  it("returns MemoryCache and warns when CACHE_PROVIDER=redis but vars are missing", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.CACHE_PROVIDER = "redis";
    clearCacheInstance();

    const cache = getCache();
    expect(cache.constructor.name).toBe("MemoryCache");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns KVCache when CACHE_PROVIDER=kv and binding is set", () => {
    const mockKV = {} as KVNamespace;
    setKvNamespace(mockKV);
    process.env.CACHE_PROVIDER = "kv";
    clearCacheInstance();

    const cache = getCache();
    expect(cache.constructor.name).toBe("KVCache");
  });

  it("returns MemoryCache and warns when CACHE_PROVIDER=kv but no binding", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.CACHE_PROVIDER = "kv";
    clearCacheInstance();

    const cache = getCache();
    expect(cache.constructor.name).toBe("MemoryCache");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("warns and falls back for unknown CACHE_PROVIDER value", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.CACHE_PROVIDER = "mongodb";
    clearCacheInstance();

    const cache = getCache();
    expect(cache.constructor.name).toBe("MemoryCache");
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it("returns same instance on repeated calls", () => {
    clearCacheInstance();
    const a = getCache();
    const b = getCache();
    expect(a).toBe(b);
  });

  it("switches after clearing instance", () => {
    clearCacheInstance();
    process.env.CACHE_PROVIDER = "memory";
    const memoryCache = getCache();
    expect(memoryCache.constructor.name).toBe("MemoryCache");

    const mockKV = {} as KVNamespace;
    setKvNamespace(mockKV);
    process.env.CACHE_PROVIDER = "kv";
    clearCacheInstance();

    const kvCache = getCache();
    expect(kvCache.constructor.name).toBe("KVCache");
  });
});

describe("getOrSet", () => {
  beforeEach(() => {
    clearCacheInstance();
    delete process.env.CACHE_PROVIDER;
  });

  it("fetches and caches data on cache miss", async () => {
    const fetcher = vi.fn().mockResolvedValue("fresh-data");
    const result = await getOrSet("test-key", 1000, fetcher);

    expect(result).toBe("fresh-data");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("returns cached data on cache hit", async () => {
    const fetcher = vi.fn().mockResolvedValue("fresh-data");
    await getOrSet("test-key", 1000, fetcher);
    const result = await getOrSet("test-key", 1000, fetcher);

    expect(result).toBe("fresh-data");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
