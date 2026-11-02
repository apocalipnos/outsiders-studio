// Módulo "Referencia": el vídeo de referencia dentro de la Edición, al lado de la vista previa o encima y semitransparente, siguiendo al
// cursor; y su ficha (ficha.py, edicion/referencia.json) comparada con tu vídeo. Lo que el usuario deja va a referencia_edit.json:
//   {src, modo: 'off'|'lado'|'encima', opacidad, offset}   offset = segundo de la referencia menos segundo del montaje
(function () {
  var NOTA = { tipografia: 'Tipografía', subtitulos: 'Subtítulos', elementos: 'Elementos', estructura: 'Estructura', ritmo: 'Ritmo' };
  var A, R, FILAS = [['duracion', 'Duración', ' s'], ['palabras_seg', 'Palabras por segundo', '']];
  var CSS = '.rf-side{position:relative;flex:none;margin-right:12px;background:#000;overflow:hidden}.rf-side video{width:100%;height:100%;object-fit:contain;display:block}' +
    '.rf-bar{position:absolute;left:6px;right:6px;bottom:6px;display:flex;gap:5px;align-items:center;background:rgba(0,0,0,.72);border-radius:6px;padding:3px 6px;color:#fff;font-size:10px}.rf-bar input{flex:1;min-width:30px;accent-color:var(--a)}.rf-bar button{padding:1px 6px;font-size:10px}' +
    '.st-tb.rf-has{color:var(--t1)}.rf-tag{position:absolute;left:6px;top:6px;background:rgba(0,0,0,.72);color:#fff;font-size:10px;padding:2px 7px;border-radius:99px}' +
    '.rf-over{position:absolute;inset:0;z-index:30;pointer-events:none}.rf-over video{width:100%;height:100%;object-fit:contain}' +
    '.rf-t{width:100%;border-collapse:collapse;font-size:11px;margin:4px 0 10px}.rf-t th{color:var(--t3);font-weight:500;text-align:right;padding:3px 0 3px 8px}.rf-t th:first-child,.rf-t td:first-child{text-align:left;padding-left:0}.rf-t td{padding:4px 0 4px 8px;text-align:right;border-top:1px solid var(--b0);color:var(--t1)}.rf-t td:first-child{color:var(--t2)}.rf-t td.far{color:#fbbf24;font-weight:600}' +
    '.rf-col{display:flex;gap:4px;margin:4px 0 10px}.rf-col i{width:24px;height:24px;border-radius:5px;border:1px solid var(--b1);display:block}.rf-n{font-size:11px;color:var(--t2);line-height:1.5;margin:0 0 6px}.rf-n b{color:var(--t1);font-weight:600}.rf-v{width:100%;border-radius:6px;background:#000;max-height:190px;display:block;margin-bottom:8px}';

  function dur() { return R.v && isFinite(R.v.duration) ? R.v.duration : 0; }
  function refT(t) { return A.clamp(t + R.offset, 0, dur() || 1e6); }
  function sync(t, force) {
    if (!R.v || R.modo === 'off' || !R.v.src) return;
    var want = refT(t);
    if (force || Math.abs(R.v.currentTime - want) > (A.state().playing ? .2 : .04)) { try { R.v.currentTime = want; } catch (e) {} }
    var pos = R.side && R.side.querySelector('.rf-pos');
    if (pos && document.activeElement !== pos) pos.value = want;
    var lab = R.side && R.side.querySelector('.rf-time');
    if (lab) lab.textContent = A.fmtS(want);
  }
  function place() {
    var T = A.state();
    if (!R.v) {
      R.v = document.createElement('video');
      R.v.preload = 'auto'; R.v.playsInline = true; R.v.muted = true;
      R.v.addEventListener('loadedmetadata', function () { var p = R.side.querySelector('.rf-pos'); if (p) p.max = dur(); sync(T.t, true); });
      R.side = document.createElement('div');
      R.side.className = 'rf-side'; R.side.hidden = true;
      R.side.innerHTML = '<span class="rf-tag">Referencia</span><div class="rf-bar"><span class="rf-time">00:00</span><input class="rf-pos" type="range" min="0" step="0.033" data-p="referencia" data-k="pos" title="Elige qué momento de la referencia va con el cursor"><button data-p="referencia" data-k="mute">Oír</button></div>';
      T.el.stagewrap.insertBefore(R.side, T.el.screen);
      R.over = document.createElement('div');
      R.over.className = 'rf-over'; R.over.hidden = true;
      T.el.stage.appendChild(R.over);
    }
    if (R.src && R.v.dataset.src !== R.src) { R.v.dataset.src = R.src; R.v.src = A.url(R.src); }
    var lado = R.modo === 'lado', encima = R.modo === 'encima';
    if (lado && R.v.parentNode !== R.side) R.side.insertBefore(R.v, R.side.firstChild);
    if (encima && R.v.parentNode !== R.over) R.over.appendChild(R.v);
    R.side.hidden = !lado; R.over.hidden = !encima;
    R.over.style.opacity = R.opacidad;
    if (R.modo === 'off') R.v.pause();
    A.fit();
    sync(T.t, true);
    var b = T.el.ptools.querySelector('[data-k=cycle]');
    if (b) { b.classList.toggle('on', R.modo !== 'off'); b.classList.toggle('rf-has', !!R.src); b.textContent = R.modo === 'lado' ? 'Referencia: al lado' : R.modo === 'encima' ? 'Referencia: encima' : 'Referencia'; }
  }
  // la del proyecto entra sola; las demás descargas se pueden elegir, y un enlace se baja aquí mismo
  function cargarLista() {
    return A.api('/api/referencias').then(function (d) {
      d.proyecto.forEach(function (p) { if (R.lista.indexOf(p) < 0) R.lista.push(p); });
      R.descargas = d.descargas;
      if (!R.src && R.lista.length) { R.src = R.lista[0]; place(); }
      if (A.state().rtab === 'referencia') A.refresh();
    }).catch(function () {});
  }
  function usar(path, ver) {
    if (R.lista.indexOf(path) < 0) R.lista.push(path);
    R.src = path; R.offset = 0; A.touched('referencia');
    if (ver) R.modo = R.modo === 'off' ? 'lado' : R.modo;
    place(); cargarLista();
    A.refresh();
  }
  function setModo(m) {
    if (m !== 'off' && !R.src) { A.showRight('referencia'); A.toast('Elige antes un vídeo de referencia'); return; }
    R.modo = m; A.touched('referencia'); place();
    if (A.state().rtab === 'referencia') A.refresh();
  }
  // ---------- comparación con tu vídeo ----------
  function mio() {
    var T = A.state();
    return { duracion: Math.round(T.total * 100) / 100, palabras_seg: R.words != null && T.total ? Math.round(R.words / T.total * 100) / 100 : null };
  }
  function lejos(a, b) { return a != null && b != null && b > 0 && Math.abs(a - b) / b > .35; }
  function panel(el) {
    var F = R.ficha, h = '';
    if (R.src) h += '<video class="rf-v" controls muted src="' + A.esc(A.url(R.src)) + '"></video>';
    h += '<div class="tl-row"><label>Vídeo</label><select data-p="referencia" data-k="src" style="flex:1;min-width:0"><option value="">Elige un vídeo…</option>' + (R.lista.length ? '<optgroup label="En este proyecto">' + R.lista.map(function (s) { return '<option value="' + A.esc(s) + '"' + (s === R.src ? ' selected' : '') + '>' + A.esc(s.split('/').pop()) + '</option>'; }).join('') + '</optgroup>' : '') +
      (R.descargas.length ? '<optgroup label="Descargas recientes">' + R.descargas.map(function (d) { return '<option value="dl:' + A.esc(d.name) + '">' + A.esc(d.name) + '</option>'; }).join('') + '</optgroup>' : '') + '</select><button data-p="referencia" data-k="up">Subir</button></div>' +
      '<div class="tl-row"><label>Enlace</label><input class="st-in" style="flex:1;min-width:0" placeholder="Pega un enlace de TikTok o Instagram" data-p="referencia" data-k="urlt" value="' + A.esc(R.urlTxt) + '"><button data-p="referencia" data-k="url"' + (R.bajando ? ' disabled' : '') + '>' + (R.bajando ? 'Bajando…' : 'Cargar') + '</button></div>' +
      '<div class="tl-acts">' + [['off', 'Ocultar'], ['lado', 'Al lado'], ['encima', 'Encima']].map(function (x) { return '<button data-p="referencia" data-k="modo" data-v="' + x[0] + '" class="' + (R.modo === x[0] ? 'on' : '') + '">' + x[1] + '</button>'; }).join('') + '</div>' +
      '<div class="tl-row"><label>Opacidad</label><input class="st-sl" type="range" min=".1" max="1" step=".05" value="' + R.opacidad + '" data-p="referencia" data-k="op"><span class="v rf-opv">' + Math.round(R.opacidad * 100) + ' %</span></div>' +
      '<div class="help">Sigue al cursor. Si no coinciden los momentos, elige el bueno en la barra de la referencia y queda alineada. El botón Oír activa su sonido.</div>';
    if (F) {
      var m = F.metricas || {}, y = mio();
      h += '<div class="tl-sub"><h4>Referencia frente a tu vídeo</h4><table class="rf-t"><tr><th></th><th>Referencia</th><th>Tu vídeo</th></tr>' + FILAS.filter(function (f) { return m[f[0]] != null; }).map(function (f) {
        return '<tr><td>' + f[1] + '</td><td>' + m[f[0]] + f[2] + '</td><td class="' + (lejos(y[f[0]], m[f[0]]) ? 'far' : '') + '">' + (y[f[0]] == null ? '–' : y[f[0]] + f[2]) + '</td></tr>';
      }).join('') + '</table>' +
      ((F.colores || []).length ? '<div class="rf-col">' + F.colores.map(function (c) { return '<i style="background:' + A.esc(c) + '" title="' + A.esc(c) + '"></i>'; }).join('') + '</div>' : '') +
      Object.keys(F.notas || {}).filter(function (k) { return F.notas[k]; }).map(function (k) { return '<p class="rf-n"><b>' + A.esc(NOTA[k] || k) + ':</b> ' + A.esc(F.notas[k]) + '</p>'; }).join('') +
      ((F.no_igualable || []).length ? '<p class="rf-n"><b>No se puede igualar:</b> ' + A.esc(F.no_igualable.join(' · ')) + '</p>' : '') +
      (F.correccion ? '<p class="rf-n"><b>Tu corrección:</b> ' + A.esc(F.correccion) + '</p>' : '') + '</div>';
    }
    el.innerHTML = h;
  }

  Timeline.use({
    id: 'referencia',
    right: { id: 'referencia', label: 'Referencia' },
    init: function (api, input, saved) {
      A = api;
      saved = saved || {};
      var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
      R = { ficha: input && input.metricas ? input : null, src: saved.src || (input && input.video) || '', modo: saved.modo || 'off', opacidad: saved.opacidad == null ? .5 : saved.opacidad, offset: saved.offset || 0, lista: [], descargas: [], urlTxt: '', bajando: false, words: null };
      if (R.src) R.lista.push(R.src);
      cargarLista();
      fetch('/p/words.json').then(function (r) { return r.ok ? r.json() : []; }).then(function (w) { R.words = w.length || null; }).catch(function () {});
      setTimeout(function () { place(); }, 0);
      window.MiReferencia = {
        // lo que usa Revisar: tu vídeo muy lejos de la duración de la referencia
        avisos: function () {
          if (!R.ficha) return [];
          var m = R.ficha.metricas || {}, y = mio(), out = [];
          if (lejos(y.duracion, m.duracion)) out.push({ sev: 'info', msg: 'Tu vídeo dura ' + y.duracion + ' s y la referencia ' + m.duracion + ' s.', fix: 'Solo si quieres acercarte: no hace falta que dure lo mismo.' });
          return out;
        }
      };
      return true;
    },
    toolbar: function () { return '<button class="st-tb st-txt" data-p="referencia" data-k="cycle" title="Ver la referencia junto a tu vídeo o encima">Referencia</button>'; },
    rightRender: panel,
    paint: function (t) { if (R.modo !== 'off') sync(t); },
    onPlay: function (t) { if (R.modo === 'off' || !R.v.src) return; sync(t, true); R.v.playbackRate = A.state().rate; R.v.play().catch(function () {}); },
    onStop: function () { if (R.v) { R.v.pause(); sync(A.state().t, true); } },
    onTick: function (t) { if (R.modo !== 'off') sync(t); },
    onClick: function (b) {
      var k = b.dataset.k;
      if (k === 'cycle') setModo(R.modo === 'off' ? 'lado' : R.modo === 'lado' ? 'encima' : 'off');
      else if (k === 'modo') setModo(b.dataset.v);
      else if (k === 'mute') { R.v.muted = !R.v.muted; b.textContent = R.v.muted ? 'Oír' : 'Silenciar'; }
      else if (k === 'url') {
        if (!R.urlTxt.trim()) return A.toast('Pega antes el enlace', true);
        R.bajando = true; A.refresh();
        A.api('/api/referencias/url', { url: R.urlTxt.trim() }).then(function (d) {
          R.bajando = false; R.urlTxt = ''; usar(d.path, true); A.toast('Referencia cargada');
        }).catch(function (e) { R.bajando = false; A.refresh(); A.toast(e.message, true); });
      }
      else if (k === 'up') {
        var i = document.createElement('input'); i.type = 'file'; i.accept = 'video/*';
        i.onchange = function () {
          var f = i.files[0];
          if (!f) return;
          A.toast('Subiendo ' + f.name + '…');
          fetch('/api/upload?name=' + encodeURIComponent(f.name), { method: 'POST', body: f }).then(function (r) { return r.json(); }).then(function (d) {
            if (!d.path) throw new Error(d.error || 'No se pudo subir');
            usar(d.path, true);
          }).catch(function (e) { A.toast(e.message, true); });
        };
        i.click();
      }
    },
    onInput: function (el) {
      var k = el.dataset.k;
      if (k === 'urlt') R.urlTxt = el.value;
      else if (k === 'pos') {                        // elegir el momento de la referencia la alinea con el cursor
        R.offset = +el.value - A.state().t;
        if (R.v) R.v.currentTime = +el.value;
        var lab = R.side.querySelector('.rf-time'); if (lab) lab.textContent = A.fmtS(+el.value);
        A.touched('referencia');
      } else if (k === 'op') {
        R.opacidad = +el.value;
        if (R.over) R.over.style.opacity = R.opacidad;
        var v = document.querySelector('.rf-opv'); if (v) v.textContent = Math.round(R.opacidad * 100) + ' %';
        A.touched('referencia');
      }
    },
    onChange: function (el) {
      if (el.dataset.k !== 'src') return;
      if (el.value.indexOf('dl:') === 0) {
        A.api('/api/referencias/usar', { name: el.value.slice(3) }).then(function (d) { usar(d.path, true); }).catch(function (e) { A.toast(e.message, true); });
        return;
      }
      R.src = el.value; R.offset = 0; A.touched('referencia'); if (!R.src) R.modo = 'off'; place(); A.refresh();
    },
    helpExtra: function () { return '<b>Referencia:</b> el botón Referencia, sobre la vista previa, la pone al lado de tu vídeo o encima y semitransparente. Su pestaña trae lo que se sacó de ella.<br>'; },
    data: function () { return { src: R.src, modo: R.modo, opacidad: R.opacidad, offset: Math.round(R.offset * 1000) / 1000 }; }
  });
})();
