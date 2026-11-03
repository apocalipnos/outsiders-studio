#!/usr/bin/env python3
"""Mi Estudio: el Studio Picker de video-studio, pero solo con los estilos, subtítulos y efectos que tú eliges.

Reutiliza el servidor del Picker del plugin (serve.py) para el catálogo, los vídeos de muestra y el guardado,
así que guarda en el mismo studio-picks.json que video-studio lee. Solo añade:
    /              esta página (index.html de esta carpeta)
    /api/filtro    qué elementos se ven en Mi Estudio (%LOCALAPPDATA%/mi-estudio/filtro.json; por defecto, el filtro.json de esta carpeta)
Sus estilos guardados de video-studio (styles/<slug>/style.json) entran en el catálogo como "mi-<slug>", leídos en
cada petición; al elegir uno, los picks se guardan como "custom" + "myStyle": "<slug>".

    PY mi_estudio.py [--until-saved] [--no-open] [--port N]
    PY mi_estudio.py --project <proyecto> [--until-saved]

Imprime las mismas líneas STATUS que el Picker (READY, picks SAVED, CLOSED).

Con --project abre además la línea de tiempo de ese proyecto de video-studio (después de assemble.py):
    /api/project        edl.json, duración de cada clip y los efectos propuestos (timeline.json)
    /api/peaks/<clip>   forma de onda del clip (100 valores por segundo, 0-255)
    /src/<clip>         copia ligera del clip para previsualizar (work/mi-estudio/prev_<clip>.mp4, keyframes densos);
                        el vídeo fuente (sources.json) si no se pudo crear
    /api/edicion        las herramientas de la pestaña Edición con datos en este proyecto:
                        {<id>: {input: edicion/<id>.json, saved: edicion/<id>_edit.json o null}}
    /p/<ruta>           un archivo del proyecto (assets/..., work/...) para las herramientas
    POST /api/timeline  guarda edl.json (copia la anterior en edl_prev.json), timeline.json y picks.json del
                        proyecto, y lo que cambió en cada herramienta (edicion/<id>_edit.json); imprime
                        STATUS timeline SAVED <proyecto> edl=changed|same segments=N ... edicion=<ids cambiados>|none
                        textos=<grupo>:<n>,...|none (los subtítulos cambiados van antes a words.json)
Los picks del proyecto van a <proyecto>/picks.json (no a los picks globales).
"""
import argparse
import array
import json
import os
import re
import shutil
import subprocess
import sys
import threading
import time
import urllib.parse
import webbrowser

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
LOCAL = os.environ.get('LOCALAPPDATA', os.path.expanduser('~/AppData/Local'))
DATA = os.path.join(LOCAL, 'mi-estudio')       # lo del usuario, fuera del plugin (sobrevive a las actualizaciones)
os.makedirs(DATA, exist_ok=True)
FILTRO = os.path.join(DATA, 'filtro.json')
FILTRO_DEFAULT = os.path.join(HERE, 'filtro.json')  # valores por defecto del equipo, hasta que guarde el suyo
PLATFORM = os.path.join(LOCAL, 'video-studio', '.platform.json')
SECTIONS = ('styles', 'captions', 'effects')

with open(PLATFORM, 'r', encoding='utf-8') as f:
    PLAT = json.load(f)
sys.path.insert(0, os.path.join(PLAT['skill_dir'], 'picker'))
sys.path.insert(0, os.path.join(PLAT['skill_dir'], 'scripts'))
import serve  # noqa: E402
import skillenv  # noqa: E402
import edicion  # noqa: E402
import aplicar  # noqa: E402
import ficha  # noqa: E402
import hdr  # noqa: E402


STYLES_DIR = os.path.join(os.path.dirname(PLATFORM), 'styles')   # los estilos guardados de video-studio (my_styles.py)
FONTS_DIR = os.path.join(os.path.dirname(PLATFORM), 'fonts')     # fuentes de esos estilos (build_reel.py las copia)
ESTILOS = os.path.join(HERE, 'estilos')  # estilos que trae el plugin (estilos/<slug>/) y sus fuentes (estilos/fonts/)


def instalar_estilos():
    """Copia a video-studio los estilos y fuentes del plugin que el usuario aún no tiene; nunca pisa los suyos."""
    for name in os.listdir(ESTILOS) if os.path.isdir(ESTILOS) else []:
        src = os.path.join(ESTILOS, name)
        if name == 'fonts':
            os.makedirs(FONTS_DIR, exist_ok=True)
            for f in os.listdir(src):
                if not os.path.exists(os.path.join(FONTS_DIR, f)):
                    shutil.copyfile(os.path.join(src, f), os.path.join(FONTS_DIR, f))
        elif os.path.isdir(src) and not os.path.exists(os.path.join(STYLES_DIR, name)):
            shutil.copytree(src, os.path.join(STYLES_DIR, name))


instalar_estilos()
MINE = 'mi-'                     # prefijo de sus estilos guardados en el catálogo ("mi-ultracinico")
# un formato por carpeta: formato.json, formato.md, vista previa; los del usuario mandan sobre los del plugin
FORMATOS_DIRS = (os.path.join(DATA, 'formatos'), os.path.join(HERE, 'formatos'))
ELECCION = os.path.join(DATA, 'eleccion-formato.json')  # formato elegido fuera de un proyecto
PROJECT = None                   # carpeta del proyecto con --project
SOURCES = {}                     # clip id -> ruta del vídeo fuente
PREVIEWS = {}                    # clip id -> Event que se activa cuando su copia ligera está lista (o falló)
UNTIL_SAVED = False
PREPARAR = False                 # --preparar: elegir formato, subtítulos y efectos antes de cortar
FICHA, FICHA_PATH = None, None   # --ficha: lo que ficha.py sacó de la referencia, para revisarlo antes de cortar
RESULTADO = False                # --resultado: se abre enseñando el vídeo montado (Ver resultado), para aprobarlo antes del render
serve.TYPES.setdefault('.mov', 'video/quicktime')
serve.TYPES.setdefault('.m4v', 'video/mp4')
for _ext, _type in (('.wav', 'audio/wav'), ('.mp3', 'audio/mpeg'), ('.m4a', 'audio/mp4'), ('.ttf', 'font/ttf'), ('.otf', 'font/otf')):
    serve.TYPES.setdefault(_ext, _type)        # pistas de la herramienta Audio y fuentes del proyecto


def load_filtro():
    raw = serve.read_json(FILTRO if os.path.isfile(FILTRO) else FILTRO_DEFAULT, {}) or {}
    return {s: [k for k in raw.get(s, []) if isinstance(k, str)] for s in SECTIONS}


def formato_dir(key):
    for base in FORMATOS_DIRS:
        if os.path.isfile(os.path.join(base, key, 'formato.json')):
            return os.path.join(base, key)
    return None


def list_formatos():
    out = []
    keys = {k for base in FORMATOS_DIRS if os.path.isdir(base) for k in os.listdir(base)}
    for key in sorted(keys):
        folder = formato_dir(key) if serve.KEY_RE.match(key) else None
        f = serve.read_json(os.path.join(folder, 'formato.json'), None) if folder else None
        if not isinstance(f, dict):
            continue
        url = lambda name: ('/mi/formatos/%s/%s' % (key, name)) if name and os.path.isfile(os.path.join(folder, name)) else None
        out.append({'key': key, 'name': f.get('name') or key, 'line': f.get('line') or '', 'estado': f.get('estado') or 'receta',
                    'visual': f.get('visual') or [], 'estructura': f.get('estructura') or [],
                    'preview': url(f.get('preview')), 'poster': url(f.get('poster'))})
    return out


def my_style(slug):
    """style.json de un estilo guardado, leído en el momento (lo que cambie en el estilo se ve al recargar)."""
    if not isinstance(slug, str) or not serve.KEY_RE.match(slug) or slug.startswith('_'):
        return None
    st = serve.read_json(os.path.join(STYLES_DIR, slug, 'style.json'), None)
    return st if isinstance(st, dict) else None


