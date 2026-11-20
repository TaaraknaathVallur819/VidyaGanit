import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Compile JSX the same way the app does, so components can be rendered in tests.
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
