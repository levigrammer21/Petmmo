export function friendlyAuthError(error) {
  const rawCode = String(error?.code || "").toLowerCase();
  const rawMessage = String(error?.message || "").trim();

  // Game rules intentionally throw plain-language errors. Preserve them so a
  // player sees useful feedback such as missing food, a full den, or a level gate.
  if (error?.name === "GameError") return [rawMessage || "That action could not be completed.", ""];

  const code = rawCode || (/auth\/invalid-(?:login-)?credential/i.test(rawMessage) ? "auth/invalid-credential" : "");
  const known = {
    "auth/invalid-credential": ["Email or password not recognized.", "If this is your first visit, choose Create account. Google accounts should use Continue with Google."],
    "auth/invalid-login-credentials": ["Email or password not recognized.", "If this is your first visit, choose Create account. Google accounts should use Continue with Google."],
    "auth/user-not-found": ["Email or password not recognized.", "If this is your first visit, choose Create account."],
    "auth/wrong-password": ["Email or password not recognized.", "Try again or use Forgot your password."],
    "auth/email-already-in-use": ["An account already uses that email.", "Choose Sign in, or use Continue with Google if it is a Google account."],
    "auth/weak-password": ["That password is too weak.", "Use at least six characters."],
    "auth/operation-not-allowed": ["That sign-in method is not enabled.", "Enable it in Firebase Authentication, then try again."],
    "auth/unauthorized-domain": ["This website is not authorized for sign-in.", "Add levigrammer21.github.io under Firebase Authentication → Authorized domains."],
    "auth/popup-blocked": ["Google sign-in was blocked by the browser.", "Allow the sign-in window and try again."],
    "auth/popup-closed-by-user": ["Google sign-in was cancelled.", "Try again when you are ready."],
    "auth/cancelled-popup-request": ["Google sign-in was cancelled.", "Only one sign-in window can be open at a time."],
    "auth/network-request-failed": ["Could not reach Firebase.", "Check your connection and try again."],
    "auth/internal-error": ["Google sign-in could not finish.", "Close the sign-in window, reopen the game, and try again."],
    "game/empty-save": ["Your account signed in, but the den did not load.", "Refresh the game and try once more."],
    "permission-denied": ["Your account signed in, but the den cannot save yet.", "Publish the Firestore rules included with the current release, then refresh the game."],
    "firestore/permission-denied": ["Your account signed in, but the den cannot save yet.", "Publish the Firestore rules included with the current release, then refresh the game."],
    unavailable: ["Firebase is temporarily unreachable.", "Check your connection, then try again."],
    "firestore/unavailable": ["Firebase is temporarily unreachable.", "Check your connection, then try again."],
    "resource-exhausted": ["The free Firebase daily limit has been reached.", "The game will work again when Firebase resets the quota."],
    aborted: ["That save changed at the same time on another device.", "Try the action once more."],
    "failed-precondition": ["Firebase needs one more setup step.", "Publish the included Firestore indexes, wait a few minutes, then refresh."],
  };

  if (known[code]) return known[code];
  if (rawCode.startsWith("auth/")) return ["Sign-in could not finish.", "Please try again. If it continues, refresh the game."];
  return ["Something went wrong.", "Please try again. If it continues, refresh the game."];
}
