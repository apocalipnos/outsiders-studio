// Módulo "Fotogramas clave" de la Edición, como en HyperFrames Studio: propiedades animables por capa, rombos en una pista
// expandible bajo la capa, curva por tramo, trayectoria en la vista previa, inclinación 3D y grabación de gestos.
// Datos: edicion/claves_edit.json = {tracks: {<objetivo>: {<prop>: [{t, v, ease, anchor}]}}, paths: {<objetivo>: {arc, autoRotate}}}.
//   El "ease" de una clave es la curva del tramo que LLEGA a ella (como en los keyframes de GSAP); el de la primera no se usa.
//   Una pista de una sola clave es un valor fijo. Cada clave va anclada a un momento de su toma: si se recorta, se mueve con ella.
// Vista previa: x/y con `translate` en la capa; lo demás con `rotate`, `scale`, `opacity` y `transform` (3D) en su interior,
// que es lo único que capas.js no reescribe; en el vídeo, todo en T.el.rf con propiedades sueltas.
(function () {
  var A, K, ME, HF = 1 / 60, PERSP = 1200;
  var PROPS = [
    { id: 'x', label: 'Izquierda/derecha', unit: 'px', step: 1, def: 0, eps: 6 }, { id: 'y', label: 'Arriba/abajo', unit: 'px', step: 1, def: 0, eps: 6 },
    { id: 'scale', label: 'Tamaño', unit: '×', step: .01, def: 1, eps: .01 }, { id: 'rotation', label: 'Giro', unit: '°', step: 1, def: 0, eps: 2 },
    { id: 'rotationX', label: 'Giro hacia atrás', unit: '°', step: 1, def: 0, eps: 2 }, { id: 'rotationY', label: 'Giro lateral', unit: '°', step: 1, def: 0, eps: 2 },
    { id: 'z', label: 'Profundidad', unit: 'px', step: 1, def: 0, eps: 8 }, { id: 'opacity', label: 'Opacidad', unit: '', step: .01, def: 1, eps: .015 }
  ];
  var BY = {}; PROPS.forEach(function (p) { BY[p.id] = p; });
  var DEF_EASE = 'power2.out';
  var EASES = { Linear: 'Constante', 'Ease In': 'Arranca lento', 'Quad In': 'Arranca lento +', 'Cubic In': 'Arranca lento ++', 'Ease Out': 'Frena al final', 'Quad Out': 'Frena +', 'Cubic Out': 'Frena ++', 'Ease In & Out': 'Suave', 'Quad Ease': 'Suave +', 'Cubic Ease': 'Suave ++', 'Circular Ease': 'Circular', 'Ease In Back': 'Coge impulso', 'Ease Out Back': 'Se pasa y vuelve', 'Ease In & Out Back': 'Impulso y vuelta', 'Expo In': 'Arranque brusco', 'Expo Out': 'Frenazo', Hold: 'Sin transición', Gentle: 'Rebote suave', Quick: 'Rebote rápido', Bouncy: 'Con rebote', Slow: 'Rebote lento' };
  function easeName(l) { return EASES[l] || l.replace('Flow', 'Vaivén').replace('Bounce', 'Sacudida'); }
  var CL = { none: [0, 0, 1, 1], 'power1.out': [0, 0, .58, 1], 'power2.out': [.16, 1, .3, 1], 'power3.out': [.08, .82, .17, 1], 'power4.out': [.06, .73, .09, 1], 'power1.in': [.42, 0, 1, 1], 'power2.in': [.55, .06, .68, .19], 'power3.in': [.6, .04, .98, .34], 'power4.in': [.7, 0, .84, 0], 'power1.inOut': [.42, 0, .58, 1], 'power2.inOut': [.45, .05, .55, .95], 'power3.inOut': [.65, .05, .35, 1], 'power4.inOut': [.76, 0, .24, 1], 'back.out': [.34, 1.56, .64, 1], 'back.in': [.36, 0, .66, -.56], 'back.inOut': [.68, -.55, .27, 1.55], 'circ.inOut': [.785, .135, .15, .86], 'expo.out': [.16, 1, .3, 1], 'expo.in': [.7, 0, .84, 0], 'expo.inOut': [.87, 0, .13, 1] };
  var CSS_ = '.kf-lane .tl-lab{height:20px;font-size:10px;color:var(--t3);cursor:pointer;justify-content:flex-start;gap:3px}.kf-lane .tl-lab.top{color:var(--t2)}.kf-lane .tl-lab.sel{color:var(--a)}.kf-track{height:20px;background:rgba(255,255,255,.012)}.kf-lane{border-bottom:1px solid var(--b0)}' +
    '.kf-tog{width:14px;height:16px;padding:0;border:0;background:none;color:var(--t3);font-size:11px;flex:none}.kf-tog:hover{border:0;color:var(--t1)}' +
    '.kf-d{position:absolute;top:50%;width:9px;height:9px;margin:-5px 0 0 -5px;background:#d4d4d4;border:1px solid #000;transform:rotate(45deg);cursor:ew-resize;z-index:2;box-sizing:border-box;touch-action:none}.kf-d:hover{background:#fff}.kf-d.sel{background:var(--a);box-shadow:0 0 0 1px var(--a)}.kf-d.hold{transform:none;border-radius:1px}' +
    '.kf-seg{position:absolute;top:0;bottom:0;cursor:pointer;display:block}.kf-seg::before{content:"";position:absolute;left:0;right:0;top:50%;height:2px;margin-top:-1px;background:rgba(60,230,172,.35)}.kf-seg.hold::before{background:none;border-top:2px dotted var(--t3)}.kf-seg.sel::before{background:var(--a)}.kf-seg:hover::before{background:var(--a)}' +
    '.kf-row{display:flex;align-items:center;gap:3px;margin:3px 0}.kf-row label{flex:1;min-width:0;color:var(--t3);font-size:11px;padding-left:4px;white-space:nowrap;overflow:hidden}.kf-row.has label{color:var(--t1)}.kf-num{width:66px;text-align:right}.kf-u{width:14px;color:var(--t3);font-size:10px}' +
    '.kf-nav{width:14px;height:20px;padding:0;border:0;background:none;color:var(--t3);font-size:12px;flex:none}.kf-nav:hover{color:var(--t1);border:0}.kf-t{width:18px;height:20px;padding:0;border:0;background:none;display:grid;place-items:center;flex:none}.kf-t:hover{border:0}.kf-t i{display:block;width:8px;height:8px;transform:rotate(45deg);border:1px solid var(--t3);box-sizing:border-box}.kf-t:hover i{border-color:var(--t1)}.kf-t.on i{border-color:var(--a)}.kf-t.at i{border-color:var(--a);background:var(--a)}' +
    '.kf-cvt{display:inline-flex;gap:1px;background:var(--card2);border-radius:6px;padding:1px;margin-bottom:6px}.kf-cvt button{border:0;background:none;padding:3px 9px;color:var(--t3);font-size:11px}.kf-cvt button:hover{border:0;color:var(--t1)}.kf-cvt button.on{background:var(--b1);color:var(--a)}' +
    '.kf-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:3px;max-height:190px;overflow:auto}.kf-e{display:flex;flex-direction:column;align-items:center;gap:1px;padding:3px 1px;background:var(--card2);border:1px solid transparent;border-radius:6px;color:var(--t3);font-size:9px;line-height:1.15;min-width:0}.kf-e:hover{border-color:var(--b2);color:var(--t1)}.kf-e.on{border-color:var(--a);color:var(--a)}.kf-e svg{display:block}.kf-e span{max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.kf-bz{display:block;margin:8px auto 4px;background:var(--card2);border-radius:6px;touch-action:none}.kf-bz circle{cursor:grab}.kf-pr{display:flex;gap:6px;align-items:center;margin:8px 0 4px;flex-wrap:wrap;color:var(--t3);font-size:11px}.kf-pr input{width:52px}' +
    '.kf-pad{height:110px;background:var(--card2);border-radius:8px;display:grid;place-items:center;cursor:grab;touch-action:none;perspective:300px;overflow:hidden}.kf-card{width:70px;height:96px;border:1px solid var(--a);border-radius:5px;background:var(--ad);pointer-events:none}' +
    '.kf-path{position:absolute;left:0;top:0;width:1080px;height:1920px;z-index:50;pointer-events:none;overflow:visible}.kf-path .ln{fill:none;stroke:var(--a);opacity:.9}.kf-path .mid{fill:rgba(10,10,10,.55);stroke:var(--a);stroke-dasharray:3 3;pointer-events:all;cursor:copy}.kf-path .pt{fill:#0a0a0a;stroke:var(--a);pointer-events:all;cursor:move}.kf-path .pt.sel{fill:var(--a)}.kf-path .now{fill:var(--a);pointer-events:none}' +
    '.kf-pane{position:absolute;inset:0;z-index:70;cursor:crosshair;outline:8px solid #ef4444;outline-offset:-8px;touch-action:none}.kf-pane b{position:absolute;left:30px;top:30px;background:#ef4444;color:#fff;font:700 34px system-ui;padding:10px 22px;border-radius:12px;white-space:nowrap;pointer-events:none}' +
    '.st-tb.kf-rec.on{background:rgba(239,68,68,.16);color:#ef4444}';

  // ---------- curvas ----------
  var EF = {};
  function bez(x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    return function (x) {
      var t = x, i, a = 0, b = 1;
      for (i = 0; i < 8; i++) {
        var e = ((ax * t + bx) * t + cx) * t - x, d = (3 * ax * t + 2 * bx) * t + cx;
        if (Math.abs(e) < 1e-5) return ((ay * t + by) * t + cy) * t;
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      t = x;
      for (i = 0; i < 24; i++) { if (((ax * t + bx) * t + cx) * t < x) a = t; else b = t; t = (a + b) / 2; }
      return ((ay * t + by) * t + cy) * t;
    };
  }
  function bounceOut(p) {
    var c = 2.75, k = 7.5625;
    if (p < 1 / c) return k * p * p;
    if (p < 2 / c) { p -= 1.5 / c; return k * p * p + .75; }
    if (p < 2.5 / c) { p -= 2.25 / c; return k * p * p + .9375; }
    p -= 2.625 / c; return k * p * p + .984375;
  }
  function elasticOut(a, per) {
    a = Math.max(1, a || 1); per = per || .3;
    var s = per / (2 * Math.PI) * Math.asin(1 / a);
    return function (p) { return a * Math.pow(2, -10 * p) * Math.sin((p - s) * 2 * Math.PI / per) + 1; };
  }
  function named(name, dir, args) {         // powerN, sine, expo, circ, back, elastic, bounce: las fórmulas de GSAP
    var inF = null, outF = null, ALIAS = { quad: 1, cubic: 2, quart: 3, quint: 4, strong: 4 }, n, a = String(args || '').split(',').map(parseFloat);
    if ((n = /^power([0-4])$/.exec(name))) { var k = +n[1] + 1; inF = function (p) { return Math.pow(p, k); }; }
    else if (ALIAS[name]) { var q = ALIAS[name] + 1; inF = function (p) { return Math.pow(p, q); }; }
    else if (name === 'sine') inF = function (p) { return 1 - Math.cos(p * Math.PI / 2); };
    else if (name === 'expo') inF = function (p) { return p ? Math.pow(2, 10 * (p - 1)) : 0; };
    else if (name === 'circ') inF = function (p) { return 1 - Math.sqrt(Math.max(0, 1 - p * p)); };
    else if (name === 'back') { var s = isNaN(a[0]) ? 1.70158 : a[0]; inF = function (p) { return p * p * ((s + 1) * p - s); }; }
    else if (name === 'elastic') outF = elasticOut(a[0], a[1]);
    else if (name === 'bounce') outF = bounceOut;
    else return null;
    if (!inF) inF = function (p) { return 1 - outF(1 - p); };
    if (!outF) outF = function (p) { return 1 - inF(1 - p); };
    if (dir === 'in') return inF;
    if (dir === 'inOut') return function (p) { return p < .5 ? inF(p * 2) / 2 : 1 - inF((1 - p) * 2) / 2; };
    return outF;
  }
  function easeFn(str) {
    var s = String(str == null ? 'none' : str).trim(), f = EF[s], m;
    if (f) return f;
    if (s === 'none' || s === 'linear') f = function (p) { return p; };
    else if (s === 'hold') f = function (p) { return p >= 1 ? 1 : 0; };
    else if ((m = /^spring\(\s*([\d.+-]+)\s*\)$/.exec(s))) {
      var n = A.clamp(+m[1], 0, 1), r = 12 - n * 6, w = Math.PI * 2 * (1 + n * 1.5), e = 1 - Math.exp(-r) * Math.cos(w);
      f = function (p) { return (1 - Math.exp(-r * p) * Math.cos(w * p)) / e; };
    } else if ((m = /^wiggle\(\s*(\d+)\s*,\s*(easeOut|easeInOut|anticipate|uniform)\s*(?:,\s*([\d.eE+-]+)\s*)?\)$/.exec(s))) {
      var cnt = +m[1], ty = m[2], am = m[3] == null ? { easeOut: .16, easeInOut: .08, anticipate: .12, uniform: .14 }[ty] : +m[3];
      f = function (p) {
        var v = ty === 'easeInOut' ? am * Math.sin(Math.PI * p) : ty === 'uniform' ? am : am * (1 - p);
        return p + (ty === 'anticipate' ? -1 : 1) * v * Math.sin(Math.PI * 2 * cnt * p);
      };
    } else if ((m = /^custom\(\s*M\s*0\s*,\s*0\s*C\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+1\s*,\s*1\s*\)$/.exec(s))) f = bez(+m[1], +m[2], +m[3], +m[4]);
    else if ((m = /^([a-z0-9]+)(?:\.(in|out|inOut))?(?:\((.*)\))?$/.exec(s))) f = named(m[1], m[2] || 'out', m[3]);
    if (!f) f = function (p) { return p; };
    var g = f;
    f = function (p) { return p <= 0 ? 0 : p >= 1 ? 1 : g(p); };
    EF[s] = f;
    return f;
  }
  function bezOf(ease) {                     // los dos puntos de una curva (propios, o los que más se parecen a un preset)
    var m = /^custom\(\s*M\s*0\s*,\s*0\s*C\s*([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)[,\s]+([-\d.]+)/.exec(String(ease));
    return m ? [+m[1], +m[2], +m[3], +m[4]] : (CL[ease] || CL[DEF_EASE]).slice();
  }
  function bezStr(p) { var r = function (v) { return Math.round(v * 1000) / 1000; }; return 'custom(M0,0 C' + r(p[0]) + ',' + r(p[1]) + ' ' + r(p[2]) + ',' + r(p[3]) + ' 1,1)'; }
  function kindOf(e) { return /^spring/.test(e) ? 'spring' : /^wiggle/.test(e) ? 'wiggle' : 'curve'; }
  function curveD(ease, w, h, pad, lo, hi, n) {
    var f = easeFn(ease), d = '', i;
    n = n || 40;
    for (i = 0; i <= n; i++) {
      var p = i / n, y = f(p);
      if (ease === 'hold' && i === n) d += 'L' + (pad + (w - 2 * pad)).toFixed(1) + ' ' + (pad + (h - 2 * pad) * (hi - 0) / (hi - lo)).toFixed(1);
      d += (i ? 'L' : 'M') + (pad + p * (w - 2 * pad)).toFixed(1) + ' ' + (pad + (h - 2 * pad) * (hi - y) / (hi - lo)).toFixed(1);
    }
    return d;
  }

  // ---------- objetivos ----------
  function plugin(id) { return A.state().plugins.filter(function (p) { return p.id === id; })[0]; }
  function target() {
    var T = A.state(), s = T.sel;
    if (!s) return null;
    if (s.type === 'grp') return 'grp:' + s.id;
    if (s.type === 'seg') { var it = itemOf(s.id); return it && !it.s.off ? 'seg:' + it.s.id : null; }   // solo ese clip
    if (s.type === 'fx') { var f = T.fx[s.id]; if (f && f.kind === 'el' && !f.sonido) return (f.libre ? 'lib:' : 'el:') + f.id; }
    return null;
  }
  function tid(tg) { return tg.slice(tg.indexOf(':') + 1); }
  function clipOf(tg) { var L = A.state().L, id = tid(tg); for (var i = 0; i < L.length; i++) if (L[i].s.id === id && !L[i].s.off) return L[i]; return null; }
  function fxIdx(tg) {
    var fx = A.state().fx, lib = tg.indexOf('lib:') === 0, id = tid(tg);
    for (var i = 0; i < fx.length; i++) if (fx[i].kind === 'el' && fx[i].id === id && !!fx[i].libre === lib) return i;
    return -1;
  }
  function groupOf(id) { var T = A.state(), f = T.fx[fxIdx('el:' + id)], c = plugin('capas'), l = f && c && c.laneOf(f); return l ? l.id : null; }
  function cssq(s) { return window.CSS && CSS.escape ? CSS.escape(s) : s; }
  function nameOf(tg) {
    var T = A.state();
    if (tg === 'video') return 'Vídeo';
    if (tg.indexOf('seg:') === 0) return 'Clip ' + (A.clipNum(tid(tg)) || tid(tg));
    if (tg.indexOf('grp:') === 0) { var d = T.el.ov.querySelector('.cp-g[data-g="' + cssq(tid(tg)) + '"] .cp-tag'); return d ? d.textContent : tid(tg); }
    var f = T.fx[fxIdx(tg)];
    return f ? f.label : tid(tg);
  }
  function selectTarget(tg) {
    var T = A.state();
    if (target() === tg) return false;
    if (tg === 'video') {
      var it = T.L.filter(function (x) { return !x.s.off && T.t >= x.t0 && T.t < x.t0 + x.dur; })[0] || T.L.filter(function (x) { return !x.s.off; })[0];
      if (it) A.select({ type: 'seg', id: it.s._id });
    } else if (tg.indexOf('seg:') === 0) { var c = clipOf(tg); if (c) A.select({ type: 'seg', id: c.s._id }); }
    else if (tg.indexOf('grp:') === 0) A.select({ type: 'grp', id: tid(tg) });
    else { var i = fxIdx(tg); if (i >= 0) A.select({ type: 'fx', id: i }); }
    return true;
  }

  // ---------- claves y tiempo ----------
  function sp(s) { return s.overlay ? 1 : (s.speed || 1); }
  function itemOf(id) { var L = A.state().L; for (var i = 0; i < L.length; i++) if (L[i].s._id === id) return L[i]; return null; }
  function kt(k) {                           // el segundo del montaje de una clave; null si su fragmento ya no está
    var L = A.state().L, it = itemOf(k.seg), E = 1e-3, i;
    if (it && !it.s.off && k.src >= it.s.in - E && k.src <= it.s.out + E) return it.t0 + (k.src - it.s.in) / sp(it.s);
    var clip = k.clip || (it && it.s.clip);  // se partió o se recortó: otro fragmento del mismo clip con ese segundo
    for (i = 0; i < L.length; i++) {
      var x = L[i];
      if (!x.s.off && x.s.clip === clip && k.src >= x.s.in - E && k.src <= x.s.out + E) return x.t0 + (k.src - x.s.in) / sp(x.s);
    }
    return it && !it.s.off ? it.t0 + A.clamp((k.src - it.s.in) / sp(it.s), 0, it.dur) : null;
  }
  function timed(tg, p) {                    // las claves de una pista, ordenadas y con su tiempo (se rehace si cambia el montaje)
    var T = A.state(), id = tg + '|' + p, c;
    if (K.cL !== T.L) { K.cache = {}; K.cL = T.L; }
    if ((c = K.cache[id])) return c;
    c = [];
    ((K.tracks[tg] || {})[p] || []).forEach(function (k) { var t = kt(k); if (t != null) c.push({ t: t, v: k.v, ease: k.ease, k: k }); });
    c.sort(function (a, b) { return a.t - b.t; });
    return (K.cache[id] = c);
  }
  function change() { K.cache = {}; K.ver++; A.touched('claves'); }
  function setKeyT(k, t) { var a = A.anchor(t), it = itemOf(a.seg); k.seg = a.seg; k.src = a.src; k.clip = it && it.s.clip; }
  function makeKey(t, v, ease) { var k = { v: v, ease: ease || DEF_EASE }; setKeyT(k, t); return k; }
  function ensure(tg, p) { var o = K.tracks[tg] || (K.tracks[tg] = {}); return o[p] || (o[p] = []); }
  function keyAt(tg, p, t) { var c = timed(tg, p); for (var i = 0; i < c.length; i++) if (Math.abs(c[i].t - t) < HF) return c[i]; return null; }
  function setAt(tg, p, t, v) {              // cambia la clave de ese momento o crea una; true si es nueva
    var c = keyAt(tg, p, t), isNew = !c;
    if (c) c.k.v = v; else ensure(tg, p).push(makeKey(t, v));
    change();
    return isNew;
  }
  function removeKey(tg, p, k) {
    var o = K.tracks[tg], tr = o && o[p];
    if (!tr) return;
    var i = tr.indexOf(k);
    if (i >= 0) tr.splice(i, 1);
    if (!tr.length) delete o[p];
    if (!Object.keys(o).length) { delete K.tracks[tg]; delete K.open[tg]; delete K.paths[tg]; }
    change();
  }
  function has(tg, p) { return timed(tg, p).length > 0; }
  function animated(tg) { return PROPS.filter(function (p) { return has(tg, p.id); }); }
  function linVal(tg, p, t) {                // valor de una propiedad en el segundo t, con la curva real
    var c = timed(tg, p);
    if (!c.length) return BY[p].def;
    if (t <= c[0].t) return c[0].v;
    if (t >= c[c.length - 1].t) return c[c.length - 1].v;
    for (var i = 1; i < c.length; i++) {
      if (t < c[i].t) { var a = c[i - 1], b = c[i]; return a.v + (b.v - a.v) * easeFn(b.ease)((t - a.t) / (b.t - a.t)); }
    }
    return c[c.length - 1].v;
  }
  function pts(tg) {                         // los puntos de la trayectoria: cada momento con clave en x o en y
    var id = 'pts|' + tg, c = K.cache[id];
    timed(tg, 'x');
    if ((c = K.cache[id])) return c;
    var ts = [];
    timed(tg, 'x').concat(timed(tg, 'y')).forEach(function (e) { if (!ts.some(function (t) { return Math.abs(t - e.t) < HF; })) ts.push(e.t); });
    ts.sort(function (a, b) { return a - b; });
    c = ts.map(function (t) {
      var kx = keyAt(tg, 'x', t), ky = keyAt(tg, 'y', t);
      return { t: t, x: linVal(tg, 'x', t), y: linVal(tg, 'y', t), ease: (kx || ky).ease };
    });
    return (K.cache[id] = c);
  }
  // Arco: bezier entre puntos seguidos con los mismos puntos de control que Studio (ver el informe para aplicar.py)
  function arcAt(P, t) {
    if (t <= P[0].t) return P[0];
    var last = P[P.length - 1];
    if (t >= last.t) return last;
    for (var i = 1; i < P.length; i++) {
      if (t < P[i].t) {
        var a = P[i - 1], b = P[i], u = easeFn(b.ease)((t - a.t) / (b.t - a.t)), dx = b.x - a.x, dy = b.y - a.y, up = Math.abs(dx) * .25;
        var c1x = a.x + dx * .33, c1y = a.y + dy * .33 - up, c2x = a.x + dx * .66, c2y = a.y + dy * .66 - up, m = 1 - u;
        return { x: m * m * m * a.x + 3 * m * m * u * c1x + 3 * m * u * u * c2x + u * u * u * b.x, y: m * m * m * a.y + 3 * m * m * u * c1y + 3 * m * u * u * c2y + u * u * u * b.y };
      }
    }
    return last;
  }
  function posAt(tg, t) {
    var path = K.paths[tg];
    if (path && path.arc) { var P = pts(tg); if (P.length >= 2) return arcAt(P, t); }
    return { x: linVal(tg, 'x', t), y: linVal(tg, 'y', t) };
  }
  function angleAt(tg, t) {                  // auto-rotar: hacia donde va la trayectoria
    var e = .03, a = posAt(tg, t - e), b = posAt(tg, t + e), dx = b.x - a.x, dy = b.y - a.y, P;
    if (dx * dx + dy * dy < .01) {
      P = pts(tg);
      if (P.length < 2) return 0;
      if (t <= P[0].t) { dx = P[1].x - P[0].x; dy = P[1].y - P[0].y; } else if (t >= P[P.length - 1].t) { dx = P[P.length - 1].x - P[P.length - 2].x; dy = P[P.length - 1].y - P[P.length - 2].y; } else return K.ang[tg] || 0;
    }
    return (K.ang[tg] = Math.atan2(dy, dx) * 180 / Math.PI);
  }
  function current(tg, p) { var t = A.state().t; if (p === 'x') return posAt(tg, t).x; if (p === 'y') return posAt(tg, t).y; return linVal(tg, p, t); }
  function unionTimes(tg) {                  // los momentos con clave en cualquier propiedad: lo que enseña la pista resumen
    var out = [];
    animated(tg).forEach(function (p) {
      timed(tg, p.id).forEach(function (e) {
        var g = null;
        for (var i = 0; i < out.length; i++) if (Math.abs(out[i].t - e.t) < HF) { g = out[i]; break; }
        if (!g) { g = { t: e.t, items: [] }; out.push(g); }
        g.items.push({ p: p.id, k: e.k });
      });
    });
    return out.sort(function (a, b) { return a.t - b.t; });
  }

  // ---------- selección de clave y tramo ----------
  function isSelKey(k) { return !!K.sel && K.sel.tg === target() && K.sel.items.some(function (i) { return i.k === k; }); }
  function setSel(tg, items, t) { K.sel = items.length ? { tg: tg, items: items, t: t } : null; }
  function tramo() {                         // las claves cuyo ease cambia el editor de curva, y los extremos del tramo
    if (!K.sel) return null;
    var list = [], from = null, to = null;
    K.sel.items.forEach(function (i) {
      var c = timed(K.sel.tg, i.p), n = -1;
      c.forEach(function (e, j) { if (e.k === i.k) n = j; });
      if (n < 0) return;
      if (n === 0) n = 1;                    // la primera clave no tiene tramo de llegada: el de salida
      if (!c[n]) return;
      list.push(c[n].k);
      if (from == null) { from = c[n - 1].t; to = c[n].t; }
    });
    return list.length ? { list: list, from: from, to: to, ease: list[0].ease } : null;
  }
  function setEase(ease) {
    var tr = tramo();
    if (!tr) return;
    tr.list.forEach(function (k) { k.ease = ease; });
    change();
  }

  // ---------- vista previa ----------
  function locate(tg, t) {
    var T = A.state(), ov = T.el.ov, d;
    if (tg === 'video') return { key: 'video', outer: T.el.rf, inner: null };
    if (tg.indexOf('seg:') === 0) {          // un clip: su imagen gira y se mueve dentro del marco, y solo mientras se ve
      var c = A.clipAt(t);
      return c && c.s.id === tid(tg) ? { key: 'img', outer: T.el.img, inner: null } : null;
    }
    if (tg.indexOf('lib:') === 0) {
      d = ov.querySelector('.lb-l[data-lb="' + cssq(tid(tg)) + '"]');
      return d && { key: 'lib|' + tid(tg), outer: d, inner: d.querySelector('.lb-in') };
    }
    var g = tid(tg);
    if (tg.indexOf('el:') === 0) {
      var f = T.fx[fxIdx(tg)], r = f && !f.off && A.fxRange(f);
      if (!r || t < r[0] || t >= r[1]) return null;
      g = groupOf(tid(tg));
      if (!g) return null;
    }
    d = ov.querySelector('.cp-g[data-g="' + cssq(g) + '"]');
    return d && { key: 'g|' + g, outer: d, inner: d.querySelector('.cp-in') };
  }
  function axisAngle(rx, ry, rz) {           // tres giros -> un solo eje y ángulo: es lo que admite la propiedad suelta `rotate`
    var R = Math.PI / 360, q = function (a, b) { return [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0], a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]]; };
    var o = q(q([0, 0, Math.sin(rz * R), Math.cos(rz * R)], [Math.sin(rx * R), 0, 0, Math.cos(rx * R)]), [0, Math.sin(ry * R), 0, Math.cos(ry * R)]), s = Math.sqrt(1 - Math.min(1, o[3] * o[3]));
    if (s < 1e-5) return '0 0 1 0deg';
    return (o[0] / s).toFixed(5) + ' ' + (o[1] / s).toFixed(5) + ' ' + (o[2] / s).toFixed(5) + ' ' + (2 * Math.acos(o[3]) * 180 / Math.PI).toFixed(3) + 'deg';
  }
  function write(n, v) {
    var o = n.outer.style, h = v.has;
    if (!n.inner) {                          // el vídeo: una sola capa, con el 3D en la perspectiva del lienzo
      var d3 = v.rotationX || v.rotationY || v.z;
      o.translate = v.x || v.y || v.z ? v.x + 'px ' + v.y + 'px' + (v.z ? ' ' + v.z + 'px' : '') : '';
      o.rotate = d3 ? axisAngle(v.rotationX, v.rotationY, v.rotation) : v.rotation ? v.rotation + 'deg' : '';
      o.scale = v.scale !== 1 ? String(v.scale) : '';
      o.opacity = h.opacity ? String(v.opacity) : '';
      A.state().el.stage.style.perspective = d3 ? PERSP + 'px' : '';
      return;
    }
    var i = n.inner.style;
    o.translate = v.x || v.y ? v.x + 'px ' + v.y + 'px' : '';
    i.rotate = v.rotation ? v.rotation + 'deg' : '';
    i.scale = v.scale !== 1 ? String(v.scale) : '';
    i.opacity = h.opacity ? String(v.opacity) : '';
    i.transform = v.rotationX || v.rotationY || v.z ? 'perspective(' + PERSP + 'px) translateZ(' + v.z + 'px) rotateX(' + v.rotationX + 'deg) rotateY(' + v.rotationY + 'deg)' : '';
  }
  function clear(n) {
    n.outer.style.translate = '';
    var s = n.inner ? n.inner.style : n.outer.style;
    s.rotate = ''; s.scale = ''; s.opacity = '';
    if (n.inner) s.transform = ''; else { n.outer.style.opacity = ''; A.state().el.stage.style.perspective = ''; }
  }
  function blank() { return { x: 0, y: 0, scale: 1, rotation: 0, rotationX: 0, rotationY: 0, z: 0, opacity: 1, has: {} }; }
  function paint(t) {
    var over = {}, tgs = Object.keys(K.tracks).sort(function (a, b) { return (a.indexOf('el:') === 0 ? 1 : 0) - (b.indexOf('el:') === 0 ? 1 : 0); }), rec = K.rec;
    tgs.forEach(function (tg) {
      var n = locate(tg, t);
      if (!n) return;
      var slot = over[n.key] || (over[n.key] = { n: n, v: blank() }), v = slot.v, path = K.paths[tg];
      PROPS.forEach(function (p) {
        if (p.id === 'x' || p.id === 'y' || !has(tg, p.id)) return;
        v[p.id] = linVal(tg, p.id, t); v.has[p.id] = true;
      });
      if (has(tg, 'x') || has(tg, 'y')) {
        var q = posAt(tg, t);
        v.x = q.x; v.y = q.y;
        if (path && path.autoRotate) v.rotation += angleAt(tg, t);
      }
    });
    if (rec) {                               // lo que se está grabando manda sobre las claves
      var nr = locate(rec.tg, t);
      if (nr) {
        var sl = over[nr.key] || (over[nr.key] = { n: nr, v: blank() });
        Object.keys(rec.cur).forEach(function (p) { sl.v[p] = rec.cur[p]; sl.v.has[p] = true; });
      }
    }
    Object.keys(K.applied).forEach(function (k) { if (!over[k]) clear(K.applied[k]); });
    K.applied = {};
    Object.keys(over).forEach(function (k) { write(over[k].n, over[k].v); K.applied[k] = over[k].n; });
    drawPath(t);
    liveUI(t);
  }
  function liveUI(t) {                       // los números y rombos del panel siguen al cursor
    var T = A.state(), tg = target(), box = T.rtab === 'design' && tg && T.el.insp.querySelector('.kf-props');
    if (!box || box.dataset.tg !== tg) return;
    PROPS.forEach(function (p) {
      var row = box.querySelector('.kf-row[data-prop="' + p.id + '"]');
      if (!row) return;
      var inp = row.querySelector('.kf-num'), b = row.querySelector('.kf-t'), h = has(tg, p.id), at = h && keyAt(tg, p.id, t);
      if (inp !== document.activeElement) inp.value = fmtV(p, K.rec && K.rec.tg === tg && K.rec.cur[p.id] != null ? K.rec.cur[p.id] : current(tg, p.id));
      b.classList.toggle('on', !!h); b.classList.toggle('at', !!at);
      row.classList.toggle('has', !!h);
    });
    var card = T.el.insp.querySelector('.kf-card');
    if (card) card.style.transform = cardCss(tg);
  }
  function fmtV(p, v) { return p.step < 1 ? Math.round(v * 100) / 100 : Math.round(v * 10) / 10; }

  // ---------- trayectoria en la vista previa ----------
  function siteOf(tg) {                      // el centro de la capa en su sitio, sin claves (px del lienzo)
    var n = tg === 'video' ? null : locate(tg.indexOf('el:') === 0 ? 'grp:' + groupOf(tid(tg)) : tg, 0);
    if (tg === 'video') return { x: 540, y: 960 };
    var d = n && n.outer;
    if (d && d.offsetWidth) {
      var s = { x: d.offsetLeft + d.offsetWidth / 2, y: d.offsetTop + d.offsetHeight / 2 };
      if (d.classList.contains('center')) {
        var m = /scale\(([\d.]+)\)/.exec(d.style.transform), k = m ? +m[1] : 1;
        s = { x: d.offsetLeft, y: d.offsetTop + d.offsetHeight * k / 2 };
      }
      K.site[tg] = s;
    }
    return K.site[tg] || { x: 540, y: 960 };
  }
  function drawPath(t) {
    var T = A.state(), tg = target(), svg = K.svg, P = tg && (has(tg, 'x') || has(tg, 'y')) ? pts(tg) : null;
    if (!P || P.length < 2 || K.rec) { svg.style.display = 'none'; K.pSig = ''; return; }
    svg.style.display = '';
    var site = siteOf(tg), S = T.S || .25, sig = [tg, K.ver, site.x, site.y, S, K.cL && T.total, K.sel ? K.sel.t : ''].join('|');
    if (sig !== K.pSig) {
      K.pSig = sig;
      var t0 = P[0].t, t1 = P[P.length - 1].t, step = Math.max(1 / 30, (t1 - t0) / 200), d = '', u, q;
      for (u = t0; u < t1; u += step) { q = posAt(tg, u); d += (d ? 'L' : 'M') + (site.x + q.x).toFixed(1) + ' ' + (site.y + q.y).toFixed(1); }
      q = posAt(tg, t1); d += 'L' + (site.x + q.x).toFixed(1) + ' ' + (site.y + q.y).toFixed(1);
      svg.innerHTML = '<path class="ln" d="' + d + '" stroke-width="' + 2 / S + '"/>' +
        P.slice(1).map(function (p, i) {
          var tm = (P[i].t + p.t) / 2, m = posAt(tg, tm);
          return '<circle class="mid" data-mt="' + tm + '" cx="' + (site.x + m.x) + '" cy="' + (site.y + m.y) + '" r="' + 4 / S + '" stroke-width="' + 1 / S + '"><title>Añadir un punto aquí</title></circle>';
        }).join('') +
        P.map(function (p, i) {
          var on = K.sel && K.sel.tg === tg && Math.abs(K.sel.t - p.t) < HF;
          return '<circle class="pt' + (on ? ' sel' : '') + '" data-pi="' + i + '" cx="' + (site.x + p.x) + '" cy="' + (site.y + p.y) + '" r="' + 6 / S + '" stroke-width="' + 1.5 / S + '"><title>' + A.fmt(p.t) + '</title></circle>';
        }).join('') + '<circle class="now" r="' + 3.5 / S + '"/>';
      K.pNow = svg.querySelector('.now');
    }
    var c = posAt(tg, t);
    K.pNow.setAttribute('cx', site.x + c.x); K.pNow.setAttribute('cy', site.y + c.y);
  }
    function onPath(e) {
    var pt = e.target.closest('[data-pi]'), mid = e.target.closest('[data-mt]'), tg = target(), T = A.state();
    if ((!pt && !mid) || !tg) return;
    e.preventDefault(); e.stopPropagation();
    A.stop();
    if (mid) {                               // un punto intermedio a medio tramo
      var tm = +mid.dataset.mt, v = posAt(tg, tm);
      A.remember();
      setAt(tg, 'x', tm, Math.round(v.x)); setAt(tg, 'y', tm, Math.round(v.y));
      A.seek(tm);
      A.redraw();
      return;
    }
    var P = pts(tg), p = P[+pt.dataset.pi], kx = keyAt(tg, 'x', p.t), ky = keyAt(tg, 'y', p.t);
    if (e.altKey) {                          // Alt+clic: quitar el punto
      A.remember();
      if (kx) removeKey(tg, 'x', kx.k);
      if (ky) removeKey(tg, 'y', ky.k);
      K.sel = null; A.redraw();
      return;
    }
    var x0 = e.clientX, y0 = e.clientY, sx = p.x, sy = p.y, moved = false, tp = p.t;
    A.seek(tp);
    function mv(ev) {
      var dx = (ev.clientX - x0) / T.S, dy = (ev.clientY - y0) / T.S;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return;
      if (!moved) { moved = true; A.remember(); }
      setAt(tg, 'x', tp, Math.round(A.gridSnap(sx + dx))); setAt(tg, 'y', tp, Math.round(A.gridSnap(sy + dy)));
      paint(T.t);
    }
    function up() {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      var it = [], a = keyAt(tg, 'x', tp), b = keyAt(tg, 'y', tp);
      if (a) it.push({ p: 'x', k: a.k });
      if (b) it.push({ p: 'y', k: b.k });
      setSel(tg, it, tp);
      A.redraw();
    }
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  // ---------- pistas en la línea de tiempo ----------
  function laneHtml(tg, prop, label, body, top) {
    var W = A.state().width + 60, sel = target() === tg;
    return '<div class="tl-lane kf-lane" data-kf="' + A.esc(tg) + '"><div class="tl-lab ' + (top ? 'top ' : '') + (sel ? 'sel' : '') + '" data-keep-drag="1" data-kflab="' + A.esc(tg) + '" style="height:20px">' +
      (top ? '<button class="kf-tog" data-keep-drag="1" data-p="claves" data-a="tog" data-tg="' + A.esc(tg) + '" title="Expandir o plegar propiedades (U)">' + (K.open[tg] ? '▾' : '▸') + '</button>' : '<span style="width:17px;flex:none"></span>') +
      '<span class="n">' + A.esc(label) + '</span></div><div class="tl-track kf-track" style="width:' + W + 'px;height:20px">' + body + '</div></div>';
  }
  function lanesHtml() {
    var out = '';
    Object.keys(K.tracks).forEach(function (tg) {
      var ps = animated(tg);
      if (!ps.length) return;
      var groups = unionTimes(tg);
      out += laneHtml(tg, '', '◆ ' + nameOf(tg), groups.map(function (g, i) {
        var on = g.items.some(function (x) { return isSelKey(x.k); }), hold = g.items.every(function (x) { return x.k.ease === 'hold'; });
        return '<i class="kf-d' + (on ? ' sel' : '') + (hold ? ' hold' : '') + '" data-keep-drag="1" data-tg="' + A.esc(tg) + '" data-i="' + i + '" style="left:' + A.timeToX(g.t) + 'px" title="' + A.fmt(g.t) + ' · ' + g.items.length + ' prop. · arrastra para mover · Alt+clic la quita"></i>';
      }).join(''), true);
      if (!K.open[tg]) return;
      ps.forEach(function (p) {
        var c = timed(tg, p.id), body = '';
        c.forEach(function (e, i) {
          if (i) {
            var x0 = A.timeToX(c[i - 1].t), x1 = A.timeToX(e.t);
            body += '<b class="kf-seg' + (e.ease === 'hold' ? ' hold' : '') + (isSelKey(e.k) ? ' sel' : '') + '" data-keep-drag="1" data-tg="' + A.esc(tg) + '" data-prop="' + p.id + '" data-i="' + i + '" style="left:' + x0 + 'px;width:' + Math.max(1, x1 - x0) + 'px" title="Curva: ' + A.esc(e.ease) + '"></b>';
          }
          body += '<i class="kf-d' + (isSelKey(e.k) ? ' sel' : '') + (e.ease === 'hold' ? ' hold' : '') + '" data-keep-drag="1" data-tg="' + A.esc(tg) + '" data-prop="' + p.id + '" data-i="' + i + '" style="left:' + A.timeToX(e.t) + 'px" title="' + A.fmt(e.t) + ' · ' + e.v + ' · arrastra para mover · Alt+clic la quita"></i>';
        });
        out += laneHtml(tg, p.id, p.label, body, false);
      });
    });
    return out;
  }
  function placeLanes(inner) {               // cada pista de claves va justo debajo de su capa
    var last = {};
    inner.querySelectorAll('.kf-lane').forEach(function (row) {
      var tg = row.dataset.kf, sel = null;
      if (tg === 'video' || tg.indexOf('seg:') === 0) sel = '.tl-lab.tl-v';
      else if (tg.indexOf('lib:') === 0) sel = '.tl-lab[data-lane="libres"]';
      else { var g = tg.indexOf('grp:') === 0 ? tid(tg) : groupOf(tid(tg)); if (g) sel = '.tl-lab[data-lane="' + cssq(g) + '"]'; }
      var lab = sel && inner.querySelector(sel), host = last[sel] || (lab && lab.closest('.tl-lane'));
      if (!host) return;
      host.parentNode.insertBefore(row, host.nextSibling);
      last[sel] = row;
    });
  }
  function onLane(e) {
    var d = e.target.closest('.kf-d'), s = e.target.closest('.kf-seg'), lab = e.target.closest('[data-kflab]');
    if (e.target.closest('.kf-tog')) return;
    if (lab) { selectTarget(lab.dataset.kflab); return; }
    if (s) {
      var c0 = timed(s.dataset.tg, s.dataset.prop)[+s.dataset.i];
      if (!c0) return;
      setSel(s.dataset.tg, [{ p: s.dataset.prop, k: c0.k }], c0.t);
      if (!selectTarget(s.dataset.tg)) A.redraw();
      return;
    }
    if (!d) return;
    e.preventDefault();
    var tg = d.dataset.tg, prop = d.dataset.prop, t0, items;
    if (prop) { var c = timed(tg, prop)[+d.dataset.i]; if (!c) return; t0 = c.t; items = [{ p: prop, k: c.k }]; }
    else { var g = unionTimes(tg)[+d.dataset.i]; if (!g) return; t0 = g.t; items = g.items; }
    dragKeys(e, tg, items, t0);
  }
  function dragKeys(e, tg, items, t0) {
    var T = A.state(), X0 = e.clientX, x0 = A.timeToX(t0), moved = false, alt = e.altKey, raf = 0, st = items.map(function (i) { return { p: i.p, k: i.k, t: kt(i.k) }; });
    function mv(ev) {
      var dx = ev.clientX - X0;
      if (!moved && Math.abs(dx) < 3) return;
      if (!moved) { moved = true; A.remember(); }
      var nt = A.snapTime(A.clamp(A.xToTime(x0 + dx), 0, T.total)), d = nt - t0;
      st.forEach(function (s) { setKeyT(s.k, A.clamp(s.t + d, 0, T.total)); });
      change();
      setSel(tg, items, nt);
      paint(T.t);
      if (!raf) raf = requestAnimationFrame(function () { raf = 0; A.redraw(); });
    }
    function up() {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (moved) {
        T.guide = null;
        st.forEach(function (s) {            // si cae encima de otra clave de la misma pista, se queda solo la movida
          var t = kt(s.k);
          timed(tg, s.p).forEach(function (x) { if (x.k !== s.k && Math.abs(x.t - t) < HF) removeKey(tg, s.p, x.k); });
        });
        A.redraw();
        return;
      }
      if (alt) {
        A.remember();
        st.forEach(function (s) { removeKey(tg, s.p, s.k); });
        K.sel = null; A.redraw();
        return;
      }
      setSel(tg, items, t0);
      if (!selectTarget(tg)) A.redraw();
      A.seek(t0);
    }
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  // ---------- acciones ----------
  function addKeys(tg) {                     // K: clave en el cursor en todas las propiedades animadas (o posición, si no hay ninguna)
    var T = A.state(), ps = animated(tg).map(function (p) { return p.id; });
    if (!ps.length) ps = ['x', 'y'];
    A.remember();
    var vals = ps.map(function (p) { return current(tg, p); }), items = [];
    ps.forEach(function (p, i) { setAt(tg, p, T.t, Math.round(vals[i] * 1000) / 1000); var c = keyAt(tg, p, T.t); if (c) items.push({ p: p, k: c.k }); });
    setSel(tg, items, T.t);
    A.redraw();
  }
  function jump(tg, dir, prop) {
    var T = A.state(), list = prop ? timed(tg, prop).map(function (c) { return c.t; }) : unionTimes(tg).map(function (g) { return g.t; }), best = null;
    list.forEach(function (t) { if (dir < 0 ? t < T.t - HF && (best == null || t > best) : t > T.t + HF && (best == null || t < best)) best = t; });
    if (best == null) return;
    A.stop();
    var g = unionTimes(tg).filter(function (x) { return Math.abs(x.t - best) < HF; })[0];
    if (g) setSel(tg, prop ? g.items.filter(function (i) { return i.p === prop; }) : g.items, best);
    A.seek(best);
    A.redraw();
  }
  function toggleHold() {
    var tr = tramo();
    if (!tr) return false;
    A.remember();
    var allHold = tr.list.every(function (k) { return k.ease === 'hold'; });
    tr.list.forEach(function (k) {
      if (allHold) { k.ease = k._e || DEF_EASE; delete k._e; } else if (k.ease !== 'hold') { k._e = k.ease; k.ease = 'hold'; }
    });
    change(); A.redraw();
    return true;
  }
  function delSel() {
    if (!K.sel) return false;
    A.remember();
    var s = K.sel; K.sel = null;
    s.items.forEach(function (i) { removeKey(s.tg, i.p, i.k); });
    A.redraw();
    return true;
  }
  function syncTools() {
    var box = A.state().el.kftools;
    if (!box) return;
    var a = box.querySelector('[data-a=auto]'), r = box.querySelector('[data-a=rec]');
    if (a) a.classList.toggle('on', !!K.auto);
    if (r) r.classList.toggle('on', !!K.rec);
  }
  function setAllEase(tg, ease) { PROPS.forEach(function (p) { timed(tg, p.id).forEach(function (c) { c.k.ease = ease; }); }); change(); }

  // ---------- grabar a mano: mover una capa en la vista previa crea claves ----------
  function onOvCapture(e) {
    if (!K.auto || K.rec || e.button) return;
    var node = e.target.closest('.cp-g,.lb-l');
    if (!node || e.target.closest('.cp-h,.lb-h,.cp-edit,.lb-edit')) return;
    e.preventDefault(); e.stopPropagation();
    A.stop();
    var T = A.state(), cur = target(), tg;
    if (node.classList.contains('lb-l')) tg = 'lib:' + node.dataset.lb;
    else tg = cur && cur.indexOf('el:') === 0 && groupOf(tid(cur)) === node.dataset.g ? cur : 'grp:' + node.dataset.g;
    selectTarget(tg);
    var sx = e.clientX, sy = e.clientY, x0 = current(tg, 'x'), y0 = current(tg, 'y'), t = T.t, moved = false;
    function mv(ev) {
      var dx = (ev.clientX - sx) / T.S, dy = (ev.clientY - sy) / T.S;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return;
      if (!moved) { moved = true; A.remember(); }
      setAt(tg, 'x', t, Math.round(A.gridSnap(x0 + dx))); setAt(tg, 'y', t, Math.round(A.gridSnap(y0 + dy)));
      paint(T.t);
    }
    function up() {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (moved) A.redraw();
    }
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  // ---------- grabación de gestos (R) ----------
  function rdp(s, eps) {                     // reducción de puntos: se quedan los que se apartan de la recta más de eps
    if (s.length < 3) return s.slice();
    var keep = [0, s.length - 1], stack = [[0, s.length - 1]];
    while (stack.length) {
      var r = stack.pop(), a = s[r[0]], b = s[r[1]], best = -1, bd = eps;
      for (var i = r[0] + 1; i < r[1]; i++) {
        var u = (s[i].t - a.t) / Math.max(1e-6, b.t - a.t), d = Math.abs(a.v + (b.v - a.v) * u - s[i].v);
        if (d > bd) { bd = d; best = i; }
      }
      if (best >= 0) { keep.push(best); stack.push([r[0], best], [best, r[1]]); }
    }
    return keep.sort(function (x, y) { return x - y; }).map(function (i) { return s[i]; });
  }
  function recBase(rec, p) { if (rec.cur[p] == null) rec.cur[p] = current(rec.tg, p); return rec.cur[p]; }
  function recStart() {
    var T = A.state(), tg = target();
    if (!tg) { A.toast('Elige primero una capa para grabar su gesto', true); return; }
    K.rec = { tg: tg, cur: {}, drive: {}, s: {}, wheel: {} };
    K.pane.hidden = false;
    syncTools();
    if (!T.playing) { T.endAt = null; A.play(); }
    paint(T.t);
  }
  function recStop(cancel) {
    var rec = K.rec, T = A.state();
    if (!rec) return;
    K.rec = null;
    K.pane.hidden = true;
    syncTools();
    if (T.playing) A.stop();
    var props = Object.keys(rec.s).filter(function (p) { return rec.s[p].length; });
    if (cancel || !props.length) { if (!cancel) A.toast('No se grabó nada: arrastra sobre la vista previa mientras suena'); paint(T.t); return; }
    A.remember();
    var n = 0;
    props.forEach(function (p) {
      var sm = rec.s[p], kept = rdp(sm, BY[p].eps), t0 = sm[0].t, t1 = sm[sm.length - 1].t, tr = ensure(rec.tg, p), mode = K.recMode, keep = [];
      if (mode !== 'replace') tr.forEach(function (k) { var t = kt(k); if (t == null || t < t0 - HF || t > t1 + HF) keep.push(k); });
      var added = kept.map(function (s) { return makeKey(s.t, Math.round(s.v * 1000) / 1000, 'none'); });
      if (mode === 'range') {                // nuevo rango: no se mezcla con lo de antes ni con lo de después
        added[0].ease = 'hold';
        var after = keep.map(function (k) { return { k: k, t: kt(k) }; }).filter(function (x) { return x.t != null && x.t > t1; }).sort(function (a, b) { return a.t - b.t; })[0];
        if (after) after.k.ease = 'hold';
      }
      tr.length = 0;
      keep.concat(added).forEach(function (k) { tr.push(k); });
      n += added.length;
    });
    change();
    A.toast(n + ' puntos grabados');
    A.redraw();
  }
  function recSample(t) {
    var rec = K.rec, now = performance.now();
    if (!rec) return;
    Object.keys(rec.wheel).forEach(function (p) { if (now > rec.wheel[p]) delete rec.wheel[p]; });
    Object.keys(rec.drive).concat(Object.keys(rec.wheel)).forEach(function (p) {
      var s = rec.s[p] || (rec.s[p] = []), l = s[s.length - 1];
      if (!l || t - l.t > 1 / 61) s.push({ t: t, v: rec.cur[p] });
    });
  }
  function onPanePointer(e) {
    var rec = K.rec;
    if (!rec) return;
    e.preventDefault(); e.stopPropagation();
    K.pane.setPointerCapture(e.pointerId);
    var T = A.state(), mode = e.altKey ? 'rot' : e.ctrlKey || e.metaKey ? 'op' : e.shiftKey ? 'tilt' : 'pos', x0 = e.clientX, y0 = e.clientY, b = {}, props = { pos: ['x', 'y'], tilt: ['rotationX', 'rotationY'], rot: ['rotation'], op: ['opacity'] }[mode];
    props.forEach(function (p) { b[p] = recBase(rec, p); rec.drive[p] = true; });
    function mv(ev) {
      var dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (mode === 'pos') { rec.cur.x = b.x + dx / T.S; rec.cur.y = b.y + dy / T.S; }
      else if (mode === 'tilt') { rec.cur.rotationY = b.rotationY + dx * .5; rec.cur.rotationX = b.rotationX - dy * .5; }
      else if (mode === 'rot') rec.cur.rotation = b.rotation + dx * .5;
      else rec.cur.opacity = A.clamp(b.opacity - dy / 200, 0, 1);
    }
    function up() {
      K.pane.removeEventListener('pointermove', mv); K.pane.removeEventListener('pointerup', up); K.pane.removeEventListener('pointercancel', up);
      props.forEach(function (p) { delete rec.drive[p]; });
    }
    K.pane.addEventListener('pointermove', mv); K.pane.addEventListener('pointerup', up); K.pane.addEventListener('pointercancel', up);
  }
  function onPaneWheel(e) {
    var rec = K.rec;
    if (!rec) return;
    e.preventDefault(); e.stopPropagation();
    var p = e.ctrlKey || e.metaKey ? 'scale' : 'z', b = recBase(rec, p);
    rec.cur[p] = p === 'scale' ? Math.max(.01, b * (1 - e.deltaY / 800)) : b - e.deltaY * .5;
    rec.wheel[p] = performance.now() + 200;
  }

  // ---------- panel ----------
  function propsHtml(tg) {
    var T = A.state();
    return '<div class="kf-props" data-tg="' + A.esc(tg) + '">' + PROPS.map(function (p) {
      var h = has(tg, p.id), at = h && keyAt(tg, p.id, T.t), v = fmtV(p, current(tg, p.id));
      return '<div class="kf-row' + (h ? ' has' : '') + '" data-prop="' + p.id + '">' +
        '<button class="kf-nav" data-p="claves" data-a="prev" data-prop="' + p.id + '" title="Punto anterior">‹</button>' +
        '<button class="kf-t' + (h ? ' on' : '') + (at ? ' at' : '') + '" data-p="claves" data-a="kt" data-prop="' + p.id + '" title="Activar claves / poner o quitar la de este momento. Alt+clic: quitar todas"><i></i></button>' +
        '<button class="kf-nav" data-p="claves" data-a="next" data-prop="' + p.id + '" title="Punto siguiente">›</button>' +
        '<label>' + p.label + '</label><input type="number" class="st-in kf-num" data-keep="1" data-p="claves" data-k="num" data-prop="' + p.id + '" step="' + p.step + '" value="' + v + '"><span class="kf-u">' + p.unit + '</span></div>';
    }).join('') + '</div><div class="tl-acts"><button data-p="claves" data-a="add" title="K">Añadir punto en el cursor</button>' + (K.sel && K.sel.tg === tg ? '<button data-p="claves" data-a="del" title="Supr">Quitar el elegido</button>' : '') + (K.tracks[tg] ? '<button class="warn" data-p="claves" data-a="clear">Quitar todos</button>' : '') + '</div>';
  }
  function thumb(ease, active) {
    return '<svg width="36" height="28" viewBox="0 0 36 28"><path d="' + curveD(ease, 36, 28, 3, -.25, 1.25, 28) + '" fill="none" stroke="' + (active ? '#3ce6ac' : '#a3a3a3') + '" stroke-width="1.5" stroke-linejoin="round"/></svg>';
  }
  var BZ = { w: 188, h: 230, pad: 12, lo: -.6, hi: 1.6 };
  function bzX(v) { return BZ.pad + v * (BZ.w - 2 * BZ.pad); }
  function bzY(v) { return BZ.pad + (BZ.hi - v) / (BZ.hi - BZ.lo) * (BZ.h - 2 * BZ.pad); }
  function bzInner(p, ease) {
    return '<rect x="' + bzX(0) + '" y="' + bzY(1) + '" width="' + (bzX(1) - bzX(0)) + '" height="' + (bzY(0) - bzY(1)) + '" fill="none" stroke="#262626"/>' +
      '<path d="' + curveD(ease, BZ.w, BZ.h, BZ.pad, BZ.lo, BZ.hi, 60) + '" fill="none" stroke="#3ce6ac" stroke-width="2"/>' +
      '<line x1="' + bzX(0) + '" y1="' + bzY(0) + '" x2="' + bzX(p[0]) + '" y2="' + bzY(p[1]) + '" stroke="#737373"/><line x1="' + bzX(1) + '" y1="' + bzY(1) + '" x2="' + bzX(p[2]) + '" y2="' + bzY(p[3]) + '" stroke="#737373"/>' +
      '<circle data-bz="0" cx="' + bzX(p[0]) + '" cy="' + bzY(p[1]) + '" r="6" fill="#fff" stroke="#3ce6ac" stroke-width="2"/><circle data-bz="1" cx="' + bzX(p[2]) + '" cy="' + bzY(p[3]) + '" r="6" fill="#fff" stroke="#3ce6ac" stroke-width="2"/>';
  }
  function curveHtml(tg) {
    if (!K.sel || K.sel.tg !== tg) return '<div class="help">Elige un rombo o un tramo en la línea de tiempo para cambiar su curva.</div>';
    var tr = tramo();
    if (!tr) return '<div class="help">Con un solo punto no hay movimiento: añade otro.</div>';
    var ease = tr.ease, tab = K.ctab || kindOf(ease), LIST = (window.ESQUEMA && ESQUEMA.eases) || [];
    var html = '<div class="q" style="margin:0 0 6px">Tramo ' + A.fmt(tr.from) + ' → ' + A.fmt(tr.to) + (tr.list.length > 1 ? ' · ' + tr.list.length + ' propiedades' : '') + '</div>' +
      '<div class="kf-cvt">' + [['curve', 'Suave'], ['spring', 'Rebote'], ['wiggle', 'Vaivén']].map(function (x) { return '<button data-p="claves" data-a="ctab" data-v="' + x[0] + '" class="' + (tab === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="kf-grid">' + LIST.filter(function (e) { return e.kind === tab; }).map(function (e) {
        return '<button class="kf-e' + (e.ease === ease ? ' on' : '') + '" data-p="claves" data-a="ease" data-v="' + A.esc(e.ease) + '" title="' + A.esc(easeName(e.label)) + '">' + thumb(e.ease, e.ease === ease) + '<span>' + A.esc(easeName(e.label)) + '</span></button>';
      }).join('') + '</div>';
    if (tab === 'curve') {
      html += '<svg class="kf-bz" width="' + BZ.w + '" height="' + BZ.h + '" viewBox="0 0 ' + BZ.w + ' ' + BZ.h + '">' + bzInner(bezOf(ease), ease) + '</svg><div class="help" style="text-align:center">Arrastra los dos puntos para hacer tu curva.</div>';
    } else {
      var isS = /^spring/.test(ease), isW = /^wiggle/.test(ease);
      if (tab === 'spring') {
        var b = isS ? parseFloat(ease.slice(7)) : .4;
        html += '<div class="kf-pr">Fuerza <input class="st-in" type="number" data-keep="1" data-p="claves" data-k="spring" min="0" max="1" step="0.01" value="' + b + '"></div>';
      } else {
        var m = isW ? /wiggle\((\d+),(\w+)(?:,([\d.]+))?\)/.exec(ease.replace(/\s/g, '')) : null, n = m ? +m[1] : 3, ty = m ? m[2] : 'easeInOut', am = m && m[3] != null ? +m[3] : .12;
        html += '<div class="kf-pr">Veces <input class="st-in" type="number" data-keep="1" data-p="claves" data-k="wn" min="1" step="1" value="' + n + '"> Fuerza <input class="st-in" type="number" data-keep="1" data-p="claves" data-k="wa" min="0" max="1" step="0.01" value="' + am + '"> <select data-p="claves" data-k="wt">' + ['easeOut', 'easeInOut', 'anticipate', 'uniform'].map(function (x) { return '<option' + (x === ty ? ' selected' : '') + '>' + x + '</option>'; }).join('') + '</select></div>';
      }
      html += '<svg class="kf-bz kf-big" width="' + BZ.w + '" height="120" viewBox="0 0 ' + BZ.w + ' 120"><path d="' + curveD(ease, BZ.w, 120, 10, -.3, 1.4, 90) + '" fill="none" stroke="#3ce6ac" stroke-width="2"/></svg>';
    }
    return html + '<div class="tl-acts"><button data-p="claves" data-a="easeall" title="Pone esta curva en todos los tramos de esta capa">Aplicar a todos los tramos</button><button data-p="claves" data-a="hold" title="H" class="' + (ease === 'hold' ? 'on' : '') + '">Sin transición</button></div>';
  }
  function pathHtml(tg) {
    var P = pts(tg), path = K.paths[tg] || {};
    if (P.length < 2) return '<div class="help">Añade al menos 2 puntos de posición para ver el recorrido y hacerlo en curva.</div>';
    return '<div class="tl-acts"><button data-p="claves" data-a="arc" class="' + (path.arc ? 'on' : '') + '" title="Une los puntos con una curva en lugar de rectas">En curva</button><button data-p="claves" data-a="arot" class="' + (path.autoRotate ? 'on' : '') + '" title="La capa gira hacia donde se mueve">Girar según avanza</button><button data-p="claves" data-a="way" title="Pone un punto en el cursor">Añadir punto intermedio</button></div>' +
      '<div class="help">En la vista previa: arrastra los puntos; el punto hueco de cada tramo añade uno intermedio; Alt+clic lo quita.</div>';
  }
  function cardCss(tg) { return 'rotateX(' + current(tg, 'rotationX') + 'deg) rotateY(' + current(tg, 'rotationY') + 'deg) rotateZ(' + current(tg, 'rotation') + 'deg) translateZ(' + (current(tg, 'z') / 8) + 'px)'; }
  function tiltHtml(tg) {
    return '<div class="kf-pad"><div class="kf-card" style="transform:' + cardCss(tg) + '"></div></div><div class="help" style="margin-top:6px">Arrastra para inclinar · Mayús: girar de lado · Rueda: profundidad</div><div class="tl-acts"><button data-p="claves" data-a="reset3d">Restablecer 3D</button></div>';
  }
  function tiltDrag(e, tg) {
    e.preventDefault();
    A.stop();
    var T = A.state(), x0 = e.clientX, y0 = e.clientY, rx = current(tg, 'rotationX'), ry = current(tg, 'rotationY'), rz = current(tg, 'rotation'), shift = e.shiftKey, t = T.t, moved = false, isNew = false;
    function mv(ev) {
      var dx = ev.clientX - x0, dy = ev.clientY - y0;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return;
      if (!moved) { moved = true; A.remember(); }
      if (shift) isNew = setAt(tg, 'rotation', t, Math.round(rz + dx * .5)) || isNew;
      else { isNew = setAt(tg, 'rotationX', t, Math.round(rx - dy * .5)) || isNew; isNew = setAt(tg, 'rotationY', t, Math.round(ry + dx * .5)) || isNew; }
      paint(T.t);
    }
    function up() {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (isNew) A.redraw();
    }
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  function bzDrag(e) {
    e.preventDefault();
    var svg = e.target.closest('svg'), i = +e.target.dataset.bz, tr = tramo();
    if (!tr) return;
    var p = bezOf(tr.ease), moved = false, r = svg.getBoundingClientRect();
    function mv(ev) {
      if (!moved) { moved = true; A.remember(); }
      var x = A.clamp((ev.clientX - r.left - BZ.pad) / (BZ.w - 2 * BZ.pad), 0, 1), y = A.clamp(BZ.hi - (ev.clientY - r.top - BZ.pad) / (BZ.h - 2 * BZ.pad) * (BZ.hi - BZ.lo), BZ.lo, BZ.hi);
      p[i * 2] = x; p[i * 2 + 1] = y;
      var s = bezStr(p);
      setEase(s);
      svg.innerHTML = bzInner(p, s);
      paint(A.state().t);
    }
    function up() {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (moved) A.redraw();
    }
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  // ---------- la API para otros módulos (duplicar o borrar capas libres) ----------
  function snapshotOf(tg) { return K.tracks[tg] ? JSON.parse(JSON.stringify({ tracks: K.tracks[tg], path: K.paths[tg] || null })) : null; }
  function restoreOf(tg, o, dt) {
    if (!o) { delete K.tracks[tg]; delete K.paths[tg]; change(); return; }
    var c = JSON.parse(JSON.stringify(o));
    K.tracks[tg] = c.tracks;
    if (c.path) K.paths[tg] = c.path;
    K.cache = {};
    if (dt) Object.keys(c.tracks).forEach(function (p) { c.tracks[p].forEach(function (k) { var t = kt(k); if (t != null) setKeyT(k, A.clamp(t + dt, 0, A.state().total)); }); });
    change();
  }

  ME = {
    id: 'claves',
    init: function (api, input, saved) {
      A = api;
      saved = saved || {};
      var T = A.state();
      K = { tracks: {}, paths: saved.paths || {}, open: {}, sel: null, cache: {}, ver: 0, cL: null, applied: {}, site: {}, ang: {}, auto: false, rec: null, recMode: 'merge', lastMem: 0, ctab: null };
      Object.keys(saved.tracks || {}).forEach(function (tg) {
        K.tracks[tg] = {};
        Object.keys(saved.tracks[tg]).forEach(function (p) {
          if (!BY[p]) return;
          K.tracks[tg][p] = (saved.tracks[tg][p] || []).map(function (s) {
            var sg = s.anchor && T.segs.filter(function (x) { return x.id === s.anchor.seg; })[0], k = { v: s.v, ease: s.ease || DEF_EASE };
            if (sg) { k.seg = sg._id; k.src = s.anchor.src; k.clip = sg.clip; } else setKeyT(k, A.clamp(s.t || 0, 0, T.total));
            return k;
          });
        });
      });
      var st = document.createElement('style'); st.textContent = CSS_; document.head.appendChild(st);
      K.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      K.svg.setAttribute('class', 'kf-path'); K.svg.setAttribute('viewBox', '0 0 1080 1920'); K.svg.style.display = 'none';
      K.svg.addEventListener('pointerdown', onPath);
      T.el.ov.appendChild(K.svg);
      K.pane = document.createElement('div');
      K.pane.className = 'kf-pane'; K.pane.hidden = true;
      K.pane.innerHTML = '<b>Grabando · R termina</b>';
      K.pane.addEventListener('pointerdown', onPanePointer);
      K.pane.addEventListener('wheel', onPaneWheel, { passive: false });
      T.el.ov.appendChild(K.pane);
      T.el.ov.addEventListener('pointerdown', onOvCapture, true);
      T.el.inner.addEventListener('pointerdown', onLane);
      T.el.insp.addEventListener('pointerdown', function (e) {
        var tg = target();
        if (!tg) return;
        if (e.target.closest('.kf-pad')) tiltDrag(e, tg);
        else if (e.target.dataset && e.target.dataset.bz != null) bzDrag(e);
      });
      T.el.insp.addEventListener('wheel', function (e) {
        var tg = target();
        if (!tg || !e.target.closest('.kf-pad')) return;
        e.preventDefault();
        if (Date.now() - K.lastMem > 700) A.remember();
        K.lastMem = Date.now();
        if (setAt(tg, 'z', T.t, Math.round(current(tg, 'z') - e.deltaY * .5))) A.redraw(); else paint(T.t);
      }, { passive: false });
      window.MiClaves = { get: snapshotOf, set: restoreOf, drop: function (tg) { if (K.tracks[tg]) restoreOf(tg, null); } };
      return true;
    },
    lanes: lanesHtml,
    drawTracks: placeLanes,
    kfTools: function () {
      var b = function (a, inner, title, cls) { return '<button class="st-tb ' + (cls || '') + '" data-p="claves" data-a="' + a + '" title="' + A.esc(title) + '">' + inner + '</button>'; };
      return '<i class="st-div"></i>' + b('prevk', '‹', 'Punto anterior (Alt+←)') + b('add', A.ic('key'), 'Añadir punto en el cursor (K)') + b('nextk', '›', 'Punto siguiente (Alt+→)') + b('expand', '≡', 'Expandir o plegar propiedades (U)') +
        b('auto', 'Animar al mover', 'Con esto puesto, mover una capa en la vista previa crea puntos de animación solos', 'st-txt') + b('rec', A.ic('rec'), 'Grabar gesto (R): mientras suena, arrastra sobre la vista previa', 'kf-rec') + b('recopts', A.ic('dots'), 'Cómo se mezcla lo grabado');
    },
    designExtra: function () {
      var tg = target(), S = A.section;
      if (!tg) return '';
      return S('kf-props', 'Animación', propsHtml(tg)) + (K.sel && K.sel.tg === tg ? S('kf-curve', 'Suavidad del movimiento', curveHtml(tg)) : '') +
        (has(tg, 'x') || has(tg, 'y') ? S('kf-path', 'Recorrido', pathHtml(tg)) : '') + S('kf-tilt', 'Giro 3D', tiltHtml(tg), false);
    },
    paint: paint,
    onTick: recSample,
    onStop: function () { if (K.rec) recStop(); },
    onClick: function (b, e) {
      var a = b.dataset.a, tg = target(), prop = b.dataset.prop, T = A.state();
      if (a === 'auto') { K.auto = !K.auto; syncTools(); A.toast(K.auto ? 'Animar al mover: mover una capa crea puntos en el cursor' : 'Animar al mover apagado'); return; }
      if (a === 'rec') { if (K.rec) recStop(); else recStart(); return; }
      if (a === 'recopts') {
        var modes = [['merge', 'Combinar', 'Sustituye solo lo que cae en el rango grabado'], ['range', 'Nuevo rango', 'Igual, pero sin mezclarse con lo de antes y después (saltos)'], ['replace', 'Sustituir', 'Borra todos los puntos de lo grabado']];
        A.popup('<h4>Lo grabado…</h4><div class="st-pop-row">' + modes.map(function (m) { return '<button data-p="claves" data-a="recmode" data-v="' + m[0] + '" class="' + (K.recMode === m[0] ? 'on' : '') + '" title="' + m[2] + '">' + m[1] + '</button>'; }).join('') + '</div>' +
          '<div style="margin-top:8px;font-size:11px;color:var(--t3);line-height:1.6;max-width:240px">Arrastrar: mover<br>Rueda: profundidad<br>Mayús+arrastrar: girar en 3D<br>Alt+arrastrar: girar<br>Ctrl+arrastrar: opacidad<br>Ctrl+rueda: tamaño</div>', b);
        return;
      }
      if (a === 'recmode') { K.recMode = b.dataset.v; A.closePopup(); return; }
      if (a === 'tog') { K.open[b.dataset.tg] = !K.open[b.dataset.tg]; A.redraw(); return; }
      if (a === 'expand') { toggleOpen(tg); return; }
      if (a === 'ctab') { K.ctab = b.dataset.v; A.refresh(); return; }
      if (!tg) { A.toast('Elige primero una capa', true); return; }
      if (a === 'prev' || a === 'next') { jump(tg, a === 'prev' ? -1 : 1, prop); return; }
      if (a === 'prevk' || a === 'nextk') { jump(tg, a === 'prevk' ? -1 : 1); return; }
      if (a === 'add') { addKeys(tg); return; }
      if (a === 'del') { delSel(); return; }
      if (a === 'hold') { toggleHold(); return; }
      A.remember();
      if (a === 'kt') {
        var c = keyAt(tg, prop, T.t);
        if (e.altKey) {
          timed(tg, prop).slice().forEach(function (x) { removeKey(tg, prop, x.k); });
          K.sel = null;
        } else if (c) {
          removeKey(tg, prop, c.k);
          if (K.sel) K.sel.items = K.sel.items.filter(function (i) { return i.k !== c.k; });
          if (K.sel && !K.sel.items.length) K.sel = null;
        } else setAt(tg, prop, T.t, Math.round(current(tg, prop) * 1000) / 1000);
      } else if (a === 'clear') {
        restoreOf(tg, null); K.sel = null;
      } else if (a === 'ease') {
        setEase(b.dataset.v); K.ctab = kindOf(b.dataset.v);
      } else if (a === 'easeall') {
        var tr = tramo(); if (tr) setAllEase(tg, tr.ease);
      } else if (a === 'arc' || a === 'arot') {
        var p = K.paths[tg] || (K.paths[tg] = {}), f = a === 'arc' ? 'arc' : 'autoRotate';
        p[f] = !p[f];
        change();
      } else if (a === 'way') {
        var q = posAt(tg, T.t);
        setAt(tg, 'x', T.t, Math.round(q.x)); setAt(tg, 'y', T.t, Math.round(q.y));
      } else if (a === 'reset3d') {
        ['rotationX', 'rotationY', 'z'].forEach(function (x) { timed(tg, x).slice().forEach(function (c2) { removeKey(tg, x, c2.k); }); });
        K.sel = null;
      }
      A.redraw();
    },
    onInput: function (el) {
      var k = el.dataset.k, tg = target(), T = A.state();
      if (!tg || !k) return;
      if (Date.now() - K.lastMem > 700) A.remember();
      K.lastMem = Date.now();
      if (k === 'num') {
        var v = parseFloat(el.value);
        if (isNaN(v)) return;
        if (el.dataset.prop === 'opacity') v = A.clamp(v, 0, 1);
        if (setAt(tg, el.dataset.prop, T.t, v)) A.redraw(); else paint(T.t);
        return;
      }
      var cur = tramo();
      if (!cur) return;
      var ease = null;
      if (k === 'spring') ease = 'spring(' + A.clamp(+el.value || 0, 0, 1) + ')';
      else {
        var box = el.closest('.kf-pr'), n = Math.max(1, Math.round(+box.querySelector('[data-k=wn]').value || 1)), am = A.clamp(+box.querySelector('[data-k=wa]').value || 0, 0, 1);
        ease = 'wiggle(' + n + ',' + box.querySelector('[data-k=wt]').value + ',' + am + ')';
      }
      setEase(ease);
      var big = T.el.insp.querySelector('.kf-big path');
      if (big) big.setAttribute('d', curveD(ease, BZ.w, 120, 10, -.3, 1.4, 90));
      paint(T.t);
    },
    key: function (e) {
      if (e.ctrlKey || e.metaKey) return false;
      var k = e.key.toLowerCase(), tg = target();
      if (k === 'escape' && K.rec) { recStop(true); return true; }
      if (k === 'r' && !e.shiftKey && !e.altKey) { e.preventDefault(); if (K.rec) recStop(); else recStart(); return true; }
      if (e.altKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && tg) { e.preventDefault(); jump(tg, e.key === 'ArrowLeft' ? -1 : 1); return true; }
      if (k === 'u') { e.preventDefault(); toggleOpen(tg); return true; }
      if (k === 'h' && K.sel && K.sel.tg === tg) { e.preventDefault(); return toggleHold(); }
      if ((e.key === 'Delete' || e.key === 'Backspace') && K.sel && K.sel.tg === tg) { e.preventDefault(); return delSel(); }
      // K es "parar" si no hay capa elegida (en un fragmento de vídeo, solo si ya tiene claves)
      if (k === 'k' && tg && (!/^(video|seg:)/.test(tg) || K.tracks[tg])) { e.preventDefault(); addKeys(tg); return true; }
      return false;
    },
    shortcuts: function () { return [['Animación (con una capa elegida)', [['K', 'Añadir punto en el cursor'], ['Supr', 'Quitar el punto elegido'], ['H', 'Sin transición / suave'], ['U', 'Expandir o plegar propiedades'], ['R', 'Grabar gesto'], ['Alt+← / →', 'Punto anterior o siguiente'], ['Alt+clic en un rombo', 'Quitarlo']]]]; },
    helpExtra: function () { return '<b>Animación:</b> elige una capa y toca el rombo de una propiedad (panel Ajustes) o pulsa K. Los rombos salen bajo la capa: arrástralos; toca el tramo entre dos para cambiar su curva.<br>'; },
    snap: function () { return { t: K.tracks, p: K.paths }; },
    restore: function (s) { K.tracks = JSON.parse(JSON.stringify(s.t)); K.paths = JSON.parse(JSON.stringify(s.p)); K.sel = null; K.cache = {}; K.ver++; K.cL = null; },
    data: function () {
      var T = A.state(), out = { tracks: {}, paths: {} };
      var r3 = function (v) { return Math.round(v * 1000) / 1000; };
      K.cache = {}; K.cL = null;
      Object.keys(K.tracks).forEach(function (tg) {
        var o = {};
        PROPS.forEach(function (p) {
          var c = timed(tg, p.id);
          if (!c.length) return;
          o[p.id] = c.map(function (e) {
            var sg = T.segs.filter(function (x) { return x._id === e.k.seg; })[0];
            return { t: r3(e.t), v: r3(e.v), ease: e.ease, anchor: sg ? { seg: sg.id, src: r3(e.k.src) } : null };
          });
        });
        if (Object.keys(o).length) out.tracks[tg] = o;
      });
      Object.keys(K.paths).forEach(function (tg) {
        var p = K.paths[tg];
        if (out.tracks[tg] && (p.arc || p.autoRotate)) out.paths[tg] = { arc: !!p.arc, autoRotate: !!p.autoRotate };
      });
      return out;
    }
  };
  function toggleOpen(tg) {
    var list = tg && K.tracks[tg] ? [tg] : Object.keys(K.tracks), v = !list.every(function (x) { return K.open[x]; });
    list.forEach(function (x) { K.open[x] = v; });
    A.redraw();
  }
  Timeline.use(ME);
})();
