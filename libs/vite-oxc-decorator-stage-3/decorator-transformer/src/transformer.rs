//! Decorator Transformer - TC39 Stage 3 Decorator Implementation
//!
//! This module implements decorator transformation using oxc's AST.
//!
//! ## AST-Based Approach
//!
//! The transformer follows an AST-based approach where possible:
//!
//! 1. **Decorator Expressions**: Stored as AST Expression nodes, not strings
//!    - Uses `generate_expression_code()` with Codegen to convert AST to code
//!    - Original decorator expressions preserved in AST during collection
//!
//! 2. **Class Span Tracking**: Stores `Span` information for positioning
//!    - `ClassTransformation.class_span` provides AST-based position info
//!    - Avoids string-based class name search where possible
//!
//! 3. **Metadata Collection**: Uses AST traversal
//!    - `collect_decorator_metadata()` iterates AST nodes
//!    - `DecoratorAstMetadata` struct stores Expression references
//!
//! ## Hybrid Approach (Current Implementation)
//!
//! Due to oxc's arena allocator and transformation complexity, some operations
//! use a hybrid approach:
//!
//! 1. **Static Block Generation**: 
//!    - Currently uses `format!()` to build code strings
//!    - TODO: Build as Expression/Statement AST nodes using AstBuilder
//!    - See `generate_static_block_code()` for improvement opportunities
//!
//! 2. **Code Injection**:
//!    - Currently uses string `find()` on generated code
//!    - TODO: Insert AST nodes during traversal using `class.body.body.insert()`
//!    - Challenges: Need parent access for var declarations
//!
//! 3. **Constructor Modification**:
//!    - Currently uses string manipulation
//!    - TODO: Modify Function.body.statements directly in AST
//!    - See `ensure_constructor_with_init()` for AST-based approach skeleton
//!
//! ## Future Improvements
//!
//! To make this fully AST-based:
//! 1. Use `AstBuilder` (via `ctx.ast`) to create StaticBlock nodes
//! 2. Build descriptor arrays as ArrayExpression with proper element nodes
//! 3. Insert nodes during traversal, not post-codegen
//! 4. Use two-pass traversal if parent access needed for var declarations
//!
//! See oxc's own transformers for reference implementations.

use oxc_allocator::Allocator;
use oxc_ast::{NONE, ast::*};
use oxc_traverse::{Traverse, TraverseCtx};
use oxc_codegen::Codegen;
use oxc_parser::Parser;
use oxc_semantic::ScopeFlags;
use oxc_span::{SourceType, SPAN};
use std::cell::RefCell;

/// Represents the kind of decorator according to TC39 Stage 3 decorator specification
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
#[allow(dead_code)]  // Class variant reserved for class decorators
pub enum DecoratorKind {
    Field = 0,
    Accessor = 1,
    Method = 2,
    Getter = 3,
    Setter = 4,
    Class = 5,
}

pub struct DecoratorTransformer<'a> {
    pub errors: Vec<String>,
    in_decorated_class: RefCell<bool>,
    helpers_injected: RefCell<bool>,
    _allocator: &'a Allocator,
}

pub struct TransformerState;

impl<'a> DecoratorTransformer<'a> {
    pub fn new(allocator: &'a Allocator) -> Self {
        Self {
            errors: Vec::new(),
            in_decorated_class: RefCell::new(false),
            helpers_injected: RefCell::new(false),
            _allocator: allocator,
        }
    }
    
    pub fn check_for_decorators(&self, program: &Program<'a>) -> bool {
        program.body.iter().any(|stmt| self.statement_has_decorators(stmt))
    }
    
    fn statement_has_decorators(&self, stmt: &Statement<'a>) -> bool {
        match stmt {
            Statement::ClassDeclaration(class) => self.has_decorators(class),
            Statement::ExportDefaultDeclaration(export) => {
                matches!(&export.declaration, ExportDefaultDeclarationKind::ClassDeclaration(class) if self.has_decorators(class))
            }
            Statement::ExportNamedDeclaration(export) => {
                matches!(&export.declaration, Some(Declaration::ClassDeclaration(class)) if self.has_decorators(class))
            }
            _ => false,
        }
    }
    
