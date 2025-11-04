use serde::{Deserialize, Serialize};
use oxc_allocator::Allocator;
use oxc_ast::{NONE, ast::{Program, Statement, Declaration, VariableDeclarationKind, ClassElement}};
use oxc_ast::AstBuilder;
use oxc_codegen::Codegen;
use oxc_parser::Parser;
use oxc_span::{SourceType, SPAN};
use oxc_traverse::traverse_mut;
use oxc_semantic::SemanticBuilder;

mod transformer;
mod codegen;
use transformer::{DecoratorTransformer, TransformerState, ClassDecoratorInfo};
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
    
    inject_variable_declarations_ast(&mut parse_result.program, &allocator);
    
    let mut codegen_result = Codegen::new().build(&parse_result.program);
    
    let class_decorator_info = transformer.get_classes_with_class_decorators();
    if !class_decorator_info.is_empty() {
        codegen_result.code = apply_class_decorator_replacements_string(&codegen_result.code, &class_decorator_info);
    }
    
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

fn inject_variable_declarations_ast<'a>(program: &mut Program<'a>, allocator: &'a Allocator) {
    let ast = AstBuilder::new(allocator);
    let mut insertions: Vec<(usize, Statement<'a>)> = Vec::new();
    
    for (i, stmt) in program.body.iter().enumerate() {
        let has_static_block = match stmt {
            Statement::ClassDeclaration(class) => class_has_static_block(class),
            Statement::ExportDefaultDeclaration(export) => {
                matches!(&export.declaration, oxc_ast::ast::ExportDefaultDeclarationKind::ClassDeclaration(class) if class_has_static_block(class))
            }
            Statement::ExportNamedDeclaration(export) => {
                matches!(&export.declaration, Some(Declaration::ClassDeclaration(class)) if class_has_static_block(class))
            }
            _ => false,
        };
        
        if has_static_block {
            let var_decl = create_init_variables_declaration(&ast);
            insertions.push((i, var_decl));
        }
    }
    
    for (index, decl) in insertions.into_iter().rev() {
        program.body.insert(index, decl);
    }
}

fn class_has_static_block(class: &oxc_ast::ast::Class) -> bool {
    class.body.body.iter().any(|element| {
        matches!(element, ClassElement::StaticBlock(_))
    })
}

fn create_init_variables_declaration<'a>(ast: &AstBuilder<'a>) -> Statement<'a> {
    let init_proto_binding = ast.binding_pattern(
        ast.binding_pattern_kind_binding_identifier(SPAN, "_initProto"),
        NONE,
        false,
    );
    
    let init_proto_declarator = ast.variable_declarator(
        SPAN,
        VariableDeclarationKind::Let,
        init_proto_binding,
        None,
        false,
    );
    
    let init_class_binding = ast.binding_pattern(
        ast.binding_pattern_kind_binding_identifier(SPAN, "_initClass"),
        NONE,
        false,
    );
    
    let init_class_declarator = ast.variable_declarator(
        SPAN,
        VariableDeclarationKind::Let,
        init_class_binding,
        None,
        false,
    );
    
    let mut declarators = ast.vec();
    declarators.push(init_proto_declarator);
    declarators.push(init_class_declarator);
    
    let declaration = ast.declaration_variable(
        SPAN,
        VariableDeclarationKind::Let,
        declarators,
        false,
    );
    
    Statement::from(declaration)
}

fn parse_options(options: &str) -> Result<TransformOptions, String> {
    if options.is_empty() {
        Ok(TransformOptions { source_maps: true })
    } else {
        serde_json::from_str(options).map_err(|e| format!("Invalid options: {}", e))
    }
}

