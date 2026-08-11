import {
  ACTIVITY_BY_ID,
  BUILDING_BY_ID,
  DUNGEON_BY_ID,
  GAME_VERSION,
  ITEMS,
  MAX_ACTIVE_PETS,
  MAX_COMBAT_PETS,
  OFFLINE_CAP_MS,
  PET_SPECIES,
  RECIPE_BY_ID,
  SKILLS,
  SPECIES_BY_ID,
  affinityMultiplier,
  aptitudeYield,
  levelCapForStars,
  scaledPetStats,
  xpForNextLevel,
} from "./game-data.js";

const TIER_XP = { Common: 24, Uncommon: 50, Rare: 125, "Area Boss": 300, Dungeon: 650 };
const safeClone = (value) => typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value));
const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const nowMs = () => Date.now();
const randomId = (prefix = "id") => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;

export class GameError extends Error {
  constructor(message, code = "failed-precondition") {
    super(message);
    this.name = "GameError";
    this.code = code;
  }
}

export function createPetInstance(speciesId, source = "starter") {
  const species = SPECIES_BY_ID[speciesId];
  if (!species) throw new GameError("Unknown pet species.", "not-found");
  return {
    id: randomId("pet"),
    speciesId,
    customName: "",
    stars: 1,
    level: 1,
    xp: 0,
    lifetimeXp: 0,
    source,
    acquiredAt: nowMs(),
    status: "idle",
  };
}

export function createInitialState(displayName = "Keeper") {
  const skills = Object.fromEntries(SKILLS.map((skill) => [skill.id, { level: 1, xp: 0 }]));
  return {
    schemaVersion: 1,
    gameVersion: GAME_VERSION,
    profile: {
      displayName: String(displayName || "Keeper").slice(0, 28),
      createdAt: nowMs(),
      lastSeenAt: nowMs(),
      coins: 160,
      activeLimit: MAX_ACTIVE_PETS,
      denCapacity: 12,
      storageCapacity: 40,
    },
    skills,
    buildings: { den: 0, storage: 0, smokehouse: 0, kitchen: 0, workshop: 0, "training-yard": 0, watchtower: 0, "mess-hall": 0, "prismatic-beacon": 0 },
    inventory: {
      "camp-skewer": 18,
      "raw-meat": 4,
      "raw-fish": 4,
      herb: 8,
      "wild-berries": 8,
      "rough-log": 12,
      copper: 8,
      "wild-fiber": 6,
    },
    pets: [createPetInstance("ash-raccoon")],
    activities: [],
    remains: [],
    dungeonRuns: [],
    pendingEncounter: null,
    discoveries: ["ash-raccoon"],
    journal: [
      { id: randomId("log"), at: nowMs(), text: "The den is ready. Your Ash Raccoon is waiting for its first assignment." },
    ],
    stats: { actions: 0, victories: 0, captures: 1, processed: 0, dungeonClears: 0, trades: 0 },
  };
}

export function normalizeState(raw, displayName = "Keeper") {
  const base = createInitialState(displayName);
  if (!raw || typeof raw !== "object") return base;
  const state = {
    ...base,
    ...safeClone(raw),
    profile: { ...base.profile, ...(raw.profile || {}) },
    skills: { ...base.skills, ...(raw.skills || {}) },
    buildings: { ...base.buildings, ...(raw.buildings || {}) },
    inventory: { ...(raw.inventory || {}) },
    pets: Array.isArray(raw.pets) ? raw.pets : base.pets,
    activities: Array.isArray(raw.activities) ? raw.activities : [],
    remains: Array.isArray(raw.remains) ? raw.remains : [],
    dungeonRuns: Array.isArray(raw.dungeonRuns) ? raw.dungeonRuns : [],
    journal: Array.isArray(raw.journal) ? raw.journal.slice(-80) : base.journal,
    discoveries: Array.isArray(raw.discoveries) ? raw.discoveries : base.discoveries,
    stats: { ...base.stats, ...(raw.stats || {}) },
  };
  state.profile.denCapacity = 12 + Number(state.buildings.den || 0) * 5;
  state.profile.storageCapacity = 40 + Number(state.buildings.storage || 0) * 20;
  state.profile.activeLimit = MAX_ACTIVE_PETS;
  state.gameVersion = GAME_VERSION;
  return state;
}

export function addJournal(state, text, at = nowMs()) {
  state.journal = [...(state.journal || []), { id: randomId("log"), at, text: String(text).slice(0, 180) }].slice(-80);
}

export function getPet(state, petId) {
  const found = state.pets.find((entry) => entry.id === petId);
  if (!found) throw new GameError("That pet is no longer in your den.", "not-found");
  return found;
}

export function skillLevel(state, skillId) {
  return Number(state.skills?.[skillId]?.level || 1);
}

export function activePetCount(state) {
  return state.pets.filter((entry) => entry.status && entry.status !== "idle" && !String(entry.status).startsWith("dungeon:")).length;
}

export function denCapacity(state) {
  return 12 + Number(state.buildings?.den || 0) * 5;
}

export function storageCapacity(state) {
  return 40 + Number(state.buildings?.storage || 0) * 20;
}

