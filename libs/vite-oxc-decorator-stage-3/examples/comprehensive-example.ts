// Comprehensive example demonstrating all Stage 3 decorator types

// ============================================================================
// DECORATOR IMPLEMENTATIONS
// ============================================================================

/**
 * Method decorator that logs method calls
 */
function logged(value: Function, context: any) {
  if (context.kind === 'method') {
    return function (this: any, ...args: any[]) {
      console.log(`📞 Calling ${String(context.name)} with:`, args);
      const result = value.call(this, ...args);
      console.log(`✅ ${String(context.name)} returned:`, result);
      return result;
    };
  }
}

/**
 * Field decorator that validates initial value
 */
function validated(value: undefined, context: any) {
  if (context.kind === 'field') {
    return function (this: any, initialValue: any) {
      if (initialValue == null) {
        throw new Error(`Field ${String(context.name)} cannot be null or undefined`);
      }
      console.log(`✓ Validated field ${String(context.name)}:`, initialValue);
      return initialValue;
    };
  }
}

/**
 * Auto-accessor decorator that tracks changes
 */
function tracked(value: any, context: any) {
  if (context.kind === 'accessor') {
    const { get, set } = value;
    return {
      get(this: any) {
        const val = get.call(this);
        console.log(`📖 Reading ${String(context.name)}:`, val);
        return val;
      },
      set(this: any, newValue: any) {
        const oldValue = get.call(this);
        console.log(`📝 Updating ${String(context.name)} from`, oldValue, 'to', newValue);
        set.call(this, newValue);
      },
      init(this: any, initialValue: any) {
        console.log(`🎬 Initializing ${String(context.name)} with:`, initialValue);
        return initialValue;
      },
    };
  }
}

/**
 * Getter decorator
 */
function memoized(value: Function, context: any) {
  if (context.kind === 'getter') {
    const cache = new WeakMap();
    return function (this: any) {
      if (cache.has(this)) {
        console.log(`💾 Cache hit for ${String(context.name)}`);
        return cache.get(this);
      }
      const result = value.call(this);
      cache.set(this, result);
      console.log(`🔄 Computed and cached ${String(context.name)}:`, result);
      return result;
    };
  }
}

/**
 * Class decorator that adds metadata
 */
function metadata(data: Record<string, any>) {
  return function (value: any, context: any) {
    if (context.kind === 'class') {
      context.addInitializer(function (this: any) {
        this.metadata = data;
        console.log(`📋 Added metadata to ${context.name}:`, data);
      });
    }
  };
}

/**
 * Method decorator that binds method to instance
 */
function bound(value: Function, context: any) {
  if (context.kind === 'method') {
    context.addInitializer(function (this: any) {
      this[context.name] = this[context.name].bind(this);
      console.log(`🔗 Bound method ${String(context.name)} to instance`);
    });
  }
}

/**
 * Decorator for private methods
 */
function traced(value: Function, context: any) {
  if (context.kind === 'method' && context.private) {
    return function (this: any, ...args: any[]) {
      console.log(`🔒 Private method call: ${String(context.name)}`);
      return value.call(this, ...args);
    };
  }
  return value;
}

// ============================================================================
// EXAMPLE CLASSES
// ============================================================================

@metadata({ version: '1.0.0', author: 'Demo' })
class Counter {
  @validated
  name = 'MyCounter';

  @tracked
  accessor count = 0;

  @logged
  increment(amount = 1) {
    this.count += amount;
    return this.count;
  }

  @logged
  decrement(amount = 1) {
    this.count -= amount;
    return this.count;
  }

  @memoized
  get double() {
    // This will be computed only once
    return this.count * 2;
  }
}

class EventHandler {
  @validated
  eventName = 'click';

  @bound
  handleEvent() {
    console.log(`Handling ${this.eventName} event`);
    return this;
  }

  @traced
  #privateHelper() {
    return 'private result';
  }

  @logged
  callPrivate() {
    return this.#privateHelper();
  }
}

// ============================================================================
// USAGE DEMONSTRATION
// ============================================================================

export function runDemo() {
  console.log('='.repeat(80));
  console.log('🎯 Stage 3 Decorators Demo');
  console.log('='.repeat(80));
  console.log();

  // Test Counter class
  console.log('📦 Creating Counter instance...');
  const counter = new Counter();
  console.log();

  console.log('🔢 Testing methods...');
  counter.increment(5);
  counter.increment(3);
  counter.decrement(2);
  console.log();

  console.log('🔍 Testing memoized getter...');
  console.log('First access:', counter.double);
  console.log('Second access:', counter.double); // Should use cache
  console.log();

  console.log('📝 Testing tracked accessor...');
  console.log('Current count:', counter.count);
  counter.count = 20;
  console.log('Updated count:', counter.count);
  console.log();

  // Test EventHandler class
  console.log('🎪 Creating EventHandler instance...');
  const handler = new EventHandler();
  console.log();

  console.log('🔗 Testing bound method...');
  const detached = handler.handleEvent;
  detached(); // Still works because method is bound
  console.log();

  console.log('🔒 Testing private method call...');
  handler.callPrivate();
  console.log();

  console.log('='.repeat(80));
  console.log('✨ Demo completed!');
  console.log('='.repeat(80));
}

// Run demo if this is the main module
if (typeof window !== 'undefined') {
  window.addEventListener('DOMContentLoaded', () => {
    runDemo();
    
    // Add click handler for button
    const btn = document.getElementById('btn');
    if (btn) {
      const handler = new EventHandler();
      btn.addEventListener('click', handler.handleEvent);
    }
  });
}
