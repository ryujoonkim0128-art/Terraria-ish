# Lanternfall

A survival roguelite set in the Hearthlands. The sun has not risen in nine days: carry the last lantern through a
ten-minute night while the dark swarms you, and keep it burning until dawn. One self-contained HTML file, no build step.

Open `index.html` in a browser, or serve the folder (`python3 -m http.server -d lanternfall 8000`).

## Controls
| | |
|---|---|
| WASD / arrows, or drag on a touch screen | move |
| (automatic) | every weapon fires on its own |
| 1–4, click | pick a level-up boon |
| R | reroll the boons (needs a Tavern) |
| Esc / P | pause |
| M | mute |

## The loop
- **Seconds:** kill, gems burst out and fly into your lantern light with rising chimes.
- **Half a minute:** level up and choose one of three boons: a new weapon, an upgrade or a passive.
- **Minutes:** the story advances. Bat swarms, rings of ghouls, elites that drop chests, the Alpha Wolf at 5:00 and
  the Moon-Eater at 9:00. Dawn comes at 10:00.
- **Across runs:** every ember you gather is kept. Spend embers to rebuild the village for permanent bonuses. Goals
  unlock five more bearers, each with their own starting weapon. Surviving a night unlocks a darker one (up to Night 10).

## Content
- 7 weapons, each with 8 levels and an evolution: max the weapon, hold its paired passive, then open a chest.
  Ember Bolt + Whetstone, Lantern Glow + Hearty Stew, Whirling Axes + Tallow Candle, Shepherd's Sickle + Swift Boots,
  Firebomb + Bellows, Storm Bell + Lodestone, Watch Pike + Quiver.
- 11 passives, 6 bearers, 6 creature types plus elites and 2 bosses, 13 village buildings, 18 goals.
- Braziers along the way break open for food, embers, a magnet or a storm bell that clears the screen.

## Design notes
The pull comes from the play itself: short runs, constant small rewards, build discovery and fast restarts. There
are no daily streaks, timers or anything that punishes you for stepping away. Progress is saved in the browser's
local storage.
