import type { Plugin } from 'vite';

export interface ViteOxcDecoratorOptions {
  include?: RegExp | RegExp[];
  exclude?: RegExp | RegExp[];
}

interface TransformResult {
  code: string;
  map?: string;
  errors: string[];
}

interface TransformError {
  tag: 'err';
  val: string;
}

interface WasmTransformer {
  transform(filename: string, sourceText: string, options: string): TransformResult | TransformError;
}

const DEFAULT_INCLUDE = [/\.[jt]sx?$/];
const DEFAULT_EXCLUDE = [/node_modules/];
const DECORATOR_MARKER = '@';
const TRANSFORM_OPTIONS = JSON.stringify({ source_maps: true });

let wasmTransformer: WasmTransformer | null = null;

async function loadWasmTransformer(): Promise<WasmTransformer> {
  if (wasmTransformer) {
    return wasmTransformer;
  }

  try {
    const wasm = await import('../pkg/decorator_transformer.js');
    wasmTransformer = wasm as unknown as WasmTransformer;
    return wasmTransformer;
  } catch (e) {
    throw new Error(
      `Failed to load WASM transformer. Run: npm run build:wasm && npm run build:jco\nError: ${e}`
    );
  }
}

function isTransformError(result: TransformResult | TransformError): result is TransformError {
  return 'tag' in result && result.tag === 'err';
}

function normalizePatterns(pattern: RegExp | RegExp[]): RegExp[] {
  return Array.isArray(pattern) ? pattern : [pattern];
}

export default function viteOxcDecoratorStage3(
  options: ViteOxcDecoratorOptions = {}
): Plugin {
  const includePatterns = normalizePatterns(options.include ?? DEFAULT_INCLUDE);
  const excludePatterns = normalizePatterns(options.exclude ?? DEFAULT_EXCLUDE);

  const shouldTransform = (id: string): boolean => {
    return !excludePatterns.some(pattern => pattern.test(id)) &&
           includePatterns.some(pattern => pattern.test(id));
  };

  let wasmInit: Promise<WasmTransformer> | null = null;

  return {
    name: 'vite-oxc-decorator-stage-3',
    enforce: 'pre',

    async buildStart() {
      if (!wasmInit) {
        wasmInit = loadWasmTransformer();
      }
    },

    async transform(code: string, id: string) {
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
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to transform decorators in ${id}: ${message}`);
      }
    },
  };
}
