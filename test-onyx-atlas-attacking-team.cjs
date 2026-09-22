"use strict";
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, name), "utf8");

const win = { addEventListener() {}, localStorage: { getItem() { return null; } } };
new Function("globalThis", read("onyx-atlas-castle-hunter-core.js"))(win);
new Function("window", "document", read("onyx-atlas-castle-hunter.js"))(win, {});
const apply = win.OnyxAtlasCastleHunter.withAttackingTeam;
const now = 1800000000;
const value = {
 atlas: { topologySource: "official-metadata", playerTeam: null, playerApr: null, gloryObservedAt: now },
 records: [
 {source:"official",coordinate:"sr",ownerTeam:"SeveredReality",apr:17,rawLevel:1,gloryPercent:null,guards:5000},
 {source:"official",coordinate:"target",ownerTeam:"Enemy",apr:102,rawLevel:1,gloryPercent:null},
 {source:"capture",coordinate:"old",ownerTeam:"Other",apr:1,rawLevel:1,gloryPercent:null}
 ]
};
function check(ok, message) { if (!ok) throw new Error(message); }
const selected = apply(value, "severedreality", now);
check(selected.records[1].gloryPercent === 68, "SR APR17 versus 102 estimate");
check(selected.atlas.playerApr === null && selected.atlas.playerTeam === null, "Connected identity unchanged");
check(selected.atlas.attackingApr === 17, "Selected APR");
check(selected.records[0].guards === 5000, "Troops preserved");
check(value.records[1].gloryPercent === null, "Original snapshot unchanged");
check(apply(value, "", now) === value, "Clear selection restores connected account");
check(apply(value, "Missing", now).records[1].gloryPercent === null, "Missing team unknown");
check(apply(value, "SeveredReality", now + 600).records[1].gloryPercent === null, "Expired APR unknown");
check(apply(value, "SeveredReality", now - 61).records[1].gloryPercent === null, "Future timestamp rejected");
const conflict = {...value,records:[...value.records,{source:"official",ownerTeam:"SeveredReality",apr:18}]};
check(apply(conflict,"SeveredReality",now).atlas.attackingApr === null, "Conflicting ranks unknown");
const changed = {...value,records:value.records.map(r=>r.ownerTeam==="SeveredReality"?{...r,apr:30}:r)};
check(apply(changed,"SeveredReality",now).atlas.attackingApr === 30, "Live rank updates, no fixed 17");
check(apply(value,"SeveredReality",now).records[2] === value.records[2], "Capture data not promoted to live");

console.log("Attacking team regression checks passed.");
