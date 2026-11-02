"""Datos de las herramientas de la pestaña Edición de Mi Estudio (Capas, Audio y las que se añadan).

Cada herramienta con datos del proyecto tiene dos archivos en <proyecto>/edicion/:
    <id>.json       lo que la herramienta enseña (lo escribe el script del plan o de las pistas con ofrecer())
    <id>_edit.json  lo que el usuario dejó al pulsar Procesar vídeo (lo escribe Mi Estudio; se lee con editado())

    sys.path.insert(0, r'<MI>'); import edicion
    v = edicion.editado(proj, 'capas', {'card': {'left': 100, 'top': 790, 'width': 880}})   # lo suyo encima de lo propuesto
    edicion.ofrecer(proj, 'capas', {...})                                                   # ver SKILL.md, "Pestaña Edición"
    nombre = edicion.texto(proj, 'title', 'title_bigfish', 'BIG FISH')                      # texto de un item de Capas
    edicion.reaplicar_subtitulos(proj)          # tras volver a transcribir: los subtítulos cambiados, otra vez en words.json
"""
import html as _html
import json
import os
import re


def _path(proj, name):
    return os.path.join(proj, 'edicion', name + '.json')


def editado(proj, tool, defaults):
    """Lo propuesto (defaults) con lo que el usuario cambió en Mi Estudio encima, grupo a grupo."""
    out = json.loads(json.dumps(defaults))
    p = _path(proj, tool + '_edit')
    saved = json.load(open(p, encoding='utf-8')) if os.path.isfile(p) else {}
    for k, v in saved.items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k].update(v)
        else:
            out[k] = v
    if tool == 'capas' and defaults:            # con esto se monta el vídeo: aplicar.py cuenta lo que cambie después desde aquí
        p = _montado_path(proj)
        os.makedirs(os.path.dirname(p), exist_ok=True)
        json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    return out


def _montado_path(proj):
    return os.path.join(proj, 'work', 'mi-estudio', 'capas_montadas.json')


def montado(proj):
    """Los valores de Capas con los que está montado el index.html base. En un proyecto de antes de guardarlos: lo último guardado, que
    siempre se montaba al procesar. Se apunta para que no cambie al guardar lo siguiente: Mi Estudio lo llama al abrir."""
    p, e = _montado_path(proj), _path(proj, 'capas_edit')
    if os.path.isfile(p):
        return json.load(open(p, encoding='utf-8'))
    out = json.load(open(e, encoding='utf-8')) if os.path.isfile(e) else {}
    os.makedirs(os.path.dirname(p), exist_ok=True)
    json.dump(out, open(p, 'w', encoding='utf-8'), ensure_ascii=False)
    return out


