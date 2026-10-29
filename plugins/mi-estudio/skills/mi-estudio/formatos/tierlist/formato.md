# Formato: Tierlist

Ficha de construcción para el Claude que edita. Sacada de 3 referencias (en `formato.json`). Decisiones del
usuario (2026-10-23): imágenes las busco yo; niveles S-A-B-C-D por defecto pero editables por vídeo; título fijo
siempre; cada elemento aparece grande y luego vuela a su fila. Sin marca salvo que el usuario la indique.

## Estructura (lo que tiene que pasar en el vídeo)

1. **Hook (0-3 s):** tabla vacía y título visibles desde el fotograma 1. Lo dicho: "Ranking de X…" o el primer
   elemento directamente.
2. **Bloque por elemento**, repetido 8-16 veces: **nombre** → **justificación** (1-3 frases) → **veredicto**
   ("tier S", "para mí es una A"…). Los bloques van sin ordenar por nivel.
3. **Cierre:** la tabla completa se queda en pantalla durante el CTA.

Al cortar (`edl.json`): mantener cada bloque completo (nombre + justificación + veredicto), cortar silencios
entre bloques sin piedad, sin cortar nunca entre el nombre y su imagen. Si el usuario grabó los elementos en orden
de nivel, no reordenes: es su guion.

## Visual (medidas en el cuadro 1080x1920)

Todo como capas de `plan.json` (`"layers"`, anchor `full`) + `"motion"` (GSAP) + `"sounds"`. Mira
`references/replicate.md` y `references/motion.md` de video-studio.

**Encuadre.** La cara tiene que quedar en la mitad superior (barbilla por encima de y ≈ 900). Si el plano viene
centrado, en `edl.json` sube el encuadre (`cy` más alto / `zoom` ~1.15-1.3 con `cy` ≈ 0.38). Si no hay forma de
que la cara quede por encima de la tabla, avisa al usuario: la próxima vez grabar con más aire debajo.

**Tabla** (capa `tier-board`, todo el vídeo):
- Caja x 90-980 (890 de ancho), y 1000-1460: 5 filas de 92 px (con N niveles: alto 460/N).
- Columna de etiqueta 150 px de ancho, fondo del color del nivel, letra centrada Inter Tight 600, 46 px, #111.
- Colores por defecto: S `#E0484F`, A `#F08A4B`, B `#F2E94E`, C `#7CE07C`, D `#6EC6EE`.
- Resto de la fila: `#1B1C20`. Separación entre filas 3 px `#0B0B0D`. Esquinas rectas.
- Niveles distintos si el usuario lo pide para ese vídeo (nombres, número de filas, colores).

**Título** (capa `tier-title`, todo el vídeo, anchor `top` y 236): placa blanca `#FFFFFF`, texto `#111`,
Inter Tight 800, 50 px, line-height 1.1, padding 14px 28px, radius 14 px, máximo 2 líneas cortas, centrado.
El texto lo escribes tú desde lo que dice el vídeo ("Ranking de marcas de pasta" / "(según un chef)").

**Elementos** (una capa por elemento, desde que se nombra hasta el final):
- Imagen: foto real del producto/cosa, buscada por ti en internet (PNG con fondo transparente si existe; si no,
  JPG recortado limpio). Guárdalas en `<proyecto>/assets/tier/<n>-<slug>.png`. NUNCA generada por IA.
  Sin foto buena: tarjeta blanca 76x80 con el nombre (Inter Tight 700, 18 px, #111, 2 líneas máx.).
- **Aparece** en la palabra del nombre (`words.json`): grande a la derecha de la tabla, caja ~260x300 centrada
  en x 820, y 1230, encima de la tabla. Entrada: scale 0.6→1 + opacidad, 0.25 s, `back.out(1.6)`.
- **Vuela** en la palabra del veredicto (la letra del nivel): a su hueco en la fila, 0.35 s, `power2.inOut`,
  tamaño final 76x80 (alto de fila − 12). Huecos de izquierda a derecha desde x 252 (90+150+12), paso 86 px.
  Más de 8 en una fila: reduce el tamaño de esa fila para que quepan hasta x 970.
- Se quedan en su fila hasta el final.

**Sonido** (`"sounds"`, stock de video-studio): `pop.mp3` vol 0.15 al aparecer, `whoosh-short.mp3` vol 0.18 al
volar. Nada más, sin música.

**Subtítulos:** los que haya elegido el usuario, pero colocados justo encima de la tabla: la línea debe acabar
por encima de y ≈ 990. Ajusta `bands.Y_CHEST` en `layout.json` a `930 - CAP_OFFSET[<estilo>]` (tabla en
`engine/captions.py`) o, con subtítulos custom, `position` en px. Nunca encima de la tabla ni de la cara.

## Línea de tiempo (Mi Estudio)

Escribe en `<proyecto>/timeline.json` un elemento por cosa clasificada, para que el usuario lo ajuste:
`"elementos": [{"id": "e1", "label": "Barilla → D", "from": <aparece>, "to": <vuela>}]` (segundos del montaje).
Al procesar, usa los `from`/`to` que devuelva como momento de aparecer y de volar.
