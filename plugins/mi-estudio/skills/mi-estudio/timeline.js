// Edición de Mi Estudio: una sola vista con la estructura de HyperFrames Studio. Barra lateral con pestañas, vista previa
// grande a la derecha de arriba abajo, ajustes en el centro y la línea de tiempo debajo de ellos (como CapCut), todo redimensionable. Todo lo que se toca se guarda como
// JSON; el HTML final sale después de esos JSON (aplicar.py), nunca se edita a mano.
// Los fragmentos y las capas se anclan a un momento del clip fuente (fragmento + segundo del clip), así que si
// recortas un fragmento anterior, lo que va después se mueve con las palabras que acompaña.
// Lo que no es cortar son módulos de herramientas/*.js que se enchufan con Timeline.use({...}); ver SKILL.md, "Pestaña Edición".
(function () {
  var FPS = 30, MIN_SEG = 3 / FPS, MIN_FX = 0.5, GAP = 2, OFF_W = 14, W = 1080, H = 1920, LW = 132, SNAP_PX = 7;
  var T = null, PLUGINS = [], HOST_LEFT = [];
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var snapF = function (v) { return Math.round(v * FPS) / FPS; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var sp = function (s) { return s.overlay ? 1 : (s.speed || 1); };   // un fragmento con "speed" va acelerado en el montaje
  var fmt = function (t) { t = Math.max(0, t); var m = Math.floor(t / 60); return m + ':' + (t - m * 60).toFixed(2).padStart(5, '0'); };
  var fmtS = function (t) { t = Math.max(0, t); var m = Math.floor(t / 60); return String(m).padStart(2, '0') + ':' + String(Math.floor(t - m * 60)).padStart(2, '0'); };
  var SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4];
  var ICON = {
    sel: '<path d="M4 3l6 15 2-6 6-2z"/>', razor: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M8.5 8L20 18M8.5 16L20 6"/>',
    snap: '<path d="M5 4v8a7 7 0 0014 0V4h-4v8a3 3 0 01-6 0V4z"/>', key: '<path d="M12 3l9 9-9 9-9-9z"/>', rec: '<circle cx="12" cy="12" r="6" fill="currentColor"/>',
    split: '<path d="M12 3v18M7 8H3v8h4M17 8h4v8h-4"/>', beat: '<path d="M12 3v18M6 8v8M18 8v8M3 11v2M21 11v2"/>', thumb: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M8 5v14M16 5v14"/>',
    minus: '<circle cx="11" cy="11" r="7"/><path d="M8 11h6M21 21l-5-5"/>', plus: '<circle cx="11" cy="11" r="7"/><path d="M8 11h6M11 8v6M21 21l-5-5"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>', eyeoff: '<path d="M3 3l18 18M10 6a9 9 0 012-.2c6 0 10 6.200 10 6.200a17 17 0 01-3.500 4M6.500 7.500A17 17 0 002 12s4 7 10 7a9 9 0 004-.9"/>',
    play: '<path d="M7 4l13 8-13 8z" fill="currentColor"/>', pause: '<path d="M7 4h4v16H7zM14 4h4v16h-4z" fill="currentColor"/>', vol: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.500 8.500a5 5 0 010 7"/>', mute: '<path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6"/>',
    loop: '<path d="M17 3l4 4-4 4M3 11V9a2 2 0 012-2h16M7 21l-4-4 4-4M21 13v2a2 2 0 01-2 2H3"/>', full: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', keys: '<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10"/>',
    grid: '<path d="M3 3h18v18H3zM9 3v18M15 3v18M3 9h18M3 15h18"/>', safe: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 7h14M5 16h14"/>', dots: '<circle cx="5" cy="12" r="1.500" fill="currentColor"/><circle cx="12" cy="12" r="1.500" fill="currentColor"/><circle cx="19" cy="12" r="1.500" fill="currentColor"/>'
  };
  var ic = function (n, s) { return '<svg class="st-ic" viewBox="0 0 24 24" width="' + (s || 15) + '" height="' + (s || 15) + '" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round">' + ICON[n] + '</svg>'; };

  // ---------- módulos ----------
  function on(name) {
    var args = [].slice.call(arguments, 1), out = [];
    (T ? T.plugins : []).forEach(function (p) { if (p[name]) out.push(p[name].apply(p, args)); });
    return out;
  }
  function owner(type) { return T.plugins.filter(function (p) { return (p.owns || []).indexOf(type) >= 0; })[0]; }
  function plugin(id) { return T.plugins.filter(function (p) { return p.id === id; })[0]; }

  // ---------- modelo ----------
  function layout() {
    var t = 0, x = 0, L = [];
    T.segs.forEach(function (s) {
      var d = s.off ? 0 : (s.out - s.in) / sp(s), w = s.off ? OFF_W : d * T.pps;
      L.push({ s: s, t0: t, x0: x, dur: d, w: w });
      t += d; x += w + GAP;
    });
    T.L = L; T.total = t; T.width = x;
    if (T.fx) T.fx.forEach(fxEnd);
  }
  // Una capa sin tocar acaba en su momento del clip, no a los N segundos: si se recorta dentro de ella, se acorta igual que el vídeo.
  function fxEnd(f) {
    var it = f.endSeg && !f.edited && item(f.endSeg), a = it ? fxStart(f) : null;
    if (a == null) return;
    var b = it.t0 + clamp((f.endSrc - it.s.in) / sp(it.s), 0, it.dur);
    if (b >= a - .001) f.dur = Math.max(MIN_FX, b - a);
  }
  function item(id) { return T.L.filter(function (it) { return it.s._id === id; })[0]; }
  function active() { return T.L.filter(function (it) { return !it.s.off; }); }
  function itemAt(t) {
    var a = active();
    for (var i = 0; i < a.length; i++) if (t < a[i].t0 + a[i].dur) return a[i];
    return a[a.length - 1];
  }
  function timeToX(t) {
    var it = itemAt(t);
    return it ? it.x0 + clamp(t - it.t0, 0, it.dur) * T.pps : 0;
  }
  function xToTime(x) {
    for (var i = 0; i < T.L.length; i++) {
      var it = T.L[i];
      if (x < it.x0 + it.w + GAP) return it.t0 + clamp((x - it.x0) / T.pps, 0, it.dur);
    }
    return T.total;
  }
  function anchor(t) {                      // momento del montaje -> {seg, src}
    var it = itemAt(clamp(t, 0, T.total));
    return { seg: it.s._id, src: it.s.in + (t - it.t0) * sp(it.s) };
  }
  function fxStart(f) {
    var it = item(f.seg);
    if (!it || it.s.off) return null;
    return it.t0 + clamp((f.src - it.s.in) / sp(it.s), 0, it.dur);
  }
  function fxRange(f) {
    var a = fxStart(f);
    return a == null ? null : [a, Math.min(a + f.dur, T.total)];
  }
  function nm(f) { return f.kind === 'el' ? f.label : (T.names[f.key] || f.key); }
  function laneOf(f) {                      // qué pista ocupa una capa: la que diga su módulo (su grupo), o "Capas"
    var l = on('laneOf', f).filter(Boolean)[0];
    return l || { id: 'capas', label: 'Capas' };
  }
  function isHidden(k) { return !!T.hidden[k]; }

  // Imán: el segundo t se pega al borde de un fragmento, capa o marca cercanos (o al cursor), si el imán está puesto.
  function snapTime(t, skip) {
    T.guide = null;
    if (!T.snapOn) return t;
    var best = null, lim = SNAP_PX / T.pps, cand = [T.t];
    T.L.forEach(function (it) { if (!it.s.off) cand.push(it.t0, it.t0 + it.dur); });
    T.fx.forEach(function (f, i) { if (skip && skip.indexOf(i) >= 0) return; var r = fxRange(f); if (r && !f.off) cand.push(r[0], r[1]); });
    T.beats.forEach(function (b) { cand.push(b); });
    if (T.inP != null) cand.push(T.inP);
    if (T.outP != null) cand.push(T.outP);
    cand.forEach(function (c) { var d = Math.abs(c - t); if (d <= lim && (best == null || d < Math.abs(best - t))) best = c; });
    if (best == null) return t;
    T.guide = best;
    return best;
  }

  function snapshot() {
    var p = {};
    T.plugins.forEach(function (x) { if (x.snap) p[x.id] = x.snap(); });
    return JSON.stringify({ segs: T.segs, fx: T.fx, hidden: T.hidden, beats: T.beats, groups: T.groups, p: p });
  }
  function restore(h) {
    h = JSON.parse(h); T.segs = h.segs; T.fx = h.fx; T.hidden = h.hidden || {}; T.beats = h.beats || []; T.groups = h.groups || {}; T.sel = null; T.multi = [];
    T.plugins.forEach(function (x) { if (x.restore && h.p && h.p[x.id]) x.restore(h.p[x.id]); });
  }
  function remember() { T.hist.push(snapshot()); T.redo = []; if (T.hist.length > 120) T.hist.shift(); toolsState(); }
  function undo() {
    var h = T.hist.pop();
    if (!h) return;
    T.redo.push(snapshot());
    restore(h);
    changed();
  }
  function redo() {
    var h = T.redo.pop();
    if (!h) return;
    T.hist.push(snapshot());
    restore(h);
    changed();
  }

  // ---------- pintar ----------
  function lanes() {                        // las capas por pista; dentro de una pista, una fila por cada solape
    var map = {}, order = [];
    T.fx.forEach(function (f, i) {
      if (f.kind !== 'el' || f.off) return;
      var r = fxRange(f);
      if (!r) return;
      var l = laneOf(f);
      if (!map[l.id]) { map[l.id] = { id: l.id, label: l.label, rows: [] }; order.push(map[l.id]); }
      var rows = map[l.id].rows, placed = false;
      for (var k = 0; k < rows.length && k < 4; k++) {
        if (rows[k].every(function (b) { return r[1] <= b.r[0] + 1e-3 || r[0] >= b.r[1] - 1e-3; })) { rows[k].push({ i: i, f: f, r: r }); placed = true; break; }
      }
      if (!placed) { if (rows.length < 4) rows.push([{ i: i, f: f, r: r }]); else rows[3].push({ i: i, f: f, r: r }); }
    });
    return order;
  }
  function blockHtml(b, kind, top) {
    var sel = (T.sel && T.sel.type === 'fx' && T.sel.id === b.i) || T.multi.indexOf(b.i) >= 0;
    var x0 = timeToX(b.r[0]), x1 = timeToX(b.r[1]), g = b.f.group ? ' grp' : '';
    return '<div class="tl-fxb ' + kind + (sel ? ' sel' : '') + g + '" data-fx="' + b.i + '" style="left:' + x0 + 'px;width:' + Math.max(18, x1 - x0) + 'px;top:' + top + 'px" title="' + esc(nm(b.f)) + '">' +
      esc(nm(b.f)) + '<div class="tl-h l" data-h="fxL"></div><div class="tl-h r" data-h="fxR"></div></div>';
  }
  function eye(k) { return '<button class="tl-eye' + (T.hidden[k] ? ' off' : '') + '" data-eye="' + esc(k) + '" title="' + (T.hidden[k] ? 'Mostrar pista' : 'Ocultar pista') + '">' + ic(T.hidden[k] ? 'eyeoff' : 'eye', 13) + '</button>'; }
  function render() {
    layout();
    var segs = T.L.map(function (it, i) {
      var s = it.s, sel = T.sel && T.sel.type === 'seg' && T.sel.id === s._id;
      if (s.off) return '<div class="tl-seg off' + (sel ? ' sel' : '') + '" data-seg="' + s._id + '" title="Quitado: ' + esc(s.line) + '" style="left:' + it.x0 + 'px;width:' + it.w + 'px"></div>';
      return '<div class="tl-seg' + (s.overlay ? ' ov' : '') + (sel ? ' sel' : '') + (T.thumbs ? '' : ' nothumb') + '" data-seg="' + s._id + '" style="left:' + it.x0 + 'px;width:' + it.w + 'px">' +
        '<canvas class="th"></canvas><div class="t">' + (i + 1) + '. ' + (s.overlay ? '▣ ' : '') + esc(s.line || s.id) + '</div><canvas class="wv"></canvas>' +
        '<div class="tl-h l" data-h="segL"></div><div class="tl-h r" data-h="segR"></div></div>';
    }).join('');
    var fxBlocks = T.fx.map(function (f, i) {
      var r = fxRange(f);
      return (!r || f.kind !== 'fx' || f.off) ? '' : blockHtml({ i: i, f: f, r: r }, 'fx', 4);
    }).join('');
    var lw = (T.width + 60) + 'px', html = '';
    var lane = function (k, label, cls, body, extra, h) {
      return '<div class="tl-lane' + (T.hidden[k] ? ' hid' : '') + '"><div class="tl-lab ' + (cls || '') + '"' + (extra || '') + (h ? ' style="height:' + h + 'px"' : '') + '><span class="n">' + label + '</span>' + eye(k) + '</div>' +
        '<div class="tl-track ' + (cls || '') + '" style="width:' + lw + (h ? ';height:' + h + 'px' : '') + '">' + body + '</div></div>';
    };
    html += lane('video', 'Vídeo y voz' + on('labelExtra', 'voice').join(''), 'tl-v' + (T.sel && T.sel.type === 'aud' && T.sel.id === 'voice' ? ' sel' : ''), segs, ' data-pick="aud" data-id="voice"');
    lanes().forEach(function (l) {
      var rows = l.rows.length, h = Math.max(38, rows * 34 + 4), body = '';
      l.rows.forEach(function (row, ri) { row.forEach(function (b) { body += blockHtml(b, 'el', 4 + ri * 34); }); });
      html += lane('el:' + l.id, esc(l.label), 'tl-fx tl-el', body, ' data-lane="' + esc(l.id) + '"', h);
    });
    html += lane('fx', 'Efectos', 'tl-fx tl-fxt', fxBlocks);
    html += on('lanes').join('');                    // pistas con la misma forma que estas (módulos nuevos)
    var ex = document.createElement('div');          // pistas con el formato antiguo: .tl-lab + .tl-track seguidos
    ex.innerHTML = on('tracks').join('');
    while (ex.firstElementChild) {
      var a = ex.firstElementChild, b = a.nextElementSibling;
      if (!b) break;
      var row = document.createElement('div'); row.className = 'tl-lane';
      b.style.width = lw;
      row.appendChild(a); row.appendChild(b);
      html += row.outerHTML;
    }
    var step = T.pps >= 90 ? 1 : T.pps >= 40 ? 2 : T.pps >= 18 ? 5 : 10, ticks = '';
    for (var s = 0; s <= T.total; s += step) ticks += '<i style="left:' + timeToX(s) + 'px">' + fmtS(s) + '</i>';
    T.beats.forEach(function (b, i) { ticks += '<b class="tl-beat" data-beat="' + i + '" style="left:' + timeToX(b) + 'px" title="Marca · Alt+clic la quita"></b>'; });
    if (T.inP != null || T.outP != null) {
      var a0 = timeToX(T.inP || 0), a1 = timeToX(T.outP == null ? T.total : T.outP);
      ticks += '<u class="tl-wa" style="left:' + a0 + 'px;width:' + Math.max(2, a1 - a0) + 'px"></u>';
    }
    T.el.inner.style.width = (T.width + LW + 60) + 'px';
    T.el.ruler.style.width = lw;
    T.el.ruler.innerHTML = ticks;
    T.el.rows.innerHTML = html;
    T.el.inner.querySelectorAll('.tl-seg:not(.off)').forEach(drawSeg);
    on('drawTracks', T.el.inner);
    T.el.guide.style.display = T.guide == null ? 'none' : 'block';
    if (T.guide != null) T.el.guide.style.left = (LW + timeToX(T.guide)) + 'px';
    T.el.rf.style.visibility = T.hidden.video ? 'hidden' : '';
    head();
    panelRight();
    tray();
    toolsState();
  }

  function drawSeg(div) {
    var s = T.segs.filter(function (x) { return x._id === div.dataset.seg; })[0];
    if (!s) return;
    var w = div.clientWidth, dpr = window.devicePixelRatio || 1;
    var pk = T.peaks[s.clip], cv = div.querySelector('canvas.wv');
    if (pk && cv) {
      var h = 22;
      cv.width = Math.max(1, Math.round(w * dpr)); cv.height = h * dpr;
      var g = cv.getContext('2d');
      g.scale(dpr, dpr);
      g.fillStyle = s.overlay ? '#f2c810' : '#3ce6ac';
      for (var x = 0; x < w; x++) {
        var a = Math.floor((s.in + x / T.pps * sp(s)) * 100), b = Math.max(a + 1, Math.floor((s.in + (x + 1) / T.pps * sp(s)) * 100)), m = 0;
        for (var k = a; k < b && k < pk.length; k++) if (pk[k] > m) m = pk[k];
        var bh = Math.max(1, (m / 255) * (h - 2));
        g.fillRect(x, (h - bh) / 2, 1, bh);
      }
    }
    var st = T.strips[s.clip], tc = div.querySelector('canvas.th');
    if (st && st.img && tc && T.thumbs) {
      var hh = div.clientHeight;
      tc.width = Math.max(1, Math.round(w * dpr)); tc.height = hh * dpr;
      var c = tc.getContext('2d'), tw = hh * st.tw / st.th, n = Math.ceil(w / tw);
      c.scale(dpr, dpr);
      for (var i = 0; i < n; i++) {
        var srcT = s.in + (i + .5) * tw / T.pps * sp(s), idx = clamp(Math.floor(srcT / st.step), 0, st.n - 1);
        c.drawImage(st.img, (idx % st.cols) * st.tw, Math.floor(idx / st.cols) * st.th, st.tw, st.th, i * tw, 0, tw, hh);
      }
    }
  }

  function head() {
    T.el.head.style.left = (LW + timeToX(T.t)) + 'px';
    var fr = Math.round(T.t * FPS);
    T.el.time.innerHTML = '<b>' + fmtS(T.t) + '</b> / ' + fmtS(T.total);
    if (document.activeElement !== T.el.frame) T.el.frame.value = fr;
    var on_ = T.fx.filter(function (f) { var r = fxRange(f); return f.kind === 'fx' && r && !f.off && T.t >= r[0] && T.t < r[1]; });
    T.el.fxlabel.innerHTML = on_.map(function (f) { return '<span>' + esc(nm(f)) + '</span>'; }).join('');
    var cur = itemAt(T.t);                            // el clip que se ve: lo que se le hace a un solo clip va a su imagen (.tl-img)
    T.el.img.dataset.seg = cur && !cur.s.off ? cur.s.id : '';
    on('paint', T.t);
  }

  function nudges(kind, label, value) {
    return '<div class="tl-row"><label>' + label + '</label>' +
      '<button data-n="' + kind + '" data-d="-0.1">−0,1 s</button><button data-n="' + kind + '" data-d="-f">−1 fot.</button>' +
      '<span class="v">' + value + '</span>' +
      '<button data-n="' + kind + '" data-d="f">+1 fot.</button><button data-n="' + kind + '" data-d="0.1">+0,1 s</button></div>';
  }
  function slider(k, label, v, a, b, st, shown) {
    return '<div class="tl-row"><label>' + label + '</label><input type="range" class="st-sl" data-seg-k="' + k + '" min="' + a + '" max="' + b + '" step="' + st + '" value="' + v + '"><span class="v" data-seg-v="' + k + '">' + shown + '</span></div>';
  }
  // una sección plegable del inspector: el estado se guarda por id, así no se cierra al repintar
  function section(id, title, body, open) {
    var o = T.secs[id] == null ? open !== false : T.secs[id];
    return '<details class="st-sec" data-sec="' + esc(id) + '"' + (o ? ' open' : '') + '><summary>' + title + '</summary><div class="st-sec-b">' + body + '</div></details>';
  }

  function design() {
    var html = '', p = T.sel && owner(T.sel.type);
    if (p) {
      html = p.inspector(T.sel);
    } else if (T.sel && T.sel.type === 'seg') {
      var it = item(T.sel.id), s = it.s, n = T.L.indexOf(it) + 1;
      html = '<h3>' + (s.overlay ? 'Vídeo superpuesto · ' : '') + 'Clip ' + n + ' de ' + T.L.length + (s.off ? ' · quitado' : '') + '</h3><div class="q">“' + esc(s.line || '') + '”</div>' +
        (s.overlay ? '<div class="help">Inicio y Final son el trozo del vídeo superpuesto que se ve (y se oye). Mientras dura, debajo sigue tu plano, sin sonido.</div>' : '') +
        (s.off ? '' : section('seg-tiempo', 'Tiempo',
          nudges('in', 'Inicio', s.in.toFixed(2) + ' s') + nudges('out', 'Final', s.out.toFixed(2) + ' s') +
          '<div class="tl-row"><label>Duración</label><span class="v">' + ((s.out - s.in) / sp(s)).toFixed(2) + ' s</span>' + (sp(s) !== 1 ? '<span class="v">a ' + sp(s) + 'x</span>' : '') + '</div>' +
          (s.overlay ? '' : slider('speed', 'Velocidad', s.speed || 1, 0.5, 2, 0.05, (s.speed || 1) + 'x'))) +
          section('seg-encuadre', 'Encuadre del clip',
            slider('zoom', 'Zoom', s.zoom || 1, 1, 2.5, 0.01, Math.round((s.zoom || 1) * 100) + ' %') +
            slider('cx', 'Horizontal', s.cx == null ? .5 : s.cx, 0, 1, 0.005, Math.round((s.cx == null ? .5 : s.cx) * 100) + ' %') +
            slider('cy', 'Vertical', s.cy == null ? .5 : s.cy, 0, 1, 0.005, Math.round((s.cy == null ? .5 : s.cy) * 100) + ' %'))) +
        '<div class="tl-acts">' + (s.off ? '' : '<button data-a="playseg">▶ Escuchar</button>' + (s.overlay ? '' : '<button data-a="split">✂ Partir en el cursor</button><button data-a="cutL">Quitar lo anterior al cursor</button><button data-a="cutR">Quitar lo posterior al cursor</button><button data-a="dup">Duplicar</button>')) +
        '<button data-a="toggle" class="' + (s.off ? '' : 'warn') + '">' + (s.off ? 'Recuperar clip' : 'Quitar clip') + '</button>' +
        ((s.in !== s._in0 || s.out !== s._out0) ? '<button data-a="restore">Volver al corte original</button>' : '') + '</div>';
    } else if (T.sel && T.sel.type === 'fx') {
      var f = T.fx[T.sel.id], r = fxRange(f) || [0, 0];
      html = '<h3>' + (f.sonido ? 'Sonido: ' : f.kind === 'el' ? 'Capa: ' : 'Efecto: ') + esc(nm(f)) + '</h3><div class="q">Del ' + fmt(r[0]) + ' al ' + fmt(r[1]) + (f.edited ? ' · ajustada a mano' : '') + (T.multi.length > 1 ? ' · ' + T.multi.length + ' elegidas' : '') + '</div>' +
        section('fx-tiempo', 'Tiempo', nudges('fxs', 'Empieza', fmt(r[0])) + nudges('fxd', 'Dura', (r[1] - r[0]).toFixed(2) + ' s')) +
        '<div class="tl-acts"><button data-a="playfx">▶ Ver ese momento</button><button data-a="toHead">Mover al cursor</button><button data-a="unplace" class="warn">Quitar</button>' +
        (T.multi.length > 1 ? '<button data-a="group">Agrupar (Ctrl+G)</button>' : '') + (f.group ? '<button data-a="ungroup">Desagrupar (Ctrl+Mayús+G)</button>' : '') + '</div>' +
        on('inspectorExtra', T.sel, f).join('');
    } else {
      html = '<div class="st-empty"><div class="st-empty-i">' + ic('sel', 22) + '</div><b>Nada elegido</b><br>Toca una capa en la vista previa o un elemento de la línea de tiempo para editarlo.</div>' +
        '<details class="st-sec"><summary>Cómo se usa</summary><div class="st-sec-b help">' +
        '<b>Recortar:</b> arrastra el borde de un clip. <b>Mover:</b> arrastra su cuerpo para cambiar el orden.<br>' +
        '<b>Cortar por el centro:</b> pulsa S en cada extremo, toca el trozo del medio y Supr; o usa las tijeras (B).<br>' +
        '<b>Vídeos superpuestos</b> (en amarillo, ▣): sus bordes eligen qué trozo se ve; tu plano sigue debajo.<br>' +
        '<b>Capas en el tiempo:</b> arrástralas para moverlas, estira sus bordes para cambiar cuánto duran, Supr las quita. Mayús+clic elige varias.<br>' +
        on('helpExtra').join('') + '<b>Teclas:</b> el botón ' + ic('keys', 12) + ' enseña todas.</div></details>' + on('inspectorIdle').join('');
    }
    html += on('designExtra', T.sel).join('');
    return html;
  }

  function panelRight() {
    var tab = T.rtab, btns = [['design', 'Ajustes']].concat(T.plugins.filter(function (p) { return p.right; }).map(function (p) { var c = p.right.count ? p.right.count() : ''; return [p.right.id, p.right.label + (c !== '' && c != null ? ' (' + c + ')' : '')]; }));
    T.el.rtabs.innerHTML = btns.map(function (b) { return '<button class="' + (b[0] === tab ? 'act' : '') + '" data-rtab="' + b[0] + '">' + esc(b[1]) + '</button>'; }).join('');
    if (tab === 'design') {
      var ae = document.activeElement, keep = ae && T.el.insp.contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName) && ae.type !== 'range' && ae.dataset && ae.dataset.keep;
      if (!keep) T.el.insp.innerHTML = design();
    } else {
      var m = T.plugins.filter(function (p) { return p.right && p.right.id === tab; })[0];
      if (m && !T.drag) m.rightRender(T.el.insp);
    }
  }
  function panelLeft() {
    var all = HOST_LEFT.concat(T.plugins.filter(function (p) { return p.left; }).map(function (p) { return { id: p.left.id, label: p.left.label, order: p.left.order, tip: p.left.tip, render: function (el) { p.leftRender(el); } }; }));
    all.sort(function (a, b) { return (a.order || 50) - (b.order || 50); });
    if (!all.some(function (x) { return x.id === T.ltab; })) T.ltab = all[0] && all[0].id;
    T.el.ltabs.innerHTML = all.map(function (x) { return '<button class="' + (x.id === T.ltab ? 'act' : '') + '" data-ltab="' + x.id + '" title="' + esc(x.tip || '') + '">' + esc(x.label) + '</button>'; }).join('');
    var cur = all.filter(function (x) { return x.id === T.ltab; })[0];
    if (cur) cur.render(T.el.lbody);
  }

  function tray() {
    var fxs = T.fx.filter(function (f) { return f.kind === 'fx'; });
    var placed = fxs.map(function (f) { return f.key; });
    var lost = fxs.filter(function (f) { return !fxRange(f); }).map(function (f) { return f.key; });
    var free = T.keys.filter(function (k) { return placed.indexOf(k) < 0 || lost.indexOf(k) >= 0; });
    var off = T.fx.map(function (f, i) { return f.kind === 'el' && f.off ? i : -1; }).filter(function (i) { return i >= 0; });
    T.el.tray.innerHTML = (free.length
      ? '<span>Sin colocar (si los dejas, Claude elige dónde):</span>' + free.map(function (k) {
          return '<button data-place="' + esc(k) + '">+ ' + esc(T.names[k] || k) + '</button>';
        }).join('')
      : '') + (off.length
      ? '<span>Capas quitadas:</span>' + off.map(function (i) {
          return '<button data-back="' + i + '">+ ' + esc(nm(T.fx[i])) + '</button>';
        }).join('')
      : '');
    T.el.tray.hidden = !free.length && !off.length;
  }
  function toolsState() {
    if (!T.el || !T.el.tools) return;
    var set = function (k, v) { var b = T.el.root.querySelector('[data-t="' + k + '"]'); if (b) b.classList.toggle('on', !!v); };
    set('tool-sel', T.tool === 'sel'); set('tool-razor', T.tool === 'razor'); set('snap', T.snapOn); set('thumbs', T.thumbs);
    set('loop', T.loop); set('grid', T.gridOn); set('stagesnap', T.gridSnap); set('mute', T.muted); set('fit', T.fitted);
    var pb = T.el.play; if (pb) pb.innerHTML = ic(T.playing ? 'pause' : 'play', 18);
    var mb = T.el.root.querySelector('[data-t=mute]'); if (mb) mb.innerHTML = ic(T.muted ? 'mute' : 'vol');
    var sb = T.el.root.querySelector('[data-t=rate]'); if (sb) sb.textContent = T.rate + 'x';
    T.el.root.classList.toggle('razor', T.tool === 'razor');
    if (window.Timeline && Timeline.onHistory) Timeline.onHistory(T.hist.length > 0, T.redo.length > 0);
  }

  function changed() { stop(); render(); notify(); }
  function notify() { if (Timeline.onChange) Timeline.onChange(); on('onChanged'); }
  // Lo que no se puede exportar sin Claude porque hay que volver a montar: cortes, tiempos, textos, pistas de audio, peticiones.
  var canon = function (o) { return JSON.stringify(o, function (k, v) { return typeof v === 'number' ? Math.round(v * 100) / 100 : v; }); };
  function fingerprint() { var d = Timeline.data(); return { edl: canon(d.edl), fx: canon(d.effects) }; }
  var NECESITA = { audio: 'volumen de las pistas', subtitulos: 'subtítulos', variables: 'datos', claude: 'peticiones a Claude', guion: 'comentarios del guion' };
  function pistasDirty() { T.dirty.pistas = true; notify(); }

  // la vista previa es un lienzo de 1080x1920 escalado al tamaño de la pantalla
  function fit() {
    if (!T) return;
    var box = T.el.stagewrap, side = box.querySelector('.rf-side:not([hidden])'), bw = box.clientWidth - 24, bh = box.clientHeight - 16;
    if (side) bw = (bw - 12) / 2;           // la referencia al lado se lleva la mitad
    if (bw <= 0 || bh <= 0) return;
    var h = Math.min(bh, bw * 16 / 9), w = h * 9 / 16;
    T.el.screen.style.width = w + 'px'; T.el.screen.style.height = h + 'px';
    if (side) { side.style.width = w + 'px'; side.style.height = h + 'px'; }
    T.S = w / W;
    T.el.screen.style.setProperty('--s', T.S);
    T.el.stage.style.transform = 'scale(' + T.S + ')';
    if (T.gridOn) grid();
  }
  function grid() {
    T.el.grid.hidden = !T.gridOn;
    var g = T.gridSize;
    T.el.grid.style.backgroundImage = 'linear-gradient(rgba(60,230,172,.28) 2px,transparent 2px),linear-gradient(90deg,rgba(60,230,172,.28) 2px,transparent 2px)';
    T.el.grid.style.backgroundSize = g + 'px ' + g + 'px';
  }

  // ---------- audio de la vista previa: un solo grafo, porque un <video> solo se puede conectar una vez ----------
  function audioGraph() {
    if (T.audio) return T.audio;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    var ctx = new AC(), master = ctx.createGain(), voice = ctx.createGain(), voiceOut = ctx.createGain();
    voice.connect(voiceOut); voiceOut.connect(master); master.connect(ctx.destination);
    T.deck.forEach(function (v) { try { ctx.createMediaElementSource(v).connect(voice); } catch (e) {} });
    T.audio = { ctx: ctx, master: master, voice: voice, voiceOut: voiceOut, stems: {} };
    master.gain.value = T.muted ? 0 : T.vol;
    return T.audio;
  }

  // ---------- reproducción ----------
  // Dos vídeos que se turnan: mientras uno suena, el otro espera parado al principio del siguiente fragmento,
  // así cada corte es un cambio de vídeo y no un salto que tiene que cargar y decodificar en ese momento.
  function vid() { return T.deck[T.vi]; }
  function cue(v, s, at) {
    if (v.dataset.clip !== s.clip) { v.dataset.clip = s.clip; v.src = T.urls[s.clip]; }
    if (Math.abs(v.currentTime - at) > .01) v.currentTime = at;
    v.playbackRate = sp(s) * T.rate; v.preservesPitch = true;
  }
  function show(v, s) {
    T.deck.forEach(function (x) { x.classList.toggle('on', x === v); });
    v.style.transformOrigin = ((s.cx == null ? .5 : s.cx) * 100) + '% ' + ((s.cy == null ? .5 : s.cy) * 100) + '%';
    v.style.transform = 'scale(' + (s.zoom || 1) + ')';
  }
  function prime() {
    var a = active(), next = a[a.indexOf(T.cur) + 1];
    if (next) cue(T.deck[1 - T.vi], next.s, next.s.in);
  }
  function seek(t) {
    T.t = clamp(t, 0, T.total);
    var it = itemAt(T.t);
    if (!it) return;
    T.cur = it;
    cue(vid(), it.s, it.s.in + (T.t - it.t0) * sp(it.s));
    show(vid(), it.s);
    prime();
    head();
  }
  function play() {
    if (T.playing) return stop();
    var start = T.inP != null && (T.t < T.inP || T.t >= (T.outP == null ? T.total : T.outP)) ? T.inP : T.t;
    if (start >= T.total - .05) seek(0); else seek(start);
    T.playing = true; T.dir = 1;
    if (T.audio) T.audio.ctx.resume();
    vid().play().catch(function () {});
    on('onPlay', T.t);
    toolsState();
    requestAnimationFrame(tick);
  }
  function stop() {
    var was = T && (T.playing || T.dir < 0);
    if (T) { T.playing = false; T.dir = 1; T.rev = 0; }
    if (T && T.deck) T.deck.forEach(function (v) { v.pause(); });
    if (was) on('onStop');
    if (T) toolsState();
  }
  function reverse(k) {                     // J: hacia atrás (sin sonido), cada pulsación más rápido
    if (T.playing) stop();
    T.rev = T.dir < 0 ? Math.min(T.rev * 2, 8) : (k || 1);
    if (T.dir < 0) return;
    T.dir = -1;
    var last = performance.now();
    (function st(now) {
      if (T.dir >= 0) return;
      var dt = (now - last) / 1000; last = now;
      seek(T.t - dt * T.rev);
      if (T.t <= (T.inP || 0)) { T.dir = 1; T.rev = 0; return; }
      requestAnimationFrame(st);
    })(last);
  }
  function tick() {
    if (!T.playing) return;
    var it = T.cur, v = vid(), ct = v.currentTime, end = T.endAt != null ? T.endAt : T.outP;
    if (end != null && T.t >= end) {
      T.endAt = null;
      if (T.loop) { seek(T.inP || 0); vid().play().catch(function () {}); on('onPlay', T.t); requestAnimationFrame(tick); return; }
      stop(); return;
    }
    if (T.reloj) {                          // Ver resultado: lleva el tiempo su vídeo, y esta pareja descansa
      var rt = T.reloj();
      if (!v.paused) v.pause();
      if (rt == null) {
        if (T.loop) { seek(T.inP || 0); vid().play().catch(function () {}); on('onPlay', T.t); requestAnimationFrame(tick); return; }
        T.endAt = null; stop(); return;
      }
      T.t = rt; T.cur = itemAt(rt);
    } else if (ct >= it.s.out - .01 || v.ended) {
      var a = active(), next = a[a.indexOf(it) + 1];
      if (!next) {
        if (T.loop) { seek(T.inP || 0); vid().play().catch(function () {}); on('onPlay', T.t); requestAnimationFrame(tick); return; }
        T.endAt = null; stop(); return;
      }
      v.pause();
      T.vi = 1 - T.vi; T.cur = next;
      var nv = vid();
      cue(nv, next.s, next.s.in);
      show(nv, next.s);
      nv.play().catch(function () {});
      T.t = next.t0;
      prime();
    } else if (ct >= it.s.in) {
      T.t = it.t0 + (ct - it.s.in) / sp(it.s);
    }
    head();
    on('onTick', T.t);
    requestAnimationFrame(tick);
  }

  // ---------- edición ----------
  function nudge(kind, d) {
    var step = d === 'f' ? 1 / FPS : d === '-f' ? -1 / FPS : parseFloat(d);
    remember();
    if (kind === 'in' || kind === 'out') {
      var s = item(T.sel.id).s, dur = T.clipDur[s.clip] || 1e9;
      if (kind === 'in') s.in = clamp(snapF(s.in + step), 0, s.out - MIN_SEG);
      else s.out = clamp(snapF(s.out + step), s.in + MIN_SEG, dur);
    } else {
      var f = T.fx[T.sel.id], r = fxRange(f);
      f.edited = true;
      if (kind === 'fxs') { var a = anchor(clamp(r[0] + step, 0, T.total - MIN_FX)); f.seg = a.seg; f.src = a.src; }
      else f.dur = clamp(f.dur + step, MIN_FX, T.total - r[0]);
    }
    changed();
  }
  function moveFx(i, start) { var a = anchor(clamp(start, 0, T.total)); T.fx[i].seg = a.seg; T.fx[i].src = a.src; T.fx[i].edited = true; }
  function members(i) {                     // las capas que se mueven con esta: su grupo y las elegidas a la vez
    var f = T.fx[i], out = [i];
    T.multi.forEach(function (j) { if (out.indexOf(j) < 0) out.push(j); });
    if (f.group) T.fx.forEach(function (x, j) { if (x.group === f.group && out.indexOf(j) < 0) out.push(j); });
    return out;
  }

  function onAction(a) {
    if (a === 'toggle') {
      remember(); var s = item(T.sel.id).s; s.off = !s.off; changed();
    } else if (a === 'restore') {
      remember(); s = item(T.sel.id).s; s.in = s._in0; s.out = s._out0; changed();
    } else if (a === 'playseg') {
      var it = item(T.sel.id); seek(it.t0); T.endAt = it.t0 + it.dur; play();
    } else if (a === 'playfx') {
      var r = fxRange(T.fx[T.sel.id]); seek(Math.max(0, r[0] - .5)); T.endAt = r[1] + .5; play();
    } else if (a === 'split') {
      split();
    } else if (a === 'cutL' || a === 'cutR') {
      it = item(T.sel.id); s = it.s;
      var src = snapF(s.in + (T.t - it.t0) * sp(s));
      if (T.t < it.t0 || T.t > it.t0 + it.dur || src - s.in < MIN_SEG || s.out - src < MIN_SEG) return;
      remember();
      if (a === 'cutL') s.in = src; else s.out = src;
      changed(); seek(T.t);
    } else if (a === 'dup') {
      dupSeg();
    } else if (a === 'toHead') {
      remember(); moveFx(T.sel.id, T.t); changed();
    } else if (a === 'group' || a === 'ungroup') {
      group(a === 'group');
    } else if (a === 'unplace') {
      remember();
      members(T.sel.id).sort(function (x, y) { return y - x; }).forEach(function (i) {
        if (T.fx[i].kind === 'el') T.fx[i].off = true;      // una capa quitada se puede recuperar
        else T.fx.splice(i, 1);
      });
      T.sel = null; T.multi = []; changed();
    }
  }
  function group(yes) {
    var list = T.sel && T.sel.type === 'fx' ? members(T.sel.id) : [];
    if (!list.length) return;
    remember();
    var id = yes ? 'g' + Date.now().toString(36) : null;
    list.forEach(function (i) { T.fx[i].group = id; });
    pistasDirty(); changed();
  }
  function newSegId(base) {
    var ids = T.segs.map(function (x) { return x.id; }), nid = base + 'b';
    while (ids.indexOf(nid) >= 0) nid += 'b';
    return nid;
  }
  function dupSeg(after) {
    var s = T.sel && T.sel.type === 'seg' ? item(T.sel.id).s : T.clipboard;
    if (!s) return;
    remember();
    var b = JSON.parse(JSON.stringify(s));
    b._id = 's' + (T.n++); b.id = newSegId(s.id); b._in0 = s.in; b._out0 = s.out; b.off = false;
    var at = after != null ? after : T.segs.indexOf(T.sel && T.sel.type === 'seg' ? item(T.sel.id).s : s) + 1;
    T.segs.splice(at, 0, b);
    T.sel = { type: 'seg', id: b._id };
    changed();
  }

  // Parte en dos el fragmento que está bajo el cursor. La segunda mitad es un fragmento nuevo del mismo clip, así
  // que se puede recortar o quitar por su cuenta; los efectos que caían después del corte se van con ella.
  function split() {
    var it = itemAt(T.t);
    if (!it || it.s.off) return;
    var s = it.s, src = snapF(s.in + (T.t - it.t0) * sp(s));
    if (s.overlay || src - s.in < MIN_SEG || s.out - src < MIN_SEG) return;     // un vídeo superpuesto se recorta, no se parte
    remember();
    var b = JSON.parse(JSON.stringify(s));
    b._id = 's' + (T.n++); b.id = newSegId(s.id); b.in = b._in0 = src; b._out0 = s.out;
    s.out = s._out0 = src;
    T.segs.splice(T.segs.indexOf(s) + 1, 0, b);
    T.fx.forEach(function (f) { if (f.seg === s._id && f.src >= src) f.seg = b._id; if (f.endSeg === s._id && f.endSrc > src) f.endSeg = b._id; });
    T.sel = { type: 'seg', id: b._id };
    changed();
    seek(T.t);
  }

  function place(key) {
    remember();
    T.fx = T.fx.filter(function (f) { return f.kind !== 'fx' || f.key !== key; });
    var at = Math.min(T.t, Math.max(0, T.total - 2)), a = anchor(at);
    T.fx.push({ kind: 'fx', key: key, seg: a.seg, src: a.src, dur: Math.min(2, T.total - at) });
    T.sel = { type: 'fx', id: T.fx.length - 1 };
    changed();
  }
  function addBeat(t) { remember(); T.beats.push(Math.round(t * 1000) / 1000); T.beats.sort(function (a, b) { return a - b; }); pistasDirty(); render(); }
  function setPoint(k, v) { T[k] = v; if (T.inP != null && T.outP != null && T.outP <= T.inP) T[k === 'inP' ? 'outP' : 'inP'] = null; render(); }

  // Marcas sobre la voz o música: picos claros de la onda del fragmento.
  function setRate(r) { T.rate = r; var it = T.cur; if (it) vid().playbackRate = sp(it.s) * r; toolsState(); }
  function setMute(m) { T.muted = m; if (T.audio) T.audio.master.gain.value = m ? 0 : T.vol; T.deck.forEach(function (v) { v.muted = m && !T.audio; }); toolsState(); }
  function setVol(v) { T.vol = v; if (T.audio) T.audio.master.gain.value = T.muted ? 0 : v; else T.deck.forEach(function (x) { x.volume = Math.min(1, v); }); }
  function fitZoom() { T.pps = clamp((T.el.scroll.clientWidth - LW - 40) / Math.max(1, T.total), 4, 240); T.el.zoom.value = T.pps; T.fitted = true; render(); T.el.scroll.scrollLeft = 0; }
  function zoomBy(k) { T.fitted = false; T.pps = clamp(T.pps * k, 4, 240); T.el.zoom.value = T.pps; render(); }

  function shortcuts() {
    var S = [
      ['Reproducción', [['Espacio', 'Reproducir / parar'], ['J', 'Hacia atrás'], ['K', 'Parar'], ['L', 'Hacia delante (más rápido)'], ['M', 'Silenciar'], ['Mayús+L', 'Bucle'], ['← / →', 'Un fotograma'], ['Mayús+← / →', 'Diez fotogramas'], ['F', 'Pantalla completa']]],
      ['Edición', [['Ctrl+Z', 'Deshacer'], ['Ctrl+Mayús+Z', 'Rehacer'], ['Ctrl+C / V / X', 'Copiar, pegar y cortar'], ['S', 'Partir en el cursor'], ['V', 'Seleccionar'], ['B', 'Tijeras'], ['Mayús+clic con tijeras', 'Partir todas las pistas'], ['Mayús+clic', 'Elegir varias'], ['Ctrl+G', 'Agrupar'], ['Ctrl+Mayús+G', 'Desagrupar'], ['Supr', 'Quitar']]],
      ['Zona de trabajo', [['I', 'Poner entrada'], ['Mayús+I', 'Quitar entrada'], ['O', 'Poner salida'], ['Mayús+O', 'Quitar salida'], ['A', 'Ir a la entrada'], ['E', 'Ir a la salida']]]
    ].concat(on('shortcuts').reduce(function (a, b) { return a.concat(b); }, []));
    return S.map(function (s) { return '<div class="st-keys-s"><h4>' + esc(s[0]) + '</h4>' + s[1].map(function (r) { return '<div><kbd>' + esc(r[0]) + '</kbd><span>' + esc(r[1]) + '</span></div>'; }).join('') + '</div>'; }).join('');
  }
  function popup(html, anchor, cls) {
    closePopup();
    var d = document.createElement('div');
    d.className = 'st-pop ' + (cls || ''); d.innerHTML = html;
    T.el.root.appendChild(d);
    var r = anchor.getBoundingClientRect(), pw = d.offsetWidth, ph = d.offsetHeight;
    d.style.left = clamp(r.left + r.width / 2 - pw / 2, 8, innerWidth - pw - 8) + 'px';
    d.style.top = (r.top - ph - 8 > 8 ? r.top - ph - 8 : r.bottom + 8) + 'px';
    T.pop = d;
    return d;
  }
  function closePopup() { if (T.pop) { T.pop.remove(); T.pop = null; } }

  function clickTool(k, b) {
    if (k === 'play') { T.endAt = null; play(); }
    else if (k === 'undo') undo();
    else if (k === 'redo') redo();
    else if (k === 'split') { stop(); split(); }
    else if (k === 'tool-sel') { T.tool = 'sel'; toolsState(); }
    else if (k === 'tool-razor') { T.tool = 'razor'; toolsState(); }
    else if (k === 'snap') { T.snapOn = !T.snapOn; toolsState(); }
    else if (k === 'thumbs') { T.thumbs = !T.thumbs; render(); }
    else if (k === 'beat') addBeat(T.t);
    else if (k === 'fit') fitZoom();
    else if (k === 'zin') zoomBy(1.35);
    else if (k === 'zout') zoomBy(1 / 1.35);
    else if (k === 'loop') { T.loop = !T.loop; toolsState(); }
    else if (k === 'mute') setMute(!T.muted);
    else if (k === 'full') { if (document.fullscreenElement) document.exitFullscreen(); else T.el.stagewrap.requestFullscreen().catch(function () {}); }
    else if (k === 'grid') { T.gridOn = !T.gridOn; grid(); toolsState(); }
    else if (k === 'stagesnap') { T.gridSnap = !T.gridSnap; toolsState(); }
    else if (k === 'gridopts') {
      popup('<h4>Cuadrícula</h4><div class="st-pop-row">' + [20, 40, 60, 90, 120, 180].map(function (g) { return '<button data-gridsize="' + g + '" class="' + (g === T.gridSize ? 'on' : '') + '">' + g + ' px</button>'; }).join('') + '</div>', b);
    } else if (k === 'rate') {
      popup('<h4>Velocidad de la vista previa</h4><div class="st-pop-row">' + SPEEDS.map(function (s) { return '<button data-rate="' + s + '" class="' + (s === T.rate ? 'on' : '') + '">' + s + 'x</button>'; }).join('') + '</div>', b);
    } else if (k === 'keys') {
      popup('<div class="st-keys">' + shortcuts() + '</div>', b, 'wide');
    } else if (k === 'reset') {
      if (!confirm('¿Volver a como estaba todo al abrir (cortes, capas, encuadre, color y volúmenes)?')) return;
      // lo que aplica aplicar.py sigue marcado: Ver resultado o exportar ya pudieron guardarlo, y hay que escribirlo otra vez como estaba
      remember(); restore(T.initial); T.plugins.forEach(function (x) { if (NECESITA[x.id]) T.dirty[x.id] = false; }); changed();
    }
  }

  function bind() {
    var root = T.el.root;
    root.addEventListener('click', function (e) {
      if (T.pop && !T.pop.contains(e.target) && !e.target.closest('[data-t=rate],[data-t=keys],[data-t=gridopts]')) closePopup();
      var ey = e.target.closest('[data-eye]');
      if (ey) { e.stopPropagation(); remember(); var k = ey.dataset.eye; T.hidden[k] = !T.hidden[k]; pistasDirty(); render(); on('onHidden', k, T.hidden[k]); return; }
      var rt = e.target.closest('[data-rtab]'), lt = e.target.closest('[data-ltab]');
      if (rt) { T.rtab = rt.dataset.rtab; panelRight(); return; }
      if (lt) { T.ltab = lt.dataset.ltab; panelLeft(); return; }
      var sum = e.target.closest('.st-sec > summary');
      if (sum) { var det = sum.parentNode; if (det.dataset.sec) T.secs[det.dataset.sec] = !det.open; return; }
      var b = e.target.closest('button,[data-pick]');
      if (!b) return;
      if (b.dataset.rate) { setRate(+b.dataset.rate); closePopup(); }
      else if (b.dataset.gridsize) { T.gridSize = +b.dataset.gridsize; grid(); closePopup(); }
      else if (b.dataset.p) { var p = plugin(b.dataset.p); if (p && p.onClick) p.onClick(b, e); }
      else if (b.dataset.pick) { T.sel = { type: b.dataset.pick, id: b.dataset.id }; T.rtab = 'design'; stop(); render(); }
      else if (b.dataset.n) nudge(b.dataset.n, b.dataset.d);
      else if (b.dataset.a) onAction(b.dataset.a);
      else if (b.dataset.place) place(b.dataset.place);
      else if (b.dataset.back) { remember(); T.fx[+b.dataset.back].off = false; T.sel = { type: 'fx', id: +b.dataset.back }; changed(); }
      else if (b.dataset.t) clickTool(b.dataset.t, b);
    });
    root.addEventListener('input', function (e) {
      var el = e.target;
      if (el.dataset.segK && T.sel && T.sel.type === 'seg') {
        var s = item(T.sel.id).s, k = el.dataset.segK, v = +el.value;
        if (Date.now() - T.lastMem > 700) remember();
        T.lastMem = Date.now();
        if (k === 'speed' && Math.abs(v - 1) < .001) delete s.speed; else s[k] = v;
        var lab = root.querySelector('[data-seg-v="' + k + '"]');
        if (lab) lab.textContent = k === 'speed' ? v + 'x' : Math.round(v * 100) + ' %';
        if (k === 'speed') { layout(); T.el.inner.querySelectorAll('.tl-seg').length; render(); } else seek(T.t);
        notify();
        return;
      }
      var p = el.dataset.p && plugin(el.dataset.p);
      if (p && p.onInput) p.onInput(el, e);
    });
    root.addEventListener('change', function (e) {
      var p = e.target.dataset.p && plugin(e.target.dataset.p);
      if (p && p.onChange) p.onChange(e.target, e);
    });
    T.el.zoom.addEventListener('input', function () {
      var mid = xToTime(T.el.scroll.scrollLeft + T.el.scroll.clientWidth / 2 - LW);
      T.fitted = false; T.pps = +T.el.zoom.value; render();
      T.el.scroll.scrollLeft = timeToX(mid) - T.el.scroll.clientWidth / 2 + LW;
    });
    T.el.vol.addEventListener('input', function () { setVol(+T.el.vol.value); });
    T.el.frame.addEventListener('keydown', function (e) {
      e.stopPropagation();
      if (e.key === 'Enter') { stop(); seek(+T.el.frame.value / FPS); T.el.frame.blur(); }
      if (e.key === 'Escape') T.el.frame.blur();
    });
    T.el.scroll.addEventListener('wheel', function (e) {
      if (!e.ctrlKey) return;
      e.preventDefault();
      zoomBy(e.deltaY < 0 ? 1.15 : 1 / 1.15);
    }, { passive: false });
    T.el.inner.addEventListener('pointerdown', function (e) {
      if (e.target.closest('[data-eye]') || e.target.closest('.tl-lab[data-pick],.tl-lab[data-lane]') && false) return;
      var box = T.el.inner.getBoundingClientRect(), x = e.clientX - box.left - LW;
      var h = e.target.closest('[data-h]'), seg = e.target.closest('[data-seg]'), fx = e.target.closest('[data-fx]'), pk = e.target.closest('[data-pick]');
      var bt = e.target.closest('[data-beat]'), rul = e.target.closest('.tl-ruler'), lab = e.target.closest('.tl-lab'), keep = e.target.closest('[data-keep-drag]');
      stop();
      if (keep) return;                                   // un módulo se encarga de este arrastre (fotogramas clave...)
      if (bt && e.altKey) { remember(); T.beats.splice(+bt.dataset.beat, 1); pistasDirty(); render(); return; }
      if (lab) { if (pk) { T.sel = { type: pk.dataset.pick, id: pk.dataset.id }; T.rtab = 'design'; } T.drag = null; render(); return; }
      if (T.tool === 'razor' && (seg || fx) && !rul) {
        seek(xToTime(x));
        split();
        if (e.shiftKey) on('razorAll', T.t);
        return;
      }
      if (fx) {
        var i = +fx.dataset.fx, f = T.fx[i], r = fxRange(f);
        if (e.shiftKey) {
          if (T.sel && T.sel.type === 'fx' && T.multi.indexOf(T.sel.id) < 0) T.multi.push(T.sel.id);
          var at = T.multi.indexOf(i);
          if (at >= 0) T.multi.splice(at, 1); else T.multi.push(i);
        } else if (T.multi.indexOf(i) < 0) T.multi = [];
        T.sel = { type: 'fx', id: i }; T.rtab = 'design';
        var group_ = members(i).map(function (j) { var rr = fxRange(T.fx[j]) || [0, 0]; return { i: j, s: rr[0], e: rr[1] }; });
        T.drag = { kind: h ? h.dataset.h : 'fxMove', i: i, x: e.clientX, start: r[0], end: r[1], moved: false, members: group_ };
      } else if (seg) {
        var s = item(seg.dataset.seg).s;
        T.sel = { type: 'seg', id: s._id }; T.multi = []; T.rtab = 'design';
        T.drag = h ? { kind: h.dataset.h, id: s._id, x: e.clientX, in: s.in, out: s.out, moved: false } : { kind: 'segMove', id: s._id, x: e.clientX, moved: false, to: null };
        if (!h && !s.off) seek(xToTime(x));
      } else if (pk) {
        T.sel = { type: pk.dataset.pick, id: pk.dataset.id }; T.multi = []; T.rtab = 'design';
        T.drag = { kind: 'scrub' }; seek(xToTime(x));
      } else if (rul || !e.target.closest('.tl-track')) {
        T.sel = null; T.multi = [];
        T.drag = { kind: 'scrub' }; seek(xToTime(x));
      } else {
        // fondo de una pista: clic mueve el cursor; arrastrar dibuja un marco que elige varias capas
        T.sel = null; T.multi = [];
        T.drag = { kind: 'marquee', x: e.clientX, y: e.clientY, moved: false, x0: x };
        seek(xToTime(x));
      }
      if (T.drag) {
        T.el.inner.setPointerCapture(e.pointerId);
        if (T.drag.kind !== 'scrub' && T.drag.kind !== 'marquee' && T.drag.kind !== 'segMove') remember();
      }
      render();
    });
    T.el.inner.addEventListener('pointermove', function (e) {
      var d = T.drag;
      if (!d) return;
      var box = T.el.inner.getBoundingClientRect();
      if (d.kind === 'scrub') {
        seek(xToTime(e.clientX - box.left - LW));
        return;
      }
      if (d.kind === 'marquee') {
        if (Math.abs(e.clientX - d.x) < 4 && Math.abs(e.clientY - d.y) < 4) return;
        d.moved = true;
        var mq = T.el.marquee, lx = Math.min(e.clientX, d.x) - box.left, ty = Math.min(e.clientY, d.y) - box.top;
        mq.hidden = false; mq.style.cssText = 'left:' + lx + 'px;top:' + ty + 'px;width:' + Math.abs(e.clientX - d.x) + 'px;height:' + Math.abs(e.clientY - d.y) + 'px';
        var mr = mq.getBoundingClientRect();
        T.multi = [].slice.call(T.el.inner.querySelectorAll('[data-fx]')).filter(function (n) {
          var b = n.getBoundingClientRect();
          var hit = !(b.right < mr.left || b.left > mr.right || b.bottom < mr.top || b.top > mr.bottom);
          n.classList.toggle('sel', hit);
          return hit;
        }).map(function (n) { return +n.dataset.fx; });
        return;
      }
      if (d.kind === 'segMove') {
        if (Math.abs(e.clientX - d.x) < 8 && !d.moved) return;
        d.moved = true;
        var px = e.clientX - box.left - LW, to = T.L.length;
        for (var n = 0; n < T.L.length; n++) { if (px < T.L[n].x0 + T.L[n].w / 2) { to = n; break; } }
        d.to = to;
        var gx = to >= T.L.length ? T.width : T.L[to].x0;
        T.el.guide.style.display = 'block'; T.el.guide.style.left = (LW + gx) + 'px';
        return;
      }
      var dt = (e.clientX - d.x) / T.pps;
      if (Math.abs(e.clientX - d.x) > 2) {
        d.moved = true;
        if (d.i != null) T.fx[d.i].edited = true;
      }
      if (d.kind === 'segL' || d.kind === 'segR') {
        var s = item(d.id).s, dur = T.clipDur[s.clip] || 1e9;
        if (d.kind === 'segL') s.in = clamp(snapF(d.in + dt * sp(s)), 0, s.out - MIN_SEG);
        else s.out = clamp(snapF(d.out + dt * sp(s)), s.in + MIN_SEG, dur);
      } else {
        var f = T.fx[d.i], len = d.end - d.start, a, skip = d.members.map(function (m) { return m.i; });
        if (d.kind === 'fxMove') {
          var ns0 = clamp(d.start + dt, 0, Math.max(0, T.total - len)), sn = snapTime(ns0, skip), snE = T.guide == null ? snapTime(ns0 + len, skip) - len : sn;
          ns0 = clamp(snE, 0, Math.max(0, T.total - len));
          var delta = ns0 - d.start;
          d.members.forEach(function (m) {
            moveFx(m.i, clamp(m.s + delta, 0, T.total - (m.e - m.s)));
          });
        } else if (d.kind === 'fxL') { var ns = clamp(snapTime(d.start + dt, skip), 0, d.end - MIN_FX); a = anchor(ns); f.seg = a.seg; f.src = a.src; f.dur = d.end - ns; }
        else f.dur = clamp(snapTime(d.start + len + dt, skip) - d.start, MIN_FX, T.total - d.start);
      }
      if (!T.raf) T.raf = requestAnimationFrame(function () { T.raf = 0; render(); });
    });
    var end = function () {
      var d = T.drag;
      T.drag = null; T.guide = null;
      T.el.guide.style.display = 'none';
      if (!d) return;
      if (d.kind === 'marquee') {
        T.el.marquee.hidden = true;
        if (d.moved && T.multi.length) { T.sel = { type: 'fx', id: T.multi[0] }; T.rtab = 'design'; render(); }
        return;
      }
      if (d.kind === 'segMove') {
        if (d.moved && d.to != null) {
          var it = item(d.id), from = T.segs.indexOf(it.s), to = d.to > from ? d.to - 1 : d.to;
          if (to !== from) {
            remember();
            T.segs.splice(from, 1); T.segs.splice(to, 0, it.s);
            changed(); seek(item(d.id).t0);
          }
        }
        return;
      }
      if (d.kind !== 'scrub') {
        if (!d.moved) { T.hist.pop(); toolsState(); }
        else { render(); notify(); }
      }
    };
    T.el.inner.addEventListener('pointerup', end);
    T.el.inner.addEventListener('pointercancel', end);
    document.addEventListener('keydown', function (e) {
      if (T.el.root.hidden || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
      if (on('key', e).some(Boolean)) return;            // un módulo la usó (p. ej. flechas con una capa elegida)
      var key = e.key.toLowerCase(), ctrl = e.ctrlKey || e.metaKey;
      if (e.code === 'Space') { e.preventDefault(); T.endAt = null; play(); }
      else if (ctrl && key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
      else if (ctrl && key === 'y') { e.preventDefault(); redo(); }
      else if (ctrl && key === 'g') { e.preventDefault(); group(!e.shiftKey); }
      else if (ctrl && key === 'c') { if (T.sel && T.sel.type === 'seg') { T.clipboard = JSON.parse(JSON.stringify(item(T.sel.id).s)); } on('copy', e); }
      else if (ctrl && key === 'x') { if (T.sel && T.sel.type === 'seg') { T.clipboard = JSON.parse(JSON.stringify(item(T.sel.id).s)); onAction('toggle'); } on('cut', e); }
      else if (ctrl && key === 'v') { if (T.clipboard && !T.sel) dupSeg(T.segs.indexOf(itemAt(T.t).s) + 1); else if (T.clipboard) dupSeg(); on('paste', e); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); stop(); seek(T.t + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 10 : 1) / FPS); }
      else if (ctrl) return;
      else if (key === 's') { e.preventDefault(); stop(); split(); }
      else if (key === 'v') { T.tool = 'sel'; toolsState(); }
      else if (key === 'b') { T.tool = 'razor'; toolsState(); }
      else if (key === 'j') { e.preventDefault(); reverse(); }
      else if (key === 'k') { e.preventDefault(); stop(); setRate(1); }
      else if (key === 'l' && e.shiftKey) { T.loop = !T.loop; toolsState(); }
      else if (key === 'l') { e.preventDefault(); if (T.playing) setRate(Math.min(4, T.rate * 2)); else { setRate(1); T.endAt = null; play(); } }
      else if (key === 'm') setMute(!T.muted);
      else if (key === 'f') clickTool('full');
      else if (key === 'i') setPoint('inP', e.shiftKey ? null : T.t);
      else if (key === 'o') setPoint('outP', e.shiftKey ? null : T.t);
      else if (key === 'a' && T.inP != null) { stop(); seek(T.inP); }
      else if (key === 'e' && T.outP != null) { stop(); seek(T.outP); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && T.sel && (T.sel.type === 'seg' || T.sel.type === 'fx')) {
        e.preventDefault(); onAction(T.sel.type === 'seg' ? 'toggle' : 'unplace');
      }
    });
    if (window.ResizeObserver) new ResizeObserver(fit).observe(T.el.stagewrap); else addEventListener('resize', fit);
    // los separadores reparten el espacio y se recuerdan en este navegador
    var KEY = 'mi-estudio-paneles2', saved = {};
    try { saved = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
    var setV = function (n, v) { root.style.setProperty('--st-' + n, v + 'px'); saved[n] = v; };
    ['left', 'player', 'tl'].forEach(function (n) { if (saved[n]) setV(n, saved[n]); });
    root.querySelectorAll('[data-sep]').forEach(function (sep) {
      sep.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        var n = sep.dataset.sep, x0 = e.clientX, y0 = e.clientY, v0 = n === 'left' ? T.el.left.offsetWidth : n === 'player' ? T.el.center.offsetWidth : T.el.tl.offsetHeight;
        sep.classList.add('act');
        function mv(ev) {
          if (n === 'left') setV(n, clamp(v0 + ev.clientX - x0, 200, 760));
          else if (n === 'player') setV(n, clamp(v0 - ev.clientX + x0, 260, innerWidth - 520));
          else setV(n, clamp(v0 - ev.clientY + y0, 150, innerHeight - 200));
        }
        function up() {
          removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
          sep.classList.remove('act');
          try { localStorage.setItem(KEY, JSON.stringify(saved)); } catch (err) {}
        }
        addEventListener('pointermove', mv); addEventListener('pointerup', up);
      });
    });
  }

  // lo que los módulos pueden usar
  var API = {
    W: W, H: H, FPS: FPS, LW: LW, esc: esc, fmt: fmt, fmtS: fmtS, clamp: clamp, ic: ic,
    state: function () { return T; },
    fxRange: fxRange, timeToX: timeToX, xToTime: xToTime, snapTime: snapTime, anchor: anchor,
    clipAt: function (t) { var it = itemAt(t); return it && !it.s.off ? it : null; },   // {s, t0, dur}: el clip que se ve en t
    clipNum: function (id) { var a = active(); for (var i = 0; i < a.length; i++) if (a[i].s.id === id) return i + 1; return null; },
    url: function (p) { return /^(\/|https?:|data:|blob:)/.test(p) ? p : '/p/' + p; },     // ruta del proyecto -> URL
    html: function (h) { return String(h || '').replace(/(src|href)=(["'])(?!\/|https?:|data:|#)/g, '$1=$2/p/'); },
    select: function (sel) { T.sel = sel; T.multi = []; if (sel) T.rtab = 'design'; render(); },
    remember: remember,
    touched: function (id) { T.dirty[id] = true; notify(); },   // el módulo cambió algo: se guarda al procesar
    refresh: function () { panelRight(); head(); },             // repintar panel y vista previa sin rehacer pistas
    redraw: function () { render(); },
    refreshLeft: function () { panelLeft(); },
    stop: stop, seek: seek, play: play, fit: function () { fit(); },
    audio: audioGraph,                                        // {ctx, master, voice, voiceOut, stems}
    section: section, popup: popup, closePopup: closePopup,
    isHidden: isHidden,
    gridSnap: function (v) { return T.gridSnap ? Math.round(v / T.gridSize) * T.gridSize : v; },
    showRight: function (id) { T.rtab = id; panelRight(); },
    showLeft: function (id) { T.ltab = id; panelLeft(); },
    addFx: function (o) { T.fx.push(o); return T.fx.length - 1; },   // una capa nueva en la pista Capas (ver libres.js)
    api: function (url, body) {
      var opt = body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
      return fetch(url, opt).then(function (r) { return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || r.status); return d; }); });
    },
    toast: function (m, e) { if (Timeline.toast) Timeline.toast(m, e); }
  };

  // ---------- API ----------
  window.Timeline = {
    use: function (p) { PLUGINS.push(p); },
    addLeft: function (p) { HOST_LEFT.push(p); },               // un panel de la barra lateral que pone la página (Catálogo)
    mount: function (root, project, keys, names, inputs) {
      T = { pps: 60, t: 0, hist: [], redo: [], sel: null, multi: [], drag: null, playing: false, peaks: {}, strips: {}, clipDur: {}, urls: {}, vi: 0, names: names,
            keys: keys.slice(), n: 0, S: 1, dirty: {}, plugins: [], tool: 'sel', snapOn: true, thumbs: true, hidden: {}, beats: [], groups: {}, secs: {}, rtab: 'design', ltab: null,
            inP: null, outP: null, loop: false, rate: 1, muted: false, vol: 1, dir: 1, rev: 0, gridOn: false, gridSnap: false, gridSize: 60, lastMem: 0, project: project };
      T.segs = project.edl.map(function (s) { var c = JSON.parse(JSON.stringify(s)); c._id = 's' + (T.n++); c._in0 = c.in; c._out0 = c.out; c.off = false; return c; });
      Object.keys(project.clips).forEach(function (c) { T.clipDur[c] = project.clips[c].dur; });
      layout();
      T.fx = [];
      (project.effects || []).forEach(function (f) {
        if (keys.indexOf(f.key) < 0 || T.fx.some(function (x) { return x.key === f.key; })) return;
        var a = anchor(clamp(f.from, 0, T.total));
        T.fx.push({ kind: 'fx', key: f.key, seg: a.seg, src: a.src, dur: Math.max(MIN_FX, f.to - f.from) });
      });
      var pist = ((inputs || {}).pistas || {}).saved || {};
      T.hidden = pist.hidden || {}; T.beats = pist.beats || [];
      var tiem = (((inputs || {}).tiempos || {}).saved || {}).capas || {};   // lo último que se vio en Ver resultado o se exportó
      T.dirty.tiempos = Object.keys(tiem).length > 0;
      T.baseOff = {};
      (project.elementos || []).forEach(function (e0) {
        var e = Object.assign({}, e0, tiem[e0.id] ? Object.assign({ edited: true }, tiem[e0.id]) : {});
        if (e0.off) T.baseOff[e0.id] = true;    // no está en el HTML: recuperarla pide volver a montar
        // pegada al momento de su toma si lo trae (así no se descoloca si edl.json cambió fuera de aquí)
        var s = e.anchor && T.segs.filter(function (x) { return x.id === e.anchor.seg; })[0];
        var a = s ? { seg: s._id, src: e.anchor.src } : anchor(clamp(e.from, 0, T.total)), z = anchor(clamp(e.to, 0, T.total));
        T.fx.push({ kind: 'el', id: e.id, label: e.label || e.id, seg: a.seg, src: a.src, dur: Math.max(MIN_FX, e.to - e.from), endSeg: z.seg, endSrc: z.src,
                    edited: !!e.edited, off: !!e.off, group: (pist.groups || {})[e.id] || null });
      });

      var tb = function (k, icon, title, cls) { return '<button class="st-tb ' + (cls || '') + '" data-t="' + k + '" title="' + esc(title) + '">' + ic(icon) + '</button>'; };
      root.innerHTML =
        '<div class="st-app"><div class="st-col"><div class="st-main">' +
        '<aside class="st-left"><div class="st-ltabs"></div><div class="st-lbody"></div></aside><div class="st-sep v" data-sep="left" role="separator" title="Repartir el ancho entre la barra lateral y los ajustes"></div>' +
        '<aside class="st-right"><div class="st-rtabs"></div><div class="tl-insp"></div></aside></div>' +
        '<div class="st-sep h" data-sep="tl" role="separator" title="Cambiar el alto de la línea de tiempo"></div>' +
        '<div class="st-tl"><div class="tl-tools">' +
        tb('tool-sel', 'sel', 'Seleccionar (V)') + tb('tool-razor', 'razor', 'Tijeras (B): parte donde toques. Mayús+clic: todas las pistas') + '<i class="st-div"></i>' + tb('snap', 'snap', 'Imán en la línea de tiempo') +
        '<span class="st-kf-tools"></span><i class="st-div"></i>' + tb('split', 'split', 'Partir en el cursor (S)') + tb('beat', 'beat', 'Poner una marca en el cursor (Alt+clic en la regla la quita)') +
        '<button class="st-tb st-txt" data-t="reset" title="Volver a como estaba todo al abrir">Deshacer todo</button><span class="tl-mtools"></span><span class="st-grow"></span>' +
        tb('thumbs', 'thumb', 'Miniaturas en los clips') + '<button class="st-tb st-txt" data-t="fit" title="Ver todo el vídeo">Ver todo</button>' + tb('zout', 'minus', 'Alejar') +
        '<input type="range" class="tl-zoom" min="4" max="240" value="60" title="Zoom de la línea de tiempo (Ctrl+rueda)">' + tb('zin', 'plus', 'Acercar') + '</div><div class="tl-tray" hidden></div>' +
        '<div class="tl-scroll"><div class="tl-inner"><div class="tl-rulerrow"><div class="tl-corner"></div><div class="tl-ruler"></div></div><div class="tl-rows"></div><div class="tl-guide"></div><div class="tl-head"></div><div class="tl-marquee" hidden></div></div></div></div></div>' +
        '<div class="st-sep v" data-sep="player" role="separator" title="Cambiar el ancho de la vista previa"></div>' +
        '<section class="st-center"><div class="st-stools"><span class="tl-ptools"></span>' + tb('stagesnap', 'snap', 'Imán a la cuadrícula al mover capas') + tb('grid', 'grid', 'Cuadrícula') + tb('gridopts', 'dots', 'Tamaño de la cuadrícula') + '</div><div class="st-stagewrap">' +
        '<div class="tl-screen"><div class="tl-stage"><div class="tl-rf"><div class="tl-img"></div></div><div class="st-grid" hidden></div>' +
        '<div class="tl-ov"></div></div><div class="tl-fxlabel"></div></div></div>' +
        '<div class="st-transport"><div class="st-tl-time"><span class="tl-time"></span><label title="Ir a un fotograma">fot. <input class="st-frame" type="number" min="0"></label></div>' +
        '<div class="st-tl-play"><button class="st-play" data-t="play" title="Reproducir (Espacio)"></button></div>' +
        '<div class="st-tl-right"><input class="st-vol" type="range" min="0" max="1" step="0.01" value="1" title="Volumen de la vista previa">' + tb('mute', 'vol', 'Silenciar (M)') + '<button class="st-tb st-rate" data-t="rate" title="Velocidad de la vista previa">1x</button>' + tb('loop', 'loop', 'Bucle (Mayús+L)') + tb('full', 'full', 'Pantalla completa (F)') + tb('keys', 'keys', 'Teclas y herramientas') + '</div></div>' +
        '<div class="st-board" hidden></div></section></div>';
      var q = function (s) { return root.querySelector(s); };
      T.el = { root: root, screen: q('.tl-screen'), stage: q('.tl-stage'), rf: q('.tl-rf'), img: q('.tl-img'), ov: q('.tl-ov'), grid: q('.st-grid'),
               stagewrap: q('.st-stagewrap'), stools: q('.st-stools'), fxlabel: q('.tl-fxlabel'), play: q('[data-t=play]'), time: q('.tl-time'), frame: q('.st-frame'), vol: q('.st-vol'), insp: q('.tl-insp'), rtabs: q('.st-rtabs'),
               ltabs: q('.st-ltabs'), lbody: q('.st-lbody'), left: q('.st-left'), right: q('.st-right'), tl: q('.st-tl'), center: q('.st-center'), board: q('.st-board'), transport: q('.st-transport'),
               ptools: q('.tl-ptools'), mtools: q('.tl-mtools'), kftools: q('.st-kf-tools'), tools: q('.tl-tools'), zoom: q('.tl-zoom'), scroll: q('.tl-scroll'), inner: q('.tl-inner'), ruler: q('.tl-ruler'), rows: q('.tl-rows'), head: q('.tl-head'), guide: q('.tl-guide'), marquee: q('.tl-marquee'), tray: q('.tl-tray') };
      Object.keys(project.clips).forEach(function (c) { T.urls[c] = project.clips[c].url; });
      T.deck = [0, 1].map(function () {
        var v = document.createElement('video');
        v.preload = 'auto'; v.playsInline = true; v.crossOrigin = 'anonymous';
        T.el.img.appendChild(v);
        return v;
      });
      // módulos: los del proyecto (edicion/<id>.json) y los que siempre están (Color, Audio FX, Capas libres...)
      PLUGINS.forEach(function (p) {
        var d = (inputs || {})[p.id];
        if (p.init && p.init(API, d && d.input, d && d.saved)) T.plugins.push(p);
      });
      T.plugins.sort(function (a, b) { return (a.last ? 1 : 0) - (b.last ? 1 : 0); });    // "Pedirle a Claude" al final del panel
      T.el.ptools.innerHTML = on('toolbar').join('');
      T.el.mtools.innerHTML = on('timelineTools').join('');
      T.el.kftools.innerHTML = on('kfTools').join('');
      T.initial = snapshot();
      Object.keys(project.clips).forEach(function (c) {
        fetch('/api/peaks/' + c).then(function (r) { return r.json(); }).then(function (p) {
          T.peaks[c] = p;
          T.el.inner.querySelectorAll('.tl-seg:not(.off)').forEach(function (d) { if (item(d.dataset.seg).s.clip === c) drawSeg(d); });
        }).catch(function () {});
        fetch('/api/strip/' + c).then(function (r) { return r.json(); }).then(function (st) {
          if (!st || !st.url) return;
          var img = new Image();
          img.onload = function () {
            st.img = img; T.strips[c] = st;
            T.el.inner.querySelectorAll('.tl-seg:not(.off)').forEach(function (d) { if (item(d.dataset.seg).s.clip === c) drawSeg(d); });
            on('onStrip', c, st);
          };
          img.src = st.url;
        }).catch(function () {});
      });
      bind();
      panelLeft();
      fit();
      fitZoom();
      seek(0);
      T.base = fingerprint();
    },
    razones: function () {                                     // [] = todo lo cambiado se puede exportar sin Claude
      if (!T || !T.base) return [];
      var now = fingerprint(), out = [];
      if (now.edl !== T.base.edl) out.push('cortes');
      if (now.fx !== T.base.fx) out.push('efectos');
      if (T.fx.some(function (f) { return f.kind === 'el' && !f.off && T.baseOff[f.id]; })) out.push('capas recuperadas');
      Object.keys(NECESITA).forEach(function (k) { if (T.dirty[k]) out.push(NECESITA[k]); });
      on('necesita').forEach(function (w) { if (w) out.push(w); });
      return out;
    },
    setEffects: function (keys) {
      if (!T) return;
      T.keys = keys.slice();
      T.fx = T.fx.filter(function (f) { return f.kind === 'el' || keys.indexOf(f.key) >= 0; });
      T.sel = null;
      render();
    },
    stop: function () { if (T) stop(); },
    redraw: function () { if (T) { fit(); render(); } },
    undo: function () { if (T) undo(); },
    redoAct: function () { if (T) redo(); },
    toggleSide: function (which) { if (!T) return; var el = which === 'left' ? T.el.left : T.el.right; el.hidden = !el.hidden; T.el.root.querySelector('[data-sep="left"]').hidden = T.el.left.hidden || T.el.right.hidden; fit(); return !el.hidden; },
    setView: function (id) {                                   // 'edit' o el id de la vista de un módulo (Guion)
      if (!T) return;
      var m = T.plugins.filter(function (p) { return p.view && p.view.id === id; })[0];
      T.el.board.hidden = !m;
      T.el.root.classList.toggle('guion', !!m);       // el Guion necesita más ancho que la vista previa
      T.el.stagewrap.hidden = !!m; T.el.transport.hidden = !!m; T.el.stools.hidden = !!m;
      if (m) m.viewRender(T.el.board); else { fit(); head(); }
    },
    views: function () { return T ? T.plugins.filter(function (p) { return p.view; }).map(function (p) { return p.view; }) : []; },
    currentT: function () { return T ? T.t : 0; },
    dirty: function () { return T ? Object.keys(T.dirty).filter(function (k) { return T.dirty[k]; }) : []; },
    data: function () {
      layout();
      var edl = T.segs.filter(function (s) { return !s.off; }).map(function (s) {
        var c = {};
        Object.keys(s).forEach(function (k) { if (k[0] !== '_' && k !== 'off') c[k] = s[k]; });
        c.in = Math.round(s.in * 1000) / 1000; c.out = Math.round(s.out * 1000) / 1000;
        return c;
      });
      var fx = T.fx.filter(function (f) { return f.kind === 'fx'; }).map(function (f) { var r = fxRange(f); return r && { key: f.key, from: Math.round(r[0] * 1000) / 1000, to: Math.round(r[1] * 1000) / 1000 }; })
        .filter(Boolean);
      var els = T.fx.filter(function (f) { return f.kind === 'el' && !f.libre && !f.sonido; }).map(function (f) {
        var r = fxRange(f) || [0, 0], it = item(f.seg);
        return { id: f.id, label: f.label, from: Math.round(r[0] * 1000) / 1000, to: Math.round(r[1] * 1000) / 1000,
                 edited: !!f.edited, off: !!f.off || !fxRange(f),
                 anchor: it ? { seg: it.s.id, src: Math.round(f.src * 1000) / 1000 } : null };
      });
      // lo que cambió en cada módulo -> edicion/<id>_edit.json
      var edicion = {};
      T.plugins.forEach(function (p) { if (T.dirty[p.id] && p.data) edicion[p.id] = p.data(); });
      var tiempos = {};                                         // cuándo sale cada capa: lo aplica aplicar.py sin volver a montar
      els.forEach(function (e) { if (e.edited || e.off) tiempos[e.id] = { from: e.from, to: e.to, off: e.off, anchor: e.anchor }; });
      if (Object.keys(tiempos).length) T.dirty.tiempos = true;
      if (T.dirty.tiempos) edicion.tiempos = { capas: tiempos };
      var groups = {};
      T.fx.forEach(function (f) { if (f.group && f.id) groups[f.id] = f.group; });
      if (T.dirty.pistas || Object.keys(T.hidden).length || T.beats.length || Object.keys(groups).length) edicion.pistas = { hidden: T.hidden, beats: T.beats, groups: groups };
      return { edl: edl, effects: fx, elementos: els, total: T.total, edicion: edicion };
    }
  };
})();
