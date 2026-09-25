// Stone Varieties - the variety engine.
//
// A stone is described in full: family + colour + grade + treatment +
// effect. Each family chooses which of these axes its code writes; the
// distinct values of the written axes are the family's VARIETIES, and a
// product code writes one code per variety.
//
// Codes are written with today's vocabulary, the stock code - type then
// shade. A variety takes the code of its most used stone that says nothing
// the family does not write (SAPL, BTAAA, DTST2; Peridot: PER, not
// PERAAA). When every stone says more, the variety is written with a type
// saying nothing more and the shade saying exactly what is written (SA +
// BL), else as its most used stone today (PRLYM). A family's DEFAULT
// COLOUR is never written, and a stone without colour has it (DTS is the
// white diamond). A combination today's codes never had is composed from
// today's pieces (TOP + PK) and flagged.
//
// Products of one model sharing the same varieties are told apart by a
// VARIANT INDEX at the end of the product code (R1048-SAPM+DTS/W-2).
//
// Browser + node; depends on the grammar engine for the product ordering.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./grammar.js'));
  else root.GemVariety = factory(root.GemGrammar);
})(typeof self !== 'undefined' ? self : this, function (Grammar) {
  'use strict';

  const AXES = ['colour', 'grade', 'treatment', 'effect'];
  const KEYS = ['family', ...AXES];  // what a type or a shade can say
  const LETTER = { colour: 'c', grade: 'g', treatment: 't', effect: 'e' };
  const DICT = { colour: 'colours', grade: 'grades', treatment: 'treatments', effect: 'effects' };

  // How tones are written: as in today's stock codes, as digits, or as
  // today's product codes mostly write them (BT3A, but BTA for the light).
  const TONES = {
    letters: { A: 'A', AA: 'AA', AAA: 'AAA', AAAA: 'AAAA' },
    digits: { A: '1A', AA: '2A', AAA: '3A', AAAA: '4A' },
    usual: { A: 'A', AA: '2A', AAA: '3A', AAAA: '4A' },
  };

  const byKey = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]));
  const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

  // family id -> the axes its code writes, as proposed in the data
  function proposal(data) {
    return Object.fromEntries(data.families.map((f) => [f.id, f.axes.slice()]));
  }

  const axesOf = (config, familyId) => (config[familyId] || []).filter((a) => AXES.includes(a));

  // The values of the written axes ('' = not given, the default colour for
  // a missing colour), null for the axes the family does not write.
  function writtenValues(desc, axes, family) {
    return Object.fromEntries(AXES.map((a) => {
      if (!axes.includes(a)) return [a, null];
      const v = desc[a] || '';
      return [a, a === 'colour' && !v && family.default_colour ? family.default_colour : v];
    }));
  }

  const varietyKey = (familyId, values) =>
    [familyId, ...AXES.map((a) => (values[a] === null ? '*' : values[a]))].join('|');

  // What a variety's code must say: its family and the written values that
  // are given - the default colour going without saying.
  function says(familyId, values, family) {
    const out = { family: familyId };
    for (const axis of AXES) {
      if (values[axis] && !(axis === 'colour' && values[axis] === family.default_colour)) out[axis] = values[axis];
    }
    return out;
  }

  const same = (a, b) => KEYS.every((k) => (a[k] || '') === (b[k] || ''));

  // The vocabulary of today's codes: what each type and shade says, and
  // how much each is used.
  function vocabulary(data) {
    const types = {};
    for (const t of data.legacy_types) {
      types[t.code] = { code: t.code, article: t.article,
                        says: Object.fromEntries(['family', 'colour', 'treatment']
                          .filter((k) => t[k]).map((k) => [k, t[k]])) };
    }
    const shades = data.legacy_shades.map((s) => ({
      code: s.code, says: Object.fromEntries(KEYS.filter((k) => s[k]).map((k) => [k, s[k]])),
    }));
    const pairLines = new Map();
    const shadeLines = new Map();
    const typeLines = new Map();
    for (const r of data.legacy) {
      pairLines.set(`${r.type}|${r.shade}`, (pairLines.get(`${r.type}|${r.shade}`) || 0) + r.lines + r.stones / 1e6);
      shadeLines.set(r.shade, (shadeLines.get(r.shade) || 0) + r.lines);
      typeLines.set(r.type, (typeLines.get(r.type) || 0) + r.lines);
    }
    // a family's own code: a type of today, or a new code (QTZ) saying the family alone
    for (const f of data.families) {
      if (f.code && !types[f.code]) types[f.code] = { code: f.code, article: f.look, says: { family: f.id }, isNew: true };
    }
    return { types, shades, pairLines, shadeLines, typeLines };
  }

  // What a shade adds to a type: null when they contradict each other.
  function adds(type, shade) {
    const out = {};
    for (const k of KEYS) {
      const s = shade.says[k];
      if (!s) continue;
      const t = type.says[k];
      if (t && t !== s && k !== 'family') return null;
      if (t !== s) out[k] = s;
    }
    return out;
  }

  // The type a variety is written with: today's types of its stones first
  // (most used), then the family's own code and types - the first one that
  // says nothing the variety does not (a shade may still move the family,
  // as South Seas moves a Pearl).
  function typeFor(vocab, family, want, rows) {
    const used = new Map();
    for (const r of rows) used.set(r.type, (used.get(r.type) || 0) + r.lines + r.stones / 1e6);
    const ordered = [...used.keys()].sort((a, b) => used.get(b) - used.get(a) || cmp(a, b));
    const candidates = [...ordered, family.code, ...family.legacy_types].filter(Boolean);
    for (const code of candidates) {
      const type = vocab.types[code];
      if (!type) continue;
      const fits = Object.entries(type.says).every(([k, v]) => k === 'family' || want[k] === v);
      if (fits) return type;
    }
    return vocab.types[candidates[0]] || { code: candidates[0] || '?', says: {}, isNew: true };
  }

  // The shade that says exactly `rest` on top of `type`, preferring the
  // pairs today's stones use, then the most used shades; else composed
  // from single-meaning shades, a value without one being written by its
  // name (to be named).
  function shadeFor(vocab, type, rest, dicts) {
    if (!Object.keys(rest).length) return { parts: [], exact: true, named: true };
    const rank = (sh) => [vocab.pairLines.get(`${type.code}|${sh.code}`) || 0,
                          vocab.shadeLines.get(sh.code) || 0];
    const best = (list) => list.sort((a, b) => {
      const [pa, sa] = rank(a);
      const [pb, sb] = rank(b);
      return pb - pa || sb - sa || cmp(a.code, b.code);
    })[0];
    const exact = best(vocab.shades.filter((sh) => {
      const extra = adds(type, sh);
      return extra && same(extra, rest);
    }));
    if (exact) return { parts: [exact.code], exact: true, named: true };
    let named = true;
    const parts = [];
    for (const k of KEYS) {
      if (!rest[k]) continue;
      const atom = best(vocab.shades.filter((sh) => same(sh.says, { [k]: rest[k] })));
      if (atom) {
        parts.push(atom.code);
      } else {
        named = false;
        const entry = k !== 'family' && dicts[k][rest[k]];
        parts.push((entry ? entry.name : rest[k]).toUpperCase().replace(/[^A-Z0-9]/g, ''));
      }
    }
    return { parts, exact: false, named };
  }

  // Does a stone say something the family does not write, and that not
  // every stone of the variety shares? (Every Lavender jade is dyed: DYJLAV
  // says nothing untrue about the variety.)
  function saysMore(row, axes, rows) {
    return AXES.some((a) => !axes.includes(a) && row[a] && rows.some((r) => r[a] !== row[a]));
  }

  // The code of a variety and where it comes from: 'today' (a code of
  // today: type + shade, or a type alone), 'pieces' (new, made of today's
  // types and shades) or 'to-name' (new pieces had to be invented).
  function codeFor(vocab, family, values, axes, rows, dicts, tones) {
    const finish = (type, parts, origin) => {
      // a shade saying nothing but the default colour is not written
      const typeEntry = vocab.types[type] || { says: {} };
      const shadeEntry = parts.length === 1 && vocab.shades.find((sh) => sh.code === parts[0]);
      const extra = shadeEntry && adds(typeEntry, shadeEntry);
      const written = extra && family.default_colour && same(extra, { colour: family.default_colour })
        ? [] : parts;
      const spell = (style) => type + written.map((part) => style[part] || part).join('');
      return { code: spell(tones), type, shade: written.join(''), origin,
               forms: [...new Set(Object.values(TONES).map(spell))],
               article: typeEntry.article || family.look };
    };
    const shadeOf = (row) => (row.shade ? [row.shade] : []);
    const ordered = [...rows].sort((a, b) => b.lines - a.lines || b.stones - a.stones
      || cmp(legacyCode(a), legacyCode(b)));
    const clean = ordered.find((r) => !saysMore(r, axes, rows));
    if (clean) return finish(clean.type, shadeOf(clean), 'today');

    const want = says(family.id, values, family);
    const type = typeFor(vocab, family, want, rows);
    const rest = {};
    for (const k of KEYS) {
      if (want[k] && (type.says[k] || '') !== want[k]) rest[k] = want[k];
    }
    const shade = shadeFor(vocab, type, rest, dicts);
    if (!shade.exact && ordered.length) return finish(ordered[0].type, shadeOf(ordered[0]), 'today');
    const known = !type.isNew && (!shade.parts.length
      || vocab.pairLines.has(`${type.code}|${shade.parts.join('')}`));
    return finish(type.code, shade.parts,
                  known ? 'today' : type.isNew || !shade.named ? 'to-name' : 'pieces');
  }

  // Build the varieties of a configuration: config = { familyId: [axes] };
  // options.tones: 'letters' (AAA, the default), 'digits' (3A) or 'usual'.
  function build(data, config, options) {
    const tones = TONES[(options && options.tones) || 'letters'];
    const families = byKey(data.families, 'id');
    const dicts = Object.fromEntries(AXES.map((a) => [a, byKey(data[DICT[a]], 'id')]));
    const vocab = vocabulary(data);

    const varieties = new Map();
    for (const row of data.legacy) {
      const axes = axesOf(config, row.family);
      const values = writtenValues(row, axes, families[row.family]);
      const key = varietyKey(row.family, values);
      if (!varieties.has(key)) {
        varieties.set(key, { key, family: row.family, axes, values, lines: 0, stones: 0, legacy: [] });
      }
      const v = varieties.get(key);
      v.lines += row.lines;
      v.stones += row.stones;
      v.legacy.push(row);
    }

    // the most used first: a clash is settled at the expense of the rarer
    const ordered = [...varieties.values()].map((v) => Object.assign(v, codeFor(
      vocab, families[v.family], v.values, v.axes, v.legacy, dicts, tones)))
      .sort((a, b) => b.lines - a.lines || b.stones - a.stones || cmp(a.key, b.key));
    const byCode = new Map();
    const problems = [];
    for (const v of ordered) {
      if (byCode.has(v.code)) {
        // the code is taken by a more used variety: write this one as its
        // most used stone today (AMEML), else mark it incomplete
        const rep = [...v.legacy].sort((a, b) => b.lines - a.lines || b.stones - a.stones)[0];
        const fallback = rep && rep.shade ? rep.type + (tones[rep.shade] || rep.shade) : null;
        v.code = fallback && !byCode.has(fallback) ? fallback : `${v.code}?`;
        v.incomplete = v.code.endsWith('?');
        v.origin = v.incomplete ? 'to-name' : 'today';
      }
      if (byCode.has(v.code)) {
        problems.push(`code ${v.code} given twice (${byCode.get(v.code).key} and ${v.key})`);
      }
      byCode.set(v.code, v);
    }
    // a code read in another tone writing still finds its variety
    const byAlias = new Map();
    for (const v of ordered) {
      for (const form of v.forms) {
        if (!byCode.has(form) && !byAlias.has(form)) byAlias.set(form, v);
      }
    }
    return { data, config, options, tones, families, dicts, vocab, varieties, byCode, byAlias, problems };
  }

  // The variety of a full description {family, colour, grade, treatment,
  // effect}. A combination never seen before is a NEW variety, written
  // with the same rule.
  function varietyOf(built, desc) {
    const family = built.families[desc.family];
    const axes = axesOf(built.config, desc.family);
    const values = writtenValues(desc, axes, family);
    const key = varietyKey(desc.family, values);
    if (built.varieties.has(key)) return built.varieties.get(key);
    const v = { key, family: desc.family, axes, values, lines: 0, stones: 0, legacy: [], isNew: true,
                ...codeFor(built.vocab, family, values, axes, [], built.dicts, built.tones) };
    v.problems = built.byCode.has(v.code)
      ? [`code ${v.code} is already the variety ${nameOf(built, built.byCode.get(v.code))}`] : [];
    return v;
  }

  // "Sapphire · Pink · Light (A)"; values not written are left out, and so
  // is anything not given - except a colour, which shows as missing.
  function nameOf(built, variety) {
    const parts = [built.families[variety.family].name];
    for (const axis of AXES) {
      const v = variety.values[axis];
      if (v === null || v === undefined) continue;
      if (v !== '') parts.push(built.dicts[axis][v] ? built.dicts[axis][v].name : v);
      else if (axis === 'colour') parts.push('colour not given');
    }
    return parts.join(' · ');
  }

  // Legacy code as written in today's stock codes: type + shade.
  const legacyCode = (row) => `${row.type}${row.shade}`;

  // Summary of a configuration, weighted by product lines.
  function stats(built) {
    const all = [...built.varieties.values()];
    const lines = all.reduce((s, v) => s + v.lines, 0) || 1;
    const largest = all.reduce((best, v) => (!best || v.lines > best.lines ? v : best), null);
    return {
      varieties: all.filter((v) => v.lines > 0).length,
      varietiesWithStock: all.length,
      meanLength: all.reduce((s, v) => s + v.code.length * v.lines, 0) / lines,
      maxLength: Math.max(...all.map((v) => v.code.length)),
      today: all.reduce((s, v) => s + (v.origin === 'today' ? v.lines : 0), 0) / lines,
      largest, largestShare: largest ? largest.lines / lines : 0,
    };
  }

  // The axes of a family's choice that change anything, as metric letters.
  function combo(axes, applicable) {
    return AXES.filter((a) => axes.includes(a) && applicable.includes(LETTER[a]))
      .map((a) => LETTER[a]).join('');
  }

  // Products needing a variant index, and the largest index, as measured
  // by tools/usage.py. Exact for the proposal, for a single family
  // departing from it, and for 'family only' and 'every axis'; otherwise
  // estimated by adding each family's measured difference (the largest
  // index is then a lower bound).
  function indexing(data, config) {
    const m = data.metrics;
    let indexed = m.proposal.indexed;
    let max = m.proposal.max;
    let changed = 0;
    let none = true;
    let every = true;
    for (const f of data.families) {
      const fm = m.families[f.id];
      if (!fm) continue;
      const chosen = combo(config[f.id] || [], fm.axes);
      none = none && chosen === '';
      every = every && chosen === fm.axes.join('');
      if (chosen !== combo(f.axes, fm.axes)) {
        const option = fm.options[chosen];
        indexed += option.indexed;
        max = changed ? Math.max(max, option.max) : option.max;
        changed += 1;
      }
    }
    if (none) return { ...m.family_only, exact: true, changed };
    if (every) return { ...m.every_axis, exact: true, changed };
    if (!changed) return { ...m.proposal, exact: true, changed };
    return { indexed, max, exact: changed <= 1, changed };
  }

  // Products that writing `axis` spares an index, the other families as
  // proposed.
  function separates(data, config, familyId, axis) {
    const fm = data.metrics.families[familyId];
    if (!fm) return 0;
    const without = (config[familyId] || []).filter((a) => a !== axis);
    return fm.options[combo(without, fm.axes)].indexed
      - fm.options[combo([...without, axis], fm.axes)].indexed;
  }

  // Product code: MODEL-CODES/METAL-INDEX, codes ordered centre first,
  // then heaviest single stone, ties by code (the grammar's rule); the
  // variant index only from 2 on.
  function productCode(entries, model, metal, index) {
    const codes = Grammar.orderTokens(entries.map((e) => (
      { token: e.code, weight: e.weight, isCenter: e.isCenter })));
    let text = codes.join('+');
    if (model) text = `${model}-${text}`;
    if (metal) text += `/${metal}`;
    if (index > 1) text += `-${index}`;
    return text;
  }

  // Read MODEL-CODES/METAL-INDEX (model, metal and index optional) back
  // into varieties.
  function read(built, text) {
    let rest = (text || '').trim().toUpperCase();
    let model = '';
    let metal = '';
    let index = 1;
    const variant = rest.match(/\/[^/]*-(\d+)$/);
    if (variant) { index = Number(variant[1]); rest = rest.slice(0, -variant[1].length - 1); }
    const slash = rest.lastIndexOf('/');
    if (slash >= 0) { metal = rest.slice(slash + 1); rest = rest.slice(0, slash); }
    const dash = rest.indexOf('-');
    if (dash >= 0) { model = rest.slice(0, dash); rest = rest.slice(dash + 1); }
    const tokens = rest.split('+').map((c) => c.trim()).filter(Boolean)
      .map((code) => ({ code, variety: built.byCode.get(code) || built.byAlias.get(code) || null }));
    return { model, metal, index, tokens };
  }

  // Values a family accepts on an axis: those in real use (stock stones).
  function allowed(data, familyId, axis) {
    const values = new Set();
    for (const row of data.legacy) {
      if (row.family === familyId && row[axis] && row.status !== 'conflict') values.add(row[axis]);
    }
    return data[DICT[axis]].filter((r) => values.has(r.id));
  }

  return {
    AXES, LETTER, DICT, TONES, proposal, build, varietyOf, nameOf, legacyCode,
    stats, indexing, separates, productCode, read, allowed,
  };
});