function nonzeroInventoryKeys(state) {
  return Object.values(state.inventory || {}).filter((quantity) => Number(quantity) > 0).length;
}

export function hasItems(state, costs = {}) {
  return Object.entries(costs).every(([itemId, amount]) => Number(state.inventory?.[itemId] || 0) >= Number(amount || 0));
}

export function removeItems(state, costs = {}) {
  if (!hasItems(state, costs)) throw new GameError("You do not have all required materials.");
  for (const [itemId, amount] of Object.entries(costs)) {
    state.inventory[itemId] = Math.max(0, Number(state.inventory[itemId] || 0) - Number(amount || 0));
    if (state.inventory[itemId] === 0) delete state.inventory[itemId];
  }
}

export function addItem(state, itemId, amount) {
  const quantity = Math.max(0, Math.floor(Number(amount || 0)));
  if (!quantity) return true;
  const isNewStack = !state.inventory[itemId] || state.inventory[itemId] <= 0;
  if (isNewStack && nonzeroInventoryKeys(state) >= storageCapacity(state)) return false;
  state.inventory[itemId] = Number(state.inventory[itemId] || 0) + quantity;
  return true;
}

function grantSkillXp(state, skillId, amount) {
  const skill = state.skills[skillId] || { level: 1, xp: 0 };
  skill.xp += Math.max(0, Math.floor(amount));
  while (skill.level < 100) {
    const needed = xpForNextLevel(skill.level, "skill");
    if (skill.xp < needed) break;
    skill.xp -= needed;
    skill.level += 1;
    addJournal(state, `${SKILLS.find((entry) => entry.id === skillId)?.name || skillId} reached level ${skill.level}.`);
  }
  state.skills[skillId] = skill;
}

export function grantPetXp(state, pet, amount) {
  const trainingBoost = state.buildings?.["training-yard"] ? 1.05 : 1;
  const granted = Math.max(0, Math.floor(Number(amount || 0) * trainingBoost));
  pet.xp = Number(pet.xp || 0) + granted;
  pet.lifetimeXp = Number(pet.lifetimeXp || 0) + granted;
  const cap = levelCapForStars(pet.stars);
  while (pet.level < cap) {
    const needed = xpForNextLevel(pet.level, "pet");
    if (pet.xp < needed) break;
    pet.xp -= needed;
    pet.level += 1;
    addJournal(state, `${SPECIES_BY_ID[pet.speciesId]?.name || "A pet"} reached level ${pet.level}.`);
  }
  if (pet.level >= cap) pet.xp = Math.min(pet.xp, xpForNextLevel(cap, "pet") - 1);
}

function requireIdlePet(state, petId) {
  const pet = getPet(state, petId);
  if (pet.status !== "idle") throw new GameError("That pet is already occupied.");
  return pet;
}

function requireActiveSpace(state, amount = 1) {
  if (activePetCount(state) + amount > MAX_ACTIVE_PETS) throw new GameError(`Only ${MAX_ACTIVE_PETS} pets can be active at once.`);
}

function consumeWorkingMeal(state, mealId) {
  const meal = ITEMS[mealId];
  if (!meal || meal.category !== "meal") throw new GameError("Choose a cooked meal.");
  removeItems(state, { [mealId]: 1 });
  const nutritionBoost = state.buildings?.["mess-hall"] ? 1.05 : 1;
  return Math.max(1, Math.floor(meal.nutrition * nutritionBoost));
}

function validateLevelRequirements(state, pet, task) {
  const species = SPECIES_BY_ID[pet.speciesId];
  if (!Number(species?.aptitudes?.[task.skill] || 0)) throw new GameError(`${species?.name || "That pet"} does not have ${task.skill} aptitude.`);
  if (skillLevel(state, task.skill) < Number(task.level || 1)) throw new GameError(`${task.name} requires ${task.skill} level ${task.level}.`);
  if (pet.level < Number(task.petLevel || task.level || 1)) throw new GameError(`${task.name} requires a pet at level ${task.petLevel || task.level}.`);
}

function actionDurationMs(task, mealId) {
  const mealBonus = Number(ITEMS[mealId]?.workBonus || 0);
  return Math.max(900, Number(task.duration || 5) * 1000 * (1 - mealBonus));
}

export function startActivity(rawState, { petId, activityId, mealId }, at = nowMs()) {
  const state = normalizeState(rawState);
  const task = ACTIVITY_BY_ID[activityId];
  if (!task) throw new GameError("Unknown activity.", "not-found");
  const pet = requireIdlePet(state, petId);
  requireActiveSpace(state);
  validateLevelRequirements(state, pet, task);
  const nutrition = consumeWorkingMeal(state, mealId);
  const id = randomId("work");
  const durationMs = actionDurationMs(task, mealId);
  state.activities.push({ id, kind: "activity", taskId: activityId, petId, mealId, nutrition, startedAt: at, lastAt: at, durationMs, status: "running" });
  pet.status = `activity:${id}`;
  addJournal(state, `${SPECIES_BY_ID[pet.speciesId].name} started ${task.name}.`, at);
  return state;
}

