# Noraneko Browser Tests

This directory contains automated tests for the Noraneko browser using `mus-uc-devtools` as a JavaScript executor through Firefox Marionette protocol.

## Test Structure

- `integration-test.mjs` - Basic integration test verifying mus-uc-devtools vendored binaries
- `browser-test-example.mjs` - Example showing how to test browser-chrome UI code

## Running Tests

```bash
# Run all tests
npm test
# or
deno task test

# Or run directly with Node.js
node tests/integration-test.mjs
node tests/browser-test-example.mjs
```

## Using mus-uc-devtools for Testing Browser UI

### Quick Start

The primary use of mus-uc-devtools is to execute JavaScript in Firefox chrome context for testing Noraneko's browser UI:

```bash
# Execute JavaScript to test browser UI
node tools/mus-uc-devtools/run.mjs -- exec -f test-ui.js

# Show available commands
node tools/mus-uc-devtools/run.mjs -- --help

# Take screenshots for visual validation
node tools/mus-uc-devtools/run.mjs -- screenshot -o output.png
```

### About mus-uc-devtools

[mus-uc-devtools](https://github.com/f3liz-dev/mus-uc-devtools) provides JavaScript execution in Firefox chrome context via the Marionette protocol. This enables:

- **JavaScript execution** - Test browser-chrome UI code directly in Firefox
- **Browser automation** - Automate testing of Noraneko UI features
- **Screenshot capture** - Visual validation of UI elements
- **Chrome context access** - Full access to browser internals for testing

The vendored binaries are located in `tools/mus-uc-devtools/dist/`.

## Test Categories

### Integration Tests (Current)
- Verify vendored binaries exist and are accessible
- Test WASM module loading
- Validate package structure
- Demonstrate usage examples

### Functional Tests (Future)
- Test browser-chrome UI components
- Validate Noraneko feature implementations
- Automate UI interaction testing
- Screenshot-based visual regression testing

## Requirements

- Node.js 18+ (for WASM support)
- For functional tests: Firefox with Marionette enabled (set `marionette.port` to 2828 in `about:config`)

## Integration with feles-build

Tests are integrated with the feles-build workflow and can be run using:

```bash
# Using npm
npm test

# Using deno task
deno task test
```

Future integration points:
- Pre-build validation
- Post-build smoke tests
- Continuous integration checks

## Adding New Tests

1. Create a new test file in `tests/` directory (e.g., `tests/ui-feature-test.mjs`)
2. Write JavaScript test code to execute in Firefox chrome context
3. Use the runner to execute tests: `node tools/mus-uc-devtools/run.mjs -- exec -f your-test.js`
4. Follow the existing test structure with clear output
5. Update this README with new test descriptions

## Example Test Scenarios

See `browser-test-example.mjs` for examples of:
- Testing browser-chrome UI code via JavaScript execution
- Accessing browser internals for validation
- Screenshot capture for visual testing
- Automated UI testing patterns
