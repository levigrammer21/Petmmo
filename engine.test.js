import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  attemptCapture,
  claimDungeon,
  condensePets,
  createInitialState,
  createPetInstance,
  declineCapture,
  listAvailableOpponents,
  prepareMarketListing,
  receiveMarketCoins,
  receiveMarketPet,
  resolveCombat,
  settleState,
  startActivity,
  startConstruction,
  startDungeon,
  startProcessing,
  startRecipe,
} from "./game-engine.js";
import { ACTIVITIES, BUILDINGS, DUNGEONS, ITEMS, PET_SPECIES, RECIPES } from "./game-data.js";
import { friendlyAuthError } from "./auth-errors.js";

test("initial save has the locked capacities and starter", () => {
  const state = createInitialState("Test Keeper");
  assert.equal(state.profile.activeLimit, 6);
  assert.equal(state.profile.denCapacity, 12);
  assert.equal(state.pets.length, 1);
  assert.equal(state.pets[0].speciesId, "ash-raccoon");
});

test("aptitude activity consumes food and settles rewards", () => {
  const at = 1_000_000;
  const original = createInitialState("Worker");
  original.profile.lastSeenAt = at;
  const started = startActivity(original, {
    petId: original.pets[0].id,
    activityId: "hedgerow",
    mealId: "camp-skewer",
  }, at);
  assert.equal(started.inventory["camp-skewer"], 17);
  const { state } = settleState(started, at + 5_100, () => 0.9);
  assert.equal(state.inventory["wild-berries"], 9);
  assert.equal(state.inventory.herb, 9);
  assert.equal(state.stats.actions, 1);
  assert.equal(state.activities.length, 1);
});

test("frequent sync ticks preserve partial idle-action progress", () => {
  const at = 1_050_000;
  let state = createInitialState("Ticker");
  state.profile.lastSeenAt = at;
  state = startActivity(state, { petId: state.pets[0].id, activityId: "hedgerow", mealId: "camp-skewer" }, at);
  for (let seconds = 1; seconds <= 6; seconds += 1) {
    ({ state } = settleState(state, at + seconds * 1_000, () => 0.9));
  }
  assert.equal(state.stats.actions, 1);
  assert.equal(state.inventory["wild-berries"], 9);
  assert.equal(state.activities[0].lastAt, at + 5_000);
});

test("cooking and Processing complete their resource loops", () => {
  const at = 1_100_000;
  let state = createInitialState("Cook");
  state.profile.lastSeenAt = at;
  delete state.inventory["camp-skewer"];
  state = startRecipe(state, { petId: state.pets[0].id, recipeId: "camp-skewer", mealId: "" }, at);
  ({ state } = settleState(state, at + 6_100, () => 0.9));
  assert.equal(state.inventory["camp-skewer"], 3);
  assert.equal(state.inventory["raw-meat"], 3);
  assert.equal(state.inventory.herb, 7);
  state.remains.push({ id: "remain-test", speciesId: "moss-hare", source: "combat", acquiredAt: at });
  state = startProcessing(state, { petId: state.pets[0].id, remainId: "remain-test", mealId: "camp-skewer" }, at + 7_000);
  ({ state } = settleState(state, at + 22_000, () => 0.9));
  assert.equal(state.stats.processed, 1);
  assert.equal(state.inventory["raw-meat"], 5);
  assert.equal(state.inventory.hide, 1);
  assert.equal(state.inventory["camp-skewer"], 2);
});

test("six ordinary assignments may run while a seventh is rejected", () => {
  const at = 1_200_000;
  let state = createInitialState("Foreman");
  for (let index = 0; index < 6; index += 1) state.pets.push(createPetInstance("moss-hare", "test"));
  state.inventory["camp-skewer"] = 20;
  for (const pet of state.pets.slice(0, 6)) {
    state = startActivity(state, { petId: pet.id, activityId: "hedgerow", mealId: "camp-skewer" }, at);
  }
  assert.equal(state.activities.length, 6);
  assert.throws(() => startActivity(state, { petId: state.pets[6].id, activityId: "hedgerow", mealId: "camp-skewer" }, at), /Only 6 pets/);
});

