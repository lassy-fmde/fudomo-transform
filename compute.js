#!/usr/bin/env node

const ArgumentParser = require('argparse').ArgumentParser;
const chalk = require('chalk');
const path = require('path');
const util = require('util');
const { Transformation, getFudomoParser } = require('./ast.js');

function escapeHtml(unsafe) {
    return unsafe.toString()
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
 }

// TODO don't use global variables
var stack = null;

class JSStackFrame {
  constructor(jsError) {
    this.jsError = jsError;
    this.message = jsError.message;
  }

  toString() {
    const upperJsFrames = [];
    for (const line of this.jsError.stack.split('\n')) {
      if (!line.match(/\sat .* \(.*fudomo-transform\/compute\.js:\d+:\d+\)/) && !line.match(/\sat .* \(.*\/node_modules\/vm2\/lib\/contextify.js:\d+:\d+\)/)) {
        upperJsFrames.push(line.replace(/    at /g, '    at (JS) '));
      } else {
        break;
      }
    }

    return upperJsFrames.join('\n');
  }

  toHtml() {
    const upperJsFrames = [];
    for (const line of this.jsError.stack.split('\n')) {
      if (!line.match(/\sat .* \(.*fudomo-transform\/compute\.js:\d+:\d+\)/) && !line.match(/\sat .* \(.*\/node_modules\/vm2\/lib\/contextify.js:\d+:\d+\)/)) {
        upperJsFrames.push(escapeHtml(line.replace(/    at /g, '    at (JS) ')));
      } else {
        break;
      }
    }

    return upperJsFrames.join('\n');
  }
}

class LocalLinkStackFrame {
  constructor(link) {
    this.link = link;
  }

  toString() {
    const sourceFile = this.link.transformation.sourceLocation || 'unknown_source_path';
    const location = `${sourceFile}:${this.link.node.location[0][0] + 1}:${this.link.node.location[0][1] + 1}`;
    return `    at (LL) ${this.link} (${location})`;
  }

  toHtml() {
    const sourceLocation = this.link.transformation.sourceLocation;
    const sourceFile = sourceLocation || 'unknown_source_path';
    const location = `${escapeHtml(sourceFile)}:${this.link.node.location[0][0] + 1}:${this.link.node.location[0][1] + 1}`;
    if (sourceLocation !== null) {
      return `    at (LL) ${escapeHtml(this.link)} (<a class="fudomo-exception-source-link" href="#" data-source-loc="${escapeHtml(JSON.stringify({ src: sourceLocation, pos: this.link.node.location }))}">${escapeHtml(location)}</a>)`;
    } else {
      return `    at (LL) ${escapeHtml(this.link)} (${escapeHtml(location)})`;
    }
  }
}

class ForwardLinkStackFrame {
  constructor(link) {
    this.link = link;
    this.referredModel = null; // is always set later by computeDecomposition
  }

  toString() {
    const sourceFile = this.link.transformation.sourceLocation || 'unknown_source_path';
    const location = `${sourceFile}:${this.link.node.location[0][0] + 1}:${this.link.node.location[0][1] + 1}`;
    return `    at (FL) ${this.link} (${location})\n            ${this.link.function.type} (${this.referredModel.sourceLocation}): ${this.referredModel.center}`;
  }

  toHtml() {
    const sourceLocation = this.link.transformation.sourceLocation;
    const sourceFile = sourceLocation || 'unknown_source_path';
    const location = `${sourceFile}:${this.link.node.location[0][0] + 1}:${this.link.node.location[0][1] + 1}`;
    if (sourceLocation !== null) {
      return `    at (FL) ${escapeHtml(this.link)} (<a href="#" class="fudomo-exception-source-link" data-source-loc="${escapeHtml(JSON.stringify({ src: sourceLocation, pos: this.link.node.location }))}">${escapeHtml(location)}</a>)\n` +
             `            ${escapeHtml(this.link.function.type)} (<a href="#" class="fudomo-exception-source-link" data-source-loc="${escapeHtml(JSON.stringify({ src: this.referredModel.center.sourceLocation, pos: this.referredModel.center.fullDefinitionLocation}))}">${escapeHtml(this.referredModel.sourceLocation)}</a>): ${escapeHtml(this.referredModel.center)}`;
    } else {
      return `    at (FL) ${escapeHtml(this.link)} (${escapeHtml(location)})\n` +
             `            ${escapeHtml(this.link.function.type)} (${escapeHtml(this.referredModel.sourceLocation)}): ${escapeHtml(this.referredModel.center)}`;
    }
  }
}

class ReverseLinkStackFrame {
  constructor(link) {
    this.link = link;
    this.referredModel = null; // is always set later by computeDecomposition
  }

  toString() {
    const sourceFile = this.link.transformation.sourceLocation || 'unknown_source_path';
    const location = `${sourceFile}:${this.link.node.location[0][0] + 1}:${this.link.node.location[0][1] + 1}`;
    return `    at (RL) ${this.link} (${location})\n` +
           `            ${this.link.function.type} (${this.referredModel.sourceLocation}): ${this.referredModel.center}`;
  }

