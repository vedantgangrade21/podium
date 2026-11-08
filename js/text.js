/* Podium - rich text editing. contenteditable for caret & typing; the model is the source of truth for formatting. */
(function (P) {
  'use strict';
  const T = P.T = { active: null };

  /* ---- DOM <-> model ---- */
  const sameProps = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  T.parse = root => {
    const paras = [];
    const kids = [...root.children].filter(n => n.classList && n.classList.contains('p'));
    /* loose nodes: Chrome occasionally drops text directly into the root */
    if (!kids.length || [...root.childNodes].some(n => !(n.classList && n.classList.contains('p')) && !(n.nodeType === 3 && !n.nodeValue) && n.nodeName !== 'BR')) {
      let cur = null;
      const nodes = [...root.childNodes];
      nodes.forEach(n => {
        if (n.classList && n.classList.contains('p')) { cur = null; return; }
        if (n.nodeType === 3 && !n.nodeValue) return;
        if (n.nodeName === 'BR') return;
        if (!cur) { cur = h('div', { class: 'p' }); const pv = n.previousElementSibling; if (pv && pv.dataset.pp) cur.dataset.pp = pv.dataset.pp; root.insertBefore(cur, n); }
        cur.append(n);
      });
      if (!root.querySelector('.p')) { root.innerHTML = '<div class="p"><span class="r" data-r="{}"><br></span></div>'; }
    }
    [...root.children].forEach(pd => {
      if (!pd.classList.contains('p')) return;
      const para = pd.dataset.pp ? JSON.parse(pd.dataset.pp) : {};
      const runs = []; let lastProps = null, lastEmpty = null;
      const push = (t, props) => { if (!t) return; const last = runs[runs.length - 1]; if (last && sameProps(P.runProps(last), props) && !props.field) last.t += t; else runs.push(Object.assign({ t }, props)); };
      const walk = (n, props) => {
        if (n.nodeType === 3) { push(n.nodeValue.replace(/​/g, ''), props || lastProps || {}); return; }
        if (n.nodeName === 'BR') { if (n.nextSibling || (n.parentNode !== pd && n.parentNode.nextSibling)) push('\n', props || lastProps || {}); return; }
        if (n.dataset && n.dataset.r !== undefined) { const pr = JSON.parse(n.dataset.r || '{}'); lastProps = pr; lastEmpty = pr; n.childNodes.forEach(c => walk(c, pr)); return; }
        n.childNodes.forEach(c => walk(c, props));
      };
      pd.childNodes.forEach(c => walk(c, null));
      para.runs = runs;
      if (!runs.length && lastEmpty && Object.keys(lastEmpty).length) para.end = lastEmpty; else if (runs.length) delete para.end;
      paras.push(para);
    });
    return paras;
  };

  const nodeLen = n => { if (n.nodeType === 3) return n.nodeValue.length; if (n.nodeName === 'BR') return (n.nextSibling || (n.parentNode && !n.parentNode.classList.contains('p') && n.parentNode.nextSibling)) ? 1 : 0; let s = 0; n.childNodes.forEach(c => s += nodeLen(c)); return s; };
  const offsetIn = (pd, node, off) => {
    let total = 0, done = false;
    const walk = n => {
      if (done) return;
      if (n === node) {
        if (n.nodeType === 3) { total += off; done = true; return; }
        for (let i = 0; i < off && i < n.childNodes.length; i++) total += nodeLen(n.childNodes[i]);
        done = true; return;
      }
      if (n.nodeType === 3) { total += n.nodeValue.length; return; }
      if (n.nodeName === 'BR') { total += nodeLen(n); return; }
      n.childNodes.forEach(walk);
    };
    walk(pd); return total;
  };
  const pointOf = (root, pos) => {
    const paras = [...root.querySelectorAll(':scope > .p')]; const pd = paras[Math.min(pos.p, paras.length - 1)];
    if (!pd) return { node: root, off: 0 };
    let remain = pos.o, res = null;
    const walk = n => {
      if (res) return;
      if (n.nodeType === 3) { if (remain <= n.nodeValue.length) { res = { node: n, off: remain }; } else remain -= n.nodeValue.length; return; }
      if (n.nodeName === 'BR') { const l = nodeLen(n); if (remain === 0 || !l) { res = { node: n.parentNode, off: [...n.parentNode.childNodes].indexOf(n) }; return; } remain -= l; return; }
      n.childNodes.forEach(walk);
    };
    pd.childNodes.forEach(walk);
    return res || { node: pd, off: pd.childNodes.length };
  };
  T.getSel = () => {
    const a = T.active; if (!a) return null;
    const s = getSelection(); if (!s.rangeCount) return a.lastSel || null;
    const r = s.getRangeAt(0); if (!a.root.contains(r.startContainer)) return a.lastSel || null;
    const parasEls = [...a.root.querySelectorAll(':scope > .p')];
    const find = n => { while (n && n !== a.root) { if (n.classList && n.classList.contains('p')) return n; n = n.parentNode; } return null; };
    /* select-all (and some browser selections) anchor on the text container itself, counting paragraphs */
    const onRoot = (node, off, isEnd) => {
      if (node !== a.root || !parasEls.length) return null;
      if (isEnd) { const i = P.clamp(off - 1, 0, parasEls.length - 1), pd = parasEls[i]; return { p: i, o: offsetIn(pd, pd, pd.childNodes.length) }; }
      return { p: P.clamp(off, 0, parasEls.length - 1), o: 0 };
    };
    const rootA = onRoot(r.startContainer, r.startOffset, false), rootB = onRoot(r.endContainer, r.endOffset, true);
    const sp = find(r.startContainer), ep = find(r.endContainer);
    if ((!sp && !rootA) || (!ep && !rootB)) return a.lastSel || { a: { p: 0, o: 0 }, b: { p: 0, o: 0 } };
    const res = { a: rootA || { p: parasEls.indexOf(sp), o: offsetIn(sp, r.startContainer, r.startOffset) }, b: rootB || { p: parasEls.indexOf(ep), o: offsetIn(ep, r.endContainer, r.endOffset) } };
    a.lastSel = res; return res;
  };
  T.setSel = sel => {
    const a = T.active; if (!a || !sel) return;
    const s = getSelection(), r = document.createRange();
    const p1 = pointOf(a.root, sel.a), p2 = pointOf(a.root, sel.b);
    try { r.setStart(p1.node, p1.off); r.setEnd(p2.node, p2.off); s.removeAllRanges(); s.addRange(r); } catch (e) { console.warn(e); }
    a.lastSel = sel;
  };

  /* ---- model helpers ---- */
  const paraLen = p => (p.runs || []).reduce((n, r) => n + r.t.length, 0);
  /* make sure a run boundary exists at offset o; returns index of the run starting at o */
  const splitAt = (p, o) => {
    let n = 0; p.runs = p.runs || [];
    for (let i = 0; i < p.runs.length; i++) {
      const r = p.runs[i];
      if (o === n) return i;
      if (o < n + r.t.length) { const a = Object.assign({}, r, { t: r.t.slice(0, o - n) }), b = Object.assign({}, r, { t: r.t.slice(o - n) }); p.runs.splice(i, 1, a, b); return i + 1; }
      n += r.t.length;
    }
    return p.runs.length;
  };
  const merge = p => { const o = []; (p.runs || []).forEach(r => { if (!r.t) return; const l = o[o.length - 1]; if (l && !r.field && !l.field && sameProps(P.runProps(l), P.runProps(r))) l.t += r.t; else o.push(r); }); p.runs = o; };
  const patch = (r, props) => { for (const k in props) { if (props[k] === undefined || props[k] === null) delete r[k]; else r[k] = props[k]; } };
  const applyRange = (paras, sel, props) => {
    for (let i = sel.a.p; i <= sel.b.p; i++) {
      const p = paras[i]; if (!p) continue;
      const len = paraLen(p), s = i === sel.a.p ? sel.a.o : 0, e = i === sel.b.p ? sel.b.o : len;
      if (!len) { p.end = p.end || {}; patch(p.end, props); continue; }
      if (s === e && sel.a.p !== sel.b.p) continue;
      const si = splitAt(p, s), ei = splitAt(p, e);
      for (let j = si; j < ei; j++) patch(p.runs[j], props);
      if (i === sel.b.p && e === len) { p.end = p.end || {}; patch(p.end, props); }
      merge(p);
    }
  };
  const wordBounds = (text, o) => { const w = /[\p{L}\p{N}_'-]/u; if (!w.test(text[o] || '') && !w.test(text[o - 1] || '')) return null; let a = o, b = o; while (a > 0 && w.test(text[a - 1])) a--; while (b < text.length && w.test(text[b])) b++; return [a, b]; };

  /* ---- begin / end ---- */
  T.rootFor = (id, cell) => {
    const node = P.canvasEl(id); if (!node) return null;
    if (cell) { const td = node.querySelector(`td[data-r="${cell.r}"][data-c="${cell.c}"]`); return td && td.querySelector('.cell-in'); }
    return node.querySelector('.tbi');
  };
  T.begin = (id, opts = {}) => {
    const el = P.findEl(id); if (!el) return;
    if (el.type === 'table') { opts.cell = opts.cell || { r: 0, c: 0 }; }
    else if (el.type && el.type !== 'shape') return;
    if (T.active && T.active.id === id && (!opts.cell || (T.active.cell && T.active.cell.r === opts.cell.r && T.active.cell.c === opts.cell.c))) return;
    T.end();
    P.S.sel = [id];
    P.S.editing = { id, cell: opts.cell || null };
    P.renderCanvas();
    const root = T.rootFor(id, opts.cell); if (!root) { P.S.editing = null; return; }
    root.contentEditable = 'true'; root.spellcheck = true;
    T.active = { id, cell: opts.cell || null, root, el, stack: [], redo: [], startJson: JSON.stringify(opts.cell ? cellOf(el, opts.cell).paras : el.paras) };
    document.execCommand && document.execCommand('defaultParagraphSeparator', false, 'div');
    root.focus({ preventScroll: true });
    if (opts.point) {
      const rng = document.caretRangeFromPoint(opts.point.clientX, opts.point.clientY);
      if (rng && root.contains(rng.startContainer)) { const s = getSelection(); s.removeAllRanges(); s.addRange(rng); } else T.caretEnd();
    } else if (opts.selectAll) { const s = getSelection(), r = document.createRange(); r.selectNodeContents(root); s.removeAllRanges(); s.addRange(r); }
    else T.caretEnd();
    root.addEventListener('input', T.onInput);
    root.addEventListener('keydown', T.onKey);
    root.addEventListener('paste', T.onPaste);
    root.addEventListener('beforeinput', T.onBefore);
    P.drawOverlay(); P.emit('selection');
  };
  const cellOf = (el, c) => el.tbl.rows[c.r].cells[c.c];
  T.caretEnd = () => { const a = T.active; if (!a) return; const s = getSelection(), r = document.createRange(); r.selectNodeContents(a.root); r.collapse(false); s.removeAllRanges(); s.addRange(r); };
  T.sync = () => {
    const a = T.active; if (!a) return;
    const paras = T.parse(a.root);
    if (a.cell) cellOf(a.el, a.cell).paras = paras; else a.el.paras = paras;
    return paras;
  };
  T.end = (noCommit) => {
    const a = T.active; if (!a) return;
    const paras = T.sync();
    a.root.removeEventListener('input', T.onInput); a.root.removeEventListener('keydown', T.onKey); a.root.removeEventListener('paste', T.onPaste); a.root.removeEventListener('beforeinput', T.onBefore);
    a.root.contentEditable = 'false';
    T.active = null; P.S.editing = null;
    const el = a.el;
    getSelection().removeAllRanges();
    const hasText = paras.some(p => p.runs.some(r => r.t));
    if (!a.cell && el.txBox && !hasText) { /* an empty text box disappears, as in the real thing */
      const sib = P.siblings(el.id); sib.splice(sib.indexOf(el), 1); P.S.sel = [];
      P.commit('Delete empty text box'); return;
    }
    T.fit(el);
    if (a.cell) P.syncTableHeight && P.syncTableHeight(el);
    if (noCommit) { P.renderCanvas(); return; }
    if (JSON.stringify(a.cell ? cellOf(el, a.cell).paras : el.paras) !== a.startJson) P.commit('Typing'); else { P.renderCanvas(); P.emit('selection'); }
  };
  P.endText = () => T.end();

  /* Autofit: 'resize' grows the shape, 'shrink' scales the fonts */
  const scales = [100, 92.5, 85, 77.5, 70, 62.5, 55, 47.5, 40, 32.5, 25];
  let meas = null;
  const measureHost = () => { if (!meas) { meas = h('div', { class: 'pg', style: { position: 'fixed', left: '-99999px', top: 0, visibility: 'hidden', width: '4000px', height: '4000px' } }); document.body.append(meas); } return meas; };
  T.textHeight = (el, page, box) => {
    const host = measureHost(); host.innerHTML = '';
    const ctx = { page, deck: P.deck, mode: 'thumb', slideNo: 1 };
    const tb = P.renderText(el, ctx, box, { editing: true }); if (!tb) return 0;
    host.append(tb); tb.style.height = 'auto'; const i = tb.querySelector('.tbi');
    const r = tb.offsetHeight; void i; host.innerHTML = ''; return r;
  };
  T.fit = (el, page = P.page()) => {
    if (!el || el.type === 'table' || (el.type && el.type !== 'shape') || !el.paras) return;
    const fit = P.bodyProp(el, 'fit', page, P.deck, el.ph ? 'shrink' : 'none');
    const b = P.box(el, page);
    if (fit === 'resize' && P.hasText(el)) {
      const need = T.textHeight(Object.assign({}, el, { fontScale: undefined }), page, b);
      if (need && Math.abs(need - b.h) > .5) {
        const anchor = P.bodyProp(el, 'anchor', page, P.deck, 't');
        const dy = anchor === 'ctr' ? (b.h - need) / 2 : anchor === 'b' ? b.h - need : 0;
        el.x = b.x; el.y = b.y + dy; el.w = b.w; el.h = need;
      }
    } else if (fit === 'shrink') {
      if (!P.hasText(el)) { delete el.fontScale; delete el.lnReduc; return; }
      for (const s of scales) {
        const trial = Object.assign({}, el, { fontScale: s === 100 ? undefined : s, lnReduc: s === 100 ? undefined : s < 80 ? 20 : 10 });
        const need = T.textHeight(trial, page, b);
        if (need <= b.h + .5 || s === 25) { if (s === 100) { delete el.fontScale; delete el.lnReduc; } else { el.fontScale = s; el.lnReduc = trial.lnReduc; } break; }
      }
    }
  };

  /* Re-render the paragraphs in place, keeping the caret */
  T.refresh = (sel) => {
    const a = T.active; if (!a) return;
    const paras = a.cell ? cellOf(a.el, a.cell).paras : a.el.paras;
    const ctx = { page: P.page(), deck: P.deck, mode: 'edit', slideNo: P.S.cur + 1 };
    if (a.cell) { const st = P.cellStyle(a.el.tbl, a.cell.r, a.cell.c); ctx.cellStyle = { color: st.text || 'tx1', bold: !!st.bold, bullet: null, marL: 0, indent: 0, lineSp: 1, spcBef: 0, font: '+mn', size: a.el.tbl.size || 18, align: 'l' }; }
    a.root.innerHTML = ''; a.root.append(...P.renderParas(paras, a.cell ? { paras } : a.el, ctx, { editing: true }));
    a.root.focus({ preventScroll: true }); if (sel) T.setSel(sel);
    P.drawOverlay();
  };
  const pushUndo = () => { const a = T.active; if (!a) return; const paras = a.cell ? cellOf(a.el, a.cell).paras : a.el.paras; const s = JSON.stringify(paras); if (a.stack[a.stack.length - 1] !== s) a.stack.push(s); if (a.stack.length > 200) a.stack.shift(); a.redo = []; };
  let inputT = 0, fitT = 0;
  T.onInput = () => {
    const a = T.active; if (!a) return;
    clearTimeout(inputT); inputT = setTimeout(() => { if (T.active === a) { pushUndo(); } }, 350);
    T.sync(); a.pending = null;
    /* re-derive bullets numbering lazily; sync autofit */
    const el = a.el;
    if (!a.cell) {
      const fit = P.bodyProp(el, 'fit', P.page(), P.deck, el.ph ? 'shrink' : 'none');
      if (fit === 'resize') {
        const b = P.box(el), node = P.canvasEl(el.id), tb = node && node.querySelector('.tb');
        if (tb) { const was = tb.style.height; tb.style.height = 'auto'; const need = tb.offsetHeight; tb.style.height = was; if (need && Math.abs(need - b.h) > .5) { el.x = b.x; el.y = b.y; el.w = b.w; el.h = need; node.style.height = need + 'px'; tb.style.height = need + 'px'; const g = node.querySelector('.geo'); if (g) { g.setAttribute('viewBox', `0 0 ${b.w} ${need}`); g.style.height = need + 'px'; } P.drawOverlay(); } }
      } else if (fit === 'shrink') {
        clearTimeout(fitT); fitT = setTimeout(() => { if (T.active !== a) return; const before = a.el.fontScale; const s = T.getSel(); T.sync(); T.fit(a.el); if (before !== a.el.fontScale) T.refresh(s); }, 180);
      }
    } else { P.syncTableHeight && P.syncTableHeight(el, true); P.drawOverlay(); }
    P.emit('textchange');
  };
  T.onBefore = e => {
    const a = T.active; if (!a || !a.pending) return;
    if (e.inputType === 'insertText' && e.data) {
      e.preventDefault(); const sel = T.getSel(), props = a.pending; a.pending = null;
      pushUndo(); const paras = T.sync(), p = paras[sel.a.p]; const i = splitAt(p, sel.a.o);
      const base = P.runProps(p.runs[Math.max(0, i - 1)] || {}); const run = Object.assign({}, base, { t: e.data }); patch(run, props);
      p.runs.splice(i, 0, run); merge(p);
      const o = sel.a.o + e.data.length; T.refresh({ a: { p: sel.a.p, o }, b: { p: sel.a.p, o } });
    }
  };

  /* format the current selection (or word) while editing, otherwise whole shape(s) */
  P.fmtRun = (props, label = 'Format text') => {
    const a = T.active;
    if (a) {
      pushUndo(); let sel = T.getSel(); const paras = T.sync();
      const collapsed = sel.a.p === sel.b.p && sel.a.o === sel.b.o;
      if (collapsed) {
        const p = paras[sel.a.p], txt = (p.runs || []).map(r => r.t).join('');
        const w = wordBounds(txt, sel.a.o);
        if (w) { const s2 = { a: { p: sel.a.p, o: w[0] }, b: { p: sel.a.p, o: w[1] } }; applyRange(paras, s2, props); }
        else if (!txt) { applyRange(paras, sel, props); }
        else { a.pending = Object.assign(a.pending || {}, props); P.emit('selection'); return; }
      } else applyRange(paras, sel, props);
      T.refresh(sel); P.emit('selection'); T.fitLater(); return;
    }
    let touched = false;
    forSelectedText(el => { const paras = el; paras.forEach(p => { (p.runs || []).forEach(r => patch(r, props)); p.end = p.end || {}; patch(p.end, props); }); touched = true; });
    if (touched) { P.selected().forEach(el => T.fit(el)); P.commit(label); }
  };
  T.fitLater = () => { const a = T.active; if (!a) return; const s = T.getSel(); T.sync(); const f = a.el.fontScale; T.fit(a.el); if (f !== a.el.fontScale) T.refresh(s); else P.drawOverlay(); };
  const forSelectedText = fn => {
    P.selected().forEach(function w(el) {
      if (el.type === 'group') el.children.forEach(w);
      else if (el.type === 'table') el.tbl.rows.forEach(row => row.cells.forEach(c => { c.paras = c.paras || [P.para('')]; fn(c.paras); }));
      else if (!el.type || el.type === 'shape') { el.paras = el.paras || []; if (!el.paras.length) el.paras = [P.para('')]; fn(el.paras); }
    });
  };
  P.fmtPara = (props, label = 'Format paragraph') => {
    const a = T.active;
    const apply = p => { for (const k in props) { if (props[k] === undefined) delete p[k]; else p[k] = props[k]; } };
    if (a) { pushUndo(); const sel = T.getSel(), paras = T.sync(); for (let i = sel.a.p; i <= sel.b.p; i++) if (paras[i]) apply(paras[i]); T.refresh(sel); P.emit('selection'); T.fitLater(); return; }
    let any = false; forSelectedText(paras => { paras.forEach(apply); any = true; });
    if (any) { P.selected().forEach(el => T.fit(el)); P.commit(label); }
  };
  /* bump list level / paragraph props with a function */
  P.mapParas = (fn, label = 'Format paragraph') => {
    const a = T.active;
    if (a) { pushUndo(); const sel = T.getSel(), paras = T.sync(); for (let i = sel.a.p; i <= sel.b.p; i++) if (paras[i]) fn(paras[i]); T.refresh(sel); P.emit('selection'); T.fitLater(); return; }
    let any = false; forSelectedText(paras => { paras.forEach(fn); any = true; });
    if (any) { P.selected().forEach(el => T.fit(el)); P.commit(label); }
  };
  P.mapRuns = (fn, label = 'Format text') => {
    const a = T.active;
    if (a) { pushUndo(); const sel = T.getSel(), paras = T.sync();
      for (let i = sel.a.p; i <= sel.b.p; i++) { const p = paras[i], len = paraLen(p), s = i === sel.a.p ? sel.a.o : 0, e = i === sel.b.p ? sel.b.o : len; if (!len) continue; const si = splitAt(p, s), ei = splitAt(p, e); for (let j = si; j < ei; j++) fn(p.runs[j]); merge(p); }
      T.refresh(sel); T.fitLater(); return; }
    let any = false; forSelectedText(paras => { paras.forEach(p => (p.runs || []).forEach(fn)); any = true; });
    if (any) { P.selected().forEach(el => T.fit(el)); P.commit(label); }
  };

  /* Style shown in the ribbon */
  P.currentTextStyle = () => {
    const page = P.page();
    let el = null, para = null, run = null;
    if (T.active) {
      el = T.active.cell ? { paras: cellOf(T.active.el, T.active.cell).paras } : T.active.el;
      const sel = T.getSel() || { a: { p: 0, o: 0 } }; const paras = T.active.cell ? el.paras : (T.active.el.paras || []);
      para = paras[sel.a.p] || paras[0];
      /* a range shows the style of its first selected character; a caret, the character before it */
      const ranged = sel.b && (sel.a.p !== sel.b.p || sel.a.o !== sel.b.o);
      if (para) { let n = 0; for (const r of para.runs || []) { if (ranged ? (sel.a.o >= n && sel.a.o < n + r.t.length) : (sel.a.o > n && sel.a.o <= n + r.t.length)) { run = r; break; } if (sel.a.o === 0 && n === 0) { run = r; break; } n += r.t.length; } if (!run && para.runs && para.runs.length) run = para.runs[para.runs.length - 1]; if (!run) run = para.end; }
      if (T.active.pending) run = Object.assign({}, run, T.active.pending);
    } else {
      const s = P.selected()[0]; if (!s) return null;
      if (s.type === 'table') { const c = s.tbl.rows[0].cells[0]; el = { paras: c.paras }; para = (c.paras || [])[0]; run = para && para.runs && para.runs[0]; const st = P.cellStyle(s.tbl, 0, 0); return { font: P.fontName((run && run.font) || '+mn'), size: (run && run.size) || s.tbl.size || 18, b: !!(run && run.b), i: !!(run && run.i), u: !!(run && run.u), s: !!(run && run.s), align: (para && para.align) || 'l', color: (run && run.color) || st.text }; }
      if (s.type && s.type !== 'shape') return null;
      el = s; para = (s.paras || [])[0]; run = para && ((para.runs && para.runs[0]) || para.end);
    }
    if (!el) return null;
    const base = T.active && T.active.cell ? { size: T.active.el.tbl.size || 18, font: '+mn', align: 'l', lineSp: 1 } : P.baseStyle(el, (para && para.level) || 0, page);
    const r = run || {};
    return {
      font: P.fontName(r.font || base.font), size: r.size != null ? r.size : base.size, b: r.b != null ? !!r.b : !!base.bold, i: r.i != null ? !!r.i : !!base.italic, u: !!(r.u != null ? r.u : base.u), s: !!r.s, base: r.base, cap: r.cap, spc: r.spc, shadow: !!r.shadow,
      color: r.color || base.color, align: (para && para.align) || base.align || 'l', lineSp: (para && para.lineSp) || base.lineSp || 1, level: (para && para.level) || 0,
      bullet: para && para.bullet !== undefined ? para.bullet : base.bullet
    };
  };

  /* ---- keys ---- */
  const insertText = str => {
    const a = T.active; pushUndo(); const sel = T.getSel(); const paras = T.sync();
    /* delete selection */
    deleteRange(paras, sel);
    const lines = str.replace(/\r/g, '').split('\n');
    const p0 = paras[sel.a.p]; const i0 = splitAt(p0, sel.a.o);
    const tail = p0.runs.splice(i0);
    const baseR = P.runProps(p0.runs[p0.runs.length - 1] || tail[0] || p0.end || {});
    lines.forEach((ln, ix) => {
      if (ix === 0) { if (ln) p0.runs.push(Object.assign({}, baseR, { t: ln })); }
      else { const np = P.clone(p0); np.runs = ln ? [Object.assign({}, baseR, { t: ln })] : []; if (!ln) np.end = baseR; paras.splice(sel.a.p + ix, 0, np); }
    });
    const lastI = sel.a.p + lines.length - 1, last = paras[lastI];
    const o = paraLen(last); last.runs.push(...tail); paras.forEach(merge);
    if (a.cell) cellOf(a.el, a.cell).paras = paras; else a.el.paras = paras;
    T.refresh({ a: { p: lastI, o }, b: { p: lastI, o } }); T.fitLater();
  };
  T.insertText = insertText;
  const deleteRange = (paras, sel) => {
    if (sel.a.p === sel.b.p && sel.a.o === sel.b.o) return;
    const p1 = paras[sel.a.p], p2 = paras[sel.b.p];
    const i2 = splitAt(p2, sel.b.o), tail = p2.runs.slice(i2);
    const i1 = splitAt(p1, sel.a.o); p1.runs = p1.runs.slice(0, i1).concat(tail);
    if (sel.b.p > sel.a.p) paras.splice(sel.a.p + 1, sel.b.p - sel.a.p);
    merge(p1); sel.b = { p: sel.a.p, o: sel.a.o };
  };
  T.onPaste = e => {
    const items = e.clipboardData;
    if (items && [...items.items].some(i => i.type.startsWith('image/'))) return;
    e.preventDefault(); e.stopPropagation();
    const txt = (e.clipboardData || window.clipboardData).getData('text/plain');
    if (txt) insertText(txt);
  };
  T.onKey = e => {
    const a = T.active; if (!a) return;
    const k = e.key, mod = e.ctrlKey || e.metaKey;
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); const id = a.id; T.end(); P.S.sel = [id]; P.drawOverlay(); P.emit('selection'); return; }
    if (k === 'Enter' && !mod) {
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey) { insertText('\n'); return; }
      pushUndo(); const sel = T.getSel(), paras = T.sync(); deleteRange(paras, sel);
      const p = paras[sel.a.p], i = splitAt(p, sel.a.o), tail = p.runs.splice(i);
      const np = P.clone(p); np.runs = tail;
      const rp = P.runProps(p.runs[p.runs.length - 1] || tail[0] || p.end || {});
      if (!tail.length) np.end = rp; else delete np.end;
      if (!p.runs.length) p.end = rp;
      paras.splice(sel.a.p + 1, 0, np); paras.forEach(merge);
      const pos = { p: sel.a.p + 1, o: 0 }; T.refresh({ a: pos, b: pos }); T.fitLater(); return;
    }
    if (k === 'Tab') {
      e.preventDefault(); e.stopPropagation();
      if (a.cell) { P.moveCell && P.moveCell(e.shiftKey ? -1 : 1); return; }
      const sel = T.getSel(); const paras = T.sync(); const multi = sel.a.p !== sel.b.p; const atStart = sel.a.o === 0;
      const st = P.baseStyle(a.el, (paras[sel.a.p] && paras[sel.a.p].level) || 0);
      const para = paras[sel.a.p]; const bullet = para && (para.bullet !== undefined ? para.bullet : st.bullet);
      if (multi || atStart || (bullet && bullet.type && e.shiftKey)) { P.mapParas(p => { p.level = P.clamp((p.level || 0) + (e.shiftKey ? -1 : 1), 0, 8); if (!p.level) delete p.level; }, 'List level'); }
      else insertText('\t');
      return;
    }
    if (k === 'Backspace' && !mod) {
      const sel = T.getSel();
      if (sel.a.p === sel.b.p && sel.a.o === sel.b.o && sel.a.o === 0) {
        e.preventDefault(); e.stopPropagation();
        const paras = T.sync(); const p = paras[sel.a.p];
        if ((p.level || 0) > 0) { pushUndo(); p.level--; if (!p.level) delete p.level; T.refresh(sel); return; }
        if (sel.a.p === 0) return;
        pushUndo(); const prev = paras[sel.a.p - 1], o = paraLen(prev); prev.runs.push(...p.runs); paras.splice(sel.a.p, 1); merge(prev);
        const pos = { p: sel.a.p - 1, o }; T.refresh({ a: pos, b: pos }); return;
      }
      if (sel.a.p !== sel.b.p) { e.preventDefault(); e.stopPropagation(); pushUndo(); const paras = T.sync(); deleteRange(paras, sel); T.refresh({ a: sel.a, b: sel.a }); return; }
    }
    if (k === 'Delete' && !mod) {
      const sel = T.getSel(); const paras = T.sync();
      if (sel.a.p !== sel.b.p) { e.preventDefault(); e.stopPropagation(); pushUndo(); deleteRange(paras, sel); T.refresh({ a: sel.a, b: sel.a }); return; }
      if (sel.a.o === sel.b.o && sel.a.o === paraLen(paras[sel.a.p]) && sel.a.p < paras.length - 1) {
        e.preventDefault(); e.stopPropagation(); pushUndo(); const p = paras[sel.a.p], nx = paras[sel.a.p + 1]; p.runs.push(...nx.runs); paras.splice(sel.a.p + 1, 1); merge(p); T.refresh(sel); return;
      }
    }
    if (mod) {
      const lk = k.toLowerCase();
      const st = P.currentTextStyle() || {};
      const stop = () => { e.preventDefault(); e.stopPropagation(); };
      if (lk === 'b') { stop(); P.fmtRun({ b: !st.b }); return; }
      if (lk === 'i') { stop(); P.fmtRun({ i: !st.i }); return; }
      if (lk === 'u') { stop(); P.fmtRun({ u: !st.u }); return; }
      if (lk === 'l' && !e.shiftKey) { stop(); P.fmtPara({ align: 'l' }); return; }
      if (lk === 'e') { stop(); P.fmtPara({ align: 'ctr' }); return; }
      if (lk === 'r') { stop(); P.fmtPara({ align: 'r' }); return; }
      if (lk === 'j') { stop(); P.fmtPara({ align: 'just' }); return; }
      if (k === ']' || (e.shiftKey && k === '>')) { stop(); P.bumpFont(1); return; }
      if (k === '[' || (e.shiftKey && k === '<')) { stop(); P.bumpFont(-1); return; }
      if (lk === 'z') {
        stop();
        const cur = JSON.stringify(a.cell ? cellOf(a.el, a.cell).paras : a.el.paras); T.sync();
        const now = JSON.stringify(a.cell ? cellOf(a.el, a.cell).paras : a.el.paras); void cur;
        while (a.stack.length && a.stack[a.stack.length - 1] === now) a.stack.pop();
        if (a.stack.length) { a.redo.push(now); const prev = JSON.parse(a.stack.pop()); if (a.cell) cellOf(a.el, a.cell).paras = prev; else a.el.paras = prev; T.refresh(); T.caretEnd(); }
        else { T.end(); P.undo(); }
        return;
      }
      if (lk === 'y') { stop(); if (a.redo.length) { const n = JSON.parse(a.redo.pop()); if (a.cell) cellOf(a.el, a.cell).paras = n; else a.el.paras = n; T.refresh(); T.caretEnd(); } return; }
      if (lk === 'a') { stop(); const s = getSelection(), r = document.createRange(); r.selectNodeContents(a.root); s.removeAllRanges(); s.addRange(r); return; }
    }
    e.stopPropagation();
  };

  const stops = [8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 44, 48, 54, 60, 66, 72, 80, 88, 96];
  P.fontSizes = stops;
  P.bumpFont = dir => {
    const nextOf = s => { if (dir > 0) { const n = stops.find(v => v > s); return n || s + 10; } const n = [...stops].reverse().find(v => v < s); return n || Math.max(1, s - 1); };
    if (T.active) { const st = P.currentTextStyle(); P.fmtRun({ size: nextOf(st.size) }, 'Font size'); return; }
    P.selected().forEach(function w(el) {
      if (el.type === 'group') return el.children.forEach(w);
      if (el.type === 'table') { el.tbl.size = nextOf(el.tbl.size || 18); el.tbl.rows.forEach(r => r.cells.forEach(c => (c.paras || []).forEach(p => (p.runs || []).forEach(r2 => { if (r2.size) r2.size = nextOf(r2.size); })))); return; }
      if (el.type && el.type !== 'shape') return;
      (el.paras || []).forEach(p => { const b = P.baseStyle(el, p.level || 0); (p.runs || []).forEach(r => { r.size = nextOf(r.size != null ? r.size : b.size); }); if (p.end) p.end.size = nextOf(p.end.size != null ? p.end.size : b.size); });
      T.fit(el);
    });
    P.commit('Font size');
  };
})(window.P);
