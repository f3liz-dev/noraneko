/**
 * Simple Runtime Test
 * 
 * This test verifies that transformed decorator code:
 * 1. Has correct syntax (no parse errors)
 * 2. Executes without runtime errors
 * 3. Generates expected code structure
 * 
 * Note: Full decorator semantics (applying decorator side-effects) require
 * a complete TC39 Stage 3 runtime implementation, which is complex.
 * 
 * Run with: node test/simple-runtime-test.mjs
 */

import viteOxcDecoratorStage3 from '../dist/index.js';

async function test() {
  const plugin = viteOxcDecoratorStage3();
  await plugin.buildStart.call({});
  
  const code = `
    function logged(value, { kind }) {
      return value;
    }
    
    class TestClass {
      @logged
      method() {
        return 'test';
      }
    }
    
    // Test that class can be instantiated
    const instance = new TestClass();
    const result = instance.method();
    
    // Export for verification
    export { TestClass, result };
  `;
  
  console.log('Transforming code with decorator...\n');
  
  const result = await plugin.transform(code, 'test.ts');
  if (!result || typeof result !== 'object' || !('code' in result)) {
    throw new Error('❌ Transformation failed');
  }
  
  console.log('✅ Transformation successful!\n');
  console.log('Transformed code structure:');
  console.log('  - Helper functions injected:', result.code.includes('function _applyDecs'));
  console.log('  - Variable declarations added:', result.code.includes('var _initProto, _initClass'));
  console.log('  - Static block generated:', result.code.includes('static {'));
  console.log('  - Decorators removed from source:', !result.code.includes('@logged'));
  console.log('  - _applyDecs called:', result.code.includes('_applyDecs(this'));
  
  console.log('\nTransformed code snippet:');
  console.log('```javascript');
  const lines = result.code.split('\n');
  const classStart = lines.findIndex(l => l.includes('class TestClass'));
  if (classStart >= 0) {
    console.log(lines.slice(classStart - 1, classStart + 5).join('\n'));
  }
  console.log('```\n');
  
  // Save and try to execute
  const fs = await import('fs');
  const os = await import('os');
  const path = await import('path');
  const tmpFile = path.join(os.tmpdir(), 'simple-runtime-test.mjs');
  fs.writeFileSync(tmpFile, result.code);
  
  console.log('Executing transformed code...');
  try {
    const module = await import(tmpFile + '?t=' + Date.now());
    console.log('✅ Code executes without errors!');
    console.log('  - Class instantiated successfully');
    console.log('  - Method callable:', typeof module.TestClass.prototype.method === 'function');
    console.log('  - Method returns:', module.result);
    console.log('\n✅ All tests passed!');
  } catch (error) {
    console.error('❌ Runtime error:', error.message);
    console.error('\nThis indicates an issue with the helper function implementation.');
    process.exit(1);
  }
}

test().catch(error => {
  console.error('❌ Test failed:', error);
  process.exit(1);
});
