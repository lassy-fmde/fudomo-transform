#!/usr/bin/env node

const ArgumentParser = require('argparse').ArgumentParser;
const chalk = require('chalk');
const fs = require('fs');
const { Lexer } = require('./fudomo-grammar.js');
const util = require('util');

var argumentParser = new ArgumentParser({ version: '0.1.0', addHelp: true, description: 'Print token stream from lexer.' });
argumentParser.addArgument('decomposition', { help: 'decomposition file' });
var args = argumentParser.parseArgs();

fs.readFile(process.argv[2], "utf-8", (err, fudomoCode) => {
  Lexer.reset(fudomoCode);

  for (let token of Lexer) {
    const tokenString = util.inspect(token.toString())
    const sep = ' '.repeat(Math.max(1, 16 - tokenString.length))
    console.log((token.line + '.' + token.col + ': ').padStart(10), chalk.red.bold(tokenString), sep, util.inspect(token).replace(/\n[ ]+/g, ' '));
  }
});
