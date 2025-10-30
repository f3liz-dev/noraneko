# mus-uc-devtools

This directory contains vendored binaries of [mus-uc-devtools](https://github.com/f3liz-dev/mus-uc-devtools), a tool for developing userChrome CSS for Firefox using the Marionette protocol.

## Contents

- `dist/` - WebAssembly module built with wasm-pack from the mus-uc-devtools Rust source

## Usage

The vendored binaries are used by the test scripts in the `tests/` directory for automated browser testing.

## Updating

To update the vendored binaries:

1. Clone the mus-uc-devtools repository
2. Build with wasm-pack: `npm run build:wasm-pack`
3. Copy the contents of `pkg/` to `tools/mus-uc-devtools/dist/`

## License

mus-uc-devtools is licensed under the MIT License. See `dist/LICENSE` for details.