export function startRecipe(rawState, { petId, recipeId, mealId }, at = nowMs()) {
  const state = normalizeState(rawState);
  const recipe = RECIPE_BY_ID[recipeId];
  if (!recipe) throw new GameError("Unknown recipe.", "not-found");
  const pet = requireIdlePet(state, petId);
  requireActiveSpace(state);
  validateLevelRequirements(state, pet, recipe);
  removeItems(state, recipe.ingredients);
  if (recipe.skill !== "cooking") consumeWorkingMeal(state, mealId);
  const id = randomId("recipe");
  state.activities.push({ id, kind: "recipe", taskId: recipeId, petId, mealId, startedAt: at, endAt: at + actionDurationMs(recipe, mealId), status: "running" });
  pet.status = `recipe:${id}`;
  addJournal(state, `${SPECIES_BY_ID[pet.speciesId].name} started ${recipe.name}.`, at);
  return state;
}

function scaledBuildingCosts(building, currentLevel) {
  const scale = building.repeatable ? Math.pow(1.55, currentLevel) : 1;
  return Object.fromEntries(Object.entries(building.costs).filter(([, amount]) => amount > 0).map(([itemId, amount]) => [itemId, Math.ceil(amount * scale)]));
}

export function buildingCosts(state, buildingId) {
  const building = BUILDING_BY_ID[buildingId];
  if (!building) return {};
  return scaledBuildingCosts(building, Number(state.buildings?.[buildingId] || 0));
}

export function startConstruction(rawState, { petId, buildingId, mealId }, at = nowMs()) {
  const state = normalizeState(rawState);
  const building = BUILDING_BY_ID[buildingId];
  if (!building) throw new GameError("Unknown structure.", "not-found");
  const current = Number(state.buildings?.[buildingId] || 0);
  if (current >= Number(building.maxLevel || 1)) throw new GameError("That structure is already complete.");
  const pet = requireIdlePet(state, petId);
  if (!Number(SPECIES_BY_ID[pet.speciesId]?.aptitudes?.construction || 0)) throw new GameError(`${SPECIES_BY_ID[pet.speciesId].name} does not have construction aptitude.`);
  requireActiveSpace(state);
  removeItems(state, scaledBuildingCosts(building, current));
  consumeWorkingMeal(state, mealId);
  const id = randomId("build");
  state.activities.push({ id, kind: "construction", taskId: buildingId, petId, mealId, startedAt: at, endAt: at + actionDurationMs(building, mealId), status: "running" });
  pet.status = `construction:${id}`;
  addJournal(state, `${SPECIES_BY_ID[pet.speciesId].name} started building ${building.name}.`, at);
  return state;
}

export function startProcessing(rawState, { petId, remainId, mealId }, at = nowMs()) {
  const state = normalizeState(rawState);
  const pet = requireIdlePet(state, petId);
  if (!Number(SPECIES_BY_ID[pet.speciesId]?.aptitudes?.processing || 0)) throw new GameError(`${SPECIES_BY_ID[pet.speciesId].name} does not have processing aptitude.`);
  requireActiveSpace(state);
  const remains = state.remains.find((entry) => entry.id === remainId);
  if (!remains) throw new GameError("Those remains are no longer available.", "not-found");
  consumeWorkingMeal(state, mealId);
  state.remains = state.remains.filter((entry) => entry.id !== remainId);
  const id = randomId("process");
  const aptitude = Number(SPECIES_BY_ID[pet.speciesId]?.aptitudes.processing || 1);
  const durationMs = Math.max(4000, 18000 - aptitude * 1800);
  state.activities.push({ id, kind: "processing", taskId: remains.speciesId, petId, mealId, startedAt: at, endAt: at + durationMs, status: "running" });
  pet.status = `processing:${id}`;
  addJournal(state, `${SPECIES_BY_ID[pet.speciesId].name} started Processing ${SPECIES_BY_ID[remains.speciesId].name}.`, at);
  return state;
}

function completeRepeatedActivity(state, assignment, pet, task, actions, random, events) {
  const species = SPECIES_BY_ID[pet.speciesId];
  const aptitude = Number(species.aptitudes[task.skill] || 1);
  const structureBonus = task.skill === "mischief" && state.buildings.watchtower ? 0.08 : 0;
  for (let index = 0; index < actions; index += 1) {
    const burst = aptitudeYield(aptitude, random);
    const mealBonus = Number(ITEMS[assignment.mealId]?.workBonus || 0);
    const extraRoll = random() < mealBonus + structureBonus ? 1 : 0;
    for (const [itemId, baseAmount] of Object.entries(task.rewards || {})) {
      const quantity = Number(baseAmount) * (burst + extraRoll);
      if (!addItem(state, itemId, quantity)) {
        assignment.status = "storage-full";
        events.push({ type: "stopped", text: `${task.name} stopped because storage is full.` });
        return index;
      }
    }
    state.profile.coins += Math.round(Number(task.coins || 0) * (1 + structureBonus));
    grantSkillXp(state, task.skill, task.xp);
    grantSkillXp(state, "petMastery", Math.max(2, Math.floor(task.xp * 0.24)));
    grantPetXp(state, pet, Math.max(5, Math.floor(task.xp * 0.78)));
    state.stats.actions += 1;
  }
  events.push({ type: "activity", text: `${species.name} completed ${actions} ${task.name} action${actions === 1 ? "" : "s"}.` });
  return actions;
}

