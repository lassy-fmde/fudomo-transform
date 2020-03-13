const { AbstractJSObjectLoader, AbstractOYAMLObjectLoader, CenteredModel } = require('./model-io.js');
const { importModule } = require('./runners-browser.js');

/*
const YamlAstParser = require('yaml-ast-parser');
const VM = require('vm2').VM;
const assert = require('assert');
const LineColumnFinder = require('line-column');
*/

class JSObjectLoader extends AbstractJSObjectLoader {

  loadFromSource(source) {
    const promise = importModule(source);
    return this.loadFromData(promise);
  }

  loadFromData(data, sourceLocation=null) {
    if (Array.isArray(data)) {
      throw new Error("Root has to be Object, not Array");
    }
    return new JSObjectFactory().getObjectModel(new Root(data), sourceLocation);
  }
}

class OYAMLObjectLoader extends AbstractOYAMLObjectLoader {

  loadFromSource(source) {
    return this.loadFromData(source);
  }
}

var loaders = {
  js: new JSObjectLoader(),
  yaml: new OYAMLObjectLoader(),
  oyaml: new OYAMLObjectLoader()
};

module.exports = {
  'loaders': loaders,
  'CenteredModel': CenteredModel
 };
