const YamlAstParser = require('yaml-ast-parser');
const LineColumnFinder = require('line-column');

function isObject(obj) {
  // Checks if obj is an Object (ie. not a string, number, boolean, null, or undefined).
  // https://stackoverflow.com/a/14706877
  var type = typeof obj;
  return type === 'function' || type === 'object' && !!obj;
}

class AssertionError extends Error {
}

function assert(condition, message=null) { // Basic function that works in browser
  if (!condition) {
    if (message != null) {
      throw new AssertionError(message);
    } else {
      throw new AssertionError();
    }
  }
}

class ObjectModel {

  get id() {
    throw new Error('Not Implemented');
  }

  get isScalar() {
    throw new Error('Not implemented');
  }

  get scalar() {
    throw new Error('Not implemented');
  }

  get scalarValueLocation() {
    throw new Error('Not implemented');
  }

  get type() {
    throw new Error('Not implemented');
  }

  get typeLocation() {
    throw new Error('Not implemented');
  }

  get fullDefinitionLocation() {
    throw new Error('Not implemented');
  }

  getFeatureNameLocation(featureName) {
    throw new Error('Not implemented');
  }

  getFeatureValueLocation(featureName) {
    throw new Error('Not implemented');
  }

  /* Helper method that returns a value of a feature as an Array (wrapping single-valued features).
     This allows the caller to handle single- and multivalued features in the same way.
  */
  getFeatureAsArray(name) {
    const value = this.getFeature(name);
    if (Array.isArray(value)) {
      return value;
    }
    if (value === undefined) { // was scalar
      return [];
    }
    return [value];
  }

  getFeature(name) {
    throw new Error('Not implemented');
  }

  get featureNames() {
    throw new Error('Not implemented');
  }

  /* Return an object that can be used to compare an object to another via identity (ie. with '===').
  */
  get comparable() {
    throw new Error('Not implemented');
  }
}

class JSObjectFactory {
  constructor() {
    this.wrappers = new WeakMap();
  }

  getObjectModel(obj, sourceLocation) {
    let objectModel = this.wrappers.get(obj);
    if (objectModel === undefined) {
      objectModel = new JSObject(this, obj, sourceLocation);
      this.wrappers.set(obj, objectModel);
    }
    return objectModel;
  }
}

class JSObject extends ObjectModel {
  constructor(factory, obj, sourceLocation) {
    super();
    this.factory = factory;
    if (Array.isArray(obj)) {
      throw new Error('Can not create JSObject for Array');
    }
    this.obj = obj;
    this.sourceLocation = sourceLocation;
  }

  get isScalar() {
    return !isObject(this.obj);
  }

  get scalar() {
    return this.obj; // TODO ???
  }

  get scalarValueLocation() {
    return [[0, 0], [0, 0]];
  }

  get type() {
    return this.obj.constructor.name;
  }

  get typeLocation() {
    return [[0, 0], [0, 0]];
  }

  get fullDefinitionLocation() {
    return [[0, 0], [0, 0]];
  }

  /* Returns JSObject wrapper of value referred to by given name,
     or an Array of JSObjects if the value is an Array, or the value itself
     if it is of a primitive type.
   */
  getFeature(name) {
    const value = this.obj[name];
    if (Array.isArray(value)) {
      return value.map(o => this.factory.getObjectModel(o, this.sourceLocation));
    } else if (isObject(value)) {
      return this.factory.getObjectModel(value, this.sourceLocation);
    } else {
      return value;
    }
  }

  getFeatureNameLocation(featureName) {
    return [[0, 0], [0, 0]];
  }

  getFeatureValueLocation(featureName) {
    return [[0, 0], [0, 0]];
  }

  get featureNames() {
    // "cont", the feature name for contained objects, is not returned here
    // because JS objects do not have content.
    return Object.keys(this.obj);
  }

  get comparable() {
    return this.obj;
  }

  toString() {
    return `<JSObject obj='${this.obj}'>`;
  }
}

