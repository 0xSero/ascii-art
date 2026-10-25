---
name: ascii-art
description: How to make dot/"ASCII" pixel art from scratch — turn any photo, sculpture, object or drawing into a figure made of dots on a fixed grid (charcoal ground, two grey tones, rare crimson), compose it, and animate it into a seamless loop (disintegration into wind-blown dust, things emerging or growing out of the figure, voids, tentacles, creatures). Use for "ascii art", "pixel art", "dot art", "dot portrait", "make this out of dots", "animate it like Yudho", "make it come apart", "something coming out of it", or any looping MP4/HTML of dot art. Not for YouTube thumbnails (youtube-pack).
version: 3.0.0
---

# ASCII art from scratch

This style draws a picture with **nothing but dots on a grid**. Every effect is made
of the same dots: dust, growth, creatures, light. The skill covers the craft (what
makes it look right), the method (step by step from any source), and the motion
(how to animate it without breaking the look). The tools in `scripts/` do the
mechanical parts, but the decisions are what make it good.

- `references/engine.md`: the scene engine (JSON format, layers, parameters).
- `references/case-study.md`: one piece built end to end, with every round of
  feedback.

## 1. Anatomy of the look
| Element | Rule | Why |
|---|---|---|
| Ground | flat charcoal `#161616`, never black, no gradient | the dots carry all the light |
| Lattice | one fixed grid. Cells are tall (pitch about 19 × 36 px at full size). Every still dot sits on a cell centre | the regularity is what makes it read as "ASCII"; break it only on purpose |
| Two tones | bright dot (big, `#f2f2f0`, radius about 6.5) and dim dot (small, `#70706e`, radius about 2.9, nudged 7 px down) | two values plus the ground are enough for form, like a 2-bit print |
| Highlights | the very brightest cells may go pure white and about 15% bigger | gives sparkle without adding a tone |
| Accent | crimson `#dc143c`, rare, **only on things that move** (streaks, specks) | red in a still reads as a gimmick; red in motion reads as life |
| Grain | the subject is coarse lattice dots. Visitors, voids and far dust are **fine stipple** (pitch about 4 px, radius 0.5–2 px) | a second grain means "a different substance"; use it on purpose |

The grid comes from the Omarchy dot-hands by @samdape (`assets/lattice.json`).
Scale the whole grid uniformly for different canvas sizes; never change its aspect.

## 2. From scratch, step by step

### Step 1: pick and prepare the source
- **Choose a subject with a strong silhouette and clear light and shade.**
  Sculpture, a lit face, a hand, a skull or an object against a plain background
  all work. Busy scenes don't: the grid can't resolve detail smaller than about
  two cells.
- **Get it onto a dark ground**, either by cutting it out or by isolating it with a
  mask (step 3 of the algorithm below). If the subject is dark on light, invert it.
- **Decide the focal area now** (usually a face or an eye). It stays clean and
  readable through every effect you add later.

### Step 2: convert it to dots
The core algorithm, which `scripts/photo_dots.py` implements:
1. Resize the image so it spans `ROWS × row-pitch` pixels (45–55 rows suits a head
   or hand). More rows give more detail but a busier look.
2. Blur it slightly (σ 4–6 px). Each cell should sample a region, not a pixel.
3. **Mask the subject**: luminance above a threshold, plus colour rules if needed
   (for example "bright and not blue" to lift pale figures off blue stone). Zero out
   stray light such as god rays or reflections. In the script, use
   `ISO="lo,hi[,notblue][,invert]"`; `ISO=0.38,0.63,notblue` lifts pale figures
   off a blue background.
4. **Local contrast**: subtract about 0.6 × a heavily blurred copy (σ about 60 px).
   This lets the shading *inside* a pale surface show instead of a flat white blob.
5. Sample the mean tone in a small window at each cell centre.
6. **Threshold by percentiles of the subject's own tones**, not by fixed values:
   the top ~55–60% of cells become bright and the next ~25–30% become dim. That
   adapts to any exposure.
7. Write a text map (`#` bright, `.` dim, space empty). It's plain text, so you can
   hand-edit it: close gaps, clean the silhouette, delete noise.

```python
a = blur(gray(resize(img, rows*Q)), 5); fg = a > .12
a = a - .6*blur(a, 60) + .3                       # local contrast
hi, mid = percentile(a[fg], 100-58), percentile(a[fg], 100-86)
map = [['#' if v>hi else '.' if v>mid else ' ' for v in sample_row(a, j)] for j in range(rows)]
```

### Step 3: judge the still before anything moves
Render it (`render_map.py`) and look at it at full size.
- Does the silhouette read from across the room? Is the focal area clear at a
  glance?
- Is there shape *inside* the subject (planes, sockets, folds), or only an outline?
  If only an outline, raise `MIX` (local contrast) or lower the bright percentile.
- Make 3–4 variants (rows, blur, percentiles) and compare them side by side.
  Choosing between real renders beats guessing values.

### Step 4: compose
- **Make the subject big, with little margin.** Nothing decorative.
- **Leave empty space where the motion will go**, for example downwind of the
  dust. Put the subject at about two thirds across, away from that side.
- **Two-figure pieces** (such as a head and a reaching hand): set scale, angle and
  the gap between them deliberately. Tilt a map with `rotate_map.py` so the second
  figure stays on the same grid.
- **Split the subject in two:** one side stays itself (the focal, "human" side);
  the other side carries the transformation. That contrast is the story.

