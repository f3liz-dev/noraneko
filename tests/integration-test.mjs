#!/usr/bin/env node
/**
 * Basic integration test for noraneko browser using mus-uc-devtools
 * 
 * This test verifies that the mus-uc-devtools integration works correctly
 * by checking that the WASI binary and wasm-pack modules are accessible.
 * 
 * For now, this is a smoke test to ensure the vendored binaries work.
 */

import { strict as assert } from 'assert';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('Running mus-uc-devtools integration test...\n');

// Test 1: Verify vendored binaries exist
console.log('1. Checking vendored mus-uc-devtools binaries...');
const distPath = join(__dirname, '../tools/mus-uc-devtools/dist');

assert(existsSync(distPath), 'dist directory should exist');
assert(existsSync(join(distPath, 'package.json')), 'package.json should exist');
assert(existsSync(join(distPath, 'mus-uc.wasm')), 'WASI binary should exist');
assert(existsSync(join(distPath, 'mus_uc_devtools_bg.wasm')), 'wasm-pack WASM should exist');
assert(existsSync(join(distPath, 'index.js')), 'index.js wrapper should exist');
console.log('   ✓ All expected files found');

// Test 2: Load the package.json and verify basic metadata
console.log('\n2. Verifying package metadata...');
const pkgJsonPath = join(distPath, 'package.json');
const pkgContent = readFileSync(pkgJsonPath, 'utf-8');
const pkg = JSON.parse(pkgContent);

assert(pkg.name === 'mus-uc-devtools', 'Package name should be mus-uc-devtools');
assert(pkg.version, 'Package should have a version');
console.log(`   ✓ Package: ${pkg.name}@${pkg.version}`);

// Test 3: Verify WASI binary can be accessed
console.log('\n3. Testing WASI binary access...');
const wasmPath = join(distPath, 'mus-uc.wasm');
const wasmStats = await import('fs').then(fs => fs.promises.stat(wasmPath));
assert(wasmStats.size > 0, 'WASI binary should have content');
console.log(`   ✓ WASI binary found (${(wasmStats.size / 1024).toFixed(1)} KB)`);

// Test 4: Test the index.js wrapper
console.log('\n4. Testing index.js wrapper...');
const indexPath = join(distPath, 'index.js');
const musUcDevtools = await import(indexPath);
assert(musUcDevtools.wasmPath, 'wasmPath should be exported');
assert(typeof musUcDevtools.wasmBuffer === 'function', 'wasmBuffer should be a function');
console.log(`   ✓ Wrapper exports correct API`);
console.log(`   WASM path: ${musUcDevtools.wasmPath}`);

// Test 5: Verify WASM buffer can be read
console.log('\n5. Testing WASM buffer loading...');
const buffer = musUcDevtools.wasmBuffer();
assert(buffer instanceof Buffer, 'Should return a Buffer');
assert(buffer.length > 0, 'Buffer should have content');
console.log(`   ✓ WASM buffer loaded successfully (${(buffer.length / 1024).toFixed(1)} KB)`);

console.log('\n✅ All integration tests passed!');
console.log('\nNext steps:');
console.log('  - Add functional tests with Firefox + Marionette');
console.log('  - Integrate with feles-build for automated testing');
console.log('  - Add CSS injection and screenshot tests');