def ofrecer(proj, tool, data):
    """Escribe lo que la herramienta enseña en Mi Estudio."""
    os.makedirs(os.path.join(proj, 'edicion'), exist_ok=True)
    json.dump(data, open(_path(proj, tool), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def texto(proj, grupo, el, por_defecto):
    """El texto de un item de Capas (su "el", o su índice si no tiene) tal como lo dejó el usuario, o el propuesto."""
    return editado(proj, 'capas', {}).get(grupo, {}).get('texts', {}).get(str(el), por_defecto)


# ---------- subtítulos: los textos cambiados en Capas van a words.json ----------

def _es_subtitulos(g):
    return g.get('words') is True or g.get('id') == 'subs'


def _texto_html(h):
    partes = [p.strip() for p in re.split(r'<[^>]*>', h or '')]
    return _html.unescape(max(partes, key=len)) if partes else ''


def _cambiar(words, viejo, nuevo, at, rango=None):
    """Cambia en words las palabras que dicen `viejo` (las de rango [primera, última], o las más cercanas al segundo at)
    por `nuevo`. Mismo número de palabras: solo el texto; si no, reparte el tramo entre las nuevas. True si lo hizo."""
    old, new = viejo.split(), nuevo.split()
    textos = [w['text'] for w in words]
    if not old:
        return False
    if rango and textos[rango[0]:rango[1] + 1] == old:
        i = rango[0]
    else:
        hits = [k for k in range(len(words) - len(old) + 1) if textos[k:k + len(old)] == old]
        if not hits:
            return False
        i = min(hits, key=lambda k: abs(words[k]['start'] - at))
    run = words[i:i + len(old)]
    if len(new) == len(run):
        for w, t in zip(run, new):
            w['text'] = t
        return True
    a, z, x, out = run[0]['start'], run[-1]['end'], run[0]['start'], []
    tot, base = sum(len(t) + 1 for t in new), lambda t: re.sub(r'\W', '', t.lower())
    for t in new:
        y = x + (z - a) * (len(t) + 1) / tot
        w = next((dict(r) for r in run if base(r['text']) == base(t)), {})   # las que siguen (sin mirar signos) guardan sus marcas
        w.update(text=t, start=round(x, 3), end=round(y, 3))
        out.append(w)
        x = y
    words[i:i + len(old)] = out
    return True


def aplicar_subtitulos(proj, edits):
    """Procesar vídeo (lo llama Mi Estudio): los textos cambiados de los grupos de subtítulos de capas_edit (edits)
    van a words.json, a capas.json (la vista previa ya los enseña) y al registro edicion/subtitulos.json, y salen
    de edits. Devuelve cuántos cambió."""
    capas_p, words_p, log_p = _path(proj, 'capas'), os.path.join(proj, 'words.json'), _path(proj, 'subtitulos')
    if not (os.path.isfile(capas_p) and os.path.isfile(words_p)):
        return 0
    C = json.load(open(capas_p, encoding='utf-8'))
    words = json.load(open(words_p, encoding='utf-8'))
    log = json.load(open(log_p, encoding='utf-8')) if os.path.isfile(log_p) else []
    n = 0
    for g in C.get('groups', []):
        texts = (edits.get(g['id']) or {}).get('texts') if _es_subtitulos(g) else None
        for k in list(texts or {}):
            it = next((x for x in g['items'] if x.get('el') == k), None) or \
                (g['items'][int(k)] if k.isdigit() and int(k) < len(g['items']) else None)
            if it is None:
                continue
            viejo, nuevo = it.get('text') or _texto_html(it.get('html')), ' '.join(str(texts[k]).split())
            if nuevo != viejo:
                if not _cambiar(words, viejo, nuevo, it.get('from', 0), it.get('words')):
                    continue                                    # no se encontró: se queda en capas_edit.json
                log.append({'old': viejo, 'new': nuevo, 'at': it.get('from', 0)})
                it['html'] = (it.get('html') or '').replace(_html.escape(viejo, quote=False), _html.escape(nuevo, quote=False), 1)
                it['text'] = nuevo
                n += 1
            del texts[k]
        if texts == {}:
            edits[g['id']].pop('texts')
    if n:
        json.dump(words, open(words_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        json.dump(C, open(capas_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        json.dump(log, open(log_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return n


def aplicar_palabras(proj, edit):
    """Procesar vídeo (lo llama Mi Estudio): las palabras que el usuario dejó en el panel Subtítulos, {"words": [{text, start, end}]},
    van a words.json. Las cambiadas se apuntan en edicion/subtitulos.json para reaplicar_subtitulos. Devuelve cuántas cambiaron."""
    new, words_p, log_p = edit.pop('words', None), os.path.join(proj, 'words.json'), _path(proj, 'subtitulos')
    if not isinstance(new, list) or not os.path.isfile(words_p):
        return 0
    old = json.load(open(words_p, encoding='utf-8'))
    log = json.load(open(log_p, encoding='utf-8')) if os.path.isfile(log_p) else []
    out, n = [], 0
    for i, w in enumerate(new):
        base = dict(old[i]) if len(new) == len(old) else {}
        base.update(text=str(w['text']), start=round(float(w['start']), 3), end=round(float(w['end']), 3))
        out.append(base)
        if len(new) == len(old) and old[i]['text'] != base['text']:
            log.append({'old': old[i]['text'], 'new': base['text'], 'at': base['start']})
            n += 1
    if out != old:
        n = n or 1
        json.dump(out, open(words_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        json.dump(log, open(log_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return n


def variable(proj, nombre, por_defecto=None):
    """El valor de una variable del panel Variables (edicion/variables_edit.json), o el valor por defecto."""
    v = editado(proj, 'variables', {}).get('vars', {}).get(nombre)
    return v.get('value', por_defecto) if isinstance(v, dict) else por_defecto


_FX_FFMPEG = {
    'gain': lambda p: 'volume=%sdB' % p.get('gain', 0),
    'peaking': lambda p: 'equalizer=f=%s:t=q:w=%s:g=%s' % (p.get('frequency', 1000), p.get('q', 1), p.get('gain', 0)),
    'lowshelf': lambda p: 'bass=f=%s:g=%s' % (p.get('frequency', 200), p.get('gain', 0)),
    'highshelf': lambda p: 'treble=f=%s:g=%s' % (p.get('frequency', 4000), p.get('gain', 0)),
    'highpass': lambda p: 'highpass=f=%s:p=%s' % (p.get('frequency', 300), p.get('poles', '2')),
    'lowpass': lambda p: 'lowpass=f=%s:p=%s' % (p.get('frequency', 8000), p.get('poles', '2')),
    'compressor': lambda p: 'acompressor=threshold=%sdB:ratio=%s:attack=%s:release=%s:makeup=%sdB:mix=%s' % (
        p.get('threshold', -24), p.get('ratio', 4), p.get('attack', 20), p.get('release', 250), p.get('makeup', 0), p.get('mix', 1)),
    'limiter': lambda p: 'alimiter=limit=%s:attack=%s:release=%s' % (round(10 ** (p.get('limit', -1) / 20), 4), p.get('attack', 5), p.get('release', 50)),
    'gate': lambda p: 'agate=threshold=%s:ratio=%s:attack=%s:release=%s' % (round(10 ** (p.get('threshold', -35) / 20), 5), p.get('ratio', 10), p.get('attack', 1), p.get('release', 100)),
    'delay': lambda p: 'aecho=1:%s:%s:%s' % (p.get('mix', .4) if p.get('mix', .4) > 0 else .01, p.get('time', 250), p.get('feedback', .35)),
    'chorus': lambda p: 'chorus=0.7:0.9:%s:0.4:%s:2' % (p.get('delay', 25), p.get('rate', p.get('speed', .5))),
    'phaser': lambda p: 'aphaser=speed=%s' % p.get('speed', p.get('rate', .5)),
    'pitchshift': lambda p: 'rubberband=pitch=%s' % round(2 ** (p.get('semitones', 0) / 12), 5),
    'bitcrush': lambda p: 'acrusher=bits=%s:samples=%s:mix=%s' % (p.get('bits', 8), p.get('samples', 1), p.get('mix', 1)),
    'saturate': lambda p: 'asoftclip=type=%s' % {'tanh': 'tanh', 'atan': 'atan', 'cubic': 'cubic', 'exp': 'exp', 'alg': 'alg', 'quintic': 'quintic', 'sin': 'sin', 'erf': 'erf', 'hard': 'hard'}.get(p.get('type', 'tanh'), 'tanh'),
}


def filtro_audio(proj, pista):
    """La cadena de Audio FX de una pista como filtro de ffmpeg ("-af"), para los vídeos cuya mezcla final se hace con
    ffmpeg (mixdown de pistas). Devuelve '' si no tiene. La reverb no tiene equivalente directo y se salta."""
    cad = editado(proj, 'audiofx', {}).get('chains', {}).get(pista) or {}
    parts = [_FX_FFMPEG[n['type']](n.get('params') or {}) for n in cad.get('nodes', []) if n.get('enabled', True) and n.get('type') in _FX_FFMPEG]
    return ','.join(parts)


def reaplicar_subtitulos(proj):
    """Después de volver a transcribir (transcribe_cut.py reescribe words.json): vuelve a poner los subtítulos que el
    usuario cambió en Mi Estudio (edicion/subtitulos.json). Salta los que ya están. Devuelve cuántos puso."""
    log_p, words_p = _path(proj, 'subtitulos'), os.path.join(proj, 'words.json')
    if not (os.path.isfile(log_p) and os.path.isfile(words_p)):
        return 0
    words = json.load(open(words_p, encoding='utf-8'))
    n = 0
    for c in json.load(open(log_p, encoding='utf-8')):
        textos, old, new = [w['text'] for w in words], c['old'].split(), c['new'].split()
        near = lambda seq: min((abs(words[k]['start'] - c['at']) for k in range(len(words) - len(seq) + 1)
                                if seq and textos[k:k + len(seq)] == seq), default=None)
        o, d = near(old), near(new)
        if o is not None and (d is None or o < d) and _cambiar(words, c['old'], c['new'], c['at']):
            n += 1
    if n:
        json.dump(words, open(words_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    return n
