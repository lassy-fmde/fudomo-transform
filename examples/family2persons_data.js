// TODO id?

class Member {
  constructor(firstName) {
    this.firstName = firstName;
  }
}

class Family {
  constructor(lastName, father, sons, cont) {
    this.lastName = lastName;
    this.father = father;
    this.sons = sons;
    this.cont = cont;
  }
}

let member1 = new Member('John');
let member2 = new Member('Jack');
let member3 = new Member('Jules');
let member4 = new Member('Juliet');

let cont = [member1, member2, member3, member4];

let family = new Family('Smith', member1, [member2, member3], cont);

module.exports = family;
