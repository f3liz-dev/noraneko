# mus-uc-devtools

This directory contains vendored binaries of [mus-uc-devtools](https://github.com/f3liz-dev/mus-uc-devtools), a JavaScript executor for testing Noraneko browser-chrome UI code via Firefox Marionette protocol.

## Contents

- `dist/` - WebAssembly binaries built from mus-uc-devtools source
  - `mus-uc.wasm` - WASI binary (CLI tool)
  - `mus_uc_devtools_bg.wasm` - wasm-pack build
  - `index.js` - ESM wrapper for programmatic access
  - `package.json` - Package metadata
- `run.mjs` - Node.js runner script for the WASI binary

## Primary Use Case: Testing Browser UI Code

The main purpose of this integration is to execute JavaScript in Firefox chrome context for testing Noraneko's browser UI components:

```bash
# Execute JavaScript to test browser UI
node tools/mus-uc-devtools/run.mjs -- exec -f test-browser-ui.js

# Take screenshots for visual validation
node tools/mus-uc-devtools/run.mjs -- screenshot -o ui-state.png

# Show all available commands
node tools/mus-uc-devtools/run.mjs -- --help
```

## Example: Testing Browser UI

Create a test script `test-browser-ui.js`:

```javascript
// Access browser window and components
const window = Services.wm.getMostRecentWindow("navigator:browser");
const document = window.document;

// Test UI elements exist
const urlbar = document.getElementById("urlbar");
const tabsToolbar = document.getElementById("TabsToolbar");

// Return test results
return {
  urlbarPresent: urlbar !== null,
  tabsToolbarPresent: tabsToolbar !== null,
  tabCount: window.gBrowser.tabs.length
};
```

Run the test:
```bash
node tools/mus-uc-devtools/run.mjs -- exec -f test-browser-ui.js
```

## Additional Features

While the primary use is JavaScript execution, mus-uc-devtools also supports:

```bash
# Screenshot capture
node tools/mus-uc-devtools/run.mjs -- screenshot -o output.png

# CSS loading (for styling tests)
node tools/mus-uc-devtools/run.mjs -- load -f userChrome.css
```

### Programmatic Usage

You can also import the WASM binary programmatically:

```javascript
import { wasmPath, wasmBuffer } from './tools/mus-uc-devtools/dist/index.js';

// Get path to WASM binary
console.log(wasmPath);

// Load WASM buffer
const buffer = wasmBuffer();
```

## Requirements

- Node.js 18+ (for WASI support)
- Firefox with Marionette enabled:
  1. Open `about:config` in Firefox
  2. Set `marionette.port` to `2828`
  3. Restart Firefox

## Updating

To update the vendored binaries:

1. Clone the mus-uc-devtools repository
2. Build with wasm-pack: `npm run build:wasm-pack`
3. Build WASI binary: `npm run build`
4. Copy the contents of `pkg/` and `bin/mus-uc.wasm` to `tools/mus-uc-devtools/dist/`
5. Update `dist/index.js` and `dist/package.json` as needed

## License

mus-uc-devtools is licensed under the MIT License. See `dist/LICENSE` for details.

