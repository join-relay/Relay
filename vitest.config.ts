import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "server-only": path.resolve(__dirname, "tests/mocks/server-only.ts"),
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
  },
})
