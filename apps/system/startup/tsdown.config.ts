import { defineConfig } from "tsdown/config";
import Starter from "unplugin-starter/rolldown";
import { generateJarManifest } from "../../common/scripts/gen_jarmanifest.ts";
import { resolve } from "pathe";
import { Plugin } from "rolldown";

const genJarmn = {
  name: "gen_jarmn",
  async generateBundle(options, bundle, isWrite) {
    this.emitFile({
      type: "asset",
      fileName: "jar.mn",
      source: await generateJarManifest(bundle, {
        prefix: "startup",
        namespace: "noraneko-startup",
        register_type: "content",
      }),
    });
    this.emitFile({
      type: "asset",
      fileName: "moz.build",
      source: `JAR_MANIFESTS += ["jar.mn"]`,
    });
  },
} satisfies Plugin;

console.log(Deno.args);

let mode = "";
if (!(Deno.args.at(-1)?.includes("."))) mode = Deno.args.at(-1)!;

export default [
  defineConfig({
    entry: [
      "src/chrome_root.ts",
      "src/about-preferences.ts",
      "src/about-newtab.ts",
    ],
    outDir: "_dist",
    define: {
      "import.meta.env.MODE": `"${mode}"`,
    },
    platform: "browser",
    treeshake: false,
    plugins: [genJarmn]
  }),
];
