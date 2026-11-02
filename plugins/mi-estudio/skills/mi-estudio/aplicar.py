"""Pasa los JSON de la Edición de Mi Estudio al HTML que renderiza HyperFrames.

    sys.path.insert(0, r'<MI>'); import aplicar
    r = aplicar.aplicar(proj)      # -> {'aplicado': {...}, 'avisos': [...], 'base': ..., 'index': ...}
    python aplicar.py "<proyecto>"

index.html siempre se deriva: base (el HTML tal como lo dejó build_reel.py, en work/mi-estudio/index.base.html) + JSON
(edicion/<id>_edit.json: capas, tiempos, pistas, color, audiofx, estilo, claves, libres; formato en herramientas/CONTRATO.md).
Lleva la marca <!-- mi-estudio:aplicado -->: un index.html sin ella es uno recién generado y pasa a ser la base. Sin ningún JSON
ni edicion/capas.json no se toca nada. Un JSON roto o un objetivo que no existe dan un aviso y se sigue con lo demás.

Cómo se pasa cada cosa (lo que no es obvio, comprobado con renders de HyperFrames 0.8.34):
- Posición y tamaño de las capas de edicion/capas.json: lo que se ve de cada una va en una caja .me-c de todo el lienzo con
  translate + scale respecto a los valores con los que se montó la base (edicion.montado), así no hace falta volver a correr el
  script del plan. Solo su envoltorio (el degradado que va al lado no se mueve). Ver resultado cambia esa misma caja en vivo.
- Tiempos de las capas (tiempos_edit.json): se reescriben sus líneas de la línea de tiempo: entrada, salida y animaciones propias.
- Capas de plan.json: <div id="ly<N>" class="layer" data-name="<id de la capa>">; se buscan por data-name, porque N cuenta
  también las capas fijas del estilo guardado. Los grupos son los "el" de edicion/capas.json; el de subtítulos (sin "el")
  es #caps entero.
- Las capas tienen autoAlpha y sus propias entradas (pop, slide-up) sobre #ly<N>, así que lo demás va en dos cajas nuevas dentro,
  las mismas que .cp-g y .cp-in en la vista previa: #me-ly<N> (x, y y la opacidad de Estilo) y #mi-ly<N> (el resto de las claves),
  que giran y escalan alrededor de lo que se ve, no del centro del lienzo. Las libres: #lib-<id> y #lib-<id>-i.
- data-hidden: el runtime solo lo mira en elementos con data-start, y en el render el fotograma del vídeo es un <img> al lado
  del <video> que solo se esconde si un PADRE está oculto. Por eso va una regla CSS y también en el padre del vídeo. Ocultar
  "video" solo quita la imagen: la voz es #bga (como en la vista previa).
- Color de una <img>: el runtime solo colorea las que estaban visibles al cargar o tienen data-start, así que llevan el rango
  de su capa (el snapshot las colorea igual y no sirve de prueba: hay que mirar el render). Un padre con data-start no admite
  medios con data-start: las capas libres de imagen, vídeo y bloque se enseñan con visibility en su caja.
- Efectos de sonido: bus <hf-audio-group id="sfx"> con data-audio-group en cada snd*/fx*a*: cadena y nivel se aplican a la
  suma y cada sonido conserva su volumen. Una automatización de "volume" sustituye a data-volume mientras exista.
- Eases spring(), wiggle(), custom() y hold: los registra el runtime en GSAP, se escriben tal cual. El de una clave es el del
  tramo que llega a ella.
"""
import json
import math
import os
import re
import subprocess
import sys
from html.parser import HTMLParser

import capas
import edicion

MARCA = '<!-- mi-estudio:aplicado -->'
TOOLS = ('capas', 'tiempos', 'pistas', 'color', 'audiofx', 'estilo', 'claves', 'libres')
PROPS = ('x', 'y', 'scale', 'rotation', 'rotationX', 'rotationY', 'z', 'opacity')
FX_TIPOS = {'gain', 'peaking', 'lowshelf', 'highshelf', 'highpass', 'lowpass', 'compressor', 'limiter', 'gate', 'saturate',
            'bitcrush', 'pitchshift', 'delay', 'chorus', 'phaser', 'reverb'}   # otro tipo tumba el render entero
GANANCIA_MAX = 3.98     # +12 dB, el tope de data-volume
PERSPECTIVA = 1200      # la de claves.js en la vista previa
ES_SFX = re.compile(r'^(snd\d+|fx\d+a\d+)$')
_VACIOS = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
_TEXTO = {'color', 'letter-spacing', 'line-height', 'text-align', 'text-transform', '-webkit-text-stroke', 'text-shadow'}   # y font-*


# ---------- HTML: se edita sobre el texto original, sin reescribir lo demás ----------

class _Nodo:
    def __init__(self, tag, attrs, a, b, padre):
        self.tag, self.attrs, self.a, self.b, self.padre, self.fin = tag, attrs, a, b, padre, None

    def dentro(self, otro):
        n = self.padre
        while n is not None and n is not otro:
            n = n.padre
        return n is otro


class _Dom(HTMLParser):
    def __init__(self, texto):
        super().__init__(convert_charrefs=False)
        self.nodos, self._pila = [], []
        self._lin = [0] + [m.end() for m in re.finditer('\n', texto)]
        self.feed(texto)
        self.close()

    def _pos(self):
        lin, col = self.getpos()
        return self._lin[lin - 1] + col

    def handle_starttag(self, tag, attrs):
        a = self._pos()
        n = _Nodo(tag, dict(attrs), a, a + len(self.get_starttag_text()), self._pila[-1] if self._pila else None)
        self.nodos.append(n)
        if tag not in _VACIOS:
            self._pila.append(n)

    def handle_endtag(self, tag):
        for i in range(len(self._pila) - 1, -1, -1):
            if self._pila[i].tag == tag:
                for n in self._pila[i:]:
                    n.fin = self._pos()
                del self._pila[i:]
                return


def _comillas(v):
    v = str(v).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    return "'" + v.replace("'", '&#39;') + "'" if '"' in v else '"' + v + '"'


def _tag(raw, cambios):
    for k, v in cambios.items():
        nuevo = k if v is None else '%s=%s' % (k, _comillas(v))
        raw, n = re.subn(r'(\s)%s(\s*=\s*("[^"]*"|\'[^\']*\'|[^\s>]+))?(?=[\s/>])' % re.escape(k),
                         lambda m, s=nuevo: m.group(1) + s, raw, count=1)
        if not n:
            cut = len(raw) - (2 if raw.endswith('/>') else 1)
            raw = raw[:cut].rstrip() + ' ' + nuevo + raw[cut:]
    return raw


class _Html:
    def __init__(self, texto):
        self.texto = texto
        self.nodos = _Dom(texto).nodos
        self.ids = {n.attrs['id']: n for n in self.nodos if n.attrs.get('id')}
        self._attrs, self._ins, self._cambios = {}, [], []

    def set(self, n, k, v=None):
        self._attrs.setdefault(id(n), (n, {}))[1][k] = v

    def meter(self, pos, txt):
        self._ins.append((pos, len(self._ins), txt))

    def cambiar(self, a, b, txt):
        self._cambios.append((a, b, txt))

    def volcar(self):
        cortes = [(p, 0, s, p, t) for p, s, t in self._ins]
        cortes += [(n.a, 1, 0, n.b, _tag(self.texto[n.a:n.b], c)) for n, c in self._attrs.values()]
        cortes += [(a, 1, 0, b, t) for a, b, t in self._cambios]
        out, i = [], 0
        for a, _, _, b, t in sorted(cortes, key=lambda c: c[:3]):
            out += [self.texto[i:a], t]
            i = b
        return ''.join(out) + self.texto[i:]


