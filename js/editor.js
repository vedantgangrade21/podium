/* Podium - canvas editor: selection, move/resize/rotate, smart guides, connectors, arrange, clipboard, keyboard */
(function (P) {
  'use strict';
  const S = P.S;
  let stage, host, overlay, wrap, scale = 1, pgX = 0, pgY = 0;
  const rad = d => d * Math.PI / 180;
  const rotv = (x, y, deg) => { const t = rad(deg), c = Math.cos(t), s = Math.sin(t); return [x * c - y * s, x * s + y * c]; };

  P.selected = () => S.sel.map(id => P.findEl(id)).filter(Boolean);
  P.canvasEl = id => host && host.querySelector(`.pg-els .el[data-id="${id}"]`);
  P.canvasScale = () => scale;

  /* world (page) box of an element, walking up through groups */
  P.worldBox = (el, page = P.page()) => {
    const b = P.box(el, page); let rot = el.rot || 0; let cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    let p = P.parentOf(el.id, page);
    while (p) { const gb = P.box(p, page); const gr = p.rot || 0; const [dx, dy] = rotv(cx - gb.w / 2, cy - gb.h / 2, gr); cx = gb.x + gb.w / 2 + dx; cy = gb.y + gb.h / 2 + dy; rot += gr; p = P.parentOf(p.id, page); }
    return { x: cx - b.w / 2, y: cy - b.h / 2, w: b.w, h: b.h, rot };
  };
  const unionBox = els => { let a = 1e9, b = 1e9, c = -1e9, d = -1e9; els.forEach(e => { const w = P.worldBox(e), cs = corners(w); cs.forEach(p => { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); }); }); return { x: a, y: b, w: c - a, h: d - b }; };
  const corners = w => { const cx = w.x + w.w / 2, cy = w.y + w.h / 2; return [[-w.w / 2, -w.h / 2], [w.w / 2, -w.h / 2], [w.w / 2, w.h / 2], [-w.w / 2, w.h / 2]].map(([x, y]) => { const [a, b] = rotv(x, y, w.rot || 0); return [cx + a, cy + b]; }); };

  /* ---------- layout ---------- */
  P.initEditor = () => {
    stage = document.getElementById('stage'); wrap = document.getElementById('canvasWrap'); host = document.getElementById('host'); overlay = document.getElementById('overlay');
    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('dblclick', onDbl);
    stage.addEventListener('contextmenu', onContext);
    stage.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); P.setZoom(Math.round(P.getZoom() * (e.deltaY < 0 ? 1.1 : .9) * 100) / 100); } }, { passive: false });
    new ResizeObserver(() => P.layoutCanvas()).observe(stage);
    document.addEventListener('keydown', onKey);
    document.addEventListener('copy', onCopy); document.addEventListener('cut', onCut); document.addEventListener('paste', onPaste);
    stage.addEventListener('dragover', e => e.preventDefault());
    stage.addEventListener('drop', e => { e.preventDefault(); const fs = [...(e.dataTransfer.files || [])]; if (fs.length) P.insertFiles(fs); });
  };
  P.getZoom = () => scale;
  P.setZoom = z => { S.zoom = z == null ? null : P.clamp(z, .1, 4); P.layoutCanvas(); P.emit('zoom'); };
  P.layoutCanvas = () => {
    if (!stage || !P.deck) return;
    const d = P.deck.size, rw = stage.clientWidth, rh = stage.clientHeight, m = 24;
    const fit = Math.max(.05, Math.min((rw - m * 2) / d.w, (rh - m * 2) / d.h));
    scale = S.zoom == null ? fit : S.zoom;
    const sw = d.w * scale, sh = d.h * scale;
    const cw = Math.max(rw, sw + m * 2), ch = Math.max(rh, sh + m * 2);
    wrap.style.width = cw + 'px'; wrap.style.height = ch + 'px';
    pgX = (cw - sw) / 2; pgY = (ch - sh) / 2;
    host.style.left = pgX + 'px'; host.style.top = pgY + 'px'; host.style.width = sw + 'px'; host.style.height = sh + 'px';
    const pg = host.firstElementChild; if (pg) pg.style.transform = `scale(${scale})`;
    P.drawOverlay(); P.drawRulers && P.drawRulers(); P.emit('zoom');
  };
  P.renderCanvas = () => {
    if (!host || !P.page()) return;
    const pg = P.renderPage(P.page(), { mode: 'edit', editingId: S.editing ? S.editing.id : null, index: S.view === 'master' ? null : S.cur });
    pg.classList.add('bleed');
    pg.style.transform = `scale(${scale})`;
    host.innerHTML = ''; host.append(pg);
    if (S.grayscale) host.style.filter = 'grayscale(1)'; else host.style.filter = '';
    P.drawOverlay();
  };
  P.contentIcons = (el, ctx) => {
    const type = el.ph.type;
    const items = type === 'pic' ? [['Pictures', 'picture', () => P.pickPicture(el.id)]] : [['Table', 'table', () => P.placeTable(el.id)], ['Chart', 'chart', () => P.chartDialog(el.id)], ['SmartArt', 'smartart', () => P.smartArtDialog(el.id)], ['Pictures', 'picture', () => P.pickPicture(el.id)], ['Video', 'video', () => P.pickMedia('video', el.id)], ['Icons', 'iconset', () => P.iconsDialog(el.id)]];
    const box = h('div', { class: 'ph-icons' + (items.length > 1 ? ' six' : '') });
    items.forEach(([t, ic, fn]) => { const b = h('button', { class: 'ph-ic', title: 'Insert ' + t, html: P.icon(ic, 26) }); b.addEventListener('pointerdown', e => e.stopPropagation()); b.addEventListener('click', e => { e.stopPropagation(); P.T.end(); fn(); }); box.append(b); });
    return box;
  };

  /* ---------- overlay ---------- */
  const toS = (x, y) => [pgX + x * scale, pgY + y * scale];
  const handles = [['nw', -1, -1], ['n', 0, -1], ['ne', 1, -1], ['e', 1, 0], ['se', 1, 1], ['s', 0, 1], ['sw', -1, 1], ['w', -1, 0]];
  P.drawOverlay = () => {
    if (!overlay || !P.page()) return;
    overlay.innerHTML = '';
    overlay.style.width = wrap.style.width; overlay.style.height = wrap.style.height;
    if (S.grid) { const g = h('div', { class: 'gridlines' }); const st = (P.deck.gridStep || 36) * scale; Object.assign(g.style, { left: pgX + 'px', top: pgY + 'px', width: P.deck.size.w * scale + 'px', height: P.deck.size.h * scale + 'px', backgroundSize: `${st}px ${st}px`, backgroundPosition: `${(P.deck.size.w / 2 % (P.deck.gridStep || 36)) * scale}px ${(P.deck.size.h / 2 % (P.deck.gridStep || 36)) * scale}px` }); overlay.append(g); }
    if (S.guides) drawUserGuides();
    drawComments();
    const sel = P.selected();
    if (!sel.length) return;
    const editing = S.editing;
    sel.forEach(el => {
      const w = P.worldBox(el);
      if (P.isLineGeom(el.geom) && sel.length === 1 && el.type !== 'group') { drawLineHandles(el, w); return; }
      const [sx, sy] = toS(w.x, w.y);
      const f = h('div', { class: 'sel-frame' + (editing && editing.id === el.id ? ' editing' : '') + (sel.length > 1 ? ' multi' : '') });
      Object.assign(f.style, { left: sx + 'px', top: sy + 'px', width: w.w * scale + 'px', height: w.h * scale + 'px', transform: w.rot ? `rotate(${w.rot}deg)` : '' });
      if (editing && editing.id === el.id && !editing.cell) { /* the strip around the text lets you drag the shape */
        ['t', 'r', 'b', 'l'].forEach(sd => { const st = h('div', { class: 'edge edge-' + sd }); st.addEventListener('pointerdown', ev => { ev.stopPropagation(); ev.preventDefault(); const id = el.id; startDragFromEdge(ev, id); }); f.append(st); });
      }
      if (sel.length === 1) {
        handles.forEach(([n, dx, dy]) => {
          const d = h('div', { class: 'hd hd-' + n }); d.dataset.hd = n;
          d.style.left = ((dx + 1) / 2 * 100) + '%'; d.style.top = ((dy + 1) / 2 * 100) + '%';
          d.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); startResize(e, [el], dx, dy); });
          f.append(d);
        });
        const r = h('div', { class: 'hd-rot', title: 'Rotate' });
        r.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); startRotate(e, [el]); });
        f.append(r);
        const ah = P.adjHandles[el.geom === 'rightArrow' ? 'rightArrow' : el.geom];
        if (ah && (!el.type || el.type === 'shape')) {
          const p = ah.get(w.w, w.h, el.adj); const a = h('div', { class: 'hd-adj', title: 'Adjust shape' });
          a.style.left = p.x * scale + 'px'; a.style.top = p.y * scale + 'px';
          a.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); startAdjust(e, el, ah); });
          f.append(a);
        }
      }
      overlay.append(f);
    });
    if (sel.length > 1) {
      const u = unionBox(sel); const [sx, sy] = toS(u.x, u.y);
      const f = h('div', { class: 'sel-frame union' }); Object.assign(f.style, { left: sx + 'px', top: sy + 'px', width: u.w * scale + 'px', height: u.h * scale + 'px' });
      handles.forEach(([n, dx, dy]) => { const d = h('div', { class: 'hd hd-' + n }); d.style.left = ((dx + 1) / 2 * 100) + '%'; d.style.top = ((dy + 1) / 2 * 100) + '%'; d.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); startResize(e, sel, dx, dy); }); f.append(d); });
      const r = h('div', { class: 'hd-rot' }); r.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); startRotate(e, sel); }); f.append(r);
      overlay.append(f);
    }
    if (editing && editing.cell) drawCellSel();
  };
  function drawCellSel() {
    const node = P.canvasEl(S.editing.id); if (!node) return;
    const td = node.querySelector(`td[data-r="${S.editing.cell.r}"][data-c="${S.editing.cell.c}"]`); if (!td) return;
    const a = td.getBoundingClientRect(), b = wrap.getBoundingClientRect();
    overlay.append(h('div', { class: 'cell-sel', style: { left: a.left - b.left + 'px', top: a.top - b.top + 'px', width: a.width + 'px', height: a.height + 'px' } }));
    const rg = S.cellRange; if (rg) node.querySelectorAll('td').forEach(t => { const r = +t.dataset.r, c = +t.dataset.c; if (r >= rg.r1 && r <= rg.r2 && c >= rg.c1 && c <= rg.c2) { const q = t.getBoundingClientRect(); overlay.append(h('div', { class: 'cell-range', style: { left: q.left - b.left + 'px', top: q.top - b.top + 'px', width: q.width + 'px', height: q.height + 'px' } })); } });
  }
  function drawLineHandles(el, w) {
    const pts = linePts(el, w);
    pts.forEach((p, i) => {
      const [sx, sy] = toS(p[0], p[1]); const d = h('div', { class: 'hd line-end' + (el.conn && el.conn[i ? 'end' : 'st'] ? ' glued' : ''), style: { left: sx + 'px', top: sy + 'px' } });
      d.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); startLineEnd(e, el, i); });
      overlay.append(d);
    });
    const ah = P.adjHandles[el.geom];
    if (ah) { const q = ah.get(w.w, w.h, el.adj); const [sx, sy] = toS(w.x + (el.flipH ? w.w - q.x : q.x), w.y + (el.flipV ? w.h - q.y : q.y)); const a = h('div', { class: 'hd-adj', style: { left: sx + 'px', top: sy + 'px' } }); a.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); startAdjust(e, el, ah); }); overlay.append(a); }
  }
  const linePts = (el, w = P.worldBox(el)) => { const x1 = el.flipH ? w.x + w.w : w.x, y1 = el.flipV ? w.y + w.h : w.y, x2 = el.flipH ? w.x : w.x + w.w, y2 = el.flipV ? w.y : w.y + w.h; return [[x1, y1], [x2, y2]]; };
  const setLine = (el, p1, p2) => { el.x = Math.min(p1[0], p2[0]); el.y = Math.min(p1[1], p2[1]); el.w = Math.abs(p2[0] - p1[0]); el.h = Math.abs(p2[1] - p1[1]); el.flipH = p2[0] < p1[0] || undefined; el.flipV = p2[1] < p1[1] || undefined; };
  function drawUserGuides() {
    const g = P.deck.guides || (P.deck.guides = [{ axis: 'x', pos: P.deck.size.w / 2 }, { axis: 'y', pos: P.deck.size.h / 2 }]);
    g.forEach(gd => {
      const d = h('div', { class: 'user-guide ' + gd.axis });
      const [sx, sy] = toS(gd.pos, gd.pos);
      if (gd.axis === 'x') Object.assign(d.style, { left: sx + 'px', top: pgY - 20 + 'px', height: P.deck.size.h * scale + 40 + 'px' }); else Object.assign(d.style, { top: sy + 'px', left: pgX - 20 + 'px', width: P.deck.size.w * scale + 40 + 'px' });
      d.addEventListener('pointerdown', e => {
        e.stopPropagation(); e.preventDefault();
        const mv = ev => { const pt = toPt(ev); gd.pos = gd.axis === 'x' ? pt.x : pt.y; P.drawOverlay(); };
        const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      });
      overlay.append(d);
    });
  }
  function drawComments() {
    const page = P.page(); if (!page || page.kind || !S.showComments) return;
    (page.comments || []).forEach((c, i) => {
      const [sx, sy] = toS(c.x || 12, c.y || 12);
      const d = h('div', { class: 'comment-pin', title: c.author + ': ' + c.text, style: { left: sx + 'px', top: sy + 'px' }, html: P.icon('comment', 18) });
      d.addEventListener('pointerdown', e => { e.stopPropagation(); P.openPane('comments'); });
      overlay.append(d);
    });
  }

  /* ---------- hit testing ---------- */
  const hc = document.createElement('canvas').getContext('2d');
  const hitEl = (el, pt, page) => {
    const b = P.box(el, page);
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2; const [lx, ly] = rotv(pt.x - cx, pt.y - cy, -(el.rot || 0));
    const x = lx + b.w / 2, y = ly + b.h / 2;
    const slop = 5 / scale;
    if (x < -slop || y < -slop || x > b.w + slop || y > b.h + slop) return null;
    if (el.type === 'group') { for (let i = el.children.length - 1; i >= 0; i--) { const r = hitEl(el.children[i], { x, y }, page); if (r) return { el, child: r.el }; } return null; }
    if (el.type && el.type !== 'shape') return { el };
    if (el.ph) return { el };
    const hasFill = el.fill && el.fill.type !== 'none';
    const hasTxt = P.hasText(el) || el.txBox;
    if (hasTxt && x >= 0 && y >= 0 && x <= b.w && y <= b.h) return { el };
    const fx = el.flipH ? b.w - x : x, fy = el.flipV ? b.h - y : y;
    const paths = P.geomPaths(el.geom || 'rect', b.w, b.h, el.adj, el);
    hc.lineWidth = Math.max(((el.line && el.line.width) || 1), 10 / scale);
    for (const p of paths) {
      const path = new Path2D(p.d);
      if (hasFill && !p.noFill && hc.isPointInPath(path, fx, fy, 'evenodd')) return { el };
      if (hc.isPointInStroke(path, fx, fy)) return { el };
    }
    return null;
  };
  P.hitTest = pt => {
    const page = P.page(); const els = page.elements;
    for (let i = els.length - 1; i >= 0; i--) { if (els[i].hidden) continue; const r = hitEl(els[i], pt, page); if (r) return r; }
    return null;
  };
  const toPt = e => { const r = host.getBoundingClientRect(); return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }; };
  P.toPt = toPt;

  /* ---------- pointer ---------- */
  function onDown(e) {
    if (e.button === 1) { startPan(e); return; }
    if (e.target.closest('.ph-icons')) return;
    const T = P.T;
    if (T.active && T.active.root.contains(e.target)) return; /* normal text selection inside the editor */
    if (e.button === 2) {
      const r0 = P.hitTest(toPt(e)); if (r0) { const id = r0.el.id; if (!S.sel.includes(id) && !(r0.child && S.sel.includes(r0.child.id))) { T.end(); S.sel = [id]; P.drawOverlay(); P.emit('selection'); } }
      else if (!T.active) { S.sel = []; P.drawOverlay(); P.emit('selection'); }
      return;
    }
    if (S.ink) { startInk(e); return; }
    if (S.insert) { startInsert(e); return; }
    if (S.animPainter) { const r0 = P.hitTest(toPt(e)); const src = S.animPainter; S.animPainter = null; if (r0 && !P.page().kind) { const pg = P.page(); (pg.animations = pg.animations || []).push(Object.assign(P.clone(src), { id: P.uid('a'), el: r0.el.id })); S.sel = [r0.el.id]; P.commit('Animation Painter'); e.preventDefault(); return; } }
    if (S.painter) { const r0 = P.hitTest(toPt(e)); if (r0) { P.applyPainter(r0.child || r0.el); e.preventDefault(); return; } S.painter = null; P.emit('selection'); }
    /* table cell clicks */
    const pt = toPt(e); const hit = P.hitTest(pt);
    const wasActive = T.active; const prevSel = S.sel.slice();
    if (hit && hit.el.type === 'table') {
      const tgt = document.elementFromPoint(e.clientX, e.clientY); const td = tgt && tgt.closest && tgt.closest('td');
      if (td) {
        e.preventDefault(); const cell = { r: +td.dataset.r, c: +td.dataset.c };
        if (e.shiftKey && T.active && T.active.id === hit.el.id && T.active.cell) { /* shift+click extends a cell range (for merge, shading, borders) */
          const a = S.cellAnchor || T.active.cell; S.cellAnchor = a;
          S.cellRange = { r1: Math.min(a.r, cell.r), c1: Math.min(a.c, cell.c), r2: Math.max(a.r, cell.r), c2: Math.max(a.c, cell.c) }; P.drawOverlay(); return;
        }
        S.cellRange = null; S.cellAnchor = null; T.begin(hit.el.id, { cell, point: e }); return;
      }
    }
    if (wasActive) { T.end(); }
    if (!hit) {
      if (!e.shiftKey && !e.ctrlKey) { S.sel = []; S.innerGroup = null; }
      P.drawOverlay(); P.emit('selection'); startMarquee(e); return;
    }
    e.preventDefault();
    let target = hit.el;
    if (hit.child && (prevSel.includes(hit.el.id) || prevSel.includes(hit.child.id) || S.innerGroup === hit.el.id)) { target = hit.child; S.innerGroup = hit.el.id; } else S.innerGroup = null;
    const already = S.sel.includes(target.id);
    if (e.shiftKey || e.ctrlKey) {
      if (already && !e.ctrlKey) S.sel = S.sel.filter(i => i !== target.id);
      else if (!already) S.sel = S.sel.concat(target.id);
    } else if (!already) S.sel = [target.id];
    if (!(already && hit.child && S.sel.length === 1 && target === hit.el)) { /* keep */ }
    P.drawOverlay(); P.emit('selection');
    startMove(e, target, { already, click: !(e.shiftKey), wasActive });
  }
  function startPan(e) { e.preventDefault(); const sx = stage.scrollLeft, sy = stage.scrollTop, x0 = e.clientX, y0 = e.clientY; const mv = ev => { stage.scrollLeft = sx - (ev.clientX - x0); stage.scrollTop = sy - (ev.clientY - y0); }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); }
  function onDbl(e) {
    if (P.T.active) return;
    if (e.target.closest && e.target.closest('.hd')) return;
    const hit = P.hitTest(toPt(e));
    if (!hit) return;
    const el = hit.child || hit.el;
    if (el.type === 'chart') { P.chartDataDialog(el); return; }
    if (el.type === 'image') { P.showTab('picture'); return; }
    if (el.type === 'video' || el.type === 'audio') { P.showTab('media'); return; }
    if (P.isLineGeom(el.geom)) { P.openPane('format'); return; }
    if (!el.type || el.type === 'shape') { if (!P.hasText(el)) el.paras = el.paras || []; P.T.begin(el.id, { point: e }); }
  }
  function onContext(e) {
    e.preventDefault();
    const items = P.contextItems();
    P.popupMenu(e.clientX, e.clientY, items);
  }

  /* --- marquee --- */
  function startMarquee(e) {
    const p0 = toPt(e); let box = null;
    const mv = ev => {
      const p = toPt(ev);
      if (!box) { box = h('div', { class: 'marquee' }); overlay.append(box); }
      const [ax, ay] = toS(Math.min(p0.x, p.x), Math.min(p0.y, p.y));
      Object.assign(box.style, { left: ax + 'px', top: ay + 'px', width: Math.abs(p.x - p0.x) * scale + 'px', height: Math.abs(p.y - p0.y) * scale + 'px' });
    };
    const up = ev => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (box) {
        const p = toPt(ev), a = Math.min(p0.x, p.x), b = Math.min(p0.y, p.y), c = Math.max(p0.x, p.x), d = Math.max(p0.y, p.y);
        const add = P.page().elements.filter(el => { const u = unionBox([el]); return !el.hidden && u.x >= a && u.y >= b && u.x + u.w <= c && u.y + u.h <= d; }).map(el => el.id);
        S.sel = [...new Set(S.sel.concat(add))]; box.remove(); P.drawOverlay(); P.emit('selection');
      }
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  /* --- smart guides --- */
  let guideLayer = [];
  const clearGuides = () => { guideLayer.forEach(g => g.remove()); guideLayer = []; };
  const showGuide = (axis, pos, a, b) => { const g = h('div', { class: 'smart-guide ' + axis }); if (axis === 'x') { const [sx, sy] = toS(pos, a); Object.assign(g.style, { left: sx + 'px', top: sy + 'px', height: (b - a) * scale + 'px' }); } else { const [sx, sy] = toS(a, pos); Object.assign(g.style, { left: sx + 'px', top: sy + 'px', width: (b - a) * scale + 'px' }); } overlay.append(g); guideLayer.push(g); };
  const collectTargets = ex => {
    const xs = [], ys = [], d = P.deck.size; xs.push({ v: d.w / 2, a: 0, b: d.h }, { v: 0, a: 0, b: d.h }, { v: d.w, a: 0, b: d.h }); ys.push({ v: d.h / 2, a: 0, b: d.w }, { v: 0, a: 0, b: d.w }, { v: d.h, a: 0, b: d.w });
    P.page().elements.forEach(el => { if (ex.includes(el.id) || el.hidden) return; const u = unionBox([el]); [u.x, u.x + u.w / 2, u.x + u.w].forEach(v => xs.push({ v, a: u.y, b: u.y + u.h })); [u.y, u.y + u.h / 2, u.y + u.h].forEach(v => ys.push({ v, a: u.x, b: u.x + u.w })); });
    if (S.guides && P.deck.guides) P.deck.guides.forEach(g => (g.axis === 'x' ? xs : ys).push({ v: g.pos, a: 0, b: g.axis === 'x' ? d.h : d.w }));
    return { xs, ys };
  };
  const snapVal = (cands, targets, tol) => { let best = null; cands.forEach(c => targets.forEach(t => { const dv = t.v - c; if (Math.abs(dv) <= tol && (!best || Math.abs(dv) < Math.abs(best.d))) best = { d: dv, t, c }; })); return best; };
  const gridSnap = v => { const st = P.deck.gridStep || 36; return S.grid && S.snap ? Math.round(v / st) * st : v; };

  /* --- move --- */
  function startMove(e, target, info) {
    const page = P.page(); const p0 = toPt(e); const items = P.selected();
    if (!items.length) return;
    const orig = items.map(el => { const b = P.box(el, page); return { el, x: b.x, y: b.y, w: b.w, h: b.h }; });
    const u0 = unionBox(items); let moved = false, dup = false;
    const T0 = collectTargets(items.map(i => i.id));
    const parent = items.length === 1 ? P.parentOf(items[0].id, page) : null;
    const parentRot = parent ? parent.rot || 0 : 0;
    const mv = ev => {
      const p = toPt(ev); let dx = p.x - p0.x, dy = p.y - p0.y;
      if (!moved && Math.hypot(dx, dy) * scale < 4) return;
      moved = true;
      if (ev.shiftKey) { if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0; }
      clearGuides();
      if (!ev.altKey) {
        const tol = 5 / scale;
        const sx = snapVal([u0.x + dx, u0.x + u0.w / 2 + dx, u0.x + u0.w + dx], T0.xs, tol);
        const sy = snapVal([u0.y + dy, u0.y + u0.h / 2 + dy, u0.y + u0.h + dy], T0.ys, tol);
        if (sx) { dx += sx.d; const ny0 = u0.y + dy, ny1 = ny0 + u0.h; showGuide('x', sx.t.v, Math.min(sx.t.a, ny0), Math.max(sx.t.b, ny1)); }
        else if (S.grid && S.snap) dx = gridSnap(u0.x + dx) - u0.x;
        if (sy) { dy += sy.d; const nx0 = u0.x + dx, nx1 = nx0 + u0.w; showGuide('y', sy.t.v, Math.min(sy.t.a, nx0), Math.max(sy.t.b, nx1)); }
        else if (S.grid && S.snap) dy = gridSnap(u0.y + dy) - u0.y;
      }
      let ldx = dx, ldy = dy;
      if (parentRot) { [ldx, ldy] = rotv(dx, dy, -parentRot); }
      orig.forEach(o => { o.el.x = o.x + ldx; o.el.y = o.y + ldy; o.el.w = o.w; o.el.h = o.h; const n = P.canvasEl(o.el.id); if (n) { n.style.left = o.el.x + 'px'; n.style.top = o.el.y + 'px'; } });
      updateConnectors(items.map(i => i.id), true);
      drawOverlayKeepGuides();
    };
    const up = ev => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('keydown', esc); clearGuides();
      if (moved) {
        if (ev.ctrlKey) { dup = true; const copies = items.map(el => { const c = cloneEl(el); return c; }); orig.forEach(o => { o.el.x = o.x; o.el.y = o.y; }); const p = P.page().elements; copies.forEach(c => p.push(c)); const dx = items[0].x; void dx; const ldx = toPt(ev).x - p0.x, ldy = toPt(ev).y - p0.y; copies.forEach((c, i) => { c.x = orig[i].x + ldx; c.y = orig[i].y + ldy; }); S.sel = copies.map(c => c.id); P.commit('Duplicate'); return; }
        P.fitParent(items); P.commit('Move');
      } else if (info.click && !ev.shiftKey && !ev.ctrlKey) {
        const el = target;
        /* single click on an already-selected text-capable shape, or on placeholder / text box, enters text mode */
        if ((!el.type || el.type === 'shape') && (el.ph || el.txBox || info.already) && !P.isLineGeom(el.geom)) P.T.begin(el.id, { point: ev });
        else if (S.sel.length > 1) { S.sel = [el.id]; P.drawOverlay(); P.emit('selection'); }
      }
    };
    const esc = ev => { if (ev.key === 'Escape') { orig.forEach(o => { o.el.x = o.x; o.el.y = o.y; }); moved = false; clearGuides(); P.renderCanvas(); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('keydown', esc); } };
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('keydown', esc);
    void dup;
  }
  function startDragFromEdge(e, id) {
    P.T.end(); S.sel = [id];
    const el = P.findEl(id); if (!el) return;
    P.drawOverlay(); P.emit('selection');
    startMove(e, el, { already: true, click: false });
  }
  const drawOverlayKeepGuides = () => { const keep = guideLayer.slice(); P.drawOverlay(); keep.forEach(g => overlay.append(g)); };
  /* keep group bounds tight after moving a child */
  P.fitParent = items => {
    const page = P.page();
    items.forEach(it => {
      let par = P.parentOf(it.id, page);
      while (par) {
        let a = 1e9, b = 1e9, c = -1e9, d = -1e9;
        par.children.forEach(k => { const kb = P.box(k, page); const cs = corners({ x: kb.x, y: kb.y, w: kb.w, h: kb.h, rot: k.rot || 0 }); cs.forEach(q => { a = Math.min(a, q[0]); b = Math.min(b, q[1]); c = Math.max(c, q[0]); d = Math.max(d, q[1]); }); });
        if (a !== 0 || b !== 0 || c !== par.w || d !== par.h) {
          par.children.forEach(k => { k.x -= a; k.y -= b; });
          /* keep position when rotated: approximate through centre */
          const ncx = (a + c) / 2 - par.w / 2, ncy = (b + d) / 2 - par.h / 2; const [wx, wy] = rotv(ncx, ncy, par.rot || 0);
          const ow = par.w, oh = par.h; par.w = c - a; par.h = d - b; par.x = par.x + ow / 2 + wx - par.w / 2; par.y = par.y + oh / 2 + wy - par.h / 2;
        }
        par = P.parentOf(par.id, page);
      }
    });
  };

  /* --- resize --- */
  P.scaleChildren = (g, sx, sy) => { (g.children || []).forEach(k => { k.x *= sx; k.y *= sy; k.w *= sx; k.h *= sy; if (k.children) P.scaleChildren(k, sx, sy); if (k.tbl) { k.tbl.cols = k.tbl.cols.map(c => c * sx); k.tbl.rows.forEach(r => r.h *= sy); } }); };
  const scaleTable = (el, nw, nh, ow, oh) => { if (!el.tbl) return; const sx = nw / ow, sy = nh / oh; el.tbl.cols = el.tbl.cols.map(c => c * sx); el.tbl.rows.forEach(r => r.h *= sy); };
  const rerenderEl = el => { const n = P.canvasEl(el.id); if (!n) return; const ctx = { page: P.page(), deck: P.deck, mode: 'edit', slideNo: S.cur + 1 }; const fresh = P.renderEl(el, ctx, { editingId: S.editing ? S.editing.id : null }); n.replaceWith(fresh); };
  function startResize(e, els, dx, dy) {
    const page = P.page(); const single = els.length === 1;
    const wasEditing = P.T.active ? P.T.active.id : null;
    if (P.T.active) P.T.end(true);
    let moved = false;
    const others = collectTargets(els.map(i => i.id));
    if (single) {
      const el = els[0], b0 = P.box(el, page), rot = el.rot || 0, cx = b0.x + b0.w / 2, cy = b0.y + b0.h / 2;
      const snapshot = P.clone(el);
      const [ax, ay] = rotv(-dx * b0.w / 2, -dy * b0.h / 2, rot);
      const anchor = [cx + ax, cy + ay];
      const lockDefault = (el.type === 'image' || el.type === 'video' || (el.lockAR)) && dx && dy;
      const parent = P.parentOf(el.id, page);
      const mv = ev => {
        moved = true; let p = toPt(ev);
        if (parent) { const pw = P.worldBox(parent); const [lx, ly] = rotv(p.x - (pw.x + pw.w / 2), p.y - (pw.y + pw.h / 2), -(parent.rot || 0)); p = { x: lx + pw.w / 2, y: ly + pw.h / 2 }; }
        const center = ev.ctrlKey;
        const a0 = center ? [cx, cy] : anchor;
        let [vx, vy] = rotv(p.x - a0[0], p.y - a0[1], -rot);
        let nw = dx ? vx * dx : b0.w, nh = dy ? vy * dy : b0.h;
        if (center) { if (dx) nw *= 2; if (dy) nh *= 2; }
        nw = Math.max(1, nw); nh = Math.max(1, nh);
        clearGuides();
        if (!rot && !ev.altKey && !parent) {
          const tol = 5 / scale;
          if (dx) { const edge = (dx > 0 ? a0[0] + nw : a0[0] - nw); const s = snapVal([edge], others.xs, tol); if (s) { nw += s.d * dx; showGuide('x', s.t.v, Math.min(s.t.a, b0.y), Math.max(s.t.b, b0.y + b0.h)); } }
          if (dy) { const edge = (dy > 0 ? a0[1] + nh : a0[1] - nh); const s = snapVal([edge], others.ys, tol); if (s) { nh += s.d * dy; showGuide('y', s.t.v, Math.min(s.t.a, b0.x), Math.max(s.t.b, b0.x + b0.w)); } }
        }
        if ((ev.shiftKey || lockDefault) && !(lockDefault && ev.shiftKey)) {
          const r = b0.w / b0.h;
          if (dx && dy) { if (nw / r > nh) nh = nw / r; else nw = nh * r; }
          else if (dx) nh = nw / r; else nw = nh * r;
        }
        const [ox, oy] = center ? [0, 0] : rotv(dx * nw / 2, dy * nh / 2, rot);
        const ncx = a0[0] + ox, ncy = a0[1] + oy;
        const ow = el.w === undefined ? b0.w : el.w, oh = el.h === undefined ? b0.h : el.h;
        if (el.type === 'group') P.scaleChildren(el, nw / ow, nh / oh);
        if (el.type === 'table') scaleTable(el, nw, nh, ow, oh);
        el.x = ncx - nw / 2; el.y = ncy - nh / 2; el.w = nw; el.h = nh;
        rerenderEl(el); updateConnectors([el.id], true); drawOverlayKeepGuides();
      };
      const up = () => {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('keydown', esc); clearGuides();
        if (moved) { P.T.fit(el); if (el.type === 'table') P.syncTableHeight(el); P.fitParent([el]); P.commit('Resize'); }
        else if (wasEditing) P.T.begin(wasEditing);
      };
      const esc = ev => { if (ev.key === 'Escape') { Object.assign(el, snapshot); moved = false; up(); P.renderCanvas(); } };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('keydown', esc);
    } else {
      const u = unionBox(els); const fx = dx > 0 ? u.x : u.x + u.w, fy = dy > 0 ? u.y : u.y + u.h;
      const orig = els.map(el => { const b = P.box(el, page); return { el, b, cx: b.x + b.w / 2, cy: b.y + b.h / 2 }; });
      const mv = ev => {
        moved = true; const p = toPt(ev);
        let sx = dx ? Math.max(.02, (p.x - fx) * dx / u.w) : 1, sy = dy ? Math.max(.02, (p.y - fy) * dy / u.h) : 1;
        if (ev.shiftKey || (dx && dy)) { const s = Math.max(sx, sy); if (dx && dy) { sx = sy = s; } }
        orig.forEach(o => {
          const nw = o.b.w * sx, nh = o.b.h * sy, ncx = fx + (o.cx - fx) * sx, ncy = fy + (o.cy - fy) * sy;
          const ow = o.el.w, oh = o.el.h;
          if (o.el.type === 'group') P.scaleChildren(o.el, nw / ow, nh / oh);
          if (o.el.type === 'table') scaleTable(o.el, nw, nh, ow, oh);
          o.el.x = ncx - nw / 2; o.el.y = ncy - nh / 2; o.el.w = nw; o.el.h = nh; rerenderEl(o.el);
        });
        P.drawOverlay();
      };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (moved) { els.forEach(el => P.T.fit(el)); P.commit('Resize'); } };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    }
  }
  function startRotate(e, els) {
    if (P.T.active) P.T.end(true);
    const page = P.page(); const u = els.length === 1 ? P.worldBox(els[0]) : unionBox(els); const cx = u.x + u.w / 2, cy = u.y + u.h / 2;
    const orig = els.map(el => { const b = P.box(el, page); return { el, rot: el.rot || 0, b, cx: b.x + b.w / 2, cy: b.y + b.h / 2 }; });
    const a0 = Math.atan2(toPt(e).y - cy, toPt(e).x - cx);
    let moved = false;
    const lbl = h('div', { class: 'rot-label' }); overlay.parentNode.append(lbl);
    const mv = ev => {
      moved = true; const p = toPt(ev); let d = (Math.atan2(p.y - cy, p.x - cx) - a0) * 180 / Math.PI;
      if (els.length === 1) { let nr = orig[0].rot + d; if (ev.shiftKey) nr = Math.round(nr / 15) * 15; else { const sn = Math.round(nr / 90) * 90; if (Math.abs(nr - sn) < 3) nr = sn; } d = nr - orig[0].rot; }
      else if (ev.shiftKey) d = Math.round(d / 15) * 15;
      orig.forEach(o => {
        const nr = ((o.rot + d) % 360 + 360) % 360; o.el.rot = nr || undefined;
        if (els.length > 1) { const [a, b] = rotv(o.cx - cx, o.cy - cy, d); o.el.x = cx + a - o.b.w / 2; o.el.y = cy + b - o.b.h / 2; o.el.w = o.b.w; o.el.h = o.b.h; }
        else if (o.el.x === undefined) P.setBox(o.el, o.b);
        const n = P.canvasEl(o.el.id); if (n) { n.style.left = (o.el.x) + 'px'; n.style.top = (o.el.y) + 'px'; n.style.transform = o.el.rot ? `rotate(${o.el.rot}deg)` : ''; }
      });
      lbl.textContent = Math.round((orig[0].el.rot || 0)) + '°'; lbl.style.left = ev.clientX + 14 + 'px'; lbl.style.top = ev.clientY + 14 + 'px';
      P.drawOverlay();
    };
    const up = () => { lbl.remove(); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (moved) P.commit('Rotate'); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  function startAdjust(e, el, ah) {
    if (P.T.active) P.T.end(true);
    let moved = false; const mv = ev => {
      moved = true; const w = P.worldBox(el), p = toPt(ev); const cx = w.x + w.w / 2, cy = w.y + w.h / 2; const [lx, ly] = rotv(p.x - cx, p.y - cy, -(w.rot || 0));
      let x = lx + w.w / 2, y = ly + w.h / 2; if (el.flipH) x = w.w - x; if (el.flipV) y = w.h - y;
      el.adj = ah.set(w.w, w.h, el.adj, x, y); rerenderEl(el); P.drawOverlay();
    };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (moved) P.commit('Adjust shape'); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  /* --- line endpoints & connectors --- */
  const sitesOf = (el, page) => { const w = P.worldBox(el, page); const cx = w.x + w.w / 2, cy = w.y + w.h / 2; return [[0, -w.h / 2], [-w.w / 2, 0], [0, w.h / 2], [w.w / 2, 0]].map(([x, y]) => { const [a, b] = rotv(x, y, w.rot || 0); return [cx + a, cy + b]; }); };
  P.sitesOf = sitesOf;
  const nearSite = (pt, exId) => {
    const page = P.page(); let best = null;
    page.elements.forEach(el => { if (el.id === exId || P.isLineGeom(el.geom) || el.hidden) return; sitesOf(el, page).forEach((s, i) => { const d = Math.hypot(s[0] - pt.x, s[1] - pt.y); if (d < 9 / scale && (!best || d < best.d)) best = { el, i, s, d }; }); });
    return best;
  };
  const showSites = exId => {
    const page = P.page(); const near = []; page.elements.forEach(el => { if (el.id === exId || P.isLineGeom(el.geom) || el.hidden) return; sitesOf(el, page).forEach(s => { const [sx, sy] = toS(s[0], s[1]); const d = h('div', { class: 'site', style: { left: sx + 'px', top: sy + 'px' } }); overlay.append(d); near.push(d); }); });
    return () => near.forEach(n => n.remove());
  };
  function startLineEnd(e, el, i) {
    const pts = linePts(el); let moved = false; let site = null;
    const mv = ev => {
      moved = true; const p = toPt(ev); site = nearSite(p, el.id);
      let tgt = site ? site.s : [p.x, p.y];
      if (ev.shiftKey && !site) { const o = pts[1 - i]; const a = Math.round(Math.atan2(tgt[1] - o[1], tgt[0] - o[0]) / (Math.PI / 12)) * (Math.PI / 12), r = Math.hypot(tgt[0] - o[0], tgt[1] - o[1]); tgt = [o[0] + r * Math.cos(a), o[1] + r * Math.sin(a)]; }
      pts[i] = tgt; setLine(el, pts[0], pts[1]); rerenderEl(el); P.drawOverlay(); showSites(el.id);
    };
    const up = () => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (moved) { el.conn = el.conn || {}; const key = i ? 'end' : 'st'; if (site) el.conn[key] = { id: site.el.id, idx: site.i }; else delete el.conn[key]; if (!el.conn.st && !el.conn.end) delete el.conn; P.commit('Move line end'); }
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  function updateConnectors(ids, live) {
    const page = P.page();
    page.elements.forEach(el => {
      if (!el.conn) return;
      const st = el.conn.st, en = el.conn.end; if (!((st && ids.includes(st.id)) || (en && ids.includes(en.id)))) return;
      const pts = linePts(el);
      if (st) { const t = P.findEl(st.id, page); if (t) pts[0] = sitesOf(t, page)[st.idx % 4]; }
      if (en) { const t = P.findEl(en.id, page); if (t) pts[1] = sitesOf(t, page)[en.idx % 4]; }
      setLine(el, pts[0], pts[1]); if (live) rerenderEl(el);
    });
  }
  P.updateConnectors = updateConnectors;

  /* --- inserting shapes --- */
  const defaultShape = (geom, x, y, w, hh) => ({ id: P.uid(), type: 'shape', geom, x, y, w, h: hh, name: P.geomLabel(geom) + ' ' + (P.page().elements.length + 1),
    fill: { type: 'solid', color: 'accent1' }, line: { type: 'solid', color: 'accent1:75,0', width: 1 }, anchor: 'ctr', lst: [{ color: 'bg1', align: 'ctr', size: 18 }], paras: [] });
  P.defaultShape = defaultShape;
  const defaultLine = (geom, x, y, w, hh) => ({ id: P.uid(), type: 'shape', geom, x, y, w, h: hh, name: (/Connector/.test(geom) ? 'Connector ' : 'Line ') + (P.page().elements.length + 1), fill: { type: 'none' }, line: { type: 'solid', color: 'accent1', width: 1 } });
  P.beginInsert = (geom, opts = {}) => { P.T.end(); S.insert = Object.assign({ geom }, opts); stage.classList.add('inserting'); P.emit('selection'); };
  const endInsert = () => { S.insert = null; stage.classList.remove('inserting'); };
  P.cancelInsert = endInsert;
  function startInsert(e) {
    e.preventDefault();
    const ins = S.insert, p0 = toPt(e), geom = ins.geom;
    if (geom === 'freeform') return freeformClick(e);
    if (geom === 'scribble') return startScribble(e);
    const isLine = P.isLineGeom(geom);
    let el;
    if (geom === 'textbox') { el = P.textBox(p0.x, p0.y, 1, 1, ins.vert); el.fit = 'resize'; }
    else if (isLine) { el = defaultLine(geom, p0.x, p0.y, 0, 0); if (ins.arrow === 'tail') el.line.tail = { type: 'triangle' }; if (ins.arrow === 'both') { el.line.head = { type: 'triangle' }; el.line.tail = { type: 'triangle' }; } }
    else el = defaultShape(geom, p0.x, p0.y, 1, 1);
    let site0 = isLine ? nearSite(p0, null) : null; let start = site0 ? site0.s : [p0.x, p0.y];
    let hideSites = isLine ? showSites(null) : null;
    P.page().elements.push(el); let dragging = false; let endSite = null;
    const node = () => P.canvasEl(el.id);
    P.renderCanvas();
    const mv = ev => {
      const p = toPt(ev);
      if (Math.hypot(p.x - p0.x, p.y - p0.y) * scale > 3) dragging = true;
      if (isLine) { endSite = nearSite(p, null); let t = endSite ? endSite.s : [p.x, p.y]; if (ev.shiftKey && !endSite) { const a = Math.round(Math.atan2(t[1] - start[1], t[0] - start[0]) / (Math.PI / 12)) * (Math.PI / 12), r = Math.hypot(t[0] - start[0], t[1] - start[1]); t = [start[0] + r * Math.cos(a), start[1] + r * Math.sin(a)]; } setLine(el, start, t); }
      else {
        let w = p.x - p0.x, ww = p.y - p0.y; if (ev.shiftKey) { const m = Math.max(Math.abs(w), Math.abs(ww)); w = Math.sign(w || 1) * m; ww = Math.sign(ww || 1) * m; }
        el.x = w < 0 ? p0.x + w : p0.x; el.y = ww < 0 ? p0.y + ww : p0.y; el.w = Math.abs(w) || 1; el.h = Math.abs(ww) || 1;
      }
      const n = node(); if (n) rerenderEl(el);
    };
    const up = () => {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (hideSites) hideSites();
      if (!dragging) {
        if (geom === 'textbox') { el.w = 200; el.h = 28; el.fit = 'resize'; el.wrap = false; el.x = p0.x; el.y = p0.y - 14; }
        else if (isLine) { setLine(el, [p0.x, p0.y], [p0.x + 108, p0.y + 72]); }
        else { el.w = 108; el.h = 108; el.x = p0.x - 54; el.y = p0.y - 54; if (/Arrow|homePlate|chevron/.test(geom)) { el.w = 144; el.h = 72; } }
      }
      if (geom === 'textbox' && dragging) { el.w = Math.max(el.w, 20); el.fit = 'resize'; }
      if (isLine) { el.conn = {}; if (site0) el.conn.st = { id: site0.el.id, idx: site0.i }; if (endSite) el.conn.end = { id: endSite.el.id, idx: endSite.i }; if (!el.conn.st && !el.conn.end) delete el.conn; }
      S.sel = [el.id]; endInsert();
      if (geom === 'textbox') { P.renderCanvas(); P.T.begin(el.id); }
      else P.commit('Insert ' + P.geomLabel(geom));
    };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  P.textBox = (x, y, w, hh, vert) => ({ id: P.uid(), type: 'shape', geom: 'rect', txBox: true, name: 'TextBox ' + (P.page().elements.length + 1), x, y, w, h: hh, fill: { type: 'none' }, line: { type: 'none' }, paras: [P.para('')], vert: vert ? 'vert' : undefined });

  /* freeform (click points, double-click/Enter to finish) & scribble */
  let ff = null;
  function freeformClick(e) {
    const p = toPt(e);
    if (!ff) {
      ff = { pts: [[p.x, p.y]], preview: null };
      const mv = ev => { if (!ff) return; const q = toPt(ev); drawFF(q); };
      const fin = (close) => {
        removeEventListener('pointermove', mv); stage.removeEventListener('dblclick', dbl); removeEventListener('keydown', key);
        const pts = ff.pts; if (ff.preview) ff.preview.remove(); ff = null; endInsert();
        if (pts.length > 1) P.addFreeform(pts, close, true); else P.renderCanvas();
      };
      const dbl = ev => { ev.stopPropagation(); fin(false); };
      const key = ev => { if (ev.key === 'Enter' || ev.key === 'Escape') { ev.preventDefault(); fin(false); } };
      ff.fin = fin; addEventListener('pointermove', mv); stage.addEventListener('dblclick', dbl); addEventListener('keydown', key);
    } else {
      const s = ff.pts[0]; if (ff.pts.length > 2 && Math.hypot(s[0] - p.x, s[1] - p.y) < 8 / scale) { ff.fin(true); return; }
      ff.pts.push([p.x, p.y]);
    }
    function drawFF(q) { if (ff.preview) ff.preview.remove(); const pts = ff.pts.concat([[q.x, q.y]]); const d = 'M' + pts.map(a => toS(a[0], a[1]).join(' ')).join('L'); const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'ff-preview'); svg.innerHTML = `<path d="${d}" fill="none" stroke="#c43e1c" stroke-width="1.5"/>`; overlay.append(svg); ff.preview = svg; }
  }
  const simplify = (pts, tol) => { if (pts.length < 3) return pts; const out = [pts[0]]; let last = pts[0]; for (let i = 1; i < pts.length - 1; i++) { if (Math.hypot(pts[i][0] - last[0], pts[i][1] - last[1]) >= tol) { out.push(pts[i]); last = pts[i]; } } out.push(pts[pts.length - 1]); return out; };
  const smoothD = pts => { if (pts.length < 3) return 'M' + pts.map(p => P.round(p[0]) + ' ' + P.round(p[1])).join('L'); let d = `M${P.round(pts[0][0])} ${P.round(pts[0][1])}`; for (let i = 1; i < pts.length - 1; i++) { const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2; d += `Q${P.round(pts[i][0])} ${P.round(pts[i][1])} ${P.round(mx)} ${P.round(my)}`; } const l = pts[pts.length - 1]; return d + `L${P.round(l[0])} ${P.round(l[1])}`; };
  P.addFreeform = (pts, close, hasFill, ink) => {
    let a = 1e9, b = 1e9, c = -1e9, d = -1e9; pts.forEach(p => { a = Math.min(a, p[0]); b = Math.min(b, p[1]); c = Math.max(c, p[0]); d = Math.max(d, p[1]); });
    const w = Math.max(c - a, .5), hh = Math.max(d - b, .5);
    const local = pts.map(p => [p[0] - a, p[1] - b]);
    const dStr = ink || !hasFill ? smoothD(simplify(local, ink ? .8 : 1.5)) : 'M' + local.map(p => P.round(p[0]) + ' ' + P.round(p[1])).join('L') + (close ? 'Z' : '');
    const el = { id: P.uid(), type: 'shape', geom: 'custom', name: (ink ? 'Ink ' : 'Freeform ') + (P.page().elements.length + 1), x: a, y: b, w, h: hh, paths: [{ d: dStr, w, h: hh, noFill: !close }],
      fill: close ? { type: 'solid', color: 'accent1' } : { type: 'none' }, line: ink ? { type: 'solid', color: ink.color, width: ink.width, cap: 'round', opacity: ink.opacity } : { type: 'solid', color: 'accent1:75,0', width: 1 } };
    P.page().elements.push(el); if (!ink) S.sel = [el.id]; P.commit(ink ? 'Ink' : 'Freeform');
    return el;
  };
  function startScribble(e) {
    const pts = [[toPt(e).x, toPt(e).y]]; const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'ff-preview'); overlay.append(svg);
    const mv = ev => { const q = toPt(ev); pts.push([q.x, q.y]); svg.innerHTML = `<path d="M${pts.map(a => toS(a[0], a[1]).join(' ')).join('L')}" fill="none" stroke="#c43e1c" stroke-width="1.5"/>`; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); svg.remove(); endInsert(); if (pts.length > 2) P.addFreeform(pts, false, false); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  /* --- pen / highlighter / eraser tools --- */
  function startInk(e) {
    e.preventDefault(); const ink = S.ink; const page = P.page();
    if (ink.tool === 'eraser') {
      const mv = ev => { const p = toPt(ev); for (let i = page.elements.length - 1; i >= 0; i--) { const el = page.elements[i]; if (el.geom !== 'custom' || !/^Ink/.test(el.name || '')) continue; const r = hitEl(el, p, page); if (r) { page.elements.splice(i, 1); P.renderCanvas(); dirty = true; } } };
      let dirty = false; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (dirty) P.commit('Erase ink'); }; mv(e); addEventListener('pointermove', mv); addEventListener('pointerup', up); return;
    }
    const pts = [[toPt(e).x, toPt(e).y]]; const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('class', 'ff-preview'); overlay.append(svg);
    const col = P.color(ink.color), wpx = ink.width * scale;
    const mv = ev => { const c = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev]; c.forEach(q => { const t = toPt(q); pts.push([t.x, t.y]); }); svg.innerHTML = `<path d="M${pts.map(a => toS(a[0], a[1]).join(' ')).join('L')}" fill="none" stroke="${col}" stroke-opacity="${ink.opacity || 1}" stroke-width="${wpx}" stroke-linecap="round" stroke-linejoin="round"/>`; };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); svg.remove(); if (pts.length === 1) pts.push([pts[0][0] + .5, pts[0][1] + .5]); P.addFreeform(pts, false, false, { color: ink.color, width: ink.width, opacity: ink.opacity }); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  P.setInk = ink => { S.ink = ink; if (ink) { P.T.end(); S.sel = []; } stage.classList.toggle('inking', !!ink); P.drawOverlay(); P.emit('selection'); };

  /* ---------- operations ---------- */
  const reId = el => { el.id = P.uid(); (el.children || []).forEach(reId); return el; };
  const cloneEl = el => { const c = reId(P.clone(el)); const b = P.box(el); P.setBox(c, b); delete c.conn; return c; };
  P.cloneEl = cloneEl;
  P.deleteSelected = () => {
    const ids = S.sel.slice(); if (!ids.length) return;
    const page = P.page();
    ids.forEach(id => { const sib = P.siblings(id, page); const i = sib.findIndex(e => e.id === id); if (i >= 0) { const el = sib[i]; if (el.ph && P.hasText(el) && !page.kind) { el.paras = []; delete el.fontScale; } else sib.splice(i, 1); } });
    if (page.animations) page.animations = page.animations.filter(a => !ids.includes(a.el));
    page.elements.forEach(el => { if (el.conn) { ['st', 'end'].forEach(k => { if (el.conn[k] && ids.includes(el.conn[k].id)) delete el.conn[k]; }); } });
    /* collapse groups left empty */
    const prune = list => { for (let i = list.length - 1; i >= 0; i--) { const e = list[i]; if (e.children) { prune(e.children); if (!e.children.length) list.splice(i, 1); } } };
    prune(page.elements);
    S.sel = []; P.commit('Delete', { });
  };
  P.duplicateSelected = () => {
    const page = P.page(); const list = P.selected(); if (!list.length) return;
    const nu = list.map(el => { const c = cloneEl(el); c.x += 12; c.y += 12; delete c.ph; if (c.name) c.name = c.name.replace(/\d+$/, '') + (page.elements.length + 1); P.siblings(el.id, page).push(c); return c.id; });
    S.sel = nu; P.commit('Duplicate');
  };
  P.groupSelected = () => {
    const page = P.page(); const list = P.selected().filter(e => !e.ph); if (list.length < 2) return;
    const u = unionBox(list); const parent = page.elements;
    const idxs = list.map(e => parent.indexOf(e)).filter(i => i >= 0); if (idxs.length < 2) return;
    const top = Math.max(...idxs);
    const g = { id: P.uid(), type: 'group', name: 'Group ' + (page.elements.length + 1), x: u.x, y: u.y, w: u.w, h: u.h, children: [] };
    const sorted = list.slice().sort((a, b) => parent.indexOf(a) - parent.indexOf(b));
    sorted.forEach(el => { const b = P.box(el, page); P.setBox(el, { x: b.x - u.x, y: b.y - u.y, w: b.w, h: b.h }); g.children.push(el); });
    parent.splice(top + 1, 0, g); sorted.forEach(el => parent.splice(parent.indexOf(el), 1));
    if (page.animations) { const ids = sorted.map(e => e.id); page.animations = page.animations.filter(a => !ids.includes(a.el)); }
    S.sel = [g.id]; P.commit('Group');
  };
  P.ungroupSelected = () => {
    const page = P.page(); const nu = [];
    P.selected().forEach(g => {
      if (g.type !== 'group') return;
      const parent = P.siblings(g.id, page), i = parent.indexOf(g), gr = g.rot || 0, gcx = g.x + g.w / 2, gcy = g.y + g.h / 2;
      const kids = g.children.map(k => { const cx = k.x + k.w / 2 - g.w / 2, cy = k.y + k.h / 2 - g.h / 2; const [a, b] = rotv(cx, cy, gr); k.x = gcx + a - k.w / 2; k.y = gcy + b - k.h / 2; k.rot = ((k.rot || 0) + gr) % 360 || undefined; nu.push(k.id); return k; });
      parent.splice(i, 1, ...kids);
    });
    if (nu.length) { S.sel = nu; P.commit('Ungroup'); }
  };
  P.zorder = dir => {
    const page = P.page(); const list = P.selected(); if (!list.length) return;
    const sib = P.siblings(list[0].id, page), set = list.filter(e => sib.includes(e)).sort((a, b) => sib.indexOf(a) - sib.indexOf(b));
    if (dir === 'front') { set.forEach(e => { sib.splice(sib.indexOf(e), 1); sib.push(e); }); }
    else if (dir === 'back') { set.slice().reverse().forEach(e => { sib.splice(sib.indexOf(e), 1); sib.unshift(e); }); }
    else if (dir === 'forward') { set.slice().reverse().forEach(e => { const i = sib.indexOf(e); if (i < sib.length - 1 && !set.includes(sib[i + 1])) { sib.splice(i, 1); sib.splice(i + 1, 0, e); } }); }
    else { set.forEach(e => { const i = sib.indexOf(e); if (i > 0 && !set.includes(sib[i - 1])) { sib.splice(i, 1); sib.splice(i - 1, 0, e); } }); }
    P.commit('Arrange');
  };
  P.alignSel = how => {
    const list = P.selected(); if (!list.length) return;
    const page = P.page(); const toSlide = list.length === 1 || S.alignToSlide; const D = P.deck.size;
    const u = toSlide ? { x: 0, y: 0, w: D.w, h: D.h } : unionBox(list);
    if (how === 'distH' || how === 'distV') {
      if (list.length < 3 && !toSlide) return;
      const key = how === 'distH' ? 'x' : 'y', sz = how === 'distH' ? 'w' : 'h';
      const arr = list.map(el => ({ el, u: unionBox([el]) })).sort((a, b) => a.u[key] - b.u[key]);
      const total = arr.reduce((s, a) => s + a.u[sz], 0); const startP = toSlide ? 0 : u[key], span = toSlide ? D[sz] : u[sz]; const gap = (span - total) / Math.max(1, toSlide ? arr.length + 1 : arr.length - 1);
      let cur = startP + (toSlide ? gap : 0);
      arr.forEach(a => { const b = P.box(a.el, page), d = cur - a.u[key]; P.setBox(a.el, Object.assign(b, { [key]: b[key] + d })); cur += a.u[sz] + gap; });
    } else list.forEach(el => {
      const b = P.box(el, page), v = unionBox([el]); let dx = 0, dy = 0;
      if (how === 'l') dx = u.x - v.x; if (how === 'c') dx = u.x + u.w / 2 - (v.x + v.w / 2); if (how === 'r') dx = u.x + u.w - (v.x + v.w);
      if (how === 't') dy = u.y - v.y; if (how === 'm') dy = u.y + u.h / 2 - (v.y + v.h / 2); if (how === 'b') dy = u.y + u.h - (v.y + v.h);
      P.setBox(el, { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h });
    });
    updateConnectors(S.sel); P.commit('Align');
  };
  P.rotateSel = d => { P.selected().forEach(el => { if (el.x === undefined) P.setBox(el, P.box(el)); el.rot = (((el.rot || 0) + d) % 360 + 360) % 360 || undefined; }); P.commit('Rotate'); };
  P.flipSel = axis => { P.selected().forEach(el => { const k = axis === 'h' ? 'flipH' : 'flipV'; el[k] = !el[k] || undefined; }); P.commit('Flip'); };
  /* format painter */
  P.startPainter = sticky => {
    const el = P.selected()[0]; if (!el) return;
    const st = P.currentTextStyle();
    S.painter = { fill: P.clone(el.fill), line: P.clone(el.line), fx: P.clone(el.fx), text: st ? { font: st.font, size: st.size, b: st.b, i: st.i, u: st.u, color: st.color } : null, sticky };
    stage.classList.add('painting'); P.emit('selection');
  };
  P.applyPainter = el => {
    const pt = S.painter; if (!pt) return;
    if (el.type !== 'table' && el.type !== 'chart') { if (pt.fill !== undefined) el.fill = P.clone(pt.fill); if (pt.line !== undefined) el.line = P.clone(pt.line); if (pt.fx !== undefined) el.fx = P.clone(pt.fx); }
    if (pt.text && el.paras) el.paras.forEach(p => (p.runs || []).forEach(r => Object.assign(r, pt.text)));
    if (!pt.sticky) { S.painter = null; stage.classList.remove('painting'); }
    S.sel = [el.id]; P.commit('Format Painter');
  };

  /* table helpers used by overlay & keyboard */
  P.syncTableHeight = (el, live) => {
    const n = P.canvasEl(el.id); if (!n) return; const t = n.querySelector('table'); if (!t) return;
    [...t.rows].forEach((tr, i) => { const measured = tr.getBoundingClientRect().height / scale; if (el.tbl.rows[i]) { if (measured > el.tbl.rows[i].h + .3) el.tbl.rows[i].h = measured; } });
    el.h = el.tbl.rows.reduce((a, r) => a + r.h, 0); if (live) n.style.height = el.h + 'px';
  };
  P.moveCell = dir => {
    const a = P.T.active; if (!a || !a.cell) return; const t = a.el.tbl, id = a.id; let { r, c } = a.cell;
    const next = () => { c += dir; if (c >= t.cols.length) { c = 0; r++; } if (c < 0) { c = t.cols.length - 1; r--; } };
    next(); while (r >= 0 && r < t.rows.length && (t.rows[r].cells[c].hm || t.rows[r].cells[c].vm)) next();
    if (r >= t.rows.length) { P.T.end(); P.tableOp('rowBelow', { r: r - 1, c: 0 }); P.T.begin(id, { cell: { r, c: 0 } }); return; }
    if (r < 0) return;
    P.T.begin(id, { cell: { r, c } });
  };

  /* ---------- clipboard ---------- */
  P.clip = null;
  P.copySel = () => { const list = P.selected(); if (!list.length) return false; P.clip = { kind: 'els', els: list.map(el => { const c = P.clone(el); P.setBox(c, P.box(el)); return c; }), pasteN: 0, anims: [] }; return true; };
  P.pasteClip = () => {
    if (!P.clip) return;
    if (P.clip.kind === 'slides') { P.pasteSlides(); return; }
    const page = P.page(); P.clip.pasteN++;
    const nu = P.clip.els.map(e => { const c = reId(P.clone(e)); if (c.ph && page.elements.some(o => o.ph && o.ph.idx === c.ph.idx)) delete c.ph; c.x += 12 * P.clip.pasteN; c.y += 12 * P.clip.pasteN; delete c.conn; page.elements.push(c); return c.id; });
    S.sel = nu; P.commit('Paste');
  };
  function typing(e) { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable); }
  function onCopy(e) { if (P.showing || typing(e) || P.T.active) return; if (P.slideFocus && P.slideFocus()) { P.copySlides(); e.preventDefault(); return; } if (P.copySel()) { e.clipboardData.setData('text/plain', P.selected().map(el => P.parasText(el.paras)).join('\n')); e.preventDefault(); } }
  function onCut(e) { if (P.showing || typing(e) || P.T.active) return; if (P.slideFocus && P.slideFocus()) { P.copySlides(); P.deleteSlides(); e.preventDefault(); return; } if (P.copySel()) { P.deleteSelected(); e.preventDefault(); } }
  function onPaste(e) {
    if (P.showing || (typing(e) && !P.T.active)) return;
    const items = [...(e.clipboardData ? e.clipboardData.items : [])];
    const img = items.find(i => i.type.startsWith('image/'));
    if (img) { e.preventDefault(); P.T.end(); P.insertPictureBlob(img.getAsFile()); return; }
    if (P.T.active) return;
    const txt = e.clipboardData && e.clipboardData.getData('text/plain');
    const clipTxt = P.clip && P.clip.kind === 'els' ? P.clip.els.map(el => P.parasText(el.paras)).join('\n') : '';
    if (P.clip && (!txt || txt === clipTxt || P.clip.kind === 'slides')) { e.preventDefault(); P.pasteClip(); return; }
    if (txt) { e.preventDefault(); const page = P.page(), W = P.deck.size.w, H = P.deck.size.h; const tb = P.textBox(W * .2, H * .35, W * .6, 40); tb.paras = txt.replace(/\r/g, '').split('\n').map(l => P.para(l)); tb.fit = 'resize'; page.elements.push(tb); S.sel = [tb.id]; P.T.fit(tb); P.commit('Paste text'); }
  }

  /* ---------- keyboard ---------- */
  function onKey(e) {
    if (P.showing || P.modalOpen && P.modalOpen()) return;
    if (typing(e)) return;
    const mod = e.ctrlKey || e.metaKey, k = e.key, lk = k.toLowerCase();
    const sel = P.selected();
    const stop = () => { e.preventDefault(); e.stopPropagation(); };
    if (mod) {
      if (lk === 'z') { stop(); P.undo(); return; }
      if (lk === 'y') { stop(); P.redo(); return; }
      if (lk === 's') { stop(); e.shiftKey ? P.saveAs() : P.save(); return; }
      if (lk === 'o') { stop(); P.openFile(); return; }
      if (lk === 'n') { stop(); P.backstage('new'); return; }
      if (lk === 'p') { stop(); P.backstage('print'); return; }
      if (lk === 'm') { stop(); P.addSlide(); return; }
      if (lk === 'd') { stop(); if (P.slideFocus && P.slideFocus()) P.duplicateSlides(); else if (sel.length) P.duplicateSelected(); else P.duplicateSlides(); return; }
      if (lk === 'g' && !e.shiftKey) { stop(); P.groupSelected(); return; }
      if (lk === 'g' && e.shiftKey) { stop(); P.ungroupSelected(); return; }
      if (lk === 'a') { stop(); S.sel = P.page().elements.map(x => x.id); P.drawOverlay(); P.emit('selection'); return; }
      if (lk === 'f') { stop(); P.findDialog(false); return; }
      if (lk === 'h') { stop(); P.findDialog(true); return; }
      if (lk === 'k') { stop(); P.linkDialog(); return; }
      if (lk === 'b' && sel.length) { stop(); const st = P.currentTextStyle(); if (st) P.fmtRun({ b: !st.b }); return; }
      if (lk === 'i' && sel.length) { stop(); const st = P.currentTextStyle(); if (st) P.fmtRun({ i: !st.i }); return; }
      if (lk === 'u' && sel.length) { stop(); const st = P.currentTextStyle(); if (st) P.fmtRun({ u: !st.u }); return; }
      if (lk === 'l' && sel.length) { stop(); P.fmtPara({ align: 'l' }); return; }
      if (lk === 'e' && sel.length) { stop(); P.fmtPara({ align: 'ctr' }); return; }
      if (lk === 'r' && sel.length) { stop(); P.fmtPara({ align: 'r' }); return; }
      if (lk === 'j' && sel.length) { stop(); P.fmtPara({ align: 'just' }); return; }
      if ((k === ']' || k === '>') && sel.length) { stop(); P.bumpFont(1); return; }
      if ((k === '[' || k === '<') && sel.length) { stop(); P.bumpFont(-1); return; }
      if (lk === 'c' && e.shiftKey && sel.length) { stop(); P.startPainter(false); return; }
      if (lk === '=' || k === '+') { stop(); P.setZoom(P.getZoom() * 1.1); return; }
      if (k === '-') { stop(); P.setZoom(P.getZoom() * .9); return; }
      if (k === '0') { stop(); P.setZoom(null); return; }
      if (e.altKey === false && (k === 'ArrowUp' || k === 'ArrowDown' || k === 'ArrowLeft' || k === 'ArrowRight') && sel.length) { /* fine nudge */ stop(); const d = 1; nudge(k, d); return; }
      return;
    }
    if (k === 'F5') { stop(); P.startShow(e.shiftKey ? S.cur : 0); return; }
    if (k === 'F7') { stop(); P.spellHint && P.spellHint(); return; }
    if (k === 'Escape') {
      if (S.insert) { endInsert(); P.renderCanvas(); return; }
      if (S.ink) { P.setInk(null); return; }
      if (S.painter) { S.painter = null; stage.classList.remove('painting'); P.emit('selection'); return; }
      if (S.sel.length) { S.sel = []; P.drawOverlay(); P.emit('selection'); return; }
    }
    if (P.slideFocus && P.slideFocus()) {
      if (k === 'Delete' || k === 'Backspace') { stop(); P.deleteSlides(); return; }
      if (k === 'ArrowUp' || k === 'ArrowLeft') { stop(); P.gotoSlide(S.cur - 1); return; }
      if (k === 'ArrowDown' || k === 'ArrowRight') { stop(); P.gotoSlide(S.cur + 1); return; }
      if (k === 'Enter') { stop(); P.addSlide(); return; }
    }
    if (!sel.length) {
      if (k === 'PageDown' || k === 'ArrowDown' || k === 'ArrowRight') { stop(); P.gotoSlide(S.cur + 1); return; }
      if (k === 'PageUp' || k === 'ArrowUp' || k === 'ArrowLeft') { stop(); P.gotoSlide(S.cur - 1); return; }
      if (k === 'Tab') { stop(); const el = P.page().elements[e.shiftKey ? P.page().elements.length - 1 : 0]; if (el) { S.sel = [el.id]; P.drawOverlay(); P.emit('selection'); } return; }
      return;
    }
    if (k === 'Delete' || k === 'Backspace') { stop(); P.deleteSelected(); return; }
    if (k.startsWith('Arrow')) { stop(); nudge(k, e.altKey ? 1 : (S.grid ? (P.deck.gridStep || 36) / 6 : 6)); return; }
    if (k === 'PageDown') { stop(); P.gotoSlide(S.cur + 1); return; } if (k === 'PageUp') { stop(); P.gotoSlide(S.cur - 1); return; }
    if (k === 'Tab') { stop(); const els = P.page().elements, i = els.findIndex(x => x.id === S.sel[0]), n = els[(i + (e.shiftKey ? -1 : 1) + els.length) % els.length]; S.sel = [n.id]; P.drawOverlay(); P.emit('selection'); return; }
    if (k === 'F2' || k === 'Enter') { stop(); const el = sel[0]; if (el.type === 'table') P.T.begin(el.id, { cell: { r: 0, c: 0 } }); else if (!el.type || el.type === 'shape') P.T.begin(el.id, { selectAll: true }); return; }
    /* typing with a shape selected starts editing and replaces nothing but appends, as in the desktop app */
    if (k.length === 1 && sel.length === 1 && (!sel[0].type || sel[0].type === 'shape') && !P.isLineGeom(sel[0].geom) && !e.altKey) {
      P.T.begin(sel[0].id, { selectAll: !P.hasText(sel[0]) ? false : true });
    }
  }
  function nudge(k, d) {
    const dx = k === 'ArrowLeft' ? -d : k === 'ArrowRight' ? d : 0, dy = k === 'ArrowUp' ? -d : k === 'ArrowDown' ? d : 0;
    P.selected().forEach(el => { const b = P.box(el); P.setBox(el, { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h }); });
    updateConnectors(S.sel); P.commit('Nudge');
  }
  P.insertAtCenter = (el, w, hh) => { const D = P.deck.size; el.x = (D.w - w) / 2; el.y = (D.h - hh) / 2; el.w = w; el.h = hh; P.page().elements.push(el); S.sel = [el.id]; return el; };
  /* Fill an empty placeholder when one is available, as the desktop app does when inserting content */
  P.takePlaceholder = (types = ['obj', 'body']) => {
    const page = P.page(); if (page.kind) return null;
    return page.elements.find(e => e.ph && types.includes(e.ph.type) && !P.hasText(e)) || null;
  };
  P.placeIn = (ph, el) => {
    const page = P.page(), b = P.box(ph, page), i = page.elements.indexOf(ph);
    el.ph = { type: ph.ph.type, idx: ph.ph.idx };
    /* fit inside placeholder */
    if (el.aspect) { const r = el.aspect; let w = b.w, hh = w / r; if (hh > b.h) { hh = b.h; w = hh * r; } el.x = b.x + (b.w - w) / 2; el.y = b.y + (b.h - hh) / 2; el.w = w; el.h = hh; delete el.aspect; } else { el.x = b.x; el.y = b.y; el.w = b.w; el.h = b.h; }
    page.elements.splice(i, 1, el); S.sel = [el.id];
  };
})(window.P);
