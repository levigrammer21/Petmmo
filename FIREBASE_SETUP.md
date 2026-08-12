# Firebase setup — no billing required

The game is already connected to Firebase project `petmmo-158f7`.

This release uses only services available on Firebase's Spark plan:

- Firebase Authentication
- Cloud Firestore

Do **not** enable Blaze billing. Do **not** deploy Cloud Functions. Do **not** set up Firebase Storage. The Storage and Blaze errors from the older release can be ignored.

## 1. Database

Use **Cloud Firestore → Standard edition → Native mode**. Your screenshot shows that Firestore already exists, so this step is done.

The current console rule `allow read, write: if false;` blocks the game from creating its den. It will be replaced by the included `firestore.rules` in step 4.

## 2. Sign-in methods

In **Firebase Console → Authentication → Sign-in method**, enable:

- Email/Password
- Google

Under **Authentication → Settings → Authorized domains**, make sure this exact hostname is present:

```text
levigrammer21.github.io
```

Do not include `https://` or `/Petmmo/`.

An email/password account and a Google sign-in are different ways to enter. If an address was first used with Google, use **Continue with Google** unless you separately created an Email/Password account.

## 3. Upload version 0.6.0 to GitHub

Replace the old repository files with every file from this release. Keep all files at the repository root and keep only the artwork inside `pets/`.

Wait for GitHub Pages to finish publishing before testing.

## 4. Publish the free Firestore backend

If you already completed the rules/index deployment successfully for version 0.3.0 or later, **skip this step**. Version 0.6.0 changes the game screen, save schema, and browser-side engine; its Firestore rules and indexes are unchanged.

For a new installation, open Firebase Cloud Shell. If your existing folder is still named `Petmmo-deploy-021`, paste this as one command:

```bash
cd ~/Petmmo-deploy-021 && git pull && firebase use petmmo-158f7 && firebase deploy --only firestore:rules,firestore:indexes
```

The successful ending should say that Firestore rules and indexes were deployed. It should **not** mention Functions, Storage, Cloud Build, or Blaze.

If the folder has a different name, enter that folder first, then run:

```bash
git pull
firebase use petmmo-158f7
firebase deploy --only firestore:rules,firestore:indexes
```

You can also paste the complete contents of `firestore.rules` into **Cloud Firestore → Rules** and tap **Publish**, but Cloud Shell is easier because it publishes the indexes too.

## 5. Test on your phone

1. Open `https://levigrammer21.github.io/Petmmo/` in a normal Chrome tab.
2. Refresh once so Chrome receives version 0.6.0.
3. Use **Continue with Google** for the Google account you already tested.
4. The game creates `players/{your Firebase UID}` automatically.
5. Open Equipment and confirm the starter sword and armour appear.
6. Start one Keeper action and one pet Foraging assignment together, refresh, and confirm both return.

Then test an Email/Password account separately with **Create account**.

## What the rules protect

| Collection | Access |
| --- | --- |
| `players/{uid}` | Only that signed-in owner can read or write the complete save |
| `leaderboards/{uid}` | Signed-in players can read; only the matching owner can publish their row |
| `marketListings/{id}` | Signed-in players can read; sellers list/cancel and buyers mark one active listing sold |
| `world/**` | Signed-in read only; writes remain closed |

The game uses Firestore transactions for normal saves and purchases. It is private between accounts, but browser-side gameplay is intentionally a trusted-family design rather than a cheat-proof public economy.

## If an error appears

- **Den cannot save yet / permission denied:** step 4 has not succeeded with the included rules.
- **Email or password not recognized:** create an Email/Password account first, or use Google for a Google-created account.
- **Unauthorized domain:** add `levigrammer21.github.io` in Authentication settings.
- **Index is building / failed precondition:** wait a few minutes after step 4, then refresh.
- **Daily limit reached:** Spark quotas reset automatically; this should be uncommon for a small family group.

Never use a service-account key, and never publish a rule that allows everyone to read or write everything.
