# Wilderden 2.0.1

Clean rebuild. Upload **all root files** to the root of the existing GitHub Pages repository. The **only nested folder is `pets/`**, containing the 50 creature PNGs.

## Core design
- 50 creatures = 50 enemies = 50 obtainable pets.
- Live combat with Melee / Ranged / Magic triangle, smooth meters, hit splats, hit chance, crit chance, max hit.
- Egg drops: Common 1/125, Uncommon 1/200, Rare 1/350, bosses 1/500.
- 12-hour offline cap for every started idle activity and combat.
- Up to 2 pet workers at once.
- Woodcutting, Mining, Fishing, Crafting, Cooking, Mischief plus Hitpoints, Attack, Defence, Strength, Ranged, Magic.
- Ten material tiers: Wood, Stone, Iron, Bronze, Silver, Gold, Diamond, Platinum, Titanium, Void.
- Crafting is the single production skill.
- NPC starter shop and Firebase-backed player item marketplace.
- Dungeoneering is intentionally not implemented yet.

## Firebase
This release reuses the existing Firebase project `petmmo-158f7`. It writes the new game to `v2Players` and `v2MarketListings`, leaving old save collections untouched. Deploy `firestore.rules` and `firestore.indexes.json` after replacing repository files.

## Test
`npm test` runs the data/economy/combat invariants. No build step is required for GitHub Pages.
