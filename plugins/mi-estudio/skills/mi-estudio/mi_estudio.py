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
import shutil
import subprocess
import sys
import threading
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
import serve  # noqa: E402
import edicion  # noqa: E402


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
    return {'name': os.path.basename(PROJECT), 'fps': 30, 'edl': edl, 'clips': clips,
            'effects': timeline.get('effects') or [], 'elementos': timeline.get('elementos') or []}


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
    return out


def clean_edicion(raw):
    """Lo que cada herramienta dejó: {<id>: {...}} solo para herramientas con datos, números y textos cortos."""
    if raw is None:
        return {}
    if not isinstance(raw, dict):
        return 'Datos de edición no válidos.'
    known = set(edicion_inputs())

    def ok(v, depth=0):
        if isinstance(v, bool) or isinstance(v, (int, float)):
            return True
        if isinstance(v, str):
            return len(v) <= 200
        if isinstance(v, dict) and depth < 3 and len(v) <= 200:
            return all(isinstance(k, str) and len(k) <= 60 and ok(x, depth + 1) for k, x in v.items())
        if isinstance(v, list) and depth < 3 and len(v) <= 200:
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
            return self.send_json(200, {'project': bool(PROJECT), 'preparar': PREPARAR})
        if PROJECT and path == '/api/picks' and not os.path.isfile(self.server.config):
            return self.send_json(200, serve.load_picks(PLAT['picks'], self.server.catalog()))
        if PROJECT and path == '/api/project':
            return self.send_json(200, project_info())
        if PROJECT and path == '/api/edicion':
            return self.send_json(200, edicion_inputs())
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
        try:
            serve.write_picks(ELECCION, {'formato': key})
            if picks:
                serve.write_picks(self.server.config, picks)
        except OSError:
            return self.fail(500, 'No se pudo guardar.')
        self.send_json(200, {'ok': True})
        serve.say('STATUS preparar SAVED formato=%s captions=%s effects=%s estilo=%s' % (
            key or 'none', picks['captionStyle'] if picks else 'none',
            ','.join(picks['effects']) if picks and picks['effects'] else 'none', picked_style(picks)))
        if UNTIL_SAVED:
            threading.Timer(3.0, self.server.stop_soon).start()

    def do_POST(self):
        path = urllib.parse.urlsplit(self.path).path
        if path == '/api/preparar' and PREPARAR and self.host_ok() and self.origin_ok():
            return self.save_preparar()
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
    args = ap.parse_args()

    global PROJECT, UNTIL_SAVED, PREPARAR
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
        UNTIL_SAVED = args.until_saved          # en modo proyecto se cierra al guardar la línea de tiempo
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
