import {} from "vitest";

import { join } from "path";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";
import nodePolyfill from "vite-plugin-node-stdlib-browser";

export default defineConfig({
  build: {
    outDir: "dist",
    lib: {
      entry: "src/index.ts",
      formats: ["cjs", "es"],
      fileName: "index",
    },
  },
  plugins: [
    dts({
      tsConfigFilePath: join(__dirname, "tsconfig.json"),
    }),
    nodePolyfill(),
  ],
  test: {
    globals: true,
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "http://localhost/",
      },
    },
    typecheck: {
      tsconfig: "tsconfig.test.json",
    },
    include: ["src/**.spec.{ts,tsx}"],
  },
});
