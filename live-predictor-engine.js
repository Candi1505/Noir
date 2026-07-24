/* ============================================================
   CHEST COMPANION BETA
   LIVE PREDICTOR ENGINE

   Must load after:
   - event-parser.js
   - event-import.js

   Responsibilities:
   - Reads published War Dragons event data
   - Supports Gold, Platinum, Draconic and Freedom decks
   - Creates a searchable reward catalogue
   - Records each player's observations locally
   - Solves the player's position
   - Predicts upcoming rewards
   - Provides an admin-ready event publishing API
   ============================================================ */

(function initialiseLivePredictorEngine(window) {
  "use strict";

  const PLAYER_STORAGE_KEY =
    "chestCompanionLivePredictor";

  const EVENT_CACHE_KEY =
    "chestCompanionPublishedEvent";

  const SUPPORTED_CHESTS = [
    "gold",
    "platinum",
    "draconic",
    "freedom"
  ];

  const CHEST_LABELS = {
    gold: "Gold",
    platinum: "Platinum",
    draconic: "Draconic",
    freedom: "Freedom"
  };
  
  const CHEST_DECK_KEYS = {
  gold: "gold_chest",
  platinum: "platinum_chest",
  draconic: "dragfrag_chest_tier3",
  freedom: "freedom_chest"
};

  let state =
    loadPlayerState();

  let cachedPublishedEvent =
    loadCachedPublishedEvent();

  const eventFingerprintCache =
    new WeakMap();

  /* ==========================================================
     GENERAL HELPERS
     ========================================================== */

  function isObject(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function cloneValue(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return value;
    }

    try {
      return JSON.parse(
        JSON.stringify(value)
      );
    } catch (error) {
      return value;
    }
  }

  function firstDefined(
    values,
    fallback = null
  ) {
    for (const value of values) {
      if (
        value !== null &&
        value !== undefined &&
        value !== ""
      ) {
        return value;
      }
    }

    return fallback;
  }

  function toFiniteNumber(
    value,
    fallback = null
  ) {
    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return fallback;
    }

    const number =
      Number(value);

    return Number.isFinite(number)
      ? number
      : fallback;
  }

  function normaliseText(value) {
    return String(
      value ?? ""
    ).trim();
  }

  const REWARD_DISPLAY_NAMES = {
    blackPearl: "Black Pearls",
    bloodstone: "Bloodstone",
    breedingToken: "Breeding Tokens",
    cosmicCharge: "Cosmic Charges",
    electrumBar: "Electrum Bars",
    elementalEmber: "Elemental Embers",
    fireShard: "Fire Shards",
    fullHeal: "Full Heals",
    iceShard: "Ice Shards",
    mysticFragment: "Mystic Fragments",
    urbanflareSigil: "Urbanflare Sigils",
    xpMultiplierSpellConsumable01: "Dragon XP Boosts",
    xpMultiplierSpellConsumable02: "Dragon XP Boosts",
    expediteConsumable1: "15-Minute Speedups",
    expediteConsumable1a: "30-Minute Speedups",
    expediteConsumable2: "1-Hour Speedups",
    expediteConsumable3: "3-Hour Speedups",
    expediteConsumable4: "12-Hour Speedups",
    foodConsumable2: "Food Packs",
    cmCrystaldarkGemstone: "Dark Gemstones",
    cmCrystalearthGemstone: "Earth Gemstones",
    cmCrystalfireGemstone: "Fire Gemstones",
    cmCrystaliceGemstone: "Ice Gemstones",
    cmCrystalwindGemstone: "Wind Gemstones",
    increaseAttack1: "Tower Attack Boosts",
    increaseHP1: "Tower HP Boosts",
    innerFire01: "Inner Fire",
    innerFireConsumable: "Inner Fire",
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

  function humaniseRewardIdentifier(value) {
    const identifier =
      normaliseText(value);

    if (!identifier) {
      return "";
    }

    if (REWARD_DISPLAY_NAMES[identifier]) {
      return REWARD_DISPLAY_NAMES[identifier];
    }

    return identifier
      .replace(/[_-]+/g, " ")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/\bconsumable\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(
        /^./,
        character => character.toUpperCase()
      );
  }

  /* ==========================================================
     PLAYER STATE
     ========================================================== */

   function createDefaultPlayerState() {
  return {
    activeChest: "gold",

    observations: {
      gold: [],
      platinum: [],
      draconic: [],
      freedom: []
    },

    importedGachaIds: [],

    eventFingerprint: null,

    eventStates: {}
  };
}

  function isManualPlayerObservation(
    observation
  ) {
    return !(
      observation?.importedFromHar === true ||
      normaliseText(
        observation?.source
      ).toLowerCase() === "har"
    );
  }

  function cleanSavedObservations(
    observations
  ) {
    const cleaned = {};

    SUPPORTED_CHESTS.forEach(
      chestType => {
        cleaned[chestType] =
          Array.isArray(
            observations?.[chestType]
          )
            ? observations[chestType]
                .filter(
                  isManualPlayerObservation
                )
            : [];
      }
    );

    return cleaned;
  }

  function loadPlayerState() {
    const defaults =
      createDefaultPlayerState();

    try {
      const saved =
        JSON.parse(
          localStorage.getItem(
            PLAYER_STORAGE_KEY
          ) || "{}"
        );

      const activeChest =
        SUPPORTED_CHESTS.includes(
          saved.activeChest
        )
          ? saved.activeChest
          : defaults.activeChest;

      const observations =
        cleanSavedObservations(
          saved.observations
        );

      return {
  activeChest,
  observations,

  importedGachaIds:
    Array.isArray(
      saved.importedGachaIds
    )
      ? saved.importedGachaIds
      : [],

  eventFingerprint:
    typeof saved.eventFingerprint ===
      "string"
      ? saved.eventFingerprint
      : null,

  eventStates:
    isObject(saved.eventStates)
      ? saved.eventStates
      : {}
};
      
    } catch (error) {
      console.warn(
        "[Chest Companion] Could not restore predictor progress.",
        error
      );

      return defaults;
    }
  }

  function savePlayerState() {
    try {
      localStorage.setItem(
        PLAYER_STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch (error) {
      console.warn(
        "[Chest Companion] Could not save predictor progress.",
        error
      );
    }
  }

  /* ==========================================================
     PUBLISHED EVENT CACHE
     ========================================================== */

  function loadCachedPublishedEvent() {
    try {
      const saved =
        JSON.parse(
          localStorage.getItem(
            EVENT_CACHE_KEY
          ) || "null"
        );

      return isObject(saved)
        ? saved
        : null;
    } catch (error) {
      console.warn(
        "[Chest Companion] Could not restore cached event data.",
        error
      );

      return null;
    }
  }

  function saveCachedPublishedEvent(
    eventData,
    sourceFile = null
  ) {
    cachedPublishedEvent = {
      data:
        cloneValue(eventData),

      sourceFile:
        cloneValue(sourceFile),

      cachedAt:
        new Date()
          .toISOString()
    };

    try {
      localStorage.setItem(
        EVENT_CACHE_KEY,
        JSON.stringify(
          cachedPublishedEvent
        )
      );
    } catch (error) {
      console.warn(
        "[Chest Companion] Could not cache the published event.",
        error
      );
    }
  }

  function clearCachedPublishedEvent() {
    cachedPublishedEvent = null;

    try {
      localStorage.removeItem(
        EVENT_CACHE_KEY
      );
    } catch (error) {
      console.warn(
        "[Chest Companion] Could not clear cached event data.",
        error
      );
    }
  }

  /* ==========================================================
     EVENT DATA
     ========================================================== */

  function getEventData() {
    const liveData =
      window.currentEventData;

    if (
      liveData &&
      typeof liveData === "object"
    ) {
      return liveData;
    }

    const publishedData =
      window.ChestCompanionPublishedEvent;

    if (
      publishedData &&
      typeof publishedData === "object"
    ) {
      return (
        publishedData.data ||
        publishedData.eventData ||
        publishedData
      );
    }

    if (
      cachedPublishedEvent?.data &&
      typeof cachedPublishedEvent.data ===
        "object"
    ) {
      return cachedPublishedEvent.data;
    }

    return null;
  }

  function getSourceFile() {
    return (
      window.currentEventSourceFile ||
      window
        .ChestCompanionPublishedEvent
        ?.sourceFile ||
      cachedPublishedEvent
        ?.sourceFile ||
      null
    );
  }

  function isReady() {
    const eventData =
      getEventData();

    return Boolean(
      eventData &&
      typeof eventData === "object" &&
      eventData.chests &&
      typeof eventData.chests ===
        "object"
    );
  }

  function getEventName() {
    const eventData =
      getEventData();

    const possibleName =
      firstDefined([
        eventData?.event?.name,
        eventData?.event?.title,
        eventData?.eventName,
        eventData?.title,
        eventData?.name,
        typeof eventData?.event ===
          "string"
          ? eventData.event
          : null
      ]);

    if (
      typeof possibleName ===
        "string" &&
      possibleName.trim()
    ) {
      return possibleName.trim();
    }

    const sourceFile =
      getSourceFile();

    const sourceName =
      typeof sourceFile === "string"
        ? sourceFile
        : firstDefined([
            sourceFile?.name,
            sourceFile?.fileName
          ]);

    if (
      typeof sourceName ===
        "string" &&
      sourceName.trim()
    ) {
      return sourceName
        .replace(
          /\.(txt|json|csv)$/i,
          ""
        )
        .trim();
    }

    return "Current Event";
  }

  function getImportedAt() {
    const eventData =
      getEventData();

    return firstDefined([
      eventData?.importedAt,
      eventData?.publishedAt,
      getSourceFile()?.importedAt,
      cachedPublishedEvent?.cachedAt
    ]);
  }

  function hashText(value) {
    const text = String(value || "");
    let hash = 2166136261;

    for (
      let index = 0;
      index < text.length;
      index += 1
    ) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return (hash >>> 0).toString(36);
  }

  function getEventFingerprint(
    eventData = getEventData()
  ) {
    if (!eventData || typeof eventData !== "object") {
      return null;
    }

    if (eventFingerprintCache.has(eventData)) {
      return eventFingerprintCache.get(eventData);
    }

    const identity = {
      event:
        eventData.event ||
        eventData.eventName ||
        eventData.name ||
        "Current Event",
      decks:
        eventData.decks || {},
      drops:
        eventData.drops || {}
    };

    const fingerprint = hashText(
      JSON.stringify(identity)
    );

    eventFingerprintCache.set(
      eventData,
      fingerprint
    );

    return fingerprint;
  }

  function syncPlayerEvent(
    eventData = getEventData()
  ) {
    const fingerprint =
      getEventFingerprint(eventData);

    if (!fingerprint) {
      return false;
    }

    if (!isObject(state.eventStates)) {
      state.eventStates = {};
    }

    if (!state.eventFingerprint) {
      const hasLegacyProgress =
        SUPPORTED_CHESTS.some(
          chestType =>
            Array.isArray(
              state.observations?.[chestType]
            ) &&
            state.observations[chestType].length
        );

      /*
       * Progress saved before event fingerprints existed cannot
       * safely be assigned to the newly loaded event. Preserve it
       * as a legacy snapshot, then begin the live event cleanly.
       */
      if (hasLegacyProgress) {
        state.eventStates.legacy = {
          observations:
            cloneValue(state.observations),
          importedGachaIds:
            cloneValue(
              state.importedGachaIds || []
            )
        };

        SUPPORTED_CHESTS.forEach(
          chestType => {
            state.observations[chestType] = [];
          }
        );

        state.importedGachaIds = [];
      }

      state.eventFingerprint = fingerprint;
      savePlayerState();
      return hasLegacyProgress;
    }

    if (
      state.eventFingerprint ===
      fingerprint
    ) {
      return false;
    }

    state.eventStates[state.eventFingerprint] = {
      observations:
        cloneValue(state.observations),
      importedGachaIds:
        cloneValue(
          state.importedGachaIds || []
        )
    };

    const savedEventState =
      state.eventStates[fingerprint];

    SUPPORTED_CHESTS.forEach(
      chestType => {
        state.observations[chestType] =
          Array.isArray(
            savedEventState
              ?.observations
              ?.[chestType]
          )
            ? cloneValue(
                savedEventState.observations[
                  chestType
                ].filter(
                  isManualPlayerObservation
                )
              )
            : [];
      }
    );

    state.importedGachaIds =
      Array.isArray(
        savedEventState?.importedGachaIds
      )
        ? cloneValue(
            savedEventState.importedGachaIds
          )
        : [];
    state.eventFingerprint = fingerprint;
    savePlayerState();

    window.dispatchEvent(
      new CustomEvent(
        "chest-companion-player-event-reset",
        {
          detail: {
            event:
              eventData.event ||
              eventData.eventName ||
              "Current Event",
            fingerprint
          }
        }
      )
    );

    return true;
  }

  /* ==========================================================
     ADMIN-READY EVENT PUBLISHING

     This stores the event locally for now.

     Later, event-import.js can send the same event object to
     Supabase, and each player's app can place the downloaded
     event into window.ChestCompanionPublishedEvent.
     ========================================================== */

  function publishEventData(
    eventData,
    sourceFile = null
  ) {
    if (
      !eventData ||
      typeof eventData !== "object"
    ) {
      throw new TypeError(
        "Published event data must be an object."
      );
    }

    if (
      !eventData.chests ||
      typeof eventData.chests !==
        "object"
    ) {
      throw new Error(
        "Published event data does not contain chest decks."
      );
    }

    const publishedAt =
      new Date().toISOString();

    const publishedData = {
      ...cloneValue(eventData),

      ready: true,

      publishedAt:
        eventData.publishedAt ||
        publishedAt
    };

    window.currentEventData =
      publishedData;

    window.currentEventSourceFile =
      sourceFile;

    window.ChestCompanionPublishedEvent = {
      data:
        publishedData,

      sourceFile:
        cloneValue(sourceFile),

      publishedAt
    };

    saveCachedPublishedEvent(
      publishedData,
      sourceFile
    );

    window.dispatchEvent(
      new CustomEvent(
        "chest-companion:event-published",
        {
          detail: {
            eventData:
              publishedData,

            sourceFile,

            publishedAt
          }
        }
      )
    );

    refresh();

    return publishedData;
  }

  function clearPublishedEventData() {
    window.currentEventData =
      null;

    window.currentEventSourceFile =
      null;

    window.ChestCompanionPublishedEvent =
      null;

    clearCachedPublishedEvent();

    window.dispatchEvent(
      new CustomEvent(
        "chest-companion:event-cleared"
      )
    );

    refresh();

    return true;
  }

  /* ==========================================================
     CHEST HELPERS
     ========================================================== */

  function isSupportedChest(
    chestType
  ) {
    return SUPPORTED_CHESTS.includes(
      normaliseText(
        chestType
      ).toLowerCase()
    );
  }

  function normaliseChestType(
    chestType
  ) {
    const value =
      normaliseText(
        chestType ||
        state.activeChest ||
        "gold"
      ).toLowerCase();

    return isSupportedChest(value)
      ? value
      : "gold";
  }

  function setActiveChest(
    chestType
  ) {
    const normalised =
      normaliseChestType(
        chestType
      );

    state.activeChest =
      normalised;

    savePlayerState();

    window.dispatchEvent(
      new CustomEvent(
        "chest-companion-live-chest-changed",
        {
          detail: {
            chestType:
              normalised
          }
        }
      )
    );

    return normalised;
  }

  function getActiveChest() {
    return state.activeChest;
  }

  function getChestLabel(
    chestType =
      state.activeChest
  ) {
    const normalised =
      normaliseChestType(
        chestType
      );

    return (
      CHEST_LABELS[
        normalised
      ] ||
      normalised
    );
  }

  function getChestData(
    chestType =
      state.activeChest
  ) {
    const eventData =
      getEventData();

    if (
      !eventData?.chests ||
      typeof eventData.chests !==
        "object"
    ) {
      return null;
    }

    const normalised =
      normaliseChestType(
        chestType
      );

    return (
      eventData.chests[
        normalised
      ] ||
      eventData.chests[
        CHEST_LABELS[
          normalised
        ]
      ] ||
      null
    );
  }

  function findDeckArray(
    chestData
  ) {
    if (
      Array.isArray(chestData)
    ) {
      return chestData;
    }

    if (!isObject(chestData)) {
      return [];
    }

    const possibleArrays = [
      chestData.deck,
      chestData.sequence,
      chestData.values,
      chestData.rewards,
      chestData.entries,
      chestData.items,
      chestData.results,
      chestData.data
    ];

    return (
      possibleArrays.find(
        Array.isArray
      ) ||
      []
    );
  }

  function getDeck(
  chestType =
    state.activeChest
) {
  return getRawDeck(
    chestType
  );
}

  function getDeckLength(
    chestType =
      state.activeChest
  ) {
    const chestData =
      getChestData(
        chestType
      );

    const deck =
      getDeck(
        chestType
      );

    if (deck.length) {
      return deck.length;
    }

    return (
      toFiniteNumber(
        firstDefined([
          chestData?.deckLength,
          chestData?.length,
          chestData?.count
        ]),
        0
      ) || 0
    );
  }

  function getFoundIndex(
    chestType =
      state.activeChest
  ) {
    const chestData =
      getChestData(
        chestType
      );

    if (!chestData) {
      return null;
    }

    return toFiniteNumber(
      firstDefined([
        chestData.foundIndex,
        chestData.sourceIndex,
        chestData.index
      ]),
      null
    );
  }

  function hasChestDeck(
    chestType =
      state.activeChest
  ) {
    return (
      getDeckLength(
        chestType
      ) > 0
    );
  }

  /* ==========================================================
     REWARD NORMALISATION
     ========================================================== */

 function getEventDecks() {
  const eventData =
    getEventData();

  return isObject(
    eventData?.decks
  )
    ? eventData.decks
    : {};
}

function getEventDrops() {
  const eventData =
    getEventData();

  return isObject(
    eventData?.drops
  )
    ? eventData.drops
    : {};
}

   function getEventDeckIndices() {
  const eventData =
    getEventData();

  if (
    isObject(
      eventData?.deckIndices
    )
  ) {
    return eventData.deckIndices;
  }

  if (
    isObject(
      eventData?.deck_indices
    )
  ) {
    return eventData.deck_indices;
  }

  return {};
}

function getChestDeckKey(
  chestType =
    state.activeChest
) {
  return CHEST_DECK_KEYS[
    normaliseChestType(
      chestType
    )
  ];
}

function getNamedDeck(
  deckKey
) {
  const deck =
    getEventDecks()?.[
      deckKey
    ];

  return Array.isArray(deck)
    ? deck
    : [];
}

function getNamedDrops(
  deckKey
) {
  const drops =
    getEventDrops()?.[
      deckKey
    ];

  return Array.isArray(drops)
    ? drops
    : [];
}

function getNamedDeckIndex(
  deckKey
) {
  return toFiniteNumber(
    getEventDeckIndices()?.[
      deckKey
    ],
    0
  ) || 0;
}
  
   function getRawDeck(
  chestType =
    state.activeChest
) {
  const deckKey =
    getChestDeckKey(
      chestType
    );

  const publishedDeck =
    getNamedDeck(
      deckKey
    );

  if (publishedDeck.length) {
    return publishedDeck;
  }

  return findDeckArray(
    getChestData(
      chestType
    )
  );
}

    function resolveDropDefinition(
  deckKey,
  deckValue
) {
  const drops =
    getNamedDrops(
      deckKey
    );

  const numericValue =
    Number(deckValue);

  if (
    !Number.isInteger(
      numericValue
    ) ||
    numericValue < 0 ||
    numericValue >=
      drops.length
  ) {
    return null;
  }

  return drops[
    numericValue
  ] ?? null;
}

function createDeckCursors() {
  const cursors = {};

  Object.entries(
    getEventDeckIndices()
  ).forEach(
    ([deckKey, index]) => {
      cursors[deckKey] =
        Math.max(
          0,
          Math.floor(
            toFiniteNumber(
              index,
              0
            ) || 0
          )
        );
    }
  );

  return cursors;
}

function takeDeckValue(
  deckKey,
  cursors
) {
  const deck =
    getNamedDeck(
      deckKey
    );

  if (!deck.length) {
    return null;
  }

  const rawCursor =
    toFiniteNumber(
      cursors[
        deckKey
      ],
      getNamedDeckIndex(
        deckKey
      )
    ) || 0;

  const index =
    (
      rawCursor %
      deck.length +
      deck.length
    ) %
    deck.length;

  const value =
    deck[index];

  cursors[deckKey] =
    (
      index + 1
    ) %
    deck.length;

  return {
    deckKey,
    index,
    value
  };
}

function resolveDeckReward(
  deckKey,
  deckValue,
  cursors,
  depth = 0,
  path = []
) {
  if (depth > 12) {
    return {
      name:
        "Unresolved Reward",

      code: "",

      amount: null,

      rawValue:
        cloneValue(
          deckValue
        ),

      path:
        cloneValue(
          path
        ),

      unresolved: true
    };
  }

  const definition =
    resolveDropDefinition(
      deckKey,
      deckValue
    );

  if (!definition) {
    return {
      name:
        `Reward ${deckValue}`,

      code:
        String(deckValue),

      amount: null,

      rawValue:
        cloneValue(
          deckValue
        ),

      path:
        cloneValue(
          path
        ),

      unresolved: true
    };
  }

  const nextPath = [
    ...path,
    {
      deckKey,
      deckValue:
        cloneValue(
          deckValue
        ),

      definition:
        cloneValue(
          definition
        )
    }
  ];

   const nestedDeckKey =
  normaliseText(
    firstDefined([
      definition.deck,
      definition.deckKey,
      definition.deck_key,
      definition.pool,
      definition.poolKey,
      definition.pool_key,
      definition.drop,
      definition.dropKey,
      definition.drop_key,
      definition.rewardPool,
      definition.reward_pool,
      definition.key,
      definition.id,
      definition.value
    ], "")
  );

  if (
    nestedDeckKey &&
    getNamedDeck(
      nestedDeckKey
    ).length
  ) {
    const nestedEntry =
      takeDeckValue(
        nestedDeckKey,
        cursors
      );

    if (!nestedEntry) {
      return {
        ...cloneValue(
          definition
        ),

        name:
          getRewardName(
            definition
          ),

        code:
          getRewardCode(
            definition
          ),

        amount:
          getRewardAmount(
            definition
          ),

        rawValue:
          cloneValue(
            deckValue
          ),

        path:
          nextPath,

        unresolved: true
      };
    }

    return resolveDeckReward(
      nestedDeckKey,
      nestedEntry.value,
      cursors,
      depth + 1,
      nextPath
    );
  }

  return {
    ...cloneValue(
      definition
    ),

    name:
      getRewardName(
        definition
      ),

    code:
      getRewardCode(
        definition
      ),

    amount:
      getRewardAmount(
        definition
      ),

    rawValue:
      cloneValue(
        deckValue
      ),

    path:
      nextPath,

    unresolved: false
  };
}

  function getDefinitionSources(
    chestType =
      state.activeChest
  ) {
    const normalised =
      normaliseChestType(
        chestType
      );

    const chestData =
      getChestData(
        normalised
      );

    const eventData =
      getEventData();

    const arrays = [
      chestData?.rewardDefinitions,
      chestData?.rewardCatalogue,
      chestData?.rewardCatalog,
      chestData?.catalogue,
      chestData?.catalog,
      chestData?.definitions,
      chestData?.definitionList,
      chestData?.rewardTable,
      chestData?.reward_table,
      chestData?.items,

      eventData?.rewardDefinitions,
      eventData?.rewardCatalogue,
      eventData?.rewardCatalog,
      eventData?.catalogue,
      eventData?.catalog,
      eventData?.definitions,
      eventData?.definitionList,
      eventData?.rewardTable,
      eventData?.reward_table,
      eventData?.items
    ].filter(
      Array.isArray
    );

    const maps = [
      chestData?.rewardMap,
      chestData?.reward_map,
      chestData?.rewardsById,
      chestData?.rewards_by_id,
      chestData?.definitionsById,
      chestData?.definitions_by_id,
      chestData?.itemsById,
      chestData?.items_by_id,

      eventData?.rewardMap,
      eventData?.reward_map,
      eventData?.rewardsById,
      eventData?.rewards_by_id,
      eventData?.definitionsById,
      eventData?.definitions_by_id,
      eventData?.itemsById,
      eventData?.items_by_id
    ].filter(
      isObject
    );

    return {
      arrays,
      maps
    };
  }

  function getRewardIdentifier(
    reward
  ) {
    if (
      reward === null ||
      reward === undefined
    ) {
      return "";
    }

    if (
      typeof reward === "string" ||
      typeof reward === "number" ||
      typeof reward === "boolean"
    ) {
      return String(reward);
    }

    if (!isObject(reward)) {
      return "";
    }

    return normaliseText(
      firstDefined([
        reward.rewardId,
        reward.reward_id,
        reward.itemId,
        reward.item_id,
        reward.typeId,
        reward.type_id,
        reward.resourceId,
        reward.resource_id,
        reward.code,
        reward.key,
        reward.id,
        reward.value
      ], "")
    );
  }

  function findRewardDefinition(
    identifier,
    chestType =
      state.activeChest
  ) {
    if (
      identifier === null ||
      identifier === undefined ||
      identifier === ""
    ) {
      return null;
    }

    const id =
      String(identifier);

    const sources =
      getDefinitionSources(
        chestType
      );

    for (
      const map of
      sources.maps
    ) {
      if (
        Object.prototype
          .hasOwnProperty.call(
            map,
            id
          )
      ) {
        return map[id];
      }

      const numericId =
        Number(id);

      if (
        Number.isFinite(
          numericId
        ) &&
        Object.prototype
          .hasOwnProperty.call(
            map,
            numericId
          )
      ) {
        return map[
          numericId
        ];
      }
    }

    for (
      const list of
      sources.arrays
    ) {
      const directIndex =
        Number(id);

      if (
        Number.isInteger(
          directIndex
        ) &&
        directIndex >= 0 &&
        directIndex <
          list.length
      ) {
        const indexedDefinition =
          list[
            directIndex
          ];

        if (
          indexedDefinition !==
          undefined
        ) {
          return indexedDefinition;
        }
      }

      const match =
        list.find(
          item =>
            getRewardIdentifier(
              item
            ) === id
        );

      if (match) {
        return match;
      }
    }

    return null;
  }

  function extractRewardObject(
    entry
  ) {
    if (!isObject(entry)) {
      return entry;
    }

    return firstDefined([
      entry.reward,
      entry.item,
      entry.prize,
      entry.drop,
      entry.result,
      entry.contents,
      entry.definition,
      entry.rewardData,
      entry.reward_data,
      entry
    ]);
  }

  function mergeRewardDefinition(
    entry,
    chestType =
      state.activeChest
  ) {
    const extracted =
      extractRewardObject(
        entry
      );

    const identifier =
      getRewardIdentifier(
        extracted
      );

    const definition =
      findRewardDefinition(
        identifier,
        chestType
      );

    if (
      isObject(definition)
    ) {
      return {
        ...cloneValue(
          definition
        ),

        ...(isObject(extracted)
          ? cloneValue(
              extracted
            )
          : {})
      };
    }

    if (
      definition !== null &&
      definition !== undefined
    ) {
      return definition;
    }

    return extracted;
  }

  function getRewardName(
    entry,
    index = 0,
    chestType =
      state.activeChest
  ) {
    const reward =
      mergeRewardDefinition(
        entry,
        chestType
      );

    if (
      typeof reward === "string"
    ) {
      return reward;
    }

    if (
      typeof reward === "number" ||
      typeof reward === "boolean"
    ) {
      return `Reward ${reward}`;
    }

    if (!isObject(reward)) {
      return `Reward ${index + 1}`;
    }

    const identifier =
      getRewardIdentifier(
        reward
      );

    // Prefer a verified display name for a known internal reward identifier.
    // Imported HAR metadata may also contain a mechanically humanised `name`
    // (for example "E25 Q1 Festive Sorcerer Dragon Evolution Fragment");
    // that generated label must not override the real in-game shard name.
    if (
      identifier &&
      REWARD_DISPLAY_NAMES[identifier]
    ) {
      return REWARD_DISPLAY_NAMES[
        identifier
      ];
    }

    const name =
      firstDefined([
        reward.name,
        reward.label,
        reward.rewardName,
        reward.reward_name,
        reward.displayName,
        reward.display_name,
        reward.title,
        reward.description,
        reward.resourceName,
        reward.resource_name,
        reward.itemName,
        reward.item_name,
        reward.typeName,
        reward.type_name,
        reward.type,
        reward.code,
        identifier
      ]);

    return humaniseRewardIdentifier(
      name ||
      `Reward ${index + 1}`
    );
  }

  function getRewardCode(
    entry,
    chestType =
      state.activeChest
  ) {
    const reward =
      mergeRewardDefinition(
        entry,
        chestType
      );

    if (
      typeof reward === "string"
    ) {
      return reward;
    }

    if (
      typeof reward === "number" ||
      typeof reward === "boolean"
    ) {
      return String(
        reward
      );
    }

    if (!isObject(reward)) {
      return "";
    }

    return normaliseText(
      firstDefined([
        reward.code,
        reward.rewardCode,
        reward.reward_code,
        reward.key,
        reward.rewardId,
        reward.reward_id,
        reward.itemId,
        reward.item_id,
        reward.typeId,
        reward.type_id,
        reward.id
      ], "")
    );
  }

  function getRewardAmount(
  entry,
  chestType =
    state.activeChest
) {
  const reward =
    mergeRewardDefinition(
      entry,
      chestType
    );

  const amount =
    firstDefined([
      isObject(entry)
        ? entry.amount
        : null,

      isObject(entry)
        ? entry.quantity
        : null,

      isObject(entry)
        ? entry.qty
        : null,

      isObject(entry)
        ? entry.count
        : null,

      isObject(entry)
        ? entry.mu
        : null,

      isObject(entry)
        ? entry.valueAmount
        : null,

      isObject(entry)
        ? entry.value_amount
        : null,

      isObject(reward)
        ? reward.amount
        : null,

      isObject(reward)
        ? reward.quantity
        : null,

      isObject(reward)
        ? reward.qty
        : null,

      isObject(reward)
        ? reward.count
        : null,

      isObject(reward)
        ? reward.mu
        : null,

      isObject(reward)
        ? reward.rewardAmount
        : null,

      isObject(reward)
        ? reward.reward_amount
        : null
    ]);

  return toFiniteNumber(
    amount,
    null
  );
}

  function getMatchValue(entry) {
    if (isObject(entry)) {
      const explicitValue =
        firstDefined([
          entry.matchValue,
          entry.match_value,
          entry.deckValue,
          entry.deck_value,
          entry.rawValue,
          entry.raw_value,
          entry.sequenceValue,
          entry.sequence_value,
          entry.value,
          entry.id
        ]);

      if (
        explicitValue !== null &&
        explicitValue !== undefined
      ) {
        return cloneValue(
          explicitValue
        );
      }
    }

    return cloneValue(
      entry
    );
  }

  function normaliseDeckEntry(
    entry,
    index = 0,
    chestType =
      state.activeChest
  ) {
    const normalisedChest =
      normaliseChestType(
        chestType
      );

    const resolvedReward =
      mergeRewardDefinition(
        entry,
        normalisedChest
      );

    const name =
      getRewardName(
        entry,
        index,
        normalisedChest
      );

    const code =
      getRewardCode(
        entry,
        normalisedChest
      );

    const amount =
      getRewardAmount(
        entry,
        normalisedChest
      );

    const matchValue =
      getMatchValue(
        entry
      );

    const identifier =
      getRewardIdentifier(
        resolvedReward
      ) ||
      getRewardIdentifier(
        entry
      );

    return {
      key: [
        identifier,
        code,
        name,
        amount ?? "",
        serialiseValue(
          matchValue
        )
      ].join("::"),

      id:
        identifier ||
        code ||
        String(index),

      index,

      position:
        index + 1,

      name,

      label:
        name,

      code,

      amount,

      value:
        cloneValue(
          matchValue
        ),

      matchValue:
        cloneValue(
          matchValue
        ),

      definition:
        cloneValue(
          resolvedReward
        ),

      raw:
        cloneValue(
          entry
        )
    };
  }

  function getNormalisedDeck(
  chestType =
    state.activeChest
) {
  const normalisedChest =
    normaliseChestType(
      chestType
    );

  const mainDeckKey =
    getChestDeckKey(
      normalisedChest
    );

  const rawDeck =
    getNamedDeck(
      mainDeckKey
    );

  if (!rawDeck.length) {
    return getRawDeck(
      normalisedChest
    ).map(
      (entry, index) =>
        normaliseDeckEntry(
          entry,
          index,
          normalisedChest
        )
    );
  }

  const cursors =
    createDeckCursors();

  const mainStartIndex =
    getNamedDeckIndex(
      mainDeckKey
    );

  const resolvedDeck = [];

  for (
    let offset = 0;
    offset < rawDeck.length;
    offset += 1
  ) {
    const mainIndex =
      (
        mainStartIndex +
        offset
      ) %
      rawDeck.length;

    const rawValue =
      rawDeck[
        mainIndex
      ];

    const resolved =
      resolveDeckReward(
        mainDeckKey,
        rawValue,
        cursors
      );

    const reward =
      normaliseDeckEntry(
        {
          ...resolved,

          matchValue: {
            name:
              resolved.name,

            code:
              resolved.code,

            amount:
              resolved.amount
          },

          deckValue:
            rawValue,

          mainDeckKey,

          mainDeckIndex:
            mainIndex,

          resolutionPath:
            resolved.path
        },
        offset,
        normalisedChest
      );

    reward.index =
      mainIndex;

    reward.position =
      mainIndex + 1;

    reward.rawDeckValue =
      cloneValue(
        rawValue
      );

    reward.resolutionPath =
      cloneValue(
        resolved.path
      );

    resolvedDeck.push(
      reward
    );
  }

  return resolvedDeck;
}

  function getRewards(
    chestType =
      state.activeChest
  ) {
    const normalised =
      normaliseChestType(
        chestType
      );

    const deck =
      getNormalisedDeck(
        normalised
      );

    const rewards =
      new Map();

    deck.forEach(entry => {
      const catalogueKey = [
        entry.id,
        entry.code,
        entry.name,
        entry.amount ?? "",
        serialiseValue(
          entry.matchValue
        )
      ].join("::");

      if (
        !rewards.has(
          catalogueKey
        )
      ) {
        rewards.set(
          catalogueKey,
          {
            key:
              catalogueKey,

            id:
              entry.id,

            name:
              entry.name,

            label:
              entry.name,

            code:
              entry.code,

            amount:
              entry.amount,

            value:
              cloneValue(
                entry.matchValue
              ),

            matchValue:
              cloneValue(
                entry.matchValue
              ),

            definition:
              cloneValue(
                entry.definition
              ),

            raw:
              cloneValue(
                entry.raw
              )
          }
        );
      }
    });

    return Array.from(
      rewards.values()
    ).sort(
      (first, second) =>
        first.name.localeCompare(
          second.name,
          undefined,
          {
            numeric: true,
            sensitivity: "base"
          }
        )
    );
  }
  /* ==========================================================
     VALUE COMPARISON
     ========================================================== */

  function serialiseValue(value) {
    if (value === undefined) {
      return "__undefined__";
    }

    if (value === null) {
      return "null";
    }

    if (typeof value === "string") {
      return `string:${value}`;
    }

    if (typeof value === "number") {
      return `number:${value}`;
    }

    if (typeof value === "boolean") {
      return `boolean:${value}`;
    }

    try {
      return (
        "json:" +
        JSON.stringify(value)
      );
    } catch (error) {
      return `text:${String(value)}`;
    }
  }

  function createRewardMatchKey(
  value
) {
  const resolved =
    getMatchValue(
      value
    );

  if (!isObject(resolved)) {
    return serialiseValue(
      resolved
    );
  }

  const code =
    normaliseText(
      firstDefined([
        resolved.code,
        resolved.rewardCode,
        resolved.reward_code,
        resolved.id,
        resolved.rewardId,
        resolved.reward_id,
        resolved.itemId,
        resolved.item_id
      ], "")
    ).toLowerCase();

  const name =
    normaliseText(
      firstDefined([
        resolved.name,
        resolved.label,
        resolved.displayName,
        resolved.display_name,
        resolved.rewardName,
        resolved.reward_name
      ], "")
    ).toLowerCase();

  const amount =
    toFiniteNumber(
      firstDefined([
        resolved.amount,
        resolved.quantity,
        resolved.qty,
        resolved.count,
        resolved.mu
      ]),
      null
    );

  if (code) {
    return [
      "code",
      code,
      amount ?? ""
    ].join("::");
  }

  if (name) {
    return [
      "name",
      name,
      amount ?? ""
    ].join("::");
  }

  if (
    Array.isArray(
      resolved.bundle
    )
  ) {
    return (
      "bundle::" +
      JSON.stringify(
        resolved.bundle
      )
    );
  }

  return serialiseValue(
    resolved
  );
}

function valuesMatch(
  first,
  second
) {
  return (
    createRewardMatchKey(
      first
    ) ===
    createRewardMatchKey(
      second
    )
  );
}

  function formatDeckValue(value) {
    if (value === undefined) {
      return "undefined";
    }

    if (value === null) {
      return "null";
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    ) {
      return String(value);
    }

    const name =
      getRewardName(
        value
      );

    const amount =
      getRewardAmount(
        value
      );

    if (
      name &&
      !name.startsWith(
        "Reward "
      )
    ) {
      return amount === null
        ? name
        : `${name} — ${amount}`;
    }

    try {
      return JSON.stringify(value);
    } catch (error) {
      return String(value);
    }
  }

  function getUniqueDeckValues(
    chestType =
      state.activeChest
  ) {
    return getRewards(
      chestType
    );
  }

  /* ==========================================================
     OBSERVATIONS
     ========================================================== */

  function getObservations(
    chestType =
      state.activeChest
  ) {
    const normalised =
      normaliseChestType(
        chestType
      );

    return cloneValue(
      state.observations[
        normalised
      ] || []
    );
  }

  function createObservation(
    reward,
    chestType,
    quantity = 1
  ) {
    const normalisedChest =
      normaliseChestType(
        chestType
      );

    const normalisedReward =
  normaliseDeckEntry(
    reward,
    0,
    normalisedChest
  );

    return {
      number:
        (
          state.observations[
            normalisedChest
          ]?.length || 0
        ) + 1,

      chestType:
        normalisedChest,

      name:
        normalisedReward.name,

      label:
        normalisedReward.name,

      code:
        normalisedReward.code,

      amount:
        normalisedReward.amount,

      quantity,

      chestCount:
        quantity,

      chestsOpened:
        quantity,

      value:
        cloneValue(
          normalisedReward.matchValue
        ),

      matchValue:
        cloneValue(
          normalisedReward.matchValue
        ),

      reward:
        cloneValue(
          normalisedReward.raw
        ),

      raw:
        cloneValue(
          normalisedReward.raw
        ),

      displayValue:
  normalisedReward.amount === null
    ? normalisedReward.name
    : (
        `${normalisedReward.name} — ` +
        `${normalisedReward.amount}`
      ),

      recordedAt:
        new Date()
          .toISOString()
    };
  }

  function recordReward(
    chestType,
    payload
  ) {
    let resolvedChestType =
      chestType;

    let resolvedPayload =
      payload;

    if (
      isObject(chestType) &&
      payload === undefined
    ) {
      resolvedPayload =
        chestType;

      resolvedChestType =
        chestType.chestType ||
        state.activeChest;
    }

    const normalisedChest =
      normaliseChestType(
        resolvedChestType
      );

    if (!resolvedPayload) {
      throw new Error(
        "No reward was supplied."
      );
    }

    const reward =
      resolvedPayload.reward ??
      resolvedPayload.raw ??
      resolvedPayload.value ??
      resolvedPayload;

    const quantity =
      Math.max(
        1,
        Math.floor(
          toFiniteNumber(
            resolvedPayload.quantity ??
            resolvedPayload.chestCount ??
            resolvedPayload.chestsOpened,
            1
          )
        )
      );

    const added = [];

    for (
      let index = 0;
      index < quantity;
      index += 1
    ) {
      const observation =
        createObservation(
          reward,
          normalisedChest,
          1
        );

      state.observations[
        normalisedChest
      ].push(
        observation
      );

      added.push(
        cloneValue(
          observation
        )
      );
    }

    savePlayerState();
    refresh();

    return quantity === 1
      ? added[0]
      : added;
  }

  function recordObservation(
    value,
    chestType =
      state.activeChest
  ) {
    if (
      isSupportedChest(value) &&
      chestType &&
      typeof chestType === "object"
    ) {
      return recordReward(
        value,
        chestType
      );
    }

    if (
      isObject(value) &&
      (
        value.chestType ||
        value.quantity ||
        value.reward ||
        value.chestCount
      )
    ) {
      return recordReward(
        value.chestType ||
        chestType,
        value
      );
    }

    return recordReward(
      chestType,
      {
        reward:
          value,

        quantity: 1
      }
    );
  }

  function undoObservation(
    chestType =
      state.activeChest
  ) {
    const normalised =
      normaliseChestType(
        chestType
      );

    const removed =
      state.observations[
        normalised
      ].pop() || null;

    savePlayerState();
    refresh();

    return cloneValue(
      removed
    );
  }

  function removeObservation(
    index,
    chestType =
      state.activeChest
  ) {
    const normalised =
      normaliseChestType(
        chestType
      );

    const observations =
      state.observations[
        normalised
      ];

    const numericIndex =
      Number(index);

    if (
      !Number.isInteger(
        numericIndex
      ) ||
      numericIndex < 0 ||
      numericIndex >=
        observations.length
    ) {
      return null;
    }

    const removed =
      observations.splice(
        numericIndex,
        1
      )[0];

    observations.forEach(
      (
        observation,
        position
      ) => {
        observation.number =
          position + 1;
      }
    );

    savePlayerState();
    refresh();

    return cloneValue(
      removed
    );
  }

    function resetObservations(
  chestType =
    state.activeChest
) {
  const normalised =
    normaliseChestType(
      chestType
    );

  const removedImportIds =
    new Set(
      (
        state.observations[
          normalised
        ] || []
      )
        .map(
          observation =>
            observation
              ?.gachaImportId
        )
        .filter(Boolean)
    );

  state.observations[
    normalised
  ] = [];

  if (
    Array.isArray(
      state.importedGachaIds
    ) &&
    removedImportIds.size
  ) {
    state.importedGachaIds =
      state.importedGachaIds
        .filter(
          importId =>
            !removedImportIds.has(
              importId
            )
        );
  }

  savePlayerState();
  refresh();

  return true;
}

  /* Compatibility aliases */

  function undoLastReward(
    chestType
  ) {
    return undoObservation(
      chestType
    );
  }

  function resetHistory(
    chestType
  ) {
    return resetObservations(
      chestType
    );
  }

  function clearHistory(
    chestType
  ) {
    return resetObservations(
      chestType
    );
  }

  /* ==========================================================
     POSITION SOLVER
     ========================================================== */

  function findCandidateStarts(
    chestType =
      state.activeChest
  ) {
    const deck =
      getNormalisedDeck(
        chestType
      );

    const observations =
      getObservations(
        chestType
      );

    if (
      !deck.length ||
      !observations.length
    ) {
      return [];
    }

    const candidates = [];

    for (
      let start = 0;
      start < deck.length;
      start += 1
    ) {
      let matched = true;

      for (
        let offset = 0;
        offset <
          observations.length;
        offset += 1
      ) {
        const deckIndex =
          (
            start +
            offset
          ) %
          deck.length;

        if (
          !valuesMatch(
            deck[
              deckIndex
            ].matchValue,

            observations[
              offset
            ].matchValue ??
            observations[
              offset
            ].value
          )
        ) {
          matched = false;
          break;
        }
      }

      if (matched) {
        candidates.push(start);
      }
    }

    return candidates;
  }

  function calculateConfidence(
    candidateCount,
    deckLength,
    observationCount
  ) {
    if (
      !candidateCount ||
      !deckLength ||
      !observationCount
    ) {
      return 0;
    }

    if (candidateCount === 1) {
      return 100;
    }

    const uniqueness =
      1 -
      (
        candidateCount /
        deckLength
      );

    const evidence =
      Math.min(
        observationCount / 6,
        1
      );

    return Math.max(
      1,
      Math.min(
        99,
        Math.round(
          uniqueness *
          evidence *
          100
        )
      )
    );
  }

  function solvePosition(
    chestType =
      state.activeChest
  ) {
    const normalised =
      normaliseChestType(
        chestType
      );

    const deck =
      getNormalisedDeck(
        normalised
      );

    const observations =
      getObservations(
        normalised
      );

    if (!deck.length) {
      return {
        available: false,
        matched: false,
        solved: false,

        chestType:
          normalised,

        message:
          "The selected live deck is unavailable.",

        candidates: [],
        currentPositions: [],

        candidateCount: null,
        currentIndex: null,
        currentPosition: null,
        nextIndex: null,
        confidence: 0
      };
    }

    if (!observations.length) {
      return {
        available: true,
        matched: false,
        solved: false,

        chestType:
          normalised,

        message:
          "Record the first chest reward to begin.",

        candidates: [],
        currentPositions: [],

        candidateCount: null,
        currentIndex: null,
        currentPosition: null,
        nextIndex: null,
        confidence: 0
      };
    }

    const candidateStarts =
      findCandidateStarts(
        normalised
      );

    if (!candidateStarts.length) {
      return {
        available: true,
        matched: false,
        solved: false,

        chestType:
          normalised,

        message:
          "The recorded rewards do not match this live deck.",

        candidates: [],
        currentPositions: [],

        candidateCount: 0,
        currentIndex: null,
        currentPosition: null,
        nextIndex: null,
        confidence: 0
      };
    }

    const currentPositions =
      candidateStarts.map(
        start =>
          (
            start +
            observations.length -
            1
          ) %
          deck.length
      );

    const solved =
      candidateStarts.length === 1;

    const currentIndex =
      solved
        ? currentPositions[0]
        : null;

    return {
      available: true,
      matched: true,
      solved,

      chestType:
        normalised,

      observationCount:
        observations.length,

      candidateCount:
        candidateStarts.length,

      candidates:
        candidateStarts,

      currentPositions,

      currentIndex,

      currentPosition:
        currentIndex === null
          ? null
          : currentIndex + 1,

      nextIndex:
        currentIndex === null
          ? null
          : (
              currentIndex + 1
            ) %
            deck.length,

      confidence:
        calculateConfidence(
          candidateStarts.length,
          deck.length,
          observations.length
        ),

      message:
        solved
          ? (
              `Sequence located at position ` +
              `${currentIndex + 1}.`
            )
          : (
              `${candidateStarts.length} possible ` +
              `positions remain.`
            )
    };
  }

  /* ==========================================================
     PREDICTIONS
     ========================================================== */

  function predictUpcoming(
    count = 20,
    chestType =
      state.activeChest
  ) {
    const normalised =
      normaliseChestType(
        chestType
      );

    const deck =
      getNormalisedDeck(
        normalised
      );

    const solution =
      solvePosition(
        normalised
      );

    if (
      !solution.solved ||
      solution.currentIndex === null ||
      !deck.length
    ) {
      return [];
    }

    const safeCount =
      Math.max(
        1,
        Math.min(
          Number(count) || 100,
          100
        )
      );

    const upcoming = [];

    const bonusEvery = {
      gold: 30,
      platinum: 30,
      draconic: 30,
      freedom: 15
    }[normalised] || null;

    let regularSinceBonus = bonusEvery
      ? getObservations(normalised)
          .filter(
            observation =>
              !observation?.isBonus &&
              !observation?.bonus
          )
          .reduce(
            (total, observation) =>
              total + Math.max(
                1,
                toFiniteNumber(
                  observation?.chestCount ??
                  observation?.chestsOpened,
                  1
                ) || 1
              ),
            0
          ) % bonusEvery
      : 0;

    for (
      let offset = 1;
      offset <= safeCount;
      offset += 1
    ) {
      const index =
        (
          solution.currentIndex +
          offset
        ) %
        deck.length;

      const reward =
        deck[index];

      upcoming.push({
        number:
          offset,

        index,

        position:
          index + 1,

        name:
          reward.name,

        label:
          reward.name,

        code:
          reward.code,

        amount:
          reward.amount,

        value:
          cloneValue(
            reward.matchValue
          ),

        matchValue:
          cloneValue(
            reward.matchValue
          ),

        reward:
          cloneValue(
            reward.raw
          ),

        raw:
          cloneValue(
            reward.raw
          ),

        displayValue:
          reward.amount === null
            ? reward.name
            : (
                `${reward.name} — ` +
                `${reward.amount}`
              )
      });

      if (bonusEvery) {
        regularSinceBonus += 1;

        if (regularSinceBonus === bonusEvery) {
          const chestLabel =
            getChestLabel(normalised);

          upcoming.push({
            number: upcoming.length + 1,
            index: null,
            position: null,
            name: `${chestLabel} Bonus Chest`,
            label: `${chestLabel} Bonus Chest`,
            code: `${normalised}_bonus`,
            amount: null,
            isBonus: true,
            bonusEvery,
            bonusAfterRegularChest: offset,
            displayValue: `${chestLabel} Bonus Chest`
          });

          regularSinceBonus = 0;
        }
      }
    }

    return upcoming;
  }

  /* ==========================================================
     STATUS
     ========================================================== */

  function getChestStatus(
    chestType
  ) {
    const normalised =
      normaliseChestType(
        chestType
      );

    const solution =
      solvePosition(
        normalised
      );

    const observations =
      getObservations(
        normalised
      );

    const predictions =
      predictUpcoming(
        100,
        normalised
      );

    const rewards =
      getRewards(
        normalised
      );

    const deck =
      getDeck(
        normalised
      );

    return {
      chestType:
        normalised,

      label:
        getChestLabel(
          normalised
        ),

      loaded:
        hasChestDeck(
          normalised
        ),

      length:
        getDeckLength(
          normalised
        ),

      foundIndex:
        getFoundIndex(
          normalised
        ),

      deck,

      rewards,

      entries:
        rewards,

      observations,

      recordedRewards:
        observations,

      history:
        observations,

      observationCount:
        observations.length,

      solved:
        Boolean(
          solution.solved
        ),

      playerPosition:
        solution.currentPosition,

      solvedPosition:
        solution.currentPosition,

      currentPosition:
        solution.currentPosition,

      candidateCount:
        solution.candidateCount,

      matchCount:
        solution.candidateCount,

      matchingPositions:
        solution.candidateCount,

      matches:
        solution.candidates,

      confidence:
        solution.confidence,

      solverConfidence:
        solution.confidence,

      predictions,

      upcomingRewards:
        predictions,

      nextRewards:
        predictions,

      solverMessage:
        solution.message
    };
  }

  function getStatus() {
    const eventData =
      getEventData();

    syncPlayerEvent(eventData);

    const chests =
      SUPPORTED_CHESTS.map(
        getChestStatus
      );

    return {
      ready:
        isReady(),

      event:
        getEventName(),

      importedAt:
        getImportedAt(),

      sourceFile:
        getSourceFile(),

      activeChest:
        getActiveChest(),

      activeChestLabel:
        getChestLabel(),

      readyChestCount:
        eventData?.readyChestCount ??
        chests.filter(
          chest =>
            chest.loaded
        ).length,

      chests
    };
  }

  function refresh() {
    const status =
      getStatus();

    window.dispatchEvent(
      new CustomEvent(
        "chest-companion-live-predictor-updated",
        {
          detail: status
        }
      )
    );

    return status;
  }

/* ==========================================================
   HAR GACHA HISTORY
   ========================================================== */

function getGachaOpenings(
  gachaData
) {
  if (!gachaData) {
    return [];
  }

  const possibleArrays = [
    gachaData.openings,
    gachaData.history,
    gachaData.rewardHistory,
    gachaData.entries,
    gachaData.results,
    gachaData.requests
  ];

  return (
    possibleArrays.find(
      Array.isArray
    ) || []
  );
}

function isBonusGachaOpening(
  opening
) {
  const claimType =
    normaliseText(
      opening?.claimType ||
      opening?.claim_type ||
      opening?.claimOptionsType ||
      opening?.claim_options_type
    ).toLowerCase();

  const chestName =
    normaliseText(
      opening?.chest ||
      opening?.chestKey ||
      opening?.chestType
    ).toLowerCase();

  return Boolean(
    opening?.isBonus ||
    opening?.bonus ||
    opening?.bonusClaim ||
    claimType.includes(
      "bonus"
    ) ||
    chestName.includes(
      "bonus"
    )
  );
}

function normaliseGachaChestType(
  opening
) {
  const possibleValue =
    normaliseText(
      opening?.parentChestKey ||
      opening?.chestKey ||
      opening?.chestType ||
      opening?.chest
    ).toLowerCase();

  if (
    possibleValue.includes(
      "platinum"
    )
  ) {
    return "platinum";
  }

  if (
    possibleValue.includes(
      "draconic"
    ) ||
    possibleValue.includes(
      "dragfrag"
    )
  ) {
    return "draconic";
  }

  if (
    possibleValue.includes(
      "freedom"
    )
  ) {
    return "freedom";
  }

  if (
    possibleValue.includes(
      "gold"
    )
  ) {
    return "gold";
  }

  return null;
}

function getGachaOpeningTime(
  opening
) {
  const value =
    firstDefined([
      opening?.time,
      opening?.timestamp,
      opening?.startedDateTime,
      opening?.recordedAt,
      opening?.date
    ]);

  const milliseconds =
    Date.parse(
      value || ""
    );

  return Number.isFinite(
    milliseconds
  )
    ? milliseconds
    : 0;
}

function createGachaImportId(
  opening,
  index,
  sourceFile = null
) {
  const rewards =
    Array.isArray(
      opening?.rewards
    )
      ? opening.rewards
      : [];

  const rewardText =
    rewards.map(
      reward => [
        reward?.category || "",
        reward?.id || "",
        reward?.name || "",
        reward?.quantity ?? ""
      ].join(":")
    ).join("|");

  return [
    typeof sourceFile === "string"
  ? sourceFile
  : sourceFile?.name || "",
    opening?.entry ?? "",
    opening?.time ||
      opening?.timestamp ||
      opening?.startedDateTime ||
      "",
    opening?.eventId ||
      opening?.event_id ||
      "",
    opening?.spinType ||
      opening?.spin_type ||
      "",
    opening?.claimType ||
      opening?.claim_type ||
      "",
    opening?.chestKey ||
      opening?.chest ||
      "",
    opening?.count ?? "",
    rewardText,
    index
  ].join("::");
}

function createGachaRewardValue(
  opening
) {
  const rewards =
    Array.isArray(
      opening?.rewards
    )
      ? opening.rewards
      : [];

  if (!rewards.length) {
    return null;
  }

  if (rewards.length === 1) {
    const reward =
      rewards[0];

    const code =
      normaliseText(
        reward?.id ||
        reward?.code ||
        reward?.name
      );

    const name =
      normaliseText(
        reward?.name ||
        reward?.label ||
        reward?.id ||
        "Unknown Reward"
      );

    const amount =
      toFiniteNumber(
        reward?.quantity ??
        reward?.amount ??
        reward?.count,
        null
      );

    return {
      id:
        code,

      code,

      name,

      label:
        name,

      amount,

      quantity:
        amount,

      category:
        reward?.category ||
        "",

      matchValue: {
        name,
        code,
        amount
      },

      harRewards:
        cloneValue(
          rewards
        )
    };
  }

  /*
   * Some chest results contain multiple reward components.
   * Keep those together as one observed chest rather than
   * incorrectly recording each component as a separate chest.
   */
  const components =
    rewards.map(
      reward => ({
        code:
          normaliseText(
            reward?.id ||
            reward?.code ||
            reward?.name
          ),

        name:
          normaliseText(
            reward?.name ||
            reward?.label ||
            reward?.id ||
            "Unknown Reward"
          ),

        amount:
          toFiniteNumber(
            reward?.quantity ??
            reward?.amount ??
            reward?.count,
            null
          ),

        category:
          reward?.category ||
          ""
      })
    );

  components.sort(
    (first, second) =>
      first.code.localeCompare(
        second.code
      )
  );

  const code =
    components.map(
      component =>
        component.code
    ).join("|");

  const name =
    components.map(
      component => {
        return component.amount === null
          ? component.name
          : (
              `${component.name} × ` +
              `${component.amount}`
            );
      }
    ).join(" + ");

  return {
    id:
      code,

    code,

    name,

    label:
      name,

    amount:
      null,

    components,

    matchValue: {
      bundle:
        components.map(
          component => ({
            code:
              component.code,

            amount:
              component.amount
          })
        )
    },

    harRewards:
      cloneValue(
        rewards
      )
  };
}

function importGachaHistory(
  gachaData,
  sourceFile = null
) {
  const openings =
    getGachaOpenings(
      gachaData
    );

  if (!openings.length) {
    return {
      detected: 0,
      imported: 0,
      duplicates: 0,
      bonuses: 0,
      unsupported: 0,
      unreadable: 0
    };
  }

  if (
    !Array.isArray(
      state.importedGachaIds
    )
  ) {
    state.importedGachaIds = [];
  }

  const importedIds =
    new Set(
      state.importedGachaIds
    );

  const orderedOpenings =
    openings
      .map(
        (opening, index) => ({
          opening,
          index,
          time:
            getGachaOpeningTime(
              opening
            )
        })
      )
      .sort(
        (first, second) => {
          if (
            first.time !==
            second.time
          ) {
            return (
              first.time -
              second.time
            );
          }

          return (
            first.index -
            second.index
          );
        }
      );

  const summary = {
    detected:
      openings.length,

    imported: 0,
    duplicates: 0,
    bonuses: 0,
    unsupported: 0,
    unreadable: 0
  };

  orderedOpenings.forEach(
    ({
      opening,
      index
    }) => {
      const importId =
        createGachaImportId(
          opening,
          index,
          sourceFile
        );

      if (
        importedIds.has(
          importId
        )
      ) {
        summary.duplicates += 1;
        return;
      }

      if (
        isBonusGachaOpening(
          opening
        )
      ) {
        /*
         * Bonus rewards are real history, but they are
         * not positions in the regular chest sequence.
         */
        importedIds.add(
          importId
        );

        summary.bonuses += 1;
        return;
      }

      const chestType =
        normaliseGachaChestType(
          opening
        );

      if (
        !chestType ||
        !isSupportedChest(
          chestType
        )
      ) {
        importedIds.add(
          importId
        );

        summary.unsupported += 1;
        return;
      }

      const reward =
        createGachaRewardValue(
          opening
        );

      if (!reward) {
        importedIds.add(
          importId
        );

        summary.unreadable += 1;
        return;
      }

      const chestCount =
        Math.max(
          1,
          Math.floor(
            toFiniteNumber(
              opening?.count,
              1
            ) || 1
          )
        );

      /*
       * A batched opening may return aggregated rewards,
       * meaning its exact per-chest order cannot safely be
       * reconstructed. Import single openings into the
       * sequence solver and retain batches as diagnostics.
       */
      if (chestCount !== 1) {
        importedIds.add(
          importId
        );

        summary.unreadable += 1;

        console.warn(
          "[Chest Companion] A batched HAR opening was not added to the sequence because its individual chest order is unavailable.",
          opening
        );

        return;
      }

      const normalisedReward =
        normaliseDeckEntry(
          reward,
          0,
          chestType
        );

      const observation = {
        number:
          (
            state.observations[
              chestType
            ]?.length || 0
          ) + 1,

        chestType,

        name:
          normalisedReward.name,

        label:
          normalisedReward.name,

        code:
          normalisedReward.code,

        amount:
          normalisedReward.amount,

        quantity: 1,
        chestCount: 1,
        chestsOpened: 1,

        value:
          cloneValue(
            reward.matchValue
          ),

        matchValue:
          cloneValue(
            reward.matchValue
          ),

        reward:
          cloneValue(
            reward
          ),

        raw:
          cloneValue(
            reward
          ),

        source:
          "har",

        importedFromHar:
          true,

        gachaImportId:
          importId,

        gachaEntry:
          opening?.entry ??
          null,

        spinType:
          opening?.spinType ??
          opening?.spin_type ??
          null,

        claimType:
          opening?.claimType ??
          opening?.claim_type ??
          null,

        eventId:
          opening?.eventId ??
          opening?.event_id ??
          null,

        displayValue:
          normalisedReward.amount ===
            null
            ? normalisedReward.name
            : (
                `${normalisedReward.name} — ` +
                `${normalisedReward.amount}`
              ),

        recordedAt:
          firstDefined([
            opening?.time,
            opening?.timestamp,
            opening?.startedDateTime,
            new Date()
              .toISOString()
          ])
      };

      state.observations[
        chestType
      ].push(
        observation
      );

      importedIds.add(
        importId
      );

      summary.imported += 1;
    }
  );

  state.importedGachaIds =
    Array.from(
      importedIds
    );

  savePlayerState();

  console.info(
    "[Chest Companion] HAR history import complete.",
    summary
  );

  return summary;
}

/*
 * HAR opening requests belong to the administrator who captured
 * the event. They are useful import diagnostics, but must never be
 * copied into another player's manually recorded solver history.
 */
function inspectGachaHistory(
  gachaData
) {
  const openings =
    getGachaOpenings(gachaData);

  return {
    detected: openings.length,
    imported: 0,
    duplicates: 0,
    bonuses:
      openings.filter(
        isBonusGachaOpening
      ).length,
    unsupported:
      openings.filter(
        opening =>
          !normaliseGachaChestType(opening)
      ).length,
    unreadable: 0,
    ignoredForPlayerHistory:
      openings.length
  };
}

  /* ==========================================================
     EVENT LISTENERS
     ========================================================== */

  window.addEventListener(
  "noir:event-imported",
  event => {
    const eventData =
      event?.detail?.eventData ||
      window.currentEventData;

    const gachaData =
      event?.detail?.gachaData ||
      window.currentGachaData ||
      null;

    const sourceFile =
      event?.detail?.sourceFile ||
      window.currentEventSourceFile ||
      null;

    if (
      eventData &&
      typeof eventData === "object"
    ) {
      syncPlayerEvent(eventData);

      saveCachedPublishedEvent(
        eventData,
        sourceFile
      );
    }

    const gachaSummary =
      inspectGachaHistory(
        gachaData
      );

    window.dispatchEvent(
      new CustomEvent(
        "chest-companion:gacha-history-imported",
        {
          detail: {
            ...gachaSummary,
            sourceFile
          }
        }
      )
    );

    refresh();
  }
);

  window.addEventListener(
    "chest-companion:event-published",
    refresh
  );
   
  window.addEventListener(
  "noir:gacha-imported",
  event => {
    const gachaData =
      event?.detail?.gachaData ||
      window.currentGachaData ||
      null;

    const sourceFile =
      event?.detail?.sourceFile ||
      window.currentEventSourceFile ||
      null;

    const gachaSummary =
      inspectGachaHistory(
        gachaData
      );

    window.dispatchEvent(
      new CustomEvent(
        "chest-companion:gacha-history-imported",
        {
          detail: {
            ...gachaSummary,
            sourceFile
          }
        }
      )
    );

    refresh();
  }
);
  /* ==========================================================
     PUBLIC API
     ========================================================== */

  window.LivePredictorEngine =
    Object.freeze({
      supportedChests:
        Object.freeze([
          ...SUPPORTED_CHESTS
        ]),

      isReady,
      refresh,

      getStatus,
      getEventData,
      getEventName,
      getImportedAt,
      getSourceFile,
      getEventFingerprint,
      syncPlayerEvent,

      publishEventData,
      clearPublishedEventData,

      isSupportedChest,
      normaliseChestType,
      setActiveChest,
      getActiveChest,
      getChestLabel,

      getChestData,
      getDeck,
      getNormalisedDeck,
      getRewards,
      getDeckLength,
      getFoundIndex,
      getChestStatus,
      hasChestDeck,

      serialiseValue,
      createRewardMatchKey,
      valuesMatch,
      formatDeckValue,
      getUniqueDeckValues,

      getObservations,

      getGachaOpenings,
      importGachaHistory,
      inspectGachaHistory,

      recordReward,
      recordObservation,

      undoObservation,
      undoLastReward,

      removeObservation,

      resetObservations,
      resetHistory,
      clearHistory,

      findCandidateStarts,
      solvePosition,
      predictUpcoming
    });

  console.info(
    "[Chest Companion] Live Predictor Engine ready.",
    getStatus()
  );
})(window);
