#!/usr/bin/env node

const ArgumentParser = require('argparse').ArgumentParser;

const Inferer = require('./infer.js');
const chalk = require('chalk');
const fs = require('fs');
const YAML = require('yaml');

var argumentParser = new ArgumentParser({ version: '0.1.0', addHelp: true, description: 'Print inferred metamodel of a set of object instances.' });
argumentParser.addArgument('instance', { nargs: '+', help: 'instance files' });
var args = argumentParser.parseArgs();

const metamodel = new Inferer().inferMetamodelFromPaths(args.instance);
console.log(YAML.stringify(metamodel));
