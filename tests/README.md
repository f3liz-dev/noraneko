# Noraneko Browser Tests

This directory contains automated tests for the Noraneko browser using `mus-uc-devtools`.

## Test Structure

- `integration-test.mjs` - Basic integration test verifying mus-uc-devtools vendored binaries
- `browser-test-example.mjs` - Example showing how to use mus-uc-devtools for browser testing

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

## Using mus-uc-devtools

### Quick Start

The easiest way to use mus-uc-devtools is through the runner script:

```bash
# Show available commands
node tools/mus-uc-devtools/run.mjs -- --help

# Load CSS into Firefox chrome context
node tools/mus-uc-devtools/run.mjs -- load -f userChrome.css

# Take a screenshot
node tools/mus-uc-devtools/run.mjs -- screenshot -o output.png
```

### About mus-uc-devtools

[mus-uc-devtools](https://github.com/f3liz-dev/mus-uc-devtools) is a tool for developing userChrome CSS for Firefox using the Marionette protocol. It provides:

- CSS injection into Firefox chrome context
- Screenshot capture for browser UI elements
- JavaScript execution in Firefox chrome context
- Watch mode for automatic CSS reload

The vendored binaries are located in `tools/mus-uc-devtools/dist/`.

## Test Categories

### Integration Tests (Current)
- Verify vendored binaries exist and are accessible
- Test WASM module loading
- Validate package structure
- Demonstrate usage examples

### Functional Tests (Future)
- CSS injection into browser chrome context
- Screenshot capture and comparison
- Browser automation with Marionette protocol
- UI element testing

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

1. Create a new test file in `tests/` directory (e.g., `tests/css-injection-test.mjs`)
2. Import necessary utilities from `mus-uc-devtools`
3. Follow the existing test structure with clear output
4. Update this README with new test descriptions

## Example Test Scenarios

See `browser-test-example.mjs` for examples of:
- CSS injection testing
- Screenshot comparison
- JavaScript execution in chrome context
- Watch mode for development
