module.exports = {
  Family_family2persons: function(cont_Member_isMale, cont_Member_fullName) {
    let res = '';
    for (const i in cont_Member_isMale) {
      const gender = cont_Member_isMale[i] ? 'M' : 'F';
      const fullName = cont_Member_fullName[i];
      res += fullName + ' (' + gender + ')\n';
    }
    return res;
  },
  Member_fullName: function(firstName, _cont_Family_lastName) {
    return firstName + ' ' + _cont_Family_lastName.values().next().value;
  },
  Member_isMale: function(_sons_Family_center, _father_Family_center) {
    return _sons_Family_center.size > 0 || _father_Family_center.size > 0;
  },
};
