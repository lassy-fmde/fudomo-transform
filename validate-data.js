#!/usr/bin/env node

const ArgumentParser = require('argparse').ArgumentParser;

const { DataValidator } = require('./metamodel.js');
const { Transformation } = require('./ast.js');
const { loadModel, loaders, CenteredModel, ObjectModel } = require('./model-io.js');

const chalk = require('chalk');
const fs = require('fs');
const YAML = require('yaml');

var argumentParser = new ArgumentParser({ version: '0.1.0', addHelp: true, description: 'Validate Fudomo data file wrt. metamodel.' });
argumentParser.addArgument('metamodel', { help: 'metamodel yaml file' });
argumentParser.addArgument('data', { help: 'data file' });
var args = argumentParser.parseArgs();

const metamodel = YAML.parse(fs.readFileSync(args.metamodel, { encoding: 'utf-8' }));
const centeredModel = loadModel(args.data);

const validator = new DataValidator(metamodel, centeredModel);

for (const error of validator.errors) {
  console.log(`(${error.location[0][0]}:${error.location[0][1]}) ${chalk.red(error.context)}: ${error.message}`);
}
