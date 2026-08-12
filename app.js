import { ACTIVITIES, BUILDINGS, DUNGEONS, GAME_VERSION, ITEMS, MAX_ACTIVE_PETS, MAX_COMBAT_PETS, PET_SPECIES, RECIPES, REGIONS, SKILLS, SPECIES_BY_ID, inventoryName, levelFromXp, scaledPetStats } from './game-data.js';
import { advanceLive, assignmentName, buildUpgrade, captureChanceFor, createInitialState, denCapacity, equipItem, masteryLevel, normalizeState, partyPowerFor, resumeCombat, settleState, skillLevel, startCombat, startDungeon, startKeeperAssignment, startPetAssignment, stopCombat, stopKeeperAssignment, stopPetAssignment, useHealingItem } from './game-engine.js';
import { connectCloud, emailCreate, emailSignIn, googleSignIn, loadCloudState, onAuth, saveCloudState, signOutCloud } from './cloud.js';

const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const LOCAL_KEY='wilderden-rebuild-v1';
const stateUi={screen:'home',skill:'woodcutting',selectedCombat:new Set(),combatKeeper:true,region:'greenhollow',cloud:false,user:null,lastRender:0};
let state=null, saveTimer=null, cloudReady=false;

const NAV=[['home','⌂','Home'],['skills','✦','Skills'],['combat','⚔','Combat'],['pets','🐾','Pets'],['inventory','▦','Inventory'],['dungeons','◆','Dungeons'],['upgrades','⌁','Upgrades']];
const GATHER=['woodcutting','mining','foraging','fishing','mischief','processing','cooking','crafting'];
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>new Intl.NumberFormat('en-US',{notation:n>99999?'compact':'standard',maximumFractionDigits:1}).format(Math.floor(n||0));
const time=ms=>{const s=Math.max(0,Math.ceil(ms/1000));return s<60?`${s}s`:`${Math.floor(s/60)}m ${s%60}s`;};
const itemName=id=>inventoryName(id);
function toast(text){const el=document.createElement('div');el.className='toast';el.textContent=text;$('#toast-zone').append(el);setTimeout(()=>el.remove(),3200);}
function art(species,cls='pet-art'){return `<img class="${cls}" src="${esc(species.art)}" alt="${esc(species.name)}" onerror="this.style.display='none';this.nextElementSibling.style.display='grid'"/><span class="art-fallback" style="display:none">🐾</span>`;}
function keeperAvatar(cls='keeper-avatar'){return `<div class="${cls}" aria-label="Keeper avatar"><svg viewBox="0 0 64 64" aria-hidden="true"><path class="ka-cloak" d="M13 59c1-13 8-21 19-21s18 8 19 21H13Z"/><path class="ka-hood" d="M17 28C17 14 23 6 32 6s15 8 15 22l-5 12H22l-5-12Z"/><circle class="ka-face" cx="32" cy="27" r="10"/><path class="ka-hair" d="M22 26c2-9 17-11 21-2-6-1-12-4-16 2l-5 0Z"/><path class="ka-scar" d="M39 27l-4 5"/><circle class="ka-eye" cx="29" cy="28" r="1.5"/><circle class="ka-eye" cx="37" cy="28" r="1.5"/><path class="ka-leaf" d="M43 12c8-1 10 5 7 10-5 0-8-3-7-10Z"/></svg></div>`;}
function skillInfo(id){const xp=state.skills?.[id]?.xp||0,l=levelFromXp(xp,'skill',100);return {...l,xp};}
function progress(info){const pct=info.nextXp?Math.min(100,info.progressXp/info.nextXp*100):100;return `<div class="xpbar"><span style="width:${pct}%"></span></div>`;}
function ownedHealing(){return Object.entries(state.inventory).filter(([id,q])=>q>0&&ITEMS[id]?.heal).sort((a,b)=>ITEMS[a[0]].heal-ITEMS[b[0]].heal);}

