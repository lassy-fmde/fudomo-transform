const { loadModel, loaders } = require('./model-io.js');

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