def style_line(slug, st):
    """Una línea para la tarjeta: "line" de style.json, o el primer párrafo de su style.md."""
    if isinstance(st.get('line'), str) and st['line'].strip():
        return st['line'].strip()[:140]
    try:
        with open(os.path.join(STYLES_DIR, slug, 'style.md'), encoding='utf-8') as f:
            for ln in f:
                ln = ln.strip()
                if ln and not ln.startswith(('#', 'Made:', '-')):
                    return ln[:140]
    except OSError:
        pass
    return 'Estilo guardado'


def my_styles(caption_keys, effect_keys):
    """Los estilos guardados como tarjetas del catálogo (key "mi-<slug>"). Sus subtítulos y capas los pone el
    propio estilo al montar; aquí solo van los picks que lleve dentro (subtítulos del catálogo y efectos)."""
    out = []
    for slug in sorted(os.listdir(STYLES_DIR)) if os.path.isdir(STYLES_DIR) else []:
        st = my_style(slug)
        if not st:
            continue
        p = st.get('picks') if isinstance(st.get('picks'), dict) else {}
        cap = p.get('captionStyle') if p.get('captionStyle') in caption_keys else 'none'
        own = st.get('caption')
        cap_label = ('Subtítulos propios · %s' % own.get('font', '')).strip(' ·') if isinstance(own, dict) else ''
        prev = os.path.join(STYLES_DIR, slug, 'preview')
        files = sorted(os.listdir(prev)) if os.path.isdir(prev) else []
        url = lambda exts: next(('/mi/estilos/%s/%s' % (slug, f) for f in files if f.lower().endswith(exts)), None)
        out.append({'n': None, 'key': MINE + slug, 'name': serve.text(st.get('name'), 60) or slug, 'group': 'mios',
                    'label': 'Mis estilos', 'line': style_line(slug, st), 'captionStyle': cap,
                    'effects': [k for k in (p.get('effects') or []) if k in effect_keys], 'ready': True,
                    'mine': True, 'capLabel': cap_label, 'preview': url(('.mp4', '.webm')),
                    'poster': url(('.jpg', '.jpeg', '.png'))})
    return out


_build_catalog, _check_picks, _load_picks = serve.build_catalog, serve.check_picks, serve.load_picks


def build_catalog(*args, **kw):
    cat = _build_catalog(*args, **kw)
    cat['styles'] = cat['styles'] + my_styles({c['key'] for c in cat['captions']}, {e['key'] for e in cat['effects']})
    return cat


def check_picks(raw, catalog):
    """Un estilo guardado se guarda como picks "custom" + "myStyle": <slug>, para que video-studio no tome
    "mi-<slug>" por un estilo de los suyos. Lo demás, como el Picker."""
    if isinstance(raw, dict) and raw.get('mode') == 'preset' and str(raw.get('style') or '').startswith(MINE):
        slug = raw['style'][len(MINE):]
        if not my_style(slug):
            return None, 'Estilo guardado desconocido.'
        picks, error = _check_picks(dict(raw, mode='custom', style=None), catalog)
        if picks:
            picks['myStyle'] = slug
        return picks, error
    return _check_picks(raw, catalog)


def load_picks(path, catalog):
    picks = _load_picks(path, catalog)
    slug = (serve.read_json(path, {}) or {}).get('myStyle')
    if my_style(slug) and any(s['key'] == MINE + slug for s in catalog['styles']):
        picks['mode'], picks['style'] = 'preset', MINE + slug
    return picks


serve.build_catalog, serve.check_picks, serve.load_picks = build_catalog, check_picks, load_picks


def picked_style(picks):
    return (picks or {}).get('myStyle') or 'none'


def eleccion_path():
    return os.path.join(PROJECT, 'formato.json') if PROJECT else ELECCION


def load_eleccion():
    path = eleccion_path()
    if PROJECT and not os.path.isfile(path):
        path = ELECCION
    key = (serve.read_json(path, {}) or {}).get('formato')
    return key if key in {f['key'] for f in list_formatos()} else None


