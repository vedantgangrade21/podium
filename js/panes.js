/* Podium - slide panel, notes, status bar, views and the task panes */
(function (P) {
  'use strict';
  const S = P.S;
  let thumbs, notesEl, statusEl, pane, focusSlides = false;
  S.slideSel = [];

  /* ---------- slide operations ---------- */
  P.slideTitle = s => { const t = s.elements.find(e => e.ph && /title/i.test(e.ph.type) && e.ph.type !== 'subTitle'); const x = t ? P.parasText(t.paras).trim() : ''; return x || 'Slide'; };
  P.gotoSlide = i => { if (S.view === 'master') return; const n = P.clamp(i, 0, P.deck.slides.length - 1); if (P.T.active) P.T.end(); if (n === S.cur && S.slideSel.length <= 1) return; S.cur = n; S.sel = []; S.slideSel = [n]; syncNotes(); P.renderCanvas(); markThumbs(); P.emit('selection'); P.emit('slide'); drawStatus(); if (paneType === 'anim') drawPane(); };
  P.targetSlides = () => { if (S.slideSel.length > 1) return S.slideSel.map(i => P.deck.slides[i]).filter(Boolean); return [P.page()].filter(p => p && !p.kind); };
  P.slideFocus = () => focusSlides && S.view !== 'master';
  P.addSlide = layoutId => {
    P.T.end(); const d = P.deck; const cur = d.slides[S.cur];
    let lid = layoutId || (cur ? (cur.layout === 'title' ? 'obj' : cur.layout) : 'title');
    if (!d.slides.length && !layoutId) lid = 'title';
    const s = P.newSlide(lid); const at = d.slides.length ? S.cur + 1 : 0; d.slides.splice(at, 0, s);
    if (d.sections.length) { const sec = sectionOfIdx(S.cur); if (sec) sec.slideIds.push(s.id); }
    S.cur = at; S.slideSel = [at]; S.sel = []; P.commit('New slide', { all: true });
  };
  P.duplicateSlides = () => {
    P.T.end(); const d = P.deck; const idx = selectedIdx(); const last = idx[idx.length - 1]; const copies = idx.map(i => cloneSlide(d.slides[i]));
    d.slides.splice(last + 1, 0, ...copies); S.cur = last + copies.length; S.slideSel = [S.cur]; S.sel = []; P.commit('Duplicate slide', { all: true });
  };
  const cloneSlide = s => { const c = P.clone(s); c.id = P.uid('s'); const map = {}; P.walk(c.elements, e => { const n = P.uid(); map[e.id] = n; e.id = n; }); (c.animations || []).forEach(a => { a.id = P.uid('a'); a.el = map[a.el] || a.el; }); P.walk(c.elements, e => { if (e.conn) { ['st', 'end'].forEach(k => { if (e.conn[k]) e.conn[k].id = map[e.conn[k].id] || e.conn[k].id; }); } }); return c; };
  const selectedIdx = () => (S.slideSel.length ? S.slideSel.slice().sort((a, b) => a - b) : [S.cur]);
  P.deleteSlides = () => {
    const d = P.deck, idx = selectedIdx(); if (d.slides.length - idx.length < 0) return;
    const ids = idx.map(i => d.slides[i].id);
    idx.slice().reverse().forEach(i => d.slides.splice(i, 1));
    d.sections.forEach(sec => sec.slideIds = sec.slideIds.filter(x => !ids.includes(x)));
    if (!d.slides.length) { d.slides.push(P.newSlide('title')); }
    S.cur = Math.min(idx[0], d.slides.length - 1); S.slideSel = [S.cur]; S.sel = []; P.commit('Delete slide', { all: true });
  };
  P.copySlides = () => { P.clip = { kind: 'slides', slides: selectedIdx().map(i => P.clone(P.deck.slides[i])) }; P.toast('Slide copied.'); };
  P.pasteSlides = () => { if (!P.clip || P.clip.kind !== 'slides') return; const c = P.clip.slides.map(cloneSlide); c.forEach(s => { if (!P.deck.layouts.some(l => l.id === s.layout)) s.layout = P.deck.layouts[1].id; }); P.deck.slides.splice(S.cur + 1, 0, ...c); S.cur += c.length; S.slideSel = [S.cur]; P.commit('Paste slide', { all: true }); };
  P.moveSlides = (idx, to) => { const d = P.deck; const items = idx.map(i => d.slides[i]); const before = d.slides[to]; const rest = d.slides.filter(s => !items.includes(s)); let at = before ? rest.indexOf(before) : rest.length; if (at < 0) at = rest.length; rest.splice(at, 0, ...items); d.slides = rest; S.cur = d.slides.indexOf(items[0]); S.slideSel = items.map(s => d.slides.indexOf(s)); P.commit('Move slide', { all: true }); };
  P.setLayout = id => {
    P.T.end(); P.targetSlides().forEach(s => {
      const lay = P.deck.layouts.find(l => l.id === id); if (!lay) return;
      const phs = lay.elements.filter(e => e.ph && !['dt', 'ftr', 'sldNum'].includes(e.ph.type));
      const used = new Set(); const assign = [];
      s.elements.filter(e => e.ph && !['dt', 'ftr', 'sldNum'].includes(e.ph.type)).forEach(e => {
        const isT = t => ['title', 'ctrTitle'].includes(t);
        let m = phs.find(p => !used.has(p) && (p.ph.type === e.ph.type || (isT(p.ph.type) && isT(e.ph.type))));
        if (!m) m = phs.find(p => !used.has(p) && !isT(p.ph.type) && !isT(e.ph.type) && (p.ph.type !== 'pic' || e.type === 'image'));
        if (m) { used.add(m); assign.push([e, m]); } else if (!P.hasText(e) && (!e.type || e.type === 'shape')) e.__drop = true; else { const b = P.box(e, s); P.setBox(e, b); delete e.ph; }
      });
      s.elements = s.elements.filter(e => !e.__drop);
      assign.forEach(([e, m]) => { e.ph = { type: m.ph.type, idx: m.ph.idx }; if (!e.type || e.type === 'shape') { delete e.x; delete e.y; delete e.w; delete e.h; } delete e.fontScale; });
      phs.filter(p => !used.has(p)).forEach(p => s.elements.push({ id: P.uid(), type: 'shape', geom: 'rect', name: p.name + ' ' + (s.elements.length + 1), ph: { type: p.ph.type, idx: p.ph.idx }, paras: [] }));
      s.layout = id;
      s.elements.forEach(e => P.T.fit(e, s));
    });
    S.sel = []; P.commit('Change layout', { all: true });
  };
  P.resetSlide = () => { P.T.end(); P.targetSlides().forEach(s => { s.elements.forEach(e => { if (e.ph && (!e.type || e.type === 'shape')) { delete e.x; delete e.y; delete e.w; delete e.h; delete e.rot; delete e.lst; delete e.fill; delete e.line; delete e.anchor; delete e.fontScale; delete e.lnReduc; (e.paras || []).forEach(p => { ['align', 'lineSp', 'spcBef', 'spcAft', 'marL', 'indent', 'bullet'].forEach(k => delete p[k]); (p.runs || []).forEach(r => { Object.keys(r).forEach(k => { if (!['t', 'field', 'link'].includes(k)) delete r[k]; }); }); }); P.T.fit(e, s); } }); }); P.commit('Reset slide', { all: true }); };
  P.hideSlides = () => { const list = P.targetSlides(); const v = !list[0].hidden; list.forEach(s => { s.hidden = v || undefined; }); P.commit(v ? 'Hide slide' : 'Show slide', { all: true }); };
  /* sections */
  const sectionOfIdx = i => { const id = P.deck.slides[i] && P.deck.slides[i].id; return P.deck.sections.find(s => s.slideIds.includes(id)); };
  P.sectionMenu = () => [{ label: 'Add Section', fn: () => P.prompt('Add Section', 'Section name:', 'Untitled Section', v => addSection(v)) }, { label: 'Rename Section', disabled: !sectionOfIdx(S.cur), fn: () => { const sec = sectionOfIdx(S.cur); P.prompt('Rename Section', 'Section name:', sec.name, v => { sec.name = v; P.commit('Rename section', { all: true }); }); } }, { label: 'Remove Section', disabled: !sectionOfIdx(S.cur), fn: () => { const sec = sectionOfIdx(S.cur); const secs = P.deck.sections; const i = secs.indexOf(sec); if (i > 0) secs[i - 1].slideIds.push(...sec.slideIds); secs.splice(i, 1); P.commit('Remove section', { all: true }); } }, { label: 'Remove All Sections', disabled: !P.deck.sections.length, fn: () => { P.deck.sections = []; P.commit('Remove sections', { all: true }); } }, '-', { label: 'Collapse All', fn: () => { P.deck.sections.forEach(s => s.collapsed = true); drawThumbs(); } }, { label: 'Expand All', fn: () => { P.deck.sections.forEach(s => s.collapsed = false); drawThumbs(); } }];
  const addSection = name => {
    const d = P.deck; const curId = d.slides[S.cur].id;
    if (!d.sections.length) { const before = d.slides.slice(0, S.cur).map(s => s.id), after = d.slides.slice(S.cur).map(s => s.id); if (before.length) d.sections.push({ id: P.uid('c'), name: 'Default Section', slideIds: before }); d.sections.push({ id: P.uid('c'), name, slideIds: after }); }
    else { const sec = sectionOfIdx(S.cur); const i = sec.slideIds.indexOf(curId); const rest = sec.slideIds.splice(i); const at = d.sections.indexOf(sec) + 1; d.sections.splice(at, 0, { id: P.uid('c'), name, slideIds: rest }); if (!sec.slideIds.length) d.sections.splice(d.sections.indexOf(sec), 1); }
    P.commit('Add section', { all: true });
  };
  /* layout picker */
  P.layoutPicker = (fn, withExtras) => {
    const box = h('div', { class: 'layout-picker' }); box.append(h('div', { class: 'menu-head', text: P.deck.master.name || 'Layouts' }));
    const grid = h('div', { class: 'layout-grid' });
    P.deck.layouts.forEach(l => { const b = h('button', { class: 'layout-i', title: l.name }); b.append(layoutThumb(l, 112), h('span', { text: l.name })); b.onclick = () => { P.closePopup(); fn(l.id); }; grid.append(b); });
    box.append(grid);
    if (withExtras) box.append(P.menuList([{ label: 'Duplicate Selected Slides', icon: 'copy', fn: () => P.duplicateSlides() }, { label: 'Slides from Outline…', icon: 'outline', fn: () => P.slidesFromOutline() }, { label: 'Reuse Slides…', icon: 'folder', fn: () => P.reuseSlides() }]));
    return box;
  };
  const layoutThumb = (l, w) => {
    const tmp = { kind: 'layout', elements: l.elements, id: l.id, showMaster: l.showMaster, bg: l.bg };
    const box = P.thumb(tmp, w, { mode: 'edit' }); box.classList.add('layout-th'); return box;
  };
  P.slidesFromOutline = async () => { const f = await P.pickFile('.txt,.md,text/plain'); if (!f[0]) return; const txt = await f[0].text(); const blocks = txt.split(/\r?\n/); let cur = null; let n = 0; blocks.forEach(line => { if (!line.trim()) return; if (!/^\s/.test(line)) { cur = P.newSlide('obj'); cur.elements[0].paras = [P.para(line.trim().replace(/^#+\s*/, ''))]; P.deck.slides.splice(S.cur + 1 + n, 0, cur); n++; } else if (cur) { const m = /^(\s*)/.exec(line)[1].length; cur.elements[1].paras = cur.elements[1].paras || []; cur.elements[1].paras.push(P.para(line.trim().replace(/^[-*•]\s*/, ''), { level: Math.max(0, Math.floor(m / 2) - 1) })); } }); if (n) { S.cur += n; P.commit('Slides from outline', { all: true }); } };
  P.reuseSlides = async () => { const f = await P.pickFile('.pptx'); if (!f[0]) return; const other = await P.readPptx(f[0]); const list = h('div', { class: 'reuse-list' }); other.slides.forEach((s, i) => { const b = h('button', { class: 'reuse-i', title: 'Insert this slide' }); b.append(P.thumb(s, 180, { deck: other, index: i })); b.onclick = () => { const c = cloneSlide(s); c.layout = (P.deck.layouts.find(l => l.type === P.layoutOf(s, other).type) || P.deck.layouts[1]).id; P.walk(c.elements, e => { ['src', 'poster'].forEach(k => { if (e[k] && e[k].startsWith('media:')) { const m = other.media[e[k].slice(6)]; if (m) { P.deck.media[m.id] = m; } } }); }); P.deck.slides.splice(S.cur + 1, 0, c); S.cur++; P.commit('Reuse slide', { all: true }); P.toast('Slide inserted.'); }; list.append(b); }); P.modal({ title: 'Reuse Slides: click a slide to insert it', width: 660, body: list, buttons: [['Close', () => true]] }); };

  /* ---------- thumbnails ---------- */
  const THUMB_W = () => Math.max(100, (document.getElementById('leftPane').clientWidth || 200) - 44);
  const markThumbs = () => { if (!thumbs) return; thumbs.querySelectorAll('.st').forEach(n => { const i = +n.dataset.i; n.classList.toggle('on', i === S.cur); n.classList.toggle('sel2', S.slideSel.includes(i)); }); const c = thumbs.querySelector('.st.on'); if (c && focusSlides === false) c.scrollIntoView({ block: 'nearest' }); };
  const thumbNode = (s, i, w) => {
    const n = h('div', { class: 'st' + (i === S.cur ? ' on' : '') + (s.hidden ? ' hid' : '') + (S.slideSel.includes(i) ? ' sel2' : ''), draggable: true }); n.dataset.i = i;
    const left = h('div', { class: 'st-n' }, h('span', { text: i + 1 })); if (s.transition && s.transition.type && s.transition.type !== 'none' || (s.animations && s.animations.length)) left.append(h('span', { class: 'st-star', text: '★', title: 'Has transition or animations' })); if (s.comments && s.comments.length) left.append(h('span', { class: 'st-cmt', html: P.icon('comment', 11) }));
    const fr = h('div', { class: 'st-f' }); fr.append(P.thumb(s, w, { index: i }));
    n.append(left, fr);
    n.addEventListener('pointerdown', e => {
      focusSlides = true;
      if (e.button === 2 && S.slideSel.includes(i)) return;
      if (e.shiftKey) { const a = Math.min(S.cur, i), b = Math.max(S.cur, i); S.slideSel = []; for (let k = a; k <= b; k++) S.slideSel.push(k); markThumbs(); return; }
      if (e.ctrlKey) { S.slideSel = S.slideSel.includes(i) ? S.slideSel.filter(k => k !== i) : S.slideSel.concat(i); markThumbs(); return; }
      S.slideSel = [i]; if (i !== S.cur) { const t = S.cur; void t; S.cur = -1; P.gotoSlide(i); } else markThumbs();
    });
    n.addEventListener('contextmenu', e => { e.preventDefault(); P.popupMenu(e.clientX, e.clientY, slideMenu(i)); });
    n.addEventListener('dragstart', e => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/x-podium-slide', String(i)); dragIdx = S.slideSel.includes(i) ? selectedIdx() : [i]; });
    n.addEventListener('dragover', e => { e.preventDefault(); const r = n.getBoundingClientRect(); const after = (e.clientY - r.top) > r.height / 2; thumbs.querySelectorAll('.drop-a,.drop-b').forEach(x => x.classList.remove('drop-a', 'drop-b')); n.classList.add(after ? 'drop-a' : 'drop-b'); });
    n.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); const r = n.getBoundingClientRect(); const after = (e.clientY - r.top) > r.height / 2; thumbs.querySelectorAll('.drop-a,.drop-b').forEach(x => x.classList.remove('drop-a', 'drop-b')); if (dragIdx) P.moveSlides(dragIdx, after ? i + 1 : i); dragIdx = null; });
    return n;
  };
  let dragIdx = null;
  const slideMenu = () => [{ label: 'Cut', icon: 'cut', fn: () => { P.copySlides(); P.deleteSlides(); } }, { label: 'Copy', icon: 'copy', fn: () => P.copySlides() }, { label: 'Paste', icon: 'paste', disabled: !P.clip || P.clip.kind !== 'slides', fn: () => P.pasteSlides() }, '-', { label: 'New Slide', icon: 'newslide', fn: () => P.addSlide() }, { label: 'Duplicate Slide', icon: 'copy', fn: () => P.duplicateSlides() }, { label: 'Delete Slide', icon: 'trash', fn: () => P.deleteSlides() }, '-', { label: 'Add Section', icon: 'section', fn: () => P.prompt('Add Section', 'Section name:', 'Untitled Section', v => addSection(v)) }, { label: 'Layout', icon: 'layout', sub: () => P.deck.layouts.map(l => ({ label: l.name, fn: () => P.setLayout(l.id) })) }, { label: 'Reset Slide', icon: 'reset', fn: () => P.resetSlide() }, '-', { label: 'Format Background…', icon: 'background', fn: () => P.openPane('background') }, { label: 'Hide Slide', icon: 'hide', check: P.page() && P.page().hidden, fn: () => P.hideSlides() }, { label: 'New Comment', icon: 'newcomment', fn: () => P.addComment() }];
  const drawThumbs = () => {
    if (!thumbs) return; const st = thumbs.scrollTop;
    thumbs.innerHTML = ''; const w = THUMB_W();
    if (S.view === 'master') { drawMasterThumbs(w); return; }
    if (S.outline) { drawOutline(); return; }
    const secs = P.deck.sections || [];
    if (secs.length) {
      const claimed = new Set();
      secs.forEach(sec => {
        const head = h('div', { class: 'sec-h' }); const tog = h('button', { class: 'sec-t', text: sec.collapsed ? '▸' : '▾' }); tog.onclick = () => { sec.collapsed = !sec.collapsed; drawThumbs(); }; head.append(tog, h('span', { text: `${sec.name} (${sec.slideIds.length})` }));
        head.addEventListener('contextmenu', e => { e.preventDefault(); const i0 = P.deck.slides.findIndex(s => s.id === sec.slideIds[0]); if (i0 >= 0) P.gotoSlide(i0); P.popupMenu(e.clientX, e.clientY, P.sectionMenu()); });
        thumbs.append(head);
        sec.slideIds.forEach(id => { claimed.add(id); const i = P.deck.slides.findIndex(s => s.id === id); if (i >= 0 && !sec.collapsed) thumbs.append(thumbNode(P.deck.slides[i], i, w)); });
      });
      P.deck.slides.forEach((s, i) => { if (!claimed.has(s.id)) thumbs.append(thumbNode(s, i, w)); });
    } else P.deck.slides.forEach((s, i) => thumbs.append(thumbNode(s, i, w)));
    thumbs.scrollTop = st;
  };
  const refreshThumb = i => { if (!thumbs || S.view === 'master' || S.outline) return drawThumbs(); const n = thumbs.querySelector(`.st[data-i="${i}"]`); const s = P.deck.slides[i]; if (n && s) n.replaceWith(thumbNode(s, i, THUMB_W())); else drawThumbs(); };
  const drawMasterThumbs = w => {
    const add = (pg, label, sub) => { const n = h('div', { class: 'st master' + (sub ? ' sub' : '') + ((S.master || 'master') === pg.id ? ' on' : ''), title: label }); const fr = h('div', { class: 'st-f' }); fr.append(P.thumb(pg, sub ? w * .8 : w, { mode: 'edit' })); n.append(h('div', { class: 'st-n' }, h('span', { text: sub ? '' : '1' })), fr); n.addEventListener('pointerdown', () => { P.T.end(); S.master = pg.id; S.sel = []; P.renderCanvas(); drawThumbs(); P.emit('selection'); drawStatus(); }); thumbs.append(n); };
    add(P.deck.master, P.deck.master.name, false); P.deck.layouts.forEach(l => add(l, l.name, true));
  };
  /* outline view */
  const drawOutline = () => {
    const box = h('div', { class: 'outline' });
    P.deck.slides.forEach((s, i) => {
      const row = h('div', { class: 'ol-s' + (i === S.cur ? ' on' : '') });
      const t = s.elements.find(e => e.ph && /title/i.test(e.ph.type) && e.ph.type !== 'subTitle');
      const bodyEls = s.elements.filter(e => e !== t && e.paras && (!e.type || e.type === 'shape') && (e.ph));
      const ti = h('div', { class: 'ol-t', contentEditable: true, spellcheck: true, text: t ? P.parasText(t.paras) : '' });
      ti.onfocus = () => { S.cur = -1; P.gotoSlide(i); }; ti.onblur = () => { if (t && ti.textContent !== P.parasText(t.paras)) { t.paras = [P.para(ti.textContent, {}, (t.paras[0] && t.paras[0].runs && t.paras[0].runs[0]) ? P.runProps(t.paras[0].runs[0]) : {})]; P.T.fit(t, s); P.commit('Outline edit'); } };
      ti.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); ti.blur(); } };
      row.append(h('div', { class: 'ol-n', html: `${i + 1} ${P.icon('normal', 13)}` }), ti);
      bodyEls.forEach(b => {
        const area = h('div', { class: 'ol-b', contentEditable: true, spellcheck: true }); area.innerText = P.parasText(b.paras);
        area.onfocus = () => { S.cur = -1; P.gotoSlide(i); };
        area.onblur = () => { const lines = area.innerText.replace(/\n$/, '').split('\n'); if (lines.join('\n') !== P.parasText(b.paras)) { const old = b.paras || []; b.paras = lines.map((l, k) => { const q = old[k] ? P.clone(old[k]) : {}; q.runs = l ? [Object.assign({}, old[k] && old[k].runs && old[k].runs[0] ? P.runProps(old[k].runs[0]) : {}, { t: l })] : []; return q; }); P.T.fit(b, s); P.commit('Outline edit'); } };
        area.onkeydown = e => e.stopPropagation(); row.append(area);
      });
      box.append(row);
    });
    thumbs.append(box);
  };

  /* ---------- notes & status ---------- */
  const syncNotes = () => { if (!notesEl) return; const p = P.page(); if (document.activeElement !== notesEl) notesEl.value = (p && p.notes) || ''; };
  const drawStatus = () => {
    if (!statusEl) return; const p = P.page();
    statusEl.querySelector('.s-slide').textContent = S.view === 'master' ? (p ? `Slide Master: ${p.name || ''}` : 'Slide Master') : `Slide ${S.cur + 1} of ${P.deck.slides.length}`;
    statusEl.querySelector('.s-notes').classList.toggle('on', S.showNotes);
    statusEl.querySelector('.s-cmt').classList.toggle('on', !!S.showComments);
    statusEl.querySelector('.s-z').textContent = Math.round(P.getZoom() * 100) + '%';
    const r = statusEl.querySelector('input[type=range]'); if (r && document.activeElement !== r) r.value = zoomToSlider(P.getZoom());
    ['normal', 'sorter', 'reading'].forEach(v => { const b = statusEl.querySelector('.s-v-' + v); if (b) b.classList.toggle('on', S.view === v); });
  };
  const zoomToSlider = z => Math.round(z <= 1 ? z * 50 : 50 + (z - 1) * 50 / 3);
  const sliderToZoom = v => (v <= 50 ? Math.max(.1, v / 50) : 1 + (v - 50) * 3 / 50);

  /* ---------- views ---------- */
  P.setView = v => {
    P.T.end(); S.sel = [];
    const shell = document.getElementById('workspace');
    if (v === 'outline') { S.outline = true; S.view = 'normal'; } else { S.outline = false; S.view = v; }
    if (v !== 'master') S.master = null;
    shell.dataset.view = S.view;
    document.getElementById('sorter').style.display = S.view === 'sorter' ? 'block' : 'none';
    document.getElementById('notesPage').style.display = S.view === 'notes' ? 'flex' : 'none';
    if (S.view === 'sorter') drawSorter(); if (S.view === 'notes') drawNotesPage();
    if (S.view === 'normal' || S.view === 'master') { drawThumbs(); P.renderCanvas(); setTimeout(P.layoutCanvas, 0); }
    P.emit('view'); P.emit('selection'); drawStatus();
  };
  P.toggleView = k => { if (k === 'notes') { S.showNotes = !S.showNotes; document.getElementById('notesPane').style.display = S.showNotes ? '' : 'none'; setTimeout(P.layoutCanvas, 0); drawStatus(); P.updateRibbon(); return; } S[k] = !S[k]; if (k === 'ruler') { document.getElementById('workspace').classList.toggle('with-ruler', S.ruler); setTimeout(P.layoutCanvas, 0); } P.drawOverlay(); P.updateRibbon(); };
  P.drawRulers = () => {
    const rh = document.getElementById('rulerH'), rv = document.getElementById('rulerV'); if (!rh || !S.ruler) return;
    const host = document.getElementById('host').getBoundingClientRect(), hr = rh.getBoundingClientRect(), vr = rv.getBoundingClientRect(); const z = P.getZoom(), D = P.deck.size;
    const mk = (len, off, total, vert) => { let o = ''; const step = 36 * z; const cx = off + total * z / 2; for (let k = -Math.ceil(cx / step); k * step + cx < len; k++) { const pos = cx + k * step; const major = k % 2 === 0; o += vert ? `<path d="M${major ? 3 : 10} ${pos}H16" stroke="#888"/>` : `<path d="M${pos} ${major ? 3 : 10}V16" stroke="#888"/>`; if (major && k) o += vert ? `<text x="1" y="${pos - 2}" font-size="9" fill="#555">${Math.abs(k / 2)}</text>` : `<text x="${pos + 2}" y="10" font-size="9" fill="#555">${Math.abs(k / 2)}</text>`; } return o; };
    rh.innerHTML = `<svg width="100%" height="18">${mk(hr.width, host.left - hr.left, D.w, false)}</svg>`;
    rv.innerHTML = `<svg width="18" height="100%">${mk(vr.height, host.top - vr.top, D.h, true)}</svg>`;
  };
  const drawSorter = () => {
    const box = document.getElementById('sorter'); box.innerHTML = ''; const w = 220;
    P.deck.slides.forEach((s, i) => {
      const n = h('div', { class: 'sort-i' + (S.slideSel.includes(i) || i === S.cur ? ' on' : '') + (s.hidden ? ' hid' : ''), draggable: true });
      n.append(P.thumb(s, w, { index: i }), h('div', { class: 'sort-l', html: `<span>${i + 1}</span>${s.transition && s.transition.type && s.transition.type !== 'none' ? '<span class="st-star">★</span>' : ''}${s.transition && s.transition.advAfter != null ? `<span>${(s.transition.advAfter / 1000).toFixed(1)}s</span>` : ''}` }));
      n.onclick = e => { if (e.ctrlKey) S.slideSel = S.slideSel.includes(i) ? S.slideSel.filter(k => k !== i) : S.slideSel.concat(i); else { S.slideSel = [i]; S.cur = i; } focusSlides = true; drawSorter(); };
      n.ondblclick = () => { S.cur = i; P.setView('normal'); };
      n.oncontextmenu = e => { e.preventDefault(); if (!S.slideSel.includes(i)) { S.slideSel = [i]; S.cur = i; } P.popupMenu(e.clientX, e.clientY, slideMenu(i)); };
      n.ondragstart = () => { dragIdx = S.slideSel.includes(i) ? selectedIdx() : [i]; }; n.ondragover = e => e.preventDefault(); n.ondrop = e => { e.preventDefault(); if (dragIdx) { P.moveSlides(dragIdx, i); dragIdx = null; } };
      box.append(n);
    });
  };
  const drawNotesPage = () => {
    const box = document.getElementById('notesPage'); box.innerHTML = '';
    const pg = h('div', { class: 'np-paper' }); pg.append(P.thumb(P.page(), 500, { index: S.cur }));
    const ta = h('textarea', { class: 'np-t', placeholder: 'Click to add notes', value: P.page().notes || '' }); ta.oninput = () => { P.page().notes = ta.value; P.dirty = true; }; ta.onchange = () => P.commit('Notes', { silent: true }); ta.onkeydown = e => e.stopPropagation();
    const nav = h('div', { class: 'np-nav' }); const p1 = h('button', { class: 'btn', text: '◀ Prev' }); p1.onclick = () => { if (S.cur > 0) { S.cur--; drawNotesPage(); drawStatus(); } }; const p2 = h('button', { class: 'btn', text: 'Next ▶' }); p2.onclick = () => { if (S.cur < P.deck.slides.length - 1) { S.cur++; drawNotesPage(); drawStatus(); } }; nav.append(p1, h('span', { text: `Slide ${S.cur + 1}` }), p2);
    pg.append(ta, nav); box.append(pg);
  };

  /* ---------- task panes ---------- */
  let paneType = null, paneTab = 'fill';
  P.paneOpen = () => paneType;
  P.openPane = (type, tab) => {
    if (type === paneType && !tab) { type = null; }
    paneType = type; if (tab) paneTab = tab;
    pane.style.display = type ? 'flex' : 'none'; drawPane(); setTimeout(P.layoutCanvas, 0);
  };
  const paneHead = title => { const hd = h('div', { class: 'pane-h' }, h('span', { text: title })); const x = h('button', { class: 'modal-x', html: P.icon('close', 12) }); x.onclick = () => { if (paneType === 'comments') { S.showComments = false; P.drawOverlay(); } P.openPane(null); }; hd.append(x); return hd; };
  const drawPane = () => {
    if (!pane || !paneType) return; const st = pane.querySelector('.pane-scroll'); const sc = st ? st.scrollTop : 0; pane.innerHTML = '';
    const map = { format: drawFormat, background: drawBackground, selection: drawSelection, anim: drawAnim, comments: drawComments, access: drawAccess };
    (map[paneType] || (() => {}))();
    const ns = pane.querySelector('.pane-scroll'); if (ns) ns.scrollTop = sc;
  };
  P.refreshPanes = drawPane;
  const section = (title, kids, open = true) => { const d = h('details', { class: 'fp-sec', open }); d.append(h('summary', { text: title }), h('div', { class: 'fp-b' }, kids)); return d; };
  const row = (label, ctrl) => h('div', { class: 'fp-r' }, h('span', { text: label }), ctrl);

  /* fill / line editors shared between shape & background */
  const fillEditor = (get, set, opts = {}) => {
    const f = get() || { type: 'none' }; const box = h('div', { class: 'fill-ed' });
    const radios = opts.background ? [['solid', 'Solid fill'], ['gradient', 'Gradient fill'], ['picture', 'Picture or texture fill'], ['pattern', 'Pattern fill']] : [['none', 'No fill'], ['solid', 'Solid fill'], ['gradient', 'Gradient fill'], ['picture', 'Picture or texture fill'], ['pattern', 'Pattern fill']];
    const nm = 'fe' + Math.random();
    radios.forEach(([v, n]) => box.append(P.radio(nm, n, f.type === v, () => {
      if (v === 'none') set({ type: 'none' });
      if (v === 'solid') set({ type: 'solid', color: (f.color || (f.stops && f.stops[0].color)) || 'accent1' });
      if (v === 'gradient') set({ type: 'gradient', kind: 'linear', angle: 90, stops: [{ pos: 0, color: f.color || 'accent1:60,40' }, { pos: 100, color: f.color ? f.color + (f.color.includes(':') ? '' : ':50,0') : 'accent1' }] });
      if (v === 'pattern') set({ type: 'pattern', preset: 'pct50', fg: f.color || 'accent1', bg: 'bg1' });
      if (v === 'picture') P.pickFile('image/*').then(fs => { if (fs[0]) set({ type: 'picture', src: 'media:' + P.addMedia(fs[0], fs[0].name) }); else drawPane(); });
    })));
    if (f.type === 'solid') { box.append(row('Color', P.colorBtn(f.color, c => set(Object.assign({}, f, { color: c }))))); box.append(row('Transparency', P.numInput(Math.round((1 - (f.opacity == null ? 1 : f.opacity)) * 100), { min: 0, max: 100, step: 5, unit: '%', on: v => set(Object.assign({}, f, { opacity: v ? 1 - v / 100 : undefined })) }))); }
    if (f.type === 'gradient') {
      box.append(row('Type', P.select([['linear', 'Linear'], ['radial', 'Radial'], ['path', 'Path']], f.kind || 'linear', v => set(Object.assign({}, f, { kind: v })))));
      box.append(row('Angle', P.numInput(f.angle || 0, { step: 15, unit: '°', on: v => set(Object.assign({}, f, { angle: v })) })));
      const bar = h('div', { class: 'grad-bar' }); bar.style.background = `linear-gradient(90deg,${f.stops.map(s => `${P.color(s.color)} ${s.pos}%`).join(',')})`; box.append(bar);
      f.stops.forEach((s, i) => { const r = h('div', { class: 'fp-r stop' }, h('span', { text: 'Stop ' + (i + 1) }), P.colorBtn(s.color, c => { const n = P.clone(f); n.stops[i].color = c; set(n); }), P.numInput(s.pos, { min: 0, max: 100, step: 5, unit: '%', on: v => { const n = P.clone(f); n.stops[i].pos = v; n.stops.sort((a, b) => a.pos - b.pos); set(n); } })); const del = h('button', { class: 'mini', html: P.icon('close', 10) }); del.onclick = () => { if (f.stops.length > 2) { const n = P.clone(f); n.stops.splice(i, 1); set(n); } }; r.append(del); box.append(r); });
      const add = h('button', { class: 'btn small', text: 'Add stop' }); add.onclick = () => { const n = P.clone(f); const l = n.stops[n.stops.length - 1]; n.stops.push({ pos: Math.min(100, (n.stops[n.stops.length - 2].pos + l.pos) / 2), color: l.color }); n.stops.sort((a, b) => a.pos - b.pos); set(n); }; box.append(add);
    }
    if (f.type === 'picture') { const b = h('button', { class: 'btn small', text: 'Insert picture…' }); b.onclick = async () => { const fs = await P.pickFile('image/*'); if (fs[0]) set(Object.assign({}, f, { src: 'media:' + P.addMedia(fs[0], fs[0].name) })); }; box.append(b, P.checkbox('Tile picture as texture', f.tile, v => set(Object.assign({}, f, { tile: v || undefined })))); box.append(row('Transparency', P.numInput(Math.round((1 - (f.opacity == null ? 1 : f.opacity)) * 100), { min: 0, max: 100, step: 5, unit: '%', on: v => set(Object.assign({}, f, { opacity: v ? 1 - v / 100 : undefined })) }))); }
    if (f.type === 'pattern') { box.append(row('Pattern', P.select(P.patternNames, f.preset, v => set(Object.assign({}, f, { preset: v }))))); box.append(row('Foreground', P.colorBtn(f.fg, c => set(Object.assign({}, f, { fg: c }))))); box.append(row('Background', P.colorBtn(f.bg, c => set(Object.assign({}, f, { bg: c }))))); }
    return box;
  };
  /* apply to selection */
  const eachSel = (fn, label) => { P.selected().forEach(function w(e) { if (e.type === 'group') e.children.forEach(w); else fn(e); }); P.commit(label); };
  const drawFormat = () => {
    const sel = P.selected(); const el = sel[0];
    const isPic = el && el.type === 'image'; const title = !el ? 'Format Shape' : isPic ? 'Format Picture' : el.type === 'table' ? 'Format Table' : el.type === 'chart' ? 'Format Chart' : 'Format Shape';
    pane.append(paneHead(title));
    const tabs = h('div', { class: 'fp-tabs' }); const mk = (k, ic2, t) => { const b = h('button', { class: 'fp-tab' + (paneTab === k ? ' on' : ''), title: t, html: P.icon(ic2, 18) }); b.onclick = () => { paneTab = k; drawPane(); }; return b; };
    tabs.append(mk('fill', 'fill', 'Fill & Line'), mk('effects', 'effects', 'Effects'), mk('size', 'slidesize', 'Size & Properties')); if (isPic) tabs.append(mk('picture', 'picture', 'Picture')); else tabs.append(mk('text', 'textbox', 'Text Box'));
    pane.append(tabs);
    const body = h('div', { class: 'pane-scroll' }); pane.append(body);
    if (!el) { body.append(h('div', { class: 'hint pad', text: 'Select an object to format it.' })); return; }
    if (paneTab === 'fill') {
      if (!isPic && el.type !== 'chart' && el.type !== 'video' && el.type !== 'audio' && el.type !== 'table') body.append(section('Fill', [fillEditor(() => el.fill !== undefined ? el.fill : P.bodyProp(el, 'fill'), v => eachSel(e => { e.fill = v; }, 'Fill'))]));
      const ln = el.line && el.line.type !== 'none' ? el.line : null;
      const lineBox = h('div'); const nm = 'ln' + Math.random();
      lineBox.append(P.radio(nm, 'No line', !ln, () => eachSel(e => { e.line = { type: 'none' }; }, 'Line')), P.radio(nm, 'Solid line', !!ln, () => eachSel(e => { e.line = { type: 'solid', color: 'accent1', width: 1 }; }, 'Line')));
      if (ln) {
        const upd = o => eachSel(e => { e.line = Object.assign({}, e.line, o); }, 'Line');
        lineBox.append(row('Color', P.colorBtn(ln.color, c => upd({ color: c }))), row('Transparency', P.numInput(Math.round((1 - (ln.opacity == null ? 1 : ln.opacity)) * 100), { min: 0, max: 100, step: 5, unit: '%', on: v => upd({ opacity: v ? 1 - v / 100 : undefined }) })), row('Width', P.numInput(ln.width == null ? 1 : ln.width, { min: 0, step: .25, unit: ' pt', on: v => upd({ width: v }) })), row('Dash type', P.select([['solid', 'Solid'], ['sysDot', 'Round Dot'], ['sysDash', 'Square Dot'], ['dash', 'Dash'], ['dashDot', 'Dash Dot'], ['lgDash', 'Long Dash'], ['lgDashDot', 'Long Dash Dot'], ['lgDashDotDot', 'Long Dash Dot Dot']], ln.dash || 'solid', v => upd({ dash: v }))), row('Cap type', P.select([['butt', 'Flat'], ['round', 'Round'], ['square', 'Square']], ln.cap || 'butt', v => upd({ cap: v }))), row('Join type', P.select([['round', 'Round'], ['bevel', 'Bevel'], ['miter', 'Miter']], ln.join || 'round', v => upd({ join: v }))));
        const ends = [['none', 'None'], ['triangle', 'Arrow'], ['arrow', 'Open Arrow'], ['stealth', 'Stealth'], ['diamond', 'Diamond'], ['oval', 'Oval']]; const szs = [['sm', 'Small'], ['med', 'Medium'], ['lg', 'Large']];
        lineBox.append(row('Begin arrow', P.select(ends, (ln.head && ln.head.type) || 'none', v => upd({ head: v === 'none' ? undefined : { type: v, size: (ln.head && ln.head.size) || 'med' } }))), row('Begin size', P.select(szs, (ln.head && ln.head.size) || 'med', v => { if (ln.head) upd({ head: Object.assign({}, ln.head, { size: v }) }); })), row('End arrow', P.select(ends, (ln.tail && ln.tail.type) || 'none', v => upd({ tail: v === 'none' ? undefined : { type: v, size: (ln.tail && ln.tail.size) || 'med' } }))), row('End size', P.select(szs, (ln.tail && ln.tail.size) || 'med', v => { if (ln.tail) upd({ tail: Object.assign({}, ln.tail, { size: v }) }); })));
      }
      if (el.type !== 'chart' && el.type !== 'table') body.append(section('Line', [lineBox]));
    } else if (paneTab === 'effects') {
      const fx = el.fx || {}; const up = (k, v) => eachSel(e => { e.fx = Object.assign({}, e.fx); if (v) e.fx[k] = v; else delete e.fx[k]; if (!Object.keys(e.fx).length) delete e.fx; }, 'Effects');
      const sh = fx.shadow; const shBox = [P.checkbox('Shadow', !!sh, v => up('shadow', v ? { color: '#000000', blur: 5, dist: 3, dir: 45, opacity: .4 } : null))];
      if (sh) shBox.push(row('Color', P.colorBtn(sh.color, c => up('shadow', Object.assign({}, sh, { color: c })))), row('Transparency', P.numInput(Math.round((1 - sh.opacity) * 100), { min: 0, max: 100, step: 5, unit: '%', on: v => up('shadow', Object.assign({}, sh, { opacity: 1 - v / 100 })) })), row('Blur', P.numInput(sh.blur, { min: 0, step: 1, unit: ' pt', on: v => up('shadow', Object.assign({}, sh, { blur: v })) })), row('Angle', P.numInput(sh.dir, { step: 15, unit: '°', on: v => up('shadow', Object.assign({}, sh, { dir: v })) })), row('Distance', P.numInput(sh.dist, { min: 0, step: 1, unit: ' pt', on: v => up('shadow', Object.assign({}, sh, { dist: v })) })));
      body.append(section('Shadow', shBox));
      const rf = fx.reflect; const rfb = [P.checkbox('Reflection', !!rf, v => up('reflect', v ? { size: 50, dist: 2, opacity: .4 } : null))]; if (rf) rfb.push(row('Size', P.numInput(rf.size, { min: 0, max: 100, step: 5, unit: '%', on: v => up('reflect', Object.assign({}, rf, { size: v })) })), row('Distance', P.numInput(rf.dist, { min: 0, step: 1, unit: ' pt', on: v => up('reflect', Object.assign({}, rf, { dist: v })) })), row('Transparency', P.numInput(Math.round((1 - rf.opacity) * 100), { min: 0, max: 100, step: 5, unit: '%', on: v => up('reflect', Object.assign({}, rf, { opacity: 1 - v / 100 })) }))); body.append(section('Reflection', rfb));
      const gl = fx.glow; const glb = [P.checkbox('Glow', !!gl, v => up('glow', v ? { color: 'accent1', rad: 8, opacity: .6 } : null))]; if (gl) glb.push(row('Color', P.colorBtn(gl.color, c => up('glow', Object.assign({}, gl, { color: c })))), row('Size', P.numInput(gl.rad, { min: 0, step: 1, unit: ' pt', on: v => up('glow', Object.assign({}, gl, { rad: v })) }))); body.append(section('Glow', glb));
      body.append(section('Soft Edges', [row('Size', P.numInput((fx.soft && fx.soft.rad) || 0, { min: 0, step: 1, unit: ' pt', on: v => up('soft', v ? { rad: v } : null) }))]));
      const r3 = fx.rot3d || { x: 0, y: 0, persp: 800 }; body.append(section('3-D Rotation', [row('X rotation', P.numInput(r3.y, { step: 5, unit: '°', on: v => up('rot3d', Object.assign({}, r3, { y: v })) })), row('Y rotation', P.numInput(r3.x, { step: 5, unit: '°', on: v => up('rot3d', Object.assign({}, r3, { x: v })) })), row('Perspective', P.numInput(r3.persp, { min: 100, step: 100, on: v => up('rot3d', Object.assign({}, r3, { persp: v })) }))]));
    } else if (paneTab === 'size') {
      const b = P.box(el); const set = (k, v) => P.setDim(k, v); const pos = (k, v) => { const nb = P.box(el); nb[k] = v; P.setBox(el, nb); P.updateConnectors([el.id]); P.commit('Position'); };
      body.append(section('Size', [row('Height', P.numInput(b.h / 72, { step: .1, min: .01, unit: '"', on: v => set('h', v * 72) })), row('Width', P.numInput(b.w / 72, { step: .1, min: .01, unit: '"', on: v => set('w', v * 72) })), row('Rotation', P.numInput(el.rot || 0, { step: 15, unit: '°', on: v => { if (el.x === undefined) P.setBox(el, P.box(el)); el.rot = ((v % 360) + 360) % 360 || undefined; P.commit('Rotation'); } })), P.checkbox('Lock aspect ratio', el.lockAR || el.type === 'image', v => { el.lockAR = v || undefined; P.commit('Lock aspect', { silent: true }); })]));
      body.append(section('Position', [row('Horizontal', P.numInput(b.x / 72, { step: .1, unit: '"', on: v => pos('x', v * 72) })), row('Vertical', P.numInput(b.y / 72, { step: .1, unit: '"', on: v => pos('y', v * 72) }))]));
      const ta = h('textarea', { class: 'field wide', rows: 3, value: el.alt || '' }); ta.onkeydown = e => e.stopPropagation(); ta.onchange = () => { el.alt = ta.value; P.commit('Alt text', { silent: true }); };
      body.append(section('Alt Text', [ta]));
    } else if (paneTab === 'text') {
      const ins = P.bodyProp(el, 'ins', P.page(), P.deck, [7.2, 3.6, 7.2, 3.6]); const up = (k, v) => eachSel(e => { e[k] = v; P.T.fit(e); }, 'Text options');
      body.append(section('Text Box', [
        row('Vertical alignment', P.select([['t', 'Top'], ['ctr', 'Middle'], ['b', 'Bottom']], P.bodyProp(el, 'anchor', P.page(), P.deck, 't'), v => up('anchor', v))),
        row('Text direction', P.select([['', 'Horizontal'], ['vert', 'Rotate all text 90°'], ['vert270', 'Rotate all text 270°']], el.vert || '', v => up('vert', v || undefined))),
        h('div', { class: 'fp-r' }, h('span', { text: 'Autofit' })),
        ...[['none', 'Do not Autofit'], ['shrink', 'Shrink text on overflow'], ['resize', 'Resize shape to fit text']].map(([v, n]) => P.radio('fit' + el.id, n, P.bodyProp(el, 'fit', P.page(), P.deck, el.ph ? 'shrink' : 'none') === v, () => { if (v !== 'shrink') { delete el.fontScale; delete el.lnReduc; } up('fit', v); })),
        row('Left margin', P.numInput(ins[0] / 72, { step: .05, min: 0, unit: '"', on: v => { const n = ins.slice(); n[0] = v * 72; up('ins', n); } })), row('Right margin', P.numInput(ins[2] / 72, { step: .05, min: 0, unit: '"', on: v => { const n = ins.slice(); n[2] = v * 72; up('ins', n); } })), row('Top margin', P.numInput(ins[1] / 72, { step: .05, min: 0, unit: '"', on: v => { const n = ins.slice(); n[1] = v * 72; up('ins', n); } })), row('Bottom margin', P.numInput(ins[3] / 72, { step: .05, min: 0, unit: '"', on: v => { const n = ins.slice(); n[3] = v * 72; up('ins', n); } })),
        P.checkbox('Wrap text in shape', P.bodyProp(el, 'wrap', P.page(), P.deck, true) !== false, v => up('wrap', v ? undefined : false)),
        row('Columns', P.numInput(el.cols || 1, { step: 1, min: 1, max: 6, on: v => up('cols', v > 1 ? v : undefined) }))
      ]));
    } else if (paneTab === 'picture') {
      const a = el.adjust || {}; const up = (k, v) => { el.adjust = Object.assign({}, el.adjust, { [k]: v }); P.commit('Picture corrections'); };
      body.append(section('Picture Corrections', [row('Brightness', P.numInput(a.bright || 0, { min: -100, max: 100, step: 5, unit: '%', on: v => up('bright', v) })), row('Contrast', P.numInput(a.contrast || 0, { min: -100, max: 100, step: 5, unit: '%', on: v => up('contrast', v) }))]));
      body.append(section('Picture Color', [row('Saturation', P.numInput(a.sat == null ? 100 : a.sat, { min: 0, max: 400, step: 10, unit: '%', on: v => up('sat', v) })), P.checkbox('Grayscale', a.gray, v => up('gray', v || undefined))]));
      body.append(section('Picture Transparency', [row('Transparency', P.numInput(Math.round((1 - (a.opacity == null ? 1 : a.opacity)) * 100), { min: 0, max: 100, step: 5, unit: '%', on: v => up('opacity', 1 - v / 100) }))]));
      const c = el.crop || {}; const cr = (k, v) => { el.crop = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, el.crop, { [k]: v / 100 }); P.commit('Crop'); };
      body.append(section('Crop', [row('Left', P.numInput((c.l || 0) * 100, { min: 0, max: 95, step: 1, unit: '%', on: v => cr('l', v) })), row('Right', P.numInput((c.r || 0) * 100, { min: 0, max: 95, step: 1, unit: '%', on: v => cr('r', v) })), row('Top', P.numInput((c.t || 0) * 100, { min: 0, max: 95, step: 1, unit: '%', on: v => cr('t', v) })), row('Bottom', P.numInput((c.b || 0) * 100, { min: 0, max: 95, step: 1, unit: '%', on: v => cr('b', v) }))]));
    }
  };
  const drawBackground = () => {
    pane.append(paneHead('Format Background')); const body = h('div', { class: 'pane-scroll' }); pane.append(body);
    const pg = P.page(); if (!pg) return;
    const cur = pg.bg || P.bgOf(pg);
    body.append(section('Fill', [fillEditor(() => cur, v => { pg.bg = v; P.commit('Background', { all: !!pg.kind }); }, { background: true }), pg.kind ? null : P.checkbox('Hide background graphics', pg.showMaster === false, v => { pg.showMaster = v ? false : undefined; P.commit('Background graphics'); }), h('div', { class: 'fp-btns' }, (() => { const a = h('button', { class: 'btn small', text: 'Reset Background' }); a.onclick = () => { delete pg.bg; P.commit('Reset background', { all: !!pg.kind }); }; return a; })(), pg.kind ? null : (() => { const a = h('button', { class: 'btn small', text: 'Apply to All' }); a.onclick = () => { P.deck.slides.forEach(s => { if (pg.bg) s.bg = P.clone(pg.bg); else delete s.bg; }); P.commit('Background', { all: true }); }; return a; })())]));
  };
  const drawSelection = () => {
    pane.append(paneHead('Selection')); const tools = h('div', { class: 'fp-btns' });
    const sa = h('button', { class: 'btn small', text: 'Show All' }); sa.onclick = () => { P.walk(P.page().elements, e => { delete e.hidden; }); P.commit('Show all'); }; const ha = h('button', { class: 'btn small', text: 'Hide All' }); ha.onclick = () => { P.walk(P.page().elements, e => { e.hidden = true; }); P.commit('Hide all'); };
    const up = h('button', { class: 'mini', html: P.icon('up', 14), title: 'Bring forward' }); up.onclick = () => P.zorder('forward'); const dn = h('button', { class: 'mini', html: P.icon('down', 14), title: 'Send backward' }); dn.onclick = () => P.zorder('backward');
    tools.append(sa, ha, up, dn); pane.append(tools);
    const list = h('div', { class: 'pane-scroll sel-list' }); pane.append(list);
    const addRow = (el, depth) => {
      const r = h('div', { class: 'sel-row' + (S.sel.includes(el.id) ? ' on' : '') }); r.style.paddingLeft = 8 + depth * 14 + 'px';
      const name = h('span', { class: 'sel-n', text: el.name || (el.type || 'Shape') }); name.ondblclick = () => { name.contentEditable = true; name.focus(); }; name.onblur = () => { name.contentEditable = false; el.name = name.textContent; P.commit('Rename object', { silent: true }); }; name.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); name.blur(); } };
      const eye = h('button', { class: 'mini', html: P.icon(el.hidden ? 'eyeoff' : 'eye', 14) }); eye.onclick = ev => { ev.stopPropagation(); el.hidden = !el.hidden || undefined; P.commit('Visibility'); };
      r.append(name, eye); r.onclick = e => { if (e.ctrlKey) S.sel = S.sel.includes(el.id) ? S.sel.filter(x => x !== el.id) : S.sel.concat(el.id); else S.sel = [el.id]; P.drawOverlay(); P.emit('selection'); drawPane(); };
      list.append(r);
      if (el.children) el.children.slice().reverse().forEach(c => addRow(c, depth + 1));
    };
    P.page().elements.slice().reverse().forEach(e => addRow(e, 0));
  };
  const drawAnim = () => {
    pane.append(paneHead('Animation Pane')); const tools = h('div', { class: 'fp-btns' });
    const play = h('button', { class: 'btn small', html: P.icon('play', 12) + ' Play All' }); play.onclick = () => P.previewSlide('anim'); tools.append(play); pane.append(tools);
    const list = h('div', { class: 'pane-scroll anim-list' }); pane.append(list);
    const sl = P.page(); if (!sl || sl.kind) return; const arr = sl.animations || []; let click = 0;
    if (!arr.length) list.append(h('div', { class: 'hint pad', text: 'Select an object on the slide and choose an effect from the Animation gallery.' }));
    arr.forEach((a, i) => {
      if (a.start === 'click') click++;
      const el = P.findEl(a.el, sl), m = P.animMeta(a.effect) || { name: a.effect, cat: 'entr' };
      const r = h('div', { class: 'anim-row' + (S.sel.includes(a.el) ? ' on' : ''), draggable: true });
      const dur = (a.dur == null ? P.animDefaultDur(a.effect) : a.dur), del = a.delay || 0;
      const bar = h('div', { class: 'anim-bar ' + m.cat }); bar.style.marginLeft = Math.min(40, del / 100) + 'px'; bar.style.width = Math.max(4, Math.min(60, dur / 50)) + 'px';
      r.append(h('span', { class: 'anim-n', text: a.start === 'click' ? click : '' }), h('span', { class: 'an-g ' + m.cat, text: '★' }), h('span', { class: 'anim-t', text: `${(el && el.name) || 'Object'}`, title: `${m.name}: ${el && el.name}` }), h('div', { class: 'anim-tl' }, bar));
      const more = h('button', { class: 'mini', text: '▾' }); more.onclick = ev => { ev.stopPropagation(); P.popup(more, P.menuList([{ label: 'Start On Click', check: a.start === 'click', fn: () => { a.start = 'click'; P.commit('Animation start'); } }, { label: 'Start With Previous', check: a.start === 'with', fn: () => { a.start = 'with'; P.commit('Animation start'); } }, { label: 'Start After Previous', check: a.start === 'after', fn: () => { a.start = 'after'; P.commit('Animation start'); } }, '-', { label: 'Effect Options…', fn: () => animOptions(a) }, { label: 'Remove', icon: 'trash', fn: () => { sl.animations.splice(i, 1); P.commit('Remove animation'); } }])); }; r.append(more);
      r.onclick = () => { S.sel = [a.el]; P.drawOverlay(); P.emit('selection'); drawPane(); };
      r.ondblclick = () => animOptions(a);
      r.ondragstart = e => { e.dataTransfer.setData('text/plain', String(i)); }; r.ondragover = e => e.preventDefault(); r.ondrop = e => { e.preventDefault(); const f = +e.dataTransfer.getData('text/plain'); const [x] = sl.animations.splice(f, 1); sl.animations.splice(i, 0, x); P.commit('Reorder animation'); };
      list.append(r);
    });
  };
  const animOptions = a => { const m = P.animMeta(a.effect); let start = a.start, dur = (a.dur == null ? P.animDefaultDur(a.effect) : a.dur) / 1000, del = (a.delay || 0) / 1000, rep = a.repeat || 1, dir = a.dir; P.modal({ title: m.name, width: 360, body: h('div', {}, P.field('Start:', P.select([['click', 'On Click'], ['with', 'With Previous'], ['after', 'After Previous']], start, v => start = v)), P.field('Delay (s):', P.numInput(del, { step: .25, min: 0, on: v => del = v })), P.field('Duration (s):', P.numInput(dur, { step: .25, min: .01, on: v => dur = v })), P.field('Repeat:', P.numInput(rep, { step: 1, min: 1, on: v => rep = v })), m.dirs ? P.field('Direction:', P.select(P.animDirs[m.dirs], dir, v => dir = v)) : null), buttons: [['OK', () => { a.start = start; a.dur = dur * 1000; a.delay = del * 1000; a.repeat = rep > 1 ? rep : undefined; a.dir = dir; P.commit('Animation options'); return true; }, true], ['Cancel', () => true]] }); };
  /* ---------- comments ---------- */
  const author = () => { try { return localStorage.getItem('podium.author') || 'You'; } catch (_) { return 'You'; } };
  P.addComment = () => { const pg = P.page(); if (!pg || pg.kind) return; S.showComments = true; P.openPane('comments', undefined); if (paneType !== 'comments') P.openPane('comments'); const box = pane.querySelector('.cmt-new textarea'); if (box) box.focus(); };
  P.deleteComment = () => { const pg = P.page(); if (pg && pg.comments && pg.comments.length) { pg.comments.pop(); P.commit('Delete comment'); } };
  P.stepComment = d => { const n = P.deck.slides.length; for (let k = 1; k <= n; k++) { const i = (S.cur + d * k + n * 2) % n; if ((P.deck.slides[i].comments || []).length) { P.gotoSlide(i); S.showComments = true; if (paneType !== 'comments') P.openPane('comments'); P.drawOverlay(); return; } } P.toast('No other comments.'); };
  const drawComments = () => {
    pane.append(paneHead('Comments')); const pg = P.page(); const list = h('div', { class: 'pane-scroll cmts' }); pane.append(list); if (!pg || pg.kind) return;
    (pg.comments || []).forEach((c, i) => {
      const card = h('div', { class: 'cmt' + (c.resolved ? ' res' : '') }); card.append(h('div', { class: 'cmt-h' }, h('b', { text: c.author }), h('span', { text: new Date(c.date).toLocaleString() })), h('div', { class: 'cmt-b', text: c.text }));
      (c.replies || []).forEach(r => card.append(h('div', { class: 'cmt-r' }, h('b', { text: r.author + ' ' }), h('span', { text: r.text }))));
      const rp = h('input', { class: 'field wide', placeholder: 'Reply…' }); rp.onkeydown = e => { e.stopPropagation(); if (e.key === 'Enter' && rp.value.trim()) { c.replies = c.replies || []; c.replies.push({ author: author(), text: rp.value.trim(), date: new Date().toISOString() }); P.commit('Reply'); } };
      const del = h('button', { class: 'mini', html: P.icon('trash', 13), title: 'Delete thread' }); del.onclick = () => { pg.comments.splice(i, 1); P.commit('Delete comment'); }; const res = h('button', { class: 'mini', html: P.icon('check', 13), title: 'Resolve thread' }); res.onclick = () => { c.resolved = !c.resolved; P.commit('Resolve comment'); };
      card.append(h('div', { class: 'cmt-a' }, rp, res, del)); list.append(card);
    });
    const ta = h('textarea', { class: 'field wide', rows: 3, placeholder: 'Start a new comment' }); ta.onkeydown = e => e.stopPropagation();
    const add = h('button', { class: 'btn primary small', text: 'Post' }); add.onclick = () => { if (!ta.value.trim()) return; pg.comments = pg.comments || []; const n = pg.comments.length; pg.comments.push({ id: P.uid('c'), author: author(), text: ta.value.trim(), date: new Date().toISOString(), x: 14 + n * 24, y: 14 }); P.commit('New comment', { }); };
    pane.append(h('div', { class: 'cmt-new' }, ta, add));
  };
  /* ---------- review ---------- */
  P.spellHint = () => { P.toast('Spell check is live: misspelled words get a red underline while you edit text. Right-click a word for suggestions.'); };
  P.wordCount = () => { let w = 0, c = 0, paras = 0; P.deck.slides.forEach(s => P.walk(s.elements, e => { const push = pp => (pp || []).forEach(p => { const t = (p.runs || []).map(r => r.t).join(''); if (t.trim()) { paras++; w += t.trim().split(/\s+/).length; c += t.length; } }); push(e.paras); if (e.tbl) e.tbl.rows.forEach(r => r.cells.forEach(x => push(x.paras))); })); P.modal({ title: 'Word Count', width: 300, body: h('div', { class: 'stats' }, h('div', { text: `Slides: ${P.deck.slides.length}` }), h('div', { text: `Paragraphs: ${paras}` }), h('div', { text: `Words: ${w}` }), h('div', { text: `Characters: ${c}` })), buttons: [['Close', () => true]] }); };
  P.accessibilityCheck = () => { paneType = 'access'; pane.style.display = 'flex'; drawPane(); setTimeout(P.layoutCanvas, 0); };
  const drawAccess = () => {
    pane.append(paneHead('Accessibility')); const list = h('div', { class: 'pane-scroll' }); pane.append(list); const issues = [];
    const seenTitles = {};
    P.deck.slides.forEach((s, i) => {
      const t = s.elements.find(e => e.ph && /title/i.test(e.ph.type) && e.ph.type !== 'subTitle' && P.hasText(e));
      if (!t) issues.push({ i, k: 'Missing slide title', sev: 'Error' }); else { const x = P.parasText(t.paras).trim(); if (seenTitles[x]) issues.push({ i, k: `Duplicate slide title "${x}"`, sev: 'Warning' }); seenTitles[x] = 1; }
      P.walk(s.elements, e => { if ((e.type === 'image' || e.type === 'chart' || e.type === 'video' || e.type === 'group' || e.type === 'table') && !e.alt) issues.push({ i, k: `Missing alt text: ${e.name || e.type}`, sev: 'Error', id: e.id }); if (e.paras && P.hasText(e)) { const b = P.baseStyle(e, 0, s); e.paras.forEach(p => (p.runs || []).forEach(r => { const sz = r.size != null ? r.size : b.size; if (sz * ((e.fontScale || 100) / 100) < 12 && r.t.trim()) { if (!issues.some(q => q.id === e.id && q.k.startsWith('Hard'))) issues.push({ i, k: `Hard-to-read small text: ${e.name || 'text'}`, sev: 'Tip', id: e.id }); } })); } });
      if (s.transition && s.transition.advAfter != null && s.transition.advClick === false) issues.push({ i, k: 'Slide advances automatically', sev: 'Tip' });
    });
    if (!issues.length) { list.append(h('div', { class: 'hint pad', text: 'No accessibility issues found. People with disabilities should not have difficulty reading this presentation.' })); return; }
    [['Error', 'Errors'], ['Warning', 'Warnings'], ['Tip', 'Tips']].forEach(([sv, title]) => { const items = issues.filter(x => x.sev === sv); if (!items.length) return; list.append(section(`${title} (${items.length})`, items.map(it => { const b = h('button', { class: 'acc-i', html: `<b>Slide ${it.i + 1}</b> ${P.esc(it.k)}` }); b.onclick = () => { S.cur = -1; P.gotoSlide(it.i); if (it.id) { S.sel = [it.id]; P.drawOverlay(); P.emit('selection'); P.altTextDialog(); } }; return b; }))); });
  };
  /* ---------- master editing helpers ---------- */
  P.addLayout = () => { const id = P.uid('l'); const lay = { id, type: 'cust', name: 'Custom Layout', kind: 'layout', elements: [{ id: P.uid(), type: 'shape', geom: 'rect', name: 'Title', ph: { type: 'title', idx: 0 }, fill: { type: 'none' }, line: { type: 'none' }, paras: [P.para('Click to edit Master title style')] }] }; P.deck.layouts.push(lay); S.master = id; P.commit('Insert layout', { all: true }); };
  P.deleteLayout = () => { const pg = P.page(); if (!pg || pg.kind !== 'layout') return; if (P.deck.slides.some(s => s.layout === pg.id)) { P.toast('This layout is used by slides, so it cannot be deleted.'); return; } P.deck.layouts = P.deck.layouts.filter(l => l !== pg); S.master = 'master'; P.commit('Delete layout', { all: true }); };
  P.renameLayout = () => { const pg = P.page(); if (!pg) return; P.prompt('Rename Layout', 'Layout name:', pg.name, v => { pg.name = v; P.commit('Rename layout', { all: true }); }); };
  P.addPlaceholder = type => { const pg = P.page(); if (!pg || !pg.kind) return; const D = P.deck.size; const idx = Math.max(13, ...pg.elements.filter(e => e.ph).map(e => e.ph.idx || 0)) + 1; const el = { id: P.uid(), type: 'shape', geom: 'rect', name: 'Placeholder ' + idx, ph: { type, idx }, x: D.w * .25, y: D.h * .3, w: D.w * .5, h: D.h * .4, fill: { type: 'none' }, line: { type: 'none' }, paras: [P.para(type === 'pic' ? 'Picture' : 'Click to edit Master text styles')] }; pg.elements.push(el); S.sel = [el.id]; P.commit('Insert placeholder', { all: true }); };
  /* picture utilities */
  P.cropAspect = r => { P.selected().filter(e => e.type === 'image').forEach(el => { const b = P.box(el); const c = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, el.crop); const cur = b.w / b.h; if (r > cur) { const nh = b.w / r; const frac = (1 - nh / b.h) / 2; const vis = 1 - c.t - c.b; c.t += frac * vis; c.b += frac * vis; el.y = b.y + (b.h - nh) / 2; el.h = nh; el.x = b.x; el.w = b.w; } else { const nw = b.h * r; const frac = (1 - nw / b.w) / 2; const vis = 1 - c.l - c.r; c.l += frac * vis; c.r += frac * vis; el.x = b.x + (b.w - nw) / 2; el.w = nw; el.y = b.y; el.h = b.h; } el.crop = c; }); P.commit('Aspect ratio crop'); };
  P.removeBackground = async () => {
    const el = P.selected().find(e => e.type === 'image'); if (!el) return; const m = P.deck.media[el.src.slice(6)]; if (!m) return;
    const img = await P.loadImage(m.url); const c = h('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = x.getImageData(0, 0, c.width, c.height), px = d.data; const W = c.width, H = c.height;
    /* flood-fill from the border pixels, removing colours close to each border sample */
    const tol = 34, seen = new Uint8Array(W * H), stack = []; const push = (i, r, g, b) => { if (i >= 0 && i < W * H && !seen[i] && Math.abs(px[i * 4] - r) < tol && Math.abs(px[i * 4 + 1] - g) < tol && Math.abs(px[i * 4 + 2] - b) < tol) { seen[i] = 1; stack.push(i, r, g, b); } };
    for (let i = 0; i < W; i++) { push(i, px[i * 4], px[i * 4 + 1], px[i * 4 + 2]); const j = (H - 1) * W + i; push(j, px[j * 4], px[j * 4 + 1], px[j * 4 + 2]); } for (let i = 0; i < H; i++) { const a = i * W; push(a, px[a * 4], px[a * 4 + 1], px[a * 4 + 2]); const b = a + W - 1; push(b, px[b * 4], px[b * 4 + 1], px[b * 4 + 2]); }
    while (stack.length) { const b = stack.pop(), g = stack.pop(), r = stack.pop(), i = stack.pop(); px[i * 4 + 3] = 0; if (i % W) push(i - 1, r, g, b); if ((i + 1) % W) push(i + 1, r, g, b); push(i - W, r, g, b); push(i + W, r, g, b); }
    x.putImageData(d, 0, 0); c.toBlob(b => { b.name = 'nobg.png'; el.src = 'media:' + P.addMedia(b, 'nobg.png'); P.commit('Remove background'); P.toast('Background removed. Undo with Ctrl+Z.'); }, 'image/png');
  };
  P.compressPictures = async () => {
    const q = P.select([[220, 'Print (220 ppi)'], [150, 'Web (150 ppi)'], [96, 'E-mail (96 ppi)']], 150); const go = async ppi => {
      let saved = 0; const seen = new Set(); const tasks = []; const addEls = pg => P.walk(pg.elements, e => { if (e.type === 'image' && e.src && e.src.startsWith('media:') && !seen.has(e.src)) { seen.add(e.src); tasks.push(e); } }); P.deck.slides.forEach(addEls);
      for (const e of tasks) { const m = P.deck.media[e.src.slice(6)]; if (!m || /gif|svg/.test(m.mime)) continue; const im = await P.loadImage(m.url); const b = P.box(e); const tw = Math.ceil(b.w / 72 * ppi), k = Math.min(1, tw / im.naturalWidth); if (k > .98) continue; const c = h('canvas'); c.width = im.naturalWidth * k; c.height = im.naturalHeight * k; c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); const png = /png/.test(m.mime); const blob = await new Promise(res => c.toBlob(res, png ? 'image/png' : 'image/jpeg', .85)); if (blob && blob.size < m.blob.size) { saved += m.blob.size - blob.size; m.blob = blob; m.mime = blob.type; URL.revokeObjectURL(m.url); m.url = URL.createObjectURL(blob); delete m.data; } }
      P.commit('Compress pictures', { all: true }); P.toast(`Saved ${(saved / 1048576).toFixed(1)} MB.`);
    };
    P.modal({ title: 'Compress Pictures', width: 340, body: P.field('Target output:', q), buttons: [['OK', () => { go(+q.value); return true; }, true], ['Cancel', () => true]] });
  };

  /* ---------- init ---------- */
  P.initPanes = () => {
    thumbs = document.getElementById('thumbs'); notesEl = document.getElementById('notes'); statusEl = document.getElementById('status'); pane = document.getElementById('rightPane');
    thumbs.addEventListener('dragover', e => { e.preventDefault(); });
    thumbs.addEventListener('drop', e => { e.preventDefault(); if (dragIdx) { P.moveSlides(dragIdx, P.deck.slides.length); dragIdx = null; } });
    thumbs.addEventListener('pointerdown', e => { focusSlides = true; if (e.target === thumbs) { /* blank area */ } });
    document.getElementById('stage').addEventListener('pointerdown', () => { focusSlides = false; });
    notesEl.addEventListener('input', () => { const p = P.page(); if (p) { p.notes = notesEl.value; P.dirty = true; } });
    notesEl.addEventListener('change', () => P.commit('Notes', { silent: true }));
    notesEl.addEventListener('keydown', e => e.stopPropagation());
    notesEl.addEventListener('focus', () => { P.T.end(); focusSlides = false; });
    /* splitter between slide panel and canvas */
    const sp = document.getElementById('splitL'); sp.addEventListener('pointerdown', e => { e.preventDefault(); const lp = document.getElementById('leftPane'), w0 = lp.offsetWidth, x0 = e.clientX; const mv = ev => { lp.style.width = P.clamp(w0 + ev.clientX - x0, 120, 480) + 'px'; }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); drawThumbs(); P.layoutCanvas(); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); });
    const sn = document.getElementById('splitN'); sn.addEventListener('pointerdown', e => { e.preventDefault(); const n = document.getElementById('notesPane'), h0 = n.offsetHeight, y0 = e.clientY; const mv = ev => { n.style.height = P.clamp(h0 - ev.clientY + y0, 40, 400) + 'px'; P.layoutCanvas(); }; const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }; addEventListener('pointermove', mv); addEventListener('pointerup', up); });
    /* status bar */
    statusEl.append(
      h('span', { class: 's-slide' }), h('span', { class: 's-lang', text: 'English (United States)' }),
      h('div', { class: 's-sp' }),
      (() => { const b = h('button', { class: 's-b s-notes', html: P.icon('notes', 14) + 'Notes' }); b.onclick = () => P.toggleView('notes'); return b; })(),
      (() => { const b = h('button', { class: 's-b s-cmt', html: P.icon('comment', 14) + 'Comments' }); b.onclick = () => { S.showComments = !S.showComments; P.openPane(S.showComments ? 'comments' : null); P.drawOverlay(); drawStatus(); }; return b; })(),
      (() => { const b = h('button', { class: 's-b s-v-normal', title: 'Normal', html: P.icon('normal', 15) }); b.onclick = () => P.setView('normal'); return b; })(),
      (() => { const b = h('button', { class: 's-b s-v-sorter', title: 'Slide Sorter', html: P.icon('sorter', 15) }); b.onclick = () => P.setView('sorter'); return b; })(),
      (() => { const b = h('button', { class: 's-b s-v-reading', title: 'Reading View', html: P.icon('reading', 15) }); b.onclick = () => P.startShow(S.cur, { noFullscreen: true }); return b; })(),
      (() => { const b = h('button', { class: 's-b', title: 'Slide Show (from current slide)', html: P.icon('present', 15) }); b.onclick = () => P.startShow(S.cur); return b; })(),
      (() => { const b = h('button', { class: 's-b', title: 'Zoom out', text: '−' }); b.onclick = () => P.setZoom(P.getZoom() - .1); return b; })(),
      (() => { const r = h('input', { type: 'range', min: 5, max: 100, value: 50 }); r.oninput = () => P.setZoom(sliderToZoom(+r.value)); return r; })(),
      (() => { const b = h('button', { class: 's-b', title: 'Zoom in', text: '+' }); b.onclick = () => P.setZoom(P.getZoom() + .1); return b; })(),
      (() => { const b = h('button', { class: 's-b s-z', title: 'Zoom' }); b.onclick = () => P.setZoom(1); return b; })(),
      (() => { const b = h('button', { class: 's-b', title: 'Fit slide to current window', html: P.icon('fit', 15) }); b.onclick = () => P.setZoom(null); return b; })()
    );
    P.on('zoom', drawStatus);
    let tT = 0;
    P.on('change', (o = {}) => {
      if (o.history) { syncNotes(); }
      P.renderCanvas(); syncNotes(); drawStatus(); drawPane();
      if (S.view === 'sorter') drawSorter();
      if (S.view === 'notes') drawNotesPage();
      if (o.all || S.view === 'master') { drawThumbs(); } else { clearTimeout(tT); const i = S.cur; tT = setTimeout(() => refreshThumb(i), 60); }
      P.emit('selection');
    });
    P.on('selection', () => { if (paneType === 'format' || paneType === 'selection' || paneType === 'anim') { if (!P.T.active) drawPane(); } });
    P.on('deck', () => { drawThumbs(); P.renderCanvas(); syncNotes(); drawStatus(); P.layoutCanvas(); drawPane(); });
    new ResizeObserver(() => { const w = document.getElementById('leftPane').clientWidth; if (w !== P._lw) { P._lw = w; drawThumbs(); } }).observe(document.getElementById('leftPane'));
  };
  P.redrawThumbs = () => drawThumbs();
})(window.P);