fn generate_result<'a>(program: &Program<'a>, opts: &TransformOptions, errors: Vec<String>) -> Result<TransformResult, String> {
    let codegen_result = Codegen::new().build(program);
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

fn apply_class_decorator_replacements_string(code: &str, class_info: &[ClassDecoratorInfo]) -> String {
    let mut result = code.to_string();
    
    for info in class_info {
        let class_name = &info.class_name;
        let decorators = info.decorator_names.join(", ");
        
        let export_default_pattern = format!("export default class {}", class_name);
        if let Some(export_pos) = result.find(&export_default_pattern) {
            if let Some(class_end) = find_class_end(&result, export_pos) {
                let class_body_start = export_pos + export_default_pattern.len();
                let before = result[..export_pos].to_string();
                let class_body = result[class_body_start..class_end].to_string();
                let after = result[class_end..].to_string();
                
                result = format!("{}let {} = class {}{}{}", before, class_name, class_name, class_body, after);
                
                let new_class_end = before.len() + format!("let {} = class {}{}", class_name, class_name, class_body).len();
                
                let decorator_call = format!(";\n{} = _applyDecs({}, [], [{}]).c[0];\nexport default {};", 
                    class_name, class_name, decorators, class_name);
                result.insert_str(new_class_end, &decorator_call);
            }
            continue;
        }
        
        let export_pattern = format!("export class {}", class_name);
        if let Some(export_pos) = result.find(&export_pattern) {
            if let Some(class_end) = find_class_end(&result, export_pos) {
                let class_body_start = export_pos + export_pattern.len();
                let before = result[..export_pos].to_string();
                let class_body = result[class_body_start..class_end].to_string();
                let after = result[class_end..].to_string();
                
                result = format!("{}let {} = class {}{}{}", before, class_name, class_name, class_body, after);
                
                let new_class_end = before.len() + format!("let {} = class {}{}", class_name, class_name, class_body).len();
                
                let decorator_call = format!(";\n{} = _applyDecs({}, [], [{}]).c[0];\nexport {{ {} }};", 
                    class_name, class_name, decorators, class_name);
                result.insert_str(new_class_end, &decorator_call);
            }
            continue;
        }
        
        let class_pattern = format!("class {}", class_name);
        
        if let Some(class_pos) = result.find(&class_pattern) {
            if let Some(class_end) = find_class_end(&result, class_pos) {
                result.insert_str(class_pos, &format!("let {} = ", class_name));
                
                let insert_len = format!("let {} = ", class_name).len();
                let new_class_end = class_end + insert_len;
                
                let decorator_call = format!(";\n{} = _applyDecs({}, [], [{}]).c[0];", class_name, class_name, decorators);
                result.insert_str(new_class_end, &decorator_call);
            }
        }
    }
    
    result
}

fn find_class_end(code: &str, start_pos: usize) -> Option<usize> {
    let class_code = &code[start_pos..];
    let mut brace_count = 0;
    let mut in_class = false;
    
    for (i, ch) in class_code.char_indices() {
        if ch == '{' {
            in_class = true;
            brace_count += 1;
        } else if ch == '}' {
            brace_count -= 1;
            if in_class && brace_count == 0 {
                return Some(start_pos + i + 1);
            }
        }
    }
    
    None
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

    #[test]
    fn test_export_default_class_decorator() {
        let code = r#"
@noraComponent
export default class BrowserShareMode {
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
            // The decorator should be removed from class declaration
            assert!(!res.code.contains("@noraComponent"));
            // Export default should remain valid
            assert!(res.code.contains("export default"));
            // Should not have invalid syntax like "export default @decorator"
            assert!(!res.code.contains("export default @"));
            // Should have helper functions
            assert!(res.code.contains("function _applyDecs"));
            // Should have static block with decorator call
            assert!(res.code.contains("static {"));
            assert!(res.code.contains("noraComponent"));
            assert_eq!(res.errors.len(), 0);
        }
    }

    #[test]
    fn test_export_default_class_decorator_with_call() {
        // Test the exact scenario from the issue
        let code = r###"
import { noraComponent, NoraComponentBase } from "#features-chrome/utils/base.ts";

@noraComponent(import.meta.hot)
export default class BrowserShareMode extends NoraComponentBase {
    init() {
        this.logger.info("Hello from Logger!");
    }

    _metadata() {
        return {
            moduleName: "browser-share-mode",
            dependencies: [],
            softDependencies: [],
        };
    }
}
"###;
        
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        assert!(result.is_ok());
        if let Ok(res) = result {
            // The decorator should be removed from class declaration
            assert!(!res.code.contains("@noraComponent"));
            // Export default should remain valid
            assert!(res.code.contains("export default"));
            assert!(res.code.contains("class BrowserShareMode"));
            // Should not have invalid syntax like "export default @decorator"
            assert!(!res.code.contains("export default @"));
            // Should have helper functions
            assert!(res.code.contains("function _applyDecs"));
            // Should have static block with decorator call
            assert!(res.code.contains("static {"));
            assert!(res.code.contains("noraComponent"));
            assert_eq!(res.errors.len(), 0);
        }
    }
}
#[cfg(test)]
mod test_decorator_call {
    use crate::transform;

    #[test]
    fn test_decorator_with_call() {
        let code = r#"
function noraComponent(hotCtx) {
    return function(target) {
        console.log("Decorated with hotCtx:", hotCtx);
        return target;
    };
}

@noraComponent(import.meta.hot)
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
            println!("\n=== TRANSFORMED CODE ===\n{}\n=== END ===\n", res.code);
            assert_eq!(res.errors.len(), 0);
        }
    }
}

#[cfg(test)]
mod test_problem_statement {
    use crate::transform;

