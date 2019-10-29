#!/usr/bin/node

const path = require('path');
const fs = require('fs');
const util = require('util');
const YamlAstParser = require('yaml-ast-parser');
const VM = require('vm2').VM;
const assert = require('assert');
const LineColumnFinder = require('line-column');

function isObject(obj) {
  // Checks if obj is an Object (ie. not a string, number, boolean, null, or undefined).
  // https://stackoverflow.com/a/14706877
  var type = typeof obj;
  return type === 'function' || type === 'object' && !!obj;
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

class JSObject extends ObjectModel {
  constructor(obj, sourceLocation) {
    super();
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
      return value.map(o => new JSObject(o, this.sourceLocation));
    } else if (isObject(value)) {
      return new JSObject(value, this.sourceLocation);
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

class OYAMLObject extends ObjectModel {
  constructor(obj, root, lineColumnFinder, sourceLocation) {
    assert(obj.kind == YamlAstParser.Kind.MAP);
    assert(root.kind == YamlAstParser.Kind.MAP);
    assert(obj.mappings[0].value === null || (obj.mappings[0].value.kind == YamlAstParser.Kind.SEQ || obj.mappings[0].value.kind == YamlAstParser.Kind.SCALAR, `Kind was unexpectedly ${obj.mappings[0].value.kind}`));
    super();
    this.obj = obj;
    this.root = root;
    this.lineColumnFinder = lineColumnFinder;
    this.sourceLocation = sourceLocation;
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
    const startCoord = this.lineColumnFinder.fromIndex(scalarNode.startPosition);
    const endCoord = this.lineColumnFinder.fromIndex(scalarNode.endPosition);
    return [[startCoord.line, startCoord.col], [endCoord.line, endCoord.col]];
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
      const endLoc = this.lineColumnFinder.fromIndex(this.lineColumnFinder.str.length - 1) || { line: 0, col: 0 };
      return [[0, 0], [endLoc.line, endLoc.col]];
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

  getMapValue(map, key) {
    assert(map.kind == YamlAstParser.Kind.MAP);
    let value = undefined;
    for (const mapping of map.mappings) {
      if (mapping.key.value == key) { // Assumes key is scalar
        value = mapping.value;
      }
    }
    return value;
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
          return new OYAMLObject(value, this.root, this.lineColumnFinder, this.sourceLocation);
        }
    } else {
      return value;
    }
  }

  getFeature(name) {
    if (this.obj.mappings[0].value.kind == YamlAstParser.Kind.SCALAR) {
      return name === 'cont' ? [] : null;
    }

    let value = undefined;
    if (name === 'cont') {
      const contArray = this.obj.mappings[0].value.items.slice(1);
      return this.wrapValue(contArray);
    } else {

      let attrsAndRefs = this.obj.mappings[0].value.items[0] || { kind: YamlAstParser.Kind.MAP, mappings: [] };
      assert(attrsAndRefs.kind == YamlAstParser.Kind.MAP);

      const directValue = this.getMapValue(attrsAndRefs, name);
      if (directValue !== undefined) {
        // Simple attribute
        return this.wrapValue(directValue);
      } else {
        // Iterate over attributes and refs to find if there is a ref with the right name.
        // TODO pre-compute ref names on demand for efficient lookup.
        var references = null;
        const keyStrings = attrsAndRefs.mappings.map(mapping => mapping.key.value);
        for (const key of keyStrings) {
          const refName = this._stripRefMarker(key);
          if (refName == name) {
            const referencesScalar = this.getMapValue(attrsAndRefs, key); // comma-separated string
            assert(referencesScalar.kind == YamlAstParser.Kind.SCALAR);
            references = referencesScalar.value;
            break;
          }
        }

        // Gather referred-to objects
        value = [];
        if (references) {
          for (const rawRefId of references.split(',')) {
            const refId = rawRefId.trim();
            const referredObject = new OYAMLObject(this.root, this.root, this.lineColumnFinder, this.sourceLocation).getObjectById(refId);
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
    let attrsAndRefs = this.obj.mappings[0].value.items[0] || { kind: YamlAstParser.Kind.MAP, mappings: [] };
    for (const keyNode of attrsAndRefs.mappings.map(mapping => mapping.key)) {
      const refName = this._stripRefMarker(keyNode.value);
      if (refName == featureName) {
        const { line, col } = this.lineColumnFinder.fromIndex(keyNode.startPosition);
        return [[line, col], [line, col + refName.length]]
      }
    }
    return [[0, 0], [0, 0]];
  }

  getFeatureValueLocation(featureName) {
    let attrsAndRefs = this.obj.mappings[0].value.items[0] || { kind: YamlAstParser.Kind.MAP, mappings: [] };
    for (const mapping of attrsAndRefs.mappings) {
      const refName = this._stripRefMarker(mapping.key.value);
      if (refName == featureName) {
        const startCoord = this.lineColumnFinder.fromIndex(mapping.value.startPosition);
        const endCoord = this.lineColumnFinder.fromIndex(mapping.value.endPosition);
        return [[startCoord.line, startCoord.col], [endCoord.line, endCoord.col]]
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
    let attrsAndRefs = objStructure.items[0] || { kind: YamlAstParser.Kind.MAP, mappings: [] };
    const result = attrsAndRefs.mappings.map(mapping => this._stripRefMarker(mapping.key.value));
    //const result = Object.keys(attrsAndRefs).map(key => this._stripRefMarker(key));
    if (objStructure.items.length > 1) {
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

class JSObjectLoader extends Loader {
  loadFromFile(filename) {
    /* Note: data provided through JS code should not be loaded/run in the current
       runtime (eg. in Atom). To isolate it, use the vm2 jail/sandbox. Unfortunately,
       there's currently a bug preventing this from working. See
       https://github.com/patriksimek/vm2/issues/214

    const source = fs.readFileSync(path.resolve(filename), 'utf-8');
    const vm = new VM({
        sandbox: { 'module': {} }
    });
    const data = vm.run(source);
    */

    // Delete module from cache if it was loaded before. This won't be necessary
    // when vm2 will be used.
    const absFilename = path.resolve(filename);
    delete require.cache[require.resolve(absFilename)];
    const data = require(absFilename);
    return this.loadFromData(data, absFilename);
  }
  loadFromData(data, sourceLocation=null) {
    if (Array.isArray(data)) {
      throw new Error("Root has to be Object, not Array");
    }
    return new JSObject(new Root(data), sourceLocation);
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
      const startCoord = this.lineColumnFinder.fromIndex(node.startPosition) || { line: 0, col: 0 };
      const endCoord = this.lineColumnFinder.fromIndex(node.endPosition) || { line: 0, col: 0 };
      const location = [[startCoord.line, startCoord.col], [endCoord.line, endCoord.col]];
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

class OYAMLObjectLoader extends Loader {
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
    if (obj === null) {
      error.addMarkerForNode(null, 'Object has to be a map');
      return;
    }

    // Validate basic object structure
    if (obj.kind != YamlAstParser.Kind.MAP) {
      error.addMarkerForNode(obj, 'Object has to be a map');
      return;
    }
    if (obj.mappings.length != 1) {
      error.addMarkerForNode(obj, 'Object map must have only one key-value mapping');
      return;
    }

    // Validate key
    const key = obj.mappings[0].key;
    if (!this.isStringScalar(key)) {
      error.addMarkerForNode(key, 'Object key has to be string scalar');
    } else {
      const keyParts = key.value.trim().split(/\s+/);
      if (keyParts.length == 0 || keyParts.length > 2) {
        error.addMarkerForNode(key, 'Invalid object key (must be "Type [identifier]")');
      }
    }

    // Validate value
    const value = obj.mappings[0].value;
    if (value !== null && (value.kind != YamlAstParser.Kind.SEQ && value.kind != YamlAstParser.Kind.SCALAR)) {
      const locationNode = value || obj;
      error.addMarkerForNode(locationNode, 'Object value must be sequence or scalar');
      return;
    }

    // Validate attributes and references (if object is not scalar)
    if (value !== null && value.kind == YamlAstParser.Kind.SEQ) {
      if (value.items.length > 0) {
        const attrsAndRefs = value.items[0];
        if (attrsAndRefs.kind != YamlAstParser.Kind.MAP) {
          error.addMarkerForNode(attrsAndRefs, 'Attributes and references must be defined in map');
        } else {
          for (const mapping of attrsAndRefs.mappings) {
            if (!this.isStringScalar(mapping.key)) {
              error.addMarkerForNode(mapping.key, 'Attribute or reference key must be string scalar');
            } else {
              const keyParts = mapping.key.value.trim().split('>');
              if (keyParts.length > 1) {
                // reference
                if (keyParts.length > 2) {
                  error.addMarkerForNode(mapping.key, 'Invalid reference key (too many ">")');
                }

                if (!this.isStringScalar(mapping.value)) {
                  error.addMarkerForNode(mapping.value, 'Reference specification must be string scalar');
                }

              } else {
                // attribute
                if (mapping.value === null || mapping.value.kind != YamlAstParser.Kind.SCALAR) {
                  const locationNode = mapping.value || mapping;
                  error.addMarkerForNode(locationNode, 'Attribute has to be scalar');
                }
              }
            }
          }
        }
      }

      // Validate contained objects
      if (value.items.length > 1) {
        for (const o of value.items.slice(1)) {
          this.validateObject(o, error);
        }
      }
    }
  }

  loadFromFile(filename) {
    const data = fs.readFileSync(filename, 'utf-8');
    return this.loadFromData(data, filename);
  }
  loadFromData(data, sourceLocation=null) {
    let obj = YamlAstParser.load(data);
    const lineColumnFinder = new LineColumnFinder(data, { origin: 0 });
    const error = new OYAMLParsingException(lineColumnFinder);

    if (obj === undefined) {
      obj = { items: [] };
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
          value: {
            kind: YamlAstParser.Kind.SEQ,
            items: [
              {
                kind: YamlAstParser.Kind.MAP,
                mappings: [] // Attributes and references
              },
              ...obj.items   // Contained objects
            ]
          }
        }
      ]
    };

    this.validateObject(rootWrapper, error);
    if (error.hasMarkers) {
      throw error;
    }
    if (sourceLocation !== null) {
      sourceLocation = path.resolve(sourceLocation);
    }
    return new OYAMLObject(rootWrapper, rootWrapper, lineColumnFinder, sourceLocation);
  }
}

var loaders = {
  js: new JSObjectLoader(),
  yaml: new OYAMLObjectLoader(),
  oyaml: new OYAMLObjectLoader()
};

function loadModel(filename) {
  const extension = filename.split('.').pop();
  const loader = loaders[extension];
  if (loader == undefined) {
    throw new Error(`No loader found for extension "${extension}"`);
  }
  const objectModel = loader.loadFromFile(filename);
  // TODO validate? return markers if invalid?
  return loader.getRootCenteredModel(objectModel);
}

module.exports = {
  'loadModel': loadModel,
  'loaders': loaders,
  'CenteredModel': CenteredModel,
  'ObjectModel': ObjectModel
 };
