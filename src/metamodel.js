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

      if (obj.isScalar) {
        const scalarType = obj.scalar !== null ? obj.scalar.constructor.name : null;
        if (scalarType !== null) {
          metamodel[obj.type].add(JSON.stringify({ 'scalarType': scalarType }));
        }
      } else {
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

            if (value !== null) {
              const typeString = value.type || value.constructor.name;
              featureSpecs.add(JSON.stringify({'name': featureName, 'referenceType': refType, 'objectType': typeString }));
            }

            if (value instanceof ObjectModel) {
              open.push(value);
            }
          }
        }
      }
    }

    const result = new Map();

    for (const objectType of Object.keys(metamodel)) {
      const objectResult = new Map();
      const featureSpecs = Array.from(metamodel[objectType] || []).map(json => JSON.parse(json));
      if (featureSpecs.length == 0) continue;

      if (featureSpecs.every(s => s.scalarType !== undefined)) {
        // Scalars
        const scalarTypes = featureSpecs.map(s => s.scalarType);
        if (scalarTypes.length == 0) {
          result.set(objectType, null);
        } else if (scalarTypes.length == 1) {
          result.set(objectType, scalarTypes[0]);
        } else {
          result.set(objectType, scalarTypes);
        }
        continue;
      }

      // Objects
      result.set(objectType, objectResult);

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
      if (objectSpec instanceof Map) {
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
    if (type == 'Object' || type == 'Root') return true;
    return this.metamodel[type] !== undefined;
  }

  attrOrRefExists(type, attrName) {
    if (type == 'Root' && attrName == 'cont') {
      return true;
    }
    if (type == 'Object') {
      return true;
    }
    const typeSpec = this.metamodel[type] || {};
    const attrOrRefSpec = typeSpec[attrName];
    return attrOrRefSpec !== undefined;
  }

  attrOrRefHasType(type, attrName, attrOrRefType) {
    if (attrOrRefType == 'Object') {
      return true;
    }
    if (type == 'Root' && attrName == 'cont') {
      return true;
    }
    const typeSpec = this.metamodel[type] || {};
    const attrOrRefSpec = typeSpec[attrName] || [];
    return attrOrRefSpec.includes(attrOrRefType);
  }
}

class TransformationValidator extends Validator {
  constructor(metamodel, transformation) {
    super(metamodel);
    this.transformation = transformation;
  }

  decompositionExists(type, name) {
    const decomp = this.transformation.getDecompositionBySignature(`${type}.${name}`);
    return !!decomp;
  }

  get errors() {
    const res = [];

    for (const decomposition of this.transformation.decompositions) {
      if (!this.typeExists(decomposition.function.type)) {
        res.push(this.makeError(decomposition.function.qualifiedName, `Decomposition Type ${decomposition.function.type} not found in metamodel`, decomposition.function.typeLocation));
      }

      for (const link of decomposition.links) {
        if (link.kind == 'forward') {
          if (!this.attrOrRefExists(decomposition.function.type, link.referenceName)) {
            res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} -> ${link.function.qualifiedName}`, `Reference ${link.referenceName} not found in type ${decomposition.function.type}`, link.referenceLocation));
          } else {
            if (!this.attrOrRefHasType(decomposition.function.type, link.referenceName, link.function.type)) {
              res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} -> ${link.function.qualifiedName}`, `Reference Type ${link.function.type} not allowed for reference ${decomposition.function.type}.${link.referenceName}`, link.function.typeLocation));
            }
          }

