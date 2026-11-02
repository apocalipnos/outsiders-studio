// Módulo "Claude" de la Edición: en Diseño, un campo para describir un cambio con el objetivo elegido y el segundo actual.
// Lo que se escribe se guarda (claude_edit.json: {"peticiones": [{text, t, target, at}]}) y lo lee Claude al pulsar Procesar vídeo;
// "Copiar texto" lo deja en el portapapeles para pegarlo en la conversación.
(function () {
  var A, C = { list: [], draft: '', fsel: '', lastMem: 0 };
  var CSS = '.cl-ta{width:100%;min-height:58px;resize:vertical;padding:6px 8px;font:inherit;font-size:11.5px;line-height:1.45;color:var(--t1);background:var(--card2);border:1px solid var(--b1);border-radius:6px;user-select:text;display:block}.cl-ta:focus{outline:0;border-color:var(--a)}' +
    '.cl-to{font-size:10.5px;color:var(--t3);margin-bottom:5px;line-height:1.4}.cl-to b{color:var(--t2);font-weight:500}' +
    '.cl-p{display:flex;gap:5px;align-items:flex-start;padding:5px 6px;margin-top:4px;background:var(--card2);border:1px solid var(--b0);border-radius:6px;font-size:10.5px;line-height:1.4;color:var(--t2)}.cl-p span{flex:1;min-width:0;word-break:break-word}.cl-p small{display:block;color:var(--t3);font-size:9.5px}.cl-p button{padding:0 5px;font-size:10.5px;flex:none}';

  function fmtSec(t) { return t.toFixed(2).replace('.', ',') + ' s (' + A.fmtS(t) + ')'; }
  function target() {                        // a qué se refiere: lo elegido en la línea de tiempo o la vista previa
    var T = A.state(), s = T.sel;
    if (s) {
      if (s.type === 'seg') {
        var g = T.segs.filter(function (x) { return x._id === s.id; })[0];
        if (g) return { id: 'seg:' + g.id, label: 'fragmento "' + (g.line || g.id) + '"' };
      } else if (s.type === 'fx' && T.fx[s.id]) {
        var f = T.fx[s.id];
        return f.kind === 'el' ? { id: (f.libre ? 'lib:' : 'el:') + f.id, label: 'capa "' + (f.label || f.id) + '"' } : { id: 'fx:' + f.key, label: 'efecto "' + (T.names[f.key] || f.key) + '"' };
      } else if (s.type === 'grp') {
        var tag = T.el.ov.querySelector('.cp-g[data-g="' + s.id + '"] .cp-tag');
        return { id: 'grp:' + s.id, label: 'grupo de capas "' + (tag ? tag.textContent : s.id) + '"' };
      } else if (s.type === 'aud') {
        return { id: s.id, label: s.id === 'voice' ? 'la voz' : 'la pista de audio "' + s.id + '"' };
      } else if (s.type === 'word') {
        return { id: 'word:' + s.id, label: 'palabra ' + (s.id + 1) + ' de los subtítulos' };
      } else if (s.type === 'subs') {
        return { id: 'subs', label: 'los subtítulos' };
      }
      return { id: s.type + ':' + s.id, label: s.type + ' ' + s.id };
    }
    return { id: 'video', label: 'el vídeo entero' };
  }
  function prompt(text, t, tg) {
    return 'Vídeo "' + A.state().project.name + '" en Mi Estudio. Segundo ' + fmtSec(t) + '. Objetivo: ' + tg.label + ' (' + tg.id + ').\n\nCambio que quiero: ' + text +
      '\n\nHazlo en los JSON del proyecto (edicion/ o el plan), nunca a mano en index.html, y dime qué has cambiado.';
  }
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
  function at() { return new Date().toISOString(); }
  function refreshAfterFocus() {             // repinta al soltar si la selección cambió con el campo enfocado (data-keep lo impedía)
    var go = function () {
      removeEventListener('pointerup', go, true);
      setTimeout(function () { if (JSON.stringify(A.state().sel) !== C.fsel) A.refresh(); }, 60);
    };
    addEventListener('pointerup', go, true);
  }

  Timeline.use({
    id: 'claude',
    last: true,
    init: function (api, input, saved) {
      A = api;
      var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
      if (saved && Array.isArray(saved.peticiones)) C.list = saved.peticiones;
      var insp = A.state().el.insp;
      insp.addEventListener('focusin', function (e) { if (e.target.classList && e.target.classList.contains('cl-ta')) C.fsel = JSON.stringify(A.state().sel); });
      insp.addEventListener('focusout', function (e) { if (e.target.classList && e.target.classList.contains('cl-ta')) refreshAfterFocus(); });
      return true;
    },
    designExtra: function () {
      var T = A.state(), tg = target();
      return A.section('claude-pedir', 'Pedirle a Claude',
        '<div class="cl-to">Sobre <b>' + A.esc(tg.label) + '</b> · segundo <b class="cl-at">' + fmtSec(T.t) + '</b></div>' +
        '<textarea class="cl-ta" data-p="claude" data-k="text" data-keep="1" placeholder="Describe un cambio para Claude">' + A.esc(C.draft) + '</textarea>' +
        '<div class="tl-acts"><button data-p="claude" data-k="copy">Copiar texto</button><button data-p="claude" data-k="add" title="La guarda con este objetivo y este segundo y deja el campo libre">Guardar para procesar</button></div>' +
        C.list.map(function (p, i) {
          return '<div class="cl-p"><span>' + A.esc(p.text) + '<small>' + A.esc(p.target) + ' · ' + A.fmtS(p.t || 0) + '</small></span><button data-p="claude" data-k="go" data-i="' + i + '" title="Ir a ese momento">Ir</button><button data-p="claude" data-k="del" data-i="' + i + '" title="Quitar">×</button></div>';
        }).join('') + '<div class="help" style="margin-top:6px">Claude lee lo que dejes aquí al pulsar Procesar vídeo.</div>');
    },
    paint: function (t) {                    // el segundo sigue al cursor sin repintar el panel
      var T = A.state();
      if (T.rtab !== 'design') return;
      var el = T.el.insp.querySelector('.cl-at');
      if (el) { var v = fmtSec(t); if (el.textContent !== v) el.textContent = v; }
    },
    onClick: function (b) {
      var k = b.dataset.k, T = A.state(), text = C.draft.trim();
      if (k === 'copy') {
        if (!text) return A.toast('Escribe primero el cambio', true);
        copy(prompt(text, T.t, target()), 'Texto copiado');
      } else if (k === 'add') {
        if (!text) return A.toast('Escribe primero el cambio', true);
        A.remember();
        C.list.push({ text: text, t: Math.round(T.t * 1000) / 1000, target: target().id, at: at() });
        C.draft = '';
        A.touched('claude');
        A.refresh();
      } else if (k === 'del') {
        A.remember();
        C.list.splice(+b.dataset.i, 1);
        A.touched('claude');
        A.refresh();
      } else if (k === 'go') {
        A.stop();
        A.seek(C.list[+b.dataset.i].t || 0);
      }
    },
    onInput: function (el) {
      if (el.dataset.k !== 'text') return;
      if (Date.now() - C.lastMem > 1000) A.remember();
      C.lastMem = Date.now();
      C.draft = el.value;
      A.touched('claude');
    },
    snap: function () { return { l: JSON.parse(JSON.stringify(C.list)), d: C.draft }; },
    restore: function (o) { C.list = o.l || []; C.draft = o.d || ''; },
    data: function () {
      var out = C.list.slice(), text = C.draft.trim();   // lo escrito sin pulsar Guardar también le llega, con lo que enseña el panel
      if (text) out.push({ text: text, t: Math.round(A.state().t * 1000) / 1000, target: target().id, at: at() });
      return { peticiones: out };
    }
  });
})();
