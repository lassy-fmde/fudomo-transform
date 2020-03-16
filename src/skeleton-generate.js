class CommentFormatter {
  constructor(commentStart, commentEnd, lineIndent, maxLineLength) {
    this.commentStart = commentStart;
    this.commentEnd = commentEnd;
    this.lineIndent = lineIndent;
    this.maxLineLength = maxLineLength;
    this.lines = [];
  }

  wrapTextWithPrefix(prefix, text) {
    const longestPrefixLine = Math.max(...prefix.split('\n').map(l => l.length));
    const maxWidth = this.maxLineLength - this.lineIndent.length - longestPrefixLine;
    if (maxWidth <= 0) {
      // Prefix eats up all space, fall back to some "safe" line length
      return this.wrapText(prefix, 79).wrapText(text, 79);
    }
    const wrappedTextLines = this._wrapText(text, maxWidth);
    const prefixIndent = ' '.repeat(longestPrefixLine);
    this.lines.push(prefix + wrappedTextLines[0], ...wrappedTextLines.slice(1).map(l => prefixIndent + l));
    return this;
  }

  wrapText(text) {
    let maxWidth = this.maxLineLength - this.lineIndent.length;
    if (maxWidth <= 0) {
      maxWidth = 2; // Clamp
    }
    const wrappedTextLines = this._wrapText(text, maxWidth);
    this.lines.push(...wrappedTextLines);
    return this;
  }

  _wrapText(text, maxWidth) {
    let res = [];
    for (const line of text.split('\n')) {
      if (line.length < maxWidth) {
        res.push(line);
      } else {
        const left = line.slice(0, maxWidth);
        const right = line.slice(maxWidth);

        let lastSpaceInLeft = left.lastIndexOf(' ');
        if (lastSpaceInLeft == -1) {
          // No space character found, split arbitrarily :(
          lastSpaceInLeft = maxWidth - 1;
        }
        const lastWordPartInLeft = left.slice(lastSpaceInLeft);

        const startOfLine = left.slice(0, lastSpaceInLeft);
        const wrappedRemainderOfLine = (lastWordPartInLeft + right).trimStart();

        res.push(startOfLine);
        res.push(...this._wrapText(wrappedRemainderOfLine, maxWidth));
      }
    }
    return res;
  }

  toString() {
    if (this.commentStart.endsWith('\n')) {
      // CommentStart ends with newline, following lines are all the same
      return this.commentStart + this.lines.map(l => this.lineIndent + l).join('\n') + this.commentEnd;
    } else {
      // CommentStart does not end with newline, add first line to it and handle it like an already-indented line
      return [this.commentStart + this.lines[0], ...this.lines.slice(1).map(l => this.lineIndent + l)].join('\n') + this.commentEnd;
    }
  }
}

class SkeletonGenerator {
  constructor(prefix, separator, suffix) {
    this.prefix = prefix;
    this.separator = separator;
    this.suffix = suffix;
  }

  generateSkeleton(transformation) {
    let res = this.prefix;

    const decompositionSkeletons = transformation.decompositions.map(this.generateDecompositionFunction);
    res += decompositionSkeletons.join(this.separator);

    res += this.suffix;
    return res;
  }

  generateDecompositionFunction(decomposition) {
    throw new Error('Not implemented');
  }

  // Return an object that can be used by a Runner to validate function definitions.
  // This default implementation does not provide type information, only function
  // name and parameter names.
  // This default implementation should be overridden if necessary.
  getFunctionValidationCriteria(transformation) {
    const res = [];
    for (const decomposition of transformation.decompositions) {
      const funcName = decomposition.function.type + '_' + decomposition.function.name;
      var params = decomposition.links.map(link => link.parameterName);
      res.push({'functionName': funcName, 'parameters': params, 'decompositionQualifiedName': decomposition.function.qualifiedName});
    }
    return res;
  }
}

class JSSkeletonGenerator extends SkeletonGenerator {
  constructor() {
    super('module.exports = {\n', '\n\n', '\n};\n');
  }

  generateDecompositionFunction(decomposition) {

    const fmt = new CommentFormatter('  /**\n', '\n   */', '   * ', 79);

    const funcName = decomposition.function.type + '_' + decomposition.function.name;

    var params = decomposition.links.map(link => link.parameterName);

    fmt.wrapText(decomposition.function.qualifiedName);
    if (decomposition.comment) {
      fmt.wrapText(decomposition.comment);
    }

    const links = decomposition.links;
    for (const index of Object.keys(links)) {
      const link = links[index];
      const type = link.parameterTypeDescription;
      if (type) {
        fmt.wrapTextWithPrefix(`@param ${link.parameterName} {${type}} `, link.parameterDescription);
      } else {
        fmt.wrapTextWithPrefix(`@param ${link.parameterName} `, link.parameterDescription);
      }
    }

    let res = fmt.toString();
    res += '\n';

    const paramsStr = params.join(', ');
    res += `  ${funcName}: function(${paramsStr}) {\n`;
    res += `    throw new Error('function ${funcName}(${paramsStr}) not yet implemented'); // TODO\n`;
    res += '  },';

    return res;
  }
}

class PythonSkeletonGenerator extends SkeletonGenerator {
  constructor() {
    super('', '\n\n\n', '');
  }

  generateDecompositionFunction(decomposition) {

    const fmt = new CommentFormatter('    """', '\n    """\n', '    ', 79);

    const funcName = decomposition.function.type + '_' + decomposition.function.name;

    var params = decomposition.links.map(link => link.parameterName);

    let res = `def ${funcName}(${params.join(', ')}):\n`;

    fmt.wrapText(decomposition.function.qualifiedName);

    if (decomposition.comment) {
      fmt.wrapText(decomposition.comment);
    }

    for (var link of decomposition.links) {
      fmt.wrapTextWithPrefix(`:param ${link.parameterName}: `, `${link.parameterDescription}`)
      const type = link.parameterTypeDescription;
      if (type) {
        fmt.wrapTextWithPrefix(`:type  ${link.parameterName}: `, `${type}`);
      }
    }

    res += fmt.toString()
    res += `    raise NotImplementedError('function ${funcName} not yet implemented')  # TODO`;

    return res.trim();
  }
}

const SKELETON_GENERATORS_BY_ID = {
  javascript: JSSkeletonGenerator,
  js: JSSkeletonGenerator,
  python: PythonSkeletonGenerator
};

const SKELETON_GENERATORS = [
  {
    id: 'js',
    name: 'Javascript',
    extension: 'js'
  },
  {
    id: 'python',
    name: 'Python 3',
    extension: 'py'
  }
];

module.exports = {
  getSkeletonGenerator: function(languageId) {
    const Generator = SKELETON_GENERATORS_BY_ID[languageId];
    if (Generator == undefined) {
      return null;
    }
    return new Generator();
  },

  SKELETON_GENERATORS: SKELETON_GENERATORS
};
