// Run with: node --test tests/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const V = require('../assets/variety.js');
const DATA = require('../assets/variety-data.js');

// Small synthetic data, independent of the shipped data.
const row = (type, shade, family, values, lines) => Object.assign({
  type, shade, family, colour: '', grade: '', treatment: '', effect: '',
  status: 'ok', note: '', stones: 1, lines,
  written: { products: 0, bare: 0, full: 0, forms: '' },
}, values);
const family = (id, name, code, axes, defaultColour, legacyTypes) => ({
  id, name, category: 'P', code, legacy_types: legacyTypes || [code], axes,
  default_colour: defaultColour || '', look: '', note: '',
});
const type = (code, fam, colour, treatment) => (
  { code, family: fam, colour: colour || '', treatment: treatment || '', article: code.slice(0, 2) });
const shade = (code, values) => Object.assign(
  { code, family: '', colour: '', grade: '', treatment: '', effect: '' }, values);
const SMALL = {
  categories: [{ code: 'P', name: 'Precious' }],
  families: [
    family('sapphire', 'Sapphire', 'SA', ['colour', 'grade']),
    family('topaz', 'Topaz', 'TOP', ['colour', 'grade'], 'BL', ['TOP', 'BT']),
    family('peridot', 'Peridot', 'PER', []),
    family('diamond', 'Diamond', 'DTS', ['colour'], 'WH'),
    family('jade', 'Jade', 'JAD', ['colour'], '', ['JAD', 'DYJ']),
  ],
  colours: [{ id: 'PK', name: 'Pink' }, { id: 'CE', name: 'Ceylon' }, { id: 'BL', name: 'Blue' },
            { id: 'WH', name: 'White' }, { id: 'BR', name: 'Brown' }, { id: 'LV', name: 'Lavender' }],
  grades: [{ id: 'A', name: 'Light', scale: 'tone' }, { id: 'AA', name: 'Medium', scale: 'tone' },
           { id: 'AAA', name: 'Dark', scale: 'tone' }, { id: 'SIP1', name: 'SI-P1', scale: 'clarity' },
           { id: 'VS', name: 'VS', scale: 'clarity' }],
  treatments: [{ id: 'DYED', name: 'Dyed' }],
  effects: [],
  legacy_types: [type('SA', 'sapphire'), type('TOP', 'topaz'), type('BT', 'topaz', 'BL'),
                 type('PER', 'peridot'), type('DTS', 'diamond'), type('JAD', 'jade'),
                 type('DYJ', 'jade', '', 'DYED')],
  legacy_shades: [
    shade('PL', { colour: 'PK', grade: 'A' }), shade('PLM', { colour: 'PK', grade: 'A' }),
    shade('LC', { colour: 'CE', grade: 'A' }), shade('PK', { colour: 'PK' }),
    shade('BR', { colour: 'BR' }), shade('LAV', { colour: 'LV' }),
    shade('A', { grade: 'A' }), shade('AA', { grade: 'AA' }), shade('AAA', { grade: 'AAA' }),
    shade('W1', { colour: 'WH', grade: 'SIP1' }), shade('W2', { colour: 'WH', grade: 'VS' }),
  ],
  legacy: [
    row('SA', 'PL', 'sapphire', { colour: 'PK', grade: 'A' }, 100),
    row('SA', 'PLM', 'sapphire', { colour: 'PK', grade: 'A' }, 3),
    row('SA', 'LC', 'sapphire', { colour: 'CE', grade: 'A' }, 60),
    row('BT', 'A', 'topaz', { colour: 'BL', grade: 'A' }, 50),
    row('BT', 'AAA', 'topaz', { colour: 'BL', grade: 'AAA' }, 20),
    row('PER', '', 'peridot', {}, 80),
    row('PER', 'A', 'peridot', { grade: 'A' }, 3),
    row('DTS', 'W1', 'diamond', { colour: 'WH', grade: 'SIP1' }, 200),
    row('DTS', 'W2', 'diamond', { colour: 'WH', grade: 'VS' }, 40),
    row('DTS', 'BR', 'diamond', { colour: 'BR' }, 20),
    row('DYJ', 'LAV', 'jade', { colour: 'LV', treatment: 'DYED' }, 10),
  ],
  metrics: {
    products: 100, lines: 586, duplicates: 2,
    family_only: { indexed: 40, max: 9, over9: 0, models_over9: 0 },
    every_axis: { indexed: 5, max: 2, over9: 0, models_over9: 0 },
    proposal: { indexed: 8, max: 3, over9: 0, models_over9: 0 },
    families: {
      sapphire: { lines: 163, axes: ['c', 'g'], options: {
        '': { indexed: 30, max: 6 }, c: { indexed: 10, max: 4 }, g: { indexed: 20, max: 5 }, cg: { indexed: 0, max: 3 } } },
      peridot: { lines: 83, axes: ['g'], options: { '': { indexed: 0, max: 3 }, g: { indexed: -3, max: 3 } } },
    },
  },
};
const proposal = V.proposal(SMALL);
const codeOf = (built, desc) => V.varietyOf(built, desc).code;

