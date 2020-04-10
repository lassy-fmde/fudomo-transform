const { ObjectModel } = require('./model-io.js');
const { FudomoComputeException } = require('./compute.js');
const getParameterNames = require('paramnames');

const { DecompositionFunctionRunner, BaseJSDecompositionFunctionRunner, UnsupportedPythonVersionError, PythonError, JSStackFrame } = require('./runners.js')

// JS (direct) -----------------------------------------------------------------

class JSDecompositionFunctionRunner extends BaseJSDecompositionFunctionRunner {
  constructor(functionsModule) {
    super(null, null);
    this.externalFunctions = functionsModule || {};
  }

  initExternalFunctions(baseDir, config) {
  }
}

// -----------------------------------------------------------------------------

const RUNNERS_BY_ID = {
  javascript: JSDecompositionFunctionRunner,
};

const RUNNER_BY_FILE_EXTENSION = {
  js: JSDecompositionFunctionRunner,
};

module.exports = {
  DecompositionFunctionRunner: DecompositionFunctionRunner,

  getRunnerClassById: function(id) {
    return RUNNERS_BY_ID[id];
  },

  getRunnerClassByFileExtension: function(extension) {
    return RUNNER_BY_FILE_EXTENSION[extension];
  },

  importCommonJSModule: async function(moduleSource) {
    return new Promise((resolve, reject) => {
      const module = {};
      const window = {};
      const document = {};
      try {
        eval(moduleSource);
        resolve(module.exports);
      } catch (error) {
        reject(new FudomoComputeException([new JSStackFrame(error)]));
      }
    });
  },

  importES6Module: async function(moduleSource) {
    const dataUri = "data:text/javascript;charset=utf-8," + encodeURIComponent(moduleSource);
    return new Promise((resolve, reject) => {
      import(/* webpackIgnore: true */dataUri).then(mod => {
        resolve(mod);
      }).catch(error => {
        reject(new FudomoComputeException([new JSStackFrame(error)]));
      });
    });
  },

  importModule: async function(moduleSource) {
    return module.exports.importCommonJSModule(moduleSource).catch((cjsError) => {
      return module.exports.importES6Module(moduleSource);
    });
  }
}
