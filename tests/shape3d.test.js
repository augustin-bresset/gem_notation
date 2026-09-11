// Run with: node --test tests/
const { test } = require('node:test');
const assert = require('node:assert/strict');
const G3 = require('../assets/shape3d.js');
const { RECIPES, specFor } = require('../assets/shape3d-recipes.js');
const DATA = require('../assets/data.js');

// Closed and consistently oriented: every directed edge is matched by
// exactly one reverse edge, and the enclosed volume is positive.
function assertWatertight(mesh, label) {
  const directed = new Map();
  for (const face of mesh.faces) {
    face.v.forEach((a, i) => {
      const key = `${a}>${face.v[(i + 1) % face.v.length]}`;
      directed.set(key, (directed.get(key) || 0) + 1);
    });
  }
  for (const [key, count] of directed) {
    const [a, b] = key.split('>');
    assert.equal(count, 1, `${label}: edge ${key} used ${count} times`);
    assert.equal(directed.get(`${b}>${a}`), 1, `${label}: edge ${key} has no twin`);
  }
  assert.ok(G3.signedVolume(mesh.vertices, mesh.faces) > 0, `${label}: volume`);
  for (const v of mesh.vertices) {
    assert.ok(v.every(Number.isFinite), `${label}: finite vertex`);
  }
}

function bounds(mesh) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const v of mesh.vertices) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], v[k]);
      max[k] = Math.max(max[k], v[k]);
    }
  }
  return max.map((x, k) => x - min[k]);
}

const kinds = (mesh) => mesh.faces.reduce((acc, f) => {
  acc[f.kind] = (acc[f.kind] || 0) + 1;
  return acc;
}, {});

test('round brilliant: the 57 classic facets', () => {
  const mesh = G3.build({ outline: 'round' });
  assert.deepEqual(
    Object.fromEntries(Object.entries(kinds(mesh)).filter(([k]) => k !== 'girdle')),
    { table: 1, star: 8, bezel: 8, 'upper girdle': 16,
      'lower girdle': 16, 'pavilion main': 8 });
  assertWatertight(mesh, 'round brilliant');
});

test('round brilliant: bezels and pavilion mains are planar', () => {
  const mesh = G3.build({ outline: 'round' });
  for (const face of mesh.faces.filter((f) => ['bezel', 'pavilion main'].includes(f.kind))) {
    const { normal } = G3.faceNormal(mesh.vertices, face);
    const p0 = mesh.vertices[face.v[0]];
    for (const index of face.v) {
      const p = mesh.vertices[index];
      const off = normal.reduce((s, n, k) => s + n * (p[k] - p0[k]), 0);
      assert.ok(Math.abs(off) < 1e-9, `${face.kind} off-plane by ${off}`);
    }
  }
});

test('proportions: width 1, length = ratio, depth = girdle + halves', () => {
  const mesh = G3.build({
    outline: 'oval', ratio: 1.5, girdle: 0.04,
    top: { style: 'brilliant', height: 0.15 },
    bottom: { style: 'brilliant', height: 0.43 },
  });
  const [length, width, depth] = bounds(mesh);
  assert.ok(Math.abs(width - 1) < 1e-6, `width ${width}`);
  assert.ok(Math.abs(length - 1.5) < 1e-6, `length ${length}`);
  assert.ok(Math.abs(depth - 0.62) < 1e-6, `depth ${depth}`);
});

test('a rectangular step pavilion ends in a keel', () => {
  const mesh = G3.build(G3.fromCut('step', { outline: 'rect', ratio: 2 }));
  assertWatertight(mesh, 'baguette');
  const lowest = Math.min(...mesh.vertices.map((v) => v[2]));
  const keel = mesh.vertices.filter((v) => Math.abs(v[2] - lowest) < 1e-9);
  assert.equal(keel.length, 2);
  const xs = keel.map((v) => v[0]).sort((a, b) => a - b);
  assert.ok(Math.abs(xs[1] - xs[0] - 1) < 1e-6, 'keel = length - width');
});

test('inset polygon collapses a shrinking edge instead of crossing it', () => {
  const trapezoid = [[1, 0.2], [-1, 0.5], [-1, -0.5], [1, -0.2]];
  const out = G3.insetPolygon(trapezoid, 0.3);
  assert.ok(out, 'still a polygon');
  assert.ok(Math.hypot(out[0][0] - out[3][0], out[0][1] - out[3][1]) < 1e-9,
            'narrow end collapsed to a point');
  const limit = G3.maxInset(trapezoid);
  assert.ok(limit > 0.3 && limit < 0.5, `limit ${limit}`);
});

test('every outline x every half style builds a closed mesh', () => {
  for (const outline of Object.keys(G3.OUTLINES)) {
    for (const style of Object.keys(G3.STYLES)) {
      for (const bottom of ['brilliant', style]) {
        const label = `${outline}/${style}/${bottom}`;
        const mesh = G3.build({ outline, top: { style }, bottom: { style: bottom } });
        assertWatertight(mesh, label);
      }
    }
  }
});

