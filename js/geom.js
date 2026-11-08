/* Podium - preset geometry library. Names match DrawingML prstGeom so .pptx round-trips. */
(function (P) {
  'use strict';
  const f = v => +v.toFixed(2);
  const poly = (pts, close = true) => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + (close ? 'Z' : '');
  const ell = (cx, cy, rx, ry) => `M${f(cx - rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx + rx)} ${f(cy)}A${f(rx)} ${f(ry)} 0 1 0 ${f(cx - rx)} ${f(cy)}Z`;
  const regular = (n, w, h, rot = -90, scale = [1, 1]) => { const a = []; for (let i = 0; i < n; i++) { const t = (rot + i * 360 / n) * Math.PI / 180; a.push([w / 2 + w / 2 * scale[0] * Math.cos(t), h / 2 + h / 2 * scale[1] * Math.sin(t)]); } return poly(a); };
  const star = (n, w, h, ir = .5, rot = -90) => { const a = []; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? ir : 1, t = (rot + i * 180 / n) * Math.PI / 180; a.push([w / 2 + w / 2 * r * Math.cos(t), h / 2 + h / 2 * r * Math.sin(t)]); } return poly(a); };
  const A = (arr, i, d) => (arr && arr[i] != null ? arr[i] : d);
  const round = (x, y, w, h, r) => { r = Math.min(r, w / 2, h / 2); return `M${f(x + r)} ${f(y)}H${f(x + w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w)} ${f(y + r)}V${f(y + h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + w - r)} ${f(y + h)}H${f(x + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y + h - r)}V${f(y + r)}A${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}Z`; };

  const arrowR = (w, h, a) => { const ss = Math.min(w, h), a1 = A(a, 0, 50000) / 100000, a2 = A(a, 1, 50000) / 100000, hd = ss * a2, y1 = h / 2 - h * a1 / 2, y2 = h / 2 + h * a1 / 2; return poly([[0, y1], [w - hd, y1], [w - hd, 0], [w, h / 2], [w - hd, h], [w - hd, y2], [0, y2]]); };
  const xf = (d, fn) => d; // placeholder (unused)
  const rotPts = (pts, w, h, kind) => pts.map(([x, y]) => kind === 'L' ? [w - x, y] : kind === 'U' ? [y * w / h, h - x * h / w] : [y * w / h, x * h / w]);
  const arrowPts = (w, h, a, kind) => { // build on a "right" canvas then map
    const hor = kind === 'L' || kind === 'R';
    const W = hor ? w : h, H = hor ? h : w, ss = Math.min(w, h), a1 = A(a, 0, 50000) / 100000, a2 = A(a, 1, 50000) / 100000, hd = ss * a2, y1 = H / 2 - H * a1 / 2, y2 = H / 2 + H * a1 / 2;
    const pts = [[0, y1], [W - hd, y1], [W - hd, 0], [W, H / 2], [W - hd, H], [W - hd, y2], [0, y2]];
    if (kind === 'R') return poly(pts);
    if (kind === 'L') return poly(pts.map(([x, y]) => [w - x, y]));
    if (kind === 'U') return poly(pts.map(([x, y]) => [y, h - x]));
    return poly(pts.map(([x, y]) => [y, x]));
  };

  const G = P.geoms = {
    rect: (w, h) => `M0 0H${f(w)}V${f(h)}H0Z`,
    roundRect: (w, h, a) => round(0, 0, w, h, Math.min(w, h) * A(a, 0, 16667) / 100000),
    round1Rect: (w, h, a) => { const r = Math.min(w, h) * A(a, 0, 16667) / 100000; return `M0 0H${f(w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)}V${f(h)}H0Z`; },
    round2SameRect: (w, h, a) => { const r = Math.min(w, h) * A(a, 0, 16667) / 100000; return `M${f(r)} 0H${f(w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)}V${f(h)}H0V${f(r)}A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0Z`; },
    round2DiagRect: (w, h, a) => { const r = Math.min(w, h) * A(a, 0, 16667) / 100000; return `M${f(r)} 0H${f(w)}V${f(h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(h)}H0V${f(r)}A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0Z`; },
    snip1Rect: (w, h, a) => { const s = Math.min(w, h) * A(a, 0, 16667) / 100000; return poly([[0, 0], [w - s, 0], [w, s], [w, h], [0, h]]); },
    snip2SameRect: (w, h, a) => { const s = Math.min(w, h) * A(a, 0, 16667) / 100000; return poly([[s, 0], [w - s, 0], [w, s], [w, h], [0, h], [0, s]]); },
    snip2DiagRect: (w, h, a) => { const s = Math.min(w, h) * A(a, 0, 16667) / 100000; return poly([[0, 0], [w - s, 0], [w, s], [w, h], [s, h], [0, h - s]]); },
    snipRoundRect: (w, h, a) => { const s = Math.min(w, h) * A(a, 0, 16667) / 100000; return `M${f(s)} 0H${f(w - s)}L${f(w)} ${f(s)}V${f(h)}H0V${f(s)}A${f(s)} ${f(s)} 0 0 1 ${f(s)} 0Z`; },
    ellipse: (w, h) => ell(w / 2, h / 2, w / 2, h / 2),
    triangle: (w, h, a) => poly([[0, h], [w * A(a, 0, 50000) / 100000, 0], [w, h]]),
    rtTriangle: (w, h) => poly([[0, 0], [w, h], [0, h]]),
    diamond: (w, h) => poly([[w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]]),
    parallelogram: (w, h, a) => { const s = Math.min(w, h) * A(a, 0, 25000) / 100000; return poly([[s, 0], [w, 0], [w - s, h], [0, h]]); },
    trapezoid: (w, h, a) => { const s = Math.min(w, h) * A(a, 0, 25000) / 100000; return poly([[s, 0], [w - s, 0], [w, h], [0, h]]); },
    pentagon: (w, h) => regular(5, w, h, -90, [1.05, 1.05]).replace(/^/, ''),
    hexagon: (w, h, a) => { const s = Math.min(w, h) * A(a, 0, 25000) / 100000; return poly([[0, h / 2], [s, 0], [w - s, 0], [w, h / 2], [w - s, h], [s, h]]); },
    heptagon: (w, h) => regular(7, w, h),
    octagon: (w, h, a) => { const s = Math.min(w, h) * A(a, 0, 29289) / 100000; return poly([[s, 0], [w - s, 0], [w, s], [w, h - s], [w - s, h], [s, h], [0, h - s], [0, s]]); },
    decagon: (w, h) => regular(10, w, h, 0),
    dodecagon: (w, h) => regular(12, w, h, -75),
    pie: (w, h, a) => pieArc(w, h, A(a, 0, 0), A(a, 1, 16200000)),
    chord: (w, h, a) => { const p = arcPts(w, h, A(a, 0, 2700000), A(a, 1, 16200000)); return `M${f(p.x1)} ${f(p.y1)}A${f(w / 2)} ${f(h / 2)} 0 ${p.large} 1 ${f(p.x2)} ${f(p.y2)}Z`; },
    teardrop: (w, h, a) => { const adj = A(a, 0, 100000) / 100000, tx = w / 2 + w / 2 * adj, ty = h / 2 - h / 2 * adj; return `M0 ${f(h / 2)}A${f(w / 2)} ${f(h / 2)} 0 0 1 ${f(w / 2)} 0Q${f(w * .75 + (tx - w) * .2)} 0 ${f(tx)} ${f(ty)}Q${f(w)} ${f(h * .25)} ${f(w)} ${f(h / 2)}A${f(w / 2)} ${f(h / 2)} 0 0 1 0 ${f(h / 2)}Z`; },
    frame: (w, h, a) => { const t = Math.min(w, h) * A(a, 0, 12500) / 100000; return `M0 0H${f(w)}V${f(h)}H0ZM${f(t)} ${f(t)}V${f(h - t)}H${f(w - t)}V${f(t)}Z`; },
    halfFrame: (w, h, a) => { const t = Math.min(w, h) * A(a, 0, 33333) / 100000, t2 = Math.min(w, h) * A(a, 1, 33333) / 100000; return poly([[0, 0], [w, 0], [w - t * w / h, t], [t2, t], [t2, h - t2 * h / w], [0, h]]); },
    corner: (w, h, a) => { const t = Math.min(w, h) * A(a, 1, 50000) / 100000, u = Math.min(w, h) * A(a, 0, 50000) / 100000; return poly([[0, 0], [t, 0], [t, h - u], [w, h - u], [w, h], [0, h]]); },
    diagStripe: (w, h, a) => { const t = A(a, 0, 50000) / 100000; return poly([[0, h * t], [w * t, 0], [w, 0], [0, h]]); },
    plus: (w, h, a) => { const s = Math.min(w, h) * A(a, 0, 25000) / 100000; return poly([[s, 0], [w - s, 0], [w - s, s], [w, s], [w, h - s], [w - s, h - s], [w - s, h], [s, h], [s, h - s], [0, h - s], [0, s], [s, s]]); },
    plaque: (w, h, a) => { const s = Math.min(w, h) * A(a, 0, 16667) / 100000; return `M${f(s)} 0H${f(w - s)}A${f(s)} ${f(s)} 0 0 0 ${f(w)} ${f(s)}V${f(h - s)}A${f(s)} ${f(s)} 0 0 0 ${f(w - s)} ${f(h)}H${f(s)}A${f(s)} ${f(s)} 0 0 0 0 ${f(h - s)}V${f(s)}A${f(s)} ${f(s)} 0 0 0 ${f(s)} 0Z`; },
    can: (w, h, a) => { const ry = Math.min(w, h) * A(a, 0, 25000) / 200000; return [`M0 ${f(ry)}A${f(w / 2)} ${f(ry)} 0 0 1 ${f(w)} ${f(ry)}V${f(h - ry)}A${f(w / 2)} ${f(ry)} 0 0 1 0 ${f(h - ry)}Z`, { d: `M0 ${f(ry)}A${f(w / 2)} ${f(ry)} 0 0 0 ${f(w)} ${f(ry)}A${f(w / 2)} ${f(ry)} 0 0 0 0 ${f(ry)}Z`, shade: 1.15 }]; },
    cube: (w, h, a) => { const s = Math.min(w, h) * A(a, 0, 25000) / 100000; return [poly([[0, s], [w - s, s], [w - s, h], [0, h]]), { d: poly([[0, s], [s, 0], [w, 0], [w - s, s]]), shade: 1.2 }, { d: poly([[w - s, s], [w, 0], [w, h - s], [w - s, h]]), shade: .8 }]; },
    bevel: (w, h, a) => { const s = Math.min(w, h) * A(a, 0, 12500) / 100000; return [poly([[s, s], [w - s, s], [w - s, h - s], [s, h - s]]), { d: poly([[0, 0], [w, 0], [w - s, s], [s, s]]), shade: 1.2 }, { d: poly([[0, 0], [s, s], [s, h - s], [0, h]]), shade: 1.1 }, { d: poly([[w, 0], [w, h], [w - s, h - s], [w - s, s]]), shade: .85 }, { d: poly([[0, h], [s, h - s], [w - s, h - s], [w, h]]), shade: .7 }]; },
    donut: (w, h, a) => { const t = Math.min(w, h) * A(a, 0, 25000) / 100000; return ell(w / 2, h / 2, w / 2, h / 2) + `M${f(t)} ${f(h / 2)}A${f(w / 2 - t)} ${f(h / 2 - t)} 0 1 1 ${f(w - t)} ${f(h / 2)}A${f(w / 2 - t)} ${f(h / 2 - t)} 0 1 1 ${f(t)} ${f(h / 2)}Z`; },
    noSmoking: (w, h, a) => { const t = Math.min(w, h) * A(a, 0, 18750) / 100000, rx = w / 2 - t, ry = h / 2 - t, cx = w / 2, cy = h / 2, R = Math.max(1e-3, Math.min(rx, ry)), al = Math.acos(P.clamp(t / 2 / R, 0, 1)), seg = ph => { const p1 = [cx + rx * Math.cos(ph - al), cy + ry * Math.sin(ph - al)], p2 = [cx + rx * Math.cos(ph + al), cy + ry * Math.sin(ph + al)]; return `M${f(p1[0])} ${f(p1[1])}A${f(rx)} ${f(ry)} 0 0 1 ${f(p2[0])} ${f(p2[1])}Z`; }; return ell(cx, cy, w / 2, h / 2) + seg(-Math.PI / 4) + seg(3 * Math.PI / 4); },
    blockArc: (w, h, a) => { const st = A(a, 0, 10800000), en = A(a, 1, 0), t = Math.min(w, h) * A(a, 2, 25000) / 100000; const p = arcPts(w, h, st, en), q = arcPts(w - 2 * t, h - 2 * t, st, en); return `M${f(p.x1)} ${f(p.y1)}A${f(w / 2)} ${f(h / 2)} 0 ${p.large} 1 ${f(p.x2)} ${f(p.y2)}L${f(q.x2 + t)} ${f(q.y2 + t)}A${f(w / 2 - t)} ${f(h / 2 - t)} 0 ${p.large} 0 ${f(q.x1 + t)} ${f(q.y1 + t)}Z`; },
    foldedCorner: (w, h, a) => { const s = Math.min(w, h) * A(a, 0, 16667) / 100000; return [poly([[0, 0], [w, 0], [w, h - s], [w - s, h], [0, h]]), { d: poly([[w - s, h], [w - s * .8, h - s * .8], [w, h - s]]), shade: .8 }]; },
    smileyFace: (w, h) => [ell(w / 2, h / 2, w / 2, h / 2), { d: ell(w * .34, h * .38, w * .06, h * .06), shade: .8 }, { d: ell(w * .66, h * .38, w * .06, h * .06), shade: .8 }, { d: `M${f(w * .24)} ${f(h * .68)}Q${f(w * .5)} ${f(h * .92)} ${f(w * .76)} ${f(h * .68)}`, noFill: 1 }],
    heart: (w, h) => `M${f(w / 2)} ${f(h * .25)}C${f(w * .5)} ${f(h * .05)} ${f(w * .15)} ${f(-h * .05)} ${f(w * .02)} ${f(h * .2)}C${f(-w * .08)} ${f(h * .5)} ${f(w * .25)} ${f(h * .72)} ${f(w / 2)} ${f(h)}C${f(w * .75)} ${f(h * .72)} ${f(w * 1.08)} ${f(h * .5)} ${f(w * .98)} ${f(h * .2)}C${f(w * .85)} ${f(-h * .05)} ${f(w * .5)} ${f(h * .05)} ${f(w / 2)} ${f(h * .25)}Z`,
    lightningBolt: (w, h) => poly([[w * .39, 0], [w * .59, h * .28], [w * .5, h * .31], [w * .73, h * .53], [w * .65, h * .57], [w, h], [w * .46, h * .65], [w * .55, h * .6], [w * .27, h * .42], [w * .37, h * .37], [0, h * .17]].map(p => p)),
    sun: (w, h) => { let d = ell(w / 2, h / 2, w * .25, h * .25); for (let i = 0; i < 8; i++) { const t = i * Math.PI / 4, c = Math.cos(t), s = Math.sin(t), n = .05; d += poly([[w / 2 + w * .5 * c, h / 2 + h * .5 * s], [w / 2 + w * .32 * c - w * n * s, h / 2 + h * .32 * s + h * n * c], [w / 2 + w * .32 * c + w * n * s, h / 2 + h * .32 * s - h * n * c]]); } return d; },
    moon: (w, h, a) => { const adj = A(a, 0, 50000) / 100000; return `M${f(w)} 0A${f(w)} ${f(h / 2)} 0 0 0 ${f(w)} ${f(h)}A${f(w * (1 - adj * .9))} ${f(h / 2)} 0 0 1 ${f(w)} 0Z`; },
    cloud: (w, h) => `M${f(w * .25)} ${f(h * .9)}C${f(w * .02)} ${f(h * .92)} ${f(-w * .03)} ${f(h * .55)} ${f(w * .12)} ${f(h * .47)}C${f(w * .03)} ${f(h * .22)} ${f(w * .3)} ${f(h * .07)} ${f(w * .4)} ${f(h * .2)}C${f(w * .47)} ${f(-h * .02)} ${f(w * .72)} ${f(-h * .03)} ${f(w * .75)} ${f(h * .18)}C${f(w * .95)} ${f(h * .12)} ${f(w * 1.02)} ${f(h * .42)} ${f(w * .92)} ${f(h * .52)}C${f(w * 1.05)} ${f(h * .72)} ${f(w * .88)} ${f(h * .98)} ${f(w * .72)} ${f(h * .88)}C${f(w * .62)} ${f(h * 1.04)} ${f(w * .35)} ${f(h * 1.04)} ${f(w * .25)} ${f(h * .9)}Z`,
    arc: (w, h, a) => { const p = arcPts(w, h, A(a, 0, 16200000), A(a, 1, 0)); return [{ d: `M${f(p.x1)} ${f(p.y1)}A${f(w / 2)} ${f(h / 2)} 0 ${p.large} 1 ${f(p.x2)} ${f(p.y2)}L${f(w / 2)} ${f(h / 2)}Z`, noStroke: 1 }, { d: `M${f(p.x1)} ${f(p.y1)}A${f(w / 2)} ${f(h / 2)} 0 ${p.large} 1 ${f(p.x2)} ${f(p.y2)}`, noFill: 1 }]; },
    bracketPair: (w, h, a) => { const r = Math.min(w, h) * A(a, 0, 16667) / 100000; return [{ d: round(0, 0, w, h, r), noStroke: 1 }, { d: `M${f(r)} ${f(h)}A${f(r)} ${f(r)} 0 0 1 0 ${f(h - r)}V${f(r)}A${f(r)} ${f(r)} 0 0 1 ${f(r)} 0M${f(w - r)} 0A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)}V${f(h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(h)}`, noFill: 1 }]; },
    bracePair: (w, h, a) => { const r = Math.min(w, h) * A(a, 0, 8333) / 100000; const L = `M${f(2 * r)} ${f(h)}Q${f(r)} ${f(h)} ${f(r)} ${f(h - r)}V${f(h / 2 + r)}Q${f(r)} ${f(h / 2)} 0 ${f(h / 2)}Q${f(r)} ${f(h / 2)} ${f(r)} ${f(h / 2 - r)}V${f(r)}Q${f(r)} 0 ${f(2 * r)} 0`, R = `M${f(w - 2 * r)} 0Q${f(w - r)} 0 ${f(w - r)} ${f(r)}V${f(h / 2 - r)}Q${f(w - r)} ${f(h / 2)} ${f(w)} ${f(h / 2)}Q${f(w - r)} ${f(h / 2)} ${f(w - r)} ${f(h / 2 + r)}V${f(h - r)}Q${f(w - r)} ${f(h)} ${f(w - 2 * r)} ${f(h)}`; return [{ d: `M${f(2 * r)} 0H${f(w - 2 * r)}Q${f(w - r)} 0 ${f(w - r)} ${f(r)}V${f(h - r)}Q${f(w - r)} ${f(h)} ${f(w - 2 * r)} ${f(h)}H${f(2 * r)}Q${f(r)} ${f(h)} ${f(r)} ${f(h - r)}V${f(r)}Q${f(r)} 0 ${f(2 * r)} 0Z`, noStroke: 1 }, { d: L + R, noFill: 1 }]; },
    leftBracket: (w, h, a) => { const y = Math.min(Math.min(w, h) * A(a, 0, 8333) / 100000, h / 2); const d = `M${f(w)} ${f(h)}Q0 ${f(h)} 0 ${f(h - y)}V${f(y)}Q0 0 ${f(w)} 0`; return [{ d: d + 'Z', noStroke: 1 }, { d, noFill: 1 }]; },
    rightBracket: (w, h, a) => { const y = Math.min(Math.min(w, h) * A(a, 0, 8333) / 100000, h / 2); const d = `M0 0Q${f(w)} 0 ${f(w)} ${f(y)}V${f(h - y)}Q${f(w)} ${f(h)} 0 ${f(h)}`; return [{ d: d + 'Z', noStroke: 1 }, { d, noFill: 1 }]; },
    leftBrace: (w, h, a) => { const y = Math.min(Math.min(w, h) * A(a, 0, 8333) / 100000, h / 4), m = h * A(a, 1, 50000) / 100000, c = w / 2; const d = `M${f(w)} ${f(h)}Q${f(c)} ${f(h)} ${f(c)} ${f(h - y)}V${f(m + y)}Q${f(c)} ${f(m)} 0 ${f(m)}Q${f(c)} ${f(m)} ${f(c)} ${f(m - y)}V${f(y)}Q${f(c)} 0 ${f(w)} 0`; return [{ d: d + 'Z', noStroke: 1 }, { d, noFill: 1 }]; },
    rightBrace: (w, h, a) => { const y = Math.min(Math.min(w, h) * A(a, 0, 8333) / 100000, h / 4), m = h * A(a, 1, 50000) / 100000, c = w / 2; const d = `M0 0Q${f(c)} 0 ${f(c)} ${f(y)}V${f(m - y)}Q${f(c)} ${f(m)} ${f(w)} ${f(m)}Q${f(c)} ${f(m)} ${f(c)} ${f(m + y)}V${f(h - y)}Q${f(c)} ${f(h)} 0 ${f(h)}`; return [{ d: d + 'Z', noStroke: 1 }, { d, noFill: 1 }]; },
    /* arrows */
    rightArrow: (w, h, a) => arrowPts(w, h, a, 'R'), leftArrow: (w, h, a) => arrowPts(w, h, a, 'L'), upArrow: (w, h, a) => arrowPts(w, h, a, 'U'), downArrow: (w, h, a) => arrowPts(w, h, a, 'D'),
    leftRightArrow: (w, h, a) => { const ss = Math.min(w, h), t = h * A(a, 0, 50000) / 200000, hd = ss * A(a, 1, 50000) / 100000; return poly([[0, h / 2], [hd, 0], [hd, h / 2 - t], [w - hd, h / 2 - t], [w - hd, 0], [w, h / 2], [w - hd, h], [w - hd, h / 2 + t], [hd, h / 2 + t], [hd, h]]); },
    upDownArrow: (w, h, a) => { const ss = Math.min(w, h), t = w * A(a, 0, 50000) / 200000, hd = ss * A(a, 1, 50000) / 100000; return poly([[w / 2, 0], [w, hd], [w / 2 + t, hd], [w / 2 + t, h - hd], [w, h - hd], [w / 2, h], [0, h - hd], [w / 2 - t, h - hd], [w / 2 - t, hd], [0, hd]]); },
    quadArrow: (w, h, a) => { const ss = Math.min(w, h), t = ss * A(a, 0, 22500) / 200000, hw = ss * A(a, 1, 22500) / 100000, hd = ss * A(a, 2, 22500) / 100000, cx = w / 2, cy = h / 2; return poly([[0, cy], [hd, cy - hw], [hd, cy - t], [cx - t, cy - t], [cx - t, hd], [cx - hw, hd], [cx, 0], [cx + hw, hd], [cx + t, hd], [cx + t, cy - t], [w - hd, cy - t], [w - hd, cy - hw], [w, cy], [w - hd, cy + hw], [w - hd, cy + t], [cx + t, cy + t], [cx + t, h - hd], [cx + hw, h - hd], [cx, h], [cx - hw, h - hd], [cx - t, h - hd], [cx - t, cy + t], [hd, cy + t], [hd, cy + hw]]); },
    leftRightUpArrow: (w, h) => { const t = h * .12, hw = h * .25, hd = h * .25, cx = w / 2; return poly([[0, h - hw], [hd, h - 2 * hw], [hd, h - hw - t], [cx - t, h - hw - t], [cx - t, hd], [cx - hw, hd], [cx, 0], [cx + hw, hd], [cx + t, hd], [cx + t, h - hw - t], [w - hd, h - hw - t], [w - hd, h - 2 * hw], [w, h - hw], [w - hd, h], [w - hd, h - hw + t], [hd, h - hw + t], [hd, h]]); },
    bentArrow: (w, h, a) => { const ss = Math.min(w, h), t = ss * A(a, 0, 25000) / 100000, hw = ss * A(a, 1, 25000) / 100000, hd = ss * A(a, 2, 25000) / 100000; const yTop = hw - t / 2; return `M0 ${f(h)}V${f(yTop + t)}A${f(t)} ${f(t)} 0 0 1 ${f(t)} ${f(yTop)}H${f(w - hd)}V0L${f(w)} ${f(hw)}L${f(w - hd)} ${f(2 * hw)}V${f(yTop + t)}H${f(t * 1.2)}Q${f(t)} ${f(yTop + t)} ${f(t)} ${f(yTop + t * 1.2)}V${f(h)}Z`; },
    uturnArrow: (w, h, a) => { const ss = Math.min(w, h), th = ss * A(a, 0, 25000) / 100000, aw2 = ss * A(a, 1, 25000) / 100000, ah = ss * A(a, 2, 25000) / 100000, y5 = h * A(a, 4, 75000) / 100000, y4 = y5 - ah, dh2 = aw2 - th / 2, x9 = w - dh2, bd = Math.min(ss * A(a, 3, 43750) / 100000, x9 / 2, y4), bd2 = Math.max(0, bd - th), x8 = w - aw2, x6 = x8 - aw2, x7 = x6 + dh2, x4 = x9 - bd, x3 = th + bd2, x5 = x7 - bd2; return `M0 ${f(h)}V${f(bd)}A${f(bd)} ${f(bd)} 0 0 1 ${f(bd)} 0H${f(x4)}A${f(bd)} ${f(bd)} 0 0 1 ${f(x9)} ${f(bd)}V${f(y4)}H${f(w)}L${f(x8)} ${f(y5)}L${f(x6)} ${f(y4)}H${f(x7)}V${f(x3)}A${f(bd2)} ${f(bd2)} 0 0 0 ${f(x5)} ${f(th)}H${f(x3)}A${f(bd2)} ${f(bd2)} 0 0 0 ${f(th)} ${f(x3)}V${f(h)}Z`; },
    leftUpArrow: (w, h) => { const s = Math.min(w, h), t = s * .125, hw = s * .25; return poly([[0, h - hw], [hw, h - 2 * hw], [hw, h - hw - t], [w - hw - t, h - hw - t], [w - hw - t, hw], [w - 2 * hw, hw], [w - hw, 0], [w, hw], [w - hw + t, hw], [w - hw + t, h - hw + t], [hw, h - hw + t], [hw, h]]); },
    bentUpArrow: (w, h) => { const s = Math.min(w, h), t = s * .125, hw = s * .25; return poly([[0, h - 2 * t], [w - hw - t, h - 2 * t], [w - hw - t, hw], [w - 2 * hw, hw], [w - hw, 0], [w, hw], [w - hw + t, hw], [w - hw + t, h], [0, h]]); },
    curvedRightArrow: (w, h) => `M0 ${f(h * .25)}C${f(w * .1)} ${f(h * .55)} ${f(w * .4)} ${f(h * .72)} ${f(w * .72)} ${f(h * .72)}V${f(h * .5)}L${f(w)} ${f(h * .78)}L${f(w * .72)} ${f(h)}V${f(h * .88)}C${f(w * .35)} ${f(h * .88)} 0 ${f(h * .68)} 0 ${f(h * .25)}Z`,
    curvedLeftArrow: (w, h) => `M${f(w)} ${f(h * .25)}C${f(w * .9)} ${f(h * .55)} ${f(w * .6)} ${f(h * .72)} ${f(w * .28)} ${f(h * .72)}V${f(h * .5)}L0 ${f(h * .78)}L${f(w * .28)} ${f(h)}V${f(h * .88)}C${f(w * .65)} ${f(h * .88)} ${f(w)} ${f(h * .68)} ${f(w)} ${f(h * .25)}Z`,
    curvedUpArrow: (w, h) => `M${f(w * .25)} ${f(h)}C${f(w * .55)} ${f(h * .9)} ${f(w * .72)} ${f(h * .6)} ${f(w * .72)} ${f(h * .28)}H${f(w * .5)}L${f(w * .78)} 0L${f(w)} ${f(h * .28)}H${f(w * .88)}C${f(w * .88)} ${f(h * .65)} ${f(w * .68)} ${f(h)} ${f(w * .25)} ${f(h)}Z`,
    curvedDownArrow: (w, h) => `M${f(w * .25)} 0C${f(w * .55)} ${f(h * .1)} ${f(w * .72)} ${f(h * .4)} ${f(w * .72)} ${f(h * .72)}H${f(w * .5)}L${f(w * .78)} ${f(h)}L${f(w)} ${f(h * .72)}H${f(w * .88)}C${f(w * .88)} ${f(h * .35)} ${f(w * .68)} 0 ${f(w * .25)} 0Z`,
    stripedRightArrow: (w, h) => { const t = h * .25, hd = Math.min(w, h) * .5, s = Math.min(w, h) * .03; return poly([[0, h / 2 - t], [s * 2, h / 2 - t], [s * 2, h / 2 + t], [0, h / 2 + t]]) + poly([[s * 4, h / 2 - t], [s * 8, h / 2 - t], [s * 8, h / 2 + t], [s * 4, h / 2 + t]]) + poly([[s * 10, h / 2 - t], [w - hd, h / 2 - t], [w - hd, 0], [w, h / 2], [w - hd, h], [w - hd, h / 2 + t], [s * 10, h / 2 + t]]); },
    notchedRightArrow: (w, h, a) => { const t = h * A(a, 0, 50000) / 200000, hd = Math.min(w, h) * A(a, 1, 50000) / 100000; return poly([[0, h / 2 - t], [w - hd, h / 2 - t], [w - hd, 0], [w, h / 2], [w - hd, h], [w - hd, h / 2 + t], [0, h / 2 + t], [hd * (t * 2 / h) * .5, h / 2]]); },
    homePlate: (w, h, a) => { const s = Math.min(w, h) * A(a, 0, 50000) / 100000; return poly([[0, 0], [w - s, 0], [w, h / 2], [w - s, h], [0, h]]); },
    chevron: (w, h, a) => { const s = Math.min(w, h) * A(a, 0, 50000) / 100000; return poly([[0, 0], [w - s, 0], [w, h / 2], [w - s, h], [0, h], [s, h / 2]]); },
    rightArrowCallout: (w, h) => poly([[0, 0], [w * .65, 0], [w * .65, h * .375], [w * .75, h * .375], [w * .75, h * .25], [w, h * .5], [w * .75, h * .75], [w * .75, h * .625], [w * .65, h * .625], [w * .65, h], [0, h]]),
    leftArrowCallout: (w, h) => poly([[w * .35, 0], [w, 0], [w, h], [w * .35, h], [w * .35, h * .625], [w * .25, h * .625], [w * .25, h * .75], [0, h * .5], [w * .25, h * .25], [w * .25, h * .375], [w * .35, h * .375]]),
    upArrowCallout: (w, h) => poly([[0, h * .35], [w * .375, h * .35], [w * .375, h * .25], [w * .25, h * .25], [w * .5, 0], [w * .75, h * .25], [w * .625, h * .25], [w * .625, h * .35], [w, h * .35], [w, h], [0, h]]),
    downArrowCallout: (w, h) => poly([[0, 0], [w, 0], [w, h * .65], [w * .625, h * .65], [w * .625, h * .75], [w * .75, h * .75], [w * .5, h], [w * .25, h * .75], [w * .375, h * .75], [w * .375, h * .65], [0, h * .65]]),
    /* math */
    mathPlus: (w, h) => { const t = Math.min(w, h) * .118, m = Math.min(w, h) * .13; return poly([[w / 2 - t, m], [w / 2 + t, m], [w / 2 + t, h / 2 - t], [w - m, h / 2 - t], [w - m, h / 2 + t], [w / 2 + t, h / 2 + t], [w / 2 + t, h - m], [w / 2 - t, h - m], [w / 2 - t, h / 2 + t], [m, h / 2 + t], [m, h / 2 - t], [w / 2 - t, h / 2 - t]]); },
    mathMinus: (w, h) => poly([[w * .13, h * .38], [w * .87, h * .38], [w * .87, h * .62], [w * .13, h * .62]]),
    mathMultiply: (w, h) => { const t = .13; return poly([[w * .2, h * (.2 + t)], [w * (.2 + t), h * .2], [w * .5, h * (.5 - t)], [w * (.8 - t), h * .2], [w * .8, h * (.2 + t)], [w * (.5 + t), h * .5], [w * .8, h * (.8 - t)], [w * (.8 - t), h * .8], [w * .5, h * (.5 + t)], [w * (.2 + t), h * .8], [w * .2, h * (.8 - t)], [w * (.5 - t), h * .5]]); },
    mathDivide: (w, h) => poly([[w * .13, h * .42], [w * .87, h * .42], [w * .87, h * .58], [w * .13, h * .58]]) + ell(w / 2, h * .23, h * .1, h * .1) + ell(w / 2, h * .77, h * .1, h * .1),
    mathEqual: (w, h) => poly([[w * .13, h * .26], [w * .87, h * .26], [w * .87, h * .44], [w * .13, h * .44]]) + poly([[w * .13, h * .56], [w * .87, h * .56], [w * .87, h * .74], [w * .13, h * .74]]),
    mathNotEqual: (w, h) => [poly([[w * .13, h * .26], [w * .87, h * .26], [w * .87, h * .44], [w * .13, h * .44]]), poly([[w * .13, h * .56], [w * .87, h * .56], [w * .87, h * .74], [w * .13, h * .74]]), poly([[w * .56, h * .1], [w * .68, h * .15], [w * .44, h * .9], [w * .32, h * .85]])],
    /* flowchart */
    flowChartProcess: (w, h) => G.rect(w, h),
    flowChartAlternateProcess: (w, h) => round(0, 0, w, h, Math.min(w, h) * .17),
    flowChartDecision: (w, h) => G.diamond(w, h),
    flowChartInputOutput: (w, h) => poly([[w * .2, 0], [w, 0], [w * .8, h], [0, h]]),
    flowChartPredefinedProcess: (w, h) => [G.rect(w, h), { d: `M${f(w / 8)} 0V${f(h)}M${f(w * 7 / 8)} 0V${f(h)}`, noFill: 1 }],
    flowChartInternalStorage: (w, h) => [G.rect(w, h), { d: `M${f(w / 8)} 0V${f(h)}M0 ${f(h / 8)}H${f(w)}`, noFill: 1 }],
    flowChartDocument: (w, h) => `M0 0H${f(w)}V${f(h * .8)}C${f(w * .7)} ${f(h * .7)} ${f(w * .5)} ${f(h * 1.1)} 0 ${f(h * .9)}Z`,
    flowChartMultidocument: (w, h) => [`M${f(w * .15)} 0H${f(w)}V${f(h * .65)}H${f(w * .85)}V${f(h * .1)}H${f(w * .15)}Z`, `M${f(w * .07)} ${f(h * .1)}H${f(w * .92)}V${f(h * .72)}H${f(w * .85)}V${f(h * .2)}H${f(w * .07)}Z`, `M0 ${f(h * .2)}H${f(w * .85)}V${f(h * .82)}C${f(w * .6)} ${f(h * .72)} ${f(w * .4)} ${f(h * 1.08)} 0 ${f(h * .92)}Z`],
    flowChartTerminator: (w, h) => { const rx = w * .1609, ry = h / 2; return `M${f(rx)} 0H${f(w - rx)}A${f(rx)} ${f(ry)} 0 0 1 ${f(w - rx)} ${f(h)}H${f(rx)}A${f(rx)} ${f(ry)} 0 0 1 ${f(rx)} 0Z`; },
    flowChartPreparation: (w, h) => poly([[w * .2, 0], [w * .8, 0], [w, h / 2], [w * .8, h], [w * .2, h], [0, h / 2]]),
    flowChartManualInput: (w, h) => poly([[0, h * .2], [w, 0], [w, h], [0, h]]),
    flowChartManualOperation: (w, h) => poly([[0, 0], [w, 0], [w * .8, h], [w * .2, h]]),
    flowChartConnector: (w, h) => G.ellipse(w, h),
    flowChartOffpageConnector: (w, h) => poly([[0, 0], [w, 0], [w, h * .8], [w / 2, h], [0, h * .8]]),
    flowChartPunchedCard: (w, h) => poly([[w * .2, 0], [w, 0], [w, h], [0, h], [0, h * .2]]),
    flowChartPunchedTape: (w, h) => `M0 ${f(h * .1)}Q${f(w * .25)} ${f(h * .3)} ${f(w * .5)} ${f(h * .1)}T${f(w)} ${f(h * .1)}V${f(h * .9)}Q${f(w * .75)} ${f(h * .7)} ${f(w * .5)} ${f(h * .9)}T0 ${f(h * .9)}Z`,
    flowChartSummingJunction: (w, h) => [G.ellipse(w, h), { d: `M${f(w * .15)} ${f(h * .15)}L${f(w * .85)} ${f(h * .85)}M${f(w * .85)} ${f(h * .15)}L${f(w * .15)} ${f(h * .85)}`, noFill: 1 }],
    flowChartOr: (w, h) => [G.ellipse(w, h), { d: `M0 ${f(h / 2)}H${f(w)}M${f(w / 2)} 0V${f(h)}`, noFill: 1 }],
    flowChartCollate: (w, h) => poly([[0, 0], [w, 0], [0, h], [w, h]]),
    flowChartSort: (w, h) => [G.diamond(w, h), { d: `M0 ${f(h / 2)}H${f(w)}`, noFill: 1 }],
    flowChartExtract: (w, h) => poly([[w / 2, 0], [w, h], [0, h]]),
    flowChartMerge: (w, h) => poly([[0, 0], [w, 0], [w / 2, h]]),
    flowChartOnlineStorage: (w, h) => `M${f(w * .17)} 0H${f(w)}A${f(w * .17)} ${f(h / 2)} 0 0 0 ${f(w)} ${f(h)}H${f(w * .17)}A${f(w * .17)} ${f(h / 2)} 0 0 1 ${f(w * .17)} 0Z`,
    flowChartDelay: (w, h) => `M0 0H${f(w / 2)}A${f(w / 2)} ${f(h / 2)} 0 0 1 ${f(w / 2)} ${f(h)}H0Z`,
    flowChartMagneticTape: (w, h) => `M${f(w / 2)} ${f(h)}A${f(w / 2)} ${f(h / 2)} 0 1 1 ${f(w * .85)} ${f(h * .85)}H${f(w)}V${f(h)}Z`,
    flowChartMagneticDisk: (w, h) => { const ry = h / 6; return [`M0 ${f(ry)}A${f(w / 2)} ${f(ry)} 0 0 1 ${f(w)} ${f(ry)}V${f(h - ry)}A${f(w / 2)} ${f(ry)} 0 0 1 0 ${f(h - ry)}Z`, { d: `M0 ${f(ry)}A${f(w / 2)} ${f(ry)} 0 0 0 ${f(w)} ${f(ry)}`, noFill: 1 }]; },
    flowChartMagneticDrum: (w, h) => { const rx = w * .17; return [`M${f(rx)} 0H${f(w - rx)}A${f(rx)} ${f(h / 2)} 0 0 1 ${f(w - rx)} ${f(h)}H${f(rx)}A${f(rx)} ${f(h / 2)} 0 0 1 ${f(rx)} 0Z`, { d: `M${f(w - rx)} 0A${f(rx)} ${f(h / 2)} 0 0 0 ${f(w - rx)} ${f(h)}`, noFill: 1 }]; },
    flowChartDisplay: (w, h) => `M0 ${f(h / 2)}L${f(w * .17)} 0H${f(w * .83)}A${f(w * .17)} ${f(h / 2)} 0 0 1 ${f(w * .83)} ${f(h)}H${f(w * .17)}Z`,
    /* stars & banners */
    star4: (w, h, a) => star(4, w, h, A(a, 0, 12500) / 50000), star5: (w, h, a) => star(5, w, h, A(a, 0, 19098) / 50000), star6: (w, h, a) => star(6, w, h, A(a, 0, 28868) / 50000 * .9),
    star7: (w, h) => star(7, w, h, .55), star8: (w, h, a) => star(8, w, h, A(a, 0, 37500) / 50000), star10: (w, h) => star(10, w, h, .8), star12: (w, h, a) => star(12, w, h, A(a, 0, 37500) / 50000),
    star16: (w, h) => star(16, w, h, .75), star24: (w, h) => star(24, w, h, .75), star32: (w, h) => star(32, w, h, .75),
    irregularSeal1: (w, h) => poly([[.5, .17], [.62, 0], [.69, .17], [.87, .07], [.81, .28], [1, .3], [.87, .45], [1, .6], [.81, .63], [.86, .86], [.68, .73], [.6, 1], [.47, .76], [.3, .92], [.3, .72], [.08, .74], [.2, .55], [0, .42], [.2, .34], [.1, .13], [.33, .24]].map(p => [p[0] * w, p[1] * h])),
    irregularSeal2: (w, h) => poly([[.52, .14], [.68, 0], [.7, .2], [.9, .1], [.83, .3], [1, .4], [.84, .5], [.96, .72], [.74, .68], [.72, .9], [.56, .78], [.44, 1], [.38, .8], [.15, .86], [.25, .64], [0, .58], [.18, .44], [.04, .24], [.28, .28], [.28, .06]].map(p => [p[0] * w, p[1] * h])),
    ribbon2: (w, h) => [poly([[w * .2, 0], [w * .8, 0], [w * .8, h * .7], [w * .2, h * .7]]), { d: poly([[0, h * .3], [w * .2, h * .3], [w * .2, h * .7], [w * .3, h], [0, h], [w * .08, h * .65]]), shade: .8 }, { d: poly([[w, h * .3], [w * .8, h * .3], [w * .8, h * .7], [w * .7, h], [w, h], [w * .92, h * .65]]), shade: .8 }],
    ribbon: (w, h) => [poly([[w * .2, h * .3], [w * .8, h * .3], [w * .8, h], [w * .2, h]]), { d: poly([[0, 0], [w * .3, 0], [w * .2, h * .3], [w * .2, h * .7], [0, h * .7], [w * .08, h * .35]]), shade: .8 }, { d: poly([[w, 0], [w * .7, 0], [w * .8, h * .3], [w * .8, h * .7], [w, h * .7], [w * .92, h * .35]]), shade: .8 }],
    verticalScroll: (w, h) => { const r = Math.min(w, h) * .0625; return [`M${f(r * 2)} ${f(h - r)}V${f(r)}A${f(r)} ${f(r)} 0 0 1 ${f(r * 3)} 0H${f(w - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(r * 2)}H${f(w - r * 2)}V${f(h - r)}A${f(r)} ${f(r)} 0 0 1 ${f(w - r * 3)} ${f(h)}H${f(r)}A${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(h - 2 * r)}H${f(r * 2)}Z`]; },
    horizontalScroll: (w, h) => { const r = Math.min(w, h) * .0625; return [`M${f(r)} ${f(r * 2)}H${f(w - r)}V${f(r)}A${f(r)} ${f(r)} 0 0 1 ${f(w)} ${f(r)}V${f(h - r * 3)}A${f(r)} ${f(r)} 0 0 1 ${f(w - r)} ${f(h - r * 2)}H${f(r)}V${f(h - r)}A${f(r)} ${f(r)} 0 0 1 0 ${f(h - r)}V${f(r * 3)}A${f(r)} ${f(r)} 0 0 1 ${f(r)} ${f(r * 2)}Z`]; },
    wave: (w, h, a) => { const d = h * A(a, 0, 12500) / 100000; return `M0 ${f(d)}C${f(w * .33)} ${f(-d)} ${f(w * .67)} ${f(3 * d)} ${f(w)} ${f(d)}V${f(h - d)}C${f(w * .67)} ${f(h + d)} ${f(w * .33)} ${f(h - 3 * d)} 0 ${f(h - d)}Z`; },
    doubleWave: (w, h) => { const d = h * .0625; return `M0 ${f(d)}C${f(w * .17)} ${f(-d)} ${f(w * .33)} ${f(3 * d)} ${f(w * .5)} ${f(d)}S${f(w * .83)} ${f(-d)} ${f(w)} ${f(d)}V${f(h - d)}C${f(w * .83)} ${f(h + d)} ${f(w * .67)} ${f(h - 3 * d)} ${f(w * .5)} ${f(h - d)}S${f(w * .17)} ${f(h + d)} 0 ${f(h - d)}Z`; },
    /* callouts */
    wedgeRectCallout: (w, h, a) => { const tx = w / 2 + w * A(a, 0, -20833) / 100000, ty = h / 2 + h * A(a, 1, 62500) / 100000; return calloutBody(w, h, tx, ty, 'r'); },
    wedgeRoundRectCallout: (w, h, a) => { const tx = w / 2 + w * A(a, 0, -20833) / 100000, ty = h / 2 + h * A(a, 1, 62500) / 100000; return calloutBody(w, h, tx, ty, 'rr'); },
    wedgeEllipseCallout: (w, h, a) => { const tx = w / 2 + w * A(a, 0, -20833) / 100000, ty = h / 2 + h * A(a, 1, 62500) / 100000; const t = Math.atan2((ty - h / 2) / h, (tx - w / 2) / w), d = .18; const p1 = [w / 2 + w / 2 * Math.cos(t - d), h / 2 + h / 2 * Math.sin(t - d)], p2 = [w / 2 + w / 2 * Math.cos(t + d), h / 2 + h / 2 * Math.sin(t + d)]; return `M${f(p2[0])} ${f(p2[1])}A${f(w / 2)} ${f(h / 2)} 0 1 1 ${f(p1[0])} ${f(p1[1])}L${f(tx)} ${f(ty)}Z`; },
    cloudCallout: (w, h, a) => { const tx = w / 2 + w * A(a, 0, -20833) / 100000, ty = h / 2 + h * A(a, 1, 62500) / 100000, cx = w / 2 + (tx - w / 2) * .62, cy = h / 2 + (ty - h / 2) * .62; const r = Math.min(w, h) * .05; return G.cloud(w, h) + ell(cx, cy, r * 1.3, r * 1.3) + ell((cx + tx) / 2, (cy + ty) / 2, r * .8, r * .8) + ell(tx, ty, r * .45, r * .45); },
    borderCallout1: (w, h, a) => { const y1 = h * A(a, 0, 18750) / 100000, x1 = w * A(a, 1, -8333) / 100000, y2 = h * A(a, 2, 112500) / 100000, x2 = w * A(a, 3, -38333) / 100000; return [G.rect(w, h), { d: `M${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`, noFill: 1 }]; },
    /* action buttons */
    actionButtonBlank: (w, h) => G.rect(w, h),
    actionButtonHome: (w, h) => [G.rect(w, h), { d: poly([[w * .5, h * .14], [w * .86, h * .5], [w * .75, h * .5], [w * .75, h * .86], [w * .25, h * .86], [w * .25, h * .5], [w * .14, h * .5]]), shade: .7 }],
    actionButtonBackPrevious: (w, h) => [G.rect(w, h), { d: poly([[w * .14, h * .5], [w * .86, h * .14], [w * .86, h * .86]]), shade: .7 }],
    actionButtonForwardNext: (w, h) => [G.rect(w, h), { d: poly([[w * .86, h * .5], [w * .14, h * .14], [w * .14, h * .86]]), shade: .7 }],
    actionButtonBeginning: (w, h) => [G.rect(w, h), { d: poly([[w * .3, h * .5], [w * .86, h * .14], [w * .86, h * .86]]), shade: .7 }, { d: poly([[w * .14, h * .14], [w * .22, h * .14], [w * .22, h * .86], [w * .14, h * .86]]), shade: .7 }],
    actionButtonEnd: (w, h) => [G.rect(w, h), { d: poly([[w * .7, h * .5], [w * .14, h * .14], [w * .14, h * .86]]), shade: .7 }, { d: poly([[w * .78, h * .14], [w * .86, h * .14], [w * .86, h * .86], [w * .78, h * .86]]), shade: .7 }],
    /* lines */
    line: (w, h) => ({ d: `M0 0L${f(w)} ${f(h)}`, noFill: 1 }),
    straightConnector1: (w, h) => ({ d: `M0 0L${f(w)} ${f(h)}`, noFill: 1 }),
    bentConnector3: (w, h, a) => { const x = w * A(a, 0, 50000) / 100000; return { d: `M0 0H${f(x)}V${f(h)}H${f(w)}`, noFill: 1 }; },
    bentConnector2: (w, h) => ({ d: `M0 0H${f(w)}V${f(h)}`, noFill: 1 }),
    curvedConnector3: (w, h, a) => { const x = w * A(a, 0, 50000) / 100000; return { d: `M0 0C${f(x / 2)} 0 ${f(x)} ${f(h / 4)} ${f(x)} ${f(h / 2)}C${f(x)} ${f(h * .75)} ${f((w + x) / 2)} ${f(h)} ${f(w)} ${f(h)}`, noFill: 1 }; },
    curvedConnector2: (w, h) => ({ d: `M0 0C${f(w / 2)} 0 ${f(w)} ${f(h / 2)} ${f(w)} ${f(h)}`, noFill: 1 })
  };
  // pentagon in DrawingML ('pentagon' is regular; 'homePlate' is the arrow)
  G.pentagon = (w, h) => poly([[w / 2, 0], [w, h * .382], [w * .81, h], [w * .19, h], [0, h * .382]]);

  const ang = v => (v / 60000) * Math.PI / 180;
  function arcPts(w, h, st, en) {
    const s = ang(st), e = ang(en);
    /* DrawingML angles are visual; convert to parametric */
    const par = t => Math.atan2(Math.sin(t) * w, Math.cos(t) * h);
    const ps = par(s), pe = par(e);
    let sweep = e - s; while (sweep <= 0) sweep += Math.PI * 2;
    return { x1: w / 2 + w / 2 * Math.cos(ps), y1: h / 2 + h / 2 * Math.sin(ps), x2: w / 2 + w / 2 * Math.cos(pe), y2: h / 2 + h / 2 * Math.sin(pe), large: sweep > Math.PI ? 1 : 0 };
  }
  function pieArc(w, h, st, en) { const p = arcPts(w, h, st, en); return `M${f(w / 2)} ${f(h / 2)}L${f(p.x1)} ${f(p.y1)}A${f(w / 2)} ${f(h / 2)} 0 ${p.large} 1 ${f(p.x2)} ${f(p.y2)}Z`; }
  function calloutBody(w, h, tx, ty, kind) {
    const r = kind === 'rr' ? Math.min(w, h) * .16667 : 0;
    const dx = tx - w / 2, dy = ty - h / 2;
    let side = Math.abs(dx / w) > Math.abs(dy / h) ? (dx > 0 ? 'r' : 'l') : (dy > 0 ? 'b' : 't');
    const inside = tx > 0 && tx < w && ty > 0 && ty < h;
    if (inside) side = '';
    const a1 = dx < 0 ? .1667 : .5833, a2 = dx < 0 ? .4167 : .8333, b1 = dy < 0 ? .1667 : .5833, b2 = dy < 0 ? .4167 : .8333;
    const R = r ? (x, y) => `A${f(r)} ${f(r)} 0 0 1 ${f(x)} ${f(y)}` : (x, y) => `L${f(x)} ${f(y)}`;
    let d = `M${f(r)} 0`;
    if (side === 't') d += `L${f(w * a1)} 0L${f(tx)} ${f(ty)}L${f(w * a2)} 0`;
    d += `L${f(w - r)} 0` + R(w, r);
    if (side === 'r') d += `L${f(w)} ${f(h * b1)}L${f(tx)} ${f(ty)}L${f(w)} ${f(h * b2)}`;
    d += `L${f(w)} ${f(h - r)}` + R(w - r, h);
    if (side === 'b') d += `L${f(w * a2)} ${f(h)}L${f(tx)} ${f(ty)}L${f(w * a1)} ${f(h)}`;
    d += `L${f(r)} ${f(h)}` + R(0, h - r);
    if (side === 'l') d += `L0 ${f(h * b2)}L${f(tx)} ${f(ty)}L0 ${f(h * b1)}`;
    d += `L0 ${f(r)}` + R(r, 0) + 'Z';
    return d;
  }

  /* normalise a geometry result to an array of {d, shade?, noFill?, noStroke?} */
  P.geomPaths = (name, w, h, adj, el) => {
    if (name === 'custom' && el && el.paths) {
      return el.paths.map(p => { const sx = p.w ? w / p.w : 1, sy = p.h ? h / p.h : 1; return { d: scalePath(p.d, sx, sy), noFill: p.noFill, noStroke: p.noStroke }; });
    }
    const fn = G[name] || G.rect;
    let r; try { r = fn(w, h, adj); } catch (e) { r = G.rect(w, h); }
    if (!Array.isArray(r)) r = [r];
    return r.map(x => (typeof x === 'string' ? { d: x } : x));
  };
  /* Scale an absolute path of M/L/C/Q/Z commands */
  function scalePath(d, sx, sy) {
    return d.replace(/([MLCQHVTSZ])([^MLCQHVTSZ]*)/gi, (m, c, args) => {
      const n = args.trim().split(/[\s,]+/).filter(Boolean).map(Number);
      if (c === 'H') return 'H' + f(n[0] * sx);
      if (c === 'V') return 'V' + f(n[0] * sy);
      if (!n.length) return c;
      return c + n.map((v, i) => f(v * (i % 2 ? sy : sx))).join(' ');
    });
  }
  P.scalePath = scalePath;
  P.isLineGeom = g => /^(line|straightConnector1|bentConnector\d|curvedConnector\d)$/.test(g);

  /* Yellow adjust handles: returns {x,y} from adj & a setter mapping pointer -> adj values */
  const ssA = (i, d, axis, max = 50000) => ({
    get: (w, h, a) => { const s = Math.min(w, h) * A(a, i, d) / 100000; return axis === 'x' ? { x: s, y: 0 } : { x: 0, y: s }; },
    set: (w, h, a, px, py) => { const v = (axis === 'x' ? px : py) / Math.min(w, h) * 100000; a = (a || []).slice(); a[i] = P.clamp(Math.round(v), 0, max); return a; }
  });
  const wedge = { get: (w, h, a) => ({ x: w / 2 + w * A(a, 0, -20833) / 100000, y: h / 2 + h * A(a, 1, 62500) / 100000 }), set: (w, h, a, px, py) => [Math.round((px - w / 2) / w * 100000), Math.round((py - h / 2) / h * 100000)] };
  const arrowH = { get: (w, h, a) => ({ x: w - Math.min(w, h) * A(a, 1, 50000) / 100000, y: h / 2 - h * A(a, 0, 50000) / 200000 }), set: (w, h, a, px, py) => [P.clamp(Math.round((h / 2 - py) / h * 200000), 0, 100000), P.clamp(Math.round((w - px) / Math.min(w, h) * 100000), 0, 100000)] };
  P.adjHandles = {
    roundRect: ssA(0, 16667, 'x'), snip1Rect: { get: (w, h, a) => ({ x: w - Math.min(w, h) * A(a, 0, 16667) / 100000, y: 0 }), set: (w, h, a, px) => [P.clamp(Math.round((w - px) / Math.min(w, h) * 100000), 0, 50000)] },
    parallelogram: ssA(0, 25000, 'x', 100000), trapezoid: ssA(0, 25000, 'x', 100000), hexagon: ssA(0, 25000, 'x', 100000), octagon: ssA(0, 29289, 'x'), plus: ssA(0, 25000, 'x'), frame: ssA(0, 12500, 'x'), plaque: ssA(0, 16667, 'x'), bevel: ssA(0, 12500, 'x'), donut: ssA(0, 25000, 'x'),
    triangle: { get: (w, h, a) => ({ x: w * A(a, 0, 50000) / 100000, y: 0 }), set: (w, h, a, px) => [P.clamp(Math.round(px / w * 100000), 0, 100000)] },
    rightArrow: arrowH, chevron: { get: (w, h, a) => ({ x: w - Math.min(w, h) * A(a, 0, 50000) / 100000, y: 0 }), set: (w, h, a, px) => [P.clamp(Math.round((w - px) / Math.min(w, h) * 100000), 0, 100000)] },
    homePlate: { get: (w, h, a) => ({ x: w - Math.min(w, h) * A(a, 0, 50000) / 100000, y: 0 }), set: (w, h, a, px) => [P.clamp(Math.round((w - px) / Math.min(w, h) * 100000), 0, 100000)] },
    wedgeRectCallout: wedge, wedgeRoundRectCallout: wedge, wedgeEllipseCallout: wedge, cloudCallout: wedge,
    star5: { get: (w, h, a) => ({ x: w / 2, y: h / 2 - h / 2 * A(a, 0, 19098) / 50000 }), set: (w, h, a, px, py) => [P.clamp(Math.round((h / 2 - py) / (h / 2) * 50000), 0, 50000)] },
    star4: { get: (w, h, a) => ({ x: w / 2, y: h / 2 - h / 2 * A(a, 0, 12500) / 50000 }), set: (w, h, a, px, py) => [P.clamp(Math.round((h / 2 - py) / (h / 2) * 50000), 0, 50000)] },
    bentConnector3: { get: (w, h, a) => ({ x: w * A(a, 0, 50000) / 100000, y: h / 2 }), set: (w, h, a, px) => [Math.round(px / w * 100000)] },
    curvedConnector3: { get: (w, h, a) => ({ x: w * A(a, 0, 50000) / 100000, y: h / 2 }), set: (w, h, a, px) => [Math.round(px / w * 100000)] }
  };

  /* Gallery of shapes as shown in the Shapes dropdown */
  P.shapeGallery = [
    ['Lines', ['line', 'straightConnector1', 'bentConnector3', 'curvedConnector3']],
    ['Rectangles', ['rect', 'roundRect', 'snip1Rect', 'snip2SameRect', 'snip2DiagRect', 'snipRoundRect', 'round1Rect', 'round2SameRect', 'round2DiagRect']],
    ['Basic Shapes', ['ellipse', 'triangle', 'rtTriangle', 'parallelogram', 'trapezoid', 'diamond', 'pentagon', 'hexagon', 'heptagon', 'octagon', 'decagon', 'dodecagon', 'pie', 'chord', 'teardrop', 'frame', 'halfFrame', 'corner', 'diagStripe', 'plus', 'plaque', 'can', 'cube', 'bevel', 'donut', 'noSmoking', 'blockArc', 'foldedCorner', 'smileyFace', 'heart', 'lightningBolt', 'sun', 'moon', 'cloud', 'arc', 'bracketPair', 'bracePair', 'leftBracket', 'rightBracket', 'leftBrace', 'rightBrace']],
    ['Block Arrows', ['rightArrow', 'leftArrow', 'upArrow', 'downArrow', 'leftRightArrow', 'upDownArrow', 'quadArrow', 'leftRightUpArrow', 'bentArrow', 'uturnArrow', 'leftUpArrow', 'bentUpArrow', 'curvedRightArrow', 'curvedLeftArrow', 'curvedUpArrow', 'curvedDownArrow', 'stripedRightArrow', 'notchedRightArrow', 'homePlate', 'chevron', 'rightArrowCallout', 'leftArrowCallout', 'upArrowCallout', 'downArrowCallout']],
    ['Equation Shapes', ['mathPlus', 'mathMinus', 'mathMultiply', 'mathDivide', 'mathEqual', 'mathNotEqual']],
    ['Flowchart', ['flowChartProcess', 'flowChartAlternateProcess', 'flowChartDecision', 'flowChartInputOutput', 'flowChartPredefinedProcess', 'flowChartInternalStorage', 'flowChartDocument', 'flowChartMultidocument', 'flowChartTerminator', 'flowChartPreparation', 'flowChartManualInput', 'flowChartManualOperation', 'flowChartConnector', 'flowChartOffpageConnector', 'flowChartPunchedCard', 'flowChartPunchedTape', 'flowChartSummingJunction', 'flowChartOr', 'flowChartCollate', 'flowChartSort', 'flowChartExtract', 'flowChartMerge', 'flowChartOnlineStorage', 'flowChartDelay', 'flowChartMagneticTape', 'flowChartMagneticDisk', 'flowChartMagneticDrum', 'flowChartDisplay']],
    ['Stars and Banners', ['star4', 'star5', 'star6', 'star7', 'star8', 'star10', 'star12', 'star16', 'star24', 'star32', 'irregularSeal1', 'irregularSeal2', 'ribbon', 'ribbon2', 'verticalScroll', 'horizontalScroll', 'wave', 'doubleWave']],
    ['Callouts', ['wedgeRectCallout', 'wedgeRoundRectCallout', 'wedgeEllipseCallout', 'cloudCallout', 'borderCallout1']],
    ['Action Buttons', ['actionButtonBlank', 'actionButtonHome', 'actionButtonBackPrevious', 'actionButtonForwardNext', 'actionButtonBeginning', 'actionButtonEnd']]
  ];
  P.geomLabel = n => n.replace(/^flowChart/, 'Flowchart: ').replace(/^math/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2').replace(/^./, c => c.toUpperCase());
  P.geomPreview = (name, size = 18) => {
    const paths = P.geomPaths(name, size, size, null, null);
    return `<svg viewBox="-1 -1 ${size + 2} ${size + 2}" width="${size + 2}" height="${size + 2}">` + paths.map(p => `<path d="${p.d}" fill="${p.noFill ? 'none' : '#fff'}" stroke="#555" stroke-width="1" fill-rule="evenodd"/>`).join('') + '</svg>';
  };
})(window.P);
