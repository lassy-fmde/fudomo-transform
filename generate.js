#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { ArgumentParser } = require('argparse');
const { Transformation, getFudomoParser } = require('./ast.js');
const { getSkeletonGenerator, SKELETON_GENERATORS } = require('./skeleton-generate.js');

const langIds = SKELETON_GENERATORS.map(g => g.id).join(' or ');
var argumentParser = new ArgumentParser({ version: '0.1.0', addHelp: true, description: 'Generate decomposition function skeletons' });
argumentParser.addArgument(['-l', '--lang'], { type: String, nargs: '1', default: 'js', help: `language identifier (${langIds})`});
argumentParser.addArgument('decomposition', { help: 'decomposition file' });
var args = argumentParser.parseArgs();

const generator = getSkeletonGenerator(args.lang);
if (generator == undefined) {
  console.error(`Unknown language "${args.lang}."`);
  process.exit(2);
}

const transformationSource = fs.readFileSync(args.decomposition, 'utf-8');
const transformation = new Transformation(transformationSource, path.resolve(args.decomposition));
if (transformation.hasError) {
  console.error('Transformation has syntactical error.');
  process.exit(1);
}

console.log(generator.generateSkeleton(transformation));
