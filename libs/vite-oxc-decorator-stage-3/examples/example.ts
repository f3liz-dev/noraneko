// Example decorator implementations following TC39 Stage 3 proposal

// Method decorator that logs method calls
function logged(value, { kind, name }) {
  if (kind === 'method') {
    return function (...args) {
      console.log(`starting ${name} with arguments ${args.join(', ')}`);
      const ret = value.call(this, ...args);
      console.log(`ending ${name}`);
      return ret;
    };
  }
}

// Field decorator that logs initialization
function loggedField(value, { kind, name }) {
  if (kind === 'field') {
    return function (initialValue) {
      console.log(`initializing ${name} with value ${initialValue}`);
      return initialValue;
    };
  }
}

// Auto-accessor decorator
function reactive(value, { kind, name }) {
  if (kind === 'accessor') {
    let { get, set } = value;
    return {
      get() {
        console.log(`getting ${name}`);
        return get.call(this);
      },
      set(val) {
        console.log(`setting ${name} to ${val}`);
        return set.call(this, val);
      },
      init(initialValue) {
        console.log(`initializing ${name} with value ${initialValue}`);
        return initialValue;
      },
    };
  }
}

// Class decorator
function customElement(name) {
  return (value, { addInitializer }) => {
    addInitializer(function () {
      console.log(`Registering custom element: ${name}`);
      // In a real app: customElements.define(name, this);
    });
  };
}

// Bound method decorator using addInitializer
function bound(value, { name, addInitializer }) {
  addInitializer(function () {
    this[name] = this[name].bind(this);
  });
}

// Example usage
@customElement('my-component')
class MyComponent {
  @loggedField message = 'Hello';
  @reactive accessor count = 0;

  @logged
  greet(name) {
    return `${this.message}, ${name}!`;
  }

  @bound
  handleClick() {
    console.log(this.count);
  }
}

// Usage
const component = new MyComponent();
console.log(component.greet('World'));
component.count = 5;
console.log(component.count);

const handler = component.handleClick;
handler(); // Still bound to component instance
