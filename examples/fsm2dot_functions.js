module.exports = {
  /**
   * @param header The "header" of the center FSM
   * @param states The "states" of the center FSM
   * @param transitions The "transitions" of the center FSM
   * @param footer The "footer" of the center FSM
   */
  FSM_fsm2dot: function(header, states, transitions, footer) {
    return header + states + transitions + footer;
  },

  /**
   * @param states_State_name {Array} The sequence of "name" values of State
   *                                  objects referred to by attribute "states"
   *                                  in the center FSM
   */
  FSM_states: function(states_State_name) {
    return '  ' + states_State_name.join('\n  ') + '\n';
  },

  /**
   * @param transitions_Transition_rep {Array} The sequence of "rep" values of
   *                                           Transition objects referred to
   *                                           by attribute "transitions" in
   *                                           the center FSM
   */
  FSM_transitions: function(transitions_Transition_rep) {
    return transitions_Transition_rep.join('\n') + '\n';
  },

  /**
   * @param source_State_name {Array} The sequence of "name" values of State
   *                                  objects referred to by attribute "source"
   *                                  in the center Transition
   * @param target_State_name {Array} The sequence of "name" values of State
   *                                  objects referred to by attribute "target"
   *                                  in the center Transition
   */
  Transition_rep: function(source_State_name, target_State_name) {
    return '  ' + source_State_name + '--' + target_State_name;
  },

  FSM_header: function() {
    return 'graph {\n';
  },

  FSM_footer: function() {
    return '}\n';
  },

};
