/* ============================================================
   CHEST COMPANION BETA — PREDICTOR UI
   Part 1 of 2
   Built by Cherubim

   Requires:
   - data/gold.js
   - data/platinum.js
   - predictor-engine.js

   This file must load after app.js.
   ============================================================ */

(function initialiseChestPredictorUI(window) {
  "use strict";

  const Engine = window.ChestPredictorEngine;

  if (!Engine) {
    console.error(
      "[Chest Companion] predictor-engine.js did not load."
    );
    return;
  }

  const STORAGE_KEY = "chestCompanionBetaPredictor";

  const defaultState = {
    chestType: "gold",
    profileName: "breeding",
    selectedRarity: "",
    sequenceVisible: false,
    drops: {
      gold: {
        breeding: [],
        pvp: []
      },
      platinum: {
        breeding: [],
        pvp: []
      }
    }
  };

  let state = loadState();

  function cloneDefaultState() {
    return JSON.parse(JSON.stringify(defaultState));
  }

  function loadState() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(STORAGE_KEY) || "{}"
      );

      const fresh = cloneDefaultState();

      return {
        ...fresh,
        ...saved,
        drops: {
          gold: {
            breeding:
              saved?.drops?.gold?.breeding || [],
            pvp:
              saved?.drops?.gold?.pvp || []
          },
          platinum: {
            breeding:
              saved?.drops?.platinum?.breeding || [],
            pvp:
              saved?.drops?.platinum?.pvp || []
          }
        }
      };
    } catch (error) {
      console.warn(
        "[Chest Companion] Could not restore predictor state.",
        error
      );

      return cloneDefaultState();
    }
  }

  function saveState() {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(state)
    );
  }

  function currentDrops() {
    return (
      state.drops[state.chestType][state.profileName] ||
      []
    );
  }

  function setCurrentDrops(drops) {
    state.drops[state.chestType][state.profileName] =
      drops;

    saveState();
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(
      /[&<>"']/g,
      character =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
        })[character]
    );
  }

  function titleCase(value) {
    const text = String(value || "");

    return text.charAt(0).toUpperCase() +
      text.slice(1);
  }

  function rarityClass(rarity) {
    const value = Engine.normalise(rarity);

    if (value === "mythic") {
      return "cc-rarity-mythic";
    }

    if (value === "legendary") {
      return "cc-rarity-legendary";
    }

    if (value === "epic") {
      return "cc-rarity-epic";
    }

    if (value === "rare") {
      return "cc-rarity-rare";
    }

    if (value === "common") {
      return "cc-rarity-common";
    }

    return "";
  }

  function addPredictorStyles() {
    if (
      document.getElementById(
        "cc-predictor-styles"
      )
    ) {
      return;
    }

    const style = document.createElement("style");

    style.id = "cc-predictor-styles";

    style.textContent = `
      #ccPredictorOverlay {
        position: fixed;
        inset: 0;
        z-index: 99999;
        display: none;
        overflow-y: auto;
        padding:
          max(16px, env(safe-area-inset-top))
          12px
          max(30px, env(safe-area-inset-bottom));
        background:
          radial-gradient(
            circle at 75% -10%,
            rgba(121, 61, 190, .44),
            transparent 36%
          ),
          rgba(7, 2, 14, .98);
        color: #fff;
        font-family:
          Inter,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      #ccPredictorOverlay.cc-open {
        display: block;
      }

      .cc-shell {
        width: min(100%, 760px);
        margin: 0 auto;
      }

      .cc-topbar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 0 16px;
        background: rgba(8, 2, 16, .94);
        backdrop-filter: blur(14px);
      }

      .cc-topbar h1 {
        margin: 0;
        font-size: 25px;
      }

      .cc-topbar p {
        margin: 4px 0 0;
        color: #cdbde0;
        font-size: 12px;
      }

      .cc-close {
        flex: 0 0 auto;
        width: 44px;
        height: 44px;
        border: 1px solid #674185;
        border-radius: 50%;
        background: #241232;
        color: #fff;
        font-size: 26px;
        cursor: pointer;
      }

      .cc-card {
        margin-bottom: 14px;
        padding: 18px;
        border: 1px solid #4e3165;
        border-radius: 22px;
        background:
          linear-gradient(
            145deg,
            rgba(42, 19, 61, .98),
            rgba(20, 8, 33, .98)
          );
        box-shadow:
          0 18px 45px rgba(0, 0, 0, .28);
      }

      .cc-card h2,
      .cc-card h3 {
        margin: 0 0 8px;
      }

      .cc-muted {
        color: #c3b1d4;
        line-height: 1.45;
      }

      .cc-selector-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 9px;
      }

      .cc-selector,
      .cc-rarity-button,
      .cc-reward-button,
      .cc-action {
        appearance: none;
        border: 1px solid #5a3974;
        border-radius: 15px;
        background: #13091f;
        color: #fff;
        padding: 13px 12px;
        font: inherit;
        font-weight: 750;
        cursor: pointer;
      }

      .cc-selector.cc-active {
        border-color: #c68cff;
        background:
          linear-gradient(
            145deg,
            #7136e8,
            #9b59e8
          );
        box-shadow:
          0 0 0 2px
          rgba(198, 140, 255, .16);
      }

      .cc-field-label {
        display: block;
        margin: 16px 0 8px;
        color: #decaf1;
        font-size: 13px;
        font-weight: 850;
      }

      .cc-rarity-grid {
        display: grid;
        grid-template-columns:
          repeat(3, minmax(0, 1fr));
        gap: 8px;
      }

      .cc-rarity-button.cc-active {
        outline: 2px solid #fff;
        outline-offset: 1px;
      }

      .cc-rarity-mythic {
        border-color: #ee8bff !important;
        background:
          rgba(157, 44, 183, .28) !important;
      }

      .cc-rarity-legendary {
        border-color: #ffc857 !important;
        background:
          rgba(164, 112, 22, .26) !important;
      }

      .cc-rarity-epic {
        border-color: #bc82ff !important;
        background:
          rgba(98, 52, 145, .30) !important;
      }

      .cc-rarity-rare {
        border-color: #71b7ff !important;
        background:
          rgba(46, 103, 164, .27) !important;
      }

      .cc-rarity-common {
        border-color: #c9d0da !important;
        background:
          rgba(119, 129, 143, .20) !important;
      }

      .cc-search {
        width: 100%;
        margin-bottom: 10px;
        border: 1px solid #54346c;
        border-radius: 15px;
        background: #0e0618;
        color: #fff;
        padding: 14px;
        font: inherit;
      }

      .cc-reward-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 8px;
        max-height: 390px;
        overflow-y: auto;
        padding-right: 3px;
      }

      .cc-reward-button {
        text-align: left;
        line-height: 1.3;
      }

      .cc-reward-button:active {
        transform: scale(.985);
      }

      .cc-bonus-row {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 13px;
        padding: 12px;
        border: 1px solid #55366c;
        border-radius: 15px;
        background: #11081c;
      }

      .cc-bonus-row input {
        width: 21px;
        height: 21px;
      }

      .cc-drop-list {
        display: grid;
        gap: 8px;
      }

      .cc-drop {
        display: grid;
        grid-template-columns:
          38px minmax(0, 1fr) 38px;
        gap: 9px;
        align-items: center;
        padding: 10px;
        border: 1px solid #432b58;
        border-radius: 15px;
        background: #100719;
      }

      .cc-drop-number {
        width: 32px;
        height: 32px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: #4a2767;
        font-weight: 900;
      }

      .cc-drop strong,
      .cc-drop small {
        display: block;
      }

      .cc-drop small {
        margin-top: 3px;
        color: #baa7cb;
      }

      .cc-remove {
        width: 36px;
        height: 36px;
        border: 0;
        border-radius: 50%;
        background: #3a1730;
        color: #ff9cb9;
        font-size: 21px;
        cursor: pointer;
      }

      .cc-actions {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 9px;
        margin-top: 13px;
      }

      .cc-action-primary {
        border-color: #a96dff;
        background:
          linear-gradient(
            145deg,
            #7136e8,
            #9b59e8
          );
      }

      .cc-action-danger {
        border-color: #854059;
        background: #351322;
        color: #ffb0c7;
      }

      .cc-result-header {
        display: grid;
        grid-template-columns: 1fr auto;
        gap: 12px;
        align-items: center;
      }

      .cc-confidence {
        min-width: 80px;
        padding: 10px 12px;
        border: 1px solid #5d3b77;
        border-radius: 14px;
        background: #11081c;
        text-align: center;
      }

      .cc-confidence strong,
      .cc-confidence span {
        display: block;
      }

      .cc-confidence strong {
        font-size: 23px;
      }

      .cc-confidence span {
        color: #bda9cf;
        font-size: 11px;
      }

      .cc-status-good {
        color: #65e2b4;
      }

      .cc-status-warning {
        color: #ffe19a;
      }

      .cc-status-bad {
        color: #ff92af;
      }

      .cc-track-grid {
        display: grid;
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
        gap: 8px;
        margin-top: 12px;
      }

      .cc-track {
        padding: 11px;
        border: 1px solid #432b58;
        border-radius: 14px;
        background: #100719;
      }

      .cc-track span,
      .cc-track strong {
        display: block;
      }

      .cc-track span {
        color: #bba7cd;
        font-size: 11px;
      }

      .cc-track strong {
        margin-top: 4px;
        font-size: 14px;
      }

      .cc-prediction-list {
        display: grid;
        gap: 8px;
        margin-top: 12px;
      }

      .cc-prediction {
        display: grid;
        grid-template-columns:
          38px minmax(0, 1fr);
        gap: 10px;
        align-items: center;
        padding: 11px;
        border: 1px solid #432b58;
        border-radius: 15px;
        background: #100719;
      }

      .cc-prediction-number {
        width: 34px;
        height: 34px;
        display: grid;
        place-items: center;
        border-radius: 50%;
        background: #482471;
        font-weight: 900;
      }

      .cc-prediction strong,
      .cc-prediction small {
        display: block;
      }

      .cc-prediction small {
        margin-top: 3px;
        color: #bca9ce;
      }

      .cc-table-wrap {
        overflow-x: auto;
        max-height: 520px;
        overflow-y: auto;
        border: 1px solid #422a56;
        border-radius: 16px;
      }

      .cc-table {
        width: 100%;
        min-width: 520px;
        border-collapse: collapse;
      }

      .cc-table th {
        position: sticky;
        top: 0;
        z-index: 2;
        padding: 11px;
        background: #29143a;
        text-align: left;
        font-size: 12px;
      }

      .cc-table td {
        padding: 11px;
        border-top: 1px solid #382349;
        vertical-align: top;
      }

      .cc-table tr.cc-current-row {
        background:
          rgba(101, 226, 180, .12);
        box-shadow:
          inset 4px 0 #65e2b4;
      }

      .cc-table-position {
        font-weight: 900;
      }

      .cc-hidden {
        display: none !important;
      }

      #ccPredictorLauncher {
        position: fixed;
        right: 14px;
        bottom:
          calc(
            16px +
            env(safe-area-inset-bottom)
          );
        z-index: 9990;
        border: 1px solid #bd86ff;
        border-radius: 999px;
        background:
          linear-gradient(
            145deg,
            #7136e8,
            #9b59e8
          );
        color: #fff;
        padding: 12px 16px;
        font: inherit;
        font-weight: 900;
        box-shadow:
          0 12px 32px
          rgba(0, 0, 0, .38);
        cursor: pointer;
      }

      @media (max-width: 520px) {
        .cc-rarity-grid {
          grid-template-columns:
            repeat(2, minmax(0, 1fr));
        }

        .cc-track-grid {
          grid-template-columns: 1fr;
        }

        .cc-card {
          padding: 15px;
          border-radius: 19px;
        }
      }
    `;

    document.head.appendChild(style);
  }

  function createPredictorOverlay() {
    if (
      document.getElementById(
        "ccPredictorOverlay"
      )
    ) {
      return;
    }

    const overlay = document.createElement("div");

    overlay.id = "ccPredictorOverlay";

    overlay.innerHTML = `
      <div class="cc-shell">
        <header class="cc-topbar">
          <div>
            <h1 id="ccPredictorTitle">
              Chest Predictor
            </h1>

            <p id="ccPredictorSubtitle">
              Exact spreadsheet sequence data
            </p>
          </div>

          <button
            id="ccClosePredictor"
            class="cc-close"
            type="button"
            aria-label="Close predictor"
          >
            ×
          </button>
        </header>

        <section class="cc-card">
          <h2>Choose predictor</h2>

          <p class="cc-muted">
            Select the chest type and event profile
            that match the game.
          </p>

          <span class="cc-field-label">
            Chest type
          </span>

          <div
            id="ccChestSelectors"
            class="cc-selector-grid"
          ></div>

          <span class="cc-field-label">
            Event profile
          </span>

          <div
            id="ccProfileSelectors"
            class="cc-selector-grid"
          ></div>
        </section>

        <section class="cc-card">
          <h2>Record chest drop</h2>

          <p class="cc-muted">
            Choose the rarity, then tap the exact
            reward shown in the game.
          </p>

          <span class="cc-field-label">
            Rarity
          </span>

          <div
            id="ccRarityButtons"
            class="cc-rarity-grid"
          ></div>

          <span class="cc-field-label">
            Exact reward
          </span>

          <input
            id="ccRewardSearch"
            class="cc-search"
            type="search"
            placeholder="Search rewards"
            autocomplete="off"
          />

          <div
            id="ccRewardButtons"
            class="cc-reward-grid"
          ></div>

          <label
            id="ccBonusRow"
            class="cc-bonus-row"
          >
            <input
              id="ccBonusCheck"
              type="checkbox"
            />

            <span>
              This was a Platinum bonus chest
            </span>
          </label>
        </section>

        <section class="cc-card">
          <h2>Recorded drops</h2>

          <p
            id="ccDropCount"
            class="cc-muted"
          ></p>

          <div
            id="ccDropList"
            class="cc-drop-list"
          ></div>

          <div class="cc-actions">
            <button
              id="ccUndoDrop"
              class="cc-action"
              type="button"
            >
              Undo last
            </button>

            <button
              id="ccResetDrops"
              class="cc-action cc-action-danger"
              type="button"
            >
              Reset tracker
            </button>
          </div>
        </section>

        <section class="cc-card">
          <div class="cc-result-header">
            <div>
              <h2>Sequence result</h2>

              <p
                id="ccSolverMessage"
                class="cc-muted"
              ></p>
            </div>

            <div class="cc-confidence">
              <strong id="ccConfidence">
                0%
              </strong>

              <span>confidence</span>
            </div>
          </div>

          <div
            id="ccTrackGrid"
            class="cc-track-grid"
          ></div>
        </section>

        <section class="cc-card">
          <h2>Upcoming rewards</h2>

          <div
            id="ccPredictionList"
            class="cc-prediction-list"
          ></div>
        </section>

        <section class="cc-card">
          <h2>Full sequence table</h2>

          <p class="cc-muted">
            View the complete rarity and reward order
            from the spreadsheet.
          </p>

          <button
            id="ccToggleSequence"
            class="cc-action cc-action-primary"
            type="button"
            style="width: 100%"
          >
            Show full sequence
          </button>

          <div
            id="ccSequenceContainer"
            class="cc-hidden"
            style="margin-top: 12px"
          >
            <div
              id="ccSequenceTable"
              class="cc-table-wrap"
            ></div>

            <div
              id="ccBonusTableSection"
              class="cc-hidden"
            >
              <h3 style="margin-top: 18px">
                Platinum bonus rarity sequence
              </h3>

              <div
                id="ccBonusTable"
                class="cc-table-wrap"
              ></div>
            </div>
          </div>
        </section>
      </div>
    `;

    document.body.appendChild(overlay);
  }

  function renderHeader() {
    document.getElementById(
      "ccPredictorTitle"
    ).textContent =
      `${titleCase(state.chestType)} Chest Predictor`;

    document.getElementById(
      "ccPredictorSubtitle"
    ).textContent =
      `${titleCase(state.profileName)} profile ` +
      "• exact spreadsheet rewards";

    document
      .getElementById("ccBonusRow")
      .classList.toggle(
        "cc-hidden",
        state.chestType !== "platinum"
      );
  }

  function renderSelectors() {
    const chestContainer =
      document.getElementById(
        "ccChestSelectors"
      );

    chestContainer.innerHTML = [
      ["gold", "🥇 Gold"],
      ["platinum", "💎 Platinum"]
    ]
      .map(
        ([value, label]) => `
          <button
            type="button"
            class="cc-selector ${
              state.chestType === value
                ? "cc-active"
                : ""
            }"
            data-cc-chest="${value}"
          >
            ${label}
          </button>
        `
      )
      .join("");

    const profileContainer =
      document.getElementById(
        "ccProfileSelectors"
      );

    profileContainer.innerHTML = [
      ["breeding", "🥚 Breeding"],
      ["pvp", "⚔️ PvP / Assault"]
    ]
      .map(
        ([value, label]) => `
          <button
            type="button"
            class="cc-selector ${
              state.profileName === value
                ? "cc-active"
                : ""
            }"
            data-cc-profile="${value}"
          >
            ${label}
          </button>
        `
      )
      .join("");

    chestContainer
      .querySelectorAll("[data-cc-chest]")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            state.chestType =
              button.dataset.ccChest;

            state.selectedRarity = "";
            saveState();
            renderEverything();
          }
        );
      });

    profileContainer
      .querySelectorAll("[data-cc-profile]")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            state.profileName =
              button.dataset.ccProfile;

            state.selectedRarity = "";
            saveState();
            renderEverything();
          }
        );
      });
  }

  function renderRarityButtons() {
    const container =
      document.getElementById(
        "ccRarityButtons"
      );

    const rarities = Engine.getRarities(
      state.chestType,
      state.profileName
    );

    if (!rarities.length) {
      container.innerHTML = `
        <div class="cc-muted">
          No rarity data was found for this profile.
        </div>
      `;

      state.selectedRarity = "";
      return;
    }

    const selectedStillExists =
      rarities.some(
        rarity =>
          Engine.normalise(rarity) ===
          Engine.normalise(
            state.selectedRarity
          )
      );

    if (!selectedStillExists) {
      state.selectedRarity = rarities[0];
      saveState();
    }

    container.innerHTML = rarities
      .map(
        rarity => `
          <button
            type="button"
            class="
              cc-rarity-button
              ${rarityClass(rarity)}
              ${
                Engine.normalise(rarity) ===
                Engine.normalise(
                  state.selectedRarity
                )
                  ? "cc-active"
                  : ""
              }
            "
            data-cc-rarity="${escapeHTML(rarity)}"
          >
            ${escapeHTML(rarity)}
          </button>
        `
      )
      .join("");

    container
      .querySelectorAll("[data-cc-rarity]")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            state.selectedRarity =
              button.dataset.ccRarity;

            saveState();
            renderRarityButtons();
            renderRewardButtons();
          }
        );
      });
  }

  function renderRewardButtons() {
    const container =
      document.getElementById(
        "ccRewardButtons"
      );

    const search =
      document
        .getElementById("ccRewardSearch")
        .value
        .trim()
        .toLowerCase();

    const rewards =
      Engine.getRewardCatalogue(
        state.chestType,
        state.profileName,
        state.selectedRarity
      ).filter(reward =>
        reward.toLowerCase().includes(search)
      );

    if (!rewards.length) {
      container.innerHTML = `
        <div class="cc-muted">
          No rewards were found for this rarity.
        </div>
      `;

      return;
    }

    container.innerHTML = rewards
      .map(
        reward => `
          <button
            type="button"
            class="cc-reward-button"
            data-cc-reward="${escapeHTML(reward)}"
          >
            ${escapeHTML(reward)}
          </button>
        `
      )
      .join("");

    container
      .querySelectorAll("[data-cc-reward]")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            recordDrop(
              button.dataset.ccReward
            );
          }
        );
      });
  }

  function recordDrop(reward) {
    if (
      !state.selectedRarity ||
      !reward
    ) {
      return;
    }

    const bonus =
      state.chestType === "platinum" &&
      document.getElementById(
        "ccBonusCheck"
      ).checked;

    const drops = [
      ...currentDrops(),
      {
        rarity: state.selectedRarity,
        sequence: state.selectedRarity,
        reward,
        bonus,
        recordedAt:
          new Date().toISOString()
      }
    ];

    setCurrentDrops(drops);

    document.getElementById(
      "ccBonusCheck"
    ).checked = false;

    renderDropList();
    renderResults();
  }

  function renderDropList() {
    const drops = currentDrops();

    const list =
      document.getElementById(
        "ccDropList"
      );

    document.getElementById(
      "ccDropCount"
    ).textContent =
      `${drops.length} chest result${
        drops.length === 1 ? "" : "s"
      } recorded`;

    if (!drops.length) {
      list.innerHTML = `
        <div class="cc-muted">
          No drops recorded yet.
        </div>
      `;

      return;
    }

    list.innerHTML = drops
      .map(
        (drop, index) => `
          <div class="cc-drop">
            <div class="cc-drop-number">
              ${index + 1}
            </div>

            <div>
              <strong class="${rarityClass(
                drop.rarity
              )}">
                ${escapeHTML(drop.rarity)}
                ${
                  drop.bonus
                    ? " • Bonus"
                    : ""
                }
              </strong>

              <small>
                ${escapeHTML(drop.reward)}
              </small>
            </div>

            <button
              type="button"
              class="cc-remove"
              data-cc-remove="${index}"
              aria-label="Remove result ${index + 1}"
            >
              ×
            </button>
          </div>
        `
      )
      .join("");

    list
      .querySelectorAll("[data-cc-remove]")
      .forEach(button => {
        button.addEventListener(
          "click",
          () => {
            const copy = [
              ...currentDrops()
            ];

            copy.splice(
              Number(
                button.dataset.ccRemove
              ),
              1
            );

            setCurrentDrops(copy);
            renderDropList();
            renderResults();
          }
        );
      });
  }
  function candidateText(
    candidates,
    usedCount
  ) {
    if (!candidates?.length) {
      return "No match";
    }

    if (candidates.length === 1) {
      const position =
        candidates[0] + usedCount + 1;

      return `Position ${position}`;
    }

    return (
      `${candidates.length} possible ` +
      "positions"
    );
  }

  function renderResults() {
    const drops = currentDrops();

    const result = Engine.solve(
      state.chestType,
      state.profileName,
      drops
    );

    const message =
      document.getElementById(
        "ccSolverMessage"
      );

    const confidence =
      document.getElementById(
        "ccConfidence"
      );

    const trackGrid =
      document.getElementById(
        "ccTrackGrid"
      );

    const predictionList =
      document.getElementById(
        "ccPredictionList"
      );

    if (!result.available) {
      confidence.textContent = "0%";

      message.className =
        "cc-muted cc-status-bad";

      message.textContent =
        "The selected predictor database could not be loaded.";

      trackGrid.innerHTML = "";

      predictionList.innerHTML = `
        <div class="cc-muted">
          Predictions are unavailable.
        </div>
      `;

      renderSequenceTable(null);
      return;
    }

    if (!drops.length) {
      confidence.textContent = "0%";

      message.className = "cc-muted";

      message.textContent =
        `${titleCase(
          state.profileName
        )} ${titleCase(
          state.chestType
        )} data is loaded. ` +
        "Enter your first chest result.";

      trackGrid.innerHTML = "";

      predictionList.innerHTML = `
        <div class="cc-muted">
          Upcoming rewards will appear
          as the sequence narrows.
        </div>
      `;

      renderSequenceTable(null);
      return;
    }

    if (!result.matched) {
      const mismatch =
        Engine.findFirstMismatch(
          state.chestType,
          state.profileName,
          drops
        );

      confidence.textContent = "0%";

      message.className =
        "cc-muted cc-status-bad";

      message.textContent = mismatch
        ? (
            `Entry ${mismatch} is the first ` +
            "result that does not match. " +
            "Check its rarity, exact reward, " +
            "event profile and bonus marker."
          )
        : (
            "The entered results do not " +
            "match this sequence."
          );

      trackGrid.innerHTML = "";

      predictionList.innerHTML = `
        <div class="cc-muted">
          Correct the mismatched result
          before relying on predictions.
        </div>
      `;

      renderSequenceTable(null);
      return;
    }

    confidence.textContent =
      `${result.confidence}%`;

    const currentPosition =
      Engine.getLikelyCurrentPosition(
        result
      );

    const unresolved =
      result.totalTracks -
      result.exactTracks;

    if (currentPosition !== null) {
      message.className =
        "cc-muted cc-status-good";

      message.textContent =
        "Sequence located. Your latest " +
        "regular chest is at position " +
        `${currentPosition + 1}.`;
    } else {
      message.className =
        "cc-muted cc-status-warning";

      message.textContent =
        `Still narrowing: ${unresolved} ` +
        `sequence track${
          unresolved === 1 ? "" : "s"
        } still ${
          unresolved === 1 ? "has" : "have"
        } multiple possible positions.`;
    }

    const tracks = [
      {
        label: "Main rarity",
        candidates:
          result.rarity.mainCandidates,
        used:
          result.rarity.regularCount
      }
    ];

    if (
      result.profile.bonusSequence.length
    ) {
      tracks.push({
        label: "Bonus rarity",
        candidates:
          result.rarity.bonusCandidates,
        used:
          result.rarity.bonusCount
      });
    }

    Object.entries(result.rewards)
      .filter(
        ([, solution]) =>
          solution.observations.length > 0
      )
      .forEach(
        ([rarity, solution]) => {
          tracks.push({
            label:
              `${rarity} rewards`,
            candidates:
              solution.candidates,
            used:
              solution.observations.length
          });
        }
      );

    trackGrid.innerHTML = tracks
      .map(
        track => `
          <div class="cc-track">
            <span>
              ${escapeHTML(track.label)}
            </span>

            <strong>
              ${escapeHTML(
                candidateText(
                  track.candidates,
                  track.used
                )
              )}
            </strong>
          </div>
        `
      )
      .join("");

    const predictions =
      Engine.predictUpcoming(
        state.chestType,
        state.profileName,
        drops,
        5
      );

    if (!predictions.length) {
      predictionList.innerHTML = `
        <div class="cc-muted">
          Keep entering results to narrow
          the main rarity sequence to one
          position.
        </div>
      `;
    } else {
      predictionList.innerHTML =
        predictions
          .map(
            prediction => `
              <div class="cc-prediction">
                <div
                  class="cc-prediction-number"
                >
                  ${prediction.number}
                </div>

                <div>
                  <strong
                    class="${rarityClass(
                      prediction.rarity
                    )}"
                  >
                    ${escapeHTML(
                      prediction.reward
                    )}
                  </strong>

                  <small>
                    Position
                    ${prediction.position}
                    •
                    ${escapeHTML(
                      prediction.rarity
                    )}
                  </small>
                </div>
              </div>
            `
          )
          .join("");
    }

    renderSequenceTable(
      currentPosition
    );
  }

  function renderSequenceTable(
    currentPosition
  ) {
    const table =
      document.getElementById(
        "ccSequenceTable"
      );

    const rows =
      Engine.buildSequenceTable(
        state.chestType,
        state.profileName
      );

    if (!rows.length) {
      table.innerHTML = `
        <div
          class="cc-muted"
          style="padding: 14px"
        >
          No sequence table is available.
        </div>
      `;

      return;
    }

    table.innerHTML = `
      <table class="cc-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Rarity</th>
            <th>Reward</th>
          </tr>
        </thead>

        <tbody>
          ${rows
            .map(
              row => `
                <tr
                  class="${
                    currentPosition !== null &&
                    row.position ===
                      currentPosition + 1
                      ? "cc-current-row"
                      : ""
                  }"
                >
                  <td
                    class="cc-table-position"
                  >
                    ${row.position}
                  </td>

                  <td>
                    <span
                      class="${rarityClass(
                        row.rarity
                      )}"
                    >
                      ${escapeHTML(
                        row.rarity
                      )}
                    </span>
                  </td>

                  <td>
                    ${escapeHTML(
                      row.reward
                    )}
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;

    const bonusSection =
      document.getElementById(
        "ccBonusTableSection"
      );

    const bonusRows =
      Engine.buildBonusTable(
        state.chestType,
        state.profileName
      );

    if (!bonusRows.length) {
      bonusSection.classList.add(
        "cc-hidden"
      );

      return;
    }

    bonusSection.classList.remove(
      "cc-hidden"
    );

    document.getElementById(
      "ccBonusTable"
    ).innerHTML = `
      <table class="cc-table">
        <thead>
          <tr>
            <th>Bonus #</th>
            <th>Rarity</th>
          </tr>
        </thead>

        <tbody>
          ${bonusRows
            .map(
              row => `
                <tr>
                  <td
                    class="cc-table-position"
                  >
                    ${row.position}
                  </td>

                  <td>
                    <span
                      class="${rarityClass(
                        row.rarity
                      )}"
                    >
                      ${escapeHTML(
                        row.rarity
                      )}
                    </span>
                  </td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    `;
  }

  function renderEverything() {
    renderHeader();
    renderSelectors();
    renderRarityButtons();

    document.getElementById(
      "ccRewardSearch"
    ).value = "";

    renderRewardButtons();
    renderDropList();
    renderResults();

    const sequenceContainer =
      document.getElementById(
        "ccSequenceContainer"
      );

    const toggleButton =
      document.getElementById(
        "ccToggleSequence"
      );

    sequenceContainer.classList.toggle(
      "cc-hidden",
      !state.sequenceVisible
    );

    toggleButton.textContent =
      state.sequenceVisible
        ? "Hide full sequence"
        : "Show full sequence";
  }

  function openPredictor(
    chestType = null
  ) {
    if (
      chestType === "gold" ||
      chestType === "platinum"
    ) {
      state.chestType = chestType;
      state.selectedRarity = "";
      saveState();
    }

    renderEverything();

    document
      .getElementById(
        "ccPredictorOverlay"
      )
      .classList.add("cc-open");

    document.body.style.overflow =
      "hidden";
  }

  function closePredictor() {
    document
      .getElementById(
        "ccPredictorOverlay"
      )
      .classList.remove("cc-open");

    document.body.style.overflow = "";
  }

  function detectChestType(
    element
  ) {
    const text = [
      element.dataset.chest,
      element.dataset.chestType,
      element.dataset.predictor,
      element.id,
      element.className,
      element.textContent,
      element.getAttribute(
        "aria-label"
      ),
      element.getAttribute("title")
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (
      text.includes("platinum")
    ) {
      return "platinum";
    }

    if (text.includes("gold")) {
      return "gold";
    }

    return null;
  }

  function attachExistingPredictorButtons() {
    const elements =
      document.querySelectorAll(
        [
          "button",
          "[role='button']",
          "[data-chest]",
          "[data-predictor]",
          "[id*='predictor' i]",
          "[class*='predictor' i]"
        ].join(",")
      );

    elements.forEach(element => {
      if (
        element.dataset
          .ccPredictorBound === "true"
      ) {
        return;
      }

      const chestType =
        detectChestType(element);

      if (!chestType) {
        return;
      }

      const description = [
        element.textContent,
        element.id,
        element.className
      ]
        .join(" ")
        .toLowerCase();

      const looksLikePredictor =
        description.includes(
          "predictor"
        ) ||
        description.includes(
          "sequence"
        ) ||
        description.includes(
          "engine ready"
        );

      if (!looksLikePredictor) {
        return;
      }

      element.dataset
        .ccPredictorBound = "true";

      element.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopPropagation();

          openPredictor(
            chestType
          );
        },
        true
      );
    });
  }

  function addPredictorLauncher() {
    if (
      document.getElementById(
        "ccPredictorLauncher"
      )
    ) {
      return;
    }

    const button =
      document.createElement(
        "button"
      );

    button.id =
      "ccPredictorLauncher";

    button.type = "button";

    button.textContent =
      "🔮 Predictor";

    button.addEventListener(
      "click",
      () => {
        openPredictor();
      }
    );

    document.body.appendChild(
      button
    );
  }

  function attachPredictorEvents() {
    document
      .getElementById(
        "ccClosePredictor"
      )
      .addEventListener(
        "click",
        closePredictor
      );

    document
      .getElementById(
        "ccRewardSearch"
      )
      .addEventListener(
        "input",
        renderRewardButtons
      );

    document
      .getElementById(
        "ccUndoDrop"
      )
      .addEventListener(
        "click",
        () => {
          const drops = [
            ...currentDrops()
          ];

          drops.pop();

          setCurrentDrops(drops);
          renderDropList();
          renderResults();
        }
      );

    document
      .getElementById(
        "ccResetDrops"
      )
      .addEventListener(
        "click",
        () => {
          const confirmed =
            window.confirm(
              "Reset every recorded result for this chest and profile?"
            );

          if (!confirmed) {
            return;
          }

          setCurrentDrops([]);
          renderDropList();
          renderResults();
        }
      );

    document
      .getElementById(
        "ccToggleSequence"
      )
      .addEventListener(
        "click",
        () => {
          state.sequenceVisible =
            !state.sequenceVisible;

          saveState();

          const container =
            document.getElementById(
              "ccSequenceContainer"
            );

          const button =
            document.getElementById(
              "ccToggleSequence"
            );

          container.classList.toggle(
            "cc-hidden",
            !state.sequenceVisible
          );

          button.textContent =
            state.sequenceVisible
              ? "Hide full sequence"
              : "Show full sequence";
        }
      );

    document
      .getElementById(
        "ccPredictorOverlay"
      )
      .addEventListener(
        "click",
        event => {
          if (
            event.target.id ===
            "ccPredictorOverlay"
          ) {
            closePredictor();
          }
        }
      );

    document.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Escape"
        ) {
          closePredictor();
        }
      }
    );
  }

  function initialise() {
    addPredictorStyles();
    createPredictorOverlay();
    attachPredictorEvents();
    attachExistingPredictorButtons();
    addPredictorLauncher();

    const observer =
      new MutationObserver(() => {
        attachExistingPredictorButtons();
      });

    observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );

    console.info(
      "[Chest Companion] Predictor UI ready.",
      Engine.databaseStatus()
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

  window.ChestPredictorUI =
    Object.freeze({
      open: openPredictor,
      close: closePredictor,
      render: renderEverything
    });
})(window);