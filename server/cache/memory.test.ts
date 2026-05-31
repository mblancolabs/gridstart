import { describe, it, expect } from "vitest";
import { MemoryCache } from "./memory";

describe("MemoryCache", () => {
  it("get returns undefined for missing key", async () => {
    const cache = new MemoryCache();
    const result = await cache.get("nonexistent");
    expect(result).toBeUndefined();
  });

  it("set and get round-trip", async () => {
    const cache = new MemoryCache();
    const entry = { data: "hello", fetchedAt: 1000 };
    await cache.set("greeting", entry);
    const result = await cache.get<string>("greeting");
    expect(result).toEqual(entry);
  });

  it("get returns correct entry by key", async () => {
    const cache = new MemoryCache();
    await cache.set("a", { data: 1, fetchedAt: 10 });
    await cache.set("b", { data: 2, fetchedAt: 20 });
    const result = await cache.get<number>("a");
    expect(result?.data).toBe(1);
  });

  it("set overwrites existing key", async () => {
    const cache = new MemoryCache();
    await cache.set("key", { data: "old", fetchedAt: 100 });
    await cache.set("key", { data: "new", fetchedAt: 200 });
    const result = await cache.get<string>("key");
    expect(result?.data).toBe("new");
    expect(result?.fetchedAt).toBe(200);
  });

  it("stores arbitrary data types", async () => {
    const cache = new MemoryCache();
    const obj = { foo: [1, 2, 3], bar: true };
    await cache.set("obj", { data: obj, fetchedAt: 1 });
    const result = await cache.get<typeof obj>("obj");
    expect(result?.data).toEqual(obj);
  });

  it("is not shared across instances", async () => {
    const cache1 = new MemoryCache();
    const cache2 = new MemoryCache();
    await cache1.set("shared", { data: "val", fetchedAt: 1 });
    const result = await cache2.get("shared");
    expect(result).toBeUndefined();
  });
});
