// Módulo "Capas y encuadre" de la Edición: las capas del vídeo (imágenes, títulos, subtítulos...) se ven en la vista
// previa en su sitio y se mueven / cambian de tamaño ahí mismo con el ratón; el encuadre acerca el plano de todos los
// clips. Datos: <proyecto>/edicion/capas.json (lo escribe el script del plan) -> capas_edit.json al procesar.
//   {video, grade, fonts: [css], css, reframe: {origin: [x, y], default, max} | null,
//    groups: [{id, label, kind: 'box' | 'center', aspect, lockX, default: {...}, items: [{from, to, label, html, el}]}]}
//   box: {left, top, width} (alto = ancho / aspect) · center: {cx, top, scale} (centrado en cx, crece hacia abajo)
//   Cada capa se mueve sola (como en CapCut): lo de una capa va en {<grupo>: {..., items: {<el>: {left, top, width | cx, top, scale}}}};
//   los subtítulos se mueven todos juntos. "Igual en todas" pasa los valores de una a todo su grupo.
//   "el" une el item con su bloque de la pista Capas: si lo mueves en el tiempo, en la vista previa sale cuando dice el bloque.
//   Textos: los del item (sus [data-t="<clave>"], o su "text", o su trozo de texto más largo) se cambian en el panel o
//   con doble clic en la vista previa -> {<grupo>: {..., texts: {<clave, el o índice>: texto}}}. Los grupos de subtítulos
//   ("words": true o id "subs") los lleva Mi Estudio a words.json al procesar (edicion.aplicar_subtitulos).
(function () {
  var A, C, SNAP = 10;
  var copy = function (o) { return JSON.parse(JSON.stringify(o)); };

  function group(id) { return C.groups.filter(function (g) { return g.id === id; })[0]; }
  function sola(g, it) { return !!(it && it.el && !(g.words || g.id === 'subs')); }    // se mueve por su cuenta (los subtítulos, todos a la vez)
  function valOf(gid, it) { var g = group(gid); return sola(g, it) && C.iv[gid][it.el] ? C.iv[gid][it.el] : C.val[gid]; }
  function suyos(gid, it) {                    // los valores que se tocan: los de esa capa (o la que se ve), o los del grupo
    var g = group(gid);
    it = it || C.shown[gid];
    if (!sola(g, it)) return C.val[gid];
    return C.iv[gid][it.el] || (C.iv[gid][it.el] = copy(C.val[gid]));
  }
  function focus() {                         // el grupo elegido: tocado en la vista previa o por su bloque de la pista Capas
    var T = A.state(), s = T.sel;
    if (!s) return null;
    if (s.type === 'grp') return s.id;
    if (s.type === 'fx' && T.fx[s.id] && T.fx[s.id].kind === 'el') return C.byEl[T.fx[s.id].id] || null;
    return null;
  }
  function range(it) {
    if (!it.el) return [it.from, it.to];
    var f = A.state().fx.filter(function (x) { return x.kind === 'el' && x.id === it.el; })[0];
    if (!f) return [it.from, it.to];
    return f.off ? null : A.fxRange(f);
  }
  function itemAt(g, t, near) {
    var best = null, dist = 1e9;
    for (var i = 0; i < g.items.length; i++) {
      var r = range(g.items[i]);
      if (!r) continue;
      if (t >= r[0] && t < r[1]) return { it: g.items[i], ghost: false };
      var d = Math.min(Math.abs(t - r[0]), Math.abs(t - r[1]));
      if (d < dist) { dist = d; best = g.items[i]; }
    }
    return near && best ? { it: best, ghost: true } : null;
  }

  // ---------- textos ----------
  // Cada item tiene una o más partes de texto: sus [data-t="<clave>"] (sin clave: la del item) o, si no tiene, su "text"
  // o su trozo de texto más largo. La clave del item es su "el" o su índice. Los <br> son saltos de línea ("\n").
  function key(g, it) { return it.el || String(g.items.indexOf(it)); }
  function nodes(root) {
    var m = root.querySelectorAll('[data-t]');
    if (m.length) return [].slice.call(m);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n, best = null;
    while ((n = w.nextNode())) if (!best || n.nodeValue.trim().length > best.nodeValue.trim().length) best = n;
    return best ? [best] : [];
  }
  function nkey(g, it, n) { return (n.nodeType === 1 && n.dataset.t) || key(g, it); }
  function own(n) {
    if (n.nodeType === 3) return n.nodeValue.trim();
    var c = n.cloneNode(true);
    c.querySelectorAll('br').forEach(function (b) { b.replaceWith('\n'); });
    return c.textContent.replace(/[ \t]*\n[ \t]*/g, '\n').trim();
  }
  function put(n, txt) {
    if (n.nodeType !== 3) { n.innerHTML = A.esc(txt).replace(/\n/g, '<br>'); return; }
    var v = n.nodeValue;
    n.nodeValue = v.match(/^\s*/)[0] + txt + v.match(/\s*$/)[0];
  }
  function parts(g, it) {                    // [{k, t0}]: las partes de texto del item con su texto propuesto
    if (!it._parts) {
      var d = document.createElement('div');
      d.innerHTML = A.html(it.html || '');     // sus rutas son del proyecto: sin esto el navegador las pide mal
      var ns = nodes(d);
      it._parts = ns.map(function (n) {
        var k = nkey(g, it, n);
        return { k: k, t0: it.text != null && ns.length === 1 && k === key(g, it) ? String(it.text) : own(n) };
      });
    }
    return it._parts;
  }
  function text(gid, p) { var o = C.txt[gid][p.k]; return o != null ? o : p.t0; }
  function part(gid, it, k) { return parts(group(gid), it).filter(function (p) { return p.k === k; })[0]; }
  function setText(gid, it, k, txt) {
    var p = part(gid, it, k);
    txt = txt.replace(/[ \t\r\f\v]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n+/g, '\n').trim();
    if (txt === p.t0) delete C.txt[gid][p.k]; else C.txt[gid][p.k] = txt;
    A.touched('capas');
  }
  function sig(gid, it) { return group(gid).items.indexOf(it) + '\u0000' + parts(group(gid), it).map(function (p) { return text(gid, p); }).join('\u0000'); }
  function textRow(gid, it) {
    if (!it) return '';
    var g = group(gid), i = g.items.indexOf(it), ps = parts(g, it);
    if (!ps.length) return '';
    C.rowSig[gid] = sig(gid, it);
    return '<div class="cp-texts" data-g="' + gid + '">' + ps.map(function (p, n) {
      var v = text(gid, p), at = ' class="cp-txt" data-p="capas" data-k="text" data-g="' + gid + '" data-i="' + i + '" data-t="' + A.esc(p.k) + '"';
      return '<div class="tl-row cp-trow"><label>' + (ps.length > 1 ? 'Texto ' + (n + 1) : 'Texto') + '</label>' +
        (/\n/.test(v) ? '<textarea rows="' + v.split('\n').length + '"' + at + '>' + A.esc(v) + '</textarea>' : '<input type="text"' + at + ' value="' + A.esc(v) + '">') +
        (C.txt[gid][p.k] != null ? '<button data-p="capas" data-g="' + gid + '" data-t="' + A.esc(p.k) + '" data-a="txt0" title="Volver al texto propuesto">↺</button>' : '') + '</div>';
    }).join('') + '<div class="help cp-tlab">' + A.esc(it.label || '') + (g.words || g.id === 'subs' ? ' · se guarda en las palabras de los subtítulos (words.json)' : '') +
      ' · también con doble clic en la vista previa.</div></div>';
  }
  function edit(gid, e) {                    // doble clic: escribir el texto en la misma vista previa
    var g = group(gid), it = C.shown[gid], el = C.els[gid];
    if (!it || C.ed) return;
    if (el.classList.contains('real')) el.style.cssText = natural(g, valOf(gid, it));   // sobre el resultado: se escribe en su sitio de la edición
    el.classList.add('ed');
    var ns = nodes(el.querySelector('.cp-in')), n = ns[0];
    ns.forEach(function (x) {                // la parte en la que se hizo doble clic
      var r = document.createRange(); r.selectNodeContents(x);
      var b = r.getBoundingClientRect();
      if (e.clientX >= b.left && e.clientX <= b.right && e.clientY >= b.top && e.clientY <= b.bottom) n = x;
    });
    if (!n) return;
    var k = nkey(g, it, n), p = part(gid, it, k), sp = n;
    A.stop();
    if (n.nodeType === 3) {
      var v = n.nodeValue, par = n.parentNode;
      sp = document.createElement('span');
      sp.textContent = v.trim();
      par.insertBefore(document.createTextNode(v.match(/^\s*/)[0]), n);
      par.insertBefore(sp, n);
      par.replaceChild(document.createTextNode(v.match(/\s*$/)[0]), n);
    }
    var t0 = text(gid, p);
    A.remember();
    C.ed = gid;
    sp.classList.add('cp-edit');
    sp.contentEditable = 'plaintext-only';
    if (sp.contentEditable !== 'plaintext-only') sp.contentEditable = 'true';
    sp.focus();
    var r = document.createRange(); r.selectNodeContents(sp);
    var s = getSelection(); s.removeAllRanges(); s.addRange(r);
    var done = function (cancel) {
      if (C.ed !== gid) return;
      C.ed = null;
      setText(gid, it, k, cancel ? t0 : sp.innerText);   // antes de ocultarla otra vez: innerText de algo oculto está vacío
      el.classList.remove('ed');
      if (text(gid, p) === t0) A.state().hist.pop();
      el.dataset.html = '';
      A.refresh();
    };
    sp.addEventListener('pointerdown', function (ev) { ev.stopPropagation(); });
    sp.addEventListener('keydown', function (ev) {         // Mayús+Intro: salto de línea
      ev.stopPropagation();
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); done(); } else if (ev.key === 'Escape') { ev.preventDefault(); done(true); }
    });
    sp.addEventListener('blur', function () { done(); });
  }

  function natural(g, o) {
    return g.kind === 'box'
      ? 'left:' + o.left + 'px;top:' + o.top + 'px;width:' + o.width + 'px;height:' + Math.round(o.width / (g.aspect || 1)) + 'px'
      : 'left:' + o.cx + 'px;top:' + o.top + 'px;transform:translateX(-50%) scale(' + o.scale + ')';
  }
  function paint(t) {
    var T = A.state(), fg = focus(), rs = window.MiResultado && MiResultado.on();
    if (rs && T.playing) return;              // reproduciendo el resultado las capas no se tocan: no hay que medirlas
    if (C.rz) {
      T.el.rf.style.transformOrigin = C.rz.origin[0] + 'px ' + C.rz.origin[1] + 'px';
      T.el.rf.style.transform = 'scale(' + C.val.reframe.zoom + ')';
      var r = T.el.ptools.querySelector('[data-k=zoom]');
      if (r && document.activeElement !== r) r.value = C.val.reframe.zoom;
      var v = T.el.ptools.querySelector('.tl-rzv');
      if (v) v.textContent = '+' + Math.round((C.val.reframe.zoom - 1) * 1000) / 10 + ' %';
    }
    C.groups.forEach(function (g) {
      var el = C.els[g.id], o = C.val[g.id], hit = itemAt(g, t, g.id === fg);
      if (C.ed === g.id) return;              // se está escribiendo en ella
      if (A.isHidden('el:' + g.id)) hit = null;   // su pista está oculta en la línea de tiempo
      el.hidden = !hit;
      C.shown[g.id] = hit && hit.it;
      if (!hit) return;
      var ps = parts(g, hit.it), ck = sig(g.id, hit.it) + '\u0000' + hit.it.html;
      if (el.dataset.html !== ck) {
        var cin = el.querySelector('.cp-in');
        cin.innerHTML = A.html(hit.it.html);
        nodes(cin).forEach(function (n, j) { if (ps[j] && text(g.id, ps[j]) !== ps[j].t0) put(n, text(g.id, ps[j])); });
        el.dataset.html = ck;
      }
      if (g.id === fg) {                      // los campos Texto del panel siguen al item que se ve
        var box = T.el.insp.querySelector('.cp-texts[data-g="' + g.id + '"]');
        if (box && !box.contains(document.activeElement) && C.rowSig[g.id] !== sig(g.id, hit.it)) box.outerHTML = textRow(g.id, hit.it);
      }
      var rc = rs && hit.it.el && MiResultado.rect(hit.it.el);   // sobre el resultado, justo encima de lo que se ve (cada item puede ir en su sitio)
      el.style.cssText = rc ? 'left:' + rc.left + 'px;top:' + rc.top + 'px;width:' + rc.width + 'px;height:' + rc.height + 'px' : natural(g, valOf(g.id, hit.it));
      el.classList.toggle('real', !!rc);
      el.classList.toggle('sel', g.id === fg);
      el.classList.toggle('ghost', hit.ghost);
    });
  }

  function vals(g, it) {
    var o = valOf(g.id, it);
    return g.kind === 'box'
      ? ['x ' + Math.round(o.left) + ' · y ' + Math.round(o.top), Math.round(o.width) + ' px de ancho']
      : [(g.lockX ? 'centrado · ' : 'centro x ' + Math.round(o.cx) + ' · ') + 'y ' + Math.round(o.top), Math.round(o.scale * 100) + ' %'];
  }
  function controls(gid, it) {
    it = it || C.shown[gid];
    var g = group(gid), v = vals(g, it), b = function (attr, txt, t) { return '<button data-p="capas" data-g="' + gid + '" data-el="' + A.esc(it && it.el || '') + '" ' + attr + ' title="' + (t || '') + '">' + txt + '</button>'; };
    return '<div class="tl-row"><label>Posición</label><span class="v wide">' + v[0] + '</span>' +
      (g.lockX ? '' : b('data-mv="-1,0"', '←', 'Mayús: 10 px')) + b('data-mv="0,-1"', '↑', 'Mayús: 10 px') + b('data-mv="0,1"', '↓', 'Mayús: 10 px') +
      (g.lockX ? '' : b('data-mv="1,0"', '→', 'Mayús: 10 px')) + '</div>' +
      '<div class="tl-row"><label>Tamaño</label>' + b('data-sz="-1"', '−') + '<span class="v wide">' + v[1] + '</span>' + b('data-sz="1"', '+') + '</div>' +
      '<div class="tl-acts">' + b('data-a="reset"', 'Restablecer posición y tamaño') +
      (sola(g, it) && g.items.length > 1 ? b('data-a="all"', 'Igual en todas', 'Pone la posición y el tamaño de esta capa a las ' + g.items.length + ' de «' + A.esc(g.label) + '»') : '') + '</div>' +
      '<div class="help">Arrástrala en la vista previa; los círculos de sus esquinas cambian el tamaño. ' +
      (sola(g, it) ? 'Solo cambia esta capa.' : g.items.length > 1 ? 'Vale para las ' + g.items.length + ' capas de este grupo.' : '') + ' Flechas del teclado: 1 px (Mayús: 10 px).</div>';
  }

  function move(gid, dx, dy, it) {
    var g = group(gid), o = suyos(gid, it);
    if (g.kind === 'box') o.left += dx; else if (!g.lockX) o.cx += dx;
    o.top += dy;
  }
  function size(gid, k, it) {
    var g = group(gid), o = suyos(gid, it);
    if (g.kind === 'box') o.width = Math.max(120, o.width + 10 * k);
    else o.scale = Math.round(A.clamp(o.scale + 0.02 * k, 0.3, 3) * 1000) / 1000;
  }
  function touch() { A.touched('capas'); A.refresh(); }

  function drag(gid, mode, e) {
    if (C.ed === gid) return;
    e.preventDefault(); e.stopPropagation();
    A.stop();
    var T = A.state();
    if (!(T.sel && T.sel.type === 'grp' && T.sel.id === gid)) A.select({ type: 'grp', id: gid });
    A.remember();
    var g = group(gid), sx = e.clientX, sy = e.clientY, start = copy(valOf(gid, C.shown[gid])), S = T.S, moved = false;
    var r0 = C.els[gid].getBoundingClientRect(), startW = r0.width / S, startH = r0.height / S;
    var ofs = (r0.left + r0.width / 2 - T.el.stage.getBoundingClientRect().left) / S - (g.kind === 'box' ? start.left + start.width / 2 : start.cx);   // lo que se ve puede ir desplazado de su grupo
    var gx = /e$/.test(mode) ? 1 : -1, gy = /^s/.test(mode) ? 1 : -1;    // la esquina que se arrastra: la contraria se queda quieta
    function mv(ev) {
      var dx = (ev.clientX - sx) / S, dy = (ev.clientY - sy) / S, o = suyos(gid), c;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return;
      moved = true;
      if (mode === 'move') {
        if (g.kind === 'box') { o.left = A.gridSnap(start.left + dx); o.top = A.gridSnap(start.top + dy); c = o.left + o.width / 2 + ofs; }
        else { if (!g.lockX) o.cx = A.gridSnap(start.cx + dx); o.top = A.gridSnap(start.top + dy); c = o.cx + ofs; }
        var near = Math.abs(c - A.W / 2) < SNAP;
        C.guide.style.display = near ? 'block' : 'none';
        if (near) { if (g.kind === 'box') o.left = A.W / 2 - o.width / 2 - ofs; else if (!g.lockX) o.cx = A.W / 2 - ofs; }
      } else if (g.kind === 'box') {
        var asp = g.aspect || 1, w = Math.max(120, start.width + Math.max(gx * dx, gy * dy * asp));
        o.width = w;
        if (gx < 0) o.left = start.left + start.width - w;
        if (gy < 0) o.top = start.top + (start.width - w) / asp;
      } else {            // centrada: crece por los dos lados, así que el asa se mueve la mitad de lo que crece
        o.scale = Math.round(A.clamp(start.scale * (1 + Math.max(2 * gx * dx / startW, gy * dy / startH)), 0.3, 3) * 1000) / 1000;
        if (gy < 0) o.top = start.top + startH * (1 - o.scale / start.scale);
      }
      touch();
    }
    function up() {
      removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
      C.guide.style.display = 'none';
      if (!moved) A.state().hist.pop();
    }
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  Timeline.use({
    id: 'capas', owns: ['grp'],
    init: function (api, input, saved) {
      if (!input || !input.groups) return false;
      A = api;
      var T = A.state();
      C = { groups: input.groups, rz: input.reframe || null, els: {}, byEl: {}, val: {}, iv: {}, txt: {}, shown: {}, rowSig: {}, ed: null, lastMem: 0 };
      var HANDLES = ['nw', 'ne', 'sw', 'se'].map(function (c) { return '<div class="cp-h ' + c + '" data-c="' + c + '"></div>'; }).join('');
      C.groups.forEach(function (g) {
        var sv = Object.assign({}, (saved || {})[g.id] || {});
        C.txt[g.id] = sv.texts || {};
        C.iv[g.id] = sv.items || {};
        delete sv.texts; delete sv.items;
        C.val[g.id] = Object.assign(copy(g.default), sv);
        g.items.forEach(function (it) { if (it.el) C.byEl[it.el] = g.id; });
      });
      if (C.rz) C.val.reframe = { zoom: ((saved || {}).reframe || {}).zoom || C.rz.default || 1 };
      C.val0 = JSON.stringify(C.val); C.iv0 = JSON.stringify(C.iv);
      (input.fonts || []).forEach(function (f) {
        if (document.querySelector('link[data-cp="' + f + '"]')) return;
        var l = document.createElement('link'); l.rel = 'stylesheet'; l.href = A.url(f); l.dataset.cp = f; document.head.appendChild(l);
      });
      var css = document.createElement('style');           // url('assets/...') del css: rutas del proyecto, como en A.html
      css.textContent = String(input.css || '').replace(/url\((\s*['"]?)(?!\/|https?:|data:|blob:|#)/g, 'url($1/p/');
      document.head.appendChild(css);
      if (input.grade) T.el.rf.style.filter = input.grade;
      T.el.ov.innerHTML = '<div class="cp-guide"></div>' + C.groups.map(function (g, i) {
        return '<div class="cp-g ' + g.kind + '" data-g="' + g.id + '" style="z-index:' + (i + 2) + '" hidden><div class="cp-in"></div>' +
          '<div class="cp-tag">' + A.esc(g.label) + '</div>' + HANDLES + '</div>';
      }).join('');
      C.guide = T.el.ov.querySelector('.cp-guide');
      C.groups.forEach(function (g) {
        var d = C.els[g.id] = T.el.ov.querySelector('.cp-g[data-g="' + g.id + '"]');
        d.addEventListener('pointerdown', function (e) { drag(g.id, 'move', e); });
        d.querySelectorAll('.cp-h').forEach(function (h) { h.addEventListener('pointerdown', function (e) { drag(g.id, h.dataset.c, e); }); });
        d.addEventListener('dblclick', function (e) { e.preventDefault(); edit(g.id, e); });
      });
      T.el.stage.addEventListener('pointerdown', function (e) {       // tocar el vídeo fuera de las capas suelta la elegida
        if (!e.target.closest('.cp-g') && focus()) A.select(null);
      });
      return true;
    },
    laneOf: function (f) {                     // en la línea de tiempo, una pista por grupo de capas
      var gid = C.byEl[f.id], g = gid && group(gid);
      return g ? { id: gid, label: g.label } : null;
    },
    toolbar: function () {
      return C.rz ? '<label class="tl-rz">Zoom general <input type="range" data-p="capas" data-k="zoom" min="1" max="' + (C.rz.max || 1.4) +
        '" step="0.005"><span class="tl-rzv"></span><button data-p="capas" data-a="rz" title="Volver al zoom propuesto">↺</button></label>' : '';
    },
    paint: paint,
    necesita: function () {                    // lo que aplicar.py no puede poner sin volver a montar; lo demás de Capas sale sin Claude
      var v0 = JSON.parse(C.val0), out = '';
      if (C.rz && v0.reframe.zoom !== C.val.reframe.zoom) out = 'zoom general';
      C.groups.forEach(function (g) {
        var sub = g.words || g.id === 'subs', sinEl = g.items.some(function (it) { return !it.el; });
        if (sub ? Object.keys(C.txt[g.id]).length : sinEl && (Object.keys(C.txt[g.id]).length || JSON.stringify(v0[g.id]) !== JSON.stringify(C.val[g.id]))) out = sub ? 'textos de subtítulos' : 'capas o textos';
      });
      return out;
    },
    helpExtra: function () {
      return '<b>Capas en la vista previa:</b> toca una para elegirla, arrástrala para moverla y los círculos de sus esquinas cambian el tamaño; cada capa va por su cuenta (los subtítulos, todos juntos). ' +
        '<b>Textos</b> (títulos, subtítulos...): doble clic encima para escribir ahí mismo (Intro termina, Esc deshace), o en el campo Texto del panel. ' +
        '<b>Zoom general</b> (arriba de la vista previa) acerca el plano de todos los clips.<br>';
    },
    inspector: function (sel) {
      var g = group(sel.id), hit = itemAt(g, A.state().t, true);
      return '<h3>Capa: ' + A.esc(g.label) + '</h3><div class="q">Texto, posición y tamaño en el vídeo</div>' + textRow(sel.id, hit && hit.it) + controls(sel.id, hit && hit.it);
    },
    inspectorExtra: function (sel, f) {
      var gid = f.kind === 'el' && C.byEl[f.id];
      if (!gid) return '';
      var it = group(gid).items.filter(function (x) { return x.el === f.id; })[0];
      return '<div class="tl-sub"><h4>Texto · ' + A.esc(group(gid).label) + '</h4>' + textRow(gid, it) + '</div>' +
        '<div class="tl-sub"><h4>Posición y tamaño · ' + A.esc(it && it.label || group(gid).label) + '</h4>' + controls(gid, it) + '</div>';
    },
    onClick: function (b, e) {
      var gid = b.dataset.g, k = e.shiftKey ? 10 : 1, cual = b.dataset.el && group(gid) ? group(gid).items.filter(function (x) { return x.el === b.dataset.el; })[0] : null;
      A.remember();
      if (b.dataset.a === 'txt0') { delete C.txt[gid][b.dataset.t]; A.touched('capas'); }
      else if (b.dataset.a === 'rz') C.val.reframe.zoom = C.rz.default || 1;
      else if (b.dataset.a === 'reset') { var it = cual || C.shown[gid]; if (sola(group(gid), it) && C.iv[gid][it.el]) delete C.iv[gid][it.el]; else C.val[gid] = copy(group(gid).default); }
      else if (b.dataset.a === 'all') { C.val[gid] = copy(valOf(gid, cual || C.shown[gid])); C.iv[gid] = {}; }
      else if (b.dataset.mv) { var d = b.dataset.mv.split(','); move(gid, +d[0] * k, +d[1] * k, cual); }
      else if (b.dataset.sz) size(gid, +b.dataset.sz * k, cual);
      touch();
    },
    onInput: function (el) {
      if (el.dataset.k === 'text') {
        if (Date.now() - C.lastMem > 800) A.remember();
        C.lastMem = Date.now();
        setText(el.dataset.g, group(el.dataset.g).items[+el.dataset.i], el.dataset.t, el.value);
        paint(A.state().t);
        return;
      }
      if (el.dataset.k !== 'zoom') return;
      if (Date.now() - C.lastMem > 800) A.remember();
      C.lastMem = Date.now();
      C.val.reframe.zoom = +el.value;
      A.touched('capas'); paint(A.state().t);
    },
    key: function (e) {
      var T = A.state();
      if (!(T.sel && T.sel.type === 'grp') || !/^Arrow/.test(e.key)) return false;
      e.preventDefault();
      var d = e.shiftKey ? 10 : 1;
      A.remember();
      move(T.sel.id, e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0, e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0);
      touch();
      return true;
    },
    snap: function () { return { v: copy(C.val), i: copy(C.iv), t: copy(C.txt) }; },
    restore: function (s) { C.val = copy(s.v); C.iv = copy(s.i || {}); C.txt = copy(s.t); },
    data: function () {
      var out = copy(C.val);
      Object.keys(out).forEach(function (g) {
        Object.keys(out[g]).forEach(function (k) { out[g][k] = /scale|zoom/.test(k) ? Math.round(out[g][k] * 1000) / 1000 : Math.round(out[g][k]); });
      });
      Object.keys(C.txt).forEach(function (g) { if (Object.keys(C.txt[g]).length) out[g].texts = copy(C.txt[g]); });
      Object.keys(C.iv).forEach(function (g) {
        var its = {};
        Object.keys(C.iv[g]).forEach(function (el) {
          var o = its[el] = {};
          Object.keys(C.iv[g][el]).forEach(function (k) { o[k] = /scale/.test(k) ? Math.round(C.iv[g][el][k] * 1000) / 1000 : Math.round(C.iv[g][el][k]); });
        });
        if (Object.keys(its).length) out[g].items = its;
      });
      return out;
    }
  });
})();
