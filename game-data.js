export const GAME_NAME = "Wilderden";
export const GAME_VERSION = "1.0.0";
export const MAX_ACTIVE_PETS = 6;
export const MAX_COMBAT_PETS = 3;
export const OFFLINE_CAP_MS = 24 * 60 * 60 * 1000;
export const MAX_IDLE_HOURS = 24;
export const ACTION_TIME_SCALE = 1;

export const AFFINITIES = [
  "Ember",
  "Verdant",
  "Tide",
  "Stone",
  "Spark",
  "Gale",
  "Radiant",
  "Umbral",
  "Frost",
];

export const AFFINITY_ADVANTAGE = {
  Ember: "Verdant",
  Verdant: "Tide",
  Tide: "Ember",
  Stone: "Spark",
  Spark: "Gale",
  Gale: "Stone",
  Radiant: "Umbral",
  Umbral: "Frost",
  Frost: "Radiant",
};

export const REGIONS = [
  { id: "greenhollow", name: "Greenhollow", level: 1, skillBand: "1–20" },
  { id: "copperwood", name: "Copperwood", level: 21, skillBand: "21–40" },
  { id: "sunscar", name: "Sunscar Basin", level: 41, skillBand: "41–60" },
  { id: "stormreach", name: "Stormreach", level: 61, skillBand: "61–80" },
  { id: "starfall", name: "Starfall Expanse", level: 81, skillBand: "81–100" },
];

export const SKILLS = [
  { id: "woodcutting", name: "Woodcutting", description: "Harvest timber and unusual wood." },
  { id: "mining", name: "Mining", description: "Extract ore, stone, and gems." },
  { id: "foraging", name: "Foraging", description: "Gather plants, fruit, fiber, and ingredients." },
  { id: "fishing", name: "Fishing", description: "Catch food and aquatic materials." },
  { id: "processing", name: "Processing", description: "Turn defeated wild pets into useful materials." },
  { id: "cooking", name: "Cooking", description: "Create combat-healing meals and post-battle capture offerings." },
  { id: "crafting", name: "Crafting", description: "Create expedition supplies and useful equipment." },
  { id: "mischief", name: "Mischief", description: "Pilfer ingredients, coins, maps, and rare components." },
  { id: "construction", name: "Construction", description: "Expand the den, storage, and permanent facilities." },
  { id: "combat", name: "Combat", description: "Defeat wild pets, bosses, and dungeon threats." },
  { id: "melee", name: "Melee", description: "Keeper accuracy and damage with close-range weapons." },
  { id: "ranged", name: "Ranged", description: "Keeper accuracy and damage with bows and thrown weapons." },
  { id: "magic", name: "Magic", description: "Keeper accuracy and damage with spell focuses." },
  { id: "petMastery", name: "Pet Mastery", description: "General experience earned by managing working pets." },
];

const pet = (id, name, region, affinity, acquisition, aptitudes, stats, ability, passive, captureRate, materials, art = `pets/${id}.png`) => ({
  id,
  name,
  region,
  affinity,
  acquisition,
  aptitudes: Object.fromEntries(Object.entries(aptitudes).map(([skill, rating]) => [skill, Math.min(10, Number(rating) * 2)])),
  stats: { hp: stats[0], attack: stats[1], defense: stats[2], speed: stats[3] },
  ability: { name: ability[0], power: ability[1], cooldown: ability[2], kind: ability[3] || "damage" },
  passive: { name: passive[0], description: passive[1] },
  captureRate,
  materials,
  art,
});

