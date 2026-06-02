import "./dev-setup";
import { serve } from "@hono/node-server";
import app from "./app";

const port = parseInt(process.env.PORT || "5000", 10);

app.get("*", (c) =>
  c.html(`<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8"><title>GridStart — Dev Servers</title></head>
  <body style="font-family:system-ui;padding:2rem;max-width:32rem;">
    <h1>GridStart Dev Servers</h1>
    <p>✅ API server on this port (<strong>${port}</strong>).</p>
    <p>🚀 Frontend dev server at <a href="http://localhost:5173"><strong>http://localhost:5173</strong></a>.</p>
    <p><a href="http://localhost:5173" style="display:inline-block;margin-top:1rem;padding:0.5rem 1rem;background:#0055ff;color:#fff;text-decoration:none;border-radius:6px;">Open the app →</a></p>
  </body>
</html>`),
);

console.log(`[gridstart] API server on http://localhost:${port}`);
console.log(`[gridstart] frontend dev server on http://localhost:5173`);

serve({
  fetch: app.fetch,
  port,
});
