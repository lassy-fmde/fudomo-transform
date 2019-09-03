#!/usr/bin/node

const path = require('path');
const fs = require('fs');
const util = require('util');
const YAML = require('yaml');
const VM = require('vm2').VM;

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

class OYAMLObject extends ObjectModel {
  constructor(obj, root) {
    super();
    this.obj = obj;
    this.root = root;
  }

  get id() {
    const key = Object.keys(this.obj)[0];
    const parts = key.split(/\s+/);
    if (parts.length == 1) {
      return undefined;
    }
    return parts[1];
  }

  get structure() {
    const key = Object.keys(this.obj)[0];
    return this.obj[key];
  }

  get scalar() {
    return this.obj[this.type];
  }

  get type() {
    const key = Object.keys(this.obj)[0];
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

  getFeature(name) {
    const objStructure = this.structure;
    if (!isObject(objStructure)) {
      // Scalar
      return undefined;
    }

    let value = undefined;
    if (name === 'cont') {
       value = objStructure.slice(1);
    } else {
      let attrsAndRefs = objStructure[0] || {};

      if (name in attrsAndRefs) {
        // Simple attribute, try direct lookup by name
        value = attrsAndRefs[name];
      } else {
        // Iterate over attributes and refs to find if there is a ref with the right name.
        // TODO pre-compute ref names on demand for efficient lookup.
        var references = null;
        for (const key of Object.keys(attrsAndRefs)) {
          const refName = this._stripRefMarker(key);
          if (refName == name) {
            references = attrsAndRefs[key];
            break;
          }
        }

        // Gather referred-to objects
        value = [];
        if (references) {
          for (const rawRefId of references.split(',')) {
            const refId = rawRefId.trim();
            const referredObject = new OYAMLObject(this.root, this.root).getObjectById(refId);
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
      }
    }

    if (Array.isArray(value)) {
      value = value.map(o => new OYAMLObject(o, this.root));
    } else if (isObject(value)) {
      value = new OYAMLObject(value, this.root);
    }
    return value;
  }

  get featureNames() {
    const objStructure = this.structure;
    if (!isObject(objStructure)) {
      // Scalar
      return [];
    }
    let attrsAndRefs = objStructure[0] || {};
    return Object.keys(attrsAndRefs).map(key => this._stripRefMarker(key)).concat(['cont']);
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
    const obj = YAML.parse(data);
    if (!Array.isArray(obj)) {
      throw new Error("Root has to be Array");
    }
    const rootWrapper = { 'Root root': [[], ...obj] };
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

module.exports = { 'loadModel': loadModel, 'loaders': loaders, 'CenteredModel': CenteredModel };
