#!/usr/bin/env python3
"""Transcribir en español con Whisper medium: en la tarjeta gráfica si se puede y, si no, en el procesador. Mismo modelo y mismo resultado.
Las librerías de NVIDIA están en %LOCALAPPDATA%/video-studio/cuda (aparte, para no tocar el Python de video-studio).

    PY transcribir.py "<proyecto>" islas c1 c2@120 ...       -> work/islands_<clip>.txt. Cada isla de voz por separado y sin prompt, para que
                                                                no se invente repeticiones, con quién habla por el tono (él ~90-160 Hz,
                                                                la apuntadora ~180-260 Hz). c2@120: sigue en el segundo 120.
    PY transcribir.py "<proyecto>" clips [--prompt "..."]    -> words_cN.json + transcript_es.txt
    PY transcribir.py "<proyecto>" corte [--prompt "..."]    -> words.json + work/words_raw.json, desde assets/aroll.mp4
"""
import json
import os
import re
import subprocess
import sys
import time

import numpy as np

sys.dont_write_bytecode = True
ESTADO = os.path.join(os.environ.get('LOCALAPPDATA', os.path.expanduser('~/AppData/Local')), 'video-studio')
FF = json.load(open(os.path.join(ESTADO, '.platform.json'), encoding='utf-8'))['ffmpeg']
SR = 16000
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')


def modelo(nombre='medium'):
    """La tarjeta si funciona de verdad (se prueba transcribiendo un silencio) y, si no, el procesador."""
    libs = [os.path.join(ESTADO, 'cuda', 'nvidia', d, 'bin') for d in ('cublas', 'cudnn')]
    os.environ['PATH'] = os.pathsep.join([d for d in libs if os.path.isdir(d)] + [os.environ.get('PATH', '')])
    from faster_whisper import WhisperModel
    try:
        m = WhisperModel(nombre, device='cuda', compute_type='float16')
        list(m.transcribe(np.zeros(SR, np.float32), language='es')[0])
        print('whisper: tarjeta gráfica', flush=True)
        return m
    except Exception as e:      # noqa: BLE001 - sin tarjeta, sin librerías o sin memoria: el procesador sirve igual, más lento
        print('whisper: procesador (%s)' % str(e)[:120], flush=True)
        return WhisperModel(nombre, device='cpu', compute_type='int8')