const SCALAR_VALUE_CONVERTERS = {};
SCALAR_VALUE_CONVERTERS[YamlAstParser.ScalarType.null] = function(n) { return null; }
SCALAR_VALUE_CONVERTERS[YamlAstParser.ScalarType.bool] = YamlAstParser.parseYamlBoolean;
SCALAR_VALUE_CONVERTERS[YamlAstParser.ScalarType.int] = YamlAstParser.parseYamlInteger;
SCALAR_VALUE_CONVERTERS[YamlAstParser.ScalarType.float] = YamlAstParser.parseYamlFloat;
SCALAR_VALUE_CONVERTERS[YamlAstParser.ScalarType.string] = function (s) { return s; }

class OYAMLObjectFactory {
  constructor() {
    this.wrappers = new WeakMap();
  }

  getObjectModel(obj, root, lineColumnFinder, sourceLocation) {
    let objectModel = this.wrappers.get(obj);
    if (objectModel === undefined) {
      objectModel = new OYAMLObject(this, obj, root, lineColumnFinder, sourceLocation);
      this.wrappers.set(obj, objectModel);
    }
    return objectModel;
  }
}

function isUpper(string) {
  return string.toUpperCase() === string;
}

function _getNodePosition(node, lineColumnFinder) {
  const startCoord = lineColumnFinder.fromIndex(node.startPosition) || { line: 0, col: 0 };
  const endCoord = lineColumnFinder.fromIndex(node.endPosition) || lineColumnFinder.fromIndex(lineColumnFinder.str.length - 1);
  return [[startCoord.line, startCoord.col], [endCoord.line, endCoord.col]];
}

class OYAMLObject extends ObjectModel {
  constructor(factory, obj, root, lineColumnFinder, sourceLocation) {
    assert(obj.kind == YamlAstParser.Kind.MAP);
    assert(root.kind == YamlAstParser.Kind.MAP);
    assert(obj.mappings[0].value === null || (obj.mappings[0].value.kind == YamlAstParser.Kind.SEQ || obj.mappings[0].value.kind == YamlAstParser.Kind.SCALAR), `Value ${obj.mappings[0].value} has unexpected kind.`);
    super();
    this.factory = factory;
    this.obj = obj;
    this.root = root;
    this.lineColumnFinder = lineColumnFinder;
    this.sourceLocation = sourceLocation;
  }

  getNodePosition(node) {
    return _getNodePosition(node, this.lineColumnFinder);
  }

  get id() {
    const key = this.obj.mappings[0].key.value;
    const parts = key.split(/\s+/);
    if (parts.length == 1) {
      return undefined;
    }
    return parts[1];
  }

  get isScalar() {
    return this.obj.mappings[0].value === null || this.obj.mappings[0].value.kind === YamlAstParser.Kind.SCALAR;
  }

  get scalar() {
    assert(this.obj.mappings[0].value === null || this.obj.mappings[0].value.kind === YamlAstParser.Kind.SCALAR);
    return this.wrapValue(this.obj.mappings[0].value);
  }

  get scalarValueLocation() {
    const scalarNode = this.obj.mappings[0].value;
    if (scalarNode === null) return this.getNodePosition(this.obj.mappings[0]);
    return this.getNodePosition(scalarNode);
  }

  get structureSeq() {
    return this.obj.mappings[0].value;
  }

  get type() {
    const key = this.obj.mappings[0].key.value;
    return key.split(' ').slice(0, 1)[0];
  }

  get typeLocation() {
    if (this.type == 'Root') {
      return this.fullDefinitionLocation;
    }
    const startPos = this.obj.mappings[0].key.startPosition;
    const { line, col } = this.lineColumnFinder.fromIndex(startPos) || { line: 0, col: 0 };
    return [[line, col], [line, col + this.type.length]];
  }

