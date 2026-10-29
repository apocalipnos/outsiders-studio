"""plan.json for "Tipos de ganchos": the reference's look rebuilt as layers.
Title on top (white / yellow), numbered list 1- to 10- on the left, a yellow pill per hook when its name is said,
example reels as a 9:16 card over the blurred shot (their own audio), spoken examples as a quote over the blurred
frame (words appear as they are said), the title turns into the CTA at "escríbeme".
Reads edl.json (kind/puesto per segment), segments.json, words.json. Every timed layer goes through capas.timed(), so
what the user moved, stretched or removed in Mi Estudio wins; timeline.json is rewritten with all of them.
Also mutes his audio under the example clips (assets/aroll.mp4, original kept in work/aroll_orig.mp4).

  PY gen_plan.py <project>
"""
import json, os, re, shutil, subprocess, sys
sys.path.insert(0, '<MI>')
import capas

proj = sys.argv[1]
FF = json.load(open(os.path.join(os.environ['LOCALAPPDATA'], 'video-studio', '.platform.json'), encoding='utf-8'))['ffmpeg']
J = lambda n: json.load(open(os.path.join(proj, n), encoding='utf-8'))
edl, segs, words = J('edl.json'), J('segments.json'), J('words.json')
L = capas.Capas(proj)
plan_p = os.path.join(proj, 'plan.json')
plan = json.load(open(plan_p, encoding='utf-8'))
DUR = (segs[-1]['frame'] + segs[-1]['frames']) / 30

Y = '#F2C810'
LBL = {10: 'Gancho trend temporal', 9: 'Gancho de hype', 8: 'Gancho de lista', 7: 'Gancho de situación común',
       6: 'Gancho figura de autoridad', 5: 'Gancho de dolor', 4: 'Gancho rompe creencias', 3: 'Gancho de advertencia',
       2: 'Gancho visual', 1: 'Gancho natural'}
QUOTE = {9: 'El secreto ilegal que hacen todos los grandes creadores de contenido de Estados Unidos',
         8: '3 apps para ser más culto',
         7: 'Si vas a sacarte el carnet de conducir, esto te interesa',
         6: 'Así es como se hacen el café los baristas profesionales',
         5: 'Si te duelen las rodillas al correr, haz esto',
         4: 'Si cuando aparcas pones el coche en punto muerto, lo estás haciendo mal',
         3: 'Si cargas tu móvil así, estás destrozando la batería de tu móvil'}
ROW0, STEP = 478, 104                    # centre y of "1-", row step (10- at 1414)
CARD = dict(x=200, y=410, w=594)         # 594 x 1056


def span(i):
    s = segs[i]
    return s['frame'] / 30, (s['frame'] + s['frames']) / 30


def norm(t):
    return re.sub(r'[^a-z0-9ñ]', '', t.lower().translate(str.maketrans('áéíóúü', 'aeiouu')))


def words_in(a, b):
    return [w for w in words if a - .05 <= w['start'] < b]


def find(a, b, token, after=None):
    for w in words_in(a, b):
        if norm(w['text']) == token and (after is None or w['start'] >= after):
            return w['start']
    return None


# groups of segments: consecutive segments of one kind and puesto
groups, i = [], 0
while i < len(edl):
    j = i
    if edl[i]['kind'] in ('quote', 'clip', 'title'):       # a piece split in Mi Estudio stays one group
        while j + 1 < len(edl) and edl[j + 1]['kind'] == edl[i]['kind'] and edl[j + 1]['puesto'] == edl[i]['puesto']:
            j += 1
    groups.append((edl[i], span(i)[0], span(j)[1], i, j))
    i = j + 1

