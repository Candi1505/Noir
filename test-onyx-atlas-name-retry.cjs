"use strict";
const fs=require("node:fs");const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,name),"utf8");
(async()=>{
const win={addEventListener(){},setTimeout(fn){fn();},localStorage:{getItem(){return null;}}};
let calls=0;
win.OnyxWarDragonsAPI={async atlasInfo(ids){calls++;if(calls===1)throw Object.assign(new Error("limited"),{status:429});return {records:ids.map((coordinate,i)=>({coordinate,available:true,name:i===0?"Named Keep":"",observedAt:1800000000}))};}};
new Function("globalThis",read("onyx-atlas-castle-hunter-core.js"))(win);
let source=read("onyx-atlas-castle-hunter.js")
.replace("    retryableNameError,","    retryableNameError,\n    loadCastleDetails,\n    setSnapshot: value => { snapshot=value; },")
.replaceAll("applyFilters({ persist: false });","void 0;")
.replaceAll("await cacheSnapshot(snapshot).catch(() => undefined);","void 0;");
new Function("window","document",source)(win,{});
const hunter=win.OnyxAtlasCastleHunter;
const rows=[{coordinate:"22-A55-0",name:""},{coordinate:"22-A55-1",name:""}];
hunter.setSnapshot({records:rows,atlas:{}});
const note=await hunter.loadCastleDetails(rows);
function check(ok,msg){if(!ok)throw Error(msg);}
check(calls===2,"Retry HTTP429");
check(note.includes("1 names loaded")&&note.includes("1 names not supplied"),"Count actual names");
check(hunter.retryableNameError({status:503}),"Retry transient server failure");
check(!hunter.retryableNameError({status:401,code:"authorisation_required"}),"Do not retry authentication failure");

console.log("Name retry checks passed.");})().catch(error=>{console.error(error);process.exitCode=1;});
