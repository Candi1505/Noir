(() => {
  "use strict";

  const OVERLAY_ID = "onyxBaseCommandOverlay";
  const STORAGE_PREFIX = "onyxBaseLayoutV2";
  const LEGACY_STORAGE_PREFIX = "onyxBaseLayoutV1";
  const MERGE_STORAGE_PREFIX = "onyxTowerMergeV1";
  const REFERENCE_STORAGE_PREFIX = "onyxBaseReferenceV1";
  const ISLAND_COUNT = 8;
  const SLOTS_PER_ISLAND = 5;
  const TOTAL_SLOTS = ISLAND_COUNT * SLOTS_PER_ISLAND;
  const MAP_WIDTH = 760;
  const MAP_HEIGHT = 500;
  const MERGE_TRANSFER_RATE = 0.45;

  const MERGE_VALUE_WEIGHTS = Object.freeze({
    time: 0.002268982,
    piercing: 0,
    food: 0,
    elementalEmber: 3.3898,
    iceShard: 1.6949,
    fireShard: 1.6949,
    electrumBar: 5.0847,
    cosmicCharge: 3660,
    bloodstone: 11.17
  });

  const GEAR_SLOTS = Object.freeze([
    ["head", "Head"],
    ["chest", "Chest"],
    ["gloves", "Gloves"],
    ["pants", "Pants"],
    ["boots", "Boots"],
    ["weapons", "Weapon"],
    ["shield", "Shield"],
    ["rings", "Rings"]
  ]);

  const GEAR_RARITIES = Object.freeze([
    "Common", "Rare", "Epic", "Legendary", "Mythic", "Ascendant"
  ]);

  const PERCHES = Object.freeze([
    { name: "Riverwatch Perch", islands: [3, 4, 5] },
    { name: "Seagazer Perch", islands: [1, 2] },
    { name: "Stonespear Perch", islands: [6, 7] }
  ]);

  const PERCH_RIDER_EXCEPTIONS = new Set(["Freeda", "Vivian"]);

  const KNOWN_DRAGON_PERCH_BONUSES = Object.freeze({
    Aevros: { elementalResistance: "wind-10", towerBonus: "tower-health-15", specialBonus: "tower-ward-25" },
    Cerebron: { elementalResistance: "dark-10", towerBonus: "supershot-15", specialBonus: "refund-supershot-25" },
    Krygant: { elementalResistance: "ice-10", towerBonus: "tower-health-15", specialBonus: "tower-ward-25" },
    Xytheris: { elementalResistance: "fire-10", towerBonus: "supershot-15", specialBonus: "" },
    Rakmo: { elementalResistance: "dark-10", towerBonus: "tower-health-15", specialBonus: "" },
    Varuag: { elementalResistance: "ice-10", towerBonus: "tower-attack-10", specialBonus: "" },
    Simba: { elementalResistance: "earth-10", towerBonus: "tower-health-15", specialBonus: "tower-ward-25" },
    Nartaka: { elementalResistance: "dark-10", towerBonus: "tower-attack-10", specialBonus: "double-attack-20" }
  });

  const ISLANDS = Object.freeze([
    { name: "Gateway", form: "long", zone: "lower-right", x: 321, y: 340, width: 180, height: 108, tilt: 5 },
    { name: "Ember Bend", form: "bend-left", zone: "lower-right", x: 445, y: 260, width: 180, height: 108, tilt: -5 },
    { name: "Veil", form: "short", zone: "upper-right", x: 518, y: 92, width: 170, height: 104, tilt: 4 },
    { name: "Northglass Bend", form: "bend-right", zone: "upper-right", x: 338, y: 140, width: 170, height: 106, tilt: -5 },
    { name: "Pivot Reach", form: "long", zone: "upper-right", x: 293, y: 220, width: 176, height: 108, tilt: 6 },
    { name: "Goldwake Bend", form: "bend-left", zone: "left-run", x: 115, y: 310, width: 174, height: 108, tilt: -4 },
    { name: "Spire", form: "short", zone: "left-run", x: 82, y: 190, width: 166, height: 106, tilt: 4 },
    { name: "Command Crown", form: "long", zone: "left-run", x: 134, y: 78, width: 188, height: 108, tilt: -3 }
  ]);

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

  const TOWER_ICON_PATHS = Object.freeze({
    artillery: '<path d="M5 20h14M8 20l1-6h6l1 6M10 14V9l7-3 1.5 2.5-5 3.5"/><circle cx="10" cy="14" r="1.4"/>',
    energy: '<path d="M7 20h10M9 20l1-5h4l1 5M12.5 3 9 10h3l-1 5 5-8h-3l-.5-4Z"/>',
    flak: '<path d="M6 20h12M8 20l1-7h6l1 7M12 13V8M9 10l3-2 3 2M7 7l2 1M17 7l-2 1"/><circle cx="12" cy="6" r="1.5"/>',
    mage: '<path d="M6 20h12M8 20l2-8h4l2 8M12 12V7M9 8l3-4 3 4-3 2-3-2Z"/>',
    special: '<path d="M6 20h12M8 20l1.5-7h5L16 20M12 4l4 4-4 4-4-4 4-4Z"/><path d="M12 12v3"/>',
    tower: '<path d="M6 20h12M8 20V9l2 2 2-3 2 3 2-2v11M10 15h4M12 15v5"/>'
  });

  let activeTab = "intelligence";
  let selectedTower = "";
  let selectedLevel = 1;
  let selectedIsland = 0;
  let selectedSlot = null;
  let editorDraft = null;
  let selectedPerch = null;
  let perchDraft = null;
  let moveFrom = null;
  let pendingSwap = null;
  let layout = null;
  let savedSnapshot = null;
  let dirty = false;
  let profileSaved = false;
  let saveMessage = "";
  let inventorySnapshot = null;
  let mergeDraft = null;
  let mergeResult = null;
  let mergeMessage = "";
  let referencePhotos = [];
  let referenceMessage = "";
  let openedForUser = null;
  let cloudLoadedFor = null;
  let cloudLoadingFor = null;
  let lastFocused = null;

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
    return name
      ? `${formatNumber(rawAmount)} ${name}`
      : `${formatNumber(rawAmount)} · resource type unavailable`;
  }

  function icon(name, className = "") {
    if (name === "close") {
      return `<svg class="${escapeHtml(className)}" viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg>`;
    }
    if (name === "route") {
      return `<svg class="${escapeHtml(className)}" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-4 5-3 5-7s-5-3-5-7M19 5c0 4-5 3-5 7s5 3 5 7"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/></svg>`;
    }
    if (name === "shield") {
      return `<svg class="${escapeHtml(className)}" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.6-2.9 8-7 10-4.1-2-7-5.4-7-10V6l7-3Z"/><path d="M9 12h6M12 9v6"/></svg>`;
    }
    return `<svg class="${escapeHtml(className)}" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h16M6 20V9l3 2 3-5 3 5 3-2v11M9 15h6"/></svg>`;
  }

  function towerFamily(type) {
    const name = String(type || "").toLowerCase();
    if (/flak/.test(name)) return "flak";
    if (/mage|archmage/.test(name)) return "mage";
    if (/lightning|storm|volt/.test(name)) return "energy";
    if (/cannon|turret|howitzer|ballista|trebuchet|archer/.test(name)) return "artillery";
    if (/nexus|nullspire|orrery|pylon|soul|oculus/.test(name)) return "special";
    return "tower";
  }

  function towerIcon(type, className = "") {
    const family = towerFamily(type);
    return `<svg class="${escapeHtml(className)}" viewBox="0 0 24 24" aria-hidden="true">${TOWER_ICON_PATHS[family]}</svg>`;
  }

  function userId() {
    return window.OnyxCommandCore?.getCurrentUserId?.() || null;
  }

  function storageKey(prefix = STORAGE_PREFIX) {
    return `${prefix}:${userId() || "signed-out"}`;
  }

  function towerTypes() {
    const levels = catalogue().towerLevels || {};
    return Object.keys(levels)
      .filter(name => Array.isArray(levels[name]) && levels[name].length > 0)
      .filter(name => !/\bBoss\b/i.test(name))
      .sort((left, right) => left.localeCompare(right));
  }

  function canonicalTowerType(value) {
    const clean = String(value || "").trim().replace(/\s+/g, " ").slice(0, 80);
    if (!clean) return "";
    return towerTypes().find(type => type.toLowerCase() === clean.toLowerCase()) || clean;
  }

  function descriptionFor(type) {
    return catalogue().towers?.find(item => item?.name === type)?.description
      || "No verified description is available for this tower.";
  }

  function rowsFor(type) {
    const rows = catalogue().towerLevels?.[type];
    return Array.isArray(rows) ? rows : [];
  }

  function exactRow(type, level) {
    return rowsFor(type).find(row => Number(row?.level) === Number(level)) || null;
  }

  function maximumCatalogueLevel(type = "") {
    const rows = type ? rowsFor(type) : towerTypes().flatMap(rowsFor);
    return rows.reduce((maximum, row) => Math.max(maximum, Number(row?.level) || 0), 0);
  }

  function blankMergeDraft() {
    const types = towerTypes();
    return {
      destinationType: types[0] || "",
      destinationLevel: 1,
      sourceType: types[1] || types[0] || "",
      sourceLevel: 1,
      quantity: 1,
      maximumTowerLevel: maximumCatalogueLevel() || 250,
      previewResultLevel: ""
    };
  }

  function normaliseMergeDraft(value) {
    const source = value && typeof value === "object" ? value : {};
    const fallback = blankMergeDraft();
    const wholeNumber = (number, minimum, maximum, defaultValue) => {
      const parsed = Number.parseInt(number, 10);
      return Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
        ? parsed
        : defaultValue;
    };
    const previewText = String(source.previewResultLevel ?? "").trim();
    return {
      destinationType: towerTypes().includes(source.destinationType)
        ? source.destinationType
        : fallback.destinationType,
      destinationLevel: wholeNumber(source.destinationLevel, 1, 999, fallback.destinationLevel),
      sourceType: towerTypes().includes(source.sourceType)
        ? source.sourceType
        : fallback.sourceType,
      sourceLevel: wholeNumber(source.sourceLevel, 1, 999, fallback.sourceLevel),
      quantity: wholeNumber(source.quantity, 1, 100, 1),
      maximumTowerLevel: wholeNumber(
        source.maximumTowerLevel,
        1,
        999,
        fallback.maximumTowerLevel
      ),
      previewResultLevel: previewText
        ? wholeNumber(previewText, 1, 999, "")
        : ""
    };
  }

  function readMergeDraft() {
    try {
      mergeDraft = normaliseMergeDraft(
        JSON.parse(localStorage.getItem(storageKey(MERGE_STORAGE_PREFIX)) || "null")
      );
    } catch (error) {
      mergeDraft = blankMergeDraft();
    }
    mergeResult = null;
    mergeMessage = "";
  }

  function saveMergeDraft() {
    if (!mergeDraft) return;
    localStorage.setItem(
      storageKey(MERGE_STORAGE_PREFIX),
      JSON.stringify(normaliseMergeDraft(mergeDraft))
    );
  }

  function readReferencePhotos() {
    try {
      const storedText = localStorage.getItem(storageKey(REFERENCE_STORAGE_PREFIX));
      let value = JSON.parse(storedText || "[]");
      if (!storedText) {
        const legacy = JSON.parse(localStorage.getItem("noirBasePlannerV1") || "null");
        const legacyLayout = Array.isArray(legacy?.layouts)
          ? legacy.layouts.find(item => item?.id === legacy.activeId) || legacy.layouts[0]
          : null;
        value = legacyLayout?.referencePhotos || [];
      }
      referencePhotos = Array.isArray(value)
        ? value.filter(photo => typeof photo === "string" && photo.startsWith("data:image/")).slice(0, 4)
        : [];
      if (!storedText && referencePhotos.length) {
        saveReferencePhotos();
        referenceMessage = "Your previous private reference board was brought into Onyx on this device.";
        return;
      }
    } catch (error) {
      referencePhotos = [];
    }
    referenceMessage = "";
  }

  function saveReferencePhotos() {
    try {
      if (referencePhotos.length) {
        localStorage.setItem(storageKey(REFERENCE_STORAGE_PREFIX), JSON.stringify(referencePhotos));
      } else {
        localStorage.removeItem(storageKey(REFERENCE_STORAGE_PREFIX));
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  function prepareReferencePhoto(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = reject;
      reader.onload = () => {
        const image = new Image();
        image.onerror = reject;
        image.onload = () => {
          const maximumSide = 1400;
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
          resolve(canvas.toDataURL("image/jpeg", 0.78));
        };
        image.src = String(reader.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function mergeUpgradeValue(row) {
    let value = (Number(row?.seconds) || 0) * MERGE_VALUE_WEIGHTS.time;
    String(row?.cost || "").split(/[|;]/).forEach(part => {
      const [resource, amount] = part.split(":");
      value += (Number(amount) || 0) * (MERGE_VALUE_WEIGHTS[resource] || 0);
    });
    return value;
  }

  function accumulatedTowerValue(type, level) {
    return rowsFor(type)
      .filter(row => Number(row?.level) <= Number(level))
      .reduce((sum, row) => sum + mergeUpgradeValue(row), 0);
  }

  function accumulatedTowerXp(type, level) {
    return rowsFor(type)
      .filter(row => Number(row?.level) <= Number(level))
      .reduce((sum, row) => sum + (Number(row?.xp) || 0), 0);
  }

  function estimateMerge(value) {
    const draft = normaliseMergeDraft(value);
    const destinationRows = rowsFor(draft.destinationType);
    const sourceRows = rowsFor(draft.sourceType);
    if (!destinationRows.length || !sourceRows.length) {
      return { ok: false, message: "Choose two towers with verified catalogue rows." };
    }
    if (!exactRow(draft.destinationType, draft.destinationLevel)) {
      return { ok: false, message: `No exact ${draft.destinationType} level ${draft.destinationLevel} row is available.` };
    }
    if (!exactRow(draft.sourceType, draft.sourceLevel)) {
      return { ok: false, message: `No exact ${draft.sourceType} level ${draft.sourceLevel} row is available.` };
    }
    const catalogueCap = maximumCatalogueLevel(draft.destinationType);
    const effectiveCap = Math.min(draft.maximumTowerLevel, catalogueCap);
    if (draft.destinationLevel > effectiveCap || draft.sourceLevel > draft.maximumTowerLevel) {
      return { ok: false, message: "A tower level cannot exceed the tower cap entered for this merge." };
    }

    const destinationValue = accumulatedTowerValue(
      draft.destinationType,
      draft.destinationLevel
    );
    const sourceValue = accumulatedTowerValue(draft.sourceType, draft.sourceLevel);
    const transferredValue = sourceValue * draft.quantity * MERGE_TRANSFER_RATE;
    const availableValue = destinationValue + transferredValue;
    const modelResultLevel = destinationRows
      .filter(row =>
        Number(row?.level) <= effectiveCap &&
        accumulatedTowerValue(draft.destinationType, row.level) <= availableValue
      )
      .reduce(
        (highest, row) => Math.max(highest, Number(row?.level) || 0),
        draft.destinationLevel
      );

    const previewLevel = draft.previewResultLevel === ""
      ? null
      : Number(draft.previewResultLevel);
    if (previewLevel !== null) {
      if (previewLevel < draft.destinationLevel || previewLevel > effectiveCap) {
        return { ok: false, message: "The WD preview level must be between the kept tower level and the entered tower cap." };
      }
      if (!exactRow(draft.destinationType, previewLevel)) {
        return { ok: false, message: `No exact ${draft.destinationType} level ${previewLevel} row is available for the WD preview.` };
      }
    }

    const resultLevel = previewLevel ?? modelResultLevel;
    const destinationXp = accumulatedTowerXp(
      draft.destinationType,
      draft.destinationLevel
    );
    const sourceXpEach = accumulatedTowerXp(draft.sourceType, draft.sourceLevel);
    const sourceXp = sourceXpEach * draft.quantity;
    const resultXp = accumulatedTowerXp(draft.destinationType, resultLevel);
    const xpDebt = Math.max(0, destinationXp + sourceXp - resultXp);

    return {
      ok: true,
      ...draft,
      transferRate: MERGE_TRANSFER_RATE,
      destinationValue,
      sourceValue,
      transferredValue,
      availableValue,
      catalogueCap,
      effectiveCap,
      modelResultLevel,
      previewLevel,
      resultLevel,
      resultSource: previewLevel === null ? "model" : "wd-preview",
      levelsGained: Math.max(0, resultLevel - draft.destinationLevel),
      destinationXp,
      sourceXpEach,
      sourceXp,
      combinedXp: destinationXp + sourceXp,
      resultXp,
      xpDebt,
      capped: modelResultLevel === effectiveCap && effectiveCap < catalogueCap
    };
  }

  function monumentItems(kind = "") {
    const items = Array.isArray(catalogue().monumentItems) ? catalogue().monumentItems : [];
    return kind ? items.filter(item => item?.kind === kind) : items;
  }

  function monumentItem(kind, name) {
    return monumentItems(kind).find(item => item?.name === name) || null;
  }

  function defensiveRiders() {
    const riders = Array.isArray(catalogue().riders) ? catalogue().riders : [];
    return riders.filter(rider => rider?.defensive || PERCH_RIDER_EXCEPTIONS.has(rider?.name));
  }

  function riderSkills() {
    return Array.isArray(catalogue().riderSkills) ? catalogue().riderSkills : [];
  }

  function riderGear(slot = "") {
    const gear = Array.isArray(catalogue().riderGear) ? catalogue().riderGear : [];
    return slot ? gear.filter(item => item?.slot === slot) : gear;
  }

  function dragons() {
    return Array.isArray(catalogue().dragons) ? catalogue().dragons : [];
  }

  function blankSlots() {
    return Array.from({ length: TOTAL_SLOTS }, () => null);
  }

  function blankGear() {
    return Object.fromEntries(GEAR_SLOTS.map(([slot]) => [slot, null]));
  }

  function blankPerches() {
    return PERCHES.map(perch => ({
      name: perch.name,
      level: 0,
      dragonName: "",
      dragonClass: "",
      dragonTier: "",
      dragonLevel: 0,
      riderName: "",
      riderLevel: 0,
      elementalResistance: "",
      towerBonus: "",
      specialBonus: "",
      skills: [],
      gear: blankGear()
    }));
  }

  function cleanText(value, maximum = 120) {
    return String(value || "").trim().replace(/\s+/g, " ").slice(0, maximum);
  }

  function cleanWholeNumber(value, minimum = 0, maximum = 999) {
    const number = Number.parseInt(value, 10);
    return Number.isInteger(number) && number >= minimum && number <= maximum
      ? number
      : minimum;
  }

  function normaliseMonument(value, legacyName, legacyLevel) {
    const name = cleanText(value?.name || legacyName, 120);
    if (!name) return null;
    return {
      name,
      level: cleanWholeNumber(value?.level ?? legacyLevel, 1, 99)
    };
  }

  function normaliseTower(value) {
    if (!value || typeof value !== "object") return null;
    const type = canonicalTowerType(value.type);
    const level = Number.parseInt(value.level, 10);
    if (!type || !Number.isInteger(level) || level < 1 || level > 999) return null;
    return {
      type,
      level,
      notes: String(value.notes || "").trim().slice(0, 250),
      rune: normaliseMonument(
        value.rune,
        typeof value.rune === "string" ? value.rune : value.runes,
        value.runeLevel
      ),
      glyph: normaliseMonument(value.glyph, typeof value.glyph === "string" ? value.glyph : "", value.glyphLevel),
      relic: normaliseMonument(value.relic, typeof value.relic === "string" ? value.relic : "", value.relicLevel)
    };
  }

  function normaliseGear(value) {
    if (!value || typeof value !== "object") return null;
    const name = cleanText(value.name, 120);
    if (!name) return null;
    return {
      name,
      rarity: cleanText(value.rarity, 32),
      level: cleanWholeNumber(value.level, 0, 99)
    };
  }

  function normalisePerch(value, index) {
    const defaults = blankPerches()[index];
    const safe = value && typeof value === "object" ? value : {};
    const legacySkills = Array.isArray(safe.riderSkills)
      ? safe.riderSkills.map(name => ({ name, level: safe.riderSkillLevels?.[name] }))
      : [];
    const sourceSkills = Array.isArray(safe.skills) ? safe.skills : legacySkills;
    const skills = sourceSkills.slice(0, 32).map(skill => {
      const name = cleanText(typeof skill === "string" ? skill : skill?.name, 120);
      if (!name) return null;
      const definition = riderSkills().find(item => item?.name === name);
      return {
        name,
        level: cleanWholeNumber(
          typeof skill === "string" ? definition?.maximumLevel : skill?.level,
          1,
          Math.max(1, Number(definition?.maximumLevel) || 99)
        )
      };
    }).filter(Boolean);
    const sourceGear = safe.gear && typeof safe.gear === "object"
      ? safe.gear
      : safe.riderGear && typeof safe.riderGear === "object"
        ? safe.riderGear
        : {};
    return {
      ...defaults,
      name: defaults.name,
      level: cleanWholeNumber(safe.level, 0, 999),
      dragonName: cleanText(safe.dragonName, 120),
      dragonClass: cleanText(safe.dragonClass, 40),
      dragonTier: cleanText(safe.dragonTier, 80),
      dragonLevel: cleanWholeNumber(safe.dragonLevel, 0, 999),
      riderName: cleanText(safe.riderName, 120),
      riderLevel: cleanWholeNumber(safe.riderLevel, 0, 999),
      elementalResistance: cleanText(safe.elementalResistance, 40),
      towerBonus: cleanText(safe.towerBonus, 40),
      specialBonus: cleanText(safe.specialBonus, 40),
      skills,
      gear: Object.fromEntries(GEAR_SLOTS.map(([slot]) => [slot, normaliseGear(sourceGear[slot])]))
    };
  }

  function normaliseLayout(value) {
    if (
      !value ||
      typeof value !== "object" ||
      !Array.isArray(value.slots) ||
      value.slots.length !== TOTAL_SLOTS
    ) return null;
    return {
      version: 2,
      name: String(value.name || "My Base").trim().slice(0, 60) || "My Base",
      slots: Array.from({ length: TOTAL_SLOTS }, (_, index) => normaliseTower(value.slots[index])),
      perches: Array.from({ length: PERCHES.length }, (_, index) =>
        normalisePerch(Array.isArray(value.perches) ? value.perches[index] : null, index)
      ),
      updatedAt: String(value.updatedAt || new Date().toISOString())
    };
  }

  function createLayout(name = "My Base") {
    return {
      version: 2,
      name: String(name || "My Base").trim().slice(0, 60) || "My Base",
      slots: blankSlots(),
      perches: blankPerches(),
      updatedAt: new Date().toISOString()
    };
  }

  function comparableLayout(value) {
    return value ? JSON.stringify({ name: value.name, slots: value.slots, perches: value.perches }) : "";
  }

  function updateDraftState() {
    dirty = Boolean(layout) && comparableLayout(layout) !== comparableLayout(savedSnapshot);
    profileSaved = Boolean(savedSnapshot) && !dirty;
  }

  function readLocal() {
    const cachedSaved = cloudLoadedFor === userId()
      ? clone(savedSnapshot)
      : null;
    try {
      const current = localStorage.getItem(storageKey());
      const legacy = localStorage.getItem(storageKey(LEGACY_STORAGE_PREFIX));
      layout = normaliseLayout(JSON.parse(current || legacy || "null"));
    } catch (error) {
      layout = null;
    }
    savedSnapshot = cachedSaved;
    if (!layout && cachedSaved) layout = clone(cachedSaved);
    updateDraftState();
  }

  function saveLocal() {
    if (!layout) {
      localStorage.removeItem(storageKey());
      localStorage.removeItem(storageKey(LEGACY_STORAGE_PREFIX));
      return;
    }
    layout.updatedAt = new Date().toISOString();
    localStorage.setItem(storageKey(), JSON.stringify(layout));
    localStorage.removeItem(storageKey(LEGACY_STORAGE_PREFIX));
  }

  function markDirty(message = "Draft stored on this device.") {
    if (!layout) return;
    saveLocal();
    updateDraftState();
    saveMessage = message;
  }

  async function loadCloud() {
    const id = userId();
    if (!id || cloudLoadedFor === id || cloudLoadingFor === id) return;
    const loader = window.ChestDatabase?.loadOnyxBaseLayout;
    if (typeof loader !== "function") return;
    cloudLoadingFor = id;
    try {
      const cloud = normaliseLayout(await loader.call(window.ChestDatabase));
      cloudLoadedFor = id;
      if (cloud) {
        savedSnapshot = clone(cloud);
        const localIsNewer = layout && Date.parse(layout.updatedAt) > Date.parse(cloud.updatedAt);
        if (!layout || !localIsNewer) layout = clone(cloud);
        updateDraftState();
        saveMessage = dirty
          ? "A newer device draft is open. Save it to update your profile."
          : "Saved profile layout loaded.";
        saveLocal();
        render();
      } else {
        savedSnapshot = null;
        updateDraftState();
      }
    } catch (error) {
      console.warn("[Onyx Base] The saved profile layout could not be loaded.", error);
    } finally {
      cloudLoadingFor = null;
    }
  }

  async function saveCloud() {
    if (!layout) return false;
    layout.name = String(layout.name || "My Base").trim().slice(0, 60) || "My Base";
    saveLocal();
    saveMessage = "Saving to your Onyx profile…";
    render();
    const saver = window.ChestDatabase?.saveOnyxBaseLayout;
    if (typeof saver !== "function") {
      saveMessage = "Draft stored on this device; profile sync is unavailable.";
      updateDraftState();
      render();
      return false;
    }
    try {
      const saved = normaliseLayout(await saver.call(window.ChestDatabase, clone(layout))) || clone(layout);
      layout = saved;
      savedSnapshot = clone(saved);
      cloudLoadedFor = userId();
      updateDraftState();
      saveLocal();
      saveMessage = `Saved to your Onyx profile · ${new Date().toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" })}`;
      render();
      return true;
    } catch (error) {
      saveMessage = "Draft stored on this device; profile sync is unavailable.";
      updateDraftState();
      render();
      console.warn("[Onyx Base] Profile sync failed.", error);
      return false;
    }
  }

  function normaliseInventorySnapshot(value) {
    const source = Array.isArray(value?.records)
      ? value.records
      : Array.isArray(value?.towers)
        ? value.towers
        : [];
    const grouped = new Map();
    source.forEach(item => {
      const type = canonicalTowerType(item?.type);
      const level = Number.parseInt(item?.level, 10);
      const quantity = Math.max(1, Math.min(500, Number.parseInt(item?.quantity, 10) || 1));
      if (!type || !Number.isInteger(level) || level < 1 || level > 999) return;
      const location = item?.location === "storage" ? "storage" : item?.location === "base" ? "base" : "available";
      const key = `${type}\u0000${level}\u0000${location}`;
      const existing = grouped.get(key);
      if (existing) existing.quantity += quantity;
      else grouped.set(key, { type, level, location, quantity });
    });
    const records = Array.from(grouped.values()).sort((left, right) =>
      left.location.localeCompare(right.location)
      || left.type.localeCompare(right.type)
      || right.level - left.level
    );
    return {
      importedAt: String(value?.importedAt || new Date().toISOString()),
      records
    };
  }

  function refreshInventory(value = window.OnyxTowerInventoryBridge?.getSnapshot?.()) {
    inventorySnapshot = value ? normaliseInventorySnapshot(value) : null;
  }

  function inventoryRecords() {
    return inventorySnapshot?.records || [];
  }

  function placedCount(type, level, excludedSlot = null) {
    return layout?.slots.reduce((total, tower, index) =>
      total + (index !== excludedSlot && tower?.type === type && Number(tower.level) === Number(level) ? 1 : 0), 0
    ) || 0;
  }

  function availableInventory(record, excludedSlot = null) {
    const records = inventoryRecords();
    const recordIndex = records.indexOf(record);
    const earlierQuantity = records.slice(0, Math.max(0, recordIndex))
      .filter(candidate =>
        candidate.type === record.type &&
        Number(candidate.level) === Number(record.level)
      )
      .reduce((sum, candidate) => sum + Number(candidate.quantity || 0), 0);
    const allocatedHere = Math.max(
      0,
      placedCount(record.type, record.level, excludedSlot) - earlierQuantity
    );
    return Math.max(0, Number(record.quantity) - allocatedHere);
  }

  function inventorySummary() {
    const records = inventoryRecords();
    return {
      groups: records.length,
      towers: records.reduce((sum, record) => sum + Number(record.quantity || 0), 0)
    };
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
    return parts.length
      ? parts.join(" · ")
      : "A restriction is recorded, but no verified player-facing limit is available.";
  }

  function normalKey(value) {
    return String(value || "").toLowerCase().replace(/\btower\b/g, "").replace(/[^a-z0-9]/g, "");
  }

  function effectValue(effect, level, maximumLevel = 1) {
    const values = Array.isArray(effect?.values)
      ? effect.values.map(Number).filter(Number.isFinite)
      : [];
    if (values.length) {
      const index = Math.max(0, Math.min(values.length - 1, Number.parseInt(level, 10) - 1));
      return Number(values[index]) || 0;
    }
    const chosenLevel = Math.max(1, Math.min(
      Number(maximumLevel) || 1,
      Number.parseInt(level, 10) || 1
    ));
    return (Number(effect?.base) || 0) +
      (Number(effect?.perLevel) || 0) * Math.max(0, chosenLevel - 1);
  }

  function modifierBucket(value) {
    const text = String(value || "").toLowerCase();
    if (/building.*(?:hp|health)|(?:hp|health).*building/.test(text)) return "hp";
    if (/building.*(?:atk|attack|damage)|(?:atk|attack|damage).*building/.test(text)) return "attack";
    return "";
  }

  function monumentModifierBucket(value) {
    const text = String(value || "").toLowerCase();
    if (/\bhp\b|health/.test(text)) return "hp";
    if (/\batk\b|\battack\b/.test(text)) return "attack";
    return "";
  }

  function monumentEffectApplies(effect, tower) {
    const text = normalKey(effect?.text);
    if (!text) return false;
    const towerKey = normalKey(tower?.type);
    const namedTower = (Array.isArray(catalogue().towers) ? catalogue().towers : [])
      .map(item => normalKey(item?.name))
      .filter(key => key.length >= 4)
      .find(key => text.includes(key));
    return !namedTower || text.includes(towerKey) || towerKey.includes(namedTower);
  }

  function monumentModifier(tower) {
    let hp = 0;
    let attack = 0;
    for (const [kind, selection] of [["Rune", tower?.rune], ["Glyph", tower?.glyph], ["Relic", tower?.relic]]) {
      if (!selection?.name || selection.level < 1) continue;
      const item = monumentItem(kind, selection.name);
      item?.effects?.forEach(effect => {
        if (!monumentEffectApplies(effect, tower)) return;
        const bucket = monumentModifierBucket(effect?.text);
        if (!bucket) return;
        const value = effectValue(effect, selection.level, item.maximumLevel);
        if (bucket === "hp") hp += value;
        if (bucket === "attack") attack += value;
      });
    }
    return { hp, attack };
  }

  const RIDER_TOWER_KEYS = Object.freeze({
    elementalflakdark: "darkflak",
    elementalflakfire: "fireflak",
    elementalflakice: "iceflak",
    elementalflakwind: "electroflak",
    elementalflakearth: "earthflak",
    crystalhowitzer: "crystalhowitzer",
    burntower: "fireturret",
    fireturret: "fireturret",
    draintower: "drakulpylon",
    souldraintower: "souldrain",
    nexustower: "nexus",
    nullspire: "nullspire",
    magetowersuper: "redarchmage",
    magebluetowersuper: "bluearchmage",
    magetower: "redmage",
    magebluetower: "bluemage",
    lightningtowersuper: "chargedvolt",
    e20q4tower: "cosmicorrery"
  });

  function riderEffectApplies(type, tower) {
    const specific = String(type || "").split("_")[1];
    if (!specific) return true;
    const expected = RIDER_TOWER_KEYS[normalKey(specific)] || normalKey(specific);
    const actual = normalKey(tower?.type);
    return actual.includes(expected) || expected.includes(actual);
  }

  function riderModifier(tower, perch) {
    if (!perch?.level || !perch?.dragonName || !perch?.riderName) return { hp: 0, attack: 0 };
    let hp = 0;
    let attack = 0;
    perch.skills.forEach(selection => {
      const skill = riderSkills().find(item => item?.name === selection?.name);
      skill?.effects?.forEach(effect => {
        if (!riderEffectApplies(effect?.type, tower)) return;
        const bucket = modifierBucket(effect?.type);
        if (!bucket) return;
        const value = effectValue(effect, selection.level, skill.maximumLevel);
        if (bucket === "hp") hp += value;
        if (bucket === "attack") attack += value;
      });
    });
    Object.values(perch.gear || {}).forEach(selection => {
      if (!selection?.name || selection.level < 1) return;
      const item = riderGear().find(entry => entry?.name === selection.name);
      const variants = Array.isArray(item?.variants) ? item.variants : [];
      const variant = variants.find(entry => entry?.rarity === selection.rarity)
        || (variants.length === 1 ? variants[0] : null);
      variant?.effects?.forEach(effect => {
        if (!riderEffectApplies(effect?.type, tower)) return;
        const bucket = modifierBucket(effect?.type);
        if (!bucket) return;
        const value = effectValue(effect, selection.level, variant.maximumLevel);
        if (bucket === "hp") hp += value;
        if (bucket === "attack") attack += value;
      });
    });
    return { hp, attack };
  }

  function coveringPerch(towerIndex, perches = layout?.perches || []) {
    const islandIndex = Math.floor(Number(towerIndex) / SLOTS_PER_ISLAND);
    const configIndex = PERCHES.findIndex(perch => perch.islands.includes(islandIndex));
    return configIndex >= 0 ? perches?.[configIndex] || null : null;
  }

  function perchModifier(perch) {
    if (!perch?.level || !perch?.dragonName) return { hp: 0, attack: 0 };
    return {
      hp: perch.towerBonus === "tower-health-15" ? 0.15 : 0,
      attack: perch.towerBonus === "tower-attack-10" ? 0.1 : 0
    };
  }

  function towerEstimateDetails(tower, towerIndex = 0, perches = layout?.perches || []) {
    if (!tower) return null;
    const row = exactRow(tower.type, tower.level);
    const base = Number(row?.power);
    if (!Number.isFinite(base) || base < 0) return null;
    const monument = monumentModifier(tower);
    const perch = coveringPerch(towerIndex, perches);
    const rider = riderModifier(tower, perch);
    const perchBonus = perchModifier(perch);
    const gain = modifier => base * (Number(modifier.hp || 0) + Number(modifier.attack || 0)) / 2;
    const monumentGain = gain(monument);
    const riderGain = gain(rider);
    const perchGain = gain(perchBonus);
    return {
      base,
      monumentGain,
      riderGain,
      perchGain,
      value: Math.max(0, Math.round(base + monumentGain + riderGain + perchGain))
    };
  }

  function towerEstimate(tower, towerIndex = 0, perches = layout?.perches || []) {
    return towerEstimateDetails(tower, towerIndex, perches)?.value ?? null;
  }

  function estimateSlots(slots, startIndex = 0, perches = layout?.perches || []) {
    return (Array.isArray(slots) ? slots : []).reduce((summary, tower, index) => {
      if (!tower) return summary;
      summary.placed += 1;
      const detail = towerEstimateDetails(tower, startIndex + index, perches);
      if (detail === null) summary.unavailable += 1;
      else {
        summary.known += 1;
        summary.value += detail.value;
        summary.baseValue += detail.base;
        summary.monumentGain += detail.monumentGain;
        summary.riderGain += detail.riderGain;
        summary.perchGain += detail.perchGain;
      }
      return summary;
    }, {
      value: 0,
      baseValue: 0,
      monumentGain: 0,
      riderGain: 0,
      perchGain: 0,
      placed: 0,
      known: 0,
      unavailable: 0
    });
  }

  function islandSlots(sourceLayout, islandIndex) {
    const start = islandIndex * SLOTS_PER_ISLAND;
    return sourceLayout?.slots.slice(start, start + SLOTS_PER_ISLAND)
      || blankSlots().slice(0, SLOTS_PER_ISLAND);
  }

  function estimateText(summary) {
    if (!summary.placed) return "≈ 0";
    if (!summary.known) return "Unavailable";
    return `≈ ${formatNumber(summary.value)}${summary.unavailable ? " · partial" : ""}`;
  }

  function estimateCoverage(summary) {
    if (!summary.placed) return "No towers placed";
    if (!summary.unavailable) return `${summary.known}/${summary.placed} exact catalogue rows`;
    return `${summary.known}/${summary.placed} estimated · ${summary.unavailable} unavailable`;
  }

  function estimateDelta(current, baseline) {
    if (!baseline || current.unavailable || baseline.unavailable) return "";
    const delta = current.value - baseline.value;
    if (!delta) return "Estimated change 0";
    return `Estimated change ${delta > 0 ? "+" : "−"}${formatNumber(Math.abs(delta))}`;
  }

  function renderEstimateMetric(label, summary, baseline = null) {
    return `<article class="obc-dp-metric ${summary.unavailable ? "partial" : ""}">
      <small>${escapeHtml(label)}</small>
      <strong>${escapeHtml(estimateText(summary))}</strong>
      <span>${escapeHtml(estimateDelta(summary, baseline) || estimateCoverage(summary))}</span>
    </article>`;
  }

  function renderEstimateBreakdown(summary) {
    return `<div class="obc-estimate-breakdown" aria-label="Estimated DP breakdown">
      <article><small>Base tower rows</small><strong>${formatNumber(Math.round(summary.baseValue))}</strong></article>
      <article><small>Runes · glyphs · relics</small><strong>+${formatNumber(Math.round(summary.monumentGain))}</strong></article>
      <article><small>Defensive rider + gear</small><strong>+${formatNumber(Math.round(summary.riderGain))}</strong></article>
      <article><small>Perch tower bonus</small><strong>+${formatNumber(Math.round(summary.perchGain))}</strong></article>
    </div>`;
  }

  function renderInventoryState(compact = false) {
    const summary = inventorySummary();
    if (!summary.towers) {
      return `<section class="obc-inventory-state empty ${compact ? "compact" : ""}">
        ${icon("shield")}
        <div><strong>Published tower catalogue ready</strong><p>Verified tower types and exact level rows are available. Each player records their own inventory and island layout manually.</p></div>
        <span class="obc-source-chip">SANITISED SOURCE</span>
      </section>`;
    }
    return `<section class="obc-inventory-state ready ${compact ? "compact" : ""}">
      ${icon("shield")}
      <div><strong>Owner tower snapshot ready</strong><p>${formatNumber(summary.towers)} tower record${summary.towers === 1 ? "" : "s"} across ${formatNumber(summary.groups)} exact type and level group${summary.groups === 1 ? "" : "s"}. Placement is still entirely manual.</p></div>
      <span class="obc-source-chip">OWNER SESSION</span>
    </section>`;
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
        <p>Exact catalogue names, descriptions, level rows, costs, build times, unlocks and recorded restrictions. No island layout is inferred.</p>
      </section>

      ${renderInventoryState(true)}

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
        <div class="obc-intel-hero">
          <span>${towerIcon(selectedTower)}</span>
          <p class="obc-description">${escapeHtml(descriptionFor(selectedTower))}</p>
        </div>

        ${row ? `
          <div class="obc-stat-grid">
            <article><small>Catalogue power</small><strong>${formatNumber(row.power)}</strong></article>
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
          ${next ? `<p class="obc-next-level">Next exact level: ${next.level} · ${escapeHtml(formatCost(next.cost))} · ${escapeHtml(formatDuration(next.seconds))}</p>` : '<p class="obc-next-level">No next-level data is available.</p>'}
        ` : `
          <div class="obc-no-evidence">
            <strong>No exact row for level ${escapeHtml(selectedLevel)}</strong>
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
        <strong>Island geometry always remains manual.</strong>
        <p>Tower intelligence validates a manually entered type and exact level against the published catalogue. It never decides where that tower belongs.</p>
      </section>
    `;
  }

  function renderBuilderPrompt() {
    return `
      <section class="obc-builder-empty">
        <div class="obc-empty-orbit">${icon("route")}</div>
        <p>TACTICAL MAP REQUIRED</p>
        <h3>Chart your islands manually</h3>
        <p>Published intelligence knows which tower types and exact level rows exist, but it does not know a player's inventory or home-base island layout. Onyx will never guess where a tower sits. Open each island and build it manually.</p>
        ${renderInventoryState(true)}
        <label>Base name
          <input id="obcNewLayoutName" maxlength="60" value="My Base" autocomplete="off">
        </label>
        <div class="obc-empty-actions">
          <button id="obcCreateLayout" class="primary" type="button">Build manual layout</button>
        </div>
      </section>
    `;
  }

  function islandStyle(island) {
    return [
      `--island-left:${(island.x / MAP_WIDTH) * 100}%`,
      `--island-top:${(island.y / MAP_HEIGHT) * 100}%`,
      `--island-width:${(island.width / MAP_WIDTH) * 100}%`,
      `--island-height:${(island.height / MAP_HEIGHT) * 100}%`,
      `--island-tilt:${island.tilt}deg`
    ].join(";");
  }

  function renderRouteMap() {
    return `
      <section class="obc-route-panel">
        <div class="obc-section-heading obc-map-heading">
          <div><p>DEFENCE ROUTE SCHEMATIC</p><h3>Dragon flight path</h3></div>
          <span>Tap an island</span>
        </div>
        ${moveFrom !== null ? `
          <div class="obc-move-banner" role="status">
            ${towerIcon(layout.slots[moveFrom]?.type)}
            <div><strong>Move mode active</strong><p>Choose an island, then tap the destination spot.</p></div>
            <button id="obcCancelMove" type="button">Cancel</button>
          </div>
        ` : ""}
        <div class="obc-route-map" aria-label="Eight-section dragon flight route from the lower right through the eastern bends and up the western island">
          <svg class="obc-route-lines" viewBox="0 0 ${MAP_WIDTH} ${MAP_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <filter id="obcRouteGlow" x="-40%" y="-20%" width="180%" height="140%">
                <feGaussianBlur stdDeviation="5" result="blur"/>
                <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <marker id="obcRouteArrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
                <path class="route-arrow-head" d="M1 1 9 5 1 9 3.5 5Z"/>
              </marker>
            </defs>
            <g class="route-segment lower-right-run">
              <path class="route-shadow" d="M680 430 C588 427 480 409 410 370 C470 337 516 309 535 290 C450 276 365 268 300 270"/>
              <path class="route-bed" d="M680 430 C588 427 480 409 410 370 C470 337 516 309 535 290 C450 276 365 268 300 270"/>
              <path class="route-glow" filter="url(#obcRouteGlow)" d="M680 430 C588 427 480 409 410 370 C470 337 516 309 535 290 C450 276 365 268 300 270"/>
              <path class="route-direction" marker-end="url(#obcRouteArrow)" d="M680 430 C588 427 480 409 410 370 C470 337 516 309 535 290 C450 276 365 268 300 270"/>
            </g>
            <g class="route-segment upper-right-run">
              <path class="route-shadow" d="M680 105 C635 101 612 112 600 125 C528 134 463 147 422 170 C392 195 381 223 380 250 C349 259 323 266 300 270"/>
              <path class="route-bed" d="M680 105 C635 101 612 112 600 125 C528 134 463 147 422 170 C392 195 381 223 380 250 C349 259 323 266 300 270"/>
              <path class="route-glow" filter="url(#obcRouteGlow)" d="M680 105 C635 101 612 112 600 125 C528 134 463 147 422 170 C392 195 381 223 380 250 C349 259 323 266 300 270"/>
              <path class="route-direction" marker-end="url(#obcRouteArrow)" d="M680 105 C635 101 612 112 600 125 C528 134 463 147 422 170 C392 195 381 223 380 250 C349 259 323 266 300 270"/>
            </g>
            <g class="route-segment left-run">
              <path class="route-shadow" d="M181 410 C190 379 198 355 200 340 C185 292 166 252 165 220 C171 168 201 130 230 110"/>
              <path class="route-bed" d="M181 410 C190 379 198 355 200 340 C185 292 166 252 165 220 C171 168 201 130 230 110"/>
              <path class="route-glow" filter="url(#obcRouteGlow)" d="M181 410 C190 379 198 355 200 340 C185 292 166 252 165 220 C171 168 201 130 230 110"/>
              <path class="route-direction" marker-end="url(#obcRouteArrow)" d="M181 410 C190 379 198 355 200 340 C185 292 166 252 165 220 C171 168 201 130 230 110"/>
            </g>
          </svg>
          ${ISLANDS.map((island, islandIndex) => {
            const slots = islandSlots(layout, islandIndex);
            const estimate = estimateSlots(slots, islandIndex * SLOTS_PER_ISLAND, layout.perches);
            const occupied = slots.filter(Boolean).length;
            return `
              <button type="button"
                data-obc-island="${islandIndex}"
                class="obc-map-island ${island.form} ${selectedIsland === islandIndex ? "active" : ""}"
                style="${islandStyle(island)}"
                ${selectedIsland === islandIndex ? 'aria-current="true"' : ""}
                aria-label="Island ${islandIndex + 1}, ${island.name}, ${occupied} of 5 towers, Estimated island DP ${estimateText(estimate)}">
                <span class="obc-island-plate" aria-hidden="true"></span>
                <span class="obc-island-axis" aria-hidden="true"></span>
                <span class="obc-island-copy">
                  <small>ISLAND ${String(islandIndex + 1).padStart(2, "0")} · ${island.form.toUpperCase()}</small>
                  <strong>${escapeHtml(island.name)}</strong>
                  <em>Estimated DP ${escapeHtml(estimateText(estimate))}</em>
                </span>
                <span class="obc-occupancy" aria-hidden="true">
                  ${slots.map(tower => `<i class="${tower ? "filled" : ""}"></i>`).join("")}
                </span>
              </button>
            `;
          }).join("")}
        </div>
      </section>
    `;
  }

  function openEditor(slotIndex) {
    selectedSlot = slotIndex;
    const existing = layout?.slots[slotIndex];
    if (existing) {
      editorDraft = clone(existing);
      return;
    }
    const imported = inventoryRecords().find(record => availableInventory(record, slotIndex) > 0);
    if (imported) {
      editorDraft = {
        type: imported.type,
        level: imported.level,
        notes: "",
        rune: null,
        glyph: null,
        relic: null
      };
      return;
    }
    const fallbackType = selectedTower || towerTypes()[0] || "";
    const levels = rowsFor(fallbackType).map(row => Number(row.level)).filter(Number.isFinite);
    editorDraft = {
      type: fallbackType,
      level: selectedLevel || levels[0] || 1,
      notes: "",
      rune: null,
      glyph: null,
      relic: null
    };
  }

  function renderInventoryPicker() {
    const records = inventoryRecords();
    if (!records.length) return "";
    return `
      <div class="obc-inventory-picker" aria-label="Owner tower snapshot">
        ${records.slice(0, 30).map((record, index) => {
          const available = availableInventory(record, selectedSlot);
          return `<button type="button" data-obc-inventory="${index}" ${available < 1 ? "disabled" : ""}>
            ${towerIcon(record.type)}
            <span><strong>${escapeHtml(record.type)}</strong><small>Level ${record.level} · ${escapeHtml(record.location === "storage" ? "Stored" : record.location === "base" ? "Placed inventory" : "Owner source")}</small></span>
            <em>${available} available</em>
          </button>`;
        }).join("")}
      </div>
    `;
  }

  function catalogueEffect(item) {
    return (Array.isArray(item?.effects) ? item.effects : []).slice(0, 2).map(effect => {
      const amount = Number(effect?.max ?? effect?.min ?? effect?.base ?? 0);
      const value = effect?.unit === "%" && amount
        ? `${(amount * 100).toFixed(amount * 100 >= 10 ? 0 : 1)}%`
        : "";
      return `${effect?.text || ""}${value ? ` ${value}` : ""}`.trim();
    }).filter(Boolean).join(" · ");
  }

  function renderMonumentEditor(kind, key, selection) {
    const items = monumentItems(kind);
    const selected = monumentItem(kind, selection?.name);
    const maximum = selected?.maximumLevel || 99;
    return `
      <div class="obc-monument-row">
        <label>${escapeHtml(kind)}
          <input id="obcSlot${escapeHtml(kind)}" list="obc${escapeHtml(kind)}List" maxlength="120" value="${escapeHtml(selection?.name || "")}" placeholder="Tap to search ${formatNumber(items.length)} ${kind.toLowerCase()}${items.length === 1 ? "" : "s"}" autocomplete="off">
        </label>
        <label>Level
          <input id="obcSlot${escapeHtml(kind)}Level" type="number" min="1" max="${maximum}" inputmode="numeric" value="${escapeHtml(selection?.level || "")}" placeholder="Max ${maximum}">
        </label>
        <datalist id="obc${escapeHtml(kind)}List">
          ${items.map(item => `<option value="${escapeHtml(item.name)}" label="${escapeHtml(`${item.rarity || "Catalogue"}${catalogueEffect(item) ? ` · ${catalogueEffect(item)}` : ""}`)}"></option>`).join("")}
        </datalist>
      </div>
    `;
  }

  function renderTowerEditor() {
    if (selectedSlot === null || !layout || !editorDraft) return "";
    const tower = layout.slots[selectedSlot];
    const detail = towerEstimateDetails(editorDraft, selectedSlot, layout.perches);
    const sourceMatch = inventoryRecords().some(record =>
      record.type === editorDraft.type && Number(record.level) === Number(editorDraft.level)
    );
    const inventoryPrefill = renderInventoryPicker();
    return `
      <section class="obc-tower-sheet" aria-label="Tower placement editor">
        <div class="obc-section-heading">
          <div><p>${tower ? "EDIT TOWER" : "PLACE TOWER"}</p><h3>Island ${Math.floor(selectedSlot / SLOTS_PER_ISLAND) + 1} · Spot ${(selectedSlot % SLOTS_PER_ISLAND) + 1}</h3></div>
          <button id="obcCancelSlot" class="obc-icon-button" type="button" aria-label="Close tower editor">${icon("close")}</button>
        </div>

        <div class="obc-estimate-preview">
          ${towerIcon(editorDraft.type)}
          <div><small>Estimated tower DP</small><strong id="obcEditorEstimate">${detail === null ? "Unavailable" : `≈ ${formatNumber(detail.value)}`}</strong></div>
          <span>${sourceMatch ? "Owner source match" : "Manual entry"}</span>
          <p id="obcEditorBreakdown">${detail
            ? `Base ${formatNumber(detail.base)} · monuments +${formatNumber(Math.round(detail.monumentGain))} · rider +${formatNumber(Math.round(detail.riderGain))} · perch +${formatNumber(Math.round(detail.perchGain))}`
            : "An exact tower level row is required before bonuses can be estimated."}</p>
        </div>

        ${inventoryPrefill ? `<div class="obc-picker-heading"><strong>Prefill from owner snapshot</strong><small>Owner session only · tap once</small></div>${inventoryPrefill}` : ""}

        <div class="obc-form-row obc-manual-fields">
          <label>Tower type
            <input id="obcSlotTowerType" list="obcTowerTypeList" maxlength="80" value="${escapeHtml(editorDraft.type)}" autocomplete="off">
            <datalist id="obcTowerTypeList">${towerTypes().map(type => `<option value="${escapeHtml(type)}"></option>`).join("")}</datalist>
          </label>
          <label>Level
            <input id="obcSlotTowerLevel" type="number" min="1" max="999" inputmode="numeric" value="${escapeHtml(editorDraft.level)}">
          </label>
        </div>
        <label class="obc-notes">Notes
          <input id="obcSlotTowerNotes" maxlength="250" value="${escapeHtml(editorDraft.notes || "")}" placeholder="Optional tactical note">
        </label>
        <details class="obc-equipment-command" ${editorDraft.rune || editorDraft.glyph || editorDraft.relic ? "open" : ""}>
          <summary><span>Monument loadout</span><small>${[editorDraft.rune, editorDraft.glyph, editorDraft.relic].filter(Boolean).length}/3 equipped</small></summary>
          <p>Choose only the rune, glyph and relic actually equipped to this tower. Onyx applies verified building HP and attack effects and labels the result as an estimate.</p>
          <div class="obc-monument-grid">
            ${renderMonumentEditor("Rune", "rune", editorDraft.rune)}
            ${renderMonumentEditor("Glyph", "glyph", editorDraft.glyph)}
            ${renderMonumentEditor("Relic", "relic", editorDraft.relic)}
          </div>
        </details>
        <p class="obc-editor-evidence">Manual entries remain available. Unrecognised equipment is saved for your record but contributes nothing to the estimate until it matches a verified catalogue definition.</p>
        <div class="obc-editor-actions">
          <button id="obcSaveTower" class="primary" type="button">${tower ? "Update tower" : "Place tower"}</button>
          ${tower ? '<button id="obcStartMove" type="button">Move</button><button id="obcClearTower" class="danger" type="button">Remove</button>' : ""}
        </div>
        <p id="obcEditorStatus" class="obc-editor-status" aria-live="polite"></p>
      </section>
    `;
  }

  function perchCoverageLabel(index) {
    return PERCHES[index]?.islands.map(islandIndex => ISLANDS[islandIndex]?.name).filter(Boolean).join(" · ") || "No mapped islands";
  }

  function openPerchEditor(index) {
    selectedPerch = index;
    perchDraft = clone(layout?.perches?.[index] || blankPerches()[index]);
    selectedSlot = null;
    editorDraft = null;
  }

  function readPerchDraft(overlay) {
    if (selectedPerch === null || !perchDraft) return null;
    const skills = perchDraft.skills.map((skill, index) => ({
      name: skill.name,
      level: overlay.querySelector(`[data-obc-skill-level="${index}"]`)?.value ?? skill.level
    }));
    const gear = Object.fromEntries(GEAR_SLOTS.map(([slot]) => [slot, {
      name: overlay.querySelector(`[data-obc-gear-name="${slot}"]`)?.value || "",
      rarity: overlay.querySelector(`[data-obc-gear-rarity="${slot}"]`)?.value || "",
      level: overlay.querySelector(`[data-obc-gear-level="${slot}"]`)?.value || 0
    }]));
    return normalisePerch({
      name: PERCHES[selectedPerch].name,
      level: overlay.querySelector("#obcPerchLevel")?.value,
      dragonName: overlay.querySelector("#obcPerchDragon")?.value,
      dragonClass: overlay.querySelector("#obcPerchDragonClass")?.value,
      dragonTier: overlay.querySelector("#obcPerchDragonTier")?.value,
      dragonLevel: overlay.querySelector("#obcPerchDragonLevel")?.value,
      riderName: overlay.querySelector("#obcPerchRider")?.value,
      riderLevel: overlay.querySelector("#obcPerchRiderLevel")?.value,
      elementalResistance: overlay.querySelector("#obcPerchResistance")?.value,
      towerBonus: overlay.querySelector("#obcPerchTowerBonus")?.value,
      specialBonus: overlay.querySelector("#obcPerchSpecialBonus")?.value,
      skills,
      gear
    }, selectedPerch);
  }

  function perchPreview(perch) {
    const perches = clone(layout?.perches || blankPerches());
    if (selectedPerch !== null && perch) perches[selectedPerch] = perch;
    return estimateSlots(layout?.slots || blankSlots(), 0, perches);
  }

  function renderPerchDatalists() {
    return `
      <datalist id="obcDragonList">
        ${dragons().map(dragon => `<option value="${escapeHtml(dragon.name)}" label="${escapeHtml(`${dragon.dragonClass || "Dragon"} · ${dragon.rarity || ""} · ${dragon.element || ""}`)}"></option>`).join("")}
      </datalist>
      <datalist id="obcDefensiveRiderList">
        ${defensiveRiders().map(rider => `<option value="${escapeHtml(rider.name)}" label="Defensive / perch rider"></option>`).join("")}
      </datalist>
      <datalist id="obcRiderSkillList">
        ${riderSkills().map(skill => `<option value="${escapeHtml(skill.name)}" label="Maximum level ${escapeHtml(skill.maximumLevel || 1)}"></option>`).join("")}
      </datalist>
      ${GEAR_SLOTS.map(([slot, label]) => `
        <datalist id="obcGear${escapeHtml(slot)}List">
          ${riderGear(slot).map(item => `<option value="${escapeHtml(item.name)}" label="${escapeHtml(`${item.element || "No element"} · ${label}`)}"></option>`).join("")}
        </datalist>
      `).join("")}
    `;
  }

  function gearRarityOptions(slot, selection) {
    const item = riderGear(slot).find(entry => entry?.name === selection?.name);
    const options = Array.from(new Set([...(item?.rarities || []), ...GEAR_RARITIES]));
    return `<option value="">Choose…</option>${options.map(rarity => `<option value="${escapeHtml(rarity)}" ${selection?.rarity === rarity ? "selected" : ""}>${escapeHtml(rarity)}</option>`).join("")}`;
  }

  function renderPerchEditor() {
    if (selectedPerch === null || !perchDraft || !layout) return "";
    const config = PERCHES[selectedPerch];
    const preview = perchPreview(perchDraft);
    const dragon = dragons().find(item => item?.name === perchDraft.dragonName);
    return `
      <section class="obc-perch-sheet" aria-label="${escapeHtml(config.name)} editor">
        <div class="obc-section-heading">
          <div><p>PERCH COMMAND</p><h3>${escapeHtml(config.name)}</h3><small>Covers ${escapeHtml(perchCoverageLabel(selectedPerch))}</small></div>
          <button id="obcCancelPerch" class="obc-icon-button" type="button" aria-label="Close perch editor">${icon("close")}</button>
        </div>
        <div class="obc-perch-preview">
          ${icon("shield")}
          <div><small>Estimated total base DP with this draft</small><strong id="obcPerchEstimate">${escapeHtml(estimateText(preview))}</strong><span id="obcPerchBreakdown">Monuments +${formatNumber(Math.round(preview.monumentGain))} · riders +${formatNumber(Math.round(preview.riderGain))} · perch +${formatNumber(Math.round(preview.perchGain))}</span></div>
        </div>
        <div class="obc-perch-fields">
          <label>Perch level<input id="obcPerchLevel" type="number" min="0" max="999" inputmode="numeric" value="${perchDraft.level || ""}" placeholder="Level"></label>
          <label>Dragon<input id="obcPerchDragon" list="obcDragonList" maxlength="120" value="${escapeHtml(perchDraft.dragonName)}" placeholder="Tap to search ${formatNumber(dragons().length)} dragons" autocomplete="off"></label>
          <label>Dragon level<input id="obcPerchDragonLevel" type="number" min="0" max="999" inputmode="numeric" value="${perchDraft.dragonLevel || ""}"></label>
          <label>Class<input id="obcPerchDragonClass" maxlength="40" value="${escapeHtml(perchDraft.dragonClass || dragon?.dragonClass || "")}" placeholder="Dragon class"></label>
          <label>Tier / rarity<input id="obcPerchDragonTier" maxlength="80" value="${escapeHtml(perchDraft.dragonTier || [dragon?.rarity, dragon?.tier ? `Tier ${dragon.tier}` : ""].filter(Boolean).join(" · "))}" placeholder="e.g. Mythic · Tier 4"></label>
        </div>
        <fieldset class="obc-perch-bonuses">
          <legend>Verified perch bonuses</legend>
          <label>Elemental resistance<select id="obcPerchResistance">
            <option value="">None / not entered</option>
            ${["Wind", "Dark", "Ice", "Fire", "Earth"].map(element => `<option value="${element.toLowerCase()}-10" ${perchDraft.elementalResistance === `${element.toLowerCase()}-10` ? "selected" : ""}>10% ${element}</option>`).join("")}
          </select></label>
          <label>Main tower bonus<select id="obcPerchTowerBonus">
            <option value="">None / not entered</option>
            <option value="tower-health-15" ${perchDraft.towerBonus === "tower-health-15" ? "selected" : ""}>Tower Health 15%</option>
            <option value="tower-attack-10" ${perchDraft.towerBonus === "tower-attack-10" ? "selected" : ""}>Tower Attack 10%</option>
            <option value="supershot-15" ${perchDraft.towerBonus === "supershot-15" ? "selected" : ""}>Supershot 15%</option>
          </select></label>
          <label>Special bonus<select id="obcPerchSpecialBonus">
            <option value="">None / not entered</option>
            <option value="tower-ward-25" ${perchDraft.specialBonus === "tower-ward-25" ? "selected" : ""}>Tower Ward 25% HP</option>
            <option value="refund-supershot-25" ${perchDraft.specialBonus === "refund-supershot-25" ? "selected" : ""}>Refund Supershot 25%</option>
            <option value="double-attack-20" ${perchDraft.specialBonus === "double-attack-20" ? "selected" : ""}>2× Attack 20%</option>
          </select></label>
        </fieldset>
        <div class="obc-rider-command">
          <div class="obc-section-heading"><div><p>DEFENSIVE RIDER</p><h3>Rider assignment</h3></div><span>${perchDraft.riderName ? "Assigned" : "Manual"}</span></div>
          <div class="obc-perch-fields two">
            <label>Perch rider<input id="obcPerchRider" list="obcDefensiveRiderList" maxlength="120" value="${escapeHtml(perchDraft.riderName)}" placeholder="Tap to search perch riders" autocomplete="off"></label>
            <label>Rider level<input id="obcPerchRiderLevel" type="number" min="0" max="999" inputmode="numeric" value="${perchDraft.riderLevel || ""}"></label>
          </div>
          <details class="obc-rider-details" ${perchDraft.skills.length ? "open" : ""}>
            <summary><span>Rider skills</span><small>${perchDraft.skills.length} selected</small></summary>
            <p>Skill definitions are verified, but the catalogue does not reliably map every skill to a rider. Add only the skills this rider actually has.</p>
            <div class="obc-skill-add"><input id="obcNewRiderSkill" list="obcRiderSkillList" maxlength="120" placeholder="Tap to search ${formatNumber(riderSkills().length)} skills" autocomplete="off"><button id="obcAddRiderSkill" type="button">Add skill</button></div>
            <div class="obc-skill-list">
              ${perchDraft.skills.map((skill, index) => {
                const definition = riderSkills().find(item => item?.name === skill.name);
                return `<article><strong>${escapeHtml(skill.name)}</strong><label>Level<input data-obc-skill-level="${index}" type="number" min="1" max="${definition?.maximumLevel || 99}" inputmode="numeric" value="${skill.level}"></label><button type="button" data-obc-remove-skill="${index}" aria-label="Remove ${escapeHtml(skill.name)}">Remove</button></article>`;
              }).join("") || "<small>No rider skills entered.</small>"}
            </div>
          </details>
          <details class="obc-rider-details" ${Object.values(perchDraft.gear).some(Boolean) ? "open" : ""}>
            <summary><span>Rider gear</span><small>${Object.values(perchDraft.gear).filter(Boolean).length}/8 equipped</small></summary>
            <p>Each slot uses the verified gear catalogue. Rarity and level are required before an effect contributes to the estimate.</p>
            <div class="obc-gear-grid">
              ${GEAR_SLOTS.map(([slot, label]) => {
                const selection = perchDraft.gear[slot];
                return `<article><label>${label}<input data-obc-gear-name="${slot}" list="obcGear${slot}List" maxlength="120" value="${escapeHtml(selection?.name || "")}" placeholder="Tap to search ${label.toLowerCase()} gear" autocomplete="off"></label><div><label>Rarity<select data-obc-gear-rarity="${slot}">${gearRarityOptions(slot, selection)}</select></label><label>Level<input data-obc-gear-level="${slot}" type="number" min="0" max="99" inputmode="numeric" value="${selection?.level || ""}"></label></div></article>`;
              }).join("")}
            </div>
          </details>
        </div>
        ${renderPerchDatalists()}
        <p class="obc-editor-evidence">Only verified building HP and attack modifiers enter the numerical estimate. Elemental resistance, supershot and special combat effects remain recorded but are not converted into invented DP.</p>
        <div class="obc-editor-actions obc-perch-actions"><button id="obcSavePerch" class="primary" type="button">Save perch assignment</button><button id="obcCancelPerchBottom" type="button">Cancel</button></div>
        <p id="obcPerchStatus" class="obc-editor-status" aria-live="polite"></p>
      </section>
    `;
  }

  function renderPerchNetwork() {
    if (!layout) return "";
    return `
      <section class="obc-perch-network">
        <div class="obc-section-heading"><div><p>BASE SUPPORT NETWORK</p><h3>Perches, dragons and riders</h3></div><span>Tap a perch</span></div>
        <p class="obc-perch-intro">Perch coverage follows the existing verified Onyx reference model. Assign only what is actually on your base; nothing is inferred from tower inventory.</p>
        <div class="obc-perch-cards">
          ${layout.perches.map((perch, index) => `<button type="button" data-obc-perch="${index}" class="${selectedPerch === index ? "active" : ""}">${icon("shield")}<span><small>${escapeHtml(perchCoverageLabel(index))}</small><strong>${escapeHtml(perch.name)}</strong><em>${perch.dragonName ? `${escapeHtml(perch.dragonName)}${perch.riderName ? ` · ${escapeHtml(perch.riderName)}` : ""}` : "Not configured"}</em></span><b>${Object.values(perch.gear).filter(Boolean).length}/8 gear</b></button>`).join("")}
        </div>
        ${renderPerchEditor()}
      </section>
    `;
  }

  function spotLabel(tower, islandIndex, spotIndex) {
    const base = `Island ${islandIndex + 1}, spot ${spotIndex + 1}`;
    if (!tower) return `${base}, empty. Tap to place a tower.`;
    const estimate = towerEstimate(tower, islandIndex * SLOTS_PER_ISLAND + spotIndex, layout?.perches);
    return `${base}, ${tower.type}, level ${tower.level}, Estimated tower DP ${estimate === null ? "unavailable" : formatNumber(estimate)}.`;
  }

  function renderSwapPrompt() {
    if (moveFrom === null || pendingSwap === null) return "";
    const source = layout.slots[moveFrom];
    const destination = layout.slots[pendingSwap];
    return `
      <div class="obc-swap-prompt" role="alertdialog" aria-label="Confirm tower swap">
        <strong>Swap these two towers?</strong>
        <p>${escapeHtml(source?.type)} · L${source?.level} with ${escapeHtml(destination?.type)} · L${destination?.level}</p>
        <div><button id="obcConfirmSwap" class="primary" type="button">Swap towers</button><button id="obcCancelSwap" type="button">Cancel</button></div>
      </div>
    `;
  }

  function renderIslandCommand() {
    const island = ISLANDS[selectedIsland] || ISLANDS[0];
    const slots = islandSlots(layout, selectedIsland);
    const summary = estimateSlots(slots, selectedIsland * SLOTS_PER_ISLAND, layout.perches);
    const baseline = savedSnapshot
      ? estimateSlots(
          islandSlots(savedSnapshot, selectedIsland),
          selectedIsland * SLOTS_PER_ISLAND,
          savedSnapshot.perches
        )
      : null;
    const start = selectedIsland * SLOTS_PER_ISLAND;
    return `
      <section class="obc-island-command" tabindex="-1">
        <header>
          <div><p>ISLAND ${String(selectedIsland + 1).padStart(2, "0")} · ${island.form.toUpperCase()} SECTION</p><h3>${escapeHtml(island.name)}</h3><span>Tap a fixed glowing spot to place or edit a tower.</span></div>
          ${renderEstimateMetric("Estimated island DP", summary, baseline)}
        </header>

        ${renderSwapPrompt()}

        <div class="obc-spot-field ${island.form}" aria-label="${escapeHtml(island.name)} tower spots">
          <div class="obc-island-surface" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          ${slots.map((tower, spotIndex) => {
            const absolute = start + spotIndex;
            const estimate = towerEstimate(tower, absolute, layout.perches);
            return `<button type="button"
              data-obc-slot="${absolute}"
              class="obc-tower-spot spot-${spotIndex + 1} ${tower ? "occupied" : "empty"} ${selectedSlot === absolute ? "selected" : ""} ${moveFrom === absolute ? "moving" : ""}"
              aria-label="${escapeHtml(spotLabel(tower, selectedIsland, spotIndex))}"
              aria-pressed="${selectedSlot === absolute ? "true" : "false"}">
              <span class="obc-spot-halo" aria-hidden="true"></span>
              <span class="obc-spot-icon">${tower ? towerIcon(tower.type) : `<b>${spotIndex + 1}</b>`}</span>
              <small>${tower ? `L${tower.level}` : `SPOT ${spotIndex + 1}`}</small>
              ${tower ? `<em>${escapeHtml(tower.type)}</em><i>Estimated DP ${estimate === null ? "unavailable" : `≈ ${formatNumber(estimate)}`}</i>` : ""}
            </button>`;
          }).join("")}
        </div>

        ${renderTowerEditor()}
      </section>
    `;
  }

  function renderReferenceBoard() {
    return `
      <section class="obc-reference-board">
        <div class="obc-section-heading">
          <div><p>PRIVATE VISUAL REFERENCE</p><h3>Base screenshot board</h3></div>
          <span>${referencePhotos.length}/4 · This device only</span>
        </div>
        <p class="obc-reference-copy">Keep up to four screenshots beside the tactical map while you manually reproduce each island. Images stay in this browser and are never added to the saved profile layout.</p>
        <div class="obc-reference-actions">
          <label class="obc-reference-add ${referencePhotos.length >= 4 ? "disabled" : ""}">
            Add screenshots
            <input id="obcReferenceInput" type="file" accept="image/*" multiple ${referencePhotos.length >= 4 ? "disabled" : ""}>
          </label>
          ${referencePhotos.length ? '<button id="obcClearReferences" type="button">Clear board</button>' : ""}
        </div>
        ${referenceMessage ? `<p class="obc-reference-message" role="status">${escapeHtml(referenceMessage)}</p>` : ""}
        <div class="obc-reference-grid">
          ${referencePhotos.length ? referencePhotos.map((photo, index) => `
            <figure>
              <img src="${photo}" alt="Private base reference ${index + 1}">
              <figcaption><span>Reference ${index + 1}</span><button type="button" data-obc-remove-reference="${index}">Remove</button></figcaption>
            </figure>
          `).join("") : `
            <div class="obc-reference-empty">
              ${icon("route")}
              <strong>No screenshots pinned</strong>
              <span>Add your own base views when you need a side-by-side reference.</span>
            </div>
          `}
        </div>
      </section>
    `;
  }

  function renderBuilder() {
    if (!layout) return renderBuilderPrompt();
    const total = estimateSlots(layout.slots, 0, layout.perches);
    const savedTotal = savedSnapshot ? estimateSlots(savedSnapshot.slots, 0, savedSnapshot.perches) : null;
    const populated = layout.slots.filter(Boolean).length;
    return `
      <section class="obc-command-summary">
        <div class="obc-summary-copy">
          <p>BASE COMMAND · MANUAL GEOMETRY</p>
          <label>Base name<input id="obcLayoutName" maxlength="60" value="${escapeHtml(layout.name)}"></label>
          <span class="obc-draft-chip ${profileSaved ? "saved" : "draft"}">${profileSaved ? "Profile saved" : dirty ? "Unsaved draft" : "Draft"}</span>
        </div>
        <div class="obc-summary-metrics" aria-label="DP Sandbox">
          <p class="obc-sandbox-label">DP SANDBOX</p>
          <article><small>Towers placed</small><strong>${populated}/40</strong><span>Across 8 islands</span></article>
          ${renderEstimateMetric("Estimated total base DP", total, savedTotal)}
        </div>
        <p class="obc-dp-disclaimer">Estimate starts with exact tower power rows, then applies verified building HP and attack modifiers from entered runes, glyphs, relics, covered perch riders, rider gear and supported perch tower bonuses. It excludes unverified placement, resistance, supershot, special, research and seasonal effects.</p>
        ${renderEstimateBreakdown(total)}
      </section>

      ${renderInventoryState(true)}

      ${renderReferenceBoard()}

      <div class="obc-tactical-grid">
        ${renderRouteMap()}
        ${renderIslandCommand()}
      </div>

      ${renderPerchNetwork()}

      <section class="obc-save-dock">
        <div><strong>${profileSaved ? "Layout secured" : "Draft command state"}</strong><span>${escapeHtml(saveMessage || (dirty ? "Draft stored on this device." : "No unsaved changes."))}</span></div>
        <div><button id="obcResetLayout" type="button">Reset changes</button><button id="obcSaveLayout" class="primary" type="button" ${!dirty && profileSaved ? "disabled" : ""}>Save layout</button></div>
      </section>

      <section class="obc-delete-panel">
        <div><strong>Clear base command</strong><p>Reset restores the last profile save. Delete removes the layout from this device and your profile.</p></div>
        <button id="obcDeleteLayout" type="button">Delete layout</button>
      </section>
    `;
  }

  function advisorFindings(sourceLayout) {
    const findings = [];
    ISLANDS.forEach((island, islandIndex) => {
      const slots = islandSlots(sourceLayout, islandIndex).filter(Boolean);
      const counts = slots.reduce((map, tower) => {
        map.set(tower.type, (map.get(tower.type) || 0) + 1);
        return map;
      }, new Map());
      const seen = new Set();
      slots.forEach(tower => {
        restrictionsFor(tower.type).forEach(rule => {
          const maximum = Number(rule.maximumPerIsland);
          if (maximum > 0 && (counts.get(tower.type) || 0) > maximum) {
            const key = `${islandIndex}:maximum:${tower.type}`;
            if (!seen.has(key)) {
              seen.add(key);
              findings.push({
                islandIndex,
                text: `${tower.type} exceeds the verified maximum of ${maximum} on one island.`
              });
            }
          }
          (Array.isArray(rule.conflicts) ? rule.conflicts : []).forEach(conflictId => {
            const conflict = RULE_NAMES[conflictId];
            if (!conflict || !counts.has(conflict)) return;
            const pair = [tower.type, conflict].sort().join("|");
            const key = `${islandIndex}:conflict:${pair}`;
            if (!seen.has(key)) {
              seen.add(key);
              findings.push({
                islandIndex,
                text: `${tower.type} and ${conflict} have a recorded same-island conflict.`
              });
            }
          });
        });
      });
    });
    return findings;
  }

  function mergeTowerOptions(selected) {
    return towerTypes().map(type =>
      `<option value="${escapeHtml(type)}" ${type === selected ? "selected" : ""}>${escapeHtml(type)}</option>`
    ).join("");
  }

  function renderMergeCalculator() {
    if (!mergeDraft) mergeDraft = blankMergeDraft();
    const draft = normaliseMergeDraft(mergeDraft);
    const result = mergeResult?.ok ? mergeResult : null;
    const resultLabel = result?.resultSource === "wd-preview"
      ? "WD preview result"
      : "Estimated result";
    const modelDifference = result?.previewLevel !== null &&
      result?.previewLevel !== result?.modelResultLevel
      ? `<p class="obc-merge-variance">The 45% model estimated level ${formatNumber(result.modelResultLevel)}, while the WD preview shows level ${formatNumber(result.previewLevel)}. Onyx is using the WD preview for the XP calculation.</p>`
      : "";
    return `
      <section class="obc-source-banner merge-ready">
        <strong>Tower Merge Intelligence</strong>
        <p>Estimate the kept tower's resulting level using the verified 45% transferable-value model. If WD shows a preview level, enter it and the game preview becomes the source of truth.</p>
      </section>

      <section class="obc-merge-command">
        <div class="obc-section-heading obc-merge-heading">
          <div><p>MERGE CALCULATOR</p><h3>Build the merge before you confirm it</h3></div>
          <span>Tap-first · estimate</span>
        </div>

        <div class="obc-merge-pair">
          <article class="obc-merge-tower kept">
            <div class="obc-merge-step"><span>01</span><div><small>TOWER BEING KEPT</small><strong>Destination tower</strong></div></div>
            <div class="obc-merge-tower-mark">${towerIcon(draft.destinationType)}</div>
            <label>Tower type
              <select id="obcMergeDestinationType">${mergeTowerOptions(draft.destinationType)}</select>
            </label>
            <label>Current level
              <input id="obcMergeDestinationLevel" type="number" min="1" max="999" inputmode="numeric" value="${draft.destinationLevel}">
            </label>
          </article>

          <div class="obc-merge-transfer" aria-hidden="true">
            <span>45%</span>
            <svg viewBox="0 0 64 32"><path d="M4 16h48M42 6l12 10-12 10"/></svg>
          </div>

          <article class="obc-merge-tower consumed">
            <div class="obc-merge-step"><span>02</span><div><small>TOWER BEING CONSUMED</small><strong>Source tower</strong></div></div>
            <div class="obc-merge-tower-mark">${towerIcon(draft.sourceType)}</div>
            <label>Tower type
              <select id="obcMergeSourceType">${mergeTowerOptions(draft.sourceType)}</select>
            </label>
            <div class="obc-form-row">
              <label>Current level
                <input id="obcMergeSourceLevel" type="number" min="1" max="999" inputmode="numeric" value="${draft.sourceLevel}">
              </label>
              <label>Quantity
                <input id="obcMergeQuantity" type="number" min="1" max="100" inputmode="numeric" value="${draft.quantity}">
              </label>
            </div>
          </article>
        </div>

        <article class="obc-merge-limits">
          <div class="obc-merge-step"><span>03</span><div><small>LIMITS &amp; VERIFICATION</small><strong>Set the current cap</strong></div></div>
          <div class="obc-form-row">
            <label>Your current maximum tower level
              <input id="obcMergeMaximumLevel" type="number" min="1" max="999" inputmode="numeric" value="${draft.maximumTowerLevel}">
            </label>
            <label>WD preview result level <em>Optional</em>
              <input id="obcMergePreviewLevel" type="number" min="1" max="999" inputmode="numeric" value="${escapeHtml(draft.previewResultLevel)}" placeholder="Leave blank to estimate">
            </label>
          </div>
          <p>The tower cap is your maximum buildable tower level, not your player level.</p>
        </article>

        <div class="obc-merge-actions">
          <button id="obcCalculateMerge" class="primary" type="button">Calculate estimated merge</button>
          <button id="obcResetMerge" type="button">Reset</button>
        </div>
        ${mergeMessage ? `<p class="obc-merge-message ${mergeResult?.ok === false ? "error" : ""}" role="status">${escapeHtml(mergeMessage)}</p>` : ""}
      </section>

      ${result ? `
        <section class="obc-merge-result ${result.levelsGained ? "gain" : "flat"}">
          <div class="obc-merge-result-hero">
            <div>${towerIcon(result.destinationType)}</div>
            <span><small>${escapeHtml(resultLabel)}</small><strong>Level ${formatNumber(result.resultLevel)}</strong><em>+${formatNumber(result.levelsGained)} level${result.levelsGained === 1 ? "" : "s"}</em></span>
            <b>≈</b>
          </div>
          <div class="obc-merge-route-copy">
            <article><small>Keep</small><strong>${escapeHtml(result.destinationType)}</strong><span>Level ${formatNumber(result.destinationLevel)}</span></article>
            <article><small>Consume</small><strong>${result.quantity > 1 ? `${formatNumber(result.quantity)} × ` : ""}${escapeHtml(result.sourceType)}</strong><span>Level ${formatNumber(result.sourceLevel)}</span></article>
            <article><small>Result source</small><strong>${result.resultSource === "wd-preview" ? "WD preview" : "45% model"}</strong><span>${result.resultSource === "wd-preview" ? "Verified in game" : "Estimated only"}</span></article>
          </div>
          <div class="obc-merge-xp-grid">
            <article><small>XP in kept tower</small><strong>${formatNumber(result.destinationXp)}</strong></article>
            <article><small>XP in consumed tower${result.quantity === 1 ? "" : "s"}</small><strong>${formatNumber(result.sourceXp)}</strong></article>
            <article><small>XP retained by result</small><strong>${formatNumber(result.resultXp)}</strong></article>
            <article class="debt"><small>Estimated player XP debt</small><strong>≈ ${formatNumber(result.xpDebt)}</strong></article>
          </div>
          ${modelDifference}
          ${result.capped ? '<p class="obc-merge-cap-note">The estimated result reached the cap you entered. A higher cap may change the result.</p>' : ""}
          ${result.levelsGained ? "" : '<p class="obc-merge-cap-note">This combination does not contain enough transferable value to raise the kept tower by an exact catalogue level.</p>'}
        </section>
      ` : ""}

      <section class="obc-honesty-note obc-merge-honesty">
        <strong>Every figure is an estimate until WD shows the preview.</strong>
        <p>The model transfers 45% of recorded eligible construction value, applies the tower cap, and uses exact catalogue XP rows. Always compare the result with WD before confirming the merge.</p>
      </section>
    `;
  }

  function renderAdvisor() {
    if (!savedSnapshot || dirty || !profileSaved) {
      return `
        <section class="obc-advisor-lock">
          <div class="obc-lock-orbit">${icon("shield")}</div>
          <p>BASE ADVISOR LOCKED</p>
          <h3>${savedSnapshot && dirty ? "Save this draft before review" : "Build and save your manual layout first"}</h3>
          <p>Until island geometry is explicitly saved to your profile, Onyx shows tower intelligence only. It will not invent positions or give layout advice from a private inventory list.</p>
          <button id="obcGoToBuilder" class="primary" type="button">Open tactical map</button>
        </section>
      `;
    }
    const findings = advisorFindings(savedSnapshot);
    const total = estimateSlots(savedSnapshot.slots, 0, savedSnapshot.perches);
    return `
      <section class="obc-source-banner advisor-ready">
        <strong>Saved geometry under review</strong>
        <p>The advisor is reading only your last profile-saved manual layout, entered monument and perch assignments, and verified restriction records. It does not rank placements or invent combat bonuses.</p>
      </section>
      <section class="obc-advisor-overview">
        ${renderEstimateMetric("Estimated saved-base DP", total)}
        <article><small>Verified restriction alerts</small><strong>${findings.length}</strong><span>${findings.length ? "Review required" : "None detected"}</span></article>
      </section>
      ${renderEstimateBreakdown(total)}
      <section class="obc-panel obc-advisor-results">
        <div class="obc-section-heading"><div><p>RULE-BASED REVIEW</p><h3>Saved island checks</h3></div><span>${findings.length ? "Attention" : "Clear"}</span></div>
        ${findings.length ? findings.map(finding => `
          <article>${icon("shield")}<div><strong>Island ${finding.islandIndex + 1} · ${escapeHtml(ISLANDS[finding.islandIndex].name)}</strong><p>${escapeHtml(finding.text)}</p></div></article>
        `).join("") : `
          <div class="obc-no-findings">${icon("shield")}<div><strong>No verified restriction conflicts detected.</strong><p>This is not a claim that the layout is optimal; it means only that the recorded rules checked by Onyx did not flag a conflict.</p></div></div>
        `}
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

  function focusSelectorFor(element, overlay) {
    if (!element || !overlay.contains(element)) return "";
    if (element.id) return `#${element.id}`;
    for (const key of ["obcTab", "obcIsland", "obcSlot", "obcInventory"]) {
      if (element.dataset?.[key] !== undefined) {
        const attribute = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
        return `[data-${attribute}="${element.dataset[key]}"]`;
      }
    }
    return "";
  }

  function prefersReducedMotion() {
    return Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  }

  function render(options = {}) {
    const overlay = ensureOverlay();
    window.OnyxFortificationCommand?.setHostRender?.(nextOptions => render(nextOptions));
    window.OnyxFortificationCommand?.init?.();
    const focusSelector = options.focusSelector
      || focusSelectorFor(document.activeElement, overlay);
    overlay.innerHTML = `
      <div class="obc-shell" role="dialog" aria-modal="true" aria-label="Base and Towers command centre">
        <div class="obc-mist mist-one" aria-hidden="true"></div>
        <div class="obc-mist mist-two" aria-hidden="true"></div>
        <header class="obc-header">
          <div><p>ONYX COMMAND</p><h2>Base Command</h2></div>
          <button id="obcClose" class="obc-icon-button" type="button" aria-label="Close base command">${icon("close")}</button>
        </header>
        <nav class="obc-tabs" role="tablist" aria-label="Base command sections">
          <button type="button" role="tab" aria-selected="${activeTab === "intelligence"}" aria-controls="obcCommandPanel" data-obc-tab="intelligence" class="${activeTab === "intelligence" ? "active" : ""}">Tower Intelligence</button>
          <button type="button" role="tab" aria-selected="${activeTab === "builder"}" aria-controls="obcCommandPanel" data-obc-tab="builder" class="${activeTab === "builder" ? "active" : ""}">Tactical Map</button>
          <button type="button" role="tab" aria-selected="${activeTab === "fortification"}" aria-controls="obcCommandPanel" data-obc-tab="fortification" class="${activeTab === "fortification" ? "active" : ""}">Fort Planner</button>
          <button type="button" role="tab" aria-selected="${activeTab === "merge"}" aria-controls="obcCommandPanel" data-obc-tab="merge" class="${activeTab === "merge" ? "active" : ""}">Tower Merge</button>
          <button type="button" role="tab" aria-selected="${activeTab === "advisor"}" aria-controls="obcCommandPanel" data-obc-tab="advisor" class="${activeTab === "advisor" ? "active" : ""}">Base Advisor${profileSaved ? "" : '<span aria-hidden="true"></span>'}</button>
        </nav>
        <main id="obcCommandPanel" class="obc-body" role="tabpanel">
          ${activeTab === "intelligence"
            ? renderIntelligence()
            : activeTab === "builder"
              ? renderBuilder()
              : activeTab === "fortification"
                ? window.OnyxFortificationCommand?.render?.() || '<section class="obc-honesty-note"><strong>Fortification Command is unavailable.</strong></section>'
              : activeTab === "merge"
                ? renderMergeCalculator()
                : renderAdvisor()}
        </main>
      </div>
    `;
    window.OnyxCommand?.hydrateIcons?.(overlay);
    bindEvents(overlay);
    if (focusSelector) overlay.querySelector(focusSelector)?.focus?.();
    if (options.scrollSelector) {
      overlay.querySelector(options.scrollSelector)?.scrollIntoView?.({
        behavior: prefersReducedMotion() ? "auto" : "smooth",
        block: "start"
      });
    }
    if (
      overlay.classList.contains("open") &&
      !overlay.contains(document.activeElement)
    ) {
      overlay.querySelector("#obcClose")?.focus?.();
    }
  }

  function focusableElements(overlay) {
    return Array.from(overlay.querySelectorAll(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )).filter(element => !element.closest('[aria-hidden="true"]'));
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
    const focusable = focusableElements(overlay);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!overlay.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus();
      return;
    }
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function close() {
    const overlay = document.getElementById(OVERLAY_ID);
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
    document.body.classList.remove("onyx-modal-open");
    document.removeEventListener?.("keydown", handleModalKeydown);
    selectedSlot = null;
    editorDraft = null;
    selectedPerch = null;
    perchDraft = null;
    moveFrom = null;
    pendingSwap = null;
    lastFocused?.focus?.();
    lastFocused = null;
  }

  function updateEditorEstimate(overlay) {
    const type = canonicalTowerType(overlay.querySelector("#obcSlotTowerType")?.value || "");
    const level = Number.parseInt(overlay.querySelector("#obcSlotTowerLevel")?.value, 10);
    const tower = normaliseTower({
      type,
      level,
      notes: overlay.querySelector("#obcSlotTowerNotes")?.value || "",
      rune: {
        name: overlay.querySelector("#obcSlotRune")?.value || "",
        level: overlay.querySelector("#obcSlotRuneLevel")?.value
      },
      glyph: {
        name: overlay.querySelector("#obcSlotGlyph")?.value || "",
        level: overlay.querySelector("#obcSlotGlyphLevel")?.value
      },
      relic: {
        name: overlay.querySelector("#obcSlotRelic")?.value || "",
        level: overlay.querySelector("#obcSlotRelicLevel")?.value
      }
    });
    const detail = towerEstimateDetails(tower, selectedSlot, layout?.perches);
    const output = overlay.querySelector("#obcEditorEstimate");
    if (output) output.textContent = detail === null ? "Unavailable" : `≈ ${formatNumber(detail.value)}`;
    const breakdown = overlay.querySelector("#obcEditorBreakdown");
    if (breakdown) breakdown.textContent = detail
      ? `Base ${formatNumber(detail.base)} · monuments +${formatNumber(Math.round(detail.monumentGain))} · rider +${formatNumber(Math.round(detail.riderGain))} · perch +${formatNumber(Math.round(detail.perchGain))}`
      : "An exact tower level row is required before bonuses can be estimated.";
  }

  function updatePerchPreview(overlay) {
    const draft = readPerchDraft(overlay);
    if (!draft) return;
    perchDraft = draft;
    const preview = perchPreview(draft);
    const output = overlay.querySelector("#obcPerchEstimate");
    const breakdown = overlay.querySelector("#obcPerchBreakdown");
    if (output) output.textContent = estimateText(preview);
    if (breakdown) breakdown.textContent = `Monuments +${formatNumber(Math.round(preview.monumentGain))} · riders +${formatNumber(Math.round(preview.riderGain))} · perch +${formatNumber(Math.round(preview.perchGain))}`;
  }

  function handleMoveDestination(destination) {
    if (moveFrom === null || !layout) return false;
    if (destination === moveFrom) {
      moveFrom = null;
      pendingSwap = null;
      saveMessage = "Move cancelled.";
      render({ focusSelector: `[data-obc-slot="${destination}"]` });
      return true;
    }
    if (layout.slots[destination]) {
      pendingSwap = destination;
      selectedIsland = Math.floor(destination / SLOTS_PER_ISLAND);
      render({ focusSelector: "#obcConfirmSwap", scrollSelector: ".obc-island-command" });
      return true;
    }
    layout.slots[destination] = layout.slots[moveFrom];
    layout.slots[moveFrom] = null;
    selectedIsland = Math.floor(destination / SLOTS_PER_ISLAND);
    moveFrom = null;
    pendingSwap = null;
    markDirty("Tower moved · Estimated island DP updated.");
    render({
      focusSelector: `[data-obc-slot="${destination}"]`,
      scrollSelector: ".obc-island-command"
    });
    return true;
  }

  function syncDraftIndicators(overlay) {
    const chip = overlay.querySelector(".obc-draft-chip");
    chip?.classList.remove("saved");
    chip?.classList.add("draft");
    if (chip) chip.textContent = "Unsaved draft";
    const saveButton = overlay.querySelector("#obcSaveLayout");
    if (saveButton) saveButton.disabled = false;
    const dockTitle = overlay.querySelector(".obc-save-dock > div:first-child strong");
    const dockMessage = overlay.querySelector(".obc-save-dock > div:first-child span");
    if (dockTitle) dockTitle.textContent = "Draft command state";
    if (dockMessage) dockMessage.textContent = saveMessage;
  }

  function readMergeForm(overlay) {
    return normaliseMergeDraft({
      destinationType: overlay.querySelector("#obcMergeDestinationType")?.value,
      destinationLevel: overlay.querySelector("#obcMergeDestinationLevel")?.value,
      sourceType: overlay.querySelector("#obcMergeSourceType")?.value,
      sourceLevel: overlay.querySelector("#obcMergeSourceLevel")?.value,
      quantity: overlay.querySelector("#obcMergeQuantity")?.value,
      maximumTowerLevel: overlay.querySelector("#obcMergeMaximumLevel")?.value,
      previewResultLevel: overlay.querySelector("#obcMergePreviewLevel")?.value
    });
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
        editorDraft = null;
        selectedPerch = null;
        perchDraft = null;
        moveFrom = null;
        pendingSwap = null;
        render({ focusSelector: `[data-obc-tab="${activeTab}"]` });
      });
    });

    overlay.querySelector("#obcTowerType")?.addEventListener("change", event => {
      selectedTower = event.target.value;
      const levels = rowsFor(selectedTower).map(row => Number(row.level)).filter(Number.isFinite);
      selectedLevel = levels.length ? Math.min(...levels) : 1;
      render({ focusSelector: "#obcTowerType" });
    });
    overlay.querySelector("#obcTowerLevel")?.addEventListener("change", event => {
      selectedLevel = Number.parseInt(event.target.value, 10) || 1;
      render({ focusSelector: "#obcTowerLevel" });
    });

    overlay.querySelector("#obcCalculateMerge")?.addEventListener("click", () => {
      mergeDraft = readMergeForm(overlay);
      mergeResult = estimateMerge(mergeDraft);
      mergeMessage = mergeResult.ok
        ? mergeResult.resultSource === "wd-preview"
          ? "WD preview applied · estimated XP debt updated."
          : "Estimated merge calculated from exact catalogue rows."
        : mergeResult.message;
      saveMergeDraft();
      render({
        focusSelector: "#obcCalculateMerge",
        scrollSelector: mergeResult.ok ? ".obc-merge-result" : ".obc-merge-message"
      });
    });

    overlay.querySelector("#obcResetMerge")?.addEventListener("click", () => {
      mergeDraft = blankMergeDraft();
      mergeResult = null;
      mergeMessage = "Merge calculator reset.";
      localStorage.removeItem(storageKey(MERGE_STORAGE_PREFIX));
      render({ focusSelector: "#obcMergeDestinationType" });
    });

    overlay.querySelector("#obcReferenceInput")?.addEventListener("change", async event => {
      const files = Array.from(event.target.files || []).slice(0, Math.max(0, 4 - referencePhotos.length));
      if (!files.length) return;
      referenceMessage = "Preparing private screenshot references…";
      render({ focusSelector: "#obcReferenceInput" });
      const previous = referencePhotos.slice();
      try {
        for (const file of files) {
          if (!String(file.type || "").startsWith("image/")) continue;
          referencePhotos.push(String(await prepareReferencePhoto(file)));
        }
        if (!saveReferencePhotos()) throw new Error("storage quota");
        referenceMessage = `${files.length} screenshot${files.length === 1 ? "" : "s"} pinned to this device.`;
      } catch (error) {
        referencePhotos = previous;
        saveReferencePhotos();
        referenceMessage = "The screenshots could not be stored. Try smaller images or remove an existing reference.";
      }
      render({ focusSelector: "#obcReferenceInput", scrollSelector: ".obc-reference-board" });
    });

    overlay.querySelectorAll("[data-obc-remove-reference]").forEach(button => {
      button.addEventListener("click", () => {
        referencePhotos.splice(Number(button.dataset.obcRemoveReference), 1);
        saveReferencePhotos();
        referenceMessage = "Screenshot removed from this device.";
        render({ focusSelector: "#obcReferenceInput", scrollSelector: ".obc-reference-board" });
      });
    });

    overlay.querySelector("#obcClearReferences")?.addEventListener("click", () => {
      if (!window.confirm("Clear all private base screenshots from this device?")) return;
      referencePhotos = [];
      saveReferencePhotos();
      referenceMessage = "Private screenshot board cleared.";
      render({ focusSelector: "#obcReferenceInput", scrollSelector: ".obc-reference-board" });
    });

    overlay.querySelector("#obcCreateLayout")?.addEventListener("click", () => {
      const name = overlay.querySelector("#obcNewLayoutName")?.value || "My Base";
      layout = createLayout(name);
      savedSnapshot = null;
      selectedIsland = 0;
      selectedSlot = null;
      editorDraft = null;
      selectedPerch = null;
      perchDraft = null;
      markDirty("New manual layout draft created.");
      render({ focusSelector: '[data-obc-island="0"]' });
    });

    overlay.querySelector("#obcLayoutName")?.addEventListener("input", event => {
      layout.name = String(event.target.value || "").slice(0, 60);
      markDirty();
      syncDraftIndicators(overlay);
    });

    overlay.querySelectorAll("[data-obc-island]").forEach(button => {
      button.addEventListener("click", () => {
        selectedIsland = Number(button.dataset.obcIsland);
        selectedSlot = null;
        editorDraft = null;
        selectedPerch = null;
        perchDraft = null;
        pendingSwap = null;
        render({ focusSelector: ".obc-island-command", scrollSelector: ".obc-island-command" });
      });
    });

    overlay.querySelectorAll("[data-obc-perch]").forEach(button => {
      button.addEventListener("click", () => {
        openPerchEditor(Number(button.dataset.obcPerch));
        render({ focusSelector: "#obcPerchLevel", scrollSelector: ".obc-perch-sheet" });
      });
    });

    const closePerchEditor = () => {
      const index = selectedPerch;
      selectedPerch = null;
      perchDraft = null;
      render({ focusSelector: index === null ? "[data-obc-perch=\"0\"]" : `[data-obc-perch="${index}"]` });
    };
    overlay.querySelector("#obcCancelPerch")?.addEventListener("click", closePerchEditor);
    overlay.querySelector("#obcCancelPerchBottom")?.addEventListener("click", closePerchEditor);

    [
      "#obcPerchLevel",
      "#obcPerchDragonLevel",
      "#obcPerchRider",
      "#obcPerchRiderLevel",
      "#obcPerchResistance",
      "#obcPerchTowerBonus",
      "#obcPerchSpecialBonus"
    ].forEach(selector => {
      overlay.querySelector(selector)?.addEventListener("input", () => updatePerchPreview(overlay));
      overlay.querySelector(selector)?.addEventListener("change", () => updatePerchPreview(overlay));
    });
    overlay.querySelectorAll("[data-obc-skill-level], [data-obc-gear-name], [data-obc-gear-rarity], [data-obc-gear-level]").forEach(field => {
      field.addEventListener("input", () => updatePerchPreview(overlay));
      field.addEventListener("change", () => updatePerchPreview(overlay));
    });

    overlay.querySelector("#obcPerchDragon")?.addEventListener("change", event => {
      const draft = readPerchDraft(overlay);
      if (!draft) return;
      const dragon = dragons().find(item => item?.name === cleanText(event.target.value, 120));
      const bonuses = KNOWN_DRAGON_PERCH_BONUSES[dragon?.name];
      if (dragon) {
        draft.dragonClass = dragon.dragonClass || draft.dragonClass;
        draft.dragonTier = [dragon.rarity, dragon.tier ? `Tier ${dragon.tier}` : ""].filter(Boolean).join(" · ");
      }
      if (bonuses) Object.assign(draft, bonuses);
      perchDraft = draft;
      render({ focusSelector: "#obcPerchDragon", scrollSelector: ".obc-perch-sheet" });
    });

    overlay.querySelector("#obcAddRiderSkill")?.addEventListener("click", () => {
      const draft = readPerchDraft(overlay);
      const input = overlay.querySelector("#obcNewRiderSkill");
      const name = cleanText(input?.value, 120);
      const definition = riderSkills().find(item => item?.name === name);
      const status = overlay.querySelector("#obcPerchStatus");
      if (!definition) {
        if (status) status.textContent = "Choose a verified rider skill from the catalogue.";
        return;
      }
      if (draft.skills.some(skill => skill.name === name)) {
        if (status) status.textContent = "That rider skill is already selected.";
        return;
      }
      draft.skills.push({ name, level: 1 });
      perchDraft = draft;
      render({ focusSelector: "#obcNewRiderSkill", scrollSelector: ".obc-perch-sheet" });
    });

    overlay.querySelectorAll("[data-obc-remove-skill]").forEach(button => {
      button.addEventListener("click", () => {
        const draft = readPerchDraft(overlay);
        draft.skills.splice(Number(button.dataset.obcRemoveSkill), 1);
        perchDraft = draft;
        render({ focusSelector: "#obcNewRiderSkill", scrollSelector: ".obc-perch-sheet" });
      });
    });

    overlay.querySelector("#obcSavePerch")?.addEventListener("click", () => {
      if (selectedPerch === null || !layout) return;
      const index = selectedPerch;
      const draft = readPerchDraft(overlay);
      if (!draft) return;
      layout.perches[index] = draft;
      selectedPerch = null;
      perchDraft = null;
      markDirty("Perch assignment saved · Estimated base DP updated.");
      render({ focusSelector: `[data-obc-perch="${index}"]`, scrollSelector: ".obc-perch-network" });
    });

    overlay.querySelectorAll("[data-obc-slot]").forEach(button => {
      button.addEventListener("click", () => {
        const destination = Number(button.dataset.obcSlot);
        if (handleMoveDestination(destination)) return;
        selectedIsland = Math.floor(destination / SLOTS_PER_ISLAND);
        openEditor(destination);
        render({ focusSelector: "#obcSlotTowerType", scrollSelector: ".obc-tower-sheet" });
      });
    });

    overlay.querySelector("#obcCancelSlot")?.addEventListener("click", () => {
      const slot = selectedSlot;
      selectedSlot = null;
      editorDraft = null;
      selectedPerch = null;
      perchDraft = null;
      render({ focusSelector: `[data-obc-slot="${slot}"]` });
    });

    overlay.querySelectorAll("[data-obc-inventory]").forEach(button => {
      button.addEventListener("click", () => {
        const record = inventoryRecords()[Number(button.dataset.obcInventory)];
        if (!record) return;
        editorDraft = {
          type: record.type,
          level: record.level,
          notes: editorDraft?.notes || "",
          rune: editorDraft?.rune || null,
          glyph: editorDraft?.glyph || null,
          relic: editorDraft?.relic || null
        };
        render({ focusSelector: "#obcSlotTowerType", scrollSelector: ".obc-tower-sheet" });
      });
    });

    [
      "#obcSlotTowerType",
      "#obcSlotTowerLevel",
      "#obcSlotRune",
      "#obcSlotRuneLevel",
      "#obcSlotGlyph",
      "#obcSlotGlyphLevel",
      "#obcSlotRelic",
      "#obcSlotRelicLevel"
    ].forEach(selector => overlay.querySelector(selector)?.addEventListener("input", () => updateEditorEstimate(overlay)));

    overlay.querySelector("#obcSaveTower")?.addEventListener("click", () => {
      if (selectedSlot === null || !layout) return;
      const type = overlay.querySelector("#obcSlotTowerType")?.value || "";
      const level = Number.parseInt(overlay.querySelector("#obcSlotTowerLevel")?.value, 10);
      const notes = overlay.querySelector("#obcSlotTowerNotes")?.value || "";
      const tower = normaliseTower({
        type,
        level,
        notes,
        rune: {
          name: overlay.querySelector("#obcSlotRune")?.value || "",
          level: overlay.querySelector("#obcSlotRuneLevel")?.value
        },
        glyph: {
          name: overlay.querySelector("#obcSlotGlyph")?.value || "",
          level: overlay.querySelector("#obcSlotGlyphLevel")?.value
        },
        relic: {
          name: overlay.querySelector("#obcSlotRelic")?.value || "",
          level: overlay.querySelector("#obcSlotRelicLevel")?.value
        }
      });
      if (!tower) {
        const status = overlay.querySelector("#obcEditorStatus");
        if (status) status.textContent = "Enter a tower type and a whole level from 1 to 999.";
        return;
      }
      layout.slots[selectedSlot] = tower;
      selectedTower = tower.type;
      selectedLevel = tower.level;
      const focusSlot = selectedSlot;
      selectedSlot = null;
      editorDraft = null;
      selectedPerch = null;
      perchDraft = null;
      markDirty("Tower placed · Estimated DP updated.");
      render({
        focusSelector: `[data-obc-slot="${focusSlot}"]`,
        scrollSelector: ".obc-island-command"
      });
    });

    overlay.querySelector("#obcClearTower")?.addEventListener("click", () => {
      if (selectedSlot === null || !layout) return;
      const focusSlot = selectedSlot;
      layout.slots[selectedSlot] = null;
      selectedSlot = null;
      editorDraft = null;
      markDirty("Tower removed · Estimated DP updated.");
      render({
        focusSelector: `[data-obc-slot="${focusSlot}"]`,
        scrollSelector: ".obc-island-command"
      });
    });

    overlay.querySelector("#obcStartMove")?.addEventListener("click", () => {
      if (selectedSlot === null || !layout?.slots[selectedSlot]) return;
      moveFrom = selectedSlot;
      selectedSlot = null;
      editorDraft = null;
      pendingSwap = null;
      render({ focusSelector: "#obcCancelMove" });
    });

    overlay.querySelector("#obcCancelMove")?.addEventListener("click", () => {
      const source = moveFrom;
      moveFrom = null;
      pendingSwap = null;
      render({
        focusSelector: source === null ? '[data-obc-island="0"]' : `[data-obc-slot="${source}"]`
      });
    });

    overlay.querySelector("#obcConfirmSwap")?.addEventListener("click", () => {
      if (moveFrom === null || pendingSwap === null || !layout) return;
      const destination = pendingSwap;
      [layout.slots[moveFrom], layout.slots[destination]] = [
        layout.slots[destination],
        layout.slots[moveFrom]
      ];
      moveFrom = null;
      pendingSwap = null;
      selectedIsland = Math.floor(destination / SLOTS_PER_ISLAND);
      markDirty("Towers swapped · Estimated island DP updated.");
      render({
        focusSelector: `[data-obc-slot="${destination}"]`,
        scrollSelector: ".obc-island-command"
      });
    });

    overlay.querySelector("#obcCancelSwap")?.addEventListener("click", () => {
      pendingSwap = null;
      render({ focusSelector: "#obcCancelMove" });
    });

    overlay.querySelector("#obcSaveLayout")?.addEventListener("click", saveCloud);

    overlay.querySelector("#obcResetLayout")?.addEventListener("click", () => {
      if (savedSnapshot) {
        if (!window.confirm("Reset this draft to the last profile-saved layout?")) return;
        layout = clone(savedSnapshot);
        selectedSlot = null;
        editorDraft = null;
        selectedPerch = null;
        perchDraft = null;
        moveFrom = null;
        pendingSwap = null;
        updateDraftState();
        saveLocal();
        saveMessage = "Draft reset to the last profile save.";
        render({ focusSelector: "#obcResetLayout" });
        return;
      }
      if (!window.confirm("Clear this unsaved manual layout and return to the start?")) return;
      layout = null;
      selectedSlot = null;
      editorDraft = null;
      selectedPerch = null;
      perchDraft = null;
      moveFrom = null;
      pendingSwap = null;
      saveLocal();
      updateDraftState();
      saveMessage = "";
      render({ focusSelector: "#obcCreateLayout" });
    });

    overlay.querySelector("#obcDeleteLayout")?.addEventListener("click", async () => {
      if (!window.confirm("Delete this manual layout from this device and your Onyx profile?")) return;
      const hasProfileCopy = Boolean(savedSnapshot);
      const saver = window.ChestDatabase?.saveOnyxBaseLayout;
      if (hasProfileCopy) {
        if (typeof saver !== "function") {
          saveMessage = "The layout was kept because profile deletion is unavailable.";
          render({ focusSelector: "#obcDeleteLayout" });
          return;
        }
        try {
          await saver.call(window.ChestDatabase, null);
        } catch (error) {
          saveMessage = "The layout was kept because Onyx could not delete the profile copy.";
          render({ focusSelector: "#obcDeleteLayout" });
          console.warn("[Onyx Base] The profile copy could not be cleared.", error);
          return;
        }
      }

      layout = null;
      savedSnapshot = null;
      selectedSlot = null;
      editorDraft = null;
      selectedPerch = null;
      perchDraft = null;
      moveFrom = null;
      pendingSwap = null;
      saveLocal();
      updateDraftState();
      saveMessage = "Manual layout deleted from this device and your Onyx profile.";
      render({ focusSelector: "#obcCreateLayout" });
    });

    overlay.querySelector("#obcGoToBuilder")?.addEventListener("click", () => {
      activeTab = "builder";
      render({ focusSelector: '[data-obc-tab="builder"]' });
    });

    window.OnyxFortificationCommand?.bind?.(overlay);
  }

  function open(tab = "intelligence") {
    activeTab = ["builder", "fortification", "merge", "advisor"].includes(tab) ? tab : "intelligence";
    lastFocused = document.activeElement;
    const currentUser = userId() || "signed-out";
    if (openedForUser !== null && openedForUser !== currentUser) {
      inventorySnapshot = null;
      window.OnyxTowerInventoryBridge?.clear?.();
    }
    openedForUser = currentUser;
    readLocal();
    readMergeDraft();
    readReferencePhotos();
    window.OnyxFortificationCommand?.init?.();
    refreshInventory();
    render();
    const overlay = ensureOverlay();
    overlay.classList.add("open");
    overlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("onyx-modal-open");
    document.addEventListener?.("keydown", handleModalKeydown);
    overlay.querySelector("#obcClose")?.focus?.();
    loadCloud();
  }

  function estimateLayout(value) {
    const normalised = normaliseLayout(value);
    if (!normalised) return null;
    return {
      total: clone(estimateSlots(normalised.slots, 0, normalised.perches)),
      islands: ISLANDS.map((_, index) =>
        clone(estimateSlots(
          islandSlots(normalised, index),
          index * SLOTS_PER_ISLAND,
          normalised.perches
        ))
      )
    };
  }

  window.addEventListener?.("onyx:tower-inventory-imported", event => {
    refreshInventory(event?.detail);
    window.OnyxFortificationCommand?.refreshInventory?.(event?.detail);
    if (document.getElementById(OVERLAY_ID)?.classList.contains("open")) render();
  });

  window.addEventListener?.("onyx:tower-inventory-cleared", () => {
    inventorySnapshot = null;
    window.OnyxFortificationCommand?.refreshInventory?.(null);
    if (document.getElementById(OVERLAY_ID)?.classList.contains("open")) render();
  });

  window.OnyxBaseCommand = Object.freeze({
    open,
    close,
    createLayout,
    estimateLayout,
    estimateMerge,
    getLayout: () => clone(layout),
    getTowerRecord: (type, level) => clone(exactRow(type, level))
  });
})();