### Step 5: animate
Choose **one main idea** and support it with small ambient life. The vocabulary:
| Idea | How it reads | Technique |
|---|---|---|
| **Disintegration** | the figure is coming apart, dissolving into time or wind | dots on one side detach, ride a turbulent flow field, fade; the source dot dims, then re-forms. Shed more from the windward edge |
| **Emergence** | something comes *out of* the figure | figure dots in a region break away (a hole), and the new thing assembles from specks that fly out of the hole |
| **Growth** | something grows from the figure (tentacles, roots, branches) | a tapered tube along a spine whose angle carries travelling sine waves and a curl that increases toward the tip; it grows to full length during the intro |
| **Void** | depth or power behind the surface | fine stars born at a centre, spiralling outward and fading, seen through a small natural hollow (an eye socket, a crack) |
| **Ambient** | the image is alive | ±5–8% shimmer per dot, one soft light band per loop, a few twinkling specks |

Motion principles:
- **The subject barely moves.** Only the transforming part moves a lot.
  (Reference: Yudho, @YUDHO_XYZ.)
- **Prefer heavy and slow to fast.** Waves travel from root to tip; tips coil and
  uncoil.
- **Have an intro, then a loop.** The intro (3–5 s) plays once: the hole opens, the
  growth unfurls, the creature assembles. The loop then runs forever.
- **Avoid explosions, glow, blur and camera moves.**

### Step 6: make it loop with no cut (the maths)
- Choose `LOOP` (6–10 s). Every periodic term must be a whole number of cycles per
  loop: `sin(2π·k·t/LOOP + φ)` with integer `k`.
- **Particles:** give each one a phase `φ` and an integer cycle count `c`, and set
  `age = (c·t/LOOP + φ) mod 1`. Then compute position, alpha and size from `age`
  alone, along a path precomputed once from a *static* flow field. A particle that
  dies is reborn at the same instant, so the loop never jumps.
- **Flow field:** wind direction plus the curl of a few low-frequency sines. That
  gives smooth eddies that are divergence-free, so the dust swirls without
  clumping.
- **The intro uses absolute time `tt`; the loop uses `t = (tt − INTRO) mod LOOP`.**
  Everything driven by the intro (growth, breaking) must be finished by
  `tt = INTRO`.

### Step 7: render and deliver
- **Draw on a canvas** at a fixed size, with `render(t)` deterministic in `t`.
- **Capture frames headlessly** at 30 fps (`grab_frames.py`) and encode with x264
  CRF 16, yuv420p, faststart. Render intro + 2 loops straight through.
- **Before the full render, review a contact sheet and at least one full-size
  frame.** Most problems only show at full size.
- **Deliver** the MP4 to `~/Downloads/` plus the live HTML, and open both. Don't
  publish it or put it on a site unless asked.

## 3. Principles that decide quality
1. **Match the material.** Anything that grows *out of* the figure must be built
   from the figure's own dots (snapped to the same grid, same two tones), or it
   looks pasted on. Use fine stipple only for things that are deliberately foreign
   (a visitor, a void, distant dust).
2. **Keep the focal area intact.** Effects, regions, roots and holes stay away from
   the face or eye. Break the *other* side.
3. **Keep a rim.** When you break a hole into the figure, leave its edge standing,
   so it reads as a hollow and not as missing image.
4. **Give forms volume on the grid.** Light a tube from one side, with the lit
   edge bright, the core and underside dim, and a dim outline. Draw each body in
   turn so it hides what is behind it in its cells. Without this, overlapping forms
   merge into a blob.
5. **Use detail at the right grain.** Suckers, eyes and seams on the grid are single
   cells drawn differently (a ring is a bright dot with a ground-coloured centre),
   not tiny drawings.
6. **Design the composition rather than leaving it to chance.** Random fans look
   like hair or feathers. Place each major element on purpose: one long reach with
   a spiral hook, one that wraps around the subject, a small one breaking out of a
   socket.
7. **Keep red rare and moving.** About 3% of moving particles, drawn as streaks with
   tapering tails. Never put it on the still subject.
8. **Make the brights bright.** Bright dots should sit near full white with little
   dimming from shimmer. Muddy greys kill the print-like punch.

## 4. Tools
Python with numpy, scipy, Pillow and playwright (cached chromium), plus ffmpeg.
The scripts find `assets/` themselves, so run them from anywhere.

| Script | Purpose |
|---|---|
| `scripts/photo_dots.py IMG OUT.txt ROWS top% mid%` (env `BLUR`, `MIX`) | step 2: image → dot map |
| `scripts/render_map.py MAP OUT [scale]` | step 3: map → PNG + SVG |
| `scripts/rotate_map.py MAP DEG SCALE OUT` | step 4: tilt or scale a map on the same grid |
| `scripts/build_scene.py SCENE.json OUT.html` | steps 5–6: scene description → animated page (`assets/engine.js`) |
| `scripts/grab_frames.py HTML SHEET.png sheet` / `HTML DIR FPS SECS` | step 7: contact sheet / all frames |

The engine covers the effects in the step 5 table as composable layers; the
format is in `references/engine.md`. For a new kind of effect, add a layer that
follows the loop rules in step 6, rather than hand-writing a one-off page.

## 5. Review checklist (every round)
- [ ] The silhouette and focal area read at a glance, and the focal area is untouched.
- [ ] Everything is on the grid except deliberate fine-grain visitors.
- [ ] Only two tones plus rare highlights; the brights are bright.
- [ ] Anything grown from the figure is made of the figure's own dots.
- [ ] Overlapping forms stay separate (outline, occlusion).
- [ ] Red appears only in motion, and rarely.
- [ ] Nothing important leaves the frame by accident.
- [ ] The first frame of the loop equals the last (whole cycles only); the intro
      finishes by `INTRO`.
- [ ] You looked at a full-size frame, not just the sheet, before the final render.
