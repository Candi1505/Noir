(() => {
  "use strict";

  const release = {
    id: "misfitrise-wave-1",
    season: "Misfitrise",
    wave: 1,
    verifiedAt: "2026-08-27",
    branchCount: 12,
    logicalNodeCount: 558,
    preMythicKeyCount: 25,
    mythicUnlockKeys: 20,
    branches: [
      {
        slug: "brickscale",
        name: "Brickscale",
        type: "Legendary dragon",
        status: "current",
        logicalNodes: 100,
        completionCost: 19703,
        costLabel: "sigils",
        keyCheckpoints: [3050, 7325, 11475, 14625, 17128, 19503]
      },
      {
        slug: "mission-bonus",
        name: "Mission Bonus",
        type: "Mission",
        status: "current",
        logicalNodes: 71,
        completionCost: 18500,
        costLabel: "sigils",
        keyCheckpoints: [6600, 17850]
      },
      {
        slug: "base-boost",
        name: "Base Boost",
        type: "Base boost",
        status: "current",
        logicalNodes: 71,
        completionCost: 19500,
        costLabel: "sigils",
        keyCheckpoints: [3425, 5950, 8675, 12000, 16625, 19500]
      },
      {
        slug: "charged-volt-tower",
        name: "Charged Volt Tower",
        type: "Tower",
        status: "current",
        logicalNodes: 58,
        completionCost: 39000,
        costLabel: "sigils",
        keyCheckpoints: [6250, 12850, 19300, 25800, 32300, 38800]
      },
      {
        slug: "oddstitch",
        name: "Oddstitch",
        type: "Daily limited-time",
        status: "daily",
        logicalNodes: 78,
        completionCost: 0,
        costLabel: "free",
        keyCheckpoints: []
      },
      {
        slug: "cosmic-orrery",
        name: "Cosmic Orrery",
        type: "Tower",
        status: "current",
        logicalNodes: 29,
        completionCost: 15000,
        costLabel: "sigils",
        keyCheckpoints: [6400, 15000]
      },
      {
        slug: "bloodstone",
        name: "Bloodstone",
        type: "Tower",
        status: "current",
        logicalNodes: 49,
        completionCost: 39029,
        costLabel: "sigils",
        keyCheckpoints: [7925, 21640, 39029]
      },
      {
        slug: "patchmaw",
        name: "Patchmaw",
        type: "Mythic dragon",
        status: "mythic",
        logicalNodes: 39,
        completionCost: null,
        costLabel: "mixed costs after unlock",
        unlockKeys: 20,
        returnedKeys: 4,
        keyCheckpoints: []
      },
      {
        slug: "smirkle",
        name: "Smirkle",
        type: "Mythic dragon",
        status: "mythic",
        logicalNodes: 39,
        completionCost: null,
        costLabel: "mixed costs after unlock",
        unlockKeys: 20,
        returnedKeys: 4,
        keyCheckpoints: []
      },
      {
        slug: "urbanflare-division-reward",
        name: "Urbanflare Division Reward",
        type: "Prior-season redemption",
        status: "history",
        logicalNodes: 4,
        completionCost: 4,
        costLabel: "Division Coins",
        keyCheckpoints: []
      },
      {
        slug: "urbanflare-leaderboard-reward",
        name: "Urbanflare Leaderboard Reward",
        type: "Prior-season redemption",
        status: "history",
        logicalNodes: 10,
        completionCost: 8,
        costLabel: "Prestige Coins",
        keyCheckpoints: []
      },
      {
        slug: "urbanflare-redemption",
        name: "Urbanflare Redemption",
        type: "Prior-season redemption",
        status: "history",
        logicalNodes: 10,
        completionCost: null,
        costLabel: "5 keys + 5 ascension tokens",
        keyCheckpoints: []
      }
    ]
  };

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  window.OnyxSeasonData = deepFreeze(release);
})();
