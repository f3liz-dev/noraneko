// Comprehensive test demonstrating TC39 Stage 3 decorator side-effects
import { transform } from '../pkg/decorator_transformer.js';

const code = `
// Track initialization order
const log = [];

// Decorator with addInitializer for methods
function bound(value, context) {
  if (context.kind === 'method') {
    context.addInitializer(function() {
      log.push('Method initializer: ' + context.name);
      this[context.name] = this[context.name].bind(this);
    });
    return value;
  }
}

// Decorator with addInitializer for fields
function logged(value, context) {
  if (context.kind === 'field') {
    context.addInitializer(function() {
      log.push('Field initializer: ' + context.name);
    });
    return function(initialValue) {
      log.push('Field ' + context.name + ' = ' + initialValue);
      return initialValue;
    };
  }
}

// Decorator for class
function registry(value, context) {
  if (context.kind === 'class') {
    context.addInitializer(function() {
      log.push('Class initializer: ' + context.name);
    });
  }
  return value;
}

@registry
class TestClass {
  @logged
  field = 42;
  
  @bound
  method() {
    return this.field;
  }
}

// Test the functionality
log.push('Creating instance...');
const instance = new TestClass();
log.push('Instance created');
log.push('Field value: ' + instance.field);
log.push('Method result: ' + instance.method());

// Print the log
console.log('Execution log:');
log.forEach((entry, i) => console.log(\`  \${i + 1}. \${entry}\`));
`;

console.log('=== Transforming Code ===\n');
const result = transform('test.js', code, '{}');

if (result && typeof result === 'object' && 'tag' in result && result.tag === 'err') {
  console.error('Transformation error:', result.val);
  process.exit(1);
}

console.log('Transformation successful!\n');
console.log('=== Executing Transformed Code ===\n');

try {
  eval(result.code);
  console.log('\n✅ Test completed successfully!');
} catch (err) {
  console.error('\n❌ Runtime error:', err.message);
  console.error(err.stack);
  process.exit(1);
}