function finishAssignment(state, assignment, pet, random, events) {
  if (assignment.kind === "recipe") {
    const recipe = RECIPE_BY_ID[assignment.taskId];
    const species = SPECIES_BY_ID[pet.speciesId];
    const aptitude = Number(species.aptitudes[recipe.skill] || 1);
    const facilityBonus = recipe.skill === "cooking" && state.buildings.kitchen ? 0.08 : recipe.skill === "crafting" && state.buildings.workshop ? 0.08 : 0;
    const burst = aptitudeYield(aptitude, random) + (random() < facilityBonus ? 1 : 0);
    for (const [itemId, amount] of Object.entries(recipe.output)) addItem(state, itemId, Number(amount) * burst);
    grantSkillXp(state, recipe.skill, recipe.xp);
    grantSkillXp(state, "petMastery", Math.floor(recipe.xp * 0.25));
    grantPetXp(state, pet, Math.floor(recipe.xp * 0.8));
    events.push({ type: "complete", text: `${species.name} completed ${recipe.name} and produced ${burst} batch${burst === 1 ? "" : "es"}.` });
  } else if (assignment.kind === "construction") {
    const building = BUILDING_BY_ID[assignment.taskId];
    state.buildings[building.id] = Number(state.buildings[building.id] || 0) + 1;
    state.profile.denCapacity = denCapacity(state);
    state.profile.storageCapacity = storageCapacity(state);
    const xp = Math.max(40, Math.round(building.duration * 1.8));
    grantSkillXp(state, "construction", xp);
    grantSkillXp(state, "petMastery", Math.floor(xp * 0.22));
    grantPetXp(state, pet, Math.floor(xp * 0.72));
    events.push({ type: "complete", text: `${building.name} is complete.` });
  } else if (assignment.kind === "processing") {
    const target = SPECIES_BY_ID[assignment.taskId];
    const processor = SPECIES_BY_ID[pet.speciesId];
    const aptitude = Number(processor.aptitudes.processing || 1);
    const burst = aptitudeYield(aptitude, random);
    const facilityScale = state.buildings.smokehouse ? 1.1 : 1;
    for (const [itemId, amount] of Object.entries(target.materials || {})) addItem(state, itemId, Math.max(1, Math.floor(Number(amount) * burst * facilityScale)));
    const xp = 22 + (REGIONS_INDEX[target.region] || 0) * 28;
    grantSkillXp(state, "processing", xp);
    grantSkillXp(state, "petMastery", Math.floor(xp * 0.2));
    grantPetXp(state, pet, Math.floor(xp * 0.72));
    state.stats.processed += 1;
    events.push({ type: "complete", text: `${processor.name} finished Processing ${target.name}.` });
  }
  pet.status = "idle";
}

const REGIONS_INDEX = { greenhollow: 0, copperwood: 1, sunscar: 2, stormreach: 3, starfall: 4 };
const HUNT_TIER_OFFSET = { Common: 0, Uncommon: 5, Rare: 12, "Area Boss": 19 };

export function combatRequirement(speciesOrId) {
  const species = typeof speciesOrId === "string" ? SPECIES_BY_ID[speciesOrId] : speciesOrId;
  if (!species || species.acquisition === "Dungeon") return Infinity;
  return Math.min(100, 1 + (REGIONS_INDEX[species.region] || 0) * 20 + Number(HUNT_TIER_OFFSET[species.acquisition] || 0));
}

export function settleState(rawState, at = nowMs(), random = Math.random) {
  const state = normalizeState(rawState);
  const events = [];
  const retained = [];
  const lowerBound = at - OFFLINE_CAP_MS;
  for (const assignment of state.activities) {
    const pet = state.pets.find((entry) => entry.id === assignment.petId);
    if (!pet) continue;
    if (assignment.kind === "activity") {
      const task = ACTIVITY_BY_ID[assignment.taskId];
      if (!task) { pet.status = "idle"; continue; }
      assignment.lastAt = Math.max(Number(assignment.lastAt || lowerBound), lowerBound);
      const due = Math.max(0, Math.floor((at - assignment.lastAt) / assignment.durationMs));
      let completed = 0;
      let shouldStop = false;
      for (let index = 0; index < due; index += 1) {
        if (assignment.nutrition <= 0) {
          if (Number(state.inventory[assignment.mealId] || 0) <= 0) {
            shouldStop = true;
            events.push({ type: "stopped", text: `${SPECIES_BY_ID[pet.speciesId].name} stopped ${task.name}: no ${ITEMS[assignment.mealId]?.name || "meal"} remains.` });
            break;
          }
          assignment.nutrition = consumeWorkingMeal(state, assignment.mealId);
        }
        const done = completeRepeatedActivity(state, assignment, pet, task, 1, random, events);
        if (!done) { shouldStop = true; break; }
        assignment.nutrition -= 1;
        assignment.lastAt += assignment.durationMs;
        completed += 1;
      }
      if (shouldStop || assignment.status === "storage-full") {
        pet.status = "idle";
      } else {
        retained.push(assignment);
      }
      if (completed > 1) events.push({ type: "summary", text: `${completed} total actions settled while you were away.` });
    } else if (Number(assignment.endAt || 0) <= at) {
      finishAssignment(state, assignment, pet, random, events);
    } else {
      retained.push(assignment);
    }
  }
  state.activities = retained;
  state.profile.lastSeenAt = at;
  for (const event of events.slice(-12)) addJournal(state, event.text, at);
  return { state, events };
}

