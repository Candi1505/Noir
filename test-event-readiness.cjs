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

if (Object.keys(report.chests).length !== 5) {
  throw new Error("Expected five chest readiness results.");
}

if (!report.chests.arcane.ready) {
  throw new Error("The Arcane regular deck should be ready.");
}

if (
  !report.chests.arcane.warnings.some(
    warning => warning.includes("bonus rewards unverified")
  )
) {
  throw new Error(
    "Arcane should clearly identify its uncaptured bonus data."
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
      arcaneWarnings:
        report.chests.arcane.warnings
    },
    null,
    2
  )
);
