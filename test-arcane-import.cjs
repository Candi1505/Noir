const fs = require("fs");
const vm = require("vm");

global.window = global;
global.document = {
  addEventListener() {}
};
global.atob = value => Buffer.from(value, "base64").toString("binary");

vm.runInThisContext(fs.readFileSync("event-parser.js", "utf8"));
vm.runInThisContext(fs.readFileSync("har-event-adapter.js", "utf8"));
vm.runInThisContext(fs.readFileSync("js/har-gacha-parser.js", "utf8"));

const harPath = process.argv[2];
if (!harPath) throw new Error("Provide a HAR path.");

const harText = fs.readFileSync(harPath, "utf8");
const parsed = EventParser.parse(harText);
const gacha = HarGachaParser.parse(harText);
const arcane = parsed.chests.arcane;

if (!arcane?.found) {
  console.log(JSON.stringify({
    event: parsed.event,
    availableDeckKeys: parsed.availableDeckKeys,
    chests: parsed.chests,
    diagnostics: global.ChestCompanionLastImport
  }, null, 2));
  throw new Error("Arcane deck was not detected.");
}
if (arcane.bonusEvery !== 15) throw new Error("Arcane cadence must be 15.");
if (arcane.key !== "arcane_chest") throw new Error("Wrong Arcane deck key.");
if (arcane.availableRewardPoolCount !== 3) {
  throw new Error("All three Arcane reward pools must be present.");
}
if (!gacha.openings.some(opening => opening.chestKey === "arcane")) {
  throw new Error("Spin type 37 was not recognised as Arcane.");
}

console.log(JSON.stringify({
  event: parsed.event,
  readyChestCount: parsed.readyChestCount,
  arcane: {
    deckKey: arcane.key,
    deckLength: arcane.deckLength,
    bonusEvery: arcane.bonusEvery,
    rewardPools: Object.fromEntries(
      Object.entries(arcane.rewardPools).map(([key, value]) => [key, value.length])
    ),
    spinType: arcane.regularSpinType?.spin_type,
    title: arcane.regularSpinType?.title,
    description: arcane.bonusDescription
  },
  arcaneOpeningRequests:
    gacha.openings.filter(opening => opening.chestKey === "arcane").length,
  arcaneProgress: gacha.arcane
}, null, 2));
