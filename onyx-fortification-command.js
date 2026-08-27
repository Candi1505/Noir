(() => {
  "use strict";

  const STORAGE_PREFIX = "onyxFortificationCommandV1";
  const MINIMUM_PLAYER_LEVEL = 600;
  const MAXIMUM_PLAYER_LEVEL = 999;
  const MAXIMUM_ROUTE_STEPS = 20000;
  const ACTIONS = Object.freeze({
    upgrade: "Upgrade on route",
    hold: "Hold",
    merge: "Reserve for merge",
    transform: "Reserve for transform"
  });

  let draft = null;
  let savedDraft = null;
  let result = null;
  let message = "";
  let inventorySnapshot = null;
  let openedForUser = null;
  let hostRender = null;

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

  function cleanNumber(value, minimum, maximum, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
      ? parsed
      : fallback;
  }

  function userId() {
    return window.OnyxCommandCore?.getCurrentUserId?.() || null;
  }

  function storageKey() {
    return `${STORAGE_PREFIX}:${userId() || "signed-out"}`;
  }

  function catalogue() {
    return window.NoirBaseCatalog || {};
  }

  function towerTypes() {
    return Object.entries(catalogue().towerLevels || {})
      .filter(([name, rows]) => name && Array.isArray(rows) && rows.length && !/\bBoss\b/i.test(name))
      .map(([name]) => name)
      .sort((left, right) => left.localeCompare(right));
  }

  function canonicalTowerType(value) {
    const clean = String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!clean) return "";
    return towerTypes().find(type => type.toLowerCase() === clean.toLowerCase()) || "";
  }

  function rowsFor(type) {
    const rows = catalogue().towerLevels?.[type];
    return Array.isArray(rows) ? rows : [];
  }

  function exactRow(type, level) {
    return rowsFor(type).find(row => Number(row?.level) === Number(level)) || null;
  }

  function maximumCatalogueLevel() {
    return towerTypes().reduce((maximum, type) => Math.max(
      maximum,
      ...rowsFor(type).map(row => Number(row?.level) || 0)
    ), 0);
  }

  function playerXpForLevel(level) {
    const target = Math.max(MINIMUM_PLAYER_LEVEL, Math.min(MAXIMUM_PLAYER_LEVEL, Number(level) || MINIMUM_PLAYER_LEVEL));
    let xp = 1959262;
    for (let current = MINIMUM_PLAYER_LEVEL + 1; current <= target; current += 1) {
      xp = Math.round(xp * 1.01);
    }
    return xp;
  }

  function blankDraft() {
    return {
      version: 1,
      currentPlayerLevel: MINIMUM_PLAYER_LEVEL,
      targetPlayerLevel: MINIMUM_PLAYER_LEVEL + 1,
      currentProgressXp: 0,
      maximumTowerLevel: maximumCatalogueLevel() || 250,
      inventory: [],
      updatedAt: new Date().toISOString()
    };
  }

  function normaliseInventoryItem(value, index = 0) {
    const source = value && typeof value === "object" ? value : {};
    const type = canonicalTowerType(source.type);
    const level = cleanNumber(source.level, 1, 999, 0);
    if (!type || !level || !exactRow(type, level)) return null;
    const location = source.location === "storage" ? "storage" : "base";
    const action = Object.hasOwn(ACTIONS, source.action) ? source.action : "hold";
    return {
      id: String(source.id || `fort-${Date.now()}-${index}`).replace(/[^a-zA-Z0-9._-]/g, "-").slice(0, 80),
      type,
      level,
      quantity: cleanNumber(source.quantity, 1, 500, 1),
      location,
      action
    };
  }

  function normaliseDraft(value) {
    const source = value && typeof value === "object" ? value : {};
    const fallback = blankDraft();
    const currentPlayerLevel = cleanNumber(
      source.currentPlayerLevel,
      MINIMUM_PLAYER_LEVEL,
      MAXIMUM_PLAYER_LEVEL - 1,
      fallback.currentPlayerLevel
    );
    const targetPlayerLevel = Math.max(
      currentPlayerLevel + 1,
      cleanNumber(
        source.targetPlayerLevel,
        MINIMUM_PLAYER_LEVEL + 1,
        MAXIMUM_PLAYER_LEVEL,
        currentPlayerLevel + 1
      )
    );
    const nextThreshold = playerXpForLevel(currentPlayerLevel + 1);
    return {
      version: 1,
      currentPlayerLevel,
      targetPlayerLevel,
      currentProgressXp: cleanNumber(source.currentProgressXp, 0, Math.max(0, nextThreshold - 1), 0),
      maximumTowerLevel: cleanNumber(
        source.maximumTowerLevel,
        1,
        maximumCatalogueLevel() || 999,
        fallback.maximumTowerLevel
      ),
      inventory: (Array.isArray(source.inventory) ? source.inventory : [])
        .map(normaliseInventoryItem)
        .filter(Boolean)
        .slice(0, 400),
      updatedAt: String(source.updatedAt || new Date().toISOString())
    };
  }

  function parseCost(cost, resources) {
    String(cost || "").split(/[|;]/).forEach(part => {
      const [name, amount] = part.split(":");
      const quantity = Number(amount) || 0;
      if (!name || !quantity) return;
      resources[name] = (resources[name] || 0) + quantity;
    });
  }

  function planFortification(value) {
    const plan = normaliseDraft(value);
    const route = [];
    const resources = {};
    const instances = [];
    const reserved = { hold: 0, merge: 0, transform: 0 };

    plan.inventory.forEach(item => {
      if (item.action !== "upgrade") {
        reserved[item.action] += item.quantity;
        return;
      }
      for (let copy = 1; copy <= item.quantity; copy += 1) {
        instances.push({
          id: `${item.id}-${copy}`,
          type: item.type,
          level: item.level,
          copy,
          location: item.location
        });
      }
    });

    let simulatedPlayerLevel = plan.currentPlayerLevel;
    let progressXp = plan.currentProgressXp;
    let earnedXp = 0;
    let totalSeconds = 0;
    let exhausted = false;

    while (simulatedPlayerLevel < plan.targetPlayerLevel && route.length < MAXIMUM_ROUTE_STEPS) {
      const choices = instances.map(instance => {
        const next = exactRow(instance.type, instance.level + 1);
        if (!next || Number(next.level) > plan.maximumTowerLevel) return null;
        const requiredLevel = Number(next.playerLevelRequired) || 0;
        if (requiredLevel > simulatedPlayerLevel) return null;
        return { instance, next };
      }).filter(Boolean).sort((left, right) =>
        (Number(right.next.xp) || 0) - (Number(left.next.xp) || 0)
        || (Number(left.next.seconds) || 0) - (Number(right.next.seconds) || 0)
        || left.instance.type.localeCompare(right.instance.type)
      );

      if (!choices.length) {
        exhausted = true;
        break;
      }

      const choice = choices[0];
      const from = choice.instance.level;
      choice.instance.level = Number(choice.next.level);
      const xp = Math.max(0, Number(choice.next.xp) || 0);
      const seconds = Math.max(0, Number(choice.next.seconds) || 0);
      earnedXp += xp;
      progressXp += xp;
      totalSeconds += seconds;
      parseCost(choice.next.cost, resources);
      route.push({
        type: choice.instance.type,
        copy: choice.instance.copy,
        location: choice.instance.location,
        from,
        to: choice.instance.level,
        xp,
        seconds,
        cost: String(choice.next.cost || "")
      });

      while (simulatedPlayerLevel < plan.targetPlayerLevel) {
        const threshold = playerXpForLevel(simulatedPlayerLevel + 1);
        if (progressXp < threshold) break;
        progressXp -= threshold;
        simulatedPlayerLevel += 1;
      }
    }

    const summaryMap = new Map();
    route.forEach(step => {
      const key = `${step.type}\u0000${step.copy}`;
      const current = summaryMap.get(key);
      if (current) {
        current.to = step.to;
        current.xp += step.xp;
        current.steps += 1;
      } else {
        summaryMap.set(key, {
          type: step.type,
          copy: step.copy,
          from: step.from,
          to: step.to,
          xp: step.xp,
          steps: 1
        });
      }
    });

    const blockers = instances.map(instance => {
      const next = exactRow(instance.type, instance.level + 1);
      if (!next) return `${instance.type} copy ${instance.copy} has no higher exact catalogue row.`;
      if (Number(next.level) > plan.maximumTowerLevel) {
        return `${instance.type} copy ${instance.copy} reached tower cap ${plan.maximumTowerLevel}.`;
      }
      const required = Number(next.playerLevelRequired) || 0;
      if (required > simulatedPlayerLevel) {
        return `${instance.type} copy ${instance.copy} needs player level ${required} for level ${next.level}.`;
      }
      return "";
    }).filter(Boolean);

    const targetXp = (() => {
      let needed = -plan.currentProgressXp;
      for (let level = plan.currentPlayerLevel + 1; level <= plan.targetPlayerLevel; level += 1) {
        needed += playerXpForLevel(level);
      }
      return Math.max(0, needed);
    })();

    return {
      ok: instances.length > 0,
      reached: simulatedPlayerLevel >= plan.targetPlayerLevel,
      exhausted,
      currentPlayerLevel: plan.currentPlayerLevel,
      targetPlayerLevel: plan.targetPlayerLevel,
      simulatedPlayerLevel,
      remainingProgressXp: progressXp,
      targetXp,
      earnedXp,
      totalSeconds,
      route,
      summary: Array.from(summaryMap.values()),
      resources,
      blockers: [...new Set(blockers)].slice(0, 12),
      reserved,
      upgradableTowers: instances.length,
      message: instances.length
        ? simulatedPlayerLevel >= plan.targetPlayerLevel
          ? "Estimated target route found from exact catalogue rows."
          : "The selected upgrade inventory could not reach the target under the entered caps."
        : "Mark at least one tower as Upgrade on route."
    };
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
    return [days ? `${days}d` : "", hours ? `${hours}h` : "", !days && minutes ? `${minutes}m` : ""]
      .filter(Boolean).join(" ") || `${Math.ceil(total / 60)}m`;
  }

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

  function dirty() {
    if (!draft) return false;
    const comparable = value => JSON.stringify({
      currentPlayerLevel: value.currentPlayerLevel,
      targetPlayerLevel: value.targetPlayerLevel,
      currentProgressXp: value.currentProgressXp,
      maximumTowerLevel: value.maximumTowerLevel,
      inventory: value.inventory
    });
    return !savedDraft || comparable(draft) !== comparable(savedDraft);
  }

  function readLocal() {
    try {
      const savedText = localStorage.getItem(storageKey());
      savedDraft = savedText ? normaliseDraft(JSON.parse(savedText)) : null;
      if (!savedDraft) {
        const legacy = JSON.parse(localStorage.getItem("noirBasePlannerV1") || "null");
        const legacyLayout = Array.isArray(legacy?.layouts)
          ? legacy.layouts.find(item => item?.id === legacy.activeId) || legacy.layouts[0]
          : null;
        const legacyFort = legacyLayout?.fortPlanner;
        if (
          legacyFort &&
          typeof legacyFort === "object" &&
          (Array.isArray(legacyFort.storedTowers) && legacyFort.storedTowers.length || Number(legacyFort.currentLevel) >= MINIMUM_PLAYER_LEVEL)
        ) {
          draft = normaliseDraft({
            currentPlayerLevel: legacyFort.currentLevel,
            targetPlayerLevel: legacyFort.targetLevel,
            currentProgressXp: legacyFort.currentXp,
            maximumTowerLevel: legacyFort.maximumTowerLevel,
            inventory: legacyFort.storedTowers
          });
          result = planFortification(draft);
          message = "Your previous Fort planner was brought forward as an unsaved Onyx draft.";
          return;
        }
      }
    } catch (error) {
      savedDraft = null;
    }
    draft = savedDraft ? clone(savedDraft) : blankDraft();
    result = planFortification(draft);
    message = savedDraft ? "Saved route loaded from this device." : "";
  }

  function refreshInventory(value = window.OnyxTowerInventoryBridge?.getSnapshot?.()) {
    inventorySnapshot = value && typeof value === "object" ? clone(value) : null;
  }

  function init() {
    const currentUser = userId() || "signed-out";
    if (openedForUser !== currentUser || !draft) {
      openedForUser = currentUser;
      readLocal();
    }
    refreshInventory();
  }

  function setHostRender(callback) {
    hostRender = typeof callback === "function" ? callback : null;
  }

  function rerender(options = {}) {
    result = planFortification(draft);
    hostRender?.(options);
  }

  function readCoreForm(overlay) {
    draft = normaliseDraft({
      ...draft,
      currentPlayerLevel: overlay.querySelector("#ofcCurrentPlayerLevel")?.value,
      targetPlayerLevel: overlay.querySelector("#ofcTargetPlayerLevel")?.value,
      currentProgressXp: overlay.querySelector("#ofcCurrentProgressXp")?.value,
      maximumTowerLevel: overlay.querySelector("#ofcMaximumTowerLevel")?.value
    });
  }

  function towerOptions(selected = "") {
    return towerTypes().map(type =>
      `<option value="${escapeHtml(type)}" ${type === selected ? "selected" : ""}>${escapeHtml(type)}</option>`
    ).join("");
  }

  function actionOptions(selected) {
    return Object.entries(ACTIONS).map(([value, label]) =>
      `<option value="${value}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`
    ).join("");
  }

  function renderInventory() {
    return `
      <section class="ofc-panel ofc-inventory">
        <div class="ofc-heading">
          <div><p>02 · TOWER INTENTIONS</p><h3>Choose what Onyx may spend</h3></div>
          <span>${formatNumber(draft.inventory.reduce((sum, item) => sum + item.quantity, 0))} recorded</span>
        </div>
        <p class="ofc-muted">Only towers marked <strong>Upgrade on route</strong> enter the estimate. Hold, merge and transform reserves remain untouched.</p>
        ${inventorySnapshot ? `
          <button id="ofcUseSnapshot" class="ofc-snapshot" type="button">Use available owner inventory snapshot</button>
        ` : ""}
        <form id="ofcAddTower" class="ofc-add-tower">
          <label>Tower type<select id="ofcNewType" required>${towerOptions()}</select></label>
          <label>Level<input id="ofcNewLevel" type="number" min="1" max="999" value="1" inputmode="numeric" required></label>
          <label>Quantity<input id="ofcNewQuantity" type="number" min="1" max="500" value="1" inputmode="numeric" required></label>
          <label>Location<select id="ofcNewLocation"><option value="base">On base</option><option value="storage">Storage</option></select></label>
          <button class="primary" type="submit">Add tower group</button>
        </form>
        <div class="ofc-inventory-list">
          ${draft.inventory.length ? draft.inventory.map((item, index) => `
            <article>
              <div class="ofc-tower-mark" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 20h14M7 20V9l3 2 2-4 2 4 3-2v11M9 15h6"/></svg></div>
              <div class="ofc-tower-copy"><strong>${escapeHtml(item.type)}</strong><span>Level ${item.level} · ${item.quantity} ${item.quantity === 1 ? "tower" : "towers"} · ${item.location === "storage" ? "Storage" : "On base"}</span></div>
              <label><span class="sr-only">Intent for ${escapeHtml(item.type)}</span><select data-ofc-action="${index}">${actionOptions(item.action)}</select></label>
              <button type="button" class="ofc-remove" data-ofc-remove="${index}">Remove</button>
            </article>
          `).join("") : `<div class="ofc-empty"><strong>No tower inventory recorded yet.</strong><span>Add groups manually or use the available owner snapshot.</span></div>`}
        </div>
      </section>
    `;
  }

  function renderResult() {
    const route = result || planFortification(draft);
    const percentage = route.targetXp ? Math.min(100, Math.round((route.earnedXp / route.targetXp) * 100)) : 100;
    const resources = Object.entries(route.resources);
    return `
      <section class="ofc-panel ofc-route ${route.reached ? "reached" : "blocked"}">
        <div class="ofc-heading">
          <div><p>03 · ESTIMATED ROUTE</p><h3>${route.reached ? `Target level ${route.targetPlayerLevel} reached` : "Route needs more tower XP"}</h3></div>
          <span>Estimate</span>
        </div>
        <div class="ofc-route-meter"><i style="width:${percentage}%"></i></div>
        <div class="ofc-metrics">
          <article><small>Estimated level reached</small><strong>${formatNumber(route.simulatedPlayerLevel)}</strong><span>Target ${formatNumber(route.targetPlayerLevel)}</span></article>
          <article><small>Estimated XP earned</small><strong>≈ ${formatNumber(route.earnedXp)}</strong><span>${percentage}% of target need</span></article>
          <article><small>Upgrade steps</small><strong>${formatNumber(route.route.length)}</strong><span>${formatDuration(route.totalSeconds)} build time</span></article>
          <article><small>Reserved towers</small><strong>${formatNumber(route.reserved.hold + route.reserved.merge + route.reserved.transform)}</strong><span>${route.reserved.merge} merge · ${route.reserved.transform} transform</span></article>
        </div>
        <p class="ofc-status">${escapeHtml(route.message)}</p>
        ${route.summary.length ? `
          <div class="ofc-summary-list">
            ${route.summary.slice(0, 40).map(item => `
              <article><span>${escapeHtml(item.type)} · copy ${item.copy}</span><strong>Level ${item.from} → ${item.to}</strong><small>≈ ${formatNumber(item.xp)} XP · ${item.steps} steps</small></article>
            `).join("")}
          </div>
        ` : ""}
        ${resources.length ? `
          <details class="ofc-resource-drawer"><summary>Estimated recorded resources</summary><div>${resources.map(([name, amount]) => `<span><small>${escapeHtml(RESOURCE_NAMES[name] || "Catalogue resource")}</small><strong>${formatNumber(amount)}</strong></span>`).join("")}</div></details>
        ` : ""}
        ${route.blockers.length && !route.reached ? `
          <div class="ofc-blockers"><strong>Current route blockers</strong>${route.blockers.map(item => `<p>${escapeHtml(item)}</p>`).join("")}</div>
        ` : ""}
        <p class="ofc-honesty"><strong>Estimate only.</strong> This route uses exact published tower XP, build-time, cost and player-level rows. It does not claim you own unrecorded towers or resources, and it never spends merge or transform reserves.</p>
      </section>
    `;
  }

  function render() {
    init();
    result = planFortification(draft);
    return `
      <section class="ofc-hero">
        <div><p>FORTIFICATION COMMAND</p><h3>Build the route before the event</h3><span>Turn recorded towers into an explainable target-level plan.</span></div>
        <div class="ofc-hero-orbit" aria-hidden="true"><svg viewBox="0 0 64 64"><path d="M13 52h38M18 52V25l8 5 6-14 6 14 8-5v27M25 40h14M32 40v12"/><circle cx="32" cy="32" r="28"/></svg></div>
      </section>
      <section class="ofc-panel ofc-targets">
        <div class="ofc-heading"><div><p>01 · TARGET LOCK</p><h3>Set the player-level objective</h3></div><span>Levels 600–999</span></div>
        <div class="ofc-target-grid">
          <label>Current player level<input id="ofcCurrentPlayerLevel" type="number" min="600" max="998" inputmode="numeric" value="${draft.currentPlayerLevel}"></label>
          <label>Target player level<input id="ofcTargetPlayerLevel" type="number" min="601" max="999" inputmode="numeric" value="${draft.targetPlayerLevel}"></label>
          <label>Current XP into next level<input id="ofcCurrentProgressXp" type="number" min="0" inputmode="numeric" value="${draft.currentProgressXp}"></label>
          <label>Current maximum tower level<input id="ofcMaximumTowerLevel" type="number" min="1" max="${maximumCatalogueLevel() || 999}" inputmode="numeric" value="${draft.maximumTowerLevel}"></label>
        </div>
      </section>
      ${renderInventory()}
      ${renderResult()}
      <section class="ofc-save-dock">
        <div><strong>${dirty() ? "Unsaved Fort route" : "Fort route secured"}</strong><span>${escapeHtml(message || (dirty() ? "Review the estimate, then save it to this device." : "Saved separately for this signed-in account."))}</span></div>
        <div><button id="ofcReset" type="button">Reset changes</button><button id="ofcSave" class="primary" type="button" ${dirty() ? "" : "disabled"}>Save route</button></div>
        <button id="ofcClear" class="ofc-clear" type="button">Clear Fortification Command</button>
      </section>
    `;
  }

  function bind(overlay) {
    ["#ofcCurrentPlayerLevel", "#ofcTargetPlayerLevel", "#ofcCurrentProgressXp", "#ofcMaximumTowerLevel"].forEach(selector => {
      overlay.querySelector(selector)?.addEventListener("change", () => {
        readCoreForm(overlay);
        message = "Target route recalculated.";
        rerender({ focusSelector: selector });
      });
    });

    overlay.querySelector("#ofcAddTower")?.addEventListener("submit", event => {
      event.preventDefault();
      const item = normaliseInventoryItem({
        id: `manual-${Date.now()}`,
        type: overlay.querySelector("#ofcNewType")?.value,
        level: overlay.querySelector("#ofcNewLevel")?.value,
        quantity: overlay.querySelector("#ofcNewQuantity")?.value,
        location: overlay.querySelector("#ofcNewLocation")?.value,
        action: "upgrade"
      });
      if (!item) {
        message = "Choose a tower and an exact catalogue level.";
        rerender({ focusSelector: "#ofcNewType" });
        return;
      }
      draft.inventory.push(item);
      draft = normaliseDraft(draft);
      message = "Tower group added to the estimated route.";
      rerender({ focusSelector: `[data-ofc-action="${draft.inventory.length - 1}"]`, scrollSelector: ".ofc-inventory-list" });
    });

    overlay.querySelectorAll("[data-ofc-action]").forEach(select => {
      select.addEventListener("change", () => {
        const index = Number(select.dataset.ofcAction);
        if (!draft.inventory[index] || !Object.hasOwn(ACTIONS, select.value)) return;
        draft.inventory[index].action = select.value;
        message = `${ACTIONS[select.value]} intention applied.`;
        rerender({ focusSelector: `[data-ofc-action="${index}"]` });
      });
    });

    overlay.querySelectorAll("[data-ofc-remove]").forEach(button => {
      button.addEventListener("click", () => {
        const index = Number(button.dataset.ofcRemove);
        draft.inventory.splice(index, 1);
        message = "Tower group removed from this draft.";
        rerender({ focusSelector: "#ofcNewType" });
      });
    });

    overlay.querySelector("#ofcUseSnapshot")?.addEventListener("click", () => {
      const records = Array.isArray(inventorySnapshot?.records)
        ? inventorySnapshot.records
        : Array.isArray(inventorySnapshot?.towers)
          ? inventorySnapshot.towers
          : [];
      const imported = records.map((item, index) => normaliseInventoryItem({
        id: `owner-${index}-${item.type}-${item.level}`,
        type: item.type,
        level: item.level,
        quantity: item.quantity,
        location: item.location,
        action: "hold"
      }, index)).filter(Boolean);
      if (!imported.length) {
        message = "The available snapshot did not contain exact tower rows.";
        rerender({ focusSelector: "#ofcUseSnapshot" });
        return;
      }
      draft.inventory = imported;
      message = `${imported.length} owner inventory groups added as Hold. Choose which groups may be upgraded.`;
      rerender({ focusSelector: '[data-ofc-action="0"]', scrollSelector: ".ofc-inventory-list" });
    });

    overlay.querySelector("#ofcSave")?.addEventListener("click", () => {
      draft.updatedAt = new Date().toISOString();
      draft = normaliseDraft(draft);
      localStorage.setItem(storageKey(), JSON.stringify(draft));
      savedDraft = clone(draft);
      message = `Saved on this device · ${new Date().toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}`;
      rerender({ focusSelector: "#ofcSave" });
    });

    overlay.querySelector("#ofcReset")?.addEventListener("click", () => {
      if (dirty() && !window.confirm("Reset this Fortification draft to the last saved route?")) return;
      draft = savedDraft ? clone(savedDraft) : blankDraft();
      message = savedDraft ? "Draft reset to the last saved route." : "Fortification draft reset.";
      rerender({ focusSelector: "#ofcCurrentPlayerLevel" });
    });

    overlay.querySelector("#ofcClear")?.addEventListener("click", () => {
      if (!window.confirm("Clear the saved Fortification route from this device?")) return;
      localStorage.removeItem(storageKey());
      savedDraft = null;
      draft = blankDraft();
      message = "Fortification Command cleared.";
      rerender({ focusSelector: "#ofcCurrentPlayerLevel" });
    });
  }

  window.OnyxFortificationCommand = Object.freeze({
    init,
    render,
    bind,
    setHostRender,
    refreshInventory,
    blankDraft,
    normaliseDraft,
    playerXpForLevel,
    planFortification,
    getDraft: () => clone(draft)
  });
})();
