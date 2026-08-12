# Pet Idle MMO

Version 0.3.0 is a complete pet-driven idle MMO for a small private group. It runs directly from GitHub Pages and uses Firebase's no-billing Spark plan for Email/Password and Google sign-in, private saves, the shared marketplace, and leaderboards.

No Cloud Functions, Firebase Storage, server, or Blaze billing plan is required.

## Start here

1. Follow [FIREBASE_SETUP.md](FIREBASE_SETUP.md).
2. Follow [GITHUB_SETUP.md](GITHUB_SETUP.md).
3. Open the published GitHub Pages URL and sign in.

## Gameplay included

- 50 original species across five regions
- All pets combat-capable
- Woodcutting, Mining, Foraging, Fishing, Mischief, Processing, Cooking, Crafting, Construction, Combat, and Pet Mastery
- Six simultaneous ordinary pet assignments
- Three-pet continuous auto-combat
- Rarity-tier hunt gates and dungeon-only species
- Cooked-food capture attempts
- Failed or declined capture Processing
- Pet leveling, sacrifice XP, and five-star Condensing
- Permanent buildings, den capacity, and storage capacity
- Asynchronous dungeons
- Dungeon-drop crafting chain leading to the Prismatic Beacon
- Unlimited pet trading with a 2% listing fee
- Offline assignment settlement capped at eight hours

## Root structure

Every shippable file stays directly in the repository root. `pets/` is the only content folder.

- `index.html`, `styles.css`, `app.js`, `auth-errors.js` — web game
- `game-data.js`, `game-engine.js` — content and gameplay rules
- `firebase-client.js`, `firebase-config.js` — authentication, saves, and shared data
- `firestore.rules`, `firestore.indexes.json` — free Firebase backend protection
- `FIREBASE_SETUP.md`, `GITHUB_SETUP.md` — mobile-friendly deployment guides
- `GAME_DESIGN.md` — locked mechanics
- `PET_ART_GUIDE.md` — production art standard

The approved Ash Raccoon illustration is deliberately used for all 50 species until their individual art is created.

## Private preview

To test without Firebase, serve the folder locally and open `?preview=1` on localhost:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/?preview=1`. Preview saves stay in that browser and the preview entrance is never shown on the production login page.

## No-billing security model

Firestore rules make each complete save readable and writable only by its signed-in owner. Marketplace listings and leaderboard rows are shared among signed-in players, and marketplace purchases use transactions so two buyers cannot purchase the same listing normally.

Because gameplay calculations run in the browser, a technically determined owner could alter their own save. This trusted-family model is appropriate for a small game among family and friends, but it is not cheat-proof and should not be opened as a competitive public MMO. A fully authoritative public version would require server code and therefore a billing-enabled backend.

Never replace `firestore.rules` with `allow read, write: if true`.
