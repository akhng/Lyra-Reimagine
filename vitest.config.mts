import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"],
          setupFiles: ["tests/setup/server-only.ts"],
        },
      },
      {
        test: {
          name: "db",
          environment: "node",
          include: ["tests/db/**/*.test.ts"],
          // Local Supabase stack: run serially.
          fileParallelism: false,
          testTimeout: 30_000,
          setupFiles: ["tests/setup/server-only.ts", "tests/setup/db-env.ts"],
        },
      },
    ],
  },
});
