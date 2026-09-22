"use strict";
const fs=require("node:fs");const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,name),"utf8");
(async()=>{
const panel={textContent:"",hidden:true,dataset:{}};
let calls=0,limited=false;
const win={panel,addEventListener(){},setTimeout(fn){fn();},localStorage:{getItem(){return null;},setItem(){}},OnyxAtlasCore:{mergeOfficialInfo(value){return value;}},OnyxWarDragonsAPI:{async atlasInfo(ids){
calls++;if(!limited){limited=true;throw Object.assign(new Error("limit"),{code:"info-rate-limited",status:429,retryAfterMs:1000});}
if(ids.length>5||ids.includes("22-A55-3"))throw Object.assign(new Error("rejected"),{code:"atlas-live-unavailable",status:400});
return {records:ids.map(coordinate=>({coordinate,available:true,name:"Castle "+coordinate}))};}}};
let source=read("onyx-atlas-castle-hunter.js").replace("    nameFailureSummary,","    nameFailureSummary,\n    loadCastleDetails,\n    setup: value => {snapshot=value;host={querySelector:()=>window.panel};},")
.replaceAll("applyFilters({ persist: false });","void 0;").replaceAll("syncAtlasCommandSnapshot(snapshot);","void 0;").replaceAll("await cacheSnapshot(snapshot).catch(() => undefined);","void 0;");
new Function("window","document",source)(win,{});
const h=win.OnyxAtlasCastleHunter,records=Array.from({length:30},(_,i)=>({coordinate:"22-A55-"+i,name:""}));
h.setup({records});
function check(ok,message){if(!ok)throw Error(message);}
check(h.castleDetailBatches(records).map(b=>b.length).join(",")==="25,5","Initial batches");
const note=await h.loadCastleDetails(records);
check(note.includes("29 names loaded"),"Recovery: "+note);
check(panel.textContent.includes("30 requested"),"Unique requests");
check(panel.textContent.includes("22-A55-3")&&panel.textContent.includes("HTTP 400"),"Rejected ID");
check(calls<40,"Bounded queue");

console.log("Adaptive name batch checks passed.");})().catch(error=>{console.error(error);process.exitCode=1;});
