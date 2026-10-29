# Ultracinico

Made: 2026-10-25. Edit this file in plain words; style.json is what the build reads. Keep both in step.

Estilo de la cuenta de cine. NO es el estilo por defecto: se usa cuando el usuario dice que el vídeo es para esta
cuenta (`init_project.py --my-style "Ultracinico"`).

## Made from
- Especificación escrita por el usuario (Tipografía A y B) y su maqueta "10 películas que tienes que ver con tu pareja"
  (título amarillo con degradado negro superior) y un ejemplo de subtítulo serif amarillo con sombra negra.

## Type
Tres usos (el usuario los fijó así el 2026-10-25):
- H1, título principal: Barlow Condensed ExtraBold 800 "neón". MAYÚSCULAS, horizontal, tracking −1,5 %, interlineado .98,
  97 px y máx. 766 px por línea (fijado en la pantalla de tipografías). Clase `.cine-title`.
- H2, título secundario: DM Serif Display 400 en CURSIVA, "neón" como la H1 (mismo halo), minúsculas/como se escribe,
  80 px por defecto. Va con una H1 (p. ej. una línea encima, como "this film is honestly so" sobre "UNDERRATED" en su
  ejemplo). Clase `.cine-h2`; `<span class='r'>` deja una palabra en redonda. Sustituye al antiguo "texto de apoyo".
- Subtítulos: DM Serif Display 400, 42 px, centrados, interlineado compacto, la palabra marcada en cursiva.

## Colour
- Títulos: blanco #FFFFFF por defecto; `.y` = amarillo #FFF238; otro color con
  `style='--c:#xxxxxx;--g:<ese color al 70 %>;--g2:<ese color al 35 %>'`.
  Resplandor neón suave del mismo color (6 + 18 + 36 px; el usuario lo pidió "algo más neón" el 2026-10-25), bordes levemente suavizados.
- H2: amarillo #FFF238 por defecto con el mismo halo neón que la H1; `.w` = blanco; otro color con las mismas variables.
- Subtítulos: amarillo limón #FFF238 sólido, SIN resplandor y con sombra paralela negra.
- Nunca contornos, sombras duras, 3D ni neón exagerado.

## Captions
- Cuando haya subtítulos: el `caption` del estilo (DM Serif amarillo, sombra negra, palabra marcada en cursiva),
  hasta 2 líneas, en la banda baja. Muchos vídeos de esta cuenta van sin subtítulos: lo dice el usuario en cada uno.

## Caption motion
- Sin animación de entrada: cortes secos.

## Pace
- Al ritmo de lo que dice; la voz del apuntador fuera siempre.

## Framing
- Plano fijo en su estudio con pared roja; los gráficos se colocan según dónde está su cabeza en cada grabación.

## Graphic elements
- Título (por reel, con sus palabras): SIEMPRE con el degradado negro superior debajo:
  `<div class='cine-grad'></div><div class='cine-title' style='top:236px'><span class='ln'>…</span></div>` (top ≥ 220).
- H2: `<div class='cine-h2' style='top:…'>texto</div>` (encima o junto a su H1, dentro del degradado si va arriba).
- Tamaños ajustables en vivo con `tipografias.py` (en esta carpeta): H1, ancho de H1, H2 y subtítulos.
- Pósters de TMDB con borde blanco fino (4 px, radio 14) y sombra suave.

## Sound
- Sin música. Sonidos suaves (pop, golpe grave) solo si el usuario los pide en ese vídeo.

## Effects
- Ninguno por defecto.

## Standing notes
- Graba con un apuntador fuera de cámara: su voz nunca sale en el corte.
- Los vídeos hechos antes de este estilo (Cinzel, Inter Tight cursiva) se quedan como están.

## Could not be matched
- El grano/difusión de película analógica se imita con un blur de .3 px y el resplandor; no hay grano real.
