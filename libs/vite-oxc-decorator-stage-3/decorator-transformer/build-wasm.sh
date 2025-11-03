#!/bin/bash
set -e

# Build WASM component (wasip2 produces components directly)
cargo build --target wasm32-wasip2 --release

echo "WASM component built successfully!"
