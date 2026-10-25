# Deterministic frame capture of an animation page that exposes window.render(t) and honours window.MANUAL.
# usage: grab_frames.py /abs/HTML OUTDIR FPS SECONDS      -> OUTDIR/f0000.png ... (t=0 is the start of the intro)
#        grab_frames.py /abs/HTML SHEET.png sheet          -> 6-frame contact sheet (intro, if any, then one loop)
# Needs python playwright + its cached chromium. Do not use headless Brave (hangs).
import sys, base64, io, os
from playwright.sync_api import sync_playwright
from PIL import Image
html, out = os.path.abspath(sys.argv[1]), sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1920, 'height': 1080}, device_scale_factor=1)  # MANUAL pages draw at dpr 1
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.add_init_script('window.MANUAL=true'); pg.goto('file://' + html)
    if errs: print('errors', errs); sys.exit(1)

    def shot(t):
        u = pg.evaluate(f'(render({t}), document.getElementById("c").toDataURL("image/png"))')
        return Image.open(io.BytesIO(base64.b64decode(u.split(',')[1]))).convert('RGB')

    if sys.argv[3] == 'sheet':
        Lp, In = pg.evaluate('[window.LOOP || 8, window.INTRO || 0]')
        ts = ([In * 0.3, In * 0.65] if In else []) + [In + Lp * k / 6 for k in range(4 if In else 6)]
        ims = [shot(t) for t in ts]; w, h = ims[0].width // 2, ims[0].height // 2
        s = Image.new('RGB', (w * 2, h * 3))
        for k, im in enumerate(ims): s.paste(im.resize((w, h)), ((k % 2) * w, (k // 2) * h))
        s.save(out)
    else:
        fps, secs = int(sys.argv[3]), float(sys.argv[4]); os.makedirs(out, exist_ok=True)
        for k in range(int(fps * secs)): shot(k / fps).save(f'{out}/f{k:04d}.png')
    print('errors', errs); b.close()
