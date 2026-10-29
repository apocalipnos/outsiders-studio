# Formato: Bracket

Ficha de construcción para el Claude que edita. Sacada de 2 referencias (en `formato.json`) y hecha en un vídeo
real y validado: "Mejor personaje de The Office" (2026-10-25, proyecto en `formato.json` → `ejemplo`, render v2; el
usuario lo dio por bueno). Los scripts
de ese vídeo están en `scripts/` como punto de partida. Sin marca salvo que se indique: título y subtítulos van en el
estilo del reel (en el ejemplo, Ultracinico).

## Estructura (lo que tiene que pasar en el vídeo)

1. **Hook:** la pregunta del vídeo ("¿Quién es el mejor personaje de X?") con el bracket ya lleno.
2. **15 duelos:** una voz fuera de cámara pregunta "¿A o B?" y la persona responde. La pregunta SE OYE (es el
   contenido, no es la voz del apuntador). 8 de primera ronda (lado izquierdo de arriba abajo, luego el derecho),
   4 cuartos, 2 semis, final.
3. **Reacciones:** se dejan las cortas con gracia ("Jim es maravilloso, pero...", "pero me arrepiento"); fuera la
   charla de rodaje, preguntas repetidas y errores del que pregunta (p. ej. un duelo con alguien ya eliminado).
4. **Cierre:** la respuesta de la final. Sin CTA en el ejemplo.

## Antes de cortar: reconstruir el bracket

- Transcribe en español con faster-whisper `medium` y los 16 nombres en el `initial_prompt` (copia
  `work/es_transcribe.py` de un proyecto anterior). La transcripción de corrido se come respuestas de una palabra:
  transcribe también cada tramo con voz por separado (umbral -40 dB, huecos < 0,5 s) para encontrarlas.
- Saca de ahí los 16 cabezas de serie en orden y el ganador de cada duelo; comprueba que cada ganador es el que
  aparece en el duelo siguiente. Si algo no cuadra (repetición, error del que pregunta), quédate con la última toma
  limpia y dilo al usuario.

## Corte (`edl.json`)

- Un fragmento por duelo (pregunta + respuesta), desde 0,05 s antes de la pregunta hasta que cae la respuesta.
  Si la pregunta y la respuesta están en tomas distintas, dos fragmentos.
- El fragmento con la respuesta lleva `"match": "<id>"` y `"pick": <s de la fuente>` (inicio de la palabra de la
  respuesta). Ids: `m1`-`m8` primera ronda, `q1`-`q4` cuartos, `s1`-`s2` semis, `f` final. Ids de fragmento solo
  con letras.
- Fuente de 30 fps: igualmente `scripts/resync.py` tras `assemble.py` (deja audio y vídeo exactos).

## Línea de tiempo (Mi Estudio)

`timeline.json` → `"elementos"`: uno por duelo, `id` = el del fragmento con la respuesta, `label` "✅ <ganador>",
`from` = momento de la respuesta en segundos de la línea de tiempo (suma de duraciones de `edl.json`), `to` = fin
del fragmento. El `from` es cuándo avanza el ganador: el usuario lo ajusta arrastrando. En `gen_plan.py`,
`MATCHES` (ronda, índice, ganador), `SEEDS` (los 16 en orden) y `ASKED_IN` (duelos cuya pregunta empieza en otro
fragmento) se rellenan para cada vídeo.

## Caras

- Personajes de series o películas: retratos promocionales EN PERSONAJE de la wiki fandom de la serie (TMDB solo
  tiene fotos de los actores hoy). API: `https://<serie>.fandom.com/api.php?action=query&titles=A|B|...&prop=pageimages&pithumbsize=800&redirects=1&format=json`;
  descarga el original quitando `scale-to-width-down/N` y CONSERVANDO `?cb=...`, con `curl -A "<UA de Chrome>"
  -e "https://<serie>.fandom.com/"` (sin eso devuelve "Just a moment"). A `work/faces_raw/<clave>.img`.
- Personas reales (actores, cantantes): foto de perfil de TMDB (`/search/person`, `profile_path`).
- Recorte: `scripts/detect_faces.py` (OpenCV en un venv temporal: `opencv-python-headless<5`; la 5 ya no trae Haar)
  escribe `work/face_boxes.json`; luego `scripts/faces.py <proyecto>` (matte RVM + caja de cara; la silueta sola
  falla en poses encorvadas) deja `assets/faces/<clave>.png` 400x400 con borde blanco y `work/faces_sheet.png`.
  MIRA la hoja: corte bajo la barbilla, nada de hombros; `work/faces_fix.json` corrige una cara (`neck`, `dx`, `top`).

## Visual (medidas en el cuadro 1080x1920)

Todo en una capa `bracket` (anchor `full`, todo el vídeo) generada por `scripts/gen_plan.py`:
- Caras `F = 124` px. Primera ronda en x 85 / 995, de y 870 a 1895 (8 filas, paso ~129). Cuartos en x 330 / 750 a
  media altura de su pareja; semis y final en la columna interior x 445 / 635 (la final entre las dos semis).
- **Zona segura:** el bracket llega al borde inferior y bajo los botones de la derecha, como la referencia. Lo eligió
  el usuario el 2026-10-25 (las caras dentro de la zona segura, de 72 px, se veían muy pequeñas).
- Líneas: blancas, 10 px, radio 3, sombra `0 0 8px rgba(0,0,0,.5)`. Primera ronda: salida lateral, unión vertical y
  entrada al hueco de cuartos; cuartos: vertical entre las dos caras y salida al hueco de semis; semis: vertical con
  el finalista encima; final: horizontal entre los dos finalistas.
- Huecos de rondas siguientes ocultos (`opacity 0`) hasta que el ganador entra.

Animación (GSAP en `motion` de la capa, `at` = segundos del reel):
- Inicio de la pregunta: las dos caras `scale 1.1` + brillo `drop-shadow(0 0 16px rgba(255,242,56,.95))`, 0,2 s.
- Respuesta (`pick`): ganador vuelve a `scale 1` sin brillo; perdedor `scale .92, opacity .35`; las líneas del camino
  del ganador a `#FFF238` con brillo; copia del ganador en el siguiente hueco `fromTo scale 0→1`, 0,3 s,
  `back.out(2.5)`.
- Final: el ganador se queda brillando y sube a `scale 1.3` (`back.out(2.2)`, 0,45 s).

Título: capa fija arriba en el estilo del reel. En Ultracinico: degradado `.cine-grad`, H2 a 56 px en y 232 con la
pregunta y H1 "THE OFFICE?" en y 292 (tapa pelo y frente, nunca los ojos).

Subtítulos: el caption del estilo, UNA línea, `position` justo bajo la barbilla más baja (`chin` de `layout.json`
+ 28: el motor los mueve si quedan a menos de 24 px), por encima del bracket. Preguntas con "¿?", la respuesta
marcada `emph` (cursiva en Ultracinico). El motor no corta tras una respuesta de una sola palabra: adelanta su `end`
a 0,31 s antes de la palabra siguiente (ver `work/fix_words.py` del ejemplo).

**Sonido:** `pop.mp3` vol 0.35 en cada avance; `impact-bass-1.mp3` en el campeón a vol ~0.12. Si la respuesta final
es un grito, el golpe satura y el render falla ("AAC true peak remained above -1 dBFS"): mide el pico de la mezcla
antes y baja el golpe hasta que quede por debajo de -1,5 dB. Sin música.
