import path from "node:path";
import { fileURLToPath } from "node:url";

export interface FeedEndpoint {
  series: string;
  path: string;
  handler: string;
  allowEmpty?: boolean;
}

export interface CheckResult {
  series: string;
  handler: string;
  ok: boolean;
  status?: number;
  eventCount?: number;
  durationMs: number;
  expectedEmpty?: boolean;
  error?: string;
}

export const endpoints: FeedEndpoint[] = [
  { series: "f1", path: "/api/events?series=f1", handler: "jolpica" },
  { series: "motogp", path: "/api/events?series=motogp", handler: "motogp" },
  { series: "wec", path: "/api/events?series=wec", handler: "ics" },
  { series: "indycar", path: "/api/events?series=indycar", handler: "ecal", allowEmpty: true },
  { series: "f2", path: "/api/events?series=f2", handler: "ecal" },
];

export async function checkEndpoint(endpoint: FeedEndpoint, productionUrl: string): Promise<CheckResult> {
  const url = `${productionUrl}${endpoint.path}`;
  const start = Date.now();

  try {
    const res = await fetch(url);
    const durationMs = Date.now() - start;

    if (res.status !== 200) {
      return {
        series: endpoint.series,
        handler: endpoint.handler,
        ok: false,
        status: res.status,
        durationMs,
        error: `Expected HTTP 200, got ${res.status}`,
      };
    }

    const body = await res.json();

    if (!Array.isArray(body)) {
      return {
        series: endpoint.series,
        handler: endpoint.handler,
        ok: false,
        status: res.status,
        durationMs,
        error: "Response is not a JSON array",
      };
    }

    if (body.length === 0 && !endpoint.allowEmpty) {
      return {
        series: endpoint.series,
        handler: endpoint.handler,
        ok: false,
        status: res.status,
        eventCount: 0,
        durationMs,
        error: "Response array is empty",
      };
    }

    return {
      series: endpoint.series,
      handler: endpoint.handler,
      ok: true,
      status: res.status,
      eventCount: body.length,
      durationMs,
      ...(body.length === 0 && endpoint.allowEmpty ? { expectedEmpty: true } : {}),
    };
  } catch (err) {
    return {
      series: endpoint.series,
      handler: endpoint.handler,
      ok: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function checkFeeds(
  productionUrl: string,
  feedEndpoints: FeedEndpoint[] = endpoints,
): Promise<CheckResult[]> {
  const results: CheckResult[] = [];

  for (const endpoint of feedEndpoints) {
    results.push(await checkEndpoint(endpoint, productionUrl));
  }

  return results;
}

async function main() {
  const productionUrl = process.env.PRODUCTION_URL;

  if (!productionUrl) {
    console.error(JSON.stringify({ error: "PRODUCTION_URL environment variable is not set" }));
    process.exitCode = 1;
    return;
  }

  const results = await checkFeeds(productionUrl);
  for (const result of results) {
    console.log(JSON.stringify(result));
  }

  const failed = results.filter((result) => !result.ok);
  if (failed.length > 0) {
    console.error(JSON.stringify({ error: `${failed.length} feed check(s) failed` }));
    process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] !== undefined && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isDirectExecution) {
  await main();
}
