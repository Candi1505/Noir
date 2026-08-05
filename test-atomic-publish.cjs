const fs = require("fs");
const vm = require("vm");

global.window = global;

const chestTypes = [
  "gold",
  "platinum",
  "draconic",
  "freedom",
  "arcane"
];
const eventData = {
  event: "Upgrade Buildings",
  ready: true,
  readyChestCount: 5,
  chests: Object.fromEntries(
    chestTypes.map(chestType => [
      chestType,
      {
        found: true,
        deck: [0, 1, 2],
        index: 2,
        foundIndex: 2,
        sourceIndex: 2,
        currentValue: 2,
        openedSinceBonus: 7,
        chestsUntilBonus: 8,
        nextChestIsBonus: false
      }
    ])
  ),
  decks: {},
  drops: {},
  deckIndices: {},
  spinTypes: []
};

async function runSuccessfulPublishTest() {
  const rpcCalls = [];
  global.chestSupabase = {
    async rpc(name, params) {
      rpcCalls.push({ name, params });
      return {
        data: params.p_predictors.map(
          (predictor, index) => ({
            id: index + 1,
            chest_type: predictor.chest_type
          })
        ),
        error: null
      };
    }
  };

  ChestDatabase.getCurrentAccess = async () => ({
    isAdmin: true,
    user: { id: "admin-user" }
  });

  const result =
    await ChestDatabase.publishLiveEvent(eventData);

  if (rpcCalls.length !== 1) {
    throw new Error("Publishing must use exactly one database call.");
  }
  if (rpcCalls[0].name !== "publish_noir_event") {
    throw new Error("The atomic event publisher was not used.");
  }
  if (result.records.length !== 5) {
    throw new Error("Five published records were expected.");
  }

  const publishedEvent =
    rpcCalls[0]
      .params
      .p_predictors[0]
      .predictor_data
      .eventData;

  if (
    publishedEvent.chests.gold.deck.length !== 3 ||
    publishedEvent.chests.gold.found !== true
  ) {
    throw new Error("Shared Gold deck data was removed during sanitisation.");
  }

  [
    "index",
    "foundIndex",
    "sourceIndex",
    "currentValue",
    "openedSinceBonus",
    "chestsUntilBonus",
    "nextChestIsBonus"
  ].forEach(field => {
    if (field in publishedEvent.chests.gold) {
      throw new Error(`Private chest field was published: ${field}`);
    }
  });
}

async function runMissingFunctionTest() {
  let rpcCalls = 0;
  global.chestSupabase = {
    async rpc() {
      rpcCalls += 1;
      return {
        data: null,
        error: {
          code: "PGRST202",
          message:
            "Could not find the function public.publish_noir_event"
        }
      };
    }
  };

  let message = "";
  try {
    await ChestDatabase.publishLiveEvent(eventData);
  } catch (error) {
    message = error.message;
  }

  if (rpcCalls !== 1) {
    throw new Error("A missing function should fail after one safe call.");
  }
  if (!message.includes("No cloud predictor records were changed")) {
    throw new Error(
      "The missing Supabase update did not produce the safe failure message."
    );
  }
}

vm.runInThisContext(
  fs.readFileSync("database.js", "utf8"),
  { filename: "database.js" }
);

Promise.resolve()
  .then(runSuccessfulPublishTest)
  .then(runMissingFunctionTest)
  .then(() => {
    console.log(
      "Atomic five-chest publishing and safe missing-SQL failure passed."
    );
  });
