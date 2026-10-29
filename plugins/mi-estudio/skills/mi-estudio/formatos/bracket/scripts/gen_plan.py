"""Write plan.json in the Ultracinico style for The Office bracket: title at the top (H2 + H1 over the black gradient),
16 big sticker heads in a bracket from under the chin to the bottom of the frame (laid out like the user's second
reference: first round on the edges, quarter-finals one column in, semi-finals and the finalist sharing the inner
column), captions in one line under the chin.

Each duel: when the question starts, both heads grow and glow yellow; at the pick (timeline.json "elementos", the
moment the user set in Mi Estudio) the loser fades, the winner's path turns yellow and a copy of the winner pops into
the next slot with a soft pop. In the final the winning finalist stays big and glowing, with a low hit.

  PY gen_plan.py <project>
"""
import json
import os
import sys

proj = sys.argv[1]
segs = json.load(open(os.path.join(proj, 'segments.json'), encoding='utf-8'))
edl = json.load(open(os.path.join(proj, 'edl.json'), encoding='utf-8'))
els = {e['id']: e for e in json.load(open(os.path.join(proj, 'timeline.json'), encoding='utf-8'))['elementos']}

SEEDS = ['dwight', 'robert', 'stanley', 'meredith', 'andy', 'phyllis', 'jim', 'kelly',
         'pam', 'toby', 'kevin', 'angela', 'michael', 'ryan', 'creed', 'oscar']
# match -> (round, index in round, winner); the segment where its question starts when it is not the pick's own
MATCHES = {'m1': ('r1', 0, 'dwight'), 'm2': ('r1', 1, 'meredith'), 'm3': ('r1', 2, 'andy'), 'm4': ('r1', 3, 'kelly'),
           'm5': ('r1', 4, 'pam'), 'm6': ('r1', 5, 'angela'), 'm7': ('r1', 6, 'michael'), 'm8': ('r1', 7, 'creed'),
           'q1': ('qf', 0, 'dwight'), 'q2': ('qf', 1, 'andy'), 'q3': ('qf', 2, 'angela'), 'q4': ('qf', 3, 'michael'),
           's1': ('sf', 0, 'andy'), 's2': ('sf', 1, 'michael'), 'f': ('f', 0, 'andy')}
ASKED_IN = {'m7': 'siete', 's1': 'semic', 'f': 'finala'}
NEXT = {'r1': 'qf', 'qf': 'sf', 'sf': 'f'}

# geometry (1080x1920): heads F px, from under the captions (y 870) to the bottom edge like the reference, which
# leaves the safe zone at the bottom on purpose (bigger heads)
F, Y0, Y1 = 124, 870, 1895
COLX = {'r1': 85, 'qf': 330, 'sf': 445, 'f': 445}
pitch = (Y1 - Y0 - F) / 7
r1y = [Y0 + F / 2 + i * pitch for i in range(8)]
H = F / 2


def slot_xy(rnd, i):
    """Centre of slot i of a round (slots run down the left side, then down the right side)."""
    per_side = {'r1': 8, 'qf': 4, 'sf': 2, 'f': 1}[rnd]
    side, k = divmod(i, per_side)
    span = 8 // per_side
    y = sum(r1y[k * span:(k + 1) * span]) / span
    x = COLX[rnd] if side == 0 else 1080 - COLX[rnd]
    return x, y


who = {('r1', i): k for i, k in enumerate(SEEDS)}
for m, (rnd, i, win) in sorted(MATCHES.items(), key=lambda kv: ['r1', 'qf', 'sf', 'f'].index(kv[1][0])):
    if rnd in NEXT:
        who[(NEXT[rnd], i)] = win

# times: reel seconds of each segment, the pick from Mi Estudio's elementos
by_id = {s['id']: s for s in segs}
tl_start, acc = {}, 0.0
for e in edl:
    tl_start[e['id']] = acc
    acc += e['out'] - e['in']
