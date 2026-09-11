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

test('without a hue: the hue the stone implies, else its reference colour - no default assumed', () => {
  // the notation's default hue (pink for SA, black for JA) is not used
  const sapphire = LOOK.lookFor(stone('SA'), null, null, DATA);
  assert.equal(sapphire.color, LOOK.STONES.SA.color);
  assert.equal(sapphire.label, 'No hue given');
  const jade = LOOK.lookFor(stone('JA'), null, null, DATA);
  assert.equal(jade.color, LOOK.STONES.JA.color);
  const topaz = LOOK.lookFor(stone('BL'), null, null, DATA);
  assert.match(topaz.label, /implied by Blue Topaz/);
  // nor its default grade: the colour is not shaded
  assert.equal(LOOK.lookFor(stone('AQ'), null, null, DATA).color, LOOK.STONES.AQ.color);
  for (const s of DATA.stones) {
    const look = LOOK.lookFor(s, null, null, DATA);
    if (look) assert.doesNotMatch(look.label, /usual|typical|general/i, s.code);
  }
});

test("a generic colour word keeps the stone's own shade, a trade hue does not", () => {
  // blue turquoise is turquoise blue, not royal blue
  assert.equal(LOOK.lookFor(stone('TU'), null, hue('2B'), DATA).color, LOOK.STONES.TU.color);
  assert.equal(LOOK.lookFor(stone('CO'), null, hue('5R'), DATA).color, LOOK.STONES.CO.color);
  // yellow is not a shade of the blue sapphire; Malaya is a trade colour
  assert.equal(LOOK.lookFor(stone('SA'), grade('2'), hue('1Y'), DATA).color, LOOK.HUES['1Y'].color);
  assert.equal(LOOK.lookFor(stone('GA'), null, hue('3M'), DATA).color, LOOK.HUES['3M'].color);
});

test('a hue that names no colour keeps the stone colour', () => {
  const look = LOOK.lookFor(stone('RU'), grade('2'), hue('1M'), DATA);
  assert.equal(look.color, LOOK.STONES.RU.color);
});

test('milky and cloudy hues add haze to the implied colour', () => {
  // rose quartz implies pink - its own pale pink - and Cloudy is given
  const quartz = LOOK.lookFor(stone('PN'), null, hue('4C'), DATA);
  assert.equal(quartz.color, LOOK.STONES.PN.color);
  assert.ok(quartz.haze > 0.3);
});

test('grades 1 to 4 deepen the colour step by step', () => {
  const l = ['1', '2', '3', '4'].map((g) =>
    LOOK.lightness(LOOK.lookFor(stone('SA'), grade(g), hue('2B'), DATA).color));
  assert.ok(l[0] > l[1] && l[1] > l[2] && l[2] > l[3], l.join(' > '));
});

test('textures and phenomena are ones the shaders know', () => {
  for (const [code, look] of Object.entries(LOOK.STONES)) {
    if (!look) continue;
    if (look.texture) {
      assert.ok(LOOK.TEXTURES.includes(look.texture.kind), code);
      assert.ok(['lighter', 'darker'].includes(look.texture.second)
                || hex.test(look.texture.second), code);
    }
    if (look.phenomenon) assert.ok(LOOK.PHENOMENA.includes(look.phenomenon), code);
  }
  for (const [code, effect] of Object.entries(LOOK.HUES)) {
    if (effect && effect.phenomenon) assert.ok(LOOK.PHENOMENA.includes(effect.phenomenon), code);
  }
});

test('jade is a mottled translucent stone, its pattern following its hue', () => {
  const green = LOOK.lookFor(stone('JA'), null, hue('1J'), DATA);
  assert.equal(green.family, 'translucent');
  assert.equal(green.texture.kind, 'mottled');
  assert.ok(green.translucency > 0);
  const lavender = LOOK.lookFor(stone('JA'), null, hue('1L'), DATA);
  assert.notEqual(lavender.texture.second, green.texture.second);
});

test('a star hue makes a star stone - milky, as a star sapphire is', () => {
  const look = LOOK.lookFor(stone('SA'), null, hue('4B'), DATA);
  assert.equal(look.phenomenon, 'star');
  assert.equal(look.family, 'translucent');
  assert.match(look.label, /star/);
});

test('a hue with no colour defined says so, without guessing', () => {
  const look = LOOK.lookFor(stone('SA'), null, hue('1U'), DATA);
  assert.match(look.label, /no colour defined yet/);
  assert.equal(look.color, LOOK.STONES.SA.color);
});

test('a reference shape suits the material and has a model, for every stone', () => {
  const R = require('../assets/shape3d-recipes.js');
  assert.equal(LOOK.referenceShape('EM', 'transparent'), 'OT');
  assert.equal(LOOK.referenceShape('JA', 'translucent'), 'OG');
  assert.equal(LOOK.referenceShape(null, 'transparent'), 'RD');
  for (const s of DATA.stones) {
    const look = LOOK.lookFor(s, null, null, DATA);
    const code = LOOK.referenceShape(s.code, look ? look.family : 'transparent');
    assert.ok(R.RECIPES[code], `${s.code} -> ${code}`);
  }
});

test('no stone, no look', () => {
  assert.equal(LOOK.lookFor(null, null, hue('1Y'), DATA), null);
  assert.equal(LOOK.lookFor(stone('MS'), null, null, DATA), null);
});
