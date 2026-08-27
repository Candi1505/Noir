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

  const SEASON_PROGRESS_SLUGS = Object.freeze([
    "brickscale",
    "mission-bonus",
    "base-boost",
    "charged-volt-tower",
    "cosmic-orrery",
    "bloodstone"
  ]);
  const SEASON_KEY_LIMITS = Object.freeze({
    "brickscale": 6,
    "mission-bonus": 2,
    "base-boost": 6,
    "charged-volt-tower": 6,
    "cosmic-orrery": 2,
    "bloodstone": 3
  });
  const MYTHIC_CHOICES = new Set(["", "Patchmaw", "Smirkle"]);

  function defaultCommandState() {
    return {
      version: 2,
      currentKeys: null,
      currentSigils: null,
      seasonRelease: "misfitrise-wave-1",
      seasonTarget: 20,
      mythicChoice: "",
      branchKeys: Object.fromEntries(SEASON_PROGRESS_SLUGS.map(slug => [slug, 0]))
    };
  }

  let commandState = defaultCommandState();
  let seasonTab = "planner";
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

  function normaliseNullableInteger(value, minimum, maximum) {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.max(minimum, Math.min(maximum, Math.round(number)));
  }

  function normaliseCommandState(saved) {
    const next = defaultCommandState();
    next.currentKeys = normaliseNullableInteger(saved?.currentKeys, 0, 40);
    next.currentSigils = normaliseNullableInteger(saved?.currentSigils, 0, 100000000);
    next.mythicChoice = MYTHIC_CHOICES.has(saved?.mythicChoice)
      ? saved.mythicChoice
      : "";
    SEASON_PROGRESS_SLUGS.forEach(slug => {
      const value = Number(saved?.branchKeys?.[slug]);
      next.branchKeys[slug] = Number.isInteger(value)
        ? Math.max(0, Math.min(SEASON_KEY_LIMITS[slug], value))
        : 0;
    });
    return next;
  }

  function readLocalState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey()) || "null");
      commandState = normaliseCommandState(saved);
    } catch (error) {
      commandState = defaultCommandState();
    }
  }

  async function loadCloudState() {
    readLocalState();
    renderKeyProgress();
    const loader = window.ChestDatabase?.loadOnyxCommandState;
    if (typeof loader !== "function") return;
    try {
      const saved = await loader.call(window.ChestDatabase);
      commandState = normaliseCommandState(saved);
      localStorage.setItem(storageKey(), JSON.stringify(commandState));
      renderKeyProgress();
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

  function getSeasonRelease() {
    const release = window.OnyxSeasonData;
    return release && Array.isArray(release.branches) ? release : null;
  }

  function getSeasonPlanningBranches() {
    const release = getSeasonRelease();
    if (!release) return [];
    return SEASON_PROGRESS_SLUGS
      .map(slug => release.branches.find(branch => branch.slug === slug))
      .filter(Boolean);
  }

  function planSeasonRoute(options = {}) {
    const branches = getSeasonPlanningBranches();
    const requestedTarget = Number(options.targetKeys ?? 20);
    const targetKeys = Number.isInteger(requestedTarget)
      ? Math.max(0, Math.min(25, requestedTarget))
      : 20;
    const progress = normaliseCommandState({ branchKeys: options.branchKeys }).branchKeys;

    if (!branches.length) {
      return {
        available: false,
        targetKeys,
        claimedKeys: 0,
        plannedKeys: 0,
        additionalKeys: 0,
        additionalSigils: 0,
        reachable: false,
        selection: []
      };
    }

    const claimedKeys = branches.reduce((total, branch) => {
      return total + Math.min(branch.keyCheckpoints.length, progress[branch.slug] || 0);
    }, 0);
    const totalAvailableKeys = branches.reduce((total, branch) => {
      return total + branch.keyCheckpoints.length;
    }, 0);
    const additionalNeeded = Math.max(0, targetKeys - claimedKeys);
    const totalRemaining = Math.max(0, totalAvailableKeys - claimedKeys);
    const achievableAdditional = Math.min(additionalNeeded, totalRemaining);

    let states = new Map([[0, { cost: 0, choices: {} }]]);
    branches.forEach(branch => {
      const claimed = Math.min(branch.keyCheckpoints.length, progress[branch.slug] || 0);
      const sunkCost = claimed > 0 ? branch.keyCheckpoints[claimed - 1] : 0;
      const nextStates = new Map();
      states.forEach((state, selectedBefore) => {
        for (let added = 0; added <= branch.keyCheckpoints.length - claimed; added += 1) {
          const selected = selectedBefore + added;
          if (selected > achievableAdditional) continue;
          const stop = claimed + added;
          const incrementalCost = added > 0
            ? branch.keyCheckpoints[stop - 1] - sunkCost
            : 0;
          const candidate = {
            cost: state.cost + incrementalCost,
            choices: { ...state.choices, [branch.slug]: added }
          };
          const existing = nextStates.get(selected);
          if (!existing || candidate.cost < existing.cost) {
            nextStates.set(selected, candidate);
          }
        }
      });
      states = nextStates;
    });

    const best = states.get(achievableAdditional) || { cost: 0, choices: {} };
    const selection = branches.flatMap(branch => {
      const addedKeys = best.choices[branch.slug] || 0;
      if (!addedKeys) return [];
      const claimed = Math.min(branch.keyCheckpoints.length, progress[branch.slug] || 0);
      const stopKey = claimed + addedKeys;
      const previousCost = claimed > 0 ? branch.keyCheckpoints[claimed - 1] : 0;
      return [{
        slug: branch.slug,
        branch: branch.name,
        claimedKeys: claimed,
        addedKeys,
        stopKey,
        checkpointCost: branch.keyCheckpoints[stopKey - 1],
        sigils: branch.keyCheckpoints[stopKey - 1] - previousCost
      }];
    });

    return {
      available: true,
      targetKeys,
      claimedKeys,
      plannedKeys: claimedKeys + achievableAdditional,
      additionalKeys: achievableAdditional,
      additionalSigils: best.cost,
      reachable: claimedKeys >= targetKeys || additionalNeeded <= totalRemaining,
      selection
    };
  }

  function renderSeasonTabs() {
    const tabs = [
      ["planner", "Road to 20"],
      ["branches", "Branch Explorer"],
      ["intel", "Season Intel"]
    ];
    return `<nav class="onyx-season-tabs" role="tablist" aria-label="Season Command sections">
      ${tabs.map(([value, label]) => `<button type="button" role="tab" data-season-tab="${value}" aria-selected="${seasonTab === value}" class="${seasonTab === value ? "active" : ""}">${label}</button>`).join("")}
    </nav>`;
  }

  function renderSeasonProgressControls() {
    return `<div class="onyx-season-progress-grid">
      ${getSeasonPlanningBranches().map(branch => {
        const claimed = commandState.branchKeys[branch.slug] || 0;
        const checkpoint = claimed > 0 ? branch.keyCheckpoints[claimed - 1] : 0;
        return `<article class="onyx-season-progress-card">
          <div>
            <span>${escapeHtml(branch.type)}</span>
            <strong>${escapeHtml(branch.name)}</strong>
            <small>${claimed ? `Stopped at ${formatNumber(checkpoint)} sigils` : "No key checkpoint marked"}</small>
          </div>
          <div class="onyx-stepper" aria-label="${escapeHtml(branch.name)} claimed keys">
            <button type="button" data-season-branch="${branch.slug}" data-season-key-delta="-1" aria-label="Remove one ${escapeHtml(branch.name)} key" ${claimed === 0 ? "disabled" : ""}>−</button>
            <output>${claimed}<small>/${branch.keyCheckpoints.length}</small></output>
            <button type="button" data-season-branch="${branch.slug}" data-season-key-delta="1" aria-label="Add one ${escapeHtml(branch.name)} key" ${claimed === branch.keyCheckpoints.length ? "disabled" : ""}>+</button>
          </div>
        </article>`;
      }).join("")}
    </div>`;
  }

  function renderSeasonPlanner() {
    const plan = planSeasonRoute({ targetKeys: 20, branchKeys: commandState.branchKeys });
    const keyValue = commandState.currentKeys === null ? "" : commandState.currentKeys;
    const sigilValue = commandState.currentSigils === null ? "" : commandState.currentSigils;
    const difference = commandState.currentSigils === null
      ? null
      : commandState.currentSigils - plan.additionalSigils;
    const mismatch = commandState.currentKeys !== null && commandState.currentKeys !== plan.claimedKeys;

    return `
      <section class="onyx-season-hero-panel">
        <div class="onyx-season-orbit" style="--season-progress:${Math.min(100, (plan.claimedKeys / 20) * 100)}">
          <span><strong>${plan.claimedKeys}</strong><small>/20</small></span>
          ${icon("key", "onyx-season-orbit-key")}
        </div>
        <div>
          <p class="onyx-command-kicker">ROAD TO 20 KEYS</p>
          <h3>${plan.claimedKeys >= 20 ? "Mythic gate unlocked" : `${20 - plan.claimedKeys} planned key${20 - plan.claimedKeys === 1 ? "" : "s"} remain`}</h3>
          <p>Onyx follows only the branch checkpoints you mark. It does not infer where your keys came from.</p>
        </div>
        <div class="onyx-season-metrics">
          <article><span>Route from here</span><strong>${formatNumber(plan.additionalSigils)}</strong><small>sigils</small></article>
          <article><span>Your sigils</span><strong>${commandState.currentSigils === null ? "—" : formatNumber(commandState.currentSigils)}</strong><small>manual</small></article>
          <article class="${difference !== null && difference < 0 ? "short" : ""}"><span>${difference === null ? "Budget gap" : difference < 0 ? "Still needed" : "After route"}</span><strong>${difference === null ? "—" : formatNumber(Math.abs(difference))}</strong><small>sigils</small></article>
        </div>
      </section>

      <section class="onyx-command-section onyx-season-inputs">
        <div class="onyx-section-heading">
          <div><p class="onyx-command-kicker">YOUR SEASON STATE</p><h3>Set the command inputs</h3></div>
          <span class="onyx-source-chip">Manual · profile saved</span>
        </div>
        <div class="onyx-season-field-grid">
          <label><span>Overall keys</span><input id="onyxCurrentKeysInput" type="number" min="0" max="40" inputmode="numeric" value="${keyValue}" placeholder="0–40"><small>For your home progress ring</small></label>
          <label><span>Current sigils</span><input id="onyxCurrentSigilsInput" type="number" min="0" max="100000000" inputmode="numeric" value="${sigilValue}" placeholder="Enter balance"><small>Used only for the budget gap</small></label>
        </div>
        <div class="onyx-mythic-choice" role="group" aria-label="Mythic target">
          <span>Mythic target</span>
          ${["Patchmaw", "Smirkle"].map(name => `<button type="button" data-season-mythic="${name}" aria-pressed="${commandState.mythicChoice === name}" class="${commandState.mythicChoice === name ? "active" : ""}">${name}</button>`).join("")}
        </div>
        ${mismatch ? `<div class="onyx-season-warning"><strong>Checkpoint detail needed</strong><p>Your overall count is ${commandState.currentKeys}, but the marked branch checkpoints total ${plan.claimedKeys}. Allocate those keys below before treating the remaining cost as exact.</p></div>` : ""}
      </section>

      <section class="onyx-command-section onyx-route-command">
        <div class="onyx-section-heading">
          <div><p class="onyx-command-kicker">LOWEST VERIFIED COST</p><h3>${plan.claimedKeys ? "Your route from marked checkpoints" : "Wave 1 route from zero"}</h3></div>
          <span class="onyx-source-chip">${formatNumber(plan.additionalSigils)} sigils</span>
        </div>
        <div class="onyx-route-list">
          ${plan.selection.length ? plan.selection.map(item => `
            <article>
              <div><strong>${escapeHtml(item.branch)}</strong><small>Stop at key ${item.stopKey} · ${formatNumber(item.checkpointCost)} cumulative</small></div>
              <span>+${item.addedKeys} key${item.addedKeys === 1 ? "" : "s"}</span>
              <b>${formatNumber(item.sigils)}</b>
            </article>
          `).join("") : `<p class="onyx-empty-state">${plan.claimedKeys >= 20 ? "Your marked checkpoints already reach the 20-key gate." : "No verified route is available for this state."}</p>`}
        </div>
        <p class="onyx-evidence-note">Costs are exact to the selected key checkpoints for this release. The recommendation is recomputed whenever you change branch progress.</p>
      </section>

      <section class="onyx-command-section">
        <div class="onyx-section-heading">
          <div><p class="onyx-command-kicker">CLAIMED CHECKPOINTS</p><h3>Tap each branch to match your progress</h3></div>
          <span class="onyx-source-chip">${plan.claimedKeys}/25 marked</span>
        </div>
        ${renderSeasonProgressControls()}
      </section>
    `;
  }

  function renderSeasonBranches() {
    const release = getSeasonRelease();
    const statusLabels = {
      current: "Wave 1",
      daily: "Daily",
      mythic: "20-key gate",
      history: "Prior season"
    };
    return `<section class="onyx-command-section onyx-branch-explorer">
      <div class="onyx-section-heading">
        <div><p class="onyx-command-kicker">BRANCH EXPLORER</p><h3>Misfitrise command map</h3></div>
        <span class="onyx-source-chip">${release.branchCount} branches</span>
      </div>
      <p class="onyx-branch-intro">Tap-first reference cards show branch purpose, size, completion cost and every verified key stop without exposing the private source file.</p>
      <div class="onyx-branch-grid">
        ${release.branches.map(branch => {
          const cost = branch.completionCost === null
            ? branch.costLabel
            : branch.costLabel === "free"
              ? "Free"
              : `${formatNumber(branch.completionCost)} ${branch.costLabel}`;
          return `<article class="onyx-branch-card ${branch.status}">
            <header><span>${escapeHtml(statusLabels[branch.status] || branch.status)}</span><b>${formatNumber(branch.logicalNodes)} nodes</b></header>
            <div class="onyx-branch-name">${icon(branch.status === "mythic" ? "crest" : "season")}<div><strong>${escapeHtml(branch.name)}</strong><small>${escapeHtml(branch.type)}</small></div></div>
            <div class="onyx-branch-cost"><span>${branch.unlockKeys ? "Unlock rule" : "Completion"}</span><strong>${branch.unlockKeys ? `${branch.unlockKeys} keys` : escapeHtml(cost)}</strong></div>
            ${branch.keyCheckpoints.length ? `<div class="onyx-checkpoint-rail" aria-label="${escapeHtml(branch.name)} key checkpoints">${branch.keyCheckpoints.map((checkpoint, index) => `<span><b>${index + 1}</b>${formatNumber(checkpoint)}</span>`).join("")}</div>` : `<p class="onyx-branch-note">${branch.status === "mythic" ? `${branch.returnedKeys} keys returned later; they do not fund this branch's own unlock.` : branch.status === "daily" ? "Free daily progression · no key checkpoints." : escapeHtml(branch.costLabel)}</p>`}
          </article>`;
        }).join("")}
      </div>
    </section>`;
  }

  function renderSeasonIntel() {
    const release = getSeasonRelease();
    return `
      <section class="onyx-season-intel-hero">
        ${icon("season", "onyx-season-intel-glyph")}
        <div><p class="onyx-command-kicker">RELEASE INTELLIGENCE</p><h3>${escapeHtml(release.season)} · Wave ${release.wave}</h3><p>Verified ${escapeHtml(release.verifiedAt)}. This release is frozen so later waves cannot silently change an old plan.</p></div>
      </section>
      <section class="onyx-command-section">
        <div class="onyx-season-rule-grid">
          <article><span>01</span><strong>${release.logicalNodeCount} logical nodes</strong><p>Choice variants are collapsed so costs are not double-counted.</p></article>
          <article><span>02</span><strong>${release.preMythicKeyCount} pre-mythic keys</strong><p>Available across the six sigil branches in this release.</p></article>
          <article><span>03</span><strong>${release.mythicUnlockKeys}-key mythic gate</strong><p>Patchmaw and Smirkle each require their own unlock decision.</p></article>
          <article><span>04</span><strong>No self-funding unlock</strong><p>Keys returned inside a mythic branch do not count toward opening that same branch.</p></article>
        </div>
      </section>
      <section class="onyx-source-banner manual">
        <strong>Private source boundary</strong>
        <p>Only reviewed branch totals and checkpoints ship with Onyx. Account details, credentials and the private source file never enter the public app or player profile.</p>
      </section>
    `;
  }

  function renderSeasonSaveBar() {
    return `<section class="onyx-season-save-bar">
      <div><strong>Season command state</strong><small>Saved separately for each signed-in player.</small></div>
      <div><button type="button" id="onyxResetSeason" class="secondary">Reset</button><button type="button" id="onyxSaveSeason" class="primary">Save progress</button></div>
      <p id="onyxSeasonSaveStatus" aria-live="polite"></p>
    </section>`;
  }

  function renderSeason() {
    const release = getSeasonRelease();
    if (!release) {
      return shell("Season Command", "SEASON INTELLIGENCE", `
        <section class="onyx-source-banner limited"><strong>Season release unavailable</strong><p>Onyx could not load its reviewed season release. No route will be guessed.</p></section>
      `);
    }
    return shell("Season Command", "MISFITRISE · WAVE 1", `
      <section class="onyx-source-banner verified">
        <strong>Verified Wave 1 season graph</strong>
        <p>${release.branchCount} verified branches and ${release.logicalNodeCount} mapped nodes. Routes recalculate from your marked key checkpoints.</p>
      </section>
      ${renderSeasonTabs()}
      <div class="onyx-season-tab-panel" role="tabpanel">
        ${seasonTab === "branches" ? renderSeasonBranches() : seasonTab === "intel" ? renderSeasonIntel() : renderSeasonPlanner()}
      </div>
      ${renderSeasonSaveBar()}
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

  function readSeasonInputs(overlay, showErrors = false) {
    const status = overlay.querySelector("#onyxSeasonSaveStatus");
    const keyInput = overlay.querySelector("#onyxCurrentKeysInput");
    const sigilInput = overlay.querySelector("#onyxCurrentSigilsInput");

    if (keyInput) {
      const rawKeys = String(keyInput.value || "").trim();
      if (!rawKeys) {
        commandState.currentKeys = null;
      } else {
        const keys = Number(rawKeys);
        if (!Number.isInteger(keys) || keys < 0 || keys > 40) {
          if (showErrors && status) status.textContent = "Overall keys must be a whole number from 0 to 40.";
          return false;
        }
        commandState.currentKeys = keys;
      }
    }

    if (sigilInput) {
      const rawSigils = String(sigilInput.value || "").trim();
      if (!rawSigils) {
        commandState.currentSigils = null;
      } else {
        const sigils = Number(rawSigils);
        if (!Number.isInteger(sigils) || sigils < 0 || sigils > 100000000) {
          if (showErrors && status) status.textContent = "Current sigils must be a whole number from 0 to 100,000,000.";
          return false;
        }
        commandState.currentSigils = sigils;
      }
    }
    return true;
  }

  function refreshSeasonOverlay(overlay) {
    const scrollTop = overlay.scrollTop;
    overlay.innerHTML = renderSeason();
    hydrateIcons(overlay);
    bindOverlay(overlay);
    overlay.scrollTop = scrollTop;
  }

  function bindOverlay(overlay) {
    overlay.querySelector("[data-command-close]")?.addEventListener("click", close);
    if (overlay.dataset.onyxDelegated !== "true") {
      overlay.addEventListener("click", event => {
        if (event.target === overlay) close();
      });
      overlay.dataset.onyxDelegated = "true";
    }
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
    overlay.querySelectorAll("[data-season-tab]").forEach(button => {
      button.addEventListener("click", () => {
        readSeasonInputs(overlay);
        seasonTab = button.dataset.seasonTab;
        refreshSeasonOverlay(overlay);
      });
    });
    overlay.querySelectorAll("[data-season-mythic]").forEach(button => {
      button.addEventListener("click", () => {
        readSeasonInputs(overlay);
        commandState.mythicChoice = commandState.mythicChoice === button.dataset.seasonMythic
          ? ""
          : button.dataset.seasonMythic;
        refreshSeasonOverlay(overlay);
      });
    });
    overlay.querySelectorAll("[data-season-key-delta]").forEach(button => {
      button.addEventListener("click", () => {
        readSeasonInputs(overlay);
        const slug = button.dataset.seasonBranch;
        const delta = Number(button.dataset.seasonKeyDelta);
        if (!SEASON_PROGRESS_SLUGS.includes(slug) || !Number.isInteger(delta)) return;
        commandState.branchKeys[slug] = Math.max(
          0,
          Math.min(SEASON_KEY_LIMITS[slug], commandState.branchKeys[slug] + delta)
        );
        refreshSeasonOverlay(overlay);
      });
    });
    overlay.querySelector("#onyxSaveSeason")?.addEventListener("click", async () => {
      const status = overlay.querySelector("#onyxSeasonSaveStatus");
      if (!readSeasonInputs(overlay, true)) return;
      status.textContent = "Saving season command…";
      const cloudSaved = await saveCommandState();
      status.textContent = cloudSaved
        ? "Saved to your Onyx profile."
        : "Saved on this device; cloud sync is unavailable.";
    });
    overlay.querySelector("#onyxResetSeason")?.addEventListener("click", async () => {
      const approved = typeof window.confirm !== "function"
        || window.confirm("Reset all saved Misfitrise key, sigil and branch progress?");
      if (!approved) return;
      commandState = defaultCommandState();
      await saveCommandState();
      seasonTab = "planner";
      refreshSeasonOverlay(overlay);
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
    getState: () => JSON.parse(JSON.stringify(commandState)),
    getSeasonRelease,
    planSeasonRoute,
    normaliseCommandState
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})();
