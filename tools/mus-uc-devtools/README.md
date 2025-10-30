# mus-uc-devtools

This directory contains vendored binaries of [mus-uc-devtools](https://github.com/f3liz-dev/mus-uc-devtools), a tool for developing userChrome CSS for Firefox using the Marionette protocol.

## Contents

- `dist/` - WebAssembly binaries built from mus-uc-devtools source
  - `mus-uc.wasm` - WASI binary (CLI tool)
  - `mus_uc_devtools_bg.wasm` - wasm-pack build
  - `index.js` - ESM wrapper for programmatic access
  - `package.json` - Package metadata
- `run.mjs` - Node.js runner script for the WASI binary

## Usage

### Using the Runner Script

The easiest way to use mus-uc-devtools is through the runner script:

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

