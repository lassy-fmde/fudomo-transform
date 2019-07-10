@{%

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

%}

# TODO end-of-line comments (currently only full-line comments interleaved with decompositions)

@lexer lexer
transformation  -> (%comment {% comment %} | decomposition {% id %}):*     {% transformation %}
decomposition   -> typedFunction %colon links:?                            {% decomposition %}
links           -> link (%comma link):*                                    {% links %}
link            -> localLink {% id %} | forwardLink {% id %} | reverseLink {% id %}
localLink       -> _ %identifier _                                         {% localLink %}
forwardLink     -> _ %identifier %rightArrow typedFunction _               {% forwardLink %}
reverseLink     -> _ %identifier %leftArrow typedFunction _                {% reverseLink %}
typedFunction   -> type "." untypedFunction                            {% typedFunction %}
type            -> %identifier                                             {% id %}
untypedFunction -> %identifier                                             {% id %}
_               -> %ws:*
