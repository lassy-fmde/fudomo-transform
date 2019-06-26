#!/usr/bin/env node

const fs = require('fs');
const ArgumentParser = require('argparse').ArgumentParser;
const chalk = require('chalk');
const path = require('path');
const util = require('util');
const modelIO = require('./model-io.js');
const transform = require('./compute.js');
const { Transformation, getFudomoParser } = require('./ast.js');

var enableLog = true;
var _logIndent = '';

function indentLog() {
  _logIndent += '  ';
}

function dedentLog() {
  _logIndent = _logIndent.slice(0, -2);
}

function log(...message) {
  if (enableLog) {
    if (message.length > 1) {
      console.log(_logIndent + message[0], ...message.slice(1));
    } else {
      console.log(_logIndent + message[0]);
    }
  }
}

var argumentParser = new ArgumentParser({ version: '0.1.0', addHelp: true, description: 'Compute decomposition' });
argumentParser.addArgument([ '--verbose' ], { help: 'enable debugging output', required: false, defaultValue: false, action: 'storeTrue' });
argumentParser.addArgument('decomposition', { help: 'decomposition file' });
argumentParser.addArgument('functions-module', { help: 'js module implementing decomposition functions' });
argumentParser.addArgument('data-file', { help: 'data file (js module or oyaml)' });

var args = argumentParser.parseArgs();

enableLog = args['verbose'];

const externalFunctionsFilename = path.resolve(args['functions-module']);
let externalFunctions = require(externalFunctionsFilename);

const transformationFilename = args['decomposition'];
const transformationSource = fs.readFileSync(transformationFilename, 'utf-8');

const transformation = new Transformation(transformationSource);
transformation.externalFunctions = externalFunctions;
if (transformation.hasError) {
  console.error('Transformation has syntactical errors:');
  for (const error of transformation.errors) {
    console.error(`${error.location.position[0][0]}:${error.location.position[0][1]} ${error.severity}: ${error.excerpt}`);
  }
  process.exit(1);
}

const dataFilename = args['data-file'];
let model = modelIO.loadModel(dataFilename);

log(chalk.bold.red(dataFilename));
let result = transform(transformation, model, log, indentLog, dedentLog);
console.log(result);
