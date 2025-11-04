/**
 * Runtime test for class decorator that returns a class extending the target
 * This tests the pattern: return class extends target {}
 * 
 * Run with: node test/class-extends-runtime.mjs
 */

import viteOxcDecoratorStage3 from '../dist/index.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function test() {
  const plugin = viteOxcDecoratorStage3();
  await plugin.buildStart.call({});
  
  const code = `
    function logged(value, { kind }) {
      if (kind === "class") {
        return class extends value {
          constructor(...args) {
            super(...args);
            console.log('Constructor called with:', args);
          }
        };
      }
    }
    
    @logged
    class TestClass {
      constructor(name) {
        this.name = name;
      }
      
      greet() {
        return 'Hello, ' + this.name;
      }
    }
    
    // Test that class can be instantiated and extended class works
    const instance = new TestClass('World');
    const result = instance.greet();
    
    // Export for verification
    export { TestClass, instance, result };
  `;
  
  console.log('Transforming code with class decorator that returns extended class...\n');
  
  const transformResult = await plugin.transform(code, 'test.ts');
  if (!transformResult || typeof transformResult !== 'object' || !('code' in transformResult)) {
    throw new Error('❌ Transformation failed');
  }
  
  console.log('✅ Transformation successful!\n');
  console.log('Transformed code:');
  console.log('=====================================');
  console.log(transformResult.code);
  console.log('=====================================\n');
  
  // Save and try to execute
  const tmpFile = path.join(os.tmpdir(), 'class-extends-runtime-test.mjs');
  fs.writeFileSync(tmpFile, transformResult.code);
  
  console.log('Executing transformed code...');
  try {
    const module = await import(tmpFile + '?t=' + Date.now());
    console.log('✅ Code executes without errors!');
    console.log('  - Class instantiated successfully');
    console.log('  - Instance name:', module.instance.name);
    console.log('  - Greet method returns:', module.result);
    
    // Verify the decorator worked
    if (module.instance.name === 'World' && module.result === 'Hello, World') {
      console.log('\n✅ Class decorator with "extends target" pattern works correctly!');
    } else {
      console.error('\n❌ Decorator did not work as expected');
      console.error('  - Expected result: "Hello, World", got:', module.result);
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Runtime error:', error.message);
    console.error('\nStack:', error.stack);
    console.error('\nThis indicates an issue with the class decorator implementation.');
    process.exit(1);
  }
}

test().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
