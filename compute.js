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

 class TransformationContext {
   constructor(transformation, rootModel, functionRunner) {
     this.transformation = transformation;
     this.rootModel = rootModel;
     this.functionRunner = functionRunner;
     this.stack = null;
   }

   log(...params) {
   }
   logIndented(...params) {
     this.indentLog();
     this.log(...params);
     this.dedentLog();
   }
   indentLog() {
   }
   dedentLog() {
   }
 }

class StackFrame {

  relPath(pathBase, _path) {
    // _path can be an absolute path, or even a "source location" (ie. "/absolute/filename:line:col")
    if (pathBase == null) return _path;
    if (_path == null) return _path;
    if (!path.isAbsolute(pathBase)) {
      throw new Error('Path base must be absolute path');
    }
    if (!path.isAbsolute(_path)) {
      throw new Error('Path must be absolute path');
    }
    if (_path.startsWith(pathBase)) {
      return _path.slice(pathBase.length + 1);
    }
    return _path;
  }

  toString(pathBase=null) {
    throw new Error('Not implemented');
  }

  toHtml(pathBase=null) {
    throw new Error('Not implemented');
  }
}

class LocalLinkStackFrame extends StackFrame {
  constructor(link) {
    super();
    this.link = link;
  }

  toString(pathBase=null) {
    const sourceFile = this.relPath(pathBase, this.link.transformation.sourceLocation) || 'unknown_source_path';
    const location = `${sourceFile}:${this.link.node.location[0][0] + 1}:${this.link.node.location[0][1] + 1}`;
    return `    at (LL) ${this.link} (${location})`;
  }

  toHtml(pathBase=null) {
    const sourceLocation = this.relPath(pathBase, this.link.transformation.sourceLocation);
    const sourceFile = sourceLocation || 'unknown_source_path';
    const location = `${escapeHtml(sourceFile)}:${this.link.node.location[0][0] + 1}:${this.link.node.location[0][1] + 1}`;
    if (sourceLocation !== null) {
      return `    at (LL) ${escapeHtml(this.link)} (<a class="fudomo-exception-source-link" href="#" data-source-loc="${escapeHtml(JSON.stringify({ src: sourceLocation, pos: this.link.node.location }))}">${escapeHtml(location)}</a>)`;
    } else {
      return `    at (LL) ${escapeHtml(this.link)} (${escapeHtml(location)})`;
    }
  }
}

class ForwardLinkStackFrame extends StackFrame {
  constructor(link) {
    super();
    this.link = link;
    this.referredModel = null; // is always set later by computeDecomposition
  }

  toString(pathBase=null) {
    const sourceFile = this.relPath(pathBase, this.link.transformation.sourceLocation) || 'unknown_source_path';
    const location = `${sourceFile}:${this.link.node.location[0][0] + 1}:${this.link.node.location[0][1] + 1}`;
    return `    at (FL) ${this.link} (${location})\n            ${this.link.function.type} (${this.relPath(pathBase, this.referredModel.sourceLocation)}): ${this.referredModel.center}`;
  }

  toHtml(pathBase=null) {
    const sourceLocation = this.relPath(pathBase, this.link.transformation.sourceLocation);
    const sourceFile = sourceLocation || 'unknown_source_path';
    const location = `${sourceFile}:${this.link.node.location[0][0] + 1}:${this.link.node.location[0][1] + 1}`;
    if (sourceLocation !== null) {
      return `    at (FL) ${escapeHtml(this.link)} (<a href="#" class="fudomo-exception-source-link" data-source-loc="${escapeHtml(JSON.stringify({ src: sourceLocation, pos: this.link.node.location }))}">${escapeHtml(location)}</a>)\n` +
             `            ${escapeHtml(this.link.function.type)} (<a href="#" class="fudomo-exception-source-link" data-source-loc="${escapeHtml(JSON.stringify({ src: this.relPath(pathBase, this.referredModel.center.sourceLocation), pos: this.referredModel.center.fullDefinitionLocation}))}">${escapeHtml(this.relPath(pathBase, this.referredModel.sourceLocation))}</a>): ${escapeHtml(this.referredModel.center)}`;
    } else {
      return `    at (FL) ${escapeHtml(this.link)} (${escapeHtml(location)})\n` +
             `            ${escapeHtml(this.link.function.type)} (${escapeHtml(this.relPath(pathBase, this.referredModel.sourceLocation))}): ${escapeHtml(this.referredModel.center)}`;
    }
  }
}

class ReverseLinkStackFrame extends StackFrame {
  constructor(link) {
    super();
    this.link = link;
    this.referredModel = null; // is always set later by computeDecomposition
  }