# ---------- el proyecto ----------

def _leer_json(p, por_defecto=None):
    try:
        with open(p, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return por_defecto


def _num(v, por_defecto=None):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else por_defecto


def _f(v):
    s = ('%.4f' % v).rstrip('0').rstrip('.')
    return '0' if s in ('', '-0') else s


def _seguro(i):
    return re.sub(r'[^\w-]', '_', str(i))


class _Ctx:
    def __init__(self, proj, texto, avisos):
        self.proj, self.avisos = proj, avisos
        self.css, self.js, self.giran, self.cajas, self.enlaces = [], [], [], set(), []
        self.arcos, self.oculta, self.con_caja, self.rangos = False, False, False, {}
        C, A =_leer_json(os.path.join(proj, 'edicion', 'capas.json')), _leer_json(os.path.join(proj, 'edicion', 'audio.json'))
        self.grupos = (C.get('groups') or []) if isinstance(C, dict) else []
        self.stems = (A.get('stems') or []) if isinstance(A, dict) else []
        self.apagadas, self.libres = set(), []
        self.cargar(texto)
        self.reloj = None
        try:
            self.reloj = capas.Capas(proj)
        except (OSError, ValueError, KeyError, IndexError):     # sin edl las anclas no sirven: se usa su "t"
            pass

    def cargar(self, texto):
        self.h = _Html(texto)
        self.raiz = next((n for n in self.h.nodos if 'data-composition-id' in n.attrs), None)
        at = self.raiz.attrs if self.raiz is not None else {}
        conv = lambda k, d: float(at[k]) if re.fullmatch(r'[\d.]+', str(at.get(k))) else d
        self.W, self.H, self.dur = conv('data-width', 1080.0), conv('data-height', 1920.0), conv('data-duration', 0.0)
        z = re.search(r'#reframe\{[^}]*scale\(\s*-?([\d.]+)', texto)
        self.zoom = float(z.group(1)) if z and float(z.group(1)) > 0 else 1.0
        self.capas = {}
        for n in self.h.nodos:
            if 'layer' in (n.attrs.get('class') or '').split() and n.attrs.get('data-name') and n.attrs.get('id'):
                self.capas.setdefault(n.attrs['data-name'], []).append(n)

    def regla(self, sel, decl):
        r = '%s{%s}' % (sel, decl)
        if r not in self.css:
            self.css.append(r)

    def tiempo(self, t, anchor):
        """El segundo del montaje: el de su ancla (fragmento + segundo del clip) si el fragmento sigue, si no t."""
        if isinstance(anchor, dict) and anchor.get('seg') and self.reloj is not None:
            v = self.reloj._time(anchor['seg'], _num(anchor.get('src'), 0))
            if v is not None:
                return v
        return t


def _grupo(ctx, gid):
    g = next((x for x in ctx.grupos if x.get('id') == gid), None)
    if g is None:
        return None
    if edicion._es_subtitulos(g):
        return [ctx.h.ids['caps']] if 'caps' in ctx.h.ids else []
    return [n for it in g.get('items') or [] if it.get('el') for n in ctx.capas.get(it['el'], [])]


def _visuales(ctx, obj):
    """Los elementos visibles de un objetivo. Avisa si no hay."""
    obj = str(obj)
    out = None
    if obj == 'video':
        out = [ctx.h.ids['footage']] if 'footage' in ctx.h.ids else []
    elif obj.startswith('el:'):
        out = ctx.capas.get(obj[3:], [])
    elif obj.startswith('grp:'):
        out = _grupo(ctx, obj[4:])
    elif obj.startswith('lib:'):
        if _seguro(obj[4:]) in ctx.apagadas:
            return []
        n = ctx.h.ids.get('lib-' + _seguro(obj[4:]))
        out = [n] if n is not None else []
    if not out:
        ctx.avisos.append('Objetivo %s: no está en index.html, se salta.' % obj)
    return out or []


def _cajas(ctx, n):
    """Las dos cajas de un objetivo: (exterior, interior). En el vídeo son la misma, como en la vista previa."""
    nid = n.attrs['id']
    if nid.startswith('lib-'):
        return '#' + nid, '#' + nid + '-i'
    if nid in ('footage', 'caps'):
        ctx.regla('#' + nid, 'position:absolute;left:0;top:0;width:%spx;height:%spx' % (_f(ctx.W), _f(ctx.H)))
    if nid == 'footage':
        return '#footage', '#footage'
    if nid not in ctx.cajas:
        ctx.cajas.add(nid)
        ctx.h.meter(n.b, '<div id="me-%s" class="me-w"><div id="mi-%s" class="me-w">' % (nid, nid))
        ctx.h.meter(n.fin, '</div></div>')
        ctx.regla('.me-w', 'position:relative;width:100%;height:100%')
    return '#me-' + nid, '#mi-' + nid


def _raiz(ctx, n, interior):
    """La raíz del contenido, la de estilo.js en la vista previa: su hijo único o el contenedor si tiene varios o ninguno. Baja por los
    envoltorios de un solo hijo (.tf-card > .tfc-card > img -> .tfc-card). En las libres es el interior: mide lo mismo que su medio,
    y el color de una imagen se pinta en un lienzo aparte que no heredaría un recorte puesto en ella."""
    nid = n.attrs['id']
    if nid.startswith('lib-'):
        return interior
    if nid == 'caps':
        return interior + '>*'
    hijos = lambda x: [m for m in ctx.h.nodos if m.padre is x]
    actual, nivel = hijos(n), 1
    if len(actual) != 1:
        return interior
    while True:
        sig = hijos(actual[0])
        if len(sig) != 1 or not hijos(sig[0]):
            return interior + '>*' * nivel
        actual, nivel = sig, nivel + 1


def _media(ctx, nodos):
    return [m for m in ctx.h.nodos if m.tag in ('img', 'video') and any(m is n or m.dentro(n) for n in nodos)]


def _videos_footage(ctx, graduables=False):
    fo, sl = ctx.h.ids.get('footage'), ctx.h.ids.get('slots')
    out = [m for m in ctx.h.nodos if m.tag == 'video' and fo is not None and m.dentro(fo)]
    if graduables:      # las tomas de efecto que llevan el mismo color que el vídeo (class gr); las overlay no
        out += [m for m in ctx.h.nodos if m.tag == 'video' and sl is not None and m.dentro(sl)
                and 'gr' in (m.attrs.get('class') or '').split()]
    return out


def _sfx(ctx):
    return [n for n in ctx.h.nodos if n.tag == 'audio' and ES_SFX.match(n.attrs.get('id') or '')]


# ---------- capas: posición, tamaño y textos ----------

def _envoltorio(ctx, n, html):
    """El elemento de la capa n que coloca el plan: el que tiene dentro justo el html del item. None si no está tal cual."""
    html = str(html or '').strip()
    for m in ctx.h.nodos if html else []:
        if m.fin is not None and ctx.h.texto[m.b:m.fin].strip() == html and m.dentro(n):
            return m
    return None


def _desplaza(g, m, v):
    """La caja .me-c: de (m) los valores con los que se montó, a (v) los que quiere el usuario. '' si son los mismos."""
    box = g['kind'] == 'box'
    dx = v['left' if box else 'cx'] - m['left' if box else 'cx']
    dy, r = v['top'] - m['top'], v['width' if box else 'scale'] / m['width' if box else 'scale']
    return 'translate(%spx,%spx) scale(%s)' % (_f(dx), _f(dy), _f(r)) if dx or dy or r != 1 else ''


def _caja(ctx, g, m, trans, abre, cierra, el=None):
    box = g['kind'] == 'box'
    orden = ('left', 'top', 'width') if box else ('cx', 'top', 'scale')
    estilo = 'transform:%s;' % trans if trans else ''
    if not box:         # centrada: crece desde el centro de arriba; una caja, desde su esquina (la mide _ORIGEN_JS, cada item está en su sitio)
        estilo += 'transform-origin:%spx %spx' % (_f(m['cx']), _f(m['top']))
    ctx.con_caja = ctx.con_caja or box
    ctx.regla('.me-c', 'position:absolute;left:0;top:0;width:%spx;height:%spx' % (_f(ctx.W), _f(ctx.H)))
    ctx.h.meter(abre, '<div class="me-c" data-g=%s%s data-k="%s" data-m="%s"%s>' % (
        _comillas(g['id']), ' data-el=%s' % _comillas(el) if el else '', g['kind'], ','.join(_f(m[k]) for k in orden),
        ' style=%s' % _comillas(estilo) if estilo else ''))
    ctx.h.meter(cierra, '</div>')


def _texto_html(txt):
    return str(txt).replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br>')


def _textos(ctx, g, textos):
    """Los textos cambiados de un grupo: en sus [data-t], o si el item no tiene, en su trozo de texto más largo (lo de capas.js)."""
    hechas = 0
    for i, it in enumerate(g.get('items') or []):
        el = it.get('el')
        for n in ctx.capas.get(el, []) if el else []:
            propias = [m for m in ctx.h.nodos if 'data-t' in m.attrs and m.fin is not None and m.dentro(n)]
            for m in propias:
                k = m.attrs.get('data-t') or el
                if k in textos:
                    ctx.h.cambiar(m.b, m.fin, _texto_html(textos[k]))
                    hechas += 1
            if not propias and el in textos:
                viejo = _texto_html(it['text']) if it.get('text') is not None else \
                    max(re.split(r'<[^>]*>', it.get('html') or ''), key=lambda p: len(p.strip()), default='').strip()
                pos = ctx.h.texto.find(viejo, n.b, n.fin) if viejo else -1
                if pos < 0:
                    ctx.avisos.append('Capa %s: no se encuentra su texto en index.html, sale el que tenía.' % el)
                    continue
                ctx.h.cambiar(pos, pos + len(viejo), _texto_html(textos[el]))
                hechas += 1
    return hechas


def _capas(ctx, data):
    montado, hechas = edicion.montado(ctx.proj), 0
    for g in ctx.grupos:
        if not isinstance(g, dict) or g.get('kind') not in ('box', 'center') or not g.get('id'):
            continue
        orden = ('left', 'top', 'width') if g['kind'] == 'box' else ('cx', 'top', 'scale')
        guardado = data.get(g['id']) if isinstance(data.get(g['id']), dict) else {}
        d = {k: x for k, x in (g.get('default') or {}).items() if k in orden}
        m = dict(d, **{k: x for k, x in (montado.get(g['id']) or {}).items() if k in orden})
        v = dict(d, **{k: x for k, x in guardado.items() if k in orden})
        if any(_num(x.get(k)) is None for x in (m, v) for k in orden) or not m[orden[2]]:
            ctx.avisos.append('Capas %s: le faltan posición o tamaño, se salta.' % g['id'])
            continue
        trans = _desplaza(g, m, v)
        if edicion._es_subtitulos(g):       # las palabras están en #caps y los textos van a words.json al procesar
            caps = ctx.h.ids.get('caps')
            if caps is not None and caps.fin is not None and trans:
                _caja(ctx, g, m, trans, caps.b, caps.fin)
                hechas += 1
            continue
        for it in g.get('items') or []:
            for n in ctx.capas.get(it.get('el'), []):
                if n.fin is None:
                    continue
                w = _envoltorio(ctx, n, it.get('html'))
                if w is None:
                    _caja(ctx, g, m, trans, n.b, n.fin, it['el'])
                else:
                    _caja(ctx, g, m, trans, w.a, w.fin + ctx.h.texto[w.fin:].index('>') + 1, it['el'])
                hechas += bool(trans)
        if isinstance(guardado.get('texts'), dict):
            hechas += _textos(ctx, g, guardado['texts'])
    return hechas


# ---------- tiempos de las capas ----------

def _retemporiza(ctx, n, t0, t1):
    """Cambia cuándo sale la capa n: reescribe sus líneas de la línea de tiempo (las que escribe captions.layers de video-studio)."""
    lid = n.attrs['id']
    a0, b0 = _rango_capa(ctx, lid)
    if abs(t0 - a0) < .002 and abs(t1 - b0) < .002:
        return False
    sel = re.escape(lid)
    entra = re.compile(r"\.\w+\('#%s',\{[^}]*\},\{[^}]*autoAlpha:1[^}]*\},([\d.]+)\)" % sel)
    sale = re.compile(r"\.set\('#%s',\{autoAlpha:0\},([\d.]+)\)" % sel)
    funde = re.compile(r"\.to\('#%s',\{[^}]*autoAlpha:0[^}]*\},([\d.]+)\)" % sel)
    oculta = re.compile(r"gsap\.set\('#%s',\{autoAlpha:0\}\);" % sel)
    suya = re.compile(r"""['"]#%s(?![\w-])""" % sel)
    al_final = t1 >= ctx.dur - .02
    al_inicio, hay_in, hay_out = t0 <= .02, False, False
    for sc in ctx.h.nodos:
        if sc.tag != 'script' or sc.fin is None or sc.attrs.get('src'):
            continue
        pos = sc.b
        for lin in ctx.h.texto[sc.b:sc.fin].splitlines(keepends=True):
            ini, pos = pos, pos + len(lin)
            if not suya.search(lin):
                continue
            mi, ms, mf = entra.search(lin), sale.search(lin), funde.search(lin)
            if oculta.search(lin) or (mi and 'duration:0,' in lin):
                if al_inicio:           # a t=0 una entrada sin duración podría no dispararse: se ve desde el principio y ya
                    ctx.h.cambiar(ini, pos, '')
                    continue
            if mi:
                hay_in = True
                ctx.h.cambiar(ini + mi.start(1), ini + mi.end(1), '%.3f' % t0)
            elif ms or mf:
                hay_out = hay_out or bool(ms)
                if al_final:
                    ctx.h.cambiar(ini, pos, '')
                else:
                    x = ms or mf
                    ctx.h.cambiar(ini + x.start(1), ini + x.end(1), '%.3f' % (t1 if ms else max(t1 - (b0 - float(mf.group(1))), 0)))
            else:                       # sus animaciones: con la entrada, salvo las que ya iban justo antes de salir
                x = re.search(r',([\d.]+)\);\s*$', lin)
                if x:
                    v = float(x.group(1))
                    nuevo = v + (t1 - b0 if b0 - a0 > .6 and v >= b0 - .5 else t0 - a0)
                    ctx.h.cambiar(ini + x.start(1), ini + x.end(1), '%.3f' % max(nuevo, 0))
    if not hay_in and not al_inicio:
        ctx.js.append("gsap.set('#%s',{autoAlpha:0});" % lid)
        ctx.js.append("tl.fromTo('#%s',{autoAlpha:0},{autoAlpha:1,duration:0,immediateRender:false},%.3f);" % (lid, t0))
    if not hay_out and not al_final:
        ctx.js.append("tl.set('#%s',{autoAlpha:0},%.3f);" % (lid, t1))
    for m in ctx.h.nodos:               # los medios que lleva dentro y el sonido que entraba con ella
        if m.tag in ('video', 'img') and 'data-start' in m.attrs and m.dentro(n):
            ctx.h.set(m, 'data-start', '%.3f' % t0)
            ctx.h.set(m, 'data-duration', '%.3f' % (t1 - t0))
    for s in _sfx(ctx):
        v = float(s.attrs['data-start']) if re.fullmatch(r'[\d.]+', s.attrs.get('data-start') or '') else None
        if v is not None and abs(v - a0) <= .06 and t0 != a0:
            ctx.h.set(s, 'data-start', '%.3f' % max(v + t0 - a0, 0))
    ctx.rangos[lid] = (t0, t1)
    return True


def _tiempos(ctx, data):
    hechas = 0
    for el, d in sorted((data.get('capas') or {}).items()):
        if not isinstance(d, dict):
            continue
        for n in ctx.capas.get(el, []):
            if d.get('off'):
                ctx.h.set(n, 'data-hidden')
                ctx.oculta = True
                hechas += 1
                continue
            d0, d1 = _num(d.get('from')), _num(d.get('to'))
            if d0 is None or d1 is None:
                continue
            t0 = max(ctx.tiempo(d0, d.get('anchor')), 0.0)
            hechas += _retemporiza(ctx, n, t0, min(t0 + max(d1 - d0, .03), ctx.dur or t0 + d1 - d0))
    return hechas


# ---------- pistas ----------

def _de_pista(ctx, k):
    if k == 'video':
        videos = _videos_footage(ctx)
        return videos + [m.padre for m in videos if m.padre is not None]
    if k == 'fx':
        sl = ctx.h.ids.get('slots')
        return ([sl] if sl is not None else []) + [n for n in _sfx(ctx) if n.attrs['id'].startswith('fx')]
    if k == 'sfx':
        return _sfx(ctx)
    if k == 'voice':
        return [ctx.h.ids['bga']] if 'bga' in ctx.h.ids else []
    if k == 'subs':
        return [ctx.h.ids['caps']] if 'caps' in ctx.h.ids else []
    if k == 'el:libres':
        return [ctx.h.ids[i] for i in ctx.libres if i in ctx.h.ids]
    if k == 'el:capas':         # la pista "Capas": las capas que no están en ningún grupo
        con_grupo = {it.get('el') for g in ctx.grupos for it in g.get('items') or []}
        return [n for nombre, ns in ctx.capas.items() if nombre not in con_grupo for n in ns]
    if k.startswith('el:'):     # aquí el:<id> es la pista de un grupo de capas
        nodos = _grupo(ctx, k[3:])
        return ctx.capas.get(k[3:], []) if nodos is None else nodos
    return _visuales(ctx, k)


def _pistas(ctx, data):
    hechas = 0
    for k, v in sorted((data.get('hidden') or {}).items()):
        nodos = _de_pista(ctx, k) if v else []
        for n in nodos:
            ctx.h.set(n, 'data-hidden')
            ctx.oculta = True
        hechas += bool(nodos)
    return hechas


# ---------- color ----------

def _rango_capa(ctx, lid):
    """Cuándo se ve una capa (#ly<N>): lo mismo que dicen sus tweens de autoAlpha en la línea de tiempo de build_reel.py."""
    if lid in ctx.rangos:
        return ctx.rangos[lid]
    src = ''.join(ctx.h.texto[n.b:n.fin] for n in ctx.h.nodos if n.tag == 'script' and n.fin is not None)
    a = re.search(r"\.\w+\('#%s',\{[^}]*\},\{[^}]*autoAlpha:1[^}]*\},([\d.]+)\)" % re.escape(lid), src)
    b = re.search(r"\.set\('#%s',\{autoAlpha:0\},([\d.]+)\)" % re.escape(lid), src)
    return float(a.group(1)) if a else 0.0, float(b.group(1)) if b else ctx.dur


def _temporizar(ctx, m):
    """El runtime solo colorea una <img> que estaba visible al cargarse, o que tiene data-start y le llega su momento. Las de una capa
    salen ocultas, así que sin esto el render las deja sin color (el snapshot sí las colorea, no sirve de prueba)."""
    if m.tag != 'img' or 'data-start' in m.attrs:
        return
    capa = m.padre
    while capa is not None and 'layer' not in (capa.attrs.get('class') or '').split():
        capa = capa.padre
    if capa is None or not capa.attrs.get('id'):
        return
    t0, t1 = _rango_capa(ctx, capa.attrs['id'])
    ctx.h.set(m, 'data-start', '%.3f' % t0)
    ctx.h.set(m, 'data-duration', '%.3f' % max(t1 - t0, .01))
    ctx.h.set(m, 'class', ((m.attrs.get('class') or '') + ' clip').strip())
    if not m.attrs.get('id'):
        ctx.h.set(m, 'id', '%s-img%d' % (capa.attrs['id'], ctx.h.nodos.index(m)))


def _color(ctx, data):
    hechas = 0
    for obj, g in sorted((data.get('targets') or {}).items()):
        if not isinstance(g, dict) or not any(g.values()):
            continue
        media = _videos_footage(ctx, True) if obj == 'video' else _media(ctx, _visuales(ctx, obj))
        if not media:
            ctx.avisos.append('Color de %s: no hay imagen ni vídeo que colorear.' % obj)
        for m in media:
            ctx.h.set(m, 'data-color-grading', json.dumps(g, ensure_ascii=False, separators=(',', ':'), sort_keys=True))
            _temporizar(ctx, m)
            hechas += 1
    return hechas


# ---------- audio ----------

def _cadena(ctx, obj, c):
    if not isinstance(c, dict) or not isinstance(c.get('nodes'), list):
        return None
    nodos = []
    for n in c['nodes']:
        if isinstance(n, dict) and n.get('type') in FX_TIPOS:
            nodos.append(n)
        else:
            ctx.avisos.append('Audio de %s: efecto desconocido, se quita: %r' % (obj, n.get('type') if isinstance(n, dict) else n))
    return {'version': 1, 'nodes': nodos} if nodos else None


def _automatiza(ctx, obj, a, inicio=0.0):
    """El data-automation de un elemento que empieza en `inicio`. El motor solo lee {t, v, curve, viaX, viaY} con t desde el inicio del
    elemento (el bus, desde la composición). El t de voice, sfx y pistas es del montaje y se recalcula con su "anchor" si cambió el
    edl; el de lib:<id> ya va desde el inicio de la capa."""
    if not isinstance(a, dict) or not isinstance(a.get('lanes'), list):
        return None
    lanes = []
    for l in a['lanes']:
        ok = isinstance(l, dict) and isinstance(l.get('target'), str) and isinstance(l.get('points'), list) \
            and (l['target'] == 'volume' or (len(l['target'].split('.')) == 3 and l['target'].startswith('fx.')))
        if not ok:
            msg = 'Audio de %s: automatización no válida, se quita.' % obj
            if msg not in ctx.avisos:
                ctx.avisos.append(msg)
            continue
        pts = []
        for q in l['points']:
            t, v = _num(q.get('t')) if isinstance(q, dict) else None, _num(q.get('v')) if isinstance(q, dict) else None
            if t is None or v is None:
                continue
            if not obj.startswith('lib:'):
                t = ctx.tiempo(t, q.get('anchor')) - inicio
            pts.append(dict({'t': round(max(t, 0.0), 3), 'v': v}, **{k: q[k] for k in ('curve', 'viaX', 'viaY') if k in q}))
        if pts:
            lanes.append({'target': l['target'], 'points': sorted(pts, key=lambda x: x['t'])})
    return {'version': 1, 'lanes': lanes} if lanes else None


def _audios(ctx, obj):
    if obj == 'voice':
        return [ctx.h.ids['bga']] if 'bga' in ctx.h.ids else []
    if obj.startswith('lib:'):
        lib = ctx.h.ids.get('lib-' + _seguro(obj[4:]))
        if lib is None:
            return []
        return [lib] if lib.tag == 'audio' else [m for m in ctx.h.nodos if m.tag == 'video' and m.dentro(lib) and 'data-has-audio' in m.attrs]
    src = next((s.get('src') for s in ctx.stems if s.get('id') == obj), None)
    return [n for n in ctx.h.nodos if n.tag == 'audio' and src and n.attrs.get('src') == src]


def _json(o):
    return json.dumps(o, ensure_ascii=False, separators=(',', ':'))


def _audiofx(ctx, data):
    chains, autos, vols = data.get('chains') or {}, data.get('automation') or {}, data.get('volume') or {}
    hechas = 0
    for obj in sorted(set(chains) | set(autos) | set(vols)):
        c, db = _cadena(ctx, obj, chains.get(obj)), _num(vols.get(obj))
        lin = None if db is None else 10 ** (db / 20)
        if c is None and lin is None and _automatiza(ctx, obj, autos.get(obj)) is None:
            continue
        if obj == 'sfx':
            a = _automatiza(ctx, obj, autos.get(obj))
            miembros = _sfx(ctx)
            if not miembros:
                ctx.avisos.append('Audio de sfx: este montaje no tiene efectos de sonido.')
                continue
            for n in miembros:
                ctx.h.set(n, 'data-audio-group', 'sfx')
            attrs = ' data-label="Efectos de sonido"'
            attrs += '' if lin is None else ' data-volume=%s' % _comillas(_f(min(lin, GANANCIA_MAX)))
            attrs += '' if c is None else ' data-fx-chain=%s' % _comillas(_json(c))
            attrs += '' if a is None else ' data-automation=%s' % _comillas(_json(a))
            ctx.h.meter(ctx.raiz.b, '\n  <hf-audio-group id="sfx"%s></hf-audio-group>' % attrs)
            hechas += 1
            continue
        nodos = _audios(ctx, obj)
        if not nodos:
            ctx.avisos.append('Audio de %s: esa pista no está en index.html (si va en la mezcla con ffmpeg, usa edicion.filtro_audio).' % obj)
            continue
        for n in nodos:
            inicio = float(n.attrs['data-start']) if re.fullmatch(r'[\d.]+', n.attrs.get('data-start') or '') else 0.0
            a = _automatiza(ctx, obj, autos.get(obj), inicio)
            if c is not None:
                ctx.h.set(n, 'data-fx-chain', _json(c))
            if a is not None:
                ctx.h.set(n, 'data-automation', _json(a))
            if lin is not None:
                base = float(n.attrs['data-volume']) if re.fullmatch(r'[\d.]+', n.attrs.get('data-volume') or '') else 1.0
                ctx.h.set(n, 'data-volume', _f(min(base * lin, GANANCIA_MAX)))
            hechas += 1
    return hechas


# ---------- estilo ----------

def _fuentes(ctx, fuentes):
    """Las fuentes que eligió estilo.js. Las del proyecto, si no están en fonts.css; las de Google, con su enlace (HyperFrames las baja al
    compilar y con el enlace el lint las da por buenas); las del sistema no necesitan nada."""
    try:
        with open(os.path.join(ctx.proj, 'assets', 'fonts', 'fonts.css'), encoding='utf-8', errors='replace') as f:
            hay = f.read()
    except OSError:
        hay = ''
    for fam, d in sorted(fuentes.items()) if isinstance(fuentes, dict) else []:
        if not isinstance(d, dict) or not re.fullmatch(r"[\w .-]+", fam):
            continue
        if d.get('source') == 'google':
            ctx.enlaces.append('<link rel="stylesheet" href="https://fonts.googleapis.com/css?family=%s:300,400,500,600,700,800,900,400i,700i&amp;display=swap" />' % fam.replace(' ', '+'))
        elif d.get('source') == 'project' and not re.search(r'font-family:\s*.?%s.?\s*;' % re.escape(fam), hay):
            for arch in d.get('files') or []:
                m = re.search(r'-(\d{3})-(normal|italic)\.', str(arch))
                ctx.regla('@font-face', "font-family:'%s';src:url('%s');font-weight:%s;font-style:%s" % (
                    fam, str(arch).replace("'", ''), m.group(1) if m else 'normal', m.group(2) if m else 'normal'))


def _estilo(ctx, data):
    """Texto: al elemento y a todo lo de dentro. mix-blend-mode y z: a la capa. Lo demás y el recorte: a la raíz del contenido, salvo
    rotate (interior, suma a las claves) y opacity (exterior: se multiplica con la de las claves y no la pisan las entradas del plan,
    que van en línea en la raíz). En el vídeo, todo a su contenedor y sin !important."""
    _fuentes(ctx, data.get('fonts'))
    hechas = 0
    for obj, e in sorted((data.get('targets') or {}).items()):
        if not isinstance(e, dict) or not (e.get('css') or e.get('crop') or e.get('z') is not None):
            continue
        for n in _visuales(ctx, obj):
            if n.tag == 'audio':
                continue
            ext, inte = _cajas(ctx, n)
            capa, fuera, dentro, texto, raiz = [], [], [], [], []
            crop = e.get('crop') if isinstance(e.get('crop'), dict) else {}
            lados = [_num(crop.get(k), 0) for k in ('top', 'right', 'bottom', 'left')]
            css = dict(e.get('css') or {})
            if any(lados):
                css['clip-path'] = 'inset(%s)' % ' '.join(_f(x) + '%' for x in lados)
            for k, v in sorted(css.items()):
                v = str(v).replace('!important', '').strip()
                if not re.fullmatch(r'-?[a-zA-Z][\w-]*', str(k)) or not v or re.search(r'[{}<]', v):
                    ctx.avisos.append('Estilo de %s: %s no válido, se salta.' % (obj, k))
                    continue
                d, imp = '%s:%s' % (k, v), '%s:%s!important' % (k, v)
                if obj == 'video':
                    raiz.append(d)
                elif k in _TEXTO or k.startswith('font'):
                    texto.append(imp)
                elif k == 'mix-blend-mode':
                    capa.append(imp)
                elif k == 'opacity':
                    fuera.append(d)
                elif k == 'rotate':
                    dentro.append(d)
                    if inte.startswith('#mi-') and inte not in ctx.giran:
                        ctx.giran.append(inte)
                else:
                    raiz.append(imp)
                    if k == 'border-radius':
                        ctx.regla('%s img,%s video' % (inte, inte), imp)
            z = _num(e.get('z'))
            if z is not None and obj != 'video':     # z empieza en 1: siempre sobre el vídeo
                capa.append('z-index:%d!important' % z)
            propio = '#' + n.attrs['id']
            for sel, decl in ((propio, capa), (ext, fuera), (inte, dentro), ('%s,%s *' % (inte, inte), texto), (_raiz(ctx, n, inte) if obj != 'video' else ext, raiz)):
                if decl:
                    ctx.regla(sel, ';'.join(decl))
            hechas += 1
    return hechas


# ---------- claves ----------

def _puntos(ctx, lista, prop):
    pts = {}
    for k in lista if isinstance(lista, list) else []:
        t, v = _num(k.get('t')) if isinstance(k, dict) else None, _num(k.get('v')) if isinstance(k, dict) else None
        if t is None or v is None:
            continue
        t = min(max(ctx.tiempo(t, k.get('anchor')), 0.0), ctx.dur or t)
        pts[round(t, 4)] = (min(max(v, 0.0), 1.0) if prop == 'opacity' else v, k.get('ease'))
    return [(t, *pts[t]) for t in sorted(pts)]


def _ease(ctx, e):
    if e is None or e == '':
        return 'none'
    if isinstance(e, str) and re.fullmatch(r'[\w.]+(\([\w.,\s+-]*\))?', e):
        return e
    ctx.avisos.append('Clave con ease no válido (%r): va lineal.' % (e,))
    return 'none'


def _lineal(pts, t):
    for (ta, va, _), (tb, vb, _) in zip(pts, pts[1:]):
        if ta <= t < tb:
            return va + (vb - va) * (t - ta) / (tb - ta)
    return pts[0][1] if t < pts[0][0] else pts[-1][1]


def _arco(ctx, s, xs, ys, auto):
    """La misma curva que Studio y claves.js: bezier cúbica entre puntos seguidos, con cp1 = (x0+dx*.33, y0+dy*.33-|dx|*.25) y
    cp2 = (x0+dx*.66, y0+dy*.66-|dx|*.25), donde el progreso de la curva sigue al ease del tramo. Con MotionPathPlugin el progreso iría por
    longitud del arco, así que el tween va de 0 a 1000 y un modificador lo convierte. autoRotate va en la caja exterior: se suma a la
    rotation de las claves. Un segundo con clave solo en x o solo en y toma el otro valor interpolado en línea recta."""
    e_x, e_y = {q[0]: q[2] for q in xs}, {q[0]: q[2] for q in ys}
    P = [(t, _lineal(xs, t), _lineal(ys, t), e_x[t] if t in e_x else e_y[t]) for t in sorted(set(e_x) | set(e_y))]
    for (ta, xa, ya, _), (tb, xb, yb, e) in zip(P, P[1:]):
        dx, dy, sube = xb - xa, yb - ya, abs(xb - xa) * .25
        bx = [xa, xa + dx * .33, xa + dx * .66, xb]
        by = [ya, ya + dy * .33 - sube, ya + dy * .66 - sube, yb]
        lista = lambda vals: ','.join(_f(v) for v in vals)
        props = ('x', 'y', 'rotation') if auto else ('x', 'y')
        mods = {'x': 'meB(%s)' % lista(bx), 'y': 'meB(%s)' % lista(by), 'rotation': 'meA(%s)' % lista(bx + by)}
        ctx.js.append('tl.fromTo(%s,{%s},{%s,duration:%s,ease:%s,immediateRender:false,modifiers:{%s}},%s);' % (
            s, ','.join(q + ':0' for q in props), ','.join(q + ':1000' for q in props), _f(tb - ta), json.dumps(_ease(ctx, e)),
            ','.join('%s:%s' % (q, mods[q]) for q in props), _f(ta)))
    if auto:        # fuera de la trayectoria, como en la vista previa: la dirección del primer o del último tramo
        cuerda = lambda a, b: math.degrees(math.atan2(b[2] - a[2], b[1] - a[1]))
        ctx.js.append('gsap.set(%s,{rotation:%s});' % (s, _f(cuerda(P[0], P[1]))))
        ctx.js.append('tl.set(%s,{rotation:%s},%s);' % (s, _f(cuerda(P[-2], P[-1])), _f(P[-1][0])))
    ctx.arcos = True


def _claves(ctx, data):
    """x e y en la caja exterior; scale, rotation, opacity y el 3D en la interior, con perspectiva. Un el: manda sobre su grp: propiedad a
    propiedad (x e y cuentan como una, como posAt() en la vista previa), y como cada capa solo se ve en su momento, solo entonces."""
    paths = data.get('paths') or {}
    leidas = {}
    for obj, tr in sorted((data.get('tracks') or {}).items()):
        pistas = {p: pts for p in PROPS for pts in [_puntos(ctx, tr.get(p), p)] if pts} if isinstance(tr, dict) else None
        if pistas:
            leidas[obj] = pistas
    propias = {}
    for obj, pistas in leidas.items():
        if obj.startswith('el:'):
            mias = set(pistas) | ({'x', 'y'} if {'x', 'y'} & set(pistas) else set())
            for n in ctx.capas.get(obj[3:], []):
                propias.setdefault(n.attrs['id'], set()).update(mias)
    hechas = 0
    for obj, pistas in leidas.items():
        nodos = [n for n in _visuales(ctx, obj) if n.tag != 'audio']
        if not nodos:
            continue

        def sel(prop):      # cada propiedad, en los elementos donde no manda un el: propio
            ns = [n for n in nodos if not (obj.startswith('grp:') and prop in propias.get(n.attrs['id'], ()))]
            return [_cajas(ctx, n)[0 if prop in ('x', 'y') else 1] for n in ns]
        for prop, pts in pistas.items():
            if obj == 'video' and prop in ('x', 'y') and ctx.zoom != 1:     # #footage está dentro de #reframe: en píxeles de pantalla
                pistas[prop] = [(t, v / ctx.zoom, e) for t, v, e in pts]
        ruta = paths.get(obj) if isinstance(paths.get(obj), dict) else {}
        xs, ys = pistas.get('x'), pistas.get('y')
        arco = ruta.get('arc') and len({q[0] for q in (xs or []) + (ys or [])}) > 1 and sel('x')
        for prop, pts in pistas.items():
            s = sel(prop)
            if not s:
                continue
            ctx.giran += [x.replace('#me-', '#mi-') for x in s if x.startswith(('#me-', '#mi-')) and x.replace('#me-', '#mi-') not in ctx.giran]
            s = json.dumps(','.join(s))
            ctx.js.append('gsap.set(%s,{%s:%s});' % (s, prop, _f(pts[0][1])))
            if arco and prop in ('x', 'y'):
                continue
            for (ta, va, _), (tb, vb, e) in zip(pts, pts[1:]):
                ctx.js.append('tl.fromTo(%s,{%s:%s},{%s:%s,duration:%s,ease:%s,immediateRender:false},%s);' % (
                    s, prop, _f(va), prop, _f(vb), _f(tb - ta), json.dumps(_ease(ctx, e)), _f(ta)))
        if {'rotationX', 'rotationY', 'z'} & set(pistas):
            ctx.js.append('gsap.set(%s,{transformPerspective:%d});' % (json.dumps(','.join(_cajas(ctx, n)[1] for n in nodos)), PERSPECTIVA))
        if arco:
            _arco(ctx, json.dumps(','.join(sel('x'))), xs or [(ys[0][0], 0.0, None)], ys or [(xs[0][0], 0.0, None)], ruta.get('autoRotate'))
        hechas += 1
    return hechas


_ARCO_JS = ("function meB(a,b,c,d){return function(v){var t=parseFloat(v)/1000,m=1-t;return (m*m*m*a+3*m*m*t*b+3*m*t*t*c+t*t*t*d)+'px';};} "
            "function meA(a,b,c,d,e,f,g,h){return function(v){var t=parseFloat(v)/1000,m=1-t;"
            "return Math.atan2(m*m*(f-e)+2*m*t*(g-f)+t*t*(h-g),m*m*(b-a)+2*m*t*(c-b)+t*t*(d-c))*180/Math.PI+'deg';};}")
_GIRO_JS = ("%s.forEach(function(s){var w=document.querySelector(s),a=1e9,b=1e9,c=-1e9,d=-1e9,f,i,r,l=[];if(!w)return;"
            "[].forEach.call(w.children,function(k){[].push.apply(l,k.classList.contains('me-c')?k.children:[k]);});"
            "f=w.getBoundingClientRect();for(i=0;i<l.length;i++){r=l[i].getBoundingClientRect();"
            "if(r.width&&r.height){a=Math.min(a,r.left);b=Math.min(b,r.top);c=Math.max(c,r.right);d=Math.max(d,r.bottom);}}"
            "if(c>a)gsap.set([w,w.parentNode],{transformOrigin:((a+c)/2-f.left)+'px '+((b+d)/2-f.top)+'px'});});")
_ORIGEN_JS = ("document.querySelectorAll('.me-c[data-k=box]').forEach(function(w){var t=w.style.transform,a=1e9,b=1e9,f;w.style.transform='none';"
              "f=w.getBoundingClientRect();[].forEach.call(w.children,function(k){if(k.getClientRects().length){var r=k.getBoundingClientRect();"
              "a=Math.min(a,r.left);b=Math.min(b,r.top);}});if(a<1e9)w.style.transformOrigin=(a-f.left)+'px '+(b-f.top)+'px';w.style.transform=t;});")


# ---------- capas libres ----------

def _tiene_audio(p):
    try:
        r = subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', p],
                           capture_output=True, text=True, timeout=30)
        return bool(r.stdout.strip())
    except (OSError, subprocess.SubprocessError):
        return False


