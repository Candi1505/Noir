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
const deckKeys = {
  gold: "gold_chest",
  platinum: "platinum_chest",
  draconic: "dragfrag_chest_tier3",
  freedom: "freedom_chest",
  arcane: "arcane_chest",
  super_sigil: "sigil_chest"
};
const eventData = {
  event: "Upgrade Buildings",
  ready: true,
  readyChestCount: 6,
  availabilityKnown: true,
  availableChestTypes: [
    "gold",
    "platinum",
    "draconic",
    "arcane"
  ],
  availableChestCount: 4,
  chests: Object.fromEntries(
    chestTypes.map(chestType => [
      chestType,
      {
        key: deckKeys[chestType],
        label: chestType,
        found: true,
        deck: [0, 1, 2],
        deckLength: 3,
        available: [
          "gold",
          "platinum",
          "draconic",
          "arcane"
        ].includes(chestType),
        index: 2,
        foundIndex: 2,
        sourceIndex: 2,
        currentValue: 2,
        openedSinceBonus: 7,
        chestsUntilBonus: 8,
        nextChestIsBonus: false,
        warnings: []
      }
    ])
  ),
  decks: { gold_chest: [0, 1, 2] },
  drops: { gold_chest: [] },
  deckIndices: {},
  spinTypes: [],
  doubleArmory: {
    detected: true,
    ready: true,
    sides: {
      assault: {
        ready: true,
        deckIndices: {
          gold_chest: 91
        },
        decks: {
          gold_chest: [0, 1, 2]
        }
      }
    }
  }
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

  const safeGrant = sql.match(
    /grant select\s*\([\s\S]*?\)\s*on table public\.predictors to authenticated/i
  )?.[0] || "";

  for (const column of [
    "id",
    "chest_type",
    "version",
    "predictor_data",
    "uploaded_at"
  ]) {
    if (!safeGrant.includes(column)) {
      throw new Error(`The safe predictor grant is missing ${column}.`);
    }
  }

  if (
    /uploaded_by|\bactive\b/i.test(safeGrant) ||
    !/revoke all privileges[\s\S]*?on table public\.predictors[\s\S]*?from anon, authenticated/i.test(sql) ||
    !/revoke all privileges\s*\([\s\S]*?uploaded_by[\s\S]*?active[\s\S]*?\)[\s\S]*?from anon, authenticated/i.test(sql)
  ) {
    throw new Error(
      "Predictor table privileges do not enforce the safe-column boundary."
    );
  }

  if (
    /returns setof public\.predictors/i.test(sql) ||
    !/returns table\s*\([\s\S]*?published_version[\s\S]*?published_at[\s\S]*?\)/i.test(sql)
  ) {
    throw new Error("The atomic RPC still exposes full predictor rows.");
  }

  for (const requirement of [
    /set search_path = ''/i,
    /auth\.uid\(\) is null or public\.is_noir_admin\(\) is not true/i,
    /pg_advisory_xact_lock\s*\(/i,
    /create unique index if not exists predictors_one_active_per_chest_uidx[\s\S]*?where active is true/i,
    /row_number\(\) over[\s\S]*?partition by chest_type/i,
    /jsonb_array_length\(p_predictors\)[\s\S]*?array_length\(allowed_chest_types, 1\)/i,
    /predictor_payload_is_safe/i,
    /normalised_key like 'source%'/i,
    /normalised_key like 'request%'/i,
    /'deckindices'/i,
    /'sessiontoken'/i,
    /'playerid'/i,
    /revoke all[\s\S]*?publish_noir_event\(bigint, jsonb\)[\s\S]*?from public, anon, authenticated/i,
    /procedure\.proname = 'publish_noir_predictor'/i
  ]) {
    if (!requirement.test(sql)) {
      throw new Error(`Missing atomic privacy rule: ${requirement}`);
    }
  }

  const databaseSource = fs.readFileSync("database.js", "utf8");
  const getPredictorBlock = databaseSource.match(
    /async getPredictor\([\s\S]*?async savePredictor\(/
  )?.[0] || "";
  const getActiveBlock = databaseSource.match(
    /async getActivePredictors\([\s\S]*?async publishLiveEvent\(/
  )?.[0] || "";

  if (
    /select\(\s*["']\*["']\s*\)/.test(getPredictorBlock) ||
    /uploaded_by/.test(getPredictorBlock + getActiveBlock) ||
    /\.eq\(\s*["']active["']/.test(getPredictorBlock + getActiveBlock)
  ) {
    throw new Error(
      "Predictor reads must use only granted columns and rely on active-row RLS."
    );
  }

  if (
    /publish_noir_predictor/.test(databaseSource) ||
    /from\(["']predictors["']\)[\s\S]{0,400}\.(?:insert|update|delete)\(/.test(databaseSource)
  ) {
    throw new Error("A legacy direct predictor publishing path remains.");
  }

  if (/\.abortSignal\(/.test(databaseSource)) {
    throw new Error(
      "A dispatched SQL publish must not be presented as cancellable by aborting the browser fetch."
    );
  }

  const publisherSource = fs.readFileSync(
    "admin-event-publisher.js",
    "utf8"
  );
  if (
    !/publishInFlight \|\|[\s\S]*?importButton\.dataset\.importBusy/.test(
      publisherSource
    )
  ) {
    throw new Error(
      "The import control must stay locked until a dispatched publish settles."
    );
  }
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
    await ChestDatabase.publishLiveEvent(
      eventData,
      {
        name: "private-capture.har",
        url: "https://private.invalid/capture"
      }
    );

  if (rpcCalls.length !== 1) {
    throw new Error("Publishing must use exactly one database call.");
  }
  if (rpcCalls[0].name !== "publish_noir_event") {
    throw new Error("The atomic event publisher was not used.");
  }
  if (result.records.length !== 6) {
    throw new Error("Six published records were expected.");
  }

  if (
    rpcCalls[0].params.p_predictors.length !== 6 ||
    JSON.stringify(
      rpcCalls[0].params.p_predictors
        .map(record => record.chest_type)
        .sort()
    ) !== JSON.stringify([...chestTypes].sort())
  ) {
    throw new Error("The client did not publish the exact six-chest set.");
  }

  if (
    /private-capture|private\.invalid/i.test(
      JSON.stringify(
        rpcCalls[0].params.p_predictors
      )
    )
  ) {
    throw new Error("Private source-file metadata reached the publishing RPC.");
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

  if (
    publishedEvent.availabilityKnown !== true ||
    publishedEvent.availableChestCount !== 4 ||
    JSON.stringify(
      publishedEvent.availableChestTypes
    ) !== JSON.stringify([
      "gold",
      "platinum",
      "draconic",
      "arcane"
    ])
  ) {
    throw new Error(
      "Current chest availability was not preserved during sanitisation."
    );
  }

  [
    "index",
    "foundIndex",
    "sourceIndex",
    "currentValue",
    "openedSinceBonus",
    "chestsUntilBonus",
    "nextChestIsBonus",
    "warnings"
  ].forEach(field => {
    if (field in publishedEvent.chests.gold) {
      throw new Error(`Private chest field was published: ${field}`);
    }
  });

  if (
    "deckIndices" in publishedEvent ||
    "deckIndices" in
      publishedEvent.doubleArmory.sides.assault
  ) {
    throw new Error(
      "Private Double Armory cursor positions were published."
    );
  }

  if (
    publishedEvent.doubleArmory.sides.assault
      .decks.gold_chest.length !== 3
  ) {
    throw new Error(
      "Shared Double Armory deck data was removed during sanitisation."
    );
  }
}

async function runPrivatePayloadRejectionTest() {
  let rpcCalls = 0;
  global.chestSupabase = {
    async rpc() {
      rpcCalls += 1;
      return { data: [], error: null };
    }
  };

  const unsafeEvent = JSON.parse(
    JSON.stringify(eventData)
  );
  unsafeEvent.drops = {
    gold_chest: [
      {
        request: {
          headers: {
            authorization: "private-value"
          }
        }
      }
    ]
  };

  let message = "";
  try {
    await ChestDatabase.publishLiveEvent(
      unsafeEvent
    );
  } catch (error) {
    message = error.message;
  }

  if (rpcCalls !== 0) {
    throw new Error("Private capture metadata reached the publishing RPC.");
  }
  if (
    !message.includes("private capture or player data") ||
    !message.includes("No cloud predictor records were changed")
  ) {
    throw new Error("Private payload publishing did not fail closed.");
  }
}

async function runLegacyPublisherRetirementTest() {
  let message = "";

  try {
    await ChestDatabase.savePredictor({
      chestType: "gold"
    });
  } catch (error) {
    message = error.message;
  }

  if (
    !message.includes("Single-chest publishing is retired") ||
    !message.includes("complete six-chest event")
  ) {
    throw new Error("The legacy client publisher is still available.");
  }
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

async function runIncompleteEventTest() {
  let rpcCalls = 0;
  global.chestSupabase = {
    async rpc() {
      rpcCalls += 1;
      return { data: [], error: null };
    }
  };
  ChestDatabase.getCurrentAccess = async () => ({
    isAdmin: true,
    user: { id: "admin-user" }
  });

  const incompleteEvent = {
    ...eventData,
    readyChestCount: 1,
    chests: {
      gold: eventData.chests.gold
    }
  };

  let message = "";
  try {
    await ChestDatabase.publishLiveEvent(incompleteEvent);
  } catch (error) {
    message = error.message;
  }

  if (rpcCalls !== 0) {
    throw new Error("An incomplete event reached the atomic publisher.");
  }
  if (
    !message.includes("live event is incomplete") ||
    !message.includes("No cloud predictor records were changed")
  ) {
    throw new Error("Incomplete event publishing did not fail closed.");
  }
}

vm.runInThisContext(
  fs.readFileSync("database.js", "utf8"),
  { filename: "database.js" }
);

Promise.resolve()
  .then(runMigrationCoverageTest)
  .then(runIncompleteEventTest)
  .then(runPrivatePayloadRejectionTest)
  .then(runLegacyPublisherRetirementTest)
  .then(runSuccessfulPublishTest)
  .then(runMissingFunctionTest)
  .then(() => {
    console.log(
      "Atomic six-chest publishing and safe missing-SQL failure passed."
    );
  });
