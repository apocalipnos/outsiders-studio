---
name: mi-estudio
description: Abre el estudio de edición de vídeo dejando elegir entre el Studio Picker de video-studio (catálogo completo) y Mi Estudio (página propia solo con los estilos, subtítulos y efectos que el usuario ha filtrado). También es el paso de revisión de cada edición con video-studio — subtítulos, efectos y línea de tiempo para corregir cortes y colocar efectos — antes del render. Úsala cuando el usuario diga "abre el estudio", "abre mi estudio", "quiero elegir estilo/subtítulos/efectos", "abre el picker", "quiero ajustar los cortes", "abre la línea de tiempo", y siempre que edites un vídeo con video-studio ("edítalo", "edit it"). También para crear o guardar formatos de vídeo (visual + estructura) a partir de reels de referencia: "guarda el formato X", "crea el formato X", "te paso enlaces de un formato".
---

# Mi Estudio

## Abrir el estudio (sin vídeo)

Al activarse por "abre el estudio", pregunta primero con AskUserQuestion (una sola pregunta, sin texto previo):

- **Mi Estudio**: solo lo que tiene filtrado. Se edita desde la propia página con "Editar mi estudio".
- **Studio Picker**: el catálogo completo de video-studio.

Lee `%LOCALAPPDATA%\video-studio\.platform.json`: `PY` = su `python`, `SK` = su `skill_dir`. Si no existe, ejecuta antes el setup de video-studio (`python "<SK>/scripts/setup.py"`).