def _bloque(ctx, it):
    src = str(it.get('src') or it.get('name') or it.get('block') or '')
    if src and '/' not in src:
        src = 'compositions/' + src
    if src and not src.endswith('.html'):
        src += '.html'
    try:
        with open(os.path.join(ctx.proj, *src.split('/')), encoding='utf-8', errors='replace') as f:
            t = f.read()
    except OSError:
        return None, None, 0, 0
    i = re.search(r'data-composition-id\s*=\s*["\']([^"\']+)', t)
    w, h = re.search(r'data-width\s*=\s*["\'](\d+)', t), re.search(r'data-height\s*=\s*["\'](\d+)', t)
    return src, i.group(1) if i else None, float(w.group(1)) if w else ctx.W, float(h.group(1)) if h else ctx.H


def _aparece(ctx, sel, t0, t1):
    """HyperFrames no admite data-start dentro de un padre con data-start y el medio tiene que llevarlo, así que la caja de una
    imagen, un vídeo o un bloque se enseña con visibility (no con autoAlpha, para que su opacidad siga libre)."""
    ctx.js.append("gsap.set('%s',{visibility:'hidden'});" % sel)
    ctx.js.append("tl.set('%s',{visibility:'visible'},%s);" % (sel, _f(t0)))
    if t1 < ctx.dur - .001:
        ctx.js.append("tl.set('%s',{visibility:'hidden'},%s);" % (sel, _f(t1)))


