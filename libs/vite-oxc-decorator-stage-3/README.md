# vite-oxc-decorator-stage-3

> ⚠️ **AI-Generated Project**: This project was implemented by AI and has not yet been reviewed or rewritten by humans. Use with caution in production environments.

A Vite plugin for transforming TC39 Stage 3 decorators using Rust/WASM (oxc v0.96.0).

## Features

- ✅ Full TC39 Stage 3 decorator semantics
- ✅ All decorator types: class, method, field, accessor, getter, setter
- ✅ `addInitializer` API support
- ✅ Private and static members
- ✅ Rust/WASM transformer (production-ready)

## Installation

```bash
npm install vite-oxc-decorator-stage-3
```

## Usage

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import decorators from 'vite-oxc-decorator-stage-3';

export default defineConfig({
  plugins: [decorators()],
});
```

```typescript
// app.ts
function logged(value, { kind, name }) {
  if (kind === 'method') {
    return function(...args) {
      console.log(`Calling ${name}`);
      return value.apply(this, args);
    };
  }
}

class Calculator {
  @logged
  add(a, b) {
    return a + b;
  }
}
```

## Options

```typescript
interface ViteOxcDecoratorOptions {
  include?: RegExp | RegExp[];  // Default: [/\.[jt]sx?$/]
  exclude?: RegExp | RegExp[];  // Default: [/node_modules/]
}
```

## Development

```bash
# Install dependencies
npm install

# Build WASM and TypeScript
npm run build

# Run tests
npm test
```

## Requirements

- Vite 4.x or 5.x
- Node.js 16+

## License

MIT
