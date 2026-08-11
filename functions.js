import crypto from "node:crypto";
import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import {
  GameError,
  attemptCapture,
  claimDungeon,
  condensePets,
  createInitialState,
  declineCapture,
  normalizeState,
  prepareMarketListing,
  publicProfile,
  receiveMarketCoins,
  receiveMarketPet,
  resolveCombat,
  restoreCancelledListing,
  sacrificePet,
  settleState,
  startActivity,
  startConstruction,
  startDungeon,
  startProcessing,
  startRecipe,
  stopActivity,
} from "./game-engine.js";

if (!getApps().length) initializeApp();
const db = getFirestore();

setGlobalOptions({
  region: "us-central1",
  maxInstances: 8,
  concurrency: 40,
  memory: "256MiB",
  timeoutSeconds: 30,
});

const CALLABLE_OPTIONS = {
  enforceAppCheck: false,
  cors: true,
};

function requireUser(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Sign in to continue.");
  return {
    uid: request.auth.uid,
    email: request.auth.token.email || "",
    displayName: request.auth.token.name || "Keeper",
  };
}

function cleanDisplayName(value, fallback = "Keeper") {
  const name = String(value || fallback).replace(/[<>]/g, "").trim().slice(0, 28);
  return name || fallback;
}

function asHttpsError(error) {
  if (error instanceof HttpsError) return error;
  if (error instanceof GameError) return new HttpsError(error.code || "failed-precondition", error.message);
  console.error(error);
  return new HttpsError("internal", "The game action could not be completed.");
}

function seededRandom(seedText) {
  const digest = crypto.createHash("sha256").update(seedText).digest();
  let value = digest.readUInt32LE(0) || 0x9e3779b9;
  return () => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) / 4294967296;
  };
}

async function writePlayerAndBoard(transaction, uid, state) {
  transaction.set(db.doc("players", uid), state);
  transaction.set(db.doc("leaderboards", uid), publicProfile(state, uid));
}

export const initializePlayer = onCall(CALLABLE_OPTIONS, async (request) => {
  const user = requireUser(request);
  const at = Date.now();
  const displayName = cleanDisplayName(request.data?.displayName, user.displayName);
  try {
    const state = await db.runTransaction(async (transaction) => {
      const ref = db.doc("players", user.uid);
      const snapshot = await transaction.get(ref);
      let next;
      if (snapshot.exists) {
        next = settleState(snapshot.data(), at, seededRandom(`${user.uid}:login:${at}`)).state;
        if (!next.profile.displayName || next.profile.displayName === "Keeper") next.profile.displayName = displayName;
      } else {
        next = createInitialState(displayName);
        next.profile.email = user.email;
      }
      await writePlayerAndBoard(transaction, user.uid, next);
      return next;
    });
    return { state };
  } catch (error) {
    throw asHttpsError(error);
  }
});

export const syncGame = onCall(CALLABLE_OPTIONS, async (request) => {
  const user = requireUser(request);
  const at = Date.now();
  try {
    const result = await db.runTransaction(async (transaction) => {
      const ref = db.doc("players", user.uid);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new GameError("Create your keeper first.", "not-found");
      const settled = settleState(snapshot.data(), at, seededRandom(`${user.uid}:sync:${at}`));
      await writePlayerAndBoard(transaction, user.uid, settled.state);
      return settled;
    });
    return result;
  } catch (error) {
    throw asHttpsError(error);
  }
});

function applyGameAction(state, action, payload, random, at) {
  switch (action) {
    case "startActivity": return { state: startActivity(state, payload, at) };
    case "startRecipe": return { state: startRecipe(state, payload, at) };
    case "startConstruction": return { state: startConstruction(state, payload, at) };
    case "startProcessing": return { state: startProcessing(state, payload, at) };
    case "stopActivity": return { state: stopActivity(state, payload.activityId, at) };
    case "resolveCombat": return resolveCombat(state, payload, random, at);
    case "attemptCapture": return attemptCapture(state, payload.mealId, random, at);
    case "declineCapture": return { state: declineCapture(state, at) };
    case "sacrificePet": return sacrificePet(state, payload, at);
    case "condensePets": return { state: condensePets(state, payload, at) };
    case "startDungeon": return { state: startDungeon(state, payload, at) };
    case "claimDungeon": return claimDungeon(state, payload.runId, random, at);
    default: throw new GameError("Unknown game action.", "invalid-argument");
  }
}

