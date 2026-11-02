// Módulo "Color" de la Edición: el panel Grade / Effects de HyperFrames Studio, en Diseño al elegir un fragmento de vídeo o una
// capa de vídeo/imagen. Datos: edicion/color_edit.json -> {targets: {"video"|"lib:<id>"|"el:<id>": <grading>}}, solo lo que
// difiere de neutro (o de su preset). <grading> es el formato exacto de data-color-grading (función Rc del bundle de Studio):
//   {preset, intensity, adjust: {exposure...}, details: {vignette...}, effects: {blur...},
//    wheels: {shadows|midtones|highlights: {hue: 0-360, amount: 0-1, level: -1-1}},
//    curves: {master|red|green|blue: [[x, y], ...]}            0-1, x creciente, de 2 a 16 puntos, con los extremos 0 y 1
//    hueCurves: {hueVsHue|hueVsSaturation|hueVsLuma: [[grados, v], ...]}   de 3 a 16; v: ±180 en hueVsHue, ±1 en los otros
//    secondaries: [{enabled, key: {hue: {center, range, softness}, saturation: {min, max, softness}, luma: {min, max, softness}},
//                   correction: {hueShift, saturation, luma, temperature, tint}}]   hasta 4
//    lut: {src, intensity}, palette: ["#rrggbb", ...]}          de 2 a 6 colores
// Vista previa aproximada: un filtro SVG por objetivo (tablas por canal + matrices) sacado de las mismas cuentas del shader del
// motor; viñeta, grano y líneas son capas encima del vídeo. Los visores y las miniaturas sí usan la cuenta exacta, píxel a píxel.
(function () {
  var A, U, E, PRE = {}, NEUT = {};
  var RGB = ['R', 'G', 'B'], CURVE_COL = { master: '#e5e5e5', red: '#ef4444', green: '#22c55e', blue: '#3b82f6' };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var ss = function (a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  var luma = function (r, g, b) { return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  var copy = function (o) { return JSON.parse(JSON.stringify(o)); };
  var r4 = function (v) { return Math.round(v * 10000) / 10000; };
  var pct = function (v) { return Math.round(v * 100) + ' %'; };
  var sgn = function (v) { var n = Math.round(v * 100); return (n > 0 ? '+' : '') + n; };
  var deg = function (k) { return function (v) { return Math.round(v * k) + '°'; }; };
  var pxf = function (a, b) { return function (v) { return Math.round(a + v * b) + ' px'; }; };
  var blank = function () { return { adjust: {}, details: {}, effects: {}, wheels: {}, curves: {}, hueCurves: {}, secondaries: [] }; };

  var ADJ = { exposure: 'Exposición', contrast: 'Contraste', highlights: 'Luces', shadows: 'Sombras', whites: 'Blancos', blacks: 'Negros', temperature: 'Temperatura', tint: 'Verde/magenta', vibrance: 'Viveza', saturation: 'Saturación' };
  var ZONE = { shadows: 'Sombras', midtones: 'Medios', highlights: 'Luces' };
  var CH = { master: 'Todo', red: 'Rojo', green: 'Verde', blue: 'Azul' };
  var HUE = { hueVsHue: 'Tono', hueVsSaturation: 'Saturación', hueVsLuma: 'Brillo' };
  var PRES = { neutral: 'Neutro', 'warm-daylight': 'Luz cálida', 'clean-studio': 'Estudio limpio', 'skin-soft': 'Piel suave', 'food-pop': 'Comida viva', 'night-lift': 'Noche clara', 'muted-editorial': 'Editorial apagado', 'vintage-wash': 'Vintage lavado', 'mono-clean': 'Blanco y negro', 'mono-fade': 'B/N lavado', 'soft-boost': 'Realce suave', 'bright-pop': 'Brillante', 'deep-contrast': 'Contraste fuerte', 'creator-camcorder': 'Videocámara', 'vhs-playback': 'VHS', 'home-movie-8mm': 'Cine casero 8 mm', 'editorial-halftone': 'Puntos de cómic', 'two-ink-print': 'Dos tintas' };
  var PALG = { Classic: 'Clásicas', Mood: 'Ambiente', Print: 'Impresión', Retro: 'Retro' };
  var PAL = { Noir: 'Blanco y negro', 'Ink & Paper': 'Tinta y papel', 'Amber Glow': 'Ámbar', 'Handheld Green': 'Consola verde', 'Golden Hour': 'Hora dorada', 'Deep Sea': 'Mar profundo', 'Arctic Night': 'Noche ártica', Forest: 'Bosque', Blueprint: 'Plano azul', 'Warm Print': 'Impresión cálida', 'Electric Ink': 'Tinta eléctrica' };
  var FAM = [['essentials', 'Básicos'], ['retro-glitch', 'Retro'], ['print', 'Impresión'], ['art', 'Arte']];
  // efectos: etiqueta, control principal y subparámetros [clave, etiqueta, min, max, paso, formato] (por defecto 0-1 en %)
  var EFX = {
    blur: { n: 'Desenfoque', m: 'Radio', f: function (v) { return (.75 + Math.pow(v, 1.35) * 32).toFixed(1) + ' px'; }, live: 1 },
    pixelate: { n: 'Pixelado', m: 'Celda', f: pxf(1, 47), live: 1 },
    bloom: { n: 'Resplandor', m: 'Intensidad', max: 3, live: 1, s: [['bloomRadius', 'Radio', 1, 100, 1, function (v) { return Math.round(v) + ' px'; }]] },
    chromaBleed: { n: 'Color corrido', m: 'Mancha' },
    tapeDamage: { n: 'Cinta VHS', m: 'Daño', s: [['tapeTracking', 'Arrastre'], ['tapeNoise', 'Ruido'], ['tapeSpeed', 'Velocidad']] },
    filmArtifacts: { n: 'Película vieja', m: 'Densidad' },
    scanlines: { n: 'Líneas de tele', m: 'Opacidad', live: 1, s: [['scanlineCount', 'Líneas', 0, 1, .01, function (v) { return Math.round(50 + v * 450); }], ['scanlineSoftness', 'Suavidad']] },
    crtCurvature: { n: 'Tele antigua', m: 'Curvatura' },
    chromaticAberration: { n: 'Separar colores', m: 'Separación', live: 1, s: [['chromaticAngle', 'Ángulo', 0, 1, .0028, deg(360)]] },
    digitalGlitch: { n: 'Glitch', m: 'Cantidad', s: [['digitalGlitchColorSplit', 'Color'], ['digitalGlitchLineTear', 'Desgarro'], ['digitalGlitchPixelate', 'Pixelado'], ['digitalGlitchBlockAmount', 'Bloques'], ['digitalGlitchBlockDisplacement', 'Desplazamiento'], ['digitalGlitchBlockOpacity', 'Opacidad bloques'], ['digitalGlitchSpeed', 'Velocidad']] },
    halftone: { n: 'Puntos de cómic', m: 'Cantidad', s: [['halftoneSize', 'Punto']] },
    twoInkPrint: { n: 'Dos tintas', m: 'Cantidad', s: [['twoInkPrintSize', 'Punto']] },
    dither: { n: 'Píxeles con trama', m: 'Cantidad', pal: 1, s: [['ditherSize', 'Punto', 0, 1, .01, function (v) { return (1 + v * 4).toFixed(1) + ' px'; }]] },
    monoScreen: { n: 'Trama de un color', m: 'Cantidad', pal: 1, s: [['monoScreenSize', 'Celda', 0, 1, .01, pxf(4, 14)], ['monoScreenAngle', 'Ángulo', 0, 1, .011, deg(90)], ['monoScreenSpread', 'Dispersión'], { k: 'monoScreenShape', l: 'Forma', o: ['Círculo', 'Cuadrado', 'Rombo', 'Triángulo', 'Línea'] }, { k: 'monoScreenInvert', l: 'Invertir', t: 1 }] },
    ascii: { n: 'ASCII', m: 'Cantidad', pal: 1, s: [['asciiSize', 'Carácter', 0, 1, .01, pxf(4, 76)], { k: 'asciiStyle', l: 'Estilo', o: ['Estándar', 'Denso', 'Mínimo', 'Bloques', 'Braille', 'Técnico', 'Matrix', 'Trama'] }, { k: 'asciiInvert', l: 'Invertir', t: 1 }, { k: 'asciiColor', l: 'Color de origen', t: 1 }, ['asciiRotation', 'Giro de bordes']] },
    engraving: { n: 'Grabado', m: 'Cantidad', pal: 1, s: [['engravingSpacing', 'Separación'], ['engravingMinThickness', 'Grosor mín.'], ['engravingMaxThickness', 'Grosor máx.'], ['engravingAngle', 'Ángulo', 0, 1, .0056, deg(180)], ['engravingContrast', 'Contraste'], ['engravingSharpness', 'Nitidez'], ['engravingWave', 'Onda'], ['engravingWaveFrequency', 'Frecuencia']] },
    crosshatch: { n: 'Dibujo a rayas', m: 'Cantidad', pal: 1, s: [['crosshatchSpacing', 'Separación'], ['crosshatchThickness', 'Grosor'], ['crosshatchAngle', 'Ángulo', 0, 1, .0056, deg(180)], ['crosshatchContrast', 'Contraste'], ['crosshatchEdges', 'Bordes'], ['crosshatchLineWeight', 'Variación'], ['crosshatchWave', 'Onda'], ['crosshatchWaveFrequency', 'Frecuencia']] },
    kuwahara: { n: 'Pintura', m: 'Cantidad', s: [['kuwaharaRadius', 'Radio', 0, 1, .01, pxf(2, 14)], ['kuwaharaSharpness', 'Nitidez'], ['kuwaharaSaturation', 'Saturación', 0, 1, .01, function (v) { return Math.round(v * 200) + ' %'; }]] }
  };
  var CSS = '.co-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}.co-pre{padding:0;background:var(--card2);border:1px solid var(--b1);border-radius:6px;overflow:hidden;color:var(--t2);font-size:10px;min-width:0;text-align:left}' +
    '.co-pre img,.co-pre u{display:block;width:100%;height:34px;object-fit:cover;background:#1c1c1c}.co-pre span{display:block;padding:3px 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.co-pre.on{border-color:var(--a);color:var(--a)}' +
    '.co-tabs{display:flex;gap:3px;margin:0 0 6px}.co-tabs button{flex:1;padding:3px 4px;font-size:10.5px;background:var(--card2);border:1px solid var(--b1);border-radius:5px;color:var(--t3);min-width:0}.co-tabs button.on{background:var(--ad);border-color:var(--a);color:var(--a)}' +
    '.co-wheels{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.co-wz{min-width:0;text-align:center}.co-wl{font-size:10.5px;color:var(--t2);margin-bottom:4px}' +
    '.co-wh{position:relative;width:100%;aspect-ratio:1;border-radius:50%;cursor:crosshair;touch-action:none;background:radial-gradient(circle,#6b6b6b 0,rgba(107,107,107,0) 72%),conic-gradient(hsl(0 90% 55%),hsl(60 90% 55%),hsl(120 90% 55%),hsl(180 90% 55%),hsl(240 90% 55%),hsl(300 90% 55%),hsl(360 90% 55%))}' +
    '.co-wh i{position:absolute;width:9px;height:9px;margin:-5px 0 0 -5px;border:1.5px solid #fff;border-radius:50%;box-shadow:0 0 2px #000;pointer-events:none}.co-wv{font-size:10px;color:var(--t3);margin:3px 0;font-variant-numeric:tabular-nums}.co-wz .st-sl{width:100%;min-width:0}' +
    '.co-cv{display:block;width:100%;background:#101010;border:1px solid var(--b1);border-radius:6px;touch-action:none;cursor:crosshair}.co-cv.c{max-width:232px;margin:0 auto}.co-cv circle{cursor:grab}' +
    '.co-sc{display:block;width:100%;height:140px;background:#0b0b0b;border:1px solid var(--b1);border-radius:6px}.co-fx{border-top:1px solid var(--b0);padding:5px 0}.co-fx:first-child{border-top:0}.co-fxh{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--t2)}.co-fxh b{flex:1;font-weight:500;min-width:0}.co-fx.on .co-fxh b{color:var(--t1)}.co-fxh button{padding:2px 7px;font-size:10.5px}.co-fx.on .co-fxh button{border-color:var(--a);color:var(--a)}' +
    '.co-note{color:var(--t3);font-size:10.5px;line-height:1.5;margin:4px 0}.co-samp,.co-matte{display:block;height:190px;width:auto;margin:6px auto;border:1px solid var(--b1);border-radius:4px;background:#000}.co-samp{cursor:crosshair}' +
    '.co-sw{display:flex;gap:4px;flex-wrap:wrap;align-items:center;margin:6px 0}.co-sw input[type=color]{width:26px;height:22px;padding:0;border:1px solid var(--b1);border-radius:4px;background:none}.co-sw button{padding:2px 7px;font-size:11px}' +
    '.co-lay,.co-lay>*{position:absolute;inset:0;pointer-events:none}.co-lay>canvas{width:100%;height:100%}.co-hold.on{background:var(--ad);border-color:var(--a);color:var(--a)}.co-r label{cursor:default}';

  // ---------- la cuenta del motor ----------
  function base(g, sec, k) { var p = g.preset && PRE[g.preset]; return p && p[sec][k] != null ? p[sec][k] : NEUT[sec][k]; }
  function eff(g) {                          // lo que resulta: como Rc, el preset debajo y lo cambiado encima
    var p = g.preset && PRE[g.preset], o = { intensity: g.intensity != null ? g.intensity : p ? p.intensity : 1 };
    ['adjust', 'details', 'effects'].forEach(function (s) {
      o[s] = {};
      Object.keys(NEUT[s]).forEach(function (k) { o[s][k] = g[s] && g[s][k] != null ? g[s][k] : base(g, s, k); });
    });
    return o;
  }
  function tang(e) {                         // tangentes de la curva monótona, las mismas que el motor
    var t = [], n = [], i, sg = Math.sign;
    for (i = 1; i < e.length; i++) { t.push(e[i][0] - e[i - 1][0]); n.push((e[i][1] - e[i - 1][1]) / t[i - 1]); }
    if (e.length === 2) return [n[0], n[0]];
    var edge = function (a, b, c, d) { var v = ((2 * a + b) * c - a * d) / (a + b); return sg(v) !== sg(c) ? 0 : sg(c) !== sg(d) && Math.abs(v) > 3 * Math.abs(c) ? 3 * c : v; };
    var o = new Array(e.length), L = t.length;
    o[0] = edge(t[0], t[1], n[0], n[1]); o[e.length - 1] = edge(t[L - 1], t[L - 2], n[L - 1], n[L - 2]);
    for (i = 1; i < e.length - 1; i++) {
      var l = n[i - 1], s = n[i];
      if (l === 0 || s === 0 || sg(l) !== sg(s)) { o[i] = 0; continue; }
      var m = 2 * t[i] + t[i - 1], f = t[i] + 2 * t[i - 1];
      o[i] = (m + f) / (m / l + f / s);
    }
    return o;
  }
  function bake(e, n, xf, lo, hi) {
    var o = tang(e), a = new Float32Array(n), l = 0;
    for (var s = 0; s < n; s++) {
      var u = xf(s);
      while (l < e.length - 2 && u > e[l + 1][0]) l++;
      var d = e[l], m = e[l + 1], w = m[0] - d[0], x = clamp((u - d[0]) / w, 0, 1), x2 = x * x, x3 = x2 * x;
      a[s] = clamp((2 * x3 - 3 * x2 + 1) * d[1] + (x3 - 2 * x2 + x) * w * o[l] + (-2 * x3 + 3 * x2) * m[1] + (x3 - x2) * w * o[l + 1], lo, hi);
    }
    return a;
  }
  function bakeCurve(p) { return bake(p, 256, function (i) { return i / 255; }, 0, 1); }
  function bakeHue(p, lo, hi) {
    var s = p.slice().sort(function (a, b) { return a[0] - b[0]; });
    var l = s.slice(-2).map(function (q) { return [q[0] - 360, q[1]]; }).concat(s, s.slice(0, 2).map(function (q) { return [q[0] + 360, q[1]]; }));
    return bake(l, 256, function (i) { return i / 256 * 360; }, lo, hi);
  }
  function look(t, x) { var f = clamp(x, 0, 1) * 255, i = Math.floor(f); return i >= 255 ? t[255] : t[i] + (t[i + 1] - t[i]) * (f - i); }
  function lookHue(t, h) { var f = (h - Math.floor(h)) * 256, i = Math.floor(f) % 256; return t[i] + (t[(i + 1) % 256] - t[i]) * (f - Math.floor(f)); }
  function hsv2rgb(h, s, v, o) {
    var i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s), m = ((i % 6) + 6) % 6;
    o[0] = [v, q, p, p, t, v][m]; o[1] = [t, v, v, q, p, p][m]; o[2] = [p, p, t, v, v, q][m];
    return o;
  }
  function rgb2hsv(r, g, b) {
    var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d > 1e-10) h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) / 6 : mx === g ? ((b - r) / d + 2) / 6 : ((r - g) / d + 4) / 6;
    return [h, mx > 1e-10 ? d / mx : 0, mx];
  }
  function wheelDir(hue) {
    var c = hsv2rgb(hue / 360, 1, 1, [0, 0, 0]), l = luma(c[0], c[1], c[2]), d = [c[0] - l, c[1] - l, c[2] - l];
    var m = Math.max(Math.abs(d[0]), Math.abs(d[1]), Math.abs(d[2]), .0001);
    return [d[0] / m, d[1] / m, d[2] / m];
  }
  function comp(g) {                         // deja todo listo para calcular píxeles
    var f = eff(g), c = { f: f, a: f.adjust, i: f.intensity, w: null, cv: null, hue: null, sec: [], lut: null }, w = g.wheels || {}, cu = g.curves || {}, hc = g.hueCurves || {};
    var z = E.wheelZones.map(function (k) { var o = w[k] || {}; return { d: wheelDir(o.hue || 0), a: o.amount || 0, l: o.level || 0 }; });
    if (z.some(function (x) { return x.a || x.l; })) c.w = z;
    if (E.curveChannels.some(function (k) { return isCurve(cu[k]); })) {
      c.cv = E.curveChannels.map(function (k) { return isCurve(cu[k]) ? bakeCurve(cu[k]) : null; });
    }
    if (E.hueCurves.some(function (k) { return isHue(hc[k]); })) {
      c.hue = [isHue(hc.hueVsHue) ? bakeHue(hc.hueVsHue, -180, 180) : null, isHue(hc.hueVsSaturation) ? bakeHue(hc.hueVsSaturation, -1, 1) : null, isHue(hc.hueVsLuma) ? bakeHue(hc.hueVsLuma, -1, 1) : null];
    }
    c.sec = (g.secondaries || []).filter(function (s) { return s.enabled !== false; });
    if (g.lut && U.cubes[g.lut.src] && g.lut.intensity !== 0) c.lut = { q: U.cubes[g.lut.src], i: g.lut.intensity == null ? 1 : g.lut.intensity };
    return c;
  }
  function isCurve(p) { return p && p.length >= 2 && p.some(function (q) { return Math.abs(q[0] - q[1]) > 1e-4; }); }
  function isHue(p) { return p && p.length >= 3 && p.some(function (q) { return Math.abs(q[1]) > 1e-4; }); }
  function prim(c, p, noSat) {               // applyPrimaryGrade
    var a = c.a, k = Math.pow(2, a.exposure), r = p[0] * k, g = p[1] * k, b = p[2] * k, y = luma(r, g, b);
    var add = a.shadows * .35 * (1 - ss(0, .65, y)) + a.highlights * .35 * ss(.35, 1, y);
    var bp = clamp(a.blacks * .18, -.18, .18), wp = clamp(1 - a.whites * .18, .82, 1.18), den = Math.max(wp - bp, .2);
    r = (r + add - bp) / den; g = (g + add - bp) / den; b = (b + add - bp) / den;
    r += a.temperature * .08 + a.tint * .04; b -= a.temperature * .08 - a.tint * .04; g -= a.tint * .08;
    var ct = Math.max(0, 1 + a.contrast);
    r = (r - .5) * ct + .5; g = (g - .5) * ct + .5; b = (b - .5) * ct + .5;
    if (!noSat) {
      var l = luma(r, g, b), cs = clamp(Math.max(r, g, b) - Math.min(r, g, b), 0, 1);
      var sk = ss(.02, .18, r - g) * ss(0, .16, g - b) * ss(.18, .82, l), w = (1 - cs * .72) * (1 + (.55 - 1) * sk);
      var s = Math.max(0, 1 + a.vibrance * w) * Math.max(0, 1 + a.saturation);
      r = l + (r - l) * s; g = l + (g - l) * s; b = l + (b - l) * s;
    }
    p[0] = r; p[1] = g; p[2] = b;
  }
  function adv(c, p) {                       // ruedas y curvas RGB
    var i;
    if (c.w) {
      var l = luma(p[0], p[1], p[2]), sh = 1 - ss(0, .6, l), hi = ss(.4, 1, l), mi = Math.max(0, 1 - sh - hi), tt = Math.max(sh + mi + hi, .0001), ws = [sh / tt, mi / tt, hi / tt];
      for (i = 0; i < 3; i++) {
        var z = c.w[i], am = z.a * ws[i] * .18, lv = z.l * ws[i] * .25;
        p[0] += z.d[0] * am + lv; p[1] += z.d[1] * am + lv; p[2] += z.d[2] * am + lv;
      }
    }
    if (c.cv) for (i = 0; i < 3; i++) {
      var v = c.cv[0] ? look(c.cv[0], p[i]) : p[i];
      p[i] = c.cv[i + 1] ? look(c.cv[i + 1], v) : v;
    }
  }
  function hueC(c, p) {                      // applyHueCurves
    if (!c.hue) return;
    var hs = rgb2hsv(clamp(p[0], 0, 1), clamp(p[1], 0, 1), clamp(p[2], 0, 1)), l0 = luma(p[0], p[1], p[2]), h = hs[0];
    var dh = c.hue[0] ? lookHue(c.hue[0], h) / 360 : 0, ds = c.hue[1] ? lookHue(c.hue[1], h) : 0, dl = c.hue[2] ? lookHue(c.hue[2], h) : 0;
    hsv2rgb(h + dh - Math.floor(h + dh), clamp(hs[1] * Math.max(0, 1 + ds), 0, 1), hs[2], p);
    var o = l0 - luma(p[0], p[1], p[2]) + dl;
    p[0] += o; p[1] += o; p[2] += o;
  }
  function softR(v, a, b, s) { if (v < a) return s <= 0 ? 0 : ss(a - s, a, v); if (v > b) return s <= 0 ? 0 : 1 - ss(b, b + s, v); return 1; }
  function maskOf(k, r, g, b) {
    var hs = rgb2hsv(clamp(r, 0, 1), clamp(g, 0, 1), clamp(b, 0, 1)), dd = Math.abs(((hs[0] - k.hue.center / 360 + .5) % 1 + 1) % 1 - .5) * 360, m;
    if (k.hue.range < 179.999 && hs[1] < .001) m = 0;
    else if (dd <= k.hue.range) m = 1;
    else m = k.hue.softness <= 0 ? 0 : 1 - ss(k.hue.range, k.hue.range + k.hue.softness, dd);
    return m * softR(hs[1], k.saturation.min, k.saturation.max, k.saturation.softness) * softR(luma(r, g, b), k.luma.min, k.luma.max, k.luma.softness);
  }
  function secs(c, p) {                      // applySecondary
    for (var i = 0; i < c.sec.length; i++) {
      var s = c.sec[i], m = maskOf(s.key, p[0], p[1], p[2]);
      if (m <= 0) continue;
      var co = s.correction, hs = rgb2hsv(clamp(p[0], 0, 1), clamp(p[1], 0, 1), clamp(p[2], 0, 1)), h = hs[0] + co.hueShift / 360, q = hsv2rgb(h - Math.floor(h), hs[1], hs[2], [0, 0, 0]);
      var l = luma(q[0], q[1], q[2]), sa = Math.max(0, 1 + co.saturation);
      q[0] = l + (q[0] - l) * sa + co.luma; q[1] = l + (q[1] - l) * sa + co.luma; q[2] = l + (q[2] - l) * sa + co.luma;
      q[0] += co.temperature * .08 + co.tint * .04; q[2] -= co.temperature * .08 - co.tint * .04; q[1] -= co.tint * .08;
      p[0] += (q[0] - p[0]) * m; p[1] += (q[1] - p[1]) * m; p[2] += (q[2] - p[2]) * m;
    }
  }
  function lutC(c, p) {                      // applyLut, trilineal
    if (!c.lut) return;
    var q = c.lut.q, n = q.size, d = q.data, o = [0, 0, 0], lo = [0, 0, 0], fr = [0, 0, 0], k;
    for (k = 0; k < 3; k++) {
      var x = clamp((clamp(p[k], 0, 1) - q.min[k]) / Math.max(q.max[k] - q.min[k], 1e-5), 0, 1) * (n - 1);
      lo[k] = Math.floor(x); fr[k] = x - lo[k];
    }
    for (var b = 0; b < 2; b++) for (var g = 0; g < 2; g++) for (var r = 0; r < 2; r++) {
      var wt = (r ? fr[0] : 1 - fr[0]) * (g ? fr[1] : 1 - fr[1]) * (b ? fr[2] : 1 - fr[2]);
      if (!wt) continue;
      var ix = ((Math.min(lo[2] + b, n - 1) * n + Math.min(lo[1] + g, n - 1)) * n + Math.min(lo[0] + r, n - 1)) * 3;
      o[0] += d[ix] * wt; o[1] += d[ix + 1] * wt; o[2] += d[ix + 2] * wt;
    }
    for (k = 0; k < 3; k++) { var cl = clamp(p[k], 0, 1); p[k] = cl + (o[k] - cl) * c.lut.i; }
  }
  function pixel(c, p) {                     // la cuenta entera; p = [r, g, b] de 0 a 1
    var r = p[0], g = p[1], b = p[2];
    prim(c, p); adv(c, p); hueC(c, p); secs(c, p); lutC(c, p);
    p[0] = r + (clamp(p[0], 0, 1) - r) * c.i; p[1] = g + (clamp(p[1], 0, 1) - g) * c.i; p[2] = b + (clamp(p[2], 0, 1) - b) * c.i;
  }
  function tail(c, p) { hueC(c, p); secs(c, p); lutC(c, p); }

  // ---------- filtro SVG: tablas por canal y matrices ----------
  function tabFrom(fn, i) {                  // fn(p) sobre un gris -> una tabla por canal, mezclada con la intensidad
    var t = [[], [], []], p = [0, 0, 0];
    for (var n = 0; n <= 64; n++) {
      var v = n / 64;
      p[0] = p[1] = p[2] = v; fn(p);
      for (var k = 0; k < 3; k++) t[k].push(v + (p[k] - v) * i);
    }
    return t;
  }
  function tabId(t) { return t.every(function (c) { return c.every(function (y, n) { return Math.abs(y - n / 64) < .002; }); }); }
  function tabXml(t) {
    return '<feComponentTransfer>' + RGB.map(function (ch, k) { return '<feFunc' + ch + ' type="table" tableValues="' + t[k].map(function (v) { return clamp(v, 0, 1).toFixed(4); }).join(' ') + '"/>'; }).join('') + '</feComponentTransfer>';
  }
  function matXml(m) { return '<feColorMatrix type="matrix" values="' + m.map(function (v) { return v.toFixed(4); }).join(' ') + ' 0 0 0 1 0"/>'; }
  function satMat(s) {
    var l = [.2126, .7152, .0722], o = [];
    for (var r = 0; r < 3; r++) { for (var k = 0; k < 3; k++) o.push((1 - s) * l[k] + (r === k ? s : 0)); o.push(0, 0); }
    return o;
  }
  function fitMat(c, T3, i) {                // lo que depende del tono no cabe en una tabla: la matriz que más se acerca
    var S = [], w, h, a, b, n = 0, M = [], R = [[], [], []], p = [0, 0, 0], q;
    for (h = 0; h < 12; h++) for (a = 0; a < 3; a++) for (b = 0; b < 3; b++) S.push(hsv2rgb(h / 12, [.25, .55, 1][a], [.35, .65, 1][b], [0, 0, 0]));
    for (h = 0; h < 5; h++) { var v0 = h / 4; for (a = 0; a < 6; a++) S.push([v0, v0, v0]); }
    for (a = 0; a < 4; a++) { M.push([0, 0, 0, 0]); for (b = 0; b < 3; b++) R[b].push(0); }
    S.forEach(function (s) {
      p[0] = s[0]; p[1] = s[1]; p[2] = s[2]; tail(c, p);
      var x = [0, 1, 2].map(function (k) { return look256(T3[k], s[k]); }).concat(1);
      w = 1 + 8 * (Math.abs(p[0] - x[0]) + Math.abs(p[1] - x[1]) + Math.abs(p[2] - x[2]));
      for (a = 0; a < 4; a++) {
        for (b = 0; b < 4; b++) M[a][b] += w * x[a] * x[b];
        for (b = 0; b < 3; b++) R[b][a] += w * x[a] * p[b];
      }
      n += w;
    });
    for (a = 0; a < 4; a++) {                // un poco de peso hacia la identidad para que no se dispare
      M[a][a] += n * .002;
      for (b = 0; b < 3; b++) if (a === b) R[b][a] += n * .002;
    }
    var out = [];
    for (b = 0; b < 3; b++) {
      q = solve4(M, R[b]);
      out.push(b === 0 ? 1 + (q[0] - 1) * i : q[0] * i, b === 1 ? 1 + (q[1] - 1) * i : q[1] * i, b === 2 ? 1 + (q[2] - 1) * i : q[2] * i, 0, q[3] * i);
    }
    return out;
  }
  function look256(t, x) { var f = clamp(x, 0, 1) * 64, n = Math.floor(f); return n >= 64 ? t[64] : t[n] + (t[n + 1] - t[n]) * (f - n); }
  function solve4(M, r) {
    var a = M.map(function (row, i) { return row.concat(r[i]); }), n = 4, i, j, k;
    for (i = 0; i < n; i++) {
      var pv = i;
      for (j = i + 1; j < n; j++) if (Math.abs(a[j][i]) > Math.abs(a[pv][i])) pv = j;
      var t = a[i]; a[i] = a[pv]; a[pv] = t;
      if (Math.abs(a[i][i]) < 1e-9) continue;
      for (j = i + 1; j < n; j++) { var f = a[j][i] / a[i][i]; for (k = i; k <= n; k++) a[j][k] -= f * a[i][k]; }
    }
    var x = [0, 0, 0, 0];
    for (i = n - 1; i >= 0; i--) { var s = a[i][n]; for (k = i + 1; k < n; k++) s -= a[i][k] * x[k]; x[i] = Math.abs(a[i][i]) < 1e-9 ? 0 : s / a[i][i]; }
    return x;
  }
  function filterXml(g, c) {                 // el orden del shader: geometría, color, bloom
    var f = c.f, e = f.effects, s = '', i = c.i, T = [];
    if (e.pixelate > 1e-4) {
      var cell = Math.max(2, Math.round(1 + e.pixelate * 47)), hf = Math.floor(cell / 2);
      s += '<feFlood x="' + hf + '" y="' + hf + '" width="1" height="1"/><feComposite width="' + cell + '" height="' + cell + '"/><feTile result="ct"/><feComposite in="SourceGraphic" in2="ct" operator="in"/><feMorphology operator="dilate" radius="' + hf + '"/>';
    }
    if (e.chromaticAberration > 1e-4) {
      var an = e.chromaticAngle * Math.PI * 2, dx = Math.cos(an) * e.chromaticAberration * .02 * A.W, dy = Math.sin(an) * e.chromaticAberration * .02 * A.H;
      s += '<feOffset dx="0" dy="0" result="c0"/><feOffset in="c0" dx="' + (-dx).toFixed(1) + '" dy="' + (-dy).toFixed(1) + '"/><feColorMatrix type="matrix" values="1 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 1 0" result="cr"/>' +
        '<feColorMatrix in="c0" type="matrix" values="0 0 0 0 0 0 1 0 0 0 0 0 0 0 0 0 0 0 1 0" result="cg"/><feOffset in="c0" dx="' + dx.toFixed(1) + '" dy="' + dy.toFixed(1) + '"/><feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 1 0 0 0 0 0 1 0" result="cb"/>' +
        '<feBlend in="cr" in2="cg" mode="screen" result="crg"/><feBlend in="crg" in2="cb" mode="screen"/>';
    }
    if (i > 1e-4) {
      var t1 = tabFrom(function (p) { prim(c, p, true); }, i);
      if (!tabId(t1)) s += tabXml(t1);
      var sv = Math.max(0, 1 + f.adjust.vibrance * .78) * Math.max(0, 1 + f.adjust.saturation);
      if (Math.abs(sv - 1) > .002) s += matXml(satMat(1 + (sv - 1) * i));
      var t2 = tabFrom(function (p) { adv(c, p); }, i);
      if (!tabId(t2)) s += tabXml(t2);
      if (c.hue || c.sec.length || c.lut) {
        var t3 = tabFrom(function (p) { tail(c, p); }, i);
        if (!tabId(t3)) s += tabXml(t3);
        s += matXml(fitMat(c, t3, i));
      }
    }
    if (e.bloom > 1e-4) {
      s += '<feOffset dx="0" dy="0" result="b0"/><feComponentTransfer>' + RGB.map(function (ch) { return '<feFunc' + ch + ' type="linear" slope="2.5" intercept="-1.5"/>'; }).join('') + '</feComponentTransfer><feGaussianBlur stdDeviation="' + Math.max(.5, e.bloomRadius).toFixed(1) + '" result="b1"/>' +
        '<feComposite in="b0" in2="b1" operator="arithmetic" k1="0" k2="1" k3="' + e.bloom.toFixed(3) + '" k4="0"/>';
    }
    return s;
  }
  function cssOf(id) {                       // el valor de style.filter de un objetivo, y deja su <filter> al día
    var g = U.targets[id];
    if (!g || U.hold) return '';
    var c = comp(g), xml = filterXml(g, c), bl = c.f.effects.blur, out = '';
    if (bl > 1e-4) out += 'blur(' + (.75 + Math.pow(bl, 1.35) * 32).toFixed(1) + 'px) ';
    if (xml) {
      var fe = U.filters[id];
      if (!fe) {
        fe = U.filters[id] = document.createElementNS('http://www.w3.org/2000/svg', 'filter');
        fe.id = 'co-f-' + (U.nf++);
        fe.setAttribute('x', '0'); fe.setAttribute('y', '0'); fe.setAttribute('width', '100%'); fe.setAttribute('height', '100%');
        fe.setAttribute('color-interpolation-filters', 'sRGB');
        U.svg.appendChild(fe);
      }
      if (fe.getAttribute('data-x') !== xml) { fe.innerHTML = xml; fe.setAttribute('data-x', xml); }
      out += 'url(#' + fe.id + ')';
    }
    return out.trim();
  }
  function layers(g) {                       // viñeta, grano y líneas: encima del vídeo, las cuentas del shader
    var T = A.state();
    if (!U.lay) {
      U.lay = document.createElement('div'); U.lay.className = 'co-lay';
      U.lay.innerHTML = '<canvas class="co-vig" width="90" height="160"></canvas><div class="co-gr"></div><div class="co-sl"></div>';
      T.el.rf.appendChild(U.lay);
      var t = document.createElement('canvas'), x = t.getContext('2d'), im = x.createImageData(128, 128);
      t.width = t.height = 128;
      for (var i = 0; i < im.data.length; i += 4) { var n = Math.random() * 255; im.data[i] = im.data[i + 1] = im.data[i + 2] = n; im.data[i + 3] = 255; }
      x.putImageData(im, 0, 0);
      U.noise = t.toDataURL();
    }
    var f = g && !U.hold ? eff(g) : null, d = f && f.details, e = f && f.effects, vig = U.lay.children[0], gr = U.lay.children[1], sl = U.lay.children[2], hasV = d && d.vignette > 1e-4;
    vig.style.display = hasV ? '' : 'none';
    if (hasV) {
      var ck = [d.vignette, d.vignetteMidpoint, d.vignetteRoundness, d.vignetteFeather].join();
      if (U.vigKey !== ck) {
        U.vigKey = ck;
        var w = vig.width, h = vig.height, cx = vig.getContext('2d'), id = cx.createImageData(w, h), pw = 8 + (1.8 - 8) * clamp(d.vignetteRoundness * .5 + .5, 0, 1), mid = .22 + (1.08 - .22) * d.vignetteMidpoint, fe = .08 + (.72 - .08) * d.vignetteFeather;
        for (var y = 0, o = 0; y < h; y++) for (var xx = 0; xx < w; xx++, o += 4) {
          var u = Math.abs(((xx + .5) / w - .5) * 2), v = Math.abs(((y + .5) / h - .5) * 2) * (A.H / A.W);
          id.data[o + 3] = 255 * ss(mid, mid + fe, Math.pow(Math.pow(u, pw) + Math.pow(v, pw), 1 / pw)) * d.vignette * .75;
        }
        cx.putImageData(id, 0, 0);
      }
    }
    if (d && d.grain > 1e-4) {
      var gs = Math.max(1 + d.grainSize * 5, 1 / (T.S || 1)) * 128;
      gr.style.cssText = 'display:block;background:url(' + U.noise + ');background-size:' + gs + 'px;image-rendering:pixelated;mix-blend-mode:overlay;opacity:' + (d.grain * (.09 + d.grainRoughness * .08)).toFixed(3);
    } else gr.style.display = 'none';
    if (e && e.scanlines > 1e-4) {
      var ph = A.H * 2 / (50 + 450 * e.scanlineCount), al = e.scanlines * (1 - e.scanlineSoftness * .35);
      sl.style.cssText = 'display:block;background:repeating-linear-gradient(to bottom,rgba(0,0,0,0) 0,rgba(0,0,0,' + al.toFixed(3) + ') ' + (ph / 2).toFixed(2) + 'px,rgba(0,0,0,0) ' + ph.toFixed(2) + 'px)';
    } else sl.style.display = 'none';
  }
  function setFilter(el, css) { if (el.dataset.coF !== css) { el.dataset.coF = css; el.style.filter = css; } }
  function apply(id) {
    var T = A.state(), css = cssOf(id);
    U.css[id] = css;
    if (id === 'video') { T.deck.forEach(function (v) { setFilter(v, css); }); layers(U.targets.video); }
    else paintLayers(T.t);
  }
  function applyAll() { Object.keys(U.css).concat(Object.keys(U.targets)).forEach(function (k, i, a) { if (a.indexOf(k) === i) apply(k); }); if (!U.targets.video) apply('video'); }
  function ensureCube(g) {
    var src = g && g.lut && g.lut.src;
    if (!src || U.cubes[src] || U.cubeLoading[src]) return;
    U.cubeLoading[src] = true;
    fetch(A.url(src)).then(function (r) { return r.ok ? r.text() : A.api('/api/file?path=' + encodeURIComponent(src)).then(function (d) { return d.text; }); })
      .then(function (t) { U.cubes[src] = parseCube(t); applyAll(); scopeSoon(); if (U.cur != null) A.refresh(); }).catch(function () {});
  }
  function parseCube(t) {
    var size = 0, min = [0, 0, 0], max = [1, 1, 1], d = [];
    t.split(/\r?\n/).forEach(function (ln) {
      ln = ln.replace(/#.*/, '').trim();
      if (!ln) return;
      var p = ln.split(/\s+/), k = p[0].toUpperCase();
      if (k === 'LUT_3D_SIZE') size = +p[1];
      else if (k === 'DOMAIN_MIN') min = p.slice(1).map(Number);
      else if (k === 'DOMAIN_MAX') max = p.slice(1).map(Number);
      else if (/^[-+.\d]/.test(k) && p.length === 3) d.push(+p[0], +p[1], +p[2]);
    });
    if (!size || d.length !== size * size * size * 3) throw new Error('LUT no válida');
    return { size: size, min: min, max: max, data: new Float32Array(d) };
  }

  // ---------- objetivos ----------
  function layerAt(sel) {                    // una capa de vídeo/imagen -> su objetivo
    var T = A.state(), f = T.fx[sel.id];
    if (!f || f.kind !== 'el') return null;
    if (f.libre) return libType(f) === 'image' || libType(f) === 'video' ? 'lib:' + f.id : null;
    return U.media[f.id] ? 'el:' + f.id : null;
  }
  function libType(f) {
    if (f.type) return f.type;
    var p = A.state().plugins.filter(function (x) { return x.id === 'libres'; })[0], d = p && p.data && p.data();
    var it = d && (d.items || []).filter(function (x) { return x.id === f.id; })[0];
    return it && it.type;
  }
  function targetOf(sel) {
    if (!sel) return null;
    var T = A.state();
    if (sel.type === 'seg') return 'video';
    if (sel.type === 'fx') return layerAt(sel);
    if (sel.type === 'grp') {                // tocada en la vista previa: la capa de ese grupo que se ve ahora
      var hit = null;
      T.fx.forEach(function (f, i) {
        if (hit != null || f.kind !== 'el' || U.groupOf[f.id] !== sel.id) return;
        var r = A.fxRange(f);
        if (r && T.t >= r[0] && T.t < r[1]) hit = i;
      });
      return hit == null ? null : layerAt({ id: hit });
    }
    return null;
  }
  function allTargets() {
    var T = A.state(), out = [['video', 'Vídeo']];
    T.fx.forEach(function (f, i) { var t = f.kind === 'el' && layerAt({ id: i }); if (t) out.push([t, f.label || f.id]); });
    return out;
  }
  function name(id) { var m = allTargets().filter(function (x) { return x[0] === id; })[0]; return m ? m[1] : id; }
  function mediaOf(id) {                     // el elemento img/video del objetivo en la vista previa
    var T = A.state();
    if (id === 'video') return T.deck[T.vi];
    var fid = id.slice(id.indexOf(':') + 1), g = U.groupOf[fid];
    var root = id.indexOf('el:') === 0 ? g && T.el.ov.querySelector('.cp-g[data-g="' + g + '"] .cp-in') : T.el.ov.querySelector('.lb-l[data-lb="' + fid + '"] .lb-in');
    return root ? (/^(IMG|VIDEO)$/.test(root.tagName) ? root : root.querySelector('img,video')) : null;
  }
  function paintLayers(t) {
    var T = A.state();
    Object.keys(U.css).forEach(function (id) {
      if (id === 'video') return;
      var el = mediaOf(id), f = T.fx.filter(function (x) { return x.kind === 'el' && x.id === id.slice(id.indexOf(':') + 1); })[0], r = f && A.fxRange(f);
      if (el) setFilter(el, r && t >= r[0] && t < r[1] ? U.css[id] : (el.dataset.coF ? '' : el.style.filter));
    });
  }

  // ---------- valores: "adjust.exposure", "wheels.shadows.level", "sec.0.key.hue.center"... ----------
  function G(make) { var g = U.targets[U.cur]; if (!g && make) g = U.targets[U.cur] = blank(); return g || blank(); }
  function secAt(g, i) { return g.secondaries[+i]; }
  function spec(k) {
    var p = k.split('.'), s = p[0];
    if (s === 'adjust') {
      var r = E.gradeRanges[p[1]];
      return { min: r.min, max: r.max, step: .01, f: p[1] === 'exposure' ? function (v) { return (v > 0 ? '+' : '') + v.toFixed(2) + ' EV'; } : sgn };
    }
    if (s === 'details') return { min: p[1] === 'vignetteRoundness' ? -1 : 0, max: 1, step: .01, f: p[1] === 'vignetteRoundness' ? sgn : pct };
    if (s === 'effects') return U.ep[p[1]];
    if (s === 'wheels') return { min: -1, max: 1, step: .01, f: sgn };
    if (s === 'sec') {
      var q = p.slice(2).join('.');
      if (q === 'key.hue.center') return { min: 0, max: 359.9, step: .1, f: deg(1) };
      if (q === 'key.hue.range' || q === 'key.hue.softness') return { min: 0, max: 180, step: 1, f: deg(1) };
      if (/softness$/.test(q)) return { min: 0, max: .5, step: .01, f: pct };
      if (/^key/.test(q)) return { min: 0, max: 1, step: .01, f: pct };
      if (q === 'correction.hueShift') return { min: -180, max: 180, step: 1, f: deg(1) };
      return { min: -1, max: 1, step: .01, f: sgn };
    }
    return { min: 0, max: 1, step: .01, f: pct };
  }
  function getv(k) {
    var p = k.split('.'), s = p[0], g = G();
    if (s === 'intensity') return eff(g).intensity;
    if (s === 'adjust' || s === 'details' || s === 'effects') return eff(g)[s][p[1]];
    if (s === 'wheels') return (g.wheels[p[1]] || {})[p[2]] || 0;
    if (s === 'lut') return g.lut ? (g.lut.intensity == null ? 1 : g.lut.intensity) : 1;
    if (s === 'sec') { var o = secAt(g, p[1]); p.slice(2).forEach(function (x) { o = o[x]; }); return o; }
    return 0;
  }
  function setv(k, v) {
    var p = k.split('.'), s = p[0], g = G(true);
    if (s === 'intensity') {
      var d = g.preset && PRE[g.preset] ? PRE[g.preset].intensity : 1;
      if (Math.abs(v - d) < 1e-5) delete g.intensity; else g.intensity = v;
    } else if (s === 'adjust' || s === 'details' || s === 'effects') {
      if (Math.abs(v - base(g, s, p[1])) < 1e-5) delete g[s][p[1]]; else g[s][p[1]] = v;
    } else if (s === 'wheels') {
      var w = g.wheels[p[1]] = g.wheels[p[1]] || { hue: 0, amount: 0, level: 0 };
      w[p[2]] = v;
    } else if (s === 'lut') {
      if (g.lut) g.lut.intensity = v;
    } else if (s === 'palette') {
      if (g.palette) g.palette[+p[1]] = String(v).toLowerCase();
    } else if (s === 'sec') {
      var o = secAt(g, p[1]), L = p.length - 1;
      p.slice(2, L).forEach(function (x) { o = o[x]; });
      o[p[L]] = v;
      if (p.slice(2).join('.') === 'key.hue.range') {       // rango + suavidad no pasa de 180
        o.softness = Math.min(o.softness, 180 - v);
        var sl = A.state().el.insp.querySelector('[data-k="sec.' + p[1] + '.key.hue.softness"]');
        if (sl) sl.value = o.softness;
      }
    }
  }
  function resetKey(k) {
    var p = k.split('.'), s = p[0], g = G(true);
    if (s === 'intensity') delete g.intensity;
    else if (s === 'adjust' || s === 'details' || s === 'effects') delete g[s][p[1]];
    else if (s === 'wheels') setv(k, 0);
    else if (s === 'lut') setv(k, 1);
    else if (s === 'sec') setv(k, dflSec(k));
  }
  function dflSec(k) {
    var q = k.split('.').slice(2).join('.');
    return /softness$/.test(q) ? (q === 'key.hue.softness' ? 0 : .05) : q === 'key.hue.range' ? 180 : /\.max$/.test(q) ? 1 : 0;
  }
  function touch() { A.touched('color'); apply(U.cur); scopeSoon(); matteSoon(); }
  function mem() { var n = Date.now(); if (n - U.lastMem > 800) A.remember(); U.lastMem = n; }
  function label(k) {
    var T = A.state(), sp = T.el.insp.querySelector('[data-cov="' + k + '"]');
    if (sp) sp.textContent = spec(k).f(getv(k));
  }

  // ---------- panel ----------
  function sl(k, lab) {
    var s = spec(k), v = getv(k);
    return '<div class="tl-row co-r"><label title="Doble clic: restablecer" data-cok="' + k + '">' + lab + '</label><input type="range" class="st-sl" data-p="color" data-k="' + k + '" min="' + s.min + '" max="' + s.max + '" step="' + s.step + '" value="' + v + '"><span class="v" data-cov="' + k + '">' + s.f(v) + '</span></div>';
  }
  function presets(g) {
    return '<div class="co-grid">' + E.gradePresets.map(function (p) {
      var on = (g.preset || 'neutral') === p.id, th = U.thumb[p.id];
      return '<button class="co-pre' + (on ? ' on' : '') + '" data-p="color" data-b="preset" data-id="' + p.id + '" title="' + A.esc(p.label) + '">' + (th ? '<img src="' + th + '" data-th="' + p.id + '">' : '<u data-th="' + p.id + '"></u>') + '<span>' + A.esc(PRES[p.id] || p.label) + '</span></button>';
    }).join('') + '</div>' + '<div style="height:6px"></div>' + sl('intensity', 'Intensidad');
  }
  function lutBody(g) {
    var src = g.lut && g.lut.src;
    return '<div class="tl-acts"><button data-p="color" data-b="lut-up">Subir .cube</button>' + (src ? '<button data-p="color" data-b="lut-del" class="warn">Quitar</button>' : '') + '</div>' +
      (src ? '<div class="co-note">' + A.esc(src.split('/').pop()) + (U.cubes[src] ? ' · se ve aproximada; exacta en Ver resultado' : ' · cargando…') + '</div>' + sl('lut.intensity', 'Intensidad') : '<div class="co-note">Una LUT 3D en formato .cube, hasta 64 de lado.</div>');
  }
  function wheelBody(g) {
    return '<div class="co-wheels">' + E.wheelZones.map(function (z) {
      var o = g.wheels[z] || { hue: 0, amount: 0, level: 0 }, a = o.hue * Math.PI / 180;
      return '<div class="co-wz"><div class="co-wl">' + ZONE[z] + '</div><div class="co-wh" data-z="' + z + '" title="Arrastra: tono y cantidad · Doble clic: restablecer"><i style="left:' + (50 + Math.sin(a) * o.amount * 50) + '%;top:' + (50 - Math.cos(a) * o.amount * 50) + '%"></i></div>' +
        '<div class="co-wv" data-cow="' + z + '">' + wheelTxt(o) + '</div><input type="range" class="st-sl" title="Nivel" data-p="color" data-k="wheels.' + z + '.level" min="-1" max="1" step="0.01" value="' + o.level + '"><div class="co-wv">Nivel <span data-cov="wheels.' + z + '.level">' + sgn(o.level) + '</span></div></div>';
    }).join('') + '</div>';
  }
  function wheelTxt(o) { return Math.round(o.hue) + '° · ' + Math.round(o.amount * 100) + ' %'; }
  function tabs(list, cur, act, labels) { return '<div class="co-tabs">' + list.map(function (k) { return '<button class="' + (k === cur ? 'on' : '') + '" data-p="color" data-b="' + act + '" data-c="' + k + '">' + labels[k] + '</button>'; }).join('') + '</div>'; }
  function curveBody() {
    return tabs(E.curveChannels, U.curveCh, 'curve-ch', CH) + '<svg class="co-cv c" viewBox="0 0 256 256" data-kind="c" data-ch="' + U.curveCh + '">' + curveInner('c', U.curveCh) + '</svg>' +
      '<div class="co-note">Arrastra un punto. Doble clic añade (hasta 16) o quita. Alt+clic quita.</div><div class="tl-acts"><button data-p="color" data-b="curve-reset">Restablecer canal</button></div>';
  }
  function hueBody() {
    return tabs(E.hueCurves, U.hueCh, 'hue-ch', HUE) + '<svg class="co-cv h" viewBox="0 0 360 130" preserveAspectRatio="none" data-kind="h" data-ch="' + U.hueCh + '">' + curveInner('h', U.hueCh) + '</svg>' +
      '<div class="co-note">Doble clic añade un punto (hasta 16), arrastra para cambiar ese tono. Aproximado en vivo; exacto en Ver resultado.</div><div class="tl-acts"><button data-p="color" data-b="hue-reset">Restablecer curva</button></div>';
  }
  function hueRange(ch) { return ch === 'hueVsHue' ? 180 : 1; }
  function curveInner(kind, ch) {
    var g = G(), s = '', i, pts, col = CURVE_COL[ch] || '#e5e5e5';
    if (kind === 'c') {
      pts = g.curves[ch] || [[0, 0], [1, 1]];
      for (i = 1; i < 4; i++) s += '<path d="M' + i * 64 + ' 0V256M0 ' + i * 64 + 'H256" stroke="#2a2a2a" stroke-width="1"/>';
      s += '<path d="M0 256L256 0" stroke="#333" stroke-width="1"/>';
      var t = bakeCurve(pts), d = '';
      for (i = 0; i < 256; i += 3) d += (i ? 'L' : 'M') + i * 256 / 255 + ' ' + (256 - t[i] * 256).toFixed(1);
      s += '<path d="' + d + 'L256 ' + (256 - t[255] * 256).toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="1.6"/>';
      pts.forEach(function (q, n) { s += '<circle data-i="' + n + '" cx="' + q[0] * 256 + '" cy="' + (256 - q[1] * 256) + '" r="5" fill="#111" stroke="' + col + '" stroke-width="1.6"/>'; });
      return s;
    }
    pts = g.hueCurves[ch] || [];
    var R = hueRange(ch), yOf = function (v) { return 60 - v / R * 56; };
    for (i = 0; i < 12; i++) s += '<rect x="' + i * 30 + '" y="120" width="31" height="10" fill="hsl(' + (i * 30 + 15) + ' 85% 50%)"/>';
    s += '<path d="M0 60H360" stroke="#444" stroke-width="1"/>';
    if (pts.length >= 3) {
      var h = bakeHue(pts, -R, R), dd = '';
      for (i = 0; i <= 256; i += 4) dd += (i ? 'L' : 'M') + (i / 256 * 360).toFixed(1) + ' ' + yOf(h[i % 256]).toFixed(1);
      s += '<path d="' + dd + '" fill="none" stroke="#e5e5e5" stroke-width="1.4" vector-effect="non-scaling-stroke"/>';
    }
    pts.forEach(function (q, n) { s += '<ellipse data-i="' + n + '" cx="' + q[0] + '" cy="' + yOf(q[1]) + '" rx="5" ry="3.6" fill="#111" stroke="#e5e5e5" stroke-width="1.3" vector-effect="non-scaling-stroke"/>'; });
    return s;
  }
  function secBody(g) {
    var ss_ = g.secondaries, i = Math.min(U.secI, Math.max(0, ss_.length - 1)), s = ss_[i], h = '<div class="co-tabs">';
    ss_.forEach(function (x, n) { h += '<button class="' + (n === i ? 'on' : '') + '" data-p="color" data-b="sec-sel" data-i="' + n + '">' + (n + 1) + '</button>'; });
    h += '<button data-p="color" data-b="sec-add" ' + (ss_.length >= 4 ? 'disabled' : '') + ' title="Añadir selección de color">+</button>' + (s ? '<button data-p="color" data-b="sec-del" title="Quitar esta selección">−</button>' : '') + '</div>';
    if (!s) return h + '<div class="co-note">Corrige un solo color (la piel, el cielo...) sin tocar el resto. Hasta 4.</div>';
    var P = 'sec.' + i + '.';
    h += '<div class="tl-row"><label>Activa</label><input type="checkbox" data-p="color" data-k="secon" data-i="' + i + '"' + (s.enabled !== false ? ' checked' : '') + '></div>';
    h += '<div class="tl-acts"><button data-p="color" data-b="sec-sample">Elegir color del vídeo</button>' + (U.sample ? '<button data-p="color" data-b="sec-matte" class="' + (U.matte ? 'on' : '') + '">Ver zona afectada</button>' : '') + '</div>';
    if (U.sample) h += U.matte ? '<canvas class="co-matte" width="' + U.sample.w + '" height="' + U.sample.h + '"></canvas>' : '<img class="co-samp" src="' + U.sample.url + '" title="Toca un color para elegirlo" draggable="false">';
    if (U.sample && !U.matte) h += '<div class="co-note">Toca un color de la imagen: se elige con un clic.</div>';
    h += '<div class="tl-sub"><h4>Qué color</h4>' + sl(P + 'key.hue.center', 'Tono') + sl(P + 'key.hue.range', 'Rango') + sl(P + 'key.hue.softness', 'Suavidad') + sl(P + 'key.saturation.min', 'Sat. mín.') + sl(P + 'key.saturation.max', 'Sat. máx.') + sl(P + 'key.saturation.softness', 'Suav. sat.') + sl(P + 'key.luma.min', 'Luma mín.') + sl(P + 'key.luma.max', 'Luma máx.') + sl(P + 'key.luma.softness', 'Suav. luma') + '</div>';
    h += '<div class="tl-sub"><h4>Cómo queda</h4>' + sl(P + 'correction.hueShift', 'Tono') + sl(P + 'correction.saturation', 'Saturación') + sl(P + 'correction.luma', 'Luma') + sl(P + 'correction.temperature', 'Temperatura') + sl(P + 'correction.tint', 'Tinte') + '</div>';
    return h + '<div class="co-note">Aproximado en vivo; exacto en Ver resultado.</div>';
  }
  function finBody() {
    return '<div class="tl-sub" style="margin-top:0;padding-top:0;border:0"><h4>Viñeta</h4>' + sl('details.vignette', 'Cantidad') + sl('details.vignetteMidpoint', 'Punto medio') + sl('details.vignetteRoundness', 'Redondez') + sl('details.vignetteFeather', 'Difuminado') + '</div>' +
      '<div class="tl-sub"><h4>Grano</h4>' + sl('details.grain', 'Cantidad') + sl('details.grainSize', 'Tamaño') + sl('details.grainRoughness', 'Rugosidad') + '</div>' + (U.cur !== 'video' ? '<div class="co-note">En una capa, viñeta y grano se ven en Ver resultado.</div>' : '');
  }
  function fxBody(f, fam) {
    return Object.keys(EFX).filter(function (k) { return E.effectMeta[k].family === fam; }).map(function (k) {
      var x = EFX[k], on = f.effects[k] > 1e-4, h = '<div class="co-fx' + (on ? ' on' : '') + '"><div class="co-fxh"><b title="' + A.esc(E.effectMeta[k].label) + '">' + x.n + '</b><button data-p="color" data-b="fx" data-k="' + k + '">' + (on ? 'Quitar' : 'Activar') + '</button></div>';
      if (on) {
        h += sl('effects.' + k, x.m);
        (x.s || []).forEach(function (s) {
          if (Array.isArray(s)) { h += sl('effects.' + s[0], s[1]); return; }
          var v = f.effects[s.k];
          if (s.t) h += '<div class="tl-row"><label>' + s.l + '</label><input type="checkbox" data-p="color" data-k="effects.' + s.k + '"' + (v > .5 ? ' checked' : '') + '></div>';
          else h += '<div class="tl-row"><label>' + s.l + '</label><select data-p="color" data-k="effects.' + s.k + '">' + s.o.map(function (l, n) { return '<option value="' + n + '"' + (Math.round(v) === n ? ' selected' : '') + '>' + l + '</option>'; }).join('') + '</select></div>';
        });
        if (!x.live || (U.cur !== 'video' && k === 'scanlines')) h += '<div class="co-note">Se ve en Ver resultado.</div>';
      }
      return h + '</div>';
    }).join('');
  }
  function palBody(g) {
    var groups = {};
    E.palettes.forEach(function (p) { (groups[p.group] = groups[p.group] || []).push(p); });
    var cur = g.palette ? E.palettes.filter(function (p) { return p.colors.join() === g.palette.join(); })[0] : null;
    return '<div class="tl-row"><label>Paleta</label><select data-p="color" data-k="pal"><option value="">Predeterminada</option>' + (g.palette && !cur ? '<option value="-" selected>Personalizada</option>' : '') + Object.keys(groups).map(function (n) {
      return '<optgroup label="' + A.esc(PALG[n] || n) + '">' + groups[n].map(function (p) { return '<option value="' + p.id + '"' + (cur === p ? ' selected' : '') + '>' + A.esc(PAL[p.label] || p.label) + '</option>'; }).join('') + '</optgroup>';
    }).join('') + '</select></div>' +
      (g.palette ? '<div class="co-sw">' + g.palette.map(function (c, i) { return '<input type="color" value="' + c + '" data-p="color" data-k="palette.' + i + '">'; }).join('') + (g.palette.length < 6 ? '<button data-p="color" data-b="pal-add" title="Añadir color">+</button>' : '') + (g.palette.length > 2 ? '<button data-p="color" data-b="pal-del" title="Quitar el último">−</button>' : '') + '</div>' : '<div class="tl-acts"><button data-p="color" data-b="pal-new">Crear paleta</button></div>') +
      '<div class="co-note">La usan Píxeles con trama, Trama de un color, ASCII, Grabado y Dibujo a rayas. Se ve en Ver resultado.</div>';
  }
  function scopeBody() {
    return tabs(['histo', 'wave', 'parade', 'vector'], U.scope, 'scope-tab', { histo: 'Histograma', wave: 'Onda', parade: 'RGB', vector: 'Vector' }) + '<canvas class="co-sc" width="320" height="140"></canvas>' +
      '<div class="tl-acts"><button data-p="color" data-b="scope-refresh">Actualizar</button></div><div class="co-note">Se actualizan solos al reproducir y al cambiar el color.</div>';
  }
  function panel(id) {
    U.cur = id;
    var g = U.targets[id] || blank(), f = eff(g), opts = allTargets().filter(function (x) { return x[0] !== id; }), nFx = function (fam) { var n = Object.keys(EFX).filter(function (k) { return E.effectMeta[k].family === fam && f.effects[k] > 1e-4; }).length; return n ? ' · ' + n : ''; };
    var h = '<div class="tl-sub"><h4>Color · ' + A.esc(name(id)) + (id === 'video' ? ' (toda la pista)' : '') + '</h4><div class="tl-acts"><button class="co-hold" title="Mantén pulsado para comparar">Mantén para ver el original</button><button data-p="color" data-b="reset">Restablecer</button></div>' +
      (opts.length ? '<div class="tl-row"><label>Copiar a</label><select class="co-copyto">' + opts.map(function (o) { return '<option value="' + A.esc(o[0]) + '">' + A.esc(o[1]) + '</option>'; }).join('') + '</select><button data-p="color" data-b="copy">Copiar</button></div>' : '') + '</div>';
    h += A.section('co-scopes', 'Medidores', scopeBody(), false);
    h += A.section('co-pre', 'Filtros', presets(g));
    h += A.section('co-adj', 'Luz y color', Object.keys(E.gradeAdjust).map(function (k) { return sl('adjust.' + k, ADJ[k]); }).join(''));
    h += A.section('co-lut', 'Filtro propio (LUT)' + (g.lut ? ' · activa' : ''), lutBody(g), false);
    h += A.section('co-wheels', 'Color por zonas', wheelBody(g), false);
    h += A.section('co-curves', 'Curvas', curveBody(), false);
    h += A.section('co-hue', 'Cambiar por tono', hueBody(), false);
    h += A.section('co-sec', 'Cambiar un color' + (g.secondaries.length ? ' · ' + g.secondaries.length : ''), secBody(g), false);
    h += A.section('co-fin', 'Viñeta y grano', finBody(), false);
    FAM.forEach(function (x) { h += A.section('co-fam-' + x[0], 'Efectos de imagen: ' + x[1] + nFx(x[0]), fxBody(f, x[0]), false); });
    h += A.section('co-pal', 'Paleta', palBody(g), false);
    requestAnimationFrame(afterPanel);
    return h;
  }
  function afterPanel() {                    // lo que necesita estar ya en la página: lienzos y miniaturas
    if (U.cur == null) return;
    drawScope();
    drawMatte();
    thumbs();
  }

  // ---------- fotogramas: visores, miniaturas y muestreo ----------
  function grab(id, w, h) {                  // ImageData del objetivo a w x h (recortado como lo enseña la vista previa)
    var el = mediaOf(id);
    if (!el) return null;
    var vw = el.videoWidth || el.naturalWidth, vh = el.videoHeight || el.naturalHeight;
    if (!vw || !vh || (el.readyState != null && el.readyState < 2)) return null;
    var s = Math.max(w / vw, h / vh), sw = w / s, sh = h / s;
    if (!U.cv) { U.cv = document.createElement('canvas'); U.ctx = U.cv.getContext('2d', { willReadFrequently: true }); }
    U.cv.width = w; U.cv.height = h;
    try { U.ctx.drawImage(el, (vw - sw) / 2, (vh - sh) / 2, sw, sh, 0, 0, w, h); return U.ctx.getImageData(0, 0, w, h); } catch (e) { return null; }
  }
  function analyse() {
    var W = 135, H = 240, im = grab(U.cur, W, H);
    if (!im) return false;
    var c = comp(U.targets[U.cur] || blank()), d = im.data, p = [0, 0, 0], a = { w: W, histo: [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)], wave: new Uint32Array(W * 128), par: new Uint32Array(W * 128 * 3), vec: new Uint32Array(128 * 128) };
    for (var y = 0, o = 0; y < H; y++) for (var x = 0; x < W; x++, o += 4) {
      p[0] = d[o] / 255; p[1] = d[o + 1] / 255; p[2] = d[o + 2] / 255;
      if (!U.hold) pixel(c, p);
      var l = luma(p[0], p[1], p[2]);
      a.histo[0][Math.round(p[0] * 255)]++; a.histo[1][Math.round(p[1] * 255)]++; a.histo[2][Math.round(p[2] * 255)]++; a.histo[3][Math.round(l * 255)]++;
      a.wave[x * 128 + 127 - Math.round(l * 127)]++;
      for (var k = 0; k < 3; k++) a.par[k * W * 128 + x * 128 + 127 - Math.round(p[k] * 127)]++;
      a.vec[(127 - Math.round(clamp((p[0] - l) / 1.5748 + .5, 0, 1) * 127)) * 128 + Math.round(clamp((p[2] - l) / 1.8556 + .5, 0, 1) * 127)]++;
    }
    U.ana = a;
    return true;
  }
  function plot(g, data, off, cols, rows, x0, wd, H, rgb) {  // densidad -> brillo
    var mx = 1, i;
    for (i = 0; i < cols * rows; i++) if (data[off + i] > mx) mx = data[off + i];
    var im = g.createImageData(cols, rows), lm = Math.log2(mx + 1);
    for (var c = 0; c < cols; c++) for (var r = 0; r < rows; r++) {
      var v = data[off + c * rows + r];
      if (!v) continue;
      var o = (r * cols + c) * 4;
      im.data[o] = rgb[0]; im.data[o + 1] = rgb[1]; im.data[o + 2] = rgb[2]; im.data[o + 3] = 60 + 195 * Math.log2(v + 1) / lm;
    }
    var t = document.createElement('canvas'); t.width = cols; t.height = rows; t.getContext('2d').putImageData(im, 0, 0);
    g.imageSmoothingEnabled = false;
    g.drawImage(t, x0, 0, wd, H);
  }
  function drawScope() {
    var T = A.state(), cv = T.el.insp.querySelector('.co-sc');
    if (!cv) return;
    if (!U.ana && !analyse()) return;
    var g = cv.getContext('2d'), W = cv.width, H = cv.height, a = U.ana, i;
    g.globalCompositeOperation = 'source-over';
    g.fillStyle = '#0b0b0b'; g.fillRect(0, 0, W, H);
    g.strokeStyle = '#222'; g.lineWidth = 1;
    for (i = 1; i < 4; i++) { g.beginPath(); g.moveTo(0, i * H / 4 + .5); g.lineTo(W, i * H / 4 + .5); g.stroke(); }
    if (U.scope === 'histo') {
      var mx = 1;
      for (var c = 0; c < 4; c++) for (i = 1; i < 255; i++) if (a.histo[c][i] > mx) mx = a.histo[c][i];
      g.globalCompositeOperation = 'lighter';
      ['#ef4444', '#22c55e', '#3b82f6', '#777777'].forEach(function (col, k) {
        g.fillStyle = col; g.globalAlpha = k === 3 ? .55 : .8;
        g.beginPath(); g.moveTo(0, H);
        for (var n = 0; n < 256; n++) g.lineTo(n / 255 * W, H - Math.min(1, a.histo[k][n] / mx) * (H - 2));
        g.lineTo(W, H); g.closePath(); g.fill();
      });
      g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
    } else if (U.scope === 'wave') plot(g, a.wave, 0, a.w, 128, 0, W, H, [226, 232, 240]);
    else if (U.scope === 'parade') {
      [[248, 113, 113], [74, 222, 128], [96, 165, 250]].forEach(function (col, k) { plot(g, a.par, k * a.w * 128, a.w, 128, k * W / 3, W / 3, H, col); });
    } else {
      var sz = H, xo = (W - sz) / 2;
      g.strokeStyle = '#333'; g.beginPath(); g.arc(W / 2, H / 2, sz / 2 - 2, 0, Math.PI * 2); g.moveTo(W / 2, 0); g.lineTo(W / 2, H); g.moveTo(xo, H / 2); g.lineTo(xo + sz, H / 2); g.stroke();
      plot(g, a.vec, 0, 128, 128, xo, sz, H, [110, 231, 183]);
    }
  }
  function scopeOpen() { var T = A.state(); return T.secs['co-scopes'] === true && U.cur != null && T.el.insp.querySelector('.co-sc'); }
  function scopeNow() { if (scopeOpen() && analyse()) drawScope(); }
  function scopeSoon() { clearTimeout(U.scopeT); U.scopeT = setTimeout(scopeNow, 90); }
  function thumbs() {
    var T = A.state();
    if (T.playing || T.secs['co-pre'] === false || !T.el.insp.querySelector('[data-th]')) return;
    var key = (T.deck[T.vi].dataset.clip || '') + ':' + Math.round(T.t * 2) + ':' + U.cur;
    if (U.thumbKey === key) return;
    var im = grab(U.cur, 64, 34);
    if (!im) return;
    U.thumbKey = key;
    var t = document.createElement('canvas'), x = t.getContext('2d'), out = x.createImageData(64, 34), p = [0, 0, 0];
    t.width = 64; t.height = 34;
    E.gradePresets.forEach(function (pr) {
      var c = comp({ preset: pr.id, intensity: pr.intensity, adjust: {}, details: {}, effects: {} });
      for (var o = 0; o < im.data.length; o += 4) {
        p[0] = im.data[o] / 255; p[1] = im.data[o + 1] / 255; p[2] = im.data[o + 2] / 255;
        pixel(c, p);
        out.data[o] = p[0] * 255; out.data[o + 1] = p[1] * 255; out.data[o + 2] = p[2] * 255; out.data[o + 3] = 255;
      }
      x.putImageData(out, 0, 0);
      U.thumb[pr.id] = t.toDataURL('image/jpeg', .8);
      var n = T.el.insp.querySelector('[data-th="' + pr.id + '"]');
      if (n) { if (n.tagName === 'IMG') n.src = U.thumb[pr.id]; else { var i = document.createElement('img'); i.src = U.thumb[pr.id]; i.dataset.th = pr.id; n.replaceWith(i); } }
    });
  }
  function sample() {                        // el fotograma tal como le llega a las secundarias
    var w = 135, h = 240, im = grab(U.cur, w, h);
    if (!im) { A.toast('Coloca el cursor donde se vea este vídeo y vuelve a probar.', true); return; }
    var c = comp(U.targets[U.cur] || blank()), f = new Float32Array(w * h * 3), p = [0, 0, 0], d = im.data;
    for (var o = 0, n = 0; o < d.length; o += 4, n += 3) {
      p[0] = d[o] / 255; p[1] = d[o + 1] / 255; p[2] = d[o + 2] / 255;
      prim(c, p); adv(c, p); hueC(c, p);
      f[n] = p[0]; f[n + 1] = p[1]; f[n + 2] = p[2];
      d[o] = p[0] * 255; d[o + 1] = p[1] * 255; d[o + 2] = p[2] * 255;
    }
    U.ctx.putImageData(im, 0, 0);
    U.sample = { w: w, h: h, px: f, url: U.cv.toDataURL('image/jpeg', .85) };
    U.matte = false;
  }
  function pick(ev, img) {                   // el clic elige: media de 5x5 píxeles, como Studio
    var s = U.sample, r = img.getBoundingClientRect(), cx = Math.floor((ev.clientX - r.left) / r.width * s.w), cy = Math.floor((ev.clientY - r.top) / r.height * s.h), u = 0, v = 0, st = 0, lu = 0, n = 0;
    for (var y = Math.max(0, cy - 2); y <= Math.min(s.h - 1, cy + 2); y++) for (var x = Math.max(0, cx - 2); x <= Math.min(s.w - 1, cx + 2); x++) {
      var o = (y * s.w + x) * 3, R = clamp(s.px[o], 0, 1), G_ = clamp(s.px[o + 1], 0, 1), B = clamp(s.px[o + 2], 0, 1), hs = rgb2hsv(R, G_, B), a = hs[0] * Math.PI * 2;
      u += Math.cos(a) * hs[1]; v += Math.sin(a) * hs[1]; st += hs[1]; lu += luma(R, G_, B); n++;
    }
    if (!n) return;
    var g = G(true), sec = g.secondaries[Math.min(U.secI, g.secondaries.length - 1)], b = st / n, l = lu / n, cen = (Math.atan2(v, u) * 180 / Math.PI + 360) % 360;
    A.remember();
    sec.key = { hue: b < .02 ? { center: 0, range: 180, softness: 0 } : { center: cen, range: 18, softness: 12 }, saturation: { min: clamp(b - .2, 0, 1), max: clamp(b + .2, 0, 1), softness: .1 }, luma: { min: clamp(l - .2, 0, 1), max: clamp(l + .2, 0, 1), softness: .1 } };
    U.matte = true;
    touch(); A.refresh();
  }
  function drawMatte() {
    var T = A.state(), cv = T.el.insp.querySelector('.co-matte'), g = U.targets[U.cur], s = U.sample;
    if (!cv || !g || !s || !g.secondaries.length) return;
    var key = g.secondaries[Math.min(U.secI, g.secondaries.length - 1)].key, x = cv.getContext('2d'), im = x.createImageData(s.w, s.h);
    for (var o = 0, n = 0; n < s.px.length; o += 4, n += 3) {
      var m = maskOf(key, s.px[n], s.px[n + 1], s.px[n + 2]) * 255;
      im.data[o] = im.data[o + 1] = im.data[o + 2] = m; im.data[o + 3] = 255;
    }
    x.putImageData(im, 0, 0);
  }
  function matteSoon() { if (!U.matte) return; clearTimeout(U.matteT); U.matteT = setTimeout(drawMatte, 40); }

  // ---------- gestos: ruedas, curvas y botón de comparar ----------
  function wheelDrag(wh, e) {
    e.preventDefault();
    var z = wh.dataset.z, r = wh.getBoundingClientRect(), g = G(true), lab = wh.parentNode.querySelector('[data-cow]'), dot = wh.firstElementChild;
    A.remember();
    function mv(ev) {
      var x = (ev.clientX - r.left - r.width / 2) / (r.width / 2), y = (ev.clientY - r.top - r.height / 2) / (r.height / 2), am = Math.min(1, Math.sqrt(x * x + y * y)), hu = (Math.atan2(x, -y) * 180 / Math.PI + 360) % 360;
      var w = g.wheels[z] = g.wheels[z] || { hue: 0, amount: 0, level: 0 };
      w.hue = Math.round(hu * 10) / 10; w.amount = r4(am);
      var a = w.hue * Math.PI / 180;
      dot.style.left = (50 + Math.sin(a) * am * 50) + '%'; dot.style.top = (50 - Math.cos(a) * am * 50) + '%';
      lab.textContent = wheelTxt(w);
      touch();
    }
    function up() { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); }
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
    mv(e);
  }
  function cvPts(kind, ch, make) {
    var g = G(make);
    if (kind === 'c') { if (make && !g.curves[ch]) g.curves[ch] = [[0, 0], [1, 1]]; return g.curves[ch] || [[0, 0], [1, 1]]; }
    if (make && !g.hueCurves[ch]) g.hueCurves[ch] = [[0, 0], [120, 0], [240, 0]];
    return g.hueCurves[ch] || [];
  }
  function cvPos(sv, kind, ch, e) {          // ratón -> [x, y] del dato y en píxeles de pantalla
    var r = sv.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height;
    if (kind === 'c') return { x: clamp(x, 0, 1), y: clamp(1 - y, 0, 1), rx: r.width, ry: r.height };
    var R = hueRange(ch);
    return { x: clamp(x, 0, .9997) * 360, y: clamp((60 - y * 130) / 56, -1, 1) * R, rx: r.width, ry: r.height };
  }
  function cvHit(sv, pts, kind, ch, e) {
    var r = sv.getBoundingClientRect(), best = -1, bd = 11;
    pts.forEach(function (q, i) {
      var px = kind === 'c' ? q[0] * r.width : q[0] / 360 * r.width, py = kind === 'c' ? (1 - q[1]) * r.height : (60 - q[1] / hueRange(ch) * 56) / 130 * r.height;
      var d = Math.sqrt(Math.pow(e.clientX - r.left - px, 2) + Math.pow(e.clientY - r.top - py, 2));
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  }
  function cvDown(sv, e) {
    var kind = sv.dataset.kind, ch = sv.dataset.ch, pts = cvPts(kind, ch), i = cvHit(sv, pts, kind, ch, e);
    if (i < 0) return;
    e.preventDefault();
    if (e.altKey) { cvRemove(sv, kind, ch, i); return; }
    A.remember();
    pts = cvPts(kind, ch, true);
    var moved = false;
    function mv(ev) {
      var p = cvPos(sv, kind, ch, ev), q = pts[i], N = pts.length;
      moved = true;
      if (kind === 'c') {
        if (i > 0 && i < N - 1) q[0] = r4(clamp(p.x, pts[i - 1][0] + .005, pts[i + 1][0] - .005));
        q[1] = r4(p.y);
      } else {
        q[0] = Math.round(clamp(p.x, i > 0 ? pts[i - 1][0] + .5 : 0, i < N - 1 ? pts[i + 1][0] - .5 : 359.5) * 10) / 10;
        q[1] = r4(p.y);
      }
      sv.innerHTML = curveInner(kind, ch);
      touch();
    }
    function up() { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (!moved) A.state().hist.pop(); }
    addEventListener('pointermove', mv); addEventListener('pointerup', up);
  }
  function cvRemove(sv, kind, ch, i) {
    var pts = cvPts(kind, ch, true);
    if (kind === 'c' ? (i === 0 || i === pts.length - 1) : pts.length <= 3) return;
    A.remember();
    pts.splice(i, 1);
    sv.innerHTML = curveInner(kind, ch);
    touch();
  }
  function cvAdd(sv, e) {                    // doble clic: añade, o quita si es encima de un punto
    var kind = sv.dataset.kind, ch = sv.dataset.ch, hit = cvHit(sv, cvPts(kind, ch), kind, ch, e);
    if (hit >= 0) return cvRemove(sv, kind, ch, hit);
    A.remember();
    var pts = cvPts(kind, ch, true), p = cvPos(sv, kind, ch, e);
    if (pts.length >= 16) { A.toast('Hasta 16 puntos por curva.', true); return; }
    if (pts.some(function (q) { return Math.abs(q[0] - p.x) < (kind === 'c' ? .01 : 1); })) return;
    pts.push([kind === 'c' ? r4(p.x) : Math.round(p.x * 10) / 10, r4(p.y)]);
    pts.sort(function (a, b) { return a[0] - b[0]; });
    sv.innerHTML = curveInner(kind, ch);
    touch();
  }
  function inspEvents() {
    var T = A.state(), insp = T.el.insp;
    insp.addEventListener('pointerdown', function (e) {
      var h = e.target.closest('.co-hold'), wh = e.target.closest('.co-wh'), cv = e.target.closest('.co-cv');
      if (h) {
        e.preventDefault();
        U.hold = true; h.classList.add('on'); applyAll(); scopeNow();
        var up = function () { removeEventListener('pointerup', up); removeEventListener('pointercancel', up); U.hold = false; var n = T.el.insp.querySelector('.co-hold'); if (n) n.classList.remove('on'); applyAll(); scopeNow(); };
        addEventListener('pointerup', up); addEventListener('pointercancel', up);
      } else if (wh) wheelDrag(wh, e);
      else if (cv) cvDown(cv, e);
    });
    insp.addEventListener('dblclick', function (e) {
      var wh = e.target.closest('.co-wh'), cv = e.target.closest('.co-cv'), lb = e.target.closest('[data-cok]'), rg = e.target.closest('input[type=range][data-p=color]');
      if (cv) { e.preventDefault(); cvAdd(cv, e); return; }
      if (wh) {
        A.remember();
        delete G(true).wheels[wh.dataset.z];
        touch(); A.refresh();
      } else if (lb || rg) {
        var k = lb ? lb.dataset.cok : rg.dataset.k;
        A.remember(); resetKey(k); touch();
        var inp = T.el.insp.querySelector('input[data-k="' + k + '"]');
        if (inp) inp.value = getv(k);
        label(k);
      }
    });
    insp.addEventListener('click', function (e) { var im = e.target.closest('.co-samp'); if (im) pick(e, im); });
    insp.addEventListener('toggle', function (e) {
      var s = e.target.dataset && e.target.dataset.sec;
      if (s === 'co-scopes' && e.target.open) { U.ana = null; scopeSoon(); }
      if (s === 'co-pre' && e.target.open) thumbs();
    }, true);
    T.deck.forEach(function (v) {
      var again = function () { U.thumbKey = null; if (U.cur != null) { thumbs(); scopeSoon(); } };
      v.addEventListener('seeked', again); v.addEventListener('loadeddata', again);
    });
  }

  // ---------- acciones ----------
  function act(b) {
    var k = b.dataset.b, g, cur = U.cur;
    if (k === 'scope-tab') { U.scope = b.dataset.c; A.refresh(); return; }
    if (k === 'scope-refresh') { U.ana = null; scopeNow(); return; }
    if (k === 'curve-ch') { U.curveCh = b.dataset.c; A.refresh(); return; }
    if (k === 'hue-ch') { U.hueCh = b.dataset.c; A.refresh(); return; }
    if (k === 'sec-sel') { U.secI = +b.dataset.i; A.refresh(); return; }
    if (k === 'sec-matte') { U.matte = !U.matte; A.refresh(); return; }
    if (k === 'sec-sample') { sample(); A.refresh(); return; }
    if (k === 'lut-up') { lutUpload(); return; }
    A.remember();
    g = G(true);
    if (k === 'preset') {                    // como en Studio: el preset sustituye todo menos la LUT
      var id = b.dataset.id, n = blank();
      if (g.lut) n.lut = g.lut;
      if (id !== 'neutral') { n.preset = id; n.intensity = PRE[id].intensity; }
      U.targets[cur] = n;
    } else if (k === 'fx') {
      var fx = b.dataset.k;
      if (eff(g).effects[fx] > 1e-4) {
        Object.keys(E.effectInit[fx]).forEach(function (x) { delete g.effects[x]; });
        (EFX[fx].s || []).forEach(function (s) { delete g.effects[Array.isArray(s) ? s[0] : s.k]; });
        if (base(g, 'effects', fx) > 1e-4) g.effects[fx] = 0;
      } else {
        Object.keys(E.effectInit[fx]).forEach(function (x) { setv('effects.' + x, E.effectInit[fx][x]); });
      }
    } else if (k === 'sec-add') {
      if (g.secondaries.length < 4) {
        g.secondaries.push({ enabled: true, key: { hue: { center: 0, range: 180, softness: 0 }, saturation: { min: 0, max: 1, softness: .05 }, luma: { min: 0, max: 1, softness: .05 } }, correction: { hueShift: 0, saturation: 0, luma: 0, temperature: 0, tint: 0 } });
        U.secI = g.secondaries.length - 1;
        A.state().secs['co-sec'] = true;
      }
    } else if (k === 'sec-del') {
      g.secondaries.splice(Math.min(U.secI, g.secondaries.length - 1), 1);
      U.secI = Math.max(0, U.secI - 1); U.matte = false;
    } else if (k === 'lut-del') delete g.lut;
    else if (k === 'curve-reset') delete g.curves[U.curveCh];
    else if (k === 'hue-reset') delete g.hueCurves[U.hueCh];
    else if (k === 'pal-new') g.palette = ['#000000', '#ffffff'];
    else if (k === 'pal-add') { if (g.palette.length < 6) g.palette.push('#808080'); }
    else if (k === 'pal-del') { if (g.palette.length > 2) g.palette.pop(); }
    else if (k === 'reset') U.targets[cur] = blank();
    else if (k === 'copy') {
      var to = A.state().el.insp.querySelector('.co-copyto').value;
      U.targets[to] = copy(g);
      ensureCube(U.targets[to]);
      apply(to);
      A.toast('Color copiado a ' + name(to) + '.');
    }
    U.ana = null;
    touch(); A.refresh();
  }
  function lutUpload() {
    var inp = document.createElement('input');
    inp.type = 'file'; inp.accept = '.cube';
    inp.onchange = function () {
      var f = inp.files[0];
      if (!f) return;
      f.text().then(function (txt) {
        var cube = parseCube(txt);                         // no se sube si no se puede leer
        return fetch('/api/upload?name=' + encodeURIComponent(f.name), { method: 'POST', body: f }).then(function (r) {
          return r.json().then(function (d) { if (!r.ok) throw new Error(d.error || r.status); return d; });
        }).then(function (d) {
          A.remember();
          U.cubes[d.path] = cube;
          G(true).lut = { src: d.path, intensity: 1 };
          touch(); A.refresh();
        });
      }).catch(function (e) { A.toast('No se pudo usar esa LUT: ' + e.message, true); });
    };
    inp.click();
  }
  function clean(g) {                        // solo lo que difiere de neutro (o de su preset)
    var o = {}, f = eff(g), p = g.preset && PRE[g.preset];
    if (g.preset) o.preset = g.preset;
    if (Math.abs(f.intensity - (p ? p.intensity : 1)) > 1e-4) o.intensity = r4(f.intensity);
    ['adjust', 'details', 'effects'].forEach(function (s) {
      var m = {};
      Object.keys(g[s] || {}).forEach(function (k) { if (Math.abs(g[s][k] - base(g, s, k)) > 1e-5) m[k] = r4(g[s][k]); });
      if (Object.keys(m).length) o[s] = m;
    });
    var w = {};
    E.wheelZones.forEach(function (z) { var x = (g.wheels || {})[z]; if (x && (Math.abs(x.amount) > 1e-4 || Math.abs(x.level) > 1e-4)) w[z] = { hue: x.hue, amount: r4(x.amount), level: r4(x.level) }; });
    if (Object.keys(w).length) o.wheels = w;
    var c = {};
    E.curveChannels.forEach(function (k) { if (isCurve((g.curves || {})[k])) c[k] = copy(g.curves[k]); });
    if (Object.keys(c).length) o.curves = c;
    var h = {};
    E.hueCurves.forEach(function (k) { if (isHue((g.hueCurves || {})[k])) h[k] = copy(g.hueCurves[k]); });
    if (Object.keys(h).length) o.hueCurves = h;
    var sc = (g.secondaries || []).filter(function (s) { return Object.keys(s.correction).some(function (k) { return Math.abs(s.correction[k]) > 1e-4; }) || s.key.hue.range < 180 || s.key.saturation.min > 0 || s.key.saturation.max < 1 || s.key.luma.min > 0 || s.key.luma.max < 1; });
    if (sc.length) o.secondaries = copy(sc).map(function (s) {
      ['hue', 'saturation', 'luma'].forEach(function (q) { Object.keys(s.key[q]).forEach(function (x) { s.key[q][x] = r4(s.key[q][x]); }); });
      return s;
    });
    if (g.lut) o.lut = { src: g.lut.src, intensity: r4(g.lut.intensity == null ? 1 : g.lut.intensity) };
    if (g.palette) o.palette = g.palette.slice();
    return o;                                // (copias: quien lo lea no toca el estado)
  }
  function load(g) {                         // lo guardado -> la forma interna, con todos los contenedores
    var n = Object.assign(blank(), copy(g));
    ['adjust', 'details', 'effects', 'wheels', 'curves', 'hueCurves'].forEach(function (k) { n[k] = n[k] || {}; });
    n.secondaries = n.secondaries || [];
    E.curveChannels.forEach(function (k) {   // el motor añade los extremos si faltan; aquí se ven y se pueden mover
      var p = n.curves[k];
      if (!p) return;
      if (p[0][0] > 0) p.unshift([0, 0]);
      if (p[p.length - 1][0] < 1) p.push([1, 1]);
    });
    n.secondaries.forEach(function (s) { if (s.enabled == null) s.enabled = true; });
    return n;
  }

  Timeline.use({
    id: 'color',
    init: function (api, input, saved) {
      if (!window.ESQUEMA) return false;
      A = api; E = window.ESQUEMA;
      NEUT = { adjust: E.gradeAdjust, details: E.gradeDetails, effects: E.gradeEffects };
      E.gradePresets.forEach(function (p) { PRE[p.id] = p; });
      U = { targets: {}, css: {}, filters: {}, nf: 0, cubes: {}, cubeLoading: {}, media: {}, groupOf: {}, thumb: {}, cur: null, curveCh: 'master', hueCh: 'hueVsHue', secI: 0, scope: 'histo', lastMem: 0, ep: {}, hold: false };
      Object.keys(EFX).forEach(function (k) {   // la ficha de cada parámetro de efecto
        var x = EFX[k];
        U.ep[k] = { min: 0, max: x.max || 1, step: .01, f: x.f || pct };
        (x.s || []).forEach(function (s) { if (Array.isArray(s)) U.ep[s[0]] = { min: s[2] == null ? 0 : s[2], max: s[3] == null ? 1 : s[3], step: s[4] || .01, f: s[5] || pct }; });
      });
      if (!document.getElementById('co-style')) { var st = document.createElement('style'); st.id = 'co-style'; st.textContent = CSS; document.head.appendChild(st); }
      U.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      U.svg.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
      A.state().el.root.appendChild(U.svg);
      var t = (saved || {}).targets || {};
      Object.keys(t).forEach(function (id) { U.targets[id] = load(t[id]); ensureCube(U.targets[id]); });
      inspEvents();
      A.api('/api/edicion').then(function (d) {   // qué capas de capas.json llevan imagen o vídeo
        var gs = ((d.capas || {}).input || {}).groups || [];
        gs.forEach(function (g) { (g.items || []).forEach(function (it) { if (it.el) { U.groupOf[it.el] = g.id; if (/<(img|video)\b/i.test(it.html || '')) U.media[it.el] = true; } }); });
        applyAll();
        if (U.cur != null || A.state().sel) A.refresh();
      }).catch(function () {});
      applyAll();
      return true;
    },
    designExtra: function (sel) {
      var id = targetOf(sel);
      if (!id) { U.cur = null; return ''; }
      if (U.cur !== id) { U.ana = null; U.sample = null; U.matte = false; U.thumbKey = null; }
      return panel(id);
    },
    paint: function (t) {
      paintLayers(t);
      var T = A.state();
      if (T.playing && U.lay && U.targets.video && !U.hold) { var gr = U.lay.children[1]; if (gr.style.display !== 'none') gr.style.backgroundPosition = Math.floor(Math.random() * 128) * 3 + 'px ' + Math.floor(Math.random() * 128) * 3 + 'px'; }
    },
    onTick: function () { var n = Date.now(); if (n - (U.scopeAt || 0) > 250) { U.scopeAt = n; scopeNow(); } },
    onStop: function () { scopeSoon(); U.thumbKey = null; if (U.cur != null) thumbs(); },
    helpExtra: function () { return '<b>Color:</b> elige un clip o una capa de vídeo o imagen; abajo salen filtros, luz y color, curvas y efectos. La vista previa es aproximada: el botón Ver resultado enseña el resultado exacto.<br>'; },
    onClick: function (b) { if (b.dataset.b) act(b); },
    onInput: function (el) {
      var k = el.dataset.k;
      if (!k || el.tagName === 'SELECT' || el.type === 'checkbox') return;
      mem();
      setv(k, el.type === 'color' ? el.value : +el.value);
      if (k.indexOf('palette') !== 0) label(k);
      U.ana = null;
      touch();
    },
    onChange: function (el) {
      var k = el.dataset.k;
      if (!k) return;
      if (k === 'secon') {
        A.remember();
        secAt(G(true), el.dataset.i).enabled = el.checked;
      } else if (k === 'pal') {
        A.remember();
        var p = E.palettes.filter(function (x) { return x.id === el.value; })[0];
        if (p) G(true).palette = p.colors.slice();
        else if (el.value === '') delete G(true).palette;
        touch(); A.refresh();
        return;
      } else if (el.tagName === 'SELECT' || el.type === 'checkbox') {
        A.remember();
        setv(k, el.type === 'checkbox' ? (el.checked ? 1 : 0) : +el.value);
      } else return;
      U.ana = null;
      touch();
    },
    snap: function () { return copy(U.targets); },
    restore: function (v) { U.targets = copy(v); U.sample = null; U.matte = false; U.ana = null; Object.keys(U.targets).forEach(function (id) { ensureCube(U.targets[id]); }); applyAll(); },
    data: function () {
      var out = {};
      Object.keys(U.targets).forEach(function (id) { var o = clean(U.targets[id]); if (Object.keys(o).length) out[id] = o; });
      return { targets: out };
    }
  });
})();
