// Gemstone Notation - procedural 3D stone shapes.
// A stone is an OUTLINE (the girdle contour seen from above) crossed
// with a TOP and a BOTTOM half (brilliant crown, step crown, rose dome,
// smooth cabochon dome, flat...) joined by the girdle band. The trade
// shapes reduce to ~20 outlines x 7 half styles. Every measure is
// relative to the stone's width (= 1), like gemological proportions:
// a crown height of 0.15 is 15 % of the width. Pure functions, no DOM:
// browser + node.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GemShape3D = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const TAU = 2 * Math.PI;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const range = (count) => Array.from({ length: count }, (_, i) => i);
  const mod = (a, m) => ((a % m) + m) % m;

  // ── Outlines ───────────────────────────────────────────────────────
  // raw(t, spec) -> [x, y] with t in [0, 1) running counter-clockwise
  // from the +x axis; the curve is then normalized to length `ratio`
  // along x and width 1 along y. corners(spec) are the t of sharp
  // vertices - always sampled exactly; `polygonal` outlines are straight
  // between their corners. n is the default symmetry (number of mains).

  // [[t, x, y], ...] sorted by t -> linear interpolation, wrapping.
  function polygonAt(points, t) {
    const m = points.length;
    for (let k = 0; k < m; k++) {
      const a = points[k];
      const b = points[(k + 1) % m];
      const tb = k + 1 < m ? b[0] : b[0] + 1;
      const u = t < a[0] ? t + 1 : t;
      if (u >= a[0] && u <= tb) {
        const f = tb > a[0] ? (u - a[0]) / (tb - a[0]) : 0;
        return [a[1] + f * (b[1] - a[1]), a[2] + f * (b[2] - a[2])];
      }
    }
    return [points[0][1], points[0][2]];
  }

  const odd = (count) => range(count).map((i) => (2 * i + 1) / (2 * count));
  const even = (count) => range(count).map((i) => i / count);

  // teardrop: pointed at +x with a finite tip angle, round at -x
  const teardrop = (t) => {
    const a = TAU * t;
    return [Math.cos(a), Math.sin(a) * Math.sin(a / 2)];
  };

  const OUTLINES = {
    round: {
      label: 'Round', ratio: 1, fixedRatio: true, n: 8,
      symmetries: [5, 6, 8, 10, 12, 16],
      raw: (t) => [Math.cos(TAU * t), Math.sin(TAU * t)],
    },
    oval: {
      label: 'Oval', ratio: 1.4, n: 8, symmetries: [6, 8, 10, 12, 16],
      raw: (t) => [Math.cos(TAU * t), Math.sin(TAU * t)],
    },
    cushion: {
      label: 'Cushion', ratio: 1, n: 8, params: ['squareness'],
      symmetries: [4, 8, 12, 16],
      raw: (t, s) => {
        const e = 2 + 4 * s.squareness;
        const c = Math.cos(TAU * t);
        const n = Math.sin(TAU * t);
        return [Math.sign(c) * Math.abs(c) ** (2 / e),
                Math.sign(n) * Math.abs(n) ** (2 / e)];
      },
    },
    rect: {
      label: 'Square / rectangle', ratio: 1, n: 8, polygonal: true,
      symmetries: [4, 8, 12, 16], corners: () => odd(4),
      raw: (t, s) => {
        const a = s.ratio / 2;
        return polygonAt([[1 / 8, a, 0.5], [3 / 8, -a, 0.5],
                          [5 / 8, -a, -0.5], [7 / 8, a, -0.5]], t);
      },
    },
    octagon: {
      label: 'Octagon (cut corners)', ratio: 1.4, n: 8, polygonal: true,
      params: ['corner'], symmetries: [4, 8, 12, 16], corners: () => odd(8),
      raw: (t, s) => {
        const a = s.ratio / 2;
        const b = 0.5;
        const c = Math.min(s.corner, 0.49, a - 0.01);
        return polygonAt([
          [1 / 16, a, b - c], [3 / 16, a - c, b], [5 / 16, -a + c, b],
          [7 / 16, -a, b - c], [9 / 16, -a, -b + c], [11 / 16, -a + c, -b],
          [13 / 16, a - c, -b], [15 / 16, a, -b + c]], t);
      },
    },
    tapered: {
      label: 'Tapered', ratio: 2.4, n: 8, polygonal: true,
      params: ['taper'], symmetries: [4, 8, 12, 16], corners: () => odd(4),
      raw: (t, s) => {
        const a = s.ratio / 2;
        const narrow = 0.5 * s.taper;
        return polygonAt([[1 / 8, a, narrow], [3 / 8, -a, 0.5],
                          [5 / 8, -a, -0.5], [7 / 8, a, -narrow]], t);
      },
    },
    kite: {
      label: 'Kite', ratio: 1.5, n: 8, polygonal: true,
      params: ['shoulder'], symmetries: [4, 8, 12, 16], corners: () => even(4),
      raw: (t, s) => {
        const a = s.ratio / 2;
        const x = -a + s.shoulder * s.ratio;
        return polygonAt([[0, a, 0], [1 / 4, x, 0.5],
                          [1 / 2, -a, 0], [3 / 4, x, -0.5]], t);
      },
    },
    lozenge: {
      label: 'Lozenge', ratio: 1.5, n: 8, polygonal: true,
      symmetries: [4, 8, 12, 16], corners: () => even(4),
      raw: (t, s) => {
        const a = s.ratio / 2;
        return polygonAt([[0, a, 0], [1 / 4, 0, 0.5],
                          [1 / 2, -a, 0], [3 / 4, 0, -0.5]], t);
      },
    },
    hexagon: {
      label: 'Hexagon', n: 6, polygonal: true, symmetries: [6, 12],
      corners: () => even(6),
      raw: (t) => polygonAt(even(6).map((c) =>
        [c, Math.cos(TAU * c), Math.sin(TAU * c)]), t),
    },
    triangle: {
      label: 'Triangle', n: 6, polygonal: true, symmetries: [3, 6, 9, 12],
      corners: () => even(3),
      raw: (t) => polygonAt(even(3).map((c) =>
        [c, Math.cos(TAU * c), Math.sin(TAU * c)]), t),
    },
    trillion: {
      label: 'Trillion', n: 6, params: ['bulge'], symmetries: [3, 6, 9, 12],
      corners: () => even(3),
      raw: (t, s) => {
        // triangle whose sides bow outward by `bulge` x side length
        const k = Math.min(2, Math.floor(t * 3));
        const u = t * 3 - k;
        const a = [Math.cos(TAU * k / 3), Math.sin(TAU * k / 3)];
        const b = [Math.cos(TAU * (k + 1) / 3), Math.sin(TAU * (k + 1) / 3)];
        const side = Math.hypot(b[0] - a[0], b[1] - a[1]);
        const normal = [(b[1] - a[1]) / side, -(b[0] - a[0]) / side];
        const bow = s.bulge * side * Math.sin(Math.PI * u);
        return [a[0] + u * (b[0] - a[0]) + bow * normal[0],
                a[1] + u * (b[1] - a[1]) + bow * normal[1]];
      },
    },
    halfmoon: {
      label: 'Half moon', ratio: 0.5, n: 8, symmetries: [8, 16],
      corners: () => [3 / 8, 5 / 8],
      raw: (t, s) => {
        const r = s.ratio;
        if (t > 3 / 8 && t < 5 / 8) {
          return [-r / 2, 0.5 - (t - 3 / 8) * 4];  // the straight chord
        }
        const psi = ((t > 0.5 ? t - 1 : t) / (3 / 8)) * (Math.PI / 2);
        return [-r / 2 + r * Math.cos(psi), 0.5 * Math.sin(psi)];
      },
    },
    pear: {
      label: 'Pear', ratio: 1.6, n: 8, symmetries: [6, 8, 10, 12, 16],
      corners: () => [0],
      raw: teardrop,
    },
    marquise: {
      label: 'Marquise', ratio: 2, n: 8, symmetries: [4, 8, 12, 16],
      corners: () => [0, 0.5],
      raw: (t, s) => {
        // lens of two circular arcs meeting at the tips
        const a = s.ratio / 2;
        const b = 0.5;
        const radius = (a * a + b * b) / (2 * b);
        const offset = radius - b;
        const phi0 = Math.atan2(offset, a);
        const upper = (u) => {
          const phi = phi0 + (Math.PI - 2 * phi0) * (u / 0.5);
          return [radius * Math.cos(phi), -offset + radius * Math.sin(phi)];
        };
        if (t <= 0.5) return upper(t);
        const [x, y] = upper(t - 0.5);
        return [-x, -y];
      },
    },
    heart: {
      label: 'Heart', ratio: 0.95, n: 8, symmetries: [8, 12, 16],
      corners: () => [0, 0.5],
      raw: (t) => {
        // a teardrop whose round end is notched into two lobes
        const a = TAU * t;
        const [x, y] = [Math.cos(a), Math.sin(a) * Math.sin(a / 2) ** 0.7];
        const d = Math.abs(a - Math.PI) / 1.1;
        return [x + (d < 1 ? 0.42 * (1 - d) ** 2 : 0), y];
      },
    },
    star: {
      label: 'Star', n: 10, polygonal: true, params: ['inner'],
      symmetries: [8, 10, 12, 16],
      corners: (s) => even(s.symmetry),
      raw: (t, s) => polygonAt(even(s.symmetry).map((c, i) => {
        const r = i % 2 ? s.inner : 1;
        return [c, r * Math.cos(TAU * c), r * Math.sin(TAU * c)];
      }), t),
    },
    lobed: {
      label: 'Lobed (pumpkin)', ratio: 1, n: 8, params: ['lobeDepth'],
      symmetries: [5, 6, 7, 8, 10, 12],
      rounding: 0,  // the lobes are the shape: they run up to the pole
      raw: (t, s) => {
        const r = 1 + s.lobeDepth * Math.cos(s.symmetry * TAU * t);
        return [r * Math.cos(TAU * t), r * Math.sin(TAU * t)];
      },
    },
  };

  function rawBounds(def, spec) {
    const ts = range(720).map((i) => i / 720)
      .concat(def.corners ? def.corners(spec) : []);
    let [x0, x1, y0, y1] = [Infinity, -Infinity, Infinity, -Infinity];
    for (const t of ts) {
      const [x, y] = def.raw(t, spec);
      x0 = Math.min(x0, x); x1 = Math.max(x1, x);
      y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { x0, x1, y0, y1 };
  }

  // The outline's own length/width ratio (used when none is given).
  function naturalRatio(key, spec) {
    const def = OUTLINES[key];
    const b = rawBounds(def, Object.assign({ ratio: 1 }, spec));
    return (b.x1 - b.x0) / (b.y1 - b.y0);
  }

  function makeOutline(spec) {
    const def = OUTLINES[spec.outline];
    const b = rawBounds(def, spec);
    const sx = spec.ratio / (b.x1 - b.x0);
    const sy = 1 / (b.y1 - b.y0);
    const cx = (b.x0 + b.x1) / 2;
    const cy = (b.y0 + b.y1) / 2;
    return {
      point: (t) => {
        const [x, y] = def.raw(mod(t, 1), spec);
        return [(x - cx) * sx, (y - cy) * sy];
      },
      corners: def.corners ? def.corners(spec) : [],
      polygonal: Boolean(def.polygonal),
      // how fast a dome's rings round off the outline's tips and corners
      rounding: def.rounding === undefined ? 0.25 : def.rounding,
    };
  }

  // ── Mesh builder ───────────────────────────────────────────────────
  // Vertices are welded by position, so halves generated independently
  // share their girdle and collapsed rings (a culet, a keel) merge into
  // one point. Faces are polygons listed counter-clockwise seen from
  // outside; consecutive duplicates are removed, faces left with fewer
  // than 3 vertices are dropped.
  function meshBuilder() {
    const vertices = [];
    const faces = [];
    const grid = new Map();
    const CELL = 1e-6;
    const WELD = 1e-7;
    const key = (i, j, k) => `${i},${j},${k}`;

    function vertex(x, y, z) {
      const [i, j, k] = [x, y, z].map((v) => Math.round(v / CELL));
      for (let di = -1; di <= 1; di++) {
        for (let dj = -1; dj <= 1; dj++) {
          for (let dk = -1; dk <= 1; dk++) {
            for (const index of grid.get(key(i + di, j + dj, k + dk)) || []) {
              const v = vertices[index];
              if (Math.abs(v[0] - x) < WELD && Math.abs(v[1] - y) < WELD
                  && Math.abs(v[2] - z) < WELD) return index;
            }
          }
        }
      }
      vertices.push([x, y, z]);
      const cell = key(i, j, k);
      if (!grid.has(cell)) grid.set(cell, []);
      grid.get(cell).push(vertices.length - 1);
      return vertices.length - 1;
    }

    function face(indices, kind, smooth) {
      const v = indices.filter((index, i) =>
        index !== indices[(i + 1) % indices.length]);
      if (new Set(v).size >= 3) faces.push({ v, kind, smooth: Boolean(smooth) });
    }

    return { vertices, faces, vertex, face };
  }

  // ── Polygon helpers (step cuts) ────────────────────────────────────
  function polygonArea(poly) {
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const [a, b] = [poly[i], poly[(i + 1) % poly.length]];
      area += a[0] * b[1] - b[0] * a[1];
    }
    return area / 2;
  }

  function isConvex(poly) {
    for (let i = 0; i < poly.length; i++) {
      const [a, b, c] = [poly[i], poly[(i + 1) % poly.length],
                         poly[(i + 2) % poly.length]];
      const turn = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
      if (turn < -1e-9) return false;
    }
    return true;
  }

  // Inset a convex counter-clockwise polygon by d, keeping one output
  // vertex per input vertex: an edge that shrinks to nothing collapses
  // its two vertices into one (a simple straight skeleton). Returns null
  // once the polygon has vanished.
  function insetPolygon(poly, d) {
    const m = poly.length;
    const lines = poly.map((a, i) => {
      const b = poly[(i + 1) % m];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 1e-12) return null;
      const u = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
      return { u, p: [a[0] - u[1] * d, a[1] + u[0] * d], a };
    });
    const active = lines.map(Boolean);
    const meet = (l1, l2, fallback) => {
      const den = l1.u[0] * l2.u[1] - l1.u[1] * l2.u[0];
      if (Math.abs(den) < 1e-12) {
        return [fallback[0] - l2.u[1] * d, fallback[1] + l2.u[0] * d];
      }
      const dx = l2.p[0] - l1.p[0];
      const dy = l2.p[1] - l1.p[1];
      const s = (dx * l2.u[1] - dy * l2.u[0]) / den;
      return [l1.p[0] + s * l1.u[0], l1.p[1] + s * l1.u[1]];
    };
    for (let pass = 0; pass < m; pass++) {
      const alive = range(m).filter((i) => active[i]);
      if (alive.length < 3) return null;
      // vertex i sits between the last active edge before it and the
      // first active edge from it
      const out = range(m).map((i) => {
        let before = mod(i - 1, m);
        while (!active[before]) before = mod(before - 1, m);
        let after = i;
        while (!active[after]) after = mod(after + 1, m);
        return meet(lines[before], lines[after], poly[i]);
      });
      let reversed = false;
      for (const i of alive) {
        let next = mod(i + 1, m);
        while (!active[next]) next = mod(next + 1, m);
        const [a, b] = [out[i], out[next]];
        if ((b[0] - a[0]) * lines[i].u[0] + (b[1] - a[1]) * lines[i].u[1] < -1e-12) {
          active[i] = false;
          reversed = true;
        }
      }
      if (!reversed) return polygonArea(out) > -1e-12 ? out : null;
    }
    return null;
  }

  // Largest inset before the polygon vanishes (the inradius for a
  // regular shape; half the width for a rectangle, which ends in a keel).
  function maxInset(poly) {
    let [lo, hi] = [0, 2];
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      const out = insetPolygon(poly, mid);
      if (out && polygonArea(out) > 1e-12) lo = mid;
      else hi = mid;
    }
    return lo;
  }

  // ── Half styles ────────────────────────────────────────────────────
  // Each half is generated above its girdle ring, `w` measuring the
  // height above it; H mirrors the bottom half (z negated, faces
  // reversed) so every style serves as a crown or as a pavilion.
  const NAMES = {
    top: { table: 'table', star: 'star', main: 'bezel', mid: 'upper girdle',
           step: 'crown step', facet: 'crown facet', dome: 'dome',
           bevel: 'bevel', flat: 'top' },
    bottom: { table: 'culet', star: 'pavilion star', main: 'pavilion main',
              mid: 'lower girdle', step: 'pavilion step', facet: 'pavilion facet',
              dome: 'dome', bevel: 'bevel', flat: 'base' },
  };

  function brilliantHalf(H, p) {
    // table T, star points S between the mains, girdle mains G. A star
    // point sits `reach` of the way from the girdle to the table; pushing
    // it out by 1/cos(pi/n) keeps every kite (bezel, pavilion main)
    // exactly planar on a round outline.
    const { n } = H;
    const table = clamp(p.table, 0, 0.95);
    const reach = clamp(H.side === 'top' ? 1 - p.star : p.star, 0.05, 0.95);
    const along = 1 - reach * (1 - table);
    const starScale = Math.min(along / Math.cos(Math.PI / n), 0.995);
    const T = range(n).map((i) => H.scaled(i / n, table, p.height));
    const S = range(n).map((i) => H.scaled((i + 0.5) / n, starScale, reach * p.height));
    H.face(T.slice(), H.names.table);
    for (let i = 0; i < n; i++) {
      const [next, prev] = [(i + 1) % n, (i - 1 + n) % n];
      H.face([S[i], T[next], T[i]], H.names.star);
      H.face([H.at(i / n), S[i], T[i], S[prev]], H.names.main);
      H.face([...H.arc(i / n, (i + 0.5) / n), S[i]], H.names.mid);
      H.face([...H.arc((i + 0.5) / n, (i + 1) / n), S[i]], H.names.mid);
    }
  }

  function singleHalf(H, p) {
    // octagonal table, one facet per main down to the girdle
    const { n } = H;
    const T = range(n).map((i) => H.scaled(i / n, clamp(p.table, 0, 0.95), p.height));
    H.face(T.slice(), H.names.table);
    for (let i = 0; i < n; i++) {
      H.face([...H.arc(i / n, (i + 1) / n), T[(i + 1) % n], T[i]], H.names.main);
    }
  }

  function frenchHalf(H, p) {
    // a table turned 45 degrees: its corners point at the middle of the
    // girdle sides, a triangle drops from each table edge to a corner
    const T = range(4).map((i) => H.scaled(i / 4, clamp(p.table, 0, 0.95), p.height));
    H.face(T.slice(), H.names.table);
    for (let i = 0; i < 4; i++) {
      H.face([H.at((i + 0.5) / 4), T[(i + 1) % 4], T[i]], H.names.star);
      H.face([...H.arc((i - 0.5) / 4, (i + 0.5) / 4), T[i]], H.names.main);
    }
  }

  function stepHalf(H, p) {
    // concentric rows parallel to the outline, steeper near the girdle
    const taus = H.polygonal ? H.corners.slice()
      : [...new Set(H.corners.concat(range(2 * H.n).map((j) => j / (2 * H.n)))
        .map((t) => Math.round(mod(t, 1) * H.M) / H.M))].sort((a, b) => a - b);
    const poly = taus.map((t) => H.point(t));
    const rows = Math.max(1, Math.round(p.rows));
    const table = clamp(p.table, 0, 0.95);
    const convex = isConvex(poly);
    const limit = convex ? maxInset(poly) : 0;
    const rings = [null];
    for (let k = 1; k <= rows; k++) {
      const u = k / rows;
      const w = p.height * (1 - (1 - u) ** 1.7);
      const ring = convex
        ? insetPolygon(poly, (1 - table) * limit * u) || poly.map(() => H.C)
        : taus.map((t) => H.pointScaled(t, 1 - u * (1 - table)));
      rings.push(ring.map((q) => H.vertex(q[0], q[1], w)));
    }
    const m = taus.length;
    for (let k = 0; k < rows; k++) {
      for (let e = 0; e < m; e++) {
        const f = (e + 1) % m;
        const lower = k === 0 ? H.arc(taus[e], taus[f]) : [rings[k][e], rings[k][f]];
        H.face([...lower, rings[k + 1][f], rings[k + 1][e]], H.names.step);
      }
    }
    H.face(rings[rows].slice(), H.names.table);
  }

  function roseHalf(H, p) {
    // rings of n points on a dome, each turned half a step from the
    // previous one: the classic triangular facets
    const { n } = H;
    const rows = Math.max(1, Math.round(p.rows));
    const rings = range(rows).map((r) => {
      const phi = ((r + 1) / (rows + 1)) * (Math.PI / 2);
      const shift = r % 2 ? 0 : 0.5;
      return range(n).map((i) => H.scaled((i + shift) / n, Math.cos(phi),
                                          p.height * Math.sin(phi)));
    });
    for (let i = 0; i < n; i++) {
      const U = rings[0];
      H.face([...H.arc(i / n, (i + 1) / n), U[i]], H.names.facet);
      H.face([H.at((i + 1) / n), U[(i + 1) % n], U[i]], H.names.facet);
    }
    for (let r = 0; r + 1 < rows; r++) {
      const A = rings[r];
      // B[i] must lie between A[i] and A[i+1]
      const B = r % 2 === 0 ? rings[r + 1].map((_, i) => rings[r + 1][(i + 1) % n])
        : rings[r + 1];
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        H.face([A[i], A[j], B[i]], H.names.facet);
        H.face([A[j], B[j], B[i]], H.names.facet);
      }
    }
    const top = rings[rows - 1];
    const apex = H.vertex(H.C[0], H.C[1], p.height);
    for (let i = 0; i < n; i++) H.face([top[i], top[(i + 1) % n], apex], H.names.facet);
  }

  // Low-pass a closed ring of 2D points (as complex numbers): harmonic
  // k keeps exp(-(k^2 - 1) t) of its amplitude, so the fitted ellipse
  // (k = +-1) stays whole while corners and tips round off as t grows.
  function lowPass(points, t) {
    const m = points.length;
    const cos = range(m).map((i) => Math.cos((TAU * i) / m));
    const sin = range(m).map((i) => Math.sin((TAU * i) / m));
    const coeffs = range(m).map((k) => {
      let [re, im] = [0, 0];
      for (let j = 0; j < m; j++) {
        const [c, s] = [cos[(k * j) % m], -sin[(k * j) % m]];
        re += points[j][0] * c - points[j][1] * s;
        im += points[j][0] * s + points[j][1] * c;
      }
      const f = k > m / 2 ? k - m : k;
      const keep = Math.exp(-Math.max(0, f * f - 1) * t) / m;
      return [re * keep, im * keep];
    });
    return range(m).map((j) => {
      let [x, y] = [0, 0];
      for (let k = 0; k < m; k++) {
        const [c, s] = [cos[(k * j) % m], sin[(k * j) % m]];
        x += coeffs[k][0] * c - coeffs[k][1] * s;
        y += coeffs[k][0] * s + coeffs[k][1] * c;
      }
      return [x, y];
    });
  }

  // Distance from the origin to a closed polygon along unit direction d
  // (the nearest crossing).
  function rayHit(polygon, d) {
    let best = Infinity;
    for (let j = 0; j < polygon.length; j++) {
      const [a, b] = [polygon[j], polygon[(j + 1) % polygon.length]];
      const e = [b[0] - a[0], b[1] - a[1]];
      const den = d[0] * e[1] - d[1] * e[0];
      if (Math.abs(den) < 1e-15) continue;
      const rho = (a[0] * e[1] - a[1] * e[0]) / den;
      const s = (a[0] * d[1] - a[1] * d[0]) / den;
      if (rho > 0 && s >= -1e-12 && s <= 1 + 1e-12) best = Math.min(best, rho);
    }
    return best;
  }

  function domeHalf(H, p) {
    // superellipse profile: fullness 2 is an ellipse (a sphere on a round
    // outline with height 0.5), more is fuller, less is pointier. The
    // rings round off as they rise, so a pear's tip or a square's corner
    // softens toward the top instead of ridging up to the apex.
    const rows = 18;
    const e = clamp(p.fullness, 0.5, 8);
    const outline = range(H.M).map((j) => {
      const q = H.point(j / H.M);
      return [q[0] - H.C[0], q[1] - H.C[1]];
    });
    let lower = H.ring;
    for (let r = 1; r <= rows; r++) {
      const u = r / (rows + 1);
      const phi = u * (Math.PI / 2);
      const scale = Math.cos(phi) ** (2 / e);
      const w = p.height * Math.sin(phi) ** (2 / e);
      // a tip rounds over ~0.1 of the width low down, nearly an egg on
      // top - but never past the girdle seen from above: a ring drawn at
      // `scale` reaches at most outline / scale from the centre
      const shape = lowPass(outline, H.rounding * u).map((q) => {
        const rho = Math.hypot(q[0], q[1]);
        if (rho < 1e-12) return q;
        const limit = rayHit(outline, [q[0] / rho, q[1] / rho]) / scale;
        return rho > limit ? [(q[0] / rho) * limit, (q[1] / rho) * limit] : q;
      });
      const upper = shape.map((q) =>
        H.vertex(H.C[0] + scale * q[0], H.C[1] + scale * q[1], w));
      for (let j = 0; j < H.M; j++) {
        const k = (j + 1) % H.M;
        H.face([lower[j], lower[k], upper[k], upper[j]], H.names.dome, true);
      }
      lower = upper;
    }
    const apex = H.vertex(H.C[0], H.C[1], p.height);
    for (let j = 0; j < H.M; j++) {
      H.face([lower[j], lower[(j + 1) % H.M], apex], H.names.dome, true);
    }
  }

  function flatHalf(H, p) {
    // a flat face, with a small bevel all around when height > 0
    let ring = H.ring;
    if (p.height > 1e-4) {
      const scale = Math.max(0.05, 1 - 2 * p.height);
      const upper = range(H.M).map((j) => H.scaled(j / H.M, scale, p.height));
      for (let j = 0; j < H.M; j++) {
        const k = (j + 1) % H.M;
        H.face([ring[j], ring[k], upper[k], upper[j]], H.names.bevel, true);
      }
      ring = upper;
    }
    H.face(ring.slice(), H.names.flat);
  }

  const HALVES = {
    brilliant: brilliantHalf, step: stepHalf, single: singleHalf,
    french: frenchHalf, rose: roseHalf, dome: domeHalf, flat: flatHalf,
  };

  // ── Parameters (also drive the page's controls) ────────────────────
  const PARAMS = {
    ratio: { label: 'Length / width', min: 0.4, max: 3.5, step: 0.01, format: 'x' },
    girdle: { label: 'Girdle', min: 0, max: 0.5, step: 0.005, format: '%' },
    squareness: { label: 'Squareness', min: 0, max: 1, step: 0.01, format: '%', value: 0.45 },
    corner: { label: 'Corner cut', min: 0, max: 0.45, step: 0.005, format: '%', value: 0.15 },
    taper: { label: 'Narrow end', min: 0.05, max: 1, step: 0.01, format: '%', value: 0.55 },
    shoulder: { label: 'Shoulder', min: 0.1, max: 0.9, step: 0.01, format: '%', value: 0.3 },
    bulge: { label: 'Side bow', min: -0.1, max: 0.4, step: 0.005, format: '%', value: 0.12 },
    inner: { label: 'Inner radius', min: 0.15, max: 0.95, step: 0.01, format: '%', value: 0.5 },
    lobeDepth: { label: 'Lobe depth', min: 0, max: 0.3, step: 0.005, format: '%', value: 0.07 },
    irregularity: { label: 'Irregularity', min: 0, max: 0.3, step: 0.005, format: '%', value: 0 },
    seed: { label: 'Seed', min: 1, max: 99, step: 1, format: 'int', value: 7 },
    hole: { label: 'Hole', min: 0.05, max: 0.85, step: 0.01, format: '%', value: 0.38 },
    thickness: { label: 'Thickness', min: 0.05, max: 1, step: 0.01, format: '%', value: 0.32 },
  };
  const HALF_PARAMS = {
    height: { top: 'Crown height', bottom: 'Pavilion depth', min: 0, max: 0.9, step: 0.005, format: '%' },
    table: { top: 'Table', bottom: 'Culet', min: 0, max: 0.95, step: 0.01, format: '%' },
    star: { top: 'Star length', bottom: 'Lower girdle length', min: 0.05, max: 0.95, step: 0.01, format: '%' },
    rows: { top: 'Rows', bottom: 'Rows', min: 1, max: 6, step: 1, format: 'int' },
    fullness: { top: 'Fullness', bottom: 'Fullness', min: 0.8, max: 6, step: 0.1, format: 'x' },
  };
  const STYLES = {
    brilliant: {
      label: 'Brilliant', params: ['height', 'table', 'star'],
      top: { height: 0.15, table: 0.56, star: 0.5 },
      bottom: { height: 0.43, table: 0, star: 0.78 },
    },
    step: {
      label: 'Step', params: ['height', 'table', 'rows'],
      top: { height: 0.12, table: 0.6, rows: 3 },
      bottom: { height: 0.44, table: 0, rows: 3 },
    },
    single: {
      label: 'Single cut', params: ['height', 'table'],
      top: { height: 0.14, table: 0.55 }, bottom: { height: 0.42, table: 0 },
    },
    french: {
      label: 'French', params: ['height', 'table'],
      top: { height: 0.14, table: 0.55 }, bottom: { height: 0.42, table: 0 },
    },
    rose: {
      label: 'Rose (faceted dome)', params: ['height', 'rows'],
      top: { height: 0.28, rows: 2 }, bottom: { height: 0.28, rows: 2 },
    },
    dome: {
      label: 'Smooth dome', params: ['height', 'fullness'],
      top: { height: 0.3, fullness: 2 }, bottom: { height: 0.2, fullness: 2 },
    },
    flat: {
      label: 'Flat', params: ['height'], labels: { height: 'Bevel' },
      top: { height: 0.02 }, bottom: { height: 0.02 },
    },
  };

  // Named cut presets: what a trade name means for the two halves.
  const CUTS = {
    brilliant: { girdle: 0.03, top: { style: 'brilliant' }, bottom: { style: 'brilliant' } },
    step: { girdle: 0.03, top: { style: 'step' }, bottom: { style: 'step' } },
    single: { girdle: 0.03, top: { style: 'single' }, bottom: { style: 'single' } },
    french: { girdle: 0.03, top: { style: 'french' }, bottom: { style: 'step', rows: 2 } },
    rose: { girdle: 0.02, top: { style: 'rose' }, bottom: { style: 'flat', height: 0 } },
    cabochon: { girdle: 0.06, top: { style: 'dome', height: 0.32 },
                bottom: { style: 'flat', height: 0.01 } },
    cabochonFaceted: { girdle: 0.05, top: { style: 'rose', height: 0.32, rows: 3 },
                       bottom: { style: 'flat', height: 0.01 } },
    doubleCabochon: { girdle: 0.04, top: { style: 'dome', height: 0.24 },
                      bottom: { style: 'dome', height: 0.16 } },
    buffTop: { girdle: 0.03, top: { style: 'dome', height: 0.18 },
               bottom: { style: 'brilliant' } },
    briolette: { girdle: 0.02, top: { style: 'rose', height: 0.22, rows: 3 },
                 bottom: { style: 'rose', height: 0.22, rows: 3 } },
    flat: { girdle: 0.18, top: { style: 'flat' }, bottom: { style: 'flat' } },
    disk: { girdle: 0.12, top: { style: 'flat', height: 0.01 },
            bottom: { style: 'flat', height: 0.01 } },
    diskSmooth: { girdle: 0.1, top: { style: 'dome', height: 0.06 },
                  bottom: { style: 'dome', height: 0.06 } },
    bead: { girdle: 0, top: { style: 'dome', height: 0.5 },
            bottom: { style: 'dome', height: 0.5 } },
    beadFaceted: { girdle: 0, top: { style: 'rose', height: 0.5, rows: 4 },
                   bottom: { style: 'rose', height: 0.5, rows: 4 } },
    rondelle: { girdle: 0.04, top: { style: 'rose', height: 0.2, rows: 2 },
                bottom: { style: 'rose', height: 0.2, rows: 2 } },
    button: { girdle: 0.06, top: { style: 'dome', height: 0.3 },
              bottom: { style: 'dome', height: 0.08 } },
    drop: { girdle: 0, top: { style: 'dome', height: 0.42 },
            bottom: { style: 'dome', height: 0.42 } },
    dropFaceted: { girdle: 0, top: { style: 'rose', height: 0.42, rows: 4 },
                   bottom: { style: 'rose', height: 0.42, rows: 4 } },
    tumbled: { girdle: 0.05, irregularity: 0.12, top: { style: 'dome', height: 0.3 },
               bottom: { style: 'dome', height: 0.28 } },
    tumbledFaceted: { girdle: 0.04, irregularity: 0.1,
                      top: { style: 'rose', height: 0.3, rows: 3 },
                      bottom: { style: 'rose', height: 0.3, rows: 3 } },
    donut: { form: 'donut' },
  };

  const TOP_KEYS = ['form', 'outline', 'ratio', 'symmetry', 'girdle']
    .concat(Object.keys(PARAMS).filter((k) => PARAMS[k].value !== undefined));

  function resolveHalf(side, half) {
    const given = half || {};
    const style = STYLES[given.style] ? given.style : 'brilliant';
    const out = Object.assign({ style }, STYLES[style][side]);
    for (const key of STYLES[style].params) {
      if (typeof given[key] === 'number') out[key] = given[key];
    }
    return out;
  }

  // Partial spec -> complete spec: defaults filled in, unknown keys out.
  function resolve(partial) {
    const given = partial || {};
    const outline = OUTLINES[given.outline] ? given.outline : 'round';
    const def = OUTLINES[outline];
    // every key listed up front: resolved specs share one key order
    const spec = { form: given.form === 'donut' ? 'donut' : 'cut', outline,
                   ratio: 1, symmetry: def.n, girdle: 0.03 };
    for (const [key, param] of Object.entries(PARAMS)) {
      if (param.value !== undefined) spec[key] = param.value;
    }
    for (const key of TOP_KEYS) {
      if (typeof given[key] === 'number') spec[key] = given[key];
    }
    spec.symmetry = def.symmetries.includes(given.symmetry) ? given.symmetry : def.n;
    if (def.fixedRatio) spec.ratio = def.ratio;
    else if (typeof given.ratio !== 'number') {
      spec.ratio = def.ratio || naturalRatio(outline, spec);
    }
    spec.top = resolveHalf('top', given.top);
    spec.bottom = resolveHalf('bottom', given.bottom);
    return spec;
  }

  // Cut preset + overrides -> partial spec (halves merged key by key).
  function fromCut(cut, overrides) {
    const preset = CUTS[cut] || CUTS.brilliant;
    const extra = overrides || {};
    return Object.assign({}, preset, extra, {
      top: Object.assign({}, preset.top, extra.top),
      bottom: Object.assign({}, preset.bottom, extra.bottom),
    });
  }

  // ── Build ──────────────────────────────────────────────────────────
  // Smallest girdle sampling, a multiple of 2n, that hits every
  // required t exactly.
  function girdleSamples(n, required, minimum) {
    for (let k = 1; k <= 64; k++) {
      const M = 2 * n * k;
      if (M < minimum) continue;
      if (required.every((t) => Math.abs(t * M - Math.round(t * M)) < 1e-6)) return M;
    }
    return 2 * n * 16;
  }

  function centroid(points) {
    let [a, cx, cy] = [0, 0, 0];
    for (let i = 0; i < points.length; i++) {
      const [p, q] = [points[i], points[(i + 1) % points.length]];
      const c = p[0] * q[1] - q[0] * p[1];
      a += c; cx += (p[0] + q[0]) * c; cy += (p[1] + q[1]) * c;
    }
    return Math.abs(a) < 1e-12 ? [0, 0] : [cx / (3 * a), cy / (3 * a)];
  }

  function buildCut(mesh, outline, spec) {
    const n = spec.symmetry;
    const styles = [spec.top.style, spec.bottom.style];
    const required = outline.corners
      .concat(styles.includes('french') ? odd(4) : []);
    const M = girdleSamples(n, required, styles.includes('dome') ? 96 : 48);
    const P = range(M).map((j) => outline.point(j / M));
    const C = centroid(P);
    const g = spec.girdle / 2;
    const rings = {
      top: P.map((q) => mesh.vertex(q[0], q[1], g)),
      bottom: P.map((q) => mesh.vertex(q[0], q[1], -g)),
    };
    for (let j = 0; j < M; j++) {
      const k = (j + 1) % M;
      mesh.face([rings.bottom[j], rings.bottom[k], rings.top[k], rings.top[j]],
                'girdle', true);
    }
    for (const side of ['top', 'bottom']) {
      const sign = side === 'top' ? 1 : -1;
      const ring = rings[side];
      const index = (t) => mod(Math.round(t * M), M);
      const pointScaled = (t, s) => {
        const q = outline.point(t);
        return [C[0] + s * (q[0] - C[0]), C[1] + s * (q[1] - C[1])];
      };
      const H = {
        side, n, M, C, ring,
        corners: outline.corners, polygonal: outline.polygonal,
        rounding: outline.rounding,
        names: NAMES[side],
        point: outline.point,
        pointScaled,
        vertex: (x, y, w) => mesh.vertex(x, y, sign * (g + w)),
        scaled: (t, s, w) => {
          const q = pointScaled(t, s);
          return mesh.vertex(q[0], q[1], sign * (g + w));
        },
        at: (t) => ring[index(t)],
        arc: (t0, t1) => {
          const out = [];
          const end = index(t1);
          for (let j = index(t0); ; j = (j + 1) % M) {
            out.push(ring[j]);
            if (j === end) break;
          }
          return out;
        },
        face: (indices, kind, smooth) =>
          mesh.face(sign > 0 ? indices : indices.slice().reverse(), kind, smooth),
      };
      HALVES[spec[side].style](H, spec[side]);
    }
  }

  function buildDonut(mesh, outline, spec) {
    // a tube swept around the outline, elliptic cross-section
    const M = girdleSamples(spec.symmetry, outline.corners, 96);
    const Q = 28;
    const P = range(M).map((j) => outline.point(j / M));
    const C = centroid(P);
    const hole = clamp(spec.hole, 0.02, 0.95);
    const grid = P.map((q) => {
      const r = [q[0] - C[0], q[1] - C[1]];
      return range(Q).map((k) => {
        const phi = (k / Q) * TAU;
        const f = (1 + hole) / 2 + Math.cos(phi) * (1 - hole) / 2;
        return mesh.vertex(C[0] + f * r[0], C[1] + f * r[1],
                           Math.sin(phi) * spec.thickness / 2);
      });
    });
    for (let j = 0; j < M; j++) {
      for (let k = 0; k < Q; k++) {
        const [j1, k1] = [(j + 1) % M, (k + 1) % Q];
        mesh.face([grid[j][k], grid[j1][k], grid[j1][k1], grid[j][k1]], 'tube', true);
      }
    }
  }

  // Deterministic pseudo-random numbers (mulberry32).
  function random(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // Tumbled, baroque: push every vertex along its direction from the
  // centre by a smooth random field - the mesh stays closed.
  function roughen(vertices, amount, seed) {
    if (!(amount > 0)) return;
    const rand = random(seed * 7919 + 13);
    const waves = range(5).map(() => {
      const z = rand() * 2 - 1;
      const a = rand() * TAU;
      const r = Math.sqrt(1 - z * z);
      return { d: [r * Math.cos(a), r * Math.sin(a), z],
               f: 0.5 + rand() * 0.8, phase: rand() * TAU };
    });
    const c = [0, 1, 2].map((axis) => vertices.reduce((s, v) => s + v[axis], 0)
      / vertices.length);
    for (const v of vertices) {
      const r = [v[0] - c[0], v[1] - c[1], v[2] - c[2]];
      const len = Math.hypot(...r) || 1;
      const u = r.map((x) => x / len);
      let noise = 0;
      for (const w of waves) {
        noise += Math.sin(w.f * (u[0] * w.d[0] + u[1] * w.d[1] + u[2] * w.d[2]) * Math.PI
                          + w.phase);
      }
      const k = 1 + amount * noise / waves.length * 2;
      for (let i = 0; i < 3; i++) v[i] = c[i] + r[i] * k;
    }
  }

  function faceNormal(vertices, face) {
    // Newell's method: robust for polygons that are not quite planar
    let [x, y, z] = [0, 0, 0];
    const v = face.v;
    for (let i = 0; i < v.length; i++) {
      const [a, b] = [vertices[v[i]], vertices[v[(i + 1) % v.length]]];
      x += (a[1] - b[1]) * (a[2] + b[2]);
      y += (a[2] - b[2]) * (a[0] + b[0]);
      z += (a[0] - b[0]) * (a[1] + b[1]);
    }
    const len = Math.hypot(x, y, z);
    return { normal: len > 1e-15 ? [x / len, y / len, z / len] : [0, 0, 1],
             area: len / 2 };
  }

  function signedVolume(vertices, faces) {
    let volume = 0;
    for (const face of faces) {
      const a = vertices[face.v[0]];
      for (let i = 1; i + 1 < face.v.length; i++) {
        const [b, c] = [vertices[face.v[i]], vertices[face.v[i + 1]]];
        volume += (a[0] * (b[1] * c[2] - b[2] * c[1])
                   - a[1] * (b[0] * c[2] - b[2] * c[0])
                   + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
      }
    }
    return volume;
  }

  // Spec (partial or complete) -> { spec, vertices, faces }.
  // faces: [{ v: [vertex indices], kind: 'bezel'..., smooth: bool }].
  function build(partial) {
    const spec = resolve(partial);
    const outline = makeOutline(spec);
    const mesh = meshBuilder();
    if (spec.form === 'donut') buildDonut(mesh, outline, spec);
    else buildCut(mesh, outline, spec);
    roughen(mesh.vertices, spec.irregularity, spec.seed);
    if (signedVolume(mesh.vertices, mesh.faces) < 0) {
      for (const face of mesh.faces) face.v.reverse();
    }
    return { spec, vertices: mesh.vertices, faces: mesh.faces };
  }

  // ── Render buffers ─────────────────────────────────────────────────
  // Mesh -> flat triangle arrays. Faceted faces get their own normal (one
  // flat colour per facet); smooth faces average the normals of smooth
  // neighbours within `smoothAngle`, so corners and rims stay crisp.
  // Edges: facet outlines, and creases between smooth faces.
  function toBuffers(mesh, options) {
    const smoothCos = Math.cos(((options && options.smoothAngle) || 50) * Math.PI / 180);
    const { vertices, faces } = mesh;
    const info = faces.map((f) => faceNormal(vertices, f));
    const around = vertices.map(() => []);
    faces.forEach((f, i) => { for (const v of f.v) around[v].push(i); });

    const positions = [];
    const normals = [];
    const cornerNormal = (fi, v) => {
      const own = info[fi].normal;
      if (!faces[fi].smooth) return own;
      const sum = [0, 0, 0];
      for (const gi of around[v]) {
        if (!faces[gi].smooth) continue;
        const n = info[gi].normal;
        if (n[0] * own[0] + n[1] * own[1] + n[2] * own[2] < smoothCos) continue;
        for (let k = 0; k < 3; k++) sum[k] += n[k] * info[gi].area;
      }
      const len = Math.hypot(...sum);
      return len > 1e-15 ? sum.map((x) => x / len) : own;
    };
    const push = (p, n) => { positions.push(p[0], p[1], p[2]); normals.push(n[0], n[1], n[2]); };

    let facets = 0;
    faces.forEach((f, fi) => {
      if (info[fi].area < 1e-12) return;
      if (!f.smooth) facets += 1;
      const corners = f.v.map((v) => [vertices[v], cornerNormal(fi, v)]);
      if (corners.length <= 4) {
        for (let i = 1; i + 1 < corners.length; i++) {
          for (const c of [corners[0], corners[i], corners[i + 1]]) push(c[0], c[1]);
        }
      } else {
        // fan around the centroid: fine for the star-shaped caps here
        const mid = [0, 1, 2].map((k) => corners.reduce((s, c) => s + c[0][k], 0)
          / corners.length);
        for (let i = 0; i < corners.length; i++) {
          const next = corners[(i + 1) % corners.length];
          push(mid, info[fi].normal);
          push(corners[i][0], corners[i][1]);
          push(next[0], next[1]);
        }
      }
    });

    const edgeFaces = new Map();
    faces.forEach((f, fi) => {
      if (info[fi].area < 1e-12) return;
      f.v.forEach((a, i) => {
        const b = f.v[(i + 1) % f.v.length];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        if (!edgeFaces.has(key)) edgeFaces.set(key, [a, b, []]);
        edgeFaces.get(key)[2].push(fi);
      });
    });
    const edges = [];
    for (const [a, b, list] of edgeFaces.values()) {
      let draw = list.length !== 2;
      if (!draw) {
        const [f, g] = list;
        const d = info[f].normal.reduce((s, x, k) => s + x * info[g].normal[k], 0);
        draw = faces[f].smooth && faces[g].smooth ? d < smoothCos : d < 0.99999;
      }
      if (draw) edges.push(...vertices[a], ...vertices[b]);
    }

    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    for (const v of vertices) {
      for (let k = 0; k < 3; k++) {
        min[k] = Math.min(min[k], v[k]);
        max[k] = Math.max(max[k], v[k]);
      }
    }
    return {
      positions: new Float32Array(positions),
      normals: new Float32Array(normals),
      edges: new Float32Array(edges),
      bounds: { min, max },
      stats: { facets, faces: faces.length, vertices: vertices.length,
               triangles: positions.length / 9 },
    };
  }

  return {
    OUTLINES, STYLES, PARAMS, HALF_PARAMS, CUTS,
    resolve, fromCut, build, toBuffers, naturalRatio,
    faceNormal, signedVolume, insetPolygon, maxInset,
  };
});
