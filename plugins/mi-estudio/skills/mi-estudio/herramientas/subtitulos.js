// Módulo "Subtítulos" de la Edición: una pista con una caja por palabra de words.json (se arrastra, se estira, doble clic edita)
// y el panel "Editar subtítulos" para corregir de corrido, buscar y reemplazar. start/end son segundos del montaje guardado; cada
// palabra se ancla a su momento del clip, así sigue a los cortes. subtitulos_edit.json: {"words": [{text, start, end}]}, solo si cambió.
(function () {
  var A, U = { words: [], rg: [], orig: '', group: null, q: '', r: '', lastMem: 0, cur: -1, live: null, liveK: '', fsel: '', ready: false };
  var MIN = 1 / 30, CHUNK = 4;
  var sp = function (s) { return s.overlay ? 1 : (s.speed || 1); };
  var r3 = function (v) { return Math.round(v * 1000) / 1000; };
  var CSS = '.sb-tk{background:rgba(96,165,250,.03)}.sb-w{position:absolute;top:3px;height:24px;line-height:22px;padding:0 3px;font-size:10px;color:#dbeafe;white-space:nowrap;overflow:hidden;background:rgba(96,165,250,.18);border:1px solid rgba(96,165,250,.55);border-radius:4px;cursor:grab;box-sizing:border-box}.sb-w:hover{border-color:#93c5fd}.sb-w.sel{border-color:#fff;box-shadow:0 0 0 1px #fff;z-index:2}.sb-w span{pointer-events:none}' +
    '.sb-h{position:absolute;top:0;bottom:0;width:5px;cursor:ew-resize}.sb-h.l{left:0}.sb-h.r{right:0}.sb-w:hover .sb-h,.sb-w.sel .sb-h{background:rgba(147,197,253,.55)}' +
    '.sb-list{display:flex;flex-wrap:wrap;gap:3px;max-height:320px;overflow:auto;padding:6px;background:var(--card2);border:1px solid var(--b0);border-radius:7px}.sb-i{width:auto;min-width:18px;padding:1px 3px;font:inherit;font-size:11px;color:var(--t1);background:transparent;border:1px solid transparent;border-radius:3px;user-select:text;box-sizing:content-box}.sb-i:hover{border-color:var(--b1)}.sb-i:focus{outline:0;border-color:var(--a);background:var(--bg)}.sb-i.cur{background:rgba(96,165,250,.2)}.sb-i.hit{background:rgba(251,191,36,.25)}' +
    '.sb-fr{display:flex;gap:4px;margin:0 0 6px;align-items:center;flex-wrap:wrap}.sb-fr .st-in{flex:1;min-width:80px}.sb-fr button{padding:3px 7px;font-size:11px;flex:none}.sb-cnt{font-size:10.5px;color:var(--t3);min-width:54px}.sb-num{width:70px}.sb-txt{flex:1;min-width:100px}' +
    '.sb-live{position:absolute;left:70px;right:70px;top:1140px;z-index:20;text-align:center;font:800 70px/1.15 system-ui,sans-serif;color:#fff;text-shadow:0 3px 14px rgba(0,0,0,.85);pointer-events:none}.sb-live b{color:var(--a);font-weight:800}.sb-pop{width:220px;user-select:text}';

  // ---------- tiempos ----------
  function anchors() {                       // de segundos del montaje guardado a un momento del clip
    var t = 0, map = A.state().project.edl.map(function (s) { var d = (s.out - s.in) / sp(s), m = { t0: t, t1: t + d, s: s }; t += d; return m; });
    U.words.forEach(function (w) {
      var m = map.filter(function (x) { return w.start >= x.t0 - 1e-3 && w.start < x.t1; })[0];
      w._a = m ? { clip: m.s.clip, src: m.s.in + Math.max(0, w.start - m.t0) * sp(m.s), len: (w.end - w.start) * sp(m.s) } : null;
    });
  }
  function calc() {                          // U.rg[i] = [de, a] en segundos del montaje de ahora; null si su trozo está quitado
    var L = A.state().L.filter(function (it) { return !it.s.off; });
    U.rg = U.words.map(function (w) {
      var a = w._a;
      if (!a) return [w.start, w.end];
      for (var i = 0; i < L.length; i++) {
        var s = L[i].s;
        if (s.clip === a.clip && a.src >= s.in - 1e-3 && a.src < s.out) { var t = L[i].t0 + Math.max(0, a.src - s.in) / sp(s); return [t, t + a.len / sp(s)]; }
      }
      return null;
    });
  }
  function setR(i, a, b) {                   // la palabra pasa a ir de a a b (segundos del montaje de ahora)
    var an = A.anchor(a), s = A.state().segs.filter(function (x) { return x._id === an.seg; })[0];
    U.words[i]._a = { clip: s.clip, src: an.src, len: (b - a) * sp(s) };
    U.rg[i] = [a, b];
  }
  function prevEnd(i) { for (var j = i - 1; j >= 0; j--) if (U.rg[j]) return U.rg[j][1]; return 0; }
  function nextStart(i) { for (var j = i + 1; j < U.rg.length; j++) if (U.rg[j]) return U.rg[j][0]; return A.state().total; }
  function wordAt(t) { for (var i = U.rg.length - 1; i >= 0; i--) if (U.rg[i] && t >= U.rg[i][0] - 1e-3 && t < U.rg[i][1]) return i; return -1; }   // en el borde justo, la que empieza
  function hidden() { return A.isHidden('subs'); }

  // ---------- la pista ----------
  function boxHtml(i) {
    var r = U.rg[i], T = A.state(), x0 = A.timeToX(r[0]), x1 = A.timeToX(r[1]), sel = T.sel && T.sel.type === 'word' && T.sel.id === i;
    return '<div class="sb-w' + (sel ? ' sel' : '') + '" data-keep-drag="1" data-w="' + i + '" style="left:' + x0 + 'px;width:' + Math.max(3, x1 - x0) + 'px" title="' + A.esc(U.words[i].text) + '"><span>' + A.esc(U.words[i].text) + '</span><i class="sb-h l"></i><i class="sb-h r"></i></div>';
  }
  function place(i) {
    var b = A.state().el.rows.querySelector('.sb-w[data-w="' + i + '"]'), r = U.rg[i];
    if (!b || !r) return;
    var x0 = A.timeToX(r[0]), x1 = A.timeToX(r[1]);
    b.style.left = x0 + 'px'; b.style.width = Math.max(3, x1 - x0) + 'px';
  }
  function guide() {
    var T = A.state();
    T.el.guide.style.display = T.guide == null ? 'none' : 'block';
    if (T.guide != null) T.el.guide.style.left = (A.LW + A.timeToX(T.guide)) + 'px';
  }
  function down(e) {
    var box = e.target.closest && e.target.closest('.sb-w');
    if (!box || e.button !== 0) return;
    var T = A.state(), i = +box.dataset.w, r = U.rg[i];
    if (!r) return;
    var h = e.target.closest('.sb-h'), kind = h ? (h.classList.contains('l') ? 'l' : 'r') : 'm', x0 = e.clientX, moved = false, a0 = r[0], b0 = r[1];
    var lo = Math.min(prevEnd(i), a0), hi = Math.max(nextStart(i), b0), now = Date.now(), twice = U.last && U.last.i === i && now - U.last.t < 400;
    U.last = { i: i, t: now };
    A.select({ type: 'word', id: i });
    function mv(ev) {
      var dt = (ev.clientX - x0) / T.pps;
      if (!moved && Math.abs(ev.clientX - x0) < 3) return;
      if (!moved) { A.remember(); moved = true; }
      var a = a0, b = b0;
      if (kind === 'm') { a = A.clamp(A.snapTime(a0 + dt), lo, Math.max(lo, hi - (b0 - a0))); b = a + (b0 - a0); }
      else if (kind === 'l') a = A.clamp(A.snapTime(a0 + dt), lo, b0 - MIN);
      else b = A.clamp(A.snapTime(b0 + dt), a0 + MIN, hi);
      setR(i, a, b);
      place(i); guide();
    }
    function up() {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      T.guide = null; guide();
      if (moved) { A.touched('subtitulos'); A.redraw(); A.seek(T.t); return; }
      A.seek(a0);
      if (twice) { U.last = null; setTimeout(function () { editWord(i); }, 30); }   // tras el clic, que cerraría la ventanita
    }
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  function editWord(i) {                     // doble clic a mano: cada clic repinta la pista y el dblclick del navegador no llega a la caja
    var box = A.state().el.rows.querySelector('.sb-w[data-w="' + i + '"]');
    if (!box) return;
    var p = A.popup('<h4>Palabra ' + (i + 1) + '</h4><input class="st-in sb-pop" data-p="subtitulos" data-k="t" data-i="' + i + '" data-keep="1" value="' + A.esc(U.words[i].text) + '">', box), inp = p.querySelector('input');
    inp.focus(); inp.select();
    inp.addEventListener('keydown', function (ev) { ev.stopPropagation(); if (ev.key === 'Enter' || ev.key === 'Escape') A.closePopup(); });
  }

  // ---------- el panel ----------
  function setText(i, txt, from) {
    if (Date.now() - U.lastMem > 800) A.remember();
    U.lastMem = Date.now();
    U.words[i].text = txt;
    A.touched('subtitulos');
    var T = A.state(), b = T.el.rows.querySelector('.sb-w[data-w="' + i + '"]');
    if (b) { b.firstChild.textContent = txt; b.title = txt; }
    T.el.insp.querySelectorAll('.sb-i[data-i="' + i + '"]').forEach(function (n) { if (n !== from) n.value = txt; sizeI(n); });
    U.liveK = ''; paintLive(T.t);
  }
  function sizeI(n) { n.size = Math.max(1, n.value.length); }
  function list() {
    return '<div class="sb-list">' + U.words.map(function (w, i) {
      return '<input class="sb-i' + (i === U.cur ? ' cur' : '') + (hit(w) ? ' hit' : '') + '" data-p="subtitulos" data-k="t" data-i="' + i + '" data-keep="1" size="' + Math.max(1, w.text.length) + '" value="' + A.esc(w.text) + '"' + (U.rg[i] ? '' : ' title="Su trozo está quitado del montaje"') + '>';
    }).join('') + '</div>';
  }
  function hit(w) { return U.q && w.text.toLowerCase().indexOf(U.q.toLowerCase()) >= 0; }
  function nHits() { return U.words.filter(hit).length; }
  function editor() {
    return A.section('sb-edit', 'Editar subtítulos',
      '<div class="sb-fr"><input class="st-in" data-p="subtitulos" data-k="q" data-keep="1" placeholder="Buscar…" value="' + A.esc(U.q) + '"><span class="sb-cnt">' + (U.q ? nHits() + ' palabras' : '') + '</span></div>' +
      '<div class="sb-fr"><input class="st-in" data-p="subtitulos" data-k="r" data-keep="1" placeholder="Reemplazar por…" value="' + A.esc(U.r) + '"><button data-p="subtitulos" data-k="rep1">Reemplazar</button><button data-p="subtitulos" data-k="repall">Todas</button></div>' +
      list() + '<div class="help" style="margin-top:6px">Corrige de corrido: Intro pasa a la palabra siguiente. Una palabra vacía se quita. Va a words.json al pulsar Procesar vídeo.</div>');
  }
  function replaceIn(w) {
    var re = new RegExp(U.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    w.text = w.text.replace(re, function () { return U.r; });
  }
  function refreshAfterFocus() {             // repinta al soltar si la selección cambió con el campo enfocado (data-keep lo impedía)
    var go = function () {
      removeEventListener('pointerup', go, true);
      setTimeout(function () { if (JSON.stringify(A.state().sel) !== U.fsel) A.refresh(); }, 60);
    };
    addEventListener('pointerup', go, true);
  }

  // ---------- vista previa, si el proyecto no tiene grupo de subtítulos en Capas ----------
  function paintLive(t) {
    var T = A.state();
    if (U.group !== false || !U.ready) return;
    if (!U.live) { U.live = document.createElement('div'); U.live.className = 'sb-live'; T.el.ov.appendChild(U.live); }
    var i = hidden() ? -1 : wordAt(t);
    U.live.hidden = i < 0;
    if (i < 0) return;
    var c = Math.floor(i / CHUNK), k = c + ':' + i;
    if (k === U.liveK) return;
    U.liveK = k;
    var html = [];
    for (var j = c * CHUNK; j < Math.min(U.words.length, (c + 1) * CHUNK); j++) if (U.rg[j]) html.push(j === i ? '<b>' + A.esc(U.words[j].text) + '</b>' : A.esc(U.words[j].text));
    U.live.innerHTML = html.join(' ');
  }
  function syncHidden() {                    // con grupo en Capas, el ojo de esta pista oculta ese grupo
    if (U.group) A.state().hidden['el:' + U.group] = hidden();
  }

  Timeline.use({
    id: 'subtitulos', owns: ['word', 'subs'],
    init: function (api, input, saved) {
      A = api;
      var T = A.state();
      var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
      T.el.inner.addEventListener('pointerdown', down);
      T.el.insp.addEventListener('focusin', function (e) {
        if (e.target.dataset && e.target.dataset.p === 'subtitulos') U.fsel = JSON.stringify(A.state().sel);
        if (e.target.classList && e.target.classList.contains('sb-i')) { var r = U.rg[+e.target.dataset.i]; if (r) { A.stop(); A.seek(r[0]); } }
      });
      T.el.insp.addEventListener('focusout', function (e) {
        if (e.target.dataset && e.target.dataset.p === 'subtitulos' && !(e.relatedTarget && e.relatedTarget.dataset && e.relatedTarget.dataset.p === 'subtitulos')) refreshAfterFocus();
      });
      T.el.insp.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('sb-i')) {
          var n = e.target.parentNode.querySelector('.sb-i[data-i="' + (+e.target.dataset.i + 1) + '"]');
          if (n) { n.focus(); n.select(); }
        }
      });
      A.api('/api/edicion').then(function (d) {   // ¿hay un grupo de subtítulos en capas.json? Entonces lo pinta Capas
        var gs = ((d.capas || {}).input || {}).groups || [], g = gs.filter(function (x) { return x.words === true || x.id === 'subs'; })[0];
        U.group = g ? g.id : false;
      }).catch(function () { U.group = false; }).then(function () {
        return fetch('/p/words.json', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; });
      }).then(function (w) {
        var unsaved = saved && Array.isArray(saved.words) ? saved.words : null;   // lo que quedó de un render sin procesar
        U.words = (unsaved || (Array.isArray(w) ? w : [])).map(function (x) { return { text: String(x.text), start: +x.start, end: +x.end }; });
        U.orig = JSON.stringify((Array.isArray(w) ? w : []).map(function (x) { return [String(x.text), r3(+x.start), r3(+x.end)]; }));
        anchors();
        U.ready = true;
        if (unsaved) A.touched('subtitulos');
        calc(); syncHidden();
        A.redraw();
      });
      return true;
    },
    lanes: function () {
      if (!U.words.length) return '';
      calc();
      var T = A.state(), off = hidden(), body = '';
      U.words.forEach(function (w, i) { if (U.rg[i]) body += boxHtml(i); });
      return '<div class="tl-lane' + (off ? ' hid' : '') + '"><div class="tl-lab" data-pick="subs" data-id="all" style="height:30px"><span class="n">Subtítulos</span><button class="tl-eye' + (off ? ' off' : '') + '" data-eye="subs" title="' + (off ? 'Mostrar pista' : 'Ocultar pista') + '">' + A.ic(off ? 'eyeoff' : 'eye', 13) + '</button></div>' +
        '<div class="tl-track sb-tk" style="width:' + (T.width + 60) + 'px;height:30px">' + body + '</div></div>';
    },
    inspector: function (sel) {
      if (sel.type === 'word') {
        var w = U.words[sel.id], r = U.rg[sel.id];
        if (!w) return '';
        return '<h3>Palabra ' + (sel.id + 1) + ' de ' + U.words.length + '</h3><div class="q">“' + A.esc(w.text) + '”' + (r ? '' : ' · su trozo está quitado') + '</div>' +
          A.section('sb-word', 'Palabra',
            '<div class="tl-row"><label>Texto</label><input class="st-in sb-txt sb-i0" data-p="subtitulos" data-k="t" data-i="' + sel.id + '" data-keep="1" value="' + A.esc(w.text) + '"></div>' +
            (r ? '<div class="tl-row"><label>Empieza</label><input class="st-in sb-num" type="number" step="0.01" data-p="subtitulos" data-k="a" data-i="' + sel.id + '" data-keep="1" value="' + r3(r[0]) + '"><span class="v">s</span></div>' +
              '<div class="tl-row"><label>Termina</label><input class="st-in sb-num" type="number" step="0.01" data-p="subtitulos" data-k="b" data-i="' + sel.id + '" data-keep="1" value="' + r3(r[1]) + '"><span class="v">s</span></div>' : '')) + editor();
      }
      return '<h3>Subtítulos</h3><div class="q">' + U.words.length + ' palabras · toca una caja de la pista para ajustarla</div>' + editor();
    },
    inspectorIdle: function () {
      return U.words.length ? '<div class="tl-acts"><button data-p="subtitulos" data-k="panel">Editar subtítulos (' + U.words.length + ' palabras)</button></div>' : '';
    },
    helpExtra: function () { return '<b>Subtítulos:</b> en su pista, arrastra una palabra o estira sus bordes; doble clic cambia el texto.<br>'; },
    paint: function (t) {
      var T = A.state(), i = wordAt(t);
      if (i !== U.cur) {
        if (T.rtab === 'design') {
          var a = T.el.insp.querySelector('.sb-i.cur'), b = T.el.insp.querySelector('.sb-i[data-i="' + i + '"]:not(.sb-i0)');
          if (a) a.classList.remove('cur');
          if (b) b.classList.add('cur');
        }
        U.cur = i;
      }
      paintLive(t);
    },
    onHidden: function (k) { if (k === 'subs') { syncHidden(); U.liveK = ''; A.seek(A.state().t); } },
    onClick: function (b) {
      var k = b.dataset.k;
      if (k === 'panel') A.select({ type: 'subs', id: 'all' });
      else if (k === 'repall' || k === 'rep1') {
        if (!U.q) return A.toast('Escribe primero qué buscar', true);
        var idx = [];
        U.words.forEach(function (w, i) { if (hit(w)) idx.push(i); });
        if (!idx.length) return A.toast('No hay ninguna palabra con ese texto', true);
        A.remember();
        if (k === 'repall') idx.forEach(function (i) { replaceIn(U.words[i]); });
        else {
          var at = idx.filter(function (i) { return i > U.cur; })[0];
          at = at == null ? idx[0] : at;
          replaceIn(U.words[at]);
          if (U.rg[at]) A.seek(U.rg[at][0]);
        }
        A.toast(k === 'repall' ? idx.length + ' palabras cambiadas' : 'Palabra cambiada');
        A.touched('subtitulos');
        A.redraw();
      }
    },
    onInput: function (el) {
      var k = el.dataset.k;
      if (k === 't') { setText(+el.dataset.i, el.value, el); return; }
      if (k === 'r') { U.r = el.value; return; }
      if (k === 'q') {
        U.q = el.value;
        var T = A.state(), c = T.el.insp.querySelector('.sb-cnt');
        if (c) c.textContent = U.q ? nHits() + ' palabras' : '';
        T.el.insp.querySelectorAll('.sb-list .sb-i').forEach(function (n) { n.classList.toggle('hit', hit(U.words[+n.dataset.i])); });
      }
    },
    onChange: function (el) {
      var k = el.dataset.k;
      if (k !== 'a' && k !== 'b') return;
      var i = +el.dataset.i, r = U.rg[i], v = parseFloat(el.value);
      if (!r || isNaN(v)) return;
      A.remember();
      if (k === 'a') setR(i, A.clamp(v, Math.min(prevEnd(i), r[0]), r[1] - MIN), r[1]);
      else setR(i, r[0], A.clamp(v, r[0] + MIN, Math.max(nextStart(i), r[1])));
      A.touched('subtitulos');
      el.value = r3(U.rg[i][k === 'a' ? 0 : 1]);
      A.redraw();
    },
    snap: function () { return { w: JSON.parse(JSON.stringify(U.words)) }; },
    restore: function (o) { if (o.w) { U.words = o.w; calc(); U.liveK = ''; } },
    data: function () {                      // en segundos del montaje que se procesa; una palabra vacía se quita
      calc();
      var out = [];
      U.words.forEach(function (w, i) {
        if (!w.text.trim()) return;
        var r = U.rg[i] || [w.start, w.end];
        out.push({ text: w.text, start: r3(r[0]), end: r3(r[1]) });
      });
      var now = JSON.stringify(out.map(function (x) { return [x.text, x.start, x.end]; }));
      return now === U.orig ? {} : { words: out };
    }
  });
})();
