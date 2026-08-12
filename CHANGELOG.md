# Changelog

## 1.0.0 — Full idle-RPG rebuild

- Rebuilt Wilderden around continuous Melvor-style idle actions instead of fixed work sessions.
- Removed combat patrols, combat duration pickers, return timers, search countdowns, patrol reports, and separate one-off live hunts.
- Added one persistent Keeper assignment and up to six independent persistent pet worker assignments.
- Preserved the full 50-species roster, affinities, stats, abilities, passives, aptitudes, regions, and approved art paths.
- Rebuilt combat as a persistent live battle that immediately chains into the next enemy and continues offline.
- Added persistent combat injuries, automatic food use, direct healing for downed pets, and edible raw berries/root vegetables/embercaps.
- Made Processing a roughly 10-second continuous remains loop rather than a long saved shift.
- Converted dungeons into live boss fights and lowered the early progression wall.
- Kept gathering, Mischief, Cooking, Crafting, Processing, equipment, permanent den upgrades, regions, and pet taming while removing marketplace/condensing/session-management clutter from the core UI.
- Added responsive desktop/sidebar and mobile/bottom-navigation interfaces designed around quick idle-game decisions.
- Kept Firebase Authentication and private Firestore saves with local-device fallback.
