# Formato: Columna Doble

Ficha de construcción para el Claude que edita. Sacada de 5 referencias (en `formato.json`). Decisiones del
usuario (2026-10-24): 2 columnas por defecto, 3 si el vídeo lo pide; cabeceras arriba a los lados con los
elementos apilados debajo flanqueando a la persona; cada elemento aparece grande y luego vuela a su columna.
Título fijo siempre e imágenes reales buscadas por ti (como Tierlist y Ranking). Sin marca salvo que se indique.

## Estructura (lo que tiene que pasar en el vídeo)

1. **Hook (0-3 s):** título con la pregunta y las dos cabeceras vacías visibles desde el fotograma 1. Lo dicho:
   la pregunta ("Tratamientos de belleza: ¿hype o merece la pena?") o el primer elemento directamente.
2. **Bloque por elemento**, 6-15 veces: **nombre o afirmación** → **veredicto de una palabra** que coincide con una
   cabecera ("Mito", "Dispara", "Replace") → **justificación** opcional de 1 frase. Rápido: 2-6 s por bloque.
3. **Cierre:** columnas llenas en pantalla durante el CTA.

Al cortar (`edl.json`): ritmo muy apretado, sin aire entre bloques; nunca separes el elemento de su veredicto.
Las cabeceras usan las palabras exactas del veredicto (si dice "Esa sí dispara", la cabecera es "Dispara").

## Visual (medidas en el cuadro 1080x1920)

Capas de `plan.json` (`"layers"`, anchor `full`) + `"motion"` (GSAP) + `"sounds"` (ver `references/replicate.md`
y `references/motion.md` de video-studio).

**Encuadre.** Persona centrada; la cara entre x ≈ 300 y 780 y con la parte alta de la cabeza por debajo de
y ≈ 500 (las cabeceras van encima). Si no, ajusta `zoom` / `cy` en `edl.json` o avisa al usuario.

**Título** (capa `cd-title`, todo el vídeo, anchor `top` y 236): texto blanco Inter Tight 800, 52 px, line-height
1.05, mayúsculas, centrado, sombra `0 3px 12px rgba(0,0,0,.55)`, sin placa (como la referencia de facturas),
máximo 2 líneas, debe acabar por encima de y 380. Texto: la pregunta del vídeo, escrita por ti.

**Cabeceras** (capa `cd-heads`, todo el vídeo), 2 columnas:
- Izquierda x 40-420, derecha x 660-1040, y 400-490 (alto 90), radius 14.
- Texto Inter Tight 800, 44 px, mayúsculas, blanco, centrado (si no cabe, baja a 36 px).
- Colores: categoría "positiva" (realidad, sí, worth it, no dispara, fix it…) a la izquierda en `#22C55E`;
  la "negativa" a la derecha en `#E5484D`. Si no hay polo positivo/negativo claro: `#3B82F6` y `#F59E0B`.
- Con 3 columnas: tres cabeceras de 300 de ancho en x 45, 390, 735 (y 400-480, texto 36 px), colores
  `#22C55E`, `#A78BFA`, `#F59E0B` salvo que el contenido pida otros.

**Huecos de cada columna** (2 columnas): pila vertical bajo su cabecera, imagen de 190x125 centrada en x 230
(izquierda) y x 850 (derecha), desde y 520 con paso 140 (7 por lado). Más de 7 en un lado: paso `940 / n` y
encoge la imagen en proporción. Con 3 columnas: miniaturas de 130x90 en rejilla de 2 por fila bajo cada
cabecera, desde y 500 (máx. 6 por columna) — quedan encima de la cabeza, como en la referencia de AACC/TDAH.

**Elementos** (una capa por elemento, desde que se nombra hasta el final):
- Imagen real buscada por ti (nunca IA): objetos/productos → recorte sin fondo (PNG transparente); escenas o
  conceptos → foto en tarjeta con esquinas redondeadas (radius 18). Sin imagen buena: tarjeta blanca con el
  nombre (Inter Tight 700, 22 px, #111). Guarda en `<proyecto>/assets/cd/<n>-<slug>.png`.
- **Aparece** en la palabra del elemento (`words.json`): grande abajo en el centro, caja 520x380 centrada en
  x 540, y 1250. Entrada: scale 0.6→1 + opacidad, 0.25 s, `back.out(1.6)`.
- **Vuela** en la palabra del veredicto: a su siguiente hueco libre, 0.35 s, `power2.inOut`, tamaño final del
  hueco. Al aterrizar, su cabecera hace un pulso (scale 1→1.08→1, 0.3 s) con brillo
  (`box-shadow: 0 0 28px <color de la cabecera>`).
- Se quedan apilados hasta el final.

**Sonido** (`"sounds"`, stock de video-studio): `pop.mp3` vol 0.15 al aparecer, `whoosh-short.mp3` vol 0.18 al
volar. Sin música.

**Subtítulos:** los que haya elegido el usuario, justo encima de la imagen grande: la línea debe acabar por encima
de y ≈ 1040 y quedar entre x 280 y 800 (entre las dos pilas). Ajusta `bands.Y_CHEST` en `layout.json` a
`980 - CAP_OFFSET[<estilo>]` (tabla en `engine/captions.py`) o `position` en px si son custom; líneas cortas.

## Línea de tiempo (Mi Estudio)

Escribe en `<proyecto>/timeline.json` un elemento por cosa clasificada:
`"elementos": [{"id": "e1", "label": "Lavadora → No dispara", "from": <nombre>, "to": <veredicto>}]`
(segundos del montaje). Al procesar: aparece en `from`, vuela en `to`, tal como los deje el usuario.
