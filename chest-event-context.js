/* One shared event and armoury selection for chest rates, budgets and sequences. */
(function(window){
 'use strict';
 let selected='assault';
 function raw(){
  const event=window.currentEventData, bundled=window.OnyxCurrentChestEvent, now=Date.now();
  if(bundled&&now>=Date.parse(bundled.validFrom)&&now<Date.parse(bundled.validUntil)
    &&(!event?.ready||!event.importedAt||Date.parse(event.importedAt)<=Date.parse(bundled.importedAt)))return bundled;
  if(bundled&&now>=Date.parse(bundled.validUntil)&&event?.doubleArmory?.sides?.assault?.eventKey===bundled.doubleArmory.sides.assault.eventKey)return null;
  return event||null;
 }
 function getArmory(){try{return localStorage.getItem('onyxChestArmory:'+(window.OnyxCommandCore?.getCurrentUserId?.()||window.OnyxDevicePlayer?.getId?.()||''))||selected;}catch(_){return selected;}}
 function getData(){
  const event=raw(),armory=getArmory(),da=event?.doubleArmory,side=da?.sides?.[armory];
  if(!da?.ready||!side)return event;
  const types=event.availableChestTypes?.length?event.availableChestTypes:da.availableChestTypes;
  const chests=Object.fromEntries(Object.entries(side.chests).map(([type,c])=>[type,{...event.chests?.[type],...c,key:c.mainKey,found:c.ready,available:types.includes(type),deck:side.decks[c.mainKey],deckLength:side.decks[c.mainKey]?.length||0,bonusVerification:c.bonusKey?{verified:true,poolKey:c.bonusKey}:undefined}]));
  return {...event,event:`${event.event||'Double Assault'} · ${armory==='assault'?'Assault':'Breeding'} armoury`,decks:side.decks,drops:side.drops,chests,availabilityKnown:true,availableChestTypes:types};
 }
 function mountSelector(overlay,render){
  if(!raw()?.doubleArmory?.ready||!overlay)return;
  const host=overlay.querySelector('.cdr-body,.cp-body,.nct-body')||overlay.firstElementChild;
  if(!host)return;
  const label=document.createElement('label');label.style.cssText='display:block;padding:12px;color:inherit';label.textContent='Armoury for rates and estimates: ';
  const select=document.createElement('select');select.style.cssText='padding:10px;background:#171717;color:#eee;border:1px solid #a8873a;border-radius:8px';
  select.innerHTML='<option value="assault">Assault</option><option value="breeding">Breeding</option>';select.value=getArmory();
  select.addEventListener('change',()=>{selected=select.value;try{localStorage.setItem('onyxChestArmory:'+(window.OnyxCommandCore?.getCurrentUserId?.()||window.OnyxDevicePlayer?.getId?.()||''),selected);}catch(_){}render();});
  label.appendChild(select);host.prepend(label);
 }
 window.OnyxChestContext=Object.freeze({getRaw:raw,getData,getArmory,mountSelector});
})(window);
