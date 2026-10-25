# Build a self-contained animation page from a scene JSON (see SKILL.md "Scene format").
# usage: build_scene.py SCENE.json OUT.html        (paths inside the scene are relative to the scene file)
import json, os, sys
import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage
HERE = os.path.dirname(os.path.abspath(__file__)); ASSETS = os.path.join(HERE, '..', 'assets')

def isolate(path, iso):
    """Subject mask * luminance from a reference image: bright pixels, optionally not blue-tinted, minus zeroed boxes."""
    a = np.asarray(Image.open(path).convert('RGB')).astype(float) / 255; lum = a.mean(2)
    lo, hi = iso.get('lum', [0.38, 0.63])
    m = np.clip((lum - lo) / (hi - lo), 0, 1)
    if iso.get('notBlue', True): m *= np.clip(1 - (a[:, :, 2] - a[:, :, 0] - 0.06) / 0.12, 0, 1)
    if iso.get('invert'): m = np.clip((1 - lum - lo) / (hi - lo), 0, 1); lum = 1 - lum
    for x0, y0, x1, y1 in iso.get('zero', []): m[y0:y1, x0:x1] = 0
    return Image.fromarray((m * lum * 255).astype(np.uint8))

def stipple(o, base, seed):
    """Fine stipple dots [x, y, r, alpha] relative to the layer's centre."""
    rng = np.random.default_rng(seed)
    im = isolate(os.path.join(base, o['image']), o.get('isolate', {}))
    if 'crop' in o: im = im.crop(tuple(o['crop']))
    if o.get('flip'): im = im.transpose(Image.FLIP_LEFT_RIGHT)
    h = o.get('height', 400); k = h / im.height
    im = im.resize((int(im.width * k), int(h)), Image.LANCZOS).filter(ImageFilter.GaussianBlur(1.0))
    t = np.asarray(im).astype(float) / 255
    t = np.clip(t - 0.65 * ndimage.gaussian_filter(t, 16) + 0.24, 0, 1) * (t > 0.1)        # local contrast
    pitch = o.get('pitch', 4.4); out = []
    for j, y in enumerate(np.arange(pitch / 2, t.shape[0], pitch * 0.88)):
        for x in np.arange(pitch / 2 + (j % 2) * pitch / 2, t.shape[1], pitch):
            v = t[int(y), int(x)]
            if v > 0.12 and rng.random() < min(1, (v / 0.7) ** 1.4):
                v = min(1, v / 0.8)
                out.append([round(x - t.shape[1] / 2 + rng.uniform(-.6, .6), 1), round(y - t.shape[0] / 2, 1), round(0.45 + 1.6 * v, 2), round(min(1, 0.12 + 0.95 * v ** 1.7), 2)])
    return out

scene_path, out = sys.argv[1], sys.argv[2]
sc = json.load(open(scene_path)); base = os.path.dirname(os.path.abspath(scene_path))
sc['figure']['map'] = open(os.path.join(base, sc['figure']['map'])).read().rstrip('\n')
if isinstance(sc['figure'].get('tints'), str): sc['figure']['tints'] = json.load(open(os.path.join(base, sc['figure']['tints'])))
sc['lattice'] = json.load(open(os.path.join(ASSETS, 'lattice.json')))
for n, l in enumerate(sc['layers']):
    if l['type'] == 'stipple': l['data'] = stipple(l, base, sc.get('seed', 11) + n); print('stipple dots', len(l['data']))
eng = open(os.path.join(ASSETS, 'engine.js')).read()
html = f'''<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{sc.get('title', 'Dot Scene')}</title>
<style>html,body{{margin:0;background:{sc.get('colors', {}).get('bg', '#161616')};height:100%}}body{{display:grid;place-items:center}}canvas{{width:100vw;max-width:100%;height:auto;max-height:100vh;object-fit:contain;display:block}}</style>
</head><body><canvas id="c"></canvas>
<script>window.SCENE = {json.dumps(sc, separators=(',', ':'))};</script>
<script>
{eng}
</script></body></html>
'''
open(out, 'w').write(html); print('wrote', out)