layers, sounds, mute = [], [], []
pill_at, cta_at, ding_at = {}, None, None
for e, a, b, i, j in groups:
    n, kind = e['puesto'], e['kind']
    if kind == 'title':
        t = find(a, b, 'gancho') or a + .6  # the pill comes in on the word "gancho"
        r = L.timed(f'pill{n}', f'Píldora {n}: {LBL[n]}', t, t + 1.2)
        if r:
            pill_at[n] = r[0]
    elif kind == 'clip':                       # a video overlay (Mi Estudio): its piece is cut by overlay_edl.py
        ca, d = a, b - a
        mute.append((ca, ca + d))
        layers.append({'id': f'cardbg{n}', 'anchor': 'full', 'from': round(ca, 3), 'to': round(ca + d, 3),
                       'html': "<div class='blur'></div>"})
        layers.append({'id': f'card{n}', 'anchor': 'full', 'from': round(ca, 3), 'to': round(ca + d, 3),
                       'media': {'src': f"assets/ov/{e['id']}.mp4", 'w': CARD['w'], 'x': CARD['x'], 'y': CARD['y'], 'radius': 0},
                       'html': '', 'z': 'card'})
        sounds.append({'src': f"assets/ov/{e['id']}.wav", 'at': round(ca, 3), 'vol': 0.8, 'dur': round(d, 3)})
    elif kind == 'quote':
        qa, qb = a, b
        ws = [w for w in words_in(qa, qb)]
        # the quote starts after "por ejemplo," (said, not shown)
        k = 0
        for m, w in enumerate(ws):
            if norm(w['text']) == 'ejemplo':
                k = m + 1
        ws = ws[k:]
        if not ws and not e.get('mute'):     # the example was cut out: only "por ejemplo" is left, no silent quote
            continue
        text = QUOTE[n].split(' ')
        if e.get('mute') or not ws:         # not said: words appear one after another
            start = qa + .15
            times = [start + .1 + m * .09 for m in range(len(text))]
        else:
            start = ws[0]['start'] - .12
            # map shown words onto said words in order (same count expected; spread when they differ)
            st = [w['start'] for w in ws]
            times = [st[min(len(st) - 1, round(m * (len(st) - 1) / max(1, len(text) - 1)))] for m in range(len(text))] \
                if len(st) != len(text) else st
            times = [max(start + .02, t - .03) for t in times]
        r = L.timed(f'quote{n}', f'Cita {n}', start, qb)
        if not r:
            continue
        start, qb = r
        times = [max(start + .02 * (m + 1), t) for m, t in enumerate(times)]   # moved later: the words already said come in fast
        spans = ''.join(f"<span class='w w{m}'>{w}</span> " for m, w in enumerate(text)).strip()
        html = (f"<div class='blur qb'></div><div class='qt'><span class='qm'>“</span>{spans}"
                f"<span class='qm qe'>”</span></div>")
        mo = [{'target': '.qb', 'tween': 'from', 'vars': {'opacity': 0, 'duration': .14, 'ease': 'power1.out'}},
              {'target': '.qm:not(.qe)', 'tween': 'to', 'vars': {'opacity': 1, 'duration': .1}, 'at': .06},
              {'target': '.qe', 'tween': 'to', 'vars': {'opacity': 1, 'duration': .14}, 'at': round(times[-1] - start + .12, 3)}]
        mo += [{'target': f'.w{m}', 'tween': 'to', 'vars': {'opacity': 1, 'duration': .14, 'ease': 'power1.out'},
                'at': round(t - start, 3)} for m, t in enumerate(times)]
        layers.append({'id': f'quote{n}', 'anchor': 'full', 'from': round(start, 3), 'to': round(qb, 3),
                       'html': html, 'motion': mo, 'z': 'quote'})
    elif kind == 'cta':
        t = (find(a, b, 'escribeme') or a + 4.6) - .05
        r = L.timed('titlecta', 'Título → ESCRÍBEME «GANCHO»', t, DUR)
        cta_at = r[0] if r else None
        tg = find(a, b, 'gancho', after=t) or t + .6          # "escríbeme GANCHO": a ding and the word lights up
        rd = L.timed('ding', 'DING + «GANCHO» destacado', tg - .03, tg + .5)
        ding_at = rd[0] if rd else None
        if rd:
            sounds.append({'src': 'assets/ding.wav', 'at': round(ding_at, 3), 'vol': 0.45, 'dur': 1.4})