    pub fn needs_helpers(&self) -> bool {
        *self.helpers_injected.borrow()
    }

    fn has_decorators(&self, class: &Class<'a>) -> bool {
        !class.decorators.is_empty() || class.body.body.iter().any(|element| {
            match element {
                ClassElement::MethodDefinition(m) => !m.decorators.is_empty(),
                ClassElement::PropertyDefinition(p) => !p.decorators.is_empty(),
                ClassElement::AccessorProperty(a) => !a.decorators.is_empty(),
                _ => false,
            }
        })
    }
    
    fn collect_decorator_metadata(&self, class: &Class<'a>) -> Vec<DecoratorMetadata> {
        class.body.body.iter().filter_map(|element| {
            match element {
                ClassElement::MethodDefinition(m) if !m.decorators.is_empty() => {
                    let kind = match m.kind {
                        MethodDefinitionKind::Get => DecoratorKind::Getter,
                        MethodDefinitionKind::Set => DecoratorKind::Setter,
                        _ => DecoratorKind::Method,
                    };
                    Some(DecoratorMetadata {
                        decorator_names: self.extract_decorator_names(&m.decorators),
                        kind,
                        is_static: m.r#static,
                        is_private: matches!(&m.key, PropertyKey::PrivateIdentifier(_)),
                        key: self.get_property_key_name(&m.key),
                    })
                }
                ClassElement::PropertyDefinition(p) if !p.decorators.is_empty() => {
                    Some(DecoratorMetadata {
                        decorator_names: self.extract_decorator_names(&p.decorators),
                        kind: DecoratorKind::Field,
                        is_static: p.r#static,
                        is_private: matches!(&p.key, PropertyKey::PrivateIdentifier(_)),
                        key: self.get_property_key_name(&p.key),
                    })
                }
                ClassElement::AccessorProperty(a) if !a.decorators.is_empty() => {
                    Some(DecoratorMetadata {
                        decorator_names: self.extract_decorator_names(&a.decorators),
                        kind: DecoratorKind::Accessor,
                        is_static: a.r#static,
                        is_private: matches!(&a.key, PropertyKey::PrivateIdentifier(_)),
                        key: self.get_property_key_name(&a.key),
                    })
                }
                _ => None,
            }
        }).collect()
    }
    
    /// Generates source code for a decorator expression.
    /// Returns the full expression including any call arguments.
    /// For example: `noraComponent(import.meta.hot)` instead of just `noraComponent`
    fn generate_expression_code(&self, expr: &Expression<'a>) -> String {
        let mut codegen = Codegen::new();
        codegen.print_expression(expr);
        let code = codegen.into_source_text();
        
        // Fallback to "decorator" if code generation produces empty string
        // This should not happen with valid AST, but provides a safe default
        if code.is_empty() {
            "decorator".to_string()
        } else {
            code
        }
    }
    
    fn extract_decorator_names(&self, decorators: &oxc_allocator::Vec<'a, Decorator<'a>>) -> Vec<String> {
        decorators.iter().map(|dec| {
            self.generate_expression_code(&dec.expression)
        }).collect()
    }
    
    fn get_property_key_name(&self, key: &PropertyKey) -> String {
        match key {
            PropertyKey::StaticIdentifier(id) => id.name.to_string(),
            PropertyKey::PrivateIdentifier(id) => format!("#{}", id.name),
            PropertyKey::StringLiteral(lit) => lit.value.to_string(),
            PropertyKey::NumericLiteral(lit) => lit.value.to_string(),
            _ => "computed".to_string(),
        }
    }

