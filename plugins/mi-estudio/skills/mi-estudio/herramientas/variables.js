// Módulo "Variables" de la Edición: valores con nombre que los scripts del plan leen con edicion.variable(proj, nombre, por_defecto).
// variables_edit.json: {"vars": {"nombre": {"type": "text"|"number"|"color"|"image", "value": <por defecto>, "preview": <vista previa>}}}
(function () {
  var A, V = { vars: {}, el: null, imgs: [], lastMem: 0, newType: 'text' };
  var TYPES = [['text', 'Texto'], ['number', 'Número'], ['color', 'Color'], ['image', 'Imagen']];
  var CSS = '.vr-add{display:flex;gap:4px;margin:0 0 10px}.vr-add input{flex:1;min-width:0}.vr-add button{padding:3px 8px;font-size:11px;flex:none}' +
    '.vr-c{padding:8px;margin-bottom:6px;background:var(--card2);border:1px solid var(--b0);border-radius:7px}.vr-h{display:flex;gap:4px;align-items:center;margin-bottom:4px}.vr-h .vr-nm{flex:1;min-width:0;font-weight:600}.vr-h button{padding:2px 7px;font-size:11px;flex:none}' +
    '.vr-f{display:flex;align-items:center;gap:5px;margin-top:5px}.vr-f label{width:66px;flex:none;color:var(--t3);font-size:10.5px}.vr-f .st-in{flex:1;min-width:0}.vr-f input[type=color]{width:26px;height:24px;padding:1px;background:var(--card2);border:1px solid var(--b1);border-radius:5px;flex:none}.vr-f img{width:24px;height:24px;object-fit:cover;border-radius:4px;background:#000;flex:none}' +
    '.vr-use{display:block;margin-top:6px;font:10px Consolas,Menlo,monospace;color:var(--t3);word-break:break-all;user-select:text}.vr-e{color:var(--t3);font-size:11px;padding:14px 4px;text-align:center}.vr-help{margin-bottom:10px}';

  function cast(type, v) {
    if (type === 'number') { var n = parseFloat(v); return isNaN(n) ? null : n; }
    return v == null ? '' : String(v);
  }
  function blank(type) { return type === 'number' ? 0 : type === 'color' ? '#ffffff' : ''; }
  function field(name, key, label, v, type) {
    var at = ' data-p="variables" data-k="val" data-n="' + A.esc(name) + '" data-f="' + key + '"', val = v == null ? '' : v, s;
    if (type === 'number') s = '<input class="st-in" type="number" step="any"' + at + ' value="' + A.esc(val) + '">';
    else if (type === 'color') s = '<input type="color"' + at + ' value="' + (/^#[0-9a-f]{6}$/i.test(val) ? val : '#ffffff') + '"><input class="st-in"' + at + ' value="' + A.esc(val) + '" placeholder="#ffffff">';
    else if (type === 'image') s = (val ? '<img src="' + A.esc(A.url(String(val))) + '" alt="">' : '') + '<input class="st-in" list="vr-imgs"' + at + ' value="' + A.esc(val) + '" placeholder="assets/…">';
    else s = '<input class="st-in"' + at + ' value="' + A.esc(val) + '">';
    return '<div class="vr-f"><label>' + label + '</label>' + s + '</div>';
  }
  function card(n) {
    var x = V.vars[n];
    return '<div class="vr-c"><div class="vr-h"><input class="st-in vr-nm" data-p="variables" data-k="rename" data-n="' + A.esc(n) + '" value="' + A.esc(n) + '" title="Nombre">' +
      '<select data-p="variables" data-k="type" data-n="' + A.esc(n) + '">' + TYPES.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === x.type ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select>' +
      '<button data-p="variables" data-k="del" data-n="' + A.esc(n) + '" title="Borrar dato">Borrar</button></div>' +
      field(n, 'value', 'Por defecto', x.value, x.type) + field(n, 'preview', 'Vista previa', x.preview, x.type) +
      '<code class="vr-use">edicion.variable(proj, ' + A.esc(JSON.stringify(n)) + ', …)</code></div>';
  }
  function paint() {
    var el = V.el, names = Object.keys(V.vars);
    if (!el || A.state().rtab !== 'variables') return;
    el.innerHTML = '<div class="help vr-help">Valores que se repiten en el vídeo, como un nombre de marca o un color. Claude los usa al pulsar Procesar vídeo. La vista previa es un valor de prueba: no llega al vídeo final.</div>' +
      '<div class="vr-add"><input class="st-in vr-new" placeholder="Nombre del dato"><select class="vr-newt" data-p="variables" data-k="newt">' + TYPES.map(function (t) { return '<option value="' + t[0] + '"' + (t[0] === V.newType ? ' selected' : '') + '>' + t[1] + '</option>'; }).join('') + '</select><button data-p="variables" data-k="add">Añadir</button></div>' +
      '<datalist id="vr-imgs">' + V.imgs.map(function (p) { return '<option value="' + A.esc(p) + '">'; }).join('') + '</datalist>' +
      (names.length ? names.map(card).join('') : '<div class="vr-e">Aún no hay variables.</div>');
    var inp = el.querySelector('.vr-new');
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') add(inp.value); });
  }
  function valid(n) { return /^[A-Za-z_][\w-]{0,60}$/.test(n); }
  function add(name) {
    name = String(name || '').trim();
    if (!valid(name)) return A.toast('Nombre no válido: empieza por una letra y usa letras, números, - o _', true);
    if (V.vars[name]) return A.toast('Ya hay un dato que se llama ' + name, true);
    A.remember();
    V.vars[name] = { type: V.newType, value: blank(V.newType), preview: null };
    done();
  }
  function done() { A.touched('variables'); paint(); A.state().el.rtabs.querySelector('[data-rtab="variables"]').textContent = 'Datos (' + Object.keys(V.vars).length + ')'; }

  Timeline.use({
    id: 'variables',
    right: { id: 'variables', label: 'Datos', count: function () { return Object.keys(V.vars).length; } },
    init: function (api, input, saved) {
      A = api;
      var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
      if (saved && saved.vars) V.vars = saved.vars;
      A.api('/api/assets?scope=project').then(function (l) {
        V.imgs = l.filter(function (a) { return a.type === 'image'; }).map(function (a) { return 'assets/' + a.path; });
      }).catch(function () {});
      return true;
    },
    rightRender: function (el) {
      V.el = el;
      var ae = document.activeElement;       // el núcleo repinta el panel a menudo: no quites el campo que se está usando
      if (el.querySelector('.vr-add') && el.contains(ae) && /INPUT|SELECT/.test(ae.tagName) && ae.type !== 'color') return;
      paint();
    },
    onClick: function (b) {
      if (b.dataset.k === 'add') add(V.el.querySelector('.vr-new').value);
      else if (b.dataset.k === 'del') { A.remember(); delete V.vars[b.dataset.n]; done(); }
    },
    onInput: function (el) {
      if (el.dataset.k !== 'val') return;
      var x = V.vars[el.dataset.n], f = el.dataset.f;
      if (!x) return;
      if (Date.now() - V.lastMem > 800) A.remember();
      V.lastMem = Date.now();
      x[f] = f === 'preview' && el.value === '' ? null : cast(x.type, el.value);
      if (x.type === 'color') {              // el muestrario y el campo de texto van a la vez
        var box = el.parentNode, other = box.querySelector(el.type === 'color' ? '.st-in' : 'input[type=color]');
        if (other && (el.type === 'color' || /^#[0-9a-f]{6}$/i.test(el.value))) other.value = el.value;
      }
      A.touched('variables');
    },
    onChange: function (el) {
      var k = el.dataset.k, n = el.dataset.n, x = V.vars[n];
      if (k === 'newt') { V.newType = el.value; return; }
      if (k === 'val' && x && x.type === 'image') { paint(); return; }   // la miniatura de la imagen elegida
      if (k === 'type' && x) {
        A.remember();
        x.type = el.value;
        x.value = x.type === 'number' ? (cast('number', x.value) || 0) : x.type === 'color' ? (/^#[0-9a-f]{6}$/i.test(x.value) ? x.value : '#ffffff') : cast('text', x.value);
        x.preview = null;
        done();
      } else if (k === 'rename' && x) {
        var to = el.value.trim();
        if (to === n) return;
        if (!valid(to) || V.vars[to]) { A.toast(V.vars[to] ? 'Ya hay un dato que se llama ' + to : 'Nombre no válido', true); el.value = n; return; }
        A.remember();
        var out = {};                        // mismo orden, nuevo nombre
        Object.keys(V.vars).forEach(function (m) { out[m === n ? to : m] = V.vars[m]; });
        V.vars = out;
        done();
      }
    },
    snap: function () { return { v: JSON.parse(JSON.stringify(V.vars)) }; },
    restore: function (o) { V.vars = o.v || {}; },
    data: function () {
      var out = {};
      Object.keys(V.vars).forEach(function (n) {
        var x = V.vars[n], c = { type: x.type, value: x.value };
        if (x.preview != null && x.preview !== '') c.preview = x.preview;
        out[n] = c;
      });
      return { vars: out };
    }
  });
})();