test("Construction expands hard capacity", () => {
  const at = 1_300_000;
  let state = createInitialState("Builder");
  const builder = createPetInstance("stoneback-boar", "test");
  state.pets.push(builder);
  state.inventory["rough-log"] = 30;
  state.inventory.copper = 8;
  state = startConstruction(state, { petId: builder.id, buildingId: "den", mealId: "camp-skewer" }, at);
  ({ state } = settleState(state, at + 31_000, () => 0.9));
  assert.equal(state.buildings.den, 1);
  assert.equal(state.profile.denCapacity, 17);
});

test("combat produces a capture-or-processing decision and failed capture creates remains", () => {
  const state = createInitialState("Fighter");
  state.pets[0].level = 20;
  const result = resolveCombat(state, {
    petIds: [state.pets[0].id],
    speciesId: "moss-hare",
    mealId: "camp-skewer",
  }, () => 0.02, 2_000_000);
  assert.equal(result.battle.victory, true);
  assert.equal(result.state.pendingEncounter.speciesId, "moss-hare");
  const capture = attemptCapture(result.state, "camp-skewer", () => 0.99, 2_000_100);
  assert.equal(capture.capture.success, false);
  assert.equal(capture.state.pendingEncounter, null);
  assert.equal(capture.state.remains.length, 1);
});

test("rare hunts are level-gated and dungeon pets cannot be hunted directly", () => {
  const state = createInitialState("Hunter");
  const available = listAvailableOpponents(state).map((species) => species.id);
  assert.ok(available.includes("moss-hare"));
  assert.ok(!available.includes("static-fox"));
  assert.throws(() => resolveCombat(state, {
    petIds: [state.pets[0].id],
    speciesId: "prismatic-wyrm",
    mealId: "camp-skewer",
  }), /only be encountered in a dungeon/);
});

test("capture and marketplace honor den safety checks", () => {
  const state = createInitialState("Keeper");
  assert.throws(() => prepareMarketListing(state, { petId: state.pets[0].id, price: 100 }), /Keep at least one pet/);
  while (state.pets.length < state.profile.denCapacity) state.pets.push(createPetInstance("moss-hare", "test"));
  state.pendingEncounter = { speciesId: "brook-otter", source: "combat", createdAt: Date.now() };
  assert.throws(() => attemptCapture(state, "camp-skewer", () => 0), /den is full/);
});

test("every referenced item is catalogued and dungeon keys form a progression chain", () => {
  const referenced = new Set();
  for (const species of PET_SPECIES) Object.keys(species.materials || {}).forEach((id) => referenced.add(id));
  for (const activity of ACTIVITIES) Object.keys(activity.rewards || {}).forEach((id) => referenced.add(id));
  for (const building of BUILDINGS) Object.keys(building.costs || {}).forEach((id) => referenced.add(id));
  for (const recipe of RECIPES) for (const group of [recipe.ingredients, recipe.output]) Object.keys(group || {}).forEach((id) => referenced.add(id));
  for (const dungeon of DUNGEONS) for (const group of [dungeon.entry, dungeon.rewards]) Object.keys(group || {}).forEach((id) => referenced.add(id));
  assert.deepEqual([...referenced].filter((id) => !ITEMS[id]), []);
  assert.equal(RECIPES.find((recipe) => recipe.id === "foundry-key").ingredients["heartwood-core"], 1);
  assert.equal(RECIPES.find((recipe) => recipe.id === "storm-seal").ingredients["mirage-eye"], 1);
  assert.equal(DUNGEONS.find((dungeon) => dungeon.id === "starfall-vault").entry["storm-silk"], 2);
});

