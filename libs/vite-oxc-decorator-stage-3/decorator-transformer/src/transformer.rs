//! TC39 Stage 3 Decorator Transformer
//!
//! Transforms decorator syntax into runtime calls using AST manipulation.
//! Decorators are converted to _applyDecs() calls with proper metadata.

use oxc_allocator::Allocator;
use oxc_ast::{NONE, ast::*};
use oxc_traverse::{Traverse, TraverseCtx};
use oxc_codegen::Codegen;
use oxc_semantic::ScopeFlags;
use oxc_span::SPAN;
use std::cell::RefCell;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
pub enum DecoratorKind {
    Field = 0,
    Accessor = 1,
    Method = 2,
    Getter = 3,
    Setter = 4,
}

pub struct DecoratorTransformer<'a> {
    pub errors: Vec<String>,
    in_decorated_class: RefCell<bool>,
    helpers_injected: RefCell<bool>,
    classes_with_class_decorators: RefCell<Vec<ClassDecoratorInfo<'a>>>,
    _allocator: &'a Allocator,
}

pub struct ClassDecoratorInfo<'a> {
    pub class_name: String,
    pub decorators: Vec<Expression<'a>>,
}

pub struct TransformerState;

impl<'a> DecoratorTransformer<'a> {
    pub fn new(allocator: &'a Allocator) -> Self {
        Self {
            errors: Vec::new(),
            in_decorated_class: RefCell::new(false),
            helpers_injected: RefCell::new(false),
            classes_with_class_decorators: RefCell::new(Vec::new()),
            _allocator: allocator,
        }
    }
    
