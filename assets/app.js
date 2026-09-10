// Gemstone Notation - site behaviour. Plain scripts, no build step.
(function () {
  'use strict';
  const D = window.GEM_DATA;
  const G = window.GemGrammar;
  const $ = (id) => document.getElementById(id);

  const byCode = (rows) => Object.fromEntries(rows.map((r) => [r.code, r]));
  const stones = byCode(D.stones);
  const grades = byCode(D.grades);
  const hues = byCode(D.hues);
  const shapes = byCode(D.shapes);
  const categories = byCode(D.categories);

  // ── Compose panel ──────────────────────────────────────────────────
  function fillSelect(select, rows, labelOf) {
    for (const row of rows) {
      const option = document.createElement('option');
      option.value = row.code;
      option.textContent = labelOf(row);
      select.appendChild(option);
    }
  }

  const stoneSelect = $('stone');
  for (const category of D.categories) {
    const group = document.createElement('optgroup');
    group.label = category.name;
    for (const stone of D.stones.filter((s) => s.category === category.code)) {
      const option = document.createElement('option');
      option.value = stone.code;
      option.textContent = `${stone.code} — ${stone.name}`;
      group.appendChild(option);
    }
    if (group.children.length) stoneSelect.appendChild(group);
  }
  const uncategorised = D.stones.filter((s) => !categories[s.category]);
  if (uncategorised.length) {
    fillSelect(stoneSelect, uncategorised, (s) => `${s.code} — ${s.name}`);
  }
  fillSelect($('grade'), D.grades, (g) => `${g.code} — ${g.name}`);
  fillSelect($('hue'), D.hues, (h) => `${h.code} — ${h.name}`);
  fillSelect($('shape'), D.shapes, (f) => `${f.code} — ${f.name}`);

  let composed = null;

  function refreshCompose() {
    const stone = stones[stoneSelect.value];
    const output = $('composed');
    const notes = $('compose-notes');
    notes.textContent = '';
    output.classList.remove('error');
    $('add-stone').disabled = !stone;
    if (!stone) {
      composed = null;
      output.textContent = '· ·';
      return;
    }
    const grade = grades[$('grade').value] || null;
    const hue = hues[$('hue').value] || null;
    const shape = shapes[$('shape').value] || null;
    const built = G.buildToken(stone, grade, hue, shape);
    composed = built.problems.length ? null : built.token;
    output.textContent = built.token;
    $('add-stone').disabled = !composed;
    const omitted = [];
    if (grade && grade.code === stone.default_grade) omitted.push('grade (default)');
    if (hue && (hue.code === stone.default_hue || hue.code === stone.implied_hue)) {
      omitted.push('hue (default or implied)');
    }
    if (shape && shape.code === stone.default_shape) omitted.push('shape (default)');
    const lines = [];
    if (stone.implied_hue && hues[stone.implied_hue]) {
      lines.push(`Implied hue: ${hues[stone.implied_hue].name}`);
    }
    if (omitted.length) lines.push(`Omitted: ${omitted.join(', ')}`);
    if (built.problems.length) {
      output.classList.add('error');
      lines.push(...built.problems);
    }
    notes.textContent = lines.join('\n');
  }
  for (const id of ['stone', 'grade', 'hue', 'shape']) {
    $(id).addEventListener('change', refreshCompose);
  }
  refreshCompose();

  // ── Product builder ────────────────────────────────────────────────
  const product = [];

  function refreshProduct() {
    const list = $('product-lines');
    list.innerHTML = '';
    product.forEach((line, index) => {
      const row = document.createElement('div');
      row.className = 'product-line';
      row.innerHTML = `
        <span class="mono">${line.token}</span>
        <label>weight <input type="number" step="0.01" min="0" value="${line.weight}"></label>
        <label><input type="radio" name="center" ${line.isCenter ? 'checked' : ''}> center</label>
        <button type="button" title="Remove">×</button>`;
      row.querySelector('input[type=number]').addEventListener('change', (ev) => {
        line.weight = parseFloat(ev.target.value) || 0;
        refreshProduct();
      });
      row.querySelector('input[type=radio]').addEventListener('change', () => {
        product.forEach((l, i) => { l.isCenter = i === index; });
        refreshProduct();
      });
      row.querySelector('button').addEventListener('click', () => {
        product.splice(index, 1);
        refreshProduct();
      });
      list.appendChild(row);
    });
    $('product-code').textContent = product.length
      ? G.orderTokens(product).join('+')
      : '· ·';
  }
  $('add-stone').addEventListener('click', () => {
    if (!composed) return;
    product.push({ token: composed, weight: 1.0, isCenter: false });
    refreshProduct();
  });
  refreshProduct();

  // ── Read / look up ─────────────────────────────────────────────────
  function lookupMatches(text) {
    const needle = text.toLowerCase();
    const hit = (row) => row.code.toLowerCase().includes(needle)
      || row.name.toLowerCase().includes(needle);
    return {
      Stones: D.stones.filter(hit).slice(0, 12)
        .map((s) => [s.code, `${s.name}${categories[s.category] ? ' (' + categories[s.category].name + ')' : ''}`]),
      Grades: D.grades.filter(hit).slice(0, 12).map((g) => [g.code, g.name]),
      Hues: D.hues.filter(hit).slice(0, 12).map((h) => [h.code, h.name]),
      Shapes: D.shapes.filter(hit).slice(0, 12).map((f) => [f.code, f.name]),
    };
  }

  function runRead() {
    const text = $('query').value.trim();
    const out = $('read-results');
    out.innerHTML = '';
    if (!text) return;
    for (const part of text.toUpperCase().split('+').filter(Boolean)) {
      const parsed = G.parseToken(part, D);
      const card = document.createElement('div');
      card.className = 'token-card' + (parsed.problems.length ? ' bad' : '');
      const bits = [];
      if (!parsed.problems.length) {
        bits.push(parsed.stone.name);
        if (parsed.grade) bits.push(`grade ${parsed.grade.name}`);
        if (parsed.hue) bits.push(`hue ${parsed.hue.name}`);
        if (parsed.stone.implied_hue && hues[parsed.stone.implied_hue]) {
          bits.push(`implied hue ${hues[parsed.stone.implied_hue].name}`);
        }
        const shape = parsed.shape
          || (parsed.stone && shapes[parsed.stone.default_shape]) || null;
        if (shape) bits.push(`shape ${shape.name}`);
      }
      card.innerHTML = `<span class="mono strong">${parsed.token}</span> `
        + (bits.length ? bits.join(', ') : '')
        + parsed.problems.map((p) => `<div class="problem">${p}</div>`).join('');
      out.appendChild(card);
    }
    const matches = lookupMatches(text);
    for (const [label, rows] of Object.entries(matches)) {
      if (!rows.length) continue;
      const block = document.createElement('div');
      block.className = 'match-block';
      block.innerHTML = `<div class="match-title">${label}</div>`
        + rows.map(([code, name]) =>
          `<div><span class="mono strong">${code}</span> ${name}</div>`).join('');
      out.appendChild(block);
    }
    if (!out.children.length) {
      out.innerHTML = '<div class="muted">No match.</div>';
    }
  }
  $('read-btn').addEventListener('click', runRead);
  $('query').addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') runRead();
  });

  // ── Dictionary browser ─────────────────────────────────────────────
  const tabs = {
    stones: () => D.stones.map((s) => [s.code, s.name,
      categories[s.category] ? categories[s.category].name : '',
      s.implied_hue, s.default_grade, s.default_hue, s.default_shape]),
    grades: () => D.grades.map((g) => [g.code, g.name]),
    hues: () => D.hues.map((h) => [h.code, h.name]),
    shapes: () => D.shapes.map((f) => [f.code, f.name]),
  };
  const headers = {
    stones: ['Code', 'Name', 'Category', 'Implied hue',
             'Default grade', 'Default hue', 'Default shape'],
    grades: ['Code', 'Name'],
    hues: ['Code', 'Name'],
    shapes: ['Code', 'Name'],
  };
  let activeTab = 'stones';

  function renderDict() {
    const filter = $('dict-filter').value.trim().toLowerCase();
    const rows = tabs[activeTab]().filter((row) => !filter
      || row.some((cell) => String(cell).toLowerCase().includes(filter)));
    $('dict-table').innerHTML = '<tr>'
      + headers[activeTab].map((h) => `<th>${h}</th>`).join('') + '</tr>'
      + rows.map((row) => '<tr>' + row.map((cell, i) =>
          `<td class="${i === 0 ? 'mono strong' : ''}">${cell || ''}</td>`)
        .join('') + '</tr>').join('');
    $('dict-count').textContent = `${rows.length} entries`;
  }
  for (const button of document.querySelectorAll('[data-tab]')) {
    button.addEventListener('click', () => {
      activeTab = button.dataset.tab;
      for (const b of document.querySelectorAll('[data-tab]')) {
        b.classList.toggle('active', b === button);
      }
      renderDict();
    });
  }
  $('dict-filter').addEventListener('input', renderDict);
  renderDict();
})();
