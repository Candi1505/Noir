import assert from "node:assert/strict";
import test from "node:test";

await import(new URL("./onyx-atlas-castle-hunter-core.js", import.meta.url));

const Core = globalThis.OnyxAtlasCore;

function node(level = 3, connections = {}, mat = "stone") {
  return { x: 0, y: 0, level, area: 1, mat, connections };
}

function shield(state = "unknown", observedAt = null) {
  return { state, observedAt, sourceUpdatedAt: observedAt, endAt: null };
}

function castle(overrides = {}) {
  return {
    coordinate: "42-A1-1",
    tier: 4,
    apr: 100,
    glory: "confirmed100",
    gateType: "gate",
    shield: shield("down", 1000),
    name: "Synthetic Keep",
    ownerTeam: "Synthetic Team",
    regionId: "A1",
    regionName: "Synthetic Region",
    ...overrides
  };
}

test("defaults to a multi-select T2 through T5 castle list", () => {
  assert.deepEqual(Core.normaliseFilters({}).tiers, [2, 3, 4, 5]);

  const records = [2, 3, 4, 5].map((tier, index) => castle({
    tier,
    coordinate: `42-A1-${index + 1}`
  }));
  const result = Core.filterCastles(records, { tiers: [2, 4] }, 1000);
  assert.deepEqual(result.records.map(record => record.tier).sort(), [2, 4]);
});

test("intersects inclusive APR bounds with tier and glory filters", () => {
  const records = [
    castle({ coordinate: "42-A1-1", tier: 4, apr: 99 }),
    castle({ coordinate: "42-A1-2", tier: 4, apr: 100 }),
    castle({ coordinate: "42-A1-3", tier: 5, apr: 200 }),
    castle({ coordinate: "42-A1-4", tier: 3, apr: null, glory: "needsData" })
  ];
  const result = Core.filterCastles(records, {
    tiers: [4, 5],
    aprMin: 100,
    aprMax: 200,
    glory: "confirmed100"
  }, 1000);
  assert.deepEqual(result.records.map(record => record.coordinate).sort(), ["42-A1-2", "42-A1-3"]);
});

test("rejects an inverted APR range", () => {
  const result = Core.filterCastles([castle()], { aprMin: 200, aprMax: 100 }, 1000);
  assert.match(result.error, /minimum/i);
  assert.equal(result.records.length, 0);
});

test("rejects invalid or negative APR inputs", () => {
  assert.match(Core.filterCastles([castle()], { aprMin: -1 }, 1000).error, /zero or higher/i);
  assert.match(Core.filterCastles([castle()], { aprMax: "not-a-number" }, 1000).error, /zero or higher/i);
});

test("only the captured high-tier rule receives confirmed 100 percent glory", () => {
  assert.equal(Core.classifyGlory(3, 2), "confirmed100");
  assert.equal(Core.classifyGlory(4, 2), "confirmed100");
  assert.equal(Core.classifyGlory(2, 2), "needsData");
  assert.equal(Core.classifyGlory(1, 2), "needsData");
  assert.equal(Core.classifyGlory(3, null), "unknown");
});

test("derives gate and critical-gate endpoints from cross-region topology", () => {
  const topology = {
    "A1-1": node(3, { "A2-1": 1 }),
    "A1-2": node(3, {}),
    "A2-1": node(3, { "A1-1": 1, "A3-1": 1 }),
    "A2-2": node(3, { "A2-3": 1 }),
    "A2-3": node(3, { "A2-2": 1 }),
    "A3-1": node(3, { "A2-1": 1 }),
    "A3-2": node(3, {}),
    "A4-1": node(3, {})
  };
  const result = Core.deriveGateTypes(topology);

  assert.equal(result.types["A1-1"], "critical");
  assert.equal(result.types["A2-1"], "critical");
  assert.equal(result.types["A2-2"], "none");
  assert.equal(result.types["A2-3"], "none");
  assert.equal(result.types["A4-1"], "none");
});