def _libres(ctx, data):
    visibles, sonidos, hechas = [], [], 0
    usados = set()
    for k, it in enumerate(data.get('items') or []):
        if not isinstance(it, dict) or not it.get('id'):
            continue
        i, tipo = _seguro(it['id']), it.get('type')
        if it.get('off'):
            ctx.apagadas.add(i)
            continue
        if i in usados:
            ctx.avisos.append('Capa libre %s: id repetido, se salta.' % i)
            continue
        usados.add(i)
        d0, d1 = _num(it.get('from'), 0.0), _num(it.get('to'), ctx.dur)
        t0 = ctx.tiempo(d0, it.get('anchor'))
        t1 = min(t0 + max(d1 - d0, 0), ctx.dur or t0 + d1 - d0)
        t0 = max(t0, 0.0)
        if t1 - t0 < .01:
            ctx.avisos.append('Capa libre %s: fuera del montaje, se salta.' % i)
            continue
        src = str(it.get('src') or '')
        if tipo in ('image', 'video', 'audio') and not re.match(r'https?:', src) and not os.path.isfile(os.path.join(ctx.proj, *src.split('/'))):
            ctx.avisos.append('Capa libre %s: no existe %s, se salta.' % (i, src or '(sin archivo)'))
            continue
        tiempos = 'data-start="%.3f" data-duration="%.3f" data-track-index="%d"' % (t0, t1 - t0, 200 + k)
        L, T, W = _num(it.get('left'), 0.0), _num(it.get('top'), 0.0), _num(it.get('width'))
        H = _num(it.get('height'))
        caja = 'position:absolute;left:%spx;top:%spx' % (_f(L), _f(T))
        caja += ';width:%s' % ('%spx' % _f(W) if W else 'auto' if tipo == 'text' else '%spx' % _f(ctx.W))
        media_alto = '100%' if H else 'auto'
        ctx.regla('.me-w', 'position:relative;width:100%;height:100%')
        ajuste = 'style="display:block;width:100%%;height:%s;object-fit:cover;border-radius:inherit"' % media_alto
        if H:
            caja += ';height:%spx' % _f(H)
        vol = _num(it.get('volume'), 1.0)
        desde = _num(it.get('mediaStart'), 0.0)
        if tipo == 'text':
            txt = str(it.get('text') or '').replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('\n', '<br>')
            ctx.regla('.me-txt', "font:700 72px/1.1 Inter,Arial,sans-serif;color:#fff;text-align:center;white-space:pre-wrap;overflow-wrap:break-word")
            visibles.append('<div id="lib-%s" class="clip" %s style="%s"><div id="lib-%s-i" class="me-w me-txt">%s</div></div>' % (i, tiempos, caja, i, txt))
        elif tipo == 'image':
            visibles.append('<div id="lib-%s" style="%s"><div id="lib-%s-i" class="me-w"><img id="lib-%s-m" class="clip" src=%s alt="" %s %s></div></div>' % (
                i, caja, i, i, _comillas(src), tiempos, ajuste))
            _aparece(ctx, '#lib-' + i, t0, t1)
        elif tipo == 'video':
            suena = vol > 0 and (re.match(r'https?:', src) or _tiene_audio(os.path.join(ctx.proj, *src.split('/'))))
            sonido = 'data-has-audio="true" data-volume="%s"' % _f(min(vol, GANANCIA_MAX)) if suena else 'muted'
            visibles.append('<div id="lib-%s" style="%s"><div id="lib-%s-i" class="me-w"><video id="lib-%s-m" src=%s %s playsinline %s data-media-start="%.3f" %s></video></div></div>' % (
                i, caja, i, i, _comillas(src), sonido, tiempos, desde, ajuste))
            _aparece(ctx, '#lib-' + i, t0, t1)
        elif tipo == 'audio':
            sonidos.append('<audio id="lib-%s" src=%s %s data-media-start="%.3f" data-volume="%s"></audio>' % (
                i, _comillas(src), tiempos, desde, _f(min(vol, GANANCIA_MAX))))
        elif tipo == 'block':
            comp, cid, bw, bh = _bloque(ctx, it)
            if not comp or not cid:
                ctx.avisos.append('Capa libre %s: el bloque no está en compositions/, se salta.' % i)
                continue
            W = W or ctx.W
            H = H or bh * W / bw
            esc = min(W / bw, H / bh)       # cabe entero, centrado en su caja
            visibles.append('<div id="lib-%s" style="position:absolute;left:%spx;top:%spx;width:%spx;height:%spx"><div id="lib-%s-i" class="me-w" style="overflow:hidden">'
                            '<div id="lib-%s-b" class="clip" data-composition-id=%s data-composition-src=%s %s data-width="%d" data-height="%d" '
                            'style="position:absolute;left:%spx;top:%spx;width:%dpx;height:%dpx;transform-origin:0 0;transform:scale(%s)"></div></div></div>' % (
                                i, _f(L), _f(T), _f(W), _f(H), i, i, _comillas(cid), _comillas(comp), tiempos, bw, bh,
                                _f((W - bw * esc) / 2), _f((H - bh * esc) / 2), bw, bh, _f(esc)))
            _aparece(ctx, '#lib-' + i, t0, t1)
        else:
            ctx.avisos.append('Capa libre %s: tipo desconocido (%s).' % (i, tipo))
            continue
        ctx.libres.append('lib-' + i)
        hechas += 1
    if visibles:                    # sin z manda el orden: grupos (subtítulos incluidos) y luego libres
        tras = ctx.h.ids.get('caps') or ctx.h.ids.get('layers')
        pos = tras.fin + ctx.h.texto[tras.fin:].index('>') + 1 if tras is not None else ctx.raiz.fin
        ctx.h.meter(pos, '\n  ' + '\n  '.join(visibles))
    if sonidos:
        ctx.h.meter(ctx.raiz.b, '\n  ' + '\n  '.join(sonidos))
    return hechas