async function init(){
  $('#version').textContent=`v${GAME_VERSION}`;
  bindAuth();
  try{
    await connectCloud(); cloudReady=true;
    onAuth(async user=>{if(user){stateUi.user=user;stateUi.cloud=true;const loaded=await loadCloudState();state=settleState(loaded?normalizeState(loaded,user.displayName||'Keeper'):createInitialState(user.displayName||'Keeper'));enterGame();saveSoon();}else if(!stateUi.cloud){showAuth();}});
  }catch(e){console.warn(e);$('#auth-message').textContent='Cloud sign-in is unavailable right now. Local play still works.';}
}
function bindAuth(){
  $('#google').onclick=async()=>{try{if(!cloudReady)throw Error('Firebase is still loading.');await googleSignIn();}catch(e){$('#auth-message').textContent=e.message;}};
  $('#signin').onclick=async()=>{try{await emailSignIn($('#email').value,$('#password').value);}catch(e){$('#auth-message').textContent=e.message;}};
  $('#create').onclick=async()=>{try{await emailCreate($('#email').value,$('#password').value);}catch(e){$('#auth-message').textContent=e.message;}};
  $('#local').onclick=()=>{stateUi.cloud=false;stateUi.user=null;const raw=localStorage.getItem(LOCAL_KEY);state=settleState(raw?normalizeState(JSON.parse(raw),'Keeper'):createInitialState('Keeper'));enterGame();};
  $('#menu-btn').onclick=()=>$('#sidebar').classList.toggle('open');
  $('#account-btn').onclick=()=>openAccount();
}
function showAuth(){$('#auth').classList.remove('hidden');$('#game').classList.add('hidden');}
function enterGame(){
  $('#auth').classList.add('hidden');$('#game').classList.remove('hidden');
  if(state.combat?.petIds)state.combat.petIds.forEach(id=>stateUi.selectedCombat.add(id));
  renderNav();render();
}
function saveSoon(){
  localStorage.setItem(LOCAL_KEY,JSON.stringify(state));
  clearTimeout(saveTimer);saveTimer=setTimeout(async()=>{if(stateUi.cloud&&stateUi.user){try{state.lastSavedAt=Date.now();await saveCloudState(state);}catch(e){console.warn(e);}}},800);
}
function setState(next,msg=''){state=next;saveSoon();render();if(msg)toast(msg);}
function renderNav(){
  const markup=NAV.map(([id,ico,label])=>`<button data-nav="${id}" class="nav-item ${stateUi.screen===id?'active':''}"><span>${ico}</span><b>${label}</b></button>`).join('');
  $('#sidebar').innerHTML=`<div class="side-head"><small>KEEPER</small><strong>${esc(state.profile.displayName)}</strong></div>${markup}<div class="side-foot">Idle progress caps at 24 hours.<br/>No work-session timers.</div>`;
  $('#bottom-nav').innerHTML=NAV.slice(0,5).map(([id,ico,label])=>`<button data-nav="${id}" class="${stateUi.screen===id?'active':''}"><span>${ico}</span><small>${label}</small></button>`).join('');
  $$('[data-nav]').forEach(b=>b.onclick=()=>{stateUi.screen=b.dataset.nav;$('#sidebar').classList.remove('open');renderNav();render();});
}
function render(){
  if(!state)return;const now=Date.now();state=settleState(state,now);
  $('#coins').textContent=fmt(state.profile.coins);$('#keeper-hp').textContent=`${Math.ceil(state.profile.currentHp)}/${state.profile.maxHp}`;$('#pet-count').textContent=`${state.pets.length}/${denCapacity(state)}`;
  const main=$('#main');
  if(stateUi.screen==='home')main.innerHTML=renderHome();
  else if(stateUi.screen==='skills')main.innerHTML=renderSkills();
  else if(stateUi.screen==='combat')main.innerHTML=renderCombat();
  else if(stateUi.screen==='pets')main.innerHTML=renderPets();
  else if(stateUi.screen==='inventory')main.innerHTML=renderInventory();
  else if(stateUi.screen==='dungeons')main.innerHTML=renderDungeons();
  else if(stateUi.screen==='upgrades')main.innerHTML=renderUpgrades();
  bindScreen();stateUi.lastRender=now;
}
function pageHead(kicker,title,copy,extra=''){return `<header class="page-head"><div><p class="eyebrow">${kicker}</p><h1>${title}</h1><p>${copy}</p></div>${extra}</header>`;}
function renderHome(){
  const active=[];
  if(state.keeperAssignment)active.push(`<article class="active-card"><span class="who">YOU</span><div><b>${esc(assignmentName(state.keeperAssignment))}</b><small>${esc(state.keeperAssignment.pausedReason||'Working continuously')}</small>${actionBar(state.keeperAssignment)}</div><button data-stop-keeper class="mini-btn">Stop</button></article>`);
  for(const [id,a] of Object.entries(state.petAssignments)){const p=state.pets.find(x=>x.id===id);if(!p)continue;const sp=SPECIES_BY_ID[p.speciesId];active.push(`<article class="active-card"><div class="tiny-art">${art(sp)}</div><div><b>${esc(p.customName||sp.name)}</b><small>${esc(assignmentName(a))}${a.pausedReason?` · ${esc(a.pausedReason)}`:''}</small>${actionBar(a)}</div><button data-stop-pet="${id}" class="mini-btn">Stop</button></article>`);}
  const ci=skillInfo('combat');
  return `${pageHead('YOUR DEN','Welcome back, Keeper.','Everything here runs until you tell it to stop. Start a skill, put pets to work, or head into continuous combat.')}
    <section class="hero-grid">
      <article class="hero-card keeper-card"><div class="keeper-hero-row">${keeperAvatar('keeper-avatar hero-avatar')}<div><p class="eyebrow">KEEPER</p><h2>${esc(state.keeperAssignment?assignmentName(state.keeperAssignment):'Ready to train')}</h2></div></div><div class="big-stat"><span>Combat</span><strong>${ci.level}</strong></div><button data-go="skills" class="btn primary">Choose a skill</button></article>
      <article class="hero-card"><p class="eyebrow">PETS WORKING</p><h2>${Object.keys(state.petAssignments).length} / ${MAX_ACTIVE_PETS}</h2><p>Your pets work beside you. Their aptitude affects efficiency, not access.</p><button data-go="pets" class="btn">Manage pets</button></article>
      <article class="hero-card"><p class="eyebrow">COMBAT</p><h2>${state.combat?state.combat.state==='stopped'?'Party down':'Fighting now':'Ready'}</h2><p>${state.combat?`${REGIONS.find(r=>r.id===state.combat.regionId)?.name||'Wilds'} · ${state.stats.kills} total wins`:'Pick a region and fight until you stop.'}</p><button data-go="combat" class="btn">${state.combat?'Open battle':'Start combat'}</button></article>
    </section>
    <section class="section"><div class="section-title"><div><p class="eyebrow">ACTIVE NOW</p><h2>Idle actions</h2></div><span>${active.length} running</span></div>${active.length?`<div class="active-list">${active.join('')}</div>`:`<div class="empty">Nothing is running yet. Pick a skill and start training.</div>`}</section>
    <section class="stat-strip"><div><b>${fmt(state.stats.actions)}</b><span>actions</span></div><div><b>${fmt(state.stats.kills)}</b><span>wins</span></div><div><b>${fmt(state.stats.captures)}</b><span>pets tamed</span></div><div><b>${fmt(state.stats.processed)}</b><span>processed</span></div></section>`;
}
function actionBar(a){if(!a)return'';const now=Date.now(),int=a.intervalMs||5000,left=Math.max(0,(a.nextAt||now)-now),pct=100-left/int*100;return `<div class="action-progress"><span style="width:${Math.max(0,Math.min(100,pct))}%"></span></div>`;}
function renderSkills(){
  const cards=GATHER.map(id=>{const def=SKILLS.find(s=>s.id===id)||{name:id,description:''},info=skillInfo(id);return `<button class="skill-card ${stateUi.skill===id?'selected':''}" data-skill="${id}"><div class="skill-icon">${skillIcon(id)}</div><div><small>${esc(def.name)}</small><strong>${info.level}</strong>${progress(info)}</div></button>`;}).join('');
  return `${pageHead('SKILLS','Train forever.','You train one action at a time. Pets can independently work the same skill or a different one.')}
    <div class="skill-layout"><aside class="skill-grid">${cards}</aside><section class="skill-detail">${renderSkillDetail(stateUi.skill)}</section></div>`;
}
function skillIcon(id){return ({woodcutting:'🪓',mining:'⛏',foraging:'🌿',fishing:'🎣',mischief:'🦝',processing:'⚙',cooking:'🍲',crafting:'🔨'})[id]||'✦';}
function renderSkillDetail(id){
  const def=SKILLS.find(s=>s.id===id)||{name:id,description:''},info=skillInfo(id);
  let tasks=[];
  if(['cooking','crafting'].includes(id))tasks=RECIPES.filter(r=>r.skill===id);
  else if(id==='processing')tasks=[{id:'remains',name:'Process Battle Remains',level:1,duration:10,xp:18,special:'processing'}];
  else tasks=ACTIVITIES.filter(a=>a.skill===id);
  const processingPanel=id==='processing'?processingQueuePanel():'';
  return `<div class="detail-head"><div class="skill-orb">${skillIcon(id)}</div><div><p class="eyebrow">${esc(def.name)}</p><h2>Level ${info.level}</h2><p>${esc(def.description)}</p></div></div>
    <div class="full-xp"><span>${fmt(info.progressXp)} / ${info.nextXp?fmt(info.nextXp):'MAX'} XP</span>${progress(info)}</div>${processingPanel}
    <div class="task-list">${tasks.map(t=>taskCard(id,t,info.level)).join('')}</div>`;
}
function processingQueuePanel(){
  const groups=new Map(); for(const r of state.remains){const g=groups.get(r.speciesId)||0;groups.set(r.speciesId,g+1);}
  const workers=Object.entries(state.petAssignments).filter(([,a])=>a.type==='processing').map(([id,a])=>({p:state.pets.find(x=>x.id===id),a})).filter(x=>x.p);
  const keeper=state.keeperAssignment?.type==='processing'?state.keeperAssignment:null;
  return `<section class="processing-board"><div class="processing-summary"><div><small>REMAINS WAITING</small><strong>${state.remains.length}</strong></div><div><small>PROCESSORS</small><strong>${workers.length+(keeper?1:0)}</strong></div><div><small>COMPLETED</small><strong>${fmt(state.stats.processed)}</strong></div></div>
    <div class="processing-columns"><div><h3>Queue</h3>${groups.size?`<div class="remains-list">${[...groups.entries()].map(([id,n])=>{const sp=SPECIES_BY_ID[id];return `<div class="remain-row"><div class="tiny-art">${art(sp)}</div><span><b>${esc(sp.name)}</b><small>${esc(sp.region)} · gives ${Object.entries(sp.materials||{}).map(([iid,q])=>`${q} ${itemName(iid)}`).join(', ')}</small></span><strong>×${n}</strong></div>`;}).join('')}</div>`:'<div class="empty compact">No remains waiting. Combat adds one after every victory.</div>'}</div>
    <div><h3>Working now</h3><div class="processor-list">${keeper?`<div class="processor-row">${keeperAvatar()}<span><b>Keeper</b><small>~10s per remain</small></span></div>`:''}${workers.map(({p,a})=>{const sp=SPECIES_BY_ID[p.speciesId];return `<div class="processor-row"><div class="tiny-art">${art(sp)}</div><span><b>${esc(p.customName||sp.name)}</b><small>Processing aptitude ${sp.aptitudes?.processing||1} · ${time(a.intervalMs||10000)} each</small></span></div>`;}).join('')||(!keeper?'<div class="empty compact">No one assigned yet.</div>':'')}</div></div></div></section>`;
}
function taskCard(skill,t,level){
  const locked=level<t.level, type=t.special==='processing'?'processing':(['cooking','crafting'].includes(skill)?'recipe':'activity');
  const rewards=t.output||t.rewards||{};const costs=t.ingredients||{};
  const rewardText=Object.entries(rewards).map(([id,q])=>`${q} ${itemName(id)}`).join(' · ')||(type==='processing'?'Materials from the defeated species':'');
  const costText=Object.entries(costs).map(([id,q])=>`${q} ${itemName(id)}`).join(' · ');
  const keeperHere=state.keeperAssignment?.type===type && state.keeperAssignment?.targetId===(type==='processing'?'remains':t.id);
  const workerIds=Object.entries(state.petAssignments).filter(([,a])=>a.type===type&&a.targetId===(type==='processing'?'remains':t.id)).map(([id])=>id);
  const mk=`${type}:${type==='processing'?'remains':t.id}`, mastery=masteryLevel(state,mk);
  return `<article class="task ${locked?'locked':''}"><div class="task-top"><div><small>LEVEL ${t.level} · ${t.duration||10}s base · MASTERY ${mastery}/99</small><h3>${esc(t.name)}</h3></div><span class="reward">${esc(rewardText)}</span></div>${costText?`<p class="cost">Uses: ${esc(costText)}</p>`:''}
    <div class="task-actions"><button class="btn ${keeperHere?'danger':'primary'}" data-keeper-task="${type}|${type==='processing'?'remains':t.id}" ${locked?'disabled':''}>${keeperHere?'Stop Keeper':'Train this'}</button><button class="btn" data-pet-picker="${type}|${type==='processing'?'remains':t.id}" ${locked?'disabled':''}>Assign pet</button>${workerIds.length?`<span class="worker-chip">🐾 ${workerIds.length} working</span>`:''}</div></article>`;
}
function renderPets(){
  const regionProgress=REGIONS.map(r=>{const total=PET_SPECIES.filter(p=>p.region===r.id).length,found=PET_SPECIES.filter(p=>p.region===r.id&&state.discoveries.includes(p.id)).length;return `<div><small>${esc(r.name)}</small><b>${found}/${total}</b></div>`;}).join('');
  return `${pageHead('YOUR COMPANIONS','Pet Den',`${state.pets.length} / ${denCapacity(state)} spaces used · ${state.discoveries.length}/${PET_SPECIES.length} species discovered.`)}
    <section class="taming-guide"><div><p class="eyebrow">HOW TO TAME</p><h2>Fight → win → offer food → roll the tame chance</h2><p>Open Combat, enable <b>Auto-tame</b>, and choose an offering. Every victory can attempt a tame. Species have different base chances; cooked meals and Pet Mastery improve them. Duplicates are allowed because extra pets are useful workers.</p></div><div class="collection-progress">${regionProgress}</div></section>
    <div class="pet-grid">${state.pets.map(p=>petCard(p)).join('')}</div>`;
}
function petCard(p){const sp=SPECIES_BY_ID[p.speciesId],st=scaledPetStats(p),hp=Math.round(p.currentHp||0),down=hp<=0,a=state.petAssignments[p.id],fighting=state.combat?.petIds?.includes(p.id);const apt=Object.entries(sp.aptitudes||{}).sort((a,b)=>b[1]-a[1]).slice(0,3);
  return `<article class="pet-card ${down?'downed':''}"><div class="pet-portrait">${art(sp)}</div><div class="pet-body"><div class="pet-title"><div><small>${esc(sp.affinity)} · ${esc(sp.acquisition)}</small><h3>${esc(p.customName||sp.name)}</h3></div><b>Lv ${p.level}</b></div><div class="hpbar"><span style="width:${st.hp?hp/st.hp*100:0}%"></span></div><small>${hp} / ${st.hp} HP ${down?'· DOWNED':''}</small><div class="aptitudes">${apt.map(([id,n])=>`<span>${esc(id)} ${n}</span>`).join('')}</div><p class="passive"><b>${esc(sp.ability.name)}</b> — combat ability · <b>${esc(sp.passive.name)}</b> — ${esc(sp.passive.description)}</p><div class="bond-line"><span>Bond</span><b>${Math.min(100,p.level)}%</b></div><div class="pet-actions">${down?healingButtons(p.id):`<button class="btn small" data-pet-work="${p.id}">${a?'Change work':'Assign work'}</button>`}${a?`<button class="btn small danger" data-stop-pet="${p.id}">Stop</button>`:''}${fighting?'<span class="status-chip">⚔ Fighting</span>':''}</div></div></article>`;}
