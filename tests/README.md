# Noraneko Browser Tests

This directory contains automated tests for the Noraneko browser, inspired by [mus-uc-devtools](https://github.com/f3liz-dev/mus-uc-devtools) and using Firefox's Marionette protocol for browser automation.

## Overview

The tests validate core browser functionality including:
- CSS injection into Firefox chrome context
- JavaScript execution in chrome-privileged context
- Browser startup and marionette connection
- Chrome context API access

## Running Tests

### Run all tests

Using npm (recommended in CI/CD environments):
```bash
npm test
```

Or using deno task:
```bash
deno task test
```

**Note:** In some environments, `deno task test` may encounter SSL certificate issues with npm registry. In these cases, use `npm test` instead.

### Test Files

- `browser-integration.test.js` - Main browser integration test suite that validates CSS injection, JavaScript execution, and chrome context access

## Test Infrastructure

The tests use:
- **@puppeteer/browsers** - For downloading and managing Firefox binaries
- **Firefox Marionette Protocol** - For browser control and chrome context access
- Approach inspired by **mus-uc-devtools** - CSS injection and browser automation patterns

The test implementation demonstrates the same techniques used by mus-uc-devtools, making it a drop-in compatible approach for future integration.

## Test Artifacts

Test artifacts are stored in `.firefox-cache/` and include:
- Downloaded Firefox binaries
- Test profile data

These are excluded from git via `.gitignore`.

## Integration with feles-build

The tests are designed to work with the feles-build workflow:
1. Tests can be run independently or as part of CI/CD
2. Tests use the same Firefox configuration as the development environment
3. Tests validate functionality that will be used in production builds

## Writing New Tests

To add new test cases:

1. Create a new test function in `browser-integration.test.js` or create a new test file
2. Follow the existing pattern:
   - Connect to marionette
   - Switch to chrome context
   - Execute test JavaScript
   - Verify results
   - Clean up resources
3. Add your test to the main test runner

Example test function:
```javascript
async function testMyFeature(client) {
    console.log('\n=== Testing My Feature ===');
    
    await client.setContext('chrome');
    
    const script = `
        // Your chrome context JavaScript
        return { result: "test" };
    `;
    
    const result = await client.executeScript(script, []);
    const data = result.value || result;
    
    if (data.result !== "test") {
        throw new Error('Test failed!');
    }
    
    console.log('✓ Test passed');
    return true;
}
```

## Troubleshooting

### Firefox not starting
- Ensure marionette port (2828) is not already in use
- Check Firefox logs in console output

### Connection timeout
- Increase `TEST_TIMEOUT` in test files
- Check firewall settings

### Test failures
- Review Firefox console output for errors
- Verify Firefox version compatibility
- Check that marionette is enabled in Firefox profile

## CI/CD Integration

The tests are designed to run in CI environments:
- Automatically downloads Firefox if not present
- Runs in headless mode
- Exits with appropriate status codes for CI systems
