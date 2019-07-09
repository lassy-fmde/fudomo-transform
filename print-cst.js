#!/usr/bin/env node

const ArgumentParser = require('argparse').ArgumentParser;
const chalk = require('chalk');
const fs = require('fs');
const { Transformation, getFudomoParser } = require('./ast.js');
const util = require('util');

var argumentParser = new ArgumentParser({ version: '0.1.0', addHelp: true, description: 'Print parsed decomposition concrete syntax tree.' });
argumentParser.addArgument('decomposition', { help: 'decomposition file' });
var args = argumentParser.parseArgs();

const parser = getFudomoParser();

fs.readFile(process.argv[2], "utf-8", (err, fudomoCode) => {
  try {
    parser.feed(fudomoCode);
    console.log(util.inspect(parser.results[0], false, null, true));
  } catch(error) {
    console.log(chalk.red.bold('Transformation has syntactical error at offset ' + error.offset));
    console.log(error);
  }
});