  toHtml() {
    const sourceLocation = this.link.transformation.sourceLocation;
    const sourceFile = sourceLocation || 'unknown_source_path';
    const location = `${sourceFile}:${this.link.node.location[0][0] + 1}:${this.link.node.location[0][1] + 1}`;
    if (sourceLocation !== null) {
      return `    at (RL) ${escapeHtml(this.link)} (<a href="#" class="fudomo-exception-source-link" data-source-loc="${escapeHtml(JSON.stringify({ src: sourceLocation, pos: this.link.node.location }))}">${escapeHtml(location)}</a>)\n` +
             `            ${escapeHtml(this.link.function.type)} (<a href="#" class="fudomo-exception-source-link" data-source-loc="${escapeHtml(JSON.stringify({ src: this.referredModel.center.sourceLocation, pos: this.referredModel.center.fullDefinitionLocation }))}">${escapeHtml(this.referredModel.sourceLocation)}</a>): ${escapeHtml(this.referredModel.center)}`;
    } else {
      return `    at (RL) ${escapeHtml(this.link)} (${location})\n` +
             `            ${escapeHtml(this.link.function.type)} (${escapeHtml(this.referredModel.sourceLocation)}): ${escapeHtml(this.referredModel.center)}`;
    }
  }}

class FudomoDecompositionStackFrame {
  constructor(decomposition, centeredModel) {
    this.decomposition = decomposition;
    this.centeredModel = centeredModel;
  }

  toString() {
    const decompSourceFile = this.decomposition.transformation.sourceLocation || 'unknown_source_path';
    const decompLocation = `${decompSourceFile}:${this.decomposition.node.location[0][0] + 1}:${this.decomposition.node.location[0][1] + 1}`;
    return `    at (DC) ${this.decomposition.function.qualifiedName} (${decompLocation})\n            center (${this.centeredModel.sourceLocation}): ${this.centeredModel.center}`;
  }

  toHtml() {
    const sourceLocation = this.decomposition.transformation.sourceLocation;
    const decompSourceFile = sourceLocation || 'unknown_source_path';
    const decompLocation = `${decompSourceFile}:${this.decomposition.node.location[0][0] + 1}:${this.decomposition.node.location[0][1] + 1}`;
    if (sourceLocation !== null) {
      return `    at (DC) ${escapeHtml(this.decomposition.function.qualifiedName)} (<a href="#" class="fudomo-exception-source-link" data-source-loc="${escapeHtml(JSON.stringify({ src: sourceLocation, pos: this.decomposition.node.location}))}">${escapeHtml(decompLocation)}</a>})\n` +
             `            center (<a href="#" class="fudomo-exception-source-link" data-source-loc="${escapeHtml(JSON.stringify({ src: this.centeredModel.center.sourceLocation, pos: this.centeredModel.center.fullDefinitionLocation }))}">${escapeHtml(this.centeredModel.sourceLocation)}</a>): ${escapeHtml(this.centeredModel.center)}`;
    } else {
      return `    at (DC) ${escapeHtml(this.decomposition.function.qualifiedName)} (${escapeHtml(decompLocation)})\n` +
             `            center (${escapeHtml(this.centeredModel.sourceLocation)}): ${escapeHtml(this.centeredModel.center)}`;
    }
  }
}

class FudomoComputeException {
  constructor(fudomoStack) {
    this.fudomoStack = fudomoStack;
  }

  get message() {
    return this.fudomoStack.slice(-1)[0].message;
  }

  toHtml() {
    const stack = [...this.fudomoStack];
    stack.reverse();
    return '<pre>' + stack.map(frame => frame.toHtml()).join('\n') + '</pre>';
  }

  toString() {
    const stack = [...this.fudomoStack];
    stack.reverse();
    return stack.map(frame => frame.toString()).join('\n');
  }
}

function dispatch2F(f, values) {
  const func = f.externalFunction;
  if (func == undefined) {
    throw new Error(`Decomposition function implementation "${f.externalName}" could not be found.`);
  }
  return f.externalFunction.apply(null, values);
}

function computeDecomposition(decomposition, centeredModel) {
  // This flag is used in the finally block to decide whether to unwind the stack.
  // It must be set to true before every return statement.
  let success = false;

  stack.push(new FudomoDecompositionStackFrame(decomposition, centeredModel));

  _indentLog();
  try {
    _log(chalk.red('Decomposing %s (on %s)'), decomposition.function.qualifiedName, centeredModel.type);

    let links = decomposition.links;
    if (links.length == 0) {
      if (decomposition.function.externalFunction == null) {
        success = true;
        return centeredModel.getFeature(decomposition.function.name);
      } else {
        success = true;
        return dispatch2F(decomposition.function, []);
      }
    }

    let linkValues = [];
    for (let link of links) {
      let linkSuccess = false;
      try {

        if (link.kind == 'local') {
          stack.push(new LocalLinkStackFrame(link));
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
          stack.push(new ForwardLinkStackFrame(link));
          _log('╰─forward: %s -> %s', link.referenceName, link.function.qualifiedName);
          let linkTargets = [];
          for (let successorModel of centeredModel.successors(link.referenceName, link.function.type)) {
            stack.slice(-1)[0].referredModel = successorModel;
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
          stack.push(new ReverseLinkStackFrame(link));
          _log('╰─reverse: %s <- %s', link.referenceName, link.function.qualifiedName);
          let linkTargets = new Set();
          for (let predecessorModel of centeredModel.predecessors(link.referenceName, link.function.type)) {
            stack.slice(-1)[0].referredModel = predecessorModel;
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
        linkSuccess = true;
      } finally {
        if (linkSuccess) {
          stack.pop();
        }
      }
    }
    success = true;
    return dispatch2F(decomposition.function, linkValues);
  } finally {
    _dedentLog();
    if (success) {
      stack.pop();
    }
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

  let rootJsError = null;
  let res = null;
  try {
    stack = [];
    res = computeDecomposition(firstDecomposition, firstDecompositionModel);
  } catch(error) {
    stack.push(new JSStackFrame(error));
  }
  if (stack.length > 0) {
    throw new FudomoComputeException(stack);
  }
  return res;
}

module.exports = {
  transform: transform,
  FudomoComputeException: FudomoComputeException
}
