@{%

function transformation(data) {
  // (%comment | decomposition):*
  const group = data[0];
  return { decompositions: group };
}

function decomposition(data) {
  // (%comment):? typedFunction %colon links:?
  [comments, typedFunction, _, links] = data
  links = links == null ? [] : links;
  const comment = comments.map(d => d.comment.trim()).join('\n');
  return { typedFunction: typedFunction, links: links, comment: comment };
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
  // %identifier
  [identifierToken] = data
  return { type: 'local', reference: identifierToken.value }
}
function forwardLink(data) {
  // %identifier %rightArrow typedFunction
  [referenceIdentifierToken, _, typedFunction] = data
  return { type: 'forward', reference: referenceIdentifierToken.value, typedFunction: typedFunction }
}
function reverseLink(data) {
  // %identifier %leftArrow typedFunction
  [referenceIdentifierToken, _, typedFunction] = data
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
  ws: { match: /[ \t\r\n\v\f]+/, lineBreaks: true },
  comment: { match: /\n*#.*\n*/, lineBreaks: true, value: x => x.trim().slice(1) },
  identifier: /[a-zA-Z][a-zA-Z0-9]*/,
  colon: /[\s]*:[\s]*/,
  dot: '.',
  comma: /[\s]*,[\s]*/,
  rightArrow: /[\s]*->[\s]*/,
  leftArrow: /[\s]*<-[\s]*/,
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
link            -> localLink {% id %} | forwardLink {% id %} | reverseLink {% id %}
localLink       -> %identifier                                             {% localLink %}
forwardLink     -> %identifier %rightArrow typedFunction                   {% forwardLink %}
reverseLink     -> %identifier %leftArrow typedFunction                    {% reverseLink %}
typedFunction   -> type %dot untypedFunction                               {% typedFunction %}
type            -> %identifier                                             {% id %}
untypedFunction -> %identifier                                             {% id %}
