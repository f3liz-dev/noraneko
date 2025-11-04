import { describe, it, expect } from 'vitest';
import viteOxcDecoratorStage3 from '../src/index';

describe('Method Decorator addInitializer', () => {
  async function transformCode(code: string): Promise<string> {
    const plugin = viteOxcDecoratorStage3();
    await plugin.buildStart!.call({} as any);
    
    const result = await plugin.transform!(code, 'test.ts');
    if (!result || typeof result !== 'object' || !('code' in result)) {
      throw new Error('Transformation failed');
    }
    
    return result.code;
  }

  it('should call addInitializer on method decorators', async () => {
    const input = `
      function bound(value, { name, addInitializer }) {
        addInitializer(function () {
          this[name] = this[name].bind(this);
        });
      }

      class C {
        @bound
        m() {
          console.log(this);
        }
      }
    `;

    const output = await transformCode(input);
    expect(output).toBeTruthy();
    expect(output).toContain('function bound');
    expect(output).toContain('static {');
    expect(output).not.toContain('@bound');
    // Should have constructor with _initProto call
    expect(output).toContain('constructor');
    expect(output).toContain('_initProto');
  });

  it('should call addInitializer on getter decorators', async () => {
    const input = `
      function logged(value, { name, addInitializer }) {
        addInitializer(function () {
          console.log('Initializing getter:', name);
        });
        return value;
      }

      class C {
        @logged
        get x() {
          return this._x;
        }
      }
    `;

    const output = await transformCode(input);
    expect(output).toBeTruthy();
    expect(output).toContain('function logged');
    expect(output).toContain('static {');
    expect(output).not.toContain('@logged');
    expect(output).toContain('constructor');
    expect(output).toContain('_initProto');
  });

  it('should call addInitializer on setter decorators', async () => {
    const input = `
      function logged(value, { name, addInitializer }) {
        addInitializer(function () {
          console.log('Initializing setter:', name);
        });
        return value;
      }

      class C {
        @logged
        set x(val) {
          this._x = val;
        }
      }
    `;

    const output = await transformCode(input);
    expect(output).toBeTruthy();
    expect(output).toContain('function logged');
    expect(output).toContain('static {');
    expect(output).not.toContain('@logged');
    expect(output).toContain('constructor');
    expect(output).toContain('_initProto');
  });

  it('should handle multiple decorators with addInitializer', async () => {
    const input = `
      function decorator1(value, { addInitializer }) {
        addInitializer(function () {
          console.log('Init 1');
        });
      }

      function decorator2(value, { addInitializer }) {
        addInitializer(function () {
          console.log('Init 2');
        });
      }

      class C {
        @decorator1
        @decorator2
        method() {}
      }
    `;

    const output = await transformCode(input);
    expect(output).toBeTruthy();
    expect(output).toContain('function decorator1');
    expect(output).toContain('function decorator2');
    expect(output).toContain('static {');
    expect(output).toContain('constructor');
    expect(output).toContain('_initProto');
  });
});