test("declining capture also creates remains", () => {
  const state = createInitialState("Processor");
  state.pendingEncounter = { speciesId: "brook-otter", source: "combat", createdAt: Date.now() };
  const next = declineCapture(state);
  assert.equal(next.remains[0].speciesId, "brook-otter");
});

test("Condensing requires two maxed identical same-star pets", () => {
  const state = createInitialState("Condenser");
  const duplicate = createPetInstance("ash-raccoon", "test");
  state.pets[0].level = 20;
  duplicate.level = 20;
  state.pets.push(duplicate);
  const next = condensePets(state, { primaryId: state.pets[0].id, duplicateId: duplicate.id });
  assert.equal(next.pets.length, 1);
  assert.equal(next.pets[0].stars, 2);
  assert.equal(next.pets[0].level, 20);
});

test("dungeon pets are occupied but do not become ordinary active assignments", () => {
  const state = createInitialState("Explorer");
  state.skills.combat.level = 20;
  state.inventory["trail-pack"] = 1;
  const petId = state.pets[0].id;
  const next = startDungeon(state, { dungeonId: "root-cellar", petIds: [petId] }, 3_000_000);
  assert.equal(next.activities.length, 0);
  assert.equal(next.dungeonRuns.length, 1);
  assert.match(next.pets[0].status, /^dungeon:/);
});

test("finished dungeons return pets, rewards, and possible rare encounters", () => {
  const at = 4_000_000;
  let state = createInitialState("Delver");
  state.skills.combat.level = 20;
  state.inventory["trail-pack"] = 1;
  const petId = state.pets[0].id;
  state = startDungeon(state, { dungeonId: "root-cellar", petIds: [petId] }, at);
  const runId = state.dungeonRuns[0].id;
  const result = claimDungeon(state, runId, () => 0, at + 91_000);
  assert.equal(result.result.success, true);
  assert.equal(result.result.encounter, true);
  assert.equal(result.state.pets[0].status, "idle");
  assert.equal(result.state.inventory["heartwood-core"], 1);
  assert.equal(result.state.pendingEncounter.speciesId, "frosthorn-stag");
});

test("market transfers charge a listing fee and preserve unrestricted pet trade", () => {
  const at = 5_000_000;
  const seller = createInitialState("Seller");
  seller.pets.push(createPetInstance("moss-hare", "capture"));
  const prepared = prepareMarketListing(seller, { petId: seller.pets[1].id, price: 1_000 }, at);
  assert.equal(prepared.listing.fee, 20);
  assert.equal(prepared.state.profile.coins, 140);
  const buyer = createInitialState("Buyer");
  buyer.profile.coins = 2_000;
  const nextBuyer = receiveMarketPet(buyer, prepared.listing.pet, prepared.listing.price, at);
  const nextSeller = receiveMarketCoins(prepared.state, prepared.listing.price, at);
  assert.equal(nextBuyer.profile.coins, 1_000);
  assert.equal(nextBuyer.pets.at(-1).tradeCount, 1);
  assert.equal(nextSeller.profile.coins, 1_140);
});

test("Cloud Functions use valid Admin SDK document references", async () => {
  const source = await readFile(new URL("./functions.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bdb\.doc\s*\(/, "Admin Firestore document references must be created through collection().doc()");
  assert.match(source, /db\.collection\("players"\)\.doc\(/);
  assert.match(source, /db\.collection\("leaderboards"\)\.doc\(/);
  assert.match(source, /db\.collection\("marketListings"\)\.doc\(/);
});

test("authentication errors give players an actionable next step", () => {
  assert.deepEqual(friendlyAuthError({ code: "auth/invalid-credential" }), [
    "Email or password not recognized.",
    "If this is your first visit, choose Create account. Google accounts should use Continue with Google.",
  ]);
  assert.deepEqual(friendlyAuthError({ code: "functions/internal", message: "internal" }), [
    "Your account signed in, but your den could not be loaded.",
    "Redeploy the Firebase backend from this release, then try again.",
  ]);
});