test("a variety keeps today's code of its main stone", () => {
  const built = V.build(SMALL, proposal);
  assert.equal(codeOf(built, { family: 'sapphire', colour: 'PK', grade: 'A' }), 'SAPL');
  assert.equal(codeOf(built, { family: 'sapphire', colour: 'CE', grade: 'A' }), 'SALC');
  assert.equal(codeOf(built, { family: 'topaz', colour: 'BL', grade: 'A' }), 'BTA');
  assert.equal(codeOf(built, { family: 'topaz', colour: 'BL', grade: 'AAA' }), 'BTAAA');
  const pink = V.varietyOf(built, { family: 'sapphire', colour: 'PK', grade: 'A' });
  assert.deepEqual(pink.legacy.map(V.legacyCode), ['SAPL', 'SAPLM']);
  assert.equal(pink.origin, 'today');
  assert.deepEqual(built.problems, []);
});

test('what the family does not write drops out', () => {
  const built = V.build(SMALL, proposal);
  const peridot = V.varietyOf(built, { family: 'peridot', grade: 'A' });
  assert.equal(peridot.code, 'PER');
  assert.equal(peridot.lines, 83);
  assert.equal(V.nameOf(built, peridot), 'Peridot');
  // every pink sapphire here is light: SAPL says nothing untrue of them
  const merged = V.build(SMALL, { ...proposal, sapphire: ['colour'] });
  assert.equal(codeOf(merged, { family: 'sapphire', colour: 'PK', grade: 'A' }), 'SAPL');
  // a new pink sapphire of another grade joins the same variety
  assert.equal(codeOf(merged, { family: 'sapphire', colour: 'PK', grade: 'AAA' }), 'SAPL');
});

test('the default colour is never written, and a stone without colour has it', () => {
  const built = V.build(SMALL, proposal);
  const white = V.varietyOf(built, { family: 'diamond', colour: 'WH', grade: 'VS' });
  assert.equal(white.code, 'DTS');
  assert.equal(white.lines, 240);
  assert.equal(V.varietyOf(built, { family: 'diamond' }), white);
  assert.equal(codeOf(built, { family: 'diamond', colour: 'BR' }), 'DTSBR');
  // the type may carry the default colour: Blue Topaz stays BT
  assert.equal(codeOf(built, { family: 'topaz', colour: '', grade: 'A' }), 'BTA');
});

test('a stone code saying more is kept when every stone of the variety shares it', () => {
  const built = V.build(SMALL, proposal);
  const lavender = V.varietyOf(built, { family: 'jade', colour: 'LV', treatment: 'DYED' });
  assert.equal(lavender.code, 'DYJLAV');
  assert.equal(lavender.origin, 'today');
});

test("a combination never seen is written with today's pieces, or flagged to be named", () => {
  const built = V.build(SMALL, proposal);
  const pinkTopaz = V.varietyOf(built, { family: 'topaz', colour: 'PK' });
  assert.equal(pinkTopaz.code, 'TOPPK');
  assert.equal(pinkTopaz.origin, 'pieces');
  assert.ok(pinkTopaz.isNew);
  const blueSapphire = V.varietyOf(built, { family: 'sapphire', colour: 'BL', grade: 'AA' });
  assert.equal(blueSapphire.code, 'SABLUEAA');
  assert.equal(blueSapphire.origin, 'to-name');
});

