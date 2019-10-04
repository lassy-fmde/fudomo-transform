const { VM } = require('vm2');
const path = require('path');
const util = require('util');
const fs = require('fs');
const stream = require('stream');
const child_process = require('child_process');
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
    const pyFuncRunnerPath = path.join(path.dirname(module.filename), 'function-runner.py');
    const pythonBinary = config[`pythonExecutable.${process.platform}`] || config['pythonExecutable'] || 'python3';
    this.pythonProc = child_process.spawn(pythonBinary, [pyFuncRunnerPath, config.functions], { cwd: baseDir, stdio: ['pipe', 'pipe', 'inherit'] });
    const confirmation = this._readObj(); // Read confirmation of successfull import
    if (confirmation.exception) {
      this.finalize();
      throw new PythonError(confirmation.exception);
    }
  }

  finalize() {
    this._writeObj({ op: 'exit' });
    if (this.pythonProc.connected) {
      this.pythonProc.disconnect();
    }
  }

  _writeObj(obj) {
    const payloadBuffer = Buffer.from(JSON.stringify(obj));
    const lengthBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32LE(payloadBuffer.length, 0);
    const packet = Buffer.concat([lengthBuffer, payloadBuffer]);
    fs.writeSync(this.pythonProc.stdin._handle.fd, packet);
    if (this.DEBUG) console.error(`JS: wrote ${JSON.stringify(obj)}`);
  }

  _readBytes(nr) {
    const buf = Buffer.alloc(nr);
    let tryAgain = true;
    while (tryAgain) {
      try {
        fs.readSync(this.pythonProc.stdout._handle.fd, buf, 0, nr, null);
        tryAgain = false;
      } catch(error) {
        if (error.code != 'EAGAIN') {
          console.log(error);
        }
      }
    }
    return buf;
  }

  _readObj() {
    const lengthBuffer = this._readBytes(4);
    const length = lengthBuffer.readUInt32LE(0);
    const strBuffer = this._readBytes(length);
    const str = strBuffer.toString();
    const obj = JSON.parse(str);
    if (this.DEBUG) console.error(`JS:  read ${str}`);
    return obj;
  }

  hasFunction(name) {
    if (name == null) throw new Error("Lookup of null function");
    this._writeObj({ op: 'hasFunction', name: name });
    return this._readObj();
  }

  callFunction(name, args) {
    this._writeObj({ op: 'callFunction', name: name, args: args })
    const response = this._readObj();
    if (response.exception) {
      throw new PythonError(response.exception);
    } else {
      return response.result;
    }
  }
  exceptionToStackFrame(exception) {
    return new PythonStackFrame(this.baseDir, exception.errorObj);
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

  getRunnerClassById(id) {
    return RUNNERS_BY_ID[id];
  },

  getRunnerClassByFileExtension(extension) {
    return RUNNER_BY_FILE_EXTENSION[extension];
  }
}
