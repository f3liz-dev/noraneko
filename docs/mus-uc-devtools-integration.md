# mus-uc-devtools Integration Summary

This document summarizes the integration of mus-uc-devtools into the Noraneko browser project as a **JavaScript executor for testing browser-chrome UI code** via Firefox Marionette protocol.

## Purpose

The primary purpose of this integration is to enable **automated testing of Noraneko's browser UI components** by executing JavaScript in Firefox chrome context. This allows us to:

- Test browser-chrome UI code directly
- Validate Noraneko-specific features and components
- Automate UI interaction testing
- Perform visual validation via screenshots

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
- **browser-test-example.mjs** - Demonstrates how to test browser UI code via JS execution
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

## Primary Use Case: Testing Browser UI Code

### Example Test Script

Create `test-browser-ui.js`:

```javascript
// Access browser window
const window = Services.wm.getMostRecentWindow("navigator:browser");
const document = window.document;

// Test Noraneko UI components
const urlbar = document.getElementById("urlbar");
const customFeature = document.getElementById("noraneko-custom-feature");

// Validate and return results
return {
  browserReady: window.gBrowser !== undefined,
  urlbarPresent: urlbar !== null,
  customFeaturePresent: customFeature !== null,
  tabCount: window.gBrowser.tabs.length
};
```

### Run the test:

```bash
node tools/mus-uc-devtools/run.mjs -- exec -f test-browser-ui.js
```

## Usage

### Testing Browser UI

```bash
# Execute JavaScript to test UI components
node tools/mus-uc-devtools/run.mjs -- exec -f test-ui.js

# Take screenshot for visual validation
node tools/mus-uc-devtools/run.mjs -- screenshot -o ui-state.png

# Show help
node tools/mus-uc-devtools/run.mjs -- --help
```

### Running integration tests

```bash
# Using npm
npm test

# Using deno
deno task test
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

mus-uc-devtools enables JavaScript execution in Firefox chrome context via the Marionette protocol:

- **JavaScript execution** - Primary feature for testing browser UI code
- **Browser automation** - Automate testing of Noraneko features
- **Screenshot capture** - Visual validation of UI state
- **Chrome context access** - Full access to browser internals
- **CSS injection** - Additional capability for styling tests

## Future work

1. Create automated UI tests for Noraneko features
2. Add test suite for browser-chrome components
3. Implement screenshot-based visual regression testing
4. Integrate with CI/CD for automated testing
5. Add coverage reports for UI code

## References

- [mus-uc-devtools repository](https://github.com/f3liz-dev/mus-uc-devtools)
- [Firefox Marionette Protocol](https://firefox-source-docs.mozilla.org/testing/marionette/)
- [WebAssembly WASI](https://wasi.dev/)