  toString(pathBase=null) {
    const sourceFile = this.relPath(pathBase, this.link.transformation.sourceLocation) || 'unknown_source_path';
    const location = `${sourceFile}:${this.link.node.location[0][0] + 1}:${this.link.node.location[0][1] + 1}`;
    return `    at (RL) ${this.link} (${location})\n` +
           `            ${this.link.function.type} (${this.relPath(pathBase, this.referredModel.sourceLocation)}): ${this.referredModel.center}`;
  }

  toHtml(pathBase=null) {
    const sourceLocation = this.relPath(pathBase, this.link.transformation.sourceLocation);
    const sourceFile = sourceLocation || 'unknown_source_path';
    const location = `${sourceFile}:${this.link.node.location[0][0] + 1}:${this.link.node.location[0][1] + 1}`;
    if (sourceLocation !== null) {
      return `    at (RL) ${escapeHtml(this.link)} (<a href="#" class="fudomo-exception-source-link" data-source-loc="${escapeHtml(JSON.stringify({ src: sourceLocation, pos: this.link.node.location }))}">${escapeHtml(location)}</a>)\n` +
             `            ${escapeHtml(this.link.function.type)} (<a href="#" class="fudomo-exception-source-link" data-source-loc="${escapeHtml(JSON.stringify({ src: this.relPath(pathBase, this.referredModel.center.sourceLocation), pos: this.referredModel.center.fullDefinitionLocation }))}">${escapeHtml(this.relPath(pathBase, this.referredModel.sourceLocation))}</a>): ${escapeHtml(this.referredModel.center)}`;
    } else {
      return `    at (RL) ${escapeHtml(this.link)} (${location})\n` +
             `            ${escapeHtml(this.link.function.type)} (${escapeHtml(this.relPath(pathBase, this.referredModel.sourceLocation))}): ${escapeHtml(this.referredModel.center)}`;
    }
  }}

class FudomoDecompositionStackFrame extends StackFrame {
  constructor(decomposition, centeredModel) {
    super();
    this.decomposition = decomposition;
    this.centeredModel = centeredModel;
  }

  toString(pathBase=null) {
    const decompSourceFile = this.relPath(pathBase, this.decomposition.transformation.sourceLocation) || 'unknown_source_path';
    const decompLocation = `${decompSourceFile}:${this.decomposition.node.location[0][0] + 1}:${this.decomposition.node.location[0][1] + 1}`;
    return `    at (DC) ${this.decomposition.function.qualifiedName} (${decompLocation})\n            center (${this.relPath(pathBase, this.centeredModel.sourceLocation)}): ${this.centeredModel.center}`;
  }

