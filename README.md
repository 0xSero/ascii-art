# ascii-art

Turn any photo, sculpture, object or drawing into a figure made of dots on a fixed
grid — charcoal ground, two grey tones, rare crimson — then animate it into a
seamless loop: disintegration into wind-blown dust, things emerging or growing out
of the figure, voids, tentacles, fine-stipple creatures.

This repo is the skill: the method, the engine, and the scripts that do the
mechanical parts.

```
source image ──photo_dots/mask──► dot map (text) ──render_map──► still
                                        │
                                   scene JSON ──build_scene──► self-contained HTML (render(tt))
                                                          └──grab_frames──► PNG frames ──ffmpeg──► MP4
```

## Requirements

- Python 3.10+ with `numpy`, `scipy`, `Pillow`, `scikit-image`
- `playwright` with a chromium build (`python -m playwright install chromium`)
- `ffmpeg` for encoding

```
pip install numpy scipy pillow scikit-image playwright
python -m playwright install chromium
```

## Quickstart

```sh
# 1. image -> dot map.  rows, then the bright/mid percentiles of the subject's own tones
python scripts/photo_dots.py photo.jpg map.txt 52 58 86

# 2. look at the still before anything moves
python scripts/render_map.py map.txt still 0.6

# 3. scene JSON -> animated page
python scripts/build_scene.py examples/scenes/bust-dust.scene.json out.html

# 4. frames, then encode
python scripts/grab_frames.py out.html frames 30 12      # fps, seconds
ffmpeg -framerate 30 -i frames/%04d.png -c:v libx264 -crf 16 -pix_fmt yuv420p \
       -movflags +faststart piece.mp4
```

`grab_frames.py out.html sheet.png sheet` captures a contact sheet instead of frames.

## The look

| Element | Rule |
|---|---|
| Ground | flat `#161616`, never pure black |
| Lattice | one fixed grid, tall cells (≈19 × 36 px), every still dot on a cell centre |
| Two tones | bright `#f2f2f0` (r ≈ 6.5) and dim `#70706e` (r ≈ 2.85), nudged 7 px down |
| Accent | crimson `#dc143c`, rare, only on things that move |
| Grain | subject = coarse lattice; visitors, voids, far dust = fine stipple |

Coverage matters more than contrast: most subject cells should be **bright**; dim
dots are shadow accents, empty cells are line art (eyes, mouth, the deepest folds).

## Tools

| Script | Purpose |
|---|---|
| `scripts/photo_dots.py IMG OUT ROWS [top% mid%]` | image → dot map (env `BLUR`, `MIX`, `ISO`) |
| `scripts/render_map.py MAP OUT [scale]` | map → PNG + SVG |
| `scripts/rotate_map.py MAP DEG SCALE OUT` | tilt or scale a map on the same grid |
| `scripts/build_scene.py SCENE.json OUT.html` | scene → animated page (`assets/engine.js`) |
| `scripts/grab_frames.py HTML OUT\|DIR ...` | contact sheet or all frames, headless |

## Docs

- `SKILL.md` — the craft: anatomy, step-by-step method, motion vocabulary, loop maths, review checklist.
- `references/engine.md` — scene JSON format, layers and their parameters.
- `references/case-study.md` — one piece end to end, including every round of feedback.

## Examples

`examples/scenes/*.json` and `examples/bust-skull.map.txt` are the scenes and dot
map of one finished piece. The reference photographs they point at are **not**
included (third-party imagery), so the scenes document structure rather than run
as-is; `bust-skull.map.txt` is enough to build the figure layers.

## License

MIT — see `LICENSE`. It covers this code and text only. Any image you feed the
scripts stays yours (or its owner's); nothing here grants rights to it.
