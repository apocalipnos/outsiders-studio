"""plan.json for "Test de finanzas": hook title plate, then one concept per segment (term big on top + its card over
the chest, hard swaps like the reference), brand captions only on the hook and the CTA. Brand: #195FF1, Inter Tight.

Where each group of layers sits (and how close the shot is) is set by hand in Mi Estudio, Edición > Capas y encuadre:
this script offers the groups there (edicion/capas.json) and reads what the buyer left (edicion/capas_edit.json).

  python gen_plan.py <project>
"""
import json
import os
import shutil
import sys

proj = sys.argv[1]
sys.path.insert(0, '<MI>')
import capas  # noqa: E402
import edicion  # noqa: E402

segs = json.load(open(os.path.join(proj, 'segments.json'), encoding='utf-8'))
DUR = (segs[-1]['frame'] + segs[-1]['frames']) / 30
BLUE, INK = '#195FF1', '#111214'
IMG_DIR = 'img2'  # img: first card style, img2: the REEL 4 infographic style
GRADE = 'brightness(1.13) contrast(1.05) saturate(1.06)'

# segment id (as Mi Estudio leaves it, split parts end in "b") -> term on top, card image
TERMS = {'m2': ('M2', 'm2'), 'dividendo': ('Rentabilidad por dividendo', 'dividendo'), 'etf': ('ETF', 'etf'),
         'diworsification': ('Diworsification', 'diworsification'), 'cagr': ('CAGR', 'cagr'),
         'interes': ('Interés compuesto', 'interes-compuesto'), 'rentas-evfcf': ('EV/FCF', 'ev-fcf'),
         'rentas-evfcfbb': ('Renta variable', 'renta-variable'), 'rentas-evfcfbbbb': ('Renta fija', 'renta-fija'),
         'volatilidad': ('Volatilidad', 'volatilidad'), 'roic': ('ROIC', 'roic'), 'drawdown': ('Drawdown', 'drawdown'),
         'dca': ('DCA', 'dca'), 'apalancamiento': ('Apalancamiento (leverage)', 'apalancamiento'),
         'colchon': ('Colchón de emergencia', 'colchon'), 'ter': ('TER', 'ter'), 'pink': ('Pink sheets', 'pink-sheets')}

t0 = {s['id']: s['frame'] / 30 for s in segs}
order = [s['id'] for s in segs]
list_ids = [i for i in order if i in TERMS]
t_cta = t0[next(i for i in order if i.startswith('cta'))]

# what is proposed, and what the buyer set by hand on top of it
D = {'card': {'left': 100, 'top': 790, 'width': 880}, 'term': {'cx': 540, 'top': 232, 'scale': 1.0},
     'title': {'cx': 540, 'top': 1262, 'scale': 1.0}, 'subs': {'cx': 540, 'top': 1140, 'scale': 1.0}, 'reframe': {'zoom': 1.0}}
old = os.path.join(proj, 'work', 'edit_layout.json')     # the first, separate layout editor
if os.path.exists(old) and not os.path.exists(os.path.join(proj, 'edicion', 'capas_edit.json')):
    os.makedirs(os.path.join(proj, 'edicion'), exist_ok=True)
    shutil.copy(old, os.path.join(proj, 'edicion', 'capas_edit.json'))
G = edicion.editado(proj, 'capas', D)
# a trial reel can have its own hook title (work/title.json: {"html": ..., "scale": ...})
TITLE_HTML = "Test de <b>finanzas</b><small>(edición inversión)</small>"
TF = os.path.join(proj, 'work', 'title.json')
if os.path.exists(TF):
    t = json.load(open(TF, encoding='utf-8'))
    TITLE_HTML = t['html']
    G['title']['scale'] = t.get('scale', G['title']['scale'])
C, TM, TT, SB = G['card'], G['term'], G['title'], G['subs']

SHADOW = '0 2px 3px rgba(0,0,0,.55),0 0 18px rgba(0,0,0,.45),0 0 4px rgba(0,0,0,.5)'
# what each layer looks like (also what Mi Estudio draws while you move it)
look = f"""
.tfc-term span{{color:#fff;font-family:'Inter Tight';font-weight:700;line-height:1.1;letter-spacing:0;white-space:nowrap;text-shadow:{SHADOW}}}
.tfc-card{{width:100%;height:100%;overflow:hidden;box-shadow:0 18px 44px rgba(0,0,0,.38);background:#F3F2EE}}
.tfc-card img{{width:100%;height:100%;object-fit:cover;display:block;transform:scale(1.06)}}
.tfc-title{{background:#fff;color:{INK};font:800 54px/1.08 'Inter Tight';padding:16px 34px;border-radius:20px;
 text-align:center;box-shadow:0 10px 26px rgba(0,0,0,.3);white-space:nowrap}}
.tfc-title small{{display:block;font:700 36px/1.2 'Inter Tight';color:#5B6068;margin-top:4px}}
.tfc-title b{{color:{BLUE};font-weight:900}}
.tfc-subs{{color:#fff;font:700 52px/1.1 'Inter Tight';white-space:nowrap;text-shadow:{SHADOW}}}
"""
# where it sits
css = look + f"""
.tf-term{{position:absolute;left:{TM['cx']}px;top:{TM['top']}px;transform:translateX(-50%) scale({TM['scale']});transform-origin:50% 0}}
.tf-card{{position:absolute;left:{C['left']}px;top:{C['top']}px;width:{C['width']}px;height:{round(C['width'] * 2 / 3)}px}}
.tf-title{{position:absolute;left:{TT['cx']}px;top:{TT['top']}px;transform:translateX(-50%) scale({TT['scale']});transform-origin:50% 0}}
"""