export function stopActivity(rawState, activityId, at = nowMs()) {
  const { state } = settleState(rawState, at);
  const assignment = state.activities.find((entry) => entry.id === activityId);
  if (!assignment) return state;
  const pet = state.pets.find((entry) => entry.id === assignment.petId);
  if (pet) pet.status = "idle";
  state.activities = state.activities.filter((entry) => entry.id !== activityId);
  addJournal(state, `${pet ? SPECIES_BY_ID[pet.speciesId].name : "A pet"} stopped its assignment.`, at);
  return state;
}

function combatantFromPet(pet) {
  const species = SPECIES_BY_ID[pet.speciesId];
  const stats = scaledPetStats(pet);
  return { id: pet.id, name: pet.customName || species.name, speciesId: pet.speciesId, affinity: species.affinity, ability: species.ability, maxHp: stats.hp, hp: stats.hp, attack: stats.attack, defense: stats.defense, speed: stats.speed, charge: 0, attacks: 0, alive: true };
}

function enemyCombatant(speciesId) {
  const species = SPECIES_BY_ID[speciesId];
  if (!species) throw new GameError("Unknown opponent.", "not-found");
  const band = REGIONS_INDEX[species.region] || 0;
  const level = 6 + band * 20;
  const stats = scaledPetStats({ speciesId, level, stars: Math.min(5, band + 1) });
  const bossScale = species.acquisition === "Area Boss" ? 1.35 : species.acquisition === "Dungeon" ? 1.65 : 1;
  return { id: `enemy-${speciesId}`, name: species.name, speciesId, affinity: species.affinity, ability: species.ability, maxHp: Math.round(stats.hp * bossScale), hp: Math.round(stats.hp * bossScale), attack: Math.round(stats.attack * bossScale), defense: Math.round(stats.defense * bossScale), speed: stats.speed, charge: 0, attacks: 0, alive: true, level };
}

function attackInterval(speed) {
  return clamp(4100 - Number(speed) * 55, 850, 3800);
}

function damageRoll(attacker, defender, abilityPower, random) {
  const affinity = affinityMultiplier(attacker.affinity, defender.affinity);
  const variance = 0.9 + random() * 0.2;
  const critical = random() < clamp(0.04 + attacker.speed / 1000, 0.04, 0.18);
  const raw = attacker.attack * abilityPower * affinity * variance * (critical ? 1.55 : 1);
  return { amount: Math.max(1, Math.round(raw - defender.defense * 0.42)), critical, affinity };
}

