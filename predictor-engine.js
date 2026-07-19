/* ============================================================
   CHEST COMPANION V2 — UPLOADED WORKBOOK PREDICTOR ENGINE
   Gold + Platinum workbook parser
   Includes Tables (Combining) and Drop names reward discovery
   ============================================================ */

(function initialiseChestPredictor(global) {
  "use strict";

  const SUPPORTED_CHESTS = Object.freeze([
    "gold",
    "platinum"
  ]);

  const VALID_RARITIES = new Set([
    "common",
    "rare",
    "epic",
    "legendary",
    "mythic"
  ]);

  const INVALID_SEQUENCE_LABELS = new Set([
    "assault",
    "pvp",
    "breeding",
    "fortification",
    "crystal caves",
    "temple raids",
    "team gauntlet",
    "fight pits",
    "gold",
    "gold chest",
    "platinum",
    "platinum chest",
    "bonus",
    "bonus chest",
    "name",
    "names",
    "drop name",
    "drop names",
    "item",
    "items",
    "rarity",
    "reward",
    "rewards",
    "amount",
    "quantity",
    "type",
    "category",
    "valid for",
    "notes",
    "sequence",
    "sequence cycle"
  ]);

  const EVENT_PROFILE_MAP = Object.freeze({
    breeding: "breeding",
    fortification: "pvp",
    "crystal-caves": "pvp",
    "temple-raids": "pvp",
    "team-gauntlet": "pvp",
    "fight-pits": "pvp",
    assault: "pvp",
    pvp: "pvp"
  });

  const parsedProfiles = new Map();

  let activeEventId = "";
  let activeChestType = "";

  function normalise(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/×/g, "x")
      .replace(/[№#]/g, "")
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .replace(/[^a-z0-9+%[\](). ]/g, "")
      .trim();
  }

  function compactNormalise(value) {
    return normalise(value)
      .replace(/[^a-z0-9+%]/g, "");
  }

  function unique(values) {
    const found = new Set();

    return values.filter(value => {
      const key = compactNormalise(value);

      if (!key || found.has(key)) {
        return false;
      }

      found.add(key);
      return true;
    });
  }

  function positiveModulo(value, length) {
    if (!length) {
      return 0;
    }

    return ((value % length) + length) % length;
  }

  function cleanCell(value) {
    if (
      value === null ||
      value === undefined
    ) {
      return "";
    }

    if (typeof value === "object") {
      return String(
        value.result ||
        value.value ||
        value.text ||
        value.v ||
        ""
      ).trim();
    }

    return String(value).trim();
  }

  function isValidRarity(value) {
    return VALID_RARITIES.has(
      normalise(value)
    );
  }

  function formatRarity(value) {
    const cleaned = normalise(value);

    if (!VALID_RARITIES.has(cleaned)) {
      return "";
    }

    return (
      cleaned.charAt(0).toUpperCase() +
      cleaned.slice(1)
    );
  }

  function isNumericOnly(value) {
    return /^\d+(?:\.\d+)?$/.test(
      String(value || "").trim()
    );
  }

  function isInvalidSequenceLabel(value) {
    const cleaned = normalise(value);

    return (
      !cleaned ||
      INVALID_SEQUENCE_LABELS.has(cleaned) ||
      cleaned.startsWith("sequence cycle") ||
      cleaned.startsWith("valid for")
    );
  }

  function cleanRaritySequence(sequence) {
    return sequence
      .map(cleanCell)
      .filter(isValidRarity)
      .map(formatRarity);
  }

  function cleanRewardSequence(sequence) {
    return sequence
      .map(cleanCell)
      .filter(value => {
        if (
          !value ||
          value.startsWith("=")
        ) {
          return false;
        }

        if (
          isNumericOnly(value) ||
          isValidRarity(value) ||
          isInvalidSequenceLabel(value)
        ) {
          return false;
        }

        return /[a-z]/i.test(value);
      });
  }

  function looksLikeRewardName(value) {
    const cleaned = cleanCell(value);

    if (
      !cleaned ||
      cleaned.startsWith("=") ||
      isNumericOnly(cleaned) ||
      isValidRarity(cleaned) ||
      isInvalidSequenceLabel(cleaned)
    ) {
      return false;
    }

    const normalisedValue = normalise(cleaned);

    if (
      normalisedValue.includes("drop name") ||
      normalisedValue.includes("sequence cycle") ||
      normalisedValue.includes("valid for")
    ) {
      return false;
    }

    return /[a-z]/i.test(cleaned);
  }

  function normaliseChestType(chestType) {
    const chest = compactNormalise(chestType);

    if (chest.includes("platinum")) {
      return "platinum";
    }

    if (chest.includes("gold")) {
      return "gold";
    }

    return chest;
  }

  function normaliseProfileName(profileName) {
    const profile = normalise(profileName);

    if (profile.includes("breed")) {
      return "breeding";
    }

    if (
      profile.includes("assault") ||
      profile.includes("pvp") ||
      profile.includes("fortification") ||
      profile.includes("crystal") ||
      profile.includes("temple") ||
      profile.includes("gauntlet") ||
      profile.includes("fight")
    ) {
      return "pvp";
    }

    return (
      EVENT_PROFILE_MAP[
        String(profileName || "").toLowerCase()
      ] || "pvp"
    );
  }

  function getEventProfile(eventId) {
    return (
      EVENT_PROFILE_MAP[eventId] ||
      normaliseProfileName(eventId)
    );
  }

  function getProfileCacheKey(
    eventId,
    chestType
  ) {
    return `${eventId || "unknown"}:${normaliseChestType(
      chestType
    )}`;
  }

  function getWorkbookSheets(workbookRecord) {
    return Array.isArray(workbookRecord?.sheets)
      ? workbookRecord.sheets
      : [];
  }

  function getSheetByName(
    workbookRecord,
    searchName
  ) {
    const target = normalise(searchName);

    return (
      getWorkbookSheets(workbookRecord).find(
        sheet =>
          normalise(sheet.sheetName) === target
      ) || null
    );
  }

  function findSheetContaining(
    workbookRecord,
    terms
  ) {
    const searchTerms = terms.map(normalise);

    return (
      getWorkbookSheets(workbookRecord).find(
        sheet => {
          const name = normalise(
            sheet.sheetName
          );

          return searchTerms.every(term =>
            name.includes(term)
          );
        }
      ) || null
    );
  }

  function findCombiningSheet(
    workbookRecord
  ) {
    return (
      getSheetByName(
        workbookRecord,
        "Tables (Combining)"
      ) ||
      findSheetContaining(
        workbookRecord,
        ["combining"]
      ) ||
      findSheetContaining(
        workbookRecord,
        ["tables"]
      ) ||
      null
    );
  }

  function findDropNamesSheet(
    workbookRecord
  ) {
    return (
      getSheetByName(
        workbookRecord,
        "Drop names"
      ) ||
      findSheetContaining(
        workbookRecord,
        ["drop", "names"]
      ) ||
      findSheetContaining(
        workbookRecord,
        ["drop"]
      ) ||
      null
    );
  }

  function findRarityNearCell(
    row,
    columnIndex
  ) {
    const nearbyIndexes = [
      columnIndex - 1,
      columnIndex + 1,
      columnIndex - 2,
      columnIndex + 2
    ];

    for (const nearbyIndex of nearbyIndexes) {
      if (nearbyIndex < 0) {
        continue;
      }

      const rarity = formatRarity(
        row?.[nearbyIndex]
      );

      if (rarity) {
        return rarity;
      }
    }

    return "";
  }

  function findColumnRarity(
    rows,
    columnIndex,
    rowIndex
  ) {
    const minimumRow = Math.max(
      0,
      rowIndex - 12
    );

    for (
      let searchRow = rowIndex - 1;
      searchRow >= minimumRow;
      searchRow -= 1
    ) {
      const directRarity = formatRarity(
        rows[searchRow]?.[columnIndex]
      );

      if (directRarity) {
        return directRarity;
      }

      const nearbyRarity = findRarityNearCell(
        rows[searchRow] || [],
        columnIndex
      );

      if (nearbyRarity) {
        return nearbyRarity;
      }
    }

    return "";
  }

  function parseDropNamesSheet(
    workbookRecord
  ) {
    const sheet = findDropNamesSheet(
      workbookRecord
    );

    if (
      !sheet ||
      !Array.isArray(sheet.rows)
    ) {
      return {
        catalogue: [],
        rarityMap: {}
      };
    }

    const catalogue = [];
    const rarityMap = {};
    const currentRarityByColumn = {};

    sheet.rows.forEach(
      (row, rowIndex) => {
        if (!Array.isArray(row)) {
          return;
        }

        row.forEach(
          (cell, columnIndex) => {
            const cellRarity =
              formatRarity(cell);

            if (cellRarity) {
              currentRarityByColumn[
                columnIndex
              ] = cellRarity;
            }
          }
        );

        const rowRarity =
          row
            .map(formatRarity)
            .find(Boolean) ||
          "";

        row.forEach(
          (cell, columnIndex) => {
            const reward =
              cleanCell(cell);

            if (
              !looksLikeRewardName(
                reward
              )
            ) {
              return;
            }

            const rarity =
              findRarityNearCell(
                row,
                columnIndex
              ) ||
              currentRarityByColumn[
                columnIndex
              ] ||
              findColumnRarity(
                sheet.rows,
                columnIndex,
                rowIndex
              ) ||
              rowRarity;

            catalogue.push(reward);

            if (rarity) {
              rarityMap[
                compactNormalise(
                  reward
                )
              ] = rarity;
            }
          }
        );
      }
    );

    return {
      catalogue:
        unique(catalogue),

      rarityMap
    };
  }
    function findHeaderRowIndex(rows) {
    return rows.findIndex(row => {
      const cells = row.map(normalise);

      const hasAssault =
        cells.some(
          cell =>
            cell === "assault" ||
            cell === "pvp"
        );

      const hasBreeding =
        cells.some(
          cell =>
            cell === "breeding"
        );

      return hasAssault && hasBreeding;
    });
  }

  function findGroupTitle(
    rows,
    columnIndex,
    headerRowIndex
  ) {
    const recognisedTitles = [
      "common drop",
      "rare drop",
      "epic drop",
      "legendary drop",
      "mythic drop",
      "gold chest",
      "platinum chest",
      "bonus chest",
      "bonus"
    ];

    for (
      let rowIndex =
        headerRowIndex - 1;
      rowIndex >=
        Math.max(
          0,
          headerRowIndex - 12
        );
      rowIndex -= 1
    ) {
      for (
        let offset = 0;
        offset <= 3;
        offset += 1
      ) {
        const possibleColumns = [
          columnIndex,
          columnIndex - offset,
          columnIndex + offset
        ];

        for (
          const possibleColumn of
          possibleColumns
        ) {
          if (possibleColumn < 0) {
            continue;
          }

          const value =
            cleanCell(
              rows[rowIndex]?.[
                possibleColumn
              ]
            );

          const text =
            normalise(value);

          if (
            recognisedTitles.some(
              title =>
                text.includes(title)
            )
          ) {
            return value;
          }
        }
      }
    }

    return "";
  }

  function findSequenceLength(
    rows,
    profileColumnIndex,
    headerRowIndex
  ) {
    for (
      let rowIndex =
        headerRowIndex - 1;
      rowIndex >= 0;
      rowIndex -= 1
    ) {
      const value =
        rows[rowIndex]?.[
          profileColumnIndex
        ];

      const numericValue =
        Number(
          cleanCell(value)
        );

      if (
        Number.isFinite(
          numericValue
        ) &&
        numericValue > 0
      ) {
        return Math.floor(
          numericValue
        );
      }
    }

    return null;
  }

  function readColumnSequence(
    rows,
    columnIndex,
    startRowIndex,
    expectedLength = null
  ) {
    const sequence = [];

    for (
      let rowIndex = startRowIndex;
      rowIndex < rows.length;
      rowIndex += 1
    ) {
      const value =
        cleanCell(
          rows[rowIndex]?.[
            columnIndex
          ]
        );

      if (
        !value ||
        value.startsWith("=")
      ) {
        continue;
      }

      sequence.push(value);

      if (
        expectedLength &&
        sequence.length >=
          expectedLength
      ) {
        break;
      }
    }

    return sequence;
  }

  function discoverSequenceGroups(
    rows,
    selectedProfile
  ) {
    const headerRowIndex =
      findHeaderRowIndex(rows);

    if (headerRowIndex < 0) {
      throw new Error(
        "The predictor sequence columns could not be identified."
      );
    }

    const headerRow =
      rows[headerRowIndex];

    const groups = [];

    for (
      let columnIndex = 0;
      columnIndex <
        headerRow.length;
      columnIndex += 1
    ) {
      const header =
        normalise(
          headerRow[columnIndex]
        );

      const isProfileColumn =
        selectedProfile ===
        "breeding"
          ? header.includes(
              "breeding"
            )
          : (
              header.includes(
                "assault"
              ) ||
              header === "pvp"
            );

      if (!isProfileColumn) {
        continue;
      }

      const title =
        findGroupTitle(
          rows,
          columnIndex,
          headerRowIndex
        );

      const expectedLength =
        findSequenceLength(
          rows,
          columnIndex,
          headerRowIndex
        );

      const rawSequence =
        readColumnSequence(
          rows,
          columnIndex,
          headerRowIndex + 1,
          expectedLength
        );

      const normalisedTitle =
        normalise(title);

      const sequence =
        (
          normalisedTitle.includes(
            "chest"
          ) ||
          normalisedTitle.includes(
            "bonus"
          )
        )
          ? cleanRaritySequence(
              rawSequence
            )
          : cleanRewardSequence(
              rawSequence
            );

      if (!sequence.length) {
        continue;
      }

      groups.push({
        title,
        normalisedTitle,
        columnIndex,
        expectedLength,
        sequence
      });
    }

    return groups;
  }

  function isRewardGroup(group) {
    const title =
      group.normalisedTitle;

    return (
      title.includes(
        "common drop"
      ) ||
      title.includes(
        "rare drop"
      ) ||
      title.includes(
        "epic drop"
      ) ||
      title.includes(
        "legendary drop"
      ) ||
      title.includes(
        "mythic drop"
      )
    );
  }

  function getRarityFromGroup(
    group
  ) {
    const title =
      group.normalisedTitle;

    if (
      title.includes("common")
    ) {
      return "Common";
    }

    if (
      title.includes("rare")
    ) {
      return "Rare";
    }

    if (
      title.includes("epic")
    ) {
      return "Epic";
    }

    if (
      title.includes(
        "legendary"
      )
    ) {
      return "Legendary";
    }

    if (
      title.includes("mythic")
    ) {
      return "Mythic";
    }

    return "";
  }

  function isMainChestGroup(
    group,
    chestType
  ) {
    const title =
      group.normalisedTitle;

    if (chestType === "gold") {
      return (
        title.includes(
          "gold chest"
        ) ||
        title === "gold"
      );
    }

    if (
      chestType === "platinum"
    ) {
      return (
        title.includes(
          "platinum chest"
        ) ||
        title === "platinum"
      );
    }

    return false;
  }

  function isBonusGroup(group) {
    const title =
      group.normalisedTitle;

    return (
      title.includes("bonus") ||
      title.includes(
        "bonus chest"
      )
    );
  }

  function inferChestSequenceGroup(
    groups,
    chestType
  ) {
    const exact =
      groups.find(group =>
        isMainChestGroup(
          group,
          chestType
        )
      );

    if (exact) {
      return exact;
    }

    const rarityNames =
      new Set([
        "common",
        "rare",
        "epic",
        "legendary",
        "mythic"
      ]);

    const possible =
      groups.filter(group => {
        const validRarityCount =
          group.sequence.filter(
            value =>
              rarityNames.has(
                normalise(value)
              )
          ).length;

        return (
          validRarityCount >
          group.sequence.length *
            0.7
        );
      });

    if (!possible.length) {
      return null;
    }

    if (chestType === "gold") {
      return (
        possible.find(group =>
          group.sequence.some(
            rarity =>
              normalise(
                rarity
              ) === "common" ||
              normalise(
                rarity
              ) === "rare"
          )
        ) ||
        possible[0]
      );
    }

    return (
      possible.find(group =>
        group.sequence.some(
          rarity =>
            normalise(
              rarity
            ) === "mythic"
        )
      ) ||
      possible[0]
    );
  }

  function buildRewardRarityMap(
    rewardSequences
  ) {
    const result = {};

    Object.entries(
      rewardSequences
    ).forEach(
      ([rarity, sequence]) => {
        sequence.forEach(
          reward => {
            result[
              compactNormalise(
                reward
              )
            ] = rarity;
          }
        );
      }
    );

    return result;
  }

  function mergeRewardRarityMaps(
    sequenceMap,
    dropNamesMap
  ) {
    return {
      ...dropNamesMap,
      ...sequenceMap
    };
  }

  function parseWorkbookProfile(
    workbookRecord
  ) {
    if (!workbookRecord) {
      throw new Error(
        "No uploaded predictor workbook is available."
      );
    }

    const chestType =
      normaliseChestType(
        workbookRecord.chestType
      );

    if (
      !SUPPORTED_CHESTS.includes(
        chestType
      )
    ) {
      throw new Error(
        "Only Gold and Platinum predictor files are supported."
      );
    }

    const eventId =
      workbookRecord.eventId ||
      activeEventId ||
      "unknown";

    const profileName =
      getEventProfile(eventId);

    const combiningSheet =
      findCombiningSheet(
        workbookRecord
      );

    if (
      !combiningSheet ||
      !Array.isArray(
        combiningSheet.rows
      )
    ) {
      throw new Error(
        'The workbook is missing its "Tables (Combining)" sequence sheet.'
      );
    }

    const groups =
      discoverSequenceGroups(
        combiningSheet.rows,
        profileName
      );

    if (!groups.length) {
      throw new Error(
        `No ${
          profileName ===
          "breeding"
            ? "Breeding"
            : "PvP / Assault"
        } sequence columns were found.`
      );
    }

    const rewardSequences = {};

    groups
      .filter(isRewardGroup)
      .forEach(group => {
        const rarity =
          getRarityFromGroup(
            group
          );

        if (!rarity) {
          return;
        }

        const cleanedRewards =
          cleanRewardSequence(
            group.sequence
          );

        if (
          cleanedRewards.length
        ) {
          rewardSequences[
            rarity
          ] = cleanedRewards;
        }
      });

    const dropNamesData =
      parseDropNamesSheet(
        workbookRecord
      );

    const mainGroup =
      inferChestSequenceGroup(
        groups,
        chestType
      );

    if (
      !mainGroup ||
      !mainGroup.sequence.length
    ) {
      throw new Error(
        `The ${chestType} chest rarity sequence could not be found.`
      );
    }

    const mainSequence =
      cleanRaritySequence(
        mainGroup.sequence
      );

    if (!mainSequence.length) {
      throw new Error(
        `The ${chestType} chest sequence did not contain valid rarity entries.`
      );
    }

    const bonusGroup =
      groups.find(
        group =>
          isBonusGroup(group) &&
          group !== mainGroup
      );

    const bonusSequence =
      bonusGroup
        ? cleanRaritySequence(
            bonusGroup.sequence
          )
        : [];

    const sequenceRarityMap =
      buildRewardRarityMap(
        rewardSequences
      );

    const profile = {
      source:
        "uploaded-workbook",

      chestType,

      eventId,

      eventName:
        workbookRecord.eventName ||
        eventId,

      profileName,

      label:
        `${
          workbookRecord.eventName ||
          eventId
        } ${
          chestType === "gold"
            ? "Gold"
            : "Platinum"
        }`,

      version:
        workbookRecord.fileName ||
        "",

      importedAt:
        workbookRecord.importedAt ||
        "",

      mainSequence,

      bonusSequence,

      rewardSequences,

      additionalRewards:
        dropNamesData.catalogue,

      rewardRarityMap:
        mergeRewardRarityMaps(
          sequenceRarityMap,
          dropNamesData.rarityMap
        ),

      groups,

      workbook:
        workbookRecord
    };

    parsedProfiles.set(
      getProfileCacheKey(
        eventId,
        chestType
      ),
      profile
    );

    return profile;
  }
    function getCachedProfile(
    chestType,
    eventOrProfile =
      activeEventId
  ) {
    const chest =
      normaliseChestType(
        chestType
      );

    const eventId =
      eventOrProfile ||
      activeEventId;

    const exactKey =
      getProfileCacheKey(
        eventId,
        chest
      );

    if (
      parsedProfiles.has(exactKey)
    ) {
      return parsedProfiles.get(
        exactKey
      );
    }

    const wantedProfile =
      getEventProfile(eventId);

    return (
      [...parsedProfiles.values()]
        .find(profile =>
          profile.chestType === chest &&
          profile.profileName ===
            wantedProfile
        ) || null
    );
  }

  async function loadProfile(
    chestType,
    eventId = activeEventId
  ) {
    const chest =
      normaliseChestType(
        chestType
      );

    if (
      !SUPPORTED_CHESTS.includes(
        chest
      )
    ) {
      return null;
    }

    const cached =
      getCachedProfile(
        chest,
        eventId
      );

    if (cached) {
      return cached;
    }

    if (
      !global.ChestPredictorUpload
        ?.getWorkbook
    ) {
      return null;
    }

    const workbookRecord =
      await global
        .ChestPredictorUpload
        .getWorkbook(
          eventId,
          chest
        );

    if (!workbookRecord) {
      return null;
    }

    return parseWorkbookProfile(
      workbookRecord
    );
  }

  async function activate(
    chestType,
    eventId = activeEventId
  ) {
    activeChestType =
      normaliseChestType(
        chestType
      );

    activeEventId =
      eventId ||
      global.ChestPredictorUpload
        ?.getSelectedEvent?.() ||
      "";

    const profile =
      await loadProfile(
        activeChestType,
        activeEventId
      );

    global.dispatchEvent(
      new CustomEvent(
        "chest-companion-predictor-activated",
        {
          detail: {
            chestType:
              activeChestType,
            eventId:
              activeEventId,
            profile
          }
        }
      )
    );

    return profile;
  }

  function getProfile(
    chestType,
    eventOrProfile =
      activeEventId
  ) {
    return getCachedProfile(
      chestType,
      eventOrProfile
    );
  }

  function getRewardSequence(
    profile,
    rarity
  ) {
    if (!profile) {
      return [];
    }

    const target =
      compactNormalise(rarity);

    const matchingKey =
      Object.keys(
        profile.rewardSequences
      ).find(key =>
        compactNormalise(key) ===
        target
      );

    return matchingKey
      ? profile.rewardSequences[
          matchingKey
        ]
      : [];
  }

  function getRarities(
    chestType,
    eventOrProfile =
      activeEventId
  ) {
    const profile =
      getProfile(
        chestType,
        eventOrProfile
      );

    if (!profile) {
      return [];
    }

    return unique([
      ...profile.mainSequence,
      ...profile.bonusSequence,
      ...Object.keys(
        profile.rewardSequences
      )
    ]).filter(
      isValidRarity
    );
  }

  function getRewardCatalogue(
    chestType,
    eventOrProfile =
      activeEventId,
    rarity = null
  ) {
    const profile =
      getProfile(
        chestType,
        eventOrProfile
      );

    if (!profile) {
      return [];
    }

    const sequenceRewards =
      Object.values(
        profile.rewardSequences
      ).flat();

    const additionalRewards =
      Array.isArray(
        profile.additionalRewards
      )
        ? profile.additionalRewards
        : [];

    const catalogue =
      unique([
        ...sequenceRewards,
        ...additionalRewards
      ]);

    if (rarity) {
      return catalogue
        .filter(reward =>
          valuesMatch(
            findRewardRarity(
              profile,
              reward
            ),
            rarity
          )
        )
        .sort(
          (a, b) =>
            a.localeCompare(b)
        );
    }

    return catalogue.sort(
      (a, b) =>
        a.localeCompare(b)
    );
  }

  function findRewardRarity(
    profile,
    reward
  ) {
    if (
      !profile ||
      !reward
    ) {
      return "";
    }

    return (
      profile.rewardRarityMap[
        compactNormalise(
          reward
        )
      ] || ""
    );
  }

  function cleanDrops(
    drops,
    profile = null
  ) {
    if (!Array.isArray(drops)) {
      return [];
    }

    return drops
      .map(
        (drop, index) => {
          const reward =
            drop?.reward ||
            drop?.display ||
            drop?.prize ||
            drop?.name ||
            drop?.label ||
            (
              typeof drop ===
              "string"
                ? drop
                : ""
            );

          const rarity =
            drop?.rarity ||
            drop?.sequence ||
            drop?.chestRarity ||
            findRewardRarity(
              profile,
              reward
            );

          return {
            index,
            rarity,
            reward,
            bonus:
              Boolean(
                drop?.bonus
              )
          };
        }
      )
      .filter(
        drop =>
          drop.rarity ||
          drop.reward
      );
  }

  function splitDrops(
    drops,
    profile
  ) {
    const cleaned =
      cleanDrops(
        drops,
        profile
      );

    return {
      all: cleaned,

      regular:
        cleaned.filter(
          drop =>
            !drop.bonus
        ),

      bonus:
        cleaned.filter(
          drop =>
            drop.bonus
        )
    };
  }

  function valuesMatch(
    first,
    second
  ) {
    return (
      compactNormalise(first) ===
      compactNormalise(second)
    );
  }
    function sequenceMatchesAt(
    sequence,
    observations,
    startPosition
  ) {
    if (
      !sequence.length ||
      !observations.length
    ) {
      return false;
    }

    return observations.every(
      (
        observation,
        observationIndex
      ) => {
        const sequenceIndex =
          positiveModulo(
            startPosition +
              observationIndex,
            sequence.length
          );

        return valuesMatch(
          sequence[
            sequenceIndex
          ],
          observation
        );
      }
    );
  }

  function findCircularMatches(
    sequence,
    observations
  ) {
    if (
      !Array.isArray(sequence) ||
      !sequence.length
    ) {
      return [];
    }

    if (
      !Array.isArray(observations) ||
      !observations.length
    ) {
      return sequence.map(
        (_, index) =>
          index
      );
    }

    const candidates = [];

    for (
      let startPosition = 0;
      startPosition <
        sequence.length;
      startPosition += 1
    ) {
      if (
        sequenceMatchesAt(
          sequence,
          observations,
          startPosition
        )
      ) {
        candidates.push(
          startPosition
        );
      }
    }

    return candidates;
  }

  function solveRaritySequence(
    profile,
    drops
  ) {
    const split =
      splitDrops(
        drops,
        profile
      );

    const mainObservations =
      split.regular
        .map(drop =>
          drop.rarity
        )
        .filter(Boolean);

    const bonusObservations =
      split.bonus
        .map(drop =>
          drop.rarity
        )
        .filter(Boolean);

    return {
      mainObservations,

      bonusObservations,

      mainCandidates:
        findCircularMatches(
          profile.mainSequence,
          mainObservations
        ),

      bonusCandidates:
        profile.bonusSequence.length
          ? findCircularMatches(
              profile.bonusSequence,
              bonusObservations
            )
          : [],

      regularCount:
        split.regular.length,

      bonusCount:
        split.bonus.length
    };
  }

    function solveRewardSequences(
    profile,
    drops
  ) {
    const split =
      splitDrops(
        drops,
        profile
      );

    const result = {};

    Object.keys(
      profile.rewardSequences
    ).forEach(rarity => {
      const rewardSequence =
        profile.rewardSequences[
          rarity
        ];

      const sequenceRewardKeys =
        new Set(
          rewardSequence.map(
            compactNormalise
          )
        );

      const observations =
        split.all
          .filter(drop =>
            valuesMatch(
              drop.rarity,
              rarity
            )
          )
          .filter(drop =>
            sequenceRewardKeys.has(
              compactNormalise(
                drop.reward
              )
            )
          )
          .map(drop =>
            drop.reward
          )
          .filter(Boolean);

      result[rarity] = {
        observations,

        candidates:
          findCircularMatches(
            rewardSequence,
            observations
          )
      };
    });

    return result;
  }

  function calculateConfidence(
    solution
  ) {
    if (!solution?.matched) {
      return 0;
    }

    const tracks = [
      solution.rarity
        .mainCandidates,

      ...Object.values(
        solution.rewards
      )
        .filter(track =>
          track.observations.length
        )
        .map(track =>
          track.candidates
        )
    ];

    if (
      solution.rarity
        .bonusObservations.length &&
      solution.profile
        .bonusSequence.length
    ) {
      tracks.push(
        solution.rarity
          .bonusCandidates
      );
    }

    if (!tracks.length) {
      return 0;
    }

    const scores =
      tracks.map(candidates => {
        if (!candidates.length) {
          return 0;
        }

        if (
          candidates.length === 1
        ) {
          return 100;
        }

        return Math.max(
          1,
          Math.round(
            100 /
              candidates.length
          )
        );
      });

    return Math.round(
      scores.reduce(
        (total, score) =>
          total + score,
        0
      ) /
        scores.length
    );
  }

  function solve(
    chestType,
    eventOrProfile,
    drops
  ) {
    const profile =
      getProfile(
        chestType,
        eventOrProfile
      );

    if (!profile) {
      return {
        available: false,
        matched: false,
        confidence: 0,
        reason:
          "Upload and activate a predictor file for this event."
      };
    }

    const cleanedDrops =
      cleanDrops(
        drops,
        profile
      );

    const unknownRewards =
      cleanedDrops.filter(
        drop =>
          drop.reward &&
          !drop.rarity
      );

    if (
      unknownRewards.length
    ) {
      return {
        available: true,
        matched: false,
        confidence: 0,
        profile,
        reason:
          `Reward not found in this predictor: ${
            unknownRewards[0]
              .reward
          }`
      };
    }

    const raritySolution =
      solveRaritySequence(
        profile,
        cleanedDrops
      );

    const rewardSolutions =
      solveRewardSequences(
        profile,
        cleanedDrops
      );

    const mainMismatch =
      raritySolution
        .mainObservations.length >
        0 &&
      raritySolution
        .mainCandidates.length ===
        0;

    const bonusMismatch =
      raritySolution
        .bonusObservations.length >
        0 &&
      profile.bonusSequence.length >
        0 &&
      raritySolution
        .bonusCandidates.length ===
        0;

    const rewardMismatch =
      Object.values(
        rewardSolutions
      ).some(track =>
        track.observations.length >
          0 &&
        track.candidates.length ===
          0
      );

    const matched =
      !mainMismatch &&
      !bonusMismatch &&
      !rewardMismatch;

    const result = {
      available: true,
      matched,
      profile,
      rarity:
        raritySolution,
      rewards:
        rewardSolutions,
      confidence: 0,
      reason: matched
        ? ""
        : "The recorded drops do not match this uploaded sequence."
    };

    result.confidence =
      calculateConfidence(
        result
      );

    return result;
  }

  function findFirstMismatch(
    chestType,
    eventOrProfile,
    drops
  ) {
    const profile =
      getProfile(
        chestType,
        eventOrProfile
      );

    const cleaned =
      cleanDrops(
        drops,
        profile
      );

    for (
      let index = 0;
      index <
        cleaned.length;
      index += 1
    ) {
      const result =
        solve(
          chestType,
          eventOrProfile,
          cleaned.slice(
            0,
            index + 1
          )
        );

      if (!result.matched) {
        return index + 1;
      }
    }

    return null;
  }

  function getLikelyCurrentPosition(
    solution
  ) {
    if (!solution?.matched) {
      return null;
    }

    const candidates =
      solution.rarity
        .mainCandidates;

    if (
      candidates.length !== 1 ||
      !solution.rarity
        .regularCount
    ) {
      return null;
    }

    return positiveModulo(
      candidates[0] +
        solution.rarity
          .regularCount -
        1,
      solution.profile
        .mainSequence.length
    );
  }

  function predictUpcoming(
    chestType,
    eventOrProfile,
    drops,
    amount = 5
  ) {
    const solution =
      solve(
        chestType,
        eventOrProfile,
        drops
      );

    if (
      !solution.available ||
      !solution.matched
    ) {
      return [];
    }

    const profile =
      solution.profile;

    const mainCandidates =
      solution.rarity
        .mainCandidates;

    if (
      mainCandidates.length !== 1
    ) {
      return [];
    }

    const split =
      splitDrops(
        drops,
        profile
      );

    const rarityCounts = {};

    split.regular.forEach(
      drop => {
        const key =
          compactNormalise(
            drop.rarity
          );

        rarityCounts[key] =
          (
            rarityCounts[key] ||
            0
          ) + 1;
      }
    );

    const predictions = [];

    for (
      let step = 0;
      step < amount;
      step += 1
    ) {
      const mainIndex =
        positiveModulo(
          mainCandidates[0] +
            split.regular.length +
            step,
          profile.mainSequence.length
        );

      const rarity =
        profile.mainSequence[
          mainIndex
        ];

      const rarityKey =
        compactNormalise(
          rarity
        );

      const rewardTrackKey =
        Object.keys(
          solution.rewards
        ).find(key =>
          compactNormalise(key) ===
          rarityKey
        );

      const rewardTrack =
        rewardTrackKey
          ? solution.rewards[
              rewardTrackKey
            ]
          : null;

      const rewardSequence =
        getRewardSequence(
          profile,
          rarity
        );

      let reward =
        "Reward position still narrowing";

      if (
        rewardTrack &&
        rewardTrack.candidates
          .length === 1 &&
        rewardSequence.length
      ) {
        const openedCount =
          rarityCounts[
            rarityKey
          ] ||
          0;

        const sameRarityAhead =
          predictions.filter(
            prediction =>
              valuesMatch(
                prediction.rarity,
                rarity
              )
          ).length;

        const rewardIndex =
          positiveModulo(
            rewardTrack
              .candidates[0] +
              openedCount +
              sameRarityAhead,
            rewardSequence.length
          );

        reward =
          rewardSequence[
            rewardIndex
          ];
      }

      predictions.push({
        number:
          step + 1,

        position:
          mainIndex + 1,

        rarity,

        reward,

        rewardCandidates:
          rewardTrack
            ?.candidates
            ?.length ||
          0
      });
    }

    return predictions;
  }

  function buildSequenceTable(
    chestType,
    eventOrProfile =
      activeEventId,
    limit = null
  ) {
    const profile =
      getProfile(
        chestType,
        eventOrProfile
      );

    if (!profile) {
      return [];
    }

    const rewardCounters = {};

    const maximum =
      limit
        ? Math.min(
            Number(limit),
            profile.mainSequence
              .length
          )
        : profile.mainSequence
            .length;

    const rows = [];

    for (
      let index = 0;
      index < maximum;
      index += 1
    ) {
      const rarity =
        profile.mainSequence[
          index
        ];

      const rarityKey =
        compactNormalise(
          rarity
        );

      rewardCounters[
        rarityKey
      ] =
        rewardCounters[
          rarityKey
        ] ||
        0;

      const rewardSequence =
        getRewardSequence(
          profile,
          rarity
        );

      const reward =
        rewardSequence.length
          ? rewardSequence[
              positiveModulo(
                rewardCounters[
                  rarityKey
                ],
                rewardSequence.length
              )
            ]
          : "";

      rewardCounters[
        rarityKey
      ] += 1;

      rows.push({
        position:
          index + 1,
        rarity,
        reward,
        bonus: false
      });
    }

    return rows;
  }

  function buildBonusTable(
    chestType,
    eventOrProfile =
      activeEventId
  ) {
    const profile =
      getProfile(
        chestType,
        eventOrProfile
      );

    if (
      !profile ||
      !profile.bonusSequence.length
    ) {
      return [];
    }

    return profile.bonusSequence.map(
      (rarity, index) => ({
        position:
          index + 1,
        rarity,
        bonus: true
      })
    );
  }

  function databaseStatus() {
    const profiles =
      [...parsedProfiles.values()];

    return {
      activeEventId,
      activeChestType,

      gold:
        profiles.some(
          profile =>
            profile.chestType ===
            "gold"
        ),

      platinum:
        profiles.some(
          profile =>
            profile.chestType ===
            "platinum"
        ),

      loadedProfiles:
        profiles.map(
          profile => ({
            eventId:
              profile.eventId,

            chestType:
              profile.chestType,

            profileName:
              profile.profileName,

            rewards:
              unique([
                ...Object.values(
                  profile.rewardSequences
                ).flat(),

                ...(
                  profile.additionalRewards ||
                  []
                )
              ]).length,

            sequenceLength:
              profile.mainSequence
                .length
          })
        )
    };
  }

  global.addEventListener(
    "chest-companion-workbook-imported",
    event => {
      try {
        const profile =
          parseWorkbookProfile(
            event.detail
          );

        console.info(
          "[Chest Companion] Workbook profile parsed.",
          {
            event:
              profile.eventName,

            chest:
              profile.chestType,

            profile:
              profile.profileName,

            sequenceLength:
              profile.mainSequence
                .length,

            rewardCount:
              unique([
                ...Object.values(
                  profile.rewardSequences
                ).flat(),

                ...(
                  profile.additionalRewards ||
                  []
                )
              ]).length
          }
        );

        global.dispatchEvent(
          new CustomEvent(
            "chest-companion-predictor-ready",
            {
              detail: profile
            }
          )
        );
      } catch (error) {
        console.error(
          "[Chest Companion] Workbook parsing failed.",
          error
        );

        global.dispatchEvent(
          new CustomEvent(
            "chest-companion-predictor-error",
            {
              detail: {
                error,

                message:
                  error?.message ||
                  "The predictor workbook could not be parsed."
              }
            }
          )
        );
      }
    }
  );

  global.addEventListener(
    "chest-companion-event-changed",
    async event => {
      activeEventId =
        event.detail?.eventId ||
        "";

      if (!activeEventId) {
        return;
      }

      try {
        await Promise.all([
          loadProfile(
            "gold",
            activeEventId
          ),

          loadProfile(
            "platinum",
            activeEventId
          )
        ]);

        console.info(
          "[Chest Companion] Predictor profiles restored for event.",
          activeEventId
        );
      } catch (error) {
        console.error(
          "[Chest Companion] Predictor restoration failed.",
          error
        );
      }
    }
  );

  async function initialise() {
    activeEventId =
      global.ChestPredictorUpload
        ?.getSelectedEvent?.() ||
      "";

    if (activeEventId) {
      await Promise.all([
        loadProfile(
          "gold",
          activeEventId
        ),

        loadProfile(
          "platinum",
          activeEventId
        )
      ]);
    }

    console.info(
      "[Chest Companion] Uploaded workbook predictor engine ready.",
      databaseStatus()
    );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialise
    );
  } else {
    initialise();
  }

  global.ChestPredictorEngine =
    Object.freeze({
      activate,
      loadProfile,
      parseWorkbookProfile,
      getProfile,
      getRarities,
      getRewardCatalogue,
      getRewardSequence,
      findRewardRarity,
      cleanDrops,
      solve,
      findFirstMismatch,
      getLikelyCurrentPosition,
      predictUpcoming,
      buildSequenceTable,
      buildBonusTable,
      databaseStatus,
      getEventProfile,
      normalise
    });
})(window);