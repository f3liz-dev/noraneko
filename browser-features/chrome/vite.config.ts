// SPDX-License-Identifier: MPL-2.0

import { defineConfig } from "vite";
import path from "node:path";
import solidPlugin from "vite-plugin-solid";
import istanbulPlugin from "vite-plugin-istanbul";
import deno from "@deno/vite-plugin";
import swc from "unplugin-swc";
import { genJarmnPlugin } from "@nora/vite-plugin-gen-jarmn";
import { createBridgeProxyPlugin } from "../../libs/vite-plugin-bridge-proxy/index.ts";

const r = (dir: string) => {
  return path.resolve(import.meta.dirname, dir);
};

export default defineConfig({
  publicDir: r("../../bridge/loader-features/public"),
  server: {
    port: 5181,
    strictPort: true,
  },

  define: {
    "import.meta.env.__BUILDID2__": '"placeholder"',
  },

  build: {
    sourcemap: true,
    reportCompressedSize: false,
    minify: false,
    cssMinify: false,
    emptyOutDir: true,
    assetsInlineLimit: 0,
    target: "firefox133",

    rollupOptions: {
      preserveEntrySignatures: "allow-extension",
      input: {
        core: r("../../bridge/loader-features/loader/index.ts"),
      },
      output: {
        esModule: true,
        entryFileNames: "[name].js",
        manualChunks(id, meta) {
          if (id.includes("node_modules")) {
            const arr_module_name = id
              .toString()
              .split("node_modules/")[1]
              .split("/");
            if (arr_module_name[0] === ".pnpm") {
              return `external/${arr_module_name[1].toString()}`;
            }
            return `external/${arr_module_name[0].toString()}`;
          }
          if (id.includes(".svg")) {
            return `svg/${id.split("/").at(-1)?.replaceAll("svg_url", "glue")}`;
          }
          try {
            const re = new RegExp(/\/core\/common\/([A-Za-z-]+)/);
            const result = re.exec(id);
            if (result?.at(1) != null) {
              return `modules/${result[1]}`;
            }
          } catch {}
        },
        assetFileNames(assetInfo) {
          if (assetInfo.name?.endsWith(".css")) {
            return "assets/[name]-[hash][extname]";
          }
          return "assets/[name]-[hash][extname]";
        },
        chunkFileNames(chunkInfo) {
          return "chunks/[name]-[hash].js";
        },
      },
    },

    outDir: r("_dist"),
  },

  plugins: [
    createBridgeProxyPlugin({
      bridgeDir: r("../../bridge/loader-features"),
      targetDir: r("."),
      bridgeType: "loader-features",
    }),

    solidPlugin({
      ssr: false,
      solid: {
        moduleName: "@nora/solid-xul",
        generate: "dom",
      },
    }),

    {
      name: "post-build-setup",
      generateBundle() {
        return null;
      },
      writeBundle() {
        const code = [
          "if (import.meta.hot) {",
          "  import.meta.hot.accept((m) => {",
          "    if(m && m.default) {",
          "      new m.default();",
          "    }",
          "  })",
          "}",
        ].join("\n");
        return { code };
      },
    },

    swc.vite({
      exclude: ["*solid-xul*", "*solid-js*"],
      jsc: {
        target: "esnext",
        parser: {
          syntax: "typescript",
          decorators: true,
        },
        transform: {
          legacyDecorator: true,
          decoratorMetadata: true,
        },
      },
    }),

    istanbulPlugin(),
    genJarmnPlugin("content", "noraneko", "content"),
  ],

  optimizeDeps: {
    include: [
      "./node_modules/@nora",
      "solid-js",
      "solid-js/web",
      "solid-js/store",
      "solid-js/html",
      "solid-js/h",
    ],
  },

  resolve: {
    dedupe: [
      "solid-js",
      "solid-js/web",
      "solid-js/store",
      "solid-js/html",
      "solid-js/h",
    ],
    preserveSymlinks: true,
    alias: [
      { find: "@nora/skin", replacement: r("../skin") },
      {
        find: "@nora/solid-xul",
        replacement: r("../../libs/solid-xul/index.ts"),
      },
      { find: "@std/toml", replacement: "@jsr/std__toml" },
      {
        find: "../../../../../shared",
        replacement: r("../../../../src/shared"),
      },
      { find: "#apps", replacement: r("../../../../apps") },
      {
        find: "#i18n",
        replacement: r("../../bridge/loader-features/link-i18n"),
      },
      {
        find: "#features-chrome",
        replacement: r("../../bridge/loader-features/link-features-chrome"),
      },
    ],
  },
});