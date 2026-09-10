// Run with: node --test tests/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const LOOK = require('../assets/stone-look.js');
const DATA = require('../assets/data.js');

const stone = (code) => DATA.stones.find((s) => s.code === code);
const hue = (code) => DATA.hues.find((h) => h.code === code);
const grade = (code) => DATA.grades.find((g) => g.code === code);
const hex = /^#[0-9a-f]{6}$/;

test('every stone and every hue of the dictionaries has an entry', () => {
  for (const s of DATA.stones) assert.ok(s.code in LOOK.STONES, `stone ${s.code}`);
  for (const h of DATA.hues) assert.ok(h.code in LOOK.HUES, `hue ${h.code}`);
});

test('entries are well formed', () => {
  for (const [code, look] of Object.entries(LOOK.STONES)) {
    if (!look) continue;
    assert.match(look.color, hex, code);
    assert.ok(LOOK.FAMILIES.includes(look.family), code);
    if (look.ior) assert.ok(look.ior > 1.3 && look.ior < 2.8, code);
  }
  for (const [code, effect] of Object.entries(LOOK.HUES)) {
    if (effect && effect.color) assert.match(effect.color, hex, code);
  }
});

test('the chosen hue gives the colour', () => {
  const look = LOOK.lookFor(stone('SA'), null, hue('1Y'), DATA);
  assert.equal(look.label.split(' · ')[0], 'Yellow');
  assert.equal(look.family, 'transparent');
});

test("without a hue, the stone's usual hue, then its own colour", () => {
  // the production history makes pink the usual sapphire
  const sapphire = LOOK.lookFor(stone('SA'), grade('2'), null, DATA);
  assert.equal(sapphire.color, LOOK.HUES['4P'].color);
  assert.match(sapphire.label, /usual hue/);
  const ruby = LOOK.lookFor(stone('RU'), grade('2'), null, DATA);
  assert.equal(ruby.color, LOOK.STONES.RU.color);
});

test("a generic colour word keeps the stone's own shade, a trade hue does not", () => {
  // blue turquoise is turquoise blue, not royal blue
  assert.equal(LOOK.lookFor(stone('TU'), null, hue('2B'), DATA).color, LOOK.STONES.TU.color);
  assert.equal(LOOK.lookFor(stone('CO'), null, hue('5R'), DATA).color, LOOK.STONES.CO.color);
  // yellow is not a shade of the blue sapphire; Malaya is a trade colour
  assert.equal(LOOK.lookFor(stone('SA'), grade('2'), hue('1Y'), DATA).color, LOOK.HUES['1Y'].color);
  assert.equal(LOOK.lookFor(stone('GA'), null, null, DATA).color, LOOK.HUES['3M'].color);
});

test('a hue that names no colour keeps the stone colour', () => {
  const look = LOOK.lookFor(stone('RU'), grade('2'), hue('1M'), DATA);
  assert.equal(look.color, LOOK.STONES.RU.color);
});

test('milky and cloudy hues add haze to the implied colour', () => {
  // implied pink - rose quartz's own pale pink - and usually cloudy
  const quartz = LOOK.lookFor(stone('PN'), null, null, DATA);
  assert.equal(quartz.color, LOOK.STONES.PN.color);
  assert.ok(quartz.haze > 0.3);
});

test('grades 1 to 4 deepen the colour step by step', () => {
  const l = ['1', '2', '3', '4'].map((g) =>
    LOOK.lightness(LOOK.lookFor(stone('SA'), grade(g), hue('2B'), DATA).color));
  assert.ok(l[0] > l[1] && l[1] > l[2] && l[2] > l[3], l.join(' > '));
});

test('no stone, no look', () => {
  assert.equal(LOOK.lookFor(null, null, hue('1Y'), DATA), null);
  assert.equal(LOOK.lookFor(stone('MS'), null, null, DATA), null);
});
