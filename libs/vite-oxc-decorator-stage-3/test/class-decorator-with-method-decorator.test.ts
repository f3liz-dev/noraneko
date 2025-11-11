import { describe, it, expect } from 'vitest';
import viteOxcDecoratorStage3 from '../src/index';

/**
 * Test for the issue described in the problem statement:
 * "applying class method decorator and class decorator that uses 
 * `return class extends target`, in method decorator, it is almost 
 * unable to get class's name to identify."
 */
describe('Class Decorator Replacement with Method Decorator', () => {
  async function transformCode(code: string): Promise<string> {
    const plugin = viteOxcDecoratorStage3();
    await plugin.buildStart!.call({} as any);
    
    const result = await plugin.transform!(code, 'test.ts');
    if (!result || typeof result !== 'object' || !('code' in result)) {
      throw new Error('Transformation failed');
    }
    
    return result.code;
  }

  async function transformAndEvaluate(code: string, vars: string[] = ['_eventMethods', 'service']): Promise<any> {
    const transformed = await transformCode(code);
    
    // Create a function that evaluates the transformed code and returns the result
    const returnVars = `{ ${vars.join(', ')} }`;
    const evalFunc = new Function('console', `
      ${transformed}
      return ${returnVars};
    `);
    
    // Mock console for capturing logs
    const logs: string[] = [];
    const mockConsole = {
      log: (...args: any[]) => logs.push(args.join(' ')),
      error: (...args: any[]) => logs.push('ERROR: ' + args.join(' ')),
    };
    
    const result = evalFunc(mockConsole);
    result.logs = logs;
    return result;
  }

  it('should preserve class name when class decorator returns extended class', async () => {
    const input = `
      const _eventMethods = new Map();

      function eventMethod(_value, context) {
        context.addInitializer(function () {
          const className = context.static ? this.name : this.constructor.name;

          if (!className) {
            console.error(
              "EventMethod: Could not determine class name for decorator on method:",
              context.name,
            );
            return;
          }

          if (!_eventMethods.has(className)) _eventMethods.set(className, new Set());
          _eventMethods.get(className).add(context.name);
        });
      }

      function classDecorator(value, context) {
        return class extends value {
          decorated = true;
        };
      }

      @classDecorator
      class UserService {
        @eventMethod
        getUser(id) {
          return { id, name: "John" };
        }

        @eventMethod
        static getUserCount() {
          return 42;
        }
      }

      const service = new UserService();
    `;

    const result = await transformAndEvaluate(input, ['_eventMethods', 'UserService', 'service']);
    
    // Verify that the class name was correctly identified
    expect(result._eventMethods.has("UserService")).toBe(true);
    
    // Verify that both methods were registered
    const methods = result._eventMethods.get("UserService");
    expect(methods.has("getUser")).toBe(true);
    expect(methods.has("getUserCount")).toBe(true);
    
    // Verify that the class decorator was applied (decorated property exists)
    expect(result.service.decorated).toBe(true);
    
    // Verify that no errors were logged
    const errors = result.logs.filter((log: string) => log.startsWith('ERROR:'));
    expect(errors).toHaveLength(0);
  });

  it('should work with multiple class decorators that return extended classes', async () => {
    const input = `
      const _eventMethods = new Map();

      function eventMethod(_value, context) {
        context.addInitializer(function () {
          const className = context.static ? this.name : this.constructor.name;
          if (!className) return;
          if (!_eventMethods.has(className)) _eventMethods.set(className, new Set());
          _eventMethods.get(className).add(context.name);
        });
      }

      function decorator1(value) {
        return class extends value {
          prop1 = true;
        };
      }

      function decorator2(value) {
        return class extends value {
          prop2 = true;
        };
      }

      @decorator1
      @decorator2
      class TestClass {
        @eventMethod
        method1() {}

        @eventMethod
        static method2() {}
      }

      const service = new TestClass();
    `;

    const result = await transformAndEvaluate(input, ['_eventMethods', 'TestClass', 'service']);
    
    // Verify that the class name was correctly identified
    expect(result._eventMethods.has("TestClass")).toBe(true);
    
    // Verify that both methods were registered
    const methods = result._eventMethods.get("TestClass");
    expect(methods.has("method1")).toBe(true);
    expect(methods.has("method2")).toBe(true);
  });

  it('should preserve class name with class decorator that modifies but does not extend', async () => {
    const input = `
      const _eventMethods = new Map();

      function eventMethod(_value, context) {
        context.addInitializer(function () {
          const className = context.static ? this.name : this.constructor.name;
          if (!className) return;
          if (!_eventMethods.has(className)) _eventMethods.set(className, new Set());
          _eventMethods.get(className).add(context.name);
        });
      }

      function addProperty(value) {
        value.prototype.added = true;
        return value;
      }

      @addProperty
      class MyClass {
        @eventMethod
        myMethod() {}
      }

      const service = new MyClass();
    `;

    const result = await transformAndEvaluate(input, ['_eventMethods', 'MyClass', 'service']);
    
    // Verify that the class name was correctly identified
    expect(result._eventMethods.has("MyClass")).toBe(true);
    expect(result._eventMethods.get("MyClass").has("myMethod")).toBe(true);
  });

  it('should work correctly when class decorator returns undefined', async () => {
    const input = `
      const _eventMethods = new Map();

      function eventMethod(_value, context) {
        context.addInitializer(function () {
          const className = context.static ? this.name : this.constructor.name;
          if (!className) return;
          if (!_eventMethods.has(className)) _eventMethods.set(className, new Set());
          _eventMethods.get(className).add(context.name);
        });
      }

      function noOpDecorator(value) {
        // Returns undefined, which means no replacement
      }

      @noOpDecorator
      class SimpleClass {
        @eventMethod
        simpleMethod() {}
      }

      const service = new SimpleClass();
    `;

    const result = await transformAndEvaluate(input, ['_eventMethods', 'SimpleClass', 'service']);
    
    // Verify that the class name was correctly identified
    expect(result._eventMethods.has("SimpleClass")).toBe(true);
    expect(result._eventMethods.get("SimpleClass").has("simpleMethod")).toBe(true);
  });
});