function healingButtons(petId){const foods=ownedHealing().slice(0,3);return foods.length?foods.map(([id,q])=>`<button class="btn small heal" data-heal-pet="${petId}|${id}">${esc(itemName(id))} (${q}) +${ITEMS[id].heal}</button>`).join(''):'<span class="danger-text">No healing food or tonics. Gather berries or buy/cook food.</span>';}
function renderInventory(){
  const entries=Object.entries(state.inventory).filter(([,q])=>q>0).sort((a,b)=>(ITEMS[a[0]]?.category||'').localeCompare(ITEMS[b[0]]?.category||'')||itemName(a[0]).localeCompare(itemName(b[0])));
  return `${pageHead('STORAGE','Inventory','Raw food is useful immediately; cooked food is stronger. Equipment can be equipped here.')}
    <div class="inventory-grid">${entries.map(([id,q])=>itemCard(id,q)).join('')}</div>`;
}
function itemCard(id,q){const it=ITEMS[id]||{name:itemName(id),category:'item'};const eq=Object.values(state.equipment).includes(id);return `<article class="item-card"><div class="item-icon">${categoryIcon(it.category)}</div><div><small>${esc(it.category||'item')}</small><h3>${esc(it.name)}</h3><b>×${fmt(q)}</b>${it.heal?`<p>Restores ${it.heal} HP.</p>`:''}${it.slot?`<p>${eq?'Equipped':'Equipment · '+it.slot}</p>`:''}<div class="item-actions">${it.heal?`<button class="mini-btn" data-use-item="${id}">Use</button>`:''}${it.slot&&!eq?`<button class="mini-btn" data-equip="${id}">Equip</button>`:''}</div></div></article>`;}
function categoryIcon(c){return ({meal:'🍲',ingredient:'🌿',medicine:'✚',material:'◆',weapon:'⚔',armor:'🛡',tool:'⌁',supply:'🎒'})[c]||'◇';}
function captureOfferings(){return Object.entries(state.inventory).filter(([id,q])=>q>0&&ITEMS[id]?.captureBonus!==undefined).sort((a,b)=>(ITEMS[b[0]].captureBonus||0)-(ITEMS[a[0]].captureBonus||0));}
function renderCombat(){
  if(state.combat)return renderActiveCombat();
  const living=state.pets.filter(p=>p.currentHp>0&&!state.petAssignments[p.id]); const offerings=captureOfferings();
  return `${pageHead('CONTINUOUS COMBAT','The Wilds','Pick a region, party, combat style, and taming offering. Battles chain continuously with no search timer.')}
    <section class="combat-setup-card"><div class="combat-options"><label>Region<select id="combat-region" class="input">${REGIONS.map(r=>`<option value="${r.id}" ${stateUi.region===r.id?'selected':''}>${r.name} · Combat ${r.level}+</option>`).join('')}</select></label><label>Keeper style<select id="combat-style" class="input"><option value="melee">Melee</option><option value="ranged">Ranged</option><option value="magic">Magic</option></select></label></div>
      <div class="toggle-row"><label class="check"><input id="combat-keeper" type="checkbox" ${stateUi.combatKeeper?'checked':''}/> Keeper fights</label><label class="check"><input id="combat-autoeat" type="checkbox" checked/> Auto-eat</label><label class="check"><input id="combat-autotame" type="checkbox" checked/> Auto-tame</label></div>
      <div class="taming-box"><div><b>🐾 Taming</b><small>After a victory, Auto-tame uses one offering and rolls the species' tame chance. Better food and Pet Mastery improve the odds.</small></div><label>Offering<select id="combat-offering" class="input"><option value="">No offering</option>${offerings.map(([id,q])=>`<option value="${id}">${itemName(id)} ×${q} · +${Math.round((ITEMS[id].captureBonus||0)*100)}%</option>`).join('')}</select></label></div>
      <h3>Choose up to ${MAX_COMBAT_PETS} pets</h3><div class="party-picker">${living.map(p=>{const sp=SPECIES_BY_ID[p.speciesId],st=scaledPetStats(p);return `<label class="party-pick ${stateUi.selectedCombat.has(p.id)?'selected':''}"><input type="checkbox" data-combat-pet value="${p.id}" ${stateUi.selectedCombat.has(p.id)?'checked':''}/><div class="tiny-art">${art(sp)}</div><span><b>${esc(p.customName||sp.name)}</b><small>Lv ${p.level} · ${sp.affinity} · Power ${st.power}</small></span></label>`;}).join('')}</div><div class="combat-start"><div><small>Party power</small><strong id="party-power">${partyPowerFor(state,[...stateUi.selectedCombat],stateUi.combatKeeper)}</strong></div><button id="start-combat" class="btn primary big">Start fighting</button></div></section>`;
}
function renderActiveCombat(){const c=state.combat,e=c.enemy,sp=e?SPECIES_BY_ID[e.speciesId]:null;const region=REGIONS.find(r=>r.id===c.regionId);const party=c.petIds.map(id=>state.pets.find(p=>p.id===id)).filter(Boolean);const offer=c.captureItemId?ITEMS[c.captureItemId]:null;const tame=sp?captureChanceFor(state,sp.id,c.autoTame?c.captureItemId:''):0;const events=[...(c.events||[])].reverse().slice(0,7);
  return `${pageHead(c.dungeonId?'DUNGEON FIGHT':'LIVE COMBAT',c.dungeonId?(DUNGEONS.find(d=>d.id===c.dungeonId)?.name||'Dungeon'):region?.name||'The Wilds',c.state==='stopped'?'Your party is down. Heal them and resume when ready.':'Attacks, crits, affinities, abilities, taming, and the next enemy all resolve live.',`<button id="stop-combat" class="btn danger">Stop combat</button>`)}
    <section class="battle-stage ${c.state==='stopped'?'battle-stopped':''} ${c.lastEvent?.kind||''}"><div class="battle-status"><span class="live-dot"></span><b>${c.state==='between'?'Next enemy…':c.state==='stopped'?'Party down':'FIGHTING'}</b><small>Battle ${c.battle||1} · Streak ${c.streak||0} · Best ${state.stats.bestStreak||0}</small></div>
      <div class="battle-grid"><div class="fighters"><p class="eyebrow">YOUR PARTY</p>${c.includeKeeper?keeperFighter(c.style):''}${party.map(p=>fighterCard(p)).join('')}</div><div class="versus">⚔</div><div class="enemy-panel">${sp?`<div class="enemy-art">${art(sp,'enemy-img')}</div><h2>${esc(sp.name)}</h2><div class="enemy-meta"><span>${esc(sp.affinity)}</span><span>${esc(sp.acquisition)}</span></div><div class="hpbar enemy"><span style="width:${e.maxHp?e.hp/e.maxHp*100:0}%"></span></div><b>${Math.max(0,Math.ceil(e.hp))} / ${e.maxHp} HP</b><div class="tame-live"><b>🐾 ${Math.round(tame*100)}% tame chance</b><small>${c.autoTame?(offer?`${offer.name} ×${state.inventory[c.captureItemId]||0}`:'No offering selected'):'Auto-tame off'}</small></div>`:'<div class="searchless"><span>⚔</span><b>Next fight</b></div>'}</div></div>
      <div class="combat-feed-grid"><div class="battle-flash"><strong>${esc(c.lastEvent?.text||'Battle underway…')}</strong><small>${c.autoEat?'Auto-eat on':'Auto-eat off'} · ${c.autoTame?'Auto-tame on':'Auto-tame off'} · ${state.remains.length} remains waiting</small></div><div class="combat-log"><p class="eyebrow">RECENT ACTIONS</p>${events.length?events.map(ev=>`<div class="combat-log-row ${ev.kind}"><span>${eventIcon(ev.kind)}</span><b>${esc(ev.text)}</b></div>`).join(''):'<small>Combat actions will appear here.</small>'}</div></div>
      ${c.state==='stopped'?`<div class="resume-box"><p>Heal the downed fighters in the Pet Den or heal the Keeper, then resume.</p><button id="resume-combat" class="btn primary">Resume combat</button></div>`:''}</section>`;
}
function eventIcon(kind){return ({crit:'✦',ability:'✧',enemy:'☠',capture:'🐾',win:'✓',down:'!',hit:'⚔'})[kind]||'•';}
function keeperFighter(style='melee'){const hp=state.profile.currentHp,max=state.profile.maxHp;return `<div class="fighter-card keeper-fighter">${keeperAvatar()}<div><b>${esc(state.profile.displayName||'Keeper')}</b><small>${style.toUpperCase()} · ${Math.round(hp)} / ${max} HP</small><div class="hpbar"><span style="width:${hp/max*100}%"></span></div></div></div>`;}
function fighterCard(p){const sp=SPECIES_BY_ID[p.speciesId],max=scaledPetStats(p).hp;return `<div class="fighter-card"><div class="tiny-art">${art(sp)}</div><div><b>${esc(p.customName||sp.name)}</b><small>${Math.round(p.currentHp)} / ${max} HP</small><div class="hpbar"><span style="width:${p.currentHp/max*100}%"></span></div></div></div>`;}
function renderDungeons(){const combat=skillLevel(state,'combat');return `${pageHead('BOSS PROGRESSION','Dungeons','Dungeons are combat encounters, not hour-long timers. Meet the level, bring the key, and fight the boss live.')}
  <div class="dungeon-list">${DUNGEONS.map(d=>{const sp=SPECIES_BY_ID[d.encounter],locked=combat<d.level;return `<article class="dungeon-card ${locked?'locked':''}"><div class="dungeon-art">${art(sp)}</div><div><small>COMBAT ${d.level} · POWER ${d.recommendedPower}</small><h2>${esc(d.name)}</h2><p>Boss: ${esc(sp.name)} · Favored affinity: ${esc(d.favored)}</p><p class="cost">Entry: ${Object.entries(d.entry||{}).map(([id,q])=>`${q} ${itemName(id)}`).join(' · ')||'Free'}</p><p class="reward">Rewards: ${Object.entries(d.rewards||{}).map(([id,q])=>`${q} ${itemName(id)}`).join(' · ')}</p><button class="btn primary" data-dungeon="${d.id}" ${locked?'disabled':''}>${locked?`Combat ${d.level} required`:'Choose party & enter'}</button></div></article>`;}).join('')}</div>`;}
