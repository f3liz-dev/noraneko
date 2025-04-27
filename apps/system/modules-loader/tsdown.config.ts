import { expandGlob } from "@jsr/std__fs/expand-glob";
import { defineConfig } from "tsdown";
import deno from "@deno/vite-plugin";
import { relative } from "pathe";

const entry = [];
for await (
  const x of expandGlob("../../modules/**/*.mts")
) {
  entry.push(relative(import.meta.dirname, x.path));
}

console.log(entry);

export default defineConfig({
  entry,
  target: "esnext",
});