test("keeps alternate cross-region routes as gates rather than critical gates", () => {
  const topology = {
    "A1-1": node(3, { "A2-1": 1 }),
    "A1-2": node(3, { "A3-2": 1 }),
    "A2-1": node(3, { "A1-1": 1 }),
    "A2-2": node(3, { "A3-1": 1 }),
    "A3-1": node(3, { "A2-2": 1 }),
    "A3-2": node(3, { "A1-2": 1 })
  };
  const result = Core.deriveGateTypes(topology);
  Object.values(result.types).forEach(type => assert.equal(type, "gate"));
  assert.equal(result.criticalCount, 0);
});

test("walks a full-size Atlas without overflowing the browser call stack", () => {
  const topology = {};
  const regionCount = 6000;

  for (let index = 1; index <= regionCount; index += 1) {
    const connections = {};
    if (index > 1) connections[`A${index - 1}-1`] = 1;
    if (index < regionCount) connections[`A${index + 1}-1`] = 1;
    topology[`A${index}-1`] = node(3, connections);
  }

  const result = Core.deriveGateTypes(topology);
  assert.equal(result.edgeCount, regionCount - 1);
  assert.equal(result.criticalEdgeCount, regionCount - 1);
  assert.equal(result.criticalCount, regionCount);
});

test("validates and copies only canonical WD castle coordinates", () => {
  assert.equal(Core.isCanonicalCoordinate("42-A7-3"), true);
  assert.equal(Core.isCanonicalCoordinate("0-A7-3"), false);
  assert.equal(Core.isCanonicalCoordinate("42-7-3"), false);
  assert.equal(Core.isCanonicalCoordinate("42-A7"), false);
});

test("calculates down, cooldown and active shield states from captured server time", () => {
  const baseArea = {
    level: 3,
    place_id: { k_id: 42, region_id: "A1", cont_idx: 1 },
    infra: {
      epoch_updated: 9999,
      online_epoch: 9000,
      upkeep_epoch: null,
      fort: {
        level: 5,
        upgrade_epoch: 0,
        shield_turned_on: true,
        shield_time_ts: -20000,
        shield_ships_lost: 0
      }
    }
  };
  const shieldConfig = {
    cdHr: 1,
    decaySec: 600,
    hr: 4,
    trigger: { start: 1000, perLvl: 100 }
  };
  const mapNode = node(3, {}, "stone");

  assert.equal(Core.computeShieldState({
    node: mapNode,
    area: structuredClone(baseArea),
    shieldConfig,
    serverNow: 10000,
    majorEvent: false
  }).state, "down");

  const cooldownArea = structuredClone(baseArea);
  cooldownArea.infra.fort.shield_time_ts = 0;
  assert.equal(Core.computeShieldState({
    node: mapNode,
    area: cooldownArea,
    shieldConfig,
    serverNow: 10000,
    majorEvent: false
  }).state, "cooldown");

  const activeArea = structuredClone(baseArea);
  activeArea.infra.fort.shield_time_ts = 11000;
  assert.equal(Core.computeShieldState({
    node: mapNode,
    area: activeArea,
    shieldConfig,
    serverNow: 10000,
    majorEvent: false
  }).state, "active");
});

test("never treats stale or unknown shield observations as currently down", () => {
  const stale = castle({ shield: shield("down", 1000) });
  const unknown = castle({ coordinate: "42-A1-2", shield: shield("unknown", null) });
  const now = 1000 + Core.LIVE_TTL_SECONDS + 1;

  assert.equal(Core.effectiveShieldState(stale.shield, now), "stale");
  assert.equal(Core.filterCastles([stale, unknown], { shield: "down" }, now).records.length, 0);
  assert.deepEqual(
    Core.filterCastles([stale, unknown], { shield: "observedDown" }, now).records.map(record => record.coordinate),
    [stale.coordinate]
  );
  assert.equal(Core.filterCastles([stale, unknown], { shield: "notChecked" }, now).records.length, 2);
});

