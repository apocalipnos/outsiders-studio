// Módulo "Ver resultado": enseña la composición de verdad (el index.html con los JSON aplicados y el runtime de HyperFrames) dentro de
// la vista previa, sin lanzar un render. Sigue al cursor y reproduce. Se edita encima: las capas de capas.js y libres.js quedan por delante,
// transparentes, y se cogen y se arrastran igual. Mover o cambiar de tamaño se pinta al momento en sus cajas (.me-c de aplicar.py) y lo demás
// vuelve a montar el HTML en un marco por debajo, que sustituye al que se ve cuando está listo: tarda un segundo y no parpadea.
(function () {
  var A, X = { on: false, ready: false, sig: null, lastSeek: 0, loading: false, again: false, tm: 0 };
  var ESTILO = '.rs-box{position:absolute;inset:0;z-index:30;background:#000;overflow:hidden}.rs-box iframe{position:absolute;left:0;top:0;width:1080px;height:1920px;border:0;pointer-events:none;background:#000}' +
    '.rs-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-right:auto;font-size:10.5px;color:#09090b}.rs-tag{background:var(--a);font-weight:600;padding:3px 8px;border-radius:99px}' +
    '.rs-bar button{padding:3px 8px;font-size:10.5px}.rs-warn{background:#f59e0b;padding:3px 8px;border-radius:6px;color:#111;line-height:1.3}' +
    '.rs-load{position:absolute;inset:0;display:grid;place-items:center;color:var(--t2);font-size:32px;text-align:center;padding:48px;background:rgba(0,0,0,.72);z-index:1}' +
    '.rs-on .tl-ov{z-index:40}.rs-on .cp-in,.rs-on .lb-in{visibility:hidden}.rs-on .cp-g.ed .cp-in,.rs-on .lb-edit{visibility:visible}.rs-on .cp-g.ed,.rs-on .lb-edit{background:rgba(0,0,0,.7)}' +
    '.rs-on .cp-g{translate:none!important;rotate:none!important;scale:none!important;opacity:1!important}.rs-on .cp-g.ghost{opacity:.5!important}.rs-on .sb-live{display:none}.rs-play .tl-ov{visibility:hidden}';
  var GEO = { left: 1, top: 1, width: 1, cx: 1, scale: 1 };

  function sigNow() { return JSON.stringify(Timeline.data().edicion); }
  function player() { try { var w = X.frame.contentWindow; return w && w.__player; } catch (e) { return null; } }
  function doc() { try { return X.frame.contentWindow.document; } catch (e) { return null; } }
  function bar() {
    if (!X.bar) return;
    var why = Timeline.razones(), html = '<span class="rs-tag">Resultado</span><button data-p="resultado" data-k="off">Volver a editar</button><button data-p="resultado" data-k="png">Guardar fotograma</button>' +
      (why.length ? '<span class="rs-warn">Sin montar todavía: ' + A.esc(why.join(', ')) + '. Se ve al pulsar Procesar vídeo.</span>' : '');
    if (X.barHtml !== html) { X.barHtml = html; X.bar.innerHTML = html; }
  }
  function seek(t) {
    var p = player();
    if (p && X.ready) { try { p.seek(t); } catch (e) {} }
  }
  // Si solo cambió el color del vídeo no hace falta recargar: el motor lo lee del atributo en cada fotograma.
  function colorEnVivo() {
    if (!X.ready || X.sig === null) return false;
    var ant = JSON.parse(X.sig), act = JSON.parse(sigNow()), ca = (ant.color || {}).targets || {}, cb = (act.color || {}).targets || {};
    var sinVideo = function (o) { var c = {}; Object.keys(o).forEach(function (k) { if (k !== 'video') c[k] = o[k]; }); return JSON.stringify(c); };
    delete ant.color; delete act.color;
    if (JSON.stringify(ant) !== JSON.stringify(act) || sinVideo(ca) !== sinVideo(cb) || JSON.stringify(ca.video) === JSON.stringify(cb.video)) return false;
    var v = doc().querySelector('#bgv');
    if (!v) return false;
    v.setAttribute('data-color-grading', JSON.stringify(cb.video || { enabled: false }));
    X.sig = sigNow();
    seek(A.state().t + 1e-3);
    return true;
  }
  // Lo mismo sin la posición ni el tamaño de las capas: si no cambia nada más, basta con mover sus cajas.
  function sinGeo(ed) {
    var c = JSON.parse(JSON.stringify(ed)), cap = {};
    Object.keys(c.capas || {}).forEach(function (g) {
      var o = {};
      if (g === 'reframe') return;               // el zoom general lo monta Claude: lo avisa la barra
      Object.keys(c.capas[g]).forEach(function (k) { if (!GEO[k]) o[k] = c.capas[g][k]; });
      if (Object.keys(o).length) cap[g] = o;
    });
    if (Object.keys(cap).length) c.capas = cap; else delete c.capas;
    ((c.libres || {}).items || []).forEach(function (it) { if (it.type !== 'block') { delete it.left; delete it.top; delete it.width; delete it.height; } });
    return JSON.stringify(c);
  }
  function caja(w, o) {                          // lo mismo que aplicar._desplaza
    var m = w.dataset.m.split(',').map(Number), box = w.dataset.k === 'box';
    var dx = (box ? o.left : o.cx) - m[0], dy = o.top - m[1], r = (box ? o.width : o.scale) / m[2];
    w.style.transform = dx || dy || r !== 1 ? 'translate(' + dx + 'px,' + dy + 'px) scale(' + r + ')' : '';
  }
  function enVivo(ed) {
    var d = X.ready && X.sig !== null && doc(), ant = d && JSON.parse(X.sig), falta = false;
    if (!d || sinGeo(ant) !== sinGeo(ed)) return false;
    Object.keys(ed.capas || {}).forEach(function (g) {
      if (g === 'reframe') return;
      var cajas = d.querySelectorAll('.me-c[data-g="' + CSS.escape(g) + '"]');
      if (!cajas.length && JSON.stringify((ant.capas || {})[g]) !== JSON.stringify(ed.capas[g])) falta = true;   // subtítulos sin mover todavía: aún no tienen caja
      [].forEach.call(cajas, function (w) { caja(w, ed.capas[g]); });
    });
    if (falta) return false;
    ((ed.libres || {}).items || []).forEach(function (it) {
      var n = it.type !== 'audio' && it.type !== 'block' && d.getElementById('lib-' + String(it.id).replace(/[^\w-]/g, '_'));
      if (!n) return;
      n.style.left = it.left + 'px'; n.style.top = it.top + 'px'; n.style.width = it.width + 'px';
      if (it.height != null) n.style.height = it.height + 'px';
    });
    return true;
  }
  function alDia() {                             // que se vea lo último: en vivo si se puede, si no volviendo a montar
    var s = sigNow();
    if (s === X.sig) return;
    if (colorEnVivo()) return;
    if (enVivo(JSON.parse(s))) X.sig = s; else { clearTimeout(X.tm); X.tm = setTimeout(load, 300); }
  }
  function fallo(m) {
    var msg = X.box.querySelector('.rs-load');
    X.loading = false;
    if (X.ready) A.toast(m, true); else { msg.hidden = false; msg.textContent = m; }
  }
  function waitReady(f, s, t0) {
    var p, ok = false;
    try { p = f.contentWindow.__player; ok = !!(p && f.contentWindow.__playerReady !== false && p.getDuration && p.getDuration() > 0); } catch (e) {}
    if (!ok) {
      if (performance.now() - t0 > 180000) { f.remove(); fallo('No se pudo montar el resultado. Prueba otra vez o usa Guardar fotograma.'); return; }
      setTimeout(function () { waitReady(f, s, t0); }, 100);
      return;
    }
    try { p.seek(A.state().t); } catch (e) {}
    listo(f, s, performance.now());
  }
  function listo(f, s, t0) {                     // ya en su sitio: se cambia por el que se ve cuando tiene la imagen del vídeo
    var v = f.contentWindow.document.querySelector('#bgv');
    if (v && (v.readyState < 2 || v.seeking) && performance.now() - t0 < 2000) { setTimeout(function () { listo(f, s, t0); }, 40); return; }
    setTimeout(function () {
      if (X.frame) X.frame.remove();
      X.frame = f; X.ready = true; X.loading = false; X.again = false; X.sig = s;
      X.box.querySelector('.rs-load').hidden = true;
      seek(A.state().t);
      bar();
      alDia();
      A.refresh();
    }, 60);
  }
  function load() {
    if (!X.on) return;
    if (X.loading || A.state().playing) { X.again = true; return; }
    X.loading = true; X.again = false;
    var s = sigNow(), msg = X.box.querySelector('.rs-load');
    if (!X.ready) { msg.hidden = false; msg.textContent = 'Montando el resultado… con color puede tardar más la primera vez'; }
    A.api('/api/exacta', { edicion: JSON.parse(s) }).then(function (r) {
      var f = document.createElement('iframe');
      f.title = 'Resultado';
      X.box.insertBefore(f, X.box.firstChild);   // por debajo del que se ve, hasta que esté listo
      f.src = r.url;
      waitReady(f, s, performance.now());
    }).catch(function (e) { fallo(e.message); });
  }
  function toggle(on) {
    var T = A.state();
    X.on = on == null ? !X.on : on;
    if (!X.box) {
      X.box = document.createElement('div');
      X.box.className = 'rs-box';
      X.box.innerHTML = '<div class="rs-load" hidden></div>';
      X.bar = document.createElement('div');   // en la fila de botones, para no tapar la imagen
      X.bar.className = 'rs-bar';
      T.el.stools.insertBefore(X.bar, T.el.stools.firstChild);
      T.el.stage.insertBefore(X.box, T.el.ov);   // en el lienzo (se escala con él), por debajo de las capas que se cogen con el ratón
    }
    X.box.hidden = !X.on; X.bar.hidden = !X.on;
    T.el.screen.classList.toggle('rs-on', X.on);
    if (T.playing) A.stop();
    if (X.on) {
      if (X.sig === null) load(); else { alDia(); seek(T.t); }
      bar();
    }
    if (Timeline.onResultado) Timeline.onResultado(X.on);
    A.refresh();
  }
  function rect(el) {                            // dónde está de verdad lo que se ve de una capa, en píxeles del lienzo
    var d = X.on && X.ready && doc(), w = d && d.querySelector('.me-c[data-el="' + CSS.escape(el) + '"]'), a = 1e9, b = 1e9, c = -1e9, e = -1e9;
    if (!w) return null;
    [].forEach.call(w.children, function (k) {
      var r = k.getClientRects().length && k.getBoundingClientRect();
      if (r && r.width && r.height) { a = Math.min(a, r.left); b = Math.min(b, r.top); c = Math.max(c, r.right); e = Math.max(e, r.bottom); }
    });
    return c > a ? { left: a, top: b, width: c - a, height: e - b } : null;
  }

  Timeline.use({
    id: 'resultado',
    init: function (api) {
      A = api;
      var s = document.createElement('style'); s.textContent = ESTILO; document.head.appendChild(s);
      window.MiResultado = { toggle: toggle, on: function () { return X.on; }, rect: rect };
      return true;
    },
    paint: function (t) {
      if (!X.on || !X.ready || A.state().playing) return;
      var now = performance.now();
      if (now - X.lastSeek < 60) return;
      X.lastSeek = now;
      seek(t);
    },
    onPlay: function (t) {                     // reproduce el resultado con su sonido; la edición sigue muda para llevar el cursor
      if (!X.on || !X.ready) return;
      var G = A.audio();
      if (G) G.master.gain.value = 0;
      X.play = true;
      A.state().el.screen.classList.add('rs-play');
      var p = player();
      try { p.seek(t); p.play(); } catch (e) {}
    },
    onStop: function () {
      if (!X.play) return;
      X.play = false;
      var T = A.state(), G = A.audio();
      T.el.screen.classList.remove('rs-play');
      if (G) G.master.gain.value = T.muted ? 0 : T.vol;
      var p = player();
      try { if (p) p.pause(); } catch (e) {}
      seek(T.t);
      if (X.again) load();
    },
    onChanged: function () { if (X.on) { alDia(); bar(); } },
    onClick: function (b) {
      var k = b.dataset.k;
      if (k === 'off') toggle(false);
      else if (k === 'png') {
        A.toast('Guardando el fotograma… puede tardar un minuto');
        A.api('/api/snapshot', { t: A.state().t, edicion: Timeline.data().edicion }).then(function (r) {
          var a = document.createElement('a'); a.href = r.url; a.download = 'fotograma.png'; document.body.appendChild(a); a.click(); a.remove();
          A.toast('Fotograma guardado en snapshots/');
        }).catch(function (e) { A.toast(e.message, true); });
      }
    },
    key: function (e) { if (X.on && e.key === 'Escape') { toggle(false); return true; } return false; }
  });
})();
