"""The reel's three audio stems at 48 kHz stereo, each at unity gain, for the mixer and the final mix:
  work/mix/voice.wav  the cut's voice (assets/aroll.mp4, the enhanced audio)
  work/mix/music.wav  the song from MUSIC_FROM s; from LOOP_TO on it loops LOOP_FROM..LOOP_TO (song seconds, both on
                      the beat and on the same chord, so the seams fall in time), short fade in, 1.2 s fade out
  work/mix/sfx.wav    every sound cue of plan.json at its time and its own vol

  python stems.py <project>
"""
import json
import os
import subprocess
import sys

import numpy as np

sys.path.insert(0, '<MI>')
import edicion  # noqa: E402

proj = sys.argv[1]
MUSIC, MUSIC_FROM = os.path.join(proj, 'assets', 'music', 'musica.mp3'), 0.6
# 98.5 bpm, eighth 0.3046 s from 0.076: beat 16 (4.950, reel 4.35) and beat 28 (8.605, reel 8.00) are both the G chord;
# past song 9.8 more chords come in, which the buyer does not want
LOOP_FROM, LOOP_TO = 0.076 + 16 * 0.3046, 0.076 + 28 * 0.3046
out = os.path.join(proj, 'work', 'mix')
os.makedirs(out, exist_ok=True)
segs = json.load(open(os.path.join(proj, 'segments.json'), encoding='utf-8'))
DUR = (segs[-1]['frame'] + segs[-1]['frames']) / 30
plan = json.load(open(os.path.join(proj, 'plan.json'), encoding='utf-8'))
FF = ['ffmpeg', '-loglevel', 'error', '-y']

subprocess.run(FF + ['-i', os.path.join(proj, 'assets', 'aroll.mp4'), '-vn', '-ac', '2', '-ar', '48000',
                     os.path.join(out, 'voice.wav')], check=True)
SR = 48000
song = np.frombuffer(subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', MUSIC, '-f', 'f32le', '-ac', '2', '-ar', str(SR), '-'],
                                    capture_output=True, check=True).stdout, np.float32).reshape(-1, 2)
XF = int(0.012 * SR)                      # 12 ms equal-power crossfade at every seam
fade_in, fade_out = np.sin(np.linspace(0, np.pi / 2, XF))[:, None], np.cos(np.linspace(0, np.pi / 2, XF))[:, None]
a, b, n = int(MUSIC_FROM * SR), int(LOOP_TO * SR), int(DUR * SR)
music = song[a:b + XF].copy()
la, lb = int(LOOP_FROM * SR), int(LOOP_TO * SR)
while len(music) - XF < n:
    piece = song[la:lb + XF].copy()
    music[-XF:] = music[-XF:] * fade_out + piece[:XF] * fade_in
    music = np.concatenate([music, piece[XF:]])
music = music[:n]
music[:int(.15 * SR)] *= np.linspace(0, 1, int(.15 * SR))[:, None]
fo = int(1.2 * SR)
music[-fo:] *= np.linspace(1, 0, fo)[:, None]
subprocess.run(FF + ['-f', 'f32le', '-ac', '2', '-ar', str(SR), '-i', '-', '-c:a', 'pcm_s16le', os.path.join(out, 'music.wav')],
               input=music.astype(np.float32).tobytes(), check=True)
cues = [s for s in plan.get('sounds', []) if 'music' not in s['src']]
ins, chains = [], []
for k, s in enumerate(cues):
    ins += ['-i', os.path.join(proj, s['src'])]
    ms = int(round(s['at'] * 1000))
    chains.append(f"[{k}:a]aformat=sample_rates=48000:channel_layouts=stereo,volume={s.get('vol', 1)},adelay={ms}|{ms}[c{k}]")
mix = ''.join(f'[c{k}]' for k in range(len(cues))) + f'amix=inputs={len(cues)}:normalize=0,apad,atrim=0:{DUR:.3f}'
subprocess.run(FF + ins + ['-filter_complex', ';'.join(chains) + ';' + mix, '-ar', '48000', os.path.join(out, 'sfx.wav')],
               check=True)
print('stems ->', out, f'{DUR:.2f}s', len(cues), 'cues')
# Mi Estudio, Edición > Audio: one fader per stem
edicion.ofrecer(proj, 'audio', {'video': 'assets/aroll.mp4', 'stems': [
    {'id': 'voice', 'label': 'Voz', 'src': 'work/mix/voice.wav', 'default': 0},
    {'id': 'music', 'label': 'Música', 'src': 'work/mix/music.wav', 'default': -22},
    {'id': 'sfx', 'label': 'Efectos de sonido', 'src': 'work/mix/sfx.wav', 'default': 0}]})
