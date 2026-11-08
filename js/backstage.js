/* Podium - File menu, open/save, autosave, export, print, templates, boot */
(function (P) {
  'use strict';
  const S = P.S;
  let fileHandle = null;

  /* ---------- small IndexedDB store: recents & autosave ---------- */
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('podium', 2); r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); }; r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const kvSet = async (k, v) => { try { const d = await idb(); await new Promise((res, rej) => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = res; t.onerror = () => rej(t.error); }); d.close(); } catch (e) { console.warn('storage unavailable', e); } };
  const kvGet = async k => { try { const d = await idb(); const v = await new Promise((res, rej) => { const q = d.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); }); d.close(); return v; } catch (e) { return undefined; } };
  const kvDel = async k => { try { const d = await idb(); await new Promise(res => { const t = d.transaction('kv', 'readwrite'); t.objectStore('kv').delete(k); t.oncomplete = res; t.onerror = res; }); d.close(); } catch (_) {} };

  /* ---------- load / save ---------- */
  P.loadDeck = (deck, name, handle) => {
    P.deck = deck; deck.title = name || deck.title || 'Presentation1';
    fileHandle = handle || null; P.fileName = name || null;
    S.cur = 0; S.sel = []; S.slideSel = [0]; S.editing = null; S.view = 'normal'; S.master = null; S.outline = false; S.zoom = null;
    document.getElementById('workspace').dataset.view = 'normal';
    document.getElementById('sorter').style.display = 'none'; document.getElementById('notesPage').style.display = 'none';
    P.resetHistory(); P.dirty = false; updateTitle();
    P.emit('deck'); P.emit('view'); P.emit('selection');
  };
  const updateTitle = () => { const n = P.deck.title || 'Presentation'; const t = document.getElementById('docTitle'); if (t) t.textContent = n + (P.dirty ? ' •' : ''); document.title = n + ' - Podium'; };
  const baseName = n => (n || 'Presentation').replace(/\.pptx$/i, '');
  P.openBlob = async (blob, handle) => {
    const name = blob.name || 'Presentation.pptx';
    P.toast('Opening ' + name + '…');
    try { const deck = await P.readPptx(blob); P.loadDeck(deck, baseName(name), handle); addRecent(name, blob, handle); closeBackstage(); P.toast('Opened ' + name); return deck; }
    catch (e) { console.error(e); P.modal({ title: 'Podium', width: 460, body: h('div', { class: 'confirm-msg', text: `Podium can't read "${name}". The file may be damaged or not a PowerPoint .pptx presentation.\n\nDetails: ${e.message}` }), buttons: [['OK', () => true, true]] }); }
  };
  P.openFile = async () => {
    if (window.showOpenFilePicker) {
      try { const [hd] = await window.showOpenFilePicker({ types: [{ description: 'PowerPoint Presentation', accept: { 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] } }] }); const f = await hd.getFile(); P.confirmDiscard(() => P.openBlob(f, hd)); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const f = await P.pickFile('.pptx'); if (f[0]) P.confirmDiscard(() => P.openBlob(f[0]));
  };
  P.confirmDiscard = then => { if (!P.dirty) { then(); return; } P.modal({ title: 'Podium', width: 460, body: h('div', { class: 'confirm-msg', text: `Do you want to save the changes you made to "${P.deck.title}"?` }), buttons: [['Save', () => { P.save().then(then); return true; }, true], ["Don't Save", () => { then(); return true; }], ['Cancel', () => true]] }); };
  const downloadBlob = window.downloadBlob = (blob, name) => { const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 30000); };
  P.getPptxBlob = () => { P.T.end(); return P.writePptx(P.deck); };
  P.save = async () => {
    if (!fileHandle) return P.saveAs();
    try { const blob = await P.getPptxBlob(); const w = await fileHandle.createWritable(); await w.write(blob); await w.close(); markSaved(); P.toast('Saved.'); addRecent(fileHandle.name, blob, fileHandle); }
    catch (e) { console.error(e); P.toast('Could not save to that location; choose another.'); return P.saveAs(); }
  };
  P.saveAs = async () => {
    const blob = await P.getPptxBlob();
    const suggested = baseName(P.deck.title) + '.pptx';
    if (window.showSaveFilePicker) {
      try { const hd = await window.showSaveFilePicker({ suggestedName: suggested, types: [{ description: 'PowerPoint Presentation', accept: { 'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'] } }] }); const w = await hd.createWritable(); await w.write(blob); await w.close(); fileHandle = hd; P.deck.title = baseName(hd.name); markSaved(); P.toast('Saved as ' + hd.name); addRecent(hd.name, blob, hd); closeBackstage(); return; }
      catch (e) { if (e.name === 'AbortError') return; console.warn(e); }
    }
    downloadBlob(blob, suggested); markSaved(); P.toast('Downloaded ' + suggested); closeBackstage();
  };
  const markSaved = () => { P.dirty = false; kvDel('autosave'); updateTitle(); };
  P.on('dirty', () => { updateTitle(); scheduleAutosave(); });
  /* autosave: crash recovery copy in browser storage */
  let asT = 0;
  const scheduleAutosave = () => { clearTimeout(asT); asT = setTimeout(autosave, 4000); };
  const autosave = async () => { if (!P.dirty || !P.deck) return; try { const blob = await P.writePptx(P.deck); await kvSet('autosave', { blob, name: P.deck.title, at: Date.now() }); } catch (e) { console.warn('autosave failed', e); } };
  /* recents */
  const addRecent = async (name, blob, handle) => { const list = (await kvGet('recent')) || []; const entry = { name, at: Date.now(), handle: handle || null, size: blob ? blob.size : 0 }; if (!handle && blob && blob.size < 30 * 1048576) entry.blob = blob; const next = [entry, ...list.filter(x => x.name !== name)].slice(0, 12); await kvSet('recent', next); };
  const openRecent = async it => {
    if (it.handle) { try { const perm = await it.handle.requestPermission({ mode: 'readwrite' }); if (perm === 'granted') { const f = await it.handle.getFile(); P.confirmDiscard(() => P.openBlob(f, it.handle)); return; } } catch (e) { console.warn(e); } }
    if (it.blob) { const f = new File([it.blob], it.name); P.confirmDiscard(() => P.openBlob(f)); return; }
    P.toast('That file is no longer available. Use Open to browse for it.');
  };

  /* Browse for Themes: takes colours and fonts from a .thmx theme or another .pptx */
  P.openTheme = async () => {
    const f = await P.pickFile('.thmx,.pptx'); if (!f[0]) return;
    try {
      const zip = await JSZip.loadAsync(f[0]);
      const part = Object.keys(zip.files).filter(n => /theme\/theme\d*\.xml$/i.test(n)).sort()[0]; if (!part) throw new Error('no theme inside');
      const doc = new DOMParser().parseFromString(await zip.file(part).async('string'), 'application/xml');
      const one = n => doc.getElementsByTagNameNS('*', n)[0];
      const colors = {}; ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].forEach(k => { const c = one(k).firstElementChild; colors[k] = '#' + (c.getAttribute('lastClr') || c.getAttribute('val')).toUpperCase(); });
      const face = n => one(n).getElementsByTagNameNS('*', 'latin')[0].getAttribute('typeface');
      P.deck.theme = Object.assign({}, P.deck.theme, { name: doc.documentElement.getAttribute('name') || f[0].name, colors, fonts: { major: face('majorFont'), minor: face('minorFont') }, def: undefined });
      P.commit('Apply theme', { all: true }); P.toast('Applied the colors and fonts from ' + f[0].name);
    } catch (e) { P.toast("Couldn't read a theme from that file."); }
  };

  /* ---------- rasterising slides ---------- */
  const inlineMedia = async (root) => {
    const toData = async url => { if (!url || url.startsWith('data:')) return url; const m = Object.values(P.deck.media).find(x => x.url === url); if (m) { if (!m.data) m.data = await P.blobToDataUrl(m.blob); return m.data; } try { const b = await (await fetch(url)).blob(); return await P.blobToDataUrl(b); } catch (_) { return url; } };
    for (const im of root.querySelectorAll('img')) im.setAttribute('src', await toData(im.getAttribute('src')));
    for (const im of root.querySelectorAll('image')) { const u = im.getAttribute('href'); if (u) im.setAttribute('href', await toData(u)); }
    for (const v of root.querySelectorAll('video,audio')) v.remove();
    for (const el of root.querySelectorAll('.pg-bg')) { const bg = el.style.backgroundImage; const m = /url\("?(blob:[^"')]+)"?\)/.exec(el.style.background || bg || ''); if (m) { const d = await toData(m[1]); el.style.background = el.style.background.replace(m[1], d); } }
  };
  P.rasterize = async (page, scale = 2, opts = {}) => {
    const deck = P.deck, W = deck.size.w, H = deck.size.h;
    const pg = P.renderPage(page, Object.assign({ mode: 'thumb' }, opts)); pg.style.transform = ''; pg.setAttribute('xmlns', 'http://www.w3.org/1999/xhtml');
    await inlineMedia(pg);
    const xhtml = new XMLSerializer().serializeToString(pg);
    const css = P.slideCSS.replace(/<\/?style>/g, '');
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W * scale}" height="${H * scale}" viewBox="0 0 ${W} ${H}"><foreignObject width="${W}" height="${H}"><div xmlns="http://www.w3.org/1999/xhtml"><style>${css.replace(/</g, '&lt;')}</style>${xhtml}</div></foreignObject></svg>`;
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const img = new Image(); await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('Could not draw slide')); img.src = url; });
    const c = document.createElement('canvas'); c.width = Math.round(W * scale); c.height = Math.round(H * scale); const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
    return c;
  };
  const b2u8 = async b => new Uint8Array(await b.arrayBuffer());
  /* compact image-based PDF writer */
  P.exportPdf = async (range) => {
    const slides = range || P.deck.slides.filter(s => !s.hidden); const pages = [];
    const bar = progress('Publishing PDF…', slides.length);
    for (let i = 0; i < slides.length; i++) { const c = await P.rasterize(slides[i], 2, { index: P.deck.slides.indexOf(slides[i]) }); const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', .92)); pages.push({ jpg: await b2u8(blob), w: c.width, h: c.height }); bar.step(i + 1); }
    bar.close();
    const enc = new TextEncoder(); const chunks = []; let off = 0; const offs = []; const W = s => { const u = typeof s === 'string' ? enc.encode(s) : s; chunks.push(u); off += u.length; };
    const D = P.deck.size; const n = pages.length;
    W('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
    const obj = (id, body) => { offs[id] = off; W(`${id} 0 obj\n`); if (typeof body === 'string') W(body); else body(); W('\nendobj\n'); };
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, `<< /Type /Pages /Count ${n} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`);
    pages.forEach((p, i) => {
      const pid = 3 + i * 3, cid = pid + 1, iid = pid + 2;
      obj(pid, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${D.w} ${D.h}] /Resources << /XObject << /I${i} ${iid} 0 R >> >> /Contents ${cid} 0 R >>`);
      const content = `q ${D.w} 0 0 ${D.h} 0 0 cm /I${i} Do Q`;
      obj(cid, `<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
      obj(iid, () => { W(`<< /Type /XObject /Subtype /Image /Width ${p.w} /Height ${p.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpg.length} >>\nstream\n`); W(p.jpg); W('\nendstream'); });
    });
    const xref = off, total = 3 + n * 3; let tbl = `xref\n0 ${total}\n0000000000 65535 f \n`; for (let i = 1; i < total; i++) tbl += String(offs[i]).padStart(10, '0') + ' 00000 n \n';
    W(tbl + `trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
    const blob = new Blob(chunks, { type: 'application/pdf' }); downloadBlob(blob, baseName(P.deck.title) + '.pdf'); P.toast('PDF exported.'); return blob;
  };
  P.exportImages = async (fmt = 'png', all = true) => {
    const slides = all ? P.deck.slides : [P.deck.slides[S.cur]]; const mime = fmt === 'png' ? 'image/png' : 'image/jpeg', ext = fmt === 'png' ? 'png' : 'jpg';
    if (!all) { const c = await P.rasterize(slides[0], 2, { index: S.cur }); const b = await new Promise(r => c.toBlob(r, mime, .92)); downloadBlob(b, `${baseName(P.deck.title)} - Slide ${S.cur + 1}.${ext}`); return; }
    const z = new JSZip(); const bar = progress('Exporting pictures…', slides.length);
    for (let i = 0; i < slides.length; i++) { const c = await P.rasterize(slides[i], 2, { index: i }); z.file(`Slide${i + 1}.${ext}`, await new Promise(r => c.toBlob(r, mime, .92))); bar.step(i + 1); }
    bar.close(); downloadBlob(await z.generateAsync({ type: 'blob' }), baseName(P.deck.title) + ` (${ext.toUpperCase()}s).zip`);
  };
  P.exportOutline = () => { const txt = P.deck.slides.map((s, i) => { let o = `${i + 1}. ${P.slideTitle(s)}\n`; s.elements.forEach(e => { if (e.paras && !(e.ph && /title/i.test(e.ph.type) && e.ph.type !== 'subTitle')) e.paras.forEach(p => { const t = (p.runs || []).map(r => r.t).join(''); if (t.trim()) o += '  '.repeat((p.level || 0) + 1) + '- ' + t + '\n'; }); }); if (s.notes) o += '  Notes: ' + s.notes + '\n'; return o; }).join('\n'); downloadBlob(new Blob([txt], { type: 'text/plain' }), baseName(P.deck.title) + ' outline.txt'); };
  /* Video export: records the live slide show of rasterised frames */
  P.exportVideo = async (secs = 4) => {
    const D = P.deck.size; const c = document.createElement('canvas'); c.width = 1280; c.height = Math.round(1280 * D.h / D.w); const x = c.getContext('2d');
    const stream = c.captureStream(30); const mime = MediaRecorder.isTypeSupported('video/mp4') ? 'video/mp4' : 'video/webm'; const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 6e6 }); const chunks = []; rec.ondataavailable = e => chunks.push(e.data);
    const slides = P.deck.slides.filter(s => !s.hidden); const bar = progress('Recording video…', slides.length);
    const frames = []; for (const s of slides) frames.push(await P.rasterize(s, 1280 / D.w, { index: P.deck.slides.indexOf(s) }));
    rec.start(); let prev = null;
    for (let i = 0; i < frames.length; i++) { const f = frames[i]; const dur = (slides[i].transition && slides[i].transition.advAfter) || secs * 1000; const t0 = performance.now(), fade = prev ? 500 : 0; await new Promise(res => { const tick = () => { const t = performance.now() - t0; if (prev && t < fade) { x.globalAlpha = 1; x.drawImage(prev, 0, 0); x.globalAlpha = t / fade; x.drawImage(f, 0, 0); x.globalAlpha = 1; } else { x.drawImage(f, 0, 0); } if (t < dur) requestAnimationFrame(tick); else res(); }; tick(); }); prev = f; bar.step(i + 1); }
    await new Promise(r => { rec.onstop = r; rec.stop(); }); bar.close(); downloadBlob(new Blob(chunks, { type: mime }), baseName(P.deck.title) + (mime === 'video/mp4' ? '.mp4' : '.webm')); P.toast('Video exported.');
  };
  const progress = (title, total) => { const fill = h('div', { class: 'prog-f' }); const lbl = h('div', { class: 'prog-l', text: title }); const box = h('div', { class: 'modal-back top' }, h('div', { class: 'modal prog' }, lbl, h('div', { class: 'prog-b' }, fill))); document.body.append(box); return { step(i) { fill.style.width = (i / total * 100) + '%'; lbl.textContent = `${title} ${i}/${total}`; }, close() { box.remove(); } }; };

  /* ---------- print ---------- */
  const buildPrint = o => {
    const root = document.getElementById('printRoot'); root.innerHTML = ''; const D = P.deck.size; const slides = o.slides;
    const land = o.orient === 'landscape';
    const style = document.getElementById('printStyle') || document.head.appendChild(h('style', { id: 'printStyle' }));
    if (o.layout === 'full') { style.textContent = `@page{size:${D.w}pt ${D.h}pt;margin:0}`; }
    else style.textContent = `@page{size:${land ? '11in 8.5in' : '8.5in 11in'};margin:.4in}`;
    const pageW = o.layout === 'full' ? D.w : (land ? 11 : 8.5) * 72 - 58, pageH = o.layout === 'full' ? D.h : (land ? 8.5 : 11) * 72 - 58;
    const slideNode = (s, w) => { const i = P.deck.slides.indexOf(s); const n = P.thumb(s, w, { index: i }); n.classList.add('print-slide'); if (o.frame) n.style.outline = '.5pt solid #333'; if (o.gray) n.style.filter = 'grayscale(1)'; return n; };
    const newPage = () => { const p = h('div', { class: 'print-page' }); p.style.width = pageW + 'pt'; p.style.height = pageH + 'pt'; root.append(p); return p; };
    if (o.layout === 'full') slides.forEach(s => { const p = newPage(); p.style.width = D.w + 'px'; p.style.height = D.h + 'px'; p.append(slideNode(s, D.w)); });
    else if (o.layout === 'notes') slides.forEach((s, i) => { const p = newPage(); p.classList.add('notes'); const w = pageW * .92; p.append(slideNode(s, w)); p.append(h('div', { class: 'print-notes', text: s.notes || '' }), h('div', { class: 'print-num', text: String(i + 1) })); });
    else if (o.layout === 'outline') { const p = newPage(); p.classList.add('outline'); slides.forEach((s, i) => { p.append(h('div', { class: 'po-t', text: `${P.deck.slides.indexOf(s) + 1}  ${P.slideTitle(s)}` })); s.elements.forEach(e => { if (e.paras && !(e.ph && /title/i.test(e.ph.type) && e.ph.type !== 'subTitle')) e.paras.forEach(q => { const t = (q.runs || []).map(r => r.t).join(''); if (t.trim()) { const d = h('div', { class: 'po-b', text: '• ' + t }); d.style.marginLeft = ((q.level || 0) + 1) * 18 + 'pt'; p.append(d); } }); }); void i; }); }
    else { /* handouts */
      const n = +o.layout, cols = n <= 3 ? 1 : (land ? (n === 4 ? 2 : 3) : (n === 9 ? 3 : 2)), rows = Math.ceil(n / cols); const gap = 12; const lines = n === 3;
      const cellW = (pageW - gap * (cols - 1)) / cols * (lines ? .5 : 1), cellH = (pageH - gap * (rows - 1)) / rows, w = Math.min(cellW, cellH * D.w / D.h);
      for (let i = 0; i < slides.length; i += n) { const p = newPage(); p.classList.add('handout'); p.style.gridTemplateColumns = `repeat(${cols},1fr)`; p.style.gridTemplateRows = `repeat(${rows},1fr)`; p.style.gap = gap + 'pt'; slides.slice(i, i + n).forEach(s => { const c = h('div', { class: 'ho-c' + (lines ? ' lines' : '') }); c.append(slideNode(s, w)); if (lines) { const l = h('div', { class: 'ho-l' }); for (let k = 0; k < 8; k++) l.append(h('i')); c.append(l); } p.append(c); }); }
    }
    return root;
  };
  const parseRange = (txt, total) => { const out = new Set(); (txt || '').split(',').forEach(part => { const m = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(part); if (!m) return; const a = +m[1], b = +(m[2] || m[1]); for (let i = a; i <= b && i <= total; i++) if (i >= 1) out.add(i - 1); }); return [...out].sort((a, b) => a - b); };

  /* ---------- backstage ---------- */
  let bs = null;
  const closeBackstage = () => { if (bs) { bs.remove(); bs = null; document.removeEventListener('keydown', bsKey, true); } };
  const bsKey = e => { if (e.key === 'Escape' && !P.modalOpen()) { e.stopPropagation(); closeBackstage(); } };
  P.closeBackstage = closeBackstage;
  P.backstage = (tab = 'home') => {
    P.T.end(); closeBackstage();
    bs = h('div', { id: 'backstage' }); const nav = h('div', { class: 'bs-nav' }), main = h('div', { class: 'bs-main' });
    const back = h('button', { class: 'bs-back', title: 'Back', html: '<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="11" fill="none" stroke="#fff"/><path d="M13 7l-5 5 5 5M8 12h9" fill="none" stroke="#fff" stroke-width="1.6"/></svg>' }); back.onclick = closeBackstage; nav.append(back);
    const items = [['home', 'Home', 'home'], ['new', 'New', 'newdoc'], ['open', 'Open', 'folder'], '-', ['info', 'Info', 'info'], ['save', 'Save', 'save'], ['saveas', 'Save As', 'save'], ['print', 'Print', 'print'], ['export', 'Export', 'export'], ['close', 'Close', 'close'], '-', ['options', 'Options', 'options']];
    const btns = {};
    const go = t => {
      if (t === 'save') { P.save(); return; } if (t === 'close') { P.confirmDiscard(() => { P.loadDeck(blankDeck(), 'Presentation1'); closeBackstage(); }); return; }
      Object.values(btns).forEach(b => b.classList.remove('on')); if (btns[t]) btns[t].classList.add('on'); main.innerHTML = ''; (PAGES[t] || PAGES.home)(main);
    };
    items.forEach(it => { if (it === '-') { nav.append(h('div', { class: 'bs-sep' })); return; } const b = h('button', { class: 'bs-i', html: `<span class="bs-ic">${whiteIcon(it[2])}</span>${it[1]}` }); b.onclick = () => go(it[0]); nav.append(b); btns[it[0]] = b; });
    bs.append(nav, main); document.body.append(bs); document.addEventListener('keydown', bsKey, true); go(tab);
  };
  const whiteIcon = n => `<span class="bs-ic-i">${P.icon(n, 18)}</span>`;
  const blankDeck = (theme = 'Default') => { const d = P.newDeck(theme); const prev = P.deck; P.deck = d; d.slides.push(P.newSlide('title')); P.deck = prev || d; return d; };
  P.blankDeck = blankDeck;
  const templateCard = (title, thumbFn, fn) => { const c = h('button', { class: 'tpl' }); c.append(h('div', { class: 'tpl-th' }, thumbFn()), h('span', { text: title })); c.onclick = fn; return c; };
  const themeThumb = (name) => () => { const d = P.newDeck(name); const s = P.newSlide('title', d); s.elements[0].paras = [P.para(name === 'Default' ? 'Blank Presentation' : name)]; s.elements[1].paras = [P.para('Click to add subtitle')]; const pv = P.deck; P.deck = d; const t = P.thumb(s, 200, { deck: d, index: 0 }); P.deck = pv; return t; };
  const startFrom = name => P.confirmDiscard(() => { P.loadDeck(blankDeck(name), 'Presentation1'); closeBackstage(); });
  const SAMPLES = [
    ['Business Pitch', 'Boardroom', [['title', 'Company Name', 'A one-line description of what you do'], ['obj', 'The Problem', ['What pain do customers have today?', 'How are they solving it now?', 'Why is that not good enough?']], ['obj', 'Our Solution', ['Describe the product in one sentence', 'The three biggest benefits', 'Why now']], ['twoObj', 'Market & Traction', ['Market size', 'Target segment'], ['Customers so far', 'Monthly growth']], ['obj', 'The Ask', ['Amount we are raising', 'How we will spend it', 'Milestones it unlocks']], ['secHead', 'Thank You', 'name@company.com']]],
    ['Class Lesson', 'Citrus', [['title', 'Lesson Title', 'Subject • Grade • Teacher'], ['obj', 'Learning Goals', ['By the end of this lesson you will be able to…', 'Key vocabulary', 'How this connects to last week']], ['obj', 'Key Idea', ['Explain the main concept', 'Show a worked example', 'Check understanding']], ['twoObj', 'Compare', ['Idea A', 'Example A'], ['Idea B', 'Example B']], ['obj', 'Practice', ['Task one', 'Task two', 'Exit question']]]],
    ['Project Report', 'Slate', [['title', 'Project Status Report', 'Month Year'], ['obj', 'Summary', ['Overall status', 'Highlights this period', 'Decisions needed']], ['obj', 'Progress', ['Completed milestones', 'Work in progress', 'Coming next']], ['obj', 'Risks & Issues', ['Risk and mitigation', 'Issue and owner', 'Dependencies']], ['secHead', 'Questions', 'Discussion']]],
    ['Photo Story', 'Nightfall', [['title', 'A Year in Pictures', 'Your name'], ['picTx', 'First Chapter', 'Write a short caption for this photo'], ['picTx', 'Second Chapter', 'Write a short caption for this photo'], ['secHead', 'The End', 'Thanks for watching']]]
  ];
  const buildSample = ([, theme, list], deck0) => { const d = deck0 || P.newDeck(theme); list.forEach(sp => { const s = P.newSlide(sp[0], d); const ph = s.elements; const setT = (e, v) => { if (!e) return; if (Array.isArray(v)) e.paras = v.map(t => P.para(t)); else e.paras = [P.para(v)]; }; setT(ph[0], sp[1]); if (sp[0] === 'picTx') setT(ph[2], sp[2]); else setT(ph[1], sp[2]); if (sp[3]) setT(ph[2], sp[3]); d.slides.push(s); }); return d; };
  P.buildSample = i => buildSample(SAMPLES[i]);
  const PAGES = {
    home: m => {
      m.append(h('h1', { text: 'Good ' + (new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening') }), h('h2', { text: 'New' }));
      const g = h('div', { class: 'tpl-row' }); ['Default', 'Meridian', 'Ember', 'Nightfall', 'Terra'].forEach(n => g.append(templateCard(n === 'Default' ? 'Blank Presentation' : n, themeThumb(n), () => startFrom(n))));
      m.append(g); const more = h('button', { class: 'link', text: 'More themes →' }); more.onclick = () => P.backstage('new'); m.append(more);
      m.append(h('h2', { text: 'Recent' })); const r = h('div', { class: 'recent' }); m.append(r); drawRecent(r);
    },
    new: m => {
      m.append(h('h1', { text: 'New' }), h('h2', { text: 'Themes' })); const g = h('div', { class: 'tpl-row wrap' }); P.themes.forEach(t => g.append(templateCard(t.name === 'Default' ? 'Blank Presentation' : t.name, themeThumb(t.name), () => startFrom(t.name)))); m.append(g);
      m.append(h('h2', { text: 'Templates' })); const g2 = h('div', { class: 'tpl-row wrap' }); SAMPLES.forEach(s => g2.append(templateCard(s[0], () => { const d = buildSample(s); const pv = P.deck; P.deck = d; const t = P.thumb(d.slides[0], 200, { deck: d, index: 0 }); P.deck = pv; return t; }, () => P.confirmDiscard(() => { const d = buildSample(s); P.loadDeck(d, s[0]); closeBackstage(); })))); m.append(g2);
    },
    open: m => { m.append(h('h1', { text: 'Open' })); const b = h('button', { class: 'bs-big', html: P.icon('folder', 28) + '<span><b>Browse</b><small>Choose a .pptx from this PC</small></span>' }); b.onclick = () => P.openFile(); m.append(b, h('h2', { text: 'Recent' })); const r = h('div', { class: 'recent' }); m.append(r); drawRecent(r); },
    info: m => {
      const d = P.deck; const pr = d.props = d.props || {}; m.append(h('h1', { text: 'Info' }), h('div', { class: 'bs-sub', text: d.title }));
      const words = (() => { let w = 0; d.slides.forEach(s => P.walk(s.elements, e => { (e.paras || []).forEach(p => (p.runs || []).forEach(r => { w += r.t.trim() ? r.t.trim().split(/\s+/).length : 0; })); })); return w; })();
      const sizeEst = Object.values(d.media).reduce((a, x) => a + (x.blob ? x.blob.size : 0), 0);
      const inp = (k, lbl) => { const i = h('input', { class: 'field wide', value: pr[k] || '' }); i.onchange = () => { pr[k] = i.value; P.commit('Properties', { silent: true }); }; i.onkeydown = e => e.stopPropagation(); return P.field(lbl, i); };
      const grid = h('div', { class: 'info-grid' }, h('div', {}, h('h2', { text: 'Properties' }), inp('title', 'Title'), inp('subject', 'Subject'), inp('author', 'Author'), inp('keywords', 'Tags'), inp('comments', 'Comments')), h('div', { class: 'stats' }, h('h2', { text: 'Statistics' }), h('div', { text: `Slides: ${d.slides.length}` }), h('div', { text: `Hidden slides: ${d.slides.filter(s => s.hidden).length}` }), h('div', { text: `Words: ${words}` }), h('div', { text: `Media: ${(sizeEst / 1048576).toFixed(1)} MB` }), h('div', { text: `Size: ${(d.size.w / 72).toFixed(2)}" × ${(d.size.h / 72).toFixed(2)}"` })));
      m.append(grid);
      const acc = h('button', { class: 'bs-big', html: P.icon('access', 28) + '<span><b>Check Accessibility</b><small>Find content people with disabilities might struggle with</small></span>' }); acc.onclick = () => { closeBackstage(); P.accessibilityCheck(); }; m.append(acc);
    },
    saveas: m => { m.append(h('h1', { text: 'Save As' })); const n = h('input', { class: 'field wide', value: P.deck.title }); n.onkeydown = e => e.stopPropagation(); n.onchange = () => { P.deck.title = n.value; updateTitle(); }; const b = h('button', { class: 'btn primary', text: 'Save as PowerPoint Presentation (.pptx)' }); b.onclick = () => { P.deck.title = n.value; P.saveAs(); }; m.append(P.field('File name', n), b, h('p', { class: 'hint', text: 'Podium saves standard .pptx files that open in Microsoft PowerPoint, Google Slides, Keynote and LibreOffice.' })); },
    print: m => {
      m.append(h('h1', { text: 'Print' })); const opts = { layout: 'full', range: 'all', custom: '', orient: 'landscape', frame: false, gray: false, hidden: true };
      const prev = h('div', { class: 'print-prev' });
      const slidesFor = () => { const all = P.deck.slides; let list = opts.range === 'current' ? [all[S.cur]] : opts.range === 'custom' ? parseRange(opts.custom, all.length).map(i => all[i]) : all.slice(); if (!opts.hidden) list = list.filter(s => !s.hidden); return list; };
      const drawPrev = () => { prev.innerHTML = ''; const list = slidesFor(); if (!list.length) { prev.textContent = 'No slides to print.'; return; } const root = buildPrint(Object.assign({}, opts, { slides: list })); const first = root.querySelector('.print-page'); if (first) { const c = first.cloneNode(true); const wrap = h('div', { class: 'pp-wrap' }); wrap.append(c); prev.append(wrap); const r = 600 / c.style.width.replace(/[a-z]+/, ''); void r; const pxW = first.getBoundingClientRect().width || 720, s = Math.min(1, 620 / pxW); c.style.transform = `scale(${s})`; c.style.transformOrigin = '0 0'; wrap.style.width = pxW * s + 'px'; wrap.style.height = first.getBoundingClientRect().height * s + 'px'; } prev.append(h('div', { class: 'hint', text: `${root.querySelectorAll('.print-page').length} page(s)` })); };
      const up = (k, v) => { opts[k] = v; drawPrev(); };
      const printBtn = h('button', { class: 'bs-print', html: P.icon('print', 30) + 'Print' }); printBtn.onclick = () => { buildPrint(Object.assign({}, opts, { slides: slidesFor() })); document.body.classList.add('printing'); const off = () => { document.body.classList.remove('printing'); removeEventListener('afterprint', off); }; addEventListener('afterprint', off); window.print(); };
      const custom = h('input', { class: 'field', placeholder: 'e.g. 1-3,5', disabled: true }); custom.oninput = () => up('custom', custom.value); custom.onkeydown = e => e.stopPropagation();
      const side = h('div', { class: 'print-side' }, printBtn, h('p', { class: 'hint', text: 'Choose "Save as PDF" as the printer for a vector PDF with selectable text.' }),
        P.field('Slides', P.select([['all', 'Print All Slides'], ['current', 'Print Current Slide'], ['custom', 'Custom Range']], 'all', v => { custom.disabled = v !== 'custom'; up('range', v); })), P.field('Slide numbers', custom),
        P.field('Layout', P.select([['full', 'Full Page Slides'], ['notes', 'Notes Pages'], ['outline', 'Outline'], ['1', 'Handout: 1 Slide'], ['2', 'Handout: 2 Slides'], ['3', 'Handout: 3 Slides (with lines)'], ['4', 'Handout: 4 Slides'], ['6', 'Handout: 6 Slides'], ['9', 'Handout: 9 Slides']], 'full', v => up('layout', v))),
        P.field('Orientation', P.select([['landscape', 'Landscape'], ['portrait', 'Portrait']], 'landscape', v => up('orient', v))), P.checkbox('Frame slides', false, v => up('frame', v)), P.checkbox('Grayscale', false, v => up('gray', v)), P.checkbox('Print hidden slides', true, v => up('hidden', v)));
      m.append(h('div', { class: 'print-layout' }, side, prev)); drawPrev();
    },
    export: m => {
      m.append(h('h1', { text: 'Export' })); const big = (ic, t, s, fn) => { const b = h('button', { class: 'bs-big', html: P.icon(ic, 28) + `<span><b>${t}</b><small>${s}</small></span>` }); b.onclick = fn; return b; };
      m.append(big('export', 'Create PDF', 'One page per slide, ready to share', () => P.exportPdf()), big('picture', 'PNG Pictures (all slides)', 'A .zip with one high-resolution picture per slide', () => P.exportImages('png', true)), big('picture', 'JPEG Pictures (all slides)', 'Smaller files, good for the web', () => P.exportImages('jpg', true)), big('picture', 'Current slide as PNG', 'A single picture of this slide', () => P.exportImages('png', false)), big('video', 'Create a Video', 'Records slides with crossfades and your timings', () => P.exportVideo()), big('outline', 'Outline as Text', 'Titles, bullets and notes in a .txt file', () => P.exportOutline()), big('save', 'PowerPoint Presentation', 'Standard .pptx file', () => P.saveAs()));
    },
    options: m => {
      let name = ''; try { name = localStorage.getItem('podium.author') || ''; } catch (_) {}
      const n = h('input', { class: 'field wide', value: name }); n.onkeydown = e => e.stopPropagation(); n.onchange = () => { try { localStorage.setItem('podium.author', n.value); } catch (_) {} };
      m.append(h('h1', { text: 'Options' }), P.field('Your name (used for comments)', n), h('h2', { text: 'Keyboard shortcuts' }), h('div', { class: 'keys', html: [['F5 / Shift+F5', 'Start show from beginning / current slide'], ['Ctrl+M', 'New slide'], ['Ctrl+D', 'Duplicate'], ['Ctrl+G / Ctrl+Shift+G', 'Group / Ungroup'], ['Ctrl+Z / Ctrl+Y', 'Undo / Redo'], ['Ctrl+B, I, U', 'Bold, Italic, Underline'], ['Ctrl+L, E, R, J', 'Align left, center, right, justify'], ['Ctrl+] / Ctrl+[', 'Font size up / down'], ['Ctrl+K', 'Insert link'], ['Ctrl+F / Ctrl+H', 'Find / Replace'], ['Ctrl+Shift+C', 'Format Painter'], ['Ctrl+wheel', 'Zoom'], ['In show: B / W', 'Black / white screen'], ['In show: Ctrl+P, Ctrl+I, Ctrl+L', 'Pen, highlighter, laser'], ['In show: G', 'See all slides'], ['In show: number + Enter', 'Jump to slide']].map(([a, b]) => `<div><kbd>${a}</kbd><span>${b}</span></div>`).join('') }), h('p', { class: 'hint', text: 'Podium is free and works offline. Your files stay on this computer.' }));
    }
  };
  const drawRecent = async box => {
    const list = (await kvGet('recent')) || []; box.innerHTML = '';
    const rec = await kvGet('autosave');
    if (rec) { const b = h('button', { class: 'recent-i warn', html: `${P.icon('save', 20)}<span><b>Recovered: ${P.esc(rec.name)}</b><small>Autosaved ${new Date(rec.at).toLocaleString()}</small></span>` }); b.onclick = () => P.confirmDiscard(() => { const f = new File([rec.blob], rec.name + '.pptx'); P.openBlob(f); }); box.append(b); }
    if (!list.length && !rec) { box.append(h('div', { class: 'hint', text: 'Files you open or save will appear here.' })); return; }
    list.forEach(it => { const b = h('button', { class: 'recent-i', html: `${P.icon('present', 20)}<span><b>${P.esc(it.name)}</b><small>${new Date(it.at).toLocaleString()}</small></span>` }); b.onclick = () => openRecent(it); box.append(b); });
  };

  /* ---------- boot ---------- */
  const buildTitlebar = () => {
    const tb = document.getElementById('titlebar');
    const q = h('div', { class: 'qat' });
    const mk = (ic, tip, fn, dis) => { const b = h('button', { class: 'qat-b', title: tip, html: P.icon(ic, 16) }); b.onclick = fn; if (dis) P.on('history', () => { b.disabled = dis(); }); return b; };
    const whitePath = (d, c = '#fff') => `<svg viewBox="0 0 24 24" width="16" height="16"><path d="${d}" fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    const save = h('button', { class: 'qat-b', title: 'Save (Ctrl+S)', html: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M4 3h13l3 3v15H4z" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M8 3v5h8V3M7 21v-8h10v8" fill="none" stroke="#fff" stroke-width="1.6"/></svg>' }); save.onclick = () => P.save();
    const undo = h('button', { class: 'qat-b', title: 'Undo (Ctrl+Z)', html: whitePath('M9 7L4 12l5 5M4 12h10a6 6 0 0 1 6 6') }); undo.onclick = () => P.undo();
    const redo = h('button', { class: 'qat-b', title: 'Redo (Ctrl+Y)', html: whitePath('M15 7l5 5-5 5M20 12H10a6 6 0 0 0-6 6') }); redo.onclick = () => P.redo();
    const start = h('button', { class: 'qat-b', title: 'Start From Beginning (F5)', html: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 5h18v11H3zM12 16v4M8 20h8" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M10 8l5 2.5L10 13z" fill="#fff"/></svg>' }); start.onclick = () => P.startShow(0);
    P.on('history', () => { undo.disabled = !P.canUndo(); redo.disabled = !P.canRedo(); undo.title = 'Undo ' + P.undoLabel() + ' (Ctrl+Z)'; redo.title = 'Redo ' + P.redoLabel() + ' (Ctrl+Y)'; });
    void mk; q.append(save, undo, redo, start);
    const search = h('div', { class: 'tb-search' }, h('span', { html: '<svg viewBox="0 0 24 24" width="14" height="14"><circle cx="10" cy="10" r="6" fill="none" stroke="#fff" stroke-width="2"/><path d="M15 15l6 6" stroke="#fff" stroke-width="2"/></svg>' })); const si = h('input', { placeholder: 'Search commands (Alt+Q)' }); search.append(si); wireSearch(si);
    const logo = h('span', { class: 'tb-logo', html: P.logo(22) });
    const title = h('span', { id: 'docTitle', text: 'Presentation1', title: 'Rename' }); title.onclick = () => P.prompt('Rename', 'Presentation name:', P.deck.title, v => { P.deck.title = v; updateTitle(); });
    const name = h('span', { class: 'tb-app', text: 'Podium' });
    tb.append(logo, q, h('div', { class: 'tb-center' }, title, h('span', { class: 'tb-dash', text: ' - ' }), name), search);
    document.addEventListener('keydown', e => { if (e.altKey && e.key.toLowerCase() === 'q') { e.preventDefault(); si.focus(); } });
  };
  /* "Tell me" command search */
  const wireSearch = si => {
    const cmds = () => [['New Slide', () => P.addSlide()], ['Duplicate Slide', () => P.duplicateSlides()], ['Delete Slide', () => P.deleteSlides()], ['Hide Slide', () => P.hideSlides()], ['Insert Picture', () => P.pickPicture()], ['Insert Table', () => P.placeTable()], ['Insert Chart', () => P.chartDialog()], ['Insert SmartArt', () => P.smartArtDialog()], ['Insert Icons', () => P.iconsDialog()], ['Insert Video', () => P.pickMedia('video')], ['Insert Audio', () => P.pickMedia('audio')], ['Insert Text Box', () => P.beginInsert('textbox')], ['Insert Symbol', () => P.symbolDialog()], ['Insert Equation', () => P.equationDialog()], ['Insert Link', () => P.linkDialog()], ['Header and Footer', () => P.headerFooterDialog()], ['Slide Master', () => P.setView('master')], ['Slide Sorter', () => P.setView('sorter')], ['Notes Page', () => P.setView('notes')], ['Normal View', () => P.setView('normal')], ['Outline View', () => P.setView('outline')], ['Start Slide Show', () => P.startShow(0)], ['From Current Slide', () => P.startShow(S.cur)], ['Rehearse Timings', () => P.startShow(0, { rehearse: true })], ['Format Background', () => P.openPane('background')], ['Format Shape', () => P.openPane('format')], ['Selection Pane', () => P.openPane('selection')], ['Animation Pane', () => P.openPane('anim')], ['Comments', () => { S.showComments = true; P.openPane('comments'); P.drawOverlay(); }], ['Find', () => P.findDialog(false)], ['Replace', () => P.findDialog(true)], ['Word Count', () => P.wordCount()], ['Check Accessibility', () => P.accessibilityCheck()], ['Export PDF', () => P.exportPdf()], ['Print', () => P.backstage('print')], ['Save As', () => P.saveAs()], ['Open', () => P.openFile()], ['Group', () => P.groupSelected()], ['Ungroup', () => P.ungroupSelected()], ['Bring to Front', () => P.zorder('front')], ['Send to Back', () => P.zorder('back')], ['Gridlines', () => P.toggleView('grid')], ['Ruler', () => P.toggleView('ruler')], ['Guides', () => P.toggleView('guides')], ['Crop Picture', () => P.startCrop()], ['Remove Background', () => P.removeBackground()]];
    const results = () => { const q = si.value.trim().toLowerCase(); const m = h('div', { class: 'menu' }); const list = cmds().filter(c => c[0].toLowerCase().includes(q)).slice(0, 10); list.forEach(([n, fn]) => { const b = h('button', { class: 'menu-item', text: n }); b.onclick = () => { P.closePopup(); si.value = ''; fn(); }; m.append(b); }); return { m, list }; };
    const open = () => { const { m, list } = results(); if (!si.value.trim() || !list.length) { P.closePopup(); return; } P.popup(si, m); };
    si.addEventListener('input', open); si.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const { list } = results(); if (list[0]) { P.closePopup(); si.value = ''; list[0][1](); } } if (e.key === 'Escape') { si.value = ''; P.closePopup(); si.blur(); } });
  };
  P.boot = async () => {
    const st = document.createElement('style'); st.textContent = P.slideCSS; document.head.append(st);
    buildTitlebar();
    P.deck = blankDeck();
    P.initEditor(); P.initPanes(); P.initRibbon();
    P.loadDeck(P.deck, 'Presentation1');
    P.layoutCanvas();
    addEventListener('beforeunload', e => { if (P.dirty) { e.preventDefault(); e.returnValue = ''; } });
    addEventListener('dragover', e => e.preventDefault());
    addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; if (f && /\.pptx$/i.test(f.name)) P.confirmDiscard(() => P.openBlob(f)); });
    /* files opened through "Open with" when installed as an app */
    if (window.launchQueue) window.launchQueue.setConsumer(async p => { if (p.files && p.files[0]) { const f = await p.files[0].getFile(); P.openBlob(f, p.files[0]); } });
    const rec = await kvGet('autosave');
    if (rec && rec.blob && !/[?&]noautosave/.test(location.search)) { P.confirm(`Podium found an unsaved copy of "${rec.name}" from ${new Date(rec.at).toLocaleString()}. Restore it?`, () => { const f = new File([rec.blob], rec.name + '.pptx'); P.openBlob(f); }, { ok: 'Restore', cancel: 'Discard', onNo: () => kvDel('autosave') }); }
    else if (!/[?&]nostart/.test(location.search)) P.backstage('home');
  };
  P.kvDel = kvDel;
})(window.P);