function renderUpgrades(){return `${pageHead('PERMANENT PROGRESSION','Den Upgrades','Spend materials on permanent upgrades. No construction session timer—if you can afford it, you build it.')}
  <div class="upgrade-grid">${BUILDINGS.map(b=>{const lv=state.buildings[b.id]||0,done=!b.repeatable&&lv>=1,max=b.repeatable&&lv>=b.maxLevel,mult=1+Math.floor(lv/2)*.55,cost=Object.entries(b.costs||{}).map(([id,q])=>`${Math.ceil(q*mult)} ${itemName(id)}`).join(' · ');return `<article class="upgrade-card"><small>${b.repeatable?`LEVEL ${lv}/${b.maxLevel}`:lv?'BUILT':'PERMANENT'}</small><h2>${esc(b.name)}</h2><p>${esc(b.description)}</p><p class="cost">${esc(cost)}</p><button class="btn primary" data-build="${b.id}" ${done||max?'disabled':''}>${done||max?'Complete':'Build now'}</button></article>`;}).join('')}</div>`;}

function bindScreen(){
  $$('[data-go]').forEach(b=>b.onclick=()=>{stateUi.screen=b.dataset.go;renderNav();render();});
  $$('[data-stop-keeper]').forEach(b=>b.onclick=()=>setState(stopKeeperAssignment(state),'Keeper stopped.'));
  $$('[data-stop-pet]').forEach(b=>b.onclick=()=>setState(stopPetAssignment(state,b.dataset.stopPet),'Pet stopped.'));
  $$('[data-skill]').forEach(b=>b.onclick=()=>{stateUi.skill=b.dataset.skill;render();});
  $$('[data-keeper-task]').forEach(b=>b.onclick=()=>{const [type,id]=b.dataset.keeperTask.split('|');const current=state.keeperAssignment;if(current?.type===type&&current?.targetId===id)setState(stopKeeperAssignment(state),'Keeper stopped.');else try{setState(startKeeperAssignment(state,type,id),'Keeper started working.');}catch(e){toast(e.message);}});
  $$('[data-pet-picker]').forEach(b=>b.onclick=()=>{const [type,id]=b.dataset.petPicker.split('|');openPetPicker(type,id);});
  $$('[data-pet-work]').forEach(b=>b.onclick=()=>openWorkPicker(b.dataset.petWork));
  $$('[data-heal-pet]').forEach(b=>b.onclick=()=>{const [pet,id]=b.dataset.healPet.split('|');try{setState(useHealingItem(state,id,{petId:pet}),`${itemName(id)} used.`);}catch(e){toast(e.message);}});
  $$('[data-use-item]').forEach(b=>b.onclick=()=>openHealTarget(b.dataset.useItem));
  $$('[data-equip]').forEach(b=>b.onclick=()=>{try{setState(equipItem(state,b.dataset.equip),'Equipped.');}catch(e){toast(e.message);}});
  $$('[data-build]').forEach(b=>b.onclick=()=>{try{setState(buildUpgrade(state,b.dataset.build),'Upgrade built.');}catch(e){toast(e.message);}});
  if($('#combat-region'))$('#combat-region').onchange=e=>{stateUi.region=e.target.value;};
  if($('#combat-keeper'))$('#combat-keeper').onchange=e=>{stateUi.combatKeeper=e.target.checked;updatePower();};
  $$('[data-combat-pet]').forEach(cb=>cb.onchange=()=>{if(cb.checked){if(stateUi.selectedCombat.size>=MAX_COMBAT_PETS){cb.checked=false;toast(`Choose up to ${MAX_COMBAT_PETS} pets.`);return;}stateUi.selectedCombat.add(cb.value);}else stateUi.selectedCombat.delete(cb.value);render();});
  if($('#start-combat'))$('#start-combat').onclick=()=>{try{setState(startCombat(state,{regionId:$('#combat-region').value,petIds:[...stateUi.selectedCombat],includeKeeper:$('#combat-keeper').checked,style:$('#combat-style').value,autoEat:$('#combat-autoeat').checked,autoTame:$('#combat-autotame').checked,captureItemId:$('#combat-offering').value}),'Combat started.');}catch(e){toast(e.message);}};
  if($('#stop-combat'))$('#stop-combat').onclick=()=>setState(stopCombat(state),'Combat stopped.');
  if($('#resume-combat'))$('#resume-combat').onclick=()=>setState(resumeCombat(state),'Combat resumed.');
  $$('[data-dungeon]').forEach(b=>b.onclick=()=>openDungeonParty(b.dataset.dungeon));
}
function updatePower(){const el=$('#party-power');if(el)el.textContent=partyPowerFor(state,[...stateUi.selectedCombat],stateUi.combatKeeper);}
function openPetPicker(type,targetId){
  const eligible=state.pets.filter(p=>p.currentHp>0&&!state.combat?.petIds?.includes(p.id));
  openModal(`<p class="eyebrow">ASSIGN PET</p><h2>${type==='processing'?'Process Remains':esc((type==='recipe'?RECIPES:ACTIVITIES).find(x=>x.id===targetId)?.name||'Work')}</h2><div class="modal-list">${eligible.map(p=>{const sp=SPECIES_BY_ID[p.speciesId],apt=sp.aptitudes?.[(type==='recipe'?(RECIPES.find(r=>r.id===targetId)?.skill):type==='processing'?'processing':ACTIVITIES.find(a=>a.id===targetId)?.skill)]||1;return `<button class="modal-pet" data-pick-pet="${p.id}"><div class="tiny-art">${art(sp)}</div><span><b>${esc(p.customName||sp.name)}</b><small>Aptitude ${apt} · Lv ${p.level}${state.petAssignments[p.id]?' · replaces current job':''}</small></span></button>`;}).join('')}</div>`);
  $$('[data-pick-pet]',$('#modal')).forEach(b=>b.onclick=()=>{try{state=startPetAssignment(state,b.dataset.pickPet,type,targetId);saveSoon();$('#modal').close();render();toast('Pet assigned.');}catch(e){toast(e.message);}});
}
function openWorkPicker(petId){const p=state.pets.find(x=>x.id===petId),sp=SPECIES_BY_ID[p.speciesId];openModal(`<p class="eyebrow">${esc(p.customName||sp.name)}</p><h2>Choose work</h2><p>Pick a skill first; you can then choose the exact unlocked action.</p><div class="modal-skill-grid">${GATHER.map(id=>`<button data-work-skill="${id}" class="modal-skill"><span>${skillIcon(id)}</span><b>${esc(SKILLS.find(s=>s.id===id)?.name||id)}</b><small>Aptitude ${sp.aptitudes?.[id]||1}</small></button>`).join('')}</div>`);$$('[data-work-skill]',$('#modal')).forEach(b=>b.onclick=()=>{$('#modal').close();stateUi.screen='skills';stateUi.skill=b.dataset.workSkill;renderNav();render();toast('Choose the action, then tap Assign pet.');});}
function openHealTarget(itemId){const item=ITEMS[itemId];openModal(`<p class="eyebrow">USE ${esc(item.name)}</p><h2>Restore ${item.heal} HP</h2><div class="modal-list"><button class="modal-pet" data-heal-target="keeper">${keeperAvatar()}<span><b>Keeper</b><small>${Math.round(state.profile.currentHp)} / ${state.profile.maxHp} HP</small></span></button>${state.pets.map(p=>{const sp=SPECIES_BY_ID[p.speciesId],max=scaledPetStats(p).hp;return `<button class="modal-pet" data-heal-target="${p.id}"><div class="tiny-art">${art(sp)}</div><span><b>${esc(p.customName||sp.name)}</b><small>${Math.round(p.currentHp)} / ${max} HP</small></span></button>`;}).join('')}</div>`);$$('[data-heal-target]',$('#modal')).forEach(b=>b.onclick=()=>{try{state=useHealingItem(state,itemId,b.dataset.healTarget==='keeper'?{keeper:true}:{petId:b.dataset.healTarget});saveSoon();$('#modal').close();render();}catch(e){toast(e.message);}});}
function openDungeonParty(dungeonId){const d=DUNGEONS.find(x=>x.id===dungeonId),living=state.pets.filter(p=>p.currentHp>0&&!state.petAssignments[p.id]);openModal(`<p class="eyebrow">${esc(d.name)}</p><h2>Choose party</h2><p>Recommended power ${d.recommendedPower}. The fight begins immediately.</p><label class="check"><input id="d-keeper" type="checkbox" checked/> Keeper fights</label><div class="modal-list">${living.map(p=>{const sp=SPECIES_BY_ID[p.speciesId];return `<label class="modal-pet"><input type="checkbox" data-d-pet value="${p.id}"/><div class="tiny-art">${art(sp)}</div><span><b>${esc(p.customName||sp.name)}</b><small>Power ${scaledPetStats(p).power}</small></span></label>`;}).join('')}</div><button id="enter-dungeon" class="btn primary wide">Enter dungeon</button>`);$('#enter-dungeon').onclick=()=>{const ids=$$('[data-d-pet]',$('#modal')).filter(x=>x.checked).slice(0,MAX_COMBAT_PETS).map(x=>x.value);try{state=startDungeon(state,dungeonId,ids,$('#d-keeper').checked);saveSoon();$('#modal').close();stateUi.screen='combat';renderNav();render();}catch(e){toast(e.message);}};}
function openAccount(){openModal(`<p class="eyebrow">ACCOUNT</p><h2>${stateUi.user?esc(stateUi.user.email||stateUi.user.displayName||'Signed in'):'Local save'}</h2><p>${stateUi.cloud?'Your save syncs to your private Firestore player document.':'This game is saved in this browser.'}</p><button id="save-now" class="btn primary wide">Save now</button>${stateUi.user?'<button id="signout" class="btn wide">Sign out</button>':''}`);$('#save-now').onclick=()=>{saveSoon();toast('Saved.');};if($('#signout'))$('#signout').onclick=async()=>{await signOutCloud();stateUi.cloud=false;stateUi.user=null;state=null;$('#modal').close();showAuth();};}
function openModal(html){$('#modal-body').innerHTML=html;$('#modal').showModal();}

document.addEventListener('visibilitychange',()=>{if(document.hidden&&state){state.lastSeenAt=Date.now();saveSoon();}});
window.addEventListener('beforeunload',()=>{if(state)localStorage.setItem(LOCAL_KEY,JSON.stringify(state));});
setInterval(()=>{
  if(!state||$('#game').classList.contains('hidden'))return;
  if(state.combat&&stateUi.screen==='combat'&&!document.hidden){state=advanceLive(state,Date.now());saveSoon();render();}
  else if(Date.now()-stateUi.lastRender>900)render();
},300);
init();
