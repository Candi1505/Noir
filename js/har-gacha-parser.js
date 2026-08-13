/* ============================================================
   CHEST COMPANION BETA — HAR GACHA PARSER

   Purpose:
   - Reads WD use_gacha requests from a HAR file.
   - Extracts chest-opening history.
   - Identifies Gold, Platinum, Draconic, Freedom and Arcane chests.
   - Detects bonus claims.
   - Extracts rewards and chest costs.
   - Keeps sensitive HAR information out of the returned results.

   This file does not upload or permanently store the HAR.
   ============================================================ */

(function installHarGachaParser(window) {
  "use strict";

  const USE_GACHA_PATTERN =
    /\/ext\/dragonsong\/event\/use_gacha(?:\?|$)/i;

  /*
   * Spin-type mappings confirmed from the captured
   * WD event traffic.
   */
  const CHEST_TYPES = {
    "7": {
      key: "super_sigil",
      label: "Super Sigil Chest"
    },

    "2": {
      key: "gold",
      label: "Gold Chest"
    },

    "11": {
      key: "platinum",
      label: "Platinum Chest"
    },

    "27": {
      key: "draconic",
      label: "Draconic Chest"
    },

    "33": {
      key: "freedom",
      label: "Freedom Chest"
    },

    "37": {
      key: "arcane",
      label: "Arcane Chest"
    }
  };

  const BONUS_TYPES = {
    "2": {
      key: "gold_bonus",
      parentKey: "gold",
      label: "Gold Bonus Chest"
    },

    "11": {
      key: "platinum_bonus",
      parentKey: "platinum",
      label: "Platinum Bonus Chest"
    },

    "27": {
      key: "draconic_bonus",
      parentKey: "draconic",
      label: "Draconic Bonus Chest"
    },

    "33": {
      key: "freedom_bonus",
      parentKey: "freedom",
      label: "Freedom Bonus Chest"
    },

    "37": {
      key: "arcane_bonus",
      parentKey: "arcane",
      label: "Arcane Bonus Chest"
    },

    /*
     * Arcane regular openings use spin 37, while the separate
     * credit-spin claim created after 15 openings uses spin 38.
     */
    "38": {
      key: "arcane_bonus",
      parentKey: "arcane",
      label: "Arcane Bonus Chest"
    }
  };

  /*
   * Friendly names for commonly encountered rewards.
   * Unknown reward IDs are safely converted into readable text.
   */
  const DISPLAY_NAMES = {
    chest0: "Bronze Chests",
    chest1: "Silver Chests",
    chest2: "Gold Chests",
    chest6: "Special Event Chests",
    chest8: "Super Sigil Bonus Chests",
    chest11: "Platinum Chests",
    chest27: "Draconic Chests",
    chest33: "Freedom Chests",
    chest4: "Gold Bonus Chest",
    chest12: "Platinum Bonus Chest",
    chest34: "Freedom Bonus Chest",
    chest37: "Arcane Chests",

    rubies: "Rubies",
    sigil: "Sigils",
    eggToken: "Egg Tokens",
    breedingToken: "Egg Tokens",

    expediteConsumable1: "15 Min Speedup",
    expediteConsumable1a: "30 Min Speedup",
    expediteConsumable2: "1 Hr Speedup",
    expediteConsumable3: "3 Hr Speedup",
    expediteConsumable4: "12 Hr Speedup",

    repairConsumable: "Defense Hammer",
    energyPack: "Energy Packs",
    foodPack_1400000: "1.4M Food Pack",
    foodConsumable2: "Food Packs",
    lumberConsumable2: "Lumber Packs",
    lumberPack_1400000: "1.4M Lumber Packs",
    elementalEmber: "Elemental Embers",
    blackPearl: "Black Pearls",
    mysticFragment: "Mystic Fragments",
    electrumBar: "Electrum Bars",
    cosmicCharge: "Cosmic Charge",
    urbanflareSigil: "Urbanflare Sigil",
    innerFire01: "Inner Fire",
    innerFireConsumable: "Inner Fire",
    cmCrystaldarkGemstone: "Dark Crafting Gemstones",
    cmCrystalearthGemstone: "Earth Crafting Gemstones",
    cmCrystalfireGemstone: "Fire Crafting Gemstones",
    cmCrystaliceGemstone: "Ice Crafting Gemstones",
    cmCrystalwindGemstone: "Wind Crafting Gemstones",
    E26Q2FestiveHunterDragonEvolutionFragment: "Festive Hunter Dragon Shards",

    increaseAttack1: "Dragon Attack Boost",
    increaseHP1: "Dragon HP Boost",
    increaseBuildingAttack1: "Tower Attack Boost",
    increaseBuildingHP1: "Tower HP Boost",
    fullHeal: "Healing Potions",
    xpMultiplierSpellConsumable01: "Dragon XP Boost",
    xpMultiplierSpellConsumable02: "Dragon XP Boost"
  };

  function isObject(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function isHarObject(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      value.log &&
      Array.isArray(value.log.entries)
    );
  }

  function decodeUtf8Base64(value) {
    const cleanValue =
      String(value || "").replace(/\s/g, "");

    const binary = window.atob(cleanValue);

    const bytes = Uint8Array.from(
      binary,
      character => character.charCodeAt(0)
    );

    return new TextDecoder("utf-8").decode(bytes);
  }

  function getResponseText(entry) {
    const content = entry?.response?.content;
    const text = content?.text;

    if (
      typeof text !== "string" ||
      !text.trim()
    ) {
      return "";
    }

    if (
      String(content.encoding || "")
        .toLowerCase() === "base64"
    ) {
      return decodeUtf8Base64(text);
    }

    return text;
  }

  function parseJsonText(text, label) {
    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error(
        `${label} contained invalid JSON: ${error.message}`
      );
    }
  }

  function parseRequestParameters(entry) {
    const postData = entry?.request?.postData;
    const output = {};

    /*
     * HAR exports sometimes provide parsed form parameters.
     */
    if (Array.isArray(postData?.params)) {
      postData.params.forEach(parameter => {
        if (!parameter?.name) {
          return;
        }

        output[parameter.name] =
          parameter.value ?? "";
      });
    }

    const rawText =
      typeof postData?.text === "string"
        ? postData.text.trim()
        : "";

    if (!rawText) {
      return output;
    }

    /*
     * Most WD use_gacha requests use
     * application/x-www-form-urlencoded data.
     */
    try {
      const formParameters =
        new URLSearchParams(rawText);

      formParameters.forEach((value, key) => {
        output[key] = value;
      });
    } catch (error) {
      console.warn(
        "[Chest Companion] Could not parse request form parameters.",
        error
      );
    }

    /*
     * Also support JSON request bodies if the game changes
     * the request format in a future version.
     */
    if (
      rawText.startsWith("{") ||
      rawText.startsWith("[")
    ) {
      try {
        const jsonParameters =
          JSON.parse(rawText);

        if (isObject(jsonParameters)) {
          Object.assign(
            output,
            jsonParameters
          );
        }
      } catch (error) {
        // It was not JSON, which is fine.
      }
    }

    return output;
  }

  function humanise(value) {
    return String(value || "")
      .replace(/_/g, " ")
      .replace(
        /([a-z0-9])([A-Z])/g,
        "$1 $2"
      )
      .replace(
        /\b\w/g,
        character =>
          character.toUpperCase()
      )
      .trim();
  }

  function getDisplayName(rewardId) {
    return (
      DISPLAY_NAMES[rewardId] ||
      humanise(rewardId) ||
      "Unknown Reward"
    );
  }

  function convertQuantity(value) {
    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : value;
  }

  function flattenInventorySection(section) {
    const results = [];

    if (!isObject(section)) {
      return results;
    }

    Object.entries(section).forEach(
      ([category, categoryValues]) => {
        if (!isObject(categoryValues)) {
          return;
        }

        Object.entries(categoryValues).forEach(
          ([rewardId, quantity]) => {
            results.push({
              category,
              id: rewardId,
              name:
                getDisplayName(rewardId),
              quantity:
                convertQuantity(quantity),
              knownName:
                Boolean(
                  DISPLAY_NAMES[rewardId]
                )
            });
          }
        );
      }
    );

    return results;
  }

  function detectChest(parameters) {
    const spinType =
      String(
        parameters?.spin_type ?? ""
      );

    const claimType =
      String(
        parameters?.claim_options_type ??
        ""
      );

    const isBonus =
      claimType.toLowerCase() ===
        "claim_bonus" ||
      claimType
        .toLowerCase()
        .includes("bonus");

    const definition = isBonus
      ? BONUS_TYPES[spinType]
      : CHEST_TYPES[spinType];

    if (definition) {
      return {
        ...definition,
        spinType,
        isBonus,
        known: true
      };
    }

    return {
      key: isBonus
        ? `unknown_bonus_${spinType || "none"}`
        : `unknown_${spinType || "none"}`,

      parentKey: null,

      label: isBonus
        ? `Unknown Bonus Chest${
            spinType
              ? ` — Spin ${spinType}`
              : ""
          }`
        : `Unknown Chest${
            spinType
              ? ` — Spin ${spinType}`
              : ""
          }`,

      spinType:
        spinType || null,

      isBonus,

      known: false
    };
  }

  function getChestCount(parameters, chest) {
    /*
     * A bonus claim is a separate reward claim and
     * should not increase the regular chest-open count.
     */
    if (chest.isBonus) {
      return 0;
    }

    const count = Number(
      parameters?.n ??
      parameters?.count ??
      parameters?.amount ??
      1
    );

    if (
      Number.isInteger(count) &&
      count >= 0
    ) {
      return count;
    }

    return 1;
  }

  function parseUseGachaEntry(
    entry,
    sourceEntryIndex
  ) {
    const parameters =
      parseRequestParameters(entry);

    const responseText =
      getResponseText(entry);

    if (!responseText) {
      throw new Error(
        "The use_gacha response body was empty."
      );
    }

    const response =
      parseJsonText(
        responseText,
        "The use_gacha response"
      );

    const updates =
      response?.smr_updates || {};

    const rewardSources =
      Array.from(
        new Set(
          (
            Array.isArray(response?.drops)
              ? response.drops
              : []
          )
            .map(drop =>
              String(drop?.src || "").trim()
            )
            .filter(Boolean)
        )
      );

    const chest =
      detectChest(parameters);

    const rewards =
      flattenInventorySection(
        updates.added
      );

    const costs =
      flattenInventorySection(
        updates.charged
      );

    const count =
      getChestCount(
        parameters,
        chest
      );

    return {
      sourceEntryIndex,

      timestamp:
        entry?.startedDateTime ||
        null,

      eventId:
        parameters.event_id ||
        parameters.eventId ||
        null,

      spinType:
        chest.spinType,

      chestKey:
        chest.key,

      parentChestKey:
        chest.parentKey ||
        chest.key,

      chestLabel:
        chest.label,

      knownChest:
        chest.known,

      isBonus:
        chest.isBonus,

      claimType:
        parameters.claim_options_type ||
        null,

      method:
        parameters.how ||
        null,

      count,

      rewards,

      costs,

      /*
       * Pool identifiers are event configuration, not player
       * progress. They let the importer verify which shared
       * bonus pool produced a captured claim without publishing
       * the administrator's personal reward history.
       */
      rewardSources,

      rewardCount:
        rewards.length,

      responseSuccess:
        response?.success !== false
    };
  }

  function aggregateRewards(openings) {
    const rewardMap = new Map();

    openings.forEach(opening => {
      opening.rewards.forEach(reward => {
        const key = [
          opening.chestKey,
          reward.category,
          reward.id
        ].join("|");

        const current =
          rewardMap.get(key) || {
            chestKey:
              opening.chestKey,

            chestLabel:
              opening.chestLabel,

            isBonus:
              opening.isBonus,

            category:
              reward.category,

            id:
              reward.id,

            name:
              reward.name,

            quantity: 0,

            occurrences: 0
          };

        const quantity =
          Number(reward.quantity);

        if (Number.isFinite(quantity)) {
          current.quantity += quantity;
        }

        current.occurrences += 1;

        rewardMap.set(
          key,
          current
        );
      });
    });

    return Array.from(
      rewardMap.values()
    ).sort((left, right) => {
      const chestComparison =
        left.chestLabel.localeCompare(
          right.chestLabel
        );

      if (chestComparison !== 0) {
        return chestComparison;
      }

      return left.name.localeCompare(
        right.name
      );
    });
  }

  function buildChestSummary(openings) {
    const summary = {};

    openings.forEach(opening => {
      const summaryKey =
        opening.parentChestKey ||
        opening.chestKey;

      if (!summary[summaryKey]) {
        summary[summaryKey] = {
          key:
            summaryKey,

          label:
            humanise(summaryKey),

          requests: 0,

          regularRequests: 0,

          bonusRequests: 0,

          chestsOpened: 0,

          rewardEntries: 0
        };
      }

      const item =
        summary[summaryKey];

      item.requests += 1;
      item.rewardEntries +=
        opening.rewards.length;

      if (opening.isBonus) {
        item.bonusRequests += 1;
      } else {
        item.regularRequests += 1;
        item.chestsOpened +=
          opening.count;
      }
    });

    return summary;
  }

  function calculateBonusProgress(
    openings,
    chestKey,
    bonusEvery = 15
  ) {
    let openedSinceBonus = 0;
    let regularChestsOpened = 0;
    let bonusClaims = 0;

    openings.forEach(opening => {
      const isTargetChest =
        opening.parentChestKey ===
          chestKey ||
        opening.chestKey ===
          chestKey;

      if (!isTargetChest) {
        return;
      }

      if (opening.isBonus) {
        bonusClaims += 1;
        openedSinceBonus = 0;
        return;
      }

      regularChestsOpened +=
        opening.count;

      openedSinceBonus =
        (
          openedSinceBonus +
          opening.count
        ) % bonusEvery;
    });

    const chestsUntilBonus =
      openedSinceBonus === 0
        ? bonusEvery
        : bonusEvery -
          openedSinceBonus;

    return {
      bonusEvery,

      regularChestsOpened,

      bonusClaims,

      openedSinceBonus,

      chestsUntilBonus,

      nextChestNumber:
        regularChestsOpened + 1,

      nextChestIsBonus:
        openedSinceBonus ===
          bonusEvery - 1,

      progressKnown:
        openings.some(opening => {
          return (
            opening.parentChestKey ===
              chestKey ||
            opening.chestKey ===
              chestKey
          );
        })
    };
  }

  function parseHar(har) {
    if (!isHarObject(har)) {
      throw new Error(
        "This file does not appear to be a valid HAR export."
      );
    }

    const openings = [];
    const errors = [];

    har.log.entries.forEach(
      (entry, entryIndex) => {
        const url =
          String(
            entry?.request?.url || ""
          );

        if (
          !USE_GACHA_PATTERN.test(url)
        ) {
          return;
        }

        try {
          openings.push(
            parseUseGachaEntry(
              entry,
              entryIndex
            )
          );
        } catch (error) {
          errors.push({
            sourceEntryIndex:
              entryIndex,

            timestamp:
              entry?.startedDateTime ||
              null,

            message:
              error.message
          });
        }
      }
    );

    openings.sort((left, right) => {
      const leftTime =
        Date.parse(left.timestamp || "") ||
        left.sourceEntryIndex;

      const rightTime =
        Date.parse(right.timestamp || "") ||
        right.sourceEntryIndex;

      return leftTime - rightTime;
    });

    const totalRegularChestsOpened =
      openings.reduce(
        (total, opening) => {
          return (
            total +
            (
              opening.isBonus
                ? 0
                : opening.count
            )
          );
        },
        0
      );

    const bonusClaimCount =
      openings.filter(
        opening =>
          opening.isBonus
      ).length;

    const eventIds =
      Array.from(
        new Set(
          openings
            .map(
              opening =>
                opening.eventId
            )
            .filter(Boolean)
        )
      );

    const unknownSpinTypes =
      Array.from(
        new Set(
          openings
            .filter(
              opening =>
                !opening.knownChest
            )
            .map(
              opening =>
                opening.spinType
            )
            .filter(Boolean)
        )
      );

    return {
      schemaVersion: 1,

      generatedAt:
        new Date().toISOString(),

      eventIds,

      requestCount:
        openings.length,

      totalRegularChestsOpened,

      bonusClaimCount,

      openings,

      aggregatedRewards:
        aggregateRewards(openings),

      chestSummary:
        buildChestSummary(openings),

      freedom:
        calculateBonusProgress(
          openings,
          "freedom",
          15
        ),

      arcane:
        calculateBonusProgress(
          openings,
          "arcane",
          15
        ),

      unknownSpinTypes,

      errors,

      ready:
        openings.length > 0
    };
  }

  function parse(rawData) {
    let parsedData = rawData;

    if (
      typeof rawData === "string"
    ) {
      const text =
        rawData.trim();

      if (!text) {
        throw new Error(
          "The selected HAR file is empty."
        );
      }

      parsedData =
        parseJsonText(
          text,
          "The selected HAR file"
        );
    }

    return parseHar(parsedData);
  }

  class HarGachaParser {
    constructor(rawData) {
      this.rawData = rawData;
    }

    parse() {
      return parse(
        this.rawData
      );
    }

    static parse(rawData) {
      return parse(rawData);
    }

    static isHar(value) {
      return isHarObject(value);
    }
  }

  /*
   * Browser-console testing helper.
   */
  window.testHarGachaParser =
    function testHarGachaParser(rawData) {
      try {
        const result =
          HarGachaParser.parse(rawData);

        console.group(
          "🐉 Chest Companion HAR Gacha Parser"
        );

        console.log(
          "Ready:",
          result.ready
        );

        console.log(
          "Gacha Requests:",
          result.requestCount
        );

        console.log(
          "Regular Chests Opened:",
          result.totalRegularChestsOpened
        );

        console.log(
          "Bonus Claims:",
          result.bonusClaimCount
        );

        console.log(
          "Freedom Progress:",
          result.freedom
        );

        console.log(
          "Chest Summary:",
          result.chestSummary
        );

        console.log(
          "Openings:",
          result.openings
        );

        console.log(
          "Aggregated Rewards:",
          result.aggregatedRewards
        );

        if (
          result.unknownSpinTypes.length
        ) {
          console.warn(
            "Unknown Spin Types:",
            result.unknownSpinTypes
          );
        }

        if (result.errors.length) {
          console.warn(
            "Entries that could not be parsed:",
            result.errors
          );
        }

        console.groupEnd();

        return result;
      } catch (error) {
        console.error(
          "[Chest Companion]",
          error
        );

        return null;
      }
    };

  window.HarGachaParser =
    HarGachaParser;

  console.info(
    "[Chest Companion] HAR gacha parser ready."
  );
})(window);
