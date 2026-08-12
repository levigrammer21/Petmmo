# Firebase setup checklist

Project already wired into the client: `petmmo-158f7`.

The browser configuration in `firebase-config.js` is intentionally public. Firebase web API keys identify the project; they do not authorize game-data changes. Authorization is enforced by Authentication, Firestore rules, callable Cloud Functions, and later App Check.

## 1. Choose the database

Use **Cloud Firestore, Standard edition, Native mode**.

Do not create Realtime Database for this game. Firestore fits player saves, marketplace listings, leaderboards, transactions, and real-time listeners better.

When Firestore asks for a location:

- Recommended for a mostly central-US family group: **`nam5` (United States Central multi-region)**.
- Lower-cost alternative: **`us-central1` (Iowa regional)**.
- The included Cloud Functions run in `us-central1`.

Choose carefully: the default Firestore database location cannot be changed later.

Create the database in **Production mode**. The included rules will replace the temporary console rules during deployment.

## 2. Enable billing safeguards

Cloud Functions for Firebase requires the **Blaze pay-as-you-go plan**.

For this small private game, normal usage should be modest, but billing is still usage-based:

1. Upgrade the Firebase project to Blaze.
2. In Google Cloud Billing, create a small monthly budget.
3. Add alerts at 50%, 90%, and 100%.
4. In Cloud Run quotas, set a conservative maximum-instance or spending safeguard if desired.

The functions source already limits the game backend to eight instances.

## 3. Enable sign-in

Open **Firebase Console → Build → Authentication → Sign-in method**.

Enable:

- **Email/Password**
- **Google**

For Google, choose the project support email and save.

Under **Authentication → Settings → Authorized domains**, add every domain that will run the game:

- `localhost` for local testing
- `YOUR-GITHUB-USERNAME.github.io`
- Your custom domain later, if you use one

Do not include `https://`, a path, or the repository name in the authorized-domain entry.

## 4. Install the Firebase command-line tools

Install Node.js 22, open a terminal in the unzipped game folder, and run:

```bash
npm install
npx firebase login
npx firebase use petmmo-158f7
```

The included `.firebaserc` already points at `petmmo-158f7`; the `firebase use` command confirms that your account has access.

Never create or commit a service-account JSON key. Firebase CLI authentication is enough for deployment.

## 5. Deploy the secure backend

From the project root:

```bash
npm run deploy:backend
```

Run this command again whenever `functions.js`, the game engine, or Firebase rules change. Uploading files to GitHub Pages updates only the website; it does not update Cloud Functions.

That deploys:

- Node.js 22 callable Cloud Functions
- Locked Firestore rules
- Marketplace indexes
- Closed Storage rules

The callable functions are:

- `initializePlayer`
- `syncGame`
- `gameAction`
- `listPet`
- `buyPet`
- `cancelListing`

All inventory, XP, currency, capture, Processing, Condensing, dungeon, construction, and marketplace mutations run through those functions.

## 6. Understand the Firestore collections

| Collection | Purpose | Browser access |
| --- | --- | --- |
| `players/{uid}` | Complete authoritative player save | Owner read only; no client writes |
| `marketListings/{id}` | Pets currently listed for sale | Signed-in read only |
| `leaderboards/{uid}` | Small public profile and progression totals | Signed-in read only |
| `world/**` | Reserved for server-managed events and announcements | Signed-in read only |

Cloud Functions use Firebase Admin transactions and bypass client rules. Everything else is denied by default.

## 7. Add App Check after the first successful deployment

Do this after sign-in and gameplay have been verified on the GitHub Pages URL:

1. Open **Firebase Console → App Check**.
2. Register the web app with **reCAPTCHA Enterprise**.
3. Add the GitHub Pages domain to the provider.
4. Copy the public site key into `appCheckSiteKey` in `firebase-config.js`.
5. Upload the updated client and monitor App Check metrics.
6. Once legitimate requests show valid tokens, change `enforceAppCheck: false` to `true` in `functions.js`.
7. Redeploy functions with `npm run deploy:functions`.
8. Enable enforcement for Cloud Functions and Firestore in the Firebase console.

Do not enable enforcement before the site key is deployed and tested, or every game request will be rejected.

## 8. Verify the deployment

After the GitHub Pages site is online:

1. Create one Email/Password account.
2. Confirm the verification email arrives.
3. Sign out and test Google sign-in.
4. Start a Foraging assignment with the starter Ash Raccoon.
5. Refresh the page and confirm progress returns.
6. Win one combat and attempt a capture.
7. Open Firestore and confirm a `players/{uid}` document exists.
8. Confirm the browser cannot directly edit that player document through the SDK.

## Included security rules

The deployable rules are in:

- `firestore.rules`
- `storage.rules`
- `firestore.indexes.json`

Do not replace `firestore.rules` with a temporary `allow read, write: if true` rule. That would let anyone give themselves pets, XP, items, and coins.