export const gameAction = onCall(CALLABLE_OPTIONS, async (request) => {
  const user = requireUser(request);
  const action = String(request.data?.action || "");
  const payload = request.data?.payload && typeof request.data.payload === "object" ? request.data.payload : {};
  const at = Date.now();
  const actionNonce = crypto.randomUUID();
  try {
    const result = await db.runTransaction(async (transaction) => {
      const ref = db.doc("players", user.uid);
      const snapshot = await transaction.get(ref);
      if (!snapshot.exists) throw new GameError("Create your keeper first.", "not-found");
      const random = seededRandom(`${user.uid}:${action}:${actionNonce}`);
      const settled = settleState(snapshot.data(), at, random).state;
      const applied = applyGameAction(settled, action, payload, random, at);
      const next = normalizeState(applied.state, user.displayName);
      await writePlayerAndBoard(transaction, user.uid, next);
      return { ...applied, state: next };
    });
    return result;
  } catch (error) {
    throw asHttpsError(error);
  }
});

export const listPet = onCall(CALLABLE_OPTIONS, async (request) => {
  const user = requireUser(request);
  const at = Date.now();
  const listingRef = db.collection("marketListings").doc();
  try {
    const result = await db.runTransaction(async (transaction) => {
      const playerRef = db.doc("players", user.uid);
      const snapshot = await transaction.get(playerRef);
      if (!snapshot.exists) throw new GameError("Player not found.", "not-found");
      const settled = settleState(snapshot.data(), at, seededRandom(`${user.uid}:list:${listingRef.id}`)).state;
      const prepared = prepareMarketListing(settled, { petId: request.data?.petId, price: request.data?.price }, at);
      const listing = {
        ...prepared.listing,
        sellerUid: user.uid,
        sellerName: prepared.state.profile.displayName,
        createdAt: at,
      };
      transaction.set(listingRef, listing);
      await writePlayerAndBoard(transaction, user.uid, prepared.state);
      return { state: prepared.state, listing: { id: listingRef.id, ...listing } };
    });
    return result;
  } catch (error) {
    throw asHttpsError(error);
  }
});

export const cancelListing = onCall(CALLABLE_OPTIONS, async (request) => {
  const user = requireUser(request);
  const listingId = String(request.data?.listingId || "");
  if (!listingId) throw new HttpsError("invalid-argument", "Choose a listing.");
  const at = Date.now();
  try {
    const state = await db.runTransaction(async (transaction) => {
      const listingRef = db.doc("marketListings", listingId);
      const playerRef = db.doc("players", user.uid);
      const [listingSnapshot, playerSnapshot] = await Promise.all([transaction.get(listingRef), transaction.get(playerRef)]);
      if (!listingSnapshot.exists) throw new GameError("Listing not found.", "not-found");
      const listing = listingSnapshot.data();
      if (listing.sellerUid !== user.uid) throw new GameError("Only the seller may cancel this listing.", "permission-denied");
      if (!playerSnapshot.exists) throw new GameError("Player not found.", "not-found");
      const next = restoreCancelledListing(playerSnapshot.data(), listing.pet, at);
      transaction.delete(listingRef);
      await writePlayerAndBoard(transaction, user.uid, next);
      return next;
    });
    return { state };
  } catch (error) {
    throw asHttpsError(error);
  }
});

export const buyPet = onCall(CALLABLE_OPTIONS, async (request) => {
  const buyer = requireUser(request);
  const listingId = String(request.data?.listingId || "");
  if (!listingId) throw new HttpsError("invalid-argument", "Choose a listing.");
  const at = Date.now();
  try {
    const buyerState = await db.runTransaction(async (transaction) => {
      const listingRef = db.doc("marketListings", listingId);
      const listingSnapshot = await transaction.get(listingRef);
      if (!listingSnapshot.exists) throw new GameError("That listing has already sold.", "not-found");
      const listing = listingSnapshot.data();
      if (listing.sellerUid === buyer.uid) throw new GameError("You cannot buy your own listing.");
      const buyerRef = db.doc("players", buyer.uid);
      const sellerRef = db.doc("players", listing.sellerUid);
      const [buyerSnapshot, sellerSnapshot] = await Promise.all([transaction.get(buyerRef), transaction.get(sellerRef)]);
      if (!buyerSnapshot.exists || !sellerSnapshot.exists) throw new GameError("A marketplace account is unavailable.", "not-found");
      const nextBuyer = receiveMarketPet(buyerSnapshot.data(), listing.pet, Number(listing.price), at);
      const nextSeller = receiveMarketCoins(sellerSnapshot.data(), Number(listing.price), at);
      transaction.delete(listingRef);
      await writePlayerAndBoard(transaction, buyer.uid, nextBuyer);
      await writePlayerAndBoard(transaction, listing.sellerUid, nextSeller);
      return nextBuyer;
    });
    return { state: buyerState };
  } catch (error) {
    throw asHttpsError(error);
  }
});
