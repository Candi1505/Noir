/* ============================================================
   CHEST COMPANION BETA — PREDICTOR UI

   Community Edition

   Developed by a War Dragons player
   for the War Dragons community.

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

    const STORAGE_KEY =
    "chestCompanionBetaPredictor";


    const EVENT_NAMES = {

    breeding:
      "Breeding",

    fortification:
      "Fortification",

    "crystal-caves":
      "Crystal Caves",

    "temple-raids":
      "Temple Raids",

    "team-gauntlet":
      "Team Gauntlet",

    "fight-pits":
      "Fight Pits"

  };


  const VALID_RARITIES =
    new Set([
      "common",
      "rare",
      "epic",
      "legendary",
      "mythic"
    ]);


  function isValidRarity(
    rarity
  ) {

    return VALID_RARITIES.has(
      Engine.normalise(
        rarity
      )
    );

  }


  const defaultState = {

    chestType:
      "gold",

    eventId:
      "",

    selectedRarity:
      "",

    sequenceVisible:
      false,

    drops:
      {}

  };


  let state =
    loadState();


  function cloneDefaultState() {

    return JSON.parse(
      JSON.stringify(
        defaultState
      )
    );

  }


  function getActiveEventId() {

    return (
      window
        .ChestPredictorUpload
        ?.getSelectedEvent?.() ||

      state.eventId ||

      ""
    );

  }


  function getActiveEventName() {

    const eventId =
      getActiveEventId();


    return (
      window
        .ChestPredictorUpload
        ?.getEventName?.(
          eventId
        ) ||

      EVENT_NAMES[eventId] ||

      eventId ||

      "No event selected"
    );

  }


  function getDropStorageKey() {

    const eventId =
      getActiveEventId();


    return (
      `${eventId}:${state.chestType}`
    );

  }


  function loadState() {

    try {

      const saved =
        JSON.parse(

          localStorage.getItem(
            STORAGE_KEY
          ) ||

          "{}"

        );


      return {

        ...cloneDefaultState(),

        ...saved,

        eventId:
          saved.eventId ||
          "",

        drops:

          saved.drops &&
          typeof saved.drops ===
            "object"

            ? saved.drops

            : {}

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

      JSON.stringify(
        state
      )

    );

  }


  function currentDrops() {

    return (
      state.drops[
        getDropStorageKey()
      ] ||

      []
    );

  }


  function setCurrentDrops(
    drops
  ) {

    state.drops[
      getDropStorageKey()
    ] = drops;


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
        rgba(185, 149, 66, 0.07),
        transparent 36%
      ),
      rgba(0, 0, 0, 0.99);

    color: #b8b8b8;

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

    border-bottom: 1px solid rgba(185, 149, 66, 0.16);

    background: rgba(0, 0, 0, 0.96);

    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }

  .cc-topbar h1 {
    margin: 0;

    color: #b8b8b8;

    font-size: 25px;
    font-weight: 700;
  }

  .cc-topbar p {
    margin: 4px 0 0;

    color: #8d8d8d;

    font-size: 12px;
  }

  .cc-close {
    flex: 0 0 auto;

    width: 44px;
    height: 44px;

    border: 1px solid #343434;
    border-radius: 50%;

    background:
      linear-gradient(
        180deg,
        #171717,
        #080808
      );

    color: #b8b8b8;

    font-size: 26px;
    cursor: pointer;
  }

  .cc-close:hover {
    border-color: rgba(185, 149, 66, 0.4);
    color: #d9bf76;
  }

  .cc-card {
    margin-bottom: 14px;
    padding: 18px;

    border: 1px solid #292929;
    border-radius: 22px;

    background:
      linear-gradient(
        145deg,
        rgba(17, 17, 17, 0.99),
        rgba(3, 3, 3, 0.99)
      );

    box-shadow:
      0 18px 45px rgba(0, 0, 0, 0.58),
      inset 0 1px rgba(185, 149, 66, 0.035);
  }

  .cc-card h2,
  .cc-card h3 {
    margin: 0 0 8px;
    color: #b8b8b8;
  }

  .cc-muted {
    color: #8d8d8d;
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

    border: 1px solid #303030;
    border-radius: 15px;

    background:
      linear-gradient(
        145deg,
        #151515,
        #060606
      );

    color: #b8b8b8;

    padding: 13px 12px;

    font: inherit;
    font-weight: 750;

    cursor: pointer;

    transition:
      transform 0.18s ease,
      border-color 0.18s ease,
      background 0.18s ease;
  }

  .cc-selector:hover,
  .cc-rarity-button:hover,
  .cc-reward-button:hover,
  .cc-action:hover {
    border-color: rgba(185, 149, 66, 0.36);

    background:
      linear-gradient(
        145deg,
        #1d1d1d,
        #090909
      );
  }

  .cc-selector.cc-active {
    border-color: rgba(217, 191, 118, 0.55);

    background:
      linear-gradient(
        145deg,
        rgba(185, 149, 66, 0.25),
        rgba(72, 53, 18, 0.22)
      );

    color: #d9bf76;

    box-shadow:
      0 0 0 2px rgba(185, 149, 66, 0.09),
      inset 0 1px rgba(217, 191, 118, 0.12);
  }

  .cc-field-label {
    display: block;

    margin: 16px 0 8px;

    color: #b99542;

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
    outline: 2px solid #b99542;
    outline-offset: 1px;
  }

  .cc-rarity-mythic,
  .cc-rarity-legendary,
  .cc-rarity-epic,
  .cc-rarity-rare,
  .cc-rarity-common {
    border-color: #3a3a3a !important;

    background:
      linear-gradient(
        145deg,
        #171717,
        #070707
      ) !important;

    color: #b8b8b8 !important;
  }

  .cc-rarity-mythic,
  .cc-rarity-legendary {
    color: #d9bf76 !important;
  }

  .cc-search {
    width: 100%;

    margin-bottom: 10px;
    padding: 14px;

    border: 1px solid #303030;
    border-radius: 15px;

    background:
      linear-gradient(
        180deg,
        #101010,
        #050505
      );

    color: #b8b8b8;

    font: inherit;
    caret-color: #d9bf76;
  }

  .cc-search::placeholder {
    color: #656565;
  }

  .cc-search:focus {
    outline: none;

    border-color: #876624;

    box-shadow:
      0 0 0 3px rgba(185, 149, 66, 0.12);
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
    display: flex;
    align-items: center;
    justify-content: space-between;

    gap: 14px;

    width: 100%;

    text-align: left;
    line-height: 1.3;
  }

  .cc-reward-name {
    min-width: 0;
    font-weight: 850;
  }

  .cc-reward-rarity {
    flex: 0 0 auto;

    color: #b99542;

    font-size: 12px;
    font-weight: 850;
    opacity: 0.95;
  }

  .cc-reward-button:active {
    transform: scale(0.985);
  }

  .cc-bonus-row {
    display: flex;
    align-items: center;

    gap: 10px;

    margin-top: 13px;
    padding: 12px;

    border: 1px solid #303030;
    border-radius: 15px;

    background: #090909;

    color: #b8b8b8;
  }

  .cc-bonus-row input {
    width: 21px;
    height: 21px;

    accent-color: #b99542;
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

    border: 1px solid #292929;
    border-radius: 15px;

    background:
      linear-gradient(
        145deg,
        #121212,
        #050505
      );
  }

  .cc-drop-number {
    width: 32px;
    height: 32px;

    display: grid;
    place-items: center;

    border: 1px solid rgba(185, 149, 66, 0.28);
    border-radius: 50%;

    background: rgba(185, 149, 66, 0.1);

    color: #d9bf76;

    font-weight: 900;
  }

  .cc-drop strong,
  .cc-drop small {
    display: block;
  }

  .cc-drop small {
    margin-top: 3px;
    color: #8d8d8d;
  }

  .cc-remove {
    width: 36px;
    height: 36px;

    border: 1px solid rgba(163, 91, 91, 0.48);
    border-radius: 50%;

    background:
      linear-gradient(
        180deg,
        rgba(74, 27, 27, 0.72),
        rgba(35, 12, 12, 0.9)
      );

    color: #d88989;

    font-size: 21px;
    cursor: pointer;
  }

  .cc-remove:hover {
    border-color: #a35b5b;
    color: #efaaaa;
  }

  .cc-actions {
    display: grid;
    grid-template-columns:
      repeat(2, minmax(0, 1fr));

    gap: 9px;
    margin-top: 13px;
  }

  .cc-action-primary {
    border-color: rgba(185, 149, 66, 0.42);

    background:
      linear-gradient(
        180deg,
        #d9bf76,
        #b99542
      );

    color: #090909;
  }

  .cc-action-primary:hover {
    background:
      linear-gradient(
        180deg,
        #e1ca89,
        #c3a14f
      );
  }

  .cc-action-danger {
    border-color: rgba(163, 91, 91, 0.5);

    background:
      linear-gradient(
        180deg,
        rgba(75, 30, 30, 0.76),
        rgba(37, 13, 13, 0.92)
      );

    color: #d88989;
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

    border: 1px solid rgba(185, 149, 66, 0.32);
    border-radius: 14px;

    background:
      linear-gradient(
        145deg,
        #111111,
        #050505
      );

    color: #d9bf76;

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
    color: #8d8d8d;
    font-size: 11px;
  }

  /* GREEN MEANS GO */

  .cc-status-good {
    color: #65e2b4;
  }

  /* GOLD MEANS WAIT / NARROWING */

  .cc-status-warning {
    color: #d9bf76;
  }

  /* RED MEANS NO / ERROR */

  .cc-status-bad {
    color: #d88989;
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

    border: 1px solid #292929;
    border-radius: 14px;

    background:
      linear-gradient(
        145deg,
        #121212,
        #050505
      );
  }

  .cc-track span,
  .cc-track strong {
    display: block;
  }

  .cc-track span {
    color: #8d8d8d;
    font-size: 11px;
  }

  .cc-track strong {
    margin-top: 4px;

    color: #b8b8b8;

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

    border: 1px solid #292929;
    border-radius: 15px;

    background:
      linear-gradient(
        145deg,
        #121212,
        #050505
      );
  }

  .cc-prediction-number {
    width: 34px;
    height: 34px;

    display: grid;
    place-items: center;

    border: 1px solid rgba(185, 149, 66, 0.3);
    border-radius: 50%;

    background: rgba(185, 149, 66, 0.11);

    color: #d9bf76;

    font-weight: 900;
  }

  .cc-prediction strong,
  .cc-prediction small {
    display: block;
  }

  .cc-prediction small {
    margin-top: 3px;
    color: #8d8d8d;
  }

  .cc-table-wrap {
    max-height: 520px;

    overflow-x: auto;
    overflow-y: auto;

    border: 1px solid #292929;
    border-radius: 16px;

    background: #050505;
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

    background: #121212;

    color: #d9bf76;

    text-align: left;
    font-size: 12px;
  }

  .cc-table td {
    padding: 11px;

    border-top: 1px solid #242424;

    color: #a9a9a9;

    vertical-align: top;
  }

  .cc-table tr.cc-current-row {
    background: rgba(101, 226, 180, 0.09);

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

    padding: 12px 16px;

    border: 1px solid rgba(185, 149, 66, 0.46);
    border-radius: 999px;

    background:
      linear-gradient(
        180deg,
        #171717,
        #050505
      );

    color: #d9bf76;

    font: inherit;
    font-weight: 900;

    box-shadow:
      0 12px 32px rgba(0, 0, 0, 0.58),
      inset 0 1px rgba(185, 149, 66, 0.06);

    cursor: pointer;
  }

  #ccPredictorLauncher:hover {
    border-color: #b99542;

    background:
      linear-gradient(
        180deg,
        #202020,
        #090909
      );
  }

  #ccPredictorOverlay button {
    -webkit-tap-highlight-color: transparent;
  }

  #ccPredictorOverlay button:focus-visible,
  #ccPredictorLauncher:focus-visible {
    outline: none;

    box-shadow:
      0 0 0 3px rgba(185, 149, 66, 0.14);
  }

  #ccPredictorOverlay ::-webkit-scrollbar {
    width: 9px;
  }

  #ccPredictorOverlay ::-webkit-scrollbar-track {
    background: #020202;
  }

  #ccPredictorOverlay ::-webkit-scrollbar-thumb {
    border-radius: 999px;
    background: #292929;
  }

  #ccPredictorOverlay ::-webkit-scrollbar-thumb:hover {
    background: #876624;
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
            Search for the reward you received,
            then tap it to record the chest.
          </p>

          <span class="cc-field-label">
            Reward received
          </span>

          <input
            id="ccRewardSearch"
            class="cc-search"
            type="search"
            placeholder="Search Food, shards, tokens..."
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
  <h2>Double Armory</h2>

  <div id="ccArmoryGrid" class="cc-track-grid">
    <div class="cc-track">
      <span>Sequence Position</span>
      <strong id="ccArmoryPosition">-</strong>
    </div>

    <div class="cc-track">
      <span>Sequence Block</span>
      <strong id="ccArmoryBlock">-</strong>
    </div>

    <div class="cc-track">
      <span>Suggested Page</span>
      <strong id="ccArmoryPage">-</strong>
    </div>
  </div>
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

    const eventName =
      getActiveEventName();


    document.getElementById(
      "ccPredictorTitle"
    ).textContent =

      `${titleCase(
        state.chestType
      )} Chest Predictor`;


    document.getElementById(
      "ccPredictorSubtitle"
    ).textContent =

      `${eventName} • uploaded spreadsheet rewards`;


    document
      .getElementById(
        "ccBonusRow"
      )
      .classList.toggle(

        "cc-hidden",

        state.chestType !==
          "platinum"

      );

  }

    function renderSelectors() {

    const chestContainer =
  document.getElementById(
    "ccChestSelectors"
  );


chestContainer.innerHTML = [

  [
    "gold",
    "🥇 Gold"
  ],

  [
    "platinum",
    "💎 Platinum"
  ],

  [
    "draconic",
    "🐉 Draconic"
  ],

  [
    "freedom",
    "🦅 Freedom"
  ]

]
      .map(
        (
          [
            value,
            label
          ]
        ) => `

          <button

            type="button"

            class="cc-selector ${
              state.chestType ===
                value

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


    const eventId =
      getActiveEventId();


    const eventName =
      getActiveEventName();


    if (!eventId) {

      profileContainer.innerHTML = `

        <div class="cc-muted">

          Select an event on the Predictors page first.

        </div>

      `;

    } else {

      profileContainer.innerHTML = `

        <button

          type="button"

          class="cc-selector cc-active"

          disabled

        >

          ✦ ${escapeHTML(
            eventName
          )}

        </button>

      `;

    }


    chestContainer
      .querySelectorAll(
        "[data-cc-chest]"
      )
      .forEach(
        button => {

          button.addEventListener(

            "click",

            async () => {

              state.chestType =
                button.dataset
                  .ccChest;



              saveState();


              await activateCurrentPredictor();


              renderEverything();

            }

          );

        }

      );

  }

    async function activateCurrentPredictor() {

    const eventId =
      getActiveEventId();


    state.eventId =
      eventId;


    saveState();


    if (!eventId) {

      return null;

    }


    try {

      return await Engine.activate(

        state.chestType,

        eventId

      );

    } catch (error) {

      console.error(
        "[Chest Companion] Uploaded predictor activation failed.",
        error
      );


      return null;

    }

  }
  
    function getAllRewardOptions() {

    const eventId =
      getActiveEventId();


    if (!eventId) {

      return [];

    }


    const rarities =
      Engine.getRarities(
        state.chestType,
        eventId
      )
        .filter(
          isValidRarity
        );


    const options =
      [];


    rarities.forEach(
      rarity => {

        const rewards =
          Engine.getRewardCatalogue(
            state.chestType,
            eventId,
            rarity
          ) || [];


        rewards.forEach(
          reward => {

            const cleanReward =
              String(
                reward ||
                ""
              ).trim();


            if (!cleanReward) {

              return;

            }


            options.push({
              reward:
                cleanReward,

              rarity:
                rarity
            });

          }
        );

      }
    );


    const unique =
      new Map();


    options.forEach(
      option => {

        const key =
          `${Engine.normalise(
            option.reward
          )}:${Engine.normalise(
            option.rarity
          )}`;


        if (!unique.has(key)) {

          unique.set(
            key,
            option
          );

        }

      }
    );


    return Array.from(
      unique.values()
    ).sort(
      (
        first,
        second
      ) =>

        first.reward.localeCompare(
          second.reward,
          undefined,
          {
            numeric: true,
            sensitivity: "base"
          }
        )

    );

  }

    function renderRewardButtons() {

    const container =
      document.getElementById(
        "ccRewardButtons"
      );


    const search =
      document
        .getElementById(
          "ccRewardSearch"
        )
        .value
        .trim()
        .toLowerCase();


    const rewards =
      getAllRewardOptions()
        .filter(
          option => {

            const searchable =
              `${option.reward} ${option.rarity}`
                .toLowerCase();


            return searchable.includes(
              search
            );

          }
        );


    if (!rewards.length) {

      container.innerHTML = `

        <div class="cc-muted">

          No matching rewards were found
          in the uploaded workbook.

        </div>

      `;

      return;

    }


    container.innerHTML =
      rewards
        .map(
          option => `

            <button

              type="button"

              class="cc-reward-button"

              data-cc-reward="${escapeHTML(
                option.reward
              )}"

              data-cc-rarity="${escapeHTML(
                option.rarity
              )}"

            >

              <span class="cc-reward-name">

                ${escapeHTML(
                  option.reward
                )}

              </span>

              <span
                class="
                  cc-reward-rarity
                  ${rarityClass(
                    option.rarity
                  )}
                "
              >

                ${escapeHTML(
                  option.rarity
                )}

              </span>

            </button>

          `
        )
        .join("");


    container
      .querySelectorAll(
        "[data-cc-reward]"
      )
      .forEach(
        button => {

          button.addEventListener(

            "click",

            () => {

              recordDrop(

                button.dataset
                  .ccReward,

                button.dataset
                  .ccRarity

              );

            }

          );

        }
      );

  }

    function recordDrop(
    reward,
    rarity
  ) {

    if (
      !reward ||
      !isValidRarity(
        rarity
      )
    ) {

      return;

    }


    const bonus =
      state.chestType ===
        "platinum" &&

      document.getElementById(
        "ccBonusCheck"
      ).checked;


    const drops = [

      ...currentDrops(),

      {

        rarity:
          rarity,

        sequence:
          rarity,

        reward:
          reward,

        bonus:
          bonus,

        recordedAt:
          new Date()
            .toISOString()

      }

    ];


    setCurrentDrops(
      drops
    );


    document.getElementById(
      "ccBonusCheck"
    ).checked =
      false;


    document.getElementById(
      "ccRewardSearch"
    ).value =
      "";


    renderRewardButtons();

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
function getSequenceBlock(position) {
  if (position >= 1 && position <= 33) {
    return "1–33";
  }

  if (position >= 34 && position <= 66) {
    return "34–66";
  }

  if (position >= 67 && position <= 100) {
    return "67–100";
  }

  return "Unknown";
}

function getArmoryPage(
  position,
  positionsPerPage = 20
) {
  const safePosition =
    Number(position);

  const safePageSize =
    Number(positionsPerPage);

  if (
    !Number.isFinite(safePosition) ||
    !Number.isFinite(safePageSize) ||
    safePosition < 1 ||
    safePageSize < 1
  ) {
    return "-";
  }

  return Math.ceil(
    safePosition / safePageSize
  );
}

  function renderResults() {
    const drops = currentDrops();

    const result = Engine.solve(
      state.chestType,
      getActiveEventId(),
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
      
      const armoryPosition =
  document.getElementById(
    "ccArmoryPosition"
  );

const armoryBlock =
  document.getElementById(
    "ccArmoryBlock"
  );

const armoryPage =
  document.getElementById(
    "ccArmoryPage"
  );

function resetArmoryDisplay() {
  armoryPosition.textContent = "-";
  armoryBlock.textContent = "-";
  armoryPage.textContent = "-";
}

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
    
resetArmoryDisplay();
    renderSequenceTable(null);
      return;
    }

    if (!drops.length) {
      confidence.textContent = "0%";

      message.className = "cc-muted";

      message.textContent =
  `${getActiveEventName()} ${titleCase(
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
resetArmoryDisplay();
      renderSequenceTable(null);
      return;
    }

    if (!result.matched) {
      const mismatch =
        Engine.findFirstMismatch(
          state.chestType,
          getActiveEventId(),
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
resetArmoryDisplay();
      renderSequenceTable(null);
      return;
    }

    confidence.textContent =
      `${result.confidence}%`;

    const currentPosition =
      Engine.getLikelyCurrentPosition(
        result
      );
      const predictedPosition =
  currentPosition !== null
    ? currentPosition + 1
    : null;

const block =
  predictedPosition
    ? getSequenceBlock(predictedPosition)
    : "-";

const page =
  predictedPosition
    ? getArmoryPage(predictedPosition)
    : "-";

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
    getActiveEventId(),
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
document.getElementById(
  "ccArmoryPosition"
).textContent =
  predictedPosition ?? "-";

document.getElementById(
  "ccArmoryBlock"
).textContent =
  block;

document.getElementById(
  "ccArmoryPage"
).textContent =
  page;
  
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
        getActiveEventId()
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
    getActiveEventId()
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


    document.getElementById(
      "ccRewardSearch"
    ).value =
      "";


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

    async function openPredictor(
    chestType = null
  ) {

    if (
  chestType === "gold" ||
  chestType === "platinum" ||
  chestType === "draconic" ||
  chestType === "freedom"
) {

  state.chestType =
    chestType;

}


    state.eventId =
      getActiveEventId();


    saveState();


    const overlay =
      document.getElementById(
        "ccPredictorOverlay"
      );


    overlay.classList.add(
      "cc-open"
    );


    document.body.style.overflow =
      "hidden";


    if (!state.eventId) {

      renderEverything();

      document.getElementById(
        "ccSolverMessage"
      ).textContent =
        "Select an event on the Predictors page first.";

      return;

    }


    await activateCurrentPredictor();

    renderEverything();

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
  text.includes("draconic") ||
  text.includes("drac")
) {
  return "draconic";
}

if (
  text.includes("freedom")
) {
  return "freedom";
}

if (
  text.includes("platinum")
) {
  return "platinum";
}

if (
  text.includes("gold")
) {
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

  /*
   * Never hijack controls belonging to the
   * predictor-management upload screen.
   */
  if (
    element.closest("#predictorView") ||
    element.closest("#ccPredictorOverlay") ||
    element.id === "uploadGoldPredictorButton" ||
element.id === "uploadPlatinumPredictorButton" ||
element.id === "uploadDraconicPredictorButton" ||
element.id === "uploadFreedomPredictorButton" ||
element.id === "goldPredictorFile" ||
element.id === "platinumPredictorFile" ||
element.id === "draconicPredictorFile" ||
element.id === "freedomPredictorFile"
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
  "Predictor";

button.addEventListener(
  "click",
  () => {
    openPredictor();
  }
);

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
        window.addEventListener(
      "chest-companion-event-changed",
      async event => {

        state.eventId =
          event.detail?.eventId ||
          "";


        saveState();

        await activateCurrentPredictor();

        const overlay =
          document.getElementById(
            "ccPredictorOverlay"
          );

        if (
          overlay?.classList.contains(
            "cc-open"
          )
        ) {

          renderEverything();

        }

      }
    );


    window.addEventListener(
      "chest-companion-workbook-imported",
      async event => {

        const importedEvent =
          event.detail?.eventId;

        const importedChest =
          event.detail?.chestType;


        if (
          importedEvent !==
            getActiveEventId() ||
          importedChest !==
            state.chestType
        ) {

          return;

        }


        await activateCurrentPredictor();


        const overlay =
          document.getElementById(
            "ccPredictorOverlay"
          );


        if (
          overlay?.classList.contains(
            "cc-open"
          )
        ) {

          renderEverything();

        }

      }
    );

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

  async function startPredictorUI() {
  if (
    window.ChestPredictorCloud &&
    typeof window.ChestPredictorCloud
      .load === "function"
  ) {
    await window.ChestPredictorCloud
      .load();
  }

  initialise();
}

if (
  document.readyState ===
  "loading"
) {
  document.addEventListener(
    "DOMContentLoaded",
    startPredictorUI
  );
} else {
  startPredictorUI();
}

  window.ChestPredictorUI =
    Object.freeze({
      open: openPredictor,
      close: closePredictor,
      render: renderEverything
    });
})(window);