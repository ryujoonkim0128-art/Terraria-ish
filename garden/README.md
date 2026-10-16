# Grow a Garden (2D pixel art)

A top-down pixel-art farming game with the mechanics of *Grow a Garden*: buy seeds from Sam, plant them on your
soil beds, wait for them to ripen, harvest fruit with random weights, catch weather mutations, hatch pets from
eggs, and sell it all to Steven for Sheckles.

Run it by serving this folder with any static server and opening `index.html`:

```
python3 -m http.server -d garden 8000     # then open http://localhost:8000
```

`index.html#new` starts a fresh garden (ignores the save).

## Controls
| | |
|---|---|
| WASD / arrows | walk (hold Shift to run) |
| Left click / E | use the held item on the tile under the cursor; talk to a shopkeeper |
| 1–9, 0, -, = / wheel | pick a hotbar slot |
| B / Tab | backpack · P pets · H help · M mute |
| Hold T | fast-forward (x8) |
| Esc | close a panel |

## Mechanics
- **Shops.** Sam's seed shop (25 crops, Common to Prismatic) restocks every 5 minutes with random stock; Gus sells
  gear (watering can, trowel, favorite tool, harvest tool, cleaning spray, four sprinkler tiers, lightning rod,
  recall wrench); Edna sells seven kinds of eggs (restock every 10 minutes). Steven buys crops.
- **Growing.** Plants grow through four stages. Single-harvest crops (carrot, tulip, watermelon…) are removed when
  picked; multi-harvest crops (strawberry, blueberry, apple…) regrow their fruit. Each fruit gets a random weight;
  heavier fruit is worth more (price scales with weight squared). 1% of plants are Gold (x20), 0.1% Rainbow (x50).
- **Weather mutations.** Rain → Wet, Frost → Chilled (Wet + Chilled = Frozen x10), Thunderstorm → Shocked x100 via
  lightning strikes (rods attract them), Night → Moonlit, Blood Moon → Bloodlit, Meteor Shower → Celestial x120,
  Bee Swarm → Pollinated / Honey Glazed, Disco x125, Chocolate Rain → Choc, Tornado → Twisted, Heatwave → Burnt.
  Mutations stack: `price = base × weight² × variant × (1 + Σmultipliers − count)`.
- **Gear.** Sprinklers boost growth, fruit size and mutation chance in a radius for 5–10 minutes. The watering can
  speeds growth, the trowel moves plants, the favorite tool keeps crops from being sold, the harvest tool picks a
  3x3 area, the cleaning spray wipes mutations.
- **Pets.** Place up to three eggs in the garden; they hatch into one of 35 pets with abilities (digging up seeds,
  napping to grow nearby fruit, hatch speed, duplicating harvests, growth/mutation/variant auras, turning fruit Gold,
  ripening plants, refunds on sales…). Equip three at a time, feed them crops, and they level up over time.
- **Day/night** cycle with lanterns, fireflies and the occasional blood moon. The garden auto-saves and keeps growing
  (up to 2 hours) while you are away.

## Code map
`src/content.js` all data · `src/plants.js` plant/fruit sprites and mutation recolours · `src/sprites.js` tiles,
decor, stalls, people, pets, icons · `src/world.js` map and ground rendering · `src/game.js` rules and state ·
`src/render.js` scene, weather, lighting · `src/ui.js` HUD and panels · `src/font.js` bitmap font ·
`src/audio.js` synthesized sounds.

## Tests
`npm install`, then `node test/smoke.mjs` runs the game in headless Chromium: plants every crop, grows and
mutates them through all weather, harvests, sells, hatches eggs, opens every panel, saves and reloads, and writes
screenshots to `test/shots/`. `node test/play.mjs` plays through the real input path (keyboard walking to Sam,
clicking Buy, planting with the mouse, fast-forwarding with T, harvesting, selling to Steven).
`node test/sheet.mjs` renders every sprite to one sheet for art review.
