# Formato: Ranking

Ficha de construcción para el Claude que edita. Sacada de 4 referencias (en `formato.json`). Decisiones del
usuario (2026-10-24): imagen según el tema (logos/fotos para marcas y productos, iconos para conceptos); tantas
posiciones como elementos (10 por defecto); cada elemento entra directo en su hueco al decir el puesto. Título
fijo siempre (como Tierlist). Sin marca salvo que el usuario la indique.

## Estructura (lo que tiene que pasar en el vídeo)

1. **Hook (0-3 s):** columna vacía y título visibles desde el fotograma 1. Lo dicho: "Ranking de X", "Top 10 X",
   "Mejores y peores X del 1 al 10"… o el primer elemento directamente.
2. **Bloque por elemento**, repetido N veces (≈10): **nombre** → **puesto** enseguida ("número 8", "le doy un 4")
   → **justificación** de 1-2 frases. Puestos desordenados, rellenando huecos salteados.
3. **El número 1 va el último**, siempre (las 4 referencias lo hacen). Es el clímax.
4. **Cierre:** tras el número 1, CTA o giro corto. La columna llena se queda en pantalla.

Al cortar (`edl.json`): cada bloque completo (nombre + puesto + justificación), silencios entre bloques fuera.
Si el número 1 no está grabado al final, no reordenes por tu cuenta: díselo al usuario y pregunta si lo mueves
(los bloques son independientes, se puede).

## Visual (medidas en el cuadro 1080x1920)

Capas de `plan.json` (`"layers"`, anchor `full`) + `"motion"` (GSAP) + `"sounds"` (ver `references/replicate.md`
y `references/motion.md` de video-studio).

**Encuadre.** La persona en el centro-derecha: nada de la cara a la izquierda de x ≈ 300. Si el plano viene
centrado, en `edl.json` usa `zoom` 1.15-1.3 con `cx` ≈ 0.40 para desplazarla a la derecha. Si no se puede sin
cortar la cara, avisa al usuario: la próxima vez grabar un poco desplazado a la derecha.

**Columna de posiciones** (capa `rank-col`, todo el vídeo):
- N posiciones (las que tenga el vídeo; 10 por defecto) de y 400 a y 1460: paso `P = 1060 / N` (106 con 10).
- Cada posición: círculo de diámetro `0.84·P` (89 con 10), centro en x 112. Relleno `rgba(0,0,0,.45)`, borde
  3 px `rgba(255,255,255,.85)`. Número centrado, Inter Tight 800, `0.5·P` px (53 con 10), blanco, sombra
  `0 2px 8px rgba(0,0,0,.5)`. El 1 arriba.
- Hueco de la imagen: cuadrado de lado `0.84·P` a la derecha del círculo, empieza en x 172. Vacío (no se dibuja).

**Título** (capa `rank-title`, todo el vídeo, anchor `top` y 236): placa blanca `#FFFFFF`, texto `#111`,
Inter Tight 800, 48 px, line-height 1.1, padding 14px 28px, radius 14 px, máximo 2 líneas cortas, centrado.
Debe acabar por encima de y 390 (si no cabe, 1 línea o 42 px). Texto: lo escribes desde el hook del vídeo.

**Elementos** (una capa por elemento, desde que se dice su puesto hasta el final):
- Imagen según el tema:
  - Marcas / productos / personas / sitios → logo o foto real buscada en internet (PNG transparente si existe).
    NUNCA generada por IA. Logos sobre fondo oscuro: si un logo es negro, usa su versión blanca o ponle una
    placa blanca redondeada detrás.
  - Conceptos (habilidades, partidas de gasto, hábitos…) → icono de línea blanco (Tabler Icons o Lucide, SVG,
    stroke 2, color #FFF), mismo set para todo el vídeo.
  - Sin imagen buena: tarjeta blanca redondeada con el nombre (Inter Tight 700, 18 px, #111, 2 líneas máx.).
  - Guarda en `<proyecto>/assets/rank/<puesto>-<slug>.(png|svg)`.
- **Entra** en la palabra del puesto (`words.json`), directo en su hueco: scale 0.4→1 + opacidad, 0.22 s,
  `back.out(1.8)`; el círculo de su número hace un pulso a la vez (scale 1→1.12→1, 0.3 s).
- **Número 1:** además, brillo del círculo (box-shadow blanco 0 0 24px, 0.6 s) al entrar.

**Sonido** (`"sounds"`, stock de video-studio): `pop.mp3` vol 0.15 en cada entrada; en el número 1, `chime.mp3`
vol 0.18 en vez del pop. Sin música.

**Subtítulos:** los que haya elegido el usuario, en la banda del pecho pero sin tocar la columna: el texto debe
quedar entre x 300 y 1045. Con estilos de línea corta basta el centrado normal; si es ancho, desplaza el bloque
con `"css"` en `plan.json` (p. ej. `.cap{left:130px;width:950px}`) o usa `chars` más bajo en subtítulos custom.

## Línea de tiempo (Mi Estudio)

Escribe en `<proyecto>/timeline.json` un elemento por cosa del ranking:
`"elementos": [{"id": "e1", "label": "Rolex → 9", "from": <nombre>, "to": <puesto>}]` (segundos del montaje).
Al procesar, el elemento entra en `to` (el momento del puesto) tal como lo deje el usuario.
