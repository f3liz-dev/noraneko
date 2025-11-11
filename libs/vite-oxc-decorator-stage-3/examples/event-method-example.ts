// Example demonstrating how to get class names from method decorators
// This example shows the exact use case from the problem statement

const _eventMethods = new Map<string, Set<string | symbol>>();

/**
 * Event method decorator that tracks which methods are event-enabled
 * Now works correctly for both instance and static methods
 */
export function eventMethod(_: Function, context: ClassMethodDecoratorContext) {
  context.addInitializer(function () {
    // This initializer may be called with 'this' as the class (static)
    // or 'this' as the prototype (instance). We need the class name in both cases.
    const className =
      typeof this === "function" ? this.name : this.constructor.name;

    console.log("eventMethodDecorator");

    if (!className) {
      console.error(
        "EventMethod: Could not determine class name for decorator on method:",
        context.name,
      );
      return;
    }
    console.log(`Registered event method: ${className}.${String(context.name)}`);

    if (!_eventMethods.has(className)) _eventMethods.set(className, new Set());
    _eventMethods.get(className)!.add(context.name);
  });
}

/**
 * Example class with event methods
 */
class UserService {
  @eventMethod
  getUser(id: number) {
    return { id, name: "John Doe" };
  }

  @eventMethod
  updateUser(id: number, data: any) {
    return { id, ...data };
  }

  @eventMethod
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
  @eventMethod
  getOrder(id: number) {
    return { id, status: "shipped" };
  }

  @eventMethod
  static getOrderCount() {
    return 200;
  }
}

/**
 * Another example class to show it works for multiple classes
 */
class ProductService {
  @eventMethod
  getProduct(id: number) {
    return { id, name: "Product" };
  }

  @eventMethod
  static getProductCount() {
    return 100;
  }
}

// Usage demonstration
export function demonstrateEventMethods() {
  console.log('='.repeat(80));
  console.log('🎯 Event Method Decorator Demo');
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

  // Display registered event methods
  console.log('📋 Registered Event Methods:');
  for (const [className, methods] of _eventMethods) {
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
export { _eventMethods };

// Run demo automatically in browser context
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    demonstrateEventMethods();
  });
}
