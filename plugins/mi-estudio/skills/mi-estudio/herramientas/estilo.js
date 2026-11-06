// Módulo "Estilo" de la Edición: el panel Diseño de HyperFrames Studio para una capa (texto, relleno, trazo, radio, sombra,
// desenfoque, opacidad, fusión, recorte, rotación, posición, orden y flex). Se aplica en vivo con una hoja de estilos propia,
// así no choca con capas.js (reescribe el style de .cp-g) ni con los fotogramas clave (van en línea en .cp-in).
// Datos: edicion/estilo_edit.json = {targets: {<objetivo>: {css: {...}, crop: {top,right,bottom,left}, z, ui}}, fonts: {<familia>: {source, files}}}
//   ui solo sirve para volver a rellenar este panel (tipo de relleno, paradas...); aplicar.py puede ignorarlo.
//   Dónde va cada propiedad: texto -> el elemento y todo lo de dentro (!important); mix-blend-mode y z -> la capa entera; lo demás -> su raíz.
(function () {
  var A, E;
  var TEXT = { color: 1, 'font-family': 1, 'font-size': 1, 'font-weight': 1, 'letter-spacing': 1, 'line-height': 1, 'text-align': 1, 'text-transform': 1, 'font-style': 1, '-webkit-text-stroke': 1, 'text-shadow': 1 };
  var SOFT = { opacity: 1, rotate: 1 };   // sin !important: los fotogramas clave (en línea) mandan si caen en el mismo elemento
  var SYS = ['Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Courier New', 'Verdana', 'Tahoma', 'Trebuchet MS', 'Impact', 'Segoe UI', 'system-ui'];
  var GOO = ['Inter', 'Inter Tight', 'Anton', 'Bebas Neue', 'Montserrat', 'Poppins', 'Roboto', 'Oswald', 'Lato', 'Open Sans', 'Playfair Display', 'Archivo', 'DM Sans', 'DM Serif Display', 'Barlow', 'Barlow Condensed', 'Raleway', 'Nunito', 'Work Sans', 'League Spartan', 'Space Grotesk', 'Caveat', 'Permanent Marker', 'Lobster'];
  var BLENDES = { normal: 'Normal', multiply: 'Multiplicar', screen: 'Pantalla', overlay: 'Superponer', darken: 'Oscurecer', lighten: 'Aclarar', 'color-dodge': 'Sobreexponer', 'color-burn': 'Quemar', 'hard-light': 'Luz fuerte', 'soft-light': 'Luz suave', difference: 'Diferencia', exclusion: 'Exclusión', hue: 'Tono', saturation: 'Saturación', color: 'Color', luminosity: 'Brillo' };
  var BLEND = ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity'];
  var PAL = ['#ffffff', '#e5e5e5', '#a3a3a3', '#525252', '#171717', '#000000', '#ef4444', '#f97316', '#f5c518', '#22c55e', '#3ce6ac', '#06b6d4', '#1a5df1', '#6366f1', '#a78bfa', '#ec4899', '#f3f2ee', '#195ff1'];
  var CSS_ = '.ey-r label{width:64px}.ey-n{width:62px}.ey-u{color:var(--t3);font-size:10px;margin-left:-2px}.ey-font{flex:1;min-width:120px}.ey-grow{flex:1;min-width:60px}' +
    '.ey-sw{width:24px;height:22px;padding:2px;border-radius:5px;background:var(--card2);flex:none}.ey-sw i{display:block;width:100%;height:100%;border-radius:3px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14);background-clip:padding-box}' +
    '.ey-seg{display:inline-flex;gap:1px;background:var(--card2);border-radius:6px;padding:1px}.ey-seg button{border:0;background:none;padding:3px 7px;color:var(--t3);font-size:11px;min-width:24px}.ey-seg button:hover{color:var(--t1);border:0}.ey-seg button.on{background:var(--b1);color:var(--a)}' +
    '.ey-bar{height:12px;border-radius:4px;margin:6px 0;box-shadow:inset 0 0 0 1px rgba(255,255,255,.14)}.ey-stop{display:flex;gap:5px;align-items:center;margin:4px 0}.ey-mini{padding:1px 6px;font-size:11px}' +
    '.ey-sides{display:grid;grid-template-columns:repeat(4,1fr);gap:4px}.ey-sides label{width:auto;font-size:10px;color:var(--t3);display:flex;flex-direction:column;gap:2px}.ey-sides input{width:100%}' +
    '.ey-pop{width:216px}.ey-sv{position:relative;height:120px;border-radius:6px;cursor:crosshair;touch-action:none}.ey-sv i{position:absolute;width:10px;height:10px;margin:-5px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 2px #000;pointer-events:none}' +
    '.ey-cps{width:100%;height:12px;margin:8px 0 0;display:block;-webkit-appearance:none;appearance:none;border-radius:6px;outline:0}.ey-cps::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 0 2px #000;cursor:ew-resize}' +
    '.ey-hue{background:linear-gradient(90deg,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)}.ey-cpr{display:flex;gap:6px;align-items:center;margin-top:8px}.ey-hex{flex:1;width:60px;user-select:text}.ey-al-v{color:var(--t3);font-size:10px;width:30px;text-align:right}' +
    '.ey-pal{display:grid;grid-template-columns:repeat(9,1fr);gap:3px;margin-top:8px}.ey-pal button{height:18px;padding:0;border-radius:4px;border:1px solid rgba(255,255,255,.14)}' +
    '.ey-crop{position:absolute;z-index:55;outline:3px solid var(--a);cursor:move;box-shadow:0 0 0 4000px rgba(0,0,0,.35);touch-action:none}.ey-crop b{position:absolute;background:var(--a);border-radius:6px}' +
    '.ey-crop b[data-s=top],.ey-crop b[data-s=bottom]{left:50%;width:90px;height:14px;margin-left:-45px;cursor:ns-resize}.ey-crop b[data-s=top]{top:-7px}.ey-crop b[data-s=bottom]{bottom:-7px}' +
    '.ey-crop b[data-s=left],.ey-crop b[data-s=right]{top:50%;width:14px;height:90px;margin-top:-45px;cursor:ew-resize}.ey-crop b[data-s=left]{left:-7px}.ey-crop b[data-s=right]{right:-7px}';
  var copy = function (o) { return JSON.parse(JSON.stringify(o)); };
  var num = function (v, d) { v = parseFloat(v); return isNaN(v) ? (d === undefined ? '' : d) : v; };
  var cssq = function (s) { return window.CSS && CSS.escape ? CSS.escape(s) : s; };

  function capas() { return A.state().plugins.filter(function (p) { return p.id === 'capas'; })[0]; }
  function fxOf(id, libre) { return A.state().fx.filter(function (f) { return f.kind === 'el' && f.id === id && !!f.libre === !!libre; })[0]; }
  function groupOf(id) { var f = fxOf(id), p = capas(), l = f && p && p.laneOf(f); return l ? l.id : null; }
  function target() {
    var T = A.state(), s = T.sel;
    if (!s) return null;
    if (s.type === 'grp') return 'grp:' + s.id;
    if (s.type === 'seg') { var it = T.L.filter(function (x) { return x.s._id === s.id; })[0]; return it && !it.s.off ? 'seg:' + it.s.id : null; }   // solo ese clip
    if (s.type === 'fx') { var f = T.fx[s.id]; if (f && f.kind === 'el' && !f.sonido) return (f.libre ? 'lib:' : 'el:') + f.id; }
    return null;
  }
  function tid(tg) { return tg.slice(tg.indexOf(':') + 1); }
  function vidLike(tg) { return tg === 'video' || tg.indexOf('seg:') === 0; }     // el vídeo entero o un clip: sin capa ni contenido
  function sels(tg) {                       // los selectores de una capa en la vista previa
    if (tg === 'video') return { outer: '.tl-rf', inner: '.tl-rf' };
    if (tg.indexOf('seg:') === 0) { var q = '.tl-img[data-seg="' + tid(tg) + '"]'; return { outer: q, inner: q }; }   // su imagen, mientras se ve
    var id = tid(tg), o;
    if (tg.indexOf('grp:') === 0) o = '.cp-g[data-g="' + id + '"]';
    else if (tg.indexOf('lib:') === 0) return { outer: '.lb-l[data-lb="' + id + '"]', inner: '.lb-l[data-lb="' + id + '"] .lb-in' };
    else { var g = groupOf(id); if (!g) return null; o = '.cp-g[data-g="' + g + '"][data-es="' + id + '"]'; }
    return { outer: o, inner: o + ' .cp-in' };
  }
  function node(tg) {                       // los elementos reales: capa, interior y raíz del contenido
    var ov = A.state().el.ov, d, inner;
    if (tg === 'video') return { outer: A.state().el.rf, inner: A.state().el.rf, root: A.state().el.rf };
    if (tg.indexOf('seg:') === 0) return { outer: A.state().el.img, inner: A.state().el.img, root: A.state().el.img };
    if (tg.indexOf('lib:') === 0) { d = ov.querySelector('.lb-l[data-lb="' + cssq(tid(tg)) + '"]'); inner = d && d.querySelector('.lb-in'); }
    else { var g = tg.indexOf('grp:') === 0 ? tid(tg) : groupOf(tid(tg)); d = g && ov.querySelector('.cp-g[data-g="' + cssq(g) + '"]'); inner = d && d.querySelector('.cp-in'); }
    if (!d || !inner) return null;
    return { outer: d, inner: inner, root: inner.children.length === 1 ? inner.children[0] : inner };
  }
  function firstText(n) {                   // el elemento que lleva el primer trozo de texto (para leer sus valores reales)
    var w = document.createTreeWalker(n.inner, NodeFilter.SHOW_TEXT), x;
    while ((x = w.nextNode())) if (x.nodeValue.trim()) return x.parentNode;
    return n.inner;
  }

  // ---------- aplicar ----------
  function fix(v) { return String(v).replace(/url\((\s*['"]?)(?!\/|https?:|data:|blob:|#)/g, 'url($1/p/'); }
  function build() {
    var out = '', keys = Object.keys(E.targets).sort(function (a, b) { return (a.indexOf('el:') === 0 ? 1 : 0) - (b.indexOf('el:') === 0 ? 1 : 0); });
    E.els = [];
    keys.forEach(function (tg) {
      var o = E.targets[tg], s = sels(tg), css = o.css || {}, w = '', t = '', r = '';
      if (tg.indexOf('el:') === 0) E.els.push(tid(tg));
      if (!s) return;
      Object.keys(css).forEach(function (k) {
        var bang = SOFT[k] || vidLike(tg) ? '' : ' !important', d = k + ':' + fix(css[k]) + bang + ';';
        if (k === 'mix-blend-mode') w += d; else if (TEXT[k]) t += d; else r += d;
      });
      if (o.z != null && !vidLike(tg)) w += 'z-index:' + o.z + ' !important;';
      if (o.crop) r += 'clip-path:inset(' + (o.crop.top || 0) + '% ' + (o.crop.right || 0) + '% ' + (o.crop.bottom || 0) + '% ' + (o.crop.left || 0) + '%)' + (vidLike(tg) ? '' : ' !important') + ';';
      if (w) out += s.outer + '{' + w + '}\n';
      if (r) out += vidLike(tg) ? s.outer + '{' + r + '}\n' : s.inner + ' > :only-child,' + s.inner + ':has(> :nth-child(2)),' + s.inner + ':not(:has(> *)){' + r + '}\n';
      if (t) out += s.inner + ',' + s.inner + ' *{' + t + '}\n';
    });
    E.style.textContent = out;
  }
  function ensure(tg) { return E.targets[tg] || (E.targets[tg] = { css: {} }); }
  function setCss(tg, k, v) {
    var o = ensure(tg);
    o.css = o.css || {};
    if (v == null || v === '') delete o.css[k]; else o.css[k] = String(v);
  }
  function markEls(t) {                     // un elemento suelto de un grupo: su regla solo vale mientras es el que se ve
    var T = A.state();
    E.els.forEach(function (id) {
      var f = fxOf(id), g = groupOf(id), d = g && T.el.ov.querySelector('.cp-g[data-g="' + cssq(g) + '"]'), r = f && !f.off && A.fxRange(f);
      if (!d) return;
      if (r && t >= r[0] && t < r[1]) d.dataset.es = id; else if (d.dataset.es === id) delete d.dataset.es;
    });
  }
  function done() { build(); markEls(A.state().t); A.touched('estilo'); }
  function mem() { if (Date.now() - E.lastMem > 700) A.remember(); E.lastMem = Date.now(); }
  function ui(tg, k, def) { var o = ensure(tg); o.ui = o.ui || {}; if (!o.ui[k]) o.ui[k] = def; return o.ui[k]; }

  // ---------- fuentes ----------
  function loadGoogle(name) {
    if (!name || E.gLoaded[name]) return;
    E.gLoaded[name] = true;
    var l = document.createElement('link');
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css?family=' + encodeURIComponent(name) + ':300,400,500,600,700,800,900,400i,700i&display=swap';
    document.head.appendChild(l);
  }
  function useFont(name) {
    if (!name) return;
    if (E.proj[name]) E.fonts[name] = { source: 'project', files: E.proj[name] };
    else if (SYS.indexOf(name) >= 0) E.fonts[name] = { source: 'system' };
    else { E.fonts[name] = { source: 'google' }; loadGoogle(name); }
  }
  function fontOptions() {
    var seen = {}, html = '';
    Object.keys(E.proj).concat(SYS, GOO).forEach(function (f) { if (!seen[f]) { seen[f] = 1; html += '<option value="' + A.esc(f) + '">'; } });
    var dl = document.getElementById('ey-fonts');
    if (dl) dl.innerHTML = html;
  }
  function loadFonts() {
    A.api('/api/fonts').then(function (list) {
      var css = '';
      (list || []).forEach(function (f) {
        var m = /^(.+?)-(\d{3})-(normal|italic)\./.exec(f.file), base = m ? m[1] : f.family, fam = base.replace(/([a-z])([A-Z])/g, '$1 $2');
        (E.proj[fam] = E.proj[fam] || []).push('assets/fonts/' + f.file);
        css += '@font-face{font-family:"' + fam + '";src:url("' + f.url + '");font-weight:' + (m ? m[2] : 'normal') + ';font-style:' + (m ? m[3] : 'normal') + ';font-display:swap}\n';
      });
      var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
      fontOptions();
    }).catch(function () { fontOptions(); });
  }

  // ---------- colores ----------
  function parseColor(c) {
    c = String(c == null ? '' : c).trim();
    var m;
    if ((m = /^#([0-9a-f]{3,8})$/i.exec(c))) {
      var h = m[1];
      if (h.length <= 4) h = h.split('').map(function (x) { return x + x; }).join('');
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16), a: h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1 };
    }
    if ((m = /^rgba?\(\s*([\d.]+)[ ,]+([\d.]+)[ ,]+([\d.]+)(?:[ ,/]+([\d.]+%?))?\s*\)$/i.exec(c))) return { r: +m[1], g: +m[2], b: +m[3], a: m[4] == null ? 1 : /%$/.test(m[4]) ? parseFloat(m[4]) / 100 : +m[4] };
    return null;
  }
  function hex2(n) { return ('0' + Math.round(n).toString(16)).slice(-2); }
  function toCss(c) { return c.a >= .999 ? '#' + hex2(c.r) + hex2(c.g) + hex2(c.b) : 'rgba(' + Math.round(c.r) + ',' + Math.round(c.g) + ',' + Math.round(c.b) + ',' + Math.round(c.a * 1000) / 1000 + ')'; }
  function rgb2hsv(c) {
    var r = c.r / 255, g = c.g / 255, b = c.b / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: h * 60, s: mx ? d / mx : 0, v: mx, a: c.a };
  }
  function hsv2rgb(o) {
    var f = function (n) { var k = (n + o.h / 60) % 6; return o.v - o.v * o.s * Math.max(0, Math.min(k, 4 - k, 1)); };
    return { r: f(5) * 255, g: f(3) * 255, b: f(1) * 255, a: o.a };
  }
  function getC(tg, path) {
    var o = E.targets[tg] || {}, u = o.ui || {}, p = path.split(':');
    if (p[0] === 'css') return (o.css || {})[p[1]] || '';
    if (p[0] === 'stop') return ((u.fill || {}).stops || [])[+p[1]] ? u.fill.stops[+p[1]].c : '#ffffff';
    return (u[p[0]] || {})[p[1]] || '';
  }
  function setC(tg, path, v) {
    var p = path.split(':');
    if (p[0] === 'css') setCss(tg, p[1], v);
    else if (p[0] === 'stop') { ui(tg, 'fill', defFill()).stops[+p[1]].c = v; applyFill(tg); }
    else if (p[0] === 'fill') { ui(tg, 'fill', defFill()).color = v; applyFill(tg); }
    else if (p[0] === 'stroke') { ui(tg, 'stroke', defStroke()).color = v; applyStroke(tg); }
    else if (p[0] === 'shadow') { ui(tg, 'shadow', defShadow()).color = v; applyShadow(tg); }
    else if (p[0] === 'tstroke') { ui(tg, 'tstroke', { w: 0, color: '#000000' }).color = v; applyTStroke(tg); }
  }
  function openColor(btn) {
    var tg = target(), path = btn.dataset.c, cur = parseColor(getC(tg, path)) || parseColor(btn.dataset.ph) || { r: 255, g: 255, b: 255, a: 1 }, h = rgb2hsv(cur);
    var d = A.popup('<div class="ey-sv"><i></i></div><input type="range" class="ey-cps ey-hue" min="0" max="360" step="1" value="' + h.h + '">' +
      '<input type="range" class="ey-cps ey-al" min="0" max="100" step="1" value="' + Math.round(h.a * 100) + '"><div class="ey-cpr"><input class="st-in ey-hex" spellcheck="false"><span class="ey-al-v"></span>' +
      '<button class="ey-mini" data-none="1" title="Quitar este color">Quitar</button></div><div class="ey-pal">' +
      E.recent.concat(PAL).slice(0, 27).map(function (c) { return '<button data-c2="' + c + '" style="background:' + c + '" title="' + c + '"></button>'; }).join('') + '</div>', btn, 'ey-pop');
    var sv = d.querySelector('.ey-sv'), knob = sv.querySelector('i'), hue = d.querySelector('.ey-hue'), al = d.querySelector('.ey-al'), hex = d.querySelector('.ey-hex'), alv = d.querySelector('.ey-al-v');
    function view(skipHex) {
      var c = hsv2rgb({ h: h.h, s: 1, v: 1, a: 1 }), now = toCss(hsv2rgb(h));
      sv.style.background = 'linear-gradient(transparent,#000),linear-gradient(90deg,#fff,' + toCss(c) + ')';
      knob.style.left = h.s * 100 + '%'; knob.style.top = (1 - h.v) * 100 + '%';
      var op = hsv2rgb({ h: h.h, s: h.s, v: h.v, a: 1 });
      al.style.background = 'linear-gradient(90deg,transparent,' + toCss(op) + ')';
      alv.textContent = Math.round(h.a * 100) + ' %';
      if (!skipHex) hex.value = now;
    }
    function commit(val, skipHex) {
      mem();
      setC(tg, path, val);
      done();
      A.state().el.insp.querySelectorAll('.ey-sw[data-c="' + path + '"] i').forEach(function (i) { i.style.background = val || 'transparent'; });
      var bar = A.state().el.insp.querySelector('.ey-bar');
      if (bar) bar.style.background = ((E.targets[tg].ui || {}).fill && fillCss(E.targets[tg].ui.fill)) || 'none';
      view(skipHex);
    }
    function pick(ev) {
      var r = sv.getBoundingClientRect();
      h.s = A.clamp((ev.clientX - r.left) / r.width, 0, 1); h.v = 1 - A.clamp((ev.clientY - r.top) / r.height, 0, 1);
      commit(toCss(hsv2rgb(h)));
    }
    sv.addEventListener('pointerdown', function (ev) {
      ev.preventDefault(); sv.setPointerCapture(ev.pointerId); pick(ev);
      function mv(e2) { pick(e2); }
      function up() { sv.removeEventListener('pointermove', mv); sv.removeEventListener('pointerup', up); }
      sv.addEventListener('pointermove', mv); sv.addEventListener('pointerup', up);
    });
    hue.addEventListener('input', function () { h.h = +hue.value; commit(toCss(hsv2rgb(h))); });
    al.addEventListener('input', function () { h.a = +al.value / 100; commit(toCss(hsv2rgb(h))); });
    hex.addEventListener('input', function () {
      var c = parseColor(hex.value);
      if (!c) return;
      h = rgb2hsv(c); hue.value = h.h; al.value = Math.round(h.a * 100);
      commit(toCss(c), true);
    });
    d.addEventListener('click', function (ev) {
      var b = ev.target.closest('button');
      if (!b) return;
      if (b.dataset.none) { commit(''); A.closePopup(); return; }
      var c = parseColor(b.dataset.c2);
      h = rgb2hsv(c); hue.value = h.h; al.value = Math.round(h.a * 100);
      commit(toCss(c));
      if (E.recent.indexOf(b.dataset.c2) < 0) E.recent.unshift(b.dataset.c2);
    });
    view();
  }

  // ---------- relleno, trazo, sombra ----------
  function defFill() { return { type: 'auto', color: '#ffffff', angle: 90, stops: [{ c: '#1a5df1', p: 0 }, { c: '#3ce6ac', p: 100 }], image: '', size: 'cover' }; }
  function stops(f) { return f.stops.slice().sort(function (a, b) { return a.p - b.p; }).map(function (s) { return s.c + ' ' + s.p + '%'; }).join(', '); }
  function fillCss(f) {
    if (f.type === 'none') return 'none';
    if (f.type === 'solid') return f.color;
    if (f.type === 'linear') return 'linear-gradient(' + f.angle + 'deg, ' + stops(f) + ')';
    if (f.type === 'radial') return 'radial-gradient(circle, ' + stops(f) + ')';
    if (f.type === 'conic') return 'conic-gradient(from ' + f.angle + 'deg, ' + stops(f) + ')';
    if (f.type === 'image' && f.image) return 'url("' + f.image + '") center/' + f.size + ' no-repeat';
    return null;
  }
  function applyFill(tg) { setCss(tg, 'background', fillCss(ui(tg, 'fill', defFill()))); }
  function defStroke() { return { w: 0, style: 'solid', color: '#ffffff', sides: { top: 1, right: 1, bottom: 1, left: 1 } }; }
  function applyStroke(tg) {
    var s = ui(tg, 'stroke', defStroke());
    if (!s.w) { ['border-width', 'border-style', 'border-color', 'box-sizing'].forEach(function (k) { setCss(tg, k, null); }); return; }
    setCss(tg, 'border-width', ['top', 'right', 'bottom', 'left'].map(function (k) { return (s.sides[k] ? s.w : 0) + 'px'; }).join(' '));
    setCss(tg, 'border-style', s.style); setCss(tg, 'border-color', s.color); setCss(tg, 'box-sizing', 'border-box');
  }
  function defShadow() { return { on: false, x: 0, y: 8, blur: 24, spread: 0, color: 'rgba(0,0,0,0.5)', text: false }; }
  function applyShadow(tg) {
    var s = ui(tg, 'shadow', defShadow());
    setCss(tg, 'box-shadow', s.on && !s.text ? s.x + 'px ' + s.y + 'px ' + s.blur + 'px ' + s.spread + 'px ' + s.color : null);
    setCss(tg, 'text-shadow', s.on && s.text ? s.x + 'px ' + s.y + 'px ' + s.blur + 'px ' + s.color : null);
  }
  function applyTStroke(tg) { var s = ui(tg, 'tstroke', { w: 0, color: '#000000' }); setCss(tg, '-webkit-text-stroke', s.w ? s.w + 'px ' + s.color : null); }
  function radii(tg) {
    var v = ((E.targets[tg] || {}).css || {})['border-radius'], p = String(v || '').split(/\s+/).filter(Boolean).map(function (x) { return num(x, 0); });
    if (!p.length) return [0, 0, 0, 0];
    return [p[0], p[1] == null ? p[0] : p[1], p[2] == null ? p[0] : p[2], p[3] == null ? (p[1] == null ? p[0] : p[1]) : p[3]];
  }

  // ---------- recorte: bordes y centro arrastrables en la vista previa ----------
  function cropBox() {
    var T = A.state(), tg = E.cropOn, n = tg && node(tg);
    if (!E.cropEl) return;
    if (!n || target() !== tg) { E.cropEl.hidden = true; return; }
    var r = n.root.getBoundingClientRect(), s = T.el.stage.getBoundingClientRect(), S = T.S, c = (E.targets[tg] || {}).crop || {};
    if (!r.width) { E.cropEl.hidden = true; return; }
    var x = (r.left - s.left) / S, y = (r.top - s.top) / S, w = r.width / S, h = r.height / S;
    E.cropEl.hidden = false;
    E.cropEl.style.left = x + w * (c.left || 0) / 100 + 'px'; E.cropEl.style.top = y + h * (c.top || 0) / 100 + 'px';
    E.cropEl.style.width = w * (1 - ((c.left || 0) + (c.right || 0)) / 100) + 'px'; E.cropEl.style.height = h * (1 - ((c.top || 0) + (c.bottom || 0)) / 100) + 'px';
  }
  function cropDrag(e) {
    e.preventDefault(); e.stopPropagation();
    A.stop();
    var tg = E.cropOn, n = node(tg), side = e.target.dataset.s || 'move', o = ensure(tg);
    o.crop = o.crop || { top: 0, right: 0, bottom: 0, left: 0 };
    var c0 = copy(o.crop), r = n.root.getBoundingClientRect(), w = r.width, h = r.height, x0 = e.clientX, y0 = e.clientY, moved = false;
    function mv(ev) {
      var dx = (ev.clientX - x0) / w * 100, dy = (ev.clientY - y0) / h * 100, c = o.crop;
      if (!moved) { if (Math.abs(ev.clientX - x0) + Math.abs(ev.clientY - y0) < 2) return; moved = true; A.remember(); }
      if (side === 'top') c.top = A.clamp(c0.top + dy, 0, 95 - c0.bottom);
      else if (side === 'bottom') c.bottom = A.clamp(c0.bottom - dy, 0, 95 - c0.top);
      else if (side === 'left') c.left = A.clamp(c0.left + dx, 0, 95 - c0.right);
      else if (side === 'right') c.right = A.clamp(c0.right - dx, 0, 95 - c0.left);
      else {                                // reencuadrar: la ventana se mueve entera
        var mx = A.clamp(dx, -c0.left, c0.right), my = A.clamp(dy, -c0.top, c0.bottom);
        c.left = c0.left + mx; c.right = c0.right - mx; c.top = c0.top + my; c.bottom = c0.bottom - my;
      }
      ['top', 'right', 'bottom', 'left'].forEach(function (k) { c[k] = Math.round(c[k] * 10) / 10; });
      done(); cropBox();
      ['top', 'right', 'bottom', 'left'].forEach(function (k) { var i = A.state().el.insp.querySelector('[data-k="crop:' + k + '"]'); if (i) i.value = c[k]; });
    }
    function up() { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }

  // ---------- orden ----------
  function layers() {                       // las capas apiladas, de delante a atrás
    var T = A.state(), out = [], i = 0;
    T.el.ov.querySelectorAll('.cp-g').forEach(function (d) { var tag = d.querySelector('.cp-tag'); out.push({ target: 'grp:' + d.dataset.g, label: tag ? tag.textContent : d.dataset.g, i: i++ }); });
    if (window.MiLibres) MiLibres.list().forEach(function (it) { if (it.type !== 'audio') out.push({ target: 'lib:' + it.id, label: it.label, i: i++ }); });
    out.forEach(function (o) { var e = E.targets[o.target]; o.z = e && e.z != null ? e.z : 0; });
    return out.sort(function (a, b) { return (b.z - a.z) || (b.i - a.i); });
  }
  function setOrder(list) {                 // lista de objetivos de delante a atrás: z de 1 en adelante, siempre por encima del vídeo
    var n = list.length;
    list.forEach(function (tg, i) { ensure(tg).z = n - i; });
    done();
  }
  function orderTarget(tg) { return tg.indexOf('el:') === 0 ? 'grp:' + groupOf(tid(tg)) : tg; }
  function move(tg, how) {
    var list = layers().map(function (l) { return l.target; }), t = orderTarget(tg), i = list.indexOf(t);
    if (i < 0) return;
    list.splice(i, 1);
    if (how === 'front') list.unshift(t);
    else if (how === 'back') list.push(t);
    else if (how === 'fwd') list.splice(Math.max(0, i - 1), 0, t);
    else list.splice(Math.min(list.length, i + 1), 0, t);
    A.remember();
    setOrder(list);
    A.refresh();
    A.showRight(A.state().rtab);
  }

  // ---------- panel ----------
  function row(label, ctrl) { return '<div class="tl-row ey-r"><label>' + label + '</label>' + ctrl + '</div>'; }
  function nI(k, v, ph, o) {
    o = o || {};
    return '<input type="number" class="st-in ey-n" data-keep="1" data-p="estilo" data-k="' + k + '" value="' + A.esc(v == null ? '' : v) + '" placeholder="' + A.esc(ph == null ? '' : ph) + '"' + (o.step ? ' step="' + o.step + '"' : '') + (o.min != null ? ' min="' + o.min + '"' : '') + (o.max != null ? ' max="' + o.max + '"' : '') + '>' + (o.u ? '<span class="ey-u">' + o.u + '</span>' : '');
  }
  function sI(k, opts, v) { return '<select data-p="estilo" data-k="' + k + '">' + opts.map(function (o) { var a = o.push ? o : [o, o]; return '<option value="' + A.esc(a[0]) + '"' + (String(a[0]) === String(v) ? ' selected' : '') + '>' + A.esc(a[1]) + '</option>'; }).join('') + '</select>'; }
  function swI(path, c, title, ph) { return '<button class="ey-sw" data-p="estilo" data-a="color" data-c="' + path + '" data-ph="' + A.esc(ph || '') + '" title="' + A.esc(title || 'Elegir color') + '"><i style="background:' + A.esc(c || ph || 'transparent') + '"></i></button>'; }
  function slI(k, v, a, b, st) { return '<input type="range" class="st-sl" data-p="estilo" data-k="' + k + '" min="' + a + '" max="' + b + '" step="' + st + '" value="' + v + '">'; }
  function seg(k, opts, v) { return '<span class="ey-seg">' + opts.map(function (o) { return '<button data-p="estilo" data-a="set" data-css="' + k + '" data-v="' + A.esc(o[0]) + '" class="' + (String(v) === o[0] ? 'on' : '') + '" title="' + A.esc(o[2] || '') + '">' + o[1] + '</button>'; }).join('') + '</span>'; }

  function textSec(tg, o, n) {
    var c = o.css || {}, cs = getComputedStyle(firstText(n)), ts = ((o.ui || {}).tstroke) || { w: 0, color: '#000000' };
    return row('Fuente', '<input class="st-in ey-font" list="ey-fonts" data-keep="1" data-p="estilo" data-k="font" value="' + A.esc(c['font-family'] || '') + '" placeholder="' + A.esc(cs.fontFamily.split(',')[0].replace(/["']/g, '')) + '" title="Fuentes del proyecto, del sistema, o el nombre de cualquiera de Google Fonts">') +
      row('Tamaño', nI('px:font-size', num(c['font-size']), Math.round(parseFloat(cs.fontSize)), { u: 'px', min: 1 }) + '<label style="width:auto;margin-left:8px">Grosor</label>' + sI('raw:font-weight', [['', 'Propio'], '100', '200', '300', '400', '500', '600', '700', '800', '900'], c['font-weight'] || '')) +
      row('Entre letras', nI('px:letter-spacing', num(c['letter-spacing']), num(cs.letterSpacing, 0), { u: 'px', step: .5 }) + '<label style="width:auto;margin-left:8px">Línea</label>' + nI('raw:line-height', num(c['line-height']), Math.round(parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) * 100) / 100 || 1.2, { step: .05 })) +
      row('Alineado', seg('text-align', [['left', '⇤', 'Izquierda'], ['center', '↔', 'Centro'], ['right', '⇥', 'Derecha'], ['justify', '≡', 'Justificado']], c['text-align'] || '')) +
      row('Estilo', seg('text-transform', [['none', 'Aa', 'Tal cual'], ['uppercase', 'AA', 'Mayúsculas'], ['lowercase', 'aa', 'Minúsculas'], ['capitalize', 'Ab', 'Iniciales']], c['text-transform'] || '') + ' ' + seg('font-style', [['italic', '<i>I</i>', 'Cursiva']], c['font-style'] || '')) +
      row('Color', swI('css:color', c.color, 'Color del texto', toCss(parseColor(cs.color) || { r: 255, g: 255, b: 255, a: 1 }))) +
      row('Contorno', nI('tstroke:w', ts.w || '', 0, { u: 'px', min: 0, step: .5 }) + swI('tstroke:color', ts.color, 'Color del contorno del texto'));
  }
  function fillSec(tg, o) {
    var f = (o.ui || {}).fill || defFill(), html = row('Tipo', sI('fill:type', [['auto', 'El suyo'], ['none', 'Sin relleno'], ['solid', 'Sólido'], ['linear', 'Degradado lineal'], ['radial', 'Degradado radial'], ['conic', 'Degradado cónico'], ['image', 'Imagen']], f.type));
    if (f.type === 'solid') html += row('Color', swI('fill:color', f.color, 'Color de relleno'));
    if (/linear|radial|conic/.test(f.type)) {
      if (f.type !== 'radial') html += row('Ángulo', slI('fill:angle', f.angle, 0, 360, 1) + nI('fill:angle', f.angle, 0, { u: '°' }));
      html += '<div class="ey-bar" style="background:' + A.esc(fillCss(f)) + '"></div>' + f.stops.map(function (s, i) {
        return '<div class="ey-stop">' + swI('stop:' + i, s.c, 'Color de la parada') + nI('stop:' + i, s.p, 0, { u: '%', min: 0, max: 100 }) + (f.stops.length > 2 ? '<button class="ey-mini" data-p="estilo" data-a="stopdel" data-i="' + i + '" title="Quitar parada">×</button>' : '') + '</div>';
      }).join('') + '<div class="tl-acts"><button data-p="estilo" data-a="stopadd">Añadir color</button></div>';
    }
    if (f.type === 'image') {
      html += row('Imagen', '<input class="st-in ey-grow" data-keep="1" data-p="estilo" data-k="fill:image" placeholder="assets/imagen.png" value="' + A.esc(f.image) + '"><button class="ey-mini" data-p="estilo" data-a="pickimg">Elegir</button>') +
        row('Encaje', sI('fill:size', [['cover', 'Cubrir'], ['contain', 'Contener'], ['100% 100%', 'Estirar']], f.size));
    }
    return html;
  }
  function strokeSec(tg, o) {
    var s = (o.ui || {}).stroke || defStroke();
    return row('Ancho', nI('stroke:w', s.w || '', 0, { u: 'px', min: 0 }) + sI('stroke:style', [['solid', 'Continuo'], ['dashed', 'Discontinuo'], ['dotted', 'Punteado'], ['double', 'Doble']], s.style) + swI('stroke:color', s.color, 'Color del trazo')) +
      row('Lados', '<span class="ey-seg">' + [['top', 'Arr.'], ['right', 'Der.'], ['bottom', 'Ab.'], ['left', 'Izq.']].map(function (k) { return '<button data-p="estilo" data-a="side" data-s="' + k[0] + '" class="' + (s.sides[k[0]] ? 'on' : '') + '">' + k[1] + '</button>'; }).join('') + '</span>');
  }
  function radiusSec(tg) {
    var r = radii(tg), names = ['Arr. izq.', 'Arr. der.', 'Ab. der.', 'Ab. izq.'];
    return '<div class="ey-sides">' + r.map(function (v, i) { return '<label>' + names[i] + nI('rad:' + i, v || '', 0, { min: 0 }) + '</label>'; }).join('') + '</div>' +
      '<div class="tl-row ey-r"><label>Todas</label>' + nI('rad:all', r[0] === r[1] && r[1] === r[2] && r[2] === r[3] && r[0] ? r[0] : '', 0, { u: 'px', min: 0 }) + '</div>';
  }
  function shadowSec(tg, o) {
    var s = (o.ui || {}).shadow || defShadow();
    return '<div class="tl-acts"><button data-p="estilo" data-a="shon" class="' + (s.on ? 'on' : '') + '">' + (s.on ? 'Sombra puesta' : 'Poner sombra') + '</button>' +
      '<button data-p="estilo" data-a="shtext" class="' + (s.text ? 'on' : '') + '" title="Sombra de las letras en lugar de la caja">De texto</button>' + swI('shadow:color', s.color, 'Color de la sombra') + '</div>' +
      '<div class="ey-sides">' + [['x', 'X'], ['y', 'Y'], ['blur', 'Difum.'], ['spread', 'Tamaño']].map(function (k) { return '<label>' + k[1] + nI('shadow:' + k[0], s[k[0]], 0) + '</label>'; }).join('') + '</div>';
  }
  function cropSec(tg, o) {
    var c = o.crop || {};
    return '<div class="ey-sides">' + [['top', 'Arriba'], ['right', 'Derecha'], ['bottom', 'Abajo'], ['left', 'Izquierda']].map(function (k) { return '<label>' + k[1] + nI('crop:' + k[0], c[k[0]] || '', 0, { min: 0, max: 95 }) + '</label>'; }).join('') + '</div>' +
      '<div class="tl-acts"><button data-p="estilo" data-a="crop" class="' + (E.cropOn === tg ? 'on' : '') + '">' + (E.cropOn === tg ? 'Terminar el recorte' : 'Recortar en la vista previa') + '</button>' + (o.crop ? '<button data-p="estilo" data-a="crop0">Quitar recorte</button>' : '') + '</div>' +
      '<div class="help">Arrastra las barras de los bordes; arrastrar por el centro reencuadra.</div>';
  }
  function posSec(tg) {
    var html = '';
    if (tg.indexOf('lib:') === 0 && window.MiLibres) {
      var it = MiLibres.get(tid(tg));
      if (!it || it.type === 'audio') return '';
      html = row('Posición', 'x ' + nI('pos:left', Math.round(it.left), 0) + ' y ' + nI('pos:top', Math.round(it.top), 0)) + row('Tamaño', 'an. ' + nI('pos:width', Math.round(it.width), 0, { min: 10 }) + ' al. ' + nI('pos:height', it.height == null ? '' : Math.round(it.height), 'auto', { min: 10 }));
    } else {
      var g = tg.indexOf('grp:') === 0 ? tid(tg) : groupOf(tid(tg)), p = capas(), v = g && p && p.snap().v[g], d = g && A.state().el.ov.querySelector('.cp-g[data-g="' + cssq(g) + '"]');
      if (!v) return '';
      html = d && d.classList.contains('box')
        ? row('Posición', 'x ' + nI('pos:left', Math.round(v.left), 0) + ' y ' + nI('pos:top', Math.round(v.top), 0)) + row('Ancho', nI('pos:width', Math.round(v.width), 0, { u: 'px', min: 120 }))
        : row('Posición', 'cx ' + nI('pos:cx', Math.round(v.cx), 0) + ' y ' + nI('pos:top', Math.round(v.top), 0)) + row('Escala', nI('pos:scale', v.scale, 1, { step: .01, min: .3, max: 3 }));
      if (tg.indexOf('el:') === 0) html += '<div class="help">Vale para todo su grupo.</div>';
    }
    return html;
  }
  function flexSec(tg, o) {
    var c = o.css || {};
    return row('Disposición', seg('display', [['flex', 'Flexible'], ['block', 'Normal']], c.display || '')) +
      row('Dirección', sI('raw:flex-direction', [['', 'Propia'], ['row', 'Fila'], ['column', 'Columna'], ['row-reverse', 'Fila invertida'], ['column-reverse', 'Columna invertida']], c['flex-direction'] || '')) +
      row('A lo largo', sI('raw:justify-content', [['', 'Propio'], ['flex-start', 'Inicio'], ['center', 'Centro'], ['flex-end', 'Final'], ['space-between', 'Entre'], ['space-around', 'Alrededor']], c['justify-content'] || '')) +
      row('A lo ancho', sI('raw:align-items', [['', 'Propio'], ['flex-start', 'Inicio'], ['center', 'Centro'], ['flex-end', 'Final'], ['stretch', 'Estirar']], c['align-items'] || '')) +
      row('Separación', nI('px:gap', num(c.gap), 0, { u: 'px', min: 0 }));
  }
  function panel(tg) {
    var o = E.targets[tg] || { css: {} }, c = o.css || {}, n = node(tg), S = A.section, vid = vidLike(tg), html = '';
    var libType = tg.indexOf('lib:') === 0 && window.MiLibres && (MiLibres.get(tid(tg)) || {}).type;
    if (libType === 'audio') return '';
    var hasText = n && !vid && n.inner.textContent.trim();
    var isBox = n && !vid && (n.root.children.length > 1 || getComputedStyle(n.root).display.indexOf('flex') >= 0);
    if (hasText) html += S('ey-texto', 'Texto', textSec(tg, o, n));
    if (!vid) html += S('ey-relleno', 'Fondo', fillSec(tg, o), false) + S('ey-trazo', 'Borde', strokeSec(tg, o), false);
    html += S('ey-radio', 'Esquinas', radiusSec(tg), false);
    if (!vid) html += S('ey-sombra', 'Sombra', shadowSec(tg, o), false);
    var op = c.opacity == null ? 100 : Math.round(c.opacity * 100), bl = num(/blur\(([\d.]+)px\)/.exec(c.filter || '') ? /blur\(([\d.]+)px\)/.exec(c.filter)[1] : 0, 0), rot = num(c.rotate, 0);
    html += S('ey-apar', 'Apariencia',
      row('Opacidad', slI('op', op, 0, 100, 1) + '<span class="v ey-v-op">' + op + ' %</span>') +
      (vid ? '' : row('Desenfoque', slI('blur', bl, 0, 60, .5) + '<span class="v ey-v-blur">' + bl + ' px</span>')) +
      row('Mezcla', sI('raw:mix-blend-mode', BLEND.map(function (b) { return [b === 'normal' ? '' : b, BLENDES[b]]; }), c['mix-blend-mode'] || '')) +
      row('Rotación', slI('rot', rot, -180, 180, 1) + nI('rot', rot || '', 0, { u: '°' })), !vid);
    html += S('ey-recorte', 'Recorte', cropSec(tg, o), false);
    var pos = vid ? '' : posSec(tg);
    if (pos) html += S('ey-pos', 'Posición y tamaño', pos);
    if (!vid) html += S('ey-orden', 'Orden', '<div class="tl-acts"><button data-p="estilo" data-a="ord" data-d="front">Traer al frente</button><button data-p="estilo" data-a="ord" data-d="fwd">Un paso adelante</button><button data-p="estilo" data-a="ord" data-d="bwd">Un paso atrás</button><button data-p="estilo" data-a="ord" data-d="back">Enviar atrás</button></div>', false);
    if (isBox || c.display) html += S('ey-flex', 'Distribución', flexSec(tg, o), false);
    html += '<div class="tl-acts"><button data-p="estilo" data-a="reset" title="Quita todo lo cambiado en este panel">Restablecer estilo</button></div>';
    return html;
  }

  function pickImage(btn) {
    A.api('/api/assets?scope=project').then(function (r) {
      var list = (r.assets || r || []).filter(function (x) { return x.type === 'image'; });
      var d = A.popup('<h4>Imágenes del proyecto</h4><div class="st-pop-row" style="max-width:280px;max-height:260px;overflow:auto">' +
        (list.length ? list.map(function (x) { return '<button data-img="assets/' + A.esc(x.path) + '" title="' + A.esc(x.path) + '">' + A.esc(x.name) + '</button>'; }).join('') : 'No hay imágenes en assets/.') + '</div>', btn);
      d.addEventListener('click', function (e) {
        var b = e.target.closest('[data-img]');
        if (!b) return;
        var tg = target();
        A.remember();
        ui(tg, 'fill', defFill()).image = b.dataset.img;
        applyFill(tg); done(); A.closePopup(); A.refresh();
      });
    }).catch(function (e) { A.toast(e.message, true); });
  }

  Timeline.use({
    id: 'estilo',
    init: function (api, input, saved) {
      A = api;
      saved = saved || {};
      var T = A.state();
      E = { targets: saved.targets || {}, fonts: saved.fonts || {}, proj: {}, gLoaded: {}, recent: [], lastMem: 0, cropOn: null, els: [], style: document.createElement('style') };
      var st = document.createElement('style'); st.textContent = CSS_; document.head.appendChild(st);
      document.head.appendChild(E.style);
      var dl = document.createElement('datalist'); dl.id = 'ey-fonts'; T.el.root.appendChild(dl);
      Object.keys(E.fonts).forEach(function (f) { if (E.fonts[f].source === 'google') loadGoogle(f); });
      loadFonts();
      E.cropEl = document.createElement('div');
      E.cropEl.className = 'ey-crop'; E.cropEl.hidden = true;
      E.cropEl.innerHTML = '<b data-s="top"></b><b data-s="right"></b><b data-s="bottom"></b><b data-s="left"></b>';
      E.cropEl.addEventListener('pointerdown', cropDrag);
      T.el.ov.appendChild(E.cropEl);
      // los campos con data-keep no se repintan: al tocar fuera se sueltan antes, o el panel se quedaría con la selección anterior
      T.el.root.addEventListener('pointerdown', function (e) {
        var ae = document.activeElement;
        if (ae && ae.dataset && ae.dataset.keep && ae !== e.target && !e.target.closest('.st-pop')) ae.blur();
      }, true);
      T.el.root.addEventListener('keydown', function (e) {           // Intro o Esc en un campo: se sale, para que las teclas vuelvan a la vista
        var el = e.target;
        if (el.tagName === 'INPUT' && el.dataset.keep && (e.key === 'Enter' || e.key === 'Escape')) el.blur();
      });
      window.MiEstilo = {
        setZ: function (tg, z) { ensure(orderTarget(tg)).z = z; done(); },
        getZ: function (tg) { var o = E.targets[orderTarget(tg)]; return o && o.z != null ? o.z : null; },
        layers: layers, setOrder: setOrder,
        get: function (tg) { return E.targets[tg] ? copy(E.targets[tg]) : null; },
        set: function (tg, o) { if (o) E.targets[tg] = copy(o); else delete E.targets[tg]; done(); },
        defaults: function (tg, css) { E.targets[tg] = { css: Object.assign({}, css) }; Object.keys(css).forEach(function (k) { if (k === 'font-family') useFont(css[k]); }); done(); },
        drop: function (tg) { if (E.targets[tg]) { delete E.targets[tg]; done(); } }
      };
      build();
      return true;
    },
    designExtra: function () { var tg = target(); return tg ? panel(tg) : ''; },
    paint: function (t) { markEls(t); if (E.cropOn) cropBox(); },
    onClick: function (b) {
      var tg = target(), a = b.dataset.a;
      if (!tg) return;
      if (a === 'color') { openColor(b); return; }
      if (a === 'pickimg') { pickImage(b); return; }
      if (a === 'ord') { move(tg, b.dataset.d); return; }
      if (a === 'crop') { E.cropOn = E.cropOn === tg ? null : tg; A.stop(); cropBox(); if (!E.cropOn) E.cropEl.hidden = true; A.refresh(); return; }
      A.remember();
      if (a === 'set') {
        var k = b.dataset.css, v = b.dataset.v, cur = (ensure(tg).css || {})[k];
        setCss(tg, k, cur === v ? null : v);
        if (k === 'display' && !((E.targets[tg].css || {}).display)) ['flex-direction', 'justify-content', 'align-items', 'gap'].forEach(function (x) { setCss(tg, x, null); });
      } else if (a === 'stopadd') {
        var f = ui(tg, 'fill', defFill()); f.stops.push({ c: '#ffffff', p: 50 }); applyFill(tg);
      } else if (a === 'stopdel') {
        ui(tg, 'fill', defFill()).stops.splice(+b.dataset.i, 1); applyFill(tg);
      } else if (a === 'side') {
        var s = ui(tg, 'stroke', defStroke()); s.sides[b.dataset.s] = !s.sides[b.dataset.s]; applyStroke(tg);
      } else if (a === 'shon') {
        var sh = ui(tg, 'shadow', defShadow()); sh.on = !sh.on; applyShadow(tg);
      } else if (a === 'shtext') {
        var st = ui(tg, 'shadow', defShadow()); st.text = !st.text; applyShadow(tg);
      } else if (a === 'crop0') {
        delete ensure(tg).crop;
      } else if (a === 'reset') {
        delete E.targets[tg];
        if (E.cropOn === tg) { E.cropOn = null; E.cropEl.hidden = true; }
      }
      done(); A.refresh();
    },
    onInput: function (el) {
      var tg = target(), raw = el.dataset.k, v = el.value;
      if (!tg || !raw) return;
      var p = raw.split(':'), k = p[0], f = p[1], rep = false;
      mem();
      if (k === 'px') setCss(tg, f, v === '' ? null : v + 'px');
      else if (k === 'raw') setCss(tg, f, v === '' ? null : v);
      else if (k === 'font') { setCss(tg, 'font-family', v.trim() || null); }
      else if (k === 'op') {
        setCss(tg, 'opacity', +v >= 100 ? null : +v / 100);
        var ov = A.state().el.insp.querySelector('.ey-v-op'); if (ov) ov.textContent = v + ' %';
      } else if (k === 'blur') {
        setCss(tg, 'filter', +v > 0 ? 'blur(' + v + 'px)' : null);
        var bv = A.state().el.insp.querySelector('.ey-v-blur'); if (bv) bv.textContent = v + ' px';
      } else if (k === 'rot') {
        setCss(tg, 'rotate', +v ? v + 'deg' : null);
        A.state().el.insp.querySelectorAll('[data-k="rot"]').forEach(function (x) { if (x !== el) x.value = +v || (x.type === 'range' ? 0 : ''); });
      } else if (k === 'rad') {
        var r = radii(tg);
        if (f === 'all') { r = [+v || 0, +v || 0, +v || 0, +v || 0]; A.state().el.insp.querySelectorAll('[data-k^="rad:"]').forEach(function (x) { if (x !== el) x.value = x.dataset.k === 'rad:all' ? '' : (+v || ''); }); }
        else r[+f] = +v || 0;
        setCss(tg, 'border-radius', r.some(Boolean) ? r.map(function (x) { return x + 'px'; }).join(' ') : null);
      } else if (k === 'fill') {
        var fi = ui(tg, 'fill', defFill());
        fi[f] = f === 'angle' ? (+v || 0) : v;
        applyFill(tg);
        if (f === 'type') rep = true;
        else {
          if (f === 'angle') A.state().el.insp.querySelectorAll('[data-k="fill:angle"]').forEach(function (x) { if (x !== el) x.value = v; });
          var bar = A.state().el.insp.querySelector('.ey-bar'); if (bar) bar.style.background = fillCss(fi) || 'none';
        }
      } else if (k === 'stop') {
        var fs = ui(tg, 'fill', defFill());
        fs.stops[+f].p = A.clamp(+v || 0, 0, 100);
        applyFill(tg);
        var br = A.state().el.insp.querySelector('.ey-bar'); if (br) br.style.background = fillCss(fs);
      } else if (k === 'stroke') {
        var s = ui(tg, 'stroke', defStroke());
        s[f] = f === 'w' ? (+v || 0) : v;
        applyStroke(tg);
      } else if (k === 'tstroke') {
        ui(tg, 'tstroke', { w: 0, color: '#000000' }).w = +v || 0; applyTStroke(tg);
      } else if (k === 'shadow') {
        var sd = ui(tg, 'shadow', defShadow());
        sd[f] = +v || 0; sd.on = true;
        applyShadow(tg);
      } else if (k === 'crop') {
        var o = ensure(tg);
        o.crop = o.crop || { top: 0, right: 0, bottom: 0, left: 0 };
        o.crop[f] = A.clamp(+v || 0, 0, 95);
        cropBox();
      } else if (k === 'pos') {
        var n = +v;
        if (v === '' && f !== 'height') return;
        if (tg.indexOf('lib:') === 0) { var up = {}; up[f] = v === '' ? null : n; MiLibres.update(tid(tg), up); }
        else {
          var g = tg.indexOf('grp:') === 0 ? tid(tg) : groupOf(tid(tg)), cp = capas(), sn = cp.snap();
          sn.v[g][f] = f === 'scale' ? A.clamp(n, .3, 3) : n;
          cp.restore(sn);
          A.touched('capas');
        }
        A.refresh();
        return;
      }
      done();
      if (rep) A.refresh();
    },
    onChange: function (el) {
      if (el.dataset.k !== 'font') return;
      var name = el.value.trim();
      useFont(name);
      A.touched('estilo');
    },
    snap: function () { return { t: E.targets, f: E.fonts }; },
    restore: function (s) { E.targets = copy(s.t); E.fonts = copy(s.f); E.cropOn = null; if (E.cropEl) E.cropEl.hidden = true; build(); },
    data: function () {
      var out = { targets: {} }, used = {};
      Object.keys(E.targets).forEach(function (tg) {
        var o = copy(E.targets[tg]);
        if (o.css && !Object.keys(o.css).length) delete o.css;
        if (o.crop && !(o.crop.top || o.crop.right || o.crop.bottom || o.crop.left)) delete o.crop;
        if (o.ui && !Object.keys(o.ui).length) delete o.ui;
        if (o.css && o.css['font-family']) used[o.css['font-family']] = 1;
        if (o.css || o.crop || o.z != null) out.targets[tg] = o;
      });
      var fonts = {};
      Object.keys(used).forEach(function (f) { if (E.fonts[f]) fonts[f] = E.fonts[f]; });
      if (Object.keys(fonts).length) out.fonts = fonts;
      return out;
    }
  });
})();
