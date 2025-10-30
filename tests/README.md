# Noraneko Browser Tests

This directory contains automated tests for the Noraneko browser using `mus-uc-devtools`.

## Test Structure

- `integration-test.mjs` - Basic integration test verifying mus-uc-devtools vendored binaries

## Running Tests

```bash
# Run all tests
npm test

# Or run directly with Node.js
node tests/integration-test.mjs
```

## About mus-uc-devtools

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

### Functional Tests (Future)
- CSS injection into browser chrome context
- Screenshot capture and comparison
- Browser automation with Marionette protocol
- UI element testing

## Requirements

- Node.js 18+ (for WASM support)
- For functional tests: Firefox with Marionette enabled (set `marionette.port` to 2828 in `about:config`)

## Integration with feles-build

Tests can be integrated with the feles-build workflow to run automatically during development and before production builds.

Future integration points:
- Pre-build validation
- Post-build smoke tests
- Continuous integration checks

## Adding New Tests

1. Create a new test file in `tests/` directory (e.g., `tests/css-injection-test.mjs`)
2. Import necessary utilities from `mus-uc-devtools`
3. Follow the existing test structure with clear output
4. Update this README with new test descriptions
