#!/usr/bin/node

const path = require('path');
const fs = require('fs');
const util = require('util');
const YamlAstParser = require('yaml-ast-parser');
const VM = require('vm2').VM;
const assert = require('assert');

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

  get scalar() {
    throw new Error('Not implemented');
  }

  get type() {
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
  constructor(obj) {
    super();
    if (Array.isArray(obj)) {
      throw new Error('Can not create JSObject for Array');
    }
    this.obj = obj;
  }

  get scalar() {
    return this.obj; // TODO ???
  }

  get type() {
    return this.obj.constructor.name;
  }

  /* Returns JSObject wrapper of value referred to by given name,
     or an Array of JSObjects if the value is an Array, or the value itself
     if it is of a primitive type.
   */
  getFeature(name) {
    const value = this.obj[name];
    if (Array.isArray(value)) {
      return value.map(o => new JSObject(o));
    } else if (isObject(value)) {
      return new JSObject(value);
    } else {
      return value;
    }
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
  constructor(obj, root) {
    assert(obj.kind == YamlAstParser.Kind.MAP);
    assert(root.kind == YamlAstParser.Kind.MAP);
    assert(obj.mappings[0].value.kind == YamlAstParser.Kind.SEQ || obj.mappings[0].value.kind == YamlAstParser.Kind.SCALAR, `Kind was unexpectedly ${obj.mappings[0].value.kind}`);
    super();
    this.obj = obj;
    this.root = root;
  }

  get id() {
    const key = this.obj.mappings[0].key.value;
    const parts = key.split(/\s+/);
    if (parts.length == 1) {
      return undefined;
    }
    return parts[1];
  }

  get scalar() {
    assert(this.obj.mappings[0].value.kind === YamlAstParser.Kind.SCALAR);
    return this.wrapValue(this.obj.mappings[0].value);
  }

  get structureSeq() {
    return this.obj.mappings[0].value;
  }

  get type() {
    const key = this.obj.mappings[0].key.value;
    return key.split(' ').slice(0, 1)[0];
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
          return new OYAMLObject(value, this.root);
        }
    } else {
      return value;
    }
  }

  getFeature(name) {

    let value = undefined;
    if (name === 'cont') {
      if (this.obj.mappings[0].value.kind == YamlAstParser.Kind.SCALAR) {
        return [];
      }
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
            const referredObject = new OYAMLObject(this.root, this.root).getObjectById(refId);
            if (referredObject === undefined) {
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
  loadFromData(data) {
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
    delete require.cache[require.resolve(path.resolve(filename))];
    const data = require(path.resolve(filename));
    return this.loadFromData(data);
  }
  loadFromData(data) {
    if (Array.isArray(data)) {
      throw new Error("Root has to be Object, not Array");
    }
    return new JSObject(new Root(data));
  }
}

class OYAMLObjectLoader extends Loader {
  loadFromFile(filename) {
    const data = fs.readFileSync(filename, 'utf-8');
    return this.loadFromData(data);
  }
  loadFromData(data) {
    const obj = YamlAstParser.load(data);
    if (obj.kind != YamlAstParser.Kind.SEQ) {
      throw new Error("Root has to be Array");
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
    return new OYAMLObject(rootWrapper, rootWrapper);
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
  return loader.getRootCenteredModel(objectModel);
}

module.exports = {
  'loadModel': loadModel,
  'loaders': loaders,
  'CenteredModel': CenteredModel,
  'ObjectModel': ObjectModel
 };
