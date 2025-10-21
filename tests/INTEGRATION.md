# Integration with feles-build

This document describes how the test infrastructure integrates with the feles-build workflow.

## Overview

The test infrastructure is designed to work alongside the feles-build system, providing automated validation of browser functionality. The tests use the same Firefox and marionette protocol that feles-build uses for browser development.

## Test Execution

Tests can be run independently from feles-build:

```bash
# Using deno task (recommended)
deno task test

# Using npm
npm test
```

## Integration Points

### 1. Shared Firefox Configuration

The tests use a similar Firefox profile configuration as feles-build's `BrowserLauncher`:
- Marionette protocol enabled
- Remote debugging support
- Chrome context access

See `tools/src/browser_launcher.ts` for feles-build's browser configuration.

### 2. Chrome Context Testing

The tests validate functionality that feles-build relies on:
- CSS injection via `nsIStyleSheetService`
- JavaScript execution in chrome-privileged context
- Browser window and document access

### 3. CI/CD Integration

Tests can be added to CI/CD pipelines:

```bash
# In GitHub Actions or other CI systems
npm install --legacy-peer-deps
npm test
```

## Future Integration with mus-uc-devtools

Once mus-uc-devtools is published to npm/jsr, the integration can be simplified:

### Option 1: Use as a Library

```javascript
import { wasmPath } from 'mus-uc-devtools';
// Use the WASM binary for browser automation
```

### Option 2: Use as CLI Tool

```bash
# Install mus-uc-devtools
npm install --save-dev mus-uc-devtools

# Use in tests
./node_modules/.bin/mus-uc load -f style.css
./node_modules/.bin/mus-uc screenshot -o output.png
```

### Option 3: Drop-in Replacement for Puppeteer

The mus-uc-devtools approach can serve as a drop-in replacement for puppeteer-core when:
- CSS injection is needed in chrome context
- Chrome manifest registration is required
- Screenshot capture of browser UI is needed

## Testing feles-build Features

To test specific feles-build features:

### Testing CSS Changes

```javascript
// In your test file
await client.setContext('chrome');

const cssContent = fs.readFileSync('path/to/style.css', 'utf-8');
const loadScript = `
    const sss = Cc["@mozilla.org/content/style-sheet-service;1"]
        .getService(Ci.nsIStyleSheetService);
    const uri = Services.io.newURI("data:text/css," + encodeURIComponent(arguments[0]));
    sss.loadAndRegisterSheet(uri, sss.USER_SHEET);
    return { loaded: true };
`;

await client.executeScript(loadScript, [cssContent]);
```

### Testing JavaScript Modules

```javascript
// Test module loading
await client.setContext('chrome');

const testScript = `
    // Your module code here
    return { moduleLoaded: true };
`;

const result = await client.executeScript(testScript, []);
```

## Running Tests During Development

For continuous testing during development:

1. Start feles-build in dev mode:
   ```bash
   deno task feles-build dev
   ```

2. In another terminal, run tests:
   ```bash
   npm test
   ```

The tests will use a separate Firefox instance, so they won't interfere with the development browser.

## Troubleshooting

### Port Conflicts

If marionette port (2828) is already in use:
- Stop the feles-build dev server
- Or modify `MARIONETTE_PORT` in the test file to use a different port

### Test Failures

Common issues:
- **Firefox not found**: System Firefox is used by default, or install via @puppeteer/browsers
- **Marionette timeout**: Increase `TEST_TIMEOUT` in the test configuration
- **Chrome context access denied**: Ensure Firefox is started with `--remote-allow-system-access`

## Resources

- [mus-uc-devtools Repository](https://github.com/f3liz-dev/mus-uc-devtools)
- [Firefox Marionette Documentation](https://firefox-source-docs.mozilla.org/testing/marionette/index.html)
- [nsIStyleSheetService Documentation](https://searchfox.org/mozilla-central/source/layout/base/nsIStyleSheetService.idl)
