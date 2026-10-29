"""Face boxes for faces.py: OpenCV frontal-face detector on every work/faces_raw/<key>.img, at the same 1024 scale
faces.py uses -> work/face_boxes.json {"<key>": [x, y, w, h]}. Needs OpenCV 4 (`opencv-python-headless<5` in a
throwaway venv; 5.x dropped the Haar cascades).

  <venv python> -I detect_faces.py <project>/work
"""
import json, os, sys, cv2
work = sys.argv[1]
casc = cv2.CascadeClassifier(os.path.join(cv2.data.haarcascades, 'haarcascade_frontalface_default.xml'))
out = {}
for f in sorted(os.listdir(os.path.join(work, 'faces_raw'))):
    k = f.split('.')[0]
    im = cv2.imread(os.path.join(work, 'faces_raw', f))
    H, W = im.shape[:2]; s = 1024 / max(W, H)
    w, h = int(W * s) // 16 * 16, int(H * s) // 16 * 16
    g = cv2.cvtColor(cv2.resize(im, (w, h)), cv2.COLOR_BGR2GRAY)
    faces = casc.detectMultiScale(g, 1.05, 6, minSize=(80, 80))
    if len(faces):
        x, y, fw, fh = max(faces, key=lambda b: b[2] * b[3])
        out[k] = [int(x), int(y), int(fw), int(fh)]
    print(k, out.get(k), len(faces))
json.dump(out, open(os.path.join(work, 'face_boxes.json'), 'w'), indent=1)
