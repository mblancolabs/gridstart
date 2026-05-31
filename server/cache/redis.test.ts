import { describe, it, expect, vi, beforeEach } from "vitest";
import { RedisCache } from "./redis";

describe("RedisCache", () => {
  const mockFetch = vi.fn();
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  function createCache() {
    return new RedisCache("https://mock.redis.io", "test-token", 3600);
  }

  it("get returns undefined for missing key", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: null }),
    });

    const cache = createCache();
    const result = await cache.get("nonexistent");
    expect(result).toBeUndefined();
  });

  it("set and get round-trip", async () => {
    const entry = { data: "hello", fetchedAt: 1000 };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: JSON.stringify(entry) }),
    });

    const cache = createCache();
    await cache.set("greeting", entry);
    const result = await cache.get<string>("greeting");
    expect(result).toEqual(entry);
  });

  it("set overwrites existing key", async () => {
    const oldEntry = { data: "old", fetchedAt: 100 };
    const newEntry = { data: "new", fetchedAt: 200 };

    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) });
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ result: JSON.stringify(newEntry) }),
    });

    const cache = createCache();
    await cache.set("key", oldEntry);
    await cache.set("key", newEntry);
    const result = await cache.get<string>("key");
    expect(result?.data).toBe("new");
    expect(result?.fetchedAt).toBe(200);
  });

  it("key is namespaced with cache: prefix", async () => {
    const entry = { data: "val", fetchedAt: 1 };

    let setKey = "";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockImplementation(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      if (body.command === "SET") {
        setKey = body.args[0];
      }
      return { ok: true, json: async () => ({}) };
    });

    const cache = createCache();
    await cache.set("mykey", entry);
    expect(setKey).toBe("cache:mykey");
  });

  it("ttl is set on key", async () => {
    const entry = { data: "val", fetchedAt: 1 };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let setArgs: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockFetch.mockImplementation(async (_url: string, opts: any) => {
      const body = JSON.parse(opts.body);
      if (body.command === "SET") {
        setArgs = body.args;
      }
      return { ok: true, json: async () => ({}) };
    });

    const cache = createCache();
    await cache.set("ttl-key", entry);
    // args should be [key, value, "EX", ttl]
    expect(setArgs[2]).toBe("EX");
    expect(setArgs[3]).toBe(7200); // defaultTtl * 2
  });

  it("get returns undefined when fetch fails", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 });

    const cache = createCache();
    const result = await cache.get("fail-key");
    expect(result).toBeUndefined();
  });

  it("get returns undefined on invalid JSON", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ result: "not-json" }),
    });

    const cache = createCache();
    const result = await cache.get("bad-json");
    expect(result).toBeUndefined();
  });

  it("set throws on SET failure", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 403 });

    const cache = createCache();
    await expect(cache.set("fail", { data: "x", fetchedAt: 1 })).rejects.toThrow("Redis SET failed");
  });
});
