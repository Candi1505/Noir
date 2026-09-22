"use strict";
const fs=require("node:fs");
const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,name),"utf8");

const win={addEventListener(){},localStorage:{getItem(){return null;}}};
new Function("globalThis",read("onyx-atlas-castle-hunter-core.js"))(win);
new Function("window","document",read("onyx-atlas-castle-hunter.js"))(win,{});
const hunter=win.OnyxAtlasCastleHunter;
const now=Date.now()/1000;
const original={lastLiveAt:now,atlas:{topologySource:"official-metadata",playerApr:17,gloryObservedAt:now},records:[{
coordinate:"22-A55-0",name:"Real Keep",ownerTeam:"Enemy",source:"official",tier:2,rawLevel:1,apr:102,
checked:true,criticalObservedAt:now,guards:1234,fleetCount:2,primarchs:[{troops:5000}],officialFort:{level:3},
shield:{state:"down",observedAt:now},gloryPercent:68,gloryObservedAt:now}]};
function check(ok,message){if(!ok)throw Error(message);}
const cleared=hunter.resetScanSnapshot(original),record=cleared.records[0];
check(record.name==="Real Keep" && record.coordinate==="22-A55-0","Preserve names and catalogue");
check(!record.checked && record.criticalObservedAt===null,"Reset checked count");
check(record.guards===null && record.fleetCount===null && record.primarchs.length===0,"Clear live troops");
check(record.officialFort===null && record.shield.state==="unknown","Clear shield evidence");
check(record.gloryPercent===null && cleared.atlas.gloryObservedAt===null,"Clear glory evidence");
check(original.records[0].checked && original.records[0].guards===1234,"Do not mutate previous snapshot");
const castle=hunter.toCommandSnapshot(cleared,now).castles[0];
check(castle.shieldState==="unknown" && castle.gloryPercent===null && castle.troops===null,"Clear Overview and Castles");
check(hunter.withAttackingTeam(cleared,"Enemy",now).records[0].gloryPercent===null,"Selected team cannot revive cleared glory");
check(hunter.resetScanSnapshot(null)===null,"Safe before first scan");

console.log("Clear scan checks passed.");
