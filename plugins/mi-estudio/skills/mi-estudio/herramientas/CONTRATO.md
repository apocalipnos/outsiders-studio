# Contrato de los módulos de la Edición de Mi Estudio

Mi Estudio copia las funciones de HyperFrames Studio con otra lógica: **todo lo que el usuario toca se guarda como JSON**
(`<proyecto>/edicion/<id>_edit.json`). El `index.html` final se deriva: `aplicar.py` lee esos JSON y los pasa al HTML justo
antes del render. Nunca se edita el HTML desde la página.

## Cómo es un módulo
`herramientas/<id>.js`, se carga solo (el servidor lista la carpeta; `esquema`, `capas` y `audio` van primero, el resto por
nombre) y se registra con `Timeline.use({id, init(api, input, saved){ return true; }, ...})`. Mira `timeline.js` (API al final
del archivo, variable `API`), `herramientas/capas.js` y `herramientas/audio.js`. El módulo que devuelve `true` en `init` queda activo.
`input` es `edicion/<id>.json` (o null), `saved` es `edicion/<id>_edit.json` (o null). Interfaz en español, sin marca.

Ganchos opcionales, todos llamados con `on(...)` a todos los módulos:
- `owns: ['tipo']` + `inspector(sel)`: panel Diseño entero cuando `T.sel.type` es tuyo. `designExtra(sel)`: html que se añade al
  final del panel Diseño para cualquier selección (`sel` puede ser null). `inspectorExtra(sel, f)`: solo para bloques `fx` de la línea.
- `left: {id, label, order, tip}` + `leftRender(el)`: pestaña de la barra lateral. `right: {id, label, count()}` + `rightRender(el)`: pestaña del inspector.
- `view: {id, label}` + `viewRender(el)`: vista central alternativa (botón arriba, junto a Edición).
- `lanes()`: html de pistas nuevas: `<div class="tl-lane"><div class="tl-lab" data-pick="tipo" data-id="x" style="height:Npx"><span class="n">Nombre</span></div><div class="tl-track" style="width:Wpx;height:Npx">...</div></div>` (W = `T.width + 60`). `tracks()` + `drawTracks(inner)`: formato antiguo, y `drawTracks` sirve para pintar canvas de cualquier pista.
- `laneOf(f)` -> `{id, label}`: en qué pista va una capa `f.kind === 'el'`. `labelExtra('voice')`: texto junto a "Vídeo y voz".
- `toolbar()`: html sobre la vista previa (arriba a la derecha). `timelineTools()` y `kfTools()`: html en la barra de la línea de tiempo.
- `paint(t)`: se llama en cada fotograma con el segundo del montaje; tu capa va en `T.el.ov` (lienzo de 1080x1920). `comprobar.js` también lo llama con otros `t` para medir: lo que no sean las capas (mover un vídeo, por ejemplo) solo se hace si `t === T.t`. `onPlay(t)`, `onStop()`, `onTick(t)`, `onHidden(k, oculto)`, `onStrip(clip, tira)`.
- `onClick(btn, e)` / `onInput(el, e)` / `onChange(el, e)`: botones e inputs con `data-p="<id>"` en cualquier sitio de la vista. `key(e)` true si usó la tecla. `copy(e)`, `cut(e)`, `paste(e)`, `razorAll(t)`, `shortcuts()` -> `[['Sección', [['Tecla', 'Qué hace'], ...]]]`.
- `necesita()`: texto si lo que cambió pide volver a montar con Claude (va a `Timeline.razones()`), o nada. `Timeline.razones()` decide Exportar o Procesar: los cortes siguen ahí aunque Ver resultado ya los enseñe, y `resultado.js` filtra su propio aviso.
- `helpExtra()`, `inspectorIdle()`. `snap()` / `restore(v)`: deshacer. `data()`: lo que va a `<id>_edit.json`; se guarda solo si llamaste a `api.touched('<id>')`.