export const PET_SPECIES = [
  pet("ash-raccoon", "Ash Raccoon", "greenhollow", "Umbral", "Common", { mischief: 2, foraging: 1, processing: 1 }, [92, 15, 11, 16], ["Pocket Sand", 1.35, 4], ["Light Fingers", "+8% Mischief rewards."], 0.12, { "raw-meat": 2, hide: 1, "dark-fur": 1 }, "pets/ash-raccoon.png"),
  pet("moss-hare", "Moss Hare", "greenhollow", "Verdant", "Common", { foraging: 4, cooking: 2, woodcutting: 1 }, [80, 12, 10, 20], ["Briar Kick", 1.4, 4], ["Surefooted", "+5% dodge chance."], 0.12, { "raw-meat": 2, hide: 1, "wild-fiber": 1 }),
  pet("brook-otter", "Brook Otter", "greenhollow", "Tide", "Common", { fishing: 4, cooking: 2, crafting: 1 }, [88, 14, 11, 18], ["River Rest", 0.42, 4, "heal-self"], ["Slick Coat", "+8% resistance to Ember attacks."], 0.11, { "raw-meat": 2, hide: 1, "river-oil": 1 }),
  pet("stoneback-boar", "Stoneback Boar", "greenhollow", "Stone", "Common", { mining: 3, construction: 3, processing: 2 }, [118, 15, 17, 10], ["Driving Tusk", 1.5, 5], ["Thick Hide", "+8% maximum health."], 0.1, { "raw-meat": 3, hide: 2, bone: 1 }),
  pet("breeze-finch", "Breeze Finch", "greenhollow", "Gale", "Common", { foraging: 3, mischief: 3, crafting: 1 }, [72, 13, 8, 23], ["Needle Gust", 1.3, 3], ["Tailwind", "+5% team attack speed."], 0.11, { "raw-meat": 1, feather: 2 }),
  pet("ember-mole", "Ember Mole", "greenhollow", "Ember", "Uncommon", { mining: 4, processing: 3, construction: 2 }, [102, 17, 15, 11], ["Coal Claw", 1.55, 5], ["Warm Burrow", "+10% Mining yield chance."], 0.07, { "raw-meat": 2, hide: 1, "ember-gland": 1 }),
  pet("dawn-koi", "Dawn Koi", "greenhollow", "Radiant", "Uncommon", { fishing: 5, cooking: 2 }, [84, 16, 10, 19], ["Sunlit Current", 0.34, 4, "heal-team"], ["Bright Current", "+8% healing received."], 0.06, { "raw-fish": 3, scale: 2, "sun-oil": 1 }),
  pet("bramble-hedgehog", "Bramble Hedgehog", "greenhollow", "Verdant", "Uncommon", { woodcutting: 4, foraging: 3, processing: 1 }, [106, 14, 18, 9], ["Thorn Roll", 1.45, 4], ["Brambleguard", "Returns a small amount of contact damage."], 0.06, { "raw-meat": 1, hide: 1, thorn: 2 }),
  pet("static-fox", "Static Fox", "greenhollow", "Spark", "Rare", { mischief: 5, crafting: 3, foraging: 2 }, [86, 20, 10, 24], ["Snapflash", 1.65, 4], ["Quick Start", "Begins combat with 35% attack charge."], 0.025, { "raw-meat": 2, hide: 1, "spark-core": 1 }),
  pet("frosthorn-stag", "Frosthorn Stag", "greenhollow", "Frost", "Area Boss", { woodcutting: 5, foraging: 3, construction: 2 }, [144, 22, 18, 15], ["Winter Crown", 1.85, 5], ["Cold Resolve", "+10% defence below half health."], 0.008, { "raw-meat": 4, hide: 3, antler: 2, "frost-core": 1 }),

  pet("cedar-beaver", "Cedar Beaver", "copperwood", "Verdant", "Common", { woodcutting: 5, construction: 4, crafting: 2 }, [112, 21, 21, 13], ["Timber Slam", 1.55, 5], ["Measured Cuts", "+8% Construction progress."], 0.1, { "raw-meat": 2, hide: 2, "resin-tooth": 1 }),
  pet("coal-badger", "Coal Badger", "copperwood", "Stone", "Common", { mining: 5, processing: 3, construction: 2 }, [126, 23, 24, 11], ["Fault Breaker", 1.65, 5], ["Low Center", "+8% defence against critical hits."], 0.1, { "raw-meat": 3, hide: 2, claw: 1 }),
  pet("redtail-kite", "Redtail Kite", "copperwood", "Gale", "Common", { mischief: 4, foraging: 3, fishing: 1 }, [89, 22, 13, 27], ["Raking Dive", 1.6, 4], ["High Watch", "+6% critical chance."], 0.1, { "raw-meat": 1, feather: 3, talon: 1 }),
  pet("river-crocodile", "River Crocodile", "copperwood", "Tide", "Common", { fishing: 4, processing: 4, cooking: 1 }, [158, 27, 25, 8], ["Undertow Bite", 1.75, 5], ["Ambush", "First attack deals 25% more damage."], 0.09, { "raw-meat": 4, hide: 3, tooth: 1 }),
  pet("glow-salamander", "Glow Salamander", "copperwood", "Ember", "Uncommon", { cooking: 5, foraging: 3, crafting: 2 }, [102, 25, 14, 22], ["Glowspit", 1.6, 4], ["Banked Heat", "+10% Cooking bonus-output chance."], 0.055, { "raw-meat": 1, hide: 1, "ember-gland": 2 }),
  pet("moon-ferret", "Moon Ferret", "copperwood", "Umbral", "Uncommon", { mischief: 5, crafting: 3, foraging: 2 }, [96, 25, 14, 25], ["Night Thread", 1.55, 3], ["Escape Artist", "+7% dodge chance."], 0.05, { "raw-meat": 2, hide: 2, "dark-fur": 2 }),
  pet("quartz-ram", "Quartz Ram", "copperwood", "Stone", "Uncommon", { mining: 5, construction: 3, processing: 2 }, [150, 28, 28, 12], ["Crystal Charge", 1.75, 5], ["Quartz Plate", "+10% Stone damage resistance."], 0.045, { "raw-meat": 3, hide: 2, horn: 2, quartz: 1 }),
  pet("sun-rooster", "Sun Rooster", "copperwood", "Radiant", "Uncommon", { cooking: 4, foraging: 4, mischief: 1 }, [100, 26, 15, 24], ["Daybreak Cry", 1.55, 4], ["Early Riser", "+5% team attack power."], 0.05, { "raw-meat": 2, feather: 3, "sun-oil": 1 }),
  pet("snow-owl", "Snow Owl", "copperwood", "Frost", "Rare", { mischief: 5, fishing: 3, crafting: 2 }, [98, 30, 15, 29], ["Silent White", 1.8, 4], ["Patient Hunter", "+10% accuracy."], 0.02, { "raw-meat": 2, feather: 3, "frost-core": 1 }),
  pet("storm-lynx", "Storm Lynx", "copperwood", "Spark", "Area Boss", { mischief: 4, processing: 3, foraging: 2 }, [166, 35, 25, 31], ["Storm Pounce", 1.95, 4], ["Charged Fur", "Every fourth hit gains bonus Spark damage."], 0.007, { "raw-meat": 4, hide: 3, "spark-core": 2 }),

  pet("dune-fennec", "Dune Fennec", "sunscar", "Gale", "Common", { mischief: 5, foraging: 4, crafting: 2 }, [116, 33, 18, 34], ["Sandstep", 1.7, 3], ["Heatwise", "+10% resistance to Ember damage."], 0.085, { "raw-meat": 2, hide: 2, "sand-silk": 1 }),
  pet("iron-tortoise", "Iron Tortoise", "sunscar", "Stone", "Common", { construction: 5, mining: 4, processing: 3 }, [210, 29, 42, 7], ["Iron Turn", 1.8, 6], ["Fortress Shell", "+15% maximum defence."], 0.08, { "raw-meat": 3, shell: 3, "iron-plate": 1 }),
  pet("cinder-hyena", "Cinder Hyena", "sunscar", "Ember", "Common", { processing: 5, cooking: 3, mischief: 2 }, [142, 38, 24, 27], ["Cinder Laugh", 1.8, 4], ["Pack Pressure", "+4% attack for each ally."], 0.08, { "raw-meat": 4, hide: 2, "ember-gland": 2 }),
  pet("oasis-crane", "Oasis Crane", "sunscar", "Tide", "Common", { foraging: 5, fishing: 4, cooking: 2 }, [119, 31, 19, 35], ["Clearwater Grace", 0.4, 4, "heal-team"], ["Clear Water", "+10% meal healing."], 0.08, { "raw-meat": 2, feather: 3, "river-oil": 2 }),
  pet("glass-scorpion", "Glass Scorpion", "sunscar", "Radiant", "Uncommon", { mischief: 5, mining: 3, processing: 3 }, [132, 41, 25, 30], ["Prism Sting", 1.9, 4], ["Refraction", "+8% dodge chance after being hit."], 0.04, { "raw-meat": 1, carapace: 3, "sun-oil": 2 }),
  pet("thunder-beetle", "Thunder Beetle", "sunscar", "Spark", "Uncommon", { mining: 5, construction: 3, crafting: 2 }, [156, 37, 33, 23], ["Rolling Thunder", 1.85, 5], ["Static Shell", "Attackers may lose attack charge."], 0.04, { "raw-meat": 1, carapace: 3, "spark-core": 2 }),
  pet("shade-vulture", "Shade Vulture", "sunscar", "Umbral", "Uncommon", { processing: 5, mischief: 4, foraging: 1 }, [126, 42, 21, 32], ["Carrion Moon", 1.9, 4], ["Opportunist", "+15% damage to targets below half health."], 0.035, { "raw-meat": 2, feather: 3, "dark-fur": 1 }),
  pet("frostscale-pangolin", "Frostscale Pangolin", "sunscar", "Frost", "Uncommon", { mining: 4, processing: 4, construction: 3 }, [174, 35, 38, 19], ["Icewheel", 1.85, 5], ["Layered Scales", "+10% physical resistance."], 0.035, { "raw-meat": 3, scale: 3, "frost-core": 2 }),
  pet("root-elephant", "Root Elephant", "sunscar", "Verdant", "Rare", { construction: 5, woodcutting: 5, foraging: 3 }, [235, 43, 41, 10], ["Oldwood Tusk", 2.0, 6], ["Ancient Strength", "+12% Construction progress."], 0.016, { "raw-meat": 5, hide: 4, tusk: 2, "heartwood-core": 1 }),
  pet("mirage-manticore", "Mirage Manticore", "sunscar", "Radiant", "Area Boss", { mischief: 4, processing: 4, crafting: 3 }, [224, 51, 35, 34], ["Mirage Volley", 2.1, 5], ["False Image", "The first incoming hit always misses."], 0.005, { "raw-meat": 5, hide: 3, "sun-oil": 3, "mirage-eye": 1 }),

  pet("tempest-hawk", "Tempest Hawk", "stormreach", "Gale", "Common", { mischief: 5, foraging: 3, fishing: 2 }, [142, 48, 23, 43], ["Tempest Dive", 1.9, 3], ["Jetstream", "+8% team speed."], 0.065, { "raw-meat": 2, feather: 4, talon: 2 }),
  pet("volt-jackal", "Volt Jackal", "stormreach", "Spark", "Common", { mischief: 5, processing: 3, foraging: 2 }, [166, 52, 26, 39], ["Forked Bolt", 2.0, 4], ["Live Wire", "+8% critical chance."], 0.065, { "raw-meat": 3, hide: 3, "spark-core": 2 }),
  pet("glacier-bear", "Glacier Bear", "stormreach", "Frost", "Common", { fishing: 5, processing: 4, construction: 2 }, [278, 51, 45, 15], ["Glacier Paw", 2.1, 6], ["Deep Winter", "+12% maximum health."], 0.06, { "raw-meat": 6, hide: 4, "frost-core": 2 }),
  pet("obsidian-gorilla", "Obsidian Gorilla", "stormreach", "Stone", "Common", { construction: 5, mining: 5, crafting: 2 }, [250, 57, 48, 18], ["Blackstone Fist", 2.1, 5], ["Unmoving", "Cannot have attack charge reduced."], 0.06, { "raw-meat": 5, hide: 4, "obsidian-knuckle": 1 }),
  pet("embermane-lion", "Embermane Lion", "stormreach", "Ember", "Uncommon", { cooking: 4, processing: 4, mischief: 2 }, [224, 65, 34, 32], ["Crownfire", 2.2, 5], ["Pride", "+7% team attack power."], 0.03, { "raw-meat": 5, hide: 4, "ember-gland": 3 }),
  pet("deepwave-orca", "Deepwave Orca", "stormreach", "Tide", "Uncommon", { fishing: 5, processing: 4, foraging: 1 }, [268, 61, 42, 26], ["Breaker", 2.15, 5], ["Deep Breath", "+15% maximum health in dungeons."], 0.028, { "raw-fish": 7, hide: 3, "river-oil": 4 }),
  pet("night-panther", "Night Panther", "stormreach", "Umbral", "Uncommon", { mischief: 5, processing: 3, crafting: 2 }, [185, 66, 28, 45], ["Lights Out", 2.2, 4], ["Stalker", "+18% first-hit damage."], 0.026, { "raw-meat": 4, hide: 4, "dark-fur": 3 }),
  pet("sunscale-drake", "Sunscale Drake", "stormreach", "Radiant", "Uncommon", { crafting: 5, mining: 3, cooking: 2 }, [213, 64, 38, 35], ["Solar Arc", 2.15, 4], ["Bright Scale", "+10% resistance to Umbral damage."], 0.025, { "raw-meat": 4, scale: 4, "sun-oil": 3 }),
  pet("canopy-ape", "Canopy Ape", "stormreach", "Verdant", "Rare", { woodcutting: 5, foraging: 5, construction: 3 }, [236, 63, 41, 30], ["Canopy Crash", 2.25, 5], ["Green Reach", "+10% Woodcutting bonus-output chance."], 0.011, { "raw-meat": 5, hide: 3, "heartwood-core": 2 }),
  pet("stormhorn-elk", "Stormhorn Elk", "stormreach", "Spark", "Area Boss", { construction: 5, foraging: 4, mischief: 3 }, [302, 74, 52, 36], ["Skybreaker", 2.4, 5], ["Storm Field", "All allies begin with 20% attack charge."], 0.0035, { "raw-meat": 6, hide: 4, antler: 3, "spark-core": 4 }),

  pet("crown-phoenix", "Crown Phoenix", "starfall", "Ember", "Rare", { cooking: 5, foraging: 4, crafting: 3 }, [244, 82, 38, 49], ["Crownflare", 2.35, 4], ["Rekindle", "Once per combat, survive a fatal hit at 15% health."], 0.009, { feather: 5, "ember-gland": 5, "crown-ash": 1 }),
  pet("worldroot-elk", "Worldroot Elk", "starfall", "Verdant", "Rare", { woodcutting: 5, foraging: 5, construction: 4 }, [318, 75, 56, 35], ["Living Grove", 0.48, 5, "heal-team"], ["Deep Roots", "+8% team health and defence."], 0.009, { "raw-meat": 6, hide: 4, antler: 4, "heartwood-core": 3 }),
  pet("abyssal-leviathan", "Abyssal Leviathan", "starfall", "Tide", "Rare", { fishing: 5, processing: 5, cooking: 3 }, [358, 83, 58, 29], ["Abyssal Wake", 2.5, 6], ["Pressureborn", "+15% damage against bosses."], 0.008, { "raw-fish": 9, scale: 5, "river-oil": 5, "abyss-pearl": 1 }),
  pet("titan-mole", "Titan Mole", "starfall", "Stone", "Rare", { mining: 5, construction: 5, processing: 4 }, [344, 79, 66, 20], ["Worldsplitter", 2.45, 6], ["Bedrock", "+15% maximum defence."], 0.008, { "raw-meat": 6, hide: 4, "obsidian-knuckle": 3, "titan-ore": 1 }),
  pet("sky-serpent", "Sky Serpent", "starfall", "Gale", "Rare", { mischief: 5, foraging: 4, crafting: 3 }, [260, 86, 40, 57], ["Heavens Coil", 2.4, 4], ["Open Sky", "+12% attack speed."], 0.007, { "raw-meat": 4, scale: 5, "storm-silk": 2 }),
  pet("aurora-wolf", "Aurora Wolf", "starfall", "Frost", "Rare", { mischief: 5, fishing: 4, processing: 3 }, [278, 88, 43, 53], ["Aurora Fang", 2.45, 4], ["Cold Pack", "+5% team critical chance."], 0.006, { "raw-meat": 5, hide: 5, "frost-core": 4 }),
  pet("volt-chimera", "Volt Chimera", "starfall", "Spark", "Rare", { crafting: 5, mischief: 4, mining: 3 }, [294, 94, 45, 50], ["Tri-Bolt", 2.55, 5], ["Overcharge", "Abilities charge one attack faster."], 0.005, { "raw-meat": 5, hide: 4, "spark-core": 5, "chimera-sinew": 1 }),
  pet("eclipse-raven", "Eclipse Raven", "starfall", "Umbral", "Rare", { mischief: 5, crafting: 5, foraging: 2 }, [246, 92, 39, 59], ["Black Sun", 2.5, 4], ["Eclipse", "Enemies begin with 15% less attack charge."], 0.005, { "raw-meat": 2, feather: 6, "dark-fur": 4, "eclipse-eye": 1 }),
  pet("solar-griffin", "Solar Griffin", "starfall", "Radiant", "Area Boss", { crafting: 5, construction: 4, mischief: 3 }, [374, 108, 63, 51], ["Solar Dominion", 2.7, 5], ["Royal Light", "+10% all team damage."], 0.002, { "raw-meat": 7, feather: 6, talon: 4, "sun-oil": 6 }),
  pet("prismatic-wyrm", "Prismatic Wyrm", "starfall", "Frost", "Dungeon", { mining: 5, crafting: 5, processing: 5 }, [420, 118, 70, 48], ["Prism Collapse", 2.85, 6], ["Many-Colored Hide", "Takes 8% less damage from every affinity."], 0.001, { scale: 8, "frost-core": 5, "prism-heart": 1 }),
];

