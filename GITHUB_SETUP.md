# GitHub Pages setup

The game is intentionally buildless. All web files live directly at the repository root; only pet artwork lives in `pets/`.

## Upload

1. Create a GitHub repository.
2. Unzip this package.
3. Upload every root file and the `pets/` folder to the repository root.
4. Commit to the `main` branch.

Do not put the files inside another folder such as `src`, `public`, `docs`, or `dist`.

## Turn on GitHub Pages

1. Open the repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch **`main`** and folder **`/(root)`**.
5. Save.

GitHub will provide a URL similar to:

```text
https://YOUR-GITHUB-USERNAME.github.io/YOUR-REPOSITORY/
```

The code uses relative URLs, so repository-project Pages URLs work without editing path prefixes.

## Authorize the GitHub domain in Firebase

In **Firebase Console → Authentication → Settings → Authorized domains**, add:

```text
YOUR-GITHUB-USERNAME.github.io
```

Use only the hostname. Do not add the repository path.

## Updating the game

Replace the changed root files or artwork in `pets/`, commit, and GitHub Pages will publish the new version automatically.

## Custom domain

If you later add a custom domain to GitHub Pages, also add that hostname to Firebase Authentication's authorized domains and to the App Check provider.

