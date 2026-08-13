/* ============================================================
   NOIR CHEST COMPANION — CHEST DROP RATES

   Adds an event-specific drop-rate viewer alongside the live
   predictor. It reads only the sanitised event data already
   published for players.
   ============================================================ */

(function initialiseChestDropRates(window, document) {
  "use strict";

  const CHESTS = {
    gold: {
      label: "Gold",
      icon: "◆",
      mainKey: "gold_chest",
      bonusEvery: 30,
      bonusKeys: [
        "gold_chest_bonus",
        "gold_bonus_chest"
      ]
    },
    platinum: {
      label: "Platinum",
      icon: "✦",
      mainKey: "platinum_chest",
      bonusEvery: 30,
      bonusKeys: [
        "platinum_chest_bonus",
        "platinum_bonus_chest"
      ]
    },
    draconic: {
      label: "Draconic",
      icon: "🐉",
      mainKey: "dragfrag_chest_tier3",
      bonusEvery: 30,
      bonusKeys: [
        "dragfrag_chest_tier3_bonus",
        "dragfrag_bonus_chest_tier3"
      ]
    },
    freedom: {
      label: "Freedom",
      icon: "🦅",
      mainKey: "freedom_chest",
      bonusEvery: 15,
      bonusKeys: [
        "freedom_chest_bonus",
        "freedom_bonus_chest"
      ]
    },
    arcane: {
      label: "Arcane",
      icon: "🔮",
      mainKey: "arcane_chest",
      bonusEvery: 15,
      bonusKeys: [
        "arcane_chest_bonus",
        "arcane_bonus_chest"
      ]
    },
    super_sigil: {
      label: "Super Sigil",
      icon: "✨",
      mainKey: "sigil_chest",
      bonusEvery: 30,
      bonusKeys: ["Legendary_sigil_drop"]
    }
  };

  const DISPLAY_NAMES = {
    blackPearl: "Black Pearls",
    bloodstone: "Bloodstones",
    breedingToken: "Egg Tokens",
    cosmicCharge: "Cosmic Charge",
    electrumBar: "Electrum Bars",
    elementalEmber: "Elemental Embers",
    fireShard: "Fire Shards",
    fullHeal: "Healing Potions",
    iceShard: "Ice Shards",
    mysticFragment: "Mystic Fragments",
    urbanflareSigil: "Urbanflare Sigil",
    xpMultiplierSpellConsumable01: "Dragon XP Boost",
    xpMultiplierSpellConsumable02: "Dragon XP Boost",
    expediteConsumable1: "15 Min Speedup",
    expediteConsumable1a: "30 Min Speedup",
    expediteConsumable2: "1 Hr Speedup",
    expediteConsumable3: "3 Hr Speedup",
    expediteConsumable4: "12 Hr Speedup",
    energyPack: "Energy Packs",
    foodConsumable2: "Food Packs",
    cmCrystaldarkGemstone: "Dark Crafting Gemstones",
    cmCrystalearthGemstone: "Earth Crafting Gemstones",
    cmCrystalfireGemstone: "Fire Crafting Gemstones",
    cmCrystaliceGemstone: "Ice Crafting Gemstones",
    cmCrystalwindGemstone: "Wind Crafting Gemstones",
    increaseAttack1: "Dragon Attack Boost",
    increaseHP1: "Dragon HP Boost",
    increaseBuildingAttack1: "Tower Attack Boost",
    increaseBuildingHP1: "Tower HP Boost",
    innerFire01: "Inner Fire",
    innerFireConsumable: "Inner Fire",
    repairConsumable: "Defense Hammer",
    lumberConsumable2: "Lumber Packs",
    lumberPack_1400000: "1.4M Lumber Packs",
    chest0: "Bronze Chests",
    chest1: "Silver Chests",
    chest2: "Gold Chests",
    chest6: "Special Event Chests",
    chest8: "Super Sigil Bonus Chests",
    chest11: "Platinum Chests",
    chest27: "Draconic Chests",
    chest33: "Freedom Chests",
    chest37: "Arcane Chests",
    E24Q3InvokerDragonEvolutionFragment: "Orion Shards",
    E24Q4FestiveHunterDragonEvolutionFragment: "Razor Shards",
    E25Q1FestiveSorcererDragonEvolutionFragment: "Volcaryx Shards",
    E25Q2FestiveWarriorDragonEvolutionFragment: "Riphorn Shards",
    E25Q3FestiveWarriorDragonEvolutionFragment: "Eldrath Shards",
    E25Q4FestiveHunterDragonEvolutionFragment: "Drekgor Shards",
    E26Q1FestiveInvokerDragonEvolutionFragment: "Voltgar Shards",
    E26Q2FestiveHunterDragonEvolutionFragment: "Seasonal Hunter Shards"
  };

  const RARITY_ORDER = {
    Mythic: 0,
    Legendary: 1,
    Epic: 2,
    Rare: 3,
    Common: 4
  };

  const state = {
    chestType: "gold",
    mode: "regular",
    openings: 10,
    search: "",
    compare: false
  };

  function isObject(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      !Array.isArray(value)
    );
  }

  function clone(value) {
    return value === undefined
      ? undefined
      : JSON.parse(JSON.stringify(value));
  }

  function getEventData() {
    const direct =
      window.currentEventData;

    if (isObject(direct)) {
      return direct;
    }

    const published =
      window.ChestCompanionPublishedEvent;

    if (isObject(published)) {
      return (
        published.data ||
        published.eventData ||
        published
      );
    }

    try {
      const cached =
        JSON.parse(
          localStorage.getItem(
            "chestCompanionPublishedEvent"
          ) ||
          "null"
        );

      return (
        cached?.data ||
        cached?.eventData ||
        cached ||
        null
      );
    } catch (error) {
      return null;
    }
  }

  function getDefinitionNestedKey(
    definition,
    eventData
  ) {
    const candidates = [
      definition?.deck,
      definition?.deckKey,
      definition?.deck_key,
      definition?.pool,
      definition?.poolKey,
      definition?.pool_key,
      definition?.drop,
      definition?.dropKey,
      definition?.drop_key,
      definition?.rewardPool,
      definition?.reward_pool,
      definition?.key,
      definition?.id,
      definition?.value
    ];

    return (
      candidates.find(
        candidate =>
          typeof candidate === "string" &&
          Array.isArray(
            eventData?.decks?.[
              candidate
            ]
          )
      ) ||
      ""
    );
  }

  function getRewardName(
    definition
  ) {
    const code =
      definition?.code ||
      definition?.id ||
      "";

    return (
      DISPLAY_NAMES[code] ||
      definition?.name ||
      definition?.label ||
      definition?.displayName ||
      definition?.display_name ||
      definition?.rewardName ||
      definition?.reward_name ||
      code ||
      "Unknown Reward"
    );
  }

  function getRewardAmount(
    definition
  ) {
    const raw =
      definition?.amount ??
      definition?.mu ??
      definition?.quantity ??
      definition?.count ??
      definition?.qty ??
      null;
    const numeric =
      Number(raw);

    return Number.isFinite(numeric)
      ? numeric
      : null;
  }

  function getRewardRarity(
    definition,
    path = []
  ) {
    const value =
      definition?.drop_type ||
      definition?.dropType ||
      definition?.rarity ||
      [...path]
        .reverse()
        .find(
          key =>
            /mythic|legendary|epic|rare/i.test(
              key
            )
        ) ||
      "Other";
    const lower =
      String(value).toLowerCase();

    if (lower.includes("mythic")) {
      return "Mythic";
    }

    if (lower.includes("legendary")) {
      return "Legendary";
    }

    if (lower.includes("epic")) {
      return "Epic";
    }

    if (lower.includes("rare")) {
      return "Rare";
    }

    return "Other";
  }

  function resolveDistribution(
    eventData,
    rootKey
  ) {
    const rewards =
      new Map();
    const warnings = [];

    function walk(
      poolKey,
      probability,
      path = [],
      depth = 0
    ) {
      if (depth > 12) {
        warnings.push(
          `Reward route too deep at ${poolKey}.`
        );
        return;
      }

      const deck =
        eventData?.decks?.[
          poolKey
        ];
      const drops =
        eventData?.drops?.[
          poolKey
        ];

      if (
        !Array.isArray(deck) ||
        !deck.length ||
        !Array.isArray(drops)
      ) {
        warnings.push(
          `Missing reward data for ${poolKey}.`
        );
        return;
      }

      const frequencies =
        new Map();

      deck.forEach(value => {
        const key =
          JSON.stringify(value);

        frequencies.set(
          key,
          {
            value,
            count:
              (
                frequencies.get(key)
                  ?.count || 0
              ) + 1
          }
        );
      });

      frequencies.forEach(
        ({ value, count }) => {
          const definition =
            drops[value];

          if (!definition) {
            warnings.push(
              `Missing reward definition in ${poolKey}.`
            );
            return;
          }

          const branchProbability =
            probability *
            (
              count /
              deck.length
            );
          const nestedKey =
            getDefinitionNestedKey(
              definition,
              eventData
            );

          if (nestedKey) {
            walk(
              nestedKey,
              branchProbability,
              [
                ...path,
                poolKey
              ],
              depth + 1
            );
            return;
          }

          const code =
            definition.code ||
            definition.id ||
            getRewardName(
              definition
            );
          const amount =
            getRewardAmount(
              definition
            );
          const rarity =
            getRewardRarity(
              definition,
              [
                ...path,
                poolKey
              ]
            );
          const key = [
            code,
            amount ?? "",
            rarity
          ].join("::");
          const existing =
            rewards.get(key);

          if (existing) {
            existing.probability +=
              branchProbability;
            existing.routes += 1;
          } else {
            rewards.set(key, {
              key,
              code,
              name:
                getRewardName(
                  definition
                ),
              amount,
              rarity,
              probability:
                branchProbability,
              routes: 1
            });
          }
        }
      );
    }

    if (rootKey) {
      walk(rootKey, 1);
    }

    const entries =
      Array.from(
        rewards.values()
      )
        .map(reward => ({
          ...reward,
          probability:
            Math.max(
              0,
              Math.min(
                1,
                reward.probability
              )
            )
        }))
        .sort(
          (left, right) =>
            (
              RARITY_ORDER[
                left.rarity
              ] ?? 9
            ) -
              (
                RARITY_ORDER[
                  right.rarity
                ] ?? 9
              ) ||
            right.probability -
              left.probability ||
            left.name.localeCompare(
              right.name
            )
        );

    return {
      rootKey,
      rewards: entries,
      warnings:
        Array.from(
          new Set(warnings)
        ),
      probabilityTotal:
        entries.reduce(
          (total, reward) =>
            total +
            reward.probability,
          0
        )
    };
  }

  function findBonusRoot(
    eventData,
    chestType
  ) {
    const config =
      CHESTS[chestType];

    const verifiedPool =
      eventData?.chests?.[chestType]
        ?.bonusVerification;

    if (
      verifiedPool?.verified === true &&
      typeof verifiedPool?.poolKey === "string" &&
      Array.isArray(
        eventData?.decks?.[
          verifiedPool.poolKey
        ]
      )
    ) {
      return verifiedPool.poolKey;
    }

    const explicit =
      config.bonusKeys.find(
        key =>
          Array.isArray(
            eventData?.decks?.[
              key
            ]
          )
      );

    if (explicit) {
      return explicit;
    }

    const spinTypes =
      Array.isArray(
        eventData?.spinTypes
      )
        ? eventData.spinTypes
        : [];

    const bonusSpin =
      spinTypes.find(spinType => {
        const title =
          String(
            spinType?.title || ""
          ).toLowerCase();
        const position =
          Number(
            spinType?.position
          );

        return (
          title.includes(
            config.label.toLowerCase()
          ) &&
          position < 0
        );
      });
    const defaultDrops =
      bonusSpin?.drops?.default;

    if (isObject(defaultDrops)) {
      const key =
        Object.keys(
          defaultDrops
        ).find(
          candidate =>
            candidate !==
              config.mainKey &&
            Array.isArray(
              eventData?.decks?.[
                candidate
              ]
            )
        );

      if (key) {
        return key;
      }
    }

    const bulkKeys =
      (
        Array.isArray(
          bonusSpin?.bulk
        )
          ? bonusSpin.bulk
          : []
      )
        .flatMap(
          option =>
            Object.entries(
              option?.dropIDs ||
              option?.drop_ids ||
              {}
            )
        )
        .filter(
          ([candidate, amount]) =>
            candidate !==
              config.mainKey &&
            Number(amount) === 0 &&
            Array.isArray(
              eventData?.decks?.[
                candidate
              ]
            )
        )
        .map(
          ([candidate]) =>
            candidate
        );

    if (bulkKeys.length) {
      return bulkKeys[0];
    }

    return "";
  }

  function calculateChestRates(
    eventData,
    chestType
  ) {
    const config =
      CHESTS[chestType];
    const regular =
      resolveDistribution(
        eventData,
        config.mainKey
      );
    const bonusRoot =
      findBonusRoot(
        eventData,
        chestType
      );
    const bonus =
      resolveDistribution(
        eventData,
        bonusRoot
      );

    return {
      chestType,
      label: config.label,
      icon: config.icon,
      bonusEvery:
        config.bonusEvery,
      regular,
      bonus,
      ready:
        regular.rewards.length > 0,
      bonusReady:
        bonus.rewards.length > 0
    };
  }

  function calculateAllRates(
    eventData
  ) {
    return Object.fromEntries(
      Object.keys(CHESTS).map(
        chestType => [
          chestType,
          calculateChestRates(
            eventData,
            chestType
          )
        ]
      )
    );
  }

  function formatNumber(
    value,
    maximumFractionDigits = 2
  ) {
    return new Intl.NumberFormat(
      "en-AU",
      {
        maximumFractionDigits
      }
    ).format(value);
  }

  function formatPercent(
    probability
  ) {
    const percent =
      probability * 100;

    if (
      percent > 0 &&
      percent < 0.01
    ) {
      return "<0.01%";
    }

    return (
      `${formatNumber(
        percent,
        percent < 1
          ? 3
          : 2
      )}%`
    );
  }

  function formatOdds(
    probability
  ) {
    if (
      !Number.isFinite(probability) ||
      probability <= 0
    ) {
      return "Not expected";
    }

    if (probability >= 0.5) {
      return (
        `About ${Math.round(
          probability * 10
        )} in 10 chests`
      );
    }

    const oneIn =
      Math.max(
        1,
        Math.round(
          1 / probability
        )
      );

    return `About 1 in ${oneIn} chests`;
  }

  function getChanceLabel(
    probability
  ) {
    if (probability >= 0.1) {
      return "Very common";
    }

    if (probability >= 0.05) {
      return "Common";
    }

    if (probability >= 0.02) {
      return "Uncommon";
    }

    if (probability >= 0.01) {
      return "Rare";
    }

    return "Very rare";
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  function getRaritySummary(
    rewards
  ) {
    return rewards.reduce(
      (summary, reward) => {
        summary[
          reward.rarity
        ] =
          (
            summary[
              reward.rarity
            ] || 0
          ) +
          reward.probability;

        return summary;
      },
      {}
    );
  }

  function renderRewardCards(
    rewards
  ) {
    const search =
      state.search
        .trim()
        .toLowerCase();
    const filtered =
      rewards.filter(
        reward =>
          !search ||
          reward.name
            .toLowerCase()
            .includes(search) ||
          reward.rarity
            .toLowerCase()
            .includes(search)
      );

    if (!filtered.length) {
      return `
        <div class="cdr-empty">
          No matching rewards found.
        </div>
      `;
    }

    return filtered.map(reward => {
      const expectedDrops =
        reward.probability *
        state.openings;
      const expectedAmount =
        reward.amount === null
          ? null
          : expectedDrops *
            reward.amount;
      const expectedText =
        expectedAmount === null
          ? `${formatNumber(
              expectedDrops,
              1
            )} time(s)`
          : `${formatNumber(
              expectedAmount,
              1
            )} total`;

      return `
        <article class="cdr-reward-card cdr-${reward.rarity.toLowerCase()}">
          <div class="cdr-reward-heading">
            <div>
              <span class="cdr-rarity">
                ${escapeHtml(reward.rarity)}
              </span>
              <h4>
                ${escapeHtml(reward.name)}
              </h4>
            </div>
            <span class="cdr-chance-label">
              ${getChanceLabel(reward.probability)}
            </span>
          </div>

          <div class="cdr-plain-chance">
            <span>How often it appears</span>
            <strong>${formatOdds(reward.probability)}</strong>
            <small>${formatPercent(reward.probability)} chance each chest</small>
          </div>

          <div class="cdr-reward-details">
            <span>
              You receive
              <strong>
                ${
                  reward.amount === null
                    ? "Varies"
                    : formatNumber(reward.amount)
                }
              </strong>
            </span>

            <span>
              If you open ${state.openings}
              <strong>
                Around ${expectedText}
              </strong>
            </span>
          </div>

          <div class="cdr-rate-bar" aria-hidden="true">
            <span style="width:${Math.max(
              1,
              reward.probability * 100
            )}%"></span>
          </div>
        </article>
      `;
    }).join("");
  }

  function renderCompare(
    rates
  ) {
    return `
      <div class="cdr-explainer">
        <strong>Easy comparison</strong>
        <p>
          Each number below shows roughly how many of that reward
          tier you could see if you opened 100 regular chests.
        </p>
      </div>
      <section class="cdr-compare-grid">
        ${Object.values(rates).map(chest => {
          const regularSummary =
            getRaritySummary(
              chest.regular.rewards
            );
          const topReward =
            [...chest.regular.rewards]
              .sort(
                (left, right) =>
                  right.probability -
                  left.probability
              )[0];

          return `
            <article class="cdr-compare-card">
              <div class="cdr-compare-title">
                <span>${chest.icon}</span>
                <h3>${escapeHtml(chest.label)}</h3>
              </div>

              <p>
                ${chest.regular.rewards.length}
                regular reward variations
              </p>

              <dl>
                <div>
                  <dt>Epic in 100 chests</dt>
                  <dd>About ${Math.round((regularSummary.Epic || 0) * 100)}</dd>
                </div>
                <div>
                  <dt>Legendary in 100</dt>
                  <dd>About ${Math.round((regularSummary.Legendary || 0) * 100)}</dd>
                </div>
                <div>
                  <dt>Mythic in 100</dt>
                  <dd>About ${Math.round((regularSummary.Mythic || 0) * 100)}</dd>
                </div>
                <div>
                  <dt>Bonus chest</dt>
                  <dd>After ${chest.bonusEvery}</dd>
                </div>
              </dl>

              ${
                topReward
                  ? `
                    <p class="cdr-top-drop">
                      Most common:
                      <strong>
                        ${escapeHtml(topReward.name)}
                        — ${formatOdds(topReward.probability)}
                      </strong>
                    </p>
                  `
                  : ""
              }
            </article>
          `;
        }).join("")}
      </section>
    `;
  }

  function render() {
    const overlay =
      document.getElementById(
        "chestDropRatesOverlay"
      );

    if (!overlay) {
      return;
    }

    const eventData =
      getEventData();

    if (!eventData?.decks) {
      overlay.innerHTML = `
        <div class="cdr-shell">
          <header class="cdr-header">
            <div>
              <p class="cdr-eyebrow">CHEST COMPANION</p>
              <h2>Chest Drop Rates</h2>
            </div>
            <button class="cdr-close" type="button" aria-label="Close chest drop rates">×</button>
          </header>
          <div class="cdr-empty cdr-empty-large">
            Live event data is still loading. Close this screen,
            wait for the connected badge, then try again.
          </div>
        </div>
      `;
      attachOverlayEvents();
      return;
    }

    const rates =
      calculateAllRates(
        eventData
      );
    const chest =
      rates[
        state.chestType
      ];
    const distribution =
      state.mode === "bonus"
        ? chest.bonus
        : chest.regular;
    const raritySummary =
      getRaritySummary(
        distribution.rewards
      );

    overlay.innerHTML = `
      <div class="cdr-shell">
        <header class="cdr-header">
          <div>
            <p class="cdr-eyebrow">CHEST COMPANION</p>
            <h2>Chest Drop Rates</h2>
            <p>
              See what each chest can drop, compare reward chances
              and estimate what you could receive.
            </p>
          </div>
          <button class="cdr-close" type="button" aria-label="Close chest drop rates">×</button>
        </header>

        <nav class="cdr-chest-tabs" aria-label="Chest types">
          ${Object.entries(CHESTS).map(([chestType, config]) => `
            <button
              type="button"
              data-cdr-chest="${chestType}"
              class="${!state.compare && state.chestType === chestType ? "active" : ""}"
            >
              <span>${config.icon}</span>
              ${config.label}
            </button>
          `).join("")}
          <button
            type="button"
            data-cdr-compare
            class="${state.compare ? "active" : ""}"
          >
            ⇄ Compare
          </button>
        </nav>

        ${
          state.compare
            ? renderCompare(rates)
            : `
              <section class="cdr-controls">
                <div class="cdr-mode-toggle" role="group" aria-label="Reward type">
                  <button
                    type="button"
                    data-cdr-mode="regular"
                    class="${state.mode === "regular" ? "active" : ""}"
                  >
                    Regular Rewards
                  </button>
                  <button
                    type="button"
                    data-cdr-mode="bonus"
                    class="${state.mode === "bonus" ? "active" : ""}"
                    ${chest.bonusReady ? "" : "disabled"}
                  >
                    Bonus Rewards
                  </button>
                </div>

                <label class="cdr-opening-control">
                  If I open
                  <select id="cdrOpenings">
                    ${[1, 10, 50, 100].map(value => `
                      <option value="${value}" ${state.openings === value ? "selected" : ""}>
                        ${value} chest${value === 1 ? "" : "s"}
                      </option>
                    `).join("")}
                  </select>
                </label>

                <label class="cdr-search-control">
                  <span class="sr-only">Search rewards</span>
                  <input
                    id="cdrSearch"
                    type="search"
                    value="${escapeHtml(state.search)}"
                    placeholder="Search rewards"
                  >
                </label>
              </section>

              <div class="cdr-explainer">
                <strong>How to read this</strong>
                <p>
                  “About 1 in 10” means you would usually see that
                  reward once across many groups of 10 chests. It
                  is an average—not a promise that every group of
                  10 will contain one.
                </p>
              </div>

              <section class="cdr-summary">
                <article>
                  <span>Possible rewards</span>
                  <strong>${distribution.rewards.length} versions</strong>
                </article>
                <article>
                  <span>Epic rewards</span>
                  <strong>${formatOdds(raritySummary.Epic || 0)}</strong>
                  <small>${formatPercent(raritySummary.Epic || 0)} overall</small>
                </article>
                <article>
                  <span>Legendary rewards</span>
                  <strong>${formatOdds(raritySummary.Legendary || 0)}</strong>
                  <small>${formatPercent(raritySummary.Legendary || 0)} overall</small>
                </article>
                <article>
                  <span>Mythic rewards</span>
                  <strong>${formatOdds(raritySummary.Mythic || 0)}</strong>
                  <small>${formatPercent(raritySummary.Mythic || 0)} overall</small>
                </article>
              </section>

              ${
                state.mode === "bonus"
                  ? `
                    <div class="cdr-notice">
                      ${chest.label} awards a bonus after every
                      ${chest.bonusEvery} regular chests.
                    </div>
                  `
                  : ""
              }

              <section class="cdr-reward-grid">
                ${renderRewardCards(distribution.rewards)}
              </section>

              <p class="cdr-footnote">
                These are long-term averages calculated from the current
                ${escapeHtml(eventData.event || "live")} event deck.
                They do not tell you your next chest—use Live Predictor
                for your exact upcoming sequence.
              </p>
            `
        }
      </div>
    `;

    attachOverlayEvents();
  }

  function attachOverlayEvents() {
    const overlay =
      document.getElementById(
        "chestDropRatesOverlay"
      );

    overlay
      ?.querySelector(
        ".cdr-close"
      )
      ?.addEventListener(
        "click",
        close
      );

    overlay
      ?.querySelectorAll(
        "[data-cdr-chest]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            state.chestType =
              button.dataset.cdrChest;
            state.compare = false;
            state.search = "";
            render();
          }
        );
      });

    overlay
      ?.querySelector(
        "[data-cdr-compare]"
      )
      ?.addEventListener(
        "click",
        () => {
          state.compare = true;
          render();
        }
      );

    overlay
      ?.querySelectorAll(
        "[data-cdr-mode]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            state.mode =
              button.dataset.cdrMode;
            state.search = "";
            render();
          }
        );
      });

    overlay
      ?.querySelector(
        "#cdrOpenings"
      )
      ?.addEventListener(
        "change",
        event => {
          state.openings =
            Number(
              event.target.value
            ) || 10;
          render();
        }
      );

    overlay
      ?.querySelector(
        "#cdrSearch"
      )
      ?.addEventListener(
        "input",
        event => {
          state.search =
            event.target.value;
          render();

          const searchInput =
            document.getElementById(
              "cdrSearch"
            );

          searchInput?.focus();
          searchInput?.setSelectionRange(
            state.search.length,
            state.search.length
          );
        }
      );
  }

  function open() {
    const overlay =
      document.getElementById(
        "chestDropRatesOverlay"
      );

    if (!overlay) {
      return;
    }

    overlay.classList.add(
      "open"
    );
    overlay.setAttribute(
      "aria-hidden",
      "false"
    );
    document.body.classList.add(
      "cdr-modal-open"
    );
    render();
  }

  function close() {
    const overlay =
      document.getElementById(
        "chestDropRatesOverlay"
      );

    overlay?.classList.remove(
      "open"
    );
    overlay?.setAttribute(
      "aria-hidden",
      "true"
    );
    document.body.classList.remove(
      "cdr-modal-open"
    );
  }

  function installStyles() {
    if (
      document.getElementById(
        "chestDropRatesStyles"
      )
    ) {
      return;
    }

    const style =
      document.createElement(
        "style"
      );

    style.id =
      "chestDropRatesStyles";
    style.textContent = `
      .cdr-modal-open { overflow: hidden; }
      .cdr-launch {
        width: 100%;
        margin-top: 18px;
        padding: 20px;
        border: 1px solid rgba(218,181,93,.45);
        border-radius: 22px;
        color: #f6f1e7;
        background:
          linear-gradient(135deg, rgba(218,181,93,.16), rgba(10,10,10,.9));
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        text-align: left;
        cursor: pointer;
        box-shadow: 0 18px 50px rgba(0,0,0,.25);
      }
      .cdr-launch:hover { border-color: #dab55d; transform: translateY(-1px); }
      .cdr-launch-copy { display: grid; gap: 4px; }
      .cdr-launch-copy strong { font-size: 1.15rem; }
      .cdr-launch-copy small { color: #b9b4aa; line-height: 1.45; }
      .cdr-launch-icon { font-size: 1.65rem; color: #dab55d; }
      .cdr-overlay {
        position: fixed;
        inset: 0;
        z-index: 10000;
        display: none;
        overflow-y: auto;
        padding: max(18px, env(safe-area-inset-top)) 16px max(28px, env(safe-area-inset-bottom));
        background:
          radial-gradient(circle at 10% 0%, rgba(218,181,93,.12), transparent 35%),
          rgba(3,3,3,.97);
        color: #f6f1e7;
      }
      .cdr-overlay.open { display: block; }
      .cdr-shell { width: min(1120px, 100%); margin: 0 auto; }
      .cdr-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 20px;
        padding: 14px 0 22px;
        border-bottom: 1px solid rgba(218,181,93,.25);
      }
      .cdr-header h2 { margin: 4px 0 8px; font-size: clamp(1.8rem, 5vw, 2.8rem); }
      .cdr-header p { margin: 0; color: #aaa49a; line-height: 1.55; }
      .cdr-eyebrow { color: #dab55d !important; letter-spacing: .22em; font-size: .72rem; font-weight: 800; }
      .cdr-close {
        width: 50px;
        height: 50px;
        flex: 0 0 50px;
        border-radius: 50%;
        border: 1px solid rgba(255,255,255,.2);
        background: rgba(255,255,255,.05);
        color: #fff;
        font-size: 2rem;
        line-height: 1;
        cursor: pointer;
      }
      .cdr-chest-tabs {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding: 18px 0;
        scrollbar-width: none;
      }
      .cdr-chest-tabs button,
      .cdr-mode-toggle button {
        white-space: nowrap;
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 999px;
        padding: 11px 15px;
        background: rgba(255,255,255,.04);
        color: #bdb8af;
        font-weight: 750;
        cursor: pointer;
      }
      .cdr-chest-tabs button.active,
      .cdr-mode-toggle button.active {
        color: #0b0b0b;
        border-color: #dab55d;
        background: linear-gradient(135deg, #ead078, #bd913b);
      }
      .cdr-controls {
        display: grid;
        grid-template-columns: 1fr auto minmax(190px, .6fr);
        align-items: center;
        gap: 12px;
        margin-bottom: 16px;
      }
      .cdr-mode-toggle { display: flex; gap: 8px; }
      .cdr-opening-control {
        display: flex;
        align-items: center;
        gap: 9px;
        color: #aaa49a;
        font-size: .85rem;
      }
      .cdr-opening-control select,
      .cdr-search-control input {
        min-height: 44px;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 12px;
        background: #111;
        color: #fff;
        padding: 0 12px;
      }
      .cdr-search-control input { width: 100%; }
      .cdr-explainer {
        padding: 15px 17px;
        margin-bottom: 14px;
        border: 1px solid rgba(218,181,93,.3);
        border-radius: 16px;
        background: rgba(218,181,93,.08);
      }
      .cdr-explainer strong { color: #e4c66d; }
      .cdr-explainer p {
        margin: 7px 0 0;
        color: #b7b1a8;
        font-size: .86rem;
        line-height: 1.55;
      }
      .cdr-summary {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
        margin-bottom: 16px;
      }
      .cdr-summary article {
        padding: 15px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 16px;
        background: rgba(255,255,255,.035);
      }
      .cdr-summary span { display: block; color: #918c84; font-size: .76rem; margin-bottom: 7px; }
      .cdr-summary strong { display: block; color: #e4c66d; font-size: 1rem; }
      .cdr-summary small { display: block; color: #77726b; margin-top: 5px; font-size: .7rem; }
      .cdr-notice {
        padding: 13px 16px;
        margin-bottom: 14px;
        border: 1px solid rgba(92,210,166,.3);
        border-radius: 14px;
        background: rgba(31,116,85,.15);
        color: #9fe2c7;
      }
      .cdr-reward-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 12px;
      }
      .cdr-reward-card {
        position: relative;
        overflow: hidden;
        padding: 17px;
        border: 1px solid rgba(255,255,255,.11);
        border-radius: 18px;
        background: linear-gradient(145deg, rgba(255,255,255,.055), rgba(255,255,255,.018));
      }
      .cdr-reward-card::before {
        content: "";
        position: absolute;
        inset: 0 auto 0 0;
        width: 3px;
        background: #898989;
      }
      .cdr-mythic::before { background: #4da2ff; }
      .cdr-legendary::before { background: #e68b27; }
      .cdr-epic::before { background: #b55ce7; }
      .cdr-reward-heading { display: flex; justify-content: space-between; gap: 14px; align-items: flex-start; }
      .cdr-reward-heading h4 { margin: 4px 0 0; font-size: 1rem; }
      .cdr-rarity { color: #8f8a82; text-transform: uppercase; letter-spacing: .13em; font-size: .64rem; font-weight: 850; }
      .cdr-chance-label {
        flex: 0 0 auto;
        padding: 6px 9px;
        border: 1px solid rgba(218,181,93,.28);
        border-radius: 999px;
        color: #d8bd72;
        background: rgba(218,181,93,.08);
        font-size: .7rem;
        font-weight: 850;
      }
      .cdr-plain-chance {
        display: grid;
        gap: 3px;
        margin-top: 15px;
        padding: 12px;
        border-radius: 13px;
        background: rgba(255,255,255,.035);
      }
      .cdr-plain-chance span { color: #8f8a82; font-size: .7rem; }
      .cdr-plain-chance strong { color: #e4c66d; font-size: 1.06rem; }
      .cdr-plain-chance small { color: #77726b; font-size: .7rem; }
      .cdr-reward-details {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        margin: 15px 0 12px;
      }
      .cdr-reward-details span { color: #8f8a82; font-size: .74rem; }
      .cdr-reward-details strong { display: block; color: #f2eee7; margin-top: 5px; font-size: .92rem; }
      .cdr-rate-bar { height: 4px; border-radius: 999px; overflow: hidden; background: rgba(255,255,255,.08); }
      .cdr-rate-bar span { display: block; height: 100%; max-width: 100%; border-radius: inherit; background: linear-gradient(90deg, #9b7126, #e6c96d); }
      .cdr-footnote { color: #858078; font-size: .78rem; line-height: 1.55; margin: 18px 2px 6px; }
      .cdr-compare-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 13px;
      }
      .cdr-compare-card {
        padding: 20px;
        border: 1px solid rgba(255,255,255,.11);
        border-radius: 20px;
        background: rgba(255,255,255,.035);
      }
      .cdr-compare-title { display: flex; align-items: center; gap: 10px; }
      .cdr-compare-title h3 { margin: 0; }
      .cdr-compare-card > p { color: #979189; }
      .cdr-compare-card dl { margin: 15px 0; }
      .cdr-compare-card dl div {
        display: flex;
        justify-content: space-between;
        padding: 9px 0;
        border-bottom: 1px solid rgba(255,255,255,.07);
      }
      .cdr-compare-card dt { color: #969087; }
      .cdr-compare-card dd { margin: 0; color: #e4c66d; font-weight: 800; }
      .cdr-top-drop strong { color: #eee7d8; }
      .cdr-empty {
        grid-column: 1 / -1;
        padding: 28px;
        border: 1px dashed rgba(255,255,255,.18);
        border-radius: 18px;
        color: #918c84;
        text-align: center;
      }
      .cdr-empty-large { margin-top: 24px; }
      @media (max-width: 760px) {
        .cdr-controls { grid-template-columns: 1fr; }
        .cdr-mode-toggle { overflow-x: auto; }
        .cdr-opening-control { justify-content: space-between; }
        .cdr-summary { grid-template-columns: repeat(2, 1fr); }
        .cdr-reward-grid,
        .cdr-compare-grid { grid-template-columns: 1fr; }
        .cdr-reward-details { grid-template-columns: 1fr 1fr; }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function install() {
    if (
      document.getElementById(
        "chestDropRatesOverlay"
      )
    ) {
      return;
    }

    installStyles();

    const launch =
      document.createElement(
        "button"
      );

    launch.type = "button";
    launch.className =
      "cdr-launch";
    launch.innerHTML = `
      <span class="cdr-launch-copy">
        <strong>Chest Drop Rates</strong>
        <small>
          Compare rewards, chances and estimated returns
          for the current event.
        </small>
      </span>
      <span class="cdr-launch-icon" aria-hidden="true">％</span>
    `;
    launch.addEventListener(
      "click",
      open
    );

    const chestGrid =
      document.querySelector(
        "#homeView .chest-grid"
      );

    chestGrid?.insertAdjacentElement(
      "afterend",
      launch
    );

    const overlay =
      document.createElement(
        "section"
      );

    overlay.id =
      "chestDropRatesOverlay";
    overlay.className =
      "cdr-overlay";
    overlay.setAttribute(
      "aria-hidden",
      "true"
    );
    document.body.appendChild(
      overlay
    );
  }

  const api = Object.freeze({
    calculateAllRates,
    calculateChestRates,
    resolveDistribution,
    findBonusRoot,
    getEventData,
    open,
    close,
    render,
    install,
    getState:
      () => clone(state)
  });

  window.ChestDropRates =
    api;

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      install,
      { once: true }
    );
  } else {
    install();
  }
})(window, document);
