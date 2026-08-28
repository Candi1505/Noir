(() => {
  "use strict";

  const OVERLAY_ID = "onyxAtlasCommandOverlay";
  const STORAGE_PREFIX = "onyxAtlasManualV1";
  const MODE_PREFIX = "onyxAtlasModeV1";
  const VALID_MODES = new Set(["live", "demo", "manual"]);
  const VALID_TABS = new Set(["overview", "hunter", "battles", "castles", "team", "entry"]);
  const VALID_LIVE_FILTERS = new Set(["vulnerable", "cooldown", "dropping", "shielded", "all"]);
  const LIVE_SHIELD_STATES = new Set(["vulnerable", "cooldown", "dropping", "shielded", "unknown"]);
  const MEMBER_STATUSES = new Set(["ready", "watch", "support"]);
  const CASTLE_STATUSES = new Set(["clear", "watch", "contested"]);
  const BATTLE_SIDES = new Set(["attack", "defence"]);
  const BATTLE_RESULTS = new Set(["win", "loss", "logged"]);

  const ICONS = Object.freeze({
    atlas: `<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="23"/><path d="M9 32h46M32 9c8 8 12 15 12 23S40 47 32 55M32 9c-8 8-12 15-12 23s4 15 12 23M16 18c9 5 23 5 32 0M16 46c9-5 23-5 32 0"/><path class="fill" d="m32 24 5 8-5 8-5-8Z"/></svg>`,
    close: `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m11 11 26 26M37 11 11 37"/></svg>`,
    overview: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V9l8-5 8 5v11M8 20v-6h8v6M3 20h18"/></svg>`,
    battles: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 4 14 16M19 4 5 20M7 3l-3 1 1 3M17 3l3 1-1 3M7 21l-3-1 1-3M17 21l3-1-1-3"/></svg>`,
    castle: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 21V8l4 2V5l4 2 4-2v5l4-2v13M3 21h18M9 21v-6h6v6"/></svg>`,
    team: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="8" cy="9" r="3"/><circle cx="17" cy="8" r="2.5"/><path d="M2.5 20c.4-5 2.2-7 5.5-7s5.1 2 5.5 7M14 13c4.4-.8 6.6 1.4 7 6"/></svg>`,
    edit: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m4 16-1 5 5-1L20 8l-4-4ZM14 6l4 4M4 16l4 4"/></svg>`,
    shield: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.6-2.9 8-7 10-4.1-2-7-5.4-7-10V6Z"/><path d="M9 12h6M12 9v6"/></svg>`,
    fleet: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17h18l-3 4H6ZM6 17V8h12v9M9 8V4h6v4M3 13h3m12 0h3"/></svg>`,
    alert: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 10 18H2ZM12 9v5m0 3v1"/></svg>`,
    link: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14 8 16a4 4 0 1 1-6-6l4-4a4 4 0 0 1 6 0M14 10l2-2a4 4 0 1 1 6 6l-4 4a4 4 0 0 1-6 0M8 12h8"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>`,
    refresh: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 7v5h-5M4 17v-5h5M6.1 8.2A7 7 0 0 1 18.8 9M5.2 15A7 7 0 0 0 17.9 15.8"/></svg>`,
    lock: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg>`,
    plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v16M4 12h16"/></svg>`,
    trash: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 3h6l1 4H8ZM7 7l1 14h8l1-14M10 11v6m4-6v6"/></svg>`
  });

  const DEMO_STATE = Object.freeze({
    version: 1,
    team: Object.freeze({
      name: "Obsidian Watch",
      alliance: "Nightglass Accord",
      totalTroops: 1842500,
      monthlyGold: 728400,
      monthlyMaterials: 413700,
      monthlyPrims: 286,
      eventScore: 148250
    }),
    members: Object.freeze([
      Object.freeze({ id: "demo-vesper", name: "Vesper", troops: 428000, gold: 192400, materials: 114800, prims: 82, status: "ready" }),
      Object.freeze({ id: "demo-rook", name: "Rook", troops: 396500, gold: 166200, materials: 96200, prims: 61, status: "ready" }),
      Object.freeze({ id: "demo-sable", name: "Sable", troops: 362000, gold: 148600, materials: 88400, prims: 57, status: "watch" }),
      Object.freeze({ id: "demo-aster", name: "Aster", troops: 341000, gold: 125300, materials: 73600, prims: 49, status: "ready" }),
      Object.freeze({ id: "demo-flint", name: "Flint", troops: 315000, gold: 95900, materials: 40700, prims: 37, status: "support" })
    ]),
    castles: Object.freeze([
      Object.freeze({ id: "DEMO-A1", name: "Crownfall", owner: "Obsidian Watch", level: 6, troops: 712000, fleets: 4, shieldHours: 6.5, status: "clear" }),
      Object.freeze({ id: "DEMO-B4", name: "Ember Reach", owner: "Obsidian Watch", level: 5, troops: 486000, fleets: 3, shieldHours: 1.4, status: "watch" }),
      Object.freeze({ id: "DEMO-C7", name: "Northglass Keep", owner: "Obsidian Watch", level: 4, troops: 318000, fleets: 2, shieldHours: 0, status: "contested" })
    ]),
    battles: Object.freeze([
      Object.freeze({ id: "demo-battle-1", when: "18 min ago", side: "defence", result: "win", opponent: "Ash Meridian", primarch: "Destroyer", primarchLevel: 14, destruction: 38, glory: 18420, primsLost: 26 }),
      Object.freeze({ id: "demo-battle-2", when: "46 min ago", side: "attack", result: "win", opponent: "Silver Quarry", primarch: "Taunter", primarchLevel: 11, destruction: 100, glory: 26750, primsLost: 41 }),
      Object.freeze({ id: "demo-battle-3", when: "2 hr ago", side: "defence", result: "loss", opponent: "Hollow Crown", primarch: "Trapper", primarchLevel: 12, destruction: 84, glory: 11200, primsLost: 73 })
    ]),
    updatedAt: "Synthetic scenario"
  });

  let activeMode = "live";
  let activeTab = "overview";
  let liveFilter = "vulnerable";
  let liveCastles = [];
  let liveFetchedAt = null;
  let liveSource = "War Dragons API";
  let liveConnection = Object.freeze({
    phase: "checking",
    connected: false,
    readyToAuthorise: false,
    reviewStatus: "pending_review",
    playerId: null,
    scopes: [],
    connectedAt: null,
    lastVerifiedAt: null,
    message: "Checking the secure War Dragons connection."
  });
  let manualSaved = null;
  let manualDraft = emptyManualState();
  let manualDirty = false;
  let lastFocused = null;
  let openedForUser = null;
  let notice = "";

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function icon(name, className = "") {
    return `<span class="oac-icon ${escapeHtml(className)}">${ICONS[name] || ICONS.atlas}</span>`;
  }

  function cleanText(value, maximum = 80) {
    return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, maximum);
  }

  function cleanId(value, fallback = "") {
    return cleanText(value, 48).replace(/[^a-zA-Z0-9._-]/g, "-") || fallback;
  }

  function cleanNumber(value, maximum = 999999999999) {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.min(maximum, Math.max(0, Math.round(number)));
  }

  function cleanDecimal(value, maximum = 999999) {
    if (value === "" || value === null || value === undefined) return null;
    const number = Number(value);
    if (!Number.isFinite(number)) return null;
    return Math.min(maximum, Math.max(0, Math.round(number * 10) / 10));
  }

  function emptyManualState() {
    return {
      version: 1,
      team: {
        name: "",
        alliance: "",
        totalTroops: null,
        monthlyGold: null,
        monthlyMaterials: null,
        monthlyPrims: null,
        eventScore: null
      },
      members: [],
      castles: [],
      battles: [],
      updatedAt: null
    };
  }

  function emptyLiveState() {
    return {
      version: 1,
      team: {
        name: "Live Atlas",
        alliance: "Source-labelled Atlas intelligence",
        totalTroops: null,
        monthlyGold: null,
        monthlyMaterials: null,
        monthlyPrims: null,
        eventScore: null
      },
      members: [],
      castles: liveCastles,
      battles: [],
      updatedAt: liveFetchedAt
    };
  }

  function normaliseLiveCastle(value, index) {
    const source = value && typeof value === "object" ? value : {};
    const name = cleanText(source.name, 70);
    if (!name) return null;
    const shieldState = LIVE_SHIELD_STATES.has(source.shieldState)
      ? source.shieldState
      : "unknown";
    return {
      id: cleanId(source.id, `official-castle-${index + 1}`),
      name,
      owner: cleanText(source.owner, 70),
      region: cleanText(source.region, 70),
      level: cleanNumber(source.level, 999),
      troops: cleanNumber(source.troops),
      fleets: cleanNumber(source.fleets, 99999),
      shieldState,
      shieldEndsAt: cleanText(source.shieldEndsAt, 64) || null,
      cooldownEndsAt: cleanText(source.cooldownEndsAt, 64) || null,
      attackable: source.attackable === true,
      source: source.source === "War Dragons API" ? "War Dragons API" : "Atlas capture"
    };
  }

  function normaliseLiveSnapshot(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      castles: (Array.isArray(source.castles) ? source.castles : [])
        .slice(0, 50000)
        .map(normaliseLiveCastle)
        .filter(Boolean),
      fetchedAt: cleanText(source.fetchedAt, 64) || null,
      source: source.source === "War Dragons API"
        ? "War Dragons API"
        : source.source === "Mixed Atlas sources"
          ? "Mixed Atlas sources"
          : "Atlas capture"
    };
  }

  function normaliseMember(value, index) {
    const source = value && typeof value === "object" ? value : {};
    const name = cleanText(source.name, 60);
    if (!name) return null;
    return {
      id: cleanId(source.id, `member-${index + 1}`),
      name,
      troops: cleanNumber(source.troops),
      gold: cleanNumber(source.gold),
      materials: cleanNumber(source.materials),
      prims: cleanNumber(source.prims ?? source.ships, 9999999),
      status: MEMBER_STATUSES.has(source.status) ? source.status : "ready"
    };
  }

  function normaliseCastle(value, index) {
    const source = value && typeof value === "object" ? value : {};
    const name = cleanText(source.name, 70);
    if (!name) return null;
    return {
      id: cleanId(source.id, `manual-castle-${index + 1}`),
      name,
      owner: cleanText(source.owner, 70),
      level: cleanNumber(source.level, 999),
      troops: cleanNumber(source.troops),
      fleets: cleanNumber(source.fleets, 99999),
      shieldHours: cleanDecimal(source.shieldHours, 9999),
      status: CASTLE_STATUSES.has(source.status) ? source.status : "clear"
    };
  }

  function normaliseBattle(value, index) {
    const source = value && typeof value === "object" ? value : {};
    const opponent = cleanText(source.opponent, 70);
    if (!opponent) return null;
    return {
      id: cleanId(source.id, `manual-battle-${index + 1}`),
      when: cleanText(source.when, 40) || "Manually logged",
      side: BATTLE_SIDES.has(source.side) ? source.side : "defence",
      result: BATTLE_RESULTS.has(source.result) ? source.result : "logged",
      opponent,
      primarch: cleanText(source.primarch, 60),
      primarchLevel: cleanNumber(source.primarchLevel, 999),
      destruction: cleanNumber(source.destruction, 100),
      glory: cleanNumber(source.glory ?? source.xp),
      primsLost: cleanNumber(source.primsLost ?? source.shipsLost, 9999999)
    };
  }

  function normaliseManualState(value) {
    const source = value && typeof value === "object" ? value : {};
    const team = source.team && typeof source.team === "object" ? source.team : {};
    return {
      version: 1,
      team: {
        name: cleanText(team.name, 70),
        alliance: cleanText(team.alliance, 70),
        totalTroops: cleanNumber(team.totalTroops),
        monthlyGold: cleanNumber(team.monthlyGold),
        monthlyMaterials: cleanNumber(team.monthlyMaterials),
        monthlyPrims: cleanNumber(team.monthlyPrims ?? team.monthlyShips, 9999999),
        eventScore: cleanNumber(team.eventScore)
      },
      members: (Array.isArray(source.members) ? source.members : []).slice(0, 100).map(normaliseMember).filter(Boolean),
      castles: (Array.isArray(source.castles) ? source.castles : []).slice(0, 100).map(normaliseCastle).filter(Boolean),
      battles: (Array.isArray(source.battles) ? source.battles : []).slice(0, 200).map(normaliseBattle).filter(Boolean),
      updatedAt: cleanText(source.updatedAt, 40) || null
    };
  }

  function userId() {
    return window.OnyxCommandCore?.getCurrentUserId?.() || null;
  }

  function storageKey(prefix) {
    const id = userId();
    return id ? `${prefix}:${id}` : "";
  }

  function readLocal() {
    try {
      const stateKey = storageKey(STORAGE_PREFIX);
      const modeKey = storageKey(MODE_PREFIX);
      const saved = stateKey ? localStorage.getItem(stateKey) : null;
      manualSaved = saved ? normaliseManualState(JSON.parse(saved)) : null;
      manualDraft = clone(manualSaved || emptyManualState());
      const mode = modeKey ? localStorage.getItem(modeKey) : null;
      activeMode = VALID_MODES.has(mode) ? mode : "live";
    } catch (_error) {
      manualSaved = null;
      manualDraft = emptyManualState();
      activeMode = "live";
    }
    manualDirty = false;
  }

  function writeMode() {
    try {
      const key = storageKey(MODE_PREFIX);
      if (key) localStorage.setItem(key, activeMode);
    } catch (_error) {
      // Mode preference is optional.
    }
  }

  function saveManual() {
    const next = normaliseManualState(manualDraft);
    next.updatedAt = new Date().toISOString();
    const key = storageKey(STORAGE_PREFIX);
    if (!key) {
      notice = "Sign in again before saving this private Atlas snapshot.";
      return;
    }
    localStorage.setItem(key, JSON.stringify(next));
    manualSaved = clone(next);
    manualDraft = clone(next);
    manualDirty = false;
    notice = "Manual Atlas snapshot saved for this Onyx profile on this device.";
  }

  function currentState() {
    if (activeMode === "live") return clone(emptyLiveState());
    return activeMode === "demo" ? clone(DEMO_STATE) : clone(manualDraft);
  }

  function hasManualData(state = manualDraft) {
    return Boolean(
      state.team?.name
      || state.team?.alliance
      || state.members?.length
      || state.castles?.length
      || state.battles?.length
      || Object.entries(state.team || {}).some(([key, value]) => key !== "name" && key !== "alliance" && value !== null)
    );
  }

  function formatNumber(value, fallback = "—") {
    return value === null || value === undefined || value === ""
      ? fallback
      : new Intl.NumberFormat("en-AU").format(Number(value) || 0);
  }

  function formatCompact(value) {
    if (value === null || value === undefined || value === "") return "—";
    return new Intl.NumberFormat("en-AU", { notation: "compact", maximumFractionDigits: 1 }).format(Number(value) || 0);
  }

  function statusLabel(value) {
    return {
      ready: "Ready",
      watch: "Watch",
      support: "Support",
      clear: "Clear",
      contested: "Contested",
      win: "Won",
      loss: "Lost",
      logged: "Logged",
      attack: "Attack",
      defence: "Defence"
    }[value] || "Logged";
  }

  function deriveAlerts(input) {
    const state = normaliseManualState(input);
    const alerts = [];
    state.castles.forEach(castle => {
      if (castle.shieldHours !== null && castle.shieldHours > 0 && castle.shieldHours <= 2) {
        alerts.push({
          level: "gold",
          title: `${castle.name} shield window`,
          detail: `${castle.shieldHours.toFixed(1)} hours remain in the recorded shield window.`
        });
      }
      if (castle.shieldHours === 0 && (castle.troops || 0) > 0) {
        alerts.push({
          level: "violet",
          title: `${castle.name} is recorded unshielded`,
          detail: `${formatNumber(castle.troops)} stationed troops are in the current snapshot.`
        });
      }
      if (castle.status === "watch") {
        alerts.push({
          level: "blue",
          title: `${castle.name} is on watch`,
          detail: "This is a manually marked watch condition; Onyx is not inferring hostile intent."
        });
      }
      if (castle.status === "contested") {
        alerts.push({
          level: "red",
          title: `${castle.name} is marked contested`,
          detail: "Review the recorded castle state before acting."
        });
      }
    });
    state.members.filter(member => member.status === "support").forEach(member => {
      alerts.push({
        level: "blue",
        title: `${member.name} is marked for support`,
        detail: `${formatNumber(member.troops)} troops are recorded in the current team snapshot.`
      });
    });
    return alerts.slice(0, 8);
  }

  function commandCondition(state) {
    if (!hasManualData(state)) return { label: "Awaiting intel", tone: "idle", detail: "Add a manual snapshot to activate the command board." };
    const alerts = deriveAlerts(state);
    if (alerts.some(alert => alert.level === "red")) return { label: "Action watch", tone: "alert", detail: "A recorded contested condition needs review." };
    if (alerts.length) return { label: "Watch active", tone: "watch", detail: `${alerts.length} recorded condition${alerts.length === 1 ? "" : "s"} on the board.` };
    return { label: "Board clear", tone: "clear", detail: "No watch conditions are present in this snapshot." };
  }

  function metricCard(label, value, detail, iconName) {
    return `<article class="oac-metric-card">
      ${icon(iconName)}
      <div><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong><span>${escapeHtml(detail)}</span></div>
    </article>`;
  }

  function sourceBanner() {
    if (activeMode === "live") {
      const connected = liveConnection.connected === true;
      const captureOnly = liveCastles.length > 0 && liveSource === "Atlas capture";
      const mixed = liveCastles.length > 0 && liveSource === "Mixed Atlas sources";
      return `<section class="oac-source-banner live ${connected ? "connected" : "pending"}">
        <span>${captureOnly ? "PRIVATE ATLAS CAPTURE" : mixed ? "MIXED ATLAS SOURCES" : connected ? "OFFICIAL PLAYER-AUTHORISED INTELLIGENCE" : "LIVE ATLAS FOUNDATION"}</span>
        <p>${escapeHtml(captureOnly
          ? "This board is based on the private capture loaded on this device."
          : mixed
            ? "Officially refreshed records and capture-only records are labelled separately."
            : connected
              ? "This workspace accepts only sanitised, read-only fields returned through the secure Onyx gateway."
          : liveConnection.message || "War Dragons multi-player API review is pending.")}</p>
      </section>`;
    }
    if (activeMode === "demo") {
      return `<section class="oac-source-banner demo">
        <span>FICTIONAL DEMO INTELLIGENCE</span>
        <p>Explore every Atlas workspace with an original synthetic scenario. No player or team data is shown.</p>
      </section>`;
    }
    return `<section class="oac-source-banner manual">
      <span>PRIVATE MANUAL SNAPSHOT</span>
      <p>${manualSaved ? "Your saved snapshot is loaded for this Onyx profile on this device." : "Nothing is connected. Enter only the Atlas details you choose to track."}</p>
    </section>`;
  }

  function renderModeRail() {
    const modeTitle = activeMode === "live"
      ? liveSource === "War Dragons API"
        ? "Official castle watch"
        : liveSource === "Mixed Atlas sources"
          ? "Mixed-source castle watch"
          : "Captured castle watch"
      : activeMode === "demo"
        ? "Command simulation"
        : "Manual command board";
    return `<section class="oac-mode-rail" aria-label="Atlas data mode">
      <div>
        <p>INTELLIGENCE MODE</p>
        <h3>${modeTitle}</h3>
      </div>
      <div class="oac-mode-switch" role="group" aria-label="Choose Atlas intelligence mode">
        <button type="button" data-oac-mode="live" class="${activeMode === "live" ? "active" : ""}" aria-pressed="${activeMode === "live"}">Live</button>
        <button type="button" data-oac-mode="demo" class="${activeMode === "demo" ? "active" : ""}" aria-pressed="${activeMode === "demo"}">Demo</button>
        <button type="button" data-oac-mode="manual" class="${activeMode === "manual" ? "active" : ""}" aria-pressed="${activeMode === "manual"}">Manual</button>
      </div>
    </section>`;
  }

  function renderTabs() {
    const tabs = [
      ["overview", "overview", "Overview"],
      ["battles", "battles", "Battles"],
      ["castles", "castle", "Castles"],
      ["team", "team", "Team"]
    ];
    if (activeMode === "live") tabs.splice(1, 0, ["hunter", "castle", "Hunter"]);
    if (activeMode === "manual") tabs.push(["entry", "edit", "Enter intel"]);
    return `<nav class="oac-tabs" role="tablist" aria-label="Atlas Command workspaces">
      ${tabs.map(([tab, iconName, label]) => `<button type="button" role="tab" data-oac-tab="${tab}" aria-selected="${activeTab === tab}" class="${activeTab === tab ? "active" : ""}">${icon(iconName)}<span>${label}</span></button>`).join("")}
    </nav>`;
  }

  function formatLiveTime(value, fallback = "Timing unavailable") {
    if (!value) return fallback;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return fallback;
    return date.toLocaleString("en-AU", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit"
    });
  }

  function liveShieldLabel(castle) {
    return {
      vulnerable: "Vulnerable now",
      cooldown: "Shield cooldown",
      dropping: "Shield dropping soon",
      shielded: "Shielded",
      unknown: "Shield state unavailable"
    }[castle?.shieldState] || "Shield state unavailable";
  }

  function liveShieldDetail(castle) {
    const official =
      castle?.source === "War Dragons API";
    if (castle?.shieldState === "cooldown") {
      return castle.cooldownEndsAt
        ? `Cooldown ends ${formatLiveTime(castle.cooldownEndsAt)}`
        : official
          ? "Official cooldown state; end time was not supplied."
          : "Captured cooldown state; end time was not supplied.";
    }
    if (["dropping", "shielded"].includes(castle?.shieldState)) {
      return castle.shieldEndsAt
        ? `Shield ends ${formatLiveTime(castle.shieldEndsAt)}`
        : official
          ? "Official shield state; end time was not supplied."
          : "Captured shield state; end time was not supplied.";
    }
    if (castle?.shieldState === "vulnerable") {
      return official && castle.attackable
        ? "Officially reported unshielded and attackable."
        : official
          ? "Officially reported unshielded; attackability was not confirmed."
          : "Captured as unshielded; attackability was not confirmed.";
    }
    return official
      ? "Onyx will not infer a missing official shield state."
      : "No shield state was present in the capture.";
  }

  function liveCounts() {
    return liveCastles.reduce((counts, castle) => {
      counts.all += 1;
      if (Object.hasOwn(counts, castle.shieldState)) counts[castle.shieldState] += 1;
      return counts;
    }, { vulnerable: 0, cooldown: 0, dropping: 0, shielded: 0, unknown: 0, all: 0 });
  }

  function filteredLiveCastles() {
    const castles = liveFilter === "all"
      ? [...liveCastles]
      : liveCastles.filter(castle => castle.shieldState === liveFilter);
    return castles.sort((left, right) => left.name.localeCompare(right.name));
  }

  function renderLiveFilterRail() {
    const counts = liveCounts();
    const filters = [
      ["vulnerable", "Vulnerable", counts.vulnerable],
      ["cooldown", "Cooldown", counts.cooldown],
      ["dropping", "Dropping soon", counts.dropping],
      ["shielded", "Shielded", counts.shielded],
      ["all", "All castles", counts.all]
    ];
    return `<div class="oac-live-filters" role="group" aria-label="Filter Atlas castles by shield state">
      ${filters.map(([value, label, count]) => `<button type="button" data-oac-live-filter="${value}" class="${liveFilter === value ? "active" : ""}" aria-pressed="${liveFilter === value}"><span>${escapeHtml(label)}</span><b>${count}</b></button>`).join("")}
    </div>`;
  }

  function renderLiveLockedState() {
    if (liveConnection.connected) {
      return `<section class="oac-live-locked connected-empty">
        <div class="oac-live-lock-orbit">${icon("shield")}</div>
        <p>OFFICIAL LINK ACTIVE</p>
        <h3>Awaiting verified castle fields</h3>
        <span>Your account is connected. Onyx will populate this board only after the official castle response shape has been reviewed and mapped.</span>
        <button type="button" data-oac-refresh-connection>${icon("refresh")} Refresh status</button>
      </section>`;
    }
    const pending = liveConnection.reviewStatus !== "ready";
    return `<section class="oac-live-locked">
      <div class="oac-live-lock-orbit">${icon(pending ? "clock" : "lock")}</div>
      <p>${pending ? "APPLICATION REVIEW" : "PLAYER AUTHORISATION"}</p>
      <h3>${pending ? "Live castle intelligence is being prepared" : "Connect your War Dragons account"}</h3>
      <span>${pending
        ? "The secure multi-player foundation is ready. Live castle fields stay locked until War Dragons approves the application."
        : "Authorise read-only access to activate your official castle watchboard. Your account credentials remain with War Dragons."}</span>
      ${pending
        ? `<button type="button" disabled>Approval pending</button>`
        : `<button type="button" data-oac-connect>${icon("link")} Authorise War Dragons</button>`}
    </section>`;
  }

  function renderLivePreview() {
    if (!liveCastles.length) {
      return renderLiveLockedState();
    }
    const castles = liveCastles.slice(0, 4);
    return `<section class="oac-live-preview">
      ${castles.map(castle => `<article class="${escapeHtml(castle.shieldState)}">
        ${icon(castle.shieldState === "cooldown" || castle.shieldState === "dropping" ? "clock" : "shield")}
        <div><small>${escapeHtml(liveShieldLabel(castle))} · ${escapeHtml(castle.source)}</small><strong>${escapeHtml(castle.name)}</strong><span>${escapeHtml(castle.owner || "Owner not supplied")}</span></div>
      </article>`).join("")}
    </section>`;
  }

  function renderNetwork(state) {
    if (activeMode === "live") {
      const signalLabel = liveSource === "War Dragons API"
        ? "OFFICIAL CASTLE SIGNAL"
        : liveSource === "Mixed Atlas sources"
          ? "MIXED CASTLE SIGNAL"
          : "CAPTURED CASTLE SIGNAL";
      return `<section class="oac-network-card oac-live-network-card">
        <div class="oac-section-heading">
          <div><p>${signalLabel}</p><h3>Live target board</h3></div>
          <span>${liveCastles.length} source-labelled</span>
        </div>
        ${renderLiveFilterRail()}
        ${renderLivePreview()}
      </section>`;
    }
    const points = [
      { x: 19, y: 68 },
      { x: 42, y: 28 },
      { x: 68, y: 58 },
      { x: 84, y: 24 }
    ];
    const castles = state.castles.slice(0, 4);
    return `<section class="oac-network-card">
      <div class="oac-section-heading">
        <div><p>TACTICAL NETWORK</p><h3>Castle watchboard</h3></div>
        <span>${castles.length} tracked</span>
      </div>
      <div class="oac-network-map ${castles.length ? "" : "empty"}">
        <svg viewBox="0 0 100 78" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="oacRouteGlow" x1="0" x2="1"><stop offset="0" stop-color="#d9b252" stop-opacity=".2"/><stop offset=".55" stop-color="#9a5cf2" stop-opacity=".9"/><stop offset="1" stop-color="#6fbce4" stop-opacity=".35"/></linearGradient>
            <filter id="oacSoftGlow"><feGaussianBlur stdDeviation="1.6"/></filter>
          </defs>
          <path class="oac-route-blur" d="M12 69C26 70 24 29 42 28S55 66 68 58 69 23 88 23"/>
          <path class="oac-route" d="M12 69C26 70 24 29 42 28S55 66 68 58 69 23 88 23"/>
          <path class="oac-route-dash" d="M12 69C26 70 24 29 42 28S55 66 68 58 69 23 88 23"/>
        </svg>
        ${castles.length ? castles.map((castle, index) => {
          const point = points[index];
          return `<button type="button" data-oac-castle-jump="${index}" class="oac-network-node ${escapeHtml(castle.status)}" style="--x:${point.x}%;--y:${point.y}%">
            <i>${icon("castle")}</i>
            <span><strong>${escapeHtml(castle.name)}</strong><small>${castle.shieldHours === null ? "Shield not recorded" : castle.shieldHours > 0 ? `${castle.shieldHours.toFixed(1)}h shield` : "Unshielded"}</small></span>
          </button>`;
        }).join("") : `<div class="oac-network-empty">${icon("castle")}<strong>No castles recorded</strong><span>Open Enter intel to build your private watchboard.</span></div>`}
      </div>
    </section>`;
  }

  function renderAlerts(state) {
    const alerts = deriveAlerts(state);
    return `<section class="oac-alerts-card">
      <div class="oac-section-heading">
        <div><p>WATCH CONDITIONS</p><h3>Command alerts</h3></div>
        <span>${alerts.length || "Clear"}</span>
      </div>
      <div class="oac-alert-list">
        ${alerts.length ? alerts.map(alert => `<article class="${escapeHtml(alert.level)}">
          ${icon("alert")}<div><strong>${escapeHtml(alert.title)}</strong><p>${escapeHtml(alert.detail)}</p></div>
        </article>`).join("") : `<div class="oac-clear-state">${icon("shield")}<div><strong>No recorded watch conditions</strong><p>Onyx only flags conditions supported by this snapshot.</p></div></div>`}
      </div>
    </section>`;
  }

  function renderConnectionCard() {
    const connected = liveConnection.connected === true;
    const pending = liveConnection.reviewStatus !== "ready";
    const phaseLabel = connected
      ? "Securely connected"
      : pending
        ? "Approval pending"
        : liveConnection.phase === "checking" || liveConnection.phase === "working"
          ? "Checking connection"
          : "Ready to authorise";
    return `<section class="oac-connection-card">
      <div class="oac-connection-mark">${icon("link")}</div>
      <div>
        <p>PLAYER-AUTHORISED LINK</p>
        <h3>Official Atlas connection</h3>
        <span>${escapeHtml(phaseLabel)}</span>
        <p>${escapeHtml(liveConnection.message || "Onyx is checking the secure connection.")}</p>
      </div>
      <div class="oac-connection-actions">
        <div class="oac-scope-list"><span>atlas.read</span><span>player.public.read</span></div>
        ${connected
          ? `<button type="button" data-oac-disconnect>Disconnect</button>`
          : pending
            ? `<button type="button" disabled>Review pending</button>`
            : `<button type="button" data-oac-connect>Authorise</button>`}
        <button type="button" class="secondary" data-oac-refresh-connection aria-label="Refresh connection status">${icon("refresh")} Refresh status</button>
      </div>
    </section>`;
  }

  function renderLiveOverview() {
    const counts = liveCounts();
    const condition = counts.all
      ? { tone: "clear", label: liveSource === "War Dragons API" ? "Official data loaded" : liveSource === "Mixed Atlas sources" ? "Mixed sources loaded" : "Capture loaded", detail: `${counts.all} source-labelled castle${counts.all === 1 ? "" : "s"} on the board.` }
      : liveConnection.connected
        ? { tone: "clear", label: "Official link active", detail: "Awaiting verified castle data." }
      : { tone: "idle", label: liveConnection.reviewStatus === "ready" ? "Authorisation needed" : "Application review", detail: "No live castle state is shown until the secure official link is active." };
    return `<div class="oac-workspace" role="tabpanel">
      <section class="oac-hero ${condition.tone}">
        <div class="oac-hero-copy">
          <p>ATLAS OPERATIONS</p>
          <h2>Live castle watch</h2>
          <span>Source-labelled shield intelligence, separated from demo and manual records.</span>
        </div>
        <div class="oac-condition"><i></i><div><small>COMMAND CONDITION</small><strong>${escapeHtml(condition.label)}</strong><span>${escapeHtml(condition.detail)}</span></div></div>
      </section>
      <section class="oac-metric-grid">
        ${metricCard("VULNERABLE NOW", formatNumber(counts.vulnerable), "Reported by named source", "alert")}
        ${metricCard("SHIELD COOLDOWN", formatNumber(counts.cooldown), "No guessed timers", "clock")}
        ${metricCard("DROPPING SOON", formatNumber(counts.dropping), "Source-reported window", "clock")}
        ${metricCard("SHIELDED", formatNumber(counts.shielded), "Currently protected", "shield")}
      </section>
      ${renderNetwork(emptyLiveState())}
      ${renderConnectionCard()}
    </div>`;
  }

  function renderOverview(state) {
    if (activeMode === "live") return renderLiveOverview();
    const condition = commandCondition(state);
    return `<div class="oac-workspace" role="tabpanel">
      <section class="oac-hero ${condition.tone}">
        <div class="oac-hero-copy">
          <p>ATLAS OPERATIONS</p>
          <h2>${escapeHtml(state.team.name || "Unassigned command")}</h2>
          <span>${escapeHtml(state.team.alliance || (activeMode === "demo" ? "Synthetic alliance" : "Add a team and alliance to begin"))}</span>
        </div>
        <div class="oac-condition"><i></i><div><small>COMMAND CONDITION</small><strong>${escapeHtml(condition.label)}</strong><span>${escapeHtml(condition.detail)}</span></div></div>
      </section>
      <section class="oac-metric-grid">
        ${metricCard("TOTAL TROOPS", formatCompact(state.team.totalTroops), "Current snapshot", "team")}
        ${metricCard("MONTHLY GOLD", formatCompact(state.team.monthlyGold), "Recorded contribution", "castle")}
        ${metricCard("MATERIALS", formatCompact(state.team.monthlyMaterials), "Recorded contribution", "fleet")}
        ${metricCard("PRIMS DEFEATED", formatNumber(state.team.monthlyPrims), "Recorded this month", "battles")}
      </section>
      ${renderNetwork(state)}
      ${renderAlerts(state)}
      ${renderConnectionCard()}
    </div>`;
  }

  function renderBattles(state) {
    if (activeMode === "live") {
      return renderLiveReservedWorkspace(
        "BATTLE INTELLIGENCE",
        "Official battle ledger",
        "The workspace is prepared, but battle records remain locked until the approved response fields have been reviewed.",
        "battles"
      );
    }
    return `<div class="oac-workspace" role="tabpanel">
      <section class="oac-workspace-lead">
        <div><p>BATTLE INTELLIGENCE</p><h2>Battle ledger</h2><span>Logged outcomes, Primarchs, destruction, Glory and Prim losses.</span></div>
        <b>${state.battles.length}</b>
      </section>
      <div class="oac-battle-list">
        ${state.battles.length ? state.battles.map(battle => `<article class="oac-battle-card ${escapeHtml(battle.result)}">
          <div class="oac-battle-result"><span>${escapeHtml(statusLabel(battle.side))}</span><strong>${escapeHtml(statusLabel(battle.result))}</strong><small>${escapeHtml(battle.when)}</small></div>
          <div class="oac-battle-opponent"><small>OPPOSING TEAM</small><h3>${escapeHtml(battle.opponent)}</h3><p>${escapeHtml(battle.primarch || "Primarch not recorded")}${battle.primarchLevel !== null ? ` · Level ${formatNumber(battle.primarchLevel)}` : ""}</p></div>
          <dl>
            <div><dt>Destruction</dt><dd>${battle.destruction === null ? "—" : `${battle.destruction}%`}</dd></div>
            <div><dt>Glory won</dt><dd>${formatNumber(battle.glory)}</dd></div>
            <div><dt>Prims lost</dt><dd>${formatNumber(battle.primsLost)}</dd></div>
          </dl>
        </article>`).join("") : renderEmpty("battles", "No battles logged", "Open Enter intel to add the encounters you want on this private ledger.")}
      </div>
      <p class="oac-evidence-note">This ledger reports recorded outcomes only. It does not infer an opponent’s plans or recommend an attack.</p>
    </div>`;
  }

  function renderLiveCastles() {
    const castles = filteredLiveCastles();
    const visibleCastles = castles.slice(0, 200);
    const fetched = liveFetchedAt
      ? `${liveSource === "Atlas capture" ? "Captured" : "Last refreshed"} ${formatLiveTime(liveFetchedAt)}`
      : "No verified castle response received yet";
    return `<div class="oac-workspace" role="tabpanel">
      <section class="oac-workspace-lead oac-live-castle-lead">
        <div><p>LIVE FORTIFICATION WATCH</p><h2>Castle target board</h2><span>Source-labelled shield states grouped for fast, tap-first Atlas scanning.</span></div>
        <b>${liveCastles.length}</b>
      </section>
      <section class="oac-live-source-line">
        <div>${icon("shield")}<span><strong>${escapeHtml(liveSource)}</strong><small>${escapeHtml(fetched)}</small></span></div>
        <button type="button" data-oac-refresh-connection>${icon("refresh")} Refresh connection</button>
      </section>
      ${renderLiveFilterRail()}
      ${!liveCastles.length
          ? renderLiveLockedState()
          : castles.length
            ? `<div class="oac-live-castle-grid">${visibleCastles.map((castle, index) => `<article class="oac-live-castle-card ${escapeHtml(castle.shieldState)}" id="oacLiveCastle${index}">
                <header>
                  <span>${icon(castle.shieldState === "cooldown" || castle.shieldState === "dropping" ? "clock" : "shield")}</span>
                  <div><small>${escapeHtml(castle.region || castle.id)}</small><h3>${escapeHtml(castle.name)}</h3><p>${escapeHtml(castle.owner || "Owner not supplied")}</p></div>
                  <b>${castle.level === null ? "TIER —" : `T${formatNumber(castle.level)}`}</b>
                </header>
                <section class="oac-live-shield-signal">
                  <div><small>${castle.source === "War Dragons API" ? "OFFICIAL" : "CAPTURED"} SHIELD STATE</small><strong>${escapeHtml(liveShieldLabel(castle))}</strong><span>${escapeHtml(liveShieldDetail(castle))}</span></div>
                  <i></i>
                </section>
                <dl>
                  <div><dt>Stationed troops</dt><dd>${formatNumber(castle.troops)}</dd></div>
                  <div><dt>Visible fleets</dt><dd>${formatNumber(castle.fleets)}</dd></div>
                </dl>
                <footer><span>${escapeHtml(castle.source)}</span><b>${castle.attackable ? "Attackable confirmed" : "No attackability claim"}</b></footer>
              </article>`).join("")}</div>`
            : `<section class="oac-live-filter-empty">${icon("shield")}<h3>No castles in this source group</h3><p>Choose another shield-state filter. Onyx keeps each castle in the group reported by its named source.</p></section>`}
      ${castles.length > visibleCastles.length
        ? `<p class="oac-evidence-note">Showing first ${formatNumber(visibleCastles.length)} of ${formatNumber(castles.length)}. Use the filters to narrow the board.</p>`
        : ""}
      <p class="oac-evidence-note">Shield labels reflect the named source. Missing timing and attackability remain missing; Onyx does not manufacture either.</p>
      ${renderConnectionCard()}
    </div>`;
  }

  function renderCastles(state) {
    if (activeMode === "live") return renderLiveCastles();
    return `<div class="oac-workspace" role="tabpanel">
      <section class="oac-workspace-lead">
        <div><p>FORTIFICATION WATCH</p><h2>Castle watchboard</h2><span>Ownership, fort level, stationed forces and recorded shield windows.</span></div>
        <b>${state.castles.length}</b>
      </section>
      <div class="oac-castle-grid">
        ${state.castles.length ? state.castles.map((castle, index) => `<article class="oac-castle-card ${escapeHtml(castle.status)}" id="oacCastle${index}">
          <header><span>${icon("castle")}</span><div><small>${escapeHtml(castle.id)}</small><h3>${escapeHtml(castle.name)}</h3><p>${escapeHtml(castle.owner || "Owner not recorded")}</p></div><b>LV ${formatNumber(castle.level)}</b></header>
          <div class="oac-shield-state">${icon("shield")}<div><small>RECORDED SHIELD</small><strong>${castle.shieldHours === null ? "Not recorded" : castle.shieldHours > 0 ? `${castle.shieldHours.toFixed(1)} hours` : "Unshielded"}</strong></div><span class="${escapeHtml(castle.status)}">${escapeHtml(statusLabel(castle.status))}</span></div>
          <dl>
            <div><dt>Stationed troops</dt><dd>${formatNumber(castle.troops)}</dd></div>
            <div><dt>Recorded fleets</dt><dd>${formatNumber(castle.fleets)}</dd></div>
          </dl>
        </article>`).join("") : renderEmpty("castle", "No castles recorded", "Open Enter intel and add only the castles you want Onyx to track.")}
      </div>
    </div>`;
  }

  function renderHunter() {
    return `<section class="oac-hunter-workspace" aria-label="Atlas Castle Hunter">
      <div id="onyxAtlasCastleHunterMount"></div>
    </section>`;
  }

  function renderTeam(state) {
    if (activeMode === "live") {
      return renderLiveReservedWorkspace(
        "TEAM READINESS",
        "Official contribution board",
        "Team and contribution fields will appear here only when the authorised API returns them for this player.",
        "team"
      );
    }
    const members = [...state.members].sort((left, right) => (right.troops || 0) - (left.troops || 0));
    const total = members.reduce((sum, member) => sum + (member.troops || 0), 0);
    return `<div class="oac-workspace" role="tabpanel">
      <section class="oac-workspace-lead">
        <div><p>TEAM READINESS</p><h2>Contribution board</h2><span>A sortable snapshot of the values you have recorded.</span></div>
        <b>${members.length}</b>
      </section>
      <div class="oac-team-table" role="table" aria-label="Atlas team snapshot">
        ${members.length ? `<div class="oac-team-head" role="row"><span>Member</span><span>Troops</span><span>Contribution</span></div>${members.map((member, index) => {
          const width = total ? Math.max(4, Math.round((member.troops || 0) / total * 100)) : 4;
          return `<article role="row" class="oac-member-row ${escapeHtml(member.status)}">
            <div class="oac-member-identity"><i>${String(index + 1).padStart(2, "0")}</i><span><strong>${escapeHtml(member.name)}</strong><small>${escapeHtml(statusLabel(member.status))}</small></span></div>
            <div class="oac-member-troops"><strong>${formatCompact(member.troops)}</strong><span><i style="--member-width:${width}%"></i></span></div>
            <dl><div><dt>Gold</dt><dd>${formatCompact(member.gold)}</dd></div><div><dt>Materials</dt><dd>${formatCompact(member.materials)}</dd></div><div><dt>Prims</dt><dd>${formatNumber(member.prims)}</dd></div></dl>
          </article>`;
        }).join("")}` : renderEmpty("team", "No team members recorded", "Open Enter intel to create a private readiness snapshot.")}
      </div>
      <p class="oac-evidence-note">The order reflects recorded troop totals only. It is not a player rating or performance judgement.</p>
    </div>`;
  }

  function renderLiveReservedWorkspace(kicker, title, detail, iconName) {
    return `<div class="oac-workspace" role="tabpanel">
      <section class="oac-workspace-lead">
        <div><p>${escapeHtml(kicker)}</p><h2>${escapeHtml(title)}</h2><span>Official, read-only player-authorised intelligence.</span></div>
        ${icon(iconName)}
      </section>
      <section class="oac-live-locked reserved">
        <div class="oac-live-lock-orbit">${icon("lock")}</div>
        <p>VERIFIED FIELDS REQUIRED</p>
        <h3>Prepared without invented data</h3>
        <span>${escapeHtml(detail)}</span>
      </section>
      ${renderConnectionCard()}
    </div>`;
  }

  function renderEmpty(iconName, title, detail) {
    return `<section class="oac-empty-state">${icon(iconName)}<h3>${escapeHtml(title)}</h3><p>${escapeHtml(detail)}</p><button type="button" data-oac-open-entry>Enter intel</button></section>`;
  }

  function field(label, name, value, type = "text", options = "") {
    return `<label><span>${escapeHtml(label)}</span><input type="${type}" data-oac-team-field="${name}" value="${escapeHtml(value ?? "")}" ${options}></label>`;
  }

  function renderEntry(state) {
    return `<div class="oac-workspace oac-entry-workspace" role="tabpanel">
      <section class="oac-workspace-lead">
        <div><p>PRIVATE MANUAL MODE</p><h2>Enter Atlas intel</h2><span>Build the command board from details you choose to record. Nothing is connected.</span></div>
        ${icon("edit")}
      </section>
      <section class="oac-editor-card">
        <div class="oac-editor-heading"><span>01</span><div><h3>Team snapshot</h3><p>Record the current totals you want on the overview.</p></div></div>
        <div class="oac-field-grid">
          ${field("Team name", "name", state.team.name, "text", 'maxlength="70"')}
          ${field("Alliance", "alliance", state.team.alliance, "text", 'maxlength="70"')}
          ${field("Total troops", "totalTroops", state.team.totalTroops, "number", 'min="0" inputmode="numeric"')}
          ${field("Monthly gold", "monthlyGold", state.team.monthlyGold, "number", 'min="0" inputmode="numeric"')}
          ${field("Monthly materials", "monthlyMaterials", state.team.monthlyMaterials, "number", 'min="0" inputmode="numeric"')}
          ${field("Prims defeated", "monthlyPrims", state.team.monthlyPrims, "number", 'min="0" inputmode="numeric"')}
          ${field("Atlas event score", "eventScore", state.team.eventScore, "number", 'min="0" inputmode="numeric"')}
        </div>
      </section>
      ${renderMemberEditor(state)}
      ${renderCastleEditor(state)}
      ${renderBattleEditor(state)}
      <section class="oac-reset-zone">
        <div><strong>Clear manual snapshot</strong><p>Remove the saved Atlas board for this Onyx profile from this device.</p></div>
        <button type="button" id="oacClearManual">${icon("trash")} Clear snapshot</button>
      </section>
    </div>`;
  }

  function renderMemberEditor(state) {
    return `<section class="oac-editor-card">
      <div class="oac-editor-heading"><span>02</span><div><h3>Team members</h3><p>Add contribution and readiness records.</p></div><b>${state.members.length}</b></div>
      <div class="oac-editor-records">${state.members.map((member, index) => `<article><div><strong>${escapeHtml(member.name)}</strong><span>${formatNumber(member.troops)} troops · ${escapeHtml(statusLabel(member.status))}</span></div><button type="button" data-oac-remove-member="${index}" aria-label="Remove ${escapeHtml(member.name)}">${icon("trash")}</button></article>`).join("")}</div>
      <form id="oacMemberForm" class="oac-add-form">
        <label><span>Member name</span><input name="name" required maxlength="60"></label>
        <label><span>Troops</span><input name="troops" type="number" min="0" inputmode="numeric"></label>
        <label><span>Gold</span><input name="gold" type="number" min="0" inputmode="numeric"></label>
        <label><span>Materials</span><input name="materials" type="number" min="0" inputmode="numeric"></label>
        <label><span>Prims</span><input name="prims" type="number" min="0" inputmode="numeric"></label>
        <label><span>Condition</span><select name="status"><option value="ready">Ready</option><option value="watch">Watch</option><option value="support">Support</option></select></label>
        <button type="submit">${icon("plus")} Add member</button>
      </form>
    </section>`;
  }

  function renderCastleEditor(state) {
    return `<section class="oac-editor-card">
      <div class="oac-editor-heading"><span>03</span><div><h3>Castle watchboard</h3><p>Add the fortifications you want to monitor.</p></div><b>${state.castles.length}</b></div>
      <div class="oac-editor-records">${state.castles.map((castle, index) => `<article><div><strong>${escapeHtml(castle.name)}</strong><span>${escapeHtml(castle.id)} · ${castle.shieldHours === null ? "shield not recorded" : `${castle.shieldHours}h shield`}</span></div><button type="button" data-oac-remove-castle="${index}" aria-label="Remove ${escapeHtml(castle.name)}">${icon("trash")}</button></article>`).join("")}</div>
      <form id="oacCastleForm" class="oac-add-form">
        <label><span>Castle name</span><input name="name" required maxlength="70"></label>
        <label><span>Reference ID</span><input name="id" maxlength="48"></label>
        <label><span>Owner team</span><input name="owner" maxlength="70"></label>
        <label><span>Fort level</span><input name="level" type="number" min="0" inputmode="numeric"></label>
        <label><span>Stationed troops</span><input name="troops" type="number" min="0" inputmode="numeric"></label>
        <label><span>Fleets</span><input name="fleets" type="number" min="0" inputmode="numeric"></label>
        <label><span>Shield hours</span><input name="shieldHours" type="number" min="0" step="0.1" inputmode="decimal"></label>
        <label><span>Condition</span><select name="status"><option value="clear">Clear</option><option value="watch">Watch</option><option value="contested">Contested</option></select></label>
        <button type="submit">${icon("plus")} Add castle</button>
      </form>
    </section>`;
  }

  function renderBattleEditor(state) {
    return `<section class="oac-editor-card">
      <div class="oac-editor-heading"><span>04</span><div><h3>Battle ledger</h3><p>Log outcomes without guessing what happened.</p></div><b>${state.battles.length}</b></div>
      <div class="oac-editor-records">${state.battles.map((battle, index) => `<article><div><strong>${escapeHtml(battle.opponent)}</strong><span>${escapeHtml(statusLabel(battle.side))} · ${escapeHtml(statusLabel(battle.result))} · ${escapeHtml(battle.when)}</span></div><button type="button" data-oac-remove-battle="${index}" aria-label="Remove battle against ${escapeHtml(battle.opponent)}">${icon("trash")}</button></article>`).join("")}</div>
      <form id="oacBattleForm" class="oac-add-form">
        <label><span>Opposing team</span><input name="opponent" required maxlength="70"></label>
        <label><span>When</span><input name="when" maxlength="40" placeholder="Manually logged"></label>
        <label><span>Side</span><select name="side"><option value="defence">Defence</option><option value="attack">Attack</option></select></label>
        <label><span>Result</span><select name="result"><option value="logged">Logged</option><option value="win">Won</option><option value="loss">Lost</option></select></label>
        <label><span>Primarch</span><input name="primarch" maxlength="60"></label>
        <label><span>Primarch level</span><input name="primarchLevel" type="number" min="0" inputmode="numeric"></label>
        <label><span>Destruction %</span><input name="destruction" type="number" min="0" max="100" inputmode="numeric"></label>
        <label><span>Glory won</span><input name="glory" type="number" min="0" inputmode="numeric"></label>
        <label><span>Prims lost</span><input name="primsLost" type="number" min="0" inputmode="numeric"></label>
        <button type="submit">${icon("plus")} Add battle</button>
      </form>
    </section>`;
  }

  function renderFooter() {
    if (activeMode !== "manual") return "";
    return `<footer class="oac-save-dock ${manualDirty ? "dirty" : ""}">
      <div><span>${manualDirty ? "UNSAVED CHANGES" : manualSaved ? "MANUAL SNAPSHOT SAVED" : "NEW MANUAL SNAPSHOT"}</span><small>${notice || (manualSaved ? "Stored for this Onyx profile on this device." : "Nothing has been saved yet.")}</small></div>
      <button type="button" id="oacResetChanges" ${manualDirty ? "" : "disabled"}>Reset changes</button>
      <button type="button" id="oacSaveManual">Save snapshot</button>
    </footer>`;
  }

  function shell() {
    const state = currentState();
    if (activeMode !== "manual" && activeTab === "entry") activeTab = "overview";
    if (activeMode !== "live" && activeTab === "hunter") activeTab = "overview";
    const workspace = {
      overview: renderOverview,
      hunter: renderHunter,
      battles: renderBattles,
      castles: renderCastles,
      team: renderTeam,
      entry: renderEntry
    }[activeTab] || renderOverview;
    return `<div class="oac-shell">
      <header class="oac-header">
        <div class="oac-brand">${icon("atlas")}<div><p>ONYX COMMAND</p><h1>ATLAS COMMAND</h1><span>TACTICAL OPERATIONS CENTRE</span></div></div>
        <button type="button" id="oacClose" class="oac-close" aria-label="Close Atlas Command">${icon("close")}</button>
      </header>
      <main>
        ${sourceBanner()}
        ${renderModeRail()}
        ${renderTabs()}
        ${workspace(state)}
      </main>
      ${renderFooter()}
    </div>`;
  }

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    overlay = document.createElement("section");
    overlay.id = OVERLAY_ID;
    overlay.className = "oac-overlay";
    overlay.setAttribute("aria-hidden", "true");
    overlay.setAttribute("aria-label", "Atlas Command");
    document.body.appendChild(overlay);
    return overlay;
  }

  function markDirty() {
    manualDirty = true;
    notice = "";
    const dock = document.querySelector(`#${OVERLAY_ID} .oac-save-dock`);
    dock?.classList.add("dirty");
    const stateLabel = dock?.querySelector("div > span");
    if (stateLabel) stateLabel.textContent = "UNSAVED CHANGES";
    const reset = document.getElementById("oacResetChanges");
    if (reset) reset.disabled = false;
  }

  function formObject(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function bindEditor(overlay) {
    overlay.querySelectorAll("[data-oac-team-field]").forEach(input => {
      input.addEventListener("input", () => {
        const fieldName = input.dataset.oacTeamField;
        manualDraft.team[fieldName] = input.type === "number" ? cleanNumber(input.value) : cleanText(input.value, 70);
        markDirty();
      });
    });

    overlay.querySelector("#oacMemberForm")?.addEventListener("submit", event => {
      event.preventDefault();
      const member = normaliseMember({ ...formObject(event.currentTarget), id: `member-${Date.now()}` }, manualDraft.members.length);
      if (!member) return;
      manualDraft.members.push(member);
      markDirty();
      render({ focusSelector: "#oacMemberForm input" });
    });
    overlay.querySelector("#oacCastleForm")?.addEventListener("submit", event => {
      event.preventDefault();
      const castle = normaliseCastle({ ...formObject(event.currentTarget), id: formObject(event.currentTarget).id || `castle-${Date.now()}` }, manualDraft.castles.length);
      if (!castle) return;
      manualDraft.castles.push(castle);
      markDirty();
      render({ focusSelector: "#oacCastleForm input" });
    });
    overlay.querySelector("#oacBattleForm")?.addEventListener("submit", event => {
      event.preventDefault();
      const battle = normaliseBattle({ ...formObject(event.currentTarget), id: `battle-${Date.now()}` }, manualDraft.battles.length);
      if (!battle) return;
      manualDraft.battles.unshift(battle);
      markDirty();
      render({ focusSelector: "#oacBattleForm input" });
    });

    ["member", "castle", "battle"].forEach(type => {
      overlay.querySelectorAll(`[data-oac-remove-${type}]`).forEach(button => {
        button.addEventListener("click", () => {
          const index = Number(button.dataset[`oacRemove${type[0].toUpperCase()}${type.slice(1)}`]);
          manualDraft[`${type}s`].splice(index, 1);
          markDirty();
          render();
        });
      });
    });

    overlay.querySelector("#oacClearManual")?.addEventListener("click", () => {
      const allowed = window.confirm?.("Clear this manual Atlas snapshot from this device?");
      if (!allowed) return;
      const key = storageKey(STORAGE_PREFIX);
      if (key) localStorage.removeItem(key);
      manualSaved = null;
      manualDraft = emptyManualState();
      manualDirty = false;
      notice = "Manual Atlas snapshot cleared from this device.";
      render({ focusSelector: "#oacClearManual" });
    });
  }

  function bindOverlay(overlay) {
    overlay.querySelector("#oacClose")?.addEventListener("click", close);
    overlay.querySelectorAll("[data-oac-mode]").forEach(button => {
      button.addEventListener("click", () => {
        activeMode = VALID_MODES.has(button.dataset.oacMode) ? button.dataset.oacMode : "live";
        if (activeMode === "manual" && activeTab === "overview" && !hasManualData()) activeTab = "entry";
        if (activeMode !== "manual" && activeTab === "entry") activeTab = "overview";
        writeMode();
        notice = "";
        render({ focusSelector: `[data-oac-mode="${activeMode}"]` });
      });
    });
    overlay.querySelectorAll("[data-oac-tab]").forEach(button => {
      button.addEventListener("click", () => {
        activeTab = VALID_TABS.has(button.dataset.oacTab) ? button.dataset.oacTab : "overview";
        render({ focusSelector: `[data-oac-tab="${activeTab}"]` });
      });
    });
    overlay.querySelectorAll("[data-oac-open-entry]").forEach(button => {
      button.addEventListener("click", () => {
        activeMode = "manual";
        activeTab = "entry";
        writeMode();
        render({ focusSelector: "#oacMemberForm input" });
      });
    });
    overlay.querySelectorAll("[data-oac-castle-jump]").forEach(button => {
      button.addEventListener("click", () => {
        const index = button.dataset.oacCastleJump;
        activeTab = "castles";
        render({ focusSelector: `${activeMode === "live" ? "#oacLiveCastle" : "#oacCastle"}${index}` });
      });
    });
    overlay.querySelectorAll("[data-oac-live-filter]").forEach(button => {
      button.addEventListener("click", () => {
        liveFilter = VALID_LIVE_FILTERS.has(button.dataset.oacLiveFilter)
          ? button.dataset.oacLiveFilter
          : "vulnerable";
        render({ focusSelector: `[data-oac-live-filter="${liveFilter}"]` });
      });
    });
    overlay.querySelectorAll("[data-oac-connect]").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        await window.OnyxWarDragonsAuth?.beginAuthorization?.();
      });
    });
    overlay.querySelectorAll("[data-oac-refresh-connection]").forEach(button => {
      button.addEventListener("click", async () => {
        button.disabled = true;
        await window.OnyxWarDragonsAuth?.refreshStatus?.();
      });
    });
    overlay.querySelectorAll("[data-oac-disconnect]").forEach(button => {
      button.addEventListener("click", async () => {
        const allowed = window.confirm?.("Remove this encrypted War Dragons connection from Onyx? You can also revoke the app inside War Dragons.");
        if (!allowed) return;
        button.disabled = true;
        await window.OnyxWarDragonsAuth?.disconnect?.();
      });
    });
    overlay.querySelector("#oacSaveManual")?.addEventListener("click", () => {
      try {
        saveManual();
        render({ focusSelector: "#oacSaveManual" });
      } catch (_error) {
        notice = "Onyx could not save this snapshot on the device.";
        render({ focusSelector: "#oacSaveManual" });
      }
    });
    overlay.querySelector("#oacResetChanges")?.addEventListener("click", () => {
      manualDraft = clone(manualSaved || emptyManualState());
      manualDirty = false;
      notice = "Unsaved changes reset.";
      render({ focusSelector: '[data-oac-tab="entry"]' });
    });
    if (activeTab === "entry") bindEditor(overlay);
  }

  function render(options = {}) {
    const overlay = ensureOverlay();
    window.OnyxAtlasCastleHunter?.unmount?.();
    overlay.innerHTML = shell();
    bindOverlay(overlay);
    if (activeMode === "live" && activeTab === "hunter") {
      window.OnyxAtlasCastleHunter?.mount?.(
        overlay.querySelector("#onyxAtlasCastleHunterMount")
      );
    }
    if (options.focusSelector) {
      window.requestAnimationFrame?.(() => overlay.querySelector(options.focusSelector)?.focus?.());
    }
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
    const focusable = [...overlay.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])')];
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleLiveConnectionEvent(event) {
    const detail = event?.detail && typeof event.detail === "object"
      ? event.detail
      : {};
    liveConnection = Object.freeze({
      ...liveConnection,
      phase: cleanText(detail.phase, 30) || "error",
      connected: detail.connected === true,
      readyToAuthorise: detail.readyToAuthorise === true,
      reviewStatus: detail.reviewStatus === "ready" ? "ready" : "pending_review",
      playerId: cleanText(detail.playerId, 160) || null,
      scopes: Array.isArray(detail.scopes)
        ? detail.scopes.filter(scope => ["atlas.read", "player.public.read"].includes(scope))
        : [],
      connectedAt: cleanText(detail.connectedAt, 64) || null,
      lastVerifiedAt: cleanText(detail.lastVerifiedAt, 64) || null,
      message: cleanText(detail.message, 220) || "The secure connection status changed."
    });
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay?.classList.contains("open")) render();
  }

  function setLiveSnapshot(value) {
    const snapshot = normaliseLiveSnapshot(value);
    liveCastles = snapshot.castles;
    liveFetchedAt = snapshot.fetchedAt;
    liveSource = snapshot.source;
    const overlay = document.getElementById(OVERLAY_ID);
    if (
      overlay?.classList.contains("open") &&
      activeMode === "live" &&
      activeTab !== "hunter"
    ) render();
    return {
      castleCount: liveCastles.length,
      fetchedAt: liveFetchedAt,
      source: liveSource
    };
  }

  function open(tab = "overview") {
    const currentUser = userId();
    if (openedForUser !== currentUser) {
      openedForUser = currentUser;
      readLocal();
    }
    activeTab = VALID_TABS.has(tab) ? tab : "overview";
    if (activeMode !== "manual" && activeTab === "entry") activeTab = "overview";
    lastFocused = document.activeElement;
    notice = "";
    render();
    const overlay = ensureOverlay();
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("onyx-modal-open");
    document.addEventListener?.("keydown", handleModalKeydown);
    overlay.querySelector("#oacClose")?.focus?.();
    window.OnyxWarDragonsAuth?.refreshStatus?.();
  }

  function close() {
    const overlay = document.getElementById(OVERLAY_ID);
    window.OnyxAtlasCastleHunter?.unmount?.();
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("onyx-modal-open");
    document.removeEventListener?.("keydown", handleModalKeydown);
    lastFocused?.focus?.();
  }

  window.OnyxAtlasCommand = Object.freeze({
    open,
    close,
    getDemoState: () => clone(DEMO_STATE),
    getManualState: () => clone(manualDraft),
    getLiveState: () => clone({ castles: liveCastles, fetchedAt: liveFetchedAt, source: liveSource }),
    setLiveSnapshot,
    normaliseLiveSnapshot,
    normaliseManualState,
    deriveAlerts,
    commandCondition
  });

  window.addEventListener?.("onyx-war-dragons-connection", handleLiveConnectionEvent);
})();
