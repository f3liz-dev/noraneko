# mus-uc-devtools Integration Summary

This document summarizes the integration of mus-uc-devtools into the Noraneko browser project.

## What was done

### 1. Vendored mus-uc-devtools binaries

Built and vendored the mus-uc-devtools project in `tools/mus-uc-devtools/dist/`:

- **WASI binary** (`mus-uc.wasm`, 796 KB) - CLI tool compiled to WebAssembly
- **wasm-pack build** (`mus_uc_devtools_bg.wasm`) - Library interface
- **Node.js wrapper** (`index.js`) - ESM module for programmatic access
- **Package metadata** (`package.json`) - Module configuration
- **Documentation** (`README.md`, `LICENSE`)

### 2. Created test infrastructure

Added comprehensive tests in `tests/` directory:

- **integration-test.mjs** - Validates vendored binaries are accessible and working
- **browser-test-example.mjs** - Demonstrates how to use mus-uc-devtools for browser testing
- **README.md** - Documentation for test structure and usage

### 3. Added utilities

Created helper scripts for easy usage:

- **tools/mus-uc-devtools/run.mjs** - Node.js runner for the WASI binary
  - Uses Node.js built-in WASI support
  - Supports all mus-uc-devtools commands
  - Provides helpful error messages

### 4. Integrated with build system

- Added `npm test` script to `package.json`
- Added `deno task test` to `deno.json` for feles-build integration
- Updated `.gitignore` to include vendored binaries

## How to use

### Running tests

```bash
# Using npm
npm test

# Using deno
deno task test
```

### Using mus-uc-devtools CLI

```bash
# Show help
node tools/mus-uc-devtools/run.mjs -- --help

# Load CSS into Firefox
node tools/mus-uc-devtools/run.mjs -- load -f userChrome.css

# Take a screenshot
node tools/mus-uc-devtools/run.mjs -- screenshot -o output.png

# Execute JavaScript in Firefox chrome context
node tools/mus-uc-devtools/run.mjs -- exec -f script.js

# Watch CSS file for changes
node tools/mus-uc-devtools/run.mjs -- watch -f style.css
```

### Programmatic usage

```javascript
import { wasmPath, wasmBuffer } from './tools/mus-uc-devtools/dist/index.js';

// Get path to WASM binary
console.log(wasmPath);

// Load WASM buffer
const buffer = wasmBuffer();
```

## Requirements

- Node.js 18+ (for WASM and WASI support)
- For functional tests: Firefox with Marionette enabled
  - Set `marionette.port` to `2828` in `about:config`
  - Restart Firefox

## Integration with feles-build

The tests can be run as part of the feles-build workflow:

```bash
deno task test
```

Future integration points:
- Pre-build validation
- Post-build smoke tests
- CI/CD pipeline integration

## What mus-uc-devtools provides

mus-uc-devtools is a tool for developing userChrome CSS for Firefox using the Marionette protocol:

- **CSS injection** - Load CSS into Firefox chrome context
- **Screenshot capture** - Take screenshots of browser UI
- **JavaScript execution** - Run JS in Firefox chrome context
- **Chrome manifest** - Support for chrome:// URIs in CSS
- **Watch mode** - Auto-reload CSS on file changes

## Future work

1. Add functional tests that run with Firefox
2. Create CSS injection tests
3. Add screenshot comparison tests
4. Integrate with CI/CD for automated testing
5. Add visual regression testing

## References

- [mus-uc-devtools repository](https://github.com/f3liz-dev/mus-uc-devtools)
- [Firefox Marionette Protocol](https://firefox-source-docs.mozilla.org/testing/marionette/)
- [WebAssembly WASI](https://wasi.dev/)
