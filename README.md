# Wilderden

Version 0.8.0 is a mobile-first pet idle RPG/MMO for a trusted private group. It runs from GitHub Pages and uses Firebase's no-billing Spark plan for Email/Password and Google sign-in, private saves, the shared marketplace, and leaderboards.

No Cloud Functions, Firebase Storage, server, or Blaze billing plan is required.

## Start here

1. Follow [FIREBASE_SETUP.md](FIREBASE_SETUP.md).
2. Follow [GITHUB_SETUP.md](GITHUB_SETUP.md).
3. Open the published GitHub Pages URL and sign in. Existing saves migrate automatically when first loaded.

## Complete gameplay systems

- Playable Keeper with one personal idle timer plus up to six simultaneous pet assignments
- RPG-style Skill Book for all 14 leveled disciplines, including separate Melee, Ranged, and Magic progression
- Saved 1–24 hour combat patrols that keep resolving area encounters while the game is closed, with other pets free to Process or work at the same time
- Saved 1–24 hour Processing shifts that wait on an empty queue and automatically work through remains brought home by a simultaneous patrol
- Separate live hunts with attack timers, health bars, hit splats, damage and healing abilities, Auto-eat, optional Auto-harvest, capture decisions, and a battle log
- Persistent Keeper and pet injuries, 1% passive hourly regeneration, food and tonic healing, team/self-healing pets, and no permanent combat death
- Equipment screen, compact icon-grid Inventory & Storage, starter General Store, and craftable level-20 gear
- 50 original combat-capable species with unique production artwork
- Pet XP from every action, combat-stat growth from levels, 1–10 aptitude-based speed plus 25% burst yield, sacrifice XP, and five-star Condensing
- Condensing from two identical max-level pets into a level-1 next-star pet with an exact 10% stat bump per added star
- Woodcutting, Mining, Foraging, Fishing, Mischief, Processing, Cooking, Crafting, and Construction loops for Keeper and pets
- Food reserved for battle healing and post-battle capture offerings; work never consumes food
- Cooked-food capture attempts, failed/declined/patrol-harvest Processing, material and coin recovery, and no automatic pet drops
- Synthesized mobile-friendly sound effects for taps, attacks, abilities, criticals, healing, loot, victory, and defeat
- Permanent buildings, den and stack capacity, asynchronous dungeons, and chained dungeon crafting
- Unlimited pet trading with a 2% listing fee
- Saved 1, 2, 4, 8, 12, or 24-hour gathering, Mischief, Processing, and combat sessions with live cycle timers, session countdowns, progress bars, exact XP, and offline settlement

The exact mechanical rules are in [GAME_DESIGN.md](GAME_DESIGN.md).

## Root structure

Every shippable file stays directly in the repository root. `pets/` is the only content folder.

- `index.html`, `styles.css`, `app.js`, `sound-manager.js`, `auth-errors.js`, `logo.svg` — web game and branding
- `game-data.js`, `game-engine.js` — content and gameplay rules
- `firebase-client.js`, `firebase-config.js` — authentication, saves, and shared data
- `firestore.rules`, `firestore.indexes.json` — free Firebase backend protection
- `FIREBASE_SETUP.md`, `GITHUB_SETUP.md` — mobile-friendly deployment guides
- `GAME_DESIGN.md` — locked mechanics
- `PET_ART_GUIDE.md` and `PET_ART_PROMPTS.md` — production art standard and roster prompts

All 50 launch species have individual transparent PNG artwork named by species ID and optimized for mobile delivery.

## Private preview

Serve the root locally and open `?preview=1` on localhost:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/?preview=1`. Preview saves stay in that browser. The preview entrance is never visible on the production login page.

## No-billing security model

Firestore rules make each complete save readable and writable only by its signed-in owner. Marketplace listings and leaderboard rows are shared among signed-in players, and marketplace purchases use transactions so two buyers cannot normally purchase the same listing.

Because gameplay calculations run in the browser, a technically determined owner could alter their own save. This trusted-family model is appropriate for family and friends, but it is not cheat-proof and should not be opened as a competitive public MMO. A fully authoritative public version would require server code and a billing-enabled backend.

Never replace `firestore.rules` with `allow read, write: if true`.
