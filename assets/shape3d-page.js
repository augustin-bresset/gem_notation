// Gemstone Notation - 3D shapes page: pick a shape code, see its
// generated stone, adjust every parameter.
(function () {
  'use strict';
  const D = window.GEM_DATA;
  const G3 = window.GemShape3D;
  const R = window.GemShapeRecipes;
  const $ = (id) => document.getElementById(id);

  const viewer = window.GemRender3D.create($('view'));
  if (!viewer) $('no-gl').hidden = false;

  let shape = null;   // dictionary row, or null for a free design
  let recipe = null;  // the shape's resolved spec, or null without a model
  let spec = G3.resolve(R.specFor('RD'));
  // stone, hue and grade codes for the colour; '' = not set
  const material = { stone: '', hue: '', grade: '' };
  const byCode = (rows, code) => rows.find((r) => r.code === code) || null;

  const format = (param, v) => {
    if (param.format === '%') return `${Math.round(v * 1000) / 10} %`;
    if (param.format === 'int') return String(Math.round(v));
    return `${v.toFixed(2)}`;
  };

  // ── Controls ───────────────────────────────────────────────────────
  function group(title) {
    const box = document.createElement('div');
    box.className = 'ctl-group';
    box.innerHTML = `<h3>${title}</h3>`;
    $('controls').appendChild(box);
    return box;
  }

  function addSelect(parent, label, options, value, onChange) {
    const wrap = document.createElement('label');
    wrap.className = 'ctl';
    wrap.innerHTML = `<span>${label}</span>`;
    const select = document.createElement('select');
    for (const [v, text] of options) select.add(new Option(text, v));
    select.value = String(value);
    select.addEventListener('change', () => onChange(select.value));
    wrap.appendChild(select);
    parent.appendChild(wrap);
  }

  function addSlider(parent, label, param, value, onInput) {
    const wrap = document.createElement('label');
    wrap.className = 'ctl';
    wrap.innerHTML = `<span>${label}</span><span class="val">${format(param, value)}</span>`;
    const input = document.createElement('input');
    Object.assign(input, { type: 'range', min: param.min, max: param.max,
                           step: param.step, value });
    input.addEventListener('input', () => {
      const v = parseFloat(input.value);
      wrap.querySelector('.val').textContent = format(param, v);
      onInput(v);
    });
    wrap.appendChild(input);
    parent.appendChild(wrap);
  }

  function halfControls(side) {
    const half = spec[side];
    const style = G3.STYLES[half.style];
    const box = group(side === 'top' ? 'Top' : 'Bottom');
    addSelect(box, 'Style', Object.entries(G3.STYLES).map(([k, s]) => [k, s.label]),
      half.style, (value) => {
        spec[side] = G3.resolve({ [side]: { style: value } })[side];
        changed(true);
      });
    for (const key of style.params) {
      const param = G3.HALF_PARAMS[key];
      const label = (style.labels && style.labels[key]) || param[side];
      addSlider(box, label, param, half[key], (v) => { half[key] = v; changed(); });
    }
  }

  function materialControls() {
    const box = group('Colour');
    const byName = (rows) => rows.slice().sort((a, b) => (a.name < b.name ? -1 : 1))
      .map((r) => [r.code, `${r.name} (${r.code})`]);
    const pick = (key) => (value) => { material[key] = value; applyMaterial(); syncUrl(); };
    addSelect(box, 'Stone', [['', '— none: study the shape —']].concat(byName(D.stones)),
      material.stone, pick('stone'));
    addSelect(box, 'Hue', [['', "— the stone's usual —"]].concat(byName(D.hues)),
      material.hue, pick('hue'));
    addSelect(box, 'Grade', [['', '— the stone’s default —']]
      .concat(D.grades.map((g) => [g.code, `${g.code} — ${g.name}`])), material.grade, pick('grade'));
    const note = document.createElement('div');
    note.id = 'look-note';
    note.className = 'preview-look';
    box.appendChild(note);
  }

  function applyMaterial() {
    const stone = byCode(D.stones, material.stone);
    const look = window.GemStoneLook.lookFor(stone, byCode(D.grades, material.grade),
                                             byCode(D.hues, material.hue), D);
    if (viewer) viewer.setLook(look);
    const note = $('look-note');
    if (!note) return;
    note.innerHTML = look
      ? `<span class="swatch" style="background:${look.color}"></span>${look.label}`
      : stone ? 'No colour for this stone yet — neutral material.' : '';
  }

  function syncUrl() {
    const params = new URLSearchParams();
    if (shape) params.set('shape', shape.code);
    for (const key of ['stone', 'grade', 'hue']) {
      if (material[key]) params.set(key, material[key]);
    }
    const query = params.toString();
    try {
      window.history.replaceState(null, '', query ? `?${query}` : window.location.pathname);
    } catch (e) { /* file:// */ }
  }

  function renderControls() {
    $('controls').innerHTML = '';
    materialControls();
    const def = G3.OUTLINES[spec.outline];
    const P = G3.PARAMS;
    const outline = group('Outline');
    addSelect(outline, 'Form', [['cut', 'Stone — top, girdle, bottom'], ['donut', 'Donut']],
      spec.form, (value) => { spec.form = value; changed(true); });
    addSelect(outline, 'Outline',
      Object.entries(G3.OUTLINES).map(([k, o]) => [k, o.label]), spec.outline,
      (value) => {
        spec = G3.resolve(Object.assign({}, spec,
          { outline: value, ratio: undefined, symmetry: undefined }));
        changed(true);
      });
    if (!def.fixedRatio) {
      addSlider(outline, P.ratio.label, P.ratio, spec.ratio, (v) => { spec.ratio = v; changed(); });
    }
    for (const key of def.params || []) {
      addSlider(outline, P[key].label, P[key], spec[key], (v) => { spec[key] = v; changed(); });
    }
    if (def.symmetries.length > 1) {
      addSelect(outline, 'Symmetry (mains)', def.symmetries.map((n) => [n, String(n)]),
        spec.symmetry, (value) => { spec.symmetry = Number(value); changed(); });
    }
    if (spec.form === 'donut') {
      const donut = group('Donut');
      for (const key of ['hole', 'thickness']) {
        addSlider(donut, P[key].label, P[key], spec[key], (v) => { spec[key] = v; changed(); });
      }
    } else {
      addSlider(outline, P.girdle.label, P.girdle, spec.girdle, (v) => { spec.girdle = v; changed(); });
      halfControls('top');
      halfControls('bottom');
    }
    const surface = group('Surface');
    for (const key of ['irregularity', 'seed']) {
      addSlider(surface, P[key].label, P[key], spec[key], (v) => { spec[key] = v; changed(); });
    }
  }

  // ── Model ──────────────────────────────────────────────────────────
  function rebuild() {
    const buffers = G3.toBuffers(G3.build(spec));
    if (viewer) viewer.setMesh(buffers);
    const { min, max } = buffers.bounds;
    const [l, w, h] = max.map((x, k) => x - min[k]);
    $('stats').innerHTML = `<strong>${buffers.stats.facets}</strong> flat facets · `
      + `L × W × H = ${l.toFixed(2)} × ${w.toFixed(2)} × ${h.toFixed(2)} `
      + `<span class="small">(width = 1 · total depth ${Math.round((h / w) * 100)} %)</span>`;
  }

  function refreshNote() {
    const note = $('recipe-note');
    if (!shape) {
      note.innerHTML = '<span class="muted">Free design — no shape code.</span>';
      return;
    }
    const entry = R.RECIPES[shape.code];
    if (!entry) {
      note.innerHTML = `<strong>No 3D model yet</strong> for ${shape.code} — `
        + `${shape.name}. <span class="approx">The controls keep the previous stone.</span>`;
      return;
    }
    const custom = JSON.stringify(G3.resolve(spec)) !== JSON.stringify(recipe);
    note.innerHTML = `${G3.OUTLINES[entry.outline].label} · ${R.CUT_LABELS[entry.cut]}`
      + (entry.approx ? `<div class="approx">≈ ${entry.approx}</div>` : '')
      + (custom ? '<div class="custom">adjusted — “Reset” returns to the shape</div>' : '');
  }

  function changed(structural) {
    if (structural) {
      renderControls();
      applyMaterial();
    }
    rebuild();
    refreshNote();
  }

  function pickShape(row) {
    shape = row;
    const partial = row && R.specFor(row.code);
    recipe = partial ? G3.resolve(partial) : null;
    if (partial) spec = G3.resolve(partial);
    syncUrl();
    changed(true);
  }

  const picker = window.GemCombo.combo('shape', D.shapes, {
    detailOf: (row) => (R.RECIPES[row.code] ? '' : 'no model yet'),
    groupsOf: () => [
      ['Modelled', D.shapes.filter((s) => R.RECIPES[s.code])],
      ['No model yet', D.shapes.filter((s) => !R.RECIPES[s.code])],
    ],
  }, pickShape);

  // ── Buttons ────────────────────────────────────────────────────────
  $('reset').addEventListener('click', () => {
    if (shape && recipe) spec = G3.resolve(R.specFor(shape.code));
    changed(true);
  });
  $('copy').addEventListener('click', async () => {
    const text = JSON.stringify(G3.resolve(spec));
    try {
      await navigator.clipboard.writeText(text);
      $('copy').textContent = 'Copied ✓';
      setTimeout(() => { $('copy').textContent = 'Copy parameters'; }, 1500);
    } catch (e) {
      window.prompt('Copy the parameters:', text);
    }
  });
  async function download(format) {
    if (!viewer) return;
    const mm = parseFloat($('export-width').value) || 8;
    try {
      const blob = await viewer.exportModel(format, mm);
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${shape ? shape.code : 'stone'}-${mm}mm.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    } catch (e) {
      $('stats').textContent = `Export failed: ${e.message || e}`;
    }
  }
  $('export-stl').addEventListener('click', () => download('stl'));
  $('export-glb').addEventListener('click', () => download('glb'));
  for (const button of document.querySelectorAll('[data-view]')) {
    button.addEventListener('click', () => viewer && viewer.view(button.dataset.view));
  }
  $('edges').addEventListener('change', (ev) => viewer && viewer.setEdges(ev.target.checked));
  $('rotate').addEventListener('change', (ev) => viewer && viewer.setAutoRotate(ev.target.checked));

  const modelled = D.shapes.filter((s) => R.RECIPES[s.code]).length;
  $('coverage').textContent = `${modelled} of the ${D.shapes.length} shape codes have a `
    + 'model; the rest are house references, carvings, mixes and strands.';

  // ── Start ──────────────────────────────────────────────────────────
  const query = new URLSearchParams(window.location.search);
  for (const [key, rows] of [['stone', D.stones], ['hue', D.hues], ['grade', D.grades]]) {
    const code = (query.get(key) || '').toUpperCase();
    if (byCode(rows, code)) material[key] = code;
  }
  const wanted = query.get('shape');
  const start = D.shapes.find((s) => s.code === (wanted || 'RD').toUpperCase())
    || D.shapes.find((s) => s.code === 'RD');
  picker.set(start);
  pickShape(start);
})();
