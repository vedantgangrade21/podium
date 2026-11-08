/* Podium - inserting content: pictures, media, tables, charts, SmartArt, icons + related dialogs */
(function (P) {
  'use strict';
  const S = P.S;
  const pickFile = (accept, multiple) => new Promise(res => { const i = h('input', { type: 'file', accept, multiple: !!multiple, style: { display: 'none' } }); i.onchange = () => { res([...i.files]); i.remove(); }; document.body.append(i); i.click(); });
  P.pickFile = pickFile;

  /* ---------- pictures ---------- */
  const imgSize = url => new Promise(res => { const im = new Image(); im.onload = () => res([im.naturalWidth || 400, im.naturalHeight || 300]); im.onerror = () => res([400, 300]); im.src = url; });
  P.imgSize = imgSize;
  P.insertPictureBlob = async (blob, phId, opts = {}) => {
    const id = P.addMedia(blob, blob.name || 'image');
    const [nw, nh] = await imgSize(P.deck.media[id].url);
    const D = P.deck.size; let w = nw * .75, hh = nh * .75;
    const k = Math.min(1, D.w * .8 / w, D.h * .8 / hh); w *= k; hh *= k;
    const el = { id: P.uid(), type: 'image', src: 'media:' + id, name: 'Picture ' + (P.page().elements.length + 1), alt: '', natural: [nw, nh], x: (D.w - w) / 2, y: (D.h - hh) / 2, w, h: hh };
    const ph = phId ? P.findEl(phId) : (opts.noPh ? null : P.takePlaceholder(['pic', 'obj', 'body']));
    if (ph && ph.ph) { el.aspect = nw / nh; P.placeIn(ph, el); } else { P.page().elements.push(el); S.sel = [el.id]; }
    P.commit('Insert picture');
    if (!opts.noTab) P.showTab('picture');
    return el;
  };
  P.pickPicture = async phId => { const f = await pickFile('image/*', !phId); if (!f.length) return; for (const x of f) await P.insertPictureBlob(x, phId, { noPh: f.length > 1 }); };
  P.insertFiles = async files => {
    for (const f of files) {
      if (f.type.startsWith('image/')) await P.insertPictureBlob(f, null, { noPh: true });
      else if (f.type.startsWith('video/')) P.insertMediaBlob('video', f);
      else if (f.type.startsWith('audio/')) P.insertMediaBlob('audio', f);
      else if (/\.pptx$/i.test(f.name)) P.openBlob(f);
    }
  };
  P.pickMedia = async (kind, phId) => { const f = await pickFile(kind + '/*'); if (f[0]) P.insertMediaBlob(kind, f[0], phId); };
  P.insertMediaBlob = (kind, blob, phId) => {
    const id = P.addMedia(blob, blob.name || kind); const D = P.deck.size;
    const el = { id: P.uid(), type: kind, src: 'media:' + id, name: (kind === 'video' ? 'Video ' : 'Audio ') + (P.page().elements.length + 1), media: { auto: false, loop: false, vol: 1, hide: false } };
    if (kind === 'audio') Object.assign(el, { x: D.w / 2 - 24, y: D.h / 2 - 24, w: 48, h: 48 }); else Object.assign(el, { x: D.w * .15, y: D.h * .15, w: D.w * .7, h: D.w * .7 * 9 / 16 });
    const ph = phId ? P.findEl(phId) : (kind === 'video' ? P.takePlaceholder(['obj', 'body']) : null);
    if (ph && kind === 'video') { el.aspect = 16 / 9; P.placeIn(ph, el); } else { P.page().elements.push(el); S.sel = [el.id]; }
    P.commit('Insert ' + kind); P.showTab('media');
  };
  P.screenshot = async () => {
    try {
      const st = await navigator.mediaDevices.getDisplayMedia({ video: true }); const v = h('video', { srcObject: st, muted: true }); await v.play();
      await new Promise(r => setTimeout(r, 200));
      const c = h('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0); st.getTracks().forEach(t => t.stop());
      c.toBlob(b => { b.name = 'Screenshot.png'; P.insertPictureBlob(b, null, { noPh: true }); }, 'image/png');
    } catch (e) { P.toast('Screenshot cancelled.'); }
  };
  P.screenRecord = async () => {
    let st; try { st = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }); } catch (e) { P.toast('Screen recording cancelled.'); return; }
    const chunks = []; const rec = new MediaRecorder(st, { mimeType: MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm' });
    rec.ondataavailable = e => chunks.push(e.data);
    const bar = h('div', { class: 'rec-bar', text: '● Recording screen ' }); const stop = h('button', { class: 'btn', text: 'Stop' }); bar.append(stop); document.body.append(bar);
    const finish = () => { if (rec.state !== 'inactive') rec.stop(); };
    stop.onclick = finish; st.getVideoTracks()[0].addEventListener('ended', finish);
    rec.onstop = () => { bar.remove(); st.getTracks().forEach(t => t.stop()); const b = new Blob(chunks, { type: rec.mimeType }); b.name = 'Screen Recording'; P.insertMediaBlob('video', b); };
    rec.start();
  };
  P.recordAudio = async () => {
    let st; try { st = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch (e) { P.toast('Microphone unavailable.'); return; }
    const chunks = []; const rec = new MediaRecorder(st); rec.ondataavailable = e => chunks.push(e.data);
    const timer = h('b', { text: '00:00' }); let t = 0; const iv = setInterval(() => { t++; timer.textContent = String(Math.floor(t / 60)).padStart(2, '0') + ':' + String(t % 60).padStart(2, '0'); }, 1000);
    rec.onstop = () => { clearInterval(iv); st.getTracks().forEach(x => x.stop()); const b = new Blob(chunks, { type: rec.mimeType }); b.name = 'Recorded Sound'; P.insertMediaBlob('audio', b); };
    rec.start();
    P.modal({ title: 'Record Sound', width: 320, body: h('div', { style: { textAlign: 'center', padding: '10px' } }, h('div', { text: 'Recording…' }), timer), buttons: [['Stop & Insert', () => { rec.stop(); return true; }, true]] });
  };
  P.photoAlbum = async () => {
    const f = await pickFile('image/*', true); if (!f.length) return;
    const perSlide = h('select', { class: 'field' }, h('option', { value: 1, text: '1 picture per slide' }), h('option', { value: 2, text: '2 pictures per slide' }), h('option', { value: 4, text: '4 pictures per slide' }));
    P.modal({ title: 'Photo Album', width: 380, body: h('div', {}, h('p', { text: `${f.length} picture(s) selected.` }), P.field('Picture layout', perSlide)), buttons: [['Create', () => { buildAlbum(f, +perSlide.value); return true; }, true], ['Cancel', () => true]] });
  };
  const buildAlbum = async (files, n) => {
    const D = P.deck.size, cols = n === 1 ? 1 : 2, rows = n === 4 ? 2 : 1, m = 24;
    for (let i = 0; i < files.length; i += n) {
      const s = P.newSlide('blank'); P.deck.slides.splice(P.S.cur + 1, 0, s); P.S.cur++;
      for (let j = 0; j < n && i + j < files.length; j++) {
        const id = P.addMedia(files[i + j], files[i + j].name); const [w0, h0] = await imgSize(P.deck.media[id].url);
        const cw = (D.w - m * (cols + 1)) / cols, ch = (D.h - m * (rows + 1)) / rows, k = Math.min(cw / w0, ch / h0), w = w0 * k, hh = h0 * k;
        const col = j % cols, row = Math.floor(j / cols);
        s.elements.push({ id: P.uid(), type: 'image', src: 'media:' + id, name: 'Picture ' + (j + 1), alt: '', x: m + col * (cw + m) + (cw - w) / 2, y: m + row * (ch + m) + (ch - hh) / 2, w, h: hh });
      }
    }
    P.commit('Photo album', { all: true });
  };

  /* ---------- tables ---------- */
  P.newTable = (rows, cols, phId) => {
    const D = P.deck.size; const w = D.w * .8, rh = 37;
    const tbl = { cols: new Array(cols).fill(w / cols), rows: [], style: 'med2-accent1', opts: { hdr: true, bandR: true }, size: 18 };
    for (let r = 0; r < rows; r++) { const cells = []; for (let c = 0; c < cols; c++) cells.push({ paras: [P.para('')] }); tbl.rows.push({ h: rh, cells }); }
    const el = { id: P.uid(), type: 'table', name: 'Table ' + (P.page().elements.length + 1), tbl, x: (D.w - w) / 2, y: (D.h - rows * rh) / 2, w, h: rows * rh };
    const ph = phId ? P.findEl(phId) : P.takePlaceholder(['obj', 'body']);
    if (ph && ph.ph) { const b = P.box(ph); const hh = el.h; P.placeIn(ph, el); el.h = hh; el.tbl.cols = new Array(cols).fill(b.w / cols); el.w = b.w; } else { P.page().elements.push(el); S.sel = [el.id]; }
    P.commit('Insert table'); P.showTab('tableDesign');
    return el;
  };
  P.placeTable = phId => {
    const r = h('input', { class: 'field num', type: 'number', min: 1, max: 75, value: 2 }), c = h('input', { class: 'field num', type: 'number', min: 1, max: 75, value: 5 });
    P.modal({ title: 'Insert Table', width: 280, body: h('div', {}, P.field('Number of columns:', c), P.field('Number of rows:', r)), buttons: [['OK', () => { P.newTable(+r.value || 2, +c.value || 5, phId); return true; }, true], ['Cancel', () => true]] });
  };
  P.tableGridPicker = () => {
    const box = h('div', { class: 'tbl-picker' }); const lbl = h('div', { class: 'tp-l', text: 'Insert Table' }); const grid = h('div', { class: 'tp-g' }); const cells = [];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 10; c++) { const d = h('div', { class: 'tp-c' }); d.onmouseenter = () => { cells.forEach(x => x.d.classList.toggle('on', x.r <= r && x.c <= c)); lbl.textContent = `${c + 1}x${r + 1} Table`; }; d.onclick = () => { P.closePopup(); P.newTable(r + 1, c + 1); }; grid.append(d); cells.push({ d, r, c }); }
    box.append(lbl, grid, P.menuList([{ label: 'Insert Table…', icon: 'table', fn: () => P.placeTable() }]));
    return box;
  };
  const curTable = () => { if (P.T.active && P.T.active.cell) return { el: P.T.active.el, cell: P.T.active.cell }; const el = P.selected().find(e => e.type === 'table'); return el ? { el, cell: { r: 0, c: 0 } } : null; };
  P.curTable = curTable;
  const newCell = () => ({ paras: [P.para('')] });
  P.tableOp = (op, at) => {
    const ct = curTable(); if (!ct) return; const { el } = ct; const t = el.tbl; const { r, c } = at || ct.cell; const range = S.cellRange;
    const id = el.id; if (P.T.active) P.T.end(true);
    const R0 = range ? range.r1 : r, R1 = range ? range.r2 : r, C0 = range ? range.c1 : c, C1 = range ? range.c2 : c;
    switch (op) {
      case 'rowAbove': t.rows.splice(R0, 0, { h: t.rows[R0].h, cells: t.cols.map(newCell) }); break;
      case 'rowBelow': t.rows.splice(R1 + 1, 0, { h: t.rows[R1].h, cells: t.cols.map(newCell) }); break;
      case 'colLeft': { const w = t.cols[C0] / 2; t.cols[C0] = w; t.cols.splice(C0, 0, w); t.rows.forEach(ro => ro.cells.splice(C0, 0, newCell())); break; }
      case 'colRight': { const w = t.cols[C1] / 2; t.cols[C1] = w; t.cols.splice(C1 + 1, 0, w); t.rows.forEach(ro => ro.cells.splice(C1 + 1, 0, newCell())); break; }
      case 'delRow': if (t.rows.length - (R1 - R0 + 1) <= 0) return P.tableOp('delTable'); t.rows.splice(R0, R1 - R0 + 1); break;
      case 'delCol': { if (t.cols.length - (C1 - C0 + 1) <= 0) return P.tableOp('delTable'); const rem = t.cols.splice(C0, C1 - C0 + 1).reduce((a, b) => a + b, 0); const k = (rem + t.cols.reduce((a, b) => a + b, 0)) / t.cols.reduce((a, b) => a + b, 0); t.cols = t.cols.map(v => v * k); t.rows.forEach(ro => ro.cells.splice(C0, C1 - C0 + 1)); break; }
      case 'delTable': { const sib = P.siblings(id); sib.splice(sib.indexOf(el), 1); S.sel = []; S.cellRange = null; P.commit('Delete table'); return; }
      case 'merge': {
        if (!range || (R0 === R1 && C0 === C1)) { P.toast('Shift+click another cell to choose the cells to merge.'); return; }
        const first = t.rows[R0].cells[C0]; let paras = [];
        for (let i = R0; i <= R1; i++) for (let j = C0; j <= C1; j++) { const x = t.rows[i].cells[j]; if (P.hasText(x)) paras = paras.concat(x.paras); if (i !== R0 || j !== C0) { x.paras = [P.para('')]; if (i > R0) x.vm = true; if (j > C0) x.hm = true; } }
        first.paras = paras.length ? paras : [P.para('')]; first.span = C1 - C0 + 1; first.rowSpan = R1 - R0 + 1; S.cellRange = null; break;
      }
      case 'split': {
        const x = t.rows[r].cells[c]; if ((x.span || 1) > 1 || (x.rowSpan || 1) > 1) { for (let i = r; i < r + (x.rowSpan || 1); i++) for (let j = c; j < c + (x.span || 1); j++) { const y = t.rows[i].cells[j]; delete y.vm; delete y.hm; } delete x.span; delete x.rowSpan; }
        else { const w = t.cols[c] / 2; t.cols[c] = w; t.cols.splice(c + 1, 0, w); t.rows.forEach((ro, i) => { if (i === r) ro.cells.splice(c + 1, 0, newCell()); else { ro.cells.splice(c + 1, 0, { paras: [P.para('')], hm: true }); const o = ro.cells[c]; o.span = (o.span || 1) + 1; } }); }
        break;
      }
      case 'distR': { const a = t.rows.slice(R0, R1 + 1), tot = a.reduce((v, ro) => v + ro.h, 0); a.forEach(ro => ro.h = tot / a.length); break; }
      case 'distC': { const a = range ? [C0, C1] : [0, t.cols.length - 1]; const tot = t.cols.slice(a[0], a[1] + 1).reduce((v, w) => v + w, 0), n = a[1] - a[0] + 1; for (let i = a[0]; i <= a[1]; i++) t.cols[i] = tot / n; break; }
    }
    S.cellRange = null; S.cellAnchor = null; el.h = t.rows.reduce((a, x) => a + x.h, 0); el.w = t.cols.reduce((a, x) => a + x, 0); S.sel = [id]; P.commit('Table edit');
  };
  P.cellsTarget = fn => { /* apply to selected range / current cell / all */
    const ct = curTable(); if (!ct) return; const t = ct.el.tbl, rg = S.cellRange;
    if (P.T.active && P.T.active.cell) { if (rg) for (let i = rg.r1; i <= rg.r2; i++) for (let j = rg.c1; j <= rg.c2; j++) fn(t.rows[i].cells[j], i, j); else fn(t.rows[ct.cell.r].cells[ct.cell.c], ct.cell.r, ct.cell.c); const id = ct.el.id; const cell = ct.cell; P.T.end(true); P.commit('Format cells'); S.sel = [id]; P.T.begin(id, { cell }); }
    else { t.rows.forEach((ro, i) => ro.cells.forEach((c, j) => fn(c, i, j))); P.commit('Format cells'); }
  };

  /* ---------- charts ---------- */
  P.chartDialog = phId => {
    let cur = 'column';
    const list = h('div', { class: 'chart-types' }), prev = h('div', { class: 'chart-prev' });
    const paint = () => { const ch = chartFromKind(cur); prev.innerHTML = P.chartSVG(ch, 460, 280, { deck: P.deck }); };
    P.chartKinds.forEach(([k, n]) => { const b = h('button', { class: 'chart-type' + (k === cur ? ' on' : ''), html: chartGlyph(k) + `<span>${n}</span>` }); b.onclick = () => { cur = k; [...list.children].forEach(x => x.classList.remove('on')); b.classList.add('on'); paint(); }; b.ondblclick = () => { go(); close(); }; list.append(b); });
    const go = () => {
      const ch = chartFromKind(cur); const D = P.deck.size;
      const el = { id: P.uid(), type: 'chart', name: 'Chart ' + (P.page().elements.length + 1), chart: ch, x: D.w * .15, y: D.h * .12, w: D.w * .7, h: D.h * .76 };
      const ph = phId ? P.findEl(phId) : P.takePlaceholder(['obj', 'body']);
      if (ph && ph.ph) P.placeIn(ph, el); else { P.page().elements.push(el); S.sel = [el.id]; }
      P.commit('Insert chart'); P.showTab('chart');
    };
    let close = () => {};
    const dlg = P.modal({ title: 'Insert Chart', width: 720, body: h('div', { class: 'chart-dlg' }, list, prev), buttons: [['OK', () => { go(); return true; }, true], ['Cancel', () => true]] });
    close = dlg.close; paint();
  };
  const chartFromKind = k => {
    const [kind, gr] = k.split('-'); const ch = P.defaultChart(kind); ch.gapWidth = gr === 'stacked' || gr === 'percent' ? 150 : 219; ch.overlap = gr === 'stacked' || gr === 'percent' ? 100 : -27;
    if (gr === 'stacked') ch.grouping = 'stacked'; if (gr === 'percent') ch.grouping = 'percent'; if (gr === 'marker') { ch.marker = true; }
    if (kind === 'pie' || kind === 'doughnut') { ch.cats = ['1st Qtr', '2nd Qtr', '3rd Qtr', '4th Qtr']; ch.series = [{ name: 'Sales', values: [8.2, 3.2, 1.4, 1.2] }]; ch.title = 'Sales'; }
    if (kind === 'scatter') { ch.cats = ['0.7', '1.8', '2.6', '3.2', '4.5']; ch.series = [{ name: 'Y-Values', values: [2.7, 3.2, 0.8, 2.1, 3.9] }]; ch.title = 'Y-Values'; }
    return ch;
  };
  P.chartFromKind = chartFromKind;
  const chartGlyph = k => { const p = { column: 'M3 21V10h4v11zM10 21V4h4v17zM17 21v-8h4v8z', bar: 'M3 4h11v4H3zM3 10h18v4H3zM3 16h8v4H3z', line: '', area: 'M2 21V14l6-6 6 4 8-8v17z', pie: 'M12 2a10 10 0 1 0 10 10H12z', doughnut: 'M12 2a10 10 0 1 0 .01 0zM12 8a4 4 0 1 1-.01 0z', scatter: 'M5 16a2 2 0 1 0 .01 0zM10 8a2 2 0 1 0 .01 0zM16 13a2 2 0 1 0 .01 0zM19 5a2 2 0 1 0 .01 0z', radar: 'M12 2l9 7-3.5 12h-11L3 9z' }[k.split('-')[0]]; if (k.startsWith('line')) return `<svg viewBox="0 0 24 24" width="28" height="28"><path d="M2 18l6-7 5 4 9-11" fill="none" stroke="#2b7cd3" stroke-width="2"/></svg>`; return `<svg viewBox="0 0 24 24" width="28" height="28"><path d="${p}" fill="#2b7cd3" fill-rule="evenodd"/></svg>`; };
  P.chartDataDialog = el => {
    const ch = el.chart; const wrap = h('div', { class: 'sheet-wrap' }); const table = h('table', { class: 'sheet' }); wrap.append(table);
    let cats = ch.cats.slice(), series = ch.series.map(s => ({ name: s.name, values: s.values.slice(), color: s.color, pointColors: s.pointColors, xs: s.xs }));
    const render = () => {
      table.innerHTML = ''; const hdr = h('tr', {}, h('th', { text: '' })); series.forEach((s, i) => { const inp = h('input', { value: s.name }); inp.oninput = () => { s.name = inp.value; apply(); }; hdr.append(h('th', {}, inp)); void i; }); table.append(hdr);
      cats.forEach((c, r) => {
        const tr = h('tr'); const ci = h('input', { value: c, class: 'cat' }); ci.oninput = () => { cats[r] = ci.value; apply(); }; tr.append(h('td', {}, ci));
        series.forEach(s => { const v = h('input', { value: s.values[r] == null ? '' : s.values[r], class: 'num' }); v.oninput = () => { s.values[r] = v.value === '' ? null : +v.value; apply(); }; tr.append(h('td', {}, v)); });
        table.append(tr);
      });
    };
    const apply = () => { ch.cats = cats.slice(); ch.series = series.map(s => Object.assign({}, s, { values: cats.map((_, i) => (s.values[i] == null ? 0 : s.values[i])) })); const n = P.canvasEl(el.id); if (n) { const c = n.querySelector('.chart'); if (c) c.innerHTML = P.chartSVG(ch, P.box(el).w, P.box(el).h, { deck: P.deck }); } };
    const tools = h('div', { class: 'sheet-tools' });
    const mk = (t, fn) => { const b = h('button', { class: 'btn', text: t }); b.onclick = () => { fn(); render(); apply(); }; return b; };
    tools.append(mk('+ Row', () => { cats.push('Category ' + (cats.length + 1)); series.forEach(s => s.values.push(0)); }), mk('− Row', () => { if (cats.length > 1) { cats.pop(); series.forEach(s => s.values.pop()); } }), mk('+ Series', () => { series.push({ name: 'Series ' + (series.length + 1), values: cats.map(() => 0) }); }), mk('− Series', () => { if (series.length > 1) series.pop(); }));
    table.addEventListener('paste', e => {
      const t = e.clipboardData.getData('text/plain'); if (!t || !t.includes('\t') && !t.includes('\n')) return; e.preventDefault();
      const rows = t.trim().split(/\r?\n/).map(r => r.split('\t')); if (rows.length < 2) return;
      series = rows[0].slice(1).map((n, i) => ({ name: n, values: rows.slice(1).map(r => +r[i + 1] || 0) })); cats = rows.slice(1).map(r => r[0]); render(); apply();
    });
    render();
    P.modal({ title: 'Chart Data (paste from Excel is supported)', width: 640, body: h('div', {}, tools, wrap), buttons: [['Close', () => { P.commit('Edit chart data'); return true; }, true]] });
  };

  /* ---------- SmartArt (generated as editable groups) ---------- */
  const A = i => 'accent' + ((i % 6) + 1);
  const box = (x, y, w, hh, text, fill, opts = {}) => ({ id: P.uid(), type: 'shape', geom: opts.geom || 'roundRect', adj: opts.adj, x, y, w, h: hh, name: opts.name || 'Shape', fill: { type: 'solid', color: fill || 'accent1' }, line: opts.line === undefined ? { type: 'solid', color: 'bg1', width: 1 } : opts.line, anchor: 'ctr', lst: [{ color: opts.color || 'bg1', align: 'ctr', size: opts.size || 16, bold: opts.bold }], paras: (Array.isArray(text) ? text : [text]).map(t => P.para(t)), rot: opts.rot, fit: 'shrink', flipH: opts.flipH, fontScale: undefined });
  const arrow = (x, y, w, hh, rot) => ({ id: P.uid(), type: 'shape', geom: 'rightArrow', x, y, w, h: hh, rot, name: 'Arrow', fill: { type: 'solid', color: 'accent1:60,40' }, line: { type: 'none' }, paras: [] });
  const sizeFor = (n) => Math.max(12, 22 - n * 1.3);
  P.smartArtKinds = [
    ['List', [['blockList', 'Basic Block List'], ['vbar', 'Vertical Bullet List'], ['hbar', 'Horizontal Bars'], ['stackedList', 'Stacked List']]],
    ['Process', [['process', 'Basic Process'], ['chevron', 'Chevron Process'], ['stepUp', 'Step Up Process'], ['timeline', 'Basic Timeline']]],
    ['Cycle', [['cycle', 'Basic Cycle'], ['segCycle', 'Segmented Cycle']]],
    ['Hierarchy', [['hierarchy', 'Organization Chart']]],
    ['Relationship', [['venn', 'Basic Venn'], ['radial', 'Basic Radial'], ['balance', 'Target']]],
    ['Matrix', [['matrix', 'Basic Matrix']]],
    ['Pyramid', [['pyramid', 'Basic Pyramid'], ['funnel', 'Funnel']]]
  ];
  P.buildSmartArt = (kind, items, W, H) => {
    const n = Math.max(1, items.length), out = [], txts = items.map(i => i.t), fs = sizeFor(n);
    switch (kind) {
      case 'blockList': { const cols = Math.ceil(Math.sqrt(n)), rows = Math.ceil(n / cols), gap = 12, w = (W - gap * (cols - 1)) / cols, hh = Math.min((H - gap * (rows - 1)) / rows, w * .7); const oy = (H - (rows * hh + (rows - 1) * gap)) / 2; txts.forEach((t, i) => out.push(box((i % cols) * (w + gap), oy + Math.floor(i / cols) * (hh + gap), w, hh, t, 'accent1', { geom: 'rect', size: fs }))); break; }
      case 'vbar': case 'stackedList': { const gap = 8, hh = (H - gap * (n - 1)) / n; txts.forEach((t, i) => out.push(box(0, i * (hh + gap), W, hh, t, kind === 'vbar' ? 'accent1' : A(i), { size: Math.min(24, hh * .4) }))); break; }
      case 'hbar': { const gap = 8, w = (W - gap * (n - 1)) / n; txts.forEach((t, i) => out.push(box(i * (w + gap), 0, w, H, t, A(i), { geom: 'rect', size: fs }))); break; }
      case 'process': { const aw = Math.min(28, W / (n * 4)), gap = aw * 1.5, w = (W - gap * (n - 1)) / n, hh = Math.min(H, w * .75), y = (H - hh) / 2; txts.forEach((t, i) => { const x = i * (w + gap); out.push(box(x, y, w, hh, t, 'accent1', { size: fs })); if (i < n - 1) out.push(arrow(x + w + gap * .17, H / 2 - aw * .6, gap * .66, aw * 1.2)); }); break; }
      case 'chevron': { const ov = H * .12, w = (W + ov * (n - 1)) / n, hh = Math.min(H * .55, w * .5), y = (H - hh) / 2; txts.forEach((t, i) => out.push(box(i * (w - ov), y, w, hh, t, 'accent1', { geom: i ? 'chevron' : 'homePlate', adj: [30000], size: fs, line: { type: 'none' } }))); break; }
      case 'stepUp': { const gap = 10, w = (W - gap * (n - 1)) / n; txts.forEach((t, i) => { const hh = H * (.3 + .7 * (i + 1) / n); out.push(box(i * (w + gap), H - hh, w, hh, t, A(i), { geom: 'rect', size: fs })); }); break; }
      case 'timeline': { const y = H / 2; out.push({ id: P.uid(), type: 'shape', geom: 'rightArrow', x: 0, y: y - H * .08, w: W, h: H * .16, name: 'Line', fill: { type: 'solid', color: 'accent1:40,60' }, line: { type: 'none' }, adj: [50000, 60000], paras: [] }); const w = W / n; txts.forEach((t, i) => { const cx = w * (i + .5); out.push(box(cx - 8, y - 8, 16, 16, '', 'accent1', { geom: 'ellipse' })); const up = i % 2 === 0; out.push(box(cx - w * .46, up ? y - H * .08 - H * .34 : y + H * .08 + 8, w * .92, H * .32, t, 'bg1', { color: 'tx1', geom: 'rect', line: { type: 'none' }, size: fs })); }); break; }
      case 'cycle': { const R = Math.min(W, H) / 2 - Math.min(W, H) * .13, cx = W / 2, cy = H / 2, bw = Math.min(W, H) * .32, bh = bw * .6; txts.forEach((t, i) => { const a = -Math.PI / 2 + i / n * Math.PI * 2; out.push(box(cx + R * Math.cos(a) - bw / 2, cy + R * Math.sin(a) - bh / 2, bw, bh, t, 'accent1', { size: fs })); const m = a + Math.PI / n, as = bw * .28; out.push(arrow(cx + R * Math.cos(m) - as / 2, cy + R * Math.sin(m) - as * .35, as, as * .7, (m * 180 / Math.PI + 90 + 360) % 360)); }); break; }
      case 'segCycle': { const sz = Math.min(W, H); const x0 = (W - sz) / 2, y0 = (H - sz) / 2; txts.forEach((t, i) => { const st = (-90 + i * 360 / n + 360) % 360, en = (st + 360 / n - 2 + 360) % 360; const mid = (st + 360 / (2 * n)) * Math.PI / 180; out.push(box(x0, y0, sz, sz, '', A(i), { geom: 'pie', adj: [st * 60000, en * 60000], line: { type: 'solid', color: 'bg1', width: 1.5 } })); const tw = sz * .34; out.push(box(W / 2 + Math.cos(mid) * sz * .3 - tw / 2, H / 2 + Math.sin(mid) * sz * .3 - tw * .25, tw, tw * .5, t, 'bg1', { geom: 'rect', line: { type: 'none' }, color: 'bg1', size: fs })); out[out.length - 1].fill = { type: 'none' }; }); break; }
      case 'hierarchy': {
        const lv = items.map(i => i.level); const nodes = items.map((it, i) => ({ t: it.t, level: it.level, i, kids: [] })); const roots = [];
        nodes.forEach((nd, i) => { let p = null; for (let j = i - 1; j >= 0; j--) if (nodes[j].level < nd.level) { p = nodes[j]; break; } if (p) p.kids.push(nd); else roots.push(nd); });
        const depth = Math.max(...lv) + 1; const leaf = nd => (nd.kids.length ? nd.kids.reduce((a, k) => a + leaf(k), 0) : 1); const totalL = roots.reduce((a, r) => a + leaf(r), 0) || 1;
        const uw = W / totalL, gapY = H * .08, bh = (H - gapY * (depth - 1)) / depth, bw = Math.min(uw * .86, W * .3);
        const place = (nd, x0) => { const lw = leaf(nd) * uw, cx = x0 + lw / 2, y = nd.level * (bh + gapY); out.push(box(cx - bw / 2, y, bw, bh, nd.t, nd.level === 0 ? 'accent1' : 'accent1:75,0', { geom: 'roundRect', adj: [10000], size: Math.min(fs, 16) })); let k0 = x0; nd.kids.forEach(k => { const kw = leaf(k) * uw, kx = k0 + kw / 2; const y1 = y + bh, y2 = y + bh + gapY; const my = (y1 + y2) / 2; const ln = (ax, ay, bx, by) => ({ id: P.uid(), type: 'shape', geom: 'line', x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay), name: 'Connector', fill: { type: 'none' }, line: { type: 'solid', color: 'tx1:50,50', width: 1 }, paras: [] }); out.unshift(ln(cx, y1, cx, my), ln(Math.min(cx, kx), my, Math.max(cx, kx), my), ln(kx, my, kx, y2)); place(k, k0); k0 += kw; }); };
        let x = 0; roots.forEach(r => { place(r, x); x += leaf(r) * uw; }); break;
      }
      case 'venn': { const sz = Math.min(W / (n * .72 + .28), H * .8), step = sz * .72, x0 = (W - (sz + step * (n - 1))) / 2, y0 = (H - sz) / 2; txts.forEach((t, i) => { const b = box(x0 + i * step, y0, sz, sz, t, A(i), { geom: 'ellipse', size: fs, line: { type: 'none' } }); b.fill.opacity = .6; out.push(b); }); break; }
      case 'radial': { const sz = Math.min(W, H), c = sz * .28, cx = W / 2, cy = H / 2, R = sz * .36, r = sz * .22; out.push(box(cx - c / 2, cy - c / 2, c, c, txts[0] || '', 'accent1', { geom: 'ellipse', size: fs })); txts.slice(1).forEach((t, i) => { const a = -Math.PI / 2 + i / Math.max(1, n - 1) * Math.PI * 2; out.push({ id: P.uid(), type: 'shape', geom: 'line', x: Math.min(cx, cx + R * Math.cos(a)), y: Math.min(cy, cy + R * Math.sin(a)), w: Math.abs(R * Math.cos(a)), h: Math.abs(R * Math.sin(a)), flipH: Math.cos(a) < 0 || undefined, flipV: Math.sin(a) < 0 || undefined, name: 'Connector', fill: { type: 'none' }, line: { type: 'solid', color: 'accent1:60,40', width: 1.5 }, paras: [] }); out.push(box(cx + R * Math.cos(a) - r / 2, cy + R * Math.sin(a) - r / 2, r, r, t, A(i + 1), { geom: 'ellipse', size: Math.max(11, fs - 3) })); }); const lines = out.filter(o => o.geom === 'line'); const rest = out.filter(o => o.geom !== 'line'); out.length = 0; out.push(...lines, ...rest); break; }
      case 'balance': { const sz = Math.min(W, H), cx = W * .32; txts.forEach((t, i) => { const d = sz * (1 - i / n); const b = box(cx - d / 2, H / 2 - d / 2, d, d, '', A(i), { geom: 'ellipse', line: { type: 'solid', color: 'bg1', width: 1.5 } }); out.push(b); const y = H / 2 - sz / 2 + (i + .1) * sz / (n * 2) ; out.push(box(W * .62, H * .1 + i * (H * .8 / n), W * .38, H * .8 / n - 6, t, A(i), { geom: 'rect', size: fs })); void y; }); break; }
      case 'matrix': { const g = 6, s = 2, w = (W - g) / s, hh = (H - g) / s; txts.slice(0, 4).forEach((t, i) => out.push(box((i % 2) * (w + g), Math.floor(i / 2) * (hh + g), w, hh, t, A(i), { geom: 'rect', size: Math.min(fs + 2, 22) }))); break; }
      case 'pyramid': { const hh = H / n, ww = Math.min(W, H * 1.2), x0 = (W - ww) / 2; txts.forEach((t, i) => { const top = ww * i / n, bot = ww * (i + 1) / n, cx = x0 + ww / 2; if (i === 0) out.push(box(cx - bot / 2, 0, bot, hh, t, A(i), { geom: 'triangle', size: Math.max(10, fs - 4), line: { type: 'solid', color: 'bg1', width: 1.5 } })); else { const inset = (bot - top) / 2; const b = box(cx - bot / 2, i * hh, bot, hh, t, A(i), { geom: 'trapezoid', adj: [inset / Math.min(bot, hh) * 100000], size: fs, line: { type: 'solid', color: 'bg1', width: 1.5 } }); out.push(b); } }); break; }
      case 'funnel': { const hh = H / n, ww = Math.min(W, H * 1.4), x0 = (W - ww) / 2; txts.forEach((t, i) => { const top = ww * (1 - i / n * .75), bot = ww * (1 - (i + 1) / n * .75), cx = x0 + ww / 2, inset = (top - bot) / 2; const b = box(cx - top / 2, i * hh, top, hh, t, A(i), { geom: 'trapezoid', adj: [inset / Math.min(top, hh) * 100000], size: fs, line: { type: 'solid', color: 'bg1', width: 1.5 } }); b.flipV = true; out.push(b); }); break; }
    }
    return out;
  };
  const parseItems = text => text.split(/\r?\n/).filter(l => l.trim()).map(l => { const m = /^(\s*)/.exec(l)[1]; return { t: l.trim().replace(/^[•\-*]\s*/, ''), level: Math.min(4, m.replace(/\t/g, '  ').length >> 1) }; });
  P.smartArtDialog = (phId, initialText, editEl) => {
    let kind = (editEl && editEl.smartart && editEl.smartart.kind) || 'blockList';
    const defaults = { hierarchy: 'CEO\n  Director A\n    Manager\n  Director B\n  Director C' };
    const ta = h('textarea', { class: 'field sa-text', spellcheck: false, value: initialText || (editEl && editEl.smartart && editEl.smartart.text) || 'First item\nSecond item\nThird item' });
    const prev = h('div', { class: 'sa-prev' });
    const cats = h('div', { class: 'sa-kinds' });
    const paint = () => {
      prev.innerHTML = ''; const items = parseItems(ta.value); if (!items.length) return;
      const W = 420, H = 260; const g = { id: 'x', type: 'group', x: 10, y: 10, w: W, h: H, children: P.buildSmartArt(kind, items, W, H) };
      const fake = { kind: 'layout', id: 'x', elements: [] }; const ctx = { page: fake, deck: P.deck, mode: 'thumb' };
      const pg = h('div', { class: 'pg' }); pg.style.width = '440px'; pg.style.height = '280px'; pg.style.background = '#fff'; pg.append(P.renderEl(g, ctx)); prev.append(pg);
    };
    const ins = () => {
      const items = parseItems(ta.value); if (!items.length) return;
      const D = P.deck.size; const ph = phId ? P.findEl(phId) : (editEl ? null : P.takePlaceholder(['obj', 'body']));
      const b = editEl ? P.box(editEl) : ph ? P.box(ph) : { x: D.w * .12, y: D.h * .2, w: D.w * .76, h: D.h * .68 };
      const g = { id: P.uid(), type: 'group', name: 'SmartArt ' + (P.page().elements.length + 1), x: b.x, y: b.y, w: b.w, h: b.h, children: P.buildSmartArt(kind, items, b.w, b.h), smartart: { kind, text: ta.value } };
      if (editEl) { const sib = P.siblings(editEl.id); sib[sib.indexOf(editEl)] = g; } else if (ph && ph.ph) { const i = P.page().elements.indexOf(ph); P.page().elements.splice(i, 1, g); } else P.page().elements.push(g);
      S.sel = [g.id]; P.commit(editEl ? 'Edit SmartArt' : 'Insert SmartArt');
    };
    P.smartArtKinds.forEach(([c, list]) => { cats.append(h('div', { class: 'sa-cat', text: c })); list.forEach(([k, n]) => { const b = h('button', { class: 'sa-kind' + (k === kind ? ' on' : ''), text: n }); b.onclick = () => { kind = k; cats.querySelectorAll('.sa-kind').forEach(x => x.classList.remove('on')); b.classList.add('on'); if (k === 'hierarchy' && !initialText && ta.value.indexOf('  ') < 0) ta.value = defaults.hierarchy; paint(); }; cats.append(b); }); });
    ta.oninput = paint; ta.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText('  ', s, s, 'end'); paint(); } e.stopPropagation(); });
    P.modal({ title: editEl ? 'Edit SmartArt Text' : 'Choose a SmartArt Graphic', width: 900, body: h('div', { class: 'sa-dlg' }, cats, h('div', { class: 'sa-mid' }, h('div', { class: 'lbl', text: 'Type your text here (one per line; indent with two spaces):' }), ta), prev), buttons: [['OK', () => { ins(); return true; }, true], ['Cancel', () => true]] });
    paint();
  };
  P.convertToSmartArt = () => { const el = P.selected()[0]; const txt = el && el.paras ? el.paras.map(p => '  '.repeat(p.level || 0) + (p.runs || []).map(r => r.t).join('')).join('\n') : ''; P.T.end(); P.smartArtDialog(el && el.ph ? el.id : null, txt); };

  /* ---------- icons library ---------- */
  P.iconsDialog = phId => {
    const body = h('div', { class: 'icons-dlg' });
    const search = h('input', { class: 'field wide', placeholder: 'Search icons' }); const list = h('div', { class: 'icons-list' }); body.append(search, list);
    const addIc = (name, d) => {
      const ph = phId ? P.findEl(phId) : null; const D = P.deck.size; const s = 120; const b = ph ? P.box(ph) : null;
      const el = { id: P.uid(), type: 'shape', geom: 'custom', name: 'Graphic ' + name, alt: name, x: b ? b.x + (b.w - s) / 2 : (D.w - s) / 2, y: b ? b.y + (b.h - s) / 2 : (D.h - s) / 2, w: s, h: s, paths: [{ d, w: 24, h: 24 }], fill: { type: 'solid', color: 'accent1' }, line: { type: 'none' }, lockAR: true };
      if (ph) { const i = P.page().elements.indexOf(ph); P.page().elements.splice(i, 1, el); } else P.page().elements.push(el);
      S.sel = [el.id]; P.commit('Insert icon');
    };
    let dlg;
    const paint = () => {
      list.innerHTML = ''; const q = search.value.trim().toLowerCase();
      for (const cat in P.iconLib) { const items = Object.entries(P.iconLib[cat]).filter(([n]) => !q || n.toLowerCase().includes(q)); if (!items.length) continue; list.append(h('div', { class: 'sa-cat', text: cat })); const g = h('div', { class: 'icons-grid' }); items.forEach(([n, d]) => { const b = h('button', { class: 'icon-pick', title: n, html: `<svg viewBox="0 0 24 24" width="40" height="40"><path d="${d}" fill="#444" fill-rule="evenodd"/></svg>` }); b.onclick = () => { addIc(n, d); dlg.close(); }; g.append(b); }); list.append(g); }
    };
    search.oninput = paint; search.onkeydown = e => e.stopPropagation(); paint();
    dlg = P.modal({ title: 'Insert Icons', width: 620, body, buttons: [['Close', () => true]] });
  };

  /* ---------- text inserts ---------- */
  P.WORDART = [
    { name: 'Fill: Black', r: { color: 'tx1' } }, { name: 'Fill: Accent 1, Shadow', r: { color: 'accent1', shadow: { color: '#000000', dist: 2, dir: 45, blur: 3, opacity: .4 } } }, { name: 'Fill: Accent 2, Outline', r: { color: 'accent2', outline: { color: 'accent2:50,0', w: 1 } } }, { name: 'Fill: White, Outline Accent 1', r: { color: 'bg1', outline: { color: 'accent1', w: 1.2 }, shadow: { color: 'accent1', dist: 1, dir: 45, blur: 3, opacity: .7 } } },
    { name: 'Fill: Accent 4, Soft Bevel', r: { color: 'accent4', outline: { color: 'accent4:75,0', w: .6 } } }, { name: 'Gradient: Accent 1', r: { tfill: { type: 'gradient', kind: 'linear', angle: 90, stops: [{ pos: 0, color: 'accent1:60,40' }, { pos: 100, color: 'accent1:50,0' }] } } }, { name: 'Gradient: Accent 2', r: { tfill: { type: 'gradient', kind: 'linear', angle: 90, stops: [{ pos: 0, color: 'accent4' }, { pos: 100, color: 'accent2' }] } } }, { name: 'Gradient: Rainbow', r: { tfill: { type: 'gradient', kind: 'linear', angle: 0, stops: [{ pos: 0, color: 'accent1' }, { pos: 50, color: 'accent6' }, { pos: 100, color: 'accent2' }] } } },
    { name: 'Outline: Accent 1', r: { tfill: { type: 'none' }, outline: { color: 'accent1', w: 1.5 } } }, { name: 'Outline: Black', r: { tfill: { type: 'none' }, outline: { color: 'tx1', w: 1 } } }, { name: 'Glow: Accent 1', r: { color: 'bg1', glow: { color: 'accent1', rad: 8 } } }, { name: 'Glow: Accent 4', r: { color: 'tx1', glow: { color: 'accent4', rad: 8 } } }
  ];
  P.insertWordArt = preset => {
    const D = P.deck.size, tb = P.textBox(D.w * .15, D.h * .35, D.w * .7, 90); tb.name = 'WordArt ' + (P.page().elements.length + 1);
    tb.paras = [{ align: 'ctr', runs: [Object.assign({ t: 'Your text here', size: 54 }, P.clone(preset.r))] }]; tb.fit = 'resize'; P.page().elements.push(tb); S.sel = [tb.id]; P.T.fit(tb); P.commit('Insert WordArt'); P.T.begin(tb.id, { selectAll: true });
  };
  P.applyWordArt = preset => {
    const clear = { color: undefined, outline: undefined, shadow: undefined, glow: undefined, tfill: undefined };
    P.mapRuns(r => { for (const k in clear) delete r[k]; Object.assign(r, P.clone(preset.r)); }, 'WordArt style');
  };
  P.symbolDialog = () => {
    const ranges = { Common: '©®™°±×÷≠≤≥≈∞µ¶§†‡•…‰′″€£¥¢₹', Greek: 'αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ', Math: '∀∂∃∅∆∇∈∉∋∏∑−√∝∞∠∧∨∩∪∫∴∼≅≈≠≡≤≥⊂⊃⊆⊇⊕⊗⊥', Arrows: '←↑→↓↔↕⇐⇑⇒⇓⇔↩↪↺↻➔➜➤', Shapes: '■□▪▫▲△▶▷▼▽◀◁◆◇○●★☆☐☑☒✓✔✕✖✦✧', Emoji: '😀😂😍🤔👍👎🎉🔥⭐💡📌📈📉✅❌⚠️🚀🎯' };
    const g = h('div', { class: 'sym-grid' }); const sel = P.select(Object.keys(ranges), 'Common', v => draw(v));
    const draw = k => { g.innerHTML = ''; [...ranges[k]].forEach(c => { const b = h('button', { class: 'sym', text: c }); b.onclick = () => ins(c); g.append(b); }); };
    const ins = c => {
      if (P.T.active) { P.T.active.root.focus(); P.T.insertText(c); return; }
      const el = P.selected()[0]; if (el && (!el.type || el.type === 'shape')) { P.T.begin(el.id); P.T.insertText(c); return; }
      const D = P.deck.size, tb = P.textBox(D.w / 2 - 40, D.h / 2 - 20, 80, 40); tb.paras = [P.para(c)]; tb.fit = 'resize'; P.page().elements.push(tb); S.sel = [tb.id]; P.commit('Insert symbol');
    };
    draw('Common');
    P.modal({ title: 'Symbol', width: 480, body: h('div', {}, P.field('Subset:', sel), g), buttons: [['Close', () => true]] });
  };
  P.equationDialog = () => {
    const items = ['x = (−b ± √(b² − 4ac)) / 2a', 'a² + b² = c²', 'E = mc²', 'A = πr²', 'e^(iπ) + 1 = 0', '∑ᵢ₌₁ⁿ i = n(n+1)/2', '∫₀¹ x² dx = 1/3', '(x + a)ⁿ = ∑ₖ₌₀ⁿ C(n,k) xᵏ aⁿ⁻ᵏ', 'sin²θ + cos²θ = 1'];
    const ta = h('input', { class: 'field wide', placeholder: 'Type an equation, e.g. a² + b² = c²' });
    const sup = { '^0': '⁰', '^1': '¹', '^2': '²', '^3': '³', '^4': '⁴', '^5': '⁵', '^6': '⁶', '^7': '⁷', '^8': '⁸', '^9': '⁹', '_0': '₀', '_1': '₁', '_2': '₂', '_3': '₃', '_4': '₄', '_5': '₅', '_6': '₆', '_7': '₇', '_8': '₈', '_9': '₉', '\\pi': 'π', '\\sum': '∑', '\\int': '∫', '\\sqrt': '√', '\\pm': '±', '\\theta': 'θ', '\\alpha': 'α', '\\beta': 'β', '\\infty': '∞', '\\ne': '≠', '\\le': '≤', '\\ge': '≥', '\\times': '×', '\\div': '÷', '\\Delta': 'Δ', '\\mu': 'µ', '\\sigma': 'σ' };
    const conv = s => { let o = s; Object.keys(sup).sort((a, b) => b.length - a.length).forEach(k => { o = o.split(k).join(sup[k]); }); return o; };
    const list = h('div', { class: 'eq-list' }); items.forEach(t => { const b = h('button', { class: 'eq', text: t }); b.onclick = () => { ta.value = t; }; list.append(b); });
    P.modal({ title: 'Equation', width: 520, body: h('div', {}, list, ta, h('div', { class: 'hint', text: 'Shortcuts: ^2 _1 \\pi \\sum \\int \\sqrt \\pm \\theta \\ne \\le \\ge' })), buttons: [['Insert', () => { const D = P.deck.size, tb = P.textBox(D.w * .2, D.h * .42, D.w * .6, 50); tb.paras = [{ align: 'ctr', runs: [{ t: conv(ta.value || items[0]), size: 28, font: 'Cambria Math' }] }]; tb.fit = 'resize'; P.page().elements.push(tb); S.sel = [tb.id]; P.T.fit(tb); P.commit('Insert equation'); return true; }, true], ['Cancel', () => true]] });
  };
  P.linkDialog = () => {
    const sel = P.selected()[0]; const T = P.T; const hasRange = T.active; let cur = null;
    if (T.active) { const st = T.getSel(); const para = (T.active.cell ? P.curTable().el.tbl.rows[T.active.cell.r].cells[T.active.cell.c].paras : T.active.el.paras)[st.a.p]; const r = para && (para.runs || []).find(x => x.link); cur = r && r.link; } else if (sel) cur = sel.link;
    const url = h('input', { class: 'field wide', value: (cur && cur.url) || '', placeholder: 'https://example.com' });
    const opts = P.deck.slides.map((s, i) => { const t = s.elements.find(e => e.ph && /itle/.test(e.ph.type)); return [s.id, `${i + 1}. ${t ? P.parasText(t.paras).slice(0, 40) : 'Slide ' + (i + 1)}`]; });
    const slideSel = P.select([['', '(none)'], ...opts], (cur && cur.slide) || '');
    const act = () => (url.value.trim() ? { url: url.value.trim() } : slideSel.value ? { slide: slideSel.value } : null);
    P.modal({ title: 'Insert Hyperlink', width: 460, body: h('div', {}, P.field('Address (web page or file):', url), P.field('Or place in this document:', slideSel)), buttons: [['OK', () => { const l = act(); if (hasRange) P.fmtRun({ link: l }, 'Hyperlink'); else if (sel) { if (sel.paras && P.hasText(sel) && sel.ph) { P.mapRuns(r => { if (l) r.link = l; else delete r.link; }, 'Hyperlink'); } else { sel.link = l || undefined; P.commit('Hyperlink'); } } return true; }, true], ['Remove Link', () => { if (hasRange) P.fmtRun({ link: undefined }, 'Remove hyperlink'); else if (sel) { delete sel.link; P.mapRuns(r => delete r.link, 'Remove hyperlink'); P.commit('Remove hyperlink'); } return true; }], ['Cancel', () => true]] });
  };
  P.actionDialog = () => {
    const el = P.selected()[0]; if (!el) { P.toast('Select a shape first.'); return; }
    const cur = el.link && el.link.act; const opt = [['', 'None'], ['next', 'Next Slide'], ['prev', 'Previous Slide'], ['first', 'First Slide'], ['last', 'Last Slide'], ['end', 'End Show']];
    const s = P.select(opt, cur || '');
    P.modal({ title: 'Action Settings', width: 340, body: P.field('Hyperlink to (on mouse click):', s), buttons: [['OK', () => { if (s.value) el.link = { act: s.value }; else delete el.link; P.commit('Action'); return true; }, true], ['Cancel', () => true]] });
  };
  P.headerFooterDialog = () => {
    const firstFtr = P.deck.slides.map(s => s.elements.find(e => e.ph && e.ph.type === 'ftr')).find(Boolean);
    const cDate = h('input', { type: 'checkbox' }), cNum = h('input', { type: 'checkbox' }), cFtr = h('input', { type: 'checkbox' }), cTitle = h('input', { type: 'checkbox' });
    const cur = P.page(); const has = t => cur.elements && cur.elements.some(e => e.ph && e.ph.type === t);
    cDate.checked = has('dt'); cNum.checked = has('sldNum'); cFtr.checked = has('ftr');
    const auto = h('input', { type: 'radio', name: 'dtm', checked: true }), fixed = h('input', { type: 'radio', name: 'dtm' }), fixedT = h('input', { class: 'field', value: new Date().toLocaleDateString() });
    const ftr = h('input', { class: 'field wide', value: firstFtr ? P.parasText(firstFtr.paras) : '' });
    const apply = (slides) => {
      slides.forEach(s => {
        if (cTitle.checked && P.layoutOf(s).id === 'title') { s.elements = s.elements.filter(e => !(e.ph && ['dt', 'ftr', 'sldNum'].includes(e.ph.type))); return; }
        const set = (type, on, paras, idx, name) => { const ex = s.elements.find(e => e.ph && e.ph.type === type); if (!on) { if (ex) s.elements.splice(s.elements.indexOf(ex), 1); return; } if (ex) ex.paras = paras; else s.elements.push({ id: P.uid(), type: 'shape', geom: 'rect', name, ph: { type, idx }, paras }); };
        set('dt', cDate.checked, [{ runs: [auto.checked ? { t: new Date().toLocaleDateString(), field: 'datetime1' } : { t: fixedT.value }] }], 10, 'Date Placeholder');
        set('ftr', cFtr.checked, [P.para(ftr.value)], 11, 'Footer Placeholder');
        set('sldNum', cNum.checked, [{ runs: [{ t: '‹#›', field: 'slidenum' }] }], 12, 'Slide Number Placeholder');
      });
      P.commit('Header & Footer', { all: true });
    };
    const row = (i, t) => h('label', { class: 'chk' }, i, h('span', { text: t }));
    P.modal({ title: 'Header and Footer', width: 480, body: h('div', { class: 'hf' }, row(cDate, 'Date and time'), h('div', { class: 'indent' }, row(auto, 'Update automatically'), h('div', { class: 'indent2' }, row(fixed, 'Fixed '), fixedT)), row(cNum, 'Slide number'), row(cFtr, 'Footer'), h('div', { class: 'indent' }, ftr), row(cTitle, "Don't show on title slide")), buttons: [['Apply to All', () => { apply(P.deck.slides); return true; }, true], ['Apply', () => { if (!cur.kind) apply([cur]); return true; }], ['Cancel', () => true]] });
  };
  P.insertDate = () => {
    const d = new Date(); const fmts = [['1', d.toLocaleDateString()], ['2', d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })], ['3', d.toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })], ['4', d.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })], ['10', d.toLocaleTimeString(undefined, { timeStyle: 'short' })], ['11', d.toLocaleTimeString()]];
    const list = h('select', { class: 'field wide', size: 6 }); fmts.forEach(([k, t], i) => list.append(h('option', { value: k, text: t, selected: i === 0 })));
    const up = h('input', { type: 'checkbox', checked: true });
    P.modal({ title: 'Date and Time', width: 360, body: h('div', {}, list, h('label', { class: 'chk' }, up, h('span', { text: 'Update automatically' }))), buttons: [['OK', () => {
      const k = list.value, t = fmts.find(f => f[0] === k)[1]; const run = up.checked ? { t, field: 'datetime' + k } : { t };
      if (P.T.active) { const a = P.T.active; P.T.insertText(t); if (up.checked) { const sel = P.T.getSel(); const paras = P.T.sync(); const p = paras[sel.a.p]; const rr = (p.runs || []).find(r => r.t.includes(t)); if (rr && rr.t === t) rr.field = run.field; void a; } return true; }
      const D = P.deck.size, tb = P.textBox(D.w * .35, D.h * .45, D.w * .3, 30); tb.paras = [{ runs: [run] }]; tb.fit = 'resize'; P.page().elements.push(tb); S.sel = [tb.id]; P.T.fit(tb); P.commit('Date and time'); return true;
    }, true], ['Cancel', () => true]] });
  };
  P.insertSlideNumber = () => {
    if (P.T.active) { const a = P.T.active; const sel = P.T.getSel(), paras = P.T.sync(); const p = paras[sel.a.p]; p.runs = p.runs || []; p.runs.push({ t: '‹#›', field: 'slidenum' }); void a; P.T.refresh(sel); return; }
    P.headerFooterDialog();
  };

  /* ---------- find & replace ---------- */
  let findState = { q: '', pos: null };
  const walkText = fn => { P.deck.slides.forEach((s, si) => P.walk(s.elements, el => { if (el.paras) fn(si, el, el.paras); if (el.tbl) el.tbl.rows.forEach(r => r.cells.forEach(c => fn(si, el, c.paras || [], c))); })); };
  P.findDialog = (replace) => {
    P.T.end();
    const q = h('input', { class: 'field wide', value: findState.q }), rp = h('input', { class: 'field wide' });
    const cs = h('input', { type: 'checkbox' }), ww = h('input', { type: 'checkbox' });
    const msg = h('div', { class: 'hint' });
    const makeRe = () => { let e = q.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); if (ww.checked) e = '\\b' + e + '\\b'; return new RegExp(e, cs.checked ? 'g' : 'gi'); };
    const allHits = () => { const hits = []; if (!q.value) return hits; const re = makeRe(); walkText((si, el, paras) => paras.forEach((p, pi) => { const t = (p.runs || []).map(r => r.t).join(''); let m; re.lastIndex = 0; while ((m = re.exec(t))) { hits.push({ si, el, p, pi, i: m.index, len: m[0].length, paras }); if (!m[0].length) break; } })); return hits; };
    let idx = -1;
    const next = () => {
      const hits = allHits(); findState.q = q.value; if (!hits.length) { msg.textContent = 'Nothing found.'; return null; }
      idx = (idx + 1) % hits.length; const hit = hits[idx]; P.gotoSlide(hit.si); S.sel = [hit.el.id]; P.renderCanvas(); P.emit('selection');
      msg.textContent = `Result ${idx + 1} of ${hits.length} (slide ${hit.si + 1})`;
      if (hit.el.type !== 'table') { P.T.begin(hit.el.id); const pos = { a: { p: hit.pi, o: hit.i }, b: { p: hit.pi, o: hit.i + hit.len } }; P.T.setSel(pos); }
      return hit;
    };
    const replaceIn = (p, i, len, str) => { let n = 0, done = false; (p.runs || []).forEach(r => { const a = n, b = n + r.t.length; n = b; if (b <= i || a >= i + len) return; const s = Math.max(0, i - a), e = Math.min(r.t.length, i + len - a); r.t = r.t.slice(0, s) + (done ? '' : str) + r.t.slice(e); done = true; }); p.runs = p.runs.filter(r => r.t); };
    const repOne = () => { P.T.end(); const hits = allHits(); if (!hits.length) { msg.textContent = 'Nothing found.'; return; } if (idx < 0 || idx >= hits.length) idx = 0; const hit = hits[idx]; replaceIn(hit.p, hit.i, hit.len, rp.value); P.commit('Replace'); idx--; next(); };
    const repAll = () => { P.T.end(); let c = 0; const hits = allHits().reverse(); hits.forEach(hit => { replaceIn(hit.p, hit.i, hit.len, rp.value); c++; }); if (c) P.commit('Replace All', { all: true }); msg.textContent = `Replaced ${c} occurrence(s).`; idx = -1; };
    const body = h('div', { class: 'find' }, P.field('Find what:', q), replace ? P.field('Replace with:', rp) : null, h('label', { class: 'chk' }, cs, h('span', { text: 'Match case' })), h('label', { class: 'chk' }, ww, h('span', { text: 'Find whole words only' })), msg);
    const btns = [['Find Next', () => { next(); return false; }, true]];
    if (replace) btns.push(['Replace', () => { repOne(); return false; }], ['Replace All', () => { repAll(); return false; }]);
    btns.push(['Close', () => true]);
    P.modal({ title: replace ? 'Replace' : 'Find', width: 420, body, buttons: btns });
  };

  /* ---------- picture crop ---------- */
  P.startCrop = () => {
    const el = P.selected().find(e => e.type === 'image'); if (!el) return;
    const b0 = P.box(el), c = el.crop = Object.assign({ l: 0, t: 0, r: 0, b: 0 }, el.crop);
    const fullW = b0.w / (1 - c.l - c.r), fullH = b0.h / (1 - c.t - c.b); const fx = b0.x - c.l * fullW, fy = b0.y - c.t * fullH;
    const stage = document.getElementById('overlay'); const sc = P.canvasScale();
    const hostR = () => document.getElementById('host').getBoundingClientRect(), wrapR = () => document.getElementById('canvasWrap').getBoundingClientRect();
    const layer = h('div', { class: 'crop-layer' });
    const toScreen = (x, y) => { const hr = hostR(), wr = wrapR(); return [hr.left - wr.left + x * sc, hr.top - wr.top + y * sc]; };
    const ghost = h('img', { src: P.mediaUrl(el.src), class: 'crop-ghost' });
    const frame = h('div', { class: 'crop-frame' });
    layer.append(ghost, frame); stage.parentNode.append(layer);
    const [gx, gy] = toScreen(fx, fy); Object.assign(ghost.style, { left: gx + 'px', top: gy + 'px', width: fullW * sc + 'px', height: fullH * sc + 'px' });
    const paint = () => { const b = P.box(el); const [x, y] = toScreen(b.x, b.y); Object.assign(frame.style, { left: x + 'px', top: y + 'px', width: b.w * sc + 'px', height: b.h * sc + 'px' }); };
    ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(n => {
      const d = h('div', { class: 'crop-h ch-' + n }); frame.append(d);
      d.addEventListener('pointerdown', e => {
        e.stopPropagation(); e.preventDefault();
        const mv = ev => {
          const p = P.toPt(ev); let { l, t, r, b } = el.crop;
          if (n.includes('w')) l = P.clamp((p.x - fx) / fullW, 0, 1 - r - .02);
          if (n.includes('e')) r = P.clamp(1 - (p.x - fx) / fullW, 0, 1 - l - .02);
          if (n.includes('n')) t = P.clamp((p.y - fy) / fullH, 0, 1 - b - .02);
          if (n.includes('s')) b = P.clamp(1 - (p.y - fy) / fullH, 0, 1 - t - .02);
          el.crop = { l, t, r, b }; el.x = fx + l * fullW; el.y = fy + t * fullH; el.w = fullW * (1 - l - r); el.h = fullH * (1 - t - b);
          P.renderCanvas(); paint();
        };
        const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      });
    });
    paint(); S.cropping = el.id;
    const finish = () => { layer.remove(); S.cropping = null; removeEventListener('keydown', key, true); P.commit('Crop picture'); };
    const key = e => { if (e.key === 'Escape' || e.key === 'Enter') { e.stopPropagation(); finish(); } };
    addEventListener('keydown', key, true);
    layer.addEventListener('pointerdown', e => { if (e.target === layer || e.target === ghost) finish(); });
    P.endCrop = finish;
  };

  /* ---------- context menu ---------- */
  P.contextItems = () => {
    const sel = P.selected(), one = sel[0];
    if (!sel.length) return [{ label: 'Paste', icon: 'paste', key: 'Ctrl+V', fn: () => P.pasteClip(), disabled: !P.clip }, '-', { label: 'Layout', icon: 'layout', sub: () => P.deck.layouts.map(l => ({ label: l.name, fn: () => P.setLayout(l.id) })) }, { label: 'Reset Slide', icon: 'reset', fn: () => P.resetSlide() }, '-', { label: 'Grid and Guides', icon: 'grid', sub: [{ label: 'Gridlines', check: S.grid, fn: () => P.toggleView('grid') }, { label: 'Guides', check: S.guides, fn: () => P.toggleView('guides') }, { label: 'Ruler', check: S.ruler, fn: () => P.toggleView('ruler') }] }, { label: 'Format Background…', icon: 'background', fn: () => P.openPane('background') }, { label: 'New Comment', icon: 'newcomment', fn: () => P.addComment() }];
    const items = [{ label: 'Cut', icon: 'cut', key: 'Ctrl+X', fn: () => { P.copySel(); P.deleteSelected(); } }, { label: 'Copy', icon: 'copy', key: 'Ctrl+C', fn: () => P.copySel() }, { label: 'Paste', icon: 'paste', key: 'Ctrl+V', fn: () => P.pasteClip(), disabled: !P.clip }, '-'];
    if (one.type === 'image') items.push({ label: 'Change Picture', icon: 'change', fn: () => P.changePicture() }, { label: 'Crop', icon: 'crop', fn: () => P.startCrop() });
    if (one.type === 'chart') items.push({ label: 'Edit Data', icon: 'chartdata', fn: () => P.chartDataDialog(one) }, { label: 'Change Chart Type', icon: 'charttype', sub: () => P.chartKinds.map(([k, n]) => ({ label: n, fn: () => P.setChartKind(k) })) });
    if (one.smartart) items.push({ label: 'Edit SmartArt Text', icon: 'smartart', fn: () => P.smartArtDialog(null, null, one) });
    if (!one.type || one.type === 'shape') items.push({ label: 'Edit Text', icon: 'textbox', fn: () => P.T.begin(one.id) });
    items.push({ label: 'Group', icon: 'group', sub: [{ label: 'Group', key: 'Ctrl+G', disabled: sel.length < 2, fn: P.groupSelected }, { label: 'Ungroup', key: 'Ctrl+Shift+G', disabled: one.type !== 'group', fn: P.ungroupSelected }] });
    items.push({ label: 'Bring to Front', icon: 'bringfwd', sub: [{ label: 'Bring to Front', fn: () => P.zorder('front') }, { label: 'Bring Forward', fn: () => P.zorder('forward') }] }, { label: 'Send to Back', icon: 'sendback', sub: [{ label: 'Send to Back', fn: () => P.zorder('back') }, { label: 'Send Backward', fn: () => P.zorder('backward') }] }, '-');
    items.push({ label: 'Link', icon: 'link', key: 'Ctrl+K', fn: () => P.linkDialog() }, { label: 'Edit Alt Text…', icon: 'alt', fn: () => P.altTextDialog() }, { label: 'Size and Position…', icon: 'slidesize', fn: () => P.openPane('format', 'size') }, { label: one.type === 'image' ? 'Format Picture…' : 'Format Shape…', icon: 'fill', fn: () => P.openPane('format') }, { label: 'New Comment', icon: 'newcomment', fn: () => P.addComment() });
    return items;
  };
  P.changePicture = async () => { const el = P.selected().find(e => e.type === 'image'); if (!el) return; const f = await pickFile('image/*'); if (!f[0]) return; const id = P.addMedia(f[0], f[0].name); const [nw, nh] = await imgSize(P.deck.media[id].url); const b = P.box(el); const r = nw / nh; const nh2 = b.w / r; el.src = 'media:' + id; el.natural = [nw, nh]; el.h = nh2; delete el.crop; P.commit('Change picture'); void b; };
  P.setChartKind = k => { const el = P.selected().find(e => e.type === 'chart'); if (!el) return; const [kind, gr] = k.split('-'); el.chart.kind = kind; el.chart.grouping = gr === 'stacked' ? 'stacked' : gr === 'percent' ? 'percent' : 'clustered'; el.chart.marker = gr === 'marker' || undefined; P.commit('Change chart type'); };
  P.altTextDialog = () => { const el = P.selected()[0]; if (!el) return; const ta = h('textarea', { class: 'field wide', rows: 4, value: el.alt || '' }); ta.onkeydown = e => e.stopPropagation(); P.modal({ title: 'Alt Text', width: 420, body: h('div', {}, h('div', { class: 'hint', text: 'How would you describe this object and its context to someone who is blind?' }), ta), buttons: [['OK', () => { el.alt = ta.value; P.commit('Alt text'); return true; }, true], ['Cancel', () => true]] }); };
})(window.P);