# title, list numbers, pills (pills sit under the card and quote layers)
title = lambda l1, l2, c='y': f"<div class='tt'><span>{l1}</span><span class='{c}'>{l2}</span></div>"
base = [{'id': 'title', 'anchor': 'full', 'from': 0, 'to': round(cta_at if cta_at is not None else DUR, 3), 'html': title('TIPOS DE', 'GANCHOS')}]
if cta_at is not None:
    mo = [{'target': '.tt', 'tween': 'from', 'vars': {'scale': .9, 'opacity': 0, 'duration': .18, 'ease': 'back.out(2)'}}]
    if ding_at is not None:
        at = round(max(0.0, ding_at - cta_at), 3)
        mo += [{'target': '.yc', 'tween': 'to', 'vars': {'backgroundColor': Y, 'color': '#111111', 'duration': .1}, 'at': at},
               {'target': '.yc', 'tween': 'fromTo', 'from': {'scale': 1.32}, 'vars': {'scale': 1, 'duration': .38, 'ease': 'back.out(3)', 'immediateRender': False}, 'at': at}]
    base.append({'id': 'titlecta', 'anchor': 'full', 'from': round(cta_at, 3), 'html': title('ESCRÍBEME', '«GANCHO»', 'y yc'), 'motion': mo})
base += [
        {'id': 'nums', 'anchor': 'full',
         'html': ''.join(f"<div class='nm' style='top:{ROW0 + (n - 1) * STEP - 40}px'>{n}-</div>" for n in range(1, 11))}]
pills = []
for n, t in sorted(pill_at.items(), key=lambda x: x[1]):
    pills.append({'id': f'pill{n}', 'anchor': 'full', 'from': round(t, 3),
                  'html': f"<div class='pl' style='top:{ROW0 + (n - 1) * STEP - 27}px'><span>{LBL[n]}</span></div>",
                  'motion': [{'target': '.pl', 'tween': 'from', 'vars': {'scaleX': 1.35, 'opacity': 0, 'duration': .22, 'ease': 'power2.out'}},
                             {'target': '.pl span', 'tween': 'from', 'vars': {'filter': 'blur(6px)', 'opacity': 0, 'duration': .24, 'ease': 'power1.out'}}]})

# "gráficos en pantalla": a burst sticker next to him while he says it
gs = [span(k) for k, e in enumerate(edl) if e['id'].startswith('graficos')]
g = (gs[0][0], gs[-1][1]) if gs else None
r = None
if g:
    ta = find(g[0], g[1], 'graficos') or g[0]
    tb = find(g[0], g[1], 'definitiva') or ta + 1.6
    r = L.timed('wow', '¡WOW! (gráficos en pantalla)', ta - .05, tb - .1)
if r:
    ta, tb = r[0] + .05, r[1] + .1
    burst = ("<svg class='bs' viewBox='0 0 200 200'><polygon fill='" + Y + "' stroke='#111' stroke-width='5' stroke-linejoin='round' points='"
             + ' '.join(f"{100 + (92 if k % 2 == 0 else 62) * __import__('math').cos(k * 3.14159 / 10):.1f},"
                        f"{100 + (92 if k % 2 == 0 else 62) * __import__('math').sin(k * 3.14159 / 10):.1f}" for k in range(20))
             + "'/></svg><div class='bt'>¡WOW!</div>")
    layers.append({'id': 'wow', 'anchor': 'full', 'from': round(ta - .05, 3), 'to': round(tb - .1, 3),
                   'html': f"<div class='wow'>{burst}</div>",
                   'motion': [{'target': '.wow', 'tween': 'from', 'vars': {'scale': 0, 'rotation': -25, 'duration': .4, 'ease': 'back.out(2.2)'}},
                              {'target': '.bs', 'tween': 'to', 'vars': {'rotation': 25, 'duration': 2.5, 'ease': 'none'}, 'at': .1}]})

# "si no..." -> the punch-in itself is the example; he never says "a un cambio de plano", so it is written
cs = [span(k) for k, e in enumerate(edl) if e['id'].startswith('cambiob')]
c = (cs[0][0], cs[-1][1]) if cs else None
c = c and L.timed('cambio', 'Rótulo CAMBIO DE PLANO', c[0], c[1])
if c:
    layers.append({'id': 'cambio', 'anchor': 'full', 'from': round(c[0], 3), 'to': round(c[1], 3),
                   'html': "<div class='cp'>CAMBIO DE PLANO</div>",
                   'motion': [{'target': '.cp', 'tween': 'from', 'vars': {'scale': 1.3, 'opacity': 0, 'duration': .16, 'ease': 'back.out(2)'}}]})

# z-order: blur backgrounds under title/list, cards over the pills, quotes over everything
bg = [l for l in layers if l['id'].startswith('cardbg')]
cards = [l for l in layers if l.get('z') == 'card']
quotes = [l for l in layers if l.get('z') == 'quote']
rest = [l for l in layers if l not in bg + cards + quotes]
for l in cards + quotes:
    l.pop('z', None)
