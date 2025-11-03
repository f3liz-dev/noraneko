use serde::{Deserialize, Serialize};
use oxc_allocator::Allocator;
use oxc_ast::ast::Program;
use oxc_codegen::Codegen;
use oxc_parser::Parser;
use oxc_span::SourceType;
use oxc_traverse::traverse_mut;
use oxc_semantic::SemanticBuilder;

mod transformer;
mod codegen;
use transformer::{DecoratorTransformer, TransformerState};
use codegen::generate_helper_functions;

// Generate bindings from WIT file
wit_bindgen::generate!({
    world: "transformer",
    exports: {
        world: Component,
    },
});

#[derive(Serialize, Deserialize, Debug)]
pub struct TransformOptions {
    #[serde(default = "default_true")]
    pub source_maps: bool,
}

fn default_true() -> bool {
    true
}

pub fn transform(
    filename: String,
    source_text: String,
    options: String,
) -> Result<TransformResult, String> {
    let opts = parse_options(&options)?;
    let allocator = Allocator::default();
    let source_type = SourceType::from_path(&filename).unwrap_or_default();
    
    let parser = Parser::new(&allocator, &source_text, source_type);
    let mut parse_result = parser.parse();
    
    if !parse_result.errors.is_empty() {
        return Ok(TransformResult {
            code: source_text.clone(),
            map: None,
            errors: parse_result.errors.iter().map(|e| format!("{:?}", e)).collect(),
        });
    }

    let mut transformer = DecoratorTransformer::new(&allocator);
    
    if !transformer.check_for_decorators(&parse_result.program) {
        return generate_result(&parse_result.program, &opts, vec![]);
    }

    let semantic = SemanticBuilder::new().build(&parse_result.program);
    let scoping = semantic.semantic.into_scoping();
    
    traverse_mut(&mut transformer, &allocator, &mut parse_result.program, scoping, TransformerState);
    
    let mut codegen_result = Codegen::new().build(&parse_result.program);
    inject_static_blocks(&mut codegen_result.code, &transformer.transformations.borrow());
    
    if transformer.needs_helpers() {
        codegen_result.code = format!("{}\n{}", generate_helper_functions(), codegen_result.code);
    }
    
    Ok(TransformResult {
        code: codegen_result.code,
        map: if opts.source_maps {
            codegen_result.map.map(|m| m.to_json_string())
        } else {
            None
        },
        errors: transformer.errors,
    })
}

fn parse_options(options: &str) -> Result<TransformOptions, String> {
    if options.is_empty() {
        Ok(TransformOptions { source_maps: true })
    } else {
        serde_json::from_str(options).map_err(|e| format!("Invalid options: {}", e))
    }
}

fn generate_result<'a>(program: &Program<'a>, opts: &TransformOptions, errors: Vec<String>) -> Result<TransformResult, String> {
    let codegen_result = Codegen::new().build(&program);
    Ok(TransformResult {
        code: codegen_result.code,
        map: if opts.source_maps {
            codegen_result.map.map(|m| m.to_json_string())
        } else {
            None
        },
        errors,
    })
}

fn inject_static_blocks(code: &mut String, transformations: &[transformer::ClassTransformation]) {
    for transformation in transformations {
        let class_pattern = format!("class {} {{", transformation.class_name);
        let position = code.find(&class_pattern)
            .map(|pos| pos + class_pattern.len())
            .or_else(|| {
                if transformation.class_name == "AnonymousClass" {
                    code.find("class {").map(|pos| pos + "class {".len())
                } else {
                    None
                }
            });
        
        if let Some(injection_point) = position {
            let before = &code[..injection_point];
            let after = &code[injection_point..];
            *code = format!("{}\n  {}{}", before, transformation.static_block_code, after);
        }
    }
}

// Implement the WIT interface
struct Component;

