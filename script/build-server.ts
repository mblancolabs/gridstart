import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, cp } from "fs/promises";

async function buildServer() {
  await rm("dist/server", { recursive: true, force: true });

  console.log("building client...");
  await viteBuild();
  await cp("client/index.html", "dist/public/index.html");

  console.log("building server (Node.js)...");

  await esbuild({
    entryPoints: ["server/production.ts"],
    platform: "node",
    target: "node20",
    bundle: true,
    format: "esm",
    outfile: "dist/server/index.js",
    logLevel: "info",
  });

  console.log("build complete: dist/public/ (static) + dist/server/index.js (server)");
}

buildServer().catch((err) => {
  console.error(err);
  process.exit(1);
});
