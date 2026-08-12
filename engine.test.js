import test from "node:test";
import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import {
  attemptCapture,
  buyStoreItem,
  claimDungeon,
  condensePets,
  createInitialState,
  createPetInstance,
  declineCapture,
  equipItem,
  keeperStats,
  listAvailableOpponents,
  normalizeState,
  prepareMarketListing,
  receiveMarketCoins,
  receiveMarketPet,
  resolveCombat,
  settleState,
  startActivity,
  startConstruction,
  startDungeon,
  startKeeperActivity,
  startKeeperConstruction,
  startKeeperProcessing,
  startKeeperRecipe,
  startProcessing,
  startRecipe,
  useHealingItem,
} from "./game-engine.js";
import { ACTIVITIES, BUILDINGS, DUNGEONS, ITEMS, PET_SPECIES, RECIPES, SKILLS, petActionDuration, scaledPetStats } from "./game-data.js";
import { friendlyAuthError } from "./auth-errors.js";

test("all 50 species have unique production art files", async () => {
  assert.equal(PET_SPECIES.length, 50);
  assert.equal(new Set(PET_SPECIES.map((species) => species.art)).size, 50);
  await Promise.all(PET_SPECIES.map((species) => access(new URL(species.art, import.meta.url))));
});

test("initial save has the locked capacities and starter", () => {
  const state = createInitialState("Test Keeper");
  assert.equal(state.profile.activeLimit, 6);
  assert.equal(state.profile.denCapacity, 12);
  assert.equal(state.pets.length, 1);
  assert.equal(state.pets[0].speciesId, "ash-raccoon");
  assert.equal(SKILLS.length, 14);
  assert.equal(state.equipment.weapon, "wooden-sword");
  assert.equal(state.profile.currentHp, keeperStats(state).maxHp);
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
  const finishAt = at + started.activities[0].durationMs + 100;
  const { state } = settleState(started, finishAt, () => 0.9);
  assert.equal(state.inventory["wild-berries"], 9);
  assert.equal(state.inventory.herb, 9);
  assert.equal(state.stats.actions, 1);
  assert.equal(state.activities.length, 1);
  assert.equal(state.activities[0].completedActions, 1);
});

test("frequent sync ticks preserve partial idle-action progress", () => {
  const at = 1_050_000;
  let state = createInitialState("Ticker");
  state.profile.lastSeenAt = at;
  state = startActivity(state, { petId: state.pets[0].id, activityId: "hedgerow", mealId: "camp-skewer" }, at);
  const duration = state.activities[0].durationMs;
  for (let seconds = 1; seconds <= Math.ceil(duration / 1000) + 1; seconds += 1) {
    ({ state } = settleState(state, at + seconds * 1_000, () => 0.9));
  }
  assert.equal(state.stats.actions, 1);
  assert.equal(state.inventory["wild-berries"], 9);
  assert.equal(state.activities[0].lastAt, at + duration);
});

