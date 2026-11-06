// Módulo "Ver resultado": enseña la composición de verdad (el index.html con los JSON aplicados y el runtime de HyperFrames) dentro de
// la vista previa, sin lanzar un render. Sigue al cursor y reproduce. Se edita encima: las capas de capas.js y libres.js quedan por delante,
// transparentes, y se cogen y se arrastran igual. Mover o cambiar de tamaño se pinta al momento en sus cajas (.me-c de aplicar.py) y lo demás
// vuelve a montar el HTML en un marco por debajo, que sustituye al que se ve cuando está listo: tarda un segundo y no parpadea.
// Los recortes se ven al momento: el segundo de la línea de tiempo se traduce al del vídeo ya montado (trozos) y lo quitado se salta al reproducir y al buscar.
(function () {
  var A, X = { on: false, ready: false, sig: null, lastSeek: 0, loading: false, again: false, tm: 0 };
  var ESTILO = '.rs-box{position:absolute;inset:0;z-index:30;background:#000;overflow:hidden}.rs-box iframe{position:absolute;left:0;top:0;width:1080px;height:1920px;border:0;pointer-events:none;background:#000}' +
    '.rs-bar{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-right:auto;font-size:10.5px;color:#09090b}.rs-tag{background:var(--a);font-weight:600;padding:3px 8px;border-radius:99px}' +
    '.rs-bar button{padding:3px 8px;font-size:10.5px}.rs-warn{background:#f59e0b;padding:3px 8px;border-radius:6px;color:#111;line-height:1.3}.rs-note{background:var(--ad);padding:3px 8px;border-radius:6px;color:var(--t1);line-height:1.3}' +
    '.rs-load{position:absolute;inset:0;display:grid;place-items:center;color:var(--t2);font-size:32px;text-align:center;padding:48px;background:rgba(0,0,0,.72);z-index:1}' +
    '.rs-on .tl-ov{z-index:40}.rs-on .cp-in,.rs-on .lb-in{visibility:hidden}.rs-on .cp-g.ed .cp-in,.rs-on .lb-edit{visibility:visible}.rs-on .cp-g.ed,.rs-on .lb-edit{background:rgba(0,0,0,.7)}' +
    '.rs-on .cp-g{translate:none!important;rotate:none!important;scale:none!important;opacity:1!important}.rs-on .cp-g.ghost{opacity:.5!important}.rs-on .sb-live{display:none}.rs-play .tl-ov{visibility:hidden}';
  var GEO = { left: 1, top: 1, width: 1, cx: 1, scale: 1, items: 1 };     // items: lo de cada capa movida por su cuenta

  // Cada clip tal como quedó dentro del vídeo montado: su trozo del clip y su segundo en el montaje.
  function montaje() {
    if (X.base) return X.base;
    var P = A.state().project, g = P.segments || [], ids = {}, m = 0;
    (P.edl || []).forEach(function (s) { ids[s.id] = s; });
    X.base = (g.length ? g : P.edl || []).map(function (s) {       // en los superpuestos, segments.json apunta al plano de debajo
      var e = s.overlay && ids[s.id] || s, v = s.overlay ? 1 : s.speed || 1, a = g.length ? s.frame / A.FPS : m, d = g.length ? s.frames / A.FPS : (e.out - e.in) / v;
      m = a + d;
      return { id: s.id, clip: e.clip, in: e.in, out: e.out, v: v, m0: a, m1: a + d, zoom: e.zoom, cx: e.cx, cy: e.cy };
    });
    return X.base;
  }
  // Los clips de ahora en trozos del montaje: {t0, t1} en la línea de tiempo y {m0, m1} en el vídeo. Lo que no está montado (un clip alargado) no entra.
  function trozos() {
    var B = montaje(), L = [], raro = {};
    A.state().L.forEach(function (it) {
      if (it.s.off) return;
      var s = it.s, v = s.overlay ? 1 : s.speed || 1, src = s.in, raiz = String(s.id).replace(/b+$/, '');
      while (src < s.out - 2e-3) {
        var h = null, nx = s.out;
        B.forEach(function (b) {
          if (b.clip !== s.clip) return;
          if (src >= b.in - 2e-3 && src < b.out - 2e-3) { if (!h || b.id === raiz) h = b; }
          else if (b.in > src && b.in < nx) nx = b.in;
        });
        if (!h) { raro.largo = true; src = nx; continue; }
        var fin = Math.min(s.out, h.out);
        L.push({ t0: it.t0 + (src - s.in) / v, t1: it.t0 + (fin - s.in) / v, m0: Math.min(h.m0 + Math.max(src - h.in, 0) / h.v, h.m1), m1: fin >= h.out - 2e-3 ? h.m1 : h.m0 + (fin - h.in) / h.v });
        if (Math.abs(v - h.v) > 1e-3) raro.vel = true;
        if (['zoom', 'cx', 'cy'].some(function (k) { return s[k] !== h[k]; })) raro.enc = true;
        src = fin;
      }
    });
    var ult = B.length ? B[B.length - 1].m1 : 0;
    raro.corta = !L.length || L[0].m0 > 2e-3 || L[L.length - 1].m1 < ult - 2e-3 || L.some(function (q, i) { return i && Math.abs(q.m0 - L[i - 1].m1) > 2e-3; });
    raro.cambia = raro.corta || !!raro.largo;
    return { L: L, raro: raro };
  }
  function aMontaje(t, M) {                      // segundo de la línea de tiempo -> segundo del vídeo montado
    var L = (M || trozos()).L, q;
    for (var i = 0; i < L.length; i++) {
      q = L[i];
      if (t < q.t1 - 5e-4 || i === L.length - 1) return q.m0 + A.clamp((t - q.t0) / Math.max(q.t1 - q.t0, 1e-6), 0, 1) * (q.m1 - q.m0);
    }
    return 0;
  }
  // El HTML sigue con el reloj del montaje: lo que lleva tiempos de la línea de tiempo (capas tocadas, añadidas, animación, volumen) se le pasa traducido.
  // Sin ancla, porque su fragmento y su segundo del clip pueden ya no existir en el montaje. Al procesar se manda lo de verdad.
  function traducida(ed) {
    var M = trozos();
    if (!M.raro.cambia) return ed;
    var c = JSON.parse(JSON.stringify(ed)), m = function (t) { return Math.round(aMontaje(t || 0, M) * 100) / 100; };
    var rango = function (d) { var a = m(d.from), b = m(d.to); d.anchor = null; b = b > a ? b : a + Math.max((d.to || 0) - (d.from || 0), .03); d.from = a; d.to = b; };
    var punto = function (k) { k.t = m(k.t); k.anchor = null; };
    Object.keys((c.tiempos || {}).capas || {}).forEach(function (k) { rango(c.tiempos.capas[k]); });
    ((c.libres || {}).items || []).forEach(function (it) { if (it.from != null) rango(it); });
    var pistas = (c.claves || {}).tracks || {}, autos = (c.audiofx || {}).automation || {};
    Object.keys(pistas).forEach(function (g) { Object.keys(pistas[g]).forEach(function (k) { (pistas[g][k] || []).forEach(punto); }); });
    Object.keys(autos).forEach(function (g) { if (g.indexOf('lib:') !== 0) (autos[g].lanes || []).forEach(function (l) { (l.points || []).forEach(punto); }); });
    return c;
  }
  function sigNow() { return JSON.stringify(traducida(Timeline.data().edicion)); }
  function player() { try { var w = X.frame.contentWindow; return w && w.__player; } catch (e) { return null; } }
  function doc() { try { return X.frame.contentWindow.document; } catch (e) { return null; } }
  function efectosIguales(M) {                   // un corte mueve los efectos en la línea de tiempo, pero en el vídeo montado siguen en su sitio
    var fx = Timeline.data().effects, b = A.state().project.effects || [];
    return fx.length === b.length && fx.every(function (f) {
      var o = b.filter(function (x) { return x.key === f.key; })[0];
      return o && Math.abs(aMontaje(f.from, M) - o.from) < .05 && Math.abs(aMontaje(f.to, M) - o.to) < .05;
    });
  }
  function bar() {
    if (!X.bar) return;
    var M = trozos(), r = M.raro, why = Timeline.razones().filter(function (w) { return w !== 'cortes' && (w !== 'efectos' || !efectosIguales(M)); });
    if (r.largo) why.push('clips alargados');
    if (r.vel) why.push('velocidad de clips');
    if (r.enc) why.push('encuadre de clips');
    var html = '<span class="rs-tag">Resultado</span><button data-p="resultado" data-k="off">Volver a editar</button><button data-p="resultado" data-k="png">Guardar fotograma</button>' +
      (r.corta ? '<span class="rs-note">Tus cortes ya se ven aquí. Para guardarlos, pulsa Procesar vídeo.</span>' : '') +
      (why.length ? '<span class="rs-warn">Sin montar todavía: ' + A.esc(why.join(', ')) + '. Se ve al pulsar Procesar vídeo.</span>' : '');
    if (X.barHtml !== html) { X.barHtml = html; X.bar.innerHTML = html; }
  }
  function seek(t) {
    var p = player();
    if (p && X.ready) { try { p.seek(cuadro(aMontaje(t))); } catch (e) {} }
  }
  function cuadro(m) { return Math.ceil(m * A.FPS - 1e-3) / A.FPS; }   // el motor baja al fotograma de antes, que ya sería de lo quitado
  // Mientras suena, el tiempo lo lleva el vídeo: al acabar un trozo salta al siguiente en ese momento, y el cursor le sigue.
  function reloj() {
    var p = player(), L = X.tz, q = L && L[X.k];
    if (!p || !q) return null;
    var m = p.getTime(), fin = m >= q.m1 - .012, vivo = p.isPlaying();
    if (!vivo && !fin) return null;
    if (fin) {
      var n = L[X.k + 1];
      if (!n) return null;
      if (!vivo || Math.abs(n.m0 - q.m1) > 2e-3) { m = cuadro(n.m0); p.seek(m, { keepPlaying: true }); if (!p.isPlaying()) p.play(); }
      X.k++; q = n;
    }
    return q.t0 + A.clamp((m - q.m0) / Math.max(q.m1 - q.m0, 1e-6), 0, 1) * (q.t1 - q.t0);
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
      [].forEach.call(cajas, function (w) { caja(w, Object.assign({}, ed.capas[g], ((ed.capas[g].items || {})[w.dataset.el]) || {})); });
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
    try { p.seek(cuadro(aMontaje(A.state().t))); } catch (e) {}
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
      if (!X.on || !X.ready || A.state().playing || t !== A.state().t) return;   // otro t es comprobar.js midiendo: no mueve lo que se ve
      var now = performance.now();
      clearTimeout(X.sk);
      if (now - X.lastSeek < 60) { X.sk = setTimeout(function () { if (A.state().playing) return; X.lastSeek = performance.now(); seek(A.state().t); }, 70); return; }   // que se quede donde acabó el gesto
      X.lastSeek = now;
      seek(t);
    },
    onPlay: function (t) {                     // reproduce el resultado con su sonido; el cursor sigue a su reloj
      if (!X.on || !X.ready) return;
      var G = A.audio();
      if (G) G.master.gain.value = 0;
      X.play = true;
      A.state().el.screen.classList.add('rs-play');
      var p = player(), M = trozos(), k = 0;
      while (k < M.L.length - 1 && t >= M.L[k].t1 - 5e-4) k++;
      X.tz = M.L; X.k = k;
      A.state().reloj = reloj;
      try { p.seek(cuadro(aMontaje(t, M))); p.play(); } catch (e) {}
    },
    onStop: function () {
      if (!X.play) return;
      X.play = false;
      var T = A.state(), G = A.audio();
      T.reloj = null;
      T.el.screen.classList.remove('rs-play');
      if (G) G.master.gain.value = T.muted ? 0 : T.vol;
      var p = player();
      try { if (p) p.pause(); } catch (e) {}
      A.seek(T.t);                               // la pareja de vídeos de la edición estaba parada: al sitio
      seek(T.t);
      if (X.again) load();
    },
    onChanged: function () { if (X.on) { alDia(); bar(); } },
    onClick: function (b) {
      var k = b.dataset.k;
      if (k === 'off') toggle(false);
      else if (k === 'png') {
        A.toast('Guardando el fotograma… puede tardar un minuto');
        A.api('/api/snapshot', { t: aMontaje(A.state().t), edicion: JSON.parse(sigNow()) }).then(function (r) {
          var a = document.createElement('a'); a.href = r.url; a.download = 'fotograma.png'; document.body.appendChild(a); a.click(); a.remove();
          A.toast('Fotograma guardado en snapshots/');
        }).catch(function (e) { A.toast(e.message, true); });
      }
    },
    key: function (e) { if (X.on && e.key === 'Escape') { toggle(false); return true; } return false; }
  });
})();
