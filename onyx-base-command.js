(() => {
  "use strict";

  const OVERLAY_ID = "onyxBaseCommandOverlay";
  const STORAGE_PREFIX = "onyxBaseLayoutV1";
  const ISLAND_COUNT = 8;
  const SLOTS_PER_ISLAND = 5;
  const TOTAL_SLOTS = ISLAND_COUNT * SLOTS_PER_ISLAND;

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

  let activeTab = "intelligence";
  let selectedTower = "";
  let selectedLevel = 1;
  let selectedSlot = null;
  let layout = null;
  let cloudLoadedFor = null;

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
    return name ? `${formatNumber(rawAmount)} ${name}` : `${formatNumber(rawAmount)} · resource type unavailable`;
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

  function descriptionFor(type) {
    return catalogue().towers?.find(item => item?.name === type)?.description || "No verified description is available for this tower.";
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
    const type = towerTypes().includes(String(value.type || "")) ? String(value.type) : "";
    if (!type) return null;
    const level = Math.max(1, Math.min(999, Number.parseInt(value.level, 10) || 1));
    if (!exactRow(type, level)) return null;
    return {
      type,
      level,
      notes: String(value.notes || "").slice(0, 250)
    };
  }

  function normaliseLayout(value) {
    if (!value || typeof value !== "object" || !Array.isArray(value.slots)) return null;
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

  function readLocal() {
    try {
      layout = normaliseLayout(JSON.parse(localStorage.getItem(storageKey()) || "null"));
    } catch (error) {
      layout = null;
    }
  }

  function saveLocal() {
    if (!layout) {
      localStorage.removeItem(storageKey());
      return;
    }
    layout.updatedAt = new Date().toISOString();
    localStorage.setItem(storageKey(), JSON.stringify(layout));
  }

  async function loadCloud() {
    const id = userId();
    if (!id || cloudLoadedFor === id) return;
    const loader = window.ChestDatabase?.loadOnyxBaseLayout;
    if (typeof loader !== "function") return;
    cloudLoadedFor = id;
    try {
      const cloud = normaliseLayout(await loader.call(window.ChestDatabase));
      if (cloud) {
        layout = cloud;
        saveLocal();
        render();
      }
    } catch (error) {
      console.warn("[Onyx Base] The saved cloud layout could not be loaded.", error);
    }
  }

  async function saveCloud(statusElement) {
    if (!layout) return false;
    saveLocal();
    if (statusElement) statusElement.textContent = "Saving…";
    const saver = window.ChestDatabase?.saveOnyxBaseLayout;
    if (typeof saver !== "function") {
      if (statusElement) statusElement.textContent = "Saved on this device; profile sync is unavailable.";
      return false;
    }
    try {
      await saver.call(window.ChestDatabase, clone(layout));
      if (statusElement) statusElement.textContent = "Saved to your Onyx profile.";
      return true;
    } catch (error) {
      if (statusElement) statusElement.textContent = "Saved on this device; profile sync is unavailable.";
      console.warn("[Onyx Base] Profile sync failed.", error);
      return false;
    }
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
    return parts.length ? parts.join(" · ") : "A tower restriction is recorded, but no verified player-facing limit is available.";
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
        <p>Uses verified tower names, descriptions, level data, costs, build times, unlocks and restrictions.</p>
      </section>

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
        <p class="obc-description">${escapeHtml(descriptionFor(selectedTower))}</p>

        ${row ? `
          <div class="obc-stat-grid">
            <article><small>Power</small><strong>${formatNumber(row.power)}</strong></article>
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
          ${next ? `<p class="obc-next-level">Next available level: ${next.level} · ${escapeHtml(formatCost(next.cost))} · ${escapeHtml(formatDuration(next.seconds))}</p>` : `<p class="obc-next-level">No next-level data is available.</p>`}
        ` : `
          <div class="obc-no-evidence">
            <strong>No verified row for level ${escapeHtml(selectedLevel)}</strong>
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
        <strong>Your home-base layout must be added manually.</strong>
        <p>Tower Intelligence does not infer where your towers are placed and does not generate a defensive-power estimate from missing geometry.</p>
      </section>
    `;
  }

  function towerLabel(tower) {
    return tower ? `${tower.type} · L${tower.level}` : "Empty slot";
  }

  function renderBuilderPrompt() {
    return `
      <section class="obc-builder-empty">
        <span data-onyx-icon="layout" aria-hidden="true"></span>
        <p>ADD YOUR BASE LAYOUT</p>
        <h3>Build your base manually</h3>
        <p>Select and save the towers you actually have. Onyx will never fill empty slots with guessed data.</p>
        <label>Base name
          <input id="obcNewLayoutName" maxlength="60" value="My Base" autocomplete="off">
        </label>
        <button id="obcCreateLayout" type="button">Start Base Builder</button>
      </section>
    `;
  }

  function renderTowerEditor() {
    if (selectedSlot === null || !layout) return "";
    const tower = layout.slots[selectedSlot];
    const type = tower?.type || selectedTower || towerTypes()[0] || "";
    const rows = rowsFor(type);
    const levels = rows.map(row => Number(row.level)).filter(Number.isFinite);
    return `
      <section class="obc-panel obc-slot-editor">
        <div class="obc-section-heading">
          <div><p>MANUAL ENTRY</p><h3>Island ${Math.floor(selectedSlot / SLOTS_PER_ISLAND) + 1} · Slot ${(selectedSlot % SLOTS_PER_ISLAND) + 1}</h3></div>
          <button id="obcCancelSlot" type="button">Close</button>
        </div>
        <div class="obc-form-row">
          <label>Tower
            <select id="obcSlotTowerType">
              ${towerTypes().map(name => `<option value="${escapeHtml(name)}" ${name === type ? "selected" : ""}>${escapeHtml(name)}</option>`).join("")}
            </select>
          </label>
          <label>Level
            <select id="obcSlotTowerLevel">
              ${levels.map(level => `<option value="${level}" ${level === (tower?.level || levels[0]) ? "selected" : ""}>Level ${level}</option>`).join("")}
            </select>
          </label>
        </div>
        <label class="obc-notes">Notes
          <input id="obcSlotTowerNotes" maxlength="250" value="${escapeHtml(tower?.notes || "")}" placeholder="Optional manual note">
        </label>
        <div class="obc-editor-actions">
          <button id="obcSaveTower" class="primary" type="button">Save tower</button>
          ${tower ? `<button id="obcClearTower" class="danger" type="button">Clear slot</button>` : ""}
        </div>
      </section>
    `;
  }

  function renderBuilder() {
    if (!layout) return renderBuilderPrompt();
    const populated = layout.slots.filter(Boolean);
    const exactRows = populated.filter(tower => exactRow(tower.type, tower.level)).length;
    return `
      <section class="obc-source-banner manual">
        <strong>Manual player layout</strong>
        <p>This layout contains only towers you selected. It is private to your account when profile sync is available.</p>
      </section>

      <section class="obc-panel obc-layout-summary">
        <label>Base name
          <input id="obcLayoutName" maxlength="60" value="${escapeHtml(layout.name)}">
        </label>
        <div>
          <article><small>Recorded towers</small><strong>${populated.length}</strong></article>
          <article><small>Exact stat matches</small><strong>${exactRows}/${populated.length || 0}</strong></article>
          <article><small>Last changed</small><strong>${escapeHtml(new Date(layout.updatedAt).toLocaleDateString("en-AU"))}</strong></article>
        </div>
        <button id="obcSaveLayout" class="obc-save-layout" type="button">Save layout to profile</button>
        <p id="obcSaveStatus" class="obc-save-status" aria-live="polite"></p>
      </section>

      ${renderTowerEditor()}

      <section class="obc-islands">
        ${Array.from({ length: ISLAND_COUNT }, (_, islandIndex) => {
          const start = islandIndex * SLOTS_PER_ISLAND;
          const islandSlots = layout.slots.slice(start, start + SLOTS_PER_ISLAND);
          return `
            <article class="obc-island">
              <header><strong>Island ${islandIndex + 1}</strong><small>${islandSlots.filter(Boolean).length}/5 recorded</small></header>
              <div>
                ${islandSlots.map((tower, slotIndex) => {
                  const absolute = start + slotIndex;
                  return `
                    <button type="button" data-obc-slot="${absolute}" class="${tower ? "occupied" : "empty"} ${selectedSlot === absolute ? "selected" : ""}">
                      <span>${slotIndex + 1}</span>
                      <strong>${escapeHtml(tower ? tower.type : "Empty")}</strong>
                      <small>${tower ? `Level ${tower.level}` : "Tap to add"}</small>
                    </button>
                  `;
                }).join("")}
              </div>
            </article>
          `;
        }).join("")}
      </section>

      <section class="obc-honesty-note">
        <strong>No fake layout score or DP forecast</strong>
        <p>Onyx can show exact verified stats for the towers you entered. It will not claim a best placement or calculate absolute defensive power without verified geometry and battle mechanics.</p>
      </section>

      <section class="obc-delete-panel">
        <button id="obcDeleteLayout" type="button">Delete this manual layout</button>
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

  function render() {
    const overlay = ensureOverlay();
    overlay.innerHTML = `
      <div class="obc-shell" role="dialog" aria-modal="true" aria-label="Base and Towers">
        <header class="obc-header">
          <div><p>ONYX COMMAND</p><h2>Base &amp; Towers</h2></div>
          <button id="obcClose" type="button" aria-label="Close">×</button>
        </header>
        <nav class="obc-tabs" aria-label="Base command sections">
          <button type="button" data-obc-tab="intelligence" class="${activeTab === "intelligence" ? "active" : ""}">Tower Intelligence</button>
          <button type="button" data-obc-tab="builder" class="${activeTab === "builder" ? "active" : ""}">Manual Base Builder</button>
        </nav>
        <main class="obc-body">
          ${activeTab === "intelligence" ? renderIntelligence() : renderBuilder()}
        </main>
      </div>
    `;
    window.OnyxCommand?.hydrateIcons?.(overlay);
    bindEvents(overlay);
  }

  function close() {
    const overlay = document.getElementById(OVERLAY_ID);
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("onyx-modal-open");
    selectedSlot = null;
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
        render();
      });
    });

    overlay.querySelector("#obcTowerType")?.addEventListener("change", event => {
      selectedTower = event.target.value;
      const levels = rowsFor(selectedTower).map(row => Number(row.level)).filter(Number.isFinite);
      selectedLevel = levels.length ? Math.min(...levels) : 1;
      render();
    });
    overlay.querySelector("#obcTowerLevel")?.addEventListener("change", event => {
      selectedLevel = Number.parseInt(event.target.value, 10) || 1;
      render();
    });

    overlay.querySelector("#obcCreateLayout")?.addEventListener("click", () => {
      const name = overlay.querySelector("#obcNewLayoutName")?.value || "My Base";
      layout = createLayout(name);
      saveLocal();
      selectedSlot = 0;
      render();
    });

    overlay.querySelector("#obcLayoutName")?.addEventListener("input", event => {
      layout.name = String(event.target.value || "").slice(0, 60);
      saveLocal();
    });

    overlay.querySelectorAll("[data-obc-slot]").forEach(button => {
      button.addEventListener("click", () => {
        selectedSlot = Number(button.dataset.obcSlot);
        render();
        document.querySelector(".obc-slot-editor")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });

    overlay.querySelector("#obcCancelSlot")?.addEventListener("click", () => {
      selectedSlot = null;
      render();
    });

    overlay.querySelector("#obcSlotTowerType")?.addEventListener("change", event => {
      const levelSelect = overlay.querySelector("#obcSlotTowerLevel");
      const levels = rowsFor(event.target.value).map(row => Number(row.level)).filter(Number.isFinite);
      if (levelSelect && levels.length) {
        levelSelect.innerHTML = levels
          .map(level => `<option value="${level}">Level ${level}</option>`)
          .join("");
      }
    });

    overlay.querySelector("#obcSaveTower")?.addEventListener("click", () => {
      if (selectedSlot === null || !layout) return;
      const type = overlay.querySelector("#obcSlotTowerType")?.value || "";
      const availableLevels = rowsFor(type).map(row => Number(row.level)).filter(Number.isFinite);
      const requestedLevel = Number.parseInt(overlay.querySelector("#obcSlotTowerLevel")?.value, 10);
      const level = availableLevels.includes(requestedLevel) ? requestedLevel : availableLevels[0];
      const notes = String(overlay.querySelector("#obcSlotTowerNotes")?.value || "").slice(0, 250);
      layout.slots[selectedSlot] = normaliseTower({ type, level, notes });
      selectedTower = type;
      selectedLevel = level;
      saveLocal();
      selectedSlot = null;
      render();
    });

    overlay.querySelector("#obcClearTower")?.addEventListener("click", () => {
      if (selectedSlot === null || !layout) return;
      layout.slots[selectedSlot] = null;
      saveLocal();
      selectedSlot = null;
      render();
    });

    overlay.querySelector("#obcSaveLayout")?.addEventListener("click", () => {
      saveCloud(overlay.querySelector("#obcSaveStatus"));
    });

    overlay.querySelector("#obcDeleteLayout")?.addEventListener("click", async () => {
      if (!window.confirm("Delete this saved manual base layout?")) return;
      layout = null;
      selectedSlot = null;
      saveLocal();
      try {
        const saver = window.ChestDatabase?.saveOnyxBaseLayout;
        if (typeof saver === "function") {
          await saver.call(window.ChestDatabase, null);
        }
      } catch (error) {
        console.warn("[Onyx Base] The cloud copy could not be cleared.", error);
      }
      render();
    });
  }

  function open(tab = "intelligence") {
    activeTab = tab === "builder" ? "builder" : "intelligence";
    readLocal();
    render();
    const overlay = ensureOverlay();
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("onyx-modal-open");
    loadCloud();
  }

  window.OnyxBaseCommand = Object.freeze({
    open,
    close,
    createLayout,
    getLayout: () => clone(layout),
    getTowerRecord: (type, level) => clone(exactRow(type, level))
  });
})();
