# Hearthburrow

A cozy base-building game, seen in cross-section like an ant farm. A snowy pine forest sits on top and the burrow
lies below it. You dig tunnels, lay out rooms, and look after a growing family of little burrowfolk. There are no
words anywhere: everything is told with icons, numbers, sounds and the folk's own little speech bubbles.

Run it by serving this folder with any static server and opening `index.html`:

```
python3 -m http.server -d burrow 8000     # then open http://localhost:8000
```

The game saves itself in the browser. Add `#new` to the URL to start over, or press the house button on the title
card. Needs WebGL2.

## Playing
| | |
|---|---|
| Hand (1) | click anything to poke it; drag folk, the cat, or furniture you placed; drag empty space to look around |
| Dig (2) | paint tunnels (two cells tall, so folk fit). Start a stroke on a marked cell, or right-drag, to unmark |
| Ladder (3) | paint ladders (1 wood each). On a room floor this cuts a hatch. Shafts get ladders by themselves as they are dug |
| Room (4) | pick a room and place its blueprint. Folk dig it out, then build it |
| Decor (5) | place beds, lanterns, rugs, plants and more. They make rooms cozier |
| Erase (6) | remove decor (half refund), cancel a blueprint, take away marks and ladders |
| Space / F | pause / change speed |
| WASD, arrows, wheel | look around |
| M | mute |

The panel at the top centre is the current goal, shown as icons with a counter. The tool you need pulses.

## What happens in the burrow
- **Folk** have three needs: sleep, food and joy. Hover over one to see them. They pick their own jobs: digging,
  building, chopping the trees you marked, stoking the hearth, cooking, tending and harvesting mushrooms, and
  picking berries. In their spare time they chat (in pictures), read, bathe, sit by the fire, and dance when the
  phonograph plays. They carry lanterns in the dark.
- **Rooms:** bedroom, kitchen (food becomes meals), mushroom farm, storage (bigger stock), hearth (warmth, and where
  everyone gathers), bathhouse and library.
- **Newcomers** walk in from the forest when there is a free bed and the burrow is happy. An arrow at the screen edge
  points to them.
- **Things to click:** lamps and lanterns switch on and off. The hearth flares up (it uses wood). The phonograph plays
  a music box. The bell calls everyone to the hearth. Mushrooms can be harvested by hand and plants grow when
  clicked. Trees shake off their snow and get marked for chopping. Bushes give berries, and crystals in the rock
  ring like chimes. Click the night sky for a shooting star, or the day sky for birds. You can pet the cat and poke
  the folk (not too often).
- **Look:** tiles and sprites are all drawn in code. A flood-filled light map is multiplied over the scene in a WebGL
  pass with Bayer dithering, which gives the warm pools of lamplight against dark earth.

## Code map
`src/world.js` tiles, rooms, objects, world generation · `src/ai.js` folk and cat · `src/path.js` walking graph ·
`src/render.js` textures, sky, light map, compositor · `src/sprites.js` pixel art · `src/game.js` loop, tools,
interactions, saving · `src/ui.js` HUD and goals · `src/audio.js` synthesised sound · `src/content.js` data.

## Test
`npm install`, then `node test/play.mjs`. It plays through in headless Chromium: digging, a kitchen, chopping,
cooking, dragging folk and furniture, shafts, and save/reload. Screenshots go to `test/shots/`.
