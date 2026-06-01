import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["backend/__tests__/**/*.test.ts"],
    environment: "node",
    setupFiles: [],
    testTimeout: 10000,
  },
});