`api` trae: `state()` (T: `t`, `total`, `sel`, `multi`, `segs`, `fx`, `L`, `el`, `deck`, `S`, `pps`, `rate`, `width`, `hidden`, `beats`, `project`...), `select(sel)`, `remember()` (antes de cambiar, para deshacer),
`touched(id)`, `refresh()` (panel derecho y vista previa), `redraw()` (todo), `refreshLeft()`, `stop()`, `seek(t)`, `play()`, `audio()` (`{ctx, master, voice, voiceOut, stems}`),
`section(id, título, html, abierta)` (sección plegable que no se cierra al repintar), `popup(html, ancla, cls)`, `closePopup()`, `isHidden(k)`, `gridSnap(v)`, `snapTime(t)`, `anchor(t)` (-> `{seg, src}`), `fxRange(f)`, `timeToX`, `xToTime`, `showRight(id)`, `showLeft(id)`, `addFx(obj)`, `url(ruta)`, `html(h)`, `esc`, `fmt`, `fmtS`, `clamp`, `ic(nombreIcono)`, `api(url, cuerpo)` (fetch JSON), `toast(msg, err)`, `W`, `H`, `FPS`, `LW`.
Clases ya hechas en `timeline.css`: `.st-sec`, `.tl-row`, `.tl-acts`, `.st-sl` (deslizador), `.st-in` (campo), `.v`, `.help`, `.st-tb` (botón icono), `.on`, `.st-pop`. Estilos propios de cada módulo: inyéctalos desde su `init` con un `<style>` (no toques `timeline.css`).
Colores: `--a` turquesa (activo), `--ad`, `--ag`, `--t1/2/3`, `--b0/1/2`, `--card`, `--card2`. Controles de 11 px, sobrios, como HyperFrames Studio.
En Ver resultado (`.tl-screen.rs-on`) `T.el.ov` queda por encima del vídeo real y lo de dentro de `.cp-in` y `.lb-in` no se ve: solo sirven para cogerlas; `window.MiResultado.rect(<id de capa>)` da dónde está de verdad.
Dos relojes en Ver resultado: `T.t` es la línea de tiempo y el HTML va con el de `assets/aroll.mp4` (`project.segments`, de `segments.json`). Con cortes sin montar no coinciden: `resultado.js` traduce los segundos al buscar y, para `/api/exacta` y `/api/snapshot`, los tiempos de `tiempos`, `libres`, `claves` y `audiofx` (sin `anchor`, y es lo que queda en sus `_edit.json` hasta procesar, cuando llega lo de verdad). Mientras suena, `T.reloj()` lleva el cursor: devuelve el segundo de la línea de tiempo, o null al acabar, y la pareja `T.deck` queda parada.
Vista previa sin pisar otros módulos: `capas.js` reescribe `style.cssText` de `.cp-g` en cada `paint` y `T.el.rf.style.transform/filter`; usa las propiedades CSS sueltas `translate`, `rotate`, `scale`, `opacity` y aplica a `.cp-g[data-g="<id>"] .cp-in` o a cada `video` de `T.deck`.

## Objetivos (a qué se aplica algo)
`video` (pista de vídeo entera), `seg:<id de edl>` (un solo clip: color, estilo y claves; en la vista previa van a `T.el.img` / `.tl-img[data-seg="<id>"]`, la imagen dentro del marco, solo mientras se ve; `api.clipAt(t)` da el clip de un momento y `api.clipNum(id)` su número), `voice` (voz), `sfx` (efectos de sonido), `<stemId>` (pistas de audio.js), `grp:<id>` (grupo de capas de capas.json), `el:<id>` (una capa de `elementos`), `lib:<id>` (capa libre). Los bloques de la pista Sonidos son `T.fx` con `sonido: true`: no son capas (ni animación ni estilo) ni van a `elementos`.
En `T.sel`: `{type:'seg', id}`, `{type:'fx', id:<índice en T.fx>}` (si `T.fx[id].kind==='el'` su id de capa es `T.fx[id].id`, y si `.libre` es capa libre), `{type:'grp', id}`, `{type:'aud', id}`.

