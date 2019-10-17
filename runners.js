const { VM } = require('vm2');
const path = require('path');
const util = require('util');
const fs = require('fs');
const stream = require('stream');
const child_process = require('child_process');
const { StackFrame } = require('./compute.js');
const { ObjectModel } = require('./model-io.js');

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

class JSDecompositionFunctionRunner extends DecompositionFunctionRunner {
  constructor(baseDir, config) {
    super();
    const resolvedFunctionsModulePath = path.resolve(baseDir, config.functions);
    delete require.cache[require.resolve(resolvedFunctionsModulePath)];
    this.externalFunctions = require(resolvedFunctionsModulePath);
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
    if (this.externalFunctions[name] === undefined) {
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

  hasFunctionSync(name) {
    return this.externalFunctions[name] !== undefined;
  }

  async hasFunction(name) {
    return new Promise((resolve, reject) => {
      resolve(this.hasFunctionSync(name));
    });
  }

  callFunctionSync(name, args) {
    if (this.externalFunctions[name] === undefined) {
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
}

// Python 3 --------------------------------------------------------------------

class PythonStackFrame extends StackFrame {
  constructor(baseDir, errorObj) {
    super();
    this.baseDir = path.resolve(baseDir);
    this.errorObj = errorObj;
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

class PythonDecompositionFunctionRunner extends DecompositionFunctionRunner {
  constructor(baseDir, config) {
    super();
    this.DEBUG = false;
    this.baseDir = baseDir;
    this.pythonProc = null;
    this.config = config;
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
      // - python-executable-<platform>
      // - python-executable
      // From the command line, the binary can be specified with the "--python-executable" switch
      // (which ends up as "python_executable" key in the config object).
      // The default is simply "python".
      const pythonBinary = this.config[`python-executable-${process.platform}`] || this.config['python-executable'] || this.config['python_executable'] || 'python';
      // Run the Python binary, establishing additional pipes for input/output. This leaves stdin/stdout/stderr for Python to use.

      child_process.execFile(pythonBinary, ['--version'], (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        const output = stdout || stderr;
        if (!output.startsWith('Python 3.')) {
          reject(new Error(`The python binary "${pythonBinary}" reports its version as "${stderr.trim()}". Python 3 is required. Please specify a corresponding python interpreter executable on the command line (using --python-executable ...) or in the decomposition config file in Atom.`));
          return;
        }
        this.pythonProc = child_process.spawn(pythonBinary, [pyFuncRunnerPath, this.config.functions], { cwd: this.baseDir, stdio: ['inherit', 'inherit', 'inherit', 'pipe', 'pipe'] });
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

  async _writeObj(obj) {
    return this.getPythonProc().then(pythonProc => {
      try {
        const jsonString = JSON.stringify(obj, (key, value ) => this.jsonReplacer(key, value));
        const payloadBuffer = Buffer.from(jsonString);
        const lengthBuffer = Buffer.alloc(4);
        lengthBuffer.writeUInt32LE(payloadBuffer.length, 0);
        const packet = Buffer.concat([lengthBuffer, payloadBuffer]);
        if (this.DEBUG) console.error(`JS: wrote ${jsonString}`);
        pythonProc.stdio[3].write(packet);
        return obj;
      } catch(error) {
        console.dir(obj);
        console.log(`${error.constructor.name}: ${error.message}, obj was:`);
        throw error;
      }
    });
  }

  async _readBytes(nr) {
    const pythonProc = await this.getPythonProc();
    return new Promise((resolve, reject) => {
      pythonProc.stdio[4].once('readable', () => {
        const data = pythonProc.stdio[4].read(nr);

        if (data.length == nr) {
          resolve(data);
        }
        if (data.length > nr) {
          const res = data.slice(0, nr);
          const left = data.slice(nr);
          pythonProc.stdio[4].unshift(left);
          resolve(res);
        }
        if (data.length < nr) {
          // TODO
          console.error('???');
        }
      });
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
      if (this.DEBUG) console.error(`JS:  read ${str}`);
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
