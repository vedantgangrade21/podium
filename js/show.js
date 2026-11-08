/* Podium - animations, transitions, slide show, presenter view */
(function (P) {
  'use strict';

  /* ---------- catalogues ---------- */
  P.transitionList = [
    ['Subtle', [['none', 'None'], ['cut', 'Cut'], ['fade', 'Fade'], ['push', 'Push', 'dir'], ['wipe', 'Wipe', 'dir'], ['split', 'Split', 'split'], ['pull', 'Uncover', 'dir8'], ['cover', 'Cover', 'dir8'], ['randomBar', 'Random Bars', 'orient'], ['circle', 'Shape'], ['diamond', 'Diamond'], ['plus', 'Plus'], ['zoom', 'Zoom', 'inout']]],
    ['Exciting', [['flash', 'Flash'], ['dissolve', 'Dissolve'], ['blinds', 'Blinds', 'orient'], ['checker', 'Checkerboard'], ['clock', 'Clock'], ['wheel', 'Wheel'], ['wedge', 'Wedge'], ['newsflash', 'Newsflash'], ['cube', 'Cube', 'dir'], ['flip', 'Flip', 'dirLR'], ['doors', 'Doors'], ['gallery', 'Gallery', 'dirLR']]]
  ];
  P.transitionMeta = id => { for (const g of P.transitionList) for (const t of g[1]) if (t[0] === id) return t; return null; };
  P.transDirs = { dir: [['l', 'From Right'], ['r', 'From Left'], ['u', 'From Bottom'], ['d', 'From Top']], dir8: [['l', 'From Right'], ['r', 'From Left'], ['u', 'From Bottom'], ['d', 'From Top']], dirLR: [['l', 'Left'], ['r', 'Right']], split: [['horzIn', 'Horizontal In'], ['horzOut', 'Horizontal Out'], ['vertIn', 'Vertical In'], ['vertOut', 'Vertical Out']], orient: [['vert', 'Vertical'], ['horz', 'Horizontal']], inout: [['in', 'In'], ['out', 'Out']] };

  P.animList = {
    entr: [['appear', 'Appear', 10], ['fade', 'Fade', 10], ['flyIn', 'Fly In', 2, 'dir'], ['floatIn', 'Float In', 47, 'updown'], ['split', 'Split', 16, 'split'], ['wipe', 'Wipe', 22, 'dir'], ['shape', 'Shape', 18], ['wheel', 'Wheel', 21], ['randomBars', 'Random Bars', 14, 'orient'], ['growTurn', 'Grow & Turn', 31], ['zoom', 'Zoom', 23], ['swivel', 'Swivel', 19], ['bounce', 'Bounce', 26]],
    emph: [['pulse', 'Pulse', 26], ['colorPulse', 'Color Pulse', 27], ['teeter', 'Teeter', 32], ['spin', 'Spin', 8], ['growShrink', 'Grow/Shrink', 6], ['flash', 'Flash', 35], ['bold', 'Bold Reveal', 28], ['wave', 'Wave', 34]],
    exit: [['disappear', 'Disappear', 1], ['fadeOut', 'Fade', 10], ['flyOut', 'Fly Out', 2, 'dir'], ['floatOut', 'Float Out', 47, 'updown'], ['splitOut', 'Split', 16, 'split'], ['wipeOut', 'Wipe', 22, 'dir'], ['shapeOut', 'Shape', 18], ['wheelOut', 'Wheel', 21], ['randomBarsOut', 'Random Bars', 14, 'orient'], ['shrinkTurn', 'Shrink & Turn', 31], ['zoomOut', 'Zoom', 23], ['swivelOut', 'Swivel', 19], ['bounceOut', 'Bounce', 26]],
    path: [['lineDown', 'Lines Down', 42], ['lineUp', 'Lines Up', 42], ['lineLeft', 'Lines Left', 42], ['lineRight', 'Lines Right', 42], ['arc', 'Arcs', 37], ['turn', 'Turns', 37], ['circle', 'Shapes', 37], ['loop', 'Loops', 37]]
  };
  P.animDirs = { dir: [['fromBottom', 'From Bottom'], ['fromLeft', 'From Left'], ['fromRight', 'From Right'], ['fromTop', 'From Top']], updown: [['up', 'Float Up'], ['down', 'Float Down']], split: [['horzIn', 'Horizontal In'], ['horzOut', 'Horizontal Out'], ['vertIn', 'Vertical In'], ['vertOut', 'Vertical Out']], orient: [['horz', 'Horizontal'], ['vert', 'Vertical']] };
  P.animMeta = (eff) => { for (const c in P.animList) for (const a of P.animList[c]) if (a[0] === eff) return { id: a[0], name: a[1], preset: a[2], dirs: a[3], cat: c }; return null; };
  const defDur = eff => ({ appear: 1, disappear: 1, spin: 2000, teeter: 1000, pulse: 500, flash: 500, growShrink: 1000, bounce: 2000, bounceOut: 2000, flyIn: 500, flyOut: 500, wheel: 2000, swivel: 500 })[eff] || (P.animMeta(eff) && P.animMeta(eff).cat === 'path' ? 2000 : 500);
  P.animDefaultDur = defDur;

  /* ---------- animation keyframes ---------- */
  const barsPoly = (n, t, horiz) => { const pts = []; const pc = v => (v * 100).toFixed(3) + '%'; for (let i = 0; i < n; i++) { const a = i / n, b = a + t / n; if (horiz) pts.push(`0 ${pc(a)}`, `100% ${pc(a)}`, `100% ${pc(b)}`, `0 ${pc(b)}`, `0 ${pc(a)}`); else pts.push(`${pc(a)} 0`, `${pc(b)} 0`, `${pc(b)} 100%`, `${pc(a)} 100%`, `${pc(a)} 0`); } return `polygon(evenodd,${pts.join(',')})`; };
  const wheelPoly = (t, spokes = 1) => { const seg = 64, pts = ['50% 50%']; const arr = []; for (let s = 0; s < spokes; s++) { const start = s / spokes; for (let i = 0; i <= seg / spokes; i++) { const a = (start + (i / (seg / spokes)) * (t / spokes)) * 2 * Math.PI - Math.PI / 2; arr.push(`${(50 + 90 * Math.cos(a)).toFixed(2)}% ${(50 + 90 * Math.sin(a)).toFixed(2)}%`); } arr.push('50% 50%'); } return `polygon(${pts.concat(arr).join(',')})`; };
  const keyframesSteps = (fn, n = 24) => { const k = []; for (let i = 0; i <= n; i++) k.push({ clipPath: fn(i / n) }); return k; };
  const insetFrom = dir => ({ fromLeft: 'inset(0 100% 0 0)', fromRight: 'inset(0 0 0 100%)', fromTop: 'inset(0 0 100% 0)', fromBottom: 'inset(100% 0 0 0)' })[dir];

  /* base = the element's resting transform (rotation) ; W,H = slide size; b = element rect */
  function effectFrames(a, node, base, W, H, b) {
    const eff = a.effect, dir = a.dir, T = t => ({ transform: (t + ' ' + base).trim() });
    const off = d => { /* distance to leave the slide */
      if (d === 'fromLeft') return `translateX(${-(b.x + b.w + 10)}px)`; if (d === 'fromRight') return `translateX(${W - b.x + 10}px)`;
      if (d === 'fromTop') return `translateY(${-(b.y + b.h + 10)}px)`; return `translateY(${H - b.y + 10}px)`;
    };
    switch (eff) {
      case 'appear': return [{ opacity: 1 }, { opacity: 1 }];
      case 'disappear': return [{ opacity: 1 }, { opacity: 0 }];
      case 'fade': return [{ opacity: 0 }, { opacity: 1 }];
      case 'fadeOut': return [{ opacity: 1 }, { opacity: 0 }];
      case 'flyIn': return [Object.assign(T(off(dir || 'fromBottom'))), T('')];
      case 'flyOut': return [T(''), T(off(dir || 'fromBottom'))];
      case 'floatIn': return [Object.assign({ opacity: 0 }, T(`translateY(${dir === 'down' ? -36 : 36}px)`)), Object.assign({ opacity: 1 }, T(''))];
      case 'floatOut': return [Object.assign({ opacity: 1 }, T('')), Object.assign({ opacity: 0 }, T(`translateY(${dir === 'down' ? 36 : -36}px)`))];
      case 'split': case 'splitOut': {
        const m = { horzIn: ['inset(0 0 50% 0)', 'inset(50% 0 50% 0)'], horzOut: 0, vertIn: 0, vertOut: 0 }; void m;
        const closed = (dir || 'vertOut').startsWith('horz') ? 'inset(50% 0 50% 0)' : 'inset(0 50% 0 50%)', open = 'inset(0 0 0 0)';
        const fr = eff === 'split' ? [{ clipPath: closed }, { clipPath: open }] : [{ clipPath: open }, { clipPath: closed }];
        return fr;
      }
      case 'wipe': return [{ clipPath: insetFrom(dir || 'fromLeft') }, { clipPath: 'inset(0 0 0 0)' }];
      case 'wipeOut': { const d = { fromLeft: 'inset(0 0 0 100%)', fromRight: 'inset(0 100% 0 0)', fromTop: 'inset(100% 0 0 0)', fromBottom: 'inset(0 0 100% 0)' }[dir || 'fromLeft']; return [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: d }]; }
      case 'shape': return [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }];
      case 'shapeOut': return [{ clipPath: 'circle(75% at 50% 50%)' }, { clipPath: 'circle(0% at 50% 50%)' }];
      case 'wheel': return keyframesSteps(t => wheelPoly(t, 1), 40);
      case 'wheelOut': return keyframesSteps(t => wheelPoly(1 - t, 1), 40);
      case 'randomBars': return [{ clipPath: barsPoly(14, 0, dir !== 'vert') }, { clipPath: barsPoly(14, 1, dir !== 'vert') }];
      case 'randomBarsOut': return [{ clipPath: barsPoly(14, 1, dir !== 'vert') }, { clipPath: barsPoly(14, 0, dir !== 'vert') }];
      case 'growTurn': return [Object.assign({ opacity: 0 }, T('rotate(90deg) scale(.1)')), Object.assign({ opacity: 1 }, T(''))];
      case 'shrinkTurn': return [Object.assign({ opacity: 1 }, T('')), Object.assign({ opacity: 0 }, T('rotate(90deg) scale(.1)'))];
      case 'zoom': return [Object.assign({ opacity: 0 }, T('scale(.1)')), Object.assign({ opacity: 1 }, T(''))];
      case 'zoomOut': return [Object.assign({ opacity: 1 }, T('')), Object.assign({ opacity: 0 }, T('scale(.1)'))];
      case 'swivel': return [T('rotateY(90deg)'), T('rotateY(-60deg)'), T('rotateY(40deg)'), T('rotateY(-20deg)'), T('')];
      case 'swivelOut': return [T(''), T('rotateY(-30deg)'), T('rotateY(60deg)'), T('rotateY(90deg)')];
      case 'bounce': return [Object.assign({ opacity: 0, offset: 0 }, T(`translateY(${-(b.y + b.h)}px)`)), Object.assign({ opacity: 1, offset: .5 }, T('')), Object.assign({ offset: .65 }, T('translateY(-40px)')), Object.assign({ offset: .8 }, T('')), Object.assign({ offset: .9 }, T('translateY(-14px)')), Object.assign({ offset: 1 }, T(''))];
      case 'bounceOut': return [Object.assign({ offset: 0 }, T('')), Object.assign({ offset: .25 }, T('translateY(-14px)')), Object.assign({ offset: .5 }, T('')), Object.assign({ opacity: 1, offset: .7 }, T('translateY(-40px)')), Object.assign({ opacity: 0, offset: 1 }, T(`translateY(${H - b.y}px)`))];
      case 'pulse': return [T(''), T('scale(1.06)'), T('')];
      case 'colorPulse': return [{ filter: 'none' }, { filter: 'brightness(1.5) saturate(1.6)' }, { filter: 'none' }];
      case 'teeter': return [T(''), T('rotate(3deg)'), T('rotate(-3deg)'), T('rotate(3deg)'), T('rotate(-3deg)'), T('')];
      case 'spin': return [T(''), T('rotate(360deg)')];
      case 'growShrink': return [T(''), T('scale(1.25)'), T('')];
      case 'flash': return [{ opacity: 1 }, { opacity: 0 }, { opacity: 1 }, { opacity: 0 }, { opacity: 1 }];
      case 'bold': return [{ filter: 'none' }, { filter: 'contrast(1.4) drop-shadow(0 0 2px currentColor)' }, { filter: 'none' }];
      case 'wave': return [T(''), T('translateY(-14px) skewX(6deg)'), T('translateY(10px) skewX(-6deg)'), T('')];
      /* motion paths: `dx/dy` end position is retained */
      case 'lineDown': return [T(''), T(`translateY(${a.dist || 150}px)`)];
      case 'lineUp': return [T(''), T(`translateY(${-(a.dist || 150)}px)`)];
      case 'lineLeft': return [T(''), T(`translateX(${-(a.dist || 150)}px)`)];
      case 'lineRight': return [T(''), T(`translateX(${a.dist || 150}px)`)];
      case 'arc': { const k = []; const R = a.dist || 120; for (let i = 0; i <= 24; i++) { const t = i / 24 * Math.PI; k.push(T(`translate(${(R - R * Math.cos(t)).toFixed(1)}px,${(-R * Math.sin(t) * .8).toFixed(1)}px)`)); } return k; }
      case 'turn': { const k = []; const R = a.dist || 120; for (let i = 0; i <= 18; i++) { const t = i / 18 * Math.PI / 2; k.push(T(`translate(${(R * Math.sin(t)).toFixed(1)}px,${(R - R * Math.cos(t)).toFixed(1)}px)`)); } return k; }
      case 'circle': { const k = []; const R = a.dist || 90; for (let i = 0; i <= 36; i++) { const t = i / 36 * Math.PI * 2; k.push(T(`translate(${(R * Math.sin(t)).toFixed(1)}px,${(R - R * Math.cos(t)).toFixed(1)}px)`)); } return k; }
      case 'loop': { const k = []; const R = a.dist || 90; for (let i = 0; i <= 36; i++) { const t = i / 36 * Math.PI * 2; k.push(T(`translate(${(R * Math.sin(t)).toFixed(1)}px,${(R / 2 * Math.sin(2 * t)).toFixed(1)}px)`)); } return k; }
    }
    return [{ opacity: 1 }, { opacity: 1 }];
  }
  const easeOf = eff => (/fly|float|zoom|grow|shrink|swivel/i.test(eff) ? 'cubic-bezier(.2,.75,.3,1)' : /bounce|wheel|randomBars|spin|line|arc|turn|circle|loop/i.test(eff) ? 'linear' : 'ease-in-out');

  /* expand "by paragraph" animations into one playback entry per paragraph */
  const expandAnims = slide => {
    const out = [];
    (slide.animations || []).forEach(a => {
      if (a.by === 'para') {
        const el = P.findEl(a.el, slide); const n = el && el.paras ? el.paras.filter(p => (p.runs || []).some(r => r.t)).length : 0;
        for (let i = 0; i < n; i++) out.push(Object.assign({}, a, { para: i, start: i === 0 ? a.start : (a.start === 'click' ? 'click' : 'after'), delay: i === 0 ? a.delay : 0 }));
      } else out.push(a);
    });
    return out;
  };
  /* build steps: [{items:[{a, at}], auto:boolean}] */
  P.buildSteps = slide => {
    const steps = []; let cur = null, end = 0;
    expandAnims(slide).forEach(a => {
      const dur = a.dur == null ? defDur(a.effect) : a.dur, delay = a.delay || 0;
      if (a.start === 'click' || !cur) { cur = { items: [], auto: a.start !== 'click' && !steps.length }; steps.push(cur); end = 0; }
      const at = a.start === 'after' ? end + delay : delay;
      cur.items.push({ a, at, dur }); end = Math.max(end, at + dur * ((a.repeat || 1)));
    });
    return steps;
  };
  const targetOf = (root, a) => {
    const node = root.querySelector(`.pg-els .el[data-id="${a.el}"]`) || null; if (!node) return null;
    if (a.para != null) { const ps = [...node.querySelectorAll('.tbi > .p')].filter(p => p.textContent.trim()); return ps[a.para] || node; }
    return node;
  };
  const metaCat = a => (P.animMeta(a.effect) || {}).cat;
  /* put a slide into the state it has before step n (non-animated) */
  P.applyState = (root, slide, steps, n) => {
    const seen = new Set();
    steps.forEach((st, si) => st.items.forEach(({ a }) => {
      const t = targetOf(root, a); if (!t) return; const key = a.el + '|' + (a.para == null ? '' : a.para); const cat = metaCat(a);
      if (si < n) {
        if (cat === 'entr') t.style.visibility = 'visible';
        if (cat === 'exit') t.style.visibility = 'hidden';
        if (cat === 'path') { const b = P.box(P.findEl(a.el, slide), slide); const fr = effectFrames(a, t, baseTf(t), P.deck.size.w, P.deck.size.h, b); t.style.transform = fr[fr.length - 1].transform; }
      } else if (!seen.has(key)) { if (cat === 'entr') t.style.visibility = 'hidden'; else if (cat === 'exit') t.style.visibility = 'visible'; }
      seen.add(key);
    }));
  };
  const baseTf = node => { if (node.dataset.baseTf === undefined) node.dataset.baseTf = node.style.transform || ''; return node.dataset.baseTf; };
  P.playStep = (root, slide, step, onDone, speed = 1) => {
    const running = [];
    step.items.forEach(({ a, at, dur }) => {
      const t = targetOf(root, a); if (!t) return;
      const el = P.findEl(a.el, slide); const b = el ? P.box(el, slide) : { x: 0, y: 0, w: 100, h: 100 };
      const base = baseTf(t), cat = metaCat(a);
      const frames = effectFrames(a, t, base, P.deck.size.w, P.deck.size.h, b);
      const opts = { duration: Math.max(1, dur) / speed, delay: at / speed, easing: easeOf(a.effect), fill: 'both', iterations: a.repeat || 1 };
      if (cat === 'entr') t.style.visibility = 'hidden';
      const anim = t.animate(frames, Object.assign({}, opts, { fill: 'forwards', delay: cat === 'entr' ? 0 : opts.delay }));
      if (cat === 'entr') {
        /* hidden through the delay, then visible */
        const show = () => { t.style.visibility = 'visible'; };
        if (at <= 0) show(); else { anim.pause(); const tm = setTimeout(() => { show(); anim.play(); }, at / speed); anim.__tm = tm; anim.__start = () => { clearTimeout(tm); show(); }; anim.currentTime = 0; const adjust = () => {}; adjust(); }
      }
      anim.__after = () => {
        if (cat === 'exit') t.style.visibility = 'hidden';
        if (cat === 'path') { const f = frames[frames.length - 1]; t.style.transform = f.transform; }
        anim.cancel();
      };
      running.push(anim);
    });
    let left = running.length; if (!left) { onDone && onDone(); return { finish() {} }; }
    let finished = false;
    const done = () => { if (finished) return; if (--left <= 0) { finished = true; running.forEach(r => r.__after && r.__after()); onDone && onDone(); } };
    running.forEach(r => { r.onfinish = done; });
    return { finish() { running.forEach(r => { if (r.__start) r.__start(); try { r.finish(); } catch (_) {} }); }, cancel() { running.forEach(r => r.cancel()); } };
  };

  /* ---------- transitions ---------- */
  function runTransition(tr, oldEl, newEl, W, H, onDone, speed = 1) {
    const type = tr && tr.type; const D = Math.max(1, ((tr && tr.dur) || 700) / speed), dir = tr && tr.dir;
    if (!type || type === 'none' || type === 'cut' || !oldEl) { if (oldEl) oldEl.remove(); onDone(); return; }
    const sv = +newEl.dataset.scale || 1; W *= sv; H *= sv; /* distances below are screen pixels */
    const opt = { duration: D, easing: 'ease-in-out', fill: 'both' }, lin = Object.assign({}, opt, { easing: 'linear' });
    const anims = []; const a = (el, kf, o = opt) => { const x = el.animate(kf, o); anims.push(x); return x; };
    const vec = { l: [W, 0], r: [-W, 0], u: [0, H], d: [0, -H] }[dir || 'l'] || [W, 0];
    const tx = (x, y) => `translate(${x}px,${y}px)`;
    newEl.style.zIndex = 2; oldEl.style.zIndex = 1;
    const base = 'scale(' + (newEl.dataset.scale || 1) + ')';
    const sc = p => `${p} ${base}`.trim();
    switch (type) {
      case 'fade': a(newEl, [{ opacity: 0 }, { opacity: 1 }]); break;
      case 'push': a(newEl, [{ transform: sc(tx(vec[0], vec[1])) }, { transform: sc(tx(0, 0)) }]); a(oldEl, [{ transform: sc(tx(0, 0)) }, { transform: sc(tx(-vec[0], -vec[1])) }]); break;
      case 'cover': a(newEl, [{ transform: sc(tx(vec[0], vec[1])) }, { transform: sc(tx(0, 0)) }]); break;
      case 'pull': oldEl.style.zIndex = 3; a(oldEl, [{ transform: sc(tx(0, 0)) }, { transform: sc(tx(-vec[0], -vec[1])) }]); break;
      case 'wipe': { const c = { l: 'inset(0 0 0 100%)', r: 'inset(0 100% 0 0)', u: 'inset(100% 0 0 0)', d: 'inset(0 0 100% 0)' }[dir || 'l']; a(newEl, [{ clipPath: c }, { clipPath: 'inset(0 0 0 0)' }]); break; }
      case 'split': { const d = dir || 'vertOut'; if (d.endsWith('Out')) { const c = d.startsWith('vert') ? 'inset(0 50% 0 50%)' : 'inset(50% 0 50% 0)'; a(newEl, [{ clipPath: c }, { clipPath: 'inset(0 0 0 0)' }]); } else { oldEl.style.zIndex = 3; const c = d.startsWith('vert') ? 'inset(0 50% 0 50%)' : 'inset(50% 0 50% 0)'; a(oldEl, [{ clipPath: 'inset(0 0 0 0)' }, { clipPath: c }]); } break; }
      case 'randomBar': case 'blinds': { const n = type === 'blinds' ? 6 : 18, hz = dir !== 'vert'; a(newEl, [{ clipPath: barsPoly(n, 0, hz) }, { clipPath: barsPoly(n, 1, hz) }], lin); break; }
      case 'checker': { const n = 8; a(newEl, [{ clipPath: barsPoly(n, 0, false) }, { clipPath: barsPoly(n, 1, false) }], lin); break; }
      case 'circle': a(newEl, [{ clipPath: 'circle(0% at 50% 50%)' }, { clipPath: 'circle(75% at 50% 50%)' }]); break;
      case 'diamond': a(newEl, [{ clipPath: 'polygon(50% 50%,50% 50%,50% 50%,50% 50%)' }, { clipPath: 'polygon(50% -50%,150% 50%,50% 150%,-50% 50%)' }]); break;
      case 'plus': a(newEl, [{ clipPath: 'polygon(50% 50%,50% 50%,50% 50%,50% 50%,50% 50%,50% 50%,50% 50%,50% 50%,50% 50%,50% 50%,50% 50%,50% 50%)' }, { clipPath: 'polygon(0 0,100% 0,100% 0,100% 0,100% 100%,100% 100%,100% 100%,0 100%,0 100%,0 100%,0 0,0 0)' }]); break;
      case 'zoom': { if (dir === 'out') { oldEl.style.zIndex = 3; a(oldEl, [{ transform: sc(''), opacity: 1 }, { transform: `${base} scale(.1)`, opacity: 0 }]); } else a(newEl, [{ transform: `${base} scale(.1)`, opacity: 0 }, { transform: base, opacity: 1 }]); break; }
      case 'flash': a(newEl, [{ filter: 'brightness(14)', opacity: 0 }, { filter: 'brightness(14)', opacity: 1, offset: .35 }, { filter: 'brightness(1)', opacity: 1 }], lin); break;
      case 'dissolve': a(newEl, [{ opacity: 0, filter: 'blur(14px) contrast(1.8)' }, { opacity: 1, filter: 'blur(0) contrast(1)' }]); break;
      case 'clock': a(newEl, keyframesSteps(t => wheelPoly(t, 1), 48), lin); break;
      case 'wheel': a(newEl, keyframesSteps(t => wheelPoly(t, 4), 48), lin); break;
      case 'wedge': { const fr = keyframesSteps(t => { const arr = ['50% 50%']; const seg = 32; for (let i = 0; i <= seg; i++) { const ang = (-.5 * t + (i / seg) * t) * 2 * Math.PI - Math.PI / 2 + Math.PI; arr.push(`${(50 + 90 * Math.cos(ang)).toFixed(2)}% ${(50 + 90 * Math.sin(ang)).toFixed(2)}%`); } return `polygon(${arr.join(',')})`; }, 40); a(newEl, fr, lin); break; }
      case 'newsflash': a(newEl, [{ transform: `${base} scale(.05) rotate(0deg)`, opacity: 0 }, { transform: `${base} scale(1) rotate(720deg)`, opacity: 1 }], { duration: D, fill: 'both', easing: 'ease-out' }); break;
      case 'cube': {
        const parent = newEl.parentNode; parent.style.perspective = '1600px';
        const hor = dir === 'u' || dir === 'd', s = (dir === 'r' || dir === 'd') ? -1 : 1;
        const ax = hor ? 'X' : 'Y'; const depth = (hor ? H : W) / 2;
        const f = (deg) => `translateZ(${-depth}px) rotate${ax}(${hor ? -deg : deg}deg) translateZ(${depth}px) ${base}`;
        a(oldEl, [{ transform: f(0) }, { transform: f(-90 * s) }]); a(newEl, [{ transform: f(90 * s) }, { transform: f(0) }]);
        break;
      }
      case 'flip': {
        const parent = newEl.parentNode; parent.style.perspective = '1800px'; const s = dir === 'r' ? -1 : 1;
        a(oldEl, [{ transform: `${base} rotateY(0deg)`, visibility: 'visible' }, { transform: `${base} rotateY(${-90 * s}deg)`, visibility: 'visible', offset: .5 }, { transform: `${base} rotateY(${-90 * s}deg)`, visibility: 'hidden' }], lin);
        a(newEl, [{ transform: `${base} rotateY(${90 * s}deg)`, visibility: 'hidden' }, { transform: `${base} rotateY(${90 * s}deg)`, visibility: 'visible', offset: .5 }, { transform: `${base} rotateY(0deg)`, visibility: 'visible' }], lin);
        break;
      }
      case 'doors': {
        const parent = newEl.parentNode; parent.style.perspective = '1600px';
        const left = oldEl.cloneNode(true), right = oldEl.cloneNode(true); oldEl.style.visibility = 'hidden';
        [left, right].forEach(n => { n.style.zIndex = 5; parent.append(n); });
        left.style.clipPath = 'inset(0 50% 0 0)'; right.style.clipPath = 'inset(0 0 0 50%)'; left.style.transformOrigin = '0 50%'; right.style.transformOrigin = '100% 50%';
        const q = left.animate([{ transform: `${base} rotateY(0deg)` }, { transform: `${base} rotateY(85deg)`, opacity: 0 }], opt); const r = right.animate([{ transform: `${base} rotateY(0deg)` }, { transform: `${base} rotateY(-85deg)`, opacity: 0 }], opt);
        anims.push(q, r); a(newEl, [{ transform: `${base} scale(.8)`, opacity: .5 }, { transform: base, opacity: 1 }]);
        q.onfinish = () => { left.remove(); right.remove(); };
        break;
      }
      case 'gallery': {
        const parent = newEl.parentNode; parent.style.perspective = '1400px'; const s = dir === 'r' ? -1 : 1;
        a(oldEl, [{ transform: `${base} translateX(0) rotateY(0deg)` }, { transform: `${base} translateX(${-W * .8 * s}px) rotateY(${40 * s}deg) scale(.7)`, opacity: 0 }]);
        a(newEl, [{ transform: `${base} translateX(${W * .8 * s}px) rotateY(${-40 * s}deg) scale(.7)`, opacity: 0 }, { transform: `${base} translateX(0) rotateY(0deg) scale(1)`, opacity: 1 }]);
        break;
      }
      default: a(newEl, [{ opacity: 0 }, { opacity: 1 }]);
    }
    let left = anims.length, finished = false;
    const fin = () => { if (finished) return; finished = true; anims.forEach(x => { try { x.cancel(); } catch (_) {} }); oldEl.remove(); newEl.style.zIndex = ''; newEl.parentNode && (newEl.parentNode.style.perspective = ''); onDone(); };
    anims.forEach(x => { x.onfinish = () => { if (--left <= 0) fin(); }; });
    return { skip: fin };
  }
  P.runTransition = runTransition;

  /* ---------- previews on the canvas ---------- */
  P.previewSlide = (mode = 'both') => {
    const slide = P.page(); if (!slide || slide.kind) return;
    P.T.end();
    const stage = document.getElementById('stage'); const r = stage.getBoundingClientRect();
    const box = h('div', { class: 'preview-layer', style: { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' } });
    const inner = h('div', { class: 'preview-inner' });
    const D = P.deck.size, s = Math.min((r.width - 48) / D.w, (r.height - 48) / D.h);
    Object.assign(inner.style, { width: D.w + 'px', height: D.h + 'px', left: (r.width - D.w * s) / 2 + 'px', top: (r.height - D.h * s) / 2 + 'px', position: 'absolute', overflow: 'hidden' });
    box.append(inner); document.body.append(box);
    const close = () => { box.remove(); };
    box.addEventListener('pointerdown', close);
    const mk = (page, i) => { const pg = P.renderPage(page, { mode: 'thumb', index: i }); pg.style.position = 'absolute'; pg.style.left = 0; pg.style.top = 0; pg.dataset.scale = 1; return pg; };
    inner.style.transform = `scale(${s})`; inner.style.transformOrigin = '0 0';
    const cur = mk(slide, P.S.cur); const steps = P.buildSteps(slide);
    const animsThen = () => {
      if (mode === 'transition') { setTimeout(close, 350); return; }
      let i = 0; const nx = () => { if (!document.body.contains(box)) return; if (i >= steps.length) { setTimeout(close, 500); return; } P.playStep(inner, slide, steps[i++], () => setTimeout(nx, 180)); };
      nx();
    };
    inner.append(cur);
    if (mode !== 'anim') P.applyState(inner, slide, steps, 0); else P.applyState(inner, slide, steps, 0);
    const tr = slide.transition;
    if (mode !== 'anim' && tr && tr.type && tr.type !== 'none') {
      const prev = P.deck.slides[P.S.cur - 1]; const old = prev ? mk(prev, P.S.cur - 1) : h('div', { class: 'pg', style: { position: 'absolute', left: 0, top: 0, width: D.w + 'px', height: D.h + 'px', background: '#000' } });
      old.dataset.scale = 1; inner.insertBefore(old, cur);
      runTransition(tr, old, cur, D.w, D.h, animsThen);
    } else animsThen();
  };

  /* ---------- slide show ---------- */
  let SH = null;
  const fmtTime = s => { s = Math.max(0, Math.floor(s)); return String(Math.floor(s / 3600)).padStart(2, '0') + ':' + String(Math.floor(s / 60) % 60).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };
  const playable = () => {
    const d = P.deck, cfg = d.showCfg || {};
    if (SH && SH.opts.customIds) return SH.opts.customIds.map(id => d.slides.findIndex(s => s.id === id)).filter(i => i >= 0);
    const all = d.slides.map((_, i) => i).filter(i => !d.slides[i].hidden || SH.opts.includeHidden === i);
    if (cfg.showFrom && cfg.showTo) return all.filter(i => i >= cfg.showFrom - 1 && i <= cfg.showTo - 1);
    return all;
  };
  P.startShow = (from = 0, opts = {}) => {
    if (SH) return;
    if (P.endText) P.endText();
    const d = P.deck; if (!d.slides.length) return;
    const root = h('div', { id: 'show', tabindex: 0 });
    const stageEl = h('div', { class: 'show-stage' });
    const ink = h('canvas', { class: 'show-ink' });
    const laser = h('div', { class: 'show-laser' });
    const blank = h('div', { class: 'show-blank' });
    const ctrl = h('div', { class: 'show-ctrl' });
    root.append(stageEl, ink, laser, blank, ctrl);
    document.body.append(root); P.showing = true;
    SH = { root, stageEl, ink, laser, blank, ctrl, opts, pos: 0, step: 0, steps: [], running: null, cur: null, tool: 'arrow', penColor: (d.showCfg && d.showCfg.penColor) || '#FF0000', strokes: {}, numBuf: '', startTime: Date.now(), slideStart: Date.now(), timings: {}, ended: false, transitioning: null, timer: null, kiosk: d.showCfg && d.showCfg.type === 'kiosk' };
    if (opts.includeHidden == null && d.slides[from] && d.slides[from].hidden) opts.includeHidden = from;
    const list = playable(); let p = list.indexOf(from); if (p < 0) p = list.findIndex(i => i >= from); if (p < 0) p = 0;
    SH.list = list; SH.pos = p;
    buildControls();
    fit();
    root.focus();
    if (!opts.noFullscreen && root.requestFullscreen) root.requestFullscreen().catch(() => {});
    addEventListener('resize', fit);
    root.addEventListener('keydown', onShowKey);
    root.addEventListener('pointerdown', onShowDown);
    root.addEventListener('pointermove', onShowMove);
    root.addEventListener('contextmenu', onShowMenu);
    document.addEventListener('fullscreenchange', onFs);
    if (opts.rehearse) buildRehearse();
    showSlide(SH.pos, 'in');
    if (opts.presenter || (d.showCfg && d.showCfg.presenterView && opts.presenter !== false && window.screen && window.screen.isExtended)) P.openPresenter();
    P.emit('show');
  };
  const onFs = () => { if (!document.fullscreenElement && SH && !SH.opts.noFullscreen) P.endShow(); };
  const fit = () => {
    if (!SH) return; const D = P.deck.size, W = innerWidth, H = innerHeight, s = Math.min(W / D.w, H / D.h);
    SH.scale = s; SH.ox = (W - D.w * s) / 2; SH.oy = (H - D.h * s) / 2;
    Object.assign(SH.stageEl.style, { left: SH.ox + 'px', top: SH.oy + 'px', width: D.w * s + 'px', height: D.h * s + 'px' });
    [...SH.stageEl.children].forEach(c => { c.style.transform = `scale(${s})`; c.dataset.scale = s; });
    SH.ink.width = W; SH.ink.height = H; redrawInk();
  };
  const curSlide = () => P.deck.slides[SH.list[SH.pos]];
  const mkShowPage = i => { const pg = P.renderPage(P.deck.slides[i], { mode: 'show', index: i }); Object.assign(pg.style, { position: 'absolute', left: 0, top: 0, transformOrigin: '0 0', transform: `scale(${SH.scale})` }); pg.dataset.scale = SH.scale; return pg; };
  function showSlide(pos, how = 'in', opts = {}) {
    clearTimeout(SH.timer); SH.ended = false; if (SH.running && SH.running.finish) { SH.running.finish(); SH.running = null; }
    if (SH.transitioning) { SH.transitioning.skip && SH.transitioning.skip(); SH.transitioning = null; }
    const old = SH.cur; recordTiming();
    SH.pos = pos; const idx = SH.list[pos], slide = P.deck.slides[idx];
    SH.slideStart = Date.now();
    const pg = mkShowPage(idx);
    const steps = P.buildSteps(slide); SH.steps = steps;
    const startAt = opts.atEnd ? steps.length : 0; SH.step = startAt;
    SH.stageEl.append(pg); SH.cur = pg;
    bindMedia(pg);
    P.applyState(pg, slide, steps, startAt);
    const after = () => {
      SH.transitioning = null;
      if (SH.step === 0 && steps[0] && steps[0].auto) runNextStep();
      else scheduleAuto();
      syncPresenter();
    };
    const tr = how === 'in' ? slide.transition : null;
    if (tr && tr.sound) { /* sounds intentionally omitted */ }
    if (old) { SH.transitioning = runTransition(how === 'in' ? tr : null, old, pg, P.deck.size.w, P.deck.size.h, after) || null; }
    else after();
    redrawInk(); updateRehearse(); syncPresenter();
  }
  const bindMedia = pg => { pg.querySelectorAll('video,audio').forEach(m => { if (m.dataset.auto === '1') { m.play().catch(() => {}); } }); pg.querySelectorAll('.el-audio').forEach(n => { n.addEventListener('pointerdown', e => { e.stopPropagation(); const a = n.querySelector('audio'); if (a) a.paused ? a.play() : a.pause(); }); }); pg.querySelectorAll('video').forEach(v => v.addEventListener('pointerdown', e => e.stopPropagation())); };
  function scheduleAuto() {
    clearTimeout(SH.timer);
    const slide = curSlide(), tr = slide.transition, cfg = P.deck.showCfg || {};
    if (SH.step < SH.steps.length) return;
    if (tr && tr.advAfter != null && cfg.useTimings !== false && !SH.opts.rehearse) SH.timer = setTimeout(() => P.showNext(), Math.max(10, tr.advAfter));
  }
  function runNextStep() {
    const slide = curSlide(), st = SH.steps[SH.step]; SH.step++;
    SH.running = P.playStep(SH.cur, slide, st, () => {
      SH.running = null;
      /* an automatic chain: following step that starts on its own */
      scheduleAuto(); syncPresenter();
    });
    syncPresenter();
  }
  P.showNext = () => {
    if (!SH) return;
    if (SH.ended) { P.endShow(); return; }
    if (SH.transitioning) { SH.transitioning.skip && SH.transitioning.skip(); SH.transitioning = null; return; }
    if (SH.running) { SH.running.finish(); SH.running = null; return; }
    if (SH.step < SH.steps.length) { runNextStep(); return; }
    if (SH.pos < SH.list.length - 1) showSlide(SH.pos + 1, 'in');
    else if ((P.deck.showCfg || {}).loop || SH.kiosk) showSlide(0, 'in');
    else endScreen();
  };
  P.showPrev = () => {
    if (!SH) return;
    if (SH.ended) { SH.ended = false; SH.blank.className = 'show-blank'; SH.blank.textContent = ''; showSlide(SH.pos, 'back', { atEnd: true }); return; }
    if (SH.running) { SH.running.finish(); SH.running = null; }
    if (SH.step > 0 && !(SH.step === 1 && SH.steps[0] && SH.steps[0].auto)) { SH.step--; const pg = mkShowPage(SH.list[SH.pos]); SH.cur.replaceWith(pg); SH.cur = pg; bindMedia(pg); P.applyState(pg, curSlide(), SH.steps, SH.step); syncPresenter(); return; }
    if (SH.pos > 0) showSlide(SH.pos - 1, 'back', { atEnd: true });
  };
  P.showGoto = (idx) => { if (!SH) return; let p = SH.list.indexOf(idx); if (p < 0) { SH.list = SH.list.concat(idx).sort((a, b) => a - b); p = SH.list.indexOf(idx); } SH.blank.className = 'show-blank'; SH.blank.textContent = ''; showSlide(p, 'in'); };
  function endScreen() { SH.ended = true; SH.blank.className = 'show-blank end'; SH.blank.textContent = 'End of slide show, click to exit.'; syncPresenter(); }
  P.endShow = () => {
    if (!SH) return;
    recordTiming();
    const s = SH; clearTimeout(s.timer); clearInterval(s.rehearseT);
    const hasInk = Object.values(s.strokes).some(a => a.length);
    const rehearse = s.opts.rehearse, timings = s.timings;
    if (s.running && s.running.cancel) s.running.cancel();
    removeEventListener('resize', fit); document.removeEventListener('fullscreenchange', onFs);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    s.root.querySelectorAll('video,audio').forEach(m => m.pause());
    s.root.remove(); SH = null; P.showing = false;
    if (P.presenterWin && !P.presenterWin.closed) { P.presenterWin.close(); } P.presenterWin = null;
    if (hasInk) P.confirm('Do you want to keep your ink annotations?', () => {
      for (const idx in s.strokes) { const slide = P.deck.slides[idx]; if (!slide) continue; const sv = P.S.cur; P.S.cur = +idx; s.strokes[idx].forEach(st => { P.addFreeform(st.pts, false, false, { color: st.color, width: st.width, opacity: st.opacity }); }); P.S.cur = sv; }
      P.emit('change', { all: true });
    }, { ok: 'Keep', cancel: 'Discard' });
    if (rehearse) P.confirm(`The total time for your slide show was ${fmtTime(Object.values(timings).reduce((a, b) => a + b, 0) / 1000)}. Do you want to record the new slide timings and use them when you view the slide show?`, () => {
      for (const i in timings) { const sl = P.deck.slides[i]; if (!sl) continue; sl.transition = sl.transition || { type: 'none' }; sl.transition.advAfter = Math.round(timings[i]); sl.transition.advClick = true; }
      P.commit('Record timings', { all: true });
    }, { ok: 'Yes', cancel: 'No' });
    P.emit('show');
  };
  function recordTiming() { if (!SH || SH.pos == null || !SH.cur) return; const idx = SH.list[SH.pos]; if (SH.opts.rehearse) SH.timings[idx] = (SH.timings[idx] || 0) + (Date.now() - SH.slideStart); }

  /* --- input --- */
  function onShowKey(e) {
    const k = e.key, lk = k.toLowerCase(), mod = e.ctrlKey;
    e.stopPropagation();
    if (k === 'Escape') { if (SH.blank.classList.contains('black') || SH.blank.classList.contains('white')) { setBlank(null); return; } if (SH.gridEl) { closeGrid(); return; } if (SH.tool !== 'arrow') { setTool('arrow'); return; } P.endShow(); return; }
    if (/^[0-9]$/.test(k)) { SH.numBuf += k; return; }
    if (k === 'Enter' && SH.numBuf) { const n = +SH.numBuf - 1; SH.numBuf = ''; if (P.deck.slides[n]) P.showGoto(n); return; }
    SH.numBuf = '';
    if (mod && lk === 'p') { e.preventDefault(); setTool('pen'); return; }
    if (mod && lk === 'i') { e.preventDefault(); setTool('highlighter'); return; }
    if (mod && lk === 'e') { e.preventDefault(); setTool('eraser'); return; }
    if (mod && lk === 'l') { e.preventDefault(); setTool('laser'); return; }
    if (mod && lk === 'a') { e.preventDefault(); setTool('arrow'); return; }
    if (lk === 'e' && !mod) { clearInk(); return; }
    if (lk === 'b' || k === '.') { setBlank(SH.blank.classList.contains('black') ? null : 'black'); return; }
    if (lk === 'w' || k === ',') { setBlank(SH.blank.classList.contains('white') ? null : 'white'); return; }
    if (lk === 'g' || k === '-') { openGrid(); return; }
    if (SH.blank.classList.contains('black') || SH.blank.classList.contains('white')) { setBlank(null); return; }
    if (SH.kiosk) return;
    if (['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter', 'n', 'N'].includes(k)) { e.preventDefault(); P.showNext(); return; }
    if (['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace', 'p', 'P'].includes(k)) { e.preventDefault(); P.showPrev(); return; }
    if (k === 'Home') { showSlide(0, 'back'); return; }
    if (k === 'End') { showSlide(SH.list.length - 1, 'back'); return; }
  }
  const linkOf = target => { const n = target.closest && target.closest('[data-link]'); if (!n) return null; try { return JSON.parse(n.dataset.link); } catch (_) { return null; } };
  P.followLink = link => {
    if (!link) return false;
    if (link.url) { window.open(link.url, '_blank', 'noopener'); return true; }
    if (link.slide) { const i = P.deck.slides.findIndex(s => s.id === link.slide); if (i >= 0) P.showGoto(i); return true; }
    if (link.act) { const a = link.act; if (a === 'next') P.showNext(); else if (a === 'prev') P.showPrev(); else if (a === 'first') showSlide(0, 'back'); else if (a === 'last') showSlide(SH.list.length - 1, 'back'); else if (a === 'end') P.endShow(); return true; }
    return false;
  };
  function onShowDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest('.show-ctrl') || e.target.closest('.show-menu') || e.target.closest('.show-grid') || e.target.closest('.show-rehearse')) return;
    if (SH.tool === 'pen' || SH.tool === 'highlighter') { startStroke(e); return; }
    if (SH.tool === 'eraser') { eraseAt(e); return; }
    if (SH.tool === 'laser') return;
    closeMenu();
    if (SH.blank.classList.contains('black') || SH.blank.classList.contains('white')) { setBlank(null); return; }
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const lk = el && linkOf(el);
    if (lk && P.followLink(lk)) return;
    if (SH.kiosk) return;
    const slide = curSlide(), tr = slide.transition;
    if (tr && tr.advClick === false && SH.step >= SH.steps.length && !SH.ended) return;
    P.showNext();
  }
  let idleT = 0;
  function onShowMove(e) {
    if (!SH) return;
    SH.ctrl.classList.add('on'); SH.root.classList.remove('nocursor');
    clearTimeout(idleT); idleT = setTimeout(() => { if (SH) { SH.ctrl.classList.remove('on'); if (SH.tool === 'arrow') SH.root.classList.add('nocursor'); } }, 3000);
    if (SH.tool === 'laser') { SH.laser.style.display = 'block'; SH.laser.style.left = e.clientX + 'px'; SH.laser.style.top = e.clientY + 'px'; syncPresenter(); }
    if (SH.tool === 'eraser' && e.buttons === 1) eraseAt(e);
    const el = document.elementFromPoint(e.clientX, e.clientY);
    SH.root.style.cursor = SH.tool === 'arrow' && el && linkOf(el) ? 'pointer' : '';
  }
  function setBlank(kind) { SH.blank.className = 'show-blank' + (kind ? ' ' + kind : ''); SH.blank.textContent = ''; }
  function setTool(t) { SH.tool = t; SH.laser.style.display = 'none'; SH.root.dataset.tool = t; SH.root.classList.remove('nocursor'); }
  P.showSetTool = t => SH && setTool(t);
  /* --- ink --- */
  const toSlide = e => ({ x: (e.clientX - SH.ox) / SH.scale, y: (e.clientY - SH.oy) / SH.scale });
  function startStroke(e) {
    const idx = SH.list[SH.pos]; const hl = SH.tool === 'highlighter';
    const st = { pts: [[toSlide(e).x, toSlide(e).y]], color: hl ? '#FFFF00' : SH.penColor, width: hl ? 14 : 2.25, opacity: hl ? .45 : 1 };
    (SH.strokes[idx] = SH.strokes[idx] || []).push(st);
    const mv = ev => { (ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev]).forEach(q => { const t = toSlide(q); st.pts.push([t.x, t.y]); }); redrawInk(); };
    const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); };
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  function redrawInk() {
    if (!SH) return; const c = SH.ink.getContext('2d'); c.clearRect(0, 0, SH.ink.width, SH.ink.height);
    const list = SH.strokes[SH.list && SH.list[SH.pos]] || [];
    list.forEach(st => { c.beginPath(); c.lineCap = c.lineJoin = 'round'; c.strokeStyle = st.color; c.globalAlpha = st.opacity; c.lineWidth = st.width * SH.scale; st.pts.forEach((p, i) => { const x = SH.ox + p[0] * SH.scale, y = SH.oy + p[1] * SH.scale; i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.stroke(); });
    c.globalAlpha = 1;
  }
  function eraseAt(e) { const idx = SH.list[SH.pos], list = SH.strokes[idx]; if (!list) return; const t = toSlide(e); SH.strokes[idx] = list.filter(st => !st.pts.some(p => Math.hypot(p[0] - t.x, p[1] - t.y) < 10)); redrawInk(); }
  function clearInk() { delete SH.strokes[SH.list[SH.pos]]; redrawInk(); }
  /* --- controls --- */
  function buildControls() {
    const b = (ic, title, fn) => { const x = h('button', { class: 'show-btn', title, html: P.icon(ic, 18) }); x.addEventListener('pointerdown', e => e.stopPropagation()); x.addEventListener('click', e => { e.stopPropagation(); fn(e); }); return x; };
    SH.ctrl.append(
      b('prev', 'Previous', () => P.showPrev()), b('next', 'Next', () => P.showNext()),
      b('pen', 'Pen tools', e => showPenMenu(e)), b('sorter', 'See all slides', () => openGrid()),
      b('zoom', 'Zoom into the slide', () => toggleZoom()), b('dots', 'More', e => onShowMenu(e)));
  }
  let zoomed = false;
  function toggleZoom() { zoomed = !zoomed; SH.stageEl.style.transform = zoomed ? 'scale(2)' : ''; SH.stageEl.style.transformOrigin = '50% 50%'; }
  function closeMenu() { const m = SH && SH.root.querySelector('.show-menu'); if (m) m.remove(); }
  function menu(x, y, items) {
    closeMenu(); const m = h('div', { class: 'show-menu' });
    items.forEach(it => { if (it === '-') { m.append(h('div', { class: 'sep' })); return; } const i = h('button', { class: it.on ? 'on' : '', text: it.label }); i.addEventListener('click', ev => { ev.stopPropagation(); closeMenu(); it.fn(ev); }); m.append(i); });
    m.addEventListener('pointerdown', e => e.stopPropagation()); SH.root.append(m);
    const r = m.getBoundingClientRect(); m.style.left = Math.min(x, innerWidth - r.width - 6) + 'px'; m.style.top = Math.min(y, innerHeight - r.height - 6) + 'px';
  }
  function showPenMenu(e) { const r = e.target.getBoundingClientRect(); menu(r.left, r.top - 230, [{ label: 'Laser Pointer', on: SH.tool === 'laser', fn: () => setTool('laser') }, { label: 'Pen', on: SH.tool === 'pen', fn: () => setTool('pen') }, { label: 'Highlighter', on: SH.tool === 'highlighter', fn: () => setTool('highlighter') }, { label: 'Eraser', on: SH.tool === 'eraser', fn: () => setTool('eraser') }, { label: 'Erase All Ink on Slide', fn: clearInk }, '-', { label: 'Arrow', on: SH.tool === 'arrow', fn: () => setTool('arrow') }]); }
  function onShowMenu(e) {
    e.preventDefault();
    menu(e.clientX, e.clientY, [{ label: 'Next', fn: () => P.showNext() }, { label: 'Previous', fn: () => P.showPrev() }, { label: 'See All Slides', fn: openGrid }, '-', { label: 'Black Screen', fn: () => setBlank('black') }, { label: 'White Screen', fn: () => setBlank('white') }, '-', { label: 'Pen', fn: () => setTool('pen') }, { label: 'Highlighter', fn: () => setTool('highlighter') }, { label: 'Laser Pointer', fn: () => setTool('laser') }, { label: 'Eraser', fn: () => setTool('eraser') }, { label: 'Arrow', fn: () => setTool('arrow') }, '-', { label: 'Show Presenter View', fn: () => P.openPresenter() }, { label: 'End Show', fn: () => P.endShow() }]);
  }
  function openGrid() {
    if (SH.gridEl) return closeGrid(); const g = h('div', { class: 'show-grid' }); SH.gridEl = g;
    P.deck.slides.forEach((s, i) => { const c = h('button', { class: 'show-grid-item' + (SH.list[SH.pos] === i ? ' on' : '') + (s.hidden ? ' hid' : '') }); c.append(P.thumb(s, 240, { index: i }), h('span', { text: i + 1 })); c.addEventListener('click', ev => { ev.stopPropagation(); closeGrid(); P.showGoto(i); }); g.append(c); });
    g.addEventListener('pointerdown', ev => { ev.stopPropagation(); if (ev.target === g) closeGrid(); });
    SH.root.append(g);
  }
  function closeGrid() { if (SH.gridEl) { SH.gridEl.remove(); SH.gridEl = null; } SH.root.focus(); }
  /* --- rehearse --- */
  function buildRehearse() {
    const bar = h('div', { class: 'show-rehearse' }); const a = h('span', { class: 'slide-t', text: '00:00:00' }), b = h('span', { class: 'tot-t', text: '00:00:00' });
    const nx = h('button', { text: '▶', title: 'Next' }); nx.addEventListener('click', e => { e.stopPropagation(); P.showNext(); });
    const pause = h('button', { text: '❚❚', title: 'Pause' }); pause.addEventListener('click', e => { e.stopPropagation(); SH.paused = !SH.paused; if (SH.paused) SH.pauseAt = Date.now(); else { const d = Date.now() - SH.pauseAt; SH.slideStart += d; SH.startTime += d; } pause.textContent = SH.paused ? '▶' : '❚❚'; });
    const rs = h('button', { text: '↺', title: 'Repeat' }); rs.addEventListener('click', e => { e.stopPropagation(); SH.slideStart = Date.now(); });
    bar.append(h('span', { text: 'Recording', style: { fontWeight: 600 } }), nx, pause, a, rs, b); SH.root.append(bar);
    SH.rehearseT = setInterval(() => { if (!SH || SH.paused) return; a.textContent = fmtTime((Date.now() - SH.slideStart) / 1000); b.textContent = fmtTime((Date.now() - SH.startTime) / 1000); }, 300);
  }
  function updateRehearse() {}

  /* ---------- presenter view ---------- */
  P.openPresenter = () => {
    if (!SH) return;
    const w = window.open('', 'podium_presenter', 'width=1200,height=760');
    if (!w) { P.toast('Your browser blocked the Presenter View window. Allow pop-ups for this page.'); return; }
    P.presenterWin = w;
    const doc = w.document;
    doc.open(); doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>Presenter View</title><style>${P.slideCSS}
      html,body{margin:0;height:100%;background:#1e1e1e;color:#eee;font:14px "Segoe UI",sans-serif;overflow:hidden}
      #top{display:flex;align-items:center;gap:14px;height:42px;padding:0 16px;background:#2b2b2b;border-bottom:1px solid #3a3a3a}
      #top b{font-size:18px;font-weight:600} #clock{margin-left:auto;font-size:18px} button{background:#3a3a3a;color:#eee;border:1px solid #4b4b4b;border-radius:4px;padding:5px 10px;cursor:pointer;font:inherit} button:hover{background:#505050}
      #main{display:grid;grid-template-columns:1.6fr 1fr;gap:14px;padding:14px;height:calc(100% - 110px);box-sizing:border-box}
      #cur,#next{position:relative;overflow:hidden;background:#000;box-shadow:0 0 0 1px #444} #right{display:grid;grid-template-rows:auto 1fr;gap:10px;min-height:0}
      #notes{background:#262626;padding:12px;overflow:auto;font-size:var(--nf,18px);line-height:1.4;white-space:pre-wrap;border:1px solid #3a3a3a;min-height:0}
      #bot{display:flex;align-items:center;justify-content:center;gap:8px;height:68px;background:#2b2b2b;border-top:1px solid #3a3a3a}
      .lbl{font-size:12px;color:#aaa;margin-bottom:4px} #nextWrap{min-height:0}
    </style></head><body><div id="top"><b id="timer">00:00:00</b><button id="pause">Pause</button><button id="reset">Reset</button><div id="clock"></div></div>
    <div id="main"><div style="display:flex;align-items:center;justify-content:center;min-width:0;min-height:0"><div id="cur"></div></div><div id="right"><div id="nextWrap"><div class="lbl">Next</div><div id="next"></div></div><div style="display:flex;flex-direction:column;min-height:0"><div class="lbl">Notes <button id="fplus">A+</button> <button id="fminus">A-</button></div><div id="notes"></div></div></div></div>
    <div id="bot"><button id="prev">◀ Previous</button><span id="count"></span><button id="nextB">Next ▶</button><button id="black">Black</button><button id="pen">Pen</button><button id="laser">Laser</button><button id="arrow">Arrow</button><button id="grid">End Show</button></div></body></html>`);
    doc.close();
    const $ = id => doc.getElementById(id);
    $('prev').onclick = () => { P.showPrev(); }; $('nextB').onclick = () => { P.showNext(); };
    $('black').onclick = () => { setBlank(SH.blank.classList.contains('black') ? null : 'black'); };
    $('pen').onclick = () => setTool('pen'); $('laser').onclick = () => setTool('laser'); $('arrow').onclick = () => setTool('arrow'); $('grid').onclick = () => P.endShow();
    let t0 = Date.now(), paused = false, pAt = 0, nf = 18;
    $('pause').onclick = () => { paused = !paused; if (paused) pAt = Date.now(); else t0 += Date.now() - pAt; $('pause').textContent = paused ? 'Resume' : 'Pause'; };
    $('reset').onclick = () => { t0 = Date.now(); };
    $('fplus').onclick = () => { nf += 2; doc.documentElement.style.setProperty('--nf', nf + 'px'); }; $('fminus').onclick = () => { nf = Math.max(10, nf - 2); doc.documentElement.style.setProperty('--nf', nf + 'px'); };
    const tick = () => { if (w.closed) return; $('clock').textContent = new Date().toLocaleTimeString(); if (!paused) $('timer').textContent = fmtTime((Date.now() - t0) / 1000); };
    w.__tick = w.setInterval(tick, 500); tick();
    doc.addEventListener('keydown', e => { if (!SH) return; onShowKey(e); });
    w.addEventListener('resize', syncPresenter);
    w.addEventListener('beforeunload', () => { P.presenterWin = null; });
    syncPresenter();
  };
  function syncPresenter() {
    const w = P.presenterWin; if (!w || w.closed || !SH) return;
    const doc = w.document; const $ = id => doc.getElementById(id); if (!$('cur')) return;
    const D = P.deck.size, idx = SH.list[SH.pos], slide = P.deck.slides[idx];
    const mainW = doc.getElementById('main').clientWidth, mainH = doc.getElementById('main').clientHeight;
    const cw = Math.min(mainW * .6, (mainH) * D.w / D.h), s = cw / D.w;
    const cur = $('cur'); cur.style.width = cw + 'px'; cur.style.height = D.h * s + 'px'; cur.innerHTML = '';
    const pg = P.renderPage(slide, { mode: 'thumb', index: idx }); pg.style.transform = `scale(${s})`; cur.append(doc.adoptNode(pg));
    P.applyState(cur, slide, SH.steps, SH.step);
    const next = $('next'); const nw = Math.max(120, mainW * .36), ns = nw / D.w; next.style.width = nw + 'px'; next.style.height = D.h * ns + 'px'; next.innerHTML = '';
    if (SH.step < SH.steps.length) { const pn = P.renderPage(slide, { mode: 'thumb', index: idx }); pn.style.transform = `scale(${ns})`; next.append(doc.adoptNode(pn)); P.applyState(next, slide, SH.steps, SH.step + 1); }
    else if (SH.pos < SH.list.length - 1) { const ni = SH.list[SH.pos + 1]; const ns2 = P.deck.slides[ni]; const pn = P.renderPage(ns2, { mode: 'thumb', index: ni }); pn.style.transform = `scale(${ns})`; next.append(doc.adoptNode(pn)); P.applyState(next, ns2, P.buildSteps(ns2), 0); }
    else next.innerHTML = '<div style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#888">End of slide show</div>';
    $('notes').textContent = slide.notes || 'No notes.';
    $('count').textContent = `Slide ${SH.pos + 1} of ${SH.list.length}`;
  }
})(window.P);
