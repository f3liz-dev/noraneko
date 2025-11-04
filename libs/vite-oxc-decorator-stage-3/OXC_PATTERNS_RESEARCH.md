# oxc Transformer Patterns Research

## Summary

Cloned and analyzed the oxc repository to understand how they implement AST transformations in their decorator transformer.

## Repository Location

Cloned to: `/tmp/oxc` from `https://github.com/oxc-project/oxc`

## Key Files Analyzed

1. `crates/oxc_transformer/src/decorator/legacy/mod.rs` - Legacy decorator implementation
2. `crates/oxc_transformer/src/common/statement_injector.rs` - Statement injection pattern
3. `crates/oxc_transformer/src/typescript/class.rs` - Class transformation examples

## Key Patterns Discovered

### 1. Static Block Insertion (Direct AST Manipulation)

From `decorator/legacy/mod.rs:872`:

```rust
fn insert_decorations_into_class_static_block(
    class: &mut Class<'a>,
    decorations: Vec<Statement<'a>>,
    ctx: &mut TraverseCtx<'a>,
) {
    // Create a child scope for the static block
    let scope_id = ctx.create_child_scope(class.scope_id(), ScopeFlags::ClassStaticBlock);
    
    // Convert Vec to ArenaVec
    let decorations = ctx.ast.vec_from_iter(decorations);
    
    // Create the static block element
    let element = ctx.ast.class_element_static_block_with_scope_id(SPAN, decorations, scope_id);
    
    // Insert directly into class body
    class.body.body.push(element);
}
```

**Key Points:**
- Use `ctx.ast.class_element_static_block_with_scope_id()` to create static block
- Create child scope with `ScopeFlags::ClassStaticBlock`
- Insert directly via `class.body.body.push()`
- No string manipulation involved

### 2. Variable Declaration Creation

From `decorator/legacy/mod.rs:734`:

```rust
let declarator = ctx.ast.variable_declarator(
    SPAN,
    VariableDeclarationKind::Let,
    binding.create_binding_pattern(ctx),
    Some(initializer),
    false,
);

let var_declaration = ctx.ast.declaration_variable(
    span,
    VariableDeclarationKind::Let,
    ctx.ast.vec1(declarator),
    false,
);

Statement::from(var_declaration)
```

**Key Points:**
- Use `ctx.ast.variable_declarator()` to create declarator
- Use `ctx.ast.declaration_variable()` for the declaration
- Convert to Statement with `Statement::from()`

### 3. Statement Injection Pattern

From `common/statement_injector.rs`:

```rust
// Queue statements to be inserted
self.ctx.statement_injector.insert_before(target, statement);
self.ctx.statement_injector.insert_after(target, statement);
self.ctx.statement_injector.insert_many_after(target, statements);

// Move insertions when transforming statements
self.ctx.statement_injector.move_insertions(old_target, new_target);
```

**Key Points:**
- Statements are queued, not inserted immediately
- Actual insertion happens in `exit_statements()`
- Avoids modifying AST during traversal which can break the walk
- Uses `Address` to track target statements

### 4. Array Expression Building

For building descriptor arrays:

```rust
let mut elements = ctx.ast.vec();

// Add elements
elements.push(ArrayExpressionElement::from(decorator_expression));
elements.push(ArrayExpressionElement::from(
    ctx.ast.expression_numeric_literal(SPAN, flags as f64, None, NumberBase::Decimal)
));
elements.push(ArrayExpressionElement::from(
    ctx.ast.expression_string_literal(SPAN, key, None)
));
elements.push(ArrayExpressionElement::from(
    ctx.ast.expression_boolean_literal(SPAN, is_private)
));

// Create array
let descriptor_array = ctx.ast.expression_array(SPAN, elements);
```

### 5. Constructor Modification

From decorator legacy implementation:

```rust
// Find constructor
if let Some(constructor) = class.body.body.iter_mut().find(|element| {
    matches!(element, ClassElement::MethodDefinition(m) if m.kind.is_constructor())
}) {
    if let ClassElement::MethodDefinition(method) = constructor {
        if let Some(ref mut body) = method.value.body {
            // Insert statements into constructor body
            body.statements.insert(insert_pos, init_stmt);
        }
    }
}
```

## Implementation Requirements

To follow oxc patterns, our code needs:

### Replace String Generation
**Current**: `generate_static_block_code()` returns String  
**Needed**: Build AST nodes directly

### Replace Post-Codegen Injection
**Current**: `inject_static_blocks()` manipulates generated string  
**Needed**: Insert during traversal via `class.body.body.push()`

### Build Descriptor Arrays as AST
**Current**: `format!("[{}, {}, \"{}\", {}]", ...)`  
**Needed**: `ctx.ast.expression_array()` with proper elements

### Create Variable Declarations Properly  
**Current**: Injected as strings post-codegen  
**Needed**: `ctx.ast.declaration_variable()` and statement_injector

### Modify Constructors via AST
**Current**: String find/replace post-codegen  
**Needed**: Direct `body.statements.insert()`

## Architecture Differences

### Current (Hybrid):
1. Traverse AST, collect metadata
2. Generate code strings
3. Run codegen
4. String manipulation on generated code

### oxc Pattern:
1. Traverse AST
2. Build new AST nodes with `ctx.ast.*`
3. Insert/modify AST directly
4. Run codegen once on modified AST

## Benefits of oxc Pattern

1. **Type Safety**: AST nodes are type-checked
2. **No String Parsing**: Avoid parsing generated code
3. **Correctness**: Can't create invalid JavaScript syntax
4. **Performance**: Single codegen pass
5. **Maintainability**: Clear transformation logic

## Next Steps

1. Implement `build_static_block_ast()` using ctx.ast methods
2. Implement `insert_static_block()` to push into class.body.body
3. Implement `create_variable_declaration()` for _initProto, _initClass
4. Use statement_injector or similar pattern for var declarations
5. Implement `modify_constructor_ast()` for instance init
6. Remove all string-based generation and post-processing

## Complexity Assessment

- **Lines to change**: ~500-700 lines
- **New patterns**: Statement injector, AST building
- **Risk**: Medium (need to handle all decorator types correctly)
- **Testing**: All 30 tests must pass
