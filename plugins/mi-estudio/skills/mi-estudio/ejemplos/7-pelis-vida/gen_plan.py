"""plan.json for 7 películas 10/10 (Ultracinico, layout like the reference): a black band over the top with the film
strip (assets/band.mp4, 16:9) and the one-line captions under it, him pushed down below the band. The film's number +
name (Ultracinico H1) sits low on the strip with the Spanish streaming platforms in small type under it
(TMDB / JustWatch, region ES); "7 PELÍCULAS 10/10" on the hook and the CTA.

Where the titles, the platforms and the captions sit is set by hand in Mi Estudio, Edición > Capas: this script
offers the groups there (edicion/capas.json) and reads what the buyer left (edicion/capas_edit.json).
Run after gen_band.py and init_project.py.

  PY gen_plan.py <project>
"""
import json, os, sys
sys.path.insert(0, '<MI>')
import capas
import edicion

proj = sys.argv[1]
J = lambda n: json.load(open(os.path.join(proj, n), encoding='utf-8'))
edl, segs, words = J('edl.json'), J('segments.json'), J('words.json')
plan_p = os.path.join(proj, 'plan.json')
plan = json.load(open(plan_p, encoding='utf-8'))
if not os.path.isfile(os.path.join(os.environ["LOCALAPPDATA"], "video-studio", "styles", "ultracinico", "style.json")):
    sys.exit("Este script de ejemplo usa el estilo guardado Ultracinico, que no tienes: cópialo al proyecto y cambia el estilo.")
style = json.load(open(os.path.join(os.environ['LOCALAPPDATA'], 'video-studio', 'styles', 'ultracinico', 'style.json'), encoding='utf-8'))
L = capas.Capas(proj)

BAND, SY, SH, PUSH = 800, 120, 608, 70        # band bottom, strip top / height, how far he is pushed down
NAMES = {'bigfish': ('1.', 'BIG FISH'), 'sunshine': ('2.', 'LITTLE MISS SUNSHINE'), 'lost': ('3.', 'LOST IN TRANSLATION'),
         'perfect': ('4.', 'PERFECT DAYS'), 'chihiro': ('5.', 'EL VIAJE DE CHIHIRO'), 'straight': ('6.', 'UNA HISTORIA VERDADERA'),
         'kikujiro': ('7.', 'EL VERANO DE KIKUJIRO')}
# where to watch them in Spain (TMDB watch/providers, region ES, 2026-10-29); Kikujiro has none listed
PLAT = {'bigfish': 'Disponible en Movistar Plus+', 'sunshine': 'Disponible en Disney+',
        'lost': 'En alquiler en Apple TV, Rakuten TV y Prime Video', 'perfect': 'Disponible en Prime Video, HBO Max y Movistar Plus+',
        'chihiro': 'Disponible en Netflix', 'straight': 'Disponible en Movistar Plus+ y Filmin'}

D = {'hook': {'cx': 540, 'top': 668, 'scale': 1.0}, 'title': {'cx': 540, 'top': 572, 'scale': 1.0}, 'plat': {'cx': 540, 'top': 664, 'scale': 1.0},
     'subs': {'cx': 540, 'top': SY + SH + 14, 'scale': 1.0}}
G = edicion.editado(proj, 'capas', D)
HK, TT, PL, SB = G['hook'], G['title'], G['plat'], G['subs']

