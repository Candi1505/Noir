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

  let state =
    loadPlayerState();

  let cachedPublishedEvent =
    loadCachedPublishedEvent();

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
      }
    };
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

      const observations = {};

      SUPPORTED_CHESTS.forEach(
        chestType => {
          observations[chestType] =
            Array.isArray(
              saved.observations?.[
                chestType
              ]
            )
              ? saved.observations[
                  chestType
                ]
              : [];
        }
      );

      return {
        activeChest,
        observations
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

  function getRawDeck(
    chestType =
      state.activeChest
  ) {
    return findDeckArray(
      getChestData(
        chestType
      )
    );
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

    return normaliseText(
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
    const normalised =
      normaliseChestType(
        chestType
      );

    return getRawDeck(
      normalised
    ).map(
      (entry, index) =>
        normaliseDeckEntry(
          entry,
          index,
          normalised
        )
    );
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

  function valuesMatch(
    first,
    second
  ) {
    return (
      serialiseValue(
        getMatchValue(first)
      ) ===
      serialiseValue(
        getMatchValue(second)
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
        0
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
        formatDeckValue(
          reward
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

    state.observations[
      normalised
    ] = [];

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
          Number(count) || 20,
          25
        )
      );

    const upcoming = [];

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
        20,
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
     EVENT LISTENERS
     ========================================================== */

  window.addEventListener(
    "noir:event-imported",
    event => {
      const eventData =
        event?.detail?.eventData ||
        window.currentEventData;

      const sourceFile =
        event?.detail?.sourceFile ||
        window.currentEventSourceFile ||
        null;

      if (
        eventData &&
        typeof eventData === "object"
      ) {
        saveCachedPublishedEvent(
          eventData,
          sourceFile
        );
      }

      refresh();
    }
  );

  window.addEventListener(
    "chest-companion:event-published",
    refresh
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
      valuesMatch,
      formatDeckValue,
      getUniqueDeckValues,

      getObservations,

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