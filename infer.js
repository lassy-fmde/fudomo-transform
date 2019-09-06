const { loadModel, loaders, CenteredModel, ObjectModel } = require('./model-io.js');

class MetamodelInferer {
  inferMetamodelFromPaths(instancePaths, initialMetamodel = null) {
    const instances = instancePaths.map(path => loadModel(path));
    return this.inferMetamodel(instances);
  }

  inferMetamodel(objectModels, initialMetamodel = null) {
    const metamodel = initialMetamodel || {};

    const visited = new Set();
    const open = objectModels.map(centeredModel => centeredModel.center);

    while (open.length > 0) {
      const obj = open.pop();
      if (visited.has(obj.comparable)) continue;
      visited.add(obj.comparable);

      for (const featureName of obj.featureNames) {
        const values = obj.getFeatureAsArray(featureName);
        for (const value of values) {
          let modelSpec = metamodel[obj.type];
          if (modelSpec == undefined) {
            modelSpec = {};
            metamodel[obj.type] = modelSpec;
          }

          let featureSpec = modelSpec[featureName];
          if (featureSpec == undefined) {
            featureSpec = [];
            modelSpec[featureName] = featureSpec;
          }

          const typeString = value.type || value.constructor.name;
          if (!featureSpec.includes(typeString)) {
            featureSpec.push(typeString);
          }

          if (value instanceof ObjectModel) {
            open.push(value);
          }
        }
      }
    }

    return metamodel;
  }
}

module.exports = MetamodelInferer;
