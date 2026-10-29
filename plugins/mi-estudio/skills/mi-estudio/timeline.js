// Edición de Mi Estudio: una sola vista, como un editor de vídeo (CapCut). Vista previa grande con las capas encima
// (se mueven y cambian de tamaño ahí mismo), una línea de tiempo con todas las pistas (vídeo y voz, capas, efectos,
// música, efectos de sonido...) y un panel que cambia según lo que tocas.
// Los fragmentos y las capas se anclan a un momento del clip fuente (fragmento + segundo del clip), así que si
// recortas un fragmento anterior, lo que va después se mueve con las palabras que acompaña.
// Lo que no es cortar (mover capas, encuadre, volúmenes y lo que venga) son módulos de herramientas/*.js que se
// enchufan con Timeline.use({...}); ver SKILL.md, "Pestaña Edición".
(function () {
  var FPS = 30, MIN_SEG = 3 / FPS, MIN_FX = 0.5, GAP = 2, OFF_W = 14, W = 1080, H = 1920;
  var T = null, PLUGINS = [];   // estado; módulos registrados
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return '&#' + c.charCodeAt(0) + ';'; }); };
  var snap = function (v) { return Math.round(v * FPS) / FPS; };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var sp = function (s) { return s.overlay ? 1 : (s.speed || 1); };   // un fragmento con "speed" va acelerado en el montaje
  var fmt = function (t) { t = Math.max(0, t); var m = Math.floor(t / 60); return m + ':' + (t - m * 60).toFixed(2).padStart(5, '0'); };
  var UNSAFE = [[0, 0, 1080, 220], [0, 1470, 1080, 450], [0, 220, 35, 1250], [1045, 220, 35, 935], [980, 1155, 100, 315]];

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

  function snapshot() {
    var p = {};
    T.plugins.forEach(function (x) { if (x.snap) p[x.id] = x.snap(); });
    return JSON.stringify({ segs: T.segs, fx: T.fx, p: p });
  }
  function restore(h) {
    h = JSON.parse(h); T.segs = h.segs; T.fx = h.fx; T.sel = null;
    T.plugins.forEach(function (x) { if (x.restore && h.p && h.p[x.id]) x.restore(h.p[x.id]); });
  }
  function remember() { T.hist.push(snapshot()); if (T.hist.length > 80) T.hist.shift(); }
  function undo() {
    var h = T.hist.pop();
    if (!h) return;
    restore(h);
    changed();
  }

  // ---------- pintar ----------
  function render() {
    layout();
    var segs = T.L.map(function (it, i) {
      var s = it.s, sel = T.sel && T.sel.type === 'seg' && T.sel.id === s._id;
      if (s.off) return '<div class="tl-seg off' + (sel ? ' sel' : '') + '" data-seg="' + s._id + '" title="Quitado: ' + esc(s.line) + '" style="left:' + it.x0 + 'px;width:' + it.w + 'px"></div>';
      return '<div class="tl-seg' + (s.overlay ? ' ov' : '') + (sel ? ' sel' : '') + '" data-seg="' + s._id + '" style="left:' + it.x0 + 'px;width:' + it.w + 'px">' +
        '<div class="t">' + (i + 1) + '. ' + (s.overlay ? '▣ ' : '') + esc(s.line || s.id) + '</div><canvas></canvas>' +
        '<div class="tl-h l" data-h="segL"></div><div class="tl-h r" data-h="segR"></div></div>';
    }).join('');
    var block = function (kind) {
      return T.fx.map(function (f, i) {
        var r = fxRange(f);
        if (!r || f.kind !== kind || f.off) return '';
        var x0 = timeToX(r[0]), x1 = timeToX(r[1]), sel = T.sel && T.sel.type === 'fx' && T.sel.id === i;
        return '<div class="tl-fxb ' + kind + (sel ? ' sel' : '') + '" data-fx="' + i + '" style="left:' + x0 + 'px;width:' + Math.max(18, x1 - x0) + 'px">' +
          esc(nm(f)) + '<div class="tl-h l" data-h="fxL"></div><div class="tl-h r" data-h="fxR"></div></div>';
      }).join('');
    };
    var fx = block('fx'), els = block('el');
    T.el.eltrack.hidden = T.el.ellab.hidden = !T.fx.some(function (f) { return f.kind === 'el'; });
    T.el.eltrack.innerHTML = els;
    var step = T.pps >= 90 ? 1 : T.pps >= 40 ? 2 : T.pps >= 18 ? 5 : 10, ticks = '';
    for (var s = 0; s <= T.total; s += step) ticks += '<i style="left:' + timeToX(s) + 'px">' + fmt(s).replace(/\.\d+$/, '') + '</i>';

    T.el.inner.style.width = (T.width + 40) + 'px';
    T.el.ruler.innerHTML = ticks;
    T.el.vlab.innerHTML = 'Vídeo y voz' + on('labelExtra', 'voice').join('');
    T.el.vlab.classList.toggle('sel', !!(T.sel && T.sel.type === 'aud' && T.sel.id === 'voice'));
    T.el.vtrack.innerHTML = segs;
    T.el.fxtrack.innerHTML = fx;
    T.el.extra.innerHTML = on('tracks').join('');
    T.el.inner.querySelectorAll('.tl-seg:not(.off)').forEach(drawWave);
    on('drawTracks', T.el.inner);
    head();
    inspector();
    tray();
  }

  function drawWave(div) {
    var s = T.segs.filter(function (x) { return x._id === div.dataset.seg; })[0];
    var pk = T.peaks[s.clip], cv = div.querySelector('canvas');
    if (!pk || !cv) return;
    var dpr = window.devicePixelRatio || 1, w = div.clientWidth, h = 44;
    cv.width = Math.max(1, Math.round(w * dpr)); cv.height = h * dpr;
    var g = cv.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = s.overlay ? '#f2c810' : '#6f93ff';
    for (var x = 0; x < w; x++) {
      var a = Math.floor((s.in + x / T.pps * sp(s)) * 100), b = Math.max(a + 1, Math.floor((s.in + (x + 1) / T.pps * sp(s)) * 100)), m = 0;
      for (var k = a; k < b && k < pk.length; k++) if (pk[k] > m) m = pk[k];
      var bh = Math.max(1, (m / 255) * (h - 4));
      g.fillRect(x, (h - bh) / 2, 1, bh);
    }
  }

  function head() {
    T.el.head.style.left = (16 + timeToX(T.t)) + 'px';
    T.el.time.innerHTML = '<b>' + fmt(T.t) + '</b> / ' + fmt(T.total);
    var on_ = T.fx.filter(function (f) { var r = fxRange(f); return f.kind === 'fx' && r && !f.off && T.t >= r[0] && T.t < r[1]; });
    T.el.fxlabel.innerHTML = on_.map(function (f) { return '<span>' + esc(nm(f)) + '</span>'; }).join('');
    on('paint', T.t);
  }

  function nudges(kind, label, value) {
    return '<div class="tl-row"><label>' + label + '</label>' +
      '<button data-n="' + kind + '" data-d="-0.1">−0,1 s</button><button data-n="' + kind + '" data-d="-f">−1 fot.</button>' +
      '<span class="v">' + value + '</span>' +
      '<button data-n="' + kind + '" data-d="f">+1 fot.</button><button data-n="' + kind + '" data-d="0.1">+0,1 s</button></div>';
  }

  function inspector() {
    var html, p = T.sel && owner(T.sel.type);
    if (p) {
      html = p.inspector(T.sel);
    } else if (T.sel && T.sel.type === 'seg') {
      var it = item(T.sel.id), s = it.s, n = T.L.indexOf(it) + 1;
      html = '<h3>' + (s.overlay ? 'Vídeo superpuesto · ' : '') + 'Fragmento ' + n + ' de ' + T.L.length + (s.off ? ' · quitado' : '') + '</h3><div class="q">“' + esc(s.line || '') + '”</div>' +
        (s.overlay ? '<div class="help">Inicio y Final son el trozo del vídeo superpuesto que se ve (y se oye). Mientras dura, debajo sigue tu plano, sin sonido.</div>' : '') +
        (s.off ? '' : nudges('in', 'Inicio', s.in.toFixed(2) + ' s') + nudges('out', 'Final', s.out.toFixed(2) + ' s') +
          '<div class="tl-row"><label>Duración</label><span class="v">' + ((s.out - s.in) / sp(s)).toFixed(2) + ' s</span>' +
          (sp(s) !== 1 ? '<span class="v">a ' + sp(s) + 'x</span>' : '') + '</div>') +
        '<div class="tl-acts">' + (s.off ? '' : '<button data-a="playseg">▶ Escuchar fragmento</button>' + (s.overlay ? '' : '<button data-a="split">✂ Partir en el cursor</button>')) +
        '<button data-a="toggle" class="' + (s.off ? '' : 'warn') + '">' + (s.off ? 'Recuperar fragmento' : 'Quitar del montaje') + '</button>' +
        ((s.in !== s._in0 || s.out !== s._out0) ? '<button data-a="restore">Volver al corte original</button>' : '') + '</div>';
    } else if (T.sel && T.sel.type === 'fx') {
      var f = T.fx[T.sel.id], r = fxRange(f) || [0, 0];
      html = '<h3>' + (f.kind === 'el' ? 'Capa: ' : 'Efecto: ') + esc(nm(f)) + '</h3><div class="q">Del ' + fmt(r[0]) + ' al ' + fmt(r[1]) + (f.edited ? ' · ajustada a mano' : '') + '</div>' +
        nudges('fxs', 'Empieza', fmt(r[0])) + nudges('fxd', 'Dura', (r[1] - r[0]).toFixed(2) + ' s') +
        '<div class="tl-acts"><button data-a="playfx">▶ Ver ese momento</button><button data-a="unplace" class="warn">Quitar de la línea</button></div>' +
        on('inspectorExtra', T.sel, f).join('');
    } else {
      html = '<h3>Cómo se usa</h3><div class="help">' +
        '<b>Recortar:</b> arrastra el borde izquierdo o derecho de un fragmento. La onda azul es tu voz: los huecos planos son silencios.<br>' +
        '<b>Cortar por el centro:</b> pon el cursor donde empieza lo que sobra y pulsa S (o ✂), luego donde acaba y otra vez S; toca el trozo del medio y pulsa Supr.<br>' +
        '<b>Vídeos superpuestos</b> (en amarillo, ▣): sus bordes eligen qué trozo del vídeo de ejemplo se ve; tu plano sigue debajo.<br>' +
        '<b>Capas en el tiempo</b> (títulos, imágenes, rótulos...): arrástralas en su pista para moverlas y estira sus bordes para cambiar cuánto duran; Supr las quita (se recuperan abajo).<br>' +
        on('helpExtra').join('') +
        '<b>Precisión:</b> toca cualquier cosa y ajústala aquí.<br>' +
        '<b>Teclas:</b> Espacio reproduce · ← → mueven un fotograma · S parte · Supr quita · Ctrl+Z deshace.</div>' +
        on('inspectorIdle').join('');
    }
    T.el.insp.innerHTML = html;
  }

  function tray() {
    var fxs = T.fx.filter(function (f) { return f.kind === 'fx'; });
    var placed = fxs.map(function (f) { return f.key; });
    var lost = fxs.filter(function (f) { return !fxRange(f); }).map(function (f) { return f.key; });
    var free = T.keys.filter(function (k) { return placed.indexOf(k) < 0 || lost.indexOf(k) >= 0; });
    var off = T.fx.map(function (f, i) { return f.kind === 'el' && f.off ? i : -1; }).filter(function (i) { return i >= 0; });
    T.el.tray.innerHTML = (free.length
      ? 'Efectos sin colocar (si los dejas así, Claude elige dónde): ' + free.map(function (k) {
          return '<button data-place="' + esc(k) + '">+ ' + esc(T.names[k] || k) + ' en el cursor</button>';
        }).join('')
      : '') + (off.length
      ? '<span>Capas quitadas: </span>' + off.map(function (i) {
          return '<button data-back="' + i + '">+ ' + esc(nm(T.fx[i])) + '</button>';
        }).join('')
      : '');
  }

  function changed() { stop(); render(); notify(); }
  function notify() { if (Timeline.onChange) Timeline.onChange(); }

  // la vista previa es un lienzo de 1080x1920 escalado al tamaño de la pantalla
  function fit() {
    if (!T || !T.el.screen.clientWidth) return;
    T.S = T.el.screen.clientWidth / W;
    T.el.stage.style.transform = 'scale(' + T.S + ')';
  }

  // ---------- reproducción ----------
  // Dos vídeos que se turnan: mientras uno suena, el otro espera parado al principio del siguiente fragmento,
  // así cada corte es un cambio de vídeo y no un salto que tiene que cargar y decodificar en ese momento.
  function vid() { return T.deck[T.vi]; }
  function cue(v, s, at) {
    if (v.dataset.clip !== s.clip) { v.dataset.clip = s.clip; v.src = T.urls[s.clip]; }
    if (Math.abs(v.currentTime - at) > .01) v.currentTime = at;
    v.playbackRate = sp(s); v.preservesPitch = true;
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
    if (T.t >= T.total - .05) seek(0); else seek(T.t);
    T.playing = true; T.el.play.textContent = '❚❚';
    vid().play().catch(function () {});
    on('onPlay', T.t);
    requestAnimationFrame(tick);
  }
  function stop() {
    var was = T && T.playing;
    T.playing = false; if (T.el) T.el.play.textContent = '▶';
    if (T.deck) T.deck.forEach(function (v) { v.pause(); });
    if (was) on('onStop');
  }
  function tick() {
    if (!T.playing) return;
    var it = T.cur, v = vid(), ct = v.currentTime;
    if (ct >= it.s.out - .01 || v.ended || (T.endAt != null && T.t >= T.endAt)) {
      var a = active(), next = a[a.indexOf(it) + 1];
      if (!next || (T.endAt != null && T.t >= T.endAt)) { T.endAt = null; stop(); return; }
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
      if (kind === 'in') s.in = clamp(snap(s.in + step), 0, s.out - MIN_SEG);
      else s.out = clamp(snap(s.out + step), s.in + MIN_SEG, dur);
    } else {
      var f = T.fx[T.sel.id], r = fxRange(f);
      f.edited = true;
      if (kind === 'fxs') { var a = anchor(clamp(r[0] + step, 0, T.total - MIN_FX)); f.seg = a.seg; f.src = a.src; }
      else f.dur = clamp(f.dur + step, MIN_FX, T.total - r[0]);
    }
    changed();
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
    } else if (a === 'unplace') {
      remember();
      if (T.fx[T.sel.id].kind === 'el') T.fx[T.sel.id].off = true;      // una capa quitada se puede recuperar
      else T.fx.splice(T.sel.id, 1);
      T.sel = null; changed();
    }
  }

  // Parte en dos el fragmento que está bajo el cursor. La segunda mitad es un fragmento nuevo del mismo clip, así
  // que se puede recortar o quitar por su cuenta; los efectos que caían después del corte se van con ella.
  function split() {
    var it = itemAt(T.t);
    if (!it || it.s.off) return;
    var s = it.s, src = snap(s.in + (T.t - it.t0) * sp(s));
    if (s.overlay || src - s.in < MIN_SEG || s.out - src < MIN_SEG) return;     // un vídeo superpuesto se recorta, no se parte
    remember();
    var b = JSON.parse(JSON.stringify(s)), ids = T.segs.map(function (x) { return x.id; }), nid = s.id + 'b';
    while (ids.indexOf(nid) >= 0) nid += 'b';
    b._id = 's' + (T.n++); b.id = nid; b.in = b._in0 = src; b._out0 = s.out;
    s.out = s._out0 = src;
    T.segs.splice(T.segs.indexOf(s) + 1, 0, b);
    T.fx.forEach(function (f) { if (f.seg === s._id && f.src >= src) f.seg = b._id; });
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

  function bind() {
    var root = T.el.root;
    root.addEventListener('click', function (e) {
      var b = e.target.closest('button,[data-pick]');
      if (!b) return;
      if (b.dataset.p) { var p = plugin(b.dataset.p); if (p && p.onClick) p.onClick(b, e); }
      else if (b.dataset.pick) { T.sel = { type: b.dataset.pick, id: b.dataset.id }; stop(); render(); }
      else if (b.dataset.n) nudge(b.dataset.n, b.dataset.d);
      else if (b.dataset.a) onAction(b.dataset.a);
      else if (b.dataset.place) place(b.dataset.place);
      else if (b.dataset.back) { remember(); T.fx[+b.dataset.back].off = false; T.sel = { type: 'fx', id: +b.dataset.back }; changed(); }
      else if (b.dataset.t === 'play') { T.endAt = null; play(); }
      else if (b.dataset.t === 'undo') undo();
      else if (b.dataset.t === 'split') split();
      else if (b.dataset.t === 'reset') {
        if (!confirm('¿Volver a como estaba todo al abrir (cortes, capas, encuadre y volúmenes)?')) return;
        remember(); restore(T.initial); T.plugins.forEach(function (x) { T.dirty[x.id] = false; }); changed();
      }
    });
    root.addEventListener('input', function (e) {
      var p = e.target.dataset.p && plugin(e.target.dataset.p);
      if (p && p.onInput) p.onInput(e.target, e);
    });
    T.el.zoom.addEventListener('input', function () {
      var mid = xToTime(T.el.scroll.scrollLeft + T.el.scroll.clientWidth / 2);
      T.pps = +T.el.zoom.value; render();
      T.el.scroll.scrollLeft = timeToX(mid) - T.el.scroll.clientWidth / 2;
    });
    T.el.safe.addEventListener('change', function () { T.el.unsafe.hidden = !T.el.safe.checked; });
    T.el.inner.addEventListener('pointerdown', function (e) {
      var x = e.clientX - T.el.inner.getBoundingClientRect().left - 16;
      var h = e.target.closest('[data-h]'), seg = e.target.closest('[data-seg]'), fx = e.target.closest('[data-fx]'), pk = e.target.closest('[data-pick]');
      stop();
      if (fx) {
        var i = +fx.dataset.fx, f = T.fx[i], r = fxRange(f);
        T.sel = { type: 'fx', id: i };
        T.drag = { kind: h ? h.dataset.h : 'fxMove', i: i, x: e.clientX, start: r[0], end: r[1], moved: false };
      } else if (seg) {
        var s = item(seg.dataset.seg).s;
        T.sel = { type: 'seg', id: s._id };
        T.drag = h ? { kind: h.dataset.h, id: s._id, x: e.clientX, in: s.in, out: s.out, moved: false } : null;
        if (!h && !s.off) seek(xToTime(x));
      } else if (pk && pk.classList.contains('tl-lab')) {
        T.sel = { type: pk.dataset.pick, id: pk.dataset.id }; T.drag = null;     // el nombre de una pista la elige
      } else {
        // una pista de un módulo (música, efectos de sonido...) la elige; el resto del fondo solo mueve el cursor
        T.sel = pk ? { type: pk.dataset.pick, id: pk.dataset.id } : null;
        T.drag = { kind: 'scrub' }; seek(xToTime(x));
      }
      if (T.drag) { T.el.inner.setPointerCapture(e.pointerId); if (T.drag.kind !== 'scrub') remember(); }
      render();
    });
    T.el.inner.addEventListener('pointermove', function (e) {
      var d = T.drag;
      if (!d) return;
      if (d.kind === 'scrub') {
        seek(xToTime(e.clientX - T.el.inner.getBoundingClientRect().left - 16));
        return;
      }
      var dt = (e.clientX - d.x) / T.pps;
      if (Math.abs(e.clientX - d.x) > 2) { d.moved = true; if (d.i != null) T.fx[d.i].edited = true; }
      if (d.kind === 'segL' || d.kind === 'segR') {
        var s = item(d.id).s, dur = T.clipDur[s.clip] || 1e9;
        if (d.kind === 'segL') s.in = clamp(snap(d.in + dt * sp(s)), 0, s.out - MIN_SEG);
        else s.out = clamp(snap(d.out + dt * sp(s)), s.in + MIN_SEG, dur);
      } else {
        var f = T.fx[d.i], len = d.end - d.start, a;
        if (d.kind === 'fxMove') { a = anchor(clamp(d.start + dt, 0, Math.max(0, T.total - len))); f.seg = a.seg; f.src = a.src; }
        else if (d.kind === 'fxL') { var ns = clamp(d.start + dt, 0, d.end - MIN_FX); a = anchor(ns); f.seg = a.seg; f.src = a.src; f.dur = d.end - ns; }
        else f.dur = clamp(len + dt, MIN_FX, T.total - d.start);
      }
      if (!T.raf) T.raf = requestAnimationFrame(function () { T.raf = 0; render(); });
    });
    var end = function () {
      var d = T.drag;
      T.drag = null;
      if (d && d.kind !== 'scrub') {
        if (!d.moved) T.hist.pop();
        else { render(); notify(); }
      }
    };
    T.el.inner.addEventListener('pointerup', end);
    T.el.inner.addEventListener('pointercancel', end);
    document.addEventListener('keydown', function (e) {
      if (!T.el.root.offsetParent || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (on('key', e).some(Boolean)) return;            // un módulo la usó (p. ej. flechas con una capa elegida)
      if (e.code === 'Space') { e.preventDefault(); T.endAt = null; play(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); stop(); seek(T.t + (e.key === 'ArrowLeft' ? -1 : 1) / FPS); }
      else if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey) { e.preventDefault(); stop(); split(); }
      else if ((e.key === 'Delete' || e.key === 'Backspace') && T.sel && (T.sel.type === 'seg' || T.sel.type === 'fx')) {
        e.preventDefault(); onAction(T.sel.type === 'seg' ? 'toggle' : 'unplace');
      }
    });
    if (window.ResizeObserver) new ResizeObserver(fit).observe(T.el.screen); else addEventListener('resize', fit);
    // el separador reparte el alto entre la vista previa y la línea de tiempo (se recuerda en este navegador)
    var split = T.el.root.querySelector('.tl-split'), KEY = 'mi-estudio-vista-alto';
    var setH = function (h) { T.el.screen.style.height = h + 'px'; T.el.root.style.setProperty('--tl-ph', h + 'px'); };
    try { if (+localStorage.getItem(KEY) > 0) setH(+localStorage.getItem(KEY)); } catch (e) {}
    split.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      var y0 = e.clientY, h0 = T.el.screen.getBoundingClientRect().height;
      function mv(ev) { setH(clamp(h0 + ev.clientY - y0, 200, 1000)); }
      function up() {
        removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
        try { localStorage.setItem(KEY, Math.round(T.el.screen.getBoundingClientRect().height)); } catch (e) {}
      }
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
  }

  // lo que los módulos pueden usar
  var API = {
    W: W, H: H, esc: esc, fmt: fmt, clamp: clamp,
    state: function () { return T; },
    fxRange: fxRange, timeToX: timeToX, xToTime: xToTime,
    url: function (p) { return /^(\/|https?:|data:|blob:)/.test(p) ? p : '/p/' + p; },     // ruta del proyecto -> URL
    html: function (h) { return String(h || '').replace(/(src|href)=(["'])(?!\/|https?:|data:|#)/g, '$1=$2/p/'); },
    select: function (sel) { T.sel = sel; render(); },
    remember: remember,
    touched: function (id) { T.dirty[id] = true; notify(); },   // el módulo cambió algo: se guarda al procesar
    refresh: function () { inspector(); head(); },              // repintar panel y vista previa sin rehacer pistas
    redraw: function () { render(); },
    stop: stop
  };

  // ---------- API ----------
  window.Timeline = {
    use: function (p) { PLUGINS.push(p); },
    mount: function (root, project, keys, names, inputs) {
      T = { pps: 60, t: 0, hist: [], sel: null, drag: null, playing: false, peaks: {}, clipDur: {}, urls: {}, vi: 0, names: names,
            keys: keys.slice(), n: 0, S: 1, dirty: {}, plugins: [] };
      T.segs = project.edl.map(function (s) { var c = JSON.parse(JSON.stringify(s)); c._id = 's' + (T.n++); c._in0 = c.in; c._out0 = c.out; c.off = false; return c; });
      Object.keys(project.clips).forEach(function (c) { T.clipDur[c] = project.clips[c].dur; });
      layout();
      T.fx = [];
      (project.effects || []).forEach(function (f) {
        if (keys.indexOf(f.key) < 0 || T.fx.some(function (x) { return x.key === f.key; })) return;
        var a = anchor(clamp(f.from, 0, T.total));
        T.fx.push({ kind: 'fx', key: f.key, seg: a.seg, src: a.src, dur: Math.max(MIN_FX, f.to - f.from) });
      });
      (project.elementos || []).forEach(function (e) {
        // pegada al momento de su toma si lo trae (así no se descoloca si edl.json cambió fuera de aquí)
        var s = e.anchor && T.segs.filter(function (x) { return x.id === e.anchor.seg; })[0];
        var a = s ? { seg: s._id, src: e.anchor.src } : anchor(clamp(e.from, 0, T.total));
        T.fx.push({ kind: 'el', id: e.id, label: e.label || e.id, seg: a.seg, src: a.src, dur: Math.max(MIN_FX, e.to - e.from),
                    edited: !!e.edited, off: !!e.off });
      });

      root.innerHTML =
        '<div class="tl"><div class="tl-top"><div class="tl-player"><div class="tl-screen"><div class="tl-stage"><div class="tl-rf"></div>' +
        '<div class="tl-unsafe" hidden>' + UNSAFE.map(function (r) { return '<i style="left:' + r[0] + 'px;top:' + r[1] + 'px;width:' + r[2] + 'px;height:' + r[3] + 'px"></i>'; }).join('') +
        '</div><div class="tl-ov"></div></div><div class="tl-fxlabel"></div></div>' +
        '<div class="tl-ctrl"><button data-t="play">▶</button><span class="tl-time"></span><label class="tl-safe"><input type="checkbox"> Zona segura</label></div></div>' +
        '<div class="tl-insp"></div></div><div class="tl-split" title="Arrastra para hacer más grande o más pequeña la vista previa"></div>' +
        '<div class="tl-tools">Zoom <input type="range" class="tl-zoom" min="8" max="240" value="60"><button data-t="split">✂ Partir en el cursor (S)</button><button data-t="undo">↶ Deshacer</button>' +
        '<button data-t="reset">Restaurar todo</button><span class="tl-ptools"></span></div>' +
        '<div class="tl-scroll"><div class="tl-inner"><div class="tl-ruler"></div>' +
        '<div class="tl-lab tl-vlab" data-pick="aud" data-id="voice"></div><div class="tl-track tl-v"></div>' +
        '<div class="tl-lab tl-ellab">Capas</div><div class="tl-track tl-fx tl-el"></div>' +
        '<div class="tl-lab">Efectos</div><div class="tl-track tl-fx tl-fxt"></div><div class="tl-extra"></div><div class="tl-head"></div></div></div>' +
        '<div class="tl-tray"></div></div>';
      var q = function (s) { return root.querySelector(s); };
      T.el = { root: root, screen: q('.tl-screen'), stage: q('.tl-stage'), rf: q('.tl-rf'), ov: q('.tl-ov'), unsafe: q('.tl-unsafe'), safe: q('.tl-safe input'),
               fxlabel: q('.tl-fxlabel'), play: q('[data-t=play]'), time: q('.tl-time'), insp: q('.tl-insp'), ptools: q('.tl-ptools'),
               zoom: q('.tl-zoom'), scroll: q('.tl-scroll'), inner: q('.tl-inner'), ruler: q('.tl-ruler'), vlab: q('.tl-vlab'),
               vtrack: q('.tl-v'), fxtrack: q('.tl-fxt'), eltrack: q('.tl-el'), ellab: q('.tl-ellab'), extra: q('.tl-extra'), head: q('.tl-head'), tray: q('.tl-tray') };
      Object.keys(project.clips).forEach(function (c) { T.urls[c] = project.clips[c].url; });
      T.deck = [0, 1].map(function () {
        var v = document.createElement('video');
        v.preload = 'auto'; v.playsInline = true;
        T.el.rf.appendChild(v);
        return v;
      });
      // módulos con datos en este proyecto (edicion/<id>.json)
      PLUGINS.forEach(function (p) {
        var d = (inputs || {})[p.id];
        if (p.init && p.init(API, d && d.input, d && d.saved)) T.plugins.push(p);
      });
      T.el.ptools.innerHTML = on('toolbar').join('');
      T.initial = snapshot();
      Object.keys(project.clips).forEach(function (c) {
        fetch('/api/peaks/' + c).then(function (r) { return r.json(); }).then(function (p) {
          T.peaks[c] = p;
          T.el.inner.querySelectorAll('.tl-seg:not(.off)').forEach(function (d) { if (item(d.dataset.seg).s.clip === c) drawWave(d); });
        }).catch(function () {});
      });
      bind();
      fit();
      render();
      seek(0);
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
      var els = T.fx.filter(function (f) { return f.kind === 'el'; }).map(function (f) {
        var r = fxRange(f) || [0, 0], it = item(f.seg);
        return { id: f.id, label: f.label, from: Math.round(r[0] * 1000) / 1000, to: Math.round(r[1] * 1000) / 1000,
                 edited: !!f.edited, off: !!f.off || !fxRange(f),
                 anchor: it ? { seg: it.s.id, src: Math.round(f.src * 1000) / 1000 } : null };
      });
      // lo que cambió en cada módulo -> edicion/<id>_edit.json
      var edicion = {};
      T.plugins.forEach(function (p) { if (T.dirty[p.id] && p.data) edicion[p.id] = p.data(); });
      return { edl: edl, effects: fx, elementos: els, total: T.total, edicion: edicion };
    }
  };
})();
