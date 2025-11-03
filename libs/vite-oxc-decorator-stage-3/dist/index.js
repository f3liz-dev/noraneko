let wasmTransformer = null;
/**
 * Load the WASM transformer module (jco-generated)
 */
async function loadWasmTransformer() {
    if (wasmTransformer) {
        return wasmTransformer;
    }
    try {
        // Load the jco-generated WASM Component
        const wasm = await import('../pkg/decorator_transformer.js');
        wasmTransformer = wasm;
        return wasmTransformer;
    }
    catch (e) {
        throw new Error(`Failed to load WASM transformer. ` +
            `Please build the WASM module first: npm run build:wasm && npm run build:jco\n` +
            `Error: ${e}`);
    }
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
export default function viteOxcDecoratorStage3(options = {}) {
    const { include = [/\.[jt]sx?$/], exclude = [/node_modules/], } = options;
    const includePatterns = Array.isArray(include) ? include : [include];
    const excludePatterns = Array.isArray(exclude) ? exclude : [exclude];
    const shouldTransform = (id) => {
        // Check exclude patterns first
        if (excludePatterns.some((pattern) => pattern.test(id))) {
            return false;
        }
        // Check include patterns
        return includePatterns.some((pattern) => pattern.test(id));
    };
    let wasmInit = null;
    return {
        name: 'vite-oxc-decorator-stage-3',
        enforce: 'pre', // Run before other plugins
        async buildStart() {
            // Initialize WASM transformer
            if (!wasmInit) {
                wasmInit = loadWasmTransformer();
            }
        },
        async transform(code, id) {
            if (!shouldTransform(id)) {
                return null;
            }
            // Check if code contains decorators
            if (!code.includes('@')) {
                return null;
            }
            // Load WASM transformer
            const wasm = await wasmInit;
            if (!wasm) {
                throw new Error('WASM transformer not initialized');
            }
            try {
                // Call Component Model transform function
                const options = JSON.stringify({ source_maps: true });
                const result = wasm.transform(id, code, options);
                // Check if result is an error (Component Model Result type)
                if (typeof result === 'object' && 'tag' in result && result.tag === 'err') {
                    throw new Error(`WASM transformer error in ${id}: ${result.val}`);
                }
                const transformResult = result;
                // Check for transformation errors
                if (transformResult.errors.length > 0) {
                    throw new Error(`WASM transformer errors in ${id}:\n${transformResult.errors.join('\n')}`);
                }
                return {
                    code: transformResult.code,
                    map: transformResult.map ? JSON.parse(transformResult.map) : null,
                };
            }
            catch (error) {
                // Re-throw with better context
                if (error instanceof Error) {
                    throw new Error(`Failed to transform decorators in ${id}: ${error.message}`);
                }
                throw error;
            }
        },
    };
}
