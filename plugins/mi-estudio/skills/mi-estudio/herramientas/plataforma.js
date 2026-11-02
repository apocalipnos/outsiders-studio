// Módulo "Plataforma": encima de la vista previa, la interfaz de TikTok, YouTube Shorts o Instagram Reels (dibujada aquí, una imitación que
// no llega al vídeo) y, si se quiere, las zonas que tapan. Es de este navegador: no se guarda en el proyecto. Medidas en el lienzo de 1080x1920.
(function () {
  var A, P = { ui: 'none', zonas: false }, KEY = 'mi-estudio-plataforma';
  var ZONAS = [[0, 0, 1080, 220], [0, 1470, 1080, 450], [0, 220, 35, 1250], [1045, 220, 35, 935], [980, 1155, 100, 315]];
  var NOMBRES = [['tiktok', 'TikTok'], ['shorts', 'YouTube Shorts'], ['reels', 'Instagram Reels'], ['none', 'Ninguna']];
  var ICO = {
    heart: '<path d="M12 21s-8.500-5.300-8.500-11.300A4.700 4.700 0 0112 7a4.700 4.700 0 018.500 2.700C20.500 15.700 12 21 12 21z"/>',
    comment: '<path d="M4 12a8 8 0 118 8c-1.500 0-2.900-.4-4.100-1.100L4 20l1.100-3.900A8 8 0 014 12z"/>',
    send: '<path d="M21 3L3 10.500l7 3 3 7zM21 3L10 13.500"/>',
    repost: '<path d="M17 2l4 4-4 4M3 11V9a3 3 0 013-3h15M7 22l-4-4 4-4M21 13v2a3 3 0 01-3 3H3"/>',
    bookmark: '<path d="M6 3h12v18l-6-4.500L6 21z"/>',
    share: '<path d="M13 5l8 7-8 7v-4.500C8 14.500 5 16 3 19c.5-5 3.500-9.500 10-10z"/>',
    thumb: '<path d="M7 11l4-8c1.700 0 3 1.300 3 3v4h5a2 2 0 012 2.300l-1.200 7A2 2 0 0117.800 21H7zM7 11H3v10h4"/>',
    thumbd: '<path d="M17 13l-4 8c-1.700 0-3-1.300-3-3v-4H5a2 2 0 01-2-2.300l1.200-7A2 2 0 016.200 3H17zM17 13h4V3h-4"/>',
    remix: '<path d="M5 8a7 7 0 0112-2l2 2V3M19 16a7 7 0 01-12 2l-2-2v5"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="M21 21l-5-5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13.500" r="3.500"/>',
    dots: '<circle cx="5" cy="12" r="1.600" fill="#fff"/><circle cx="12" cy="12" r="1.600" fill="#fff"/><circle cx="19" cy="12" r="1.600" fill="#fff"/>',
    live: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M8 3l4 3 4-3"/>',
    note: '<path d="M9 18V6l10-2v12"/><circle cx="6.500" cy="18" r="2.500"/><circle cx="16.500" cy="16" r="2.500"/>',
    chev: '<path d="M6 9l6 6 6-6"/>'
  };
  var CSS = '.pf-ui{position:absolute;left:0;top:0;width:1080px;height:1920px;transform-origin:0 0;transform:scale(var(--s,1));z-index:60;pointer-events:none;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.45)}' +
    '.pf-ui svg{display:block;fill:none;stroke:#fff;stroke-width:1.700;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 2px 4px rgba(0,0,0,.45))}.pf-ui>*{position:absolute}' +
    '.pf-z i{position:absolute;background:rgba(229,72,77,.24)}.pf-time{left:64px;top:28px;font-size:42px;font-weight:600}.pf-bat{right:56px;top:36px;display:flex;gap:12px;align-items:center}' +
    '.pf-r{width:176px;right:2px;text-align:center;font-size:32px;font-weight:600;white-space:nowrap}.pf-r small{font-size:27px;font-weight:600}.pf-r svg{margin:0 auto 6px}.pf-av{border-radius:50%;background:#8a8f98;display:grid;place-items:center;border:4px solid #fff}' +
    '.pf-name{font-size:38px;font-weight:700;display:flex;align-items:center;gap:22px;left:40px}.pf-line{left:40px;right:190px;font-size:34px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-weight:400}' +
    '.pf-pill{font-size:30px;font-weight:600;padding:9px 26px;border-radius:14px;border:3px solid rgba(255,255,255,.85)}.pf-pill.w{background:#fff;color:#111;border-color:#fff;border-radius:50px;text-shadow:none}' +
    '.pf-m{min-width:230px}.pf-m small{display:block;color:var(--t3);font-size:10.5px;margin:-4px 0 8px;line-height:1.35;max-width:240px}.pf-m button{display:flex;justify-content:space-between;width:100%;border:0;background:none;padding:6px 8px;font-size:12px;color:var(--t1);text-align:left;border-radius:6px}.pf-m button:hover{background:rgba(255,255,255,.07)}.pf-m button.on{color:var(--a)}.pf-m hr{border:0;border-top:1px solid var(--b1);margin:6px 0}';

  function ic(n, s, extra) { return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '"' + (extra || '') + '>' + ICO[n] + '</svg>'; }
  function rail(n, y, t, s) { return '<div class="pf-r" style="top:' + y + 'px">' + ic(n, s || 92) + (t ? t : '') + '</div>'; }
  function barra() {
    return '<div class="pf-time">9:41</div><div class="pf-bat"><svg viewBox="0 0 24 12" width="60" height="30"><path d="M1 11h2V8H1zM6 11h2V5H6zM11 11h2V3h-2zM16 11h2V1h-2z" fill="#fff" stroke="none"/></svg>' +
      '<svg viewBox="0 0 26 12" width="72" height="34"><rect x="1" y="1" width="21" height="10" rx="2.500"/><rect x="3" y="3" width="15" height="6" rx="1" fill="#fff" stroke="none"/><path d="M24 4.500v3"/></svg></div>';
  }
  function pinta() {
    var k = P.ui, h = k === 'none' ? '' : barra();
    if (k === 'reels') h +=
      '<div style="left:40px;top:112px;font-size:58px;font-weight:700;display:flex;align-items:center;gap:6px">Reels' + ic('chev', 50) + '</div><div style="right:36px;top:112px">' + ic('camera', 76) + '</div>' +
      rail('heart', 1000, '2,8 M') + rail('comment', 1150, '2,8 M') + rail('repost', 1300, '2,8 M') + rail('send', 1450, '2,8 M') + rail('dots', 1610, '', 72) +
      '<div class="pf-r" style="top:1760px"><div style="width:76px;height:76px;margin:auto;border-radius:14px;background:#8a8f98;border:4px solid #fff"></div></div>' +
      '<div class="pf-name" style="top:1600px"><div class="pf-av" style="width:84px;height:84px"></div>tu_nombre<span class="pf-pill">Seguir</span></div>' +
      '<div class="pf-line" style="top:1706px">Aquí va la descripción de tu vídeo…</div><div class="pf-line" style="top:1766px;display:flex;gap:10px;align-items:center;font-size:30px">' + ic('note', 36) + 'tu_nombre · Audio original</div>';
    else if (k === 'tiktok') h +=
      '<div style="left:40px;top:118px">' + ic('live', 72) + '</div><div style="left:0;right:0;top:118px;text-align:center;font-size:42px;font-weight:600"><span style="opacity:.72">Siguiendo</span> &nbsp;&nbsp; <span style="border-bottom:6px solid #fff;padding-bottom:8px">Para ti</span></div><div style="right:40px;top:118px">' + ic('search', 72) + '</div>' +
      '<div class="pf-r" style="top:880px"><div class="pf-av" style="width:104px;height:104px;margin:auto"></div><div style="width:42px;height:42px;line-height:38px;margin:-24px auto 0;position:relative;border-radius:50%;background:#fe2c55;font-size:38px">+</div></div>' +
      rail('heart', 1040, '2,8 M') + rail('comment', 1200, '2,8 M') + rail('bookmark', 1360, '2,8 M') + rail('share', 1520, '2,8 M') +
      '<div class="pf-r" style="top:1690px"><div style="width:96px;height:96px;margin:auto;border-radius:50%;background:#333;border:16px solid #111"></div></div>' +
      '<div class="pf-name" style="top:1600px">@tu_nombre</div><div class="pf-line" style="top:1660px">Aquí va la descripción de tu vídeo…</div><div class="pf-line" style="top:1720px;display:flex;gap:10px;align-items:center;font-size:32px">' + ic('note', 38) + 'sonido original - tu_nombre</div>';
    else if (k === 'shorts') h +=
      '<div style="right:190px;top:118px">' + ic('search', 72) + '</div><div style="right:100px;top:118px">' + ic('camera', 72) + '</div><div style="right:18px;top:118px">' + ic('dots', 72) + '</div>' +
      rail('thumb', 960, '2,8 M', 84) + rail('thumbd', 1110, '<small>No me gusta</small>', 84) + rail('comment', 1260, '2,8 M', 84) + rail('share', 1410, '<small>Compartir</small>', 84) + rail('remix', 1560, '<small>Remix</small>', 84) +
      '<div class="pf-r" style="top:1730px"><div style="width:84px;height:84px;margin:auto;border-radius:16px;background:#8a8f98;border:4px solid #fff"></div></div>' +
      '<div class="pf-name" style="top:1640px"><div class="pf-av" style="width:78px;height:78px"></div>@tu_nombre<span class="pf-pill w">Suscribirme</span></div>' +
      '<div class="pf-line" style="top:1738px">Aquí va el título de tu vídeo…</div><div class="pf-line" style="top:1794px;display:flex;gap:10px;align-items:center;font-size:30px">' + ic('note', 34) + 'Sonido original - tu_nombre</div>';
    if (P.zonas) h += '<div class="pf-z" style="inset:0">' + ZONAS.map(function (r) { return '<i style="left:' + r[0] + 'px;top:' + r[1] + 'px;width:' + r[2] + 'px;height:' + r[3] + 'px"></i>'; }).join('') + '</div>';
    P.el.innerHTML = h;
    P.el.hidden = !h;
    var b = A.state().el.ptools.querySelector('[data-p=plataforma]');
    if (b) b.classList.toggle('on', k !== 'none' || P.zonas);
    try { localStorage.setItem(KEY, JSON.stringify({ ui: P.ui, zonas: P.zonas })); } catch (e) {}
  }
  function menu(b) {
    A.popup('<div class="pf-m"><h4>Ver como en cada red</h4><small>Es una imitación de su interfaz para colocar las cosas: no sale en el vídeo y cambia un poco según el móvil.</small>' +
      NOMBRES.map(function (n) { return '<button data-p="plataforma" data-k="ui" data-v="' + n[0] + '" class="' + (P.ui === n[0] ? 'on' : '') + '">' + n[1] + '<span>' + (P.ui === n[0] ? '✓' : '') + '</span></button>'; }).join('') +
      '<hr><button data-p="plataforma" data-k="zonas" class="' + (P.zonas ? 'on' : '') + '">Zonas que se tapan<span>' + (P.zonas ? '✓' : '') + '</span></button></div>', b);
  }

  Timeline.use({
    id: 'plataforma',
    init: function (api) {
      A = api;
      var s = document.createElement('style'); s.textContent = CSS; document.head.appendChild(s);
      try { var g = JSON.parse(localStorage.getItem(KEY) || '{}'); if (g.ui) P.ui = g.ui; P.zonas = !!g.zonas; } catch (e) {}
      P.el = document.createElement('div');
      P.el.className = 'pf-ui';
      A.state().el.screen.appendChild(P.el);
      setTimeout(pinta, 0);
      return true;
    },
    toolbar: function () { return '<button class="st-tb" data-p="plataforma" data-k="menu" title="Ver como en TikTok, Shorts o Reels">' + A.ic('safe') + '</button>'; },
    onClick: function (b) {
      var k = b.dataset.k;
      if (k === 'menu') return menu(b);
      if (k === 'ui') { P.ui = b.dataset.v; A.closePopup(); pinta(); }
      else if (k === 'zonas') { P.zonas = !P.zonas; A.closePopup(); pinta(); }
    },
    helpExtra: function () { return '<b>Ver como en cada red:</b> el botón del móvil, sobre la vista previa, enseña encima la interfaz de TikTok, Shorts o Reels y las zonas que se tapan. No sale en el vídeo.<br>'; }
  });
})();
