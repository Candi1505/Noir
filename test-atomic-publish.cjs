const fs = require("fs");
const vm = require("vm");

global.window = global;

const chestTypes = [
  "gold",
  "platinum",
  "draconic",
  "freedom",
  "arcane",
  "super_sigil"
];
const eventData = {
  event: "Upgrade Buildings",
  ready: true,
  readyChestCount: 6,
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

function runMigrationCoverageTest() {
  const sql = fs.readFileSync(
    "supabase/atomic_event_publish.sql",
    "utf8"
  );

  if (
    !/drop constraint if exists predictors_chest_type_check/i.test(sql) ||
    !/add constraint predictors_chest_type_check/i.test(sql)
  ) {
    throw new Error(
      "The event migration must replace the legacy four-chest table constraint."
    );
  }

  const constraintBlock = sql.match(
    /add constraint predictors_chest_type_check[\s\S]*?\);/i
  )?.[0] || "";

  chestTypes.forEach(chestType => {
    if (!constraintBlock.includes(`'${chestType}'`)) {
      throw new Error(
        `The predictor table constraint is missing ${chestType}.`
      );
    }
  });
}

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
  if (result.records.length !== 6) {
    throw new Error("Six published records were expected.");
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
  .then(runMigrationCoverageTest)
  .then(runSuccessfulPublishTest)
  .then(runMissingFunctionTest)
  .then(() => {
    console.log(
      "Atomic six-chest publishing and safe missing-SQL failure passed."
    );
  });
