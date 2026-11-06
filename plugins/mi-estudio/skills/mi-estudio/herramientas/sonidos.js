// Módulo "Sonidos" de la Edición: cada efecto de sonido del vídeo (los <audio> snd* y fx*a* de index.html) es un bloque propio en la
// pista Sonidos, como en CapCut: se mueve, se estira, se quita (Supr) y se le cambia el volumen, y suena en la vista previa.
// Datos: lo saca mi_estudio.py del HTML (sonidos_entrada) -> {items: [{id, label, src, from, to, vol}], mezcla}; lo cambiado va a
// sonidos_edit.json -> {items: {<id>: {from, to, anchor, off, db}}} y lo aplica aplicar.py. Con mezcla (el sonido final sale de una
// mezcla con ffmpeg, edicion/audio.json con pista "sfx") pide Procesar vídeo: el script de las pistas lo lee con edicion.sonidos().
(function () {
  var A, U, MIN = -30, MAX = 12;
  var lin = function (db) { return Math.pow(10, db / 20); };
  var r3 = function (v) { return Math.round(v * 1000) / 1000; };

  function fxOf(id) { return A.state().fx.filter(function (f) { return f.sonido && f.id === id; })[0]; }
  function item(id) { return U.items.filter(function (x) { return x.id === id; })[0]; }
  function dbText(id) { var d = U.db[id] || 0; return (d > 0 ? '+' : '') + d.toFixed(1) + ' dB'; }
  function state() {                         // lo de cada sonido tal como está ahora
    var T = A.state(), out = {};
    U.items.forEach(function (it) {
      var f = fxOf(it.id), r = f && !f.off ? A.fxRange(f) : null, sg = f && T.segs.filter(function (x) { return x._id === f.seg; })[0];
      out[it.id] = { from: r ? r3(r[0]) : it.from, to: r ? r3(r[1]) : it.to, anchor: sg ? { seg: sg.id, src: r3(f.src) } : null,
                     off: !f || !!f.off || !r, db: U.db[it.id] || 0, moved: !!(f && f.edited) };
    });
    return out;
  }

  // ---------- sonar en la vista previa ----------
  function load(it) {
    if (U.bufs[it.src] || U.loading[it.src]) return;
    U.loading[it.src] = true;
    fetch(A.url(it.src)).then(function (r) { return r.arrayBuffer(); }).then(function (b) { return U.ctx.decodeAudioData(b); })
      .then(function (buf) { U.bufs[it.src] = buf; }).catch(function () {});
  }
  function stopAll() { U.srcs.forEach(function (s) { try { s.stop(); } catch (e) {} }); U.srcs = []; }
  function start(at, solo) {                 // programa los sonidos que quedan desde el segundo "at" del montaje
    stopAll();
    var T = A.state(), now = U.ctx.currentTime, rate = T.rate || 1;
    U.items.forEach(function (it) {
      if (solo && it.id !== solo) return;
      var f = fxOf(it.id), r = f && !f.off ? A.fxRange(f) : null, b = U.bufs[it.src];
      if (!r || !b || r[1] <= at || (!solo && A.isHidden('el:sonidos'))) return;
      var off = Math.max(0, at - r[0]), wait = Math.max(0, r[0] - at) / rate, len = r[1] - r[0] - off;
      if (off >= b.duration || len <= 0) return;
      var src = U.ctx.createBufferSource(), g = U.ctx.createGain();
      src.buffer = b; src.playbackRate.value = rate;
      g.gain.value = it.vol * lin(U.db[it.id] || 0);
      src.connect(g); g.connect(U.out);
      src.start(now + wait, off, Math.min(len, b.duration - off));
      U.srcs.push(src);
    });
    U.t0 = now; U.off = at;
  }

  // ---------- panel ----------
  function panel(it) {
    var x = state()[it.id];
    return '<div class="tl-sub"><h4>Sonido · ' + A.esc(it.label) + '</h4>' +
      '<div class="tl-row"><label>Volumen</label><input type="range" class="st-sl" data-p="sonidos" data-k="db" data-id="' + it.id + '" min="' + MIN + '" max="' + MAX + '" step="0.5" value="' + (U.db[it.id] || 0) + '">' +
      '<span class="v so-v">' + dbText(it.id) + '</span></div>' +
      '<div class="tl-acts"><button data-p="sonidos" data-a="oir" data-id="' + it.id + '">▶ Escuchar solo este</button>' +
      '<button data-p="sonidos" data-a="reset" data-id="' + it.id + '"' + (x.db || x.moved ? '' : ' disabled') + '>Restablecer</button></div>' +
      '<div class="help">Arrástralo en la pista Sonidos para moverlo y estira su borde para cortarlo antes; Supr lo quita. ' +
      (U.mezcla ? 'Este vídeo mezcla el sonido aparte: para que salga en el vídeo, pulsa Procesar vídeo.' : 'Sale en el vídeo sin volver a montar.') + '</div></div>';
  }

  Timeline.use({
    id: 'sonidos',
    init: function (api, input, saved) {
      if (!input || !input.items || !input.items.length || !window.AudioContext) return false;
      A = api;
      var T = A.state(), sv = (saved || {}).items || {};
      U = { items: input.items, mezcla: !!input.mezcla, db: {}, bufs: {}, loading: {}, srcs: [], lastMem: 0 };
      var G = A.audio();
      U.ctx = G.ctx;
      U.out = U.ctx.createGain(); U.out.connect(G.master);
      U.items.forEach(function (it) {
        var s = sv[it.id] || {}, sg = s.anchor && T.segs.filter(function (x) { return x.id === s.anchor.seg; })[0];
        var from = s.from != null ? s.from : it.from, to = s.to != null ? s.to : it.to;
        var a = sg ? { seg: sg._id, src: s.anchor.src } : A.anchor(A.clamp(from, 0, T.total));
        U.db[it.id] = s.db || 0;
        A.addFx({ kind: 'el', sonido: true, id: it.id, label: '♪ ' + it.label, seg: a.seg, src: a.src, dur: Math.max(.05, to - from),
                  edited: !!(s.from != null && s.moved !== false), off: !!s.off, group: null });
        load(it);
      });
      U.sig0 = U.sig = JSON.stringify(state());
      window.MiSonidos = { activo: true };       // audio.js deja de tocar la pista "sfx" mezclada: ya suenan uno a uno
      return true;
    },
    laneOf: function (f) { return f.sonido ? { id: 'sonidos', label: 'Sonidos' } : null; },
    inspectorExtra: function (sel, f) { var it = f.sonido && item(f.id); return it ? panel(it) : ''; },
    onChanged: function () {                 // moverlos o quitarlos en la línea de tiempo también cuenta como cambio
      var s = JSON.stringify(state());
      if (s !== U.sig) { U.sig = s; A.touched('sonidos'); }
    },
    onClick: function (b) {
      var id = b.dataset.id, it = item(id);
      if (!it) return;
      if (b.dataset.a === 'oir') { A.stop(); U.ctx.resume().then(function () { start(state()[id].from, id); }); return; }
      if (b.dataset.a === 'reset') {
        A.remember();
        var f = fxOf(id), a = A.anchor(A.clamp(it.from, 0, A.state().total));
        U.db[id] = 0;
        if (f) { f.seg = a.seg; f.src = a.src; f.dur = Math.max(.05, it.to - it.from); f.edited = false; f.off = false; }
        U.sig = JSON.stringify(state()); A.touched('sonidos'); A.redraw();
      }
    },
    onInput: function (el) {
      if (el.dataset.k !== 'db') return;
      if (Date.now() - U.lastMem > 800) A.remember();
      U.lastMem = Date.now();
      U.db[el.dataset.id] = +el.value;
      U.sig = JSON.stringify(state()); A.touched('sonidos');
      var v = A.state().el.insp.querySelector('.so-v'); if (v) v.textContent = dbText(el.dataset.id);
    },
    onPlay: function (t) { U.ctx.resume().then(function () { start(t); }); },
    onStop: function () { stopAll(); },
    onTick: function (t) {
      if (U.srcs.length && Math.abs(U.off + (U.ctx.currentTime - U.t0) * (A.state().rate || 1) - t) > 0.12) start(t);   // un corte o un salto: se recoloca
    },
    necesita: function () { return U.mezcla && U.sig !== U.sig0 ? 'efectos de sonido' : ''; },
    helpExtra: function () { return '<b>Sonidos:</b> cada efecto de sonido es un bloque en la pista Sonidos: arrástralo, estíralo o quítalo, y tócalo para cambiar su volumen.<br>'; },
    snap: function () { return { db: JSON.parse(JSON.stringify(U.db)) }; },
    restore: function (s) { U.db = JSON.parse(JSON.stringify(s.db || {})); },
    data: function () {
      var st = state(), out = {};
      U.items.forEach(function (it) {
        var x = st[it.id];
        if (x.off || x.db || x.moved) out[it.id] = { from: x.from, to: x.to, anchor: x.anchor, off: x.off, db: x.db, moved: x.moved };
      });
      return { items: out };
    }
  });
})();
