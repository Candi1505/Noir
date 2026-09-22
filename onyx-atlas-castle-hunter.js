/* ============================================================
   ONYX COMMAND — PRODUCTION ATLAS CASTLE HUNTER
   ============================================================ */

(function initialiseAtlasCommand(window, document) {
  "use strict";

  const Core = window.OnyxAtlasCore;
  const WarDragons = window.OnyxWarDragonsAPI;
  const WarDragonsAuth = window.OnyxWarDragonsAuth;
  const DATABASE_NAME = "onyx-atlas-cache-v1";
  const DATABASE_VERSION = 1;
  const SNAPSHOT_STORE = "snapshots";
  const FILTER_KEY_PREFIX = "onyxAtlasFiltersV1";
  const SHIELD_CONTEXT_KEY_PREFIX = "onyxAtlasShieldContextV1";
  const SHIELD_CONTEXT_TTL_SECONDS = 6 * 60 * 60;
  const PAGE_SIZE = 50;
  const LIVE_BATCH_SIZE = 25;
  const LIVE_BATCH_INTERVAL_MS = 1100;
  const MAX_LIVE_SCAN_CASTLES = 250;
  const DROPPING_SOON_SECONDS = 2 * 60 * 60;
  const DEFAULT_KINGDOM_ID = 1;
  const DEFAULT_REALM_NAME = "Celestial_Haven";
  const LEGACY_ATLAS_CONFIG = Object.freeze({
    realmName: DEFAULT_REALM_NAME,
    shieldConfig: Object.freeze({
      cdHr: 3,
      decaySec: 86400,
      hr: 24,
      trigger: Object.freeze({ perLvl: 10000, start: 50000 })
    }),
    gloryMaxCastleLevel: 2,
    majorEvent: false
  });
  const FORBIDDEN_KEYS = new Set([
    "authorization",
    "cookie",
    "cookies",
    "headers",
    "request",
    "response",
    "session",
    "token",
    "url",
    "querystring"
  ]);

  if (!Core) {
    console.error("[Onyx Atlas] Castle Hunter rules are unavailable.");
    return;
  }

  let playerId = "signed-out";
  let snapshot = null;
  let filteredRecords = [];
  let observedDownFallbackCount = 0;
  let renderLimit = PAGE_SIZE;
  let activeWorker = null;
  let filterTimer = 0;
  let apiState = {
    signedIn: false,
    connected: false,
    readyToAuthorise: false,
    reviewStatus: "checking",
    scopes: []
  };
  let liveScanning = false;
  let cancelLiveScan = false;
  let host = null;
  let loadedPlayerId = null;
  let mountGeneration = 0;

  const get = id => host?.querySelector(`#${id}`) || null;
  const formatNumber = value => Number(value || 0).toLocaleString("en-AU");

  async function resolvePlayerId() {
    try {
      const result = await window.chestSupabase?.auth?.getSession?.();
      return result?.data?.session?.user?.id || "signed-out";
    } catch (error) {
      console.warn("[Onyx Atlas] Signed-in player could not be resolved.", error);
      return "signed-out";
    }
  }

  function filterStorageKey() {
    return `${FILTER_KEY_PREFIX}:${playerId}`;
  }

  function shieldContextStorageKey() {
    return `${SHIELD_CONTEXT_KEY_PREFIX}:${playerId}`;
  }

  function normaliseShieldContext(value, nowEpoch = Date.now() / 1000) {
    const confirmedAt = Number(value?.confirmedAt);
    const expiresAt = Number(value?.expiresAt);
    if (
      value?.mode !== "pvp-down" ||
      !Number.isFinite(confirmedAt) ||
      !Number.isFinite(expiresAt) ||
      expiresAt <= nowEpoch ||
      expiresAt <= confirmedAt ||
      expiresAt - confirmedAt > SHIELD_CONTEXT_TTL_SECONDS + 5
    ) return null;
    return { mode: "pvp-down", confirmedAt, expiresAt, source: "player-confirmed" };
  }

  function writeLocalShieldContext(context) {
    if (playerId === "signed-out") return;
    if (context) {
      window.localStorage.setItem(shieldContextStorageKey(), JSON.stringify(context));
    } else {
      window.localStorage.removeItem(shieldContextStorageKey());
    }
  }

  function readShieldContext(nowEpoch = Date.now() / 1000) {
    if (playerId === "signed-out") return null;
    try {
      return normaliseShieldContext(
        JSON.parse(window.localStorage.getItem(shieldContextStorageKey()) || "null"),
        nowEpoch
      );
    } catch {
      return null;
    }
  }

  async function syncShieldContextFromCloud() {
    const local = readShieldContext();
    const loader = window.ChestDatabase?.loadOnyxAtlasShieldContext;
    const saver = window.ChestDatabase?.saveOnyxAtlasShieldContext;
    if (typeof loader !== "function") return local;
    try {
      const cloud = normaliseShieldContext(await loader.call(window.ChestDatabase));
      const winner = !local || (cloud && cloud.confirmedAt > local.confirmedAt) ? cloud : local;
      writeLocalShieldContext(winner);
      if (winner && (!cloud || winner.confirmedAt > cloud.confirmedAt) && typeof saver === "function") {
        await saver.call(window.ChestDatabase, winner);
      }
      return winner;
    } catch (error) {
      console.warn("[Onyx Atlas] Shield confirmation is available on this device only.", error);
      return local;
    }
  }

  function applyOfficialShieldContext(value, nowEpoch = Date.now() / 1000) {
    if (value?.atlas?.topologySource !== "official-metadata") return value;
    const shieldContext = readShieldContext(nowEpoch);
    const atlas = {
      ...value.atlas,
      shieldConfig: shieldContext ? LEGACY_ATLAS_CONFIG.shieldConfig : null,
      majorEvent: shieldContext ? false : null,
      shieldContext
    };
    return {
      ...value,
      atlas,
      records: value.records.map(record => ({
        ...record,
        shield: record.officialFort
          ? Core.computeOfficialShieldState(record, {
              observedAt: Number(record.criticalObservedAt) || nowEpoch,
              rawLevel: record.rawLevel,
              fort: record.officialFort
            }, atlas, Number(record.criticalObservedAt) || nowEpoch)
          : Core.computeOfficialShieldState(record, null, atlas, nowEpoch)
      }))
    };
  }

  function syncShieldContextControl() {
    const checkbox = get("atlasPvpShieldsDown");
    const status = get("atlasShieldContextStatus");
    const context = readShieldContext();
    if (checkbox) checkbox.checked = Boolean(context);
    if (status) {
      status.textContent = context
        ? `Player-confirmed · expires ${new Date(context.expiresAt * 1000).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}`
        : "Unverified · Onyx will keep live shield vulnerability unknown.";
    }
  }

  async function setPvpShieldContext(enabled) {
    if (playerId === "signed-out") return;
    let cloudSaved = true;
    let context = null;
    if (enabled) {
      const confirmedAt = Date.now() / 1000;
      context = {
        mode: "pvp-down",
        confirmedAt,
        expiresAt: confirmedAt + SHIELD_CONTEXT_TTL_SECONDS
      };
    }
    writeLocalShieldContext(context);
    const saver = window.ChestDatabase?.saveOnyxAtlasShieldContext;
    if (typeof saver === "function") {
      try {
        await saver.call(window.ChestDatabase, context);
      } catch (error) {
        cloudSaved = false;
        console.warn("[Onyx Atlas] Shield confirmation was saved on this device only.", error);
      }
    }
    if (snapshot?.atlas?.topologySource === "official-metadata") {
      snapshot = applyOfficialShieldContext(snapshot);
      await cacheSnapshot(snapshot).catch(() => undefined);
      syncAtlasCommandSnapshot(snapshot);
      applyFilters({ persist: false });
    }
    syncShieldContextControl();
    setImportStatus(enabled
      ? `PvP shields down confirmed for 6 hours${cloudSaved ? " on your Onyx account" : " on this device"} · choose a team, then scan live`
      : "PvP shield context cleared · live vulnerability is unknown");
  }

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB is unavailable."));
        return;
      }
      const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
      request.addEventListener("upgradeneeded", () => {
        if (!request.result.objectStoreNames.contains(SNAPSHOT_STORE)) {
          request.result.createObjectStore(SNAPSHOT_STORE);
        }
      });
      request.addEventListener("success", () => resolve(request.result));
      request.addEventListener("error", () => reject(request.error || new Error("Atlas cache unavailable.")));
    });
  }

  async function readCachedSnapshot() {
    if (playerId === "signed-out") return null;
    const database = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const request = database
          .transaction(SNAPSHOT_STORE, "readonly")
          .objectStore(SNAPSHOT_STORE)
          .get(playerId);
        request.addEventListener("success", () => resolve(request.result || null));
        request.addEventListener("error", () => reject(request.error));
      });
    } finally {
      database.close();
    }
  }

  async function cacheSnapshot(value) {
    if (playerId === "signed-out") return;
    const database = await openDatabase();
    try {
      await new Promise((resolve, reject) => {
        const request = database
          .transaction(SNAPSHOT_STORE, "readwrite")
          .objectStore(SNAPSHOT_STORE)
          .put(value, playerId);
        request.addEventListener("success", () => resolve());
        request.addEventListener("error", () => reject(request.error));
      });
    } finally {
      database.close();
    }
  }

  function containsForbiddenKey(value, visited = new WeakSet()) {
    if (!value || typeof value !== "object") return false;
    if (visited.has(value)) return false;
    visited.add(value);
    if (Array.isArray(value)) return value.some(item => containsForbiddenKey(item, visited));
    return Object.entries(value).some(([key, child]) => (
      FORBIDDEN_KEYS.has(String(key).toLowerCase()) || containsForbiddenKey(child, visited)
    ));
  }

  function isValidSnapshot(value) {
    if (
      ![1, 2].includes(value?.schemaVersion) ||
      !Array.isArray(value.records) ||
      value.records.length < 1 ||
      value.records.length > 50000 ||
      containsForbiddenKey(value)
    ) {
      return false;
    }

    return value.records.every(record => (
      Core.isCanonicalCoordinate(record?.coordinate) &&
      Number.isInteger(record?.tier) &&
      record.tier >= 1 &&
      record.tier <= 5 &&
      ["none", "gate", "critical"].includes(record?.gateType)
    ));
  }

  function inferredKingdomId(value) {
    const match = String(value?.records?.[0]?.coordinate || "").match(/^([1-9][0-9]*)-/);
    return match ? Number(match[1]) : null;
  }

  function upgradeLegacySnapshot(value) {
    if (value?.atlas?.topologySource === "official-metadata") {
      return {
        ...value,
        atlas: { ...value.atlas, majorEvent: null },
        records: value.records.map(record => ({
          ...record,
          shield: { ...record.shield, state: "unknown", endAt: null }
        }))
      };
    }
    if (value?.schemaVersion !== 1) return value;
    return {
      ...value,
      schemaVersion: 2,
      atlas: {
        ...LEGACY_ATLAS_CONFIG,
        kingdomId: inferredKingdomId(value),
        configObservedAt: Number(value.capturedAt) || null
      }
    };
  }

  function epochIso(value) {
    const seconds = Number(value);
    if (!Number.isFinite(seconds) || seconds <= 0) return null;
    const date = new Date(seconds * 1000);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  function commandShieldState(record, nowEpoch) {
    const effective = Core.effectiveShieldState(record?.shield, nowEpoch);
    if (effective === "down") return "vulnerable";
    const endAt = Number(record?.shield?.endAt);
    const timedStateExpired = Number.isFinite(endAt) && endAt <= nowEpoch;
    if (effective === "cooldown") return timedStateExpired ? "unknown" : "cooldown";
    if (effective === "active" || effective === "event") {
      if (effective === "active" && timedStateExpired) return "unknown";
      if (
        Number.isFinite(endAt) &&
        endAt > nowEpoch &&
        endAt - nowEpoch <= DROPPING_SOON_SECONDS
      ) {
        return "dropping";
      }
      return "shielded";
    }
    return "unknown";
  }

  function toCommandSnapshot(value, nowEpoch = Date.now() / 1000) {
    const records = Array.isArray(value?.records) ? value.records : [];
    const officialCount = records.filter(
      record => record?.source === "official"
    ).length;
    const snapshotSource = officialCount === records.length && records.length
      ? "War Dragons API"
      : officialCount > 0
        ? "Mixed Atlas sources"
        : "Atlas capture";
    return {
      source: snapshotSource,
      fetchedAt: epochIso(value?.lastLiveAt || value?.capturedAt),
      castles: records.slice(0, 50000).map((record, index) => {
        const shieldState = commandShieldState(record, nowEpoch);
        const shieldEnd = epochIso(record?.shield?.endAt);
        const guards = record?.guards;
        return {
          id: String(record?.coordinate || `atlas-castle-${index + 1}`),
          name: String(record?.name || record?.coordinate || `Castle ${index + 1}`),
          owner: String(record?.ownerTeam || ""),
          region: String(record?.regionName || record?.regionId || ""),
          level: Number.isInteger(record?.tier) ? record.tier : null,
          troops: guards === null || guards === undefined || guards === ""
            ? null
            : Number.isFinite(Number(guards))
              ? Number(guards)
              : null,
          fleets: Number.isInteger(record?.fleetCount) ? record.fleetCount : null,
          apr: Number.isInteger(record?.apr) ? record.apr : null,
          atlasRank: Number.isInteger(record?.atlasRank) ? record.atlasRank : null,
          fortLevel: Number.isInteger(record?.officialFort?.level)
            ? record.officialFort.level
            : null,
          shieldShipsUntilTrigger: record?.shield?.shipsUntilTrigger != null && Number.isFinite(Number(record.shield.shipsUntilTrigger))
            ? Math.max(0, Math.ceil(Number(record.shield.shipsUntilTrigger)))
            : null,
          observedAt: epochIso(record?.criticalObservedAt),
          mapCoordinates: Core.formatMapPosition(record?.mapPosition) || null,
          shieldState,
          shieldEndsAt: ["dropping", "shielded"].includes(shieldState) ? shieldEnd : null,
          cooldownEndsAt: shieldState === "cooldown" ? shieldEnd : null,
          /* A confirmed shield-down state is not, by itself, an
           * authoritative attackability claim. */
          attackable:
            record?.source === "official" &&
            record?.attackable === true,
          source: record?.source === "official" ? "War Dragons API" : "Atlas capture"
        };
      })
    };
  }

  function syncAtlasCommandSnapshot(value) {
    window.OnyxAtlasCommand?.setLiveSnapshot?.(toCommandSnapshot(value));
  }

  function setImportStatus(message, failed = false) {
    const status = get("atlasImportStatus");
    if (!status) return;
    status.textContent = message;
    status.dataset.state = failed ? "failed" : "ready";
  }

  function setImporting(importing) {
    get("atlasCaptureFile")?.toggleAttribute("disabled", importing);
    host?.querySelector(".atlas-import-button")?.classList.toggle("is-disabled", importing);
    get("atlasImportProgress")?.classList.toggle("hidden", !importing);
  }

  function setApiStatus(message, state = "pending") {
    const status = get("atlasApiStatus");
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  }

  function renderApiState() {
    const button = get("atlasLiveButton");
    if (!button) return;

    if (liveScanning) {
      button.disabled = false;
      button.textContent = "Stop scan";
      return;
    }
    if (!WarDragons) {
      setApiStatus("Live API unavailable", "failed");
      button.textContent = "Scan live";
      button.disabled = true;
      return;
    }
    if (apiState.reviewStatus === "checking") {
      setApiStatus("Checking API", "pending");
      button.textContent = "Scan live";
      button.disabled = true;
      return;
    }
    if (!apiState.signedIn) {
      setApiStatus("Sign in for live", "pending");
      button.textContent = "Scan live";
      button.disabled = true;
      return;
    }
    if (!apiState.connected && !apiState.readyToAuthorise) {
      setApiStatus("API approval pending", "pending");
      button.textContent = "Scan live";
      button.disabled = true;
      return;
    }
    if (!apiState.connected) {
      setApiStatus("API ready", "ready");
      button.textContent = "Connect API";
      button.disabled = false;
      return;
    }
    if (!Array.isArray(apiState.scopes) || !apiState.scopes.includes("atlas.read")) {
      setApiStatus("Atlas scope missing", "failed");
      button.textContent = "Scan live";
      button.disabled = true;
      return;
    }
    setApiStatus("Official API", "ready");
    button.textContent = snapshot ? "Scan live" : "Load official map";
    button.disabled = false;
  }

  function formatCaptureTime(epochSeconds) {
    const value = Number(epochSeconds);
    if (!Number.isFinite(value)) return "Capture loaded";
    return new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date(value * 1000));
  }

  function formatElapsed(seconds) {
    const value = Math.max(0, Math.round(Number(seconds) || 0));
    if (value < 60) return `${value}s`;
    if (value < 3600) return `${Math.round(value / 60)}m`;
    if (value < 86400) return `${Math.round(value / 3600)}h`;
    return `${Math.round(value / 86400)}d`;
  }

  function formatRemaining(endAt, nowEpoch) {
    const seconds = Number(endAt) - nowEpoch;
    return Number.isFinite(seconds) && seconds > 0 ? formatElapsed(seconds) : "";
  }

  function originalShieldLabel(state) {
    return ({
      down: "down",
      cooldown: "cooldown",
      active: "shielded",
      event: "event shield",
      disabled: "disabled",
      offline: "offline",
      notApplicable: "no shield"
    })[state] || "unchecked";
  }

  function shieldPresentation(record, nowEpoch) {
    const effective = Core.effectiveShieldState(record.shield, nowEpoch);
    const remaining = formatRemaining(record.shield?.endAt, nowEpoch);
    if (effective === "stale") {
      const age = formatElapsed(nowEpoch - Number(record.shield?.observedAt || 0));
      return { label: `Observed ${originalShieldLabel(record.shield?.state)} · ${age} ago`, state: "stale" };
    }
    if (effective === "down") {
      const untilTrigger = Number(record.shield?.shipsUntilTrigger);
      return {
        label: `Shield down${Number.isFinite(untilTrigger) ? ` · ${formatNumber(Math.ceil(untilTrigger))} to trigger` : ""}`,
        state: "down"
      };
    }
    if (effective === "cooldown") return { label: `Cooldown${remaining ? ` · ${remaining}` : ""}`, state: "cooldown" };
    if (effective === "active") return { label: `Shielded${remaining ? ` · ${remaining}` : ""}`, state: "active" };
    if (effective === "event") return { label: "Event shield", state: "active" };
    if (effective === "disabled") return { label: "Shield disabled", state: "inactive" };
    if (effective === "offline") return { label: "Infrastructure offline", state: "inactive" };
    if (effective === "notApplicable") return { label: "No shield", state: "inactive" };
    return { label: record.checked ? "Checked · shield timing unavailable" : "Not checked", state: "unknown" };
  }

  function readFilters() {
    return {
      tiers: Array.from(host?.querySelectorAll("[data-atlas-tier]:checked") || [])
        .map(input => Number(input.value)),
      query: get("atlasSearch")?.value || "",
      aprMin: get("atlasAprMin")?.value || null,
      aprMax: get("atlasAprMax")?.value || null,
      glory: get("atlasGloryFilter")?.value || "any",
      shield: get("atlasShieldFilter")?.value || "any",
      gate: get("atlasGateFilter")?.value || "any",
      sort: get("atlasSort")?.value || "glory"
    };
  }

  function applyFiltersToControls(filters) {
    const value = Core.normaliseFilters(filters);
    const selectedTiers = new Set(value.tiers);
    host?.querySelectorAll("[data-atlas-tier]").forEach(input => {
      input.checked = selectedTiers.has(Number(input.value));
    });
    get("atlasSearch").value = value.query;
    get("atlasAprMin").value = value.aprMin ?? "";
    get("atlasAprMax").value = value.aprMax ?? "";
    get("atlasGloryFilter").value = value.glory;
    get("atlasShieldFilter").value = value.shield;
    get("atlasGateFilter").value = value.gate;
    get("atlasSort").value = value.sort;
  }

  function loadFilters() {
    if (playerId === "signed-out") return Core.DEFAULT_FILTERS;
    try {
      return JSON.parse(window.localStorage.getItem(filterStorageKey()) || "null") || Core.DEFAULT_FILTERS;
    } catch {
      return Core.DEFAULT_FILTERS;
    }
  }

  function saveFilters(filters) {
    if (playerId === "signed-out") return;
    try {
      window.localStorage.setItem(filterStorageKey(), JSON.stringify(Core.normaliseFilters(filters)));
    } catch (error) {
      console.warn("[Onyx Atlas] Filters could not be saved.", error);
    }
  }

  function createBadge(label, type) {
    const badge = document.createElement("span");
    badge.className = `atlas-badge atlas-badge-${type}`;
    badge.textContent = label;
    return badge;
  }

  function createMetric(label, value, state = "") {
    const metric = document.createElement("div");
    const labelNode = document.createElement("span");
    const valueNode = document.createElement("strong");
    labelNode.textContent = label;
    valueNode.textContent = value;
    if (state) metric.dataset.state = state;
    metric.append(labelNode, valueNode);
    return metric;
  }

  function createCastleCard(record, nowEpoch) {
    const card = document.createElement("article");
    card.className = "glass-panel atlas-castle-card";
    const heading = document.createElement("header");
    const identity = document.createElement("div");
    const title = document.createElement("h4");
    const coordinate = document.createElement("code");
    title.textContent = record.name || record.coordinate;
    coordinate.textContent = `Castle ID: ${record.coordinate}`;
    identity.append(title, coordinate);
    const owner = document.createElement("p");
    owner.textContent = record.ownerTeam || "Owner not supplied";
    identity.append(owner);

    const badges = document.createElement("div");
    badges.className = "atlas-card-badges";
    badges.append(createBadge(`T${record.tier}`, "tier"));
    if (record.glory === "confirmed100") badges.append(createBadge("100%", "glory"));
    if (record.gateType === "critical") badges.append(createBadge("CRITICAL GATE", "critical"));
    else if (record.gateType === "gate") badges.append(createBadge("GATE", "gate"));
    heading.append(identity, badges);

    const shield = shieldPresentation(record, nowEpoch);
    const metrics = document.createElement("div");
    metrics.className = "atlas-card-metrics";
    metrics.append(
      createMetric("APR", record.apr === null ? "—" : formatNumber(record.apr)),
      createMetric("Glory", record.glory === "confirmed100" ? "100%" : record.glory === "needsData" ? "Check defender" : "—"),
      createMetric("Shield", shield.label, shield.state),
      createMetric("Guards", record.checked ? (record.guards === null ? "Unknown" : formatNumber(record.guards)) : "Not checked"),
      createMetric("Fort", Number.isInteger(record?.officialFort?.level) ? `Level ${record.officialFort.level}` : "Not supplied"),
      createMetric("Visible fleets", record.checked && Number.isInteger(record.fleetCount) ? formatNumber(record.fleetCount) : "Not checked")
    );

    const footer = document.createElement("footer");
    const location = document.createElement("span");
    const connected = Array.isArray(record.connectedRegions) && record.connectedRegions.length
      ? ` · ${record.connectedRegions.join(", ")}`
      : "";
    const mapCoordinates = Core.formatMapPosition(record.mapPosition);
    const checkedAge = record.checked && Number(record.criticalObservedAt) > 0
      ? ` · checked ${formatElapsed(Math.max(0, nowEpoch - Number(record.criticalObservedAt)))} ago`
      : "";
    location.textContent = `${record.regionName || record.regionId || "Atlas"}${connected} · ${mapCoordinates ? `API ${mapCoordinates} · game position unverified` : "API coordinates unavailable — scan live to refresh"}${checkedAge}`;
    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "atlas-copy-button";
    copy.dataset.atlasCopy = mapCoordinates;
    copy.textContent = "Copy API X/Y";
    copy.disabled = !mapCoordinates;
    const calculator = document.createElement("button");
    calculator.type = "button";
    calculator.className = "atlas-copy-button";
    calculator.textContent = "Calculate glory";
    calculator.addEventListener("click", () => window.OnyxAtlasCommand?.openGloryCalculator?.(record.name || record.coordinate));
    footer.append(location, copy, calculator);

    card.append(heading, metrics, footer);
    return card;
  }

  function renderResults() {
    const container = get("atlasResults");
    if (!container) return;
    container.replaceChildren();

    if (!snapshot) {
      const empty = document.createElement("div");
      empty.className = "glass-panel atlas-empty-state";
      empty.textContent = "Import an Atlas capture to load castles.";
      container.append(empty);
      get("atlasLoadMore")?.classList.add("hidden");
      return;
    }

    if (!filteredRecords.length) {
      const empty = document.createElement("div");
      empty.className = "glass-panel atlas-empty-state";
      if (observedDownFallbackCount > 0) {
        const title = document.createElement("p");
        const detail = document.createElement("small");
        const button = document.createElement("button");
        title.textContent = "No fresh shield-down matches.";
        detail.textContent = `${formatNumber(observedDownFallbackCount)} observed down in the capture · live check expired`;
        button.type = "button";
        button.className = "atlas-copy-button";
        button.dataset.atlasShowObservedDown = "true";
        button.textContent = `Show ${formatNumber(observedDownFallbackCount)} captured downs`;
        empty.append(title, detail, button);
      } else if (get("atlasShieldFilter")?.value === "down") {
        const title = document.createElement("p");
        const detail = document.createElement("small");
        const button = document.createElement("button");
        const nowEpoch = Date.now() / 1000;
        const hasFreshChecks = liveScanCandidates().some(record =>
          record.checked && Number(record.criticalObservedAt) > 0 &&
          nowEpoch - Number(record.criticalObservedAt) <= Core.LIVE_TTL_SECONDS
        );
        title.textContent = hasFreshChecks
          ? "No shield-down castles in this checked group."
          : "This group has not been live-checked yet.";
        detail.textContent = hasFreshChecks
          ? "Try another team or show castles that still need checking."
          : "Enter an exact team name, tap Check team API, then Scan live.";
        button.type = "button";
        button.className = "atlas-copy-button";
        button.dataset.atlasShowUnchecked = "true";
        button.textContent = "Show castles needing a check";
        empty.append(title, detail, button);
      } else {
        empty.textContent = "No castles match these filters.";
      }
      container.append(empty);
      get("atlasLoadMore")?.classList.add("hidden");
      return;
    }

    const nowEpoch = Date.now() / 1000;
    const fragment = document.createDocumentFragment();
    filteredRecords.slice(0, renderLimit).forEach(record => {
      fragment.append(createCastleCard(record, nowEpoch));
    });
    container.append(fragment);
    const loadMore = get("atlasLoadMore");
    loadMore?.classList.toggle("hidden", renderLimit >= filteredRecords.length);
    if (loadMore && renderLimit < filteredRecords.length) {
      loadMore.textContent = `Load more · ${formatNumber(filteredRecords.length - renderLimit)} remaining`;
    }
  }

  function renderSnapshotSummary() {
    const summary = snapshot?.summary || {};
    const nowEpoch = Date.now() / 1000;
    const freshChecked = (snapshot?.records || []).filter(record =>
      record.checked && Number(record.criticalObservedAt) > 0 &&
      nowEpoch - Number(record.criticalObservedAt) <= Core.LIVE_TTL_SECONDS
    ).length;
    get("atlasIndexedCount").textContent = formatNumber(summary.indexedCount || 0);
    get("atlasCheckedCount").textContent = formatNumber(freshChecked);
    get("atlasMatchCount").textContent = formatNumber(filteredRecords.length);
    const sourceDates = get("atlasSourceDates");
    if (sourceDates) {
      const formatSourceDate = value => {
        const iso = epochIso(value);
        return iso ? new Date(iso).toLocaleString("en-AU") : "not supplied";
      };
      const shieldContext = readShieldContext(nowEpoch);
      sourceDates.textContent = snapshot?.atlas?.topologySource === "official-metadata"
        ? `API map: ${snapshot.atlas.realmName}, kingdom ${snapshot.atlas.kingdomId}. Castle catalogue updated: ${formatSourceDate(snapshot.castleUpdatedAt)}. Team catalogue updated: ${formatSourceDate(snapshot.teamUpdatedAt)}. Map match remains unverified. ${shieldContext ? "PvP shields down is player-confirmed." : "PvP shield context is unverified."}`
        : "";
      const query = String(get("atlasSearch")?.value || "").trim().toLocaleLowerCase("en-AU");
      if (query && snapshot?.atlas?.topologySource === "official-metadata" && Array.isArray(snapshot.teams)) {
        const teams = snapshot.teams.filter(team => typeof team.name === "string" && team.name.toLocaleLowerCase("en-AU").includes(query));
        sourceDates.textContent += teams.length
          ? ` Team directory matches: ${teams.slice(0, 5).map(team => `${team.name} (capital ID: ${team.capitalId || "not supplied"})`).join("; ")}.`
          : " No matching team name in this API team directory.";
      }
    }
  }

  function applyFilters({ persist = true } = {}) {
    const filters = readFilters();
    const nowEpoch = Date.now() / 1000;
    const records = snapshot?.records || [];
    const result = Core.filterCastles(records, filters, nowEpoch);
    const error = get("atlasFilterError");
    error.textContent = result.error;
    error.classList.toggle("hidden", !result.error);
    filteredRecords = result.records;
    observedDownFallbackCount = 0;
    if (!result.error && !filteredRecords.length && result.filters.shield === "down") {
      observedDownFallbackCount = Core.filterCastles(
        records,
        { ...result.filters, shield: "observedDown" },
        nowEpoch
      ).records.length;
    }
    renderLimit = PAGE_SIZE;
    if (persist && !result.error) saveFilters(result.filters);
    renderSnapshotSummary();
    get("atlasResultSummary").textContent = `${formatNumber(filteredRecords.length)} result${filteredRecords.length === 1 ? "" : "s"}`;
    renderResults();
  }

  function scheduleFilters() {
    window.clearTimeout(filterTimer);
    filterTimer = window.setTimeout(() => applyFilters(), 120);
  }

  async function fallbackCopy(value) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.append(textarea);
    textarea.select();
    textarea.setSelectionRange(0, value.length);
    const copied = document.execCommand?.("copy") === true;
    textarea.remove();
    if (!copied) throw new Error("Copy failed.");
  }

  async function copyCoordinate(button) {
    const coordinate = String(button.dataset.atlasCopy || "");
    if (!/^X:-?\d+(?:\.\d+)? Y:-?\d+(?:\.\d+)?$/.test(coordinate)) return;
    try {
      if (window.navigator.clipboard?.writeText) {
        await window.navigator.clipboard.writeText(coordinate);
      } else {
        await fallbackCopy(coordinate);
      }
      get("atlasCopyStatus").textContent = `${coordinate} copied`;
      const previous = button.textContent;
      button.textContent = "Copied";
      window.setTimeout(() => { button.textContent = previous; }, 1400);
    } catch {
      try {
        await fallbackCopy(coordinate);
        get("atlasCopyStatus").textContent = `${coordinate} copied`;
      } catch {
        get("atlasCopyStatus").textContent = "Coordinates could not be copied.";
      }
    }
  }

  async function activateSnapshot(value, { save = false } = {}) {
    if (!isValidSnapshot(value)) throw new Error("The derived Atlas snapshot failed validation.");
    const prepared = applyOfficialShieldContext(upgradeLegacySnapshot(value));
    snapshot = prepared;
    if (save || prepared !== value) {
      try {
        await cacheSnapshot(prepared);
      } catch (error) {
        console.warn("[Onyx Atlas] The derived snapshot could not be cached.", error);
      }
    }
    syncAtlasCommandSnapshot(prepared);
    const latestLiveAt = Number(prepared.lastLiveAt || prepared.capturedAt || 0);
    const captureAge = Math.max(0, (Date.now() / 1000) - latestLiveAt);
    const freshness = captureAge > Core.LIVE_TTL_SECONDS
      ? `live checks ${formatElapsed(captureAge)} old`
      : "live checks fresh";
    setImportStatus(`${formatCaptureTime(prepared.capturedAt)} · ${formatNumber(prepared.summary?.indexedCount)} castles · ${freshness}`);
    applyFilters({ persist: false });
    renderApiState();
  }

  function stopWorker() {
    activeWorker?.terminate();
    activeWorker = null;
    setImporting(false);
    const input = get("atlasCaptureFile");
    if (input) input.value = "";
  }

  function importCapture(file) {
    if (!file) return;
    stopWorker();
    setImporting(true);
    setImportStatus("Opening Atlas capture");
    const progressBar = get("atlasImportProgress");
    progressBar.value = 1;
    progressBar.textContent = "1%";
    activeWorker = new Worker("onyx-atlas-har-worker.js?v=20260922-shield-context-1");

    activeWorker.addEventListener("message", async event => {
      if (event.data?.type === "progress") {
        progressBar.value = Number(event.data.value) || 0;
        progressBar.textContent = `${progressBar.value}%`;
        setImportStatus(event.data.message || "Scanning Atlas");
        return;
      }
      if (event.data?.type === "error") {
        setImportStatus(event.data.message || "Atlas import failed.", true);
        stopWorker();
        return;
      }
      if (event.data?.type === "complete") {
        try {
          await activateSnapshot(event.data.snapshot, { save: true });
        } catch (error) {
          setImportStatus(error.message || "Atlas import failed.", true);
        } finally {
          stopWorker();
        }
      }
    });

    activeWorker.addEventListener("error", () => {
      setImportStatus("Atlas import stopped unexpectedly.", true);
      stopWorker();
    });
    activeWorker.postMessage({ type: "parse", file });
  }

  function wait(milliseconds) {
    return new Promise(resolve => window.setTimeout(resolve, milliseconds));
  }

  function atlasIdentity() {
    return {
      kingdomId: Number(snapshot?.atlas?.kingdomId) || inferredKingdomId(snapshot) || DEFAULT_KINGDOM_ID,
      realmName: String(snapshot?.atlas?.realmName || DEFAULT_REALM_NAME)
    };
  }

  function liveScanCandidates() {
    const filters = readFilters();
    return Core.filterCastles(
      snapshot?.records || [],
      { ...filters, shield: "any" },
      Date.now() / 1000
    ).records;
  }

  async function requestCriticalBatch(castleIds) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await WarDragons.atlasCritical(castleIds);
      } catch (error) {
        if (error?.code !== "rate-limited" || attempt === 2) throw error;
        await wait(Math.max(LIVE_BATCH_INTERVAL_MS, Number(error.retryAfterMs) || 0));
      }
    }
    throw new Error("Live Atlas pacing failed.");
  }

  let teamLookupAfter = 0;
  async function checkOfficialTeam() {
    const button = get("atlasTeamLookup");
    const output = get("atlasTeamResult");
    const teamName = String(get("atlasTeamName")?.value || "").trim();
    const directoryTeam = snapshot?.teams?.find(team =>
      String(team?.name || "").toLocaleLowerCase("en-AU") === teamName.toLocaleLowerCase("en-AU")
    ) || null;
    if (!teamName || !WarDragons?.atlasTeam || button.disabled) return;
    if (Date.now() < teamLookupAfter) {
      output.textContent = `Team lookup available in ${Math.ceil((teamLookupAfter - Date.now()) / 1000)}s.`;
      return;
    }
    button.disabled = true;
    teamLookupAfter = Date.now() + 61000;
    output.textContent = `Checking ${teamName} directly…`;
    if (directoryTeam) {
      const search = get("atlasSearch");
      if (search) search.value = directoryTeam.name;
      applyFilters();
    }
    try {
      const result = await WarDragons.atlasTeam({ ...atlasIdentity(), teamName });
      const team = result.teams?.[0];
      if (team) {
        const search = get("atlasSearch");
        if (search) search.value = team.name;
        applyFilters();
      }
      output.textContent = team
        ? `${team.name} returned by the team API. Target list narrowed to that team · tap Scan live to check its castles.`
        : `The team API returned no matching entry for ${teamName} on ${result.realmName}, kingdom ${result.kingdomId}. This does not establish that the team is absent from your game map.`;
    } catch (error) {
      output.textContent = directoryTeam
        ? `${directoryTeam.name} matched the loaded team directory and the target list is narrowed · tap Scan live. Direct team lookup is temporarily unavailable.`
        : `Team lookup failed: ${error.message || "official source unavailable"}`;
    } finally {
      button.disabled = false;
    }
  }

  async function refreshOfficialAtlas() {
    if (!WarDragons || liveScanning) return;
    liveScanning = true;
    cancelLiveScan = false;
    renderApiState();
    setApiStatus("Refreshing catalogue", "working");

    try {
      let identity = atlasIdentity();
      let loadedCatalogue = false;
      if (!identity.kingdomId || !identity.realmName) {
        throw new Error("Atlas map identity is unavailable.");
      }

      if (WarDragons.atlasContext) {
        try {
          setApiStatus("Finding your Atlas kingdom", "working");
          const context = await WarDragons.atlasContext();
          const discoveredKingdomId = Number(context?.kingdomId);
          if (Number.isSafeInteger(discoveredKingdomId) && discoveredKingdomId > 0) {
            identity = { ...identity, kingdomId: discoveredKingdomId };
          }
        } catch {
          // Older API connections may not expose recent team battles. The
          // cached/imported map identity remains a safe fallback.
        }
      }

      try {
        const macro = await WarDragons.atlasMacro(identity);
        const sameMap = snapshot &&
          Number(snapshot.atlas?.kingdomId) === identity.kingdomId &&
          String(snapshot.atlas?.realmName || "") === identity.realmName;
        if (sameMap) {
          snapshot = Core.mergeOfficialMacro(snapshot, macro);
          await cacheSnapshot(snapshot).catch(() => undefined);
          syncAtlasCommandSnapshot(snapshot);
          applyFilters({ persist: false });
        } else {
          const officialSnapshot = Core.createOfficialSnapshot(macro, identity);
          if (!officialSnapshot) {
            throw new Error("Official Atlas metadata did not contain a usable castle map.");
          }
          await activateSnapshot(officialSnapshot, { save: true });
          loadedCatalogue = true;
        }
      } catch (error) {
        if (["authorisation_required", "scope_required", "pending_review"].includes(error?.code)) {
          throw error;
        }
        if (!snapshot) throw error;
        setImportStatus("Using cached catalogue · live scan continuing");
      }

      if (loadedCatalogue) {
        setImportStatus("Official map loaded · narrow the filters, then scan live");
        return;
      }

      let candidates = liveScanCandidates();
      if (!candidates.length) {
        setImportStatus("No known matches. Select Any shield state or Not checked / stale to discover new results.");
        return;
      }
      if (candidates.length > MAX_LIVE_SCAN_CASTLES) {
        candidates = [...candidates].sort((a, b) =>
          (Number(a.criticalObservedAt) || 0) - (Number(b.criticalObservedAt) || 0)
        ).slice(0, LIVE_BATCH_SIZE);
        setImportStatus("Checking the next 25 matching castles · oldest observations first");
      }

      let infoNote = "";
      const infoTargets = candidates.filter(record => !record.infoObservedAt || Date.now() / 1000 - record.infoObservedAt > 3600).slice(0, 25);
      if (infoTargets.length) {
        try {
          setApiStatus("Loading castle names", "working");
          const details = await WarDragons.atlasInfo(infoTargets.map(record => record.coordinate));
          snapshot = Core.mergeOfficialInfo(snapshot, details);
          await cacheSnapshot(snapshot).catch(() => undefined);
          syncAtlasCommandSnapshot(snapshot);
          applyFilters({ persist: false });
          if (candidates.length > infoTargets.length) infoNote = " · names loaded for this detail batch";
        } catch (error) {
          infoNote = error?.code === "info-rate-limited"
            ? ` · name lookup available in ${Math.ceil(error.retryAfterMs / 1000)}s`
            : " · castle details unavailable";
        }
      }
      let processed = 0;
      for (let offset = 0; offset < candidates.length; offset += LIVE_BATCH_SIZE) {
        if (cancelLiveScan) break;
        const startedAt = Date.now();
        const batch = candidates
          .slice(offset, offset + LIVE_BATCH_SIZE)
          .map(record => record.coordinate);
        const live = await requestCriticalBatch(batch);
        snapshot = Core.mergeOfficialCritical(snapshot, live);
        processed += batch.length;
        setApiStatus(`Live ${formatNumber(processed)}/${formatNumber(candidates.length)}`, "working");

        {
          syncAtlasCommandSnapshot(snapshot);
          applyFilters({ persist: false });
          await cacheSnapshot(snapshot).catch(() => undefined);
        }
        if (offset + LIVE_BATCH_SIZE < candidates.length && !cancelLiveScan) {
          const remaining = LIVE_BATCH_INTERVAL_MS - (Date.now() - startedAt);
          if (remaining > 0) await wait(remaining);
        }
      }

      await cacheSnapshot(snapshot).catch(() => undefined);
      syncAtlasCommandSnapshot(snapshot);
      setImportStatus(
        cancelLiveScan
          ? `Live scan stopped · ${formatNumber(processed)} checked`
          : `Live scan complete · ${formatNumber(processed)} requested${infoNote}`,
      );
      applyFilters({ persist: false });
    } catch (error) {
      setImportStatus(error?.message || "Live Atlas refresh failed.", true);
      if (["authorisation_required", "scope_required", "pending_review"].includes(error?.code)) {
        try { handleConnectionState({ detail: WarDragonsAuth?.getStatus?.() || {} }); } catch { /* keep current state */ }
      }
    } finally {
      liveScanning = false;
      cancelLiveScan = false;
      renderApiState();
    }
  }

  async function handleLiveButton() {
    if (liveScanning) {
      cancelLiveScan = true;
      setApiStatus("Stopping scan", "working");
      return;
    }
    if (!apiState.connected && !apiState.readyToAuthorise) return;
    if (!apiState.connected) {
      try {
        setApiStatus("Opening War Dragons", "working");
        const started = await WarDragonsAuth?.beginAuthorization?.();
        if (!started) throw new Error("War Dragons authorisation is not ready yet.");
      } catch (error) {
        setImportStatus(error?.message || "War Dragons authorisation could not start.", true);
        renderApiState();
      }
      return;
    }
    await refreshOfficialAtlas();
  }

  async function initialiseOfficialApi() {
    if (!WarDragons || !WarDragonsAuth) {
      renderApiState();
      return;
    }
    try {
      const status = WarDragonsAuth.getStatus?.() || {};
      apiState = {
        signedIn: playerId !== "signed-out",
        connected: status.connected === true,
        readyToAuthorise: status.readyToAuthorise === true,
        reviewStatus: status.reviewStatus === "ready" ? "ready" : "pending_review",
        scopes: Array.isArray(status.scopes) ? status.scopes : []
      };
    } catch (error) {
      apiState = {
        signedIn: playerId !== "signed-out",
        connected: false,
        readyToAuthorise: false,
        reviewStatus: error?.code === "pending_review" ? "pending_review" : "unavailable",
        scopes: []
      };
      if (error?.code !== "pending_review") {
        setImportStatus(error?.message || "Live API status is unavailable.", true);
      }
    }
    renderApiState();
  }

  function handleConnectionState(event) {
    const status = event?.detail && typeof event.detail === "object"
      ? event.detail
      : WarDragonsAuth?.getStatus?.() || {};
    apiState = {
      signedIn: playerId !== "signed-out",
      connected: status.connected === true,
      readyToAuthorise: status.readyToAuthorise === true,
      reviewStatus: status.reviewStatus === "ready" ? "ready" : "pending_review",
      scopes: Array.isArray(status.scopes) ? status.scopes : []
    };
    if (host?.isConnected) renderApiState();
  }

  function renderShell() {
    return `<div class="onyx-atlas-hunter">
      <div class="atlas-command-heading">
        <div class="atlas-command-actions">
          <span id="atlasApiStatus" class="onyx-status-chip atlas-api-status" data-state="pending" aria-live="polite">Checking API</span>
          <button id="atlasLiveButton" type="button" class="button atlas-live-button" disabled>Scan live</button>
          <label class="button atlas-import-button" for="atlasCaptureFile">Import capture</label>
        </div>
        <input id="atlasCaptureFile" class="atlas-file-input" type="file" accept=".har,.zip,.har.zip,application/json,application/zip">
      </div>

      <section class="glass-panel atlas-command-hero">
        <div><p class="eyebrow">ATLAS CASTLE HUNTER</p><h2>Find the next target</h2></div>
        <div class="atlas-capture-stats" aria-label="Atlas capture summary">
          <div><span>Indexed</span><strong id="atlasIndexedCount">0</strong></div>
          <div><span>Live checked</span><strong id="atlasCheckedCount">0</strong></div>
          <div><span>Matches</span><strong id="atlasMatchCount">0</strong></div>
        </div>
        <p id="atlasImportStatus" class="atlas-import-status" role="status" aria-live="polite">No Atlas capture loaded</p>
        <p id="atlasSourceDates" class="atlas-import-status"></p>
        <fieldset class="atlas-shield-context">
          <legend>Current PvP shield context</legend>
          <label for="atlasPvpShieldsDown">
            <input id="atlasPvpShieldsDown" type="checkbox">
            <span><strong>PvP shields are down</strong><small>Use the live fort data to calculate troops remaining until each shield triggers.</small></span>
          </label>
          <p id="atlasShieldContextStatus" class="atlas-import-status">Unverified · Onyx will keep live shield vulnerability unknown.</p>
        </fieldset>
        <div class="atlas-filter-grid">
          <label class="atlas-filter-wide" for="atlasTeamName"><span>Exact team name</span>
            <input id="atlasTeamName" type="text" maxlength="120" autocomplete="off" placeholder="SeveredReality">
          </label>
          <button id="atlasTeamLookup" type="button" class="button atlas-live-button">Check team API</button>
        </div>
        <p id="atlasTeamResult" class="atlas-import-status" role="status" aria-live="polite"></p>
        <progress id="atlasImportProgress" class="atlas-import-progress hidden" max="100" value="0">0%</progress>
      </section>

      <section class="glass-panel atlas-filter-panel" aria-labelledby="atlasFilterTitle">
        <div class="onyx-section-heading atlas-filter-heading">
          <div><p class="eyebrow">TARGET FILTERS</p><h3 id="atlasFilterTitle">Narrow the map</h3></div>
          <button id="atlasResetFilters" type="button" class="atlas-text-button">Reset</button>
        </div>

        <fieldset class="atlas-tier-fieldset">
          <legend>Castle tier</legend>
          <div class="atlas-tier-chips">
            <label><input type="checkbox" value="2" data-atlas-tier checked><span>T2</span></label>
            <label><input type="checkbox" value="3" data-atlas-tier checked><span>T3</span></label>
            <label><input type="checkbox" value="4" data-atlas-tier checked><span>T4</span></label>
            <label><input type="checkbox" value="5" data-atlas-tier checked><span>T5</span></label>
          </div>
        </fieldset>

        <div class="atlas-filter-grid">
          <label class="atlas-filter-wide" for="atlasSearch"><span>Castle, team, castle ID or X/Y</span><input id="atlasSearch" type="search" autocomplete="off" placeholder="Name or X:-310.5"></label>
          <label for="atlasAprMin"><span>APR minimum</span><input id="atlasAprMin" type="number" min="0" step="1" inputmode="numeric" placeholder="Any"></label>
          <label for="atlasAprMax"><span>APR maximum</span><input id="atlasAprMax" type="number" min="0" step="1" inputmode="numeric" placeholder="Any"></label>
          <label for="atlasGloryFilter"><span>Glory</span><select id="atlasGloryFilter"><option value="any">Any glory</option><option value="confirmed100">100% confirmed</option><option value="needsData">Needs defender data</option></select></label>
          <label for="atlasShieldFilter"><span>Shield</span><select id="atlasShieldFilter"><option value="any">Any shield state</option><option value="down">Shield down now</option><option value="observedDown">Observed down in capture</option><option value="cooldown">Cooldown</option><option value="shielded">Shielded / bubbled</option><option value="inactive">Offline / disabled</option><option value="notChecked">Not checked / stale</option></select></label>
          <label for="atlasGateFilter"><span>Gate</span><select id="atlasGateFilter"><option value="any">Any castle</option><option value="gate">Gate castles</option><option value="critical">Critical gates</option><option value="none">Non-gates</option></select></label>
          <label for="atlasSort"><span>Sort</span><select id="atlasSort"><option value="glory">Best glory</option><option value="shield">Shield opportunity</option><option value="aprDesc">APR high to low</option><option value="aprAsc">APR low to high</option><option value="tierDesc">Tier high to low</option><option value="coordinate">Castle ID</option></select></label>
        </div>
        <p id="atlasFilterError" class="atlas-filter-error hidden" role="alert"></p>
      </section>

      <section class="atlas-results-section" aria-labelledby="atlasResultsTitle">
        <div class="onyx-section-heading atlas-results-heading">
          <div><p class="eyebrow">CASTLE LIST</p><h3 id="atlasResultsTitle">Available targets</h3></div>
          <span id="atlasResultSummary" class="onyx-status-chip" aria-live="polite">0 results</span>
        </div>
        <div id="atlasResults" class="atlas-results" aria-live="polite"><div class="glass-panel atlas-empty-state">Import an Atlas capture to load castles.</div></div>
        <button id="atlasLoadMore" type="button" class="button secondary-button full-width-button hidden">Load more castles</button>
        <p id="atlasCopyStatus" class="atlas-copy-status" role="status" aria-live="polite"></p>
      </section>
    </div>`;
  }

  function bindEvents() {
    get("atlasCaptureFile")?.addEventListener("change", event => {
      importCapture(event.target.files?.[0] || null);
    });
    host?.querySelectorAll(
      "[data-atlas-tier], #atlasSearch, #atlasAprMin, #atlasAprMax, #atlasGloryFilter, #atlasShieldFilter, #atlasGateFilter, #atlasSort"
    ).forEach(control => {
      control.addEventListener(control.matches("input[type='search'], input[type='number']") ? "input" : "change", scheduleFilters);
    });
    get("atlasResetFilters")?.addEventListener("click", () => {
      applyFiltersToControls(Core.DEFAULT_FILTERS);
      applyFilters();
    });
    get("atlasLoadMore")?.addEventListener("click", () => {
      renderLimit += PAGE_SIZE;
      renderResults();
    });
    get("atlasTeamLookup")?.addEventListener("click", checkOfficialTeam);
    get("atlasLiveButton")?.addEventListener("click", handleLiveButton);
    get("atlasPvpShieldsDown")?.addEventListener("change", event => {
      setPvpShieldContext(event.currentTarget.checked);
    });
    get("atlasResults")?.addEventListener("click", event => {
      const observedDown = event.target.closest("[data-atlas-show-observed-down]");
      if (observedDown) {
        get("atlasShieldFilter").value = "observedDown";
        applyFilters();
        return;
      }
      const unchecked = event.target.closest("[data-atlas-show-unchecked]");
      if (unchecked) {
        get("atlasShieldFilter").value = "notChecked";
        applyFilters();
        return;
      }
      const button = event.target.closest("[data-atlas-copy]");
      if (button) copyCoordinate(button);
    });
  }

  async function initialise(generation) {
    bindEvents();
    renderApiState();
    const nextPlayerId = await resolvePlayerId();
    if (generation !== mountGeneration || !host?.isConnected) return;
    playerId = nextPlayerId;
    await syncShieldContextFromCloud();
    if (generation !== mountGeneration || !host?.isConnected) return;
    syncShieldContextControl();
    applyFiltersToControls(loadFilters());
    if (loadedPlayerId === playerId && snapshot) {
      snapshot = applyOfficialShieldContext(snapshot);
      applyFilters({ persist: false });
      await initialiseOfficialApi();
      return;
    }
    loadedPlayerId = playerId;
    snapshot = null;
    try {
      const cached = await readCachedSnapshot();
      if (generation !== mountGeneration || !host?.isConnected) return;
      if (cached) await activateSnapshot(cached);
      else applyFilters({ persist: false });
    } catch (error) {
      console.warn("[Onyx Atlas] Cached castle data could not be restored.", error);
      applyFilters({ persist: false });
    }
    await initialiseOfficialApi();
  }

  function mount(target) {
    if (!(target instanceof Element)) return false;
    host = target;
    mountGeneration += 1;
    const generation = mountGeneration;
    host.innerHTML = renderShell();
    initialise(generation);
    return true;
  }

  function unmount() {
    mountGeneration += 1;
    cancelLiveScan = true;
    if (activeWorker) stopWorker();
  }

  window.addEventListener?.("onyx-war-dragons-connection", handleConnectionState);
  window.OnyxAtlasCastleHunter = Object.freeze({
    mount,
    unmount,
    toCommandSnapshot
  });
})(window, document);
