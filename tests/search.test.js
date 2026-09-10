// Run with: node --test tests/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { search, normalize } = require('../assets/search.js');
const DATA = require('../assets/data.js');

const ROWS = [
  { code: '1B', name: 'Black' },
  { code: '1J', name: 'Jadeite' },
  { code: '2J', name: 'Jasper' },
  { code: '1A', name: 'Améthyste' },
  { code: 'JA', name: 'Unrelated' },
];

test('a typed name beats a code that happens to match first', () => {
  // the display label starts with "1J" but typing the NAME must win
  assert.equal(search(ROWS, 'jadeite')[0].code, '1J');
  assert.equal(search(ROWS, 'jade')[0].code, '1J');
});

test('an exact code still wins', () => {
  assert.equal(search(ROWS, '1J')[0].code, '1J');
  assert.equal(search(ROWS, 'JA')[0].code, 'JA');
});

test('accents and case are ignored', () => {
  assert.equal(normalize('Améthyste'), 'amethyste');
  assert.equal(search(ROWS, 'amethyste')[0].code, '1A');
  assert.equal(search(ROWS, 'AMETHYSTE')[0].code, '1A');
});

test('name prefixes rank alphabetically among themselves', () => {
  const codes = search(ROWS, 'ja').map((r) => r.code);
  // 'ja' IS the code JA, so the exact code comes first by design;
  // then the name prefixes, alphabetically: Jadeite, Jasper.
  assert.deepEqual(codes.slice(0, 3), ['JA', '1J', '2J']);
});

test('empty query returns everything in order', () => {
  assert.equal(search(ROWS, '').length, ROWS.length);
});

test('works over the shipped dictionaries', () => {
  assert.equal(search(DATA.stones, 'sapphire')[0].code, 'SA');
  assert.equal(search(DATA.stones, 'SA')[0].code, 'SA');
  assert.equal(search(DATA.stones, 'diamond')[0].name, 'Diamond');
});
