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

class Validator {
  constructor(metamodel) {
    this.metamodel = metamodel;
  }

  makeError(context, message, location=null) {
    return { context: context, message: message, location: location || [[0, 0], [0, 0]] };
  }

  typeExists(type) {
    if (type == 'Object') return true;
    return this.metamodel[type] !== undefined;
  }

  attrOrRefExists(type, attrName) {
    const typeSpec = this.metamodel[type];
    const attrOrRefSpec = typeSpec[attrName];
    return attrOrRefSpec !== undefined;
  }

  attrOrRefHasType(type, attrName, attrOrRefType) {
    if (attrOrRefType == 'Object') return true;
    const typeSpec = this.metamodel[type];
    const attrOrRefSpec = typeSpec[attrName];
    return attrOrRefSpec.includes(attrOrRefType);
  }
}

class TransformationValidator extends Validator {
  constructor(metamodel, transformation) {
    super(metamodel);
    this.transformation = transformation;
  }

  get errors() {
    const res = [];

    for (const decomposition of this.transformation.decompositions) {
      if (!this.typeExists(decomposition.function.type)) {
        res.push(this.makeError(decomposition.function.qualifiedName, `Type ${decomposition.function.type} not found in metamodel`, decomposition.function.typeLocation));
      }

      for (const link of decomposition.links) {

        if (link.kind == 'forward') {
          if (!this.attrOrRefExists(decomposition.function.type, link.referenceName)) {
            res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} -> ${link.function.qualifiedName}`, `Reference ${link.referenceName} not found in type ${decomposition.function.type}`, link.referenceLocation));
          } else {
            if (!this.attrOrRefHasType(decomposition.function.type, link.referenceName, link.function.type)) {
              res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} -> ${link.function.qualifiedName}`, `Type ${link.function.type} not allowed for reference ${decomposition.function.type}.${link.referenceName}`, link.function.typeLocation));
            }
          }

          if (!this.typeExists(link.function.type)) {
            res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} -> ${link.function.qualifiedName}`, `Type ${link.function.type} not found in metamodel`, link.function.typeLocation));
          }
        } else if (link.kind == 'reverse') {
          if (!this.attrOrRefExists(link.function.type, link.referenceName)) {
            res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} <- ${link.function.qualifiedName}`, `Reference ${link.referenceName} not found in type ${link.function.type}`, link.referenceLocation));
          } else {
            if (!this.attrOrRefHasType(link.function.type, link.referenceName, decomposition.function.type)) {
              res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} <- ${link.function.qualifiedName}`, `Type ${decomposition.function.type} not allowed for reference ${link.function.type}.${link.referenceName}`, link.function.typeLocation));
            }
          }

          if (!this.typeExists(link.function.type)) {
            res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} <- ${link.function.qualifiedName}`, `Type ${link.function.type} not found in metamodel`, link.function.typeLocation));
          }
        }
      }
    }

    return res;
  }
}

class DataValidator extends Validator {

  constructor(metamodel, centeredModel) {
    super(metamodel);
    this.centeredModel = centeredModel;
  }

  get errors() {
    const res = [];

    const visited = new Set();
    const open = [this.centeredModel.center];
    while (open.length > 0) {
      const obj = open.pop();

      if (visited.has(obj.comparable)) {
        continue;
      }
      visited.add(obj.comparable);

      if (!this.typeExists(obj.type)) {
        res.push(this.makeError(`Object of type ${obj.type}`, `Type ${obj.type} not found in metamodel`));
        continue;
      }

      for (const featureName of obj.featureNames) {

        if (!this.attrOrRefExists(obj.type, featureName)) {
          res.push(this.makeError(`Object of type ${obj.type}`, `Attribute or reference ${featureName} not found in type ${obj.type} in metamodel`));
        } else {
          for (const value of obj.getFeatureAsArray(featureName)) {
            const valueType = value.type || value.constructor.name;
            if (!this.attrOrRefHasType(obj.type, featureName, valueType)) {
              res.push(this.makeError(`Object of type ${obj.type}`, `Attribute or reference ${featureName} has disallowed type ${valueType}`));
            }

            if (value instanceof ObjectModel) {
              open.push(value);
            }
          }
        }
      }
    }

    return res;
  }
}

module.exports = {
  MetamodelInferer: MetamodelInferer,
  TransformationValidator: TransformationValidator,
  DataValidator: DataValidator
};
