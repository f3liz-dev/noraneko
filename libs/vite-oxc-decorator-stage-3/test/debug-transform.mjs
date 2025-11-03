import { transform } from '../pkg/decorator_transformer.js';

const code = `
function logInit(value, context) {
  return value;
}

class TestClass {
  @logInit
  field = 42;
}
`;

const result = transform('test.js', code, '{}');
console.log(result.code);
