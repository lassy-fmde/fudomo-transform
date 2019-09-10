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

      if (metamodel[obj.type] == undefined) {
        metamodel[obj.type] = new Set();
      }

      for (const featureName of obj.featureNames) {
        const values = obj.getFeatureAsArray(featureName);

        for (const value of values) {
          let featureSpecs = metamodel[obj.type];

          let refType = null;
          if (featureName == 'cont') {
            refType = 'containment';
          } else if (value instanceof ObjectModel) {
            refType = 'reference';
          } else {
            refType = 'attribute';
          }

          const typeString = value.type || value.constructor.name;
          featureSpecs.add(JSON.stringify({'name': featureName, 'referenceType': refType, 'objectType': typeString, }));

          if (value instanceof ObjectModel) {
            open.push(value);
          }
        }
      }
    }

    const result = new Map();

    for (const objectType of Object.keys(metamodel)) {
      const objectResult = new Map();
      result.set(objectType, objectResult);

      const featureSpecs = Array.from(metamodel[objectType] || []).map(json => JSON.parse(json));
      if (featureSpecs.length == 0) {
        // If the object has not features, set its value to null (not an empty Array)
        // in order to be able to output YAML without a value for it.
        result.set(objectType, null);
        continue;
      }

      const attrFeatures = featureSpecs.filter(spec => spec.referenceType == 'attribute');
      const contFeatures = featureSpecs.filter(spec => spec.referenceType == 'containment');
      const refFeatures = featureSpecs.filter(spec => spec.referenceType == 'reference');

      const attrFeatureNames = Array.from(new Set(attrFeatures.map(spec => spec.name))).sort();
      const contFeatureNames = Array.from(new Set(contFeatures.map(spec => spec.name))).sort();
      const refFeatureNames = Array.from(new Set(refFeatures.map(spec => spec.name))).sort();

      // Attributes
      for (const attrName of attrFeatureNames) {
        let possibleTypes = objectResult.get(attrName);
        if (possibleTypes == null) {
          possibleTypes = new Set();
          objectResult.set(attrName, possibleTypes);
        }

        for (const spec of attrFeatures.filter(spec => spec.name == attrName)) {
          possibleTypes.add(spec.objectType);
        }
      }

      // Cont
      for (const contName of contFeatureNames) {
        let possibleTypes = objectResult.get(contName);
        if (possibleTypes == null) {
          possibleTypes = new Set();
          objectResult.set(contName, possibleTypes);
        }

        for (const spec of contFeatures.filter(spec => spec.name == contName)) {
          possibleTypes.add(spec.objectType);
        }
      }

      // References
      for (const refName of refFeatureNames) {
        let possibleTypes = objectResult.get(refName);
        if (possibleTypes == null) {
          possibleTypes = new Set();
          objectResult.set(refName, possibleTypes);
        }

        for (const spec of refFeatures.filter(spec => spec.name == refName)) {
          possibleTypes.add(spec.objectType);
        }
      }
    }

    // Sort possible types
    for (const objectType of result.keys()) {
      const objectSpec = result.get(objectType);
      if (objectSpec) {
        for (const featureName of objectSpec.keys()) {
          const possibleTypes = objectSpec.get(featureName);
          objectSpec.set(featureName, Array.from(possibleTypes).sort());
        }
      }
    }

    return result;
  }
}

class TransformationValidator {
  constructor(metamodel, transformation) {
    this.metamodel = metamodel;
    this.transformation = transformation;
  }

  typeExists(type) {
    if (type == 'Object') return true;
    return this.metamodel[type] !== undefined;
  }

  makeError(context, message, location) {
    return { context: context, message: message, location: location };
  }

  get errors() {
    const res = [];

    for (const decomposition of this.transformation.decompositions) {
      if (!this.typeExists(decomposition.function.type)) {
        res.push(this.makeError(decomposition.function.qualifiedName, `Type ${decomposition.function.type} not found in metamodel`, decomposition.function.typeLocation));
      }

      for (const link of decomposition.links) {
        if (link.kind == 'forward') {
          if (!this.typeExists(link.function.type)) {
            res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} -> ${link.function.qualifiedName}`, `Type ${link.function.type} not found in metamodel.`, link.function.typeLocation));
          }
        } else if (link.kind == 'reverse') {
          if (!this.typeExists(link.function.type)) {
            res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} <- ${link.function.qualifiedName}`, `Type ${link.function.type} not found in metamodel.`, link.function.typeLocation));
          }
        }
      }
    }

    return res;
  }
}

module.exports = {
  MetamodelInferer: MetamodelInferer,
  TransformationValidator: TransformationValidator
};