# ---------- todo junto ----------

def _componer(proj, texto, datos, resumen):
    ctx = _Ctx(proj, texto, resumen['avisos'])
    if ctx.raiz is None:
        resumen['avisos'].append('index.html no tiene composición (data-composition-id).')
        return None

    def paso(tool, fn):
        if tool in datos:
            try:
                resumen['aplicado'][tool] = fn(ctx, datos[tool])
            except Exception as e:      # noqa: BLE001 - lo demás tiene que seguir saliendo
                resumen['avisos'].append('%s_edit.json no se pudo aplicar: %r' % (tool, e))

    paso('libres', _libres)
    ctx.cargar(ctx.h.volcar())          # lo de los libres ya está en el texto: el resto los ve como cualquier otro elemento
    paso('capas', _capas)
    paso('tiempos', _tiempos)
    ctx.cargar(ctx.h.volcar())          # y las cajas de las capas: la raíz de su contenido (estilo) va por dentro de ellas
    for tool, fn in (('pistas', _pistas), ('color', _color), ('audiofx', _audiofx), ('estilo', _estilo), ('claves', _claves)):
        paso(tool, fn)
    if ctx.oculta:
        ctx.regla('[data-hidden]', 'display:none!important')
    if ctx.giran or ctx.js or ctx.con_caja:
        reg = None
        for n in ctx.h.nodos:
            if n.tag == 'script' and n.fin is not None:
                reg = re.search(r'window\.__timelines\s*\[[^\]]+\]\s*=\s*(\w+)', ctx.h.texto[n.b:n.fin])
                if reg:
                    pos = n.b + reg.start()
                    break
        if reg:
            js = ['/* mi-estudio */']
            if ctx.con_caja:
                js.append(_ORIGEN_JS)
            if ctx.arcos:
                js.append(_ARCO_JS)
            if ctx.giran:
                js.append(_GIRO_JS % json.dumps(ctx.giran))
            js += ctx.js
            ctx.h.meter(pos, re.sub(r'\btl\.', reg.group(1) + '.', ' '.join(js)) + '\n')    # en una línea: el lint avisa de los archivos largos
        else:
            resumen['avisos'].append('No se encontró dónde se registra la línea de tiempo: las claves no se aplican.')
    cabeza = next((n for n in ctx.h.nodos if n.tag == 'head'), None)
    if (ctx.css or ctx.enlaces) and cabeza is not None and cabeza.fin is not None:
        ctx.h.meter(cabeza.fin, ''.join(e + '\n' for e in ctx.enlaces) + '<style data-mi-estudio>%s</style>\n' % ''.join(ctx.css))
    out = ctx.h.volcar()
    m = re.match(r'\s*<!doctype[^>]*>\r?\n?', out, re.I)
    p = m.end() if m else 0
    return out[:p] + MARCA + '\n' + out[p:]


