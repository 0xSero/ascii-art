# Scene engine reference

`scripts/build_scene.py SCENE.json OUT.html` inlines the dot map, the lattice,
any stipple data and `assets/engine.js` into one self-contained page. The page
exposes `render(tt)`, where `tt` is absolute seconds. With `window.MANUAL = true`
it doesn't self-animate, which is how `grab_frames.py` captures frames.

## Scene file
```json
{
  "title": "Name", "size": [1920, 1080], "loop": 8, "intro": 4, "seed": 7,
  "colors": { "bg": "#161616", "bright": "#f2f2f0", "highlight": "#ffffff", "dim": "#70706e", "red": "#dc143c" },
  "figure": { "map": "subject.map.txt", "scale": 0.56, "cx": 1300, "centerCol": 49, "dy": 0 },
  "wind": { "dir": [-1, -0.32], "turb": 0.9 },
  "layers": [ { "type": "specks" }, { "type": "figure" } ]
}
```
- Paths are relative to the scene file.
- `figure.tints` (optional): a JSON file (or object) `{"col,row": [r, g, b, strength, gold]}` with r,g,b in 0–1 (max 1). A tinted cell blends its tone toward that colour; `gold: 1` marks cells the `embers` layer can emit from. Keep colour rare and muted (halos, one or two robe hues); red stays reserved for motion.
- `figure.pulseAt` (optional): `[c, r]` map cell + `pulseR` (14) cell radius. Dots near the point flare in slow pulses — a figure answering an arriving `stream` or `void`.
- `figure.fills` (optional; singular `fill` also accepted): array of colour floods applied in order (later overrides earlier). Each: `at` [c, r], `color`, `strength` (0.55), `cycles` (integer; **0 = static**), `floor` (0.55: minimum fraction of strength between wave crests), `freq` (wave per px), `sharp` (squared sine). **Shape**: default a disc (`radius` cells); **prefer `ellipse: [rx, ry]` (units of cell width) + `rot` degrees** so colour sits only on a feature (eye, lips, cheek) instead of a circle that spills onto hair. **Wave**: `pour: true` makes the front run downward; `pourFrom` (row) gives every mask the same origin so one front sweeps through eye, cheeks, lips in order. Find feature cells by overlaying the map-cell grid on the source (cell = source px × (cols/width, rows/height)). Features that are dark in the source have almost no dots: hand-add dots to the map first (lip pair, eyeball + iris), then tint them.
- `figure.glows` (optional): points that light up from within, e.g. eyes. Array of `{ "at": [c, r], "r" (2.2 cells), "color" ('#e02440'), "cycles" (2), "amp" (0.9), "phase" (0) }`. Each flashes on a cubed sine (`pow(0.5+0.5·sin(T·cycles+phase), 3)·amp`), tinting dots toward the colour and swelling their radius — use hot colours so the flare stands out over any `fill`. Place on actual anatomy: render the raw map with a grid overlay to find the cells.
- `figure.instant` (false): when true the figure is fully drawn from the first frame (no intro fade-in); the stream still ramps in over the intro.
- `figure.dimScale` (1) multiplies the dim-dot radius. Use about 1.5 on dense maps (140+ rows) so dim fields don't vanish.
- `figure.scale` scales the lattice. `cx` is the canvas x where map column
  `centerCol` lands; `dy` shifts the figure vertically.
- **Regions and points are in map cells** (read them off the map with `cat -n`): a
  box `[c0, c1, r0, r1]`, an ellipse `{ "center": [c, r], "radius": [rc, rr] }`,
  a point `[c, r]`.
- Layers draw in order. Wind particles from every source draw last.
- `intro` plays once from `tt = 0`; the loop runs from `tt = intro`, with
  `t = (tt − intro) mod loop`.