  get fullDefinitionLocation() {
    if (this.type == 'Root') {
      const endLoc = this.lineColumnFinder.fromIndex(this.lineColumnFinder.str.length - 1) || { line: 0, col: 0 };
      return [[0, 0], [endLoc.line, endLoc.col]];
    }
    const startPos = this.obj.mappings[0].key.startPosition;
    const startLoc = this.lineColumnFinder.fromIndex(startPos) || { line: 0, col: 0 };

    const innerObj = this.obj.mappings[0].value;
    let endItem = innerObj;
    if (innerObj.kind === YamlAstParser.Kind.SEQ && innerObj.items.length > 0) {
      endItem = innerObj.items.slice(-1)[0];
    }
    const endLoc = this.lineColumnFinder.fromIndex(endItem.endPosition - 1);
    return [[startLoc.line, startLoc.col], [endLoc.line, endLoc.col + 1]];
  }

  _stripRefMarker(name) {
    const trimmed = name.trim();
    if (trimmed.endsWith('>')) {
      return trimmed.slice(0, -1).trim();
    }
    return trimmed;
  }

  getObjectById(refId, _visited = null) {
    if (_visited == null) {
      _visited = new Set();
    }

    if (_visited.has(this.comparable)) {
      return null;
    }
    _visited.add(this.comparable);

    // Recursive search.
    if (this.id === refId) {
      return this;
    }

    for (var child of this.getFeature('cont')) {
      const childResult = child.getObjectById(refId, _visited);
      if (childResult != null) {
        return childResult;
      }
    }
    return null;
  }

  wrapValue(value) {
    if (Array.isArray(value)) {
      return value.map(v => this.wrapValue(v));
    }

    if (value !== null && value.kind !== undefined) { // TODO better way
        if (value.kind === YamlAstParser.Kind.SCALAR) {
          const scalarType = YamlAstParser.determineScalarType(value);
          return SCALAR_VALUE_CONVERTERS[scalarType.toString()](value.value);
        } else if (value.kind === YamlAstParser.Kind.SEQ) {
          return value.items.map(v => this.wrapValue(v));
        } else if (value.kind === YamlAstParser.Kind.MAP) {
          return this.factory.getObjectModel(value, this.root, this.lineColumnFinder, this.sourceLocation);
        }
    } else {
      return value;
    }
  }

  getFeature(name) {
    // TODO refactor a getFeatureMapping(featureName) method (and a getContainmentMaps() method?)

    if (this.isScalar) {
      return name === 'cont' ? [] : null;
    }

    let value = undefined;
    if (name === 'cont') {
      const allContent = this.obj.mappings[0].value.items;
      return this.wrapValue(allContent.filter(map => isUpper(map.mappings[0].key.value[0])));
    } else {
      const allContentMappings = this.obj.mappings[0].value.items.filter(m => m.mappings.length > 0).map(m => m.mappings[0]);
      const attrAndRefMappings = allContentMappings.filter(mapping => !isUpper(mapping.key.value[0])); // Array of Mappings

      // Find feature by name (works only on attributes because references have a special suffix)
      const featureMapping = attrAndRefMappings.filter(mapping => mapping.key.value == name)[0];
      if (featureMapping !== undefined && featureMapping.value.value !== undefined) {
        const directValue = featureMapping.value.value;
        // Found by name, thus simple attribute (references have '>'-marker and will not be found by simple name comparison)
        return this.wrapValue(directValue);
      } else {
        // Reference
        var referenceString = null;
        for (const mapping of attrAndRefMappings) {
          if (mapping.key.value.trim().endsWith('>') && this._stripRefMarker(mapping.key.value) == name) {
            referenceString = mapping.value.value;
            break;
          }
        }

        value = [];
        if (referenceString) {
          for (const rawRefId of referenceString.split(',')) {
            const refId = rawRefId.trim();
            const referredObject = this.factory.getObjectModel(this.root, this.root, this.lineColumnFinder, this.sourceLocation).getObjectById(refId);
            if (referredObject == undefined) {
              throw new Error(`Could not resolve reference "${name}: ${refId}"`);
            } else {
              value.push(referredObject.obj);
            }
          }
        }
        // Unpack array if only one result
        if (value.length == 0) {
          value = null;
        } else if (value.length == 1) {
          value = value[0];
        }
        return this.wrapValue(value);
      }
    }
  }

