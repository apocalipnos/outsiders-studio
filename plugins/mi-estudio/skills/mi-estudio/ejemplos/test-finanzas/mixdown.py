"""Mixes the stems with the gains set in Mi Estudio, Edición > Audio (edicion/audio_edit.json, {"voice": dB, ...};
proposed levels before that: edicion/audio.json) and puts that audio
under a render's picture (video copied, nothing re-rendered).

  python mixdown.py <project> <render in> <render out>
"""
import json
import os
import subprocess
import sys

proj, src, dst = sys.argv[1], sys.argv[2], sys.argv[3]
mix = os.path.join(proj, 'work', 'mix')
sys.path.insert(0, '<MI>')
import edicion  # noqa: E402
offer = json.load(open(os.path.join(proj, 'edicion', 'audio.json'), encoding='utf-8'))
g = edicion.editado(proj, 'audio', {s['id']: s['default'] for s in offer['stems']})
stems = ['voice', 'music', 'sfx']
ins = sum((['-i', os.path.join(mix, f'{s}.wav')] for s in stems), [])
fc = ';'.join(f'[{k + 1}:a]volume={g[s]}dB[{s}]' for k, s in enumerate(stems))
fc += ';[voice][music][sfx]amix=inputs=3:normalize=0,alimiter=limit=0.95:level=false[a]'
subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', src] + ins +
               ['-filter_complex', fc, '-map', '0:v:0', '-map', '[a]', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '256k',
                '-shortest', dst], check=True)
print('mixed', g, '->', dst)