impl Guest for Component {
    fn transform(
        filename: String,
        source_text: String,
        options: String,
    ) -> Result<TransformResult, String> {
        transform(filename, source_text, options)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic_parsing() {
        let code = "const x = 1;";
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_class_decorator_detected() {
        let code = r#"
            function dec(target) { return target; }
            @dec
            class C {}
        "#;
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        assert!(result.is_ok());
        if let Ok(res) = result {
            assert!(res.code.contains("class C"));
            // Decorators should be removed (no errors)
            assert_eq!(res.errors.len(), 0);
            // The decorator syntax should be removed from output
            assert!(!res.code.contains("@dec"));
        }
    }
    
    #[test]
    fn test_decorator_removal() {
        let code = r#"
            @classDecorator
            class MyClass {
                @methodDecorator
                method() {}
                
                @fieldDecorator
                field = 1;
            }
        "#;
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        assert!(result.is_ok());
        if let Ok(res) = result {
            // All decorators should be stripped
            assert!(!res.code.contains("@classDecorator"));
            assert!(!res.code.contains("@methodDecorator"));
            assert!(!res.code.contains("@fieldDecorator"));
            // But the class structure should remain
            assert!(res.code.contains("class MyClass"));
            assert!(res.code.contains("method()"));
            assert!(res.code.contains("field = 1"));
            assert_eq!(res.errors.len(), 0);
        }
    }
    
    #[test]
    fn test_complex_decorator_scenario() {
        let code = r#"
            function logged(value, context) {
                console.log(`Decorating ${context.name}`);
                return value;
            }
            
            function bound(value, context) {
                return value;
            }
            
            @logged
            class Controller {
                @logged
                static staticMethod() {
                    return 'static';
                }
                
                @bound
                @logged
                instanceMethod() {
                    return 'instance';
                }
                
                @logged
                get value() {
                    return this._value;
                }
                
                @logged
                set value(v) {
                    this._value = v;
                }
                
                @logged
                accessor data = 42;
                
                @logged
                #privateMethod() {
                    return 'private';
                }
            }
        "#;
        
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        assert!(result.is_ok());
        if let Ok(res) = result {
            // All decorators should be removed
            assert!(!res.code.contains("@logged"));
            assert!(!res.code.contains("@bound"));
            
            // Class structure should be preserved
            assert!(res.code.contains("class Controller"));
            assert!(res.code.contains("static staticMethod()"));
            assert!(res.code.contains("instanceMethod()"));
            assert!(res.code.contains("get value()"));
            assert!(res.code.contains("set value("));
            assert!(res.code.contains("accessor data"));
            assert!(res.code.contains("#privateMethod()"));
            
            // Helper functions should remain
            assert!(res.code.contains("function logged"));
            assert!(res.code.contains("function bound"));
            
            // No errors
            assert_eq!(res.errors.len(), 0);
        }
    }

    #[test]
    fn test_helper_injection_on_decorator_presence() {
        let code = r#"
            function logged(value, { kind, name }) {
                if (kind === "method") {
                    return function (...args) {
                        console.log(`calling ${name}`);
                        return value.call(this, ...args);
                    };
                }
            }

            class C {
                @logged
                m(arg) {
                    return arg * 2;
                }
            }
        "#;
        
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        assert!(result.is_ok());
        if let Ok(res) = result {
            // Helper functions should be injected
            assert!(res.code.contains("function _applyDecs"));
            assert!(res.code.contains("function _toPropertyKey"));
            assert!(res.code.contains("function _toPrimitive"));
            assert!(res.code.contains("function _setFunctionName"));
            assert!(res.code.contains("function _checkInRHS"));
            
            // Static block should be injected
            assert!(res.code.contains("static {"));
            assert!(res.code.contains("_applyDecs(this"));
            assert!(res.code.contains("[_initProto, _initClass]"));
            
            // Original code should still be present (without @decorator syntax)
            assert!(res.code.contains("class C"));
            assert!(res.code.contains("function logged"));
            assert!(!res.code.contains("@logged")); // Decorator syntax removed
            
            // No errors
            assert_eq!(res.errors.len(), 0);
        }
    }

    #[test]
    fn test_no_helper_injection_without_decorators() {
        let code = r#"
            class C {
                m(arg) {
                    return arg * 2;
                }
            }
        "#;
        
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        assert!(result.is_ok());
        if let Ok(res) = result {
            // Helper functions should NOT be injected when no decorators
            assert!(!res.code.contains("function _applyDecs"));
            assert!(!res.code.contains("function _toPropertyKey"));
            
            // Original code should be present
            assert!(res.code.contains("class C"));
            
            // No errors
            assert_eq!(res.errors.len(), 0);
        }
    }

    #[test]
    fn test_method_decorator_detected() {
        let code = "class C { @dec method() {} }";
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        assert!(result.is_ok());
    }

    #[test]
    fn test_options_parsing() {
        let code = "const x = 1;";
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            r#"{"source_maps": false}"#.to_string(),
        );
        assert!(result.is_ok());
        if let Ok(res) = result {
            assert!(res.map.is_none());
        }
    }
}

#[cfg(test)]
mod debug_tests {
    use super::*;
    
    #[test]
    #[ignore] // Only run explicitly
    fn test_print_transformed_output() {
        let code = r#"
function logged(value, { kind, name }) {
    if (kind === "method") {
        return function (...args) {
            console.log(`calling ${name}`);
            return value.call(this, ...args);
        };
    }
}

class C {
    @logged
    m(arg) {
        return arg * 2;
    }
}
"#;
        
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        assert!(result.is_ok());
        if let Ok(res) = result {
            println!("\n=== TRANSFORMED CODE ===\n{}\n=== END ===\n", res.code);
        }
    }

