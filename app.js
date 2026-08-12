import {
  ACTIVITIES,
  BUILDINGS,
  DUNGEONS,
  EQUIPMENT_SLOTS,
  GAME_NAME,
  GAME_VERSION,
  ITEMS,
  MAX_ACTIVE_PETS,
  MAX_COMBAT_PETS,
  PET_SPECIES,
  RECIPES,
  REGIONS,
  SKILLS,
  SPECIES_BY_ID,
  STORE_ITEMS,
  inventoryName,
  levelCapForStars,
  scaledPetStats,
  xpForNextLevel,
} from "./game-data.js";
import {
  GameError,
  activePetCount,
  attemptCapture,
  buyStoreItem,
  buildingCosts,
  claimDungeon,
  condensePets,
  constructionRequirement,
  createInitialState,
  createPetInstance,
  declineCapture,
  denCapacity,
  dungeonChance,
  equipItem,
  keeperStats,
  listAreaOpponents,
  normalizeState,
  processingCoinReward,
  prepareMarketListing,
  receiveMarketPet,
  resolveAreaCombat,
  resolveCombat,
  restoreCancelledListing,
  sacrificePet,
  settleState,
  skillLevel,
  startActivity,
  startKeeperActivity,
  startKeeperConstruction,
  startKeeperProcessing,
  startKeeperRecipe,
  startConstruction,
  startDungeon,
  startProcessing,
  startRecipe,
  stopActivity,
  stopKeeperActivity,
  storageCapacity,
  useHealingItem,
} from "./game-engine.js";
import { connectFirebase } from "./firebase-client.js";
import { friendlyAuthError } from "./auth-errors.js";
import { playSound, soundEnabled, toggleSound } from "./sound-manager.js";

const LOCAL_SAVE = "pet-idle-mmo-local-v1";
const COMBAT_SETUP_KEY = "wilderden-combat-setup-v1";
const PLACEHOLDER_ART = "pets/ash-raccoon.png";
const previewEnabled = new URLSearchParams(window.location.search).get("preview") === "1"
  && ["localhost", "127.0.0.1", "[::1]", "terminal.local"].includes(window.location.hostname);
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const panel = $("#panel");
const modal = $("#game-modal");
const modalContent = $("#modal-content");

let gameState = null;
let mode = "auth";
let firebase = null;
let currentUser = null;
let currentPanel = "overview";
let currentSkill = "foraging";
let inventoryFilter = "all";
let marketListings = [];
let leaderboard = [];
let selectedCombatPets = new Set();
let selectedCombatRegion = "greenhollow";
let selectedDungeonPets = new Set();
let battleTimers = [];
let activeBattle = null;
let autoHuntSession = null;
let autoHuntTimer = null;
let combatRequestInProgress = false;
let renderQueued = false;
let authMode = "signin";
let authActionInProgress = false;
let authLoadPromise = null;
let loadedUserId = null;

const COMBAT_MIN_PLAYBACK_MS = 14000;
const COMBAT_MAX_PLAYBACK_MS = 45000;

function readCombatSetup() {
  try {
    const saved = JSON.parse(localStorage.getItem(COMBAT_SETUP_KEY) || "null");
    return saved && typeof saved === "object" ? saved : {};
  } catch {
    return {};
  }
}

function writeCombatSetup(setup) {
  try { localStorage.setItem(COMBAT_SETUP_KEY, JSON.stringify(setup)); } catch { /* Preferences are optional. */ }
}

const affinityColors = {
  Ember: ["#b85b38", "#f2d2bf"], Verdant: ["#668353", "#dce8cf"], Tide: ["#4c7890", "#d4e7ec"],
  Stone: ["#726e62", "#e2ded2"], Spark: ["#b68a35", "#f1e4b9"], Gale: ["#63898a", "#d5e8e3"],
  Radiant: ["#b78a41", "#f1e5bf"], Umbral: ["#60536f", "#ded5e8"], Frost: ["#668ca7", "#d8e8f0"],
};

const skillColors = {
  woodcutting: "#2f9d68", mining: "#6776ad", foraging: "#7aa443", fishing: "#338fc0", mischief: "#8c5eb5",
  processing: "#da7657", cooking: "#e29a3f", crafting: "#6c7fbe", construction: "#a76d45",
  combat: "#d65558", melee: "#c85f46", ranged: "#3f9d70", magic: "#7161c5", petMastery: "#d18a36",
};

const itemIconPaths = {
  meal: `<path d="M10 27h28c-2 9-7 13-14 13S12 36 10 27Z"/><path d="M14 23c4-5 16-5 20 0M18 18c-1-4 1-7 4-10m6 10c2-4 1-7-1-10"/>`,
  medicine: `<path d="M18 7h12v7l4 5v21H14V19l4-5V7Z"/><path d="M18 12h12M19 28h10M24 23v10"/>`,
  weapon: `<path d="m11 39 7-7m-3-3 4 4m4-8L37 9l2 2-14 16-6 2 2-6Z"/><path d="m9 36 3 3"/>`,
  armor: `<path d="M24 6c6 5 11 6 16 7v10c0 10-6 16-16 20C14 39 8 33 8 23V13c5-1 10-2 16-7Z"/><path d="M24 14v21M15 21h18"/>`,
  tool: `<path d="m10 38 16-19m-5-4c5-5 12-5 17-1l-7 7-6-2-4-4Z"/><path d="m8 37 4 4"/>`,
  ingredient: `<path d="M38 10C22 10 12 20 12 34c13 1 25-7 26-24Z"/><path d="M10 40c7-10 13-15 23-23"/>`,
  material: `<path d="m24 7 15 11-6 20H15L9 18 24 7Z"/><path d="m9 18 15 7 15-7M24 7v18m0 0 9 13m-9-13-9 13"/>`,
  supply: `<path d="M14 17h20l4 24H10l4-24Z"/><path d="M18 17v-4c0-4 3-7 6-7s6 3 6 7v4M10 27h28"/>`,
  item: `<path d="m9 17 15-9 15 9v20l-15 7-15-7V17Z"/><path d="m9 17 15 8 15-8M24 25v19"/>`,
};

