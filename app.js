import {
  ACTIVITIES,
  BUILDINGS,
  DUNGEONS,
  GAME_VERSION,
  ITEMS,
  MAX_ACTIVE_PETS,
  MAX_COMBAT_PETS,
  PET_SPECIES,
  RECIPES,
  REGIONS,
  SKILLS,
  SPECIES_BY_ID,
  inventoryName,
  levelCapForStars,
  scaledPetStats,
  xpForNextLevel,
} from "./game-data.js";
import {
  GameError,
  activePetCount,
  attemptCapture,
  buildingCosts,
  claimDungeon,
  condensePets,
  createInitialState,
  createPetInstance,
  declineCapture,
  denCapacity,
  dungeonChance,
  listAvailableOpponents,
  normalizeState,
  prepareMarketListing,
  receiveMarketPet,
  resolveCombat,
  restoreCancelledListing,
  sacrificePet,
  settleState,
  skillLevel,
  startActivity,
  startConstruction,
  startDungeon,
  startProcessing,
  startRecipe,
  stopActivity,
  storageCapacity,
} from "./game-engine.js";
import { connectFirebase } from "./firebase-client.js";
import { friendlyAuthError } from "./auth-errors.js";

const LOCAL_SAVE = "pet-idle-mmo-local-v1";
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
let marketListings = [];
let leaderboard = [];
let selectedCombatPets = new Set();
let selectedDungeonPets = new Set();
let battleTimers = [];
let activeBattle = null;
let combatRequestInProgress = false;
let renderQueued = false;
let authMode = "signin";
let authActionInProgress = false;
let authLoadPromise = null;
let loadedUserId = null;

const COMBAT_MIN_PLAYBACK_MS = 14000;
const COMBAT_MAX_PLAYBACK_MS = 45000;

const affinityColors = {
  Ember: ["#b85b38", "#f2d2bf"], Verdant: ["#668353", "#dce8cf"], Tide: ["#4c7890", "#d4e7ec"],
  Stone: ["#726e62", "#e2ded2"], Spark: ["#b68a35", "#f1e4b9"], Gale: ["#63898a", "#d5e8e3"],
  Radiant: ["#b78a41", "#f1e5bf"], Umbral: ["#60536f", "#ded5e8"], Frost: ["#668ca7", "#d8e8f0"],
};

