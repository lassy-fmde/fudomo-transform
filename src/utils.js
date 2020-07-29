require("regexp-match-indices").shim();
const lineColumn = require('line-column');

export class QuickfixProposalNoLongerApplicableException extends Error {

}

export class QuickfixProposal {
  constructor(description, appliesTo, source) {
    this.description = description;
    this.appliesTo = appliesTo;
    this.originalSource = source;
  }

  isApplicableToSource(source) {
    return source === this.originalSource;
  }

  applyToSource(source) {
    if (source !== this.originalSource) {
      throw new QuickfixProposalNoLongerApplicableException();
    }
    return this.apply(source);
  }

  apply(source) {
    throw new Error('not implemented');
  }
}

export class RangeReplaceQuickfixProposal extends QuickfixProposal {
  constructor(description, appliesTo, source, range, replacement) {
    super(description, appliesTo, source);
    this.range = range;
    this.replacement = replacement;
  }

  apply(source) {
    const lc = lineColumn(source, { origin: 0 });
    const startIndex = lc.toIndex(this.range[0][0], this.range[0][1]);
    const endIndex = lc.toIndex(this.range[1][0], this.range[1][1]);
    return source.slice(0, startIndex) + this.replacement + source.slice(endIndex);
  }
}

export function escapeHtml(unsafe) {
  return unsafe.toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function offsetToRange(source, offset, length) {
  if (source === '') return [[0, 0], [0, 0]];
  if (offset >= source.length) {
    offset = source.length - 1;
  }
  if (offset + length >= source.length) {
    if (length == 0) {
      offset = source.length - 1;
    } else {
      length = source.length - 1 - offset;
    }
  }

  const lc = lineColumn(source, { origin: 0 });
  const startPos = lc.fromIndex(offset);
  const endPos = lc.fromIndex(offset + length);
  return [[startPos.line, startPos.col], [endPos.line, endPos.col]];
}

export function reMatchAll(text, regex) {
  // Like String.matchAll, but adds a "indices" attribute to the resulting matches
  // (through regexp-match-indices polyfill) as well as "groupRanges".

  const lc = lineColumn(text, { origin: 0 });
  function _offsetToRange(offset, length) {
    const startPos = lc.fromIndex(offset) || lc.fromIndex(text.length - 1);
    const endPos = lc.fromIndex(offset + length) || lc.fromIndex(text.length - 1);
    return [[startPos.line, startPos.col], [endPos.line, endPos.col]];
  }

  const res = [];
  for (const match of text.matchAll(regex)) {
    // Calculate ranges for each group
    const ranges = [];
    for (let groupNr = 0; groupNr < match.length; groupNr++) {
      if (match[groupNr] !== undefined) {
        ranges[groupNr] = _offsetToRange(match.indices[groupNr][0], match.indices[groupNr][1] - match.indices[groupNr][0]);
      }
    }
    match.groupRanges = ranges;
    res.push(match);
  }
  return res;
}
