# Automatic RPC Type Inference

## Overview

The RPC system now features **automatic type inference** using TypeScript's declaration merging. This means:
- ✅ No manual interface declarations needed
- ✅ Types extracted directly from `rpcMethods` in module metadata
- ✅ Single source of truth - define methods once
- ✅ Refactoring safe - change methods, types update automatically
- ✅ Full IDE autocomplete support

## How It Works

### 1. Module Declaration Merging

Each module registers itself in a global registry:

```typescript
@noraComponent(import.meta.hot)
export default class MyModule extends NoraComponentBase {
  _metadata() {
    return {
      moduleName: "my-module",
      dependencies: [],
      softDependencies: [],
      rpcMethods: {
        myMethod: (arg: string) => this.myMethod(arg),
        getData: () => this.getData(),
      },
    } as const; // Important: use 'as const' for literal types
  }
  
  private myMethod(arg: string): void { /* ... */ }
  private getData(): Promise<string> { /* ... */ }
}

// Register in global registry
declare global {
  interface FeatureModuleRegistry {
    MyModule: typeof MyModule;
  }
}
```

### 2. Automatic Type Extraction

The type system automatically:
1. Extracts module name from `_metadata().moduleName`
2. Extracts RPC methods from `_metadata().rpcMethods`
3. Wraps all methods with `Either<Error, T>` for error safety
4. Creates type mapping from module name to methods

### 3. Using Inferred Types

```typescript
@noraComponent(import.meta.hot)
export class ConsumerModule extends NoraComponentBase {
  // Types automatically inferred from my-module's rpcMethods!
  protected rpc!: RPCDependenciesWithSoft<[], ["my-module"]>;
  
  async init() {
    // Full IDE autocomplete - no manual interfaces needed!
    const result = await this.rpc["my-module"].myMethod("test");
    
    pipe(
      result,
      E.fold(
        (error) => console.error("Failed:", error),
        () => console.log("Success")
      )
    );
  }
}
```

## Type System Architecture

### Core Types (features-rpc.d.ts)

```typescript
// Extract module name from class
type ExtractModuleName<T> = T extends {
  _metadata(): { moduleName: infer N };
} ? N : never;

// Extract RPC methods from class
type ExtractRpcMethods<T> = T extends {
  _metadata(): { rpcMethods: infer R };
} ? R : never;

// Global registry (augmented by each module)
interface FeatureModuleRegistry {
  // Modules add themselves here
}

// Map module names to their RPC methods
type FeatureRpcMethods = {
  [K in keyof FeatureModuleClassMap]: 
    ExtractRpcMethods<InstanceType<FeatureModuleClassMap[K]>>;
};
```

### Either Wrapping

All RPC methods are automatically wrapped:

```typescript
// Original method: (arg: string) => Promise<string>
// Becomes: (arg: string) => Promise<Either<Error, string>>

// For soft dependencies, undefined is added:
// Becomes: (arg: string) => Promise<Either<Error, string | undefined>>
```

## Benefits

### 1. No Duplication

**Before (manual interfaces):**
```typescript
// rpc-interfaces.ts
export interface MyModuleRPC {
  myMethod(arg: string): Promise<Either<Error, void>>;
  getData(): Promise<Either<Error, string>>;
}

// my-module/index.ts
_metadata() {
  return {
    rpcMethods: {
      myMethod: (arg: string) => this.myMethod(arg),
      getData: () => this.getData(),
    },
  };
}
```

**After (automatic inference):**
```typescript
// my-module/index.ts
_metadata() {
  return {
    moduleName: "my-module",
    rpcMethods: {
      myMethod: (arg: string) => this.myMethod(arg),
      getData: () => this.getData(),
    },
  } as const;
}

declare global {
  interface FeatureModuleRegistry {
    MyModule: typeof MyModule;
  }
}

// Types automatically available everywhere!
```

### 2. Refactoring Safety

Change a method signature:
```typescript
// Change from string to number
private getData(): Promise<number> { /* ... */ }

rpcMethods: {
  getData: () => this.getData(), // Type automatically updates!
}
```

All consumers get type errors if they use it incorrectly - no manual interface update needed!

### 3. IDE Autocomplete

Full autocomplete works because types are inferred from actual implementations:

```typescript
this.rpc["my-module"]. // <-- IDE shows all available methods with signatures
```

## Migration Guide

### Step 1: Add Declaration Merging

Add this to the end of your module file:

```typescript
declare global {
  interface FeatureModuleRegistry {
    YourModuleClassName: typeof YourModuleClassName;
  }
}
```

### Step 2: Use `as const` in Metadata

```typescript
_metadata() {
  return {
    moduleName: "your-module",
    dependencies: [],
    softDependencies: [],
    rpcMethods: {
      yourMethod: (arg: string) => this.yourMethod(arg),
    },
  } as const; // <-- Add this
}
```

### Step 3: Update RPC Type Declaration

```typescript
// Old
protected rpc!: RPCDependencies<["dependency"]>;

// New (if all soft dependencies)
protected rpc!: RPCDependenciesWithSoft<[], ["dependency"]>;

// Or (if mixed)
protected rpc!: RPCDependenciesWithSoft<["hard-dep"], ["soft-dep"]>;
```

### Step 4: Remove Manual Interfaces

Delete manual interface declarations from `rpc-interfaces.ts` - they're no longer needed!

## Advanced Usage

### Multiple Dependencies

```typescript
protected rpc!: RPCDependenciesWithSoft<
  ["required-module"], // Hard dependencies
  ["optional-module-a", "optional-module-b"] // Soft dependencies
>;
```

### Accessing Methods

```typescript
// Hard dependency - throws if not available
const result = await this.rpc["required-module"].method();

// Soft dependency - returns undefined if not available
const result = await this.rpc["optional-module"].method();

pipe(
  result,
  E.fold(
    (error) => console.error("Error:", error),
    (value) => {
      if (value === undefined) {
        console.log("Module not available");
      } else {
        console.log("Got value:", value);
      }
    }
  )
);
```

## Troubleshooting

### "Type 'X' is not assignable to type 'Y'"

Make sure you:
1. Added `as const` to metadata return
2. Registered module in `FeatureModuleRegistry`
3. Used correct module name in dependency array

### Autocomplete Not Working

1. Restart TypeScript server in your IDE
2. Check that module is registered globally
3. Verify `features-rpc.d.ts` is in your project

### "Cannot find name 'FeatureModuleRegistry'"

Import the types:
```typescript
import type { FeatureRpcMethods } from "../common/features-rpc.d.ts";
```

## Technical Details

This system uses:
- **Declaration Merging**: Augments global `FeatureModuleRegistry`
- **Conditional Types**: Extracts metadata types
- **Mapped Types**: Creates RPC method mappings
- **Template Literal Types**: Infers module names
- **Type Inference**: Extracts method signatures

No code generation, no build step - pure TypeScript type system!