export const SPECIES_BY_ID = Object.fromEntries(PET_SPECIES.map((entry) => [entry.id, entry]));

export const ITEMS = {
  "rough-log": { name: "Rough Log", category: "material" },
  hardwood: { name: "Hardwood", category: "material" },
  "arcane-wood": { name: "Arcane Wood", category: "material" },
  copper: { name: "Copper Ore", category: "material" },
  iron: { name: "Iron Ore", category: "material" },
  silver: { name: "Silver Ore", category: "material" },
  starstone: { name: "Starstone", category: "material" },
  "wild-berries": { name: "Wild Berries", category: "ingredient", heal: 8 },
  herb: { name: "Wild Herb", category: "ingredient" },
  "wild-fiber": { name: "Wild Fiber", category: "material" },
  root: { name: "Root Vegetable", category: "ingredient", heal: 12 },
  embercap: { name: "Embercap", category: "ingredient", heal: 18 },
  starbloom: { name: "Starbloom", category: "ingredient" },
  "raw-fish": { name: "Raw Fish", category: "ingredient" },
  "moon-fish": { name: "Moon Fish", category: "ingredient" },
  "raw-meat": { name: "Raw Meat", category: "ingredient" },
  hide: { name: "Hide", category: "material" },
  bone: { name: "Bone", category: "material" },
  feather: { name: "Feather", category: "material" },
  scale: { name: "Scale", category: "material" },
  shell: { name: "Shell", category: "material" },
  thorn: { name: "Thorn", category: "material" },
  antler: { name: "Antler", category: "material" },
  claw: { name: "Claw", category: "material" },
  tooth: { name: "Tooth", category: "material" },
  horn: { name: "Horn", category: "material" },
  talon: { name: "Talon", category: "material" },
  tusk: { name: "Tusk", category: "material" },
  carapace: { name: "Carapace", category: "material" },
  quartz: { name: "Quartz", category: "material" },
  stone: { name: "Stone", category: "material" },
  "dark-fur": { name: "Night Fur", category: "material" },
  "river-oil": { name: "River Oil", category: "material" },
  "sun-oil": { name: "Sun Oil", category: "material" },
  "ember-gland": { name: "Ember Gland", category: "material" },
  "spark-core": { name: "Spark Core", category: "material" },
  "frost-core": { name: "Frost Core", category: "material" },
  "heartwood-core": { name: "Heartwood Core", category: "material" },
  "resin-tooth": { name: "Resin Tooth", category: "material" },
  "sand-silk": { name: "Sand Silk", category: "material" },
  "iron-plate": { name: "Living Iron Plate", category: "material" },
  "obsidian-knuckle": { name: "Obsidian Knuckle", category: "material" },
  "mirage-eye": { name: "Mirage Eye", category: "material" },
  "storm-silk": { name: "Storm Silk", category: "material" },
  "abyss-pearl": { name: "Abyss Pearl", category: "material" },
  "titan-ore": { name: "Titan Ore", category: "material" },
  "chimera-sinew": { name: "Chimera Sinew", category: "material" },
  "eclipse-eye": { name: "Eclipse Eye", category: "material" },
  "crown-ash": { name: "Crown Ash", category: "material" },
  "prism-heart": { name: "Prism Heart", category: "material" },
  "stolen-spice": { name: "Stolen Spice", category: "ingredient" },
  "relic-dust": { name: "Relic Dust", category: "material" },
  "camp-skewer": { name: "Camp Skewer", category: "meal", heal: 36, captureBonus: 0.02 },
  "river-stew": { name: "River Stew", category: "meal", heal: 64, captureBonus: 0.05 },
  "hunter-feast": { name: "Hunter's Feast", category: "meal", heal: 110, captureBonus: 0.1 },
  "moon-broth": { name: "Moon Broth", category: "meal", heal: 170, captureBonus: 0.18 },
  "trail-pack": { name: "Trail Pack", category: "supply" },
  "foundry-key": { name: "Foundry Key", category: "supply" },
  "storm-seal": { name: "Storm Seal", category: "supply" },
  "field-ration": { name: "Field Ration", category: "meal", heal: 22, captureBonus: 0.01 },
  "pet-tonic": { name: "Pet Tonic", category: "medicine", heal: 45 },
  "keeper-tonic": { name: "Keeper Tonic", category: "medicine", heal: 45 },
  "copper-axe": { name: "Copper Axe", category: "tool", slot: "tool", skill: "woodcutting", level: 1, speedBonus: 0.08 },
  "copper-pickaxe": { name: "Copper Pickaxe", category: "tool", slot: "tool", skill: "mining", level: 1, speedBonus: 0.08 },
  "reed-rod": { name: "Reed Fishing Rod", category: "tool", slot: "tool", skill: "fishing", level: 1, speedBonus: 0.08 },
  "forager-knife": { name: "Forager Knife", category: "tool", slot: "tool", skill: "foraging", level: 1, speedBonus: 0.08 },
  "wooden-sword": { name: "Wooden Sword", category: "weapon", slot: "weapon", style: "melee", level: 1, attack: 5, speed: 15 },
  "shortbow": { name: "Shortbow", category: "weapon", slot: "weapon", style: "ranged", level: 1, attack: 4, speed: 18 },
  "oak-wand": { name: "Oak Wand", category: "weapon", slot: "weapon", style: "magic", level: 1, attack: 6, speed: 12 },
  "cloth-tunic": { name: "Cloth Tunic", category: "armor", slot: "body", level: 1, defense: 4, hp: 12 },
  "leather-boots": { name: "Leather Boots", category: "armor", slot: "feet", level: 1, defense: 2, speed: 4 },
  "iron-sword": { name: "Iron Sword", category: "weapon", slot: "weapon", style: "melee", level: 20, attack: 13, speed: 16 },
  "hunter-bow": { name: "Hunter Bow", category: "weapon", slot: "weapon", style: "ranged", level: 20, attack: 11, speed: 24 },
  "ember-staff": { name: "Ember Staff", category: "weapon", slot: "weapon", style: "magic", level: 20, attack: 15, speed: 13 },
  "hide-vest": { name: "Reinforced Hide Vest", category: "armor", slot: "body", level: 20, defense: 10, hp: 28 },
};

