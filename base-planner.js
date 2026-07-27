(() => {
  "use strict";

  const STORAGE_KEY = "noirBasePlannerV1";
  const OVERLAY_ID = "noirBasePlannerOverlay";
  const ISLAND_COUNT = 8;
  const SLOTS_PER_ISLAND = 5;
  const TOTAL_SLOTS = ISLAND_COUNT * SLOTS_PER_ISLAND;

  const TOWER_TYPES = [
    "Archer Tower",
    "Cannon Tower",
    "Ballista",
    "Trebuchet",
    "Lightning Tower",
    "Storm Tower",
    "Red Mage Tower",
    "Blue Mage Tower",
    "Fire Turret",
    "Ice Turret",
    "Dark Flak Tower",
    "Fire Flak Tower",
    "Ice Flak Tower",
    "Earth Flak Tower",
    "Electro-Flak Tower",
    "Howitzer",
    "Crystal Howitzer",
    "Soul Drain Tower",
    "Drakul Pylon",
    "Cosmic Orrery",
    "Charged Volt Tower",
    "Red Archmage Tower",
    "Blue Archmage Tower",
    "Oculus Tower",
    "Nexus Tower",
    "Nullspire Tower",
    "Dark Totem",
    "Earth Totem",
    "Fire Totem",
    "Ice Totem",
    "Wind Totem",
    "Sheep Farm",
    "Lumber Mill",
    "Perch",
    "Monument",
    "Other"
  ];

  const BASE_IDENTIFIER_MAP = Object.freeze({
    archerTower: "Archer Tower",
    ballista: "Ballista",
    ballistaTower: "Ballista",
    cannonTower: "Cannon Tower",
    trebuchet: "Trebuchet",
    trebuchetTower: "Trebuchet",
    lightningTower: "Lightning Tower",
    lightningTowerSuper: "Charged Volt Tower",
    stormTower: "Storm Tower",
    mageTower: "Red Mage Tower",
    mageRedTower: "Red Mage Tower",
    mageBlueTower: "Blue Mage Tower",
    mageTowerSuper: "Red Archmage Tower",
    mageBlueTowerSuper: "Blue Archmage Tower",
    fireTurret: "Fire Turret",
    iceTurret: "Ice Turret",
    elementalFlakDark: "Dark Flak Tower",
    elementalFlakFire: "Fire Flak Tower",
    elementalFlakIce: "Ice Flak Tower",
    elementalFlakEarth: "Earth Flak Tower",
    elementalFlakWind: "Electro-Flak Tower",
    elementalFlakElectro: "Electro-Flak Tower",
    howitzer: "Howitzer",
    crystalHowitzer: "Crystal Howitzer",
    soulDrainTower: "Soul Drain Tower",
    drainTower: "Drakul Pylon",
    drakulPylon: "Drakul Pylon",
    E20Q4Tower: "Cosmic Orrery",
    cosmicOrrery: "Cosmic Orrery",
    chargedVoltTower: "Charged Volt Tower",
    oculusTower: "Oculus Tower",
    nexusTower: "Nexus Tower",
    nullspireTower: "Nullspire Tower",
    cmCrystaldark: "Dark Totem",
    cmCrystalearth: "Earth Totem",
    cmCrystalfire: "Fire Totem",
    cmCrystalice: "Ice Totem",
    cmCrystalwind: "Wind Totem",
    darkTotem: "Dark Totem",
    earthTotem: "Earth Totem",
    fireTotem: "Fire Totem",
    iceTotem: "Ice Totem",
    windTotem: "Wind Totem",
    hogFarm: "Sheep Farm",
    sheepFarm: "Sheep Farm",
    woodFarm: "Lumber Mill",
    lumberMill: "Lumber Mill",
    monument: "Monument"
  });

  const OFFENCE_TYPES = new Set([
    "Archer Tower",
    "Cannon Tower",
    "Ballista",
    "Trebuchet",
    "Lightning Tower",
    "Fire Turret",
    "Ice Turret",
    "Dark Flak Tower",
    "Fire Flak Tower",
    "Ice Flak Tower",
    "Earth Flak Tower",
    "Electro-Flak Tower",
    "Howitzer",
    "Crystal Howitzer",
    "Soul Drain Tower",
    "Drakul Pylon",
    "Cosmic Orrery",
    "Charged Volt Tower",
    "Red Archmage Tower",
    "Blue Archmage Tower",
    "Oculus Tower",
    "Nexus Tower",
    "Nullspire Tower"
  ]);

  let selectedSlot = null;
  let dragSlot = null;
  let state = loadState();

  function blankSlots() {
    return Array.from({ length: TOTAL_SLOTS }, () => null);
  }

  function createLayout(name = "My Base") {
    return {
      id: `layout-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      currentDp: "",
      notes: "",
      slots: blankSlots(),
      perches: Array.from({ length: 3 }, () => null),
      storedTowers: [],
      snapshotImportedAt: "",
      updatedAt: new Date().toISOString()
    };
  }

  function normaliseTower(tower) {
    if (!tower || typeof tower !== "object") return null;
    return {
      id: String(tower.id || `tower-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      type: String(tower.type || "Other"),
      customName: String(tower.customName || ""),
      level: Math.max(0, Number.parseInt(tower.level, 10) || 0),
      runes: String(tower.runes || ""),
      monument: Boolean(tower.monument)
    };
  }

  function normaliseLayout(layout) {
    const safe = layout && typeof layout === "object" ? layout : {};
    return {
      id: String(safe.id || `layout-${Date.now()}`),
      name: String(safe.name || "My Base"),
      currentDp: String(safe.currentDp || ""),
      notes: String(safe.notes || ""),
      slots: Array.from(
        { length: TOTAL_SLOTS },
        (_, index) => normaliseTower(Array.isArray(safe.slots) ? safe.slots[index] : null)
      ),
      perches: Array.from({ length: 3 }, (_, index) => {
        const perch = Array.isArray(safe.perches) ? safe.perches[index] : null;
        if (!perch || typeof perch !== "object") return null;
        return {
          name: ["Autumn Perch", "Grass Perch", "Volcano Perch"][index],
          level: Math.max(0, Number.parseInt(perch.level, 10) || 0),
          dragonAssigned: Boolean(perch.dragonAssigned)
        };
      }),
      storedTowers: Array.isArray(safe.storedTowers)
        ? safe.storedTowers.map(normaliseTower).filter(Boolean)
        : [],
      snapshotImportedAt: String(safe.snapshotImportedAt || ""),
      updatedAt: String(safe.updatedAt || new Date().toISOString())
    };
  }

  function loadState() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (parsed && Array.isArray(parsed.layouts) && parsed.layouts.length) {
        const layouts = parsed.layouts.map(normaliseLayout);
        return {
          layouts,
          activeId: layouts.some(layout => layout.id === parsed.activeId)
            ? parsed.activeId
            : layouts[0].id
        };
      }
    } catch (error) {
      console.warn("Noir Base Planner could not read saved data.", error);
    }

    const layout = createLayout();
    return { layouts: [layout], activeId: layout.id };
  }

  function saveState() {
    activeLayout().updatedAt = new Date().toISOString();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function activeLayout() {
    return state.layouts.find(layout => layout.id === state.activeId) || state.layouts[0];
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function towerLabel(tower) {
    if (!tower) return "Empty";
    return tower.type === "Other" && tower.customName
      ? tower.customName
      : tower.type;
  }

  function islandForSlot(index) {
    return Math.floor(index / SLOTS_PER_ISLAND);
  }

  function calculateSummary(layout = activeLayout()) {
    const towers = layout.slots.filter(Boolean);
    const occupied = towers.length;
    const empty = TOTAL_SLOTS - occupied;
    const levels = towers.map(tower => tower.level).filter(level => level > 0);
    const averageLevel = levels.length
      ? levels.reduce((sum, level) => sum + level, 0) / levels.length
      : 0;
    const activeIslands = new Set(
      layout.slots
        .map((tower, index) => (tower ? islandForSlot(index) : null))
        .filter(index => index !== null)
    ).size;
    const highDamageByIsland = Array.from({ length: ISLAND_COUNT }, (_, island) => {
      const start = island * SLOTS_PER_ISLAND;
      return layout.slots
        .slice(start, start + SLOTS_PER_ISLAND)
        .filter(tower => tower && OFFENCE_TYPES.has(tower.type))
        .length;
    });
    const warnings = [];

    highDamageByIsland.forEach((count, island) => {
      const start = island * SLOTS_PER_ISLAND;
      const used = layout.slots.slice(start, start + SLOTS_PER_ISLAND).filter(Boolean).length;
      if (used >= 3 && count < 3) {
        warnings.push(`Island ${island + 1} has only ${count} high-damage tower${count === 1 ? "" : "s"}.`);
      }
    });

    if (activeIslands > 2 && occupied / Math.max(activeIslands, 1) < 4) {
      warnings.push("Your base is spread across several partly filled islands. Compare it with a more compact layout.");
    }

    return { occupied, empty, averageLevel, activeIslands, highDamageByIsland, warnings };
  }

  function moveTower(fromIndex, toIndex, layout = activeLayout()) {
    const from = Number(fromIndex);
    const to = Number(toIndex);
    if (
      !Number.isInteger(from) ||
      !Number.isInteger(to) ||
      from < 0 ||
      to < 0 ||
      from >= TOTAL_SLOTS ||
      to >= TOTAL_SLOTS ||
      from === to
    ) return false;

    [layout.slots[from], layout.slots[to]] = [layout.slots[to], layout.slots[from]];
    saveState();
    return true;
  }

  function addTower(tower, preferredSlot = null, layout = activeLayout()) {
    const normalised = normaliseTower(tower);
    if (!normalised) return -1;
    const requested = Number(preferredSlot);
    const slot = Number.isInteger(requested) && requested >= 0 && requested < TOTAL_SLOTS
      ? requested
      : layout.slots.findIndex(value => !value);
    if (slot < 0) return -1;
    layout.slots[slot] = normalised;
    saveState();
    return slot;
  }

  function removeTower(index, layout = activeLayout()) {
    if (!Number.isInteger(index) || index < 0 || index >= TOTAL_SLOTS) return false;
    layout.slots[index] = null;
    saveState();
    return true;
  }

  function parseTowerLines(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const match = line.match(/^(.*?)(?:\s*[,|\-]\s*|\s+level\s+)(\d+)$/i);
        const rawType = (match ? match[1] : line).trim();
        const level = match ? Number.parseInt(match[2], 10) : 0;
        const known = TOWER_TYPES.find(
          type => type.toLowerCase() === rawType.toLowerCase()
        );
        return normaliseTower({
          id: `bulk-${Date.now()}-${index}`,
          type: known || "Other",
          customName: known ? "" : rawType,
          level
        });
      });
  }

  function importTowerLines(text, layout = activeLayout()) {
    const towers = parseTowerLines(text);
    let inserted = 0;
    towers.forEach(tower => {
      const slot = layout.slots.findIndex(value => !value);
      if (slot < 0) return;
      layout.slots[slot] = tower;
      inserted += 1;
    });
    if (inserted) saveState();
    return inserted;
  }

  function tolerantDecode(value) {
    let current = String(value || "");
    for (let round = 0; round < 5; round += 1) {
      const decoded = current.replace(/%([0-9a-fA-F]{2})/g, (_, hex) =>
        String.fromCharCode(Number.parseInt(hex, 16))
      );
      if (decoded === current) break;
      current = decoded;
    }
    return current
      .replace(/\\"/g, '"')
      .replace(/\\u0022/gi, '"')
      .replace(/\\\//g, "/");
  }

  function objectValue(fragment, key) {
    const match = String(fragment).match(
      new RegExp(`"${key}"\\s*:\\s*(?:"([^"]*)"|(-?\\d+)|(true|false))`, "i")
    );
    if (!match) return null;
    if (match[1] !== undefined) return match[1];
    if (match[2] !== undefined) return Number.parseInt(match[2], 10);
    return match[3].toLowerCase() === "true";
  }

  function parseBaseSnapshot(text) {
    const decoded = tolerantDecode(text);
    const fragments = decoded.match(/\{[^{}]{0,6000}\}/g) || [];
    const slots = blankSlots();
    const perches = Array.from({ length: 3 }, () => null);
    const storedTowers = [];
    const perchLocations = {
      loc_perchAutumn: [0, "Autumn Perch"],
      loc_perchGrass: [1, "Grass Perch"],
      loc_perchVolcano: [2, "Volcano Perch"]
    };
    let skippedCount = 0;

    fragments.forEach((fragment, fragmentIndex) => {
      const identifier = objectValue(fragment, "identifier");
      if (!identifier) return;
      const level = Math.max(0, Number.parseInt(objectValue(fragment, "level"), 10) || 0);
      const expansion = objectValue(fragment, "expansionIdentifier");
      const location = objectValue(fragment, "locationIdentifier");
      const stored = objectValue(fragment, "stored") === true;

      if (location && perchLocations[location]) {
        const [index, name] = perchLocations[location];
        perches[index] = {
          name,
          level,
          dragonAssigned: Boolean(objectValue(fragment, "dragonIdentifier"))
        };
        return;
      }

      const mappedType = BASE_IDENTIFIER_MAP[identifier];
      if (!mappedType) {
        if (expansion || stored) skippedCount += 1;
        return;
      }

      const tower = normaliseTower({
        id: `snapshot-${fragmentIndex}-${identifier}`,
        type: mappedType,
        level
      });

      const slotMatch = String(expansion || "").match(/^expansion_(\d{3})$/);
      if (!stored && slotMatch) {
        const slot = Number.parseInt(slotMatch[1], 10) - 1;
        if (slot >= 0 && slot < TOTAL_SLOTS) slots[slot] = tower;
        return;
      }

      if (stored) storedTowers.push(tower);
    });

    Object.entries(perchLocations).forEach(([location, [index, name]]) => {
      const locationIndex = decoded.indexOf(`"expansionIdentifier":"${location}"`);
      if (locationIndex < 0) return;
      const objectStart = decoded.lastIndexOf("{", locationIndex);
      const context = decoded.slice(Math.max(0, objectStart), locationIndex + 700);
      const identifier = objectValue(context, "identifier");
      if (!/^perchIsland\d+$/i.test(String(identifier || ""))) return;
      perches[index] = {
        name,
        level: Math.max(0, Number.parseInt(objectValue(context, "level"), 10) || 0),
        dragonAssigned: Boolean(objectValue(context, "dragonIdentifier"))
      };
    });

    const dedupedStored = [];
    const seenStored = new Set();
    storedTowers.forEach(tower => {
      const key = `${tower.type}|${tower.level}|${tower.id}`;
      if (seenStored.has(key)) return;
      seenStored.add(key);
      dedupedStored.push(tower);
    });

    return {
      slots,
      perches,
      storedTowers: dedupedStored,
      importedCount: slots.filter(Boolean).length,
      perchCount: perches.filter(Boolean).length,
      storedCount: dedupedStored.length,
      skippedCount
    };
  }

  function importBaseSnapshot(text, layout = activeLayout()) {
    const parsed = parseBaseSnapshot(text);
    if (!parsed.importedCount) return parsed;
    layout.slots = parsed.slots;
    layout.perches = parsed.perches;
    layout.storedTowers = parsed.storedTowers;
    layout.snapshotImportedAt = new Date().toISOString();
    saveState();
    return parsed;
  }

  function renderPerches(layout) {
    const perches = Array.isArray(layout.perches) ? layout.perches : [];
    return `
      <div class="nbp-support-grid">
        ${perches.map((perch, index) => `
          <div>
            <span>${escapeHtml(perch?.name || ["Autumn Perch", "Grass Perch", "Volcano Perch"][index])}</span>
            <strong>${perch ? `Level ${perch.level || "not recorded"}` : "Not found"}</strong>
            <small>${perch?.dragonAssigned ? "Dragon assigned" : "No assigned dragon found"}</small>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderStoredTowers(layout) {
    const stored = Array.isArray(layout.storedTowers) ? layout.storedTowers : [];
    if (!stored.length) return "<p class=\"nbp-empty-copy\">No stored buildable towers were found in the imported snapshot.</p>";
    const grouped = new Map();
    stored.forEach(tower => {
      const key = `${tower.type}|${tower.level}`;
      grouped.set(key, {
        type: tower.type,
        level: tower.level,
        count: (grouped.get(key)?.count || 0) + 1
      });
    });
    return `
      <div class="nbp-stored-list">
        ${[...grouped.values()].map(item => `
          <div>
            <strong>${escapeHtml(item.type)}</strong>
            <span>${item.count} stored · Level ${item.level || "not recorded"}</span>
          </div>
        `).join("")}
      </div>
    `;
  }

  function renderSlot(tower, index) {
    const selected = selectedSlot === index ? " selected" : "";
    if (!tower) {
      return `
        <button class="nbp-slot empty${selected}" type="button" data-slot="${index}">
          <span class="nbp-slot-number">${(index % SLOTS_PER_ISLAND) + 1}</span>
          <span>Empty slot</span>
        </button>
      `;
    }

    return `
      <button
        class="nbp-slot occupied${selected}"
        type="button"
        data-slot="${index}"
        draggable="true"
      >
        <span class="nbp-slot-number">${(index % SLOTS_PER_ISLAND) + 1}</span>
        <strong>${escapeHtml(towerLabel(tower))}</strong>
        <small>${tower.level ? `Level ${tower.level}` : "Level not entered"}</small>
        ${tower.runes ? `<em>${escapeHtml(tower.runes)}</em>` : ""}
      </button>
    `;
  }

  function renderIsland(layout, island) {
    const start = island * SLOTS_PER_ISLAND;
    const slots = layout.slots.slice(start, start + SLOTS_PER_ISLAND);
    const occupied = slots.filter(Boolean).length;
    return `
      <section class="nbp-island">
        <header>
          <div>
            <span class="nbp-kicker">${island === 0 ? "FRONT" : island === ISLAND_COUNT - 1 ? "HOME" : `SECTION ${island + 1}`}</span>
            <h3>Island ${island + 1}</h3>
          </div>
          <span>${occupied}/5</span>
        </header>
        <div class="nbp-island-path">
          ${slots.map((tower, offset) => renderSlot(tower, start + offset)).join("")}
        </div>
      </section>
    `;
  }

  function renderSummary(layout) {
    const summary = calculateSummary(layout);
    return `
      <div class="nbp-summary-grid">
        <div><span>Towers placed</span><strong>${summary.occupied}</strong></div>
        <div><span>Active islands</span><strong>${summary.activeIslands}</strong></div>
        <div><span>Average level</span><strong>${summary.averageLevel.toFixed(1)}</strong></div>
        <div><span>Recorded DP</span><strong>${escapeHtml(layout.currentDp || "Not entered")}</strong></div>
      </div>
      <div class="nbp-advice">
        <strong>${summary.warnings.length ? "Layout checks" : "No layout warnings yet"}</strong>
        ${
          summary.warnings.length
            ? `<ul>${summary.warnings.map(warning => `<li>${escapeHtml(warning)}</li>`).join("")}</ul>`
            : "<p>Add your real towers to begin checking island balance and compactness.</p>"
        }
      </div>
    `;
  }

  function renderEditor() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    const layout = activeLayout();

    overlay.innerHTML = `
      <div class="nbp-shell">
        <header class="nbp-topbar">
          <div>
            <p>NOIR BASE PLANNER</p>
            <h2>Build your real WD base</h2>
          </div>
          <button class="nbp-close" type="button" aria-label="Close Base Planner">×</button>
        </header>

        <section class="nbp-panel nbp-intro">
          <div>
            <span class="nbp-kicker">YOUR LAYOUT</span>
            <h3>Move towers safely before changing the game</h3>
            <p>
              Enter the towers you actually own, then tap two slots to swap them.
              On larger screens you can drag towers between slots.
            </p>
          </div>
          <div class="nbp-layout-actions">
            <select id="nbpLayoutSelect" aria-label="Saved layout">
              ${state.layouts.map(item => `
                <option value="${escapeHtml(item.id)}" ${item.id === state.activeId ? "selected" : ""}>
                  ${escapeHtml(item.name)}
                </option>
              `).join("")}
            </select>
            <button id="nbpDuplicateLayout" type="button">Duplicate</button>
            <button id="nbpNewLayout" type="button">New</button>
          </div>
        </section>

        <section class="nbp-panel nbp-details">
          <label>
            Layout name
            <input id="nbpLayoutName" value="${escapeHtml(layout.name)}" maxlength="45">
          </label>
          <label>
            Current displayed DP
            <input id="nbpCurrentDp" value="${escapeHtml(layout.currentDp)}" placeholder="e.g. 370B">
          </label>
          <label class="wide">
            Notes
            <input id="nbpNotes" value="${escapeHtml(layout.notes)}" placeholder="What are you testing?">
          </label>
        </section>

        <section class="nbp-panel nbp-snapshot">
          <span class="nbp-kicker">FORTIFICATION SETUP</span>
          <h3>Import your current base</h3>
          <p>
            Choose your captured base file to fill all 40 positions, tower levels,
            perches and stored towers automatically. The file is read only on this
            device and is never uploaded.
          </p>
          <input id="nbpSnapshotFile" type="file" accept=".har,.json,application/json">
          <button id="nbpSnapshotImport" class="nbp-primary" type="button">Import base snapshot</button>
          <p id="nbpSnapshotStatus" class="nbp-import-status">
            ${layout.snapshotImportedAt
              ? `A base snapshot is saved in this layout: ${layout.slots.filter(Boolean).length}/40 positions, ${layout.perches.filter(Boolean).length}/3 perches and ${layout.storedTowers.length} stored towers.`
              : "No base snapshot has been imported into this layout yet."}
          </p>
          <small>
            This capture proves positions, levels, perches and stored structures.
            Exact upgrade costs, build times and a complete rune, glyph and relic
            catalogue are not present, so Noir will not guess them.
          </small>
        </section>

        <section class="nbp-panel">
          <span class="nbp-kicker">ADD A TOWER</span>
          <div class="nbp-add-grid">
            <label>
              Tower
              <select id="nbpTowerType">
                ${TOWER_TYPES.map(type => `<option>${escapeHtml(type)}</option>`).join("")}
              </select>
            </label>
            <label>
              Level
              <input id="nbpTowerLevel" type="number" min="0" inputmode="numeric" placeholder="Level">
            </label>
            <label>
              Runes, glyphs or relics
              <input id="nbpTowerRunes" placeholder="Optional notes">
            </label>
            <label id="nbpCustomNameWrap" class="hidden">
              Building name
              <input id="nbpCustomName" placeholder="Custom name">
            </label>
            <button id="nbpAddTower" class="nbp-primary" type="button">Add to first empty slot</button>
          </div>
          <details class="nbp-bulk">
            <summary>Quickly enter several towers</summary>
            <p>Use one line per tower, for example: <strong>Dark Flak Tower, 160</strong></p>
            <textarea id="nbpBulkInput" rows="6" placeholder="Dark Flak Tower, 160&#10;Storm Tower, 158&#10;Red Mage Tower, 160"></textarea>
            <button id="nbpBulkAdd" type="button">Add list to empty slots</button>
          </details>
        </section>

        <section class="nbp-panel">
          <span class="nbp-kicker">BASE SUPPORT</span>
          <h3>Perches</h3>
          ${renderPerches(layout)}
          <h3 class="nbp-subheading">Stored towers for Fortification</h3>
          ${renderStoredTowers(layout)}
        </section>

        <section class="nbp-panel">
          <div class="nbp-section-heading">
            <div>
              <span class="nbp-kicker">BASE MAP</span>
              <h3>40 real tower positions</h3>
            </div>
            <button id="nbpClearSelection" type="button">Clear selection</button>
          </div>
          <p id="nbpMoveHint" class="nbp-move-hint">
            ${selectedSlot === null ? "Tap a tower, then tap its destination to swap." : `Slot ${selectedSlot + 1} selected. Choose its destination.`}
          </p>
          <div class="nbp-base-map">
            ${Array.from({ length: ISLAND_COUNT }, (_, island) => renderIsland(layout, island)).join("")}
          </div>
        </section>

        <section class="nbp-panel">
          <div class="nbp-section-heading">
            <div>
              <span class="nbp-kicker">CHECK &amp; COMPARE</span>
              <h3>Layout summary</h3>
            </div>
            <button id="nbpRemoveSelected" type="button" ${selectedSlot === null ? "disabled" : ""}>
              Remove selected
            </button>
          </div>
          ${renderSummary(layout)}
        </section>

        <section class="nbp-panel nbp-privacy">
          <strong>Saved only on this device</strong>
          <p>Your base layouts are separate from chest predictions and do not alter any predictor data.</p>
          <button id="nbpResetPlanner" type="button">Reset Base Planner Data</button>
        </section>
      </div>
    `;

    bindEditorEvents();
  }

  function bindEditorEvents() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;

    overlay.querySelector(".nbp-close")?.addEventListener("click", close);
    overlay.querySelector("#nbpLayoutSelect")?.addEventListener("change", event => {
      state.activeId = event.target.value;
      selectedSlot = null;
      saveState();
      renderEditor();
    });

    ["Name", "CurrentDp", "Notes"].forEach(field => {
      overlay.querySelector(`#nbpLayout${field}`)?.addEventListener("input", event => {
        const key = field.charAt(0).toLowerCase() + field.slice(1);
        activeLayout()[key] = event.target.value;
        saveState();
      });
    });

    overlay.querySelector("#nbpNewLayout")?.addEventListener("click", () => {
      const layout = createLayout(`Layout ${state.layouts.length + 1}`);
      state.layouts.push(layout);
      state.activeId = layout.id;
      selectedSlot = null;
      saveState();
      renderEditor();
    });

    overlay.querySelector("#nbpDuplicateLayout")?.addEventListener("click", () => {
      const copy = normaliseLayout(JSON.parse(JSON.stringify(activeLayout())));
      copy.id = `layout-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      copy.name = `${activeLayout().name} Copy`;
      state.layouts.push(copy);
      state.activeId = copy.id;
      selectedSlot = null;
      saveState();
      renderEditor();
    });

    const towerType = overlay.querySelector("#nbpTowerType");
    towerType?.addEventListener("change", () => {
      overlay.querySelector("#nbpCustomNameWrap")?.classList.toggle(
        "hidden",
        towerType.value !== "Other"
      );
    });

    overlay.querySelector("#nbpAddTower")?.addEventListener("click", () => {
      const type = towerType?.value || "Other";
      const slot = addTower({
        type,
        customName: overlay.querySelector("#nbpCustomName")?.value || "",
        level: overlay.querySelector("#nbpTowerLevel")?.value || 0,
        runes: overlay.querySelector("#nbpTowerRunes")?.value || ""
      });
      if (slot < 0) {
        window.alert("All 40 positions are filled. Remove a tower or create another layout.");
        return;
      }
      renderEditor();
    });

    overlay.querySelector("#nbpBulkAdd")?.addEventListener("click", () => {
      const input = overlay.querySelector("#nbpBulkInput");
      const inserted = importTowerLines(input?.value || "");
      if (!inserted) {
        window.alert("Enter at least one tower before adding the list.");
        return;
      }
      renderEditor();
    });

    overlay.querySelector("#nbpSnapshotImport")?.addEventListener("click", async () => {
      const input = overlay.querySelector("#nbpSnapshotFile");
      const file = input?.files?.[0];
      if (!file) {
        window.alert("Choose your captured base file first.");
        return;
      }
      if (!window.confirm("Replace this layout's 40 base positions with the imported snapshot?")) return;
      const status = overlay.querySelector("#nbpSnapshotStatus");
      if (status) status.textContent = "Reading your base snapshot…";
      try {
        const result = importBaseSnapshot(await file.text());
        if (!result.importedCount) {
          window.alert("No supported base positions were found in that file.");
          return;
        }
        renderEditor();
      } catch (error) {
        console.warn("Noir could not import the base snapshot.", error);
        window.alert("Noir could not read that base snapshot. Your existing layout was not changed.");
      }
    });

    overlay.querySelectorAll("[data-slot]").forEach(button => {
      const index = Number(button.dataset.slot);
      button.addEventListener("click", () => {
        if (selectedSlot === null) {
          if (!activeLayout().slots[index]) return;
          selectedSlot = index;
        } else if (selectedSlot === index) {
          selectedSlot = null;
        } else {
          moveTower(selectedSlot, index);
          selectedSlot = null;
        }
        renderEditor();
      });

      button.addEventListener("dragstart", event => {
        if (!activeLayout().slots[index]) {
          event.preventDefault();
          return;
        }
        dragSlot = index;
        event.dataTransfer?.setData("text/plain", String(index));
      });
      button.addEventListener("dragover", event => event.preventDefault());
      button.addEventListener("drop", event => {
        event.preventDefault();
        const from = Number(event.dataTransfer?.getData("text/plain") || dragSlot);
        if (moveTower(from, index)) renderEditor();
        dragSlot = null;
      });
    });

    overlay.querySelector("#nbpClearSelection")?.addEventListener("click", () => {
      selectedSlot = null;
      renderEditor();
    });

    overlay.querySelector("#nbpRemoveSelected")?.addEventListener("click", () => {
      if (selectedSlot === null) return;
      removeTower(selectedSlot);
      selectedSlot = null;
      renderEditor();
    });

    overlay.querySelector("#nbpResetPlanner")?.addEventListener("click", () => {
      if (!window.confirm("Delete every Base Planner layout saved on this device?")) return;
      localStorage.removeItem(STORAGE_KEY);
      state = loadState();
      selectedSlot = null;
      renderEditor();
    });
  }

  function installStyles() {
    if (document.getElementById("noirBasePlannerStyles")) return;
    const style = document.createElement("style");
    style.id = "noirBasePlannerStyles";
    style.textContent = `
      .nbp-launch {
        width: 100%; margin: 20px 0 0; padding: 22px; display: flex;
        justify-content: space-between; align-items: center; gap: 16px;
        border: 1px solid rgba(102,143,190,.45); border-radius: 24px;
        background: linear-gradient(135deg, rgba(19,38,58,.72), rgba(5,7,9,.98) 74%);
        color: #eee9df; text-align: left;
      }
      .nbp-launch strong, .nbp-launch small { display: block; }
      .nbp-launch strong { font-size: 21px; }
      .nbp-launch small { margin-top: 7px; color: #aaa49b; line-height: 1.45; }
      .nbp-launch-icon { color: #7fb2da; font-size: 31px; }
      .nbp-overlay {
        position: fixed; inset: 0; z-index: 100000; display: none; overflow-y: auto;
        padding: max(12px, env(safe-area-inset-top)) 12px max(28px, env(safe-area-inset-bottom));
        box-sizing: border-box; background: #030405; color: #eeeae2;
      }
      .nbp-overlay.open { display: block; }
      .nbp-shell { width: min(1050px, 100%); margin: 0 auto; }
      .nbp-topbar {
        position: sticky; top: 0; z-index: 5; display: flex; justify-content: space-between;
        align-items: center; gap: 16px; padding: 16px 18px; border: 1px solid #282a2d;
        border-radius: 22px; background: rgba(5,6,7,.95); backdrop-filter: blur(18px);
      }
      .nbp-topbar p, .nbp-kicker {
        margin: 0; color: #d5b85f; font-size: 10px; font-weight: 950; letter-spacing: .18em;
      }
      .nbp-topbar h2 { margin: 5px 0 0; font-size: clamp(21px, 5vw, 31px); }
      .nbp-close {
        flex: 0 0 auto; width: 48px; height: 48px; border: 1px solid #3c3d40;
        border-radius: 50%; background: #111214; color: white; font-size: 30px;
      }
      .nbp-panel {
        margin-top: 14px; padding: 20px; border: 1px solid #292b2e; border-radius: 22px;
        background: linear-gradient(145deg, rgba(19,20,22,.98), rgba(7,8,9,.98));
      }
      .nbp-intro { display: grid; grid-template-columns: 1fr auto; gap: 20px; align-items: end; }
      .nbp-intro h3, .nbp-section-heading h3 { margin: 7px 0; font-size: 22px; }
      .nbp-intro p, .nbp-privacy p, .nbp-bulk p, .nbp-snapshot p { margin: 0; color: #a39d94; line-height: 1.55; }
      .nbp-layout-actions { display: flex; flex-wrap: wrap; gap: 8px; }
      .nbp-layout-actions select, .nbp-layout-actions button, .nbp-panel input,
      .nbp-panel select, .nbp-panel textarea, .nbp-panel button {
        box-sizing: border-box; border: 1px solid #383a3d; border-radius: 13px;
        background: #101113; color: #eeeae2; font: inherit;
      }
      .nbp-layout-actions select, .nbp-layout-actions button { padding: 11px 13px; }
      .nbp-details, .nbp-add-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 13px; }
      .nbp-details label, .nbp-add-grid label { color: #bcb6ac; font-size: 13px; font-weight: 800; }
      .nbp-details label.wide { grid-column: 1 / -1; }
      .nbp-panel input, .nbp-panel select, .nbp-panel textarea {
        width: 100%; margin-top: 7px; padding: 13px;
      }
      .nbp-panel button { padding: 12px 14px; }
      .nbp-panel .nbp-primary {
        align-self: end; border-color: #d7ba64; background: #d7ba64;
        color: #090909; font-weight: 950;
      }
      .nbp-bulk { margin-top: 17px; padding-top: 15px; border-top: 1px solid #292b2e; }
      .nbp-bulk summary { color: #d8bc69; font-weight: 850; cursor: pointer; }
      .nbp-bulk p { margin-top: 10px; font-size: 13px; }
      .nbp-bulk button { margin-top: 10px; }
      .nbp-snapshot h3 { margin: 8px 0; }
      .nbp-snapshot input { margin: 15px 0 10px; }
      .nbp-snapshot .nbp-import-status {
        margin-top: 13px; padding: 12px; border: 1px solid rgba(106,190,160,.32);
        border-radius: 13px; background: rgba(25,83,64,.2); color: #91d8bd;
      }
      .nbp-snapshot > small { display: block; margin-top: 12px; color: #8e8981; line-height: 1.5; }
      .nbp-support-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 13px; }
      .nbp-support-grid > div, .nbp-stored-list > div {
        padding: 14px; border: 1px solid #303237; border-radius: 15px; background: #0d0e10;
      }
      .nbp-support-grid span, .nbp-support-grid strong, .nbp-support-grid small { display: block; }
      .nbp-support-grid span, .nbp-stored-list span { color: #8f8b85; font-size: 12px; }
      .nbp-support-grid strong { margin-top: 7px; color: #dcc16e; }
      .nbp-support-grid small { margin-top: 6px; color: #8fa69e; }
      .nbp-subheading { margin: 22px 0 10px; }
      .nbp-stored-list { display: grid; grid-template-columns: repeat(2, 1fr); gap: 9px; }
      .nbp-stored-list > div { display: flex; justify-content: space-between; gap: 12px; }
      .nbp-empty-copy { color: #99938a; }
      .nbp-section-heading { display: flex; justify-content: space-between; align-items: center; gap: 13px; }
      .nbp-move-hint {
        margin: 12px 0 18px; padding: 12px 14px; border: 1px solid rgba(117,172,211,.35);
        border-radius: 14px; background: rgba(35,77,105,.2); color: #9ac8e7;
      }
      .nbp-base-map { display: grid; gap: 12px; }
      .nbp-island {
        padding: 14px; border: 1px solid #303338; border-radius: 19px;
        background: linear-gradient(90deg, rgba(25,30,35,.95), rgba(10,11,12,.98));
      }
      .nbp-island header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .nbp-island header h3 { margin: 4px 0 0; }
      .nbp-island header > span { color: #8e99a4; }
      .nbp-island-path { display: grid; grid-template-columns: repeat(5, 1fr); gap: 9px; }
      .nbp-slot {
        position: relative; min-height: 102px; padding: 24px 9px 10px !important;
        border-radius: 15px !important; text-align: left; overflow: hidden;
      }
      .nbp-slot.empty { border-style: dashed; color: #777c82; }
      .nbp-slot.occupied { border-color: rgba(215,186,100,.4); background: rgba(47,38,14,.32); }
      .nbp-slot.selected { outline: 2px solid #79c5ef; border-color: #79c5ef; }
      .nbp-slot-number {
        position: absolute; top: 7px; right: 8px; color: #7d8288; font-size: 10px;
      }
      .nbp-slot strong, .nbp-slot small, .nbp-slot em { display: block; }
      .nbp-slot strong { color: #eee9df; font-size: 13px; }
      .nbp-slot small { margin-top: 6px; color: #d6b968; font-size: 11px; }
      .nbp-slot em {
        margin-top: 5px; color: #8f9ca6; font-size: 10px; font-style: normal;
        white-space: nowrap; text-overflow: ellipsis; overflow: hidden;
      }
      .nbp-summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px; }
      .nbp-summary-grid > div {
        padding: 16px; border: 1px solid #303237; border-radius: 16px; background: #0d0e10;
      }
      .nbp-summary-grid span, .nbp-summary-grid strong { display: block; }
      .nbp-summary-grid span { color: #8f8b85; font-size: 12px; }
      .nbp-summary-grid strong { margin-top: 7px; color: #dcc16e; font-size: 20px; }
      .nbp-advice {
        margin-top: 12px; padding: 16px; border: 1px solid rgba(105,177,214,.3);
        border-radius: 16px; background: rgba(29,64,83,.18);
      }
      .nbp-advice strong { color: #91c8e5; }
      .nbp-advice p, .nbp-advice ul { margin-bottom: 0; color: #aaa49b; line-height: 1.5; }
      .nbp-privacy { border-color: rgba(163,86,101,.35); }
      .nbp-privacy strong { color: #d1919e; }
      .nbp-privacy button { color: #dda2ad; border-color: rgba(190,105,121,.45); }
      .hidden { display: none !important; }
      @media (max-width: 720px) {
        .nbp-intro, .nbp-details, .nbp-add-grid { grid-template-columns: 1fr; }
        .nbp-details label.wide { grid-column: auto; }
        .nbp-layout-actions { width: 100%; }
        .nbp-layout-actions select { flex: 1 1 100%; }
        .nbp-island-path { grid-template-columns: repeat(5, minmax(82px, 1fr)); overflow-x: auto; padding-bottom: 5px; }
        .nbp-slot { min-width: 82px; }
        .nbp-summary-grid, .nbp-support-grid, .nbp-stored-list { grid-template-columns: repeat(2, 1fr); }
      }
    `;
    document.head.appendChild(style);
  }

  function install() {
    if (document.getElementById(OVERLAY_ID)) return;
    installStyles();

    const launch = document.createElement("button");
    launch.type = "button";
    launch.className = "nbp-launch";
    launch.innerHTML = `
      <span>
        <strong>Base Planner</strong>
        <small>Map your real towers, test moves and compare layouts before changing your WD base.</small>
      </span>
      <span class="nbp-launch-icon" aria-hidden="true">⚔</span>
    `;
    launch.addEventListener("click", open);

    const tools = document.querySelector(".nct-home-tools");
    const planner = document.querySelector(".cp-launch");
    const rates = document.querySelector(".cdr-launch");
    const progress = document.querySelector("#activeSessionTitle")?.closest(".content-panel");
    (tools || planner || rates || progress)?.insertAdjacentElement("afterend", launch);

    const overlay = document.createElement("section");
    overlay.id = OVERLAY_ID;
    overlay.className = "nbp-overlay";
    overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(overlay);
  }

  function open() {
    renderEditor();
    const overlay = document.getElementById(OVERLAY_ID);
    overlay?.classList.add("open");
    overlay?.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    const overlay = document.getElementById(OVERLAY_ID);
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    selectedSlot = null;
  }

  window.NoirBasePlanner = Object.freeze({
    open,
    close,
    install,
    createLayout,
    calculateSummary,
    parseTowerLines,
    importTowerLines,
    parseBaseSnapshot,
    importBaseSnapshot,
    addTower,
    moveTower,
    removeTower,
    getState: () => JSON.parse(JSON.stringify(state)),
    getActiveLayout: () => JSON.parse(JSON.stringify(activeLayout())),
    constants: Object.freeze({
      ISLAND_COUNT,
      SLOTS_PER_ISLAND,
      TOTAL_SLOTS,
      TOWER_TYPES,
      BASE_IDENTIFIER_MAP
    })
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
