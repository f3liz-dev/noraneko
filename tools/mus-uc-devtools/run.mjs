#!/usr/bin/env node
/**
 * Runner for mus-uc-devtools WASI binary using Node.js
 * 
 * This script runs the mus-uc-devtools WASI binary using Node.js's built-in
 * WASI support or @bytecodealliance/preview2-shim.
 * 
 * Usage:
 *   node tools/mus-uc-devtools/run.mjs -- --help
 *   node tools/mus-uc-devtools/run.mjs -- load -f style.css
 *   node tools/mus-uc-devtools/run.mjs -- screenshot -o output.png
 */

import { readFile } from 'fs/promises';
import { WASI } from 'wasi';
import { wasmPath } from './dist/index.js';

// Parse command line arguments
// Everything after '--' is passed to the WASI binary
const dashDashIndex = process.argv.indexOf('--');
const wasiArgs = dashDashIndex >= 0 
    ? ['mus-uc', ...process.argv.slice(dashDashIndex + 1)]
    : ['mus-uc', '--help'];

try {
    // Read the WASM binary
    const wasmBuffer = await readFile(wasmPath);
    
    // Create WASI instance
    const wasi = new WASI({
        version: 'preview1',
        args: wasiArgs,
        env: process.env,
        preopens: {
            '/': '/',
        },
    });
    
    // Compile and instantiate the WASM module
    const module = await WebAssembly.compile(wasmBuffer);
    const instance = await WebAssembly.instantiate(module, wasi.getImportObject());
    
    // Start the WASI instance
    wasi.start(instance);
} catch (error) {
    console.error('Error running mus-uc-devtools:', error.message);
    
    if (error.message.includes('Connection refused')) {
        console.error('\nNote: Make sure Firefox is running with Marionette enabled.');
        console.error('Set marionette.port to 2828 in about:config and restart Firefox.');
    }
    
    process.exit(1);
}
