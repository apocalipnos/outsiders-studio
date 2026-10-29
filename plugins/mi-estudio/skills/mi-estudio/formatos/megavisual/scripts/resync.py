"""Re-join the segments assemble.py cut, with each segment's audio trimmed/padded to its exact video length.

The source is 25 fps: fps=30 rounds every segment's video to whole frames while its audio keeps the exact cut length,
so the joined audio drifts ahead of the picture (0.44 s over 31 segments). Run right after assemble.py.

  PY resync.py <project>
"""
import json
import os
import subprocess
import sys

proj = sys.argv[1]
plat = json.load(open(os.path.join(os.environ['LOCALAPPDATA'], 'video-studio', '.platform.json'), encoding='utf-8'))
FF = plat['ffmpeg']
work = os.path.join(proj, 'work')
segs = json.load(open(os.path.join(proj, 'segments.json'), encoding='utf-8'))
parts = []
for k, s in enumerate(segs):
    src = os.path.join(work, f'seg_{k}.mp4')
    out = os.path.join(work, f'sync_{k}.mp4')
    dur = s['frames'] / 30
    subprocess.run([FF, '-loglevel', 'error', '-y', '-i', src, '-c:v', 'copy',
                    '-af', f'apad,atrim=0:{dur:.6f}', '-c:a', 'pcm_s16le', '-ar', '48000', out], check=True)
    parts.append(out)
# video: frames joined as they are (exact: N/30). audio: the wav parts joined on their own (exact: sample counts).
# Joining the mp4 parts directly lets the container durations creep in (+0.5 s over 31 parts).
vlist = os.path.join(work, 'concat_sync.txt')
alist = os.path.join(work, 'concat_wav.txt')
for k in range(len(parts)):
    subprocess.run([FF, '-loglevel', 'error', '-y', '-i', parts[k], '-vn', '-c:a', 'pcm_s16le',
                    os.path.join(work, f'sync_{k}.wav')], check=True)
with open(vlist, 'w', encoding='utf-8', newline='\n') as fh:
    fh.write(''.join(f"file '{os.path.basename(p)}'\n" for p in parts))
with open(alist, 'w', encoding='utf-8', newline='\n') as fh:
    fh.write(''.join(f"file 'sync_{k}.wav'\n" for k in range(len(parts))))
vtmp = os.path.join(work, 'aroll_v.mp4')
atmp = os.path.join(work, 'aroll_a.wav')
subprocess.run([FF, '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', vlist, '-an',
                '-vf', 'setpts=N/30/TB', '-r', '30', '-fps_mode', 'cfr',
                '-c:v', 'libx264', '-crf', '14', '-preset', 'medium', '-g', '30', '-keyint_min', '30', '-pix_fmt', 'yuv420p',
                vtmp], check=True)
subprocess.run([FF, '-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', alist, '-c:a', 'pcm_s16le', atmp],
               check=True)
subprocess.run([FF, '-loglevel', 'error', '-y', '-i', vtmp, '-i', atmp, '-map', '0:v', '-map', '1:a', '-c:v', 'copy',
                '-c:a', 'aac', '-b:a', '192k', '-shortest', os.path.join(proj, 'assets', 'aroll.mp4')], check=True)
print('RESYNC DONE')
