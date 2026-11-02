#!/usr/bin/env python3
"""Elegir tomas sin leer ni escribir tiempos. Claude sigue decidiendo: elegir solo con reglas se probó contra 5 cortes aprobados y no vale
(cubría el 78 % y proponía un 41 % de más en un vídeo real): hay que entender qué se dice. Esto le quita lo mecánico.

    PY tomas.py "<proyecto>" [--preguntas]            -> lista compacta de work/islands_*.txt, en pantalla y en work/tomas.txt
    PY tomas.py "<proyecto>" --corte "<corte.txt>"    -> edl.json con los tiempos exactos

La lista, una línea por isla de voz:  número  segundo  duración  marcas  texto
    r3    esta toma repite la frase 3     *    la que elegiría una regla (la última completa de su voz): pista, no decisión
    baja  suena mucho más baja que su voz: suele ser un comentario     cortada  acaba a medias     ELLA  la otra voz

corte.txt, un clip por línea, en el orden del vídeo:   tomas [| texto corregido] [|| campo=valor campo=valor]
    7                                  la isla 7 con su texto
    15+16 | Bórralo. Te puede traer visitas.     las islas 15 y 16 como un solo clip, con el texto bien escrito
    15-17                              de la 15 a la 17
    33:"rentabilidad por dividendo"    solo ese trozo de la isla 33 (los tiempos salen de sus palabras). 33:"ETF"#3 es la tercera vez que lo dice
    2 | Vídeo a cámara. || kind=q item=camara    con los campos que pida el formato (se añaden a su fragmento de edl.json)
"""
import difflib
import json
import os
import re
import statistics
import sys
import unicodedata

sys.dont_write_bytecode = True
MARGEN_IN, MARGEN_OUT = .06, .10           # los bordes de siempre: un poco antes de la primera palabra y un poco después de la última
PARECIDO = .55                             # desde aquí, dos frases son tomas de lo mismo
VENTANA = 4                                # se repite cerca: una toma se busca solo entre las últimas frases
BAJO = 5.5                                 # dB por debajo de su voz normal
COLGANTE = {'tu', 'de', 'la', 'el', 'y', 'que', 'a', 'en', 'con', 'los', 'las', 'un', 'una', 'por', 'para', 'o', 'pero', 'te', 'se', 'lo', 'mi', 'su', 'es', 'del', 'al', 'como'}


def planas(s):
    s = unicodedata.normalize('NFD', s.lower())
    return re.sub(r'[^\w% ]', ' ', ''.join(c for c in s if unicodedata.category(c) != 'Mn')).split()


def parecido(a, b):
    """Lo parecidas que son dos frases: en orden, o lo que tiene la corta dentro de la larga (una toma que se cortó a medias)."""
    if not a or not b:
        return 0.0
    m = difflib.SequenceMatcher(None, a, b, autojunk=False)
    junto = sum(x.size for x in m.get_matching_blocks())
    return max(m.ratio(), .9 * junto / min(len(a), len(b)) if min(len(a), len(b)) >= 3 else 0.0)


def leer(path, clip):
    try:
        lineas = open(path, encoding='utf-8').read().splitlines()
    except UnicodeDecodeError:
        lineas = open(path, encoding='cp1252', errors='replace').read().splitlines()
    out = []
    for ln in lineas:
        m = re.match(r'\s*([\d.]+)-\s*([\d.]+)\s+(\S+)\s+(\d+)Hz\s+(-?[\d.]+)dB \| (.*)', ln)
        if m:
            s, e, voz, _hz, db, txt = m.groups()
            out.append({'clip': clip, 'in': float(s), 'out': float(e), 'voz': voz, 'db': float(db), 'texto': txt.strip(), 'p': planas(txt), 'w': []})
        elif out and '@' in ln and ln.startswith(' '):
            for w in ln.split():
                k = w.rfind('@')
                if k > 0:
                    t = re.match(r'-?[\d.]+', w[k + 1:])
                    if t:
                        out[-1]['w'].append((w[:k], max(float(t.group(0)), out[-1]['in'])))
    return out


def islas(proj):
    fuentes = json.load(open(os.path.join(proj, 'sources.json'), encoding='utf-8'))
    out = []
    for cid in fuentes:
        p = os.path.join(proj, 'work', 'islands_%s.txt' % cid)
        if os.path.isfile(p):
            out += leer(p, cid)
    if not out:
        raise SystemExit('No hay work/islands_*.txt: corre antes transcribir.py islas.')
    for n, u in enumerate(out, 1):
        u['n'] = n
    return out


def cortada(u):
    t = u['texto'].rstrip()
    return t.endswith(('...', '…', ',', '-')) or bool(u['p'] and u['p'][-1] in COLGANTE)


