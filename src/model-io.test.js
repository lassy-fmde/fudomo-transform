const { CenteredModel } = require('./model-io.js');
const { loadModel, loaders } = require('./model-io-node.js');
const YAML = require('yaml');

// JSObjectModel tests ---------------------------------------------------------

class TestNode {
  constructor() {
    this.name = 'x';
  }
}

class TestRoot {
  constructor() {
    this.singleScalar = 'scalar'; // arrays of scalars are not allowed in fudomo
    this.singleNode = new TestNode();
    this.arrayOfNodes = [new TestNode()];
  }
}

const TEST_ROOT = new TestRoot();

function R_JS() {
  const objectModel = loaders.js.loadFromData(TEST_ROOT);
  return objectModel.getFeatureAsArray('cont')[0];
}

function N_JS() {
  return R_JS().getFeature('nodes')[0];
}

describe("js loader", () => {
  test("loader exists", () => {
    expect(loaders).toHaveProperty('js');
  });
  test("can load object graph from data", () => {
    const objectModel = loaders.js.loadFromData(TEST_ROOT);
    expect(objectModel).toBeDefined();
  });
  test("root wrapper content", () => {
    const objectModel = loaders.js.loadFromData(TEST_ROOT);
    expect(objectModel.getFeatureAsArray('cont')[0]).toHaveProperty('obj', TEST_ROOT);
  });
  test("object wrapper identity", () => {
    const objectModel = R_JS();
    const testObject1 = objectModel.getFeature('singleNode');
    const testObject2 = objectModel.getFeature('singleNode');
    expect(testObject1).toBe(testObject2);
  });
  test("getFeature (scalar)", () => {
    expect(R_JS().getFeature('singleScalar')).toBe('scalar');
  });
  test("getFeature (object)", () => {
    expect(R_JS().getFeature('singleNode').constructor.name).toBe('JSObject');
  });
  test("getFeature (array of objects)", () => {
    expect(R_JS().getFeature('arrayOfNodes')).toHaveLength(1);
    expect(R_JS().getFeature('arrayOfNodes')[0].constructor.name).toBe('JSObject');
  });
  test("scalar property", () => {
    const objectModel = loaders.js.loadFromData(TEST_ROOT);
    expect(R_JS()).toHaveProperty('scalar', TEST_ROOT);
  });
  test("type property", () => {
    const objectModel = loaders.js.loadFromData(TEST_ROOT);
    expect(R_JS()).toHaveProperty('type', 'TestRoot');
  });
  test("featureNames property", () => {
    const objectModel = loaders.js.loadFromData(TEST_ROOT);
    expect(R_JS()).toHaveProperty('featureNames', ['singleScalar', 'singleNode', 'arrayOfNodes']);
  });
});

// OYAMLObjectModel tests ------------------------------------------------------

const OYAML_TEST_SRC = `
#OYAML2 format
- RefTarget target:
  - name: foo
- RefTarget target2:
  - name: test
- TestObject:
  - singleScalar: 'scalar'
  - ref1 >: target
  - attr3: false
  - ref2   >: target, target2
  - ref3 >: nonExisting
  - ChildObject:
    - name: child1
- ScalarChildObject: scalarChildValue
`;

function OY_TestObject() {
  const objectModel = loaders.oyaml.loadFromData(OYAML_TEST_SRC);
  return objectModel.getFeatureAsArray('cont')[2];
}

function OY_TestSyntax(oyaml, errorMessage) {
  function escape(s) {
    return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  };
  const errorRe = new RegExp('^\\(\\d+:\\d+\\) ' + escape(errorMessage) + '$');
  expect(() => loaders.oyaml.loadFromData(oyaml)).toThrow(errorRe);
}