look = """
.cine-title.lbl{position:relative;left:auto;width:auto;white-space:nowrap}
.cine-title.lbl .ln{max-width:none;white-space:nowrap}
.cine-title.lbl .yn{color:#FFF238;text-shadow:0 0 6px rgba(255,242,56,.75),0 0 18px rgba(255,242,56,.75),0 0 36px rgba(255,242,56,.4)}
.plat{font-family:'DM Serif Display';font-style:italic;font-size:30px;line-height:1.1;color:rgba(255,255,255,.88);white-space:nowrap;
  text-shadow:1px 2px 4px rgba(0,0,0,.9),0 0 12px rgba(0,0,0,.6)}
.hook{display:flex;flex-direction:column;align-items:center;gap:6px}
.hook .cine-title,.hook .cine-h2{position:relative;left:auto;width:auto;white-space:nowrap}
.hook .cine-h2{font-size:58px;line-height:1.05;text-align:center}
.subs-prev{font-family:'DM Serif Display';font-size:42px;line-height:1.1;color:#FFF238;white-space:nowrap;text-shadow:2px 4px 6px rgba(0,0,0,.85)}
"""
css = look + f"""
.band{{position:absolute;left:0;top:0;width:1080px;height:{BAND}px;background:#000}}
.sfade{{position:absolute;left:0;top:{SY + SH - 300}px;width:1080px;height:300px;background:linear-gradient(to bottom,rgba(0,0,0,0),rgba(0,0,0,.62))}}
.hgrad{{position:absolute;left:0;top:{HK['top'] - 130}px;width:1080px;height:460px;background:linear-gradient(to bottom,rgba(0,0,0,0),rgba(0,0,0,.55) 35%,rgba(0,0,0,.5) 70%,rgba(0,0,0,0))}}
.pt-hook{{position:absolute;left:{HK['cx']}px;top:{HK['top']}px;transform:translateX(-50%) scale({HK['scale']});transform-origin:50% 0}}
.pt-title{{position:absolute;left:{TT['cx']}px;top:{TT['top']}px;transform:translateX(-50%) scale({TT['scale']});transform-origin:50% 0}}
.pt-plat{{position:absolute;left:{PL['cx']}px;top:{PL['top']}px;transform:translateX(-50%) scale({PL['scale']});transform-origin:50% 0}}
"""

blocks = []
for e, s in zip(edl, segs):
    a, b = s['frame'] / 30, (s['frame'] + s['frames']) / 30
    k = e.get('film', 'hook')
    if blocks and blocks[-1][0] == k:
        blocks[-1][2] = b
    else:
        blocks.append([k, a, b])
END = blocks[-1][2]
START = next(a for k, a, b in blocks if k != 'hook')     # the hook (mosaic + its text) ends here

layers = [
    {'id': 'band', 'anchor': 'full', 'from': round(START, 3), 'to': round(END, 3), 'html': "<div class='band'></div>", 'css': css},
    {'id': 'strip', 'anchor': 'full', 'from': round(START, 3), 'to': round(END, 3), 'html': '',
     'media': {'src': 'assets/band.mp4', 'w': 1080, 'x': 0, 'y': SY, 'radius': 0}},
    {'id': 'stripfade', 'anchor': 'full', 'from': round(START, 3), 'to': round(END, 3), 'html': "<div class='sfade'></div>"},
]
titles, plats, hooks = [], [], []
for k, a, b in blocks:
    if k == 'hook':                           # the reference's hook: text over the mosaic from the first frame, no motion
        h1 = edicion.texto(proj, 'hook', 'hook_h1', '7 PELÍCULAS 10/10')
        h2 = edicion.texto(proj, 'hook', 'hook_h2', 'para cuando sientes que tu vida<br>no va a ninguna parte').replace('\n', '<br>')
        # data-t: las dos partes que se reescriben en Mi Estudio (Edición), cada una con su clave
        hh = (f"<div class='hook'><div class='cine-title y' style='font-size:100px'><span class='ln' style='max-width:none' data-t='hook_h1'>{h1}</span></div>"
              f"<div class='cine-h2 w' data-t='hook_h2'>{h2}</div></div>")
        r = L.timed('hook_title', 'Gancho', a, b)
        if r:
            layers.append({'id': 'hook_title', 'anchor': 'full', 'from': round(r[0], 3), 'to': round(r[1], 3),
                           'html': f"<div class='hgrad'></div><div class='pt-hook'>{hh}</div>"})
            hooks.append((r[0], r[1], 'Gancho', hh, 'hook_title'))
        continue
    if k in NAMES:
        num, name = NAMES[k]
        name = edicion.texto(proj, 'title', f'title_{k}', name)
        fs = 84 if len(name) <= 16 else 74
        th = f"<div class='cine-title lbl' style='font-size:{fs}px'><span class='ln'><span class='yn'>{num}</span> {name}</span></div>"
        cid, lab = f'title_{k}', f'Título {name.title()}'
    elif k == 'cta':
        th = "<div class='cine-title lbl y' style='font-size:84px'><span class='ln'>" + edicion.texto(proj, 'title', 'title_cta', 'SÍGUEME') + "</span></div>"
        cid, lab = f'title_{k}', 'Título Sígueme'
    else:
        th = "<div class='cine-title lbl y' style='font-size:84px'><span class='ln'>" + edicion.texto(proj, 'title', f'title_{k}', '7 PELÍCULAS 10/10') + "</span></div>"
        cid, lab = f'title_{k}', 'Título 7 películas'
    r = L.timed(cid, lab, a, b)
    if r:
        layers.append({'id': cid, 'anchor': 'full', 'from': round(r[0], 3), 'to': round(r[1], 3), 'html': f"<div class='pt-title'>{th}</div>"})
        titles.append((r[0], r[1], lab, th, cid))
    if k in PLAT:
        ph = f"<div class='plat'>{edicion.texto(proj, 'plat', f'plat_{k}', PLAT[k])}</div>"
        r = L.timed(f'plat_{k}', f'Plataformas {NAMES[k][1].title()}', a, b)
        if r:
            layers.append({'id': f'plat_{k}', 'anchor': 'full', 'from': round(r[0], 3), 'to': round(r[1], 3), 'html': f"<div class='pt-plat'>{ph}</div>"})
            plats.append((r[0], r[1], PLAT[k], ph, f'plat_{k}'))
