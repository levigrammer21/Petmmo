# Changelog

## 0.5.0 — Complete launch bestiary

- Added unique production artwork for all 50 launch species across Greenhollow, Copperwood, Sunscar Basin, Stormreach, and Starfall Expanse.
- Preserved the approved clean, almost-cute creature-collector style while giving every species its own silhouette, pose, palette, and elemental identity.
- Converted the new art to transparent PNGs and optimized the files for mobile loading.
- Replaced the global Ash Raccoon fallback with automatic species-ID art paths.
- Added automated coverage checks so every roster entry must have a matching image file.

## 0.4.0 — Living idle timers and combat

- Added a live work queue to Overview, Activities, Kitchen & Craft, Processing, and Construction.
- Added smooth per-action countdowns, cycle progress bars, quarter markers, and completed-action totals without increasing Firestore write frequency.
- Added skill XP bars with visible level 1/20/40/60/80/100 milestones and next-action unlock guidance.
- Rebuilt Combat as a persistent battle screen rather than an instant result.
- Added independent attack countdowns, manual attack meters, current/max health, hit splats, critical and ability labels, meal-heal splats, and a rolling battle log.
- Lengthened visible combat to a minimum of 14 seconds and a maximum of 45 seconds while preserving the engine's speed relationships.
- Removed pet attack movement animations; combat feedback comes from timers, health changes, hit flashes, and hit splats.
- Prevented Firebase save listeners from replacing the combat screen before playback finishes.

## 0.3.0 — No-billing Firebase rebuild

- Removed the Cloud Functions, Cloud Build, Artifact Registry, and Firebase Storage deployment requirements.
- Moved den initialization, idle settlement, gameplay actions, combat, captures, dungeons, and marketplace operations into browser-side Firestore transactions.
- Added owner-only Firestore save writes and owner-published leaderboard rows.
- Added a two-stage marketplace sale that prevents normal double purchases and safely delivers seller coins on their next live session.
- Kept Google and Email/Password sign-in on the Spark plan.
- Replaced backend deployment errors with mobile-friendly Firestore setup messages.
- Added a one-command Cloud Shell deployment path for rules and indexes only.
- Documented the trusted-family security tradeoff: accounts remain private, but gameplay is not cheat-proof without a paid authoritative server.

## 0.2.1 — Authentication repair

- Corrected every Cloud Functions Firestore reference to use the Admin SDK's collection/document API, allowing new player saves and leaderboards to initialize after Google or email sign-in.
- Removed duplicate player-initialization calls during Google sign-in and account creation.
- Made returning authenticated sessions reliably resume initialization after Firebase finishes loading.
- Added clear, actionable authentication messages instead of exposing `internal` and `auth/invalid-credential` errors.
- Added disabled/loading states while account actions are running to prevent double submissions.

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
