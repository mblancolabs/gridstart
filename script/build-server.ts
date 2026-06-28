import { build as esbuild } from "esbuild";
import { rm, cp, mkdir } from "fs/promises";

async function buildServer() {
  await rm("dist/server", { recursive: true, force: true });

  console.log("building server (Node.js)...");

  await mkdir("dist/public", { recursive: true });
  await cp("client/index.html", "dist/public/index.html");

  await esbuild({
    entryPoints: ["server/production.ts"],
    platform: "node",
    target: "node20",
    bundle: true,
    format: "esm",
    outfile: "dist/server/index.js",
    logLevel: "info",
  });

  console.log("build complete: dist/server/index.js (server)");
}

buildServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
