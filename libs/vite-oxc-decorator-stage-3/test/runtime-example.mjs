// Test the actual runtime behavior of decorators
import { transform } from '../pkg/decorator_transformer.js';

const code = `
// Decorator that logs when addInitializer is called
function logInit(value, context) {
  console.log('Decorator called for:', context.name, 'kind:', context.kind);
  
  context.addInitializer(function() {
    console.log('Initializer called for:', context.name);
  });
  
  if (context.kind === 'method') {
    return function(...args) {
      console.log('Method', context.name, 'called with:', args);
      return value.apply(this, args);
    };
  }
  
  if (context.kind === 'field') {
    return function(initialValue) {
      console.log('Field', context.name, 'initialized with:', initialValue);
      return initialValue;
    };
  }
  
  return value;
}

class TestClass {
  @logInit
  field = 42;
  
  @logInit
  method(x) {
    return x * 2;
  }
}

console.log('Creating instance...');
const instance = new TestClass();
console.log('Field value:', instance.field);
console.log('Calling method...');
const result = instance.method(5);
console.log('Method result:', result);
`;

console.log('Transforming code...\n');
const result = transform('test.js', code, '{}');

console.log('Result:', result);

if (result && typeof result === 'object' && 'tag' in result && result.tag === 'err') {
  console.error('Transformation error:', result.val);
  process.exit(1);
}

const transformedCode = result.code;
console.log('=== Transformed code ===\n');
// Show just the class part
const classStart = transformedCode.indexOf('class TestClass');
const classEnd = transformedCode.indexOf('\n\nconsole.log');
if (classStart !== -1 && classEnd !== -1) {
  console.log(transformedCode.substring(classStart, classEnd));
}
console.log('\n=== Running transformed code ===\n');

// Execute the transformed code
try {
  eval(transformedCode);
} catch (err) {
  console.error('Runtime error:', err.message);
  console.error(err.stack);
}