          if (!this.typeExists(link.function.type)) {
            res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} -> ${link.function.qualifiedName}`, `Forward Link Type ${link.function.type} not found in metamodel`, link.function.typeLocation));
          } else {
            if (link.function.isAbstract) { // eg. Foo.bar: cont -> Object.f
              const decompFunction = link.function.name;

              const possibleTypes = this.metamodel[decomposition.function.type][link.referenceName];
              for (const possibleType of possibleTypes) {
                const targetDecomp = this.transformation.getDecompositionBySignature(`${possibleType}.${decompFunction}`);
                if (targetDecomp == null) {
                  res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} -> ${link.function.qualifiedName}`, `No decomposition "${decompFunction}" found for concrete type ${possibleType}`, link.function.typeLocation));
                }
              }
            } else {
              if (!link.function.name === 'val' && !link.function.name === 'center') {
                if (!this.attrOrRefExists(link.function.type, link.function.name) && !this.decompositionExists(link.function.type, link.function.name)) {
                  res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} -> ${link.function.qualifiedName}`, `No attribute, reference or decomposition found for link target ${link.function.qualifiedName}`, link.function.location));
                }
              }
            }
          }

        } else if (link.kind == 'reverse') {
          if (!this.attrOrRefExists(link.function.type, link.referenceName)) {
            res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} <- ${link.function.qualifiedName}`, `Reference ${link.referenceName} not found in type ${link.function.type}`, link.referenceLocation));
          } else {
            if (!this.attrOrRefHasType(link.function.type, link.referenceName, decomposition.function.type)) {
              res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} <- ${link.function.qualifiedName}`, `Reference Type ${decomposition.function.type} not allowed for reference ${link.function.type}.${link.referenceName}`, link.function.typeLocation));
            }
          }

          if (!this.typeExists(link.function.type)) {
            res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} <- ${link.function.qualifiedName}`, `Reverse Link Type ${link.function.type} not found in metamodel`, link.function.typeLocation));
          } else {
            if (link.function.isAbstract) { // eg. Foo.bar: ref <- Object.f
              const decompFunction = link.function.name;

              for (const mmType of Object.keys(this.metamodel)) {
                const typeDef = this.metamodel[mmType];
                if (typeDef != null) {
                  const refTypes = typeDef[link.referenceName];
                  if (refTypes != undefined && refTypes.includes(decomposition.function.type)) {
                    const targetDecomp = this.transformation.getDecompositionBySignature(`${mmType}.${decompFunction}`);
                    if (targetDecomp == null) {
                      res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} -> ${link.function.qualifiedName}`, `No decomposition "${decompFunction}" found for concrete type ${mmType}`, link.function.typeLocation));
                    }
                  }
                }
              }
            } else {
              if (!link.function.name === 'val' && !link.function.name === 'center') {
                if (!this.attrOrRefExists(link.function.type, link.function.name) && !this.decompositionExists(link.function.type, link.function.name)) {
                  res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.referenceName} -> ${link.function.qualifiedName}`, `No attribute, reference or decomposition found for link target ${link.function.qualifiedName}`, link.function.location));
                }
              }
            }
          }
        } else if (link.kind == 'local') {
          if (!link.function.name === 'val' && !link.function.name === 'center') {
            // Either has decomposition or attribute
            const hasAttrOrRef = this.attrOrRefExists(link.decomposition.function.type, link.function.name);
            const hasDecomposition = this.transformation.getDecompositionBySignature(link.decomposition.function.type + '.' + link.function.name) != null;
            if (!hasAttrOrRef && !hasDecomposition) {
              res.push(this.makeError(`${decomposition.function.qualifiedName}: ${link.function.name}`, `No attribute or decomposition with name "${link.function.name}" found`, link.location));
            }
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
        res.push(this.makeError(`Object of type ${obj.type}`, `Type ${obj.type} not found in metamodel`, obj.typeLocation));
        continue;
      }

      if (obj.isScalar) {
        let allowedTypes = this.metamodel[obj.type] || [];
        allowedTypes = Array.isArray(allowedTypes) ? allowedTypes : [allowedTypes];
        const scalarType = obj.scalar !== null ? obj.scalar.constructor.name : 'null';
        if (!allowedTypes.includes(scalarType)) {
          res.push(this.makeError(`Object of type ${obj.type}`, `${obj.type} value has disallowed type ${scalarType}`, obj.scalarValueLocation));
        }
      } else {
        for (const featureName of obj.featureNames) {

          if (!this.attrOrRefExists(obj.type, featureName)) {
            res.push(this.makeError(`Object of type ${obj.type}`, `Attribute or reference ${featureName} not found in type ${obj.type} in metamodel`, obj.getFeatureNameLocation(featureName)));
          } else {
            for (const value of obj.getFeatureAsArray(featureName)) {

              let valueType = null;
              let markerLocation = null;
              if (value instanceof ObjectModel) {
                // object
                valueType = value.type;
                markerLocation = value.typeLocation;
              } else {
                // scalar
                valueType = value.constructor.name;
                markerLocation = obj.getFeatureValueLocation(featureName);
              }

              if (!this.attrOrRefHasType(obj.type, featureName, valueType)) {
                res.push(this.makeError(`Object of type ${obj.type}`, `Attribute or reference ${featureName} has disallowed type ${valueType}`, markerLocation));
              }

              if (value instanceof ObjectModel) {
                open.push(value);
              }
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