def probe_duration(path):
    out = subprocess.run([PLAT.get('ffprobe') or 'ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                          '-of', 'csv=p=0', path], capture_output=True, text=True).stdout.strip()
    try:
        return float(out)
    except ValueError:
        return 0.0


def peaks(clip):
    """Forma de onda: el pico de cada 10 ms (0-255), guardada en work/mi-estudio/ para no recalcularla."""
    cache = os.path.join(PROJECT, 'work', 'mi-estudio', 'peaks_%s.json' % clip)
    src = SOURCES[clip]
    if os.path.isfile(cache) and os.path.getmtime(cache) >= os.path.getmtime(src):
        return serve.read_json(cache, [])
    pcm = subprocess.run([PLAT.get('ffmpeg') or 'ffmpeg', '-v', 'error', '-i', src, '-vn', '-ac', '1', '-ar', '8000',
                          '-f', 's16le', '-'], capture_output=True).stdout
    samples = array.array('h')
    samples.frombytes(pcm[:len(pcm) // 2 * 2])
    out = []
    for i in range(0, len(samples), 80):
        block = samples[i:i + 80]
        out.append(min(255, max(abs(min(block)), abs(max(block))) * 255 // 32767) if block else 0)
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    serve.write_picks(cache, out)
    return out


def strip(clip):
    """Tira de miniaturas del clip para la línea de tiempo: una imagen por segundo en una rejilla de 20 columnas."""
    src, base = SOURCES[clip], os.path.join(PROJECT, 'work', 'mi-estudio', 'strip_%s' % clip)
    tw, th, cols = 54, 96, 20
    n = max(1, int(probe_duration(src)) + 1)
    if not (os.path.isfile(base + '.jpg') and os.path.getmtime(base + '.jpg') >= os.path.getmtime(src)):
        os.makedirs(os.path.dirname(base), exist_ok=True)
        rows = n // cols + 1
        r = subprocess.run([PLAT.get('ffmpeg') or 'ffmpeg', '-v', 'error', '-y', '-i', src, '-vf',
                            'fps=1,scale=%d:%d:force_original_aspect_ratio=increase,crop=%d:%d,tile=%dx%d' % (tw, th, tw, th, cols, rows),
                            '-frames:v', '1', '-q:v', '6', base + '.jpg'], capture_output=True)
        if r.returncode != 0:
            serve.warn('no se pudieron crear las miniaturas de %s: %s' % (clip, r.stderr.decode('utf-8', 'replace').strip()[-300:]))
            return {}
    return {'url': '/p/work/mi-estudio/strip_%s.jpg' % clip, 'step': 1, 'tw': tw, 'th': th, 'cols': cols, 'n': n}


def preview_path(clip):
    return os.path.join(PROJECT, 'work', 'mi-estudio', 'prev_%s.mp4' % clip)


def make_preview(clip):
    """Copia ligera para la línea de tiempo: 540 px de ancho y un keyframe cada 6 fotogramas. Los clips fuente traen
    uno cada ~8 s, y cada salto entre fragmentos obligaba al navegador a decodificar cientos de fotogramas (las pausas)."""
    src, out = SOURCES[clip], preview_path(clip)
    if not (os.path.isfile(out) and os.path.getmtime(out) >= os.path.getmtime(src)):
        tmp = out[:-4] + '.part.mp4'
        os.makedirs(os.path.dirname(out), exist_ok=True)
        r = subprocess.run([PLAT.get('ffmpeg') or 'ffmpeg', '-v', 'error', '-y', '-i', src, '-map', '0:v:0', '-map', '0:a:0?',
                            '-vf', 'scale=540:-2', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '26', '-pix_fmt', 'yuv420p',
                            '-g', '6', '-keyint_min', '6', '-sc_threshold', '0', '-c:a', 'aac', '-b:a', '128k',
                            '-movflags', '+faststart', tmp], capture_output=True)
        if r.returncode == 0:
            os.replace(tmp, out)
        else:
            serve.warn('no se pudo crear la copia ligera de %s: %s' % (clip, r.stderr.decode('utf-8', 'replace').strip()[-300:]))
            if os.path.isfile(tmp):
                os.remove(tmp)
    PREVIEWS[clip].set()


def make_previews():
    """Crea las copias ligeras en segundo plano, en el orden en que salen los clips en el montaje."""
    edl = serve.read_json(os.path.join(PROJECT, 'edl.json'), []) or []
    order = [s.get('clip') for s in edl if isinstance(s, dict)] + list(SOURCES)
    for clip in dict.fromkeys(c for c in order if c in SOURCES):
        make_preview(clip)


def preview_or_source(clip):
    PREVIEWS[clip].wait(180)
    return preview_path(clip) if PREVIEWS[clip].is_set() and os.path.isfile(preview_path(clip)) else SOURCES[clip]


def project_info():
    edl = serve.read_json(os.path.join(PROJECT, 'edl.json'), [])
    timeline = serve.read_json(os.path.join(PROJECT, 'timeline.json'), {}) or {}
    clips = {c: {'url': '/src/' + c, 'dur': probe_duration(p)} for c, p in SOURCES.items()}
    ok, motivo = directo()
    return {'name': os.path.basename(PROJECT), 'fps': 30, 'edl': edl, 'clips': clips,
            'segments': serve.read_json(os.path.join(PROJECT, 'segments.json'), []) or [],     # lo que hay de verdad en assets/aroll.mp4
            'effects': timeline.get('effects') or [], 'elementos': timeline.get('elementos') or [],
            'directo': ok, 'motivo': motivo}


def edicion_dir():
    return os.path.join(PROJECT, 'edicion')


def edicion_inputs():
    """Las herramientas de la pestaña Edición con datos en el proyecto (edicion/<id>.json) y lo último guardado."""
    out, d = {}, edicion_dir()
    for f in sorted(os.listdir(d)) if os.path.isdir(d) else []:
        tool = f[:-5]
        if f.endswith('.json') and not tool.endswith('_edit') and serve.KEY_RE.match(tool):
            data = serve.read_json(os.path.join(d, f), None)
            if isinstance(data, dict):
                out[tool] = {'input': data, 'saved': serve.read_json(os.path.join(d, tool + '_edit.json'), None)}
        elif f.endswith('_edit.json') and serve.KEY_RE.match(f[:-10]) and f[:-10] not in out:
            # los módulos que siempre están no necesitan <id>.json, solo lo que el usuario dejó
            out[f[:-10]] = {'input': None, 'saved': serve.read_json(os.path.join(d, f), None)}
    return out


def herramientas():
    """Los módulos de la Edición en el orden en que se cargan: el esquema y capas y audio primero, y el resto por nombre."""
    d = os.path.join(HERE, 'herramientas')
    ids = sorted(f[:-3] for f in os.listdir(d) if f.endswith('.js') and serve.KEY_RE.match(f[:-3]))
    first = [x for x in ('esquema', 'capas', 'audio') if x in ids]
    return first + [x for x in ids if x not in first]


def clean_edicion(raw):
    """Lo que cada herramienta dejó: {<id>: {...}} solo para módulos que existen, con datos JSON de tamaño razonable."""
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        return 'Datos de edición no válidos.'
    known = set(edicion_inputs()) | set(herramientas()) | {'pistas', 'tiempos'}

    def ok(v, depth=0):
        if isinstance(v, bool) or isinstance(v, (int, float)):
            return True
        if isinstance(v, str):
            return len(v) <= 20000
        if isinstance(v, dict) and depth < 8 and len(v) <= 2000:
            return all(isinstance(k, str) and len(k) <= 120 and ok(x, depth + 1) for k, x in v.items())
        if isinstance(v, list) and depth < 8 and len(v) <= 5000:
            return all(ok(x, depth + 1) for x in v)
        return v is None
    out = {}
    for tool, data in raw.items():
        if tool not in known or not isinstance(data, dict) or not ok(data):
            return 'La herramienta %s mandó datos no válidos.' % str(tool)[:40]
        out[tool] = data
    return out


def clean_timeline(raw):
    """Valida lo que manda la página. Devuelve (edl, effects, picks) o un texto de error."""
    if not isinstance(raw, dict):
        return 'Datos no válidos.'
    edl, effects = raw.get('edl'), raw.get('effects')
    if not isinstance(edl, list) or not edl or not isinstance(effects, list):
        return 'Faltan los cortes o los efectos.'
    for seg in edl:
        if not isinstance(seg, dict) or seg.get('clip') not in SOURCES:
            return 'Un corte apunta a un clip que no existe.'
        try:
            seg['in'], seg['out'] = round(float(seg['in']), 3), round(float(seg['out']), 3)
        except (KeyError, TypeError, ValueError):
            return 'Un corte no tiene inicio o final.'
        if not 0 <= seg['in'] < seg['out']:
            return 'Un corte termina antes de empezar.'
    clean_fx = []
    for fx in effects:
        try:
            item = {'key': str(fx['key']), 'from': round(float(fx['from']), 3), 'to': round(float(fx['to']), 3)}
        except (KeyError, TypeError, ValueError):
            return 'Un efecto no tiene inicio o final.'
        if not serve.KEY_RE.match(item['key']) or not 0 <= item['from'] < item['to']:
            return 'Un efecto no es válido.'
        clean_fx.append(item)
    elementos = []
    for el in raw.get('elementos') or []:
        try:
            item = {'id': str(el['id'])[:40], 'label': str(el.get('label', ''))[:120],
                    'from': round(float(el['from']), 3), 'to': round(float(el['to']), 3)}
        except (KeyError, TypeError, ValueError):
            return 'Un elemento del formato no tiene inicio o final.'
        if not 0 <= item['from'] <= item['to']:
            return 'Un elemento del formato no es válido.'
        # editado a mano / quitado, y el momento del clip fuente al que va pegado (sobrevive a cambios de edl.json)
        item['edited'], item['off'] = bool(el.get('edited')), bool(el.get('off'))
        a = el.get('anchor')
        if isinstance(a, dict) and isinstance(a.get('seg'), str):
            try:
                item['anchor'] = {'seg': a['seg'][:40], 'src': round(float(a['src']), 3)}
            except (KeyError, TypeError, ValueError):
                pass
        elementos.append(item)
    formato = raw.get('formato')
    if formato is not None and formato not in {f['key'] for f in list_formatos()}:
        return 'Formato desconocido.'
    picks, error = serve.check_picks(raw.get('picks'), serve.build_catalog())
    if error:
        return error
    return edl, clean_fx, elementos, formato, picks


# ---------- lo que necesitan los paneles de la Edición: archivos, medios, renders, fotograma real, comprobaciones ----------
OCULTOS = {'.hyperframes', '.thumbnails', '.waveform-cache', 'node_modules', '__pycache__', 'mi-estudio', 'upright', 'cf', 'layout'}
TIPOS = {'.mp4': 'video', '.mov': 'video', '.webm': 'video', '.m4v': 'video', '.mp3': 'audio', '.wav': 'audio', '.m4a': 'audio', '.aac': 'audio', '.ogg': 'audio',
         '.png': 'image', '.jpg': 'image', '.jpeg': 'image', '.webp': 'image', '.gif': 'image', '.svg': 'image',
         '.woff2': 'font', '.woff': 'font', '.ttf': 'font', '.otf': 'font', '.cube': 'lut'}
EDITABLES = ('.json', '.md', '.txt')
VIDEOS = ('.mp4', '.mov', '.webm', '.m4v')
EXAMPLES = os.path.join(os.path.dirname(PLATFORM), 'examples')    # donde get_example.py y study.py dejan las referencias
RENDER = {'running': False, 'log': '', 'output': None, 'error': None, 'proc': None, 'started': 0, 'avisos': [], 'parar': False}
for _ext, _type in (('.webp', 'image/webp'), ('.svg', 'image/svg+xml'), ('.gif', 'image/gif'), ('.woff2', 'font/woff2'), ('.woff', 'font/woff'), ('.aac', 'audio/aac'), ('.ogg', 'audio/ogg'), ('.cube', 'text/plain')):
    serve.TYPES.setdefault(_ext, _type)


def dentro(root, full):
    """Como serve.inside, pero también vale para carpetas y archivos que aún no existen."""
    root, full = os.path.normcase(os.path.abspath(root)), os.path.normcase(os.path.abspath(full))
    return full != root and full.startswith(root + os.sep)


def in_project(rel):
    full = os.path.normpath(os.path.join(PROJECT, *str(rel).replace('\\', '/').split('/')))
    return full if dentro(PROJECT, full) else None


def list_files():
    """Árbol del proyecto para el panel Archivos: [{path, size, editable}], sin cachés ni clips de trabajo."""
    out = []
    for base, dirs, files in os.walk(PROJECT):
        dirs[:] = sorted(d for d in dirs if d not in OCULTOS and not d.startswith('.'))
        for f in sorted(files):
            full = os.path.join(base, f)
            rel = os.path.relpath(full, PROJECT).replace('\\', '/')
            out.append({'path': rel, 'size': os.path.getsize(full), 'editable': f.lower().endswith(EDITABLES)})
    return out


def read_file(rel):
    full = in_project(rel)
    if not full or not os.path.isfile(full):
        return None
    if os.path.getsize(full) > 3 * 1024 * 1024:
        return {'path': rel, 'text': None, 'editable': False, 'note': 'Demasiado grande para abrirlo aquí.'}
    try:
        with open(full, encoding='utf-8') as f:
            return {'path': rel, 'text': f.read(), 'editable': rel.lower().endswith(EDITABLES)}
    except UnicodeDecodeError:
        return {'path': rel, 'text': None, 'editable': False, 'note': 'Archivo binario.'}


def write_file(rel, text):
    """Guarda un JSON o una nota del proyecto (nunca el HTML: sale de los JSON) y deja la versión anterior en work/mi-estudio/historial."""
    full = in_project(rel)
    if not full or not rel.lower().endswith(EDITABLES) or not isinstance(text, str):
        return 'Aquí solo se pueden editar JSON y notas.'
    if rel.lower().endswith('.json'):
        try:
            json.loads(text)
        except ValueError as e:
            return 'El JSON no es válido: %s' % e
    if os.path.isfile(full):
        hist = os.path.join(PROJECT, 'work', 'mi-estudio', 'historial')
        os.makedirs(hist, exist_ok=True)
        shutil.copyfile(full, os.path.join(hist, '%d-%s' % (int(time.time()), rel.replace('/', '_'))))
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, 'w', encoding='utf-8', newline='\n') as f:
        f.write(text)
    return None


def list_assets(scope):
    """Medios del proyecto (o de los demás proyectos de su carpeta): [{path, url, type, size, used, project}]."""
    plan = ''
    for name in ('plan.json', os.path.join('edicion', 'libres_edit.json')):
        p = os.path.join(PROJECT, name)
        if os.path.isfile(p):
            with open(p, encoding='utf-8', errors='ignore') as f:
                plan += f.read()
    out = []

    def walk(root, label, url):
        for base, dirs, files in os.walk(root):
            dirs[:] = sorted(d for d in dirs if d not in OCULTOS and not d.startswith('.') and d != 'renders')
            for f in sorted(files):
                kind = TIPOS.get(os.path.splitext(f)[1].lower())
                if kind:
                    rel = os.path.relpath(os.path.join(base, f), root).replace('\\', '/')
                    out.append({'path': rel, 'name': f, 'url': url + urllib.parse.quote(rel), 'type': kind, 'size': os.path.getsize(os.path.join(base, f)),
                                'used': bool(label is None and rel in plan), 'project': label})
    assets = os.path.join(PROJECT, 'assets')
    if scope == 'all':
        parent = os.path.dirname(PROJECT)
        for name in sorted(os.listdir(parent)):
            other = os.path.join(parent, name, 'assets')
            if name != os.path.basename(PROJECT) and os.path.isdir(other):
                walk(other, name, '/api/asset-otro/%s/' % urllib.parse.quote(name))
    else:
        if os.path.isdir(assets):
            walk(assets, None, '/p/assets/')
        for rel in referencias():               # la referencia también sale en Medios (su ruta se resuelve desde assets/)
            f = os.path.join(PROJECT, *rel.split('/'))
            out.append({'path': '../' + rel, 'name': 'Referencia · ' + os.path.basename(f), 'url': '/p/' + urllib.parse.quote(rel), 'type': 'video',
                        'size': os.path.getsize(f), 'used': False, 'project': None})
    return out


def import_asset(project, rel):
    """Copia a este proyecto un medio de otro proyecto de la misma carpeta y devuelve su ruta en assets/."""
    root = os.path.normpath(os.path.join(os.path.dirname(PROJECT), str(project), 'assets'))
    full = os.path.normpath(os.path.join(root, *str(rel).split('/')))
    if not dentro(os.path.dirname(PROJECT), root) or not dentro(root, full) or not os.path.isfile(full):
        return None
    dest = os.path.join(PROJECT, 'assets', 'imported', os.path.basename(full))
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    shutil.copyfile(full, dest)
    return 'assets/imported/' + os.path.basename(full)


def list_renders():
    d = os.path.join(PROJECT, 'renders')
    out = []
    for f in os.listdir(d) if os.path.isdir(d) else []:
        full = os.path.join(d, f)
        if os.path.isfile(full) and os.path.splitext(f)[1].lower() in ('.mp4', '.mov', '.webm'):
            out.append({'name': f, 'url': '/p/renders/' + urllib.parse.quote(f), 'size': os.path.getsize(full), 'mtime': os.path.getmtime(full)})
    return sorted(out, key=lambda r: -r['mtime'])


def hf_cmd(*args):
    return [sys.executable, os.path.join(PLAT['skill_dir'], 'scripts', 'hf.py'), PROJECT] + [str(a) for a in args]


def guardar_edits(edits):
    if isinstance(edits, dict):
        for tool, data in edits.items():
            serve.write_picks(os.path.join(edicion_dir(), tool + '_edit.json'), data)


def snapshot_frame(t, edits):
    """El fotograma t tal como saldrá: aplica los JSON al HTML y lo pinta HyperFrames (no la vista previa aproximada)."""
    if not os.path.isfile(os.path.join(PROJECT, 'index.html')):
        return None, 'Este proyecto aún no está montado: pulsa Procesar vídeo una vez y podrás ver el fotograma real.'
    cleaned = clean_edicion(edits)
    if isinstance(cleaned, str):
        return None, cleaned
    guardar_edits(cleaned)
    try:
        aplicar.aplicar(PROJECT)
    except Exception as e:      # noqa: BLE001 - el panel enseña el motivo
        return None, 'No se pudieron aplicar los JSON: %s' % e
    start = time.time() - 1
    # con color, el shader bloquea la página más de los 10 s que HyperFrames espera por defecto al abrirla
    env = dict(os.environ, PRODUCER_PAGE_NAVIGATION_TIMEOUT_MS='90000')
    r = subprocess.run(hf_cmd('snapshot', '--at', '%.3f' % float(t), '--no-end', '--describe', 'false'), capture_output=True, text=True, encoding='utf-8', errors='replace', env=env)
    shots = os.path.join(PROJECT, 'snapshots')
    # el fotograma, no la hoja resumen que HyperFrames escribe al lado; el mismo nombre se sobrescribe si se repite el segundo
    new = sorted((f for f in (os.listdir(shots) if os.path.isdir(shots) else []) if f.lower().startswith('frame-') and f.lower().endswith(('.png', '.jpg'))
                  and os.path.getmtime(os.path.join(shots, f)) >= start), key=lambda f: os.path.getmtime(os.path.join(shots, f)))
    if not new:
        return None, 'HyperFrames no pudo pintar el fotograma: %s' % (r.stderr or r.stdout)[-300:]
    return '/p/snapshots/%s?v=%d' % (urllib.parse.quote(new[-1]), int(time.time())), None


# ---------- la referencia del vídeo: get_example.py la deja en una carpeta común y aquí se conecta con el proyecto ----------
def referencias():
    d = os.path.join(PROJECT, 'ref')
    return ['ref/' + f for f in sorted(os.listdir(d)) if f.lower().endswith(VIDEOS)] if os.path.isdir(d) else []


def adoptar(path):
    """Copia una referencia a ref/ y, si study.py la estudió, le crea su ficha. Devuelve su ruta en el proyecto."""
    name = os.path.basename(path)
    dest = os.path.join(PROJECT, 'ref', name)
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    if os.path.abspath(path) != os.path.abspath(dest):
        shutil.copyfile(path, dest)
    estudio = os.path.join(EXAMPLES, os.path.splitext(name)[0])
    out = os.path.join(edicion_dir(), 'referencia.json')
    if not os.path.isfile(out) and os.path.isfile(os.path.join(estudio, 'study.json')):
        try:
            fi = ficha.ficha(dest, estudio)
            fi['video'] = 'ref/' + name
            serve.write_picks(out, fi)
        except (OSError, ValueError, KeyError) as e:
            serve.warn('no se pudo crear la ficha de %s: %s' % (name, e))
    return 'ref/' + name


def descargas():
    """Lo que get_example.py ha bajado, lo último primero: [(ruta, fecha)]."""
    d = os.path.join(EXAMPLES, 'downloads')
    files = [os.path.join(d, f) for f in os.listdir(d) if f.lower().endswith(VIDEOS)] if os.path.isdir(d) else []
    return sorted(((f, os.path.getmtime(f)) for f in files), key=lambda x: -x[1])


def referencia_auto():
    """Al abrir un proyecto sin referencia: la que se bajó en las 6 horas antes de empezarlo. Si alguna se estudió, esa
    (las demás suelen ser ejemplos para meter dentro del vídeo, que se bajan después o sin estudiar)."""
    origen = os.path.join(PROJECT, 'sources.json')
    if referencias() or not os.path.isfile(origen):
        return
    t0 = min(os.path.getmtime(origen), os.path.getctime(origen))
    cerca = [f for f, m in descargas() if t0 - 6 * 3600 <= m <= t0 + 120]
    estudiadas = [f for f in cerca if os.path.isfile(os.path.join(EXAMPLES, os.path.splitext(os.path.basename(f))[0], 'study.json'))]
    for f in (estudiadas or cerca)[:3]:
        try:
            serve.say('STATUS referencia %s' % adoptar(f))
        except OSError as e:
            serve.warn('no se pudo copiar la referencia: %s' % e)


def referencia_url(url):
    """Baja una referencia desde su enlace (lo que hace get_example.py) y la deja en el proyecto. Devuelve (ruta, error)."""
    if not re.match(r'https?://', str(url or '')):
        return None, 'Pega un enlace que empiece por http.'
    script = os.path.join(PLAT['skill_dir'], 'scripts', 'get_example.py')
    r = subprocess.run([PLAT.get('python') or sys.executable, script, str(url)], capture_output=True, text=True, encoding='utf-8', errors='replace')
    # la línea es "STATUS example READY <archivo>  (7.2 MB, de dónde salió)"
    m = re.findall(r'STATUS example READY (.+?)(?:\s{2,}\(.*)?\s*$', r.stdout, re.M)
    if not m:
        return None, 'No se pudo descargar: %s' % (r.stderr or r.stdout).strip()[-240:]
    try:
        return adoptar(os.path.normpath(m[-1].strip().strip('"'))), None
    except OSError as e:
        return None, 'Se descargó, pero no se pudo copiar al proyecto: %s' % e


def hf_runtime():
    """El runtime de HyperFrames de la versión fijada, en la caché de npx; None si no se encuentra."""
    cache = os.path.join(os.environ.get('LOCALAPPDATA', ''), 'npm-cache', '_npx')
    version = skillenv.HYPERFRAMES.split('@')[-1]
    for d in sorted(os.listdir(cache)) if os.path.isdir(cache) else []:
        base = os.path.join(cache, d, 'node_modules', 'hyperframes')
        info = serve.read_json(os.path.join(base, 'package.json'), None)
        if isinstance(info, dict) and (not version or info.get('version') == version):
            full = os.path.join(base, 'dist', 'hyperframe-runtime.js')
            if os.path.isfile(full):
                return full
    return None


def exacta_html():
    """La composición tal como la pinta el render, para verla en el navegador: el index.html con sus rutas en /p/ y el runtime de HyperFrames."""
    with open(os.path.join(PROJECT, 'index.html'), encoding='utf-8') as f:
        html = f.read()
    # __timelines lo crea el servidor de HyperFrames antes de los scripts de la composición
    html = re.sub(r'(<head[^>]*>)', r'\1<base href="/p/"><script>window.__timelines=window.__timelines||{};</script>', html, count=1)
    i = html.lower().rfind('</body>')
    tag = '<script src="/mi/hf-runtime.js"></script>'
    return html[:i] + tag + html[i:] if i >= 0 else html + tag


def preparar_exacta(edits):
    """Ver resultado: guarda lo que hay en la página y lo pasa al HTML. Devuelve un texto de error o None."""
    if not os.path.isfile(os.path.join(PROJECT, 'index.html')):
        return 'Este proyecto aún no está montado: pulsa Procesar vídeo una vez y podrás ver el resultado.'
    if not hf_runtime():
        return 'No encuentro HyperFrames en este ordenador.'
    cleaned = clean_edicion(edits)
    if isinstance(cleaned, str):
        return cleaned
    guardar_edits(cleaned)
    try:
        aplicar.aplicar(PROJECT)
    except Exception as e:      # noqa: BLE001 - el panel enseña el motivo
        return 'No se pudieron aplicar los JSON: %s' % e
    return None


def directo():
    """Si se puede exportar sin pasar por Claude: hay un montaje al día y el proyecto no tiene pasos propios tras el render."""
    html = os.path.join(PROJECT, 'index.html')
    if not os.path.isfile(html):
        return False, 'aún no está montado'
    if os.path.isfile(os.path.join(edicion_dir(), 'audio.json')):
        return False, 'tiene mezcla de audio propia'
    conf = serve.read_json(os.path.join(edicion_dir(), 'render.json'), {}) or {}
    if conf.get('directo') is False:
        return False, str(conf.get('motivo') or 'tiene pasos propios después del render')
    work = os.path.join(PROJECT, 'work')        # scripts propios tras el render (glitch_post.py, mixdown.py...): exportar directo se los saltaría
    if os.path.isdir(work) and any(f.endswith('.py') and re.search(r'post|mix', f) for f in os.listdir(work)):
        return False, 'tiene pasos propios después del render'
    for name in ('edl.json', 'plan.json', 'words.json'):
        p = os.path.join(PROJECT, name)
        if os.path.isfile(p) and os.path.getmtime(p) > os.path.getmtime(html):
            return False, 'el último cambio aún no está montado'
    return True, ''


def run_lint():
    if not os.path.isfile(os.path.join(PROJECT, 'index.html')):
        return {'ok': False, 'findings': [], 'error': 'Este proyecto aún no está montado.'}
    r = subprocess.run(hf_cmd('lint', '--json'), capture_output=True, text=True, encoding='utf-8', errors='replace')
    try:
        out = json.loads(r.stdout[r.stdout.index('{'):])
    except ValueError:
        out = {'ok': False, 'findings': [], 'error': (r.stderr or r.stdout)[-400:]}
    out['findings'] = (out.get('findings') or []) + [
        {'severity': 'warning', 'file': rel, 'message': 'Este vídeo está en HDR.', 'fixHint': 'Al exportar se pasa solo a color normal.' if puede else hdr.aviso(rel)}
        for rel, _trc, puede in hdr.en_hdr(PROJECT)]
    return out


def siguiente_version():
    """<proyecto>-vN con el siguiente N libre, como los renders de siempre."""
    base = os.path.basename(PROJECT)
    usados = [int(m.group(1)) for f in (os.listdir(os.path.join(PROJECT, 'renders')) if os.path.isdir(os.path.join(PROJECT, 'renders')) else [])
              for m in [re.fullmatch(re.escape(base) + r'-v(\d+)\.\w+', f)] if m]
    return '%s-v%d' % (base, max(usados, default=0) + 1)


def start_render(opts, edits, server=None):
    """Exporta el montaje actual sin pasar por Claude: aplica los JSON al HTML y lanza el render de HyperFrames.
    Con --until-saved, al acabar se cierra: Claude ve STATUS render DONE, hace las comprobaciones y entrega."""
    if RENDER['running']:
        return 'Ya hay un render en marcha.'
    if not os.path.isfile(os.path.join(PROJECT, 'index.html')):
        return 'Este proyecto aún no está montado: pulsa Procesar vídeo primero.'
    cleaned = clean_edicion(edits)
    if isinstance(cleaned, str):
        return cleaned
    guardar_edits(cleaned)
    fmt = opts.get('format') if opts.get('format') in ('mp4', 'webm', 'mov') else 'mp4'
    quality = opts.get('quality') if opts.get('quality') in ('draft', 'standard', 'high') else 'high'
    name = re.sub(r'[^\w.-]+', '-', str(opts.get('name') or '')).strip('-') or siguiente_version()
    out = 'renders/%s.%s' % (name, fmt)
    # --sdr siempre: en su modo HDR HyperFrames saca el vídeo sin capas de texto y sin ningún error (ver hdr.py)
    args = ['render', '-o', out, '--quality', quality, '--format', fmt, '--sdr']
    if opts.get('fps') in (24, 25, 30, 60):
        args += ['--fps', opts['fps']]

    def work():
        RENDER.update(running=True, log='', output=None, error=None, started=time.time(), avisos=[], parar=False)
        try:
            aplicar.aplicar(PROJECT)
            RENDER['avisos'] = hdr.arreglar(PROJECT, lambda c: RENDER.update(proc=c), lambda m: RENDER.update(log=RENDER['log'] + m + '\n'))
            if RENDER['parar']:
                RENDER.update(running=False, proc=None, avisos=[])
                return
            for a in RENDER['avisos']:
                serve.say('STATUS render AVISO %s' % a)
            p = subprocess.Popen(hf_cmd(*args), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding='utf-8', errors='replace')
            RENDER['proc'] = p
            for line in p.stdout:
                RENDER['log'] = (RENDER['log'] + line)[-6000:]
                if server:
                    server.seen()       # aunque se cierre la pestaña, el render sigue hasta el final
            p.wait()
            if p.returncode == 0:
                RENDER['output'] = out
                serve.say('STATUS render DONE %s' % out)
                if UNTIL_SAVED and server:
                    threading.Timer(4.0, server.stop_soon).start()
            else:
                RENDER['error'] = RENDER['log'][-400:] or 'El render falló.'
        except Exception as e:      # noqa: BLE001 - el panel enseña el motivo
            RENDER['error'] = str(e)
        RENDER.update(running=False, proc=None)
    threading.Thread(target=work, daemon=True).start()
    return None


def render_status():
    log = RENDER['log']
    m = re.findall(r'(\d{1,3})\s?%', log)
    return {'running': RENDER['running'], 'pct': int(m[-1]) if m else None, 'output': RENDER['output'], 'error': RENDER['error'], 'log': log[-800:], 'cierra': UNTIL_SAVED,
            'elapsed': round(time.time() - RENDER['started']) if RENDER['started'] else 0,
            'avisos': RENDER['avisos'], 'hdr': [] if RENDER['running'] else [{'path': r, 'puede': c, 'aviso': hdr.aviso(r)} for r, _t, c in hdr.en_hdr(PROJECT)]}


def list_blocks():
    """Bloques y componentes del catálogo de HyperFrames (hyperframes catalog --json). Se guarda en work/mi-estudio."""
    cache = os.path.join(PROJECT, 'work', 'mi-estudio', 'bloques.json')
    if os.path.isfile(cache) and time.time() - os.path.getmtime(cache) < 86400:
        return serve.read_json(cache, {'items': []})
    r = subprocess.run(hf_cmd('catalog', '--json'), capture_output=True, text=True, encoding='utf-8', errors='replace')
    try:
        data = json.loads(r.stdout[min(i for i in (r.stdout.find('{'), r.stdout.find('[')) if i >= 0):])
    except ValueError:
        return {'items': [], 'error': (r.stderr or r.stdout)[-300:]}
    data = {'items': data} if isinstance(data, list) else data
    os.makedirs(os.path.dirname(cache), exist_ok=True)
    serve.write_picks(cache, data)
    return data


def add_block(name):
    if not serve.KEY_RE.match(str(name)):
        return None, 'Bloque no válido.'
    r = subprocess.run(hf_cmd('add', name, '--json'), capture_output=True, text=True, encoding='utf-8', errors='replace')
    if r.returncode != 0:
        return None, (r.stderr or r.stdout)[-300:]
    return (r.stdout or '').strip()[-1200:], None


def list_fonts():
    """Las fuentes que ya hay: las del proyecto y las descargadas por video-studio."""
    out = []
    for root, url in ((os.path.join(PROJECT, 'assets', 'fonts'), '/p/assets/fonts/'),):
        for f in sorted(os.listdir(root)) if os.path.isdir(root) else []:
            if os.path.splitext(f)[1].lower() in ('.woff2', '.woff', '.ttf', '.otf'):
                out.append({'file': f, 'url': url + urllib.parse.quote(f), 'family': re.split(r'[-_.]', f)[0]})
    return out


class Handler(serve.Handler):
    server_version = 'MiEstudio/1'

    def route_get(self, head=False):
        path = urllib.parse.urlsplit(self.path).path
        if not self.host_ok():
            return super().route_get(head)
        if path in ('/', '/index.html'):
            self.server.seen()
            return self.send_file(os.path.join(HERE, 'index.html'), head)
        if path in ('/mi/timeline.js', '/mi/timeline.css'):
            return self.send_file(os.path.join(HERE, path.split('/')[-1]), head)
        if path.startswith('/mi/herramientas/') and path.endswith('.js') and serve.KEY_RE.match(path[17:-3]):
            return self.send_file(os.path.join(HERE, 'herramientas', path[17:]), head)
        if path.startswith('/mi/formatos/'):
            parts = path.split('/')[3:]
            folder = formato_dir(parts[0]) if len(parts) == 2 and '..' not in parts and serve.KEY_RE.match(parts[0]) else None
            full = os.path.join(folder, parts[1]) if folder else ''
            return self.send_file(full, head) if full and serve.inside(folder, full) else self.fail(404, 'Not found.')
        if path.startswith('/mi/estilos/'):
            parts = path.split('/')[3:]
            full = os.path.join(STYLES_DIR, parts[0], 'preview', parts[1]) if len(parts) == 2 and '..' not in parts else ''
            return self.send_file(full, head) if full and serve.inside(STYLES_DIR, full) else self.fail(404, 'Not found.')
        if path == '/api/filtro':
            return self.send_json(200, load_filtro())
        if path == '/api/formatos':
            return self.send_json(200, list_formatos())
        if path == '/api/formato':
            return self.send_json(200, {'formato': load_eleccion()})
        if path == '/api/mode':
            return self.send_json(200, {'project': bool(PROJECT), 'preparar': PREPARAR, 'ficha': bool(FICHA), 'resultado': RESULTADO})
        if PROJECT and path == '/api/picks' and not os.path.isfile(self.server.config):
            return self.send_json(200, serve.load_picks(PLAT['picks'], self.server.catalog()))
        if PROJECT and path == '/api/project':
            return self.send_json(200, project_info())
        if PROJECT and path == '/api/edicion':
            return self.send_json(200, edicion_inputs())
        if path == '/api/herramientas':
            return self.send_json(200, herramientas())
        if path == '/mi/hf-runtime.js':
            full = hf_runtime()
            return self.send_file(full, head) if full else self.fail(404, 'Not found.')
        if path == '/api/ficha':
            return self.send_json(200, FICHA or {})
        if path == '/mi/ref-video':
            full = (FICHA or {}).get('video_abs')
            return self.send_file(full, head) if full and os.path.isfile(full) else self.fail(404, 'Not found.')
        if PROJECT and path == '/exacta':
            if not os.path.isfile(os.path.join(PROJECT, 'index.html')):
                return self.fail(404, 'Not found.')
            body = exacta_html().encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/html; charset=utf-8')
            self.send_header('Content-Length', str(len(body)))
            self.send_header('Cache-Control', 'no-store')
            self.end_headers()
            return None if head else self.wfile.write(body)
        qs = urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query)
        if PROJECT and path == '/api/files':
            return self.send_json(200, list_files())
        if PROJECT and path == '/api/file':
            info = read_file((qs.get('path') or [''])[0])
            return self.send_json(200, info) if info else self.fail(404, 'Archivo no encontrado.')
        if PROJECT and path == '/api/assets':
            return self.send_json(200, list_assets((qs.get('scope') or ['project'])[0]))
        if PROJECT and path.startswith('/api/asset-otro/'):
            parts = urllib.parse.unquote(path[16:]).split('/')
            root = os.path.normpath(os.path.join(os.path.dirname(PROJECT), parts[0], 'assets'))
            full = os.path.normpath(os.path.join(root, *parts[1:]))
            ok = dentro(os.path.dirname(PROJECT), root) and dentro(root, full)
            return self.send_file(full, head) if ok else self.fail(404, 'Not found.')
        if PROJECT and path == '/api/referencias':
            mias = {os.path.basename(r) for r in referencias()}
            return self.send_json(200, {'proyecto': referencias(), 'descargas': [{'name': os.path.basename(f), 'mtime': m} for f, m in descargas() if os.path.basename(f) not in mias][:20]})
        if PROJECT and path == '/api/renders':
            return self.send_json(200, list_renders())
        if PROJECT and path == '/api/render/status':
            return self.send_json(200, render_status())
        if PROJECT and path == '/api/blocks':
            return self.send_json(200, list_blocks())
        if PROJECT and path == '/api/fonts':
            return self.send_json(200, list_fonts())
        if PROJECT and path.startswith('/api/strip/') and path[11:] in SOURCES:
            return self.send_json(200, strip(path[11:]))
        if PROJECT and path.startswith('/p/'):
            full = os.path.normpath(os.path.join(PROJECT, *urllib.parse.unquote(path[3:]).split('/')))
            return self.send_file(full, head) if serve.inside(PROJECT, full) else self.fail(404, 'Not found.')
        if PROJECT and path.startswith('/api/peaks/') and path[11:] in SOURCES:
            return self.send_json(200, peaks(path[11:]))
        if PROJECT and path.startswith('/src/') and path[5:] in SOURCES:
            return self.send_file(preview_or_source(path[5:]), head)
        return super().route_get(head)

    def read_body(self):
        try:
            length = int(self.headers.get('Content-Length') or '0')
            return json.loads(self.rfile.read(length).decode('utf-8')) if 0 < length <= 4 * serve.MAX_BODY else None
        except (ValueError, UnicodeDecodeError):
            return None

    def save_timeline(self):
        self.body = self.read_body()
        result = clean_timeline(self.body)
        if isinstance(result, str):
            return self.fail(400, result)
        edl, effects, elementos, formato, picks = result
        edits = clean_edicion((self.body or {}).get('edicion'))
        if isinstance(edits, str):
            return self.fail(400, edits)
        try:
            subs = edicion.aplicar_subtitulos(PROJECT, edits['capas']) if isinstance(edits.get('capas'), dict) else 0
            if isinstance(edits.get('subtitulos'), dict):
                subs += edicion.aplicar_palabras(PROJECT, edits['subtitulos'])
        except (OSError, ValueError, KeyError, TypeError, IndexError):
            return self.fail(500, 'No se pudieron guardar los subtítulos en words.json.')
        textos = ['%s:%d' % (g, len(v['texts'])) for g, v in (edits.get('capas') or {}).items()
                  if isinstance(v, dict) and v.get('texts')] + (['subtitulos:%d' % subs] if subs else [])
        edl_path = os.path.join(PROJECT, 'edl.json')
        old = serve.read_json(edl_path, [])
        changed = old != edl
        try:
            if changed and os.path.isfile(edl_path):
                shutil.copyfile(edl_path, os.path.join(PROJECT, 'edl_prev.json'))
            serve.write_picks(edl_path, edl)
            serve.write_picks(os.path.join(PROJECT, 'timeline.json'), {'effects': effects, 'elementos': elementos})
            serve.write_picks(os.path.join(PROJECT, 'formato.json'), {'formato': formato})
            serve.write_picks(self.server.config, picks)
            for tool, data in edits.items():
                serve.write_picks(os.path.join(edicion_dir(), tool + '_edit.json'), data)
        except OSError:
            return self.fail(500, 'No se pudieron guardar los archivos del proyecto.')
        self.send_json(200, {'ok': True})
        serve.say('STATUS timeline SAVED %s edl=%s segments=%d formato=%s elementos=%d effects=%s captions=%s estilo=%s edicion=%s textos=%s' % (
            PROJECT, 'changed' if changed else 'same', len(edl), formato or 'none', len(elementos),
            ','.join('%s@%.2f-%.2f' % (f['key'], f['from'], f['to']) for f in effects) or 'none', picks['captionStyle'],
            picked_style(picks), ','.join(edits) or 'none', ','.join(textos) or 'none'))
        if UNTIL_SAVED:
            threading.Timer(3.0, self.server.stop_soon).start()

    def save_preparar(self):
        raw = self.read_body()
        if not isinstance(raw, dict):
            return self.fail(400, 'Datos no válidos.')
        key = raw.get('formato')
        if key is not None and key not in {f['key'] for f in list_formatos()}:
            return self.fail(400, 'Formato desconocido.')
        picks = None
        if raw.get('picks') is not None:
            picks, error = serve.check_picks(raw['picks'], serve.build_catalog())
            if error:
                return self.fail(400, error)
        correccion = str(raw.get('correccion') or '').strip()[:4000]
        try:
            serve.write_picks(ELECCION, {'formato': key})
            if picks:
                serve.write_picks(self.server.config, picks)
            if FICHA and correccion:            # lo que el usuario corrigió de la ficha: Claude lo lee antes de cortar
                FICHA['correccion'] = correccion
                serve.write_picks(FICHA_PATH, FICHA)
        except OSError:
            return self.fail(500, 'No se pudo guardar.')
        self.send_json(200, {'ok': True})
        serve.say('STATUS preparar SAVED formato=%s captions=%s effects=%s estilo=%s ficha=%s' % (
            key or 'none', picks['captionStyle'] if picks else 'none',
            ','.join(picks['effects']) if picks and picks['effects'] else 'none', picked_style(picks),
            ('corregida' if correccion else 'ok') if FICHA else 'none'))
        if UNTIL_SAVED:
            threading.Timer(3.0, self.server.stop_soon).start()

    def upload(self):
        """Un medio arrastrado al panel Medios: el cuerpo es el archivo; se guarda en assets/imported/<nombre>."""
        name = os.path.basename((urllib.parse.parse_qs(urllib.parse.urlsplit(self.path).query).get('name') or [''])[0])
        if not name or os.path.splitext(name)[1].lower() not in TIPOS:
            return self.fail(400, 'Ese tipo de archivo no se puede importar.')
        length = int(self.headers.get('Content-Length') or '0')
        dest = os.path.join(PROJECT, 'assets', 'imported', name)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        with open(dest, 'wb') as f:
            left = length
            while left > 0:
                chunk = self.rfile.read(min(1 << 20, left))
                if not chunk:
                    break
                f.write(chunk)
                left -= len(chunk)
        return self.send_json(200, {'path': 'assets/imported/' + name, 'url': '/p/assets/imported/' + urllib.parse.quote(name), 'type': TIPOS[os.path.splitext(name)[1].lower()]})

    def project_post(self, path):
        """Las peticiones de los paneles de la Edición."""
        if path == '/api/upload':
            return self.upload()
        raw = self.read_body()
        raw = raw if isinstance(raw, dict) else {}
        if path == '/api/file':
            err = write_file(str(raw.get('path') or ''), raw.get('text'))
            return self.fail(400, err) if err else self.send_json(200, {'ok': True})
        if path == '/api/assets/import':
            rel = import_asset(raw.get('project'), raw.get('path'))
            return self.send_json(200, {'path': rel}) if rel else self.fail(404, 'No se encontró ese medio.')
        if path == '/api/renders/delete':
            full = in_project('renders/' + os.path.basename(str(raw.get('name') or '')))
            if not full or not os.path.isfile(full):
                return self.fail(404, 'No se encontró ese render.')
            os.remove(full)
            return self.send_json(200, {'ok': True})
        if path == '/api/render':
            err = start_render(raw.get('opts') if isinstance(raw.get('opts'), dict) else {}, raw.get('edicion'), self.server)
            return self.fail(400, err) if err else self.send_json(200, {'ok': True})
        if path == '/api/render/cancel':
            p = RENDER.get('proc')
            RENDER['parar'] = True
            if p and os.name == 'nt':       # hf.py lanza node, y node lanza Chrome: hay que parar el árbol entero
                subprocess.run(['taskkill', '/T', '/F', '/PID', str(p.pid)], capture_output=True)
            elif p:
                p.terminate()
            return self.send_json(200, {'ok': True})
        if path == '/api/snapshot':
            url, err = snapshot_frame(raw.get('t') or 0, raw.get('edicion'))
            return self.fail(400, err) if err else self.send_json(200, {'url': url})
        if path == '/api/referencias/usar':
            f = os.path.join(EXAMPLES, 'downloads', os.path.basename(str(raw.get('name') or '')))
            return self.send_json(200, {'path': adoptar(f)}) if os.path.isfile(f) else self.fail(404, 'No se encontró esa descarga.')
        if path == '/api/referencias/url':
            rel, err = referencia_url(raw.get('url'))
            return self.fail(400, err) if err else self.send_json(200, {'path': rel})
        if path == '/api/exacta':
            err = preparar_exacta(raw.get('edicion'))
            return self.fail(400, err) if err else self.send_json(200, {'url': '/exacta?v=%d' % int(time.time() * 1000)})
        if path == '/api/lint':
            return self.send_json(200, run_lint())
        if path == '/api/blocks/add':
            out, err = add_block(raw.get('name'))
            return self.fail(400, err) if err else self.send_json(200, {'ok': True, 'output': out})
        return self.fail(404, 'Not found.')

    def do_POST(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == '/api/preparar' and PREPARAR and self.host_ok() and self.origin_ok():
            return self.save_preparar()
        if PROJECT and path in ('/api/upload', '/api/file', '/api/assets/import', '/api/renders/delete', '/api/render', '/api/render/cancel', '/api/snapshot', '/api/exacta', '/api/lint', '/api/blocks/add', '/api/referencias/usar', '/api/referencias/url'):
            if not self.host_ok() or not self.origin_ok():
                return self.fail(403, 'Solo desde localhost.')
            return self.project_post(path)
        if path not in ('/api/filtro', '/api/timeline', '/api/formato'):
            return super().do_POST()
        if not self.host_ok() or not self.origin_ok():
            return self.fail(403, 'Solo desde localhost.')
        if path == '/api/timeline':
            return self.save_timeline() if PROJECT else self.fail(404, 'No hay proyecto abierto.')
        raw = self.read_body()
        if path == '/api/formato':
            key = raw.get('formato') if isinstance(raw, dict) else 'x'
            if key is not None and key not in {f['key'] for f in list_formatos()}:
                return self.fail(400, 'Formato desconocido.')
            try:
                serve.write_picks(eleccion_path(), {'formato': key})
            except OSError:
                return self.fail(500, 'No se pudo guardar el formato.')
            serve.say('STATUS formato SAVED %s' % (key or 'none'))
            return self.send_json(200, {'ok': True})
        if not isinstance(raw, dict):
            return self.fail(400, 'Filtro no válido.')
        filtro = {}
        for s in SECTIONS:
            keys = raw.get(s, [])
            if not isinstance(keys, list) or any(not isinstance(k, str) or not serve.KEY_RE.match(k) for k in keys):
                return self.fail(400, 'Filtro no válido.')
            filtro[s] = list(dict.fromkeys(keys))
        try:
            serve.write_picks(FILTRO, filtro)
        except OSError:
            return self.fail(500, 'No se pudo guardar el filtro.')
        return self.send_json(200, {'ok': True})


serve.Handler = Handler          # serve.Picker crea el servidor con el Handler de su módulo


def main():
    ap = argparse.ArgumentParser(description='Mi Estudio')
    ap.add_argument('--port', type=int, default=4848)
    ap.add_argument('--no-open', action='store_true')
    ap.add_argument('--until-saved', action='store_true')
    ap.add_argument('--project')
    ap.add_argument('--preparar', action='store_true')
    ap.add_argument('--ficha', help='ficha de la referencia (ficha.py): se enseña antes de cortar')
    ap.add_argument('--referencia', action='append', default=[], help='con --project: vídeo de referencia (el archivo que imprime get_example.py); se copia a ref/')
    ap.add_argument('--resultado', action='store_true', help='con --project: abre enseñando el vídeo montado, para aprobarlo antes del render')
    args = ap.parse_args()

    global PROJECT, UNTIL_SAVED, PREPARAR, FICHA, FICHA_PATH, RESULTADO
    RESULTADO = args.resultado
    if args.ficha:
        FICHA_PATH = os.path.abspath(args.ficha)
        FICHA = serve.read_json(FICHA_PATH, None)
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    picks = PLAT['picks']
    if args.project:
        PROJECT = os.path.abspath(os.path.expanduser(args.project))
        if not os.path.isfile(os.path.join(PROJECT, 'edl.json')):
            serve.warn('el proyecto no tiene edl.json: %s' % PROJECT)
            return 2
        for clip, path in (serve.read_json(os.path.join(PROJECT, 'sources.json'), {}) or {}).items():
            if isinstance(path, str) and os.path.isfile(os.path.normpath(path)):
                SOURCES[clip] = os.path.normpath(path)
                PREVIEWS[clip] = threading.Event()
        picks = os.path.join(PROJECT, 'picks.json')
        edicion.montado(PROJECT)                # antes de guardar nada: con qué valores de Capas está montado
        UNTIL_SAVED = args.until_saved          # en modo proyecto se cierra al guardar la línea de tiempo
        for f in args.referencia:
            if os.path.isfile(f):
                serve.say('STATUS referencia %s' % adoptar(f))
            else:
                serve.warn('no existe la referencia: %s' % f)
        referencia_auto()
    elif args.preparar:
        PREPARAR = True
        UNTIL_SAVED = args.until_saved          # se cierra al pulsar Empezar a editar
    elif args.until_saved:
        say = serve.say

        def say_and_stop(line):
            say(line)
            if line.startswith('STATUS picks SAVED'):
                threading.Timer(3.0, server.stop_soon).start()
        serve.say = say_and_stop

    os.makedirs(os.path.dirname(picks), exist_ok=True)
    server = None
    for port in (args.port, 0):
        try:
            server = serve.Picker(('127.0.0.1', port), picks, serve.DEFAULT_CAPTIONS)
            break
        except OSError:
            continue
    if server is None:
        serve.warn('no se pudo abrir ningún puerto')
        return 2

    url = 'http://127.0.0.1:%d/' % server.server_address[1]
    serve.say('STATUS picker READY ' + url)
    serve.say('STATUS picks FILE %s' % picks)
    threading.Thread(target=server.watch, daemon=True).start()
    if PROJECT:
        threading.Thread(target=make_previews, daemon=True).start()
    if not args.no_open:
        threading.Thread(target=lambda: webbrowser.open(url), daemon=True).start()
    try:
        server.serve_forever(poll_interval=0.25)
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()
        serve.say('STATUS picker CLOSED')
    return 0


if __name__ == '__main__':
    sys.exit(main())
