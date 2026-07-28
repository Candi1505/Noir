/* ============================================================
   NOIR • I ZI — CHEST PLANNER

   Plain-English planning tools powered by the current event's
   regular and bonus chest distributions.
   ============================================================ */

(function initialiseChestPlanner(window, document) {
  "use strict";

  const CHEST_ORDER = [
    "gold",
    "platinum",
    "draconic",
    "freedom"
  ];

  const CHEST_META = {
    gold: { label: "Gold", icon: "◆" },
    platinum: { label: "Platinum", icon: "✦" },
    draconic: { label: "Draconic", icon: "🐉" },
    freedom: { label: "Freedom", icon: "🦅" }
  };

  const CATEGORIES = [
    {
      key: "sigils",
      label: "Urbanflare Sigils",
      test: name => /sigil/i.test(name)
    },
    {
      key: "tokens",
      label: "Egg Tokens",
      test: name => /egg token/i.test(name)
    },
    {
      key: "shards",
      label: "Dragon Shards",
      test: name =>
        /shards$/i.test(name) &&
        !/^(fire|ice) shards$/i.test(name)
    },
    {
      key: "speedups",
      label: "Speedups",
      test: name =>
        /speedup/i.test(name)
    }
  ];

  const state = {
    view: "recommend",
    reward: "",
    goal: 20000,
    owned: 0
  };

  let amountRenderTimer =
    null;

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatNumber(
    value,
    maximumFractionDigits = 1
  ) {
    return new Intl.NumberFormat(
      "en-AU",
      { maximumFractionDigits }
    ).format(value);
  }

  function getRates() {
    const dropRates =
      window.ChestDropRates;
    const eventData =
      dropRates?.getEventData?.();

    if (
      !dropRates ||
      !eventData
    ) {
      return null;
    }

    return {
      eventData,
      rates:
        dropRates.calculateAllRates(
          eventData
        )
    };
  }

  function normaliseName(name) {
    return String(name || "")
      .trim()
      .toLowerCase();
  }

  function getRewardNames(rates) {
    const names = new Set();

    CHEST_ORDER.forEach(chestType => {
      const chest =
        rates[chestType];

      [
        ...chest.regular.rewards,
        ...chest.bonus.rewards
      ].forEach(reward => {
        if (reward.name) {
          names.add(reward.name);
        }
      });
    });

    return [...names].sort(
      (left, right) =>
        left.localeCompare(right)
    );
  }

  function getRewardValue(
    reward
  ) {
    return Number.isFinite(
      reward.amount
    )
      ? reward.amount
      : 1;
  }

  function calculateExpectedForChest(
    chest,
    matcher
  ) {
    const regular =
      chest.regular.rewards
        .filter(reward =>
          matcher(reward.name)
        )
        .reduce(
          (total, reward) =>
            total +
            reward.probability *
              getRewardValue(reward),
          0
        );
    const bonusPerBonusChest =
      chest.bonus.rewards
        .filter(reward =>
          matcher(reward.name)
        )
        .reduce(
          (total, reward) =>
            total +
            reward.probability *
              getRewardValue(reward),
          0
        );
    const bonus =
      chest.bonusEvery > 0
        ? bonusPerBonusChest /
          chest.bonusEvery
        : 0;

    return {
      regular,
      bonus,
      perChest: regular + bonus,
      bonusPerBonusChest
    };
  }

  function rankForReward(
    rates,
    rewardName
  ) {
    const wanted =
      normaliseName(rewardName);

    return CHEST_ORDER
      .map(chestType => {
        const chest =
          rates[chestType];
        const expected =
          calculateExpectedForChest(
            chest,
            name =>
              normaliseName(name) ===
              wanted
          );

        return {
          chestType,
          chest,
          ...expected
        };
      })
      .sort(
        (left, right) =>
          right.perChest -
          left.perChest
      );
  }

  function getPlainResult(
    result
  ) {
    if (result.perChest <= 0) {
      return "Not available";
    }

    return (
      `About ${formatNumber(
        result.perChest * 10
      )} from 10 chests`
    );
  }

  function renderRankingCards(
    ranking,
    rewardName
  ) {
    return `
      <section class="cp-ranking">
        ${ranking.map((result, index) => {
          const meta =
            CHEST_META[
              result.chestType
            ];
          const winner =
            index === 0 &&
            result.perChest > 0;

          return `
            <article class="cp-result-card ${winner ? "winner" : ""}">
              <div class="cp-result-rank">
                <span>${winner ? "BEST CHOICE" : `#${index + 1}`}</span>
                <strong>${meta.icon} ${meta.label}</strong>
              </div>
              <p class="cp-result-main">
                ${getPlainResult(result)}
              </p>
              ${
                result.perChest > 0
                  ? `
                    <p class="cp-result-note">
                      Includes the average contribution from its
                      bonus chest every ${result.chest.bonusEvery}
                      regular openings.
                    </p>
                  `
                  : `
                    <p class="cp-result-note">
                      ${escapeHtml(rewardName)} is not contained in
                      this chest’s current regular or bonus rewards.
                    </p>
                  `
              }
            </article>
          `;
        }).join("")}
      </section>
    `;
  }

  function renderRecommend(
    rates,
    rewardNames
  ) {
    const ranking =
      rankForReward(
        rates,
        state.reward
      );
    const best =
      ranking[0];
    const bestMeta =
      CHEST_META[
        best.chestType
      ];

    return `
      <section class="cp-intro">
        <span>1</span>
        <div>
          <h3>What should I open?</h3>
          <p>
            Choose what you want. NOIR • I ZI compares regular and bonus
            rewards, then tells you the best chest.
          </p>
        </div>
      </section>

      <label class="cp-field">
        <span>I want more…</span>
        <select id="cpReward">
          ${rewardNames.map(name => `
            <option
              value="${escapeHtml(name)}"
              ${name === state.reward ? "selected" : ""}
            >
              ${escapeHtml(name)}
            </option>
          `).join("")}
        </select>
      </label>

      ${
        best.perChest > 0
          ? `
            <div class="cp-answer">
              <span>NOIR • I ZI RECOMMENDS</span>
              <strong>
                ${bestMeta.icon} Open ${bestMeta.label} Chests
              </strong>
              <p>
                They currently give the strongest average return
                for ${escapeHtml(state.reward)}.
              </p>
            </div>
          `
          : `
            <div class="cp-answer cp-answer-muted">
              <strong>Not in this event</strong>
              <p>
                This reward is not currently available from these
                four chests.
              </p>
            </div>
          `
      }

      ${renderRankingCards(
        ranking,
        state.reward
      )}
    `;
  }

  function renderGoal(
    rates,
    rewardNames
  ) {
    const ranking =
      rankForReward(
        rates,
        state.reward
      );
    const remaining =
      Math.max(
        0,
        state.goal -
          state.owned
      );

    return `
      <section class="cp-intro">
        <span>2</span>
        <div>
          <h3>Reach a resource goal</h3>
          <p>
            Tell NOIR • I ZI what you need and what you already have.
          </p>
        </div>
      </section>

      <div class="cp-goal-fields">
        <label class="cp-field">
          <span>Resource</span>
          <select id="cpGoalReward">
            ${rewardNames.map(name => `
              <option
                value="${escapeHtml(name)}"
                ${name === state.reward ? "selected" : ""}
              >
                ${escapeHtml(name)}
              </option>
            `).join("")}
          </select>
        </label>

        <label class="cp-field">
          <span>My goal</span>
          <input
            id="cpGoal"
            type="number"
            min="0"
            inputmode="numeric"
            value="${state.goal}"
          >
        </label>

        <label class="cp-field">
          <span>I already have</span>
          <input
            id="cpOwned"
            type="number"
            min="0"
            inputmode="numeric"
            value="${state.owned}"
          >
        </label>
      </div>

      <div class="cp-goal-status">
        <span>You still need</span>
        <strong>
          ${formatNumber(remaining, 0)}
          ${escapeHtml(state.reward)}
        </strong>
      </div>

      <section class="cp-ranking">
        ${ranking.map((result, index) => {
          const meta =
            CHEST_META[
              result.chestType
            ];
          const possible =
            result.perChest > 0;
          const required =
            remaining === 0
              ? 0
              : possible
                ? Math.ceil(
                    remaining /
                    result.perChest
                  )
                : null;

          return `
            <article class="cp-result-card ${index === 0 && possible ? "winner" : ""}">
              <div class="cp-result-rank">
                <span>${index === 0 && possible ? "FASTEST OPTION" : `#${index + 1}`}</span>
                <strong>${meta.icon} ${meta.label}</strong>
              </div>
              <p class="cp-result-main">
                ${
                  required === null
                    ? "Not available"
                    : required === 0
                      ? "Goal already reached 🙌🏻"
                      : `Around ${formatNumber(required, 0)} chests`
                }
              </p>
              <p class="cp-result-note">
                This is a long-term estimate using both regular and
                bonus rewards—not a guaranteed exact number.
              </p>
            </article>
          `;
        }).join("")}
      </section>
    `;
  }

  function renderValue(
    rates
  ) {
    const categoryResults =
      CATEGORIES.map(category => {
        const ranking =
          CHEST_ORDER
            .map(chestType => ({
              chestType,
              ...calculateExpectedForChest(
                rates[chestType],
                category.test
              )
            }))
            .sort(
              (left, right) =>
                right.perChest -
                left.perChest
            );

        return {
          ...category,
          ranking
        };
      });
    const wins =
      Object.fromEntries(
        CHEST_ORDER.map(
          chestType => [
            chestType,
            0
          ]
        )
      );

    categoryResults.forEach(
      category => {
        if (
          category.ranking[0]
            .perChest > 0
        ) {
          wins[
            category.ranking[0]
              .chestType
          ] += 1;
        }
      }
    );

    const mostVersatile =
      CHEST_ORDER
        .map(chestType => ({
          chestType,
          wins: wins[chestType]
        }))
        .sort(
          (left, right) =>
            right.wins -
            left.wins
        )[0];
    const versatileMeta =
      CHEST_META[
        mostVersatile.chestType
      ];
    const fastestBonus =
      [...CHEST_ORDER]
        .sort(
          (left, right) =>
            rates[left].bonusEvery -
            rates[right].bonusEvery
        )[0];
    const fastestMeta =
      CHEST_META[fastestBonus];

    return `
      <section class="cp-intro">
        <span>3</span>
        <div>
          <h3>Compare chest value</h3>
          <p>
            See which chest is strongest for the most popular goals.
          </p>
        </div>
      </section>

      <div class="cp-answer">
        <span>MOST VERSATILE THIS EVENT</span>
        <strong>
          ${versatileMeta.icon} ${versatileMeta.label} Chests
        </strong>
        <p>
          They win the most resource categories below. “Most
          versatile” does not pretend that different resources have
          the same value.
        </p>
      </div>

      <section class="cp-value-grid">
        ${categoryResults.map(category => {
          const best =
            category.ranking[0];
          const meta =
            CHEST_META[
              best.chestType
            ];

          return `
            <article class="cp-value-card">
              <span>BEST FOR</span>
              <h4>${escapeHtml(category.label)}</h4>
              <strong>${meta.icon} ${meta.label}</strong>
              <p>
                ${getPlainResult(best)}
              </p>
            </article>
          `;
        }).join("")}

        <article class="cp-value-card">
          <span>FASTEST BONUS</span>
          <h4>Bonus Chest Progress</h4>
          <strong>
            ${fastestMeta.icon} ${fastestMeta.label}
          </strong>
          <p>
            Bonus after
            ${rates[fastestBonus].bonusEvery}
            regular chests
          </p>
        </article>
      </section>
    `;
  }

  function render() {
    const overlay =
      document.getElementById(
        "chestPlannerOverlay"
      );
    const source =
      getRates();

    if (!overlay) {
      return;
    }

    if (!source) {
      overlay.innerHTML = `
        <div class="cp-shell">
          <header class="cp-header">
            <div>
              <p>CHEST COMPANION</p>
              <h2>Chest Planner</h2>
            </div>
            <button type="button" class="cp-close" aria-label="Close chest planner">×</button>
          </header>
          <div class="cp-empty">
            Live event data is still loading. Wait for the connected
            badge, then try again.
          </div>
        </div>
      `;
      attachEvents();
      return;
    }

    const rewardNames =
      getRewardNames(source.rates);

    if (
      !state.reward ||
      !rewardNames.includes(
        state.reward
      )
    ) {
      state.reward =
        rewardNames.find(name =>
          /sigil/i.test(name)
        ) ||
        rewardNames[0] ||
        "";
    }

    const content =
      state.view === "goal"
        ? renderGoal(
            source.rates,
            rewardNames
          )
        : state.view === "value"
          ? renderValue(
              source.rates
            )
          : renderRecommend(
              source.rates,
              rewardNames
            );

    overlay.innerHTML = `
      <div class="cp-shell">
        <header class="cp-header">
          <div>
            <p>CHEST COMPANION</p>
            <h2>Chest Planner</h2>
            <span>
              Simple answers using the current
              ${escapeHtml(source.eventData.event || "live")}
              event.
            </span>
          </div>
          <button type="button" class="cp-close" aria-label="Close chest planner">×</button>
        </header>

        <nav class="cp-tabs" aria-label="Chest planner tools">
          <button
            type="button"
            data-cp-view="recommend"
            class="${state.view === "recommend" ? "active" : ""}"
          >
            What should I open?
          </button>
          <button
            type="button"
            data-cp-view="goal"
            class="${state.view === "goal" ? "active" : ""}"
          >
            Reach a goal
          </button>
          <button
            type="button"
            data-cp-view="value"
            class="${state.view === "value" ? "active" : ""}"
          >
            Compare value
          </button>
        </nav>

        <main class="cp-content">
          ${content}
        </main>

        <p class="cp-footnote">
          Planner results are long-term estimates from the published
          event deck. Your exact upcoming rewards are shown only in
          Live Predictor.
        </p>
      </div>
    `;

    attachEvents();
  }

  function attachEvents() {
    const overlay =
      document.getElementById(
        "chestPlannerOverlay"
      );

    overlay
      ?.querySelector(".cp-close")
      ?.addEventListener(
        "click",
        close
      );

    overlay
      ?.querySelectorAll(
        "[data-cp-view]"
      )
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            state.view =
              button.dataset.cpView;
            render();
          }
        );
      });

    [
      "cpReward",
      "cpGoalReward"
    ].forEach(id => {
      overlay
        ?.querySelector(`#${id}`)
        ?.addEventListener(
          "change",
          event => {
            state.reward =
              event.target.value;
            render();
          }
        );
    });

    [
      {
        id: "cpGoal",
        key: "goal"
      },
      {
        id: "cpOwned",
        key: "owned"
      }
    ].forEach(field => {
      const input =
        overlay?.querySelector(
          `#${field.id}`
        );

      const saveValue =
        event => {
          state[field.key] =
            Math.max(
              0,
              Number(
                event.target.value
              ) || 0
            );
        };

      input?.addEventListener(
        "input",
        event => {
          saveValue(event);

          window.clearTimeout(
            amountRenderTimer
          );

          amountRenderTimer =
            window.setTimeout(
              render,
              300
            );
        }
      );

      input?.addEventListener(
        "change",
        event => {
          window.clearTimeout(
            amountRenderTimer
          );
          saveValue(event);
          render();
        }
      );
    });
  }

  function open() {
    const overlay =
      document.getElementById(
        "chestPlannerOverlay"
      );

    overlay?.classList.add("open");
    overlay?.setAttribute(
      "aria-hidden",
      "false"
    );
    document.body.classList.add(
      "cp-modal-open"
    );
    render();
  }

  function close() {
    const overlay =
      document.getElementById(
        "chestPlannerOverlay"
      );

    overlay?.classList.remove(
      "open"
    );
    overlay?.setAttribute(
      "aria-hidden",
      "true"
    );
    document.body.classList.remove(
      "cp-modal-open"
    );
  }

  function installStyles() {
    const style =
      document.createElement("style");

    style.id = "chestPlannerStyles";
    style.textContent = `
      .cp-modal-open { overflow: hidden; }
      .cp-launch {
        width: 100%;
        margin-top: 12px;
        padding: 20px;
        border: 1px solid rgba(86,184,159,.4);
        border-radius: 22px;
        color: #f6f1e7;
        background: linear-gradient(135deg, rgba(45,145,121,.18), rgba(10,10,10,.92));
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        text-align: left;
        cursor: pointer;
      }
      .cp-launch-copy { display: grid; gap: 4px; }
      .cp-launch-copy strong { font-size: 1.15rem; }
      .cp-launch-copy small { color: #b9b4aa; line-height: 1.45; }
      .cp-launch-icon { color: #7fd4bd; font-size: 1.65rem; }
      .cp-overlay {
        position: fixed;
        inset: 0;
        z-index: 10020;
        display: none;
        overflow-y: auto;
        padding: max(18px, env(safe-area-inset-top)) 16px max(28px, env(safe-area-inset-bottom));
        color: #f6f1e7;
        background:
          radial-gradient(circle at 10% 0%, rgba(62,173,143,.13), transparent 35%),
          rgba(3,3,3,.98);
      }
      .cp-overlay.open { display: block; }
      .cp-shell { width: min(1000px, 100%); margin: 0 auto; }
      .cp-header {
        display: flex;
        justify-content: space-between;
        gap: 18px;
        padding: 14px 0 20px;
        border-bottom: 1px solid rgba(127,212,189,.22);
      }
      .cp-header p {
        margin: 0;
        color: #7fd4bd;
        font-size: .72rem;
        font-weight: 850;
        letter-spacing: .2em;
      }
      .cp-header h2 { margin: 5px 0 7px; font-size: clamp(1.8rem, 5vw, 2.7rem); }
      .cp-header span { color: #99938b; line-height: 1.5; }
      .cp-close {
        width: 50px;
        height: 50px;
        flex: 0 0 50px;
        border: 1px solid rgba(255,255,255,.18);
        border-radius: 50%;
        color: #fff;
        background: rgba(255,255,255,.05);
        font-size: 2rem;
        cursor: pointer;
      }
      .cp-tabs {
        display: flex;
        gap: 8px;
        overflow-x: auto;
        padding: 17px 0;
      }
      .cp-tabs button {
        white-space: nowrap;
        padding: 11px 14px;
        border: 1px solid rgba(255,255,255,.13);
        border-radius: 999px;
        color: #aaa49b;
        background: rgba(255,255,255,.035);
        font-weight: 800;
        cursor: pointer;
      }
      .cp-tabs button.active {
        color: #08100e;
        border-color: #7fd4bd;
        background: linear-gradient(135deg, #9be3d0, #54b79d);
      }
      .cp-content { display: grid; gap: 14px; }
      .cp-intro {
        display: flex;
        gap: 13px;
        align-items: flex-start;
      }
      .cp-intro > span {
        width: 36px;
        height: 36px;
        display: grid;
        place-items: center;
        flex: 0 0 36px;
        border-radius: 50%;
        color: #08100e;
        background: #7fd4bd;
        font-weight: 900;
      }
      .cp-intro h3 { margin: 0 0 5px; font-size: 1.25rem; }
      .cp-intro p { margin: 0; color: #99938b; line-height: 1.5; }
      .cp-field { display: grid; gap: 7px; }
      .cp-field > span { color: #aaa49b; font-size: .82rem; }
      .cp-field select,
      .cp-field input {
        width: 100%;
        min-height: 48px;
        border: 1px solid rgba(255,255,255,.16);
        border-radius: 13px;
        padding: 0 13px;
        color: #fff;
        background: #111;
        font: inherit;
      }
      .cp-answer {
        padding: 18px;
        border: 1px solid rgba(127,212,189,.35);
        border-radius: 18px;
        background: rgba(46,139,115,.13);
      }
      .cp-answer > span { color: #7fd4bd; font-size: .68rem; font-weight: 900; letter-spacing: .15em; }
      .cp-answer > strong { display: block; margin-top: 7px; color: #b7f2e2; font-size: 1.35rem; }
      .cp-answer p { margin: 8px 0 0; color: #a6a098; line-height: 1.5; }
      .cp-answer-muted { border-color: rgba(255,255,255,.12); background: rgba(255,255,255,.03); }
      .cp-ranking {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 11px;
      }
      .cp-result-card,
      .cp-value-card {
        padding: 17px;
        border: 1px solid rgba(255,255,255,.1);
        border-radius: 17px;
        background: rgba(255,255,255,.035);
      }
      .cp-result-card.winner {
        border-color: rgba(127,212,189,.4);
        box-shadow: inset 0 0 0 1px rgba(127,212,189,.08);
      }
      .cp-result-rank { display: flex; justify-content: space-between; gap: 12px; }
      .cp-result-rank span { color: #77716a; font-size: .65rem; font-weight: 900; letter-spacing: .12em; }
      .cp-result-rank strong { color: #e8e2d8; }
      .cp-result-card.winner .cp-result-rank span { color: #7fd4bd; }
      .cp-result-main { margin: 15px 0 7px; color: #7fd4bd; font-size: 1.1rem; font-weight: 900; }
      .cp-result-note { margin: 0; color: #878179; font-size: .76rem; line-height: 1.5; }
      .cp-goal-fields {
        display: grid;
        grid-template-columns: 1.5fr 1fr 1fr;
        gap: 10px;
      }
      .cp-goal-status {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 15px 17px;
        border-radius: 15px;
        background: rgba(255,255,255,.04);
      }
      .cp-goal-status span { color: #99938b; }
      .cp-goal-status strong { color: #7fd4bd; text-align: right; }
      .cp-value-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 11px;
      }
      .cp-value-card > span { color: #77716a; font-size: .65rem; font-weight: 900; letter-spacing: .12em; }
      .cp-value-card h4 { margin: 7px 0 13px; font-size: 1.05rem; }
      .cp-value-card strong { color: #7fd4bd; font-size: 1.15rem; }
      .cp-value-card p { margin: 7px 0 0; color: #918b83; }
      .cp-footnote { margin: 18px 2px 4px; color: #77716a; font-size: .76rem; line-height: 1.55; }
      .cp-empty {
        margin-top: 20px;
        padding: 28px;
        border: 1px dashed rgba(255,255,255,.16);
        border-radius: 18px;
        color: #918b83;
        text-align: center;
      }
      @media (max-width: 720px) {
        .cp-ranking,
        .cp-value-grid { grid-template-columns: 1fr; }
        .cp-goal-fields { grid-template-columns: 1fr; }
        .cp-goal-status { display: grid; }
        .cp-goal-status strong { text-align: left; }
      }
    `;

    document.head.appendChild(
      style
    );
  }

  function install() {
    if (
      document.getElementById(
        "chestPlannerOverlay"
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
    launch.className = "cp-launch";
    launch.innerHTML = `
      <span class="cp-launch-copy">
        <strong>Chest Planner</strong>
        <small>
          Find the best chest, reach a resource goal and compare
          value.
        </small>
      </span>
      <span class="cp-launch-icon" aria-hidden="true">◎</span>
    `;
    launch.addEventListener(
      "click",
      open
    );

    const rateLaunch =
      document.querySelector(
        ".cdr-launch"
      );
    const chestGrid =
      document.querySelector(
        "#homeView .chest-grid"
      );

    if (rateLaunch) {
      rateLaunch.insertAdjacentElement(
        "afterend",
        launch
      );
    } else {
      chestGrid?.insertAdjacentElement(
        "afterend",
        launch
      );
    }

    const overlay =
      document.createElement(
        "section"
      );

    overlay.id = "chestPlannerOverlay";
    overlay.className = "cp-overlay";
    overlay.setAttribute(
      "aria-hidden",
      "true"
    );
    document.body.appendChild(
      overlay
    );
  }

  const api = Object.freeze({
    getRewardNames,
    calculateExpectedForChest,
    rankForReward,
    getRates,
    open,
    close,
    render,
    install,
    getState:
      () => ({ ...state })
  });

  window.ChestPlanner = api;

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
