// Módulo "Capas" de la Edición: pestaña del inspector con el árbol de todo lo que hay en el vídeo. Clic elige y salta el cursor,
// doble clic abre Ajustes, el ojo oculta (el mismo T.hidden de la línea de tiempo) y arrastrar reordena (z en estilo.js).
(function () {
  var A, S, ID = 'capaslista';
  var CSS_ = '.cy-q{width:100%;box-sizing:border-box;margin-bottom:8px;user-select:text}.cy-h{display:flex;align-items:center;justify-content:space-between;min-height:20px;font-size:10px;font-weight:600;color:var(--t3);text-transform:uppercase;letter-spacing:.04em;margin:10px 0 3px;padding-right:4px}' +
    '.cy-r{display:flex;align-items:center;gap:5px;height:26px;padding:0 4px;border-radius:6px;color:var(--t2);font-size:11px;cursor:pointer;touch-action:none}.cy-r:hover{background:rgba(255,255,255,.05);color:var(--t1)}' +
    '.cy-r.sel{background:var(--ad);color:var(--a)}.cy-r.now .cy-n{color:var(--t1)}.cy-r.sel.now .cy-n{color:var(--a)}.cy-r.hid .cy-n{opacity:.4;text-decoration:line-through}.cy-n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.cy-g{width:14px;flex:none;text-align:center;color:var(--t3);cursor:grab}.cy-t{width:14px;flex:none;padding:0;border:0;background:none;color:var(--t3);font-size:11px}.cy-t:hover{border:0;color:var(--t1)}.cy-tm{color:var(--t3);font-size:10px;font-variant-numeric:tabular-nums;flex:none}' +
    '.cy-d{height:2px;background:var(--a);margin:-1px 0;border-radius:1px}.cy-r.drag{opacity:.45}.cy-k{font-size:9px;color:var(--t3);flex:none}.cy-e{color:var(--t3);padding:10px 0;font-size:11px}';
  var norm = function (s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); };
  var lab = function (f) { return f.kind === 'el' ? f.label : (A.state().names[f.key] || f.key); };

  function capas() { return A.state().plugins.filter(function (p) { return p.id === 'capas'; })[0]; }
  function audio() { return A.state().plugins.filter(function (p) { return p.id === 'audio'; })[0]; }
  function rows() {                         // lo que hay, en orden: [{sec, rows:[...]}]
    var T = A.state(), layers = window.MiEstilo ? MiEstilo.layers() : [], cp = capas(), secs = [], out = [];
    layers.forEach(function (l) {
      var id = l.target.slice(4);
      if (l.target.indexOf('grp:') === 0) {
        var kids = [];
        T.fx.forEach(function (f, i) {
          if (f.kind !== 'el' || f.libre) return;
          var ln = cp && cp.laneOf(f);
          if (ln && ln.id === id) kids.push({ key: 'fx:' + i, label: lab(f), sel: { type: 'fx', id: i }, r: f.off ? null : A.fxRange(f), offFx: i, off: !!f.off, depth: 1 });
        });
        var plain = (S.groups[id] || []).filter(function (it) { return !it.el; });
        if (plain.length) kids = kids.concat(plain.map(function (it) { return { key: 'it:' + id + ':' + it.from, label: it.label || id, r: [it.from, it.to], sel: { type: 'grp', id: id }, depth: 1 }; }));
        var rs = kids.map(function (k) { return k.r; }).filter(Boolean).sort(function (a, b) { return a[0] - b[0]; });
        out.push({ key: l.target, label: l.label, sel: { type: 'grp', id: id }, r: rs[0] ? [rs[0][0], rs[rs.length - 1][1]] : null, eye: 'el:' + id, target: l.target, kids: kids, depth: 0, kind: 'grupo' });
      } else {
        var i = -1, f;
        T.fx.forEach(function (x, j) { if (x.libre && x.id === id) { i = j; f = x; } });
        if (f) out.push({ key: l.target, label: lab(f), sel: { type: 'fx', id: i }, r: f.off ? null : A.fxRange(f), offFx: i, off: !!f.off, target: l.target, depth: 0, kind: 'libre' });
      }
    });
    secs.push({ sec: 'Capas (delante arriba)', rows: out });
    var fxs = [];
    T.fx.forEach(function (f, i) { if (f.kind === 'fx') fxs.push({ key: 'fx:' + i, label: lab(f), sel: { type: 'fx', id: i }, r: f.off ? null : A.fxRange(f), depth: 0 }); });
    if (fxs.length) secs.push({ sec: 'Efectos', eye: 'fx', rows: fxs });
    var vid = [];
    T.L.forEach(function (it, n) {
      if (it.s.off) return;
      vid.push({ key: 'seg:' + it.s._id, label: (n + 1) + '. ' + (it.s.overlay ? '▣ ' : '') + (it.s.line || it.s.id), sel: { type: 'seg', id: it.s._id }, r: [it.t0, it.t0 + it.dur], depth: 0 });
    });
    secs.push({ sec: 'Vídeo', eye: 'video', rows: vid });
    var au = [], voices = S.stems.length ? S.stems : [{ id: 'voice', label: 'Voz' }];
    voices.forEach(function (s) { au.push({ key: 'aud:' + s.id, label: s.label, sel: { type: 'aud', id: s.id }, depth: 0, stem: s.id }); });
    if (window.MiLibres) MiLibres.list().forEach(function (it) {
      if (it.type !== 'audio') return;
      var j = -1, f;
      T.fx.forEach(function (x, k) { if (x.libre && x.id === it.id) { j = k; f = x; } });
      if (f) au.push({ key: 'lib:' + it.id, label: it.label, sel: { type: 'fx', id: j }, r: f.off ? null : A.fxRange(f), offFx: j, off: !!f.off, depth: 0 });
    });
    secs.push({ sec: 'Audio', rows: au });
    return secs;
  }
  function isSel(sel) { var s = A.state().sel; return !!(s && sel && s.type === sel.type && String(s.id) === String(sel.id)); }
  function muted(id) { var a = audio(), d = a && a.data && a.data(); return !!(d && d[id] != null && d[id] <= -60); }
  function eyeBtn(k, off) { return '<button class="tl-eye' + (off ? ' off' : '') + '" data-eye="' + A.esc(k) + '" title="' + (off ? 'Mostrar' : 'Ocultar') + '">' + A.ic(off ? 'eyeoff' : 'eye', 13) + '</button>'; }
  function offBtn(i, off) { return '<button class="tl-eye' + (off ? ' off' : '') + '" data-p="' + ID + '" data-a="off" data-i="' + i + '" title="' + (off ? 'Volver a ponerla' : 'Ocultarla') + '">' + A.ic(off ? 'eyeoff' : 'eye', 13) + '</button>'; }
  function rowHtml(r, q) {
    var T = A.state(), hid = r.off || (r.eye && T.hidden[r.eye]), eye = '', tw = '';
    if (r.eye) eye = eyeBtn(r.eye, T.hidden[r.eye]);
    else if (r.offFx != null) eye = offBtn(r.offFx, r.off);
    else if (r.stem && audio()) { var m = muted(r.stem); hid = m; eye = '<button class="tl-eye' + (m ? ' off' : '') + '" data-p="' + ID + '" data-a="mute" data-id="' + A.esc(r.stem) + '" title="' + (m ? 'Activar' : 'Silenciar') + '">' + A.ic(m ? 'mute' : 'vol', 13) + '</button>'; }
    var open = r.kids && r.kids.length;
    if (open) tw = '<button class="cy-t" data-p="' + ID + '" data-a="tw" data-k="' + A.esc(r.key) + '">' + (S.open[r.key] || q ? '▾' : '▸') + '</button>';
    else tw = '<span class="cy-t"></span>';
    return '<div class="cy-r' + (isSel(r.sel) ? ' sel' : '') + (hid ? ' hid' : '') + '" data-key="' + A.esc(r.key) + '"' + (r.target ? ' data-target="' + A.esc(r.target) + '"' : '') + (r.r ? ' data-a0="' + r.r[0] + '" data-a1="' + r.r[1] + '"' : '') + ' style="padding-left:' + (4 + r.depth * 14) + 'px">' +
      (r.target ? '<span class="cy-g" title="Arrastra para cambiar el orden">⠿</span>' : '') + tw +
      '<span class="cy-n" title="' + A.esc(r.label) + '">' + A.esc(r.label) + '</span>' + (r.kind === 'libre' ? '<span class="cy-k">libre</span>' : '') + (r.r ? '<span class="cy-tm">' + A.fmtS(r.r[0]) + '</span>' : '') + eye + '</div>';
  }
  function listHtml() {
    var q = norm(S.q), html = '';
    S.map = {};
    rows().forEach(function (sec) {
      var body = '';
      sec.rows.forEach(function (r) {
        S.map[r.key] = r;
        var kids = r.kids || [], hitKids = q ? kids.filter(function (k) { return norm(k.label).indexOf(q) >= 0; }) : kids;
        if (q && norm(r.label).indexOf(q) < 0 && !hitKids.length) return;
        body += rowHtml(r, q);
        kids.forEach(function (k) { S.map[k.key] = k; });
        if (q ? hitKids.length : S.open[r.key]) hitKids.forEach(function (k) { body += rowHtml(k, q); });
      });
      if (body) html += '<div class="cy-h"><span>' + A.esc(sec.sec) + '</span>' + (sec.eye ? eyeBtn(sec.eye, A.state().hidden[sec.eye]) : '') + '</div>' + body;
    });
    return html || '<div class="cy-e">Nada coincide con la búsqueda.</div>';
  }
  function paintList(el) {
    var box = el || A.state().el.insp, list = box.querySelector('.cy-list');
    if (list) { list.innerHTML = listHtml(); now(); }
  }
  function now() {                          // lo que se ve en este segundo, marcado
    var T = A.state(), t = T.t;
    if (T.rtab !== ID) return;
    T.el.insp.querySelectorAll('.cy-r[data-a0]').forEach(function (d) { d.classList.toggle('now', t >= +d.dataset.a0 && t < +d.dataset.a1); });
  }

  function pick(key, open) {
    var r = S.map[key], T = A.state();
    if (!r) return;
    A.stop();
    A.select(r.sel);
    if (!open) A.showRight(ID);
    if (r.r && (T.t < r.r[0] || T.t >= r.r[1])) A.seek(r.r[0]);
  }
  function reorder(e, row) {
    var T = A.state(), tg = row.dataset.target, y0 = e.clientY, moved = false, line = null, to = null;
    e.preventDefault();
    var cand = [].slice.call(T.el.insp.querySelectorAll('.cy-r[data-target]'));
    function mv(ev) {
      if (!moved && Math.abs(ev.clientY - y0) < 4) return;
      moved = true;
      row.classList.add('drag');
      if (!line) { line = document.createElement('div'); line.className = 'cy-d'; }
      to = cand.length;
      for (var i = 0; i < cand.length; i++) {
        var b = cand[i].getBoundingClientRect();
        if (ev.clientY < b.top + b.height / 2) { to = i; break; }
      }
      if (to < cand.length) cand[to].parentNode.insertBefore(line, cand[to]);
      else { var lastR = cand[cand.length - 1]; lastR.parentNode.insertBefore(line, lastR.nextSibling); }
    }
    function up() {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (line) line.remove();
      row.classList.remove('drag');
      if (!moved) return;
      var list = cand.map(function (d) { return d.dataset.target; }), from = list.indexOf(tg);
      if (to > from) to--;
      if (to === from) return;
      A.remember();
      list.splice(from, 1); list.splice(to, 0, tg);
      var n = list.length;
      list.forEach(function (x, i) { MiEstilo.setZ(x, n - i); });     // de delante a atrás
      paintList();
    }
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  Timeline.use({
    id: 'capaslista',
    right: { id: ID, label: 'Capas', count: function () { return S ? total() : ''; } },
    init: function (api) {
      A = api;
      S = { q: '', open: {}, map: {}, stems: [], groups: {}, last: 0 };
      var st = document.createElement('style'); st.textContent = CSS_; document.head.appendChild(st);
      A.api('/api/edicion').then(function (d) {                  // los nombres de las pistas y los items que no tienen bloque en la línea
        S.stems = ((d.audio || {}).input || {}).stems || [];
        (((d.capas || {}).input || {}).groups || []).forEach(function (g) { S.groups[g.id] = g.items || []; });
        if (A.state().rtab === ID) paintList();
      }).catch(function () {});
      var insp = A.state().el.insp;
      insp.addEventListener('pointerdown', function (e) {
        if (!insp.querySelector('.cy-root')) return;
        var g = e.target.closest('.cy-g'), r = e.target.closest('.cy-r');
        if (g && r && r.dataset.target) reorder(e, r);
      });
      insp.addEventListener('click', function (e) {
        if (!insp.querySelector('.cy-root') || e.target.closest('button,.cy-g')) return;
        var r = e.target.closest('.cy-r');
        if (r) pick(r.dataset.key);
      });
      insp.addEventListener('dblclick', function (e) {
        if (!insp.querySelector('.cy-root') || e.target.closest('button,.cy-g')) return;
        var r = e.target.closest('.cy-r');
        if (r) pick(r.dataset.key, true);
      });
      return true;
    },
    rightRender: function (el) {
      if (!el.querySelector('.cy-root')) {
        el.innerHTML = '<div class="cy-root"><input class="st-in cy-q" type="search" placeholder="Buscar capa, efecto, frase..." data-keep="1" data-p="' + ID + '" data-k="q" value="' + A.esc(S.q) + '"><div class="cy-list"></div></div>';
      }
      paintList(el);
    },
    paint: function () { if (Date.now() - S.last > 150) { S.last = Date.now(); now(); } },
    onClick: function (b) {
      var a = b.dataset.a, T = A.state();
      if (a === 'tw') { S.open[b.dataset.k] = !S.open[b.dataset.k]; paintList(); return; }
      if (a === 'off') {
        var f = T.fx[+b.dataset.i];
        A.remember();
        f.off = !f.off;
        A.touched(f.libre ? 'libres' : 'pistas');
        A.redraw();
        A.showRight(ID);
        return;
      }
      if (a === 'mute') {
        var p = audio();
        if (p) p.onClick({ dataset: { b: 'mute', id: b.dataset.id } });
        A.showRight(ID);
      }
    },
    onInput: function (el) { if (el.dataset.k === 'q') { S.q = el.value; paintList(); } },
    helpExtra: function () { return '<b>Capas:</b> la pestaña Capas lista todo lo que hay. Clic elige y salta el cursor, doble clic abre Ajustes, el ojo oculta y el asa ⠿ reordena.<br>'; }
  });
  function total() { return (window.MiEstilo ? MiEstilo.layers().length : 0) + A.state().fx.filter(function (f) { return f.kind === 'fx'; }).length; }
})();
