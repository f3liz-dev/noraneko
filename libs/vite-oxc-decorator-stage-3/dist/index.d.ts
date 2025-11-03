import type { Plugin } from 'vite';
export interface ViteOxcDecoratorOptions {
    /**
     * Include files matching these patterns.
     * @default [/\.[jt]sx?$/]
     */
    include?: RegExp | RegExp[];
    /**
     * Exclude files matching these patterns.
     * @default [/node_modules/]
     */
    exclude?: RegExp | RegExp[];
}
/**
 * Vite plugin for transforming Stage 3 decorators using oxc WASM transformer
 *
 * This plugin uses a Rust/WASM Component Model transformer built with oxc
 * to transform decorators following the TC39 Stage 3 proposal semantics.
 *
 * @example
 * ```ts
 * import { defineConfig } from 'vite';
 * import decorators from 'vite-oxc-decorator-stage-3';
 *
 * export default defineConfig({
 *   plugins: [decorators()],
 * });
 * ```
 */
export default function viteOxcDecoratorStage3(options?: ViteOxcDecoratorOptions): Plugin;
//# sourceMappingURL=index.d.ts.map