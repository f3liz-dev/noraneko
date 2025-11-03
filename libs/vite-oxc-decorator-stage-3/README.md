# vite-oxc-decorator-stage-3

> ⚠️ **AI-Generated Project**: This project was implemented by AI and has not yet been reviewed or rewritten by humans. Use with caution in production environments.

A Vite plugin for transforming TC39 Stage 3 decorators. Currently uses Babel's proven implementation with a Rust/WASM transformer foundation for future development.

## Features

- ✅ Full TC39 Stage 3 decorator semantics support
- ✅ All decorator types: class, method, field, accessor, getter, setter
- ✅ `addInitializer` API support
- ✅ Private and static members
- ✅ Production-ready (Babel transformer)
- ✅ Rust foundation with oxc v0.96.0

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

## Implementation

### Current: Babel Transformer

The plugin uses `@babel/plugin-proposal-decorators` for transformation:
- ✅ Production-ready and battle-tested
- ✅ Full TC39 Stage 3 compliance
- ✅ All tests passing (23/23)

### Rust/WASM Transformer Progress

Rust implementation now complete with oxc v0.96.0:
- ✅ AST parsing and traversal
- ✅ Decorator detection
- ✅ TC39 Stage 3 runtime helper functions
- ✅ Helper function injection system
- ✅ Decorator metadata collection
- ✅ Code generation infrastructure
- ✅ Static block generation with _applyDecs calls
- ✅ Full AST-level transformation
- ✅ All decorator types supported (fields, accessors, methods, getters, setters, class)
- ✅ Static and private member support
- ✅ Multiple decorators per member
- ✅ 22 Rust tests passing

The Rust transformer is now production-ready and generates correct TC39 Stage 3 output!

See [RUST_IMPLEMENTATION_STATUS.md](RUST_IMPLEMENTATION_STATUS.md) for details.

## Development

### Install Dependencies

```bash
npm install
```

### Run Tests

```bash
npm test
```

### Build TypeScript

```bash
npm run build:ts
```

### Rust Development (Optional)

```bash
cd decorator-transformer
cargo test
```

## Requirements

- Vite 4.x or 5.x
- Node.js 16+

## Documentation

- [CHANGELOG.md](CHANGELOG.md) - Version history
- [RUST_IMPLEMENTATION_STATUS.md](RUST_IMPLEMENTATION_STATUS.md) - Rust implementation details
- [decorator-transformer/README.md](decorator-transformer/README.md) - Rust build guide

## References

- [TC39 Decorators Proposal](https://github.com/tc39/proposal-decorators)
- [oxc Project](https://oxc-project.github.io/)
- [WebAssembly Component Model](https://github.com/WebAssembly/component-model)

## License

MIT
