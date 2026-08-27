(() => {
  "use strict";

  const OVERLAY_ID = "onyxBaseCommandOverlay";
  const STORAGE_PREFIX = "onyxBaseLayoutV1";
  const ISLAND_COUNT = 8;
  const SLOTS_PER_ISLAND = 5;
  const TOTAL_SLOTS = ISLAND_COUNT * SLOTS_PER_ISLAND;

  const ISLANDS = Object.freeze([
    { name: "Gateway", form: "short", x: 222, y: 730, width: 112, height: 64, tilt: 5 },
    { name: "Ember Reach", form: "long", x: 26, y: 642, width: 180, height: 70, tilt: -9 },
    { name: "Veil", form: "short", x: 96, y: 548, width: 112, height: 64, tilt: -23 },
    { name: "Northglass", form: "long", x: 154, y: 458, width: 178, height: 70, tilt: 10 },
    { name: "Pivot", form: "short", x: 164, y: 367, width: 112, height: 64, tilt: 22 },
    { name: "Goldwake", form: "long", x: 23, y: 273, width: 180, height: 70, tilt: -10 },
    { name: "Spire", form: "short", x: 97, y: 177, width: 112, height: 64, tilt: -21 },
    { name: "Command Crown", form: "long", x: 153, y: 70, width: 178, height: 70, tilt: -10 }
  ]);

  const RESOURCE_NAMES = Object.freeze({
    piercing: "Lumber",
    food: "Food",
    elementalEmber: "Elemental Embers",
    iceShard: "Ice Shards",
    fireShard: "Fire Shards",
    electrumBar: "Electrum Bars",
    cosmicCharge: "Cosmic Charges",
    bloodstone: "Bloodstones"
  });

  const RULE_NAMES = Object.freeze({
    elementalFlakDark: "Dark Flak Tower",
    elementalFlakFire: "Fire Flak Tower",
    elementalFlakIce: "Ice Flak Tower",
    elementalFlakWind: "Electro-Flak Tower",
    elementalFlakEarth: "Earth Flak Tower",
    crystalHowitzer: "Crystal Howitzer",
    stormTower: "Storm Tower",
    drainTower: "Drakul Pylon",
    E20Q4Tower: "Cosmic Orrery",
    burnTower: "Fire Turret",
    soulDrainTower: "Soul Drain Tower",
    nexusTower: "Nexus Tower",
    nullSpire: "Nullspire Tower",
    mageTower: "Mage Tower",
    mageTowerSuper: "Archmage Tower"
  });

  const TOWER_ICON_PATHS = Object.freeze({
    artillery: '<path d="M5 20h14M8 20l1-6h6l1 6M10 14V9l7-3 1.5 2.5-5 3.5"/><circle cx="10" cy="14" r="1.4"/>',
    energy: '<path d="M7 20h10M9 20l1-5h4l1 5M12.5 3 9 10h3l-1 5 5-8h-3l-.5-4Z"/>',
    flak: '<path d="M6 20h12M8 20l1-7h6l1 7M12 13V8M9 10l3-2 3 2M7 7l2 1M17 7l-2 1"/><circle cx="12" cy="6" r="1.5"/>',
    mage: '<path d="M6 20h12M8 20l2-8h4l2 8M12 12V7M9 8l3-4 3 4-3 2-3-2Z"/>',
    special: '<path d="M6 20h12M8 20l1.5-7h5L16 20M12 4l4 4-4 4-4-4 4-4Z"/><path d="M12 12v3"/>',
    tower: '<path d="M6 20h12M8 20V9l2 2 2-3 2 3 2-2v11M10 15h4M12 15v5"/>'
  });

  let activeTab = "intelligence";
  let selectedTower = "";
  let selectedLevel = 1;
  let selectedIsland = 0;
  let selectedSlot = null;
  let editorDraft = null;
  let moveFrom = null;
  let pendingSwap = null;
  let layout = null;
  let savedSnapshot = null;
  let dirty = false;
  let profileSaved = false;
  let saveMessage = "";
  let importMessage = "";
  let inventorySnapshot = null;
  let openedForUser = null;
  let cloudLoadedFor = null;
  let cloudLoadingFor = null;
  let lastFocused = null;

  function catalogue() {
    return window.NoirBaseCatalog || {};
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(value) {
    return new Intl.NumberFormat("en-AU").format(Number(value) || 0);
  }

  function formatDuration(seconds) {
    const total = Math.max(0, Number(seconds) || 0);
    if (!total) return "Instant";
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    return [
      days ? `${days}d` : "",
      hours ? `${hours}h` : "",
      !days && minutes ? `${minutes}m` : ""
    ].filter(Boolean).join(" ") || `${Math.ceil(total / 60)}m`;
  }

  function formatCost(cost) {
    const [rawName, rawAmount] = String(cost || "").split(":");
    if (!rawName || !rawAmount) return "Not available";
    const name = RESOURCE_NAMES[rawName];
    return name
      ? `${formatNumber(rawAmount)} ${name}`
      : `${formatNumber(rawAmount)} · resource type unavailable`;
  }

  function icon(name, className = "") {
    if (name === "close") {
      return `<svg class="${escapeHtml(className)}" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>`;
    }
    if (name === "route") {
      return `<svg class="${escapeHtml(className)}" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-4 5-3 5-7s-5-3-5-7M19 5c0 4-5 3-5 7s5 3 5 7"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/></svg>`;
    }
    if (name === "shield") {
      return `<svg class="${escapeHtml(className)}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.6-2.9 8-7 10-4.1-2-7-5.4-7-10V6l7-3Z"/><path d="M9 12h6M12 9v6"/></svg>`;
    }
    return `<svg class="${escapeHtml(className)}" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M6 20V9l3 2 3-5 3 5 3-2v11M9 15h6"/></svg>`;
  }

  function towerFamily(type) {
    const name = String(type || "").toLowerCase();
    if (/flak/.test(name)) return "flak";
    if (/mage|archmage/.test(name)) return "mage";
    if (/lightning|storm|volt/.test(name)) return "energy";
    if (/cannon|turret|howitzer|ballista|trebuchet|archer/.test(name)) return "artillery";
    if (/nexus|nullspire|orrery|pylon|soul|oculus/.test(name)) return "special";
    return "tower";
  }

  function towerIcon(type, className = "") {
    const family = towerFamily(type);
    return `<svg class="${escapeHtml(className)}" viewBox="0 0 24 24" aria-hidden="true">${TOWER_ICON_PATHS[family]}</svg>`;
  }

  function userId() {
    return window.OnyxCommandCore?.getCurrentUserId?.() || null;
  }

  function storageKey() {
    return `${STORAGE_PREFIX}:${userId() || "signed-out"}`;
  }

  function towerTypes() {
    const levels = catalogue().towerLevels || {};
    return Object.keys(levels)
      .filter(name => Array.isArray(levels[name]) && levels[name].length > 0)
      .filter(name => !/\bBoss\b/i.test(name))
      .sort((left, right) => left.localeCompare(right));
  }

  function canonicalTowerType(value) {
    const clean = String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!clean) return "";
    return towerTypes().find(type => type.toLowerCase() === clean.toLowerCase()) || clean;
  }

  function descriptionFor(type) {
    return catalogue().towers?.find(item => item?.name === type)?.description
      || "No verified description is available for this tower.";
  }

  function rowsFor(type) {
    const rows = catalogue().towerLevels?.[type];
    return Array.isArray(rows) ? rows : [];
  }

  function exactRow(type, level) {
    return rowsFor(type).find(row => Number(row?.level) === Number(level)) || null;
  }

  function blankSlots() {
    return Array.from({ length: TOTAL_SLOTS }, () => null);
  }

  function normaliseTower(value) {
    if (!value || typeof value !== "object") return null;
    const type = canonicalTowerType(value.type);
    const level = Number.parseInt(value.level, 10);
    if (!type || !Number.isInteger(level) || level < 1 || level > 999) return null;
    return {
      type,
      level,
      notes: String(value.notes || "").trim().slice(0, 250)
    };
  }

  function normaliseLayout(value) {
    if (
      !value ||
      typeof value !== "object" ||
      !Array.isArray(value.slots) ||
      value.slots.length !== TOTAL_SLOTS
    ) return null;
    return {
      version: 1,
      name: String(value.name || "My Base").trim().slice(0, 60) || "My Base",
      slots: Array.from({ length: TOTAL_SLOTS }, (_, index) => normaliseTower(value.slots[index])),
      updatedAt: String(value.updatedAt || new Date().toISOString())
    };
  }

  function createLayout(name = "My Base") {
    return {
      version: 1,
      name: String(name || "My Base").trim().slice(0, 60) || "My Base",
      slots: blankSlots(),
      updatedAt: new Date().toISOString()
    };
  }

  function comparableLayout(value) {
    return value ? JSON.stringify({ name: value.name, slots: value.slots }) : "";
  }

  function updateDraftState() {
    dirty = Boolean(layout) && comparableLayout(layout) !== comparableLayout(savedSnapshot);
    profileSaved = Boolean(savedSnapshot) && !dirty;
  }

  function readLocal() {
    const cachedSaved = cloudLoadedFor === userId()
      ? clone(savedSnapshot)
      : null;
    try {
      layout = normaliseLayout(JSON.parse(localStorage.getItem(storageKey()) || "null"));
    } catch (error) {
      layout = null;
    }
    savedSnapshot = cachedSaved;
    if (!layout && cachedSaved) layout = clone(cachedSaved);
    updateDraftState();
  }

  function saveLocal() {
    if (!layout) {
      localStorage.removeItem(storageKey());
      return;
    }
    layout.updatedAt = new Date().toISOString();
    localStorage.setItem(storageKey(), JSON.stringify(layout));
  }

  function markDirty(message = "Draft stored on this device.") {
    if (!layout) return;
    saveLocal();
    updateDraftState();
    saveMessage = message;
  }

  async function loadCloud() {
    const id = userId();
    if (!id || cloudLoadedFor === id || cloudLoadingFor === id) return;
    const loader = window.ChestDatabase?.loadOnyxBaseLayout;
    if (typeof loader !== "function") return;
    cloudLoadingFor = id;
    try {
      const cloud = normaliseLayout(await loader.call(window.ChestDatabase));
      cloudLoadedFor = id;
      if (cloud) {
        savedSnapshot = clone(cloud);
        const localIsNewer = layout && Date.parse(layout.updatedAt) > Date.parse(cloud.updatedAt);
        if (!layout || !localIsNewer) layout = clone(cloud);
        updateDraftState();
        saveMessage = dirty
          ? "A newer device draft is open. Save it to update your profile."
          : "Saved profile layout loaded.";
        saveLocal();
        render();
      } else {
        savedSnapshot = null;
        updateDraftState();
      }
    } catch (error) {
      console.warn("[Onyx Base] The saved profile layout could not be loaded.", error);
    } finally {
      cloudLoadingFor = null;
    }
  }

  async function saveCloud() {
    if (!layout) return false;
    layout.name = String(layout.name || "My Base").trim().slice(0, 60) || "My Base";
    saveLocal();
    saveMessage = "Saving to your Onyx profile…";
    render();
    const saver = window.ChestDatabase?.saveOnyxBaseLayout;
    if (typeof saver !== "function") {
      saveMessage = "Draft stored on this device; profile sync is unavailable.";
      updateDraftState();
      render();
      return false;
    }
    try {
      const saved = normaliseLayout(await saver.call(window.ChestDatabase, clone(layout))) || clone(layout);
      layout = saved;
      savedSnapshot = clone(saved);
      cloudLoadedFor = userId();
      updateDraftState();
      saveLocal();
      saveMessage = `Saved to your Onyx profile · ${new Date().toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}`;
      render();
      return true;
    } catch (error) {
      saveMessage = "Draft stored on this device; profile sync is unavailable.";
      updateDraftState();
      render();
      console.warn("[Onyx Base] Profile sync failed.", error);
      return false;
    }
  }

  function normaliseInventorySnapshot(value) {
    const source = Array.isArray(value?.records)
      ? value.records
      : Array.isArray(value?.towers)
        ? value.towers
        : [];
    const grouped = new Map();
    source.forEach(item => {
      const type = canonicalTowerType(item?.type);
      const level = Number.parseInt(item?.level, 10);
      const quantity = Math.max(1, Math.min(500, Number.parseInt(item?.quantity, 10) || 1));
      if (!type || !Number.isInteger(level) || level < 1 || level > 999) return;
      const location = item?.location === "storage" ? "storage" : item?.location === "base" ? "base" : "available";
      const key = `${type}\u0000${level}\u0000${location}`;
      const existing = grouped.get(key);
      if (existing) existing.quantity += quantity;
      else grouped.set(key, { type, level, location, quantity });
    });
    const records = Array.from(grouped.values()).sort((left, right) =>
      left.location.localeCompare(right.location)
      || left.type.localeCompare(right.type)
      || right.level - left.level
    );
    return {
      importedAt: String(value?.importedAt || new Date().toISOString()),
      records
    };
  }

  function refreshInventory(value = window.OnyxTowerInventoryBridge?.getSnapshot?.()) {
    inventorySnapshot = value ? normaliseInventorySnapshot(value) : null;
  }

  function inventoryRecords() {
    return inventorySnapshot?.records || [];
  }

  function placedCount(type, level, excludedSlot = null) {
    return layout?.slots.reduce((total, tower, index) =>
      total + (index !== excludedSlot && tower?.type === type && Number(tower.level) === Number(level) ? 1 : 0), 0
    ) || 0;
  }

  function availableInventory(record, excludedSlot = null) {
    const records = inventoryRecords();
    const recordIndex = records.indexOf(record);
    const earlierQuantity = records.slice(0, Math.max(0, recordIndex))
      .filter(candidate =>
        candidate.type === record.type &&
        Number(candidate.level) === Number(record.level)
      )
      .reduce((sum, candidate) => sum + Number(candidate.quantity || 0), 0);
    const allocatedHere = Math.max(
      0,
      placedCount(record.type, record.level, excludedSlot) - earlierQuantity
    );
    return Math.max(0, Number(record.quantity) - allocatedHere);
  }

  function inventorySummary() {
    const records = inventoryRecords();
    return {
      groups: records.length,
      towers: records.reduce((sum, record) => sum + Number(record.quantity || 0), 0)
    };
  }

  function restrictionsFor(type) {
    const restrictions = Array.isArray(catalogue().restrictions) ? catalogue().restrictions : [];
    return restrictions.filter(rule => RULE_NAMES[rule?.tower] === type);
  }

  function renderRestriction(rule) {
    const parts = [];
    if (Number(rule.maximumPerIsland) > 0) {
      parts.push(`Verified maximum per island: ${rule.maximumPerIsland}`);
    }
    const conflicts = Array.isArray(rule.conflicts)
      ? rule.conflicts.map(id => RULE_NAMES[id]).filter(Boolean)
      : [];
    if (conflicts.length) parts.push(`Recorded conflicts: ${conflicts.join(", ")}`);
    return parts.length
      ? parts.join(" · ")
      : "A restriction is recorded, but no verified player-facing limit is available.";
  }

  function towerEstimate(tower) {
    if (!tower) return null;
    const row = exactRow(tower.type, tower.level);
    const value = Number(row?.power);
    return Number.isFinite(value) && value >= 0 ? value : null;
  }

  function estimateSlots(slots) {
    return (Array.isArray(slots) ? slots : []).reduce((summary, tower) => {
      if (!tower) return summary;
      summary.placed += 1;
      const value = towerEstimate(tower);
      if (value === null) summary.unavailable += 1;
      else {
        summary.known += 1;
        summary.value += value;
      }
      return summary;
    }, { value: 0, placed: 0, known: 0, unavailable: 0 });
  }

  function islandSlots(sourceLayout, islandIndex) {
    const start = islandIndex * SLOTS_PER_ISLAND;
    return sourceLayout?.slots.slice(start, start + SLOTS_PER_ISLAND)
      || blankSlots().slice(0, SLOTS_PER_ISLAND);
  }

  function estimateText(summary) {
    if (!summary.placed) return "≈ 0";
    if (!summary.known) return "Unavailable";
    return `≈ ${formatNumber(summary.value)}${summary.unavailable ? " · partial" : ""}`;
  }

  function estimateCoverage(summary) {
    if (!summary.placed) return "No towers placed";
    if (!summary.unavailable) return `${summary.known}/${summary.placed} exact catalogue rows`;
    return `${summary.known}/${summary.placed} estimated · ${summary.unavailable} unavailable`;
  }

  function estimateDelta(current, baseline) {
    if (!baseline || current.unavailable || baseline.unavailable) return "";
    const delta = current.value - baseline.value;
    if (!delta) return "Estimated change 0";
    return `Estimated change ${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(delta))}`;
  }

  function renderEstimateMetric(label, summary, baseline = null) {
    return `<article class="obc-dp-metric ${summary.unavailable ? "partial" : ""}">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(estimateText(summary))}</strong>
      <span>${escapeHtml(estimateDelta(summary, baseline) || estimateCoverage(summary))}</span>
    </article>`;
  }

  function renderInventoryState(compact = false) {
    const summary = inventorySummary();
    if (!summary.towers) {
      return `<section class="obc-inventory-state empty ${compact ? "compact" : ""}">
        ${icon("shield")}
        <div><strong>No tower inventory detected</strong><p>Manual tower type and level entry remains available. A private import is used only in this browser session.</p></div>
        <button id="obcOpenPrivateImport" type="button">Import tower inventory</button>
      </section>`;
    }
    return `<section class="obc-inventory-state ready ${compact ? "compact" : ""}">
      ${icon("shield")}
      <div><strong>Private tower inventory ready</strong><p>${formatNumber(summary.towers)} tower record${summary.towers === 1 ? "" : "s"} across ${formatNumber(summary.groups)} exact type and level group${summary.groups === 1 ? "" : "s"}. Placement is still entirely manual.</p></div>
      <button id="obcOpenPrivateImport" type="button">Replace inventory</button>
    </section>`;
  }

  function renderIntelligence() {
    const types = towerTypes();
    if (!selectedTower || !types.includes(selectedTower)) selectedTower = types[0] || "";
    const rows = rowsFor(selectedTower);
    const availableLevels = rows.map(row => Number(row.level)).filter(Number.isFinite);
    const minimum = availableLevels.length ? Math.min(...availableLevels) : 1;
    const maximum = availableLevels.length ? Math.max(...availableLevels) : 1;
    selectedLevel = availableLevels.includes(Number(selectedLevel)) ? Number(selectedLevel) : minimum;
    const row = exactRow(selectedTower, selectedLevel);
    const next = rows
      .filter(candidate => Number(candidate?.level) > selectedLevel)
      .sort((left, right) => Number(left.level) - Number(right.level))[0] || null;
    const restrictions = restrictionsFor(selectedTower);

    return `
      <section class="obc-source-banner">
        <strong>Verified Tower Intelligence</strong>
        <p>Exact catalogue names, descriptions, level rows, costs, build times, unlocks and recorded restrictions. No island layout is inferred.</p>
      </section>

      ${renderInventoryState(true)}

      <section class="obc-panel">
        <div class="obc-form-row">
          <label>Tower
            <select id="obcTowerType">
              ${types.map(type => `<option value="${escapeHtml(type)}" ${type === selectedTower ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}
            </select>
          </label>
          <label>Level
            <select id="obcTowerLevel">
              ${availableLevels.map(level => `<option value="${level}" ${level === selectedLevel ? "selected" : ""}>Level ${level}</option>`).join("")}
            </select>
          </label>
        </div>
      </section>

      <section class="obc-panel obc-tower-card">
        <div class="obc-section-heading">
          <div><p>TOWER INTELLIGENCE</p><h3>${escapeHtml(selectedTower || "No tower selected")}</h3></div>
          <span>${rows.length ? `Levels ${minimum}–${maximum}` : "No level table"}</span>
        </div>
        <div class="obc-intel-hero">
          <span>${towerIcon(selectedTower)}</span>
          <p class="obc-description">${escapeHtml(descriptionFor(selectedTower))}</p>
        </div>

        ${row ? `
          <div class="obc-stat-grid">
            <article><small>Catalogue power</small><strong>${formatNumber(row.power)}</strong></article>
            <article><small>Health</small><strong>${formatNumber(row.hp)}</strong></article>
            <article><small>Attack</small><strong>${formatNumber(row.attack)}</strong></article>
            <article><small>Special</small><strong>${formatNumber(row.special)}</strong></article>
            <article><small>Attacks / sec</small><strong>${Number(row.attacksPerSecond) || "—"}</strong></article>
            <article><small>Player level</small><strong>${formatNumber(row.playerLevelRequired)}</strong></article>
          </div>
          <div class="obc-upgrade-strip">
            <div><small>Level ${row.level} cost</small><strong>${escapeHtml(formatCost(row.cost))}</strong></div>
            <div><small>Build time</small><strong>${escapeHtml(formatDuration(row.seconds))}</strong></div>
            <div><small>Building XP</small><strong>${formatNumber(row.xp)}</strong></div>
          </div>
          ${next ? `<p class="obc-next-level">Next exact level: ${next.level} · ${escapeHtml(formatCost(next.cost))} · ${escapeHtml(formatDuration(next.seconds))}</p>` : '<p class="obc-next-level">No next-level data is available.</p>'}
        ` : `
          <div class="obc-no-evidence">
            <strong>No exact row for level ${escapeHtml(selectedLevel)}</strong>
            <p>Onyx will not substitute a nearby level and present it as exact.</p>
          </div>
        `}

        ${restrictions.length ? `
          <div class="obc-restrictions">
            <strong>Recorded tower restrictions</strong>
            ${restrictions.map(rule => `<p>${escapeHtml(renderRestriction(rule))}</p>`).join("")}
          </div>
        ` : ""}
      </section>

      <section class="obc-honesty-note">
        <strong>Island geometry always remains manual.</strong>
        <p>Tower intelligence can pre-fill an owned type and level when a verified private record exists. It never decides where that tower belongs.</p>
      </section>
    `;
  }

  function renderBuilderPrompt() {
    return `
      <section class="obc-builder-empty">
        <div class="obc-empty-orbit">${icon("route")}</div>
        <p>TACTICAL MAP REQUIRED</p>
        <h3>Chart your islands manually</h3>
        <p>Your private import may know which towers and levels are available, but it does not establish your home-base island layout. Onyx will never guess where a tower sits. Open each island and build it manually.</p>
        ${renderInventoryState(true)}
        <label>Base name
          <input id="obcNewLayoutName" maxlength="60" value="My Base" autocomplete="off">
        </label>
        <div class="obc-empty-actions">
          <button id="obcCreateLayout" class="primary" type="button">Build manual layout</button>
        </div>
      </section>
    `;
  }

  function islandStyle(island) {
    return [
      `--island-left:${(island.x / 360) * 100}%`,
      `--island-top:${(island.y / 820) * 100}%`,
      `--island-width:${(island.width / 360) * 100}%`,
      `--island-height:${(island.height / 820) * 100}%`,
      `--island-tilt:${island.tilt}deg`
    ].join(";");
  }

  function renderRouteMap() {
    return `
      <section class="obc-route-panel">
        <div class="obc-section-heading obc-map-heading">
          <div><p>ONYX S-ROUTE</p><h3>Tactical island map</h3></div>
          <span>Tap an island</span>
        </div>
        ${moveFrom !== null ? `
          <div class="obc-move-banner" role="status">
            ${towerIcon(layout.slots[moveFrom]?.type)}
            <div><strong>Move mode active</strong><p>Choose an island, then tap the destination spot.</p></div>
            <button id="obcCancelMove" type="button">Cancel</button>
          </div>
        ` : ""}
        <div class="obc-route-map" aria-label="Eight-island S-path map">
          <svg class="obc-route-lines" viewBox="0 0 360 820" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id="obcRouteGlow" x="-40%" y="-20%" width="180%" height="140%">
                <feGaussianBlur stdDeviation="5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
            </defs>
            <path class="route-bed" d="M278 762 C215 752 140 735 116 677 C92 620 120 602 152 580 C190 552 251 545 243 493 C237 452 202 434 220 399 C238 360 155 340 113 308 C80 282 111 233 153 209 C200 182 212 136 242 105"/>
            <path class="route-glow" filter="url(#obcRouteGlow)" d="M278 762 C215 752 140 735 116 677 C92 620 120 602 152 580 C190 552 251 545 243 493 C237 452 202 434 220 399 C238 360 155 340 113 308 C80 282 111 233 153 209 C200 182 212 136 242 105"/>
            <circle class="route-node start" cx="278" cy="762" r="6"/>
            <circle class="route-node end" cx="242" cy="105" r="6"/>
          </svg>
          ${ISLANDS.map((island, islandIndex) => {
            const slots = islandSlots(layout, islandIndex);
            const estimate = estimateSlots(slots);
            const occupied = slots.filter(Boolean).length;
            return `
              <button type="button"
                data-obc-island="${islandIndex}"
                class="obc-map-island ${island.form} ${selectedIsland === islandIndex ? "active" : ""}"
                style="${islandStyle(island)}"
                ${selectedIsland === islandIndex ? 'aria-current="true"' : ""}
                aria-label="Island ${islandIndex + 1}, ${island.name}, ${occupied} of 5 towers, Estimated island DP ${estimateText(estimate)}">
                <span class="obc-island-plate" aria-hidden="true"></span>
                <span class="obc-island-copy">
                  <small>ISLAND ${String(islandIndex + 1).padStart(2, "0")} · ${island.form.toUpperCase()}</small>
                  <strong>${escapeHtml(island.name)}</strong>
                  <em>Estimated DP ${escapeHtml(estimateText(estimate))}</em>
                </span>
                <span class="obc-occupancy" aria-hidden="true">
                  ${slots.map(tower => `<i class="${tower ? "filled" : ""}"></i>`).join("")}
                </span>
              </button>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function openEditor(slotIndex) {
    selectedSlot = slotIndex;
    const existing = layout?.slots[slotIndex];
    if (existing) {
      editorDraft = clone(existing);
      return;
    }
    const imported = inventoryRecords().find(record => availableInventory(record, slotIndex) > 0);
    if (imported) {
      editorDraft = { type: imported.type, level: imported.level, notes: "" };
      return;
    }
    const fallbackType = selectedTower || towerTypes()[0] || "";
    const levels = rowsFor(fallbackType).map(row => Number(row.level)).filter(Number.isFinite);
    editorDraft = { type: fallbackType, level: selectedLevel || levels[0] || 1, notes: "" };
  }

  function renderInventoryPicker() {
    const records = inventoryRecords();
    if (!records.length) {
      return '<div class="obc-picker-empty"><strong>No imported tower list is active.</strong><span>Enter the tower and level manually below.</span></div>';
    }
    return `
      <div class="obc-inventory-picker" aria-label="Imported tower inventory">
        ${records.slice(0, 30).map((record, index) => {
          const available = availableInventory(record, selectedSlot);
          return `<button type="button" data-obc-inventory="${index}" ${available < 1 ? "disabled" : ""}>
            ${towerIcon(record.type)}
            <span><strong>${escapeHtml(record.type)}</strong><small>Level ${record.level} · ${escapeHtml(record.location === "storage" ? "Stored" : record.location === "base" ? "Placed inventory" : "Imported")}</small></span>
            <em>${available} available</em>
          </button>`;
        }).join("")}
      </div>
    `;
  }

  function renderTowerEditor() {
    if (selectedSlot === null || !layout || !editorDraft) return "";
    const tower = layout.slots[selectedSlot];
    const estimate = towerEstimate(editorDraft);
    const importedMatch = inventoryRecords().some(record =>
      record.type === editorDraft.type && Number(record.level) === Number(editorDraft.level)
    );
    return `
      <section class="obc-tower-sheet" aria-label="Tower placement editor">
        <div class="obc-section-heading">
          <div><p>${tower ? "EDIT TOWER" : "PLACE TOWER"}</p><h3>Island ${Math.floor(selectedSlot / SLOTS_PER_ISLAND) + 1} · Spot ${(selectedSlot % SLOTS_PER_ISLAND) + 1}</h3></div>
          <button id="obcCancelSlot" class="obc-icon-button" type="button" aria-label="Close tower editor">${icon("close")}</button>
        </div>

        <div class="obc-estimate-preview">
          ${towerIcon(editorDraft.type)}
          <div><small>Estimated tower DP</small><strong id="obcEditorEstimate">${estimate === null ? "Unavailable" : `≈ ${formatNumber(estimate)}`}</strong></div>
          <span>${importedMatch ? "Private import match" : "Manual entry"}</span>
        </div>

        <div class="obc-picker-heading"><strong>Prefill from private inventory</strong><small>Optional · tap once</small></div>
        ${renderInventoryPicker()}

        <div class="obc-form-row obc-manual-fields">
          <label>Tower type
            <input id="obcSlotTowerType" list="obcTowerTypeList" maxlength="80" value="${escapeHtml(editorDraft.type)}" autocomplete="off">
            <datalist id="obcTowerTypeList">${towerTypes().map(type => `<option value="${escapeHtml(type)}"></option>`).join("")}</datalist>
          </label>
          <label>Level
            <input id="obcSlotTowerLevel" type="number" min="1" max="999" inputmode="numeric" value="${escapeHtml(editorDraft.level)}">
          </label>
        </div>
        <label class="obc-notes">Notes
          <input id="obcSlotTowerNotes" maxlength="250" value="${escapeHtml(editorDraft.notes || "")}" placeholder="Optional tactical note">
        </label>
        <p class="obc-editor-evidence">Manual types and levels are allowed. If there is no exact catalogue row, Onyx saves the tower but marks its DP estimate unavailable.</p>
        <div class="obc-editor-actions">
          <button id="obcSaveTower" class="primary" type="button">${tower ? "Update tower" : "Place tower"}</button>
          ${tower ? '<button id="obcStartMove" type="button">Move</button><button id="obcClearTower" class="danger" type="button">Remove</button>' : ""}
        </div>
        <p id="obcEditorStatus" class="obc-editor-status" aria-live="polite"></p>
      </section>
    `;
  }

  function spotLabel(tower, islandIndex, spotIndex) {
    const base = `Island ${islandIndex + 1}, spot ${spotIndex + 1}`;
    if (!tower) return `${base}, empty. Tap to place a tower.`;
    const estimate = towerEstimate(tower);
    return `${base}, ${tower.type}, level ${tower.level}, Estimated tower DP ${estimate === null ? "unavailable" : formatNumber(estimate)}.`;
  }

  function renderSwapPrompt() {
    if (moveFrom === null || pendingSwap === null) return "";
    const source = layout.slots[moveFrom];
    const destination = layout.slots[pendingSwap];
    return `
      <div class="obc-swap-prompt" role="alertdialog" aria-label="Confirm tower swap">
        <strong>Swap these two towers?</strong>
        <p>${escapeHtml(source?.type)} · L${source?.level} with ${escapeHtml(destination?.type)} · L${destination?.level}</p>
        <div><button id="obcConfirmSwap" class="primary" type="button">Swap towers</button><button id="obcCancelSwap" type="button">Cancel</button></div>
      </div>
    `;
  }

  function renderIslandCommand() {
    const island = ISLANDS[selectedIsland] || ISLANDS[0];
    const slots = islandSlots(layout, selectedIsland);
    const summary = estimateSlots(slots);
    const baseline = savedSnapshot ? estimateSlots(islandSlots(savedSnapshot, selectedIsland)) : null;
    const start = selectedIsland * SLOTS_PER_ISLAND;
    return `
      <section class="obc-island-command" tabindex="-1">
        <header>
          <div><p>ISLAND ${String(selectedIsland + 1).padStart(2, "0")} · ${island.form.toUpperCase()} SECTION</p><h3>${escapeHtml(island.name)}</h3><span>Tap a fixed glowing spot to place or edit a tower.</span></div>
          ${renderEstimateMetric("Estimated island DP", summary, baseline)}
        </header>

        ${renderSwapPrompt()}

        <div class="obc-spot-field ${island.form}" aria-label="${escapeHtml(island.name)} tower spots">
          <div class="obc-island-surface" aria-hidden="true"><i></i><i></i><i></i></div>
          ${slots.map((tower, spotIndex) => {
            const absolute = start + spotIndex;
            const estimate = towerEstimate(tower);
            return `<button type="button"
              data-obc-slot="${absolute}"
              class="obc-tower-spot spot-${spotIndex + 1} ${tower ? "occupied" : "empty"} ${selectedSlot === absolute ? "selected" : ""} ${moveFrom === absolute ? "moving" : ""}"
              aria-label="${escapeHtml(spotLabel(tower, selectedIsland, spotIndex))}"
              aria-pressed="${selectedSlot === absolute ? "true" : "false"}">
              <span class="obc-spot-halo" aria-hidden="true"></span>
              <span class="obc-spot-icon">${tower ? towerIcon(tower.type) : `<b>${spotIndex + 1}</b>`}</span>
              <small>${tower ? `L${tower.level}` : `SPOT ${spotIndex + 1}`}</small>
              ${tower ? `<em>${escapeHtml(tower.type)}</em><i>Estimated DP ${estimate === null ? "unavailable" : `≈ ${formatNumber(estimate)}`}</i>` : ""}
            </button>`;
          }).join("")}
        </div>

        ${renderTowerEditor()}
      </section>
    `;
  }

  function renderBuilder() {
    if (!layout) return renderBuilderPrompt();
    const total = estimateSlots(layout.slots);
    const savedTotal = savedSnapshot ? estimateSlots(savedSnapshot.slots) : null;
    const populated = layout.slots.filter(Boolean).length;
    return `
      <section class="obc-command-summary">
        <div class="obc-summary-copy">
          <p>BASE COMMAND · MANUAL GEOMETRY</p>
          <label>Base name<input id="obcLayoutName" maxlength="60" value="${escapeHtml(layout.name)}"></label>
          <span class="obc-draft-chip ${profileSaved ? "saved" : "draft"}">${profileSaved ? "Profile saved" : dirty ? "Unsaved draft" : "Draft"}</span>
        </div>
        <div class="obc-summary-metrics" aria-label="DP Sandbox">
          <p class="obc-sandbox-label">DP SANDBOX</p>
          <article><small>Towers placed</small><strong>${populated}/40</strong><span>Across 8 islands</span></article>
          ${renderEstimateMetric("Estimated total base DP", total, savedTotal)}
        </div>
        <p class="obc-dp-disclaimer">Estimate uses the exact catalogue power row for each recognised tower and level. It does not include unverified placement, monument, rune, rider, research or seasonal multipliers.</p>
      </section>

      ${renderInventoryState(true)}

      <div class="obc-tactical-grid">
        ${renderRouteMap()}
        ${renderIslandCommand()}
      </div>

      <section class="obc-save-dock">
        <div><strong>${profileSaved ? "Layout secured" : "Draft command state"}</strong><span>${escapeHtml(saveMessage || (dirty ? "Draft stored on this device." : "No unsaved changes."))}</span></div>
        <div><button id="obcResetLayout" type="button">Reset changes</button><button id="obcSaveLayout" class="primary" type="button" ${!dirty && profileSaved ? "disabled" : ""}>Save layout</button></div>
      </section>

      <section class="obc-delete-panel">
        <div><strong>Clear base command</strong><p>Reset restores the last profile save. Delete removes the layout from this device and your profile.</p></div>
        <button id="obcDeleteLayout" type="button">Delete layout</button>
      </section>
    `;
  }

  function advisorFindings(sourceLayout) {
    const findings = [];
    ISLANDS.forEach((island, islandIndex) => {
      const slots = islandSlots(sourceLayout, islandIndex).filter(Boolean);
      const counts = slots.reduce((map, tower) => {
        map.set(tower.type, (map.get(tower.type) || 0) + 1);
        return map;
      }, new Map());
      const seen = new Set();
      slots.forEach(tower => {
        restrictionsFor(tower.type).forEach(rule => {
          const maximum = Number(rule.maximumPerIsland);
          if (maximum > 0 && (counts.get(tower.type) || 0) > maximum) {
            const key = `${islandIndex}:maximum:${tower.type}`;
            if (!seen.has(key)) {
              seen.add(key);
              findings.push({
                islandIndex,
                text: `${tower.type} exceeds the verified maximum of ${maximum} on one island.`
              });
            }
          }
          (Array.isArray(rule.conflicts) ? rule.conflicts : []).forEach(conflictId => {
            const conflict = RULE_NAMES[conflictId];
            if (!conflict || !counts.has(conflict)) return;
            const pair = [tower.type, conflict].sort().join("|");
            const key = `${islandIndex}:conflict:${pair}`;
            if (!seen.has(key)) {
              seen.add(key);
              findings.push({
                islandIndex,
                text: `${tower.type} and ${conflict} have a recorded same-island conflict.`
              });
            }
          });
        });
      });
    });
    return findings;
  }

  function renderAdvisor() {
    if (!savedSnapshot || dirty || !profileSaved) {
      return `
        <section class="obc-advisor-lock">
          <div class="obc-lock-orbit">${icon("shield")}</div>
          <p>BASE ADVISOR LOCKED</p>
          <h3>${savedSnapshot && dirty ? "Save this draft before review" : "Build and save your manual layout first"}</h3>
          <p>Until island geometry is explicitly saved to your profile, Onyx shows tower intelligence only. It will not invent positions or give layout advice from a private inventory list.</p>
          <button id="obcGoToBuilder" class="primary" type="button">Open tactical map</button>
        </section>
      `;
    }
    const findings = advisorFindings(savedSnapshot);
    const total = estimateSlots(savedSnapshot.slots);
    return `
      <section class="obc-source-banner advisor-ready">
        <strong>Saved geometry under review</strong>
        <p>The advisor is reading only your last profile-saved manual layout and verified restriction records. It does not rank placements or invent combat bonuses.</p>
      </section>
      <section class="obc-advisor-overview">
        ${renderEstimateMetric("Estimated saved-base DP", total)}
        <article><small>Verified restriction alerts</small><strong>${findings.length}</strong><span>${findings.length ? "Review required" : "None detected"}</span></article>
      </section>
      <section class="obc-panel obc-advisor-results">
        <div class="obc-section-heading"><div><p>RULE-BASED REVIEW</p><h3>Saved island checks</h3></div><span>${findings.length ? "Attention" : "Clear"}</span></div>
        ${findings.length ? findings.map(finding => `
          <article>${icon("shield")}<div><strong>Island ${finding.islandIndex + 1} · ${escapeHtml(ISLANDS[finding.islandIndex].name)}</strong><p>${escapeHtml(finding.text)}</p></div></article>
        `).join("") : `
          <div class="obc-no-findings">${icon("shield")}<div><strong>No verified restriction conflicts detected.</strong><p>This is not a claim that the layout is optimal; it means only that the recorded rules checked by Onyx did not flag a conflict.</p></div></div>
        `}
      </section>
    `;
  }

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    overlay = document.createElement("section");
    overlay.id = OVERLAY_ID;
    overlay.className = "obc-overlay";
    overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(overlay);
    return overlay;
  }

  function focusSelectorFor(element, overlay) {
    if (!element || !overlay.contains(element)) return "";
    if (element.id) return `#${element.id}`;
    for (const key of ["obcTab", "obcIsland", "obcSlot", "obcInventory"]) {
      if (element.dataset?.[key] !== undefined) {
        const attribute = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
        return `[data-${attribute}="${element.dataset[key]}"]`;
      }
    }
    return "";
  }

  function prefersReducedMotion() {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  }

  function render(options = {}) {
    const overlay = ensureOverlay();
    const focusSelector = options.focusSelector
      || focusSelectorFor(document.activeElement, overlay);
    overlay.innerHTML = `
      <div class="obc-shell" role="dialog" aria-modal="true" aria-label="Base and Towers command centre">
        <div class="obc-mist mist-one" aria-hidden="true"></div>
        <div class="obc-mist mist-two" aria-hidden="true"></div>
        <input id="obcPrivateInventoryFile" class="obc-private-file" type="file" accept=".har,.json,application/json" tabindex="-1" aria-hidden="true">
        <header class="obc-header">
          <div><p>ONYX COMMAND</p><h2>Base Command</h2></div>
          <button id="obcClose" class="obc-icon-button" type="button" aria-label="Close base command">${icon("close")}</button>
        </header>
        <nav class="obc-tabs" role="tablist" aria-label="Base command sections">
          <button type="button" role="tab" aria-selected="${activeTab === "intelligence"}" aria-controls="obcCommandPanel" data-obc-tab="intelligence" class="${activeTab === "intelligence" ? "active" : ""}">Tower Intelligence</button>
          <button type="button" role="tab" aria-selected="${activeTab === "builder"}" aria-controls="obcCommandPanel" data-obc-tab="builder" class="${activeTab === "builder" ? "active" : ""}">Tactical Map</button>
          <button type="button" role="tab" aria-selected="${activeTab === "advisor"}" aria-controls="obcCommandPanel" data-obc-tab="advisor" class="${activeTab === "advisor" ? "active" : ""}">Base Advisor${profileSaved ? "" : '<span aria-hidden="true"></span>'}</button>
        </nav>
        <main id="obcCommandPanel" class="obc-body" role="tabpanel">
          ${importMessage ? `<p class="obc-private-import-status" aria-live="polite">${escapeHtml(importMessage)}</p>` : ""}
          ${activeTab === "intelligence" ? renderIntelligence() : activeTab === "builder" ? renderBuilder() : renderAdvisor()}
        </main>
      </div>
    `;
    window.OnyxCommand?.hydrateIcons?.(overlay);
    bindEvents(overlay);
    if (focusSelector) overlay.querySelector(focusSelector)?.focus?.();
    if (options.scrollSelector) {
      overlay.querySelector(options.scrollSelector)?.scrollIntoView?.({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start"
      });
    }
    if (
      overlay.classList.contains("open") &&
      !overlay.contains(document.activeElement)
    ) {
      overlay.querySelector("#obcClose")?.focus?.();
    }
  }

  function focusableElements(overlay) {
    return Array.from(overlay.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(element => !element.closest('[aria-hidden="true"]'));
  }

  function handleModalKeydown(event) {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay?.classList.contains("open")) return;
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = focusableElements(overlay);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!overlay.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function close() {
    const overlay = document.getElementById(OVERLAY_ID);
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("onyx-modal-open");
    document.removeEventListener?.("keydown", handleModalKeydown);
    selectedSlot = null;
    editorDraft = null;
    moveFrom = null;
    pendingSwap = null;
    lastFocused?.focus?.();
    lastFocused = null;
  }

  function updateEditorEstimate(overlay) {
    const type = canonicalTowerType(overlay.querySelector("#obcSlotTowerType")?.value || "");
    const level = Number.parseInt(overlay.querySelector("#obcSlotTowerLevel")?.value, 10);
    const estimate = towerEstimate({ type, level });
    const output = overlay.querySelector("#obcEditorEstimate");
    if (output) output.textContent = estimate === null ? "Unavailable" : `≈ ${formatNumber(estimate)}`;
  }

  function handleMoveDestination(destination) {
    if (moveFrom === null || !layout) return false;
    if (destination === moveFrom) {
      moveFrom = null;
      pendingSwap = null;
      saveMessage = "Move cancelled.";
      render({ focusSelector: `[data-obc-slot="${destination}"]` });
      return true;
    }
    if (layout.slots[destination]) {
      pendingSwap = destination;
      selectedIsland = Math.floor(destination / SLOTS_PER_ISLAND);
      render({ focusSelector: "#obcConfirmSwap", scrollSelector: ".obc-island-command" });
      return true;
    }
    layout.slots[destination] = layout.slots[moveFrom];
    layout.slots[moveFrom] = null;
    selectedIsland = Math.floor(destination / SLOTS_PER_ISLAND);
    moveFrom = null;
    pendingSwap = null;
    markDirty("Tower moved · Estimated island DP updated.");
    render({
      focusSelector: `[data-obc-slot="${destination}"]`,
      scrollSelector: ".obc-island-command"
    });
    return true;
  }

  function syncDraftIndicators(overlay) {
    const chip = overlay.querySelector(".obc-draft-chip");
    chip?.classList.remove("saved");
    chip?.classList.add("draft");
    if (chip) chip.textContent = "Unsaved draft";
    const saveButton = overlay.querySelector("#obcSaveLayout");
    if (saveButton) saveButton.disabled = false;
    const dockTitle = overlay.querySelector(".obc-save-dock > div:first-child strong");
    const dockMessage = overlay.querySelector(".obc-save-dock > div:first-child span");
    if (dockTitle) dockTitle.textContent = "Draft command state";
    if (dockMessage) dockMessage.textContent = saveMessage;
  }

  async function importPrivateInventory(file) {
    if (!file) return;
    if (Number(file.size) > 220 * 1024 * 1024) {
      importMessage = "That private file is too large to inspect safely in this browser session.";
      render({ focusSelector: "#obcOpenPrivateImport" });
      return;
    }
    importMessage = "Inspecting tower records locally…";
    render({ focusSelector: "#obcOpenPrivateImport" });
    try {
      const bridge = window.OnyxTowerInventoryBridge;
      if (typeof bridge?.importHar !== "function") {
        throw new Error("Private tower inventory tools are unavailable.");
      }
      const parsed = JSON.parse(await file.text());
      const snapshot = bridge.importHar(parsed);
      refreshInventory(snapshot);
      const summary = inventorySummary();
      importMessage = summary.towers
        ? `${formatNumber(summary.towers)} verified tower record${summary.towers === 1 ? "" : "s"} ready. The private file was not stored.`
        : "No exact tower inventory records were detected. Manual entry remains available.";
    } catch (error) {
      importMessage = "Onyx could not verify tower inventory in that private file. Nothing was stored.";
      console.warn("[Onyx Base] Private tower inventory import failed.", error);
    }
    render({ focusSelector: "#obcOpenPrivateImport" });
  }

  function bindEvents(overlay) {
    overlay.querySelector("#obcClose")?.addEventListener("click", close);
    overlay.addEventListener("click", event => {
      if (event.target === overlay) close();
    });
    overlay.querySelectorAll("[data-obc-tab]").forEach(button => {
      button.addEventListener("click", () => {
        activeTab = button.dataset.obcTab;
        selectedSlot = null;
        editorDraft = null;
        moveFrom = null;
        pendingSwap = null;
        render({ focusSelector: `[data-obc-tab="${activeTab}"]` });
      });
    });

    overlay.querySelector("#obcTowerType")?.addEventListener("change", event => {
      selectedTower = event.target.value;
      const levels = rowsFor(selectedTower).map(row => Number(row.level)).filter(Number.isFinite);
      selectedLevel = levels.length ? Math.min(...levels) : 1;
      render({ focusSelector: "#obcTowerType" });
    });
    overlay.querySelector("#obcTowerLevel")?.addEventListener("change", event => {
      selectedLevel = Number.parseInt(event.target.value, 10) || 1;
      render({ focusSelector: "#obcTowerLevel" });
    });

    overlay.querySelector("#obcCreateLayout")?.addEventListener("click", () => {
      const name = overlay.querySelector("#obcNewLayoutName")?.value || "My Base";
      layout = createLayout(name);
      savedSnapshot = null;
      selectedIsland = 0;
      selectedSlot = null;
      editorDraft = null;
      markDirty("New manual layout draft created.");
      render({ focusSelector: '[data-obc-island="0"]' });
    });

    overlay.querySelectorAll("#obcOpenPrivateImport").forEach(button => {
      button.addEventListener("click", () => {
        overlay.querySelector("#obcPrivateInventoryFile")?.click?.();
      });
    });

    overlay.querySelector("#obcPrivateInventoryFile")?.addEventListener("change", event => {
      const file = event.target.files?.[0] || null;
      event.target.value = "";
      importPrivateInventory(file);
    });

    overlay.querySelector("#obcLayoutName")?.addEventListener("input", event => {
      layout.name = String(event.target.value || "").slice(0, 60);
      markDirty();
      syncDraftIndicators(overlay);
    });

    overlay.querySelectorAll("[data-obc-island]").forEach(button => {
      button.addEventListener("click", () => {
        selectedIsland = Number(button.dataset.obcIsland);
        selectedSlot = null;
        editorDraft = null;
        pendingSwap = null;
        render({ focusSelector: ".obc-island-command", scrollSelector: ".obc-island-command" });
      });
    });

    overlay.querySelectorAll("[data-obc-slot]").forEach(button => {
      button.addEventListener("click", () => {
        const destination = Number(button.dataset.obcSlot);
        if (handleMoveDestination(destination)) return;
        selectedIsland = Math.floor(destination / SLOTS_PER_ISLAND);
        openEditor(destination);
        render({ focusSelector: "#obcSlotTowerType", scrollSelector: ".obc-tower-sheet" });
      });
    });

    overlay.querySelector("#obcCancelSlot")?.addEventListener("click", () => {
      const slot = selectedSlot;
      selectedSlot = null;
      editorDraft = null;
      render({ focusSelector: `[data-obc-slot="${slot}"]` });
    });

    overlay.querySelectorAll("[data-obc-inventory]").forEach(button => {
      button.addEventListener("click", () => {
        const record = inventoryRecords()[Number(button.dataset.obcInventory)];
        if (!record) return;
        editorDraft = {
          type: record.type,
          level: record.level,
          notes: editorDraft?.notes || ""
        };
        render({ focusSelector: "#obcSlotTowerType", scrollSelector: ".obc-tower-sheet" });
      });
    });

    overlay.querySelector("#obcSlotTowerType")?.addEventListener("input", () => updateEditorEstimate(overlay));
    overlay.querySelector("#obcSlotTowerLevel")?.addEventListener("input", () => updateEditorEstimate(overlay));

    overlay.querySelector("#obcSaveTower")?.addEventListener("click", () => {
      if (selectedSlot === null || !layout) return;
      const type = overlay.querySelector("#obcSlotTowerType")?.value || "";
      const level = Number.parseInt(overlay.querySelector("#obcSlotTowerLevel")?.value, 10);
      const notes = overlay.querySelector("#obcSlotTowerNotes")?.value || "";
      const tower = normaliseTower({ type, level, notes });
      if (!tower) {
        const status = overlay.querySelector("#obcEditorStatus");
        if (status) status.textContent = "Enter a tower type and a whole level from 1 to 999.";
        return;
      }
      layout.slots[selectedSlot] = tower;
      selectedTower = tower.type;
      selectedLevel = tower.level;
      const focusSlot = selectedSlot;
      selectedSlot = null;
      editorDraft = null;
      markDirty("Tower placed · Estimated DP updated.");
      render({
        focusSelector: `[data-obc-slot="${focusSlot}"]`,
        scrollSelector: ".obc-island-command"
      });
    });

    overlay.querySelector("#obcClearTower")?.addEventListener("click", () => {
      if (selectedSlot === null || !layout) return;
      const focusSlot = selectedSlot;
      layout.slots[selectedSlot] = null;
      selectedSlot = null;
      editorDraft = null;
      markDirty("Tower removed · Estimated DP updated.");
      render({
        focusSelector: `[data-obc-slot="${focusSlot}"]`,
        scrollSelector: ".obc-island-command"
      });
    });

    overlay.querySelector("#obcStartMove")?.addEventListener("click", () => {
      if (selectedSlot === null || !layout?.slots[selectedSlot]) return;
      moveFrom = selectedSlot;
      selectedSlot = null;
      editorDraft = null;
      pendingSwap = null;
      render({ focusSelector: "#obcCancelMove" });
    });

    overlay.querySelector("#obcCancelMove")?.addEventListener("click", () => {
      const source = moveFrom;
      moveFrom = null;
      pendingSwap = null;
      render({
        focusSelector: source === null ? '[data-obc-island="0"]' : `[data-obc-slot="${source}"]`
      });
    });

    overlay.querySelector("#obcConfirmSwap")?.addEventListener("click", () => {
      if (moveFrom === null || pendingSwap === null || !layout) return;
      const destination = pendingSwap;
      [layout.slots[moveFrom], layout.slots[destination]] = [
        layout.slots[destination],
        layout.slots[moveFrom]
      ];
      moveFrom = null;
      pendingSwap = null;
      selectedIsland = Math.floor(destination / SLOTS_PER_ISLAND);
      markDirty("Towers swapped · Estimated island DP updated.");
      render({
        focusSelector: `[data-obc-slot="${destination}"]`,
        scrollSelector: ".obc-island-command"
      });
    });

    overlay.querySelector("#obcCancelSwap")?.addEventListener("click", () => {
      pendingSwap = null;
      render({ focusSelector: "#obcCancelMove" });
    });

    overlay.querySelector("#obcSaveLayout")?.addEventListener("click", saveCloud);

    overlay.querySelector("#obcResetLayout")?.addEventListener("click", () => {
      if (savedSnapshot) {
        if (!window.confirm("Reset this draft to the last profile-saved layout?")) return;
        layout = clone(savedSnapshot);
        selectedSlot = null;
        editorDraft = null;
        moveFrom = null;
        pendingSwap = null;
        updateDraftState();
        saveLocal();
        saveMessage = "Draft reset to the last profile save.";
        render({ focusSelector: "#obcResetLayout" });
        return;
      }
      if (!window.confirm("Clear this unsaved manual layout and return to the start?")) return;
      layout = null;
      selectedSlot = null;
      editorDraft = null;
      moveFrom = null;
      pendingSwap = null;
      saveLocal();
      updateDraftState();
      saveMessage = "";
      render({ focusSelector: "#obcCreateLayout" });
    });

    overlay.querySelector("#obcDeleteLayout")?.addEventListener("click", async () => {
      if (!window.confirm("Delete this manual layout from this device and your Onyx profile?")) return;
      const hasProfileCopy = Boolean(savedSnapshot);
      const saver = window.ChestDatabase?.saveOnyxBaseLayout;
      if (hasProfileCopy) {
        if (typeof saver !== "function") {
          saveMessage = "The layout was kept because profile deletion is unavailable.";
          render({ focusSelector: "#obcDeleteLayout" });
          return;
        }
        try {
          await saver.call(window.ChestDatabase, null);
        } catch (error) {
          saveMessage = "The layout was kept because Onyx could not delete the profile copy.";
          render({ focusSelector: "#obcDeleteLayout" });
          console.warn("[Onyx Base] The profile copy could not be cleared.", error);
          return;
        }
      }

      layout = null;
      savedSnapshot = null;
      selectedSlot = null;
      editorDraft = null;
      moveFrom = null;
      pendingSwap = null;
      saveLocal();
      updateDraftState();
      saveMessage = "Manual layout deleted from this device and your Onyx profile.";
      render({ focusSelector: "#obcCreateLayout" });
    });

    overlay.querySelector("#obcGoToBuilder")?.addEventListener("click", () => {
      activeTab = "builder";
      render({ focusSelector: '[data-obc-tab="builder"]' });
    });
  }

  function open(tab = "intelligence") {
    activeTab = ["builder", "advisor"].includes(tab) ? tab : "intelligence";
    lastFocused = document.activeElement;
    const currentUser = userId() || "signed-out";
    if (openedForUser !== null && openedForUser !== currentUser) {
      inventorySnapshot = null;
      importMessage = "";
      window.OnyxTowerInventoryBridge?.clear?.();
    }
    openedForUser = currentUser;
    readLocal();
    refreshInventory();
    render();
    const overlay = ensureOverlay();
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("onyx-modal-open");
    document.addEventListener?.("keydown", handleModalKeydown);
    overlay.querySelector("#obcClose")?.focus?.();
    loadCloud();
  }

  function estimateLayout(value) {
    const normalised = normaliseLayout(value);
    if (!normalised) return null;
    return {
      total: clone(estimateSlots(normalised.slots)),
      islands: ISLANDS.map((_, index) =>
        clone(estimateSlots(islandSlots(normalised, index)))
      )
    };
  }

  window.addEventListener?.("onyx:tower-inventory-imported", event => {
    refreshInventory(event?.detail);
    if (document.getElementById(OVERLAY_ID)?.classList.contains("open")) render();
  });

  window.addEventListener?.("onyx:tower-inventory-cleared", () => {
    inventorySnapshot = null;
    if (document.getElementById(OVERLAY_ID)?.classList.contains("open")) render();
  });

  window.OnyxBaseCommand = Object.freeze({
    open,
    close,
    createLayout,
    estimateLayout,
    getLayout: () => clone(layout),
    getTowerRecord: (type, level) => clone(exactRow(type, level))
  });
})();
