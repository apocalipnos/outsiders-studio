// Módulo "Audio" de la Edición: cada pista (música, efectos de sonido...) sale en la línea de tiempo con su onda, y
// tocándola (o tocando el nombre "Vídeo y voz") se ajusta su volumen mientras suena el vídeo.
// Datos: <proyecto>/edicion/audio.json (lo escribe el script de las pistas) -> audio_edit.json al procesar.
//   {video, stems: [{id, label, src, default}]}   (src: un wav del montaje entero a ganancia 1; default en dB;
//   la pista "voice" es la voz de los clips, que ya suena en la vista previa)
//   audio_edit.json: {<id>: dB, ...}   (silenciada = -60)
(function () {
  var A, U, MIN = -40, MAX = 12;
  var lin = function (db) { return Math.pow(10, db / 20); };
  var pct = function (p) { return Math.min(100, Math.max(0, (20 * Math.log10(p + 1e-9) + 48) / 48 * 100)) + '%'; };
  var COLORS = ['#2fbf8f', '#f29b38', '#c77dff', '#e5484d'];

  function stem(id) { return U.stems.filter(function (s) { return s.id === id; })[0]; }
  function gains() {
    var solo = U.stems.some(function (s) { return U.st[s.id].solo; });
    U.stems.forEach(function (s) {
      var x = U.st[s.id], g = U.nodes[s.id];
      if (g) g.gain.gain.setTargetAtTime(!x.mute && (!solo || x.solo) ? lin(x.db) : 0, U.ctx.currentTime, 0.02);
    });
  }
  function stopSrc() { U.srcs.forEach(function (s) { try { s.stop(); } catch (e) {} }); U.srcs = []; }
  function start(at) {
    stopSrc();
    U.stems.forEach(function (s) {
      var b = U.bufs[s.id];
      if (!b || at >= b.duration) return;
      var src = U.ctx.createBufferSource(); src.buffer = b; src.connect(U.nodes[s.id].gain);
      src.start(0, at); U.srcs.push(src);
    });
    U.t0 = U.ctx.currentTime; U.off = at;
  }
  function level(an) { var a = new Float32Array(an.fftSize); an.getFloatTimeDomainData(a); var p = 0; for (var i = 0; i < a.length; i++) p = Math.max(p, Math.abs(a[i])); return p; }
  function meters() {
    var box = A.state().el.insp;
    U.stems.forEach(function (s) {
      var m = box.querySelector('.au-meter[data-id="' + s.id + '"] i');
      if (m && U.nodes[s.id]) m.style.width = pct(level(U.nodes[s.id].an));
    });
    var mm = box.querySelector('.au-mm'), pk = box.querySelector('.au-peak');
    if (mm) {
      var p = level(U.out);
      U.hold = Math.max(U.hold * 0.995, p);
      mm.style.width = pct(p);
      pk.textContent = U.hold > 0 ? (20 * Math.log10(U.hold)).toFixed(1) + ' dB' : '-∞ dB';
    }
  }
  function dbText(id) { var x = U.st[id]; return x.mute ? 'silenciada' : (x.db > 0 ? '+' : '') + x.db.toFixed(1) + ' dB'; }

  function draw(cv, id) {
    var T = A.state(), pk = U.peaks[id];
    if (!pk) return;
    var dpr = window.devicePixelRatio || 1, w = Math.max(1, Math.round(T.width)), h = 34;
    cv.style.width = w + 'px';
    cv.width = Math.round(w * dpr); cv.height = h * dpr;
    var g = cv.getContext('2d');
    g.scale(dpr, dpr);
    g.fillStyle = COLORS[U.stems.indexOf(stem(id)) % COLORS.length];
    g.globalAlpha = U.st[id].mute ? .3 : 1;
    for (var x = 0; x < w; x++) {
      var a = Math.floor(A.xToTime(x) * 100), b = Math.max(a + 1, Math.floor(A.xToTime(x + 1) * 100)), m = 0;
      for (var k = a; k < b && k < pk.length; k++) if (pk[k] > m) m = pk[k];
      var bh = Math.max(1, m * (h - 4));
      g.fillRect(x, (h - bh) / 2, 1, bh);
    }
  }

  Timeline.use({
    id: 'audio', owns: ['aud'],
    init: function (api, input, saved) {
      if (!input || !input.stems || !window.AudioContext) return false;
      A = api;
      saved = saved || {};
      U = { stems: input.stems, st: {}, bufs: {}, peaks: {}, nodes: {}, srcs: [], hold: 0, lastMem: 0 };
      U.stems.forEach(function (s) {
        var v = saved[s.id];
        U.st[s.id] = { db: v != null && v > -60 ? v : s.default || 0, mute: v != null && v <= -60, solo: false };
      });
      U.ctx = new AudioContext();
      U.out = U.ctx.createAnalyser(); U.out.fftSize = 1024; U.out.connect(U.ctx.destination);
      U.stems.forEach(function (s) {
        var g = U.ctx.createGain(), an = U.ctx.createAnalyser(); an.fftSize = 1024;
        g.connect(an); an.connect(U.out);
        U.nodes[s.id] = { gain: g, an: an };
        if (s.id === 'voice') {         // la voz son los propios clips de la vista previa: pasan por su volumen
          A.state().deck.forEach(function (v) { try { U.ctx.createMediaElementSource(v).connect(g); } catch (e) {} });
          return;
        }
        fetch(A.url(s.src)).then(function (r) { return r.arrayBuffer(); }).then(function (b) { return U.ctx.decodeAudioData(b); })
          .then(function (buf) {
            U.bufs[s.id] = buf;
            var d = buf.getChannelData(0), step = Math.round(buf.sampleRate / 100), pk = [];
            for (var i = 0; i < d.length; i += step) { var m = 0; for (var k = i; k < i + step && k < d.length; k++) { var a = Math.abs(d[k]); if (a > m) m = a; } pk.push(m); }
            var top = Math.max.apply(null, pk) || 1;              // cada onda a su propia escala, o una pista baja se ve plana
            U.peaks[s.id] = pk.map(function (v) { return v / top; });
            A.redraw();
          }).catch(function () {});
      });
      gains();
      return true;
    },
    labelExtra: function (id) { return U.st[id] ? ' <span class="tl-db">' + dbText(id) + '</span>' : ''; },
    tracks: function () {
      var T = A.state();
      return U.stems.filter(function (s) { return s.id !== 'voice'; }).map(function (s) {
        var sel = T.sel && T.sel.type === 'aud' && T.sel.id === s.id ? ' sel' : '';
        return '<div class="tl-lab' + sel + '" data-pick="aud" data-id="' + s.id + '">♪ ' + A.esc(s.label) + ' <span class="tl-db">' + dbText(s.id) + '</span></div>' +
          '<div class="tl-track tl-au' + sel + '" data-pick="aud" data-id="' + s.id + '"><canvas></canvas></div>';
      }).join('');
    },
    drawTracks: function (inner) {
      inner.querySelectorAll('.tl-au').forEach(function (d) { draw(d.querySelector('canvas'), d.dataset.id); });
    },
    helpExtra: function () {
      return '<b>Audio:</b> toca una pista (o el nombre "Vídeo y voz") para cambiar su volumen mientras suena. La música y los efectos van con el último montaje procesado.<br>';
    },
    inspector: function (sel) {
      var s = stem(sel.id), x = U.st[sel.id];
      if (!s) return '<h3>Vídeo y voz</h3><div class="help">Este vídeo no tiene pistas de audio preparadas.</div>';
      return '<h3>Pista: ' + A.esc(s.label) + '</h3><div class="q">Volumen de toda la pista</div>' +
        '<div class="tl-row"><label>Volumen</label><input class="au-fader" type="range" data-p="audio" data-k="db" data-id="' + s.id + '" min="' + MIN + '" max="' + MAX + '" step="0.5" value="' + x.db + '">' +
        '<span class="v au-v">' + dbText(s.id) + '</span></div>' +
        '<div class="tl-acts"><button data-p="audio" data-b="mute" data-id="' + s.id + '" class="' + (x.mute ? 'on' : '') + '">' + (x.mute ? 'Activar' : 'Silenciar') + '</button>' +
        '<button data-p="audio" data-b="solo" data-id="' + s.id + '" class="' + (x.solo ? 'on' : '') + '">Solo</button>' +
        '<button data-p="audio" data-b="reset" data-id="' + s.id + '">Restablecer (' + (s.default || 0) + ' dB)</button></div>' +
        '<div class="au-meter" data-id="' + s.id + '"><i></i></div>' +
        '<div class="tl-row au-master"><label>Salida</label><div class="au-meter"><i class="au-mm"></i></div><span class="v au-peak">-∞ dB</span></div>' +
        '<div class="help">Dale a reproducir y mueve la barra mientras suena. Solo deja oír esta pista (no se guarda). El pico de la salida no debería pasar de -1 dB.</div>';
    },
    onClick: function (b) {
      var x = U.st[b.dataset.id], s = stem(b.dataset.id);
      if (b.dataset.b === 'solo') { x.solo = !x.solo; gains(); A.refresh(); return; }
      A.remember();
      if (b.dataset.b === 'mute') x.mute = !x.mute;
      else if (b.dataset.b === 'reset') { x.db = s.default || 0; x.mute = false; }
      gains(); A.touched('audio'); A.redraw();
    },
    onInput: function (el) {
      if (el.dataset.k !== 'db') return;
      if (Date.now() - U.lastMem > 800) A.remember();
      U.lastMem = Date.now();
      var id = el.dataset.id;
      U.st[id].db = +el.value;
      gains(); A.touched('audio');
      var T = A.state();
      T.el.insp.querySelector('.au-v').textContent = dbText(id);     // sin repintar el panel, o la barra se suelta
      T.el.root.querySelectorAll('.tl-lab[data-id="' + id + '"] .tl-db').forEach(function (d) { d.textContent = dbText(id); });
    },
    onPlay: function (t) { U.hold = 0; U.ctx.resume().then(function () { start(t); }); },
    onStop: function () { stopSrc(); },
    onTick: function (t) {
      if (U.srcs.length && Math.abs(U.off + U.ctx.currentTime - U.t0 - t) > 0.12) start(t);   // un corte o un salto: se recoloca
      meters();
    },
    snap: function () { var o = {}; U.stems.forEach(function (s) { o[s.id] = { db: U.st[s.id].db, mute: U.st[s.id].mute }; }); return o; },
    restore: function (o) { Object.keys(o).forEach(function (k) { if (U.st[k]) { U.st[k].db = o[k].db; U.st[k].mute = o[k].mute; } }); gains(); },
    data: function () {
      var out = {};
      U.stems.forEach(function (s) { out[s.id] = U.st[s.id].mute ? -60 : U.st[s.id].db; });
      return out;
    }
  });
})();
