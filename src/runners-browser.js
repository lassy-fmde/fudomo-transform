const { ObjectModel } = require('./model-io.js');
const getParameterNames = require('paramnames');

const { DecompositionFunctionRunner, BaseJSDecompositionFunctionRunner, UnsupportedPythonVersionError, PythonError, JSStackFrame } = require('./runners.js')

// JS (direct) -----------------------------------------------------------------

class JSDecompositionFunctionRunner extends BaseJSDecompositionFunctionRunner {
  constructor(functionsModule) {
    super(null, null);
    this.externalFunctions = functionsModule;
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

  importModule: function(moduleSource) {
    const module = {};
    const window = {};
    const document = {};
    eval(moduleSource);
    return module;
    //const dataUri = 'data:text/javascript;charset=utf-8,' + encodeURIComponent(moduleSource);
    //return import(dataUri);
  }
}
