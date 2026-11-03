"""Vídeo en HDR: con cualquier medio en HLG o PQ, HyperFrames entra en su modo HDR, que tarda mucho más, pierde todas las capas de
texto sin dar ningún error y lava los colores (con --sdr vuelven los textos, pero el color sigue lavado, también en el stock normal).
Por eso lo que llega en HLG (color_transfer arib-std-b67, lo que graban sus móviles) se pasa a vídeo normal, bt709: preparar_clips.py
al girar, overlay_edl.py al montar, y aquí antes de cada render lo que se haya colado en index.html (un medio importado, un proyecto viejo).

    PY hdr.py "<proyecto>"     pasa a vídeo normal lo que usa index.html y escribe lo que sigue en HDR

El original de lo que se convierte aquí se queda en work/hlg/.
"""
import json
import os
import re
import subprocess
import sys
import urllib.parse

sys.dont_write_bytecode = True
PLAT = json.load(open(os.path.join(os.environ.get('LOCALAPPDATA', ''), 'video-studio', '.platform.json'), encoding='utf-8'))
FF, FP = PLAT['ffmpeg'], PLAT.get('ffprobe') or 'ffprobe'
HLG, PQ = 'arib-std-b67', 'smpte2084'
# npl=400 + clip es lo que más se parece a cómo el navegador enseña el HLG (medido contra una instantánea), pero así se ve más saturado
# que los clips originales: la saturación se eligió a ojo entre cuatro opciones. Coincidir con el navegador no basta
SDR = ('zscale=tin=arib-std-b67:min=bt2020nc:pin=bt2020:rin=tv:t=linear:npl=400,format=gbrpf32le,zscale=p=bt709,'
       'tonemap=tonemap=clip:desat=0,zscale=t=bt709:m=bt709:r=tv,format=yuv420p,eq=saturation=0.845')
COLOR = ['-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709']
AUDIO = ('.mp3', '.wav', '.m4a', '.aac', '.ogg')
CONVERTIBLES = ('.mp4', '.m4v', '.mov')


def sondear(path):
    """(color_transfer, pix_fmt) de la imagen del archivo; cadenas vacías si no tiene."""
    r = subprocess.run([FP, '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=color_transfer,pix_fmt', '-of', 'json', path],
                       capture_output=True, text=True, encoding='utf-8', errors='replace')
    try:
        st = json.loads(r.stdout)['streams'][0]
    except (ValueError, KeyError, IndexError):
        return '', ''
    return st.get('color_transfer') or '', st.get('pix_fmt') or ''


def es_hlg(path):
    return sondear(path)[0] == HLG


def medios(proj):
    """Los archivos del proyecto que index.html usa con src, sin los de audio: lo que HyperFrames mira para decidir su modo."""
    index = os.path.join(proj, 'index.html')
    if not os.path.isfile(index):
        return []
    with open(index, encoding='utf-8', errors='ignore') as f:
        rutas = [urllib.parse.unquote(r) for r in re.findall(r"""\bsrc=["']([^"'#?]+)""", f.read())]
    return [r for r in dict.fromkeys(rutas) if not re.match(r'[a-z]+:', r, re.I) and not r.lower().endswith(AUDIO) and os.path.isfile(os.path.join(proj, r))]


def en_hdr(proj):
    """[(ruta, color_transfer, se puede convertir)] de los medios de index.html que harían entrar a HyperFrames en su modo HDR."""
    out = []
    for rel in medios(proj):
        trc, fmt = sondear(os.path.join(proj, rel))
        if trc in (HLG, PQ):        # con transparencia no: pasarlo a yuv420p se la quitaría
            out.append((rel, trc, trc == HLG and rel.lower().endswith(CONVERTIBLES) and not fmt.startswith(('yuva', 'gbra'))))
    return out


def aviso(rel):
    return '%s sigue en HDR: saldrá con los textos bien, pero con el color lavado. Pídele a Claude que lo cambie por una versión normal.' % rel


def convertir(proj, rel, cada=None):
    """Un medio en HLG a vídeo normal, en su sitio. cada(proceso): para poder pararlo. True si salió bien."""
    full = os.path.join(proj, rel)
    guarda = os.path.join(proj, 'work', 'hlg', rel.replace('/', '_').replace('\\', '_'))
    tmp = full + '.tmp' + os.path.splitext(full)[1]
    os.makedirs(os.path.dirname(guarda), exist_ok=True)
    p = subprocess.Popen([FF, '-loglevel', 'error', '-y', '-i', full, '-map', '0:v:0', '-map', '0:a?', '-vf', SDR, '-c:v', 'libx264', '-crf', '15',
                          '-preset', 'medium', '-g', '15'] + COLOR + ['-c:a', 'copy', tmp])
    if cada:
        cada(p)
    if p.wait() != 0:
        if os.path.isfile(tmp):
            os.remove(tmp)
        return False
    os.replace(full, guarda)
    os.replace(tmp, full)
    return True


def arreglar(proj, cada=None, log=print):
    """Justo antes de renderizar: deja en vídeo normal lo que se pueda de index.html. Devuelve los avisos de lo que sigue en HDR."""
    avisos = []
    for rel, _trc, puede in en_hdr(proj):
        if puede:
            log('Pasando a color normal: %s' % rel)
            if convertir(proj, rel, cada):
                continue
        avisos.append(aviso(rel))
    return avisos


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    print('\n'.join(arreglar(sys.argv[1])) or 'Ningún medio en HDR.')
