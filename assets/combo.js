// Gemstone Notation - searchable combo, shared by the pages.
// A text input with a ranked dropdown (GemSearch): type a name or a
// code, pick with the mouse or Up/Down + Enter; empty input clears.
// A row without a code shows its name alone.
(function (root) {
  'use strict';
  const S = root.GemSearch;

  function combo(inputId, rows, options, onChange) {
    const { detailOf, groupsOf } = options || {};
    const input = document.getElementById(inputId);
    const list = input.parentElement.querySelector('.combo-list');
    let current = null;
    let visible = [];
    let highlighted = 0;

    const display = () => {
      input.value = !current ? '' : current.code ? `${current.code} — ${current.name}` : current.name;
    };
    const close = () => { list.hidden = true; };

    const itemHtml = (row, index) =>
      `<div class="combo-item${row === current ? ' current' : ''}" data-i="${index}">`
      + (row.code ? `<span class="mono strong">${row.code}</span> ` : '') + row.name
      + (detailOf && detailOf(row)
          ? ` <span class="muted">${detailOf(row)}</span>` : '')
      + '</div>';

    function render(query) {
      const q = (query || '').trim();
      const noneRow = '<div class="combo-item combo-none" data-i="-1">— none —</div>';
      if (!q && groupsOf) {
        // the full menu, grouped, exactly like a select would scroll
        visible = [];
        let html = '';
        for (const [label, groupRows] of groupsOf()) {
          if (!groupRows.length) continue;
          html += `<div class="combo-group">${label}</div>`;
          for (const row of groupRows) {
            html += itemHtml(row, visible.length);
            visible.push(row);
          }
        }
        list.innerHTML = noneRow + html;
      } else {
        visible = q ? S.search(rows, q) : rows.slice();
        list.innerHTML = (q ? '' : noneRow)
          + visible.map(itemHtml).join('');
      }
      list.hidden = visible.length === 0 && q !== '';
      const currentIndex = current ? visible.indexOf(current) : -1;
      highlight(currentIndex >= 0 ? currentIndex : 0, currentIndex >= 0);
    }
    function highlight(index, scroll) {
      highlighted = Math.max(0, Math.min(index, visible.length - 1));
      list.querySelectorAll('.combo-item').forEach((el, i) => {
        el.classList.toggle('hl', i === highlighted);
        if (scroll && i === highlighted) {
          el.scrollIntoView({ block: 'nearest' });
        }
      });
    }
    function pick(row) {
      current = row || null;
      display();
      close();
      onChange(current);
    }

    input.addEventListener('focus', () => { input.select(); render(''); });
    input.addEventListener('click', () => {
      if (list.hidden) render('');
    });
    input.addEventListener('input', () => render(input.value));
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown') {
        if (list.hidden) render('');
        else highlight(highlighted + 1, true);
        ev.preventDefault();
      } else if (ev.key === 'ArrowUp') {
        highlight(highlighted - 1, true);
        ev.preventDefault();
      } else if (ev.key === 'Enter') {
        if (!input.value.trim()) pick(null);
        else if (visible.length) pick(visible[highlighted]);
        ev.preventDefault();
      } else if (ev.key === 'Escape') { display(); close(); }
    });
    input.addEventListener('blur', () => {
      setTimeout(() => {
        if (!input.value.trim() && current) pick(null);
        else display();
        close();
      }, 150);
    });
    list.addEventListener('mousedown', (ev) => {
      ev.preventDefault();
      const item = ev.target.closest('.combo-item');
      if (!item) return;
      const index = parseInt(item.dataset.i, 10);
      pick(index < 0 ? null : visible[index]);
    });

    return {
      get: () => current,
      // show a row without firing onChange
      set: (row) => { current = row || null; display(); },
      // offer other rows (the current one is kept only if still offered)
      setRows: (next) => {
        rows = next;
        if (current && !rows.includes(current)) { current = null; display(); }
      },
    };
  }

  root.GemCombo = { combo };
})(this);
