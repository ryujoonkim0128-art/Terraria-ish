# Grow a Garden — voxel edition

A mobile take on the Roblox game *Grow a Garden*, built as a little 3D voxel diorama. Plant anywhere on your
garden bed, watch crops grow (even while you're away), harvest, sell at the stall, and buy rarer seeds.

No build step. Three.js r128 is vendored in `vendor/`; everything else is plain ES modules.

## Play
Serve this folder and open it on your phone:

```
python3 -m http.server -d garden 8000      # then open http://<your-computer>:8000
```

Add it to your home screen for fullscreen. Progress saves on the device.

| | |
|---|---|
| **Plant** | Pick a seed in the hotbar, tap anywhere on the soil. Drag to plant a row. Plants need a little room. |
| **Harvest** | Tap or swipe across ripe crops (they sparkle), or press the green basket button. |
| **Sell / buy** | Tap the **SELL** or **SEEDS** stall. Seeds restock every 5 minutes. Hold a buy button to buy many. |
| **Look around** | Pinch to zoom, drag empty ground to pan. Tap a growing plant to see how long it has left. |
| **Shovel** | The last hotbar slot. Tap a plant to dig it up. |

## What's in it
- 15 crops from Carrot to Beanstalk across 7 rarities, each a voxel model with 6 growth stages. Berries, trees
  and vines keep fruiting; every fruit rolls its own size (giants are worth much more).
- Weather and time: a day/night cycle with stars and lanterns, rain, snow and thunderstorms. They mutate fruit:
  Wet, Chilled, Frozen, Shocked (lightning, x100), Moonlit, Bloodlit, plus rare Gold (x20) and Rainbow (x50).
- A wordless tutorial: one objective chip, a bouncing arrow and glowing trail in the world, a pointing hand.
- Offline growth (up to 8 hours), autosave, generative music, sound effects and haptics.

## Code map
`src/voxel.js` voxel sets, the mesher (baked ambient occlusion), instanced batches ·
`src/models.js` every crop, fruit, stall and character as voxels · `src/world.js` the 3D scene, camera, lighting,
sky, weather, picking · `src/ui.js` HUD, hotbar, shop sheets, touch input, tutorial · `src/state.js` save data
and player actions · `src/sim.js` growth, weather, mutations · `src/data.js` crop table · `src/icons.js` voxel
icons for the UI · `src/audio.js` WebAudio synth · `src/main.js` boot and loop.

## Tests
`npm install`, then:
- `node test/play.mjs` plays a fresh game on an emulated iPhone with real taps (tutorial, planting, drag
  planting, spacing, harvesting, selling, buying, shovel, rain, save/reload) and checks every step.
- `node test/gallery.mjs` screenshots a full garden by day, sunset, night, snow and storm.
- `node test/make-icon.mjs` regenerates `icon.png`.

`mockups/` holds the six art-style explorations this look was picked from.
