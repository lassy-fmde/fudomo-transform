const Parser = require('tree-sitter');
const FudomoLang = require('tree-sitter-fudomo');
const Transformation = require('./ast.js');
const modelIO = require('./model-io.js');
const transform = require('./compute.js');
const generateSkeletonModule = require('./skeleton-generate.js').generateSkeletonModule;

module.exports = {

  FudomoParser: function() {
    const parser = new Parser();
    parser.setLanguage(FudomoLang);
    return parser;
  },

  parseFudomo: function(text) {
    return new Transformation(text);
  },

  loadModel: modelIO.loadModel,

  transform: transform,

  generateSkeletonModule: generateSkeletonModule
};