def lista(us, preguntas=False):
    """Agrupa las repeticiones y marca lo que ayuda a decidir. Devuelve las líneas."""
    normal = statistics.median([u['db'] for u in us if u['voz'] != 'ELLA'] or [u['db'] for u in us])
    grupos, de = [], {}
    for u in us:
        mejor, nota = None, 0.0
        for g in grupos[-VENTANA:]:
            if g[-1]['clip'] != u['clip']:
                continue
            x = max(parecido(y['p'], u['p']) for y in g)
            if x > nota:
                mejor, nota = g, x
        if mejor is not None and nota >= PARECIDO:
            de[u['n']] = mejor[0]['n']
            mejor.append(u)
        else:
            grupos.append([u])
    pista = set()
    for g in grupos:
        suyas = g if preguntas else ([u for u in g if u['voz'] != 'ELLA'] or g)
        largo = max(len(u['p']) for u in suyas)
        buenas = [u for u in suyas if not cortada(u) and len(u['p']) >= .7 * largo and u['db'] >= normal - BAJO]
        if buenas:
            pista.add(buenas[-1]['n'])
    out, clip = [], None
    for u in us:
        if u['clip'] != clip:
            clip = u['clip']
            out.append('== %s' % clip)
        marcas = ['*' if u['n'] in pista else ' ']
        if u['n'] in de:
            marcas.append('r%d' % de[u['n']])
        if u['voz'] != 'EL':
            marcas.append(u['voz'])
        if u['db'] < normal - BAJO:
            marcas.append('baja')
        if cortada(u):
            marcas.append('cortada')
        out.append('%3d %7.2f %4.1fs %-14s %s' % (u['n'], u['in'], u['out'] - u['in'], ' '.join(marcas), u['texto']))
    return out


def _trozo(u, frase, vez):
    """(inicio, fin) del trozo de una isla que dice esa frase, sacados de los tiempos de sus palabras."""
    q = planas(frase)
    ws = [(planas(w), t) for w, t in u['w']]
    plano, sitio = [], []
    for i, (p, _t) in enumerate(ws):
        for x in p:
            plano.append(x)
            sitio.append(i)
    hit = [k for k in range(len(plano) - len(q) + 1) if plano[k:k + len(q)] == q]
    if len(hit) < vez:
        raise ValueError('la isla %d no dice "%s"%s' % (u['n'], frase, ' %d veces' % vez if vez > 1 else ''))
    k = hit[vez - 1]
    a, z = sitio[k], sitio[k + len(q) - 1]
    return ws[a][1], ws[z + 1][1] if z + 1 < len(ws) else u['out'], ' '.join(u['w'][i][0] for i in range(a, z + 1))


def resolver(refs, por_n):
    """(clip, inicio, fin, texto) de lo que pide una línea: 7 · 15+16 · 15-17 · 33:"frase"#2"""
    tramos = []
    for r in re.findall(r'\d+:"[^"]+"(?:#\d+)?|\d+-\d+|\d+', refs):
        m = re.fullmatch(r'(\d+):"([^"]+)"(?:#(\d+))?', r)
        if m:
            u = por_n[int(m.group(1))]
            a, z, t = _trozo(u, m.group(2), int(m.group(3) or 1))
            tramos.append((u['clip'], a, z, t))
            continue
        a, _, b = r.partition('-')
        for n in range(int(a), int(b or a) + 1):
            u = por_n[n]
            tramos.append((u['clip'], u['in'], u['out'], u['texto']))
    if not tramos:
        raise ValueError('no entiendo "%s"' % refs)
    if len({t[0] for t in tramos}) > 1:
        raise ValueError('"%s" mezcla clips: va en dos líneas' % refs)
    return tramos[0][0], min(t[1] for t in tramos), max(t[2] for t in tramos), ' '.join(t[3] for t in tramos)


def corte(proj, path):
    por_n = {u['n']: u for u in islas(proj)}
    edl, errores = [], []
    for ln in open(path, encoding='utf-8').read().splitlines():
        ln = ln.strip()
        if not ln or ln.startswith('#'):
            continue
        cuerpo, _, extras = ln.partition('||')
        refs, _, texto = cuerpo.partition('|')
        try:
            clip, a, z, whisper = resolver(refs, por_n)
        except KeyError as e:
            errores.append('%s: no existe la isla %s' % (ln[:60], e))
            continue
        except ValueError as e:
            errores.append('%s: %s' % (ln[:60], e))
            continue
        s = {'id': 'f%d' % (len(edl) + 1), 'clip': clip, 'in': round(max(0, a - MARGEN_IN), 3), 'out': round(z + MARGEN_OUT, 3), 'zoom': 1, 'cx': .5, 'cy': .42, 'line': texto.strip() or whisper}
        for par in extras.split():
            k, _, v = par.partition('=')
            s[k] = v
        edl.append(s)
    if errores:
        raise SystemExit('No se ha escrito edl.json:\n  ' + '\n  '.join(errores))
    dest = os.path.join(proj, 'edl.json')
    if os.path.isfile(dest):
        os.replace(dest, os.path.join(proj, 'work', 'edl_antes.json'))
    with open(dest, 'w', encoding='utf-8') as f:
        json.dump(edl, f, ensure_ascii=False, indent=1)
    return edl


def main():
    a = sys.argv[1:]
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    preguntas = '--preguntas' in a
    a = [x for x in a if x != '--preguntas']
    if '--corte' in a:
        i = a.index('--corte')
        edl = corte(a[0], a[i + 1])
        print('edl.json: %d clips, %.1f s' % (len(edl), sum(s['out'] - s['in'] for s in edl)))
        return
    if len(a) != 1:
        sys.exit(__doc__)
    txt = '\n'.join(lista(islas(a[0]), preguntas))
    with open(os.path.join(a[0], 'work', 'tomas.txt'), 'w', encoding='utf-8') as f:
        f.write(txt + '\n')
    print(txt)


if __name__ == '__main__':
    main()
