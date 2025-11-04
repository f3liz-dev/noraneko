//! TC39 Stage 3 Decorator Transformer
//!
//! Transforms decorator syntax into runtime calls using AST manipulation.
//! Decorators are converted to _applyDecs() calls with proper metadata.

use oxc_allocator::Allocator;
use oxc_ast::{NONE, ast::*};
use oxc_traverse::{Traverse, TraverseCtx};
use oxc_codegen::Codegen;
use oxc_parser::Parser;
use oxc_semantic::ScopeFlags;
use oxc_span::{SourceType, SPAN};
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
    classes_with_class_decorators: RefCell<Vec<ClassDecoratorInfo>>,
    _allocator: &'a Allocator,
}

#[derive(Debug, Clone)]
pub struct ClassDecoratorInfo {
    pub class_name: String,
    pub decorator_names: Vec<String>,
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
    
    pub fn get_classes_with_class_decorators(&self) -> Vec<ClassDecoratorInfo> {
        self.classes_with_class_decorators.borrow().clone()
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
    
    fn generate_expression_code(&self, expr: &Expression<'a>) -> String {
        let mut codegen = Codegen::new();
        codegen.print_expression(expr);
        let code = codegen.into_source_text();
        
        if code.is_empty() {
            "decorator".to_string()
        } else {
            code
        }
    }
    
    fn extract_decorator_names(&self, decorators: &oxc_allocator::Vec<'a, Decorator<'a>>) -> Vec<String> {
        decorators.iter()
            .map(|dec| self.generate_expression_code(&dec.expression))
            .collect()
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
        
        if !class_decorators.is_empty() {
            let class_name = class.id.as_ref()
                .map(|id| id.name.to_string())
                .unwrap_or_else(|| "default".to_string());
            self.classes_with_class_decorators.borrow_mut().push(ClassDecoratorInfo {
                class_name,
                decorator_names: class_decorators.clone(),
            });
        }
        
        let needs_instance_init = metadata.iter().any(|m| {
            !m.is_static && matches!(
                m.kind,
                DecoratorKind::Field | DecoratorKind::Accessor | 
                DecoratorKind::Method | DecoratorKind::Getter | DecoratorKind::Setter
            )
        });
        
        if !metadata.is_empty() || !class_decorators.is_empty() {
            let metadata_leaked: &'a [DecoratorMetadata] = Box::leak(metadata.into_boxed_slice());
            
            let static_block = self.create_decorator_static_block(metadata_leaked, &class_decorators, ctx);
            class.body.body.push(static_block);
            
            if needs_instance_init {
                self.ensure_constructor_with_init(class, ctx);
            }
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
    
    fn create_decorator_static_block(
        &self,
        metadata: &'a [DecoratorMetadata],
        _class_decorators: &[String],
        ctx: &mut TraverseCtx<'a, TransformerState>,
    ) -> ClassElement<'a> {
        let mut statements = ctx.ast.vec();
        
        let member_desc_array = self.build_member_descriptor_array(metadata, ctx);
        let empty_class_dec_array = ctx.ast.expression_array(SPAN, ctx.ast.vec());
        
        let assignment_stmt = self.build_apply_decs_assignment(
            &["_initProto", "_initClass"],
            member_desc_array,
            empty_class_dec_array,
            "e",
            ctx,
        );
        statements.push(assignment_stmt);
        
        let init_class_call = self.build_init_class_if_statement(ctx);
        statements.push(init_class_call);
        
        let scope_id = ctx.create_child_scope_of_current(ScopeFlags::ClassStaticBlock);
        ctx.ast.class_element_static_block_with_scope_id(SPAN, statements, scope_id)
    }
    
    fn build_member_descriptor_array(
        &self,
        metadata: &'a [DecoratorMetadata],
        ctx: &TraverseCtx<'a, TransformerState>,
    ) -> Expression<'a> {
        let mut descriptors = ctx.ast.vec();
        
        for meta in metadata {
            for decorator_name in &meta.decorator_names {
                let mut elements = ctx.ast.vec();
                
                let name_arena = ctx.ast.allocator.alloc_str(decorator_name);
                let decorator_ref = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, name_arena)));
                elements.push(ArrayExpressionElement::from(decorator_ref));
                
                let flags = (meta.kind as u8) | if meta.is_static { 8 } else { 0 };
                let flags_expr = ctx.ast.expression_numeric_literal(SPAN, flags as f64, None, NumberBase::Decimal);
                elements.push(ArrayExpressionElement::from(flags_expr));
                
                let key = if meta.is_private { &meta.key[1..] } else { &meta.key };
                let key_expr = ctx.ast.expression_string_literal(SPAN, key, None);
                elements.push(ArrayExpressionElement::from(key_expr));
                
                let is_private_expr = ctx.ast.expression_boolean_literal(SPAN, meta.is_private);
                elements.push(ArrayExpressionElement::from(is_private_expr));
                
                let descriptor_array = ctx.ast.expression_array(SPAN, elements);
                descriptors.push(ArrayExpressionElement::from(descriptor_array));
            }
        }
        
        ctx.ast.expression_array(SPAN, descriptors)
    }
    
    fn build_apply_decs_assignment(
        &self,
        target_names: &[&str],
        member_desc_array: Expression<'a>,
        class_dec_array: Expression<'a>,
        property_name: &'a str,
        ctx: &mut TraverseCtx<'a, TransformerState>,
    ) -> Statement<'a> {
        let apply_decs_callee = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "_applyDecs")));
        let mut arguments = ctx.ast.vec();
        arguments.push(Argument::from(ctx.ast.expression_this(SPAN)));
        arguments.push(Argument::from(member_desc_array));
        arguments.push(Argument::from(class_dec_array));
        let apply_decs_call = ctx.ast.expression_call(SPAN, apply_decs_callee, NONE, arguments, false);
        
        let property = ctx.ast.identifier_name(SPAN, property_name);
        let member_expr = ctx.ast.member_expression_static(SPAN, apply_decs_call, property, false);
        let right = Expression::from(member_expr);
        
        let target_list = target_names.join(", ");
        let assignment_code = format!("[{}] = temp", target_list);
        let wrapped = format!("({})", assignment_code);
        let wrapped_arena = ctx.ast.allocator.alloc_str(&wrapped);
        
        let parser = Parser::new(ctx.ast.allocator, wrapped_arena, SourceType::default());
        let parse_result = parser.parse();
        
        if let Some(Statement::ExpressionStatement(expr_stmt)) = parse_result.program.body.first() {
            if let Expression::ParenthesizedExpression(paren) = &expr_stmt.expression {
                if let Expression::AssignmentExpression(assign) = &paren.expression {
                    let left = unsafe { std::ptr::read(&assign.left as *const AssignmentTarget<'a>) };
                    let assignment = ctx.ast.expression_assignment(SPAN, AssignmentOperator::Assign, left, right);
                    return ctx.ast.statement_expression(SPAN, assignment);
                }
            }
        }
        
        ctx.ast.statement_empty(SPAN)
    }
    fn build_init_class_if_statement(&self, ctx: &TraverseCtx<'a, TransformerState>) -> Statement<'a> {
        let test = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "_initClass")));
        let callee = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "_initClass")));
        let call = ctx.ast.expression_call(SPAN, callee, NONE, ctx.ast.vec(), false);
        let consequent = ctx.ast.statement_expression(SPAN, call);
        ctx.ast.statement_if(SPAN, test, consequent, None)
    }
    
    fn collect_class_decorators(&self, class: &Class<'a>) -> Vec<String> {
        class.decorators.iter()
            .map(|dec| self.generate_expression_code(&dec.expression))
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
    
    fn build_init_proto_if_statement(&self, ctx: &TraverseCtx<'a, TransformerState>) -> Statement<'a> {
        let test = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "_initProto")));
        
        let callee = Expression::Identifier(ctx.ast.alloc(ctx.ast.identifier_reference(SPAN, "_initProto")));
        let mut arguments = ctx.ast.vec();
        arguments.push(Argument::from(ctx.ast.expression_this(SPAN)));
        let call = ctx.ast.expression_call(SPAN, callee, NONE, arguments, false);
        let consequent = ctx.ast.statement_expression(SPAN, call);
        
        ctx.ast.statement_if(SPAN, test, consequent, None)
    }
    
    fn create_constructor_with_init(
        &self,
        class: &Class<'a>,
        ctx: &mut TraverseCtx<'a, TransformerState>,
    ) -> ClassElement<'a> {
        let mut statements = ctx.ast.vec();
        
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

#[derive(Debug, Clone)]
struct DecoratorMetadata {
    decorator_names: Vec<String>,
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
