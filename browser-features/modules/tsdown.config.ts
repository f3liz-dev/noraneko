// SPDX-License-Identifier: MPL-2.0

import { defineConfig } from "tsdown";
import { genJarmnPlugin } from "@nora/vite-plugin-gen-jarmn";
import path from "node:path";

const r = (dir: string) => {
  return path.resolve(import.meta.dirname, dir);
};

export default defineConfig({
  entry: [r("../../bridge/loader-modules/link-modules/**/*.mts")],
  outDir: r("_dist"),
  format: "esm",
  target: "esnext",
  external: /^resource:\/\/|^chrome:\/\//,
  plugins: [genJarmnPlugin("resource", "noraneko", "resource")],
});