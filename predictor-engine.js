/* ============================================================
   CHEST COMPANION V2 — PREDICTOR ENGINE
   Built by Cherubim

   Reads:
   window.GOLD_CHEST_DATA
   window.PLATINUM_CHEST_DATA

   Supports:
   - Gold PvP
   - Gold Breeding
   - Platinum PvP
   - Platinum Breeding
   - Main rarity sequence
   - Reward sequences by rarity
   - Platinum bonus rarity sequence
   - Mismatch detection
   - Candidate positions
   - Upcoming reward predictions
   - Full sequence table
   ============================================================ */

(function initialiseChestPredictor(global) {
  "use strict";

  const SUPPORTED_CHESTS = ["gold", "platinum"];
  const SUPPORTED_PROFILES = ["pvp", "breeding"];

  function normalise(value) {
    return String(value ?? "")
      .trim()
      .toLowerCase()
      .replace(/×/g, "x")
      .replace(/[^a-z0-9+%]/g, "");
  }

  function unique(values) {
    return [...new Set(values)];
  }

  function positiveModulo(value, length) {
    if (!length) return 0;
    return ((value % length) + length) % length;
  }

  function getRawDatabase(chestType) {
  const chest = normalise(chestType);

  /*
   * Cloud data is now the preferred source.
   */
  const cloudDatabase =
    global.CHEST_DATA?.[chest];

  if (cloudDatabase) {
    return cloudDatabase;
  }

  /*
   * Legacy JavaScript databases remain only
   * as an optional offline fallback.
   */
  if (chest === "gold") {
    return (
      global.GOLD_CHEST_DATA ||
      global.GOLD_DATABASE ||
      null
    );
  }

  if (chest === "platinum") {
    return (
      global.PLATINUM_CHEST_DATA ||
      global.PLATINUM_DATABASE ||
      null
    );
  }

  if (chest === "draconic") {
    return (
      global.DRACONIC_CHEST_DATA ||
      global.DRACONIC_DATABASE ||
      null
    );
  }

  return null;
}

  function findProfile(database, profileName) {
    if (!database) return null;

    const key = normalise(profileName);

    const profiles =
      database.profiles ||
      database.eventProfiles ||
      database.data?.profiles ||
      {};

    return (
      profiles[key] ||
      profiles[profileName] ||
      profiles[
        Object.keys(profiles).find(
          profileKey => normalise(profileKey) === key
        )
      ] ||
      null
    );
  }

  function normaliseRewardSequences(profile) {
    const raw =
      profile?.rewardSequences ||
      profile?.rewards ||
      profile?.rewardSequence ||
      {};

    const result = {};

    Object.entries(raw).forEach(([rarity, sequence]) => {
      if (!Array.isArray(sequence)) return;

      result[rarity] = sequence
        .map(item => {
          if (typeof item === "string") return item;

          return (
            item?.display ||
            item?.reward ||
            item?.name ||
            item?.label ||
            ""
          );
        })
        .filter(Boolean);
    });

    return result;
  }

  function normaliseProfile(chestType, profileName) {
    const database = getRawDatabase(chestType);
    const rawProfile = findProfile(database, profileName);

    if (!database || !rawProfile) return null;

    const mainSequence =
      rawProfile.chestRaritySequence ||
      rawProfile.mainRaritySequence ||
      rawProfile.main ||
      rawProfile.raritySequence ||
      [];

    const bonusSequence =
      rawProfile.bonusRaritySequence ||
      rawProfile.bonusSequence ||
      rawProfile.bonus ||
      [];

    return {
      chestType: normalise(chestType),
      profileName: normalise(profileName),
      label:
        rawProfile.label ||
        `${String(profileName).toUpperCase()} ${String(chestType)}`,
      version:
        rawProfile.version ||
        database.source?.seasonWeek ||
        database.generatedAt ||
        "",
      mainSequence: Array.isArray(mainSequence)
        ? mainSequence.filter(Boolean)
        : [],
      bonusSequence: Array.isArray(bonusSequence)
        ? bonusSequence.filter(Boolean)
        : [],
      rewardSequences: normaliseRewardSequences(rawProfile),
      database
    };
  }

  function getProfile(chestType, profileName) {
    const chest = normalise(chestType);
    const profile = normalise(profileName);

    if (!SUPPORTED_CHESTS.includes(chest)) return null;
    if (!SUPPORTED_PROFILES.includes(profile)) return null;

    return normaliseProfile(chest, profile);
  }

  function getRewardSequence(profile, rarity) {
    if (!profile) return [];

    const target = normalise(rarity);

    const key = Object.keys(profile.rewardSequences).find(
      rarityName => normalise(rarityName) === target
    );

    return key ? profile.rewardSequences[key] : [];
  }

  function getRewardCatalogue(chestType, profileName, rarity = null) {
    const profile = getProfile(chestType, profileName);
    if (!profile) return [];

    if (rarity) {
      return unique(getRewardSequence(profile, rarity)).sort(
        (a, b) => a.localeCompare(b)
      );
    }

    return unique(
      Object.values(profile.rewardSequences).flat()
    ).sort((a, b) => a.localeCompare(b));
  }

  function getRarities(chestType, profileName) {
    const profile = getProfile(chestType, profileName);
    if (!profile) return [];

    return unique([
      ...profile.mainSequence,
      ...profile.bonusSequence,
      ...Object.keys(profile.rewardSequences)
    ]);
  }

  function sequenceMatchesAt(sequence, observations, startPosition) {
    if (!sequence.length || !observations.length) return false;

    return observations.every((observation, index) => {
      const sequenceValue =
        sequence[
          positiveModulo(startPosition + index, sequence.length)
        ];

      return normalise(sequenceValue) === normalise(observation);
    });
  }

  function findCircularMatches(sequence, observations) {
    if (!Array.isArray(sequence) || !sequence.length) return [];
    if (!Array.isArray(observations) || !observations.length) {
      return sequence.map((_, index) => index);
    }

    const candidates = [];

    for (let start = 0; start < sequence.length; start += 1) {
      if (sequenceMatchesAt(sequence, observations, start)) {
        candidates.push(start);
      }
    }

    return candidates;
  }

  function cleanDrops(drops) {
    if (!Array.isArray(drops)) return [];

    return drops
      .map((drop, index) => ({
        index,
        rarity:
          drop?.rarity ||
          drop?.sequence ||
          drop?.chestRarity ||
          "",
        reward:
          drop?.reward ||
          drop?.display ||
          drop?.prize ||
          "",
        bonus: Boolean(drop?.bonus)
      }))
      .filter(drop => drop.rarity || drop.reward);
  }

  function splitDrops(drops) {
    const cleaned = cleanDrops(drops);

    return {
      all: cleaned,
      regular: cleaned.filter(drop => !drop.bonus),
      bonus: cleaned.filter(drop => drop.bonus)
    };
  }

  function solveRaritySequence(profile, drops) {
    const split = splitDrops(drops);

    const mainObservations = split.regular.map(
      drop => drop.rarity
    );

    const bonusObservations = split.bonus.map(
      drop => drop.rarity
    );

    return {
      mainCandidates: findCircularMatches(
        profile.mainSequence,
        mainObservations
      ),
      bonusCandidates: profile.bonusSequence.length
        ? findCircularMatches(
            profile.bonusSequence,
            bonusObservations
          )
        : [],
      regularCount: split.regular.length,
      bonusCount: split.bonus.length
    };
  }

  function solveRewardSequences(profile, drops) {
    const split = splitDrops(drops);
    const result = {};

    Object.keys(profile.rewardSequences).forEach(rarity => {
      const observations = split.all
        .filter(
          drop =>
            normalise(drop.rarity) === normalise(rarity) &&
            drop.reward
        )
        .map(drop => drop.reward);

      result[rarity] = {
        observations,
        candidates: findCircularMatches(
          profile.rewardSequences[rarity],
          observations
        )
      };
    });

    return result;
  }

  function solve(chestType, profileName, drops) {
    const profile = getProfile(chestType, profileName);

    if (!profile) {
      return {
        available: false,
        matched: false,
        reason: "Predictor data is unavailable."
      };
    }

    const raritySolution = solveRaritySequence(profile, drops);
    const rewardSolutions = solveRewardSequences(profile, drops);

    const rewardMismatch = Object.values(rewardSolutions).some(
      solution =>
        solution.observations.length > 0 &&
        solution.candidates.length === 0
    );

    const mainMismatch =
      raritySolution.regularCount > 0 &&
      raritySolution.mainCandidates.length === 0;

    const bonusMismatch =
      raritySolution.bonusCount > 0 &&
      profile.bonusSequence.length > 0 &&
      raritySolution.bonusCandidates.length === 0;

    const matched = !(
      rewardMismatch ||
      mainMismatch ||
      bonusMismatch
    );

    const unresolvedTracks = [
      raritySolution.mainCandidates,
      ...Object.values(rewardSolutions)
        .filter(solution => solution.observations.length)
        .map(solution => solution.candidates)
    ];

    if (
      raritySolution.bonusCount &&
      profile.bonusSequence.length
    ) {
      unresolvedTracks.push(raritySolution.bonusCandidates);
    }

    const exactTracks = unresolvedTracks.filter(
      candidates => candidates.length === 1
    ).length;

    const totalTracks = unresolvedTracks.length;

    const confidence =
      !matched || !totalTracks
        ? 0
        : Math.round((exactTracks / totalTracks) * 100);

    return {
      available: true,
      matched,
      profile,
      rarity: raritySolution,
      rewards: rewardSolutions,
      confidence,
      exactTracks,
      totalTracks
    };
  }

  function findFirstMismatch(
    chestType,
    profileName,
    drops
  ) {
    const cleaned = cleanDrops(drops);

    for (let index = 0; index < cleaned.length; index += 1) {
      const partial = cleaned.slice(0, index + 1);
      const result = solve(chestType, profileName, partial);

      if (!result.matched) {
        return index + 1;
      }
    }

    return null;
  }

  function getLikelyCurrentPosition(solution) {
    if (!solution?.matched) return null;

    const candidates = solution.rarity.mainCandidates;

    if (candidates.length !== 1) return null;

    return positiveModulo(
      candidates[0] + solution.rarity.regularCount - 1,
      solution.profile.mainSequence.length
    );
  }

  function predictUpcoming(
    chestType,
    profileName,
    drops,
    amount = 5
  ) {
    const solution = solve(chestType, profileName, drops);

    if (!solution.available || !solution.matched) return [];

    const profile = solution.profile;
    const mainCandidates = solution.rarity.mainCandidates;

    if (mainCandidates.length !== 1) return [];

    const regularDrops = splitDrops(drops).regular;
    const rarityCounts = {};

    regularDrops.forEach(drop => {
      const key = normalise(drop.rarity);
      rarityCounts[key] = (rarityCounts[key] || 0) + 1;
    });

    const predictions = [];
    const mainStart = mainCandidates[0];

    for (let step = 0; step < amount; step += 1) {
      const mainIndex = positiveModulo(
        mainStart + regularDrops.length + step,
        profile.mainSequence.length
      );

      const rarity = profile.mainSequence[mainIndex];
      const rewardSolution =
        Object.entries(solution.rewards).find(
          ([rewardRarity]) =>
            normalise(rewardRarity) === normalise(rarity)
        )?.[1];

      const rewardSequence = getRewardSequence(
        profile,
        rarity
      );

      let reward = "Position still narrowing";

      if (
        rewardSolution &&
        rewardSolution.candidates.length === 1 &&
        rewardSequence.length
      ) {
        const usedBefore =
          rarityCounts[normalise(rarity)] || 0;

        const sameRarityPredictions = predictions.filter(
          item =>
            normalise(item.rarity) === normalise(rarity)
        ).length;

        const rewardIndex = positiveModulo(
          rewardSolution.candidates[0] +
            usedBefore +
            sameRarityPredictions,
          rewardSequence.length
        );

        reward = rewardSequence[rewardIndex];
      }

      predictions.push({
        number: step + 1,
        position: mainIndex + 1,
        rarity,
        reward
      });
    }

    return predictions;
  }

  function buildSequenceTable(
    chestType,
    profileName,
    limit = null
  ) {
    const profile = getProfile(chestType, profileName);
    if (!profile) return [];

    const rewardCounters = {};
    const rows = [];

    const maximum = limit
      ? Math.min(limit, profile.mainSequence.length)
      : profile.mainSequence.length;

    for (let index = 0; index < maximum; index += 1) {
      const rarity = profile.mainSequence[index];
      const key = normalise(rarity);

      rewardCounters[key] = rewardCounters[key] || 0;

      const rewardSequence = getRewardSequence(
        profile,
        rarity
      );

      const reward = rewardSequence.length
        ? rewardSequence[
            rewardCounters[key] % rewardSequence.length
          ]
        : "Reward unavailable";

      rewardCounters[key] += 1;

      rows.push({
        position: index + 1,
        rarity,
        reward,
        bonus: false
      });
    }

    return rows;
  }

  function buildBonusTable(chestType, profileName) {
    const profile = getProfile(chestType, profileName);
    if (!profile?.bonusSequence.length) return [];

    return profile.bonusSequence.map((rarity, index) => ({
      position: index + 1,
      rarity,
      bonus: true
    }));
  }

  function databaseStatus() {
    return {
      gold: Boolean(getRawDatabase("gold")),
      platinum: Boolean(getRawDatabase("platinum")),
      goldPvP: Boolean(getProfile("gold", "pvp")),
      goldBreeding: Boolean(
        getProfile("gold", "breeding")
      ),
      platinumPvP: Boolean(
        getProfile("platinum", "pvp")
      ),
      platinumBreeding: Boolean(
        getProfile("platinum", "breeding")
      )
    };
  }

  global.ChestPredictorEngine = Object.freeze({
    getProfile,
    getRarities,
    getRewardCatalogue,
    getRewardSequence,
    solve,
    findFirstMismatch,
    getLikelyCurrentPosition,
    predictUpcoming,
    buildSequenceTable,
    buildBonusTable,
    databaseStatus,
    normalise
  });

  console.info(
    "[Chest Companion] Predictor engine ready.",
    databaseStatus()
  );
})(window);