// Gemstone Notation - site behaviour. Plain scripts, no build step.
(function () {
  'use strict';
  const D = window.GEM_DATA;
  const G = window.GemGrammar;
  const S = window.GemSearch;
  const $ = (id) => document.getElementById(id);

  const byCode = (rows) => Object.fromEntries(rows.map((r) => [r.code, r]));
  const categories = byCode(D.categories);
  const hues = byCode(D.hues);
  const shapes = byCode(D.shapes);

  const combo = window.GemCombo.combo;
  const script = document.currentScript;
  const ASSETS = script && script.src ? new URL('.', script.src).href : 'assets/';

  // ── 3D preview ─────────────────────────────────────────────────────
  // The chosen shape, else the stone's default one, turns in a small
  // viewer - no parameter to set. three.js and the generator load with
  // the first preview only; every parameter stays adjustable on
  // shape3d.html.
  const preview = { viewer: null, loading: null, code: null };

  function load3d() {
    if (!preview.loading) {
      // a self-contained copy of the page may hand over its own loading
      preview.loading = window.GemShape3DReady || ['vendor/three.js', 'shape3d.js', 'shape3d-recipes.js',
                         'shape3d-render.js']
        .reduce((chain, file) => chain.then(() => new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = ASSETS + file;
          script.onload = resolve;
          script.onerror = () => reject(new Error(`The 3D preview could not load ${file}.`));
          document.head.appendChild(script);
        })), Promise.resolve());
    }
    return preview.loading;
  }

  async function refreshPreview(shape, isDefault) {
    $('preview-3d').hidden = !shape;
    preview.code = shape ? shape.code : null;
    if (!shape) return;
    const status = $('preview-status');
    const stage = $('preview-stage');
    $('preview-name').textContent = `${shape.code} — ${shape.name}`;
    $('preview-adjust').href = `shape3d.html?shape=${shape.code}`;
    try {
      await load3d();
    } catch (e) {
      status.textContent = e.message;
      status.hidden = false;
      return;
    }
    if (preview.code !== shape.code) return;  // another shape was picked meanwhile
    const G3 = window.GemShape3D;
    const R = window.GemShapeRecipes;
    const recipe = R.RECIPES[shape.code];
    $('preview-cut').textContent = (recipe
      ? `${G3.OUTLINES[recipe.outline].label.toLowerCase()} · ${R.CUT_LABELS[recipe.cut]}`
      : '') + (isDefault ? ' · the stone’s default shape' : '');
    if (!preview.viewer) {
      preview.viewer = window.GemRender3D.create($('preview-canvas'), { compact: true });
    }
    stage.classList.toggle('no-model', !recipe || !preview.viewer);
    status.hidden = Boolean(recipe && preview.viewer);
    if (!preview.viewer) {
      status.textContent = 'WebGL is not available in this browser.';
    } else if (!recipe) {
      status.textContent = 'No 3D model for this shape yet.';
    } else {
      preview.viewer.setMesh(G3.toBuffers(G3.build(R.specFor(shape.code))));
    }
  }

  // ── Compose panel ──────────────────────────────────────────────────
  const selection = { stone: null, grade: null, hue: null, shape: null };
  let composed = null;

  function refreshCompose() {
    const { stone, grade, hue, shape } = selection;
    // the chosen shape, else the stone's default one, turns in 3D
    refreshPreview(shape || (stone && shapes[stone.default_shape]) || null, !shape);
    const output = $('composed');
    const notes = $('compose-notes');
    notes.textContent = '';
    output.classList.remove('error');
    composed = null;
    $('add-stone').disabled = true;
    if (!stone) {
      output.textContent = '· ·';
      return;
    }
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

  combo('stone', D.stones, {
    detailOf: (s) => categories[s.category] ? categories[s.category].name : '',
    groupsOf: () => D.categories
      .map((c) => [c.name, D.stones.filter((s) => s.category === c.code)])
      .concat([['Other', D.stones.filter((s) => !categories[s.category])]]),
  }, (row) => { selection.stone = row; refreshCompose(); });
  combo('grade', D.grades, null,
    (row) => { selection.grade = row; refreshCompose(); });
  combo('hue', D.hues, null,
    (row) => { selection.hue = row; refreshCompose(); });
  combo('shape', D.shapes, null,
    (row) => { selection.shape = row; refreshCompose(); });
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
        <label><input type="checkbox" class="center-box" ${line.isCenter ? 'checked' : ''}> center</label>
        <button type="button" title="Remove">×</button>`;
      row.querySelector('input[type=number]').addEventListener('change', (ev) => {
        line.weight = parseFloat(ev.target.value) || 0;
        refreshProduct();
      });
      row.querySelector('.center-box').addEventListener('change', (ev) => {
        if (ev.target.checked) {
          product.forEach((l, i) => { l.isCenter = i === index; });
        } else {
          line.isCenter = false;
        }
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
    return {
      Stones: S.search(D.stones, text).slice(0, 12)
        .map((s) => [s.code, `${s.name}${categories[s.category] ? ' (' + categories[s.category].name + ')' : ''}`]),
      Grades: S.search(D.grades, text).slice(0, 12).map((g) => [g.code, g.name]),
      Hues: S.search(D.hues, text).slice(0, 12).map((h) => [h.code, h.name]),
      Shapes: S.search(D.shapes, text).slice(0, 12).map((f) => [f.code, f.name]),
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
    const filter = $('dict-filter').value.trim();
    const source = { stones: D.stones, grades: D.grades,
                     hues: D.hues, shapes: D.shapes }[activeTab];
    const ranked = filter ? S.search(source, filter) : source;
    const rowsOf = { stones: (s) => [s.code, s.name,
        categories[s.category] ? categories[s.category].name : '',
        s.implied_hue, s.default_grade, s.default_hue, s.default_shape] };
    const toRow = rowsOf[activeTab] || ((r) => [r.code, r.name]);
    const rows = ranked.map(toRow);
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
