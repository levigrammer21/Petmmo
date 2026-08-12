import test from 'node:test';
import assert from 'node:assert/strict';
import { PET_SPECIES, SPECIES_BY_ID, ITEMS, DUNGEONS } from './game-data.js';
import { captureChanceFor, createInitialState, masteryLevel, startKeeperAssignment, settleState, startPetAssignment, startCombat, advanceLive, useHealingItem } from './game-engine.js';

test('keeps all 50 pets and their art paths',()=>{
  assert.equal(PET_SPECIES.length,50);
  assert.equal(new Set(PET_SPECIES.map(p=>p.id)).size,50);
  assert.ok(PET_SPECIES.every(p=>p.art===`pets/${p.id}.png`));
});
test('raw berries are edible',()=>assert.equal(ITEMS['wild-berries'].heal,8));
test('keeper skill runs indefinitely without a session end',()=>{
  let s=createInitialState('Test'); const at=1_000_000;
  s=startKeeperAssignment(s,'activity','fallen-branches',at);
  assert.equal('plannedEndAt' in s.keeperAssignment,false);
  s.lastSeenAt=at; s=settleState(s,at+31_000);
  assert.ok((s.inventory['rough-log']||0)>=6); assert.ok(s.keeperAssignment);
});
test('pets work independently beside keeper',()=>{
  let s=createInitialState('Test'); const at=2_000_000; const p=s.pets[0];
  s=startKeeperAssignment(s,'activity','fallen-branches',at);
  s=startPetAssignment(s,p.id,'activity','hedgerow',at);
  s.lastSeenAt=at; s=settleState(s,at+30_000);
  assert.ok(s.keeperAssignment); assert.ok(s.petAssignments[p.id]); assert.ok((s.inventory['wild-berries']||0)>12);
});
test('combat has no patrol/session duration and begins with an enemy immediately',()=>{
  let s=createInitialState('Fighter'); const p=s.pets[0];
  s=startCombat(s,{regionId:'greenhollow',petIds:[p.id],includeKeeper:true},3_000_000);
  assert.ok(s.combat.enemy); assert.equal('endAt' in s.combat,false); assert.equal('durationHours' in s.combat,false);
  for(let t=3_001_000;t<3_030_000;t+=500)s=advanceLive(s,t);
  assert.ok(s.stats.kills>=1 || s.combat.state==='stopped');
});
test('downed pets can always be healed',()=>{
  let s=createInitialState('Healer'); const p=s.pets[0]; p.currentHp=0;
  const before=s.inventory['wild-berries']; s=useHealingItem(s,'wild-berries',{petId:p.id});
  assert.equal(s.inventory['wild-berries'],before-1); assert.ok(s.pets[0].currentHp>0);
});
test('first dungeon is early progression, not a high-level timer wall',()=>{
  assert.ok(DUNGEONS[0].level<=10); assert.ok(DUNGEONS[0].recommendedPower<=200);
});

test('taming is explicit and offerings improve the visible chance',()=>{
  const s=createInitialState('Tamer');
  const base=captureChanceFor(s,'moss-hare','');
  const food=captureChanceFor(s,'moss-hare','hunter-feast');
  assert.ok(food>base);
  const c=startCombat(s,{petIds:[s.pets[0].id],autoTame:true,captureItemId:'field-ration'},4_000_000).combat;
  assert.equal(c.autoTame,true); assert.equal(c.captureItemId,'field-ration');
});
test('action mastery rises while the same idle action repeats',()=>{
  let s=createInitialState('Master'); const at=5_000_000;
  s=startKeeperAssignment(s,'activity','fallen-branches',at); s.lastSeenAt=at; s=settleState(s,at+180_000);
  assert.ok(masteryLevel(s,'activity:fallen-branches')>1);
});
test('combat stores a rolling live event feed and streak',()=>{
  let s=createInitialState('Arena'); const at=6_000_000;
  s=startCombat(s,{petIds:[s.pets[0].id],includeKeeper:true},at);
  for(let t=at+500;t<at+45000;t+=300)s=advanceLive(s,t);
  assert.ok(Array.isArray(s.combat.events)); assert.ok(s.combat.events.length>0); assert.ok((s.stats.bestStreak||0)>=0);
});
