/* Podium - UI primitives: popups, menus, colour picker, dialogs, toasts */
(function (P) {
  'use strict';
  let curPop = null;
  P.closePopup = () => { if (curPop) { curPop.remove(); curPop = null; document.removeEventListener('pointerdown', outside, true); } };
  const outside = e => { if (curPop && !curPop.contains(e.target)) { const a = curPop.__anchor; if (a && a.contains(e.target)) { e.stopPropagation(); e.preventDefault(); P.closePopup(); return; } P.closePopup(); } };
  P.popup = (anchor, content, opts = {}) => {
    P.closePopup();
    const p = h('div', { class: 'popup ' + (opts.class || '') }); p.append(content); document.body.append(p);
    p.__anchor = anchor;
    const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, top: anchor.y, bottom: anchor.y, right: anchor.x, width: 0 };
    p.style.left = '0px'; p.style.top = '0px';
    const pr = p.getBoundingClientRect();
    let x = opts.alignRight ? r.right - pr.width : r.left, y = opts.above ? r.top - pr.height : r.bottom + 2;
    if (x + pr.width > innerWidth - 6) x = innerWidth - pr.width - 6;
    if (y + pr.height > innerHeight - 6) { if (pr.height > innerHeight - r.bottom - 6) { y = Math.max(6, innerHeight - pr.height - 6); } }
    p.style.left = Math.max(4, x) + 'px'; p.style.top = Math.max(4, y) + 'px';
    p.style.maxHeight = (innerHeight - 12) + 'px';
    curPop = p;
    setTimeout(() => document.addEventListener('pointerdown', outside, true), 0);
    p.addEventListener('mousedown', e => { if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) e.preventDefault(); });
    return p;
  };
  /* Menu list: [{label, icon, fn, check, disabled, sub:[...]}, '-'] */
  P.menuList = (items, opts = {}) => {
    const m = h('div', { class: 'menu' });
    items.forEach(it => {
      if (!it) return;
      if (it === '-') { m.append(h('div', { class: 'menu-sep' })); return; }
      if (it.head) { m.append(h('div', { class: 'menu-head', text: it.head })); return; }
      const b = h('button', { class: 'menu-item' + (it.disabled ? ' disabled' : '') + (it.check ? ' checked' : ''), title: it.tip || '' });
      b.append(h('span', { class: 'mi-ic', html: it.icon ? (it.icon.startsWith('<') ? it.icon : P.icon(it.icon, 16)) : (it.check ? P.icon('check', 14) : '') }), h('span', { class: 'mi-t', text: it.label }));
      if (it.key) b.append(h('span', { class: 'mi-k', text: it.key }));
      if (it.sub) {
        b.append(h('span', { class: 'mi-arrow', text: '›' }));
        b.addEventListener('mouseenter', () => openSub(b, it.sub, m));
        b.addEventListener('click', e => { e.stopPropagation(); openSub(b, typeof it.sub === 'function' ? it.sub : it.sub, m); });
      } else {
        b.addEventListener('mouseenter', () => closeSub(m));
        if (!it.disabled) b.addEventListener('click', e => { e.stopPropagation(); P.closePopup(); it.fn && it.fn(e); });
      }
      m.append(b);
    });
    return m;
  };
  const closeSub = m => { const s = m.__sub; if (s) { s.remove(); m.__sub = null; } };
  const openSub = (btn, sub, parentMenu) => {
    closeSub(parentMenu);
    const list = typeof sub === 'function' ? sub() : sub;
    const content = list.nodeType ? list : P.menuList(list);
    const s = h('div', { class: 'popup subpop' }); s.append(content);
    (curPop || document.body).append(s);
    const r = btn.getBoundingClientRect(); s.style.position = 'fixed'; s.style.left = '0'; s.style.top = '0';
    const pr = s.getBoundingClientRect();
    let x = r.right - 2, y = r.top; if (x + pr.width > innerWidth - 4) x = r.left - pr.width + 2; if (y + pr.height > innerHeight - 4) y = Math.max(4, innerHeight - pr.height - 4);
    s.style.left = x + 'px'; s.style.top = y + 'px'; parentMenu.__sub = s;
  };
  P.popupMenu = (x, y, items) => { const a = { x, y, getBoundingClientRect: () => ({ left: x, top: y, bottom: y, right: x, width: 0 }), contains: () => false }; P.popup(a, P.menuList(items)); };

  /* ---------- colour picker ---------- */
  const STD = ['#C00000', '#FF0000', '#FFC000', '#FFFF00', '#92D050', '#00B050', '#00B0F0', '#0070C0', '#002060', '#7030A0'];
  const NAMES = { bg1: 'White, Background 1', tx1: 'Black, Text 1', bg2: 'Background 2', tx2: 'Text 2', accent1: 'Accent 1', accent2: 'Accent 2', accent3: 'Accent 3', accent4: 'Accent 4', accent5: 'Accent 5', accent6: 'Accent 6' };
  let recent = [];
  P.colorPalette = (onPick, opts = {}) => {
    const box = h('div', { class: 'cp' });
    const pick = c => { P.closePopup(); onPick(c); };
    if (opts.auto) { const b = h('button', { class: 'cp-row', html: `<span class="cp-swatch" style="background:#000"></span>${opts.auto}` }); b.onclick = () => pick(null); box.append(b); }
    box.append(h('div', { class: 'cp-h', text: 'Theme Colors' }));
    const grid = h('div', { class: 'cp-grid' }); const th = P.deck.theme;
    P.schemeNames.forEach(n => { const b = h('button', { class: 'cp-c', title: NAMES[n] }); b.style.background = P.color(n, th); b.onclick = () => pick(n); grid.append(b); });
    box.append(grid);
    const t = h('div', { class: 'cp-grid tints' });
    for (let i = 0; i < 5; i++) P.schemeNames.forEach(n => { const [lm, lo, lbl] = P.tints(n, th)[i]; const v = `${n}:${lm},${lo}`; const b = h('button', { class: 'cp-c', title: `${NAMES[n]}, ${lbl}` }); b.style.background = P.color(v, th); b.onclick = () => pick(v); t.append(b); });
    box.append(t);
    box.append(h('div', { class: 'cp-h', text: 'Standard Colors' }));
    const s = h('div', { class: 'cp-grid' }); STD.forEach(c => { const b = h('button', { class: 'cp-c', title: c }); b.style.background = c; b.onclick = () => pick(c); s.append(b); }); box.append(s);
    if (recent.length) { box.append(h('div', { class: 'cp-h', text: 'Recent Colors' })); const rr = h('div', { class: 'cp-grid' }); recent.forEach(c => { const b = h('button', { class: 'cp-c', title: c }); b.style.background = c; b.onclick = () => pick(c); rr.append(b); }); box.append(rr); }
    box.append(h('div', { class: 'cp-sep' }));
    if (opts.none) { const b = h('button', { class: 'cp-row', html: `<span class="cp-noswatch"></span>${opts.none}` }); b.onclick = () => { P.closePopup(); onPick('none'); }; box.append(b); }
    const more = h('button', { class: 'cp-row', html: P.icon('color', 16) + 'More Colors…' }); more.onclick = () => { P.closePopup(); P.moreColors(opts.cur, c => { recent = [c].concat(recent.filter(x => x !== c)).slice(0, 10); onPick(c); }); }; box.append(more);
    if (window.EyeDropper) { const e = h('button', { class: 'cp-row', html: P.icon('eyedrop', 16) + 'Eyedropper' }); e.onclick = async () => { P.closePopup(); try { const r = await new window.EyeDropper().open(); const c = r.sRGBHex.toUpperCase(); recent = [c].concat(recent).slice(0, 10); onPick(c); } catch (_) {} }; box.append(e); }
    (opts.extra || []).forEach(x => { const b = h('button', { class: 'cp-row', html: (x.icon ? P.icon(x.icon, 16) : '') + x.label }); b.onclick = ev => { if (x.keep) { x.fn(ev, b); return; } P.closePopup(); x.fn(); }; box.append(b); });
    return box;
  };
  P.colorPopup = (anchor, onPick, opts) => P.popup(anchor, P.colorPalette(onPick, opts));
  P.moreColors = (cur, onPick) => {
    const start = cur && cur[0] === '#' ? cur : (cur ? P.color(cur) : '#4472C4');
    const inp = h('input', { type: 'color', value: start.toLowerCase(), class: 'mc-big' });
    const hex = h('input', { type: 'text', value: start, class: 'field', style: { width: '90px' } });
    const [r0, g0, b0] = P.hex2rgb(start);
    const rr = h('input', { type: 'number', min: 0, max: 255, value: r0, class: 'field num' }), gg = h('input', { type: 'number', min: 0, max: 255, value: g0, class: 'field num' }), bb = h('input', { type: 'number', min: 0, max: 255, value: b0, class: 'field num' });
    const prev = h('div', { class: 'mc-prev' }); prev.style.background = start;
    const sync = c => { prev.style.background = c; const [a, b, d] = P.hex2rgb(c); rr.value = a; gg.value = b; bb.value = d; hex.value = c.toUpperCase(); inp.value = c.toLowerCase(); };
    inp.oninput = () => sync(inp.value); hex.onchange = () => { if (/^#?[0-9a-f]{6}$/i.test(hex.value)) sync(hex.value[0] === '#' ? hex.value : '#' + hex.value); };
    [rr, gg, bb].forEach(x => x.oninput = () => sync(P.rgb2hex(+rr.value, +gg.value, +bb.value)));
    const honey = h('div', { class: 'mc-swatches' });
    for (let hu = 0; hu < 12; hu++) for (let l = 0; l < 5; l++) { const [a, b, c] = P.hsl2rgb(hu / 12, .8, .22 + l * .15); const v = P.rgb2hex(a, b, c); const s = h('button', { class: 'cp-c', title: v }); s.style.background = v; s.onclick = () => sync(v); honey.append(s); }
    P.modal({ title: 'Colors', body: h('div', { class: 'mc' }, honey, h('div', { class: 'mc-side' }, inp, prev, h('label', {}, 'Hex ', hex), h('label', {}, 'Red ', rr), h('label', {}, 'Green ', gg), h('label', {}, 'Blue ', bb))), buttons: [['OK', () => { onPick(hex.value.toUpperCase()); return true; }, true], ['Cancel', () => true]] });
  };

  /* ---------- modal ---------- */
  let openCount = 0;
  P.modalOpen = () => openCount > 0;
  P.modal = ({ title, body, buttons = [['OK', () => true, true]], width, onClose, class: cls }) => {
    P.closePopup();
    openCount++;
    const back = h('div', { class: 'modal-back' });
    const dlg = h('div', { class: 'modal ' + (cls || ''), role: 'dialog', 'aria-label': title }); if (width) dlg.style.width = width + 'px';
    const close = () => { back.remove(); openCount--; document.removeEventListener('keydown', key, true); onClose && onClose(); };
    const head = h('div', { class: 'modal-h' }, h('span', { text: title }));
    const x = h('button', { class: 'modal-x', html: P.icon('close', 14), title: 'Close' }); x.onclick = close; head.append(x);
    const content = h('div', { class: 'modal-b' }); content.append(body);
    const foot = h('div', { class: 'modal-f' });
    let primary = null;
    buttons.forEach(([lbl, fn, prim]) => { const b = h('button', { class: 'btn' + (prim ? ' primary' : ''), text: lbl }); b.onclick = () => { const r = fn ? fn(close) : true; if (r !== false) close(); }; foot.append(b); if (prim) primary = b; });
    dlg.append(head, content); if (buttons.length) dlg.append(foot); back.append(dlg); document.body.append(back);
    /* drag by header */
    head.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; const r = dlg.getBoundingClientRect(); const ox = e.clientX - r.left, oy = e.clientY - r.top; dlg.style.position = 'fixed'; dlg.style.margin = 0; const mv = ev => { dlg.style.left = ev.clientX - ox + 'px'; dlg.style.top = ev.clientY - oy + 'px'; }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); });
    const key = e => { if (e.key === 'Escape') { e.stopPropagation(); close(); } if (e.key === 'Enter' && primary && e.target.tagName !== 'TEXTAREA' && e.target.tagName !== 'BUTTON' && !e.target.isContentEditable) { e.preventDefault(); primary.click(); } };
    document.addEventListener('keydown', key, true);
    const f = dlg.querySelector('input,select,textarea'); if (f) setTimeout(() => { f.focus(); if (f.select) f.select(); }, 20);
    return { close, dlg };
  };
  P.confirm = (msg, onYes, { ok = 'OK', cancel = 'Cancel', title = 'Podium', onNo } = {}) => P.modal({ title, body: h('div', { class: 'confirm-msg', text: msg }), buttons: [[ok, () => { onYes && onYes(); return true; }, true], [cancel, () => { onNo && onNo(); return true; }]], width: 460 });
  P.prompt = (title, label, val, onOk) => { const i = h('input', { class: 'field wide', value: val || '' }); P.modal({ title, width: 420, body: h('label', { class: 'fld' }, h('span', { text: label }), i), buttons: [['OK', () => { onOk(i.value); return true; }, true], ['Cancel', () => true]] }); };
  let toastT = 0;
  P.toast = msg => { let t = document.getElementById('toast'); if (!t) { t = h('div', { id: 'toast' }); document.body.append(t); } t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 3200); };
  P.tooltipFor = (el, title, desc) => { el.title = desc ? `${title}\n${desc}` : title; };

  /* form helpers */
  P.field = (label, input) => h('label', { class: 'fld' }, h('span', { text: label }), input);
  P.numInput = (val, { step = 1, min, max, unit, on } = {}) => {
    const w = h('span', { class: 'spin' });
    const i = h('input', { type: 'text', class: 'spin-i', value: fmtNum(val, unit) });
    const commit = v => { if (min != null) v = Math.max(min, v); if (max != null) v = Math.min(max, v); i.value = fmtNum(v, unit); on && on(v); };
    const parse = () => { const v = parseFloat(i.value); return isNaN(v) ? (min || 0) : v; };
    i.addEventListener('change', () => commit(parse()));
    i.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); commit(parse()); i.blur(); } if (e.key === 'ArrowUp') { e.preventDefault(); commit(P.round(parse() + step, 3)); } if (e.key === 'ArrowDown') { e.preventDefault(); commit(P.round(parse() - step, 3)); } e.stopPropagation(); });
    const up = h('button', { class: 'spin-b', html: '▲', tabIndex: -1 }), dn = h('button', { class: 'spin-b', html: '▼', tabIndex: -1 });
    up.onclick = () => commit(P.round(parse() + step, 3)); dn.onclick = () => commit(P.round(parse() - step, 3));
    w.append(i, h('span', { class: 'spin-bs' }, up, dn));
    w.setVal = v => { i.value = fmtNum(v, unit); };
    return w;
  };
  function fmtNum(v, unit) { if (v == null || v === '') return ''; return P.round(v, 2) + (unit || ''); }
  P.select = (opts, val, on) => { const s = h('select', { class: 'field' }); opts.forEach(o => { const [v, l] = Array.isArray(o) ? o : [o, o]; const op = h('option', { value: v, text: l }); if (String(v) === String(val)) op.selected = true; s.append(op); }); s.onchange = () => on && on(s.value); return s; };
  P.checkbox = (label, val, on) => { const i = h('input', { type: 'checkbox' }); i.checked = !!val; i.onchange = () => on && on(i.checked); return h('label', { class: 'chk' }, i, h('span', { text: label })); };
  P.radio = (name, label, val, on) => { const i = h('input', { type: 'radio', name }); i.checked = !!val; i.onchange = () => { if (i.checked) on && on(); }; return h('label', { class: 'chk' }, i, h('span', { text: label })); };
  P.colorBtn = (cur, on, opts = {}) => {
    const b = h('button', { class: 'color-btn' }); const sw = h('span', { class: 'cb-sw' }); const paint = c => { sw.style.background = c && c !== 'none' ? P.color(c) : 'transparent'; }; paint(cur);
    b.append(sw, h('span', { class: 'cb-ar', text: '▾' }));
    b.onclick = e => { e.preventDefault(); P.colorPopup(b, c => { paint(c); on(c); }, Object.assign({ cur }, opts)); };
    b.set = paint; return b;
  };
})(window.P);
