pub fn generate_helper_functions() -> &'static str {
    include_str!("helpers.js")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_helper_functions_generation() {
        let helpers = generate_helper_functions();
        assert!(helpers.contains("function _applyDecs"));
        assert!(helpers.contains("function _toPropertyKey"));
        assert!(helpers.contains("function _toPrimitive"));
        assert!(helpers.contains("function _setFunctionName"));
        assert!(helpers.contains("function _checkInRHS"));
    }

    #[test]
    fn test_helpers_are_readable() {
        let helpers = generate_helper_functions();

        assert!(
            helpers.contains("targetClass"),
            "Should have readable variable names"
        );
        assert!(
            helpers.contains("memberDecorators"),
            "Should have readable variable names"
        );
        assert!(
            helpers.contains("TC39 Stage 3"),
            "Should have documentation comments"
        );
        assert!(
            !helpers.contains("function _applyDecs(e,t,n,r,o,i)"),
            "Should not be minified"
        );

        let line_count = helpers.lines().count();
        assert!(
            line_count > 100,
            "Should be formatted across multiple lines, got {} lines",
            line_count
        );
    }
}
