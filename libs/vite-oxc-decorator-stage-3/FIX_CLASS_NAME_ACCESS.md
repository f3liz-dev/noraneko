# Fix: Class Name Access in Method Decorator Initializers

## Problem

Previously, when using `addInitializer` in method decorators, the initializer function could not reliably determine the class name, especially for static methods. The code attempted to get the class name using:

```javascript
const className =
  typeof this === "function" ? this.name : this.constructor.name;
```

However, for static method decorators, `this` was `undefined` instead of the class constructor, causing the logic to fail.

## Root Cause

The issue was in the `_applyDecs` helper function in `decorator-transformer/src/helpers.js`. The `addClassInitializer` function was creating initializer wrappers without passing the `isStatic` flag to `createInitializerWrapper`. This meant that static initializers didn't receive the correct `this` context.

## Solution

The fix modifies `addClassInitializer` to pass the `isStatic` flag:

```javascript
// Before:
const addClassInitializer = function (initializer) {
  if (initializer) {
    appliedDecorators.push(createInitializerWrapper(initializer));
  }
};

// After:
const addClassInitializer = function (initializer, isStatic) {
  if (initializer) {
    appliedDecorators.push(createInitializerWrapper(initializer, isStatic, 0));
  }
};
```

And updates the call sites:

```javascript
// Pass isStatic flag to ensure 'this' is correctly bound in initializers:
// - For instance methods (isStatic=0): this = instance, use this.constructor.name
// - For static methods (isStatic=8): this = class, use this.name
addClassInitializer(protoInitializers, 0);
addClassInitializer(staticInitializers, 8);
```

## How It Works

With this fix:

1. **Instance Method Decorators**: 
   - The initializer is called with `this` as the instance
   - `this.constructor.name` returns the class name
   
2. **Static Method Decorators**:
   - The `isStatic` flag causes `createInitializerWrapper` to set `target = targetClass`
   - The initializer is called with `this` as the class constructor
   - `this.name` returns the class name

## Example Usage

```typescript
const _rpcMethods = new Map<string, Set<string | symbol>>();

function rpcMethod(_: Function, context: ClassMethodDecoratorContext) {
  context.addInitializer(function () {
    // Now works correctly for both instance and static methods!
    const className =
      typeof this === "function" ? this.name : this.constructor.name;

    if (!className) {
      console.error("Could not determine class name");
      return;
    }

    if (!_rpcMethods.has(className)) _rpcMethods.set(className, new Set());
    _rpcMethods.get(className)!.add(context.name);
  });
}

class UserService {
  @rpcMethod
  getUser(id: number) {
    return { id, name: "John Doe" };
  }

  @rpcMethod
  static getUserCount() {
    return 42;
  }
}

const service = new UserService();
console.log(_rpcMethods);
// Map { "UserService" => Set { "getUser", "getUserCount" } }
```

## Testing

The fix has been verified with:

1. **Minimal test** (`/tmp/test-minimal-fix.js`): Demonstrates the correct behavior
2. **Comprehensive tests** (`test/class-name-access.test.ts`): Tests both instance and static methods
3. **Example** (`examples/rpc-method-example.ts`): Real-world use case

## Files Changed

- `decorator-transformer/src/helpers.js`: Fixed `addClassInitializer` to pass `isStatic` flag
- `test/class-name-access.test.ts`: Added tests for class name access
- `examples/rpc-method-example.ts`: Added example demonstrating the fix

## Compatibility

This fix maintains full compatibility with the TC39 Stage 3 decorator specification and doesn't break any existing functionality.
