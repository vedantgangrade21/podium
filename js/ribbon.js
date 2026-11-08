/* Podium - the ribbon */
(function (P) {
  'use strict';
  const S = P.S;
  const R = { cur: 'home', controls: [], collapsed: false };
  let bar, body;

  /* ---------- control factories ---------- */
  const reg = (node, o) => { if (o && (o.on || o.dis || o.upd)) R.controls.push({ node, o }); return node; };
  const wireDd = (btn, o) => { btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); const c = typeof o.dd === 'function' ? o.dd(btn) : o.dd; if (!c) return; P.popup(btn, c.nodeType ? c : P.menuList(c), { class: o.ddClass }); }); };
  const keepFocus = n => { n.addEventListener('mousedown', e => { if (!['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) e.preventDefault(); }); return n; };
  /* large button */
  const lg = (label, icon, fn, o = {}) => {
    const lines = label.split('\n');
    if (o.dd && fn) { /* split */
      const w = h('div', { class: 'rb-lg split', title: o.tip || label.replace('\n', ' ') });
      const top = h('button', { class: 'rb-lg-top', html: P.icon(icon, 32) }); top.addEventListener('click', () => fn());
      const bot = h('button', { class: 'rb-lg-bot', html: `<span>${lines.join('<br>')}</span><span class="dd">▾</span>` }); wireDd(bot, o);
      w.append(top, bot); return keepFocus(reg(w, o));
    }
    const b = h('button', { class: 'rb-lg', title: o.tip || label.replace('\n', ' '), html: P.icon(icon, 32) + `<span class="t">${lines.join('<br>')}${o.dd ? ' <span class="dd">▾</span>' : ''}</span>` });
    if (o.dd) wireDd(b, o); else b.addEventListener('click', () => fn && fn());
    return keepFocus(reg(b, o));
  };
  const sm = (label, icon, fn, o = {}) => {
    const b = h('button', { class: 'rb-sm', title: o.tip || label, html: (icon ? P.icon(icon, 16) : '') + `<span>${label}</span>${o.dd ? '<span class="dd">▾</span>' : ''}` });
    if (o.dd) wireDd(b, o); else b.addEventListener('click', () => fn && fn());
    return keepFocus(reg(b, o));
  };
  const ic = (icon, tip, fn, o = {}) => {
    if (o.dd && fn) { const w = h('div', { class: 'rb-ic-split' }); const a = h('button', { class: 'rb-ic', title: tip, html: P.icon(icon, 16) }); a.addEventListener('click', () => fn()); const b = h('button', { class: 'rb-ic-dd', title: tip + ' options', text: '▾' }); wireDd(b, o); w.append(a, b); return keepFocus(reg(w, o)); }
    const b = h('button', { class: 'rb-ic', title: tip, html: P.icon(icon, 16) + (o.dd ? '<span class="dd">▾</span>' : '') });
    if (o.dd) wireDd(b, o); else b.addEventListener('click', () => fn && fn());
    return keepFocus(reg(b, o));
  };
  /* icon with a coloured bar under it */
  const colorIc = (icon, tip, cur, apply, palOpts, glyph) => {
    const w = h('div', { class: 'rb-ic-split color' });
    const bar = h('span', { class: 'cbar' }); const paint = c => { bar.style.background = c && c !== 'none' ? P.color(c) : 'transparent'; }; paint(cur.v);
    const a = h('button', { class: 'rb-ic', title: tip, html: glyph || P.icon(icon, 16) }); a.append(bar); a.addEventListener('click', () => apply(cur.v));
    const b = h('button', { class: 'rb-ic-dd', title: tip + ' options', text: '▾' });
    b.addEventListener('click', e => { e.stopPropagation(); P.colorPopup(b, c => { cur.v = c; paint(c); apply(c); }, palOpts || {}); });
    w.append(a, b); return keepFocus(w);
  };
  const col = (...k) => h('div', { class: 'rb-col' }, k);
  const row = (...k) => h('div', { class: 'rb-row' }, k);
  const grp = (label, kids, launcher) => {
    const g = h('div', { class: 'rb-grp' }); g.append(h('div', { class: 'rb-grp-b' }, kids));
    const f = h('div', { class: 'rb-grp-l' }, h('span', { text: label })); if (launcher) { const l = h('button', { class: 'launcher', title: label + ' settings', html: '<svg viewBox="0 0 10 10" width="9" height="9"><path d="M1 1h8v8M9 9L4 4M9 5v4H5" fill="none" stroke="#666" stroke-width="1"/></svg>' }); l.onclick = launcher; f.append(l); }
    g.append(f); return g;
  };
  const chk = (label, get, set) => { const i = h('input', { type: 'checkbox' }); i.onchange = () => set(i.checked); const l = h('label', { class: 'rb-chk' }, i, h('span', { text: label })); reg(l, { upd: () => { i.checked = !!get(); } }); return l; };
  const num = (label, get, set, o = {}) => { const s = P.numInput(get(), Object.assign({ on: set }, o)); const l = h('label', { class: 'rb-num' }, label ? h('span', { html: label }) : null, s); reg(l, { upd: () => { const v = get(); if (document.activeElement !== s.querySelector('input')) s.setVal(v == null ? '' : v); } }); return l; };
  /* gallery with scrollers and full view */
  const gallery = (items, render, o = {}) => {
    const w = h('div', { class: 'rb-gal ' + (o.class || '') });
    const view = h('div', { class: 'rb-gal-v' });
    const mkItem = it => { const b = h('button', { class: 'rb-gal-i', title: it.title || it.name || '' }); render(b, it); b.addEventListener('click', () => { P.closePopup(); it.fn ? it.fn() : o.pick && o.pick(it); }); if (o.isOn) reg(b, { on: () => o.isOn(it) }); return b; };
    items.forEach(it => view.append(mkItem(it)));
    const up = h('button', { class: 'gal-b', text: '▴' }), dn = h('button', { class: 'gal-b', text: '▾' }), more = h('button', { class: 'gal-b more', html: '▾' });
    const rowH = o.rowH || 62; up.onclick = () => view.scrollTop -= rowH; dn.onclick = () => view.scrollTop += rowH;
    more.onclick = e => {
      e.stopPropagation(); const box = h('div', { class: 'gal-full ' + (o.class || '') });
      if (o.groups) o.groups.forEach(([t, list]) => { box.append(h('div', { class: 'menu-head', text: t })); const g = h('div', { class: 'gal-full-g' }); list.forEach(it => g.append(mkItem(it))); box.append(g); });
      else { const g = h('div', { class: 'gal-full-g' }); items.forEach(it => g.append(mkItem(it))); box.append(g); }
      if (o.foot) box.append(P.menuList(o.foot)); P.popup(w, box);
    };
    w.append(view, h('div', { class: 'gal-bs' }, up, dn, more));
    return keepFocus(w);
  };
  P.ribbonHelpers = { lg, sm, ic, col, row, grp };

  /* ---------- selection helpers ---------- */
  const shapesSel = () => P.selected().filter(e => !e.type || e.type === 'shape' || e.type === 'group' || e.type === 'image');
  const forShapes = (fn, label) => { const list = P.selected(); if (!list.length) return; const w = el => { if (el.type === 'group') el.children.forEach(w); else fn(el); }; list.forEach(w); P.commit(label); };
  P.forShapes = forShapes;
  const noSel = () => !S.sel.length;
  const hasText = () => !!P.currentTextStyle();

  /* ---------- shared menus ---------- */
  P.shapesMenu = (onPick) => {
    const box = h('div', { class: 'shapes-menu' });
    P.shapeGallery.forEach(([t, list]) => {
      box.append(h('div', { class: 'menu-head', text: t }));
      const g = h('div', { class: 'shapes-grid' });
      list.forEach(n => { const b = h('button', { class: 'shape-pick', title: P.geomLabel(n), html: n === 'straightConnector1' ? '<svg viewBox="0 0 20 20" width="20" height="20"><path d="M2 18L17 3M11 3h6v6" fill="none" stroke="#555"/></svg>' : P.geomPreview(n, 18) }); b.onclick = () => { P.closePopup(); onPick(n); }; g.append(b); });
      if (t === 'Lines') { [['freeform', 'Freeform: Shape', 'freeform'], ['scribble', 'Freeform: Scribble', 'scribble']].forEach(([id, ti, icn]) => { const b = h('button', { class: 'shape-pick', title: ti, html: P.icon(icn, 18) }); b.onclick = () => { P.closePopup(); onPick(id); }; g.append(b); }); }
      box.append(g);
    });
    return box;
  };
  const insertShape = n => { if (n === 'straightConnector1') P.beginInsert('straightConnector1', { arrow: 'tail' }); else P.beginInsert(n); };
  const dropApply = (geom) => { /* Change Shape */ forShapes(el => { if (el.type === 'shape' || !el.type) { el.geom = geom; delete el.adj; delete el.paths; } }, 'Change shape'); };

  const arrangeMenu = () => [
    { head: 'Order Objects' },
    { label: 'Bring to Front', icon: 'bringfwd', fn: () => P.zorder('front') }, { label: 'Send to Back', icon: 'sendback', fn: () => P.zorder('back') }, { label: 'Bring Forward', icon: 'bringfwd', fn: () => P.zorder('forward') }, { label: 'Send Backward', icon: 'sendback', fn: () => P.zorder('backward') },
    { head: 'Group Objects' },
    { label: 'Group', icon: 'group', key: 'Ctrl+G', fn: P.groupSelected, disabled: S.sel.length < 2 }, { label: 'Ungroup', icon: 'ungroup', key: 'Ctrl+Shift+G', fn: P.ungroupSelected }, { head: 'Position Objects' },
    { label: 'Align', icon: 'align', sub: alignMenu }, { label: 'Rotate', icon: 'rotate', sub: rotateMenu }, '-', { label: 'Selection Pane…', icon: 'selection', fn: () => P.openPane('selection') }
  ];
  const alignMenu = () => [{ label: 'Align Left', icon: 'alignL', fn: () => P.alignSel('l') }, { label: 'Align Center', icon: 'alignC', fn: () => P.alignSel('c') }, { label: 'Align Right', icon: 'alignR', fn: () => P.alignSel('r') }, '-', { label: 'Align Top', fn: () => P.alignSel('t') }, { label: 'Align Middle', fn: () => P.alignSel('m') }, { label: 'Align Bottom', fn: () => P.alignSel('b') }, '-', { label: 'Distribute Horizontally', fn: () => P.alignSel('distH') }, { label: 'Distribute Vertically', fn: () => P.alignSel('distV') }, '-', { label: 'Align to Slide', check: S.alignToSlide, fn: () => { S.alignToSlide = true; } }, { label: 'Align Selected Objects', check: !S.alignToSlide, fn: () => { S.alignToSlide = false; } }];
  const rotateMenu = () => [{ label: 'Rotate Right 90°', fn: () => P.rotateSel(90) }, { label: 'Rotate Left 90°', fn: () => P.rotateSel(-90) }, { label: 'Flip Vertical', icon: 'flipV', fn: () => P.flipSel('v') }, { label: 'Flip Horizontal', icon: 'flipH', fn: () => P.flipSel('h') }, '-', { label: 'More Rotation Options…', fn: () => P.openPane('format', 'size') }];
  const WD = ['tx1', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
  P.shapeStyles = () => {
    const rows = [];
    WD.forEach(c => { const txt = c === 'tx1' ? 'bg1' : 'bg1';
      rows.push({ name: 'Colored Outline', fill: { type: 'solid', color: 'bg1' }, line: { type: 'solid', color: c, width: 1 }, text: 'tx1' });
      void txt; });
    WD.forEach(c => rows.push({ name: 'Colored Fill', fill: { type: 'solid', color: c }, line: { type: 'solid', color: c + ':50,0', width: 1 }, text: 'bg1' }));
    WD.forEach(c => rows.push({ name: 'Light Outline, Colored Fill', fill: { type: 'solid', color: c }, line: { type: 'solid', color: 'bg1', width: 3 }, text: 'bg1', fx: { shadow: { color: '#000000', blur: 4, dist: 2, dir: 90, opacity: .3 } } }));
    WD.forEach(c => rows.push({ name: 'Subtle Effect', fill: { type: 'solid', color: c === 'tx1' ? 'tx1:25,75' : c + ':20,80' }, line: { type: 'solid', color: c === 'tx1' ? 'tx1' : c, width: .75 }, text: c === 'tx1' ? 'tx1' : c + ':50,0' }));
    WD.forEach(c => rows.push({ name: 'Moderate Effect', fill: { type: 'gradient', kind: 'linear', angle: 90, stops: [{ pos: 0, color: c === 'tx1' ? 'tx1:65,35' : c + ':60,40' }, { pos: 100, color: c }] }, line: { type: 'none' }, text: 'bg1', fx: { shadow: { color: '#000000', blur: 4, dist: 2, dir: 90, opacity: .4 } } }));
    WD.forEach(c => rows.push({ name: 'Intense Effect', fill: { type: 'gradient', kind: 'linear', angle: 90, stops: [{ pos: 0, color: c }, { pos: 100, color: c + ':50,0' }] }, line: { type: 'solid', color: 'bg1', width: 1 }, text: 'bg1', fx: { shadow: { color: '#000000', blur: 8, dist: 4, dir: 90, opacity: .5 } } }));
    return rows;
  };
  const applyStyle = st => forShapes(el => { if (el.type === 'image') return; el.fill = P.clone(st.fill); el.line = P.clone(st.line); if (st.fx) el.fx = P.clone(st.fx); else delete el.fx; el.lst = el.lst || [{}]; el.lst[0] = Object.assign({}, el.lst[0], { color: st.text }); (el.paras || []).forEach(p => (p.runs || []).forEach(r => { delete r.color; })); }, 'Shape style');
  const stylesGallery = () => gallery(P.shapeStyles(), (b, st) => { const d = h('div', { class: 'qs', text: 'Abc' }); d.style.background = P.fillCss(st.fill); d.style.color = P.color(st.text); d.style.border = st.line.type === 'none' ? 'none' : `${Math.min(st.line.width, 2)}px solid ${P.color(st.line.color)}`; if (st.fx) d.style.boxShadow = '0 1px 3px rgba(0,0,0,.45)'; b.append(d); b.title = st.name; }, { pick: applyStyle, class: 'qs-gal', rowH: 34 });
  const quickStylesPopup = () => { const box = h('div', { class: 'gal-full-g qs-gal' }); P.shapeStyles().forEach(st => { const b = h('button', { class: 'rb-gal-i', title: st.name }); const d = h('div', { class: 'qs', text: 'Abc' }); d.style.background = P.fillCss(st.fill); d.style.color = P.color(st.text); d.style.border = st.line.type === 'none' ? 'none' : `1px solid ${P.color(st.line.color)}`; b.append(d); b.onclick = () => { P.closePopup(); applyStyle(st); }; box.append(b); }); return box; };

  const setFill = c => forShapes(el => { if (el.type === 'image') return; el.fill = c === 'none' ? { type: 'none' } : { type: 'solid', color: c }; }, 'Shape fill');
  const setLine = c => forShapes(el => { if (c === 'none') el.line = { type: 'none' }; else el.line = Object.assign({ width: 1 }, el.line && el.line.type !== 'none' ? el.line : {}, { type: 'solid', color: c }); }, 'Shape outline');
  const fillMenu = () => { const cell = P.selected().some(e => e.type === 'table'); return P.colorPalette(c => cell ? P.cellsTarget(x => { x.fill = c === 'none' ? { type: 'none' } : { type: 'solid', color: c }; }) : setFill(c), { none: 'No Fill', extra: [{ label: 'Picture…', icon: 'picture', fn: async () => { const f = await P.pickFile('image/*'); if (!f[0]) return; const id = P.addMedia(f[0], f[0].name); forShapes(el => { el.fill = { type: 'picture', src: 'media:' + id }; }, 'Picture fill'); } }, { label: 'Gradient…', icon: 'quickstyles', keep: true, fn: (e, b) => { P.closePopup(); P.popup(b.isConnected ? b : document.getElementById('ribbon'), P.menuList(gradientPresets())); } }, { label: 'More Fill Options…', icon: 'sidebar', fn: () => P.openPane('format', 'fill') }] }); };
  const gradientPresets = () => { const out = []; [['Light Linear', 'accent1:40,60', 'accent1'], ['Dark Linear', 'accent1', 'accent1:50,0'], ['Sunset', 'accent4', 'accent2'], ['Ocean', 'accent5', 'accent1'], ['Mint', 'accent6:60,40', 'accent6:75,0']].forEach(([n, a, b]) => { [90, 0, 45].forEach(ang => out.push({ label: `${n} ${ang}°`, icon: `<span class="grad-s" style="background:linear-gradient(${ang + 90}deg,${P.color(a)},${P.color(b)})"></span>`, fn: () => forShapes(el => { if (el.type === 'image') return; el.fill = { type: 'gradient', kind: 'linear', angle: ang, stops: [{ pos: 0, color: a }, { pos: 100, color: b }] }; }, 'Gradient fill') })); }); return out; };
  const weights = [.25, .5, .75, 1, 1.5, 2.25, 3, 4.5, 6];
  const dashOpts = [['solid', 'Solid'], ['sysDot', 'Round Dot'], ['sysDash', 'Square Dot'], ['dash', 'Dash'], ['dashDot', 'Dash Dot'], ['lgDash', 'Long Dash'], ['lgDashDot', 'Long Dash Dot'], ['lgDashDotDot', 'Long Dash Dot Dot']];
  const lineMenu = () => P.colorPalette(setLine, { none: 'No Outline', extra: [{ label: 'Weight', icon: 'linespace', keep: true, fn: (e, b) => subMenu(b, weights.map(w => ({ label: w + ' pt', fn: () => forShapes(el => { el.line = Object.assign({ type: 'solid', color: 'tx1' }, el.line && el.line.type !== 'none' ? el.line : {}, { width: w }); }, 'Line weight') }))) }, { label: 'Dashes', icon: 'alignJ', keep: true, fn: (e, b) => subMenu(b, dashOpts.map(([v, n]) => ({ label: n, fn: () => forShapes(el => { el.line = Object.assign({ type: 'solid', color: 'tx1', width: 1 }, el.line && el.line.type !== 'none' ? el.line : {}, { dash: v }); }, 'Line dash') }))) }, { label: 'Arrows', icon: 'next', keep: true, fn: (e, b) => subMenu(b, arrowsMenu()) }] });
  const subMenu = (b, items) => { const old = document.querySelector('.subpop'); if (old) old.remove(); const s = h('div', { class: 'popup subpop' }); s.append(P.menuList(items)); b.closest('.popup').append(s); const r = b.getBoundingClientRect(); s.style.position = 'fixed'; s.style.left = (r.right - 2) + 'px'; s.style.top = Math.min(r.top, innerHeight - s.offsetHeight - 6) + 'px'; if (r.right + s.offsetWidth > innerWidth) s.style.left = (r.left - s.offsetWidth) + 'px'; };
  const arrowsMenu = () => { const mk = (lbl, head, tail) => ({ label: lbl, fn: () => forShapes(el => { el.line = Object.assign({ type: 'solid', color: 'tx1', width: 1 }, el.line && el.line.type !== 'none' ? el.line : {}); el.line.head = head ? { type: head } : undefined; el.line.tail = tail ? { type: tail } : undefined; }, 'Arrow style') }); return [mk('No Arrows'), mk('Arrow at end', null, 'triangle'), mk('Arrow at start', 'triangle'), mk('Arrows at both ends', 'triangle', 'triangle'), mk('Open arrow at end', null, 'arrow'), mk('Stealth arrow', null, 'stealth'), mk('Diamond ends', 'diamond', 'diamond'), mk('Oval ends', 'oval', 'oval')]; };
  /* Effects menu */
  P.effectsPresets = {
    Shadow: [['No Shadow', null], ['Offset Bottom Right', { color: '#000000', blur: 5, dist: 3, dir: 45, opacity: .4 }], ['Offset Bottom', { color: '#000000', blur: 5, dist: 3, dir: 90, opacity: .4 }], ['Offset Bottom Left', { color: '#000000', blur: 5, dist: 3, dir: 135, opacity: .4 }], ['Offset Right', { color: '#000000', blur: 5, dist: 3, dir: 0, opacity: .4 }], ['Offset Center', { color: '#000000', blur: 6, dist: 0, dir: 0, opacity: .4 }], ['Offset Left', { color: '#000000', blur: 5, dist: 3, dir: 180, opacity: .4 }], ['Offset Top Right', { color: '#000000', blur: 5, dist: 3, dir: 315, opacity: .4 }], ['Offset Top', { color: '#000000', blur: 5, dist: 3, dir: 270, opacity: .4 }], ['Offset Top Left', { color: '#000000', blur: 5, dist: 3, dir: 225, opacity: .4 }], ['Far Bottom', { color: '#000000', blur: 14, dist: 10, dir: 90, opacity: .3 }]],
    Reflection: [['No Reflection', null], ['Tight, Touching', { size: 35, dist: 0, opacity: .5 }], ['Half, Touching', { size: 50, dist: 0, opacity: .5 }], ['Full, Touching', { size: 100, dist: 0, opacity: .5 }], ['Half, 4 pt', { size: 50, dist: 4, opacity: .4 }], ['Full, 8 pt', { size: 100, dist: 8, opacity: .35 }]],
    Glow: [['No Glow', null], ...[5, 8, 11, 18].flatMap(r => ['accent1', 'accent2', 'accent4', 'accent6'].map(c => [`${r} pt ${c}`, { color: c, rad: r, opacity: .6 }]))],
    'Soft Edges': [['No Soft Edges', null], ['1 pt', { rad: 1 }], ['2.5 pt', { rad: 2.5 }], ['5 pt', { rad: 5 }], ['10 pt', { rad: 10 }], ['25 pt', { rad: 25 }]],
    '3-D Rotation': [['No Rotation', null], ['Off Axis 1 Right', { x: 10, y: -30, persp: 800 }], ['Off Axis 1 Left', { x: 10, y: 30, persp: 800 }], ['Perspective Above', { x: 40, y: 0, persp: 700 }], ['Perspective Below', { x: -40, y: 0, persp: 700 }], ['Perspective Left', { x: 0, y: 40, persp: 700 }], ['Perspective Right', { x: 0, y: -40, persp: 700 }]]
  };
  const fxKeys = { Shadow: 'shadow', Reflection: 'reflect', Glow: 'glow', 'Soft Edges': 'soft', '3-D Rotation': 'rot3d' };
  const applyFx = (group, val) => forShapes(el => { const k = fxKeys[group]; el.fx = el.fx || {}; if (val) el.fx[k] = P.clone(val); else delete el.fx[k]; if (!Object.keys(el.fx).length) delete el.fx; }, group);
  const effectsMenu = () => Object.keys(P.effectsPresets).map(g => ({ label: g, sub: () => { const box = h('div', { class: 'fx-grid' }); P.effectsPresets[g].forEach(([n, v]) => { const b = h('button', { class: 'fx-i', title: n }); const d = h('div', { class: 'fx-prev' }); if (g === 'Shadow' && v) { const t = v.dir * Math.PI / 180; d.style.boxShadow = `${Math.cos(t) * v.dist}px ${Math.sin(t) * v.dist}px ${v.blur}px rgba(0,0,0,${v.opacity})`; } if (g === 'Glow' && v) d.style.boxShadow = `0 0 ${v.rad}px ${P.color(v.color)}`; if (g === 'Soft Edges' && v) d.style.filter = `blur(${v.rad / 5}px)`; if (g === 'Reflection' && v) d.style.webkitBoxReflect = `below ${v.dist}px linear-gradient(transparent ${100 - v.size}%,rgba(0,0,0,.5))`; if (g === '3-D Rotation' && v) d.style.transform = `perspective(${v.persp}px) rotateX(${v.x}deg) rotateY(${v.y}deg)`; if (!v) d.classList.add('none'); b.append(d); b.onclick = () => { P.closePopup(); applyFx(g, v); }; box.append(b); }); return box; } })).concat(['-', { label: 'More Options…', icon: 'sidebar', fn: () => P.openPane('format', 'effects') }]);

  const bulletsGallery = () => { const items = [[null, 'None'], ['•', 'Filled Round'], ['○', 'Hollow Round'], ['■', 'Filled Square'], ['□', 'Hollow Square'], ['❖', 'Star Bullets'], ['➢', 'Arrow'], ['✓', 'Checkmark'], ['–', 'Dash']]; const box = h('div', { class: 'fx-grid bullets' }); items.forEach(([c, n]) => { const b = h('button', { class: 'bl-i', title: n, html: c ? `<span>${c}</span><i></i><span>${c}</span><i></i><span>${c}</span><i></i>` : '<b>None</b>' }); b.onclick = () => { P.closePopup(); applyBullet(c ? { type: 'char', char: c } : null); }; box.append(b); }); return box; };
  const numberGallery = () => { const items = [[null, 'None'], ['arabicPeriod', '1. 2. 3.'], ['arabicParenR', '1) 2) 3)'], ['romanUcPeriod', 'I. II. III.'], ['alphaUcPeriod', 'A. B. C.'], ['alphaLcParenR', 'a) b) c)'], ['alphaLcPeriod', 'a. b. c.'], ['romanLcPeriod', 'i. ii. iii.']]; const box = h('div', { class: 'fx-grid bullets' }); items.forEach(([c, n]) => { const b = h('button', { class: 'bl-i num', title: n, html: c ? n.split(' ').map(x => `<span>${x}</span><i></i>`).join('') : '<b>None</b>' }); b.onclick = () => { P.closePopup(); applyBullet(c ? { type: 'num', style: c } : null); }; box.append(b); }); return box; };
  const applyBullet = b => P.mapParas(p => { if (b) { p.bullet = b; if (p.marL == null) { const lv = p.level || 0; p.marL = 18 + lv * 36 + (b.type === 'num' ? 9 : 0); p.indent = b.type === 'num' ? -27 : -18; } } else { p.bullet = null; p.marL = (p.level || 0) * 36; p.indent = 0; } }, 'Bullets');
  const lineSpaceMenu = () => [1, 1.5, 2, 2.5, 3].map(v => ({ label: v.toFixed(1), check: (P.currentTextStyle() || {}).lineSp === v, fn: () => P.fmtPara({ lineSp: v, lineSpPt: undefined }, 'Line spacing') })).concat(['-', { label: 'Line Spacing Options…', fn: paraDialog }]);
  const paraDialog = () => {
    const st = P.currentTextStyle() || {}; let align = st.align || 'l', before = 0, after = 0, ls = st.lineSp || 1, lvl = st.level || 0, marL = 0, ind = 0;
    P.modal({ title: 'Paragraph', width: 420, body: h('div', { class: 'para-dlg' },
      P.field('Alignment:', P.select([['l', 'Left'], ['ctr', 'Centered'], ['r', 'Right'], ['just', 'Justified']], align, v => align = v)),
      P.field('Before text (pt):', P.numInput(0, { step: 6, min: 0, on: v => marL = v })), P.field('Hanging (pt):', P.numInput(0, { step: 6, min: 0, on: v => ind = v })),
      P.field('Spacing before (pt):', P.numInput(0, { step: 6, min: 0, on: v => before = v })), P.field('Spacing after (pt):', P.numInput(0, { step: 6, min: 0, on: v => after = v })),
      P.field('Line spacing (multiple):', P.numInput(ls, { step: .1, min: .3, on: v => ls = v }))), buttons: [['OK', () => { P.fmtPara({ align, spcBef: before || undefined, spcAft: after || undefined, lineSp: ls, marL: marL || undefined, indent: ind ? -ind : undefined }, 'Paragraph'); void lvl; return true; }, true], ['Cancel', () => true]] });
  };
  const fontDialog = () => {
    const st = P.currentTextStyle() || {}; const o = { font: st.font, size: st.size, b: st.b, i: st.i, u: st.u, s: st.s, color: st.color, base: st.base, cap: st.cap, spc: st.spc };
    P.modal({ title: 'Font', width: 480, body: h('div', { class: 'font-dlg' },
      P.field('Latin text font:', P.select(P.fonts, st.font, v => o.font = v)), P.field('Size:', P.numInput(st.size, { min: 1, max: 400, step: 1, on: v => o.size = v })),
      P.field('Font color:', P.colorBtn(st.color, c => o.color = c)),
      P.checkbox('Bold', st.b, v => o.b = v), P.checkbox('Italic', st.i, v => o.i = v), P.checkbox('Underline', st.u, v => o.u = v), P.checkbox('Strikethrough', st.s, v => o.s = v),
      P.checkbox('Superscript', st.base > 0, v => o.base = v ? 30 : undefined), P.checkbox('Subscript', st.base < 0, v => o.base = v ? -25 : undefined), P.checkbox('Small Caps', st.cap === 'small', v => o.cap = v ? 'small' : undefined), P.checkbox('All Caps', st.cap === 'all', v => o.cap = v ? 'all' : undefined),
      P.field('Character spacing (pt):', P.numInput(st.spc || 0, { step: .5, on: v => o.spc = v || undefined }))), buttons: [['OK', () => { P.fmtRun(o, 'Font'); return true; }, true], ['Cancel', () => true]] });
  };
  P.fontDialog = fontDialog;
  /* combos */
  const fontCombo = () => {
    const w = h('div', { class: 'rb-combo font' }); const i = h('input', { title: 'Font' }); const b = h('button', { text: '▾', tabIndex: -1 });
    i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { P.fmtRun({ font: i.value }, 'Font'); } });
    i.addEventListener('mousedown', e => e.stopPropagation());
    const open = () => { const m = h('div', { class: 'font-menu' }); const th = P.deck.theme.fonts; m.append(h('div', { class: 'menu-head', text: 'Theme Fonts' })); [[th.major, 'Headings', '+mj'], [th.minor, 'Body', '+mn']].forEach(([f, l, v]) => { const x = h('button', { class: 'font-i', style: { fontFamily: `"${f}"` }, html: `${f} <small>(${l})</small>` }); x.onclick = () => { P.closePopup(); P.fmtRun({ font: v }, 'Font'); }; m.append(x); }); m.append(h('div', { class: 'menu-head', text: 'All Fonts' })); P.fonts.forEach(f => { const x = h('button', { class: 'font-i', style: { fontFamily: `"${f}"` }, text: f, title: f }); x.onclick = () => { P.closePopup(); P.fmtRun({ font: f }, 'Font'); }; m.append(x); }); P.popup(w, m); };
    b.onclick = e => { e.stopPropagation(); open(); };
    w.append(i, b); keepFocus(b); reg(w, { upd: () => { const st = P.currentTextStyle(); if (document.activeElement !== i) i.value = st ? st.font : ''; } }); return w;
  };
  const sizeCombo = () => {
    const w = h('div', { class: 'rb-combo size' }); const i = h('input', { title: 'Font size' }); const b = h('button', { text: '▾', tabIndex: -1 });
    i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const v = parseFloat(i.value); if (v > 0) P.fmtRun({ size: v }, 'Font size'); } });
    i.addEventListener('mousedown', e => e.stopPropagation());
    b.onclick = e => { e.stopPropagation(); const m = h('div', { class: 'font-menu size' }); P.fontSizes.forEach(s => { const x = h('button', { class: 'font-i', text: s }); x.onclick = () => { P.closePopup(); P.fmtRun({ size: s }, 'Font size'); }; m.append(x); }); P.popup(w, m); };
    w.append(i, b); keepFocus(b); reg(w, { upd: () => { const st = P.currentTextStyle(); if (document.activeElement !== i) i.value = st ? P.round(st.size * ((P.T.active && P.T.active.el.fontScale) || (P.selected()[0] && P.selected()[0].fontScale) || 100) / 100, 1) : ''; } }); return w;
  };
  const fontColor = { v: '#FF0000' }, hlColor = { v: '#FFFF00' }, fillCur = { v: 'accent1' }, lineCur = { v: 'accent1' }, tfCur = { v: 'accent1' }, toCur = { v: 'tx1' };
  P.fontGroup = () => {
    const toggle = (k, ico, tip) => ic(ico, tip, () => { const st = P.currentTextStyle(); if (st) P.fmtRun({ [k]: !st[k] }, tip); }, { on: () => { const st = P.currentTextStyle(); return st && st[k]; }, dis: () => !hasText() });
    return grp('Font', [
      col(row(fontCombo(), sizeCombo(), ic('grow', 'Increase Font Size (Ctrl+])', () => P.bumpFont(1)), ic('shrink', 'Decrease Font Size (Ctrl+[)', () => P.bumpFont(-1)), ic('clearfmt', 'Clear All Formatting', () => { P.mapRuns(r => { Object.keys(r).forEach(k => { if (k !== 't' && k !== 'field') delete r[k]; }); }, 'Clear formatting'); })),
        row(toggle('b', 'bold', 'Bold (Ctrl+B)'), toggle('i', 'italic', 'Italic (Ctrl+I)'), toggle('u', 'underline', 'Underline (Ctrl+U)'), toggle('s', 'strike', 'Strikethrough'), ic('textshadow', 'Text Shadow', () => { const st = P.currentTextStyle(); P.fmtRun({ shadow: st && st.shadow ? undefined : { color: '#000000', dist: 1.5, dir: 45, blur: 2, opacity: .5 } }, 'Text shadow'); }, { on: () => (P.currentTextStyle() || {}).shadow }),
          ic('spacing', 'Character Spacing', null, { dd: () => [['Very Tight', -3], ['Tight', -1.5], ['Normal', undefined], ['Loose', 3], ['Very Loose', 6]].map(([n, v]) => ({ label: n, fn: () => P.fmtRun({ spc: v }, 'Character spacing') })).concat(['-', { label: 'More Spacing…', fn: fontDialog }]) }),
          ic('case', 'Change Case', null, { dd: () => [['Sentence case.', s => s.toLowerCase().replace(/(^\s*\w|[.!?]\s+\w)/g, c => c.toUpperCase())], ['lowercase', s => s.toLowerCase()], ['UPPERCASE', s => s.toUpperCase()], ['Capitalize Each Word', s => s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())], ['tOGGLE cASE', s => s.replace(/./g, c => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()))]].map(([n, fn]) => ({ label: n, fn: () => P.mapRuns(r => { r.t = fn(r.t); }, 'Change case') })) }),
          colorIc('highlight', 'Text Highlight Color', hlColor, c => P.fmtRun({ hl: c === 'none' ? undefined : c }, 'Highlight'), { none: 'No Color' }),
          colorIc('fontcolor', 'Font Color', fontColor, c => P.fmtRun({ color: c === 'none' ? undefined : c, tfill: undefined }, 'Font color'), { auto: 'Automatic' })))
    ], fontDialog);
  };
  P.paraGroup = () => grp('Paragraph', [
    col(row(ic('bullets', 'Bullets', () => { const st = P.currentTextStyle(); applyBullet(st && st.bullet && st.bullet.type === 'char' ? null : { type: 'char', char: '•' }); }, { dd: bulletsGallery, on: () => { const st = P.currentTextStyle(); return st && st.bullet && st.bullet.type === 'char'; } }),
        ic('numbering', 'Numbering', () => { const st = P.currentTextStyle(); applyBullet(st && st.bullet && st.bullet.type === 'num' ? null : { type: 'num', style: 'arabicPeriod' }); }, { dd: numberGallery, on: () => { const st = P.currentTextStyle(); return st && st.bullet && st.bullet.type === 'num'; } }),
        ic('indentDec', 'Decrease List Level', () => P.mapParas(p => { p.level = Math.max(0, (p.level || 0) - 1); if (!p.level) delete p.level; }, 'List level')), ic('indentInc', 'Increase List Level', () => P.mapParas(p => { p.level = Math.min(8, (p.level || 0) + 1); }, 'List level')),
        ic('linespace', 'Line Spacing', null, { dd: lineSpaceMenu }), ic('columns', 'Add or Remove Columns', null, { dd: () => [1, 2, 3].map(n => ({ label: ['One Column', 'Two Columns', 'Three Columns'][n - 1], fn: () => forShapes(el => { el.cols = n === 1 ? undefined : n; }, 'Columns') })) })),
      row(...[['l', 'alignL', 'Align Left (Ctrl+L)'], ['ctr', 'alignC', 'Center (Ctrl+E)'], ['r', 'alignR', 'Align Right (Ctrl+R)'], ['just', 'alignJ', 'Justify (Ctrl+J)']].map(([v, n, t]) => ic(n, t, () => P.fmtPara({ align: v }, 'Align'), { on: () => { const st = P.currentTextStyle(); return st && st.align === v; } })),
        ic('textdir', 'Text Direction', null, { dd: () => [['Horizontal', undefined], ['Rotate all text 90°', 'vert'], ['Rotate all text 270°', 'vert270']].map(([n, v]) => ({ label: n, fn: () => forShapes(el => { el.vert = v; }, 'Text direction') })) }),
        ic('aligntext', 'Align Text', null, { dd: () => [['Top', 't'], ['Middle', 'ctr'], ['Bottom', 'b']].map(([n, v]) => ({ label: n, fn: () => forShapes(el => { el.anchor = v; }, 'Align text') })).concat(['-', { label: 'More Options…', fn: () => P.openPane('format', 'text') }]) }),
        ic('smartart', 'Convert to SmartArt', () => P.convertToSmartArt())))
  ], paraDialog);
  P.drawingGroup = () => grp('Drawing', [
    lg('Shapes', 'shapes', null, { dd: () => P.shapesMenu(insertShape) }), lg('Arrange', 'arrange', null, { dd: arrangeMenu, dis: noSel }), lg('Quick\nStyles', 'quickstyles', null, { dd: quickStylesPopup, dis: noSel }),
    col(colorSm('Shape Fill', 'fill', fillCur, setFill, fillMenu), colorSm('Shape Outline', 'outline', lineCur, setLine, lineMenu), sm('Shape Effects', 'effects', null, { dd: effectsMenu, dis: noSel }))
  ], () => P.openPane('format'));
  function colorSm(label, icon, cur, apply, ddfn) {
    const w = h('div', { class: 'rb-sm-split' });
    const a = h('button', { class: 'rb-sm', html: P.icon(icon, 16) + `<span>${label}</span>` }); const bar = h('span', { class: 'sbar' }); bar.style.background = P.color(cur.v); a.append(bar); a.onclick = () => apply(cur.v);
    const b = h('button', { class: 'rb-ic-dd', text: '▾' }); b.onclick = e => { e.stopPropagation(); P.popup(b, ddfn()); };
    w.append(a, b); return keepFocus(w);
  }

  /* ---------- tabs ---------- */
  const TABS = {
    home: () => [
      grp('Clipboard', [lg('Paste', 'paste', async () => { if (P.clip) { P.pasteClip(); return; } try { const items = await navigator.clipboard.read(); for (const it of items) { const t = it.types.find(x => x.startsWith('image/')); if (t) { const b = await it.getType(t); P.insertPictureBlob(b, null, { noPh: true }); return; } } const tx = await navigator.clipboard.readText(); if (tx) { const D = P.deck.size, tb = P.textBox(D.w * .2, D.h * .35, D.w * .6, 40); tb.paras = tx.split(/\r?\n/).map(l => P.para(l)); tb.fit = 'resize'; P.page().elements.push(tb); S.sel = [tb.id]; P.T.fit(tb); P.commit('Paste text'); } } catch (_) { P.toast('Press Ctrl+V to paste from the system clipboard.'); } }, { dd: () => [{ label: 'Paste', icon: 'paste', key: 'Ctrl+V', fn: () => P.pasteClip(), disabled: !P.clip }, { label: 'Duplicate', icon: 'copy', key: 'Ctrl+D', fn: () => P.duplicateSelected() }] }),
        col(sm('Cut', 'cut', () => { if (P.slideFocus && P.slideFocus()) { P.copySlides(); P.deleteSlides(); } else if (P.copySel()) P.deleteSelected(); }), sm('Copy', 'copy', () => { if (P.slideFocus && P.slideFocus()) P.copySlides(); else P.copySel(); }), sm('Format Painter', 'painter', () => P.startPainter(false), { on: () => !!S.painter, dis: noSel, tip: 'Format Painter (Ctrl+Shift+C). Double-click for repeat use.' }))]),
      grp('Slides', [lg('New\nSlide', 'newslide', () => P.addSlide(), { dd: () => P.layoutPicker(id => P.addSlide(id), true) }), col(sm('Layout', 'layout', null, { dd: () => P.layoutPicker(id => P.setLayout(id)) }), sm('Reset', 'reset', () => P.resetSlide()), sm('Section', 'section', null, { dd: () => P.sectionMenu() }))]),
      P.fontGroup(), P.paraGroup(), P.drawingGroup(),
      grp('Editing', [col(sm('Find', 'find', () => P.findDialog(false)), sm('Replace', 'replace', () => P.findDialog(true)), sm('Select', 'select', null, { dd: () => [{ label: 'Select All', key: 'Ctrl+A', fn: () => { S.sel = P.page().elements.map(x => x.id); P.drawOverlay(); P.emit('selection'); } }, { label: 'Select Objects', fn: () => { P.setInk(null); P.cancelInsert(); } }, { label: 'Selection Pane…', icon: 'selection', fn: () => P.openPane('selection') }] }))])
    ],
    insert: () => [
      grp('Slides', [lg('New\nSlide', 'newslide', () => P.addSlide(), { dd: () => P.layoutPicker(id => P.addSlide(id), true) })]),
      grp('Tables', [lg('Table', 'table', null, { dd: () => P.tableGridPicker() })]),
      grp('Images', [lg('Pictures', 'picture', () => P.pickPicture()), lg('Screenshot', 'screenshot', () => P.screenshot()), lg('Photo\nAlbum', 'album', () => P.photoAlbum())]),
      grp('Illustrations', [lg('Shapes', 'shapes', null, { dd: () => P.shapesMenu(insertShape) }), lg('Icons', 'iconset', () => P.iconsDialog()), lg('SmartArt', 'smartart', () => P.smartArtDialog()), lg('Chart', 'chart', () => P.chartDialog())]),
      grp('Links', [lg('Link', 'link', () => P.linkDialog()), lg('Action', 'action', () => P.actionDialog())]),
      grp('Comments', [lg('Comment', 'newcomment', () => P.addComment())]),
      grp('Text', [lg('Text\nBox', 'textbox', () => P.beginInsert('textbox'), { dd: () => [{ label: 'Draw Horizontal Text Box', fn: () => P.beginInsert('textbox') }, { label: 'Vertical Text Box', fn: () => P.beginInsert('textbox', { vert: true }) }] }), lg('Header\n& Footer', 'headerfooter', () => P.headerFooterDialog()), lg('WordArt', 'wordart', null, { dd: () => wordArtPicker(P.insertWordArt) }), col(sm('Date & Time', 'date', () => P.insertDate()), sm('Slide Number', 'number', () => P.insertSlideNumber()))]),
      grp('Symbols', [lg('Equation', 'equation', () => P.equationDialog()), lg('Symbol', 'symbol', () => P.symbolDialog())]),
      grp('Media', [lg('Video', 'video', () => P.pickMedia('video')), lg('Audio', 'audio', null, { dd: () => [{ label: 'Audio on My PC…', icon: 'folder', fn: () => P.pickMedia('audio') }, { label: 'Record Audio…', icon: 'record', fn: () => P.recordAudio() }] }), lg('Screen\nRecording', 'record', () => P.screenRecord())])
    ],
    draw: () => {
      const on = t => S.ink && S.ink.tool === t;
      const penBtn = (label, color, width, tool, opacity) => { const b = h('button', { class: 'rb-pen', title: label, html: P.icon(tool === 'highlighter' ? 'penhl' : 'pen', 26) + `<span class="pen-swatch" style="background:${P.color(color)}"></span>` }); b.onclick = () => P.setInk({ tool, color, width, opacity }); reg(b, { on: () => S.ink && S.ink.color === color && S.ink.width === width }); return keepFocus(b); };
      return [
        grp('Drawing Tools', [lg('Select', 'select', () => P.setInk(null), { on: () => !S.ink }), lg('Eraser', 'eraser', () => P.setInk({ tool: 'eraser' }), { on: () => on('eraser') })]),
        grp('Pens', [penBtn('Black pen', '#000000', 1.5, 'pen'), penBtn('Red pen', '#FF0000', 1.5, 'pen'), penBtn('Blue pen', '#0070C0', 2.25, 'pen'), penBtn('Green pen', '#00B050', 2.25, 'pen'), penBtn('Thick accent', 'accent1', 4.5, 'pen'), penBtn('Yellow highlighter', '#FFFF00', 12, 'highlighter', .45), penBtn('Green highlighter', '#92D050', 12, 'highlighter', .45), penBtn('Pink highlighter', '#FF99CC', 12, 'highlighter', .45),
          lg('Custom\nPen', 'color', null, { dd: () => P.colorPalette(c => P.setInk({ tool: 'pen', color: c, width: (S.ink && S.ink.width) || 2.25 })) })])
      ];
    },
    design: () => {
      const themeThumb = (b, def) => { const d = h('div', { class: 'theme-th' }); const th = P.makeTheme(def); const fakeDeck = P.newDeck(def.name); const s = P.newSlide('title', fakeDeck); s.elements[0].paras = [P.para(def.name)]; d.append(P.thumb(s, 104, { deck: fakeDeck, index: 0 })); b.append(d); b.title = def.name; void th; };
      const ThemeItems = P.themes.map(def => ({ name: def.name, def, fn: () => { P.applyTheme(def.name); P.commit('Apply theme', { all: true }); P.refreshPanes && P.refreshPanes(); } }));
      return [
        grp('Themes', [gallery(ThemeItems, themeThumb, { class: 'theme-gal', rowH: 66, isOn: it => P.deck.theme.def === it.name, foot: [{ label: 'Browse for Themes…', icon: 'folder', fn: () => P.openTheme() }] })]),
        grp('Variants', [gallery(P.colorVariants.map(([n, c]) => ({ name: n, c })), (b, it) => { const d = h('div', { class: 'var-th' }); [c1 => c1.lt1, c1 => c1.accent1, c1 => c1.accent2, c1 => c1.accent3, c1 => c1.accent4, c1 => c1.dk2].forEach(f => { const s = h('span'); s.style.background = f(it.c); d.append(s); }); b.append(d); b.title = it.name + ' colors'; }, { class: 'var-gal', rowH: 34, pick: it => { P.deck.theme.colors = P.clone(it.c); P.commit('Theme colors', { all: true }); }, foot: [{ label: 'Colors', icon: 'color', sub: () => P.colorVariants.map(([n, c]) => ({ label: n, icon: `<span class="grad-s" style="background:linear-gradient(90deg,${c.accent1},${c.accent2},${c.accent3},${c.accent4})"></span>`, fn: () => { P.deck.theme.colors = P.clone(c); P.commit('Theme colors', { all: true }); } })).concat(['-', { label: 'Customize Colors…', fn: customizeColors }]) }, { label: 'Fonts', icon: 'fonts', sub: () => P.fontPairs.map(([a, b]) => ({ label: `${a} / ${b}`, fn: () => { P.deck.theme.fonts = { major: a, minor: b }; P.commit('Theme fonts', { all: true }); } })) }, { label: 'Background Styles', icon: 'background', sub: () => bgStyles() }] })]),
        grp('Customize', [lg('Slide\nSize', 'slidesize', null, { dd: () => [{ label: 'Standard (4:3)', fn: () => P.setSlideSize(720, 540) }, { label: 'Widescreen (16:9)', fn: () => P.setSlideSize(960, 540) }, '-', { label: 'Custom Slide Size…', fn: slideSizeDialog }] }), lg('Format\nBackground', 'background', () => P.openPane('background'))])
      ];
    },
    transitions: () => {
      const glyph = (b, t) => { b.innerHTML = `<span class="tr-g">${trIcon(t[0])}</span><span class="tr-l">${t[1]}</span>`; b.title = t[1]; };
      const cur = () => (P.page() && P.page().transition) || null;
      const apply = id => { P.targetSlides().forEach(s => { const m = P.transitionMeta(id); s.transition = Object.assign({}, s.transition, { type: id, dur: (s.transition && s.transition.dur) || trDefault(id), dir: m && m[2] ? P.transDirs[m[2]][0][0] : undefined }); if (id === 'none') { s.transition.dir = undefined; s.transition.dur = undefined; } }); P.commit('Transition', { all: true }); P.previewSlide('transition'); };
      const all = P.transitionList.flatMap(g => g[1]);
      return [
        grp('Preview', [lg('Preview', 'preview', () => P.previewSlide('both'))]),
        grp('Transition to This Slide', [gallery(all.map(t => ({ t, name: t[1] })), (b, it) => glyph(b, it.t), { class: 'tr-gal', rowH: 62, isOn: it => { const c = cur(); return (c ? c.type : 'none') === it.t[0]; }, pick: it => apply(it.t[0]), groups: P.transitionList.map(([n, list]) => [n, list.map(t => ({ t, name: t[1] }))]) }), lg('Effect\nOptions', 'effectopts', null, { dd: () => { const c = cur(); const m = c && P.transitionMeta(c.type); if (!m || !m[2]) return [{ label: 'No options for this transition', disabled: true }]; return P.transDirs[m[2]].map(([v, n]) => ({ label: n, check: c.dir === v, fn: () => { P.targetSlides().forEach(s => { if (s.transition) s.transition.dir = v; }); P.commit('Effect options'); P.previewSlide('transition'); } })); } })]),
        grp('Timing', [col(num('Duration:', () => { const c = cur(); return c && c.dur ? c.dur / 1000 : 0.7; }, v => { P.targetSlides().forEach(s => { s.transition = s.transition || { type: 'none' }; s.transition.dur = v * 1000; }); P.commit('Transition duration', { silent: false }); }, { step: .25, min: .01, unit: ' s' }), sm('Apply To All', 'applyall', () => { const c = cur(); P.deck.slides.forEach(s => { s.transition = c ? P.clone(c) : null; }); P.commit('Apply to all', { all: true }); P.toast('Transition applied to all slides.'); })),
          col(h('div', { class: 'rb-lbl', text: 'Advance Slide' }), chk('On Mouse Click', () => { const c = cur(); return !c || c.advClick !== false; }, v => { P.targetSlides().forEach(s => { s.transition = s.transition || { type: 'none' }; s.transition.advClick = v; }); P.commit('Advance'); }), row(chk('After:', () => { const c = cur(); return c && c.advAfter != null; }, v => { P.targetSlides().forEach(s => { s.transition = s.transition || { type: 'none' }; s.transition.advAfter = v ? (s.transition.advAfter || 5000) : undefined; }); P.commit('Advance'); P.updateRibbon(); }), num('', () => { const c = cur(); return c && c.advAfter != null ? c.advAfter / 1000 : 0; }, v => { P.targetSlides().forEach(s => { s.transition = s.transition || { type: 'none' }; s.transition.advAfter = v * 1000; }); P.commit('Advance'); }, { step: 1, min: 0, unit: ' s' })))])
      ];
    },
    animations: () => {
      const allFx = c => P.animList[c].map(a => ({ a, c, name: a[1] }));
      const glyph = (b, it) => { b.innerHTML = `<span class="an-g ${it.c}">★</span><span class="tr-l">${it.a[1]}</span>`; b.title = it.a[1]; };
      const curAnim = () => { const sl = P.page(); if (!sl || sl.kind) return null; const id = S.sel[0]; return (sl.animations || []).find(a => a.el === id) || null; };
      const canAnim = () => S.sel.length > 0;
      const addAnim = (id, replace) => {
        const sl = P.page(); if (!S.sel.length) { P.toast('Select an object to animate.'); return; } const m = P.animMeta(id);
        P.selected().forEach(el => {
          if (replace) sl.animations = (sl.animations || []).filter(a => a.el !== el.id);
          (sl.animations = sl.animations || []).push({ id: P.uid('a'), el: el.id, effect: id, start: 'click', delay: 0, dur: P.animDefaultDur(id), dir: m.dirs ? P.animDirs[m.dirs][0][0] : undefined, by: el.paras && el.paras.length > 1 && el.ph ? 'para' : undefined });
        });
        P.commit('Add animation'); P.previewSlide('anim');
      };
      P.addAnimation = addAnim;
      const groups = [['Entrance', allFx('entr')], ['Emphasis', allFx('emph')], ['Exit', allFx('exit')], ['Motion Paths', allFx('path')]];
      const allItems = groups.flatMap(g => g[1]);
      const none = { a: ['none', 'None'], c: 'none', name: 'None', fn: () => { const sl = P.page(); sl.animations = (sl.animations || []).filter(a => !S.sel.includes(a.el)); P.commit('Remove animation'); } };
      const setCur = (k, v) => { const sl = P.page(); (sl.animations || []).forEach(a => { if (S.sel.includes(a.el) || S.sel.includes(a.id)) a[k] = v; }); P.commit('Animation timing', { }); };
      return [
        grp('Preview', [lg('Preview', 'preview', () => P.previewSlide('anim'))]),
        grp('Animation', [gallery([none, ...allItems], glyph, { class: 'tr-gal an-gal', rowH: 62, isOn: it => { const a = curAnim(); return a ? a.effect === it.a[0] : false; }, pick: it => addAnim(it.a[0], true), groups: [['None', [none]], ...groups] }), lg('Effect\nOptions', 'effectopts', null, { dd: () => { const a = curAnim(); if (!a) return [{ label: 'Select an animated object', disabled: true }]; const m = P.animMeta(a.effect); const list = []; if (m && m.dirs) P.animDirs[m.dirs].forEach(([v, n]) => list.push({ label: n, check: a.dir === v, fn: () => { setCur('dir', v); P.previewSlide('anim'); } })); const el = P.findEl(a.el); if (el && el.paras && el.paras.length > 0) { list.push('-', { head: 'Sequence' }, { label: 'As One Object', check: a.by !== 'para', fn: () => setCur('by', undefined) }, { label: 'By Paragraph', check: a.by === 'para', fn: () => setCur('by', 'para') }); } return list.length ? list : [{ label: 'No options', disabled: true }]; } })], () => P.openPane('anim')),
        grp('Advanced Animation', [lg('Add\nAnimation', 'addanim', null, { dd: () => { const box = h('div', { class: 'gal-full tr-gal an-gal' }); groups.forEach(([t, list]) => { box.append(h('div', { class: 'menu-head', text: t })); const g = h('div', { class: 'gal-full-g' }); list.forEach(it => { const b = h('button', { class: 'rb-gal-i' }); glyph(b, it); b.onclick = () => { P.closePopup(); addAnim(it.a[0], false); }; g.append(b); }); box.append(g); }); return box; } }), col(sm('Animation Pane', 'animpane', () => P.openPane('anim'), { on: () => P.paneOpen && P.paneOpen() === 'anim' }), sm('Animation Painter', 'painter', () => { const a = curAnim(); if (!a) return; S.animPainter = a; P.toast('Click another object to give it this animation.'); }))]),
        grp('Timing', [col(row(h('span', { class: 'rb-lbl', text: 'Start:' }), (() => { const s = P.select([['click', 'On Click'], ['with', 'With Previous'], ['after', 'After Previous']], 'click', v => setCur('start', v)); reg(s, { upd: () => { const a = curAnim(); s.value = a ? a.start : 'click'; s.disabled = !a; } }); return s; })()), num('Duration:', () => { const a = curAnim(); return a ? a.dur / 1000 : null; }, v => setCur('dur', v * 1000), { step: .25, min: .01, unit: ' s' }), num('Delay:', () => { const a = curAnim(); return a ? (a.delay || 0) / 1000 : null; }, v => setCur('delay', v * 1000), { step: .25, min: 0, unit: ' s' })),
          col(h('div', { class: 'rb-lbl', text: 'Reorder Animation' }), sm('Move Earlier', 'up', () => moveAnim(-1)), sm('Move Later', 'down', () => moveAnim(1)))])
      ];
      function moveAnim(d) { const sl = P.page(); const a = curAnim(); if (!a) return; const i = sl.animations.indexOf(a), j = i + d; if (j < 0 || j >= sl.animations.length) return; sl.animations.splice(i, 1); sl.animations.splice(j, 0, a); P.commit('Reorder animation'); }
      void canAnim;
    },
    show: () => [
      grp('Start Slide Show', [lg('From\nBeginning', 'play', () => P.startShow(0), { tip: 'From Beginning (F5)' }), lg('From\nCurrent Slide', 'playcur', () => P.startShow(S.cur), { tip: 'From Current Slide (Shift+F5)' }), lg('Custom Slide\nShow', 'custom', null, { dd: () => (P.deck.customShows || []).map(c => ({ label: c.name, fn: () => P.startShow(0, { customIds: c.slideIds }) })).concat((P.deck.customShows || []).length ? ['-'] : [], [{ label: 'Custom Shows…', fn: customShowsDialog }]) })]),
      grp('Set Up', [lg('Set Up\nSlide Show', 'setup', setupDialog), lg('Hide\nSlide', 'hide', () => P.hideSlides(), { on: () => { const p = P.page(); return p && p.hidden; } }), lg('Rehearse\nTimings', 'rehearse', () => P.startShow(0, { rehearse: true })), col(chk('Use Timings', () => P.deck.showCfg.useTimings !== false, v => { P.deck.showCfg.useTimings = v; P.commit('Use timings', { silent: true }); }))]),
      grp('Monitors', [col(chk('Use Presenter View', () => P.deck.showCfg.presenterView !== false, v => { P.deck.showCfg.presenterView = v; P.commit('Presenter view', { silent: true }); }), sm('Presenter View Now', 'presenter', () => P.startShow(S.cur, { presenter: true })))])
    ],
    review: () => [
      grp('Proofing', [lg('Spelling', 'spell', () => P.spellHint()), lg('Word\nCount', 'number', () => P.wordCount())]),
      grp('Accessibility', [lg('Check\nAccessibility', 'access', () => P.accessibilityCheck())]),
      grp('Comments', [lg('New\nComment', 'newcomment', () => P.addComment()), lg('Delete', 'delcomment', () => P.deleteComment()), col(sm('Previous', 'prev', () => P.stepComment(-1)), sm('Next', 'next', () => P.stepComment(1))), lg('Show\nComments', 'comment', () => { S.showComments = !S.showComments; P.openPane(S.showComments ? 'comments' : null); P.drawOverlay(); }, { on: () => !!S.showComments })]),
      grp('Ink', [lg('Hide\nInk', 'eyeoff', () => { P.walk(P.page().elements, el => { if (el.geom === 'custom' && /^Ink/.test(el.name || '')) el.hidden = !el.hidden; }); P.commit('Hide ink'); })])
    ],
    view: () => [
      grp('Presentation Views', [lg('Normal', 'normal', () => P.setView('normal'), { on: () => S.view === 'normal' && !S.outline }), lg('Outline\nView', 'outline', () => P.setView('outline'), { on: () => S.outline }), lg('Slide\nSorter', 'sorter', () => P.setView('sorter'), { on: () => S.view === 'sorter' }), lg('Notes\nPage', 'notespage', () => P.setView('notes'), { on: () => S.view === 'notes' }), lg('Reading\nView', 'reading', () => P.startShow(S.cur, { noFullscreen: true, reading: true }))]),
      grp('Master Views', [lg('Slide\nMaster', 'master', () => P.setView('master'), { on: () => S.view === 'master' })]),
      grp('Show', [col(chk('Ruler', () => S.ruler, () => P.toggleView('ruler')), chk('Gridlines', () => S.grid, () => P.toggleView('grid')), chk('Guides', () => S.guides, () => P.toggleView('guides'))), col(chk('Snap to Grid', () => S.snap, v => { S.snap = v; }), sm('Notes', 'notes', () => P.toggleView('notes'), { on: () => S.showNotes }))]),
      grp('Zoom', [lg('Zoom', 'zoom', zoomDialog), lg('Fit to\nWindow', 'fit', () => P.setZoom(null))]),
      grp('Color/Grayscale', [col(sm('Color', 'color', () => { S.grayscale = false; P.renderCanvas(); }, { on: () => !S.grayscale }), sm('Grayscale', 'gray', () => { S.grayscale = true; P.renderCanvas(); }, { on: () => S.grayscale }))])
    ],
    /* contextual */
    shape: () => [
      grp('Insert Shapes', [lg('Shapes', 'shapes', null, { dd: () => P.shapesMenu(insertShape) }), col(sm('Edit Shape', 'change', null, { dd: () => [{ label: 'Change Shape', sub: () => P.shapesMenu(dropApply) }] }), sm('Text Box', 'textbox', () => P.beginInsert('textbox')))]),
      grp('Shape Styles', [stylesGallery(), col(colorSm('Shape Fill', 'fill', fillCur, setFill, fillMenu), colorSm('Shape Outline', 'outline', lineCur, setLine, lineMenu), sm('Shape Effects', 'effects', null, { dd: effectsMenu }))], () => P.openPane('format')),
      grp('WordArt Styles', [gallery(P.WORDART, (b, st) => { const d = h('span', { class: 'wa-th', text: 'A' }); Object.assign(d.style, P.runCss(st.r, { size: 22, font: '+mj', color: 'tx1' }, 1, { deck: P.deck })); b.append(d); b.title = st.name; }, { class: 'wa-gal', rowH: 42, pick: st => P.applyWordArt(st) }), col(colorSm('Text Fill', 'fontcolor', tfCur, c => P.fmtRun({ color: c, tfill: c === 'none' ? { type: 'none' } : undefined }, 'Text fill'), () => P.colorPalette(c => P.fmtRun({ color: c === 'none' ? undefined : c, tfill: c === 'none' ? { type: 'none' } : undefined }, 'Text fill'), { none: 'No Fill' })), colorSm('Text Outline', 'outline', toCur, c => P.fmtRun({ outline: c === 'none' ? undefined : { color: c, w: 1 } }, 'Text outline'), () => P.colorPalette(c => P.fmtRun({ outline: c === 'none' ? undefined : { color: c, w: 1 } }, 'Text outline'), { none: 'No Outline' })), sm('Text Effects', 'effects', null, { dd: () => [{ label: 'Shadow', fn: () => P.fmtRun({ shadow: { color: '#000000', dist: 2, dir: 45, blur: 3, opacity: .5 } }, 'Text shadow') }, { label: 'Glow', fn: () => P.fmtRun({ glow: { color: 'accent1', rad: 8 } }, 'Text glow') }, { label: 'Clear', fn: () => P.fmtRun({ shadow: undefined, glow: undefined }, 'Clear text effects') }] }))]),
      grp('Accessibility', [lg('Alt\nText', 'alt', () => P.altTextDialog())]),
      arrangeGroup(), sizeGroup()
    ],
    picture: () => {
      const adj = (k, v) => forShapes(el => { if (el.type !== 'image') return; el.adjust = el.adjust || {}; if (v === null) delete el.adjust[k]; else el.adjust[k] = v; }, 'Adjust picture');
      const corrections = () => { const box = h('div', { class: 'fx-grid pics' }); const pick = (lbl, set) => { const b = h('button', { class: 'fx-i', title: lbl, text: lbl }); b.onclick = () => { P.closePopup(); forShapes(el => { if (el.type === 'image') el.adjust = Object.assign({}, el.adjust, set); }, 'Corrections'); }; box.append(b); }; [-40, -20, 0, 20, 40].forEach(br => [-40, 0, 40].forEach(ct => pick(`Brightness ${br > 0 ? '+' : ''}${br}%, Contrast ${ct > 0 ? '+' : ''}${ct}%`, { bright: br, contrast: ct }))); return box; };
      return [
        grp('Adjust', [lg('Remove\nBackground', 'removebg', () => P.removeBackground()), lg('Corrections', 'corrections', null, { dd: corrections }), lg('Color', 'color', null, { dd: () => [{ head: 'Color Saturation' }, ...[0, 33, 66, 100, 133, 200, 300].map(v => ({ label: v + '%', fn: () => adj('sat', v) })), { head: 'Recolor' }, { label: 'No Recolor', fn: () => forShapes(el => { if (el.adjust) ['gray', 'sepia', 'invert', 'hue'].forEach(k => delete el.adjust[k]); }, 'Recolor') }, { label: 'Grayscale', fn: () => adj('gray', true) }, { label: 'Sepia', fn: () => adj('sepia', true) }, { label: 'Negative', fn: () => adj('invert', true) }, ...[60, 120, 180, 240, 300].map(v => ({ label: `Hue shift ${v}°`, fn: () => adj('hue', v) }))] }), lg('Artistic\nEffects', 'effects', null, { dd: () => [{ label: 'None', fn: () => adj('blur', null) }, ...[1, 2, 4, 8].map(v => ({ label: `Blur ${v}`, fn: () => adj('blur', v) }))] }), lg('Transparency', 'transparency', null, { dd: () => [0, 15, 30, 50, 65, 80, 95].map(v => ({ label: `Transparency: ${v}%`, fn: () => adj('opacity', 1 - v / 100) })) }), col(sm('Compress', 'compress', () => P.compressPictures()), sm('Change', 'change', () => P.changePicture()), sm('Reset', 'reset', () => forShapes(el => { if (el.type === 'image') { delete el.adjust; delete el.crop; delete el.fx; delete el.line; delete el.geom; } }, 'Reset picture')))]),
        grp('Picture Styles', [gallery(PICSTYLES, (b, st) => { const d = h('div', { class: 'pic-th' }); if (st.line) d.style.border = `${Math.min(st.line.width, 3)}px solid ${P.color(st.line.color)}`; if (st.fx && st.fx.shadow) d.style.boxShadow = '2px 2px 5px rgba(0,0,0,.5)'; if (st.geom === 'ellipse') d.style.borderRadius = '50%'; if (st.geom === 'roundRect') d.style.borderRadius = '6px'; b.append(d); b.title = st.name; }, { class: 'pic-gal', rowH: 54, pick: st => forShapes(el => { if (el.type !== 'image') return; el.geom = st.geom || undefined; el.line = st.line ? P.clone(st.line) : undefined; el.fx = st.fx ? P.clone(st.fx) : undefined; el.rot = st.rot || el.rot; }, 'Picture style') }), col(colorSm('Picture Border', 'border', lineCur, setLine, lineMenu), sm('Picture Effects', 'effects', null, { dd: effectsMenu }))], () => P.openPane('format')),
        grp('Accessibility', [lg('Alt\nText', 'alt', () => P.altTextDialog())]),
        arrangeGroup(),
        grp('Size', [lg('Crop', 'crop', () => P.startCrop(), { dd: null }), col(sm('Crop to Shape', 'shapes', null, { dd: () => P.shapesMenu(n => forShapes(el => { if (el.type === 'image') el.geom = n; }, 'Crop to shape')) }), sm('Aspect Ratio', 'slidesize', null, { dd: () => [['1:1', 1], ['4:3', 4 / 3], ['16:9', 16 / 9], ['3:2', 1.5], ['3:4', .75], ['9:16', 9 / 16]].map(([n, r]) => ({ label: n, fn: () => P.cropAspect(r) })) })), sizeControls()], () => P.openPane('format', 'size'))
      ];
    },
    tableDesign: () => {
      const t = () => { const c = P.curTable(); return c && c.el.tbl; };
      const opt = (k, n) => chk(n, () => { const x = t(); return x && x.opts && x.opts[k]; }, v => { const x = t(); if (x) { x.opts = Object.assign({}, x.opts, { [k]: v }); commitKeep('Table options'); } });
      const styleKeys = Object.keys(P.tableStyles);
      const miniTable = (b, it) => { const d = h('div', { class: 'tb-th' }); const fake = { style: it.k, opts: { hdr: true, bandR: true }, rows: new Array(4), cols: new Array(4) }; for (let r = 0; r < 4; r++) { const tr = h('div', { class: 'tb-r' }); for (let c = 0; c < 4; c++) { const st = P.cellStyle(fake, r, c), cell = h('span'); if (st.fill) cell.style.background = P.color(st.fill); if (st.border) cell.style.outline = `.5px solid ${P.color(st.border)}`; if (st.bBottom) cell.style.borderBottom = `1px solid ${P.color(st.bBottom)}`; if (st.bTop) cell.style.borderTop = `1px solid ${P.color(st.bTop)}`; tr.append(cell); } d.append(tr); } b.append(d); b.title = P.tableStyles[it.k].name; };
      return [
        grp('Table Style Options', [col(opt('hdr', 'Header Row'), opt('total', 'Total Row'), opt('bandR', 'Banded Rows')), col(opt('firstCol', 'First Column'), opt('lastCol', 'Last Column'), opt('bandC', 'Banded Columns'))]),
        grp('Table Styles', [gallery(styleKeys.map(k => ({ k, name: P.tableStyles[k].name })), miniTable, { class: 'tb-gal', rowH: 44, isOn: it => { const x = t(); return x && x.style === it.k; }, pick: it => { const x = t(); if (x) { x.style = it.k; commitKeep('Table style'); } } }), col(sm('Shading', 'fill', null, { dd: () => P.colorPalette(c => P.cellsTarget(x => { x.fill = c === 'none' ? { type: 'none' } : { type: 'solid', color: c }; }), { none: 'No Fill' }) }), sm('Borders', 'border', null, { dd: bordersMenu }))]),
        grp('WordArt Styles', [col(colorSm('Text Fill', 'fontcolor', tfCur, c => P.fmtRun({ color: c }, 'Text fill'), () => P.colorPalette(c => P.fmtRun({ color: c }, 'Text fill'))))]),
        grp('Accessibility', [lg('Alt\nText', 'alt', () => P.altTextDialog())])
      ];
    },
    tableLayout: () => {
      const t = () => { const c = P.curTable(); return c && c; };
      return [
        grp('Rows & Columns', [lg('Delete', 'delcell', null, { dd: () => [{ label: 'Delete Columns', fn: () => P.tableOp('delCol') }, { label: 'Delete Rows', fn: () => P.tableOp('delRow') }, { label: 'Delete Table', fn: () => P.tableOp('delTable') }] }), lg('Insert\nAbove', 'rowAbove', () => P.tableOp('rowAbove')), lg('Insert\nBelow', 'rowBelow', () => P.tableOp('rowBelow')), lg('Insert\nLeft', 'colLeft', () => P.tableOp('colLeft')), lg('Insert\nRight', 'colRight', () => P.tableOp('colRight'))]),
        grp('Merge', [lg('Merge\nCells', 'merge', () => P.tableOp('merge')), lg('Split\nCells', 'split', () => P.tableOp('split'))]),
        grp('Cell Size', [col(num('Height:', () => { const c = t(); return c && c.el.tbl.rows[c.cell.r] ? c.el.tbl.rows[c.cell.r].h : null; }, v => { const c = t(); if (c) { c.el.tbl.rows[c.cell.r].h = v; c.el.h = c.el.tbl.rows.reduce((a, r) => a + r.h, 0); commitKeep('Row height'); } }, { step: 2, min: 8, unit: ' pt' }), num('Width:', () => { const c = t(); return c && c.el.tbl.cols[c.cell.c] != null ? c.el.tbl.cols[c.cell.c] : null; }, v => { const c = t(); if (c) { c.el.tbl.cols[c.cell.c] = v; c.el.w = c.el.tbl.cols.reduce((a, r) => a + r, 0); commitKeep('Column width'); } }, { step: 4, min: 8, unit: ' pt' })), col(sm('Distribute Rows', 'distR', () => P.tableOp('distR')), sm('Distribute Columns', 'distC', () => P.tableOp('distC')))]),
        grp('Alignment', [col(row(...[['l', 'alignL'], ['ctr', 'alignC'], ['r', 'alignR']].map(([v, n]) => ic(n, 'Align ' + v, () => P.fmtPara({ align: v }, 'Align')))), row(...[['t', 'Top'], ['ctr', 'Middle'], ['b', 'Bottom']].map(([v, n]) => sm(n, null, () => P.cellsTarget(x => { x.anchor = v; })))))]),
        arrangeGroup(), sizeGroup()
      ];
    },
    chart: () => {
      const ch = () => { const e = P.selected().find(x => x.type === 'chart'); return e && e.chart; };
      const up = fn => { const c = ch(); if (c) { fn(c); P.commit('Edit chart'); } };
      return [
        grp('Chart Layouts', [lg('Add Chart\nElement', 'addelem', null, { dd: () => [{ label: 'Chart Title', check: ch() && ch().showTitle !== false, fn: () => up(c => { c.showTitle = c.showTitle === false; }) }, { label: 'Edit Chart Title…', fn: () => { const c = ch(); P.prompt('Chart Title', 'Title:', c.title, v => up(x => { x.title = v; x.showTitle = true; })); } }, { label: 'Data Labels', check: ch() && ch().labels, fn: () => up(c => { c.labels = !c.labels; }) }, { label: 'Gridlines', check: ch() && ch().grid !== false, fn: () => up(c => { c.grid = c.grid === false; }) }, { label: 'Legend', sub: () => [['None', 'none'], ['Right', 'r'], ['Top', 't'], ['Left', 'l'], ['Bottom', 'b']].map(([n, v]) => ({ label: n, check: ch() && ch().legend === v, fn: () => up(c => { c.legend = v; }) })) }] })]),
        grp('Chart Styles', [lg('Change\nColors', 'color', null, { dd: () => [{ label: 'Colorful (accents)', fn: () => up(c => c.series.forEach(s => { delete s.color; delete s.pointColors; })) }, ...[1, 2, 3, 4, 5, 6].map(i => ({ label: `Monochromatic Accent ${i}`, fn: () => up(c => c.series.forEach((s, j) => { s.color = `accent${i}:${100 - j * 20 > 40 ? 100 - j * 20 : 40},${j * 20}`; delete s.pointColors; })) }))] })]),
        grp('Data', [lg('Edit\nData', 'chartdata', () => { const e = P.selected().find(x => x.type === 'chart'); if (e) P.chartDataDialog(e); }), lg('Switch\nRow/Col', 'switchrc', () => up(c => { const cats = c.series.map(s => s.name), ser = c.cats.map((n, i) => ({ name: String(n), values: c.series.map(s => s.values[i] || 0) })); c.cats = cats; c.series = ser; }))]),
        grp('Type', [lg('Change\nChart Type', 'charttype', null, { dd: () => P.chartKinds.map(([k, n]) => ({ label: n, fn: () => P.setChartKind(k) })) })]),
        grp('Accessibility', [lg('Alt\nText', 'alt', () => P.altTextDialog())]), arrangeGroup(), sizeGroup()
      ];
    },
    media: () => {
      const el = () => P.selected().find(x => x.type === 'video' || x.type === 'audio');
      const m = (k, v) => { const e = el(); if (e) { e.media = Object.assign({}, e.media, { [k]: v }); P.commit('Media options'); } };
      return [
        grp('Preview', [lg('Play', 'play', () => { const e = el(); if (!e) return; const a = document.createElement(e.type); a.src = P.mediaUrl(e.src); a.controls = true; a.autoplay = true; a.style.width = '100%'; P.modal({ title: e.name || 'Preview', width: 640, body: a, buttons: [['Close', () => { a.pause(); return true; }]] }); })]),
        grp('Video Styles', [lg('Poster\nFrame', 'picture', async () => { const e = el(); if (!e) return; const f = await P.pickFile('image/*'); if (f[0]) { e.poster = 'media:' + P.addMedia(f[0], f[0].name); P.commit('Poster frame'); } })]),
        grp('Audio/Video Options', [col(row(h('span', { class: 'rb-lbl', text: 'Volume:' }), (() => { const s = P.select([['1', 'High'], ['.6', 'Medium'], ['.3', 'Low'], ['0', 'Mute']], '1', v => m('vol', +v)); reg(s, { upd: () => { const e = el(); if (e) s.value = String(e.media && e.media.vol != null ? e.media.vol : 1).replace('0.', '.'); } }); return s; })()), row(h('span', { class: 'rb-lbl', text: 'Start:' }), (() => { const s = P.select([['click', 'On Click'], ['auto', 'Automatically']], 'click', v => m('auto', v === 'auto')); reg(s, { upd: () => { const e = el(); s.value = e && e.media && e.media.auto ? 'auto' : 'click'; } }); return s; })())), col(chk('Loop until Stopped', () => { const e = el(); return e && e.media && e.media.loop; }, v => m('loop', v)), chk('Hide During Show', () => { const e = el(); return e && e.media && e.media.hide; }, v => m('hide', v)))]),
        arrangeGroup(), sizeGroup()
      ];
    },
    master: () => [
      grp('Edit Master', [lg('Insert\nLayout', 'newslide', () => P.addLayout()), col(sm('Delete', 'trash', () => P.deleteLayout()), sm('Rename', 'textbox', () => P.renameLayout()))]),
      grp('Master Layout', [lg('Insert\nPlaceholder', 'layout', null, { dd: () => [['Content', 'obj'], ['Text', 'body'], ['Picture', 'pic']].map(([n, t]) => ({ label: n, fn: () => P.addPlaceholder(t) })) })]),
      grp('Edit Theme', [lg('Themes', 'themes', null, { dd: () => P.themes.map(def => ({ label: def.name, check: P.deck.theme.def === def.name, fn: () => { P.applyTheme(def.name); P.S.master = null; P.commit('Apply theme', { all: true }); } })) }), col(sm('Colors', 'color', null, { dd: () => P.colorVariants.map(([n, c]) => ({ label: n, fn: () => { P.deck.theme.colors = P.clone(c); P.commit('Theme colors', { all: true }); } })) }), sm('Fonts', 'fonts', null, { dd: () => P.fontPairs.map(([a, b]) => ({ label: `${a} / ${b}`, fn: () => { P.deck.theme.fonts = { major: a, minor: b }; P.commit('Theme fonts', { all: true }); } })) }))]),
      grp('Background', [lg('Format\nBackground', 'background', () => P.openPane('background')), col(chk('Hide Background Graphics', () => { const pg = P.page(); return pg && pg.showMaster === false; }, v => { const pg = P.page(); if (pg && pg.kind === 'layout') { pg.showMaster = v ? false : undefined; P.commit('Background graphics', { all: true }); } }))]),
      grp('Size', [lg('Slide\nSize', 'slidesize', slideSizeDialog)]),
      grp('Close', [lg('Close\nMaster View', 'close', () => P.setView('normal'))])
    ]
  };
  /* helpers needing outside references */
  const commitKeep = label => { const a = P.T.active; const keep = a ? { id: a.id, cell: a.cell } : null; if (a) P.T.end(true); P.commit(label); if (keep) P.T.begin(keep.id, { cell: keep.cell }); };
  const PICSTYLES = [{ name: 'Simple Frame', line: { type: 'solid', color: '#FFFFFF', width: 6 }, fx: { shadow: { color: '#000000', blur: 6, dist: 3, dir: 45, opacity: .4 } } }, { name: 'Beveled Oval', geom: 'ellipse', line: { type: 'solid', color: 'tx1:65,35', width: 3 } }, { name: 'Metal Frame', line: { type: 'solid', color: '#B0B0B0', width: 6 } }, { name: 'Drop Shadow', fx: { shadow: { color: '#000000', blur: 12, dist: 6, dir: 45, opacity: .5 } } }, { name: 'Reflected', fx: { reflect: { size: 40, dist: 2, opacity: .4 } } }, { name: 'Soft Edge', fx: { soft: { rad: 10 } } }, { name: 'Rounded', geom: 'roundRect', fx: { shadow: { color: '#000000', blur: 6, dist: 2, dir: 90, opacity: .35 } } }, { name: 'Thick Black', line: { type: 'solid', color: '#000000', width: 6 } }, { name: 'Compound', line: { type: 'solid', color: 'accent1', width: 3 } }, { name: 'Perspective', fx: { rot3d: { x: 0, y: -30, persp: 800 }, shadow: { color: '#000000', blur: 12, dist: 8, dir: 90, opacity: .3 } } }, { name: 'Plain', }];
  const bordersMenu = () => {
    const set = (sides, val) => P.cellsTarget(x => { x.borders = x.borders || {}; sides.forEach(s => { x.borders[s] = val; }); });
    const v = { type: 'solid', color: 'tx1', width: 1 };
    const inner = [{ label: 'No Border', icon: 'border', fn: () => set(['l', 'r', 't', 'b'], { type: 'none' }) }, { label: 'All Borders', icon: 'table', fn: () => set(['l', 'r', 't', 'b'], v) }, { label: 'Bottom Border', fn: () => set(['b'], v) }, { label: 'Top Border', fn: () => set(['t'], v) }, { label: 'Left Border', fn: () => set(['l'], v) }, { label: 'Right Border', fn: () => set(['r'], v) }];
    return inner;
  };
  const wordArtPicker = fn => { const box = h('div', { class: 'gal-full-g wa-gal' }); P.WORDART.forEach(st => { const b = h('button', { class: 'rb-gal-i', title: st.name }); const d = h('span', { class: 'wa-th', text: 'A' }); Object.assign(d.style, P.runCss(st.r, { size: 30, font: '+mj', color: 'tx1' }, 1, { deck: P.deck })); b.append(d); b.onclick = () => { P.closePopup(); fn(st); }; box.append(b); }); return box; };
  const arrangeGroup = () => grp('Arrange', [col(sm('Bring Forward', 'bringfwd', () => P.zorder('forward'), { dd: null }), sm('Send Backward', 'sendback', () => P.zorder('backward')), sm('Selection Pane', 'selection', () => P.openPane('selection'))), col(sm('Align', 'align', null, { dd: alignMenu }), sm('Group', 'group', null, { dd: () => [{ label: 'Group', fn: P.groupSelected, disabled: S.sel.length < 2 }, { label: 'Ungroup', fn: P.ungroupSelected }] }), sm('Rotate', 'rotate', null, { dd: rotateMenu }))]);
  const sizeControls = () => col(num(P.icon('slidesize', 14), () => { const e = P.selected()[0]; return e ? P.box(e).h : null; }, v => setDim('h', v), { step: 3.6, min: .1, unit: ' pt' }), num(P.icon('alignJ', 14), () => { const e = P.selected()[0]; return e ? P.box(e).w : null; }, v => setDim('w', v), { step: 3.6, min: .1, unit: ' pt' }));
  const setDim = (k, v) => { P.selected().forEach(e => { const b = P.box(e), ar = b.w / b.h; const n = Object.assign({}, b); n[k] = v; if (e.lockAR || e.type === 'image') { if (k === 'w') n.h = v / ar; else n.w = v * ar; } if (e.type === 'group') P.scaleChildren(e, n.w / b.w, n.h / b.h); if (e.type === 'table') { const sx = n.w / b.w, sy = n.h / b.h; e.tbl.cols = e.tbl.cols.map(c => c * sx); e.tbl.rows.forEach(r => r.h *= sy); } P.setBox(e, n); P.T.fit(e); }); P.commit('Size'); };
  P.setDim = setDim;
  const sizeGroup = () => grp('Size', [sizeControls()], () => P.openPane('format', 'size'));
  const trDefault = id => ({ fade: 700, push: 1000, wipe: 1000, split: 1500, zoom: 1000, flash: 800, dissolve: 1000, cube: 1200, flip: 1200, doors: 1400, gallery: 1600, clock: 1500, wheel: 1500, wedge: 1500, newsflash: 1500, cover: 1000, pull: 1000, randomBar: 1000, blinds: 1400, checker: 1400, circle: 1000, diamond: 1000, plus: 1000 })[id] || 700;
  const trIcon = id => { const f = '<rect x="3" y="3" width="26" height="18" fill="#fff" stroke="#666"/>'; const a = { none: '<path d="M4 4L28 20M28 4L4 20" stroke="#bbb"/>', cut: '<path d="M16 3v18" stroke="#c8452e" stroke-width="1.5"/>', fade: '<rect x="3" y="3" width="26" height="18" fill="url(#gf)"/>', push: '<path d="M6 12h17M18 8l5 4-5 4" stroke="#2b7cd3" stroke-width="2" fill="none"/>', wipe: '<rect x="3" y="3" width="13" height="18" fill="#dbe7f5"/><path d="M16 3v18" stroke="#2b7cd3"/>', split: '<path d="M16 3v18" stroke="#2b7cd3" stroke-dasharray="2"/><path d="M12 12H7M20 12h5" stroke="#2b7cd3" stroke-width="2"/>', pull: '<rect x="3" y="3" width="17" height="18" fill="#dbe7f5"/><path d="M14 12H8" stroke="#2b7cd3" stroke-width="2"/>', cover: '<rect x="12" y="3" width="17" height="18" fill="#dbe7f5"/><path d="M24 12h-7" stroke="#2b7cd3" stroke-width="2"/>', randomBar: '<path d="M3 6h26M3 11h26M3 16h26" stroke="#2b7cd3" stroke-width="2"/>', circle: '<circle cx="16" cy="12" r="6" fill="#dbe7f5" stroke="#2b7cd3"/>', diamond: '<path d="M16 5l8 7-8 7-8-7z" fill="#dbe7f5" stroke="#2b7cd3"/>', plus: '<path d="M13 4h6v5h6v6h-6v5h-6v-5H7V9h6z" fill="#dbe7f5" stroke="#2b7cd3"/>', zoom: '<rect x="11" y="8" width="10" height="8" fill="#dbe7f5" stroke="#2b7cd3"/><path d="M6 5l4 3M26 5l-4 3M6 19l4-3M26 19l-4-3" stroke="#2b7cd3"/>', flash: '<path d="M18 3L11 13h5l-3 8 9-11h-5z" fill="#e8a917"/>', dissolve: '<path d="M7 7h2v2H7zM13 11h2v2h-2zM19 6h2v2h-2zM23 14h2v2h-2zM9 16h2v2H9zM16 17h2v2h-2z" fill="#2b7cd3"/>', blinds: '<path d="M8 3v18M14 3v18M20 3v18M26 3v18" stroke="#2b7cd3" stroke-width="2"/>', checker: '<path d="M5 5h5v5H5zM15 5h5v5h-5zM10 10h5v5h-5zM20 10h5v5h-5zM5 15h5v5H5zM15 15h5v5h-5z" fill="#2b7cd3"/>', clock: '<path d="M16 12V3A9 9 0 0 1 24 16z" fill="#dbe7f5" stroke="#2b7cd3"/>', wheel: '<path d="M16 3v18M6 12h20M9 5l14 14M23 5L9 19" stroke="#2b7cd3"/>', wedge: '<path d="M16 12L9 3h14z" fill="#dbe7f5" stroke="#2b7cd3"/>', newsflash: '<path d="M16 5a7 7 0 1 1-6 3" fill="none" stroke="#2b7cd3" stroke-width="2"/>', cube: '<path d="M8 6l8-3 8 3v12l-8 3-8-3zM16 9v12M8 6l8 3 8-3" fill="none" stroke="#2b7cd3"/>', flip: '<path d="M10 4v16l6 2V2zM22 4v16l-6 2" fill="#dbe7f5" stroke="#2b7cd3"/>', doors: '<path d="M4 3l6 3v12l-6 3zM28 3l-6 3v12l6 3z" fill="#dbe7f5" stroke="#2b7cd3"/>', gallery: '<path d="M4 7l10-3v16L4 17zM28 7l-10-3v16l10-3z" fill="#dbe7f5" stroke="#2b7cd3"/>' }[id] || ''; return `<svg viewBox="0 0 32 24" width="34" height="26"><defs><linearGradient id="gf"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#2b7cd3"/></linearGradient></defs>${f}${a}</svg>`; };
  const customizeColors = () => { const c = P.deck.theme.colors; const nm = { dk1: 'Text/Background - Dark 1', lt1: 'Text/Background - Light 1', dk2: 'Text/Background - Dark 2', lt2: 'Text/Background - Light 2', accent1: 'Accent 1', accent2: 'Accent 2', accent3: 'Accent 3', accent4: 'Accent 4', accent5: 'Accent 5', accent6: 'Accent 6', hlink: 'Hyperlink', folHlink: 'Followed Hyperlink' }; const body = h('div', { class: 'cc' }); const nw = P.clone(c); Object.keys(nm).forEach(k => { const i = h('input', { type: 'color', value: c[k].toLowerCase() }); i.oninput = () => { nw[k] = i.value.toUpperCase(); }; body.append(h('label', { class: 'fld' }, h('span', { text: nm[k] }), i)); }); P.modal({ title: 'Customize Colors', width: 400, body, buttons: [['Save', () => { P.deck.theme.colors = nw; P.commit('Theme colors', { all: true }); return true; }, true], ['Cancel', () => true]] }); };
  const bgStyles = () => { const items = [['bg1', 'Style 1'], ['bg2', 'Style 2'], ['tx2', 'Style 3'], ['tx1', 'Style 4']]; return items.map(([c, n]) => ({ label: n, icon: `<span class="grad-s" style="background:${P.color(c)}"></span>`, fn: () => { P.deck.master.bg = { type: 'solid', color: c }; if (c === 'tx1' || c === 'tx2') { P.deck.theme.map = { bg1: 'dk1', tx1: 'lt1', bg2: 'dk2', tx2: 'lt2' }; P.deck.master.bg = { type: 'solid', color: 'bg1' }; } else { P.deck.theme.map = undefined; } P.commit('Background style', { all: true }); } })); };
  P.setSlideSize = (w, hh, mode) => { P.confirm('You are scaling to a new slide size. Would you like to maximize the size of your content, or ensure it will fit on the new slide?', () => { P.resizeDeck(w, hh, 'fit'); P.commit('Slide size', { all: true }); P.layoutCanvas(); }, { ok: 'Ensure Fit', cancel: 'Maximize', onNo: () => { P.resizeDeck(w, hh, 'max'); P.commit('Slide size', { all: true }); P.layoutCanvas(); } }); void mode; };
  const slideSizeDialog = () => { const D = P.deck.size; let w = D.w / 72, hh = D.h / 72; const wi = P.numInput(w, { step: .1, min: 1, max: 56, unit: ' in', on: v => w = v }), hi = P.numInput(hh, { step: .1, min: 1, max: 56, unit: ' in', on: v => hh = v }); const presets = [['Widescreen', 13.333, 7.5], ['On-screen Show (4:3)', 10, 7.5], ['Letter Paper', 10, 7.5], ['A4 Paper', 10.833, 7.5], ['A3 Paper', 14, 10.5], ['35mm Slides', 11.25, 7.5], ['Banner', 8, 1], ['On-screen Show (16:10)', 10, 6.25]]; const sel = P.select(presets.map(p => [p[0], p[0]]), 'Widescreen', v => { const p = presets.find(x => x[0] === v); w = p[1]; hh = p[2]; wi.setVal(w); hi.setVal(hh); }); P.modal({ title: 'Slide Size', width: 380, body: h('div', {}, P.field('Slides sized for:', sel), P.field('Width:', wi), P.field('Height:', hi)), buttons: [['OK', () => { P.setSlideSize(w * 72, hh * 72); return true; }, true], ['Cancel', () => true]] }); };
  const zoomDialog = () => { const v = h('input', { class: 'field num', type: 'number', min: 10, max: 400, value: Math.round(P.getZoom() * 100) }); const pre = h('div', { class: 'zoom-pre' }); [400, 200, 100, 66, 50, 33].forEach(z => { const b = h('button', { class: 'btn', text: z + '%' }); b.onclick = () => { v.value = z; }; pre.append(b); }); P.modal({ title: 'Zoom', width: 300, body: h('div', {}, pre, P.field('Percent:', v)), buttons: [['OK', () => { P.setZoom(+v.value / 100); return true; }, true], ['Fit', () => { P.setZoom(null); return true; }], ['Cancel', () => true]] }); };
  const setupDialog = () => {
    const c = P.deck.showCfg; const ty = name => h('input', { type: 'radio', name: 'sst', checked: c.type === name });
    const r1 = ty('presenter'), r2 = ty('browsed'), r3 = ty('kiosk'); const loop = h('input', { type: 'checkbox', checked: c.loop }); const all = h('input', { type: 'radio', name: 'ssr', checked: !c.showFrom }), rng = h('input', { type: 'radio', name: 'ssr', checked: !!c.showFrom });
    const f = h('input', { class: 'field num', type: 'number', min: 1, value: c.showFrom || 1 }), t = h('input', { class: 'field num', type: 'number', min: 1, value: c.showTo || P.deck.slides.length }); const man = h('input', { type: 'radio', name: 'ssa', checked: c.useTimings === false }), tim = h('input', { type: 'radio', name: 'ssa', checked: c.useTimings !== false }); const pen = P.colorBtn(c.penColor, x => { c.penColor = x; });
    const lab = (i, s) => h('label', { class: 'chk' }, i, h('span', { text: s }));
    P.modal({ title: 'Set Up Show', width: 520, body: h('div', { class: 'setup' }, h('fieldset', {}, h('legend', { text: 'Show type' }), lab(r1, 'Presented by a speaker (full screen)'), lab(r2, 'Browsed by an individual (window)'), lab(r3, 'Browsed at a kiosk (full screen)')), h('fieldset', {}, h('legend', { text: 'Show options' }), lab(loop, 'Loop continuously until Esc'), P.field('Pen color:', pen)), h('fieldset', {}, h('legend', { text: 'Show slides' }), lab(all, 'All'), h('div', { class: 'rb-row' }, lab(rng, 'From:'), f, h('span', { text: ' To: ' }), t)), h('fieldset', {}, h('legend', { text: 'Advance slides' }), lab(man, 'Manually'), lab(tim, 'Using timings, if present'))), buttons: [['OK', () => { c.type = r2.checked ? 'browsed' : r3.checked ? 'kiosk' : 'presenter'; c.loop = loop.checked || r3.checked; c.showFrom = rng.checked ? +f.value : null; c.showTo = rng.checked ? +t.value : null; c.useTimings = !man.checked; P.commit('Set up show', { silent: true }); return true; }, true], ['Cancel', () => true]] });
  };
  const customShowsDialog = () => {
    const list = h('div', { class: 'cs' }); const paint = () => { list.innerHTML = ''; (P.deck.customShows || []).forEach((c, i) => { const row2 = h('div', { class: 'cs-row' }, h('span', { text: `${c.name} (${c.slideIds.length} slides)` })); const del = h('button', { class: 'btn', text: 'Remove' }); del.onclick = () => { P.deck.customShows.splice(i, 1); paint(); }; const play = h('button', { class: 'btn', text: 'Show' }); play.onclick = () => { dlg.close(); P.startShow(0, { customIds: c.slideIds }); }; row2.append(play, del); list.append(row2); }); };
    const newBtn = h('button', { class: 'btn', text: 'New…' }); newBtn.onclick = () => { const name = h('input', { class: 'field wide', value: 'Custom Show ' + ((P.deck.customShows || []).length + 1) }); const pick = h('div', { class: 'cs-pick' }); const checks = P.deck.slides.map((s, i) => { const cb = h('input', { type: 'checkbox', checked: true }); pick.append(h('label', { class: 'chk' }, cb, h('span', { text: `${i + 1}. ${P.slideTitle(s)}` }))); return { cb, id: s.id }; }); P.modal({ title: 'Define Custom Show', width: 420, body: h('div', {}, P.field('Slide show name:', name), pick), buttons: [['OK', () => { P.deck.customShows = P.deck.customShows || []; P.deck.customShows.push({ name: name.value, slideIds: checks.filter(c => c.cb.checked).map(c => c.id) }); paint(); P.commit('Custom show', { silent: true }); return true; }, true], ['Cancel', () => true]] }); };
    const dlg = P.modal({ title: 'Custom Shows', width: 460, body: h('div', {}, list, newBtn), buttons: [['Close', () => true]] }); paint();
  };

  /* ---------- tab bar ---------- */
  const tabLabel = { file: 'File', home: 'Home', insert: 'Insert', draw: 'Draw', design: 'Design', transitions: 'Transitions', animations: 'Animations', show: 'Slide Show', review: 'Review', view: 'View', master: 'Slide Master' };
  const ctxTabs = () => {
    const sel = P.selected(); const out = [];
    const types = new Set(sel.map(e => e.type || 'shape'));
    if (P.T.active && P.T.active.cell) types.add('table');
    if (types.has('shape') || types.has('group')) out.push(['shape', 'Shape Format']);
    if (types.has('image')) out.push(['picture', 'Picture Format']);
    if (types.has('table')) out.push(['tableDesign', 'Table Design'], ['tableLayout', 'Layout']);
    if (types.has('chart')) out.push(['chart', 'Chart Design']);
    if (types.has('video') || types.has('audio')) out.push(['media', 'Playback']);
    return out;
  };
  P.showTab = t => { if (t === R.cur && !R.force) return; R.cur = t; R.collapsed = false; document.getElementById('ribbon').classList.remove('collapsed'); drawTabs(); drawBody(); };
  const drawTabs = () => {
    bar.innerHTML = '';
    const file = h('button', { class: 'tab file', text: 'File' }); file.onclick = () => P.backstage(); bar.append(file);
    const base = ['home', 'insert', 'draw', 'design', 'transitions', 'animations', 'show', 'review', 'view'];
    if (S.view === 'master') base.unshift('master');
    base.forEach(t => { const b = h('button', { class: 'tab' + (R.cur === t ? ' on' : ''), text: tabLabel[t] }); b.onclick = () => P.showTab(t); bar.append(b); });
    const c = ctxTabs();
    c.forEach(([t, l]) => { const b = h('button', { class: 'tab ctx' + (R.cur === t ? ' on' : ''), text: l }); b.onclick = () => P.showTab(t); bar.append(b); });
    if (!c.some(x => x[0] === R.cur) && !base.includes(R.cur)) { R.cur = 'home'; drawBody(); }
    bar.append(h('div', { class: 'tab-spacer' }));
    const cm = h('button', { class: 'tab-act', html: P.icon('comment', 15) + 'Comments' }); cm.onclick = () => { S.showComments = true; P.openPane('comments'); P.drawOverlay(); }; bar.append(cm);
    const pr = h('button', { class: 'tab-act present', html: P.icon('present', 15) + 'Present' }); pr.onclick = () => P.startShow(S.cur); bar.append(pr);
    const col2 = h('button', { class: 'tab-act icon', title: 'Collapse the Ribbon', html: P.icon('up', 14) }); col2.onclick = () => { R.collapsed = !R.collapsed; document.getElementById('ribbon').classList.toggle('collapsed', R.collapsed); col2.innerHTML = P.icon(R.collapsed ? 'down' : 'up', 14); setTimeout(() => P.layoutCanvas(), 0); }; bar.append(col2);
  };
  const drawBody = () => {
    R.controls = []; body.innerHTML = '';
    const build = TABS[R.cur] || TABS.home;
    body.append(...build().filter(Boolean));
    P.updateRibbon();
  };
  P.updateRibbon = () => {
    R.controls.forEach(({ node, o }) => {
      try { if (o.on) node.classList.toggle('on', !!o.on()); if (o.dis) { const d = !!o.dis(); node.classList.toggle('dis', d); if (node.tagName === 'BUTTON') node.disabled = d; } if (o.upd) o.upd(); } catch (e) { console.warn(e); }
    });
  };
  let lastCtx = '';
  const onSelection = () => {
    const key = ctxTabs().map(x => x[0]).join() + '|' + S.view;
    if (key !== lastCtx) {
      const newCtx = ctxTabs(), prevWasCtx = !['home', 'insert', 'draw', 'design', 'transitions', 'animations', 'show', 'review', 'view', 'master'].includes(R.cur);
      lastCtx = key; drawTabs();
      if (prevWasCtx && !newCtx.some(x => x[0] === R.cur)) { R.cur = S.view === 'master' ? 'master' : 'home'; drawTabs(); drawBody(); return; }
    }
    P.updateRibbon();
  };
  P.initRibbon = () => {
    bar = document.getElementById('tabs'); body = document.getElementById('ribbonBody');
    drawTabs(); drawBody();
    P.on('selection', onSelection); P.on('change', () => { onSelection(); });
    document.addEventListener('selectionchange', () => { if (P.T.active) P.updateRibbon(); });
    P.on('view', () => { if (S.view === 'master') { R.cur = 'master'; } else if (R.cur === 'master') R.cur = 'home'; drawTabs(); drawBody(); });
    P.on('theme', () => { if (R.cur === 'design') drawBody(); });
  };
  P.redrawRibbon = () => { drawTabs(); drawBody(); };
  P.ribbonCur = () => R.cur;
})(window.P);