L.save()

cap = dict(style['caption'])
cap.update({'lines': 1, 'words': 5, 'chars': 30, 'position': round(SB['top']), 'size': round(42 * SB['scale'])})
plan['caption'] = cap
plan['layers'] = layers
# the mosaic over his own footage while the hook runs, with the captions off (the hook text carries the words)
first = next(w['start'] for w in words if w['start'] >= START - .05)   # the hook's last caption line would linger into film 1
plan['slots'] = [{'src': 'assets/mosaic.webm', 'from': 0, 'to': round(START, 3), 'overlay': True,
                  'hide_captions': [[0, round(first - .02, 3)]]}]
# full frame in the hook like the reference, then pushed down under the band
plan['motion'] = [{'id': 'push', 'target': '#plate', 'tween': 'set', 'vars': {'y': PUSH}, 'at': round(START, 3)}]
plan['title'] = ['7 películas 10/10', 'para cuando tu vida no va a ninguna parte']
plan.pop('css', None)
json.dump(plan, open(plan_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(layers), 'layers; caption y', cap['position'], 'end', round(END, 2))

# Mi Estudio, Edición > Capas: titles, platforms and captions, each a group that moves together
phrases, cur = [], []                         # (first, last) word index of each caption line
for i, w in enumerate(words):
    cur.append(i)
    if len(cur) == 5 or w['text'][-1:] in '.,?!:':
        phrases.append(cur); cur = []
if cur:
    phrases.append(cur)
it = lambda a, z, label, html, el=None: dict({'from': round(a, 3), 'to': round(z, 3), 'label': label, 'html': html}, **({'el': el} if el else {}))
edicion.ofrecer(proj, 'capas', {
    'video': 'assets/aroll.mp4', 'fonts': ['assets/fonts/fonts.css'], 'css': look + style['css'], 'reframe': None,
    'groups': [
        {'id': 'hook', 'label': 'Gancho', 'kind': 'center', 'default': D['hook'], 'items': [it(*h) for h in hooks]},
        {'id': 'title', 'label': 'Títulos de las pelis', 'kind': 'center', 'default': D['title'],
         'items': [it(*t) for t in titles]},
        {'id': 'plat', 'label': 'Plataformas', 'kind': 'center', 'default': D['plat'],
         'items': [it(*p) for p in plats]},
        {'id': 'subs', 'label': 'Subtítulos', 'kind': 'center', 'lockX': True, 'words': True, 'default': D['subs'],
         'items': [dict(it(words[p[0]]['start'], words[p[-1]]['end'] + .3, 'Subtítulos',
                           "<div class='subs-prev'>" + ' '.join(words[i]['text'] for i in p) + '</div>'), words=[p[0], p[-1]])
                   for p in phrases]},
    ]})