export const EQUIPMENT_SLOTS = [
  { id: "weapon", name: "Weapon" },
  { id: "tool", name: "Tool" },
  { id: "body", name: "Body" },
  { id: "feet", name: "Feet" },
];

export const STORE_ITEMS = [
  { itemId: "field-ration", price: 8, description: "Basic battle food for Auto-eat and manual recovery." },
  { itemId: "pet-tonic", price: 24, description: "Restores 45 health to one injured pet." },
  { itemId: "keeper-tonic", price: 24, description: "Restores 45 Keeper health." },
  { itemId: "copper-axe", price: 70, description: "Starter Woodcutting tool; 8% faster actions." },
  { itemId: "copper-pickaxe", price: 70, description: "Starter Mining tool; 8% faster actions." },
  { itemId: "reed-rod", price: 60, description: "Starter Fishing tool; 8% faster actions." },
  { itemId: "forager-knife", price: 55, description: "Starter Foraging tool; 8% faster actions." },
  { itemId: "wooden-sword", price: 50, description: "Starter Melee weapon." },
  { itemId: "shortbow", price: 55, description: "Starter Ranged weapon." },
  { itemId: "oak-wand", price: 60, description: "Starter Magic weapon." },
  { itemId: "cloth-tunic", price: 45, description: "Basic body protection." },
  { itemId: "leather-boots", price: 40, description: "Basic defence and speed." },
];

