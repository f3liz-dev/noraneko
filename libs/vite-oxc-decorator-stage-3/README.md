# vite-oxc-decorator-stage-3

> ⚠️ **AI-Generated Project**: This project was implemented by AI and has not yet been reviewed or rewritten by humans. Use with caution in production environments.

A Vite plugin for transforming TC39 Stage 3 decorators using Rust/WASM (oxc v0.96.0).

## Features

- Full TC39 Stage 3 decorator semantics (class, method, field, accessor, getter, setter)
- `addInitializer` API support with private and static members
- Rust/WASM transformer with zero runtime dependencies

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

## Options

```typescript
interface ViteOxcDecoratorOptions {
  include?: RegExp | RegExp[];  // Default: [/\.[jt]sx?$/]
  exclude?: RegExp | RegExp[];  // Default: [/node_modules/]
}
```

## Requirements

- Vite 4.x or 5.x
- Node.js 16+

## License

MIT
