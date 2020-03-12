const path = require('path');
const fs = require('fs');
const util = require('util');
const YamlAstParser = require('yaml-ast-parser');
const VM = require('vm2').VM;
const assert = require('assert');
const LineColumnFinder = require('line-column');
const { AbstractJSObjectLoader, AbstractOYAMLObjectLoader } = require('./model-io.js');

class JSObjectLoader extends AbstractJSObjectLoader {
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
}


class OYAMLObjectLoader extends AbstractOYAMLObjectLoader {

  loadFromFile(filename) {
    const data = fs.readFileSync(filename, 'utf-8');
    const absFilename = path.resolve(filename);
    return this.loadFromData(data, absFilename);
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
 };
