/**
 * TC39 Stage 3 Decorator Runtime Helpers
 * 
 * These helper functions implement the runtime behavior for JavaScript decorators
 * according to the TC39 Stage 3 proposal specification.
 * 
 * @see https://github.com/tc39/proposal-decorators
 */

/**
 * Apply decorators to a class and its members.
 * 
 * This is the main entry point for decorator application. It processes all decorators
 * on class members and the class itself, returning initialization functions.
 * 
 * @param {Function} targetClass - The class being decorated
 * @param {Array} memberDecorators - Array of member decorator descriptors
 * @param {Array} classDecorators - Array of class-level decorators
 * @param {string} className - Name of the class (for error messages)
 * @param {Function} parentClass - Parent class for inheritance
 * @param {Object} metadata - Metadata object for Symbol.metadata
 * @returns {Object} Object with initialization functions
 */
function _applyDecs(
  targetClass,
  memberDecorators,
  classDecorators,
  className,
  parentClass,
  metadata
) {
  const metadataSymbol = Symbol.metadata || Symbol.for("Symbol.metadata");
  const defineProperty = Object.defineProperty;
  const objectCreate = Object.create;
  
  // Storage for checking duplicate decorator applications
  const decoratorRegistry = [objectCreate(null), objectCreate(null)];
  
  let protoInitializers;
  let staticInitializers;
  let existingMetadata;
  let appliedDecorators;
  let instancePrivateAccessors;
  let staticPrivateAccessors;
  let metadataValue;
  
  /**
   * Create a wrapper function that applies a list of initializers.
   * 
   * @param {Array} initializers - Array of initializer functions
   * @param {boolean} isStatic - Whether these are static initializers
   * @param {boolean} returnsValue - Whether to return the value or the object
   */
  function createInitializerWrapper(initializers, isStatic, returnsValue) {
    return function (target, value) {
      if (isStatic) {
        value = target;
        target = targetClass;
      }
      
      for (let i = 0; i < initializers.length; i++) {
        value = initializers[i].apply(target, returnsValue ? [value] : []);
      }
      
      return returnsValue ? value : target;
    };
  }
  
  /**
   * Validate that a value is a function (or undefined if optional).
   * 
   * @param {*} value - Value to check
   * @param {string} description - Description for error message
   * @param {string} verb - Verb for error message (default: "be")
   * @param {boolean} isOptional - Whether undefined is allowed
   */
  function assertCallable(value, description, verb, isOptional) {
    if (typeof value !== "function" && (isOptional || value !== undefined)) {
      throw new TypeError(
        description + " must " + (verb || "be") + " a function" +
        (isOptional ? "" : " or undefined")
      );
    }
    return value;
  }
  
  /**
   * Apply a single decorator to a class member.
   * 
   * @param {Object} target - The target object (class or prototype)
   * @param {Array} decoratorDescriptor - Descriptor array for this decorator
   * @param {boolean} hasPairedDecorator - Whether there's a paired decorator (getter/setter)
   * @param {string} memberName - Name of the member being decorated
   * @param {number} memberKind - Kind of member (field, accessor, method, etc.)
   * @param {Array} initializers - Array to collect initializers
   * @param {Array} allInitializers - All initializers for this decoration pass
   * @param {boolean} isStatic - Whether this is a static member
   * @param {boolean} isPrivate - Whether this is a private member
   * @param {boolean} hasPrivateGetter - Whether there's a private getter
   * @param {Function} privateAccessValidator - Validator for private access
   */
  function applyDecorator(
    target,
    decoratorDescriptor,
    hasPairedDecorator,
    memberName,
    memberKind,
    initializers,
    allInitializers,
    isStatic,
    isPrivate,
    hasPrivateGetter,
    privateAccessValidator
  ) {
    /**
     * Validate private member access.
     */
    function assertValidPrivateAccess(obj) {
      if (!privateAccessValidator(obj)) {
        throw new TypeError("Attempted to access private element on non-instance");
      }
    }
    
    const decorators = [].concat(decoratorDescriptor[0]);
    const getter = decoratorDescriptor[3];
    const isClassDecorator = !allInitializers;
    const isAccessor = memberKind === 1;
    const isGetter = memberKind === 3;
    const isSetter = memberKind === 4;
    const isMethod = memberKind === 2;
    
    /**
     * Create a bound accessor function.
     */
    function createBoundAccessor(accessorType, isStatic, validator) {
      return function (target, value) {
        if (isStatic) {
          value = target;
          target = targetClass;
        }
        if (validator) {
          validator(target);
        }
        return descriptor[accessorType].call(target, value);
      };
    }
    
    let descriptor;
    let accessorInitializers;
    let descriptorKey;
    
    if (!isClassDecorator) {
      descriptor = {};
      accessorInitializers = [];
      
      descriptorKey = isGetter ? "get" : (isSetter || isAccessor ? "set" : "value");
      
      if (isPrivate) {
        if (hasPrivateGetter || isAccessor) {
          descriptor = {
            get: _setFunctionName(function () {
              return getter(this);
            }, memberName, "get"),
            set: function (value) {
              decoratorDescriptor[4](this, value);
            }
          };
        } else {
          descriptor[descriptorKey] = getter;
        }
        
        if (!hasPrivateGetter) {
          _setFunctionName(descriptor[descriptorKey], memberName, isMethod ? "" : descriptorKey);
        }
      } else if (!hasPrivateGetter) {
        descriptor = Object.getOwnPropertyDescriptor(target, memberName) || {};
      }
      
      // Check for duplicate decorators
      if (!hasPrivateGetter && !isPrivate) {
        const registryKey = decoratorRegistry[+isStatic][memberName];
        if (registryKey && (registryKey ^ memberKind) !== 7) {
          throw Error(
            "Decorating two elements with the same name (" +
            descriptor[descriptorKey].name +
            ") is not supported yet"
          );
        }
        decoratorRegistry[+isStatic][memberName] = memberKind < 3 ? 1 : memberKind;
      }
    }
    
    let decoratedValue = target;
    
    // Apply decorators in reverse order
    for (let i = decorators.length - 1; i >= 0; i -= hasPairedDecorator ? 2 : 1) {
      const decorator = assertCallable(decorators[i], "A decorator", "be", true);
      const pairedDecorator = hasPairedDecorator ? decorators[i - 1] : undefined;
      const addInitializerCalled = {};
      
      const context = {
        kind: ["field", "accessor", "method", "getter", "setter", "class"][memberKind],
        name: memberName,
        metadata: metadataValue,
        addInitializer: function (state, fn) {
          if (state.v) {
            throw new TypeError(
              "attempted to call addInitializer after decoration was finished"
            );
          }
          assertCallable(fn, "An initializer", "be", true);
          initializers.push(fn);
        }.bind(null, addInitializerCalled)
      };
      
      if (isClassDecorator) {
        // Class decorator
        appliedDecorators = decorator.call(pairedDecorator, decoratedValue, context);
        addInitializerCalled.v = 1;
        
        if (assertCallable(appliedDecorators, "class decorators", "return")) {
          decoratedValue = appliedDecorators;
        }
      } else {
        // Member decorator
        context.static = isStatic;
        context.private = isPrivate;
        
        const access = context.access = {
          has: isPrivate 
            ? privateAccessValidator.bind() 
            : function (obj) { return memberName in obj; }
        };
        
        // Add getter if not a setter
        if (!isSetter) {
          access.get = isPrivate
            ? (isMethod
                ? function (obj) {
                    assertValidPrivateAccess(obj);
                    return descriptor.value;
                  }
                : createBoundAccessor("get", 0, assertValidPrivateAccess))
            : function (obj) { return obj[memberName]; };
        }
        
        // Add setter if not a method or getter
        if (isMethod || isGetter) {
          // No setter for methods or getters
        } else {
          access.set = isPrivate
            ? createBoundAccessor("set", 0, assertValidPrivateAccess)
            : function (obj, value) { obj[memberName] = value; };
        }
        
        decoratedValue = decorator.call(
          pairedDecorator,
          isAccessor ? { get: descriptor.get, set: descriptor.set } : descriptor[descriptorKey],
          context
        );
        
        addInitializerCalled.v = 1;
        
        if (isAccessor) {
          // Handle accessor decorator return value
          if (typeof decoratedValue === "object" && decoratedValue) {
            const newGetter = assertCallable(decoratedValue.get, "accessor.get");
            if (newGetter) descriptor.get = newGetter;
            
            const newSetter = assertCallable(decoratedValue.set, "accessor.set");
            if (newSetter) descriptor.set = newSetter;
            
            const init = assertCallable(decoratedValue.init, "accessor.init");
            if (init) accessorInitializers.unshift(init);
          } else if (decoratedValue !== undefined) {
            throw new TypeError(
              "accessor decorators must return an object with get, set, or init properties or undefined"
            );
          }
        } else {
          const decoratorReturnCheck = assertCallable(
            decoratedValue,
            (hasPrivateGetter ? "field" : "method") + " decorators",
            "return"
          );
          
          if (decoratorReturnCheck) {
            if (hasPrivateGetter) {
              accessorInitializers.unshift(decoratedValue);
            } else {
              descriptor[descriptorKey] = decoratedValue;
            }
          }
        }
      }
    }
    
    // Add initializers to the appropriate arrays
    if (memberKind < 2 && allInitializers) {
      allInitializers.push(
        createInitializerWrapper(accessorInitializers, isStatic, 1),
        createInitializerWrapper(initializers, isStatic, 0)
      );
    }
    
    // Set up the descriptor or private accessors
    if (!hasPrivateGetter && !isClassDecorator) {
      if (isPrivate) {
        if (isAccessor) {
          allInitializers.splice(
            -1,
            0,
            createBoundAccessor("get", isStatic),
            createBoundAccessor("set", isStatic)
          );
        } else {
          allInitializers.push(
            isMethod 
              ? descriptor[descriptorKey] 
              : assertCallable.call.bind(descriptor[descriptorKey])
          );
        }
      } else {
        defineProperty(target, memberName, descriptor);
      }
    }
    
    return decoratedValue;
  }
  
  /**
   * Add metadata to a constructor.
   */
  function addMetadata(constructor) {
    return defineProperty(constructor, metadataSymbol, {
      configurable: true,
      enumerable: true,
      value: metadataValue
    });
  }
  
  // Initialize metadata
  if (metadata !== undefined) {
    metadataValue = metadata[metadataSymbol];
  }
  metadataValue = objectCreate(metadataValue == null ? null : metadataValue);
  
  appliedDecorators = [];
  
  const addClassInitializer = function (initializer, isStatic) {
    if (initializer) {
      appliedDecorators.push(createInitializerWrapper(initializer, isStatic, 0));
    }
  };
  
  /**
   * Process decorators for a specific pass (static/instance, public/private).
   */
  function processDecorators(isStatic, isPrivate) {
    for (let i = 0; i < memberDecorators.length; i++) {
      const decoratorInfo = memberDecorators[i];
      const flags = decoratorInfo[1];
      const kind = flags & 7; // Extract kind bits
      const memberName = decoratorInfo[2];
      const isPrivateMember = !!decoratorInfo[3];
      const hasPairedDecorator = flags & 16;
      
      // Check if this decorator matches the current pass
      if ((flags & 8) == isStatic && isPrivateMember === !!isPrivate) {
        
        applyDecorator(
          isStatic ? targetClass : targetClass.prototype,
          decoratorInfo,
          hasPairedDecorator,
          isPrivateMember ? "#" + memberName : _toPropertyKey(memberName),
          kind,
          isStatic ? (staticInitializers = staticInitializers || []) : (protoInitializers = protoInitializers || []),
          appliedDecorators,
          !!isStatic,
          isPrivateMember,
          isPrivate,
          isStatic && isPrivateMember
            ? function (obj) { return _checkInRHS(obj) === targetClass; }
            : parentClass
        );
      }
    }
  }
  
  // Process decorators in four passes:
  // 1. Static public members
  processDecorators(8, 0);
  // 2. Instance public members
  processDecorators(0, 0);
  // 3. Static private members
  processDecorators(8, 1);
  // 4. Instance private members
  processDecorators(0, 1);
  
  // Add proto and static initializers
  // Pass isStatic flag to ensure 'this' is correctly bound in initializers:
  // - For instance methods (isStatic=0): this = instance, use this.constructor.name
  // - For static methods (isStatic=8): this = class, use this.name
  addClassInitializer(protoInitializers, 0);
  addClassInitializer(staticInitializers, 8);
  
  existingMetadata = appliedDecorators;
  
  // Add metadata if no class decorators
  if (!classDecorators) {
    addMetadata(targetClass);
  }
  
  return {
    e: existingMetadata,
    get c() {
      const classInitializers = [];
      if (classDecorators) {
        return [
          addMetadata(
            targetClass = applyDecorator(
              targetClass,
              [classDecorators],
              className,
              targetClass.name,
              5,
              classInitializers
            )
          ),
          createInitializerWrapper(classInitializers, 1)
        ];
      }
    }
  };
}

