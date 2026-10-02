# Ten Thousand Windows

A small side-view pixel game set in a walled city that grew into one building. You arrive with twelve dollars,
a room on the fifth floor, and a letter for a woman named Lam Siu-ying. The city is enormous and does not
notice you. You live in it anyway.

Open `index.html` in a browser (or serve the folder: `python3 -m http.server -d walled 8000`).
A number after `#` picks the city seed, e.g. `index.html#4242`.

## Controls
| | |
|---|---|
| A / D | walk (Shift to run) |
| W / S | climb ladders, drop through planks |
| Space | jump |
| E | talk, use, accept (Q declines) |
| M / Tab | map: nearby, whole city, off |
| F | switch tracked task |
| hold T | let time pass |
| N / H | sound / hide help |

## How it works
- **The city** is generated per seed: blocks of 9–14 storey buildings jammed together, lightwells with plank
  bridges, AC ledges and live wires, rooftops with shacks, antennas and water tanks, and a drain underneath.
  Every building has a stairwell ladder; floors are painted with block letters and numbers (`C 7`).
- **People** keep simple routines: workshops close at night, homes go dark and their tenants sleep, the mahjong
  game never stops. Some of them need things carried, water hauled up from the standpipe, a cat found, or a
  fuse fixed in the drains after a power cut.
- **It is unforgiving.** Climbing costs breath and a tired grip lets go. Falls of more than a floor hurt, and a
  fall spills your bucket. Food runs out. Rent is $30 every three days, and missing it twice gets you evicted.
- **It is also cozy.** Your room has a bed, a kettle, and a radio that plays when you are near it. Noodles cost
  five dollars. An orange cat may decide you are acceptable. Each job you finish gets you closer to Lam.
- **Look and sound**: tiles, rooms and props are painted procedurally into one canvas; light is an ambient sky
  grid plus room-clipped gradients, quantised with a Bayer dither and multiplied over the scene. Neon, windows,
  bulbs and TVs glow on top. Planes on approach pass low over the roofs every minute or two. All audio is
  synthesised with Web Audio.

## Files
`js/gen.js` world generation · `js/bake.js` static art · `js/sprites.js` people and animals ·
`js/light.js` lighting · `js/audio.js` sound · `js/story.js` text · `js/ui.js` overlays · `js/game.js` everything else.

Tests (headless Chromium via Playwright): `node test/play.mjs` checks the core loops,
`node test/smoke.mjs` saves screenshots to `test/shots/`, `node test/soak.mjs` runs several seeds for a few days.
