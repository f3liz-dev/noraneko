import type { Plugin } from 'vite';
import { transformAsync, type TransformOptions } from '@babel/core';
// @ts-expect-error - Babel plugin types
import decoratorsPlugin from '@babel/plugin-proposal-decorators';

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
 * Regex pattern to detect decorator usage in code.
 * Matches decorators before:
 * - Class declarations: @decorator class / @decorator export class
 * - Method/property modifiers: @decorator static, async, get, set, private, public, protected, readonly
 * This helps avoid transforming files that only contain '@' in comments or strings.
 */
const DECORATOR_PATTERN = /@\w+(\(|\s+(export\s+)?(class|static|async|get|set|private|public|protected|readonly))/m;

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
export default function viteOxcDecoratorStage3(
  options: ViteOxcDecoratorOptions = {}
): Plugin {
  const {
    include = [/\.[jt]sx?$/],
    exclude = [/node_modules/],
    babel = {},
  } = options;

  const includePatterns = Array.isArray(include) ? include : [include];
  const excludePatterns = Array.isArray(exclude) ? exclude : [exclude];

  const shouldTransform = (id: string): boolean => {
    // Check exclude patterns first
    if (excludePatterns.some((pattern) => pattern.test(id))) {
      return false;
    }
    // Check include patterns
    return includePatterns.some((pattern) => pattern.test(id));
  };

  return {
    name: 'vite-oxc-decorator-stage-3',

    enforce: 'pre', // Run before other plugins

    async transform(code: string, id: string) {
      if (!shouldTransform(id)) {
        return null;
      }

      // Check if code contains actual class decorators (simple heuristic)
      // Look for decorators before class/method/property declarations
      if (!DECORATOR_PATTERN.test(code)) {
        return null;
      }

      // Use Babel transformer
      try {
        const result = await transformAsync(code, {
          filename: id,
          sourceMaps: true,
          sourceFileName: id,
          parserOpts: {
            sourceType: 'module',
            plugins: ['typescript', 'decorators'],
          },
          plugins: [
            [
              decoratorsPlugin,
              {
                version: '2023-11', // Stage 3 decorators
              },
            ],
          ],
          ...babel,
        });

        if (!result || !result.code) {
          return null;
        }

        return {
          code: result.code,
          map: result.map,
        };
      } catch (error) {
        // Transformation failed - this is a critical error since we detected decorators
        // Throwing ensures the build fails rather than silently producing incorrect code
        console.error(`Failed to transform decorators in ${id}:`, error);
        throw error;
      }
    },
  };
}