t0 = lambda sid: by_id[sid]['frame'] / 30
end = (segs[-1]['frame'] + segs[-1]['frames']) / 30

html, motion, sounds = [], [], []
LINE = 10


def line(name, x0, y0, x1, y1):
    """A bracket line from (x0, y0) to (x1, y1), horizontal or vertical."""
    l, t = min(x0, x1) - LINE / 2, min(y0, y1) - LINE / 2
    w, h = abs(x1 - x0) + LINE, abs(y1 - y0) + LINE
    html.append(f"<div class='bl' id='{name}' style='left:{l:.1f}px;top:{t:.1f}px;width:{w:.1f}px;height:{h:.1f}px'></div>")


def face(rnd, i):
    x, y = slot_xy(rnd, i)
    cls = 'fc' + ('' if rnd == 'r1' else ' later')
    html.append(f"<div class='{cls}' id='s-{rnd}-{i}' style='left:{x - H:.1f}px;top:{y - H:.1f}px;"
                f"width:{F}px;height:{F}px'><img src='assets/faces/{who[(rnd, i)]}.png'></div>")


# lines, drawn under the heads. Each match: the winner's part ("a" or "b" side) turns yellow at the pick
for m, (rnd, i, win) in MATCHES.items():
    a, b = 2 * i, 2 * i + 1
    (xa, ya), (xb, yb) = slot_xy(rnd, a), slot_xy(rnd, b)
    if rnd == 'f':                       # the two finalists face each other across the middle
        line(f'l-{m}-a', xa + H, ya, 540, ya)
        line(f'l-{m}-b', 540, yb, xb - H, yb)
        continue
    xn, yn = slot_xy(NEXT[rnd], i)
    sgn = 1 if xa < 540 else -1
    if rnd == 'r1':                      # out of each head sideways, join, into the quarter-final head
        xj = (xa + sgn * H + xn - sgn * H) / 2
        line(f'l-{m}-a', xa + sgn * H, ya, xj, ya)
        line(f'l-{m}-b', xb + sgn * H, yb, xj, yb)
        line(f'l-{m}-va', xj, ya, xj, yn)
        line(f'l-{m}-vb', xj, yn, xj, yb)
        line(f'l-{m}-n', xj, yn, xn - sgn * H, yn)
    elif rnd == 'qf':                    # down from one head, up from the other, across into the semi-final head
        line(f'l-{m}-va', xa, ya + H, xa, yn)
        line(f'l-{m}-vb', xa, yn, xa, yb - H)
        line(f'l-{m}-n', xa, yn, xn - sgn * H, yn)
    else:                                # semi-finals: the finalist sits on the line between them
        line(f'l-{m}-va', xa, ya + H, xa, yn - H)
        line(f'l-{m}-vb', xa, yn + H, xa, yb - H)

for i in range(16):
    face('r1', i)
for rnd, n in (('qf', 8), ('sf', 4), ('f', 2)):
    for i in range(n):
        face(rnd, i)

