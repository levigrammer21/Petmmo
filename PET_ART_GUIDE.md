# Pet art production guide

The approved Ash Raccoon in `pets/ash-raccoon.png` established the visual benchmark. The complete 50-species launch set is now implemented in `pets/`.

Every remaining pet should use:

- Original 2D creature-collector illustration
- Clean, tapered, dark-colored outlines
- Flat color with restrained two-step cel shading
- Slightly oversized head and expressive face
- Appealing, almost-cute proportions without becoming babyish or chibi
- A capable, combat-ready full-body pose
- Strong silhouette that remains readable on small cards
- Transparent background with generous padding
- No clothing, equipment, logo, text, frame, scenery, or cast shadow unless a species design specifically requires it

Master files should preserve transparent alpha. Use the filename matching the species ID from `game-data.js`, for example:

```text
pets/moss-hare.png
pets/stoneback-boar.png
pets/brook-otter.png
```

`game-data.js` derives each asset path from its species ID, so new species automatically resolve to `pets/<species-id>.png`.