`<MI>` = la carpeta de esta skill (el "Base directory for this skill" que sale al cargarla), con barras `/`. Cambia
con cada versión del plugin: no la copies de un proyecto anterior. Las preferencias del usuario viven fuera, en
`%LOCALAPPDATA%\mi-estudio\` (`DATA`): `filtro.json`, `eleccion-formato.json` y los formatos que cree (`formatos/`).

- Mi Estudio: `PY "<MI>/mi_estudio.py" --until-saved`
- Studio Picker: `PY "SK/scripts/picker.py" --until-saved`

Lánzalo siempre en segundo plano (`run_in_background`) y di en una línea: "Te he abierto <nombre> en el navegador. Elige y pulsa Guardar." Si el navegador no se abre solo, da la URL de la línea `STATUS picker READY`.

Los dos guardan en el mismo `studio-picks.json` de video-studio (ruta `picks` de `.platform.json`). Al ver `STATUS picks SAVED`, lee ese archivo y confirma en una frase lo elegido. Ojo: un estilo guardado (`my_styles.py`, p. ej. el estilo por defecto) manda sobre estos picks; si tiene uno, pregunta en una línea si quiere guardar la selección como estilo: `PY "SK/scripts/my_styles.py" save "<nombre>" --from-picks`.

## Formatos

Un formato = **visual** (conjunto de elementos visuales concretos) + **estructura** (forma específica de organizar el
contenido). Ej.: tierlist, reacción 50/50. Los que trae el plugin están en `<MI>/formatos/<key>/` y los que crea el
usuario en `DATA/formatos/<key>/` (si se repite la key, manda el suyo). Cada uno es una carpeta así:
- `formato.json`: `key`, `name`, `line`, `visual` [frases], `estructura` [pasos], `refs`, `preview`, `poster` (lo que
  enseña la pestaña Formatos).
- `estado` en `formato.json` (chip en la tarjeta): `receta` (sin validar: aún no ha salido bien en un vídeo real),
  `validado` (la receta ya funcionó, falta programarla), `programado` (hay script fijo, sale igual siempre). Criterio
  acordado: todo formato entra como receta; tras el primer vídeo real bueno pasa a validado (pregúntale al usuario);
  se programa cuando se vaya a usar 3+ veces o para una serie de un cliente. Actualiza el estado al cambiar.
- `formato.md`: la ficha de construcción para editar (medidas, colores, animaciones, sonido, reglas de corte, qué
  escribir en `timeline.json`). Es lo que lees antes de editar un vídeo en ese formato.
- `preview.mp4` (~9 s, 540 px, sin audio) y `poster.jpg`, sacados de una referencia.

**Crear un formato** ("guarda el formato X" + enlaces):
Escríbelo siempre en `DATA/formatos/<key>/`, nunca dentro de `<MI>` (el plugin se reemplaza al actualizar). Para
compartirlo con el equipo hay que copiarlo al repo del plugin (ver su README).
1. Mira cada referencia con la skill watch (`watch.py <url> --no-scene-change --max-frames 30`: con ffmpeg 9 la
   detección de planos falla por `-vsync`). Lee frames y transcripción.
2. Saca lo común a todas: visual (posiciones en 1080x1920, colores, tipografía, cuándo aparece cada cosa) y
   estructura (bloques que se repiten, hook, cierre).
3. Pregunta con AskUserQuestion solo lo que las referencias no deciden (de dónde salen imágenes, variantes, título…),
   con una opción recomendada.
4. Escribe `formato.json` y `formato.md` (sin marca: la marca depende del cliente), y `preview.mp4` / `poster.jpg`
   con ffmpeg desde la referencia más representativa. Respeta la zona segura de video-studio aunque la referencia no.

## Editar un vídeo: revisión en Mi Estudio antes del render

En TODA edición con video-studio Mi Estudio se abre DOS veces: antes de cortar (formato, subtítulos, efectos) y
después del primer corte (línea de tiempo). Sigue el workflow de video-studio con estos cambios:

0. **Antes de cortar nada**, en cuanto el usuario dice "edítalo": abre en segundo plano
   `PY "<MI>/mi_estudio.py" --preparar --until-saved` y di en una línea:
   "Te he abierto Mi Estudio: elige formato, subtítulos y efectos y pulsa Empezar a editar." Si nombró un
   formato en su mensaje, escríbelo antes en `DATA/eleccion-formato.json` para que salga ya marcado. No empieces a
   cortar hasta ver `STATUS preparar SAVED formato=<key|none> captions=... effects=...`. Mientras espera puedes
   adelantar `ingest.py` (no depende del formato), pero no escribas `edl.json`.
   Al verlo: el formato es el de esa línea (también en `DATA/eleccion-formato.json`); los subtítulos y efectos quedan
   en los picks globales (el proyecto los hereda). Si hay formato, lee su `formato.md` antes de cortar y aplica
   sus reglas de corte y encuadre. Escribe `<proyecto>/formato.json` = `{"formato": "<key>"}` (o null).
1. Pasos 1-3 de video-studio como siempre: `ingest.py`, escribir `edl.json`, `assemble.py`. Si graba en
   español: transcribe con Whisper multilingüe (language es), no con los modelos `.en` del Studio.
2. Propón dónde va cada efecto: con los picks del proyecto (`<proyecto>/picks.json`, o si no existe los globales) y el texto de cada fragmento (`line` en `edl.json`), escribe `<proyecto>/timeline.json`:
   `{"effects": [{"key": "<efecto>", "from": <seg>, "to": <seg>}]}` en segundos del montaje (suma de duraciones de `edl.json`), un efecto como mucho una vez, sobre la frase que encaje. Sin efectos elegidos: `{"effects": []}`.
   Con formato, añade `"elementos": [{"id", "label", "from", "to"}]` como diga su `formato.md` (p. ej. tierlist: un
   elemento por cosa clasificada, de cuando se nombra a cuando se da el veredicto). Salen en la pista "Formato".
3. Abre la revisión en segundo plano: `PY "<MI>/mi_estudio.py" --project "<proyecto>" --until-saved`. Di en una línea: "Ya tienes el primer corte en Mi Estudio: ajusta la pestaña Edición y pulsa Procesar vídeo." (se abre directamente en Edición; las otras pestañas siguen disponibles para cambiar algo) No sigas hasta ver `STATUS timeline SAVED`. Para retocar capas, encuadre o audio de un vídeo ya montado se abre igual: TODO ajuste fino va en la pestaña Edición, nunca en una ventana suelta (ver "Pestaña Edición").
4. Al ver `STATUS timeline SAVED ... edl=changed|same ...`:
   - `edl=changed`: vuelve a correr `assemble.py` (los cortes nuevos están en `edl.json`; los anteriores en `edl_prev.json`).
   - Sigue con los pasos 4-6 de video-studio (transcribe_cut, marks, layout, init_project). Si volviste a
     transcribir y existe `edicion/subtitulos.json`, después de limpiar `words.json` corre
     `edicion.reaplicar_subtitulos(proj)` (vuelve a poner los subtítulos que el usuario reescribió; ver "Pestaña Edición").
   - `textos=...` en la línea STATUS (p. ej. `textos=title:1,subtitulos:2`): el usuario cambió textos en Edición. Los
     subtítulos ya están en `words.json`; los de los demás grupos los lee el script del plan con `edicion.texto()`:
     vuelve a correrlo antes de construir.
   - Efectos: los de `timeline.json` van exactamente en su `from`/`to` (`fx_new.py <key> --project <proyecto> --from <from> --to <to>`, luego `fx_add.py`). Efectos de `picks.json` que no están en `timeline.json`: colócalos tú donde encajen.
   - Subtítulos y efectos son los de `<proyecto>/picks.json`: construye con `build_reel.py "<proyecto>" --no-my-style --picks "<proyecto>/picks.json"` y no dejes un bloque `"caption"` en `plan.json` (lo sobrescribiría).
   - **Estilo guardado elegido** (`"myStyle": "<slug>"` en los picks; la línea STATUS dice `estilo=<slug>`): el vídeo va en ese estilo. `init_project.py "<proyecto>" --my-style "<slug>"` y construye con `build_reel.py "<proyecto>" --my-style "<slug>" --picks "<proyecto>/picks.json"` (subtítulos, capas y css del estilo; efectos de los picks). Lee su `style.md` antes de cortar. Elegirlo en la página es la indicación de marca para ese vídeo.
   - Marca: depende del cliente. Por defecto NO metas marca ni capas de un estilo guardado (Semáforo incluido) en `plan.json`; solo si el usuario indica la marca o el cliente para ese vídeo.
   - Formato: lee `<proyecto>/formato.json` (el usuario puede haberlo cambiado en la página). Si hay formato,
     construye su visual según `formatos/<key>/formato.md` como capas, motion y sonidos de `plan.json`, usando los
     `elementos` de `timeline.json` tal como los dejó el usuario. Si cambió de formato en la página y la
     estructura grabada no encaja, díselo en una línea antes de renderizar.
   - `edicion=<ids>`: el usuario tocó esas herramientas de Edición; vuelve a correr lo que las lee (el script del
     plan para `capas`, la mezcla para `audio`) antes de renderizar. Con solo `audio` cambiado basta con volver a
     mezclar sobre el último render, sin renderizar de nuevo.
   - Render y comprobaciones como en video-studio (sonido incluido).
5. Si después del render el usuario quiere retocar cortes, efectos, capas, encuadre o volúmenes, repite desde el paso 3 con el mismo proyecto.

En la línea de tiempo el usuario puede recortar bordes, **partir un fragmento en el cursor** (S o ✂: para quitar un
trozo del centro parte dos veces y quita el del medio) y quitar fragmentos. Un fragmento partido sale en `edl.json`
como dos fragmentos seguidos del mismo clip (el segundo con el id acabado en `b`) y con los mismos campos propios
(`kind`, etc.): el plan del formato tiene que tratar fragmentos seguidos del mismo tipo como uno. Monta siempre
con `overlay_edl.py` (aunque no haya vídeos superpuestos), no con `assemble.py` a secas:
- re-sincroniza el audio corte a corte (si no, se adelanta ~16 ms por corte);
- si el micro graba la voz en un solo canal (p. ej. todo en el derecho), la copia a los dos para que no suene
  solo por un oído;
- aplica `"speed"` por fragmento (`"speed": 1.2` = 20 % más rápido, tono de voz intacto con rubberband). Pregunta
  si quiere sus partes habladas aceleradas (1.2x suele ir bien en vídeos de lista). La línea de tiempo enseña los fragmentos ya acelerados y la vista previa suena a esa velocidad.
  `segments.json` guarda el `speed` de cada fragmento.

### Vídeos superpuestos (clips de ejemplo, b-roll en tarjeta)

Cualquier vídeo que se ve encima del plano del creador (los ganchos de ejemplo de "Tipos de ganchos", un b-roll en
tarjeta...) va como un **fragmento más del montaje**, para que el usuario elija en la línea de tiempo qué trozo se
ve, igual que recorta sus tomas (sale en amarillo, con la onda de su propio audio; no se puede partir):
- Da de alta el vídeo en `sources.json` con un id corto (`"ej7": "<ruta>"`).
- En `edl.json`: `{"id": "xsiete", "clip": "ej7", "in": <s del vídeo>, "out": <s>, "overlay": true, "zoom": 1,
  "cx": .5, "cy": .5, "line": "Ejemplo 7: <su gancho>", "under": {"clip": "c3", "in": <s>, "zoom": .., "cx": .., "cy": ..}}`.
  `under` es el plano del creador que queda debajo (mudo) mientras dura: elige un tramo suyo sin nada raro.
- Montar SIEMPRE con `PY "<MI>/overlay_edl.py" "<proyecto>"` en vez de
  `assemble.py` directo: monta con el plano `under` debajo, re-sincroniza el audio, corta cada vídeo a su trozo en
  `assets/ov/<id>.mp4|.wav` y escribe `work/overlays.json` (`at`/`dur` en el montaje). `edl.json` sigue siendo el
  de Mi Estudio y `segments.json` va en su mismo orden.
- Cómo se ve (tarjeta 9:16 sobre el plano desenfocado, pantalla completa...) y si suena su audio lo pone el plan
  del formato: capa con `"media": {"src": "assets/ov/<id>.mp4", ...}`, sonido `assets/ov/<id>.wav` con `"dur"`, y
  el audio del montaje silenciado en ese tramo. Ejemplo hecho: `<MI>/ejemplos/tipos-ganchos/gen_plan.py`.

### Capas editables (pista "Capas")

TODA capa con tiempo que añadas al `plan.json` (títulos, citas, rótulos, stickers, píldoras, el cambio de título del
CTA...) tiene que poder moverse, estirarse y quitarse en la línea de tiempo como en un editor normal. Para eso el
script del plan calcula el momento de cada una desde el corte real (`segments.json` + palabras) y lo pasa por
`capas.py` antes de escribir la capa:
```python
sys.path.insert(0, '<MI>'); import capas
L = capas.Capas(proj)                            # después de montar
r = L.timed('quote9', 'Cita 9', desde, hasta)    # id estable entre versiones; None = el usuario la quitó
...
L.save()                                         # reescribe timeline.json con todas las capas, ancladas a su toma
```
Si el usuario la movió o estiró en Mi Estudio (`edited`), manda su momento, pegado al segundo de la toma donde la
dejó (sobrevive a recortes); si la quitó (`off`) no se pinta; si no la tocó, se recalcula sola. Los efectos de
video-studio siguen en la pista "Efectos". No escribas `elementos` a mano en `timeline.json`: los escribe `L.save()`.
Abre Mi Estudio después de correr el script del plan, para que la pista Capas esté al día.

## Pestaña Edición (el sitio de todos los ajustes finos)

La pestaña "4 · Edición" de Mi Estudio con proyecto es UNA sola vista, como un editor de vídeo (CapCut): arriba la
vista previa grande con las capas en su sitio (se tocan, se arrastran y el círculo azul de su esquina cambia el
tamaño ahí mismo) y un panel que cambia según lo que tocas; debajo una línea de tiempo con todas las pistas: Vídeo y
voz (recortar, partir), Capas (cuándo sale cada una), Efectos, Música, Efectos de sonido... Encima de la línea de
tiempo, Encuadre (acerca el plano de todos los clips) y en la vista previa la casilla Zona segura. Un separador entre
vista previa y línea de tiempo reparte el alto. El usuario NO quiere pestañas ni ventanas por función (dicho el
2026-10-28: "como una verdadera timeline de CapCut"), y quiere ir añadiendo funciones aquí poco a poco. Un único botón
Procesar vídeo guarda todo.

Recortar es del núcleo (`timeline.js`). Lo demás son módulos de `herramientas/*.js` que se enchufan a esa misma vista
y salen cuando el proyecto trae sus datos en `<proyecto>/edicion/<id>.json`; lo que el usuario deja va a
`<proyecto>/edicion/<id>_edit.json` y la línea STATUS lo dice (`edicion=capas,audio`). Para los scripts del
proyecto, `edicion.py`:
```python
sys.path.insert(0, '<MI>'); import edicion
G = edicion.editado(proj, 'capas', propuesto)   # lo propuesto con lo que el usuario cambió encima, grupo a grupo
edicion.ofrecer(proj, 'capas', {...})           # lo que enseña el módulo (escríbelo cada vez que corre el plan)
edicion.texto(proj, 'title', el, propuesto)     # el texto de un item tal como lo dejó el usuario (ver "Textos")
```

**Capas y encuadre** (`herramientas/capas.js`; `capas.json`, lo escribe el script del plan): `{"video", "grade": <filter
css>, "fonts": ["assets/fonts/fonts.css"], "css": <css del contenido>, "reframe": {"origin": [x, y] de la cara, "default": 1,
"max": 1.4} | null, "groups": [{"id", "label", "kind": "box" | "center", "aspect" (box), "lockX" (center), "words"
(subtítulos), "default", "items": [{"from", "to", "label", "html", "el", "text", "words"}]}]}` ("text" y "words":
ver "Textos de títulos y subtítulos").
- `box`: `{left, top, width}` (alto = ancho / aspect); `center`: `{cx, top, scale}`, centrado en cx y creciendo hacia
  abajo (en el plan: `left:cx; top; transform: translateX(-50%) scale(s); transform-origin: 50% 0`). `lockX` para lo
  que va centrado siempre (subtítulos: `top` -> `"position": top` del caption y `scale` -> `size`).
- El `html` de cada item es el CONTENIDO sin posición (clases propias, p. ej. `tfc-card`), con el css de su aspecto
  en `css`; el plan lo mete dentro de su envoltorio posicionado. Las rutas relativas (`assets/...`) las sirve Mi Estudio.
- `el` = el id de su capa en la pista Capas (`capas.timed(id, ...)`): la vista previa la enseña cuando dice ese
  bloque, y al tocar el bloque el panel trae también su posición y tamaño. Sin `el` (subtítulos) usa from/to.
- Un grupo por cosa que se mueve junta (todas las tarjetas, todos los títulos...); el cambio vale para todo el grupo.
- `capas_edit.json`: `{<grupo>: {...}, "reframe": {"zoom"}}`; el zoom va a `plan["reframe"] = {"zoom": z}`.
- Ejemplo hecho: `<MI>/ejemplos/test-finanzas/gen_plan.py`.

**Textos de títulos y subtítulos** (en el mismo módulo Capas; desde 2026-10-29, para todos los vídeos): al tocar una
capa con texto, el panel trae un campo Texto con el del item que se ve en el cursor (o el del bloque de la pista Capas
que tocaste); con doble clic encima de la capa se escribe en la misma vista previa (Intro termina, Esc deshace, clic
fuera también termina; Ctrl+Z deshace). Arrastrar y redimensionar siguen igual.
- Qué texto se edita de un item: sus elementos con `data-t` del `html` (uno o varios); si no tiene, su `"text"`, y
  si tampoco, su trozo de texto más largo (en `<span class='yn'>1.</span> BIG FISH` es `BIG FISH`, el número no se toca).
  Si tiene varias partes que se escriben aparte (el gancho: título + frase), da a cada una su clave,
  `data-t='hook_h1'` / `data-t='hook_h2'`: el panel saca un campo por parte (Texto 1, Texto 2) y el doble clic edita
  la parte tocada. `data-t` sin valor usa la clave del item. El texto nuevo sustituye a esa parte; el resto conserva
  su estilo.
- Saltos de línea: un `<br>` dentro de una parte `data-t` es `"\n"` en el texto (campo de varias líneas en el panel;
  Mayús+Intro en la vista previa). El plan los vuelve a poner: `.replace('\n', '<br>')`.
- Se guarda al pulsar Procesar vídeo en `capas_edit.json`: `{"<grupo>": {..., "texts": {"<clave>": "<texto nuevo>"}}}`
  (solo los cambiados; clave = la de su `data-t`, o el `el` del item, o su índice si no tiene `el`).
  STATUS: `edicion=capas textos=<grupo>:<n>,...`.
- El script del plan lee cada texto con su valor propuesto por defecto y construye el html con él (así `capas.json`
  y `plan.json` ya salen con el texto nuevo):
  ```python
  name = edicion.texto(proj, 'title', f'title_{k}', name)              # grupo, el (o índice), propuesto
  ph = f"<div class='plat'>{edicion.texto(proj, 'plat', f'plat_{k}', PLAT[k])}</div>"
  h2 = edicion.texto(proj, 'hook', 'hook_h2', 'para cuando...<br>no va...').replace('\n', '<br>')
  hh = f"<span class='ln' data-t='hook_h1'>{h1}</span>...<div class='cine-h2 w' data-t='hook_h2'>{h2}</div>"
  ```
  Ejemplo hecho: `<MI>/ejemplos/7-pelis-vida/gen_plan.py` (gancho de dos partes, títulos, plataformas y subtítulos).
- **Subtítulos**: un grupo con `"words": true` (o con id `subs`) son los subtítulos. Dale a cada item
  `"words": [primera, última]` (índices en `words.json`, inclusive) y que su texto sea esas palabras unidas por
  espacios. Al procesar, Mi Estudio (`edicion.aplicar_subtitulos`) cambia esas palabras en `words.json` manteniendo
  sus tiempos (mismo número de palabras: solo el texto; si cambia, reparte el tramo entre las nuevas y las que siguen
  guardan sus marcas `"e"`), pone el texto nuevo en `capas.json` y lo apunta en `edicion/subtitulos.json`
  (`[{"old", "new", "at"}]`); en `capas_edit.json` ya no queda. Sin `words`, busca esas palabras cerca del `from`
  del item. Tras re-transcribir: `edicion.reaplicar_subtitulos(proj)` (salta los que ya están).
  ```python
  for n, w in enumerate(words): cur.append(dict(w, i=n))   # al partir words.json en frases
  {'id': 'subs', ..., 'words': True, 'items': [dict(it(p[0]['start'], p[-1]['end'] + .3, 'Subtítulos', html),
                                                    words=[p[0]['i'], p[-1]['i']]) for p in phrases]}
  ```

**Audio** (`herramientas/audio.js`; `audio.json`, lo escribe el script de las pistas): `{"video", "stems": [{"id",
"label", "src": "work/mix/<id>.wav", "default": dB}]}`. Cada pista es un wav del montaje entero a ganancia 1 (música
en bucle, efectos...) y sale como pista con su onda; la pista `voice` es la voz de los clips de la vista previa (se
elige tocando el nombre "Vídeo y voz"). `audio_edit.json`: `{<id>: dB}` (-60 = silenciada). La mezcla final se hace
con ffmpeg sobre la imagen del render (sin volver a renderizar). Ejemplo hecho: `<MI>/ejemplos/test-finanzas/stems.py` + `mixdown.py`.

**Añadir una función nueva**: un módulo `herramientas/<id>.js` con `Timeline.use({id, owns: ['<tipo de selección>'],
init(api, input, saved) -> true si hay datos, ...})` y su `<script>` en `index.html`; estilos en `timeline.css`.
Ganchos que puede tener (todos opcionales): `toolbar()` (html junto a Zoom), `tracks()` + `drawTracks(inner)` (pistas
propias; un elemento con `data-pick="<tipo>" data-id` lo elige), `labelExtra(id)`, `paint(t)` (vista previa en el
segundo t; su capa va en `api.state().el.ov`, lienzo de 1080x1920), `inspector(sel)` (panel cuando lo elegido es de su
tipo), `inspectorExtra(sel, f)`, `helpExtra()`, `onClick(btn, e)` / `onInput(el)` (botones e inputs con `data-p="<id>"`),
`key(e)` (true si usó la tecla), `onPlay(t)`, `onStop()`, `onTick(t)`, `snap()` / `restore(v)` (deshacer), `data()` (lo
que va a `<id>_edit.json`). `api`: `state()`, `select(sel)`, `remember()` (antes de cambiar, para deshacer),
`touched(id)` (se guardará), `refresh()` (panel y vista previa), `redraw()` (todo), `stop()`, `fxRange`, `timeToX`,
`xToTime`, `url(ruta)`, `html(html)`, `esc`, `clamp`, `W`, `H`. Mira `herramientas/capas.js` y `audio.js`. Luego
añade aquí qué hace y su formato.

## Imágenes de películas y series (TMDB)

Cuando un formato necesite pósters, fotos o datos de películas, series o actores, usa la API de TMDB en vez de
buscar en la web. Clave en `~/.config/tmdb/.env` (`TMDB_API_KEY`, v3): léela del archivo, nunca la escribas en el
chat ni en archivos del proyecto. Si no existe, dile en una línea que cree una gratis en themoviedb.org (Ajustes > API)
y la guarde ahí. Búsqueda: `https://api.themoviedb.org/3/search/movie|tv|person
?query=...&language=es-ES&api_key=<clave>`; imágenes: `https://image.tmdb.org/t/p/w500<poster_path>` (o `original`).

TMDB solo tiene fotos de los actores hoy. Para personajes en personaje usa los retratos de la wiki fandom de la serie:
`https://<serie>.fandom.com/api.php?action=query&titles=A|B&prop=pageimages&pithumbsize=800&redirects=1&format=json`;
para el original quita `scale-to-width-down/N` pero CONSERVA `?cb=...`, y descarga con
`curl -A "<UA de Chrome>" -e "https://<serie>.fandom.com/"` (sin eso devuelve una página "Just a moment").

## Música en el reel

En `plan.json` "sounds" de video-studio, una pista larga (una canción) necesita `"dur": <segundos>` o el build la
corta a 0,6 s (trata cada sonido como efecto). Si el guion dice "escucha esto", mantén el formato del vídeo con el
plano escuchando y la música al nivel de la voz (~-21 dB); mide el tramo con volumedetect antes del render.

## Archivos

- `mi_estudio.py`: reutiliza el servidor del Picker del plugin (catálogo, vídeos, guardado) y añade la página propia, `/api/filtro` y, con `--project`, la línea de tiempo (copias ligeras de los clips con keyframes densos para previsualizar sin pausas y forma de onda, ambas en `<proyecto>/work/mi-estudio/`, guardado de `edl.json` / `timeline.json` / `picks.json`; `/api/edicion`, `/p/<ruta del proyecto>` y `edicion/<id>_edit.json` para las herramientas de Edición). No modifica nada del plugin.
- `index.html`: la página (pestañas Formatos, Estilos, Subtítulos, Efectos y, con proyecto, Edición).
- `herramientas/*.js`, `edicion.py`: los módulos de la Edición (capas, audio...) y sus datos (ver "Pestaña Edición").
- `formatos/`: los formatos que trae el plugin (ver "Formatos"); los del usuario en `DATA/formatos/`. `DATA/eleccion-formato.json`: formato elegido fuera de un proyecto.
- `timeline.js`, `timeline.css`: la vista de Edición entera (vista previa con capas, panel, línea de tiempo: recortar, partir en el cursor, vídeos superpuestos, capas y efectos en el tiempo) y el enchufe de los módulos (`Timeline.use`).
- `overlay_edl.py`: monta un `edl.json` con vídeos superpuestos y re-sincroniza el audio (ver "Vídeos superpuestos").
- `capas.py`: tiempos de las capas del plan editables desde la pista "Capas" (ver "Capas editables").
- `DATA/filtro.json`: qué estilos, subtítulos y efectos se ven en Mi Estudio (`{"styles": [], "captions": [], "effects": []}`). La primera vez se copia de `<MI>/filtro.json` (valores por defecto del equipo).
- `ejemplos/`: scripts de plan y mezcla de vídeos ya hechos, para copiar a `<proyecto>/work/` y adaptar.
- `estilos/`: estilos guardados del equipo (de momento Ultracinico, el de los vídeos de cine: títulos Barlow con degradado y subtítulos DM Serif amarillos) y sus fuentes (`estilos/fonts/`). Al abrir Mi Estudio se copian a video-studio si el usuario no los tiene (nunca pisan los suyos). No son el estilo por defecto: úsalos solo si el usuario los elige o lo pide. Su ficha está en su `style.md`.
- Estilos guardados de video-studio (`%LOCALAPPDATA%/video-studio/styles/<slug>/`): entran en la pestaña Estilos como
  `mi-<slug>` (en `filtro.json` igual que los demás), leídos de su `style.json` cada vez que se abre la página, así que
  lo que se cambie en el estilo sale solo. Tarjeta: `line` de `style.json` (o el primer párrafo de `style.md`) y la
  primera imagen o vídeo de su carpeta `preview/`. Al elegirlo se guardan picks `custom` + `"myStyle": "<slug>"`.
  Al preparar, el paso "2 · Estilo" va entre Formato y Subtítulos.
