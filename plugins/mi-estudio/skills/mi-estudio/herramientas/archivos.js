// Módulo "Archivos" de la Edición (el Code de HyperFrames Studio): el árbol del proyecto en la barra lateral y un editor de
// texto en una ventana sobre la vista previa. Solo se guardan JSON y notas (POST /api/file); el HTML sale de los JSON.
(function () {
  var A, F = { list: null, err: null, open: { edicion: true }, dir: 'edicion', form: null, win: null, el: null };
  var KEEP = '.keep.txt', BIG = 400000, LH = 18;
  var IMG = /\.(png|jpe?g|webp|gif|svg)$/i, VID = /\.(mp4|mov|webm|m4v)$/i, AUD = /\.(mp3|wav|m4a|aac|ogg)$/i, FNT = /\.(woff2?|ttf|otf)$/i;
  var RELOAD = /^(edl|timeline|words)\.json$|^edicion\/[^/]+\.json$/;
  var CSS = '.st-center{position:relative}' +
    '.ar-top{display:flex;gap:4px;align-items:center;margin-bottom:6px;color:var(--t3);font-size:11px}.ar-top span{flex:1}.ar-top button{padding:3px 7px;font-size:11px}' +
    '.ar-form{display:flex;gap:4px;align-items:center;margin-bottom:6px;flex-wrap:wrap;font-size:10.5px;color:var(--t3)}.ar-form .st-in{flex:1;min-width:110px}.ar-form button{padding:3px 7px;font-size:11px}.ar-form label{width:100%}' +
    '.ar-r{display:flex;align-items:center;border-radius:5px}.ar-r:hover{background:rgba(255,255,255,.05)}.ar-r.act{background:var(--ad)}.ar-r.act .ar-b{color:var(--a)}' +
    '.ar-b{flex:1;min-width:0;display:flex;align-items:center;gap:5px;border:0;background:none;padding:3px 4px;color:var(--t2);font-size:11px;font-weight:400;text-align:left;border-radius:5px}.ar-b:hover{color:var(--t1)}' +
    '.ar-b .n{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ar-b .s{color:var(--t3);font-size:10px;flex:none}' +
    '.ar-ch{font-style:normal;color:var(--t3);width:10px;flex:none;text-align:center;transition:transform .1s}.ar-ch.o{transform:rotate(90deg)}.ar-x{font-style:normal;color:var(--t3);font-size:9px;width:26px;flex:none;text-transform:uppercase}' +
    '.ar-cp{border:0;background:none;color:var(--t3);padding:2px 5px;font-size:10px;opacity:0;flex:none}.ar-r:hover .ar-cp{opacity:1}.ar-cp:hover{color:var(--t1)}' +
    '.ar-win{position:absolute;inset:6px;z-index:30;display:flex;flex-direction:column;background:#0c0c0d;border:1px solid var(--b1);border-radius:8px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.6)}' +
    '.ar-head{display:flex;align-items:center;gap:6px;padding:6px 8px;border-bottom:1px solid var(--b0);font-size:11px;flex:none}.ar-head b{font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}.ar-head span{flex:1;color:#f59e0b;font-size:10.5px;white-space:nowrap}.ar-head button{padding:3px 8px;font-size:11px;flex:none}.ar-head .warn{border-color:rgba(239,68,68,.5);color:#fca5a5}.ar-head .pr{background:var(--a);color:#09090b;border:0;font-weight:600}.ar-head .pr:disabled{background:var(--b1);color:var(--t3)}' +
    '.ar-note{padding:6px 10px;font-size:11px;color:var(--t2);background:var(--card2);border-bottom:1px solid var(--b0);display:flex;gap:8px;align-items:center;flex:none}.ar-note button{padding:2px 8px;font-size:11px;flex:none}.ar-note.go{background:var(--ad);color:var(--a)}' +
    '.ar-body{flex:1;min-height:0;display:flex;font:12px/' + LH + 'px Consolas,Menlo,monospace}' +
    '.ar-gut{flex:none;overflow:hidden;padding:8px 8px 8px 10px;margin:0;color:var(--t3);text-align:right;background:#0f0f10;border-right:1px solid var(--b0);font:inherit;user-select:none}.ar-gut b{color:#fff;background:var(--red);font-weight:400;border-radius:2px;padding:0 2px}' +
    '.ar-code{position:relative;flex:1;min-width:0}.ar-hl,.ar-ta{position:absolute;inset:0;margin:0;padding:8px 10px;font:inherit;white-space:pre;tab-size:2;border:0}' +
    '.ar-hl{overflow:hidden;color:var(--t1);pointer-events:none}.ar-hl i{font-style:normal}.ar-k{color:#7dd3fc}.ar-s{color:#86efac}.ar-n{color:#fbbf24}.ar-b_{color:#c4b5fd}' +
    '.ar-ta{width:100%;height:100%;overflow:auto;resize:none;outline:0;background:transparent;color:transparent;caret-color:#fff;user-select:text}.ar-ta.plain{color:var(--t1)}.ar-ta::selection{background:rgba(60,230,172,.28);color:transparent}.ar-ta.plain::selection{color:var(--t1)}' +
    '.ar-foot{flex:none;padding:4px 10px;font-size:10.5px;color:var(--t3);border-top:1px solid var(--b0);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.ar-foot.bad{color:#fca5a5}' +
    '.ar-media{flex:1;min-height:0;display:grid;place-items:center;padding:12px;overflow:auto;color:var(--t2)}.ar-media img,.ar-media video{max-width:100%;max-height:100%;display:block;border-radius:6px}.ar-media audio{width:min(420px,90%)}.ar-sample{font-size:44px;line-height:1.25;text-align:center}';

  function url(p) { return '/p/' + p.split('/').map(encodeURIComponent).join('/'); }
  function kb(n) { return n < 1024 ? n + ' B' : n < 1048576 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(1).replace('.', ',') + ' MB'; }
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
  function load() {
    return A.api('/api/files').then(function (l) { F.list = l; F.err = null; draw(); }).catch(function (e) { F.err = e.message; draw(); });
  }

  // ---------- árbol ----------
  function tree() {
    var root = { path: '', dirs: {}, files: [] };
    F.list.forEach(function (f) {
      var parts = f.path.split('/'), base = parts.pop(), n = root, cur = '';
      parts.forEach(function (p) {
        cur += (cur ? '/' : '') + p;
        n = n.dirs[p] = n.dirs[p] || { path: cur, dirs: {}, files: [] };
      });
      if (base !== KEEP) n.files.push({ name: base, path: f.path, size: f.size });
    });
    return root;
  }
  function rows(n, d) {
    var pad = 4 + d * 12, html = '', cur = F.win && F.win.path;
    Object.keys(n.dirs).sort().forEach(function (k) {
      var c = n.dirs[k], o = !!F.open[c.path];
      html += '<div class="ar-r"><button class="ar-b" data-p="archivos" data-k="dir" data-path="' + A.esc(c.path) + '" style="padding-left:' + pad + 'px"><i class="ar-ch' + (o ? ' o' : '') + '">›</i><span class="n">' + A.esc(k) + '</span></button>' +
        '<button class="ar-cp" data-p="archivos" data-k="copy" data-path="' + A.esc(c.path) + '" title="Copiar ruta">Copiar</button></div>';
      if (o) html += rows(c, d + 1);
    });
    n.files.forEach(function (f) {
      var ext = (/\.(\w+)$/.exec(f.name) || [0, ''])[1].slice(0, 4);
      html += '<div class="ar-r' + (f.path === cur ? ' act' : '') + '"><button class="ar-b" data-p="archivos" data-k="file" data-path="' + A.esc(f.path) + '" title="' + A.esc(f.path) + '" style="padding-left:' + (pad + 10) + 'px"><i class="ar-x">' + A.esc(ext) + '</i><span class="n">' + A.esc(f.name) + '</span><span class="s">' + kb(f.size) + '</span></button>' +
        '<button class="ar-cp" data-p="archivos" data-k="copy" data-path="' + A.esc(f.path) + '" title="Copiar ruta">Copiar</button></div>';
    });
    return html;
  }
  function draw() {
    var el = F.el;
    if (!el || A.state().ltab !== 'archivos') return;
    var shown = F.list ? F.list.filter(function (f) { return f.path.split('/').pop() !== KEEP; }).length : 0;
    var form = F.form ? '<div class="ar-form"><label>' + (F.form === 'dir' ? 'Carpeta nueva' : 'Archivo nuevo') + ' en ' + A.esc(F.dir) + '/</label><input class="st-in ar-nm" placeholder="' + (F.form === 'dir' ? 'nombre' : 'nombre.json') + '">' +
      '<button data-p="archivos" data-k="make">Crear</button><button data-p="archivos" data-k="nomake">Cancelar</button></div>' : '';
    el.innerHTML = '<div class="ar-top"><span>' + (F.list ? shown + ' archivos' : 'Cargando…') + '</span><button data-p="archivos" data-k="new" title="Crear dentro de edicion/">+ Archivo</button><button data-p="archivos" data-k="newdir" title="Crear dentro de edicion/">+ Carpeta</button><button data-p="archivos" data-k="reload" title="Volver a leer la carpeta">↻</button></div>' + form +
      (F.err ? '<div class="help">' + A.esc(F.err) + '</div>' : F.list ? rows(tree(), 0) : '');
    var nm = el.querySelector('.ar-nm');
    if (nm) {
      nm.focus();
      nm.addEventListener('keydown', function (e) { if (e.key === 'Enter') create(nm.value); else if (e.key === 'Escape') { F.form = null; draw(); } });
    }
  }
  function create(name) {
    name = String(name || '').trim();
    if (!/^[\w][\w. -]*$/.test(name)) return A.toast('Nombre no válido: solo letras, números, puntos y guiones', true);
    var isDir = F.form === 'dir', path = F.dir + '/' + name;
    if (!isDir && !/\.\w+$/.test(name)) path += '.json';
    if (!isDir && !/\.(json|md|txt)$/i.test(path)) return A.toast('Aquí solo se crean .json, .md y .txt', true);
    if (F.list.some(function (f) { return f.path === path || f.path.indexOf(path + '/') === 0; })) return A.toast('Ya existe ' + path, true);
    var body = isDir ? { path: path + '/' + KEEP, text: '' } : { path: path, text: /\.json$/i.test(path) ? '{}\n' : '' };
    A.api('/api/file', body).then(function () {
      F.form = null; F.open[isDir ? path : F.dir] = true;
      if (isDir) F.dir = path;
      A.toast('Creado: ' + path);
      return load();
    }).then(function () { if (!isDir) show(path); }).catch(function (e) { A.toast(e.message, true); });
  }

  // ---------- la ventana ----------
  function close() { if (F.win) { F.win.el.remove(); F.win = null; draw(); } }
  function head(w, extra) {
    return '<div class="ar-head"><b>' + A.esc(w.path) + '</b><span class="ar-flag"></span>' + (extra || '') +
      '<button data-p="archivos" data-k="copy" data-path="' + A.esc(w.path) + '">Copiar ruta</button><button class="ar-cl" data-p="archivos" data-k="close">Cerrar</button></div>';
  }
  function show(path) {
    if (F.win && F.win.dirty) return A.toast('Guarda o descarta primero los cambios de ' + F.win.path, true);
    if (F.win) F.win.el.remove();
    var d = document.createElement('div');
    d.className = 'ar-win';
    A.state().el.center.appendChild(d);
    var w = F.win = { path: path, el: d, dirty: false, saved: '', err: null };
    draw();
    var u = url(path);
    if (IMG.test(path)) d.innerHTML = head(w) + '<div class="ar-media"><img src="' + A.esc(u) + '" alt=""></div>';
    else if (VID.test(path)) d.innerHTML = head(w) + '<div class="ar-media"><video controls src="' + A.esc(u) + '"></video></div>';
    else if (AUD.test(path)) d.innerHTML = head(w) + '<div class="ar-media"><audio controls src="' + A.esc(u) + '"></audio></div>';
    else if (FNT.test(path)) {
      d.innerHTML = head(w) + '<div class="ar-media"><div class="ar-sample">El veloz murciélago hindú<br>ABCDEFG abcdefg 0123456789</div></div>';
      var fam = 'ar-font-' + path.replace(/\W/g, ''), ff = new FontFace(fam, 'url("' + u + '")');
      ff.load().then(function (x) { document.fonts.add(x); var s = d.querySelector('.ar-sample'); if (s) s.style.fontFamily = '"' + fam + '"'; }).catch(function () { A.toast('No se pudo leer la fuente', true); });
    } else {
      d.innerHTML = head(w) + '<div class="ar-media">Cargando…</div>';
      A.api('/api/file?path=' + encodeURIComponent(path)).then(function (info) { if (F.win === w) editor(w, info); }).catch(function (e) { d.querySelector('.ar-media').textContent = e.message; });
    }
  }
  function editor(w, info) {
    if (info.text == null) { w.el.innerHTML = head(w) + '<div class="ar-media">' + A.esc(info.note || 'No se puede abrir aquí.') + '</div>'; return; }
    var path = w.path, ro = !info.editable;
    w.json = /\.json$/i.test(path);
    w.saved = info.text;
    w.plain = !w.json || info.text.length > BIG;
    var note = /(^|\/)index\.html$/i.test(path) ? 'Solo lectura. Este HTML sale de los JSON: cambia los JSON y se aplicará al procesar o exportar.'
      : ro ? 'Solo lectura: aquí solo se editan .json, .md y .txt.'
      : RELOAD.test(path) ? 'Al guardar hay que recargar la página para ver el cambio en la línea de tiempo.' : '';
    w.el.innerHTML = head(w, ro ? '' : '<button class="pr ar-sv" data-p="archivos" data-k="save" title="Ctrl+S">Guardar</button>') +
      '<div class="ar-note"' + (note ? '' : ' hidden') + '><span class="ar-ntx">' + A.esc(note) + '</span></div>' +
      '<div class="ar-body"><pre class="ar-gut"></pre><div class="ar-code"><pre class="ar-hl"></pre><textarea class="ar-ta' + (w.plain ? ' plain' : '') + '" spellcheck="false" wrap="off"' + (ro ? ' readonly' : '') + '></textarea></div></div><div class="ar-foot"></div>';
    var ta = w.ta = w.el.querySelector('.ar-ta');
    w.hl = w.el.querySelector('.ar-hl'); w.gut = w.el.querySelector('.ar-gut'); w.foot = w.el.querySelector('.ar-foot');
    ta.value = info.text;
    paintCode(w);
    ta.addEventListener('scroll', function () { w.hl.scrollTop = ta.scrollTop; w.hl.scrollLeft = ta.scrollLeft; w.gut.scrollTop = ta.scrollTop; });
    ta.addEventListener('input', function () { w.dirty = ta.value !== w.saved; flag(w); paintCode(w); });
    ta.addEventListener('keyup', function () { foot(w); });
    ta.addEventListener('click', function () { foot(w); });
    ta.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); if (!ro) save(); return; }
      if (e.key === 'Tab' && !ro) {
        e.preventDefault();
        var a = ta.selectionStart;
        ta.setRangeText('  ', a, ta.selectionEnd, 'end');
        ta.dispatchEvent(new Event('input'));
      }
    });
    ta.focus(); ta.setSelectionRange(0, 0); ta.scrollTop = 0;
    foot(w);
  }
  function errAt(s) {                       // dónde falla el JSON: el mensaje del navegador no siempre lo dice
    var i = 0;
    function ws() { while (i < s.length && ' \t\r\n'.indexOf(s[i]) >= 0) i++; }
    function str() { i++; while (i < s.length && s[i] !== '"') { if (s[i] === '\n') throw i; i += s[i] === '\\' ? 2 : 1; } if (i >= s.length) throw i; i++; }
    function val() {
      ws();
      var c = s[i];
      if (c === '{' || c === '[') {
        var end = c === '{' ? '}' : ']';
        i++; ws();
        if (s[i] === end) { i++; return; }
        for (;;) {
          ws();
          if (c === '{') { if (s[i] !== '"') throw i; str(); ws(); if (s[i] !== ':') throw i; i++; }
          val(); ws();
          if (s[i] === ',') { i++; continue; }
          if (s[i] === end) { i++; return; }
          throw i;
        }
      }
      if (c === '"') return str();
      var m = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(s.slice(i, i + 40));
      if (!m) throw i;
      i += m[0].length;
    }
    try { val(); ws(); return i; } catch (p) { return p; }
  }
  function check(txt) {                     // valida el JSON: {ok} o {ok:false, line, col}
    try { JSON.parse(txt); return { ok: true }; } catch (e) {
      var b = txt.slice(0, errAt(txt)).split('\n');
      return { ok: false, line: b.length, col: b[b.length - 1].length + 1 };
    }
  }
  function hl(src) {                        // resaltado simple: claves, textos, números y true/false/null
    var re = /("(?:[^"\\\n]|\\.)*")(\s*:)?|\b(?:true|false|null)\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g, out = '', i = 0, m;
    while ((m = re.exec(src))) {
      var c = m[1] ? (m[2] ? 'k' : 's') : /[\d-]/.test(m[0][0]) ? 'n' : 'b_';
      out += A.esc(src.slice(i, m.index)) + '<i class="ar-' + c + '">' + A.esc(m[1] || m[0]) + '</i>' + (m[2] ? A.esc(m[2]) : '');
      i = m.index + m[0].length;
    }
    return out + A.esc(src.slice(i));
  }
  function paintCode(w) {
    var v = w.ta.value;
    w.err = w.json ? check(v) : { ok: true };
    var n = v.split('\n').length, key = n + ':' + (w.err.ok ? 0 : w.err.line);
    if (w.gutKey !== key) {
      w.gutKey = key;
      var g = [];
      for (var i = 1; i <= n; i++) g.push(!w.err.ok && i === w.err.line ? '<b>' + i + '</b>' : i);
      w.gut.innerHTML = g.join('\n') + '\n';
    }
    if (!w.plain) w.hl.innerHTML = hl(v) + '\n';
    foot(w);
  }
  function foot(w) {
    var v = w.ta.value, b = v.slice(0, w.ta.selectionStart).split('\n'), pos = 'Línea ' + b.length + ', col ' + (b[b.length - 1].length + 1) + ' · ' + v.split('\n').length + ' líneas';
    w.foot.classList.toggle('bad', !w.err.ok);
    w.foot.textContent = pos + (w.json ? (w.err.ok ? ' · JSON válido' : ' · JSON no válido en la línea ' + w.err.line + ', columna ' + w.err.col) : '');
    var sv = w.el.querySelector('.ar-sv');
    if (sv) sv.title = w.err.ok ? 'Ctrl+S' : 'Corrige el JSON antes de guardar';
  }
  function flag(w) {
    var f = w.el.querySelector('.ar-flag'), c = w.el.querySelector('.ar-cl');
    if (f) f.textContent = w.dirty ? 'Sin guardar' : '';
    if (c) { c.textContent = 'Cerrar'; c.classList.remove('warn'); w.ask = false; }
  }
  function jump(w, line, col) {             // solo el cursor: con la línea seleccionada, lo siguiente que se teclee la borraría
    var ls = w.ta.value.split('\n'), o = col - 1;
    for (var i = 0; i < line - 1; i++) o += ls[i].length + 1;
    w.ta.focus(); w.ta.setSelectionRange(o, o);
    w.ta.scrollTop = Math.max(0, (line - 4) * LH);
    foot(w);
  }
  function save() {
    var w = F.win;
    if (!w || !w.ta) return;
    var v = w.ta.value;
    if (!w.err.ok) { A.toast('No se guarda: JSON no válido en la línea ' + w.err.line + ', columna ' + w.err.col, true); jump(w, w.err.line, w.err.col); return; }
    A.api('/api/file', { path: w.path, text: v }).then(function () {
      w.saved = v; w.dirty = false; flag(w);
      A.toast('Guardado: ' + w.path);
      if (RELOAD.test(w.path)) {
        var n = w.el.querySelector('.ar-note');
        n.hidden = false; n.className = 'ar-note go';
        n.innerHTML = '<span style="flex:1">Guardado. Recarga la página para verlo en la línea de tiempo (se pierde lo que no hayas procesado).</span><button data-p="archivos" data-k="reloadpage">Recargar ahora</button>';
      }
      load();
    }).catch(function (e) { A.toast(e.message, true); });
  }

  Timeline.use({
    id: 'archivos',
    left: { id: 'archivos', label: 'Archivos', order: 50, tip: 'Los archivos del proyecto' },
    init: function (api) {
      A = api;
      var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
      return true;
    },
    leftRender: function (el) { F.el = el; if (!F.list) load(); draw(); },
    onClick: function (b) {
      var k = b.dataset.k, path = b.dataset.path;
      if (k === 'dir') {
        F.open[path] = !F.open[path];
        if (/^edicion(\/|$)/.test(path)) F.dir = path;
        draw();
      } else if (k === 'file') show(path);
      else if (k === 'copy') copy(path, 'Ruta copiada: ' + path);
      else if (k === 'new' || k === 'newdir') { F.form = k === 'new' ? 'file' : 'dir'; F.open.edicion = true; draw(); }
      else if (k === 'nomake') { F.form = null; draw(); }
      else if (k === 'make') create(F.el.querySelector('.ar-nm').value);
      else if (k === 'reload') load();
      else if (k === 'save') save();
      else if (k === 'reloadpage') location.reload();
      else if (k === 'close') {
        var w = F.win;
        if (w && w.dirty && !w.ask) { w.ask = true; b.textContent = 'Descartar cambios'; b.classList.add('warn'); return; }
        close();
      }
    }
  });
})();
