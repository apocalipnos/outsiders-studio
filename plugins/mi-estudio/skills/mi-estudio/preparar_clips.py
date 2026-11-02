#!/usr/bin/env python3
"""Deja listos los clips de un vídeo en segundo plano, en cuanto el usuario dice "edítalo" y mientras elige en Mi Estudio.

    PY preparar_clips.py "<proyecto>" "<clip o carpeta>" ... [--no-girar]

- Escribe sources.json (c1, c2... del más antiguo al más nuevo).
- Girar: los clips apaisados de la cámara van a work/upright/cN.mp4 en vertical, sin pista de timecode. Hay dos tipos: con la orientación en sus metadatos
  (móvil en vertical: se respeta) y sin ella (cámara con la persona de lado: 90 grados a la izquierda). Lee el 4K con la tarjeta, escala antes de girar y
  comprime igual que siempre (crf 16, preset fast). Si la tarjeta no puede, lo hace el procesador. --no-girar: un vídeo apaisado que debe quedarse así.
- Transcribir: work/cN.wav, work/islands_cN.txt con transcribir.py (empieza a la vez que el giro, no después) y work/tomas.txt con tomas.py.
- Copias ligeras, miniaturas y onda de Mi Estudio, para que se abra sin esperar.
Última línea: STATUS clips READY <proyecto> <clips> giro=<s> transcribir=<s> copias=<s> total=<s>, o STATUS clips ERROR <motivo>.
"""
import json
import os
import subprocess
import sys
import threading
import time

sys.dont_write_bytecode = True
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import transcribir  # noqa: E402

PLAT = json.load(open(os.path.join(transcribir.ESTADO, '.platform.json'), encoding='utf-8'))
FF, FP = PLAT['ffmpeg'], PLAT.get('ffprobe') or 'ffprobe'
EXT = ('.mp4', '.mov', '.m4v', '.webm', '.mkv')


def medida(f):
    """(ancho, alto, giro de los metadatos) tal como está guardado, antes de aplicar el giro."""
    r = subprocess.run([FP, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation', '-of', 'json', f], capture_output=True, text=True)
    st = json.loads(r.stdout)['streams'][0]
    rot = next((int(d['rotation']) for d in st.get('side_data_list', []) if 'rotation' in d), 0)
    return st['width'], st['height'], rot


def filtro(w, h, rot):
    """Lo que hay que hacerle para que quede en 1080x1920, o None si ya es vertical de verdad."""
    if abs(rot) == 90:              # -90: girar a la derecha; 90: a la izquierda
        giro = 'transpose=1' if rot < 0 else 'transpose=2'
    elif abs(rot) == 180:
        return 'hflip,vflip,scale=1080:1920,fps=30' if h > w else None
    elif w > h:                     # cámara sin metadatos, con la persona de lado (cabeza a la derecha)
        giro = 'transpose=2'
    else:
        return None
    if abs(w * 9 - h * 16) <= 16:   # 16:9: escalar antes de girar es mucho más barato
        return 'scale=1920:1080,%s,fps=30' % giro
    return '%s,scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,fps=30' % giro


def girar(src, dest, vf):
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest[:-4] + '.part.mp4'
    salida = ['-map', '0:v:0', '-map', '0:a:0?', '-vf', vf, '-c:v', 'libx264', '-crf', '16', '-preset', 'fast',
              '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-write_tmcd', '0', '-movflags', '+faststart', tmp]
    # el giro va en el filtro: sin esto ffmpeg lo aplicaría también, y lo dejaría anotado en el archivo para que se volviera a aplicar al leerlo
    r = subprocess.run([FF, '-v', 'error', '-y', '-display_rotation', '0', '-noautorotate', '-hwaccel', 'cuda', '-i', src] + salida, capture_output=True, text=True, errors='replace')
    if r.returncode != 0:          # sin tarjeta o sin su decodificador: igual con el procesador
        print('girar: con el procesador (%s)' % r.stderr.strip()[-120:], flush=True)
        subprocess.run([FF, '-v', 'error', '-y', '-display_rotation', '0', '-noautorotate', '-i', src] + salida, check=True)
    os.replace(tmp, dest)


def main():
    a = sys.argv[1:]
    no_girar = '--no-girar' in a
    a = [x for x in a if x != '--no-girar']
    if len(a) < 2:
        sys.exit(__doc__)
    proj, clips = os.path.abspath(a[0]), []
    for p in a[1:]:
        clips += [os.path.join(p, f) for f in os.listdir(p) if f.lower().endswith(EXT)] if os.path.isdir(p) else [p]
    clips.sort(key=os.path.getmtime)
    if not clips:
        sys.exit('No hay clips.')
    os.makedirs(os.path.join(proj, 'work'), exist_ok=True)
    t0, tiempos, fallos, fuentes = time.time(), {}, [], {}
    plan = []
    for i, f in enumerate(clips, 1):
        cid = 'c%d' % i
        vf = None if no_girar else filtro(*medida(f))
        dest = os.path.join(proj, 'work', 'upright', cid + '.mp4') if vf else os.path.abspath(f)
        fuentes[cid] = dest.replace('\\', '/')
        plan.append((cid, f, dest, vf))
    with open(os.path.join(proj, 'sources.json'), 'w', encoding='utf-8') as out:
        json.dump(fuentes, out, ensure_ascii=False, indent=1)

    def imagen():
        t = time.time()
        for cid, f, dest, vf in plan:
            if vf:
                girar(f, dest, vf)
                print(cid, 'girado', vf, flush=True)
        tiempos['giro'] = time.time() - t
        t = time.time()
        import mi_estudio as m             # lo mismo que hará al abrirse, para que ya esté hecho
        m.PROJECT = proj
        for cid, _f, dest, _r in plan:
            m.SOURCES[cid] = os.path.normpath(dest)
            m.PREVIEWS[cid] = threading.Event()
            m.make_preview(cid); m.strip(cid); m.peaks(cid)
        tiempos['copias'] = time.time() - t

    def voz():
        t = time.time()
        for cid, f, _d, _r in plan:
            subprocess.run([FF, '-loglevel', 'error', '-y', '-i', f, '-vn', '-ac', '1', '-ar', '16000', os.path.join(proj, 'work', cid + '.wav')], check=True)
        transcribir.islas(proj, [p[0] for p in plan])
        import tomas                       # la lista de la que Claude elige las tomas
        with open(os.path.join(proj, 'work', 'tomas.txt'), 'w', encoding='utf-8') as out:
            out.write('\n'.join(tomas.lista(tomas.islas(proj))) + '\n')
        tiempos['transcribir'] = time.time() - t

    def seguro(fn):
        def run():
            try:
                fn()
            except Exception as e:      # noqa: BLE001 - se dice en la última línea, para que Claude lo vea
                fallos.append('%s: %s' % (fn.__name__, e))
        return run
    hilos = [threading.Thread(target=seguro(fn)) for fn in (imagen, voz)]
    for h in hilos:
        h.start()
    for h in hilos:
        h.join()
    if fallos:
        print('STATUS clips ERROR %s' % ' | '.join(fallos)[:600], flush=True)
        return 1
    print('STATUS clips READY %s %s giro=%.0f transcribir=%.0f copias=%.0f total=%.0f' % (proj, ','.join(fuentes), tiempos['giro'], tiempos['transcribir'], tiempos['copias'], time.time() - t0), flush=True)
    return 0


if __name__ == '__main__':
    sys.exit(main())
