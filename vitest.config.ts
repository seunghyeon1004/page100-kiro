import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    exclude: ["test/e2e/**", "node_modules/**"],
    environment: "node",
    // test/grid/repertoire.test.ts loops over 1.1 million values and can pass 5 s when the suites run in parallel.
    testTimeout: 30_000,
  },
});
