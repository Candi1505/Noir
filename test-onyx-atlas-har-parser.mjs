import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const coreSource = await readFile(path.join(root, "onyx-atlas-castle-hunter-core.js"), "utf8");
const workerSource = await readFile(path.join(root, "onyx-atlas-har-worker.js"), "utf8");

function encodedBody(value, mimeType = "text/json; charset=utf-8") {
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return {
    mimeType,
    encoding: "base64",
    text: Buffer.from(text, "utf8").toString("base64")
  };
}

function entry(pathname, body, startedDateTime, mimeType) {
  return {
    startedDateTime,
    request: {
      method: "GET",
      url: `https://example.invalid${pathname}?access_token=NEVER_KEEP_QUERY_SECRET`,
      headers: [
        { name: "Authorization", value: "Bearer NEVER_KEEP_BEARER_SECRET" },
        { name: "Cookie", value: "session=NEVER_KEEP_COOKIE_SECRET" }
      ]
    },
    response: {
      status: 200,
      content: encodedBody(body, mimeType)
    }
  };
}

function syntheticHar() {
  const landing = `
    <html><body><script>
      window.CASTLES = {
        "A1-1":{"x":10,"y":20,"level":3,"area":1,"mat":"stone","connections":{"A2-1":1}},
        "A2-1":{"x":30,"y":40,"level":4,"area":1,"mat":"stone","connections":{"A1-1":1}}
      };
      window.REGIONS = {
        "A1":{"bbox":{"x0":0,"x1":20,"y0":0,"y1":30},"is_season_island":false,"realm_name":"Realm One","region_idx":1,"sz":1},
        "A2":{"bbox":{"x0":20,"x1":40,"y0":20,"y1":50},"is_season_island":false,"realm_name":"Realm Two","region_idx":2,"sz":1}
      };
      window.REGION_IDX_TO_NAME = {"1":"North","2":"South"};
    </script></body></html>
  `;
  const metadata = {
    epoch: 1700000000,
    k_id: 42,
    metadata: {
      conts: { "A1-1": "Synthetic Team", "A2-1": null },
      teams: {
        "Synthetic Team": { power_rank: 250, rank: 12 }
      }
    }
  };
  const params = {
    params: {
      isMajorEventRunning: false,
      gloryLvlMulti: { maxCastleLevel: 2 },
      infra: {
        fort: {
          shield: {
            cdHr: 1,
            decaySec: 600,
            hr: 4,
            trigger: { start: 1000, perLvl: 100 }
          }
        }
      }
    }
  };
  const area = {
    areas: {
      "42-A1-1": {
        place_id: { k_id: 42, region_id: "A1", cont_idx: 1 },
        custom_name: "Synthetic Gate",
        level: 3,
        owner_team: "Synthetic Team",
        fleets: {},
        infra: {
          epoch_updated: 1700000000,
          online_epoch: 1699990000,
          upkeep_epoch: null,
          fort: {
            level: 5,
            upgrade_epoch: 0,
            shield_turned_on: true,
            shield_time_ts: 1699900000,
            shield_ships_lost: 0
          }
        }
      }
    }
  };

  return {
    log: {
      version: "1.2",
      creator: { name: "Synthetic", version: "1" },
      entries: [
        entry("/ext/dragonsong/world/modal/landing", landing, "2026-08-28T00:00:00.000Z", "text/html; charset=utf-8"),
        entry("/ext/dragonsong/world/macro_view/get_metadata", metadata, "2026-08-28T00:00:01.000Z"),
        entry("/ext/dragonsong/world/get_params", params, "2026-08-28T00:00:02.000Z"),
        entry("/time", "1700000000.0000000", "2026-08-28T00:00:03.000Z", "text/plain; charset=utf-8"),
        entry("/ext/dragonsong/world/area/get", area, "2026-08-28T00:00:04.000Z"),
        entry("/ext/dragonsong/world/area/get_names", {
          "42-A1-1": { name: "Synthetic Gate" }
        }, "2026-08-28T00:00:05.000Z")
      ]
    }
  };
}

async function parseSyntheticCapture() {
  let messageHandler;
  let completed;
  const context = vm.createContext({
    Blob,
    URL,
    TextDecoder,
    DecompressionStream,
    atob,
    console,
    Date,
    Intl,
    setTimeout,
    clearTimeout
  });
  context.globalThis = context;
  context.self = context;
  context.importScripts = name => {
    assert.equal(name, "onyx-atlas-castle-hunter-core.js?v=20260828-audit-2");
    vm.runInContext(coreSource, context, { filename: name });
  };
  context.addEventListener = (type, handler) => {
    if (type === "message") messageHandler = handler;
  };
  context.postMessage = message => {
    if (message.type === "complete") completed = message.snapshot;
    if (message.type === "error") throw new Error(message.message);
  };
  vm.runInContext(workerSource, context, { filename: "atlas-har-worker.js" });

  const capture = new Blob([JSON.stringify(syntheticHar())], { type: "application/json" });
  await messageHandler({ data: { type: "parse", file: capture } });
  return completed;
}

test("returns only the allowlisted derived Atlas snapshot", async () => {
  const snapshot = await parseSyntheticCapture();
  assert.equal(snapshot.schemaVersion, 2);
  assert.equal(snapshot.atlas.kingdomId, 42);
  assert.equal(snapshot.atlas.realmName, "Realm One");
  assert.equal(snapshot.atlas.shieldConfig.cdHr, 1);
  assert.equal(snapshot.summary.indexedCount, 2);
  assert.equal(snapshot.summary.checkedCount, 1);
  assert.equal(snapshot.summary.gateCount, 2);
  assert.equal(snapshot.summary.criticalGateCount, 2);
  assert.deepEqual(Array.from(snapshot.records, record => record.coordinate), ["42-A1-1", "42-A2-1"]);
  assert.equal(snapshot.records[0].glory, "confirmed100");
  assert.equal(snapshot.records[0].shield.state, "down");
  assert.equal(snapshot.records[0].material, "stone");
});

test("drops request credentials, URLs and raw HAR material", async () => {
  const serialised = JSON.stringify(await parseSyntheticCapture());
  for (const secret of [
    "NEVER_KEEP_QUERY_SECRET",
    "NEVER_KEEP_BEARER_SECRET",
    "NEVER_KEEP_COOKIE_SECRET",
    "Authorization",
    "Cookie",
    "request",
    "response"
  ]) {
    assert.doesNotMatch(serialised, new RegExp(secret, "i"));
  }
});
