(() => {
  "use strict";

  const OVERLAY_ID = "onyxCommandOverlay";
  const LOCAL_STATE_PREFIX = "onyxCommandStateV1";
  const VALID_COMMANDS = new Set([
    "menu",
    "season",
    "chest",
    "rider",
    "atlas",
    "calculators"
  ]);

  const ICONS = Object.freeze({
    menu: `<svg viewBox="0 0 48 48" role="img"><path d="M8 13h32M8 24h32M8 35h32"/></svg>`,
    crest: `<svg viewBox="0 0 64 76" role="img"><path class="fill" d="m32 3 15 18-5 34-10 16-10-16-5-34Z"/><path d="m32 3 15 18-5 34-10 16-10-16-5-34Zm0 8v52M18 22l14 10 14-10M22 55l10-9 10 9"/></svg>`,
    key: `<svg viewBox="0 0 64 64" role="img"><circle cx="22" cy="22" r="11"/><path d="m30 30 24 24m-8-8 7-7m-15-1 7-7"/></svg>`,
    season: `<svg viewBox="0 0 64 64" role="img"><path d="M9 49c12-2 18-11 23-28 5 17 11 26 23 28M16 46l4-17 12 10 12-10 4 17M13 51h38"/><path class="fill" d="m32 14 4 8-4 7-4-7Z"/></svg>`,
    chest: `<svg viewBox="0 0 64 64" role="img"><path d="M11 25h42v27H11zM8 25h48l-5-13H13ZM11 35h42"/><path class="fill" d="M28 31h8v12h-8z"/></svg>`,
    base: `<svg viewBox="0 0 64 64" role="img"><path d="M10 54h44M15 54V29l7-6 7 6v-9l6-6 6 6v9l7-6 7 6v25M22 46v-8m20 8v-8M29 54V40h12v14"/><path class="fill" d="m32 6 5 7-5 6-5-6Z"/></svg>`,
    layout: `<svg viewBox="0 0 64 64" role="img"><rect x="9" y="10" width="46" height="44" rx="4"/><path d="M9 25h46M24 10v44m16-29v29"/><circle class="fill" cx="16.5" cy="17.5" r="3"/><circle class="fill" cx="32" cy="39" r="4"/></svg>`,
    rider: `<svg viewBox="0 0 64 64" role="img"><path d="M32 8 43 24l12 5-9 9 1 16-15-7-15 7 1-16-9-9 12-5Z"/><path d="m24 32 8-13 8 13-8 9Z"/></svg>`,
    atlas: `<svg viewBox="0 0 64 64" role="img"><circle cx="32" cy="32" r="23"/><path d="M10 32h44M32 9c8 8 12 15 12 23S40 47 32 55M32 9c-8 8-12 15-12 23s4 15 12 23M16 18c9 5 23 5 32 0M16 46c9-5 23-5 32 0"/><path class="fill" d="m32 24 5 8-5 8-5-8Z"/></svg>`,
    calculators: `<svg viewBox="0 0 64 64" role="img"><rect x="12" y="8" width="40" height="48" rx="6"/><path d="M20 17h24v10H20zM20 37h8m-4-4v8m12-6 6 6m0-6-6 6M20 48h8m8 0h8"/></svg>`,
    home: `<svg viewBox="0 0 48 48" role="img"><path d="m7 22 17-15 17 15v19H29V29H19v12H7Z"/></svg>`,
    intel: `<svg viewBox="0 0 48 48" role="img"><path d="m24 5 15 7v11c0 9-6 16-15 20-9-4-15-11-15-20V12Z"/><path d="M24 14v20m-8-10h16"/></svg>`,
    profile: `<svg viewBox="0 0 48 48" role="img"><circle cx="24" cy="16" r="8"/><path d="M9 42c1-11 6-17 15-17s14 6 15 17"/></svg>`,
    close: `<svg viewBox="0 0 48 48" role="img"><path d="m11 11 26 26M37 11 11 37"/></svg>`,
    chevron: `<svg viewBox="0 0 48 48" role="img"><path d="m18 9 15 15-15 15"/></svg>`
  });

  const CHESTS = Object.freeze([
    { id: "gold", label: "Gold", detail: "Bonus at 30", tone: "gold" },
    { id: "platinum", label: "Platinum", detail: "Bonus at 30", tone: "platinum" },
    { id: "draconic", label: "Draconic", detail: "Bonus at 30", tone: "draconic" },
    { id: "freedom", label: "Freedom", detail: "Bonus at 15", tone: "freedom" },
    { id: "arcane", label: "Arcane", detail: "Temporary · 15", tone: "arcane" },
    { id: "super_sigil", label: "Super Sigil", detail: "Bonus at 30", tone: "sigil" }
  ]);

  const VERIFIED_ROUTE = Object.freeze([
    { branch: "Brickscale", keys: 6, sigils: 19503, stop: "Sixth key" },
    { branch: "Mission Bonus", keys: 1, sigils: 6600, stop: "First key" },
    { branch: "Base Boost", keys: 6, sigils: 19500, stop: "Sixth key" },
    { branch: "Charged Volt Tower", keys: 6, sigils: 38800, stop: "Sixth key" },
    { branch: "Cosmic Orrery", keys: 1, sigils: 6400, stop: "First key" }
  ]);

  let commandState = {
    currentKeys: null
  };
  let riderCatalogueMode = "riders";
  let riderCatalogueQuery = "";

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

  function icon(name, className = "") {
    const svg = ICONS[name] || ICONS.crest;
    return `<span class="onyx-svg-icon ${escapeHtml(className)}" aria-hidden="true">${svg}</span>`;
  }

  function hydrateIcons(root = document) {
    root.querySelectorAll("[data-onyx-icon]").forEach(element => {
      const name = element.dataset.onyxIcon;
      if (!ICONS[name] || element.dataset.onyxHydrated === "true") return;
      element.innerHTML = ICONS[name];
      element.dataset.onyxHydrated = "true";
    });
  }

  function storageKey() {
    const userId = window.OnyxCommandCore?.getCurrentUserId?.() || "signed-out";
    return `${LOCAL_STATE_PREFIX}:${userId}`;
  }

  function readLocalState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) || "null");
      const rawCount = saved?.currentKeys;
      const count = rawCount === null || rawCount === undefined ? null : Number(rawCount);
      commandState.currentKeys = count !== null && Number.isFinite(count)
        ? Math.max(0, Math.min(40, Math.round(count)))
        : null;
    } catch (error) {
      commandState.currentKeys = null;
    }
  }

  async function loadCloudState() {
    readLocalState();
    renderKeyProgress();
    const loader = window.ChestDatabase?.loadOnyxCommandState;
    if (typeof loader !== "function") return;
    try {
      const saved = await loader.call(window.ChestDatabase);
      const rawCount = saved?.currentKeys;
      const count = rawCount === null || rawCount === undefined ? null : Number(rawCount);
      if (count === null || Number.isFinite(count)) {
        commandState.currentKeys = count === null
          ? null
          : Math.max(0, Math.min(40, Math.round(count)));
        localStorage.setItem(storageKey(), JSON.stringify(commandState));
        renderKeyProgress();
      }
    } catch (error) {
      console.warn("[Onyx Command] Cloud preferences are not available yet.", error);
    }
  }

  async function saveCommandState() {
    localStorage.setItem(storageKey(), JSON.stringify(commandState));
    renderKeyProgress();
    const saver = window.ChestDatabase?.saveOnyxCommandState;
    if (typeof saver !== "function") return false;
    try {
      await saver.call(window.ChestDatabase, commandState);
      return true;
    } catch (error) {
      console.warn("[Onyx Command] Preferences were saved on this device only.", error);
      return false;
    }
  }

  function renderKeyProgress() {
    const count = commandState.currentKeys;
    const value = document.getElementById("onyxKeyProgressValue");
    const target = document.getElementById("onyxKeyProgressTarget");
    const help = document.getElementById("onyxKeyProgressHelp");
    const ring = document.getElementById("onyxKeyProgressRing");
    if (!value || !target || !help || !ring) return;

    if (count === null) {
      value.textContent = "—";
      target.textContent = "/20";
      help.textContent = "Add your current key count to track the mythic unlock target.";
      ring.style.setProperty("--key-progress", 0);
      return;
    }

    value.textContent = String(count);
    const keyTarget = count > 20 ? 40 : 20;
    target.textContent = `/${keyTarget}`;
    ring.style.setProperty("--key-progress", Math.min(100, (count / keyTarget) * 100));
    if (count >= 20) {
      help.textContent = count >= 40
        ? "Two 20-key mythic targets reached."
        : `${count - 20} key${count - 20 === 1 ? "" : "s"} toward a second mythic target.`;
    } else {
      const remaining = 20 - count;
      help.textContent = `${remaining} key${remaining === 1 ? "" : "s"} remaining to the first mythic unlock.`;
    }
  }

  function setGreeting() {
    const hour = new Date().getHours();
    const daypart = hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";
    const element = document.getElementById("onyxDaypart");
    if (element) element.textContent = daypart;
  }

  function shell(title, kicker, body) {
    return `
      <div class="onyx-overlay-shell" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <header class="onyx-overlay-header">
          <div>
            <p>${escapeHtml(kicker)}</p>
            <h2>${escapeHtml(title)}</h2>
          </div>
          <button class="onyx-overlay-close" type="button" data-command-close aria-label="Close">
            ${icon("close")}
          </button>
        </header>
        <div class="onyx-overlay-body">${body}</div>
      </div>
    `;
  }

  function renderSeason() {
    const value = commandState.currentKeys === null ? "" : commandState.currentKeys;
    return shell("Season Command", "MISFITRISE · WAVE 1", `
      <section class="onyx-source-banner verified">
        <strong>Verified Wave 1 season graph</strong>
        <p>12 verified branches and 558 mapped nodes. This route is calculated for Wave 1 and is not treated as permanent.</p>
      </section>

      <section class="onyx-command-section onyx-key-entry">
        <div>
          <p class="onyx-command-kicker">YOUR PROGRESS</p>
          <h3>How many keys have you earned?</h3>
          <p>Your claimed-key count belongs to your profile, so you add and update it yourself.</p>
        </div>
        <label>
          <span>Current keys</span>
          <input id="onyxCurrentKeysInput" type="number" min="0" max="40" inputmode="numeric" value="${value}" placeholder="0–40">
        </label>
        <button class="onyx-primary-action" id="onyxSaveKeys" type="button">Save key count</button>
        <p id="onyxKeySaveStatus" class="onyx-inline-status" aria-live="polite"></p>
      </section>

      <section class="onyx-command-section">
        <div class="onyx-section-heading">
          <div><p class="onyx-command-kicker">ROAD TO 20 KEYS</p><h3>Lowest verified Wave 1 route</h3></div>
          <span class="onyx-source-chip">90,803 sigils</span>
        </div>
        <div class="onyx-route-list">
          ${VERIFIED_ROUTE.map(item => `
            <article>
              <div><strong>${escapeHtml(item.branch)}</strong><small>Stop at ${escapeHtml(item.stop)}</small></div>
              <span>${item.keys} key${item.keys === 1 ? "" : "s"}</span>
              <b>${formatNumber(item.sigils)}</b>
            </article>
          `).join("")}
        </div>
        <p class="onyx-evidence-note">Later season releases can change the best route. Onyx will not silently carry this recommendation into another wave.</p>
      </section>
    `);
  }

  function chestBadge(chest) {
    return `
      <button class="onyx-chest-predictor ${chest.tone}" type="button" data-onyx-chest="${chest.id}">
        ${icon("chest", "onyx-chest-glyph")}
        <span><strong>${escapeHtml(chest.label)}</strong><small>${escapeHtml(chest.detail)}</small></span>
        ${icon("chevron", "onyx-chevron")}
      </button>
    `;
  }

  function renderChest() {
    return shell("Chest Command", "CHEST INTELLIGENCE", `
      <section class="onyx-source-banner limited">
        <strong>Chest-only command centre</strong>
        <p>Predictors, drop evidence and opening tools live here. Season, base and rider tools stay in their own commands.</p>
      </section>

      <section class="onyx-command-section">
        <div class="onyx-section-heading">
          <div><p class="onyx-command-kicker">LIVE PREDICTORS</p><h3>Choose a chest</h3></div>
          <span class="onyx-source-chip">Private progress</span>
        </div>
        <div class="onyx-chest-list">
          ${CHESTS.map(chestBadge).join("")}
        </div>
      </section>

      <section class="onyx-command-section">
        <p class="onyx-command-kicker">CHEST TOOLS</p>
        <h3>Plan and verify</h3>
        <div class="onyx-tool-grid">
          <button type="button" data-onyx-tool="finder">${icon("intel")}<span><strong>Reward Finder</strong><small>Search regular and bonus pools</small></span></button>
          <button type="button" data-onyx-tool="rates">${icon("chest")}<span><strong>Drop Chances</strong><small>Published event probabilities</small></span></button>
          <button type="button" data-onyx-tool="budget">${icon("calculators")}<span><strong>Chest Budget</strong><small>Openings, bonuses and estimates</small></span></button>
          <button type="button" data-onyx-tool="planner">${icon("season")}<span><strong>Opening Planner</strong><small>Plan around chosen rewards</small></span></button>
          <button type="button" data-onyx-tool="double-armory">${icon("layout")}<span><strong>Double Armoury</strong><small>When event data is available</small></span></button>
          <button type="button" data-onyx-tool="readiness">${icon("crest")}<span><strong>Data Readiness</strong><small>See what is verified or missing</small></span></button>
        </div>
      </section>
    `);
  }

  function renderRiders() {
    const catalogue = window.NoirBaseCatalog || {};
    const riders = Array.isArray(catalogue.riders) ? catalogue.riders : [];
    const skills = Array.isArray(catalogue.riderSkills) ? catalogue.riderSkills : [];
    const gear = Array.isArray(catalogue.riderGear) ? catalogue.riderGear : [];
    return shell("Rider Intelligence", "RIDER CATALOGUE", `
      <section class="onyx-source-banner verified">
        <strong>Verified rider, skill and gear catalogue</strong>
        <p>${formatNumber(riders.length)} rider names · ${formatNumber(skills.length)} skill definitions · ${formatNumber(gear.length)} gear definitions. This does not imply player ownership or a skill-to-rider association.</p>
      </section>
      <section class="onyx-command-section">
        <p class="onyx-command-kicker">SEARCH</p>
        <h3>Explore rider intelligence</h3>
        <div class="onyx-rider-filters" role="group" aria-label="Rider catalogue type">
          ${[
            ["riders", "Riders"],
            ["skills", "Skills"],
            ["gear", "Gear"]
          ].map(([value, label]) => `<button type="button" data-rider-category="${value}" class="${riderCatalogueMode === value ? "active" : ""}">${label}</button>`).join("")}
        </div>
        <input id="onyxRiderSearch" class="onyx-search" type="search" placeholder="Search this catalogue" value="${escapeHtml(riderCatalogueQuery)}" autocomplete="off">
        <div id="onyxRiderResults" class="onyx-rider-results">
          <p class="onyx-empty-state">Loading rider catalogue…</p>
        </div>
      </section>
      <section class="onyx-evidence-note onyx-rider-note">
        Onyx shows only verified catalogue fields. It does not infer which riders, levels, skills or gear belong to your account.
      </section>
    `);
  }

  function renderAtlas() {
    return shell("Atlas Command", "AUTHORISED DATA ONLY", `
      <section class="onyx-source-banner manual">
        <strong>No authorised Atlas account is connected</strong>
        <p>Onyx will not scrape, invent or expose private Atlas information. This command activates only through a player-authorised official scope.</p>
      </section>
      <section class="onyx-command-section onyx-empty-command">
        ${icon("atlas", "onyx-empty-icon")}
        <h3>Atlas intelligence is standing by</h3>
        <p>Your existing chest and season tools continue to work without Atlas access.</p>
      </section>
    `);
  }

  function renderCalculators() {
    return shell("Calculators", "PLANNING TOOLS", `
      <section class="onyx-command-section">
        <p class="onyx-command-kicker">AVAILABLE NOW</p>
        <h3>Choose a calculator</h3>
        <div class="onyx-tool-grid">
          <button type="button" data-onyx-tool="budget">${icon("calculators")}<span><strong>Ruby &amp; Chest Budget</strong><small>Opening packs and expected returns</small></span></button>
          <button type="button" data-onyx-tool="rates">${icon("chest")}<span><strong>Drop Rate Calculator</strong><small>Regular and bonus pools</small></span></button>
          <button type="button" data-onyx-tool="planner">${icon("season")}<span><strong>Reward Planner</strong><small>Compare chest choices</small></span></button>
          <button type="button" data-onyx-tool="double-armory">${icon("layout")}<span><strong>Double Armoury Planner</strong><small>Event sequence planning</small></span></button>
        </div>
      </section>
    `);
  }

  function renderMenu() {
    return shell("Command Menu", "ONYX COMMAND", `
      <section class="onyx-command-section">
        <div class="onyx-menu-list">
          <button type="button" data-onyx-view="historyView" data-title="History">${icon("intel")}<span><strong>Chest History</strong><small>Your completed private sessions</small></span></button>
          <button type="button" data-onyx-view="predictorView" data-title="Predictors">${icon("chest")}<span><strong>Data Access</strong><small>Live event and administrator controls</small></span></button>
          <button type="button" data-onyx-view="settingsView" data-title="Settings">${icon("calculators")}<span><strong>Settings</strong><small>Refresh and device controls</small></span></button>
        </div>
      </section>
    `);
  }

  function renderCommand(command) {
    if (command === "season") return renderSeason();
    if (command === "chest") return renderChest();
    if (command === "rider") return renderRiders();
    if (command === "atlas") return renderAtlas();
    if (command === "calculators") return renderCalculators();
    return renderMenu();
  }

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    overlay = document.createElement("section");
    overlay.id = OVERLAY_ID;
    overlay.className = "onyx-command-overlay";
    overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(overlay);
    return overlay;
  }

  function open(command = "menu") {
    if (command === "base") {
      window.OnyxBaseCommand?.open?.();
      return;
    }
    const requested = VALID_COMMANDS.has(command) ? command : "menu";
    const overlay = ensureOverlay();
    overlay.innerHTML = renderCommand(requested);
    hydrateIcons(overlay);
    bindOverlay(overlay, requested);
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("onyx-modal-open");
  }

  function close() {
    const overlay = document.getElementById(OVERLAY_ID);
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("onyx-modal-open");
  }

  function openTool(name) {
    close();
    if (name === "finder" || name === "budget" || name === "readiness") {
      window.NoirChestTools?.open?.(name);
    } else if (name === "rates") {
      window.ChestDropRates?.open?.();
    } else if (name === "planner") {
      window.ChestPlanner?.open?.();
    } else if (name === "double-armory") {
      window.DoubleArmoryPlanner?.open?.();
    }
  }

  function renderRiderResults(query = riderCatalogueQuery, category = riderCatalogueMode) {
    const output = document.getElementById("onyxRiderResults");
    if (!output) return;
    const catalogue = window.NoirBaseCatalog || {};
    const text = String(query || "").trim().toLowerCase();
    const collections = {
      riders: Array.isArray(catalogue.riders) ? catalogue.riders : [],
      skills: Array.isArray(catalogue.riderSkills) ? catalogue.riderSkills : [],
      gear: Array.isArray(catalogue.riderGear) ? catalogue.riderGear : []
    };
    const source = collections[category] || collections.riders;
    const matches = source
      .filter(item => !text || String(item?.name || "").toLowerCase().includes(text))
      .slice(0, 30);
    output.innerHTML = matches.length
      ? matches.map(item => `
          <article>
            <span class="onyx-catalogue-kind">${category === "riders" ? "RIDER" : category === "skills" ? "SKILL" : "GEAR"}</span>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${category === "riders"
              ? `${item.defensive ? "Defensive / perch" : "Dragon rider"}${item.tier ? ` · Tier ${formatNumber(item.tier)}` : ""}`
              : category === "skills"
                ? `Up to level ${formatNumber(item.maximumLevel)} · ${formatNumber(item.effects?.length || 0)} verified effect${item.effects?.length === 1 ? "" : "s"}`
                : `${escapeHtml(item.slotName || item.slot || "Gear")} · ${escapeHtml(item.element || "No element label")} · up to level ${formatNumber(item.maximumLevel)}`
            }</small>
            ${category === "gear" && Array.isArray(item.rarities) ? `<em>${item.rarities.map(escapeHtml).join(" · ")}</em>` : ""}
          </article>
        `).join("")
      : `<p class="onyx-empty-state">No ${category} match that search.</p>`;
  }

  function bindOverlay(overlay) {
    overlay.querySelector("[data-command-close]")?.addEventListener("click", close);
    overlay.addEventListener("click", event => {
      if (event.target === overlay) close();
    });
    overlay.querySelectorAll("[data-onyx-chest]").forEach(button => {
      button.addEventListener("click", () => {
        close();
        window.OnyxCommandCore?.openChest?.(button.dataset.onyxChest);
      });
    });
    overlay.querySelectorAll("[data-onyx-tool]").forEach(button => {
      button.addEventListener("click", () => openTool(button.dataset.onyxTool));
    });
    overlay.querySelectorAll("[data-onyx-view]").forEach(button => {
      button.addEventListener("click", () => {
        close();
        window.OnyxCommandCore?.showView?.(button.dataset.onyxView, button.dataset.title);
      });
    });
    overlay.querySelector("#onyxSaveKeys")?.addEventListener("click", async () => {
      const input = overlay.querySelector("#onyxCurrentKeysInput");
      const status = overlay.querySelector("#onyxKeySaveStatus");
      const raw = String(input?.value || "").trim();
      if (!raw) {
        commandState.currentKeys = null;
      } else {
        const count = Number(raw);
        if (!Number.isInteger(count) || count < 0 || count > 40) {
          status.textContent = "Enter a whole number from 0 to 40.";
          return;
        }
        commandState.currentKeys = count;
      }
      status.textContent = "Saving…";
      const cloudSaved = await saveCommandState();
      status.textContent = cloudSaved ? "Saved to your Onyx profile." : "Saved on this device; cloud sync is unavailable.";
    });
    overlay.querySelectorAll("[data-rider-category]").forEach(button => {
      button.addEventListener("click", () => {
        riderCatalogueMode = button.dataset.riderCategory;
        overlay.querySelectorAll("[data-rider-category]").forEach(candidate => {
          candidate.classList.toggle("active", candidate === button);
        });
        renderRiderResults();
      });
    });
    overlay.querySelector("#onyxRiderSearch")?.addEventListener("input", event => {
      riderCatalogueQuery = event.target.value;
      renderRiderResults();
    });
    if (overlay.querySelector("#onyxRiderResults")) renderRiderResults();
  }

  function bindHome() {
    document.querySelectorAll("[data-command]").forEach(button => {
      button.addEventListener("click", () => open(button.dataset.command));
    });
    document.getElementById("onyxMenuButton")?.addEventListener("click", () => open("menu"));
  }

  function install() {
    hydrateIcons();
    bindHome();
    setGreeting();
    readLocalState();
    renderKeyProgress();
    window.addEventListener("onyx:player-ready", loadCloudState);
    window.setTimeout(loadCloudState, 900);
  }

  window.OnyxCommand = Object.freeze({
    open,
    close,
    hydrateIcons,
    getState: () => ({ ...commandState })
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
