const PRODUCTION_URL = process.env.PRODUCTION_URL;

if (!PRODUCTION_URL) {
  console.error(JSON.stringify({ error: "PRODUCTION_URL environment variable is not set" }));
  process.exit(1);
}

const endpoints = [
  { series: "f1", path: "/api/events?series=f1", handler: "jolpica" },
  { series: "motogp", path: "/api/events?series=motogp", handler: "motogp" },
  { series: "wec", path: "/api/events?series=wec", handler: "ics" },
  { series: "indycar", path: "/api/events?series=indycar", handler: "ecal" },
];

interface CheckResult {
  series: string;
  handler: string;
  ok: boolean;
  status?: number;
  eventCount?: number;
  durationMs: number;
  error?: string;
}

const results: CheckResult[] = [];

for (const endpoint of endpoints) {
  const url = `${PRODUCTION_URL}${endpoint.path}`;
  const start = Date.now();

  try {
    const res = await fetch(url);
    const durationMs = Date.now() - start;

    if (res.status !== 200) {
      results.push({
        series: endpoint.series,
        handler: endpoint.handler,
        ok: false,
        status: res.status,
        durationMs,
        error: `Expected HTTP 200, got ${res.status}`,
      });
      continue;
    }

    const body = await res.json();

    if (!Array.isArray(body)) {
      results.push({
        series: endpoint.series,
        handler: endpoint.handler,
        ok: false,
        status: res.status,
        durationMs,
        error: "Response is not a JSON array",
      });
      continue;
    }

    if (body.length === 0) {
      results.push({
        series: endpoint.series,
        handler: endpoint.handler,
        ok: false,
        status: res.status,
        eventCount: 0,
        durationMs,
        error: "Response array is empty",
      });
      continue;
    }

    results.push({
      series: endpoint.series,
      handler: endpoint.handler,
      ok: true,
      status: res.status,
      eventCount: body.length,
      durationMs,
    });
  } catch (err) {
    results.push({
      series: endpoint.series,
      handler: endpoint.handler,
      ok: false,
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

for (const r of results) {
  console.log(JSON.stringify(r));
}

const failed = results.filter((r) => !r.ok);
if (failed.length > 0) {
  console.error(JSON.stringify({ error: `${failed.length} feed check(s) failed` }));
  process.exit(1);
}
