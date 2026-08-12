# Changelog

## 0.8.0 — True idle sessions and combat patrols

- Replaced endless food-fed gathering with explicit 1, 2, 4, 8, 12, and 24-hour saved sessions for both pets and the Keeper.
- Removed food, nutrition, work-speed meal bonuses, and pantry stops from every gathering and production assignment. Meals are now battle healing and post-battle capture offerings only.
- Added persistent combat patrols that occupy up to three selected pets, continue while the browser is closed, preserve injuries, optionally Auto-eat, and automatically send victories to Processing.
- Added persistent 1–24 hour Processing shifts: a selected pet waits on the queue, processes patrol remains as they arrive, and works concurrently with the combat party.
- Kept one-off live hunts as the animated-feeling combat mode with independent attack meters, hit splats, battle sounds, and manual capture decisions.
- Added 1% maximum-health regeneration per full hour, plus the buildable Resting Hollow regeneration bonus.
- Added self-healing and team-healing combat abilities to Brook Otter, Dawn Koi, Oasis Crane, and Worldroot Elk.
- Reduced the starter Ash Raccoon's Mischief aptitude from 8 to 4; it remains a mild Mischief specialist rather than an endgame worker.
- Isolated live timer boards by screen, so Processing shows Processing jobs instead of unrelated gathering and Mischief assignments.
- Removed the starter raccoon from login, overview, fallback, and empty-combat branding; raccoon art now appears only when an actual Ash Raccoon is involved.
- Reworked the logo into a species-neutral den-and-leaf canopy mark.
- Simplified the mobile header to coins, active workers, storage, and Keeper health; account and sound controls moved into the navigation drawer.
- Rebalanced low-level action times for long idle sessions and strengthened meal healing so combat food has a clear purpose.
- Expanded automated coverage to 39 gameplay, patrol, offline, healing, migration, UI, security, and art tests.

## 0.7.0 — Wilderden identity and passive wilds

- Renamed the game to Wilderden and added a scalable original den-and-tail logo.
- Replaced exact enemy selection with weighted, level-gated area encounters.
- Added Auto-hunt, Auto-eat, and Auto-harvest controls for continuous combat.
- Auto-harvested victories now enter the real Processing queue; Processing awards materials and coins.
- Rebuilt Inventory as a compact, colored icon grid with item detail actions.
- Rebuilt Skills as an RPG-style skill book with prominent levels and exact XP remaining.
- Added synthesized UI, attack, ability, critical, healing, loot, victory, and defeat sounds with a persistent toggle.
- Expanded the interface palette while preserving the clean, readable mobile layout.

## 0.6.0 — Playable Keeper and full progression rebuild

- Made the Keeper a playable worker across gathering, Mischief, Cooking, Crafting, Processing, and Construction with one independent idle timer alongside six pet assignments.
- Added Keeper-only and mixed-party live combat plus Melee, Ranged, and Magic skills.
- Added persistent Keeper and pet health, downed-state restrictions, combat injury persistence, meals, Pet Tonics, and Keeper Tonics.
- Added a dedicated Equipment screen and full category-filtered Inventory & Storage screen.
- Added a dedicated Skills screen with all 14 level bars, milestone markers, and XP totals.
- Added the General Store with starter food, medicine, tools, three combat styles, and basic armour.
- Added craftable level-20 Melee, Ranged, Magic, and body equipment.
- Reworked aptitudes to 1–10 speed-and-yield ratings. Any pet can attempt any unlocked task, including high-tier work; pet level no longer blocks work.
- Made every pet action grant pet XP and restored the health gained when a living pet levels.
- Rebuilt Condensing to require two identical max-level same-star pets, then reset the survivor to level 1 at the next star and grant an exact 10% base-stat bonus per added star.
- Added automatic schema-v2 migration for existing saves without losing pets, items, coins, buildings, or skill progress.
- Expanded automated coverage to 29 gameplay, security, migration, timer, combat, store, equipment, and art tests.

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
