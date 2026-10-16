# Grow a Garden — pocket edition

A cozy 2D pixel-art take on the Roblox game *Grow a Garden*, built for phones. Plant seeds, watch them grow
(even while you're away), harvest, sell, and reinvest in rarer seeds, gear and pets.

Everything is drawn in code: no image files, no build step, no dependencies. The whole screen is rendered into a
small pixel buffer and scaled up by a whole number, so pixels stay perfectly crisp on any phone.

## Play
Serve this folder with any static server and open it on your phone:

```
python3 -m http.server -d garden 8000      # then open http://<your-computer>:8000 on the phone
```

Add it to your home screen for a fullscreen app (it ships a web manifest and icon). Progress saves on the device.

## How to play
| | |
|---|---|
| **Plant** | Pick a seed in the hotbar, then tap soil. Drag your finger across the soil to plant a whole row. |
| **Harvest** | Tap a ripe crop (ripe fruit sparkles), drag across several, or press **Harvest All**. |
| **Sell** | Tap the **SELL** stand (or your basket) and press **Sell All**. |
| **Shop** | **SEEDS** restocks every 5 minutes. **GEAR** has watering cans, sprinklers, a bigger basket and land. **EGGS** hatch into pets. Hold a buy button to buy repeatedly. |
| **Info** | Tap a growing plant to see how long it has left. |

## What's in it
- **15 crops** from Carrot to Beanstalk across 7 rarities. Some are one-shot harvests, others (berries, trees,
  vines) keep fruiting. Every fruit rolls its own weight; giant ones are worth much more.
- **Mutations** multiply a fruit's value: Wet and Chilled (rain/snow), Frozen, Shocked (lightning, x100),
  Moonlit and Bloodlit (night / blood moon), Pollinated, Gold (x20) and Rainbow (x50).
- **Weather and time**: a day/night cycle with sunsets and fireflies, plus rain, snow and thunderstorms that
  speed up growth or mutate fruit.
- **Gear**: watering can (2x growth for a minute), three sprinklers with different reach, bigger baskets,
  four garden expansions.
- **Pets**: 13 pets from 5 eggs. They roam your garden and help: faster growth, better prices, free seeds,
  pollinating, or turning fruit Gold or Rainbow.
- Offline growth (up to 8 hours), autosave, generative music and sound effects, haptics on Android.

## Code map
`src/data.js` crops, mutations, gear, pets, weather · `src/state.js` save data and every player action ·
`src/sim.js` growth, weather, mutations, pets · `src/art.js` all sprites (procedural pixel art) ·
`src/scene.js` the world: layout, sky, lighting, plants, particles · `src/ui.js` HUD, hotbar, shops, touch input,
tutorial · `src/font.js` bitmap fonts · `src/audio.js` WebAudio synth · `src/main.js` boot and loop.

## Tests
`npm install`, then:
- `node test/play.mjs` plays a fresh game on an emulated iPhone through real taps (plant, drag-plant, harvest,
  sell, shop, expand, sprinkler, watering, eggs, weather, save/reload) and checks each step.
- `node test/gallery.mjs` saves screenshots of many states and screen sizes to `test/shots/`.
- `node test/make-icon.mjs` regenerates `icon.png`.
