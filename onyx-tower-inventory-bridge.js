/* ============================================================
   ONYX COMMAND — PRIVATE TOWER INVENTORY BRIDGE

   Reads a parsed HAR in browser memory and exposes only a
   sanitised tower inventory snapshot. It deliberately does not
   retain the capture, request URLs, account identifiers, tower
   identifiers, coordinates, islands or slot positions.
   ============================================================ */

(function installOnyxTowerInventoryBridge(window) {
  "use strict";

  const IMPORT_EVENT = "onyx:tower-inventory-imported";
  const CLEAR_EVENT = "onyx:tower-inventory-cleared";
  const MAX_ENTRIES = 5000;
  const MAX_RESPONSE_CHARACTERS = 12_000_000;
  const MAX_SCAN_DEPTH = 32;
  const MAX_SCANNED_OBJECTS = 250_000;

  /*
   * These aliases are already present in Onyx's reviewed public tower
   * catalogue/restriction data. Unreviewed capture-only identifiers are not
   * accepted automatically.
   */
  const DEFAULT_ALIASES = Object.freeze({
    lightningTower: "Lightning Tower",
    stormTower: "Storm Tower",
    elementalFlakDark: "Dark Flak Tower",
    elementalFlakFire: "Fire Flak Tower",
    elementalFlakIce: "Ice Flak Tower",
    elementalFlakWind: "Electro-Flak Tower",
    elementalFlakEarth: "Earth Flak Tower",
    crystalHowitzer: "Crystal Howitzer",
    drainTower: "Drakul Pylon",
    E20Q4Tower: "Cosmic Orrery",
    burnTower: "Fire Turret",
    soulDrainTower: "Soul Drain Tower",
    nexusTower: "Nexus Tower",
    nullSpire: "Nullspire Tower"
  });

  const EXPLICIT_TYPE_KEYS = [
    "tower",
    "tower_type",
    "towerType",
    "tower_name",
    "towerName",
    "building_type",
    "buildingType"
  ];

  const GENERIC_TYPE_KEYS = ["type", "name"];
  const MARKER_KEYS = [
    "entity_type",
    "entityType",
    "object_type",
    "objectType",
    "category",
    "kind"
  ];

  const LEVEL_KEYS = [
    "tower_level",
    "towerLevel",
    "building_level",
    "buildingLevel",
    "level",
    "lvl"
  ];

  const LOCATION_KEYS = [
    "tower_location",
    "towerLocation",
    "building_location",
    "buildingLocation",
    "storage_state",
    "storageState",
    "location"
  ];

  const QUANTITY_KEYS = [
    "tower_quantity",
    "towerQuantity",
    "quantity"
  ];

  const STORED_FLAG_KEYS = [
    "stored",
    "is_stored",
    "isStored",
    "in_storage",
    "inStorage"
  ];

  const PLACED_FLAG_KEYS = [
    "placed",
    "is_placed",
    "isPlaced",
    "on_base",
    "onBase"
  ];

  const STORAGE_LABELS = new Set([
    "inventory",
    "stash",
    "storage",
    "stored"
  ]);

  const BASE_LABELS = new Set([
    "active",
    "base",
    "deployed",
    "placed"
  ]);

  let memorySnapshot = null;
  const subscribers = new Set();

  function own(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
  }

  function isObject(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function isHar(value) {
    return Boolean(
      isObject(value) &&
      isObject(value.log) &&
      Array.isArray(value.log.entries)
    );
  }

  function normaliseToken(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "");
  }

  function strictInteger(value, minimum, maximum) {
    if (
      typeof value === "string" &&
      !/^\d+$/.test(value.trim())
    ) {
      return null;
    }

    const number = Number(value);
    return Number.isInteger(number) &&
      number >= minimum &&
      number <= maximum
      ? number
      : null;
  }

  function catalogue() {
    const value = window.NoirBaseCatalog;
    return isObject(value) ? value : {};
  }

  function buildTowerIndex(aliases = {}) {
    const levels = catalogue().towerLevels;

    if (!isObject(levels)) {
      throw new Error(
        "Tower catalogue intelligence is unavailable."
      );
    }

    const index = new Map();
    const exactNames = new Set();

    Object.entries(levels).forEach(([name, rows]) => {
      if (!name || !Array.isArray(rows) || !rows.length) {
        return;
      }

      exactNames.add(name);
      const token = normaliseToken(name);
      const matches = index.get(token) || new Set();
      matches.add(name);
      index.set(token, matches);
    });

    const reviewedAliases = isObject(aliases)
      ? { ...DEFAULT_ALIASES, ...aliases }
      : DEFAULT_ALIASES;

    Object.entries(reviewedAliases).forEach(([alias, target]) => {
      if (
        typeof alias !== "string" ||
        typeof target !== "string" ||
        !exactNames.has(target)
      ) {
        return;
      }

      const token = normaliseToken(alias);
      if (!token) return;
      const matches = index.get(token) || new Set();
      matches.add(target);
      index.set(token, matches);
    });

    return { index, levels };
  }

  function resolveTowerName(value, towerIndex) {
    if (typeof value !== "string") return "";
    const matches = towerIndex.index.get(
      normaliseToken(value)
    );
    return matches?.size === 1
      ? Array.from(matches)[0]
      : "";
  }

  function hasTowerMarker(object) {
    return MARKER_KEYS.some(key => {
      if (!own(object, key)) return false;
      const marker = normaliseToken(object[key]);
      return marker === "tower" ||
        marker === "defensivetower" ||
        marker === "towerbuilding";
    });
  }

  function candidateTypeValues(object) {
    const explicit = EXPLICIT_TYPE_KEYS
      .filter(key => own(object, key))
      .map(key => object[key]);

    if (explicit.length) return explicit;
    if (!hasTowerMarker(object)) return [];

    return GENERIC_TYPE_KEYS
      .filter(key => own(object, key))
      .map(key => object[key]);
  }

  function resolveSingleValue(values, resolver) {
    if (!values.length) return null;
    const resolved = values.map(resolver);

    if (resolved.some(value => value === null || value === "")) {
      return null;
    }

    const unique = new Set(resolved);
    return unique.size === 1 ? resolved[0] : null;
  }

  function resolveLocation(object) {
    const signals = [];

    LOCATION_KEYS.forEach(key => {
      if (!own(object, key)) return;
      const value = normaliseToken(object[key]);
      if (STORAGE_LABELS.has(value)) signals.push("storage");
      if (BASE_LABELS.has(value)) signals.push("base");
    });

    STORED_FLAG_KEYS.forEach(key => {
      if (!own(object, key) || typeof object[key] !== "boolean") {
        return;
      }
      signals.push(object[key] ? "storage" : "base");
    });

    PLACED_FLAG_KEYS.forEach(key => {
      if (
        own(object, key) &&
        object[key] === true
      ) {
        signals.push("base");
      }
    });

    const unique = new Set(signals);
    return unique.size === 1 ? signals[0] : "";
  }

  function resolveLevel(object) {
    const values = LEVEL_KEYS
      .filter(key => own(object, key))
      .map(key => object[key]);

    return resolveSingleValue(
      values,
      value => strictInteger(value, 1, 999)
    );
  }

  function resolveQuantity(object) {
    const values = QUANTITY_KEYS
      .filter(key => own(object, key))
      .map(key => object[key]);

    if (!values.length) return 1;
    return resolveSingleValue(
      values,
      value => strictInteger(value, 1, 500)
    );
  }

  function inspectTowerCandidate(object, towerIndex) {
    const typeValues = candidateTypeValues(object);
    if (!typeValues.length) {
      return { status: "not-candidate" };
    }

    const type = resolveSingleValue(
      typeValues,
      value => resolveTowerName(value, towerIndex)
    );

    if (!type) {
      return { status: "rejected", reason: "type" };
    }

    const level = resolveLevel(object);
    if (!level) {
      return { status: "rejected", reason: "level" };
    }

    const exactLevel = towerIndex.levels[type]
      .some(row => Number(row?.level) === level);

    if (!exactLevel) {
      return {
        status: "rejected",
        reason: "catalogue-level"
      };
    }

    const location = resolveLocation(object);
    if (!location) {
      return { status: "rejected", reason: "location" };
    }

    const quantity = resolveQuantity(object);
    if (!quantity) {
      return { status: "rejected", reason: "quantity" };
    }

    return {
      status: "accepted",
      record: {
        type,
        level,
        location,
        quantity,
        evidence: "catalogue-row-and-explicit-location"
      }
    };
  }

  function aggregateRecords(records) {
    const grouped = new Map();

    records.forEach(record => {
      const key = [
        record.type,
        record.level,
        record.location
      ].join("\u0000");

      const existing = grouped.get(key);
      if (existing) {
        existing.quantity += record.quantity;
      } else {
        grouped.set(key, { ...record });
      }
    });

    return Array.from(grouped.values())
      .sort((left, right) =>
        left.location.localeCompare(right.location) ||
        left.type.localeCompare(right.type) ||
        left.level - right.level
      );
  }

  function scanPayload(payload, towerIndex) {
    const records = [];
    const rejected = {
      type: 0,
      level: 0,
      "catalogue-level": 0,
      location: 0,
      quantity: 0
    };
    const visited = new WeakSet();
    let scannedObjects = 0;

    function visit(value, depth) {
      if (
        !value ||
        typeof value !== "object" ||
        depth > MAX_SCAN_DEPTH ||
        scannedObjects >= MAX_SCANNED_OBJECTS ||
        visited.has(value)
      ) {
        return;
      }

      visited.add(value);
      scannedObjects += 1;

      if (Array.isArray(value)) {
        value.forEach(child => visit(child, depth + 1));
        return;
      }

      const inspected = inspectTowerCandidate(
        value,
        towerIndex
      );

      if (inspected.status === "accepted") {
        records.push(inspected.record);
      } else if (inspected.status === "rejected") {
        rejected[inspected.reason] += 1;
      }

      Object.values(value)
        .forEach(child => visit(child, depth + 1));
    }

    visit(payload, 0);

    const aggregated = aggregateRecords(records);
    return {
      records: aggregated,
      quantity: aggregated.reduce(
        (total, record) => total + record.quantity,
        0
      ),
      rejected,
      scannedObjects,
      limitReached: scannedObjects >= MAX_SCANNED_OBJECTS
    };
  }

  function decodeBase64(value) {
    const binary = window.atob(
      String(value || "").replace(/\s/g, "")
    );
    const bytes = Uint8Array.from(
      binary,
      character => character.charCodeAt(0)
    );
    return new TextDecoder("utf-8").decode(bytes);
  }

  function responseText(entry) {
    const content = entry?.response?.content;
    if (typeof content?.text !== "string") return "";
    if (content.text.length > MAX_RESPONSE_CHARACTERS) return "";

    return String(content.encoding || "").toLowerCase() === "base64"
      ? decodeBase64(content.text)
      : content.text;
  }

  function parseResponsePayload(entry) {
    let text;
    try {
      text = responseText(entry).trim();
    } catch (error) {
      return null;
    }

    if (!text || (text[0] !== "{" && text[0] !== "[")) {
      return null;
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      return null;
    }
  }

  function cloneSnapshot(snapshot) {
    if (!snapshot) return null;
    return {
      schemaVersion: snapshot.schemaVersion,
      importedAt: snapshot.importedAt,
      ready: snapshot.ready,
      records: snapshot.records.map(record => ({ ...record })),
      diagnostics: {
        ...snapshot.diagnostics,
        rejected: { ...snapshot.diagnostics.rejected }
      }
    };
  }

  function extract(har, options = {}) {
    if (!isHar(har)) {
      throw new Error(
        "A parsed private capture is required for tower inventory."
      );
    }

    const towerIndex = buildTowerIndex(options.aliases);
    const entries = har.log.entries.slice(0, MAX_ENTRIES);
    const candidates = [];
    let readableResponses = 0;

    entries.forEach((entry, entryIndex) => {
      const payload = parseResponsePayload(entry);
      if (!payload) return;
      readableResponses += 1;

      const scanned = scanPayload(payload, towerIndex);
      if (!scanned.records.length) return;

      candidates.push({
        ...scanned,
        entryIndex
      });
    });

    candidates.sort((left, right) =>
      right.quantity - left.quantity ||
      right.records.length - left.records.length ||
      right.entryIndex - left.entryIndex
    );

    const selected = candidates[0] || {
      records: [],
      quantity: 0,
      rejected: {
        type: 0,
        level: 0,
        "catalogue-level": 0,
        location: 0,
        quantity: 0
      },
      scannedObjects: 0,
      limitReached: false
    };

    return {
      schemaVersion: 1,
      importedAt: new Date().toISOString(),
      ready: selected.records.length > 0,
      records: selected.records.map(record => ({ ...record })),
      diagnostics: {
        scannedEntries: entries.length,
        readableResponses,
        candidateSnapshots: candidates.length,
        selectedGroups: selected.records.length,
        selectedQuantity: selected.quantity,
        rejected: { ...selected.rejected },
        scanLimitReached: selected.limitReached
      }
    };
  }

  function emit(name, detail) {
    const safeDetail = cloneSnapshot(detail);

    subscribers.forEach(listener => {
      try {
        listener(cloneSnapshot(safeDetail));
      } catch (error) {
        console.error(
          "[Onyx Command] Tower inventory subscriber failed.",
          error
        );
      }
    });

    if (
      typeof window.dispatchEvent === "function" &&
      typeof window.CustomEvent === "function"
    ) {
      window.dispatchEvent(
        new window.CustomEvent(name, {
          detail: safeDetail
        })
      );
    }
  }

  function importHar(har, options = {}) {
    const extracted = extract(har, options);
    memorySnapshot = cloneSnapshot(extracted);
    emit(IMPORT_EVENT, memorySnapshot);
    return cloneSnapshot(memorySnapshot);
  }

  /*
   * Accept the already-sanitised result produced by the private import
   * worker. Revalidate every field in the page before exposing it to the
   * base tools; the raw capture never needs to leave the worker.
   */
  function importSnapshot(snapshot) {
    if (!isObject(snapshot)) {
      throw new Error(
        "A sanitised tower inventory snapshot is required."
      );
    }

    const towerIndex = buildTowerIndex();
    const inputRecords = Array.isArray(
      snapshot.records
    )
      ? snapshot.records
      : [];

    if (inputRecords.length > MAX_ENTRIES) {
      throw new Error(
        "The tower inventory snapshot is outside the safe import limits."
      );
    }

    const records = inputRecords.map(record => {
      if (!isObject(record)) {
        throw new Error(
          "The tower inventory snapshot is invalid."
        );
      }

      const type = String(record.type || "");
      const level = strictInteger(
        record.level,
        1,
        999
      );
      const location =
        record.location === "storage" ||
        record.location === "base"
          ? record.location
          : "";
      const quantity = strictInteger(
        record.quantity,
        1,
        250_000_000
      );
      const knownLevel =
        Array.isArray(towerIndex.levels[type]) &&
        towerIndex.levels[type].some(row =>
          Number(row?.level) === level
        );

      if (
        !knownLevel ||
        !location ||
        !quantity
      ) {
        throw new Error(
          "The tower inventory snapshot is invalid."
        );
      }

      return {
        type,
        level,
        location,
        quantity,
        evidence:
          "catalogue-row-and-explicit-location"
      };
    });

    const sourceDiagnostics =
      isObject(snapshot.diagnostics)
        ? snapshot.diagnostics
        : {};
    const sourceRejected =
      isObject(sourceDiagnostics.rejected)
        ? sourceDiagnostics.rejected
        : {};
    const safeCount = value => {
      const number = Number(value);
      return Number.isSafeInteger(number) &&
        number >= 0
        ? number
        : 0;
    };

    memorySnapshot = {
      schemaVersion: 1,
      importedAt: new Date().toISOString(),
      ready: records.length > 0,
      records,
      diagnostics: {
        scannedEntries:
          safeCount(
            sourceDiagnostics.scannedEntries
          ),
        readableResponses:
          safeCount(
            sourceDiagnostics.readableResponses
          ),
        candidateSnapshots:
          safeCount(
            sourceDiagnostics.candidateSnapshots
          ),
        selectedGroups: records.length,
        selectedQuantity: records.reduce(
          (total, record) =>
            total + record.quantity,
          0
        ),
        rejected: {
          type: safeCount(sourceRejected.type),
          level: safeCount(sourceRejected.level),
          "catalogue-level": safeCount(
            sourceRejected["catalogue-level"]
          ),
          location: safeCount(
            sourceRejected.location
          ),
          quantity: safeCount(
            sourceRejected.quantity
          )
        },
        scanLimitReached:
          sourceDiagnostics.scanLimitReached ===
          true
      }
    };

    emit(IMPORT_EVENT, memorySnapshot);
    return cloneSnapshot(memorySnapshot);
  }

  function getSnapshot() {
    return cloneSnapshot(memorySnapshot);
  }

  function clear() {
    memorySnapshot = null;
    subscribers.forEach(listener => {
      try {
        listener(null);
      } catch (error) {
        console.error(
          "[Onyx Command] Tower inventory subscriber failed.",
          error
        );
      }
    });

    if (
      typeof window.dispatchEvent === "function" &&
      typeof window.CustomEvent === "function"
    ) {
      window.dispatchEvent(
        new window.CustomEvent(CLEAR_EVENT, {
          detail: null
        })
      );
    }
  }

  function subscribe(listener) {
    if (typeof listener !== "function") {
      throw new TypeError("Tower inventory subscriber must be a function.");
    }
    subscribers.add(listener);
    return () => subscribers.delete(listener);
  }

  window.OnyxTowerInventoryBridge = Object.freeze({
    eventName: IMPORT_EVENT,
    clearEventName: CLEAR_EVENT,
    extract,
    importHar,
    importSnapshot,
    getSnapshot,
    clear,
    subscribe
  });
})(window);
