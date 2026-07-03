import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "server"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    root: path.resolve(import.meta.dirname, "."),
    environment: "node",
    globals: true,
    include: ["server/**/*.{test,spec}.{ts,tsx}", "script/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      reportsDirectory: "./coverage",
      exclude: ["server/test"],
      thresholds: {
        statements: 80,
        branches: 60,
        functions: 85,
        lines: 85,
      },
    },
  },
});
