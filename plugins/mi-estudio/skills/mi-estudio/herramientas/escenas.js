// Módulo "Escenas" de la Edición (el Comps de HyperFrames Studio): los fragmentos del montaje, agrupados por su campo "block"
// o de corrido, con su miniatura, duración y frase. Tocar uno salta el cursor y lo elige; cada uno se puede reproducir solo.
(function () {
  var A, E = { el: null, sig: '', cur: null };
  var sp = function (s) { return s.overlay ? 1 : (s.speed || 1); };
  var dur = function (d) { return d.toFixed(2).replace('.', ',') + ' s'; };
  var CSS = '.es-top{display:flex;align-items:center;gap:6px;margin-bottom:6px;color:var(--t3);font-size:11px}.es-top span{flex:1}.es-top button{padding:3px 7px;font-size:11px}' +
    '.es-gh{display:flex;align-items:center;gap:6px;margin:10px 0 4px;font-size:11px;font-weight:600;color:var(--t2)}.es-gh span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.es-gh em{font-style:normal;font-weight:400;color:var(--t3)}.es-gh button{padding:2px 6px;font-size:10.5px}' +
    '.es-r{position:relative;display:flex;margin-bottom:4px;background:var(--card2);border:1px solid var(--b0);border-radius:7px;overflow:hidden}.es-r:hover{border-color:var(--b2)}.es-r.now{border-color:var(--ag)}.es-r.sel{border-color:var(--a);box-shadow:0 0 0 1px var(--a)}.es-r.off{opacity:.45}' +
    '.es-m{flex:1;min-width:0;display:flex;gap:8px;align-items:center;border:0;background:none;padding:4px;text-align:left;font-weight:400;border-radius:0;color:var(--t1)}' +
    '.es-th{width:32px;height:56px;flex:none;background:#000;border-radius:4px;display:block}.es-tx{flex:1;min-width:0;padding-right:26px}' +
    '.es-l{display:flex;gap:6px;font-size:10px;color:var(--t3);font-variant-numeric:tabular-nums}.es-l b{color:var(--t2);font-weight:600}' +
    '.es-q{font-size:11px;color:var(--t1);line-height:1.35;margin-top:2px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.es-off{color:#f59e0b}' +
    '.es-pl{position:absolute;right:4px;top:50%;transform:translateY(-50%);width:24px;height:24px;padding:0;display:grid;place-items:center;border:0;background:rgba(255,255,255,.06);border-radius:5px;color:var(--t2)}.es-pl:hover{color:#fff;background:rgba(255,255,255,.14)}' +
    '.es-sub{margin:14px 0 4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)}.es-e{color:var(--t3);font-size:11px;padding:6px 2px}';

  function thumb(cv, s) {                    // el fotograma medio del fragmento, sacado de la tira de miniaturas
    var st = A.state().strips[s.clip];
    if (!st || !st.img) return;
    var i = A.clamp(Math.floor((s.in + s.out) / 2 / st.step), 0, st.n - 1);
    cv.getContext('2d').drawImage(st.img, (i % st.cols) * st.tw, Math.floor(i / st.cols) * st.th, st.tw, st.th, 0, 0, cv.width, cv.height);
  }
  function thumbs() {
    var T = A.state();
    if (!E.el) return;
    E.el.querySelectorAll('canvas.es-th').forEach(function (cv) {
      var it = T.L.filter(function (x) { return x.s._id === cv.dataset.id; })[0];
      if (it) thumb(cv, it.s);
    });
  }
  function groups() {                        // seguidos con el mismo "block" van juntos; sin "block", cada uno suelto
    var out = [], last = null;
    A.state().L.forEach(function (it, i) {
      var b = it.s.block || null;
      if (b && last && last.block === b) { last.items.push({ it: it, n: i + 1 }); return; }
      last = { block: b, items: [{ it: it, n: i + 1 }] };
      out.push(last);
    });
    return out;
  }
  function freeBlocks() {                    // los bloques añadidos (capas libres de tipo bloque)
    var out = [], list = window.MiLibres ? window.MiLibres.list() : [];
    A.state().fx.forEach(function (f, i) {
      if (f.libre && !f.off && list.some(function (it) { return it.id === f.id && it.type === 'block'; })) out.push({ f: f, i: i });
    });
    return out;
  }
  function row(x) {
    var s = x.it.s, T = A.state(), sel = T.sel && T.sel.type === 'seg' && T.sel.id === s._id;
    return '<div class="es-r' + (s.off ? ' off' : '') + (sel ? ' sel' : '') + '" data-es="' + s._id + '">' +
      '<button class="es-m" data-p="escenas" data-k="go" data-id="' + s._id + '"><canvas class="es-th" width="54" height="96" data-id="' + s._id + '"></canvas><span class="es-tx">' +
      '<span class="es-l"><b>' + x.n + '</b><span>' + A.fmtS(x.it.t0) + '</span><span>' + (s.off ? '<span class="es-off">Quitado</span>' : dur(x.it.dur)) + '</span></span>' +
      '<span class="es-q">' + A.esc(s.line || s.id) + '</span></span></button>' +
      (s.off ? '' : '<button class="es-pl" data-p="escenas" data-k="play" data-id="' + s._id + '" title="Reproducir solo esta">' + A.ic('play', 11) + '</button>') + '</div>';
  }
  function draw() {
    var el = E.el, T = A.state();
    if (!el || T.ltab !== 'escenas') return;
    var gs = groups(), n = T.L.filter(function (it) { return !it.s.off; }).length, html = '';
    html += '<div class="es-top"><span>' + n + ' de ' + T.L.length + ' clips · ' + dur(T.total) + '</span>' +
      (T.inP != null || T.outP != null ? '<button data-p="escenas" data-k="nozone" title="Volver a reproducir todo el vídeo">Quitar zona</button>' : '') + '</div>';
    gs.forEach(function (g, gi) {
      if (g.block) {
        var ok = g.items.filter(function (x) { return !x.it.s.off; }), d = ok.reduce(function (a, x) { return a + x.it.dur; }, 0);
        html += '<div class="es-gh"><span>' + A.esc(g.block) + ' <em>· ' + g.items.length + ' · ' + dur(d) + '</em></span>' +
          (ok.length ? '<button data-p="escenas" data-k="playg" data-g="' + gi + '" title="Reproducir solo esta parte">Reproducir</button>' : '') + '</div>';
      }
      html += g.items.map(row).join('');
    });
    var fb = freeBlocks();
    html += '<div class="es-sub">Plantillas añadidas</div>' + (fb.length ? fb.map(function (b) {
      var r = A.fxRange(b.f) || [0, 0], sel = T.sel && T.sel.type === 'fx' && T.sel.id === b.i;
      return '<div class="es-r' + (sel ? ' sel' : '') + '"><button class="es-m" data-p="escenas" data-k="fx" data-i="' + b.i + '"><span class="es-tx" style="padding:3px 4px"><span class="es-l"><span>' + A.fmtS(r[0]) + '</span><span>' + dur(r[1] - r[0]) + '</span></span><span class="es-q">' + A.esc(b.f.label || b.f.id) + '</span></span></button></div>';
    }).join('') : '<div class="es-e">Ninguno todavía. Se añaden desde Catálogo, en Bloques.</div>');
    el.innerHTML = html;
    E.sig = sig(); E.cur = null;
    E.groups = gs;
    thumbs();
    mark(T.t);
  }
  function sig() {                           // lo que obliga a repintar la lista: cortes, orden, selección, zona y capas
    var T = A.state(), s = T.sel;
    return T.L.map(function (it) { return it.s._id + (it.s.off ? 'x' : '') + it.dur.toFixed(3); }).join() + '|' + (s ? s.type + s.id : '') + '|' + T.inP + '|' + T.outP + '|' + T.fx.length;
  }
  function mark(t) {                         // resalta el fragmento que hay bajo el cursor
    var T = A.state(), cur = null;
    for (var i = 0; i < T.L.length; i++) {
      var it = T.L[i];
      if (!it.s.off && t < it.t0 + it.dur) { cur = it.s._id; break; }
    }
    if (cur === E.cur || !E.el) return;
    var a = E.cur && E.el.querySelector('.es-r[data-es="' + E.cur + '"]'), b = cur && E.el.querySelector('.es-r[data-es="' + cur + '"]');
    if (a) a.classList.remove('now');
    if (b) b.classList.add('now');
    E.cur = cur;
  }
  function reveal(t) {                       // que el cursor se vea en la línea de tiempo
    var T = A.state(), x = A.timeToX(t) + A.LW, sc = T.el.scroll;
    if (x < sc.scrollLeft + A.LW || x > sc.scrollLeft + sc.clientWidth - 20) sc.scrollLeft = x - sc.clientWidth / 2;
  }
  function zone(a, b) {
    var T = A.state();
    A.stop();
    T.inP = a; T.outP = b; T.endAt = null;
    A.redraw();
    A.seek(a); reveal(a);
    A.play();
  }

  Timeline.use({
    id: 'escenas',
    left: { id: 'escenas', label: 'Clips', order: 20, tip: 'Los clips del vídeo' },
    init: function (api) {
      A = api;
      var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
      return true;
    },
    leftRender: function (el) { E.el = el; draw(); },
    onStrip: function () { if (A.state().ltab === 'escenas') thumbs(); },
    paint: function (t) {
      var T = A.state();
      if (T.ltab !== 'escenas' || !E.el || T.drag) return;
      if (sig() !== E.sig) draw(); else mark(t);
    },
    onClick: function (b) {
      var T = A.state(), k = b.dataset.k;
      var it = b.dataset.id && T.L.filter(function (x) { return x.s._id === b.dataset.id; })[0];
      if (k === 'go') {
        A.stop();
        if (!it.s.off) { A.seek(it.t0); reveal(it.t0); }
        A.select({ type: 'seg', id: it.s._id });
      } else if (k === 'play') zone(it.t0, it.t0 + it.dur);
      else if (k === 'playg') {
        var ok = E.groups[+b.dataset.g].items.filter(function (x) { return !x.it.s.off; }), z = ok[ok.length - 1].it;
        zone(ok[0].it.t0, z.t0 + z.dur);
      } else if (k === 'nozone') { T.inP = T.outP = null; A.redraw(); }
      else if (k === 'fx') {
        var i = +b.dataset.i, r = A.fxRange(T.fx[i]);
        A.stop();
        if (r) { A.seek(r[0]); reveal(r[0]); }
        A.select({ type: 'fx', id: i });
      }
    }
  });
})();
