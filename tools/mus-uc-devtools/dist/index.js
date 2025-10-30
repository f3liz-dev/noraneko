/**
 * mus-uc-devtools wrapper for noraneko
 * 
 * Provides access to vendored mus-uc-devtools WASI binary
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Export the path to the WASI binary for programmatic use
export const wasmPath = resolve(__dirname, 'mus-uc.wasm');
export const wasmBuffer = () => readFileSync(resolve(__dirname, 'mus-uc.wasm'));

