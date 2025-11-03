import type { Plugin } from 'vite';
import { type TransformOptions } from '@babel/core';
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
    /**
     * Babel transform options
     */
    babel?: TransformOptions;
}
/**
 * Vite plugin for transforming Stage 3 decorators using Babel
 *
 * This plugin uses Babel's decorator plugin to transform decorators
 * following the TC39 Stage 3 proposal semantics.
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