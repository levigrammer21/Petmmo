export function friendlyAuthError(error) {
  const rawCode = String(error?.code || "").toLowerCase();
  const rawMessage = String(error?.message || "");
  const code = rawCode || (/auth\/invalid-(?:login-)?credential/i.test(rawMessage) ? "auth/invalid-credential" : /^internal$/i.test(rawMessage.trim()) ? "functions/internal" : "");
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
    "functions/not-found": ["The game backend is not deployed yet.", "Deploy the Firebase backend from this release, then try again."],
    "functions/internal": ["Your account signed in, but your den could not be loaded.", "Redeploy the Firebase backend from this release, then try again."],
    internal: ["Your account signed in, but your den could not be loaded.", "Redeploy the Firebase backend from this release, then try again."],
  };
  if (known[code]) return known[code];
  if (/\binternal\b/i.test(rawMessage) && !rawCode.startsWith("auth/")) return known["functions/internal"];
  return ["Something went wrong.", "Please try again. If it continues, refresh the game."];
}
