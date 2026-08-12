import { firebaseConfig, firebaseSdkVersion } from "./firebase-config.js";
import {
  GameError,
  attemptCapture,
  claimDungeon,
  condensePets,
  createInitialState,
  buyStoreItem,
  declineCapture,
  equipItem,
  normalizeState,
  prepareMarketListing,
  publicProfile,
  receiveMarketCoins,
  receiveMarketPet,
  resolveAreaCombat,
  resolveCombat,
  restoreCancelledListing,
  sacrificePet,
  settleState,
  startActivity,
  startCombatPatrol,
  startKeeperActivity,
  startKeeperConstruction,
  startKeeperProcessing,
  startKeeperRecipe,
  startConstruction,
  startDungeon,
  startProcessing,
  startProcessingShift,
  startRecipe,
  stopActivity,
  stopCombatPatrol,
  stopKeeperActivity,
  useHealingItem,
} from "./game-engine.js";

const sdk = (module) => `https://www.gstatic.com/firebasejs/${firebaseSdkVersion}/${module}.js`;

function requireUser(auth) {
  if (!auth.currentUser) throw new GameError("Sign in before changing your den.", "unauthenticated");
  return auth.currentUser;
}

function attachAccountProfile(rawState, user) {
  const state = normalizeState(rawState, user.displayName || "Keeper");
  state.profile.email = user.email || "";
  return state;
}

function actionResult(action, state, payload, at) {
  if (action === "startActivity") return { state: startActivity(state, payload, at) };
  if (action === "startKeeperActivity") return { state: startKeeperActivity(state, payload, at) };
  if (action === "startKeeperRecipe") return { state: startKeeperRecipe(state, payload, at) };
  if (action === "startKeeperConstruction") return { state: startKeeperConstruction(state, payload, at) };
  if (action === "startKeeperProcessing") return { state: startKeeperProcessing(state, payload, at) };
  if (action === "startRecipe") return { state: startRecipe(state, payload, at) };
  if (action === "startConstruction") return { state: startConstruction(state, payload, at) };
  if (action === "startProcessing") return { state: startProcessing(state, payload, at) };
  if (action === "startProcessingShift") return { state: startProcessingShift(state, payload, at) };
  if (action === "startCombatPatrol") return { state: startCombatPatrol(state, payload, at) };
  if (action === "stopActivity") return { state: stopActivity(state, payload.activityId, at) };
  if (action === "stopCombatPatrol") return { state: stopCombatPatrol(state, at) };
  if (action === "stopKeeperActivity") return { state: stopKeeperActivity(state, at) };
  if (action === "equipItem") return { state: equipItem(state, payload.itemId, at) };
  if (action === "buyStoreItem") return { state: buyStoreItem(state, payload, at) };
  if (action === "useHealingItem") return useHealingItem(state, payload, at);
  if (action === "resolveCombat") return resolveCombat(state, payload, Math.random, at);
  if (action === "resolveAreaCombat") return resolveAreaCombat(state, payload, Math.random, at);
  if (action === "attemptCapture") return attemptCapture(state, payload.mealId, Math.random, at);
  if (action === "declineCapture") return { state: declineCapture(state, at) };
  if (action === "sacrificePet") return sacrificePet(state, payload, at);
  if (action === "condensePets") return { state: condensePets(state, payload, at) };
  if (action === "startDungeon") return { state: startDungeon(state, payload, at) };
  if (action === "claimDungeon") return claimDungeon(state, payload.runId, Math.random, at);
  throw new GameError("Unknown game action.", "invalid-argument");
}

