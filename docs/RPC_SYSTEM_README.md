# RPC-Based Module Communication System

## What Changed

This update replaces direct module dependencies (imports, `Services.obs`, global variables) with an RPC (Remote Procedure Call) based communication system using birpc.

## Key Benefits

1. **Loose Coupling:** Modules no longer directly import each other
2. **Graceful Degradation:** Modules continue to work even if dependencies are missing
3. **No Circular Dependencies:** RPC prevents circular dependency issues
4. **Better Testability:** Modules can be tested in isolation
5. **Cleaner Architecture:** Clear separation between modules

## Architecture Overview

### RPC Registry (`bridge/loader-features/loader/rpc-registry.ts`)

The central registry that:
- Manages all module RPC interfaces
- Routes calls between modules
- Handles missing/unloaded modules gracefully
- Supports timeouts and error handling

### Module Metadata

Each module defines its RPC interface in `_metadata()`:

```typescript
_metadata() {
  return {
    moduleName: "my-module",
    dependencies: [],        // Hard dependencies
    softDependencies: [],    // Optional dependencies
    rpcMethods: {            // Methods callable by other modules
      myMethod: (arg) => this.myMethod(arg),
    },
  };
}
```

### Module Loader Integration

The loader (`bridge/loader-features/loader/index.ts`):
1. Loads all enabled modules
2. Registers RPC methods before initialization
3. Initializes modules in dependency order
4. Handles module failures gracefully

## How to Use RPC

### Calling RPC Methods

```typescript
import {
  callModuleRPC,      // Throws if module not found
  tryCallModuleRPC,   // Returns undefined if module not found
  getModuleProxy,     // Proxy that throws on error
  getSoftModuleProxy, // Proxy that returns undefined on error
} from "#bridge-loader-features/loader/modules-hooks.ts";

// Option 1: Direct call
const result = await callModuleRPC("target-module", "getData");

// Option 2: Soft call (recommended for soft dependencies)
const result = await tryCallModuleRPC("target-module", "getData");

// Option 3: Proxy (type-safe)
interface TargetModuleRPC {
  getData(): Promise<string>;
}
const proxy = getSoftModuleProxy<TargetModuleRPC>("target-module");
const result = await proxy.getData();
```

### Exposing RPC Methods

```typescript
export default class MyModule extends NoraComponentBase {
  private myData = "test";

  private getData(): string {
    return this.myData;
  }

  _metadata() {
    return {
      moduleName: "my-module",
      dependencies: [],
      softDependencies: [],
      rpcMethods: {
        getData: () => this.getData(),
      },
    };
  }
}
```

## Migrated Modules

The following modules have been updated to use RPC:

- **sidebar-addon-panel** (`browser-features/chrome/common/sidebar-addon-panel/`)
  - Now uses RPC to communicate with sidebar module
  - Uses custom DOM events instead of Services.obs for UI updates
  - Gracefully handles missing sidebar module

- **sidebar** (`browser-features/chrome/common/sidebar/`)
  - Exposes RPC methods for icon registration
  - Uses RPC to communicate with sidebar-addon-panel
  - Uses custom DOM events instead of Services.obs

## Files Added/Modified

### New Files
- `bridge/loader-features/loader/rpc-registry.ts` - RPC registry implementation
- `browser-features/chrome/example/rpc-communication-demo.ts` - Example usage
- `browser-features/chrome/test/unit/rpc-registry.test.ts` - Unit tests
- `docs/RPC_MIGRATION_GUIDE.md` - Comprehensive migration guide

### Modified Files
- `bridge/loader-features/loader/index.ts` - Integrated RPC registration
- `bridge/loader-features/loader/modules-hooks.ts` - Added RPC exports
- `bridge/loader-features/deno.json` - Added birpc dependency
- `browser-features/chrome/deno.json` - Added birpc dependency
- `browser-features/chrome/common/sidebar-addon-panel/index.ts` - RPC version
- `browser-features/chrome/common/sidebar/index.ts` - RPC version

### Backup Files
- `browser-features/chrome/common/sidebar-addon-panel/index-old.ts.bak` - Original
- `browser-features/chrome/common/sidebar/index-old.ts.bak` - Original

## Migration Path for Other Modules

To migrate a module to use RPC:

1. Read the migration guide: `docs/RPC_MIGRATION_GUIDE.md`
2. Define RPC methods in `_metadata().rpcMethods`
3. Replace direct imports with `getSoftModuleProxy` or `getModuleProxy`
4. Replace `Services.obs` with RPC calls or custom DOM events
5. Add error handling for missing dependencies
6. Test the module works independently

## Services.obs Usage Note

`Services.obs` is still used for:
- **Browser-internal events** (e.g., `http-on-modify-request`) - This is correct
- **Non-module communication** (e.g., browser lifecycle events) - This is fine

`Services.obs` should NOT be used for:
- **Module-to-module communication** - Use RPC instead
- **Passing data between modules** - Use RPC instead

## Testing

Run tests with:
```bash
deno test browser-features/chrome/test/unit/rpc-registry.test.ts
```

Note: Some tests may show type errors from gecko types - this is expected and doesn't affect functionality.

## Backwards Compatibility

The RPC system is backwards compatible:
- Modules without `rpcMethods` still work
- Existing metadata format is preserved
- Old modules can coexist with new RPC-based modules

## Future Work

- Migrate remaining modules to use RPC
- Remove all inter-module `Services.obs` usage
- Add performance monitoring for RPC calls
- Create development tools for RPC debugging

## Documentation

- **Migration Guide:** `docs/RPC_MIGRATION_GUIDE.md`
- **Examples:** `browser-features/chrome/example/rpc-communication-demo.ts`
- **Tests:** `browser-features/chrome/test/unit/rpc-registry.test.ts`
- **Implementation:** `bridge/loader-features/loader/rpc-registry.ts`

## Questions?

Refer to the migration guide or examine the migrated modules for patterns and best practices.
