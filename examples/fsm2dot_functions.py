def FSM_dot(header, states, transitions, footer):
    """Dot-file content
    :param header: The "header" of this FSM
    :param states: The "states" of this FSM
    :param transitions: The "transitions" of this FSM
    :param footer: The "footer" of this FSM
    """
    return header + states + transitions + footer

def FSM_states(cont_State_name):
    """List of states
    :param cont_State_name: The sequence of "name" values of State objects contained in this FSM
    :type  cont_State_name: Array
    """
    return '\n  '.join(cont_State_name) + '\n'

def FSM_transitions(cont_Transition_rep):
    """List of transitions
    :param cont_Transition_rep: The sequence of "rep" values of Transition objects contained in this FSM
    :type  cont_Transition_rep: Array
    """
    return '\n'.join(r[0] for r in cont_Transition_rep) + '\n'

def Transition_rep(source_State_name, target_State_name):
    """Representation of a transition
    This is a multiline comment
    :param source_State_name: The sequence of "name" values of State objects referred to by attribute "source" in this Transition
    :type  source_State_name: Array
    :param target_State_name: The sequence of "name" values of State objects referred to by attribute "target" in this Transition
    :type  target_State_name: Array
    """
    return [f'  {source_name}--{target_name}' for source_name, target_name in zip(source_State_name, target_State_name)]

def FSM_header():
    return 'graph {\n  '

def FSM_footer():
    return '}\n'
