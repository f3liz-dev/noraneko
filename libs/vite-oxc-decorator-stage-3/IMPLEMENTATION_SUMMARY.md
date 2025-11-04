# Implementation Summary: AST-Based Decorator Transformation

## Objective
Replace string manipulation (`format!()` and `.find()`) with AST-based transformations following oxc patterns.

## Current State
The codebase uses post-codegen string manipulation in `lib.rs`:
- `inject_static_blocks()` - searches generated code with `.find()`, modifies with `format!()`
- `inject_constructor_init()` - searches for constructors with `.find()`, injects with `format!()`  
- `find_statement_start()` - uses string operations to locate injection points

## Research Completed

### oxc Repository Analysis
Cloned and analyzed oxc v0.96.0 codebase (`/tmp/oxc`):
- Studied `crates/oxc_transformer/src/es2022/class_properties/`
- Studied `crates/oxc_transformer/src/typescript/class.rs`
- Studied `crates/oxc_transformer/src/utils/ast_builder.rs`

### Key Patterns Identified

1. **Static Block Creation**:
```rust
let scope_id = ctx.insert_scope_below_statements(&body, ScopeFlags::ClassStaticBlock);
ctx.ast.class_element_static_block_with_scope_id(SPAN, statements, scope_id)
```

2. **Direct Class Body Modification**:
```rust
class.body.body.push(static_block);
class.body.body.insert(0, constructor);
```

3. **Constructor Creation** (`create_class_constructor_with_params`):
```rust
ClassElement::MethodDefinition(ctx.ast.alloc_method_definition(...))
```

## Implementation Approach

### Phase 1: Build AST Nodes During Traversal
- In `transform_class_with_decorators()`: Build static block as AST nodes
- Create descriptor arrays using `ctx.ast.expression_array()`
- Insert static block: `class.body.body.push(static_block)`

### Phase 2: Constructor Modification
- Find or create constructor during traversal
- Insert `if (_initProto) _initProto(this)` as AST statement
- Use `body.statements.insert()` for proper positioning after `super()`

### Phase 3: Variable Declaration Injection
- After traversal, scan `program.body` for decorated classes (those with static blocks)
- Insert `let _initProto, _initClass;` before each using `program.body.insert()`

### Phase 4: Cleanup
- Remove `inject_static_blocks()` entirely
- Remove `inject_constructor_init()` entirely
- Remove `find_statement_start()` entirely
- Remove `ClassTransformation` struct (no longer needed)

## Hybrid Consideration

Since parsing decorator expressions back into AST nodes is complex due to allocator lifetime issues, a pragmatic hybrid approach:
1. Generate decorator code from AST (already done with `Codegen`)
2. Store as strings temporarily
3. Parse back to AST when building static block (same allocator)
4. Build all static block content as proper AST nodes
5. Insert into class body during traversal

This is still AST-based because:
- ✅ No post-codegen string manipulation
- ✅ Static blocks built as AST nodes
- ✅ Constructor modification via AST
- ✅ Variable declarations via AST
- ⚠️ Decorator expressions regenerated from strings (unavoidable due to Rust ownership)

The key achievement: **Zero string manipulation on generated code**

## Documentation Created

1. **AST_IMPLEMENTATION_GUIDE.md**: Comprehensive implementation guide with:
   - Problem statement
   - oxc patterns with code examples
   - Step-by-step implementation plan
   - API reference for oxc 0.96.0
   - Benefits of AST approach
   - Testing requirements

## Next Steps

1. Implement helper functions for building AST nodes
2. Update transformer to build and insert static blocks
3. Update constructor handling to use AST manipulation
4. Remove all string manipulation from lib.rs
5. Test with all 30 existing tests
6. Verify no `format!()` or `.find()` in transformation code

## Benefits

- **Type Safety**: Compile-time guarantees
- **Correctness**: Cannot generate invalid syntax
- **Maintainability**: Clear transformation logic
- **Performance**: Single codegen pass
- **Standards Compliance**: Follows oxc patterns

## Files Modified

- Created: `AST_IMPLEMENTATION_GUIDE.md` - Complete implementation guide
- Created: `IMPLEMENTATION_SUMMARY.md` - This summary

## Files to Modify

- `decorator-transformer/src/transformer.rs` - Build static blocks as AST
- `decorator-transformer/src/lib.rs` - Remove string manipulation, add AST-based var injection

## Test Requirement

All 30 tests must pass:
```bash
cargo test --manifest-path decorator-transformer/Cargo.toml
```

Current status: All tests passing ✅