    fn transform_class_with_decorators(
        &mut self,
        class: &mut Class<'a>,
        ctx: &mut TraverseCtx<'a, TransformerState>,
    ) -> bool {
        if !self.has_decorators(class) {
            return false;
        }

        *self.in_decorated_class.borrow_mut() = true;
        *self.helpers_injected.borrow_mut() = true;
        
        let metadata = self.collect_decorator_metadata(class);
        let class_decorators = self.collect_class_decorators(class);
        
        // Check if we need instance initialization (field or accessor decorators)
        let needs_instance_init = metadata.iter().any(|m| {
            m.kind == DecoratorKind::Field || m.kind == DecoratorKind::Accessor
        });
        
        if !metadata.is_empty() || !class_decorators.is_empty() {
            // Leak metadata to give it 'a lifetime (it will be deallocated with the arena)
            let metadata_leaked: &'a [DecoratorMetadata] = Box::leak(metadata.into_boxed_slice());
            
            // Step 4: Build static block directly as AST nodes instead of generating code strings
            let static_block = self.create_decorator_static_block(metadata_leaked, &class_decorators, ctx);
            class.body.body.push(static_block);
            
            // Step 2: If we need instance init, modify or create constructor
            if needs_instance_init {
                self.ensure_constructor_with_init(class, ctx);
            }
            
            // Step 3: Variable declarations are now injected via AST after traversal
            // No need to track transformations anymore
        }
        
        class.decorators.clear();
        
        for element in &mut class.body.body {
            match element {
                ClassElement::MethodDefinition(m) => m.decorators.clear(),
                ClassElement::PropertyDefinition(p) => p.decorators.clear(),
                ClassElement::AccessorProperty(a) => a.decorators.clear(),
                _ => {}
            }
        }

        true
    }
    
    /// Create decorator static block as AST nodes (Step 4: Full AST-based approach)
    /// Builds: static { [_initProto, _initClass] = _applyDecs(this, memberDescArray, classDecArray).e; if (_initClass) _initClass(); }
    /// Or:     static { let _classThis; [_classThis, _initClass] = _applyDecs(this, memberDescArray, classDecArray).c; if (_initClass) _initClass(); }
    fn create_decorator_static_block(
        &self,
        metadata: &'a [DecoratorMetadata],
        class_decorators: &[String],
        ctx: &mut TraverseCtx<'a, TransformerState>,
    ) -> ClassElement<'a> {
        let mut statements = ctx.ast.vec();
        
        // Build member descriptor array: [[decorator, flags, "key", isPrivate], ...]
        let member_desc_array = self.build_member_descriptor_array(metadata, ctx);
        
        // Build class decorator array: [decorator1, decorator2, ...]
        let class_dec_array = self.build_class_decorator_array(class_decorators, ctx);
        
        if class_decorators.is_empty() {
            // Only member decorators: [_initProto, _initClass] = _applyDecs(this, memberDesc, classDesc).e
            let assignment_stmt = self.build_apply_decs_assignment(
                &["_initProto", "_initClass"],
                member_desc_array,
                class_dec_array,
                "e",
                ctx,
            );
            statements.push(assignment_stmt);
        } else {
            // Has class decorators: let _classThis; [_classThis, _initClass] = _applyDecs(this, memberDesc, classDesc).c
            // First: let _classThis;
            let class_this_decl = self.build_variable_declaration("_classThis", None, ctx);
            statements.push(class_this_decl);
            
            // Second: [_classThis, _initClass] = _applyDecs(...).c
            let assignment_stmt = self.build_apply_decs_assignment(
                &["_classThis", "_initClass"],
                member_desc_array,
                class_dec_array,
                "c",
                ctx,
            );
            statements.push(assignment_stmt);
        }
        
        // Add: if (_initClass) _initClass();
        let init_class_call = self.build_init_class_if_statement(ctx);
        statements.push(init_class_call);
        
