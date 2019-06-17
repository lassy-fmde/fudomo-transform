// TODO id?

class State {
  constructor(name) {
    this.name = name;
  }
}

class Transition {
  constructor(source, target) {
    this.source = source;
    this.target = target;
  }
}

class FSM {
  constructor(states, transitions) {
    this.states = states;
    this.transitions = transitions;
  }
}

let state1 = new State('state1');
let state2 = new State('state2');
let state3 = new State('state3');

let trans1 = new Transition(state1, state2);
let trans2 = new Transition(state2, state3);

let fsm = new FSM([state1, state2, state3], [trans1, trans2]);

module.exports = fsm;
