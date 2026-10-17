# Sky Garden

A voxel garden on your own floating island in the sky, for phones. A mobile take on games like *Grow a Garden*: the
island holds a big planter and a little market, with cliffs and stalactites underneath, a waterfall spilling off
the edge, islets drifting nearby and a sea of cloud far below. Walk your farmer around with a thumbstick, plant
anywhere in your garden bed, watch crops grow (even while you're away), collect the fruit, then teleport to the Sell
and Seeds stands.

No build step. Three.js r128 is vendored in `vendor/`; everything else is plain ES modules.

## Play
Serve this folder and open it on your phone:

```
python3 -m http.server -d garden 8000      # then open http://<your-computer>:8000
```

Add it to your home screen for fullscreen. Progress saves on the device.

| | |
|---|---|
| **Move** | Put your left thumb down anywhere on the lower left: a thumbstick appears under it. WASD or arrows on a keyboard. |
| **Look around** | Drag on the right side to turn the camera, pinch (or scroll) to zoom. |
| **Plant** | Pick a seed in the hotbar, tap anywhere on your soil. Plants need a little room. |
| **Collect** | Walk up to ripe fruit: a **Collect** prompt pops up over it. Tap to pick one, hold to grab everything in reach (E or Space on a keyboard). You can also tap a ripe fruit that is close by. |
| **Sell / buy** | The **Seeds**, **Sell** and **Garden** buttons at the top teleport you. Seeds restock every 5 minutes; hold a buy button to buy many. |
| **Shovel** | The last hotbar slot. Tap a plant to dig it up. Tap a growing plant with nothing in hand to see how long it has left. |

## What's in it
- 15 crops from Carrot to Beanstalk across 7 rarities, each a voxel model with 6 growth stages: feathery carrot
  fronds, a little strawberry rosette with white flowers, a cloud-pruned blueberry bush, a blossoming apple tree, a grape pergola,
  a dragon fruit cactus draped over an old tyre, a beanstalk with a cloud on top. The starter crops are drawn small
  so a young garden stays neat. Berries, trees and vines keep fruiting; every fruit rolls its own size (giants are
  worth much more).
- You start with $20 and an empty garden: buy two carrots, grow and sell them, and that pays for your first
  Strawberry. Early crops fruit every few seconds (a Strawberry every 17, a Blueberry every 20).
- A steady climb after that, paced by simulation (`test/economy.mjs`) of a player picking about three fruit a
  second: a Blueberry about six minutes after the Strawberry, an Orange Tulip four minutes later, a Tomato six after
  that, and each seed after takes a little longer, about seven hours to the Beanstalk. Prices run from $10 to $20T.
  Carrots, Strawberries and Blueberries come ten or so to a restock; the rarer the seed, the more restocks it
  misses.
- Market Day every twelve minutes: the plaza puts up a maypole and bunting, two pop-up carts sell rarer seeds at a
  quarter off, and one crop you grow sells for triple. A chip under the top buttons counts down and takes you there.
- Weather and time: a day/night cycle with stars and lanterns, rain, snow and thunderstorms. They mutate fruit:
  Wet, Chilled, Frozen, Shocked (lightning, x100), Moonlit, Bloodlit, plus rare Gold (x20) and Rainbow (x50).
- A wordless tutorial: buy carrots, plant, grow, collect, sell, buy a Strawberry, go home. One objective chip, a bouncing arrow and
  glowing trail in the world, and a pointing hand that shows where to tap or which way to push the stick.
- A market plaza with the Seeds and Sell stands, up a short path from your garden. The title screen circles the
  whole island.
- Offline growth (up to 8 hours, and a signboard by your garden says so), autosave, generative music, sound effects
  and haptics.

## Code map
`src/voxel.js` voxel sets, the mesher (baked ambient occlusion), chunking, instanced batches ·
`src/models.js` every crop, fruit, stall and character as voxels · `src/world.js` the map, third-person camera,
movement and collisions, lighting, sky, weather, picking · `src/ui.js` HUD, joystick, the Collect prompt,
teleports, hotbar, shop sheets, tutorial · `src/island.js` the island's shape, cliffs and underside, the waterfall,
islets, clouds and cloud sea · `src/state.js` save data
and player actions · `src/sim.js` growth, weather, mutations, Market Day · `src/data.js` crop table, prices and
timings · `src/icons.js` voxel
icons for the UI · `src/audio.js` WebAudio synth · `src/main.js` boot and loop · `src/crash.js` shows what went wrong,
with Reload and Start over, instead of a frozen screen.

## Tests
`npm install`, then:
- `node test/play.mjs` plays a fresh game on an emulated iPhone with real input (tap planting and spacing,
  walking with the thumbstick, the Collect prompt, tap and hold collecting, the teleport buttons, selling,
  buying, the shop prompt, stall collisions, keyboard, camera drag, the island's edge, shovel, Market Day, rain,
  save/reload, the error screen) and checks every step.
- `node test/economy.mjs [runs]` simulates players from a fresh start (restocks, fruit sizes, mutations, weather
  and Market Day, all rolled like the game) and prints when each seed first becomes theirs. They pick about three
  fruit a second, the best first (ripe fruit waits on the plant), and go to the seed shop once a minute.
  `--attentive` picks everything the moment it ripens and shops the instant it can; `--casual` picks half as fast
  and shops every few minutes. `node test/economy.mjs --tune [runs]` re-derives every price and sell value so the
  gaps between seeds match its `TARGET` list.
- `node test/plants.mjs [out.png] ["crops=apple,corn&stages=2,3,4,5"]` renders crops side by side, lit like the
  game, for working on the plant models.
- `node test/gallery.mjs` screenshots a full garden by day, sunset, night, snow and storm.
- `node test/make-icon.mjs` regenerates `icon.png`.

`mockups/` holds the six art-style explorations this look was picked from.
