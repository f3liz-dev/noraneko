import { describe, it, expect } from 'vitest';
import viteOxcDecoratorStage3 from '../src/index';

describe('Vite Plugin', () => {
  it('should create plugin with correct name', () => {
    const plugin = viteOxcDecoratorStage3();
    expect(plugin.name).toBe('vite-oxc-decorator-stage-3');
  });

  it('should enforce pre order', () => {
    const plugin = viteOxcDecoratorStage3();
    expect(plugin.enforce).toBe('pre');
  });

  it('should have transform function', () => {
    const plugin = viteOxcDecoratorStage3();
    expect(typeof plugin.transform).toBe('function');
  });

  it('should have buildStart function', () => {
    const plugin = viteOxcDecoratorStage3();
    expect(typeof plugin.buildStart).toBe('function');
  });

  describe('transform', () => {
    it('should skip files without @ symbol', async () => {
      const plugin = viteOxcDecoratorStage3();
      const code = 'class C { method() {} }';
      const result = await plugin.transform!(code, 'test.ts');
      expect(result).toBeNull();
    });

    it('should skip excluded files', async () => {
      const plugin = viteOxcDecoratorStage3({
        exclude: [/test\.ts$/],
      });
      const code = '@decorator class C {}';
      const result = await plugin.transform!(code, 'test.ts');
      expect(result).toBeNull();
    });

    // Note: These tests will fail until WASM module is built
    // They are kept here for compatibility testing with Babel
    it.skip('should transform files with decorators', async () => {
      const plugin = viteOxcDecoratorStage3();
      const code = `
        function logged(value) { return value; }
        class C {
          @logged
          method() {}
        }
      `;
      const result = await plugin.transform!(code, 'test.ts');
      expect(result).not.toBeNull();
      if (result && typeof result === 'object' && 'code' in result) {
        expect(result.code).toBeTruthy();
        expect(typeof result.code).toBe('string');
      }
    });

    it.skip('should include source maps', async () => {
      const plugin = viteOxcDecoratorStage3();
      const code = `
        function logged(value) { return value; }
        class C {
          @logged
          method() {}
        }
      `;
      const result = await plugin.transform!(code, 'test.ts');
      if (result && typeof result === 'object' && 'map' in result) {
        expect(result.map).toBeTruthy();
      }
    });
  });

  describe('options', () => {
    it('should accept custom include patterns', () => {
      const plugin = viteOxcDecoratorStage3({
        include: [/\.tsx?$/],
      });
      expect(plugin.name).toBe('vite-oxc-decorator-stage-3');
    });

    it('should accept custom exclude patterns', () => {
      const plugin = viteOxcDecoratorStage3({
        exclude: [/node_modules/, /\.spec\.ts$/],
      });
      expect(plugin.name).toBe('vite-oxc-decorator-stage-3');
    });
  });
});
