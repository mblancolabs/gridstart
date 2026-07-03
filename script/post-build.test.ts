import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "fs";
import { join } from "path";

const distDir = join(import.meta.dirname, "..", "dist");

describe.runIf(existsSync(distDir))("Post-build smoke test", () => {
  it("produces dist/_worker.js", () => {
    const workerPath = join(distDir, "_worker.js");
    expect(existsSync(workerPath)).toBe(true);
    const content = readFileSync(workerPath, "utf-8");
    expect(content.length).toBeGreaterThan(0);
  });

  it("produces dist/index.html", () => {
    const htmlPath = join(distDir, "index.html");
    expect(existsSync(htmlPath)).toBe(true);
  });

  it("produces dist/assets/ with at least one JS bundle", () => {
    const assetsDir = join(distDir, "assets");
    expect(existsSync(assetsDir)).toBe(true);
    const files = readdirSync(assetsDir);
    expect(files.some((f: string) => f.endsWith(".js"))).toBe(true);
  });

  it("has no inline script tags in built HTML", () => {
    const htmlPath = join(distDir, "index.html");
    const html = readFileSync(htmlPath, "utf-8");

    const inlineScriptPattern = /<script\b(?!\s*[^>]*\bsrc\s*=)/gi;
    const matches = html.match(inlineScriptPattern);
    expect(matches).toBeNull();
  });

  it("loads successfully as a JavaScript module", async () => {
    const workerPath = join(distDir, "_worker.js");
    const content = readFileSync(workerPath, "utf-8");

    expect(content).toMatch(/export\s*\{/);
    expect(content).toContain("fetch");
  });

  it("has references only to same-origin scripts in built HTML", () => {
    const htmlPath = join(distDir, "index.html");
    const html = readFileSync(htmlPath, "utf-8");

    const scriptSrcPattern = /<script[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
    let match;
    const srcs: string[] = [];
    while ((match = scriptSrcPattern.exec(html)) !== null) {
      srcs.push(match[1]);
    }

    for (const src of srcs) {
      expect(src.startsWith("/")).toBe(true);
    }
  });
});
