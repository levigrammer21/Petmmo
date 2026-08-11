# Pet Idle MMO

Version 0.2.0 is a complete pet-driven idle MMO build for a small private group.

The game runs directly from GitHub Pages. Firebase supplies Email/Password and Google authentication, authoritative saves, real-time marketplace listings, leaderboards, and secure game actions.

## Play locally

Because the client uses JavaScript modules, serve the folder instead of double-clicking `index.html`:

```bash
python3 -m http.server 8000
```

Open `http://localhost:8000/?preview=1`. The private preview route works only on localhost, opens directly into the game, and stores its save only in that browser. It is never exposed as a control on the production login screen.

## Connect the shared world

Follow [FIREBASE_SETUP.md](FIREBASE_SETUP.md), then [GITHUB_SETUP.md](GITHUB_SETUP.md).

## Gameplay included

- 50 species across five regions
- All pets combat-capable
- Woodcutting, Mining, Foraging, Fishing, Mischief, Processing, Cooking, Crafting, Construction, Combat, and Pet Mastery
- Six simultaneous ordinary pet assignments
- Three-pet continuous auto-combat
- Rarity-tier hunt gates and dungeon-only species enforcement
- Cooked-food capture attempts
- Failed or declined capture Processing
- Pet leveling, sacrifice XP, and five-star Condensing
- Permanent buildings, den capacity, and storage capacity
- Asynchronous dungeons
- Dungeon-drop crafting chain leading into the endgame Prismatic Beacon
- Unlimited pet trading with atomic marketplace transactions
- Offline assignment settlement capped at eight hours

## Root structure

All application and Firebase files remain directly in the repository root. `pets/` is the only content folder.

Important files:

- `index.html`, `styles.css`, `app.js` — web game
- `game-data.js`, `game-engine.js` — content and deterministic rules
- `firebase-client.js`, `firebase-config.js` — browser Firebase integration
- `functions.js` — authoritative backend
- `firestore.rules`, `storage.rules`, `firestore.indexes.json` — backend protection
- `FIREBASE_SETUP.md`, `GITHUB_SETUP.md` — deployment checklists
- `GAME_DESIGN.md` — locked mechanics
- `PET_ART_GUIDE.md` — production art standard

The approved Ash Raccoon illustration is included in `pets/` and is intentionally used for every pet until the remaining 49 production illustrations are created. No letter tiles, emoji creatures, or mismatched generic icons appear in their place.

## Security model

The browser cannot write player saves, listings, currency, pets, XP, or inventory directly. It can only read the signed-in player's save and shared read-only data. All mutations execute through authenticated Cloud Functions using Admin transactions.

Do not weaken `firestore.rules` for convenience.