def _escribir(p, texto):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    tmp = p + '.tmp'
    with open(tmp, 'w', encoding='utf-8', newline='') as f:
        f.write(texto)
    os.replace(tmp, p)


def aplicar(proj):
    """Deja <proj>/index.html listo para renderizar. Devuelve qué se aplicó (cuántos objetivos por herramienta) y los avisos."""
    r = {'aplicado': {}, 'avisos': [], 'base': None, 'index': 'sin tocar'}
    datos = {}
    for tool in TOOLS:
        p = os.path.join(proj, 'edicion', tool + '_edit.json')
        if os.path.isfile(p):
            d = _leer_json(p)
            if isinstance(d, dict):
                datos[tool] = d
            else:
                r['avisos'].append('%s_edit.json está roto, se salta.' % tool)
    if os.path.isfile(os.path.join(proj, 'edicion', 'capas.json')):     # sin cambios también: Ver resultado mueve sus cajas en vivo
        datos.setdefault('capas', {})
    index, base =os.path.join(proj, 'index.html'), os.path.join(proj, 'work', 'mi-estudio', 'index.base.html')
    if not datos:
        return r
    if not os.path.isfile(index):
        r['avisos'].append('Este proyecto no tiene index.html todavía.')
        return r
    with open(index, encoding='utf-8', newline='') as f:
        actual = f.read()
    if MARCA not in actual:
        _escribir(base, actual)
        r['base'] = 'nueva'
    elif not os.path.isfile(base):
        r['avisos'].append('Falta work/mi-estudio/index.base.html: vuelve a generar el vídeo. index.html se queda como está.')
        return r
    else:
        r['base'] = 'la de antes'
    with open(base, encoding='utf-8', newline='') as f:
        texto = f.read()
    salida = _componer(proj, texto, datos, r)
    if salida is None:
        return r
    r['index'] = 'igual' if salida == actual else 'cambiado'
    if salida != actual:
        _escribir(index, salida)
    return r


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    print(json.dumps(aplicar(sys.argv[1]), ensure_ascii=False, indent=1))
