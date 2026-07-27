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
    "Farm",
    "Lumber Mill",
    "Perch",
    "Monument",
    "Other"
  ];

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
      .nbp-intro p, .nbp-privacy p, .nbp-bulk p { margin: 0; color: #a39d94; line-height: 1.55; }
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
        .nbp-summary-grid { grid-template-columns: repeat(2, 1fr); }
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
    addTower,
    moveTower,
    removeTower,
    getState: () => JSON.parse(JSON.stringify(state)),
    getActiveLayout: () => JSON.parse(JSON.stringify(activeLayout())),
    constants: Object.freeze({ ISLAND_COUNT, SLOTS_PER_ISLAND, TOTAL_SLOTS, TOWER_TYPES })
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
