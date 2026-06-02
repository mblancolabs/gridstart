import "./prod-setup";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import app from "./app";

const port = parseInt(process.env.PORT || "3000", 10);

app.get("/*", serveStatic({ root: "./dist/public" }));

serve({
  fetch: app.fetch,
  port,
});

console.log(`[gridstart] serving on port ${port}`);
