# AST-Based Decorator Transform Implementation Guide

## Problem
The current implementation uses string manipulation (`format!()` and `.find()`) on generated code in `lib.rs`:
- `inject_static_blocks()` - uses `.find()` to locate class positions and `format!()` to inject code
- `inject_constructor_init()` - uses `.find()` to locate constructors and `format!()` to inject code
- `find_statement_start()` - uses string manipulation to find injection points

This violates the principle of AST-based transformations.

## Solution: Fully AST-Based Approach

### Key Patterns from oxc (v0.96.0)

Based on analysis of `/tmp/oxc/crates/oxc_transformer/`:

1. **Static Block Creation** (from `typescript/class.rs`):
```rust
let scope_id = ctx.insert_scope_below_statements(
    &body,
    ScopeFlags::StrictMode | ScopeFlags::ClassStaticBlock,
);

ctx.ast.class_element_static_block_with_scope_id(
    SPAN,
    ctx.ast.vec_from_iter(statements),
    scope_id,
)
```

2. **Inserting into Class Body** (from `es2022/class_properties/constructor.rs`):
```rust
body.body.insert(0, element);  // or .push(element)
```

3. **Creating Constructor** (from `utils/ast_builder.rs`):
```rust
pub fn create_class_constructor_with_params<'a>(
    stmts: ArenaVec<'a, Statement<'a>>,
    params: ArenaBox<'a, FormalParameters<'a>>,
    scope_id: ScopeId,
    ctx: &TraverseCtx<'a>,
) -> ClassElement<'a>
```

### Implementation Steps

#### Step 1: Modify `transformer.rs`

Change `transform_class_with_decorators` to:
1. Build static block statements as AST nodes
2. Create static block using `ctx.ast.class_element_static_block_with_scope_id`
3. Insert directly: `class.body.body.push(static_block)`
4. If needed, create/modify constructor and insert: `class.body.body.insert(0, constructor)`

Remove the `ClassTransformation` struct and `transformations` field - no longer needed.

#### Step 2: Modify `lib.rs`

Remove these functions entirely:
- `inject_static_blocks()`
- `inject_constructor_init()`
- `find_statement_start()`

Add new function:
```rust
fn inject_variable_declarations<'a>(program: &mut Program<'a>, allocator: &'a Allocator) {
    // Find classes with static blocks (indicates decoration)
    // Insert `let _initProto, _initClass;` before each
    // Use program.body.insert(index, var_decl)
}
```

#### Step 3: Build Static Block Content

The challenge is building the descriptor arrays. Two approaches:

**Approach A: Parse decorator code back to AST**
```rust
// Generate decorator code with Codegen (already done)
let decorator_code = self.generate_expression_code(&dec.expression);

// Parse back into AST for the current allocator
let parser = Parser::new(ctx.allocator, &wrapped_code, SourceType::default());
// Extract expression and use in descriptor array
```

**Approach B: Store decorator expressions temporarily** (RECOMMENDED)
```rust
// In collect_decorator_metadata, generate code immediately
struct DecoratorMetadata {
    decorator_codes: Vec<String>,  // Generated from expressions
    kind: DecoratorKind,
    // ...
}

// When building static block, parse each code string back to Expression
// This is a hybrid but avoids post-codegen manipulation
```

### Building Descriptor Arrays

```rust
fn build_descriptor_array<'a>(
    meta: &DecoratorMetadata,
    ctx: &mut TraverseCtx<'a, TransformerState>,
) -> Expression<'a> {
    let mut elements = ctx.ast.vec();
    
    for decorator_code in &meta.decorator_codes {
        // Parse decorator_code back to expression
        let decorator_expr = parse_expression(decorator_code, ctx);
        
        let flags = (meta.kind as u8) | if meta.is_static { 8 } else { 0 };
        let flags_expr = ctx.ast.expression_numeric_literal(
            SPAN, flags as f64, None, NumberBase::Decimal
        );
        
        let key_atom = ctx.ast.atom(&meta.key);
        let key_expr = ctx.ast.expression_string_literal(SPAN, key_atom);
        
        let is_private_expr = ctx.ast.expression_boolean_literal(SPAN, meta.is_private);
        
        // Build [decorator, flags, key, isPrivate]
        let mut desc_elements = ctx.ast.vec();
        desc_elements.push(ArrayExpressionElement::from(decorator_expr));
        desc_elements.push(ArrayExpressionElement::from(flags_expr));
        desc_elements.push(ArrayExpressionElement::from(key_expr));
        desc_elements.push(ArrayExpressionElement::from(is_private_expr));
        
        let descriptor = ctx.ast.expression_array(SPAN, desc_elements, None);
        elements.push(ArrayExpressionElement::from(descriptor));
    }
    
    ctx.ast.expression_array(SPAN, elements, None)
}
```