export const ACTIVITIES = [
  { id: "fallen-branches", skill: "woodcutting", name: "Cut Fallen Branches", level: 1, duration: 5, rewards: { "rough-log": 1 }, xp: 12 },
  { id: "old-oak", skill: "woodcutting", name: "Fell Old Oak", level: 20, duration: 12, rewards: { hardwood: 1 }, xp: 30 },
  { id: "silver-birch", skill: "woodcutting", name: "Harvest Silver Birch", level: 40, duration: 22, rewards: { hardwood: 2, "wild-fiber": 1 }, xp: 66 },
  { id: "storm-pine", skill: "woodcutting", name: "Cut Storm Pine", level: 60, duration: 35, rewards: { hardwood: 3, "spark-core": 1 }, xp: 120 },
  { id: "magic-tree", skill: "woodcutting", name: "Harvest Magic Tree", level: 80, duration: 55, rewards: { "arcane-wood": 1 }, xp: 210 },
  { id: "copper-outcrop", skill: "mining", name: "Mine Copper Outcrop", level: 1, duration: 6, rewards: { copper: 1 }, xp: 13 },
  { id: "iron-seam", skill: "mining", name: "Mine Iron Seam", level: 20, duration: 13, rewards: { iron: 1 }, xp: 32 },
  { id: "silver-vein", skill: "mining", name: "Mine Silver Vein", level: 40, duration: 24, rewards: { silver: 1 }, xp: 70 },
  { id: "quartz-fault", skill: "mining", name: "Break Quartz Fault", level: 60, duration: 38, rewards: { quartz: 1, silver: 1 }, xp: 126 },
  { id: "starstone-core", skill: "mining", name: "Extract Starstone", level: 80, duration: 60, rewards: { starstone: 1 }, xp: 220 },
  { id: "hedgerow", skill: "foraging", name: "Search Hedgerow", level: 1, duration: 5, rewards: { "wild-berries": 1, herb: 1 }, xp: 11 },
  { id: "root-patch", skill: "foraging", name: "Dig Root Patch", level: 20, duration: 11, rewards: { root: 1, herb: 1 }, xp: 28 },
  { id: "ember-grove", skill: "foraging", name: "Gather Embercaps", level: 40, duration: 20, rewards: { embercap: 1, herb: 1 }, xp: 62 },
  { id: "storm-canopy", skill: "foraging", name: "Search Storm Canopy", level: 60, duration: 32, rewards: { "wild-berries": 2, "stolen-spice": 1 }, xp: 114 },
  { id: "starbloom-field", skill: "foraging", name: "Pick Starbloom", level: 80, duration: 52, rewards: { starbloom: 1 }, xp: 202 },
  { id: "shallow-stream", skill: "fishing", name: "Fish Shallow Stream", level: 1, duration: 7, rewards: { "raw-fish": 1 }, xp: 14 },
  { id: "river-pool", skill: "fishing", name: "Fish River Pool", level: 20, duration: 14, rewards: { "raw-fish": 2 }, xp: 34 },
  { id: "oasis-depths", skill: "fishing", name: "Fish Oasis Depths", level: 40, duration: 25, rewards: { "raw-fish": 2, "river-oil": 1 }, xp: 73 },
  { id: "glacier-cut", skill: "fishing", name: "Fish Glacier Cut", level: 60, duration: 40, rewards: { "raw-fish": 3, "frost-core": 1 }, xp: 130 },
  { id: "moonwater", skill: "fishing", name: "Fish Moonwater", level: 80, duration: 64, rewards: { "moon-fish": 1 }, xp: 228 },
  { id: "unwatched-basket", skill: "mischief", name: "Raid Unwatched Basket", level: 1, duration: 6, rewards: { "wild-berries": 1 }, coins: 4, xp: 13 },
  { id: "market-pantry", skill: "mischief", name: "Slip into Market Pantry", level: 20, duration: 14, rewards: { "stolen-spice": 1 }, coins: 12, xp: 35 },
  { id: "caravan-pockets", skill: "mischief", name: "Work Caravan Pockets", level: 40, duration: 26, rewards: { "stolen-spice": 2 }, coins: 32, xp: 76 },
  { id: "tower-ledgers", skill: "mischief", name: "Lift Tower Ledgers", level: 60, duration: 42, rewards: { "relic-dust": 1 }, coins: 70, xp: 136 },
  { id: "royal-vault", skill: "mischief", name: "Crack Royal Vault", level: 80, duration: 68, rewards: { "relic-dust": 2, starstone: 1 }, coins: 180, xp: 240 },
];

