// Módulo "Bloques": un apartado más del Catálogo con los bloques y componentes de HyperFrames (hyperframes catalog --json).
// Cada uno: {name, type: block|component, title, description, tags, dimensions, duration}. Añadir instala un bloque en compositions/ y
// lo coloca en el cursor como capa libre; un componente solo se instala, porque es un trozo de HTML para pegar.
(function () {
  var A, B = { items: null, err: null, q: '', f: 'all', el: null, busy: {} };
  var CATS = [['all', 'Todos'], ['captions', 'Subtítulos'], ['code-animation', 'Animaciones de código'], ['vfx', 'VFX'], ['transitions', 'Transiciones'], ['effects', 'Efectos'], ['text-effects', 'Efectos de texto'], ['social', 'Social'], ['data', 'Datos'], ['scenes', 'Escenas']];
  var CSS = '.bq-q{width:100%;margin-bottom:6px}.bq-c{padding:7px 8px;margin-bottom:5px;background:var(--card2);border:1px solid var(--b0);border-radius:7px}.bq-c:hover{border-color:var(--b2)}' +
    '.bq-h{display:flex;align-items:center;gap:6px}.bq-h b{flex:1;min-width:0;font-size:11px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bq-h button{padding:2px 8px;font-size:11px;flex:none}' +
    '.bq-m{font-size:10px;color:var(--t3);margin-top:1px}.bq-d{font-size:10.5px;color:var(--t2);line-height:1.35;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
    '.bq-t{display:flex;flex-wrap:wrap;gap:3px;margin-top:4px}.bq-t i{font-style:normal;font-size:9.5px;color:var(--t3);background:var(--b0);border-radius:3px;padding:0 4px}.bq-e{color:var(--t3);font-size:11px;padding:18px 6px;text-align:center}.bq-more{width:100%;margin-top:4px}';
  var PAGE = 60;

  function cat(tags) {                       // la misma clasificación que el catálogo de HyperFrames Studio
    var t = {};
    (tags || []).forEach(function (x) { t[x] = 1; });
    return t.captions || t['caption-style'] ? 'captions' : t['code-animation'] ? 'code-animation' : t.transition ? 'transitions'
      : t.social || t.overlay ? 'social' : t.data || t.chart || t.map ? 'data' : t['html-in-canvas'] || t.webgl || t.shader ? 'vfx'
      : t['text-effect'] ? 'text-effects' : t.effect || t.grain || t.vignette ? 'effects' : 'scenes';
  }
  function label(c) { return CATS.filter(function (x) { return x[0] === c; })[0][1]; }
  function matches(it) {
    var q = B.q.trim().toLowerCase();
    return !q || (it.name + ' ' + (it.title || '') + ' ' + label(it._c) + ' ' + (it.tags || []).join(' ')).toLowerCase().indexOf(q) >= 0;
  }
  function load() {
    B.loading = true;
    A.api('/api/blocks').then(function (d) {
      B.loading = false;
      var list = Array.isArray(d) ? d : d.items || [];
      if (!list.length && d.error) B.err = 'El catálogo de HyperFrames no se pudo leer.';
      else if (!list.length) B.err = 'El catálogo está vacío.';
      list.forEach(function (it) { it._c = cat(it.tags); });
      B.items = list;
      paint();
    }).catch(function (e) { B.loading = false; B.err = e.message; B.items = []; paint(); });
  }
  function card(it) {
    var m = (it.type === 'component' ? 'Pieza' : 'Plantilla') + ' · ' + label(it._c) + (it.duration ? ' · ' + (Math.round(it.duration * 10) / 10) + ' s' : '') +
      (it.dimensions ? ' · ' + it.dimensions.width + '×' + it.dimensions.height : '');
    return '<div class="bq-c"><div class="bq-h"><b title="' + A.esc(it.name) + '">' + A.esc(it.title || it.name) + '</b><button data-p="bloques" data-k="add" data-name="' + A.esc(it.name) + '"' + (B.busy[it.name] ? ' disabled' : '') + '>' + (B.busy[it.name] ? 'Un momento…' : it.type === 'component' ? 'Instalar' : 'Añadir') + '</button></div>' +
      '<div class="bq-m">' + A.esc(m) + '</div>' + (it.description ? '<div class="bq-d" title="' + A.esc(it.description) + '">' + A.esc(it.description) + '</div>' : '') +
      '<div class="bq-t">' + (it.tags || []).slice(0, 5).map(function (t) { return '<i>' + A.esc(t) + '</i>'; }).join('') + '</div></div>';
  }
  function paint() {                         // solo lo de debajo del buscador, para que no pierda el foco
    var el = B.el;
    if (!el || !el.isConnected) return;
    var box = el.querySelector('.bq-list'), chips = el.querySelector('.bq-chips');
    if (!box) return;
    if (!B.items) { box.innerHTML = '<div class="bq-e">Cargando el catálogo…</div>'; return; }
    var src = B.items.filter(matches);
    chips.innerHTML = CATS.map(function (c) {
      var n = c[0] === 'all' ? src.length : src.filter(function (x) { return x._c === c[0]; }).length;
      return '<button class="' + (B.f === c[0] ? 'act' : '') + '" data-p="bloques" data-k="f" data-f="' + c[0] + '">' + c[1] + ' ' + n + '</button>';
    }).join('');
    var list = src.filter(function (x) { return B.f === 'all' || x._c === B.f; }), max = B.max || PAGE;
    box.innerHTML = B.err && !B.items.length ? '<div class="bq-e">' + A.esc(B.err) + '</div>'
      : list.length ? list.slice(0, max).map(card).join('') + (list.length > max ? '<button class="bq-more" data-p="bloques" data-k="more">Ver más (' + (list.length - max) + ')</button>' : '')
      : '<div class="bq-e">Nada coincide con la búsqueda.</div>';
  }
  function render(el) {
    B.el = el;
    el.innerHTML = '<input class="st-in bq-q" data-p="bloques" data-k="q" placeholder="Buscar por nombre, categoría o etiqueta…" value="' + A.esc(B.q) + '"><div class="chips bq-chips"></div><div class="bq-list"></div>';
    if (!B.items && !B.loading) load();
    paint();
  }
  function srcOf(out, it) {                  // la ruta del HTML instalado: lo dice la salida de "hyperframes add"
    try {
      var w = (JSON.parse(out).written || []).filter(function (p) { return /\.html$/i.test(p); })[0];
      var m = w && /compositions[\\/].*$/.exec(w);
      if (m) return m[0].replace(/\\/g, '/');
    } catch (e) {}
    return 'compositions/' + (it.type === 'component' ? 'components/' : '') + it.name + '.html';
  }
  function add(name) {
    var it = B.items.filter(function (x) { return x.name === name; })[0];
    if (!it || B.busy[name]) return;
    B.busy[name] = 1; paint();
    A.api('/api/blocks/add', { name: name }).then(function (r) {
      // un componente es un trozo para pegar en una composición, no se puede referenciar como capa: el render fallaría
      if (it.type === 'component') return A.toast('Instalado en ' + srcOf(r.output, it) + '. Es un trozo de HTML para pegar: pídeselo a Claude.');
      if (!window.MiLibres || typeof window.MiLibres.add !== 'function') return A.toast('Instalado, pero no se puede colocar: falta el módulo de capas añadidas', true);
      window.MiLibres.add('block', { src: srcOf(r.output, it), label: it.title || name, name: name, dur: it.duration });
      A.toast('Añadido en el cursor: ' + (it.title || name));
    }).catch(function (e) { A.toast(e.message, true); }).then(function () { delete B.busy[name]; paint(); });
  }

  Timeline.use({
    id: 'bloques',
    init: function (api) {
      A = api;
      var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
      if (Timeline.addCatalog) Timeline.addCatalog({ id: 'bloques', label: 'Plantillas', render: render });
      if (A.state().ltab) A.refreshLeft();         // por si la página ya pintó la barra lateral
      return true;
    },
    onClick: function (b) {
      var k = b.dataset.k;
      if (k === 'f') { B.f = b.dataset.f; B.max = 0; paint(); }
      else if (k === 'more') { B.max = (B.max || PAGE) + PAGE; paint(); }
      else if (k === 'add') add(b.dataset.name);
    },
    onInput: function (el) { if (el.dataset.k === 'q') { B.q = el.value; B.max = 0; paint(); } }
  });
})();
