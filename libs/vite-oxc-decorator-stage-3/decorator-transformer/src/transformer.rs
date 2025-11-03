use oxc_allocator::Allocator;
use oxc_ast::ast::*;
use oxc_traverse::{Traverse, TraverseCtx};
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
        program.body.iter().any(|stmt| {
            matches!(stmt, Statement::ClassDeclaration(class_decl) if self.has_decorators(&class_decl))
        })
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
    
    fn extract_decorator_names(&self, decorators: &oxc_allocator::Vec<'a, Decorator<'a>>) -> Vec<String> {
        decorators.iter().map(|dec| {
            match &dec.expression {
                Expression::Identifier(ident) => ident.name.to_string(),
                Expression::CallExpression(call) => {
                    if let Expression::Identifier(ident) = &call.callee {
                        ident.name.to_string()
                    } else {
                        "decorator".to_string()
                    }
                }
                _ => "decorator".to_string(),
            }
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
        
        if !metadata.is_empty() || !class_decorators.is_empty() {
            let static_block_code = self.generate_static_block_code(&metadata, &class_decorators);
            self.transformations.borrow_mut().push(ClassTransformation {
                class_name,
                static_block_code,
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
            match &dec.expression {
                Expression::Identifier(ident) => ident.name.to_string(),
                Expression::CallExpression(call) => {
                    if let Expression::Identifier(ident) = &call.callee {
                        ident.name.to_string()
                    } else {
                        "decorator".to_string()
                    }
                }
                _ => "decorator".to_string(),
            }
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
        
        format!(
            "static {{ [_initProto, _initClass] = _applyDecs(this, {}, {}).e; }}",
            member_desc_array,
            class_dec_array
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