  getFeatureNameLocation(featureName) {
    assert(!this.isScalar);
    // TODO refactor a getFeatureMapping(featureName) method (and a getContainmentMaps() method?)
    const allContent = this.obj.mappings[0].value.items; // allContent is array of maps with single mapping

    for (const keyNode of allContent.map(map => map.mappings[0].key)) {
      if (isUpper(keyNode.value.trim()[0])) {
        continue;
      }
      const refName = this._stripRefMarker(keyNode.value);
      if (refName == featureName) {
        const { line, col } = this.lineColumnFinder.fromIndex(keyNode.startPosition);
        return [[line, col], [line, col + refName.length]]
      }
    }
    return [[0, 0], [0, 0]];
  }

  getFeatureValueLocation(featureName) {
    assert(!this.isScalar);
    // TODO refactor a getFeatureMapping(featureName) method (and a getContainmentMaps() method?)
    const allContent = this.obj.mappings[0].value.items; // allContent is array of maps with single mapping
    for (const map of allContent) {
      const mapping = map.mappings[0];
      const refName = this._stripRefMarker(mapping.key.value);
      if (refName == featureName) {
        return this.getNodePosition(mapping.value);
      }
    }
    return [[0, 0], [0, 0]];
  }

  get featureNames() {
    const objStructure = this.structureSeq;
    if (objStructure.kind != YamlAstParser.Kind.SEQ) {
      // Scalar
      return [];
    }
    const allContentMappings = this.obj.mappings[0].value.items.filter(m => m.mappings.length > 0).map(m => m.mappings[0]);
    const attrAndRefNames = allContentMappings.filter(mapping => !isUpper(mapping.key.value[0])).map(mapping => this._stripRefMarker(mapping.key.value));
    const result = attrAndRefNames;

    const containedObjs = allContentMappings.filter(mapping => isUpper(mapping.key.value[0]));
    if (containedObjs.length > 0) {
      result.push('cont');
    }
    return result;
  }

  get comparable() {
    return this.obj;
  }

  toString() {
    if (this.id === undefined) {
      return `<OYAMLObject type='${this.type}'>`;
    }
    return `<OYAMLObject type='${this.type}' id='${this.id}'>`;
  }
}

class CenteredModel {
  constructor(model, center) {
    if (model == undefined) {
      throw new Error("model can't be undefined");
    }
    if (center == undefined) {
      throw new Error("center can't be undefined");
    }
    if (!(model instanceof ObjectModel)) {
      throw new Error(`model must be instance of ObjectModel (got "${center}")`);
    }
    this.model = model;
    this._center = center;
  }

  get type() {
    return this.center.type;
  }

  get center() {
    return this._center;
  }

  get sourceLocation() {
    const centerFile = this.center.sourceLocation || 'unknown_source_path';
    return `${centerFile}:${this.center.typeLocation[0][0] + 1}:${this.center.typeLocation[0][1] + 1}`;
  }

  getFeature(name) {
    if (name == 'center') {
      return this._center;
    }
    if (name == 'val') {
      return this._center.scalar;
    }
    return this._center.getFeature(name);
  }

  successors(referenceName, type) {
    const values = this._center.getFeatureAsArray(referenceName);

    const res = [];
    for (const value of values) {
      if (!(value instanceof ObjectModel)) {
        continue;
      }
      let valueModel = new CenteredModel(this.model, value);

      let accept = true;
      if (type != 'Object') {
        if (valueModel.type != type) {
          accept = false;
        }
      }

      if (accept) {
        res.push(valueModel);
      }
    }
    return res;
  }

