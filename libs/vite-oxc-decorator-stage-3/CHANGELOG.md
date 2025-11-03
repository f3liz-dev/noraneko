# Changelog

> ⚠️ **AI-Generated**: This project was implemented by AI and has not been reviewed by humans.

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added
- Rust/WASM Component Model transformer using oxc v0.96.0
- WIT interface definition for type-safe bindings
- wit-bindgen for Rust bindings
- jco for JavaScript bindings
- WASM-only architecture (no Babel in production)
- Zero runtime dependencies

### Changed
- Migrated from wasm-bindgen to wit-bindgen
- Build system: wit-bindgen direct integration with cargo build
- Target: wasm32-wasip2 (Component Model)
- Babel moved to devDependencies (tests only)
- Removed `useWasm` and `babel` options

## [0.1.0] - 2024-11-02

### Added
- Initial release
- TC39 Stage 3 decorator support
- All decorator types: class, method, field, accessor, getter, setter
- `addInitializer` API
- Private and static members
- TypeScript and JavaScript support
- Source maps
- Test suite (23 tests)

### Implementation
- Studied oxc v0.96.0 AST and transformer patterns
- Studied TC39 proposal-decorators
- Uses Babel for test compatibility verification

## License

MIT
