// SPDX-License-Identifier: MPL-2.0

import { defineConfig } from "tsdown";
import { genJarmnPlugin } from "../../libs/vite-plugin-gen-jarmn/plugin.ts";
import path from "node:path";

const r = (dir: string) => {
  return path.resolve(import.meta.dirname, dir);
};

export default defineConfig({
  entry: [r("./**/*.mts")],
  outDir: "_dist",
  format: "esm",
  target: "esnext",
  external: /^resource:\/\/|^chrome:\/\//,
  plugins: [genJarmnPlugin("resource", "noraneko", "resource")],
});
