const fs = require("fs");
const vm = require("vm");

global.window = global;
global.document = {
  readyState: "loading",
  addEventListener() {}
};
global.addEventListener = () => {};
global.localStorage = {
  getItem() {
    return null;
  },
  setItem() {}
};
global.atob = value =>
  Buffer.from(value, "base64").toString("binary");

[
  "event-parser.js",
  "har-event-adapter.js",
  "js/har-gacha-parser.js"
].forEach(file => {
  vm.runInThisContext(
    fs.readFileSync(file, "utf8"),
    { filename: file }
  );
});

const harPath = process.argv[2];
if (!harPath) {
  throw new Error("Provide a HAR path.");
}

global.currentEventData = EventParser.parse(
  fs.readFileSync(harPath, "utf8")
);

[
  "chest-drop-rates.js",
  "noir-chest-tools.js"
].forEach(file => {
  vm.runInThisContext(
    fs.readFileSync(file, "utf8"),
    { filename: file }
  );
});

const report = NoirChestTools.inspectEvent();

if (!report.ready) {
  throw new Error(
    `Expected the event to be ready: ${report.issues.join("; ")}`
  );
}

if (Object.keys(report.chests).length !== 6) {
  throw new Error("Expected six chest readiness results.");
}

if (!report.chests.gold.ready) {
  throw new Error("The Gold regular and bonus decks should be ready.");
}

if (
  report.chests.gold.regularRewards !== 20 ||
  report.chests.gold.bonusRewards !== 9
) {
  throw new Error(
    `Expected Gold to contain 20 regular and 9 bonus rewards, found ${report.chests.gold.regularRewards} and ${report.chests.gold.bonusRewards}.`
  );
}

const foodPackRows = NoirChestTools.findRewards("1.4M Food Pack")
  .filter(row => row.chestType === "gold");

if (foodPackRows.length !== 2) {
  throw new Error(
    `Expected the Gold regular and bonus pools to expose the friendly 1.4M Food Pack name, found ${foodPackRows.length} matches.`
  );
}

if (!report.chests.super_sigil.ready) {
  throw new Error("The Super Sigil regular and bonus decks should be ready.");
}

if (
  report.chests.super_sigil.regularRewards !== 8 ||
  report.chests.super_sigil.bonusRewards !== 4
) {
  throw new Error(
    `Expected Super Sigil to contain 8 regular and 4 bonus rewards, found ${report.chests.super_sigil.regularRewards} and ${report.chests.super_sigil.bonusRewards}.`
  );
}

if (!report.chests.arcane.ready) {
  throw new Error("The Arcane regular deck should be ready.");
}

if (report.chests.arcane.warnings.length) {
  throw new Error(
    `Verified Arcane bonus should have no warnings: ${report.chests.arcane.warnings.join("; ")}`
  );
}

if (report.chests.arcane.bonusRewards !== 7) {
  throw new Error(
    `Expected seven verified Arcane bonus rewards, found ${report.chests.arcane.bonusRewards}.`
  );
}

["gold", "draconic"].forEach(chestType => {
  if (!report.chests[chestType].ready) {
    throw new Error(
      `${chestType} still has a false readiness warning.`
    );
  }
});

console.log(
  JSON.stringify(
    {
      event: report.eventName,
      ready: report.ready,
      readyChestCount: Object.values(
        report.chests
      ).filter(chest => chest.ready).length,
      goldRewards: {
        regular: report.chests.gold.regularRewards,
        bonus: report.chests.gold.bonusRewards,
        foodPackName: foodPackRows[0].name
      },
      superSigilRewards: {
        regular: report.chests.super_sigil.regularRewards,
        bonus: report.chests.super_sigil.bonusRewards
      },
      arcaneWarnings:
        report.chests.arcane.warnings
    },
    null,
    2
  )
);
