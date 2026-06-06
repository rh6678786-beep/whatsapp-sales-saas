import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    include: ["backend/__tests__/**/*.test.ts", "src/__tests__/**/*.test.tsx"],
    environment: "jsdom",
    // @ts-expect-error - valid at runtime in Vitest 4 despite not being in types
    environmentMatchGlobs: [
      ["backend/__tests__/**/*.test.ts", "node"],
    ],
    setupFiles: ["backend/__tests__/vitest.setup.ts", "src/__tests__/vitest.setup.ts"],
    testTimeout: 20000,
    css: true,
    globals: true,
    coverage: {
      provider: "v8",
      enabled: true,
      include: ["backend/**/*.ts", "src/**/*.tsx"],
      exclude: [
        "backend/__tests__/**",
        "src/__tests__/**",
        "**/*.test.ts",
        "**/*.test.tsx",
        "**/*.d.ts",
        "backend/lib/seed.ts",
      ],
      thresholds: {
        statements: 20,
        branches: 17,
        functions: 20,
        lines: 20,
      },
    },
  },
  resolve: {
    alias: {
      "@": "/src",
    },
  },
});
