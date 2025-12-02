import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/**/*.test.ts"],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@repobox/types": path.resolve(__dirname, "../../packages/types/src"),
    },
  },
});
