/* ============================================================
   ONYX COMMAND — ATLAS CASTLE HUNTER CORE

   Pure, testable rules for Atlas topology, shield state,
   glory classification, filtering and sorting.
   ============================================================ */

(function installOnyxAtlasCore(root) {
  "use strict";

  const CASTLE_KEY_PATTERN = /^A[0-9]+-[0-9]+$/;
  const COORDINATE_PATTERN = /^[1-9][0-9]*-A[0-9]+-[0-9]+$/;
  const LIVE_TTL_SECONDS = 10 * 60;
  const ALLOWED_TIERS = new Set([2, 3, 4, 5]);

  const DEFAULT_FILTERS = Object.freeze({
    tiers: Object.freeze([2, 3, 4, 5]),
    query: "",
    aprMin: null,
    aprMax: null,
    glory: "any",
    shield: "any",
    gate: "any",
    sort: "glory"
  });

  function finiteNumber(value) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function integer(value) {
    const number = finiteNumber(value);
    return number !== null && Number.isInteger(number) ? number : null;
  }

  function castleRegion(castleKey) {
    const match = String(castleKey || "").match(/^(A[0-9]+)-[0-9]+$/);
    return match ? match[1] : null;
  }

  function isCanonicalCoordinate(value) {
    return COORDINATE_PATTERN.test(String(value || ""));
  }

  function normaliseTiers(value) {
    if (!Array.isArray(value)) return [...DEFAULT_FILTERS.tiers];
    return [...new Set(
      value
        .map(integer)
        .filter(tier => tier !== null && ALLOWED_TIERS.has(tier))
    )].sort((left, right) => left - right);
  }

  function optionalApr(value) {
    if (value === "" || value === null || value === undefined) return null;
    const number = finiteNumber(value);
    return number !== null && number >= 0 ? Math.round(number) : null;
  }

  function normaliseFilters(value = {}) {
    const allowedGlory = new Set(["any", "confirmed100", "needsData"]);
    const allowedShield = new Set([
      "any",
      "down",
      "observedDown",
      "cooldown",
      "shielded",
      "inactive",
      "notChecked"
    ]);
    const allowedGate = new Set(["any", "gate", "critical", "none"]);
    const allowedSort = new Set([
      "glory",
      "shield",
      "aprDesc",
      "aprAsc",
      "tierDesc",
      "coordinate"
    ]);

    return {
      tiers: normaliseTiers(value.tiers),
      query: String(value.query || "").trim(),
      aprMin: optionalApr(value.aprMin),
      aprMax: optionalApr(value.aprMax),
      glory: allowedGlory.has(value.glory) ? value.glory : DEFAULT_FILTERS.glory,
      shield: allowedShield.has(value.shield) ? value.shield : DEFAULT_FILTERS.shield,
      gate: allowedGate.has(value.gate) ? value.gate : DEFAULT_FILTERS.gate,
      sort: allowedSort.has(value.sort) ? value.sort : DEFAULT_FILTERS.sort
    };
  }

  function validateFilters(filters) {
    for (const [key, label] of [["aprMin", "APR minimum"], ["aprMax", "APR maximum"]]) {
      const raw = filters?.[key];
      if (raw !== "" && raw !== null && raw !== undefined) {
        const number = finiteNumber(raw);
        if (number === null || number < 0) return `${label} must be zero or higher.`;
      }
    }
    const value = normaliseFilters(filters);
    if (
      value.aprMin !== null &&
      value.aprMax !== null &&
      value.aprMin > value.aprMax
    ) {
      return "APR minimum cannot be higher than APR maximum.";
    }
    return "";
  }

  function deriveGateTypes(castles = {}) {
    const castleKeys = new Set(
      Object.keys(castles).filter(key => CASTLE_KEY_PATTERN.test(key))
    );
    const seenPairs = new Set();
    const edges = [];
    const gateKeys = new Set();

    castleKeys.forEach(sourceKey => {
      const source = castles[sourceKey];
      const sourceRegion = castleRegion(sourceKey);
      const connections = source?.connections;
      if (!connections || typeof connections !== "object") return;

      Object.keys(connections).forEach(targetKey => {
        const targetRegion = castleRegion(targetKey);
        if (
          !castleKeys.has(targetKey) ||
          !sourceRegion ||
          !targetRegion ||
          sourceRegion === targetRegion ||
          sourceKey === targetKey
        ) {
          return;
        }

        const endpoints = [sourceKey, targetKey].sort();
        const pairKey = endpoints.join("|");
        if (seenPairs.has(pairKey)) return;
        seenPairs.add(pairKey);

        edges.push({
          id: edges.length,
          sourceCastle: endpoints[0],
          targetCastle: endpoints[1],
          sourceRegion: castleRegion(endpoints[0]),
          targetRegion: castleRegion(endpoints[1])
        });
        gateKeys.add(sourceKey);
        gateKeys.add(targetKey);
      });
    });

    const adjacency = new Map();
    function addAdjacency(region, edgeId) {
      if (!adjacency.has(region)) adjacency.set(region, []);
      adjacency.get(region).push(edgeId);
    }
    edges.forEach(edge => {
      addAdjacency(edge.sourceRegion, edge.id);
      addAdjacency(edge.targetRegion, edge.id);
    });

    const discovered = new Map();
    const low = new Map();
    const bridgeIds = new Set();
    let clock = 0;

    adjacency.forEach((_edgeIds, startRegion) => {
      if (discovered.has(startRegion)) return;

      clock += 1;
      discovered.set(startRegion, clock);
      low.set(startRegion, clock);

      const stack = [{
        region: startRegion,
        parentRegion: null,
        parentEdgeId: -1,
        nextEdgeIndex: 0
      }];

      while (stack.length) {
        const frame = stack[stack.length - 1];
        const edgeIds = adjacency.get(frame.region) || [];

        if (frame.nextEdgeIndex >= edgeIds.length) {
          stack.pop();
          if (frame.parentRegion !== null) {
            low.set(
              frame.parentRegion,
              Math.min(low.get(frame.parentRegion), low.get(frame.region))
            );
            if (low.get(frame.region) > discovered.get(frame.parentRegion)) {
              bridgeIds.add(frame.parentEdgeId);
            }
          }
          continue;
        }

        const edgeId = edgeIds[frame.nextEdgeIndex];
        frame.nextEdgeIndex += 1;
        if (edgeId === frame.parentEdgeId) continue;

        const edge = edges[edgeId];
        const neighbour = edge.sourceRegion === frame.region
          ? edge.targetRegion
          : edge.sourceRegion;

        if (!discovered.has(neighbour)) {
          clock += 1;
          discovered.set(neighbour, clock);
          low.set(neighbour, clock);
          stack.push({
            region: neighbour,
            parentRegion: frame.region,
            parentEdgeId: edgeId,
            nextEdgeIndex: 0
          });
          continue;
        }

        low.set(
          frame.region,
          Math.min(low.get(frame.region), discovered.get(neighbour))
        );
      }
    });

    const criticalKeys = new Set();
    bridgeIds.forEach(edgeId => {
      const edge = edges[edgeId];
      criticalKeys.add(edge.sourceCastle);
      criticalKeys.add(edge.targetCastle);
    });

    const types = Object.create(null);
    castleKeys.forEach(key => {
      types[key] = criticalKeys.has(key)
        ? "critical"
        : gateKeys.has(key)
          ? "gate"
          : "none";
    });

    return {
      types,
      gateCount: gateKeys.size,
      criticalCount: criticalKeys.size,
      edgeCount: edges.length,
      criticalEdgeCount: bridgeIds.size
    };
  }

  function classifyGlory(rawCastleLevel, maxCastleLevel) {
    const rawLevel = integer(rawCastleLevel);
    const maximum = integer(maxCastleLevel);
    if (rawLevel === null || maximum === null) return "unknown";
    return rawLevel > maximum ? "confirmed100" : "needsData";
  }

  function unknownShield() {
    return {
      state: "unknown",
      observedAt: null,
      sourceUpdatedAt: null,
      endAt: null,
      shipsUntilTrigger: null
    };
  }

  function computeShieldState({ node, area, shieldConfig, serverNow, majorEvent }) {
    if (!node || !area || !shieldConfig) return unknownShield();

    const now = finiteNumber(serverNow);
    const rawLevel = integer(area.level);
    const placeId = area.place_id;
    const kingdomId = integer(placeId?.k_id);
    const infra = area.infra;
    const fort = infra?.fort;
    if (now === null || rawLevel === null || kingdomId === null || !infra || !fort) {
      return unknownShield();
    }

    const observedAt = now;
    const sourceUpdatedAt = finiteNumber(infra.epoch_updated);
    const result = {
      state: "unknown",
      observedAt,
      sourceUpdatedAt,
      endAt: null,
      shipsUntilTrigger: null
    };

    if (!node.mat || kingdomId > 1000 || rawLevel <= 0) {
      result.state = "notApplicable";
      return result;
    }

    if (fort.shield_turned_on !== true) {
      result.state = "disabled";
      return result;
    }

    if (majorEvent === true) {
      result.state = "event";
      return result;
    }

    const onlineEpoch = finiteNumber(infra.online_epoch);
    const upkeepEpoch = infra.upkeep_epoch === null
      ? null
      : finiteNumber(infra.upkeep_epoch);
    const fortLevel = integer(fort.level);
    const shieldTime = finiteNumber(fort.shield_time_ts);
    const shipsLost = finiteNumber(fort.shield_ships_lost);
    const cooldownHours = finiteNumber(shieldConfig.cdHr);
    const durationHours = finiteNumber(shieldConfig.hr);
    const decaySeconds = finiteNumber(shieldConfig.decaySec);
    const triggerStart = finiteNumber(shieldConfig.trigger?.start);
    const triggerPerLevel = finiteNumber(shieldConfig.trigger?.perLvl);

    if (
      onlineEpoch === null ||
      fortLevel === null ||
      shieldTime === null ||
      shipsLost === null ||
      cooldownHours === null ||
      durationHours === null ||
      decaySeconds === null ||
      decaySeconds <= 0 ||
      triggerStart === null ||
      triggerPerLevel === null ||
      sourceUpdatedAt === null ||
      (infra.upkeep_epoch !== null && upkeepEpoch === null)
    ) {
      return unknownShield();
    }

    const upkeepOverdue = upkeepEpoch !== null && now > upkeepEpoch;
    const infrastructureOnline = now >= onlineEpoch && !upkeepOverdue;
    const upgradeEpoch = finiteNumber(fort.upgrade_epoch) || 0;
    const effectiveFortLevel = Math.max(
      0,
      upgradeEpoch > now ? fortLevel - 1 : fortLevel
    );
    const ageSeconds = Math.max(0, now - sourceUpdatedAt);
    const decayMultiplier = ageSeconds <= 0
      ? 1
      : Math.max(0, 1 - ageSeconds / decaySeconds);
    const decayedShipsLost = shipsLost * decayMultiplier;
    const triggerThreshold = triggerStart + triggerPerLevel * effectiveFortLevel;
    result.shipsUntilTrigger = Math.max(0, triggerThreshold - decayedShipsLost);

    const cooldownSeconds = Math.floor(3600 * cooldownHours * rawLevel);
    const shieldDurationSeconds = Math.floor(3600 * durationHours / rawLevel);
    const cooldownEnd = shieldTime + cooldownSeconds;
    const cooldown = shieldTime < now && now < cooldownEnd;
    const triggerCondition = decayedShipsLost >= triggerThreshold;
    const nativeShieldActive =
      shieldTime > now ||
      (
        triggerCondition &&
        cooldownEnd < now &&
        now < cooldownEnd + shieldDurationSeconds
      );
    const shieldActive = nativeShieldActive && infrastructureOnline;

    if (shieldActive) {
      result.state = "active";
      result.endAt = shieldTime > now
        ? shieldTime
        : cooldownEnd + shieldDurationSeconds;
    } else if (cooldown) {
      result.state = "cooldown";
      result.endAt = cooldownEnd;
    } else if (!infrastructureOnline) {
      result.state = "offline";
    } else {
      result.state = "down";
    }

    return result;
  }

  function effectiveShieldState(shield, nowEpoch = Date.now() / 1000) {
    if (!shield || shield.state === "unknown") return "unknown";
    const observedAt = finiteNumber(shield.observedAt);
    const now = finiteNumber(nowEpoch);
    if (observedAt === null || now === null) return "unknown";
    if (Math.max(0, now - observedAt) > LIVE_TTL_SECONDS) return "stale";
    return shield.state;
  }

  function matchesShield(record, selected, nowEpoch) {
    if (selected === "any") return true;
    if (selected === "observedDown") {
      return (
        record?.shield?.state === "down" &&
        finiteNumber(record?.shield?.observedAt) !== null
      );
    }
    const state = effectiveShieldState(record.shield, nowEpoch);
    if (selected === "shielded") return state === "active" || state === "event";
    if (selected === "inactive") {
      return state === "disabled" || state === "offline" || state === "notApplicable";
    }
    if (selected === "notChecked") return state === "unknown" || state === "stale";
    return state === selected;
  }

  function matchesGate(record, selected) {
    if (selected === "any") return true;
    if (selected === "gate") return record.gateType === "gate" || record.gateType === "critical";
    if (selected === "critical") return record.gateType === "critical";
    return record.gateType === "none";
  }

  function shieldOpportunityRank(record, nowEpoch) {
    const state = effectiveShieldState(record.shield, nowEpoch);
    return ({
      down: 0,
      cooldown: 1,
      disabled: 2,
      offline: 3,
      notApplicable: 4,
      active: 5,
      event: 5,
      stale: 6,
      unknown: 7
    })[state] ?? 8;
  }

  function compareCoordinate(left, right) {
    return String(left.coordinate || "").localeCompare(
      String(right.coordinate || ""),
      "en",
      { numeric: true }
    );
  }

  function sortCastles(records, sort, nowEpoch) {
    const output = [...records];
    output.sort((left, right) => {
      if (sort === "coordinate") return compareCoordinate(left, right);
      if (sort === "tierDesc") {
        return right.tier - left.tier || compareCoordinate(left, right);
      }
      if (sort === "aprAsc" || sort === "aprDesc") {
        const leftApr = finiteNumber(left.apr);
        const rightApr = finiteNumber(right.apr);
        if (leftApr === null && rightApr === null) return compareCoordinate(left, right);
        if (leftApr === null) return 1;
        if (rightApr === null) return -1;
        return (
          (sort === "aprAsc" ? leftApr - rightApr : rightApr - leftApr) ||
          compareCoordinate(left, right)
        );
      }
      if (sort === "shield") {
        return (
          shieldOpportunityRank(left, nowEpoch) - shieldOpportunityRank(right, nowEpoch) ||
          Number(right.glory === "confirmed100") - Number(left.glory === "confirmed100") ||
          right.tier - left.tier ||
          compareCoordinate(left, right)
        );
      }

      return (
        Number(right.glory === "confirmed100") - Number(left.glory === "confirmed100") ||
        shieldOpportunityRank(left, nowEpoch) - shieldOpportunityRank(right, nowEpoch) ||
        right.tier - left.tier ||
        compareCoordinate(left, right)
      );
    });
    return output;
  }

  function filterCastles(records, incomingFilters, nowEpoch = Date.now() / 1000) {
    const error = validateFilters(incomingFilters);
    const filters = normaliseFilters(incomingFilters);
    if (error) return { filters, error, records: [] };

    const tierSet = new Set(filters.tiers);
    const query = filters.query.toLocaleLowerCase("en-AU");
    const filtered = (Array.isArray(records) ? records : []).filter(record => {
      if (!tierSet.has(integer(record.tier))) return false;

      const apr = finiteNumber(record.apr);
      if (filters.aprMin !== null && (apr === null || apr < filters.aprMin)) return false;
      if (filters.aprMax !== null && (apr === null || apr > filters.aprMax)) return false;
      if (filters.glory !== "any" && record.glory !== filters.glory) return false;
      if (!matchesShield(record, filters.shield, nowEpoch)) return false;
      if (!matchesGate(record, filters.gate)) return false;

      if (query) {
        const searchable = [
          record.name,
          record.coordinate,
          record.ownerTeam,
          record.regionId,
          record.regionName
        ].filter(Boolean).join(" ").toLocaleLowerCase("en-AU");
        if (!searchable.includes(query)) return false;
      }

      return true;
    });

    return {
      filters,
      error: "",
      records: sortCastles(filtered, filters.sort, nowEpoch)
    };
  }

  function computeOfficialShieldState(record, live, atlas, nowEpoch = Date.now() / 1000) {
    const observedAt = finiteNumber(live?.observedAt) ?? finiteNumber(nowEpoch);
    const fort = live?.fort;
    const unknown = unknownShield();
    if (observedAt === null || !fort || typeof fort !== "object") return unknown;

    const result = {
      state: "unknown",
      observedAt,
      sourceUpdatedAt: observedAt,
      endAt: null,
      shipsUntilTrigger: null
    };
    if (fort.shieldTurnedOn !== true) {
      result.state = "disabled";
      return result;
    }
    if (atlas?.majorEvent === true) {
      result.state = "event";
      return result;
    }

    const rawLevel = integer(live?.rawLevel ?? record?.rawLevel);
    if (record?.material === null || (rawLevel !== null && rawLevel <= 0)) {
      result.state = "notApplicable";
      return result;
    }

    const shieldTime = finiteNumber(fort.shieldTimeTs);
    if (shieldTime === null) return result;
    if (shieldTime > observedAt) {
      result.state = "active";
      result.endAt = shieldTime;
      return result;
    }

    const shieldConfig = atlas?.shieldConfig;
    const cooldownHours = finiteNumber(shieldConfig?.cdHr);
    const durationHours = finiteNumber(shieldConfig?.hr);
    const triggerStart = finiteNumber(shieldConfig?.trigger?.start);
    const triggerPerLevel = finiteNumber(shieldConfig?.trigger?.perLvl);
    const fortLevel = integer(fort.level);
    const upgradeEpoch = finiteNumber(fort.upgradeEpoch) || 0;
    const shipsLost = finiteNumber(fort.shieldShipsLost);
    if (
      rawLevel === null || rawLevel <= 0 ||
      cooldownHours === null || durationHours === null ||
      triggerStart === null || triggerPerLevel === null ||
      fortLevel === null || shipsLost === null
    ) {
      return result;
    }

    const effectiveFortLevel = Math.max(
      0,
      upgradeEpoch > observedAt ? fortLevel - 1 : fortLevel
    );
    const triggerThreshold = triggerStart + triggerPerLevel * effectiveFortLevel;
    result.shipsUntilTrigger = Math.max(0, triggerThreshold - shipsLost);
    const cooldownEnd = shieldTime + Math.floor(3600 * cooldownHours * rawLevel);
    const shieldDuration = Math.floor(3600 * durationHours / rawLevel);
    const triggerCondition = shipsLost >= triggerThreshold;
    if (observedAt < cooldownEnd) {
      result.state = "cooldown";
      result.endAt = cooldownEnd;
    } else if (
      triggerCondition &&
      observedAt < cooldownEnd + shieldDuration
    ) {
      result.state = "active";
      result.endAt = cooldownEnd + shieldDuration;
    } else {
      result.state = "down";
    }
    return result;
  }

  function mergeOfficialMacro(snapshot, payload) {
    if (!snapshot || !Array.isArray(snapshot.records) || !Array.isArray(payload?.records)) {
      return snapshot;
    }
    const updates = new Map();
    payload.records.slice(0, 50000).forEach(value => {
      if (isCanonicalCoordinate(value?.coordinate)) updates.set(value.coordinate, value);
    });
    const gloryMaximum = integer(snapshot.atlas?.gloryMaxCastleLevel);
    const records = snapshot.records.map(record => {
      const update = updates.get(record.coordinate);
      if (!update) return record;
      const rawLevel = integer(update.rawLevel);
      const nextRawLevel = rawLevel !== null && rawLevel >= 0 && rawLevel <= 4
        ? rawLevel
        : record.rawLevel;
      return {
        ...record,
        rawLevel: nextRawLevel,
        tier: Number.isInteger(nextRawLevel) ? nextRawLevel + 1 : record.tier,
        ownerTeam: typeof update.ownerTeam === "string" ? update.ownerTeam : null,
        apr: integer(update.apr),
        atlasRank: integer(update.atlasRank),
        glory: Number.isInteger(nextRawLevel)
          ? classifyGlory(nextRawLevel, gloryMaximum)
          : record.glory
      };
    });
    return {
      ...snapshot,
      catalogueUpdatedAt: finiteNumber(payload.updatedAt) ?? Date.now() / 1000,
      records
    };
  }

  function mergeOfficialCritical(snapshot, payload) {
    if (!snapshot || !Array.isArray(snapshot.records) || !Array.isArray(payload?.records)) {
      return snapshot;
    }
    const updates = new Map();
    payload.records.forEach(value => {
      if (value?.available === true && isCanonicalCoordinate(value.coordinate)) {
        updates.set(value.coordinate, value);
      }
    });
    let newestObservation = finiteNumber(payload.observedAt);
    const records = snapshot.records.map(record => {
      const update = updates.get(record.coordinate);
      if (!update) return record;
      newestObservation = Math.max(
        newestObservation || 0,
        finiteNumber(update.observedAt) || 0
      );
      const guardCount = finiteNumber(update.guards);
      return {
        ...record,
        ownerTeam: typeof update.ownerTeam === "string" ? update.ownerTeam : null,
        guards: guardCount !== null && guardCount >= 0 ? guardCount : record.guards,
        shield: computeOfficialShieldState(
          record,
          update,
          snapshot.atlas,
          update.observedAt
        ),
        checked: true,
        source: "official"
      };
    });
    return {
      ...snapshot,
      lastLiveAt: newestObservation || snapshot.lastLiveAt || null,
      records
    };
  }

  function mergeOfficialInfo(snapshot, payload) {
    if (!snapshot || !Array.isArray(snapshot.records) || !Array.isArray(payload?.records)) {
      return snapshot;
    }
    const updates = new Map();
    payload.records.forEach(value => {
      if (value?.available === true && isCanonicalCoordinate(value.coordinate)) {
        updates.set(value.coordinate, value);
      }
    });
    return {
      ...snapshot,
      records: snapshot.records.map(record => {
        const update = updates.get(record.coordinate);
        if (!update) return record;
        const rawLevel = integer(update.rawLevel);
        return {
          ...record,
          name: typeof update.name === "string" && update.name
            ? update.name
            : record.name,
          ownerTeam: typeof update.ownerTeam === "string" ? update.ownerTeam : null,
          rawLevel: rawLevel !== null ? rawLevel : record.rawLevel,
          tier: rawLevel !== null ? rawLevel + 1 : record.tier,
          infrastructure: update.infrastructure || record.infrastructure || null
        };
      })
    };
  }

  root.OnyxAtlasCore = Object.freeze({
    CASTLE_KEY_PATTERN,
    COORDINATE_PATTERN,
    LIVE_TTL_SECONDS,
    DEFAULT_FILTERS,
    castleRegion,
    isCanonicalCoordinate,
    normaliseFilters,
    validateFilters,
    deriveGateTypes,
    classifyGlory,
    computeShieldState,
    computeOfficialShieldState,
    effectiveShieldState,
    filterCastles,
    sortCastles,
    mergeOfficialMacro,
    mergeOfficialCritical,
    mergeOfficialInfo
  });
})(typeof globalThis !== "undefined" ? globalThis : window);