export async function connectFirebase(handlers = {}) {
  const [appSdk, authSdk, firestoreSdk] = await Promise.all([
    import(sdk("firebase-app")),
    import(sdk("firebase-auth")),
    import(sdk("firebase-firestore")),
  ]);

  const app = appSdk.initializeApp(firebaseConfig);
  const auth = authSdk.getAuth(app);
  const db = firestoreSdk.getFirestore(app);
  await authSdk.setPersistence(auth, authSdk.browserLocalPersistence);

  let unsubscribeAuth = null;
  let unsubscribePlayer = null;
  let unsubscribeMarket = null;
  let unsubscribeLeaderboard = null;
  let claimsInFlight = null;

  const refsFor = (uid) => ({
    player: firestoreSdk.doc(db, "players", uid),
    leaderboard: firestoreSdk.doc(db, "leaderboards", uid),
  });

  const saveState = (transaction, refs, state, user) => {
    const next = attachAccountProfile(state, user);
    transaction.set(refs.player, next);
    transaction.set(refs.leaderboard, publicProfile(next, user.uid));
    return next;
  };

  const mutatePlayer = async (mutator) => {
    const user = requireUser(auth);
    const refs = refsFor(user.uid);
    return firestoreSdk.runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(refs.player);
      if (!snapshot.exists()) throw new GameError("Your den has not been created yet. Reopen the game and try again.", "not-found");
      const at = Date.now();
      const settled = settleState(snapshot.data(), at, Math.random);
      const result = mutator(settled.state, at) || {};
      if (!result.state) throw new GameError("The game action did not return a save.", "internal");
      const next = saveState(transaction, refs, result.state, user);
      return { ...result, state: next, events: [...settled.events, ...(result.events || [])] };
    });
  };

  const claimSoldListings = async () => {
    if (claimsInFlight) return claimsInFlight;
    const user = auth.currentUser;
    if (!user) return null;
    claimsInFlight = (async () => {
      const ownedQuery = firestoreSdk.query(
        firestoreSdk.collection(db, "marketListings"),
        firestoreSdk.where("sellerUid", "==", user.uid),
        firestoreSdk.limit(100),
      );
      const owned = await firestoreSdk.getDocs(ownedQuery);
      let latestState = null;
      for (const candidate of owned.docs.filter((entry) => entry.data().status === "sold")) {
        const refs = refsFor(user.uid);
        const claimed = await firestoreSdk.runTransaction(db, async (transaction) => {
          const listingSnapshot = await transaction.get(candidate.ref);
          const playerSnapshot = await transaction.get(refs.player);
          if (!listingSnapshot.exists() || !playerSnapshot.exists()) return null;
          const listing = listingSnapshot.data();
          if (listing.sellerUid !== user.uid || listing.status !== "sold") return null;
          const paid = receiveMarketCoins(playerSnapshot.data(), listing.price, Date.now());
          const next = saveState(transaction, refs, paid, user);
          transaction.delete(candidate.ref);
          return next;
        });
        if (claimed) latestState = claimed;
      }
      return latestState;
    })();
    try {
      return await claimsInFlight;
    } finally {
      claimsInFlight = null;
    }
  };

  const initializePlayer = async (displayName) => {
    const user = requireUser(auth);
    const refs = refsFor(user.uid);
    const initialized = await firestoreSdk.runTransaction(db, async (transaction) => {
      const snapshot = await transaction.get(refs.player);
      const at = Date.now();
      let state;
      let events = [];
      if (snapshot.exists()) {
        ({ state, events } = settleState(snapshot.data(), at, Math.random));
      } else {
        state = createInitialState(displayName || user.displayName || "Keeper");
      }
      state = saveState(transaction, refs, state, user);
      return { state, events };
    });
    const paidState = await claimSoldListings();
    return paidState ? { ...initialized, state: paidState } : initialized;
  };

  const syncGame = () => mutatePlayer((state) => ({ state }));
  const gameAction = (action, payload = {}) => mutatePlayer((state, at) => actionResult(action, state, payload, at));

  const listPet = async (petId, price) => {
    const user = requireUser(auth);
    const refs = refsFor(user.uid);
    const listingRef = firestoreSdk.doc(firestoreSdk.collection(db, "marketListings"));
    return firestoreSdk.runTransaction(db, async (transaction) => {
      const playerSnapshot = await transaction.get(refs.player);
      if (!playerSnapshot.exists()) throw new GameError("Your den has not been created yet.", "not-found");
      const at = Date.now();
      const settled = settleState(playerSnapshot.data(), at, Math.random);
      const prepared = prepareMarketListing(settled.state, { petId, price }, at);
      const next = saveState(transaction, refs, prepared.state, user);
      const listing = {
        ...prepared.listing,
        sellerUid: user.uid,
        sellerName: next.profile.displayName,
        status: "active",
      };
      transaction.set(listingRef, listing);
      return { state: next, listing: { id: listingRef.id, ...listing }, events: settled.events };
    });
  };

  const buyPet = async (listingId) => {
    const user = requireUser(auth);
    const refs = refsFor(user.uid);
    const listingRef = firestoreSdk.doc(db, "marketListings", String(listingId || ""));
    return firestoreSdk.runTransaction(db, async (transaction) => {
      const listingSnapshot = await transaction.get(listingRef);
      const playerSnapshot = await transaction.get(refs.player);
      if (!listingSnapshot.exists()) throw new GameError("That listing is no longer available.", "not-found");
      if (!playerSnapshot.exists()) throw new GameError("Your den has not been created yet.", "not-found");
      const listing = listingSnapshot.data();
      if (listing.status !== "active") throw new GameError("That pet has already been sold.", "failed-precondition");
      if (listing.sellerUid === user.uid) throw new GameError("You cannot buy your own listing.", "failed-precondition");
      const at = Date.now();
      const settled = settleState(playerSnapshot.data(), at, Math.random);
      const purchased = receiveMarketPet(settled.state, listing.pet, listing.price, at);
      const next = saveState(transaction, refs, purchased, user);
      transaction.update(listingRef, { status: "sold", buyerUid: user.uid, soldAt: at });
      return { state: next, events: settled.events };
    });
  };

  const cancelListing = async (listingId) => {
    const user = requireUser(auth);
    const refs = refsFor(user.uid);
    const listingRef = firestoreSdk.doc(db, "marketListings", String(listingId || ""));
    return firestoreSdk.runTransaction(db, async (transaction) => {
      const listingSnapshot = await transaction.get(listingRef);
      const playerSnapshot = await transaction.get(refs.player);
      if (!listingSnapshot.exists()) throw new GameError("That listing no longer exists.", "not-found");
      if (!playerSnapshot.exists()) throw new GameError("Your den has not been created yet.", "not-found");
      const listing = listingSnapshot.data();
      if (listing.sellerUid !== user.uid) throw new GameError("Only the seller can cancel this listing.", "permission-denied");
      if (listing.status !== "active") throw new GameError("That pet has already been sold.", "failed-precondition");
      const at = Date.now();
      const settled = settleState(playerSnapshot.data(), at, Math.random);
      const restored = restoreCancelledListing(settled.state, listing.pet, at);
      const next = saveState(transaction, refs, restored, user);
      transaction.delete(listingRef);
      return { state: next, events: settled.events };
    });
  };

  const watchPublicData = () => {
    unsubscribeMarket?.();
    unsubscribeLeaderboard?.();
    const marketQuery = firestoreSdk.query(
      firestoreSdk.collection(db, "marketListings"),
      firestoreSdk.orderBy("createdAt", "desc"),
      firestoreSdk.limit(80),
    );
    unsubscribeMarket = firestoreSdk.onSnapshot(marketQuery, (snapshot) => {
      const listings = snapshot.docs
        .map((entry) => ({ id: entry.id, ...entry.data() }))
        .filter((entry) => entry.status === "active")
        .slice(0, 40);
      handlers.onMarket?.(listings);
      void claimSoldListings().catch((error) => handlers.onError?.(error));
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
    unsubscribeAuth = authSdk.onAuthStateChanged(auth, (user) => {
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
    signInEmail: (email, password) => authSdk.signInWithEmailAndPassword(auth, email, password),
    registerEmail: async (email, password, displayName) => {
      const credential = await authSdk.createUserWithEmailAndPassword(auth, email, password);
      if (displayName) await authSdk.updateProfile(credential.user, { displayName: displayName.slice(0, 28) });
      let verificationSent = true;
      try {
        await authSdk.sendEmailVerification(credential.user);
      } catch (error) {
        verificationSent = false;
        console.warn("Verification email could not be sent.", error);
      }
      return { user: credential.user, verificationSent };
    },
    signInGoogle: async () => {
      const provider = new authSdk.GoogleAuthProvider();
      provider.setCustomParameters({ prompt: "select_account" });
      return authSdk.signInWithPopup(auth, provider);
    },
    sendPasswordReset: (email) => authSdk.sendPasswordResetEmail(auth, email),
    signOut: () => authSdk.signOut(auth),
    initializePlayer,
    syncGame,
    gameAction,
    listPet,
    buyPet,
    cancelListing,
    dispose: () => {
      unsubscribeAuth?.();
      unsubscribePlayer?.();
      unsubscribeMarket?.();
      unsubscribeLeaderboard?.();
    },
  };
}