## Layers
| type | effect | params (defaults) |
|---|---|---|
| `specks` | faint twinkling stars | `count` (90) |
| `embers` | sparks rise off the gold-tinted cells without dimming them: gold motes plus red streaks | `density` (0.35), `red` (0.3), `speed` (12), `color` ('#e2b04a'), `region` |
| `figure` | the lattice figure: shimmer and a light band | `shimmer` (0.08, max dimming), `lightBand` (true) |
| `dust` | disintegration: dots in a region detach into the wind and re-form; red streaks | `region`, `density` (1), `red` (0.035) |
| `hole` | figure dots in a region break away (during the intro), ragged edge | `region`, `ragged` (0.25), `at` [t0, t1] |
| `void` | stars born at a centre, spiralling out and fading | `center`, `radius` px, `count`, `spiral`, `aspect`, `red`, `at` |
| `tentacles` | growth: lit, suckered tubes with travelling waves and coiling tips | see below |
| `stipple` | a reference image as fine stipple: breathes, sheds, assembles from a `from` region during the intro, carries birth specks, can break the figure | `image`, `crop`, `isolate` {`lum` [lo, hi], `notBlue`, `invert`, `zero` [[x0, y0, x1, y1]]}, `height` px, `pitch`, `flip`, `at` [c, r], `from`, `breakFigure`, `births`, `shed` |
| `stream` | a signal from the sky: fine stipple rain falling from above the frame, converging on and sinking into `to` [c, r] on the figure (draw BEFORE `figure` so the lattice absorbs the motes); data pulses travel down the fall, rare crimson packets ride it | `to` [c, r], `count` (700), `span` (700), `sink` (0.4 rows past the hairline), `pulses` (2), `pulseW` (0.07), `pulseAmp` (0.9), `speed` (1: >1 recycles the fall faster via integer cycle counts), `red` (0.03), `sway`, `turns`, `axisSway`, `at` [t0, t1] intro ramp |
| `sigil` | the signal condenses into a mark: concentric stipple rings that rain in from the sky and assemble during the intro, then breathe with pulses rippling outward; a crimson core arrives last; the pour threads the centre | `at` [c, r] centre, `radius` px (140), `rings` (4), `pitch` (7.5), `red` (0.05), `assemble` [t0, stagger, dur] |

### `tentacles` parameters
- **Placement:** `items` [{`root` [c, r], `angle` °, `length` px, `width` px,
  `curl`, `writhe`, `grow`}] designs each one. Without `items`, the layer
  generates a random fan from `root`, `count`, `angles` [a0, a1], `length` and
  `width` ranges. Angles: 0 = right, 90 = down, 180 = left, 270 = up. Positive
  `curl` turns clockwise toward the tip.
- **Motion:** `writhe` (1) is the wave amplitude; `coil` (0) makes the tip curl
  breathe; `curlPow` (3.2) sets how late the curl starts (lower = earlier, a
  rounder hook). `grow` [start, dur] times the intro growth.
- **Material:** `latticeRoot` [s0, s1] snaps dots up to `s0` along the tube onto
  the figure's lattice, blending to stipple by `s1`. Use [0.9, 1] for a fully
  lattice tube. `latticeSplit` (0.5) is the average shading for a bright cell;
  `highlight` (0.78) makes white specular cells; `body` (0.1) is base brightness;
  `tones` 2 limits stipple to two tones.
- **Detail:** `suckers` (true) draws ring cells on the underside on the lattice
  and dot rings in stipple; `light` (225°) is the light direction; `pitch`
  (4.4; use about 3 on the lattice).
- **Wind:** `shed` is particles per tip; `red` is the chance a particle is red.
- On the lattice, each tube is drawn in turn as a solid body that hides what is
  behind it in its cells, with a dim outline.

## Adding an effect
Add `make.<type>(o)` in `assets/engine.js` returning `{ draw(tt, t, T) }`
(`T = 2π·t/LOOP`).
- Use `at(c, r)` for map-to-canvas and `inRegion(dot, region)` for regions.
- `addPart(src, x, y, r, big, red, cycles)` sends a particle into the shared wind.
- `dot(x, y, r, colour, alpha)` draws a dot.
- Keep every periodic term an integer multiple of `T`, and finish intro-driven
  changes by `INTRO`.

## Known-good starting values
| Need | Values |
|---|---|
| Dust that reads | built-in alpha `(1-u)^0.9`, time warp `u^1.15`, 1–4 particles per emitter, weighted to the windward edge |
| Readable red streak | built-in 22-dot tail every 0.8 path steps |
| Lattice tentacles | `width` 70–120, `pitch` 3, `writhe` 0.55, `coil` 0.4, `curlPow` 2.6, `body` 0.22, `latticeRoot` [0.9, 1] |
| Stipple tentacles | `width` 46–84, `pitch` 4, `tones` 2 |
| Void in a socket | `radius` about the socket width, `aspect` 1.5–2, 400–600 stars |
| Stipple creature | `height` 380–470, `pitch` 4–4.4, `isolate.lum` [0.38, 0.63] |