### Building Static Block Statements

```rust
fn build_static_block_statements<'a>(
    member_desc_array: Expression<'a>,
    class_dec_array: Expression<'a>,
    has_class_decorators: bool,
    ctx: &mut TraverseCtx<'a, TransformerState>,
) -> ArenaVec<'a, Statement<'a>> {
    let mut stmts = ctx.ast.vec();
    
    if has_class_decorators {
        // let _classThis;
        stmts.push(create_let_declaration("_classThis", None, ctx));
    }
    
    // [_initProto, _initClass] = _applyDecs(...).e  (or .c)
    let assignment_stmt = create_apply_decs_assignment(
        member_desc_array,
        class_dec_array,
        has_class_decorators,
        ctx,
    );
    stmts.push(assignment_stmt);
    
    // if (_initClass) _initClass();
    stmts.push(create_init_class_call(ctx));
    
    stmts
}
```

### Constructor Modification

```rust
fn ensure_constructor_with_init<'a>(
    class: &mut Class<'a>,
    ctx: &mut TraverseCtx<'a, TransformerState>,
) {
    // Find constructor
    let ctor_index = class.body.body.iter().position(|el| {
        matches!(el, ClassElement::MethodDefinition(m) if m.kind.is_constructor())
    });
    
    if let Some(idx) = ctor_index {
        // Modify existing constructor
        if let ClassElement::MethodDefinition(method) = &mut class.body.body[idx] {
            if let Some(body) = &mut method.value.body {
                // Find insert position (after super() if exists)
                let insert_pos = find_super_call_end(&body.statements);
                
                // Build: if (_initProto) _initProto(this);
                let init_stmt = build_init_proto_call(ctx);
                body.statements.insert(insert_pos, init_stmt);
            }
        }
    } else {
        // Create new constructor
        let constructor = build_constructor_with_init(class, ctx);
        class.body.body.insert(0, constructor);
    }
}
```

## Testing

All 30 existing tests must pass:
```bash
cargo test --manifest-path decorator-transformer/Cargo.toml
```

## Benefits of AST-Based Approach

1. **Type Safety**: AST nodes are type-checked at compile time
2. **No String Parsing**: Avoids error-prone string manipulation  
3. **Correctness**: Cannot create invalid JavaScript syntax
4. **Performance**: Single codegen pass instead of generate-then-modify
5. **Maintainability**: Clear transformation logic, easier to debug

## API Reference for oxc 0.96.0

Key methods needed:
- `ctx.ast.class_element_static_block_with_scope_id()`
- `ctx.ast.expression_array()`
- `ctx.ast.expression_numeric_literal()`
- `ctx.ast.expression_string_literal()`
- `ctx.ast.expression_boolean_literal()`
- `ctx.ast.expression_call()`
- `ctx.ast.expression_assignment()`
- `ctx.ast.member_expression_static()`
- `ctx.ast.statement_expression()`
- `ctx.ast.statement_if()`
- `ctx.ast.declaration_variable()`
- `ctx.ast.variable_declarator()`
- `ctx.insert_scope_below_statements()`

## Current Status

The implementation is partially complete:
- ✅ Identified all string manipulation points
- ✅ Researched oxc patterns 
- ✅ Created implementation guide
- ⏳ Need to implement AST node building
- ⏳ Need to remove string manipulation from lib.rs
- ⏳ Need to test all 30 test cases

## Next Steps

1. Implement helper functions for AST node creation
2. Update `transform_class_with_decorators` to build and insert static blocks
3. Update `ensure_constructor_with_init` to use AST manipulation
4. Remove string manipulation functions from lib.rs
5. Add variable declaration insertion in lib.rs
6. Run tests and fix any issues
7. Verify no `format!()` or `.find()` calls remain in transformation logic
