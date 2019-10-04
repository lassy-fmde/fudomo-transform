#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ArgumentParser = require('argparse').ArgumentParser;
const { Transformation, getFudomoParser } = require('./ast.js');
const generateSkeletonModule = require('./skeleton-generate.js').generateSkeletonModule;

var argumentParser = new ArgumentParser({ version: '0.1.0', addHelp: true, description: 'Generate decomposition function skeletons' });
argumentParser.addArgument('decomposition', { help: 'decomposition file' });
var args = argumentParser.parseArgs();

const transformationSource = fs.readFileSync(process.argv[2], 'utf-8');
const transformation = new Transformation(transformationSource, path.resolve(process.argv[2]));
if (transformation.hasError) {
  console.error('Transformation has syntactical error.');
  process.exit(1);
}

console.log(generateSkeletonModule(transformation));
