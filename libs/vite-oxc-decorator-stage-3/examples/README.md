# Examples

> ⚠️ **AI-Generated**: These examples were created by AI.

Examples demonstrating TC39 Stage 3 decorator usage with this plugin.

## Running Examples

```bash
cd examples
npm install
npm run dev
```

## Files

- `example.ts` - Basic decorator examples
- `comprehensive-example.ts` - All decorator types
- `index.html` - Demo page
- `vite.config.ts` - Vite configuration

## Quick Example

```typescript
function logged(value, { kind, name }) {
  if (kind === 'method') {
    return function(...args) {
      console.log(`${name} called`);
      return value.apply(this, args);
    };
  }
}

class Example {
  @logged
  greet(name) {
    return `Hello ${name}`;
  }
}
```
