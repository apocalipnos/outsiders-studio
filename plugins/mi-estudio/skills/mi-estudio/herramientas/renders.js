// Módulo "Renders" de la Edición: exportar sin pasar por Claude (aplica los JSON al HTML y lanza el render de HyperFrames),
// con su progreso, y el historial de la carpeta renders/. El render directo no remonta: los cortes piden Procesar vídeo.
(function () {
  var A, R = { list: [], fmt: 'mp4', fps: 30, q: 'high', name: '', st: null, timer: 0, hide: false, ask: null, opts: {}, stopped: false, el: null };
  var KEY = 'mi-estudio-renders';
  var CSS = '.rn-w{padding:7px 9px;margin-bottom:10px;border-radius:7px;font-size:11px;line-height:1.45;background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.4);color:#fcd34d}.rn-w.soft{background:var(--card2);border-color:var(--b1);color:var(--t2)}' +
    '.rn-in{flex:1;min-width:0}.rn-sel{flex:1;min-width:0}.rn-go{width:100%;margin-top:6px;padding:7px 10px;background:var(--a);border:0;color:#09090b;font-weight:600}.rn-go:hover:not(:disabled){filter:brightness(1.1)}.rn-go:disabled{background:var(--b1);color:var(--t3)}' +
    '.rn-p{margin-top:8px;font-size:11px;color:var(--t2)}.rn-p .l{display:flex;align-items:center;gap:6px;margin-bottom:4px}.rn-p .l span{flex:1;min-width:0}.rn-p .l button{padding:2px 7px;font-size:11px;flex:none}.rn-b{height:5px;background:var(--b1);border-radius:3px;overflow:hidden}.rn-b i{display:block;height:100%;width:0;background:var(--a);transition:width .25s}.rn-b.ind i{width:30%!important;animation:rn-ind 1.2s linear infinite}@keyframes rn-ind{from{margin-left:-30%}to{margin-left:100%}}' +
    '.rn-err{margin-top:8px;padding:6px 8px;font-size:10.5px;line-height:1.4;color:#fca5a5;background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.3);border-radius:6px;white-space:pre-wrap;word-break:break-word;max-height:120px;overflow:auto;user-select:text}' +
    '.rn-h{display:flex;align-items:center;margin-bottom:6px;font-size:10.5px;color:var(--t3)}.rn-h span{flex:1}.rn-h button{padding:2px 7px;font-size:10.5px}' +
    '.rn-c{padding:7px 8px;margin-bottom:5px;background:var(--card2);border:1px solid var(--b0);border-radius:7px}.rn-c b{display:block;font-size:11px;font-weight:600;word-break:break-all}.rn-c small{display:block;font-size:10px;color:var(--t3);margin-top:1px}.rn-a{display:flex;gap:3px;flex-wrap:wrap;margin-top:5px}.rn-a button,.rn-a a{padding:2px 7px;font-size:10.5px;font-weight:500;border:1px solid var(--b1);border-radius:5px;background:none;color:var(--t2);text-decoration:none}.rn-a button:hover,.rn-a a:hover{color:var(--t1);border-color:var(--b2)}.rn-a .warn{border-color:rgba(239,68,68,.5);color:#fca5a5}' +
    '.rn-e{color:var(--t3);font-size:11px;padding:10px 2px}.rn-win{position:fixed;inset:0;z-index:95;background:rgba(0,0,0,.82);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px}.rn-win video{max-width:92vw;max-height:84vh;border-radius:8px;background:#000}.rn-win div{display:flex;gap:8px;align-items:center;color:var(--t2);font-size:11px}.rn-win button{padding:4px 10px;font-size:11px}';

  function kb(n) { return n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1).replace('.', ',') + ' MB'; }
  function ago(sec) {
    var d = Date.now() / 1000 - sec, u = function (n, s, p) { n = Math.max(1, Math.round(n)); return 'hace ' + n + ' ' + (n === 1 ? s : p); };
    return d < 60 ? 'hace un momento' : d < 3600 ? u(d / 60, 'minuto', 'minutos') : d < 86400 ? u(d / 3600, 'hora', 'horas') : u(d / 86400, 'día', 'días');
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
  function cmd(r) {                          // la orden equivalente, con las opciones con que se lanzó si las sabemos
    var o = R.opts[r.name] || {}, ext = (/\.(\w+)$/.exec(r.name) || [0, 'mp4'])[1];
    return 'npx hyperframes render -o "renders/' + r.name + '" --format ' + ext + (o.quality ? ' --quality ' + o.quality : '') + (o.fps ? ' --fps ' + o.fps : '');
  }
  function clean(s) {                        // un fragmento tal como saldría en edl.json (sin lo interno del núcleo)
    var c = {};
    Object.keys(s).sort().forEach(function (k) { if (k[0] !== '_' && k !== 'off') c[k] = k === 'in' || k === 'out' ? Math.round(s[k] * 1000) / 1000 : s[k]; });
    return c;
  }
  function cutsChanged() {                   // sin Timeline.data(): rehace T.L y en plena reproducción saltaría al principio
    var T = A.state(), a = T.segs.filter(function (s) { return !s.off; }).map(clean), b = T.project.edl.map(clean);
    return JSON.stringify(a) !== JSON.stringify(b);
  }
  function warn() {
    var other = (Timeline.dirty ? Timeline.dirty() : []).filter(function (k) { return k !== 'pistas'; });
    if (cutsChanged()) return '<div class="rn-w"><b>Hay cortes sin procesar.</b> Exportar desde aquí no vuelve a montar el vídeo, así que saldría con el último montaje. Usa <b>Procesar vídeo</b> para que Claude lo monte de nuevo.</div>';
    return other.length ? '<div class="rn-w soft">Cambiado sin procesar: ' + A.esc(other.join(', ')) + '. Se aplica lo que esté en los JSON; lo que Claude tenga que montar pide Procesar vídeo.</div>' : '';
  }
  function select(k, opts, cur) {
    return '<select class="rn-sel" data-p="renders" data-k="' + k + '">' + opts.map(function (o) { return '<option value="' + o[0] + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>';
  }
  function progress() {
    var s = R.st;
    if (s && s.running) {
      var pct = s.pct == null ? null : s.pct;
      return '<div class="rn-p"><div class="l"><span class="rn-pt">' + (R.stopped ? 'Cancelando…' : 'Exportando' + (pct == null ? '…' : ' · ' + pct + ' %') + ' · ' + s.elapsed + ' s') + '</span><button data-p="renders" data-k="cancel">Cancelar</button></div><div class="rn-b' + (pct == null ? ' ind' : '') + '"><i style="width:' + (pct || 0) + '%"></i></div></div>';
    }
    if (s && s.error && !R.stopped && R.mine) return '<div class="rn-err">' + A.esc(s.error) + '</div>';
    return '';
  }
  function hist() {
    if (!R.list.length) return '<div class="rn-e">Aún no hay vídeos exportados.</div>';
    var head = '<div class="rn-h"><span>' + R.list.length + (R.list.length === 1 ? ' render' : ' renders') + '</span><button data-p="renders" data-k="hide" title="Los archivos siguen en la carpeta renders/">' + (R.hide ? 'Ver terminados' : 'Ocultar terminados') + '</button></div>';
    if (R.hide) return head;
    return head + R.list.map(function (r) {
      return '<div class="rn-c"><b>' + A.esc(r.name) + '</b><small>' + kb(r.size) + ' · ' + ago(r.mtime) + '</small><div class="rn-a">' +
        '<button data-p="renders" data-k="play" data-n="' + A.esc(r.name) + '">Reproducir</button><a href="' + A.esc(r.url) + '" download="' + A.esc(r.name) + '">Descargar</a>' +
        '<button data-p="renders" data-k="cmd" data-n="' + A.esc(r.name) + '">Copiar comando</button>' +
        (R.ask === r.name ? '<button class="warn" data-p="renders" data-k="del" data-n="' + A.esc(r.name) + '">¿Borrar del disco?</button><button data-p="renders" data-k="nodel">No</button>' : '<button data-p="renders" data-k="ask" data-n="' + A.esc(r.name) + '">Borrar</button>') + '</div></div>';
    }).join('');
  }
  function paint() {
    var el = R.el;
    if (!el || A.state().rtab !== 'renders') return;
    var run = R.st && R.st.running, proj = A.state().project.name;
    el.innerHTML = warn() +
      A.section('rn-exp', 'Nuevo vídeo',
        '<div class="tl-row"><label>Formato</label>' + select('fmt', [['mp4', 'MP4'], ['webm', 'WebM'], ['mov', 'MOV']], R.fmt) + '</div>' +
        '<div class="tl-row"><label>Fotogramas</label>' + select('fps', [[24, '24 fps'], [30, '30 fps'], [60, '60 fps']], R.fps) + '</div>' +
        '<div class="tl-row"><label>Calidad</label>' + select('q', [['draft', 'Borrador'], ['standard', 'Normal'], ['high', 'Alta']], R.q) + '</div>' +
        '<div class="tl-row"><label>Nombre</label><input class="st-in rn-in" data-p="renders" data-k="name" value="' + A.esc(R.name) + '" placeholder="' + A.esc(proj) + '-…"></div>' +
        '<button class="rn-go" data-p="renders" data-k="go"' + (run ? ' disabled' : '') + '>' + (run ? 'Exportando…' : 'Exportar') + '</button><div class="rn-pb">' + progress() + '</div>') +
      A.section('rn-his', 'Vídeos exportados', hist());
  }
  function load() { return A.api('/api/renders').then(function (l) { R.list = l; A.refresh(); }).catch(function () {}); }
  function poll() {
    clearTimeout(R.timer);
    A.api('/api/render/status').then(function (s) {
      var was = R.st && R.st.running;
      R.st = s;
      if (s.running) {
        R.mine = true;                       // el error de un render de antes de abrir la página no se enseña
        var box = R.el && A.state().rtab === 'renders' && R.el.querySelector('.rn-pb');
        if (box) {                           // solo la barra: repintar todo se lleva por delante lo que estés tocando
          if (box.firstChild) {
            var t = box.querySelector('.rn-pt'), bar = box.querySelector('.rn-b');
            if (t && !R.stopped) t.textContent = 'Exportando' + (s.pct == null ? '…' : ' · ' + s.pct + ' %') + ' · ' + s.elapsed + ' s';
            if (bar) { bar.classList.toggle('ind', s.pct == null); bar.firstChild.style.width = (s.pct || 0) + '%'; }
          } else box.innerHTML = progress();
        }
        R.timer = setTimeout(poll, 1000);
        return;
      }
      if (was) {
        if (s.output) {
          remember(s.output);
          A.toast(s.cierra ? 'Vídeo exportado. Claude lo comprueba y te lo entrega; ya puedes cerrar esta pestaña.' : 'Vídeo exportado: ' + s.output);
          var sb = document.getElementById('saveBtn');
          if (s.cierra && sb) { sb.textContent = 'Enviado ✓'; sb.disabled = true; }
        }
        else if (R.stopped) { A.toast('Exportación cancelada'); R.st = { running: false }; }
        else if (s.error) A.toast('La exportación falló', true);
        load();
      }
      R.stopped = false;
      A.refresh();
    }).catch(function () { R.timer = setTimeout(poll, 3000); });
  }
  function go() {
    var body = { format: R.fmt, quality: R.q, fps: +R.fps, name: R.name };
    A.stop();
    R.stopped = false;
    A.api('/api/render', { opts: body, edicion: Timeline.data().edicion }).then(function () {
      R.pending = body; R.mine = true;
      R.st = { running: true, pct: null, elapsed: 0 };
      A.refresh();
      poll();
    }).catch(function (e) { A.toast(e.message, true); });
  }
  function remember(out) {                   // qué opciones llevó cada render, para poder copiar su orden
    if (!R.pending) return;
    R.opts[out.split('/').pop()] = { quality: R.pending.quality, fps: R.pending.fps };
    R.pending = null;
    try { localStorage.setItem(KEY, JSON.stringify(R.opts)); } catch (e) {}
  }
  function byName(n) { return R.list.filter(function (r) { return r.name === n; })[0]; }
  function watch(r) {
    var d = document.createElement('div');
    d.className = 'rn-win';
    d.innerHTML = '<video controls autoplay src="' + A.esc(r.url) + '"></video><div>' + A.esc(r.name) + '<button>Cerrar</button></div>';
    d.addEventListener('click', function (e) { if (e.target === d || e.target.tagName === 'BUTTON') d.remove(); });
    A.stop();
    document.body.appendChild(d);
  }

  Timeline.use({
    id: 'renders',
    right: { id: 'renders', label: 'Exportar', count: function () { return R.list.length; } },
    init: function (api) {
      A = api;
      var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
      try { R.opts = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) {}
      load();
      poll();                                // por si al abrir ya hay uno en marcha
      window.MiRenders = { exportar: function () { A.showRight('renders'); go(); } };   // el botón de arriba, cuando no hace falta Claude
      return true;
    },
    rightRender: function (el) {
      R.el = el;
      var ae = document.activeElement;       // el núcleo repinta el panel a menudo: no quites el campo que se está usando
      if (el.querySelector('.rn-in') && el.contains(ae) && /INPUT|SELECT/.test(ae.tagName)) return;
      paint();
    },
    onClick: function (b) {
      var k = b.dataset.k, n = b.dataset.n;
      if (k === 'go') go();
      else if (k === 'cancel') { R.stopped = true; A.api('/api/render/cancel', {}).catch(function (e) { A.toast(e.message, true); }); paint(); }
      else if (k === 'hide') { R.hide = !R.hide; paint(); }
      else if (k === 'play') watch(byName(n));
      else if (k === 'cmd') copy(cmd(byName(n)), 'Orden copiada');
      else if (k === 'ask') { R.ask = n; paint(); }
      else if (k === 'nodel') { R.ask = null; paint(); }
      else if (k === 'del') {
        R.ask = null;
        A.api('/api/renders/delete', { name: n }).then(function () { A.toast('Borrado: ' + n); return load(); }).catch(function (e) { A.toast(e.message, true); paint(); });
      }
    },
    onInput: function (el) { if (el.dataset.k === 'name') R.name = el.value; },
    onChange: function (el) { R[el.dataset.k] = el.value; }
  });
})();
