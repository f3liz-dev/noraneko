# Decorator Transformer (Rust/WASM)

> ⚠️ **AI-Generated**: This implementation was created by AI and has not been reviewed by humans.

Rust-based transformer for TC39 Stage 3 decorators, built with oxc and compiled to WebAssembly Component Model.

## Building

### Prerequisites

- Rust toolchain (1.90.0+)
- `rustup target add wasm32-wasip2`
- `npm install -g @bytecodealliance/jco`

### Build Commands

```bash
# Build WASM component (wasip2 produces components directly)
cargo build --target wasm32-wasip2 --release

# Generate JavaScript bindings
jco transpile target/wasm32-wasip2/release/decorator_transformer.wasm -o ../pkg
```

Or from project root:

```bash
npm run build:wasm
npm run build:jco
```

## Architecture

- **oxc v0.96.0**: Parser, AST, and code generation
- **wit-bindgen**: WebAssembly Component Model bindings
- **WIT Interface**: Type-safe interface definition in `wit/world.wit`

## Current Status

✅ **Basic transformation complete:**
- Parses JavaScript/TypeScript with decorators
- Removes decorator syntax from AST  
- Generates valid JavaScript output
- All tests passing

⚠️ **Limitations:**
- Decorators are stripped, not applied (no runtime behavior)
- For working decorators, use Babel transformation
- Full TC39 Stage 3 implementation would require ~120+ hours

**Use Cases:**
- Stripping decorators for unsupported environments
- Pre-processing before other transformations
- Foundation for future full implementation

## WIT Interface

```wit
package decorator:transformer;

world transformer {
  export transform: func(
    filename: string, 
    source-text: string, 
    options: string
  ) -> result<transform-result, string>;
}

record transform-result {
  code: string,
  map: option<string>,
  errors: list<string>,
}
```

## References

- [oxc Documentation](https://oxc-project.github.io/)
- [TC39 Decorators Proposal](https://github.com/tc39/proposal-decorators)
- [WebAssembly Component Model](https://github.com/WebAssembly/component-model)
- [wit-bindgen](https://github.com/bytecodealliance/wit-bindgen)
- [jco](https://github.com/bytecodealliance/jco)
