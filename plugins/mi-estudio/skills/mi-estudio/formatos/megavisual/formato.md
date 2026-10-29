# Formato: Megavisual

Ficha de construcción para el Claude que edita. Sacada de 2 referencias (en `formato.json`) y validada en un vídeo
real: "Subgéneros de terror" (2026-10-24, proyecto en `formato.json` → `ejemplo`; el usuario lo dio por bueno).
Los scripts de ese vídeo están en `scripts/` como punto de partida (`gen_plan.py`, `resync.py`). Sin marca salvo
que se indique.

## Estructura (lo que tiene que pasar en el vídeo)

1. **Hook:** el primer elemento directamente. Sin título fijo (las referencias no lo llevan).
2. **Lista:** el usuario dice cada elemento (una palabra o dos: "Terror psicológico", "Slasher") y la imagen
   cambia. ~0,9-1 s por elemento, sin justificaciones. 20-30 elementos caben en ~30 s.
3. **Cierre:** CTA de una frase con el collage de todas las imágenes arriba.

Al cortar (`edl.json`): un fragmento por elemento, desde 0,06 s antes de la primera palabra hasta que cae la voz;
mínimo ~0,85 s por fragmento si después hay silencio. Muy apretado: el usuario recorta aún más en la línea de
tiempo (~0,9 s por elemento). Si graba con apuntador, ver la memoria "grabaciones-camara" (separar voces por volumen).

## Visual (medidas en el cuadro 1080x1920)

**Base (pantalla partida).** Después de `assemble.py` (y `resync.py` si la fuente es de 25 fps), guarda el corte
entero en `work/aroll_full.mp4` y rehaz `assets/aroll.mp4` con la persona en el panel de abajo:
`ffmpeg -i work/aroll_full.mp4 -vf "crop=1080:1020:0:<Y>,pad=1080:1920:0:900:black" -c:a copy assets/aroll.mp4`.
`<Y>` = la franja del cuadro que se ve abajo: elige Y para que la parte alta de la cabeza (o moño) quede ~80 px
por debajo de y 900 y la barbilla por encima de y 1470 (en el ejemplo, cabeza en 600-1060 → Y = 520). Después
`layout.py`, y en `layout.json` pon `"lift": 0` (si no, sube la imagen 86 px).

**Imágenes** (una capa por elemento, anchor `full`, de su fragmento al siguiente, corte seco, sin entrada):
`<img class='fi'>` a 1080x900, `object-fit: cover` con `object-position: <x>% 50%` para encuadrar el foco.
- Películas/series/actores: backdrops de TMDB (clave en `~/.config/tmdb/.env`). Por película se revisan sus ~12
  backdrops mejor votados y se elige el más icónico: el protagonista o la escena más reconocible. Evita desnudos
  (Instagram). Descarga en `original` a `assets/films/<id>.jpg` y comprueba el recorte 1080x900 en una hoja.
- Otros temas: fotos reales del sitio/producto/persona (nunca IA), mismo tamaño y recorte.

**Degradado** (capa todo el vídeo, encima de las imágenes): y 640-900, de transparente a `rgba(0,0,0,.6)`.

**Texto en la franja** (una capa por elemento, mismo tiempo que su imagen):
- Bloque centrado, x 35-1045, centro vertical en y 808 (`top: 808px; transform: translateY(-50%)`).
- Línea grande: Montserrat 800, mayúsculas, blanco, letter-spacing .01em, line-height 1.02, una línea,
  tamaño `min(64, 1000 / (caracteres × 0.74))` px, sombra `0 3px 12px rgba(0,0,0,.8), 0 0 3px rgba(0,0,0,.7)`.
- Línea pequeña (opcional, el dato: película y año, autor, lugar…): Montserrat 600, 30 px, blanco al 93 %,
  margin-top 8 px, misma sombra.
- Los nombres en pantalla salen del guion (forma correcta), aunque en la toma se diga abreviado.
- Fuentes: `get_font.py "Montserrat" --weight 800` y `--weight 600` (si no están), `@font-face` en el `css` del plan.
- El usuario puede pedir otra fuente: se cambia en el `css` y se vuelve a renderizar.

**Collage del cierre** (capa desde el CTA hasta el final): rejilla con todas las imágenes del vídeo en 1080x900
(30 imágenes → 6 columnas × 5 filas de 180x180; ajusta columnas/filas al número), mismo `object-position` de
cada una. Entrada: `from {opacity 0, scale .6}`, 0,22 s, `back.out(1.6)`, `stagger` 0,025. CTA en la franja con
la misma línea grande (54 px, en 2 líneas si es largo), sin línea pequeña.

**Sonido:** `click-soft.mp3` vol 0.12 en cada cambio de imagen (desde la segunda), `whoosh-short.mp3` vol 0.15
al entrar el collage. Sin música.

**Subtítulos:** ninguno aparte del texto de la franja (`captionStyle: "none"`). Build con
`build_reel.py --no-my-style --picks <proyecto>/picks.json`.

## Línea de tiempo (Mi Estudio)

`timeline.json` → `"elementos"`: uno por fragmento con `label` "<elemento> → <dato>" y `from`/`to` en segundos de la
línea de tiempo (suma de duraciones de `edl.json`, NO tiempos de fotograma), más uno para el CTA ("CTA → Collage").
Al procesar, cada imagen va ligada a su fragmento (cambia en el corte); solo si el usuario movió un elemento a
propósito se respeta su tiempo.