export const ACTIVITY_BY_ID = Object.fromEntries(ACTIVITIES.map((entry) => [entry.id, entry]));

export const RECIPES = [
  { id: "camp-skewer", skill: "cooking", name: "Camp Skewer", level: 1, duration: 6, ingredients: { "raw-meat": 1, herb: 1 }, output: { "camp-skewer": 3 }, xp: 15 },
  { id: "river-stew", skill: "cooking", name: "River Stew", level: 15, duration: 12, ingredients: { "raw-fish": 2, root: 1, herb: 1 }, output: { "river-stew": 2 }, xp: 34 },
  { id: "hunter-feast", skill: "cooking", name: "Hunter's Feast", level: 40, duration: 24, ingredients: { "raw-meat": 3, "wild-berries": 2, "stolen-spice": 1 }, output: { "hunter-feast": 2 }, xp: 82 },
  { id: "moon-broth", skill: "cooking", name: "Moon Broth", level: 80, duration: 52, ingredients: { "moon-fish": 1, starbloom: 1, "relic-dust": 1 }, output: { "moon-broth": 2 }, xp: 230 },
  { id: "trail-pack", skill: "crafting", name: "Trail Pack", level: 1, duration: 8, ingredients: { "rough-log": 2, "wild-fiber": 2, hide: 1 }, output: { "trail-pack": 1 }, xp: 18 },
  { id: "foundry-key", skill: "crafting", name: "Foundry Key", level: 35, duration: 22, ingredients: { iron: 4, hardwood: 2, bone: 1, "heartwood-core": 1 }, output: { "foundry-key": 1 }, xp: 68 },
  { id: "storm-seal", skill: "crafting", name: "Storm Seal", level: 65, duration: 45, ingredients: { silver: 4, quartz: 2, "spark-core": 1, "mirage-eye": 1 }, output: { "storm-seal": 1 }, xp: 156 },
  { id: "iron-sword", skill: "crafting", name: "Forge Iron Sword", level: 20, duration: 18, ingredients: { iron: 5, hardwood: 2, hide: 1 }, output: { "iron-sword": 1 }, xp: 48 },
  { id: "hunter-bow", skill: "crafting", name: "Craft Hunter Bow", level: 20, duration: 18, ingredients: { hardwood: 5, "wild-fiber": 4, hide: 2 }, output: { "hunter-bow": 1 }, xp: 48 },
  { id: "ember-staff", skill: "crafting", name: "Shape Ember Staff", level: 20, duration: 20, ingredients: { hardwood: 4, copper: 5, "ember-gland": 1 }, output: { "ember-staff": 1 }, xp: 52 },
  { id: "hide-vest", skill: "crafting", name: "Sew Reinforced Hide Vest", level: 20, duration: 17, ingredients: { hide: 6, "wild-fiber": 5, copper: 2 }, output: { "hide-vest": 1 }, xp: 46 },
];

