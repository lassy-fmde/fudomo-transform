const { StackFrame } = require('./compute.js');
const { ObjectModel } = require('./model-io.js');
const getParameterNames = require("paramnames");

function escapeHtml(unsafe) {
    return unsafe.toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

class DecompositionFunctionRunner {
  // constructor(baseDir, config) {
  //   throw new Error('Not implemented');
  // }
  finalize() {
    throw new Error('Not implemented');
  }
  static addToArgumentParser(parser) {
  }
  async hasFunction(name) {
    throw new Error('Not implemented');
  }
  async validateFunctions(validationCriteria) {
    throw new Error('Not implemented');
  }
  async callFunction(name, args) {
    throw new Error('Not implemented');
  }
  exceptionToStackFrame(exception) {
    throw new Error('Not implemented');
  }
}

class ExternalDecompositionFunctionRunner extends DecompositionFunctionRunner {
  constructor(baseDir, config) {
    super();
    this.idByComparableObject = new WeakMap();
    this.objectModelById = {};
    this.lastId = 0;
  }

  finalize() {
    this.idByComparableObject = new WeakMap();
    this.objectModelById = {};
  }

  nextId() {
    return this.lastId++;
  }

  jsonReplacer(key, value) {
    if (value instanceof ObjectModel) {
      // Save id that was used as well as ObjectModel instance
      let id = this.idByComparableObject.get(value.comparable);
      if (id === undefined) {
        id = this.nextId();
        this.idByComparableObject.set(value.comparable, id);
        this.objectModelById[id] = value;
      }

      const res = { type: value.type, id: id };
      if (value.isScalar) {
        res['val'] = value.scalar;
      }
      return res;
    }
    if (value instanceof Set) {
      return Array.from(value);
    }
    return value;
  }

  jsonReviver(key, value) {
    if (value !== null && value.constructor.name == 'Object') {
      if (value.type !== undefined && value.id !== undefined) {
        const obj = this.objectModelById[value.id];
        if (obj === undefined) {
          throw new Error('Received ObjectModel Id that was never sent.');
        }
        return obj;
      }
    }
    return value;
  }

  serializeHasFunctionOp(name) {
    if (name == null) throw new Error("Lookup of null function");
    return { op: 'hasFunction', name: name };
  }

  serializeCallFunctionOp(name, args) {
    return { op: 'callFunction', name: name, args: args };
  }

  serializeValidateFunctionOp(functionName, parameters) {
    return { op: 'validateFunction', 'functionName': functionName, 'parameterNames': parameters };
  }

  encodeObj(obj) {
    return JSON.stringify(obj, (key, value ) => this.jsonReplacer(key, value));
  }

  decodeObj(bytes) {
    return JSON.parse(bytes, (key, value) => this.jsonReviver(key, value));
  }
}

// JS (direct) -----------------------------------------------------------------

class JSStackFrame extends StackFrame {
  constructor(jsError) {
    super();
    this.jsError = jsError;
    this.cause = jsError;
    this.message = jsError.message;
  }

  toString(pathBase=null) {
    const upperJsFrames = [];
    for (const line of this.jsError.stack.split('\n')) {
      if (!line.match(/\sat .* \(.*fudomo-transform\/compute\.js:\d+:\d+\)/) && !line.match(/\sat .* \(.*\/node_modules\/vm2\/lib\/contextify.js:\d+:\d+\)/)) {
        upperJsFrames.push(line.replace(/    at /g, '    at (JS) '));
      } else {
        break;
      }
    }

    return upperJsFrames.join('\n');
  }

  toHtml(pathBase=null) {
    const upperJsFrames = [];
    for (const line of this.jsError.stack.split('\n')) {
      if (!line.match(/\sat .* \(.*fudomo-transform\/compute\.js:\d+:\d+\)/) && !line.match(/\sat .* \(.*\/node_modules\/vm2\/lib\/contextify.js:\d+:\d+\)/)) {
        upperJsFrames.push(escapeHtml(line.replace(/    at /g, '    at (JS) ')));
      } else {
        break;
      }
    }

    return upperJsFrames.join('\n');
  }
}

class BaseJSDecompositionFunctionRunner extends DecompositionFunctionRunner {
  constructor(baseDir, config) {
    super();
    this.languageId = 'js';
    this.initExternalFunctions(baseDir, config);
  }

  initExternalFunctions(baseDir, config) {
    throw new Error('Not implemented');
  }

  finalize() {
  }

  hasFunctionSync(name) {
    return this.externalFunctions[name] !== undefined;
  }

  async hasFunction(name) {
    return new Promise((resolve, reject) => {
      resolve(this.hasFunctionSync(name));
    });
  }

  callFunctionSync(name, args) {
    if (!this.hasFunctionSync(name)) {
      throw new Error(`Decomposition function implementation "${name}" could not be found.`);
    }

    return this.externalFunctions[name].apply(null, args);
  }

  async callFunction(name, args) {
    return new Promise((resolve, reject) => {
      try {
        resolve(this.callFunctionSync(name, args));
      } catch (error) {
        reject(error);
      }
    });
  }

  exceptionToStackFrame(exception) {
    return new JSStackFrame(exception)
  }

  async validateFunctions(validationCriteria) {
    const errors = [];
    for (const {functionName, parameters, decompositionQualifiedName} of validationCriteria) {
      if (!this.hasFunctionSync(functionName)) {
        errors.push({'decompositionQualifiedName': decompositionQualifiedName, 'error': `Expected implementation of decomposition function "${functionName}" not found.`});
      } else {
        const func = this.externalFunctions[functionName];
        const actualParameters = getParameterNames(func);
        if (JSON.stringify(actualParameters) !== JSON.stringify(parameters)) {
          errors.push({'decompositionQualifiedName': decompositionQualifiedName, 'error': `Implementation of decomposition function "${functionName}" does not have expected parameters "${parameters.join(', ')}"`});
        }
      }
    }
    return errors;
  }
}

// Python 3 --------------------------------------------------------------------

class PythonStackFrame extends StackFrame {
  constructor(baseDir, errorObj) {
    super();
    this.baseDir = path.resolve(baseDir);
    this.errorObj = errorObj;
    this.cause = errorObj;
  }

  toString(pathBase=null) {
    let res = `${this.errorObj.message}\n`;
    const reverseStack = this.errorObj.stack.slice(0).reverse();
    for (const entry of reverseStack) {
      let filename = this.relPath(pathBase, entry.filename);
      res += `    at (PY) ${filename}:${entry.startLine}:${entry.startCol}\n`;
    }
    return res.slice(0, -1);
  }

  toHtml(pathBase=null) {
    let res = `${escapeHtml(this.errorObj.message)}\n`;
    const reverseStack = this.errorObj.stack.slice(0).reverse();
    for (const entry of reverseStack) {
      let sourceLocation = this.relPath(pathBase, entry.filename);
      const sourcePos = [[entry.startLine - 1, entry.startCol - 1], [entry.endLine - 1, entry.endCol - 1]];
      res += `    at (PY) <a class="fudomo-exception-source-link" href="#" data-source-loc="${escapeHtml(JSON.stringify({ src: sourceLocation, pos: sourcePos}))}">${escapeHtml(sourceLocation)}:${entry.startLine}:${entry.startCol}</a>\n`;
    }
    return res.slice(0, -1);
  }
}

class PythonError {
  constructor(errorObj) {
    this.errorObj = errorObj;
    this.message = errorObj.message;
  }

  toString() {
    return this.message;
  }
}

class UnsupportedPythonVersionError extends Error {
  constructor(version, message) {
    super(message);
    this.version = version;
  }
}

exports.UnsupportedPythonVersionError = UnsupportedPythonVersionError;
exports.PythonError = PythonError;
exports.StackFrame = StackFrame;
exports.PythonStackFrame = PythonStackFrame;
exports.BaseJSDecompositionFunctionRunner = BaseJSDecompositionFunctionRunner;
exports.JSStackFrame = JSStackFrame;
exports.DecompositionFunctionRunner = DecompositionFunctionRunner;
exports.ExternalDecompositionFunctionRunner = ExternalDecompositionFunctionRunner;
exports.escapeHtml = escapeHtml;