        // Create static block with proper scope
        let scope_id = ctx.create_child_scope_of_current(ScopeFlags::ClassStaticBlock);
        ctx.ast.class_element_static_block_with_scope_id(SPAN, statements, scope_id)
    }
    
    /// Build member descriptor array: [[decorator, flags, "key", isPrivate], ...]
    fn build_member_descriptor_array(
        &self,
        metadata: &'a [DecoratorMetadata],
        ctx: &TraverseCtx<'a, TransformerState>,
    ) -> Expression<'a> {
        let mut descriptors = ctx.ast.vec();
        
        for meta in metadata {
            for decorator_name in &meta.decorator_names {
                // Build single descriptor: [decorator, flags, "key", isPrivate]
                let mut elements = ctx.ast.vec();
                
                // decorator (identifier reference)
                // Allocate string in arena to get correct lifetime
                let name_arena = ctx.ast.allocator.alloc_str(decorator_name);
                let decorator_ref = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, name_arena)));
                elements.push(ArrayExpressionElement::from(decorator_ref));
                
                // flags (number)
                let flags = (meta.kind as u8) | if meta.is_static { 8 } else { 0 };
                let flags_expr = ctx.ast.expression_numeric_literal(SPAN, flags as f64, None, NumberBase::Decimal);
                elements.push(ArrayExpressionElement::from(flags_expr));
                
                // key (string)
                let key = if meta.is_private { &meta.key[1..] } else { &meta.key };
                let key_expr = ctx.ast.expression_string_literal(SPAN, key, None);
                elements.push(ArrayExpressionElement::from(key_expr));
                
                // isPrivate (boolean)
                let is_private_expr = ctx.ast.expression_boolean_literal(SPAN, meta.is_private);
                elements.push(ArrayExpressionElement::from(is_private_expr));
                
                // Create array expression for this descriptor
                let descriptor_array = ctx.ast.expression_array(SPAN, elements);
                descriptors.push(ArrayExpressionElement::from(descriptor_array));
            }
        }
        
        ctx.ast.expression_array(SPAN, descriptors)
    }
    
    /// Build class decorator array: [decorator1, decorator2, ...]
    fn build_class_decorator_array(
        &self,
        class_decorators: &[String],
        ctx: &TraverseCtx<'a, TransformerState>,
    ) -> Expression<'a> {
        let mut elements = ctx.ast.vec();
        
        for decorator_name in class_decorators {
            // Allocate string in arena to get correct lifetime
            let name_arena = ctx.ast.allocator.alloc_str(decorator_name);
            let decorator_ref = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, name_arena)));
            elements.push(ArrayExpressionElement::from(decorator_ref));
        }
        
        ctx.ast.expression_array(SPAN, elements)
    }
    
    /// Build: [_initProto, _initClass] = _applyDecs(this, memberDesc, classDesc).e (or .c)
    fn build_apply_decs_assignment(
        &self,
        target_names: &[&str],
        member_desc_array: Expression<'a>,
        class_dec_array: Expression<'a>,
        property_name: &'a str,
        ctx: &mut TraverseCtx<'a, TransformerState>,
    ) -> Statement<'a> {
        // Build the _applyDecs(this, memberDesc, classDesc) call
        let apply_decs_callee = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "_applyDecs")));
        let mut arguments = ctx.ast.vec();
        arguments.push(Argument::from(ctx.ast.expression_this(SPAN)));
        arguments.push(Argument::from(member_desc_array));
        arguments.push(Argument::from(class_dec_array));
        let apply_decs_call = ctx.ast.expression_call(SPAN, apply_decs_callee, NONE, arguments, false);
        
        // Build .e or .c member access
        let property = ctx.ast.identifier_name(SPAN, property_name);
        let member_expr = ctx.ast.member_expression_static(SPAN, apply_decs_call, property, false);
        let right = Expression::from(member_expr);
        
        // For simplicity, generate the left side as a string and parse it
        // This is acceptable since it's a simple pattern and doesn't involve user code
        let target_list = target_names.join(", ");
        let assignment_code = format!("[{}] = temp", target_list);
        let wrapped = format!("({})", assignment_code);
        let wrapped_arena = ctx.ast.allocator.alloc_str(&wrapped);
        
        let parser = Parser::new(ctx.ast.allocator, wrapped_arena, SourceType::default());
        let parse_result = parser.parse();
        
        if let Some(Statement::ExpressionStatement(expr_stmt)) = parse_result.program.body.first() {
            if let Expression::ParenthesizedExpression(paren) = &expr_stmt.expression {
                if let Expression::AssignmentExpression(assign) = &paren.expression {
                    // Clone the left side (assignment target)
                    let left = unsafe { std::ptr::read(&assign.left as *const AssignmentTarget<'a>) };
                    
                    // Build new assignment with our right side
                    let assignment = ctx.ast.expression_assignment(SPAN, AssignmentOperator::Assign, left, right);
                    return ctx.ast.statement_expression(SPAN, assignment);
                }
            }
        }
        
        // Fallback: should not happen
        ctx.ast.statement_empty(SPAN)
    }
    
    /// Build: let varName; or let varName = init;
    fn build_variable_declaration(
        &self,
        var_name: &'a str,
        init: Option<Expression<'a>>,
        ctx: &TraverseCtx<'a, TransformerState>,
    ) -> Statement<'a> {
        let binding = ctx.ast.binding_pattern(
            ctx.ast.binding_pattern_kind_binding_identifier(SPAN, var_name),
            NONE,
            false,
        );
        
        let declarator = ctx.ast.variable_declarator(
            SPAN,
            VariableDeclarationKind::Let,
            binding,
            init,
            false,
        );
        
        let declaration = ctx.ast.declaration_variable(
            SPAN,
            VariableDeclarationKind::Let,
            ctx.ast.vec1(declarator),
            false,
        );
        
        Statement::from(declaration)
    }
    
    /// Build: if (_initClass) _initClass();
    fn build_init_class_if_statement(&self, ctx: &TraverseCtx<'a, TransformerState>) -> Statement<'a> {
        // Test: _initClass
        let test = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "_initClass")));
        
        // Consequent: _initClass();
        let callee = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "_initClass")));
        let call = ctx.ast.expression_call(SPAN, callee, NONE, ctx.ast.vec(), false);
        let consequent = ctx.ast.statement_expression(SPAN, call);
        
        ctx.ast.statement_if(SPAN, test, consequent, None)
    }
    
    fn collect_class_decorators(&self, class: &Class<'a>) -> Vec<String> {
        class.decorators.iter().map(|dec| {
            self.generate_expression_code(&dec.expression)
        }).collect()
    }
    
    fn generate_static_block_code(
        &self,
        metadata: &[DecoratorMetadata],
        class_decorators: &[String],
    ) -> String {
        // NOTE: This function uses format! to build code strings.
        // An AST-based approach would build Expression nodes for the descriptors
        // and use AstBuilder to create the static block node structure.
        // See DecoratorAstMetadata for the AST-based metadata structure.
        
        let descriptors: Vec<String> = metadata.iter()
            .flat_map(|meta| {
                meta.decorator_names.iter().map(move |decorator_name| {
                    let flags = (meta.kind as u8) | if meta.is_static { 8 } else { 0 };
                    let key = if meta.is_private { &meta.key[1..] } else { &meta.key };
                    // TODO: Replace with AST node building:
                    // - Build array expression with decorator, flags, key, isPrivate
                    // - Use AstBuilder to create proper Expression nodes
                    format!("[{}, {}, \"{}\", {}]", decorator_name, flags, key, meta.is_private)
                })
            })
            .collect();
        
        let member_desc_array = format!("[{}]", descriptors.join(", "));
        let class_dec_array = format!("[{}]", class_decorators.join(", "));
        
        // Generate the appropriate static block based on whether there are class decorators
        // TODO: Build this as AST nodes using AstBuilder instead of string formatting
        if class_decorators.is_empty() {
            // Only member decorators - use .e property and call _initClass if defined
            format!(
                "static {{ [_initProto, _initClass] = _applyDecs(this, {}, {}).e; if (_initClass) _initClass(); }}",
                member_desc_array,
                class_dec_array
            )
        } else {
            // Has class decorators - use .c property which may replace the class
            // The .c property returns [newClass, classInitializer]
            format!(
                "static {{ let _classThis; [_classThis, _initClass] = _applyDecs(this, {}, {}).c; if (_initClass) _initClass(); }}",
                member_desc_array,
                class_dec_array
            )
        }
    }
    
    /// Parse static block code and create AST element for insertion
    /// This is Step 1: Parse the generated code into AST and insert during traversal
    /// Instead of storing code string and injecting post-codegen
    fn create_static_block_element(
        &self,
        static_block_code: &str,
        ctx: &mut TraverseCtx<'a, TransformerState>,
    ) -> Option<ClassElement<'a>> {
        // Wrap the static block in a class to parse it
        let wrapped_code = format!("class Temp {{ {} }}", static_block_code);
        // Allocate in the arena so it has lifetime 'a
        let wrapped_code_arena = ctx.ast.allocator.alloc_str(&wrapped_code);
        
        // Parse the wrapped code
        let parser = Parser::new(ctx.ast.allocator, wrapped_code_arena, SourceType::default().with_typescript(true));
        let parse_result = parser.parse();
        
        if !parse_result.errors.is_empty() {
            return None;
        }
        
        // Extract the static block from the parsed class
        if let Some(Statement::ClassDeclaration(class_decl)) = parse_result.program.body.first() {
            // Find the static block in the class body
            for element in &class_decl.body.body {
                if matches!(element, ClassElement::StaticBlock(_)) {
                    // We found the static block, but we need to create a scope for it
                    // Extract the statements from the static block
                    if let ClassElement::StaticBlock(static_block) = element {
                        // Create a new scope for the static block
                        let scope_id = ctx.create_child_scope_of_current(ScopeFlags::ClassStaticBlock);
                        
                        // Create new static block with proper scope in the current allocator
                        // We need to rebuild the statements in the current allocator context
                        // For now, use vec_from_iter to transfer the statements
                        let statements = ctx.ast.vec_from_iter(static_block.body.iter().map(|stmt| {
                            // This is a simplification - we're transferring ownership
                            // In a full implementation, we'd need to properly clone/transfer nodes
                            unsafe { std::ptr::read(stmt as *const Statement<'a>) }
                        }));
                        
                        return Some(ctx.ast.class_element_static_block_with_scope_id(
                            SPAN,
                            statements,
                            scope_id,
                        ));
                    }
                }
            }
        }
        
        None
    }
    
    /// Parse static block code into AST node (Placeholder Implementation)
    /// 
    /// NOTE: This is a placeholder showing the direction for AST-based approach.
    /// Currently returns None because transferring parsed nodes between allocators
    /// is complex with oxc's arena allocation model.
    /// 
    /// Full implementation would:
    /// 1. Parse the static block code
    /// 2. Extract the StaticBlock node
    /// 3. Transfer ownership to the current allocator
    /// 4. Return the node for insertion
    /// 
    /// For now, we rely on post-codegen string injection.
    #[allow(dead_code)]  // Placeholder for future AST-based implementation
    fn parse_static_block(&self, _static_block_code: &str) -> Option<ClassElement<'a>> {
        // TODO: Implement proper AST node parsing and transfer
        // Challenges:
        // - oxc uses arena allocation, can't easily transfer nodes between allocators
        // - Would need to rebuild nodes using ctx.ast in the transform method
        // - Alternative: build nodes directly using AstBuilder instead of parsing
        None
    }
    
    /// Ensure constructor exists and has _initProto call (Step 2: AST-based)
    fn ensure_constructor_with_init(&self, class: &mut Class<'a>, ctx: &mut TraverseCtx<'a, TransformerState>) {
        // Find existing constructor
        let constructor_index = class.body.body.iter().position(|element| {
            matches!(element, ClassElement::MethodDefinition(m) 
                if m.kind == MethodDefinitionKind::Constructor)
        });
        
        if let Some(index) = constructor_index {
            // Modify existing constructor via AST
            if let ClassElement::MethodDefinition(method) = &mut class.body.body[index] {
                if let Some(ref mut body) = method.value.body {
                    // Find position to insert: after super() if exists, otherwise at start
                    let insert_pos = self.find_super_call_insert_position(&body.statements);
                    
                    // Build: if (_initProto) _initProto(this);
                    let init_stmt = self.build_init_proto_if_statement(ctx);
                    body.statements.insert(insert_pos, init_stmt);
                }
            }
        } else {
            // Create new constructor with _initProto call
            let constructor = self.create_constructor_with_init(class, ctx);
            class.body.body.insert(0, constructor);
        }
    }
    
    /// Find position in constructor where _initProto should be inserted
    /// Returns position after super() call if it exists, otherwise 0
    fn find_super_call_insert_position(&self, statements: &oxc_allocator::Vec<Statement>) -> usize {
        for (i, stmt) in statements.iter().enumerate() {
            if let Statement::ExpressionStatement(expr_stmt) = stmt {
                if let Expression::CallExpression(call) = &expr_stmt.expression {
                    if matches!(&call.callee, Expression::Super(_)) {
                        // Found super() call, insert after it
                        return i + 1;
                    }
                }
            }
        }
        // No super() found, insert at beginning
        0
    }
    
    /// Build: if (_initProto) _initProto(this);
    fn build_init_proto_if_statement(&self, ctx: &TraverseCtx<'a, TransformerState>) -> Statement<'a> {
        // Build test: _initProto
        let test = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "_initProto")));
        
        // Build consequent: _initProto(this);
        let callee = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "_initProto")));
        let mut arguments = ctx.ast.vec();
        arguments.push(Argument::from(ctx.ast.expression_this(SPAN)));
        let call = ctx.ast.expression_call(SPAN, callee, NONE, arguments, false);
        let consequent = ctx.ast.statement_expression(SPAN, call);
        
        ctx.ast.statement_if(SPAN, test, consequent, None)
    }
    
    /// Create a new constructor with _initProto call
    fn create_constructor_with_init(
        &self,
        class: &Class<'a>,
        ctx: &mut TraverseCtx<'a, TransformerState>,
    ) -> ClassElement<'a> {
        let mut statements = ctx.ast.vec();
        
        // If class has super class, add super() call first
        if class.super_class.is_some() {
            let super_call = ctx.ast.expression_call(
                SPAN,
                ctx.ast.expression_super(SPAN),
                NONE,
                ctx.ast.vec(),
                false,
            );
            statements.push(ctx.ast.statement_expression(SPAN, super_call));
        }
        
        // Add: if (_initProto) _initProto(this);
        let init_stmt = self.build_init_proto_if_statement(ctx);
        statements.push(init_stmt);
        
        // Build function body
        let body = ctx.ast.alloc_function_body(SPAN, ctx.ast.vec(), statements);
        
        // Build constructor function with proper scope
        let scope_id = ctx.create_child_scope_of_current(
            ScopeFlags::Function | ScopeFlags::Constructor
        );
        
        let params = ctx.ast.alloc_formal_parameters(
            SPAN,
            FormalParameterKind::FormalParameter,
            ctx.ast.vec(),
            NONE,
        );
        
        let function = ctx.ast.alloc_function_with_scope_id(
            SPAN,
            FunctionType::FunctionExpression,
            None,  // id: Option<BindingIdentifier>
            false,
            false,
            false,
            NONE,
            NONE,
            params,
            NONE,
            Some(body),
            scope_id,
        );
        
        // Build constructor method definition
        let key = PropertyKey::StaticIdentifier(ctx.ast.alloc_identifier_name(SPAN, "constructor"));
        ctx.ast.class_element_method_definition(
            SPAN,
            MethodDefinitionType::MethodDefinition,
            ctx.ast.vec(),  // decorators
            key,
            function,
            MethodDefinitionKind::Constructor,
            false,  // computed
            false,  // static
            false,  // r#override
            false,  // optional
            None,   // accessibility: Option<TSAccessibility>
        )
    }
}

