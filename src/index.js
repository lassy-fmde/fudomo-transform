const { Transformation, getFudomoParser } = require('./ast.js');
const { transform, FudomoComputeException, TransformationContext } = require('./compute.js');
const { getSkeletonGenerator, SKELETON_GENERATORS } = require('./skeleton-generate.js');
const { MetamodelInferer, TransformationValidator, DataValidator } = require('./metamodel.js');

module.exports = {

  FudomoParser: function() {
    return getFudomoParser();
  },

  parseFudomo: function(text, sourceLocation=null) {
    return new Transformation(text, sourceLocation);
  },

  transform: transform,

  TransformationContext: TransformationContext,

  getSkeletonGenerator: getSkeletonGenerator,

  SKELETON_GENERATORS: SKELETON_GENERATORS,

  MetamodelInferer: MetamodelInferer,

  TransformationValidator: TransformationValidator,

  DataValidator: DataValidator,

  FudomoComputeException: FudomoComputeException
};
