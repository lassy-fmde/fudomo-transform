#!/usr/bin/env node

const fs = require('fs');
const fuzzer = require('fuzzer');
const { Transformation, getFudomoParser } = require('./ast.js');
const chalk = require('chalk');

const ArgumentParser = require('argparse').ArgumentParser;

fuzzer.seed(1);

var argumentParser = new ArgumentParser({ version: '0.1.0', addHelp: true, description: 'Fuzz decomposition file to test parser error message generation.' });
argumentParser.addArgument('decomposition', { help: 'decomposition file' });
var args = argumentParser.parseArgs();

const transformationSource = fs.readFileSync(process.argv[2], 'utf-8');

function highlightRange(source, range) {
  const mark = chalk.underline;

  const startRow = range[0][0];
  const startCol = range[0][1];
  const endRow = range[1][0];
  const endCol = range[1][1];
  const lines = source.split(/\r?\n/);

  let res = lines.slice(0, startRow).join('\n') + '\n'; // Before startRow
  res += lines[startRow].slice(0, startCol);            // Before startCol in startRow

  if (endRow == startRow) {
    res += mark(lines[startRow].slice(startCol, endCol)); // From startCol to endCol
    res += lines[startRow].slice(endCol) + '\n';      // From endCol to end of row
  } else {
    res += mark(lines[startRow].slice(startCol)) + '\n'; // Till end of startRow
    for (let i = startRow + 1; i < endRow; i++) {            // Every full row between startRow + 1 and endRow (non-incl.).
      res += mark(lines[i]) + '\n';
    }
    res += mark(lines[endRow].slice(0, endCol));      // Till endCol in endRow
    res += lines[endRow].slice(endCol) + '\n';    // Till end of line in endRow
  }

  res += lines.slice(endRow + 1).join('\n');

  return res;
}

let count = 1;
while (true) {
  const fuzzedSource = fuzzer.mutate.string(transformationSource);
  const transformation = new Transformation(fuzzedSource);
  if (transformation.hasError) {
    try {
      for (const error of transformation.errors) {
        if (error.excerpt == 'Unknown syntax error') {
          console.log(chalk.red(error.description));
          console.log(highlightRange(fuzzedSource, error.location.position));
          process.exit(1);
        }
      }
    } catch(error) {
      console.log(chalk.red.bold('Exception: '), error);
      console.log(chalk.bold('Fuzzed source was:'));
      console.log(fuzzedSource);
      process.exit(2);
    }
  }
  process.stdout.write('\rTest cases tried: ' + count);
  count += 1;
}