export const RECIPE_BY_ID = Object.fromEntries(RECIPES.map((entry) => [entry.id, entry]));

export const BUILDINGS = [
  { id: "den", name: "Den Expansion", level: 1, repeatable: true, maxLevel: 12, description: "+5 pet capacity per level. Requirements rise every two expansions.", costs: { "rough-log": 24, stone: 0, copper: 8 }, duration: 30 },
  { id: "storage", name: "Storage Expansion", level: 1, repeatable: true, maxLevel: 12, description: "+20 item stacks per level. Requirements rise every two expansions.", costs: { "rough-log": 18, copper: 10, "wild-fiber": 8 }, duration: 28 },
  { id: "smokehouse", name: "Smokehouse", level: 3, maxLevel: 1, description: "+10% expected Processing output.", costs: { hardwood: 18, iron: 12, stone: 0 }, duration: 70 },
  { id: "kitchen", name: "Proper Kitchen", level: 3, maxLevel: 1, description: "+8% Cooking bonus-output chance.", costs: { hardwood: 20, iron: 10, copper: 16 }, duration: 75 },
  { id: "workshop", name: "Craft Workshop", level: 5, maxLevel: 1, description: "+8% Crafting bonus-output chance.", costs: { hardwood: 24, iron: 18, quartz: 4 }, duration: 90 },
  { id: "training-yard", name: "Training Yard", level: 5, maxLevel: 1, description: "+5% pet experience from every activity.", costs: { hardwood: 28, iron: 16, hide: 12 }, duration: 95 },
  { id: "watchtower", name: "Watchtower", level: 7, maxLevel: 1, description: "+8% Mischief coins and bonus output.", costs: { hardwood: 30, silver: 10, "wild-fiber": 14 }, duration: 110 },
  { id: "mess-hall", name: "Resting Hollow", level: 9, maxLevel: 1, description: "+25% passive health regeneration for the Keeper and resting pets.", costs: { hardwood: 34, iron: 22, "stolen-spice": 8 }, duration: 120 },
  { id: "prismatic-beacon", name: "Prismatic Beacon", level: 15, maxLevel: 1, description: "+4 percentage points to every dungeon success chance.", costs: { "prism-heart": 1, starstone: 20, "relic-dust": 24 }, duration: 240 },
];