export function resolveCombat(rawState, { petIds, speciesId, mealId }, random = Math.random, at = nowMs()) {
  const state = normalizeState(rawState);
  if (state.pendingEncounter) throw new GameError("Resolve the current capture opportunity first.");
  const ids = [...new Set(Array.isArray(petIds) ? petIds : [])];
  if (!ids.length) throw new GameError("Choose at least one combat pet.");
  if (ids.length > MAX_COMBAT_PETS) throw new GameError(`Combat parties can contain at most ${MAX_COMBAT_PETS} pets.`);
  requireActiveSpace(state, ids.length);
  const pets = ids.map((id) => requireIdlePet(state, id));
  const enemySpecies = SPECIES_BY_ID[speciesId];
  if (!enemySpecies) throw new GameError("Unknown opponent.", "not-found");
  if (enemySpecies.acquisition === "Dungeon") throw new GameError(`${enemySpecies.name} can only be encountered in a dungeon.`);
  const requiredCombat = combatRequirement(enemySpecies);
  if (skillLevel(state, "combat") < requiredCombat) throw new GameError(`${enemySpecies.name} requires Combat level ${requiredCombat}.`);
  if (!ITEMS[mealId] || ITEMS[mealId].category !== "meal") throw new GameError("Choose a combat meal.");
  if (Number(state.inventory[mealId] || 0) < 1) throw new GameError(`You do not have any ${ITEMS[mealId].name}.`);

  const team = pets.map(combatantFromPet);
  const enemy = enemyCombatant(speciesId);
  const events = [{ time: 0, type: "start", enemy: { name: enemy.name, hp: enemy.hp }, team: team.map((pet) => ({ id: pet.id, name: pet.name, hp: pet.hp })) }];
  let time = 0;
  let safety = 0;
  while (enemy.alive && team.some((entry) => entry.alive) && time < 120000 && safety < 1000) {
    safety += 1;
    const aliveTeam = team.filter((entry) => entry.alive);
    const nextPet = aliveTeam.reduce((best, entry) => Math.min(best, attackInterval(entry.speed) - entry.charge), Infinity);
    const nextEnemy = attackInterval(enemy.speed) - enemy.charge;
    const step = Math.max(1, Math.min(nextPet, nextEnemy));
    time += step;
    for (const member of aliveTeam) member.charge += step;
    enemy.charge += step;

    for (const attacker of aliveTeam) {
      if (attacker.charge + 0.1 < attackInterval(attacker.speed) || !enemy.alive) continue;
      attacker.charge -= attackInterval(attacker.speed);
      attacker.attacks += 1;
      const usesAbility = attacker.attacks % Number(attacker.ability.cooldown || 4) === 0;
      const hit = damageRoll(attacker, enemy, usesAbility ? attacker.ability.power : 1, random);
      enemy.hp = Math.max(0, enemy.hp - hit.amount);
      enemy.alive = enemy.hp > 0;
      events.push({ time, type: "hit", sourceId: attacker.id, targetId: enemy.id, amount: hit.amount, critical: hit.critical, strong: hit.affinity > 1, ability: usesAbility ? attacker.ability.name : null, targetHp: enemy.hp, targetMaxHp: enemy.maxHp });
    }
    if (!enemy.alive) break;

    if (enemy.charge + 0.1 >= attackInterval(enemy.speed)) {
      enemy.charge -= attackInterval(enemy.speed);
      enemy.attacks += 1;
      const candidates = team.filter((entry) => entry.alive);
      const target = candidates[Math.floor(random() * candidates.length)];
      const usesAbility = enemy.attacks % Number(enemy.ability.cooldown || 4) === 0;
      const hit = damageRoll(enemy, target, usesAbility ? enemy.ability.power : 1, random);
      target.hp = Math.max(0, target.hp - hit.amount);
      target.alive = target.hp > 0;
      events.push({ time, type: "hit", sourceId: enemy.id, targetId: target.id, amount: hit.amount, critical: hit.critical, strong: hit.affinity > 1, ability: usesAbility ? enemy.ability.name : null, targetHp: target.hp, targetMaxHp: target.maxHp });

      if (target.alive && target.hp / target.maxHp < 0.38 && Number(state.inventory[mealId] || 0) > 0) {
        removeItems(state, { [mealId]: 1 });
        const healed = Math.min(target.maxHp - target.hp, Number(ITEMS[mealId].heal || 10));
        target.hp += healed;
        events.push({ time: time + 40, type: "heal", targetId: target.id, amount: healed, targetHp: target.hp, targetMaxHp: target.maxHp, mealId });
      }
    }
  }

  const victory = !enemy.alive;
  if (victory) {
    const band = REGIONS_INDEX[enemySpecies.region] || 0;
    const xp = 24 + band * 42 + (enemySpecies.acquisition === "Area Boss" ? 80 : 0);
    grantSkillXp(state, "combat", xp);
    grantSkillXp(state, "petMastery", Math.floor(xp * 0.2));
    for (const pet of pets) grantPetXp(state, pet, Math.floor(xp * 0.9));
    state.pendingEncounter = { speciesId, createdAt: at, source: "combat" };
    state.stats.victories += 1;
    if (!state.discoveries.includes(speciesId)) state.discoveries.push(speciesId);
    addJournal(state, `${enemySpecies.name} was defeated. Choose whether to capture or Process it.`, at);
  } else {
    addJournal(state, `The party withdrew from ${enemySpecies.name}. No pets were lost.`, at);
  }
  events.push({ time: time + 80, type: "end", victory, enemyHp: enemy.hp, team: team.map((entry) => ({ id: entry.id, hp: entry.hp, maxHp: entry.maxHp })) });
  return { state, battle: { victory, duration: time, events, enemy: { id: enemy.id, speciesId, name: enemy.name, affinity: enemy.affinity, maxHp: enemy.maxHp, attackInterval: attackInterval(enemy.speed) }, team: team.map((entry) => ({ id: entry.id, name: entry.name, speciesId: entry.speciesId, maxHp: entry.maxHp, attackInterval: attackInterval(entry.speed) })) } };
}

function addRemains(state, speciesId, source = "combat") {
  state.remains.push({ id: randomId("remains"), speciesId, source, acquiredAt: nowMs() });
}

export function attemptCapture(rawState, mealId, random = Math.random, at = nowMs()) {
  const state = normalizeState(rawState);
  const encounter = state.pendingEncounter;
  if (!encounter) throw new GameError("There is no capture opportunity.");
  const meal = ITEMS[mealId];
  if (!meal || meal.category !== "meal") throw new GameError("Capturing requires a cooked meal.");
  if (state.pets.length >= denCapacity(state)) throw new GameError("Your den is full. Expand it or make room before capturing another pet.");
  removeItems(state, { [mealId]: 1 });
  const species = SPECIES_BY_ID[encounter.speciesId];
  const masteryBonus = Math.max(0, skillLevel(state, "petMastery") - 1) * 0.0005;
  const chance = clamp(species.captureRate + Number(meal.captureBonus || 0) + masteryBonus, 0.001, 0.8);
  const roll = random();
  const success = roll < chance;
  if (success) {
    const instance = createPetInstance(species.id, encounter.source);
    state.pets.push(instance);
    state.stats.captures += 1;
    if (!state.discoveries.includes(species.id)) state.discoveries.push(species.id);
    addJournal(state, `${species.name} accepted the ${meal.name} and joined your den.`, at);
  } else {
    addRemains(state, species.id, encounter.source);
    addJournal(state, `${species.name} refused the meal. Its remains are ready for Processing.`, at);
  }
  state.pendingEncounter = null;
  return { state, capture: { success, chance, roll, speciesId: species.id } };
}

