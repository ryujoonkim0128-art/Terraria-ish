# Underground base: progression loops (brainrot-tycoon style)

Design proposal, not implemented yet. The base-building half stays Hearthlands (you dig, wall and furnish
rooms by hand). The progression half borrows the Roblox "brainrot" tycoon formula (*Steal a Brainrot*,
*Grow a Garden* and similar): a conveyor of random collectibles, rarity tiers you can read from across
the room, income ticking up every second, slot pressure, stealing, a base lock, mutations, events and
rebirths.

The collectibles are **Dwellers**: silly cave creatures (moles, mushroom folk, glowbugs, rock crabs, lava
grannies) that live in your burrow and drip coins.

---

## The loops at a glance

| Timescale | Loop | What the player does | What it feeds |
|---|---|---|---|
| Seconds | **Cart Line** | Watch the cart track, buy the Dweller you want before a rival does | Dwellers |
| Seconds | **Collect** | Walk over each chamber's coin plate to bank what piled up | Coins |
| Minutes | **Dig & Furnish** | Carve new chambers, place Pods, make rooms cozy | Slots, multipliers |
| Minutes | **Swap** | Sell the weakest Dweller to make room for a better one | Income per slot |
| Minutes | **Raid & Defend** | Steal Dwellers from rival burrows, lock your vault, fight off thieves | Dwellers, risk |
| ~20 min | **Events** | Be online and nearby when a Grotto Bloom or Lava Surge rolls in | Mutations, rare spawns |
| Hours | **Delve (rebirth)** | Wipe the base for a permanent multiplier and a deeper biome | Everything |
| Forever | **Dwellerdex** | Fill out every Dweller × mutation | Small permanent bonuses |

Each loop hands a resource to the next one. The minute-to-minute choice that keeps the game moving
is always the same one: **"Is the thing on the cart better than my worst Pod?"**

---

## 1. Cart Line (the conveyor)

- An ore-cart rail runs along a shared tunnel, the **Trade Tunnel**, past your base entrance and past the
  rival burrows' entrances. A cart rolls by every 4–6 s with one Dweller riding it. The cart has a price
  tag above it, and its rarity shows as a coloured light beam and a sound sting.
- Walk up and press **E** to buy it. The Dweller hops off and walks home to your nearest free Pod. If
  every Pod is full, the buy button is greyed out with the label "No free Pod".
- **Rival NPCs buy too.** Each rival burrow has a buyer who walks the tunnel and grabs carts by a simple
  rule (cheapest one it can afford, with a strong bias toward Epic+). So a Legendary cart is a race.
  This is what gives the conveyor its tension in single player.
