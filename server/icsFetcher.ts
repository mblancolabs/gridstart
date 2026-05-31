import { getCache } from "./cache";

const CACHE_TTL = 60 * 60 * 1000; // 1 hour

export async function fetchICSData(seriesId: string, icsUrl: string): Promise<string> {
  const cache = getCache();
  const cacheKey = `ics-${seriesId}`;
  const cached = await cache.get<string>(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(icsUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const text = await res.text();
    await cache.set(cacheKey, { data: text, fetchedAt: Date.now() });
    return text;
  } catch (err) {
    if (cached) {
      return cached.data;
    }
    throw err;
  }
}
