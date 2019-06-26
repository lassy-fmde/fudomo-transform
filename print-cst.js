#!/usr/bin/env node

const ArgumentParser = require('argparse').ArgumentParser;
const chalk = require('chalk');
const fs = require('fs');
const { Transformation, getFudomoParser } = require('./ast.js');

var argumentParser = new ArgumentParser({ version: '0.1.0', addHelp: true, description: 'Print parsed decomposition concrete syntax tree.' });
argumentParser.addArgument('decomposition', { help: 'decomposition file' });
var args = argumentParser.parseArgs();

const parser = getFudomoParser();

function visit(node, prefix) {

  var offset = prefix.length + node.type.length + ' "'.length;
  var text = node.text.trim().replace(/\n/g, '\n' + ' '.repeat(offset));

  console.log(prefix + chalk.red.bold(node.type) + ' "' + chalk.blueBright(text) + '"');
  for (var child of node.children) {
    visit(child, prefix + '  ');
  }
};

fs.readFile(process.argv[2], "utf-8", (err, fudomoCode) => {
  const tree = parser.parse(fudomoCode);
  // See API at https://github.com/tree-sitter/node-tree-sitter/blob/master/index.js
  visit(tree.rootNode, '');
  if (tree.rootNode.hasError()) {
    console.log(chalk.red.bold('Transformation has syntactical error.'));
  }
});