#[derive(Debug, Clone)]
struct DecoratorMetadata {
    decorator_names: Vec<String>,
    kind: DecoratorKind,
    is_static: bool,
    is_private: bool,
    key: String,
}

/// AST-based decorator metadata that stores Expression references
/// instead of generated code strings
#[derive(Debug)]
#[allow(dead_code)]  // Reserved for future full AST implementation
struct DecoratorAstMetadata<'a> {
    decorator_expressions: Vec<&'a Expression<'a>>,  // Store AST nodes, not strings
    kind: DecoratorKind,
    is_static: bool,
    is_private: bool,
    key: String,
}

impl<'a> Traverse<'a, TransformerState> for DecoratorTransformer<'a> {
    fn enter_class(&mut self, class: &mut Class<'a>, ctx: &mut TraverseCtx<'a, TransformerState>) {
        self.transform_class_with_decorators(class, ctx);
    }

    fn exit_class(&mut self, _class: &mut Class<'a>, _ctx: &mut TraverseCtx<'a, TransformerState>) {
        *self.in_decorated_class.borrow_mut() = false;
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use oxc_allocator::Allocator;
    use oxc_parser::Parser;
    use oxc_span::SourceType;
    use oxc_traverse::traverse_mut;
    use oxc_semantic::SemanticBuilder;

    #[test]
    fn test_transformer_creation() {
        let allocator = Allocator::default();
        let transformer = DecoratorTransformer::new(&allocator);
        assert_eq!(transformer.errors.len(), 0);
    }

    #[test]
    fn test_class_with_decorator() {
        let allocator = Allocator::default();
        let source_text = "@dec class C {}";
        let source_type = SourceType::default();

        let parser = Parser::new(&allocator, source_text, source_type);
        let mut parse_result = parser.parse();

        // Build semantic information (scoping)
        let semantic_ret = SemanticBuilder::new()
            .build(&parse_result.program);
        let scoping = semantic_ret.semantic.into_scoping();

        let mut transformer = DecoratorTransformer::new(&allocator);
        let state = TransformerState;
        traverse_mut(&mut transformer, &allocator, &mut parse_result.program, scoping, state);

        // Transformer should have removed the decorators
        assert_eq!(transformer.errors.len(), 0);
        
        // Verify the class still exists but decorators are removed
        if let Statement::ClassDeclaration(class_decl) = &parse_result.program.body[0] {
            assert!(class_decl.decorators.is_empty());
        } else {
            panic!("Expected class declaration");
        }
    }

    #[test]
    fn test_method_decorator() {
        let allocator = Allocator::default();
        let source_text = "class C { @dec method() {} }";
        let source_type = SourceType::default();

        let parser = Parser::new(&allocator, source_text, source_type);
        let mut parse_result = parser.parse();

        // Build semantic information (scoping)
        let semantic_ret = SemanticBuilder::new()
            .build(&parse_result.program);
        let scoping = semantic_ret.semantic.into_scoping();

        let mut transformer = DecoratorTransformer::new(&allocator);
        let state = TransformerState;
        traverse_mut(&mut transformer, &allocator, &mut parse_result.program, scoping, state);

        assert!(parse_result.program.body.len() > 0);
    }

    #[test]
    fn test_field_decorator() {
        let allocator = Allocator::default();
        let source_text = "class C { @dec field = 1; }";
        let source_type = SourceType::default();

        let parser = Parser::new(&allocator, source_text, source_type);
        let mut parse_result = parser.parse();

        // Build semantic information (scoping)
        let semantic_ret = SemanticBuilder::new()
            .build(&parse_result.program);
        let scoping = semantic_ret.semantic.into_scoping();

        let mut transformer = DecoratorTransformer::new(&allocator);
        let state = TransformerState;
        traverse_mut(&mut transformer, &allocator, &mut parse_result.program, scoping, state);

        assert!(parse_result.program.body.len() > 0);
    }
}