test("cooking and Processing complete their resource loops", () => {
  const at = 1_100_000;
  let state = createInitialState("Cook");
  state.profile.lastSeenAt = at;
  delete state.inventory["camp-skewer"];
  state = startRecipe(state, { petId: state.pets[0].id, recipeId: "camp-skewer", mealId: "" }, at);
  ({ state } = settleState(state, state.activities[0].endAt + 100, () => 0.9));
  assert.equal(state.inventory["camp-skewer"], 3);
  assert.equal(state.inventory["raw-meat"], 3);
  assert.equal(state.inventory.herb, 7);
  state.remains.push({ id: "remain-test", speciesId: "moss-hare", source: "combat", acquiredAt: at });
  state = startProcessing(state, { petId: state.pets[0].id, remainId: "remain-test", mealId: "camp-skewer" }, at + 7_000);
  ({ state } = settleState(state, state.activities[0].endAt + 100, () => 0.9));
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

test("the Keeper can run a seventh personal timer beside six working pets", () => {
  const at = 1_250_000;
  let state = createInitialState("Working Keeper");
  for (let index = 0; index < 5; index += 1) state.pets.push(createPetInstance("moss-hare", "test"));
  state.inventory["camp-skewer"] = 20;
  for (const pet of state.pets) state = startActivity(state, { petId: pet.id, activityId: "hedgerow", mealId: "camp-skewer" }, at);
  state = startKeeperActivity(state, { activityId: "fallen-branches" }, at);
  assert.equal(state.activities.length, 6);
  assert.equal(state.keeperActivity.kind, "keeper");
  ({ state } = settleState(state, at + state.keeperActivity.durationMs + 100, () => 0));
  assert.equal(state.stats.keeperActions, 1);
  assert.ok(state.inventory["rough-log"] >= 13);
});

test("aptitude changes pet action time without preventing high-tier work", () => {
  const task = ACTIVITIES.find((entry) => entry.id === "magic-tree");
  const low = { ...PET_SPECIES.find((entry) => entry.id === "ash-raccoon"), aptitudes: { woodcutting: 1 } };
  const high = { ...low, aptitudes: { woodcutting: 10 } };
  const lowDuration = petActionDuration(task, low);
  const highDuration = petActionDuration(task, high);
  assert.ok(lowDuration > 10 * 60 * 1000);
  assert.equal(highDuration, task.duration * 1000);
  assert.ok(lowDuration > highDuration * 10);

  let state = createInitialState("Magic Logger");
  state.skills.woodcutting.level = 80;
  state = startActivity(state, { petId: state.pets[0].id, activityId: "magic-tree", mealId: "camp-skewer" }, 1_275_000);
  assert.equal(state.activities[0].taskId, "magic-tree");
});

test("the Keeper can cook, craft, process, and construct personally", () => {
  const at = 1_280_000;
  let state = createInitialState("Hands On");
  state = startKeeperRecipe(state, { recipeId: "camp-skewer" }, at);
  ({ state } = settleState(state, state.keeperActivity.endAt + 1));
  assert.equal(state.inventory["camp-skewer"], 21);

  state.remains.push({ id: "keeper-remains", speciesId: "moss-hare", source: "test", acquiredAt: at });
  state = startKeeperProcessing(state, { remainId: "keeper-remains" }, at + 10_000);
  ({ state } = settleState(state, state.keeperActivity.endAt + 1));
  assert.equal(state.stats.processed, 1);

  state.inventory["rough-log"] = 30;
  state.inventory.copper = 20;
  state = startKeeperConstruction(state, { buildingId: "den" }, at + 50_000);
  ({ state } = settleState(state, state.keeperActivity.endAt + 1));
  assert.equal(state.profile.denCapacity, 17);
  assert.ok(state.stats.keeperActions >= 3);
});

test("Construction expands hard capacity", () => {
  const at = 1_300_000;
  let state = createInitialState("Builder");
  const builder = createPetInstance("stoneback-boar", "test");
  state.pets.push(builder);
  state.inventory["rough-log"] = 30;
  state.inventory.copper = 8;
  state = startConstruction(state, { petId: builder.id, buildingId: "den", mealId: "camp-skewer" }, at);
  ({ state } = settleState(state, state.activities[0].endAt + 100, () => 0.9));
  assert.equal(state.buildings.den, 1);
  assert.equal(state.profile.denCapacity, 17);
  assert.equal(state.skills.construction.level, 2);
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

test("the Keeper can fight alone, trains a weapon style, and keeps combat injuries", () => {
  const state = createInitialState("Solo Keeper");
  const beforeHp = state.profile.currentHp;
  const beforeXp = state.skills.melee.xp;
  const result = resolveCombat(state, { petIds: [], speciesId: "moss-hare", mealId: "camp-skewer", includeKeeper: true, combatStyle: "melee" }, () => 0.2, 2_250_000);
  assert.equal(result.battle.team.length, 1);
  assert.equal(result.battle.team[0].kind, "keeper");
  assert.ok(result.state.skills.melee.xp > beforeXp);
  assert.ok(result.state.profile.currentHp <= beforeHp);
});

test("downed pets cannot work and healing supplies restore persistent health", () => {
  const state = createInitialState("Medic");
  state.pets[0].currentHp = 0;
  assert.throws(() => startActivity(state, { petId: state.pets[0].id, activityId: "hedgerow", mealId: "camp-skewer" }, 2_300_000), /downed/);
  const healed = useHealingItem(state, { itemId: "pet-tonic", targetType: "pet", petId: state.pets[0].id }, 2_300_100);
  assert.equal(healed.healed, 45);
  assert.equal(healed.state.pets[0].currentHp, 45);
  assert.equal(healed.state.inventory["pet-tonic"], 1);
});

test("the General Store and equipment screen enforce ownership and skill levels", () => {
  let state = createInitialState("Shopper");
  const coins = state.profile.coins;
  state = buyStoreItem(state, { itemId: "shortbow", quantity: 1 }, 2_350_000);
  assert.equal(state.inventory.shortbow, 1);
  assert.equal(state.profile.coins, coins - 55);
  state = equipItem(state, "shortbow", 2_350_100);
  assert.equal(state.equipment.weapon, "shortbow");
  state.inventory["iron-sword"] = 1;
  assert.throws(() => equipItem(state, "iron-sword", 2_350_200), /Melee level 20/);
});

test("old saves migrate to all Keeper systems without losing progress", () => {
  const legacy = createInitialState("Legacy");
  legacy.schemaVersion = 1;
  delete legacy.skills.melee;
  delete legacy.skills.ranged;
  delete legacy.skills.magic;
  delete legacy.equipment;
  delete legacy.profile.currentHp;
  delete legacy.pets[0].currentHp;
  legacy.profile.coins = 999;
  const migrated = normalizeState(legacy);
  assert.equal(migrated.schemaVersion, 2);
  assert.equal(migrated.skills.melee.level, 1);
  assert.equal(migrated.equipment.weapon, "wooden-sword");
  assert.equal(migrated.inventory["wooden-sword"], 1);
  assert.ok(migrated.inventory["field-ration"] >= 5);
  assert.equal(migrated.profile.coins, 999);
  assert.equal(migrated.pets[0].currentHp, scaledPetStats(migrated.pets[0]).hp);
});

test("combat playback exposes each fighter's persistent starting health", () => {
  const state = createInitialState("Injured Fighter");
  state.profile.currentHp = 40;
  state.pets[0].currentHp = 35;
  const result = resolveCombat(state, { petIds: [state.pets[0].id], speciesId: "moss-hare", mealId: "camp-skewer", includeKeeper: true, combatStyle: "melee" }, () => 0.2, 2_375_000);
  assert.equal(result.battle.team.find((entry) => entry.kind === "keeper").startingHp, 40);
  assert.equal(result.battle.team.find((entry) => entry.kind === "pet").startingHp, 35);
});

test("combat emits a timed event stream for the live battle screen", () => {
  const state = createInitialState("Live Fighter");
  state.pets[0].level = 20;
  state.pets[0].currentHp = scaledPetStats(state.pets[0]).hp;
  const result = resolveCombat(state, {
    petIds: [state.pets[0].id],
    speciesId: "moss-hare",
    mealId: "camp-skewer",
  }, () => 0.2, 2_500_000);
  const hits = result.battle.events.filter((event) => event.type === "hit");
  assert.ok(result.battle.duration > 0);
  assert.ok(hits.length > 0);
  assert.ok(hits.every((event) => event.time > 0 && Number.isFinite(event.targetHp)));
  const petFighter = result.battle.team.find((entry) => entry.kind === "pet");
  assert.equal(petFighter.level, 20);
  assert.equal(typeof petFighter.ability, "string");
  assert.equal(typeof result.battle.enemy.attackInterval, "number");
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
  assert.equal(next.pets[0].level, 1);
  assert.equal(next.pets[0].xp, 0);
  const baseStats = scaledPetStats({ speciesId: "ash-raccoon", stars: 1, level: 1 });
  const condensedStats = scaledPetStats(next.pets[0]);
  assert.equal(condensedStats.hp, Math.round(baseStats.hp * 1.1));
  assert.equal(next.pets[0].currentHp, condensedStats.hp);
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

test("the Spark-plan client has no paid Cloud Functions dependency", async () => {
  const source = await readFile(new URL("./firebase-client.js", import.meta.url), "utf8");
  const firebaseJson = JSON.parse(await readFile(new URL("./firebase.json", import.meta.url), "utf8"));
  let deployPackage;
  try {
    deployPackage = JSON.parse(await readFile(new URL("./firebase-package.json", import.meta.url), "utf8"));
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    deployPackage = JSON.parse(await readFile(new URL("./package.json", import.meta.url), "utf8"));
  }
  assert.doesNotMatch(source, /firebase-functions|httpsCallable|getFunctions/);
  assert.match(source, /runTransaction/);
  assert.equal(firebaseJson.functions, undefined);
  assert.equal(firebaseJson.storage, undefined);
  assert.equal(deployPackage.dependencies, undefined);
  assert.equal(deployPackage.scripts["deploy:backend"], "firebase deploy --only firestore:rules,firestore:indexes");
});

test("the UI exposes live work timers and non-animated combat feedback", async () => {
  const source = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const styles = await readFile(new URL("./styles.css", import.meta.url), "utf8");
  assert.match(source, /COMBAT_MIN_PLAYBACK_MS = 14000/);
  assert.match(source, /data-assignment-time/);
  assert.match(source, /data-attack-meter/);
  assert.match(source, /battle-log/);
  assert.match(source, /damage-number/);
  assert.doesNotMatch(source, /classList\.add\("attacking"\)/);
  assert.doesNotMatch(styles, /@keyframes strike/);
  assert.match(styles, /\.level-marker-row/);
});

test("Firestore rules keep saves private while enabling the family market", async () => {
  const rules = await readFile(new URL("./firestore.rules", import.meta.url), "utf8");
  assert.match(rules, /match \/players\/\{uid\}/);
  assert.match(rules, /allow read, create, update, delete: if owns\(uid\)/);
  assert.match(rules, /request\.resource\.data\.buyerUid == request\.auth\.uid/);
  assert.match(rules, /affectedKeys\(\)[\s\S]*hasOnly\(\['status', 'buyerUid', 'soldAt'\]\)/);
});

test("authentication errors give players an actionable next step", () => {
  assert.deepEqual(friendlyAuthError({ code: "auth/invalid-credential" }), [
    "Email or password not recognized.",
    "If this is your first visit, choose Create account. Google accounts should use Continue with Google.",
  ]);
  assert.deepEqual(friendlyAuthError({ code: "permission-denied" }), [
    "Your account signed in, but the den cannot save yet.",
    "Publish the Firestore rules included with the current release, then refresh the game.",
  ]);
  assert.deepEqual(friendlyAuthError({ name: "GameError", message: "Choose a cooked meal." }), ["Choose a cooked meal.", ""]);
});