    #[test]
    fn test_field_decorator_transformation() {
        let code = r#"
function validated(value, { kind, name }) {
    if (kind === "field") {
        return function(initialValue) {
            return initialValue;
        };
    }
}

class C {
    @validated
    field = 1;
}
"#;
        
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        assert!(result.is_ok());
        if let Ok(res) = result {
            // Static block should be injected with field decorator (kind=0)
            assert!(res.code.contains("static {"));
            assert!(res.code.contains("_applyDecs(this"));
            assert!(res.code.contains("validated"));
            assert!(res.code.contains("\"field\""));
            
            // Decorator syntax removed
            assert!(!res.code.contains("@validated"));
            
            assert_eq!(res.errors.len(), 0);
        }
    }

    #[test]
    fn test_accessor_decorator_transformation() {
        let code = r#"
function tracked(value, { kind }) {
    if (kind === "accessor") {
        return value;
    }
}

class C {
    @tracked
    accessor data = 42;
}
"#;
        
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        assert!(result.is_ok());
        if let Ok(res) = result {
            // Static block should be injected with accessor decorator (kind=1)
            assert!(res.code.contains("static {"));
            assert!(res.code.contains("tracked"));
            assert!(res.code.contains("\"data\""));
            assert!(!res.code.contains("@tracked"));
            assert_eq!(res.errors.len(), 0);
        }
    }

    #[test]
    fn test_getter_setter_decorator_transformation() {
        let code = r#"
function logged(value, { kind }) {
    return value;
}

class C {
    @logged
    get value() {
        return this._value;
    }
    
    @logged
    set value(v) {
        this._value = v;
    }
}
"#;
        
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        assert!(result.is_ok());
        if let Ok(res) = result {
            // Static block should contain both getter (kind=3) and setter (kind=4)
            assert!(res.code.contains("static {"));
            assert!(res.code.contains("logged"));
            assert!(res.code.contains("\"value\""));
            assert!(!res.code.contains("@logged"));
            assert_eq!(res.errors.len(), 0);
        }
    }

    #[test]
    fn test_class_decorator_transformation() {
        let code = r#"
function metadata(data) {
    return function(value, { kind }) {
        if (kind === "class") {
            return value;
        }
    };
}

@metadata({ version: "1.0" })
class MyClass {
    method() {}
}
"#;
        
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        assert!(result.is_ok());
        if let Ok(res) = result {
            // Static block should reference class decorator
            assert!(res.code.contains("static {"));
            assert!(res.code.contains("metadata"));
            assert!(!res.code.contains("@metadata"));
            assert_eq!(res.errors.len(), 0);
        }
    }

    #[test]
    fn test_multiple_decorators_on_same_member() {
        let code = r#"
function first(value) { return value; }
function second(value) { return value; }

class C {
    @first
    @second
    method() {}
}
"#;
        
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        assert!(result.is_ok());
        if let Ok(res) = result {
            // Static block should contain both decorators
            assert!(res.code.contains("first"));
            assert!(res.code.contains("second"));
            assert!(res.code.contains("static {"));
            assert!(!res.code.contains("@first"));
            assert!(!res.code.contains("@second"));
            assert_eq!(res.errors.len(), 0);
        }
    }

    #[test]
    fn test_static_member_decorators() {
        let code = r#"
function logged(value) { return value; }

class C {
    @logged
    static staticMethod() {
        return 42;
    }
    
    @logged
    static staticField = 100;
}
"#;
        
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        assert!(result.is_ok());
        if let Ok(res) = result {
            // Static block should handle static members
            assert!(res.code.contains("static {"));
            assert!(res.code.contains("logged"));
            assert!(!res.code.contains("@logged"));
            assert_eq!(res.errors.len(), 0);
        }
    }

    #[test]
    fn test_private_member_decorators() {
        let code = r#"
function traced(value) { return value; }

class C {
    @traced
    #privateMethod() {
        return "private";
    }
    
    @traced
    #privateField = 42;
}
"#;
        
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        assert!(result.is_ok());
        if let Ok(res) = result {
            // Static block should handle private members
            assert!(res.code.contains("static {"));
            assert!(res.code.contains("traced"));
            // Private names should be in descriptors
            assert!(res.code.contains("privateMethod") || res.code.contains("privateField"));
            assert!(!res.code.contains("@traced"));
            assert_eq!(res.errors.len(), 0);
        }
    }
}