    #[test]
    fn test_problem_statement_decorator() {
        let code = r###"
import { render } from "@nora/solid-xul";
import { ShareModeElement } from "./browser-share-mode.tsx";
import {
  noraComponent,
  NoraComponentBase,
} from "#features-chrome/utils/base.ts";

@noraComponent(import.meta.hot)
export default class BrowserShareMode extends NoraComponentBase {
  init() {
    this.logger.info("Hello from Logger!");
    render(ShareModeElement, document.querySelector("#menu_ToolsPopup"), {
      marker: document.querySelector("#menu_openFirefoxView")!,
      hotCtx: import.meta.hot,
    });
  }

  _metadata() {
    return {
      moduleName: "browser-share-mode",
      dependencies: [],
      softDependencies: [],
    };
  }
}
"###;
        
        let result = transform(
            "test.ts".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        assert!(result.is_ok());
        if let Ok(res) = result {
            println!("\n=== TRANSFORMED CODE ===\n{}\n=== END ===\n", res.code);
            // Verify decorator call expression is preserved
            assert!(res.code.contains("noraComponent(import.meta.hot)"), 
                "Expected noraComponent(import.meta.hot) in output");
            assert!(!res.code.contains("@noraComponent"), 
                "Decorator syntax should be removed");
            assert_eq!(res.errors.len(), 0, "Should have no errors");
        }
    }
}

#[cfg(test)]
mod comprehensive_decorator_tests {
    use crate::transform;

    #[test]
    fn test_various_decorator_call_patterns() {
        let code = r#"
// Test 1: Simple identifier decorator
@simple
class Class1 {}

// Test 2: Call expression with single argument
@decorator(arg)
class Class2 {}

// Test 3: Call expression with multiple arguments
@decorator(arg1, arg2, arg3)
class Class3 {}

// Test 4: Call expression with complex expression
@decorator(import.meta.hot)
class Class4 {}

// Test 5: Chained member expression
@namespace.decorator
class Class5 {}

// Test 6: Chained member expression with call
@namespace.decorator(arg)
class Class6 {}

// Test 7: Method with call decorator
class Class7 {
    @bound(this)
    method() {}
}

// Test 8: Field with call decorator
class Class8 {
    @validate("string")
    field = "";
}
"#;
        
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        assert!(result.is_ok());
        if let Ok(res) = result {
            // Verify all decorator patterns are preserved
            assert!(res.code.contains("simple"), "Simple decorator should be preserved");
            assert!(res.code.contains("decorator(arg)"), "Single argument call should be preserved");
            assert!(res.code.contains("decorator(arg1, arg2, arg3)"), "Multiple arguments call should be preserved");
            assert!(res.code.contains("decorator(import.meta.hot)"), "Complex expression call should be preserved");
            assert!(res.code.contains("namespace.decorator"), "Member expression should be preserved");
            assert!(res.code.contains("namespace.decorator(arg)"), "Member expression call should be preserved");
            assert!(res.code.contains("bound(this)"), "Method decorator call should be preserved");
            assert!(res.code.contains("validate(\"string\")"), "Field decorator call should be preserved");
            
            // Verify decorator syntax is removed
            assert!(!res.code.contains("@simple"), "@ syntax should be removed");
            assert!(!res.code.contains("@decorator"), "@ syntax should be removed");
            assert!(!res.code.contains("@namespace"), "@ syntax should be removed");
            assert!(!res.code.contains("@bound"), "@ syntax should be removed");
            assert!(!res.code.contains("@validate"), "@ syntax should be removed");
            
            assert_eq!(res.errors.len(), 0, "Should have no errors");
        }
    }
}

#[cfg(test)]
mod test_constructor_injection {
    use crate::transform;

