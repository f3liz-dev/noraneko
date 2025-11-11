import { describe, it, expect } from 'vitest';
import viteOxcDecoratorStage3 from '../src/index';

describe('Class Name Access in Method Decorator', () => {
  async function transformCode(code: string): Promise<string> {
    const plugin = viteOxcDecoratorStage3();
    await plugin.buildStart!.call({} as any);
    
    const result = await plugin.transform!(code, 'test.ts');
    if (!result || typeof result !== 'object' || !('code' in result)) {
      throw new Error('Transformation failed');
    }
    
    return result.code;
  }

  async function transformAndEvaluate(code: string): Promise<any> {
    const transformed = await transformCode(code);
    
    // Create a function that evaluates the transformed code and returns the result
    const evalFunc = new Function('console', `
      ${transformed}
      return { _eventMethods, TestClass, TestClass2, instance, result };
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

  it('should allow accessing class name from instance method decorator addInitializer', async () => {
    const input = `
      const _eventMethods = new Map();

      function eventMethod(_, context) {
        context.addInitializer(function () {
          const className =
            typeof this === "function" ? this.name : this.constructor.name;

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

      class TestClass {
        @eventMethod
        testMethod() {
          return "test";
        }
      }

      const instance = new TestClass();
      const result = _eventMethods.has("TestClass") && _eventMethods.get("TestClass").has("testMethod");
    `;

    const output = await transformCode(input);
    expect(output).toBeTruthy();
    expect(output).toContain('function eventMethod');
    expect(output).toContain('static {');
    expect(output).not.toContain('@eventMethod');
    
    // The transformation should include the initializer wrapper with isStatic flag
    expect(output).toContain('_initProto');
  });

  it('should allow accessing class name from static method decorator addInitializer', async () => {
    const input = `
      const _eventMethods = new Map();

      function eventMethod(_, context) {
        context.addInitializer(function () {
          const className =
            typeof this === "function" ? this.name : this.constructor.name;

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

      class TestClass2 {
        @eventMethod
        static staticMethod() {
          return "static";
        }
      }

      const result = _eventMethods.has("TestClass2") && _eventMethods.get("TestClass2").has("staticMethod");
    `;

    const output = await transformCode(input);
    expect(output).toBeTruthy();
    expect(output).toContain('function eventMethod');
    expect(output).toContain('static {');
    expect(output).not.toContain('@eventMethod');
    
    // Static method decorators should use _initClass
    expect(output).toContain('_initClass');
  });

  it('should work for multiple methods on the same class', async () => {
    const input = `
      const _eventMethods = new Map();

      function eventMethod(_, context) {
        context.addInitializer(function () {
          const className =
            typeof this === "function" ? this.name : this.constructor.name;

          if (!_eventMethods.has(className)) _eventMethods.set(className, new Set());
          _eventMethods.get(className).add(context.name);
        });
      }

      class MultiMethodClass {
        @eventMethod
        method1() {}

        @eventMethod
        method2() {}

        @eventMethod
        static staticMethod1() {}
      }

      const instance = new MultiMethodClass();
    `;

    const output = await transformCode(input);
    expect(output).toBeTruthy();
    expect(output).toContain('static {');
    // Should handle multiple decorators correctly
    expect(output).toContain('_initProto');
    expect(output).toContain('_initClass');
  });
});
