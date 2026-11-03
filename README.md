# Outsiders Studio

Marketplace de plugins de Claude Code de Outsiders. De momento trae uno: **Mi Estudio**.

## Requisitos

- **video-studio** (Creator Studio) instalado y con el setup hecho: Mi Estudio usa su Python, su ffmpeg, su servidor
  del Picker y sus scripts (`assemble.py`, `build_reel.py`...). Probado con la versión 2.7.1 (HyperFrames 0.8.34).
- Para el formato Bracket: `opencv-python`, `onnxruntime`, `scipy` y `Pillow` en el Python de video-studio, y el
  modelo de recorte que descarga video-studio (`models/rvm_resnet50_fp32.onnx`).
- Opcional: el plugin **watch** (para crear formatos a partir de reels de referencia) y una clave v3 de TMDB en
  `~/.config/tmdb/.env` (`TMDB_API_KEY=...`) para pósters de películas y series.
- Opcional, con tarjeta NVIDIA: transcribir unas 10 veces más rápido. Sin esto se transcribe igual con el procesador,
  más despacio. Ocupa unos 2 GB; `PY` es el `python` de `%LOCALAPPDATA%\video-studio\.platform.json`:

  ```
  PY -m pip install --target "%LOCALAPPDATA%\video-studio\cuda" nvidia-cublas-cu12==12.9.2.10 nvidia-cudnn-cu12==9.27.0.42
  ```

## Instalar

En Claude Code:

```
/plugin marketplace add apocalipnos/outsiders-studio
/plugin install mi-estudio@outsiders-studio
```

Reinicia Claude Code y di "abre mi estudio". La primera vez que se abre instala los estilos del equipo (Ultracinico)
en tu video-studio.

## Actualizar

En una terminal:

```
claude plugin update mi-estudio@outsiders-studio
```

O dentro de Claude Code: `/plugin` > Marketplaces > outsiders-studio > Update marketplace. Después reinicia Claude Code
o escribe `/reload-plugins`. Las actualizaciones no llegan solas: para que lleguen, activa Enable auto-update en ese mismo menú.

Tus preferencias (qué se ve en Mi Estudio, el último formato elegido y los formatos que crees tú) se guardan en
`%LOCALAPPDATA%\mi-estudio\`, fuera del plugin, así que no se pierden al actualizar.

## Novedades de la 2.1.0

- Grabaciones en HDR (HLG, lo que graban muchos móviles): se pasan solas a color normal al preparar los clips, al montar
  y antes de exportar. Antes el vídeo salía sin ningún texto y con el color lavado, sin avisar. Exportar vídeo ya no
  puede sacar un vídeo sin textos, y avisa si algún medio sigue en HDR.
- Los recortes se ven y se oyen al momento en Ver resultado, sin pulsar Procesar: recortar, quitar, partir, duplicar o
  mover clips. Las capas siguen a su trozo de vídeo. Para guardar los cortes sigue haciendo falta Procesar vídeo.

## Novedades de la 2.0.0

- Una sola pantalla como CapCut: vista previa grande a la derecha, línea de tiempo con tijeras, imán y marcas, y
  ajustes de color, audio, animación y estilo.
- Ver resultado enseña el vídeo real sin renderizar, y se edita encima: coger, arrastrar y cambiar el tamaño desde las esquinas.
- Exportar vídeo sin pasar por Claude cuando solo cambian posición, tamaño, textos o tiempos de las capas.
- Referencia cargada en el panel, con ficha y lista compacta de tomas.
- Preparar y transcribir los clips en segundo plano, con la tarjeta gráfica si hay.

## Publicar una versión nueva

1. Cambia lo que haga falta en `plugins/mi-estudio/skills/mi-estudio/`.
2. Sube `version` en `plugins/mi-estudio/.claude-plugin/plugin.json` (solo ahí: es la que manda).
3. Commit y push. Los demás lo reciben como dice "Actualizar".

Para compartir un estilo guardado de video-studio, copia su carpeta de `%LOCALAPPDATA%\video-studio\styles\<slug>\` a
`plugins/mi-estudio/skills/mi-estudio/estilos/<slug>/` (y sus fuentes descargadas de `video-studio\fonts\` a
`estilos/fonts/`). Al abrir Mi Estudio se instala a quien no lo tenga; a quien ya lo tenga no se le toca.

Para compartir un formato que creaste tú, cópialo de `%LOCALAPPDATA%\mi-estudio\formatos\<key>\` a
`plugins/mi-estudio/skills/mi-estudio/formatos\<key>\` y publica una versión nueva.