GLOW = 'drop-shadow(0px 0px 16px rgba(255,242,56,0.95))'
NOGLOW = 'drop-shadow(0px 0px 0px rgba(255,242,56,0))'
YEL = {'backgroundColor': '#FFF238', 'boxShadow': '0px 0px 12px rgba(255,242,56,0.9)', 'duration': 0.2}
for e in edl:
    m = e.get('match')
    if not m:
        continue
    rnd, i, win = MATCHES[m]
    a, b = 2 * i, 2 * i + 1
    ask = round(t0(ASKED_IN.get(m, e['id'])), 3)
    pick = round(t0(e['id']) + max(0.0, els[e['id']]['from'] - tl_start[e['id']]), 3)
    wi, lo = (a, b) if who[(rnd, a)] == win else (b, a)
    for s in (a, b):
        motion.append({'target': f'#s-{rnd}-{s}', 'tween': 'to', 'at': ask,
                       'vars': {'scale': 1.1, 'filter': GLOW, 'duration': 0.2, 'ease': 'power2.out'}})
    if rnd == 'f':                       # the champion stays big and lit
        motion.append({'target': f'#s-{rnd}-{wi}', 'tween': 'to', 'at': pick,
                       'vars': {'scale': 1.3, 'duration': 0.45, 'ease': 'back.out(2.2)'}})
        sounds.append({'src': 'assets/sfx/impact-bass-1.mp3', 'at': pick, 'vol': 0.12})
    else:
        motion.append({'target': f'#s-{rnd}-{wi}', 'tween': 'to', 'at': pick,
                       'vars': {'scale': 1, 'filter': NOGLOW, 'duration': 0.2}})
    motion.append({'target': f'#s-{rnd}-{lo}', 'tween': 'to', 'at': pick,
                   'vars': {'scale': 0.92, 'opacity': 0.35, 'filter': NOGLOW, 'duration': 0.25}})
    side = 'a' if wi == a else 'b'
    path = {'r1': [f'l-{m}-{side}', f'l-{m}-v{side}', f'l-{m}-n'], 'qf': [f'l-{m}-v{side}', f'l-{m}-n'],
            'sf': [f'l-{m}-v{side}'], 'f': [f'l-{m}-{side}']}[rnd]
    for p in path:
        motion.append({'target': '#' + p, 'tween': 'to', 'at': pick, 'vars': YEL})
    if rnd in NEXT:
        motion.append({'target': f'#s-{NEXT[rnd]}-{i}', 'tween': 'fromTo', 'at': pick, 'from': {'scale': 0, 'opacity': 0},
                       'vars': {'scale': 1, 'opacity': 1, 'duration': 0.3, 'ease': 'back.out(2.5)'}})
        sounds.append({'src': 'assets/sfx/pop.mp3', 'at': pick, 'vol': 0.35})

layers = [
    {'id': 'title', 'anchor': 'full',
     'html': "<div class='cine-grad'></div>"
             "<div class='cine-h2 kick'>¿quién es el mejor personaje de</div>"
             "<div class='cine-title tt'><span class='ln'>THE OFFICE?</span></div>"},
    {'id': 'bracket', 'anchor': 'full', 'html': '<div id="br">' + ''.join(html) + '</div>', 'motion': motion},
]

css = """
.cine-h2.kick{top:232px;font-size:56px}
.cine-title.tt{top:292px}
#br{position:absolute;left:0;top:0;width:1080px;height:1920px}
#br .bl{position:absolute;background:#fff;border-radius:3px;box-shadow:0px 0px 8px rgba(0,0,0,0.5)}
#br .fc{position:absolute;filter:%(noglow)s}
#br .fc img{width:100%%;height:100%%;display:block;filter:drop-shadow(0 4px 8px rgba(0,0,0,.55))}
#br .fc.later{opacity:0}
""" % {'noglow': NOGLOW}

# captions: the style's own (DM Serif, yellow, answer in italic), one line in the band under the chin
if not os.path.isfile(os.path.join(os.environ["LOCALAPPDATA"], "video-studio", "styles", "ultracinico", "style.json")):
    sys.exit("Este script de ejemplo usa el estilo guardado Ultracinico, que no tienes: cópialo al proyecto y cambia el estilo.")
mine = json.load(open(os.path.join(os.environ['LOCALAPPDATA'], 'video-studio', 'styles', 'ultracinico', 'style.json'),
                      encoding='utf-8'))
cap = dict(mine['caption'], position=820, lines=1, words=6, chars=40)

plan = {'title': ['', ''], 'swash': ['', ''], 'style': {}, 'slots': [], 'myStyle': 'ultracinico', 'caption': cap,
        'layers': layers, 'sounds': sounds, 'css': css}
json.dump(plan, open(os.path.join(proj, 'plan.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('plan.json:', len(html), 'bracket parts,', len(motion), 'motion entries,', len(sounds), 'sounds, reel %.2f s' % end)
