(() => {
  "use strict";

  const STORAGE_KEY = "noirBasePlannerV1";
  const OVERLAY_ID = "noirBasePlannerOverlay";
  const ISLAND_COUNT = 8;
  const SLOTS_PER_ISLAND = 5;
  const TOTAL_SLOTS = ISLAND_COUNT * SLOTS_PER_ISLAND;
  const MERGE_TRANSFER_RATE = 0.45;
  const RUBBLE_VALUES = Object.freeze({
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

  const CATALOG = window.NoirBaseCatalog || {};
  const FALLBACK_TOWER_TYPES = [
    "Archer Tower", "Cannon Tower", "Ballista", "Trebuchet", "Lightning Tower",
    "Storm Tower", "Red Mage Tower", "Blue Mage Tower", "Fire Turret", "Ice Turret",
    "Dark Flak Tower", "Fire Flak Tower", "Ice Flak Tower", "Earth Flak Tower",
    "Electro-Flak Tower", "Crystal Howitzer", "Soul Drain Tower", "Drakul Pylon",
    "Cosmic Orrery", "Charged Volt Tower", "Red Archmage Tower", "Blue Archmage Tower",
    "Oculus Tower", "Nexus Tower", "Nullspire Tower", "Dark Totem", "Other"
  ];
  const TOWER_TYPES = Array.from(new Set([
    ...(Array.isArray(CATALOG.towers) ? CATALOG.towers.map(tower => tower.name) : []),
    ...FALLBACK_TOWER_TYPES
  ])).filter(Boolean).sort((left, right) => left.localeCompare(right));
  const INVENTORY_ACTIONS = Object.freeze({
    upgrade: "Upgrade this Fort",
    hold: "Hold",
    merge: "Reserve for merge",
    transform: "Reserve for transform"
  });
  const TOWER_ALIASES = Object.freeze({
    "archer": "Archer Tower",
    "ballista tower": "Ballista",
    "cannon": "Cannon Tower",
    "dark flak": "Dark Flak Tower",
    "earth flak": "Earth Flak Tower",
    "electro flak": "Electro-Flak Tower",
    "electro-flak": "Electro-Flak Tower",
    "fire flak": "Fire Flak Tower",
    "ice flak": "Ice Flak Tower",
    "trebuchet tower": "Trebuchet"
  });

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
  const KNOWN_DRAGON_PERCH_BONUSES = {
    Aevros: { elementalResistance: "wind-10", towerBonus: "tower-health-15", specialBonus: "tower-ward-25" },
    Cerebron: { elementalResistance: "dark-10", towerBonus: "supershot-15", specialBonus: "refund-supershot-25" },
    Krygant: { elementalResistance: "ice-10", towerBonus: "tower-health-15", specialBonus: "tower-ward-25" },
    Xytheris: { elementalResistance: "fire-10", towerBonus: "supershot-15", specialBonus: "" },
    Rakmo: { elementalResistance: "dark-10", towerBonus: "tower-health-15", specialBonus: "" },
    Varuag: { elementalResistance: "ice-10", towerBonus: "tower-attack-10", specialBonus: "" },
    Simba: { elementalResistance: "earth-10", towerBonus: "tower-health-15", specialBonus: "tower-ward-25" },
    Nartaka: { elementalResistance: "dark-10", towerBonus: "tower-attack-10", specialBonus: "double-attack-20" }
  };

  let state = loadState();
  let selectedSlot = null;
  let history = [];
  let future = [];

  function fortRowsForType(type) {
    const exact = CATALOG.towerLevels?.[type];
    if (Array.isArray(exact) && exact.length) return exact;
    // Mage and Archmage towers use the same player-XP, unlock and build-time
    // progression as the standard high-level tower curve.
    if (MAGES.has(type)) {
      return CATALOG.towerLevels?.["Drakul Pylon"] ||
        Object.values(CATALOG.towerLevels || {}).find(rows => Array.isArray(rows) && rows.length) ||
        [];
    }
    return [];
  }

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
      elementalResistance: "",
      towerBonus: "",
      specialBonus: "",
      riderSkills: [],
      riderSkillLevels: {},
      riderGear: Object.fromEntries(GEAR_SLOTS.map(([slot]) => [slot, { name: "", rarity: "", level: 0 }]))
    }));
  }

  function blankFortPlanner() {
    return {
      currentLevel: 0,
      targetLevel: 0,
      currentXp: 0,
      maximumTowerLevel: 230,
      storedTowers: [],
      mergePlans: [],
      inventoryImportedAt: ""
    };
  }

  function normaliseFortPlanner(value) {
    const safe = value && typeof value === "object" ? value : {};
    const parsedCurrentLevel = Number.parseInt(safe.currentLevel, 10) || 0;
    const parsedTargetLevel = Number.parseInt(safe.targetLevel, 10) || 0;
    const savedTowers = Array.isArray(safe.storedTowers) ? safe.storedTowers : [];
    const savedMerges = Array.isArray(safe.mergePlans) ? safe.mergePlans : [];
    return {
      currentLevel: parsedCurrentLevel === 0 ? 0 : Math.max(600, Math.min(998, parsedCurrentLevel)),
      targetLevel: parsedTargetLevel === 0 ? 0 : Math.max(601, Math.min(999, parsedTargetLevel)),
      currentXp: Math.max(0, Number.parseInt(safe.currentXp, 10) || 0),
      maximumTowerLevel: Math.max(1, Math.min(250, Number.parseInt(safe.maximumTowerLevel, 10) || 230)),
      storedTowers: savedTowers.map(item => ({
        type: String(item?.type || ""),
        level: Math.max(0, Number.parseInt(item?.level, 10) || 0),
        quantity: Math.max(1, Math.min(250, Number.parseInt(item?.quantity, 10) || 1)),
        location: item?.location === "base" ? "base" : "storage",
        action: Object.hasOwn(INVENTORY_ACTIONS, item?.action) ? item.action : "upgrade"
      })).filter(item => item.type && (fortRowsForType(item.type).length || TOWER_TYPES.includes(item.type))),
      mergePlans: savedMerges.map(item => ({
        destinationType: String(item?.destinationType || ""),
        destinationLevel: Math.max(0, Number.parseInt(item?.destinationLevel, 10) || 0),
        sourceType: String(item?.sourceType || ""),
        sourceLevel: Math.max(0, Number.parseInt(item?.sourceLevel, 10) || 0),
        resultLevel: Math.max(0, Number.parseInt(item?.resultLevel, 10) || 0),
        quantity: Math.max(1, Math.min(100, Number.parseInt(item?.quantity, 10) || 1))
      })).filter(item =>
        item.destinationType &&
        item.sourceType &&
        item.resultLevel > item.destinationLevel
      ),
      inventoryImportedAt: String(safe.inventoryImportedAt || "")
    };
  }

  function canonicalTowerType(value) {
    const clean = String(value || "").trim().replace(/\s+/g, " ");
    if (!clean) return "";
    const alias = TOWER_ALIASES[clean.toLowerCase()];
    if (alias) return alias;
    return TOWER_TYPES.find(type => type.toLowerCase() === clean.toLowerCase()) || clean;
  }

  function parseInventoryRows(rows) {
    const parsed = [];
    const rejected = [];
    (Array.isArray(rows) ? rows : []).forEach((rawRow, index) => {
      let row = Array.isArray(rawRow) ? rawRow : [rawRow];
      if (row.length === 1 && typeof row[0] === "string") {
        row = row[0].split(",").map(value => value.trim());
      }
      const [rawType, rawLevel, rawStored] = row;
      if (index === 0 && /tower/i.test(String(rawType)) && /level/i.test(String(rawLevel))) return;
      const type = canonicalTowerType(rawType);
      const level = Number.parseInt(rawLevel, 10);
      const storedText = String(rawStored || "").trim().toLowerCase();
      const location = ["no", "base", "active", "false"].includes(storedText) ? "base" : "storage";
      if (!type || !Number.isFinite(level) || level < 1 || (!fortRowsForType(type).length && !TOWER_TYPES.includes(type))) {
        rejected.push({ row: index + 1, type: String(rawType || ""), level: String(rawLevel || "") });
        return;
      }
      parsed.push({ type, level, location, action: "upgrade" });
    });
    const grouped = Object.values(parsed.reduce((groups, item) => {
      const key = `${item.location}|${item.type}|${item.level}`;
      groups[key] ||= { ...item, quantity: 0 };
      groups[key].quantity += 1;
      return groups;
    }, {})).sort((left, right) =>
      left.location.localeCompare(right.location) ||
      left.type.localeCompare(right.type) ||
      right.level - left.level
    );
    return { entries: grouped, rejected, rowsRead: parsed.length + rejected.length };
  }

  async function readInventoryFile(file) {
    const extension = String(file?.name || "").split(".").pop().toLowerCase();
    if (extension === "xlsx" || extension === "xls") {
      if (!window.XLSX) throw new Error("Excel reader is still loading. Close the planner, reopen it and try again.");
      const bytes = await file.arrayBuffer();
      const workbook = window.XLSX.read(bytes, { type: "array" });
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      return window.XLSX.utils.sheet_to_json(firstSheet, { header: 1, raw: false, defval: "" });
    }
    const text = await file.text();
    return text.split(/\r?\n/).filter(Boolean).map(line => line.split(","));
  }

  function normaliseTower(tower) {
    if (!tower || typeof tower !== "object") return null;
    return {
      id: String(tower.id || `tower-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      type: String(tower.type || "Other"),
      customName: String(tower.customName || ""),
      level: Math.max(0, Number.parseInt(tower.level, 10) || 0),
      runes: String(tower.runes || tower.rune || ""),
      runeLevel: Math.max(0, Number.parseInt(tower.runeLevel, 10) || 0),
      glyph: String(tower.glyph || ""),
      glyphLevel: Math.max(0, Number.parseInt(tower.glyphLevel, 10) || 0),
      relic: String(tower.relic || ""),
      relicLevel: Math.max(0, Number.parseInt(tower.relicLevel, 10) || 0),
      towerHpBoost: Boolean(tower.towerHpBoost),
      towerAttackBoost: Boolean(tower.towerAttackBoost),
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
      elementalResistance: String(safe.elementalResistance || ""),
      towerBonus: String(safe.towerBonus || ""),
      specialBonus: String(safe.specialBonus || ""),
      riderSkills: Array.isArray(safe.riderSkills)
        ? safe.riderSkills.map(String).filter(Boolean)
        : String(safe.riderSkills || "").split(/[,|]/).map(value => value.trim()).filter(Boolean),
      riderSkillLevels: Object.fromEntries(
        (Array.isArray(safe.riderSkills) ? safe.riderSkills : []).map(skill => {
          const catalogueSkill = CATALOG.riderSkills?.find(item => item.name === skill);
          const savedLevel = Number.parseInt(safe.riderSkillLevels?.[skill], 10);
          return [String(skill), Math.max(1, savedLevel || catalogueSkill?.maximumLevel || 1)];
        })
      ),
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
      fortPlanner: blankFortPlanner(),
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
      fortPlanner: normaliseFortPlanner(safe.fortPlanner),
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
      console.warn("NOIR • I ZI could not read the saved base.", error);
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
      console.warn("NOIR • I ZI could not save the base.", error);
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

  function normalKey(value) {
    return String(value || "").toLowerCase().replace(/\btower\b/g, "").replace(/[^a-z0-9]/g, "");
  }

  function effectValue(effect, level, maximumLevel = 1) {
    const values = Array.isArray(effect?.values) ? effect.values.map(Number).filter(Number.isFinite) : [];
    if (values.length) {
      const index = Math.max(0, Math.min(values.length - 1, (Number.parseInt(level, 10) || values.length) - 1));
      return Number(values[index]) || 0;
    }
    const chosenLevel = Math.max(1, Math.min(Number(maximumLevel) || 1, Number.parseInt(level, 10) || Number(maximumLevel) || 1));
    return (Number(effect?.base) || 0) + (Number(effect?.perLevel) || 0) * Math.max(0, chosenLevel - 1);
  }

  function modifierBucket(text) {
    const value = String(text || "").toLowerCase();
    if (/hp|health/.test(value)) return "hp";
    if (/atk|attack|damage|super.?shot/.test(value)) return "attack";
    return "";
  }

  function monumentEffectApplies(effect, tower) {
    const text = normalKey(effect?.text);
    if (!text) return false;
    const towerKey = normalKey(tower?.type);
    const namedTower = (Array.isArray(CATALOG.towers) ? CATALOG.towers : [])
      .map(item => normalKey(item.name))
      .filter(key => key.length >= 4)
      .find(key => text.includes(key));
    return !namedTower || text.includes(towerKey) || towerKey.includes(namedTower);
  }

  function monumentModifier(tower) {
    const items = Array.isArray(CATALOG.monumentItems) ? CATALOG.monumentItems : [];
    const selections = [
      [tower?.runes, tower?.runeLevel],
      [tower?.glyph, tower?.glyphLevel],
      [tower?.relic, tower?.relicLevel]
    ];
    let hp = 0;
    let attack = 0;
    selections.forEach(([name, level]) => {
      const item = items.find(entry => entry.name === name);
      if (!item) return;
      item.effects?.forEach(effect => {
        if (!monumentEffectApplies(effect, tower)) return;
        const bucket = modifierBucket(effect.text);
        if (bucket) {
          const value = effectValue(effect, level, item.maximumLevel);
          if (bucket === "hp") hp += value;
          if (bucket === "attack") attack += value;
        }
      });
    });
    return { hp, attack };
  }

  const RIDER_TOWER_KEYS = {
    elementalflakdark: "darkflak",
    elementalflakfire: "fireflak",
    elementalflakice: "iceflak",
    elementalflakwind: "electroflak",
    elementalflakearth: "earthflak",
    crystalhowitzer: "crystalhowitzer",
    burntower: "fireturret",
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
  };

  function riderEffectApplies(type, tower) {
    const value = String(type || "");
    const specific = value.split("_")[1];
    if (!specific) return true;
    const expected = RIDER_TOWER_KEYS[normalKey(specific)] || normalKey(specific);
    return normalKey(tower?.type).includes(expected);
  }

  function riderModifier(tower, perches) {
    let hp = 0;
    let attack = 0;
    const skills = Array.isArray(CATALOG.riderSkills) ? CATALOG.riderSkills : [];
    const gearItems = Array.isArray(CATALOG.riderGear) ? CATALOG.riderGear : [];
    perches
      .filter(perch => perch?.level && perch?.dragonName && perch?.riderName)
      .forEach(perch => {
        perch.riderSkills.forEach(name => {
          const skill = skills.find(item => item.name === name);
          const level = perch.riderSkillLevels?.[name] || skill?.maximumLevel || 1;
          skill?.effects?.forEach(effect => {
            if (!riderEffectApplies(effect.type, tower)) return;
            const bucket = modifierBucket(effect.type);
            const value = effectValue(effect, level, skill.maximumLevel);
            if (bucket === "hp") hp += value;
            if (bucket === "attack") attack += value;
          });
        });
        Object.values(perch.riderGear || {}).forEach(gear => {
          if (!gear?.name) return;
          const item = gearItems.find(entry => entry.name === gear.name);
          const variants = Array.isArray(item?.variants) ? item.variants : [];
          const variant = variants.find(entry => entry.rarity === gear.rarity) || variants[variants.length - 1];
          variant?.effects?.forEach(effect => {
            if (!riderEffectApplies(effect.type, tower)) return;
            const bucket = modifierBucket(effect.type);
            const value = effectValue(effect, gear.level, variant.maximumLevel);
            if (bucket === "hp") hp += value;
            if (bucket === "attack") attack += value;
          });
        });
      });
    return { hp, attack };
  }

  const PERCH_COVERAGE = {
    "Seagazer Perch": new Set([1, 2]),
    "Riverwatch Perch": new Set([3, 4, 5]),
    "Stonespear Perch": new Set([6, 7])
  };

  function perchTowerModifier(towerIndex, perches) {
    const islandIndex = Math.floor(towerIndex / SLOTS_PER_ISLAND);
    const coveringPerch = perches.find(perch =>
      perch?.level &&
      perch?.dragonName &&
      PERCH_COVERAGE[perch.name]?.has(islandIndex)
    );
    return {
      hp: coveringPerch?.towerBonus === "tower-health-15" ? 0.15 : 0,
      attack: coveringPerch?.towerBonus === "tower-attack-10" ? 0.1 : 0
    };
  }

  function towerPower(tower, perches = [], towerIndex = 0) {
    if (!tower) return 0;
    const level = Math.max(1, tower.level || 1);
    const officialLevels = CATALOG.towerLevels?.[tower.type];
    let power = 0;
    if (Array.isArray(officialLevels) && officialLevels.length) {
      const exact = officialLevels.find(item => Number(item.level) === level);
      if (exact?.power > 0) power = exact.power;
      const closest = officialLevels.reduce((best, item) =>
        Math.abs(Number(item.level) - level) < Math.abs(Number(best.level) - level) ? item : best
      );
      if (!power && closest?.power > 0) power = closest.power;
    }
    if (!power) {
      const typeWeight = MODERN.has(tower.type) ? 1.18 : MAGES.has(tower.type) ? 1.05 : 1;
      power = Math.pow(level, 2.28) * typeWeight;
    }
    const monument = monumentModifier(tower);
    const rider = riderModifier(tower, perches);
    const consumableHp = tower.towerHpBoost ? 0.3 : 0;
    const consumableAttack = tower.towerAttackBoost ? 0.3 : 0;
    const perch = perchTowerModifier(towerIndex, perches);
    return power * (1 + (
      monument.hp + monument.attack +
      rider.hp + rider.attack +
      consumableHp + consumableAttack +
      perch.hp + perch.attack
    ) / 2);
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

  function monumentMaximumLevel(name) {
    return CATALOG.monumentItems?.find(item => item.name === name)?.maximumLevel || 1;
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
    let raw = slots.reduce((sum, tower, index) => sum + towerPower(tower, perches, index), 0);
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
    perches
      .filter(perch => perch?.level && perch?.dragonName)
      .forEach(perch => {
        let strategicBonus = 0;
        if (perch.elementalResistance) strategicBonus += 2;
        if (perch.towerBonus === "supershot-15") strategicBonus += 2;
        if (perch.specialBonus) strategicBonus += 2;
        bonus += strategicBonus;
        if (strategicBonus) {
          findings.push({
            severity: "good",
            title: `${perch.name} dragon bonuses active`,
            detail: "Its resistance and special battle benefits are included in defensive effectiveness."
          });
        }
      });
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
        <p class="nbp-trust-copy">Current DP is the number shown in game. Projected defensive strength includes entered tower levels, applicable runes, glyphs and relics, active perch rider skills and gear, plus placement, coverage and synergy. It is a planning estimate; rearranging towers does not change the game's displayed DP by itself.</p>
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
        <p class="nbp-muted">Enter the real assignments so NOIR • I ZI can include their island coverage. Riders, skills and every gear slot use the game catalogues.</p>
        <details class="nbp-construction-riders">
          <summary>
            <span>Construction riders</span>
            <small>Maximum construction-focused builds</small>
          </summary>
          <div class="nbp-construction-ranking">
            ${[
              ["Crom", "21%"],
              ["Amalia", "20.5%"],
              ["Adriel", "19%"],
              ["Bjorn", "17%"],
              ["Sola", "14%"],
              ["Defender", "12%"],
              ["Tanok", "7%"]
            ].map(([name, reduction], index) => `
              <article>
                <span>${index + 1}</span>
                <strong>${name}</strong>
                <b>−${reduction}</b>
              </article>
            `).join("")}
          </div>
          <p>Only the highest active construction reduction applies; rider bonuses do not stack. Place the bonded rider on a level 30+ perch for the full percentage.</p>
          <small>Crom’s 21% requires all four construction nodes: 3% + 3% + 5% + 10%. Amalia’s 20.5% also requires a construction-focused skill allocation.</small>
        </details>
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
              <fieldset class="nbp-perch-bonuses">
                <legend>Dragon perch bonuses</legend>
                <label>Resistance<select data-perch="${index}" data-field="elementalResistance">
                  <option value="">None</option>
                  ${["Wind", "Dark", "Ice", "Fire", "Earth"].map(element => `<option value="${element.toLowerCase()}-10" ${perch.elementalResistance === `${element.toLowerCase()}-10` ? "selected" : ""}>10% ${element}</option>`).join("")}
                </select></label>
                <label>Main bonus<select data-perch="${index}" data-field="towerBonus">
                  <option value="">None</option>
                  <option value="tower-health-15" ${perch.towerBonus === "tower-health-15" ? "selected" : ""}>Tower Health 15%</option>
                  <option value="tower-attack-10" ${perch.towerBonus === "tower-attack-10" ? "selected" : ""}>Tower Attack 10%</option>
                  <option value="supershot-15" ${perch.towerBonus === "supershot-15" ? "selected" : ""}>Supershot 15%</option>
                </select></label>
                <label>Special bonus<select data-perch="${index}" data-field="specialBonus">
                  <option value="">None</option>
                  <option value="tower-ward-25" ${perch.specialBonus === "tower-ward-25" ? "selected" : ""}>Tower Ward 25% HP</option>
                  <option value="refund-supershot-25" ${perch.specialBonus === "refund-supershot-25" ? "selected" : ""}>Refund Supershot 25%</option>
                  <option value="double-attack-20" ${perch.specialBonus === "double-attack-20" ? "selected" : ""}>2× Attack 20%</option>
                </select></label>
              </fieldset>
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
                    <div class="nbp-skill-chip">
                      <strong>${escapeHtml(skill)}</strong>
                      <label>Level<input type="number" min="1" max="${CATALOG.riderSkills?.find(item => item.name === skill)?.maximumLevel || 1}" data-skill-level="${index}:${skillIndex}" value="${perch.riderSkillLevels?.[skill] || CATALOG.riderSkills?.find(item => item.name === skill)?.maximumLevel || 1}"></label>
                      <button type="button" aria-label="Remove ${escapeHtml(skill)}" data-remove-skill="${index}:${skillIndex}">×</button>
                    </div>
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
          <div class="nbp-equipment-pair">
            <label>Rune<input data-catalog-kind="rune" id="nbpTowerRunes" value="${escapeHtml(tower?.runes || "")}" placeholder="Tap to search 281 runes" autocomplete="off"></label>
            <label>Level<input id="nbpTowerRuneLevel" type="number" min="1" max="${monumentMaximumLevel(tower?.runes)}" value="${tower?.runeLevel || ""}" placeholder="Max ${monumentMaximumLevel(tower?.runes)}"></label>
          </div>
          <div class="nbp-equipment-pair">
            <label>Glyph<input data-catalog-kind="glyph" id="nbpTowerGlyph" value="${escapeHtml(tower?.glyph || "")}" placeholder="Tap to search 287 glyphs" autocomplete="off"></label>
            <label>Level<input id="nbpTowerGlyphLevel" type="number" min="1" max="${monumentMaximumLevel(tower?.glyph)}" value="${tower?.glyphLevel || ""}" placeholder="Max ${monumentMaximumLevel(tower?.glyph)}"></label>
          </div>
          <div class="nbp-equipment-pair">
            <label>Relic<input data-catalog-kind="relic" id="nbpTowerRelic" value="${escapeHtml(tower?.relic || "")}" placeholder="Tap to search 23 relics" autocomplete="off"></label>
            <label>Level<input id="nbpTowerRelicLevel" type="number" min="1" max="${monumentMaximumLevel(tower?.relic)}" value="${tower?.relicLevel || ""}" placeholder="Max ${monumentMaximumLevel(tower?.relic)}"></label>
          </div>
          <fieldset class="nbp-tower-boosts">
            <legend>30% tower boosts</legend>
            <label><input id="nbpTowerHpBoost" type="checkbox" ${tower?.towerHpBoost ? "checked" : ""}><span>+30% HP</span></label>
            <label><input id="nbpTowerAttackBoost" type="checkbox" ${tower?.towerAttackBoost ? "checked" : ""}><span>+30% Attack</span></label>
          </fieldset>
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

  function playerXpForLevel(level) {
    const value = Math.max(600, Math.min(999, Number(level) || 600));
    let xp = 1959262;
    for (let current = 601; current <= value; current += 1) xp = Math.round(xp * 1.01);
    return xp;
  }

  function upgradeRubble(row) {
    let value = (Number(row?.seconds) || 0) * RUBBLE_VALUES.time;
    String(row?.cost || "").split(/[|;]/).forEach(part => {
      const [resource, amount] = part.split(":");
      value += (Number(amount) || 0) * (RUBBLE_VALUES[resource] || 0);
    });
    return value;
  }

  function accumulatedTowerRubble(type, level) {
    return fortRowsForType(type)
      .filter(row => Number(row.level) <= Number(level))
      .reduce((sum, row) => sum + upgradeRubble(row), 0);
  }

  function calculateMergeResultLevel(destinationType, destinationLevel, sourceType, sourceLevel, quantity, maximumTowerLevel) {
    const availableValue =
      accumulatedTowerRubble(destinationType, destinationLevel) +
      accumulatedTowerRubble(sourceType, sourceLevel) * quantity * MERGE_TRANSFER_RATE;
    return fortRowsForType(destinationType)
      .filter(row =>
        Number(row.level) <= maximumTowerLevel &&
        accumulatedTowerRubble(destinationType, row.level) <= availableValue
      )
      .reduce((highest, row) => Math.max(highest, Number(row.level) || 0), destinationLevel);
  }

  function mergePlanStats(planner) {
    const plans = Array.isArray(planner.mergePlans) ? planner.mergePlans : [];
    const accumulatedTowerXp = (type, level) => fortRowsForType(type)
      .filter(row => Number(row.level) <= Number(level))
      .reduce((sum, row) => sum + (Number(row.xp) || 0), 0);
    return plans.map((plan, index) => {
      const destinationXp = accumulatedTowerXp(plan.destinationType, plan.destinationLevel);
      const sourceXpEach = accumulatedTowerXp(plan.sourceType, plan.sourceLevel);
      const sourceXp = sourceXpEach * plan.quantity;
      const resultXp = accumulatedTowerXp(plan.destinationType, plan.resultLevel);
      const xpDeductedEach = Math.max(0, destinationXp + sourceXp - resultXp);
      return {
        ...plan,
        index,
        levelsMoved: Math.max(0, plan.resultLevel - plan.destinationLevel),
        destinationXp,
        sourceXp,
        sourceXpEach,
        resultXp,
        xpDeductedEach,
        xpDeducted: xpDeductedEach
      };
    });
  }

  function accountXpProjection(value) {
    const planner = normaliseFortPlanner(value);
    const currentLevel = planner.currentLevel;
    const targetLevel = planner.targetLevel;
    const ready = currentLevel >= 600;
    const targetValid = ready && targetLevel > currentLevel;
    const nextLevelXp = ready ? playerXpForLevel(currentLevel + 1) : 0;
    const xpToNextLevel = ready
      ? Math.max(0, nextLevelXp - planner.currentXp)
      : 0;
    const targetXp = targetValid
      ? Array.from({ length: targetLevel - currentLevel }, (_, index) =>
          playerXpForLevel(currentLevel + index + 1)
        ).reduce((sum, xp) => sum + xp, 0)
      : 0;
    const xpRemainingToTarget = targetValid
      ? Math.max(0, targetXp - planner.currentXp)
      : 0;
    return {
      planner,
      ready,
      currentLevel,
      targetLevel,
      levelsRequested: targetValid ? targetLevel - currentLevel : 0,
      nextLevelXp,
      xpToNextLevel,
      targetXp,
      xpRemainingToTarget,
      currentXp: planner.currentXp
    };
  }

  function fortPlan(value) {
    const planner = normaliseFortPlanner(value);
    const currentLevel = planner.currentLevel;
    const targetLevel = planner.targetLevel;
    const ready = currentLevel >= 600 && targetLevel > currentLevel;
    const merges = mergePlanStats(planner);
    const mergeXpDebt = merges.reduce((sum, item) => sum + item.xpDeducted, 0);
    if (!ready) {
      return {
        planner,
        currentLevel,
        targetLevel,
        xpNeeded: 0,
        earnedXp: 0,
        simulatedLevel: currentLevel,
        progressXp: planner.currentXp,
        reached: false,
        ready: false,
        route: [],
        summary: [],
        blockers: [],
        merges,
        mergeXpDebt
      };
    }
    const xpNeededBeforeMerges = Array.from({ length: targetLevel - currentLevel }, (_, index) =>
      playerXpForLevel(currentLevel + index + 1)
    ).reduce((sum, xp) => sum + xp, 0) - planner.currentXp;
    const xpNeeded = xpNeededBeforeMerges + mergeXpDebt;
    const instances = [];
    planner.storedTowers.filter(entry => entry.action === "upgrade").forEach((entry, entryIndex) => {
      for (let copy = 0; copy < entry.quantity; copy += 1) {
        instances.push({ entryIndex, copy, type: entry.type, level: entry.level });
      }
    });
    // Apply confirmed merges before simulating ordinary Fort upgrades. The
    // resulting tower continues from its merged level, while a matching source
    // tower is removed from the ordinary-upgrade pool when it was also entered.
    planner.mergePlans.forEach(plan => {
      for (let copy = 0; copy < plan.quantity; copy += 1) {
        const destination = instances.find(instance =>
          instance.type === plan.destinationType &&
          instance.level === plan.destinationLevel
        );
        if (!destination) continue;
        const destinationIndex = instances.indexOf(destination);
        const sourceIndex = instances.findIndex((instance, index) =>
          index !== destinationIndex &&
          instance.type === plan.sourceType &&
          instance.level === plan.sourceLevel
        );
        if (sourceIndex >= 0) instances.splice(sourceIndex, 1);
        destination.level = plan.resultLevel;
      }
    });
    let simulatedLevel = currentLevel;
    // WD protects the attained player level when a merge reduces total tower
    // XP. The reduction therefore becomes debt against the next player level.
    let progressXp = planner.currentXp - mergeXpDebt;
    let earnedXp = 0;
    const route = [];
    const safetyLimit = 50000;
    while (simulatedLevel < targetLevel && route.length < safetyLimit) {
      const choices = instances.map((instance, index) => {
        const next = fortRowsForType(instance.type).find(row => Number(row.level) === instance.level + 1);
        return next &&
          Number(next.level) <= planner.maximumTowerLevel &&
          (!next.playerLevelRequired || next.playerLevelRequired <= simulatedLevel)
          ? { instance, instanceIndex: index, next }
          : null;
      }).filter(Boolean).sort((left, right) =>
        Number(right.next.xp || 0) - Number(left.next.xp || 0) ||
        Number(left.next.seconds || 0) - Number(right.next.seconds || 0)
      );
      const choice = choices[0];
      if (!choice || !choice.next.xp) break;
      choice.instance.level = Number(choice.next.level);
      const xp = Number(choice.next.xp) || 0;
      earnedXp += xp;
      progressXp += xp;
      route.push({
        type: choice.instance.type,
        copy: choice.instance.copy + 1,
        from: choice.instance.level - 1,
        to: choice.instance.level,
        xp,
        cost: choice.next.cost || "",
        seconds: Number(choice.next.seconds) || 0
      });
      while (simulatedLevel < targetLevel && progressXp >= playerXpForLevel(simulatedLevel + 1)) {
        progressXp -= playerXpForLevel(simulatedLevel + 1);
        simulatedLevel += 1;
      }
    }
    const summary = Object.values(route.reduce((groups, step) => {
      const key = step.type;
      groups[key] ||= { type: key, upgrades: 0, xp: 0, seconds: 0 };
      groups[key].upgrades += 1;
      groups[key].xp += step.xp;
      groups[key].seconds += step.seconds;
      return groups;
    }, {})).sort((left, right) => right.xp - left.xp);
    const blockers = Object.values(instances.reduce((groups, instance) => {
      const next = fortRowsForType(instance.type).find(row => Number(row.level) === instance.level + 1);
      if (!next || Number(next.level) > planner.maximumTowerLevel || !next.playerLevelRequired || next.playerLevelRequired <= simulatedLevel) {
        return groups;
      }
      const key = `${instance.type}|${instance.level}|${next.level}|${next.playerLevelRequired}`;
      groups[key] ||= {
        type: instance.type,
        quantity: 0,
        from: instance.level,
        to: Number(next.level),
        playerLevelRequired: Number(next.playerLevelRequired)
      };
      groups[key].quantity += 1;
      return groups;
    }, {})).sort((left, right) => left.playerLevelRequired - right.playerLevelRequired);
    return {
      planner,
      currentLevel,
      targetLevel,
      xpNeeded: Math.max(0, xpNeeded),
      earnedXp,
      simulatedLevel,
      progressXp,
      reached: simulatedLevel >= targetLevel,
      ready: true,
      route,
      summary,
      blockers,
      merges,
      mergeXpDebt
    };
  }

  function formatNumber(value) {
    return Math.round(Number(value) || 0).toLocaleString("en-AU");
  }

  function formatDuration(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    return [days ? `${days}d` : "", hours ? `${hours}h` : ""].filter(Boolean).join(" ") || "Under 1h";
  }

  function renderFortPlanner(layout) {
    const result = fortPlan(layout.fortPlanner);
    const account = accountXpProjection(layout.fortPlanner);
    const fortTowerTypes = Array.from(new Set([
      ...Object.keys(CATALOG.towerLevels || {}),
      ...MAGES
    ])).sort((left, right) => left.localeCompare(right));
    const levelled = result.simulatedLevel - result.currentLevel;
    const targetCoverage = result.ready && result.xpNeeded > 0
      ? Math.min(100, (result.earnedXp / result.xpNeeded) * 100)
      : 0;
    const shortfallXp = Math.max(0, result.xpNeeded - result.earnedXp);
    const averageXp = result.route.length ? result.earnedXp / result.route.length : 0;
    const nextLevelXp = result.ready && result.simulatedLevel < 999 ? playerXpForLevel(result.simulatedLevel + 1) : 0;
    const nextLevelProgress = nextLevelXp
      ? Math.min(100, (result.progressXp / nextLevelXp) * 100)
      : 100;
    const mergeLevels = result.merges.reduce((sum, item) => sum + item.levelsMoved, 0);
    const mergeXpDebt = result.merges.reduce((sum, item) => sum + item.xpDeducted, 0);
    const inventoryCount = result.planner.storedTowers.reduce((sum, item) => sum + item.quantity, 0);
    const baseCount = result.planner.storedTowers
      .filter(item => item.location === "base")
      .reduce((sum, item) => sum + item.quantity, 0);
    const storageCount = inventoryCount - baseCount;
    const plannedCount = result.planner.storedTowers
      .filter(item => item.action === "upgrade")
      .reduce((sum, item) => sum + item.quantity, 0);
    return `
      <section class="nbp-panel nbp-fort-planner">
        <div class="nbp-section-heading">
          <div><p class="nbp-kicker">FORTIFICATION PLANNER</p><h3>Plan a target player level</h3></div>
          <span class="nbp-estimate-label">Game XP values</span>
        </div>
        <p class="nbp-muted">Enter the active or stored towers you can upgrade. NOIR • I ZI simulates legal upgrades and checks whether they contain enough building XP to reach your target.</p>
        <div class="nbp-fort-targets">
          <label>Current player level<input data-fort-field="currentLevel" type="number" min="0" max="998" value="${result.planner.currentLevel}"></label>
          <label>Target player level<input data-fort-field="targetLevel" type="number" min="0" max="999" value="${result.planner.targetLevel}"></label>
          <label>XP already earned toward next level<input data-fort-field="currentXp" type="number" min="0" value="${result.planner.currentXp}"></label>
          <label>Highest available tower level<input data-fort-field="maximumTowerLevel" type="number" min="1" max="250" value="${result.planner.maximumTowerLevel}"></label>
        </div>
        <div class="nbp-account-calculator">
          <div class="nbp-section-heading">
            <div><p class="nbp-kicker">QUICK CALCULATOR</p><h4>Account XP requirements</h4></div>
            <span class="nbp-estimate-label">No tower entry needed</span>
          </div>
          <p class="nbp-muted">NOIR • I ZI calculates these figures automatically from the current level, target level and visible XP progress entered above. Add towers below when you want NOIR • I ZI to calculate where the available upgrades will actually take the account.</p>
          <div class="nbp-fort-stats nbp-account-results">
            <article><small>Current player level</small><strong>${account.ready ? account.currentLevel : "—"}</strong></article>
            <article><small>Target player level</small><strong>${account.targetLevel > account.currentLevel ? account.targetLevel : "—"}</strong></article>
            <article><small>Player levels requested</small><strong>${account.levelsRequested || 0}</strong></article>
            <article><small>XP already counted</small><strong>${formatNumber(account.currentXp)}</strong></article>
            <article><small>XP needed for next level</small><strong>${account.ready ? formatNumber(account.xpToNextLevel) : "—"}</strong></article>
            <article><small>Total XP still needed for target</small><strong>${account.targetLevel > account.currentLevel ? formatNumber(account.xpRemainingToTarget) : "—"}</strong></article>
          </div>
        </div>
        <div class="nbp-fort-divider"><span>Detailed tower upgrade planner</span></div>
        <details class="nbp-inventory-import" ${inventoryCount ? "open" : ""}>
          <summary>Veteran inventory ${inventoryCount ? `(${inventoryCount} towers)` : ""}</summary>
          <p class="nbp-muted">Import an Excel or CSV inventory with <strong>Tower, Level, Stored?</strong> columns. NOIR • I ZI recognises veteran shorthand, groups matching towers and keeps the live base separate from storage.</p>
          <label class="nbp-inventory-file">Import tower inventory
            <input id="nbpInventoryInput" type="file" accept=".xlsx,.xls,.csv,text/csv">
          </label>
          <p id="nbpInventoryStatus" class="nbp-trust-copy">${result.planner.inventoryImportedAt ? `Last imported ${escapeHtml(new Date(result.planner.inventoryImportedAt).toLocaleString("en-AU"))}.` : "Nothing is uploaded to the cloud; the inventory stays on this device."}</p>
          ${inventoryCount ? `
            <div class="nbp-inventory-summary">
              <article><small>Total towers</small><strong>${inventoryCount}</strong></article>
              <article><small>On live base</small><strong>${baseCount}</strong></article>
              <article><small>In storage</small><strong>${storageCount}</strong></article>
              <article><small>Planned for upgrades</small><strong>${plannedCount}</strong></article>
            </div>
            <button type="button" class="nbp-danger" id="nbpClearInventory">Clear imported inventory</button>
          ` : ""}
        </details>
        <p class="nbp-fort-entry-help">Add a tower manually or import the whole veteran inventory above. Choose whether each grouped row is being upgraded, held, merged or transformed this Fort.</p>
        <div class="nbp-fort-entry">
          <label>Available tower<select id="nbpFortTowerType">
            ${fortTowerTypes.map(type => `<option>${escapeHtml(type)}</option>`).join("")}
          </select></label>
          <label>Current level<input id="nbpFortTowerLevel" type="number" min="0" value="0"></label>
          <label>Quantity<input id="nbpFortTowerQuantity" type="number" min="1" max="100" value="1"></label>
          <label>Location<select id="nbpFortTowerLocation"><option value="base">Live base</option><option value="storage">Storage</option></select></label>
          <button type="button" class="nbp-primary" id="nbpAddStoredTower">Add tower</button>
        </div>
        <div class="nbp-inventory-tabs" role="group" aria-label="Tower inventory filters">
          <button type="button" data-inventory-filter="all" class="active">All ${inventoryCount}</button>
          <button type="button" data-inventory-filter="base">Base ${baseCount}</button>
          <button type="button" data-inventory-filter="storage">Storage ${storageCount}</button>
        </div>
        <div class="nbp-fort-storage" id="nbpInventoryRows">
          ${result.planner.storedTowers.map((entry, index) => `
            <article data-inventory-location="${entry.location}">
              <div><strong>${escapeHtml(entry.type)}</strong><small>Level ${entry.level} · quantity ${entry.quantity} · ${entry.location === "base" ? "live base" : "storage"}</small></div>
              <select data-inventory-action="${index}" aria-label="Planned Fort action for ${escapeHtml(entry.type)}">
                ${Object.entries(INVENTORY_ACTIONS).map(([value, label]) => `<option value="${value}" ${entry.action === value ? "selected" : ""}>${label}</option>`).join("")}
              </select>
              <button type="button" data-remove-stored="${index}">Remove</button>
            </article>
          `).join("") || `<p class="nbp-empty-copy">Add the active or stored towers available for Fort.</p>`}
        </div>
        <details class="nbp-merge-planner" ${result.merges.length ? "open" : ""}>
          <summary>Tower merge &amp; XP debt ${result.merges.length ? `(${result.merges.length})` : ""}</summary>
          <p class="nbp-muted"><strong>1.</strong> Choose the active tower being kept. <strong>2.</strong> Choose the stored or active tower being consumed. <strong>3.</strong> Enter how many matching towers are selected together. NOIR • I ZI calculates the resulting level and XP debt.</p>
          <p class="nbp-trust-copy">The calculation uses WD's verified 45% transfer of construction time, shards, embers and other eligible tower value, while respecting the current maximum tower level.</p>
          <div class="nbp-merge-entry">
            <label>Tower being improved and kept<select id="nbpMergeDestinationType">
              ${fortTowerTypes.map(type => `<option>${escapeHtml(type)}</option>`).join("")}
            </select></label>
            <label>Kept tower's current level<input id="nbpMergeDestinationLevel" type="number" min="1" max="${result.planner.maximumTowerLevel}" value="1"></label>
            <label>Tower being consumed<select id="nbpMergeSourceType">
              ${fortTowerTypes.map(type => `<option>${escapeHtml(type)}</option>`).join("")}
            </select></label>
            <label>Consumed tower's level<input id="nbpMergeSourceLevel" type="number" min="1" max="${result.planner.maximumTowerLevel}" value="1"></label>
            <label>Number of matching towers consumed<input id="nbpMergeQuantity" type="number" min="1" max="100" value="1"></label>
            <button type="button" class="nbp-primary" id="nbpAddMergePlan">Calculate merge</button>
          </div>
          <div class="nbp-merge-list">
            ${result.merges.map(item => `
              <article>
                <div>
                  <strong>Keep ${escapeHtml(item.destinationType)} level ${item.destinationLevel} → ${item.resultLevel}</strong>
                  <small>Consumes ${item.quantity > 1 ? `${item.quantity} × ` : ""}${escapeHtml(item.sourceType)} level ${item.sourceLevel} · ${formatNumber(item.xpDeducted)} XP debt</small>
                </div>
                <button type="button" data-remove-merge="${item.index}">Remove</button>
              </article>
            `).join("") || `<p class="nbp-empty-copy">No merge strategy added.</p>`}
          </div>
          ${result.merges.length ? `
            <div class="nbp-merge-summary">
              <article><small>Levels added to kept towers</small><strong>${formatNumber(mergeLevels)}</strong></article>
              <article><small>Player XP awarded by merging</small><strong>0</strong></article>
              <article><small>Player XP debt created</small><strong>${formatNumber(mergeXpDebt)}</strong></article>
              <article><small>Added to next-level requirement</small><strong>${formatNumber(mergeXpDebt)}</strong></article>
            </div>
          ` : ""}
          <p class="nbp-trust-copy">Merging never lowers an attained player level. If tower XP is lost, WD increases the distance to the next level by the same amount. Later normal upgrades must repay that XP debt before adding progress toward another player level.</p>
        </details>
        <div class="nbp-fort-result ${result.reached ? "reached" : "short"}">
          <strong>${!result.ready ? "Enter your levels to calculate" : result.reached ? `Target ${result.targetLevel} is reachable` : `Entered upgrades reach player level ${result.simulatedLevel}`}</strong>
          <p>${formatNumber(result.xpNeeded)} XP required${mergeXpDebt ? ` including ${formatNumber(mergeXpDebt)} merge debt` : ""} · ${formatNumber(result.earnedXp)} XP planned · ${result.route.length} upgrades</p>
          ${!result.ready
            ? `<p>Enter a current level from 600 and a higher target level.</p>`
            : result.reached
            ? `<p>Estimated build time before speedups: ${formatDuration(result.route.reduce((sum, step) => sum + step.seconds, 0))}</p>`
            : `<p>${result.targetLevel - result.simulatedLevel} player level${result.targetLevel - result.simulatedLevel === 1 ? "" : "s"} remain after every legal entered upgrade.</p>`}
        </div>
        ${result.blockers.length ? `
          <div class="nbp-fort-blockers">
            <strong>Why the calculation stopped</strong>
            ${result.blockers.map(item => `
              <p>${item.quantity > 1 ? `${item.quantity} × ` : ""}${escapeHtml(item.type)}: tower level ${item.to} requires player level ${item.playerLevelRequired}.</p>
            `).join("")}
            <small>Add other towers with upgrades available at player level ${result.simulatedLevel} to continue toward ${result.targetLevel}.</small>
          </div>
        ` : ""}
        <div class="nbp-fort-stats">
          <article><small>Requested target level</small><strong>${result.targetLevel || 0}</strong></article>
          <article><small>Target XP covered</small><strong>${targetCoverage.toFixed(2)}%</strong></article>
          <article><small>XP still required</small><strong>${formatNumber(shortfallXp)}</strong></article>
          <article><small>Average XP per upgrade</small><strong>${formatNumber(averageXp)}</strong></article>
          <article><small>Level reached with entered towers</small><strong>${result.simulatedLevel}</strong></article>
          <article><small>${result.progressXp < 0 ? "Merge XP debt remaining" : "Progress into next level"}</small><strong>${!result.ready ? "0" : result.reached ? "Target reached" : result.progressXp < 0 ? formatNumber(Math.abs(result.progressXp)) : `${formatNumber(result.progressXp)} / ${formatNumber(nextLevelXp)} (${nextLevelProgress.toFixed(1)}%)`}</strong></article>
          <article><small>Player levels gained</small><strong>${levelled}</strong></article>
        </div>
        ${result.summary.length ? `
          <div class="nbp-fort-route">
            <h4>Recommended upgrade route</h4>
            ${result.summary.map(item => `
              <article><strong>${escapeHtml(item.type)}</strong><span>${item.upgrades} upgrades · ${formatNumber(item.xp)} XP · ${formatDuration(item.seconds)}</span></article>
            `).join("")}
          </div>
        ` : ""}
        <p class="nbp-trust-copy">Supports player levels 600–999 using the current WD level curve. Results depend on the available towers and current XP entered by the player.</p>
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
          <div><p class="nbp-kicker">NOIR • I ZI ADVISER</p><h3>${findings.length ? "What this layout needs" : "No recorded conflicts"}</h3></div>
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
              const bonuses = KNOWN_DRAGON_PERCH_BONUSES[item.name] || {
                elementalResistance: "",
                towerBonus: "",
                specialBonus: ""
              };
              pushHistory();
              layout.perches[perchIndex].dragonName = item.name;
              layout.perches[perchIndex].dragonClass = item.dragonClass || "";
              Object.assign(layout.perches[perchIndex], bonuses);
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
            if (["rune", "glyph", "relic"].includes(kind)) {
              const levelInput = overlay.querySelector({
                rune: "#nbpTowerRuneLevel",
                glyph: "#nbpTowerGlyphLevel",
                relic: "#nbpTowerRelicLevel"
              }[kind]);
              if (levelInput) {
                levelInput.max = String(item.maximumLevel || 1);
                levelInput.value = String(item.maximumLevel || 1);
              }
            }
            if (kind.startsWith("gear:")) {
              const perchIndex = Number(input.dataset.gear);
              const slot = input.dataset.gearSlot;
              const variants = Array.isArray(item.variants) ? item.variants : [];
              const variant = variants[variants.length - 1];
              pushHistory();
              layout.perches[perchIndex].riderGear[slot] = {
                name: item.name,
                rarity: variant?.rarity || item.rarities?.[item.rarities.length - 1] || "",
                level: variant?.maximumLevel || item.maximumLevel || 1
              };
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
          <div><p>NOIR • I ZI BASE ADVISER</p><h2>Build, compare and strengthen</h2></div>
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
        ${renderFortPlanner(layout)}
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
    overlay.querySelectorAll("[data-fort-field]").forEach(field => {
      field.addEventListener("change", event => {
        layout.fortPlanner[event.target.dataset.fortField] = Math.max(0, Number.parseInt(event.target.value, 10) || 0);
        layout.fortPlanner = normaliseFortPlanner(layout.fortPlanner);
        saveState();
        render();
      });
    });
    overlay.querySelector("#nbpAddStoredTower")?.addEventListener("click", () => {
      const type = overlay.querySelector("#nbpFortTowerType")?.value;
      const level = Math.max(0, Number.parseInt(overlay.querySelector("#nbpFortTowerLevel")?.value, 10) || 0);
      const quantity = Math.max(1, Math.min(100, Number.parseInt(overlay.querySelector("#nbpFortTowerQuantity")?.value, 10) || 1));
      const location = overlay.querySelector("#nbpFortTowerLocation")?.value === "base" ? "base" : "storage";
      if (!type || !fortRowsForType(type).length) return;
      layout.fortPlanner.storedTowers.push({ type, level, quantity, location, action: "upgrade" });
      saveState();
      render();
    });
    overlay.querySelector("#nbpInventoryInput")?.addEventListener("change", async event => {
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const rows = await readInventoryFile(file);
        const parsed = parseInventoryRows(rows);
        if (!parsed.entries.length) {
          window.alert("No supported tower rows were found. Use Tower, Level and Stored? columns.");
          return;
        }
        layout.fortPlanner.storedTowers = parsed.entries;
        layout.fortPlanner.inventoryImportedAt = new Date().toISOString();
        layout.fortPlanner = normaliseFortPlanner(layout.fortPlanner);
        saveState();
        render();
        if (parsed.rejected.length) {
          window.alert(`${parsed.entries.reduce((sum, item) => sum + item.quantity, 0)} towers imported. ${parsed.rejected.length} unsupported or incomplete row${parsed.rejected.length === 1 ? " was" : "s were"} skipped.`);
        }
      } catch (error) {
        console.error("NOIR • I ZI inventory import failed.", error);
        window.alert(error?.message || "That inventory could not be read.");
      }
    });
    overlay.querySelector("#nbpClearInventory")?.addEventListener("click", () => {
      if (!window.confirm("Clear the imported Base and Storage inventory?")) return;
      layout.fortPlanner.storedTowers = [];
      layout.fortPlanner.inventoryImportedAt = "";
      saveState();
      render();
    });
    overlay.querySelectorAll("[data-inventory-filter]").forEach(button => {
      button.addEventListener("click", () => {
        const filter = button.dataset.inventoryFilter;
        overlay.querySelectorAll("[data-inventory-filter]").forEach(item => item.classList.toggle("active", item === button));
        overlay.querySelectorAll("[data-inventory-location]").forEach(row => {
          row.classList.toggle("hidden", filter !== "all" && row.dataset.inventoryLocation !== filter);
        });
      });
    });
    overlay.querySelectorAll("[data-inventory-action]").forEach(select => {
      select.addEventListener("change", () => {
        const item = layout.fortPlanner.storedTowers[Number(select.dataset.inventoryAction)];
        if (!item || !Object.hasOwn(INVENTORY_ACTIONS, select.value)) return;
        item.action = select.value;
        saveState();
        render();
      });
    });
    overlay.querySelectorAll("[data-remove-stored]").forEach(button => {
      button.addEventListener("click", () => {
        layout.fortPlanner.storedTowers.splice(Number(button.dataset.removeStored), 1);
        saveState();
        render();
      });
    });
    overlay.querySelector("#nbpAddMergePlan")?.addEventListener("click", () => {
      const destinationType = overlay.querySelector("#nbpMergeDestinationType")?.value || "";
      const destinationLevel = Math.max(0, Number.parseInt(overlay.querySelector("#nbpMergeDestinationLevel")?.value, 10) || 0);
      const sourceType = overlay.querySelector("#nbpMergeSourceType")?.value || "";
      const sourceLevel = Math.max(0, Number.parseInt(overlay.querySelector("#nbpMergeSourceLevel")?.value, 10) || 0);
      const quantity = Math.max(1, Math.min(100, Number.parseInt(overlay.querySelector("#nbpMergeQuantity")?.value, 10) || 1));
      const maximumTowerLevel = layout.fortPlanner.maximumTowerLevel;
      if (!destinationType || !sourceType) {
        window.alert("Choose both the tower being kept and the tower being consumed.");
        return;
      }
      if (destinationLevel < 1 || sourceLevel < 1) {
        window.alert("Enter the current level of both towers.");
        return;
      }
      if (destinationLevel > maximumTowerLevel || sourceLevel > maximumTowerLevel) {
        window.alert(`Tower levels cannot exceed the current level ${maximumTowerLevel} cap.`);
        return;
      }
      const resultLevel = calculateMergeResultLevel(
        destinationType,
        destinationLevel,
        sourceType,
        sourceLevel,
        quantity,
        maximumTowerLevel
      );
      if (resultLevel <= destinationLevel) {
        window.alert("Those consumed towers do not contain enough transferable value to raise the kept tower by a level.");
        return;
      }
      layout.fortPlanner.mergePlans.push({
        destinationType,
        destinationLevel,
        sourceType,
        sourceLevel,
        resultLevel,
        quantity
      });
      layout.fortPlanner = normaliseFortPlanner(layout.fortPlanner);
      saveState();
      render();
    });
    overlay.querySelectorAll("[data-remove-merge]").forEach(button => {
      button.addEventListener("click", () => {
        layout.fortPlanner.mergePlans.splice(Number(button.dataset.removeMerge), 1);
        saveState();
        render();
      });
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
        runeLevel: overlay.querySelector("#nbpTowerRuneLevel")?.value,
        glyph: overlay.querySelector("#nbpTowerGlyph")?.value,
        glyphLevel: overlay.querySelector("#nbpTowerGlyphLevel")?.value,
        relic: overlay.querySelector("#nbpTowerRelic")?.value,
        relicLevel: overlay.querySelector("#nbpTowerRelicLevel")?.value,
        towerHpBoost: overlay.querySelector("#nbpTowerHpBoost")?.checked,
        towerAttackBoost: overlay.querySelector("#nbpTowerAttackBoost")?.checked
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
        const catalogueSkill = CATALOG.riderSkills?.find(item => item.name === skill);
        layout.perches[index].riderSkillLevels[skill] = catalogueSkill?.maximumLevel || 1;
        saveState();
        render();
      });
    });
    overlay.querySelectorAll("[data-skill-level]").forEach(field => {
      field.addEventListener("change", event => {
        const [perchIndex, skillIndex] = event.target.dataset.skillLevel.split(":").map(Number);
        const skill = layout.perches[perchIndex].riderSkills[skillIndex];
        if (!skill) return;
        pushHistory();
        layout.perches[perchIndex].riderSkillLevels[skill] = Math.max(1, Number.parseInt(event.target.value, 10) || 1);
        saveState();
        render();
      });
    });
    overlay.querySelectorAll("[data-remove-skill]").forEach(button => {
      button.addEventListener("click", () => {
        const [perchIndex, skillIndex] = button.dataset.removeSkill.split(":").map(Number);
        pushHistory();
        const [removed] = layout.perches[perchIndex].riderSkills.splice(skillIndex, 1);
        if (removed) delete layout.perches[perchIndex].riderSkillLevels[removed];
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
      .nbp-launch{width:100%;margin:0;padding:22px;display:flex;justify-content:space-between;align-items:center;gap:16px;border:1px solid rgba(72,178,153,.46);border-radius:24px;background:linear-gradient(135deg,rgba(13,62,52,.7),rgba(4,9,8,.98) 74%);color:#eee9df;text-align:left;box-sizing:border-box}
      .nbp-merge-launch{border-color:rgba(215,186,100,.55);background:linear-gradient(135deg,rgba(75,55,16,.72),rgba(4,9,8,.98) 74%)}
      .nbp-merge-launch .nbp-launch-icon{color:#d7ba64}
      .nbp-launch strong,.nbp-launch small{display:block}.nbp-launch strong{font-size:19px}.nbp-launch small{margin-top:7px;color:#aaa49b;line-height:1.45;font-size:13px}.nbp-launch-icon{color:#69d2b4;font-size:31px}
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
      .nbp-construction-riders{margin-top:15px;padding:15px;border:1px solid rgba(105,210,180,.35);border-radius:16px;background:rgba(20,63,53,.14)}.nbp-construction-riders>summary{display:flex;justify-content:space-between;align-items:center;gap:12px;color:#78d4b8;font-weight:900;cursor:pointer}.nbp-construction-riders>summary small{color:#91aaa2;font-size:11px;font-weight:700;text-align:right}.nbp-construction-ranking{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:14px}.nbp-construction-ranking article{display:grid;grid-template-columns:25px minmax(0,1fr) auto;gap:7px;align-items:center;padding:10px;border:1px solid rgba(105,210,180,.24);border-radius:12px;background:#0b1110}.nbp-construction-ranking span{display:grid;width:23px;height:23px;place-items:center;border-radius:7px;color:#0a1713;background:#78d4b8;font-size:11px;font-weight:950}.nbp-construction-ranking strong{font-size:12px}.nbp-construction-ranking b{color:#78d4b8;font-size:12px}.nbp-construction-riders>p{margin:13px 0 5px;color:#c4d2cd;font-size:12px;line-height:1.5}.nbp-construction-riders>small{display:block;color:#91aaa2;font-size:11px;line-height:1.5}
      .nbp-perch-details{margin-top:13px;padding-top:11px;border-top:1px solid #292b2e}.nbp-perch-details summary{color:#d8bc69;font-weight:850;cursor:pointer}.nbp-add-row{display:grid;grid-template-columns:1fr auto;gap:7px;align-items:end}.nbp-add-row button{margin-top:7px}.nbp-chip-list{display:grid;gap:7px;margin-top:9px}.nbp-skill-chip{display:grid;grid-template-columns:minmax(0,1fr) 76px 36px;gap:7px;align-items:center;padding:8px 9px;border:1px solid rgba(83,156,123,.35);border-radius:12px;background:rgba(34,81,65,.25);color:#b9dcca}.nbp-skill-chip strong{font-size:12px;overflow-wrap:anywhere}.nbp-skill-chip label{font-size:10px}.nbp-skill-chip input{min-height:34px;padding:6px}.nbp-skill-chip button{min-height:34px;padding:5px;border-radius:9px;color:#e5a3ae;background:rgba(110,37,54,.25)}.nbp-chip-list small{color:#8f8b85}.nbp-gear-grid{display:grid;gap:9px}.nbp-gear-piece{padding:10px;border:1px solid #292b2e;border-radius:12px;background:#0d0e10}.nbp-gear-grid label{font-size:11px}.nbp-equipment-pair{display:grid;grid-template-columns:minmax(0,1fr) 92px;gap:8px;align-items:end}.nbp-tower-boosts{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:3px 0 0;padding:10px;border:1px solid #303237;border-radius:13px}.nbp-tower-boosts legend,.nbp-perch-bonuses legend{padding:0 5px;color:#d8bc69;font-size:12px;font-weight:850}.nbp-tower-boosts label{display:flex;gap:8px;align-items:center;min-height:42px;padding:8px 10px;border:1px solid rgba(216,188,105,.22);border-radius:10px;background:#0d0e10}.nbp-tower-boosts input{width:20px;height:20px;min-height:0;margin:0;accent-color:#d8bc69}.nbp-tower-boosts span{font-size:12px;font-weight:800}.nbp-perch-bonuses{display:grid;gap:8px;margin:5px 0 3px;padding:10px;border:1px solid #303237;border-radius:13px}.nbp-perch-bonuses label{font-size:11px}
      [data-catalog-kind]{position:relative}.nbp-suggestions{position:relative;z-index:8;max-height:280px;margin-top:6px;overflow-y:auto;border:1px solid #4a4c50;border-radius:13px;background:#090a0b;box-shadow:0 14px 32px rgba(0,0,0,.55)}.nbp-suggestions button{display:block;width:100%;padding:11px 12px;border:0!important;border-bottom:1px solid #242629!important;border-radius:0!important;text-align:left;background:#0d0e10!important}.nbp-suggestions button:last-child{border-bottom:0!important}.nbp-suggestions strong,.nbp-suggestions small{display:block}.nbp-suggestions strong{color:#eeeae2}.nbp-suggestions small{margin-top:4px;color:#a9a39a;font-size:11px}.nbp-suggestions p{margin:0;padding:13px;color:#99938a}
      .nbp-fort-entry-help{margin:13px 0 0;color:#c9b770;font-size:12px;line-height:1.45}.nbp-fort-blockers{margin-top:10px;padding:13px 14px;border:1px solid rgba(213,184,95,.42);border-radius:13px;background:rgba(91,72,20,.15)}.nbp-fort-blockers strong{color:#dfc36e}.nbp-fort-blockers p{margin:7px 0 0;color:#d0c9bd}.nbp-fort-blockers small{display:block;margin-top:8px;color:#9f998f;line-height:1.4}
      .nbp-fort-targets{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}.nbp-account-calculator{margin-top:16px;padding:15px;border:1px solid rgba(103,163,216,.38);border-radius:16px;background:rgba(27,54,79,.18)}.nbp-account-calculator h4{margin:5px 0 0;font-size:18px}.nbp-account-results article{border-color:rgba(103,163,216,.28);background:#0b1015}.nbp-account-results strong{color:#86c8f2}.nbp-fort-divider{display:flex;align-items:center;gap:10px;margin:20px 0 4px;color:#d9bd68;font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.09em}.nbp-fort-divider::before,.nbp-fort-divider::after{content:"";height:1px;flex:1;background:#343638}.nbp-inventory-import{margin:15px 0;padding:15px;border:1px solid rgba(215,186,100,.38);border-radius:16px;background:rgba(65,50,16,.14)}.nbp-inventory-import>summary{color:#dfc36e;font-weight:950;cursor:pointer}.nbp-inventory-file{display:inline-block;margin:12px 0;padding:12px 15px;border:1px solid #d7ba64;border-radius:13px;background:#d7ba64;color:#090909!important;cursor:pointer}.nbp-inventory-file input{display:none}.nbp-inventory-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.nbp-inventory-summary article{padding:12px;border:1px solid rgba(215,186,100,.25);border-radius:12px;background:#0d0e10}.nbp-inventory-summary small,.nbp-inventory-summary strong{display:block}.nbp-inventory-summary small{color:#9c978f;font-size:11px}.nbp-inventory-summary strong{margin-top:5px;color:#dfc36e;font-size:18px}.nbp-inventory-tabs{display:flex;gap:7px;margin-top:14px;overflow-x:auto}.nbp-inventory-tabs button{white-space:nowrap}.nbp-inventory-tabs button.active{border-color:#78d4b8;color:#78d4b8;background:rgba(20,63,53,.3)}.nbp-fort-entry{display:grid;grid-template-columns:minmax(170px,1fr) 100px 80px 110px auto;gap:9px;align-items:end;margin-top:15px}.nbp-fort-entry button{min-height:47px}.nbp-fort-storage{display:grid;gap:7px;margin-top:13px}.nbp-fort-storage article,.nbp-fort-route article{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 12px;border:1px solid #303237;border-radius:12px;background:#0c0d0f}.nbp-fort-storage article>div{min-width:170px;flex:1}.nbp-fort-storage article select{width:min(210px,100%);margin:0}.nbp-fort-storage strong,.nbp-fort-storage small{display:block}.nbp-fort-storage small{margin-top:4px;color:#9c978f}.nbp-fort-result{margin-top:14px;padding:15px;border:1px solid #3b3d41;border-radius:15px;background:#0b0c0d}.nbp-fort-result.reached{border-color:rgba(79,188,147,.55);background:rgba(29,74,58,.2)}.nbp-fort-result.short{border-color:rgba(213,184,95,.4)}.nbp-fort-result strong{color:#dfc36e}.nbp-fort-result p{margin:6px 0 0;color:#aaa49b}.nbp-fort-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:10px}.nbp-fort-stats article{padding:12px;border:1px solid #303237;border-radius:12px;background:#0c0d0f}.nbp-fort-stats small,.nbp-fort-stats strong{display:block}.nbp-fort-stats small{color:#9c978f;font-size:11px}.nbp-fort-stats strong{margin-top:5px;color:#dfc36e;font-size:15px}.nbp-fort-route{display:grid;gap:7px;margin-top:14px}.nbp-fort-route h4{margin:0 0 2px}.nbp-fort-route span{color:#a9a39a;font-size:12px;text-align:right}
      .nbp-merge-planner{margin-top:16px;padding:14px;border:1px solid rgba(105,210,180,.35);border-radius:15px;background:rgba(20,63,53,.12)}.nbp-merge-planner>summary{color:#78d4b8;font-weight:900;cursor:pointer}.nbp-merge-entry{display:grid;grid-template-columns:repeat(3,minmax(130px,1fr));gap:9px;align-items:end;margin-top:13px}.nbp-merge-entry button{min-height:47px}.nbp-merge-list{display:grid;gap:7px;margin-top:12px}.nbp-merge-list article{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 12px;border:1px solid #303c38;border-radius:12px;background:#0b1110}.nbp-merge-list strong,.nbp-merge-list small{display:block}.nbp-merge-list small{margin-top:4px;color:#9eb4ad}.nbp-merge-summary{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:12px}.nbp-merge-summary article{padding:12px;border:1px solid rgba(105,210,180,.28);border-radius:12px;background:#0b1110}.nbp-merge-summary small,.nbp-merge-summary strong{display:block}.nbp-merge-summary small{color:#91aaa2;font-size:11px}.nbp-merge-summary strong{margin-top:5px;color:#78d4b8}
      .nbp-findings{display:grid;gap:10px;margin-top:14px}.nbp-finding{padding:14px 15px;border:1px solid #303030;border-left-width:4px;border-radius:15px;background:#0b0b0b}.nbp-finding strong{display:block}.nbp-finding p{margin:5px 0 0;color:#aaa49b;line-height:1.45}.nbp-finding.error{border-left-color:#e08089}.nbp-finding.warning{border-left-color:#dcc16e}.nbp-finding.good{border-left-color:#69dab0}.nbp-empty-copy{color:#99938a}.nbp-danger-zone{text-align:center}.nbp-danger-zone button{color:#dda2ad;border-color:rgba(190,105,121,.45)}.hidden{display:none!important}
      @media(max-width:720px){.nct-home-tools .nbp-launch{min-height:0}.nbp-base-details,.nbp-meter-grid,.nbp-form-grid,.nbp-perch-grid,.nbp-photo-grid,.nbp-fort-targets,.nbp-fort-entry,.nbp-merge-entry{grid-template-columns:1fr}.nbp-fort-stats,.nbp-merge-summary,.nbp-construction-ranking,.nbp-inventory-summary{grid-template-columns:repeat(2,1fr)}.nbp-construction-riders>summary{align-items:flex-start;flex-direction:column}.nbp-construction-riders>summary small{text-align:left}.nbp-section-heading{align-items:flex-start;flex-wrap:wrap}.nbp-island-slots{grid-template-columns:repeat(5,minmax(82px,1fr));overflow-x:auto;padding-bottom:5px}.nbp-slot{min-width:82px}.nbp-photo-grid img{height:auto;max-height:360px}.nbp-fort-route article,.nbp-merge-list article,.nbp-fort-storage article{align-items:stretch;flex-direction:column}.nbp-fort-storage article select{width:100%}.nbp-fort-route span{text-align:left}}
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
    launch.addEventListener("click", () => open());

    const mergeLaunch = document.createElement("button");
    mergeLaunch.type = "button";
    mergeLaunch.className = "nbp-launch nbp-merge-launch";
    mergeLaunch.innerHTML = `<span><strong>Tower Merge Calculator</strong><small>See the resulting tower level and any player XP debt before you merge.</small></span><span class="nbp-launch-icon" aria-hidden="true">⇄</span>`;
    mergeLaunch.addEventListener("click", () => open("merge"));

    const tools = document.querySelector(".nct-home-tools");
    const share = tools?.querySelector(".nct-share");
    if (share) {
      tools.insertBefore(launch, share);
      tools.insertBefore(mergeLaunch, share);
    } else if (tools) {
      tools.prepend(launch);
      launch.insertAdjacentElement("afterend", mergeLaunch);
    } else {
      const progress = document.querySelector("#activeSessionTitle")?.closest(".content-panel");
      progress?.insertAdjacentElement("afterend", launch);
      launch.insertAdjacentElement("afterend", mergeLaunch);
    }

    const overlay = document.createElement("section");
    overlay.id = OVERLAY_ID;
    overlay.className = "nbp-overlay";
    overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(overlay);
  }

  function open(section = "") {
    render();
    const overlay = document.getElementById(OVERLAY_ID);
    overlay?.classList.add("open");
    overlay?.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    if (section === "merge") {
      window.requestAnimationFrame(() => {
        const mergeCalculator = overlay?.querySelector(".nbp-merge-planner");
        if (!mergeCalculator) return;
        mergeCalculator.open = true;
        mergeCalculator.scrollIntoView({ behavior: "smooth", block: "start" });
        mergeCalculator.querySelector("select, input, button")?.focus({ preventScroll: true });
      });
    }
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
    accountXpProjection,
    fortPlan,
    parseInventoryRows,
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
