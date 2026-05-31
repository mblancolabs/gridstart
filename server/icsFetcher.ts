import { getOrSet, CACHE_TTL_MS } from "./cache";

export async function fetchICSData(seriesId: string, icsUrl: string): Promise<string> {
  const cacheKey = `ics-${seriesId}`;
  return getOrSet(cacheKey, CACHE_TTL_MS, async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(icsUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    return res.text();
  });
}
