const { Transformation, getFudomoParser } = require('./ast.js');
const modelIO = require('./model-io.js');
const { transform, FudomoComputeException, TransformationContext } = require('./compute.js');
const { getSkeletonGenerator, SKELETON_GENERATORS } = require('./skeleton-generate.js');
const { MetamodelInferer, TransformationValidator, DataValidator } = require('./metamodel.js');
const { getRunnerClassById, getRunnerClassByFileExtension } = require('./runners.js');

module.exports = {

  FudomoParser: function() {
    return getFudomoParser();
  },

  parseFudomo: function(text, sourceLocation=null) {
    return new Transformation(text, sourceLocation);
  },

  loadModel: modelIO.loadModel,

  transform: transform,

  TransformationContext: TransformationContext,

  getRunnerClassById: getRunnerClassById,

  getRunnerClassByFileExtension: getRunnerClassByFileExtension,

  getSkeletonGenerator: getSkeletonGenerator,

  SKELETON_GENERATORS: SKELETON_GENERATORS,

  MetamodelInferer: MetamodelInferer,

  TransformationValidator: TransformationValidator,

  DataValidator: DataValidator,

  FudomoComputeException: FudomoComputeException
};
