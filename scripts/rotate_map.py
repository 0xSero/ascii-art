# Rotate/scale an existing dot map and re-sample it onto the same lattice (how the hand was tilted 12 deg x1.23).
# usage: rotate_map.py MAP.txt ANGLE_DEG SCALE OUT.txt
import json, os, sys, numpy as np
from PIL import Image, ImageFilter
L = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'lattice.json'))); P, Q = L['px'], L['py']
rows = open(sys.argv[1]).read().rstrip('\n').split('\n'); A, S = float(sys.argv[2]), float(sys.argv[3])
w, h = int((max(map(len, rows)) + 2) * P), int((len(rows) + 2) * Q)
tone = np.zeros((h, w))
for j, row in enumerate(rows):
    for i, c in enumerate(row):
        if c in '#.':
            cx, cy = int((i + 1) * P), int((j + 1) * Q)
            tone[cy - int(Q / 2):cy + int(Q / 2), cx - int(P / 2):cx + int(P / 2) + 1] = 1.0 if c == '#' else 0.45
im = Image.fromarray((tone * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(5))
im = im.resize((int(w * S), int(h * S)), Image.BILINEAR).rotate(A, resample=Image.BILINEAR, expand=True)
a = np.asarray(im).astype(float) / 255
out = []
for j in range(int(a.shape[0] / Q)):
    y = int((j + 0.5) * Q); line = ''
    for i in range(int(a.shape[1] / P)):
        x = int((i + 0.5) * P); v = a[max(0, y - 9):y + 10, max(0, x - 6):x + 7].mean()
        line += '#' if v > 0.55 else ('.' if v > 0.2 else ' ')
    out.append(line.rstrip())
while out and not out[0]: out.pop(0)
while out and not out[-1]: out.pop()
open(sys.argv[4], 'w').write('\n'.join(out) + '\n')