- Announcements: Legendary and better carts get a screen banner ("A **LEGENDARY** Glimmermole is rolling
  down the Trade Tunnel!") a few seconds before they show up, so the player can run over.
- An unbought cart leaves at the far end. Nothing is lost except the chance.

**Upgrades (bought with coins at the Cart Lever by your entrance):**
- *Cart Luck*: shifts the rarity table up a little. 10 levels, cost goes up ×3 per level.
- *Brake Lever*: stops one cart in front of your door for 10 s. 90 s cooldown.
- *Second Track* (late game): your own private rail with fewer carts and no rival buyers.

### Rarity table

Income per tier goes up about ×4. Payback time (price ÷ income) grows with tier, so a top Dweller takes
real saving up for, while a common one pays for itself in half a minute.

| Tier | Beam | Cart odds | Income/s | Price | Payback |
|---|---|---|---|---|---|
| Common | grey | 60% | 1–3 | 30–90 | 30 s |
| Uncommon | green | 25% | 8 | 400 | 50 s |
| Rare | blue | 10% | 30 | 2.4k | 80 s |
| Epic | purple | 4% | 120 | 18k | 2.5 min |
| Legendary | gold | 0.9% | 500 | 150k | 5 min |
| Mythic | red | 0.1% | 2.5k | 1.5M | 10 min |
| Deepborn (secret) | black/rainbow | events only | 15k | 25M | 28 min |

### Starter roster (tone: silly but on-palette)

| Tier | Dwellers |
|---|---|
| Common | Pebbleboi, Dirt Nibbler, Wormy Gary, Pocket Mole |
| Uncommon | Moss Gremlin, Lantern Bat, Tunnel Tim |
| Rare | Sir Burrowsworth (top hat), Crystal Crab, Shroomboy Supreme |
| Epic | Glimmermole, Fungustus the Damp, Anvil Toad |
| Legendary | Grandma Magma, The Ore Baron, Glowbug Choir (one Pod, five bugs) |
| Mythic | King Under the Hill, Stalactite Steve |
| Deepborn | The Thing in the Well, Mole Who Saw the Core |

If we want the meme flavour turned all the way up, the names can be pseudo-Italian in the brainrot
style (*Scavatore Talpino*, *Fungolino Bagnato*). That is a tone decision to make before the art pass.

---

## 2. Collect

- Every Pod has a coin stash that fills at the Dweller's income rate. Each **chamber** has one **Coin
  Plate**. Stepping on it banks the stash of every Pod in that chamber, with a coin fountain and a
  rising "+12,400" number.
- Stash cap: 5 minutes of income by default, upgradeable to 8 hours. This one number does three jobs:
  - It pulls the player around their own base (walking past what they built).
  - It turns into **offline earnings** (the cap is what's waiting when they come back).
  - It is a thief target (see §5: thieves can rob a full stash, not just Dwellers).
- Late upgrade: *Coin Chute*. Coins roll down a pipe to one central plate, so a 6-floor base doesn't
  become a chore.

---

## 3. Dig & Furnish (the actual base building)

Coins buy Dwellers, but **slots are dug**. That way the existing mining and building systems stay the
backbone, and the tycoon layer sits on top of them.

- **Pod**: new furniture (2×2, floor mount), crafted at the workbench from stone and coins. One Dweller
  per Pod.
- **Chamber**: any enclosed room that passes a variant of `checkHome` in `src/housing.js` (back wall,
  light, enclosed). One Coin Plate per chamber. The chamber size sets how many Pods are allowed:
  24–60 tiles → 2 Pods, 61–150 → 4, 151–300 → 8.
- **Floors**: the base goes *down*. Each floor deeper sits in harder stone and needs the next pickaxe
  tier, so digging is the gate: Floor 1 dirt (any pick), Floor 2 stone (copper), Floor 3 deep stone
  (iron), Floor 4 crystal (silver), and so on. Deeper floors get a flat **Depth bonus** (+10% income per
  floor) for the Dwellers on them, which pushes players to keep digging instead of sprawling sideways.

### Comfort: why building well pays

Each chamber gets a Comfort score from what's in it. It multiplies the income of every Pod in the
chamber. This is the hook that makes base-building a progression system and not just a slot count.

| Source | Comfort |
|---|---|
| Passes the room check (back wall, light, enclosed) | ×1.0 baseline (fails → ×0.5) |
| Each different decoration type (banner, plant, bookshelf, shelf…) | +5%, up to +40% |
| Brick or plank back wall instead of dirt | +10% |
| Matching **habitat** for the Dwellers in it (below) | +25% |
| Overcrowded (more Pods than the size allows) | not allowed |

**Habitats and synergies.** Each Dweller has one liked object or tile, which gives a reason to build
themed rooms:
- Lantern Bat and Glowbug Choir: no torches needed; they *are* the room's light.
- Anvil Toad and The Ore Baron: +25% next to an anvil or furnace.
- Shroomboy Supreme and Fungustus: +25% in a chamber with glowshroom tiles.
- Grandma Magma: +50% if the chamber touches lava, but sets wooden furniture on fire.
- Sets: three Dwellers from the same family in one chamber (the Mole family, the Fungus family) give
  +30% to all three.

---

## 4. Swap (slot pressure)

- Right-click a Dweller → **Sell** for 50% of what it cost. Selling the weakest to make room for a new
  buy is what keeps players going back to the cart line.
- **Pick Up**: carry a Dweller to another Pod (to fix habitat matches). While carrying, you walk at 70%
  speed and can't climb ladders quickly. The same rule applies when stealing.

---

## 5. Raid & Defend (stealing, PvE version)

This is the loop that sets *Steal a Brainrot* apart from a plain idle tycoon. We already have
theft detection, guards, alarms and grudges in `src/game.js` and `src/ai.js`.

### You steal
- Rival burrow villages (the burrow villages from worldgen) each run a base of their own, with Pods,
  Dwellers and a Vault Door, and they buy from the same Cart Line.
- Sneak in, pick up a Dweller and carry it back to a free Pod of yours. If anyone sees you, it's theft:
  the village grudge goes up, guards chase you, and getting hit makes you drop the Dweller, which runs
  back home.
- Stolen Dwellers are **Hot** for 10 minutes: they earn nothing until they "settle in", and the rival
  village sends a retrieval party for them. So you have to defend what you stole.

### You defend
- **Vault Door** on your base entrance (new object). Press the button by the door: it locks for 60 s,
  then needs 120 s to recharge. Upgrades make the lock longer and the recharge shorter. Nothing gets
  in while it's locked, and that includes you if you're outside.
- **Thieves**: rival thieves come in waves. How often depends on that village's grudge against you (so
  stealing a lot causes more raids). At night, wolves (they already hunt the surface) can also wander
  in and scare Dwellers off their Pods.
- A thief takes the most valuable Dweller it can reach, or empties a full stash. Hit it to make it drop
  what it's carrying.
- **Defences** (late game): guard Dwellers (some Dwellers have *Bouncer*, which stuns a thief on contact),
  trap plates, a settler guard hired through the existing housing/settler system.

Grudge is the risk dial. Steal and raids go up. Gift and buy legitimately and the tunnel stays quiet.
The game already has this, so the tycoon layer gets a social cost for free.

---

## 6. Mutations & events

A mutation is a coloured skin on a Dweller that multiplies its income. A Dweller can be **born** with
one (a small chance on any cart) or **catch** one during an event while it sits in a Pod.

| Mutation | Look | Income | Base chance on a cart |
|---|---|---|---|
| Mossy | green fuzz | ×1.5 | 5% |
| Gilded | gold | ×2 | 2% |
| Crystal | translucent blue | ×3 | 0.5% |
| Glowing | emits light | ×4 | events only |
| Molten | cracked lava skin | ×6 | events only |
| Void | starfield silhouette | ×10 | events only, rarest |

Mutations don't stack on one Dweller, except **Void**, which can be added on top of any other mutation.
That gives the very long-term players something to chase.

**Events** (one every ~20 min, announced 60 s ahead, last 3 min):
- *Grotto Bloom*: glowing grottos flare up. Dwellers in chambers lit by a grotto may catch **Glowing**.
  More Shroom-family carts.
- *Lava Surge*: lava rises a few tiles on deep floors. Dwellers in chambers next to lava may catch
  **Molten**, but unprotected wooden furniture burns.
- *Gold Rush*: every cart is Gilded for 60 s. Rivals buy aggressively.
- *The Hollow Wakes* (rare, deep floors only): the only way **Deepborn** carts and **Void** appear.

Events tie the tycoon layer back into the world. Base placement (near a grotto, near lava) becomes a
strategic choice made on the first day.

---

## 7. Delve (rebirth)

When the base is maxed out on its layer, the player **Delves**: they collapse the burrow and re-found it
one layer deeper.

- **Cost**: a coin amount *plus* specific Dwellers sacrificed (like *Steal a Brainrot* rebirths). For
  example, Delve 1 costs 1M coins + 1 Legendary, and Delve 2 costs 10M + Grandma Magma + any Mythic.
  Asking for named Dwellers sends players back to the cart line and to raiding with a clear target.
- **You lose**: coins, all Dwellers, upgrades bought with coins.
- **You keep**: the dug-out base and its furniture (losing hand-built work feels bad in a building game),
  the Dwellerdex, pickaxe tiers.
- **You gain**:
  - A permanent income multiplier (+50% per Delve, additive).
  - A new **Trade Tunnel layer** with a new Cart Line pool. Layer 1 Topsoil, Layer 2 Mushroom Grotto,
    Layer 3 Crystal Caverns, Layer 4 Magma Deep, Layer 5 The Hollow. Each layer adds a new Dweller
    family and raises the rarity floor.
  - One permanent perk picked from three: +1 Pod per chamber, longer Vault lock, carry speed, Cart Luck
    +2, starting coins, a longer stash cap.
- The new layer's rival burrows are tougher (more guards, faster thieves, better Dwellers to steal).

| Delve | Coin cost | Dweller cost | Unlocks |
|---|---|---|---|
| 1 | 1M | any Legendary | Mushroom Grotto, Shroom family, Grotto Bloom event |
| 2 | 10M | Grandma Magma + any Mythic | Crystal Caverns, Crystal mutation on carts |
| 3 | 100M | 2 Mythics, one Gilded | Magma Deep, Lava Surge event, Molten |
| 4 | 1B | any Deepborn | The Hollow, Void mutation, Second Track |

---

## 8. Dwellerdex (collection)

- A book that fills a page per Dweller and a stamp per mutation seen on it.
- Small permanent bonuses: complete a family's page for +5% income from that family. Every 10 stamps
  give +1% global income. Complete a whole layer's roster to unlock a cosmetic for the Vault Door.
- This is the "one more" loop for players who have outgrown the money numbers.

---

## Income formula

```
income/s = base(tier, species)
         × mutation
         × comfort(chamber)          // 0.5 – ~2.0
         × (1 + 0.10 × floorDepth)
         × (1 + 0.50 × delves)
         × (1 + dexBonus)
         × (hot ? 0 : 1)
```

Numbers are written as 1.2k, 3.4M, 5.6B, 7.8T. They should get big, which is half the fun of the genre.

---

## A first session, minute by minute

1. **0:00**: A settler gives you a starter Pebbleboi and a Pod. You dig a small room under your
   homestead, wall it, add a torch, and place the Pod. Pebbleboi earns 1/s.
2. **0:02**: You walk to the Trade Tunnel and buy two Commons. The first Coin Plate fountain plays.
3. **0:08**: The room is full. You dig a second chamber, a bigger one, and the four-Pod limit teaches
   chamber sizes. A banner and a plant teach Comfort.
4. **0:15**: A Rare Crystal Crab shows up and a rival buyer beats you to it. Now you know rivals buy.
5. **0:20**: You sell a Common to fit an Uncommon. Slot pressure has started.
6. **0:30**: You need copper for Floor 2. Mining comes back into the loop.
7. **0:45**: You see the Crystal Crab on a rival's Pod and steal it. Guards chase you, and you make it
   back. It's Hot for 10 min, and that night a thief comes for it. You learn to lock the Vault Door.
8. **1:30**: You hit the first Grotto Bloom. A Glowing Dweller shows players why base placement matters.
9. **3:00+**: You save toward the first Legendary, working toward Delve 1.

---

## How this maps onto the current code

| Need | Starting point |
|---|---|
| Pod, Coin Plate, Vault Door, Cart Lever objects | add to `OBJ` in `src/content.js` (the `minecart` Ore Cart sprite already exists) |
| Chamber detection + Comfort | generalise `checkHome` in `src/housing.js` into a `checkChamber` that returns size and decorations |
| Dweller AI (walk home, idle on Pod, flee wolves) | a new small walker in `src/ai.js`, reusing `src/path.js` |
| Stealing, alarms, guards chasing | `theft()` and grudge handling in `src/game.js` |
| Rival bases | give `burrowVillage` in `src/villagegen.js` a Pod room and a Vault Door |
| Trade Tunnel + cart spawns | a worldgen pass in `src/worldgen.js` linking the burrows underground |
| Coin HUD, banners, Dwellerdex | `src/ui.js` |

**Suggested build order** (each step is playable on its own):
1. Pods + Dwellers + Coin Plates + one Cart Line with fixed odds.
2. Chamber sizes, Comfort, Depth bonus.
3. Rival buyers on the Cart Line.
4. Stealing + Vault Door + thieves.
5. Mutations + one event (Grotto Bloom).
6. Delve 1 + Dwellerdex.

## Open questions
- Tone: in-world silly names, or full pseudo-Italian meme names?
- Do coins replace the existing `coin` item, or is the tycoon currency separate from villager trading?
- Should Delve keep the hand-built base (proposed here) or wipe it like the Roblox games? Keeping it
  respects the building half. Wiping it makes each layer a fresh build.
- Multiplayer later? Everything here is PvE, but the Vault Door and stealing would carry over to real
  PvP as is.