/**
 * Convert a value to a property key (string or symbol).
 * 
 * @param {*} value - Value to convert
 * @returns {string|symbol} Property key
 */
function _toPropertyKey(value) {
  const primitive = _toPrimitive(value, "string");
  return typeof primitive == "symbol" ? primitive : String(primitive);
}

/**
 * Convert a value to a primitive.
 * 
 * @param {*} value - Value to convert
 * @param {string} hint - Type hint ("string", "number", or "default")
 * @returns {*} Primitive value
 */
function _toPrimitive(value, hint) {
  if (typeof value != "object" || !value) {
    return value;
  }
  
  const toPrimitive = value[Symbol.toPrimitive];
  if (toPrimitive !== undefined) {
    const result = toPrimitive.call(value, hint || "default");
    if (typeof result != "object") {
      return result;
    }
    throw new TypeError("@@toPrimitive must return a primitive value.");
  }
  
  return (hint === "string" ? String : Number)(value);
}

/**
 * Set a function's name property.
 * 
 * @param {Function} fn - Function to name
 * @param {string|symbol} name - Name to set
 * @param {string} prefix - Optional prefix (e.g., "get" or "set")
 * @returns {Function} The function with its name set
 */
function _setFunctionName(fn, name, prefix) {
  if (typeof name == "symbol") {
    name = name.description ? "[" + name.description + "]" : "";
  }
  
  try {
    Object.defineProperty(fn, "name", {
      configurable: true,
      value: prefix ? prefix + " " + name : name
    });
  } catch (e) {
    // Ignore errors (some environments don't allow name changes)
  }
  
  return fn;
}

/**
 * Check that the right-hand side of 'in' is an object.
 * 
 * @param {*} value - Value to check
 * @returns {Object} The value if it's an object
 * @throws {TypeError} If value is not an object
 */
function _checkInRHS(value) {
  if (Object(value) !== value) {
    throw new TypeError(
      "right-hand side of 'in' should be an object, got " +
      (value !== null ? typeof value : "null")
    );
  }
  return value;
}
