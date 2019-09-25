const { Transformation, getFudomoParser } = require('./ast.js');
const modelIO = require('./model-io.js');
const transform = require('./compute.js');
const generateSkeletonModule = require('./skeleton-generate.js').generateSkeletonModule;
const { MetamodelInferer, TransformationValidator, DataValidator } = require('./metamodel.js');

module.exports = {

  FudomoParser: function() {
    return getFudomoParser();
  },

  parseFudomo: function(text, sourceLocation=null) {
    return new Transformation(text, sourceLocation);
  },

  loadModel: modelIO.loadModel,

  transform: transform,

  generateSkeletonModule: generateSkeletonModule,

  MetamodelInferer: MetamodelInferer,

  TransformationValidator: TransformationValidator,

  DataValidator: DataValidator
};
