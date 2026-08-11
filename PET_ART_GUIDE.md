# Pet art production guide

The approved Ash Raccoon in `pets/ash-raccoon.png` is the visual benchmark.

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

After adding an image, set that species' final `art` argument in `game-data.js` to the matching relative path.

