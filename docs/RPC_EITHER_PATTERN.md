# RPC System with Either-Based Error Handling

## Overview

The RPC system now uses fp-ts Either types for error-safe handling, following Rust's Result pattern. This means:
- No more thrown exceptions for RPC calls
- Explicit error handling with pattern matching
- Type-safe error propagation

## Using Either Types

All RPC methods now return `Promise<Either<Error, T>>`:

```typescript
import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";

// Call RPC method - returns Either<Error, void>
const result = await this.rpc.sidebar.registerSidebarIcon({...});

// Pattern match on the result
pipe(
  result,
  E.fold(
    (error) => console.error("Failed:", error),  // Left (error case)
    (value) => console.log("Success:", value)     // Right (success case)
  )
);
```

## Soft Dependencies

Soft dependencies return `Either<Error, T | undefined>`:

```typescript
// If sidebar is not loaded, this returns Right(undefined)
const result = await this.rpc.sidebar.getData();

pipe(
  result,
  E.fold(
    (error) => console.error("RPC call failed:", error),
    (data) => {
      if (data === undefined) {
        console.log("Module not available");
      } else {
        console.log("Got data:", data);
      }
    }
  )
);
```

## Benefits

1. **No Exceptions**: Errors are values, not thrown exceptions
2. **Explicit Error Handling**: Must handle both success and error cases
3. **Type Safe**: TypeScript ensures you handle all cases
4. **Composable**: Use fp-ts combinators to chain operations

## Migration from Old Pattern

**Before (throwing exceptions):**
```typescript
try {
  await callModuleRPC("sidebar", "registerIcon", options);
} catch (error) {
  console.error("Failed:", error);
}
```

**After (Either pattern):**
```typescript
const result = await this.rpc.sidebar.registerIcon(options);

pipe(
  result,
  E.fold(
    (error) => console.error("Failed:", error),
    () => console.log("Success")
  )
);
```

## Advanced Patterns

### Chaining Operations

```typescript
import { pipe } from "fp-ts/function";
import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";

// Chain multiple RPC calls
const result = await pipe(
  this.rpc.sidebar.getData(),
  TE.fromTask,
  TE.chain((data) => 
    E.isRight(data) && data.right !== undefined
      ? this.rpc.sidebar.processData(data.right)
      : TE.left(new Error("No data"))
  )
)();
```

### Mapping Results

```typescript
const result = await this.rpc.sidebar.getData();

const processed = pipe(
  result,
  E.map((data) => data?.toUpperCase() ?? "")
);
```

## Deprecated Functions

The following functions are deprecated and will show warnings:
- `callModuleRPC()` - Use `this.rpc` instead
- `tryCallModuleRPC()` - Use `this.rpc` instead  
- `getModuleProxy()` - Use `this.rpc` instead
- `getSoftModuleProxy()` - Use `this.rpc` instead

Only use `this.rpc` pattern going forward.
