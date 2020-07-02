const lineColumn = require('line-column');

function getFudomoParser() {
  const nearley = require("nearley");
  const grammar = require("./fudomo-grammar.js");
  const parser = new nearley.Parser(nearley.Grammar.fromCompiled(grammar));
  return parser;
}

class CharacterRange {
  constructor(startCol, startRow, endCol, endRow) {
    this.startCol = startCol;
    this.startRow = startRow;
    this.endCol = endCol;
    this.endRow = endRow;
  }

  static fromOffsets(source, startOffset, endOffset) {
    const lc = lineColumn(source);
    const startPos = lc.fromIndex(startOffset);
    const endPos = lc.fromIndex(endOffset) || lc.fromIndex(source.length - 1);
    return new CharacterRange(startPos.col - 1, startPos.line - 1, endPos.col - 1, endPos.line - 1);
  }

  contains(column, row) {
    if (row < this.startRow) return false;
    if (row > this.endRow) return false;

    if (row == this.startRow) {
      return column >= this.startCol;
    } else if (row == this.endRow) {
      return column <= this.endCol;
    } else {
      return true;
    }
  }

  toArray() {
    return [[this.startRow, this.startCol], [this.endRow, this.endCol]];
  }

  toString() {
    return `<CharacterRange startCol=${this.startCol} startRow=${this.startRow} endCol=${this.endCol} endRow=${this.endCol}>`;
  }
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

  get location() {
    return [this.node.location[0], [this.node.location[1][0], this.node.location[1][1]]];
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
    return 'Sequence';
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

  get location() {
    return this.node.location;
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

  get characterRange() {
    const loc = this.node.location;
    return new CharacterRange(loc[0][1], loc[0][0], loc[1][1], loc[1][0]);
  }
}

class Transformation extends ASTNode {
  constructor(source, sourceLocation=null) {
    super(null);
    this.source = source;
    this.sourceLocation = sourceLocation;
    const parser = getFudomoParser();
    try {
      parser.feed(source);
      if (parser.results.length > 0) {
        this.tree = parser.results[0];
      } else {
        const e = new Error('Can not parse decomposition');
        e.token = { offset: source.length - source.trimLeft().length, value: source.trim() };
        throw e;
      }
    } catch(parseError) {
      this.parseError = parseError;
      if (this.parseError.token == undefined) {
        // Error from tokenizer
        this.parseError.token = { offset: 0, value: '' };
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
        location: CharacterRange.fromOffsets(this.source, this.parseError.token.offset, this.parseError.token.offset + this.parseError.token.value.length).toArray(),
        error: this.parseError,
        severity: 'error',
        message: this.parseError.toString()
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

  getDecompositionForTextCoordinate(column, row) {
    return this.decompositions.find(d => d.characterRange.contains(column, row));
  }
}

module.exports = {
  Transformation: Transformation,
  getFudomoParser: getFudomoParser
}
