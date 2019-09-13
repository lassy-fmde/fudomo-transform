const { loadModel, loaders, CenteredModel } = require('./model-io.js');
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
    ref1 >: target
    attr3: false
    ref2   >: target, target2
  - ChildObject:
    - name: child1
- ScalarChildObject: scalarChildValue
`;

function OY_TestObject() {
  const objectModel = loaders.oyaml.loadFromData(OYAML_TEST_SRC);
  return objectModel.getFeatureAsArray('cont')[2];
}

describe("oyaml2.1 loader", () => {
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

  test("scalar property", () => {
    const rootObjectModel = loaders.oyaml.loadFromData(OYAML_TEST_SRC);
    const scalarChildObject = rootObjectModel.getFeatureAsArray('cont')[3];
    expect(scalarChildObject).toHaveProperty('scalar', 'scalarChildValue');
  });

  test("type property", () => {
    const objectModel = loaders.oyaml.loadFromData(OYAML_TEST_SRC);

    const testObject = objectModel.getFeatureAsArray('cont')[2];
    expect(testObject).toHaveProperty('type', 'TestObject');

    const refTarget = objectModel.getFeatureAsArray('cont')[0];
    expect(refTarget).toHaveProperty('type', 'RefTarget');
  });

  test("featureNames property", () => {
    expect(OY_TestObject()).toHaveProperty('featureNames', ['singleScalar', 'ref1', 'attr3', 'ref2', 'cont']);
  });

  test("featureNames does not contain 'cont' when no objects are contained", () => {
    const objectModel = loaders.oyaml.loadFromData(OYAML_TEST_SRC);
    const refTarget = objectModel.getFeatureAsArray('cont')[0];
    expect(refTarget).toHaveProperty('featureNames', ['name']);
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
#OYAML2.1 format
- Family:
  - lastname: March
    father >: jim
    mother >: cindy
    sons >: brandon, toby
    daughters>: brandy
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
    expect(successors[0].center.id).toBe('brandon');
    expect(successors[1].center.id).toBe('toby');
  });
});