    #[test]
    #[ignore]
    fn test_field_decorator_with_constructor() {
        let code = r#"
function validated(value, { kind }) {
    if (kind === "field") {
        return function(initialValue) {
            console.log("Field initialized");
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
            println!("\n=== FIELD DECORATOR OUTPUT ===\n{}\n=== END ===\n", res.code);
            assert!(res.code.contains("constructor()"));
            assert!(res.code.contains("_initProto(this)"));
        }
    }

    #[test]
    #[ignore]
    fn test_field_decorator_with_existing_constructor() {
        let code = r#"
function validated(value, { kind }) {
    if (kind === "field") {
        return function(initialValue) {
            return initialValue;
        };
    }
}

class C {
    @validated
    field = 1;
    
    constructor() {
        console.log("Constructor");
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
            println!("\n=== FIELD WITH EXISTING CTOR ===\n{}\n=== END ===\n", res.code);
            assert!(res.code.contains("_initProto(this)"));
        }
    }
}

#[cfg(test)]
mod test_super_handling {
    use crate::transform;

    #[test]
    #[ignore]
    fn test_field_decorator_with_super() {
        let code = r#"
function validated(value, { kind }) {
    if (kind === "field") {
        return function(initialValue) {
            return initialValue;
        };
    }
}

class Base {
    constructor(x) {
        this.x = x;
    }
}

class C extends Base {
    @validated
    field = 1;
    
    constructor() {
        super(42);
        console.log("After super");
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
            println!("\n=== FIELD WITH SUPER ===\n{}\n=== END ===\n", res.code);
            assert!(res.code.contains("super(42)"));
            assert!(res.code.contains("_initProto(this)"));
            // _initProto should be after super() call
            let super_pos = res.code.find("super(42);").unwrap();
            let init_pos = res.code.find("_initProto(this)").unwrap();
            assert!(init_pos > super_pos, "_initProto should be after super()");
        }
    }
}

#[cfg(test)]
mod test_output_debug {
    use crate::transform;

    #[test]
    #[ignore]
    fn show_export_default_output() {
        let code = r#"
@logged
export default class MyClass {
    method() {}
}
"#;
        
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        if let Ok(res) = result {
            println!("\n=== GENERATED CODE ===");
            println!("{}", res.code);
            println!("=== END ===\n");
        }
    }
}

#[cfg(test)]
mod test_export_variations {
    use crate::transform;

    #[test]
    #[ignore]
    fn test_export_class_output() {
        let code = r#"
@logged
export class MyClass {
    method() {}
}
"#;
        
        let result = transform(
            "test.js".to_string(),
            code.to_string(),
            "{}".to_string(),
        );
        
        if let Ok(res) = result {
            println!("\n=== EXPORT CLASS OUTPUT ===");
            println!("{}", res.code);
            println!("=== END ===\n");
        }
    }
}

#[cfg(test)]
mod test_export_fix {
    use crate::transform;

    #[test]
    fn test_export_default_class_no_invalid_syntax() {
        let code = r#"
@logged
export default class MyClass {
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
            assert!(!res.code.contains("export default var"), 
                "Bug: Found 'export default var' which is invalid syntax");
            assert!(!res.code.contains("export default let"), 
                "Bug: Found 'export default let' which is invalid syntax");
            
            assert!(res.code.contains("let _initProto, _initClass;"), 
                "Should use 'let' for variable declaration");
            
            assert!(res.code.contains("export default MyClass"), 
                "Should have export default identifier (not class declaration)");
            
            let let_pos = res.code.find("let _initProto").expect("Should find let declaration");
            let export_pos = res.code.find("export default").expect("Should find export default");
            assert!(let_pos < export_pos, 
                "Variable declaration should come before export statement");
        }
    }

    #[test]
    fn test_export_named_class_no_invalid_syntax() {
        let code = r#"
@logged
export class MyClass {
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
            assert!(!res.code.contains("export var"), 
                "Bug: Found 'export var' which is invalid syntax");
            assert!(!res.code.contains("export let"), 
                "Bug: Found 'export let' - variable should come before export");
            
            assert!(res.code.contains("let _initProto, _initClass;"), 
                "Should use 'let' for variable declaration");
            
            assert!(res.code.contains("export { MyClass }"), 
                "Should have export {{ MyClass }} for named export");
            
            let let_pos = res.code.find("let _initProto").expect("Should find let declaration");
            let export_pos = res.code.find("export {").expect("Should find export");
            assert!(let_pos < export_pos, 
                "Variable declaration should come before export statement");
        }
    }

    #[test]
    fn test_regular_class_uses_let() {
        let code = r#"
@logged
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
            // Should use 'let' not 'var' for ESNext
            assert!(res.code.contains("let _initProto, _initClass;"), 
                "Should use 'let' for ESNext compatibility");
            assert!(!res.code.contains("var _initProto"), 
                "Should not use 'var' - use 'let' for ESNext");
        }
    }

    #[test]
    fn test_helpers_use_const_let_not_var() {
        let code = r#"
@logged
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
            // Helper functions should use const/let, not var
            // Check for the helper function _applyDecs
            assert!(res.code.contains("function _applyDecs"), 
                "Should have helper functions");
            
            // The helpers should prefer const/let over var
            // Count occurrences to verify modernization
            let const_count = res.code.matches(" const ").count();
            let let_count = res.code.matches(" let ").count();
            let var_count = res.code.matches(" var ").count();
            
            // We should have converted most/all vars to const/let
            assert!(const_count + let_count > 0, 
                "Should use const/let in helpers");
            assert_eq!(var_count, 0, 
                "Should not use 'var' - all should be converted to const/let for ESNext");
        }
    }
}