plan['layers'] = bg + base + pills + cards + rest + quotes
plan['title'] = ['', '']
plan['sounds'] = sounds
plan['css'] = f'''
@font-face{{font-family:'MontserratX';font-weight:900;font-display:block;src:url('assets/fonts/Montserrat-900-normal.woff2')}}
@font-face{{font-family:'MontserratX';font-weight:700;font-display:block;src:url('assets/fonts/Montserrat-700-normal.woff2')}}
@font-face{{font-family:'MontserratX';font-weight:500;font-display:block;src:url('assets/fonts/Montserrat-500-normal.woff2')}}
.tt{{position:absolute;left:0;top:226px;width:1080px;text-align:center;font-family:'MontserratX';font-weight:900;font-size:94px;
  line-height:84px;letter-spacing:-.035em;color:#fff;text-shadow:0 4px 18px rgba(0,0,0,.35);transform-origin:50% 50%}}
.tt span{{display:block}} .tt .y{{color:{Y}}}
.tt .yc{{display:table;margin:2px auto 0;padding:4px 26px 10px;border-radius:18px;background:rgba(242,200,16,0);transform-origin:50% 50%}}
.nm{{position:absolute;left:0;width:178px;text-align:right;font-family:'MontserratX';font-weight:900;font-size:64px;line-height:80px;
  letter-spacing:-.04em;color:#fff;text-shadow:0 3px 12px rgba(0,0,0,.4)}}
.pl{{position:absolute;left:190px;height:54px;padding:0 16px;border-radius:12px;background:{Y};display:flex;align-items:center;
  transform-origin:0 50%;box-shadow:0 3px 10px rgba(0,0,0,.18)}}
.pl span{{font-family:'MontserratX';font-weight:500;font-size:33px;letter-spacing:-.035em;color:#111;white-space:nowrap}}
.blur{{position:absolute;left:0;top:0;width:1080px;height:1920px;backdrop-filter:blur(22px) brightness(.62);
  -webkit-backdrop-filter:blur(22px) brightness(.62)}}
.qt{{position:absolute;left:90px;top:800px;width:900px;text-align:center;font-family:'MontserratX';font-weight:700;font-size:58px;
  line-height:66px;letter-spacing:-.035em;color:#fff;text-shadow:0 3px 14px rgba(0,0,0,.35)}}
.qt .w{{opacity:0}} .qt .qm{{color:{Y};opacity:0;font-weight:900}}
.cp{{position:absolute;left:190px;top:1280px;width:860px;text-align:center;font-family:'MontserratX';font-weight:900;font-size:74px;
  line-height:80px;letter-spacing:-.035em;color:{Y};text-shadow:0 4px 18px rgba(0,0,0,.5);transform-origin:50% 50%}}
.wow{{position:absolute;left:700px;top:1010px;width:300px;height:300px;transform-origin:50% 50%}}
.wow .bs{{position:absolute;left:0;top:0;width:300px;height:300px;transform-origin:50% 50%;filter:drop-shadow(0 8px 18px rgba(0,0,0,.35))}}
.wow .bt{{position:absolute;left:0;top:118px;width:300px;text-align:center;font-family:'MontserratX';font-weight:900;font-size:56px;
  line-height:64px;letter-spacing:-.03em;color:#111;transform:rotate(-8deg)}}
'''
json.dump(plan, open(plan_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
L.save()

# his audio under the example clips: silenced (original kept)
orig = os.path.join(proj, 'work', 'aroll_orig.mp4')
aroll = os.path.join(proj, 'assets', 'aroll.mp4')
if not os.path.exists(orig):
    shutil.copy2(aroll, orig)
expr = '+'.join(f'between(t,{a - .03:.3f},{b + .03:.3f})' for a, b in mute) or '0'
subprocess.run([FF, '-loglevel', 'error', '-y', '-i', orig, '-c:v', 'copy', '-af', f"volume=enable='{expr}':volume=0",
                '-c:a', 'aac', '-b:a', '256k', aroll], check=True)
print(len(plan['layers']), 'layers; pills', {k: round(v, 2) for k, v in pill_at.items()}, 'cta', cta_at and round(cta_at, 2), 'muted', [(round(a, 2), round(b, 2)) for a, b in mute])
