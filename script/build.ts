import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, cp } from "fs/promises";
import { readFileSync, readdirSync } from "fs";
import path from "path";

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

export function loadMergedFeedsConfig(): { categories: FeedsCategory[] } {
  const feedsDir = path.resolve(process.cwd(), "config");
  const baseFile = "calendar-feeds.json";

  const patternFiles = readdirSync(feedsDir)
    .filter((f) => f.startsWith("calendar-feeds.") && f.endsWith(".json") && f !== baseFile)
    .sort();

  const allFiles = [baseFile, ...patternFiles];
  const mergedConfig: { categories: FeedsCategory[] } = { categories: [] };
  const categoryMap = new Map<string, FeedsCategory>();
  const seriesMap = new Map<string, Map<string, FeedsCategory["series"][number]>>();

  for (const file of allFiles) {
    const filePath = path.resolve(feedsDir, file);
    let content: string;
    try {
      content = readFileSync(filePath, "utf-8");
    } catch {
      console.warn(`Skipping unreadable feeds config file: ${file}`);
      continue;
    }
    if (!content.trim()) continue;

    let config: { categories?: FeedsCategory[] };
    try {
      config = JSON.parse(content);
    } catch {
      console.warn(`Skipping invalid JSON in feeds config file: ${file}`);
      continue;
    }

    if (!config.categories || !Array.isArray(config.categories)) {
      console.warn(`Skipping feeds config file with missing/invalid categories: ${file}`);
      continue;
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

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();

  // Copy landing page and _headers to build output
  await cp("client/index.html", "dist/index.html");
  await cp("client/_headers", "dist/_headers");

  console.log("building server (Workers)...");

  // Load and merge feed configs, inject via esbuild define
  const mergedConfig = loadMergedFeedsConfig();
  if (!mergedConfig.categories || mergedConfig.categories.length === 0) {
    throw new Error(
      "[gridstart] Build failed: feeds config is empty. " +
      "Ensure config/calendar-feeds.json exists and contains at least one category with series."
    );
  }
  for (const cat of mergedConfig.categories) {
    if (!cat.series || cat.series.length === 0) {
      throw new Error(
        `[gridstart] Build failed: category "${cat.name}" has no series defined.`
      );
    }
  }
  const configJson = JSON.stringify(mergedConfig);
  const configDefineValue = JSON.stringify(configJson);

  await esbuild({
    entryPoints: ["server/worker.ts"],
    platform: "neutral",
    bundle: true,
    format: "esm",
    outfile: "dist/_worker.js",
    define: {
      "globalThis.__CONFIG_FEEDS__": configDefineValue,
      "process.env.NODE_ENV": '"production"',
    },
    minify: true,
    logLevel: "info",
  });

  console.log("build complete: dist/ (static) + dist/_worker.js (server)");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