describe("oyaml2.2 loader", () => {
  test("loader exists", () => {
    expect(loaders).toHaveProperty('oyaml');
  });
  test("can load object graph from data", () => {
    const objectModel = loaders.oyaml.loadFromData(OYAML_TEST_SRC);
    expect(objectModel).toBeDefined();
  });
  test("root wrapper content", () => {
    const objectModel = loaders.oyaml.loadFromData(OYAML_TEST_SRC);
    expect(objectModel).toHaveProperty('id', 'root');
    expect(objectModel).toHaveProperty('type', 'Root');
    expect(objectModel).toHaveProperty('featureNames', ['cont']);

    const rootContent = objectModel.getFeatureAsArray('cont');
    expect(rootContent).toHaveLength(4);
  });
  test("object wrapper identity", () => {
    const objectModel = loaders.oyaml.loadFromData(OYAML_TEST_SRC);
    const testObject1 = objectModel.getFeatureAsArray('cont')[2];
    const testObject2 = objectModel.getFeatureAsArray('cont')[2];
    expect(testObject1).toBe(testObject2);
  });
  test("getFeature (scalar)", () => {
    expect(OY_TestObject().getFeature('singleScalar')).toBe('scalar');
  });
  test("getFeature (object reference)", () => {
    const target = OY_TestObject().getFeature('ref1');
    expect(target).toHaveProperty('type', 'RefTarget');
    expect(target).toHaveProperty('id', 'target');
    expect(target.getFeature('name')).toBe('foo');
  });

  test("getFeature (array of object references)", () => {
    const targets = OY_TestObject().getFeature('ref2');
    expect(targets).toHaveLength(2);
    expect(targets[0]).toHaveProperty('id', 'target');
    expect(targets[1]).toHaveProperty('id', 'target2');
  });

  test("Invalid reference", () => {
    // Regression test
    expect(() => OY_TestObject().getFeature('ref3')).toThrow();
  });

  test("scalar property", () => {
    const rootObjectModel = loaders.oyaml.loadFromData(OYAML_TEST_SRC);
    const scalarChildObject = rootObjectModel.getFeatureAsArray('cont')[3];
    expect(scalarChildObject).toHaveProperty('scalar', 'scalarChildValue');
  });

  test("scalar object cont", () => {
    const rootObjectModel = loaders.oyaml.loadFromData(OYAML_TEST_SRC);
    const scalarChildObject = rootObjectModel.getFeatureAsArray('cont')[3];
    expect(scalarChildObject.getFeatureAsArray('cont')).toHaveLength(0);
  });

  test("type property", () => {
    const objectModel = loaders.oyaml.loadFromData(OYAML_TEST_SRC);

    const testObject = objectModel.getFeatureAsArray('cont')[2];
    expect(testObject).toHaveProperty('type', 'TestObject');

    const refTarget = objectModel.getFeatureAsArray('cont')[0];
    expect(refTarget).toHaveProperty('type', 'RefTarget');
  });

  test("featureNames property", () => {
    expect(OY_TestObject()).toHaveProperty('featureNames', ['singleScalar', 'ref1', 'attr3', 'ref2', 'ref3', 'cont']);
  });

  test("featureNames does not contain 'cont' when no objects are contained", () => {
    const objectModel = loaders.oyaml.loadFromData(OYAML_TEST_SRC);
    const refTarget = objectModel.getFeatureAsArray('cont')[0];
    expect(refTarget).toHaveProperty('featureNames', ['name']);
  });

  test("empty yaml file is loaded as Root with empty content", () => {
    const objectModel = loaders.oyaml.loadFromData('');
    expect(objectModel).toHaveProperty('featureNames', []);
    const content = objectModel.getFeatureAsArray('cont');
    expect(content).toHaveLength(0);
  });

  // Syntax validator tests using counter-examples
  const SYNTAX_TESTS = [
    ['{}', 'Root has to be Array'],
    ['"string"', 'Root has to be Array'],
    ['1', 'Root has to be Array'],
    ['true', 'Root has to be Array'],
    ['null', 'Root has to be Array'],
    ['- String', 'Attribute, reference or contained object map must have 1 mapping'],
    [`
      - key1: 1
        key2: 2
      `,
      'Attribute, reference or contained object map must have 1 mapping'
    ],
    ['- 1: test', 'Attribute, reference or contained object key has to be string scalar'],
    ['- []: test', 'Attribute, reference or contained object key has to be string scalar'],
    ['- {}: test', 'Attribute, reference or contained object key has to be string scalar'],
    ['- a b c: test', 'Invalid object key (must be "Type [identifier]")'],
    ['- Test: {}', 'Object value must be sequence or scalar'],
    [`
      - Test:
        - []`,
      'Attribute, reference or contained object map must have 1 mapping'
    ],
    [`
      - Test:
        - 1`,
      'Attribute, reference or contained object map must have 1 mapping'
    ],
    [`
      - Test:
        - 1: test`,
      'Attribute, reference or contained object key has to be string scalar'
    ],
    [`
      - Test:
        - []: test`,
      'Attribute, reference or contained object key has to be string scalar'
    ],
    [`
      - Test:
        - null: test`,
      'Attribute, reference or contained object key has to be string scalar'
    ],
    [`
      - Test:
        - attr: []`,
      'Attribute has to be scalar'
    ],
    [`
      - Test:
        - ref>>: test`,
      'Invalid reference key (too many ">")'
    ],
    [`
      - Test:
        - ref >: 1`,
      'Reference specification must be string scalar'
    ],
    [`
      - Test:
        - ref >: []`,
      'Reference specification must be string scalar'
    ],
  ];
  test.each(SYNTAX_TESTS)('Syntax validation test %#', (example, expected_error) => OY_TestSyntax(example, expected_error));

  test("fullDefinitionLocation of Root", () => {
    const root = loaders.oyaml.loadFromData(OYAML_TEST_SRC);
    expect(root.fullDefinitionLocation).toEqual([[0, 0], [14, 37]]);
  });

  test("typeLocation of Root", () => {
    const root = loaders.oyaml.loadFromData(OYAML_TEST_SRC);
    expect(root.typeLocation).toEqual([[0, 0], [14, 37]]);
  });

  test("fullDefinitionLocation of TestObject", () => {
    expect(OY_TestObject().fullDefinitionLocation).toEqual([[6, 2], [13, 19]]);
  });

  test("typeLocation of TestObject", () => {
    expect(OY_TestObject().typeLocation).toEqual([[6, 2], [6, 12]]);
  });

  test("getFeatureNameLocation of TestObject (attr3)", () => {
    expect(OY_TestObject().getFeatureNameLocation('attr3')).toEqual([[9, 4], [9, 9]]);
  });

  test("getFeatureNameLocation of TestObject (ref2)", () => {
    expect(OY_TestObject().getFeatureNameLocation('ref2')).toEqual([[10, 4], [10, 8]]);
  });

  test("getFeatureValueLocation of TestObject (attr3)", () => {
    expect(OY_TestObject().getFeatureValueLocation('attr3')).toEqual([[9, 11], [9, 16]]);
  });

  test("getFeatureValueLocation of TestObject (ref2)", () => {
    expect(OY_TestObject().getFeatureValueLocation('ref2')).toEqual([[10, 14], [10, 29]]);
  });

  test("scalarValueLocation of ScalarChildObject", () => {
    const root = loaders.oyaml.loadFromData(OYAML_TEST_SRC);
    expect(root.getFeatureAsArray('cont')[3].scalarValueLocation).toEqual([[14, 21], [14, 37]]);
  });
});

