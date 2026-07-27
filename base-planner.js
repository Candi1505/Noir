(() => {
  "use strict";

  const STORAGE_KEY = "noirBasePlannerV1";
  const OVERLAY_ID = "noirBasePlannerOverlay";
  const ISLAND_COUNT = 8;
  const SLOTS_PER_ISLAND = 5;
  const TOTAL_SLOTS = ISLAND_COUNT * SLOTS_PER_ISLAND;

  const CATALOG = window.NoirBaseCatalog || {};
  const FALLBACK_TOWER_TYPES = [
    "Archer Tower", "Cannon Tower", "Ballista", "Trebuchet", "Lightning Tower",
    "Storm Tower", "Red Mage Tower", "Blue Mage Tower", "Fire Turret", "Ice Turret",
    "Dark Flak Tower", "Fire Flak Tower", "Ice Flak Tower", "Earth Flak Tower",
    "Electro-Flak Tower", "Crystal Howitzer", "Soul Drain Tower", "Drakul Pylon",
    "Cosmic Orrery", "Charged Volt Tower", "Red Archmage Tower", "Blue Archmage Tower",
    "Oculus Tower", "Nexus Tower", "Nullspire Tower", "Other"
  ];
  const TOWER_TYPES = Array.from(new Set([
    ...(Array.isArray(CATALOG.towers) ? CATALOG.towers.map(tower => tower.name) : []),
    ...FALLBACK_TOWER_TYPES
  ])).filter(Boolean).sort((left, right) => left.localeCompare(right));

  const MODERN = new Set([
    "Dark Flak Tower", "Fire Flak Tower", "Ice Flak Tower", "Earth Flak Tower",
    "Electro-Flak Tower", "Crystal Howitzer", "Soul Drain Tower", "Drakul Pylon",
    "Cosmic Orrery", "Charged Volt Tower", "Red Archmage Tower", "Blue Archmage Tower",
    "Oculus Tower", "Nexus Tower", "Nullspire Tower"
  ]);
  const MAGES = new Set([
    "Red Mage Tower", "Blue Mage Tower", "Red Archmage Tower", "Blue Archmage Tower"
  ]);
  const FLACKS = new Set([
    "Dark Flak Tower", "Fire Flak Tower", "Ice Flak Tower", "Earth Flak Tower",
    "Electro-Flak Tower"
  ]);
  const CONFLICTS = [
    ["Nexus Tower", "Dark Flak Tower"],
    ["Dark Flak Tower", "Earth Flak Tower"],
    ["Cosmic Orrery", "Earth Flak Tower"],
    ["Cosmic Orrery", "Storm Tower"],
    ["Nullspire Tower", "Red Mage Tower"],
    ["Nullspire Tower", "Blue Mage Tower"],
    ["Nullspire Tower", "Red Archmage Tower"],
    ["Nullspire Tower", "Blue Archmage Tower"],
    ["Drakul Pylon", "Soul Drain Tower"]
  ];
  const GEAR_SLOTS = [
    ["head", "Head"],
    ["chest", "Chest"],
    ["gloves", "Gloves"],
    ["pants", "Pants"],
    ["boots", "Boots"],
    ["weapons", "Weapon"],
    ["shield", "Shield"],
    ["rings", "Rings"]
  ];
  const PERCH_RIDER_EXCEPTIONS = new Set(["Freeda", "Vivian"]);

  let state = loadState();
  let selectedSlot = null;
  let history = [];
  let future = [];

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function blankSlots() {
    return Array.from({ length: TOTAL_SLOTS }, () => null);
  }

  function blankPerches() {
    return ["Riverwatch Perch", "Seagazer Perch", "Stonespear Perch"].map(name => ({
      name,
      level: 0,
      dragonName: "",
      dragonClass: "",
      dragonTier: "",
      dragonLevel: 0,
      riderName: "",
      riderLevel: 0,
      riderSkills: [],
      riderGear: Object.fromEntries(GEAR_SLOTS.map(([slot]) => [slot, { name: "", rarity: "", level: 0 }]))
    }));
  }

  function normaliseTower(tower) {
    if (!tower || typeof tower !== "object") return null;
    return {
      id: String(tower.id || `tower-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      type: String(tower.type || "Other"),
      customName: String(tower.customName || ""),
      level: Math.max(0, Number.parseInt(tower.level, 10) || 0),
      runes: String(tower.runes || tower.rune || ""),
      glyph: String(tower.glyph || ""),
      relic: String(tower.relic || ""),
      notes: String(tower.notes || "")
    };
  }

  function normalisePerch(perch, index) {
    const defaults = blankPerches()[index];
    const safe = perch && typeof perch === "object" ? perch : {};
    return {
      ...defaults,
      ...safe,
      name: defaults.name,
      level: Math.max(0, Number.parseInt(safe.level, 10) || 0),
      dragonLevel: Math.max(0, Number.parseInt(safe.dragonLevel, 10) || 0),
      riderLevel: Math.max(0, Number.parseInt(safe.riderLevel, 10) || 0),
      dragonName: String(safe.dragonName || ""),
      dragonClass: String(safe.dragonClass || ""),
      dragonTier: String(safe.dragonTier || ""),
      riderName: String(safe.riderName || ""),
      riderSkills: Array.isArray(safe.riderSkills)
        ? safe.riderSkills.map(String).filter(Boolean)
        : String(safe.riderSkills || "").split(/[,|]/).map(value => value.trim()).filter(Boolean),
      riderGear: safe.riderGear && typeof safe.riderGear === "object"
        ? Object.fromEntries(GEAR_SLOTS.map(([slot]) => {
            const gear = safe.riderGear[slot];
            return [slot, gear && typeof gear === "object"
              ? { name: String(gear.name || ""), rarity: String(gear.rarity || ""), level: Math.max(0, Number.parseInt(gear.level, 10) || 0) }
              : { name: String(gear || ""), rarity: "", level: 0 }];
          }))
        : Object.fromEntries(GEAR_SLOTS.map(([slot], index) => [
            slot,
            { name: index === 0 && typeof safe.riderGear === "string" ? safe.riderGear : "", rarity: "", level: 0 }
          ]))
    };
  }

  function createLayout(name = "My Base") {
    const slots = blankSlots();
    return {
      id: `layout-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name,
      currentDp: "",
      slots,
      baselineSlots: clone(slots),
      perches: blankPerches(),
      baselinePerches: blankPerches(),
      referencePhotos: [],
      updatedAt: new Date().toISOString()
    };
  }

  function normaliseLayout(layout) {
    const safe = layout && typeof layout === "object" ? layout : {};
    const slots = Array.from({ length: TOTAL_SLOTS }, (_, index) =>
      normaliseTower(Array.isArray(safe.slots) ? safe.slots[index] : null)
    );
    const baselineSource = Array.isArray(safe.baselineSlots) ? safe.baselineSlots : slots;
    const perches = Array.from({ length: 3 }, (_, index) =>
      normalisePerch(Array.isArray(safe.perches) ? safe.perches[index] : null, index)
    );
    const baselinePerches = Array.from({ length: 3 }, (_, index) =>
      normalisePerch(Array.isArray(safe.baselinePerches) ? safe.baselinePerches[index] : perches[index], index)
    );
    return {
      id: String(safe.id || `layout-${Date.now()}`),
      name: String(safe.name || "My Base"),
      currentDp: String(safe.currentDp || ""),
      slots,
      baselineSlots: Array.from({ length: TOTAL_SLOTS }, (_, index) =>
        normaliseTower(baselineSource[index])
      ),
      perches,
      baselinePerches,
      referencePhotos: Array.isArray(safe.referencePhotos)
        ? safe.referencePhotos.filter(value => typeof value === "string" && value.startsWith("data:image/")).slice(0, 4)
        : [],
      updatedAt: String(safe.updatedAt || new Date().toISOString())
    };
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      if (saved?.layouts?.length) {
        const layouts = saved.layouts.map(normaliseLayout);
        return {
          layouts,
          activeId: layouts.some(item => item.id === saved.activeId) ? saved.activeId : layouts[0].id
        };
      }
    } catch (error) {
      console.warn("Noir could not read the saved base.", error);
    }
    const first = createLayout();
    return { layouts: [first], activeId: first.id };
  }

  function activeLayout() {
    return state.layouts.find(item => item.id === state.activeId) || state.layouts[0];
  }

  function saveState() {
    activeLayout().updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (error) {
      console.warn("Noir could not save the base.", error);
      return false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function towerName(tower) {
    if (!tower) return "Empty slot";
    return tower.type === "Other" && tower.customName ? tower.customName : tower.type;
  }

  function parseDp(value) {
    const match = String(value || "").trim().match(/^([\d,.]+)\s*([KMBTQ]?)$/i);
    if (!match) return 0;
    const number = Number(match[1].replaceAll(",", ""));
    const multiplier = { K: 1e3, M: 1e6, B: 1e9, T: 1e12, Q: 1e15 }[match[2].toUpperCase()] || 1;
    return Number.isFinite(number) ? number * multiplier : 0;
  }

  function formatDp(value) {
    if (!Number.isFinite(value) || value <= 0) return "Add current DP";
    const units = [["Q", 1e15], ["T", 1e12], ["B", 1e9], ["M", 1e6], ["K", 1e3]];
    const unit = units.find(([, amount]) => value >= amount);
    if (!unit) return Math.round(value).toLocaleString();
    return `${(value / unit[1]).toFixed(value / unit[1] >= 100 ? 0 : 1).replace(/\.0$/, "")}${unit[0]}`;
  }

  function towerPower(tower) {
    if (!tower) return 0;
    const level = Math.max(1, tower.level || 1);
    const officialLevels = CATALOG.towerLevels?.[tower.type];
    if (Array.isArray(officialLevels) && officialLevels.length) {
      const exact = officialLevels.find(item => Number(item.level) === level);
      if (exact?.power > 0) return exact.power;
      const closest = officialLevels.reduce((best, item) =>
        Math.abs(Number(item.level) - level) < Math.abs(Number(best.level) - level) ? item : best
      );
      if (closest?.power > 0) return closest.power;
    }
    const typeWeight = MODERN.has(tower.type) ? 1.18 : MAGES.has(tower.type) ? 1.05 : 1;
    return Math.pow(level, 2.28) * typeWeight;
  }

  function catalogueEffect(item) {
    const effects = Array.isArray(item?.effects) ? item.effects : [];
    return effects.slice(0, 2).map(effect => {
      const amount = Number(effect.max || effect.min || 0);
      const value = effect.unit === "%" && amount
        ? `${(amount * 100).toFixed(amount * 100 >= 10 ? 0 : 1)}%`
        : amount || "";
      return `${effect.text || ""}${value ? ` ${value}` : ""}`.trim();
    }).filter(Boolean).join(" · ");
  }

  function renderCatalogueLists() {
    const items = Array.isArray(CATALOG.monumentItems) ? CATALOG.monumentItems : [];
    const list = kind => `
      <datalist id="nbp${kind}List">
        ${items.filter(item => item.kind === kind).map(item => `
          <option value="${escapeHtml(item.name)}" label="${escapeHtml(`${item.rarity}${catalogueEffect(item) ? ` · ${catalogueEffect(item)}` : ""}`)}"></option>
        `).join("")}
      </datalist>
    `;
    const riders = Array.isArray(CATALOG.riders)
      ? CATALOG.riders.filter(rider => rider.defensive || PERCH_RIDER_EXCEPTIONS.has(rider.name))
      : [];
    const skills = Array.isArray(CATALOG.riderSkills) ? CATALOG.riderSkills : [];
    const gear = Array.isArray(CATALOG.riderGear) ? CATALOG.riderGear : [];
    return `
      ${list("Rune")}
      ${list("Glyph")}
      ${list("Relic")}
      <datalist id="nbpRiderList">
        ${riders.map(rider => `<option value="${escapeHtml(rider.name)}" label="Perch rider"></option>`).join("")}
      </datalist>
      <datalist id="nbpRiderSkillList">
        ${skills.map(skill => `<option value="${escapeHtml(skill.name)}"></option>`).join("")}
      </datalist>
      ${GEAR_SLOTS.map(([slot, label]) => `
        <datalist id="nbpGear${slot}List">
          ${gear.filter(item => item.slot === slot).map(item => `
            <option value="${escapeHtml(item.name)}" label="${escapeHtml(`${item.element ? `${item.element} · ` : ""}${label}`)}"></option>
          `).join("")}
        </datalist>
      `).join("")}
    `;
  }

  function evaluate(slots, perches = []) {
    let raw = slots.reduce((sum, tower) => sum + towerPower(tower), 0);
    let effectiveness = 50;
    let bonus = 0;
    let penalty = 0;
    const findings = [];

    for (let island = 0; island < ISLAND_COUNT; island += 1) {
      const towers = slots.slice(island * SLOTS_PER_ISLAND, (island + 1) * SLOTS_PER_ISLAND).filter(Boolean);
      if (!towers.length) continue;
      const types = towers.map(tower => tower.type);
      const levels = towers.map(tower => tower.level).filter(Boolean);
      const label = `Island ${island + 1}`;

      CONFLICTS.forEach(([left, right]) => {
        if (types.includes(left) && types.includes(right)) {
          penalty += 8;
          findings.push({ severity: "error", title: `${left} conflicts with ${right}`, detail: `${label} contains an illegal or ineffective tower pairing.` });
        }
      });

      if (types.filter(type => type === "Nexus Tower").length > 1) {
        penalty += 10;
        findings.push({ severity: "error", title: "Too many Nexus Towers", detail: `${label} may contain only one Nexus Tower.` });
      }
      if (types.filter(type => type === "Soul Drain Tower").length > 1) {
        penalty += 10;
        findings.push({ severity: "error", title: "Too many Soul Drain Towers", detail: `${label} may contain only one Soul Drain Tower.` });
      }
      if (towers.length >= 4 && !types.some(type => MAGES.has(type))) {
        penalty += 4;
        findings.push({ severity: "warning", title: "No mage protection", detail: `${label} has several towers but no recorded Mage or Archmage protection.` });
      }
      if (types.includes("Electro-Flak Tower")) {
        const supportedFlaks = types.filter(type => FLACKS.has(type) && type !== "Electro-Flak Tower").length;
        if (supportedFlaks) {
          bonus += Math.min(6, supportedFlaks * 2);
          findings.push({ severity: "good", title: "Electro-Flak coverage", detail: `${label} places ${supportedFlaks} other flak tower${supportedFlaks === 1 ? "" : "s"} with Electro-Flak support.` });
        }
      }
      if (levels.length > 1 && Math.max(...levels) - Math.min(...levels) >= 35) {
        penalty += 3;
        findings.push({ severity: "warning", title: "Large tower-level gap", detail: `${label} spans ${Math.max(...levels) - Math.min(...levels)} levels.` });
      }
      if (towers.length === 5 && types.some(type => MAGES.has(type)) && towers.filter(tower => MODERN.has(tower.type)).length >= 2) {
        bonus += 3;
      }
    }

    const crystalCount = slots.filter(tower => tower?.type === "Crystal Howitzer").length;
    if (crystalCount > 2) {
      penalty += 12;
      findings.push({ severity: "error", title: "Crystal Howitzer limit exceeded", detail: "A base may contain no more than two Crystal Howitzers." });
    }

    const activePerches = perches.filter(perch => perch?.level && perch?.dragonName).length;
    bonus += activePerches * 2;
    effectiveness = Math.max(0, Math.min(100, effectiveness + bonus - penalty));
    return { raw, effectiveness, findings, bonus, penalty };
  }

  function comparison(layout = activeLayout()) {
    const current = evaluate(layout.baselineSlots, layout.baselinePerches);
    const proposed = evaluate(layout.slots, layout.perches);
    const currentDp = parseDp(layout.currentDp);
    const towerRatio = current.raw > 0 ? proposed.raw / current.raw : 1;
    const effectivenessChange = proposed.effectiveness - current.effectiveness;
    const placementRatio = Math.max(0.75, Math.min(1.25, 1 + effectivenessChange * 0.005));
    const ratio = towerRatio * placementRatio;
    const estimate = currentDp ? currentDp * ratio : 0;
    const dpChange = estimate - currentDp;
    return { current, proposed, currentDp, estimate, dpChange, ratio, towerRatio, placementRatio };
  }

  function pushHistory() {
    history.push({ slots: clone(activeLayout().slots), perches: clone(activeLayout().perches) });
    if (history.length > 40) history.shift();
    future = [];
  }

  function renderMeters(layout) {
    const result = comparison(layout);
    const dpDirection = result.dpChange > 0 ? "up" : result.dpChange < 0 ? "down" : "same";
    const effectivenessChange = result.proposed.effectiveness - result.current.effectiveness;
    const percentage = result.currentDp ? (result.dpChange / result.currentDp) * 100 : 0;
    return `
      <section class="nbp-panel nbp-comparison">
        <div class="nbp-section-heading">
          <div><p class="nbp-kicker">LIVE COMPARISON</p><h3>Current vs proposed</h3></div>
          <span class="nbp-estimate-label">Estimated from confirmed entries</span>
        </div>
        <div class="nbp-meter-grid">
          <article>
            <span>Current DP</span>
            <strong>${escapeHtml(formatDp(result.currentDp))}</strong>
            <div class="nbp-meter"><i style="width:50%"></i></div>
          </article>
          <article class="${dpDirection}">
            <span>Projected defensive strength</span>
            <strong>${escapeHtml(formatDp(result.estimate))}</strong>
            <b>${result.currentDp ? `${result.dpChange >= 0 ? "+" : ""}${formatDp(Math.abs(result.dpChange))} (${percentage >= 0 ? "+" : ""}${percentage.toFixed(1)}%)` : "Enter current DP to calibrate"}</b>
            <div class="nbp-meter"><i style="width:${Math.max(4, Math.min(100, 50 + percentage * 2))}%"></i></div>
          </article>
          <article class="${effectivenessChange > 0 ? "up" : effectivenessChange < 0 ? "down" : "same"}">
            <span>Defensive effectiveness</span>
            <strong>${result.proposed.effectiveness}/100</strong>
            <b>${effectivenessChange >= 0 ? "+" : ""}${effectivenessChange} from current</b>
            <div class="nbp-meter"><i style="width:${result.proposed.effectiveness}%"></i></div>
          </article>
        </div>
        <p class="nbp-trust-copy">Current DP is the number shown in game. Projected defensive strength is a planning estimate that combines recorded tower power with placement, conflicts, coverage and synergy; rearranging towers does not change the game's displayed DP by itself.</p>
      </section>
    `;
  }

  function prepareReferencePhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const maximumSide = 1600;
          const scale = Math.min(1, maximumSide / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext("2d");
          if (!context) {
            resolve(String(reader.result));
            return;
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.82));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function renderPhotos(layout) {
    return `
      <section class="nbp-panel">
        <p class="nbp-kicker">PHOTO REFERENCE</p>
        <h3>Your real WD base</h3>
        <p class="nbp-muted">Keep screenshots here as a visual reference while you recreate each island below.</p>
        <label class="nbp-photo-button">
          Add base photos
          <input id="nbpPhotoInput" type="file" accept="image/*" multiple>
        </label>
        <div class="nbp-photo-grid">
          ${layout.referencePhotos.map((photo, index) => `
            <figure>
              <img src="${photo}" alt="Base reference ${index + 1}">
              <button type="button" data-remove-photo="${index}">Remove</button>
            </figure>
          `).join("") || `<p class="nbp-empty-copy">No reference photos added yet.</p>`}
        </div>
      </section>
    `;
  }

  function renderPerches(layout) {
    return `
      <section class="nbp-panel">
        <p class="nbp-kicker">BASE SUPPORT</p>
        <h3>Perches, dragons and riders</h3>
        <p class="nbp-muted">Enter the real assignments so Noir can include their island coverage. Riders, skills and every gear slot use the game catalogues.</p>
        <div class="nbp-perch-grid">
          ${layout.perches.map((perch, index) => `
            <fieldset class="nbp-perch-card">
              <legend>${escapeHtml(perch.name)}</legend>
              <label>Perch level<input data-perch="${index}" data-field="level" type="number" min="0" value="${perch.level || ""}" placeholder="Level"></label>
              <label>Dragon<input data-catalog-kind="dragon" data-perch="${index}" data-field="dragonName" value="${escapeHtml(perch.dragonName)}" placeholder="Tap to search dragons" autocomplete="off"></label>
              <div class="nbp-two">
                <label>Class<select data-perch="${index}" data-field="dragonClass">
                  <option value="">Choose…</option>
                  ${["Hunter", "Sorcerer", "Warrior", "Invoker"].map(value => `<option ${perch.dragonClass === value ? "selected" : ""}>${value}</option>`).join("")}
                </select></label>
                <label>Dragon level<input data-perch="${index}" data-field="dragonLevel" type="number" min="0" value="${perch.dragonLevel || ""}"></label>
              </div>
              <label>Tier / rarity<input data-perch="${index}" data-field="dragonTier" value="${escapeHtml(perch.dragonTier)}" placeholder="e.g. Mythic · Obsidian"></label>
              <label>Perch rider<input data-catalog-kind="rider" data-perch="${index}" data-field="riderName" value="${escapeHtml(perch.riderName)}" placeholder="Tap to search perch riders" autocomplete="off"></label>
              <label>Rider level<input data-perch="${index}" data-field="riderLevel" type="number" min="0" value="${perch.riderLevel || ""}"></label>
              <details class="nbp-perch-details">
                <summary>Rider skills ${perch.riderSkills.length ? `(${perch.riderSkills.length})` : ""}</summary>
                <div class="nbp-add-row">
                  <input data-catalog-kind="skill" data-skill-search="${index}" placeholder="Tap to search ${Array.isArray(CATALOG.riderSkills) ? CATALOG.riderSkills.length : 100} skills" autocomplete="off">
                  <button type="button" data-add-skill="${index}">Add</button>
                </div>
                <div class="nbp-chip-list">
                  ${perch.riderSkills.map((skill, skillIndex) => `
                    <button type="button" data-remove-skill="${index}:${skillIndex}">${escapeHtml(skill)} <span>×</span></button>
                  `).join("") || `<small>No skills selected.</small>`}
                </div>
              </details>
              <details class="nbp-perch-details">
                <summary>Rider gear ${Object.values(perch.riderGear).filter(gear => gear?.name).length ? `(${Object.values(perch.riderGear).filter(gear => gear?.name).length}/8)` : ""}</summary>
                <div class="nbp-gear-grid">
                  ${GEAR_SLOTS.map(([slot, label]) => `
                    <div class="nbp-gear-piece">
                      <label>${label}<input data-catalog-kind="gear:${slot}" data-gear="${index}" data-gear-slot="${slot}" data-gear-field="name" value="${escapeHtml(perch.riderGear[slot]?.name || "")}" placeholder="Tap to search ${label.toLowerCase()}" autocomplete="off"></label>
                      <div class="nbp-two">
                        <label>Rarity<select data-gear="${index}" data-gear-slot="${slot}" data-gear-field="rarity">
                          <option value="">Choose…</option>
                          ${["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythic", "Exotic", "Ascendant"].map(rarity => `<option ${perch.riderGear[slot]?.rarity === rarity ? "selected" : ""}>${rarity}</option>`).join("")}
                        </select></label>
                        <label>Level<input type="number" min="0" data-gear="${index}" data-gear-slot="${slot}" data-gear-field="level" value="${perch.riderGear[slot]?.level || ""}"></label>
                      </div>
                    </div>
                  `).join("")}
                </div>
              </details>
            </fieldset>
          `).join("")}
        </div>
      </section>
    `;
  }

  function renderTowerForm(layout) {
    const tower = selectedSlot === null ? null : layout.slots[selectedSlot];
    const island = selectedSlot === null ? 0 : Math.floor(selectedSlot / SLOTS_PER_ISLAND) + 1;
    const position = selectedSlot === null ? 0 : selectedSlot % SLOTS_PER_ISLAND + 1;
    return `
      <section class="nbp-panel ${selectedSlot === null ? "hidden" : ""}" id="nbpTowerEditor">
        <div class="nbp-section-heading">
          <div><p class="nbp-kicker">SELECTED SLOT</p><h3>Island ${island} · position ${position}</h3></div>
          <button type="button" id="nbpCloseEditor">Done</button>
        </div>
        <div class="nbp-form-grid">
          <label>Tower<select id="nbpTowerType">
            <option value="">Empty slot</option>
            ${TOWER_TYPES.map(type => `<option value="${escapeHtml(type)}" ${tower?.type === type ? "selected" : ""}>${escapeHtml(type)}</option>`).join("")}
          </select></label>
          <label>Level<input id="nbpTowerLevel" type="number" min="0" value="${tower?.level || ""}" placeholder="Tower level"></label>
          <label>Custom name<input id="nbpTowerCustom" value="${escapeHtml(tower?.customName || "")}" placeholder="Only for Other"></label>
          <label>Rune<input data-catalog-kind="rune" id="nbpTowerRunes" value="${escapeHtml(tower?.runes || "")}" placeholder="Tap to search 281 runes" autocomplete="off"></label>
          <label>Glyph<input data-catalog-kind="glyph" id="nbpTowerGlyph" value="${escapeHtml(tower?.glyph || "")}" placeholder="Tap to search 287 glyphs" autocomplete="off"></label>
          <label>Relic<input data-catalog-kind="relic" id="nbpTowerRelic" value="${escapeHtml(tower?.relic || "")}" placeholder="Tap to search 23 relics" autocomplete="off"></label>
        </div>
        <div class="nbp-editor-actions">
          <button type="button" class="nbp-primary" id="nbpSaveTower">Save tower</button>
          <button type="button" id="nbpSaveAndNext">Save & next slot</button>
          <button type="button" class="nbp-danger" id="nbpRemoveTower">Clear slot</button>
        </div>
      </section>
    `;
  }

  function renderIslands(layout) {
    return `
      <section class="nbp-panel">
        <div class="nbp-section-heading">
          <div><p class="nbp-kicker">TRY CHANGES</p><h3>Interactive island planner</h3></div>
          <div class="nbp-toolbar">
            <button id="nbpUndo" type="button" ${history.length ? "" : "disabled"}>Undo</button>
            <button id="nbpRedo" type="button" ${future.length ? "" : "disabled"}>Redo</button>
            <button id="nbpResetProposal" type="button">Restore current</button>
          </div>
        </div>
        <p class="nbp-muted">Tap one tower and then another slot to move or swap them. Tap the selected tower again to edit its details.</p>
        <div class="nbp-islands">
          ${Array.from({ length: ISLAND_COUNT }, (_, island) => {
            const start = island * SLOTS_PER_ISLAND;
            return `
              <article class="nbp-island">
                <header><strong>Island ${island + 1}</strong><span>${layout.slots.slice(start, start + SLOTS_PER_ISLAND).filter(Boolean).length}/5 towers</span></header>
                <div class="nbp-island-slots">
                  ${Array.from({ length: SLOTS_PER_ISLAND }, (_, offset) => {
                    const index = start + offset;
                    const tower = layout.slots[index];
                    return `
                      <button type="button" class="nbp-slot ${tower ? "occupied" : "empty"} ${selectedSlot === index ? "selected" : ""}" data-slot="${index}">
                        <span>${offset + 1}</span>
                        <strong>${escapeHtml(towerName(tower))}</strong>
                        <small>${tower?.level ? `Level ${tower.level}` : tower ? "Add level" : "Tap to add"}</small>
                      </button>
                    `;
                  }).join("")}
                </div>
              </article>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function renderAdvice(layout) {
    const result = comparison(layout);
    const changed = JSON.stringify(layout.slots) !== JSON.stringify(layout.baselineSlots) ||
      JSON.stringify(layout.perches) !== JSON.stringify(layout.baselinePerches);
    const findings = result.proposed.findings;
    return `
      <section class="nbp-panel">
        <div class="nbp-section-heading">
          <div><p class="nbp-kicker">NOIR ADVISER</p><h3>${findings.length ? "What this layout needs" : "No recorded conflicts"}</h3></div>
          <button type="button" class="nbp-primary" id="nbpMakeCurrent" ${changed ? "" : "disabled"}>Save proposal as current</button>
        </div>
        <div class="nbp-findings">
          ${findings.slice(0, 12).map(item => `
            <article class="nbp-finding ${item.severity}">
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.detail)}</p>
            </article>
          `).join("") || `<p class="nbp-empty-copy">Add tower levels, perches and equipment for a more complete review.</p>`}
        </div>
      </section>
    `;
  }

  function catalogueChoices(kind) {
    if (kind === "dragon") return Array.isArray(CATALOG.dragons) ? CATALOG.dragons : [];
    if (kind === "rider") return Array.isArray(CATALOG.riders)
      ? CATALOG.riders.filter(rider => rider.defensive || PERCH_RIDER_EXCEPTIONS.has(rider.name))
      : [];
    if (kind === "skill") return Array.isArray(CATALOG.riderSkills) ? CATALOG.riderSkills : [];
    if (["rune", "glyph", "relic"].includes(kind)) {
      const expected = kind[0].toUpperCase() + kind.slice(1);
      return (Array.isArray(CATALOG.monumentItems) ? CATALOG.monumentItems : [])
        .filter(item => item.kind === expected);
    }
    if (kind.startsWith("gear:")) {
      const slot = kind.split(":")[1];
      return (Array.isArray(CATALOG.riderGear) ? CATALOG.riderGear : [])
        .filter(item => item.slot === slot);
    }
    return [];
  }

  function choiceDescription(kind, item) {
    if (kind === "dragon") {
      return [item.dragonClass, item.element, item.type].filter(Boolean).join(" · ");
    }
    if (kind === "rider") return "Perch rider";
    if (kind === "skill") return "Rider skill";
    if (["rune", "glyph", "relic"].includes(kind)) {
      return [item.rarity, catalogueEffect(item)].filter(Boolean).join(" · ");
    }
    if (kind.startsWith("gear:")) {
      return [item.element, item.slotName].filter(Boolean).join(" · ");
    }
    return "";
  }

  function bindCatalogueSearch(overlay, layout) {
    overlay.querySelectorAll("[data-catalog-kind]").forEach(input => {
      const kind = input.dataset.catalogKind;
      const choices = catalogueChoices(kind);
      if (!choices.length) return;
      const results = document.createElement("div");
      results.className = "nbp-suggestions";
      results.hidden = true;
      input.insertAdjacentElement("afterend", results);

      const show = () => {
        const query = input.value.trim().toLowerCase();
        const matches = choices
          .filter(item => !query || item.name.toLowerCase().includes(query))
          .slice(0, 30);
        results.innerHTML = matches.length
          ? matches.map((item, index) => `
              <button type="button" data-choice="${index}">
                <strong>${escapeHtml(item.name)}</strong>
                <small>${escapeHtml(choiceDescription(kind, item))}</small>
              </button>
            `).join("")
          : `<p>No matching names found.</p>`;
        results.hidden = false;
        results.querySelectorAll("[data-choice]").forEach(button => {
          let chosen = false;
          const choose = event => {
            event?.preventDefault();
            if (chosen) return;
            chosen = true;
            const item = matches[Number(button.dataset.choice)];
            if (!item) return;
            input.value = item.name;
            results.hidden = true;
            if (kind === "dragon") {
              const perchIndex = Number(input.dataset.perch);
              pushHistory();
              layout.perches[perchIndex].dragonName = item.name;
              layout.perches[perchIndex].dragonClass = item.dragonClass || "";
              if (!layout.perches[perchIndex].dragonTier) {
                layout.perches[perchIndex].dragonTier = [item.rarity, item.type].filter(Boolean).join(" · ");
              }
              saveState();
              render();
              return;
            }
            if (kind === "rider") {
              const perchIndex = Number(input.dataset.perch);
              pushHistory();
              layout.perches[perchIndex].riderName = item.name;
              saveState();
              render();
              return;
            }
            if (kind !== "skill") input.dispatchEvent(new Event("change", { bubbles: true }));
          };
          button.addEventListener("pointerdown", choose);
          button.addEventListener("touchstart", choose, { passive: false });
          button.addEventListener("click", choose);
        });
      };

      input.addEventListener("focus", show);
      input.addEventListener("input", show);
      input.addEventListener("blur", () => window.setTimeout(() => { results.hidden = true; }, 180));
    });
  }

  function render() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (!overlay) return;
    const layout = activeLayout();
    overlay.innerHTML = `
      <div class="nbp-shell">
        <header class="nbp-topbar">
          <div><p>NOIR BASE ADVISER</p><h2>Build, compare and strengthen</h2></div>
          <button class="nbp-close" id="nbpClose" type="button" aria-label="Close">×</button>
        </header>
        <section class="nbp-panel nbp-base-details">
          <label>Base name<input id="nbpLayoutName" value="${escapeHtml(layout.name)}"></label>
          <label>Current in-game DP<input id="nbpCurrentDp" value="${escapeHtml(layout.currentDp)}" inputmode="decimal" placeholder="e.g. 370B"></label>
        </section>
        ${renderPhotos(layout)}
        ${renderMeters(layout)}
        ${renderIslands(layout)}
        ${renderTowerForm(layout)}
        ${renderPerches(layout)}
        ${renderAdvice(layout)}
        <section class="nbp-panel nbp-danger-zone">
          <button type="button" id="nbpResetAll">Delete this saved base</button>
        </section>
      </div>
    `;
    bindEvents();
  }

  function bindEvents() {
    const overlay = document.getElementById(OVERLAY_ID);
    const layout = activeLayout();
    overlay.querySelector("#nbpClose")?.addEventListener("click", close);

    overlay.querySelector("#nbpLayoutName")?.addEventListener("change", event => {
      layout.name = event.target.value.trim() || "My Base";
      saveState();
    });
    overlay.querySelector("#nbpLayoutName")?.addEventListener("input", event => {
      layout.name = event.target.value;
      saveState();
    });
    overlay.querySelector("#nbpCurrentDp")?.addEventListener("input", event => {
      layout.currentDp = event.target.value.trim();
      saveState();
    });
    overlay.querySelector("#nbpCurrentDp")?.addEventListener("change", event => {
      layout.currentDp = event.target.value.trim();
      saveState();
      render();
    });

    overlay.querySelector("#nbpPhotoInput")?.addEventListener("change", async event => {
      const files = Array.from(event.target.files || []).filter(file => file.type.startsWith("image/"));
      const previousPhotoCount = layout.referencePhotos.length;
      for (const file of files.slice(0, Math.max(0, 4 - layout.referencePhotos.length))) {
        const data = await prepareReferencePhoto(file);
        layout.referencePhotos.push(String(data));
      }
      if (!saveState()) {
        layout.referencePhotos.length = previousPhotoCount;
        window.alert("That photo could not be saved. Try a screenshot or a smaller image.");
      }
      render();
    });
    overlay.querySelectorAll("[data-remove-photo]").forEach(button => {
      button.addEventListener("click", () => {
        layout.referencePhotos.splice(Number(button.dataset.removePhoto), 1);
        saveState();
        render();
      });
    });

    overlay.querySelectorAll("[data-slot]").forEach(button => {
      button.addEventListener("click", () => {
        const target = Number(button.dataset.slot);
        if (selectedSlot === null) {
          selectedSlot = target;
          render();
          document.getElementById("nbpTowerEditor")?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        if (selectedSlot === target) {
          document.getElementById("nbpTowerEditor")?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        pushHistory();
        [layout.slots[selectedSlot], layout.slots[target]] = [layout.slots[target], layout.slots[selectedSlot]];
        selectedSlot = target;
        saveState();
        render();
      });
    });

    overlay.querySelector("#nbpCloseEditor")?.addEventListener("click", () => {
      selectedSlot = null;
      render();
    });
    function saveSelectedTower(goNext = false) {
      if (selectedSlot === null) return;
      const type = overlay.querySelector("#nbpTowerType")?.value;
      const savedIndex = selectedSlot;
      pushHistory();
      layout.slots[selectedSlot] = type ? normaliseTower({
        ...layout.slots[selectedSlot],
        type,
        level: overlay.querySelector("#nbpTowerLevel")?.value,
        customName: overlay.querySelector("#nbpTowerCustom")?.value,
        runes: overlay.querySelector("#nbpTowerRunes")?.value,
        glyph: overlay.querySelector("#nbpTowerGlyph")?.value,
        relic: overlay.querySelector("#nbpTowerRelic")?.value
      }) : null;
      if (goNext) {
        const nextEmpty = layout.slots.findIndex((tower, index) => index > savedIndex && !tower);
        selectedSlot = nextEmpty >= 0 ? nextEmpty : null;
      }
      saveState();
      render();
      if (goNext && selectedSlot !== null) {
        document.getElementById("nbpTowerEditor")?.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
    overlay.querySelector("#nbpSaveTower")?.addEventListener("click", () => {
      saveSelectedTower(false);
    });
    overlay.querySelector("#nbpSaveAndNext")?.addEventListener("click", () => saveSelectedTower(true));
    overlay.querySelector("#nbpRemoveTower")?.addEventListener("click", () => {
      if (selectedSlot === null) return;
      pushHistory();
      layout.slots[selectedSlot] = null;
      selectedSlot = null;
      saveState();
      render();
    });

    overlay.querySelectorAll("[data-perch]").forEach(field => {
      field.addEventListener("change", event => {
        const index = Number(event.target.dataset.perch);
        const key = event.target.dataset.field;
        pushHistory();
        layout.perches[index][key] = ["level", "dragonLevel", "riderLevel"].includes(key)
          ? Math.max(0, Number.parseInt(event.target.value, 10) || 0)
          : event.target.value;
        saveState();
        render();
      });
    });
    overlay.querySelectorAll("[data-add-skill]").forEach(button => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.addSkill);
        const input = overlay.querySelector(`[data-skill-search="${index}"]`);
        const skill = input?.value.trim();
        if (!skill || layout.perches[index].riderSkills.includes(skill)) return;
        pushHistory();
        layout.perches[index].riderSkills.push(skill);
        saveState();
        render();
      });
    });
    overlay.querySelectorAll("[data-remove-skill]").forEach(button => {
      button.addEventListener("click", () => {
        const [perchIndex, skillIndex] = button.dataset.removeSkill.split(":").map(Number);
        pushHistory();
        layout.perches[perchIndex].riderSkills.splice(skillIndex, 1);
        saveState();
        render();
      });
    });
    overlay.querySelectorAll("[data-gear]").forEach(field => {
      field.addEventListener("change", event => {
        const index = Number(event.target.dataset.gear);
        const slot = event.target.dataset.gearSlot;
        const field = event.target.dataset.gearField;
        pushHistory();
        layout.perches[index].riderGear[slot][field] = field === "level"
          ? Math.max(0, Number.parseInt(event.target.value, 10) || 0)
          : event.target.value.trim();
        saveState();
        render();
      });
    });

    overlay.querySelector("#nbpUndo")?.addEventListener("click", () => {
      const previous = history.pop();
      if (!previous) return;
      future.push({ slots: clone(layout.slots), perches: clone(layout.perches) });
      layout.slots = previous.slots;
      layout.perches = previous.perches;
      selectedSlot = null;
      saveState();
      render();
    });
    overlay.querySelector("#nbpRedo")?.addEventListener("click", () => {
      const next = future.pop();
      if (!next) return;
      history.push({ slots: clone(layout.slots), perches: clone(layout.perches) });
      layout.slots = next.slots;
      layout.perches = next.perches;
      selectedSlot = null;
      saveState();
      render();
    });
    overlay.querySelector("#nbpResetProposal")?.addEventListener("click", () => {
      pushHistory();
      layout.slots = clone(layout.baselineSlots);
      layout.perches = clone(layout.baselinePerches);
      selectedSlot = null;
      saveState();
      render();
    });
    overlay.querySelector("#nbpMakeCurrent")?.addEventListener("click", () => {
      layout.baselineSlots = clone(layout.slots);
      layout.baselinePerches = clone(layout.perches);
      history = [];
      future = [];
      saveState();
      render();
    });
    overlay.querySelector("#nbpResetAll")?.addEventListener("click", () => {
      if (!window.confirm("Delete this Base Adviser record and start again?")) return;
      const fresh = createLayout();
      state = { layouts: [fresh], activeId: fresh.id };
      history = [];
      future = [];
      selectedSlot = null;
      saveState();
      render();
    });
    bindCatalogueSearch(overlay, layout);
  }

  function installStyles() {
    if (document.getElementById("noirBasePlannerStyles")) return;
    const style = document.createElement("style");
    style.id = "noirBasePlannerStyles";
    style.textContent = `
      .nbp-launch{width:100%;margin:0;padding:22px;display:flex;justify-content:space-between;align-items:center;gap:16px;border:1px solid rgba(102,143,190,.45);border-radius:24px;background:linear-gradient(135deg,rgba(19,38,58,.72),rgba(5,7,9,.98) 74%);color:#eee9df;text-align:left;box-sizing:border-box}
      .nbp-launch strong,.nbp-launch small{display:block}.nbp-launch strong{font-size:19px}.nbp-launch small{margin-top:7px;color:#aaa49b;line-height:1.45;font-size:13px}.nbp-launch-icon{color:#7fb2da;font-size:31px}
      .nct-home-tools .nbp-launch{min-height:138px}
      .nbp-overlay{position:fixed;inset:0;z-index:100000;display:none;overflow-y:auto;padding:max(12px,env(safe-area-inset-top)) 12px max(28px,env(safe-area-inset-bottom));box-sizing:border-box;background:#030405;color:#eeeae2}.nbp-overlay.open{display:block}
      .nbp-shell{width:min(1050px,100%);margin:0 auto}.nbp-topbar{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:16px 18px;border:1px solid #282a2d;border-radius:22px;background:rgba(5,6,7,.96);backdrop-filter:blur(18px)}
      .nbp-topbar p,.nbp-kicker{margin:0;color:#d5b85f;font-size:10px;font-weight:950;letter-spacing:.18em}.nbp-topbar h2{margin:5px 0 0;font-size:clamp(21px,5vw,31px)}.nbp-close{flex:0 0 auto;width:48px;height:48px;border:1px solid #3c3d40;border-radius:50%;background:#111214;color:#fff;font-size:30px}
      .nbp-panel{margin-top:14px;padding:20px;border:1px solid #292b2e;border-radius:22px;background:linear-gradient(145deg,rgba(19,20,22,.98),rgba(7,8,9,.98))}.nbp-panel h3{margin:7px 0 10px;font-size:22px}.nbp-muted,.nbp-trust-copy{color:#a39d94;line-height:1.55}
      .nbp-panel input,.nbp-panel select,.nbp-panel button{box-sizing:border-box;border:1px solid #383a3d;border-radius:13px;background:#101113;color:#eeeae2;font:inherit}.nbp-panel input,.nbp-panel select{width:100%;margin-top:7px;padding:13px}.nbp-panel button{padding:11px 14px}.nbp-panel label{color:#bcb6ac;font-size:13px;font-weight:800}.nbp-primary{border-color:#d7ba64!important;background:#d7ba64!important;color:#090909!important;font-weight:950}.nbp-danger{border-color:rgba(204,112,129,.55)!important;color:#e1a5b0!important}
      .nbp-base-details{display:grid;grid-template-columns:1fr 1fr;gap:13px}.nbp-section-heading{display:flex;justify-content:space-between;align-items:center;gap:13px}.nbp-estimate-label{color:#8e99a4;font-size:12px}
      .nbp-photo-button{display:inline-block;margin-top:15px;padding:12px 15px;border:1px solid #d7ba64;border-radius:13px;color:#0a0a0a!important;background:#d7ba64;cursor:pointer}.nbp-photo-button input{display:none}.nbp-photo-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:14px}.nbp-photo-grid figure{position:relative;margin:0;overflow:hidden;border:1px solid #34363a;border-radius:15px;background:#08090a}.nbp-photo-grid img{display:block;width:100%;height:240px;object-fit:contain}.nbp-photo-grid button{position:absolute;right:8px;bottom:8px;color:#dda2ad;background:rgba(6,7,8,.92)}
      .nbp-meter-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.nbp-meter-grid article{padding:16px;border:1px solid #303237;border-radius:16px;background:#0d0e10}.nbp-meter-grid span,.nbp-meter-grid strong,.nbp-meter-grid b{display:block}.nbp-meter-grid span{color:#8f8b85;font-size:12px}.nbp-meter-grid strong{margin-top:7px;color:#dcc16e;font-size:24px}.nbp-meter-grid b{margin-top:5px;color:#a8a39b;font-size:12px}.nbp-meter{height:8px;margin-top:13px;overflow:hidden;border-radius:99px;background:#222}.nbp-meter i{display:block;height:100%;border-radius:99px;background:#d9bd68}.nbp-meter-grid .up strong,.nbp-meter-grid .up b{color:#72d6b2}.nbp-meter-grid .up .nbp-meter i{background:#61cda7}.nbp-meter-grid .down strong,.nbp-meter-grid .down b{color:#e18a98}.nbp-meter-grid .down .nbp-meter i{background:#d77384}
      .nbp-toolbar,.nbp-editor-actions{display:flex;flex-wrap:wrap;gap:8px}.nbp-toolbar button:disabled,.nbp-panel button:disabled{opacity:.4}.nbp-islands{display:grid;gap:12px;margin-top:16px}.nbp-island{padding:14px;border:1px solid #303338;border-radius:19px;background:linear-gradient(90deg,rgba(25,30,35,.95),rgba(10,11,12,.98))}.nbp-island header{display:flex;justify-content:space-between;margin-bottom:12px}.nbp-island header span{color:#8e99a4;font-size:12px}.nbp-island-slots{display:grid;grid-template-columns:repeat(5,1fr);gap:9px}.nbp-slot{position:relative;min-height:102px;padding:25px 9px 10px!important;text-align:left;overflow:hidden}.nbp-slot>span{position:absolute;top:7px;right:8px;color:#7d8288;font-size:10px}.nbp-slot strong,.nbp-slot small{display:block}.nbp-slot strong{font-size:13px}.nbp-slot small{margin-top:6px;color:#d6b968;font-size:11px}.nbp-slot.empty{border-style:dashed;color:#777c82}.nbp-slot.occupied{border-color:rgba(215,186,100,.4);background:rgba(47,38,14,.32)}.nbp-slot.selected{outline:2px solid #79c5ef;border-color:#79c5ef}
      .nbp-form-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.nbp-editor-actions{margin-top:14px}.nbp-perch-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:14px}.nbp-perch-card{min-width:0;padding:15px;border:1px solid #303236;border-radius:16px;background:#0a0b0c}.nbp-perch-card legend{padding:0 7px;color:#d8bc69;font-weight:900}.nbp-perch-card label{display:block;margin-top:10px}.nbp-two{display:grid;grid-template-columns:1fr 1fr;gap:8px}
      .nbp-perch-details{margin-top:13px;padding-top:11px;border-top:1px solid #292b2e}.nbp-perch-details summary{color:#d8bc69;font-weight:850;cursor:pointer}.nbp-add-row{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:end}.nbp-add-row button{margin-top:7px}.nbp-chip-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.nbp-chip-list button{padding:7px 9px;border-radius:999px;color:#b9dcca;background:rgba(34,81,65,.25)}.nbp-chip-list span{color:#e5a3ae}.nbp-chip-list small{color:#8f8b85}.nbp-gear-grid{display:grid;gap:9px}.nbp-gear-piece{padding:10px;border:1px solid #292b2e;border-radius:12px;background:#0d0e10}.nbp-gear-grid label{font-size:11px}
      [data-catalog-kind]{position:relative}.nbp-suggestions{position:relative;z-index:8;max-height:280px;margin-top:6px;overflow-y:auto;border:1px solid #4a4c50;border-radius:13px;background:#090a0b;box-shadow:0 14px 32px rgba(0,0,0,.55)}.nbp-suggestions button{display:block;width:100%;padding:11px 12px;border:0!important;border-bottom:1px solid #242629!important;border-radius:0!important;text-align:left;background:#0d0e10!important}.nbp-suggestions button:last-child{border-bottom:0!important}.nbp-suggestions strong,.nbp-suggestions small{display:block}.nbp-suggestions strong{color:#eeeae2}.nbp-suggestions small{margin-top:4px;color:#a9a39a;font-size:11px}.nbp-suggestions p{margin:0;padding:13px;color:#99938a}
      .nbp-findings{display:grid;gap:10px;margin-top:14px}.nbp-finding{padding:14px 15px;border:1px solid #303030;border-left-width:4px;border-radius:15px;background:#0b0b0b}.nbp-finding strong{display:block}.nbp-finding p{margin:5px 0 0;color:#aaa49b;line-height:1.45}.nbp-finding.error{border-left-color:#e08089}.nbp-finding.warning{border-left-color:#dcc16e}.nbp-finding.good{border-left-color:#69dab0}.nbp-empty-copy{color:#99938a}.nbp-danger-zone{text-align:center}.nbp-danger-zone button{color:#dda2ad;border-color:rgba(190,105,121,.45)}.hidden{display:none!important}
      @media(max-width:720px){.nct-home-tools .nbp-launch{min-height:0}.nbp-base-details,.nbp-meter-grid,.nbp-form-grid,.nbp-perch-grid,.nbp-photo-grid{grid-template-columns:1fr}.nbp-section-heading{align-items:flex-start;flex-wrap:wrap}.nbp-island-slots{grid-template-columns:repeat(5,minmax(82px,1fr));overflow-x:auto;padding-bottom:5px}.nbp-slot{min-width:82px}.nbp-photo-grid img{height:auto;max-height:360px}}
    `;
    document.head.appendChild(style);
  }

  function install() {
    if (document.getElementById(OVERLAY_ID)) return;
    installStyles();
    const launch = document.createElement("button");
    launch.type = "button";
    launch.className = "nbp-launch";
    launch.innerHTML = `<span><strong>Base Adviser</strong><small>Build your real base, test tower moves and compare the result.</small></span><span class="nbp-launch-icon" aria-hidden="true">⚔</span>`;
    launch.addEventListener("click", open);

    const tools = document.querySelector(".nct-home-tools");
    const share = tools?.querySelector(".nct-share");
    if (share) {
      tools.insertBefore(launch, share);
    } else if (tools) {
      tools.prepend(launch);
    } else {
      const progress = document.querySelector("#activeSessionTitle")?.closest(".content-panel");
      progress?.insertAdjacentElement("afterend", launch);
    }

    const overlay = document.createElement("section");
    overlay.id = OVERLAY_ID;
    overlay.className = "nbp-overlay";
    overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(overlay);
  }

  function open() {
    render();
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
    evaluate,
    comparison,
    getState: () => clone(state),
    getActiveLayout: () => clone(activeLayout()),
    constants: Object.freeze({ ISLAND_COUNT, SLOTS_PER_ISLAND, TOTAL_SLOTS, TOWER_TYPES })
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
