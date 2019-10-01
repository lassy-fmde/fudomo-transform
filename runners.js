const { VM } = require('vm2');
const path = require('path');
const util = require('util');
const fs = require('fs');
const { StackFrame } = require('./compute.js');

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
  hasFunction(name) {
    throw new Error('Not implemented');
  }
  callFunction(name, args) {
    throw new Error('Not implemented');
  }
  exceptionToStackFrame(exception) {
    throw new Error('Not implemented');
  }
}

// JS (direct) -----------------------------------------------------------------

class JSStackFrame extends StackFrame {
  constructor(jsError) {
    super();
    this.jsError = jsError;
    this.message = jsError.message;
  }

  toString() {
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

  toHtml() {
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

class JSDecompositionFunctionRunner extends DecompositionFunctionRunner {
  constructor(baseDir, config) {
    super();
    const resolvedFunctionsModulePath = path.resolve(baseDir, config.functions);
    delete require.cache[require.resolve(resolvedFunctionsModulePath)];
    this.externalFunctions = require(resolvedFunctionsModulePath);
  }

  finalize() {
  }

  hasFunction(name) {
    return this.externalFunctions[name] !== undefined;
  }

  callFunction(name, args) {
    if (this.externalFunctions[name] === undefined) {
      throw new Error(`Decomposition function implementation "${name}" could not be found.`);
    }

    return this.externalFunctions[name].apply(null, args);
  }

  exceptionToStackFrame(exception) {
    return new JSStackFrame(exception)
  }
}

// JS (vm2) --------------------------------------------------------------------

class JSVM2DecompositionFunctionRunner extends DecompositionFunctionRunner {
  constructor(baseDir, config) {
    super();
    const resolvedFunctionsModulePath = path.resolve(baseDir, config.functions);
    const functionSource = fs.readFileSync(resolvedFunctionsModulePath, { encoding: 'utf-8' });
    const vm = new VM({
      sandbox: { 'module': {} }
    });
    this.externalFunctions = vm.run(functionSource, resolvedFunctionsModulePath);
  }

  finalize() {
  }

  hasFunction(name) {
    return this.externalFunctions[name] !== undefined;
  }

  callFunction(name, args) {
    if (this.externalFunctions[name] === undefined) {
      throw new Error(`Decomposition function implementation "${name}" could not be found.`);
    }

    return this.externalFunctions[name].apply(null, args);
  }

  exceptionToStackFrame(exception) {
    return new JSStackFrame(exception)
  }
}

// -----------------------------------------------------------------------------

const RUNNERS_BY_ID = {
  javascript: JSDecompositionFunctionRunner,
  javascriptvm: JSVM2DecompositionFunctionRunner,
//  python: PythonDecompositionFunctionRunner
};

const RUNNER_BY_FILE_EXTENSION = {
  js: JSDecompositionFunctionRunner,
//  'py': PythonDecompositionFunctionRunner
};

module.exports = {
  DecompositionFunctionRunner: DecompositionFunctionRunner,

  getRunnerClassById(id) {
    return RUNNERS_BY_ID[id];
  },

  getRunnerClassByFileExtension(extension) {
    return RUNNER_BY_FILE_EXTENSION[extension];
  }
}
