"""Vídeos superpuestos (clips de ejemplo, b-roll en tarjeta...) como fragmentos del montaje.

En edl.json un fragmento con "overlay": true usa como "clip" el vídeo superpuesto (dado de alta en sources.json) y
su in/out marcan qué trozo de ese vídeo se ve, así que en la línea de tiempo de Mi Estudio se recorta como cualquier
toma. "under" dice qué plano queda debajo mientras suena: {"clip": "c3", "in": 239.76, "zoom": 1.25, "cx": .52,
"cy": .44} (zoom/cx/cy opcionales: si faltan se usan los del fragmento anterior).

  PY overlay_edl.py <proyecto>

Un fragmento con "speed": 1.2 (u otro) va acelerado en el montaje sin cambiar el tono de la voz (rubberband); los
vídeos superpuestos van siempre a su velocidad. segments.json guarda el "speed" de cada fragmento.

1. Monta con video-studio (assemble.py) un edl "base" donde cada fragmento superpuesto se cambia por su plano
   "under" con la misma duración. edl.json vuelve a quedar como estaba (el de Mi Estudio).
2. Re-sincroniza el audio corte a corte (cada corte redondea la imagen a fotogramas enteros y el audio no: sin esto
   se acumulan cientos de ms de desfase).
3. Corta cada vídeo superpuesto a su trozo en assets/ov/<id>.mp4 (30 fps, sin audio) y assets/ov/<id>.wav, y
   escribe work/overlays.json: [{id, clip, in, out, at, dur, video, audio}] con "at" en segundos del montaje.
   Qué se hace con ellos (tarjeta, pantalla completa, audio o no) lo decide el plan del formato.
segments.json queda en el mismo orden que edl.json, fragmento a fragmento.
"""
import json
import os
import shutil
import subprocess
import sys

proj = sys.argv[1]
plat = json.load(open(os.path.join(os.environ.get('LOCALAPPDATA', ''), 'video-studio', '.platform.json'), encoding='utf-8'))
FF, PY, SK = plat['ffmpeg'], plat['python'], plat['skill_dir']
work = os.path.join(proj, 'work')
J = lambda p: json.load(open(p, encoding='utf-8'))
edl_p = os.path.join(proj, 'edl.json')
studio = J(edl_p)
sources = J(os.path.join(proj, 'sources.json'))

base, prev = [], {}
for s in studio:
    if s.get('overlay'):
        u = s.get('under') or {}
        if u.get('clip') not in sources:
            sys.exit('el fragmento %s no tiene plano "under" válido' % s.get('id'))
        b = dict(s)
        b.update(clip=u['clip'], **{'in': u['in'], 'out': round(u['in'] + s['out'] - s['in'], 3)})
        for k in ('zoom', 'cx', 'cy'):
            b[k] = u.get(k, prev.get(k, 1 if k == 'zoom' else .5))
        base.append(b)
    else:
        base.append(s)
        prev = s

os.makedirs(work, exist_ok=True)
shutil.copyfile(edl_p, os.path.join(work, 'edl_studio.json'))
for f in os.listdir(work):                          # restos de un montaje anterior con más fragmentos
    if f.startswith(('seg_', 'sync_')):
        os.remove(os.path.join(work, f))
