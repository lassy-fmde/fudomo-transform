
function getFudomoParser() {
  const nearley = require("nearley");
  const grammar = require("./fudomo-grammar.js");
  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
  return parser;
}

class ASTNode {
  constructor(parent) {
    this.parent = parent;
  }

  get transformation() {
    let i = this;
    while (!(i instanceof Transformation)) {
      i = i.parent;
    }
    return i;
  }

  get decomposition() {
    let i = this;
    while (!(i instanceof Decomposition)) {
      i = i.parent;
    }
    return i;
  }
}

class Link extends ASTNode {
  constructor(parent, node, kind) {
    super(parent);
    this.node = node;
    this.kind = kind;
  }
}

class LocalLink extends Link {

  constructor(parent, node) {
    super(parent, node, 'local');
  }

  get parameterName() {
    return this.function.name;
  }

  get parameterDescription() {
    const name = this.parameterName;
    if (name === 'center') {
      return `This ${this.decomposition.function.type}`;
    }
    if (name === 'val') {
      return `The value of this ${this.decomposition.function.type}`;
    }
    return `The "${name}" of this ${this.decomposition.function.type}`;
  }

  get parameterTypeDescription() {
    return null;
  }

  get function() {
    return new UntypedFunction(this, this.node.reference);
  }

  toString() {
    return this.function.name;
  }
}

class ForwardLink extends Link {

  constructor(parent, node) {
    super(parent, node, 'forward');
  }

  get parameterName() {
    return this.referenceName + '_' + this.function.type + '_' + this.function.name;
  }

  get referenceName() {
    return this.node.reference;
  }

  get referenceLocation() {
    return [this.node.location[0], [this.node.location[0][0], this.node.location[0][0] + this.referenceName.length]];
  }

  get parameterDescription() {
    if (this.referenceName === 'cont') {
      return `The sequence of ${this.function.pluralValueDescription} contained in this ${this.decomposition.function.type}`;
    } else {
      return `The sequence of ${this.function.pluralValueDescription} referred to by attribute "${this.referenceName}" in this ${this.decomposition.function.type}`;
    }
  }

  get parameterTypeDescription() {
    return 'Array';
  }

  get function() {
    return new TypedFunction(this, this.node.typedFunction);
  }

  toString() {
    return `${this.referenceName} -> ${this.function.qualifiedName}`;
  }
}

class ReverseLink extends Link {

  constructor(parent, node) {
    super(parent, node, 'reverse');
  }

  get parameterName() {
    return '_' + this.referenceName + '_' + this.function.type + '_' + this.function.name;
  }

  get referenceName() {
    return this.node.reference;
  }

  get parameterDescription() {
    if (this.referenceName === 'cont') {
      return `The set of ${this.function.pluralValueDescription} that contain this ${this.decomposition.function.type}`;
    } else {
      return `The set of ${this.function.pluralValueDescription} that refer to this ${this.decomposition.function.type} by attribute "${this.referenceName}"`;
    }
  }

  get parameterTypeDescription() {
    return 'Set';
  }

  get function() {
    return new TypedFunction(this, this.node.typedFunction);
  }

  toString() {
    return `${this.referenceName} <- ${this.function.qualifiedName}`;
  }
}

class Function extends ASTNode {

  constructor(parent) {
    super(parent);
  }

  get name() {
    /* istanbul ignore next */
    throw new Error('Not implemented');
  }

  getTargetDecomposition(centeredModel) {
    /* istanbul ignore next */
    throw new Error('Not implemented');
  }
}

class UntypedFunction extends Function {
  constructor(parent, node) {
    super(parent);
    this.node = node;
  }

  get qualifiedName() {
    return this.name;
  }

  get name() {
    return this.node;
  }

  getTargetDecomposition(centeredModel) {
    const containingDecomposition = this.decomposition;
    const containingTransformation = this.transformation;

    const targetType = containingDecomposition.function.type;
    let targetFunctionName = this.name;

    return containingTransformation.getDecompositionBySignature(targetType + '.' + targetFunctionName);
  }
}

class TypedFunction extends Function {
  constructor(parent, node) {
    super(parent);
    this.node = node;
  }

  getTargetDecomposition(centeredModel) {
    if (this.isAbstract) {
      return this.transformation.getDecompositionBySignature(centeredModel.type + '.' + this.name);
    }
    return this.transformation.getDecompositionBySignature(this.qualifiedName);
  }

  get isAbstract() {
    return this.type == 'Object';
  }

  get name() {
    return this.node.untypedFunction;
  }

  get pluralValueDescription() {
    let pluralValueDescription = `"${this.name}" values of ${this.type} objects`;
    if (this.name === 'center') {
      pluralValueDescription = `${this.type} objects`;
    } else if (this.name === 'val') {
      pluralValueDescription = `${this.type} scalar values`;
    }
    return pluralValueDescription;
  }

  get type() {
    return this.node.type;
  }

  get qualifiedName() {
    return this.type + '.' + this.name;
  }

  get externalName() {
    return this.type + '_' + this.name;
  }

  get typeLocation() {
    return [this.node.location[0], [this.node.location[0][0], this.node.location[0][1] + this.type.length]];
  }
}

class Decomposition extends ASTNode {
  constructor(parent, node) {
    super(parent);
    this.node = node;
  }

  get function() {
    return new TypedFunction(this, this.node.typedFunction);
  }

  get links() {
    var res = [];
    for (var link of this.node.links) {
      if (link.type == 'local') {
        res.push(new LocalLink(this, link));
      } else if (link.type == 'forward') {
        res.push(new ForwardLink(this, link));
      } else { // reverse
        res.push(new ReverseLink(this, link));
      }
    }
    return res;
  }

  get comment() {
    return this.node.comment;
  }
}

class Transformation extends ASTNode {
  constructor(source, sourceLocation=null) {
    super(null);
    this.sourceLocation = sourceLocation;
    const parser = getFudomoParser();
    try {
      parser.feed(source);
      this.tree = parser.results[0];
    } catch(parseError) {
      this.parseError = parseError;
      if (this.parseError.token == undefined) {
        // Error from tokenizer
        this.parseError.token = { offset: 0 };
      }
    }
  }

  get hasError() {
    return this.parseError != undefined;
  }

  get errors() {
    const results = [];
    if (this.parseError) {
      results.push({
        startOffset: this.parseError.token.offset,
        endOffset: this.parseError.token.offset + 1,
        severity: 'error',
        excerpt: this.parseError.toString()
      });
    }
    return results;
  }

  get decompositions() {
    return this.tree.decompositions.map(entry => new Decomposition(this, entry));
  }

  getDecompositionBySignature(signature) {
    return this.decompositions.find(d => d.function.qualifiedName == signature);
  }

    return null;
  }
}

module.exports = {
  Transformation: Transformation,
  getFudomoParser: getFudomoParser
}