  toHtml(pathBase=null) {
    const sourceLocation = this.relPath(pathBase, this.decomposition.transformation.sourceLocation);
    const decompSourceFile = sourceLocation || 'unknown_source_path';
    const decompLocation = `${decompSourceFile}:${this.decomposition.node.location[0][0] + 1}:${this.decomposition.node.location[0][1] + 1}`;
    if (sourceLocation !== null) {
      return `    at (DC) ${escapeHtml(this.decomposition.function.qualifiedName)} (<a href="#" class="fudomo-exception-source-link" data-source-loc="${escapeHtml(JSON.stringify({ src: sourceLocation, pos: this.decomposition.node.location}))}">${escapeHtml(decompLocation)}</a>})\n` +
             `            center (<a href="#" class="fudomo-exception-source-link" data-source-loc="${escapeHtml(JSON.stringify({ src: this.relPath(pathBase, this.centeredModel.center.sourceLocation), pos: this.centeredModel.center.fullDefinitionLocation }))}">${escapeHtml(this.relPath(pathBase, this.centeredModel.sourceLocation))}</a>): ${escapeHtml(this.centeredModel.center)}`;
    } else {
      return `    at (DC) ${escapeHtml(this.decomposition.function.qualifiedName)} (${escapeHtml(decompLocation)})\n` +
             `            center (${escapeHtml(this.relPath(pathBase, this.centeredModel.sourceLocation))}): ${escapeHtml(this.centeredModel.center)}`;
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

  toHtml(pathBase=null) {
    const stack = [...this.fudomoStack];
    stack.reverse();
    return '<pre>' + stack.map(frame => frame.toHtml(pathBase)).join('\n') + '</pre>';
  }

  toString(pathBase=null) {
    const stack = [...this.fudomoStack];
    stack.reverse();
    return stack.map(frame => frame.toString(pathBase)).join('\n');
  }
}

async function dispatch2F(context, f, values) {
  return context.functionRunner.callFunction(f.externalName, values);
}

async function computeDecomposition(context, decomposition, centeredModel) {
  // This flag is used in the finally block to decide whether to unwind the stack.
  // It must be set to true before every return statement.
  let success = false;

  stack.push(new FudomoDecompositionStackFrame(decomposition, centeredModel));

  context.indentLog();
  try {
    context.log(chalk.red('Decomposing %s (on %s)'), decomposition.function.qualifiedName, centeredModel.type);

    let links = decomposition.links;
    if (links.length == 0) {
      if (!(await context.functionRunner.hasFunction(decomposition.function.externalName))) {
        success = true;
        return centeredModel.getFeature(decomposition.function.name);
      } else {
        success = true;
        return dispatch2F(context, decomposition.function, []);
      }
    }

    let linkValues = [];
    for (let link of links) {
      let linkSuccess = false;
      try {

        if (link.kind == 'local') {
          stack.push(new LocalLinkStackFrame(link));
          const targetDecomposition = link.function.getTargetDecomposition(centeredModel);
          context.log('╰─local: %s', link.function.name);
          if (targetDecomposition == null) {
            context.logIndented('╰─feature: %s (of %s)', link.function.name, centeredModel.type);
            linkValues.push(centeredModel.getFeature(link.function.name));
          } else {
            context.logIndented('╰─targetDecomposition: %s (of %s)', targetDecomposition.function.qualifiedName, centeredModel.type);
            linkValues.push(await computeDecomposition(context, targetDecomposition, centeredModel));
          }
        } else if (link.kind == 'forward') {
          stack.push(new ForwardLinkStackFrame(link));
          context.log('╰─forward: %s -> %s', link.referenceName, link.function.qualifiedName);
          let linkTargets = [];
          for (let successorModel of centeredModel.successors(link.referenceName, link.function.type)) {
            stack.slice(-1)[0].referredModel = successorModel;
            const targetDecomposition = link.function.getTargetDecomposition(successorModel);
            if (targetDecomposition == null) {
              if (await context.functionRunner.hasFunction(link.function.externalName)) {
                context.logIndented('╰─externalFunction: %s', link.function.externalName);
                linkTargets.push(await dispatch2F(context, link.function, []));
              } else {
                context.logIndented('╰─feature: %s (of %s)', link.function.name, successorModel.type);
                linkTargets.push(successorModel.getFeature(link.function.name));
              }
            } else {
              context.logIndented('╰─targetDecomposition: %s (of %s)', targetDecomposition.function.qualifiedName, successorModel.type);
              linkTargets.push(await computeDecomposition(context, targetDecomposition, successorModel));
            }
          }
          linkValues.push(linkTargets);
        } else if (link.kind == 'reverse') {
          stack.push(new ReverseLinkStackFrame(link));
          context.log('╰─reverse: %s <- %s', link.referenceName, link.function.qualifiedName);
          let linkTargets = new Set();
          for (let predecessorModel of centeredModel.predecessors(link.referenceName, link.function.type)) {
            stack.slice(-1)[0].referredModel = predecessorModel;
            const targetDecomposition = link.function.getTargetDecomposition(predecessorModel);
            if (targetDecomposition == null) {
              if (await context.functionRunner.hasFunction(link.function.externalName)) {
                context.logIndented('╰─externalFunction: %s', link.function.externalName);
                linkTargets.add(await dispatch2F(context, link.function, []));
              } else {
                context.logIndented('╰─feature: %s (of %s)', link.function.name, predecessorModel.type);
                linkTargets.add(predecessorModel.getFeature(link.function.name));
              }
            } else {
              context.logIndented('╰─targetDecomposition: %s (of %s)', targetDecomposition.function.qualifiedName, predecessorModel.type);
              linkTargets.add(await computeDecomposition(context, targetDecomposition, predecessorModel));
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
    return dispatch2F(context, decomposition.function, linkValues);
  } finally {
    context.dedentLog();
    if (success) {
      stack.pop();
    }
  }
}

async function transform(context) {
  try {
    if (context.stack !== null) {
      throw new Error('TransformationContext can not be reused.');
    }
    context.stack = [];

    const firstDecomposition = context.transformation.decompositions[0];
    if (!firstDecomposition) {
      throw new Error('No decomposition found.');
    }

    let firstDecompositionModel = context.rootModel;

    const firstDecompositionType = firstDecomposition.function.type;
    if (firstDecompositionType != 'Root') {
      const firstDecompositionModels = context.rootModel.successors('cont', firstDecompositionType);
      if (firstDecompositionModels.length == 0) {
        throw new Error(`No instance of first decomposition type "${firstDecompositionType}" found.`);
      } else if (firstDecompositionModels.length > 1) {
        throw new Error(`More than one instance of first decomposition type "${firstDecompositionType}" found.`);
      }
      firstDecompositionModel = firstDecompositionModels[0];
    }

    let res = null;
    try {
      stack = [];
      res = await computeDecomposition(context, firstDecomposition, firstDecompositionModel);
    } catch(error) {
      stack.push(context.functionRunner.exceptionToStackFrame(error));
    }
    if (stack.length > 0) {
      throw new FudomoComputeException(stack);
    }
    return res;

  } finally {
    context.functionRunner.finalize();
  }
}

module.exports = {
  transform: transform,
  TransformationContext: TransformationContext,
  FudomoComputeException: FudomoComputeException,
  StackFrame: StackFrame
}
