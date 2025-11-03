use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use oxc_traverse::{Traverse, TraverseCtx};
use oxc_codegen::Codegen;
use std::cell::RefCell;

/// Represents the kind of decorator according to TC39 Stage 3 decorator specification
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[repr(u8)]
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
    pub transformations: RefCell<Vec<ClassTransformation>>,
}

pub struct TransformerState;

#[derive(Debug, Clone)]
pub struct ClassTransformation {
    pub class_name: String,
    pub static_block_code: String,
    pub needs_instance_init: bool,  // True if field/accessor decorators exist
}

impl<'a> DecoratorTransformer<'a> {
    pub fn new(allocator: &'a Allocator) -> Self {
        Self {
            errors: Vec::new(),
            in_decorated_class: RefCell::new(false),
            helpers_injected: RefCell::new(false),
            _allocator: allocator,
            transformations: RefCell::new(Vec::new()),
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
        _ctx: &mut TraverseCtx<'a, TransformerState>,
    ) -> bool {
        if !self.has_decorators(class) {
            return false;
        }

        *self.in_decorated_class.borrow_mut() = true;
        *self.helpers_injected.borrow_mut() = true;
        
        let class_name = class.id.as_ref()
            .map(|id| id.name.to_string())
            .unwrap_or_else(|| "AnonymousClass".to_string());
        
        let metadata = self.collect_decorator_metadata(class);
        let class_decorators = self.collect_class_decorators(class);
        
        // Check if we need instance initialization (field or accessor decorators)
        let needs_instance_init = metadata.iter().any(|m| {
            m.kind == DecoratorKind::Field || m.kind == DecoratorKind::Accessor
        });
        
        if !metadata.is_empty() || !class_decorators.is_empty() {
            let static_block_code = self.generate_static_block_code(&metadata, &class_decorators);
            self.transformations.borrow_mut().push(ClassTransformation {
                class_name,
                static_block_code,
                needs_instance_init,
            });
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
        let descriptors: Vec<String> = metadata.iter()
            .flat_map(|meta| {
                meta.decorator_names.iter().map(move |decorator_name| {
                    let flags = (meta.kind as u8) | if meta.is_static { 8 } else { 0 };
                    let key = if meta.is_private { &meta.key[1..] } else { &meta.key };
                    format!("[{}, {}, \"{}\", {}]", decorator_name, flags, key, meta.is_private)
                })
            })
            .collect();
        
        let member_desc_array = format!("[{}]", descriptors.join(", "));
        let class_dec_array = format!("[{}]", class_decorators.join(", "));
        
        // Generate the appropriate static block based on whether there are class decorators
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