export function declineCapture(rawState, at = nowMs()) {
  const state = normalizeState(rawState);
  if (!state.pendingEncounter) throw new GameError("There is no encounter to Process.");
  const speciesId = state.pendingEncounter.speciesId;
  addRemains(state, speciesId, state.pendingEncounter.source);
  state.pendingEncounter = null;
  addJournal(state, `${SPECIES_BY_ID[speciesId].name} was sent to the Processing queue.`, at);
  return state;
}

export function sacrificePet(rawState, { donorId, recipientId }, at = nowMs()) {
  const state = normalizeState(rawState);
  if (donorId === recipientId) throw new GameError("Choose two different pets.");
  const donor = requireIdlePet(state, donorId);
  const recipient = requireIdlePet(state, recipientId);
  const donorSpecies = SPECIES_BY_ID[donor.speciesId];
  const relevance = clamp(Math.pow((Number(donor.level) + 10) / (Number(recipient.level) + 10), 2), 0.01, 1);
  const speciesValue = Number(TIER_XP[donorSpecies.acquisition] || 20) * Number(donor.level || 1) * Number(donor.stars || 1);
  const transferred = Math.max(1, Math.floor((speciesValue + Number(donor.lifetimeXp || 0) * 0.3) * relevance));
  state.pets = state.pets.filter((entry) => entry.id !== donorId);
  grantPetXp(state, recipient, transferred);
  addJournal(state, `${donorSpecies.name} was sacrificed, granting ${transferred.toLocaleString()} XP.`, at);
  return { state, xp: transferred };
}

export function condensePets(rawState, { primaryId, duplicateId }, at = nowMs()) {
  const state = normalizeState(rawState);
  if (primaryId === duplicateId) throw new GameError("Choose two different pets.");
  const primary = requireIdlePet(state, primaryId);
  const duplicate = requireIdlePet(state, duplicateId);
  if (primary.speciesId !== duplicate.speciesId) throw new GameError("Condensing requires two pets of the same species.");
  if (primary.stars !== duplicate.stars) throw new GameError("Both pets must have the same star rank.");
  if (primary.stars >= 5) throw new GameError("This pet is already 5★.");
  const cap = levelCapForStars(primary.stars);
  if (primary.level < cap || duplicate.level < cap) throw new GameError(`Both pets must reach level ${cap} before Condensing.`);
  primary.stars += 1;
  primary.xp = 0;
  state.pets = state.pets.filter((entry) => entry.id !== duplicateId);
  addJournal(state, `Two ${SPECIES_BY_ID[primary.speciesId].name} pets condensed into a ${primary.stars}★ pet.`, at);
  return state;
}

export function dungeonChance(state, dungeonId, petIds) {
  const dungeon = DUNGEON_BY_ID[dungeonId];
  if (!dungeon) return { chance: 0, power: 0, affinityMatches: 0 };
  const pets = petIds.map((id) => state.pets.find((entry) => entry.id === id)).filter(Boolean);
  const power = pets.reduce((sum, entry) => sum + scaledPetStats(entry).power, 0);
  const affinityMatches = pets.filter((entry) => SPECIES_BY_ID[entry.speciesId].affinity === dungeon.favored).length;
  const ratio = power / dungeon.recommendedPower;
  const beaconBonus = state.buildings?.["prismatic-beacon"] ? 0.04 : 0;
  const chance = ratio >= 1.5 ? 1 : clamp(0.08 + ratio * 0.62 + affinityMatches * 0.08 + beaconBonus, 0.08, 0.96);
  return { chance, power, affinityMatches };
}

export function startDungeon(rawState, { dungeonId, petIds }, at = nowMs()) {
  const state = normalizeState(rawState);
  const dungeon = DUNGEON_BY_ID[dungeonId];
  if (!dungeon) throw new GameError("Unknown dungeon.", "not-found");
  if (skillLevel(state, "combat") < dungeon.level) throw new GameError(`${dungeon.name} requires Combat level ${dungeon.level}.`);
  const ids = [...new Set(Array.isArray(petIds) ? petIds : [])];
  if (!ids.length || ids.length > MAX_COMBAT_PETS) throw new GameError("Choose one to three dungeon pets.");
  ids.forEach((id) => requireIdlePet(state, id));
  removeItems(state, dungeon.entry);
  const odds = dungeonChance(state, dungeonId, ids);
  const id = randomId("dungeon");
  state.dungeonRuns.push({ id, dungeonId, petIds: ids, startedAt: at, endAt: at + dungeon.duration * 1000, chance: odds.chance, power: odds.power, affinityMatches: odds.affinityMatches, status: "running" });
  for (const petId of ids) getPet(state, petId).status = `dungeon:${id}`;
  addJournal(state, `${dungeon.name} expedition departed with a ${Math.round(odds.chance * 100)}% success chance.`, at);
  return state;
}

