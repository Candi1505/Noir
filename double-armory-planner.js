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
  const CHEST_ICONS = { gold: "🥇", platinum: "💎", draconic: "🐉", freedom: "🦅" };
  let selectedChestType = "platinum";
  let restoreLivePredictorOnClose = false;

  const REWARD_NAMES = {
    breedingToken: "Breeding Tokens",
    elementalEmber: "Elemental Embers",
    electrumBar: "Electrum Bars",
    urbanflareSigil: "Urbanflare Sigils",
    blackPearl: "Black Pearls",
    fireShard: "Fire Shards",
    iceShard: "Ice Shards",
    expediteConsumable1: "1-Hour Speedups",
    expediteConsumable2: "1-Hour Speedups",
    expediteConsumable3: "3-Hour Speedups",
    expediteConsumable4: "12-Hour Speedups",
    increaseAttack1: "Tower Attack Boosts",
    increaseHP1: "Tower HP Boosts",
    innerFireConsumable: "Inner Fire",
    energyPack: "Energy Packs",
    dragonHealPotion: "Dragon Heal Potions",
    mysticFragment: "Mystic Fragments",
    chest0: "Freedom Chests",
    chest2: "Gold Chests",
    chest33: "Bronze Chests"
  };

  function livePredictorOverlay() {
    return document.getElementById("ccLivePredictorOverlay");
  }

  function hideLivePredictor() {
    const overlay = livePredictorOverlay();
    if (overlay?.classList.contains("lp-open")) {
      restoreLivePredictorOnClose = true;
      overlay.classList.remove("lp-open");
    }
  }

  function closePlanner() {
    document.getElementById(OVERLAY_ID)?.remove();
    if (restoreLivePredictorOnClose) {
      livePredictorOverlay()?.classList.add("lp-open");
      restoreLivePredictorOnClose = false;
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
  }

  function clone(value) {
    return value === undefined ? undefined : structuredClone(value);
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
      return `${gemstone[1][0].toUpperCase()}${gemstone[1].slice(1).toLowerCase()} Gemstones`;
    }
    return raw
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/[_-]+/g, " ")
      .replace(/\b\w/g, letter => letter.toUpperCase())
      .trim() || "Reward";
  }

  function getData() {
    const eventData =
      window.LivePredictorEngine?.getEventData?.() ||
      window.currentEventData ||
      null;
    return eventData?.doubleArmory || null;
  }

  function getAvailableChestTypes(data = getData()) {
    return Array.isArray(data?.availableChestTypes)
      ? data.availableChestTypes.filter(type =>
          data.sides?.assault?.chests?.[type]?.ready &&
          data.sides?.breeding?.chests?.[type]?.ready
        )
      : [];
  }

  function normaliseIndex(value, length) {
    if (!length) return 0;
    const numeric = Number(value);
    const safe = Number.isFinite(numeric) ? Math.floor(numeric) : 0;
    return ((safe % length) + length) % length;
  }

  function take(deckKey, side, cursors) {
    const deck = side?.decks?.[deckKey];
    if (!Array.isArray(deck) || !deck.length) return null;
    const index = normaliseIndex(
      cursors[deckKey] ?? side?.deckIndices?.[deckKey],
      deck.length
    );
    cursors[deckKey] = (index + 1) % deck.length;
    return { deckKey, index, value: deck[index] };
  }

  function resolve(deckKey, value, side, cursors, depth = 0) {
    if (depth > 8) return null;
    const definitions = side?.drops?.[deckKey];
    const definition = Array.isArray(definitions)
      ? definitions[Number(value)]
      : null;
    if (!definition) return null;

    const nestedKey = String(
      definition.id || definition.deck || definition.pool || ""
    );
    if (Array.isArray(side?.decks?.[nestedKey])) {
      const nested = take(nestedKey, side, cursors);
      return nested
        ? resolve(nestedKey, nested.value, side, cursors, depth + 1)
        : null;
    }

    const code = String(definition.id || definition.code || "");
    const rarity = String(
      definition.drop_type ||
      (deckKey.includes("mythic") ? "Mythic" :
        deckKey.includes("legendary") ? "Legendary" : "Epic")
    );
    return {
      name: humaniseCode(code),
      code,
      amount: Number.isFinite(Number(definition.mu)) ? Number(definition.mu) : null,
      rarity,
      score: rarity.toLowerCase() === "mythic" ? 50 :
        rarity.toLowerCase() === "legendary" ? 30 : 10
    };
  }

  function isFavourite(reward) {
    return /sigil|token|fragment|shard|mythic/i.test(
      `${reward?.name || ""} ${reward?.rarity || ""}`
    );
  }

  function buildSequence(side, chestType = selectedChestType, count = 100) {
    const chest = side?.chests?.[chestType];
    if (!side?.ready || !chest?.ready) return [];
    const mainKey = chest.mainKey;
    const mainDeck = side.decks?.[mainKey];
    if (!Array.isArray(mainDeck) || !mainDeck.length) return [];

    const cursors = { ...side.deckIndices };
    const start = normaliseIndex(side.deckIndices?.[mainKey], mainDeck.length);
    const rows = [];

    for (let offset = 0; offset < count; offset += 1) {
      const mainIndex = (start + offset) % mainDeck.length;
      let reward = null;
      try {
        reward = resolve(mainKey, mainDeck[mainIndex], side, cursors);
      } catch (error) {
        console.warn("[Double Armory] One reward could not be resolved.", error);
      }
      reward ||= {
          name: "Reward unavailable",
          code: "",
          amount: null,
          rarity: "Unknown",
          score: 0
        };
      rows.push({
        number: offset + 1,
        deckPosition: mainIndex + 1,
        ...reward,
        favourite: isFavourite(reward),
        bonusAfter: (offset + 1) % (chest.bonusEvery || 30) === 0
      });
    }
    return rows;
  }

  function recommendation(assault, breeding) {
    const left = assault?.[0];
    const right = breeding?.[0];
    if (!left || !right) return "Record your position to compare both armories.";
    if (left.score === right.score) {
      if (left.favourite !== right.favourite) {
        return left.favourite ? "Open Assault next" : "Open Breeding next";
      }
      return "Both next chests have the same rarity value";
    }
    return left.score > right.score ? "Open Assault next" : "Open Breeding next";
  }

  function ensureStyles() {
    if (document.getElementById("noirDoubleArmoryStyles")) return;
    const style = document.createElement("style");
    style.id = "noirDoubleArmoryStyles";
    style.textContent = `
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
      @media(max-width:600px){.da-shell{padding:0 8px 18px}.da-cell{padding:11px 7px}.da-name{font-size:13px}.da-meta{font-size:10px}.da-amount{font-size:12px}.da-table{grid-template-columns:38px minmax(0,1fr) minmax(0,1fr)}}
    `;
    document.head.appendChild(style);
  }

  function rewardMarkup(reward = {}) {
    const rarity = String(reward.rarity || "unknown").toLowerCase();
    return `
      <div class="da-cell da-${escapeHTML(rarity)} ${reward.favourite ? "da-favourite" : ""} ${reward.bonusAfter ? "da-bonus" : ""}">
        <div class="da-reward">
          <div class="da-name">${escapeHTML(reward.name)}</div>
          <div class="da-meta">${escapeHTML(reward.rarity)} • sequence ${formatNumber(reward.deckPosition)}/100</div>
          <div class="da-amount">${reward.amount === null ? "—" : formatNumber(reward.amount)}</div>
        </div>
      </div>`;
  }

  function open() {
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
      hideLivePredictor();
      const assault = buildSequence(data.sides.assault, selectedChestType);
      const breeding = buildSequence(data.sides.breeding, selectedChestType);
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
          ${available.map(type => `<button class="da-tab" type="button" data-chest="${escapeHTML(type)}" aria-selected="${type === selectedChestType}">${CHEST_ICONS[type] || "📦"} ${escapeHTML(data.sides.assault.chests[type].label)}</button>`).join("")}
        </nav>
        <section class="da-summary">
          <div class="da-recommend">${escapeHTML(recommendation(assault, breeding))}</div>
          <div class="da-note">Comparing ${escapeHTML(chest?.label || selectedChestType)} rewards. Assault and Breeding are detected automatically even when their event numbers change. The green line marks each ${chest?.bonusEvery || 30}-chest bonus point.</div>
          <div class="da-key" aria-label="Reward rarity colour key">
            <span class="da-key-item"><i class="da-key-swatch da-key-epic"></i>Violet — Epic</span>
            <span class="da-key-item"><i class="da-key-swatch da-key-legendary"></i>Gold — Legendary</span>
            <span class="da-key-item"><i class="da-key-swatch da-key-mythic"></i>Platinum — Mythic</span>
          </div>
        </section>
        <div class="da-table">
          <div class="da-cell da-head">#</div><div class="da-cell da-head da-head-assault">◆ Assault</div><div class="da-cell da-head da-head-breeding">✦ Breeding</div>
          ${assault.map((left, index) => `
            <div class="da-cell da-number">${index + 1}${left.bonusAfter ? " 🎁" : ""}</div>
            ${rewardMarkup(left)}${rewardMarkup(breeding[index])}
          `).join("")}
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
      document.body.appendChild(overlay);
    } catch (error) {
      console.error("[Double Armory] Planner could not open.", error);
      window.alert(`The Double Armory planner could not open: ${error?.message || "unknown error"}`);
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
    open,
    installButton
  });
})(window);
