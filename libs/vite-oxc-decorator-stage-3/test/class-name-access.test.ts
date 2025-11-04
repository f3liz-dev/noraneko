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
      return { _rpcMethods, TestClass, TestClass2, instance, result };
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
      const _rpcMethods = new Map();

      function rpcMethod(_, context) {
        context.addInitializer(function () {
          const className =
            typeof this === "function" ? this.name : this.constructor.name;

          if (!className) {
            console.error(
              "RPCMethod: Could not determine class name for decorator on method:",
              context.name,
            );
            return;
          }

          if (!_rpcMethods.has(className)) _rpcMethods.set(className, new Set());
          _rpcMethods.get(className).add(context.name);
        });
      }

      class TestClass {
        @rpcMethod
        testMethod() {
          return "test";
        }
      }

      const instance = new TestClass();
      const result = _rpcMethods.has("TestClass") && _rpcMethods.get("TestClass").has("testMethod");
    `;

    const output = await transformCode(input);
    expect(output).toBeTruthy();
    expect(output).toContain('function rpcMethod');
    expect(output).toContain('static {');
    expect(output).not.toContain('@rpcMethod');
    
    // The transformation should include the initializer wrapper with isStatic flag
    expect(output).toContain('_initProto');
  });

  it('should allow accessing class name from static method decorator addInitializer', async () => {
    const input = `
      const _rpcMethods = new Map();

      function rpcMethod(_, context) {
        context.addInitializer(function () {
          const className =
            typeof this === "function" ? this.name : this.constructor.name;

          if (!className) {
            console.error(
              "RPCMethod: Could not determine class name for decorator on method:",
              context.name,
            );
            return;
          }

          if (!_rpcMethods.has(className)) _rpcMethods.set(className, new Set());
          _rpcMethods.get(className).add(context.name);
        });
      }

      class TestClass2 {
        @rpcMethod
        static staticMethod() {
          return "static";
        }
      }

      const result = _rpcMethods.has("TestClass2") && _rpcMethods.get("TestClass2").has("staticMethod");
    `;

    const output = await transformCode(input);
    expect(output).toBeTruthy();
    expect(output).toContain('function rpcMethod');
    expect(output).toContain('static {');
    expect(output).not.toContain('@rpcMethod');
    
    // Static method decorators should use _initClass
    expect(output).toContain('_initClass');
  });

  it('should work for multiple methods on the same class', async () => {
    const input = `
      const _rpcMethods = new Map();

      function rpcMethod(_, context) {
        context.addInitializer(function () {
          const className =
            typeof this === "function" ? this.name : this.constructor.name;

          if (!_rpcMethods.has(className)) _rpcMethods.set(className, new Set());
          _rpcMethods.get(className).add(context.name);
        });
      }

      class MultiMethodClass {
        @rpcMethod
        method1() {}

        @rpcMethod
        method2() {}

        @rpcMethod
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
