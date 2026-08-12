# Locked gameplay rules

## Pet progression

- Every pet can participate in combat.
- Species differ through base stats, affinity, one signature ability, one passive, and work aptitudes.
- Captured pets begin at 1★ and level 1.
- Level caps are 20, 40, 60, 80, and 100 for 1★ through 5★.
- Both same-species pets must have the same star rank and reach that rank's level cap before they can Condense.
- Condensing consumes one pet, increases the survivor by one star, preserves its current level, and opens the next level band.
- Sacrificing transfers a small species value plus 30% of earned lifetime XP, reduced sharply by the donor/recipient level gap.

## Aptitude output

Each activity gives one guaranteed base output. A 25% burst roll changes that output to the assigned pet's aptitude rating:

| Aptitude | 75% result | 25% result | Average |
| ---: | ---: | ---: | ---: |
| 1 | 1 | 1 | 1.00 |
| 2 | 1 | 2 | 1.25 |
| 3 | 1 | 3 | 1.50 |
| 4 | 1 | 4 | 1.75 |
| 5 | 1 | 5 | 2.00 |

Player skill level and pet level both gate high-level actions. For example, the Magic Tree requires Woodcutting 80 and a level-80 pet, which requires at least 4★.

Every running assignment exposes its current cycle countdown, progress bar, completed-action total, skill XP, and level milestones. These visual timers update locally and do not create extra Firestore writes.

## Food

- Every ordinary active assignment consumes food.
- Cooking is the recovery-safe exception: recipe ingredients feed the Cooking pet, so no separate prepared meal is required. Cooking recipes produce multi-meal batches.
- Up to six pets can work at once, providing more throughput and XP while consuming food six times as quickly.
- Pets never die or lose levels when food runs out; the assignment stops safely.
- Better meals provide more working nutrition, stronger healing, improved capture chance, and work bonuses.
- Cooked food is also the only capture consumable.

## Combat and capture

- Up to three pets fight at once, consuming normal active slots during a live fight.
- Combat is continuous rather than turn-based. Every combatant attacks when its independent speed-based meter fills.
- The battle screen remains visible for the entire fight, with attack countdowns, health bars, hit splats, ability notices, healing feedback, and a rolling combat log.
- Pet artwork remains still during combat; timing and hit feedback provide the motion rather than attack animations.
- Signature abilities fire on their own cooldowns.
- Affinity advantage modifies damage by 20%; disadvantage reduces it.
- Selected combat food automatically heals injured pets.
- Defeating a wild pet produces no automatic loot.
- Commons unlock at each region threshold; Uncommon, Rare, and Area Boss hunts unlock later in that region. Dungeon species cannot be selected as ordinary hunts.
- After victory, the keeper may offer one cooked meal for a capture roll or send the pet to Processing.
- A failed capture consumes the meal and sends the pet to Processing.
- Capturing requires an open den space.

## Processing

- Processing requires an assigned pet and consumes one ordinary active slot.
- Species have distinct meat and material tables.
- Processing aptitude controls burst output.
- The Smokehouse permanently improves output.

## Construction

- Den expansions increase pet capacity.
- Storage expansions increase item-stack capacity.
- One-time facilities provide small permanent boosts to Processing, Cooking, Crafting, XP, Mischief, and food efficiency.
- Construction requires materials, food, time, and an assigned pet.

## Dungeons

- Dungeons are asynchronous probability expeditions, not live combat.
- A party contains up to three pets.
- Dungeon pets do not consume the six ordinary active slots, but cannot do another task simultaneously.
- Combined pet power determines base success chance.
- Each favored-affinity pet adds a meaningful bonus.
- Overwhelming the recommended power can reach 100% success.
- Failure returns partial rewards; pets never die.
- Successful runs can reveal rare capture encounters.
- Rare dungeon materials form an expedition chain: Root Cellar materials unlock Foundry Keys, Glass Labyrinth materials unlock Storm Seals, and Tempest materials unlock the Starfall Vault.
- The final Prismatic Beacon permanently adds four percentage points to dungeon success chance.

## Marketplace

- Pets may be traded an unlimited number of times.
- Every pet retains a unique instance ID and trade counter.
- Sellers pay a 2% listing fee, minimum five coins.
- Listing, buying, cancellation, currency transfer, and ownership transfer use Firestore transactions.
- A sold listing delivers its coins as soon as the seller is online; an offline seller receives them on the next sign-in.
- There are no account-bound or story-bound pets.
- A keeper must retain one pet before listing another, preventing an accidentally unplayable empty den without binding any particular pet.
