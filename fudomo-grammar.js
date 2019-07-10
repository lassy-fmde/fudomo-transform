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
  // typedFunction %colon links:?
  [typedFunction, _, links] = data
  return { typedFunction: typedFunction, links: links };
}
function links(data) {
  // link (%comma link):*
  [link, subsequentCommasAndLinks] = data

  const res = [link];
  for (const [_, link] of subsequentCommasAndLinks) {
    res.push(link);
  }

  return res;
}
function localLink(data) {
  // _ %identifier _
  [_, identifierToken, _] = data
  return { type: 'local', reference: identifierToken.value }
}
function forwardLink(data) {
  // _ %identifier %rightArrow typedFunction _
  [_, referenceIdentifierToken, _, typedFunction, _] = data
  return { type: 'forward', reference: referenceIdentifierToken.value, typedFunction: typedFunction }
}
function reverseLink(data) {
  // _ %identifier %leftArrow typedFunction _
  [_, referenceIdentifierToken, _, typedFunction, _] = data
  return { type: 'reverse', reference: referenceIdentifierToken.value, typedFunction: typedFunction }
}
function typedFunction(data) {
  // type "." untypedFunction
  [typeToken, _, untypedFunctionToken] = data
  return { type: typeToken.value, untypedFunction: untypedFunctionToken.value};
}
function comment(data) {
  // %comment
  [token] = data
  return { comment: token.value }
}

const moo = require("moo");

const lexer = moo.compile({
  comment: { match: /\n*#.*\n*/, lineBreaks: true, value: x => x.trim().slice(1) },
  identifier: /[a-zA-Z][a-zA-Z0-9]*/,
  colon: /[\s]*:[\s]*/,
  dot: '.',
  comma: /[\s]*,[\s]*/,
  rightArrow: /[\s]*->[\s]*/,
  leftArrow: /[\s]*<-[\s]*/,
	// nl: { match: /\n/, lineBreaks: true },
  ws: { match: /[ \t\r\n\v\f]+/, lineBreaks: true },
});

var grammar = {
    Lexer: lexer,
    ParserRules: [
    {"name": "transformation$ebnf$1", "symbols": []},
    {"name": "transformation$ebnf$1$subexpression$1", "symbols": [(lexer.has("comment") ? {type: "comment"} : comment)], "postprocess": comment},
    {"name": "transformation$ebnf$1$subexpression$1", "symbols": ["decomposition"], "postprocess": id},
    {"name": "transformation$ebnf$1", "symbols": ["transformation$ebnf$1", "transformation$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "transformation", "symbols": ["transformation$ebnf$1"], "postprocess": transformation},
    {"name": "decomposition$ebnf$1", "symbols": ["links"], "postprocess": id},
    {"name": "decomposition$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "decomposition", "symbols": ["typedFunction", (lexer.has("colon") ? {type: "colon"} : colon), "decomposition$ebnf$1"], "postprocess": decomposition},
    {"name": "links$ebnf$1", "symbols": []},
    {"name": "links$ebnf$1$subexpression$1", "symbols": [(lexer.has("comma") ? {type: "comma"} : comma), "link"]},
    {"name": "links$ebnf$1", "symbols": ["links$ebnf$1", "links$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "links", "symbols": ["link", "links$ebnf$1"], "postprocess": links},
    {"name": "link", "symbols": ["localLink"], "postprocess": id},
    {"name": "link", "symbols": ["forwardLink"], "postprocess": id},
    {"name": "link", "symbols": ["reverseLink"], "postprocess": id},
    {"name": "localLink", "symbols": ["_", (lexer.has("identifier") ? {type: "identifier"} : identifier), "_"], "postprocess": localLink},
    {"name": "forwardLink", "symbols": ["_", (lexer.has("identifier") ? {type: "identifier"} : identifier), (lexer.has("rightArrow") ? {type: "rightArrow"} : rightArrow), "typedFunction", "_"], "postprocess": forwardLink},
    {"name": "reverseLink", "symbols": ["_", (lexer.has("identifier") ? {type: "identifier"} : identifier), (lexer.has("leftArrow") ? {type: "leftArrow"} : leftArrow), "typedFunction", "_"], "postprocess": reverseLink},
    {"name": "typedFunction", "symbols": ["type", {"literal":"."}, "untypedFunction"], "postprocess": typedFunction},
    {"name": "type", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier)], "postprocess": id},
    {"name": "untypedFunction", "symbols": [(lexer.has("identifier") ? {type: "identifier"} : identifier)], "postprocess": id},
    {"name": "_$ebnf$1", "symbols": []},
    {"name": "_$ebnf$1", "symbols": ["_$ebnf$1", (lexer.has("ws") ? {type: "ws"} : ws)], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "_", "symbols": ["_$ebnf$1"]}
]
  , ParserStart: "transformation"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
