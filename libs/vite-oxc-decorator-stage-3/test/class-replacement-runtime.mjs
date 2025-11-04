/**
 * Test to verify that class decorators properly replace the class
 * This tests whether the class returned by the decorator is actually used
 * 
 * Run with: node test/class-replacement-runtime.mjs
 */

import viteOxcDecoratorStage3 from '../dist/index.js';
import fs from 'fs';
import os from 'os';
import path from 'path';

async function test() {
  const plugin = viteOxcDecoratorStage3();
  await plugin.buildStart.call({});
  
  const code = `
    let constructorCalled = false;
    
    function replaceClass(value, { kind }) {
      if (kind === "class") {
        return class extends value {
          constructor(...args) {
            super(...args);
            constructorCalled = true;
          }
        };
      }
    }
    
    @replaceClass
    class TestClass {
      constructor(name) {
        this.name = name;
      }
    }
    
    // Create instance - should call the extended constructor
    const instance = new TestClass('Test');
    
    // Export for verification
    export { TestClass, instance, constructorCalled };
  `;
  
  console.log('Testing class replacement by decorator...\n');
  
  const transformResult = await plugin.transform(code, 'test.ts');
  if (!transformResult || typeof transformResult !== 'object' || !('code' in transformResult)) {
    throw new Error('❌ Transformation failed');
  }
  
  console.log('✅ Transformation successful!\n');
  
  // Save and try to execute
  const tmpFile = path.join(os.tmpdir(), 'class-replacement-runtime-test.mjs');
  fs.writeFileSync(tmpFile, transformResult.code);
  
  console.log('Executing transformed code...');
  try {
    const module = await import(tmpFile + '?t=' + Date.now());
    console.log('✅ Code executes without errors!');
    console.log('  - Instance created:', module.instance);
    console.log('  - Instance name:', module.instance.name);
    console.log('  - Constructor called flag:', module.constructorCalled);
    
    // The key test: was the extended constructor actually called?
    if (module.constructorCalled === true) {
      console.log('\n✅ Class decorator properly replaced the class!');
      console.log('   The extended constructor from the decorator was executed.');
    } else {
      console.error('\n❌ PROBLEM: Class decorator did NOT replace the class!');
      console.error('   The extended constructor from the decorator was NOT executed.');
      console.error('   This is the bug mentioned in the problem statement.');
      process.exit(1);
    }
  } catch (error) {
    console.error('❌ Runtime error:', error.message);
    console.error('\nStack:', error.stack);
    process.exit(1);
  }
}

test().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
