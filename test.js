const { Transformation, getFudomoParser } = require('./ast.js');

const FUDOMO_TEST =
`
# Fudomo example that exercises (hopefully) every aspect of the syntax

Root.f: x, val, center

# Comment between decompositions

Foo.bar:
  cont -> Type.prop, rev <- Type.myprop, val,
  ref -> test.center,
  ref -> test.val,
  cont -> Object.prop,
  cont <- Type.myprop

Type.prop:

Object.f:

`;

function T() {
  return new Transformation(FUDOMO_TEST);
}

test("transformation tree is not empty", () => {
  expect(T().tree).toBeDefined();
  expect(T().tree.decompositions).toBeDefined();
  expect(T().tree.decompositions).toHaveLength(6); // comments are included
});

test('transformation does not report syntax error', () => {
  expect(T().hasError).toBeFalsy();
});

test('decompositions are parsed', () => {
  expect(T().decompositions).toHaveLength(4);
});

test('decomposition is found by signature', () => {
  expect(T().getDecompositionBySignature('Root.f')).toBeDefined();
});

function D(index) {
  return T().decompositions[index];
}

test("non-existent decomposition is not found by signature", () => {
  expect(T().getDecompositionBySignature('_')).toBeNull();
});

test('decomposition is found by index', () => {
  expect(D(0)).toBeDefined();
});

test('decomposition type is parsed', () => {
  //expect(T()).toHaveProperty(['decompositions', 0, 'function', 'type'], 'Root');
  expect(D(0)).toHaveProperty('function.type', 'Root');
});

test('decomposition function name is parsed', () => {
  expect(D(0)).toHaveProperty('function.name', 'f');
});

test('decomposition local link is parsed', () => {
  expect(D(0).links).toHaveLength(3);
});

test("localLink name is parsed", () => {
  expect(D(0).links[0]).toHaveProperty('function.name', 'x');
  expect(D(0).links[0]).toHaveProperty('parameterName', 'x');
});

test("localLink parameter description (property)", () => {
  const link = D(0).links[0];
  const desc = `The "${link.parameterName}" of this ${link.decomposition.function.type}`;
  expect(link.parameterDescription).toBe(desc);
});

test("localLink parameter description (val)", () => {
  const link = D(0).links[1];
  const desc = `The value of this ${link.decomposition.function.type}`;
  expect(link.parameterDescription).toBe(desc);
});

test("localLink parameter description (center)", () => {
  const link = D(0).links[2];
  const desc = `This ${link.decomposition.function.type}`;
  expect(link.parameterDescription).toBe(desc);
});

test("localLink parameterTypeDescription", () => {
  expect(D(0).links[0].parameterTypeDescription).toBeNull();
});

test("forward link is parsed", () => {
  expect(D(1).links[0]).toHaveProperty('referenceName', 'cont');
  expect(D(1).links[0]).toHaveProperty('parameterName', 'cont_Type_prop');
  expect(D(1).links[0]).toHaveProperty('function.type', 'Type');
  expect(D(1).links[0]).toHaveProperty('function.name', 'prop');
});

test("reverse link is parsed", () => {
  expect(D(1).links[1]).toHaveProperty('referenceName', 'rev');
  expect(D(1).links[1]).toHaveProperty('parameterName', '_rev_Type_myprop');
  expect(D(1).links[1]).toHaveProperty('function.type', 'Type');
  expect(D(1).links[1]).toHaveProperty('function.name', 'myprop');
});

test("forwardLink parameterDescription (cont)", () => {
  const link = D(1).links[0];
  expect(link.parameterDescription).toBe(`The sequence of ${link.function.pluralValueDescription} contained in this ${link.decomposition.function.type}`);
});

test("forwardLink parameterDescription (non-cont)", () => {
  const link = D(1).links[3];
  expect(link.parameterDescription).toBe(`The sequence of ${link.function.pluralValueDescription} referred to by attribute "${link.referenceName}" in this ${link.decomposition.function.type}`);
});

test("forwardLink parameterTypeDescription", () => {
  expect(D(1).links[0].parameterTypeDescription).toBe('Array');
});

test("errors are set", () => {
  const t = new Transformation('not valid fudomo');
  expect(t.hasError).toBe(true);
  expect(t.errors).not.toHaveLength(0);
});

test("externalFunctions getter throws Error if not set", () => {
  expect(() => T().externalFunctions).toThrow();
});

test("externalFunctions setter", () => {
  const t = T();
  const value = {};
  t.externalFunctions = value;
  expect(t.externalFunctions).toEqual(value);
});

test("typedFunction pluralValueDescription(property)", () => {
  const f = D(1).links[0].function;
  expect(f.pluralValueDescription).toBe(`"${f.name}" values of ${f.type} objects`);
});

test("typedFunction pluralValueDescription(center)", () => {
  const f = D(1).links[3].function;
  expect(f.pluralValueDescription).toBe(`${f.type} objects`);
});

test("typedFunction pluralValueDescription(val)", () => {
  const f = D(1).links[4].function;
  expect(f.pluralValueDescription).toBe(`${f.type} scalar values`);
});

test("typedFunction externalName", () => {
  expect(D(0).function.externalName).toBe('Root_f');
});

test("typedFunction isAbstract", () => {
  expect(D(0).function.isAbstract).toBe(false);
  expect(T().getDecompositionBySignature('Object.f').function.isAbstract).toBe(true);
});

test("typedFunction externalFunction", () => {
  const t = T()
  t.externalFunctions = { Root_f: 'marker' };
  expect(t.decompositions[0].function.externalFunction).toEqual('marker');
});

test("typedFunction getTargetDecomposition", () => {
  // Test when link refers to concrete type
  const t = T();
  const target = t.getDecompositionBySignature('Type.prop');
  expect(t.decompositions[1].links[0].function.getTargetDecomposition(null)).toEqual(target);

  // Test when link refers to abstract type
  const centeredModel = { type: 'Type' };
  expect(t.decompositions[1].links[5].function.getTargetDecomposition(centeredModel)).toEqual(target);
});

test("untypedFunction getTargetDecomposition", () => {
  const t = new Transformation('Root.f: x\nRoot.x: val\n');
  const target = t.getDecompositionBySignature('Root.x');
  expect(t.decompositions[0].links[0].function.getTargetDecomposition(null)).toEqual(target);
});

test("untypedFunction qualifiedName", () => {
  expect(D(0).links[0].function.qualifiedName).toBe('x');
});

test("reverseLink parameterTypeDescription", () => {
  expect(D(1).links[1].parameterTypeDescription).toBe('Set');
});

test("reverseLink parameterDescription (cont)", () => {
  const link = D(1).links[6];
  expect(link.parameterDescription).toBe(`The set of ${link.function.pluralValueDescription} that contain this ${link.decomposition.function.type}`);
});

test("reverseLink parameterDescription (non-cont)", () => {
  const link = D(1).links[1];
  expect(link.parameterDescription).toBe(`The set of ${link.function.pluralValueDescription} that refer to this ${link.decomposition.function.type} by attribute "${link.referenceName}"`);
});
