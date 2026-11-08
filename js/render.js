/* Podium - turns the model into DOM. The same renderer drives the editor, thumbnails, slide show and export. */
(function (P) {
  'use strict';
  let gid = 0;
  const nid = () => 'g' + (++gid) + '_' + (Math.random() * 1e5 | 0);

  P.slideCSS = `
  .pg{position:relative;overflow:hidden;background:#fff;color:#000;transform-origin:0 0;font-kerning:normal;text-rendering:geometricPrecision;-webkit-font-smoothing:antialiased}
  .pg.bleed{overflow:visible}
  .pg-bg{position:absolute;inset:0;background-size:cover;background-position:center}
  .pg .el{position:absolute;box-sizing:border-box}
  .pg .geo{position:absolute;left:0;top:0;overflow:visible;width:100%;height:100%;pointer-events:none}
  .pg .tb{position:absolute;display:flex;flex-direction:column;box-sizing:border-box;min-width:0}
  .pg .tbi{outline:none;min-height:1em;width:100%;word-break:break-word;overflow-wrap:break-word;white-space:pre-wrap;cursor:inherit}
  .pg .p{position:relative;margin:0;min-height:1em}
  .pg .p[data-bu]::before{content:attr(data-bu);position:absolute;left:var(--bl,0);top:0;color:var(--bc,inherit);font-family:var(--bf,inherit);font-size:var(--bs,1em);font-style:normal;font-weight:normal;text-decoration:none;text-indent:0;line-height:inherit;white-space:nowrap}
  .pg .r a,.pg a.r{color:inherit;text-decoration:inherit}
  .pg .imw{position:absolute;inset:0;overflow:hidden}
  .pg .imw img{position:absolute;display:block;max-width:none;pointer-events:none;user-select:none;-webkit-user-drag:none}
  .pg table.tbl{border-collapse:collapse;table-layout:fixed;position:absolute;left:0;top:0;width:100%}
  .pg table.tbl td{box-sizing:border-box;padding:0;position:relative;vertical-align:top;overflow:hidden}
  .pg .cell{display:flex;flex-direction:column;box-sizing:border-box;width:100%;height:100%}
  .pg .kids{position:absolute;inset:0}
  .pg .chart{position:absolute;inset:0;overflow:hidden}
  .pg .media-face{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;overflow:hidden}
  .pg .media-face video,.pg .media-face img{width:100%;height:100%;object-fit:contain;display:block}
  .pg .audio-face{background:transparent;color:inherit}
  `;

  /* ---------- paint helpers ---------- */
  const dashes = { solid: null, sysDot: [1, 1], sysDash: [3, 1], dash: [4, 3], dashDot: [4, 3, 1, 3], lgDash: [8, 3], lgDashDot: [8, 3, 1, 3], lgDashDotDot: [8, 3, 1, 3, 1, 3] };
  const patterns = {
    pct5: '<circle cx="1" cy="1" r=".5" fill="F"/>', pct20: '<circle cx="1" cy="1" r=".9" fill="F"/><circle cx="3" cy="3" r=".9" fill="F"/>',
    pct50: '<rect width="2" height="2" fill="F"/><rect x="2" y="2" width="2" height="2" fill="F"/>',
    ltHorz: '<rect y="0" width="4" height="1" fill="F"/>', dkHorz: '<rect y="0" width="4" height="2" fill="F"/>', ltVert: '<rect x="0" width="1" height="4" fill="F"/>', dkVert: '<rect x="0" width="2" height="4" fill="F"/>',
    ltUpDiag: '<path d="M0 4L4 0" stroke="F"/>', dkUpDiag: '<path d="M0 4L4 0" stroke="F" stroke-width="1.8"/>', ltDnDiag: '<path d="M0 0L4 4" stroke="F"/>', dkDnDiag: '<path d="M0 0L4 4" stroke="F" stroke-width="1.8"/>',
    smGrid: '<path d="M0 0H4M0 0V4" stroke="F"/>', lgCheck: '<rect width="2" height="2" fill="F"/><rect x="2" y="2" width="2" height="2" fill="F"/>', diagCross: '<path d="M0 0L4 4M0 4L4 0" stroke="F" stroke-width=".7"/>'
  };
  P.patternNames = Object.keys(patterns);
  const adjustShade = (hex, k) => { if (!k || k === 1) return hex; const [r, g, b] = P.hex2rgb(hex); const c = v => (k > 1 ? v + (255 - v) * (k - 1) : v * k); return P.rgb2hex(c(r), c(g), c(b)); };

  /* returns {paint, opacity} and appends to defs string list when necessary */
  function svgPaint(fill, defs, ctx, shade) {
    if (!fill || fill.type === 'none') return { paint: 'none', op: 1 };
    const col = c => adjustShade(P.color(c, ctx.deck.theme), shade);
    if (fill.type === 'solid') return { paint: col(fill.color), op: fill.opacity == null ? 1 : fill.opacity };
    if (fill.type === 'gradient') {
      const id = nid(); const stops = (fill.stops || []).map(s => `<stop offset="${s.pos}%" stop-color="${col(s.color)}" stop-opacity="${s.opacity == null ? 1 : s.opacity}"/>`).join('');
      /* PowerPoint blends gradient colours in linear light, which keeps midpoints bright */
      if (fill.kind === 'radial' || fill.kind === 'path') defs.push(`<radialGradient id="${id}" color-interpolation="linearRGB" cx="${fill.cx == null ? 50 : fill.cx}%" cy="${fill.cy == null ? 50 : fill.cy}%" r="70%">${stops}</radialGradient>`);
      else defs.push(`<linearGradient id="${id}" color-interpolation="linearRGB" gradientTransform="rotate(${fill.angle || 0} .5 .5)">${stops}</linearGradient>`);
      return { paint: `url(#${id})`, op: 1 };
    }
    if (fill.type === 'picture') {
      const id = nid(), url = P.mediaUrl(fill.src, ctx.deck);
      if (fill.tile) defs.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" width="${fill.tw || 64}" height="${fill.th || 64}"><image href="${url}" width="${fill.tw || 64}" height="${fill.th || 64}" opacity="${fill.opacity == null ? 1 : fill.opacity}"/></pattern>`);
      else defs.push(`<pattern id="${id}" patternContentUnits="objectBoundingBox" width="1" height="1"><image href="${url}" width="1" height="1" preserveAspectRatio="none" opacity="${fill.opacity == null ? 1 : fill.opacity}"/></pattern>`);
      return { paint: `url(#${id})`, op: 1 };
    }
    if (fill.type === 'pattern') {
      const id = nid(), fg = col(fill.fg || 'tx1'), bg = col(fill.bg || 'bg1'), body = (patterns[fill.preset] || patterns.pct50).replace(/"F"/g, `"${fg}"`);
      defs.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" width="4" height="4"><rect width="4" height="4" fill="${bg}"/>${body}</pattern>`);
      return { paint: `url(#${id})`, op: 1 };
    }
    return { paint: 'none', op: 1 };
  }
  /* CSS background for slide backgrounds and swatches */
  P.fillCss = (fill, deck = P.deck) => {
    if (!fill || fill.type === 'none') return 'transparent';
    if (fill.type === 'solid') return P.rgba(P.color(fill.color, deck.theme), fill.opacity == null ? 1 : fill.opacity);
    if (fill.type === 'gradient') { const st = (fill.stops || []).map(s => `${P.rgba(P.color(s.color, deck.theme), s.opacity == null ? 1 : s.opacity)} ${s.pos}%`).join(','); if (fill.kind === 'radial' || fill.kind === 'path') return `radial-gradient(circle at ${fill.cx == null ? 50 : fill.cx}% ${fill.cy == null ? 50 : fill.cy}%,${st})`; return `linear-gradient(${(fill.angle || 0) + 90}deg,${st})`; }
    if (fill.type === 'picture') return `url("${P.mediaUrl(fill.src, deck)}") center/${fill.tile ? 'auto' : '100% 100%'} ${fill.tile ? 'repeat' : 'no-repeat'}`;
    if (fill.type === 'pattern') return P.color(fill.bg || 'bg1', deck.theme);
    return 'transparent';
  };
  /* CSS filter string for shape/picture effects */
  P.fxFilter = (fx, deck) => {
    if (!fx) return '';
    const out = [];
    if (fx.soft && fx.soft.rad) out.push(`blur(${fx.soft.rad / 2.5}px)`);
    if (fx.glow && fx.glow.rad) { const c = P.rgba(P.color(fx.glow.color || 'accent1', deck.theme), fx.glow.opacity == null ? .6 : fx.glow.opacity); out.push(`drop-shadow(0 0 ${fx.glow.rad * .5}px ${c})`, `drop-shadow(0 0 ${fx.glow.rad * .5}px ${c})`); }
    if (fx.shadow && !fx.shadow.inner) { const s = fx.shadow, t = (s.dir || 0) * Math.PI / 180, d = s.dist || 0; out.push(`drop-shadow(${(Math.cos(t) * d).toFixed(2)}px ${(Math.sin(t) * d).toFixed(2)}px ${(s.blur || 0) * .6}px ${P.rgba(P.color(s.color || '#000000', deck.theme), s.opacity == null ? .4 : s.opacity)})`); }
    return out.join(' ');
  };
  function applyFx(node, fx, ctx) {
    if (!fx) return;
    const fl = P.fxFilter(fx, ctx.deck);
    if (fl) node.style.filter = fl;
    if (fx.reflect) { const r = fx.reflect; node.style.webkitBoxReflect = `below ${r.dist || 2}px linear-gradient(transparent ${100 - (r.size || 50)}%, rgba(0,0,0,${r.opacity == null ? .4 : r.opacity}))`; }
  }

  const markerShapes = {
    triangle: 'M0 0L10 5L0 10Z', stealth: 'M0 0L10 5L0 10L3 5Z', diamond: 'M0 5L5 0L10 5L5 10Z', oval: 'M5 0A5 5 0 1 1 5 10A5 5 0 1 1 5 0Z', arrow: 'M1 0L9 5L1 10'
  };
  function marker(end, defs, color, width, isStart) {
    if (!end || !end.type || end.type === 'none') return '';
    const id = nid(), sz = { sm: 2, med: 3, lg: 5 }[end.size || 'med'] * Math.max(.8, width < 2 ? 1 : 1);
    const open = end.type === 'arrow';
    defs.push(`<marker id="${id}" viewBox="-1 -1 12 12" refX="${isStart ? (end.type === 'oval' || end.type === 'diamond' ? 5 : 1) : (end.type === 'oval' || end.type === 'diamond' ? 5 : 9)}" refY="5" markerWidth="${sz + 1}" markerHeight="${sz + 1}" orient="${isStart ? 'auto-start-reverse' : 'auto'}" markerUnits="strokeWidth"><path d="${markerShapes[end.type] || markerShapes.triangle}" fill="${open ? 'none' : color}" stroke="${open ? color : 'none'}" stroke-width="${open ? 1.8 : 0}"/></marker>`);
    return id;
  }

  /* inscribed text rectangle for the common geometries */
  const textInset = (g, w, h, a) => {
    const c = (l, t, r, b) => [w * l, h * t, w * r, h * b];
    switch (g) {
      case 'ellipse': case 'flowChartConnector': case 'flowChartOr': case 'flowChartSummingJunction': return c(.1464, .1464, .1464, .1464);
      case 'diamond': case 'flowChartDecision': case 'flowChartSort': return c(.25, .25, .25, .25);
      case 'triangle': return c(.25, .5, .25, 0);
      case 'rtTriangle': return c(.08, .5, .5, 0);
      case 'hexagon': return c(.17, .17, .17, .17);
      case 'pentagon': return c(.19, .3, .19, 0);
      case 'octagon': return c(.09, .09, .09, .09);
      case 'parallelogram': return c(.17, 0, .17, 0);
      case 'trapezoid': return c(.2, .1, .2, 0);
      case 'roundRect': { const r = Math.min(w, h) * ((a && a[0] != null ? a[0] : 16667) / 100000) * .29; return [r, r, r, r]; }
      case 'star5': return c(.3, .38, .3, .2);
      case 'star4': return c(.3, .3, .3, .3);
      case 'heart': return c(.2, .2, .2, .3);
      case 'cloud': return c(.15, .2, .15, .2);
      case 'chevron': case 'homePlate': return [g === 'chevron' ? Math.min(w, h) * .5 : 0, 0, Math.min(w, h) * .5, 0];
      case 'wedgeEllipseCallout': return c(.15, .15, .15, .15);
      case 'can': return [0, Math.min(w, h) * .25, 0, 0];
      case 'cube': return [0, Math.min(w, h) * .25, Math.min(w, h) * .25, 0];
      case 'flowChartTerminator': return c(.1, .1, .1, .1);
      default: return [0, 0, 0, 0];
    }
  };

  /* ---------- text ---------- */
  const hasSymbolFonts = /win/i.test(navigator.platform || navigator.userAgent);
  const wing = { '§': '■', 'Ø': '➢', 'ü': '✓', 'v': '❖', 'q': '❑', 'n': '■', 'l': '●', 'o': '□', 'à': '→', 'è': '➔', 'Ü': '➔', '': '■', '': '✓', '': '➢' };
  const roman = n => { const m = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']]; let r = ''; m.forEach(([v, s]) => { while (n >= v) { r += s; n -= v; } }); return r; };
  const alpha = n => { let s = ''; while (n > 0) { n--; s = String.fromCharCode(65 + n % 26) + s; n = Math.floor(n / 26); } return s; };
  P.numLabel = (style, n) => {
    const m = /^(arabic|romanUc|romanLc|alphaUc|alphaLc)(.*)$/.exec(style || 'arabicPeriod') || [0, 'arabic', 'Period'];
    let s = m[1] === 'arabic' ? String(n) : m[1] === 'romanUc' ? roman(n) : m[1] === 'romanLc' ? roman(n).toLowerCase() : m[1] === 'alphaUc' ? alpha(n) : alpha(n).toLowerCase();
    return m[2] === 'ParenR' ? s + ')' : m[2] === 'ParenBoth' ? '(' + s + ')' : m[2] === 'Plain' ? s : s + '.';
  };

  const fieldText = (r, ctx) => {
    if (r.field === 'slidenum') return ctx.slideNo != null ? String(ctx.slideNo) : '‹#›';
    if (r.field && r.field.startsWith('datetime')) {
      const d = new Date(), n = r.field.slice(8);
      const opts = { 1: { dateStyle: 'short' }, 2: { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }, 3: { day: 'numeric', month: 'long', year: 'numeric' }, 4: { month: 'long', day: 'numeric', year: 'numeric' }, 10: { timeStyle: 'short' }, 11: { timeStyle: 'medium' } }[n] || { dateStyle: 'short' };
      return d.toLocaleString(undefined, opts);
    }
    return r.t;
  };

  /* Effective run CSS */
  P.runCss = (r, st, scale, ctx) => {
    const size = (r.size != null ? r.size : st.size) * scale;
    const s = { fontFamily: `"${P.fontName(r.font || st.font, ctx.deck)}",sans-serif`, fontSize: size + 'px' };
    const b = r.b != null ? r.b : st.bold, i = r.i != null ? r.i : st.italic, u = r.u != null ? r.u : st.u, st2 = r.s;
    if (b) s.fontWeight = 'bold'; else s.fontWeight = 'normal';
    if (i) s.fontStyle = 'italic';
    const dec = []; if (u) dec.push('underline'); if (st2) dec.push('line-through');
    let color = P.color(r.color || st.color || 'tx1', ctx.deck.theme);
    if (r.link) { color = r.color ? color : P.color('hlink', ctx.deck.theme); if (!dec.includes('underline')) dec.push('underline'); }
    if (dec.length) s.textDecoration = dec.join(' ');
    s.color = color;
    if (r.opacity != null) s.opacity = r.opacity;
    if (r.base) { s.verticalAlign = r.base > 0 ? 'super' : 'sub'; s.fontSize = size * .66 + 'px'; }
    const spc = r.spc != null ? r.spc : st.spc, cap = r.cap || st.cap;
    if (spc) s.letterSpacing = spc + 'px';
    if (cap === 'all') s.textTransform = 'uppercase'; else if (cap === 'small') s.fontVariant = 'small-caps';
    if (r.hl) s.backgroundColor = P.color(r.hl, ctx.deck.theme);
    const shadows = [];
    if (r.shadow) { const c = typeof r.shadow === 'object' ? r.shadow : { color: '#000000', dist: 1.5, dir: 45, blur: 2, opacity: .5 }, t = (c.dir || 45) * Math.PI / 180; shadows.push(`${(Math.cos(t) * (c.dist || 1.5)).toFixed(1)}px ${(Math.sin(t) * (c.dist || 1.5)).toFixed(1)}px ${c.blur == null ? 2 : c.blur}px ${P.rgba(P.color(c.color || '#000000', ctx.deck.theme), c.opacity == null ? .5 : c.opacity)}`); }
    if (r.glow) shadows.push(`0 0 ${r.glow.rad || 6}px ${P.color(r.glow.color || 'accent1', ctx.deck.theme)}`, `0 0 ${(r.glow.rad || 6) * 1.5}px ${P.color(r.glow.color || 'accent1', ctx.deck.theme)}`);
    if (shadows.length) s.textShadow = shadows.join(',');
    if (r.outline) { s.webkitTextStroke = `${r.outline.w || 1}px ${P.color(r.outline.color || 'tx1', ctx.deck.theme)}`; }
    if (r.tfill) {
      if (r.tfill.type === 'none') s.color = 'transparent';
      else if (r.tfill.type === 'gradient') { s.backgroundImage = P.fillCss(r.tfill, ctx.deck); s.webkitBackgroundClip = 'text'; s.backgroundClip = 'text'; s.color = 'transparent'; }
    }
    return s;
  };

  const runKeys = ['b', 'i', 'u', 's', 'color', 'size', 'font', 'link', 'base', 'spc', 'cap', 'hl', 'shadow', 'glow', 'outline', 'tfill', 'field', 'lang', 'opacity'];
  P.runProps = r => { const o = {}; runKeys.forEach(k => { if (r[k] !== undefined) o[k] = r[k]; }); return o; };

  P.renderParas = (paras, el, ctx, opts = {}) => {
    const out = []; const counters = [];
    const scale = (el.fontScale || 100) / 100, reduc = (el.lnReduc || 0) / 100;
    (paras && paras.length ? paras : [P.para('')]).forEach((para, i) => {
      const lvl = para.level || 0; const st = P.baseStyle(el, lvl, ctx.page, ctx.deck);
      if (ctx.cellStyle) Object.assign(st, ctx.cellStyle);
      ['align', 'marL', 'indent', 'lineSp', 'spcBef', 'spcAft', 'lineSpPt', 'rtl'].forEach(k => { if (para[k] !== undefined) st[k] = para[k]; });
      const bullet = para.bullet !== undefined ? para.bullet : st.bullet;
      const runs = para.runs || [];
      const first = runs[0] || para.end || {};
      const pSize = (first.size != null ? first.size : st.size) * scale;
      const d = h('div', { class: 'p' });
      d.dataset.pp = JSON.stringify(Object.fromEntries(Object.entries(para).filter(([k]) => k !== 'runs')));
      const ss = d.style;
      ss.textAlign = { l: 'left', ctr: 'center', r: 'right', just: 'justify', dist: 'justify' }[st.align || 'l'];
      ss.fontSize = pSize + 'px';
      ss.fontFamily = `"${P.fontName(first.font || st.font, ctx.deck)}",sans-serif`;
      if (st.lineSpPt) ss.lineHeight = st.lineSpPt * scale + 'px'; else ss.lineHeight = String(Math.max(.6, 1.2 * (st.lineSp || 1) - reduc));
      if (st.spcBef) ss.marginTop = (i === 0 && !opts.keepFirst ? 0 : st.spcBef * (el.fontScale ? (100 - (100 - el.fontScale) * .5) / 100 : 1)) + 'px';
      if (st.spcAft) ss.marginBottom = st.spcAft + 'px';
      const marL = (st.marL || 0) * (el.fontScale ? Math.max(.75, scale) : 1), ind = (st.indent || 0) * (el.fontScale ? Math.max(.75, scale) : 1);
      const hasBullet = bullet && bullet.type;
      const showBullet = hasBullet && (runs.some(r => r.t) || opts.editing);
      ss.paddingLeft = marL + 'px';
      if (hasBullet) { ss.setProperty('--bl', (marL + ind) + 'px'); }
      else if (ind) ss.textIndent = ind + 'px';
      if (st.rtl) ss.direction = 'rtl';
      /* bullet */
      if (hasBullet) {
        if (bullet.type === 'num') {
          counters.length = lvl + 1;
          counters[lvl] = (counters[lvl] && counters[lvl].style === bullet.style) ? { n: counters[lvl].n + 1, style: bullet.style } : { n: bullet.start || 1, style: bullet.style };
          if (showBullet) d.dataset.bu = P.numLabel(bullet.style, counters[lvl].n);
        } else {
          counters.length = lvl;
          let c = bullet.char || '•'; const symbolFont = /wingdings|webdings|symbol/i.test(bullet.font || '');
          if (symbolFont && hasSymbolFonts) {
            /* symbol fonts map glyphs into the private use area at U+F0xx */
            const code = c.codePointAt(0); if (code < 256) c = String.fromCharCode(0xF000 + code);
            ss.setProperty('--bf', `"${bullet.font}"`);
          } else {
            if (symbolFont) c = wing[c] || wing[String.fromCharCode(c.charCodeAt(0) & 0xFF)] || '•';
            ss.setProperty('--bf', bullet.font && !symbolFont ? `"${bullet.font}"` : 'Arial');
          }
          if (showBullet) d.dataset.bu = c;
        }
        const fc = first.color || st.color;
        ss.setProperty('--bc', P.color(bullet.color || fc || 'tx1', ctx.deck.theme));
        if (bullet.sizePct) ss.setProperty('--bs', (bullet.sizePct / 100) + 'em');
      } else counters.length = 0;
      /* runs */
      if (!runs.length || !runs.some(r => r.t)) {
        const sp = h('span', { class: 'r' }); const e = para.end || runs[0] || {};
        Object.assign(sp.style, P.runCss(e, st, scale, ctx)); sp.dataset.r = JSON.stringify(P.runProps(e));
        sp.append(h('br')); d.append(sp);
      } else {
        runs.forEach(r => {
          if (!r.t) return;
          const sp = h('span', { class: 'r' });
          Object.assign(sp.style, P.runCss(r, st, scale, ctx));
          sp.dataset.r = JSON.stringify(P.runProps(r));
          const txt = fieldText(r, ctx);
          const parts = txt.split('\n');
          parts.forEach((pt, ix) => { if (ix) sp.append(h('br')); if (pt) sp.append(document.createTextNode(pt)); });
          if (r.link) { sp.dataset.link = JSON.stringify(r.link); }
          d.append(sp);
        });
      }
      out.push(d);
    });
    return out;
  };

  /* builds .tb container positioned in the geometry's text rectangle */
  P.renderText = (el, ctx, b, opts = {}) => {
    const page = ctx.page, deck = ctx.deck;
    let paras = el.paras, prompt = false;
    const empty = !P.hasText(el);
    const editingThis = opts.editing;
    if (empty && el.ph && !editingThis) {
      if (ctx.mode !== 'edit') return null;
      /* prompt text comes from layout or a default */
      const chain = P.phChain(el, page, deck); let ptxt = null;
      for (let i = chain.length - 1; i >= 0; i--) if (P.hasText(chain[i])) { ptxt = chain[i].paras; break; }
      if (page.kind) ptxt = null;
      paras = ptxt || [P.para(el.ph.type === 'title' || el.ph.type === 'ctrTitle' ? 'Click to add title' : el.ph.type === 'subTitle' ? 'Click to add subtitle' : el.ph.type === 'pic' ? 'Click icon to add picture' : 'Click to add text')];
      if (['title', 'ctrTitle', 'subTitle', 'body', 'obj', 'pic'].includes(el.ph.type) || !page.kind) {
        paras = paras.slice(0, 1).map(p => { const q = P.clone(p); q.runs = (q.runs || []).map(r => { r.t = /Master title/.test(r.t) ? 'Click to add title' : /Master subtitle/.test(r.t) ? 'Click to add subtitle' : /Click to edit (text|Master text)/.test(r.t) ? 'Click to add text' : r.t; return r; }); return q; });
      }
      prompt = true;
    }
    if (!opts.editing && empty && !el.ph) return null;
    const ins = P.bodyProp(el, 'ins', page, deck, [7.2, 3.6, 7.2, 3.6]);
    const anchor = P.bodyProp(el, 'anchor', page, deck, 't');
    const wrap = P.bodyProp(el, 'wrap', page, deck, true);
    const inset = textInset(el.geom, b.w, b.h, el.adj);
    const tb = h('div', { class: 'tb' + (prompt ? ' prompt' : '') });
    const s = tb.style;
    s.left = inset[0] + 'px'; s.top = inset[1] + 'px'; s.width = Math.max(1, b.w - inset[0] - inset[2]) + 'px'; s.height = Math.max(1, b.h - inset[1] - inset[3]) + 'px';
    s.padding = `${ins[1]}px ${ins[2]}px ${ins[3]}px ${ins[0]}px`;
    s.justifyContent = anchor === 'ctr' ? 'center' : anchor === 'b' ? 'flex-end' : 'flex-start';
    const vert = P.bodyProp(el, 'vert', page, deck);
    if (vert === 'vert') s.writingMode = 'vertical-rl';
    else if (vert === 'vert270') { s.writingMode = 'vertical-rl'; s.transform = 'rotate(180deg)'; }
    const inner = h('div', { class: 'tbi' });
    if (!wrap) { inner.style.whiteSpace = 'pre'; inner.style.width = 'max-content'; const al = (el.paras && el.paras[0] && el.paras[0].align) || P.baseStyle(el, 0, page, deck).align; inner.style.alignSelf = al === 'ctr' ? 'center' : al === 'r' ? 'flex-end' : 'flex-start'; if (el.geom === 'rect' && !el.ph) { /* no-wrap box grows from its anchor */ } }
    const cols = P.bodyProp(el, 'cols', page, deck);
    /* PowerPoint fills each column to the bottom of the shape before starting the next */
    if (cols && cols > 1) { inner.style.columnCount = cols; inner.style.columnGap = (P.bodyProp(el, 'colGap', page, deck, 7.2)) + 'px'; inner.style.columnFill = 'auto'; inner.style.height = '100%'; }
    inner.append(...P.renderParas(paras, el, ctx, { editing: opts.editing }));
    if (prompt) inner.style.opacity = '.62';
    tb.append(inner);
    return tb;
  };

  /* ---------- geometry element ---------- */
  function geoSvg(el, ctx, b) {
    const deck = ctx.deck, defs = [];
    const fill = el.fill !== undefined ? el.fill : P.bodyProp(el, 'fill', ctx.page, deck);
    const line = el.line !== undefined ? el.line : P.bodyProp(el, 'line', ctx.page, deck);
    const hasLine = line && line.type !== 'none' && (line.width == null || line.width > 0);
    const hasFill = fill && fill.type !== 'none';
    const paths = P.geomPaths(el.geom || 'rect', b.w, b.h, el.adj, el);
    if (!hasLine && !hasFill) return null;
    const lc = hasLine ? P.color(line.color || 'tx1', deck.theme) : 'none';
    const lw = hasLine ? (line.width == null ? 1 : line.width) : 0;
    const dash = hasLine && dashes[line.dash || 'solid'];
    const startId = hasLine ? marker(line.head, defs, lc, lw, true) : '', endId = hasLine ? marker(line.tail, defs, lc, lw, false) : '';
    let body = '';
    const flipT = (el.flipH || el.flipV) ? ` transform="translate(${el.flipH ? b.w : 0} ${el.flipV ? b.h : 0}) scale(${el.flipH ? -1 : 1} ${el.flipV ? -1 : 1})"` : '';
    paths.forEach(p => {
      const pt = p.noFill ? { paint: 'none', op: 1 } : svgPaint(fill, defs, ctx, p.shade);
      let a = `d="${p.d}" fill="${pt.paint}" fill-rule="evenodd"`;
      if (pt.op !== 1) a += ` fill-opacity="${pt.op}"`;
      if (hasLine && !p.noStroke) {
        a += ` stroke="${lc}" stroke-width="${lw}"`;
        if (line.opacity != null && line.opacity < 1) a += ` stroke-opacity="${line.opacity}"`;
        if (dash) a += ` stroke-dasharray="${dash.map(v => v * lw).join(' ')}"`;
        a += ` stroke-linejoin="${line.join || 'round'}" stroke-linecap="${line.cap || 'butt'}"`;
        if (startId) a += ` marker-start="url(#${startId})"`;
        if (endId) a += ` marker-end="url(#${endId})"`;
      }
      body += `<path ${a}/>`;
    });
    const wrap = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    wrap.setAttribute('class', 'geo');
    /* never let the svg collapse: perfectly horizontal or vertical lines have a zero-size box */
    const vw = Math.max(b.w, 1), vh = Math.max(b.h, 1);
    wrap.setAttribute('viewBox', `0 0 ${vw} ${vh}`);
    wrap.style.width = vw + 'px'; wrap.style.height = vh + 'px';
    wrap.innerHTML = `<defs>${defs.join('')}</defs><g${flipT}>${body}</g>`;
    return wrap;
  }

  function commonWrap(el, ctx, b) {
    const d = h('div', { class: 'el el-' + (el.type || 'shape') }); d.dataset.id = el.id;
    const s = d.style;
    s.left = b.x + 'px'; s.top = b.y + 'px'; s.width = b.w + 'px'; s.height = b.h + 'px';
    const rot = el.rot !== undefined ? el.rot : P.bodyProp(el, 'rot', ctx.page, ctx.deck, 0);
    const tfm = [];
    if (el.fx && el.fx.rot3d) { const r = el.fx.rot3d; tfm.push(`perspective(${r.persp || 800}px)`, `rotateX(${r.x || 0}deg)`, `rotateY(${r.y || 0}deg)`); }
    if (rot) tfm.push(`rotate(${rot}deg)`);
    if (tfm.length) s.transform = tfm.join(' ');
    return d;
  }

  P.renderEl = (el, ctx, opts = {}) => {
    const b = P.box(el, ctx.page, ctx.deck);
    const d = commonWrap(el, ctx, b);
    switch (el.type) {
      case 'group': {
        const k = h('div', { class: 'kids' });
        (el.children || []).forEach(c => k.append(P.renderEl(c, Object.assign({}, ctx), opts)));
        d.append(k); break;
      }
      case 'image': renderImage(el, ctx, b, d); break;
      case 'table': renderTable(el, ctx, b, d); break;
      case 'chart': { const c = h('div', { class: 'chart', html: P.chartSVG(el.chart, b.w, b.h, ctx) }); d.append(c); break; }
      case 'video': case 'audio': renderMedia(el, ctx, b, d); break;
      default: {
        if (el.ph && !P.hasText(el) && ctx.mode !== 'edit' && !el.fill) break;
        const svg = geoSvg(el, ctx, b);
        if (svg) { d.append(svg); applyFx(svg, el.fx, ctx); }
        const tb = P.renderText(el, ctx, b, { editing: opts.editingId === el.id });
        if (tb) d.append(tb);
        if (ctx.mode === 'edit' && el.ph && !P.hasText(el) && (el.ph.type === 'obj' || el.ph.type === 'pic' || (el.ph.type === 'body' && !ctx.page.kind && P.phIsContent && P.phIsContent(el, ctx)))) { if (P.contentIcons && !ctx.page.kind) d.append(P.contentIcons(el, ctx)); }
        if (el.ph && ctx.mode === 'edit' && !P.hasText(el) && !svg) d.classList.add('ph-empty');
      }
    }
    if (el.link) d.dataset.link = JSON.stringify(el.link);
    if (el.hidden) d.style.visibility = ctx.mode === 'edit' ? 'hidden' : 'hidden';
    return d;
  };

  function renderImage(el, ctx, b, d) {
    const wrapFx = h('div', { style: { position: 'absolute', inset: 0 } });
    const im = h('div', { class: 'imw' });
    const c = el.crop || {}, l = c.l || 0, t = c.t || 0, r = c.r || 0, bo = c.b || 0;
    const iw = b.w / Math.max(.01, 1 - l - r), ih = b.h / Math.max(.01, 1 - t - bo);
    const img = h('img', { draggable: false, alt: el.alt || '' });
    img.src = P.mediaUrl(el.src, ctx.deck);
    Object.assign(img.style, { width: iw + 'px', height: ih + 'px', left: (-l * iw) + 'px', top: (-t * ih) + 'px' });
    const a = el.adjust || {}; const fl = [];
    /* DrawingML lum: positive brightness lifts toward white rather than multiplying */
    if (a.bright > 0) fl.push('invert(1)', `brightness(${1 - a.bright / 100})`, 'invert(1)');
    else if (a.bright < 0) fl.push(`brightness(${1 + a.bright / 100})`);
    if (a.contrast != null && a.contrast !== 0) fl.push(`contrast(${1 + a.contrast / 100})`);
    if (a.sat != null && a.sat !== 100) fl.push(`saturate(${a.sat / 100})`);
    if (a.gray) fl.push('grayscale(1)');
    if (a.sepia) fl.push('sepia(.8)');
    if (a.hue) fl.push(`hue-rotate(${a.hue}deg)`);
    if (a.blur) fl.push(`blur(${a.blur}px)`);
    if (a.invert) fl.push('invert(1)');
    if (fl.length) img.style.filter = fl.join(' ');
    if (a.opacity != null && a.opacity < 1) img.style.opacity = a.opacity;
    if (el.flipH || el.flipV) img.style.transform = `scale(${el.flipH ? -1 : 1},${el.flipV ? -1 : 1})`;
    im.append(img);
    if (el.geom && el.geom !== 'rect') { const p = P.geomPaths(el.geom, b.w, b.h, el.adj, el)[0]; im.style.clipPath = `path("${p.d}")`; }
    wrapFx.append(im);
    if (el.line && el.line.type !== 'none') { const g = geoSvg({ geom: el.geom || 'rect', adj: el.adj, line: el.line, fill: { type: 'none' } }, ctx, b); if (g) wrapFx.append(g); }
    applyFx(wrapFx, el.fx, ctx);
    d.append(wrapFx);
  }

  function renderMedia(el, ctx, b, d) {
    const live = ctx.mode === 'show';
    const url = P.mediaUrl(el.src, ctx.deck);
    const face = h('div', { class: 'media-face' + (el.type === 'audio' ? ' audio-face' : '') });
    if (el.type === 'video') {
      if (live) {
        const v = h('video', { src: url, controls: true, playsInline: true });
        v.loop = !!(el.media && el.media.loop); if (el.media && el.media.vol != null) v.volume = el.media.vol;
        if (el.poster) v.poster = P.mediaUrl(el.poster, ctx.deck);
        v.dataset.auto = el.media && el.media.auto ? '1' : '';
        face.append(v);
      } else if (el.poster) face.append(h('img', { src: P.mediaUrl(el.poster, ctx.deck), draggable: false }));
      else if (ctx.mode === 'edit') { const v = h('video', { src: url + '#t=0.1', preload: 'metadata', muted: true }); v.style.pointerEvents = 'none'; face.append(v); }
      if (!live) face.append(h('div', { style: { position: 'absolute', width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(0,0,0,.55)', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' }, html: '<svg width="20" height="20" viewBox="0 0 20 20"><path d="M6 3l11 7-11 7z" fill="#fff"/></svg>' }));
    } else {
      const col = P.color('accent1', ctx.deck.theme);
      face.innerHTML = `<svg viewBox="0 0 48 48" width="100%" height="100%"><circle cx="24" cy="24" r="22" fill="${col}"/><path d="M12 19h7l9-8v26l-9-8h-7z" fill="#fff"/><path d="M32 17c3 4 3 10 0 14M36 13c5 6 5 16 0 22" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/></svg>`;
      if (live) { const au = h('audio', { src: url }); au.loop = !!(el.media && el.media.loop); if (el.media && el.media.vol != null) au.volume = el.media.vol; au.dataset.auto = el.media && el.media.auto ? '1' : ''; face.append(au); if (el.media && el.media.hide) face.style.opacity = 0; }
    }
    d.append(face);
  }

  /* ---------- tables ---------- */
  P.tableStyles = {
    grid: { name: 'No Style, Table Grid', fn: () => ({ border: 'tx1', text: 'tx1' }) },
    none: { name: 'No Style, No Grid', fn: () => ({ text: 'tx1' }) }
  };
  const med2 = a => ({ name: 'Medium Style 2 - ' + a, fn: (o, r, c, nr, nc) => {
    const base = { border: 'bg1', borderW: 1, text: 'tx1' };
    if ((o.hdr && r === 0) || (o.total && r === nr - 1) || (o.firstCol && c === 0) || (o.lastCol && c === nc - 1)) return Object.assign(base, { fill: a, text: 'bg1', bold: true });
    const dr = o.hdr ? r - 1 : r, dc = o.firstCol ? c - 1 : c;
    if (o.bandR && dr % 2 === 0) return Object.assign(base, { fill: a + ':t40' });
    if (o.bandC && dc % 2 === 0) return Object.assign(base, { fill: a + ':t40' });
    return Object.assign(base, { fill: a + ':t20' });
  } });
  const light1 = a => ({ name: 'Light Style 1 - ' + a, fn: (o, r, c, nr) => {
    const res = { text: 'tx1', hb: a };
    if (o.hdr && r === 0) { res.bold = true; res.bBottom = a; }
    if (r === 0) res.bTop = a; if (r === nr - 1) res.bBottom = a;
    const dr = o.hdr ? r - 1 : r;
    if (o.bandR && dr % 2 === 0 && !(o.hdr && r === 0)) res.fill = a + ':20,80';
    if (o.total && r === nr - 1) { res.bold = true; res.bTop = a; }
    return res;
  } });
  const grid2 = a => ({ name: 'Grid Table - ' + a, fn: (o, r) => {
    const res = { border: a, text: 'tx1' }; if (o.hdr && r === 0) { res.fill = a; res.text = 'bg1'; res.bold = true; } else { const dr = o.hdr ? r - 1 : r; if (o.bandR && dr % 2 === 0) res.fill = a + ':20,80'; } return res;
  } });
  const dark = a => ({ name: 'Dark Style - ' + a, fn: (o, r, c, nr) => {
    const res = { text: 'bg1', fill: a + ':75,0', border: 'bg1', borderW: .5 }; if (o.hdr && r === 0) { res.fill = 'tx1'; res.bold = true; } else { const dr = o.hdr ? r - 1 : r; if (o.bandR && dr % 2 === 0) res.fill = a; } return res;
  } });
  ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'].forEach(a => { P.tableStyles['med2-' + a] = med2(a); P.tableStyles['light1-' + a] = light1(a); P.tableStyles['grid2-' + a] = grid2(a); P.tableStyles['dark-' + a] = dark(a); });
  P.cellStyle = (tbl, r, c) => { const st = P.tableStyles[tbl.style || 'med2-accent1'] || P.tableStyles.grid; return st.fn(tbl.opts || {}, r, c, tbl.rows.length, tbl.cols.length); };

  function renderTable(el, ctx, b, d) {
    const t = el.tbl; const table = h('table', { class: 'tbl' });
    const cg = h('colgroup'); const total = t.cols.reduce((a, c) => a + c, 0);
    t.cols.forEach(w => cg.append(h('col', { style: { width: (w / total * 100) + '%' } })));
    table.append(cg);
    t.rows.forEach((row, ri) => {
      const tr = h('tr'); tr.style.height = row.h + 'px';
      row.cells.forEach((cell, ci) => {
        if (cell.vm || cell.hm) return;
        const td = h('td'); td.dataset.r = ri; td.dataset.c = ci;
        if (cell.span > 1) td.colSpan = cell.span; if (cell.rowSpan > 1) td.rowSpan = cell.rowSpan;
        const st = P.cellStyle(t, ri, ci);
        const fill = cell.fill !== undefined ? cell.fill : (st.fill ? { type: 'solid', color: st.fill } : null);
        if (fill) td.style.background = P.fillCss(fill, ctx.deck);
        const bd = (side, cs, gen) => {
          const own = cell.borders && cell.borders[side];
          if (own !== undefined) { if (!own || own.type === 'none') return 'none'; return `${own.width == null ? 1 : own.width}px ${own.dash && own.dash !== 'solid' ? 'dashed' : 'solid'} ${P.color(own.color || 'tx1', ctx.deck.theme)}`; }
          if (cs) return `1px solid ${P.color(cs, ctx.deck.theme)}`;
          if (gen) return `${st.borderW || 1}px solid ${P.color(gen, ctx.deck.theme)}`;
          return '';
        };
        td.style.borderLeft = bd('l', null, st.border); td.style.borderRight = bd('r', null, st.border);
        td.style.borderTop = bd('t', st.bTop, st.border); td.style.borderBottom = bd('b', st.bBottom, st.border);
        const pad = cell.ins || [7.2, 3.6, 7.2, 3.6];
        const inner = h('div', { class: 'cell tbi' }); inner.style.padding = `${pad[1]}px ${pad[2]}px ${pad[3]}px ${pad[0]}px`;
        inner.style.justifyContent = { ctr: 'center', b: 'flex-end' }[cell.anchor] || 'flex-start';
        const cst = { size: 18 }; const cctx = Object.assign({}, ctx, { cellStyle: { color: st.text || 'tx1', bold: !!st.bold, bullet: null, marL: 0, indent: 0, lineSp: 1, spcBef: 0, font: '+mn', size: t.size || 18, align: 'l' } });
        void cst;
        const wrap = h('div', { class: 'cell-in' }); wrap.style.width = '100%';
        wrap.append(...P.renderParas(cell.paras, { paras: cell.paras }, cctx, {}));
        inner.append(wrap); td.append(inner); tr.append(td);
      });
      table.append(tr);
    });
    d.append(table);
  }

  /* ---------- whole page ---------- */
  P.bgOf = (page, deck = P.deck) => {
    if (page.bg) return page.bg;
    if (page.kind === 'layout') return deck.master.bg;
    if (page.kind === 'master') return deck.master.bg;
    const l = P.layoutOf(page, deck); return (l && l.bg) || deck.master.bg;
  };
  P.renderPage = (page, opts = {}) => {
    const deck = opts.deck || P.deck;
    const idx = opts.index != null ? opts.index : (page.kind ? null : deck.slides.indexOf(page));
    const ctx = { page, deck, mode: opts.mode || 'thumb', slideNo: page.kind ? null : idx + (deck.firstNum || 1) };
    const pg = h('div', { class: 'pg' }); pg.style.width = deck.size.w + 'px'; pg.style.height = deck.size.h + 'px';
    const bg = h('div', { class: 'pg-bg' }); bg.style.background = P.fillCss(P.bgOf(page, deck), deck);
    if (P.bgOf(page, deck).type === 'pattern') { /* patterns fall back to bg colour */ }
    pg.append(bg);
    /* inherited artwork */
    const art = h('div', { class: 'pg-art' });
    const pushDeco = (els, c) => els.filter(e => !e.ph).forEach(e => art.append(P.renderEl(e, c)));
    if (page.kind === 'layout') { if (page.showMaster !== false) pushDeco(deck.master.elements, Object.assign({}, ctx, { page: deck.master, mode: 'thumb' })); }
    else if (!page.kind) {
      const lay = P.layoutOf(page, deck);
      if (page.showMaster !== false && lay) {
        if (lay.showMaster !== false) pushDeco(deck.master.elements, Object.assign({}, ctx, { page: deck.master, mode: 'thumb' }));
        pushDeco(lay.elements, Object.assign({}, ctx, { page: lay, mode: 'thumb' }));
      }
    }
    pg.append(art);
    const lay = h('div', { class: 'pg-els' });
    (page.elements || []).forEach(el => lay.append(P.renderEl(el, ctx, { editingId: opts.editingId })));
    pg.append(lay);
    return pg;
  };

  /* thumbnail helper */
  P.thumb = (page, w, opts = {}) => {
    const deck = opts.deck || P.deck; const s = w / deck.size.w;
    const box = h('div', { class: 'thumb-box' }); box.style.width = w + 'px'; box.style.height = deck.size.h * s + 'px'; box.style.overflow = 'hidden'; box.style.position = 'relative';
    const pg = P.renderPage(page, Object.assign({ mode: 'thumb' }, opts));
    pg.style.transform = `scale(${s})`; box.append(pg);
    return box;
  };

  /* ---------- charts ---------- */
  const nice = (lo, hi, n = 5) => {
    if (hi === lo) hi = lo + 1;
    const step0 = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(step0))), r = step0 / mag;
    const step = (r < 1.5 ? 1 : r < 3 ? 2 : r < 7 ? 5 : 10) * mag;
    const a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step; const t = [];
    for (let v = a; v <= b + step * .001; v += step) t.push(+v.toFixed(10));
    return { min: a, max: b, ticks: t };
  };
  const fmtN = v => { const s = Math.abs(v) >= 1000 ? v.toLocaleString() : String(+(+v).toFixed(2)); return s; };
  const seriesColor = (c, s, i, th) => P.color(s.color || ('accent' + (i % 6 + 1)), th);
  P.defaultChart = kind => ({ kind: kind || 'column', grouping: 'clustered', title: 'Chart Title', showTitle: true, legend: 'b', labels: false, grid: true,
    cats: ['Category 1', 'Category 2', 'Category 3', 'Category 4'],
    series: [{ name: 'Series 1', values: [4.3, 2.5, 3.5, 4.5] }, { name: 'Series 2', values: [2.4, 4.4, 1.8, 2.8] }, { name: 'Series 3', values: [2, 2, 3, 5] }] });
  P.chartKinds = [['column', 'Clustered Column'], ['column-stacked', 'Stacked Column'], ['column-percent', '100% Stacked Column'], ['bar', 'Clustered Bar'], ['bar-stacked', 'Stacked Bar'], ['bar-percent', '100% Stacked Bar'], ['line', 'Line'], ['line-marker', 'Line with Markers'], ['area', 'Area'], ['area-stacked', 'Stacked Area'], ['pie', 'Pie'], ['doughnut', 'Doughnut'], ['scatter', 'Scatter'], ['radar', 'Radar']];

  P.chartSVG = (ch, W, H, ctx) => {
    const th = ctx.deck.theme, font = P.fontName('+mn', ctx.deck), kindFull = ch.kind + (ch.grouping && ch.grouping !== 'clustered' && !/pie|doughnut|scatter|radar|line/.test(ch.kind) ? '-' + ch.grouping : '');
    const txt = ch.textColor ? P.color(ch.textColor, th) : P.color('tx1:65,35', th), gridc = P.color('tx1:15,85', th);
    const fs = ch.fontSize || Math.max(9, Math.min(14, Math.min(W, H) / 26));
    let o = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 ${W} ${H}" font-family="${P.esc(font)}" font-size="${fs}" fill="${txt}">`;
    if (ch.bg) o += `<rect width="${W}" height="${H}" fill="${P.color(ch.bg, th)}"/>`;
    let top = 6, bottom = H - 6, left = 8, right = W - 8;
    if (ch.showTitle !== false && ch.title) { o += `<text x="${W / 2}" y="${top + fs * 1.5}" text-anchor="middle" font-size="${fs * 1.55}">${P.esc(ch.title)}</text>`; top += fs * 2.3; }
    const isPie = ch.kind === 'pie' || ch.kind === 'doughnut';
    const legendItems = isPie ? ch.cats.map((c, i) => [c, seriesPt(ch, i, th)]) : ch.series.map((s, i) => [s.name, seriesColor(ch, s, i, th)]);
    const lg = ch.legend;
    if (lg && lg !== 'none') {
      const iw = it => it[0].length * fs * .55 + fs + 12;
      if (lg === 'b' || lg === 't') {
        const tot = legendItems.reduce((a, it) => a + iw(it), 0); let x = Math.max(8, (W - tot) / 2);
        const y = lg === 'b' ? bottom - fs * .5 : top + fs * .6;
        legendItems.forEach(it => { o += `<rect x="${x}" y="${y - fs * .4}" width="${fs * .7}" height="${fs * .7}" fill="${it[1]}"/><text x="${x + fs}" y="${y + fs * .3}">${P.esc(it[0])}</text>`; x += iw(it); });
        if (lg === 'b') bottom -= fs * 1.8; else top += fs * 1.8;
      } else {
        const lw = Math.min(W * .3, Math.max(...legendItems.map(iw)));
        const x = lg === 'r' ? W - lw - 4 : 6; let y = (top + bottom) / 2 - legendItems.length * fs * .7;
        legendItems.forEach(it => { o += `<rect x="${x}" y="${y}" width="${fs * .7}" height="${fs * .7}" fill="${it[1]}"/><text x="${x + fs}" y="${y + fs * .7}">${P.esc(it[0])}</text>`; y += fs * 1.4; });
        if (lg === 'r') right -= lw + 8; else left += lw + 8;
      }
    }
    if (isPie) o += pie(ch, left, top, right, bottom, th, fs);
    else if (ch.kind === 'radar') o += radar(ch, left, top, right, bottom, th, fs, gridc);
    else if (ch.kind === 'scatter') o += scatter(ch, left, top, right, bottom, th, fs, gridc);
    else o += cartesian(ch, kindFull, left, top, right, bottom, th, fs, gridc);
    return o + '</svg>';
  };
  function seriesPt(ch, i, th) { const s = ch.series[0] || {}; const pc = s.pointColors && s.pointColors[i]; return P.color(pc || ('accent' + (i % 6 + 1)), th); }
  function pie(ch, l, t, r, b, th, fs) {
    const s = ch.series[0] || { values: [] }, cx = (l + r) / 2, cy = (t + b) / 2, R = Math.max(10, Math.min(r - l, b - t) / 2 - 4), tot = s.values.reduce((a, v) => a + Math.abs(+v || 0), 0) || 1;
    let a = -Math.PI / 2, o = ''; const inner = ch.kind === 'doughnut' ? R * .55 : 0;
    s.values.forEach((v, i) => {
      const f = Math.abs(+v || 0) / tot, e = a + f * Math.PI * 2, c = seriesPt(ch, i, th), lg = f > .5 ? 1 : 0;
      const p = (rad, an) => [cx + rad * Math.cos(an), cy + rad * Math.sin(an)];
      const [x1, y1] = p(R, a), [x2, y2] = p(R, Math.min(e, a + Math.PI * 1.9999));
      let d;
      if (inner) { const [x3, y3] = p(inner, Math.min(e, a + Math.PI * 1.9999)), [x4, y4] = p(inner, a); d = `M${x1} ${y1}A${R} ${R} 0 ${lg} 1 ${x2} ${y2}L${x3} ${y3}A${inner} ${inner} 0 ${lg} 0 ${x4} ${y4}Z`; }
      else d = `M${cx} ${cy}L${x1} ${y1}A${R} ${R} 0 ${lg} 1 ${x2} ${y2}Z`;
      o += `<path d="${d}" fill="${c}" stroke="#fff" stroke-width="1"/>`;
      if (ch.labels) { const mid = (a + e) / 2, [lx, ly] = p(inner ? (R + inner) / 2 : R * .65, mid); o += `<text x="${lx}" y="${ly + fs * .35}" text-anchor="middle" fill="#fff" font-weight="bold">${ch.labelPct ? Math.round(f * 100) + '%' : fmtN(v)}</text>`; }
      a = e;
    });
    return o;
  }
  function cartesian(ch, kind, l, t, r, b, th, fs, gridc) {
    const horizontal = kind.startsWith('bar');
    const stacked = /stacked|percent/.test(kind), percent = /percent/.test(kind);
    const nC = ch.cats.length, S = ch.series;
    let lo = 0, hi = 0;
    if (stacked) {
      for (let c = 0; c < nC; c++) { let pos = 0, neg = 0; S.forEach(s => { const v = +s.values[c] || 0; if (v >= 0) pos += v; else neg += v; }); hi = Math.max(hi, pos); lo = Math.min(lo, neg); }
      if (percent) { hi = 100; lo = 0; }
    } else S.forEach(s => s.values.forEach(v => { v = +v || 0; hi = Math.max(hi, v); lo = Math.min(lo, v); }));
    const N = nice(lo, hi);
    let o = '';
    const lblW = horizontal ? Math.min((r - l) * .3, Math.max(...ch.cats.map(c => String(c).length), 1) * fs * .55 + 6) : Math.max(...N.ticks.map(v => fmtN(v).length + (percent ? 1 : 0))) * fs * .55 + 6;
    const pl = l + lblW, pb = b - (horizontal ? fs * 1.6 : fs * 1.6), pt = t + 4, pr = r - 4;
    const axTitle = (txt, x, y, rot) => txt ? `<text x="${x}" y="${y}" text-anchor="middle"${rot ? ` transform="rotate(-90 ${x} ${y})"` : ''}>${P.esc(txt)}</text>` : '';
    const vp = v => horizontal ? pl + (v - N.min) / (N.max - N.min) * (pr - pl) : pb - (v - N.min) / (N.max - N.min) * (pb - pt);
    N.ticks.forEach(v => {
      if (ch.grid !== false) o += horizontal ? `<line x1="${vp(v)}" x2="${vp(v)}" y1="${pt}" y2="${pb}" stroke="${gridc}" stroke-width=".75"/>` : `<line x1="${pl}" x2="${pr}" y1="${vp(v)}" y2="${vp(v)}" stroke="${gridc}" stroke-width=".75"/>`;
      o += horizontal ? `<text x="${vp(v)}" y="${pb + fs * 1.2}" text-anchor="middle">${fmtN(v)}${percent ? '%' : ''}</text>` : `<text x="${pl - 5}" y="${vp(v) + fs * .35}" text-anchor="end">${fmtN(v)}${percent ? '%' : ''}</text>`;
    });
    const band = (horizontal ? pb - pt : pr - pl) / Math.max(1, nC);
    ch.cats.forEach((c, i) => {
      const lb = P.esc(c);
      if (horizontal) o += `<text x="${pl - 5}" y="${pb - (i + .5) * band + fs * .35}" text-anchor="end">${lb}</text>`;
      else o += `<text x="${pl + (i + .5) * band}" y="${pb + fs * 1.25}" text-anchor="middle">${lb}</text>`;
    });
    o += horizontal ? `<line x1="${vp(Math.max(N.min, 0))}" x2="${vp(Math.max(N.min, 0))}" y1="${pt}" y2="${pb}" stroke="${P.color('tx1:50,50', th)}"/>` : `<line x1="${pl}" x2="${pr}" y1="${vp(Math.max(N.min, 0))}" y2="${vp(Math.max(N.min, 0))}" stroke="${P.color('tx1:50,50', th)}"/>`;
    const isLine = kind.startsWith('line'), isArea = kind.startsWith('area');
    if (isLine || isArea) {
      const xp = i => pl + (i + .5) * band; const acc = new Array(nC).fill(0);
      const drawn = [];
      S.forEach((s, si) => {
        const col = seriesColor(ch, s, si, th), pts = s.values.slice(0, nC).map((v, i) => { v = +v || 0; const base = acc[i]; if (stacked) acc[i] += v; return [xp(i), vp(stacked ? acc[i] : v), v, vp(stacked ? base : 0)]; });
        if (!pts.length) return;
        if (isArea) { drawn.push(`<path d="M${pts[0][0]} ${pts[0][3]}L${pts.map(p => p[0] + ' ' + p[1]).join('L')}L${pts[pts.length - 1][0]} ${pts[pts.length - 1][3]}${pts.slice().reverse().map(p => 'L' + p[0] + ' ' + p[3]).join('')}Z" fill="${col}" fill-opacity="${stacked ? 1 : .75}"/>`); }
        else {
          drawn.push(`<polyline points="${pts.map(p => p[0] + ',' + p[1]).join(' ')}" fill="none" stroke="${col}" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"/>`);
          if (kind === 'line-marker' || ch.marker) pts.forEach(p => { drawn.push(`<circle cx="${p[0]}" cy="${p[1]}" r="3.5" fill="${col}"/>`); });
        }
        if (ch.labels) pts.forEach(p => { drawn.push(`<text x="${p[0]}" y="${p[1] - 6}" text-anchor="middle">${fmtN(p[2])}</text>`); });
      });
      o += stacked && isArea ? drawn.reverse().join('') : drawn.join('');
    } else {
      /* gapWidth is a % of one bar; overlap is a % of one bar shared by neighbours */
      const n = stacked ? 1 : Math.max(1, S.length), gapW = (ch.gapWidth == null ? 100 : ch.gapWidth) / 100, ov = stacked ? 0 : (ch.overlap == null ? 0 : ch.overlap) / 100;
      const barW = band / (n - (n - 1) * ov + gapW), stepW = barW * (1 - ov), pad = barW * gapW / 2;
      for (let c = 0; c < nC; c++) {
        let pos = 0, neg = 0; const totalC = percent ? S.reduce((a, s) => a + Math.abs(+s.values[c] || 0), 0) || 1 : 1;
        S.forEach((s, si) => {
          let v = +s.values[c] || 0; if (percent) v = v / totalC * 100;
          const col = (s.pointColors && s.pointColors[c]) ? P.color(s.pointColors[c], th) : seriesColor(ch, s, si, th);
          let a, e; if (stacked) { if (v >= 0) { a = pos; pos += v; e = pos; } else { a = neg; neg += v; e = neg; } } else { a = 0; e = v; }
          const off = (stacked ? 0 : si) * stepW + pad;
          if (horizontal) {
            const y = pb - (c + 1) * band + off + (stacked ? 0 : 0), x1 = vp(Math.min(a, e)), x2 = vp(Math.max(a, e));
            o += `<rect x="${x1}" y="${y}" width="${Math.max(0, x2 - x1)}" height="${barW}" fill="${col}"/>`;
            if (ch.labels) o += `<text x="${x2 + 3}" y="${y + barW / 2 + fs * .35}">${fmtN(+s.values[c] || 0)}</text>`;
          } else {
            const x = pl + c * band + off, y1 = vp(Math.max(a, e)), y2 = vp(Math.min(a, e));
            o += `<rect x="${x}" y="${y1}" width="${barW}" height="${Math.max(0, y2 - y1)}" fill="${col}"/>`;
            if (ch.labels) o += `<text x="${x + barW / 2}" y="${stacked ? (y1 + y2) / 2 + fs * .35 : y1 - 3}" text-anchor="middle"${stacked ? ' fill="#fff"' : ''}>${fmtN(+s.values[c] || 0)}</text>`;
          }
        });
      }
    }
    void axTitle;
    return o;
  }
  function scatter(ch, l, t, r, b, th, fs, gridc) {
    let ly = 0, hy = 0, lx = Infinity, hx = -Infinity;
    const xsOf = s => (s.xs && s.xs.length ? s.xs : ch.cats.map((c, i) => (isNaN(+c) ? i + 1 : +c)));
    ch.series.forEach(s => { s.values.forEach(v => { ly = Math.min(ly, +v || 0); hy = Math.max(hy, +v || 0); }); xsOf(s).forEach(x => { lx = Math.min(lx, x); hx = Math.max(hx, x); }); });
    if (!isFinite(lx)) { lx = 0; hx = 1; }
    const NY = nice(ly, hy), NX = nice(Math.min(lx, 0), hx);
    const pl = l + fs * 3, pb = b - fs * 1.6, pt = t + 4, pr = r - 6;
    const X = v => pl + (v - NX.min) / (NX.max - NX.min) * (pr - pl), Y = v => pb - (v - NY.min) / (NY.max - NY.min) * (pb - pt);
    let o = '';
    NY.ticks.forEach(v => { if (ch.grid !== false) o += `<line x1="${pl}" x2="${pr}" y1="${Y(v)}" y2="${Y(v)}" stroke="${gridc}" stroke-width=".75"/>`; o += `<text x="${pl - 5}" y="${Y(v) + fs * .35}" text-anchor="end">${fmtN(v)}</text>`; });
    NX.ticks.forEach(v => { if (ch.grid !== false) o += `<line x1="${X(v)}" x2="${X(v)}" y1="${pt}" y2="${pb}" stroke="${gridc}" stroke-width=".75"/>`; o += `<text x="${X(v)}" y="${pb + fs * 1.25}" text-anchor="middle">${fmtN(v)}</text>`; });
    ch.series.forEach((s, si) => { const c = seriesColor(ch, s, si, th), xs = xsOf(s); s.values.forEach((v, i) => { o += `<circle cx="${X(xs[i])}" cy="${Y(+v || 0)}" r="4" fill="${c}"/>`; if (ch.labels) o += `<text x="${X(xs[i])}" y="${Y(+v || 0) - 7}" text-anchor="middle">${fmtN(v)}</text>`; }); });
    return o;
  }
  function radar(ch, l, t, r, b, th, fs, gridc) {
    const cx = (l + r) / 2, cy = (t + b) / 2, R = Math.max(10, Math.min(r - l, b - t) / 2 - fs * 1.5), n = Math.max(1, ch.cats.length);
    let hi = 0; ch.series.forEach(s => s.values.forEach(v => hi = Math.max(hi, +v || 0)));
    const N = nice(0, hi, 4); let o = ''; const pt = (i, f) => [cx + R * f * Math.sin(i / n * Math.PI * 2), cy - R * f * Math.cos(i / n * Math.PI * 2)];
    N.ticks.forEach(v => { const f = v / N.max; if (!f) return; o += `<polygon points="${ch.cats.map((c, i) => pt(i, f).join(',')).join(' ')}" fill="none" stroke="${gridc}"/>`; o += `<text x="${cx + 2}" y="${cy - R * f}">${fmtN(v)}</text>`; });
    ch.cats.forEach((c, i) => { const [x, y] = pt(i, 1); const [lx, ly] = pt(i, 1.12); o += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="${gridc}"/><text x="${lx}" y="${ly + fs * .35}" text-anchor="middle">${P.esc(c)}</text>`; });
    ch.series.forEach((s, si) => { const col = seriesColor(ch, s, si, th); o += `<polygon points="${s.values.slice(0, n).map((v, i) => pt(i, (+v || 0) / N.max).join(',')).join(' ')}" fill="${col}" fill-opacity=".18" stroke="${col}" stroke-width="2"/>`; });
    return o;
  }
})(window.P);
