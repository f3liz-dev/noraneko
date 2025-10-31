# Module RPC Communication System - Migration Guide

## Overview

This guide explains how to migrate modules from using direct dependencies (imports, `Services.obs`, global variables) to using the RPC (Remote Procedure Call) registry for inter-module communication.

## NEW: Type-Safe this.rpc Pattern (Recommended)

The recommended way to use RPC is via the type-safe `this.rpc` pattern in NoraComponentBase:

```typescript
import { noraComponent, NoraComponentBase } from "#features-chrome/utils/base";
import type { RPCDependencies } from "../rpc-interfaces.ts";

@noraComponent(import.meta.hot)
export default class MyModule extends NoraComponentBase {
  // Declare type-safe RPC access to dependencies
  protected rpc!: RPCDependencies<["sidebar", "other-module"]>;

  init() {
    // Call RPC methods with full IDE autocomplete support!
    await this.rpc.sidebar.registerSidebarIcon({...});
    
    // Returns undefined if module not loaded (soft dependency)
    const result = await this.rpc["other-module"].getData();
  }

  _metadata() {
    return {
      moduleName: "my-module",
      dependencies: [],
      softDependencies: ["sidebar", "other-module"],
      rpcMethods: {
        myMethod: (arg: string) => this.myMethod(arg),
      },
    };
  }
}
```

**Benefits:**
- ✅ Clean syntax: `this.rpc.sidebar.method()`
- ✅ IDE autocomplete works automatically
- ✅ Type-safe based on module interfaces
- ✅ No manual proxy creation needed
- ✅ Consistent pattern across all modules

## Why Migrate?

**Before (Problems):**
- Modules directly import each other, creating tight coupling
- Using `Services.obs` for communication, which is browser-specific
- No graceful handling of missing modules
- Circular dependencies are possible
- Hard to test modules in isolation

**After (Benefits):**
- Modules communicate via RPC without direct imports
- Graceful degradation when dependencies are missing
- No circular dependencies
- Easy to test modules independently
- Better separation of concerns

## Key Concepts

### 1. RPC Registry

The RPC registry is a centralized system that:
- Manages module communication
- Routes RPC calls between modules
- Handles missing/unloaded modules gracefully
- Supports both hard and soft dependencies

### 2. Module Metadata

Each module defines its RPC interface in the `_metadata()` method:

```typescript
_metadata() {
  return {
    moduleName: "my-module",
    dependencies: [],           // Hard dependencies (must be loaded)
    softDependencies: [],       // Soft dependencies (optional)
    rpcMethods: {               // Methods other modules can call
      myMethod: (arg: string) => this.myMethod(arg),
    },
  };
}
```

### 3. RPC Methods vs Regular Methods

**RPC Methods:** Exposed to other modules via `rpcMethods` in metadata
**Regular Methods:** Private to the module, not accessible externally

## Migration Steps

### Step 1: Add RPC Interface (if needed)

First, if your dependency module doesn't have an RPC interface defined, add it to `common/rpc-interfaces.ts`:

```typescript
export interface MyModuleRPC {
  doSomething(): Promise<void>;
  getData(): Promise<string>;
}

// Add to ModuleRPCInterfaces mapping
export interface ModuleRPCInterfaces {
  "my-module": MyModuleRPC;
  "sidebar": SidebarRPC;
  // ... other modules
}
```

### Step 2: Use this.rpc Pattern (NEW - Recommended)

**Before:**
```typescript
import { OtherModule } from "../other-module/index.ts";

class MyModule {
  init() {
    const other = new OtherModule();
    other.doSomething();
  }
}
```

**After:**
```typescript
import { noraComponent, NoraComponentBase } from "#features-chrome/utils/base";
import type { RPCDependencies } from "../rpc-interfaces.ts";

@noraComponent(import.meta.hot)
export default class MyModule extends NoraComponentBase {
  protected rpc!: RPCDependencies<["other-module"]>;

  init() {
    // Clean, type-safe RPC call with IDE autocomplete!
    await this.rpc["other-module"].doSomething();
  }

  _metadata() {
    return {
      moduleName: "my-module",
      dependencies: [],
      softDependencies: ["other-module"],
    };
  }
}
```

