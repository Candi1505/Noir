/* ============================================================
   ONYX COMMAND — CHEST INTELLIGENCE

   Event readiness, reward finder, chest budget, share cards and
   private on-device verification summaries. Reads only the
   sanitised event data already published to players.
   ============================================================ */

(function initialiseNoirChestTools(window, document) {
  "use strict";

  const CHEST_ORDER = ["gold", "platinum", "draconic", "freedom", "arcane", "super_sigil"];
  const CHEST_META = {
    gold: {
      label: "Gold", icon: "G", bonusEvery: 30,
      singleCost: 500, tenPackCost: 4000
    },
    platinum: {
      label: "Platinum", icon: "P", bonusEvery: 30,
      singleCost: 1350, tenPackCost: 12000
    },
    draconic: {
      label: "Draconic", icon: "D", bonusEvery: 30,
      singleCost: 1000, tenPackCost: 8000
    },
    freedom: {
      label: "Freedom", icon: "F", bonusEvery: 15,
      singleCost: 1350, tenPackCost: 12000
    },
    arcane: {
      label: "Arcane", icon: "A", bonusEvery: 15,
      singleCost: 1350, tenPackCost: 12000
    },
    super_sigil: {
      label: "Super Sigil", icon: "S", bonusEvery: 30,
      singleCost: 625, tenPackCost: 8000
    }
  };
  const EVENT_KEY = "noirChestToolsEvent";
  const VERIFICATION_KEY = "noirChestToolsVerification";
  const state = {
    view: "finder",
    query: "",
    chestType: "gold",
    currency: 12000,
    shareOpenings: 10
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(value, digits = 1) {
    return new Intl.NumberFormat("en-AU", {
      maximumFractionDigits: digits
    }).format(value);
  }

  function getContext() {
    const ratesApi = window.ChestDropRates;
    const eventData = ratesApi?.getEventData?.();

    if (!ratesApi || !eventData) {
      return null;
    }

    return {
      eventData,
      rates: ratesApi.calculateAllRates(eventData)
    };
  }

  function getEventName(eventData) {
    const candidates = [
      eventData?.event?.name,
      eventData?.event?.title,
      eventData?.eventName,
      eventData?.event,
      eventData?.title,
      eventData?.name
    ];
    return String(
      candidates.find(value => typeof value === "string" && value.trim()) ||
      "Current Event"
    ).trim();
  }

  function getEventIdentity(eventData) {
    const deckSignature = Object.keys(eventData?.decks || {})
      .sort()
      .map(key => {
        const deck = eventData.decks[key];
        if (!Array.isArray(deck)) return "";
        return [
          key,
          deck.length,
          ...deck.slice(0, 6),
          ...deck.slice(-6)
        ].join(":");
      })
      .join("|");
    let hash = 2166136261;

    for (let index = 0; index < deckSignature.length; index += 1) {
      hash ^= deckSignature.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }

    return [
      getEventName(eventData),
      (hash >>> 0).toString(16),
      ...CHEST_ORDER.map(type => {
        const chest = eventData?.chests?.[type] || {};
        return `${type}:${chest.deckLength || chest.length || ""}`;
      })
    ].join("|");
  }

  function looksTechnical(name) {
    const text = String(name || "").trim();
    return (
      !text ||
      text === "Unknown Reward" ||
      /^[a-z]+(?:[A-Z][a-zA-Z0-9]*){1,}$/.test(text) ||
      /^(?:chest|consumable|reward|drop|item)[_-]?\d+$/i.test(text) ||
      /[_]{1,}/.test(text) ||
      /^[A-Z]\d{2}Q\d/i.test(text)
    );
  }

  function inspectEvent(context = getContext()) {
    if (!context) {
      return {
        ready: false,
        eventName: "No event loaded",
        issues: ["No live event deck is available yet."],
        chests: {}
      };
    }

    const chests = {};
    const issues = [];

    CHEST_ORDER.forEach(chestType => {
      const meta = CHEST_META[chestType];
      const chest = context.rates?.[chestType];
      const regular = chest?.regular;
      const bonus = chest?.bonus;
      const regularRewards = regular?.rewards || [];
      const bonusRewards = bonus?.rewards || [];
      const technical = [...regularRewards, ...bonusRewards]
        .filter(reward => looksTechnical(reward.name))
        .map(reward => reward.name);
      const chestIssues = [];
      const chestWarnings = [];

      if (!regular?.rootKey || !regularRewards.length) {
        chestIssues.push("regular rewards missing");
      }
      if (!bonus?.rootKey || !bonusRewards.length) {
        if (chestType === "arcane" && regular?.rootKey && regularRewards.length) {
          chestWarnings.push(
            "bonus rewards remain unverified until the bonus is confirmed"
          );
        } else {
          chestIssues.push("bonus rewards missing");
        }
      }
      if (Math.abs(Number(regular?.probabilityTotal || 0) - 1) > 0.001) {
        chestIssues.push("regular chances incomplete");
      }
      if (
        bonusRewards.length &&
        Math.abs(Number(bonus?.probabilityTotal || 0) - 1) > 0.001
      ) {
        chestIssues.push("bonus chances incomplete");
      }
      if (technical.length) {
        chestIssues.push(`${technical.length} technical reward name(s)`);
      }

      chests[chestType] = {
        ready: chestIssues.length === 0,
        regularRewards: regularRewards.length,
        bonusRewards: bonusRewards.length,
        bonusEvery: chest?.bonusEvery || meta.bonusEvery,
        issues: chestIssues,
        warnings: chestWarnings
      };

      chestIssues.forEach(issue => {
        issues.push(`${meta.label}: ${issue}.`);
      });
    });

    return {
      ready: issues.length === 0,
      eventName: getEventName(context.eventData),
      issues,
      chests
    };
  }

  function recordEventChange(context = getContext()) {
    if (!context) return null;

    const identity = getEventIdentity(context.eventData);
    const eventName = getEventName(context.eventData);
    let previous = null;

    try {
      previous = JSON.parse(localStorage.getItem(EVENT_KEY) || "null");
      localStorage.setItem(EVENT_KEY, JSON.stringify({ identity, eventName }));
    } catch (error) {
      return null;
    }

    if (previous?.identity && previous.identity !== identity) {
      return {
        changed: true,
        previousName: previous.eventName || "Previous event",
        eventName
      };
    }
    return { changed: false, eventName };
  }

  function getRewardRows(context = getContext()) {
    if (!context) return [];

    const rows = [];
    CHEST_ORDER.forEach(chestType => {
      const chest = context.rates[chestType];
      ["regular", "bonus"].forEach(pool => {
        chest[pool].rewards.forEach(reward => {
          rows.push({
            chestType,
            chestLabel: CHEST_META[chestType].label,
            icon: CHEST_META[chestType].icon,
            pool,
            name: reward.name,
            amount: Number.isFinite(reward.amount) ? reward.amount : 1,
            probability: reward.probability
          });
        });
      });
    });
    return rows;
  }

  function findRewards(query, context = getContext()) {
    const wanted = String(query || "").trim().toLowerCase();
    const rows = getRewardRows(context);
    if (!wanted) return rows;
    return rows.filter(row =>
      `${row.name} ${row.chestLabel} ${row.pool}`.toLowerCase().includes(wanted)
    );
  }

  function expectedRewards(chestType, openings, context = getContext()) {
    if (!context || !context.rates[chestType]) return [];
    const chest = context.rates[chestType];
    const totals = new Map();

    function add(reward, multiplier, source) {
      const key = reward.name;
      const current = totals.get(key) || {
        name: reward.name,
        amount: 0,
        sources: new Set()
      };
      current.amount +=
        reward.probability *
        (Number.isFinite(reward.amount) ? reward.amount : 1) *
        multiplier;
      current.sources.add(source);
      totals.set(key, current);
    }

    chest.regular.rewards.forEach(reward => add(reward, openings, "regular"));
    const expectedBonuses = openings / chest.bonusEvery;
    chest.bonus.rewards.forEach(reward => add(reward, expectedBonuses, "bonus"));

    return [...totals.values()]
      .map(item => ({ ...item, sources: [...item.sources] }))
      .sort((left, right) => right.amount - left.amount);
  }

  function calculateBudget(currency, cost) {
    const available = Math.max(0, Number(currency) || 0);
    const each = Math.max(0, Number(cost) || 0);
    return each > 0 ? Math.floor(available / each) : 0;
  }

  function calculateChestBudget(currency, chestType) {
    const available = Math.max(0, Math.floor(Number(currency) || 0));
    const meta = CHEST_META[chestType] || CHEST_META.gold;
    const tenPacks = Math.floor(available / meta.tenPackCost);
    const afterPacks = available - tenPacks * meta.tenPackCost;
    const singles = Math.floor(afterPacks / meta.singleCost);
    const spent =
      tenPacks * meta.tenPackCost +
      singles * meta.singleCost;

    return {
      openings: tenPacks * 10 + singles,
      tenPacks,
      singles,
      spent,
      remaining: available - spent
    };
  }

  function calculateBudgetBonuses(chestType, regularOpenings) {
    const meta = CHEST_META[chestType] || CHEST_META.gold;
    const openings = Math.max(0, Math.floor(Number(regularOpenings) || 0));
    const engine = window.LivePredictorEngine;
    const rawProgress = engine?.getBonusProgress?.(chestType);
    const progressKnown =
      rawProgress !== null &&
      rawProgress !== undefined &&
      rawProgress !== "";

    if (progressKnown) {
      const progress = Math.max(
        0,
        Math.min(meta.bonusEvery - 1, Math.floor(Number(rawProgress) || 0))
      );
      const bonuses = Math.floor((progress + openings) / meta.bonusEvery);
      return {
        known: true,
        minimum: bonuses,
        maximum: bonuses,
        totalMinimum: openings + bonuses,
        totalMaximum: openings + bonuses
      };
    }

    const minimum = Math.floor(openings / meta.bonusEvery);
    const maximum = Math.floor(
      (openings + meta.bonusEvery - 1) / meta.bonusEvery
    );
    return {
      known: false,
      minimum,
      maximum,
      totalMinimum: openings + minimum,
      totalMaximum: openings + maximum
    };
  }

  function getBudgetPrediction(chestType, openings) {
    const engine = window.LivePredictorEngine;
    const safeOpenings = Math.max(0, Math.floor(Number(openings) || 0));

    if (!engine || !safeOpenings) {
      return {
        solved: false,
        confidence: 0,
        predictions: [],
        regularOpenings: safeOpenings,
        limited: false,
        bonusProgressKnown: false
      };
    }

    try {
      const status = engine.getChestStatus?.(chestType) || {};
      const solved = Boolean(status.solved) && Number(status.confidence) >= 100;
      const predictionCount = Math.min(safeOpenings, 100);
      let regularNumber = 0;
      const predictions = solved
        ? (engine.predictUpcoming?.(predictionCount, chestType) || [])
            .map(reward => {
              const isBonus = Boolean(reward.isBonus || reward.bonus);
              if (!isBonus) regularNumber += 1;
              return {
                ...reward,
                budgetRegularNumber: isBonus ? null : regularNumber
              };
            })
        : [];
      const bonusProgress = engine.getBonusProgress?.(chestType);

      return {
        solved,
        confidence: Number(status.confidence) || 0,
        predictions,
        regularOpenings: safeOpenings,
        limited: safeOpenings > 100,
        bonusProgressKnown:
          bonusProgress !== null &&
          bonusProgress !== undefined
      };
    } catch (error) {
      return {
        solved: false,
        confidence: 0,
        predictions: [],
        regularOpenings: safeOpenings,
        limited: false,
        bonusProgressKnown: false
      };
    }
  }

  function getVerificationSummary() {
    const summary = {};
    CHEST_ORDER.forEach(chestType => {
      let observations = [];
      let confidence = 0;
      try {
        observations =
          window.LivePredictorEngine?.getObservations?.(chestType) || [];
        confidence =
          Number(
            window.LivePredictorEngine?.getChestData?.(chestType)?.confidence
          ) || 0;
      } catch (error) {
        // Saved observations remain useful before the solver finishes loading.
      }
      summary[chestType] = {
        recorded: observations.length,
        solved: confidence >= 100,
        confidence
      };
    });

    try {
      localStorage.setItem(VERIFICATION_KEY, JSON.stringify(summary));
    } catch (error) {
      // This summary is optional and stays on the device.
    }
    return summary;
  }

  function renderReadinessBanner() {
    const banner = document.getElementById("noirReadinessBanner");
    if (!banner) return;

    const report = inspectEvent();
    const change = recordEventChange();
    const readyCount = Object.values(report.chests)
      .filter(chest => chest.ready).length;
    const chestCount = CHEST_ORDER.length;

    banner.classList.toggle("nct-not-ready", !report.ready);
    banner.innerHTML = `
      <div>
        <p class="eyebrow">EVENT CHECK</p>
        <strong>${report.ready ? "✓ Ready for players" : `${readyCount}/${chestCount} chests ready`}</strong>
        <small>${escapeHtml(report.eventName)} · Regular and bonus rewards checked</small>
      </div>
      <div class="nct-readiness-chests">
        ${CHEST_ORDER.map(type => {
          const chest = report.chests[type] || {};
          const meta = CHEST_META[type];
          return `
            <div class="${chest.ready ? "ready" : "warning"}">
              <span>${meta.icon}</span>
              <b>${meta.label}</b>
              <small>${
                chest.ready
                  ? chest.warnings?.length
                    ? "Deck ready · bonus unverified"
                    : "Ready"
                  : "Check needed"
              }</small>
              <em>${chest.regularRewards || 0} regular · ${chest.bonusRewards || 0} bonus</em>
            </div>
          `;
        }).join("")}
      </div>
      ${change?.changed ? `
        <p class="nct-event-change">
          New event detected: ${escapeHtml(change.eventName)}. Your previous
          event progress is protected separately.
        </p>
      ` : ""}
    `;
  }

  function renderFinder(context) {
    const rows = findRewards(state.query, context);
    return `
      <section class="nct-section">
        <label for="nctRewardSearch">What reward are you looking for?</label>
        <input id="nctRewardSearch" class="nct-input" type="search"
          value="${escapeHtml(state.query)}"
          placeholder="Try Dragon Shards, Sigils or Speedups">
        <p class="nct-help">
          Searches every regular and bonus chest reward in this event.
        </p>
        <div class="nct-result-list">
          ${rows.length ? rows.map(row => `
            <article class="nct-result">
              <div>
                <strong>${row.icon} ${escapeHtml(row.chestLabel)}</strong>
                <span class="nct-pill">${row.pool === "bonus" ? "BONUS" : "REGULAR"}</span>
              </div>
              <h3>${escapeHtml(row.name)}${row.amount !== 1 ? ` × ${formatNumber(row.amount, 0)}` : ""}</h3>
              <p>About ${formatNumber(row.probability * 100)}% chance in this ${row.pool} chest</p>
            </article>
          `).join("") : `
            <p class="nct-empty">That reward is not present in the current event decks.</p>
          `}
        </div>
      </section>
    `;
  }

  function renderBudget(context) {
    const budget = calculateChestBudget(state.currency, state.chestType);
    const openings = budget.openings;
    const expected = expectedRewards(state.chestType, openings, context).slice(0, 8);
    const prediction = getBudgetPrediction(state.chestType, openings);
    const meta = CHEST_META[state.chestType];
    const bonusEstimate = calculateBudgetBonuses(
      state.chestType,
      openings
    );
    const bonusText =
      bonusEstimate.minimum === bonusEstimate.maximum
        ? `${bonusEstimate.minimum} bonus chest${bonusEstimate.minimum === 1 ? "" : "s"}`
        : `${bonusEstimate.minimum}–${bonusEstimate.maximum} bonus chests`;
    const totalText =
      bonusEstimate.totalMinimum === bonusEstimate.totalMaximum
        ? `${bonusEstimate.totalMinimum} total reward${bonusEstimate.totalMinimum === 1 ? "" : "s"}`
        : `${bonusEstimate.totalMinimum}–${bonusEstimate.totalMaximum} total rewards`;
    return `
      <section class="nct-section">
        <article class="nct-budget-tip">
          <strong>Want to see what you should actually receive?</strong>
          <p>
            Complete your ${meta.label} chest predictions first if you want
            Onyx Command to estimate the rewards you’ll receive when spending your rubies.
          </p>
        </article>
        <div class="nct-fields">
          <label>Chest
            <select id="nctBudgetChest" class="nct-input">
              ${CHEST_ORDER.map(type => `
                <option value="${type}" ${type === state.chestType ? "selected" : ""}>
                  ${CHEST_META[type].label}
                </option>
              `).join("")}
            </select>
          </label>
          <label>Rubies available
            <input id="nctCurrency" class="nct-input" type="number" min="0"
              value="${state.currency}">
          </label>
          <div class="nct-price-guide">
            <span>Current ${meta.label} prices</span>
            <strong>1 for ${formatNumber(meta.singleCost, 0)} rubies</strong>
            <strong>10 for ${formatNumber(meta.tenPackCost, 0)} rubies</strong>
          </div>
        </div>
        <button id="nctCalculateBudget" type="button"
          class="nct-primary nct-calculate-budget">
          Calculate My Chest Budget
        </button>
        <article class="nct-budget-total">
          <span>Your rubies buy</span>
          <strong>${formatNumber(openings, 0)} regular ${meta.label} chest${openings === 1 ? "" : "s"}</strong>
          <small>
            ${budget.tenPacks} × 10-pack${budget.singles ? ` + ${budget.singles} single${budget.singles === 1 ? "" : "s"}` : ""}
            · ${formatNumber(budget.spent, 0)} rubies spent
            · ${formatNumber(budget.remaining, 0)} left
          </small>
          <strong class="nct-budget-grand-total">
            + ${bonusText} = ${totalText}
          </strong>
          <small>
            ${bonusEstimate.known
              ? "Calculated from your saved in-game bonus progress."
              : bonusEstimate.minimum === bonusEstimate.maximum
                ? `This total is exact because these openings complete full ${meta.bonusEvery}-chest bonus cycles.`
                : `Enter your bonus progress in Live Predictor for an exact total. ${meta.label} awards a bonus every ${meta.bonusEvery} regular chests.`}
          </small>
        </article>
        ${prediction.solved && prediction.predictions.length ? `
          <div class="nct-prediction-heading">
            <div>
              <p class="eyebrow">YOUR SOLVED SEQUENCE</p>
              <h3>Predicted rewards</h3>
            </div>
            <span>100% confidence</span>
          </div>
          <p class="nct-help">
            These come from your saved ${meta.label} prediction—not general
            drop-rate averages. Viewing them does not move your sequence.
          </p>
          ${!prediction.bonusProgressKnown ? `
            <p class="nct-budget-warning">
              Enter your in-game bonus progress in Live Predictor to include
              the exact bonus-chest position.
            </p>
          ` : ""}
          ${prediction.limited ? `
            <p class="nct-budget-warning">
              Onyx Command displays the first 100 regular chest predictions at a time.
            </p>
          ` : ""}
          <div class="nct-predicted-list">
            ${prediction.predictions.map(reward => `
              <div class="${reward.isBonus || reward.bonus ? "bonus" : ""}">
                <span class="nct-predicted-number">
                  ${reward.isBonus || reward.bonus ? "BONUS" : reward.budgetRegularNumber}
                </span>
                <span>${escapeHtml(reward.name || reward.label || "Reward")}</span>
                <strong>${reward.amount === null || reward.amount === undefined
                  ? ""
                  : formatNumber(reward.amount, 0)}</strong>
              </div>
            `).join("")}
          </div>
        ` : `
          <h3>Estimated rewards</h3>
          <p class="nct-help">
            Your ${meta.label} sequence is not solved yet, so these are
            long-term averages—not guaranteed rewards.
          </p>
          <div class="nct-simple-list">
            ${expected.length ? expected.map(item => `
              <div><span>${escapeHtml(item.name)}</span><strong>About ${formatNumber(item.amount)}</strong></div>
            `).join("") : `<p class="nct-empty">Enter your rubies and current chest cost.</p>`}
          </div>
        `}
      </section>
    `;
  }

  function renderReadiness() {
    const report = inspectEvent();
    return `
      <section class="nct-section">
        <article class="nct-readiness-summary ${report.ready ? "ready" : "warning"}">
          <strong>${report.ready ? "✓ Ready for players" : "Needs attention"}</strong>
          <span>${escapeHtml(report.eventName)}</span>
          <p>${report.ready
            ? `All ${CHEST_ORDER.length} regular decks, available bonus decks, reward names and chance totals passed.`
            : "One or more event checks did not pass."}</p>
        </article>
        <div class="nct-check-grid">
          ${CHEST_ORDER.map(type => {
            const chest = report.chests[type] || {};
            const meta = CHEST_META[type];
            return `
              <article class="nct-check-card ${chest.ready ? "ready" : "warning"}">
                <strong>${meta.icon} ${meta.label}</strong>
                <span>${chest.ready ? "READY" : "CHECK"}</span>
                <p>${chest.regularRewards || 0} regular rewards</p>
                <p>${chest.bonusRewards || 0} bonus rewards</p>
                <p>Bonus after ${chest.bonusEvery || meta.bonusEvery}</p>
                ${chest.issues?.length ? `<small>${escapeHtml(chest.issues.join(", "))}</small>` : ""}
                ${chest.warnings?.length ? `<small>${escapeHtml(chest.warnings.join(", "))}</small>` : ""}
              </article>
            `;
          }).join("")}
        </div>
        ${report.issues.length ? `
          <div class="nct-warning-list">
            ${report.issues.map(issue => `<p>${escapeHtml(issue)}</p>`).join("")}
          </div>
        ` : ""}
      </section>
    `;
  }

  function buildShareText(context, openings) {
    const meta = CHEST_META[state.chestType];
    const eventName = getEventName(context.eventData);
    const rewards = expectedRewards(state.chestType, openings, context).slice(0, 5);
    return [
      `ONYX COMMAND`,
      `${eventName} · ${meta.label} Chest`,
      `Estimate for ${openings} regular chests`,
      ...rewards.map(item => `• ${item.name}: about ${formatNumber(item.amount)}`),
      `Bonus chest every ${meta.bonusEvery} regular openings`,
      `Long-term estimates — exact upcoming rewards are in Live Predictor.`
    ].join("\n");
  }

  function createShareCanvas(context, openings) {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1080;
    const ctx = canvas.getContext("2d");
    const meta = CHEST_META[state.chestType];
    const eventName = getEventName(context.eventData);
    const rewards = expectedRewards(state.chestType, openings, context).slice(0, 5);

    const gradient = ctx.createLinearGradient(0, 0, 1080, 1080);
    gradient.addColorStop(0, "#050505");
    gradient.addColorStop(1, "#1a1408");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1080, 1080);
    ctx.strokeStyle = "#d8b757";
    ctx.lineWidth = 4;
    ctx.strokeRect(45, 45, 990, 990);
    ctx.fillStyle = "#d8b757";
    ctx.font = "700 34px system-ui";
    ctx.fillText("O N Y X  ·  C O M M A N D", 90, 125);
    ctx.fillStyle = "#ffffff";
    ctx.font = "800 68px system-ui";
    ctx.fillText(`${meta.label} Chest`, 90, 230);
    ctx.fillStyle = "#aaa49a";
    ctx.font = "36px system-ui";
    ctx.fillText(eventName.slice(0, 42), 90, 290);
    ctx.fillStyle = "#ead078";
    ctx.font = "800 46px system-ui";
    ctx.fillText(`Estimate for ${openings} chests`, 90, 385);

    rewards.forEach((item, index) => {
      const y = 485 + index * 90;
      ctx.fillStyle = "#f4f1ea";
      ctx.font = "600 34px system-ui";
      ctx.fillText(item.name.slice(0, 34), 105, y);
      ctx.fillStyle = "#d8b757";
      ctx.textAlign = "right";
      ctx.fillText(`About ${formatNumber(item.amount)}`, 970, y);
      ctx.textAlign = "left";
    });

    ctx.fillStyle = "#8f8a81";
    ctx.font = "28px system-ui";
    ctx.fillText(`Bonus every ${meta.bonusEvery} regular openings`, 90, 970);
    return canvas;
  }

  async function shareCard() {
    const context = getContext();
    if (!context) return;
    const openings = Math.max(1, Math.floor(Number(state.shareOpenings) || 10));
    const canvas = createShareCanvas(context, openings);
    const text = buildShareText(context, openings);

    canvas.toBlob(async blob => {
      const file = blob
        ? new File([blob], "onyx-chest-summary.png", { type: "image/png" })
        : null;
      try {
        if (file && navigator.share && navigator.canShare?.({ files: [file] })) {
          await navigator.share({ title: "Onyx Command Chest Summary", text, files: [file] });
          return;
        }
      } catch (error) {
        if (error?.name === "AbortError") return;
      }

      const link = document.createElement("a");
      link.download = "onyx-chest-summary.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    }, "image/png");
  }

  function renderShare(context) {
    const summary = getVerificationSummary();
    const solved = Object.values(summary).filter(item => item.solved).length;
    return `
      <section class="nct-section">
        <label>Chest
          <select id="nctShareChest" class="nct-input">
            ${CHEST_ORDER.map(type => `
              <option value="${type}" ${type === state.chestType ? "selected" : ""}>
                ${CHEST_META[type].label}
              </option>
            `).join("")}
          </select>
        </label>
        <label>Number of chests
          <input id="nctShareOpenings" class="nct-input" type="number" min="1"
            value="${state.shareOpenings}">
        </label>
        <button id="nctShareButton" type="button" class="nct-primary">
          Create Share Card
        </button>
        <article class="nct-private-summary">
          <p class="eyebrow">PRIVATE TEST SUMMARY</p>
          <strong>${solved} of 4 chest predictors solved on this device</strong>
          <p>No player names, reward histories or test results are uploaded.</p>
          ${CHEST_ORDER.map(type => `
            <span>${CHEST_META[type].label}: ${summary[type].recorded} recorded${summary[type].solved ? " · solved" : ""}</span>
          `).join("")}
        </article>
      </section>
    `;
  }

  function render() {
    const overlay = document.getElementById("noirChestToolsOverlay");
    if (!overlay) return;
    const context = getContext();
    const labels = {
      finder: "Reward Finder",
      budget: "Chest Budget",
      share: "Share & Test Summary",
      readiness: "Event Readiness"
    };

    overlay.innerHTML = `
      <div class="nct-shell" role="dialog" aria-modal="true" aria-label="Chest Tools">
        <header class="nct-header">
          <div><p class="eyebrow">ONYX COMMAND · CHEST INTELLIGENCE</p><h2>${labels[state.view]}</h2></div>
          <button id="nctClose" class="nct-close" type="button" aria-label="Close">×</button>
        </header>
        <nav class="nct-tabs">
          ${Object.entries(labels).map(([key, label]) => `
            <button type="button" data-nct-view="${key}" class="${state.view === key ? "active" : ""}">
              ${label}
            </button>
          `).join("")}
        </nav>
        ${context
          ? state.view === "finder" ? renderFinder(context)
            : state.view === "budget" ? renderBudget(context)
            : state.view === "share" ? renderShare(context)
            : renderReadiness()
          : `<p class="nct-empty nct-empty-large">No current event data is available yet.</p>`}
      </div>
    `;

    overlay.querySelector("#nctClose")?.addEventListener("click", close);
    overlay.querySelectorAll("[data-nct-view]").forEach(button => {
      button.addEventListener("click", () => {
        state.view = button.dataset.nctView;
        render();
      });
    });
    overlay.querySelector("#nctRewardSearch")?.addEventListener("input", event => {
      state.query = event.target.value;
      render();
      const input = overlay.querySelector("#nctRewardSearch");
      input?.focus();
      input?.setSelectionRange(state.query.length, state.query.length);
    });
    overlay.querySelector("#nctBudgetChest")?.addEventListener("change", event => {
      state.chestType = event.target.value;
      render();
    });
    overlay.querySelector("#nctCurrency")?.addEventListener("change", event => {
      state.currency = Math.max(0, Number(event.target.value) || 0);
      render();
    });
    overlay.querySelector("#nctCalculateBudget")?.addEventListener("click", () => {
      state.chestType =
        overlay.querySelector("#nctBudgetChest")?.value || state.chestType;
      state.currency = Math.max(
        0,
        Number(overlay.querySelector("#nctCurrency")?.value) || 0
      );
      render();
    });
    overlay.querySelector("#nctShareChest")?.addEventListener("change", event => {
      state.chestType = event.target.value;
      render();
    });
    overlay.querySelector("#nctShareOpenings")?.addEventListener("change", event => {
      state.shareOpenings = Math.max(1, Number(event.target.value) || 10);
      render();
    });
    overlay.querySelector("#nctShareButton")?.addEventListener("click", shareCard);
  }

  function open(view) {
    if (["finder", "budget", "share", "readiness"].includes(view)) {
      state.view = view;
    }
    render();
    const overlay = document.getElementById("noirChestToolsOverlay");
    overlay?.classList.add("open");
    overlay?.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  }

  function close() {
    const overlay = document.getElementById("noirChestToolsOverlay");
    overlay?.classList.remove("open");
    overlay?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function installStyles() {
    if (document.getElementById("noirChestToolsStyles")) return;
    const style = document.createElement("style");
    style.id = "noirChestToolsStyles";
    style.textContent = `
      .nct-readiness-banner, .nct-launch {
        width: 100%; margin: 20px 0 0; border-radius: 24px; color: #eee9df;
        background: linear-gradient(135deg, rgba(15,35,28,.96), rgba(7,10,9,.98));
        border: 1px solid rgba(95,215,174,.46); padding: 24px; text-align: left;
        box-sizing: border-box;
      }
      .nct-readiness-banner { display: block; }
      .nct-readiness-banner strong { display: block; font-size: 21px; color: #79dfbc; }
      .nct-readiness-banner small { display: block; margin-top: 7px; color: #a9a49c; }
      .nct-readiness-banner.nct-not-ready { border-color: rgba(225,179,79,.55); background: linear-gradient(135deg, rgba(42,30,8,.96), rgba(8,8,7,.98)); }
      .nct-readiness-banner.nct-not-ready strong { color: #e6c469; }
      .nct-readiness-chests { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 9px; margin-top: 18px; }
      .nct-readiness-chests > div { min-width: 0; padding: 13px 10px; border: 1px solid rgba(91,205,165,.3); border-radius: 15px; background: rgba(0,0,0,.22); }
      .nct-readiness-chests span { margin-right: 4px; }
      .nct-readiness-chests b { font-size: 14px; }
      .nct-readiness-chests small { color: #73d9b5; font-size: 12px; font-weight: 800; }
      .nct-readiness-chests em { display: block; margin-top: 5px; color: #8f8a82; font-size: 11px; font-style: normal; }
      .nct-readiness-chests .warning small { color: #e1bb60; }
      .nct-event-change { margin: 14px 0 0; color: #f0d98f; }
      .nct-home-tools { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; margin-top: 20px; }
      .nct-launch { display: flex; justify-content: space-between; align-items: center; background: linear-gradient(135deg, rgba(29,20,6,.97), rgba(8,8,7,.98)); border-color: rgba(218,184,87,.42); }
      .nct-launch.nct-finder { border-color: rgba(151,103,176,.4); background: linear-gradient(135deg, rgba(48,25,58,.62), rgba(7,4,7,.98) 74%); }
      .nct-launch.nct-budget { border-color: rgba(87,135,177,.42); background: linear-gradient(135deg, rgba(24,43,62,.66), rgba(4,6,8,.98) 74%); }
      .nct-launch.nct-share { border-color: rgba(174,96,112,.4); background: linear-gradient(135deg, rgba(57,25,32,.62), rgba(8,4,5,.98) 74%); }
      .nct-launch.nct-finder .nct-launch-icon { color: #ae7fc3; }
      .nct-launch.nct-budget .nct-launch-icon { color: #75a9cf; }
      .nct-launch.nct-share .nct-launch-icon { color: #c17b8b; }
      .nct-home-tools .nct-launch { margin: 0; min-height: 138px; padding: 19px; }
      .nct-launch strong { display: block; font-size: 25px; }
      .nct-home-tools .nct-launch strong { font-size: 19px; }
      .nct-launch small { display: block; max-width: 520px; margin-top: 8px; color: #aaa49b; font-size: 16px; line-height: 1.45; }
      .nct-home-tools .nct-launch small { font-size: 13px; }
      .nct-launch-icon { color: #e2c469; font-size: 35px; }
      .nct-home-tools .nct-launch-icon { margin-left: 8px; font-size: 27px; }
      .nct-overlay { position: fixed; inset: 0; z-index: 10000; display: none; overflow-y: auto; background: rgba(0,0,0,.94); padding: 18px; box-sizing: border-box; }
      .nct-overlay.open { display: block; }
      .nct-shell { max-width: 920px; margin: 0 auto; color: #eee9df; }
      .nct-header { position: sticky; top: 0; z-index: 2; display: flex; justify-content: space-between; align-items: center; padding: 20px 0; background: #050505; }
      .nct-header h2 { margin: 4px 0 0; font-size: 30px; }
      .nct-close { width: 52px; height: 52px; border-radius: 50%; border: 1px solid #4a4844; background: #131313; color: white; font-size: 35px; }
      .nct-tabs { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 14px; }
      .nct-tabs button { white-space: nowrap; border: 1px solid #383632; background: #111; color: #aaa59d; padding: 12px 16px; border-radius: 999px; }
      .nct-tabs button.active { color: #0b0b09; background: #ddbf66; border-color: #ddbf66; font-weight: 800; }
      .nct-section { padding: 22px 0 50px; }
      .nct-section label { display: block; color: #ddd8ce; font-weight: 700; margin-bottom: 16px; }
      .nct-input { width: 100%; box-sizing: border-box; margin-top: 8px; padding: 15px; border-radius: 15px; border: 1px solid #373532; background: #101010; color: #f3eee5; font-size: 16px; }
      .nct-help { color: #969088; line-height: 1.5; }
      .nct-result-list { display: grid; grid-template-columns: repeat(2, minmax(0,1fr)); gap: 14px; margin-top: 20px; }
      .nct-result, .nct-check-card, .nct-private-summary { padding: 20px; border: 1px solid #34322f; border-radius: 20px; background: #0e0e0e; }
      .nct-result > div { display: flex; justify-content: space-between; align-items: center; }
      .nct-result h3 { margin: 18px 0 8px; }
      .nct-result p, .nct-check-card p { margin: 5px 0; color: #99938a; }
      .nct-pill { color: #e3c66e; font-size: 11px; letter-spacing: .12em; }
      .nct-fields { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      .nct-price-guide { margin-bottom: 16px; padding: 13px 15px; border: 1px solid #373532; border-radius: 15px; background: #101010; }
      .nct-price-guide span, .nct-price-guide strong { display: block; }
      .nct-price-guide span { margin-bottom: 6px; color: #918b82; font-size: 12px; }
      .nct-price-guide strong { color: #e4c76d; line-height: 1.45; }
      .nct-budget-tip { margin-bottom: 20px; padding: 19px; border: 1px solid rgba(222,191,100,.4); border-radius: 18px; background: rgba(57,42,8,.28); }
      .nct-budget-tip strong { color: #ead078; }
      .nct-budget-tip p { margin: 7px 0 0; color: #aaa49a; line-height: 1.5; }
      .nct-budget-total { padding: 26px; margin: 8px 0 28px; border-radius: 22px; border: 1px solid rgba(220,188,96,.48); background: rgba(54,40,8,.3); }
      .nct-budget-total span, .nct-budget-total small { display: block; color: #aaa49a; }
      .nct-budget-total strong { display: block; margin: 8px 0; color: #ecd178; font-size: 28px; }
      .nct-simple-list { border-top: 1px solid #302e2a; }
      .nct-simple-list div { display: flex; justify-content: space-between; gap: 20px; padding: 14px 4px; border-bottom: 1px solid #302e2a; }
      .nct-simple-list strong { color: #e2c569; text-align: right; }
      .nct-prediction-heading { display: flex; justify-content: space-between; align-items: center; gap: 15px; }
      .nct-prediction-heading h3 { margin: 5px 0 0; }
      .nct-prediction-heading > span { flex: 0 0 auto; padding: 8px 11px; border: 1px solid rgba(100,218,177,.4); border-radius: 999px; color: #79dfbc; font-size: 12px; font-weight: 800; }
      .nct-budget-warning { padding: 13px 15px; border-radius: 14px; background: rgba(70,48,4,.34); color: #e2c46b; line-height: 1.45; }
      .nct-predicted-list { max-height: 560px; overflow-y: auto; border-top: 1px solid #302e2a; }
      .nct-predicted-list > div { display: grid; grid-template-columns: 62px 1fr auto; align-items: center; gap: 12px; padding: 14px 4px; border-bottom: 1px solid #302e2a; }
      .nct-predicted-list > div.bonus { margin: 7px 0; padding: 14px 10px; border: 1px solid rgba(224,190,91,.46); border-radius: 13px; background: rgba(63,43,4,.3); }
      .nct-predicted-number { color: #8e8981; font-size: 12px; font-weight: 800; }
      .nct-predicted-list .bonus .nct-predicted-number, .nct-predicted-list strong { color: #e3c66d; }
      .nct-readiness-summary { padding: 24px; border-radius: 22px; border: 1px solid #3f3b33; }
      .nct-readiness-summary strong { display: block; font-size: 27px; color: #77dcb8; }
      .nct-readiness-summary.warning strong { color: #e6c169; }
      .nct-readiness-summary span { color: #bbb5ab; }
      .nct-check-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-top: 18px; }
      .nct-check-card { position: relative; }
      .nct-check-card > span { position: absolute; top: 18px; right: 18px; color: #73d9b5; font-size: 11px; letter-spacing: .12em; }
      .nct-check-card.warning > span, .nct-check-card.warning small { color: #e3be63; }
      .nct-warning-list { margin-top: 18px; padding: 18px; border: 1px solid rgba(226,189,94,.4); border-radius: 18px; color: #dbbf73; }
      .nct-primary { width: 100%; border: 0; border-radius: 18px; padding: 17px; background: #ddbf66; color: #090908; font-size: 17px; font-weight: 900; }
      .nct-calculate-budget { margin: 0 0 18px; }
      .nct-private-summary { margin-top: 24px; }
      .nct-private-summary strong { display: block; font-size: 20px; }
      .nct-private-summary p { color: #989289; }
      .nct-private-summary span { display: block; padding: 8px 0; border-top: 1px solid #292825; color: #ccc5ba; }
      .nct-empty { grid-column: 1 / -1; padding: 28px; border: 1px dashed #393632; border-radius: 18px; color: #9a948b; text-align: center; }
      .nct-empty-large { margin-top: 25vh; }
      @media (max-width: 680px) {
        .nct-result-list, .nct-check-grid, .nct-fields { grid-template-columns: 1fr; }
        .nct-readiness-chests { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        .nct-home-tools { grid-template-columns: 1fr; }
        .nct-home-tools .nct-launch { min-height: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  function install() {
    if (document.getElementById("noirChestToolsOverlay")) return;
    installStyles();

    const overlay = document.createElement("section");
    overlay.id = "noirChestToolsOverlay";
    overlay.className = "nct-overlay";
    overlay.setAttribute("aria-hidden", "true");
    document.body.appendChild(overlay);
  }

  const api = Object.freeze({
    inspectEvent,
    findRewards,
    expectedRewards,
    calculateBudget,
    calculateChestBudget,
    calculateBudgetBonuses,
    getBudgetPrediction,
    getVerificationSummary,
    getEventIdentity,
    renderReadinessBanner,
    open,
    close,
    install,
    getState: () => ({ ...state })
  });
  window.NoirChestTools = api;

  ["noir:event-imported", "chest-companion:event-published",
   "chest-companion-predictors-ready"].forEach(eventName => {
    window.addEventListener(eventName, () => {
      window.setTimeout(renderReadinessBanner, 0);
    });
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", install, { once: true });
  } else {
    install();
  }
})(window, document);
