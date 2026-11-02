// Módulo "Capas libres" de la Edición: capas que no existen en plan.json (texto, imagen, vídeo, audio o bloque), ancladas a un
// momento de su toma para que sigan en su sitio si se recorta el montaje. La parte de tiempo vive en T.fx (kind:'el', libre:true)
// y lo demás aquí. Datos: edicion/libres_edit.json = {items: [...]}, ver CONTRATO.md. API pública: window.MiLibres.
(function () {
  var A, L;
  var CSS_ = '.lb-l{position:absolute;cursor:move;outline:4px dashed transparent;outline-offset:8px}.lb-l:hover,.lb-l.sel{outline-color:var(--a)}.lb-l.ghost{opacity:.5}' +
    '.lb-in{width:100%;height:100%;pointer-events:none;box-sizing:border-box}.lb-text .lb-in{height:auto;min-height:40px;font:700 72px/1.1 "Inter Tight",Inter,Arial,sans-serif;color:#fff;text-align:center;white-space:pre-wrap;overflow-wrap:break-word}' +
    '.lb-in img,.lb-in video{width:100%;height:100%;object-fit:cover;display:block}.lb-auto .lb-in{height:auto}.lb-auto .lb-in img,.lb-auto .lb-in video{height:auto}' +
    '.lb-edit{pointer-events:auto;cursor:text;user-select:text;-webkit-user-select:text;outline:3px solid #29CC5B;outline-offset:4px;caret-color:#29CC5B}' +
    '.lb-block{width:100%;height:100%;min-height:200px;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;background:rgba(60,230,172,.1);border:6px dashed rgba(60,230,172,.65);border-radius:18px;color:#eafff7;font:700 44px system-ui;text-align:center;box-sizing:border-box;padding:20px}.lb-block span{font:500 26px system-ui;color:#a3a3a3}' +
    '.lb-h{position:absolute;width:44px;height:44px;border-radius:50%;background:var(--a);border:7px solid #fff;cursor:nwse-resize;box-shadow:0 2px 10px rgba(0,0,0,.5);opacity:0}.lb-l:hover .lb-h,.lb-l.sel .lb-h{opacity:1}' +
    '.lb-h.nw{left:-26px;top:-26px}.lb-h.ne{right:-26px;top:-26px;cursor:nesw-resize}.lb-h.sw{left:-26px;bottom:-26px;cursor:nesw-resize}.lb-h.se{right:-26px;bottom:-26px}' +
    '.lb-tag{position:absolute;left:32px;top:-56px;background:var(--a);color:#09090b;font:700 28px system-ui;padding:5px 14px;border-radius:8px;white-space:nowrap;opacity:0;pointer-events:none}.lb-l:hover .lb-tag,.lb-l.sel .lb-tag{opacity:1}' +
    '.lb-txt{flex:1;min-width:120px;resize:vertical;padding:5px 8px;font:inherit;font-size:12px;color:var(--t1);background:var(--card2);border:1px solid var(--b1);border-radius:6px;user-select:text}';
  var NAMES = { text: 'Texto', image: 'Imagen', video: 'Vídeo', audio: 'Audio', block: 'Plantilla' };
  var copy = function (o) { return JSON.parse(JSON.stringify(o)); };

  function fxOf(id) { return A.state().fx.filter(function (f) { return f.libre && f.id === id; })[0]; }
  function fxIndex(id) { var fx = A.state().fx; for (var i = 0; i < fx.length; i++) if (fx[i].libre && fx[i].id === id) return i; return -1; }
  function item(id) { return L.items.filter(function (x) { return x.id === id; })[0]; }
  function newId() { var id; do { id = 'lb' + (L.n++); } while (item(id)); return id; }
  function selectedId() {
    var T = A.state(), s = T.sel, f = s && s.type === 'fx' && T.fx[s.id];
    return f && f.libre ? f.id : null;
  }
  function touch() { A.touched('libres'); }
  function isMedia(it) { return it.type === 'video' || it.type === 'audio'; }

  // ---------- en la vista previa ----------
  function build(it) {                      // crea el elemento de la capa (el audio no se ve: solo su <audio>)
    var T = A.state(), rec = L.els[it.id] = { it: it };
    if (it.type === 'audio') {
      rec.media = new Audio();
      rec.media.crossOrigin = 'anonymous'; rec.media.preload = 'auto'; rec.media.src = A.url(it.src);
      metaDur(it, rec.media);
      audioNodes(it.id, rec.media);
      return rec;
    }
    var d = rec.el = document.createElement('div');
    d.className = 'lb-l lb-' + it.type; d.dataset.lb = it.id; d.hidden = true;
    d.innerHTML = '<div class="lb-in"></div><div class="lb-tag"></div>' + ['nw', 'ne', 'sw', 'se'].map(function (c) { return '<div class="lb-h ' + c + '" data-c="' + c + '"></div>'; }).join('');
    var box = rec.box = d.querySelector('.lb-in');
    if (it.type === 'image') box.innerHTML = '<img draggable="false" src="' + A.esc(A.url(it.src)) + '">';
    else if (it.type === 'video') {
      rec.media = document.createElement('video');
      rec.media.crossOrigin = 'anonymous'; rec.media.preload = 'auto'; rec.media.playsInline = true; rec.media.src = A.url(it.src);
      box.appendChild(rec.media);
      metaDur(it, rec.media);
      audioNodes(it.id, rec.media);
    } else if (it.type === 'block') box.innerHTML = '<div class="lb-block"><b></b><span>Plantilla · se ve en Ver resultado</span></div>';
    d.addEventListener('pointerdown', function (e) { drag(it.id, e.target.classList.contains('lb-h') ? e.target.dataset.c : 'move', e); });
    d.addEventListener('dblclick', function (e) { e.preventDefault(); editText(it.id); });
    T.el.ov.appendChild(d);
    place(it);
    return rec;
  }
  function metaDur(it, m) {                 // un medio sin duración pedida ocupa lo que dure, si cabe
    if (!it._autoDur) return;
    m.addEventListener('loadedmetadata', function () {
      var f = fxOf(it.id), T = A.state();
      if (!f || !it._autoDur || !isFinite(m.duration)) return;
      delete it._autoDur;
      var r = A.fxRange(f);
      f.dur = Math.max(.5, Math.min(m.duration - (it.mediaStart || 0), T.total - (r ? r[0] : 0)));
      A.redraw(); touch();
    }, { once: true });
  }
  function place(it) {                      // posición, tamaño y contenido escritos en el elemento
    var rec = L.els[it.id];
    if (!rec || !rec.el) return;
    var s = rec.el.style;
    s.left = it.left + 'px'; s.top = it.top + 'px'; s.width = it.width + 'px';
    s.height = it.height == null ? '' : it.height + 'px';
    rec.el.classList.toggle('lb-auto', it.height == null);
    rec.el.querySelector('.lb-tag').textContent = it.label;
    if (it.type === 'text' && L.ed !== it.id) rec.box.textContent = it.text || '';
    if (it.type === 'block') rec.box.querySelector('b').textContent = it.label;
  }
  function audioNodes(id, m) {              // pasa por el grafo del núcleo; Audio FX lo encuentra en audio().stems['lib:<id>']
    var rec = L.els[id];
    if (rec.nodes || rec.noGraph) return rec.nodes;
    var G = A.audio();
    if (!G) { rec.noGraph = true; return null; }
    try {
      var src = G.ctx.createMediaElementSource(m), input = G.ctx.createGain(), gain = G.ctx.createGain(), an = G.ctx.createAnalyser();
      an.fftSize = 1024;
      src.connect(input); input.connect(gain); gain.connect(an); an.connect(G.master);
      rec.nodes = G.stems['lib:' + id] = { input: input, gain: gain, an: an };
    } catch (e) { rec.noGraph = true; }
    return rec.nodes;
  }
  function syncMedia(rec, on, r, t) {
    var m = rec.media, T = A.state(), it = rec.it;
    if (!m) return;
    if (!on) { if (!m.paused) m.pause(); return; }
    var want = (it.mediaStart || 0) + (t - r[0]), n = audioNodes(it.id, m), vol = it.volume == null ? 1 : it.volume;
    if (n) n.gain.gain.value = vol; else { m.volume = A.clamp(vol * T.vol, 0, 1); m.muted = T.muted; }
    if (T.playing) {
      m.playbackRate = T.rate;
      if (Math.abs(m.currentTime - want) > .25) m.currentTime = want;
      if (m.paused) { if (T.audio) T.audio.ctx.resume(); m.play().catch(function () {}); }
    } else {
      if (!m.paused) m.pause();
      if (Math.abs(m.currentTime - want) > .03) m.currentTime = want;
    }
  }
  function paint(t) {
    var sid = selectedId(), hideAll = A.isHidden('el:libres');
    L.items.forEach(function (it) {
      var rec = L.els[it.id];
      if (!rec) return;
      var f = fxOf(it.id), r = f && !f.off ? A.fxRange(f) : null, on = !!r && !hideAll && t >= r[0] && t < r[1], sel = sid === it.id;
      syncMedia(rec, on, r, t);
      if (!rec.el || L.ed === it.id) return;
      rec.el.hidden = !on && !(sel && r);
      rec.el.classList.toggle('ghost', !on);
      rec.el.classList.toggle('sel', sel);
    });
  }

  // ---------- ratón ----------
  function drag(id, mode, e) {
    if (L.ed === id) return;
    e.preventDefault(); e.stopPropagation();
    A.stop();
    var T = A.state(), it = item(id), i = fxIndex(id);
    if (selectedId() !== id) A.select({ type: 'fx', id: i });
    A.remember();
    var sx = e.clientX, sy = e.clientY, st = copy(it), S = T.S, moved = false, rec = L.els[id], guide = T.el.ov.querySelector('.cp-guide');
    var h0 = it.height == null ? rec.el.offsetHeight : it.height, ratio = h0 / Math.max(1, it.width);
    function mv(ev) {
      var dx = (ev.clientX - sx) / S, dy = (ev.clientY - sy) / S;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return;
      moved = true;
      if (mode === 'move') {
        it.left = A.gridSnap(st.left + dx); it.top = A.gridSnap(st.top + dy);
        var near = Math.abs(it.left + it.width / 2 - A.W / 2) < 10;
        if (near) it.left = A.W / 2 - it.width / 2;
        if (guide) guide.style.display = near ? 'block' : 'none';
      } else {                              // la esquina contraria a la que se arrastra se queda quieta
        var gx = /e$/.test(mode) ? 1 : -1, gy = /^s/.test(mode) ? 1 : -1;
        it.width = Math.max(40, st.width + gx * dx);
        if (st.height != null) it.height = ev.shiftKey ? Math.max(40, st.height + gy * dy) : Math.max(40, it.width * ratio);
        var hNew = st.height != null ? it.height : it.width * ratio;
        if (gx < 0) it.left = st.left + st.width - it.width;
        if (gy < 0) it.top = st.top + h0 - hNew;
      }
      place(it); touch(); A.refresh();
    }
    function up() {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (guide) guide.style.display = 'none';
      if (!moved) { T.hist.pop(); return; }
      it.left = Math.round(it.left); it.top = Math.round(it.top); it.width = Math.round(it.width);
      if (it.height != null) it.height = Math.round(it.height);
      place(it); A.refresh();
    }
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  function editText(id) {                   // doble clic: escribir en la misma vista previa
    var it = item(id), rec = L.els[id];
    if (!it || it.type !== 'text' || L.ed) return;
    A.stop();
    A.remember();
    L.ed = id;
    var b = rec.box, t0 = it.text;
    b.classList.add('lb-edit');
    b.contentEditable = 'plaintext-only';
    if (b.contentEditable !== 'plaintext-only') b.contentEditable = 'true';
    b.focus();
    var r = document.createRange(); r.selectNodeContents(b);
    var s = getSelection(); s.removeAllRanges(); s.addRange(r);
    var done = function (cancel) {
      if (L.ed !== id) return;
      L.ed = null;
      setText(it, cancel ? t0 : b.innerText.replace(/\n$/, ''));   // antes de ocultarla otra vez: innerText de algo oculto está vacío
      b.contentEditable = 'false'; b.classList.remove('lb-edit');
      if (it.text === t0) A.state().hist.pop();
      place(it); A.redraw();
    };
    b.addEventListener('pointerdown', stopIt);
    b.addEventListener('keydown', function kd(ev) {       // Mayús+Intro: salto de línea
      ev.stopPropagation();
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); b.removeEventListener('keydown', kd); done(); }
      else if (ev.key === 'Escape') { ev.preventDefault(); b.removeEventListener('keydown', kd); done(true); }
    });
    b.addEventListener('blur', function () { b.removeEventListener('pointerdown', stopIt); done(); }, { once: true });
  }
  function stopIt(e) { e.stopPropagation(); }
  function setText(it, txt) {
    it.text = txt;
    var line = (txt || '').split('\n')[0].trim();
    if (it._autoLabel !== false) { it.label = line.slice(0, 40) || NAMES.text; var f = fxOf(it.id); if (f) f.label = it.label; }
    touch();
  }

  // ---------- crear, duplicar y quitar ----------
  function add(tipo, o) {
    o = o || {};
    if (!NAMES[tipo]) throw new Error('Tipo de capa libre desconocido: ' + tipo);
    var T = A.state();
    A.stop();
    A.remember();
    var id = newId(), dur = o.dur || (tipo === 'video' || tipo === 'audio' ? 5 : 3), at = o.at == null ? T.t : o.at, a = A.anchor(Math.min(at, Math.max(0, T.total - .5)));
    var label = o.label || (o.src ? String(o.src).split('/').pop() : tipo === 'text' ? (o.text || NAMES.text).split('\n')[0].slice(0, 40) : NAMES[tipo]);
    var w = o.width || (tipo === 'text' ? 800 : tipo === 'block' ? 700 : 540);
    var it = { id: id, type: tipo, label: label, left: o.left == null ? Math.round((A.W - w) / 2) : o.left, top: o.top == null ? (tipo === 'text' ? 800 : 620) : o.top, width: w, height: o.height == null ? (tipo === 'block' ? 400 : null) : o.height };
    if (tipo === 'text') { it.text = o.text == null ? 'Texto' : o.text; if (o.label) it._autoLabel = false; }
    if (o.src) it.src = o.src;
    if (isMedia(it)) { it.volume = o.volume == null ? 1 : o.volume; it.mediaStart = o.mediaStart || 0; if (!o.dur) it._autoDur = true; }
    Object.keys(o).forEach(function (k) { if (it[k] === undefined && ['at', 'dur'].indexOf(k) < 0) it[k] = o[k]; });
    L.items.push(it);
    var idx = A.addFx({ kind: 'el', libre: true, id: id, label: label, seg: a.seg, src: a.src, dur: Math.max(.5, Math.min(dur, T.total - at)), edited: true, off: false, group: null });
    build(it);
    if (tipo === 'text' && window.MiEstilo) MiEstilo.defaults('lib:' + id, { color: '#ffffff', 'font-family': 'Inter', 'font-size': '72px', 'font-weight': '700', 'text-align': 'center' });
    touch();
    A.select({ type: 'fx', id: idx });
    return copy(it);
  }
  function destroy(id) {                    // la capa fuera del todo (el bloque de la línea ya no está en T.fx)
    var rec = L.els[id];
    if (rec) {
      if (rec.media) { rec.media.pause(); }
      if (rec.el) rec.el.remove();
      if (rec.nodes) { try { rec.nodes.an.disconnect(); } catch (e) {} var G = A.audio(); if (G) delete G.stems['lib:' + id]; }
      delete L.els[id];
    }
  }
  function remove(id) {
    var i = fxIndex(id), T = A.state();
    A.remember();
    if (i >= 0) T.fx.splice(i, 1);
    L.items = L.items.filter(function (x) { return x.id !== id; });
    destroy(id);
    T.sel = null; T.multi = [];
    if (window.MiEstilo) MiEstilo.drop('lib:' + id);
    if (window.MiClaves) MiClaves.drop('lib:' + id);
    touch(); A.redraw();
  }
  function stash(id) {                      // lo que hace falta para rehacer la capa después
    var f = fxOf(id), r = f && A.fxRange(f);
    return { it: copy(item(id)), dur: f ? f.dur : 3, start: r ? r[0] : 0, estilo: window.MiEstilo ? MiEstilo.get('lib:' + id) : null, claves: window.MiClaves ? MiClaves.get('lib:' + id) : null };
  }
  function clone(s, at, dur, mediaOff) {    // una capa nueva a partir de otra, en el segundo at
    var T = A.state(), it = copy(s.it), id = newId();
    delete it._autoDur;
    it.id = id;
    if (mediaOff && isMedia(it)) it.mediaStart = Math.round(((it.mediaStart || 0) + mediaOff) * 1000) / 1000;
    L.items.push(it);
    var a = A.anchor(Math.min(at, Math.max(0, T.total - .1))), idx = A.addFx({ kind: 'el', libre: true, id: id, label: it.label, seg: a.seg, src: a.src, dur: Math.max(.1, Math.min(dur, T.total - at)), edited: true, off: false, group: null });
    build(it);
    if (s.estilo && window.MiEstilo) MiEstilo.set('lib:' + id, s.estilo);
    if (s.claves && window.MiClaves) MiClaves.set('lib:' + id, s.claves, mediaOff != null ? 0 : at - s.start);
    return idx;
  }
  function duplicate(id) {
    var s = stash(id), T = A.state();
    A.stop();
    A.remember();
    var idx = clone(s, Math.min(s.start + .25, Math.max(0, T.total - .1)), s.dur);
    touch();
    A.select({ type: 'fx', id: idx });
  }
  function update(id, o) {
    var it = item(id);
    if (!it) return;
    Object.keys(o).forEach(function (k) {
      it[k] = o[k];
      if (k === 'label') { it._autoLabel = false; var f = fxOf(id); if (f) f.label = o[k]; }
    });
    place(it); touch();
  }

  // ---------- panel ----------
  function panelFor(it) {
    var S = A.section, body = '';
    body += '<div class="tl-row"><label>Nombre</label><input class="st-in" style="flex:1" data-keep="1" data-p="libres" data-k="label" data-id="' + it.id + '" value="' + A.esc(it.label) + '"></div>';
    if (it.type === 'text') body += '<div class="tl-row"><label>Texto</label><textarea class="lb-txt" rows="' + Math.max(2, (it.text || '').split('\n').length) + '" data-keep="1" data-p="libres" data-k="text" data-id="' + it.id + '">' + A.esc(it.text || '') + '</textarea></div><div class="help">También con doble clic en la vista previa (Intro termina, Esc deshace).</div>';
    if (it.src) body += '<div class="tl-row"><label>Archivo</label><span class="v" style="text-align:left;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1" title="' + A.esc(it.src) + '">' + A.esc(it.src.split('/').pop()) + '</span></div>';
    if (it.type === 'block') body += '<div class="help">Una plantilla se pinta aquí como una caja con su nombre; se ve de verdad en Ver resultado.</div>';
    if (isMedia(it)) {
      var vol = it.volume == null ? 1 : it.volume;
      body += '<div class="tl-row"><label>Volumen</label><input type="range" class="st-sl" min="0" max="2" step="0.01" value="' + vol + '" data-p="libres" data-k="volume" data-id="' + it.id + '"><span class="v lb-vol">' + Math.round(vol * 100) + ' %</span></div>' +
        '<div class="tl-row"><label>Empieza en</label><input type="number" class="st-in" style="width:70px" min="0" step="0.1" data-keep="1" data-p="libres" data-k="mediaStart" data-id="' + it.id + '" value="' + (it.mediaStart || 0) + '"><span class="v">s del archivo</span></div>';
    }
    body += '<div class="tl-acts"><button data-p="libres" data-a="dup" data-id="' + it.id + '">Duplicar</button><button class="warn" data-p="libres" data-a="del" data-id="' + it.id + '">Eliminar capa</button></div>';
    return S('lb-capa', NAMES[it.type], body);
  }

  Timeline.use({
    id: 'libres',
    init: function (api, input, saved) {
      A = api;
      var T = A.state();
      L = { items: [], els: {}, n: 1, clip: null, ed: null, lastMem: 0 };
      var st = document.createElement('style'); st.textContent = CSS_; document.head.appendChild(st);
      ((saved || {}).items || []).forEach(function (s) {
        var sg = s.anchor && T.segs.filter(function (x) { return x.id === s.anchor.seg; })[0];
        var a = sg ? { seg: sg._id, src: s.anchor.src } : A.anchor(A.clamp(s.from || 0, 0, T.total));
        var it = copy(s);
        ['from', 'to', 'anchor', 'off'].forEach(function (k) { delete it[k]; });
        if (it.type === 'text' && it.label !== (it.text || '').split('\n')[0].trim().slice(0, 40)) it._autoLabel = false;   // un nombre puesto a mano no lo cambia el texto
        L.items.push(it);
        A.addFx({ kind: 'el', libre: true, id: s.id, label: s.label || s.id, seg: a.seg, src: a.src, dur: Math.max(.1, (s.to || 0) - (s.from || 0)), edited: true, off: !!s.off, group: null });
        var m = /^lb(\d+)$/.exec(s.id); if (m) L.n = Math.max(L.n, +m[1] + 1);
        build(it);
      });
      T.el.stage.addEventListener('pointerdown', function (e) {       // tocar fuera de las capas suelta la libre elegida
        if (!e.target.closest('.lb-l') && selectedId()) A.select(null);
      });
      window.MiLibres = {
        add: add, remove: remove, duplicate: duplicate, update: update,
        list: function () { return L.items.map(copy); },
        get: function (id) { var it = item(id); return it ? copy(it) : null; }
      };
      return true;
    },
    laneOf: function (f) { return f.libre ? { id: 'libres', label: 'Capas añadidas' } : null; },
    timelineTools: function () { return '<i class="st-div"></i><button class="st-tb st-txt" data-p="libres" data-a="addtext" title="Añade una capa de texto en el cursor">Añadir texto</button>'; },
    paint: paint,
    onStop: function () { L.items.forEach(function (it) { var r = L.els[it.id]; if (r && r.media && !r.media.paused) r.media.pause(); }); },
    inspectorExtra: function (sel, f) {
      if (!f.libre) return '';
      var it = item(f.id);
      return it ? panelFor(it) : '';
    },
    onClick: function (b) {
      var a = b.dataset.a;
      if (a === 'addtext') add('text', {});
      else if (a === 'dup') duplicate(b.dataset.id);
      else if (a === 'del') remove(b.dataset.id);
    },
    onInput: function (el) {
      var it = item(el.dataset.id), k = el.dataset.k;
      if (!it) return;
      if (Date.now() - L.lastMem > 800) A.remember();
      L.lastMem = Date.now();
      if (k === 'text') { setText(it, el.value); place(it); A.redraw(); }
      else if (k === 'label') { update(it.id, { label: el.value }); A.redraw(); }
      else if (k === 'volume') {
        it.volume = +el.value;
        var v = A.state().el.insp.querySelector('.lb-vol'); if (v) v.textContent = Math.round(it.volume * 100) + ' %';
        touch(); paint(A.state().t);
      } else if (k === 'mediaStart') { it.mediaStart = Math.max(0, +el.value || 0); touch(); paint(A.state().t); }
    },
    key: function (e) {
      var id = selectedId();
      if (id && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(id); return true; }
      return false;
    },
    copy: function () {
      var id = selectedId();
      if (id) { L.clip = stash(id); A.state().clipboard = null; }
      else L.clip = null;
    },
    cut: function () {
      var id = selectedId();
      if (!id) { L.clip = null; return; }
      L.clip = stash(id); A.state().clipboard = null;
      remove(id);
    },
    paste: function () {
      if (!L.clip) return;
      var T = A.state();
      A.stop();
      A.remember();
      var idx = clone(L.clip, T.t, L.clip.dur);
      touch();
      A.select({ type: 'fx', id: idx });
    },
    razorAll: function (t) {                 // Mayús+cuchilla: parte también las capas libres que cruzan el cursor
      var cut = L.items.filter(function (it) {
        var f = fxOf(it.id), r = f && !f.off && A.fxRange(f);
        return r && t > r[0] + .05 && t < r[1] - .05;
      });
      if (!cut.length) return;
      A.remember();
      cut.forEach(function (it) {
        var f = fxOf(it.id), r = A.fxRange(f), s = stash(it.id), first = t - r[0];
        f.dur = first;
        clone(s, t, r[1] - t, first);
      });
      touch(); A.redraw();
    },
    shortcuts: function () { return [['Capas añadidas', [['Ctrl+C / X / V', 'Copiar, cortar y pegar la capa'], ['Ctrl+D', 'Duplicar la capa'], ['Doble clic', 'Escribir el texto'], ['Mayús+clic con tijeras', 'Partirlas también']]]]; },
    helpExtra: function () { return '<b>Capas añadidas:</b> "Añadir texto" (abajo) o el panel Medios ponen una capa nueva en el cursor. Arrástrala en la vista previa; los círculos de sus esquinas cambian el tamaño.<br>'; },
    snap: function () { return { items: L.items, n: L.n }; },
    restore: function (s) {
      L.items = copy(s.items); L.n = s.n; L.ed = null;
      Object.keys(L.els).forEach(function (id) { if (!item(id)) destroy(id); });
      L.items.forEach(function (it) {
        if (L.els[it.id]) { L.els[it.id].it = it; place(it); } else build(it);
      });
    },
    data: function () {
      var T = A.state();
      return {
        items: L.items.map(function (it) {
          var f = fxOf(it.id), r = f && A.fxRange(f), o = copy(it), sg = f && T.segs.filter(function (x) { return x._id === f.seg; })[0];
          delete o._autoDur; delete o._autoLabel;
          o.from = r ? Math.round(r[0] * 1000) / 1000 : 0;
          o.to = r ? Math.round(r[1] * 1000) / 1000 : 0;
          o.anchor = sg ? { seg: sg.id, src: Math.round(f.src * 1000) / 1000 } : null;
          o.off = !f || !!f.off || !r;
          return o;
        })
      };
    }
  });
})();
