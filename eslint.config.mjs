import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores(["**/.next/**", "**/node_modules/**", "**/next-env.d.ts", "packages/platform/src/database.ts", "**/playwright-report/**", "**/test-results/**"]),
  {
    settings: { next: { rootDir: "apps/pet" } },
    rules: {
      "no-console": ["error", { allow: ["error"] }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
    },
  },
]);
