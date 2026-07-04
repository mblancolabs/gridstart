import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  MemoryRateLimitStore,
  RedisRateLimitStore,
  getRateLimitStore,
  clearRateLimitStore,
} from "./rateLimitStore";

describe("MemoryRateLimitStore", () => {
  let store: MemoryRateLimitStore;

  beforeEach(() => {
    store = new MemoryRateLimitStore();
  });

  it("returns count 1 for a new key", async () => {
    const entry = await store.increment("client-1", 60000);
    expect(entry.count).toBe(1);
    expect(entry.resetAt).toBeGreaterThan(Date.now());
  });

  it("increments count for an existing key within the window", async () => {
    await store.increment("client-1", 60000);
    const entry = await store.increment("client-1", 60000);
    expect(entry.count).toBe(2);
  });

  it("tracks different keys independently", async () => {
    await store.increment("client-1", 60000);
    await store.increment("client-1", 60000);
    const entry = await store.increment("client-2", 60000);
    expect(entry.count).toBe(1);
  });

  it("resets count when the window expires", async () => {
    vi.useFakeTimers();
    await store.increment("client-1", 60000);
    vi.advanceTimersByTime(60001);
    const entry = await store.increment("client-1", 60000);
    expect(entry.count).toBe(1);
    vi.useRealTimers();
  });

  it("reset clears all entries", async () => {
    await store.increment("client-1", 60000);
    await store.increment("client-2", 60000);
    store.reset();
    const entry1 = await store.increment("client-1", 60000);
    expect(entry1.count).toBe(1);
    const entry2 = await store.increment("client-2", 60000);
    expect(entry2.count).toBe(1);
  });
});

describe("RedisRateLimitStore", () => {
  const url = "https://example.upstash.io";
  const token = "test-token";
  let store: RedisRateLimitStore;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    store = new RedisRateLimitStore(url, token);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses INCR and EXPIRE on first request", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ result: 1 }),
    });

    const entry = await store.increment("client-1", 60000);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [incrCall, expireCall] = fetchSpy.mock.calls;
    expect(JSON.parse(incrCall[1].body)).toEqual({
      command: "INCR",
      args: ["rl:client-1"],
    });
    expect(JSON.parse(expireCall[1].body)).toEqual({
      command: "EXPIRE",
      args: ["rl:client-1", "60"],
    });
    expect(entry.count).toBe(1);
    expect(entry.resetAt).toBeGreaterThan(Date.now());
  });

  it("uses INCR and TTL on subsequent requests", async () => {
    fetchSpy
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 2 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: 45 }) });

    const entry = await store.increment("client-1", 60000);

    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const [incrCall, ttlCall] = fetchSpy.mock.calls;
    expect(JSON.parse(incrCall[1].body)).toEqual({
      command: "INCR",
      args: ["rl:client-1"],
    });
    expect(JSON.parse(ttlCall[1].body)).toEqual({
      command: "TTL",
      args: ["rl:client-1"],
    });
    expect(entry.count).toBe(2);
  });

  it("falls through with count 0 on Redis failure", async () => {
    fetchSpy.mockRejectedValue(new Error("Redis unreachable"));

    const entry = await store.increment("client-1", 60000);

    expect(entry.count).toBe(0);
    expect(entry.resetAt).toBeGreaterThan(Date.now());
  });

  it("falls through with count 0 on non-ok response", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 503,
    });

    const entry = await store.increment("client-1", 60000);

    expect(entry.count).toBe(0);
  });

  it("handles INCR error response gracefully", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => ({ error: "WRONGTYPE Operation against a key holding the wrong kind of value" }),
    });

    const entry = await store.increment("client-1", 60000);

    expect(entry.count).toBe(0);
  });
});

describe("getRateLimitStore", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    clearRateLimitStore();
  });

  it("returns MemoryRateLimitStore when no Redis vars are set", () => {
    delete process.env.REDIS_URL;
    delete process.env.REDIS_TOKEN;
    delete process.env.KV_REST_API_URL;
    delete process.env.KV_REST_API_TOKEN;

    const store = getRateLimitStore();
    expect(store).toBeInstanceOf(MemoryRateLimitStore);
  });

  it("returns RedisRateLimitStore when REDIS_URL and REDIS_TOKEN are set", () => {
    process.env.REDIS_URL = "https://redis.example.com";
    process.env.REDIS_TOKEN = "token";

    const store = getRateLimitStore();
    expect(store).toBeInstanceOf(RedisRateLimitStore);
  });

  it("returns RedisRateLimitStore when KV_REST_API_URL and KV_REST_API_TOKEN are set", () => {
    process.env.REDIS_URL = "";
    process.env.REDIS_TOKEN = "";
    process.env.KV_REST_API_URL = "https://kv.example.com";
    process.env.KV_REST_API_TOKEN = "token";

    const store = getRateLimitStore();
    expect(store).toBeInstanceOf(RedisRateLimitStore);
  });

  it("returns a singleton instance", () => {
    process.env.REDIS_URL = "https://redis.example.com";
    process.env.REDIS_TOKEN = "token";

    const a = getRateLimitStore();
    const b = getRateLimitStore();
    expect(a).toBe(b);
  });

  it("clearRateLimitStore resets the singleton", () => {
    process.env.REDIS_URL = "https://redis.example.com";
    process.env.REDIS_TOKEN = "token";

    const a = getRateLimitStore();
    clearRateLimitStore();
    const b = getRateLimitStore();
    expect(a).not.toBe(b);
  });
});
