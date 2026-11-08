/* Podium - document model, colours, themes, masters, history */
window.P = window.P || {};
(function (P) {
  'use strict';

  /* ---------- tiny utils ---------- */
  let _n = 0;
  P.uid = (pfx = 'e') => pfx + (++_n).toString(36) + Math.random().toString(36).slice(2, 7);
  P.clone = o => (o === undefined ? undefined : JSON.parse(JSON.stringify(o)));
  P.clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  P.esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  P.round = (v, d = 2) => { const m = Math.pow(10, d); return Math.round(v * m) / m; };
  window.h = function (tag, props, ...kids) {
    const e = document.createElement(tag);
    if (props) for (const k in props) {
      const v = props[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
      else if (k === 'html') e.innerHTML = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else if (k in e && k !== 'list' && k !== 'form' && k !== 'width' && k !== 'height') { try { e[k] = v; } catch (_) { e.setAttribute(k, v); } }
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      e.append(c.nodeType ? c : document.createTextNode(String(c)));
    }
    return e;
  };

  /* events */
  const listeners = {};
  P.on = (n, f) => (listeners[n] = listeners[n] || []).push(f);
  P.emit = (n, a) => (listeners[n] || []).forEach(f => { try { f(a); } catch (err) { console.error(err); } });

  /* ---------- colours ---------- */
  P.hex2rgb = hex => { hex = hex.replace('#', ''); if (hex.length === 3) hex = hex.replace(/./g, '$&$&'); const n = parseInt(hex, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  P.rgb2hex = (r, g, b) => '#' + [r, g, b].map(v => P.clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join('').toUpperCase();
  P.rgb2hsl = (r, g, b) => {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let hu = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
      hu = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; hu /= 6; }
    return [hu, s, l];
  };
  P.hsl2rgb = (hu, s, l) => {
    if (!s) { const v = l * 255; return [v, v, v]; }
    const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q;
    const f = t => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < .5) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
    return [f(hu + 1 / 3) * 255, f(hu) * 255, f(hu - 1 / 3) * 255];
  };
  P.lum = (hex, lm, lo) => { const [r, g, b] = P.hex2rgb(hex); const [H, S, L] = P.rgb2hsl(r, g, b); const n = P.clamp(L * lm / 100 + lo / 100, 0, 1); const c = P.hsl2rgb(H, S, n); return P.rgb2hex(c[0], c[1], c[2]); };
  P.schemeNames = ['bg1', 'tx1', 'bg2', 'tx2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'];
  /* colour value grammar: '#RRGGBB' | 'accent1' | 'accent1:60,40' (lumMod,lumOff) */
  P.color = (c, th) => {
    if (!c) return 'transparent';
    if (c[0] === '#') return c;
    th = th || (P.deck && P.deck.theme);
    if (!th) return '#000000';
    const [base, mods] = c.split(':');
    const map = th.map || {};
    const key = map[base] || ({ bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' })[base] || base;
    let hex = th.colors[key] || '#000000';
    if (mods) {
      if (mods[0] === 't') hex = P.tint(hex, +mods.slice(1) / 100);
      else { const [lm, lo] = mods.split(',').map(Number); hex = P.lum(hex, lm, lo || 0); }
    }
    return hex;
  };
  /* DrawingML "tint": blends toward white in linear light (used by the built-in table styles) */
  P.tint = (hex, t) => { const lin = v => { v /= 255; return v <= .04045 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }, srgb = v => 255 * (v <= .0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - .055); const c = P.hex2rgb(hex).map(v => srgb(lin(v) * t + (1 - t))); return P.rgb2hex(c[0], c[1], c[2]); };
  P.rgba = (hex, op = 1) => { if (op >= 1) return hex; const [r, g, b] = P.hex2rgb(hex); return `rgba(${r},${g},${b},${op})`; };
  /* the 5 tints shown below each theme colour in the colour picker */
  P.tints = (name, th) => {
    const hex = P.color(name, th); const L = P.rgb2hsl(...P.hex2rgb(hex))[2];
    if (L >= .98) return [[95, 0, 'Darker 5%'], [85, 0, 'Darker 15%'], [75, 0, 'Darker 25%'], [65, 0, 'Darker 35%'], [50, 0, 'Darker 50%']];
    if (L <= .02) return [[50, 50, 'Lighter 50%'], [65, 35, 'Lighter 35%'], [75, 25, 'Lighter 25%'], [85, 15, 'Lighter 15%'], [95, 5, 'Lighter 5%']];
    if (L > .8) return [[90, 0, 'Darker 10%'], [75, 0, 'Darker 25%'], [50, 0, 'Darker 50%'], [25, 0, 'Darker 75%'], [10, 0, 'Darker 90%']];
    if (L < .2) return [[10, 90, 'Lighter 90%'], [25, 75, 'Lighter 75%'], [50, 50, 'Lighter 50%'], [75, 25, 'Lighter 25%'], [90, 10, 'Lighter 10%']];
    return [[20, 80, 'Lighter 80%'], [40, 60, 'Lighter 60%'], [60, 40, 'Lighter 40%'], [75, 0, 'Darker 25%'], [50, 0, 'Darker 50%']];
  };

  /* ---------- themes ---------- */
  const pal = (dk2, lt2, a, hl = '#0563C1', fh = '#954F72', dk1 = '#000000', lt1 = '#FFFFFF') => ({ dk1, lt1, dk2, lt2, accent1: a[0], accent2: a[1], accent3: a[2], accent4: a[3], accent5: a[4], accent6: a[5], hlink: hl, folHlink: fh });
  const rect = (x, y, w, h, fill, extra) => Object.assign({ id: P.uid(), type: 'shape', geom: 'rect', x, y, w, h, fill: fill.type ? fill : { type: 'solid', color: fill }, line: { type: 'none' }, deco: true, paras: [] }, extra);
  const shp = (geom, x, y, w, h, fill, extra) => rect(x, y, w, h, fill, Object.assign({ geom }, extra));
  const grad = (a, b, ang = 90) => ({ type: 'gradient', kind: 'linear', angle: ang, stops: [{ pos: 0, color: a }, { pos: 100, color: b }] });

  P.themes = [
    { name: 'Default', colors: pal('#44546A', '#E7E6E6', ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47']), fonts: { major: 'Calibri Light', minor: 'Calibri' } },
    { name: 'Meridian', colors: pal('#17406D', '#DBEFF9', ['#0F6FC6', '#009DD9', '#0BD0D9', '#10CF9B', '#7CCA62', '#A5C249'], '#F49100', '#85DFD0'), fonts: { major: 'Segoe UI Light', minor: 'Segoe UI' },
      decor: (w, h) => [rect(0, 0, w * .022, h, 'accent1'), rect(w * .022, 0, w * .006, h, 'accent2')],
      titleDecor: (w, h) => [rect(0, h * .62, w, h * .38, 'accent1'), rect(0, h * .6, w, h * .02, 'accent2')], titleSub: 'bg1' },
    { name: 'Ember', colors: pal('#3B2A26', '#F5EDE6', ['#C8452E', '#E58B2B', '#B7A06A', '#8C5A3C', '#6E7F5D', '#A63F5A'], '#C8452E', '#7D5A50'), fonts: { major: 'Georgia', minor: 'Calibri' },
      decor: (w, h) => [rect(0, h - 12, w, 12, 'accent1'), rect(0, h - 16, w, 4, 'accent2')],
      titleDecor: (w, h) => [rect(0, 0, w * .3, h, 'accent1'), rect(w * .3, 0, w * .01, h, 'accent2')] , titleShift: .33 },
    { name: 'Nightfall', colors: pal('#1B2233', '#E6E9F0', ['#5AA9E6', '#7FC8F8', '#F9DC5C', '#FF6392', '#9B8CFF', '#3DDC97'], '#7FC8F8', '#B9A5FF', '#FFFFFF', '#10141F'), fonts: { major: 'Segoe UI Semibold', minor: 'Segoe UI' }, map: { bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' }, darkCols: true,
      bg: grad('#10141F', '#1B2233', 45),
      decor: (w, h) => [shp('ellipse', w * .84, -h * .22, w * .3, w * .3, { type: 'solid', color: 'accent1', opacity: .14 }), shp('ellipse', w * .93, h * .22, w * .14, w * .14, { type: 'solid', color: 'accent4', opacity: .14 })] },
    { name: 'Terra', colors: pal('#3F4E36', '#EEF1E6', ['#6B8E4E', '#A4B65B', '#D9A441', '#B5651D', '#7A9E9F', '#8B6F47'], '#4F7942', '#8B6F47'), fonts: { major: 'Cambria', minor: 'Calibri' },
      decor: (w, h) => [rect(0, 0, w, h * .03, 'accent1')],
      titleDecor: (w, h) => [shp('triangle', w * .68, h * .36, w * .5, h * .72, { type: 'solid', color: 'accent1', opacity: .28 }), shp('triangle', w * .78, h * .5, w * .4, h * .56, { type: 'solid', color: 'accent2', opacity: .35 }), rect(0, 0, w, h * .03, 'accent1')] },
    { name: 'Citrus', colors: pal('#2F3B2B', '#FBF8E8', ['#F2A900', '#E8590C', '#7CB518', '#2B9EB3', '#D7263D', '#5F0F40'], '#2B9EB3', '#5F0F40'), fonts: { major: 'Trebuchet MS', minor: 'Trebuchet MS' },
      decor: (w, h) => [shp('rtTriangle', 0, h * .84, w * .16, h * .16, 'accent1'), shp('rtTriangle', 0, h * .91, w * .08, h * .09, 'accent2')],
      titleDecor: (w, h) => [shp('rtTriangle', 0, h * .5, w * .42, h * .5, 'accent1'), shp('rtTriangle', 0, h * .7, w * .24, h * .3, 'accent2')] },
    { name: 'Slate', colors: pal('#2C3E50', '#ECF0F1', ['#34495E', '#3498DB', '#1ABC9C', '#E67E22', '#9B59B6', '#E74C3C'], '#3498DB', '#9B59B6'), fonts: { major: 'Franklin Gothic Medium', minor: 'Franklin Gothic Book' },
      decor: (w, h) => [rect(0, 0, w, h * .24, 'tx2')], titleOn: 'bg1', titleDecor: (w, h) => [rect(0, 0, w, h, 'tx2'), rect(w * .125, h * .515, w * .75, 2, 'accent2')], titleOnTitle: 'bg1', subOnTitle: 'bg2' },
    { name: 'Lagoon', colors: pal('#0B3C49', '#E3F4F4', ['#14A3A8', '#2E86AB', '#F18F01', '#C73E1D', '#6CC5B0', '#3B6064'], '#2E86AB', '#6CC5B0'), fonts: { major: 'Century Gothic', minor: 'Century Gothic' },
      bg: grad('#FFFFFF', '#E3F4F4', 90),
      decor: (w, h) => [shp('wave', -w * .02, h * .9, w * 1.04, h * .16, { type: 'solid', color: 'accent1', opacity: .5 })],
      titleDecor: (w, h) => [shp('wave', -w * .02, h * .72, w * 1.04, h * .34, { type: 'solid', color: 'accent1', opacity: .55 }), shp('wave', -w * .02, h * .82, w * 1.04, h * .24, { type: 'solid', color: 'accent2', opacity: .6 })] },
    { name: 'Monolith', colors: pal('#222222', '#EDEDED', ['#111111', '#555555', '#888888', '#BBBBBB', '#D4AF37', '#8C1C13'], '#8C1C13', '#555555'), fonts: { major: 'Arial Black', minor: 'Arial' },
      decor: (w, h) => [rect(w * .069, h * .24, w * .1, 4, 'accent5')],
      titleDecor: (w, h) => [rect(0, 0, w, h, 'tx1'), rect(w * .125, h * .515, w * .2, 5, 'accent5')], titleOnTitle: 'bg1', subOnTitle: 'bg2' },
    { name: 'Blossom', colors: pal('#5B2A4E', '#FBEFF5', ['#D6457F', '#F28DB2', '#9D6BCF', '#5B8DEF', '#F4B860', '#7BC8A4'], '#9D6BCF', '#5B2A4E'), fonts: { major: 'Palatino Linotype', minor: 'Candara' },
      decor: (w, h) => [shp('ellipse', -w * .06, -w * .06, w * .16, w * .16, { type: 'solid', color: 'accent2', opacity: .4 }), shp('ellipse', w * .93, h * .84, w * .14, w * .14, { type: 'solid', color: 'accent1', opacity: .3 })],
      titleDecor: (w, h) => [shp('ellipse', -w * .12, -w * .12, w * .4, w * .4, { type: 'solid', color: 'accent2', opacity: .4 }), shp('ellipse', w * .78, h * .56, w * .34, w * .34, { type: 'solid', color: 'accent1', opacity: .3 }), shp('ellipse', w * .72, h * .46, w * .1, w * .1, { type: 'solid', color: 'accent3', opacity: .35 })] },
    { name: 'Boardroom', colors: pal('#1F3A5F', '#F2F2F2', ['#1F3A5F', '#4F6D7A', '#C0A062', '#7D8CA3', '#A23B72', '#2E8B57'], '#1F3A5F', '#7D8CA3'), fonts: { major: 'Garamond', minor: 'Calibri' },
      decor: (w, h) => [rect(0, 0, w, 10, 'tx2'), rect(0, 10, w, 2, 'accent3')],
      titleDecor: (w, h) => [rect(0, 0, w, h * .68, 'tx2'), rect(0, h * .68, w, 4, 'accent3')], titleOnTitle: 'bg1', titleBoxHigh: true },
    { name: 'Circuit', colors: pal('#00303F', '#CAE4DB', ['#00B8A9', '#F8F3D4', '#F6416C', '#FFDE7D', '#3FC1C9', '#364F6B'], '#3FC1C9', '#F6416C', '#FFFFFF', '#06202B'), fonts: { major: 'Consolas', minor: 'Segoe UI' }, darkCols: true,
      bg: { type: 'solid', color: 'bg1' },
      decor: (w, h) => [rect(0, h * .24, w * .05, 3, 'accent1'), shp('ellipse', w * .05, h * .24 - 4, 11, 11, 'accent1'), rect(w * .965, 0, 3, h, { type: 'solid', color: 'accent1', opacity: .5 })] }
  ];
  P.themeDef = name => P.themes.find(t => t.name === name) || P.themes[0];
  P.colorVariants = [
    ['Office', pal('#44546A', '#E7E6E6', ['#4472C4', '#ED7D31', '#A5A5A5', '#FFC000', '#5B9BD5', '#70AD47'])],
    ['Blue', pal('#17406D', '#DBEFF9', ['#0F6FC6', '#009DD9', '#0BD0D9', '#10CF9B', '#7CCA62', '#A5C249'], '#F49100', '#85DFD0')],
    ['Blue II', pal('#335B74', '#DFE3E5', ['#1CADE4', '#2683C6', '#27CED7', '#42BA97', '#3E8853', '#62A39F'], '#6EAC1C', '#B26B02')],
    ['Green', pal('#455F51', '#E3DED1', ['#549E39', '#8AB833', '#C0CF3A', '#029676', '#4AB5C4', '#0989B1'], '#6B9F25', '#BA6906')],
    ['Yellow', pal('#39302A', '#E5DEDB', ['#FFCA08', '#F8931D', '#CE8D3E', '#EC7016', '#E64823', '#9C6A6A'], '#2998E3', '#7F723D')],
    ['Orange', pal('#637052', '#CCDDEA', ['#E48312', '#BD582C', '#865640', '#9B8357', '#C2BC80', '#94A088'], '#2998E3', '#8C8C8C')],
    ['Red', pal('#323232', '#E5C243', ['#A5300F', '#D55816', '#E19825', '#B19C7D', '#7F5F52', '#B27D49'], '#6B9F25', '#B26B02')],
    ['Violet', pal('#373545', '#DCD8DC', ['#AD84C6', '#8784C7', '#5D739A', '#6997AF', '#84ACB6', '#6F8183'], '#69A020', '#8C8C8C')],
    ['Grayscale', pal('#000000', '#F8F8F8', ['#DDDDDD', '#B2B2B2', '#969696', '#808080', '#5F5F5F', '#4D4D4D'], '#5F5F5F', '#919191')]
  ];
  P.fontPairs = [['Calibri Light', 'Calibri'], ['Arial', 'Arial'], ['Georgia', 'Calibri'], ['Segoe UI Light', 'Segoe UI'], ['Cambria', 'Calibri'], ['Century Gothic', 'Century Gothic'], ['Garamond', 'Garamond'], ['Times New Roman', 'Arial'], ['Trebuchet MS', 'Trebuchet MS'], ['Verdana', 'Verdana'], ['Franklin Gothic Medium', 'Franklin Gothic Book'], ['Rockwell', 'Tahoma']];
  P.fonts = ['Agency FB', 'Aptos', 'Aptos Display', 'Arial', 'Arial Black', 'Arial Narrow', 'Bahnschrift', 'Book Antiqua', 'Bookman Old Style', 'Calibri', 'Calibri Light', 'Cambria', 'Cambria Math', 'Candara', 'Century', 'Century Gothic', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Ebrima', 'Franklin Gothic Book', 'Franklin Gothic Medium', 'Gabriola', 'Garamond', 'Georgia', 'Gill Sans MT', 'Haettenschweiler', 'Impact', 'Ink Free', 'Leelawadee UI', 'Lucida Console', 'Lucida Handwriting', 'Lucida Sans', 'Malgun Gothic', 'Microsoft Sans Serif', 'MS Gothic', 'Nirmala UI', 'Palatino Linotype', 'Perpetua', 'Rockwell', 'Segoe Print', 'Segoe Script', 'Segoe UI', 'Segoe UI Light', 'Segoe UI Semibold', 'Sitka Text', 'Sylfaen', 'Symbol', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Tw Cen MT', 'Verdana', 'Webdings', 'Wingdings'];

  /* ---------- paragraphs ---------- */
  P.para = (text = '', props = {}, run = {}) => Object.assign({ runs: text === '' ? [] : [Object.assign({ t: text }, run)] }, props);
  P.parasText = paras => (paras || []).map(p => (p.runs || []).map(r => r.t).join('')).join('\n');
  P.hasText = el => !!(el.paras && el.paras.some(p => (p.runs || []).some(r => r.t)));

  /* ---------- masters & layouts ---------- */
  const bodyLevels = () => [
    { size: 28, marL: 18, indent: -18, spcBef: 10, bullet: { type: 'char', char: '•' } },
    { size: 24, marL: 54, indent: -18, spcBef: 5, bullet: { type: 'char', char: '•' } },
    { size: 20, marL: 90, indent: -18, spcBef: 5, bullet: { type: 'char', char: '•' } },
    { size: 18, marL: 126, indent: -18, spcBef: 5, bullet: { type: 'char', char: '•' } },
    { size: 18, marL: 162, indent: -18, spcBef: 5, bullet: { type: 'char', char: '•' } }
  ].map(l => Object.assign(l, { font: '+mn', color: 'tx1', lineSp: .9, align: 'l' }));

  const ph = (type, idx, name, x, y, w, h, extra, prompt) => Object.assign({ id: P.uid(), type: 'shape', geom: 'rect', name, ph: { type, idx }, x, y, w, h, fill: { type: 'none' }, line: { type: 'none' }, paras: prompt ? (Array.isArray(prompt) ? prompt : [P.para(prompt)]) : [] }, extra);
  const levelPrompts = () => ['Click to edit text', 'Second level', 'Third level', 'Fourth level', 'Fifth level'].map((t, i) => P.para(t, { level: i }));
  const footers = () => [
    ph('dt', 10, 'Date Placeholder', 66, 500.5, 216, 28.75, {}, ''),
    ph('ftr', 11, 'Footer Placeholder', 318, 500.5, 324, 28.75, {}, ''),
    ph('sldNum', 12, 'Slide Number Placeholder', 678, 500.5, 216, 28.75, {}, '')
  ];

  P.buildMaster = (def, size) => {
    const W = size.w, H = size.h, sx = W / 960, sy = H / 540;
    const sc = (e) => { e.x *= sx; e.y *= sy; e.w *= sx; e.h *= sy; return e; };
    const master = {
      id: 'master', name: def.name + ' Slide Master', kind: 'master',
      bg: def.bg ? P.clone(def.bg) : { type: 'solid', color: 'bg1' },
      elements: [
        ...(def.decor ? def.decor(W, H) : []),
        sc(ph('title', 0, 'Title Placeholder', 66, 28.75, 828, 104.4, { anchor: 'ctr', fit: 'shrink' }, 'Click to edit Master title style')),
        sc(ph('body', 1, 'Text Placeholder', 66, 143.75, 828, 342.6, { anchor: 't', fit: 'shrink' }, levelPrompts())),
        ...footers().map(sc).map(e => { e.anchor = 'ctr'; e.lst = [{ size: 12, color: 'tx1:75,25', align: e.ph.type === 'dt' ? 'l' : e.ph.type === 'ftr' ? 'ctr' : 'r' }]; return e; })
      ],
      txStyles: {
        title: { size: 44, font: '+mj', color: def.titleOn || 'tx1', lineSp: .9, align: 'l', spcBef: 0 },
        body: bodyLevels(),
        other: { size: 18, font: '+mn', color: 'tx1', align: 'l' }
      }
    };
    const LP = (t, n, els, extra) => Object.assign({ id: t, type: t, name: n, kind: 'layout', elements: els }, extra);
    const fts = () => footers().map(sc).map(e => { e.paras = []; return e; });
    const O = (idx, x, y, w, hh, extra) => sc(ph('obj', idx, 'Content Placeholder', x, y, w, hh, extra, levelPrompts()));
    const onTitle = def.titleOnTitle, subOn = def.subOnTitle || def.titleSub;
    const tDecor = def.titleDecor ? def.titleDecor(W, H) : null;
    const shift = def.titleShift || 0;
    const highBox = !!def.titleBoxHigh;
    const titleEl = sc(ph('ctrTitle', 0, 'Title', shift ? 960 * shift : 120, highBox ? 120 : 88.4, shift ? 960 * (.97 - shift) : 720, highBox ? 240 : 188, { anchor: 'b', lst: [{ size: 60, align: shift ? 'l' : 'ctr', color: onTitle }] }, 'Click to edit Master title style'));
    const subEl = sc(ph('subTitle', 1, 'Subtitle', shift ? 960 * shift : 120, highBox ? 390 : 283.6, shift ? 960 * (.97 - shift) : 720, highBox ? 90 : 130.4, { anchor: 't', lst: [{ size: 24, align: shift ? 'l' : 'ctr', bullet: null, marL: 0, indent: 0, color: subOn }] }, 'Click to edit Master subtitle style'));
    const layouts = [
      LP('title', 'Title Slide', [...(tDecor || []), titleEl, subEl, ...fts()], tDecor ? { showMaster: false } : {}),
      LP('obj', 'Title and Content', [sc(ph('title', 0, 'Title', 66, 28.75, 828, 104.4, { inherit: true }, 'Click to edit Master title style')), O(1, 66, 143.75, 828, 342.6, { inherit: true }), ...fts()]),
      LP('secHead', 'Section Header', [sc(ph('title', 0, 'Title', 65.5, 134.6, 828, 224.6, { anchor: 'b', lst: [{ size: 60 }] }, 'Click to edit Master title style')), sc(ph('body', 1, 'Text Placeholder', 65.5, 361.4, 828, 118.1, { anchor: 't', lst: [{ size: 24, bullet: null, marL: 0, indent: 0, color: 'tx1:65,35' }] }, 'Click to edit Master text styles')), ...fts()]),
      LP('twoObj', 'Two Content', [sc(ph('title', 0, 'Title', 66, 28.75, 828, 104.4, { inherit: true }, 'Click to edit Master title style')), O(1, 66, 143.75, 408, 342.6), O(2, 486, 143.75, 408, 342.6), ...fts()]),
      LP('twoTxTwoObj', 'Comparison', [sc(ph('title', 0, 'Title', 67.25, 28.75, 828, 104.4, {}, 'Click to edit Master title style')),
        sc(ph('body', 1, 'Text Placeholder', 67.25, 132.4, 406, 64.9, { anchor: 'b', lst: [{ size: 24, bold: true, bullet: null, marL: 0, indent: 0 }] }, 'Click to edit Master text styles')), O(2, 67.25, 197.25, 406, 290.1),
        sc(ph('body', 3, 'Text Placeholder', 486, 132.4, 408, 64.9, { anchor: 'b', lst: [{ size: 24, bold: true, bullet: null, marL: 0, indent: 0 }] }, 'Click to edit Master text styles')), O(4, 486, 197.25, 408, 290.1), ...fts()]),
      LP('titleOnly', 'Title Only', [sc(ph('title', 0, 'Title', 66, 28.75, 828, 104.4, { inherit: true }, 'Click to edit Master title style')), ...fts()]),
      LP('blank', 'Blank', fts()),
      LP('objTx', 'Content with Caption', [sc(ph('title', 0, 'Title', 67.25, 36, 309.6, 126, { anchor: 'b', lst: [{ size: 32 }] }, 'Click to edit Master title style')), O(1, 408, 77.75, 486, 383.75), sc(ph('body', 2, 'Text Placeholder', 67.25, 162, 309.6, 300, { lst: [{ size: 16, bullet: null, marL: 0, indent: 0 }] }, 'Click to edit Master text styles')), ...fts()]),
      LP('picTx', 'Picture with Caption', [sc(ph('title', 0, 'Title', 67.25, 36, 309.6, 126, { anchor: 'b', lst: [{ size: 32 }] }, 'Click to edit Master title style')), sc(ph('pic', 1, 'Picture Placeholder', 408, 77.75, 486, 383.75, {}, 'Click icon to add picture')), sc(ph('body', 2, 'Text Placeholder', 67.25, 162, 309.6, 300, { lst: [{ size: 16, bullet: null, marL: 0, indent: 0 }] }, 'Click to edit Master text styles')), ...fts()])
    ];
    /* a level-1 override written once applies to every list level of that placeholder */
    layouts.forEach(l => l.elements.forEach(e => { if (e.ph && e.lst && e.lst.length === 1) e.lst = [0, 1, 2, 3, 4].map(() => Object.assign({}, e.lst[0])); }));
    /* layouts that simply inherit geometry from the master: drop the copied box */
    layouts.forEach(l => l.elements.forEach(e => { if (e.inherit) { delete e.x; delete e.y; delete e.w; delete e.h; delete e.inherit; } }));
    return { master, layouts };
  };

  P.makeTheme = def => ({ name: def.name, colors: P.clone(def.colors), fonts: P.clone(def.fonts), map: def.map ? P.clone(def.map) : undefined, def: def.name });

  P.newDeck = (themeName = 'Default', size = { w: 960, h: 540 }) => {
    const def = P.themeDef(themeName);
    const { master, layouts } = P.buildMaster(def, size);
    const deck = { title: 'Presentation1', size, theme: P.makeTheme(def), master, layouts, slides: [], sections: [], customShows: [], media: {},
      props: { author: '', subject: '', keywords: '', comments: '', created: new Date().toISOString() },
      showCfg: { type: 'presenter', loop: false, useTimings: true, presenterView: true, penColor: '#FF0000', showFrom: null, showTo: null, custom: null } };
    return deck;
  };

  P.newSlide = (layoutId, deck = P.deck) => {
    const lay = deck.layouts.find(l => l.id === layoutId) || deck.layouts[1] || deck.layouts[0];
    const s = { id: P.uid('s'), layout: lay.id, elements: [], animations: [], comments: [], notes: '', transition: null, hidden: false };
    let n = 2;
    lay.elements.filter(e => e.ph && !['dt', 'ftr', 'sldNum'].includes(e.ph.type)).forEach(e => {
      const isTitle = /title/i.test(e.ph.type) && e.ph.type !== 'subTitle';
      s.elements.push({ id: P.uid(), type: 'shape', geom: 'rect', name: (isTitle ? 'Title ' : (e.ph.type === 'pic' ? 'Picture Placeholder ' : e.ph.type === 'subTitle' ? 'Subtitle ' : 'Content Placeholder ')) + (n++), ph: { type: e.ph.type, idx: e.ph.idx }, paras: [] });
    });
    return s;
  };

  /* ---------- page access & inheritance ---------- */
  P.S = { cur: 0, sel: [], view: 'normal', zoom: null, master: null, editing: null, showNotes: true, ruler: false, grid: false, guides: false, snap: true };
  P.page = () => {
    if (P.S.view === 'master') {
      const id = P.S.master || 'master';
      return id === 'master' ? P.deck.master : P.deck.layouts.find(l => l.id === id) || P.deck.master;
    }
    return P.deck.slides[P.S.cur];
  };
  P.layoutOf = (slide, deck = P.deck) => deck.layouts.find(l => l.id === slide.layout) || deck.layouts[0];
  P.walk = (els, fn, parent) => { (els || []).forEach(e => { fn(e, parent); if (e.children) P.walk(e.children, fn, e); }); };
  P.findEl = (id, page = P.page()) => { let f = null; if (!page) return null; P.walk(page.elements, e => { if (e.id === id) f = e; }); return f; };
  P.parentOf = (id, page = P.page()) => { let f = null; P.walk(page.elements, (e, par) => { if (e.id === id) f = par || null; }); return f; };
  P.siblings = (id, page = P.page()) => { const p = P.parentOf(id, page); return p ? p.children : page.elements; };
  const altType = { ctrTitle: 'title', title: 'ctrTitle', subTitle: 'body', body: 'subTitle', obj: 'body' };
  const findPh = (els, ph) => {
    const list = els.filter(e => e.ph);
    if (['title', 'ctrTitle'].includes(ph.type)) return list.find(e => ['title', 'ctrTitle'].includes(e.ph.type));
    if (['dt', 'ftr', 'sldNum'].includes(ph.type)) return list.find(e => e.ph.type === ph.type);
    if (ph.idx != null) { const m = list.find(e => e.ph.idx === ph.idx); if (m) return m; }
    return list.find(e => e.ph.type === ph.type) || list.find(e => e.ph.type === altType[ph.type]);
  };
  const masterPh = (ph, deck) => {
    const els = deck.master.elements.filter(e => e.ph);
    if (['title', 'ctrTitle'].includes(ph.type)) return els.find(e => e.ph.type === 'title');
    if (['dt', 'ftr', 'sldNum'].includes(ph.type)) return els.find(e => e.ph.type === ph.type);
    return els.find(e => e.ph.type === 'body');
  };
  /* returns chain from most generic to most specific ancestors of a placeholder */
  P.phChain = (el, page, deck = P.deck) => {
    if (!el.ph || !page) return [];
    const chain = [];
    if (page.kind === 'master') return chain;
    if (page.kind === 'layout') { const m = masterPh(el.ph, deck); if (m) chain.push(m); return chain; }
    const lay = P.layoutOf(page, deck); const le = lay && findPh(lay.elements, el.ph);
    if (le) { const m = masterPh(le.ph, deck); if (m) chain.push(m); chain.push(le); }
    else { const m = masterPh(el.ph, deck); if (m) chain.push(m); }
    return chain;
  };
  P.box = (el, page = P.page(), deck = P.deck) => {
    if (el.x !== undefined) return { x: el.x, y: el.y, w: el.w, h: el.h };
    const ch = P.phChain(el, page, deck);
    for (let i = ch.length - 1; i >= 0; i--) if (ch[i].x !== undefined) return { x: ch[i].x, y: ch[i].y, w: ch[i].w, h: ch[i].h };
    return { x: 100, y: 100, w: 300, h: 100 };
  };
  P.setBox = (el, b) => { el.x = b.x; el.y = b.y; el.w = b.w; el.h = b.h; };
  /* resolve a body property (anchor / ins / fit / wrap ...) through the placeholder chain */
  P.bodyProp = (el, key, page = P.page(), deck = P.deck, dflt) => {
    if (el[key] !== undefined) return el[key];
    const ch = P.phChain(el, page, deck);
    for (let i = ch.length - 1; i >= 0; i--) if (ch[i][key] !== undefined) return ch[i][key];
    return dflt;
  };
  /* effective paragraph-level text style (without paragraph & run overrides) */
  P.baseStyle = (el, level, page = P.page(), deck = P.deck) => {
    const m = deck.master.txStyles; level = level || 0;
    let st;
    if (el.ph && ['title', 'ctrTitle'].includes(el.ph.type)) st = Object.assign({}, m.title);
    else if (el.ph && !['dt', 'ftr', 'sldNum'].includes(el.ph.type)) st = Object.assign({}, m.body[Math.min(level, m.body.length - 1)]);
    else st = Object.assign({}, m.other);
    if (!st.size) st.size = 18;
    /* list styles match by exact level, as in DrawingML; plain shapes keep one style for all levels */
    P.phChain(el, page, deck).forEach(a => { if (a.lst && a.lst[level]) mergeDef(st, a.lst[level]); });
    if (el.lst) { const l = el.ph ? el.lst[level] : (el.lst[Math.min(level, el.lst.length - 1)] || el.lst[0]); if (l) mergeDef(st, l); }
    return st;
  };
  const mergeDef = (a, b) => { for (const k in b) if (b[k] !== undefined) a[k] = b[k]; return a; };
  P.fontName = (f, deck = P.deck) => { if (!f) return deck.theme.fonts.minor; if (f === '+mj') return deck.theme.fonts.major; if (f === '+mn') return deck.theme.fonts.minor; return f; };

  /* Image.decode() can stall while the window isn't drawing, so wait on the load event instead */
  P.loadImage = url => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error('Could not load image')); im.src = url; });

  /* ---------- media store ---------- */
  P.addMedia = (blob, name, deck = P.deck) => {
    const id = P.uid('m');
    deck.media[id] = { id, blob, name: name || id, mime: blob.type, url: URL.createObjectURL(blob) };
    return id;
  };
  P.mediaUrl = (src, deck = P.deck) => { if (!src) return ''; if (src.startsWith('media:')) { const m = deck.media[src.slice(6)]; return m ? m.url : ''; } return src; };
  P.blobToDataUrl = blob => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(blob); });
  P.mediaData = async (src, deck = P.deck) => { if (!src) return ''; if (!src.startsWith('media:')) return src; const m = deck.media[src.slice(6)]; if (!m) return ''; if (!m.data) m.data = await P.blobToDataUrl(m.blob); return m.data; };
  P.fromDataUrl = (url) => { const [hd, b] = url.split(','); const mime = (hd.match(/data:([^;]+)/) || [])[1] || 'application/octet-stream'; const bin = atob(b); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new Blob([u], { type: mime }); };

  /* ---------- history ---------- */
  const H = { stack: [], i: -1, cap: 150 };
  const snap = () => { const { media, ...rest } = P.deck; return JSON.stringify({ d: rest, cur: P.S.cur, sel: P.S.sel, view: P.S.view, master: P.S.master }); };
  P.resetHistory = () => { H.stack = [{ label: 'Open', s: snap() }]; H.i = 0; P.emit('history'); };
  P.commit = (label = 'Edit', opts = {}) => {
    const s = snap();
    if (H.stack[H.i] && H.stack[H.i].s === s) { if (!opts.silent) P.emit('change', opts); return; }
    H.stack.length = H.i + 1; H.stack.push({ label, s }); if (H.stack.length > H.cap) H.stack.shift(); H.i = H.stack.length - 1;
    P.dirty = true; P.emit('history'); P.emit('dirty');
    if (!opts.silent) P.emit('change', opts);
  };
  const restore = e => {
    const o = JSON.parse(e.s); const media = P.deck.media;
    P.deck = Object.assign(o.d, { media });
    P.S.cur = Math.min(o.cur, P.deck.slides.length - 1); P.S.sel = o.sel; P.S.view = o.view; P.S.master = o.master; P.S.editing = null;
    P.dirty = true; P.emit('history'); P.emit('dirty'); P.emit('change', { all: true, history: true });
  };
  P.canUndo = () => H.i > 0; P.canRedo = () => H.i < H.stack.length - 1;
  P.undoLabel = () => (P.canUndo() ? H.stack[H.i].label : ''); P.redoLabel = () => (P.canRedo() ? H.stack[H.i + 1].label : '');
  P.undo = () => { if (P.endText) P.endText(); if (P.canUndo()) { H.i--; restore(H.stack[H.i]); } };
  P.redo = () => { if (P.endText) P.endText(); if (P.canRedo()) { H.i++; restore(H.stack[H.i]); } };

  /* ---------- apply theme / variants (keeps slide content) ---------- */
  P.applyTheme = (name, keepColors) => {
    const def = P.themeDef(name), deck = P.deck;
    const { master, layouts } = P.buildMaster(def, deck.size);
    const old = deck.layouts;
    deck.theme = P.makeTheme(def);
    deck.master = master; deck.layouts = layouts;
    deck.slides.forEach(s => {
      const o = old.find(l => l.id === s.layout);
      const t = o && (layouts.find(l => l.id === o.id) || layouts.find(l => l.type === o.type) || layouts.find(l => l.name === o.name));
      s.layout = t ? t.id : 'obj';
    });
  };

  /* changing slide size: rescale everything */
  P.resizeDeck = (w, h, mode = 'fit') => {
    const d = P.deck, sx = w / d.size.w, sy = h / d.size.h;
    const s = mode === 'max' ? Math.max(sx, sy) : Math.min(sx, sy);
    const ox = (w - d.size.w * s) / 2, oy = (h - d.size.h * s) / 2;
    const scaleEl = (e, top) => { if (e.x === undefined) return; if (top) { e.x = e.x * s + ox; e.y = e.y * s + oy; } else { e.x *= s; e.y *= s; } e.w *= s; e.h *= s; if (e.children) e.children.forEach(c => scaleEl(c, false)); };
    d.slides.forEach(sl => sl.elements.forEach(e => scaleEl(e, true)));
    const scalePage = pg => pg.elements.forEach(e => { if (e.x === undefined) return; e.x *= sx; e.y *= sy; e.w *= sx; e.h *= sy; });
    scalePage(d.master); d.layouts.forEach(scalePage);
    d.size = { w, h };
  };
})(window.P);
