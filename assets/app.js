// Stone Varieties - page behaviour. Plain scripts, no build step.
(function () {
  'use strict';
  const V = window.GemVariety;
  const VD = window.VARIETY_DATA;
  const D = window.GEM_DATA;  // notation dictionaries: the shapes and the 3D look
  const S = window.GemSearch;
  const combo = window.GemCombo.combo;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => Math.round(n).toLocaleString('en-US');
  const pct = (x) => `${(100 * x).toFixed(1)} %`;
  const esc = (text) => String(text === null || text === undefined ? '' : text)
    .replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const byKey = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]));
  const list = (items) => (items.length < 2 ? items.join('')
    : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);

  const AXES = V.AXES;
  const AXIS_LABEL = { colour: 'Colour', grade: 'Grade', treatment: 'Treatment', effect: 'Effect' };
  const families = byKey(VD.families, 'id');
  const categories = byKey(VD.categories, 'code');
  const dicts = Object.fromEntries(AXES.map((a) => [a, byKey(VD[V.DICT[a]], 'id')]));
  const notation = { stones: byKey(D.stones, 'code'), hues: byKey(D.hues, 'code'),
                     grades: byKey(D.grades, 'code') };
  const valueName = (axis, id) => (dicts[axis][id] ? dicts[axis][id].name : id);
  const legacyTypes = byKey(VD.legacy_types, 'code');
  const legacyShades = byKey(VD.legacy_shades, 'code');
  const typeName = (code) => (legacyTypes[code] ? legacyTypes[code].name : code);
  const shadeName = (code) => (legacyShades[code] ? legacyShades[code].name : code);
  const script = document.currentScript;
  const ASSETS = script && script.src ? new URL('.', script.src).href : 'assets/';

  // ── Configuration: what each family's code writes ──────────────────
  const copy = (c) => Object.fromEntries(Object.entries(c).map(([k, v]) => [k, v.slice()]));
  const PROPOSAL = V.proposal(VD);
  let config = copy(PROPOSAL);
  // how tones are written (A·AA·AAA, 1A·2A·3A or A·2A·3A), remembered
  const TONES_KEY = 'gem-notation.tones';
  let tones = 'letters';
  try { tones = V.TONES[localStorage.getItem(TONES_KEY)] ? localStorage.getItem(TONES_KEY) : tones; } catch (e) { /* no storage */ }
  let built = V.build(VD, config, { tones });
  const onConfig = [];

  function setConfig(next) {
    config = next;
    built = V.build(VD, config, { tones });
    for (const refresh of onConfig) refresh();
  }

  function showTones() {
    for (const button of document.querySelectorAll('[data-tones]')) {
      button.classList.toggle('active', button.dataset.tones === tones);
    }
  }
  for (const button of document.querySelectorAll('[data-tones]')) {
    button.addEventListener('click', () => {
      tones = button.dataset.tones;
      try { localStorage.setItem(TONES_KEY, tones); } catch (e) { /* no storage */ }
      showTones();
      setConfig(config);
    });
  }
  showTones();

  // axes a family can write: at least two values in real use
  const applicable = (fid) => (VD.metrics.families[fid] ? VD.metrics.families[fid].axes : [])
    .map((letter) => AXES.find((a) => V.LETTER[a] === letter));

  // ── 3D preview ─────────────────────────────────────────────────────
  // The stone turns in a small viewer on the shape given, or on a
  // reference shape suited to its material. Its look comes from the
  // notation dictionaries: the article today's stones of this variety use,
  // and the colour, grade and effect picked.
  const preview = { viewer: null, loading: null, token: 0, shown: null, spin: true };
  const SPIN_KEY = 'gem-notation.preview-spin';
  try { preview.spin = localStorage.getItem(SPIN_KEY) !== 'off'; } catch (e) { /* no storage */ }

  function setSpin(on) {
    preview.spin = on;
    if (preview.viewer) preview.viewer.setAutoRotate(on);
    const button = $('preview-spin');
    button.setAttribute('aria-pressed', String(!on));
    button.querySelector('.spin-label').textContent = on ? 'Pause rotation' : 'Resume rotation';
    button.querySelector('.spin-hint').textContent =
      on ? 'lighter on your computer' : 'paused — drag to turn';
    try { localStorage.setItem(SPIN_KEY, on ? 'on' : 'off'); } catch (e) { /* no storage */ }
  }
  $('preview-spin').addEventListener('click', () => setSpin(!preview.spin));

  function load3d() {
    if (!preview.loading) {
      preview.loading = window.GemShape3DReady || ['vendor/three.js', 'shape3d.js', 'shape3d-recipes.js',
                         'stone-look.js', 'gem-optics.js', 'shape3d-render.js']
        .reduce((chain, file) => chain.then(() => new Promise((resolve, reject) => {
          const tag = document.createElement('script');
          tag.src = ASSETS + file;
          tag.onload = resolve;
          tag.onerror = () => reject(new Error(`The 3D preview could not load ${file}.`));
          document.head.appendChild(tag);
        })), Promise.resolve());
    }
    return preview.loading;
  }

  function lookInput() {
    const f = selection.family;
    if (!f) return null;
    const article = (variety && variety.article) || f.look;
    const pick = (axis, table) => {
      const row = selection[axis] && dicts[axis][selection[axis]];
      return row && row.look ? table[row.look] || null : null;
    };
    return { stone: notation.stones[article] || null, grade: pick('grade', notation.grades),
             hue: pick('colour', notation.hues), effect: pick('effect', notation.hues) };
  }

  async function refreshPreview() {
    const input = lookInput();
    const shape = selection.shape;
    $('preview-3d').hidden = !(input || shape);
    const token = ++preview.token;
    if (!input && !shape) return;
    const status = $('preview-status');
    const stage = $('preview-stage');
    $('preview-name').textContent = shape ? `${shape.code} — ${shape.name}` : 'No shape given';
    $('preview-cut').textContent = '';
    $('preview-look').hidden = true;
    try {
      await load3d();
    } catch (e) {
      status.textContent = e.message;
      status.hidden = false;
      return;
    }
    if (token !== preview.token) return;  // the selection changed meanwhile
    const G3 = window.GemShape3D;
    const R = window.GemShapeRecipes;
    const L = window.GemStoneLook;
    const look = input && input.stone
      ? L.lookFor(input.stone, input.grade, input.hue, D, [input.effect]) : null;
    const modelled = shape && R.RECIPES[shape.code] ? shape.code : null;
    const model = modelled || L.referenceShape(input && input.stone && input.stone.code,
                                               look ? look.family : 'transparent');
    const recipe = R.RECIPES[model];
    const outline = G3.OUTLINES[recipe.outline].label.toLowerCase();
    const shown = `${outline} ${R.CUT_LABELS[recipe.cut]}`;
    $('preview-cut').textContent = modelled
      ? `${outline} · ${R.CUT_LABELS[recipe.cut]}`
      : `${shape ? 'no 3D model yet — ' : ''}shown as ${/^[aeiou]/.test(shown) ? 'an' : 'a'} ${shown}`;
    const params = new URLSearchParams({ shape: model });
    if (input && input.stone) params.set('stone', input.stone.code);
    if (input && input.grade) params.set('grade', input.grade.code);
    if (input && input.hue) params.set('hue', input.hue.code);
    $('preview-adjust').href = `shape3d.html?${params}`;
    if (!preview.viewer) {
      preview.viewer = window.GemRender3D.create($('preview-canvas'), { compact: true });
      if (preview.viewer) setSpin(preview.spin);
    }
    stage.classList.toggle('no-model', !preview.viewer);
    status.hidden = Boolean(preview.viewer);
    if (!preview.viewer) {
      status.textContent = 'WebGL is not available in this browser.';
      return;
    }
    if (preview.shown !== model) {
      preview.viewer.setMesh(G3.toBuffers(G3.build(R.specFor(model))));
      preview.shown = model;
    }
    preview.viewer.setLook(look);
    $('preview-look').hidden = !look;
    if (look) {
      $('preview-look').innerHTML =
        `<span class="swatch" style="background:${look.color}"></span>${esc(look.label)}`;
    }
  }

  // ── Describe a stone ───────────────────────────────────────────────
  const selection = { family: null, colour: null, grade: null, treatment: null, effect: null,
                      shape: null };
  let variety = null;

  const familyRows = VD.families.map((f) => ({ code: '', name: f.name, id: f.id,
                                                category: f.category }));
  const pickers = {};
  pickers.family = combo('family', familyRows, {
    detailOf: (r) => (categories[r.category] ? categories[r.category].name : ''),
    groupsOf: () => VD.categories.map((c) => [c.name, familyRows.filter((r) => r.category === c.code)]),
  }, (row) => {
    selection.family = row ? families[row.id] : null;
    offerAxes();
    refreshCompose();
  });
  for (const axis of AXES) {
    pickers[axis] = combo(axis, [], axis === 'grade' ? { detailOf: (r) => r.scale } : null,
                          (row) => { selection[axis] = row ? row.id : null; refreshCompose(); });
  }
  pickers.shape = combo('shape', D.shapes, null,
                        (row) => { selection.shape = row; refreshCompose(); });

  // the values the chosen family accepts, axis by axis
  function offerAxes() {
    for (const axis of AXES) {
      const rows = selection.family
        ? V.allowed(VD, selection.family.id, axis).map((r) => ({
          id: r.id, name: r.name, scale: r.scale, code: '' }))
        : [];
      pickers[axis].setRows(rows);
      pickers[axis].set(null);
      selection[axis] = null;
      $(`field-${axis}`).hidden = rows.length === 0;
    }
    tagAxes();
  }

  // each axis says whether the family's code writes it
  function tagAxes() {
    for (const axis of AXES) {
      const tag = $(`field-${axis}`).querySelector('.axis-tag');
      const writes = Boolean(selection.family && (config[selection.family.id] || []).includes(axis));
      tag.textContent = writes ? 'in the code' : 'description only';
      tag.classList.toggle('on', writes);
    }
  }

  const describe = () => ({
    family: selection.family.id, colour: selection.colour || '', grade: selection.grade || '',
    treatment: selection.treatment || '', effect: selection.effect || '',
  });

  function refreshCompose() {
    const out = $('variety-code');
    out.classList.remove('error');
    $('add-stone').disabled = true;
    variety = null;
    if (!selection.family) {
      out.textContent = '· ·';
      $('variety-name').textContent = '';
      $('variety-notes').textContent = '';
      refreshPreview();
      return;
    }
    const f = selection.family;
    variety = V.varietyOf(built, describe());
    out.textContent = variety.code;
    $('variety-name').textContent = V.nameOf(built, variety);
    const writes = (config[f.id] || []).filter((a) => AXES.includes(a));
    const notes = [writes.length
      ? `${f.name} writes its ${list(writes)} in the code.`
      : `${f.name} writes nothing but the family in the code.`];
    const kept = AXES.filter((a) => !writes.includes(a) && selection[a]);
    if (kept.length) {
      notes.push(`Kept in the description only: ${list(kept.map((a) => valueName(a, selection[a])))}.`);
    }
    notes.push(...originNotes(variety, f));
    if (!variety.isNew) {
      const today = variety.legacy.filter((r) => r.lines || r.stones).map(V.legacyCode);
      notes.push(`Stones of today: ${today.slice(0, 12).join(', ')}${today.length > 12 ? ', …' : ''}`
        + ` · ${fmt(variety.lines)} product lines`);
      const main = mainStone(variety);
      if (main && main.written.forms) {
        notes.push(`Product codes write ${V.legacyCode(main)} today as: ${main.written.forms}`);
      }
    }
    const problems = variety.problems || [];
    if (problems.length) {
      out.classList.add('error');
      notes.push(...problems);
    }
    $('variety-notes').textContent = notes.join('\n');
    $('add-stone').disabled = problems.length > 0;
    refreshPreview();
  }

  const mainStone = (v) => [...v.legacy].sort((a, b) => b.lines - a.lines)[0] || null;

  // where a variety's code comes from, in words
  function originNotes(v, f) {
    const out = [];
    if (f.default_colour && v.values.colour === f.default_colour) {
      out.push(`${valueName('colour', f.default_colour)} is ${f.name}'s default colour: never written,`
        + ' and a stone without colour has it.');
    }
    if (v.isNew) out.push('A new variety: no stone of today has it.');
    if (v.origin === 'pieces') out.push("A new code, made of today's type and shade codes.");
    if (v.origin === 'to-name') {
      out.push(v.incomplete ? 'Incomplete: the grade is missing - to complete.'
        : "A new code: today's codes have no piece for part of it - to be named.");
    }
    return out;
  }

  // ── Product builder ────────────────────────────────────────────────
  const product = [];
  const clean = (id) => $(id).value.trim().toUpperCase();

  function refreshProduct() {
    const box = $('product-lines');
    box.innerHTML = '';
    product.forEach((line, index) => {
      const v = V.varietyOf(built, line.desc);
      line.code = v.code;
      const row = document.createElement('div');
      row.className = 'product-line';
      row.innerHTML = `
        <span class="mono">${esc(v.code)}</span>
        <span class="line-name">${esc(V.nameOf(built, v))}</span>
        <label>weight <input type="number" step="0.01" min="0" value="${line.weight}"></label>
        <label><input type="checkbox" class="center-box" ${line.isCenter ? 'checked' : ''}> center</label>
        <button type="button" title="Remove">×</button>`;
      row.querySelector('input[type=number]').addEventListener('change', (ev) => {
        line.weight = parseFloat(ev.target.value) || 0;
        refreshProduct();
      });
      row.querySelector('.center-box').addEventListener('change', (ev) => {
        product.forEach((l, i) => { l.isCenter = ev.target.checked && i === index; });
        refreshProduct();
      });
      row.querySelector('button').addEventListener('click', () => {
        product.splice(index, 1);
        refreshProduct();
      });
      box.appendChild(row);
    });
    $('product-code').textContent = product.length
      ? V.productCode(product, clean('model'), clean('metal'), Number($('variant').value) || 1) : '· ·';
  }
  $('add-stone').addEventListener('click', () => {
    if (!variety) return;
    product.push({ desc: describe(), weight: 1.0, isCenter: false });
    refreshProduct();
  });
  $('model').addEventListener('input', refreshProduct);
  $('variant').addEventListener('input', refreshProduct);
  $('metal').addEventListener('input', refreshProduct);

  // ── Read a code, find a variety ────────────────────────────────────
  function runRead() {
    const text = $('query').value.trim();
    const out = $('read-results');
    out.innerHTML = '';
    if (!text) return;
    const parsed = V.read(built, text);
    const html = [];
    if (/[+/-]/.test(text) || parsed.tokens.some((t) => t.variety)) {
      if (parsed.model || parsed.metal) {
        html.push(`<div class="read-head">Model <span class="mono strong">${esc(parsed.model || '—')}</span>`
          + ` · metal <span class="mono strong">${esc(parsed.metal || '—')}</span>`
          + (parsed.index > 1 ? ` · variant <span class="mono strong">${parsed.index}</span>` : '')
          + '</div>');
      }
      for (const t of parsed.tokens) {
        const v = t.variety;
        html.push(`<div class="token-card${v ? '' : ' bad'}"><span class="mono strong">${esc(t.code)}</span> `
          + (v ? `${esc(V.nameOf(built, v))}`
              + (v.code !== t.code ? ` <span class="muted small">— written ${esc(v.code)} here</span>` : '')
              + '<div class="muted small">stones of today: '
              + `${esc(v.legacy.filter((r) => r.lines || r.stones).map(V.legacyCode).join(', '))}</div>`
            : '<div class="problem">no variety has this code</div>')
          + '</div>');
      }
    }
    const shown = new Set(parsed.tokens.map((t) => t.code));
    const rows = [...built.varieties.values()]
      .map((v) => ({ code: v.code, name: V.nameOf(built, v), v }));
    // an exact code first, then the most used varieties
    const exact = S.normalize(text);
    const matches = S.search(rows, text).filter((r) => !shown.has(r.code))
      .sort((a, b) => (S.normalize(b.code) === exact) - (S.normalize(a.code) === exact)
        || b.v.lines - a.v.lines)
      .slice(0, 16);
    if (matches.length) {
      html.push('<div class="match-block"><div class="match-title">Varieties</div>'
        + matches.map((r) => `<div><span class="mono strong">${esc(r.code)}</span> ${esc(r.name)}`
          + ` <span class="muted small">${fmt(r.v.lines)} lines</span></div>`).join('')
        + '</div>');
    }
    out.innerHTML = html.join('') || '<div class="muted">No match.</div>';
  }
  $('read-btn').addEventListener('click', runRead);
  $('query').addEventListener('keydown', (ev) => { if (ev.key === 'Enter') runRead(); });

  // ── Detail per family ──────────────────────────────────────────────
  const tile = (label, value, note) => `<div class="tile"><div class="tile-label">${label}</div>`
    + `<div class="tile-value">${value}</div><div class="tile-note">${note}</div></div>`;

  function renderBoard() {
    const m = VD.metrics;
    const ix = V.indexing(VD, config);
    const st = V.stats(built);
    $('board-summary').innerHTML = [
      tile('Varieties in use', fmt(st.varieties), `from ${fmt(VD.families.length)} families`),
      tile("Kept from today's codes", pct(st.today),
           'of stone lines keep a code employees already read'),
      tile('Mean code length', st.meanLength.toFixed(2),
           `characters per stone, weighted by use · longest ${st.maxLength}`),
      tile('Products with an index', `${ix.exact ? '' : '≈ '}${fmt(ix.indexed)}`,
           `${pct(ix.indexed / m.products)} of ${fmt(m.products)} · largest index `
           + `${ix.exact ? '' : '≥ '}${ix.max}`
           + (ix.exact && ix.over9 ? ` (${fmt(ix.over9)} above 9, in ${ix.models_over9} models)` : '')),
    ].join('');

    const q = S.normalize($('board-filter').value.trim());
    const onlyChoice = $('board-choice').checked;
    const byFamily = new Map();
    for (const v of built.varieties.values()) {
      if (!byFamily.has(v.family)) byFamily.set(v.family, []);
      byFamily.get(v.family).push(v);
    }
    const rows = VD.families
      .filter((f) => !onlyChoice || applicable(f.id).length)
      .filter((f) => !q || S.normalize(`${f.name} ${f.legacy_types.join(' ')}`).includes(q))
      .sort((a, b) => (m.families[b.id].lines - m.families[a.id].lines) || (a.name < b.name ? -1 : 1));
    const head = '<tr><th>Family</th><th>Share of stone lines</th>'
      + AXES.map((a) => `<th class="axis-col">${AXIS_LABEL[a]}</th>`).join('')
      + '<th>Varieties</th></tr>';
    const body = rows.map((f) => {
      const share = m.families[f.id].lines / m.lines;
      const can = applicable(f.id);
      const cells = AXES.map((axis) => {
        if (!can.includes(axis)) return '<td class="axis-col muted">—</td>';
        const on = (config[f.id] || []).includes(axis);
        const n = V.separates(VD, config, f.id, axis);
        return `<td class="axis-col"><label class="axis-box${on ? ' on' : ''}">`
          + `<input type="checkbox" data-family="${f.id}" data-axis="${axis}"${on ? ' checked' : ''}>`
          + `<span class="sep" title="products spared an index by writing the ${axis}">${fmt(n)}</span></label></td>`;
      }).join('');
      const vs = (byFamily.get(f.id) || []).filter((v) => v.lines > 0)
        .sort((a, b) => b.lines - a.lines);
      const chips = vs.slice(0, 12).map((v) => `<span class="chip mono${v.origin === 'today' ? '' : ' new'}"`
        + ` title="${esc(V.nameOf(built, v))} · ${fmt(v.lines)} lines">${esc(v.code)}</span>`).join('')
        + (vs.length > 12 ? `<span class="muted small"> +${vs.length - 12}</span>` : '');
      return `<tr><td><span class="strong">${esc(f.name)}</span>`
        + `<div class="muted small mono">${esc(f.legacy_types.join(' '))}</div></td>`
        + `<td><div class="share"><div class="share-bar" style="width:${Math.max(2, Math.min(90, share * 360))}px"></div>`
        + `<span>${pct(share)}</span></div></td>${cells}<td class="chips">${chips}</td></tr>`;
    }).join('');
    $('board-table').innerHTML = head + body;
    for (const button of document.querySelectorAll('[data-preset]')) {
      button.classList.toggle('active', button.dataset.preset === presetOf(config));
    }
  }

  function presetOf(c) {
    const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
    if (VD.families.every((f) => same(c[f.id] || [], PROPOSAL[f.id]))) return 'proposal';
    if (VD.families.every((f) => !(c[f.id] || []).length)) return 'none';
    if (VD.families.every((f) => same(c[f.id] || [], applicable(f.id)))) return 'all';
    return '';
  }

  $('board-table').addEventListener('change', (ev) => {
    const box = ev.target;
    if (!box.dataset.family) return;
    const next = copy(config);
    const axes = next[box.dataset.family] || [];
    next[box.dataset.family] = box.checked ? [...axes, box.dataset.axis]
      : axes.filter((a) => a !== box.dataset.axis);
    setConfig(next);
  });
  for (const button of document.querySelectorAll('[data-preset]')) {
    button.addEventListener('click', () => {
      const preset = button.dataset.preset;
      setConfig(Object.fromEntries(VD.families.map((f) => [f.id,
        preset === 'proposal' ? PROPOSAL[f.id].slice() : preset === 'all' ? applicable(f.id) : []])));
    });
  }
  $('board-filter').addEventListener('input', renderBoard);
  $('board-choice').addEventListener('change', renderBoard);

  // ── From today's codes ─────────────────────────────────────────────
  let legacyStatus = '';
  const STATUS_LABEL = { merged: 'merged', 'to-confirm': 'to confirm', conflict: 'conflict' };

  // how today's product codes write a stone: its type alone when most do
  const writtenToday = (r) => (r.shade && r.written.bare >= 0.5
    ? `${r.type} alone: ${pct(r.written.bare)} of products` : r.written.forms);

  function renderLegacy() {
    const q = S.normalize($('legacy-filter').value.trim());
    const rows = VD.legacy
      .filter((r) => !legacyStatus || r.status === legacyStatus)
      .map((r) => ({ r, v: V.varietyOf(built, r) }))
      .filter(({ r, v }) => !q || S.normalize([V.legacyCode(r), r.type, r.shade, typeName(r.type),
        shadeName(r.shade), families[r.family].name, ...AXES.map((a) => (r[a] ? valueName(a, r[a]) : '')),
        v.code, r.note, r.written.forms].join(' ')).includes(q))
      .sort((a, b) => (b.r.lines - a.r.lines) || (V.legacyCode(a.r) < V.legacyCode(b.r) ? -1 : 1));
    const head = '<tr><th>Today</th><th>Type · shade</th><th>Written in products today</th><th>Family</th>'
      + AXES.map((a) => `<th>${AXIS_LABEL[a]}</th>`).join('')
      + '<th>Variety</th><th>Lines</th><th>Status</th><th>Note</th></tr>';
    const body = rows.map(({ r, v }) => `<tr><td class="mono strong">${esc(V.legacyCode(r))}</td>`
      + `<td>${esc(typeName(r.type))}${r.shade ? ` · ${esc(shadeName(r.shade))}` : ''}</td>`
      + `<td class="note">${esc(writtenToday(r))}</td>`
      + `<td>${esc(families[r.family].name)}</td>`
      + AXES.map((a) => `<td>${r[a] ? esc(valueName(a, r[a])) : ''}</td>`).join('')
      + `<td class="mono strong">${esc(v.code)}</td><td class="num">${fmt(r.lines)}</td>`
      + `<td>${r.status !== 'ok' ? `<span class="badge ${r.status}">${STATUS_LABEL[r.status]}</span>` : ''}</td>`
      + `<td class="note">${esc(r.note)}</td></tr>`).join('');
    $('legacy-table').innerHTML = head + body;
    const lines = rows.reduce((s, { r }) => s + r.lines, 0);
    $('legacy-count').textContent = `${rows.length} of ${VD.legacy.length} codes · ${fmt(lines)} product lines`;
  }
  for (const button of document.querySelectorAll('#legacy-tabs [data-status]')) {
    button.addEventListener('click', () => {
      legacyStatus = button.dataset.status;
      for (const b of document.querySelectorAll('#legacy-tabs [data-status]')) {
        b.classList.toggle('active', b === button);
      }
      renderLegacy();
    });
  }
  $('legacy-filter').addEventListener('input', renderLegacy);

  // ── Dictionaries ───────────────────────────────────────────────────
  // families that accept a value, from the stones in use
  function familiesUsing(axis, id) {
    const found = new Set(VD.legacy.filter((r) => r[axis] === id && r.status !== 'conflict')
      .map((r) => families[r.family].name));
    return [...found].sort().join(', ');
  }
  const TABS = {
    families: {
      head: ['Family', 'Category', 'Today', 'Code writes', 'Default colour', 'Note'],
      rows: () => VD.families.map((f) => [f.name, categories[f.category].name,
        f.legacy_types.join(' '), list(config[f.id] || []) || '—',
        f.default_colour ? valueName('colour', f.default_colour) : '', f.note]),
    },
    colours: {
      head: ['Colour', 'Kind', 'Families'],
      rows: () => VD.colours.map((c) => [c.name, c.kind, familiesUsing('colour', c.id)]),
    },
    grades: {
      head: ['Grade', 'Scale', 'Families'],
      rows: () => VD.grades.map((g) => [g.name, g.scale, familiesUsing('grade', g.id)]),
    },
    treatments: {
      head: ['Treatment', 'Note', 'Families'],
      rows: () => VD.treatments.map((t) => [t.name, t.note, familiesUsing('treatment', t.id)]),
    },
    effects: {
      head: ['Effect', 'Kind', 'Families'],
      rows: () => VD.effects.map((e) => [e.name, e.kind, familiesUsing('effect', e.id)]),
    },
  };
  let activeTab = 'families';

  function renderDict() {
    const q = S.normalize($('dict-filter').value.trim());
    const tab = TABS[activeTab];
    const rows = tab.rows().filter((row) => !q || S.normalize(row.join(' ')).includes(q));
    $('dict-table').innerHTML = `<tr>${tab.head.map((h) => `<th>${h}</th>`).join('')}</tr>`
      + rows.map((row) => `<tr>${row.map((cell, i) =>
        `<td class="${i === 0 ? 'strong' : 'wrap'}">${esc(cell)}</td>`).join('')}</tr>`).join('');
    $('dict-count').textContent = `${rows.length} entries`;
  }
  for (const button of document.querySelectorAll('#dict-tabs [data-tab]')) {
    button.addEventListener('click', () => {
      activeTab = button.dataset.tab;
      for (const b of document.querySelectorAll('#dict-tabs [data-tab]')) {
        b.classList.toggle('active', b === button);
      }
      renderDict();
    });
  }
  $('dict-filter').addEventListener('input', renderDict);

  // ── Wiring ─────────────────────────────────────────────────────────
  onConfig.push(tagAxes, refreshCompose, refreshProduct, renderBoard, renderLegacy, renderDict,
                () => { if ($('query').value.trim()) runRead(); });
  offerAxes();
  refreshCompose();
  refreshProduct();
  renderBoard();
  renderLegacy();
  renderDict();
})();
