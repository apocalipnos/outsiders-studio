// Módulo "Capas y encuadre" de la Edición: las capas del vídeo (imágenes, títulos, subtítulos...) se ven en la vista
// previa en su sitio y se mueven / cambian de tamaño ahí mismo con el ratón; el encuadre acerca el plano de todos los
// clips. Datos: <proyecto>/edicion/capas.json (lo escribe el script del plan) -> capas_edit.json al procesar.
//   {video, grade, fonts: [css], css, reframe: {origin: [x, y], default, max} | null,
//    groups: [{id, label, kind: 'box' | 'center', aspect, lockX, default: {...}, items: [{from, to, label, html, el}]}]}
//   box: {left, top, width} (alto = ancho / aspect) · center: {cx, top, scale} (centrado en cx, crece hacia abajo)
//   "el" une el item con su bloque de la pista Capas: si lo mueves en el tiempo, en la vista previa sale cuando dice el bloque.
//   Textos: los del item (sus [data-t="<clave>"], o su "text", o su trozo de texto más largo) se cambian en el panel o
//   con doble clic en la vista previa -> {<grupo>: {..., texts: {<clave, el o índice>: texto}}}. Los grupos de subtítulos
//   ("words": true o id "subs") los lleva Mi Estudio a words.json al procesar (edicion.aplicar_subtitulos).
(function () {
  var A, C, SNAP = 10;
  var copy = function (o) { return JSON.parse(JSON.stringify(o)); };

  function group(id) { return C.groups.filter(function (g) { return g.id === id; })[0]; }
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
      d.innerHTML = it.html || '';
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
      setText(gid, it, k, cancel ? t0 : sp.innerText);
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

  function paint(t) {
    var T = A.state(), fg = focus();
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
      el.style.cssText = g.kind === 'box'
        ? 'left:' + o.left + 'px;top:' + o.top + 'px;width:' + o.width + 'px;height:' + Math.round(o.width / (g.aspect || 1)) + 'px'
        : 'left:' + o.cx + 'px;top:' + o.top + 'px;transform:translateX(-50%) scale(' + o.scale + ')';
      el.classList.toggle('sel', g.id === fg);
      el.classList.toggle('ghost', hit.ghost);
    });
  }

  function vals(g) {
    var o = C.val[g.id];
    return g.kind === 'box'
      ? ['x ' + Math.round(o.left) + ' · y ' + Math.round(o.top), Math.round(o.width) + ' px de ancho']
      : [(g.lockX ? 'centrado · ' : 'centro x ' + Math.round(o.cx) + ' · ') + 'y ' + Math.round(o.top), Math.round(o.scale * 100) + ' %'];
  }
  function controls(gid) {
    var g = group(gid), v = vals(g), b = function (attr, txt, t) { return '<button data-p="capas" data-g="' + gid + '" ' + attr + ' title="' + (t || '') + '">' + txt + '</button>'; };
    return '<div class="tl-row"><label>Posición</label><span class="v wide">' + v[0] + '</span>' +
      (g.lockX ? '' : b('data-mv="-1,0"', '←', 'Mayús: 10 px')) + b('data-mv="0,-1"', '↑', 'Mayús: 10 px') + b('data-mv="0,1"', '↓', 'Mayús: 10 px') +
      (g.lockX ? '' : b('data-mv="1,0"', '→', 'Mayús: 10 px')) + '</div>' +
      '<div class="tl-row"><label>Tamaño</label>' + b('data-sz="-1"', '−') + '<span class="v wide">' + v[1] + '</span>' + b('data-sz="1"', '+') + '</div>' +
      '<div class="tl-acts">' + b('data-a="reset"', 'Restablecer posición y tamaño') + '</div>' +
      '<div class="help">Arrástrala en la vista previa; el círculo azul de su esquina cambia el tamaño. Vale para ' +
      (g.items.length > 1 ? 'las ' + g.items.length + ' capas de este grupo' : 'esta capa') + '. Flechas del teclado: 1 px (Mayús: 10 px).</div>';
  }

  function move(gid, dx, dy) {
    var g = group(gid), o = C.val[gid];
    if (g.kind === 'box') o.left += dx; else if (!g.lockX) o.cx += dx;
    o.top += dy;
  }
  function size(gid, k) {
    var g = group(gid), o = C.val[gid];
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
    var g = group(gid), sx = e.clientX, sy = e.clientY, start = copy(C.val[gid]), S = T.S;
    var startW = C.els[gid].getBoundingClientRect().width / S, moved = false;
    function mv(ev) {
      var dx = (ev.clientX - sx) / S, dy = (ev.clientY - sy) / S, o = C.val[gid], c;
      if (!moved && Math.abs(dx) + Math.abs(dy) < 2) return;
      moved = true;
      if (mode === 'move') {
        if (g.kind === 'box') { o.left = start.left + dx; o.top = start.top + dy; c = o.left + o.width / 2; }
        else { if (!g.lockX) o.cx = start.cx + dx; o.top = start.top + dy; c = o.cx; }
        var near = Math.abs(c - A.W / 2) < SNAP;
        C.guide.style.display = near ? 'block' : 'none';
        if (near) { if (g.kind === 'box') o.left = A.W / 2 - o.width / 2; else if (!g.lockX) o.cx = A.W / 2; }
      } else if (g.kind === 'box') {
        o.width = Math.max(120, start.width + Math.max(dx, dy * (g.aspect || 1)));
      } else {            // centrada: crece por los dos lados, así que el asa se mueve la mitad de lo que crece
        o.scale = Math.round(A.clamp(start.scale * Math.max(60, startW + 2 * dx) / startW, 0.3, 3) * 1000) / 1000;
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
      C = { groups: input.groups, rz: input.reframe || null, els: {}, byEl: {}, val: {}, txt: {}, shown: {}, rowSig: {}, ed: null, lastMem: 0 };
      C.groups.forEach(function (g) {
        var sv = Object.assign({}, (saved || {})[g.id] || {});
        C.txt[g.id] = sv.texts || {};
        delete sv.texts;
        C.val[g.id] = Object.assign(copy(g.default), sv);
        g.items.forEach(function (it) { if (it.el) C.byEl[it.el] = g.id; });
      });
      if (C.rz) C.val.reframe = { zoom: ((saved || {}).reframe || {}).zoom || C.rz.default || 1 };
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
          '<div class="cp-tag">' + A.esc(g.label) + '</div><div class="cp-h"></div></div>';
      }).join('');
      C.guide = T.el.ov.querySelector('.cp-guide');
      C.groups.forEach(function (g) {
        var d = C.els[g.id] = T.el.ov.querySelector('.cp-g[data-g="' + g.id + '"]');
        d.addEventListener('pointerdown', function (e) { drag(g.id, 'move', e); });
        d.querySelector('.cp-h').addEventListener('pointerdown', function (e) { drag(g.id, 'size', e); });
        d.addEventListener('dblclick', function (e) { e.preventDefault(); edit(g.id, e); });
      });
      T.el.stage.addEventListener('pointerdown', function (e) {       // tocar el vídeo fuera de las capas suelta la elegida
        if (!e.target.closest('.cp-g') && focus()) A.select(null);
      });
      return true;
    },
    toolbar: function () {
      return C.rz ? '<label class="tl-rz">Encuadre <input type="range" data-p="capas" data-k="zoom" min="1" max="' + (C.rz.max || 1.4) +
        '" step="0.005"><span class="tl-rzv"></span><button data-p="capas" data-a="rz" title="Volver al encuadre propuesto">↺</button></label>' : '';
    },
    paint: paint,
    helpExtra: function () {
      return '<b>Capas en la vista previa:</b> toca una para elegirla, arrástrala para moverla y el círculo azul de su esquina cambia el tamaño (vale para todo su grupo). ' +
        '<b>Textos</b> (títulos, subtítulos...): doble clic encima para escribir ahí mismo (Intro termina, Esc deshace), o en el campo Texto del panel. ' +
        '<b>Encuadre</b> (arriba de la línea de tiempo) acerca el plano de todos los clips. <b>Zona segura</b> enseña en rojo lo que tapa Instagram.<br>';
    },
    inspector: function (sel) {
      var g = group(sel.id), hit = itemAt(g, A.state().t, true);
      return '<h3>Capa: ' + A.esc(g.label) + '</h3><div class="q">Texto, posición y tamaño en el vídeo</div>' + textRow(sel.id, hit && hit.it) + controls(sel.id);
    },
    inspectorExtra: function (sel, f) {
      var gid = f.kind === 'el' && C.byEl[f.id];
      if (!gid) return '';
      var it = group(gid).items.filter(function (x) { return x.el === f.id; })[0];
      return '<div class="tl-sub"><h4>Texto · ' + A.esc(group(gid).label) + '</h4>' + textRow(gid, it) + '</div>' +
        '<div class="tl-sub"><h4>Posición y tamaño · ' + A.esc(group(gid).label) + '</h4>' + controls(gid) + '</div>';
    },
    onClick: function (b, e) {
      var gid = b.dataset.g, k = e.shiftKey ? 10 : 1;
      A.remember();
      if (b.dataset.a === 'txt0') { delete C.txt[gid][b.dataset.t]; A.touched('capas'); }
      else if (b.dataset.a === 'rz') C.val.reframe.zoom = C.rz.default || 1;
      else if (b.dataset.a === 'reset') C.val[gid] = copy(group(gid).default);
      else if (b.dataset.mv) { var d = b.dataset.mv.split(','); move(gid, +d[0] * k, +d[1] * k); }
      else if (b.dataset.sz) size(gid, +b.dataset.sz * k);
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
    snap: function () { return { v: copy(C.val), t: copy(C.txt) }; },
    restore: function (s) { C.val = copy(s.v); C.txt = copy(s.t); },
    data: function () {
      var out = copy(C.val);
      Object.keys(out).forEach(function (g) {
        Object.keys(out[g]).forEach(function (k) { out[g][k] = /scale|zoom/.test(k) ? Math.round(out[g][k] * 1000) / 1000 : Math.round(out[g][k]); });
      });
      Object.keys(C.txt).forEach(function (g) { if (Object.keys(C.txt[g]).length) out[g].texts = copy(C.txt[g]); });
      return out;
    }
  });
})();
