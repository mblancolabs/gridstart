import "dotenv/config";
import fs from "fs";
import path from "path";

// In non-production environments, automatically provide a CSRF secret
// if none is configured.  This ensures the e2e tests (which run in CI
// without a tracked .env file) don't fail.
if (process.env.NODE_ENV !== "production" && !process.env.CSRF_SECRET) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  process.env.CSRF_SECRET = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function loadFeedsConfigFromFS(): { categories: FeedsCategory[] } {
  const feedsDir = path.resolve(process.cwd(), "config");
  const baseFile = "calendar-feeds.json";
  const patternFiles = fs
    .readdirSync(feedsDir)
    .filter((f) => f.startsWith("calendar-feeds.") && f.endsWith(".json") && f !== baseFile)
    .sort();
  const allFiles = [baseFile, ...patternFiles];
  const mergedConfig: { categories: FeedsCategory[] } = { categories: [] };
  const categoryMap = new Map<string, FeedsCategory>();
  const seriesMap = new Map<string, Map<string, FeedsCategory["series"][number]>>();

  for (const file of allFiles) {
    const filePath = path.resolve(feedsDir, file);
    const content = fs.readFileSync(filePath, "utf-8");
    const config = JSON.parse(content) as { categories?: FeedsCategory[] };
    if (!config.categories || !Array.isArray(config.categories)) {
      throw new Error(`Invalid feeds configuration in ${file}: missing or invalid categories array`);
    }
    for (const category of config.categories) {
      if (!categoryMap.has(category.name)) {
        categoryMap.set(category.name, { name: category.name, series: [] });
        seriesMap.set(category.name, new Map());
        mergedConfig.categories.push(categoryMap.get(category.name)!);
      }
      const catSeriesMap = seriesMap.get(category.name)!;
      for (const series of category.series) {
        catSeriesMap.set(series.id, series);
      }
    }
  }
  for (const category of mergedConfig.categories) {
    const catSeriesMap = seriesMap.get(category.name)!;
    category.series = Array.from(catSeriesMap.values());
  }
  return mergedConfig;
}

interface FeedsCategory {
  name: string;
  series: Array<{
    id: string;
    name: string;
    shortName: string;
    color: string;
    handler: string;
    params: Record<string, unknown>;
    enabled: boolean;
  }>;
}

const feedsConfig = loadFeedsConfigFromFS();
(globalThis as unknown as Record<string, string>).__CONFIG_FEEDS__ = JSON.stringify(feedsConfig);
