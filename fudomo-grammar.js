// Generated automatically by nearley, version 2.16.0
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }


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
var grammar = {
    Lexer: undefined,
    ParserRules: [
    {"name": "_$ebnf$1", "symbols": []},
    {"name": "_$ebnf$1", "symbols": ["_$ebnf$1", "wschar"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "_", "symbols": ["_$ebnf$1"], "postprocess": function(d) {return null;}},
    {"name": "__$ebnf$1", "symbols": ["wschar"]},
    {"name": "__$ebnf$1", "symbols": ["__$ebnf$1", "wschar"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "__", "symbols": ["__$ebnf$1"], "postprocess": function(d) {return null;}},
    {"name": "wschar", "symbols": [/[ \t\n\v\f]/], "postprocess": id},
    {"name": "transformation$ebnf$1", "symbols": []},
    {"name": "transformation$ebnf$1$subexpression$1", "symbols": ["commentOrNlSeq", "decomposition"]},
    {"name": "transformation$ebnf$1", "symbols": ["transformation$ebnf$1", "transformation$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "transformation", "symbols": ["commentOrNlSeq", "decomposition", "transformation$ebnf$1", "commentOrNlSeq"], "postprocess": transformation},
    {"name": "decomposition$ebnf$1", "symbols": ["links"], "postprocess": id},
    {"name": "decomposition$ebnf$1", "symbols": [], "postprocess": function(d) {return null;}},
    {"name": "decomposition", "symbols": ["typedFunction", {"literal":":"}, "_", "decomposition$ebnf$1", "nl"], "postprocess": decomposition},
    {"name": "links$ebnf$1", "symbols": []},
    {"name": "links$ebnf$1$subexpression$1", "symbols": [{"literal":","}, "_", "link"]},
    {"name": "links$ebnf$1", "symbols": ["links$ebnf$1", "links$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "links", "symbols": ["link", "links$ebnf$1"], "postprocess": links},
    {"name": "link", "symbols": ["localLink"], "postprocess": id},
    {"name": "link", "symbols": ["forwardLink"], "postprocess": id},
    {"name": "link", "symbols": ["reverseLink"], "postprocess": id},
    {"name": "localLink", "symbols": ["identifier"], "postprocess": localLink},
    {"name": "forwardLink$string$1", "symbols": [{"literal":"-"}, {"literal":">"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "forwardLink", "symbols": ["identifier", "_", "forwardLink$string$1", "_", "typedFunction"], "postprocess": forwardLink},
    {"name": "reverseLink$string$1", "symbols": [{"literal":"<"}, {"literal":"-"}], "postprocess": function joiner(d) {return d.join('');}},
    {"name": "reverseLink", "symbols": ["identifier", "_", "reverseLink$string$1", "_", "typedFunction"], "postprocess": reverseLink},
    {"name": "typedFunction", "symbols": ["type", {"literal":"."}, "untypedFunction"], "postprocess": typedFunction},
    {"name": "type", "symbols": ["identifier"], "postprocess": id},
    {"name": "untypedFunction", "symbols": ["identifier"], "postprocess": id},
    {"name": "identifier$ebnf$1", "symbols": []},
    {"name": "identifier$ebnf$1", "symbols": ["identifier$ebnf$1", /[a-zA-Z0-9]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "identifier", "symbols": [/[a-zA-Z]/, "identifier$ebnf$1"], "postprocess": identifier},
    {"name": "commentOrNlSeq$ebnf$1", "symbols": []},
    {"name": "commentOrNlSeq$ebnf$1$subexpression$1", "symbols": ["comment"]},
    {"name": "commentOrNlSeq$ebnf$1$subexpression$1", "symbols": ["nl"]},
    {"name": "commentOrNlSeq$ebnf$1", "symbols": ["commentOrNlSeq$ebnf$1", "commentOrNlSeq$ebnf$1$subexpression$1"], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "commentOrNlSeq", "symbols": ["commentOrNlSeq$ebnf$1"], "postprocess": commentOrNlSeq},
    {"name": "comment$ebnf$1", "symbols": []},
    {"name": "comment$ebnf$1", "symbols": ["comment$ebnf$1", /[^\n]/], "postprocess": function arrpush(d) {return d[0].concat([d[1]]);}},
    {"name": "comment", "symbols": [{"literal":"#"}, "comment$ebnf$1", "nl"], "postprocess": comment},
    {"name": "nl", "symbols": [{"literal":"\n"}], "postprocess": nuller}
]
  , ParserStart: "transformation"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
