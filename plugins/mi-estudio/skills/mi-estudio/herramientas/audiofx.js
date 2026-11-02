// Módulo "Audio FX" de la Edición: el rack de efectos de HyperFrames Studio, en Diseño al elegir una pista de audio ({type:'aud', id})
// o una capa libre de audio, y la automatización como pistas propias en la línea de tiempo. Datos: edicion/audiofx_edit.json ->
//   {chains: {<objetivo>: {version:1, nodes:[{id:"n1", type, label, fromPreset?, enabled, params:{...}}]}},    (data-fx-chain)
//    automation: {<objetivo>: {version:1, lanes:[{target:"volume"|"fx.<nodo>.<param>", points:[{t, v}]}]}},   (data-automation)
//    volume: {<objetivo>: dB}}
// t en segundos: del montaje en voice/sfx/pistas (que empiezan en 0) y desde el inicio de la capa en lib:<id>. v: en "volume" es
// ganancia lineal (1 = 0 dB, máx. 3,98 = +12 dB) y sustituye al volumen de la pista mientras exista; en un parámetro, su valor.
// Los puntos llevan además "anchor": {seg, src} para seguir a su palabra si se recorta antes (el motor lo ignora).
// Vista previa real: el mismo grafo WebAudio que usa el motor, salvo los nodos con worklet propio, que se oyen en el render.
(function () {
  var A, U, E, LANE_H = 44, VOL_MAX = Math.pow(10, 12 / 20), MAX_POINTS = 512;
  var lin = function (db) { return Math.pow(10, db / 20); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var copy = function (o) { return JSON.parse(JSON.stringify(o)); };
  var GROUPS = [['filter', 'Filtros'], ['dynamics', 'Volumen'], ['nonlinear', 'Distorsión'], ['time', 'Eco y espacio']];
  var FAMS = [['voice', 'Voz'], ['repair', 'Reparar'], ['character', 'Voces divertidas'], ['space', 'Sala']];
  var TYPE = { gain: ['Volumen', 'Sube o baja toda la señal.'], peaking: ['Ecualizador', 'Sube o baja una banda y deja el resto.'], lowshelf: ['Graves', 'Sube o baja todo lo que hay por debajo de la frecuencia.'], highshelf: ['Agudos', 'Sube o baja todo lo que hay por encima de la frecuencia.'], highpass: ['Quitar graves', 'Quita los graves: lo normal contra el retumbo en una voz.'], lowpass: ['Quitar agudos', 'Quita los agudos: oscurece o amortigua la pista.'], compressor: ['Igualar volumen', 'Baja lo fuerte para poder subir lo flojo.'], limiter: ['Techo de volumen', 'Un techo: nada pasa de ahí.'], gate: ['Silenciar pausas', 'Silencia la pista cuando baja del umbral.'], saturate: ['Distorsión', 'Recorta la onda con suavidad: calidez o distorsión.'], bitcrush: ['Sonido lo-fi', 'Baja los bits y la frecuencia de muestreo: sonido lo-fi.'], pitchshift: ['Cambio de tono', 'Sube o baja el tono sin cambiar la velocidad. Añade unos 50 ms.'], delay: ['Eco', 'Repeticiones detrás de la señal.'], chorus: ['Voz doble', 'Copias desafinadas para dar anchura.'], phaser: ['Barrido', 'Muescas que barren el espectro.'], reverb: ['Reverb', 'Cola de sala: el mismo impulso en la vista previa y en el vídeo final.'] };
  var PAR = { frequency: 'Frecuencia', gain: 'Volumen', q: 'Ancho', poles: 'Corte', threshold: 'A partir de', ratio: 'Cuánto', attack: 'Reacción', release: 'Soltar', knee: 'Suavidad', makeup: 'Subir después', mix: 'Mezcla', limit: 'Techo', level_out: 'Salida', range: 'Rango', type: 'Curva', output: 'Salida', oversample: 'Calidad', bits: 'Bits', samples: 'Repetir muestra', semitones: 'Semitonos', time: 'Tiempo', feedback: 'Repeticiones', delay: 'Retraso', depth: 'Profundidad', speed: 'Velocidad', in_gain: 'Entrada', out_gain: 'Salida', decay: 'Duración', size: 'Sala', damping: 'Apagar agudos', wet: 'Con efecto', dry: 'Sin efecto' };
  var HINT = { 'compressor.threshold': 'Nivel a partir del que empieza a comprimir.', 'compressor.knee': '1 es una esquina dura; más la suaviza.', 'compressor.mix': 'Por debajo de 1 vuelve a mezclar la señal seca.', 'gate.range': 'Cuánto baja cuando la puerta está cerrada.', 'saturate.oversample': 'Más cuesta más, pero evita aliasing.', 'bitcrush.samples': 'Repite cada muestra N veces: un remuestreo tosco.', 'reverb.damping': 'Más apaga antes los agudos de la cola.', 'highpass.q': 'Lo abrupto que empieza el corte.', 'lowpass.q': 'Lo abrupto que empieza el corte.', 'peaking.q': 'Estrecho arregla una nota; ancho cambia el carácter.' };
  var OPT = { '6 dB/oct': '6 dB/oct', 'Triangular': 'Triangular', 'Sinusoidal': 'Sinusoidal', 'Tanh': 'Tanh', 'Arctan': 'Arcotangente', 'Cubic': 'Cúbica', 'Exponential': 'Exponencial', 'Algebraic': 'Algebraica', 'Quintic': 'Quíntica', 'Sine': 'Seno', 'Error function': 'Función de error', 'Hard clip': 'Recorte duro' };
  var PRES = { 'voice-clean': ['Voz limpia', 'Quita retumbo y barro, iguala el nivel y añade claridad.'], 'voice-broadcast': ['Radio', 'Más densa y adelante: voz de locutor.'], 'voice-warm': ['Cercana y cálida', 'Íntima y poco tocada, para una voz pegada al micro.'], 'rumble-cut': ['Quitar retumbo', 'Quita tráfico, golpes y aire acondicionado bajo la voz.'], 'room-gate': ['Silencio entre frases', 'Cierra las pausas entre palabras; no quita el ruido bajo la voz.'], 'boom-tame': ['Domar graves', 'Quita el exceso de pecho de una voz muy cerca del micro.'], 'harsh-tame': ['Suavizar dureza', 'Redondea unos medios-agudos ásperos.'], telephone: ['Teléfono', 'La banda estrecha de una llamada.'], 'radio-am': ['Radio AM', 'Estrecha, con grano y algo aplastada.'], megaphone: ['Megáfono', 'Gritado por una bocina, con su rebote.'], 'lofi-tape': ['Cinta', 'Gastada, cálida y algo inestable, como un casete.'], 'pa-system': ['Megafonía', 'Anunciado en una estación.'], intercom: ['Portero', 'Por el altavoz de un portero, con su chasquido.'], 'doofus-worble': ['Mareo', 'Ondulante: no queda señal recta.'], chipmunk: ['Ardilla', 'Pequeña, rápida y aguda.'], giant: ['Gigante', 'Enorme, lenta y grave.'], monster: ['Monstruo', 'Grave, áspera y demasiado cerca.'], 'room-tight': ['Sala pequeña', 'Una sala dura y pequeña: presencia sin cola.'], 'room-natural': ['Sala natural', 'Suena grabado en algún sitio y no en ninguno.'], hall: ['Auditorio', 'Largo y abierto, para algo que queda lejos.'], 'slap-echo': ['Eco corto', 'Una repetición rápida.'], 'dub-throw': ['Eco dub', 'Repeticiones que se apagan muy por detrás.'] };
  var NODE = { 'Remove Rumble': 'Quitar retumbo', 'Reduce Mud': 'Quitar barro', 'Even Out Loudness': 'Igualar volumen', 'Add Clarity': 'Más claridad', 'Peak Ceiling': 'Techo de picos', 'Reduce Boxiness': 'Quitar caja', 'Add Air': 'Más aire', Warmth: 'Calidez', 'Add Weight': 'Más cuerpo', 'Cut Rumble': 'Quitar retumbo', 'Silence the Gaps': 'Silenciar pausas', 'Tame Boominess': 'Domar graves', 'Soften Harshness': 'Suavizar dureza', 'Strip the Bass': 'Quitar graves', 'Strip the Treble': 'Quitar agudos' };
  var CSS = '.afx-n{border:1px solid var(--b1);border-radius:7px;margin:6px 0;background:var(--card2)}.afx-n.off{opacity:.55}.afx-h{display:flex;align-items:center;gap:5px;padding:5px 6px;font-size:11px;color:var(--t1)}.afx-h b{flex:1;min-width:0;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer}.afx-h button{padding:1px 5px;font-size:11px;background:none;border:0;color:var(--t3)}.afx-h button:hover{color:var(--t1)}' +
    '.afx-b{padding:0 7px 6px}.afx-b .tl-row{margin:4px 0}.afx-b .tl-row label{width:66px}.afx-b .tl-row .v{min-width:54px;font-size:10.5px}.afx-a{padding:0 4px!important;font-size:9px!important;background:none;border:1px solid var(--b1);border-radius:4px;color:var(--t3)}.afx-a.on{color:var(--a);border-color:var(--a)}.afx-a.ph{visibility:hidden}.afx-r{font-size:10px;color:var(--t3);padding:0 7px 6px}.afx-d{font-size:10.5px;color:var(--t3);line-height:1.5;margin:4px 0}.afx-sel{width:100%}' +
    '.afx-track{cursor:crosshair;background:rgba(255,255,255,.015)}.afx-track svg{position:absolute;left:0;top:0;display:block;touch-action:none}.afx-tip{position:absolute;top:1px;padding:0 4px;font-size:10px;background:#000;color:var(--t1);border-radius:3px;pointer-events:none;white-space:nowrap;z-index:3}.afx-lab .n{color:var(--t2)}.afx-x{padding:0 4px;background:none;border:0;color:var(--t3);font-size:12px}.afx-x:hover{color:var(--t1)}';

  // ---------- modelo ----------
  function fxType(id) { return U.types[id]; }
  function renderOnly(type) { return type === 'gate' || type === 'bitcrush' || type === 'pitchshift' || type === 'limiter'; }
  function normParams(type, p) {             // como Kd del motor: todos los parámetros, dentro de su rango
    var out = {}, t = fxType(type);
    t.params.forEach(function (d) {
      var s = p ? p[d.key] : undefined;
      if (d.kind === 'enum') { out[d.key] = d.options.some(function (o) { return o.value === String(s); }) ? String(s) : d.default; return; }
      var n = typeof s === 'number' ? s : typeof s === 'string' && s.trim() !== '' ? Number(s) : NaN;
      out[d.key] = isFinite(n) ? clamp(n, d.min, d.max) : d.default;
    });
    return out;
  }
  function chain(id, make) { if (!U.chains[id] && make) U.chains[id] = { version: 1, nodes: [] }; return U.chains[id] || { version: 1, nodes: [] }; }
  function auto(id, make) { if (!U.auto[id] && make) U.auto[id] = { version: 1, lanes: [] }; return U.auto[id] || { version: 1, lanes: [] }; }
  function newId(c) { for (var n = 1; ; n++) { var id = 'n' + n; if (!c.nodes.some(function (x) { return x.id === id; })) return id; } }
  function nodeOf(id, nid) { return chain(id).nodes.filter(function (n) { return n.id === nid; })[0]; }
  function laneOf(id, tg) { return auto(id).lanes.filter(function (l) { return l.target === tg; })[0]; }
  function param(type, key) { return fxType(type).params.filter(function (p) { return p.key === key; })[0]; }
  function isLib(id) { return id.indexOf('lib:') === 0; }
  function libFx(id) { var k = id.slice(4); return A.state().fx.filter(function (f) { return f.kind === 'el' && f.libre && f.id === k; })[0]; }
  function baseT(id) { if (!isLib(id)) return 0; var f = libFx(id), r = f && A.fxRange(f); return r ? r[0] : 0; }
  function spanT(id) { if (!isLib(id)) return A.state().total; var f = libFx(id), r = f && A.fxRange(f); return r ? r[1] - r[0] : 0; }
  function name(id) { if (isLib(id)) { var f = libFx(id); return f ? f.label || f.id : id; } return U.labels[id] || (id === 'voice' ? 'Voz' : id); }
  function plugin(k) { return A.state().plugins.filter(function (x) { return x.id === k; })[0]; }
  function faderOwned(id) {                  // esta pista ya tiene fader en otro módulo: audio.js o la capa libre
    var T = A.state();
    return isLib(id) || !!(plugin('audio') && T.audio && T.audio.stems[id] && T.audio.stems[id].gain);
  }
  function ownedVol(id) {                    // lo que marca ese fader, lineal
    if (isLib(id)) {
      var p = plugin('libres'), d = p && p.data && p.data(), it = d && (d.items || []).filter(function (x) { return 'lib:' + x.id === id; })[0];
      return it && it.volume != null ? it.volume : 1;
    }
    var a = plugin('audio'), o = a && a.data(), db = o && o[id] != null ? o[id] : 0;
    return db <= -60 ? 0 : lin(db);
  }
  function restVol(id) { return faderOwned(id) ? ownedVol(id) : lin(U.vol[id] || 0); }   // volumen sin automatizar, lineal

  // ---------- escalas de las automatizaciones y de los deslizadores ----------
  function faderN(v) {                       // la ley del fader de Studio: 0 dB en el centro, -60 abajo, +12 arriba
    if (v <= 0) return 0;
    var db = 20 * Math.log10(v);
    return (clamp(db < 0 ? db / 60 * 100 : db / 12 * 100, -100, 100) + 100) / 200;
  }
  function faderV(n) {
    var t = clamp(n, 0, 1) * 200 - 100;
    return t <= -100 ? 0 : lin(t < 0 ? t / 100 * 60 : t / 100 * 12);
  }
  function rangeOf(id, tg) {
    if (tg === 'volume') return { vol: true, min: 0, max: VOL_MAX, step: .01, unit: '', label: 'Volumen' };
    var m = /^fx\.([^.]+)\.(.+)$/.exec(tg), n = m && nodeOf(id, m[1]), d = n && param(n.type, m[2]);
    if (!d || d.kind !== 'number') return null;
    return { min: d.min, max: d.max, step: d.step, unit: d.unit, scale: d.scale === 'log' && d.min > 0 ? 'log' : 'linear', label: nodeName(n) + ' · ' + (PAR[d.key] || d.label) };
  }
  function toN(r, v) { return r.vol ? faderN(v) : r.scale === 'log' ? (Math.log(Math.max(v, r.min)) - Math.log(r.min)) / (Math.log(r.max) - Math.log(r.min)) : (v - r.min) / (r.max - r.min); }
  function fromN(r, n) { n = clamp(n, 0, 1); return r.vol ? faderV(n) : r.scale === 'log' ? Math.exp(Math.log(r.min) + n * (Math.log(r.max) - Math.log(r.min))) : r.min + n * (r.max - r.min); }
  function fmtDb(v) { if (v <= 0) return '-∞ dB'; var d = 20 * Math.log10(v); return (d > 0 ? '+' : '') + (Math.abs(d) < .05 ? 0 : d).toFixed(1) + ' dB'; }
  function fmtV(r, v) {
    if (r.vol) return fmtDb(v);
    var dec = r.step >= 1 ? 0 : r.step >= .1 ? 1 : 2, s = r.unit === '' && r.max <= 1 ? Math.round(v * 100) + ' %' : v.toFixed(dec);
    return r.unit ? s + ' ' + r.unit : s;
  }
  function evalLane(l, t, scale) {           // On del motor
    var p = l.points;
    if (!p.length) return 0;
    if (t <= p[0].t) return p[0].v;
    if (t >= p[p.length - 1].t) return p[p.length - 1].v;
    var a = 0, b = p.length - 1;
    while (b - a > 1) { var m = (a + b) >> 1; if (p[m].t <= t) a = m; else b = m; }
    var x = (t - p[a].t) / Math.max(p[b].t - p[a].t, 1e-9);
    if (p[a].curve) x = Math.pow(x, Math.pow(2, 2 * p[a].curve));
    return scale === 'log' && p[a].v > 0 && p[b].v > 0 ? Math.exp(Math.log(p[a].v) + (Math.log(p[b].v) - Math.log(p[a].v)) * x) : p[a].v + (p[b].v - p[a].v) * x;
  }
  function anchorOf(t) {                     // {seg: id de edl, src}: para que el punto siga a su palabra
    var T = A.state(), a = A.anchor(t), s = T.segs.filter(function (x) { return x._id === a.seg; })[0];
    return s ? { seg: s.id, src: Math.round(a.src * 1000) / 1000 } : null;
  }
  function follow() {                        // recoloca los puntos si cambió el montaje
    var T = A.state(), sp = function (s) { return s.overlay ? 1 : (s.speed || 1); };
    Object.keys(U.auto).forEach(function (id) {
      if (isLib(id)) return;
      U.auto[id].lanes.forEach(function (l) {
        var moved = false;
        l.points.forEach(function (p) {
          if (!p.anchor) return;
          var home = T.L.filter(function (it) { return it.s.id === p.anchor.seg; })[0];
          if (!home) return;
          var inRange = function (it) { return !it.s.off && p.anchor.src >= it.s.in - 1e-3 && p.anchor.src <= it.s.out + 1e-3; };
          var hit = inRange(home) ? home : T.L.filter(function (it) { return it.s.clip === home.s.clip && inRange(it); })[0];
          if (!hit) return;
          var nt = Math.round((hit.t0 + (p.anchor.src - hit.s.in) / sp(hit.s)) * 1000) / 1000;
          if (Math.abs(nt - p.t) > 1e-3) { p.t = nt; moved = true; }
        });
        if (moved) l.points.sort(function (a, b) { return a.t - b.t; });
      });
    });
  }

  // ---------- grafo WebAudio: los mismos nodos que el motor ----------
  function impulse(rate, size, damp) {       // el generador del motor: mismo impulso en vista previa y render
    var len = Math.max(1, Math.floor(rate * (.6 + clamp(size, 0, 1) * 2.6))), o = new Float32Array(len);
    var a = Math.round(size * 1e3) * 2654435761 + Math.round(damp * 1e3) * 40503 >>> 0;
    var rnd = function () { a = a * 1664525 + 1013904223 >>> 0; return a / 4294967295 * 2 - 1; };
    var s = Math.max(.001, 1 - clamp(damp, 0, 1)), u = 0, sum = 0, f;
    for (f = 0; f < len; f++) { u += s * (rnd() - u); var h = u * Math.pow(1 - f / len, 2.5); o[f] = h; sum += h * h; }
    var m = Math.sqrt(sum);
    if (m > 0) for (f = 0; f < len; f++) o[f] /= m;
    return o;
  }
  function wetDry(w, d) { return [{ param: w.gain }, { param: d.gain, map: function (v) { return 1 - v; } }]; }
  var CURVES = { tanh: function (x) { return (Math.exp(x) - Math.exp(-x)) / (Math.exp(x) + Math.exp(-x)); }, atan: function (x) { return 2 / Math.PI * Math.atan(Math.PI / 2 * x); }, cubic: function (x) { return Math.abs(x) >= 1 ? (x > 0 ? 1 : -1) : x - x * x * x / 3; }, exp: function (x) { return (x > 0 ? 1 : -1) * (1 - Math.exp(-Math.abs(x))); }, alg: function (x) { return x / Math.sqrt(1 + x * x); }, quintic: function (x) { return Math.abs(x) >= 1 ? (x > 0 ? 1 : -1) : x - Math.pow(x, 5) / 5; }, sin: function (x) { return Math.abs(x) >= 1 ? (x > 0 ? 1 : -1) : Math.sin(Math.PI / 2 * x); }, erf: function (x) { return CURVES.tanh(1.20211 * x); }, hard: function (x) { return clamp(x, -1, 1); } };
  function build(ctx, type, p) {             // {input, output, update(p), auto: {param: [{param, map}]}, stop()}
    var n, i, o;
    if (type === 'gain') {
      n = ctx.createGain();
      return { input: n, output: n, update: function (q) { n.gain.value = lin(q.gain); }, auto: { gain: [{ param: n.gain, map: lin }] } };
    }
    if (type === 'peaking' || type === 'lowshelf' || type === 'highshelf' || type === 'highpass' || type === 'lowpass') {
      if ((type === 'highpass' || type === 'lowpass') && String(p.poles) === '1') {     // un polo: IIR, se rehace si cambia la frecuencia
        var r = Math.tan(Math.PI * p.frequency / ctx.sampleRate);
        n = type === 'highpass' ? ctx.createIIRFilter([1 / (1 + r), -1 / (1 + r)], [1, (r - 1) / (r + 1)]) : ctx.createIIRFilter([r / (1 + r), r / (1 + r)], [1, (r - 1) / (r + 1)]);
        return { input: n, output: n, update: function () {}, auto: {} };
      }
      n = ctx.createBiquadFilter(); n.type = type;
      var bq = { frequency: [{ param: n.frequency }] };
      if (type === 'peaking' || type === 'highpass' || type === 'lowpass') bq.q = [{ param: n.Q }];
      if (type === 'peaking' || type === 'lowshelf' || type === 'highshelf') bq.gain = [{ param: n.gain }];
      return { input: n, output: n, auto: bq, update: function (q) { n.frequency.value = q.frequency; if (q.q !== undefined) n.Q.value = q.q; if (q.gain !== undefined) n.gain.value = q.gain; } };
    }
    if (type === 'compressor' || type === 'limiter') {
      i = ctx.createGain(); o = ctx.createGain();
      var c = ctx.createDynamicsCompressor(), mk = ctx.createGain(), we = ctx.createGain(), dr = ctx.createGain();
      i.connect(c); c.connect(mk); mk.connect(we); we.connect(o); i.connect(dr); dr.connect(o);
      return {
        input: i, output: o, auto: {}, update: function (q) {
          if (type === 'limiter') { c.threshold.value = q.limit; c.ratio.value = 20; c.knee.value = 0; c.attack.value = Math.min(1, q.attack / 1000); c.release.value = Math.min(1, q.release / 1000); mk.gain.value = lin(q.level_out); we.gain.value = 1; dr.gain.value = 0; return; }
          c.threshold.value = q.threshold; c.ratio.value = q.ratio; c.knee.value = clamp(20 * Math.log10(q.knee), 0, 40); c.attack.value = Math.min(1, q.attack / 1000); c.release.value = Math.min(1, q.release / 1000);
          mk.gain.value = lin(q.makeup); we.gain.value = q.mix; dr.gain.value = 1 - q.mix;
        }
      };
    }
    if (type === 'saturate') {
      i = ctx.createGain(); o = ctx.createGain();
      var sh = ctx.createWaveShaper(); i.connect(sh); sh.connect(o);
      var key = '';
      return {
        input: i, output: o, auto: { output: [{ param: o.gain, map: lin }] }, update: function (q) {
          var k = q.type + ':' + q.threshold;
          if (k !== key) {
            key = k;
            var fn = CURVES[q.type] || CURVES.tanh, s = lin(q.threshold), N = 8192, d = new Float32Array(N);
            for (var m = 0; m < N; m++) d[m] = fn((m / (N - 1) * 2 - 1) / Math.max(1e-6, s)) * s;
            sh.curve = d;
          }
          sh.oversample = q.oversample >= 4 ? '4x' : q.oversample >= 2 ? '2x' : 'none';
          o.gain.value = lin(q.output);
        }
      };
    }
    if (type === 'delay') {
      i = ctx.createGain(); o = ctx.createGain();
      var dl = ctx.createDelay(5), fb = ctx.createGain(), w = ctx.createGain(), d = ctx.createGain();
      i.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(w); w.connect(o); i.connect(d); d.connect(o);
      return { input: i, output: o, auto: { time: [{ param: dl.delayTime, map: function (v) { return Math.min(5, v / 1000); } }], feedback: [{ param: fb.gain }], mix: wetDry(w, d) }, update: function (q) { dl.delayTime.value = Math.min(5, q.time / 1000); fb.gain.value = q.feedback; w.gain.value = q.mix; d.gain.value = 1 - q.mix; } };
    }
    if (type === 'chorus') {
      i = ctx.createGain(); o = ctx.createGain();
      var cd = ctx.createDelay(.5), lf = ctx.createOscillator(), dp = ctx.createGain(), w2 = ctx.createGain(), d2 = ctx.createGain();
      lf.type = 'sine'; lf.connect(dp); dp.connect(cd.delayTime); i.connect(cd); cd.connect(w2); w2.connect(o); i.connect(d2); d2.connect(o); lf.start();
      return { input: i, output: o, stop: function () { try { lf.stop(); } catch (e) {} }, auto: { delay: [{ param: cd.delayTime, map: function (v) { return v / 1000; } }], depth: [{ param: dp.gain, map: function (v) { return v / 1000; } }], speed: [{ param: lf.frequency }], mix: wetDry(w2, d2) }, update: function (q) { cd.delayTime.value = q.delay / 1000; dp.gain.value = q.depth / 1000; lf.frequency.value = q.speed; w2.gain.value = q.mix; d2.gain.value = 1 - q.mix; } };
    }
    if (type === 'phaser') {
      i = ctx.createGain(); o = ctx.createGain();
      var ig = ctx.createGain(), og = ctx.createGain(), l2 = ctx.createOscillator(), md = ctx.createGain(), list = [], last = ig;
      l2.type = String(p.type) === '1' ? 'sine' : 'triangle';
      i.connect(ig); l2.connect(md);
      for (var k = 0; k < 6; k++) { var ap = ctx.createBiquadFilter(); ap.type = 'allpass'; ap.Q.value = .7071; md.connect(ap.frequency); last.connect(ap); last = ap; list.push(ap); }
      last.connect(og); ig.connect(og); og.connect(o); l2.start();
      return { input: i, output: o, stop: function () { try { l2.stop(); } catch (e) {} }, auto: { speed: [{ param: l2.frequency }], in_gain: [{ param: ig.gain }], out_gain: [{ param: og.gain }] }, update: function (q) { var f = 1e3 / Math.max(.1, q.delay); list.forEach(function (x) { x.frequency.value = f; }); md.gain.value = f * q.decay; l2.frequency.value = q.speed; ig.gain.value = q.in_gain; og.gain.value = q.out_gain; } };
    }
    if (type === 'reverb') {
      i = ctx.createGain(); o = ctx.createGain();
      var cv = ctx.createConvolver(), w3 = ctx.createGain(), d3 = ctx.createGain(), rk = '';
      cv.normalize = false; i.connect(cv); cv.connect(w3); w3.connect(o); i.connect(d3); d3.connect(o);
      return { input: i, output: o, auto: { wet: [{ param: w3.gain }], dry: [{ param: d3.gain }] }, update: function (q) { var k2 = q.size + ':' + q.damping; if (k2 !== rk) { rk = k2; var im = impulse(ctx.sampleRate, q.size, q.damping), b = ctx.createBuffer(1, im.length, ctx.sampleRate); b.getChannelData(0).set(im); cv.buffer = b; } w3.gain.value = q.wet; d3.gain.value = q.dry; } };
    }
    return null;                             // gate, bitcrush, pitchshift: sin nodo en vivo, se oyen en el render
  }
  function sig(id) {                         // si esto cambia hay que rehacer el grafo; si no, basta con update()
    return chain(id).nodes.filter(function (n) { return n.enabled !== false; }).map(function (n) {
      var p = n.params;
      return n.id + ':' + n.type + (p.poles !== undefined ? ':' + p.poles : '') + (String(p.poles) === '1' ? '@' + p.frequency : '') + (n.type === 'phaser' ? '~' + p.type : '');
    }).join('|');
  }
  function live(id) { return U.live[id]; }
  function wire(id) {                        // coloca la entrada y la salida de nuestro tramo en la pista
    if (U.live[id]) return U.live[id];
    var G = A.audio();
    if (!G) return null;
    if (id !== 'voice' && !G.stems[id]) return null;
    var ctx = G.ctx, L = { input: ctx.createGain(), vol: ctx.createGain(), nodes: [], sig: null };
    if (id === 'voice') {                    // voice -> nodos -> voiceOut
      G.voice.disconnect(); G.voice.connect(L.input);
      L.vol.connect(G.voiceOut);
    } else {
      var st = G.stems[id];
      if (st.input) { st.input.disconnect(); st.input.connect(L.input); }   // ya tiene entrada propia (capa libre)
      else st.input = L.input;                                              // audio.js conecta sus fuentes a .input
      L.vol.connect(st.gain);
    }
    L.input.connect(L.vol);
    U.live[id] = L;
    ctx.resume();
    return L;
  }
  function rebuild(id) {
    var L = live(id), G = A.audio();
    if (!L) return;
    L.input.disconnect();
    L.nodes.forEach(function (x) { if (x.h.stop) x.h.stop(); x.h.output.disconnect(); if (x.h.input !== x.h.output) x.h.input.disconnect(); });
    L.nodes = [];
    var at = L.input;
    chain(id).nodes.forEach(function (n) {
      if (n.enabled === false) return;
      var h = build(G.ctx, n.type, n.params);
      if (!h) return;
      h.update(n.params);
      at.connect(h.input); at = h.output;
      L.nodes.push({ id: n.id, h: h });
    });
    at.connect(L.vol);
    L.sig = sig(id);
  }
  function needsLive(id) { return chain(id).nodes.length || auto(id).lanes.length || U.vol[id] != null; }
  function sync(id) {                        // la vista previa al día con el modelo de esta pista
    if (!needsLive(id) && !U.live[id]) return;
    var L = wire(id);
    if (!L) return;
    if (L.sig !== sig(id)) rebuild(id);
    else chain(id).nodes.forEach(function (n) {
      var x = L.nodes.filter(function (q) { return q.id === n.id; })[0];
      if (x) x.h.update(n.params);
    });
    volNow(id, A.state().t);
  }
  function syncAll() {
    Object.keys(U.chains).concat(Object.keys(U.auto), Object.keys(U.vol), Object.keys(U.live)).forEach(function (id, i, a) { if (a.indexOf(id) === i) sync(id); });
  }
  function volNow(id, t) {                   // el tramo de volumen: automatización si la hay (sustituye al fader), si no el fader propio
    var L = live(id);
    if (!L) return;
    var l = laneOf(id, 'volume'), G = A.audio(), v = faderOwned(id) ? 1 : lin(U.vol[id] || 0);
    if (l && l.points.length) {
      v = evalLane(l, t - baseT(id), 'linear');
      if (faderOwned(id)) { var o = ownedVol(id); v = o > 0 ? v / o : 0; }   // en este tramo: lo que falta sobre ese fader
    }
    L.vol.gain.setTargetAtTime(v, G.ctx.currentTime, .012);
  }
  function automate(t) {                     // en cada fotograma: los valores de la envolvente a sus AudioParam
    Object.keys(U.auto).forEach(function (id) {
      var L = live(id);
      if (!L) return;
      volNow(id, t);
      var now = A.audio().ctx.currentTime;
      U.auto[id].lanes.forEach(function (l) {
        if (l.target === 'volume' || !l.points.length) return;
        var m = /^fx\.([^.]+)\.(.+)$/.exec(l.target), x = m && L.nodes.filter(function (q) { return q.id === m[1]; })[0], ps = x && x.h.auto[m[2]], r = rangeOf(id, l.target);
        if (!ps || !r) return;
        var v = evalLane(l, t - baseT(id), r.scale);
        ps.forEach(function (q) { q.param.setTargetAtTime(q.map ? q.map(v) : v, now, .012); });
      });
    });
  }

  // ---------- panel ----------
  function nodeName(n) { return NODE[n.label] || (TYPE[n.type] && TYPE[n.type][0]) || n.type; }
  function targetOf(sel) {
    if (!sel) return null;
    if (sel.type === 'aud') return sel.id;
    if (sel.type === 'fx') {
      var f = A.state().fx[sel.id];
      if (f && f.kind === 'el' && f.libre && libType(f) === 'audio') return 'lib:' + f.id;
    }
    return null;
  }
  function libType(f) {
    if (f.type) return f.type;
    var p = A.state().plugins.filter(function (x) { return x.id === 'libres'; })[0], d = p && p.data && p.data();
    var it = d && (d.items || []).filter(function (x) { return x.id === f.id; })[0];
    return it && it.type;
  }
  function paramRow(id, n, d) {
    var hint = HINT[n.type + '.' + d.key] || (d.hint && '') || '', lab = PAR[d.key] || d.label;
    if (n.type === 'phaser' && d.key === 'type') lab = 'Onda';
    if (d.kind === 'enum') {
      return '<div class="tl-row"><label title="' + A.esc(hint) + '">' + lab + '</label><select data-p="audiofx" data-k="enum" data-n="' + n.id + '" data-q="' + d.key + '">' + d.options.map(function (o) {
        return '<option value="' + o.value + '"' + (String(n.params[d.key]) === o.value ? ' selected' : '') + '>' + (OPT[o.label] || o.label) + '</option>';
      }).join('') + '</select></div>';
    }
    var r = { min: d.min, max: d.max, step: d.step, unit: d.unit, scale: d.scale === 'log' && d.min > 0 ? 'log' : 'linear' }, v = n.params[d.key], tg = 'fx.' + n.id + '.' + d.key;
    return '<div class="tl-row"><label title="' + A.esc(hint || 'Doble clic: valor por defecto') + '" data-afd="' + n.id + '.' + d.key + '">' + lab + '</label><input type="range" class="st-sl" data-p="audiofx" data-k="par" data-n="' + n.id + '" data-q="' + d.key + '" min="0" max="1000" step="1" value="' + Math.round(toN(r, v) * 1000) + '">' +
      '<span class="v" data-afv="' + n.id + '.' + d.key + '">' + fmtV(r, v) + '</span>' +
      (d.automatable ? '<button class="afx-a' + (laneOf(id, tg) ? ' on' : '') + '" data-p="audiofx" data-b="auto" data-n="' + n.id + '" data-q="' + d.key + '" title="Que cambie con el tiempo: crea una pista en la línea de tiempo">◆</button>' : '<button class="afx-a ph" tabindex="-1">◆</button>') + '</div>';
  }
  function rack(id) {
    var c = chain(id);
    if (!c.nodes.length) return '<div class="afx-d">Sin efectos. Añade uno o elige un preset.</div>';
    return c.nodes.map(function (n, i) {
      var t = fxType(n.type), fold = U.fold[id + '/' + n.id];
      return '<div class="afx-n' + (n.enabled === false ? ' off' : '') + '"><div class="afx-h"><input type="checkbox" data-p="audiofx" data-k="on" data-n="' + n.id + '"' + (n.enabled === false ? '' : ' checked') + ' title="Activar o desactivar">' +
        '<b data-affold="' + n.id + '" title="' + A.esc(TYPE[n.type][1]) + '">' + (fold ? '› ' : '') + A.esc(nodeName(n)) + '</b>' +
        '<button data-p="audiofx" data-b="up" data-n="' + n.id + '" title="Subir"' + (i ? '' : ' disabled') + '>↑</button><button data-p="audiofx" data-b="down" data-n="' + n.id + '" title="Bajar"' + (i < c.nodes.length - 1 ? '' : ' disabled') + '>↓</button><button data-p="audiofx" data-b="del" data-n="' + n.id + '" title="Quitar">×</button></div>' +
        (fold ? '' : '<div class="afx-b">' + t.params.map(function (d) { return paramRow(id, n, d); }).join('') + '</div>') +
        (renderOnly(n.type) ? '<div class="afx-r">' + (n.type === 'limiter' ? 'Aproximado aquí; el exacto se oye en el vídeo final.' : 'Se oye en el vídeo final.') + '</div>' : '') + '</div>';
    }).join('');
  }
  function addSelect() {
    return '<select class="afx-sel" data-p="audiofx" data-k="add"><option value="">+ Añadir efecto…</option>' + GROUPS.map(function (g) {
      return '<optgroup label="' + g[1] + '">' + E.fxTypes.filter(function (t) { return t.group === g[0]; }).map(function (t) { return '<option value="' + t.id + '" title="' + A.esc(TYPE[t.id][1]) + '">' + TYPE[t.id][0] + '</option>'; }).join('') + '</optgroup>';
    }).join('') + '</select>';
  }
  function presetSelect(id) {
    var cur = chain(id).nodes[0] && chain(id).nodes[0].fromPreset, same = cur && chain(id).nodes.every(function (n) { return n.fromPreset === cur; }) ? cur : '';
    return '<select class="afx-sel" data-p="audiofx" data-k="preset"><option value="">Ajuste rápido (sustituye los efectos)…</option>' + FAMS.map(function (f) {
      return '<optgroup label="' + f[1] + '">' + E.fxPresets.filter(function (p) { return p.family === f[0]; }).map(function (p) { return '<option value="' + p.id + '"' + (p.id === same ? ' selected' : '') + ' title="' + A.esc((PRES[p.id] || [])[1] || p.description) + '">' + A.esc((PRES[p.id] || [p.label])[0]) + '</option>'; }).join('') + '</optgroup>';
    }).join('') + '</select>' + (same ? '<div class="afx-d">' + A.esc((PRES[same] || [])[1] || '') + '</div>' : '');
  }
  function fader(id) {
    if (faderOwned(id)) return '';
    var db = U.vol[id] || 0;
    return '<div class="tl-row"><label title="Doble clic: 0 dB" data-afd="vol">Volumen</label><input type="range" class="st-sl" data-p="audiofx" data-k="vol" min="-60" max="12" step="0.5" value="' + db + '"><span class="v" data-afv="vol">' + fmtDb(lin(db)) + '</span></div>';
  }
  function panel(id) {
    U.cur = id;
    var h = '', lanes = auto(id).lanes, vl = laneOf(id, 'volume');
    h += A.section('afx-rack', 'Efectos de audio · ' + A.esc(name(id)), fader(id) + '<div class="tl-row">' + presetSelect(id) + '</div>' + rack(id) + '<div class="tl-row">' + addSelect() + '</div>');
    h += A.section('afx-auto', 'Cambios en el tiempo', '<div class="tl-acts"><button data-p="audiofx" data-b="autovol" class="' + (vl ? 'on' : '') + '">' + (vl ? 'Quitar cambios de volumen' : 'Subir y bajar el volumen') + '</button></div>' +
      lanes.filter(function (l) { return l.target !== 'volume'; }).map(function (l) {
        var r = rangeOf(id, l.target);
        return '<div class="tl-row"><span class="afx-d" style="flex:1;margin:0">' + A.esc(r ? r.label : l.target) + '</span><button data-p="audiofx" data-b="lane-del" data-t="' + A.esc(id) + '" data-l="' + A.esc(l.target) + '">Quitar</button></div>';
      }).join('') +
      '<div class="afx-d">Sale una pista en la línea de tiempo: clic añade un punto, arrástralo, Alt+clic lo borra. El rombo ◆ de cada parámetro hace lo mismo con ese valor. La automatización de volumen sustituye al fader.</div>');
    return h;
  }

  // ---------- pistas de automatización ----------
  function laneSvg(id, l) {
    var T = A.state(), W = T.width + 60, r = rangeOf(id, l.target), b = baseT(id), H = LANE_H;
    if (!r) return '';
    var yOf = function (v) { return 4 + (1 - toN(r, v)) * (H - 8); }, xOf = function (t) { return A.timeToX(b + t); }, p = l.points, s = '<svg width="' + W + '" height="' + H + '">';
    if (r.vol) s += '<path d="M0 ' + yOf(1) + 'H' + W + '" stroke="#333" stroke-width="1"/>';
    if (p.length) {
      var d = 'M0 ' + yOf(p[0].v).toFixed(1) + 'L' + xOf(p[0].t).toFixed(1) + ' ' + yOf(p[0].v).toFixed(1);
      for (var i = 0; i + 1 < p.length; i++) {            // cada tramo con varias muestras: la escala de pantalla no es lineal
        for (var k = 1; k <= 10; k++) {
          var t = p[i].t + (p[i + 1].t - p[i].t) * k / 10;
          d += 'L' + xOf(t).toFixed(1) + ' ' + yOf(evalLane({ points: [p[i], p[i + 1]] }, t, r.scale)).toFixed(1);
        }
      }
      d += 'L' + W + ' ' + yOf(p[p.length - 1].v).toFixed(1);
      s += '<path d="' + d + '" fill="none" stroke="#f29b38" stroke-width="1.5"/>';
      p.forEach(function (q, n) { s += '<circle data-i="' + n + '" cx="' + xOf(q.t).toFixed(1) + '" cy="' + yOf(q.v).toFixed(1) + '" r="4" fill="#f29b38" stroke="#000" stroke-width="1"/>'; });
    }
    return s + '</svg>';
  }
  function laneHit(id, l, x, y) {
    var r = rangeOf(id, l.target), b = baseT(id), best = -1, bd = 10;
    l.points.forEach(function (q, i) {
      var dx = A.timeToX(b + q.t) - x, dy = 4 + (1 - toN(r, q.v)) * (LANE_H - 8) - y, dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bd) { bd = dist; best = i; }
    });
    return best;
  }
  function laneDown(tr, e) {
    var id = tr.dataset.t, l = laneOf(id, tr.dataset.l), r = l && rangeOf(id, l.target);
    if (!r) return;
    e.preventDefault();
    var T = A.state(), box = tr.getBoundingClientRect(), b = baseT(id), x = e.clientX - box.left, y = e.clientY - box.top, i = laneHit(id, l, x, y);
    A.remember();
    if (e.altKey) {
      if (i >= 0) { l.points.splice(i, 1); tr.innerHTML = laneSvg(id, l); done(id); } else T.hist.pop();
      return;
    }
    var at = function (cx) { return clamp(A.snapTime(A.xToTime(cx)) - b, 0, spanT(id)); }, val = function (cy) { return fromN(r, 1 - (cy - 4) / (LANE_H - 8)); }, q, moved = i < 0;
    if (i >= 0) q = l.points[i];
    else {
      if (l.points.length >= MAX_POINTS) { T.hist.pop(); A.toast('Hasta 512 puntos por pista.', true); return; }
      q = { t: at(x), v: val(y) };
      l.points.push(q);
    }
    var tip = document.createElement('span');
    tip.className = 'afx-tip';
    tr.appendChild(tip);
    var paint = function () {
      l.points.sort(function (m, n) { return m.t - n.t; });
      var svg = laneSvg(id, l), cur = tr.querySelector('svg');
      if (cur) cur.outerHTML = svg; else tr.insertAdjacentHTML('afterbegin', svg);
      tip.textContent = fmtV(r, q.v) + ' · ' + A.fmt(b + q.t);
      tip.style.left = Math.max(0, A.timeToX(b + q.t) + 8) + 'px';
      if (T.playing) automate(T.t);
    };
    paint();
    function mv(ev) {
      var cx = ev.clientX - tr.getBoundingClientRect().left, cy = ev.clientY - tr.getBoundingClientRect().top, n = l.points.indexOf(q);
      moved = true;
      var lo = n > 0 ? l.points[n - 1].t + .001 : 0, hi = n < l.points.length - 1 ? l.points[n + 1].t - .001 : 1e9;
      q.t = Math.round(clamp(at(cx), lo, hi) * 1000) / 1000;
      q.v = val(cy);
      paint();
    }
    function up() {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up); removeEventListener('pointercancel', up);
      tip.remove();
      T.guide = null;
      if (!moved) { T.hist.pop(); return; }
      q.t = Math.round(q.t * 1000) / 1000;
      q.v = Math.round(q.v * 10000) / 10000;
      if (!isLib(id)) { var a = anchorOf(q.t); if (a) q.anchor = a; }
      done(id);
    }
    addEventListener('pointermove', mv); addEventListener('pointerup', up); addEventListener('pointercancel', up);
  }
  function done(id) { A.touched('audiofx'); volNow(id, A.state().t); }
  function startLane(id, tg, v0) {           // una pista nueva: plana en el valor de ahora, de punta a punta
    var c = auto(id, true), span = spanT(id);
    c.lanes.push({ target: tg, points: [pointAt(id, 0, v0), pointAt(id, Math.round(span * 1000) / 1000, v0)] });
  }
  function pointAt(id, t, v) { var p = { t: t, v: v }; if (!isLib(id)) { var a = anchorOf(Math.min(t, A.state().total - .001)); if (a) p.anchor = a; } return p; }

  // ---------- cambios ----------
  function setPreset(id, pid) {
    var pr = E.fxPresets.filter(function (p) { return p.id === pid; })[0], c = { version: 1, nodes: [] };
    if (!pr) return;
    pr.nodes.forEach(function (n) {
      var o = { id: newId(c), type: n.type, fromPreset: pr.id };
      if (n.label) o.label = n.label;
      o.enabled = true; o.params = normParams(n.type, n.params);
      c.nodes.push(o);
      U.fold[id + '/' + o.id] = true;        // plegados: una cadena larga no tapa el panel
    });
    dropOrphans(id, c);
    U.chains[id] = c;
  }
  function dropOrphans(id, c) {              // sin nodo no hay automatización de ese nodo
    var a = U.auto[id];
    if (!a) return;
    a.lanes = a.lanes.filter(function (l) {
      if (l.target === 'volume') return true;
      var m = /^fx\.([^.]+)\.(.+)$/.exec(l.target), n = m && c.nodes.filter(function (x) { return x.id === m[1]; })[0];
      return n && param(n.type, m[2]);
    });
  }
  function touch(id, redraw) {
    A.touched('audiofx');
    sync(id);
    if (redraw) A.redraw(); else A.refresh();
  }
  function showLane(id, tg) {                // la pista nueva puede quedar por debajo de las capas
    var tr = A.state().el.inner.querySelector('.afx-track[data-t="' + id + '"][data-l="' + tg + '"]');
    if (tr) tr.scrollIntoView({ block: 'nearest' });
  }
  function act(b) {
    var k = b.dataset.b, id = U.cur, nid = b.dataset.n, c = chain(id), i = c.nodes.indexOf(nodeOf(id, nid));
    if (k === 'lane-x' || k === 'lane-del') {
      var t = b.dataset.t, a = U.auto[t];
      A.remember();
      if (a) a.lanes = a.lanes.filter(function (l) { return l.target !== b.dataset.l; });
      touch(t, true);
      return;
    }
    A.remember();
    if (k === 'del') { c.nodes.splice(i, 1); dropOrphans(id, c); touch(id, true); return; }
    if (k === 'up' && i > 0) { c.nodes.splice(i - 1, 0, c.nodes.splice(i, 1)[0]); touch(id); return; }
    if (k === 'down' && i < c.nodes.length - 1) { c.nodes.splice(i + 1, 0, c.nodes.splice(i, 1)[0]); touch(id); return; }
    if (k === 'autovol') {
      if (laneOf(id, 'volume')) auto(id).lanes = auto(id).lanes.filter(function (l) { return l.target !== 'volume'; });
      else startLane(id, 'volume', Math.round(restVol(id) * 10000) / 10000);
      touch(id, true);
      showLane(id, 'volume');
      return;
    }
    if (k === 'auto') {
      var tg = 'fx.' + nid + '.' + b.dataset.q, n = nodeOf(id, nid);
      if (laneOf(id, tg)) auto(id).lanes = auto(id).lanes.filter(function (l) { return l.target !== tg; });
      else startLane(id, tg, n.params[b.dataset.q]);
      touch(id, true);
      showLane(id, tg);
      return;
    }
    A.state().hist.pop();
  }
  function panelEvents() {
    var T = A.state();
    T.el.insp.addEventListener('click', function (e) {
      var f = e.target.closest('[data-affold]');
      if (!f || U.cur == null) return;
      var k = U.cur + '/' + f.dataset.affold;
      U.fold[k] = !U.fold[k];
      A.refresh();
    });
    T.el.insp.addEventListener('dblclick', function (e) {     // doble clic en el nombre: valor por defecto
      var l = e.target.closest('[data-afd]');
      if (!l || U.cur == null) return;
      var id = U.cur;
      A.remember();
      if (l.dataset.afd === 'vol') delete U.vol[id];
      else { var p = l.dataset.afd.split('.'), n = nodeOf(id, p[0]); n.params[p[1]] = param(n.type, p[1]).default; }
      touch(id);
    });
    T.el.inner.addEventListener('pointerdown', function (e) {  // el núcleo no se mete: la pista lleva data-keep-drag
      var tr = e.target.closest('.afx-track');
      if (tr) laneDown(tr, e);
    });
  }

  Timeline.use({
    id: 'audiofx', owns: ['aud'],            // si no hay audio.js, la cabecera del panel de la pista la pone este módulo
    init: function (api, input, saved) {
      if (!window.ESQUEMA) return false;
      A = api; E = window.ESQUEMA;
      U = { types: {}, chains: {}, auto: {}, vol: {}, live: {}, fold: {}, labels: {}, cur: null, lastMem: 0 };
      E.fxTypes.forEach(function (t) { U.types[t.id] = t; });
      if (!document.getElementById('afx-style')) { var st = document.createElement('style'); st.id = 'afx-style'; st.textContent = CSS; document.head.appendChild(st); }
      saved = saved || {};
      Object.keys(saved.chains || {}).forEach(function (id) {
        var nodes = ((saved.chains[id] || {}).nodes || []).filter(function (n) { return n && U.types[n.type]; }), c = { version: 1, nodes: [] };
        nodes.forEach(function (n) { var o = copy(n); o.id = o.id || newId(c); o.enabled = n.enabled !== false; o.params = normParams(n.type, n.params); c.nodes.push(o); });
        if (nodes.length) U.chains[id] = c;
      });
      Object.keys(saved.automation || {}).forEach(function (id) {
        var ls = ((saved.automation[id] || {}).lanes || []).filter(function (l) { return l && typeof l.target === 'string' && Array.isArray(l.points); });
        if (ls.length) U.auto[id] = { version: 1, lanes: copy(ls) };
      });
      Object.keys(saved.volume || {}).forEach(function (id) { if (typeof saved.volume[id] === 'number') U.vol[id] = saved.volume[id]; });
      panelEvents();
      A.api('/api/edicion').then(function (d) {
        ((d.audio || {}).input || {}).stems && d.audio.input.stems.forEach(function (s) { U.labels[s.id] = s.label; });
      }).catch(function () {});
      syncAll();
      return true;
    },
    inspector: function (sel) {
      return '<h3>' + (sel.id === 'voice' ? 'Vídeo y voz' : 'Pista: ' + A.esc(name(sel.id))) + '</h3><div class="q">Volumen y efectos de la pista</div>';
    },
    designExtra: function (sel) {
      var id = targetOf(sel);
      if (!id) { U.cur = null; return ''; }
      return panel(id);
    },
    labelExtra: function (id) { return id === 'voice' && !plugin('audio') && U.vol.voice != null ? ' <span class="tl-db">' + fmtDb(lin(U.vol.voice)) + '</span>' : ''; },
    lanes: function () {
      follow();
      var T = A.state(), w = T.width + 60, out = '';
      Object.keys(U.auto).forEach(function (id) {
        U.auto[id].lanes.forEach(function (l) {
          var r = rangeOf(id, l.target);
          if (!r) return;
          var nm = name(id) + ' · ' + (r.vol ? 'Volumen' : r.label);
          out += '<div class="tl-lane"><div class="tl-lab afx-lab"' + (isLib(id) ? '' : ' data-pick="aud" data-id="' + A.esc(id) + '"') + ' style="height:' + LANE_H + 'px"><span class="n" title="' + A.esc(nm) + '">' + A.esc(nm) + '</span>' +
            '<button class="afx-x" data-keep-drag data-p="audiofx" data-b="lane-x" data-t="' + A.esc(id) + '" data-l="' + A.esc(l.target) + '" title="Quitar estos cambios">×</button></div>' +
            '<div class="tl-track afx-track" data-keep-drag data-t="' + A.esc(id) + '" data-l="' + A.esc(l.target) + '" style="width:' + w + 'px;height:' + LANE_H + 'px" title="Clic: añadir punto · Arrastrar · Alt+clic: borrar">' + laneSvg(id, l) + '</div></div>';
        });
      });
      return out;
    },
    helpExtra: function () { return '<b>Efectos de audio:</b> toca una pista de audio para añadirle efectos y hacer que el volumen o un efecto cambien con el tiempo.<br>'; },
    onPlay: function (t) { syncAll(); automate(t); },
    onTick: function (t) {
      // una capa libre tiene sus nodos cuando empieza a sonar: se engancha entonces
      Object.keys(U.chains).concat(Object.keys(U.auto)).forEach(function (id) { if (isLib(id) && !U.live[id]) sync(id); });
      automate(t);
    },
    onClick: function (b) { if (b.dataset.b) act(b); },
    onInput: function (el) {
      var k = el.dataset.k, id = U.cur, n = Date.now();
      if (k !== 'par' && k !== 'vol') return;
      if (n - U.lastMem > 800) A.remember();
      U.lastMem = n;
      var T = A.state(), lab;
      if (k === 'vol') {
        U.vol[id] = +el.value;
        lab = T.el.insp.querySelector('[data-afv="vol"]');
        if (lab) lab.textContent = fmtDb(lin(+el.value));
        if (id === 'voice') T.el.root.querySelectorAll('.tl-lab.tl-v .tl-db').forEach(function (d) { d.textContent = fmtDb(lin(+el.value)); });
      } else {
        var nd = nodeOf(id, el.dataset.n), d = param(nd.type, el.dataset.q), r = { min: d.min, max: d.max, step: d.step, unit: d.unit, scale: d.scale === 'log' && d.min > 0 ? 'log' : 'linear' };
        var v = fromN(r, +el.value / 1000);
        v = clamp(Math.round(v / d.step) * d.step, d.min, d.max);
        nd.params[d.key] = Math.round(v * 10000) / 10000;
        lab = T.el.insp.querySelector('[data-afv="' + nd.id + '.' + d.key + '"]');
        if (lab) lab.textContent = fmtV(r, nd.params[d.key]);
      }
      A.touched('audiofx');                   // sin repintar el panel, o la barra se suelta
      sync(id);
    },
    onChange: function (el) {
      var k = el.dataset.k, id = U.cur;
      if (k === 'add' && el.value) {
        A.remember();
        var c = chain(id, true), t = el.value, nid = newId(c);
        c.nodes.push({ id: nid, type: t, enabled: true, params: normParams(t, null) });
        delete U.fold[id + '/' + nid];
        touch(id);
      } else if (k === 'preset' && el.value) {
        A.remember();
        setPreset(id, el.value);
        touch(id, true);
      } else if (k === 'on') {
        A.remember();
        nodeOf(id, el.dataset.n).enabled = el.checked;
        touch(id);
      } else if (k === 'enum') {
        A.remember();
        nodeOf(id, el.dataset.n).params[el.dataset.q] = el.value;
        A.touched('audiofx'); sync(id);
      }
    },
    snap: function () { return { c: copy(U.chains), a: copy(U.auto), v: copy(U.vol) }; },
    restore: function (s) { U.chains = copy(s.c); U.auto = copy(s.a); U.vol = copy(s.v); syncAll(); },
    data: function () {
      follow();
      var chains = {}, automation = {};
      Object.keys(U.chains).forEach(function (id) { if (U.chains[id].nodes.length) chains[id] = copy(U.chains[id]); });
      Object.keys(U.auto).forEach(function (id) {
        var ls = U.auto[id].lanes.filter(function (l) { return l.points.length; });
        if (ls.length) automation[id] = { version: 1, lanes: copy(ls) };
      });
      return { chains: chains, automation: automation, volume: copy(U.vol) };
    }
  });
})();
