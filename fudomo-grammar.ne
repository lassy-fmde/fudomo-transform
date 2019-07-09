# @{%
# const moo = require("moo");
#
# const lexer = moo.compile({
#   comment: { match: /#.*\n/, lineBreaks: true },
#   identifier: /[a-z-A-Z][a-zA-Z0-9]*/,
#   colon: ':',
#   nl: { match: /\n/, lineBreaks: true },
#   dot: '.',
#   comma: ',',
#   rightArrow: '->',
#   leftArrow: '<-',
#   ws: { match: /[ \t\n\v\f]+/, lineBreaks: true },
# });
#
# function nuller() { return null; }
#
# %}

@{%

function nuller(d) { return null; }

function transformation(data) {
	// commentOrNlSeq decomposition (commentOrNlSeq decomposition):* commentOrNlSeq
	const comment1 = data[0];
	const decomp1 = data[1];
	const comDecGrp = data[2];
	const comment2 = data[3];

	const res = [];
	if (comment1) res.push(comment1);
	if (decomp1) res.push(decomp1);
	for (let [comment, decomp] of comDecGrp) {
		if (comment) res.push(comment);
		if (decomp) res.push(decomp);
	}
	if (comment2) res.push(comment2);
	return res;
}

function decomposition(data) {
  // typedFunction ":" _ links:? nl
  return { typedFunction: data[0], links: data[3] };
}

function links(data) {
	// link ("," _ link):*
	const res = [];
	res.push(data[0]);
	if (data[1]) {
		for (var l of data[1]) {
			const link = l[2];
			if (link) {
				res.push(link);
			}
		}
	}
	return res;
}
function commentOrNlSeq(data) {
	let res = "";
	for (var d of data[0]) {
		if (d[0] != null) {
			res += d[0].comment + '\n'
		}
	}
	if (res.trim().length == 0) return null;
	return { comment: res.trim() };
}

function localLink(data) { return { type: "local", reference: data[0] }; }
function forwardLink(data) { return { type: 'forward', reference: data[0], typedFunction: data[4] }; }
function reverseLink(data) { return { type: 'reverse', reference: data[0], typedFunction: data[4] }; }
function typedFunction(data) { return { type: data[0], untypedFunction: data[2] }; }
function identifier(data) { return data[0] + data[1].join(''); }
function comment(data) { return { comment: data[1].join('').trim() }; }
%}

# TODO end-of-line comments (currently only full-line comments interleaved with decompositions)
# TODO leading whitespace before comments and decompositions

@builtin "whitespace.ne"
transformation  -> commentOrNlSeq decomposition (commentOrNlSeq decomposition):* commentOrNlSeq {% transformation %}
decomposition   -> typedFunction ":" _ links:? nl                                               {% decomposition %}
links           -> link ("," _ link):*                                                          {% links %}
link            -> localLink {% id %} | forwardLink {% id %} | reverseLink {% id %}
localLink       -> identifier                                                                   {% localLink %}
forwardLink     -> identifier _ "->" _ typedFunction                                            {% forwardLink %}
reverseLink     -> identifier _ "<-" _ typedFunction                                            {% reverseLink %}
typedFunction   -> type "." untypedFunction                                                     {% typedFunction %}
type            -> identifier                                                                   {% id %}
untypedFunction -> identifier                                                                   {% id %}
identifier      -> [a-zA-Z] [a-zA-Z0-9]:*                                                       {% identifier %}
commentOrNlSeq  -> (comment | nl):*                                                             {% commentOrNlSeq %}
comment         -> "#" [^\n]:* nl                                                               {% comment %}
nl              -> "\n"                                                                         {% nuller %}
