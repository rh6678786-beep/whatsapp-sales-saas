import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["backend/__tests__/**/*.test.ts"],
    environment: "node",
    setupFiles: ["backend/__tests__/vitest.setup.ts"],
    testTimeout: 10000,
  },
});
