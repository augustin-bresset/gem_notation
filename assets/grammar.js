// Gemstone Notation - grammar engine.
// Token grammar PP[G][BB][EE]: stone (2 letters), grade (1 digit),
// hue (digit + letter), shape (2 letters); blocks omitted on the stone's
// defaults; the widths and character classes make every token parse
// without separators. Mirrors the reference implementation of the
// gem_notation Odoo module.
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.GemGrammar = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const isDigit = (c) => c >= '0' && c <= '9';
  const isLetter = (c) => c >= 'A' && c <= 'Z';

  function indexBy(rows) {
    const map = {};
    for (const row of rows || []) map[row.code] = row;
    return map;
  }

  // All structurally valid (grade, hue, shape) splits of the part after PP.
  function splitRest(rest) {
    const valid = [];
    for (const g of [0, 1]) {
      for (const b of [0, 2]) {
        for (const e of [0, 2]) {
          if (g + b + e !== rest.length) continue;
          const grade = rest.slice(0, g);
          const hue = rest.slice(g, g + b);
          const shape = rest.slice(g + b);
          if (g && !isDigit(grade)) continue;
          if (b && !(isDigit(hue[0]) && isLetter(hue[1]))) continue;
          if (e && !(isLetter(shape[0]) && isLetter(shape[1]))) continue;
          valid.push([grade, hue, shape]);
        }
      }
    }
    return valid;
  }

  // Token -> dictionary rows. Returns {token, stone, grade, hue, shape,
  // problems[]}; rows are null when the block is absent or unknown.
  function parseToken(token, dicts) {
    const result = {
      token: (token || '').trim().toUpperCase(),
      stone: null, grade: null, hue: null, shape: null, problems: [],
    };
    const text = result.token;
    if (text.length < 2 || !(isLetter(text[0]) && isLetter(text[1]))) {
      result.problems.push(
        `'${text}': a token starts with a 2-letter stone code`);
      return result;
    }
    const splits = splitRest(text.slice(2));
    if (splits.length !== 1) {
      result.problems.push(`'${text}': not a valid PP[G][BB][EE] token`);
      return result;
    }
    const [gradeCode, hueCode, shapeCode] = splits[0];
    const stones = indexBy(dicts.stones);
    const grades = indexBy(dicts.grades);
    const hues = indexBy(dicts.hues);
    const shapes = indexBy(dicts.shapes);

    result.stone = stones[text.slice(0, 2)] || null;
    if (!result.stone) {
      result.problems.push(`unknown stone '${text.slice(0, 2)}'`);
    }
    if (gradeCode) {
      result.grade = grades[gradeCode] || null;
      if (!result.grade) result.problems.push(`unknown grade '${gradeCode}'`);
    }
    if (hueCode) {
      result.hue = hues[hueCode] || null;
      if (!result.hue) {
        result.problems.push(`unknown hue '${hueCode}'`);
      } else if (result.stone && result.stone.implied_hue) {
        result.problems.push(
          `'${text}': stone ${result.stone.code} already implies hue `
          + `${result.stone.implied_hue} - double colour`);
      }
    }
    if (shapeCode) {
      result.shape = shapes[shapeCode] || null;
      if (!result.shape) result.problems.push(`unknown shape '${shapeCode}'`);
    }
    return result;
  }

  // Dictionary rows -> token, defaults omitted. stone is required; grade,
  // hue and shape are rows or null.
  function buildToken(stone, grade, hue, shape) {
    const problems = [];
    let token = stone.code;
    if (grade && grade.code !== stone.default_grade) token += grade.code;
    if (hue && hue.code !== stone.implied_hue
        && hue.code !== stone.default_hue) {
      if (stone.implied_hue) {
        problems.push(
          `stone ${stone.code} already implies hue ${stone.implied_hue}`
          + ' - double colour');
      }
      token += hue.code;
    }
    if (shape && shape.code !== stone.default_shape) token += shape.code;
    return { token, problems };
  }

  // (token, weight, isCenter) entries -> distinct tokens ordered: center
  // first, then heaviest single stone descending, ties by token.
  function orderTokens(entries) {
    const maxByToken = new Map();
    let center = null;
    for (const { token, weight, isCenter } of entries) {
      if (!token) continue;
      const w = weight || 0;
      if (!maxByToken.has(token) || w > maxByToken.get(token)) {
        maxByToken.set(token, w);
      }
      if (isCenter) center = token;
    }
    const rest = [...maxByToken.keys()].filter((t) => t !== center);
    rest.sort((a, b) => (maxByToken.get(b) - maxByToken.get(a))
      || (a < b ? -1 : a > b ? 1 : 0));
    return center ? [center, ...rest] : rest;
  }

  return { splitRest, parseToken, buildToken, orderTokens };
});