test('every symmetry an outline offers builds a closed mesh', () => {
  for (const [outline, def] of Object.entries(G3.OUTLINES)) {
    for (const symmetry of def.symmetries) {
      for (const style of ['brilliant', 'step', 'rose']) {
        const mesh = G3.build({ outline, symmetry, top: { style }, bottom: { style } });
        assertWatertight(mesh, `${outline}/${symmetry}/${style}`);
      }
    }
  }
});

test('every recipe builds a closed mesh', () => {
  for (const code of Object.keys(RECIPES)) {
    const mesh = G3.build(specFor(code));
    assertWatertight(mesh, code);
    const buffers = G3.toBuffers(mesh);
    assert.ok(buffers.positions.length > 0 && buffers.positions.every(Number.isFinite), code);
    assert.ok(buffers.normals.every(Number.isFinite), code);
  }
});

test('recipes point at real shapes, outlines and cuts', () => {
  const shapeCodes = new Set(DATA.shapes.map((s) => s.code));
  for (const [code, recipe] of Object.entries(RECIPES)) {
    assert.ok(shapeCodes.has(code), `${code} is not a shape`);
    assert.ok(G3.OUTLINES[recipe.outline], `${code}: outline ${recipe.outline}`);
    assert.ok(G3.CUTS[recipe.cut], `${code}: cut ${recipe.cut}`);
  }
  assert.equal(specFor('ZZ'), null);
});

test('resolve fills defaults and keeps values in the offered ranges', () => {
  const spec = G3.resolve({ outline: 'nope', symmetry: 7, top: { style: 'nope' } });
  assert.equal(spec.outline, 'round');
  assert.equal(spec.symmetry, 8);
  assert.equal(spec.top.style, 'brilliant');
  for (const [style, def] of Object.entries(G3.STYLES)) {
    for (const side of ['top', 'bottom']) {
      for (const key of def.params) {
        const p = G3.HALF_PARAMS[key];
        const v = def[side][key];
        assert.ok(v >= p.min && v <= p.max, `${style}.${side}.${key} = ${v}`);
      }
    }
  }
  for (const [key, p] of Object.entries(G3.PARAMS)) {
    if (p.value !== undefined) assert.ok(p.value >= p.min && p.value <= p.max, key);
  }
});

test('a smooth dome never overhangs its girdle', () => {
  // the flat base is the girdle outline; every dome vertex seen from
  // above must fall inside it (or on it)
  const inside = (poly, [x, y]) => {
    let winding = false;
    let near = Infinity;
    for (let i = 0; i < poly.length; i++) {
      const [a, b] = [poly[i], poly[(i + 1) % poly.length]];
      if ((a[1] > y) !== (b[1] > y)
          && x < a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0])) winding = !winding;
      const e = [b[0] - a[0], b[1] - a[1]];
      const s = Math.max(0, Math.min(1, ((x - a[0]) * e[0] + (y - a[1]) * e[1])
        / (e[0] * e[0] + e[1] * e[1] || 1)));
      near = Math.min(near, Math.hypot(x - a[0] - s * e[0], y - a[1] - s * e[1]));
    }
    return winding || near < 1e-9;
  };
  for (const outline of Object.keys(G3.OUTLINES)) {
    const mesh = G3.build({ outline, girdle: 0.1, top: { style: 'dome', height: 0.4 },
                            bottom: { style: 'flat', height: 0 } });
    const base = mesh.faces.find((f) => f.kind === 'base').v
      .map((i) => mesh.vertices[i]);
    for (const v of mesh.vertices) {
      if (v[2] > 0.05 + 1e-9) {
        assert.ok(inside(base, v), `${outline}: dome vertex ${v} outside the girdle`);
      }
    }
  }
});

test('a pumpkin keeps its lobes up the dome', () => {
  // the tip rounding must not iron out an outline whose lobes are wanted
  const mesh = G3.build(specFor('PU'));
  const top = Math.max(...mesh.vertices.map((v) => v[2]));
  // the ring of vertices nearest to 60 % of the height
  const level = mesh.vertices.map((v) => v[2]).filter((z) => z > 0)
    .reduce((best, z) => (Math.abs(z - top * 0.6) < Math.abs(best - top * 0.6) ? z : best));
  const band = mesh.vertices.filter((v) => Math.abs(v[2] - level) < 1e-9);
  const radii = band.map((v) => Math.hypot(v[0], v[1]));
  assert.ok(band.length > 20, 'a ring near 60 % height');
  assert.ok(Math.max(...radii) / Math.min(...radii) > 1.05, 'lobes still visible');
});

test('irregularity is deterministic per seed', () => {
  const spec = G3.fromCut('tumbled', { outline: 'round', seed: 3 });
  const a = G3.build(spec).vertices;
  const b = G3.build(spec).vertices;
  const c = G3.build(Object.assign({}, spec, { seed: 4 })).vertices;
  assert.deepEqual(a, b);
  assert.notDeepEqual(a, c);
});
