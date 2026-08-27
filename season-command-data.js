(function () {
  "use strict";

  const season = {
    id: "misfitrise-wave-1-2026-08-27",
    name: "Misfitrise",
    wave: "Wave 1",
    capturedAt: "2026-08-27",
    status: "capture-verified",
    targetKeys: 20,
    capturedKeyCount: 25,
    note:
      "This capture verifies 25 keys across six currently available sigil branches. Later waves and mythic paths are not included yet.",
    branches: [
      {
        id: "brickscale",
        name: "Brickscale",
        nodes: 100,
        completionCost: 19703,
        keyCosts: [0, 3050, 7325, 11475, 14625, 17128, 19503]
      },
      {
        id: "mission-bonus",
        name: "Mission Bonus",
        nodes: 71,
        completionCost: 18500,
        keyCosts: [0, 6600, 17850]
      },
      {
        id: "base-boost",
        name: "Base Boost",
        nodes: 71,
        completionCost: 19500,
        keyCosts: [0, 3425, 5950, 8675, 12000, 16625, 19500]
      },
      {
        id: "charged-volt",
        name: "Charged Volt Tower",
        nodes: 58,
        completionCost: 39000,
        keyCosts: [0, 6250, 12850, 19300, 25800, 32300, 38800]
      },
      {
        id: "cosmic-orrery",
        name: "Cosmic Orrery",
        nodes: 29,
        completionCost: 15000,
        keyCosts: [0, 6400, 15000]
      },
      {
        id: "bloodstone",
        name: "Bloodstone",
        nodes: 49,
        completionCost: 39029,
        keyCosts: [0, 7925, 21640, 39029]
      }
    ]
  };

  function clampInteger(value, minimum, maximum) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return minimum;
    return Math.min(maximum, Math.max(minimum, parsed));
  }

  function normaliseProgress(progress = {}) {
    return Object.fromEntries(
      season.branches.map(branch => [
        branch.id,
        clampInteger(progress[branch.id], 0, branch.keyCosts.length - 1)
      ])
    );
  }

  function cheapestRoute(targetKeys = season.targetKeys, rawProgress = {}) {
    const progress = normaliseProgress(rawProgress);
    const currentKeys = season.branches.reduce(
      (total, branch) => total + progress[branch.id],
      0
    );
    const target = clampInteger(targetKeys, 0, season.capturedKeyCount);
    const additionalTarget = Math.max(0, target - currentKeys);
    let states = new Map([[0, { cost: 0, route: [] }]]);

    season.branches.forEach(branch => {
      const nextStates = new Map();
      const startingKeys = progress[branch.id];
      const maximumAdditional = branch.keyCosts.length - 1 - startingKeys;

      states.forEach((state, keysSoFar) => {
        for (let additionalKeys = 0; additionalKeys <= maximumAdditional; additionalKeys += 1) {
          const endingKeys = startingKeys + additionalKeys;
          const incrementalCost =
            branch.keyCosts[endingKeys] - branch.keyCosts[startingKeys];
          const totalAdditionalKeys = keysSoFar + additionalKeys;
          const totalCost = state.cost + incrementalCost;
          const existing = nextStates.get(totalAdditionalKeys);

          if (!existing || totalCost < existing.cost) {
            const route = state.route.slice();
            if (additionalKeys > 0) {
              route.push({
                branchId: branch.id,
                branchName: branch.name,
                fromKeys: startingKeys,
                toKeys: endingKeys,
                additionalKeys,
                cost: incrementalCost
              });
            }
            nextStates.set(totalAdditionalKeys, { cost: totalCost, route });
          }
        }
      });

      states = nextStates;
    });

    const candidates = Array.from(states.entries())
      .filter(([additionalKeys]) => additionalKeys >= additionalTarget)
      .sort((left, right) => {
        if (left[1].cost !== right[1].cost) return left[1].cost - right[1].cost;
        return left[0] - right[0];
      });

    if (!candidates.length) {
      return {
        possible: false,
        targetKeys: target,
        currentKeys,
        additionalKeys: 0,
        finalKeys: currentKeys,
        cost: null,
        route: [],
        progress
      };
    }

    const [additionalKeys, winner] = candidates[0];
    return {
      possible: true,
      targetKeys: target,
      currentKeys,
      additionalKeys,
      finalKeys: currentKeys + additionalKeys,
      cost: winner.cost,
      route: winner.route,
      progress
    };
  }

  window.OnyxSeasonData = Object.freeze({
    season: Object.freeze(season),
    cheapestRoute,
    normaliseProgress
  });
})();