test('tones are written as letters, digits, or as product codes write them', () => {
  const letters = V.build(SMALL, proposal);
  const digits = V.build(SMALL, proposal, { tones: 'digits' });
  const usual = V.build(SMALL, proposal, { tones: 'usual' });
  const light = { family: 'topaz', colour: 'BL', grade: 'A' };
  const dark = { family: 'topaz', colour: 'BL', grade: 'AAA' };
  assert.deepEqual([codeOf(letters, light), codeOf(letters, dark)], ['BTA', 'BTAAA']);
  assert.deepEqual([codeOf(digits, light), codeOf(digits, dark)], ['BT1A', 'BT3A']);
  assert.deepEqual([codeOf(usual, light), codeOf(usual, dark)], ['BTA', 'BT3A']);
  // fused colour-tone shades do not change
  assert.equal(codeOf(digits, { family: 'sapphire', colour: 'PK', grade: 'A' }), 'SAPL');
  // a code reads in any writing
  const read = V.read(digits, 'BTAAA+BT3A+BTA');
  assert.deepEqual(read.tokens.map((t) => t.variety && t.variety.code), ['BT3A', 'BT3A', 'BT1A']);
  assert.deepEqual(digits.problems, []);
});

test('product code: model, centre first, heaviest next, metal, variant index', () => {
  const entries = [
    { code: 'DTS', weight: 0.01 },
    { code: 'SALC', weight: 0.5 },
    { code: 'SAPM', weight: 0.2, isCenter: true },
  ];
  assert.equal(V.productCode(entries, 'R1048', 'W'), 'R1048-SAPM+SALC+DTS/W');
  assert.equal(V.productCode(entries, 'R1048', 'W', 1), 'R1048-SAPM+SALC+DTS/W');
  assert.equal(V.productCode(entries, 'R1048', 'W', 3), 'R1048-SAPM+SALC+DTS/W-3');
  assert.equal(V.productCode(entries.slice(0, 2)), 'SALC+DTS');
});

test('a product code reads back into varieties', () => {
  const built = V.build(SMALL, proposal);
  const read = V.read(built, 'r1048-sapl+dts+zz/w-2');
  assert.equal(read.model, 'R1048');
  assert.equal(read.metal, 'W');
  assert.equal(read.index, 2);
  assert.deepEqual(read.tokens.map((t) => t.code), ['SAPL', 'DTS', 'ZZ']);
  assert.equal(V.nameOf(built, read.tokens[0].variety), 'Sapphire · Pink · Light');
  assert.equal(V.nameOf(built, read.tokens[1].variety), 'Diamond · White');
  assert.equal(read.tokens[2].variety, null);
  assert.equal(V.read(built, 'R1048-SAPL/W').index, 1);
});

test('indexes: exact where measured, estimated elsewhere', () => {
  const asProposed = V.indexing(SMALL, proposal);
  assert.equal(asProposed.indexed, 8);
  assert.equal(asProposed.max, 3);
  assert.ok(asProposed.exact);
  const oneOff = V.indexing(SMALL, { ...proposal, sapphire: ['colour'] });
  assert.equal(oneOff.indexed, 18);
  assert.equal(oneOff.max, 4);
  assert.ok(oneOff.exact);
  const twoOff = V.indexing(SMALL, { ...proposal, sapphire: ['grade'], peridot: ['grade'] });
  assert.equal(twoOff.indexed, 8 + 20 - 3);
  assert.equal(twoOff.max, 5);
  assert.ok(!twoOff.exact);
  const none = Object.fromEntries(SMALL.families.map((f) => [f.id, []]));
  assert.equal(V.indexing(SMALL, none).indexed, 40);
  assert.equal(V.indexing(SMALL, { ...none, sapphire: ['colour', 'grade'], peridot: ['grade'] }).indexed, 5);
  assert.equal(V.separates(SMALL, proposal, 'sapphire', 'grade'), 10);
  assert.equal(V.separates(SMALL, proposal, 'peridot', 'grade'), 3);
});

