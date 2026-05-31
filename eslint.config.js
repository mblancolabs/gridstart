import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";

const tsRules = tseslint.configs.recommended.flatMap((cfg) => {
  if (!cfg.rules) return cfg;
  return {
    ...cfg,
    rules: Object.fromEntries(
      Object.entries(cfg.rules).map(([key, val]) => {
        if (key === "@typescript-eslint/ban-ts-comment") {
          return [key, ["error", { "ts-expect-error": false }]];
        }
        return [key, val];
      }),
    ),
  };
});

export default tseslint.config(
  { ignores: ["dist/**", "coverage/**", "client/dev-dist/**", "playwright-report/**", "test-results/**", "release/**", "*.config.ts"] },
  js.configs.recommended,
  ...tsRules,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
);
