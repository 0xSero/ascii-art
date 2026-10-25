# Case study: the skull bust (October 2026)

One piece taken through every stage. Files are in `assets/examples/`.

**Source:** a sculpture photo, half human face and half exposed skull, pale stone
on black (`bust-skull.source.png`).

**Map:** `BLUR=6 MIX=0.6 photo_dots.py … 50 58 86` → `bust-skull.map.txt` (50
rows). Local contrast was what made the stone's planes show. Without it the bust
was a white blob.

## Rounds and feedback
| Round | What was made | Sero's reaction / lesson |
|---|---|---|
| Still | bust on the lattice | "fucking incredible": tone percentiles plus local contrast work on pale subjects |
| Composition | + Michelangelo hand from the top right (`bust-hand.still.png`) | the hand bigger than the head, tilted slightly down, a small gap at the fingertip, the arm cropped by the edge; red eyes and rays were rejected ("go back before there was red") |
| Motion v1 | the skull side disintegrates into wind (`scenes/bust-dust.scene.json`) | Yudho reference matched; the first try was too faint and short and crowded the edge |
| + red | crimson streaks on about 3.5% of the dust | "this is hot": red works when it moves |
| Emergence | Bloodborne Messengers as fine stipple (`scenes/bust-messengers.scene.json`) | first placed beside the head; asked for "come out of the head where the bone is", so the bone breaks open and they pour out |
| Growth | Lovecraft tentacles (`scenes/bust-tentacles.scene.json`): "the right side is the human, the skull side cosmic power" | fine-stipple tentacles got "doesn't match the skull", so they were rebuilt on the bust's own lattice |
| Polish | brighter brights, designed tentacles (spiral hook, neck wrap, crown hook, socket), coiling tips, lattice suckers, occlusion and outlines | "make the light parts more bright, the tentacle can be way more cool" |

## Generalised lessons
- Pale subjects need local contrast before thresholding.
- The transformation goes on the side away from the focal area, and it must look
  like it belongs to the subject: same grid, same tones.
- A random arrangement reads as hair; designed placement reads as intent.
- Fill the frame. Empty canvas is only for where the motion goes.
