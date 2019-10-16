class JSSkeletonGenerator {
  generateSkeleton(transformation) {
    let res = 'module.exports = {\n';

    for (var decomposition of transformation.decompositions) {
      const funcName = decomposition.function.type + '_' + decomposition.function.name;

      var params = [];
      for (var link of decomposition.links) {
        params.push(link.parameterName);
      }

      res += '  /**\n';
      res += `   * ${decomposition.function.qualifiedName}:\n`;
      if (decomposition.comment) {
        res += '   * ' + decomposition.comment.split('\n').join('   * ') + '\n';
      }
      for (var link of decomposition.links) {
        const type = link.parameterTypeDescription;
        if (type) {
          res += `   * @param ${link.parameterName} {${type}} ${link.parameterDescription}\n`;
        } else {
          res += `   * @param ${link.parameterName} ${link.parameterDescription}\n`;
        }
      }
      res += '   */\n';

      const paramsStr = params.join(', ');
      res += `  ${funcName}: function(${paramsStr}) {\n`;
      res += `    throw new Error('function ${funcName}(${paramsStr}) not yet implemented'); // TODO\n`;
      res += '  },\n\n';
    }

    res += '};\n';
    return res;
  }
}

class PythonSkeletonGenerator {
  generateSkeleton(transformation) {
    let res = '';

    for (var decomposition of transformation.decompositions) {
      const funcName = decomposition.function.type + '_' + decomposition.function.name;

      var params = decomposition.links.map(link => link.parameterName);

      res += `def ${funcName}(${params.join(', ')}):\n`;
      let commentContent = '';
      if (decomposition.comment) {
        commentContent += `${decomposition.comment.split('\n').join('\n    ')}\n`;
      } else {
        commentContent = '\n';
      }

      for (var link of decomposition.links) {
        if (commentContent.endsWith('\n')) {
          commentContent += '    '
        }
        commentContent += `:param ${link.parameterName}: ${link.parameterDescription}\n`;
        const type = link.parameterTypeDescription;
        if (type) {
          commentContent += `    :type  ${link.parameterName}: ${type}\n`;
        }
      }

      if (commentContent.trim()) {
        res += `    """${commentContent}    """\n`;
      }

      res += `    raise NotImplementedError('function ${funcName} not yet implemented') # TODO\n\n`;
    }

    return res.trim() + '\n';
  }
}

const SKELETON_GENERATORS_BY_ID = {
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
