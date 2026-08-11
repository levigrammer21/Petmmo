import { appCheckSiteKey, firebaseConfig, firebaseRegion, firebaseSdkVersion } from "./firebase-config.js";

const sdk = (module) => `https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/${module}.js`;

export async function connectFirebase(handlers = {}) {
  const [appSdk, authSdk, firestoreSdk, functionsSdk, appCheckSdk] = await Promise.all([
    import(sdk("firebase-app")),
    import(sdk("firebase-auth")),
    import(sdk("firebase-firestore")),
    import(sdk("firebase-functions")),
    import(sdk("firebase-app-check")),
  ]);

  const app = appSdk.initializeApp(firebaseConfig);
  const auth = authSdk.getAuth(app);
  const db = firestoreSdk.getFirestore(app);
  const functions = functionsSdk.getFunctions(app, firebaseRegion);
  await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);

  if (appCheckSiteKey) {
    appCheckSdk.initializeAppCheck(app, {
      provider: new appCheckSdk.ReCaptchaEnterpriseProvider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  }

  let unsubscribePlayer = null;
  let unsubscribeMarket = null;
  let unsubscribeLeaderboard = null;

  const call = async (name, payload = {}) => {
    const callable = functionsSdk.httpsCallable(functions, name);
    const result = await callable(payload);
    return result.data;
  };

  const watchPublicData = () => {
    unsubscribeMarket?.();
    unsubscribeLeaderboard?.();
    const marketQuery = firestoreSdk.query(
      firestoreSdk.collection(db, "marketListings"),
      firestoreSdk.orderBy("createdAt", "desc"),
      firestoreSdk.limit(40),
    );
    unsubscribeMarket = firestoreSdk.onSnapshot(marketQuery, (snapshot) => {
      handlers.onMarket?.(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    }, (error) => handlers.onError?.(error));

    const leaderboardQuery = firestoreSdk.query(
      firestoreSdk.collection(db, "leaderboards"),
      firestoreSdk.orderBy("petPower", "desc"),
      firestoreSdk.limit(25),
    );
    unsubscribeLeaderboard = firestoreSdk.onSnapshot(leaderboardQuery, (snapshot) => {
      handlers.onLeaderboard?.(snapshot.docs.map((entry) => ({ id: entry.id, ...entry.data() })));
    }, (error) => handlers.onError?.(error));
  };

  const watchPlayer = (uid) => {
    unsubscribePlayer?.();
    unsubscribePlayer = firestoreSdk.onSnapshot(
      firestoreSdk.doc(db, "players", uid),
      (snapshot) => handlers.onState?.(snapshot.exists() ? snapshot.data() : null),
      (error) => handlers.onError?.(error),
    );
    watchPublicData();
  };

  const authReady = new Promise((resolve) => {
    authSdk.onAuthStateChanged(auth, async (user) => {
      if (user) watchPlayer(user.uid);
      else {
        unsubscribePlayer?.();
        unsubscribeMarket?.();
        unsubscribeLeaderboard?.();
      }
      handlers.onAuth?.(user);
      resolve(user);
    });
  });

  return {
    auth,
    authReady,
    call,
    signInEmail: (email, password) => authSdk.signInWithEmailAndPassword(auth, email, password),
    registerEmail: async (email, password, displayName) => {
      const credential = await authSdk.createUserWithEmailAndPassword(auth, email, password);
      if (displayName) await authSdk.updateProfile(credential.user, { displayName: displayName.slice(0, 28) });
      await authSdk.sendEmailVerification(credential.user);
      await call("initializePlayer", { displayName: displayName || credential.user.displayName || "Keeper" });
      return credential;
    },
    signInGoogle: async () => {
      const provider = new authSdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      const credential = await authSdk.signInWithPopup(auth, provider);
      await call("initializePlayer", { displayName: credential.user.displayName || "Keeper" });
      return credential;
    },
    sendPasswordReset: (email) => authSdk.sendPasswordResetEmail(auth, email),
    signOut: () => authSdk.signOut(auth),
    initializePlayer: (displayName) => call("initializePlayer", { displayName }),
    syncGame: () => call("syncGame"),
    gameAction: (action, payload = {}) => call("gameAction", { action, payload }),
    listPet: (petId, price) => call("listPet", { petId, price }),
    buyPet: (listingId) => call("buyPet", { listingId }),
    cancelListing: (listingId) => call("cancelListing", { listingId }),
    dispose: () => {
      unsubscribePlayer?.();
      unsubscribeMarket?.();
      unsubscribeLeaderboard?.();
    },
  };
}
