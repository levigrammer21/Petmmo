# Changelog

## 0.2.0 — Full product presentation

- Locked login and game into mutually exclusive full-viewport states so game UI can never appear beneath the login screen.
- Removed every visible development and local-test control from the production experience.
- Added a localhost-only private preview route for development without weakening production presentation.
- Rebuilt account access around a polished Sign in/Create account switch with context-correct fields and actions.
- Replaced all letter-tile pet placeholders with the approved Ash Raccoon artwork until each final creature illustration is ready.
- Improved internal scrolling so login, game content, navigation, and status panels remain contained at desktop and mobile sizes.

## 0.1.0 — Core game systems

- Added Firebase Email/Password and Google sign-in integration.
- Added locked Firestore and Storage rules.
- Added authoritative callable functions for saves, actions, combat, captures, Condensing, sacrifice XP, dungeons, and unlimited marketplace trading.
- Added 50 original launch species definitions across five progression regions.
- Added six-pet active assignment limit and three-pet combat parties.
- Added gathering, Mischief, Cooking, Crafting, Processing, Construction, and offline settlement.
- Added recovery-safe multi-meal Cooking batches so an empty pantry can never lock the account.
- Added continuous attack-meter combat with abilities, affinities, healing food, capture decisions, and Processing fallback.
- Added rarity-tier hunt unlocks, direct-hunt protection for dungeon species, den-full capture protection, and a keep-one-pet marketplace safeguard.
- Added asynchronous dungeons with power and affinity-based success chance.
- Added chained dungeon materials, den and storage expansion, one-time permanent structures, and the endgame Prismatic Beacon.
- Added the approved Ash Raccoon production artwork and full pet-art specification.
- Added private local simulation support for development before Firebase deployment.
