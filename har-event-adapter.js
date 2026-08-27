/* ============================================================
   CHEST COMPANION BETA — SAFE HAR EVENT ADAPTER

   Purpose:
   - Lets the existing event importer accept WD .har files.
   - Extracts the event/about_v2 response locally in the browser.
   - Decodes HAR response bodies marked as base64.
   - Passes only the extracted event JSON to the existing EventParser.
   - Never uploads or stores the full HAR file.

   Load after event-parser.js.
   ============================================================ */

(function installChestCompanionHarAdapter(window) {
  "use strict";

  const ABOUT_V2_PATTERN =
    /\/ext\/dragonsong\/event\/about_v2(?:\?|$)/i;

  const EVENT_DATA_PATTERN =
    /\/ext\/dragonsong\/events\/get_params_and_data(?:\/season)?(?:\?|$)/i;

  const CURRENT_EVENT_PAGE_PATTERN =
    /\/dragons\/event\/current(?:\?|$)/i;

  const USE_GACHA_PATTERN =
    /\/ext\/dragonsong\/event\/use_gacha(?:\?|$)/i;

  const EMBEDDED_EVENT_DATA_MARKER =
    "window.params_and_data";

  const REWARD_POOL_KEYS = [
    "epic_items",
    "legendary_items",
    "epic_plat_items",
    "legendary_plat_items",
    "mythic_plat_items",
    "Epic_DragFrag_Tier3_Resources",
    "Legendary_DragFrag_Tier3_Resources",
    "Mythic_DragFrag_Tier3_Resources",
    "epic_freedom_items",
    "legendary_freedom_items",
    "mythic_freedom_items",
    "epic_arcane_items",
    "legendary_arcane_items",
    "mythic_arcane_items"
  ];

  function decodeUtf8Base64(value) {
    const binary = window.atob(value);

    const bytes = Uint8Array.from(
      binary,
      character => character.charCodeAt(0)
    );

    return new TextDecoder("utf-8").decode(bytes);
  }

  function getResponseText(entry) {
    const content = entry?.response?.content;
    const text = content?.text;

    if (typeof text !== "string" || !text.trim()) {
      return "";
    }

    if (
      String(content.encoding || "").toLowerCase() === "base64"
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

  /*
   * Newer event pages embed the same data that older clients
   * returned from get_params_and_data. Parse the assigned JSON
   * object without evaluating any of the surrounding page.
   */
  function extractAssignedJsonObject(
    text,
    marker = EMBEDDED_EVENT_DATA_MARKER
  ) {
    const markerIndex = text.indexOf(marker);

    if (markerIndex < 0) {
      return null;
    }

    const objectStart = text.indexOf(
      "{",
      markerIndex + marker.length
    );

    if (objectStart < 0) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (
      let index = objectStart;
      index < text.length;
      index += 1
    ) {
      const character = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === "\"") {
          inString = false;
        }

        continue;
      }

      if (character === "\"") {
        inString = true;
      } else if (character === "{") {
        depth += 1;
      } else if (character === "}") {
        depth -= 1;

        if (depth === 0) {
          return JSON.parse(
            text.slice(objectStart, index + 1)
          );
        }
      }
    }

    throw new Error(
      "The embedded live-event data was incomplete."
    );
  }

  function extractEventDataPayload(entry) {
    const url = String(entry?.request?.url || "");

    if (
      !EVENT_DATA_PATTERN.test(url) &&
      !CURRENT_EVENT_PAGE_PATTERN.test(url)
    ) {
      return null;
    }

    const responseText = getResponseText(entry);

    if (!responseText) {
      return null;
    }

    if (CURRENT_EVENT_PAGE_PATTERN.test(url)) {
      return extractAssignedJsonObject(responseText);
    }

    return JSON.parse(responseText);
  }

  function scoreEventPayload(payload) {
    if (!payload || typeof payload !== "object") {
      return -1;
    }

    let score = 0;

    Object.values(payload).forEach(eventRecord => {
      const params = eventRecord?.gacha?.params;
      const decks = params?.decks;
      const spinTypes = params?.spin_types;

      if (params) score += 10;
      if (decks && typeof decks === "object") score += 20;
      if (Array.isArray(spinTypes)) score += 20;

      if (Array.isArray(decks?.freedom_chest)) {
        score += 100 + decks.freedom_chest.length;
      }

      if (Array.isArray(decks?.epic_freedom_items)) {
        score += 25;
      }

      if (Array.isArray(decks?.legendary_freedom_items)) {
        score += 25;
      }

      if (Array.isArray(decks?.mythic_freedom_items)) {
        score += 25;
      }

      if (Array.isArray(decks?.arcane_chest)) {
        score += 100 + decks.arcane_chest.length;
      }

      if (Array.isArray(decks?.epic_arcane_items)) score += 25;
      if (Array.isArray(decks?.legendary_arcane_items)) score += 25;
      if (Array.isArray(decks?.mythic_arcane_items)) score += 25;
    });

    return score;
  }

  function findRewardDropCandidates(
    value,
    candidates = [],
    path = [],
    visited = new WeakSet()
  ) {
    if (!value || typeof value !== "object") {
      return candidates;
    }

    if (visited.has(value)) {
      return candidates;
    }

    visited.add(value);

    const drops = value.drops;

    if (
      drops &&
      typeof drops === "object" &&
      !Array.isArray(drops)
    ) {
      const availablePools =
        REWARD_POOL_KEYS.filter(
          key => Array.isArray(drops[key])
        );

      if (availablePools.length) {
        candidates.push({
          drops,
          path,
          score:
            availablePools.length * 1000 +
            availablePools.reduce(
              (total, key) =>
                total + drops[key].length,
              0
            )
        });
      }
    }

    Object.entries(value).forEach(
      ([key, child]) => {
        findRewardDropCandidates(
          child,
          candidates,
          [...path, key],
          visited
        );
      }
    );

    return candidates;
  }

  function extractRewardDropsFromHar(
    har,
    preferredEventKey = ""
  ) {
    const entries = har?.log?.entries;

    if (!Array.isArray(entries)) {
      return null;
    }

    const candidates = [];

    entries.forEach((entry, entryIndex) => {
      const url = String(entry?.request?.url || "");

      if (
        !EVENT_DATA_PATTERN.test(url) &&
        !CURRENT_EVENT_PAGE_PATTERN.test(url)
      ) {
        return;
      }

      try {
        const payload = extractEventDataPayload(entry);

        if (!payload) {
          return;
        }

        findRewardDropCandidates(payload)
          .forEach(candidate => {
            candidates.push({
              ...candidate,
              entryIndex,
              url,
              score:
                candidate.score +
                (
                  preferredEventKey &&
                  candidate.path[
                    candidate.path.length - 1
                  ] === preferredEventKey
                    ? 1000000
                    : 0
                )
            });
          });
      } catch (error) {
        console.warn(
          "[Chest Companion] Ignored unreadable event reward data.",
          error
        );
      }
    });

    candidates.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.entryIndex - left.entryIndex;
    });

    return candidates[0] || null;
  }

  function classifyArmoryEventKey(eventKey) {
    const key = String(eventKey || "").toLowerCase();
    if (/assault|invasion/.test(key)) return "assault";
    if (/breeding|breed|spend[_-]?breeding[_-]?tokens/.test(key)) return "breeding";
    return "";
  }

  function extractArmoryDropsFromHar(har) {
    const entries = har?.log?.entries;
    const result = {};
    if (!Array.isArray(entries)) return result;

    entries.forEach(entry => {
      const url = String(entry?.request?.url || "");
      if (
        !EVENT_DATA_PATTERN.test(url) &&
        !CURRENT_EVENT_PAGE_PATTERN.test(url)
      ) return;
      try {
        const payload = extractEventDataPayload(entry);
        if (!payload) return;
        const containers = [
          payload?.params_and_data?.gacha,
          payload?.gacha,
          payload
        ];
        containers.forEach(container => {
          if (!container || typeof container !== "object") return;
          Object.entries(container).forEach(([eventKey, record]) => {
            const armoryType = classifyArmoryEventKey(eventKey);
            const drops = record?.drops || record?.gacha?.params?.drops;
            if (armoryType && drops && typeof drops === "object") {
              result[eventKey] = structuredClone(drops);
            }
          });
        });
      } catch (error) {
        console.warn("[Chest Companion] Ignored unreadable Double Armory reward data.", error);
      }
    });

    return result;
  }

  function attachArmoryDrops(eventPayload, dropsByEvent) {
    const payload = structuredClone(eventPayload);
    Object.entries(payload).forEach(([eventKey, record]) => {
      const params = record?.gacha?.params;
      const drops = dropsByEvent?.[eventKey];
      if (params && drops) params.drops = structuredClone(drops);
    });
    return payload;
  }

  function attachRewardDrops(
    eventPayload,
    rewardDrops
  ) {
    if (!rewardDrops) {
      return eventPayload;
    }

    const payload = structuredClone(eventPayload);
    const visited = new WeakSet();

    function visit(value) {
      if (
        !value ||
        typeof value !== "object" ||
        visited.has(value)
      ) {
        return;
      }

      visited.add(value);

      const params = value?.gacha?.params;

      if (
        params?.deck_indices &&
        params?.decks
      ) {
        params.drops =
          structuredClone(rewardDrops);
      }

      Object.values(value).forEach(visit);
    }

    visit(payload);

    return payload;
  }

  function inferEventName(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }

    const eventKey =
      Object.keys(payload).find(key => {
        const params =
          payload[key]?.gacha?.params;

        return Boolean(
          params?.deck_indices &&
          params?.decks
        );
      });

    if (!eventKey) {
      return "";
    }

    return eventKey
      .replace(/\d+$/g, "")
      .replace(/[_-]+/g, " ")
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/\s+/g, " ")
      .trim()
      .replace(
        /\b\w/g,
        character => character.toUpperCase()
      );
  }

  function findEventKey(payload) {
    if (!payload || typeof payload !== "object") {
      return "";
    }

    const eventKeys =
      Object.keys(payload).filter(key => {
        const params =
          payload[key]?.gacha?.params;

        return Boolean(
          params?.deck_indices &&
          params?.decks
        );
      });

    return (
      eventKeys.find(
        key =>
          /spend_breeding_tokens/i.test(key)
      ) ||
      eventKeys[0] ||
      ""
    );
  }

  function extractAboutV2FromHar(har) {
    const entries = har?.log?.entries;

    if (!Array.isArray(entries)) {
      throw new Error(
        "This private update file is not supported."
      );
    }

    const candidates = [];

    entries.forEach((entry, entryIndex) => {
      const url = String(entry?.request?.url || "");

      if (!ABOUT_V2_PATTERN.test(url)) {
        return;
      }

      const responseText = getResponseText(entry);

      if (!responseText) {
        return;
      }

      try {
        const payload = JSON.parse(responseText);

        candidates.push({
          payload,
          entryIndex,
          url,
          score: scoreEventPayload(payload)
        });
      } catch (error) {
        console.warn(
          "[Chest Companion] Ignored an unreadable about_v2 response.",
          error
        );
      }
    });

    if (!candidates.length) {
      throw new Error(
        "No usable event intelligence was found in this private update."
      );
    }

    candidates.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      return right.entryIndex - left.entryIndex;
    });

    return candidates[0];
  }

  function isHarObject(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      value.log &&
      Array.isArray(value.log.entries)
    );
  }

  function getRequestParameters(entry) {
    const parameters = {};
    const postData = entry?.request?.postData;

    if (Array.isArray(postData?.params)) {
      postData.params.forEach(parameter => {
        if (parameter?.name) {
          parameters[parameter.name] =
            parameter.value ?? "";
        }
      });
    }

    if (typeof postData?.text === "string") {
      try {
        new URLSearchParams(postData.text)
          .forEach((value, key) => {
            parameters[key] = value;
          });
      } catch (error) {
        // Parsed HAR form parameters above remain usable.
      }
    }

    return parameters;
  }

  function extractArcaneBonusVerificationFromHar(har) {
    const entries = har?.log?.entries;

    if (!Array.isArray(entries)) {
      return null;
    }

    const verifiedClaim =
      entries.find(entry => {
        const url =
          String(entry?.request?.url || "");

        if (!USE_GACHA_PATTERN.test(url)) {
          return false;
        }

        const parameters =
          getRequestParameters(entry);
        const claimType =
          String(
            parameters.claim_options_type ||
            ""
          ).toLowerCase();

        if (
          String(parameters.spin_type || "") !== "38" ||
          !claimType.includes("bonus")
        ) {
          return false;
        }

        try {
          const response =
            parseJsonText(
              getResponseText(entry),
              "The Arcane bonus response"
            );

          return (
            response?.success !== false &&
            Array.isArray(response?.drops) &&
            response.drops.some(
              drop =>
                drop?.src ===
                "mythic_arcane_items"
            )
          );
        } catch (error) {
          return false;
        }
      });

    if (!verifiedClaim) {
      return null;
    }

    /*
     * Deliberately omit the player's reward, sequence, timestamp
     * and account details. Only shared event facts are returned.
     */
    return {
      verified: true,
      cadence: 15,
      poolKey: "mythic_arcane_items",
      evidence: "captured_bonus_claim"
    };
  }

  function parseImportText(rawText) {
    const text = String(rawText || "").trim();

    if (!text) {
      throw new Error("The selected import file is empty.");
    }

    const parsed = parseJsonText(text, "The selected file");

    if (!isHarObject(parsed)) {
      return {
        kind: "event-json",
        eventPayload: parsed,
        diagnostics: null
      };
    }

    /*
     * The base builder receives only a strict, sanitised tower snapshot.
     * The parsed capture stays in this call frame and is never persisted or
     * attached to the event result.
     */
    try {
      window.OnyxTowerInventoryBridge?.importHar?.(parsed);
    } catch (error) {
      console.warn(
        "[Onyx Command] No verified tower inventory could be prepared from this private import.",
        error
      );
    }

    const extracted = extractAboutV2FromHar(parsed);
    const eventKey =
      findEventKey(extracted.payload);
    const rewardData =
      extractRewardDropsFromHar(
        parsed,
        eventKey
      );
    const arcaneBonusVerification =
      extractArcaneBonusVerificationFromHar(
        parsed
      );

    const armoryDrops = extractArmoryDropsFromHar(parsed);
    const eventPayload = attachArmoryDrops(
      attachRewardDrops(extracted.payload, rewardData?.drops),
      armoryDrops
    );

    const eventName =
      Object.keys(armoryDrops).length >= 2
        ? "Double Armory"
        : inferEventName(eventPayload);

    if (
      eventName &&
      !eventPayload.event_name
    ) {
      eventPayload.event_name =
        eventName;
    }

    return {
      kind: "har",
      eventPayload,
      sharedVerification: {
        arcane:
          arcaneBonusVerification
      },
      diagnostics: {
        sourceEntryIndex: extracted.entryIndex,
        sourceUrl: extracted.url,
        score: extracted.score,
        rewardSourceEntryIndex:
          rewardData?.entryIndex ?? null,
        rewardSourceUrl:
          rewardData?.url ?? null,
        rewardPoolCount:
          rewardData
            ? Object.keys(
                rewardData.drops
              ).length
            : 0,
        eventName,
        eventKey,
        arcaneBonusVerified:
          Boolean(
            arcaneBonusVerification
          ),
        doubleArmoryDetected:
          Object.keys(armoryDrops).length >= 2
      }
    };
  }

  function installParserWrapper() {
    const EventParser = window.EventParser;

    if (!EventParser || typeof EventParser.parse !== "function") {
      return false;
    }

    if (EventParser.__harAdapterInstalled) {
      return true;
    }

    const originalParse =
      EventParser.parse.bind(EventParser);

    EventParser.parse = function parseEventOrHar(rawText) {
      const imported = parseImportText(rawText);

      window.ChestCompanionLastImport = {
        kind: imported.kind,
        diagnostics: imported.diagnostics,
        importedAt: new Date().toISOString()
      };

      const parsedEvent = originalParse(
        JSON.stringify(imported.eventPayload)
      );

      const arcaneVerification =
        imported.sharedVerification?.arcane;

      if (
        arcaneVerification?.verified === true &&
        Array.isArray(
          parsedEvent?.decks?.[
            arcaneVerification.poolKey
          ]
        ) &&
        parsedEvent?.chests?.arcane
      ) {
        parsedEvent.chests.arcane = {
          ...parsedEvent.chests.arcane,
          bonusVerification: {
            ...arcaneVerification
          }
        };
      }

      return parsedEvent;
    };

    Object.defineProperty(
      EventParser,
      "__harAdapterInstalled",
      {
        value: true,
        enumerable: false,
        configurable: false,
        writable: false
      }
    );

    console.info(
      "[Chest Companion] HAR event adapter ready."
    );

    return true;
  }

  window.ChestCompanionHarAdapter =
    Object.freeze({
      parseImportText,
      extractAboutV2FromHar,
      extractRewardDropsFromHar,
      extractArcaneBonusVerificationFromHar,
      inferEventName,
      findEventKey,
      classifyArmoryEventKey,
      extractArmoryDropsFromHar,
      install: installParserWrapper
    });

  if (!installParserWrapper()) {
    document.addEventListener(
      "DOMContentLoaded",
      installParserWrapper,
      { once: true }
    );

    window.addEventListener(
      "load",
      installParserWrapper,
      { once: true }
    );
  }
})(window);
