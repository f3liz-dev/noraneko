// Example demonstrating how to get class names from method decorators
// This example shows the exact use case from the problem statement

const _rpcMethods = new Map<string, Set<string | symbol>>();

/**
 * RPC method decorator that tracks which methods are RPC-enabled
 * Now works correctly for both instance and static methods
 */
export function rpcMethod(_: Function, context: ClassMethodDecoratorContext) {
  context.addInitializer(function () {
    // This initializer may be called with 'this' as the class (static)
    // or 'this' as the prototype (instance). We need the class name in both cases.
    const className =
      typeof this === "function" ? this.name : this.constructor.name;

    console.log("rpcMethodDecorator");

    if (!className) {
      console.error(
        "RPCMethod: Could not determine class name for decorator on method:",
        context.name,
      );
      return;
    }
    console.log(`Registered RPC method: ${className}.${String(context.name)}`);

    if (!_rpcMethods.has(className)) _rpcMethods.set(className, new Set());
    _rpcMethods.get(className)!.add(context.name);
  });
}

/**
 * Example class with RPC methods
 */
class UserService {
  @rpcMethod
  getUser(id: number) {
    return { id, name: "John Doe" };
  }

  @rpcMethod
  updateUser(id: number, data: any) {
    return { id, ...data };
  }

  @rpcMethod
  static getUserCount() {
    return 42;
  }
}

/**
 * Class decorator that extends the class
 * This demonstrates the fix for the issue where class decorators that return
 * extended classes would cause method decorators to lose access to the class name
 */
function withLogging<T extends { new (...args: any[]): {} }>(constructor: T) {
  return class extends constructor {
    logged = true;
  };
}

/**
 * Example with both class decorator and method decorators
 * This is the exact scenario from the problem statement
 */
@withLogging
class OrderService {
  @rpcMethod
  getOrder(id: number) {
    return { id, status: "shipped" };
  }

  @rpcMethod
  static getOrderCount() {
    return 200;
  }
}

/**
 * Another example class to show it works for multiple classes
 */
class ProductService {
  @rpcMethod
  getProduct(id: number) {
    return { id, name: "Product" };
  }

  @rpcMethod
  static getProductCount() {
    return 100;
  }
}

// Usage demonstration
export function demonstrateRPCMethods() {
  console.log('='.repeat(80));
  console.log('🎯 RPC Method Decorator Demo');
  console.log('='.repeat(80));
  console.log();

  // Create instances to trigger instance method initializers
  console.log('📦 Creating UserService instance...');
  const userService = new UserService();
  console.log();

  console.log('📦 Creating OrderService instance (with class decorator)...');
  const orderService = new OrderService();
  console.log();

  console.log('📦 Creating ProductService instance...');
  const productService = new ProductService();
  console.log();

  // Display registered RPC methods
  console.log('📋 Registered RPC Methods:');
  for (const [className, methods] of _rpcMethods) {
    console.log(`  ${className}:`);
    for (const method of methods) {
      console.log(`    - ${String(method)}`);
    }
  }
  console.log();

  console.log('='.repeat(80));
  console.log('✨ Demo completed!');
  console.log('='.repeat(80));
}

// Export the registry for inspection
export { _rpcMethods };

// Run demo automatically in browser context
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    demonstrateRPCMethods();
  });
}
