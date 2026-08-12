# Locked gameplay rules

## Keeper progression

- The Keeper is a playable character, not only a manager. One personal timer can gather, fish, perform Mischief, cook, craft, Process, or construct while up to six pets work independently.
- The Keeper can enter live combat alone or alongside up to three pets.
- All 14 skills have levels and XP: Woodcutting, Mining, Foraging, Fishing, Processing, Cooking, Crafting, Mischief, Construction, Combat, Melee, Ranged, Magic, and Pet Mastery.
- The equipped weapon chooses the Keeper's combat discipline. Combat wins train Combat plus Melee, Ranged, or Magic.
- Equipment and all owned stacks live in the dedicated Equipment and Inventory & Storage screens.
- The General Store sells recovery food, pet and Keeper tonics, the four starter tools, three starter weapons, and basic armour. Level-20 combat gear is crafted.

## Pet progression and aptitude

- Every pet can fight and attempt every pet action.
- Species differ through base stats, affinity, one signature ability, one passive, and 1–10 work aptitudes. An unlisted aptitude is 1.
- Aptitude never locks a pet out. It controls the action timer and potential yield. Every action guarantees one base batch; a 25% burst produces batches equal to the aptitude, so aptitude 2 has a 25% chance at two while aptitude 1 always gets one. A poor specialist can attempt a high-tier action very slowly; an aptitude-10 specialist works close to the listed base timer.
- The account skill level unlocks an action. Pet level does not gate work.
- Every completed pet action grants pet XP, including gathering, recipes, Processing, Construction, combat, and dungeons.
- Pet levels improve combat health, attack, and defence. Captured pets begin at one star and level 1.
- Level caps are 20, 40, 60, 80, and 100 for one through five stars.
- Condensing requires two idle, identical, same-star pets at that star's maximum level. It consumes the duplicate, adds one star, resets the survivor to level 1 and zero current XP, restores it to full health, and opens the next level ceiling.
- Each star above the first gives an exact 10% multiplicative base-combat-stat bonus, so a level-1 two-star pet is 10% stronger than a level-1 one-star pet.
- Sacrificing transfers a species value plus part of earned lifetime XP. The level-gap curve makes cheap common sacrifices extremely inefficient for advanced recipients.

## Food and idle timers

- Each repeating pet assignment consumes one prepared meal when it starts. Nutrition determines how many cycles that meal fuels before another copy is consumed automatically.
- Cooking is the recovery-safe exception: its recipe ingredients feed the Cooking pet, so no separate prepared meal is required.
- Up to six pets can run ordinary actions simultaneously. The Keeper's personal timer is separate.
- Pets and the Keeper never die from hunger. A pet action stops safely when the chosen meal is unavailable.
- Better meals provide more nutrition, combat healing, capture chance, and work bonuses.
- Offline repeating work settles for up to eight hours. Smooth countdowns and progress bars update locally without extra Firestore writes.

## Combat, injury, and capture

- Combat is continuous rather than turn-based. Every fighter attacks when an independent, speed-based meter fills.
- The battle screen stays visible for the fight with attack countdowns, health bars, hit splats, ability notices, meal-heal feedback, and a rolling log. Creature artwork stays still.
- Up to three pets may join the Keeper. Pet fighters occupy ordinary active slots during combat; the Keeper must stop a personal assignment before fighting.
- Affinity advantage modifies damage by 20%; disadvantage reduces it. Signature abilities fire automatically on cooldown.
- Combat health persists afterward. Zero health means downed, never deleted: downed pets cannot work, fight, or enter dungeons until healed. Food or Pet Tonics heal pets; food or Keeper Tonics heal the Keeper.
- Area selection determines a weighted encounter pool; the exact enemy is discovered automatically. Common enemies appear often, while rare creatures and Area Bosses stay scarce.
- Auto-hunt repeats encounters after each finished victory. Auto-eat is optional and uses the chosen meal when a fighter falls below the threshold.
- Defeating a wild pet creates no automatic loot. With Auto-harvest off, victory creates exactly one capture-or-Processing decision. Auto-harvest sends that defeated enemy to the real Processing queue so Auto-hunt can continue.
- A failed capture consumes its cooked meal and sends the defeated pet to Processing. Capturing requires open den space.
- Common, Uncommon, Rare, and Area Boss hunts have increasing Combat gates. Dungeon-only species cannot be directly hunted.

## Processing, Construction, and dungeons

- Processing may be completed personally or by one assigned pet. Species have distinct material and coin values; pet Processing aptitude changes timer, burst yield, and bonus coin recovery.
- Den expansions add pet capacity, Storage expansions add stack capacity, and one-time buildings add small permanent bonuses.
- Construction requires account Construction level, materials, and time. A pet assignment also consumes food; personal construction does not.
- Dungeons are asynchronous probability expeditions, not live combat, and do not consume ordinary active slots.
- One to three healthy pets enter. Combined pet power sets base success chance and favored affinity adds a bonus. Failure returns partial rewards and never deletes pets.
- Dungeon materials form a chain from Root Cellar to Foundry Keys, Storm Seals, Starfall Vault, and the final Prismatic Beacon.

## Marketplace

- Pets may be traded any number of times. There are no account-bound or story-bound pets.
- Sellers pay a 2% listing fee with a five-coin minimum.
- Each pet keeps its unique instance ID, health, levels, stars, lifetime XP, and trade count.
- Firestore transactions protect normal listing, purchase, cancellation, payment, and ownership transfers.
- A Keeper must retain one pet before listing another, preventing an accidentally empty den without binding any particular pet.