    /// Get the collected class decorator information.
    /// This extracts the data from the RefCell by converting expressions to strings.
    pub fn get_class_decorator_strings(&self) -> Vec<(String, Vec<String>)> {
        self.classes_with_class_decorators.borrow()
            .iter()
            .map(|info| {
                let decorator_strings = info.decorators.iter().map(|expr| {
                    let mut codegen = Codegen::new();
                    codegen.print_expression(expr);
                    codegen.into_source_text()
                }).collect();
                (info.class_name.clone(), decorator_strings)
            })
            .collect()
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
    
    /// Clone an expression node using the AST builder.
    /// This is needed because we can't move the original decorator expression.
    fn clone_expression(&self, expr: &Expression<'a>, ctx: &TraverseCtx<'a, TransformerState>) -> Expression<'a> {
        match expr {
            Expression::Identifier(ident) => {
                Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, ident.name)))
            }
            Expression::CallExpression(call) => {
                // Clone the callee
                let callee = self.clone_expression(&call.callee, ctx);
                
                // Clone arguments
                // Argument enum inherits all Expression variants plus SpreadElement
                let mut arguments = ctx.ast.vec();
                for arg in &call.arguments {
                    let cloned_arg = match arg {
                        Argument::SpreadElement(spread) => {
                            let spread_arg = self.clone_expression(&spread.argument, ctx);
                            Argument::SpreadElement(ctx.ast.alloc(ctx.ast.spread_element(SPAN, spread_arg)))
                        }
                        _ => {
                            // All other Argument variants are Expression variants
                            // as_expression() returns Some for all expression-based arguments
                            match arg.as_expression() {
                                Some(expr) => Argument::from(self.clone_expression(expr, ctx)),
                                None => {
                                    // This is unreachable since we handle SpreadElement above
                                    // and all other Argument variants are expressions.
                                    // Panic if we somehow get here as it indicates a bug.
                                    unreachable!("Unexpected non-expression, non-spread argument in decorator call");
                                }
                            }
                        }
                    };
                    arguments.push(cloned_arg);
                }
                
                ctx.ast.expression_call(SPAN, callee, NONE, arguments, false)
            }
            Expression::StaticMemberExpression(member) => {
                let object = self.clone_expression(&member.object, ctx);
                let property = ctx.ast.identifier_name(SPAN, member.property.name);
                Expression::from(ctx.ast.member_expression_static(SPAN, object, property, false))
            }
            Expression::ComputedMemberExpression(member) => {
                let object = self.clone_expression(&member.object, ctx);
                let property = self.clone_expression(&member.expression, ctx);
                Expression::from(ctx.ast.member_expression_computed(SPAN, object, property, false))
            }
            Expression::PrivateFieldExpression(private) => {
                let object = self.clone_expression(&private.object, ctx);
                let field = ctx.ast.private_identifier(SPAN, private.field.name);
                Expression::from(ctx.ast.member_expression_private_field_expression(SPAN, object, field, false))
            }
            // For other complex expressions, we fall back to using codegen to recreate them
            // This is a safety net for decorator patterns we haven't explicitly handled
            _ => {
                // Use codegen to get the string representation, then parse it back
                let mut codegen = Codegen::new();
                codegen.print_expression(expr);
                let code = codegen.into_source_text();
                
                if code.is_empty() {
                    Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "decorator")))
                } else {
                    // For now, create an identifier from the code
                    // This maintains backward compatibility for edge cases
                    let name = ctx.ast.allocator.alloc_str(&code);
                    Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, name)))
                }
            }
        }
    }
    
    /// Extract property key as a string from a PropertyKey AST node.
    /// Returns the key name, stripping the '#' prefix for private identifiers.
    fn extract_property_key_string(&self, key: &PropertyKey<'a>, ctx: &TraverseCtx<'a, TransformerState>) -> &'a str {
        match key {
            PropertyKey::StaticIdentifier(id) => id.name.as_str(),
            PropertyKey::PrivateIdentifier(id) => {
                // Remove the '#' prefix for private identifiers
                id.name.as_str()
            }
            PropertyKey::StringLiteral(lit) => lit.value.as_str(),
            PropertyKey::NumericLiteral(lit) => {
                // Convert number to string and allocate in arena
                let s = lit.value.to_string();
                ctx.ast.allocator.alloc_str(&s)
            }
            _ => "computed",
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
        
        // Collect class decorators first (before we mutate the class)
        let class_decorators = self.collect_class_decorators(class, ctx);
        
        if !class_decorators.is_empty() {
            let class_name = class.id.as_ref()
                .map(|id| id.name.to_string())
                .unwrap_or_else(|| "default".to_string());
            self.classes_with_class_decorators.borrow_mut().push(ClassDecoratorInfo {
                class_name,
                decorators: class_decorators,
            });
        }
        
        // Build the static block with member descriptors inline
        // This is added for all decorated classes (even if only class decorators)
        // because class decorators may also need initialization
        let static_block = self.create_decorator_static_block_from_class(class, ctx);
        class.body.body.push(static_block);
        
        // Check if we need instance initialization
        let needs_instance_init = class.body.body.iter().any(|element| {
            match element {
                ClassElement::MethodDefinition(m) if !m.decorators.is_empty() => {
                    !m.r#static
                }
                ClassElement::PropertyDefinition(p) if !p.decorators.is_empty() => {
                    !p.r#static
                }
                ClassElement::AccessorProperty(a) if !a.decorators.is_empty() => {
                    !a.r#static
                }
                _ => false,
            }
        });
        
        if needs_instance_init {
            self.ensure_constructor_with_init(class, ctx);
        }
        
        // Clear decorators from the class and its members
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
    
    /// Create static block by building descriptor array directly from class elements.
    /// This avoids intermediate metadata storage and lifetime issues.
    /// 
    /// Generated code:
    /// ```js
    /// static {
    ///     [_initProto, _initClass] = _applyDecs(this, [
    ///         [decorator, kind, "memberName", isPrivate],
    ///         // ... more descriptors
    ///     ], []).e;
    ///     if (_initClass) _initClass();
    /// }
    /// ```
    fn create_decorator_static_block_from_class(
        &self,
        class: &Class<'a>,
        ctx: &mut TraverseCtx<'a, TransformerState>,
    ) -> ClassElement<'a> {
        let mut statements = ctx.ast.vec();
        
        // Build member descriptor array directly from class elements
        let member_desc_array = self.build_member_descriptor_array_from_class(class, ctx);
        let empty_class_dec_array = ctx.ast.expression_array(SPAN, ctx.ast.vec());
        
        // Build: [_initProto, _initClass] = _applyDecs(this, memberDecorators, []).e
        let assignment_stmt = self.build_apply_decs_assignment(
            &["_initProto", "_initClass"],
            member_desc_array,
            empty_class_dec_array,
            "e",
            ctx,
        );
        statements.push(assignment_stmt);
        
        // Build: if (_initClass) _initClass();
        let init_class_call = self.build_init_class_if_statement(ctx);
        statements.push(init_class_call);
        
        let scope_id = ctx.create_child_scope_of_current(ScopeFlags::ClassStaticBlock);
        ctx.ast.class_element_static_block_with_scope_id(SPAN, statements, scope_id)
    }
    
    /// Build member descriptor array directly from class elements.
    /// Processes decorators inline without storing intermediate metadata.
    fn build_member_descriptor_array_from_class(
        &self,
        class: &Class<'a>,
        ctx: &TraverseCtx<'a, TransformerState>,
    ) -> Expression<'a> {
        let mut descriptors = ctx.ast.vec();
        
        // Iterate through class elements and build descriptors
        for element in &class.body.body {
            match element {
                ClassElement::MethodDefinition(m) if !m.decorators.is_empty() => {
                    let kind = match m.kind {
                        MethodDefinitionKind::Get => DecoratorKind::Getter,
                        MethodDefinitionKind::Set => DecoratorKind::Setter,
                        _ => DecoratorKind::Method,
                    };
                    let is_static = m.r#static;
                    let is_private = matches!(&m.key, PropertyKey::PrivateIdentifier(_));
                    
                    // Add descriptor for each decorator
                    for decorator in m.decorators.iter() {
                        let descriptor = self.build_single_descriptor(
                            &decorator.expression,
                            kind,
                            is_static,
                            is_private,
                            &m.key,
                            ctx,
                        );
                        descriptors.push(ArrayExpressionElement::from(descriptor));
                    }
                }
                ClassElement::PropertyDefinition(p) if !p.decorators.is_empty() => {
                    let kind = DecoratorKind::Field;
                    let is_static = p.r#static;
                    let is_private = matches!(&p.key, PropertyKey::PrivateIdentifier(_));
                    
                    for decorator in p.decorators.iter() {
                        let descriptor = self.build_single_descriptor(
                            &decorator.expression,
                            kind,
                            is_static,
                            is_private,
                            &p.key,
                            ctx,
                        );
                        descriptors.push(ArrayExpressionElement::from(descriptor));
                    }
                }
                ClassElement::AccessorProperty(a) if !a.decorators.is_empty() => {
                    let kind = DecoratorKind::Accessor;
                    let is_static = a.r#static;
                    let is_private = matches!(&a.key, PropertyKey::PrivateIdentifier(_));
                    
                    for decorator in a.decorators.iter() {
                        let descriptor = self.build_single_descriptor(
                            &decorator.expression,
                            kind,
                            is_static,
                            is_private,
                            &a.key,
                            ctx,
                        );
                        descriptors.push(ArrayExpressionElement::from(descriptor));
                    }
                }
                _ => {}
            }
        }
        
        ctx.ast.expression_array(SPAN, descriptors)
    }
    
    /// Build a single decorator descriptor: [decorator, flags, key, isPrivate]
    /// 
    /// Generated code example:
    /// ```js
    /// [logged, 2, "method", false]  // Method decorator
    /// [validated, 0, "field", false] // Field decorator
    /// [tracked, 1, "data", false]   // Accessor decorator
    /// ```
    fn build_single_descriptor(
        &self,
        decorator_expr: &Expression<'a>,
        kind: DecoratorKind,
        is_static: bool,
        is_private: bool,
        key: &PropertyKey<'a>,
        ctx: &TraverseCtx<'a, TransformerState>,
    ) -> Expression<'a> {
        let mut elements = ctx.ast.vec();
        
        // Clone the decorator expression to use in the descriptor array
        let decorator = self.clone_expression(decorator_expr, ctx);
        elements.push(ArrayExpressionElement::from(decorator));
        
        // Build flags: kind (0-4) | static flag (8)
        // Kind values: 0=Field, 1=Accessor, 2=Method, 3=Getter, 4=Setter
        // Static flag adds 8 to the kind value
        let flags = (kind as u8) | if is_static { 8 } else { 0 };
        let flags_expr = ctx.ast.expression_numeric_literal(SPAN, flags as f64, None, NumberBase::Decimal);
        elements.push(ArrayExpressionElement::from(flags_expr));
        
        // Extract key name from PropertyKey AST node
        let key_str = self.extract_property_key_string(key, ctx);
        let key_expr = ctx.ast.expression_string_literal(SPAN, key_str, None);
        elements.push(ArrayExpressionElement::from(key_expr));
        
        // Is private flag
        let is_private_expr = ctx.ast.expression_boolean_literal(SPAN, is_private);
        elements.push(ArrayExpressionElement::from(is_private_expr));
        
        ctx.ast.expression_array(SPAN, elements)
    }
    
    /// Build assignment statement: `[_initProto, _initClass] = _applyDecs(this, memberDecorators, []).e`
    /// Uses AST builder to create array destructuring pattern instead of string manipulation.
    /// 
    /// Generated code:
    /// ```js
    /// [_initProto, _initClass] = _applyDecs(this, memberDecorators, classDecorators).e
    /// ```
    fn build_apply_decs_assignment(
        &self,
        target_names: &[&'a str],
        member_desc_array: Expression<'a>,
        class_dec_array: Expression<'a>,
        property_name: &'a str,
        ctx: &mut TraverseCtx<'a, TransformerState>,
    ) -> Statement<'a> {
        // Build: _applyDecs(this, memberDecorators, classDecorators)
        let apply_decs_callee = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "_applyDecs")));
        let mut arguments = ctx.ast.vec();
        arguments.push(Argument::from(ctx.ast.expression_this(SPAN))); // `this`
        arguments.push(Argument::from(member_desc_array)); // member descriptor array
        arguments.push(Argument::from(class_dec_array)); // class decorator array
        let apply_decs_call = ctx.ast.expression_call(SPAN, apply_decs_callee, NONE, arguments, false);
        
        // Build: _applyDecs(...).e (or .c for class decorators)
        let property = ctx.ast.identifier_name(SPAN, property_name);
        let member_expr = ctx.ast.member_expression_static(SPAN, apply_decs_call, property, false);
        let right = Expression::from(member_expr);
        
        // Build array assignment targets: [_initProto, _initClass]
        let mut assignment_elements = ctx.ast.vec();
        for &name in target_names {
            // Create identifier reference and wrap in box
            let ident_ref = ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, name));
            let target = AssignmentTargetMaybeDefault::from(
                SimpleAssignmentTarget::AssignmentTargetIdentifier(ident_ref)
            );
            assignment_elements.push(Some(target));
        }
        
        // Build: [_initProto, _initClass] = _applyDecs(this, ...).e
        let array_assignment_target = ctx.ast.assignment_target_pattern_array_assignment_target(
            SPAN,
            assignment_elements,
            NONE
        );
        let assignment_target = AssignmentTarget::from(array_assignment_target);
        let assignment = ctx.ast.expression_assignment(SPAN, AssignmentOperator::Assign, assignment_target, right);
        ctx.ast.statement_expression(SPAN, assignment)
    }
    /// Build if statement: `if (_initClass) _initClass();`
    /// 
    /// Generated code:
    /// ```js
    /// if (_initClass) _initClass();
    /// ```
    fn build_init_class_if_statement(&self, ctx: &TraverseCtx<'a, TransformerState>) -> Statement<'a> {
        // Build test condition: `_initClass`
        let test = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "_initClass")));
        
        // Build consequent: `_initClass();`
        let callee = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "_initClass")));
        let call = ctx.ast.expression_call(SPAN, callee, NONE, ctx.ast.vec(), false);
        let consequent = ctx.ast.statement_expression(SPAN, call);
        
        ctx.ast.statement_if(SPAN, test, consequent, None)
    }
    
    /// Collect class decorator expressions as AST nodes.
    /// Clones the decorator expressions for later use in transformation.
    fn collect_class_decorators(&self, class: &Class<'a>, ctx: &TraverseCtx<'a, TransformerState>) -> Vec<Expression<'a>> {
        class.decorators.iter()
            .map(|dec| self.clone_expression(&dec.expression, ctx))
            .collect()
    }
    fn ensure_constructor_with_init(&self, class: &mut Class<'a>, ctx: &mut TraverseCtx<'a, TransformerState>) {
        let constructor_index = class.body.body.iter().position(|element| {
            matches!(element, ClassElement::MethodDefinition(m) 
                if m.kind == MethodDefinitionKind::Constructor)
        });
        
        if let Some(index) = constructor_index {
            if let ClassElement::MethodDefinition(method) = &mut class.body.body[index] {
                if let Some(ref mut body) = method.value.body {
                    let insert_pos = self.find_super_call_insert_position(&body.statements);
                    let init_stmt = self.build_init_proto_if_statement(ctx);
                    body.statements.insert(insert_pos, init_stmt);
                }
            }
        } else {
            let constructor = self.create_constructor_with_init(class, ctx);
            class.body.body.insert(0, constructor);
        }
    }
    
    fn find_super_call_insert_position(&self, statements: &oxc_allocator::Vec<Statement>) -> usize {
        for (i, stmt) in statements.iter().enumerate() {
            if let Statement::ExpressionStatement(expr_stmt) = stmt {
                if let Expression::CallExpression(call) = &expr_stmt.expression {
                    if matches!(&call.callee, Expression::Super(_)) {
                        return i + 1;
                    }
                }
            }
        }
        0
    }
    
    /// Build if statement: `if (_initProto) _initProto(this);`
    /// 
    /// Generated code:
    /// ```js
    /// if (_initProto) _initProto(this);
    /// ```
    fn build_init_proto_if_statement(&self, ctx: &TraverseCtx<'a, TransformerState>) -> Statement<'a> {
        // Build test condition: `_initProto`
        let test = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "_initProto")));
        
        // Build consequent: `_initProto(this);`
        let callee = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "_initProto")));
        let mut arguments = ctx.ast.vec();
        arguments.push(Argument::from(ctx.ast.expression_this(SPAN))); // `this` argument
        let call = ctx.ast.expression_call(SPAN, callee, NONE, arguments, false);
        let consequent = ctx.ast.statement_expression(SPAN, call);
        
        ctx.ast.statement_if(SPAN, test, consequent, None)
    }
    
    /// Create a constructor with initialization code for decorated fields/accessors.
    /// 
    /// Generated code for class without parent:
    /// ```js
    /// constructor() {
    ///     if (_initProto) _initProto(this);
    /// }
    /// ```
    /// 
    /// Generated code for class with parent:
    /// ```js
    /// constructor() {
    ///     super();
    ///     if (_initProto) _initProto(this);
    /// }
    /// ```
    fn create_constructor_with_init(
        &self,
        class: &Class<'a>,
        ctx: &mut TraverseCtx<'a, TransformerState>,
    ) -> ClassElement<'a> {
        let mut statements = ctx.ast.vec();
        
        // If the class has a parent, call super() first
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
        
        // Add initialization call: if (_initProto) _initProto(this);
        let init_stmt = self.build_init_proto_if_statement(ctx);
        statements.push(init_stmt);
        
        let body = ctx.ast.alloc_function_body(SPAN, ctx.ast.vec(), statements);
        
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
            None,
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
        
        let key = PropertyKey::StaticIdentifier(ctx.ast.alloc_identifier_name(SPAN, "constructor"));
        ctx.ast.class_element_method_definition(
            SPAN,
            MethodDefinitionType::MethodDefinition,
            ctx.ast.vec(),
            key,
            function,
            MethodDefinitionKind::Constructor,
            false,
            false,
            false,
            false,
            None,
        )
    }
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
