const fs = require("fs");
const vm = require("vm");

global.window = global;
global.document = {
  addEventListener() {}
};
global.atob = value =>
  Buffer.from(value, "base64").toString("binary");

vm.runInThisContext(
  fs.readFileSync("event-parser.js", "utf8")
);
vm.runInThisContext(
  fs.readFileSync("har-event-adapter.js", "utf8")
);
vm.runInThisContext(
  fs.readFileSync("js/har-gacha-parser.js", "utf8")
);

const harPath = process.argv[2];

if (!harPath) {
  throw new Error("Provide a HAR path.");
}

const harText = fs.readFileSync(harPath, "utf8");
const sharedEvent = EventParser.parse(harText);
const personalHistory = HarGachaParser.parse(harText);
const arcaneClaim =
  personalHistory.openings.find(opening =>
    opening.isBonus &&
    opening.parentChestKey === "arcane"
  );

if (!arcaneClaim) {
  throw new Error(
    "The test capture did not contain an Arcane bonus claim."
  );
}

const publishedJson = JSON.stringify(sharedEvent);

[
  "openings",
  "aggregatedRewards",
  "chestSummary",
  "sourceEntryIndex",
  "60 Gold",
  "\"quantity\":60"
].forEach(privateMarker => {
  if (publishedJson.includes(privateMarker)) {
    throw new Error(
      `Personal HAR data leaked into the shared event: ${privateMarker}`
    );
  }
});

if (
  sharedEvent.chests.arcane
    .bonusVerification.poolKey !==
    "mythic_arcane_items"
) {
  throw new Error(
    "Shared Arcane verification metadata was not retained."
  );
}

const playerA = {
  observations: {
    arcane: [
      { name: "Silver Chests", amount: 1 }
    ]
  },
  bonusProgress: {
    arcane: 4
  }
};

const playerB = {
  observations: {
    arcane: []
  },
  bonusProgress: {
    arcane: 0
  }
};

playerA.observations.arcane.push({
  name: "Super Sigil Chests",
  amount: 8
});
playerA.bonusProgress.arcane = 5;

if (
  playerB.observations.arcane.length !== 0 ||
  playerB.bonusProgress.arcane !== 0
) {
  throw new Error(
    "One player's Arcane progress altered another player's state."
  );
}

console.log(JSON.stringify({
  shared: {
    deckLength:
      sharedEvent.chests.arcane.deckLength,
    bonusEvery:
      sharedEvent.chests.arcane.bonusEvery,
    bonusPool:
      sharedEvent.chests.arcane
        .bonusVerification.poolKey
  },
  capturedClaimKeptLocal: {
    reward:
      arcaneClaim.rewards[0]?.name,
    quantity:
      arcaneClaim.rewards[0]?.quantity
  },
  playerA,
  playerB
}, null, 2));
