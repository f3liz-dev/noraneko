import { describe, it, expect } from 'vitest';
import viteOxcDecoratorStage3 from '../src/index';

describe('Class Decorator Replacement', () => {
  async function transformCode(code: string): Promise<string> {
    const plugin = viteOxcDecoratorStage3();
    await plugin.buildStart!.call({} as any);
    
    const result = await plugin.transform!(code, 'test.ts');
    if (!result || typeof result !== 'object' || !('code' in result)) {
      throw new Error('Transformation failed');
    }
    
    return result.code;
  }

  it('should properly replace class when decorator returns extended class', async () => {
    const input = `
      function logged(value, { kind }) {
        if (kind === "class") {
          return class extends value {
            constructor(...args) {
              super(...args);
              this.logged = true;
            }
          };
        }
      }

      @logged
      class TestClass {
        constructor(name) {
          this.name = name;
        }
      }
    `;

    const output = await transformCode(input);
    
    // Should convert class declaration to class expression
    expect(output).toContain('let TestClass = class TestClass');
    
    // Should apply decorator after class definition
    expect(output).toContain('TestClass = _applyDecs(TestClass, [], [logged]).c[0]');
    
    // Static block should use .e for members only (empty in this case) with empty class decorators array
    expect(output).toContain('[_initProto, _initClass] = _applyDecs(this, [], []).e');
  });

  it('should handle export default class with decorator', async () => {
    const input = `
      function logged(value) {
        return class extends value {};
      }

      @logged
      export default class MyClass {
        method() {}
      }
    `;

    const output = await transformCode(input);
    
    // Should convert to class expression with variable
    expect(output).toContain('let MyClass = class MyClass');
    
    // Should apply decorator
    expect(output).toContain('MyClass = _applyDecs(MyClass, [], [logged]).c[0]');
    
    // Should export the transformed class
    expect(output).toContain('export default MyClass');
  });

  it('should handle export named class with decorator', async () => {
    const input = `
      function logged(value) {
        return class extends value {};
      }

      @logged
      export class MyClass {
        method() {}
      }
    `;

    const output = await transformCode(input);
    
    // Should convert to class expression with variable
    expect(output).toContain('let MyClass = class MyClass');
    
    // Should apply decorator
    expect(output).toContain('MyClass = _applyDecs(MyClass, [], [logged]).c[0]');
    
    // Should export the transformed class
    expect(output).toContain('export { MyClass }');
  });

  it('should handle class with both member and class decorators', async () => {
    const input = `
      function classDecorator(value) {
        return class extends value {
          decorated = true;
        };
      }
      
      function methodDecorator(value) {
        return value;
      }

      @classDecorator
      class TestClass {
        @methodDecorator
        method() {}
      }
    `;

    const output = await transformCode(input);
    
    // Should convert class to expression
    expect(output).toContain('let TestClass = class TestClass');
    
    // Should apply class decorator separately
    expect(output).toContain('TestClass = _applyDecs(TestClass, [], [classDecorator]).c[0]');
    
    // Static block should handle member decorators with .e and empty class decorators array
    expect(output).toMatch(/\[_initProto, _initClass\] = _applyDecs\(this,[\s\S]*methodDecorator[\s\S]*,\s*\[\]\)\.e/);
  });
});
