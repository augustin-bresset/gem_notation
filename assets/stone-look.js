// Gemstone Notation - how a stone looks: its colour and its material.
// A first approximation for the 3D preview, not a gemmological
// reference. Only what the code states is used: the colour comes from
// the hue given when that hue is a colour, else from the hue the stone
// implies (Blue Topaz: blue), else from the stone's reference colour. As
// when reading a code, an omitted block may be the default or simply not
// given, so no default is assumed. A grade 1-4 (light to darker colour)
// sets the depth of the colour; hues like Milky or White I2 and the
// grades Medium / Bad add haze. The family says how light goes through
// the material; opaque and translucent stones add a texture (the
// mottling of jade, the matrix of turquoise...) and an optical
// phenomenon (the eye of a tiger's eye, the star of a star sapphire...).
// Browser + node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GemStoneLook = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const FAMILIES = ['transparent', 'translucent', 'opaque', 'pearl', 'metal'];
  const TEXTURES = ['mottled', 'veined', 'flecked', 'rings', 'stripes', 'cloudy'];
  const PHENOMENA = ['chatoyant', 'star', 'adularescent', 'play', 'labradorescent',
                     'aventurescent'];

  // ior: refractive index; fire: dispersion (B-G interval) - both
  // textbook values, rounded.
  const T = (color, ior, fire) => ({ family: 'transparent', color, ior, fire });
  const L = (color, more) => Object.assign({ family: 'translucent', color, ior: 1.55 }, more);
  const O = (color, more) => Object.assign({ family: 'opaque', color }, more);
  const P = (color) => ({ family: 'pearl', color, iridescent: true });
  const M = (color) => ({ family: 'metal', color });
  // a texture: its kind, and its second colour - a hex, or 'lighter' /
  // 'darker' than the stone's colour (so a dyed hue keeps the pattern)
  const tex = (kind, second, more) => Object.assign({ kind, second }, more);
  const QUARTZ = [1.54, 0.013];
  const BERYL = [1.57, 0.014];
  const CORUNDUM = [1.77, 0.018];
  const TOURMALINE = [1.63, 0.017];
  const GARNET = [1.76, 0.022];
  const EYE = (color, stripe) => O(color, {
    texture: tex('stripes', stripe, { scale: 5, amount: 0.55 }), phenomenon: 'chatoyant' });

  // Stone code -> its own colour and material (null: nothing to say).
  const STONES = {
    AA: O('#5fb8a6', { texture: tex('veined', 'lighter', { scale: 2.5, amount: 0.7 }) }),
    AB: O('#3f6f7a', { texture: tex('rings', '#6a4f86', { bands: 26, amount: 0.6 }),
                       phenomenon: 'play' }),
    AE: T('#9a6fc0', ...QUARTZ),
    AG: L('#b9a89a', { texture: tex('rings', 'lighter', { bands: 34, amount: 0.7 }),
                       translucency: 0.45 }),
    AK: P('#efe6e0'), AL: T('#3f7f5f', 1.75, 0.015), AM: T('#8e4fc2', ...QUARTZ),
    AO: P('#efe6e0'), AP: T('#2ab0b8', 1.63, 0.013), AQ: T('#8fc9e3', ...BERYL),
    AU: L('#7cc9c0', { texture: tex('mottled', 'lighter'), translucency: 0.5 }),
    AV: O('#3f8f55', { texture: tex('mottled', 'darker', { amount: 0.3 }),
                       phenomenon: 'aventurescent', glint: '#dff5d8' }),
    BA: O('#1c1c1f'),
    BC: O('#151517', { texture: tex('stripes', 'lighter', { scale: 6, amount: 0.15 }) }),
    BE: L('#8aa8d6', { texture: tex('rings', 'lighter', { bands: 34, amount: 0.6 }),
                       translucency: 0.45 }),
    BL: T('#5aa8e0', 1.62, 0.014),
    BO: O('#e8dfc9', { texture: tex('mottled', 'darker', { scale: 5, amount: 0.25 }),
                       roughness: 0.35 }),
    BR: EYE('#6b4a2e', 'darker'),
    BU: T('#3fa6d6', 1.93, 0.039), BW: T('#7a4a2a', ...TOURMALINE), BY: T('#e8d56a', ...BERYL),
    CA: L('#f0e2c8', { ior: 1.6, texture: tex('cloudy', 'lighter'), translucency: 0.5 }),
    CC: O('#f3f2ee', { roughness: 0.08 }),
    CE: O('#e9c9b0', { texture: tex('mottled', 'lighter', { amount: 0.3 }) }),
    CG: T('#a8561f', ...QUARTZ),
    CH: L('#a9bfd9', { texture: tex('cloudy', 'lighter'), translucency: 0.55 }),
    CI: T('#e89a2a', ...QUARTZ), CM: T('#e2c18e', ...QUARTZ),
    CN: L('#d0551f', { texture: tex('cloudy', 'lighter', { amount: 0.35 }), translucency: 0.5 }),
    CO: O('#e0584a', { texture: tex('mottled', 'lighter', { scale: 4, amount: 0.25 }),
                       roughness: 0.25 }),
    CR: L('#6fc48a', { texture: tex('mottled', 'lighter'), translucency: 0.45 }),
    CS: T('#ffffff', 1.52, 0.01),
    CT: O('#9a9a96', { texture: tex('flecked', 'darker', { amount: 0.5 }), roughness: 0.7 }),
    CU: T('#ffffff', 2.15, 0.06), CY: T('#d6c24a', 1.75, 0.015), DI: T('#ffffff', 2.42, 0.044),
    DO: T('#2f7a3a', 1.68, 0.018),
    DR: EYE('#8a3a2a', 'darker'),
    // dyed to imitate imperial jade: a vivid, even green
    DY: L('#1fa35a', { texture: tex('mottled', 'lighter', { amount: 0.3 }), translucency: 0.45 }),
    EA: EYE('#3a4f6a', 'darker'),
    EM: T('#1f9a5a', ...BERYL), FA: T('#d0708a', ...TOURMALINE),
    FI: L('#f0762a', { ior: 1.45, translucency: 0.7 }),
    FL: T('#8a6fc8', 1.43, 0.007), GA: T('#7a1420', ...GARNET),
    GE: T('#2f7a4a', ...TOURMALINE), GR: T('#9fc27a', ...QUARTZ), HE: M('#4a4d52'),
    IO: T('#4f5fb0', 1.54, 0.017),
    // jade: waxy, mottled apple green with pale clouds, glowing where thin
    JA: L('#3f9b6a', { texture: tex('mottled', 'lighter', { scale: 2.2, amount: 0.55,
                                                            third: '#eef2e6' }),
                       translucency: 0.55, roughness: 0.3 }),
    JE: O('#121214', { roughness: 0.15 }),
    JS: O('#9a3a2a', { texture: tex('mottled', 'darker', { scale: 3.5, amount: 0.7 }) }),
    KU: T('#e8a8d0', 1.66, 0.017), KY: T('#2f5fb3', 1.72, 0.02),
    // lapis: deep blue, glittering pyrite, white calcite
    LA: O('#1f3a8f', { texture: tex('flecked', '#d9b24a', { amount: 0.35, third: '#dfe3ea' }),
                       phenomenon: 'aventurescent', glint: '#ffd978' }),
    LB: O('#4f5a66', { texture: tex('mottled', 'darker', { amount: 0.4 }),
                       phenomenon: 'labradorescent', glint: '#2f6fe0' }),
    LE: T('#e8e04a', ...QUARTZ),
    MA: O('#1f8a5a', { texture: tex('rings', '#0b3f2a', { bands: 48, amount: 0.8 }) }),
    MB: P('#efe6e0'), MI: T('#ffffff', 2.65, 0.104), MN: T('#f07a1a', 1.8, 0.027),
    MO: L('#eef1f4', { translucency: 0.6, phenomenon: 'adularescent', glint: '#a8c8ff' }),
    MR: T('#f2bcae', ...BERYL), MS: null, MT: P('#f2efe8'),
    NE: L('#3f7a4a', { texture: tex('mottled', 'darker', { amount: 0.5 }), translucency: 0.35,
                       roughness: 0.3 }),
    OB: O('#141416', { roughness: 0.04 }), OL: T('#8a8f2e', ...QUARTZ),
    ON: O('#141416', { roughness: 0.06 }),
    OP: L('#e9eef2', { ior: 1.45, translucency: 0.45, phenomenon: 'play' }),
    PA: P('#f0ebe4'), PB: T('#25c4c7', ...TOURMALINE), PE: T('#8fbf2a', 1.67, 0.02),
    PH: P('#f0ebe4'), PI: T('#e06a9a', ...TOURMALINE), PL: P('#f0ebe4'),
    PN: L('#f3c1cf', { texture: tex('cloudy', 'lighter'), translucency: 0.6 }),
    PO: O('#f5f4f0', { roughness: 0.08 }),
    PR: L('#c8dc8a', { texture: tex('mottled', 'lighter', { amount: 0.4 }), translucency: 0.5 }),
    PU: P('#f0ebe4'), QU: T('#ffffff', 2.15, 0.06), RB: T('#b8184f', ...TOURMALINE),
    RC: T('#ffffff', ...QUARTZ),
    RD: L('#e0708a', { texture: tex('rings', 'lighter', { bands: 40, amount: 0.6 }),
                       translucency: 0.3 }),
    // turquoise: sky blue in a dark spider-web matrix
    RE: O('#3fb8b0', { texture: tex('veined', '#3a2e22', { scale: 2.5, amount: 0.8 }),
                       roughness: 0.3 }),
    RH: T('#9a2a55', ...GARNET), RO: T('#d9b3dc', ...QUARTZ), RT: T('#efe6d0', ...QUARTZ),
    RU: T('#b0102a', ...CORUNDUM), SA: T('#1f4fa8', ...CORUNDUM),
    SB: O('#c0402f', { texture: tex('stripes', 'lighter', { scale: 4, amount: 0.3 }) }),
    SE: T('#e8661a', 1.8, 0.027), SH: T('#d88a2a', 2.37, 0.156), SI: T('#c0205a', 1.72, 0.02),
    SL: M('#c9ccd1'), SM: T('#6e5a4a', ...QUARTZ), SP: T('#2a4f8f', ...CORUNDUM),
    ST: M('#b9bcc1'),
    SU: L('#e8884a', { translucency: 0.4, phenomenon: 'aventurescent', glint: '#ffb070' }),
    SY: T('#ffffff', ...CORUNDUM), TA: T('#4f4fb8', 1.7, 0.03), TH: P('#3a3f45'),
    TI: Object.assign(EYE('#a8742a', '#5a3a12'), { glint: '#ffd98a' }),
    TO: T('#e8a04a', 1.62, 0.014), TR: T('#2f7a5a', ...TOURMALINE),
    TS: T('#2aa84a', 1.74, 0.028),
    TU: O('#3fb8b0', { texture: tex('veined', '#3a2e22', { scale: 2.5, amount: 0.8 }),
                       roughness: 0.3 }),
    UV: T('#6a4a2a', ...TOURMALINE), WH: T('#ffffff', 1.62, 0.014),
    WI: L('#f2f2ee', { texture: tex('cloudy', 'darker', { amount: 0.2 }), translucency: 0.5 }),
    WO: O('#6b4a2e', { texture: tex('stripes', 'darker', { scale: 14, amount: 0.6 }),
                       roughness: 0.4 }),
    ZI: T('#ffffff', 1.93, 0.039),
  };

  // Hue code -> a colour, haze, a phenomenon, or several; null for hues
  // that name no colour (an origin, a treatment, a trade mark...).
  // Whites are colourless on a transparent stone. A generic colour word
  // (G) defers to the stone's own shade of that colour: a blue turquoise
  // is turquoise blue, a red coral coral red.
  const W = '#f5f5f2';
  const G = (color) => ({ color, generic: true });
  const HUES = {
    '1A': { color: '#efe6e0' }, '1B': { color: '#1c1c1f' }, '1C': { color: '#f3d23a' },
    '1D': { haze: 0.3 }, '1E': { color: '#2a211c' }, '1F': null,
    '1G': { color: '#7d8c99' }, '1H': { color: W, haze: 0.15 }, '1I': { color: '#cfe3f2' },
    '1J': { color: '#3f9b6a' }, '1K': { color: W, haze: 0.25 }, '1L': { color: '#b8a2d8' },
    '1M': null, '1N': null, '1O': { color: '#9cc3e6' },
    '1P': { color: '#f4a08a' }, '1Q': { color: W, haze: 0.35 }, '1R': { iridescent: true },
    '1S': null, '1T': { color: '#c9a47a' }, '1U': null,
    '1V': G('#7b4fc4'), '1W': { color: W }, '1X': { color: '#6e5a4a' },
    '1Y': G('#f2c230'), '2A': { color: '#4b2a4a' }, '2B': G('#2f5fb3'),
    '2C': { color: '#0f7a45' }, '2D': null, '2G': { color: '#d8a93b' },
    '2L': { color: '#a6c93a' }, '2M': { color: '#eceae4', haze: 0.6 }, '2O': G('#ee8a2a'),
    '2P': { color: '#25c4c7' }, '2R': null, '2S': { color: '#d8c39a' },
    '2T': { color: '#d9bb94' }, '2W': { color: W, haze: 0.08 }, '2Y': G('#e3aa1e'),
    '3A': { color: '#2b4f8f' }, '3B': { color: '#9b0f1d' }, '3C': { color: '#1f9a52' },
    '3G': G('#3f9b4e'), '3L': { color: '#f3c6d3' }, '3M': { color: '#d0784e' },
    '3O': { color: '#8a8f2e' }, '3P': { color: '#1f6f7a' }, '3R': null,
    '3S': { color: '#f09a7a' }, '3T': { color: '#efe3b0' }, '3W': { color: W },
    '4A': { color: '#1f2a3f' }, '4B': { color: '#2f4f9a', phenomenon: 'star' },
    '4C': { haze: 0.4 },
    '4G': { color: '#8f9296' }, '4L': { color: '#e8e04a' }, '4M': { color: '#9fe0c0' },
    '4P': G('#e889ac'), '4R': null, '4S': { color: '#c9ccd1' },
    '4T': { color: '#3a3f45' }, '4W': { color: W }, '5A': { color: '#1e5f5a' },
    '5B': G('#7a4a2a'), '5C': { color: '#3b3d40' }, '5M': null,
    '5P': G('#d9668f'), '5R': G('#c0182c'), '5S': { color: '#6e5a4a' },
    '5T': { color: '#1c8a8a' }, '5W': null, '6B': { color: '#1c1c1f', phenomenon: 'star' },
    '6C': { color: '#e2c18e' }, '6P': G('#6a2c8c'), '6R': null,
    '6S': null, '6W': { color: W }, '7B': null,
    '7C': { color: '#5b8fd6' }, '7R': null, '7S': { phenomenon: 'star' },
    '7W': { color: W, phenomenon: 'chatoyant' }, '8C': { color: '#4a7cc4' },
    '8S': { color: '#efdcae' },
    '8W': { color: W }, '9S': null, '9W': { color: '#b56a2a' },
  };

  const PHENOMENON_NAMES = {
    chatoyant: 'cat’s eye', star: 'star', adularescent: 'adularescence',
    play: 'play of colour', labradorescent: 'labradorescence', aventurescent: 'glitter',
  };

  // ── Colour arithmetic ──────────────────────────────────────────────
  function toHsl(hex) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, s, l];
  }

  function toHex([h, s, l]) {
    const f = (n) => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      const v = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
      return Math.round(v * 255).toString(16).padStart(2, '0');
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  const lightness = (hex) => toHsl(hex)[2];

  // Grades 1-4 are colour depth: Light, Medium (as is), Dark, Darker.
  function shade(hex, grade) {
    const [h, s, l] = toHsl(hex);
    const depth = { 1: l + (1 - l) * 0.4, 2: l, 3: l * 0.72, 4: l * 0.5 }[grade];
    return depth === undefined ? hex : toHex([h, s, depth]);
  }

  // 'lighter' / 'darker' than `hex`, or a hex kept as it is.
  function relative(hex, how) {
    if (how !== 'lighter' && how !== 'darker') return how;
    const [h, s, l] = toHsl(hex);
    return toHex([h, s, how === 'lighter' ? l + (1 - l) * 0.45 : l * 0.45]);
  }

  // Two chromatic colours within 50 degrees of hue: the same colour word.
  function sameFamily(a, b) {
    const [ha, sa] = toHsl(a);
    const [hb, sb] = toHsl(b);
    if (sa < 0.2 || sb < 0.2) return false;
    const d = Math.abs(ha - hb);
    return Math.min(d, 1 - d) * 360 < 50;
  }

  const GRADE_HAZE = { 6: 0.1, 7: 0.25 };
  const nice = (text) => text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();

  // Dictionary rows (stone required; grade and hue rows or null) ->
  // { family, color, ior, fire, haze, iridescent, label, texture,
  //   phenomenon, glint, translucency, roughness, seed }, or null when
  // the stone has nothing to say.
  function lookFor(stone, grade, hue, dicts, extraHues) {
    const base = stone && STONES[stone.code];
    if (!base) return null;
    const hues = Object.fromEntries((dicts.hues || []).map((r) => [r.code, r]));
    // extra hues (an effect such as Star or Milky) add their haze and
    // phenomenon; the colour comes from the first hue that has one
    const chain = [[hue, 'chosen'], ...(extraHues || []).filter(Boolean).map((h) => [h, 'chosen']),
                   [hues[stone.implied_hue], 'implied']];
    let color = null;
    let label = '';
    let haze = 0;
    let iridescent = Boolean(base.iridescent);
    let phenomenon = base.phenomenon || null;
    for (const [row, why] of chain) {
      const effect = row && HUES[row.code];
      if (!effect) continue;
      haze = Math.max(haze, effect.haze || 0);
      iridescent = iridescent || Boolean(effect.iridescent);
      phenomenon = effect.phenomenon || phenomenon;
      if (effect.color && !color) {
        color = effect.generic && sameFamily(effect.color, base.color)
          ? base.color : effect.color;
        label = why === 'chosen' ? nice(row.name)
          : `${nice(row.name)} — implied by ${stone.name}`;
      }
    }
    if (!color) {
      // the stone's reference colour; the label says only what was given
      color = base.color;
      label = !hue ? 'No hue given'
        : HUES[hue.code] ? nice(hue.name) : `${nice(hue.name)}: no colour defined yet`;
    }
    const g = grade || null;
    if (g && ['1', '2', '3', '4'].includes(g.code)) {
      color = shade(color, g.code);
      if (g.code !== '2') label += ` · ${g.name.toLowerCase()}`;
    }
    haze = Math.min(0.9, haze + ((g && GRADE_HAZE[g.code]) || 0));

    let family = base.family;
    let texture = base.texture || null;
    let translucency = base.translucency || 0;
    // a star or a cat's eye needs silk and a cabochon: milky, not clear
    if (phenomenon && family === 'transparent') {
      if (phenomenon === 'star' || phenomenon === 'chatoyant') {
        family = 'translucent';
        translucency = 0.35;
        texture = texture || tex('cloudy', 'lighter', { amount: 0.3 });
      } else {
        phenomenon = null;
      }
    }
    if (phenomenon) label += ` · ${PHENOMENON_NAMES[phenomenon]}`;
    const resolved = texture && Object.assign({ scale: 3, bands: 30, amount: 0.5 }, texture, {
      second: relative(color, texture.second),
      third: relative(color, texture.third || 'lighter'),
    });
    return {
      family, color, ior: base.ior || 1.55, fire: base.fire || 0, haze, iridescent, label,
      texture: resolved, phenomenon,
      glint: relative(color, base.glint || (phenomenon === 'chatoyant' ? 'lighter' : '#ffffff')),
      translucency, roughness: base.roughness,
      seed: [stone.code.charCodeAt(0) % 17, stone.code.charCodeAt(1) % 13, 3],
    };
  }

  // The shape a stone is drawn on when no shape is given, or when the
  // one given has no 3D model yet: a display choice suited to the
  // material, not a claim about the stone.
  const REFERENCE_SHAPES = { transparent: 'RD', translucent: 'OG', opaque: 'OG', pearl: 'BL',
                             metal: 'DK' };
  const REFERENCE_OVERRIDES = { EM: 'OT', MT: 'FO', MB: 'RC', PU: 'BI', HE: 'BE' };

  function referenceShape(stoneCode, family) {
    return REFERENCE_OVERRIDES[stoneCode] || REFERENCE_SHAPES[family] || REFERENCE_SHAPES.transparent;
  }

  return { FAMILIES, TEXTURES, PHENOMENA, STONES, HUES, lookFor, referenceShape, shade,
           lightness };
});
