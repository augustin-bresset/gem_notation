// Gemstone Notation - smart dictionary search.
// Matches on code AND name, accent- and case-insensitive, ranked so that
// what a human types wins: an exact code first, then names starting with
// the query, then word starts, then the code as a prefix, then plain
// substrings. Typing "jadeite" finds the hue 1J - Jadeite even though
// its display label starts with "1J".
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GemSearch = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function normalize(text) {
    return (text || '').toLowerCase().normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  }

  // rows: [{code, name, ...}] -> ranked matches (best first).
  function search(rows, query) {
    const q = normalize(query).trim();
    if (!q) return rows.slice();
    const scored = [];
    for (const row of rows) {
      const code = normalize(row.code);
      const name = normalize(row.name);
      let score = null;
      if (code === q) score = 0;
      else if (name === q) score = 1;
      else if (name.startsWith(q)) score = 2;
      else if (name.split(/[^a-z0-9]+/).some((w) => w.startsWith(q))) score = 3;
      else if (code.startsWith(q)) score = 4;
      else if (name.includes(q)) score = 5;
      else if (code.includes(q)) score = 6;
      if (score !== null) scored.push([score, row]);
    }
    scored.sort((a, b) => a[0] - b[0]
      || (normalize(a[1].name) < normalize(b[1].name) ? -1
        : normalize(a[1].name) > normalize(b[1].name) ? 1 : 0));
    return scored.map((entry) => entry[1]);
  }

  return { normalize, search };
});
