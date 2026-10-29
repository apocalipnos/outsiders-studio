# Outsiders Studio

Marketplace de plugins de Claude Code de Outsiders. De momento trae uno: **Mi Estudio**.

## Requisitos

- **video-studio** (Creator Studio) instalado y con el setup hecho: Mi Estudio usa su Python, su ffmpeg, su servidor
  del Picker y sus scripts (`assemble.py`, `build_reel.py`...).
- Para el formato Bracket: `opencv-python`, `onnxruntime`, `scipy` y `Pillow` en el Python de video-studio, y el
  modelo de recorte que descarga video-studio (`models/rvm_resnet50_fp32.onnx`).
- Opcional: el plugin **watch** (para crear formatos a partir de reels de referencia) y una clave v3 de TMDB en
  `~/.config/tmdb/.env` (`TMDB_API_KEY=...`) para pósters de películas y series.

## Instalar

En Claude Code:

```
/plugin marketplace add <usuario-o-org>/outsiders-studio
/plugin install mi-estudio@outsiders-studio
```

Reinicia Claude Code y di "abre mi estudio". La primera vez que se abre instala los estilos del equipo (Ultracinico)
en tu video-studio.

## Actualizar

```
/plugin marketplace update outsiders-studio
```

Tus preferencias (qué se ve en Mi Estudio, el último formato elegido y los formatos que crees tú) se guardan en
`%LOCALAPPDATA%\mi-estudio\`, fuera del plugin, así que no se pierden al actualizar.

## Publicar una versión nueva

1. Cambia lo que haga falta en `plugins/mi-estudio/skills/mi-estudio/`.
2. Sube `version` en `plugins/mi-estudio/.claude-plugin/plugin.json` y en `.claude-plugin/marketplace.json`.
3. Commit y push. Los demás lo reciben con `/plugin marketplace update outsiders-studio`.

Para compartir un estilo guardado de video-studio, copia su carpeta de `%LOCALAPPDATA%\video-studio\styles\<slug>\` a
`plugins/mi-estudio/skills/mi-estudio/estilos/<slug>/` (y sus fuentes descargadas de `video-studio\fonts\` a
`estilos/fonts/`). Al abrir Mi Estudio se instala a quien no lo tenga; a quien ya lo tenga no se le toca.

Para compartir un formato que creaste tú, cópialo de `%LOCALAPPDATA%\mi-estudio\formatos\<key>\` a
`plugins/mi-estudio/skills/mi-estudio/formatos\<key>\` y publica una versión nueva.
