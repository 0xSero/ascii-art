# usage: render_map.py MAP.txt OUT_BASENAME [SCALE=0.5]  -> OUT_BASENAME.png + .svg
# Chars: '#' bright, '.' dim shading (sits dim_dy lower), '@' white big, 'r' red, 'q' dim red. Optional MAP.overlay.json circles.
# Render a character pixel map ('#' bright dot, '.' shading dot) on the brand dot lattice.
import json, sys
from PIL import Image, ImageDraw
import os
L = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'lattice.json')))
rows = open(sys.argv[1]).read().split('\n')
cols = max(map(len, rows)); P, Q = L['px'], L['py']
W, H = int((cols + 2) * P), int((len(rows) + 1) * Q)
s = float(sys.argv[3]) if len(sys.argv) > 3 else 0.5; im = Image.new('RGB', (int(W*s), int(H*s)), (22, 22, 22)); g = ImageDraw.Draw(im); svg = []
for j, row in enumerate(rows):
    for i, c in enumerate(row):
        if c not in '#.@rq': continue
        x, y = (i + 1) * P, (j + 0.6) * Q + (L['dim_dy'] if c in '.q' else 0)
        r = {'#': L['r_big'], '.': L['r_dim'], '@': L['r_big'] * 1.3, 'r': L['r_big'], 'q': L['r_dim']}[c]; col = {'#': '#e6e6e6', '.': '#6e6e6e', '@': '#ffffff', 'r': '#c8394b', 'q': '#7a2a35'}[c]
        g.ellipse([(x-r)*s, (y-r)*s, (x+r)*s, (y+r)*s], fill=col)
        svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r}" fill="{col}"/>')
import os
ov = sys.argv[1].rsplit('.', 1)[0] + '.overlay.json'
if os.path.exists(ov):
    for c in json.load(open(ov)):
        g.ellipse([(c['x'] - c['r']) * s, (c['y'] - c['r']) * s, (c['x'] + c['r']) * s, (c['y'] + c['r']) * s], fill=c['fill'])
        svg.append(f'<circle cx="{c["x"]:.1f}" cy="{c["y"]:.1f}" r="{c["r"]}" fill="{c["fill"]}"/>')
im = im.resize(im.size, Image.LANCZOS); im.save(sys.argv[2] + '.png')
open(sys.argv[2] + '.svg', 'w').write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}"><rect width="100%" height="100%" fill="#161616"/>{"".join(svg)}</svg>')
