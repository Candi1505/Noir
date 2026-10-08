/* ============================================================
   NOIR — DOUBLE ARMORY PLANNER

   Reads the sanitised Assault + Breeding chest streams that
   were discovered dynamically during HAR import. Event-number
   suffixes are deliberately never hard-coded.
   ============================================================ */

(function initialiseDoubleArmoryPlanner(window) {
  "use strict";

  const OVERLAY_ID = "noirDoubleArmoryOverlay";
  const BUTTON_ID = "noirDoubleArmoryButton";
  const CHEST_ICONS = {
    gold: "G",
    platinum: "P",
    draconic: "D",
    freedom: "F",
    arcane: "A"
  };
  const STORAGE_PREFIX = "chestCompanionDoubleArmoryV2";
  const PREFERENCE_LABELS = {
    favourite: "Favourite",
    wanted: "Wanted",
    neutral: "Neutral",
    avoid: "Avoid",
    never: "Never recommend"
  };
  const PREFERENCE_SCORES = { favourite: 80, wanted: 35, neutral: 0, avoid: -60, never: -1000 };
  let selectedChestType = "platinum";
  let restoreLivePredictorOnClose = false;
  let playerId = null;
  let playerState = null;
  let opening = false;

  const REWARD_NAMES = {
    breedingToken: "Egg Tokens",
    foodConsumable2: "Food Pack (level-scaled)",
    foodPack_460000: "460,000 Food Pack",
    foodPack_1400000: "1,400,000 Food Pack",
    elementalEmber: "Elemental Embers",
    electrumBar: "Electrum Bars",
    urbanflareSigil: "Urbanflare Sigil",
    misfitriseSigil: "Misfitrise Sigil",
    blackPearl: "Black Pearls",
    fireShard: "Fire Shards",
    iceShard: "Ice Shards",
    expediteConsumable1: "15 Min Speedup",
    expediteConsumable1a: "30 Min Speedup",
    expediteConsumable2: "1 Hr Speedup",
    expediteConsumable3: "3 Hr Speedup",
    expediteConsumable4: "12 Hr Speedup",
    increaseAttack1: "Dragon Attack Boost",
    increaseHP1: "Dragon HP Boost",
    increaseBuildingAttack1: "Tower Attack Boost",
    increaseBuildingHP1: "Tower HP Boost",
    innerFire01: "Inner Fire",
    innerFireConsumable: "Inner Fire",
    energyPack: "Energy Packs",
    repairConsumable: "Defense Hammer",
    fullHeal: "Healing Potions",
    xpMultiplierSpellConsumable01: "Dragon XP Boost",
    xpMultiplierSpellConsumable02: "Dragon XP Boost",
    dragonHealPotion: "Dragon Heal Potions",
    mysticFragment: "Mystic Fragments",
    chest0: "Bronze Chests",
    chest1: "Silver Chests",
    chest2: "Gold Chests",
    chest11: "Platinum Chests",
    chest27: "Draconic Chests",
    chest33: "Freedom Chests",
    E20Q2FestiveHunterDragonEvolutionFragment: "Zilch Shards",
    E20Q3FestiveWarriorDragonEvolutionFragment: "Hueso Shards",
    E20Q4FestiveInvokerDragonEvolutionFragment: "Nebulon Shards",
    E21Q4FestiveHunterDragonEvolutionFragment: "Krampi Shards",
    E22Q1FestiveWarriorDragonEvolutionFragment: "Garrvox Shards",
    E22Q2FestiveHunterDragonEvolutionFragment: "Grumuk Shards",
    E22Q3FestiveInvokerDragonEvolutionFragment: "Pezizo Shards",
    E22Q4FestiveHunterDragonEvolutionFragment: "Re'gyn Shards",
    E22Q4FestiveSorcererDragonEvolutionFragment: "Jinhen Shards",
    E23Q2FestiveHunterDragonEvolutionFragment: "Vesolance Shards",
    E23Q3FestiveSorcererDragonEvolutionFragment: "Jinhen Shards",
    E23Q4FestiveHunterDragonEvolutionFragment: "Bonewrack Shards",
    E24Q1FestiveWarriorDragonEvolutionFragment: "Nocturnus Shards",
    E24Q2FestiveHunterDragonEvolutionFragment: "Photonix Shards",
    E24Q3FestiveInvokerDragonEvolutionFragment: "Orion Shards",
    E24Q3InvokerDragonEvolutionFragment: "Orion Shards",
    E24Q4FestiveHunterDragonEvolutionFragment: "Razor Shards",
    E25Q1FestiveSorcererDragonEvolutionFragment: "Volcaryx Shards",
    E25Q2FestiveWarriorDragonEvolutionFragment: "Riphorn Shards",
    E25Q3FestiveWarriorDragonEvolutionFragment: "Eldrath Shards",
    E25Q4FestiveHunterDragonEvolutionFragment: "Drekgor Shards",
    E26Q1FestiveInvokerDragonEvolutionFragment: "Voltgar Shards"
  };

  function livePredictorOverlay() {
    return document.getElementById("ccLivePredictorOverlay");
  }

  function hideLivePredictor() {
    const overlay = livePredictorOverlay();
    if (overlay?.classList.contains("lp-open")) {
      restoreLivePredictorOnClose = true;
      overlay.classList.remove("lp-open");
      overlay.setAttribute("aria-hidden", "true");
    }
  }

  function closePlanner() {
    document.getElementById(OVERLAY_ID)?.remove();
    if (restoreLivePredictorOnClose) {
      livePredictorOverlay()?.classList.add("lp-open");
      livePredictorOverlay()?.setAttribute("aria-hidden", "false");
      restoreLivePredictorOnClose = false;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }

  function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
  }

  function hashText(value) {
    let hash = 2166136261;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function legacyEventFingerprint(data = getData()) {
    if (!data) return "none";
    const completeSide = side => ({
      decks: side?.decks || {},
      drops: side?.drops || {},
      chests: side?.chests || {}
    });
    return hashText(JSON.stringify({
      eventName: data.eventName || data.event || "",
      eventVersion: data.eventVersion || data.version || "",
      assault: completeSide(data.sides?.assault),
      breeding: completeSide(data.sides?.breeding),
      chestTypes: data.availableChestTypes
    }));
  }

  function eventFingerprint(data = getData()) {
    if (!data) return 'none';
    const ordered = object => Object.fromEntries(Object.keys(object || {}).sort().map(key => [key, object[key]]));
    const side = value => ({eventKey:value?.eventKey, decks:ordered(value?.decks),
      drops:ordered(Object.fromEntries(Object.entries(value?.drops || {}).map(([key, drops]) =>
        [key, drops.map(drop => ({id:drop.id,kind:drop.kind,mu:drop.mu,sdev:drop.sdev || 0}))])))});
    return hashText(JSON.stringify({assault:side(data.sides?.assault),breeding:side(data.sides?.breeding)}));
  }

  async function resolvePlayerId() {
    try {
      const result = await window.chestSupabase?.auth?.getSession?.();
      return result?.data?.session?.user?.id || null;
    } catch (error) {
      console.warn("[Double Armory] Could not read the signed-in player.", error);
      return null;
    }
  }

  function emptyChestState() {
    return { observations: [], preferences: {} };
  }

  function loadPlayerState(data = getData()) {
    const fingerprint = eventFingerprint(data);
    if (!playerId) return { eventFingerprint: fingerprint, chests: {} };
    const key = `${STORAGE_PREFIX}:${playerId}`;
    try {
      const saved = JSON.parse(localStorage.getItem(`${key}:${fingerprint}`) || "null");
      if (saved?.eventFingerprint === fingerprint) return {eventFingerprint:fingerprint,chests:saved.chests || {}};
      // Migrate matching progress from the earlier player-only key, without
      // deleting or overwriting it. Other events retain their own saved state.
      const previous = JSON.parse(localStorage.getItem(key) || "{}");
      if (previous.eventFingerprint === legacyEventFingerprint(data)) {
        const migrated = {eventFingerprint:fingerprint,chests:previous.chests || {}};
        try { localStorage.setItem(`${key}:${fingerprint}`, JSON.stringify(migrated)); } catch (_) { /* Keep usable progress in memory. */ }
        return migrated;
      }
      return { eventFingerprint: fingerprint, chests: {} };
    } catch (error) {
      console.warn("[Double Armory] Player progress could not be loaded.", error);
      return { eventFingerprint: fingerprint, chests: {} };
    }
  }

  function savePlayerState() {
    if (!playerState || !playerId) return;
    try {
      localStorage.setItem(`${STORAGE_PREFIX}:${playerId}:${playerState.eventFingerprint}`, JSON.stringify(playerState));
    } catch (error) {
      console.warn("[Double Armory] Player progress could not be saved.", error);
    }
  }

  function chestState() {
    playerState ||= loadPlayerState();
    playerState.chests[selectedChestType] ||= emptyChestState();
    return playerState.chests[selectedChestType];
  }

  function escapeHTML(value) {
    const element = document.createElement("div");
    element.textContent = String(value ?? "");
    return element.innerHTML;
  }

  function formatNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric)
      ? new Intl.NumberFormat().format(numeric)
      : "—";
  }

  function humaniseCode(code) {
    const raw = String(code || "");
    if (REWARD_NAMES[raw]) return REWARD_NAMES[raw];
    const gemstone = raw.match(/^cmCrystal(ice|dark|earth|fire|wind)Gemstone$/i);
    if (gemstone) {
      return `${gemstone[1][0].toUpperCase()}${gemstone[1].slice(1).toLowerCase()} Crafting Gemstones`;
    }
    return raw
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, letter => letter.toUpperCase())
      .trim() || "Reward";
  }

  function getData() {
    const event = window.LivePredictorEngine?.getEventData?.() || window.currentEventData;
    const bundled = window.OnyxDoubleArmoryEvent;
    const now = Date.now();
    if (bundled && now >= Date.parse(bundled.validFrom) && now < Date.parse(bundled.validUntil)
        && (!event?.doubleArmory?.ready || !event.importedAt || Date.parse(event.importedAt) <= Date.parse(bundled.validFrom))) return bundled;
    if (event?.doubleArmory?.ready) {
      if (bundled && now >= Date.parse(bundled.validUntil) && event.doubleArmory.sides?.assault?.eventKey === bundled.sides.assault.eventKey) return null;
      return event.doubleArmory;
    }
    return null;
  }

  function getAvailableChestTypes(data = getData()) {
    return Array.isArray(data?.availableChestTypes)
      ? data.availableChestTypes.filter(type =>
          data.sides?.assault?.chests?.[type]?.ready &&
          data.sides?.breeding?.chests?.[type]?.ready
        )
      : [];
  }

  function decorate(reward) {
    return { ...reward, name: reward.name || humaniseCode(reward.code),
      score: /mythic/i.test(reward.rarity) ? 50 : /legendary/i.test(reward.rarity) ? 30 : 10 };
  }

  function buildSequence(side, chestType = selectedChestType) {
    return window.DoubleArmoryCore.catalogue(side, chestType).map(decorate);
  }

  function rewardSignature(reward) {
    return [
      String(reward?.code || reward?.name || "").trim().toLowerCase(),
      Number.isFinite(Number(reward?.amount)) ? Number(reward.amount) : "",
      String(reward?.rarity || "").trim().toLowerCase()
    ].join("|");
  }

  function rewardKey(reward) {
    return String(reward?.code || reward?.name || "unknown").trim().toLowerCase();
  }

  function rewardsEqual(first, second) {
    return rewardSignature(first) === rewardSignature(second);
  }

  function solvePlayerPosition() {
    const data = getData(), state = chestState();
    const result = window.DoubleArmoryCore.solve(data, selectedChestType, state.observations, state.initialState || {});
    const forecasts = Object.fromEntries(['assault', 'breeding'].map(side => [side,
      window.DoubleArmoryCore.forecast(data, selectedChestType, result, side).map(decorate)]));
    return { ...result, forecasts, candidates: result.states || [],
      solved: forecasts.assault[0]?.exact === true && forecasts.breeding[0]?.exact === true,
      nextIndex: 0 };
  }

  function preferenceFor(reward) {
    return chestState().preferences[rewardKey(reward)] || "neutral";
  }

  function scoreReward(reward) {
    return Number(reward?.score || 0) + (PREFERENCE_SCORES[preferenceFor(reward)] || 0);
  }

  function recommendation(assault, breeding, solution) {
    if (!solution.matched) return { title: 'Sequence needs checking', detail: solution.reason };
    if (!chestState().observations.length) return { title: 'Record your rewards to locate your position', detail: 'The shared event decks are already loaded. Record your own drops in order; you do not need a capture. Your position is separate from every other player’s.' };
    if (!solution.solved) return { title: 'Next reward is not yet resolved for both armouries', detail: 'Only rewards agreed on by every remaining pool position are shown. More consecutive observations may narrow the possibilities.' };
    const left = assault[0], right = breeding[0];
    if (preferenceFor(left) === 'never' && preferenceFor(right) === 'never') return { title: 'Both next rewards are on your Never list', detail: 'Neither armoury is recommended.' };
    const difference = scoreReward(left) - scoreReward(right);
    return { title: difference === 0 ? 'Both next rewards have equal preference scores' : `Next choice: ${difference > 0 ? 'Assault' : 'Breeding'}`,
      detail: 'Both next rewards agree across the positions consistent with your recorded history. This is a deck-model forecast, not a guarantee against game changes.' };
  }

  function rewardOptions(sequence) {
    const seen = new Set();
    return sequence.filter(reward => {
      const signature = rewardSignature(reward);
      if (seen.has(signature)) return false;
      seen.add(signature);
      return true;
    }).sort((first, second) =>
      first.name.localeCompare(second.name) || Number(first.amount || 0) - Number(second.amount || 0)
    );
  }

  function ensureStyles() {
    if (document.getElementById("noirDoubleArmoryStyles")) return;
    const style = document.createElement("style");
    style.id = "noirDoubleArmoryStyles";
    style.textContent = `
      #${OVERLAY_ID},#${OVERLAY_ID} *{box-sizing:border-box}#daCaptureFile{width:100%;max-width:100%}.da-name{overflow-wrap:anywhere}
      #${OVERLAY_ID}{position:fixed;inset:0;z-index:2147483647;background:radial-gradient(circle at top,#17130d 0,#050505 34%);color:#e8e5de;overflow:auto;font-family:inherit;padding:env(safe-area-inset-top) 0 env(safe-area-inset-bottom)}
      .da-shell{width:min(1100px,100%);margin:auto;padding:18px}
      .da-top{position:sticky;top:0;z-index:3;display:flex;justify-content:space-between;gap:14px;align-items:center;padding:18px;background:rgba(5,5,5,.97);border-bottom:1px solid #a8873a;box-shadow:0 12px 30px rgba(0,0,0,.45)}
      .da-eyebrow{margin:0;color:#c19a4a;font-size:12px;font-weight:900;letter-spacing:.22em}
      .da-top h1{margin:6px 0 0;font-size:clamp(25px,6vw,42px)}
      .da-close{width:50px;height:50px;border-radius:50%;border:1px solid #51452e;background:#111;color:#e8e5de;font-size:34px}
      .da-summary{margin:18px 0;padding:18px;border:1px solid #a8873a;border-radius:20px;background:linear-gradient(145deg,#17130d,#090909);box-shadow:inset 0 1px rgba(226,198,110,.15)}
      .da-tabs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:16px 0}.da-tab{padding:12px 6px;border:1px solid #3a352b;border-radius:13px;background:#111;color:#aaa;font:inherit;font-weight:900}.da-tab[aria-selected="true"]{background:linear-gradient(145deg,#4b3c1d,#20190d);color:#e2c66e;border-color:#c19a4a;box-shadow:0 0 18px rgba(193,154,74,.18)}
      .da-recommend{color:#e2c66e;font-size:22px;font-weight:900}
      .da-note{margin-top:8px;color:#999;line-height:1.5}
      .da-solver{margin:18px 0;padding:18px;border:1px solid #3d372c;border-radius:20px;background:#0b0b0b}.da-solver h2,.da-preferences h2{margin:0 0 8px}.da-solver-grid{display:grid;grid-template-columns:1fr 1.4fr auto;gap:10px;align-items:end;margin-top:14px}.da-field{display:flex;flex-direction:column;gap:6px;color:#aaa;font-size:12px;font-weight:800}.da-select,.da-action{min-height:48px;border:1px solid #51452e;border-radius:12px;background:#141414;color:#eee;padding:10px;font:inherit}.da-armory-choice{display:grid;grid-template-columns:1fr 1fr;gap:8px}.da-armory{min-height:48px;border:1px solid #51452e;border-radius:12px;background:#111;color:#aaa;font:inherit;font-weight:900}.da-armory[aria-selected="true"]{color:#fff;border-color:#c19a4a;background:#34280f}.da-action{background:linear-gradient(180deg,#d7bd70,#aa8436);color:#080808;font-weight:900}.da-action-secondary{background:#151515;color:#ddd}.da-status{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:14px}.da-stat{padding:12px;border:1px solid #302d28;border-radius:12px;background:#101010}.da-stat strong{display:block;color:#e2c66e;font-size:20px}.da-stat span{color:#888;font-size:11px}.da-history{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}.da-observation{padding:7px 9px;border-radius:999px;background:#17130d;border:1px solid #4a3e27;color:#ccc;font-size:12px}.da-controls{display:flex;gap:8px;margin-top:12px}.da-controls button{flex:1}.da-preferences{margin:18px 0;padding:18px;border:1px solid #3d372c;border-radius:20px;background:#0b0b0b}.da-pref-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:12px}.da-pref-row{display:grid;grid-template-columns:minmax(0,1fr) 145px;gap:8px;align-items:center;padding:9px;border:1px solid #2c2923;border-radius:11px;background:#101010}.da-pref-name{min-width:0;font-weight:800;font-size:13px}.da-pref-row select{width:100%;min-width:0;background:#171717;color:#ddd;border:1px solid #413a2d;border-radius:8px;padding:7px}.da-next{outline:2px solid #2f8f78;outline-offset:-2px}
      .da-key{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}.da-key-item{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border:1px solid #39342d;border-radius:999px;background:#0b0b0b;color:#c8c4bb;font-size:12px;font-weight:800}.da-key-swatch{width:10px;height:10px;border-radius:50%;box-shadow:0 0 8px currentColor}.da-key-epic{color:#9b82b6;background:#79658f}.da-key-legendary{color:#d5b568;background:#c19a4a}.da-key-mythic{color:#afc9d5;background:#8aa7b5}
      .da-table{display:grid;grid-template-columns:52px minmax(0,1fr) minmax(0,1fr);border:1px solid #3d372c;border-radius:18px;overflow:hidden;box-shadow:0 16px 40px rgba(0,0,0,.35)}
      .da-head{position:static;background:#171717!important;color:#e8e5de!important;font-weight:900;text-align:center}
      .da-head-assault{background:linear-gradient(145deg,#8f3645,#421820)!important}.da-head-breeding{background:linear-gradient(145deg,#257a68,#123f36)!important}
      .da-cell{min-width:0;padding:13px 10px;border-right:1px solid #302d28;border-bottom:1px solid #302d28;background:#0c0c0c}
      .da-cell:nth-child(3n){border-right:0}.da-number{text-align:center;color:#d6bd72;font-weight:900}
      .da-reward{display:flex;flex-direction:column;gap:5px}.da-name{font-weight:900;line-height:1.25}.da-meta{color:#888;font-size:12px}.da-amount{color:#d6bd72;font-weight:900}
      .da-epic{background:linear-gradient(90deg,rgba(121,101,143,.14),#0c0c0c 38%);box-shadow:inset 4px 0 #79658f}.da-legendary{background:linear-gradient(90deg,rgba(193,154,74,.15),#0c0c0c 38%);box-shadow:inset 4px 0 #c19a4a}.da-mythic{background:linear-gradient(90deg,rgba(138,167,181,.16),#0c0c0c 38%);box-shadow:inset 4px 0 #8aa7b5}.da-unknown{box-shadow:inset 4px 0 #555}
      .da-favourite .da-name::after{content:' ★';color:#e2c66e}.da-bonus{border-bottom:3px solid #2f8f78}
      #${BUTTON_ID}{width:100%;margin-top:14px;padding:15px;border:1px solid #a8873a;border-radius:15px;background:linear-gradient(180deg,#d7bd70,#aa8436);color:#080808;font:inherit;font-weight:900}
      @media(max-width:600px){.da-shell{padding:0 8px 18px}.da-cell{padding:11px 7px}.da-name{font-size:13px}.da-meta{font-size:10px}.da-amount{font-size:12px}.da-table{grid-template-columns:38px minmax(0,1fr) minmax(0,1fr)}.da-solver-grid{grid-template-columns:1fr}.da-status{grid-template-columns:repeat(3,1fr)}.da-pref-list{grid-template-columns:1fr}.da-pref-row{grid-template-columns:minmax(0,1fr) 140px}}
    `;
    document.head.appendChild(style);
  }

  function rewardMarkup(reward = {}, isNext = false) {
    const rarity = String(reward.rarity || "unknown").toLowerCase();
    return `
      <div class="da-cell da-${escapeHTML(rarity)} ${reward.favourite ? "da-favourite" : ""} ${reward.bonusAfter ? "da-bonus" : ""} ${isNext ? "da-next" : ""}">
        <div class="da-reward">
          <div class="da-name">${escapeHTML(reward.name)}</div>
          <div class="da-meta">${escapeHTML(reward.rarity || "Unknown")} • ${reward.exact ? "Model forecast" : "More evidence needed"}</div>
          <div class="da-amount">${reward.amount === null ? "—" : formatNumber(reward.amount)}</div>
        </div>
      </div>`;
  }

  function optionMarkup(reward, index) {
    const amount = reward.amount === null ? "" : ` — ${formatNumber(reward.amount)}`;
    return `<option value="${index}">${escapeHTML(reward.name)}${escapeHTML(amount)} (${escapeHTML(reward.rarity)})</option>`;
  }

  function preferenceMarkup(assault, breeding) {
    const rewards = rewardOptions([...assault, ...breeding]);
    const unique = [];
    const seen = new Set();
    rewards.forEach(reward => {
      const key = rewardKey(reward);
      if (!seen.has(key)) {
        seen.add(key);
        unique.push(reward);
      }
    });
    return unique.map(reward => {
      const key = rewardKey(reward);
      const selected = preferenceFor(reward);
      return `<label class="da-pref-row"><span class="da-pref-name">${escapeHTML(reward.name)}</span><select data-preference-key="${escapeHTML(key)}" aria-label="Preference for ${escapeHTML(reward.name)}">${Object.entries(PREFERENCE_LABELS).map(([value, label]) => `<option value="${value}" ${value === selected ? "selected" : ""}>${label}</option>`).join("")}</select></label>`;
    }).join("");
  }

  async function open() {
    if (opening) return;
    opening = true;
    try {
      const data = getData();
      if (!data?.ready) {
        window.alert("Double Armory data is not available in the published event yet.");
        return;
      }
      ensureStyles();
      document.getElementById(OVERLAY_ID)?.remove();
      const available = getAvailableChestTypes(data);
      if (!available.length) {
        window.alert("Please republish the Double Armory event so all chest types can be prepared.");
        return;
      }
      if (!available.includes(selectedChestType)) selectedChestType = available[0];
      playerId = await resolvePlayerId();
      playerState = loadPlayerState(data);
      hideLivePredictor();
      const assault = buildSequence(data.sides.assault, selectedChestType);
      const breeding = buildSequence(data.sides.breeding, selectedChestType);
      const solution = solvePlayerPosition(assault, breeding);
      const displayAssault = solution.forecasts.assault;
      const displayBreeding = solution.forecasts.breeding;
      
      const strategy = recommendation(displayAssault, displayBreeding, solution);
      const observations = chestState().observations;
      const defaultArmory = "assault";
      const initialOptions = rewardOptions(assault);
      const chest = data.sides.assault?.chests?.[selectedChestType];
      const overlay = document.createElement("div");
      overlay.id = OVERLAY_ID;
      overlay.innerHTML = `
      <div class="da-shell">
        <header class="da-top">
          <div><p class="da-eyebrow">CHEST COMPANION</p><h1>Double Armory Planner</h1></div>
          <button class="da-close" type="button" aria-label="Close">×</button>
        </header>
        <nav class="da-tabs" aria-label="Chest type">
          ${available.map(type => `<button class="da-tab" type="button" data-chest="${escapeHTML(type)}" aria-selected="${type === selectedChestType}">${CHEST_ICONS[type] || "C"} ${escapeHTML(data.sides.assault.chests[type].label)}</button>`).join("")}
        </nav>
        <section class="da-solver">
          <p class="da-eyebrow">PERSONAL DA PREDICTOR</p>
          <h2>${solution.solved ? "Next rewards resolved" : "Locate your position"}</h2>
          <div class="da-note">Record every opening in order, including bonus claims. Bulk result cards may be sorted: import a capture for batch order. Progress stays with the signed-in player on this device.</div>
          <details><summary>Optional: restore your own position from a capture</summary><label class="da-field"><span>YOUR PRIVATE CAPTURE (.HAR OR .ZIP)</span><input id="daCaptureFile" type="file" accept=".har,.json,.zip"><span id="daImportStatus" role="status">Only use your own capture here. This restores your position on this device and does not update other players.</span></label></details>
          <label class="da-field"><span><input id="daIsBonus" type="checkbox"> This was a bonus claim</span></label>
          <div class="da-solver-grid">
            <div class="da-field"><span>ARMORY OPENED</span><div class="da-armory-choice"><button class="da-armory" type="button" data-armory="assault" aria-selected="true">◆ Assault</button><button class="da-armory" type="button" data-armory="breeding" aria-selected="false">✦ Breeding</button></div></div>
            <label class="da-field"><span>REWARD RECEIVED</span><select id="daRewardSelect" class="da-select">${initialOptions.map(optionMarkup).join("")}</select></label>
            <button id="daRecordButton" class="da-action" type="button">Record reward</button>
          </div>
          <div class="da-status">
            <div class="da-stat"><strong>${observations.length}</strong><span>RECORDED</span></div>
            <div class="da-stat"><strong>${solution.candidates.length}</strong><span>MODEL STATES</span></div>
            <div class="da-stat"><strong>${chestState().captureVerified ? "Replayed" : "Matching"}</strong><span>EVIDENCE</span></div>
          </div>
          <div class="da-history">${observations.length ? observations.map((observation, index) => `<span class="da-observation">${index + 1}${observation.isBonus ? " bonus" : ""}. ${observation.armory === "assault" ? "◆" : "✦"} ${escapeHTML(observation.reward.name || humaniseCode(observation.reward.code))}${observation.reward.amount === null ? "" : ` ${formatNumber(observation.reward.amount)}`}</span>`).join("") : `<span class="da-note">No DA rewards recorded yet.</span>`}</div>
          <div class="da-controls"><button id="daUndoButton" class="da-action da-action-secondary" type="button" ${observations.length ? "" : "disabled"}>Undo last</button><button id="daResetButton" class="da-action da-action-secondary" type="button" ${observations.length ? "" : "disabled"}>Reset</button></div>
        </section>
        <section class="da-summary">
          <div class="da-recommend">${escapeHTML(strategy.title)}</div>
          <div class="da-note">${escapeHTML(strategy.detail)}</div>
          <div class="da-note">Each column assumes all following regular openings use that armoury, with no bonus claims in between. Switching armouries or claiming a bonus changes the later rows; record it to recalculate. The list stops when the next reward is ambiguous.</div>
          <div class="da-key" aria-label="Reward rarity colour key">
            <span class="da-key-item"><i class="da-key-swatch da-key-epic"></i>Violet — Epic</span>
            <span class="da-key-item"><i class="da-key-swatch da-key-legendary"></i>Gold — Legendary</span>
            <span class="da-key-item"><i class="da-key-swatch da-key-mythic"></i>Platinum — Mythic</span>
          </div>
        </section>
        <details class="da-preferences">
          <summary><strong>My reward preferences</strong> — choose what you want or wish to avoid</summary>
          <div class="da-pref-list">${preferenceMarkup(assault, breeding)}</div>
        </details>
        <div class="da-table">
          <div class="da-cell da-head">#</div><div class="da-cell da-head da-head-assault">◆ Assault</div><div class="da-cell da-head da-head-breeding">✦ Breeding</div>
          ${Array.from({length: Math.max(displayAssault.length, displayBreeding.length)}, (_, index) => { const left = displayAssault[index] || {name:"Unresolved",exact:false}; return `
            <div class="da-cell da-number">${index + 1}</div>
            ${rewardMarkup(left, left.exact && index === 0)}${rewardMarkup(displayBreeding[index] || {name:"Unresolved",exact:false}, displayBreeding[index]?.exact && index === 0)}
          `; }).join("")}
        </div>
      </div>`;
      overlay.querySelector(".da-close")?.addEventListener("click", closePlanner);
      overlay.querySelectorAll(".da-tab").forEach(button => {
        button.addEventListener("click", () => {
          selectedChestType = button.dataset.chest;
          overlay.remove();
          open();
        });
      });
      let selectedArmory = defaultArmory;
      const rewardSelect = overlay.querySelector("#daRewardSelect");
      const refreshRewardOptions = () => {
        const options = rewardOptions(window.DoubleArmoryCore.catalogue(data.sides[selectedArmory], selectedChestType,
          overlay.querySelector('#daIsBonus').checked).map(decorate));
        rewardSelect.innerHTML = options.map(optionMarkup).join("");
        rewardSelect.dataset.armory = selectedArmory;
      };
      overlay.querySelector('#daIsBonus').addEventListener('change', refreshRewardOptions);
      overlay.querySelector('#daCaptureFile').addEventListener('change', async event => {
        const file = event.target.files?.[0];
        if (!file) return;
        const status = overlay.querySelector('#daImportStatus');
        if (!playerId) { status.textContent = 'Sign in before importing personal positions.'; return; }
        status.textContent = 'Reading privately and replaying captured drops…';
        const worker = new Worker('chest-har-import-worker.js?v=20261008-da-2');
        const importingPlayer = playerId;
        const importingState = JSON.stringify(playerState);
        const importingEvent = eventFingerprint(data);
        const timeout = setTimeout(() => { worker.terminate(); status.textContent = 'Import timed out. Please try again.'; }, 60000);
        worker.onerror = () => { clearTimeout(timeout); worker.terminate(); status.textContent = 'The private capture reader could not load.'; };
        worker.onmessage = async ({data: result}) => {
          clearTimeout(timeout); worker.terminate();
          try {
            if (result.type !== 'success') throw Error(result.message || 'Capture could not be read.');
            if (await resolvePlayerId() !== importingPlayer) throw Error('Account changed; import cancelled.');
            if (!overlay.isConnected || eventFingerprint() !== importingEvent || JSON.stringify(playerState) !== importingState)
              throw Error('The planner changed during import. Please select the capture again.');
            const prepared = window.DoubleArmoryCore.prepareCapture(data, result);
            for (const [type, value] of Object.entries(prepared.chests)) value.preferences = playerState.chests[type]?.preferences || {};
            playerState.chests = { ...playerState.chests, ...prepared.chests };
            savePlayerState();
            window.alert(`${prepared.verifiedDrops} captured drops replayed successfully. Your positions have been restored on this device.`);
            overlay.remove(); open();
          } catch (error) { status.textContent = error.message; }
        };
        worker.postMessage({type:'import',file});
      });
      overlay.querySelectorAll(".da-armory").forEach(button => {
        button.addEventListener("click", () => {
          selectedArmory = button.dataset.armory;
          overlay.querySelectorAll(".da-armory").forEach(candidate =>
            candidate.setAttribute("aria-selected", String(candidate === button))
          );
          refreshRewardOptions();
        });
      });
      overlay.querySelector("#daRecordButton")?.addEventListener("click", () => {
        const options = rewardOptions(window.DoubleArmoryCore.catalogue(data.sides[selectedArmory], selectedChestType,
          overlay.querySelector('#daIsBonus').checked).map(decorate));
        const reward = options[Number(rewardSelect.value)];
        if (!reward) {
          window.alert("Choose the reward you received first.");
          return;
        }
        const observation = { armory: selectedArmory, isBonus: overlay.querySelector('#daIsBonus').checked,
          reward: clone(reward), recordedAt: new Date().toISOString() };
        const proposed = [...chestState().observations, observation];
        const checked = window.DoubleArmoryCore.solve(data, selectedChestType, proposed, chestState().initialState || {});
        if (!checked.matched) { window.alert(`Not saved: ${checked.reason} Check the armoury, reward and bonus setting.`); return; }
        chestState().observations = proposed;
        savePlayerState();
        overlay.remove();
        open();
      });
      overlay.querySelector("#daUndoButton")?.addEventListener("click", () => {
        chestState().observations.pop();
        savePlayerState();
        overlay.remove();
        open();
      });
      overlay.querySelector("#daResetButton")?.addEventListener("click", () => {
        if (!window.confirm(`Reset your ${chest?.label || selectedChestType} DA progress?`)) return;
        chestState().observations = [];
        delete chestState().initialState;
        delete chestState().captureVerified;
        savePlayerState();
        overlay.remove();
        open();
      });
      overlay.querySelectorAll("[data-preference-key]").forEach(select => {
        select.addEventListener("change", () => {
          chestState().preferences[select.dataset.preferenceKey] = select.value;
          savePlayerState();
          overlay.remove();
          open();
        });
      });
      document.body.appendChild(overlay);
    } catch (error) {
      if (restoreLivePredictorOnClose) {
        livePredictorOverlay()?.classList.add("lp-open");
        livePredictorOverlay()?.setAttribute("aria-hidden", "false");
        restoreLivePredictorOnClose = false;
        document.body.style.overflow = "hidden";
      }
      console.error("[Double Armory] Planner could not open.", error);
      window.alert(`The Double Armory planner could not open: ${error?.message || "unknown error"}`);
    } finally {
      opening = false;
    }
  }

  function installButton() {
    ensureStyles();
    const data = getData();
    const eventCard = document.getElementById("lpEventName")?.closest(".lp-card");
    if (!eventCard) return;
    let button = document.getElementById(BUTTON_ID);
    if (!data?.ready) {
      button?.remove();
      return;
    }
    if (!button) {
      button = document.createElement("button");
      button.id = BUTTON_ID;
      button.type = "button";
      button.textContent = "Open Double Armory Planner";
      button.addEventListener("click", open);
      eventCard.appendChild(button);
    }
  }

  ["noir:event-imported", "noir:cloud-event-loaded", "chest-companion-live-predictor-updated"]
    .forEach(name => window.addEventListener(name, () => setTimeout(installButton, 0)));
  document.addEventListener("click", event => {
    if (event.target?.id === "openPlayerPredictorButton") setTimeout(installButton, 50);
  });
  new MutationObserver(() => installButton())
    .observe(document.documentElement, { childList: true, subtree: true });

  window.DoubleArmoryPlanner = Object.freeze({
    isReady: () => getAvailableChestTypes().length > 0,
    getData: () => clone(getData()),
    buildSequence: (armoryType, chestType) =>
      buildSequence(getData()?.sides?.[armoryType], chestType),
    getPlayerState: () => clone(playerState),
    open,
    installButton
  });
})(window);

