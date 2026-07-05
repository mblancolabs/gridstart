import { describe, it, expect, vi } from "vitest";
import { KVCache } from "./kv";

function createMockKV(): KVNamespace {
  const store = new Map<string, string>();
  let putOptions: { expirationTtl?: number } | undefined;

  return {
    get: vi.fn(async (key: string) => store.get(key) ?? null),
    put: vi.fn(async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      store.set(key, value);
      putOptions = opts;
    }),
    delete: vi.fn(),
    getWithMetadata: vi.fn(),
    list: vi.fn(),
  } as unknown as KVNamespace;
}

describe("KVCache", () => {
  it("get returns undefined for missing key", async () => {
    const mock = createMockKV();
    const cache = new KVCache(mock, 3600);
    const result = await cache.get("nonexistent");
    expect(result).toBeUndefined();
  });

  it("set and get round-trip", async () => {
    const mock = createMockKV();
    const cache = new KVCache(mock, 3600);
    const entry = { data: "hello", fetchedAt: 1000 };

    await cache.set("greeting", entry);
    const result = await cache.get<string>("greeting");
    expect(result).toEqual(entry);
  });

  it("set overwrites existing key", async () => {
    const mock = createMockKV();
    const cache = new KVCache(mock, 3600);

    await cache.set("key", { data: "old", fetchedAt: 100 });
    await cache.set("key", { data: "new", fetchedAt: 200 });
    const result = await cache.get<string>("key");
    expect(result?.data).toBe("new");
    expect(result?.fetchedAt).toBe(200);
  });

  it("key is namespaced with cache: prefix", async () => {
    const mock = createMockKV();
    const cache = new KVCache(mock, 3600);
    const entry = { data: "val", fetchedAt: 1 };

    await cache.set("mykey", entry);
    expect(mock.put).toHaveBeenCalledWith(
      "cache:mykey",
      JSON.stringify(entry),
      expect.any(Object),
    );
  });

  it("expirationTtl is set on key", async () => {
    const mock = createMockKV();
    const cache = new KVCache(mock, 3600);
    const entry = { data: "val", fetchedAt: 1 };

    const putMock = vi.mocked(mock.put);
    await cache.set("ttl-key", entry);
    expect(putMock).toHaveBeenCalledWith(
      "cache:ttl-key",
      JSON.stringify(entry),
      { expirationTtl: 7200 },
    );
  });

  it("get returns undefined on invalid JSON", async () => {
    const mock = createMockKV();
    vi.mocked(mock.get).mockResolvedValue("not-json");

    const cache = new KVCache(mock, 3600);
    const result = await cache.get("bad-json");
    expect(result).toBeUndefined();
  });

  it("get returns undefined when KV returns null", async () => {
    const mock = createMockKV();
    vi.mocked(mock.get).mockResolvedValue(null);

    const cache = new KVCache(mock, 3600);
    const result = await cache.get("null-key");
    expect(result).toBeUndefined();
  });

  it("stores arbitrary data types", async () => {
    const mock = createMockKV();
    const cache = new KVCache(mock, 3600);
    const obj = { foo: [1, 2, 3], bar: true };

    await cache.set("obj", { data: obj, fetchedAt: 1 });
    const result = await cache.get<typeof obj>("obj");
    expect(result?.data).toEqual(obj);
  });
});
