"use strict";

/**
 * Noir Chest Companion
 * War Dragons live-event deck parser
 *
 * Reads an about_v2 response and extracts:
 * - Event information
 * - Gold chest deck
 * - Platinum chest deck
 * - Draconic chest deck
 * - Freedom chest deck
 * - Freedom reward pools
 * - Freedom bonus-drop information
 */

class EventParser {
  constructor(rawData) {
    this.rawData = rawData;
    this.data = this.normaliseData(rawData);
  }

  /**
   * Accepts either:
   * - A JavaScript object
   * - Raw JSON text
   */
  normaliseData(rawData) {
    if (!rawData) {
      throw new Error("No event data was provided.");
    }

    if (typeof rawData === "string") {
      try {
        return JSON.parse(rawData);
      } catch (error) {
        throw new Error(
          "The imported event data is not valid JSON."
        );
      }
    }

    if (typeof rawData === "object") {
      return rawData;
    }

    throw new Error("Unsupported event data format.");
  }

  /**
   * Finds the gacha object even when the response
   * contains extra wrapper objects.
   */
  findGachaObject(
    value = this.data,
    visited = new WeakSet()
  ) {
    if (!value || typeof value !== "object") {
      return null;
    }

    if (visited.has(value)) {
      return null;
    }

    visited.add(value);

    if (
      value.gacha &&
      typeof value.gacha === "object"
    ) {
      return value.gacha;
    }

    if (
      value.params &&
      value.params.deck_indices &&
      value.params.decks
    ) {
      return value;
    }

    for (const childValue of Object.values(value)) {
      const result = this.findGachaObject(
        childValue,
        visited
      );

      if (result) {
        return result;
      }
    }

    return null;
  }

  getGachaParams() {
    const gacha = this.findGachaObject();

    if (!gacha) {
      throw new Error(
        "No gacha data was found in this about_v2 response."
      );
    }

    const params = gacha.params || gacha;

    if (
      !params.deck_indices ||
      typeof params.deck_indices !== "object"
    ) {
      throw new Error(
        "The event response does not contain deck_indices."
      );
    }

    if (
      !params.decks ||
      typeof params.decks !== "object"
    ) {
      throw new Error(
        "The event response does not contain decks."
      );
    }

    return params;
  }

  /**
   * Searches common locations for the event name.
   */
  getEventName() {
    const possibleNames = [
      this.data?.event?.name,
      this.data?.event_name,
      this.data?.name,
      this.data?.params?.name,
      this.data?.event?.display_name,
      this.data?.display_name
    ];

    const eventName = possibleNames.find(
      value =>
        typeof value === "string" &&
        value.trim()
    );

    return eventName?.trim() || "Unknown Event";
  }

  /**
   * Returns a named deck as a safe copied array.
   */
  getDeck(deckKey) {
    const params = this.getGachaParams();
    const deck = params.decks?.[deckKey];

    return Array.isArray(deck)
      ? [...deck]
      : [];
  }

  /**
   * Returns standard chest sequence information.
   */
  getChest(chestKey, label) {
    const params = this.getGachaParams();
    const deckIndices = params.deck_indices;
    const decks = params.decks;

    const rawIndex = deckIndices[chestKey];
    const rawDeck = decks[chestKey];

    const indexFound =
      rawIndex !== undefined &&
      rawIndex !== null &&
      rawIndex !== "";

    const deckFound = Array.isArray(rawDeck);
    const parsedIndex = Number(rawIndex);

    const indexIsValid =
      indexFound &&
      Number.isInteger(parsedIndex) &&
      parsedIndex >= 0;

    const warnings = [];

    if (!indexFound) {
      warnings.push(
        `No deck index found for ${label}.`
      );
    } else if (!indexIsValid) {
      warnings.push(
        `The ${label} deck index is invalid.`
      );
    }

    if (!deckFound) {
      warnings.push(
        `No deck found for ${label}.`
      );
    }

    if (
      deckFound &&
      indexIsValid &&
      rawDeck.length > 0 &&
      parsedIndex >= rawDeck.length
    ) {
      warnings.push(
        `${label} index ${parsedIndex} is outside the deck length of ${rawDeck.length}.`
      );
    }

    return {
      key: chestKey,
      label,
      found: deckFound && indexIsValid,
      index: indexIsValid
        ? parsedIndex
        : null,
      deck: deckFound
        ? [...rawDeck]
        : [],
      deckLength: deckFound
        ? rawDeck.length
        : 0,
      currentValue:
        deckFound &&
        indexIsValid &&
        parsedIndex < rawDeck.length
          ? rawDeck[parsedIndex]
          : null,
      warnings
    };
  }

  /**
   * Returns all available spin types.
   */
  getSpinTypes() {
    const params = this.getGachaParams();

    return Array.isArray(params.spin_types)
      ? [...params.spin_types]
      : [];
  }

  /**
   * Searches spin types using their title,
   * description, key or drop information.
   */
  findSpinType(searchTerms) {
    const terms = Array.isArray(searchTerms)
      ? searchTerms
      : [searchTerms];

    const normalisedTerms = terms
      .map(term =>
        String(term || "")
          .trim()
          .toLowerCase()
      )
      .filter(Boolean);

    if (!normalisedTerms.length) {
      return null;
    }

    return (
      this.getSpinTypes().find(spinType => {
        let searchableText = "";

        try {
          searchableText =
            JSON.stringify(spinType)
              .toLowerCase();
        } catch (error) {
          searchableText =
            String(spinType || "")
              .toLowerCase();
        }

        return normalisedTerms.every(term =>
          searchableText.includes(term)
        );
      }) || null
    );
  }