## Los JSON (`edicion/<id>_edit.json`)
- `color`: `{"targets": {"video"|"lib:<id>"|"el:<id>": <grading>}}`. `<grading>` es el formato de `data-color-grading` de HyperFrames: `{preset, intensity, adjust:{...}, details:{...}, effects:{...}, wheels, curves, hueCurves, secondaries, lut:{src,intensity}, palette}`, solo con lo que cambie. Nombres y rangos en `window.ESQUEMA`.
- `audiofx`: `{"chains": {"voice"|"sfx"|"<stemId>"|"lib:<id>": {"version":1,"nodes":[{"id":"n1","type":"highpass","label":"...","enabled":true,"params":{...}}]}}, "automation": {"<igual>": {"version":1,"lanes":[{"target":"volume"|"fx.<nodo>.<param>","points":[...]}]}}, "volume": {"voice": dB}}`. Formato de `data-fx-chain` y `data-automation`.
- `claves`: `{"tracks": {"<objetivo>": {"x":[{"t":s,"v":n,"ease":"power2.out","anchor":{"seg":"id de edl","src":s}}], "y":[...], "scale":[...], "rotation":[...], "rotationX":[...], "rotationY":[...], "z":[...], "opacity":[...]}}, "paths": {"<objetivo>": {"arc": true, "autoRotate": false}}}`. `t` en segundos del montaje; `x`/`y` en px respecto a su sitio; `opacity` 0-1; `ease` en sintaxis de GSAP (`window.ESQUEMA.eases[].ease`).
- `estilo`: `{"targets": {"<objetivo>": {"css": {"color":"#fff","font-family":"Anton","font-size":"80px","text-align":"center","opacity":".9","mix-blend-mode":"screen","border-radius":"12px","background":"...","box-shadow":"...","filter":"blur(2px)","-webkit-text-stroke":"2px #000","rotate":"3deg",...}, "crop": {"top":0,"right":0,"bottom":0,"left":0}, "z": 12}}}`. Crop en %, `z` = z-index.
- `libres`: `{"items": [{"id":"lb1","type":"text"|"image"|"video"|"audio"|"block","label":"...","text":"...","src":"assets/...","from":s,"to":s,"anchor":{"seg":"id edl","src":s},"left":px,"top":px,"width":px,"height":px|null,"volume":1,"mediaStart":0,"off":false}]}`. Capas nuevas que no existen en plan.json.
- `capas`: `{"<grupo>": {left, top, width | cx, top, scale, "texts": {...}, "items": {"<el>": {left, top, width | cx, top, scale}}}, "reframe": {"zoom"}}`. `items`: las capas movidas por su cuenta (los subtítulos no). El `input` de capas lo da `edicion.capas_entrada`: `capas.json` más un grupo `subs` con `"auto": true` sacado de `#caps` si no trae subtítulos.
- `sonidos`: `{"items": {"<id de su audio>": {"from","to","anchor","off","db","moved"}}}`: los efectos de sonido uno a uno; el `input` lo saca `mi_estudio.sonidos_entrada` del HTML (`{items: [{id,label,src,from,to,vol}], mezcla}`). Lo aplica `aplicar.py` en cajas `.me-c` (`data-g`, `data-el`, `data-k`, `data-m`: los valores con que se montó, de `edicion.montado`). `resultado.js` cambia esas mismas cajas en vivo.
- `tiempos` (del núcleo): `{"capas": {"<id de capa>": {"from":s,"to":s,"off":false,"anchor":{"seg","src"}}}}`: solo las capas tocadas. `aplicar.py` reescribe sus líneas de la línea de tiempo; `timeline.js` lo vuelve a leer al abrir. Una capa sin tocar (`edited:false`) lleva además `endSeg`/`endSrc` en `T.fx`: `layout()` saca de ahí su `dur`.
- `pistas` (del núcleo): `{"hidden": {"video"|"fx"|"el:<grupo>"|"sfx": true}, "beats": [s], "groups": {"<capa>": "<grupo>"}}`.
- `subtitulos`: `{"words": [{"text","start","end"}]}`: la lista completa de `words.json`; `edicion.aplicar_palabras` la vuelca al guardar.
- `variables`: `{"vars": {"nombre": {"type":"text"|"number"|"color"|"image","value":...}}}`. Los scripts del plan las leen con `edicion.variable(proj, nombre, por_defecto)`.
- `guion`: `{"comments": {"<id edl>": [{"text","done":false}]}, "order": null}`.
- `claude`: `{"peticiones": [{"text","t":s,"target":"...","at":"iso"}]}`: cambios que el usuario le pide a Claude al procesar.

## Peticiones al servidor (`mi_estudio.py`, ya hechas)
GET `/api/files`, `/api/file?path=`, `/api/assets?scope=project|all`, `/api/renders`, `/api/render/status`, `/api/blocks`, `/api/fonts`, `/p/<ruta del proyecto>`.
POST `/api/file {path,text}` (solo .json/.md/.txt, deja historial), `/api/upload?name=` (el cuerpo es el archivo), `/api/assets/import {project,path}`, `/api/renders/delete {name}`, `/api/render {opts:{format,quality,fps,name}, edicion}`, `/api/render/cancel`, `/api/snapshot {t, edicion}` -> `{url}`, `/api/lint`, `/api/blocks/add {name}`. `edicion` = `Timeline.data().edicion`.

## Detalles que cuentan para aplicar.py
- Audio: `anchor` en un punto es nuestro (recalcula `t` si cambió el edl y no llega al HTML). `v` de volumen es ganancia lineal 0-3.981. `t` es del montaje en `voice`, `sfx` y stems, y desde el inicio de la capa en `lib:<id>`.
- Claves: el `ease` de una clave es la curva del tramo que llega a ella; una pista de una sola clave es un valor fijo. Eases: GSAP, `hold`, `custom(M0,0 C...)`, `spring(b)`, `wiggle(n,tipo,amp)`. `el:` manda sobre `grp:` propiedad a propiedad.
- Estilo: `targets[..].ui` solo rellena el panel. Raíz `fonts: {familia: {source, files}}`: las usadas. Texto con `!important`; fusión y `z` en la capa exterior; lo demás y `crop` en la raíz del contenido.
- Libres: `height:null` es alto automático, `volume` 0-2, `off:true` no sale. El texto lleva su estilo en `estilo.targets['lib:<id>'].css`.

## Referencia
HyperFrames Studio de la versión fijada (0.8.34), en la caché de npx: `...\node_modules\hyperframes\dist\studio\assets\index-*.js` (minificado, 4 MB: búscalo con Grep o un script, no lo leas entero) y `...\dist\hyperframe-runtime.js`. Licencia Apache-2.0.
Para probar, usa una COPIA de un proyecto, nunca el original: `python <MI>/mi_estudio.py --project "<copia>" --no-open --port <puerto>`. Con el panel del navegador oculto no corre `requestAnimationFrame`: la reproducción parece parada sin estarlo.
