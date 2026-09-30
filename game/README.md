# Hearthlands (prototype)

A 2D side-view sandbox with a lit, dithered pixel-art look. Dig and build like Minecraft, in villages
that live their own lives.

Run it locally by serving this folder with any static server and opening `index.html`:

```
python3 -m http.server -d game 8000     # then open http://localhost:8000
```

A number after `#` in the URL picks the world seed, e.g. `index.html#12345`.

## Controls
| | |
|---|---|
| A / D | move |
| Space | jump |
| W / S | climb ladders, drop through platforms |
| Left click | mine blocks, furniture and walls; attack |
| Right click | place (hold and drag to build fast), give a gift to a villager, eat |
| E | inventory and crafting (right-click a recipe to craft 5) |
| 1–0, wheel | pick a hotbar slot |
| Hold T | fast-forward time |
| H / M | hide help / mute |

## What's in this slice
- **World:** procedural terrain, caves, ores, trees, glowing grottos, and wolf dens with a ramp up to the surface.
- **Villages:** surface villages of half-timbered houses (floors, ladders, attics, cellars) and burrow villages dug into hills.
- **Villagers:** they keep daily routines (work at their station, haul sacks between cellars and attics, eat, play,
  sleep, patrol) and pathfind with walking, steps, drops and ladders.
- **Reactions:** hurt one and nearby villagers flee or fight (guards always fight), then calm down. Villages keep a
  grudge that fades over time. Killing makes guards attack you on sight. Theft is noticed if someone is watching,
  and gifts mend things.
- **Wolves:** they sleep in their dens by day, wake when you come close, and hunt on the surface at night.
  Guards defend their village from them.
- **Homes:** a room with a back wall, a bed, a light and a table or chair counts as a home, and a travelling settler
  moves in. Their job depends on the stations you furnish it with.
- **Rendering:** tiles are drawn into cached chunks, lighting is a flood-filled light map, and a WebGL pass multiplies
  the scene by Bayer-dithered light.

## Code map
`src/worldgen.js` terrain and features · `src/villagegen.js` villages · `src/ai.js` villagers and wolves ·
`src/path.js` A* for walkers · `src/light.js` light map · `src/render.js` textures, chunks, sky, WebGL compositor ·
`src/game.js` loop and player actions · `src/ui.js` HUD and menus.

## Tests
`npm install`, then `node test/smoke.mjs`, `node test/interact.mjs` and `node test/society.mjs`. They run the game
in headless Chromium and check mining, placing, village reactions, homes, wolves, theft and grudges.