### Step 3: Remove Services.obs Usage

**Before:**
```typescript
// Sending
Services.obs.notifyObservers(
  { data: "hello" } as nsISupports,
  "my-custom-topic"
);

// Receiving
const observer = (subject: nsISupports, topic: string, data: string) => {
  console.log("Received:", (subject as any).data);
};
Services.obs.addObserver(observer, "my-custom-topic", false);
```

**After:**
```typescript
// Use RPC calls instead
await this.rpc["target-module"].handleData("hello");

// Or for broadcasting events, use DOM custom events
const event = new CustomEvent("my-custom-event", {
  detail: { data: "hello" }
});
document.dispatchEvent(event);
```

### Step 4: Define RPC Methods in Metadata

Add RPC methods to your module's metadata:

```typescript
_metadata() {
  return {
    moduleName: "my-module",
    dependencies: [],
    softDependencies: ["other-module"],
    rpcMethods: {
      // Expose methods that other modules can call
      handleData: (data: string) => this.handleData(data),
      getData: () => this.getData(),
      performAction: (action: string) => this.performAction(action),
    },
  };
}

// Private methods (called via RPC)
private handleData(data: string): void {
  console.log("Handling data:", data);
}

private getData(): string {
  return this.internalData;
}

private async performAction(action: string): Promise<string> {
  // Perform action
  return `Completed: ${action}`;
}
```

### Step 4: Call RPC Methods

There are several ways to call RPC methods:

#### Option 1: Direct Call (throws on error)
```typescript
import { callModuleRPC } from "#bridge-loader-features/loader/modules-hooks.ts";

const result = await callModuleRPC<string>("target-module", "getData");
```

#### Option 2: Soft Call (returns undefined on error)
```typescript
import { tryCallModuleRPC } from "#bridge-loader-features/loader/modules-hooks.ts";

const result = await tryCallModuleRPC<string>("target-module", "getData");
if (result) {
  console.log("Got result:", result);
} else {
  console.log("Module not available, continuing without it");
}
```

#### Option 3: Proxy (cleaner syntax)
```typescript
import { getModuleProxy } from "#bridge-loader-features/loader/modules-hooks.ts";

interface TargetModuleRPC {
  getData(): Promise<string>;
  performAction(action: string): Promise<string>;
}

const proxy = getModuleProxy<TargetModuleRPC>("target-module");
const result = await proxy.getData();
```

#### Option 4: Soft Proxy (best for soft dependencies)
```typescript
import { getSoftModuleProxy } from "#bridge-loader-features/loader/modules-hooks.ts";

const proxy = getSoftModuleProxy<TargetModuleRPC>("target-module");
const result = await proxy.getData(); // Returns undefined if module not loaded
```

## Best Practices

1. **Use Soft Dependencies:** For optional features, use `softDependencies` and `getSoftModuleProxy`
2. **Define Clear Interfaces:** Create TypeScript interfaces for RPC methods
3. **Handle Missing Modules:** Always check if RPC calls succeed before proceeding
4. **Avoid Services.obs:** Use RPC for module communication, custom events for broadcasting
5. **Keep RPC Methods Simple:** RPC methods should be straightforward and well-documented
6. **Don't Mix Patterns:** Don't use both old and new patterns in the same module

## Examples

See the following files for complete examples:
- `browser-features/chrome/example/rpc-communication-demo.ts` - Complete examples
- `browser-features/chrome/common/sidebar-addon-panel/index-rpc.ts` - Real-world example
- `browser-features/chrome/common/sidebar/index-rpc.ts` - Real-world example
- `browser-features/chrome/test/unit/rpc-registry.test.ts` - Test examples

## Migration Checklist

- [ ] Identify all `Services.obs.notifyObservers` calls
- [ ] Identify all `Services.obs.addObserver` calls
- [ ] Identify all direct module imports
- [ ] Identify all global variable usage for module communication
- [ ] Define RPC interfaces for all modules
- [ ] Implement `rpcMethods` in `_metadata()`
- [ ] Replace direct calls with RPC calls
- [ ] Replace Services.obs with RPC or custom events
- [ ] Add soft dependency handling
- [ ] Test modules work independently
- [ ] Test modules work when dependencies are missing
- [ ] Update documentation