  predecessors(referenceName, type) {
    const res = new Set();
    const visited = new Set();

    // Non-recursive implementation
    const open = [this.model]; // Start from model root
    while (open.length > 0) {
      const obj = open.pop();

      // Check if obj was already seen
      if (visited.has(obj.comparable)) {
        continue;
      }
      visited.add(obj.comparable);

      // Check if the feature referred to by referenceName is "this". If so, save "obj" as a result.
      for (const referredValue of obj.getFeatureAsArray(referenceName)) {
        if (referredValue instanceof ObjectModel && referredValue.comparable === this._center.comparable) {
          const valueModel = new CenteredModel(this.model, obj);
          let accept = true;
          if (type != 'Object') {
            if (valueModel.type != type) {
              accept = false;
            }
          }

          if (accept) {
            res.add(valueModel);
          }
        }
      }

      // Find objects that obj refers to, and add them to the list of items to check.
      for (const featureName of obj.featureNames) {
        for (const successor of new CenteredModel(this.model, obj).successors(featureName, 'Object')) {
          if (successor._center instanceof ObjectModel) {
            open.push(successor._center);
          }
        }
      }
    }

    return res;
  }

  toString() {
    return `<CenteredModel center="${this._center}" model="${this.model}">`;
  }
}

class Root {
  // TODO Id?
  constructor(cont) {
    this.cont = cont;
  }
}

class Loader {
  loadFromFile(filename) {
    throw new Error('Not implemented');
  }
  loadFromData(data, sourceLocation=null) {
    throw new Error('Not implemented');
  }
  getRootCenteredModel(objectModel) {
    return new CenteredModel(objectModel, objectModel);
  }
}

class AbstractJSObjectLoader extends Loader {
  loadFromFile(filename) {
    throw new Error('Not implemented');
  }

  loadFromData(data, sourceLocation=null) {
    if (Array.isArray(data)) {
      throw new Error("Root has to be Object, not Array");
    }
    return new JSObjectFactory().getObjectModel(new Root(data), sourceLocation);
  }
}

class OYAMLParsingException {
  constructor(lineColumnFinder) {
    this.lineColumnFinder = lineColumnFinder;
    this.markers = [];
  }

  get message() {
    return this.toString();
  }

  addMarkerForNode(node, message) {
    if (node == null) {
      this.markers.push({ location: [[0, 0], [0, 0]], message: message });
    } else {
      const location = _getNodePosition(node, this.lineColumnFinder);
      this.markers.push({ location: location, message: message });
    }
  }

  addMarkerAtLocation(location, message) {
    this.markers.push({ location: location, message: message });
  }

  get hasMarkers() {
    return this.markers.length > 0;
  }

  toString() {
    return this.markers.map(m => `(${m.location[0][0]}:${m.location[0][1]}) ${m.message}`).join('\n');
  }
}

class AbstractOYAMLObjectLoader extends Loader {
  isStringScalar(node) {
    if (node === null) {
      return false;
    }
    if (node.kind != YamlAstParser.Kind.SCALAR) {
      return false;
    } else {
      const scalarType = YamlAstParser.determineScalarType(node);
      return scalarType == YamlAstParser.ScalarType.string;
    }
  }

