#!/usr/bin/env node

module.exports = {
  'generateSkeletonModule': function(transformation) {
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
};