test("gate filters combine with every other target filter", () => {
  const records = [
    castle({ coordinate: "42-A1-1", gateType: "critical" }),
    castle({ coordinate: "42-A1-2", gateType: "gate" }),
    castle({ coordinate: "42-A1-3", gateType: "none" })
  ];
  assert.equal(Core.filterCastles(records, { gate: "gate" }, 1000).records.length, 2);
  assert.deepEqual(
    Core.filterCastles(records, { gate: "critical" }, 1000).records.map(record => record.coordinate),
    ["42-A1-1"]
  );
  assert.deepEqual(
    Core.filterCastles(records, { gate: "none" }, 1000).records.map(record => record.coordinate),
    ["42-A1-3"]
  );
});

test("merges official ownership and APR without replacing topology", () => {
  const snapshot = {
    schemaVersion: 2,
    atlas: { gloryMaxCastleLevel: 2 },
    records: [castle({
      coordinate: "42-A1-1",
      rawLevel: 2,
      tier: 3,
      ownerTeam: "Old Team",
      apr: 999,
      gateType: "critical"
    })]
  };
  const merged = Core.mergeOfficialMacro(snapshot, {
    updatedAt: 2000,
    records: [{
      coordinate: "42-A1-1",
      rawLevel: 3,
      ownerTeam: "Live Team",
      apr: 80,
      atlasRank: 12
    }]
  });

  assert.equal(merged.catalogueUpdatedAt, 2000);
  assert.equal(merged.records[0].ownerTeam, "Live Team");
  assert.equal(merged.records[0].apr, 80);
  assert.equal(merged.records[0].tier, 4);
  assert.equal(merged.records[0].glory, "confirmed100");
  assert.equal(merged.records[0].gateType, "critical");
});

test("derives official live down, cooldown and active states from allowlisted fort data", () => {
  const record = castle({ rawLevel: 3, material: "stone" });
  const atlas = {
    majorEvent: false,
    shieldConfig: {
      cdHr: 1,
      hr: 4,
      trigger: { start: 1000, perLvl: 100 }
    }
  };
  const live = {
    observedAt: 10000,
    fort: {
      level: 5,
      upgradeEpoch: 0,
      shieldTurnedOn: true,
      shieldTimeTs: -20000,
      shieldShipsLost: 0
    }
  };

  assert.equal(Core.computeOfficialShieldState(record, live, atlas, 10000).state, "down");
  live.fort.shieldTimeTs = 0;
  assert.equal(Core.computeOfficialShieldState(record, live, atlas, 10000).state, "cooldown");
  live.fort.shieldTimeTs = 11000;
  assert.equal(Core.computeOfficialShieldState(record, live, atlas, 10000).state, "active");
});

test("merges only canonical official critical records and timestamps them fresh", () => {
  const snapshot = {
    schemaVersion: 2,
    atlas: {
      majorEvent: false,
      shieldConfig: {
        cdHr: 1,
        hr: 4,
        trigger: { start: 1000, perLvl: 100 }
      }
    },
    records: [castle({ rawLevel: 3, material: "stone", shield: shield("unknown", null) })]
  };
  const merged = Core.mergeOfficialCritical(snapshot, {
    observedAt: 10000,
    records: [
      {
        coordinate: "42-A1-1",
        available: true,
        observedAt: 10000,
        ownerTeam: "Live Team",
        fort: {
          level: 5,
          upgradeEpoch: 0,
          shieldTurnedOn: true,
          shieldTimeTs: -20000,
          shieldShipsLost: 0
        },
        guards: 12345
      },
      { coordinate: "not-a-castle", available: true, observedAt: 10000 }
    ]
  });

  assert.equal(merged.lastLiveAt, 10000);
  assert.equal(merged.records.length, 1);
  assert.equal(merged.records[0].ownerTeam, "Live Team");
  assert.equal(merged.records[0].guards, 12345);
  assert.equal(merged.records[0].shield.state, "down");
  assert.equal(Core.effectiveShieldState(merged.records[0].shield, 10000), "down");
});
