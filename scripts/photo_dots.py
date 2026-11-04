# Turn a photo into the brand dot map on the hand's lattice: bright -> '#', mid -> '.', dark -> ' '.
# usage: [BLUR=4 MIX=0.7] photo_dots.py IMAGE OUT.txt ROWS [top% mid%]
#   top%  = share of foreground cells that become bright '#'  (bust used 58)
#   mid%  = share that become at least dim '.'               (bust used 86)
#   BLUR  = gaussian blur before sampling (6 for the bust); MIX = local-contrast strength (0.6 for the bust)
#   Expects a subject on a dark background (fg = luminance > 0.12). Otherwise isolate it: ISO="lo,hi[,notblue][,invert]"
#   (e.g. ISO=0.38,0.63,notblue lifts pale figures off blue stone), or cut it out first.
import json, os, sys, numpy as np
from PIL import Image, ImageFilter
L = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'lattice.json'))); P, Q = L['px'], L['py']
src, out, rows = sys.argv[1], sys.argv[2], int(sys.argv[3])

if src.lower().endswith('.svg'):                # rasterize SVG via playwright (already a dependency); Pillow can't read SVG
    from playwright.sync_api import sync_playwright
    svg = open(src).read()
    page = f'<!doctype html><html><head><style>html,body{{margin:0;background:#111;overflow:hidden}}svg{{display:block}}</style></head><body>{svg}</body></html>'
    pp = os.path.join(os.path.dirname(os.path.abspath(out)), f'.{os.path.basename(out)}.svg.html')
    open(pp, 'w').write(page)
    with sync_playwright() as pw:
        b = pw.chromium.launch(headless=True); pg = b.new_page(viewport={'width': 2048, 'height': 2048})
        pg.goto(f'file://{os.path.abspath(pp)}'); pg.wait_for_timeout(300)
        pg.locator('svg').screenshot(path=src + '.png'); b.close()
    os.remove(pp)
    a = np.asarray(Image.open(src + '.png').convert('L'))
    ys, xs = np.where(a > 40)
    if len(xs) == 0: sys.exit(f'error: no ink found in {src} (is the SVG empty or fully transparent?)')
    Image.open(src + '.png').convert('RGB').crop((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1)).save(src + '.png')
    print('rasterized', src, '->', src + '.png', f'({xs.max()-xs.min()+1}x{ys.max()-ys.min()+1} px, cropped to ink)')
    src = src + '.png'

rgb = np.asarray(Image.open(src).convert('RGB')).astype(float) / 255
if os.environ.get('ISO'):                       # ISO="lo,hi[,notblue][,invert]": isolate the subject from its background
    o = os.environ['ISO'].split(','); lo, hi = float(o[0]), float(o[1]); lum = rgb.mean(2)
    if 'invert' in o: lum = 1 - lum
    m = np.clip((lum - lo) / (hi - lo), 0, 1)
    if 'notblue' in o: m *= np.clip(1 - (rgb[:, :, 2] - rgb[:, :, 0] - 0.06) / 0.12, 0, 1)
    im = Image.fromarray((m * lum * 255).astype(np.uint8))
else:
    im = Image.open(src).convert('L')
H = rows * Q; k = H / im.height; W = im.width * k
a = np.asarray(im.resize((int(W), int(H)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(float(os.environ.get('BLUR', 4))))).astype(float) / 255
from scipy import ndimage
fg = a > 0.12
MIX = float(os.environ.get('MIX', 0.7)); local = a - MIX * ndimage.gaussian_filter(a, 60) + MIX / 2            # local contrast: shading inside the white stone shows
local = np.where(fg, local, 0)
cols = int(W / P)
vals = local[fg]
hi = np.percentile(vals, 100 - float(sys.argv[4] if len(sys.argv) > 4 else 50))
mid = np.percentile(vals, 100 - float(sys.argv[5] if len(sys.argv) > 5 else 85))
a = local
g = []
for j in range(rows):
    y = int((j + 0.5) * Q); line = ''
    for i in range(cols):
        x = int((i + 0.5) * P)
        v = a[max(0, y - 12):y + 13, max(0, x - 7):x + 8].mean()
        line += '#' if v > hi else ('.' if v > mid else ' ')
    g.append(line.rstrip())
open(out, 'w').write('\n'.join(g) + '\n')
print(cols, rows)
