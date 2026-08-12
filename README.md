# Wilderden 1.0 — Idle RPG rebuild

Wilderden is built around one rule: **Melvor-style idle progression, with pets that can work and fight beside the Keeper.**

## Core loop

- The Keeper trains one skill continuously until you change or stop it.
- Up to six pets can independently work skills at the same time.
- Pet aptitude changes efficiency and occasional bonus yield; it does not block a pet from doing a job.
- Work and combat settle offline for up to 24 hours.
- Combat is continuous: enemies chain together with only a sub-second transition. There are no patrol durations, return timers, or five-minute search waits.
- Opening Combat shows the current fight and current HP.
- Defeated wild pets leave remains for Processing and have a small automatic taming chance.
- Downed pets remain in the Den and can always be healed with berries, meals, or tonics.
- Dungeons are live boss fights with progression requirements, not long expedition timers.

## Existing pet artwork

The game preserves all 50 species definitions and expects the approved PNG files under `pets/` using the existing filenames (`ash-raccoon.png`, `moss-hare.png`, etc.). Copy the existing 50-image `pets` folder into this project before publishing. The rebuild intentionally does not replace or regenerate that artwork.

## Deploy

Upload these files to the repository root, copy the existing `pets/` art folder into place, and publish GitHub Pages. Firebase Authentication and Firestore use the existing `petmmo-158f7` project.

If your current Firestore rules already allow each signed-in user to own `players/{uid}`, the included rules are compatible. Deploy with:

```bash
firebase use petmmo-158f7
firebase deploy --only firestore:rules,firestore:indexes
```

No Cloud Functions, Storage, or Blaze billing are required.


## 1.1 gameplay depth

Taming is handled from Combat: turn on Auto-tame and choose a food offering. Victories roll a visible tame chance based on species rarity, offering quality, and Pet Mastery. Processing now exposes the complete remains queue and processors. Individual actions have Mastery levels from 1–99, and live combat uses affinity matchups, crits, pet abilities, combat styles, and streaks without adding search delays or session timers.
