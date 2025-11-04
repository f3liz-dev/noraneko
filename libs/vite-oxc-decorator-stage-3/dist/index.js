const DEFAULT_INCLUDE = [/\.[jt]sx?$/];
const DEFAULT_EXCLUDE = [/node_modules/];
const DECORATOR_MARKER = '@';
const TRANSFORM_OPTIONS = JSON.stringify({ source_maps: true });
let wasmTransformer = null;
async function loadWasmTransformer() {
    if (wasmTransformer) {
        return wasmTransformer;
    }
    try {
        const wasm = await import('../pkg/decorator_transformer.js');
        wasmTransformer = wasm;
        return wasmTransformer;
    }
    catch (e) {
        throw new Error(`Failed to load WASM transformer. Run: npm run build:wasm && npm run build:jco\nError: ${e}`);
    }
}
function isTransformError(result) {
    return 'tag' in result && result.tag === 'err';
}
function normalizePatterns(pattern) {
    return Array.isArray(pattern) ? pattern : [pattern];
}
export default function viteOxcDecoratorStage3(options = {}) {
    const includePatterns = normalizePatterns(options.include ?? DEFAULT_INCLUDE);
    const excludePatterns = normalizePatterns(options.exclude ?? DEFAULT_EXCLUDE);
    const shouldTransform = (id) => {
        return !excludePatterns.some(pattern => pattern.test(id)) &&
            includePatterns.some(pattern => pattern.test(id));
    };
    let wasmInit = null;
    return {
        name: 'vite-oxc-decorator-stage-3',
        enforce: 'pre',
        async buildStart() {
            if (!wasmInit) {
                wasmInit = loadWasmTransformer();
            }
        },
        async transform(code, id) {
            if (!shouldTransform(id) || !code.includes(DECORATOR_MARKER)) {
                return null;
            }
            const wasm = await wasmInit;
            if (!wasm) {
                throw new Error('WASM transformer not initialized');
            }
            try {
                const result = wasm.transform(id, code, TRANSFORM_OPTIONS);
                if (isTransformError(result)) {
                    throw new Error(`Transformer error: ${result.val}`);
                }
                if (result.errors.length > 0) {
                    throw new Error(`Transformation errors:\n${result.errors.join('\n')}`);
                }
                return {
                    code: result.code,
                    map: result.map ? JSON.parse(result.map) : null,
                };
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                throw new Error(`Failed to transform decorators in ${id}: ${message}`);
            }
        },
    };
}