describe("yaml loader", () => {
  test("loader exists and is instance of OYAMLLoader", () => {
    expect(loaders).toHaveProperty('yaml');
    expect(loaders['yaml'].constructor.name).toBe('OYAMLObjectLoader');
  });
});

// CenteredModel tests ---------------------------------------------------------

const CENTERED_MODEL_TEST_DATA = `
#OYAML2.2 format
- Family:
  - lastname: March
  - father >: jim
  - mother >: cindy
  - sons >: brandon, toby
  - daughters >: brandy
  - Member jim:
    - firstName: Jim
  - Member cindy:
    - firstName: Cindy
  - Member brandon:
    - firstName: Brandon
  - Member toby:
    - firstName: Toby
  - Member brandy:
    - firstName: Brandy
`;

function ROOT_CM() {
  const objectModel = loaders.oyaml.loadFromData(CENTERED_MODEL_TEST_DATA);
  return loaders.oyaml.getRootCenteredModel(objectModel);
}

describe('CenteredModel', () => {
  test('predecessors', () => {
    const root_cm = ROOT_CM()
    const family = root_cm.getFeature('cont')[0];
    const jim = family.getFeature('cont')[0];
    expect(jim).toBeDefined();
    expect(jim).toHaveProperty('id', 'jim');

    const jim_cm = new CenteredModel(root_cm.model, jim);

    const predecs = jim_cm.predecessors('father', 'Family');
    expect(predecs.size).toBe(1);
    expect(predecs.values().next().value.center).toEqual(family);
  });

  test('successors', () => {
    const root_cm = ROOT_CM()
    const family = root_cm.getFeature('cont')[0];
    const family_cm = new CenteredModel(root_cm.model, family);

    const successors = family_cm.successors('sons', 'Member');
    expect(successors).toBeDefined();
    expect(successors).toHaveLength(2);
    expect(successors[0].center.refId).toBe('brandon');
    expect(successors[1].center.refId).toBe('toby');
  });
});