const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[character]));
const formatNumber = (value) => new Intl.NumberFormat("en-US", { notation: Number(value) >= 100000 ? "compact" : "standard", maximumFractionDigits: 1 }).format(Number(value || 0));
const formatTime = (milliseconds) => {
  const seconds = Math.max(0, Math.ceil(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return seconds % 60 ? `${minutes}m ${seconds % 60}s` : `${minutes}m`;
};
function toast(message, type = "info", detail = "") {
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
  const status = petIsInLiveBattle(instance.id) ? "Fighting" : instance.status === "idle" ? "Idle" : String(instance.status).split(":")[0];
  const aptitudes = Object.entries(species.aptitudes).sort((a, b) => b[1] - a[1]).slice(0, 3);
  return `<article class="pet-card" data-pet-id="${instance.id}">
    <div class="pet-status">${escapeHtml(status)}</div>
    ${petVisual(species)}
    <div class="pet-body">
      <div class="pet-title-row"><div><h3>${escapeHtml(instance.customName || species.name)}</h3><p>${escapeHtml(species.affinity)} · Power ${formatNumber(stats.power)}</p></div><span class="star-row">${"★".repeat(instance.stars)}${"☆".repeat(5 - instance.stars)}</span></div>
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
  $("#active-count").textContent = `${active} / ${MAX_ACTIVE_PETS}`;
  $("#active-meter").style.width = `${active / MAX_ACTIVE_PETS * 100}%`;
  $("#top-resources").innerHTML = [
    ["Coins", gameState.profile.coins], ["Meals", mealCount()], ["Pets", `${gameState.pets.length}/${denCapacity(gameState)}`], ["Remains", gameState.remains.length],
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
  if (assignment.kind === "activity") {
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

function assignmentProgress(assignment) {
  return assignmentTiming(assignment).progress;
}

function assignmentLabel(assignment) {
  if (assignment.kind === "activity") return ACTIVITIES.find((entry) => entry.id === assignment.taskId)?.name || "Activity";
  if (assignment.kind === "recipe") return RECIPES.find((entry) => entry.id === assignment.taskId)?.name || "Recipe";
  if (assignment.kind === "construction") return BUILDINGS.find((entry) => entry.id === assignment.taskId)?.name || "Construction";
  if (assignment.kind === "processing") return `Process ${SPECIES_BY_ID[assignment.taskId]?.name || "pet"}`;
  return "Assignment";
}

function assignmentSkillId(assignment) {
  if (assignment.kind === "activity") return ACTIVITIES.find((entry) => entry.id === assignment.taskId)?.skill || "petMastery";
  if (assignment.kind === "recipe") return RECIPES.find((entry) => entry.id === assignment.taskId)?.skill || "crafting";
  if (assignment.kind === "construction") return "construction";
  if (assignment.kind === "processing") return "processing";
  return "petMastery";
}

function skillProgressMarkup(skillId, compact = false) {
  const skill = SKILLS.find((entry) => entry.id === skillId);
  const progress = gameState.skills?.[skillId] || { level: 1, xp: 0 };
  const level = Number(progress.level || 1);
  const needed = level >= 100 ? 0 : xpForNextLevel(level, "skill");
  const percent = needed ? Math.min(100, Number(progress.xp || 0) / needed * 100) : 100;
  const milestones = [1, 20, 40, 60, 80, 100];
  const related = ACTIVITIES.filter((entry) => entry.skill === skillId && entry.level > level).sort((a, b) => a.level - b.level)[0];
  return `<div class="skill-progress ${compact ? "compact" : ""}" data-skill-widget="${skillId}">
    <div class="skill-progress-head"><span>${escapeHtml(skill?.name || skillId)} level</span><strong data-skill-level>${level}${level < 100 ? ` → ${level + 1}` : " · MAX"}</strong></div>
    <div class="level-progress"><span data-skill-xp-meter style="width:${percent}%"></span></div>
    <div class="level-marker-row">${milestones.map((marker) => `<span class="${level >= marker ? "reached" : ""}">${marker}</span>`).join("")}</div>
    <div class="skill-progress-foot"><span data-skill-xp-text>${needed ? `${formatNumber(progress.xp)}/${formatNumber(needed)} XP` : "Maximum level"}</span>${related && !compact ? `<span>Next action: ${escapeHtml(related.name)} at ${related.level}</span>` : ""}</div>
  </div>`;
}

function liveAssignmentsBoard(title = "Live work queue") {
  const assignments = gameState.activities;
  return `<section class="live-work card card-pad">
    <div class="section-heading compact-heading"><div><p class="eyebrow">Timers running now</p><h2>${escapeHtml(title)}</h2></div><span class="live-count"><i></i>${assignments.length}/${MAX_ACTIVE_PETS} active</span></div>
    ${assignments.length ? `<div class="live-work-grid">${assignments.map((assignment) => {
      const pet = gameState.pets.find((entry) => entry.id === assignment.petId);
      const species = pet ? SPECIES_BY_ID[pet.speciesId] : SPECIES_BY_ID["ash-raccoon"];
      const timing = assignmentTiming(assignment);
      const skillId = assignmentSkillId(assignment);
      const skill = SKILLS.find((entry) => entry.id === skillId);
      const completed = Number(assignment.completedActions || 0);
      return `<article class="live-job" data-live-assignment="${assignment.id}">
        <img src="${escapeHtml(species.art || PLACEHOLDER_ART)}" alt="" loading="lazy" decoding="async" />
        <div class="live-job-main">
          <div class="live-job-title"><div><strong>${escapeHtml(assignmentLabel(assignment))}</strong><span>${escapeHtml(pet?.customName || species.name)} · ${escapeHtml(skill?.name || "Pet Mastery")} Lv ${skillLevel(gameState, skillId)}</span></div><b data-assignment-time>${escapeHtml(timing.label)}</b></div>
          <div class="job-progress"><span data-assignment-progress style="width:${timing.progress}%"></span><i style="left:25%"></i><i style="left:50%"></i><i style="left:75%"></i></div>
          <div class="live-job-foot"><span data-assignment-cycle>${assignment.kind === "activity" ? `${completed} actions completed` : "One-time assignment"}</span><button class="text-button" data-action="stop-assignment" data-id="${assignment.id}" type="button">Stop</button></div>
        </div>
      </article>`;
    }).join("")}</div>` : `<div class="empty-state compact-empty"><strong>No timers are running.</strong><span>Assign a pet and its countdown will appear here.</span></div>`}
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
  for (const assignment of gameState.activities) {
    const timing = assignmentTiming(assignment);
    document.querySelectorAll(`[data-live-assignment="${CSS.escape(assignment.id)}"]`).forEach((node) => {
      const meter = node.querySelector("[data-assignment-progress]");
      const time = node.querySelector("[data-assignment-time]");
      const cycle = node.querySelector("[data-assignment-cycle]");
      if (meter) meter.style.width = `${timing.progress}%`;
      if (time) time.textContent = timing.label;
      if (cycle && assignment.kind === "activity") cycle.textContent = `${Number(assignment.completedActions || 0)} actions completed`;
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
    if (levelText) levelText.textContent = level < 100 ? `${level} → ${level + 1}` : `${level} · MAX`;
    if (meter) meter.style.width = `${percent}%`;
    if (xpText) xpText.textContent = needed ? `${formatNumber(progress.xp)}/${formatNumber(needed)} XP` : "Maximum level";
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
    overview: renderOverview, activities: renderActivities, combat: renderCombat, den: renderDen,
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
  panel.innerHTML = `${panelHeading("Keeper dashboard", `Welcome back, ${gameState.profile.displayName}`, "Every activity runs through your pets. Six may work at once; dungeon parties operate separately.")}
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
      <article class="card card-pad"><div class="section-heading compact-heading"><div><p class="eyebrow">Skills</p><h2>Keeper progression</h2></div></div><div class="overview-skills">${SKILLS.map((skill) => skillProgressMarkup(skill.id, true)).join("")}</div></article>
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

function actionCard(action) {
  const playerLevel = skillLevel(gameState, action.skill);
  const unlocked = playerLevel >= action.level;
  const rewards = Object.entries(action.rewards || {}).map(([id, amount]) => `${amount} ${inventoryName(id)}`).join(" · ");
  return `<article class="action-card ${unlocked ? "" : "locked"}"><div><h3>${escapeHtml(action.name)}</h3><div class="action-meta"><span>${action.duration}s base action</span><span>${action.xp} XP</span><span>${escapeHtml(rewards)}</span>${action.coins ? `<span>${action.coins} coins</span>` : ""}</div>${unlocked ? `<p class="requirements">Assigned pet must be level ${action.petLevel || action.level}; aptitude controls the 25% burst yield.</p>` : `<p class="requirements">Requires ${SKILLS.find((entry) => entry.id === action.skill).name} ${action.level}</p>`}</div><button class="button ${unlocked ? "primary" : "ghost"}" data-action="open-start" data-kind="activity" data-id="${action.id}" ${unlocked ? "" : "disabled"} type="button">Assign pet</button></article>`;
}

function renderDen() {
  panel.innerHTML = `${panelHeading("Roster management", "Pet Den", "Every pet can fight. Their aptitudes determine how well they gather, process, cook, craft, build, and make Mischief.", `<span class="tag">${gameState.pets.length}/${denCapacity(gameState)} spaces</span>`)}
    ${gameState.pets.length ? `<div class="pet-grid">${gameState.pets.map((pet) => petCard(pet)).join("")}</div>` : `<div class="empty-state">Your den is empty.</div>`}`;
}

function renderKitchen() {
  panel.innerHTML = `${panelHeading("Meals and supplies", "Kitchen & Craft", "Meals fuel every active pet and power capture attempts. Better recipes provide more nutrition and stronger bonuses.")}
    ${liveAssignmentsBoard("Kitchen and workshop")}
    <div class="recipe-grid">${RECIPES.map((recipe) => {
      const unlocked = skillLevel(gameState, recipe.skill) >= recipe.level;
      return `<article class="recipe-card card ${unlocked ? "" : "locked"}"><p class="eyebrow">${recipe.skill}</p><h3>${escapeHtml(recipe.name)}</h3><p class="muted small-copy">${recipe.duration}s · ${recipe.xp} XP · Level ${recipe.level}</p><div class="cost-list">${Object.entries(recipe.ingredients).map(([id, amount]) => `<span class="tag">${amount} ${escapeHtml(inventoryName(id))}</span>`).join("")}</div><p class="small-copy">Produces ${Object.entries(recipe.output).map(([id, amount]) => `${amount} ${inventoryName(id)}`).join(", ")}. Aptitude can multiply the batch.</p><button class="button ${unlocked ? "primary" : "ghost"}" data-action="open-start" data-kind="recipe" data-id="${recipe.id}" ${unlocked ? "" : "disabled"} type="button">${unlocked ? "Assign pet" : `Locked at ${recipe.level}`}</button></article>`;
    }).join("")}</div>`;
}

function renderProcessing() {
  panel.innerHTML = `${panelHeading("Nothing drops automatically", "Processing", "Defeated wild pets enter this queue after a declined or failed capture. Assign a pet to recover meat and species-specific materials.", `<span class="tag">${gameState.remains.length} waiting</span>`)}
    ${liveAssignmentsBoard("Processing queue")}
    ${gameState.remains.length ? `<div class="recipe-grid">${gameState.remains.map((remain) => { const species = SPECIES_BY_ID[remain.speciesId]; return `<article class="recipe-card card"><p class="eyebrow">${escapeHtml(species.region)}</p><h3>${escapeHtml(species.name)}</h3><div class="cost-list">${Object.entries(species.materials).map(([id, amount]) => `<span class="tag">${amount} ${escapeHtml(inventoryName(id))}</span>`).join("")}</div><p class="muted small-copy">Aptitude determines the 25% burst yield. A Smokehouse adds another permanent output boost.</p><button class="button primary" data-action="open-start" data-kind="processing" data-id="${remain.id}" type="button">Assign processor</button></article>`; }).join("")}</div>` : `<div class="empty-state"><strong>No remains are waiting.</strong><p>Defeat a wild pet in Combat, then decline or fail its capture attempt.</p></div>`}`;
}

function renderConstruction() {
  panel.innerHTML = `${panelHeading("Permanent account growth", "Construction", "Expand hard capacities and build one-time facilities that provide small permanent bonuses.")}
    ${liveAssignmentsBoard("Construction projects")}
    <div class="building-grid">${BUILDINGS.map((building) => {
      const level = Number(gameState.buildings[building.id] || 0);
      const maxed = level >= building.maxLevel;
      const costs = buildingCosts(gameState, building.id);
      return `<article class="building-card card ${maxed ? "locked" : ""}"><p class="eyebrow">${building.repeatable ? `Level ${level}/${building.maxLevel}` : maxed ? "Completed" : "One-time structure"}</p><h3>${escapeHtml(building.name)}</h3><p class="muted small-copy">${escapeHtml(building.description)}</p><div class="cost-list">${Object.entries(costs).map(([id, amount]) => `<span class="tag">${amount} ${escapeHtml(inventoryName(id))}</span>`).join("") || `<span class="tag">Built</span>`}</div><button class="button ${maxed ? "ghost" : "primary"}" data-action="open-start" data-kind="construction" data-id="${building.id}" ${maxed ? "disabled" : ""} type="button">${maxed ? "Complete" : "Assign builder"}</button></article>`;
    }).join("")}</div>`;
}

function renderCombat() {
  const opponents = listAvailableOpponents(gameState);
  const meals = ownedMeals();
  const pending = !activeBattle && gameState.pendingEncounter ? SPECIES_BY_ID[gameState.pendingEncounter.speciesId] : null;
  panel.innerHTML = `${panelHeading("Live auto-combat", "Combat", "Watch each independent attack timer fill. When a timer completes, damage lands, health changes, and a hit splat records the result.")}
    ${pending ? encounterCard(pending) : ""}
    <section id="combat-stage" class="combat-stage ${activeBattle ? "battle-live" : "battle-idle"}">${activeBattle ? combatStageMarkup(activeBattle) : `<div class="combat-header"><span class="battle-state ready">Combat ready</span><span>Independent attack meters</span></div><div class="idle-arena"><div>${petVisual(SPECIES_BY_ID["ash-raccoon"], "arena-pet")}</div><span>VS</span><div class="wild-silhouette">?</div></div><div class="battle-message">Choose a party and wild opponent</div>`}</section>
    ${!activeBattle && !pending ? `<div class="combat-setup">
      <article class="selection-card card"><p class="eyebrow">Party</p><h3>Choose up to three idle pets</h3><div class="check-list" id="combat-pet-list">${gameState.pets.filter((pet) => pet.status === "idle" && !petIsInLiveBattle(pet.id)).map((pet) => { const species = SPECIES_BY_ID[pet.speciesId]; return `<label class="check-option"><input type="checkbox" name="combat-pet" value="${pet.id}" ${selectedCombatPets.has(pet.id) ? "checked" : ""}/><span>${escapeHtml(pet.customName || species.name)}<small> Level ${pet.level} · ${species.affinity}</small></span><strong>${formatNumber(scaledPetStats(pet).power)}</strong></label>`; }).join("") || `<div class="empty-state">No idle pets are available.</div>`}</div></article>
      <article class="selection-card card"><p class="eyebrow">Hunt</p><h3>Choose a wild pet</h3><div class="combat-controls"><label class="field">Opponent<select id="combat-opponent">${opponents.map((species) => `<option value="${species.id}">${escapeHtml(species.name)} · ${species.affinity} · ${Math.round(species.captureRate * 10000) / 100}% base capture</option>`).join("")}</select></label><label class="field">Healing meal<select id="combat-meal">${meals.map(([id, quantity]) => `<option value="${id}">${escapeHtml(inventoryName(id))} (${quantity})</option>`).join("")}</select></label></div><div class="notice" style="margin-top:.8rem"><strong>No automatic drops.</strong> Victory creates one capture or Processing decision.</div><button class="button primary wide" style="margin-top:.8rem" data-action="start-combat" ${!opponents.length || !meals.length ? "disabled" : ""} type="button">Begin live combat</button></article>
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
    const hp = Number(playback.hp[entry.id] ?? entry.maxHp);
    const defeated = hp <= 0;
    return `<div class="fighter ${enemy ? "enemy" : ""} ${defeated ? "defeated" : ""}" id="fighter-${entry.id}" data-fighter-id="${entry.id}">
      <div class="fighter-card-head"><span>${enemy ? "Wild opponent" : "Party pet"}</span><b>${escapeHtml(species.affinity)}</b></div>
      <div class="fighter-portrait"><img src="${escapeHtml(species.art || PLACEHOLDER_ART)}" alt="${escapeHtml(entry.name)}" decoding="async" /></div>
      <div class="fighter-name"><strong>${escapeHtml(entry.name)}</strong><span>Lv ${entry.level || 1} · ${escapeHtml(entry.ability || species.ability?.name || "Ability")}</span></div>
      <div class="bar-label"><span>Health</span><b data-hp-text="${entry.id}">${formatNumber(hp)} / ${formatNumber(entry.maxHp)}</b></div>
      <div class="health-bar"><span id="hp-${entry.id}" style="width:${Math.max(0, hp / entry.maxHp * 100)}%"></span></div>
      <div class="bar-label attack-label"><span>Next attack</span><b data-attack-time="${entry.id}">—</b></div>
      <div class="attack-bar"><span data-attack-meter="${entry.id}"></span></div>
    </div>`;
  };
  return `<div class="combat-header"><span class="battle-state live"><i></i> Battle in progress</span><span data-battle-time>0:00 / ${formatCombatClock(playback.totalDuration)}</span></div>
    <div class="combatants"><div class="team-side">${battle.team.map((entry) => fighter(entry)).join("")}</div><div class="versus-mark">VS</div><div class="enemy-side">${fighter(battle.enemy, true)}</div></div>
    <div class="battle-feed"><div><span>Battle log</span><b>${battle.team.length} vs 1</b></div><ol id="battle-log">${playback.logs.slice(0, 5).map((entry) => `<li class="${entry.type}">${escapeHtml(entry.text)}</li>`).join("") || `<li class="muted-log">Attack timers are charging…</li>`}</ol></div>`;
}

function clearBattleTimers() {
  battleTimers.forEach(clearTimeout);
  battleTimers = [];
  activeBattle = null;
}

function playbackDuration(battle) {
  return Math.min(COMBAT_MAX_PLAYBACK_MS, Math.max(COMBAT_MIN_PLAYBACK_MS, Number(battle.duration || 1)));
}

function beginBattle(battle) {
  clearBattleTimers();
  const totalDuration = playbackDuration(battle);
  const scale = totalDuration / Math.max(1, Number(battle.duration || 1));
  const fighters = [...battle.team, battle.enemy];
  activeBattle = {
    battle,
    scale,
    totalDuration,
    startedAt: Date.now() + 900,
    hp: Object.fromEntries(fighters.map((entry) => [entry.id, entry.maxHp])),
    lastAttackAt: Object.fromEntries(fighters.map((entry) => [entry.id, 0])),
    logs: [],
    ending: false,
  };
  currentPanel = "combat";
  renderCombat();
  panel.scrollTop = 0;
  for (const event of battle.events) {
    const timer = setTimeout(() => applyBattleEvent(event), Math.max(0, 900 + event.time * scale));
    battleTimers.push(timer);
  }
}

function applyBattleEvent(event) {
  if (!activeBattle) return;
  if (event.type === "hit") {
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
    activeBattle.hp[event.targetId] = event.targetHp;
    addBattleLog(`${battleFighterName(event.targetId)} ate ${inventoryName(event.mealId)} and healed ${event.amount}.`, "heal");
    const target = $(`#fighter-${CSS.escape(event.targetId)}`);
    const hp = $(`#hp-${CSS.escape(event.targetId)}`);
    if (hp) hp.style.width = `${Math.max(0, event.targetHp / event.targetMaxHp * 100)}%`;
    const hpText = document.querySelector(`[data-hp-text="${CSS.escape(event.targetId)}"]`);
    if (hpText) hpText.textContent = `${formatNumber(event.targetHp)} / ${formatNumber(event.targetMaxHp)}`;
    floatNumber(target, `+${event.amount}`, "heal", "MEAL");
  } else if (event.type === "start") {
    addBattleLog("The hunt began. Attack timers are charging.", "start");
  } else if (event.type === "end") {
    if (activeBattle.ending) return;
    activeBattle.ending = true;
    addBattleLog(event.victory ? "Victory! A capture decision is ready." : "The party withdrew safely.", event.victory ? "victory" : "retreat");
    showBattleMessage(event.victory ? "Victory — capture decision ready" : "Party withdrew safely");
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
  battleTimers.forEach(clearTimeout);
  battleTimers = [];
  activeBattle = null;
  if (currentPanel === "combat") renderCombat();
  toast(victory ? "Battle won." : "Party withdrew.", "info", victory ? "Choose a capture meal or send the pet to Processing." : "No pets were lost.");
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
      return `<article class="market-card card">${petVisual(species)}<p class="eyebrow" style="margin-top:.8rem">${escapeHtml(species.acquisition)} · ${listing.pet?.stars || 1}★</p><h3>${escapeHtml(species.name)}</h3><p class="muted small-copy">Level ${listing.pet?.level || 1} · Seller ${escapeHtml(listing.sellerName || "Keeper")}</p><div class="chance-display"><span>Price</span><strong>${formatNumber(listing.price)} coins</strong></div>${own ? `<button class="button secondary wide" data-action="cancel-listing" data-id="${listing.id}" type="button">Cancel listing</button>` : `<button class="button primary wide" data-action="buy-listing" data-id="${listing.id}" type="button">Buy pet</button>`}</article>`;
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
  const minimumLevel = kind === "processing" || kind === "construction" ? 1 : Number(task.petLevel || task.level || 1);
  const idle = gameState.pets.filter((pet) => pet.status === "idle" && !petIsInLiveBattle(pet.id) && pet.level >= minimumLevel && Number(SPECIES_BY_ID[pet.speciesId]?.aptitudes?.[skill] || 0) > 0);
  const meals = ownedMeals();
  const mealRequired = !(kind === "recipe" && task.skill === "cooking");
  modalContent.innerHTML = `<p class="eyebrow">Assign ${escapeHtml(skill)} pet</p><h2>${escapeHtml(kind === "processing" ? SPECIES_BY_ID[task.speciesId].name : task.name)}</h2><p class="muted">The selected pet occupies one of six active slots. Its ${escapeHtml(skill)} aptitude determines bonus output.</p>
    <label class="field">Pet<select id="modal-pet-select">${idle.map((pet) => { const species = SPECIES_BY_ID[pet.speciesId]; return `<option value="${pet.id}">${escapeHtml(species.name)} · Aptitude ${species.aptitudes[skill] || 1} · Level ${pet.level}</option>`; }).join("")}</select></label>
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

function openPetDetails(petId, manage = false) {
  const pet = gameState.pets.find((entry) => entry.id === petId);
  if (!pet) return;
  if (manage && petIsInLiveBattle(petId)) {
    manage = false;
    toast("That pet is currently fighting.", "info", "Management actions unlock when the battle ends.");
  }
  const species = SPECIES_BY_ID[pet.speciesId];
  const stats = scaledPetStats(pet);
  modalContent.innerHTML = `<div class="modal-pet">${petVisual(species)}<div><p class="eyebrow">${species.acquisition} · ${species.affinity}</p><h2>${escapeHtml(pet.customName || species.name)}</h2><p class="star-row">${"★".repeat(pet.stars)}${"☆".repeat(5 - pet.stars)} · Level ${pet.level}/${levelCapForStars(pet.stars)}</p><p class="muted small-copy">${escapeHtml(species.ability.name)} — ${Math.round(species.ability.power * 100)}% ability power. ${escapeHtml(species.passive.name)}: ${escapeHtml(species.passive.description)}</p><div class="inventory-grid"><div class="inventory-item"><span>Health</span><strong>${stats.hp}</strong></div><div class="inventory-item"><span>Attack</span><strong>${stats.attack}</strong></div><div class="inventory-item"><span>Defence</span><strong>${stats.defense}</strong></div><div class="inventory-item"><span>Speed</span><strong>${stats.speed}</strong></div></div></div></div>
    <div class="split-line"></div><p class="eyebrow">Aptitudes</p><div class="cost-list">${Object.entries(species.aptitudes).sort((a,b) => b[1]-a[1]).map(([skill, rating]) => `<span class="tag">${escapeHtml(skill)} ${rating}</span>`).join("")}</div>
    ${manage ? `<div class="split-line"></div><div class="grid two"><div><h3>Sacrifice for XP</h3><p class="muted small-copy">Choose an idle recipient. Low-level common pets become extremely inefficient for high-level recipients.</p><select id="sacrifice-recipient" class="inline-select">${gameState.pets.filter((entry) => entry.id !== pet.id && entry.status === "idle" && !petIsInLiveBattle(entry.id)).map((entry) => `<option value="${entry.id}">${escapeHtml(SPECIES_BY_ID[entry.speciesId].name)} · Level ${entry.level}</option>`).join("")}</select><button class="button danger wide" style="margin-top:.5rem" data-modal-action="sacrifice" type="button">Sacrifice this pet</button></div><div><h3>Condense</h3><p class="muted small-copy">Both identical pets must share a star rank and be at that rank's maximum level.</p><select id="condense-duplicate" class="inline-select">${gameState.pets.filter((entry) => entry.id !== pet.id && entry.speciesId === pet.speciesId && entry.stars === pet.stars && entry.status === "idle" && !petIsInLiveBattle(entry.id)).map((entry) => `<option value="${entry.id}">${escapeHtml(species.name)} · Level ${entry.level}</option>`).join("")}</select><button class="button secondary wide" style="margin-top:.5rem" data-modal-action="condense" type="button">Condense pair</button></div></div><div class="split-line"></div><h3>Marketplace listing</h3><div class="combat-controls"><label class="field">Price in coins<input id="listing-price" type="number" min="10" value="100" /></label><button class="button secondary" data-modal-action="list" type="button">List pet</button></div>` : ""}`;
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
  const idle = gameState.pets.filter((pet) => pet.status === "idle" && !petIsInLiveBattle(pet.id));
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
      if (result.state) setState(result.state, action !== "resolveCombat");
      if (result.capture) toast(result.capture.success ? "Capture successful." : "Capture failed; remains added to Processing.");
      if (result.result?.success !== undefined) toast(result.result.success ? "Dungeon cleared." : "Dungeon returned with partial rewards.");
      return result;
    }
    let result;
    if (action === "startActivity") result = { state: startActivity(gameState, payload) };
    else if (action === "startRecipe") result = { state: startRecipe(gameState, payload) };
    else if (action === "startConstruction") result = { state: startConstruction(gameState, payload) };
    else if (action === "startProcessing") result = { state: startProcessing(gameState, payload) };
    else if (action === "stopActivity") result = { state: stopActivity(gameState, payload.activityId) };
    else if (action === "resolveCombat") result = resolveCombat(gameState, payload);
    else if (action === "attemptCapture") result = attemptCapture(gameState, payload.mealId);
    else if (action === "declineCapture") result = { state: declineCapture(gameState) };
    else if (action === "sacrificePet") result = sacrificePet(gameState, payload);
    else if (action === "condensePets") result = { state: condensePets(gameState, payload) };
    else if (action === "startDungeon") result = { state: startDungeon(gameState, payload) };
    else if (action === "claimDungeon") result = claimDungeon(gameState, payload.runId);
    else throw new GameError("Unknown action.");
    if (result.state) setState(result.state, action !== "resolveCombat");
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

async function startCombatAction() {
  if (activeBattle || combatRequestInProgress) return;
  const petIds = [...selectedCombatPets];
  const speciesId = $("#combat-opponent")?.value;
  const mealId = $("#combat-meal")?.value;
  const button = $("[data-action='start-combat']");
  combatRequestInProgress = true;
  if (button) { button.disabled = true; button.textContent = "Preparing battle…"; }
  try {
    const result = await runAction("resolveCombat", { petIds, speciesId, mealId });
    if (result?.battle) beginBattle(result.battle);
  } finally {
    combatRequestInProgress = false;
    if (button?.isConnected) { button.disabled = false; button.textContent = "Begin live combat"; }
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
  const panelJump = event.target.closest("[data-panel-jump]");
  if (panelJump) { currentPanel = panelJump.dataset.panelJump; queueRender(); return; }
  const nav = event.target.closest("[data-panel]");
  if (nav) { currentPanel = nav.dataset.panel; $("#sidebar").classList.remove("open"); queueRender(); return; }
  const skillButton = event.target.closest("[data-skill]");
  if (skillButton) { currentSkill = skillButton.dataset.skill; queueRender(); return; }
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const name = action.dataset.action;
  if (name === "open-start") openStartModal(action.dataset.kind, action.dataset.id);
  else if (name === "pet-details") openPetDetails(action.dataset.petId, false);
  else if (name === "pet-manage") openPetDetails(action.dataset.petId, true);
  else if (name === "stop-assignment") await runAction("stopActivity", { activityId: action.dataset.id });
  else if (name === "start-combat") await startCombatAction();
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
});

$("#modal-close").addEventListener("click", () => modal.close());
modal.addEventListener("click", (event) => { if (event.target === modal) modal.close(); });
$("#mobile-menu").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
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
setAuthMode("signin");
initializeFirebase();
if (previewEnabled) enterLocalPreview();
