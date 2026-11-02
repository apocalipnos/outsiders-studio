// Módulo "Guion" de la Edición (el Storyboard de HyperFrames Studio): una tarjeta por fragmento con su miniatura, frase y
// comentarios; arrastrar la miniatura cambia el orden del montaje. guion_edit.json: {"comments": {"<id edl>": [{text, done}]}, "order": null}
(function () {
  var A, G = { c: {}, el: null, sig: '', drag: null };
  var CSS = '.gu-top{display:flex;align-items:center;gap:10px;padding:9px 12px;margin-bottom:12px;background:var(--card2);border:1px solid var(--b0);border-radius:8px}.gu-top div{flex:1;min-width:0;font-size:11px;color:var(--t3);line-height:1.45}.gu-top b{display:block;color:var(--t1);font-size:12px;font-weight:600}.gu-top button{flex:none}.gu-top .pr{background:var(--a);color:#09090b;border:0;font-weight:600}.gu-top .pr:disabled{background:var(--b1);color:var(--t3)}' +
    '.gu-g{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));gap:10px;align-items:start}' +
    '.gu-c{display:flex;gap:9px;padding:7px;background:var(--card2);border:1px solid var(--b0);border-radius:8px;position:relative}.gu-c:hover{border-color:var(--b2)}.gu-c.off .gu-th,.gu-c.off .gu-q{opacity:.4}.gu-c.drag{opacity:.45}.gu-c.bf::before,.gu-c.af::before{content:"";position:absolute;top:0;bottom:0;width:3px;background:var(--a);border-radius:2px}.gu-c.bf::before{left:-7px}.gu-c.af::before{right:-7px}' +
    '.gu-th{position:relative;width:72px;height:128px;flex:none;background:#000;border-radius:5px;overflow:hidden;cursor:grab;touch-action:none}.gu-th canvas{width:100%;height:100%;display:block}.gu-no{position:absolute;left:4px;top:4px;min-width:18px;padding:0 4px;text-align:center;font-size:10px;font-weight:600;background:rgba(0,0,0,.7);border-radius:4px;color:#fff}' +
    '.gu-b{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}.gu-m{display:flex;gap:6px;flex-wrap:wrap;font-size:10px;color:var(--t3);font-variant-numeric:tabular-nums}.gu-st{padding:0 5px;border-radius:3px;background:rgba(245,158,11,.14);color:#fbbf24}.gu-st.c{background:var(--ad);color:var(--a)}.gu-q{font-size:11.5px;line-height:1.4;color:var(--t1);user-select:text}' +
    '.gu-cm{display:flex;gap:4px;align-items:flex-start;font-size:10.5px;color:var(--t2);line-height:1.35}.gu-cm input{margin:1px 0 0;accent-color:var(--a);flex:none}.gu-cm span{flex:1;min-width:0;word-break:break-word;user-select:text}.gu-cm.done span{text-decoration:line-through;color:var(--t3)}.gu-cm button{padding:0 4px;border:0;background:none;color:var(--t3);font-size:11px;flex:none}.gu-cm button:hover{color:#fca5a5}' +
    '.gu-add{display:flex;gap:3px;margin-top:auto}.gu-add .st-in{flex:1;min-width:0}.gu-add button,.gu-a button{padding:2px 7px;font-size:10.5px;flex:none}.gu-a{display:flex;gap:3px}';

  function sp(s) { return s.overlay ? 1 : (s.speed || 1); }
  function list(id) { return G.c[id] || []; }
  function pending(id) { return list(id).filter(function (x) { return !x.done; }); }
  function thumb(cv, s) {                    // el fotograma medio del fragmento, sacado de la tira de miniaturas
    var st = A.state().strips[s.clip];
    if (!st || !st.img) return;
    var i = A.clamp(Math.floor((s.in + s.out) / 2 / st.step), 0, st.n - 1);
    cv.getContext('2d').drawImage(st.img, (i % st.cols) * st.tw, Math.floor(i / st.cols) * st.th, st.tw, st.th, 0, 0, cv.width, cv.height);
  }
  function thumbs() {
    if (!G.el) return;
    var T = A.state();
    G.el.querySelectorAll('.gu-th canvas').forEach(function (cv) {
      var s = T.segs.filter(function (x) { return x._id === cv.dataset.id; })[0];
      if (s) thumb(cv, s);
    });
  }
  function card(it, n) {
    var s = it.s, cs = list(s.id), p = pending(s.id).length, id = s._id;
    return '<div class="gu-c' + (s.off ? ' off' : '') + '" data-id="' + id + '"><div class="gu-th" title="Arrastra para cambiar el orden"><canvas width="108" height="192" data-id="' + id + '"></canvas><span class="gu-no">' + n + '</span></div><div class="gu-b">' +
      '<div class="gu-m"><span>' + A.fmtS(it.t0) + '</span><span>' + ((s.out - s.in) / sp(s)).toFixed(2).replace('.', ',') + ' s</span>' + (s.off ? '<span class="gu-st">Quitado</span>' : '') + (cs.length ? '<span class="gu-st c">' + (p ? p + (p === 1 ? ' comentario' : ' comentarios') : 'Comentarios hechos') + '</span>' : '') + '</div>' +
      '<div class="gu-q">' + A.esc(s.line || s.id) + '</div>' +
      cs.map(function (c, i) {
        return '<div class="gu-cm' + (c.done ? ' done' : '') + '"><input type="checkbox" title="Marcar hecho" data-p="guion" data-k="done" data-id="' + A.esc(s.id) + '" data-i="' + i + '"' + (c.done ? ' checked' : '') + '><span>' + A.esc(c.text) + '</span><button data-p="guion" data-k="del" data-id="' + A.esc(s.id) + '" data-i="' + i + '" title="Quitar comentario">×</button></div>';
      }).join('') +
      '<div class="gu-add"><input class="st-in gu-new" data-sid="' + A.esc(s.id) + '" placeholder="Añadir comentario…"><button data-p="guion" data-k="add" data-id="' + A.esc(s.id) + '">+</button></div>' +
      (s.off ? '' : '<div class="gu-a"><button data-p="guion" data-k="play" data-id="' + id + '">▶ Reproducir desde aquí</button></div>') + '</div></div>';
  }
  function sig() {
    var T = A.state();
    return T.segs.map(function (s) { return s._id + (s.off ? 'x' : '') + s.in + ':' + s.out; }).join() + JSON.stringify(G.c);
  }
  function draw() {
    var el = G.el;
    if (!el) return;
    var T = A.state(), ids = Object.keys(G.c).filter(function (k) { return pending(k).length; });
    var tot = ids.reduce(function (a, k) { return a + pending(k).length; }, 0), top = el.scrollTop;
    el.innerHTML = '<div class="gu-root"><div class="gu-top"><div><b>Pedirle a Claude</b>' + (tot ? tot + (tot === 1 ? ' comentario pendiente' : ' comentarios pendientes') + ' en ' + ids.length + (ids.length === 1 ? ' fragmento.' : ' fragmentos.') : 'Sin comentarios pendientes. Escribe en una tarjeta lo que quieres cambiar.') + ' Al pulsar Procesar vídeo también le llegan.</div>' +
      '<button class="pr" data-p="guion" data-k="prompt"' + (tot ? '' : ' disabled') + '>Copiar texto para Claude</button></div><div class="gu-g">' + T.L.map(function (it, i) { return card(it, i + 1); }).join('') + '</div></div>';
    el.scrollTop = top;
    G.sig = sig();
    thumbs();
  }
  function prompt() {
    var T = A.state(), lines = [];
    T.L.forEach(function (it, i) {
      var p = pending(it.s.id);
      if (!p.length) return;
      lines.push('- Fragmento ' + (i + 1) + ' (id "' + it.s.id + '", segundo ' + A.fmtS(it.t0) + ', "' + (it.s.line || '') + '"):');
      p.forEach(function (c) { lines.push('  * ' + c.text); });
    });
    return 'Comentarios pendientes sobre el guion del vídeo "' + T.project.name + '" en Mi Estudio. El id es el del fragmento en edl.json.\n\n' + lines.join('\n') + '\n\nAplícalos en los JSON del proyecto (nunca a mano en index.html) y dime qué has cambiado.';
  }
  function copy(txt, msg) {
    var ok = function () { A.toast(msg || 'Copiado'); };
    var old = function () {
      var t = document.createElement('textarea');
      t.value = txt; t.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(t); t.select();
      try { document.execCommand('copy'); ok(); } catch (e) { A.toast('No se pudo copiar', true); }
      t.remove();
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, old); else old();
  }
  function addComment(sid, input) {
    var text = input.value.trim();
    if (!text) return;
    A.remember();
    (G.c[sid] = G.c[sid] || []).push({ text: text, done: false });
    A.touched('guion');
    draw();
    var again = G.el.querySelector('.gu-new[data-sid="' + sid.replace(/"/g, '\\"') + '"]');
    if (again) again.focus();
  }
  function clearMarks() { G.el.querySelectorAll('.gu-c.bf,.gu-c.af').forEach(function (n) { n.classList.remove('bf', 'af'); }); }
  function dragCard(th, e) {                 // arrastrar la miniatura; el orden se cambia al soltar, como en la línea de tiempo
    var T = A.state(), c = th.closest('.gu-c'), id = c.dataset.id, sx = e.clientX, sy = e.clientY, on = false, to = null;
    e.preventDefault();
    function mv(ev) {
      if (!on) {
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 6) return;
        on = true; c.classList.add('drag');
      }
      clearMarks();
      var el = document.elementFromPoint(ev.clientX, ev.clientY), o = el && el.closest('.gu-c');
      to = null;
      if (o && o !== c) {
        var r = o.getBoundingClientRect(), before = ev.clientX < r.left + r.width / 2;
        o.classList.add(before ? 'bf' : 'af');
        to = { id: o.dataset.id, before: before };
      }
    }
    function up() {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      c.classList.remove('drag'); clearMarks();
      if (!on || !to) return;
      var s = T.segs.filter(function (x) { return x._id === id; })[0], other = T.segs.filter(function (x) { return x._id === to.id; })[0];
      A.stop();
      A.remember();
      T.segs.splice(T.segs.indexOf(s), 1);
      T.segs.splice(T.segs.indexOf(other) + (to.before ? 0 : 1), 0, s);
      A.redraw();
      A.seek(T.t);
      A.touched('guion');
      draw();
    }
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  Timeline.use({
    id: 'guion',
    view: { id: 'guion', label: 'Guion' },
    init: function (api, input, saved) {
      A = api;
      var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
      if (saved && saved.comments) G.c = saved.comments;
      return true;
    },
    viewRender: function (el) {
      if (G.el !== el) {
        G.el = el;
        el.addEventListener('pointerdown', function (e) {
          var th = e.target.closest('.gu-th');
          if (th && e.button === 0 && el.querySelector('.gu-root')) dragCard(th, e);
        });
        el.addEventListener('keydown', function (e) {
          if (e.key === 'Enter' && e.target.classList.contains('gu-new')) addComment(e.target.dataset.sid, e.target);
        });
      }
      draw();
    },
    onStrip: function () { if (G.el && !G.el.hidden) thumbs(); },
    paint: function () {                     // deshacer o cortar en otro sitio también tiene que verse aquí
      if (!G.el || G.el.hidden || A.state().drag) return;
      var ae = document.activeElement;
      if (G.el.contains(ae) && ae.tagName === 'INPUT') return;
      if (sig() !== G.sig) draw();
    },
    onClick: function (b) {
      var k = b.dataset.k, T = A.state();
      if (k === 'prompt') copy(prompt(), 'Texto copiado');
      else if (k === 'add') addComment(b.dataset.id, b.parentNode.querySelector('.gu-new'));
      else if (k === 'del') {
        A.remember();
        G.c[b.dataset.id].splice(+b.dataset.i, 1);
        if (!G.c[b.dataset.id].length) delete G.c[b.dataset.id];
        A.touched('guion');
        draw();
      } else if (k === 'play') {
        var it = T.L.filter(function (x) { return x.s._id === b.dataset.id; })[0], tab = document.querySelector('#tabs [data-view="edit"]');
        if (tab) tab.click(); else Timeline.setView('edit');
        A.stop();
        A.seek(it.t0);
        T.endAt = null;
        A.play();
      }
    },
    onChange: function (el) {
      if (el.dataset.k !== 'done') return;
      A.remember();
      G.c[el.dataset.id][+el.dataset.i].done = el.checked;
      A.touched('guion');
      draw();
    },
    snap: function () { return { c: JSON.parse(JSON.stringify(G.c)) }; },
    restore: function (o) { G.c = o.c || {}; },
    data: function () { return { comments: JSON.parse(JSON.stringify(G.c)), order: null }; }
  });
})();