def pcm(wav):
    raw = subprocess.run([FF, '-loglevel', 'error', '-i', wav, '-f', 's16le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True).stdout
    return np.frombuffer(raw, np.int16).astype(np.float32) / 32768


# ---------- quién habla ----------
def f0s(x):
    n, hop, lo, hi = 640, 320, SR // 320, SR // 70
    out = []
    for k in range(0, len(x) - n, hop):
        fr = x[k:k + n] - np.mean(x[k:k + n])
        if np.sqrt(np.mean(fr ** 2)) < 0.01:
            continue
        ac = np.correlate(fr, fr, 'full')[n - 1:]
        ac /= ac[0] + 1e-9
        lag = lo + int(np.argmax(ac[lo:hi]))
        if ac[lag] > 0.45:
            out.append(SR / lag)
    return out


def quien(x):
    f = f0s(x)
    if len(f) < 3:
        return '?', 0
    hz = float(np.median(f))
    return ('ELLA' if hz > 168 else 'EL'), hz


def islas(proj, args, salida=None):
    m = modelo()
    for arg in args:
        cid, _, frm = arg.partition('@')
        frm = float(frm or 0)
        wav = os.path.join(proj, 'work', cid + '.wav')
        a = pcm(wav)
        r = subprocess.run([FF, '-hide_banner', '-i', wav, '-af', 'silencedetect=n=-40dB:d=0.15', '-f', 'null', '-'], capture_output=True, text=True)
        ss = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', r.stderr)]
        ee = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', r.stderr)]
        isl, t = [], 0.0
        for s, e in zip(ss, ee + [len(a) / SR]):
            if s - t > 0.2:
                isl.append((t, s))
            t = e
        with open(salida or os.path.join(proj, 'work', 'islands_%s.txt' % cid), 'a' if frm else 'w', encoding='utf-8') as out:
            for s, e in isl:
                if s < frm:
                    continue
                x = a[int(s * SR):int(e * SR)]
                db = 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
                pad = np.concatenate([np.zeros(8000, np.float32), x, np.zeros(8000, np.float32)])
                segs, _ = m.transcribe(pad, language='es', word_timestamps=True, vad_filter=False, beam_size=5, condition_on_previous_text=False)
                ws = [w for sg in segs for w in sg.words]
                if not ws:
                    continue
                lab, hz = quien(x)
                wl = []                 # la voz por palabra, para ver una isla en la que hablan los dos
                for w in ws:
                    a0, a1 = s + w.start - .5, s + w.end - .5
                    l2, _h = quien(a[int(max(a0, s) * SR):int(max(a1, a0 + .12) * SR)])
                    wl.append('%s@%.2f%s' % (w.word.strip(), a0, '' if l2 in ('?', lab) else '[' + l2 + ']'))
                out.write('%7.2f-%7.2f %-4s %4.0fHz %5.1fdB | %s\n      %s\n' % (s, e, lab, hz, db, ' '.join(w.word.strip() for w in ws), ' '.join(wl)))
                out.flush()
        print(cid, 'listo', flush=True)


def _entero(m, a, prompt):
    segs, _ = m.transcribe(a, language='es', word_timestamps=True, vad_filter=False, initial_prompt=prompt)
    ws, lines = [], []
    for s in segs:
        chunk = a[int(s.start * SR):int(s.end * SR)]
        db = 20 * np.log10(np.sqrt(np.mean(chunk ** 2)) + 1e-9) if len(chunk) else -99
        lines.append('[%7.2f-%7.2f] (%5.1f dB) %s' % (s.start, s.end, db, s.text.strip()))
        ws.extend({'text': w.word.strip(), 'start': round(w.start, 3), 'end': round(w.end, 3)} for w in s.words)
    return ws, lines


def clips(proj, prompt):
    m = modelo()
    src = json.load(open(os.path.join(proj, 'sources.json'), encoding='utf-8'))
    for cid, f in src.items():
        wav = os.path.join(proj, 'work', cid + '.wav')
        if not os.path.exists(wav):
            subprocess.run([FF, '-loglevel', 'error', '-y', '-i', f, '-vn', '-ac', '1', '-ar', str(SR), wav], check=True)
        ws, lines = _entero(m, pcm(wav), prompt)
        json.dump(ws, open(os.path.join(proj, 'words_%s.json' % cid), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
        with open(os.path.join(proj, 'transcript_es.txt'), 'a', encoding='utf-8') as t:
            t.write('== %s\n%s\n' % (cid, '\n'.join(lines)))
        print(cid, 'listo', flush=True)


def corte(proj, prompt):
    m = modelo()
    wav = os.path.join(proj, 'work', 'aroll.wav')
    subprocess.run([FF, '-loglevel', 'error', '-y', '-i', os.path.join(proj, 'assets', 'aroll.mp4'), '-vn', '-ac', '1', '-ar', str(SR), wav], check=True)
    ws, lines = _entero(m, pcm(wav), prompt)
    for p in (os.path.join(proj, 'work', 'words_raw.json'), os.path.join(proj, 'words.json')):
        json.dump(ws, open(p, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print('\n'.join(lines))


def main():
    a = sys.argv[1:]
    prompt = None
    if '--prompt' in a:
        i = a.index('--prompt')
        prompt = a[i + 1]
        del a[i:i + 2]
    if len(a) < 2 or a[1] not in ('islas', 'clips', 'corte'):
        sys.exit(__doc__)
    t = time.time()
    if a[1] == 'islas':
        islas(a[0], a[2:])
    elif a[1] == 'clips':
        clips(a[0], prompt)
    else:
        corte(a[0], prompt)
    print('LISTO en %.0f s' % (time.time() - t), flush=True)


if __name__ == '__main__':
    main()
