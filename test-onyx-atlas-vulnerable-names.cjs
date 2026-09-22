"use strict";
const fs=require("node:fs");
const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,name),"utf8");

const win = {addEventListener(){},localStorage:{getItem(){return null;}}};
new Function("globalThis",read("onyx-atlas-castle-hunter-core.js"))(win);
new Function("window","document",read("onyx-atlas-castle-hunter.js"))(win,{});
const hunter = win.OnyxAtlasCastleHunter;
const now = 1800000000;
const old = {coordinate:"22-A55-0",name:"22-A55-0",source:"official",infoObservedAt:now,shield:{state:"down",observedAt:now}};
const fresh = {coordinate:"22-A55-1",name:"Real castle",source:"official",infoObservedAt:now,shield:{state:"down",observedAt:now}};
const next = {coordinate:"22-A55-2",name:"",source:"official",shield:{state:"unknown"}};
function check(ok,message){if(!ok)throw Error(message);}
const value={records:[old,fresh,next]};
const targets=hunter.castleNameTargets(value,[next,old],now);
check(targets.length===3,"Deduplicate candidates and vulnerable board");
check(targets[0]===old,"Earlier vulnerable result prioritised");
const batches=hunter.castleDetailBatches(targets,now);
check(JSON.stringify(batches)==='[["22-A55-0","22-A55-2"]]',"Retry ID placeholders even with fresh info timestamp");
const updated={...old,name:"Recovered Keep",infoObservedAt:now};
check(hunter.castleNameTargets({records:[updated]},[old],now)[0]===updated,"Use latest snapshot not stale candidate");
check(hunter.castleDetailBatches([updated],now).length===0,"Do not refetch fresh real name");
const merged=win.OnyxAtlasCore.mergeOfficialInfo(value,{records:[{coordinate:old.coordinate,available:true,name:"Recovered Keep",observedAt:now}]});
check(hunter.toCommandSnapshot(merged,now).castles[0].name==="Recovered Keep","Name reaches Overview and Castles");
const rows=Array.from({length:251},(_,i)=>({...next,coordinate:"22-A55-"+i}));
check(hunter.castleDetailBatches(rows,now).map(b=>b.length).join(",")==="25,25,25,25,25,25,25,25,25,25,1","Keep API batch limit");

check(hunter.castleDetailBatches([{...updated,infoObservedAt:now-86400*30}],now).length===0,"Reuse saved names beyond the old hourly expiry");
check(hunter.castleDetailBatches([{...updated,infoObservedAt:null}],now).length===0,"Imported real names do not consume lookup budget");
const scanSource=read("onyx-atlas-castle-hunter.js").split("async function refreshOfficialAtlas")[1];
check(scanSource.indexOf("await requestCriticalBatch") < scanSource.indexOf("await loadCastleDetails"),"Fresh critical checks precede name requests");

console.log("Vulnerable castle name regression checks passed.");