export function claimDungeon(rawState, runId, random = Math.random, at = nowMs()) {
  const state = normalizeState(rawState);
  const run = state.dungeonRuns.find((entry) => entry.id === runId);
  if (!run) throw new GameError("Dungeon run not found.", "not-found");
  if (run.endAt > at) throw new GameError("That expedition has not returned yet.");
  const dungeon = DUNGEON_BY_ID[run.dungeonId];
  const success = random() < run.chance;
  const scale = success ? 1 : 0.25;
  for (const [itemId, amount] of Object.entries(dungeon.rewards)) addItem(state, itemId, Math.max(1, Math.floor(Number(amount) * scale)));
  const xp = Math.round(dungeon.level * (success ? 5 : 1.5));
  grantSkillXp(state, "combat", xp);
  for (const petId of run.petIds) {
    const pet = state.pets.find((entry) => entry.id === petId);
    if (pet) { pet.status = "idle"; grantPetXp(state, pet, Math.floor(xp * 0.8)); }
  }
  let encounter = false;
  if (success && !state.pendingEncounter && random() < dungeon.encounterChance) {
    state.pendingEncounter = { speciesId: dungeon.encounter, createdAt: at, source: "dungeon" };
    encounter = true;
  }
  if (success) state.stats.dungeonClears += 1;
  state.dungeonRuns = state.dungeonRuns.filter((entry) => entry.id !== runId);
  addJournal(state, `${dungeon.name} ${success ? "was cleared" : "ended in a partial retreat"}.${encounter ? " A rare pet is waiting for a capture attempt." : ""}`, at);
  return { state, result: { success, encounter, chance: run.chance } };
}

export function prepareMarketListing(rawState, { petId, price }, at = nowMs()) {
  const state = normalizeState(rawState);
  if (state.pets.length <= 1) throw new GameError("Keep at least one pet in your den before listing another.");
  const pet = requireIdlePet(state, petId);
  const amount = Math.floor(Number(price));
  if (!Number.isFinite(amount) || amount < 10 || amount > 1000000000) throw new GameError("Choose a price between 10 and 1,000,000,000 coins.");
  const fee = Math.max(5, Math.ceil(amount * 0.02));
  if (state.profile.coins < fee) throw new GameError(`Listing this pet costs ${fee.toLocaleString()} coins.`);
  state.profile.coins -= fee;
  state.pets = state.pets.filter((entry) => entry.id !== petId);
  const species = SPECIES_BY_ID[pet.speciesId];
  addJournal(state, `${species.name} was listed for ${amount.toLocaleString()} coins.`, at);
  return { state, listing: { pet: safeClone(pet), price: amount, fee, speciesId: pet.speciesId, createdAt: at } };
}

export function restoreCancelledListing(rawState, listingPet, at = nowMs()) {
  const state = normalizeState(rawState);
  if (state.pets.length >= denCapacity(state)) throw new GameError("Make room in the den before cancelling this listing.");
  state.pets.push(safeClone(listingPet));
  addJournal(state, `${SPECIES_BY_ID[listingPet.speciesId].name} returned from the marketplace.`, at);
  return state;
}

export function receiveMarketPet(rawState, listingPet, price, at = nowMs()) {
  const state = normalizeState(rawState);
  if (state.pets.length >= denCapacity(state)) throw new GameError("Your den is full.");
  if (state.profile.coins < price) throw new GameError("You do not have enough coins.");
  state.profile.coins -= price;
  const pet = safeClone(listingPet);
  pet.status = "idle";
  pet.intake = false;
  pet.lastTradedAt = at;
  pet.tradeCount = Number(pet.tradeCount || 0) + 1;
  state.pets.push(pet);
  state.stats.trades += 1;
  addJournal(state, `${SPECIES_BY_ID[pet.speciesId].name} was purchased for ${Number(price).toLocaleString()} coins.`, at);
  return state;
}

export function receiveMarketCoins(rawState, amount, at = nowMs()) {
  const state = normalizeState(rawState);
  state.profile.coins += Math.max(0, Math.floor(Number(amount || 0)));
  state.stats.trades += 1;
  addJournal(state, `A marketplace sale delivered ${Number(amount).toLocaleString()} coins.`, at);
  return state;
}

export function publicProfile(state, uid = "local") {
  const totalSkill = Object.values(state.skills || {}).reduce((sum, entry) => sum + Number(entry.level || 1), 0);
  const petPower = state.pets.reduce((sum, entry) => sum + scaledPetStats(entry).power, 0);
  return {
    uid,
    displayName: state.profile.displayName,
    totalSkill,
    petPower,
    captures: state.stats.captures,
    dungeonClears: state.stats.dungeonClears,
    updatedAt: nowMs(),
  };
}

export function listAvailableOpponents(state) {
  const combat = skillLevel(state, "combat");
  return PET_SPECIES.filter((species) => combat >= combatRequirement(species));
}