test('allowed values come from the stones in use', () => {
  assert.deepEqual(V.allowed(SMALL, 'sapphire', 'colour').map((c) => c.id), ['PK', 'CE']);
  assert.deepEqual(V.allowed(SMALL, 'peridot', 'colour'), []);
});

// ── the shipped data ─────────────────────────────────────────────────

test('shipped data: every legacy code maps to known entries', () => {
  const families = new Set(DATA.families.map((f) => f.id));
  const ids = Object.fromEntries(V.AXES.map((a) => [a, new Set(DATA[V.DICT[a]].map((r) => r.id))]));
  for (const r of DATA.legacy) {
    assert.ok(families.has(r.family), `${r.type}+${r.shade}: family ${r.family}`);
    for (const axis of V.AXES) {
      assert.ok(!r[axis] || ids[axis].has(r[axis]), `${r.type}+${r.shade}: ${axis} ${r[axis]}`);
    }
    assert.ok(['ok', 'merged', 'to-confirm', 'conflict'].includes(r.status), r.status);
  }
  for (const f of DATA.families) {
    assert.ok(DATA.metrics.families[f.id], `metrics for ${f.id}`);
    for (const axis of f.axes) assert.ok(V.AXES.includes(axis), `${f.id}: ${axis}`);
    assert.ok(!f.default_colour || ids.colour.has(f.default_colour), `${f.id}: ${f.default_colour}`);
  }
});

test('shipped data: every configuration gives unique codes', () => {
  const applicable = (f) => DATA.metrics.families[f.id].axes
    .map((l) => V.AXES.find((a) => V.LETTER[a] === l));
  const configs = [
    V.proposal(DATA),
    Object.fromEntries(DATA.families.map((f) => [f.id, []])),
    Object.fromEntries(DATA.families.map((f) => [f.id, applicable(f)])),
  ];
  for (const config of configs) {
    for (const tones of Object.keys(V.TONES)) {
      const built = V.build(DATA, config, { tones });
      assert.deepEqual(built.problems, [], tones);
      for (const v of built.varieties.values()) assert.match(v.code, /^[A-Z0-9.]+\??$/);
    }
  }
});

test("shipped data: today's codes are kept", () => {
  const built = V.build(DATA, V.proposal(DATA));
  const code = (desc) => V.varietyOf(built, desc).code;
  assert.equal(code({ family: 'diamond', colour: 'WH', grade: 'SIP1' }), 'DTS');
  assert.equal(code({ family: 'diamond', colour: 'WH', grade: 'VS' }), 'DTS');
  assert.equal(code({ family: 'diamond', colour: 'T2' }), 'DTST2');
  assert.equal(code({ family: 'diamond', colour: 'BR' }), 'DTSBR');
  assert.equal(code({ family: 'sapphire', colour: 'PK', grade: 'A' }), 'SAPL');
  assert.equal(code({ family: 'sapphire', colour: 'CE', grade: 'A' }), 'SALC');
  assert.equal(code({ family: 'topaz', colour: 'BL', grade: 'A' }), 'BTA');
  assert.equal(code({ family: 'topaz', colour: 'BL', grade: 'AAA' }), 'BTAAA');
  assert.equal(code({ family: 'topaz', colour: 'WH' }), 'WT');
  assert.equal(code({ family: 'peridot', grade: 'AAA' }), 'PER');
  assert.equal(code({ family: 'amethyst', grade: 'AA' }), 'AME');
  assert.equal(code({ family: 'moonstone', colour: 'RB' }), 'MON');
  assert.equal(code({ family: 'jade', colour: 'LV', treatment: 'DYED' }), 'DYJLAV');
  assert.ok(V.stats(built).today > 0.999);
  assert.deepEqual(V.indexing(DATA, V.proposal(DATA)).indexed, DATA.metrics.proposal.indexed);
});
