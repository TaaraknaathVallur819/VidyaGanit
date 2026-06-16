import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // Workspace packages export raw .ts source; inline them so Vitest transforms
    // them instead of treating them as externalized (CJS) node_modules.
    server: {
      deps: {
        inline: [/@workspace\//],
      },
    },
  },
  resolve: {
    conditions: ["workspace", "import", "node"],
  },
});
