'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict');
const store=new Map();let now=Date.parse('2026-10-08T01:00:00Z');
const c={console,Date:class extends Date{static now(){return now}},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},document:{readyState:'loading',addEventListener(){}},addEventListener(){},OnyxCommandCore:{getCurrentUserId:()=> 'test-player'}};c.window=c;
vm.createContext(c);
for(const file of ['current-chest-event-data.js','chest-event-context.js','chest-drop-rates.js'])vm.runInContext(fs.readFileSync(file,'utf8'),c);
c.currentEventData={ready:true,importedAt:'2026-08-28T08:03:47Z',event:'Old event'};
assert.equal(c.OnyxChestContext.getRaw(),c.OnyxCurrentChestEvent);
for(const armory of ['assault','breeding']){
 store.set('onyxChestArmory:test-player',armory);
 const event=c.OnyxChestContext.getData();
 assert.equal(event.decks,c.OnyxCurrentChestEvent.doubleArmory.sides[armory].decks);
 for(const type of event.availableChestTypes){
  const rates=c.ChestDropRates.calculateChestRates(event,type);
  assert(rates.ready&&rates.bonusReady,`${armory}/${type} missing rates`);
  assert(Math.abs(rates.regular.probabilityTotal-1)<1e-9,`${armory}/${type} regular total`);
  assert(Math.abs(rates.bonus.probabilityTotal-1)<1e-9,`${armory}/${type} bonus total`);
 }
}
c.currentEventData={...c.OnyxCurrentChestEvent,importedAt:'2026-10-08T02:00:00Z'};
assert.equal(c.OnyxChestContext.getRaw(),c.currentEventData);
now=Date.parse('2026-10-14T00:00:00Z');assert.equal(c.OnyxChestContext.getRaw(),null);
console.log('Current event, both armouries, all four active chest rates/bonuses, newer import and expiry passed.');
