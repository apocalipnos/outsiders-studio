// Módulo "Medios" de la Edición (el Assets de HyperFrames Studio): imágenes, vídeos, audio y fuentes del proyecto o de los
// demás proyectos de la carpeta. Se previsualizan, se añaden al cursor o arrastrándolos, y se suben soltándolos en el panel.
(function () {
  var A, M = { scope: 'project', q: '', f: 'all', data: {}, err: null, sel: null, el: null, root: null, io: null, fonts: {} };
  var SEC = [['video', 'Vídeo'], ['image', 'Imágenes'], ['audio', 'Audio'], ['font', 'Fuentes']];
  var FILT = [['all', 'Todo'], ['audio', 'Audio'], ['image', 'Imágenes'], ['video', 'Vídeo'], ['font', 'Fuentes'], ['used', 'En uso'], ['unused', 'Sin usar']];
  var NOTE = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.700" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';
  var CSS = '.md-root{min-height:100%;position:relative;display:flex;flex-direction:column}.md-root.drop::after{content:"Suelta aquí para subirlos";position:absolute;inset:0;z-index:5;display:grid;place-items:center;background:var(--ad);border:2px dashed var(--a);border-radius:8px;color:var(--a);font-weight:600;font-size:12px;pointer-events:none}' +
    '.md-top{display:flex;gap:4px;margin-bottom:6px}.md-top select{flex:none;width:128px}.md-top input{flex:1;min-width:0}' +
    '.md-chips{display:flex;flex-wrap:wrap;gap:3px;margin-bottom:8px}.md-chips button{padding:2px 7px;border:0;border-radius:99px;background:var(--card2);color:var(--t2);font-size:10.5px;font-weight:500}.md-chips button.on{background:var(--t1);color:#171717;border:0}.md-chips em{font-style:normal;opacity:.65;margin-left:3px}' +
    '.md-up{margin-bottom:8px;font-size:10.5px;color:var(--t2)}.md-up i{display:block;height:4px;margin-top:3px;background:var(--b1);border-radius:2px;overflow:hidden}.md-up i b{display:block;height:100%;background:var(--a);width:0}' +
    '.md-list{flex:1}.md-h{margin:10px 0 5px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--t3)}.md-h:first-child{margin-top:0}' +
    '.md-g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}' +
    '.md-c{background:var(--card2);border:1px solid var(--b0);border-radius:6px;overflow:hidden;cursor:grab;touch-action:none}.md-c:hover{border-color:var(--b2)}.md-c.sel{border-color:var(--a);box-shadow:0 0 0 1px var(--a)}' +
    '.md-t{aspect-ratio:1;background:#000;display:grid;place-items:center;color:var(--t3);overflow:hidden;position:relative}.md-t img,.md-t video{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}.md-ag{font-size:26px;color:var(--t1);line-height:1}' +
    '.md-n{font-size:10px;color:var(--t2);padding:3px 5px 0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.md-s{font-size:9.5px;color:var(--t3);padding:0 5px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.md-s b{color:var(--a);font-weight:500}' +
    '.md-prev{position:sticky;bottom:-8px;margin:8px -8px -8px;padding:8px;background:var(--card);border-top:1px solid var(--b1);z-index:4}.md-prev .v{display:grid;place-items:center;background:#000;border-radius:6px;overflow:hidden;margin-bottom:6px}.md-prev img,.md-prev video{max-width:100%;max-height:130px;display:block}.md-prev audio{width:100%;height:30px;display:block}.md-prev .smp{font-size:26px;padding:10px;line-height:1.2;text-align:center;color:var(--t1)}' +
    '.md-pn{font-size:10.5px;color:var(--t2);word-break:break-all;margin-bottom:6px}.md-pa{display:flex;gap:4px;flex-wrap:wrap}.md-pa button{padding:4px 8px;font-size:11px}' +
    '.md-ghost{position:fixed;z-index:95;pointer-events:none;background:#171717;border:1px solid var(--a);border-radius:6px;padding:4px 8px;font-size:11px;color:var(--t1);box-shadow:0 8px 24px rgba(0,0,0,.5);max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
    '.md-over{outline:2px solid var(--a);outline-offset:-2px}.md-e{color:var(--t3);font-size:11px;padding:18px 6px;text-align:center}';

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
  function rel(a) { return (a.project ? a.project + ' · ' : '') + 'assets/' + a.path; }
  function all() { return M.data[M.scope] || []; }
  function load(force) {
    var sc = M.scope;
    if (M.data[sc] && !force) return drawList();
    A.api('/api/assets?scope=' + sc).then(function (l) { M.data[sc] = l; M.err = null; M.sel = null; drawList(); }).catch(function (e) { M.err = e.message; drawList(); });
  }
  function passes(a, f) { return f === 'all' || a.type === f || (f === 'used' && a.used) || (f === 'unused' && !a.used); }
  function matches(a) {
    var q = M.q.trim().toLowerCase();
    return !q || (a.name + ' ' + a.path + ' ' + (a.project || '')).toLowerCase().indexOf(q) >= 0;
  }

  // ---------- pintar ----------
  function thumb(a, i) {
    if (a.type === 'image') return '<img loading="lazy" src="' + A.esc(a.url) + '" alt="">';
    if (a.type === 'video') return '<video muted playsinline preload="metadata" src="' + A.esc(a.url) + '#t=0.1"></video>';
    if (a.type === 'audio') return NOTE;
    return '<span class="md-ag" data-font="' + i + '">Ag</span>';
  }
  function fontName(a) { return 'md-' + a.url.replace(/\W/g, ''); }
  function loadFont(a, cb) {                 // solo se descarga la fuente cuando su tarjeta se ve
    var fam = fontName(a);
    if (M.fonts[fam]) return cb(fam);
    new FontFace(fam, 'url("' + a.url + '")').load().then(function (x) { document.fonts.add(x); M.fonts[fam] = 1; cb(fam); }).catch(function () {});
  }
  function drawList() {
    var el = M.root;
    if (!el) return;
    var src = all().filter(matches), box = el.querySelector('.md-list');
    el.querySelector('.md-chips').innerHTML = FILT.map(function (f) {
      var n = src.filter(function (a) { return passes(a, f[0]); }).length;
      return '<button class="' + (M.f === f[0] ? 'on' : '') + '" data-p="medios" data-k="f" data-f="' + f[0] + '">' + f[1] + '<em>' + n + '</em></button>';
    }).join('');
    if (M.err) { box.innerHTML = '<div class="md-e">' + A.esc(M.err) + '</div>'; return; }
    if (!M.data[M.scope]) { box.innerHTML = '<div class="md-e">Cargando…</div>'; return; }
    var list = all(), html = '';
    SEC.forEach(function (s) {
      var cards = '';
      list.forEach(function (a, i) {
        if (a.type !== s[0] || !matches(a) || !passes(a, M.f)) return;
        cards += '<div class="md-c' + (M.sel === a ? ' sel' : '') + '" data-i="' + i + '" title="' + A.esc(rel(a)) + '"><div class="md-t">' + thumb(a, i) + '</div><div class="md-n">' + A.esc(a.name) + '</div><div class="md-s">' + kb(a.size) + (a.used ? ' · <b>en uso</b>' : '') + '</div></div>';
      });
      if (cards) html += '<div class="md-h">' + s[1] + '</div><div class="md-g">' + cards + '</div>';
    });
    box.innerHTML = html || '<div class="md-e">' + (list.length ? 'Nada coincide con el filtro.' : M.scope === 'all' ? 'No hay medios en otros proyectos de esta carpeta.' : 'Este proyecto aún no tiene medios.<br>Suelta archivos aquí para subirlos.') + '</div>';
    if (M.io) M.io.disconnect();
    M.io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        M.io.unobserve(e.target);
        loadFont(list[+e.target.dataset.font], function (fam) { e.target.style.fontFamily = '"' + fam + '"'; });
      });
    }, { root: A.state().el.lbody });
    box.querySelectorAll('[data-font]').forEach(function (n) { M.io.observe(n); });
    drawPrev();
  }
  function drawPrev() {
    var box = M.root.querySelector('.md-prev'), a = M.sel;
    box.hidden = !a;
    if (!a) { box.innerHTML = ''; return; }
    var v = a.type === 'image' ? '<img src="' + A.esc(a.url) + '" alt="">'
      : a.type === 'video' ? '<video controls muted autoplay loop playsinline src="' + A.esc(a.url) + '"></video>'
      : a.type === 'audio' ? '<audio controls autoplay src="' + A.esc(a.url) + '"></audio>'
      : '<div class="smp">El veloz murciélago<br>ABC abc 0123</div>';
    box.innerHTML = '<div class="v">' + v + '</div><div class="md-pn">' + A.esc(rel(a)) + ' · ' + kb(a.size) + '</div><div class="md-pa">' +
      (a.type === 'font' ? '' : '<button data-p="medios" data-k="add">Añadir en el cursor</button>') + '<button data-p="medios" data-k="copy">Copiar ruta</button></div>';
    if (a.type === 'font') loadFont(a, function (fam) { var s = box.querySelector('.smp'); if (s) s.style.fontFamily = '"' + fam + '"'; });
  }
  function draw() {
    var el = M.el;
    if (!el) return;
    el.innerHTML = '<div class="md-root"><div class="md-top"><select class="st-in" data-p="medios" data-k="scope"><option value="project"' + (M.scope === 'project' ? ' selected' : '') + '>Este proyecto</option><option value="all"' + (M.scope === 'all' ? ' selected' : '') + '>Todos los proyectos</option></select>' +
      '<input class="st-in" data-p="medios" data-k="q" placeholder="Buscar…" value="' + A.esc(M.q) + '"></div><div class="md-chips"></div><div class="md-up" hidden></div><div class="md-list"></div><div class="md-prev" hidden></div></div>';
    M.root = el.querySelector('.md-root');
    bind(M.root);
    load();
    drawList();
  }

  // ---------- colocar ----------
  function pathOf(a) {                       // de otro proyecto se importa antes; devuelve la ruta en este
    if (!a.project) return Promise.resolve('assets/' + a.path);
    return A.api('/api/assets/import', { project: a.project, path: a.path }).then(function (r) { M.data.project = null; return r.path; });
  }
  function add(a, at) {
    if (a.type === 'font') return A.toast('Las fuentes se eligen en Ajustes; aquí solo se copian o se suben', true);
    if (!window.MiLibres || typeof window.MiLibres.add !== 'function') return A.toast('No se puede colocar: falta el módulo de capas añadidas', true);
    pathOf(a).then(function (src) {
      var o = { src: src, label: a.name };
      Object.keys(at || {}).forEach(function (k) { o[k] = at[k]; });
      window.MiLibres.add(a.type, o);
      A.toast('Añadido: ' + a.name);
    }).catch(function (e) { A.toast(e.message, true); });
  }
  function dropAt(a, x, y) {                 // al soltar un medio: en la vista previa o en la línea de tiempo
    var T = A.state(), el = document.elementFromPoint(x, y);
    if (!el) return;
    if (T.el.scroll.contains(el)) {
      var t = A.xToTime(Math.max(0, x - T.el.inner.getBoundingClientRect().left - A.LW));
      A.stop(); A.seek(t);
      add(a, { at: t });
    } else if (T.el.stagewrap.contains(el)) {
      var r = T.el.stage.getBoundingClientRect();
      add(a, { left: Math.round((x - r.left) / T.S - 270), top: Math.round((y - r.top) / T.S - 200) });   // 540 de ancho: centrada donde se suelta
    }
  }
  function dragFrom(a, e) {
    var sx = e.clientX, sy = e.clientY, g = null, T = A.state(), over = null;
    function hit(x, y) {
      var el = document.elementFromPoint(x, y);
      return !el ? null : T.el.scroll.contains(el) ? T.el.scroll : T.el.stagewrap.contains(el) ? T.el.stagewrap : null;
    }
    function mv(ev) {
      if (!g) {
        if (Math.abs(ev.clientX - sx) + Math.abs(ev.clientY - sy) < 6) return;
        g = document.createElement('div'); g.className = 'md-ghost'; g.textContent = a.name; document.body.appendChild(g);
      }
      g.style.left = ev.clientX + 12 + 'px'; g.style.top = ev.clientY + 10 + 'px';
      var h = hit(ev.clientX, ev.clientY);
      if (h !== over) { if (over) over.classList.remove('md-over'); if (h) h.classList.add('md-over'); over = h; }
    }
    function up(ev) {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      if (over) over.classList.remove('md-over');
      if (g) { g.remove(); dropAt(a, ev.clientX, ev.clientY); }
    }
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  function card(e) { var c = e.target.closest('.md-c'); return c ? { el: c, a: all()[+c.dataset.i] } : null; }
  function bind(root) {
    root.addEventListener('pointerdown', function (e) { var c = card(e); if (c && e.button === 0) dragFrom(c.a, e); });
    root.addEventListener('click', function (e) {
      var c = card(e);
      if (!c) return;
      M.sel = M.sel === c.a ? null : c.a;
      root.querySelectorAll('.md-c.sel').forEach(function (n) { n.classList.remove('sel'); });
      if (M.sel) c.el.classList.add('sel');
      drawPrev();
    });
    root.addEventListener('dblclick', function (e) { var c = card(e); if (c) add(c.a); });
    root.addEventListener('mouseover', function (e) {         // el vídeo se mueve al pasar por encima
      var c = card(e), v = c && c.el.querySelector('.md-t video');
      if (v && v.paused) v.play().catch(function () {});
    });
    root.addEventListener('mouseout', function (e) {
      var c = card(e), v = c && !c.el.contains(e.relatedTarget) && c.el.querySelector('.md-t video');
      if (v) { v.pause(); v.currentTime = 0.1; }
    });
    var isFiles = function (e) { return e.dataTransfer && [].indexOf.call(e.dataTransfer.types, 'Files') >= 0; };
    root.addEventListener('dragover', function (e) { if (isFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; root.classList.add('drop'); } });
    root.addEventListener('dragleave', function (e) { if (!root.contains(e.relatedTarget)) root.classList.remove('drop'); });
    root.addEventListener('drop', function (e) { if (isFiles(e)) { e.preventDefault(); root.classList.remove('drop'); upload(e.dataTransfer.files); } });
  }

  // ---------- subir ----------
  function bar(i, n, name, p) {
    var box = M.root && M.root.querySelector('.md-up');
    if (!box) return;
    box.hidden = false;
    box.innerHTML = 'Subiendo ' + A.esc(name) + (n > 1 ? ' (' + i + ' de ' + n + ')' : '') + ' · ' + Math.round(p * 100) + ' %<i><b style="width:' + p * 100 + '%"></b></i>';
  }
  function upload(files) {                   // XMLHttpRequest con el File de cuerpo: fetch no da el progreso de subida
    var list = [].slice.call(files), i = 0, ok = 0;
    (function next() {
      if (i >= list.length) {
        var box = M.root && M.root.querySelector('.md-up');
        if (box) box.hidden = true;
        if (ok) A.toast(ok === 1 ? 'Subido a assets/imported/' : ok + ' archivos subidos a assets/imported/');
        M.data.project = null;
        if (M.scope === 'project') load(true);
        return;
      }
      var f = list[i++], x = new XMLHttpRequest();
      x.open('POST', '/api/upload?name=' + encodeURIComponent(f.name));
      bar(i, list.length, f.name, 0);
      x.upload.onprogress = function (e) { if (e.lengthComputable) bar(i, list.length, f.name, e.loaded / e.total); };
      x.onload = function () {
        if (x.status < 400) ok++;
        else { var m = f.name; try { m = JSON.parse(x.responseText).error || m; } catch (err) {} A.toast(f.name + ': ' + m, true); }
        next();
      };
      x.onerror = function () { A.toast('No se pudo subir ' + f.name, true); next(); };
      x.send(f);
    })();
  }

  Timeline.use({
    id: 'medios',
    left: { id: 'medios', label: 'Medios', order: 30, tip: 'Imágenes, vídeos, audio y fuentes' },
    init: function (api) {
      A = api;
      var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
      return true;
    },
    leftRender: function (el) { M.el = el; draw(); },
    onClick: function (b) {
      var k = b.dataset.k;
      if (k === 'f') { M.f = b.dataset.f; drawList(); }
      else if (k === 'add' && M.sel) add(M.sel);
      else if (k === 'copy' && M.sel) copy((M.sel.project ? '../' + M.sel.project + '/' : '') + 'assets/' + M.sel.path, 'Ruta copiada');
    },
    onInput: function (el) { if (el.dataset.k === 'q') { M.q = el.value; drawList(); } },
    onChange: function (el) { if (el.dataset.k === 'scope') { M.scope = el.value; M.sel = null; load(); drawList(); } }
  });
})();
