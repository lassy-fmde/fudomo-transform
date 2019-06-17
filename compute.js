#!/usr/bin/env node

const ArgumentParser = require('argparse').ArgumentParser;
const chalk = require('chalk');
const path = require('path');
const util = require('util');
const modelIO = require('./model-io.js');
const Transformation = require('./ast.js');

function dispatch2F(f, values) {
  const func = f.externalFunction;
  if (func == undefined) {
    throw new Error(`Decomposition function implementation "${f.externalName}" could not be found.`);
  }
  return f.externalFunction.apply(null, values);
}

function computeDecomposition(decomposition, centeredModel) {
  _indentLog();
  try {
    _log(chalk.red('Decomposing %s (on %s)'), decomposition.function.qualifiedName, centeredModel.type);

    let links = decomposition.links;
    if (links.length == 0) {
      if (decomposition.function.externalFunction == null) {
        return centeredModel.getFeature(decomposition.function.name);
      } else {
        return dispatch2F(decomposition.function, []);
      }
    }

    let linkValues = [];
    for (let link of links) {
      if (link.kind == 'local') {
        const targetDecomposition = link.function.getTargetDecomposition(centeredModel);
        _log('╰─local: %s', link.function.name);
        if (targetDecomposition == null) {
          if (link.function.externalFunction != null) {
            _logIndented('╰─externalFunction: %s', link.function.externalFunction);
            linkValues.push(dispatch2F(link.function, []));
          } else {
            _logIndented('╰─feature: %s (of %s)', link.function.name, centeredModel.type);
            linkValues.push(centeredModel.getFeature(link.function.name));
          }
        } else {
          _logIndented('╰─targetDecomposition: %s (of %s)', targetDecomposition.function.qualifiedName, centeredModel.type);
          linkValues.push(computeDecomposition(targetDecomposition, centeredModel));
        }
      } else if (link.kind == 'forward') {
        _log('╰─forward: %s -> %s', link.referenceName, link.function.qualifiedName);
        let linkTargets = [];
        for (let successorModel of centeredModel.successors(link.referenceName, link.function.type)) {
          const targetDecomposition = link.function.getTargetDecomposition(successorModel);
          if (targetDecomposition == null) {
            if (link.function.externalFunction != null) {
              _logIndented('╰─externalFunction: %s', link.function.externalFunction);
              linkTargets.push(dispatch2F(link.function, []));
            } else {
              _logIndented('╰─feature: %s (of %s)', link.function.name, successorModel.type);
              linkTargets.push(successorModel.getFeature(link.function.name));
            }
          } else {
            _logIndented('╰─targetDecomposition: %s (of %s)', targetDecomposition.function.qualifiedName, successorModel.type);
            linkTargets.push(computeDecomposition(targetDecomposition, successorModel));
          }
        }
        linkValues.push(linkTargets);
      } else if (link.kind == 'reverse') {
        _log('╰─reverse: %s <- %s', link.referenceName, link.function.qualifiedName);
        let linkTargets = new Set();
        for (let predecessorModel of centeredModel.predecessors(link.referenceName, link.function.type)) {
          const targetDecomposition = link.function.getTargetDecomposition(predecessorModel);
          if (targetDecomposition == null) {
            if (link.function.externalFunction != null) {
              _logIndented('╰─externalFunction: %s', link.function.externalFunction);
              linkTargets.add(dispatch2F(link.function, []));
            } else {
              _logIndented('╰─feature: %s (of %s)', link.function.name, predecessorModel.type);
              linkTargets.add(predecessorModel.getFeature(link.function.name));
            }
          } else {
            _logIndented('╰─targetDecomposition: %s (of %s)', targetDecomposition.function.qualifiedName, predecessorModel.type);
            linkTargets.add(computeDecomposition(targetDecomposition, predecessorModel));
          }
        }
        linkValues.push(linkTargets);
      }
    }
    return dispatch2F(decomposition.function, linkValues);
  } finally {
    _dedentLog();
  }
}

// TODO don't use global variables
var _log = function() {};
var _indentLog = function() {};
var _dedentLog = function() {};

function _logIndented(...params) {
  _indentLog();
  _log(...params);
  _dedentLog();
}

function transform(transformation, rootModel, log, indentLog, dedentLog) {
  _log = log;
  _indentLog = indentLog;
  _dedentLog = dedentLog;

  const firstDecomposition = transformation.decompositions[0];
  if (!firstDecomposition) {
    throw new Error('No decomposition found.');
  }

  let firstDecompositionModel = rootModel;

  const firstDecompositionType = firstDecomposition.function.type;
  if (firstDecompositionType != 'Root') {
    const firstDecompositionModels = rootModel.successors('cont', firstDecompositionType);
    if (firstDecompositionModels.length == 0) {
      throw new Error(`No instance of first decomposition type "${firstDecompositionType}" found.`);
    } else if (firstDecompositionModels.length > 1) {
      throw new Error(`More than one instance of first decomposition type "${firstDecompositionType}" found.`);
    }
    firstDecompositionModel = firstDecompositionModels[0];
  }

  return computeDecomposition(firstDecomposition, firstDecompositionModel);
}

module.exports = transform;