try:
    json.dump(base, open(edl_p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    r = subprocess.run([PY, os.path.join(SK, 'scripts', 'assemble.py'), proj], capture_output=True, text=True, encoding='utf-8', errors='replace')
    print(r.stdout.strip().splitlines()[-1] if r.stdout.strip() else r.stderr[-500:])
    if r.returncode:
        sys.exit('assemble.py falló')
finally:
    shutil.copyfile(os.path.join(work, 'edl_studio.json'), edl_p)

# cada corte por separado: imagen con sus fotogramas exactos (acelerada si el fragmento lleva "speed", con el tono
# de voz intacto), audio recortado a esa misma duración (sin esto se acumulan cientos de ms de desfase) y, si el clip
# trae la voz en un solo canal (micro de solapa a un lado), copiada a los dos para que no suene solo por un oído
segs = J(os.path.join(proj, 'segments.json'))
import numpy as np
PAN = {}


def pan(clip):
    if clip not in PAN:
        pcm = subprocess.run([FF, '-loglevel', 'error', '-t', '60', '-i', sources[clip], '-vn', '-ac', '2', '-ar', '16000',
                              '-f', 's16le', '-'], capture_output=True).stdout
        x = np.frombuffer(pcm, np.int16).astype(np.float32).reshape(-1, 2)
        l, r = (20 * np.log10(np.sqrt(np.mean(x[:, c] ** 2)) + 1e-9) for c in (0, 1))
        PAN[clip] = 'pan=stereo|c0=c1|c1=c1' if l < r - 25 else 'pan=stereo|c0=c0|c1=c0' if r < l - 25 else None
    return PAN[clip]


vparts, aparts, frame = [], [], 0
for k, (s, b, g) in enumerate(zip(studio, base, segs)):
    sp = 1.0 if s.get('overlay') else float(s.get('speed') or 1)
    n = max(1, round(g['frames'] / sp))
    src, vout, aout = os.path.join(work, f'seg_{k}.mp4'), os.path.join(work, f'sync_{k}.mp4'), os.path.join(work, f'sync_{k}.wav')
    subprocess.run([FF, '-loglevel', 'error', '-y', '-i', src, '-an', '-vf', (f'setpts=PTS/{sp},' if sp != 1 else '') + 'fps=30,tpad=stop_mode=clone:stop_duration=0.2',   # a clone at the end if rounding falls short
                    '-frames:v', str(n), '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-pix_fmt', 'yuv420p', vout], check=True)
    af = [x for x in (pan(b['clip']), f'rubberband=tempo={sp}' if sp != 1 else None, f'apad,atrim=0:{n / 30:.6f}') if x]
    subprocess.run([FF, '-loglevel', 'error', '-y', '-i', src, '-vn', '-af', ','.join(af), '-c:a', 'pcm_s16le', '-ar', '48000',
                    '-ac', '2', aout], check=True)
    vparts.append(vout); aparts.append(aout)
    g.update(frame=frame, frames=n, speed=sp)
    frame += n
json.dump(segs, open(os.path.join(proj, 'segments.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
vlist, alist = os.path.join(work, 'concat_sync.txt'), os.path.join(work, 'concat_wav.txt')
open(vlist, 'w', encoding='utf-8', newline='\n').write(''.join(f"file '{os.path.basename(p)}'\n" for p in vparts))
open(alist, 'w', encoding='utf-8', newline='\n').write(''.join(f"file '{os.path.basename(p)}'\n" for p in aparts))
aroll = os.path.join(proj, 'assets', 'aroll.mp4')
atmp, vtmp = os.path.join(work, 'aroll_a.wav'), os.path.join(work, 'aroll_v.mp4')
subprocess.run([FF, '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', vlist, '-an', '-vf', 'setpts=N/30/TB',
                '-r', '30', '-fps_mode', 'cfr', '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-g', '30',
                '-pix_fmt', 'yuv420p', vtmp], check=True)
subprocess.run([FF, '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', alist, '-c:a', 'pcm_s16le', atmp], check=True)
subprocess.run([FF, '-loglevel', 'error', '-y', '-i', vtmp, '-i', atmp, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                '-c:a', 'aac', '-b:a', '256k', '-shortest', aroll], check=True)

# los trozos de los vídeos superpuestos
ovdir = os.path.join(proj, 'assets', 'ov')
os.makedirs(ovdir, exist_ok=True)
overlays = []
for s, g in zip(studio, segs):
    if not s.get('overlay'):
        continue
    d = g['frames'] / 30
    v, a = os.path.join(ovdir, f"{s['id']}.mp4"), os.path.join(ovdir, f"{s['id']}.wav")
    src = sources[s['clip']]
    subprocess.run([FF, '-loglevel', 'error', '-y', '-ss', str(s['in']), '-i', src, '-t', f'{d:.3f}', '-an', '-vf', 'fps=30',
                    '-c:v', 'libx264', '-crf', '16', '-pix_fmt', 'yuv420p', v], check=True)
    subprocess.run([FF, '-loglevel', 'error', '-y', '-ss', str(s['in']), '-i', src, '-t', f'{d:.3f}', '-vn',
                    '-af', f'afade=t=in:d=0.03,afade=t=out:st={max(0, d - .08):.3f}:d=0.08', '-ar', '48000', '-ac', '2', a], check=True)
    overlays.append({'id': s['id'], 'clip': s['clip'], 'in': s['in'], 'out': s['out'], 'at': round(g['frame'] / 30, 3),
                     'dur': round(d, 3), 'video': f"assets/ov/{s['id']}.mp4", 'audio': f"assets/ov/{s['id']}.wav"})
json.dump(overlays, open(os.path.join(work, 'overlays.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(f'{len(segs)} fragmentos, {len(overlays)} superpuestos; audio re-sincronizado, {frame} fotogramas ({frame / 30:.2f} s)')
