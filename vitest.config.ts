import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["frontend/**/*.test.ts"],
  },
  resolve: {
    alias: {
      // plugin-opener isn't a kit dev dependency (the consuming app provides it
      // at runtime). Stub it so the kit's own suites load without a Tauri runtime.
      "@tauri-apps/plugin-opener": fileURLToPath(
        new URL("./frontend/test-stubs/plugin-opener.ts", import.meta.url),
      ),
    },
  },
});
