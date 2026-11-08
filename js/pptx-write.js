/* Podium - writes genuine Office Open XML .pptx files */
(function (P) {
  'use strict';
  const NS = 'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';
  const P14 = 'http://schemas.microsoft.com/office/powerpoint/2010/main';
  const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
  const HDR = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  const E = v => Math.round((v || 0) * 12700);
  const X = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
  const guid = () => '{' + 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => (Math.random() * 16 | 0).toString(16)).toUpperCase() + '}';

  /* ---------- colour / fill / line ---------- */
  const clr = (c, op) => {
    const a = op != null && op < 1 ? `<a:alpha val="${Math.round(op * 100000)}"/>` : '';
    if (!c) c = 'tx1';
    if (c[0] === '#') return `<a:srgbClr val="${c.slice(1).toUpperCase()}">${a}</a:srgbClr>`;
    const [base, mods] = c.split(':');
    let m = '';
    if (mods && mods[0] === 't') m += `<a:tint val="${+mods.slice(1) * 1000}"/>`;
    else if (mods) { const [lm, lo] = mods.split(',').map(Number); m += `<a:lumMod val="${lm * 1000}"/>`; if (lo) m += `<a:lumOff val="${lo * 1000}"/>`; }
    return `<a:schemeClr val="${base}">${m}${a}</a:schemeClr>`;
  };
  const fillXml = (f, ctx) => {
    if (!f) return '';
    switch (f.type) {
      case 'none': return '<a:noFill/>';
      case 'solid': return `<a:solidFill>${clr(f.color, f.opacity)}</a:solidFill>`;
      case 'gradient': {
        const gs = (f.stops || []).map(s => `<a:gs pos="${Math.round(s.pos * 1000)}">${clr(s.color, s.opacity)}</a:gs>`).join('');
        const shade = (f.kind === 'radial' || f.kind === 'path') ? '<a:path path="circle"><a:fillToRect l="50000" t="50000" r="50000" b="50000"/></a:path>' : `<a:lin ang="${Math.round((((f.angle || 0) % 360 + 360) % 360) * 60000)}" scaled="0"/>`;
        return `<a:gradFill rotWithShape="1"><a:gsLst>${gs}</a:gsLst>${shade}</a:gradFill>`;
      }
      case 'picture': {
        const rid = ctx.addImage(f.src); if (!rid) return '<a:noFill/>';
        const alpha = f.opacity != null && f.opacity < 1 ? `<a:alphaModFix amt="${Math.round(f.opacity * 100000)}"/>` : '';
        return `<a:blipFill dpi="0" rotWithShape="1"><a:blip r:embed="${rid}">${alpha}</a:blip><a:srcRect/>${f.tile ? '<a:tile tx="0" ty="0" sx="100000" sy="100000" flip="none" algn="tl"/>' : '<a:stretch><a:fillRect/></a:stretch>'}</a:blipFill>`;
      }
      case 'pattern': return `<a:pattFill prst="${f.preset || 'pct50'}"><a:fgClr>${clr(f.fg || 'tx1')}</a:fgClr><a:bgClr>${clr(f.bg || 'bg1')}</a:bgClr></a:pattFill>`;
    }
    return '';
  };
  const lineXml = (l, tag = 'a:ln') => {
    if (!l) return '';
    if (l.type === 'none') return `<${tag}><a:noFill/></${tag}>`;
    const cap = l.cap === 'round' ? ' cap="rnd"' : l.cap === 'square' ? ' cap="sq"' : '';
    const end = (n, e) => (e && e.type && e.type !== 'none' ? `<a:${n} type="${e.type}" w="${e.size || 'med'}" len="${e.size || 'med'}"/>` : '');
    return `<${tag} w="${E(l.width == null ? 1 : l.width)}"${cap}><a:solidFill>${clr(l.color || 'tx1', l.opacity)}</a:solidFill>${l.dash && l.dash !== 'solid' ? `<a:prstDash val="${l.dash}"/>` : ''}${l.join === 'bevel' ? '<a:bevel/>' : l.join === 'miter' ? '<a:miter lim="800000"/>' : l.join === 'round' ? '<a:round/>' : ''}${end('headEnd', l.head)}${end('tailEnd', l.tail)}</${tag}>`;
  };
  const effectsXml = fx => {
    if (!fx) return '';
    let o = '';
    if (fx.glow) o += `<a:glow rad="${E(fx.glow.rad)}">${clr(fx.glow.color || 'accent1', fx.glow.opacity == null ? .6 : fx.glow.opacity)}</a:glow>`;
    if (fx.shadow) { const s = fx.shadow; o += `<a:outerShdw blurRad="${E(s.blur)}" dist="${E(s.dist)}" dir="${Math.round((((s.dir || 0) % 360 + 360) % 360) * 60000)}" algn="ctr" rotWithShape="0">${clr(s.color || '#000000', s.opacity == null ? .4 : s.opacity)}</a:outerShdw>`; }
    if (fx.reflect) { const r = fx.reflect; o += `<a:reflection blurRad="6350" stA="${Math.round((r.opacity == null ? .5 : r.opacity) * 100000)}" endA="300" endPos="${Math.round((r.size || 50) * 1000)}" dist="${E(r.dist)}" dir="5400000" sy="-100000" algn="bl" rotWithShape="0"/>`; }
    if (fx.soft) o += `<a:softEdge rad="${E(fx.soft.rad)}"/>`;
    let s3 = '';
    if (fx.rot3d) { const n = v => Math.round(((v % 360 + 360) % 360) * 60000); s3 = `<a:scene3d><a:camera prst="perspectiveFront"><a:rot lat="${n(fx.rot3d.x || 0)}" lon="${n(-(fx.rot3d.y || 0))}" rev="0"/></a:camera><a:lightRig rig="threePt" dir="t"/></a:scene3d>`; }
    return (o ? `<a:effectLst>${o}</a:effectLst>` : '') + s3;
  };

  /* ---------- geometry ---------- */
  const twoPlus = /^(rightArrow|leftArrow|upArrow|downArrow|leftRightArrow|upDownArrow|quadArrow|bentArrow|wedge|cloudCallout|borderCallout|pie|chord|arc|blockArc|halfFrame|corner|bentConnector|curvedConnector|round2|snip2|snipRound|notchedRightArrow|.*ArrowCallout)/;
  const geomXml = el => {
    const g = el.geom || 'rect';
    if (g === 'custom' && el.paths) return custGeom(el);
    const adj = el.adj || [];
    const names = adj.map((v, i) => (twoPlus.test(g) ? `adj${i + 1}` : (adj.length > 1 ? `adj${i + 1}` : 'adj')));
    const gds = adj.map((v, i) => (v == null ? '' : `<a:gd name="${names[i]}" fmla="val ${Math.round(v)}"/>`)).join('');
    return `<a:prstGeom prst="${g}"><a:avLst>${gds}</a:avLst></a:prstGeom>`;
  };
  const custGeom = el => {
    const paths = el.paths.map(p => {
      const sc = 100, w = Math.round((p.w || el.w) * sc), hh = Math.round((p.h || el.h) * sc); let o = ''; const pt = (x, y) => `<a:pt x="${Math.round(x * sc)}" y="${Math.round(y * sc)}"/>`;
      let cx = 0, cy = 0;
      (p.d.match(/[MLHVCQZ][^MLHVCQZ]*/gi) || []).forEach(seg => {
        const c = seg[0].toUpperCase(), n = seg.slice(1).trim().split(/[\s,]+/).filter(Boolean).map(Number);
        if (c === 'M') { for (let i = 0; i + 1 < n.length; i += 2) { o += i === 0 ? `<a:moveTo>${pt(n[i], n[i + 1])}</a:moveTo>` : `<a:lnTo>${pt(n[i], n[i + 1])}</a:lnTo>`; cx = n[i]; cy = n[i + 1]; } }
        else if (c === 'L') { for (let i = 0; i + 1 < n.length; i += 2) { o += `<a:lnTo>${pt(n[i], n[i + 1])}</a:lnTo>`; cx = n[i]; cy = n[i + 1]; } }
        else if (c === 'H') { o += `<a:lnTo>${pt(n[0], cy)}</a:lnTo>`; cx = n[0]; }
        else if (c === 'V') { o += `<a:lnTo>${pt(cx, n[0])}</a:lnTo>`; cy = n[0]; }
        else if (c === 'C') { for (let i = 0; i + 5 < n.length; i += 6) { o += `<a:cubicBezTo>${pt(n[i], n[i + 1])}${pt(n[i + 2], n[i + 3])}${pt(n[i + 4], n[i + 5])}</a:cubicBezTo>`; cx = n[i + 4]; cy = n[i + 5]; } }
        else if (c === 'Q') { for (let i = 0; i + 3 < n.length; i += 4) { o += `<a:quadBezTo>${pt(n[i], n[i + 1])}${pt(n[i + 2], n[i + 3])}</a:quadBezTo>`; cx = n[i + 2]; cy = n[i + 3]; } }
        else if (c === 'Z') o += '<a:close/>';
      });
      return `<a:path w="${Math.max(1, w)}" h="${Math.max(1, hh)}"${p.noFill ? ' fill="none"' : ''}${p.noStroke ? ' stroke="0"' : ''}>${o}</a:path>`;
    }).join('');
    return `<a:custGeom><a:avLst/><a:gdLst/><a:ahLst/><a:cxnLst/><a:rect l="0" t="0" r="r" b="b"/><a:pathLst>${paths}</a:pathLst></a:custGeom>`;
  };
  const xfrm = (el, page, tag = 'a:xfrm', extra = '') => {
    if (el.x === undefined) return '';
    const attrs = (el.rot ? ` rot="${Math.round(((el.rot % 360 + 360) % 360) * 60000)}"` : '') + (el.flipH ? ' flipH="1"' : '') + (el.flipV ? ' flipV="1"' : '');
    return `<${tag}${attrs}><a:off x="${E(el.x)}" y="${E(el.y)}"/><a:ext cx="${E(el.w)}" cy="${E(el.h)}"/>${extra}</${tag}>`;
  };

  /* ---------- text ---------- */
  const fontName = f => (f === '+mj' ? '+mj-lt' : f === '+mn' ? '+mn-lt' : f);
  const rPr = (r, ctx, tag = 'a:rPr', extraAttrs = '') => {
    if (!r) r = {};
    let a = ' lang="en-US"' + extraAttrs;
    if (r.size != null) a += ` sz="${Math.round(r.size * 100)}"`;
    if (r.b != null) a += ` b="${r.b ? 1 : 0}"`;
    if (r.i != null) a += ` i="${r.i ? 1 : 0}"`;
    if (r.u != null) a += ` u="${r.u ? 'sng' : 'none'}"`;
    if (r.s) a += ' strike="sngStrike"';
    if (r.cap) a += ` cap="${r.cap}"`;
    if (r.spc) a += ` spc="${Math.round(r.spc * 100)}"`;
    if (r.base) a += ` baseline="${r.base * 1000}"`;
    a += ' dirty="0"';
    let k = '';
    if (r.outline) k += `<a:ln w="${E(r.outline.w || 1)}"><a:solidFill>${clr(r.outline.color || 'tx1')}</a:solidFill></a:ln>`;
    if (r.tfill) k += fillXml(r.tfill, ctx);
    else if (r.color) k += `<a:solidFill>${clr(r.color, r.opacity)}</a:solidFill>`;
    let fx = ''; if (r.glow) fx += `<a:glow rad="${E(r.glow.rad || 6)}">${clr(r.glow.color || 'accent1', .6)}</a:glow>`; if (r.shadow) { const s = typeof r.shadow === 'object' ? r.shadow : { color: '#000000', dist: 1.5, dir: 45, blur: 2, opacity: .5 }; fx += `<a:outerShdw blurRad="${E(s.blur == null ? 2 : s.blur)}" dist="${E(s.dist == null ? 1.5 : s.dist)}" dir="${Math.round((s.dir == null ? 45 : s.dir) * 60000)}" algn="ctr" rotWithShape="0">${clr(s.color || '#000000', s.opacity == null ? .5 : s.opacity)}</a:outerShdw>`; }
    if (fx) k += `<a:effectLst>${fx}</a:effectLst>`;
    if (r.hl) k += `<a:highlight>${clr(r.hl[0] === '#' ? r.hl : ('#' + P.color(r.hl).slice(1)))}</a:highlight>`;
    if (r.font) { const f = X(fontName(r.font)); k += `<a:latin typeface="${f}"/>`; if (f[0] !== '+') k += `<a:cs typeface="${f}"/>`; }
    if (r.link && ctx && tag !== 'a:endParaRPr' && tag !== 'a:defRPr') {
      if (r.link.url) k += `<a:hlinkClick r:id="${ctx.addLink(r.link.url)}"/>`;
      else if (r.link.slide) { const rid = ctx.addSlideLink(r.link.slide); if (rid) k += `<a:hlinkClick r:id="${rid}" action="ppaction://hlinksldjump"/>`; }
      else if (r.link.act) k += `<a:hlinkClick r:id="" action="${actionUri(r.link.act)}"/>`;
    }
    return `<${tag}${a}>${k}</${tag}>`.replace(/<(a:\w+)([^>]*)><\/\1>/, '<$1$2/>');
  };
  const actionUri = a => ({ next: 'ppaction://hlinkshowjump?jump=nextslide', prev: 'ppaction://hlinkshowjump?jump=previousslide', first: 'ppaction://hlinkshowjump?jump=firstslide', last: 'ppaction://hlinkshowjump?jump=lastslide', end: 'ppaction://hlinkshowjump?jump=endshow' }[a] || 'ppaction://noaction');
  const pPrInner = (p, ctx) => {
    let o = '';
    if (p.lineSpPt) o += `<a:lnSpc><a:spcPts val="${Math.round(p.lineSpPt * 100)}"/></a:lnSpc>`; else if (p.lineSp != null) o += `<a:lnSpc><a:spcPct val="${Math.round(p.lineSp * 100000)}"/></a:lnSpc>`;
    if (p.spcBef != null) o += `<a:spcBef><a:spcPts val="${Math.round(p.spcBef * 100)}"/></a:spcBef>`;
    if (p.spcAft != null) o += `<a:spcAft><a:spcPts val="${Math.round(p.spcAft * 100)}"/></a:spcAft>`;
    if (p.bullet !== undefined) {
      if (!p.bullet) o += '<a:buNone/>';
      else {
        if (p.bullet.color) o += `<a:buClr>${clr(p.bullet.color)}</a:buClr>`;
        if (p.bullet.sizePct) o += `<a:buSzPct val="${Math.round(p.bullet.sizePct * 1000)}"/>`;
        if (p.bullet.type === 'num') { o += `<a:buFont typeface="+mj-lt"/><a:buAutoNum type="${p.bullet.style || 'arabicPeriod'}"${p.bullet.start > 1 ? ` startAt="${p.bullet.start}"` : ''}/>`; }
        else { o += `<a:buFont typeface="${X(p.bullet.font || 'Arial')}"/><a:buChar char="${X(p.bullet.char || '•')}"/>`; }
      }
    }
    void ctx; return o;
  };
  const pPrAttrs = p => { let a = ''; if (p.marL != null) a += ` marL="${E(p.marL)}"`; if (p.level) a += ` lvl="${p.level}"`; if (p.indent != null) a += ` indent="${E(p.indent)}"`; if (p.align) a += ` algn="${p.align}"`; if (p.rtl) a += ' rtl="1"'; return a; };
  const parasXml = (paras, ctx, extra) => {
    const list = paras && paras.length ? paras : [{ runs: [] }];
    return list.map(p => {
      const merged = extra ? Object.assign({}, extra.para, p) : p;
      const inner = pPrInner(merged, ctx), attrs = pPrAttrs(merged); let o = '<a:p>';
      if (inner || attrs) o += inner ? `<a:pPr${attrs}>${inner}</a:pPr>` : `<a:pPr${attrs}/>`;
      (p.runs || []).forEach(r0 => {
        const r = extra ? Object.assign({}, extra.run, r0) : r0;
        if (!r.t) return;
        if (r.field) { o += `<a:fld id="${guid()}" type="${r.field}">${rPr(r, ctx)}<a:t>${X(r.t)}</a:t></a:fld>`; return; }
        r.t.split('\n').forEach((part, i) => { if (i) o += `<a:br>${rPr(r, ctx)}</a:br>`; if (part) o += `<a:r>${rPr(r, ctx)}<a:t>${X(part)}</a:t></a:r>`; });
      });
      const end = extra ? Object.assign({}, extra.run, p.end) : p.end;
      o += rPr(end || {}, ctx, 'a:endParaRPr');
      return o + '</a:p>';
    }).join('');
  };
  const lvlProps = (l, tag, ctx) => {
    const a = pPrAttrs(l) + (l.defTab ? '' : ''); const inner = pPrInner(l, ctx);
    const rp = {}; ['size', 'color', 'font', 'cap', 'spc'].forEach(k => { if (l[k] !== undefined) rp[k] = l[k]; }); if (l.bold !== undefined) rp.b = l.bold; if (l.italic !== undefined) rp.i = l.italic; if (l.u !== undefined) rp.u = l.u;
    let def = rPr(rp, null, 'a:defRPr').replace(' lang="en-US"', '').replace(' dirty="0"', '');
    return `<${tag}${a}>${inner}${def}</${tag}>`;
  };
  const lstXml = (lst, ctx) => { if (!lst || !lst.length) return '<a:lstStyle/>'; return `<a:lstStyle>${lst.map((l, i) => (l ? lvlProps(l, `a:lvl${i + 1}pPr`, ctx) : '')).join('')}</a:lstStyle>`; };
  const bodyPr = (el) => {
    let a = '';
    if (el.vert) a += ` vert="${el.vert}"`;
    if (el.wrap === false) a += ' wrap="none"'; else if (el.wrap === true || el.txBox) a += ' wrap="square"';
    if (el.ins) a += ` lIns="${E(el.ins[0])}" tIns="${E(el.ins[1])}" rIns="${E(el.ins[2])}" bIns="${E(el.ins[3])}"`;
    if (el.cols > 1) a += ` numCol="${el.cols}"`;
    if (el.anchor) a += ` anchor="${el.anchor}"`;
    let k = '';
    if (el.fit === 'resize') k = '<a:spAutoFit/>'; else if (el.fit === 'none') k = '<a:noAutofit/>';
    else if (el.fit === 'shrink' || el.fontScale) k = el.fontScale ? `<a:normAutofit fontScale="${Math.round(el.fontScale * 1000)}" lnSpcReduction="${(el.lnReduc || 0) * 1000}"/>` : '<a:normAutofit/>';
    return k ? `<a:bodyPr${a}>${k}</a:bodyPr>` : `<a:bodyPr${a}/>`;
  };

  /* ---------- elements ---------- */
  const phXml = ph => { if (!ph) return ''; let a = ''; if (ph.type && ph.type !== 'obj') a += ` type="${ph.type}"`; if (ph.type === 'dt' || ph.type === 'ftr' || ph.type === 'sldNum') a += ` sz="${ph.type === 'ftr' ? 'quarter' : 'half'}"`; if (ph.idx && !['title', 'ctrTitle'].includes(ph.type)) a += ` idx="${ph.idx}"`; return `<p:ph${a}/>`; };
  const cNvPr = (el, id, ctx) => {
    let k = '';
    if (el.link && ctx) { if (el.link.url) k = `<a:hlinkClick r:id="${ctx.addLink(el.link.url)}"/>`; else if (el.link.slide) { const rid = ctx.addSlideLink(el.link.slide); if (rid) k = `<a:hlinkClick r:id="${rid}" action="ppaction://hlinksldjump"/>`; } else if (el.link.act) k = `<a:hlinkClick r:id="" action="${actionUri(el.link.act)}"/>`; }
    const a = `id="${id}" name="${X(el.name || 'Shape ' + id)}"${el.alt ? ` descr="${X(el.alt)}"` : ''}${el.hidden ? ' hidden="1"' : ''}`;
    return k ? `<p:cNvPr ${a}>${k}</p:cNvPr>` : `<p:cNvPr ${a}/>`;
  };
  const elXml = (el, ctx) => {
    const id = ctx.idOf(el.id);
    switch (el.type) {
      case 'group': return groupXml(el, ctx, id);
      case 'image': return picXml(el, ctx, id);
      case 'table': return tableXml(el, ctx, id);
      case 'chart': return chartFrameXml(el, ctx, id);
      case 'video': case 'audio': return mediaXml(el, ctx, id);
      default: return P.isLineGeom(el.geom) ? cxnXml(el, ctx, id) : spXml(el, ctx, id);
    }
  };
  const spXml = (el, ctx, id) => {
    const lockTxt = el.txBox ? ' txBox="1"' : '';
    const hasGeom = !el.ph || el.geom && (el.geom !== 'rect');
    const pr = `${xfrm(el)}${(el.x !== undefined || !el.ph) && hasGeom !== false ? geomXml(el) : (el.ph && el.x !== undefined ? geomXml(el) : '')}${el.fill !== undefined ? fillXml(el.fill, ctx) : ''}${el.line !== undefined ? lineXml(el.line) : ''}${effectsXml(el.fx)}`;
    const locks = el.ph ? '<a:spLocks noGrp="1"/>' : '';
    const hasBody = el.paras || el.ph;
    let tx = '';
    if (hasBody) tx = `<p:txBody>${bodyPr(el)}${lstXml(el.lst, ctx)}${parasXml(el.paras, ctx)}</p:txBody>`;
    else tx = '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="en-US"/></a:p></p:txBody>';
    return `<p:sp><p:nvSpPr>${cNvPr(el, id, ctx)}<p:cNvSpPr${lockTxt}>${locks}</p:cNvSpPr><p:nvPr>${phXml(el.ph)}</p:nvPr></p:nvSpPr><p:spPr>${pr}</p:spPr>${tx}</p:sp>`;
  };
  const cxnXml = (el, ctx, id) => {
    let c = ''; if (el.conn) { const idx = (ref) => { const t = P.findEl(ref.id, ctx.page); const m = t && (t.geom === 'ellipse' || t.geom === 'flowChartConnector') ? [0, 2, 4, 6] : [0, 1, 2, 3]; return m[ref.idx % 4]; }; if (el.conn.st && P.findEl(el.conn.st.id, ctx.page)) c += `<a:stCxn id="${ctx.idOf(el.conn.st.id)}" idx="${idx(el.conn.st)}"/>`; if (el.conn.end && P.findEl(el.conn.end.id, ctx.page)) c += `<a:endCxn id="${ctx.idOf(el.conn.end.id)}" idx="${idx(el.conn.end)}"/>`; }
    return `<p:cxnSp><p:nvCxnSpPr>${cNvPr(el, id, ctx)}<p:cNvCxnSpPr>${c}</p:cNvCxnSpPr><p:nvPr/></p:nvCxnSpPr><p:spPr>${xfrm(el)}${geomXml(el)}${lineXml(el.line || { type: 'solid', color: 'accent1', width: 1 })}${effectsXml(el.fx)}</p:spPr></p:cxnSp>`;
  };
  const groupXml = (el, ctx, id) => {
    /* children are stored in group-local coordinates, so child space == (0,0,w,h) */
    const kids = (el.children || []).map(k => elXml(k, ctx)).join('');
    const attrs = (el.rot ? ` rot="${Math.round(((el.rot % 360 + 360) % 360) * 60000)}"` : '') + (el.flipH ? ' flipH="1"' : '') + (el.flipV ? ' flipV="1"' : '');
    return `<p:grpSp><p:nvGrpSpPr>${cNvPr(el, id, ctx)}<p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm${attrs}><a:off x="${E(el.x)}" y="${E(el.y)}"/><a:ext cx="${E(el.w)}" cy="${E(el.h)}"/><a:chOff x="0" y="0"/><a:chExt cx="${E(el.w)}" cy="${E(el.h)}"/></a:xfrm></p:grpSpPr>${kids}</p:grpSp>`;
  };
  const picXml = (el, ctx, id) => {
    const rid = ctx.addImage(el.src, el);
    const a = el.adjust || {}; let blipK = '';
    if (a.opacity != null && a.opacity < 1) blipK += `<a:alphaModFix amt="${Math.round(a.opacity * 100000)}"/>`;
    if (a.gray) blipK += '<a:grayscl/>';
    if (a.bright || a.contrast) blipK += `<a:lum${a.bright ? ` bright="${Math.round(a.bright * 1000)}"` : ''}${a.contrast ? ` contrast="${Math.round(a.contrast * 1000)}"` : ''}/>`;
    const c = el.crop; const src = c && (c.l || c.t || c.r || c.b) ? `<a:srcRect l="${Math.round((c.l || 0) * 100000)}" t="${Math.round((c.t || 0) * 100000)}" r="${Math.round((c.r || 0) * 100000)}" b="${Math.round((c.b || 0) * 100000)}"/>` : '';
    return `<p:pic><p:nvPicPr>${cNvPr(el, id, ctx)}<p:cNvPicPr><a:picLocks noChangeAspect="1"${el.ph ? ' noGrp="1"' : ''}/></p:cNvPicPr><p:nvPr>${phXml(el.ph)}</p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="${rid}">${blipK}</a:blip>${src}<a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(el)}${geomXml(Object.assign({}, el, { geom: el.geom || 'rect' }))}${el.line ? lineXml(el.line) : ''}${effectsXml(el.fx)}</p:spPr></p:pic>`;
  };
  const mediaXml = (el, ctx, id) => {
    const { rel1, rel2, posterRid } = ctx.addMedia(el);
    const file = el.type === 'video' ? `<a:videoFile r:link="${rel1}"/>` : `<a:audioFile r:link="${rel1}"/>`;
    return `<p:pic><p:nvPicPr>${cNvPr(el, id, ctx)}<p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr>${file}<p:extLst><p:ext uri="{DAA4B4D4-6D71-4841-9C94-3DE7FCFB9230}"><p14:media xmlns:p14="${P14}" r:embed="${rel2}"/></p:ext></p:extLst></p:nvPr></p:nvPicPr><p:blipFill><a:blip r:embed="${posterRid}"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr>${xfrm(el)}<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>`;
  };
  const MED2 = { accent1: '{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}', accent2: '{21E4AEA4-8DFA-4A89-87EB-49C32662AFE0}', accent3: '{F5AB1C69-6EDB-4FF4-983F-18BD219EF322}', accent4: '{00A15C55-8517-42AA-B614-E9B94910E393}', accent5: '{7DF18680-E054-41AD-8BC1-D1AEF772440D}', accent6: '{93296810-A885-4BE3-A3E7-6D5BEEA58F35}' };
  P.TABLE_GUIDS = Object.fromEntries(Object.entries(MED2).map(([a, g]) => [g, 'med2-' + a]));
  P.TABLE_GUIDS['{2D5ABB26-0587-4C30-8999-92F81FD0307C}'] = 'none'; P.TABLE_GUIDS['{5940675A-B579-460E-94D1-54222C63F5DA}'] = 'grid'; P.TABLE_GUIDS['{073A0DAA-6AF3-43AB-8588-CEC1D06C72B9}'] = 'med2-accent1';
  const tableXml = (el, ctx, id) => {
    const t = el.tbl, o = t.opts || {}, st = t.style || 'med2-accent1'; const m = /^med2-(accent\d)$/.exec(st);
    const styleId = m ? MED2[m[1]] : st === 'grid' ? '{5940675A-B579-460E-94D1-54222C63F5DA}' : '{2D5ABB26-0587-4C30-8999-92F81FD0307C}';
    const bake = !m && st !== 'grid' && st !== 'none';
    const flags = (o.hdr ? ' firstRow="1"' : '') + (o.total ? ' lastRow="1"' : '') + (o.firstCol ? ' firstCol="1"' : '') + (o.lastCol ? ' lastCol="1"' : '') + (o.bandR ? ' bandRow="1"' : '') + (o.bandC ? ' bandCol="1"' : '');
    const grid = t.cols.map(w => `<a:gridCol w="${E(w)}"/>`).join('');
    const rows = t.rows.map((row, ri) => {
      const cells = row.cells.map((c, ci) => {
        const cs = bake ? P.cellStyle(t, ri, ci) : null;
        const extra = { para: {}, run: {} }; if (t.size && t.size !== 18) extra.run.size = t.size; if (cs) { if (cs.text) extra.run.color = cs.text; if (cs.bold) extra.run.b = true; }
        let a = ''; if (c.span > 1) a += ` gridSpan="${c.span}"`; if (c.rowSpan > 1) a += ` rowSpan="${c.rowSpan}"`; if (c.hm) a += ' hMerge="1"'; if (c.vm) a += ' vMerge="1"';
        const lnFor = (side, tag, gen) => { const own = c.borders && c.borders[side]; if (own !== undefined) return lineXml(own && own.type !== 'none' ? Object.assign({ type: 'solid' }, own) : { type: 'none' }, tag); if (gen) return lineXml({ type: 'solid', color: gen, width: (cs && cs.borderW) || 1 }, tag); return ''; };
        const b = cs ? cs.border : null;
        const bord = lnFor('l', 'a:lnL', b) + lnFor('r', 'a:lnR', b) + lnFor('t', 'a:lnT', (cs && cs.bTop) || b) + lnFor('b', 'a:lnB', (cs && cs.bBottom) || b);
        const fill = c.fill !== undefined ? fillXml(c.fill, ctx) : (cs && cs.fill ? fillXml({ type: 'solid', color: cs.fill }, ctx) : '');
        const pad = c.ins ? ` marL="${E(c.ins[0])}" marR="${E(c.ins[2])}" marT="${E(c.ins[1])}" marB="${E(c.ins[3])}"` : '';
        const anch = c.anchor ? ` anchor="${c.anchor}"` : '';
        return `<a:tc${a}><a:txBody><a:bodyPr/><a:lstStyle/>${parasXml(c.paras, ctx, extra)}</a:txBody><a:tcPr${pad}${anch}>${bord}${fill}</a:tcPr></a:tc>`;
      }).join('');
      return `<a:tr h="${E(row.h)}">${cells}</a:tr>`;
    }).join('');
    return `<p:graphicFrame><p:nvGraphicFramePr>${cNvPr(el, id, ctx)}<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr>${phXml(el.ph)}</p:nvPr></p:nvGraphicFramePr>${xfrm(el, null, 'p:xfrm')}<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr${flags}><a:tableStyleId>${styleId}</a:tableStyleId></a:tblPr><a:tblGrid>${grid}</a:tblGrid>${rows}</a:tbl></a:graphicData></a:graphic></p:graphicFrame>`;
  };
  const chartFrameXml = (el, ctx, id) => {
    const rid = ctx.addChart(el);
    return `<p:graphicFrame><p:nvGraphicFramePr>${cNvPr(el, id, ctx)}<p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr>${phXml(el.ph)}</p:nvPr></p:nvGraphicFramePr>${xfrm(el, null, 'p:xfrm')}<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="${rid}"/></a:graphicData></a:graphic></p:graphicFrame>`;
  };

  /* ---------- chart part ---------- */
  const colName = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };
  const strCache = arr => `<c:strCache><c:ptCount val="${arr.length}"/>${arr.map((v, i) => `<c:pt idx="${i}"><c:v>${X(v)}</c:v></c:pt>`).join('')}</c:strCache>`;
  const numCache = arr => `<c:numCache><c:formatCode>General</c:formatCode><c:ptCount val="${arr.length}"/>${arr.map((v, i) => `<c:pt idx="${i}"><c:v>${+v || 0}</c:v></c:pt>`).join('')}</c:numCache>`;
  const chartXml = (ch, hasBook, box) => {
    const n = ch.cats.length, last = n + 1;
    /* same text size & colour the on-screen renderer uses */
    const fs = ch.fontSize || Math.max(9, Math.min(14, Math.min(box ? box.w : 400, box ? box.h : 300) / 26));
    const txtClr = `<a:solidFill>${clr(ch.textColor || 'tx1:65,35')}</a:solidFill>`;
    const serHead = (s, i) => `<c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:strRef><c:f>Sheet1!$${colName(i + 1)}$1</c:f>${strCache([s.name])}</c:strRef></c:tx>`;
    const cat = `<c:cat><c:strRef><c:f>Sheet1!$A$2:$A$${last}</c:f>${strCache(ch.cats)}</c:strRef></c:cat>`;
    const val = (s, i) => `<c:val><c:numRef><c:f>Sheet1!$${colName(i + 1)}$2:$${colName(i + 1)}$${last}</c:f>${numCache(s.values.slice(0, n))}</c:numRef></c:val>`;
    const lbl = on => `<c:dLbls><c:showLegendKey val="0"/><c:showVal val="${on ? 1 : 0}"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="${on && ch.labelPct ? 1 : 0}"/><c:showBubbleSize val="0"/></c:dLbls>`;
    const solid = s => (s.color ? `<c:spPr><a:solidFill>${clr(s.color)}</a:solidFill></c:spPr>` : '');
    const lineSp = (s, i) => `<c:spPr><a:ln w="28575" cap="rnd"><a:solidFill>${clr(s.color || 'accent' + (i % 6 + 1))}</a:solidFill><a:round/></a:ln></c:spPr>`;
    const AX1 = 111111111, AX2 = 222222222;
    const grp = ch.grouping || 'clustered';
    let plot = '';
    const k = ch.kind;
    if (k === 'column' || k === 'bar') {
      plot = `<c:barChart><c:barDir val="${k === 'bar' ? 'bar' : 'col'}"/><c:grouping val="${grp === 'percent' ? 'percentStacked' : grp}"/><c:varyColors val="0"/>${ch.series.map((s, i) => `<c:ser>${serHead(s, i)}${solid(s)}<c:invertIfNegative val="0"/>${(s.pointColors || []).map((c, j) => (c ? `<c:dPt><c:idx val="${j}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr><a:solidFill>${clr(c)}</a:solidFill></c:spPr></c:dPt>` : '')).join('')}${lbl(ch.labels)}${cat}${val(s, i)}</c:ser>`).join('')}<c:gapWidth val="${Math.round(ch.gapWidth == null ? 100 : ch.gapWidth)}"/>${grp !== 'clustered' ? '<c:overlap val="100"/>' : ch.overlap ? `<c:overlap val="${Math.round(ch.overlap)}"/>` : ''}<c:axId val="${AX1}"/><c:axId val="${AX2}"/></c:barChart>`;
    } else if (k === 'line') {
      plot = `<c:lineChart><c:grouping val="standard"/><c:varyColors val="0"/>${ch.series.map((s, i) => `<c:ser>${serHead(s, i)}${lineSp(s, i)}<c:marker><c:symbol val="${ch.marker ? 'circle' : 'none'}"/></c:marker>${lbl(ch.labels)}${cat}${val(s, i)}<c:smooth val="0"/></c:ser>`).join('')}<c:marker val="1"/><c:axId val="${AX1}"/><c:axId val="${AX2}"/></c:lineChart>`;
    } else if (k === 'area') {
      plot = `<c:areaChart><c:grouping val="${grp === 'stacked' ? 'stacked' : grp === 'percent' ? 'percentStacked' : 'standard'}"/><c:varyColors val="0"/>${ch.series.map((s, i) => `<c:ser>${serHead(s, i)}${solid(s)}${lbl(ch.labels)}${cat}${val(s, i)}</c:ser>`).join('')}<c:axId val="${AX1}"/><c:axId val="${AX2}"/></c:areaChart>`;
    } else if (k === 'pie' || k === 'doughnut') {
      const s = ch.series[0] || { name: '', values: [] };
      const dpts = (s.pointColors || []).map((c, j) => (c ? `<c:dPt><c:idx val="${j}"/><c:bubble3D val="0"/><c:spPr><a:solidFill>${clr(c)}</a:solidFill></c:spPr></c:dPt>` : '')).join('');
      const body = `<c:varyColors val="1"/><c:ser>${serHead(s, 0)}${dpts}${lbl(ch.labels)}${cat}${val(s, 0)}</c:ser><c:firstSliceAng val="0"/>`;
      plot = k === 'pie' ? `<c:pieChart>${body}</c:pieChart>` : `<c:doughnutChart>${body}<c:holeSize val="55"/></c:doughnutChart>`;
    } else if (k === 'scatter') {
      plot = `<c:scatterChart><c:scatterStyle val="lineMarker"/><c:varyColors val="0"/>${ch.series.map((s, i) => { const xs = s.xs && s.xs.length ? s.xs : ch.cats.map((c, j) => (isNaN(+c) ? j + 1 : +c)); return `<c:ser>${serHead(s, i)}<c:spPr><a:ln w="19050"><a:noFill/></a:ln></c:spPr><c:marker><c:symbol val="circle"/><c:size val="7"/>${s.color ? `<c:spPr><a:solidFill>${clr(s.color)}</a:solidFill></c:spPr>` : ''}</c:marker>${lbl(ch.labels)}<c:xVal><c:numRef><c:f>Sheet1!$A$2:$A$${last}</c:f>${numCache(xs)}</c:numRef></c:xVal><c:yVal><c:numRef><c:f>Sheet1!$${colName(i + 1)}$2:$${colName(i + 1)}$${last}</c:f>${numCache(s.values.slice(0, n))}</c:numRef></c:yVal><c:smooth val="0"/></c:ser>`; }).join('')}<c:axId val="${AX1}"/><c:axId val="${AX2}"/></c:scatterChart>`;
    } else if (k === 'radar') {
      plot = `<c:radarChart><c:radarStyle val="marker"/><c:varyColors val="0"/>${ch.series.map((s, i) => `<c:ser>${serHead(s, i)}${lineSp(s, i)}<c:marker><c:symbol val="none"/></c:marker>${cat}${val(s, i)}</c:ser>`).join('')}<c:axId val="${AX1}"/><c:axId val="${AX2}"/></c:radarChart>`;
    }
    const grid = ch.grid !== false ? '<c:majorGridlines><c:spPr><a:ln w="9525"><a:solidFill><a:schemeClr val="tx1"><a:lumMod val="15000"/><a:lumOff val="85000"/></a:schemeClr></a:solidFill></a:ln></c:spPr></c:majorGridlines>' : '';
    const hor = k === 'bar';
    const catAx = `<c:catAx><c:axId val="${AX1}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${hor ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${AX2}"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
    const valAx = (axId, cross, pos, g, between) => `<c:valAx><c:axId val="${axId}"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="${pos}"/>${g}<c:numFmt formatCode="General" sourceLinked="1"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/><c:crossAx val="${cross}"/><c:crosses val="autoZero"/><c:crossBetween val="${between}"/></c:valAx>`;
    let axes = '';
    if (k === 'scatter') axes = valAx(AX1, AX2, 'b', '', 'midCat') + valAx(AX2, AX1, 'l', grid, 'midCat');
    else if (k === 'pie' || k === 'doughnut') axes = '';
    else axes = catAx + valAx(AX2, AX1, hor ? 'b' : 'l', grid, k === 'area' ? 'midCat' : 'between');
    const title = ch.showTitle !== false && ch.title ? `<c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${Math.round(fs * 155)}" b="0">${txtClr}</a:defRPr></a:pPr><a:r><a:rPr lang="en-US" sz="${Math.round(fs * 155)}" b="0">${txtClr}</a:rPr><a:t>${X(ch.title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/>` : '<c:autoTitleDeleted val="1"/>';
    const legend = ch.legend && ch.legend !== 'none' ? `<c:legend><c:legendPos val="${ch.legend}"/><c:overlay val="0"/></c:legend>` : '';
    return `${HDR}<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${REL}"><c:roundedCorners val="0"/><c:chart>${title}<c:plotArea><c:layout/>${plot}${axes}</c:plotArea>${legend}<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr><c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="${Math.round(fs * 100)}">${txtClr}</a:defRPr></a:pPr><a:endParaRPr lang="en-US"/></a:p></c:txPr>${hasBook ? '<c:externalData r:id="rId1"><c:autoUpdate val="0"/></c:externalData>' : ''}</c:chartSpace>`;
  };
  /* small workbook so PowerPoint's "Edit Data" works */
  const workbook = async ch => {
    const z = new JSZip();
    z.file('[Content_Types].xml', `${HDR}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`);
    z.file('_rels/.rels', `${HDR}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    z.file('xl/workbook.xml', `${HDR}<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="${REL}"><sheets><sheet name="Sheet1" sheetId="1" r:id="rId1"/></sheets></workbook>`);
    z.file('xl/_rels/workbook.xml.rels', `${HDR}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`);
    const str = (r, v) => `<c r="${r}" t="inlineStr"><is><t>${X(v)}</t></is></c>`, nm = (r, v) => `<c r="${r}"><v>${+v || 0}</v></c>`;
    let rows = `<row r="1">${str('A1', ' ')}${ch.series.map((s, i) => str(colName(i + 1) + '1', s.name)).join('')}</row>`;
    ch.cats.forEach((c, r) => { const isNum = ch.kind === 'scatter' && !isNaN(+c); rows += `<row r="${r + 2}">${isNum ? nm('A' + (r + 2), c) : str('A' + (r + 2), c)}${ch.series.map((s, i) => nm(colName(i + 1) + (r + 2), s.values[r])).join('')}</row>`; });
    z.file('xl/worksheets/sheet1.xml', `${HDR}<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rows}</sheetData></worksheet>`);
    return z.generateAsync({ type: 'uint8array' });
  };

  /* ---------- animation ---------- */
  const SUB = { fromBottom: 4, fromLeft: 8, fromRight: 2, fromTop: 1 };
  const animNodes = (a, spid, tid, para) => {
    const tgt = `<p:tgtEl><p:spTgt spid="${spid}">${para != null ? `<p:txEl><p:pRg st="${para}" end="${para}"/></p:txEl>` : ''}</p:spTgt></p:tgtEl>`;
    const dur = a.dur == null ? P.animDefaultDur(a.effect) : a.dur, m = P.animMeta(a.effect);
    const setVis = (val, delay = 0) => `<p:set><p:cBhvr><p:cTn id="${tid()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="${delay}"/></p:stCondLst></p:cTn>${tgt}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="${val}"/></p:to></p:set>`;
    const effect = (filter, tr) => `<p:animEffect transition="${tr}" filter="${filter}"><p:cBhvr><p:cTn id="${tid()}" dur="${dur}"/>${tgt}</p:cBhvr></p:animEffect>`;
    const anim = (attr, from, to) => `<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="${tid()}" dur="${dur}" fill="hold"/>${tgt}<p:attrNameLst><p:attrName>${attr}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val><p:strVal val="${from}"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="${to}"/></p:val></p:tav></p:tavLst></p:anim>`;
    const dirF = { fromLeft: 'left', fromRight: 'right', fromTop: 'up', fromBottom: 'down' }[a.dir] || 'left';
    const barn = (d => ({ horzIn: 'inHorizontal', horzOut: 'outHorizontal', vertIn: 'inVertical', vertOut: 'outVertical' }[d] || 'outVertical'))(a.dir);
    const FLY = { fromBottom: ['ppt_y', '1+#ppt_h/2', '#ppt_y'], fromTop: ['ppt_y', '0-#ppt_h/2', '#ppt_y'], fromLeft: ['ppt_x', '0-#ppt_w/2', '#ppt_x'], fromRight: ['ppt_x', '1+#ppt_w/2', '#ppt_x'] };
    const fly = FLY[a.dir] ? a.dir : 'fromBottom';
    const flyFrom = FLY[fly];
    const other = flyFrom[0] === 'ppt_y' ? ['ppt_x', '#ppt_x', '#ppt_x'] : ['ppt_y', '#ppt_y', '#ppt_y'];
    const scaleBy = (s, half) => `<p:animScale><p:cBhvr><p:cTn id="${tid()}" dur="${half}" autoRev="1" fill="hold"/>${tgt}</p:cBhvr><p:by x="${s}" y="${s}"/></p:animScale>`;
    const rot = (by, d = dur) => `<p:animRot by="${by}"><p:cBhvr><p:cTn id="${tid()}" dur="${d}" fill="hold"/>${tgt}<p:attrNameLst><p:attrName>r</p:attrName></p:attrNameLst></p:cBhvr></p:animRot>`;
    const motion = path => `<p:animMotion origin="layout" path="${path}" pathEditMode="relative" ptsTypes=""><p:cBhvr><p:cTn id="${tid()}" dur="${dur}" fill="hold"/>${tgt}<p:attrNameLst><p:attrName>ppt_x</p:attrName><p:attrName>ppt_y</p:attrName></p:attrNameLst></p:cBhvr></p:animMotion>`;
    let body = '', sub = 0, preset = m ? m.preset : 10, cls = m ? m.cat : 'entr';
    const exitHide = () => setVis('hidden', Math.max(0, dur - 1));
    switch (a.effect) {
      case 'appear': body = setVis('visible'); preset = 1; break;
      case 'disappear': body = setVis('hidden'); preset = 1; break;
      case 'fade': body = setVis('visible') + effect('fade', 'in'); break;
      case 'fadeOut': body = effect('fade', 'out') + exitHide(); break;
      case 'flyIn': sub = SUB[fly]; body = setVis('visible') + anim(other[0], other[1], other[2]) + anim(flyFrom[0], flyFrom[1], flyFrom[2]); break;
      case 'flyOut': sub = SUB[fly]; body = anim(other[0], other[1], other[2]) + anim(flyFrom[0], flyFrom[2], flyFrom[1]) + exitHide(); break;
      case 'floatIn': body = setVis('visible') + effect('fade', 'in') + anim('ppt_y', a.dir === 'down' ? '#ppt_y-.1' : '#ppt_y+.1', '#ppt_y'); preset = a.dir === 'down' ? 47 : 42; break;
      case 'floatOut': body = effect('fade', 'out') + anim('ppt_y', '#ppt_y', a.dir === 'down' ? '#ppt_y+.1' : '#ppt_y-.1') + exitHide(); preset = a.dir === 'down' ? 47 : 42; break;
      case 'split': body = setVis('visible') + effect(`barn(${barn})`, 'in'); sub = { outVertical: 42, inVertical: 37, outHorizontal: 26, inHorizontal: 21 }[barn]; break;
      case 'splitOut': body = effect(`barn(${barn})`, 'out') + exitHide(); sub = { outVertical: 42, inVertical: 37, outHorizontal: 26, inHorizontal: 21 }[barn]; break;
      case 'wipe': body = setVis('visible') + effect(`wipe(${dirF})`, 'in'); sub = { left: 8, right: 2, up: 1, down: 4 }[dirF]; break;
      case 'wipeOut': body = effect(`wipe(${dirF})`, 'out') + exitHide(); sub = { left: 8, right: 2, up: 1, down: 4 }[dirF]; break;
      case 'shape': body = setVis('visible') + effect('circle(in)', 'in'); sub = 32; preset = 6; break;
      case 'shapeOut': body = effect('circle(in)', 'out') + exitHide(); sub = 32; preset = 6; break;
      case 'wheel': body = setVis('visible') + effect('wheel(1)', 'in'); sub = 1; break;
      case 'wheelOut': body = effect('wheel(1)', 'out') + exitHide(); sub = 1; break;
      case 'randomBars': body = setVis('visible') + effect(`randombar(${a.dir === 'vert' ? 'vertical' : 'horizontal'})`, 'in'); sub = a.dir === 'vert' ? 5 : 10; break;
      case 'randomBarsOut': body = effect(`randombar(${a.dir === 'vert' ? 'vertical' : 'horizontal'})`, 'out') + exitHide(); sub = a.dir === 'vert' ? 5 : 10; break;
      case 'growTurn': body = setVis('visible') + anim('ppt_w', '0', '#ppt_w') + anim('ppt_h', '0', '#ppt_h') + effect('fade', 'in'); break;
      case 'shrinkTurn': body = anim('ppt_w', '#ppt_w', '0') + anim('ppt_h', '#ppt_h', '0') + effect('fade', 'out') + exitHide(); break;
      case 'zoom': body = setVis('visible') + anim('ppt_w', '0', '#ppt_w') + anim('ppt_h', '0', '#ppt_h') + effect('fade', 'in'); break;
      case 'zoomOut': body = anim('ppt_w', '#ppt_w', '0') + anim('ppt_h', '#ppt_h', '0') + effect('fade', 'out') + exitHide(); break;
      case 'swivel': body = setVis('visible') + anim('ppt_w', '0', '#ppt_w') + anim('ppt_h', '#ppt_h', '#ppt_h'); sub = 10; break;
      case 'swivelOut': body = anim('ppt_w', '#ppt_w', '0') + anim('ppt_h', '#ppt_h', '#ppt_h') + exitHide(); sub = 10; break;
      case 'bounce': body = setVis('visible') + anim('ppt_y', '0-#ppt_h/2', '#ppt_y') + anim('ppt_x', '#ppt_x', '#ppt_x'); break;
      case 'bounceOut': body = anim('ppt_y', '#ppt_y', '1+#ppt_h/2') + anim('ppt_x', '#ppt_x', '#ppt_x') + exitHide(); break;
      case 'pulse': case 'wave': case 'bold': body = scaleBy(105000, Math.round(dur / 2)); break;
      case 'colorPulse': body = scaleBy(102000, Math.round(dur / 2)); break;
      case 'growShrink': body = scaleBy(125000, Math.round(dur / 2)); break;
      case 'teeter': body = rot(180000, Math.round(dur / 4)) + rot(-180000, Math.round(dur / 4)); break;
      case 'spin': body = rot(21600000); break;
      case 'flash': body = effect('fade', 'out'); break;
      case 'lineDown': body = motion('M 0 0 L 0 0.25 E'); break;
      case 'lineUp': body = motion('M 0 0 L 0 -0.25 E'); break;
      case 'lineLeft': body = motion('M 0 0 L -0.25 0 E'); break;
      case 'lineRight': body = motion('M 0 0 L 0.25 0 E'); break;
      case 'arc': body = motion('M 0 0 C 0 -0.2 0.25 -0.2 0.25 0 E'); break;
      case 'turn': body = motion('M 0 0 C 0.15 0 0.25 0.1 0.25 0.25 E'); break;
      case 'circle': body = motion('M 0 0 C 0.1 0 0.15 0.08 0.15 0.15 C 0.15 0.22 0.1 0.3 0 0.3 C -0.1 0.3 -0.15 0.22 -0.15 0.15 C -0.15 0.08 -0.1 0 0 0 Z'); break;
      case 'loop': body = motion('M 0 0 C 0.15 -0.15 0.15 0.15 0 0 C -0.15 -0.15 -0.15 0.15 0 0 Z'); break;
      default: body = setVis('visible') + effect('fade', 'in');
    }
    return { body, preset, sub, cls };
  };
  const timingXml = (slide, ctx) => {
    const list = slide.animations || []; if (!list.length) return '';
    let n = 2; const tid = () => ++n;
    /* expand paragraph builds */
    const seq = [];
    list.forEach(a => {
      const el = P.findEl(a.el, slide); if (!el) return; const spid = ctx.idOf(a.el);
      if (a.by === 'para' && el.paras) { let pi = 0; el.paras.forEach((p, i) => { if ((p.runs || []).some(r => r.t)) { seq.push({ a, spid, para: i, start: pi === 0 ? a.start : (a.start === 'click' ? 'click' : 'after'), delay: pi === 0 ? (a.delay || 0) : 0, el }); pi++; } }); }
      else seq.push({ a, spid, para: null, start: a.start, delay: a.delay || 0, el });
    });
    if (!seq.length) return '';
    /* group: clicks -> outer pars, afters -> inner pars */
    const clicks = []; let cur = null;
    seq.forEach((s, i) => { if (s.start === 'click' || !cur) { cur = { auto: s.start !== 'click', inner: [] }; clicks.push(cur); cur.inner.push({ items: [s], offset: 0 }); } else if (s.start === 'after') cur.inner.push({ items: [s] }); else cur.inner[cur.inner.length - 1].items.push(s); void i; });
    const durOf = s => (s.a.dur == null ? P.animDefaultDur(s.a.effect) : s.a.dur) * (s.a.repeat || 1) + s.delay;
    const grpIds = new Map();
    let xml = '';
    clicks.forEach(c => {
      const outerId = tid(); let innerXml = ''; let t = 0;
      c.inner.forEach((grp2, gi) => {
        const innerId = tid();
        let effs = '';
        grp2.items.forEach((s, si) => {
          const node = (gi === 0 && si === 0 && !c.auto) ? 'clickEffect' : (si === 0 && (gi > 0 || c.auto) && s.start === 'after') ? 'afterEffect' : (si === 0 && c.auto && gi === 0) ? (s.start === 'after' ? 'afterEffect' : 'withEffect') : 'withEffect';
          const effId = tid(); const nodes = animNodes(s.a, s.spid, tid, s.para);
          const isText = !s.el.type || s.el.type === 'shape';
          if (isText) grpIds.set(s.spid, { build: s.a.by === 'para', hasBg: s.el.fill && s.el.fill.type !== 'none' || (s.el.line && s.el.line.type !== 'none') });
          const rep = s.a.repeat > 1 ? ` repeatCount="${s.a.repeat * 1000}"` : '';
          effs += `<p:par><p:cTn id="${effId}" presetID="${nodes.preset}" presetClass="${nodes.cls}" presetSubtype="${nodes.sub}"${rep} fill="hold"${isText ? ' grpId="0"' : ''} nodeType="${node}"><p:stCondLst><p:cond delay="${s.delay}"/></p:stCondLst><p:childTnLst>${nodes.body}</p:childTnLst></p:cTn></p:par>`;
        });
        innerXml += `<p:par><p:cTn id="${innerId}" fill="hold"><p:stCondLst><p:cond delay="${t}"/></p:stCondLst><p:childTnLst>${effs}</p:childTnLst></p:cTn></p:par>`;
        t += Math.max(...grp2.items.map(durOf));
      });
      const cond = c.auto ? '<p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond>' : '<p:cond delay="indefinite"/>';
      xml += `<p:par><p:cTn id="${outerId}" fill="hold"><p:stCondLst>${cond}</p:stCondLst><p:childTnLst>${innerXml}</p:childTnLst></p:cTn></p:par>`;
    });
    const bld = [...grpIds.entries()].map(([spid, o]) => `<p:bldP spid="${spid}" grpId="0"${o.build ? ' build="p"' : ''}${o.hasBg && !o.build ? ' animBg="1"' : ''}/>`).join('');
    return `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst>${xml}</p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>${bld ? `<p:bldLst>${bld}</p:bldLst>` : ''}</p:timing>`;
  };
  /* ---------- transition ---------- */
  const transitionXml = tr => {
    if (!tr) return '';
    const type = tr.type || 'none', dir = tr.dir; const dur = tr.dur;
    const adv = (tr.advClick === false ? ' advClick="0"' : '') + (tr.advAfter != null ? ` advTm="${Math.round(tr.advAfter)}"` : '');
    let inner = '', p14 = false;
    switch (type) {
      case 'none': break;
      case 'cut': inner = '<p:cut/>'; break;
      case 'fade': inner = '<p:fade/>'; break;
      case 'push': inner = `<p:push dir="${dir || 'l'}"/>`; break;
      case 'wipe': inner = `<p:wipe dir="${dir || 'l'}"/>`; break;
      case 'split': { const d = dir || 'vertOut'; inner = `<p:split orient="${d.startsWith('horz') ? 'horz' : 'vert'}" dir="${d.endsWith('In') ? 'in' : 'out'}"/>`; break; }
      case 'pull': inner = `<p:pull dir="${dir || 'l'}"/>`; break;
      case 'cover': inner = `<p:cover dir="${dir || 'l'}"/>`; break;
      case 'randomBar': inner = `<p:randomBar dir="${dir === 'vert' ? 'vert' : 'horz'}"/>`; break;
      case 'blinds': inner = `<p:blinds dir="${dir === 'vert' ? 'vert' : 'horz'}"/>`; break;
      case 'checker': inner = '<p:checker/>'; break;
      case 'circle': inner = '<p:circle/>'; break;
      case 'diamond': inner = '<p:diamond/>'; break;
      case 'plus': inner = '<p:plus/>'; break;
      case 'zoom': inner = `<p:zoom dir="${dir === 'out' ? 'out' : 'in'}"/>`; break;
      case 'dissolve': inner = '<p:dissolve/>'; break;
      case 'clock': inner = '<p:wheel spokes="1"/>'; break;
      case 'wheel': inner = '<p:wheel spokes="4"/>'; break;
      case 'wedge': inner = '<p:wedge/>'; break;
      case 'newsflash': inner = '<p:newsflash/>'; break;
      case 'flash': inner = '<p14:flash/>'; p14 = true; break;
      case 'cube': inner = `<p14:prism${dir && dir !== 'l' ? ` dir="${dir}"` : ''}/>`; p14 = true; break;
      case 'flip': inner = `<p14:flip dir="${dir === 'r' ? 'r' : 'l'}"/>`; p14 = true; break;
      case 'doors': inner = '<p14:doors dir="vert"/>'; p14 = true; break;
      case 'gallery': inner = `<p14:gallery dir="${dir === 'r' ? 'r' : 'l'}"/>`; p14 = true; break;
      default: inner = '<p:fade/>';
    }
    if (!inner && !adv) return '';
    const spd = dur != null ? (dur < 600 ? 'fast' : dur < 1000 ? 'med' : 'slow') : 'med';
    const fallback = `<p:transition spd="${spd}"${adv}>${p14 ? '<p:fade/>' : inner}</p:transition>`;
    if (!dur && !p14) return fallback;
    return `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:p14="${P14}" Requires="p14"><p:transition spd="${spd}" p14:dur="${Math.round(dur || 700)}"${adv}>${inner}</p:transition></mc:Choice><mc:Fallback>${fallback}</mc:Fallback></mc:AlternateContent>`;
  };

  /* ---------- theme / master ---------- */
  const themeXml = (th, name) => {
    const c = th.colors; const sc = (tag, hex) => `<a:${tag}><a:srgbClr val="${hex.slice(1).toUpperCase()}"/></a:${tag}>`;
    const fmt = `<a:fmtScheme name="Office"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:lumMod val="110000"/><a:satMod val="105000"/><a:tint val="67000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="105000"/><a:satMod val="109000"/><a:tint val="81000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:satMod val="103000"/><a:lumMod val="102000"/><a:tint val="94000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:lumMod val="99000"/><a:satMod val="120000"/><a:shade val="78000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln><a:ln w="12700" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln><a:ln w="19050" cap="flat" cmpd="sng" algn="ctr"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:prstDash val="solid"/><a:miter lim="800000"/></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst><a:outerShdw blurRad="57150" dist="19050" dir="5400000" algn="ctr" rotWithShape="0"><a:srgbClr val="000000"><a:alpha val="63000"/></a:srgbClr></a:outerShdw></a:effectLst></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill><a:solidFill><a:schemeClr val="phClr"><a:tint val="95000"/><a:satMod val="170000"/></a:schemeClr></a:solidFill><a:gradFill rotWithShape="1"><a:gsLst><a:gs pos="0"><a:schemeClr val="phClr"><a:tint val="93000"/><a:satMod val="150000"/><a:shade val="98000"/><a:lumMod val="102000"/></a:schemeClr></a:gs><a:gs pos="100000"><a:schemeClr val="phClr"><a:tint val="98000"/><a:satMod val="130000"/><a:shade val="90000"/><a:lumMod val="103000"/></a:schemeClr></a:gs></a:gsLst><a:lin ang="5400000" scaled="0"/></a:gradFill></a:bgFillStyleLst></a:fmtScheme>`;
    return `${HDR}<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="${X(name)}"><a:themeElements><a:clrScheme name="${X(name)}">${['dk1', 'lt1', 'dk2', 'lt2', 'accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6', 'hlink', 'folHlink'].map(k => sc(k, c[k])).join('')}</a:clrScheme><a:fontScheme name="${X(name)}"><a:majorFont><a:latin typeface="${X(th.fonts.major)}"/><a:ea typeface=""/><a:cs typeface=""/></a:majorFont><a:minorFont><a:latin typeface="${X(th.fonts.minor)}"/><a:ea typeface=""/><a:cs typeface=""/></a:minorFont></a:fontScheme>${fmt}</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>`;
  };
  const bgXml = (bg, ctx) => { if (!bg) return ''; if (bg.type === 'none') return ''; return `<p:bg><p:bgPr>${fillXml(bg, ctx)}<a:effectLst/></p:bgPr></p:bg>`; };
  const spTree = (els, ctx) => `<p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>${els.map(e => elXml(e, ctx)).join('')}</p:spTree>`;
  const LAYTYPES = new Set(['title', 'tx', 'twoColTx', 'tbl', 'txAndChart', 'chartAndTx', 'dgm', 'chart', 'txAndClipArt', 'clipArtAndTx', 'titleOnly', 'blank', 'txAndObj', 'objAndTx', 'objOnly', 'obj', 'txAndMedia', 'mediaAndTx', 'objOverTx', 'txOverObj', 'txAndTwoObj', 'twoObjAndTx', 'twoObjOverTx', 'fourObj', 'vertTx', 'clipArtAndVertTx', 'vertTitleAndTx', 'vertTitleAndTxOverChart', 'twoObj', 'objAndTwoObj', 'twoObjAndObj', 'cust', 'secHead', 'twoTxTwoObj', 'objTx', 'picTx']);

  /* ---------- package ---------- */
  const ext = (mime, name) => {
    const m = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/jpg': 'jpeg', 'image/gif': 'gif', 'image/bmp': 'bmp', 'image/webp': 'png', 'image/svg+xml': 'png', 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov', 'audio/mpeg': 'mp3', 'audio/mp3': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav', 'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/ogg': 'ogg', 'audio/webm': 'webm', 'video/x-msvideo': 'avi', 'video/x-ms-wmv': 'wmv', 'image/tiff': 'tiff', 'image/x-emf': 'emf', 'image/x-wmf': 'wmf' };
    return m[mime] || ((name || '').match(/\.(\w+)$/) || [])[1] || 'bin';
  };
  const blackPng = async (w = 640, hh = 360, audio) => { const c = document.createElement('canvas'); c.width = audio ? 96 : w; c.height = audio ? 96 : hh; const x = c.getContext('2d'); if (audio) { x.fillStyle = '#4472C4'; x.beginPath(); x.arc(48, 48, 46, 0, 7); x.fill(); x.fillStyle = '#fff'; x.fillRect(26, 38, 14, 20); x.beginPath(); x.moveTo(40, 38); x.lineTo(58, 24); x.lineTo(58, 72); x.lineTo(40, 58); x.fill(); } else { x.fillStyle = '#000'; x.fillRect(0, 0, w, hh); x.fillStyle = 'rgba(255,255,255,.85)'; x.beginPath(); x.moveTo(w / 2 - 30, hh / 2 - 40); x.lineTo(w / 2 + 40, hh / 2); x.lineTo(w / 2 - 30, hh / 2 + 40); x.fill(); } return new Promise(r => c.toBlob(r, 'image/png')); };
  /* webp/svg and adjustments the file format lacks are baked to PNG */
  const toPng = async (blob, filter) => { const url = URL.createObjectURL(blob); try { const im = await P.loadImage(url); const c = document.createElement('canvas'); c.width = im.naturalWidth || 800; c.height = im.naturalHeight || 600; const x = c.getContext('2d'); if (filter) x.filter = filter; x.drawImage(im, 0, 0, c.width, c.height); return await new Promise(r => c.toBlob(r, 'image/png')); } finally { URL.revokeObjectURL(url); } };

  P.writePptx = async (deck) => {
    const zip = new JSZip();
    const overrides = []; const defaults = new Map([['rels', 'application/vnd.openxmlformats-package.relationships+xml'], ['xml', 'application/xml']]);
    const mimeExt = { png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', mp3: 'audio/mpeg', wav: 'audio/wav', m4a: 'audio/mp4', ogg: 'audio/ogg', avi: 'video/x-msvideo', wmv: 'video/x-ms-wmv', tiff: 'image/tiff', emf: 'image/x-emf', wmf: 'image/x-wmf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', bin: 'application/octet-stream' };
    const addOverride = (part, type) => overrides.push(`<Override PartName="${part}" ContentType="${type}"/>`);
    const mediaFiles = new Map(); let mediaN = 0, chartN = 0;
    const prev = P.deck; P.deck = deck; /* helpers such as P.findEl/P.color read this */
    const writeMediaBlob = async (key, blob, nameHint, forcePng) => {
      if (mediaFiles.has(key)) return mediaFiles.get(key);
      let b = blob, e = ext(blob.type, nameHint);
      if (forcePng || /webp|svg/.test(blob.type)) { b = await toPng(blob, forcePng === true ? '' : forcePng); e = 'png'; }
      const path = `media/media${++mediaN}.${e}`; zip.file('ppt/' + path, b); defaults.set(e, mimeExt[e] || blob.type || 'application/octet-stream'); mediaFiles.set(key, path); return path;
    };
    /* pre-collect media that needs async work */
    const allPages = [deck.master, ...deck.layouts, ...deck.slides];
    const prepared = new Map();
    const adjustFilter = a => { const f = []; if (a.sat != null && a.sat !== 100) f.push(`saturate(${a.sat / 100})`); if (a.sepia) f.push('sepia(.8)'); if (a.hue) f.push(`hue-rotate(${a.hue}deg)`); if (a.blur) f.push(`blur(${a.blur}px)`); if (a.invert) f.push('invert(1)'); return f.join(' '); };
    for (const pg of allPages) {
      const stack = [...pg.elements]; if (pg.bg && pg.bg.type === 'picture') stack.push({ fill: pg.bg });
      while (stack.length) {
        const e = stack.pop(); if (e.children) stack.push(...e.children);
        const srcs = [];
        if (e.type === 'image') { const fil = e.adjust ? adjustFilter(e.adjust) : ''; srcs.push([e.src, fil]); }
        if (e.fill && e.fill.type === 'picture') srcs.push([e.fill.src, '']);
        for (const [s, fil] of srcs) { if (!s || !s.startsWith('media:')) continue; const m = deck.media[s.slice(6)]; if (!m) continue; const key = s + '|' + fil; if (!prepared.has(key)) prepared.set(key, await writeMediaBlob(key, m.blob, m.name, fil || false)); }
        if (e.type === 'video' || e.type === 'audio') {
          const m = deck.media[e.src && e.src.slice(6)]; if (m) { await writeMediaBlob(e.src, m.blob, m.name); }
          if (e.poster && deck.media[e.poster.slice(6)]) await writeMediaBlob(e.poster, deck.media[e.poster.slice(6)].blob, 'poster');
          const dk = 'poster-' + e.type; if (!e.poster && !mediaFiles.has(dk)) await writeMediaBlob(dk, await blackPng(640, 360, e.type === 'audio'), 'poster.png');
        }
      }
    }
    const slideFile = new Map(); deck.slides.forEach((s, i) => slideFile.set(s.id, i + 1));
    const makeCtx = (page, base) => {
      const rels = []; let n = base || 0; const add = (type, target, ext2) => { const id = `rId${++n}`; rels.push(`<Relationship Id="${id}" Type="${type}" Target="${X(target)}"${ext2 ? ' TargetMode="External"' : ''}/>`); return id; };
      const ids = new Map(); let nx = 1;
      const ctx = {
        page, rels, add,
        idOf: id => { if (!ids.has(id)) ids.set(id, ++nx); return ids.get(id); },
        addImage: (src, el) => { if (!src) return null; if (!src.startsWith('media:')) return null; const fil = el && el.adjust ? adjustFilter(el.adjust) : ''; const path = mediaFiles.get(src + '|' + fil) || mediaFiles.get(src + '|'); if (!path) return null; return add(`${REL}/image`, '../' + path); },
        addLink: url => add(`${REL}/hyperlink`, url, true),
        addSlideLink: sid => { const f = slideFile.get(sid); if (!f) return null; return add(`${REL}/slide`, `slide${f}.xml`); },
        addMedia: el => { const path = mediaFiles.get(el.src); const posterP = el.poster ? mediaFiles.get(el.poster) : mediaFiles.get('poster-' + el.type); return { rel1: add(`${REL}/${el.type}`, '../' + path), rel2: add('http://schemas.microsoft.com/office/2007/relationships/media', '../' + path), posterRid: add(`${REL}/image`, '../' + posterP) }; },
        addChart: el => { const k = ++chartN; ctx.charts = ctx.charts || []; ctx.charts.push({ k, el }); return add(`${REL}/chart`, `../charts/chart${k}.xml`); }
      };
      /* assign ids in tree order first so connectors & timing refer to stable values */
      P.walk(page.elements, e => ctx.idOf(e.id));
      return ctx;
    };
    const writeCharts = async ctx => {
      for (const { k, el } of ctx.charts || []) {
        zip.file(`ppt/charts/chart${k}.xml`, chartXml(el.chart, true, el));
        addOverride(`/ppt/charts/chart${k}.xml`, 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml');
        const book = await workbook(el.chart); zip.file(`ppt/embeddings/Microsoft_Excel_Sheet${k}.xlsx`, book); defaults.set('xlsx', mimeExt.xlsx);
        zip.file(`ppt/charts/_rels/chart${k}.xml.rels`, relsDoc([`<Relationship Id="rId1" Type="${REL}/package" Target="../embeddings/Microsoft_Excel_Sheet${k}.xlsx"/>`]));
      }
    };
    const relsDoc = list => `${HDR}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${list.join('')}</Relationships>`;

    /* --- theme --- */
    zip.file('ppt/theme/theme1.xml', themeXml(deck.theme, deck.theme.name || 'Office Theme'));
    addOverride('/ppt/theme/theme1.xml', 'application/vnd.openxmlformats-officedocument.theme+xml');
    zip.file('ppt/theme/theme2.xml', themeXml(deck.theme, 'Notes Theme'));
    addOverride('/ppt/theme/theme2.xml', 'application/vnd.openxmlformats-officedocument.theme+xml');

    /* --- layouts --- */
    const layFile = new Map();
    deck.layouts.forEach((l, i) => layFile.set(l.id, i + 1));
    for (let i = 0; i < deck.layouts.length; i++) {
      const l = deck.layouts[i], ctx = makeCtx(l, 1);
      const typeAttr = LAYTYPES.has(l.type) ? ` type="${l.type}"` : '';
      const xml = `${HDR}<p:sldLayout ${NS}${typeAttr} preserve="1"${l.showMaster === false ? ' showMasterSp="0"' : ''}><p:cSld name="${X(l.name)}">${bgXml(l.bg, ctx)}${spTree(l.elements, ctx)}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>`;
      zip.file(`ppt/slideLayouts/slideLayout${i + 1}.xml`, xml);
      addOverride(`/ppt/slideLayouts/slideLayout${i + 1}.xml`, 'application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml');
      zip.file(`ppt/slideLayouts/_rels/slideLayout${i + 1}.xml.rels`, relsDoc([`<Relationship Id="rId1" Type="${REL}/slideMaster" Target="../slideMasters/slideMaster1.xml"/>`, ...ctx.rels]));
      await writeCharts(ctx);
    }
    /* --- master --- */
    {
      const m = deck.master, ctx = makeCtx(m, deck.layouts.length + 1);
      const map = deck.theme.map || {}; const cm = k => map[k] || ({ bg1: 'lt1', tx1: 'dk1', bg2: 'lt2', tx2: 'dk2' })[k];
      const clrMap = `<p:clrMap bg1="${cm('bg1')}" tx1="${cm('tx1')}" bg2="${cm('bg2')}" tx2="${cm('tx2')}" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>`;
      const ids = deck.layouts.map((l, i) => `<p:sldLayoutId id="${2147483649 + i}" r:id="rId${i + 1}"/>`).join('');
      const ts = m.txStyles; const lv = (l, i) => lvlProps(l, `a:lvl${i + 1}pPr`, ctx);
      const txS = `<p:txStyles><p:titleStyle>${lvlProps(ts.title, 'a:lvl1pPr', ctx)}</p:titleStyle><p:bodyStyle>${ts.body.map(lv).join('')}</p:bodyStyle><p:otherStyle>${lvlProps(ts.other, 'a:lvl1pPr', ctx)}</p:otherStyle></p:txStyles>`;
      const xml = `${HDR}<p:sldMaster ${NS}><p:cSld>${bgXml(m.bg, ctx)}${spTree(m.elements, ctx)}</p:cSld>${clrMap}<p:sldLayoutIdLst>${ids}</p:sldLayoutIdLst>${txS}</p:sldMaster>`;
      zip.file('ppt/slideMasters/slideMaster1.xml', xml);
      addOverride('/ppt/slideMasters/slideMaster1.xml', 'application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml');
      const lrels = deck.layouts.map((l, i) => `<Relationship Id="rId${i + 1}" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout${i + 1}.xml"/>`);
      zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', relsDoc([...lrels, `<Relationship Id="rId${deck.layouts.length + 1}" Type="${REL}/theme" Target="../theme/theme1.xml"/>`, ...ctx.rels]));
      await writeCharts(ctx);
    }
    /* --- notes master --- */
    const hasNotes = deck.slides.some(s => s.notes);
    if (hasNotes) {
      const nm = `${HDR}<p:notesMaster ${NS}><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="1143000"/><a:ext cx="5486400" cy="3086100"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="12700"><a:solidFill><a:prstClr val="black"/></a:solidFill></a:ln></p:spPr></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr><p:spPr><a:xfrm><a:off x="685800" y="4400550"/><a:ext cx="5486400" cy="3600450"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr><p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:pPr lvl="0"/><a:r><a:rPr lang="en-US"/><a:t>Click to edit Master text styles</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:notesStyle><a:lvl1pPr marL="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr></p:notesStyle></p:notesMaster>`;
      zip.file('ppt/notesMasters/notesMaster1.xml', nm);
      addOverride('/ppt/notesMasters/notesMaster1.xml', 'application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml');
      zip.file('ppt/notesMasters/_rels/notesMaster1.xml.rels', relsDoc([`<Relationship Id="rId1" Type="${REL}/theme" Target="../theme/theme2.xml"/>`]));
    }
    /* --- comment authors --- */
    const authors = []; const authorOf = a => { let i = authors.indexOf(a); if (i < 0) { authors.push(a); i = authors.length - 1; } return i; };
    /* --- slides --- */
    let cmFile = 0;
    for (let i = 0; i < deck.slides.length; i++) {
      const s = deck.slides[i], ctx = makeCtx(s, 1), f = i + 1;
      const layN = layFile.get(s.layout) || 1;
      const tree = spTree(s.elements, ctx);
      const bg = bgXml(s.bg, ctx);
      const xml = `${HDR}<p:sld ${NS}${s.hidden ? ' show="0"' : ''}${s.showMaster === false ? ' showMasterSp="0"' : ''}><p:cSld>${bg}${tree}</p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>${transitionXml(s.transition)}${timingXml(s, ctx)}</p:sld>`;
      zip.file(`ppt/slides/slide${f}.xml`, xml);
      addOverride(`/ppt/slides/slide${f}.xml`, 'application/vnd.openxmlformats-officedocument.presentationml.slide+xml');
      const rels = [`<Relationship Id="rId1" Type="${REL}/slideLayout" Target="../slideLayouts/slideLayout${layN}.xml"/>`, ...ctx.rels];
      if (s.notes) {
        const rn = `rId${ctx.rels.length + 2}`; rels.push(`<Relationship Id="${rn}" Type="${REL}/notesSlide" Target="../notesSlides/notesSlide${f}.xml"/>`);
        const paras = s.notes.split('\n').map(t => `<a:p><a:r><a:rPr lang="en-US" dirty="0"/><a:t>${X(t)}</a:t></a:r></a:p>`).join('');
        zip.file(`ppt/notesSlides/notesSlide${f}.xml`, `${HDR}<p:notes ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:sp><p:nvSpPr><p:cNvPr id="2" name="Slide Image Placeholder 1"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg"/></p:nvPr></p:nvSpPr><p:spPr/></p:sp><p:sp><p:nvSpPr><p:cNvPr id="3" name="Notes Placeholder 2"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/><p:txBody><a:bodyPr/><a:lstStyle/>${paras}</p:txBody></p:sp></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>`);
        addOverride(`/ppt/notesSlides/notesSlide${f}.xml`, 'application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml');
        zip.file(`ppt/notesSlides/_rels/notesSlide${f}.xml.rels`, relsDoc([`<Relationship Id="rId1" Type="${REL}/notesMaster" Target="../notesMasters/notesMaster1.xml"/>`, `<Relationship Id="rId2" Type="${REL}/slide" Target="../slides/slide${f}.xml"/>`]));
      }
      if (s.comments && s.comments.length) {
        cmFile++; const rn = `rId${ctx.rels.length + (s.notes ? 3 : 2)}`; rels.push(`<Relationship Id="${rn}" Type="${REL}/comments" Target="../comments/comment${cmFile}.xml"/>`);
        const cms = s.comments.map((c, k) => { const flat = c.text + (c.replies || []).map(r => `\n${r.author}: ${r.text}`).join(''); const d = (c.date ? new Date(c.date) : new Date()).toISOString().replace('Z', ''); return `<p:cm authorId="${authorOf(c.author || 'Author')}" dt="${d}" idx="${k + 1}"><p:pos x="${Math.round((c.x || 10) * 8)}" y="${Math.round((c.y || 10) * 8)}"/><p:text>${X(flat)}</p:text></p:cm>`; }).join('');
        zip.file(`ppt/comments/comment${cmFile}.xml`, `${HDR}<p:cmLst ${NS}>${cms}</p:cmLst>`);
        addOverride(`/ppt/comments/comment${cmFile}.xml`, 'application/vnd.openxmlformats-officedocument.presentationml.comments+xml');
      }
      zip.file(`ppt/slides/_rels/slide${f}.xml.rels`, relsDoc(rels));
      await writeCharts(ctx);
    }
    /* --- presentation --- */
    const presRels = [`<Relationship Id="rId1" Type="${REL}/slideMaster" Target="slideMasters/slideMaster1.xml"/>`]; let rn = 1;
    const slideRid = deck.slides.map((s, i) => { const id = `rId${++rn}`; presRels.push(`<Relationship Id="${id}" Type="${REL}/slide" Target="slides/slide${i + 1}.xml"/>`); return id; });
    let notesRef = ''; if (hasNotes) { const id = `rId${++rn}`; presRels.push(`<Relationship Id="${id}" Type="${REL}/notesMaster" Target="notesMasters/notesMaster1.xml"/>`); notesRef = `<p:notesMasterIdLst><p:notesMasterId r:id="${id}"/></p:notesMasterIdLst>`; }
    if (authors.length) { const id = `rId${++rn}`; presRels.push(`<Relationship Id="${id}" Type="${REL}/commentAuthors" Target="commentAuthors.xml"/>`); zip.file('ppt/commentAuthors.xml', `${HDR}<p:cmAuthorLst ${NS}>${authors.map((a, i) => `<p:cmAuthor id="${i}" name="${X(a)}" initials="${X(a.split(/\s+/).map(w => w[0]).join('').slice(0, 3))}" lastIdx="99" clrIdx="${i % 8}"/>`).join('')}</p:cmAuthorLst>`); addOverride('/ppt/commentAuthors.xml', 'application/vnd.openxmlformats-officedocument.presentationml.commentAuthors+xml'); }
    const pushRel = (type, target, ct) => { const id = `rId${++rn}`; presRels.push(`<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`); addOverride('/ppt/' + target, ct); return id; };
    pushRel('presProps', 'presProps.xml', 'application/vnd.openxmlformats-officedocument.presentationml.presProps+xml');
    pushRel('viewProps', 'viewProps.xml', 'application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml');
    { const id = `rId${++rn}`; presRels.push(`<Relationship Id="${id}" Type="${REL}/theme" Target="theme/theme1.xml"/>`); }
    pushRel('tableStyles', 'tableStyles.xml', 'application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml');
    const sldIds = deck.slides.map((s, i) => ({ id: 256 + i, sid: s.id, r: slideRid[i] }));
    const sldIdOf = sid => (sldIds.find(x => x.sid === sid) || {}).id;
    let cust = ''; if (deck.customShows && deck.customShows.length) cust = `<p:custShowLst>${deck.customShows.map((c, i) => `<p:custShow name="${X(c.name)}" id="${i}"><p:sldLst>${c.slideIds.map(id => { const x = sldIds.find(q => q.sid === id); return x ? `<p:sld r:id="${x.r}"/>` : ''; }).join('')}</p:sldLst></p:custShow>`).join('')}</p:custShowLst>`;
    let sections = ''; if (deck.sections && deck.sections.length) sections = `<p:extLst><p:ext uri="{521415D9-36F7-43E2-AB2F-B90AF26B5E84}"><p14:sectionLst xmlns:p14="${P14}">${deck.sections.map(sec => `<p14:section name="${X(sec.name)}" id="${guid()}"><p14:sldIdLst>${sec.slideIds.map(id => (sldIdOf(id) ? `<p14:sldId id="${sldIdOf(id)}"/>` : '')).join('')}</p14:sldIdLst></p14:section>`).join('')}</p14:sectionLst></p:ext></p:extLst>`;
    const pres = `${HDR}<p:presentation ${NS} saveSubsetFonts="1" autoCompressPictures="0"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>${notesRef}<p:sldIdLst>${sldIds.map(x => `<p:sldId id="${x.id}" r:id="${x.r}"/>`).join('')}</p:sldIdLst><p:sldSz cx="${E(deck.size.w)}" cy="${E(deck.size.h)}"/><p:notesSz cx="6858000" cy="9144000"/>${cust}<p:defaultTextStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr><a:lvl1pPr marL="0" algn="l" defTabSz="914400" rtl="0" eaLnBrk="1" latinLnBrk="0" hangingPunct="1"><a:defRPr sz="1800" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/><a:ea typeface="+mn-ea"/><a:cs typeface="+mn-cs"/></a:defRPr></a:lvl1pPr></p:defaultTextStyle>${sections}</p:presentation>`;
    zip.file('ppt/presentation.xml', pres);
    addOverride('/ppt/presentation.xml', 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml');
    zip.file('ppt/_rels/presentation.xml.rels', relsDoc(presRels));
    const cfg = deck.showCfg || {};
    zip.file('ppt/presProps.xml', `${HDR}<p:presentationPr ${NS}><p:showPr${cfg.loop ? ' loop="1"' : ''}${cfg.useTimings === false ? ' useTimings="0"' : ''} showNarration="1">${cfg.type === 'browsed' ? '<p:browse/>' : cfg.type === 'kiosk' ? '<p:kiosk/>' : '<p:present/>'}${cfg.showFrom ? `<p:sldRg st="${cfg.showFrom}" end="${cfg.showTo || deck.slides.length}"/>` : '<p:sldAll/>'}<p:penClr>${clr(cfg.penColor && cfg.penColor[0] === '#' ? cfg.penColor : '#FF0000')}</p:penClr></p:showPr></p:presentationPr>`);
    zip.file('ppt/viewProps.xml', `${HDR}<p:viewPr ${NS}><p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr><p:gridSpacing cx="76200" cy="76200"/></p:viewPr>`);
    zip.file('ppt/tableStyles.xml', `${HDR}<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>`);
    /* --- doc props --- */
    const pr = deck.props || {}; const now = new Date().toISOString().replace(/\.\d+Z/, 'Z');
    zip.file('docProps/core.xml', `${HDR}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${X(pr.title || deck.title || 'Presentation')}</dc:title>${pr.subject ? `<dc:subject>${X(pr.subject)}</dc:subject>` : ''}<dc:creator>${X(pr.author || '')}</dc:creator>${pr.keywords ? `<cp:keywords>${X(pr.keywords)}</cp:keywords>` : ''}${pr.comments ? `<dc:description>${X(pr.comments)}</dc:description>` : ''}<cp:lastModifiedBy>${X(pr.author || '')}</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${pr.created ? new Date(pr.created).toISOString().replace(/\.\d+Z/, 'Z') : now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`);
    zip.file('docProps/app.xml', `${HDR}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><TotalTime>0</TotalTime><Application>Podium</Application><PresentationFormat>Custom</PresentationFormat><Slides>${deck.slides.length}</Slides><Notes>${deck.slides.filter(s => s.notes).length}</Notes><HiddenSlides>${deck.slides.filter(s => s.hidden).length}</HiddenSlides></Properties>`);
    addOverride('/docProps/core.xml', 'application/vnd.openxmlformats-package.core-properties+xml');
    addOverride('/docProps/app.xml', 'application/vnd.openxmlformats-officedocument.extended-properties+xml');
    zip.file('_rels/.rels', relsDoc([`<Relationship Id="rId1" Type="${REL}/officeDocument" Target="ppt/presentation.xml"/>`, '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>', `<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/>`]));
    const defs = [...defaults.entries()].map(([e, c]) => `<Default Extension="${e}" ContentType="${c}"/>`).join('');
    zip.file('[Content_Types].xml', `${HDR}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">${defs}${overrides.join('')}</Types>`);
    P.deck = prev;
    return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  };
})(window.P);