export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map((entry) => [entry.id, entry]));

export const DUNGEONS = [
  { id: "root-cellar", name: "The Root Cellar", level: 10, duration: 30, recommendedPower: 180, favored: "Ember", entry: { "trail-pack": 1 }, rewards: { hardwood: 8, "wild-berries": 8, "heartwood-core": 1 }, encounter: "frosthorn-stag", encounterChance: 0.08 },
  { id: "buried-foundry", name: "The Buried Foundry", level: 30, duration: 45, recommendedPower: 620, favored: "Tide", entry: { "foundry-key": 1 }, rewards: { iron: 14, silver: 6, "ember-gland": 2 }, encounter: "storm-lynx", encounterChance: 0.06 },
  { id: "glass-labyrinth", name: "The Glass Labyrinth", level: 50, duration: 60, recommendedPower: 1250, favored: "Umbral", entry: { "foundry-key": 2 }, rewards: { quartz: 10, "relic-dust": 4, "mirage-eye": 1 }, encounter: "mirage-manticore", encounterChance: 0.04 },
  { id: "tempest-spire", name: "The Tempest Spire", level: 70, duration: 80, recommendedPower: 2200, favored: "Stone", entry: { "storm-seal": 1 }, rewards: { starstone: 5, "spark-core": 5, "storm-silk": 2 }, encounter: "stormhorn-elk", encounterChance: 0.025 },
  { id: "starfall-vault", name: "The Starfall Vault", level: 90, duration: 105, recommendedPower: 3600, favored: "Radiant", entry: { "storm-seal": 3, "storm-silk": 2 }, rewards: { starstone: 12, "relic-dust": 10, "prism-heart": 1 }, encounter: "prismatic-wyrm", encounterChance: 0.012 },
];

export const DUNGEON_BY_ID = Object.fromEntries(DUNGEONS.map((entry) => [entry.id, entry]));

export function xpForNextLevel(level, kind = "pet") {
  const base = kind === "skill" ? 42 : 70;
  return Math.floor(base * Math.pow(level, kind === "skill" ? 1.92 : 2.08));
}

export function levelCapForStars(stars) {
  return Math.max(20, Math.min(100, Number(stars || 1) * 20));
}

export function levelFromXp(xp, kind = "skill", cap = 100) {
  let level = 1;
  let remaining = Math.max(0, Number(xp || 0));
  while (level < cap) {
    const needed = xpForNextLevel(level, kind);
    if (remaining < needed) break;
    remaining -= needed;
    level += 1;
  }
  return { level, progressXp: remaining, nextXp: level >= cap ? 0 : xpForNextLevel(level, kind) };
}

export function affinityMultiplier(attacker, defender) {
  if (AFFINITY_ADVANTAGE[attacker] === defender) return 1.2;
  if (AFFINITY_ADVANTAGE[defender] === attacker) return 0.84;
  return 1;
}

export function scaledPetStats(instance) {
  const species = SPECIES_BY_ID[instance.speciesId];
  if (!species) return { hp: 1, attack: 1, defense: 1, speed: 1, power: 1 };
  const level = Math.max(1, Number(instance.level || 1));
  const stars = Math.max(1, Number(instance.stars || 1));
  const growth = (1 + (level - 1) * 0.045) * (1 + (stars - 1) * 0.1);
  const hp = Math.round(species.stats.hp * growth);
  const attack = Math.round(species.stats.attack * growth);
  const defense = Math.round(species.stats.defense * growth);
  const speed = Math.round(species.stats.speed * (1 + (level - 1) * 0.008));
  return { hp, attack, defense, speed, power: Math.round(hp * 0.35 + attack * 2.2 + defense * 1.7 + speed * 1.2) };
}

export function aptitudeYield(aptitude, random = Math.random) {
  const rating = Math.max(1, Math.min(10, Number(aptitude || 1)));
  return rating > 1 && random() < 0.25 ? rating : 1;
}

export function petAptitude(speciesOrId, skillId) {
  const species = typeof speciesOrId === "string" ? SPECIES_BY_ID[speciesOrId] : speciesOrId;
  return Math.max(1, Math.min(10, Number(species?.aptitudes?.[skillId] || 1)));
}

export function petActionDuration(task, speciesOrId) {
  const aptitude = petAptitude(speciesOrId, task.skill);
  const base = Math.max(2, Number(task.duration || 5)) * 1000 * ACTION_TIME_SCALE;
  const speedScale = 1.35 - aptitude * 0.045; // Aptitude 1≈1.31x, 10≈0.90x.
  return Math.max(2000, Math.round(base * speedScale));
}

export function inventoryName(itemId) {
  return ITEMS[itemId]?.name || itemId.replaceAll("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
