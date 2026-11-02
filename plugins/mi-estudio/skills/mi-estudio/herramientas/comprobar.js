// Módulo "Comprobar" de la Edición (el Lint de HyperFrames Studio): un botón en la línea de tiempo con el recuento de avisos.
// Junta lo que dice "hyperframes lint" (POST /api/lint) con lo que se puede ver aquí: capas en la zona que tapa Instagram o
// fuera del vídeo, fragmentos de menos de 3 fotogramas y subtítulos sin elegir. Tocar un aviso salta a ese momento.
(function () {
  var A, K = { own: [], lint: [], busy: false, btn: null, lintErr: null, hk: '', me: null };
  var UNSAFE = [[0, 0, 1080, 220, 'arriba'], [0, 1470, 1080, 450, 'abajo'], [0, 220, 35, 1250, 'izquierda'], [1045, 220, 35, 935, 'derecha'], [980, 1155, 100, 315, 'botones']];
  var SEV = { error: 'Error', warning: 'Aviso', info: 'Nota' };
  var CSS = '.st-tb.ck-b{display:inline-flex;align-items:center}.ck-n{margin-left:5px;min-width:15px;padding:0 4px;border-radius:99px;font-size:10px;font-weight:600;text-align:center;background:var(--b1);color:var(--t2)}.ck-n.warning{background:rgba(245,158,11,.2);color:#fbbf24}.ck-n.error{background:rgba(239,68,68,.22);color:#fca5a5}.ck-n.ok{background:var(--ad);color:var(--a)}' +
    '.ck-h{display:flex;align-items:center;gap:8px;margin-bottom:8px}.ck-h b{flex:1;font-size:12px;font-weight:600}.ck-h span{font-size:11px;color:var(--t3)}.ck-h button{padding:3px 8px;font-size:11px}' +
    '.ck-r{display:block;width:100%;text-align:left;padding:7px 9px;margin-bottom:4px;background:var(--card2);border:1px solid var(--b0);border-radius:7px;font-weight:400;color:var(--t1)}.ck-r.jump:hover{border-color:var(--b2)}.ck-r:not(.jump){cursor:default}' +
    '.ck-t{display:flex;gap:6px;align-items:center;font-size:10px;color:var(--t3)}.ck-s{padding:0 5px;border-radius:3px;font-weight:600;background:var(--b1);color:var(--t2)}.ck-s.warning{background:rgba(245,158,11,.18);color:#fbbf24}.ck-s.error{background:rgba(239,68,68,.2);color:#fca5a5}' +
    '.ck-m{font-size:11px;line-height:1.45;margin-top:3px}.ck-f{font-size:10.5px;line-height:1.4;color:var(--t2);margin-top:2px}.ck-f b{font-weight:600}.ck-e{color:var(--t3);font-size:11px;padding:14px 4px;text-align:center}';

  function stageBox() { return A.state().el.stage.getBoundingClientRect(); }
  function layers() {                        // lo que hay pintado ahora mismo sobre el vídeo, en px del lienzo de 1080x1920
    var T = A.state(), b = stageBox(), out = [];
    T.el.ov.querySelectorAll('.cp-g:not(.ghost),.lb-l:not(.ghost)').forEach(function (n) {
      if (n.hidden || n.style.display === 'none') return;
      var r = n.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      var tag = n.querySelector('.cp-tag,.lb-tag');
      out.push({ g: n.dataset.g || null, lib: n.dataset.lb || null, name: tag && tag.textContent ? tag.textContent : (n.dataset.g || 'Capa'),
                 x0: (r.left - b.left) / T.S, y0: (r.top - b.top) / T.S, x1: (r.right - b.left) / T.S, y1: (r.bottom - b.top) / T.S });
    });
    return out;
  }
  function fixFor(l, z) {
    if (z[4] === 'arriba') return 'Bájala ' + Math.ceil(z[3] - l.y0) + ' px.';
    if (z[4] === 'abajo') return 'Súbela ' + Math.ceil(l.y1 - z[1]) + ' px.';
    if (z[4] === 'izquierda') return 'Muévela ' + Math.ceil(z[2] - l.x0) + ' px a la derecha.';
    if (z[4] === 'derecha') return 'Muévela ' + Math.ceil(l.x1 - z[0]) + ' px a la izquierda.';
    return 'Apártala de los botones de Instagram, a la derecha.';
  }
  function selOf(l) {
    if (l.g) return { type: 'grp', id: l.g };
    var fx = A.state().fx;
    for (var i = 0; i < fx.length; i++) if (fx[i].libre && fx[i].id === l.lib) return { type: 'fx', id: i };
    return null;
  }
  function checkLayers(out) {                // recorre el vídeo pintando las capas de cada momento, sin mover el cursor ni el vídeo
    var T = A.state(), seen = {}, step = Math.max(0.2, T.total / 240), hid = T.el.stagewrap.hidden;
    T.el.stagewrap.hidden = false;           // en la vista Guion la vista previa está oculta y no se puede medir
    var paintAll = function (t) { T.plugins.forEach(function (p) { if (p.paint && p !== K.me) p.paint(t); }); };
    for (var t = 0; t < T.total; t += step) {
      paintAll(t);
      layers().forEach(function (l) {
        var key = l.g || l.lib || l.name;
        if ((l.x0 < -1 || l.y0 < -1 || l.x1 > A.W + 1 || l.y1 > A.H + 1) && !seen[key + 'out']) {
          seen[key + 'out'] = 1;
          out.push({ sev: 'error', msg: '"' + l.name + '" se sale del vídeo.', fix: 'Muévela o hazla más pequeña hasta que quepa entera.', t: t, sel: selOf(l) });
        }
        UNSAFE.forEach(function (z) {
          if (l.x0 < z[0] + z[2] && l.x1 > z[0] && l.y0 < z[1] + z[3] && l.y1 > z[1] && !seen[key + z[4]]) {
            seen[key + z[4]] = 1;
            out.push({ sev: 'warning', msg: '"' + l.name + '" entra en la zona que tapa Instagram (' + z[4] + ').', fix: fixFor(l, z), t: t, sel: selOf(l) });
          }
        });
      });
    }
    paintAll(T.t);
    T.el.stagewrap.hidden = hid;
  }
  function own() {                           // lo que se comprueba en el navegador
    var T = A.state(), out = [], sum = document.getElementById('sum');
    if (sum && /Subtítulos:\s*sin elegir/.test(sum.textContent)) out.push({ sev: 'warning', msg: 'No has elegido subtítulos.', fix: 'Elige un estilo en Catálogo > Subtítulos; sin eso no se puede procesar el vídeo.' });
    T.L.forEach(function (it, i) {
      if (!it.s.off && it.dur < 3 / A.FPS - 1e-3) out.push({ sev: 'warning', msg: 'El clip ' + (i + 1) + ' dura menos de 3 fotogramas.', fix: 'Alárgalo por su borde o quítalo: en el vídeo se verá como un parpadeo.', t: it.t0, sel: { type: 'seg', id: it.s._id } });
    });
    checkLayers(out);
    if (window.MiReferencia) MiReferencia.avisos().forEach(function (f) { out.push(f); });
    K.own = out;
    badge();
  }
  function counts() {
    var c = { error: 0, warning: 0, info: 0 };
    K.own.concat(K.lint).forEach(function (f) { c[f.sev] = (c[f.sev] || 0) + 1; });
    return c;
  }
  function badge() {
    var n = K.btn && K.btn.querySelector('.ck-n');
    if (!n) return;
    var c = counts(), tot = c.error + c.warning;
    n.textContent = tot;
    n.className = 'ck-n ' + (c.error ? 'error' : tot ? 'warning' : 'ok');
    K.btn.title = tot ? c.error + ' errores y ' + c.warning + ' avisos' : 'Sin avisos';
  }
  function row(f, i) {
    return '<button class="ck-r' + (f.t != null ? ' jump' : '') + '" data-p="comprobar" data-k="go" data-i="' + i + '"><span class="ck-t"><span class="ck-s ' + (f.sev || '') + '">' + (SEV[f.sev] || 'Nota') + '</span>' +
      (f.t != null ? '<span>' + A.fmtS(f.t) + '</span>' : '') + (f.file ? '<span>' + A.esc(f.file) + '</span>' : '') + (f.code ? '<span>' + A.esc(f.code) + '</span>' : '') + '</span>' +
      '<div class="ck-m">' + A.esc(f.msg) + '</div>' + (f.fix ? '<div class="ck-f"><b>Arreglo:</b> ' + A.esc(f.fix) + '</div>' : '') + '</button>';
  }
  function body() {
    var c = counts(), all = K.own.concat(K.lint), rank = { error: 0, warning: 1, info: 2 };
    K.shown = all.slice().sort(function (a, b) { return (rank[a.sev] - rank[b.sev]) || ((a.t || 0) - (b.t || 0)); });
    return '<div class="ck-h"><b>Revisar</b><span>' + (K.busy ? 'Pasando la comprobación de HyperFrames…' : c.error + ' errores · ' + c.warning + ' avisos · ' + c.info + ' notas') + '</span><button data-p="comprobar" data-k="run"' + (K.busy ? ' disabled' : '') + '>Volver a revisar</button></div>' +
      (K.lintErr ? '<div class="ck-r"><span class="ck-t"><span class="ck-s">Nota</span></span><div class="ck-m">' + A.esc(K.lintErr) + '</div></div>' : '') +
      (K.shown.length ? K.shown.map(row).join('') : K.busy ? '' : '<div class="ck-e">Todo en orden.</div>');
  }
  function show() { if (K.open) { A.popup(body(), K.btn, 'wide'); K.pop = A.state().pop; } }
  function run() {
    K.busy = true;
    own();
    show();
    A.api('/api/lint', {}).then(function (r) {
      K.lintErr = r.error || null;
      K.lint = (r.findings || []).map(function (f) { return { sev: f.severity || 'info', msg: f.message || f.code || '', fix: f.fixHint || f.fix || '', file: f.file || '', code: f.code || '' }; });
    }).catch(function (e) { K.lintErr = 'No se pudo pasar la comprobación de HyperFrames: ' + e.message; }).then(function () {
      K.busy = false;
      badge();
      K.open = K.open && A.state().pop === K.pop;   // se cerró mientras tanto: no la vuelvas a abrir
      show();
    });
  }

  Timeline.use({
    id: 'comprobar',
    init: function (api) {
      A = api;
      K.me = this;
      var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
      setTimeout(function () { K.btn = A.state().el.mtools.querySelector('[data-k="open"][data-p="comprobar"]'); if (!A.state().playing) own(); }, 1500);
      setInterval(function () {              // el recuento sigue a los cambios (se mira solo si hubo alguno)
        var T = A.state(), k = T.hist.length + '/' + T.redo.length;
        if (k !== K.hk && !T.playing && !T.drag) { K.hk = k; if (K.btn) own(); }
      }, 2500);
      return true;
    },
    timelineTools: function () {
      return '<i class="st-div"></i><button class="st-tb st-txt ck-b" data-p="comprobar" data-k="open" title="Buscar problemas en el vídeo">Revisar<span class="ck-n">0</span></button>';
    },
    onClick: function (b) {
      var k = b.dataset.k;
      if (k === 'open') {
        K.btn = b;
        K.open = true;
        run();
      } else if (k === 'run') run();
      else if (k === 'go') {
        var f = K.shown[+b.dataset.i];
        if (!f || f.t == null) return;
        A.stop();
        A.seek(f.t);
        var T = A.state(), x = A.timeToX(f.t) + A.LW;
        if (x < T.el.scroll.scrollLeft + A.LW || x > T.el.scroll.scrollLeft + T.el.scroll.clientWidth - 20) T.el.scroll.scrollLeft = x - T.el.scroll.clientWidth / 2;
        if (f.sel) A.select(f.sel);
      }
    }
  });
})();
