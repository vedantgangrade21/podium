/* Podium - reads .pptx files into the document model */
(function (P) {
  'use strict';
  const PT = v => (+v || 0) / 12700;
  const parser = new DOMParser();
  const parseXml = s => parser.parseFromString(s.replace(/^﻿/, ''), 'application/xml');
  const kids = (n, name) => { if (!n) return []; const o = []; for (let c = n.firstElementChild; c; c = c.nextElementSibling) if (!name || c.localName === name) o.push(c); return o; };
  const kid = (n, name) => { if (!n) return null; for (let c = n.firstElementChild; c; c = c.nextElementSibling) if (c.localName === name) return c; return null; };
  const path = (n, ...names) => { let c = n; for (const x of names) { c = kid(c, x); if (!c) return null; } return c; };
  const desc = (n, name) => (n ? [...n.getElementsByTagNameNS('*', name)] : []);
  const attr = (n, a) => (n ? n.getAttribute(a) : null);
  const relAttr = (n, name) => { if (!n) return null; for (const a of n.attributes) if (a.localName === name && (a.prefix === 'r' || (a.namespaceURI || '').includes('relationships'))) return a.value; return null; };
  /* mc:AlternateContent -> take the fallback unless told otherwise */
  const flat = (n, preferChoice) => { const out = []; kids(n).forEach(c => { if (c.localName === 'AlternateContent') { const ch = kid(c, 'Choice'), fb = kid(c, 'Fallback'); const use = (preferChoice && ch) ? ch : (fb || ch); if (use) out.push(...flat(use, preferChoice)); } else out.push(c); }); return out; };
  const normPath = (base, target) => { if (target.startsWith('/')) return target.slice(1); const parts = base.split('/'); parts.pop(); target.split('/').forEach(p => { if (p === '..') parts.pop(); else if (p !== '.') parts.push(p); }); return parts.join('/'); };

  P.readPptx = async blob => {
    const zip = await JSZip.loadAsync(blob);
    const cache = {};
    const xmlOf = async p => { if (p in cache) return cache[p]; const f = zip.file(p); if (!f) return (cache[p] = null); return (cache[p] = parseXml(await f.async('string'))); };
    const relsOf = async p => {
      const dir = p.split('/'); const fn = dir.pop(); const rp = dir.join('/') + '/_rels/' + fn + '.rels';
      const doc = await xmlOf(rp); const m = {}; if (!doc) return m;
      kids(doc.documentElement, 'Relationship').forEach(r => { const external = attr(r, 'TargetMode') === 'External'; m[attr(r, 'Id')] = { type: attr(r, 'Type'), target: external ? attr(r, 'Target') : normPath(p, attr(r, 'Target')), external }; });
      return m;
    };
    const presDoc = await xmlOf('ppt/presentation.xml'); if (!presDoc) throw new Error('This file is not a valid presentation (ppt/presentation.xml is missing).');
    const pres = presDoc.documentElement, presRels = await relsOf('ppt/presentation.xml');
    const sz = kid(pres, 'sldSz');
    const deck = { title: 'Presentation', size: { w: PT(attr(sz, 'cx') || 12192000), h: PT(attr(sz, 'cy') || 6858000) }, slides: [], sections: [], customShows: [], media: {}, props: {}, showCfg: { type: 'presenter', loop: false, useTimings: true, presenterView: true, penColor: '#FF0000' } };
    const firstNum = attr(pres, 'firstSlideNum'); if (firstNum) deck.firstNum = +firstNum;

    /* -------- media -------- */
    const mediaMap = {};
    const mimeOf = p => { const e = (p.split('.').pop() || '').toLowerCase(); return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp', tif: 'image/tiff', tiff: 'image/tiff', emf: 'image/x-emf', wmf: 'image/x-wmf', mp4: 'video/mp4', m4v: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', wmv: 'video/x-ms-wmv', avi: 'video/x-msvideo', mp3: 'audio/mpeg', m4a: 'audio/mp4', wav: 'audio/wav', wma: 'audio/x-ms-wma', ogg: 'audio/ogg' })[e] || 'application/octet-stream'; };
    const mediaSrc = async p => {
      if (!p) return null; if (mediaMap[p]) return mediaMap[p]; const f = zip.file(p); if (!f) return null;
      const u8 = await f.async('uint8array'); const b = new Blob([u8], { type: mimeOf(p) });
      const id = P.uid('m'); deck.media[id] = { id, blob: b, name: p.split('/').pop(), mime: b.type, url: URL.createObjectURL(b) };
      return (mediaMap[p] = 'media:' + id);
    };

    /* a:duotone recolours a picture from dark colour to light colour: bake it, since browsers have no equivalent */
    const duoCache = {};
    const applyDuotone = async (blip, src, ph, readCol) => {
      const duo = kid(blip, 'duotone'); if (!duo || !src) return src;
      const cols = kids(duo).map(c => readCol({ firstElementChild: c }, ph)).filter(Boolean).map(v => P.hex2rgb(P.color(v.c, deck.theme))); if (cols.length < 2) return src;
      const key = src + JSON.stringify(cols); if (duoCache[key]) return duoCache[key];
      const m = deck.media[src.slice(6)]; const im = await P.loadImage(m.url);
      const c = document.createElement('canvas'); const k = Math.min(1, 1600 / Math.max(im.naturalWidth, im.naturalHeight)); c.width = Math.max(1, im.naturalWidth * k); c.height = Math.max(1, im.naturalHeight * k);
      const x = c.getContext('2d'); x.drawImage(im, 0, 0, c.width, c.height); const d = x.getImageData(0, 0, c.width, c.height), q = d.data;
      for (let i = 0; i < q.length; i += 4) { const L = (.299 * q[i] + .587 * q[i + 1] + .114 * q[i + 2]) / 255; for (let j = 0; j < 3; j++) q[i + j] = cols[0][j] + (cols[1][j] - cols[0][j]) * L; }
      x.putImageData(d, 0, 0); const jpg = /jpe?g/.test(m.mime); const blob = await new Promise(r => c.toBlob(r, jpg ? 'image/jpeg' : 'image/png', .9));
      return (duoCache[key] = 'media:' + P.addMedia(blob, jpg ? 'duotone.jpg' : 'duotone.png', deck));
    };

    /* -------- theme -------- */
    const masterRef = kid(kid(pres, 'sldMasterIdLst'), 'sldMasterId');
    const masterPath = presRels[relAttr(masterRef, 'id')].target;
    const masterDoc = await xmlOf(masterPath), masterRels = await relsOf(masterPath);
    const themeRel = Object.values(masterRels).find(r => r.type.endsWith('/theme'));
    const themeDoc = await xmlOf(themeRel.target); const te = kid(themeDoc.documentElement, 'themeElements');
    const cs = kid(te, 'clrScheme'); const colors = {};
    const baseColor = c => { const x = c && c.firstElementChild; if (!x) return '#000000'; if (x.localName === 'srgbClr') return '#' + attr(x, 'val').toUpperCase(); if (x.localName === 'sysClr') return '#' + (attr(x, 'lastClr') || '000000').toUpperCase(); return '#000000'; };
    ['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].forEach(k => { colors[k] = baseColor(kid(cs, k)); });
    const fs = kid(te, 'fontScheme');
    const fontOf = n => attr(kid(n, 'latin'), 'typeface') || 'Calibri';
    deck.theme = { name: attr(themeDoc.documentElement, 'name') || 'Theme', colors, fonts: { major: fontOf(kid(fs, 'majorFont')), minor: fontOf(kid(fs, 'minorFont')) } };
    const cm = kid(masterDoc.documentElement, 'clrMap');
    if (cm && (attr(cm, 'bg1') !== 'lt1' || attr(cm, 'tx1') !== 'dk1' || attr(cm, 'bg2') !== 'lt2' || attr(cm, 'tx2') !== 'dk2')) deck.theme.map = { bg1: attr(cm, 'bg1'), tx1: attr(cm, 'tx1'), bg2: attr(cm, 'bg2'), tx2: attr(cm, 'tx2') };
    /* fmtScheme line widths used by shape style references */
    const fmt = kid(te, 'fmtScheme'); const lnWidths = kids(kid(fmt, 'lnStyleLst'), 'ln').map(l => PT(attr(l, 'w') || 12700));
    const fillStyles = kids(kid(fmt, 'fillStyleLst')), bgStyles = kids(kid(fmt, 'bgFillStyleLst')), effectStyles = kids(kid(fmt, 'effectStyleLst'));
    const themeRels = await relsOf(themeRel.target);
    /* readFill walks a parent's children and stops at the first fill, so a stand-in parent selects one list entry */
    const styleFill = (node, ph) => (node ? readFill({ firstElementChild: node }, themeRels, ph) : undefined);

    /* -------- colours -------- */
    const PRST = { black: '#000000', white: '#FFFFFF', red: '#FF0000', green: '#008000', blue: '#0000FF', yellow: '#FFFF00', gray: '#808080', grey: '#808080', orange: '#FFA500', purple: '#800080' };
    const readColor = (n, ph) => {
      /* n = element containing a colour child; returns {c, a} */
      if (!n) return null; const x = kids(n).find(k => /Clr$/.test(k.localName)); if (!x) return null;
      let c, a = null; const mods = kids(x);
      const al = mods.find(m => m.localName === 'alpha'); if (al) a = +attr(al, 'val') / 100000;
      const lm = mods.find(m => m.localName === 'lumMod'), lo = mods.find(m => m.localName === 'lumOff');
      const others = mods.filter(m => !['alpha', 'lumMod', 'lumOff'].includes(m.localName));
      if (x.localName === 'schemeClr') {
        let v = attr(x, 'val'); if (v === 'phClr') { if (ph) v = ph; else v = 'accent1'; }
        v = v.replace(/^dk1$/, 'dk1');
        if (v.includes(':') && !mods.some(m => m.localName !== 'alpha')) c = v;
        else if (v.includes(':')) c = applyMods(P.color(v, deck.theme), mods);
        else if (!others.length) { c = v + (lm || lo ? `:${(+attr(lm, 'val') || 100000) / 1000},${(+attr(lo, 'val') || 0) / 1000}` : ''); }
        else { let hex = P.color(v, deck.theme); c = applyMods(hex, mods); }
      } else if (x.localName === 'srgbClr') c = applyMods('#' + attr(x, 'val').toUpperCase(), mods);
      else if (x.localName === 'sysClr') c = applyMods('#' + (attr(x, 'lastClr') || '000000').toUpperCase(), mods);
      else if (x.localName === 'prstClr') c = applyMods(PRST[attr(x, 'val')] || '#000000', mods);
      else if (x.localName === 'hslClr') { const r = P.hsl2rgb(+attr(x, 'hue') / 21600000, +attr(x, 'sat') / 100000, +attr(x, 'lum') / 100000); c = applyMods(P.rgb2hex(...r), mods); }
      else if (x.localName === 'scrgbClr') c = P.rgb2hex(+attr(x, 'r') / 1000 * 2.55, +attr(x, 'g') / 1000 * 2.55, +attr(x, 'b') / 1000 * 2.55);
      else c = '#000000';
      return { c, a };
    };
    const applyMods = (hex, mods) => {
      let [r, g, b] = P.hex2rgb(hex);
      mods.forEach(m => { const v = +attr(m, 'val') / 100000; const hs = () => P.rgb2hsl(r, g, b);
        switch (m.localName) {
          case 'tint': r += (255 - r) * (1 - v); g += (255 - g) * (1 - v); b += (255 - b) * (1 - v); break;
          case 'shade': r *= v; g *= v; b *= v; break;
          case 'lumMod': { const [H, S, L] = hs(); [r, g, b] = P.hsl2rgb(H, S, Math.min(1, L * v)); break; }
          case 'lumOff': { const [H, S, L] = hs(); [r, g, b] = P.hsl2rgb(H, S, Math.min(1, L + v)); break; }
          case 'satMod': { const [H, S, L] = hs(); [r, g, b] = P.hsl2rgb(H, Math.min(1, S * v), L); break; }
          case 'inv': r = 255 - r; g = 255 - g; b = 255 - b; break;
        } });
      return P.rgb2hex(r, g, b);
    };

    /* -------- fills, lines, effects -------- */
    const readFill = async (n, rels, ph) => {
      if (!n) return undefined;
      for (const c of kids(n)) {
        switch (c.localName) {
          case 'noFill': return { type: 'none' };
          case 'solidFill': { const v = readColor(c, ph); if (!v) return { type: 'none' }; return { type: 'solid', color: v.c, opacity: v.a == null ? undefined : v.a }; }
          case 'gradFill': {
            const stops = kids(kid(c, 'gsLst'), 'gs').map(g => { const v = readColor(g, ph) || { c: '#000000' }; return { pos: +attr(g, 'pos') / 1000, color: v.c, opacity: v.a == null ? undefined : v.a }; }).sort((a, b) => a.pos - b.pos);
            const lin = kid(c, 'lin'), pth = kid(c, 'path');
            if (pth) { const f = kid(pth, 'fillToRect'); return { type: 'gradient', kind: attr(pth, 'path') === 'circle' ? 'radial' : 'path', stops, cx: f ? ((+attr(f, 'l') || 0) + (100000 - (+attr(f, 'r') || 0))) / 2000 : 50, cy: f ? ((+attr(f, 't') || 0) + (100000 - (+attr(f, 'b') || 0))) / 2000 : 50 }; }
            return { type: 'gradient', kind: 'linear', angle: lin ? +attr(lin, 'ang') / 60000 : 0, stops };
          }
          case 'blipFill': {
            const bl = kid(c, 'blip'), rid = relAttr(bl, 'embed'); const r = rels[rid]; let src = r ? await mediaSrc(r.target) : null; if (!src) return { type: 'none' }; src = await applyDuotone(bl, src, ph, readColor);
            const am = kid(bl, 'alphaModFix'); return { type: 'picture', src, tile: !!kid(c, 'tile') || undefined, opacity: am ? (+attr(am, 'amt') || 100000) / 100000 : undefined };
          }
          case 'pattFill': { const fg = readColor(kid(c, 'fgClr'), ph), bg = readColor(kid(c, 'bgClr'), ph); const pr = attr(c, 'prst'); return { type: 'pattern', preset: P.patternNames.includes(pr) ? pr : 'pct50', fg: fg ? fg.c : 'tx1', bg: bg ? bg.c : 'bg1' }; }
        }
      }
      return undefined;
    };
    const readLine = (ln, ph) => {
      if (!ln) return undefined;
      if (kid(ln, 'noFill')) return { type: 'none' };
      const sf = kid(ln, 'solidFill'), gf = kid(ln, 'gradFill'); const v = sf ? readColor(sf, ph) : gf ? readColor(kid(kid(gf, 'gsLst'), 'gs'), ph) : null;
      const w = attr(ln, 'w'); const out = {};
      if (!v && w == null && !kid(ln, 'prstDash') && !kid(ln, 'headEnd') && !kid(ln, 'tailEnd')) return undefined;
      out.type = 'solid'; if (v) { out.color = v.c; if (v.a != null) out.opacity = v.a; }
      if (w != null) out.width = PT(w);
      const d = kid(ln, 'prstDash'); if (d) out.dash = attr(d, 'val');
      const cap = attr(ln, 'cap'); if (cap === 'rnd') out.cap = 'round'; if (cap === 'sq') out.cap = 'square';
      if (kid(ln, 'bevel')) out.join = 'bevel'; if (kid(ln, 'miter')) out.join = 'miter'; if (kid(ln, 'round')) out.join = 'round';
      const he = kid(ln, 'headEnd'), te2 = kid(ln, 'tailEnd');
      if (he && attr(he, 'type') && attr(he, 'type') !== 'none') out.head = { type: attr(he, 'type'), size: attr(he, 'w') || 'med' };
      if (te2 && attr(te2, 'type') && attr(te2, 'type') !== 'none') out.tail = { type: attr(te2, 'type'), size: attr(te2, 'w') || 'med' };
      return out;
    };
    const readFx = (sp, ph) => {
      const fx = {}; const ef = kid(sp, 'effectLst');
      if (ef) {
        const os = kid(ef, 'outerShdw'); if (os) { const v = readColor(os, ph) || { c: '#000000' }; fx.shadow = { color: v.c, opacity: v.a == null ? 1 : v.a, blur: PT(attr(os, 'blurRad')), dist: PT(attr(os, 'dist')), dir: (+attr(os, 'dir') || 0) / 60000 }; }
        const gl = kid(ef, 'glow'); if (gl) { const v = readColor(gl, ph) || { c: 'accent1' }; fx.glow = { color: v.c, opacity: v.a == null ? .6 : v.a, rad: PT(attr(gl, 'rad')) }; }
        const rf = kid(ef, 'reflection'); if (rf) fx.reflect = { size: (+attr(rf, 'endPos') || 50000) / 1000, dist: PT(attr(rf, 'dist')), opacity: (+attr(rf, 'stA') || 50000) / 100000 };
        const se = kid(ef, 'softEdge'); if (se) fx.soft = { rad: PT(attr(se, 'rad')) };
      }
      const sc = kid(sp, 'scene3d'); const rot = sc && path(sc, 'camera', 'rot');
      if (rot) { const nm = v => { v = (+v || 0) / 60000; return v > 180 ? v - 360 : v; }; const x = nm(attr(rot, 'lat')), y = -nm(attr(rot, 'lon')); if (x || y) fx.rot3d = { x, y, persp: 800 }; }
      return Object.keys(fx).length ? fx : undefined;
    };

    /* -------- text -------- */
    const fontVal = f => { if (!f) return undefined; if (f.startsWith('+mj')) return '+mj'; if (f.startsWith('+mn')) return '+mn'; return f; };
    const readRPr = async (rp, rels, out = {}) => {
      if (!rp) return out;
      const sz = attr(rp, 'sz'); if (sz) out.size = +sz / 100;
      const b = attr(rp, 'b'); if (b != null) out.b = b === '1' || b === 'true';
      const i = attr(rp, 'i'); if (i != null) out.i = i === '1' || i === 'true';
      const u = attr(rp, 'u'); if (u) out.u = u !== 'none';
      const s = attr(rp, 'strike'); if (s && s !== 'noStrike') out.s = true;
      const cap = attr(rp, 'cap'); if (cap && cap !== 'none') out.cap = cap;
      const spc = attr(rp, 'spc'); if (spc && +spc) out.spc = +spc / 100;
      const bl = attr(rp, 'baseline'); if (bl && +bl) out.base = +bl / 1000;
      const sf = kid(rp, 'solidFill'); if (sf) { const v = readColor(sf); if (v) { out.color = v.c; if (v.a != null && v.a < 1) out.opacity = v.a; } }
      const gf = kid(rp, 'gradFill'); if (gf) { out.tfill = await readFill(rp, rels); if (out.tfill && out.tfill.type !== 'gradient') delete out.tfill; }
      if (kid(rp, 'noFill')) out.tfill = { type: 'none' };
      const ln = kid(rp, 'ln'); if (ln && !kid(ln, 'noFill')) { const sfl = kid(ln, 'solidFill'), v = sfl && readColor(sfl); if (v) out.outline = { color: v.c, w: PT(attr(ln, 'w') || 9525) }; }
      const ef = kid(rp, 'effectLst'); if (ef) { const os = kid(ef, 'outerShdw'); if (os) { const v = readColor(os) || { c: '#000000' }; out.shadow = { color: v.c, opacity: v.a == null ? 1 : v.a, blur: PT(attr(os, 'blurRad')), dist: PT(attr(os, 'dist')), dir: (+attr(os, 'dir') || 0) / 60000 }; } const gl = kid(ef, 'glow'); if (gl) { const v = readColor(gl) || { c: 'accent1' }; out.glow = { color: v.c, rad: PT(attr(gl, 'rad')) }; } }
      const hl = kid(rp, 'highlight'); if (hl) { const v = readColor(hl); if (v) out.hl = v.c; }
      const la = kid(rp, 'latin'); if (la) out.font = fontVal(attr(la, 'typeface'));
      const hc = kid(rp, 'hlinkClick'); if (hc) { const l = readLink(hc, rels); if (l) out.link = l; }
      return out;
    };
    const readLink = (hc, rels) => {
      const rid = relAttr(hc, 'id'), act = attr(hc, 'action') || '';
      if (/jump=nextslide/.test(act)) return { act: 'next' }; if (/jump=previousslide/.test(act)) return { act: 'prev' }; if (/jump=firstslide/.test(act)) return { act: 'first' }; if (/jump=lastslide/.test(act)) return { act: 'last' }; if (/jump=endshow/.test(act)) return { act: 'end' };
      if (rid && rels[rid]) { const r = rels[rid]; if (r.external) return { url: r.target }; if (/slide\d+\.xml$/.test(r.target)) return { slideFile: r.target }; }
      return null;
    };
    const readPPr = (pp, out = {}, levelOnly) => {
      if (!pp) return out;
      const a = attr(pp, 'algn'); if (a) out.align = a === 'justLow' || a === 'thaiDist' ? 'just' : a;
      const lv = attr(pp, 'lvl'); if (lv && !levelOnly) { if (+lv) out.level = +lv; }
      const ml = attr(pp, 'marL'); if (ml != null) out.marL = PT(ml);
      const ind = attr(pp, 'indent'); if (ind != null) out.indent = PT(ind);
      if (attr(pp, 'rtl') === '1') out.rtl = true;
      const ls = kid(pp, 'lnSpc'); if (ls) { const pc = kid(ls, 'spcPct'), pts = kid(ls, 'spcPts'); if (pc) out.lineSp = +attr(pc, 'val') / 100000; if (pts) out.lineSpPt = +attr(pts, 'val') / 100; }
      const sb = kid(pp, 'spcBef'); if (sb) { const pc = kid(sb, 'spcPct'), pts = kid(sb, 'spcPts'); if (pts) out.spcBef = +attr(pts, 'val') / 100; if (pc) out.spcBef = +attr(pc, 'val') / 100000 * 18; }
      const sa = kid(pp, 'spcAft'); if (sa) { const pc = kid(sa, 'spcPct'), pts = kid(sa, 'spcPts'); if (pts) out.spcAft = +attr(pts, 'val') / 100; if (pc) out.spcAft = +attr(pc, 'val') / 100000 * 18; }
      if (kid(pp, 'buNone')) out.bullet = null;
      else {
        const ch = kid(pp, 'buChar'), an = kid(pp, 'buAutoNum'), bc = kid(pp, 'buClr'), bz = kid(pp, 'buSzPct'), bf = kid(pp, 'buFont');
        if (ch) out.bullet = { type: 'char', char: attr(ch, 'char') || '•' };
        if (an) out.bullet = { type: 'num', style: attr(an, 'type') || 'arabicPeriod' }; if (an && attr(an, 'startAt')) out.bullet.start = +attr(an, 'startAt');
        if (out.bullet) { if (bc) { const v = readColor(bc); if (v) out.bullet.color = v.c; } if (bz) out.bullet.sizePct = +attr(bz, 'val') / 1000; if (bf && ch) out.bullet.font = attr(bf, 'typeface'); }
      }
      return out;
    };
    const readParas = async (tx, rels) => {
      const out = [];
      for (const p of kids(tx, 'p')) {
        const para = readPPr(kid(p, 'pPr')); para.runs = [];
        for (const c of kids(p)) {
          if (c.localName === 'r') { const r = await readRPr(kid(c, 'rPr'), rels); r.t = (kid(c, 't') ? kid(c, 't').textContent : ''); if (r.t) para.runs.push(r); }
          else if (c.localName === 'br') { const r = await readRPr(kid(c, 'rPr'), rels); r.t = '\n'; const last = para.runs[para.runs.length - 1]; if (last) last.t += '\n'; else para.runs.push(r); }
          else if (c.localName === 'fld') { const r = await readRPr(kid(c, 'rPr'), rels); r.t = kid(c, 't') ? kid(c, 't').textContent : ''; const ty = attr(c, 'type') || ''; if (ty === 'slidenum' || ty.startsWith('datetime')) r.field = ty; if (r.t || r.field) { if (!r.t) r.t = '‹#›'; para.runs.push(r); } }
          else if (c.localName === 'endParaRPr') { const e = await readRPr(c, rels); if (Object.keys(e).length) para.end = e; }
        }
        out.push(para);
      }
      return out;
    };
    const readLst = async (lst, rels) => {
      if (!lst) return undefined; const arr = [];
      for (let i = 1; i <= 9; i++) {
        const l = kid(lst, `lvl${i}pPr`); if (!l) { if (i <= 5) arr.push(null); continue; }
        const o = readPPr(l, {}, true); const d = kid(l, 'defRPr'); if (d) { const r = await readRPr(d, rels); if (r.size != null) o.size = r.size; if (r.color) o.color = r.color; if (r.font) o.font = r.font; if (r.b != null) o.bold = r.b; if (r.i != null) o.italic = r.i; if (r.u != null) o.u = r.u; if (r.cap) o.cap = r.cap; if (r.spc) o.spc = r.spc; }
        arr[i - 1] = o;
      }
      while (arr.length && !arr[arr.length - 1]) arr.pop();
      return arr.length ? arr : undefined;
    };
    const readBody = (bp, el) => {
      if (!bp) return;
      const v = attr(bp, 'vert'); if (v && v !== 'horz') el.vert = v === 'vert270' ? 'vert270' : 'vert';
      if (attr(bp, 'wrap') === 'none') el.wrap = false;
      const L = attr(bp, 'lIns'), T = attr(bp, 'tIns'), R = attr(bp, 'rIns'), B = attr(bp, 'bIns');
      if (L != null || T != null || R != null || B != null) el.ins = [L != null ? PT(L) : 7.2, T != null ? PT(T) : 3.6, R != null ? PT(R) : 7.2, B != null ? PT(B) : 3.6];
      const a = attr(bp, 'anchor'); if (a) el.anchor = a === 'dist' || a === 'just' ? 'ctr' : a;
      const nc = attr(bp, 'numCol'); if (nc && +nc > 1) el.cols = +nc;
      if (kid(bp, 'spAutoFit')) el.fit = 'resize'; else if (kid(bp, 'noAutofit')) el.fit = 'none';
      const na = kid(bp, 'normAutofit'); if (na) { el.fit = 'shrink'; if (attr(na, 'fontScale')) el.fontScale = +attr(na, 'fontScale') / 1000; if (attr(na, 'lnSpcReduction')) el.lnReduc = +attr(na, 'lnSpcReduction') / 1000; }
    };

    /* -------- geometry -------- */
    const readGeom = (spPr, el) => {
      const pg = kid(spPr, 'prstGeom'), cg = kid(spPr, 'custGeom');
      if (pg) {
        el.geom = attr(pg, 'prst') || 'rect';
        if (!P.geoms[el.geom]) { /* unknown preset: keep the name, renders as rectangle */ }
        const gds = kids(kid(pg, 'avLst'), 'gd');
        if (gds.length) { const a = []; gds.forEach(g => { const m = /^adj(\d*)$/.exec(attr(g, 'name') || ''); const v = /val\s+(-?\d+)/.exec(attr(g, 'fmla') || ''); if (m && v) a[(+m[1] || 1) - 1] = +v[1]; }); if (a.length) el.adj = a; }
      } else if (cg) {
        el.geom = 'custom';
        el.paths = kids(kid(cg, 'pathLst'), 'path').map(p => {
          const w = +attr(p, 'w') || 0, hh = +attr(p, 'h') || 0; let d = ''; let cx = 0, cy = 0; const pt = q => [+attr(q, 'x') || 0, +attr(q, 'y') || 0];
          kids(p).forEach(c => {
            const pts = kids(c, 'pt').map(pt);
            switch (c.localName) {
              case 'moveTo': d += `M${pts[0].join(' ')}`; [cx, cy] = pts[0]; break;
              case 'lnTo': d += `L${pts[0].join(' ')}`; [cx, cy] = pts[0]; break;
              case 'cubicBezTo': d += `C${pts.map(q => q.join(' ')).join(' ')}`; [cx, cy] = pts[2]; break;
              case 'quadBezTo': d += `Q${pts.map(q => q.join(' ')).join(' ')}`; [cx, cy] = pts[1]; break;
              case 'close': d += 'Z'; break;
              case 'arcTo': { const wR = +attr(c, 'wR'), hR = +attr(c, 'hR'), st = (+attr(c, 'stAng') || 0) / 60000 * Math.PI / 180, sw = (+attr(c, 'swAng') || 0) / 60000 * Math.PI / 180; const ox = cx - wR * Math.cos(st), oy = cy - hR * Math.sin(st); const n = Math.max(1, Math.ceil(Math.abs(sw) / (Math.PI / 2))); for (let i = 0; i < n; i++) { const a0 = st + sw * i / n, a1 = st + sw * (i + 1) / n, k = 4 / 3 * Math.tan((a1 - a0) / 4); const x1 = ox + wR * Math.cos(a0), y1 = oy + hR * Math.sin(a0), x2 = ox + wR * Math.cos(a1), y2 = oy + hR * Math.sin(a1); d += `C${x1 - k * wR * Math.sin(a0)} ${y1 + k * hR * Math.cos(a0)} ${x2 + k * wR * Math.sin(a1)} ${y2 - k * hR * Math.cos(a1)} ${x2} ${y2}`; cx = x2; cy = y2; } break; }
            }
          });
          return { d, w, h: hh, noFill: attr(p, 'fill') === 'none' || undefined, noStroke: attr(p, 'stroke') === '0' || undefined };
        });
      }
    };
    const readXfrm = (x, el) => {
      if (!x) return; const off = kid(x, 'off'), ext = kid(x, 'ext');
      if (off && ext) { el.x = PT(attr(off, 'x')); el.y = PT(attr(off, 'y')); el.w = PT(attr(ext, 'cx')); el.h = PT(attr(ext, 'cy')); }
      const r = attr(x, 'rot'); if (r && +r) { el.rot = ((+r / 60000) % 360 + 360) % 360; if (!el.rot) delete el.rot; }
      if (attr(x, 'flipH') === '1') el.flipH = true; if (attr(x, 'flipV') === '1') el.flipV = true;
    };
    const readNv = (nv, el, rels, idMap) => {
      const c = kid(nv, 'cNvPr'); if (!c) return;
      el.name = attr(c, 'name') || undefined; const d = attr(c, 'descr'); if (d) el.alt = d; if (attr(c, 'hidden') === '1') el.hidden = true;
      const id = attr(c, 'id'); if (id && idMap) idMap[id] = el.id;
      const hc = kid(c, 'hlinkClick'); if (hc) { const l = readLink(hc, rels); if (l) el.link = l; }
    };
    const readPh = (nvPr, el) => { const ph = kid(nvPr, 'ph'); if (!ph) return; const type = attr(ph, 'type') || 'obj', idx = attr(ph, 'idx'); el.ph = { type, idx: idx != null ? +idx : (type === 'title' || type === 'ctrTitle' ? 0 : undefined) }; };

    /* -------- shapes -------- */
    const readStyle = async (st, el, spPr) => {
      if (!st) return;
      const lr = kid(st, 'lnRef'), fr = kid(st, 'fillRef'), er = kid(st, 'effectRef'), fo = kid(st, 'fontRef');
      if (el.line === undefined && lr) { const idx = +attr(lr, 'idx') || 0; if (idx > 0) { const v = readColor(lr); if (v) el.line = { type: 'solid', color: v.c, width: lnWidths[idx - 1] || 1 }; } else el.line = { type: 'none' }; }
      else if (el.line && !el.line.color && lr) { const v = readColor(lr); if (v) el.line.color = v.c; if (el.line.width == null) el.line.width = lnWidths[(+attr(lr, 'idx') || 1) - 1] || 1; }
      if (el.fill === undefined && fr) { const idx = +attr(fr, 'idx') || 0; if (idx > 0) { const v = readColor(fr); if (v) { const themed = idx >= 1000 ? await styleFill(bgStyles[idx - 1001], v.c) : await styleFill(fillStyles[idx - 1], v.c); el.fill = themed || { type: 'solid', color: v.c }; } } else el.fill = { type: 'none' }; }
      if (er && !el.fx && !kid(spPr, 'effectLst')) { const idx = +attr(er, 'idx') || 0, es = effectStyles[idx - 1]; if (idx > 0 && es) { const v = readColor(er); const f = readFx(es, v ? v.c : undefined); if (f) el.fx = f; } }
      if (fo) { const v = readColor(fo); if (v) { el.lst = el.lst || []; el.lst[0] = Object.assign({ color: v.c }, el.lst[0]); } }
    };
    const readSp = async (n, rels, idMap, isDsp) => {
      const el = { id: P.uid(), type: 'shape' };
      const nv = kid(n, 'nvSpPr') || kid(n, 'nvCxnSpPr');
      if (nv) { readNv(nv, el, rels, idMap); const cNvSp = kid(nv, 'cNvSpPr'); if (cNvSp && attr(cNvSp, 'txBox') === '1') el.txBox = true; readPh(kid(nv, 'nvPr'), el);
        const cx = kid(nv, 'cNvCxnSpPr'); if (cx) { const st = kid(cx, 'stCxn'), en = kid(cx, 'endCxn'); if (st || en) el._cxn = { st: st && { id: attr(st, 'id'), idx: +attr(st, 'idx') }, end: en && { id: attr(en, 'id'), idx: +attr(en, 'idx') } }; } }
      const spPr = kid(n, 'spPr');
      readXfrm(kid(spPr, 'xfrm'), el); readGeom(spPr, el);
      if (!el.geom) el.geom = 'rect';
      const f = await readFill(spPr, rels); if (f !== undefined) el.fill = f;
      const l = readLine(kid(spPr, 'ln')); if (l !== undefined) el.line = l;
      const fx = readFx(spPr); if (fx) el.fx = fx;
      await readStyle(kid(n, 'style'), el, spPr);
      const tx = kid(n, 'txBody');
      if (tx) { readBody(kid(tx, 'bodyPr'), el); const ls = await readLst(kid(tx, 'lstStyle'), rels); if (ls) el.lst = el.lst && el.lst[0] ? ls.map((x, i) => (i === 0 ? Object.assign({}, el.lst[0], x) : x)) : ls; el.paras = await readParas(tx, rels); }
      else if (!P.isLineGeom(el.geom)) el.paras = [];
      void isDsp;
      return el;
    };
    const readPic = async (n, rels, idMap) => {
      const el = { id: P.uid(), type: 'image' }; const nv = kid(n, 'nvPicPr'); readNv(nv, el, rels, idMap); const nvPr = kid(nv, 'nvPr'); readPh(nvPr, el);
      const bf = kid(n, 'blipFill'), bl = kid(bf, 'blip'), spPr = kid(n, 'spPr');
      readXfrm(kid(spPr, 'xfrm'), el);
      const pg = kid(spPr, 'prstGeom'); if (pg && attr(pg, 'prst') !== 'rect') readGeom(spPr, el); else if (kid(spPr, 'custGeom')) readGeom(spPr, el);
      const r = rels[relAttr(bl, 'embed')]; const vid = kid(nvPr, 'videoFile'), aud = kid(nvPr, 'audioFile');
      if (vid || aud) {
        const media = desc(nvPr, 'media')[0]; let mt = media && rels[relAttr(media, 'embed')]; if (!mt) mt = rels[relAttr(vid || aud, 'link')];
        if (mt && !mt.external) { el.type = vid ? 'video' : 'audio'; el.src = await mediaSrc(mt.target); el.media = { auto: false, loop: false, vol: 1, hide: false }; if (r) el.poster = await mediaSrc(r.target); if (el.poster && /emf|wmf/.test(mimeOf(r.target))) delete el.poster; return el; }
      }
      /* prefer svg-free raster; .emf/.wmf cannot be drawn by a browser */
      el.src = r ? await mediaSrc(r.target) : null; el.src = await applyDuotone(bl, el.src, undefined, readColor);
      if (r && /\.(emf|wmf|tiff?)$/i.test(r.target)) { el.unsupported = true; }
      const sr = kid(bf, 'srcRect'); if (sr) { const v = k => (+attr(sr, k) || 0) / 100000; const c = { l: v('l'), t: v('t'), r: v('r'), b: v('b') }; if (c.l || c.t || c.r || c.b) el.crop = c; }
      const adj = {}; const am = kid(bl, 'alphaModFix'); if (am) adj.opacity = (+attr(am, 'amt') || 100000) / 100000; if (kid(bl, 'grayscl')) adj.gray = true; const lum = kid(bl, 'lum'); if (lum) { if (attr(lum, 'bright')) adj.bright = +attr(lum, 'bright') / 1000; if (attr(lum, 'contrast')) adj.contrast = +attr(lum, 'contrast') / 1000; } if (Object.keys(adj).length) el.adjust = adj;
      const l = readLine(kid(spPr, 'ln')); if (l !== undefined) el.line = l; const fx = readFx(spPr); if (fx) el.fx = fx;
      return el;
    };
    const readCell = async (tc, rels) => {
      const c = {}; const tx = kid(tc, 'txBody'); c.paras = tx ? await readParas(tx, rels) : [P.para('')];
      const g = attr(tc, 'gridSpan'), rs = attr(tc, 'rowSpan'); if (g && +g > 1) c.span = +g; if (rs && +rs > 1) c.rowSpan = +rs; if (attr(tc, 'hMerge') === '1') c.hm = true; if (attr(tc, 'vMerge') === '1') c.vm = true;
      const pr = kid(tc, 'tcPr');
      if (pr) {
        const a = attr(pr, 'anchor'); if (a) c.anchor = a;
        const ml = attr(pr, 'marL'), mr = attr(pr, 'marR'), mt = attr(pr, 'marT'), mb = attr(pr, 'marB'); if (ml != null || mr != null || mt != null || mb != null) c.ins = [ml != null ? PT(ml) : 7.2, mt != null ? PT(mt) : 3.6, mr != null ? PT(mr) : 7.2, mb != null ? PT(mb) : 3.6];
        const f = await readFill(pr, rels); if (f !== undefined) c.fill = f;
        [['lnL', 'l'], ['lnR', 'r'], ['lnT', 't'], ['lnB', 'b']].forEach(([t, s]) => { const ln = kid(pr, t); if (ln) { const v = readLine(ln); if (v) { c.borders = c.borders || {}; c.borders[s] = v; } } });
      }
      return c;
    };
    const readTable = async (tbl, el, rels) => {
      const pr = kid(tbl, 'tblPr'); const flag = a => attr(pr, a) === '1' || attr(pr, a) === 'true';
      const sid = kid(pr, 'tableStyleId'); const style = sid ? (P.TABLE_GUIDS[sid.textContent.trim()] || 'grid') : 'none';
      const t = { cols: kids(kid(tbl, 'tblGrid'), 'gridCol').map(g => PT(attr(g, 'w'))), rows: [], style, opts: { hdr: flag('firstRow') || undefined, total: flag('lastRow') || undefined, firstCol: flag('firstCol') || undefined, lastCol: flag('lastCol') || undefined, bandR: flag('bandRow') || undefined, bandC: flag('bandCol') || undefined }, size: 18 };
      for (const tr of kids(tbl, 'tr')) { const cells = []; for (const tc of kids(tr, 'tc')) cells.push(await readCell(tc, rels)); t.rows.push({ h: PT(attr(tr, 'h')), cells }); }
      el.type = 'table'; el.tbl = t;
    };
    const readChart = async (rid, rels, el) => {
      const r = rels[rid]; if (!r) return false; const doc = await xmlOf(r.target); if (!doc) return false;
      const ch = kid(doc.documentElement, 'chart'), pa = kid(ch, 'plotArea');
      const types = { barChart: 1, bar3DChart: 1, lineChart: 1, line3DChart: 1, areaChart: 1, area3DChart: 1, pieChart: 1, pie3DChart: 1, ofPieChart: 1, doughnutChart: 1, scatterChart: 1, radarChart: 1, bubbleChart: 1 };
      const plot = kids(pa).find(k => types[k.localName]); if (!plot) return false;
      const ln = plot.localName; const m = { kind: 'column', grouping: 'clustered', cats: [], series: [] };
      if (/bar/.test(ln)) m.kind = attr(kid(plot, 'barDir'), 'val') === 'bar' ? 'bar' : 'column'; else if (/line/.test(ln)) m.kind = 'line'; else if (/area/.test(ln)) m.kind = 'area'; else if (/doughnut/.test(ln)) m.kind = 'doughnut'; else if (/[pP]ie/.test(ln)) m.kind = 'pie'; else if (/scatter|bubble/.test(ln)) m.kind = 'scatter'; else if (/radar/.test(ln)) m.kind = 'radar';
      const gr = attr(kid(plot, 'grouping'), 'val'); if (gr === 'stacked') m.grouping = 'stacked'; if (gr === 'percentStacked') m.grouping = 'percent';
      const cache = n => desc(n, 'pt').map(p => ({ idx: +attr(p, 'idx'), v: kid(p, 'v') ? kid(p, 'v').textContent : '' }));
      const vals = (n, count) => { const a = []; cache(n).forEach(p => { a[p.idx] = p.v; }); for (let i = 0; i < (count || a.length); i++) if (a[i] === undefined) a[i] = ''; return a; };
      const allPlots = kids(pa).filter(k => types[k.localName]);
      allPlots.forEach(pl => kids(pl, 'ser').forEach(s => {
        const cat = kid(s, 'cat') || kid(s, 'xVal'), val = kid(s, 'val') || kid(s, 'yVal'), tx = kid(s, 'tx');
        const name = tx ? (desc(tx, 'v')[0] ? desc(tx, 'v')[0].textContent : 'Series') : 'Series ' + (m.series.length + 1);
        if (cat && !m.cats.length) m.cats = vals(cat);
        const so = { name, values: val ? vals(val).map(v => +v || 0) : [] };
        const sp = kid(s, 'spPr'); const sf = sp && (kid(sp, 'solidFill') || path(sp, 'ln', 'solidFill')); if (sf) { const v = readColor(sf); if (v) so.color = v.c; }
        const dp = kids(s, 'dPt'); if (dp.length) { so.pointColors = []; dp.forEach(d => { const i = +attr(kid(d, 'idx'), 'val'); const f = path(d, 'spPr', 'solidFill'); if (f) { const v = readColor(f); if (v) so.pointColors[i] = v.c; } }); }
        if (kid(s, 'marker') && attr(path(s, 'marker', 'symbol'), 'val') !== 'none') m.marker = true;
        m.series.push(so);
      }));
      if (!m.cats.length) m.cats = (m.series[0] ? m.series[0].values : []).map((_, i) => 'Category ' + (i + 1));
      const t = kid(ch, 'title'); if (t) { m.title = desc(t, 't').map(x => x.textContent).join('') || (m.series.length === 1 ? m.series[0].name : 'Chart Title'); m.showTitle = true; } else { m.showTitle = false; m.title = ''; }
      const lg = kid(ch, 'legend'); m.legend = lg ? (attr(kid(lg, 'legendPos'), 'val') || 'r') : 'none'; if (m.legend === 'tr') m.legend = 'r';
      const sv = desc(plot, 'showVal')[0]; m.labels = sv && attr(sv, 'val') === '1'; const sp2 = desc(plot, 'showPercent')[0]; if (sp2 && attr(sp2, 'val') === '1') { m.labels = true; m.labelPct = true; }
      m.grid = desc(pa, 'majorGridlines').length > 0;
      const gw = kid(plot, 'gapWidth'), ol = kid(plot, 'overlap'); if (gw) m.gapWidth = +attr(gw, 'val'); if (ol) m.overlap = +attr(ol, 'val');
      const axis = kid(pa, 'catAx') || kid(pa, 'valAx') || kid(pa, 'dateAx'), lgd = kid(ch, 'legend'), root2 = doc.documentElement;
      const def = [axis, lgd, root2].map(n => n && path(n, 'txPr', 'p', 'pPr', 'defRPr')).find(n => n && (attr(n, 'sz') || kid(n, 'solidFill')));
      if (def) { if (attr(def, 'sz')) m.fontSize = +attr(def, 'sz') / 100; const tc = readColor(kid(def, 'solidFill')); if (tc) m.textColor = tc.c; }
      el.type = 'chart'; el.chart = m; return true;
    };
    const readFrame = async (n, rels, idMap) => {
      const el = { id: P.uid(), type: 'shape', geom: 'rect' };
      const nv = kid(n, 'nvGraphicFramePr'); readNv(nv, el, rels, idMap); readPh(kid(nv, 'nvPr'), el);
      readXfrm(kid(n, 'xfrm'), el);
      const gd = path(n, 'graphic', 'graphicData'); if (!gd) return null;
      const tbl = kid(gd, 'tbl'); if (tbl) { await readTable(tbl, el, rels); if (el.tbl.rows.length) { el.h = Math.max(el.h || 0, el.tbl.rows.reduce((a, r) => a + r.h, 0)); } return el; }
      const c = kid(gd, 'chart'); if (c) { const ok = await readChart(relAttr(c, 'id'), rels, el); if (ok) return el; }
      const rm = kid(gd, 'relIds');
      if (rm) { /* SmartArt: read the saved drawing as a group of editable shapes */
        const dr = Object.values(rels).find(r => /diagramDrawing/.test(r.type)); if (dr) { const doc = await xmlOf(dr.target), drRels = await relsOf(dr.target); const tree = doc && desc(doc.documentElement, 'spTree')[0]; if (tree) { const g = { id: el.id, type: 'group', name: el.name || 'SmartArt', alt: el.alt, x: el.x, y: el.y, w: el.w, h: el.h, children: [] }; for (const c2 of flat(tree)) { if (c2.localName === 'sp') { const s = await readSp(c2, drRels, null, true); const tx = kid(c2, 'txXfrm'); if (tx && s.paras && s.paras.length) { /* text box differs slightly from the shape; acceptable */ } g.children.push(s); } } return g; } }
      }
      /* OLE objects etc. show their fallback picture */
      const ole = desc(gd, 'pic')[0]; if (ole) { const p = await readPic(ole, rels, null); if (p) { p.x = el.x; p.y = el.y; p.w = el.w; p.h = el.h; p.name = el.name; return p; } }
      return null;
    };
    const readGroup = async (n, rels, idMap) => {
      const el = { id: P.uid(), type: 'group', children: [] }; readNv(kid(n, 'nvGrpSpPr'), el, rels, idMap);
      const pr = kid(n, 'grpSpPr'), x = kid(pr, 'xfrm'); readXfrm(x, el);
      const ch0 = x && kid(x, 'chOff'), ce = x && kid(x, 'chExt');
      const cx = ch0 ? PT(attr(ch0, 'x')) : 0, cy = ch0 ? PT(attr(ch0, 'y')) : 0, cw = ce ? PT(attr(ce, 'cx')) : 0, chh = ce ? PT(attr(ce, 'cy')) : 0;
      const sx = cw ? (el.w || cw) / cw : 1, sy = chh ? (el.h || chh) / chh : 1;
      const gf = await readFill(pr, rels);
      const items = await readElements(n, rels, idMap);
      const bake = (k) => { if (k.x === undefined) return; k.x = (k.x - cx) * sx; k.y = (k.y - cy) * sy; k.w *= sx; k.h *= sy; if (k.type === 'group') scaleKids(k, sx, sy); if (k.tbl) { k.tbl.cols = k.tbl.cols.map(c => c * sx); k.tbl.rows.forEach(r => r.h *= sy); } if (gf && k.fill === undefined) k.fill = gf; };
      items.forEach(bake); el.children = items;
      if (el.x === undefined) { el.x = 0; el.y = 0; el.w = deck.size.w; el.h = deck.size.h; }
      return el;
    };
    const scaleKids = (g, sx, sy) => { (g.children || []).forEach(k => { k.x *= sx; k.y *= sy; k.w *= sx; k.h *= sy; if (k.children) scaleKids(k, sx, sy); }); };
    const readElements = async (tree, rels, idMap) => {
      const out = [];
      for (const c of flat(tree)) {
        let e = null;
        try {
          if (c.localName === 'sp') e = await readSp(c, rels, idMap);
          else if (c.localName === 'cxnSp') { e = await readSp(c, rels, idMap); if (!e.geom || !P.isLineGeom(e.geom)) { if (e.geom === 'rect') e.geom = 'line'; } }
          else if (c.localName === 'pic') e = await readPic(c, rels, idMap);
          else if (c.localName === 'graphicFrame') e = await readFrame(c, rels, idMap);
          else if (c.localName === 'grpSp') e = await readGroup(c, rels, idMap);
        } catch (err) { console.warn('Skipped an object while reading', err); }
        if (e) out.push(e);
      }
      return out;
    };
    const readBg = async (cSld, rels) => {
      const bg = kid(cSld, 'bg'); if (!bg) return undefined;
      const pr = kid(bg, 'bgPr'); if (pr) { const f = await readFill(pr, rels); return f; }
      const ref = kid(bg, 'bgRef'); if (ref) { const v = readColor(ref), idx = +attr(ref, 'idx') || 0; if (v) { const themed = idx >= 1001 ? await styleFill(bgStyles[idx - 1001], v.c) : idx ? await styleFill(fillStyles[idx - 1], v.c) : null; return themed && themed.type !== 'none' ? themed : { type: 'solid', color: v.c }; } }
      return undefined;
    };
    const finishConnectors = (els, idMap) => { P.walk(els, e => { if (e._cxn) { const c = {}; const fix = r => { const t = idMap[r.id]; if (!t) return null; const found = (function f(l) { for (const x of l) { if (x.id === t) return x; if (x.children) { const y = f(x.children); if (y) return y; } } return null; })(els); const eight = found && found.geom === 'ellipse'; return { id: t, idx: eight ? Math.floor(r.idx / 2) % 4 : r.idx % 4 }; }; if (e._cxn.st) { const v = fix(e._cxn.st); if (v) c.st = v; } if (e._cxn.end) { const v = fix(e._cxn.end); if (v) c.end = v; } if (c.st || c.end) e.conn = c; delete e._cxn; } }); };

    /* -------- master -------- */
    const mr = masterDoc.documentElement, mcs = kid(mr, 'cSld');
    const master = { id: 'master', kind: 'master', name: (deck.theme.name || 'Theme') + ' Slide Master', elements: [], txStyles: null };
    const midMap = {}; master.elements = await readElements(kid(mcs, 'spTree'), masterRels, midMap); finishConnectors(master.elements, midMap);
    master.bg = await readBg(mcs, masterRels) || { type: 'solid', color: 'bg1' };
    const ts = kid(mr, 'txStyles');
    const styleFrom = async (st, n) => { const arr = await readLst(st, masterRels) || []; const out = []; for (let i = 0; i < n; i++) out.push(arr[i] || {}); return out; };
    const tStyle = (await styleFrom(kid(ts, 'titleStyle'), 1))[0]; const bStyles = await styleFrom(kid(ts, 'bodyStyle'), 5); const oStyle = (await styleFrom(kid(ts, 'otherStyle'), 1))[0];
    const fix = l => { if (l.font === undefined) l.font = '+mn'; if (l.color === undefined) l.color = 'tx1'; if (l.size === undefined) l.size = 18; return l; };
    if (tStyle.font === undefined) tStyle.font = '+mj';
    master.txStyles = { title: fix(tStyle), body: bStyles.map(fix), other: fix(oStyle) };
    deck.master = master;
    /* -------- layouts -------- */
    deck.layouts = []; const layoutByPath = {};
    const loadLayout = async (lp, extraDecoFrom) => {
      if (layoutByPath[lp]) return layoutByPath[lp];
      const doc = await xmlOf(lp); if (!doc) return null; const rels = await relsOf(lp); const root = doc.documentElement, cs2 = kid(root, 'cSld');
      const lay = { id: 'L' + (deck.layouts.length + 1), kind: 'layout', name: attr(cs2, 'name') || 'Layout', type: attr(root, 'type') || 'cust', elements: [] };
      const map = {}; lay.elements = await readElements(kid(cs2, 'spTree'), rels, map); finishConnectors(lay.elements, map);
      const bg = await readBg(cs2, rels); if (bg) lay.bg = bg;
      if (attr(root, 'showMasterSp') === '0') lay.showMaster = false;
      if (extraDecoFrom) { lay.elements.unshift(...extraDecoFrom.deco.map(P.clone)); if (!lay.bg && extraDecoFrom.bg) lay.bg = extraDecoFrom.bg; lay.showMaster = false; }
      deck.layouts.push(lay); layoutByPath[lp] = lay; return lay;
    };
    for (const r of Object.values(masterRels)) if (/slideLayout$/.test(r.type)) await loadLayout(r.target);
    /* keep declared order */
    const declared = kids(kid(mr, 'sldLayoutIdLst'), 'sldLayoutId').map(n => masterRels[relAttr(n, 'id')] && layoutByPath[masterRels[relAttr(n, 'id')].target]).filter(Boolean);
    if (declared.length === deck.layouts.length) { deck.layouts = declared; }
    /* -------- slides -------- */
    const slideRefs = kids(kid(pres, 'sldIdLst'), 'sldId');
    const fileToSlide = {}, numToSlide = {};
    const pendingLinks = [];
    const allOtherMasters = {};
    for (const ref of slideRefs) {
      const rel = presRels[relAttr(ref, 'id')]; if (!rel) continue; const sp = rel.target;
      const doc = await xmlOf(sp); if (!doc) continue; const rels = await relsOf(sp), root = doc.documentElement, cs2 = kid(root, 'cSld');
      const s = { id: P.uid('s'), elements: [], animations: [], comments: [], notes: '', transition: null };
      fileToSlide[sp] = s; numToSlide[attr(ref, 'id')] = s;
      const layRel = Object.values(rels).find(r => /slideLayout$/.test(r.type));
      let lay = layRel && layoutByPath[layRel.target];
      if (layRel && !lay) { /* layout from a secondary master */
        const lrels = await relsOf(layRel.target); const m2 = Object.values(lrels).find(r => /slideMaster$/.test(r.type)); let deco = null;
        if (m2) { if (!allOtherMasters[m2.target]) { const d2 = await xmlOf(m2.target), r2 = await relsOf(m2.target); const c2 = kid(d2.documentElement, 'cSld'); const els = await readElements(kid(c2, 'spTree'), r2, {}); allOtherMasters[m2.target] = { deco: els.filter(e => !e.ph), bg: await readBg(c2, r2) }; } deco = allOtherMasters[m2.target]; }
        lay = await loadLayout(layRel.target, deco);
      }
      s.layout = lay ? lay.id : (deck.layouts[0] && deck.layouts[0].id);
      const idMap = {}; s.elements = await readElements(kid(cs2, 'spTree'), rels, idMap); finishConnectors(s.elements, idMap);
      const bg = await readBg(cs2, rels); if (bg) s.bg = bg;
      if (attr(root, 'show') === '0') s.hidden = true;
      if (attr(root, 'showMasterSp') === '0') s.showMaster = false;
      /* transition (Choice carries the true duration & modern types) */
      let tr = null; flat(root, true).forEach(c => { if (c.localName === 'transition') tr = c; });
      if (tr) s.transition = readTransition(tr);
      const tm = kid(root, 'timing'); if (tm) { try { s.animations = readTiming(tm, idMap); } catch (e) { console.warn('Could not read animations', e); } }
      /* notes */
      const nr = Object.values(rels).find(r => /notesSlide$/.test(r.type));
      if (nr) { const nd = await xmlOf(nr.target); if (nd) { const body = desc(nd.documentElement, 'sp').find(q => { const ph = desc(q, 'ph')[0]; return ph && attr(ph, 'type') === 'body'; }); if (body) s.notes = kids(kid(body, 'txBody'), 'p').map(p => desc(p, 't').map(t => t.textContent).join('')).join('\n').trim(); } }
      /* legacy & modern comments */
      const cr = Object.values(rels).find(r => /\/comments$/.test(r.type)); s._cm = cr ? cr.target : null;
      const modern = Object.values(rels).find(r => /threadedComment|\/comments$/.test(r.type) && /modernComment/.test(r.target)); s._mcm = modern ? modern.target : null;
      /* links needing slide refs */
      pendingLinks.push(s);
      deck.slides.push(s);
    }
    /* resolve hyperlink slide references */
    const fixLink = l => { if (l && l.slideFile) { const t = fileToSlide[l.slideFile]; if (t) l.slide = t.id; delete l.slideFile; } };
    deck.slides.forEach(s => P.walk(s.elements, e => { fixLink(e.link); (e.paras || []).forEach(p => (p.runs || []).forEach(r => fixLink(r.link))); if (e.tbl) e.tbl.rows.forEach(ro => ro.cells.forEach(c => (c.paras || []).forEach(p => (p.runs || []).forEach(r => fixLink(r.link))))); }));
    /* comments */
    const authDoc = presRels && Object.values(presRels).find(r => /commentAuthors$/.test(r.type));
    const authors = {}; if (authDoc) { const d = await xmlOf(authDoc.target); if (d) kids(d.documentElement, 'cmAuthor').forEach(a => { authors[attr(a, 'id')] = attr(a, 'name'); }); }
    const modAuth = Object.values(presRels).find(r => /\/authors$/.test(r.type)); const mAuthors = {}; if (modAuth) { const d = await xmlOf(modAuth.target); if (d) kids(d.documentElement, 'author').forEach(a => { mAuthors[attr(a, 'id')] = attr(a, 'name'); }); }
    for (const s of deck.slides) {
      if (s._cm && !/modernComment/.test(s._cm)) { const d = await xmlOf(s._cm); if (d) kids(d.documentElement, 'cm').forEach(c => { const pos = kid(c, 'pos'); s.comments.push({ id: P.uid('c'), author: authors[attr(c, 'authorId')] || 'Author', date: attr(c, 'dt') || new Date().toISOString(), text: kid(c, 'text') ? kid(c, 'text').textContent : '', x: pos ? +attr(pos, 'x') / 8 : 12, y: pos ? +attr(pos, 'y') / 8 : 12 }); }); }
      if (s._mcm) { const d = await xmlOf(s._mcm); if (d) kids(d.documentElement, 'cm').forEach(c => { const txt = el2 => desc(kid(el2, 'txBody'), 't').map(t => t.textContent).join(''); const replies = desc(c, 'reply').map(r => ({ author: mAuthors[attr(r, 'authorId')] || 'Author', text: txt(r), date: attr(r, 'created') })); s.comments.push({ id: P.uid('c'), author: mAuthors[attr(c, 'authorId')] || 'Author', date: attr(c, 'created') || new Date().toISOString(), text: txt(c), x: 12, y: 12 + s.comments.length * 24, replies }); }); }
      delete s._cm; delete s._mcm;
    }
    /* sections */
    const secLst = desc(pres, 'sectionLst')[0];
    if (secLst) kids(secLst, 'section').forEach(sec => { deck.sections.push({ id: P.uid('c'), name: attr(sec, 'name') || 'Section', slideIds: desc(sec, 'sldId').map(q => numToSlide[attr(q, 'id')]).filter(Boolean).map(z => z.id) }); });
    /* custom shows */
    kids(kid(pres, 'custShowLst'), 'custShow').forEach(c => { deck.customShows.push({ name: attr(c, 'name'), slideIds: kids(kid(c, 'sldLst'), 'sld').map(x => { const r = presRels[relAttr(x, 'id')]; return r && fileToSlide[r.target] && fileToSlide[r.target].id; }).filter(Boolean) }); });
    /* presentation properties */
    const pp = Object.values(presRels).find(r => /presProps$/.test(r.type));
    if (pp) { const d = await xmlOf(pp.target); const sh = d && kid(d.documentElement, 'showPr'); if (sh) { if (attr(sh, 'loop') === '1') deck.showCfg.loop = true; if (attr(sh, 'useTimings') === '0') deck.showCfg.useTimings = false; if (kid(sh, 'browse')) deck.showCfg.type = 'browsed'; if (kid(sh, 'kiosk')) deck.showCfg.type = 'kiosk'; const rg = kid(sh, 'sldRg'); if (rg) { deck.showCfg.showFrom = +attr(rg, 'st'); deck.showCfg.showTo = +attr(rg, 'end'); } const pc = readColor(kid(sh, 'penClr')); if (pc && pc.c[0] === '#') deck.showCfg.penColor = pc.c; } }
    const core = await xmlOf('docProps/core.xml');
    if (core) { const g = n => { const x = desc(core.documentElement, n)[0]; return x ? x.textContent : ''; }; deck.props = { title: g('title'), author: g('creator'), subject: g('subject'), keywords: g('keywords'), comments: g('description'), created: g('created') }; if (g('title')) deck.title = g('title'); }
    deck.theme.def = (P.themes.find(t => t.name === deck.theme.name) || {}).name;
    /* placeholder elements with no explicit type on slides need a sane name */
    deck.slides.forEach(s => s.elements.forEach(e => { if (e.ph && !e.name) e.name = e.ph.type; }));
    return deck;

    /* -------- transitions -------- */
    function readTransition(t) {
      const o = { type: 'none' }; const c = t.firstElementChild;
      const pd = [...t.attributes].find(a => a.localName === 'dur'); if (pd) o.dur = +pd.value; else { const sp = attr(t, 'spd'); o.dur = sp === 'fast' ? 500 : sp === 'slow' ? 1200 : 750; }
      if (attr(t, 'advClick') === '0') o.advClick = false; const adv = attr(t, 'advTm'); if (adv != null) o.advAfter = +adv;
      if (!c) { if (o.advAfter == null && o.advClick == null) return null; return o; }
      const n = c.localName, dir = attr(c, 'dir');
      const m = { cut: 'cut', fade: 'fade', push: 'push', wipe: 'wipe', split: 'split', pull: 'pull', cover: 'cover', randomBar: 'randomBar', blinds: 'blinds', checker: 'checker', circle: 'circle', diamond: 'diamond', plus: 'plus', zoom: 'zoom', dissolve: 'dissolve', wedge: 'wedge', newsflash: 'newsflash', flash: 'flash', prism: 'cube', flip: 'flip', doors: 'doors', gallery: 'gallery', wheel: 'wheel', vortex: 'cube', switch: 'flip', conveyor: 'gallery', ferris: 'gallery', window: 'doors', ripple: 'circle', honeycomb: 'dissolve', glitter: 'dissolve', shred: 'dissolve', pan: 'push', warp: 'zoom', flythrough: 'zoom', reveal: 'fade', strips: 'wipe', comb: 'blinds', morph: 'fade' };
      o.type = m[n] || 'fade';
      if (n === 'wheel' && attr(c, 'spokes') === '1') o.type = 'clock';
      if (n === 'split') o.dir = (attr(c, 'orient') === 'horz' ? 'horz' : 'vert') + (attr(c, 'dir') === 'in' ? 'In' : 'Out');
      else if (dir) o.dir = /^[lrud]/.test(dir) ? dir[0] : dir;
      if (o.type === 'randomBar' || o.type === 'blinds') o.dir = dir === 'vert' ? 'vert' : 'horz';
      if (o.type === 'zoom') o.dir = dir === 'out' ? 'out' : 'in';
      return o;
    }
    /* -------- animation -------- */
    function readTiming(tm, idMap) {
      const out = [];
      const nodes = desc(tm, 'cTn').filter(c => attr(c, 'presetClass'));
      const byClass = { entr: 'entr', exit: 'exit', emph: 'emph', path: 'path' };
      nodes.forEach(c => {
        const cls = byClass[attr(c, 'presetClass')]; if (!cls) return; const pid = +attr(c, 'presetID');
        const stEl = desc(c, 'spTgt')[0]; if (!stEl) return; const spid = attr(stEl, 'spid'); const el = idMap[spid]; if (!el) return;
        const pr = desc(stEl, 'pRg')[0]; const para = pr ? +attr(pr, 'st') : null;
        const ntype = attr(c, 'nodeType'); const start = ntype === 'clickEffect' ? 'click' : ntype === 'afterEffect' ? 'after' : 'with';
        const cond = path(c, 'stCondLst', 'cond'); const delay = cond && attr(cond, 'delay') !== 'indefinite' ? +attr(cond, 'delay') || 0 : 0;
        const ch = kid(c, 'childTnLst'); let dur = 0, filter = null, sawAnim = false, sawScale = false, sawRot = false, sawMotion = null;
        kids(ch).forEach(b => {
          const ct = desc(b, 'cTn')[0]; const d = ct ? +attr(ct, 'dur') || 0 : 0; const dl = ct && path(ct, 'stCondLst', 'cond') ? +attr(path(ct, 'stCondLst', 'cond'), 'delay') || 0 : 0;
          if (b.localName !== 'set') dur = Math.max(dur, d + (b.localName === 'animEffect' ? 0 : 0)); else if (!dur && dl) dur = Math.max(dur, dl + 1);
          if (b.localName === 'animEffect') filter = attr(b, 'filter'); if (b.localName === 'anim') sawAnim = true; if (b.localName === 'animScale') sawScale = true; if (b.localName === 'animRot') sawRot = true; if (b.localName === 'animMotion') sawMotion = attr(b, 'path');
        });
        const sub = +attr(c, 'presetSubtype') || 0;
        let effect = null, dir;
        const dirSub = { 4: 'fromBottom', 8: 'fromLeft', 2: 'fromRight', 1: 'fromTop' };
        if (cls === 'path') {
          const p = sawMotion || ''; const nums = (p.match(/-?\d*\.?\d+(?:[eE]-?\d+)?/g) || []).map(Number);
          if (/C/.test(p)) effect = /Z/i.test(p) ? 'circle' : 'arc';
          else { const dx = nums[2] || 0, dy = nums[3] || 0; effect = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'lineRight' : 'lineLeft') : (dy < 0 ? 'lineUp' : 'lineDown'); }
        } else if (cls === 'emph') {
          effect = ({ 26: 'pulse', 27: 'colorPulse', 32: 'teeter', 8: 'spin', 6: 'growShrink', 35: 'flash', 28: 'bold', 34: 'wave' })[pid] || (sawRot ? 'spin' : sawScale ? 'pulse' : 'flash');
        } else {
          const entry = cls === 'entr';
          if (filter) {
            if (/^wipe/.test(filter)) { effect = entry ? 'wipe' : 'wipeOut'; const m = /wipe\((\w+)\)/.exec(filter); dir = m && ({ left: 'fromLeft', right: 'fromRight', up: 'fromTop', down: 'fromBottom' })[m[1]]; }
            else if (/^barn/.test(filter)) { effect = entry ? 'split' : 'splitOut'; const m = /barn\((\w+)\)/.exec(filter); dir = m && ({ inHorizontal: 'horzIn', outHorizontal: 'horzOut', inVertical: 'vertIn', outVertical: 'vertOut' })[m[1]]; }
            else if (/^wheel/.test(filter)) effect = entry ? 'wheel' : 'wheelOut';
            else if (/^randombar/i.test(filter)) { effect = entry ? 'randomBars' : 'randomBarsOut'; dir = /vert/.test(filter) ? 'vert' : 'horz'; }
            else if (/^(circle|box|diamond|plus)/.test(filter)) effect = entry ? 'shape' : 'shapeOut';
            else if (/^fade/.test(filter)) { if (sawAnim && (pid === 42 || pid === 47)) { effect = entry ? 'floatIn' : 'floatOut'; dir = pid === 47 ? 'down' : 'up'; } else if (sawAnim && pid === 31) effect = entry ? 'growTurn' : 'shrinkTurn'; else if (sawAnim && (pid === 23 || pid === 53)) effect = entry ? 'zoom' : 'zoomOut'; else if (sawAnim) effect = entry ? 'zoom' : 'zoomOut'; else effect = entry ? 'fade' : 'fadeOut'; }
          }
          if (!effect) {
            if (pid === 1) effect = entry ? 'appear' : 'disappear';
            else if (pid === 2 || sawAnim && dirSub[sub] && !(pid === 26 || pid === 23 || pid === 19)) { effect = entry ? 'flyIn' : 'flyOut'; dir = dirSub[sub] || 'fromBottom'; }
            else if (pid === 26) effect = entry ? 'bounce' : 'bounceOut'; else if (pid === 19) effect = entry ? 'swivel' : 'swivelOut'; else if (pid === 23 || pid === 53) effect = entry ? 'zoom' : 'zoomOut'; else if (pid === 31) effect = entry ? 'growTurn' : 'shrinkTurn';
            else effect = entry ? 'fade' : 'fadeOut';
          }
        }
        const prev = out[out.length - 1];
        if (para != null && prev && prev.el === el && prev.effect === effect && prev.by === 'para') { return; }
        out.push({ id: P.uid('a'), el, effect, start, delay, dur: dur || P.animDefaultDur(effect), dir, by: para != null ? 'para' : undefined });
      });
      return out;
    }
  };
})(window.P);
