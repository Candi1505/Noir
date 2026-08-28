/* ============================================================
   ONYX COMMAND — LOCAL ATLAS HAR WORKER

   The capture is scanned inside this worker. Only an allowlisted,
   derived castle snapshot is returned to the application.
   ============================================================ */

"use strict";

importScripts("onyx-atlas-castle-hunter-core.js?v=20260828-audit-2");

const Core = self.OnyxAtlasCore;
const MAX_ARCHIVE_BYTES = 320 * 1024 * 1024;
const MAX_UNCOMPRESSED_BYTES = 320 * 1024 * 1024;
const MAX_ENTRY_BYTES = 190 * 1024 * 1024;
const MAX_HAR_ENTRIES = 5000;
const MAX_CASTLES = 50000;
const MAX_REGIONS = 15000;
const MAX_TEAM_NAME_LENGTH = 120;
const TARGET_PATHS = new Set([
  "/ext/dragonsong/world/modal/landing",
  "/ext/dragonsong/world/macro_view/get_metadata",
  "/ext/dragonsong/world/area/get",
  "/ext/dragonsong/world/area/get_names",
  "/ext/dragonsong/world/get_initial_world_player",
  "/ext/dragonsong/world/get_params",
  "/time"
]);

function progress(value, message) {
  self.postMessage({
    type: "progress",
    value: Math.max(0, Math.min(100, Math.round(value))),
    message
  });
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function integer(value) {
  const number = finite(value);
  return number !== null && Number.isInteger(number) ? number : null;
}

function safeStartedAt(entry) {
  const timestamp = Date.parse(String(entry?.startedDateTime || ""));
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function pathnameOnly(entry) {
  try {
    return new URL(String(entry?.request?.url || "")).pathname;
  } catch {
    return "";
  }
}

function decodeBase64Utf8(input, maximumBytes = MAX_ENTRY_BYTES) {
  const value = String(input || "").replace(/\s/g, "");
  const estimatedBytes = Math.floor(value.length * 0.75);
  if (estimatedBytes > maximumBytes) {
    throw new Error("A required Atlas response is larger than the safe import limit.");
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });
  const parts = [];
  const chunkSize = 32768;

  for (let offset = 0; offset < value.length; offset += chunkSize) {
    let end = Math.min(value.length, offset + chunkSize);
    if (end < value.length) end -= (end - offset) % 4;
    const binary = atob(value.slice(offset, end));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    parts.push(decoder.decode(bytes, { stream: end < value.length }));
    offset = end - chunkSize;
  }

  parts.push(decoder.decode());
  return parts.join("");
}

function responseText(entry) {
  const content = entry?.response?.content;
  const text = content?.text;
  if (typeof text !== "string" || !text) return "";
  if (String(content.encoding || "").toLowerCase() === "base64") {
    return decodeBase64Utf8(text);
  }
  if (text.length > MAX_ENTRY_BYTES) {
    throw new Error("A required Atlas response is larger than the safe import limit.");
  }
  return text;
}

function parseJsonResponse(entry, label) {
  const text = responseText(entry);
  if (!text) throw new Error(`${label} did not contain a response body.`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} contained invalid JSON.`);
  }
}

function extractAssignedObject(source, variableName) {
  const marker = new RegExp(`\\bwindow\\.${variableName}\\s*=\\s*`, "g");
  const matches = [...source.matchAll(marker)];
  if (matches.length !== 1) {
    throw new Error(`Atlas ${variableName} topology was not uniquely available.`);
  }

  let start = matches[0].index + matches[0][0].length;
  while (/\s/.test(source[start] || "")) start += 1;
  if (source[start] !== "{") {
    throw new Error(`Atlas ${variableName} topology was malformed.`);
  }

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) {
        let cursor = index + 1;
        while (/\s/.test(source[cursor] || "")) cursor += 1;
        if (source[cursor] !== ";") {
          throw new Error(`Atlas ${variableName} topology was incomplete.`);
        }
        return JSON.parse(source.slice(start, index + 1));
      }
    }
  }

  throw new Error(`Atlas ${variableName} topology was incomplete.`);
}

function sanitiseTopology(html) {
  const rawCastles = extractAssignedObject(html, "CASTLES");
  const rawRegions = extractAssignedObject(html, "REGIONS");
  const rawRegionNames = extractAssignedObject(html, "REGION_IDX_TO_NAME");
  const castleEntries = Object.entries(rawCastles || {});
  const regionEntries = Object.entries(rawRegions || {});

  if (!castleEntries.length || castleEntries.length > MAX_CASTLES) {
    throw new Error("Atlas castle topology is outside the safe import limits.");
  }
  if (!regionEntries.length || regionEntries.length > MAX_REGIONS) {
    throw new Error("Atlas region topology is outside the safe import limits.");
  }

  const castles = Object.create(null);
  castleEntries.forEach(([key, value]) => {
    if (!Core.CASTLE_KEY_PATTERN.test(key)) return;
    const x = finite(value?.x);
    const y = finite(value?.y);
    const level = integer(value?.level);
    const area = integer(value?.area);
    const material = value?.mat;
    if (
      x === null || y === null || level === null || area === null ||
      !(material === null || typeof material === "string") ||
      !value?.connections || typeof value.connections !== "object"
    ) {
      return;
    }

    const connections = Object.create(null);
    Object.entries(value.connections).slice(0, 200).forEach(([target, marker]) => {
      if (Core.CASTLE_KEY_PATTERN.test(target) && integer(marker) !== null) {
        connections[target] = integer(marker);
      }
    });

    castles[key] = { x, y, level, area, mat: material, connections };
  });

  if (Object.keys(castles).length < Math.min(100, castleEntries.length)) {
    throw new Error("Atlas castle topology failed validation.");
  }

  const regions = Object.create(null);
  regionEntries.forEach(([key, value]) => {
    if (!/^A[0-9]+$/.test(key)) return;
    const regionIndex = integer(value?.region_idx);
    const size = integer(value?.sz);
    if (regionIndex === null || size === null) return;
    regions[key] = {
      regionIndex,
      size,
      realmName: typeof value?.realm_name === "string"
        ? value.realm_name.slice(0, 120)
        : "",
      seasonIsland: value?.is_season_island === true
    };
  });

  const regionNames = Object.create(null);
  Object.entries(rawRegionNames || {}).forEach(([key, value]) => {
    if (/^[0-9]+$/.test(key) && typeof value === "string") {
      regionNames[key] = value.slice(0, 120);
    }
  });

  return { castles, regions, regionNames };
}

function sanitiseMetadata(body) {
  const kingdomId = integer(body?.k_id);
  const metadata = body?.metadata;
  if (kingdomId === null || !metadata || typeof metadata !== "object") {
    throw new Error("Atlas ownership metadata was malformed.");
  }

  const owners = new Map();
  Object.entries(metadata.conts || {}).forEach(([key, owner]) => {
    if (!Core.CASTLE_KEY_PATTERN.test(key)) return;
    if (owner === null) owners.set(key, null);
    else if (typeof owner === "string" && owner.length <= MAX_TEAM_NAME_LENGTH) {
      owners.set(key, owner);
    }
  });

  const teams = new Map();
  Object.entries(metadata.teams || {}).forEach(([key, team]) => {
    if (typeof key !== "string" || key.length > MAX_TEAM_NAME_LENGTH) return;
    const powerRank = integer(team?.power_rank);
    const atlasRank = integer(team?.rank);
    teams.set(key, {
      powerRank: powerRank !== null && powerRank >= 0 ? powerRank : null,
      atlasRank: atlasRank !== null && atlasRank >= 0 ? atlasRank : null
    });
  });

  return {
    kingdomId,
    epoch: finite(body?.epoch),
    owners,
    teams
  };
}

function calculateGuards(area) {
  const fleets = area?.fleets;
  if (!fleets || typeof fleets !== "object") return null;
  const garrisons = Object.values(fleets).filter(fleet => fleet?.dtype === "garrison");
  if (!garrisons.length) return 0;

  let total = 0;
  for (const garrison of garrisons) {
    if (garrison?.fogged === true || !garrison?.escorts || typeof garrison.escorts !== "object") {
      return null;
    }
    for (const army of Object.values(garrison.escorts)) {
      if (army?.fogged === true || !army?.ships || typeof army.ships !== "object") {
        return null;
      }
      for (const count of Object.values(army.ships)) {
        const numeric = finite(count);
        if (numeric === null || numeric < 0) return null;
        total += numeric;
      }
    }
  }
  return total;
}

function sanitiseArea(area) {
  const place = area?.place_id;
  const kingdomId = integer(place?.k_id);
  const regionId = String(place?.region_id || "");
  const castleIndex = integer(place?.cont_idx);
  if (kingdomId === null || !/^A[0-9]+$/.test(regionId) || castleIndex === null) {
    return null;
  }

  const fullId = `${kingdomId}-${regionId}-${castleIndex}`;
  if (!Core.isCanonicalCoordinate(fullId)) return null;
  const infra = area?.infra;
  const fort = infra?.fort;

  return {
    fullId,
    custom_name: typeof area?.custom_name === "string"
      ? area.custom_name.slice(0, 120)
      : "",
    level: integer(area?.level),
    owner_team: typeof area?.owner_team === "string"
      ? area.owner_team.slice(0, MAX_TEAM_NAME_LENGTH)
      : null,
    place_id: { k_id: kingdomId, region_id: regionId, cont_idx: castleIndex },
    infra: infra && fort ? {
      epoch_updated: finite(infra.epoch_updated),
      online_epoch: finite(infra.online_epoch),
      upkeep_epoch: infra.upkeep_epoch === null ? null : finite(infra.upkeep_epoch),
      fort: {
        level: integer(fort.level),
        upgrade_epoch: finite(fort.upgrade_epoch),
        shield_turned_on: fort.shield_turned_on === true,
        shield_time_ts: finite(fort.shield_time_ts),
        shield_ships_lost: finite(fort.shield_ships_lost)
      }
    } : null,
    guards: calculateGuards(area)
  };
}

function sanitiseParams(body) {
  const params = body?.params;
  if (!params || typeof params !== "object") return null;
  const shield = params?.infra?.fort?.shield;
  const gloryMaximum = integer(params?.gloryLvlMulti?.maxCastleLevel);
  if (!shield || gloryMaximum === null) return null;

  const output = {
    gloryMaxCastleLevel: gloryMaximum,
    majorEvent: params.isMajorEventRunning === true,
    shield: {
      cdHr: finite(shield.cdHr),
      decaySec: finite(shield.decaySec),
      hr: finite(shield.hr),
      trigger: {
        start: finite(shield.trigger?.start),
        perLvl: finite(shield.trigger?.perLvl)
      }
    }
  };

  if (Object.values(output.shield).slice(0, 3).some(value => value === null)) return null;
  if (output.shield.trigger.start === null || output.shield.trigger.perLvl === null) return null;
  return output;
}

function createCaptureState() {
  return {
    newestTopologyAt: -1,
    topology: null,
    newestMetadataAt: -1,
    metadata: null,
    newestParamsAt: -1,
    params: null,
    newestInitialAt: -1,
    fallbackKingdomId: null,
    newestTimeAt: -1,
    serverNow: null,
    areas: new Map(),
    names: new Map(),
    relevantEntries: 0,
    totalEntries: 0
  };
}

function processEntry(entry, state) {
  state.totalEntries += 1;
  if (state.totalEntries > MAX_HAR_ENTRIES) {
    throw new Error("This capture contains too many entries to import safely.");
  }
  if (integer(entry?.response?.status) !== 200) return;
  const path = pathnameOnly(entry);
  if (!TARGET_PATHS.has(path)) return;
  state.relevantEntries += 1;
  const startedAt = safeStartedAt(entry);

  if (path === "/ext/dragonsong/world/modal/landing") {
    if (startedAt <= state.newestTopologyAt) return;
    state.topology = sanitiseTopology(responseText(entry));
    state.newestTopologyAt = startedAt;
    return;
  }

  if (path === "/ext/dragonsong/world/macro_view/get_metadata") {
    if (startedAt <= state.newestMetadataAt) return;
    state.metadata = sanitiseMetadata(parseJsonResponse(entry, "Atlas ownership metadata"));
    state.newestMetadataAt = startedAt;
    return;
  }

  if (path === "/ext/dragonsong/world/get_params") {
    if (startedAt <= state.newestParamsAt) return;
    state.params = sanitiseParams(parseJsonResponse(entry, "Atlas parameters"));
    state.newestParamsAt = startedAt;
    return;
  }

  if (path === "/ext/dragonsong/world/get_initial_world_player") {
    if (startedAt <= state.newestInitialAt) return;
    const body = parseJsonResponse(entry, "Atlas player state");
    state.fallbackKingdomId = integer(body?.world_team?.k_id) ?? integer(body?.me?.k_id);
    state.newestInitialAt = startedAt;
    return;
  }

  if (path === "/time") {
    if (startedAt <= state.newestTimeAt) return;
    const serverTime = finite(responseText(entry));
    if (serverTime !== null && serverTime > 0) {
      state.serverNow = serverTime;
      state.newestTimeAt = startedAt;
    }
    return;
  }

  if (path === "/ext/dragonsong/world/area/get_names") {
    const names = parseJsonResponse(entry, "Atlas castle names");
    Object.entries(names || {}).forEach(([fullId, value]) => {
      if (Core.isCanonicalCoordinate(fullId) && typeof value?.name === "string") {
        state.names.set(fullId, value.name.slice(0, 120));
      }
    });
    return;
  }

  if (path === "/ext/dragonsong/world/area/get") {
    const body = parseJsonResponse(entry, "Atlas castle state");
    Object.values(body?.areas || {}).forEach(rawArea => {
      const area = sanitiseArea(rawArea);
      if (!area) return;
      const previous = state.areas.get(area.fullId);
      const observed = finite(area.infra?.epoch_updated) ?? startedAt / 1000;
      const previousObserved = finite(previous?.infra?.epoch_updated) ?? -1;
      if (!previous || observed >= previousObserved) state.areas.set(area.fullId, area);
    });
  }
}

function buildSnapshot(state) {
  if (!state.topology) throw new Error("No Atlas map topology was found in this capture.");
  if (!state.metadata) throw new Error("No Atlas ownership metadata was found in this capture.");
  const kingdomId = state.metadata.kingdomId ?? state.fallbackKingdomId;
  if (kingdomId === null || kingdomId <= 0) {
    throw new Error("Atlas kingdom coordinates were unavailable.");
  }

  const gateData = Core.deriveGateTypes(state.topology.castles);
  const records = [];
  let checkedCount = 0;

  Object.entries(state.topology.castles).forEach(([castleKey, node]) => {
    const coordinate = `${kingdomId}-${castleKey}`;
    if (!Core.isCanonicalCoordinate(coordinate)) return;
    const rawLevel = integer(node.level);
    if (rawLevel === null) return;
    const tier = rawLevel + 1;
    const ownerTeam = state.metadata.owners.get(castleKey) ?? null;
    const team = ownerTeam ? state.metadata.teams.get(ownerTeam) : null;
    const area = state.areas.get(coordinate) || null;
    if (area) checkedCount += 1;
    const levelConflict = area?.level !== null && area?.level !== undefined && area.level !== rawLevel;
    const regionId = Core.castleRegion(castleKey);
    const region = state.topology.regions[regionId] || null;
    const regionIndex = region?.regionIndex;
    const regionName = regionIndex !== null && regionIndex !== undefined
      ? state.topology.regionNames[String(regionIndex)] || region?.realmName || ""
      : region?.realmName || "";
    const connectedRegions = [...new Set(
      Object.keys(node.connections || {})
        .map(Core.castleRegion)
        .filter(value => value && value !== regionId)
    )].sort((left, right) => left.localeCompare(right, "en", { numeric: true }));

    records.push({
      coordinate,
      castleKey,
      name: state.names.get(coordinate) || area?.custom_name || "",
      tier,
      rawLevel,
      material: node.mat,
      apr: team?.powerRank ?? null,
      atlasRank: team?.atlasRank ?? null,
      ownerTeam,
      regionId,
      regionName,
      gateType: gateData.types[castleKey] || "none",
      connectedRegions,
      glory: levelConflict
        ? "unknown"
        : Core.classifyGlory(rawLevel, state.params?.gloryMaxCastleLevel),
      shield: levelConflict
        ? {
            state: "unknown",
            observedAt: null,
            sourceUpdatedAt: null,
            endAt: null,
            shipsUntilTrigger: null
          }
        : Core.computeShieldState({
            node,
            area,
            shieldConfig: state.params?.shield,
            serverNow: state.serverNow,
            majorEvent: state.params?.majorEvent === true
          }),
      guards: area?.guards ?? null,
      checked: Boolean(area),
      dataConflict: levelConflict
    });
  });

  if (!records.length) throw new Error("No valid Atlas castles were found in this capture.");

  const realmNames = [...new Set(
    Object.values(state.topology.regions)
      .map(region => region?.realmName)
      .filter(value => typeof value === "string" && value)
  )].sort((left, right) => left.localeCompare(right, "en"));

  return {
    schemaVersion: 2,
    capturedAt: state.serverNow,
    atlas: {
      kingdomId,
      realmName: realmNames[0] || "",
      shieldConfig: state.params?.shield || null,
      gloryMaxCastleLevel: state.params?.gloryMaxCastleLevel ?? null,
      majorEvent: state.params?.majorEvent === true,
      configObservedAt: state.serverNow
    },
    records,
    summary: {
      indexedCount: records.length,
      checkedCount,
      gateCount: gateData.gateCount,
      criticalGateCount: gateData.criticalCount,
      connectionCount: gateData.edgeCount,
      relevantEntries: state.relevantEntries
    }
  };
}

function findEndOfCentralDirectory(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = bytes.byteLength - 22; offset >= 0; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  return -1;
}

async function openZipHar(file) {
  const tailStart = Math.max(0, file.size - 66000);
  const tailBytes = new Uint8Array(await file.slice(tailStart).arrayBuffer());
  const endOffset = findEndOfCentralDirectory(tailBytes);
  if (endOffset < 0) throw new Error("The Atlas ZIP directory could not be read.");
  const endView = new DataView(tailBytes.buffer, tailBytes.byteOffset, tailBytes.byteLength);
  const entryCount = endView.getUint16(endOffset + 10, true);
  const directorySize = endView.getUint32(endOffset + 12, true);
  const directoryOffset = endView.getUint32(endOffset + 16, true);
  if (
    entryCount === 0xffff ||
    directorySize === 0xffffffff ||
    directoryOffset === 0xffffffff
  ) {
    throw new Error("ZIP64 Atlas captures are not supported.");
  }
  if (entryCount < 1 || entryCount > 100 || directoryOffset + directorySize > file.size) {
    throw new Error("The Atlas ZIP directory is outside the safe import limits.");
  }

  const directoryBytes = new Uint8Array(
    await file.slice(directoryOffset, directoryOffset + directorySize).arrayBuffer()
  );
  const view = new DataView(
    directoryBytes.buffer,
    directoryBytes.byteOffset,
    directoryBytes.byteLength
  );
  const decoder = new TextDecoder("utf-8");
  const candidates = [];
  let cursor = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > directoryBytes.length || view.getUint32(cursor, true) !== 0x02014b50) {
      throw new Error("The Atlas ZIP directory is malformed.");
    }
    const flags = view.getUint16(cursor + 8, true);
    const method = view.getUint16(cursor + 10, true);
    const compressedSize = view.getUint32(cursor + 20, true);
    const uncompressedSize = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const end = cursor + 46 + nameLength + extraLength + commentLength;
    if (end > directoryBytes.length) throw new Error("The Atlas ZIP entry is malformed.");
    const name = decoder.decode(directoryBytes.slice(cursor + 46, cursor + 46 + nameLength));
    if (
      /\.har$/i.test(name) &&
      !name.startsWith("__MACOSX/") &&
      (method === 0 || method === 8) &&
      (flags & 1) === 0
    ) {
      candidates.push({ name, method, compressedSize, uncompressedSize, localOffset });
    }
    cursor = end;
  }

  candidates.sort((left, right) => right.uncompressedSize - left.uncompressedSize);
  const selected = candidates[0];
  if (!selected) throw new Error("No readable .har file was found in this ZIP.");
  if (selected.uncompressedSize > MAX_UNCOMPRESSED_BYTES) {
    throw new Error("This Atlas capture is larger than the safe import limit.");
  }
  if (selected.localOffset + 30 > file.size) throw new Error("The Atlas ZIP entry is incomplete.");

  const localBytes = new Uint8Array(
    await file.slice(selected.localOffset, selected.localOffset + 30).arrayBuffer()
  );
  const localView = new DataView(localBytes.buffer, localBytes.byteOffset, localBytes.byteLength);
  if (localView.getUint32(0, true) !== 0x04034b50) {
    throw new Error("The Atlas ZIP entry header is malformed.");
  }
  const localNameLength = localView.getUint16(26, true);
  const localExtraLength = localView.getUint16(28, true);
  const dataStart = selected.localOffset + 30 + localNameLength + localExtraLength;
  const dataEnd = dataStart + selected.compressedSize;
  if (dataEnd > file.size) throw new Error("The Atlas ZIP entry is incomplete.");

  let stream = file.slice(dataStart, dataEnd).stream();
  if (selected.method === 8) {
    if (typeof DecompressionStream !== "function") {
      throw new Error("This browser cannot open zipped Atlas captures. Extract the .har file first.");
    }
    try {
      stream = stream.pipeThrough(new DecompressionStream("deflate-raw"));
    } catch {
      throw new Error("This browser cannot open zipped Atlas captures. Extract the .har file first.");
    }
  }

  return { stream, totalBytes: selected.uncompressedSize };
}

async function openHar(file) {
  if (!(file instanceof Blob)) throw new Error("Choose an Atlas HAR capture.");
  if (file.size < 4 || file.size > MAX_ARCHIVE_BYTES) {
    throw new Error("This Atlas capture is outside the safe import limits.");
  }
  const signature = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const zipped = signature[0] === 0x50 && signature[1] === 0x4b;
  if (zipped) return openZipHar(file);
  return { stream: file.stream(), totalBytes: file.size };
}

async function scanHar(stream, totalBytes, state) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let prefix = "";
  let entriesFound = false;
  let collecting = false;
  let parts = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let bytesRead = 0;
  let lastProgress = -1;
  let complete = false;

  async function processText(text) {
    if (!entriesFound) {
      prefix += text;
      if (prefix.length > 2 * 1024 * 1024) {
        throw new Error("The HAR entries list could not be located.");
      }
      const match = /"entries"\s*:\s*\[/.exec(prefix);
      if (!match) return;
      entriesFound = true;
      text = prefix.slice(match.index + match[0].length);
      prefix = "";
    }

    let segmentStart = collecting ? 0 : -1;
    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];
      if (!collecting) {
        if (character === "{") {
          collecting = true;
          segmentStart = index;
          depth = 1;
          inString = false;
          escaped = false;
        } else if (character === "]") {
          complete = true;
          return;
        }
        continue;
      }

      if (inString) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === '"') inString = false;
      } else if (character === '"') {
        inString = true;
      } else if (character === "{") {
        if (index !== segmentStart || depth !== 1) depth += 1;
      } else if (character === "}") {
        depth -= 1;
        if (depth === 0) {
          parts.push(text.slice(segmentStart, index + 1));
          const entryText = parts.join("");
          if (entryText.length > MAX_ENTRY_BYTES * 1.4) {
            throw new Error("A HAR entry is larger than the safe import limit.");
          }
          let entry;
          try {
            entry = JSON.parse(entryText);
          } catch {
            throw new Error("The Atlas HAR contains a malformed entry.");
          }
          processEntry(entry, state);
          collecting = false;
          parts = [];
          segmentStart = -1;
        }
      }
    }

    if (collecting && segmentStart >= 0) parts.push(text.slice(segmentStart));
  }

  while (!complete) {
    const { value, done } = await reader.read();
    if (done) break;
    bytesRead += value.byteLength;
    await processText(decoder.decode(value, { stream: true }));
    const percent = totalBytes > 0 ? Math.min(92, (bytesRead / totalBytes) * 92) : 0;
    if (Math.floor(percent) >= lastProgress + 2) {
      lastProgress = Math.floor(percent);
      progress(percent, `Scanning Atlas · ${state.totalEntries} entries`);
    }
  }
  await processText(decoder.decode());

  if (!entriesFound || !complete || state.totalEntries === 0) {
    throw new Error("The selected file is not a complete Atlas HAR capture.");
  }
}

self.addEventListener("message", async event => {
  if (event.data?.type !== "parse") return;
  try {
    progress(1, "Opening Atlas capture");
    const state = createCaptureState();
    const { stream, totalBytes } = await openHar(event.data.file);
    await scanHar(stream, totalBytes, state);
    progress(94, "Building castle index");
    const snapshot = buildSnapshot(state);
    progress(100, "Atlas ready");
    self.postMessage({ type: "complete", snapshot });
  } catch (error) {
    self.postMessage({
      type: "error",
      message: error instanceof Error ? error.message : "The Atlas capture could not be imported."
    });
  }
});
