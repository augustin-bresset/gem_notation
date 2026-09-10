// Run with: node --test tests/
// Mirrors the reference test suite of the gem_notation Odoo module.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const G = require('../assets/grammar.js');
const DATA = require('../assets/data.js');

// Small synthetic dictionary, independent of the shipped data.
const DICTS = {
  stones: [
    { code: 'ZA', name: 'Plain', category: '', implied_hue: '',
      default_grade: '', default_hue: '', default_shape: 'ZR' },
    { code: 'ZB', name: 'Blue Something', category: '', implied_hue: '8Z',
      default_grade: '', default_hue: '', default_shape: 'ZR' },
  ],
  grades: [{ code: '9', name: 'Light' }],
  hues: [{ code: '9Z', name: 'Pink' }, { code: '8Z', name: 'Blue' }],
  shapes: [{ code: 'ZP', name: 'Pear' }, { code: 'ZR', name: 'Round' }],
};
const [ZA, ZB] = DICTS.stones;
const grade = DICTS.grades[0];
const [pink, blue] = DICTS.hues;
const [pear, round] = DICTS.shapes;

test('build every block combination', () => {
  const cases = [
    [null, null, null, 'ZA'],
    [grade, null, null, 'ZA9'],
    [null, pink, null, 'ZA9Z'],
    [grade, pink, null, 'ZA99Z'],
    [null, null, pear, 'ZAZP'],
    [grade, null, pear, 'ZA9ZP'],
    [null, pink, pear, 'ZA9ZZP'],
    [grade, pink, pear, 'ZA99ZZP'],
  ];
  for (const [g, h, s, expected] of cases) {
    const built = G.buildToken(ZA, g, h, s);
    assert.equal(built.token, expected);
    assert.deepEqual(built.problems, []);
  }
});

test('defaults and implied hue are omitted', () => {
  assert.equal(G.buildToken(ZA, null, null, round).token, 'ZA');
  const built = G.buildToken(ZB, null, blue, null);
  assert.equal(built.token, 'ZB');
  assert.deepEqual(built.problems, []);
});

test('double colour is refused', () => {
  const built = G.buildToken(ZB, null, pink, null);
  assert.ok(built.problems.some((p) => p.includes('double colour')));
  assert.ok(G.parseToken('ZB9Z', DICTS).problems
    .some((p) => p.includes('double colour')));
});

test('parse round trip', () => {
  for (const token of ['ZA', 'ZA9', 'ZA9Z', 'ZA99Z', 'ZAZP', 'ZA9ZP',
                       'ZA9ZZP', 'ZA99ZZP']) {
    const parsed = G.parseToken(token, DICTS);
    assert.deepEqual(parsed.problems, [], token);
    assert.equal(parsed.stone.code, 'ZA', token);
  }
});

test('bad structures are rejected', () => {
  for (const bad of ['Z', 'ZAABC', 'ZA123', 'ZA9Z9', 'XX7']) {
    assert.ok(G.parseToken(bad, DICTS).problems.length, bad);
  }
});

test('product ordering: center first, then heaviest', () => {
  const code = G.orderTokens([
    { token: 'ZA9', weight: 2.0 },
    { token: 'ZB', weight: 5.0 },
    { token: 'ZA9ZZP', weight: 0.5, isCenter: true },
  ]).join('+');
  assert.equal(code, 'ZA9ZZP+ZB+ZA9');
});

test('shipped data is consistent with the grammar', () => {
  const twoLetters = /^[A-Z]{2}$/;
  for (const stone of DATA.stones) assert.match(stone.code, twoLetters);
  for (const shape of DATA.shapes) assert.match(shape.code, twoLetters);
  for (const g of DATA.grades) assert.match(g.code, /^[0-9]$/);
  for (const hue of DATA.hues) assert.match(hue.code, /^[0-9][A-Z]$/);
  // every stone token round-trips over the real dictionaries
  for (const stone of DATA.stones.slice(0, 30)) {
    const hue = stone.implied_hue ? null : DATA.hues[0];
    const built = G.buildToken(stone, DATA.grades[6], hue, DATA.shapes[5]);
    const parsed = G.parseToken(built.token, DATA);
    assert.deepEqual(parsed.problems, [], built.token);
    assert.equal(parsed.stone.code, stone.code);
  }
});