L = capas.Capas(proj)
layers, sounds = [], []
title_html = f"<div class='tfc-title'>{TITLE_HTML}</div>"
r = L.timed('title', 'Título', 0.0, t0[list_ids[0]])
if r:
    layers.append({'id': 'title', 'anchor': 'full', 'from': round(r[0], 3), 'to': round(r[1], 3),
                   'html': f"<div class='tf-title'>{title_html}</div>"})
concepts = []
for k, sid in enumerate(list_ids):
    term, img = TERMS[sid]
    a = t0[sid]
    z = t0[list_ids[k + 1]] if k + 1 < len(list_ids) else t_cta
    term_html = f"<div class='tfc-term'><span style='font-size:{min(88, int(1000 / (len(term) * 0.56)))}px'>{term}</span></div>"
    card_html = f"<div class='tfc-card'><img src='assets/{IMG_DIR}/{img}.png'></div>"
    concepts.append((a, z, term, term_html, card_html, img))
    r = L.timed(f'term-{img}', f'Término {term}', a, z)
    if r:
        layers.append({'id': f'term-{img}', 'anchor': 'full', 'from': round(r[0], 3), 'to': round(r[1], 3),
                       'html': f"<div class='tf-term'>{term_html}</div>"})
    r = L.timed(f'card-{img}', f'Tarjeta {term}', a, z)
    if r:
        layers.append({'id': f'card-{img}', 'anchor': 'full', 'from': round(r[0], 3), 'to': round(r[1], 3),
                       'html': f"<div class='tf-card'>{card_html}</div>",
                       'motion': [{'target': '.tf-card', 'tween': 'from',
                                   'vars': {'scale': 0.88, 'opacity': 0, 'duration': 0.14, 'ease': 'back.out(2)'}}]})
        sounds.append({'src': 'assets/sfx/pop.mp3', 'at': round(r[0], 2), 'vol': 0.12})
L.save()
layers[0]['css'] = css

# the brand's captions (as in "Cripto: cuándo comprar"): plain white sentence-case phrases with a soft shadow
caption = {'font': 'Inter Tight', 'weight': 700, 'case': 'as-typed', 'size': round(52 * SB['scale']), 'line_height': 1.1,
           'color': '#FFFFFF', 'accent': '#FFFFFF', 'lit': 'none', 'mark': 'none', 'shadow': SHADOW.replace('),', '), '),
           'words': 4, 'chars': 24, 'lines': 1, 'position': round(SB['top']), 'entrance': 'none'}

plan = json.load(open(os.path.join(proj, 'plan.json'), encoding='utf-8'))
if G['reframe']['zoom'] > 1.0:   # the whole picture a little closer, around the face (layers stay put)
    plan['reframe'] = {'zoom': G['reframe']['zoom']}
else:
    plan.pop('reframe', None)
plan.update({'title': ['Test de finanzas', '(edición inversión)'], 'caption': caption, 'layers': layers,
             'sounds': sounds, 'grade': GRADE})
json.dump(plan, open(os.path.join(proj, 'plan.json'), 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print(len(layers), 'layers', len(sounds), 'sounds', f'dur {DUR:.2f}', 'list', [(i, round(t0[i], 2)) for i in list_ids])

# Mi Estudio, Edición > Capas y encuadre: every group, with what it shows at each moment
words = json.load(open(os.path.join(proj, 'words.json'), encoding='utf-8'))
phrases, cur = [], []
for w in words:
    cur.append(w)
    if len(cur) == 4 or w['text'][-1:] in '.,?!':
        phrases.append(cur); cur = []
if cur:
    phrases.append(cur)
head = json.load(open(os.path.join(proj, 'layout.json'), encoding='utf-8'))['head']   # the point the reframe zooms around
# "el": its block in Mi Estudio's Capas track, so the preview shows it when that block says
it = lambda a, z, label, html, el=None: dict({'from': round(a, 3), 'to': round(z, 3), 'label': label, 'html': html}, **({'el': el} if el else {}))
edicion.ofrecer(proj, 'capas', {
    'video': 'assets/aroll.mp4', 'grade': GRADE, 'fonts': ['assets/fonts/fonts.css'], 'css': look,
    'reframe': {'origin': [head['cx'], (head['top'] + head['chin']) / 2], 'default': D['reframe']['zoom'], 'max': 1.4},
    'groups': [
        {'id': 'card', 'label': 'Imagen', 'kind': 'box', 'aspect': 1.5, 'default': D['card'],
         'items': [it(a, z, term, card, f'card-{img}') for a, z, term, _, card, img in concepts]},
        {'id': 'term', 'label': 'Títulos de arriba', 'kind': 'center', 'default': D['term'],
         'items': [it(a, z, term, th, f'term-{img}') for a, z, term, th, _, img in concepts]},
        {'id': 'subs', 'label': 'Subtítulos', 'kind': 'center', 'lockX': True, 'default': D['subs'],
         'items': [it(p[0]['start'], p[-1]['end'] + .35, 'Subtítulos', "<div class='tfc-subs'>" + ' '.join(w['text'] for w in p) + '</div>')
                   for p in phrases]},
        {'id': 'title', 'label': 'Título del gancho', 'kind': 'center', 'default': D['title'],
         'items': [it(0, t0[list_ids[0]], 'Gancho', title_html, 'title')]},
    ]})