  /**
   * Attempts to read the bonus frequency from
   * the Freedom chest description.
   */
  getFreedomBonusFrequency(
    regularSpin,
    bonusSpin
  ) {
    const text = [
      regularSpin?.title,
      regularSpin?.desc,
      regularSpin?.description,
      bonusSpin?.title,
      bonusSpin?.desc,
      bonusSpin?.description
    ]
      .filter(Boolean)
      .join(" ");

    const match = text.match(
      /(?:open|every)\s+(\d+)|(\d+)\s+(?:chests?|opens?)/i
    );

    const detectedNumber = Number(
      match?.[1] || match?.[2]
    );

    if (
      Number.isInteger(detectedNumber) &&
      detectedNumber > 0
    ) {
      return detectedNumber;
    }

    return 15;
  }

  /**
   * Extracts the Freedom sequence, reward pools
   * and bonus-drop configuration.
   *
   * The deck index is not automatically treated as
   * the player's bonus-progress counter because those
   * values may represent different game systems.
   */
  getFreedomData() {
    const freedomChest = this.getChest(
      "freedom_chest",
      "Freedom"
    );

    const regularSpin =
      this.findSpinType([
        "freedom",
        "open"
      ]) ||
      this.findSpinType("freedom");

    const bonusSpin =
      this.findSpinType([
        "freedom",
        "bonus"
      ]);

    const bonusEvery =
      this.getFreedomBonusFrequency(
        regularSpin,
        bonusSpin
      );

    const rewardPools = {
      epic: this.getDeck(
        "epic_freedom_items"
      ),

      legendary: this.getDeck(
        "legendary_freedom_items"
      ),

      mythic: this.getDeck(
        "mythic_freedom_items"
      )
    };

    const availableRewardPoolCount =
      Object.values(rewardPools)
        .filter(pool => pool.length > 0)
        .length;

    return {
      ...freedomChest,

      bonusEvery,

      bonusDescription:
        regularSpin?.desc ||
        regularSpin?.description ||
        `Open ${bonusEvery} for a bonus drop.`,

      regularSpinType:
        regularSpin,

      bonusSpinType:
        bonusSpin,

      rewardPools,

      availableRewardPoolCount,

      hasRewardPools:
        availableRewardPoolCount > 0,

      /*
       * These will be populated by the Freedom
       * tracking system when the user's personal
       * Freedom chest count is known.
       */
      openedSinceBonus: null,
      chestsUntilBonus: null,
      nextChestIsBonus: false
    };
  }

  parse() {
    const params = this.getGachaParams();

    const drops =
  params.drops &&
  typeof params.drops === "object"
    ? structuredClone(params.drops)
    : {};

const deckIndices =
  params.deck_indices &&
  typeof params.deck_indices === "object"
    ? { ...params.deck_indices }
    : {};
    
    const result = {
      event: this.getEventName(),

      importedAt:
        new Date().toISOString(),

      chests: {
        gold: this.getChest(
          "gold_chest",
          "Gold"
        ),

        platinum: this.getChest(
          "platinum_chest",
          "Platinum"
        ),

        draconic: this.getChest(
          "dragfrag_chest_tier3",
          "Draconic"
        ),

        freedom: this.getFreedomData()
      },

      decks:
  structuredClone(
    params.decks
  ),

      drops,

      deckIndices,

    spinTypes:
      this.getSpinTypes(),

    availableDeckKeys:
      Object.keys(
        params.decks
     ),

     availableDropKeys:
       Object.keys(
         drops
      ),

     availableIndexKeys:
       Object.keys(
         deckIndices
      ),

      availableSpinTypeCount:
        this.getSpinTypes().length
    };

    result.readyChestCount =
      Object.values(result.chests)
        .filter(chest => chest.found)
        .length;

    result.ready =
      result.readyChestCount > 0;

    return result;
  }

  /**
   * Quick helper for testing in the browser console.
   */
  static parse(rawData) {
    return new EventParser(rawData).parse();
  }
}

/**
 * Developer helper.
 * Tests an about_v2 response and prints the results.
 */
window.testEventParser = function testEventParser(
  rawData
) {
  try {
    const result =
      EventParser.parse(rawData);

    console.group(
      "🐉 Noir Event Parser"
    );

    console.log(
      "Event:",
      result.event
    );

    console.log(
      "Ready:",
      result.ready
    );

    Object.values(
      result.chests
    ).forEach(chest => {
      console.group(
        chest.label
      );

      console.log(
        "Found:",
        chest.found
      );

      console.log(
        "Index:",
        chest.index
      );

      console.log(
        "Deck Length:",
        chest.deckLength
      );

      console.log(
        "Current Value:",
        chest.currentValue
      );

      if (
        chest.label === "Freedom"
      ) {
        console.log(
          "Bonus every:",
          chest.bonusEvery
        );

        console.log(
          "Reward pools:",
          chest.rewardPools
        );
      }

      if (
        chest.warnings.length
      ) {
        console.warn(
          chest.warnings
        );
      }

      console.groupEnd();
    });

    console.groupEnd();

    return result;
  } catch (error) {
    console.error(error);

    return null;
  }
};

window.EventParser = EventParser;