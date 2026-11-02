#!/usr/bin/env python3
"""La ficha de una referencia: lo medible lo saca de study.json (study.py de video-studio) y de los fotogramas, sin gastar tokens;
lo que hay que mirar (tipografía, subtítulos, estructura, lo que no se puede igualar) lo rellena Claude en "notas" y "no_igualable".

    PY ficha.py "<vídeo>" --estudio "<carpeta de study.py>" --out "<ficha.json>"      # antes de cortar
    PY mi_estudio.py --preparar --ficha "<ficha.json>" --until-saved                  # el usuario la revisa (ficha=ok|corregida)
    PY ficha.py --a-proyecto "<ficha.json>" "<proyecto>"                              # copia el vídeo a ref/ y escribe edicion/referencia.json
"""
import json
import os
import shutil
import subprocess
import sys

sys.dont_write_bytecode = True
PLATFORM = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~/AppData/Local')), 'video-studio', '.platform.json')


def colores(video, ffmpeg, n=5):
    """Los colores más presentes: un fotograma por segundo muy pequeño, cada canal reducido a 4 bits."""
    raw = subprocess.run([ffmpeg, '-v', 'error', '-i', video, '-vf', 'fps=1,scale=48:85', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True).stdout
    cuenta = {}
    for i in range(0, len(raw) - 2, 3):
        k = (raw[i] >> 4, raw[i + 1] >> 4, raw[i + 2] >> 4)
        cuenta[k] = cuenta.get(k, 0) + 1
    out = []
    for k, _ in sorted(cuenta.items(), key=lambda x: -x[1]):
        if all(sum(abs(a - b) for a, b in zip(k, o)) > 4 for o in out):
            out.append(k)
        if len(out) == n:
            break
    return ['#%02x%02x%02x' % tuple(c * 17 for c in k) for k in out]


def ficha(video, estudio):
    with open(PLATFORM, encoding='utf-8') as f:
        plat = json.load(f)
    with open(os.path.join(estudio, 'study.json'), encoding='utf-8') as f:
        st = json.load(f)
    # El ritmo de cortes no se mide: los saltos de una persona hablando no se detectan (probado con un montaje conocido: 6 de 14 cortes y
    # más de 40 falsos) y en vídeos mixtos solo se contarían los cortes claros. Claude lo describe en notas.ritmo.
    habla = bool(st.get('words'))
    return {
        'video_abs': os.path.abspath(video), 'nombre': os.path.basename(video),
        'metricas': {
            'duracion': st.get('duration') or 0, 'palabras_seg': st.get('words_per_second') if habla else None,
            'voz': st.get('speech_share') if habla else None, 'pausas': st.get('pauses_over_0.35s') if habla else None, 'sonido': st.get('sound'),
        },
        'colores': colores(video, plat.get('ffmpeg') or 'ffmpeg'),
        'notas': {'tipografia': '', 'subtitulos': '', 'elementos': '', 'estructura': '', 'ritmo': ''},
        'no_igualable': [], 'correccion': '',
    }


def a_proyecto(path, proj):
    with open(path, encoding='utf-8') as f:
        fi = json.load(f)
    os.makedirs(os.path.join(proj, 'ref'), exist_ok=True)
    os.makedirs(os.path.join(proj, 'edicion'), exist_ok=True)
    dest = os.path.join(proj, 'ref', os.path.basename(fi['video_abs']))
    if os.path.abspath(dest) != fi['video_abs']:
        shutil.copyfile(fi['video_abs'], dest)
    fi['video'] = 'ref/' + os.path.basename(dest)
    fi['video_abs'] = os.path.abspath(dest)
    with open(os.path.join(proj, 'edicion', 'referencia.json'), 'w', encoding='utf-8') as f:
        json.dump(fi, f, ensure_ascii=False, indent=1)
    return fi['video']


def main():
    a = sys.argv[1:]
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    if a[:1] == ['--a-proyecto'] and len(a) == 3:
        print('referencia en', a_proyecto(a[1], a[2]))
        return 0
    if len(a) == 5 and a[1] == '--estudio' and a[3] == '--out':
        fi = ficha(a[0], a[2])
        with open(a[4], 'w', encoding='utf-8') as f:
            json.dump(fi, f, ensure_ascii=False, indent=1)
        print(json.dumps(fi['metricas'], ensure_ascii=False))
        print('colores', ' '.join(fi['colores']))
        return 0
    sys.exit(__doc__)


if __name__ == '__main__':
    sys.exit(main())
