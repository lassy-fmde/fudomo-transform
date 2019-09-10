const { Transformation, getFudomoParser } = require('./ast.js');
const modelIO = require('./model-io.js');
const transform = require('./compute.js');
const generateSkeletonModule = require('./skeleton-generate.js').generateSkeletonModule;
const { MetamodelInferer, TransformationValidator } = require('./metamodel.js');

module.exports = {

  FudomoParser: function() {
    return getFudomoParser();
  },

  parseFudomo: function(text) {
    return new Transformation(text);
  },

  loadModel: modelIO.loadModel,

  transform: transform,

  generateSkeletonModule: generateSkeletonModule,

  MetamodelInferer: MetamodelInferer,

  TransformationValidator: TransformationValidator
};
