import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import { validateFilePath, safeLoadJsonFile } from "../utils";

describe("validateFilePath", () => {
  const allowedDir = "/tmp/allowed";

  it("allows paths within allowed directory", () => {
    const filePath = path.join(allowedDir, "file.json");
    expect(validateFilePath(filePath, allowedDir)).toBe(true);
  });

  it("rejects paths outside allowed directory", () => {
    const filePath = "/tmp/other/file.json";
    expect(validateFilePath(filePath, allowedDir)).toBe(false);
  });

  it("rejects path traversal attempts with ..", () => {
    const filePath = path.join(allowedDir, "../../../outside/file.json");
    expect(validateFilePath(filePath, allowedDir)).toBe(false);
  });

  it("rejects paths with .. that escape the directory", () => {
    const filePath = path.join(allowedDir, "safe/../../../outside/file.json");
    expect(validateFilePath(filePath, allowedDir)).toBe(false);
  });

  it("allows normalized paths", () => {
    const filePath = path.join(allowedDir, "./file.json");
    expect(validateFilePath(filePath, allowedDir)).toBe(true);
  });

  it("handles Windows-style path traversal", () => {
    const filePath = path.join(allowedDir, "..\\outside\\file.json");
    expect(validateFilePath(filePath, allowedDir)).toBe(false);
  });
});

describe("safeLoadJsonFile", () => {
  const testDir = "/tmp/test-json";
  const allowedDir = testDir;
  const validFile = path.join(testDir, "valid.json");
  const invalidFile = path.join(testDir, "invalid.json");
  const missingFile = path.join(testDir, "missing.json");
  const outsideFile = "/tmp/outside.json";

  beforeEach(() => {
    // Create test directory
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }

    // Create valid JSON file
    fs.writeFileSync(validFile, '{"test": "data", "number": 42}');

    // Create invalid JSON file
    fs.writeFileSync(invalidFile, '{"invalid": json}');
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(validFile)) fs.unlinkSync(validFile);
    if (fs.existsSync(invalidFile)) fs.unlinkSync(invalidFile);
    if (fs.existsSync(testDir)) fs.rmSync(testDir, { recursive: true });
  });

  it("loads and parses valid JSON file", () => {
    const result = safeLoadJsonFile(validFile, allowedDir);
    expect(result).toEqual({ test: "data", number: 42 });
  });

  it("throws error for invalid JSON", () => {
    expect(() => safeLoadJsonFile(invalidFile, allowedDir)).toThrow("Invalid JSON in file");
  });

  it("throws error for missing file", () => {
    expect(() => safeLoadJsonFile(missingFile, allowedDir)).toThrow("File not found");
  });

  it("throws error for path outside allowed directory", () => {
    expect(() => safeLoadJsonFile(outsideFile, allowedDir)).toThrow("Invalid file path");
  });

  it("throws error for path traversal attempt", () => {
    const traversalPath = path.join(testDir, "../outside.json");
    expect(() => safeLoadJsonFile(traversalPath, allowedDir)).toThrow("Invalid file path");
  });
});