  validateObject(obj, error) {
    // For robustness' sake, assume any AST node can be null
    if (obj === null || obj === undefined) {
      error.addMarkerForNode(null, 'Object has to be a map or scalar');
      return;
    }

    // Validate basic object structure
    if (obj.kind != YamlAstParser.Kind.MAP) {
      error.addMarkerForNode(obj, 'Object has to be a map or scalar');
      return;
    }

    if (obj.mappings.length != 1) {
      error.addMarkerForNode(obj, 'Object map must have only one key-value mapping');
      return;
    }

    // Validate value
    const objValue = obj.mappings[0].value;
    if (objValue !== null && (objValue.kind != YamlAstParser.Kind.SEQ && objValue.kind != YamlAstParser.Kind.SCALAR)) {
      const locationNode = objValue || obj;
      error.addMarkerForNode(locationNode, 'Object value must be sequence or scalar');
      return;
    }

    // Validate key
    const objKey = obj.mappings[0].key;
    if (!this.isStringScalar(objKey)) {
      error.addMarkerForNode(objKey, 'Object key has to be string scalar');
      return; // Can't continue because we can't determine if the feature is an attribute, reference or contained object
    } else {
      const keyParts = objKey.value.trim().split(/\s+/);
      if (keyParts.length == 0 || keyParts.length > 2) {
        error.addMarkerForNode(objKey, 'Invalid object key (must be "Type [identifier]")');
      }
    }

    // Validate attributes, references and contained objects (if object is not scalar)
    if (objValue !== null && objValue.kind == YamlAstParser.Kind.SEQ) {
      for (const map of objValue.items) {
        if (map === null) {
          error.addMarkerForNode(objValue, 'Null mapping not allowed');
          continue;
        }

        if (map.mappings === undefined || map.mappings.length != 1) {
          error.addMarkerForNode(map, 'Attribute, reference or contained object map must have 1 mapping');
          continue;
        }

        const mapping = map.mappings[0];
        const featureKey = mapping.key; // feature here means attr, ref or content
        const featureValue = mapping.value;

        if (!this.isStringScalar(featureKey)) {
          error.addMarkerForNode(featureKey, 'Attribute, reference or contained object key has to be string scalar');
          continue;
        }
        const keyParts = featureKey.value.trim().split(/\s+/);
        if (keyParts.length == 0 || keyParts.length > 2) {
          error.addMarkerForNode(featureKey, 'Invalid object key (must be "Type [identifier]")');
          continue;
        }

        if (isUpper(featureKey.value.trim()[0])) {
          // Contained Object
          this.validateObject(map, error);
        } else {
          if (!this.isStringScalar(featureKey)) {
            error.addMarkerForNode(featureKey, 'Attribute, reference or contained object key must be string scalar');
          }

          if (featureKey.value.trim().endsWith('>')) {
            // Reference
            const keyParts = featureKey.value.trim().split('>');
            if (keyParts.length > 1) {
              // reference
              if (keyParts.length > 2) {
                error.addMarkerForNode(featureKey, 'Invalid reference key (too many ">")');
              }

              if (!this.isStringScalar(featureValue)) {
                error.addMarkerForNode(featureValue, 'Reference specification must be string scalar');
              }
            }
          } else {
            // Attribute
            // TODO test null value: is scalar in yaml ast or just null?
            if (featureValue === null || featureValue.kind != YamlAstParser.Kind.SCALAR) {
              const locationNode = featureValue || mapping;
              error.addMarkerForNode(locationNode, 'Attribute has to be scalar');
            }
          }
        }
      }
    }
  }

  loadFromFile(filename) {
    throw new Error('Not implemented');
  }
  loadFromData(data, sourceLocation=null) {
    let obj = YamlAstParser.load(data);
    const lineColumnFinder = new LineColumnFinder(data, { origin: 0 });
    const error = new OYAMLParsingException(lineColumnFinder);

    if (obj === undefined) {
      obj = { kind: YamlAstParser.Kind.SEQ, items: [] };
    } else {

      for (const e of obj.errors) {
        let location = [[0, 0], [0, 0]]
        if (e.name == 'YAMLException') {
          location = [[e.mark.line + 1, e.mark.column + 1], [e.mark.line + 1, e.mark.column + 1]];
        }
        error.addMarkerAtLocation(location, e.reason);
      }

      if (obj.kind != YamlAstParser.Kind.SEQ) {
        error.addMarkerAtLocation([[0, 0], [0, 0]], 'Root has to be Array');
      }
    }

    if (error.hasMarkers) {
      throw error;
    }

    const rootWrapper = {
      kind: YamlAstParser.Kind.MAP,  // Mock of YamlMap<Mapping<Scalar,Seq<Map, ...>>> from yaml-ast-parser
      mappings: [
        {
          kind: YamlAstParser.Kind.MAPPING,
          key: {
            kind: YamlAstParser.Kind.SCALAR,
            value: 'Root root'
          },
          value: obj
        }
      ]
    };

    this.validateObject(rootWrapper, error);
    if (error.hasMarkers) {
      throw error;
    }
    return new OYAMLObjectFactory().getObjectModel(rootWrapper, rootWrapper, lineColumnFinder, sourceLocation);
  }
}

module.exports = {
  'CenteredModel': CenteredModel,
  'AbstractJSObjectLoader': AbstractJSObjectLoader,
  'AbstractOYAMLObjectLoader': AbstractOYAMLObjectLoader,
  'ObjectModel': ObjectModel
 };
