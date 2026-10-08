const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const nodes=new Map(),storage=new Map(),alerts=[];let user='player-one';
class El{
 constructor(){this.handlers={};this.children=new Map();this.dataset={};this.classList={contains:()=>false,add(){},remove(){}};this.style={};this.isConnected=false;this.value='0';this.checked=false;}
 set innerHTML(v){this.html=v;}get innerHTML(){return this.html??String(this.textContent||'').replaceAll('&','&amp;').replaceAll('<','&lt;');}
 querySelector(q){if(!this.children.has(q))this.children.set(q,new El());return this.children.get(q);}
 querySelectorAll(){return [];}
 addEventListener(e,f){this.handlers[e]=f;}setAttribute(){}remove(){nodes.delete(this.id);this.isConnected=false;}
 appendChild(e){nodes.set(e.id,e);e.isConnected=true;}closest(){return null;}
}
global.window=global;global.document={readyState:'loading',head:new El(),body:new El(),documentElement:new El(),createElement:()=>new El(),getElementById:id=>nodes.get(id),addEventListener(){}};
global.addEventListener=()=>{};global.MutationObserver=class{observe(){}};global.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};global.alert=x=>alerts.push(x);global.confirm=()=>true;global.chestSupabase={auth:{getSession:async()=>({data:{session:{user:{id:user}}}})}};

const side=(eventKey)=>({ready:true,eventKey,decks:{root:[0,1,2]},drops:{root:['A','B','C'].map(id=>({id,kind:'curr',mu:1,sdev:0}))},chests:{platinum:{ready:true,label:'Platinum',mainKey:'root'}}});
const shared={ready:true,availableChestTypes:['platinum'],sides:{assault:side('assault-test'),breeding:side('breeding-test')}};
global.currentEventData={doubleArmory:shared};
for(const f of ['double-armory-core.js','double-armory-planner.js'])vm.runInThisContext(fs.readFileSync(f,'utf8'),{filename:f});
const tick=()=>new Promise(r=>setTimeout(r,0));
const obs=()=>DoubleArmoryPlanner.getPlayerState().chests.platinum.observations;
async function record(index){const el=nodes.get('noirDoubleArmoryOverlay');el.querySelector('#daRewardSelect').value=String(index);el.querySelector('#daRecordButton').handlers.click();await tick();}
(async()=>{
 await DoubleArmoryPlanner.open();assert.equal(obs().length,0);await record(0);assert.equal(obs()[0].reward.code,'A');
 user='player-two';await DoubleArmoryPlanner.open();assert.equal(obs().length,0);await record(1);assert.equal(obs()[0].reward.code,'B');
 user='player-one';await DoubleArmoryPlanner.open();assert.equal(obs()[0].reward.code,'A');
 // Re-publication metadata and another player's captured positions cannot reset or seed progress.
 shared.eventName='New display title';shared.sides.assault.deckIndices={root:2};shared.sides.breeding.deckIndices={root:2};
 await DoubleArmoryPlanner.open();assert.equal(obs()[0].reward.code,'A');
 user='fresh-player';await DoubleArmoryPlanner.open();assert.equal(obs().length,0);assert.doesNotMatch(nodes.get('noirDoubleArmoryOverlay').innerHTML,/Next rewards resolved/);
 user='player-one';shared.sides.assault.eventKey='different-event';await DoubleArmoryPlanner.open();assert.equal(obs().length,0);await record(2);
 shared.sides.assault.eventKey='assault-test';await DoubleArmoryPlanner.open();assert.equal(obs()[0].reward.code,'A');
 shared.sides.assault.eventKey='different-event';await DoubleArmoryPlanner.open();assert.equal(obs()[0].reward.code,'C');
 // Existing player-only V2 saves migrate without removing the original.
 const originalSide=side=>({decks:side.decks,drops:side.drops,chests:side.chests});
 const legacyText=JSON.stringify({eventName:shared.eventName || '',eventVersion:'',assault:originalSide(shared.sides.assault),breeding:originalSide(shared.sides.breeding),chestTypes:shared.availableChestTypes});
 let hash=2166136261;for(const c of legacyText){hash^=c.charCodeAt(0);hash=Math.imul(hash,16777619);}
 const legacy=JSON.stringify({eventFingerprint:(hash>>>0).toString(36),chests:{platinum:{observations:[{armory:'assault',reward:{code:'B',amount:1}}],preferences:{}}}});
 storage.set('chestCompanionDoubleArmoryV2:legacy-player',legacy);user='legacy-player';await DoubleArmoryPlanner.open();assert.equal(obs()[0].reward.code,'B');
 assert.equal(storage.get('chestCompanionDoubleArmoryV2:legacy-player'),legacy);
 shared.eventName='Another display title';await DoubleArmoryPlanner.open();assert.equal(obs()[0].reward.code,'B');
 assert.equal(alerts.length,0);assert(storage.size>=3);
 console.log('Double Armoury player isolation, shared-deck independence, metadata refresh and event progress preservation passed.');
})().catch(e=>{console.error(e);process.exit(1)});