function itemIconMarkup(item) {
  const category = item?.category || "item";
  const paths = itemIconPaths[category] || itemIconPaths.item;
  return `<svg class="item-icon" viewBox="0 0 48 48" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
const formatNumber = (value) => new Intl.NumberFormat("en-US", { notation: Number(value) >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(value || 0));
const formatTime = (milliseconds) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return seconds % 60 ? `${minutes}m ${seconds % 60}s` : `${minutes}m`;
};
function toast(message, type = "info", detail = "") {
  if (type === "error") playSound("error");
  const node = document.createElement("div");
  node.className = `toast ${type === "error" ? "error" : ""}`;
  node.innerHTML = `${escapeHtml(message)}${detail ? `<small>${escapeHtml(detail)}</small>` : ""}`;
  $("#toast-region").append(node);
  setTimeout(() => node.remove(), 4200);
}

function reportError(error) {
  console.error(error);
  const [message, detail] = friendlyAuthError(error);
  toast(message, "error", detail);
}

function saveLocal() {
  if (mode === "local" && gameState) localStorage.setItem(LOCAL_SAVE, JSON.stringify(gameState));
}

function setState(next, shouldRender = true) {
  gameState = normalizeState(next, currentUser?.displayName || "Keeper");
  if (!activeBattle && !autoHuntSession && gameState.combatPreferences?.regionId) selectedCombatRegion = gameState.combatPreferences.regionId;
  saveLocal();
  if (shouldRender) queueRender();
}

function queueRender() {
  if (renderQueued || !gameState) return;
  renderQueued = true;
  requestAnimationFrame(() => {
    renderQueued = false;
    renderShell();
    renderPanel();
  });
}

function petVisual(species, extra = "") {
  const colors = affinityColors[species.affinity] || ["#777", "#ddd"];
  const style = `--affinity:${colors[0]};--affinity-soft:${colors[1]}`;
  return `<div class="pet-visual ${extra}" style="${style}"><img src="${escapeHtml(species.art || PLACEHOLDER_ART)}" alt="${escapeHtml(species.name)}" loading="lazy" decoding="async" /></div>`;
}

function petIsInLiveBattle(petId) {
  return Boolean(activeBattle?.battle.team.some((entry) => entry.id === petId));
}

function petCard(instance, actions = true) {
  const species = SPECIES_BY_ID[instance.speciesId];
  const stats = scaledPetStats(instance);
  const needed = instance.level >= levelCapForStars(instance.stars) ? 0 : xpForNextLevel(instance.level, "pet");
  const progress = needed ? Math.min(100, (instance.xp / needed) * 100) : 100;
  const status = Number(instance.currentHp || 0) <= 0 ? "Downed" : petIsInLiveBattle(instance.id) ? "Fighting" : instance.status === "idle" ? "Idle" : String(instance.status).split(":")[0];
  const aptitudes = Object.entries(species.aptitudes).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return `<article class="pet-card" data-pet-id="${instance.id}">
    <div class="pet-status">${escapeHtml(status)}</div>
    ${petVisual(species)}
    <div class="pet-body">
      <div class="pet-title-row"><div><h3>${escapeHtml(instance.customName || species.name)}</h3><p>${escapeHtml(species.affinity)} · Power ${formatNumber(stats.power)} · HP ${instance.currentHp}/${stats.hp}</p></div><span class="star-row">${instance.stars}/5 stars</span></div>
      <div class="aptitude-row">${aptitudes.map(([skill, rating]) => `<span class="tag">${escapeHtml(skill)} ${rating}</span>`).join("")}</div>
      <div class="xp-line"><div class="labels"><span>Level ${instance.level}/${levelCapForStars(instance.stars)}</span><span>${needed ? `${formatNumber(instance.xp)}/${formatNumber(needed)} XP` : "Ready to Condense"}</span></div><div class="xp-bar"><span style="width:${progress}%"></span></div></div>
      ${actions ? `<div class="pet-actions"><button class="button small ghost" data-action="pet-details" data-pet-id="${instance.id}" type="button">Details</button><button class="button small ghost" data-action="pet-manage" data-pet-id="${instance.id}" type="button">Manage</button></div>` : ""}
    </div>
  </article>`;
}

function renderShell() {
  if (!gameState) return;
  $("#keeper-name").textContent = gameState.profile.displayName;
  $("#connection-state").textContent = mode === "firebase" ? (currentUser?.emailVerified === false ? "Email verification pending" : "Shared world connected") : "Private preview";
  $("#account-action").textContent = mode === "firebase" ? "Sign out" : "Exit";
  const combatActive = activeBattle?.battle.team.length || 0;
  const active = Math.min(MAX_ACTIVE_PETS, activePetCount(gameState) + combatActive);
  const keeper = keeperStats(gameState);
  $("#active-count").textContent = `${active} / ${MAX_ACTIVE_PETS}`;
  $("#active-meter").style.width = `${active / MAX_ACTIVE_PETS * 100}%`;
  $("#top-resources").innerHTML = [
    ["Coins", gameState.profile.coins], ["Keeper HP", `${gameState.profile.currentHp}/${keeper.maxHp}`], ["Pets", `${gameState.pets.length}/${denCapacity(gameState)}`], ["Remains", gameState.remains.length],
  ].map(([label, value]) => `<div class="resource-pill"><span>${label}</span><strong>${typeof value === "string" ? escapeHtml(value) : formatNumber(value)}</strong></div>`).join("");

  $("#assignment-rail").innerHTML = `<div class="section-heading compact-heading"><div><p class="eyebrow">Working now</p><h2>Assignments</h2></div><strong>${active}/${MAX_ACTIVE_PETS}</strong></div>${assignmentRail()}`;
  $("#capacity-rail").innerHTML = `<div class="section-heading compact-heading"><div><p class="eyebrow">Facilities</p><h2>Capacity</h2></div></div>
    <div class="assignment"><div class="assignment-head"><strong>Den</strong><small>${gameState.pets.length}/${denCapacity(gameState)}</small></div><div class="progress"><span style="width:${Math.min(100, gameState.pets.length / denCapacity(gameState) * 100)}%"></span></div></div>
    <div class="assignment"><div class="assignment-head"><strong>Storage</strong><small>${inventoryStackCount()}/${storageCapacity(gameState)}</small></div><div class="progress"><span style="width:${Math.min(100, inventoryStackCount() / storageCapacity(gameState) * 100)}%"></span></div></div>`;
  $("#journal-list").innerHTML = [...gameState.journal].reverse().slice(0, 8).map((entry) => `<div class="journal-entry">${escapeHtml(entry.text)}<time>${new Date(entry.at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</time></div>`).join("") || `<div class="muted small-copy">No events yet.</div>`;
}

function mealCount() {
  return Object.entries(gameState.inventory).filter(([id]) => ITEMS[id]?.category === "meal").reduce((sum, [, quantity]) => sum + Number(quantity), 0);
}

function inventoryStackCount() {
  return Object.values(gameState.inventory).filter((quantity) => Number(quantity) > 0).length;
}

function assignmentTiming(assignment, now = Date.now()) {
  if (["activity", "keeper"].includes(assignment.kind)) {
    const duration = Math.max(1, Number(assignment.durationMs || 1));
    const elapsed = Math.max(0, now - Number(assignment.lastAt || assignment.startedAt || now));
    const cycleElapsed = elapsed % duration;
    return {
      progress: Math.min(100, cycleElapsed / duration * 100),
      remaining: Math.max(0, duration - cycleElapsed),
      label: `${formatTime(Math.max(0, duration - cycleElapsed))} to reward`,
    };
  }
  const startedAt = Number(assignment.startedAt || now);
  const endAt = Number(assignment.endAt || startedAt);
  const total = Math.max(1, endAt - startedAt);
  const remaining = Math.max(0, endAt - now);
  return {
    progress: Math.min(100, Math.max(0, (now - startedAt) / total * 100)),
    remaining,
    label: remaining ? `${formatTime(remaining)} remaining` : "Completing…",
  };
}

function keeperDisplayDuration(task) {
  const tool = ITEMS[gameState.equipment?.tool];
  const toolBonus = tool?.skill === task.skill ? Number(tool.speedBonus || 0) : 0;
  return Math.max(1800, Math.round(Number(task.duration || 5) * 1000 * (1 - toolBonus)));
}

function assignmentProgress(assignment) {
  return assignmentTiming(assignment).progress;
}

function assignmentLabel(assignment) {
  if (["activity", "keeper"].includes(assignment.kind)) return ACTIVITIES.find((entry) => entry.id === assignment.taskId)?.name || "Activity";
  if (["recipe", "keeper-recipe"].includes(assignment.kind)) return RECIPES.find((entry) => entry.id === assignment.taskId)?.name || "Recipe";
  if (["construction", "keeper-construction"].includes(assignment.kind)) return BUILDINGS.find((entry) => entry.id === assignment.taskId)?.name || "Construction";
  if (["processing", "keeper-processing"].includes(assignment.kind)) return `Process ${SPECIES_BY_ID[assignment.taskId]?.name || "pet"}`;
  return "Assignment";
}

function assignmentSkillId(assignment) {
  if (["activity", "keeper"].includes(assignment.kind)) return ACTIVITIES.find((entry) => entry.id === assignment.taskId)?.skill || "petMastery";
  if (["recipe", "keeper-recipe"].includes(assignment.kind)) return RECIPES.find((entry) => entry.id === assignment.taskId)?.skill || "crafting";
  if (["construction", "keeper-construction"].includes(assignment.kind)) return "construction";
  if (["processing", "keeper-processing"].includes(assignment.kind)) return "processing";
  return "petMastery";
}

function skillProgressMarkup(skillId, compact = false) {
  const skill = SKILLS.find((entry) => entry.id === skillId);
  const progress = gameState.skills?.[skillId] || { level: 1, xp: 0 };
  const level = Number(progress.level || 1);
  const needed = level >= 100 ? 0 : xpForNextLevel(level, "skill");
  const percent = needed ? Math.min(100, Number(progress.xp || 0) / needed * 100) : 100;
  const remaining = Math.max(0, needed - Number(progress.xp || 0));
  const related = ACTIVITIES.filter((entry) => entry.skill === skillId && entry.level > level).sort((a, b) => a.level - b.level)[0];
  return `<div class="skill-progress skill-rpg ${compact ? "compact" : ""}" data-skill-widget="${skillId}" style="--skill-color:${skillColors[skillId] || "#418777"}">
    <div class="skill-level-medallion"><span>LV</span><strong data-skill-level>${level}</strong></div>
    <div class="skill-progress-main">
      <div class="skill-progress-head"><span>${escapeHtml(skill?.name || skillId)}</span><strong data-skill-to-go>${needed ? `${formatNumber(remaining)} XP to Lv ${level + 1}` : "Mastered"}</strong></div>
      <div class="level-progress"><span data-skill-xp-meter style="width:${percent}%"></span></div>
      <div class="skill-progress-foot"><span data-skill-xp-text>${needed ? `${formatNumber(progress.xp)} / ${formatNumber(needed)} XP` : "Maximum level"}</span>${related && !compact ? `<span>Next unlock: ${escapeHtml(related.name)} · Lv ${related.level}</span>` : `<span>${escapeHtml(skill?.description || "")}</span>`}</div>
    </div>
  </div>`;
}

function liveAssignmentsBoard(title = "Live work queue") {
  const assignments = [...(gameState.keeperActivity ? [gameState.keeperActivity] : []), ...gameState.activities];
  return `<section class="live-work card card-pad">
    <div class="section-heading compact-heading"><div><p class="eyebrow">Timers running now</p><h2>${escapeHtml(title)}</h2></div><span class="live-count"><i></i>${gameState.activities.length}/${MAX_ACTIVE_PETS} pets${gameState.keeperActivity ? " + Keeper" : ""}</span></div>
    ${assignments.length ? `<div class="live-work-grid">${assignments.map((assignment) => {
      const keeperJob = assignment.kind.startsWith("keeper");
      const pet = gameState.pets.find((entry) => entry.id === assignment.petId);
      const species = pet ? SPECIES_BY_ID[pet.speciesId] : SPECIES_BY_ID["ash-raccoon"];
      const timing = assignmentTiming(assignment);
      const skillId = assignmentSkillId(assignment);
      const skill = SKILLS.find((entry) => entry.id === skillId);
      const completed = Number(assignment.completedActions || 0);
      return `<article class="live-job" data-live-assignment="${assignment.id}">
        ${keeperJob ? `<div class="keeper-job-avatar">K</div>` : `<img src="${escapeHtml(species.art || PLACEHOLDER_ART)}" alt="" loading="lazy" decoding="async" />`}
        <div class="live-job-main">
          <div class="live-job-title"><div><strong>${escapeHtml(assignmentLabel(assignment))}</strong><span>${keeperJob ? "Keeper" : escapeHtml(pet?.customName || species.name)} · ${escapeHtml(skill?.name || "Pet Mastery")} Lv ${skillLevel(gameState, skillId)}</span></div><b data-assignment-time>${escapeHtml(timing.label)}</b></div>
          <div class="job-progress"><span data-assignment-progress style="width:${timing.progress}%"></span><i style="left:25%"></i><i style="left:50%"></i><i style="left:75%"></i></div>
          <div class="live-job-foot"><span data-assignment-cycle>${["activity", "keeper"].includes(assignment.kind) ? `${completed} actions completed` : "One-time assignment"}</span><button class="text-button" data-action="${keeperJob ? "stop-keeper-assignment" : "stop-assignment"}" data-id="${assignment.id}" type="button">Stop</button></div>
        </div>
      </article>`;
    }).join("")}</div>` : `<div class="empty-state compact-empty"><strong>No timers are running.</strong><span>Assign your Keeper or a pet and its countdown will appear here.</span></div>`}
  </section>`;
}

function assignmentRail() {
  if (!gameState.activities.length) return `<div class="empty-state small-copy">No pets are assigned.</div>`;
  return `<div class="assignment-list">${gameState.activities.slice(0, 6).map((assignment) => {
    const pet = gameState.pets.find((entry) => entry.id === assignment.petId);
    const timing = assignmentTiming(assignment);
    return `<div class="assignment" data-live-assignment="${assignment.id}"><div class="assignment-head"><strong>${escapeHtml(pet ? SPECIES_BY_ID[pet.speciesId].name : "Pet")}</strong><small data-assignment-time>${escapeHtml(timing.label)}</small></div><small>${escapeHtml(assignmentLabel(assignment))}</small><div class="progress"><span data-assignment-progress style="width:${timing.progress}%"></span></div><button class="text-button" data-action="stop-assignment" data-id="${assignment.id}" type="button">Stop</button></div>`;
  }).join("")}</div>`;
}

function updateLiveProgress() {
  if (!gameState) return;
  for (const assignment of [...(gameState.keeperActivity ? [gameState.keeperActivity] : []), ...gameState.activities]) {
    const timing = assignmentTiming(assignment);
    document.querySelectorAll(`[data-live-assignment="${CSS.escape(assignment.id)}"]`).forEach((node) => {
      const meter = node.querySelector("[data-assignment-progress]");
      const time = node.querySelector("[data-assignment-time]");
      const cycle = node.querySelector("[data-assignment-cycle]");
      if (meter) meter.style.width = `${timing.progress}%`;
      if (time) time.textContent = timing.label;
      if (cycle && ["activity", "keeper"].includes(assignment.kind)) cycle.textContent = `${Number(assignment.completedActions || 0)} actions completed`;
    });
  }
  for (const run of gameState.dungeonRuns) {
    const node = document.querySelector(`[data-live-dungeon="${CSS.escape(run.id)}"]`);
    if (!node) continue;
    const ready = run.endAt <= Date.now();
    const meter = node.querySelector(".progress span");
    const time = node.querySelector("[data-dungeon-time]");
    const button = node.querySelector("button");
    if (meter) meter.style.width = `${Math.min(100, (Date.now() - run.startedAt) / Math.max(1, run.endAt - run.startedAt) * 100)}%`;
    if (time) time.textContent = ready ? "Ready to claim" : formatTime(run.endAt - Date.now());
    if (button) {
      button.disabled = !ready;
      button.classList.toggle("primary", ready);
      button.classList.toggle("ghost", !ready);
      button.textContent = ready ? "Claim result" : `${Math.round(run.chance * 100)}% chance`;
    }
  }
  document.querySelectorAll("[data-skill-widget]").forEach((node) => {
    const skillId = node.dataset.skillWidget;
    const progress = gameState.skills?.[skillId] || { level: 1, xp: 0 };
    const level = Number(progress.level || 1);
    const needed = level >= 100 ? 0 : xpForNextLevel(level, "skill");
    const percent = needed ? Math.min(100, Number(progress.xp || 0) / needed * 100) : 100;
    const levelText = node.querySelector("[data-skill-level]");
    const meter = node.querySelector("[data-skill-xp-meter]");
    const xpText = node.querySelector("[data-skill-xp-text]");
    const toGo = node.querySelector("[data-skill-to-go]");
    if (levelText) levelText.textContent = `${level}`;
    if (meter) meter.style.width = `${percent}%`;
    if (xpText) xpText.textContent = needed ? `${formatNumber(progress.xp)} / ${formatNumber(needed)} XP` : "Maximum level";
    if (toGo) toGo.textContent = needed ? `${formatNumber(Math.max(0, needed - Number(progress.xp || 0)))} XP to Lv ${level + 1}` : "Mastered";
  });
  updateBattleClock();
}

function panelHeading(eyebrow, title, summary = "", action = "") {
  return `<div class="section-heading"><div><p class="eyebrow">${escapeHtml(eyebrow)}</p><h1>${escapeHtml(title)}</h1>${summary ? `<p class="summary">${escapeHtml(summary)}</p>` : ""}</div>${action}</div>`;
}

function renderPanel() {
  if (!gameState) return;
  $$(".nav-button").forEach((button) => button.classList.toggle("active", button.dataset.panel === currentPanel));
  const renders = {
    overview: renderOverview, activities: renderActivities, skills: renderSkills, combat: renderCombat, den: renderDen,
    equipment: renderEquipment, inventory: renderInventoryPanel, store: renderStore,
    kitchen: renderKitchen, processing: renderProcessing, construction: renderConstruction,
    dungeons: renderDungeons, market: renderMarket, collection: renderCollection,
  };
  (renders[currentPanel] || renderOverview)();
  panel.scrollTop = 0;
}

function renderOverview() {
  const raccoon = gameState.pets.find((entry) => entry.speciesId === "ash-raccoon") || gameState.pets[0];
  const species = raccoon ? SPECIES_BY_ID[raccoon.speciesId] : SPECIES_BY_ID["ash-raccoon"];
  const totalSkill = Object.values(gameState.skills).reduce((sum, skill) => sum + Number(skill.level || 1), 0);
  const totalPower = gameState.pets.reduce((sum, pet) => sum + scaledPetStats(pet).power, 0);
  const standings = leaderboard.length ? leaderboard.slice(0, 8) : [{ displayName: gameState.profile.displayName, petPower: totalPower, totalSkill, captures: gameState.stats.captures }];
  panel.innerHTML = `${panelHeading("Keeper dashboard", `Welcome back, ${gameState.profile.displayName}`, "Your Keeper can work and fight directly while six pets run independent assignments. Dungeon parties operate separately.")}
    <section class="feature-card card">
      <div class="feature-copy"><p class="eyebrow">Next useful move</p><h2>${gameState.pendingEncounter ? `Resolve the ${SPECIES_BY_ID[gameState.pendingEncounter.speciesId].name} encounter` : gameState.activities.length ? "Your den is already at work" : "Put your first pet to work"}</h2><p>${gameState.pendingEncounter ? "Use a cooked meal for a capture attempt, or send the defeated pet to Processing." : gameState.activities.length ? "Assignments keep earning until their selected meal runs out or storage fills." : "Gathering supplies the food, construction, and expedition loops that power the entire den."}</p><button class="button" data-panel-jump="${gameState.pendingEncounter ? "combat" : "activities"}" type="button">${gameState.pendingEncounter ? "Open encounter" : "Choose an activity"}</button></div>
      ${species.art ? `<img src="${species.art}" alt="${escapeHtml(species.name)}" loading="lazy" decoding="async" />` : ""}
    </section>
    <div style="margin-top:1rem">${liveAssignmentsBoard("Den activity")}</div>
    <section class="grid four" style="margin-top:1rem">
      <article class="stat-card card"><span>Total skill</span><strong>${formatNumber(totalSkill)}</strong><small>Across ${SKILLS.length} disciplines</small></article>
      <article class="stat-card card"><span>Den power</span><strong>${formatNumber(totalPower)}</strong><small>${gameState.pets.length} owned pets</small></article>
      <article class="stat-card card"><span>Captures</span><strong>${formatNumber(gameState.stats.captures)}</strong><small>${gameState.discoveries.length} species discovered</small></article>
      <article class="stat-card card"><span>Dungeon clears</span><strong>${formatNumber(gameState.stats.dungeonClears)}</strong><small>${gameState.dungeonRuns.length} expeditions underway</small></article>
    </section>
    <section class="grid two" style="margin-top:1rem">
      <article class="card card-pad"><div class="section-heading compact-heading"><div><p class="eyebrow">Skills</p><h2>Strongest disciplines</h2></div><button class="text-button" data-panel-jump="skills" type="button">Open skill book</button></div><div class="overview-skills">${[...SKILLS].sort((a, b) => skillLevel(gameState, b.id) - skillLevel(gameState, a.id)).slice(0, 6).map((skill) => skillProgressMarkup(skill.id, true)).join("")}</div></article>
      <article class="card card-pad"><div class="section-heading compact-heading"><div><p class="eyebrow">Owned only</p><h2>Storage</h2></div><span class="tag">${inventoryStackCount()}/${storageCapacity(gameState)} stacks</span></div>${renderInventory()}</article>
    </section>
    <section class="card card-pad" style="margin-top:1rem"><div class="section-heading compact-heading"><div><p class="eyebrow">Shared world</p><h2>Keeper standings</h2></div><span class="tag">${mode === "firebase" ? "Live" : "Local preview"}</span></div><div class="leaderboard-list">${standings.map((entry, index) => `<div class="leaderboard-row"><strong>${index + 1}</strong><span>${escapeHtml(entry.displayName || "Keeper")}<small>${formatNumber(entry.captures || 0)} captures · ${formatNumber(entry.totalSkill || 0)} total skill</small></span><b>${formatNumber(entry.petPower || 0)} power</b></div>`).join("")}</div></section>`;
}

function renderInventory() {
  const entries = Object.entries(gameState.inventory).filter(([, quantity]) => Number(quantity) > 0).sort((a, b) => inventoryName(a[0]).localeCompare(inventoryName(b[0])));
  if (!entries.length) return `<div class="empty-state">Storage is empty.</div>`;
  return `<div class="inventory-grid">${entries.map(([id, quantity]) => `<div class="inventory-item"><span>${escapeHtml(inventoryName(id))}</span><strong>${formatNumber(quantity)}</strong></div>`).join("")}</div>`;
}

function renderActivities() {
  const gatheringSkills = ["woodcutting", "mining", "foraging", "fishing", "mischief"];
  const skill = SKILLS.find((entry) => entry.id === currentSkill) || SKILLS[0];
  const actions = ACTIVITIES.filter((entry) => entry.skill === currentSkill);
  panel.innerHTML = `${panelHeading("Work assignments", skill.name, skill.description)}
    ${liveAssignmentsBoard("Gathering and Mischief")}
    <div class="active-skill-card card">${skillProgressMarkup(skill.id)}</div>
    <div class="activity-layout">
      <div class="skill-tabs">${gatheringSkills.map((id) => { const item = SKILLS.find((entry) => entry.id === id); const level = skillLevel(gameState, id); const progress = gameState.skills?.[id] || { xp: 0 }; const needed = level >= 100 ? 1 : xpForNextLevel(level, "skill"); return `<button class="skill-tab ${id === currentSkill ? "active" : ""}" data-skill="${id}" type="button"><span class="skill-tab-copy"><strong>${escapeHtml(item.name)}</strong><b>Lv ${level}</b></span><i><span style="width:${Math.min(100, Number(progress.xp || 0) / needed * 100)}%"></span></i></button>`; }).join("")}</div>
      <div class="action-list">${actions.map((action) => actionCard(action)).join("")}</div>
    </div>`;
}

function renderSkills() {
  const groups = [
    ["Fieldcraft", "The practical arts that bring resources and secrets home.", ["woodcutting", "mining", "foraging", "fishing", "mischief"]],
    ["Dencraft", "Production skills that turn raw finds into lasting progress.", ["processing", "cooking", "crafting", "construction"]],
    ["Battlecraft", "Your Keeper's fighting disciplines and command of the den.", ["combat", "melee", "ranged", "magic", "petMastery"]],
  ];
  const totalLevels = SKILLS.reduce((sum, skill) => sum + skillLevel(gameState, skill.id), 0);
  panel.innerHTML = `${panelHeading("Keeper progression", "Skill Book", "Every action leaves a permanent mark. Current level, exact progress, and XP remaining are shown together.", `<span class="tag skill-total">${formatNumber(totalLevels)} total levels</span>`)}
    <section class="skill-book card">${groups.map(([title, description, ids]) => `<div class="skill-chapter"><div class="skill-chapter-heading"><div><p class="eyebrow">${escapeHtml(title)}</p><h2>${escapeHtml(description)}</h2></div><span>${ids.length} skills</span></div><div class="skill-book-list">${ids.map((id) => skillProgressMarkup(id)).join("")}</div></div>`).join("")}</section>`;
}

function actionCard(action) {
  const playerLevel = skillLevel(gameState, action.skill);
  const unlocked = playerLevel >= action.level;
  const rewards = Object.entries(action.rewards || {}).map(([id, amount]) => `${amount} ${inventoryName(id)}`).join(" · ");
  return `<article class="action-card ${unlocked ? "" : "locked"}"><div><h3>${escapeHtml(action.name)}</h3><div class="action-meta"><span>${formatTime(keeperDisplayDuration(action))} Keeper timer</span><span>${action.xp} XP</span><span>${escapeHtml(rewards)}</span>${action.coins ? `<span>${action.coins} coins</span>` : ""}</div>${unlocked ? `<p class="requirements">Any pet can attempt this. Aptitude 1–10 changes its action timer and possible yield; pet level never blocks work.</p>` : `<p class="requirements">Requires ${SKILLS.find((entry) => entry.id === action.skill).name} ${action.level}</p>`}</div><div class="action-buttons"><button class="button secondary" data-action="start-keeper-activity" data-id="${action.id}" ${!unlocked || gameState.keeperActivity ? "disabled" : ""} type="button">Do it myself</button><button class="button ${unlocked ? "primary" : "ghost"}" data-action="open-start" data-kind="activity" data-id="${action.id}" ${unlocked ? "" : "disabled"} type="button">Assign pet</button></div></article>`;
}

function renderInventoryPanel() {
  const categories = ["all", "meal", "medicine", "tool", "weapon", "armor", "ingredient", "material", "supply"];
  const entries = Object.entries(gameState.inventory).filter(([id, quantity]) => Number(quantity) > 0 && (inventoryFilter === "all" || ITEMS[id]?.category === inventoryFilter)).sort((a, b) => inventoryName(a[0]).localeCompare(inventoryName(b[0])));
  panel.innerHTML = `${panelHeading("Owned items only", "Inventory & Storage", "Browse everything you own, filter by category, equip gear, and use healing supplies.", `<span class="tag">${inventoryStackCount()}/${storageCapacity(gameState)} stacks</span>`)}
    <div class="inventory-filters">${categories.map((category) => `<button class="skill-tab ${inventoryFilter === category ? "active" : ""}" data-inventory-filter="${category}" type="button">${category === "all" ? "All" : category[0].toUpperCase() + category.slice(1)}</button>`).join("")}</div>
    ${entries.length ? `<div class="storage-grid compact-storage">${entries.map(([id, quantity]) => inventoryDetailCard(id, quantity)).join("")}</div>` : `<div class="empty-state">No owned items match this category.</div>`}`;
}

function inventoryDetailCard(id, quantity) {
  const item = ITEMS[id] || { name: inventoryName(id), category: "item" };
  const equipped = Object.values(gameState.equipment || {}).includes(id);
  return `<button class="inventory-tile item-${escapeHtml(item.category || "item")}" data-action="item-details" data-id="${id}" type="button" title="${escapeHtml(item.name)}">
    ${equipped ? `<span class="equipped-dot">E</span>` : ""}
    <span class="item-art">${itemIconMarkup(item)}</span>
    <span class="item-tile-name">${escapeHtml(item.name)}</span>
    <strong class="quantity-badge">${formatNumber(quantity)}</strong>
  </button>`;
}

function renderEquipment() {
  const stats = keeperStats(gameState);
  panel.innerHTML = `${panelHeading("Keeper loadout", "Equipment", "Your Keeper has no class. The equipped weapon determines whether combat trains Melee, Ranged, or Magic.")}
    <section class="keeper-sheet card"><div class="keeper-sigil">K</div><div><p class="eyebrow">${escapeHtml(gameState.profile.displayName)}</p><h2>${gameState.profile.currentHp}/${stats.maxHp} health</h2><div class="health-bar light"><span style="width:${Math.max(0, gameState.profile.currentHp / stats.maxHp * 100)}%"></span></div><div class="equipment-stats"><span>Attack <strong>${stats.attack}</strong></span><span>Defence <strong>${stats.defense}</strong></span><span>Speed <strong>${stats.speed}</strong></span></div></div></section>
    <div class="equipment-grid">${EQUIPMENT_SLOTS.map((slot) => { const id = gameState.equipment?.[slot.id]; const item = ITEMS[id]; return `<article class="equipment-slot card"><p class="eyebrow">${slot.name}</p><h3>${escapeHtml(item?.name || "Empty")}</h3><p class="muted small-copy">${item?.style ? `${item.style} style · ` : ""}${item?.skill ? `${item.skill} tool · ` : ""}${item ? [item.attack && `+${item.attack} attack`, item.defense && `+${item.defense} defence`, item.hp && `+${item.hp} health`, item.speedBonus && `${Math.round(item.speedBonus * 100)}% faster`].filter(Boolean).join(" · ") || "Utility gear" : "Equip an owned item from Inventory."}</p></article>`; }).join("")}</div>
    <section class="card card-pad" style="margin-top:1rem"><div class="section-heading compact-heading"><div><p class="eyebrow">Combat disciplines</p><h2>Keeper skill levels</h2></div></div><div class="overview-skills">${["combat", "melee", "ranged", "magic"].map((id) => skillProgressMarkup(id)).join("")}</div></section>`;
}

function renderStore() {
  panel.innerHTML = `${panelHeading("Coins for essentials", "General Store", "Buy starter food, medicine, tools, weapons, and basic armour. Store purchases go directly to storage.", `<span class="tag">${formatNumber(gameState.profile.coins)} coins</span>`)}
    <div class="store-grid">${STORE_ITEMS.map((listing) => { const item = ITEMS[listing.itemId]; return `<article class="store-card card"><p class="eyebrow">${escapeHtml(item.category)}</p><h3>${escapeHtml(item.name)}</h3><p class="muted small-copy">${escapeHtml(listing.description)}</p><div class="store-buy"><strong>${formatNumber(listing.price)} coins</strong><button class="button primary small" data-action="buy-store-item" data-id="${listing.itemId}" type="button">Buy</button></div></article>`; }).join("")}</div>`;
}

function renderDen() {
  panel.innerHTML = `${panelHeading("Roster management", "Pet Den", "Every pet can fight and attempt every action. Aptitudes determine action speed and yield; every completed action grants pet XP.", `<span class="tag">${gameState.pets.length}/${denCapacity(gameState)} spaces</span>`)}
    ${gameState.pets.length ? `<div class="pet-grid">${gameState.pets.map((pet) => petCard(pet)).join("")}</div>` : `<div class="empty-state">Your den is empty.</div>`}`;
}

function renderKitchen() {
  panel.innerHTML = `${panelHeading("Meals and supplies", "Kitchen & Craft", "Meals fuel every active pet and power capture attempts. Better recipes provide more nutrition and stronger bonuses.")}
    ${liveAssignmentsBoard("Kitchen and workshop")}
    <div class="recipe-grid">${RECIPES.map((recipe) => {
      const unlocked = skillLevel(gameState, recipe.skill) >= recipe.level;
      return `<article class="recipe-card card ${unlocked ? "" : "locked"}"><p class="eyebrow">${recipe.skill}</p><h3>${escapeHtml(recipe.name)}</h3><p class="muted small-copy">${recipe.duration}s Keeper base · ${recipe.xp} XP · Level ${recipe.level}</p><div class="cost-list">${Object.entries(recipe.ingredients).map(([id, amount]) => `<span class="tag">${amount} ${escapeHtml(inventoryName(id))}</span>`).join("")}</div><p class="small-copy">Produces ${Object.entries(recipe.output).map(([id, amount]) => `${amount} ${inventoryName(id)}`).join(", ")}. Pet aptitude changes time and may multiply the batch.</p><div class="action-buttons"><button class="button secondary" data-action="start-keeper-recipe" data-id="${recipe.id}" ${!unlocked || gameState.keeperActivity ? "disabled" : ""} type="button">Do it myself</button><button class="button ${unlocked ? "primary" : "ghost"}" data-action="open-start" data-kind="recipe" data-id="${recipe.id}" ${unlocked ? "" : "disabled"} type="button">${unlocked ? "Assign pet" : `Locked at ${recipe.level}`}</button></div></article>`;
    }).join("")}</div>`;
}

function renderProcessing() {
  panel.innerHTML = `${panelHeading("Every victory has value", "Processing", "Defeated wild pets enter this queue after a declined, failed, or auto-harvested encounter. Processing recovers materials and coins.", `<span class="tag">${gameState.remains.length} waiting</span>`)}
    ${liveAssignmentsBoard("Processing queue")}
    ${gameState.remains.length ? `<div class="recipe-grid">${gameState.remains.map((remain) => { const species = SPECIES_BY_ID[remain.speciesId]; return `<article class="recipe-card card processing-card"><p class="eyebrow">${escapeHtml(species.region)}</p><h3>${escapeHtml(species.name)}</h3><div class="processing-value"><span>Base coin recovery</span><strong>${processingCoinReward(species)}</strong></div><div class="cost-list">${Object.entries(species.materials).map(([id, amount]) => `<span class="tag">${amount} ${escapeHtml(inventoryName(id))}</span>`).join("")}</div><p class="muted small-copy">Processing aptitude changes time, material yield, and bonus coin recovery. A Smokehouse adds another permanent output boost.</p><div class="action-buttons"><button class="button secondary" data-action="start-keeper-processing" data-id="${remain.id}" ${gameState.keeperActivity ? "disabled" : ""} type="button">Do it myself</button><button class="button primary" data-action="open-start" data-kind="processing" data-id="${remain.id}" type="button">Assign pet</button></div></article>`; }).join("")}</div>` : `<div class="empty-state"><strong>No remains are waiting.</strong><p>Start an area hunt with Auto-harvest, or send a capture opportunity here manually.</p></div>`}`;
}

function renderConstruction() {
  panel.innerHTML = `${panelHeading("Permanent account growth", "Construction", "Expand hard capacities and build one-time facilities that provide small permanent bonuses.")}
    ${liveAssignmentsBoard("Construction projects")}
    <div class="building-grid">${BUILDINGS.map((building) => {
      const level = Number(gameState.buildings[building.id] || 0);
      const maxed = level >= building.maxLevel;
      const costs = buildingCosts(gameState, building.id);
      const requiredLevel = constructionRequirement(gameState, building.id);
      const unlocked = !maxed && skillLevel(gameState, "construction") >= requiredLevel;
      return `<article class="building-card card ${maxed || !unlocked ? "locked" : ""}"><p class="eyebrow">${building.repeatable ? `Level ${level}/${building.maxLevel}` : maxed ? "Completed" : "One-time structure"}</p><h3>${escapeHtml(building.name)}</h3><p class="muted small-copy">${escapeHtml(building.description)} · Construction ${requiredLevel}</p><div class="cost-list">${Object.entries(costs).map(([id, amount]) => `<span class="tag">${amount} ${escapeHtml(inventoryName(id))}</span>`).join("") || `<span class="tag">Built</span>`}</div><div class="action-buttons"><button class="button secondary" data-action="start-keeper-construction" data-id="${building.id}" ${!unlocked || gameState.keeperActivity ? "disabled" : ""} type="button">Do it myself</button><button class="button ${unlocked ? "primary" : "ghost"}" data-action="open-start" data-kind="construction" data-id="${building.id}" ${unlocked ? "" : "disabled"} type="button">${maxed ? "Complete" : unlocked ? "Assign pet" : `Locked at ${requiredLevel}`}</button></div></article>`;
    }).join("")}</div>`;
}

function renderCombat() {
  const meals = ownedMeals();
  const pending = !activeBattle && gameState.pendingEncounter ? SPECIES_BY_ID[gameState.pendingEncounter.speciesId] : null;
  const weapon = ITEMS[gameState.equipment?.weapon];
  const preferences = gameState.combatPreferences || {};
  const localSetup = readCombatSetup();
  const availableRegions = REGIONS.filter((region) => listAreaOpponents(gameState, region.id).length);
  if (!listAreaOpponents(gameState, selectedCombatRegion).length && availableRegions.length) selectedCombatRegion = availableRegions[0].id;
  const currentRegion = REGIONS.find((region) => region.id === selectedCombatRegion) || REGIONS[0];
  const currentPool = listAreaOpponents(gameState, currentRegion.id);
  const preferredMeal = meals.some(([id]) => id === preferences.mealId) ? preferences.mealId : meals[0]?.[0] || "";
  panel.innerHTML = `${panelHeading("Passive area hunting", "The Wilds", "Choose an area, set your party rules, then let encounters keep coming. Every fighter still attacks on a real timer.", autoHuntSession ? `<span class="tag hunt-live-tag"><i></i> Auto-hunt active · ${autoHuntSession.round} battles</span>` : "")}
    ${pending ? encounterCard(pending) : ""}
    <section id="combat-stage" class="combat-stage ${activeBattle ? "battle-live" : "battle-idle"}">${activeBattle ? combatStageMarkup(activeBattle) : `<div class="combat-header"><span class="battle-state ready">${autoHuntSession ? "Searching the area" : "Hunt ready"}</span><span>Independent attack meters</span></div><div class="idle-arena"><div>${petVisual(SPECIES_BY_ID["ash-raccoon"], "arena-pet")}</div><span>VS</span><div class="wild-silhouette"><span>WILD</span></div></div><div class="battle-message">${autoHuntSession ? `Tracking the next enemy in ${escapeHtml(currentRegion.name)}…` : "Choose an area — the enemy is discovered automatically"}</div>`}</section>
    ${!activeBattle && !pending ? `<div class="combat-setup">
      <article class="selection-card card"><p class="eyebrow">Party</p><h3>Keeper + up to three pets</h3><label class="check-option keeper-option"><input id="combat-keeper" type="checkbox" ${gameState.keeperActivity || Number(gameState.profile.currentHp || 0) <= 0 ? "disabled" : localSetup.includeKeeper === false ? "" : "checked"}/><span>Keeper<small>${gameState.keeperActivity ? "Busy with an action" : Number(gameState.profile.currentHp || 0) <= 0 ? "Downed — heal first" : `${escapeHtml(weapon?.name || "No weapon")} · ${escapeHtml(weapon?.style || "unarmed")}`}</small></span><strong>${gameState.profile.currentHp} HP</strong></label><div class="check-list" id="combat-pet-list">${gameState.pets.filter((pet) => pet.status === "idle" && !petIsInLiveBattle(pet.id) && Number(pet.currentHp || 0) > 0).map((pet) => { const species = SPECIES_BY_ID[pet.speciesId]; return `<label class="check-option"><input type="checkbox" name="combat-pet" value="${pet.id}" ${selectedCombatPets.has(pet.id) ? "checked" : ""}/><span>${escapeHtml(pet.customName || species.name)}<small>Level ${pet.level} · ${pet.currentHp}/${scaledPetStats(pet).hp} HP</small></span><strong>${formatNumber(scaledPetStats(pet).power)}</strong></label>`; }).join("") || `<div class="empty-state">No healthy idle pets are available.</div>`}</div></article>
      <article class="selection-card card hunt-control-card"><p class="eyebrow">Area hunt</p><h3>${escapeHtml(currentRegion.name)}</h3><div class="area-picker">${REGIONS.map((region) => { const pool = listAreaOpponents(gameState, region.id); const unlocked = pool.length > 0; return `<button class="area-card ${region.id === selectedCombatRegion ? "active" : ""} ${unlocked ? "" : "locked"}" data-combat-region="${region.id}" ${unlocked ? "" : "disabled"} type="button"><span>${escapeHtml(region.name)}</span><small>${unlocked ? `${pool.length} possible enemies` : `Combat ${region.level}+`}</small></button>`; }).join("")}</div>
        <div class="encounter-band"><span>Encounter pool</span><strong>${currentPool.length} enemies</strong><small>Common creatures appear often. Rare creatures and area bosses remain genuinely rare.</small></div>
        <div class="combat-controls"><label class="field">Combat style<select id="combat-style"><option value="${escapeHtml(weapon?.style || "melee")}">${escapeHtml((weapon?.style || "melee").replace(/^./, (c) => c.toUpperCase()))} · equipped weapon</option></select></label><label class="field">Auto-eat meal<select id="combat-meal">${meals.map(([id, quantity]) => `<option value="${id}" ${id === preferredMeal ? "selected" : ""}>${escapeHtml(inventoryName(id))} (${quantity})</option>`).join("") || `<option value="">No meals owned</option>`}</select></label></div>
        <div class="automation-grid">
          <label class="automation-option"><input id="combat-auto-hunt" type="checkbox" ${(localSetup.autoHunt ?? (preferences.autoHunt !== false)) ? "checked" : ""}/><span><strong>Auto-hunt</strong><small>Find another random enemy after every finished battle.</small></span></label>
          <label class="automation-option"><input id="combat-auto-eat" type="checkbox" ${(localSetup.autoEat ?? (preferences.autoEat !== false)) ? "checked" : ""}/><span><strong>Auto-eat</strong><small>Use the selected meal when a fighter falls below 38% health.</small></span></label>
          <label class="automation-option"><input id="combat-auto-harvest" type="checkbox" ${(localSetup.autoHarvest ?? (preferences.autoHarvest !== false)) ? "checked" : ""}/><span><strong>Auto-harvest</strong><small>Send defeated enemies to Processing so the hunt can continue.</small></span></label>
        </div>
        <div class="notice"><strong>Capture still matters.</strong> Turn Auto-harvest off when you want the next victory to stop and offer a capture decision.</div><button class="button primary wide hunt-start" data-action="start-combat" ${!currentPool.length || !weapon ? "disabled" : ""} type="button">Start hunting ${escapeHtml(currentRegion.name)}</button></article>
    </div>` : ""}`;
  updateBattleClock();
}

function encounterCard(species) {
  const meals = ownedMeals();
  return `<article class="card card-pad" style="margin-bottom:1rem"><div class="grid two"><div>${petVisual(species)} </div><div><p class="eyebrow">Capture opportunity</p><h2>${escapeHtml(species.name)}</h2><p class="muted">Use one cooked meal for a capture attempt. Failure sends the defeated pet to Processing.</p><label class="field">Capture meal<select id="capture-meal">${meals.map(([id, quantity]) => `<option value="${id}">${escapeHtml(inventoryName(id))} · +${Math.round(ITEMS[id].captureBonus * 100)}% (${quantity})</option>`).join("")}</select></label><div class="modal-actions"><button class="button primary" data-action="attempt-capture" ${meals.length ? "" : "disabled"} type="button">Offer meal</button><button class="button secondary" data-action="decline-capture" type="button">Send to Processing</button></div></div></div></article>`;
}

function combatStageMarkup(playback) {
  const battle = playback.battle;
  const fighter = (entry, enemy = false) => {
    const species = SPECIES_BY_ID[entry.speciesId];
    const keeper = entry.kind === "keeper";
    const hp = Number(playback.hp[entry.id] ?? entry.startingHp ?? entry.maxHp);
    const defeated = hp <= 0;
    return `<div class="fighter ${enemy ? "enemy" : ""} ${defeated ? "defeated" : ""}" id="fighter-${entry.id}" data-fighter-id="${entry.id}">
      <div class="fighter-card-head"><span>${enemy ? "Wild opponent" : keeper ? "Keeper" : "Party pet"}</span><b>${escapeHtml(keeper ? entry.combatStyle : species.affinity)}</b></div>
      <div class="fighter-portrait">${keeper ? `<div class="keeper-combat-avatar">K</div>` : `<img src="${escapeHtml(species.art || PLACEHOLDER_ART)}" alt="${escapeHtml(entry.name)}" decoding="async" />`}</div>
      <div class="fighter-name"><strong>${escapeHtml(entry.name)}</strong><span>Lv ${entry.level || 1} · ${escapeHtml(entry.ability || species?.ability?.name || "Ability")}</span></div>
      <div class="bar-label"><span>Health</span><b data-hp-text="${entry.id}">${formatNumber(hp)} / ${formatNumber(entry.maxHp)}</b></div>
      <div class="health-bar"><span id="hp-${entry.id}" style="width:${Math.max(0, hp / entry.maxHp * 100)}%"></span></div>
      <div class="bar-label attack-label"><span>Next attack</span><b data-attack-time="${entry.id}">—</b></div>
      <div class="attack-bar"><span data-attack-meter="${entry.id}"></span></div>
    </div>`;
  };
  const region = REGIONS.find((entry) => entry.id === battle.regionId);
  return `<div class="combat-header"><span class="battle-state live"><i></i> ${region ? `${escapeHtml(region.name)} encounter` : "Battle in progress"}</span><span class="battle-header-actions">${autoHuntSession ? `<button class="stop-hunt" data-action="stop-auto-hunt" type="button">Stop after battle</button>` : ""}<span data-battle-time>0:00 / ${formatCombatClock(playback.totalDuration)}</span></span></div>
    <div class="combatants"><div class="team-side">${battle.team.map((entry) => fighter(entry)).join("")}</div><div class="versus-mark">VS</div><div class="enemy-side">${fighter(battle.enemy, true)}</div></div>
    <div class="battle-feed"><div><span>Battle log</span><b>${battle.team.length} vs 1</b></div><ol id="battle-log">${playback.logs.slice(0, 5).map((entry) => `<li class="${entry.type}">${escapeHtml(entry.text)}</li>`).join("") || `<li class="muted-log">Attack timers are charging…</li>`}</ol></div>`;
}

function clearBattleTimers() {
  battleTimers.forEach(clearTimeout);
  battleTimers = [];
  activeBattle = null;
}

function stopAutoHunt(message = "Auto-hunt stopped.") {
  if (autoHuntTimer) clearTimeout(autoHuntTimer);
  autoHuntTimer = null;
  const wasActive = Boolean(autoHuntSession);
  autoHuntSession = null;
  if (wasActive && message) toast(message);
}

function playbackDuration(battle) {
  return Math.min(COMBAT_MAX_PLAYBACK_MS, Math.max(COMBAT_MIN_PLAYBACK_MS, Number(battle.duration || 1)));
}

function beginBattle(battle, focusCombat = true) {
  clearBattleTimers();
  const totalDuration = playbackDuration(battle);
  const scale = totalDuration / Math.max(1, Number(battle.duration || 1));
  const fighters = [...battle.team, battle.enemy];
  activeBattle = {
    battle,
    scale,
    totalDuration,
    startedAt: Date.now() + 900,
    hp: Object.fromEntries(fighters.map((entry) => [entry.id, Number(entry.startingHp ?? entry.maxHp)])),
    lastAttackAt: Object.fromEntries(fighters.map((entry) => [entry.id, 0])),
    logs: [],
    ending: false,
  };
  renderShell();
  if (focusCombat || currentPanel === "combat") {
    currentPanel = "combat";
    renderCombat();
    if (focusCombat) panel.scrollTop = 0;
  }
  for (const event of battle.events) {
    const timer = setTimeout(() => applyBattleEvent(event), Math.max(0, 900 + event.time * scale));
    battleTimers.push(timer);
  }
}

function applyBattleEvent(event) {
  if (!activeBattle) return;
  if (event.type === "hit") {
    playSound(event.critical ? "critical" : event.ability ? "ability" : event.sourceId === activeBattle.battle.enemy.id ? "enemyAttack" : "attack");
    activeBattle.hp[event.targetId] = event.targetHp;
    activeBattle.lastAttackAt[event.sourceId] = Number(event.time || 0) * activeBattle.scale;
    const sourceName = battleFighterName(event.sourceId);
    const targetName = battleFighterName(event.targetId);
    const description = event.ability
      ? `${sourceName} used ${event.ability} on ${targetName} for ${event.amount}.`
      : `${sourceName} hit ${targetName} for ${event.amount}${event.critical ? " — critical!" : "."}`;
    addBattleLog(description, event.critical ? "critical" : event.strong ? "strong" : "hit");
    const source = $(`#fighter-${CSS.escape(event.sourceId)}`);
    const target = $(`#fighter-${CSS.escape(event.targetId)}`);
    target?.classList.add("hit");
    source?.querySelector(".attack-bar")?.classList.add("fired");
    setTimeout(() => { target?.classList.remove("hit"); source?.querySelector(".attack-bar")?.classList.remove("fired"); }, 260);
    const hp = $(`#hp-${CSS.escape(event.targetId)}`);
    if (hp) hp.style.width = `${Math.max(0, event.targetHp / event.targetMaxHp * 100)}%`;
    const hpText = document.querySelector(`[data-hp-text="${CSS.escape(event.targetId)}"]`);
    if (hpText) hpText.textContent = `${formatNumber(event.targetHp)} / ${formatNumber(event.targetMaxHp)}`;
    if (event.targetHp <= 0) target?.classList.add("defeated");
    floatNumber(target, `-${event.amount}`, event.critical ? "critical" : event.strong ? "strong" : "", event.critical ? "CRIT" : event.ability || "");
    if (event.ability) showBattleMessage(event.ability);
  } else if (event.type === "heal") {
    playSound("heal");
    activeBattle.hp[event.targetId] = event.targetHp;
    addBattleLog(`${battleFighterName(event.targetId)} ate ${inventoryName(event.mealId)} and healed ${event.amount}.`, "heal");
    const target = $(`#fighter-${CSS.escape(event.targetId)}`);
    const hp = $(`#hp-${CSS.escape(event.targetId)}`);
    if (hp) hp.style.width = `${Math.max(0, event.targetHp / event.targetMaxHp * 100)}%`;
    const hpText = document.querySelector(`[data-hp-text="${CSS.escape(event.targetId)}"]`);
    if (hpText) hpText.textContent = `${formatNumber(event.targetHp)} / ${formatNumber(event.targetMaxHp)}`;
    floatNumber(target, `+${event.amount}`, "heal", "MEAL");
  } else if (event.type === "start") {
    playSound("nav");
    addBattleLog("The hunt began. Attack timers are charging.", "start");
  } else if (event.type === "end") {
    if (activeBattle.ending) return;
    activeBattle.ending = true;
    const harvested = Boolean(activeBattle.battle.autoHarvested);
    addBattleLog(event.victory ? harvested ? "Victory! The enemy was sent to Processing." : "Victory! A capture decision is ready." : "The party withdrew safely.", event.victory ? "victory" : "retreat");
    showBattleMessage(event.victory ? harvested ? "Victory — sent to Processing" : "Victory — capture decision ready" : "Party withdrew safely");
    const timer = setTimeout(() => finishBattlePlayback(event.victory), 2200);
    battleTimers.push(timer);
  }
  updateBattleClock();
}

function battleFighterName(id) {
  if (!activeBattle) return "A combatant";
  return [...activeBattle.battle.team, activeBattle.battle.enemy].find((entry) => entry.id === id)?.name || "A combatant";
}

function addBattleLog(text, type = "hit") {
  if (!activeBattle) return;
  activeBattle.logs.unshift({ text, type });
  const log = $("#battle-log");
  if (log) log.innerHTML = activeBattle.logs.slice(0, 5).map((entry) => `<li class="${entry.type}">${escapeHtml(entry.text)}</li>`).join("");
}

function finishBattlePlayback(victory) {
  const battle = activeBattle?.battle;
  const continueHunt = Boolean(victory && battle?.autoHarvested && autoHuntSession && !gameState.pendingEncounter);
  if (autoHuntSession) autoHuntSession.round += 1;
  battleTimers.forEach(clearTimeout);
  battleTimers = [];
  activeBattle = null;
  renderShell();
  playSound(victory ? "victory" : "defeat");
  if (!continueHunt) selectedCombatPets.clear();
  if (!victory || gameState.pendingEncounter || !battle?.autoHarvested) stopAutoHunt("");
  if (currentPanel === "combat") renderCombat();
  toast(victory ? "Battle won." : "Party withdrew.", "info", victory ? battle?.autoHarvested ? "The enemy is waiting in Processing." : "Choose a capture meal or send the pet to Processing." : "No pets were lost.");
  if (continueHunt) {
    autoHuntTimer = setTimeout(() => startCombatAction(true), 1600);
  }
}

function formatCombatClock(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, "0")}`;
}

function updateBattleClock() {
  if (!activeBattle) return;
  const elapsed = Math.max(0, Date.now() - activeBattle.startedAt);
  const clock = $("[data-battle-time]");
  if (clock) clock.textContent = `${formatCombatClock(Math.min(elapsed, activeBattle.totalDuration))} / ${formatCombatClock(activeBattle.totalDuration)}`;
  for (const entry of [...activeBattle.battle.team, activeBattle.battle.enemy]) {
    const meter = document.querySelector(`[data-attack-meter="${CSS.escape(entry.id)}"]`);
    const time = document.querySelector(`[data-attack-time="${CSS.escape(entry.id)}"]`);
    const hp = Number(activeBattle.hp[entry.id] ?? entry.maxHp);
    if (hp <= 0 || activeBattle.ending) {
      if (meter) meter.style.width = "0%";
      if (time) time.textContent = hp <= 0 ? "Defeated" : "Complete";
      continue;
    }
    const interval = Math.max(1, Number(entry.attackInterval || 2200) * activeBattle.scale);
    const lastAttack = Number(activeBattle.lastAttackAt[entry.id] || 0);
    const since = Math.max(0, elapsed - lastAttack);
    const cycle = Math.min(interval, since);
    const remaining = Math.max(0, interval - cycle);
    if (meter) meter.style.width = `${Math.min(100, cycle / interval * 100)}%`;
    if (time) time.textContent = `${(remaining / 1000).toFixed(1)}s`;
  }
}

function floatNumber(target, value, className, label = "") {
  if (!target) return;
  const node = document.createElement("span");
  node.className = `damage-number ${className}`;
  node.innerHTML = `<strong>${escapeHtml(value)}</strong>${label ? `<small>${escapeHtml(label)}</small>` : ""}`;
  target.querySelector(".fighter-portrait")?.append(node);
  setTimeout(() => node.remove(), 850);
}

function showBattleMessage(text) {
  const stage = $("#combat-stage");
  if (!stage) return;
  stage.querySelector(".battle-message")?.remove();
  const node = document.createElement("div");
  node.className = "battle-message";
  node.textContent = text;
  stage.append(node);
  setTimeout(() => node.remove(), 1000);
}

function renderDungeons() {
  panel.innerHTML = `${panelHeading("Asynchronous expeditions", "Dungeons", "Dungeon pets do not consume the six normal assignment slots, but each expedition pet remains unavailable until the run returns.")}
    ${gameState.dungeonRuns.length ? `<div class="card card-pad" style="margin-bottom:1rem"><p class="eyebrow">Underway</p><div class="assignment-list">${gameState.dungeonRuns.map((run) => { const dungeon = DUNGEONS.find((entry) => entry.id === run.dungeonId); const ready = run.endAt <= Date.now(); return `<div class="assignment" data-live-dungeon="${run.id}"><div class="assignment-head"><strong>${escapeHtml(dungeon.name)}</strong><small data-dungeon-time>${ready ? "Ready to claim" : formatTime(run.endAt - Date.now())}</small></div><div class="progress"><span style="width:${Math.min(100, (Date.now() - run.startedAt) / (run.endAt - run.startedAt) * 100)}%"></span></div><button class="button compact ${ready ? "primary" : "ghost"}" data-action="claim-dungeon" data-id="${run.id}" ${ready ? "" : "disabled"} type="button">${ready ? "Claim result" : `${Math.round(run.chance * 100)}% chance`}</button></div>`; }).join("")}</div></div>` : ""}
    <div class="dungeon-grid">${DUNGEONS.map((dungeon) => {
      const unlocked = skillLevel(gameState, "combat") >= dungeon.level;
      return `<article class="dungeon-card card ${unlocked ? "" : "locked"}"><p class="eyebrow">Combat ${dungeon.level}</p><h3>${escapeHtml(dungeon.name)}</h3><p class="muted small-copy">${formatTime(dungeon.duration * 1000)} · Recommended power ${formatNumber(dungeon.recommendedPower)}</p><div class="cost-list"><span class="tag affinity" style="--affinity:${affinityColors[dungeon.favored]?.[0]}">${dungeon.favored} favored</span>${Object.entries(dungeon.entry).map(([id, amount]) => `<span class="tag">${amount} ${escapeHtml(inventoryName(id))}</span>`).join("")}</div><p class="small-copy">Success grants full rewards. Failure returns a partial cache. A rare success may reveal a capture encounter.</p><button class="button ${unlocked ? "primary" : "ghost"}" data-action="open-dungeon" data-id="${dungeon.id}" ${unlocked ? "" : "disabled"} type="button">${unlocked ? "Prepare party" : `Locked at Combat ${dungeon.level}`}</button></article>`;
    }).join("")}</div>`;
}

function renderMarket() {
  const listings = marketListings.length ? marketListings : localSeedListings();
  panel.innerHTML = `${panelHeading("Unlimited pet trading", "Marketplace", "Pets may change hands any number of times. Sellers pay a 2% listing fee, with a minimum charge of five coins.", `<span class="tag">${mode === "firebase" ? "Live shared listings" : "Private preview listings"}</span>`)}
    <div class="market-grid">${listings.map((listing) => {
      const species = SPECIES_BY_ID[listing.speciesId || listing.pet?.speciesId];
      const own = (mode === "firebase" && currentUser && listing.sellerUid === currentUser.uid) || (mode === "local" && listing.sellerUid === "local");
      return `<article class="market-card card">${petVisual(species)}<p class="eyebrow" style="margin-top:.8rem">${escapeHtml(species.acquisition)} · ${listing.pet?.stars || 1}/5 stars</p><h3>${escapeHtml(species.name)}</h3><p class="muted small-copy">Level ${listing.pet?.level || 1} · Seller ${escapeHtml(listing.sellerName || "Keeper")}</p><div class="chance-display"><span>Price</span><strong>${formatNumber(listing.price)} coins</strong></div>${own ? `<button class="button secondary wide" data-action="cancel-listing" data-id="${listing.id}" type="button">Cancel listing</button>` : `<button class="button primary wide" data-action="buy-listing" data-id="${listing.id}" type="button">Buy pet</button>`}</article>`;
    }).join("")}</div>`;
}

function localSeedListings() {
  if (!marketListings.length && mode === "local") {
    const hare = createPetInstance("moss-hare", "local-market");
    const boar = createPetInstance("stoneback-boar", "local-market");
    marketListings = [
      { id: "local-hare", sellerUid: "test-keeper-a", sellerName: "Field Keeper", speciesId: hare.speciesId, pet: hare, price: 90, createdAt: Date.now() - 40000 },
      { id: "local-boar", sellerUid: "test-keeper-b", sellerName: "Hill Keeper", speciesId: boar.speciesId, pet: boar, price: 140, createdAt: Date.now() - 80000 },
    ];
  }
  return marketListings;
}

function renderCollection() {
  panel.innerHTML = `${panelHeading("Fifty launch species", "Pet Collection", `${gameState.discoveries.length} of ${PET_SPECIES.length} species discovered. All species can fight; aptitude and stat profiles determine their specialties.`)}
    ${REGIONS.map((region) => `<section style="margin-bottom:1.4rem"><div class="section-heading compact-heading"><div><p class="eyebrow">${region.skillBand}</p><h2>${escapeHtml(region.name)}</h2></div><span class="tag">${PET_SPECIES.filter((pet) => pet.region === region.id).length} species</span></div><div class="collection-grid">${PET_SPECIES.filter((pet) => pet.region === region.id).map((species) => { const found = gameState.discoveries.includes(species.id); const art = species.art || PLACEHOLDER_ART; return `<article class="collection-card ${found ? "" : "undiscovered"}"><div class="collection-visual" style="--affinity-soft:${affinityColors[species.affinity]?.[1]}"><img src="${escapeHtml(art)}" alt="${found ? escapeHtml(species.name) : ""}" loading="lazy" decoding="async" /></div><div class="collection-copy"><h3>${found ? escapeHtml(species.name) : "Undiscovered"}</h3><p>${found ? `${species.affinity} · ${species.acquisition}` : `${region.name} species`}</p></div></article>`; }).join("")}</div></section>`).join("")}`;
}

function ownedMeals() {
  return Object.entries(gameState.inventory).filter(([id, quantity]) => ITEMS[id]?.category === "meal" && Number(quantity) > 0);
}

function openStartModal(kind, id) {
  const task = kind === "activity" ? ACTIVITIES.find((entry) => entry.id === id) : kind === "recipe" ? RECIPES.find((entry) => entry.id === id) : kind === "construction" ? BUILDINGS.find((entry) => entry.id === id) : gameState.remains.find((entry) => entry.id === id);
  const skill = kind === "processing" ? "processing" : kind === "construction" ? "construction" : task.skill;
  const idle = gameState.pets.filter((pet) => pet.status === "idle" && !petIsInLiveBattle(pet.id) && Number(pet.currentHp || 0) > 0);
  const meals = ownedMeals();
  const mealRequired = !(kind === "recipe" && task.skill === "cooking");
  modalContent.innerHTML = `<p class="eyebrow">Assign ${escapeHtml(skill)} pet</p><h2>${escapeHtml(kind === "processing" ? SPECIES_BY_ID[task.speciesId].name : task.name)}</h2><p class="muted">The selected pet occupies one of six active slots. Any pet may try; its 1–10 ${escapeHtml(skill)} aptitude determines speed and yield.</p>
    <label class="field">Pet<select id="modal-pet-select">${idle.map((pet) => { const species = SPECIES_BY_ID[pet.speciesId]; return `<option value="${pet.id}">${escapeHtml(species.name)} · Aptitude ${species.aptitudes[skill] || 1} · Level ${pet.level} · HP ${pet.currentHp}/${scaledPetStats(pet).hp}</option>`; }).join("")}</select></label>
    ${mealRequired ? `<label class="field" style="margin-top:.7rem">Working meal<select id="modal-meal-select">${meals.map(([mealId, quantity]) => `<option value="${mealId}">${escapeHtml(inventoryName(mealId))} · ${ITEMS[mealId].nutrition} nutrition (${quantity})</option>`).join("")}</select></label><div class="notice" style="margin-top:.8rem">Better meals last longer and may improve output or speed. The assignment stops safely when its selected meal runs out.</div>` : `<div class="notice" style="margin-top:.8rem">Cooking pets taste from the recipe ingredients, so no separate working meal is consumed. This keeps the pantry recoverable even if it reaches zero.</div>`}
    <div class="modal-actions"><button class="button primary" id="confirm-start" ${!idle.length || (mealRequired && !meals.length) ? "disabled" : ""} type="button">Start assignment</button></div>`;
  $("#confirm-start", modalContent)?.addEventListener("click", async () => {
    const petId = $("#modal-pet-select", modalContent).value;
    const mealId = $("#modal-meal-select", modalContent)?.value || "";
    modal.close();
    if (kind === "activity") await runAction("startActivity", { petId, activityId: id, mealId });
    if (kind === "recipe") await runAction("startRecipe", { petId, recipeId: id, mealId });
    if (kind === "construction") await runAction("startConstruction", { petId, buildingId: id, mealId });
    if (kind === "processing") await runAction("startProcessing", { petId, remainId: id, mealId });
  });
  modal.showModal();
}

function openHealModal(itemId) {
  const item = ITEMS[itemId];
  const injuredPets = gameState.pets.filter((pet) => Number(pet.currentHp || 0) < scaledPetStats(pet).hp && pet.status === "idle");
  const keeper = keeperStats(gameState);
  modalContent.innerHTML = `<p class="eyebrow">Use ${escapeHtml(item.name)}</p><h2>Restore combat health</h2><p class="muted">Combat injuries persist until healed. Downed pets are never lost, but cannot work, fight, or enter dungeons at 0 health.</p><label class="field">Target<select id="heal-target"><option value="keeper">Keeper · ${gameState.profile.currentHp}/${keeper.maxHp} HP</option>${injuredPets.map((pet) => `<option value="${pet.id}">${escapeHtml(pet.customName || SPECIES_BY_ID[pet.speciesId].name)} · ${pet.currentHp}/${scaledPetStats(pet).hp} HP</option>`).join("")}</select></label><button class="button primary wide" id="confirm-heal" style="margin-top:.8rem" type="button">Use ${escapeHtml(item.name)}</button>`;
  $("#confirm-heal", modalContent).addEventListener("click", async () => { const target = $("#heal-target", modalContent).value; modal.close(); await runAction("useHealingItem", { itemId, targetType: target === "keeper" ? "keeper" : "pet", petId: target === "keeper" ? "" : target }); });
  modal.showModal();
}

function openItemDetails(itemId) {
  const item = ITEMS[itemId] || { name: inventoryName(itemId), category: "item" };
  const quantity = Number(gameState.inventory[itemId] || 0);
  const equipped = Object.values(gameState.equipment || {}).includes(itemId);
  const stats = [["Attack", item.attack], ["Defence", item.defense], ["Health", item.hp], ["Speed", item.speed], ["Heal", item.heal], ["Nutrition", item.nutrition]].filter(([, value]) => value);
  modalContent.innerHTML = `<div class="item-detail-modal"><div class="item-detail-hero item-${escapeHtml(item.category || "item")}">${itemIconMarkup(item)}<span>${escapeHtml(item.category || "item")}</span></div><div><p class="eyebrow">Stored item</p><h2>${escapeHtml(item.name)}</h2><p class="muted">Quantity ${formatNumber(quantity)}${equipped ? " · Currently equipped" : ""}</p><div class="cost-list">${stats.map(([label, value]) => `<span class="tag">${label} +${value}</span>`).join("") || `<span class="tag">Crafting material</span>`}</div><div class="modal-actions">${item.slot ? `<button class="button primary" data-modal-item-action="equip" type="button">${equipped ? "Equipped" : "Equip item"}</button>` : ""}${Number(item.heal || 0) ? `<button class="button secondary" data-modal-item-action="heal" type="button">Use to heal</button>` : ""}</div></div></div>`;
  $("[data-modal-item-action='equip']", modalContent)?.addEventListener("click", async () => { modal.close(); await runAction("equipItem", { itemId }); });
  $("[data-modal-item-action='heal']", modalContent)?.addEventListener("click", () => { modal.close(); openHealModal(itemId); });
  modal.showModal();
}

function openPetDetails(petId, manage = false) {
  const pet = gameState.pets.find((entry) => entry.id === petId);
  if (!pet) return;
  if (manage && petIsInLiveBattle(petId)) {
    manage = false;
    toast("That pet is currently fighting.", "info", "Management actions unlock when the battle ends.");
  }
  const species = SPECIES_BY_ID[pet.speciesId];
  const stats = scaledPetStats(pet);
  modalContent.innerHTML = `<div class="modal-pet">${petVisual(species)}<div><p class="eyebrow">${species.acquisition} · ${species.affinity}</p><h2>${escapeHtml(pet.customName || species.name)}</h2><p class="star-row">${pet.stars}/5 stars · Level ${pet.level}/${levelCapForStars(pet.stars)}</p><p class="muted small-copy">${escapeHtml(species.ability.name)} — ${Math.round(species.ability.power * 100)}% ability power. ${escapeHtml(species.passive.name)}: ${escapeHtml(species.passive.description)}</p><div class="inventory-grid"><div class="inventory-item"><span>Health</span><strong>${pet.currentHp}/${stats.hp}</strong></div><div class="inventory-item"><span>Attack</span><strong>${stats.attack}</strong></div><div class="inventory-item"><span>Defence</span><strong>${stats.defense}</strong></div><div class="inventory-item"><span>Speed</span><strong>${stats.speed}</strong></div></div></div></div>
    <div class="split-line"></div><p class="eyebrow">Aptitudes</p><div class="cost-list">${Object.entries(species.aptitudes).sort((a,b) => b[1]-a[1]).map(([skill, rating]) => `<span class="tag">${escapeHtml(skill)} ${rating}</span>`).join("")}<span class="tag">Unlisted skills 1</span></div>
    ${manage ? `<div class="split-line"></div><div class="grid two"><div><h3>Sacrifice for XP</h3><p class="muted small-copy">Choose an idle recipient. Low-level common pets become extremely inefficient for high-level recipients.</p><select id="sacrifice-recipient" class="inline-select">${gameState.pets.filter((entry) => entry.id !== pet.id && entry.status === "idle" && !petIsInLiveBattle(entry.id)).map((entry) => `<option value="${entry.id}">${escapeHtml(SPECIES_BY_ID[entry.speciesId].name)} · Level ${entry.level}</option>`).join("")}</select><button class="button danger wide" style="margin-top:.5rem" data-modal-action="sacrifice" type="button">Sacrifice this pet</button></div><div><h3>Condense</h3><p class="muted small-copy">Two identical max-level pets become one ${Math.min(5, pet.stars + 1)}-star level 1 pet with a ${pet.stars * 10}% base-stat bonus and a level ${Math.min(100, (pet.stars + 1) * 20)} ceiling.</p><select id="condense-duplicate" class="inline-select">${gameState.pets.filter((entry) => entry.id !== pet.id && entry.speciesId === pet.speciesId && entry.stars === pet.stars && entry.status === "idle" && !petIsInLiveBattle(entry.id)).map((entry) => `<option value="${entry.id}">${escapeHtml(species.name)} · Level ${entry.level}</option>`).join("")}</select><button class="button secondary wide" style="margin-top:.5rem" data-modal-action="condense" type="button">Condense pair</button></div></div><div class="split-line"></div><h3>Marketplace listing</h3><div class="combat-controls"><label class="field">Price in coins<input id="listing-price" type="number" min="10" value="100" /></label><button class="button secondary" data-modal-action="list" type="button">List pet</button></div>` : ""}`;
  if (manage) {
    $("[data-modal-action='sacrifice']", modalContent)?.addEventListener("click", async () => { const recipientId = $("#sacrifice-recipient", modalContent)?.value; if (!recipientId) return toast("Choose a recipient.", "error"); if (!confirm("Sacrifice this pet permanently for XP?")) return; modal.close(); await runAction("sacrificePet", { donorId: pet.id, recipientId }); });
    $("[data-modal-action='condense']", modalContent)?.addEventListener("click", async () => { const duplicateId = $("#condense-duplicate", modalContent)?.value; if (!duplicateId) return toast("No eligible duplicate is available.", "error"); modal.close(); await runAction("condensePets", { primaryId: pet.id, duplicateId }); });
    $("[data-modal-action='list']", modalContent)?.addEventListener("click", async () => { const price = Number($("#listing-price", modalContent)?.value); modal.close(); await listPetAction(pet.id, price); });
  }
  modal.showModal();
}

function openDungeonModal(dungeonId) {
  const dungeon = DUNGEONS.find((entry) => entry.id === dungeonId);
  selectedDungeonPets = new Set();
  const idle = gameState.pets.filter((pet) => pet.status === "idle" && !petIsInLiveBattle(pet.id) && Number(pet.currentHp || 0) > 0);
  modalContent.innerHTML = `<p class="eyebrow">Dungeon party</p><h2>${escapeHtml(dungeon.name)}</h2><p class="muted">Choose up to three idle pets. ${dungeon.favored} pets each add an 8-point affinity bonus to success chance.</p><div class="check-list" id="dungeon-pet-list">${idle.map((pet) => { const species = SPECIES_BY_ID[pet.speciesId]; return `<label class="check-option"><input type="checkbox" value="${pet.id}"/><span>${escapeHtml(species.name)}<small>${species.affinity} · Level ${pet.level}</small></span><strong>${formatNumber(scaledPetStats(pet).power)}</strong></label>`; }).join("")}</div><div class="chance-display"><span>Calculated chance</span><strong id="dungeon-chance">8%</strong></div><button class="button primary wide" id="confirm-dungeon" type="button">Send expedition</button>`;
  $("#dungeon-pet-list", modalContent).addEventListener("change", (event) => {
    if (!event.target.matches("input")) return;
    if (event.target.checked && selectedDungeonPets.size >= MAX_COMBAT_PETS) { event.target.checked = false; return toast(`Choose no more than ${MAX_COMBAT_PETS} pets.`, "error"); }
    if (event.target.checked) selectedDungeonPets.add(event.target.value);
    else selectedDungeonPets.delete(event.target.value);
    const odds = dungeonChance(gameState, dungeonId, [...selectedDungeonPets]);
    $("#dungeon-chance", modalContent).textContent = `${Math.round(odds.chance * 100)}%`;
  });
  $("#confirm-dungeon", modalContent).addEventListener("click", async () => { modal.close(); await runAction("startDungeon", { dungeonId, petIds: [...selectedDungeonPets] }); });
  modal.showModal();
}

async function runAction(action, payload = {}) {
  try {
    if (mode === "firebase") {
      const result = await firebase.gameAction(action, payload);
      if (result.state) setState(result.state, !["resolveCombat", "resolveAreaCombat"].includes(action));
      if (result.capture) { playSound(result.capture.success ? "success" : "loot"); toast(result.capture.success ? "Capture successful." : "Capture failed; remains added to Processing."); }
      if (result.result?.success !== undefined) { playSound(result.result.success ? "success" : "loot"); toast(result.result.success ? "Dungeon cleared." : "Dungeon returned with partial rewards."); }
      return result;
    }
    let result;
    if (action === "startActivity") result = { state: startActivity(gameState, payload) };
    else if (action === "startKeeperActivity") result = { state: startKeeperActivity(gameState, payload) };
    else if (action === "startKeeperRecipe") result = { state: startKeeperRecipe(gameState, payload) };
    else if (action === "startKeeperConstruction") result = { state: startKeeperConstruction(gameState, payload) };
    else if (action === "startKeeperProcessing") result = { state: startKeeperProcessing(gameState, payload) };
    else if (action === "startRecipe") result = { state: startRecipe(gameState, payload) };
    else if (action === "startConstruction") result = { state: startConstruction(gameState, payload) };
    else if (action === "startProcessing") result = { state: startProcessing(gameState, payload) };
    else if (action === "stopActivity") result = { state: stopActivity(gameState, payload.activityId) };
    else if (action === "stopKeeperActivity") result = { state: stopKeeperActivity(gameState) };
    else if (action === "equipItem") result = { state: equipItem(gameState, payload.itemId) };
    else if (action === "buyStoreItem") result = { state: buyStoreItem(gameState, payload) };
    else if (action === "useHealingItem") result = useHealingItem(gameState, payload);
    else if (action === "resolveCombat") result = resolveCombat(gameState, payload);
    else if (action === "resolveAreaCombat") result = resolveAreaCombat(gameState, payload);
    else if (action === "attemptCapture") result = attemptCapture(gameState, payload.mealId);
    else if (action === "declineCapture") result = { state: declineCapture(gameState) };
    else if (action === "sacrificePet") result = sacrificePet(gameState, payload);
    else if (action === "condensePets") result = { state: condensePets(gameState, payload) };
    else if (action === "startDungeon") result = { state: startDungeon(gameState, payload) };
    else if (action === "claimDungeon") result = claimDungeon(gameState, payload.runId);
    else throw new GameError("Unknown action.");
    if (result.state) setState(result.state, !["resolveCombat", "resolveAreaCombat"].includes(action));
    return result;
  } catch (error) {
    reportError(error);
    return null;
  }
}

async function listPetAction(petId, price) {
  try {
    if (mode === "firebase") {
      const result = await firebase.listPet(petId, price);
      if (result.state) setState(result.state);
      toast("Pet listed.", "info", `${formatNumber(result.listing?.fee)} coin fee paid.`);
    } else {
      const result = prepareMarketListing(gameState, { petId, price });
      setState(result.state);
      marketListings.unshift({ id: `local-own-${Date.now()}`, sellerUid: "local", sellerName: gameState.profile.displayName, speciesId: result.listing.speciesId, ...result.listing });
    toast("Preview listing created.");
    }
  } catch (error) { reportError(error); }
}

async function buyListingAction(listingId) {
  try {
    if (mode === "firebase") {
      const result = await firebase.buyPet(listingId);
      if (result.state) setState(result.state);
      toast("Pet purchased.");
      return;
    }
    const listing = marketListings.find((entry) => entry.id === listingId);
    if (!listing) throw new GameError("Listing no longer exists.");
    if (listing.sellerUid === "local") throw new GameError("You cannot buy your own listing.");
    setState(receiveMarketPet(gameState, listing.pet, listing.price));
    marketListings = marketListings.filter((entry) => entry.id !== listingId);
    toast("Pet purchased in the private preview.");
  } catch (error) { reportError(error); }
}

async function cancelListingAction(listingId) {
  try {
    if (mode === "firebase") {
      const result = await firebase.cancelListing(listingId);
      if (result.state) setState(result.state);
      toast("Listing cancelled.");
      return;
    }
    const listing = marketListings.find((entry) => entry.id === listingId && entry.sellerUid === "local");
    if (!listing) throw new GameError("Listing not found.");
    const next = restoreCancelledListing(gameState, listing.pet);
    marketListings = marketListings.filter((entry) => entry.id !== listingId);
    setState(next);
  } catch (error) { reportError(error); }
}

async function startCombatAction(repeating = false) {
  if (activeBattle || combatRequestInProgress) return;
  const request = repeating && autoHuntSession ? { ...autoHuntSession.request } : {
    petIds: [...selectedCombatPets],
    regionId: selectedCombatRegion,
    mealId: $("#combat-meal")?.value || "",
    includeKeeper: Boolean($("#combat-keeper")?.checked),
    combatStyle: $("#combat-style")?.value || "melee",
    autoHunt: Boolean($("#combat-auto-hunt")?.checked),
    autoEat: Boolean($("#combat-auto-eat")?.checked),
    autoHarvest: Boolean($("#combat-auto-harvest")?.checked),
  };
  if (!repeating) {
    writeCombatSetup({ autoHunt: request.autoHunt, autoEat: request.autoEat, autoHarvest: request.autoHarvest, includeKeeper: request.includeKeeper });
    stopAutoHunt("");
    if (request.autoHunt) autoHuntSession = { request, round: 0 };
  }
  const button = $("[data-action='start-combat']");
  combatRequestInProgress = true;
  if (button) { button.disabled = true; button.textContent = repeating ? "Finding next enemy…" : "Searching the area…"; }
  try {
    const result = await runAction("resolveAreaCombat", request);
    if (result?.battle) beginBattle(result.battle, !repeating);
    else stopAutoHunt("");
  } finally {
    combatRequestInProgress = false;
    if (button?.isConnected) { button.disabled = false; button.textContent = "Start area hunt"; }
  }
}

function enterGame(nextMode, state) {
  mode = nextMode;
  $("#auth-view").hidden = true;
  $("#game-view").hidden = false;
  setState(state);
  if (currentUser?.emailVerified === false) toast("Check your inbox to verify your email.");
}

function leaveGame() {
  stopAutoHunt("");
  clearBattleTimers();
  gameState = null;
  mode = "auth";
  loadedUserId = null;
  $("#game-view").hidden = true;
  $("#auth-view").hidden = false;
}

async function loadAuthenticatedUser(user, preferredName = "") {
  if (!user || !firebase) return null;
  currentUser = user;
  if (loadedUserId === user.uid && mode === "firebase" && gameState) return { state: gameState };
  if (authLoadPromise) return authLoadPromise;
  authLoadPromise = (async () => {
    const result = await firebase.initializePlayer(preferredName || user.displayName || "Keeper");
    if (!result?.state) throw Object.assign(new Error("Your den did not return a save."), { code: "game/empty-save" });
    loadedUserId = user.uid;
    enterGame("firebase", result.state);
    return result;
  })();
  try {
    return await authLoadPromise;
  } finally {
    authLoadPromise = null;
  }
}

async function initializeFirebase() {
  try {
    firebase = await connectFirebase({
      onAuth: async (user) => {
        currentUser = user;
        if (!user) {
          loadedUserId = null;
          if (mode === "firebase") leaveGame();
          return;
        }
        if (!firebase || authActionInProgress) return;
        try {
          await loadAuthenticatedUser(user);
        } catch (error) { reportError(error); }
      },
      onState: (state) => {
        if (!state || !currentUser) return;
        if (mode !== "firebase") enterGame("firebase", state);
        else if (activeBattle || combatRequestInProgress) { setState(state, false); renderShell(); }
        else setState(state);
      },
      onMarket: (listings) => { marketListings = listings; if (currentPanel === "market") queueRender(); },
      onLeaderboard: (entries) => { leaderboard = entries; if (currentPanel === "overview") queueRender(); },
      onError: (error) => console.warn("Firebase listener", error),
    });
    const initialUser = await firebase.authReady;
    if (initialUser && mode !== "firebase" && !authActionInProgress) await loadAuthenticatedUser(initialUser);
  } catch (error) {
    console.warn("Firebase unavailable.", error);
    if (!previewEnabled) reportError(error);
  }
}

function setAuthMode(nextMode) {
  authMode = nextMode === "register" ? "register" : "signin";
  $$('[data-auth-mode]').forEach((button) => {
    const active = button.dataset.authMode === authMode;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  const registering = authMode === "register";
  $("#name-field").hidden = !registering;
  $("#display-name").required = registering;
  $("#password").autocomplete = registering ? "new-password" : "current-password";
  $("#email-submit").textContent = registering ? "Create your den" : "Enter your den";
  $("#reset-password").hidden = registering;
}

function setAuthBusy(busy, provider = "email") {
  $("#email-submit").disabled = busy;
  $("#google-signin").disabled = busy;
  $("#reset-password").disabled = busy;
  $$('[data-auth-mode]').forEach((button) => { button.disabled = busy; });
  if (busy) $("#email-submit").textContent = provider === "google" ? "Opening Google…" : authMode === "register" ? "Creating your den…" : "Signing in…";
  else $("#email-submit").textContent = authMode === "register" ? "Create your den" : "Enter your den";
}

function enterLocalPreview() {
  const saved = localStorage.getItem(LOCAL_SAVE);
  let state;
  try { state = saved ? JSON.parse(saved) : createInitialState("Preview Keeper"); }
  catch { state = createInitialState("Preview Keeper"); }
  enterGame("local", settleState(state).state);
}

document.addEventListener("click", async (event) => {
  const interactive = event.target.closest("button, [role='button'], a, select, input[type='checkbox']");
  if (interactive && !event.target.closest("#sound-toggle")) playSound("click");
  const panelJump = event.target.closest("[data-panel-jump]");
  if (panelJump) { playSound("nav"); currentPanel = panelJump.dataset.panelJump; queueRender(); return; }
  const nav = event.target.closest("[data-panel]");
  if (nav) { playSound("nav"); currentPanel = nav.dataset.panel; $("#sidebar").classList.remove("open"); queueRender(); return; }
  const regionButton = event.target.closest("[data-combat-region]");
  if (regionButton) { selectedCombatRegion = regionButton.dataset.combatRegion; renderCombat(); return; }
  const skillButton = event.target.closest("[data-skill]");
  if (skillButton) { currentSkill = skillButton.dataset.skill; queueRender(); return; }
  const filterButton = event.target.closest("[data-inventory-filter]");
  if (filterButton) { inventoryFilter = filterButton.dataset.inventoryFilter; queueRender(); return; }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const name = action.dataset.action;
  if (name === "open-start") openStartModal(action.dataset.kind, action.dataset.id);
  else if (name === "start-keeper-activity") await runAction("startKeeperActivity", { activityId: action.dataset.id });
  else if (name === "start-keeper-recipe") await runAction("startKeeperRecipe", { recipeId: action.dataset.id });
  else if (name === "start-keeper-construction") await runAction("startKeeperConstruction", { buildingId: action.dataset.id });
  else if (name === "start-keeper-processing") await runAction("startKeeperProcessing", { remainId: action.dataset.id });
  else if (name === "pet-details") openPetDetails(action.dataset.petId, false);
  else if (name === "pet-manage") openPetDetails(action.dataset.petId, true);
  else if (name === "stop-assignment") await runAction("stopActivity", { activityId: action.dataset.id });
  else if (name === "stop-keeper-assignment") await runAction("stopKeeperActivity");
  else if (name === "equip-item") await runAction("equipItem", { itemId: action.dataset.id });
  else if (name === "buy-store-item") await runAction("buyStoreItem", { itemId: action.dataset.id, quantity: 1 });
  else if (name === "open-heal") openHealModal(action.dataset.id);
  else if (name === "item-details") openItemDetails(action.dataset.id);
  else if (name === "start-combat") await startCombatAction();
  else if (name === "stop-auto-hunt") { stopAutoHunt("Auto-hunt will stop after this battle."); renderCombat(); }
  else if (name === "attempt-capture") await runAction("attemptCapture", { mealId: $("#capture-meal")?.value });
  else if (name === "decline-capture") await runAction("declineCapture");
  else if (name === "open-dungeon") openDungeonModal(action.dataset.id);
  else if (name === "claim-dungeon") await runAction("claimDungeon", { runId: action.dataset.id });
  else if (name === "buy-listing") await buyListingAction(action.dataset.id);
  else if (name === "cancel-listing") await cancelListingAction(action.dataset.id);
});

document.addEventListener("change", (event) => {
  if (event.target.matches("input[name='combat-pet']")) {
    if (event.target.checked && selectedCombatPets.size >= MAX_COMBAT_PETS) { event.target.checked = false; return toast(`Combat parties can contain at most ${MAX_COMBAT_PETS} pets.`, "error"); }
    if (event.target.checked) selectedCombatPets.add(event.target.value);
    else selectedCombatPets.delete(event.target.value);
  }
  if (["combat-auto-hunt", "combat-auto-eat", "combat-auto-harvest", "combat-keeper"].includes(event.target.id)) {
    const saved = readCombatSetup();
    const key = event.target.id === "combat-auto-hunt" ? "autoHunt" : event.target.id === "combat-auto-eat" ? "autoEat" : event.target.id === "combat-auto-harvest" ? "autoHarvest" : "includeKeeper";
    writeCombatSetup({ ...saved, [key]: Boolean(event.target.checked) });
  }
});

$("#modal-close").addEventListener("click", () => modal.close());
modal.addEventListener("click", (event) => { if (event.target === modal) modal.close(); });
$("#mobile-menu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
$("#sound-toggle").addEventListener("click", () => {
  const on = toggleSound();
  $("#sound-toggle").textContent = on ? "Sound On" : "Sound Off";
  $("#sound-toggle").setAttribute("aria-pressed", String(on));
});
$("#account-action").addEventListener("click", async () => { if (mode === "firebase") await firebase.signOut(); else leaveGame(); });
$$("[data-auth-mode]").forEach((button) => button.addEventListener("click", () => setAuthMode(button.dataset.authMode)));

$("#auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!firebase) return toast("The game service is still connecting.", "error", "Please wait a moment and try again.");
  authActionInProgress = true;
  setAuthBusy(true, "email");
  try {
    if (authMode === "register") {
      const displayName = $("#display-name").value.trim();
      const credential = await firebase.registerEmail($("#email").value.trim(), $("#password").value, displayName);
      await loadAuthenticatedUser(credential.user, displayName);
      toast(credential.verificationSent ? "Account created. Verification email sent." : "Account created.", "info", credential.verificationSent ? "" : "The verification email could not be sent, but your den is ready.");
    } else {
      const credential = await firebase.signInEmail($("#email").value.trim(), $("#password").value);
      await loadAuthenticatedUser(credential.user);
    }
  } catch (error) {
    reportError(error);
  } finally {
    authActionInProgress = false;
    setAuthBusy(false);
  }
});
$("#google-signin").addEventListener("click", async () => {
  if (!firebase) return toast("The game service is still connecting.", "error", "Please wait a moment and try again.");
  authActionInProgress = true;
  setAuthBusy(true, "google");
  try {
    const credential = await firebase.signInGoogle();
    await loadAuthenticatedUser(credential.user);
  } catch (error) {
    reportError(error);
  } finally {
    authActionInProgress = false;
    setAuthBusy(false);
  }
});
$("#reset-password").addEventListener("click", async () => { const email = $("#email").value.trim(); if (!email) return toast("Enter your email first.", "error"); try { await firebase.sendPasswordReset(email); toast("Password reset email sent."); } catch (error) { reportError(error); } });

document.addEventListener("visibilitychange", async () => {
  if (document.visibilityState !== "visible" || !gameState) return;
  if (mode === "firebase") { try { const result = await firebase.syncGame(); if (result.state) setState(result.state); } catch (error) { reportError(error); } }
  else setState(settleState(gameState).state);
});

setInterval(async () => {
  if (!gameState) return;
  if (mode === "local") {
    const settled = settleState(gameState);
    setState(settled.state, false);
    if (settled.events.length) {
      renderShell();
      if (currentPanel === "overview") queueRender();
    } else {
      updateLiveProgress();
    }
  }
}, 1000);

setInterval(async () => {
  if (mode !== "firebase" || !gameState || !firebase) return;
  try { const result = await firebase.syncGame(); if (result.state) setState(result.state); } catch (error) { console.warn(error); }
}, 30000);

// Visual timers stay smooth without creating additional Firestore writes.
setInterval(updateLiveProgress, 150);

$$('[data-version]').forEach((node) => { node.textContent = GAME_VERSION; });
document.title = GAME_NAME;
$("#sound-toggle").textContent = soundEnabled() ? "Sound On" : "Sound Off";
$("#sound-toggle").setAttribute("aria-pressed", String(soundEnabled()));
setAuthMode("signin");
initializeFirebase();
if (previewEnabled) enterLocalPreview();
