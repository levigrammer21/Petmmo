import {
  ACTIVITIES, ACTIVITY_BY_ID, BUILDINGS, DUNGEONS, DUNGEON_BY_ID, ITEMS, MAX_ACTIVE_PETS,
  MAX_COMBAT_PETS, PET_SPECIES, RECIPE_BY_ID, RECIPES, REGIONS, SPECIES_BY_ID,
  inventoryName, levelFromXp, petActionDuration, scaledPetStats
} from './game-data.js';

export const OFFLINE_CAP_MS = 24 * 60 * 60 * 1000;
const PROCESSING_MS = 10_000;
const BATTLE_RESTART_MS = 650;

const uid = (prefix='id') => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,8)}`;
const clone = value => structuredClone(value);
const clamp = (n,min,max) => Math.max(min, Math.min(max,n));

export function skillLevel(state, id){ return levelFromXp(state.skills?.[id]?.xp || 0, 'skill', 100).level; }
export function createPetInstance(speciesId, source='wild'){
  const species = SPECIES_BY_ID[speciesId] || PET_SPECIES[0];
  return { id:uid('pet'), speciesId:species.id, customName:'', level:1, xp:0, stars:1, currentHp:species.stats.hp, source, status:'idle' };
}
export function denCapacity(state){ return 12 + Math.max(0, Number(state.buildings?.den || 0)) * 5; }
export function activePetCount(state){ return Object.keys(state.petAssignments || {}).length + (state.combat?.petIds?.length || 0); }

export function createInitialState(name='Keeper'){
  const skills = {};
  for(const id of ['woodcutting','mining','foraging','fishing','processing','cooking','crafting','mischief','combat','melee','ranged','magic','petMastery']) skills[id]={xp:0};
  const starter=createPetInstance('ash-raccoon','starter');
  return {
    schema:4,
    profile:{displayName:name, coins:120, currentHp:104, maxHp:104},
    skills,
    inventory:{'wild-berries':12, herb:8, 'raw-meat':8, 'field-ration':6, 'pet-tonic':2, 'keeper-tonic':2, 'wooden-sword':1, 'cloth-tunic':1},
    equipment:{weapon:'wooden-sword', body:'cloth-tunic', feet:null, tool:null},
    pets:[starter], discoveries:['ash-raccoon'],
    keeperAssignment:null, petAssignments:{}, remains:[], combat:null,
    buildings:{den:0,storage:0}, stats:{actions:0,kills:0,captures:0,processed:0,dungeons:0},
    log:[{at:Date.now(), text:'Your den is ready. Pick a skill and start idling.'}],
    lastSeenAt:Date.now(), lastSavedAt:Date.now()
  };
}

export function normalizeState(raw, name='Keeper'){
  if(!raw || typeof raw !== 'object') return createInitialState(name);
  const base=createInitialState(name), s={...base,...clone(raw)};
  s.profile={...base.profile,...(raw.profile||{})};
  s.skills={...base.skills,...(raw.skills||{})};
  s.inventory={...base.inventory,...(raw.inventory||{})};
  s.equipment={...base.equipment,...(raw.equipment||{})};
  s.petAssignments=raw.petAssignments && typeof raw.petAssignments==='object' ? raw.petAssignments : {};
  s.pets=Array.isArray(raw.pets)&&raw.pets.length?raw.pets:[base.pets[0]];
  s.remains=Array.isArray(raw.remains)?raw.remains:[];
  s.discoveries=Array.isArray(raw.discoveries)?raw.discoveries:['ash-raccoon'];
  s.log=Array.isArray(raw.log)?raw.log.slice(-80):[];
  s.buildings={...base.buildings,...(raw.buildings||{})};
  s.stats={...base.stats,...(raw.stats||{})};
  for(const pet of s.pets){
    const max=scaledPetStats(pet).hp;
    pet.currentHp=clamp(Number.isFinite(Number(pet.currentHp))?Number(pet.currentHp):max,0,max);
    pet.status=pet.status||'idle';
  }
  return s;
}
function log(s,text){ s.log.push({at:Date.now(),text}); s.log=s.log.slice(-80); }
function grantItem(s,id,qty){ if(qty<=0)return; s.inventory[id]=(s.inventory[id]||0)+qty; }
function takeItem(s,id,qty){ if((s.inventory[id]||0)<qty)return false; s.inventory[id]-=qty; if(s.inventory[id]<=0)delete s.inventory[id]; return true; }
function addSkillXp(s,id,xp){ if(!s.skills[id])s.skills[id]={xp:0}; s.skills[id].xp=(s.skills[id].xp||0)+xp; }
function addPetXp(s,pet,xp){
  pet.xp=(pet.xp||0)+xp;
  while(pet.level<100){ const need=Math.floor(70*Math.pow(pet.level,2.08)); if(pet.xp<need)break; pet.xp-=need; pet.level++; pet.currentHp=scaledPetStats(pet).hp; }
  addSkillXp(s,'petMastery',Math.max(1,Math.floor(xp*.2)));
}
function assignmentInterval(assignment, pet=null){
  if(assignment.type==='processing'){
    if(!pet)return PROCESSING_MS;
    const apt=clamp(Number(SPECIES_BY_ID[pet.speciesId]?.aptitudes.processing||1),1,10);
    return Math.round(PROCESSING_MS*(1.18-apt*.028));
  }
  const task=assignment.type==='recipe'?RECIPE_BY_ID[assignment.targetId]:ACTIVITY_BY_ID[assignment.targetId];
  if(!task)return 5000;
  return pet ? petActionDuration(task, SPECIES_BY_ID[pet.speciesId]) : Math.max(2000, task.duration*1000);
}
function canRecipe(s,r){ return Object.entries(r.ingredients).every(([id,q])=>(s.inventory[id]||0)>=q); }
function doCycle(s,assignment,pet=null){
  if(assignment.type==='activity'){
    const task=ACTIVITY_BY_ID[assignment.targetId]; if(!task)return false;
    const level=skillLevel(s,task.skill); if(level<task.level)return false;
    const apt=pet?clamp(Number(SPECIES_BY_ID[pet.speciesId]?.aptitudes?.[task.skill]||1),1,10):1;
    const bonus=pet && Math.random()<Math.max(0,(apt-1)*0.035) ? 1 : 0;
    for(const [id,q] of Object.entries(task.rewards||{})) grantItem(s,id,q*(1+bonus));
    if(task.coins)s.profile.coins+=(task.coins||0)*(1+bonus);
    addSkillXp(s,task.skill,task.xp||10); if(pet)addPetXp(s,pet,Math.max(4,Math.floor((task.xp||10)*.55)));
  } else if(assignment.type==='recipe'){
    const r=RECIPE_BY_ID[assignment.targetId]; if(!r || skillLevel(s,r.skill)<r.level || !canRecipe(s,r))return false;
    for(const [id,q] of Object.entries(r.ingredients))takeItem(s,id,q);
    for(const [id,q] of Object.entries(r.output))grantItem(s,id,q);
    addSkillXp(s,r.skill,r.xp||10); if(pet)addPetXp(s,pet,Math.max(4,Math.floor((r.xp||10)*.5)));
  } else if(assignment.type==='processing'){
    const remain=s.remains.shift(); if(!remain)return false;
    const species=SPECIES_BY_ID[remain.speciesId]; if(!species)return false;
    for(const [id,q] of Object.entries(species.materials||{}))grantItem(s,id,q);
    s.profile.coins+=Math.max(2,Math.floor(scaledPetStats({speciesId:species.id,level:1,stars:1}).power/25));
    addSkillXp(s,'processing',18+Math.floor((REGIONS.findIndex(r=>r.id===species.region)+1)*8));
    if(pet)addPetXp(s,pet,10); s.stats.processed++;
  }
  assignment.completed=(assignment.completed||0)+1; s.stats.actions++; return true;
}
function advanceAssignment(s, assignment, now, pet=null){
  if(!assignment)return null;
  let interval=assignment.intervalMs||assignmentInterval(assignment,pet); assignment.intervalMs=interval;
  if(!assignment.nextAt)assignment.nextAt=(assignment.startedAt||now)+interval;
  let guard=0;
  while(assignment.nextAt<=now && guard++<25000){
    if(!doCycle(s,assignment,pet)){ assignment.pausedReason=assignment.type==='processing'?'Waiting for remains':'Needs resources or level'; assignment.nextAt=now+interval; break; }
    assignment.pausedReason=''; assignment.nextAt+=interval;
  }
  return assignment;
}
export function startKeeperAssignment(state,type,targetId,at=Date.now()){
  const s=clone(state); s.keeperAssignment={type,targetId,startedAt:at,nextAt:at+assignmentInterval({type,targetId}),completed:0};
  log(s,`Keeper started ${assignmentName(s.keeperAssignment)}.`); return s;
}
export function stopKeeperAssignment(state){ const s=clone(state); s.keeperAssignment=null; return s; }
export function startPetAssignment(state,petId,type,targetId,at=Date.now()){
  const s=clone(state),pet=s.pets.find(p=>p.id===petId); if(!pet)throw Error('Pet not found.');
  if(Number(pet.currentHp||0)<=0)throw Error('Heal that pet before assigning it.');
  if(s.combat?.petIds?.includes(petId))throw Error('That pet is fighting.');
  if(!s.petAssignments[petId] && Object.keys(s.petAssignments).length>=MAX_ACTIVE_PETS)throw Error(`Only ${MAX_ACTIVE_PETS} pets can work at once.`);
  const a={type,targetId,startedAt:at,completed:0}; a.intervalMs=assignmentInterval(a,pet); a.nextAt=at+a.intervalMs; s.petAssignments[petId]=a; pet.status=`work:${type}`;
  return s;
}
export function stopPetAssignment(state,petId){ const s=clone(state); delete s.petAssignments[petId]; const pet=s.pets.find(p=>p.id===petId); if(pet)pet.status='idle'; return s; }
export function assignmentName(a){ if(!a)return'Idle'; if(a.type==='processing')return'Process Remains'; return (a.type==='recipe'?RECIPE_BY_ID[a.targetId]:ACTIVITY_BY_ID[a.targetId])?.name || 'Work'; }

function areaPool(s,regionId){
  const idx=REGIONS.findIndex(r=>r.id===regionId); const combat=skillLevel(s,'combat');
  return PET_SPECIES.filter(p=>p.region===regionId && p.acquisition!=='Dungeon' && (p.acquisition!=='Area Boss'||combat>=Math.max(8,idx*20+15)));
}
function chooseEnemy(s,regionId){ const pool=areaPool(s,regionId); return pool[Math.floor(Math.random()*pool.length)]||PET_SPECIES[0]; }
function partyPower(s,petIds,includeKeeper){
  let p=includeKeeper?95+skillLevel(s,'combat')*8:0;
  for(const id of petIds){const pet=s.pets.find(x=>x.id===id);if(pet)p+=scaledPetStats(pet).power;}
  return p;
}
function spawnEnemy(s,speciesId=null,at=Date.now()){
  const c=s.combat; if(!c)return;
  const species=speciesId?SPECIES_BY_ID[speciesId]:chooseEnemy(s,c.regionId);
  const regionIndex=Math.max(0,REGIONS.findIndex(r=>r.id===species.region));
  const scale=1+regionIndex*.08;
  c.enemy={speciesId:species.id,maxHp:Math.round(species.stats.hp*scale),hp:Math.round(species.stats.hp*scale),attack:Math.round(species.stats.attack*scale),defense:Math.round(species.stats.defense*scale),speed:species.stats.speed};
  c.nextPartyAt=at+Math.max(700,1900-Math.min(800,partyPower(s,c.petIds,c.includeKeeper)/5));
  c.nextEnemyAt=at+Math.max(1000,2600-species.stats.speed*35); c.nextSpawnAt=0; c.state='fighting'; c.battle=(c.battle||0)+1;
}
function autoHealActor(s,pet=null){
  const max=pet?scaledPetStats(pet).hp:s.profile.maxHp; const hp=pet?pet.currentHp:s.profile.currentHp;
  if(hp>max*.35)return false;
  const foods=Object.entries(s.inventory).filter(([id,q])=>q>0 && ITEMS[id]?.heal).sort((a,b)=>ITEMS[a[0]].heal-ITEMS[b[0]].heal);
  const pick=foods.find(([id])=>ITEMS[id].category==='meal')||foods[0]; if(!pick)return false;
  takeItem(s,pick[0],1); const healed=Math.min(ITEMS[pick[0]].heal,max-hp); if(pet)pet.currentHp+=healed; else s.profile.currentHp+=healed; return true;
}
function partyLiving(s,c){ return c.petIds.some(id=>Number(s.pets.find(p=>p.id===id)?.currentHp||0)>0) || (c.includeKeeper&&s.profile.currentHp>0); }
function partyAttack(s,at){
  const c=s.combat,e=c.enemy;if(!e)return;
  let attack=0, speed=0, actors=0;
  for(const id of c.petIds){ const p=s.pets.find(x=>x.id===id); if(p&&p.currentHp>0){const st=scaledPetStats(p);attack+=st.attack;speed+=st.speed;actors++;} }
  if(c.includeKeeper&&s.profile.currentHp>0){attack+=12+skillLevel(s,c.style||'melee')*2;speed+=16;actors++;}
  const dmg=Math.max(1,Math.round(attack*.55 - e.defense*.22 + Math.random()*Math.max(3,attack*.18)));
  e.hp=Math.max(0,e.hp-dmg); c.lastEvent={at,text:`Your party hits ${SPECIES_BY_ID[e.speciesId].name} for ${dmg}.`,kind:'hit'};
  c.nextPartyAt=at+Math.max(650,2100-(speed/Math.max(1,actors))*28);
  if(e.hp<=0)winBattle(s,at);
}
function enemyAttack(s,at){
  const c=s.combat,e=c.enemy;if(!e)return;
  const targets=[]; for(const id of c.petIds){const p=s.pets.find(x=>x.id===id);if(p&&p.currentHp>0)targets.push(p);} if(c.includeKeeper&&s.profile.currentHp>0)targets.push(null);
  if(!targets.length){ c.state='stopped'; c.lastEvent={at,text:'Your party is down. Heal up and resume.',kind:'down'}; return; }
  const target=targets[Math.floor(Math.random()*targets.length)];
  const def=target?scaledPetStats(target).defense:6+skillLevel(s,'combat'); const dmg=Math.max(1,Math.round(e.attack*.55-def*.25+Math.random()*Math.max(2,e.attack*.15)));
  if(target){target.currentHp=Math.max(0,target.currentHp-dmg); if(c.autoEat)autoHealActor(s,target);} else {s.profile.currentHp=Math.max(0,s.profile.currentHp-dmg); if(c.autoEat)autoHealActor(s,null);}
  c.lastEvent={at,text:`${SPECIES_BY_ID[e.speciesId].name} hits ${target?(target.customName||SPECIES_BY_ID[target.speciesId].name):'Keeper'} for ${dmg}.`,kind:'enemy'};
  c.nextEnemyAt=at+Math.max(900,2700-e.speed*34);
  if(!partyLiving(s,c)){c.state='stopped';c.lastEvent={at,text:'Your party is down. Heal them, then resume combat.',kind:'down'};}
}
function winBattle(s,at){
  const c=s.combat, species=SPECIES_BY_ID[c.enemy.speciesId]; s.stats.kills++; addSkillXp(s,'combat',20+REGIONS.findIndex(r=>r.id===species.region)*18);
  for(const id of c.petIds){const p=s.pets.find(x=>x.id===id);if(p&&p.currentHp>0)addPetXp(s,p,12);}
  s.remains.push({id:uid('rem'),speciesId:species.id,acquiredAt:at}); if(s.remains.length>500)s.remains.splice(0,s.remains.length-500);
  s.profile.coins+=3+Math.max(0,REGIONS.findIndex(r=>r.id===species.region))*5;
  const captureChance=Math.min(.16,(species.captureRate||.02)*1.25);
  if(Math.random()<captureChance && s.pets.length<denCapacity(s)){
    const p=createPetInstance(species.id,'combat'); s.pets.push(p); if(!s.discoveries.includes(species.id))s.discoveries.push(species.id); s.stats.captures++; c.lastEvent={at,text:`Tamed ${species.name}! It joined your den.`,kind:'capture'};
  } else c.lastEvent={at,text:`Defeated ${species.name}. Next fight incoming.`,kind:'win'};
  if(c.dungeonId){
    const d=DUNGEON_BY_ID[c.dungeonId]; for(const [id,q] of Object.entries(d.rewards||{}))grantItem(s,id,q); s.stats.dungeons++; c.dungeonId=null; c.state='stopped'; c.enemy=null; c.lastEvent={at,text:`${d.name} cleared. Rewards claimed.`,kind:'win'}; return;
  }
  c.enemy=null; c.state='between'; c.nextSpawnAt=at+BATTLE_RESTART_MS;
}
export function startCombat(state,{regionId='greenhollow',petIds=[],includeKeeper=true,style='melee',autoEat=true}={},at=Date.now()){
  const s=clone(state); const ids=petIds.slice(0,MAX_COMBAT_PETS).filter(id=>s.pets.some(p=>p.id===id&&p.currentHp>0));
  if(!ids.length&&!includeKeeper)throw Error('Choose at least one living fighter.');
  for(const id of ids){delete s.petAssignments[id]; const p=s.pets.find(x=>x.id===id);if(p)p.status='combat';}
  s.combat={regionId,petIds:ids,includeKeeper,style,autoEat,state:'fighting',battle:0,lastEvent:null,lastAdvancedAt:at}; spawnEnemy(s,null,at); return s;
}
export function stopCombat(state){const s=clone(state);if(s.combat){for(const id of s.combat.petIds){const p=s.pets.find(x=>x.id===id);if(p)p.status='idle';}}s.combat=null;return s;}
export function resumeCombat(state,at=Date.now()){const s=clone(state);if(!s.combat)return s;if(!partyLiving(s,s.combat))return s;s.combat.state='fighting';if(!s.combat.enemy)spawnEnemy(s,null,at);return s;}
export function startDungeon(state,dungeonId,petIds,includeKeeper=true,at=Date.now()){
  let s=clone(state),d=DUNGEON_BY_ID[dungeonId]; if(!d)throw Error('Dungeon not found.'); if(skillLevel(s,'combat')<d.level)throw Error(`Combat level ${d.level} required.`);
  if(partyPower(s,petIds,includeKeeper)<d.recommendedPower*.55)throw Error('Your party is far below the recommended power.');
  for(const [id,q] of Object.entries(d.entry||{}))if((s.inventory[id]||0)<q)throw Error(`Need ${q} ${inventoryName(id)}.`); for(const [id,q] of Object.entries(d.entry||{}))takeItem(s,id,q);
  s=startCombat(s,{regionId:SPECIES_BY_ID[d.encounter]?.region||'greenhollow',petIds,includeKeeper,autoEat:true},at); s.combat.dungeonId=d.id; spawnEnemy(s,d.encounter,at); return s;
}
export function advanceLive(state,now=Date.now()){
  const s=clone(state); const c=s.combat;if(!c)return s;
  let guard=0;
  while(guard++<200 && c.state!=='stopped'){
    if(c.state==='between'){if(c.nextSpawnAt>now)break;spawnEnemy(s,null,c.nextSpawnAt||now);continue;}
    const next=Math.min(c.nextPartyAt||Infinity,c.nextEnemyAt||Infinity); if(next>now)break;
    if((c.nextPartyAt||Infinity)<= (c.nextEnemyAt||Infinity))partyAttack(s,c.nextPartyAt);else enemyAttack(s,c.nextEnemyAt);
  }
  c.lastAdvancedAt=now; return s;
}
function settleOfflineCombat(s,from,to){
  const c=s.combat;if(!c||c.state==='stopped')return;
  const seconds=Math.max(0,(to-from)/1000); const estimated=Math.min(5000,Math.floor(seconds/7));
  // Recreate battles at a coarse cadence offline; there is deliberately no search wait.
  for(let i=0;i<estimated && partyLiving(s,c);i++){
    if(!c.enemy)spawnEnemy(s,null,from+i*7000);
    let rounds=0;
    while(c.enemy&&c.enemy.hp>0&&partyLiving(s,c)&&rounds++<50){partyAttack(s,from+i*7000+rounds*500);if(c.enemy)enemyAttack(s,from+i*7000+rounds*500+250);}
    if(c.state==='between'){c.nextSpawnAt=0;c.enemy=null;}
    if(c.state==='stopped')break;
  }
  if(c&&c.state!=='stopped'){c.enemy=null;c.state='between';c.nextSpawnAt=to+150;}
}
export function settleState(state,now=Date.now()){
  const s=normalizeState(state,state.profile?.displayName||'Keeper'); const from=Math.max(Number(s.lastSeenAt||now),now-OFFLINE_CAP_MS);
  if(s.keeperAssignment)advanceAssignment(s,s.keeperAssignment,now,null);
  for(const [petId,a] of Object.entries({...s.petAssignments})){const p=s.pets.find(x=>x.id===petId);if(!p||p.currentHp<=0){delete s.petAssignments[petId];continue;}advanceAssignment(s,a,now,p);}
  if(s.combat && now-from>1500)settleOfflineCombat(s,from,now); else if(s.combat)s.combat=advanceLive(s,now).combat;
  s.lastSeenAt=now; return s;
}
export function useHealingItem(state,itemId,{petId=null,keeper=false}={}){
  const s=clone(state),item=ITEMS[itemId];if(!item?.heal||!takeItem(s,itemId,1))throw Error(`You don't have ${inventoryName(itemId)}.`);
  if(keeper){const before=s.profile.currentHp;s.profile.currentHp=Math.min(s.profile.maxHp,before+item.heal);return s;}
  const p=s.pets.find(x=>x.id===petId);if(!p)throw Error('Choose a pet to heal.'); const max=scaledPetStats(p).hp;p.currentHp=Math.min(max,p.currentHp+item.heal);return s;
}
export function equipItem(state,itemId){const s=clone(state),item=ITEMS[itemId];if(!item?.slot||!(s.inventory[itemId]>0))throw Error('You do not own that equipment.');s.equipment[item.slot]=itemId;return s;}
export function buildUpgrade(state,buildingId){
  const s=clone(state),b=BUILDINGS.find(x=>x.id===buildingId);if(!b)throw Error('Upgrade not found.');const lv=Number(s.buildings[buildingId]||0);if(!b.repeatable&&lv>=1)throw Error('Already built.');if(b.repeatable&&lv>=b.maxLevel)throw Error('Max level.');
  const mult=1+Math.floor(lv/2)*.55; for(const [id,q0] of Object.entries(b.costs||{})){const q=Math.ceil(q0*mult);if((s.inventory[id]||0)<q)throw Error(`Need ${q} ${inventoryName(id)}.`);} for(const [id,q0] of Object.entries(b.costs||{}))takeItem(s,id,Math.ceil(q0*mult)); s.buildings[buildingId]=lv+1; return s;
}
export function partyPowerFor(state,petIds,includeKeeper=true){return partyPower(state,petIds,includeKeeper);}
