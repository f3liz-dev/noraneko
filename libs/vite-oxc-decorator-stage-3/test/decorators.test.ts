import { describe, it, expect } from 'vitest';
import { transformAsync } from '@babel/core';
// @ts-expect-error - Babel plugin types
import decoratorsPlugin from '@babel/plugin-proposal-decorators';

describe('Stage 3 Decorator Transformation', () => {
  async function transformCode(code: string): Promise<string> {
    const result = await transformAsync(code, {
      plugins: [[decoratorsPlugin, { version: '2023-11' }]],
    });
    return result?.code || '';
  }

  describe('Class Method Decorators', () => {
    it('should transform method decorator', async () => {
      const input = `
        function logged(value, { kind, name }) {
          if (kind === "method") {
            return function (...args) {
              console.log(\`starting \${name}\`);
              const ret = value.call(this, ...args);
              console.log(\`ending \${name}\`);
              return ret;
            };
          }
        }

        class C {
          @logged
          m(arg) {
            return arg * 2;
          }
        }
      `;

      const output = await transformCode(input);
      expect(output).toBeTruthy();
      expect(output).toContain('function logged');
      expect(output).toContain('class C');
    });
  });

  describe('Class Field Decorators', () => {
    it('should transform field decorator', async () => {
      const input = `
        function logged(value, { kind, name }) {
          if (kind === "field") {
            return function (initialValue) {
              console.log(\`initializing \${name} with value \${initialValue}\`);
              return initialValue;
            };
          }
        }

        class C {
          @logged x = 1;
        }
      `;

      const output = await transformCode(input);
      expect(output).toBeTruthy();
      expect(output).toContain('function logged');
    });
  });

  describe('Class Auto-Accessor Decorators', () => {
    it('should transform accessor decorator', async () => {
      const input = `
        function logged(value, { kind, name }) {
          if (kind === "accessor") {
            let { get, set } = value;
            return {
              get() {
                console.log(\`getting \${name}\`);
                return get.call(this);
              },
              set(val) {
                console.log(\`setting \${name} to \${val}\`);
                return set.call(this, val);
              },
              init(initialValue) {
                console.log(\`initializing \${name} with value \${initialValue}\`);
                return initialValue;
              }
            };
          }
        }

        class C {
          @logged accessor x = 1;
        }
      `;

      const output = await transformCode(input);
      expect(output).toBeTruthy();
      expect(output).toContain('function logged');
    });
  });

  describe('Class Decorators', () => {
    it('should transform class decorator', async () => {
      const input = `
        function logged(value, { kind, name }) {
          if (kind === "class") {
            return class extends value {
              constructor(...args) {
                super(...args);
                console.log(\`constructing an instance of \${name}\`);
              }
            };
          }
        }

        @logged
        class C {
          constructor() {}
        }
      `;

      const output = await transformCode(input);
      expect(output).toBeTruthy();
      expect(output).toContain('function logged');
    });
  });

  describe('Getter/Setter Decorators', () => {
    it('should transform getter decorator', async () => {
      const input = `
        function logged(value, { kind, name }) {
          if (kind === "getter") {
            return function (...args) {
              console.log(\`getting \${name}\`);
              const ret = value.call(this, ...args);
              console.log(\`got \${name}\`);
              return ret;
            };
          }
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
    });

    it('should transform setter decorator', async () => {
      const input = `
        function logged(value, { kind, name }) {
          if (kind === "setter") {
            return function (...args) {
              console.log(\`setting \${name}\`);
              const ret = value.call(this, ...args);
              console.log(\`set \${name}\`);
              return ret;
            };
          }
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
    });
  });

  describe('addInitializer', () => {
    it('should support addInitializer with class decorators', async () => {
      const input = `
        function customElement(name) {
          return (value, { addInitializer }) => {
            addInitializer(function() {
              customElements.define(name, this);
            });
          };
        }

        @customElement('my-element')
        class MyElement extends HTMLElement {}
      `;

      const output = await transformCode(input);
      expect(output).toBeTruthy();
      expect(output).toContain('function customElement');
    });

    it('should support addInitializer with method decorators', async () => {
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
    });
  });

  describe('Multiple decorators', () => {
    it('should handle multiple decorators on same element', async () => {
      const input = `
        function first(value) { return value; }
        function second(value) { return value; }

        class C {
          @first
          @second
          method() {}
        }
      `;

      const output = await transformCode(input);
      expect(output).toBeTruthy();
      expect(output).toContain('function first');
      expect(output).toContain('function second');
    });
  });

  describe('Private members', () => {
    it('should handle decorators on private methods', async () => {
      const input = `
        function logged(value) { return value; }

        class C {
          @logged
          #privateMethod() {
            return 42;
          }
        }
      `;

      const output = await transformCode(input);
      expect(output).toBeTruthy();
      expect(output).toContain('function logged');
    });

    it('should handle decorators on private fields', async () => {
      const input = `
        function logged(value) { 
          return function(initialValue) { return initialValue; }
        }

        class C {
          @logged
          #privateField = 42;
        }
      `;

      const output = await transformCode(input);
      expect(output).toBeTruthy();
      expect(output).toContain('function logged');
    });
  });

  describe('Static members', () => {
    it('should handle decorators on static methods', async () => {
      const input = `
        function logged(value) { return value; }

        class C {
          @logged
          static staticMethod() {
            return 42;
          }
        }
      `;

      const output = await transformCode(input);
      expect(output).toBeTruthy();
      expect(output).toContain('function logged');
    });

    it('should handle decorators on static fields', async () => {
      const input = `
        function logged(value) { 
          return function(initialValue) { return initialValue; }
        }

        class C {
          @logged
          static staticField = 42;
        }
      `;

      const output = await transformCode(input);
      expect(output).toBeTruthy();
      expect(output).toContain('function logged');
    });
  });
});
