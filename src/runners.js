const { StackFrame } = require('./compute.js');
const { ObjectModel } = require('./model-io.js');
const YamlAstParser = require('yaml-ast-parser');
const getParameterNames = require("paramnames");
const lineColumn = require('line-column');
const { offsetToRange, RangeReplaceQuickfixProposal, reMatchAll } = require('./utils.js');
const { getSkeletonGenerator } = require('./skeleton-generate.js');
const leven = require('leven');

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

  getSkeletonGenerator() {
    throw new Error('Not implemented');
  }

  async validateFunctions(source, validationCriteria, transformation) {
    source = source || '';

    const signatures = this.getFunctionSignatures(source);
    const expectedFunctionNames = new Set(validationCriteria.map(c => c.functionName));
    const unexpectedFunctionSignatures = signatures.filter(sig => !expectedFunctionNames.has(sig.funcName));

    const errors = [];
    for (const {functionName, parameters, decompositionQualifiedName} of validationCriteria) {
      const sig = signatures.find(s => s.funcName === functionName);
      if (sig !== undefined) {
        // Found, check parameters
        parameters.forEach((expectedParameter, index) => {
          const actualParameter = sig.parameters[index];
          if (actualParameter === undefined) {
            // Missing parameter
            errors.push({
              message: `Missing parameter "${expectedParameter}"`,
              markerContext: { type: 'function', location: sig.parametersListRange },
              fixes: [
                new RangeReplaceQuickfixProposal(`Add parameter "${expectedParameter}"`, 'functions', source, sig.parametersListRange, sig.parameters.map(p => p.name).concat([expectedParameter]).join(', '))
              ]
            });
          } else {
            if (actualParameter.name !== expectedParameter) {
              // Wrong parameter name
              errors.push({
                message: `Incorrect parameter name "${actualParameter.name}", expected "${expectedParameter}"`,
                markerContext: { type: 'function', location: sig.parametersListRange },
                fixes: [
                  new RangeReplaceQuickfixProposal(`Rename parameter "${actualParameter.name}" to "${expectedParameter}"`, 'functions', source, actualParameter.nameRange, expectedParameter)
                ]
              });
            }
          }
        });
        sig.parameters.slice(parameters.length).forEach((actualParameter, index) => {
          const actualIndex = parameters.length + index;
          // Extra parameter
          errors.push({
            message: `Unexpected parameter "${actualParameter.name}"`,
            markerContext: { type: 'function', location: sig.parametersListRange },
            fixes: [
              new RangeReplaceQuickfixProposal(`Remove parameter "${actualParameter.name}"`, 'functions', source, sig.parametersListRange, sig.parameters.map(p => p.name).filter((e, i) => i !== actualIndex).join(', '))
            ]
          });
        });

      } else {
        // Not found, check for other functions with close parameter names (sort by editing distance),
        // that do not correspond to another decomposition function. Create marker on transformation.
        function sigString(sig) {
          return `${sig.funcName}-${sig.parameters.map(p => p.name).join('-')}`;
        }

        const replacementSignature = this.getSkeletonGenerator().generateDecompositionFunction(transformation.getDecompositionBySignature(decompositionQualifiedName), true);

        const queryString = `${functionName}-${parameters.join('-')}`;
        const choices = Array.from(unexpectedFunctionSignatures);
        choices.sort((a, b) => {
          const sigA = sigString(a);
          const sigB = sigString(b);
          const aDist = leven(queryString, sigA);
          const bDist = leven(queryString, sigB);
          return aDist - bDist;
        });
        const newFunctionSkeleton = '\n\n' + this.getSkeletonGenerator().generateDecompositionFunction(transformation.getDecompositionBySignature(decompositionQualifiedName), false) + '\n';
        //const newFunctionProposal = new AppendTextQuickfixProposal(`Create new function skeleton "${functionName}"`, 'functions', source, newFunctionSkeleton);
        const appendProposals = [];
        const appendRange = this.getAppendNewFunctionSkeletonRange(source);
        if (appendRange !== null) {
          const newFunctionProposal = new RangeReplaceQuickfixProposal(`Create new function skeleton "${functionName}"`, 'functions', source, appendRange, newFunctionSkeleton);
          appendProposals.push(newFunctionProposal);
        }

        errors.push({
          message: `Function "${functionName}" not found`,
          markerContext: { type: 'transformation', decompositionQualifiedName: decompositionQualifiedName },
          fixes: appendProposals.concat(choices.map(sig => {
            return new RangeReplaceQuickfixProposal(`Change existing function "${sig.funcName}"`, 'functions', source, sig.signatureRange, replacementSignature);
          }))
        });
      }
    }
    return errors;
  }

  async callFunction(name, args) {
    throw new Error('Not implemented');
  }

  convertScalarValue(objectModelType, value) {
    throw new Error('Not implemented');
  }

  async toString(obj) {
    throw new Error('Not implemented');
  }

  exceptionToStackFrame(exception) {
    throw new Error('Not implemented');
  }

  getAppendNewFunctionSkeletonRange(source) {
    throw new Error('Not implemented');
  }

  getFunctionSignatures(source) {
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
      let id = this.idByComparableObject.get(value.id);
      if (id === undefined) {
        id = this.nextId();
        this.idByComparableObject.set(value.id, id);
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

  get location() {
    // Example: "at x (eval at <anonymous> (http://localhost:3000/try-fudomo/static/js/main.chunk.js:2556:9), <anonymous>:2:15)"
    for (const line of this.jsError.stack.split('\n')) {
      // return first coordinates we can parse
      const lastPart = line.split(',').slice(-1)[0];
      const match = /.*?:(\d+):(\d+)\)/.exec(lastPart);
      if (match !== null) {
        const startLine = Number(match[1]) - 1;
        const startCol = Number(match[2]) - 1;
        return [[startLine, startCol], [startLine, startCol + 1]]; // TODO improve?
      }
    }
    return null;
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

  convertScalarValue(objectModelType, value) {
    if (objectModelType === 'oyaml') {
      if (value.kind !== YamlAstParser.Kind.SCALAR) {
        throw new Error('Expected Scalar');
      }
      if (value.valueObject instanceof Date) {
        return value.valueObject;
      }

      const scalarType = YamlAstParser.determineScalarType(value);
      if (scalarType === YamlAstParser.ScalarType.string) {
        return value.value;
      } else {
        return value.valueObject;
      }

    } else if (objectModelType === 'js') {
      throw new Error('Unsupported object model type ' + objectModelType);
    } else {
      throw new Error('Not implemented');
    }
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

  getSkeletonGenerator() {
    return getSkeletonGenerator('js');
  }

  exceptionToStackFrame(exception) {
    return new JSStackFrame(exception)
  }

  async toString(obj) {
    return String(obj);
  }

  getAppendNewFunctionSkeletonRange(source) {
    const exportsRe = /(module\.exports\s*=\s*{\s*)([\s\S]*)(})/g;
    const matches = reMatchAll(source, exportsRe);
    if (matches.length != 1) return null;
    const m = matches[0];
    return [m.groupRanges[2][1], m.groupRanges[2][1]];
  }

  getFunctionSignatures(source) {
    // Groups:
    // 1: comment
    // 4: function name
    // 6: parameter list
    const signatureRe = /(\/\*\*[\s\S]*?\*\/\s*)?(\/\*\*.*?\*\/)?(\s*)([\w\d_]+)(:\s*function\(([\w\d_,\s]*)\))/g;

    // Group 2: parameter name
    const paramsRe = /(\s*)([\w\d_]+)([\s,]*)/g;
    return reMatchAll(source, signatureRe).map(match => {
      return {
        signature: match[0],
        signatureRange: match.groupRanges[0],
        funcName: match[4],
        funcNameRange: match.groupRanges[4],
        parameters: reMatchAll(match[6] || '', paramsRe).map(pMatch => {
          return {
            name: pMatch[2],
            nameRange: offsetToRange(source, match.indices[6][0] + pMatch.indices[2][0], pMatch.indices[2][1] - pMatch.indices[2][0])
          };
        }),
        parametersListRange: match.groupRanges[6],
        comment: match[1],
        commentRange: match.groupRanges[1]
      };
    });
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
