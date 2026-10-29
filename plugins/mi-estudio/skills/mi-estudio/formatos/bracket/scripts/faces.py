"""Cut the 16 character portraits down to sticker heads for the bracket: person matte (RVM), head from the top of the
hair to just under the chin (the neck is the narrowest row under the head), white sticker outline baked in.

  PY -I faces.py <project>        work/faces_raw/<key>.img -> assets/faces/<key>.png (400x400 RGBA) + work/faces_sheet.png
  work/faces_fix.json (optional): {"<key>": {"neck": <+/- px at 1024 scale>, "dx": <px>, "top": <px>}} to nudge one head.
"""
import json
import os
import sys

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter
from scipy import ndimage

proj = sys.argv[1]
work = os.path.join(proj, 'work')
out_dir = os.path.join(proj, 'assets', 'faces')
os.makedirs(out_dir, exist_ok=True)
MODEL = os.path.join(os.environ['LOCALAPPDATA'], 'video-studio', 'models', 'rvm_resnet50_fp32.onnx')
KEYS = ['dwight', 'robert', 'stanley', 'meredith', 'andy', 'phyllis', 'jim', 'kelly',
        'pam', 'toby', 'kevin', 'angela', 'michael', 'ryan', 'creed', 'oscar']
fix_path = os.path.join(work, 'faces_fix.json')
FIX = json.load(open(fix_path, encoding='utf-8')) if os.path.exists(fix_path) else {}
# face boxes at the same 1024 scale (OpenCV frontal face detector, run once: work/face_boxes.json)
BOX = json.load(open(os.path.join(work, 'face_boxes.json'), encoding='utf-8'))
SIZE, RING = 400, 12
sess = ort.InferenceSession(MODEL, providers=['CPUExecutionProvider'])


def matte(rgb):
    x = rgb.astype(np.float32).transpose(2, 0, 1)[None] / 255.
    rec = [np.zeros((1, 1, 1, 1), np.float32)] * 4
    for _ in range(4):
        _, pha, *rec = sess.run(None, {'src': x, 'r1i': rec[0], 'r2i': rec[1], 'r3i': rec[2], 'r4i': rec[3],
                                       'downsample_ratio': np.array([.5], np.float32)})
    return np.clip(pha[0, 0], 0, 1)


tiles = []
for k in KEYS:
    im = Image.open(os.path.join(work, 'faces_raw', k + '.img')).convert('RGB')
    s = 1024 / max(im.size)
    w, h = (int(im.width * s) // 16 * 16, int(im.height * s) // 16 * 16)
    im = im.resize((w, h), Image.LANCZOS)
    rgb = np.asarray(im)
    a = matte(rgb)
    m = a > .5
    lab, n = ndimage.label(m)
    if n > 1:                                       # keep the biggest blob: the person
        m = lab == (1 + np.argmax(ndimage.sum(m, lab, range(1, n + 1))))
    rows = np.where(m.any(1))[0]
    top = rows[0] + FIX.get(k, {}).get('top', 0)
    span = np.array([(np.where(r)[0][-1] - np.where(r)[0][0]) if r.any() else 0 for r in m], float)
    # head width: the widest row in a window that grows with the width it finds (ears / hair sit at about half height)
    hw = span[top:top + 60].max()
    for _ in range(4):
        hw = span[top:top + int(.9 * hw)].max()
    # the chin: just above where the shoulders start, never shorter than 1.05 or longer than 1.4 head widths
    below = np.where(span[top + int(.7 * hw):] > 1.4 * hw)[0]
    shoulder = top + int(.7 * hw) + (below[0] if len(below) else int(.7 * hw))
    neck = int(np.clip(shoulder - .05 * hw, top + 1.05 * hw, top + 1.4 * hw))
    band = m[top:neck]
    cx = int(np.mean(np.where(band)[1]))
    fw = hw / 1.3
    if k in BOX:                                    # a detected face beats the silhouette (hunched poses hide the neck)
        bx, by, fw, fh = BOX[k]
        neck, cx = int(by + 1.12 * fh), int(bx + fw / 2)
    neck += FIX.get(k, {}).get('neck', 0)
    cx += FIX.get(k, {}).get('dx', 0)
    side = int(max(neck - top, 1.45 * fw) * 1.12)
    y0 = top - int(.05 * side)
    x0 = cx - side // 2
    # the neck cut: an arc that dips a little in the middle, everything under it goes; an oval around the head drops
    # the shoulders beside the face
    yy, xx = np.mgrid[0:h, 0:w]
    cut = neck + .05 * side * np.clip(1 - ((xx - cx) / (.35 * side)) ** 2, 0, 1)
    ry = (neck - top) / 2 * 1.15
    oval = ((xx - cx) / (.75 * fw)) ** 2 + ((yy - (top + neck) / 2 - .05 * ry) / ry) ** 2 <= 1
    keep = (yy < cut) & m & oval
    lab, n = ndimage.label(keep)
    if n > 1:
        keep = lab == (1 + np.argmax(ndimage.sum(keep, lab, range(1, n + 1))))
    alpha = a * keep
    rgba = np.dstack([rgb, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    pad = side // 4
    canvas = np.zeros((h + 2 * pad + side, w + 2 * pad + side, 4), np.uint8)
    canvas[pad:pad + h, pad:pad + w] = rgba
    crop = canvas[pad + y0 - pad // 2:pad + y0 + side + pad // 2, pad + x0 - pad // 2:pad + x0 + side + pad // 2]
    head = Image.fromarray(crop, 'RGBA').resize((SIZE, SIZE), Image.LANCZOS)
    # sticker: the head's silhouette grown by RING px in white, the head on top
    al = np.asarray(head)[:, :, 3] > 100
    ring = ndimage.binary_dilation(al, iterations=RING)
    ring = ndimage.gaussian_filter(ring.astype(float), 1.0)
    base = np.zeros((SIZE, SIZE, 4), np.uint8)
    base[..., :3] = 255
    base[..., 3] = (np.clip(ring, 0, 1) * 255).astype(np.uint8)
    st = Image.fromarray(base, 'RGBA')
    st.alpha_composite(head)
    # every sticker fills its square the same way: crop to the sticker, centre it on a square, back to SIZE
    l, t, r, b = st.getbbox()
    sq = max(r - l, b - t) + 4
    fit = Image.new('RGBA', (sq, sq))
    fit.alpha_composite(st.crop((l, t, r, b)), ((sq - (r - l)) // 2, (sq - (b - t)) // 2))
    st = fit.resize((SIZE, SIZE), Image.LANCZOS)
    st.save(os.path.join(out_dir, k + '.png'))
    tiles.append(st)
    print(k, 'top', top, 'neck', neck, 'side', side, 'cx', cx)

sheet = Image.new('RGBA', (8 * 210, 2 * 210), (40, 40, 40, 255))
for i, t in enumerate(tiles):
    sheet.alpha_composite(t.resize((200, 200), Image.LANCZOS), (i % 8 * 210 + 5, i // 8 * 210 + 5))
sheet.save(os.path.join(work, 'faces_sheet.png'))
print('DONE')
