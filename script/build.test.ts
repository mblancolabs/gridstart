import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

vi.hoisted(() => {
  globalThis.__CONFIG_FEEDS__ = JSON.stringify({
    categories: [{ name: "Test", series: [] }],
  });
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

vi.mock("esbuild", () => ({ build: vi.fn().mockResolvedValue({}) }));
vi.mock("vite", () => ({ build: vi.fn().mockResolvedValue({}) }));
vi.mock("fs/promises", () => ({
  rm: vi.fn().mockResolvedValue(undefined),
  cp: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("readline", () => ({}));

describe("loadMergedFeedsConfig", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "gridstart-test-"));
    vi.spyOn(process, "cwd").mockReturnValue(tempDir);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function writeConfig(filename: string, data: unknown) {
    const dir = join(tempDir, "config");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(join(dir, filename), JSON.stringify(data));
  }

  it("loads base calendar-feeds.json", async () => {
    writeConfig("calendar-feeds.json", {
      categories: [{ name: "F1", series: [{ id: "f1", name: "Formula 1", shortName: "F1", color: "#e10600", handler: "jolpica", params: {}, enabled: true }] }],
    });

    const { loadMergedFeedsConfig } = await import("./build");
    const result = loadMergedFeedsConfig();

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe("F1");
    expect(result.categories[0].series).toHaveLength(1);
    expect(result.categories[0].series[0].id).toBe("f1");
  });

  it("merges overlay files on top of base config", async () => {
    writeConfig("calendar-feeds.json", {
      categories: [{ name: "F1", series: [{ id: "f1", name: "Formula 1", shortName: "F1", color: "#e10600", handler: "jolpica", params: {}, enabled: true }] }],
    });
    writeConfig("calendar-feeds.local.json", {
      categories: [{ name: "F1", series: [{ id: "f1", name: "Formula 1 Override", shortName: "F1", color: "#e10600", handler: "jolpica", params: {}, enabled: true }] }],
    });

    const { loadMergedFeedsConfig } = await import("./build");
    const result = loadMergedFeedsConfig();

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].series[0].name).toBe("Formula 1 Override");
  });

  it("merges series from multiple overlay files", async () => {
    writeConfig("calendar-feeds.json", {
      categories: [{ name: "Series", series: [] }],
    });
    writeConfig("calendar-feeds.a.json", {
      categories: [{ name: "Series", series: [{ id: "s1", name: "Series 1", shortName: "S1", color: "#000", handler: "ics", params: {}, enabled: true }] }],
    });
    writeConfig("calendar-feeds.b.json", {
      categories: [{ name: "Series", series: [{ id: "s2", name: "Series 2", shortName: "S2", color: "#fff", handler: "ics", params: {}, enabled: true }] }],
    });

    const { loadMergedFeedsConfig } = await import("./build");
    const result = loadMergedFeedsConfig();

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].series).toHaveLength(2);
    expect(result.categories[0].series.map((s: { id: string }) => s.id).sort()).toEqual(["s1", "s2"]);
  });

  it("skips unreadable files with a warning", async () => {
    writeConfig("calendar-feeds.json", {
      categories: [{ name: "Test", series: [{ id: "t1", name: "Test", shortName: "T", color: "#000", handler: "ics", params: {}, enabled: true }] }],
    });
    // Create an unreadable file
    const configDir = join(tempDir, "config");
    writeFileSync(join(configDir, "calendar-feeds.unreadable.json"), "garbage but readable");
    // This file exists and is readable, just contains garbage

    const { loadMergedFeedsConfig } = await import("./build");
    const result = loadMergedFeedsConfig();

    // Base file should still load
    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].series[0].id).toBe("t1");
  });

  it("handles empty config files gracefully", async () => {
    writeConfig("calendar-feeds.json", {
      categories: [],
    });

    const { loadMergedFeedsConfig } = await import("./build");
    const result = loadMergedFeedsConfig();

    expect(result.categories).toEqual([]);
  });

  it("throws when the config directory is missing", async () => {
    const { loadMergedFeedsConfig } = await import("./build");
    expect(() => loadMergedFeedsConfig()).toThrow();
  });

  it("ignores non-matching files in config dir", async () => {
    writeConfig("calendar-feeds.json", {
      categories: [{ name: "Core", series: [{ id: "c1", name: "Core", shortName: "C", color: "#000", handler: "ics", params: {}, enabled: true }] }],
    });
    writeConfig("other-config.json", {
      categories: [{ name: "Other", series: [] }],
    });

    const { loadMergedFeedsConfig } = await import("./build");
    const result = loadMergedFeedsConfig();

    expect(result.categories).toHaveLength(1);
    expect(result.categories[0].name).toBe("Core");
  });
});
