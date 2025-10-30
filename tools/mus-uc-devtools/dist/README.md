# mus-uc-devtools

A tool to develop userChrome CSS for Firefox using the Marionette protocol.

<img width="128px" height="128px" src=".github/assets/mus-css.png" alt="mus-uc-devtools logo"></img>

## Features

- Load CSS into Firefox chrome context via Marionette protocol
- Register chrome.manifest files for modular CSS development
- Screenshot capture for browser UI elements
- Watch mode for automatic CSS reload on file changes
- **JavaScript/TypeScript bindings via WebAssembly Components (jco)**

## Implementation

Uses Firefox Marionette protocol to execute JavaScript in chrome-privileged context, providing access to XPCOM components like `nsIStyleSheetService` for CSS injection.

Key Rust functions are exposed to JavaScript using [jco](https://github.com/bytecodealliance/jco) and WebAssembly Component Model. See [docs/jco-integration.md](docs/jco-integration.md) for details.

See [docs/chrome-context.md](docs/chrome-context.md) for details on chrome context implementation.

## Usage

### Register chrome.manifest

```bash
./mus-uc register-manifest -m /path/to/chrome.manifest
./mus-uc load -f path/to/style.css
```

chrome.manifest example:
```
content mus-uc ./
content mus-uc-components ./components/
```

CSS with chrome:// imports:
```css
@import 'chrome://mus-uc/content/components/button.css';
#nav-bar { background: red !important; }
```

### CSS Commands

```bash
# Load CSS
./mus-uc load -f path/to/style.css
./mus-uc load -f path/to/style.css -i my-id

# Watch for changes and auto-reload
./mus-uc watch -f path/to/style.css -i my-id

# Manage loaded CSS
./mus-uc unload my-id
./mus-uc list
./mus-uc clear
```

### Screenshot

```bash
./mus-uc screenshot -o output.png
./mus-uc screenshot -s "#nav-bar" -o navbar.png
```

### Execute JavaScript

Run arbitrary JavaScript in Firefox chrome context:

```bash
# Execute from file
./mus-uc exec -f script.js

# Execute from stdin
echo 'return { result: 1 + 1 };' | ./mus-uc exec

# Pass arguments to the script
./mus-uc exec -f script.js -a '["arg1", 42]'
```

Example scripts:

```javascript
// Get browser info
const window = Services.wm.getMostRecentWindow("navigator:browser");
return {
    title: window.document.title,
    url: window.location.href
};
```

```javascript
// Use arguments
const name = arguments[0];
const count = arguments[1];
return { greeting: `Hello ${name}!`, count: count * 2 };
```

## Requirements

- Firefox with Marionette enabled (set `marionette.port` to 2828 in `about:config`)
- For native builds: Rust toolchain
- For WASI builds: Rust toolchain with `wasm32-wasip1` target
- For running WASI binaries: A WASI-compatible runtime (e.g., [wasmtime](https://wasmtime.dev/), [wasmer](https://wasmer.io/), or Node.js 18+)

## Installation

### From npm

```bash
npm install mus-uc-devtools
```

### From jsr.io

```bash
# Using Deno
deno add @f3liz-dev/mus-uc-devtools

# Using npm
npx jsr add @f3liz-dev/mus-uc-devtools
```

### Building from source

#### Native binary

```bash
cargo build --release
```

#### WASI binary

```bash
# Install WASI target
rustup target add wasm32-wasip1

# Build using cargo alias
cargo build-wasi

# Or using npm script
npm run build
```

The WASI binary will be available at `target/wasm32-wasip1/release/mus-uc.wasm`

## Running

### Native binary

```bash
./target/release/mus-uc --help
```

### WASI binary

Using wasmtime:
```bash
wasmtime target/wasm32-wasip1/release/mus-uc.wasm -- --help
```

Using wasmer:
```bash
wasmer run target/wasm32-wasip1/release/mus-uc.wasm -- --help
```

Using the npm package:
```javascript
const { wasmPath } = require('mus-uc-devtools');
// Use wasmPath with your WASI runtime
```

## Testing

```bash
npm install
npm test
```

## Using from JavaScript/TypeScript

You can use the key functions from JavaScript via WebAssembly Components:

```bash
# Build the component and transpile to JS
npm run build:component
```

```javascript
import { cssManager, marionette } from './dist/mus_uc_devtools.js';

// Initialize and load CSS
cssManager.initialize();
cssManager.loadCss('#nav-bar { background: blue; }', 'my-theme');

// Execute JavaScript in Firefox
marionette.connect('localhost', 2828);
marionette.executeScript('return Services.appinfo.version;');
```

See [docs/jco-integration.md](docs/jco-integration.md) and `examples/jco/` for details.

## Documentation

- [Chrome Context](docs/chrome-context.md)
- [Chrome Manifest](docs/chrome-manifest.md)
- [Screenshot](docs/screenshot.md)
- [Testing](docs/testing.md)
- [JavaScript Integration with jco](docs/jco-integration.md)

## Credits

This project uses:
- [Marionette Protocol](https://firefox-source-docs.mozilla.org/testing/marionette/) - Firefox automation
- [Firefox](https://www.mozilla.org/firefox/) - Web browser
