@{%

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
%}

# TODO end-of-line comments (currently only full-line comments interleaved with decompositions)

@lexer filtered_tokens
transformation  -> (decomposition {% id %}):* (%comment {% comment %}):*   {% transformation %}
decomposition   -> (%comment {% comment %}):* typedFunction %colon links:? {% decomposition %}
links           -> link (%comma link):*                                    {% links %}
link            -> localLink {% id %} | globalLink {% id %} | forwardLink {% id %} | reverseLink {% id %}
localLink       -> %identifier                                             {% localLink %}
globalLink      -> typedFunction                                           {% globalLink %}
forwardLink     -> %identifier %rightArrow typedFunction                   {% forwardLink %}
reverseLink     -> %identifier %leftArrow typedFunction                    {% reverseLink %}
typedFunction   -> type %dot untypedFunction                               {% typedFunction %}
type            -> %identifier                                             {% id %}
untypedFunction -> %identifier                                             {% id %}
