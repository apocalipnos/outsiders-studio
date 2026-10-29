"""Write plan.json for the split-screen reel: film backdrop on top (0-900), speaker in the bottom panel (the base video
is already laid out by ffmpeg), subgenre + film at the seam, a collage of every film under the CTA, a soft click on
every picture change. Images and their focus come from work/tmdb/chosen.json (TMDB backdrops).

  python gen_plan.py <project>
"""
import html
import json
import os
import sys

P = sys.argv[1]
segs = json.load(open(os.path.join(P, 'segments.json'), encoding='utf-8'))
edl = {e['id']: e for e in json.load(open(os.path.join(P, 'edl.json'), encoding='utf-8'))}
chosen = json.load(open(os.path.join(P, 'work', 'tmdb', 'chosen.json'), encoding='utf-8'))
plan = json.load(open(os.path.join(P, 'plan.json'), encoding='utf-8'))

IMG_H = 900
CTA = ['Y si queréis aprender', 'más de cine, síguenos']
SHADOW = '0 3px 12px rgba(0,0,0,.8), 0 0 3px rgba(0,0,0,.7)'
T = lambda f: round(f / 30, 3)

css = f"""
@font-face{{font-family:'Montserrat';font-weight:800;font-style:normal;font-display:block;src:url('assets/fonts/Montserrat-800-normal.woff2')}}
@font-face{{font-family:'Montserrat';font-weight:600;font-style:normal;font-display:block;src:url('assets/fonts/Montserrat-600-normal.woff2')}}
.fi{{position:absolute;left:0;top:0;width:1080px;height:{IMG_H}px;object-fit:cover;display:block}}
.grad{{position:absolute;left:0;top:{IMG_H - 260}px;width:1080px;height:260px;
  background:linear-gradient(to bottom,rgba(0,0,0,0),rgba(0,0,0,.6))}}
.lb{{position:absolute;left:35px;width:1010px;top:{IMG_H - 92}px;text-align:center;color:#fff;transform:translateY(-50%)}}
.lb .s{{font-family:'Montserrat';font-weight:800;text-transform:uppercase;letter-spacing:.01em;line-height:1.02;
  white-space:nowrap;text-shadow:{SHADOW}}}
.lb .f{{font-family:'Montserrat';font-weight:600;font-size:30px;line-height:1.2;margin-top:8px;color:rgba(255,255,255,.93);
  text-shadow:{SHADOW}}}
.cg{{position:absolute;left:0;top:0;width:1080px;height:{IMG_H}px;display:grid;grid-template-columns:repeat(6,180px);
  grid-template-rows:repeat(5,180px)}}
.cg img{{width:180px;height:180px;object-fit:cover;display:block}}
"""

layers, sounds = [], []
films = [s for s in segs if s['id'] != 'cta']
cta = next(s for s in segs if s['id'] == 'cta')
end_of = lambda k: T(segs[k + 1]['frame']) if k + 1 < len(segs) else T(segs[k]['frame'] + segs[k]['frames'])

for k, s in enumerate(films):
    c = chosen[s['id']]
    t0, t1 = T(s['frame']), end_of(k)
    layers.append({'id': f"img-{s['id']}", 'anchor': 'full', 'from': t0, 'to': t1,
                   'html': f"<img class='fi' src='{c['file']}' style='object-position:{c['x']}% 50%'>"})
    if k:
        sounds.append({'src': 'assets/sfx/click-soft.mp3', 'at': t0, 'vol': 0.12})

# the collage under the CTA: all 30 films, popping in one after another
cells = ''.join(f"<img src='{chosen[s['id']]['file']}' style='object-position:{chosen[s['id']]['x']}% 50%'>" for s in films)
layers.append({'id': 'collage', 'anchor': 'full', 'from': T(cta['frame']),
               'html': f"<div class='cg'>{cells}</div>",
               'motion': [{'target': 'img', 'tween': 'from', 'at': 0,
                           'vars': {'opacity': 0, 'scale': 0.6, 'duration': 0.22, 'ease': 'back.out(1.6)', 'stagger': 0.025}}]})
sounds.append({'src': 'assets/sfx/whoosh-short.mp3', 'at': T(cta['frame']), 'vol': 0.15})

layers.append({'id': 'grad', 'anchor': 'full', 'html': "<div class='grad'></div>"})

for k, s in enumerate(films):
    sub = edl[s['id']]['line']
    film = edl[s['id']]['film']
    size = min(64, round(1000 / (len(sub) * 0.74)))
    layers.append({'id': f"lb-{s['id']}", 'anchor': 'full', 'from': T(s['frame']), 'to': end_of(k),
                   'html': f"<div class='lb'><div class='s' style='font-size:{size}px'>{html.escape(sub)}</div>"
                           f"<div class='f'>{html.escape(film)}</div></div>"})
layers.append({'id': 'lb-cta', 'anchor': 'full', 'from': T(cta['frame']),
               'html': "<div class='lb'>" + ''.join(f"<div class='s' style='font-size:54px'>{html.escape(l)}</div>" for l in CTA)
                       + "</div>"})

plan.update({'title': ['', ''], 'swash': ['', ''], 'layers': layers, 'sounds': sounds, 'css': css})
plan.pop('caption', None)
json.dump(plan, open(os.path.join(P, 'plan.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(len(layers), 'layers,', len(sounds), 'sounds')
