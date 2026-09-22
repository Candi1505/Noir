"use strict";
const fs=require("node:fs");const path=require("node:path");
const read=name=>fs.readFileSync(path.join(__dirname,name),"utf8");

const storage=new Map();
const panel={textContent:"",hidden:true};
const win={panel,OnyxAtlasCore:{},addEventListener(){},localStorage:{getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)}};
const source=read("onyx-atlas-castle-hunter.js").replace("    nameFailureSummary,",
"    nameFailureSummary,\n    saveNameLookupResult, renderNameLookupResult,\n    setup: id => { playerId=id; host={querySelector:()=>window.panel}; },");
new Function("window","document",source)(win,{});
const h=win.OnyxAtlasCastleHunter;
function check(ok,message){if(!ok)throw Error(message);}
h.setup("user-a");
const result=h.nameFailureSummary({code:"atlas-live-unavailable",status:429,message:"private raw response"},0,100);
check(result.includes("0 names loaded from 100 requested")&&result.includes("HTTP 429"),"Useful failure detail");
check(!result.includes("private"),"Do not persist raw errors");
h.saveNameLookupResult(result);panel.textContent="";h.renderNameLookupResult();
check(panel.textContent===result&&!panel.hidden,"Restore durable message");
h.setup("user-b");h.renderNameLookupResult();
check(panel.textContent===""&&panel.hidden,"Do not leak another user's result");
h.setup("user-a");h.renderNameLookupResult();
check(panel.textContent===result,"Retain original user's result");

console.log("Persistent name status checks passed.");
