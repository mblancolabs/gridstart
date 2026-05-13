import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    root: path.resolve(import.meta.dirname, "."),
    environment: "node",
    include: ["server/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["client/**/*", "node_modules/**"],
  },
});
