const { VM } = require('vm2');
const path = require('path');
const util = require('util');
const fs = require('fs');
const stream = require('stream');
const chalk = require('chalk');
const child_process = require('child_process');
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

class JSDecompositionFunctionRunner extends BaseJSDecompositionFunctionRunner {
  initExternalFunctions(baseDir, config) {
    const resolvedFunctionsModulePath = path.resolve(baseDir, config.functions);
    delete require.cache[require.resolve(resolvedFunctionsModulePath)];
    this.externalFunctions = require(resolvedFunctionsModulePath);
  }
}

// JS (vm2) --------------------------------------------------------------------

class JSVM2DecompositionFunctionRunner extends BaseJSDecompositionFunctionRunner {
  initExternalFunctions(baseDir, config) {
    const resolvedFunctionsModulePath = path.resolve(baseDir, config.functions);
    const functionSource = fs.readFileSync(resolvedFunctionsModulePath, { encoding: 'utf-8' });
    const vm = new VM({
      sandbox: { 'module': {}, console: console }
    });
    this.externalFunctions = vm.run(functionSource, resolvedFunctionsModulePath);
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

class PythonDecompositionFunctionRunner extends DecompositionFunctionRunner {
  constructor(baseDir, config) {
    super();
    this.languageId = 'python';
    this.DEBUG = process.env.FUDOMO_DEBUG || false;
    this.baseDir = baseDir;
    this.pythonProc = null;
    this.config = config;
    this.consoleHandler = config.consoleHandler || console;
    this.idByComparableObject = new WeakMap();
    this.objectModelById = {};
    this.lastId = 0;
  }

  finalize() {
    this._writeObj({ op: 'exit' }).catch(error => {}); // Do nothing on error, might be disconnected already.
    if (this.pythonProc && this.pythonProc.connected) {
      this.pythonProc.disconnect();
    }
    this.idByComparableObject = new WeakMap();
    this.objectModelById = {};
  }

  nextId() {
    return this.lastId++;
  }

  static addToArgumentParser(parser) {
    parser.addArgument(['--python-executable'], { type: String, default: 'python', help: 'Python executable used to run transformation functions when using Python language'});
  }

  async getPythonProc() {
    if (this.pythonProc !== null) {
      return new Promise(resolve => resolve(this.pythonProc));
    }
    return new Promise((resolve, reject) => {
      const pyFuncRunnerPath = path.join(path.dirname(module.filename), 'function-runner.py');
      // Get the configured python binary to use.
      // From Atom, the ".config"-file can specify the binary using these keys:
      //   python-executable-<platform>
      //   python-executable
      // From the command line, the binary can be specified with the "--python-executable" switch
      // (which ends up as "python_executable" key in the config object).
      // The default is simply "python".
      const pythonBinary = this.config[`python-executable-${process.platform}`] || this.config['python-executable'] || this.config['python_executable'] || 'python';

      // Run the Python binary to check the Python version.
      child_process.execFile(pythonBinary, ['--version'], (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        const output = stdout || stderr;
        if (!output.startsWith('Python 3.')) {
          reject(new UnsupportedPythonVersionError(output.trim(), `The python binary "${pythonBinary}" reports its version as "${stderr.trim()}". Python 3 is required.\nPlease specify a corresponding python interpreter executable on the command line (using --python-executable ...),\nor in the decomposition config file in Atom (using the key "python-executable" or "python-executable-<platform>").`));
          return;
        }

        // Run the Python binary, establishing additional pipes for input/output. This leaves stdin/stdout/stderr for Python to use.
        this.pythonProc = child_process.spawn(pythonBinary, [pyFuncRunnerPath, this.config.functions], { cwd: this.baseDir, stdio: ['inherit', 'pipe', 'pipe', 'pipe', 'pipe'] });
        // Log any stdout/stderr output to the given consoleHandler.
        this.pythonProc.stdio[1].on('data', (data) => {
          this.consoleHandler.log(data.toString());
        });
        this.pythonProc.stdio[2].on('data', (data) => {
          this.consoleHandler.error(data.toString());
        });
         // Read confirmation of successful import
        return this._readObj().then(confirmation => {
          if (confirmation.exception) {
            this.finalize();
            reject(new PythonError(confirmation.exception));
            return;
          }
          resolve(this.pythonProc);
        });
      });
    });
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

  async _writeBuffer(buffer) {
    return this.getPythonProc().then(pythonProc => {
      const dontWaitForDrain = pythonProc.stdio[3].write(buffer);
      if (dontWaitForDrain) {
        return buffer;
      } else {
        return new Promise((resolve, reject) => {
          pythonProc.stdio[3].once('drain', () => {
            resolve(buffer);
          });
        });
      }
    });
  }

  async _writeObj(obj) {
    const jsonString = JSON.stringify(obj, (key, value ) => this.jsonReplacer(key, value));
    const payloadBuffer = Buffer.from(jsonString);
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(payloadBuffer.length, 0);
    return this._writeBuffer(lengthBuffer).then(lengthBuffer => {
      return this._writeBuffer(payloadBuffer).then(payloadBuffer => {
        if (this.DEBUG) console.error(chalk.red('JS: wrote ') + jsonString);
      });
    });
  }

  async _readBytes(nr) {
    const pythonProc = await this.getPythonProc();
    return new Promise((resolve, reject) => {

      // The result buffer that will be filled through one or more data events.
      // When it contains "nr" bytes, the promise is resolved.
      let dataBuffer = Buffer.alloc(0);
      const dataHandler = data => {
        if (data === null) {
          reject(new Error('Unexpected end of stream'));
          return;
        }

        // Add obtained data to result buffer
        dataBuffer = Buffer.concat([dataBuffer, data]);
        if (dataBuffer.length == nr) {
          // The result buffer contains exactly the expected number of bytes,
          // resolve to its value.
          resolve(dataBuffer);
        } else if (dataBuffer.length > nr) {
          // The result buffer now has too much data. Slice off as many bytes
          // as were expected, and unshift the rest back into the pipe for the
          // next read() operation.
          const res = dataBuffer.slice(0, nr);
          const left = dataBuffer.slice(nr);
          // Pause stream before unshifting, because otherwise a data event is
          // fired while we are not listening.
          pythonProc.stdio[4].pause();
          pythonProc.stdio[4].unshift(left);
          // Resolve to the buffer with the right number of bytes in it.
          resolve(res);
        } else /* (dataBuffer.length < nr) */ {
          // The buffer does not yet have the requested number of bytes in it,
          // add the event handler again to get more data.
          pythonProc.stdio[4].once('data', dataHandler);
        }
      };
      // Add data event handler, this will read a buffer from the pipe.
      pythonProc.stdio[4].once('data', dataHandler);
      // Resume the pipe because it could be paused due to a previous unshift.
      pythonProc.stdio[4].resume();
    });
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

  async _readObj() {
    const lengthBuffer = await this._readBytes(4);
    const length = lengthBuffer.readUInt32LE(0);
    return this._readBytes(length).then(strBuffer => {
      const str = strBuffer.toString();
      if (this.DEBUG) console.error(chalk.green('JS: read ') + str);
      return JSON.parse(str, (key, value) => this.jsonReviver(key, value));
    });
  }

  async hasFunction(name) {
    if (name == null) throw new Error("Lookup of null function");
    await this._writeObj({ op: 'hasFunction', name: name });
    return this._readObj();
  }

  async callFunction(name, args) {
    // TODO
    await this._writeObj({ op: 'callFunction', name: name, args: args })
    return this._readObj().then(response => {
      if (response.exception) {
        throw new PythonError(response.exception);
      } else {
        return response.result;
      }
    });
  }

  async validateFunctions(validationCriteria) {
    const errors = [];
    for (const {functionName, parameters, decompositionQualifiedName} of validationCriteria) {
      await this._writeObj({ op: 'validateFunction', 'functionName': functionName, 'parameterNames': parameters });
      const errorMessages = await this._readObj();

      errors.push(...errorMessages.map(message => ({'decompositionQualifiedName': decompositionQualifiedName, 'error': message})));
    }
    return errors;
  }

  exceptionToStackFrame(exception) {
    if (exception instanceof PythonError) {
      return new PythonStackFrame(this.baseDir, exception.errorObj);
    } else {
      return new JSStackFrame(exception);
    }
  }
}

// -----------------------------------------------------------------------------

const RUNNERS_BY_ID = {
  javascript: JSDecompositionFunctionRunner,
  javascriptvm: JSVM2DecompositionFunctionRunner,
  python: PythonDecompositionFunctionRunner
};

const RUNNER_BY_FILE_EXTENSION = {
  js: JSDecompositionFunctionRunner,
  py: PythonDecompositionFunctionRunner
};

module.exports = {
  DecompositionFunctionRunner: DecompositionFunctionRunner,

  getRunnerClassById: function(id) {
    return RUNNERS_BY_ID[id];
  },

  getRunnerClassByFileExtension: function(extension) {
    return RUNNER_BY_FILE_EXTENSION[extension];
  },

  addToArgumentParser: function(parser) {
    for (const runnerId of Object.keys(RUNNERS_BY_ID)) {
      const runnerClass = RUNNERS_BY_ID[runnerId];
      runnerClass.addToArgumentParser(parser);
    }
  }
}
