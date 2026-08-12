# Pet art prompt manifest

The launch bestiary was produced in built-in image-generation mode, using the approved Ash Raccoon only as a visual-style reference.

## Shared production prompt

> Create one brand-new original creature asset for the web game Wilderden, using the supplied Ash Raccoon only as a visual style benchmark—not as anatomy. Polished clean 2D creature-collector illustration, appealing “almost cute” rather than babyish or chibi, confident combat-ready three-quarter pose, full body fully inside frame, strong readable silhouette, expressive face, dark tapered ink outlines, restrained two-step cel shading with subtle painterly texture, sophisticated natural palette plus a restrained elemental accent. One creature only. Anatomically coherent. No clothing, armor, tools, saddle, equipment, logo, text, UI, frame, scenery, ground, cast shadow, extra characters, duplicate anatomy, or cropped limbs. Place on a flat pure white background for clean removal.

## Species briefs

Each generation appended a species-specific anatomy, palette, pose, affinity, and ability brief to the shared production prompt. The implemented set is the 50-species roster in `game-data.js`, in region order:

- Greenhollow: Ash Raccoon, Moss Hare, Brook Otter, Stoneback Boar, Breeze Finch, Ember Mole, Dawn Koi, Bramble Hedgehog, Static Fox, Frosthorn Stag.
- Copperwood: Cedar Beaver, Coal Badger, Redtail Kite, River Crocodile, Glow Salamander, Moon Ferret, Quartz Ram, Sun Rooster, Snow Owl, Storm Lynx.
- Sunscar Basin: Dune Fennec, Iron Tortoise, Cinder Hyena, Oasis Crane, Glass Scorpion, Thunder Beetle, Shade Vulture, Frostscale Pangolin, Root Elephant, Mirage Manticore.
- Stormreach: Tempest Hawk, Volt Jackal, Glacier Bear, Obsidian Gorilla, Embermane Lion, Deepwave Orca, Night Panther, Sunscale Drake, Canopy Ape, Stormhorn Elk.
- Starfall Expanse: Crown Phoenix, Worldroot Elk, Abyssal Leviathan, Titan Mole, Sky Serpent, Aurora Wolf, Volt Chimera, Eclipse Raven, Solar Griffin, Prismatic Wyrm.

White production backgrounds were removed through contiguous edge flood-fill, preserving enclosed light details. Assets were resized to a maximum of 1024 pixels on either axis, stripped of unnecessary metadata, and saved as transparent PNGs named after their species IDs.
