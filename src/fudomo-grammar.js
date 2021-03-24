// Generated automatically by nearley, version 2.16.0
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }


function transformation(data) {
  // (%comment | decomposition):*
  const group = data[0];
  return { decompositions: group };
}

function decomposition(data) {
  // (%comment):? typedFunction %colon links:?
  let [comments, typedFunction, _, links] = data;
  links = links || [];
  const comment = comments.map(d => d.comment.trim()).join('\n');
  const lastToken = links.slice(-1)[0] || typedFunction;

  return { typedFunction: typedFunction, links: links, comment: comment, location: [typedFunction.location[0], lastToken.location[1]] };
}
function links(data) {
  // link (%comma link):*
  const [link, subsequentCommasAndLinks] = data;

  const res = [link];
  for (const [_, link] of subsequentCommasAndLinks) {
    res.push(link);
  }

  return res;
}
function localLink(data) {
  // %identifier
  const [identifierToken] = data;
  return { type: 'local', reference: identifierToken.value, location: [[identifierToken.line - 1, identifierToken.col - 1], [identifierToken.line - 1, identifierToken.col + identifierToken.value.length - 1]] };
}
function globalLink(data) {
  // % typedFunction
  const [typedFunction] = data;
  return { type: 'global', typedFunction: typedFunction, location: typedFunction.location };
}
function forwardLink(data) {
  // %identifier %rightArrow typedFunction
  const [referenceIdentifierToken, _, typedFunction] = data;
  return { type: 'forward', reference: referenceIdentifierToken.value, typedFunction: typedFunction, location: [[referenceIdentifierToken.line - 1, referenceIdentifierToken.col - 1], typedFunction.location[1]] };
}
function reverseLink(data) {
  // %identifier %leftArrow typedFunction
  const [referenceIdentifierToken, _, typedFunction] = data;
  return { type: 'reverse', reference: referenceIdentifierToken.value, typedFunction: typedFunction, location: [[referenceIdentifierToken.line - 1, referenceIdentifierToken.col - 1], typedFunction.location[1]] };
}
function typedFunction(data) {
  // type "." untypedFunction
  const [typeToken, _, untypedFunctionToken] = data;
  return { type: typeToken.value, untypedFunction: untypedFunctionToken.value, location: [[typeToken.line - 1, typeToken.col - 1], [untypedFunctionToken.line - 1, untypedFunctionToken.col + untypedFunctionToken.value.length - 1]] };
}
function comment(data) {
  // %comment
  const [token] = data;
  return { comment: token.value };
}

const moo = require("moo");

const lexer = moo.compile({
  ws: { match: /[ \t\r\n\v\f]+/, lineBreaks: true },
  comment: { match: /\n*#.*\n*/, lineBreaks: true, value: x => x.trim().slice(1) },
  identifier: /[a-zA-Z][a-zA-Z0-9]*/,
  colon: ':',
  dot: '.',
  comma: ',',
  rightArrow: '->',
  leftArrow: '<-',
});

// TokenFilter class adapts the Moo lexer to not return whitespace tokens.
// This simplifies the grammar, as it can ignore whitespace completely.
class TokenFilter {
  constructor(lexer) {
    this.lexer = lexer;
  }

  next() {
    const token = this.lexer.next();
    if (token && token.type === 'ws') {
      return this.next();
    }
    return token;
  }

  save() { return this.lexer.save(); }
  reset(chunk, info) { this.lexer.reset(chunk, info); }
  formatError(token) { return this.lexer.formatError(token); }
  has(name) { return this.lexer.has(name); }
}

const filtered_tokens = new TokenFilter(lexer);
var grammar = {
    Lexer: filtered_tokens,
    ParserRules: [
    {"name": "transformation$ebnf$1", "symbols": []},
    {"name": "transformation$ebnf$1$subexpression$1", "symbols": ["decomposition"], "postprocess": id},
    {"name": "transformation$ebnf$1", "symbols": ["transformation$ebnf$1", "transformation$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "transformation$ebnf$2", "symbols": []},
    {"name": "transformation$ebnf$2$subexpression$1", "symbols": [(filtered_tokens.has("comment") ? {type: "comment"} : comment)], "postprocess": comment},
    {"name": "transformation$ebnf$2", "symbols": ["transformation$ebnf$2", "transformation$ebnf$2$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "transformation", "symbols": ["transformation$ebnf$1", "transformation$ebnf$2"], "postprocess": transformation},
    {"name": "decomposition$ebnf$1", "symbols": []},
    {"name": "decomposition$ebnf$1$subexpression$1", "symbols": [(filtered_tokens.has("comment") ? {type: "comment"} : comment)], "postprocess": comment},
    {"name": "decomposition$ebnf$1", "symbols": ["decomposition$ebnf$1", "decomposition$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "decomposition$ebnf$2", "symbols": ["links"], "postprocess": id},
    {"name": "decomposition$ebnf$2", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "decomposition", "symbols": ["decomposition$ebnf$1", "typedFunction", (filtered_tokens.has("colon") ? {type: "colon"} : colon), "decomposition$ebnf$2"], "postprocess": decomposition},
    {"name": "links$ebnf$1", "symbols": []},
    {"name": "links$ebnf$1$subexpression$1", "symbols": [(filtered_tokens.has("comma") ? {type: "comma"} : comma), "link"]},
    {"name": "links$ebnf$1", "symbols": ["links$ebnf$1", "links$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "links", "symbols": ["link", "links$ebnf$1"], "postprocess": links},
    {"name": "link", "symbols": ["localLink"], "postprocess": id},
    {"name": "link", "symbols": ["globalLink"], "postprocess": id},
    {"name": "link", "symbols": ["forwardLink"], "postprocess": id},
    {"name": "link", "symbols": ["reverseLink"], "postprocess": id},
    {"name": "localLink", "symbols": [(filtered_tokens.has("identifier") ? {type: "identifier"} : identifier)], "postprocess": localLink},
    {"name": "globalLink", "symbols": ["typedFunction"], "postprocess": globalLink},
    {"name": "forwardLink", "symbols": [(filtered_tokens.has("identifier") ? {type: "identifier"} : identifier), (filtered_tokens.has("rightArrow") ? {type: "rightArrow"} : rightArrow), "typedFunction"], "postprocess": forwardLink},
    {"name": "reverseLink", "symbols": [(filtered_tokens.has("identifier") ? {type: "identifier"} : identifier), (filtered_tokens.has("leftArrow") ? {type: "leftArrow"} : leftArrow), "typedFunction"], "postprocess": reverseLink},
    {"name": "typedFunction", "symbols": ["type", (filtered_tokens.has("dot") ? {type: "dot"} : dot), "untypedFunction"], "postprocess": typedFunction},
    {"name": "type", "symbols": [(filtered_tokens.has("identifier") ? {type: "identifier"} : identifier)], "postprocess": id},
    {"name": "untypedFunction", "symbols": [(filtered_tokens.has("identifier") ? {type: "identifier"} : identifier)], "postprocess": id}
]
  , ParserStart: "transformation"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
