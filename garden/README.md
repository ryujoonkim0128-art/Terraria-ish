# Grow a Garden (phone version)

A flat, white-background pixel-art take on the Roblox game *Grow a Garden*, made for a phone screen.
No world, no atmosphere: just your plots, a seed shop, the weather and a sell button.

Serve this folder with any static server and open it on your phone (or in a narrow desktop window):

```
python3 -m http.server -d garden 8000     # then open http://<your-ip>:8000 on the phone
```

Add it to the home screen for a full-screen app. Progress saves to the browser and plants keep growing
for up to 8 hours while the page is closed.

## How to play
- **Seeds** opens the seed shop. Stock is random and restocks every 5 minutes; rare seeds are not always in.
- **Tap an empty plot** to plant a seed you own. Tap a growing plot to see the timer, water it, or dig it up.
- **Tap a ripe plot** (green tick) to harvest. Berries, tomatoes, trees and the like regrow; carrots and melons are one-off.
- **Sell** shows what you picked and sells it all for Sheckles.
- **Gear** sells a watering can (adds growth per use), sprinklers (place on a plot, boost the 8 plots around it for 5 minutes)
  and garden expansions, from 4x5 up to 6x7 plots. It also has the new game button.

## Weather and mutations
Rain, frost and thunderstorms roll in on their own for a minute or so. Rain speeds growth and makes ripe crops **Wet**,
frost makes them **Chilled**, both together give **Frozen**, and a thunderstorm can **Shock** one. Crops also have a
small chance to ripen **Gold** (x20) or **Rainbow** (x50), doubled next to a sprinkler. Multipliers stack the way they do in
the original: the growth mutation times the sum of the weather ones, times a bonus for heavy fruit.

## Code map
`src/data.js` crops, mutations, weather, gear and prices · `src/game.js` rules, timers, saving · `src/sprites.js` 3x5 bitmap
font and ASCII-drawn plant sprites · `src/ui.js` layout, touch input and the shop panels · `src/main.js` boot and frame loop.

Everything is drawn on one small canvas (about 130 logical pixels wide) that CSS scales up by a whole number, so pixels stay crisp.

## Tests
`npm install`, then `node test/smoke.mjs` runs the game headless at an iPhone viewport: it buys, plants, grows, harvests,
mutates, sells, expands and reloads, and saves screenshots to `test/shots/`. `node test/gallery.mjs` screenshots every crop.
