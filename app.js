/* =========================================================
   CHEST COMPANION V2
   Main Application — Part 1

   Built by Cherubim
   Artwork by Eff
========================================================= */

(() => {

  "use strict";


  /* =======================================================
     LOCAL STORAGE
  ======================================================= */

  const STORAGE_KEY =
    "chest_companion_v2";


  const defaultState = {

    profile: {
      nickname: "Tester",
      alliance_name: "",
      favourite_chest: ""
    },

    activeSession: null,

    history: [],

    priorities: {
      gold: {},
      platinum: {}
    }

  };


  let appState =
    loadLocalState();


  let currentUser =
    null;


  let currentChest =
    "gold";


  /* =======================================================
     ELEMENT HELPERS
  ======================================================= */

  const getElement =
    (id) =>
      document.getElementById(id);


  const allViews =
    Array.from(
      document.querySelectorAll(".view")
    );


  const navigationButtons =
    Array.from(
      document.querySelectorAll(
        ".navigation-button"
      )
    );


  /* =======================================================
     LOCAL DATA
  ======================================================= */

  function loadLocalState() {

    try {

      const savedState =
        JSON.parse(
          localStorage.getItem(
            STORAGE_KEY
          ) || "{}"
        );


      return {

        ...structuredClone(
          defaultState
        ),

        ...savedState,

        profile: {

          ...defaultState.profile,

          ...(savedState.profile || {})

        },

        priorities: {

          gold:
            savedState.priorities?.gold ||
            {},

          platinum:
            savedState.priorities
              ?.platinum ||
            {}

        }

      };

    } catch (error) {

      console.error(
        "Could not load local state:",
        error
      );


      return structuredClone(
        defaultState
      );

    }

  }


  function saveLocalState() {

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(appState)
    );

  }


  /* =======================================================
     APP STARTUP
  ======================================================= */

  async function startApplication() {

    updateCloudBadge(
      "Connecting...",
      false
    );


    getElement(
      "loadingStatus"
    ).textContent =
      "Connecting to the Crystal Nexus...";


    try {

      const player =
        await window
          .ChestDatabase
          .initialisePlayer();


      currentUser =
        player.user;


      appState.profile = {

        ...appState.profile,

        nickname:
          player.profile.nickname ||
          "Tester",

        alliance_name:
          player.profile
            .alliance_name ||
          "",

        favourite_chest:
          player.profile
            .favourite_chest ||
          ""

      };


      saveLocalState();


      updateCloudBadge(
        "Cloud connected",
        true
      );


      getElement(
        "loadingStatus"
      ).textContent =
        "✓ Connected";


    } catch (error) {

      console.error(
        "Cloud connection failed:",
        error
      );


      updateCloudBadge(
        "Device mode",
        false
      );


      getElement(
        "loadingStatus"
      ).textContent =
        "Cloud unavailable — opening device mode";

    }


    loadProfileIntoScreen();

    renderHomeScreen();


    window.setTimeout(
      () => {

        getElement(
          "loadingScreen"
        ).classList.add(
          "hidden"
        );


        getElement(
          "appShell"
        ).classList.remove(
          "hidden"
        );

      },
      700
    );

  }


  function updateCloudBadge(
    message,
    online
  ) {

    const cloudBadge =
      getElement(
        "cloudBadge"
      );


    cloudBadge.textContent =
      message;


    cloudBadge.classList.toggle(
      "online",
      online
    );

  }


  /* =======================================================
     SCREEN NAVIGATION
  ======================================================= */

  function showView(
    viewId,
    pageTitle
  ) {

    allViews.forEach(
      (view) => {

        view.classList.toggle(
          "active",
          view.id === viewId
        );

      }
    );


    navigationButtons.forEach(
      (button) => {

        button.classList.toggle(
          "active",
          button.dataset.view ===
            viewId
        );

      }
    );


    getElement(
      "pageTitle"
    ).textContent =
      pageTitle ||
      "Chest Companion";


    if (
      viewId ===
      "historyView"
    ) {

      renderHistory();

    }


    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });

  }


  /* =======================================================
     PROFILE DISPLAY
  ======================================================= */

  function loadProfileIntoScreen() {

    const nickname =
      appState.profile.nickname ||
      "Tester";


    getElement(
      "welcomeName"
    ).textContent =
      nickname;


    getElement(
      "nicknameInput"
    ).value =
      nickname;


    getElement(
      "allianceInput"
    ).value =
      appState.profile
        .alliance_name ||
      "";


    getElement(
      "favouriteChestInput"
    ).value =
      appState.profile
        .favourite_chest ||
      "";

  }


  /* =======================================================
     HOME SCREEN
  ======================================================= */

  function renderHomeScreen() {

    const activeSession =
      appState.activeSession;


    const resumeButton =
      getElement(
        "resumeSessionButton"
      );


    if (!activeSession) {

      getElement(
        "activeSessionTitle"
      ).textContent =
        "No active session";


      getElement(
        "activeSessionText"
      ).textContent =
        "Start Gold or Platinum tracking to build a visible sequence.";


      resumeButton.classList.add(
        "hidden"
      );


      return;

    }


    getElement(
      "activeSessionTitle"
    ).textContent =
      `${capitalise(
        activeSession.chest
      )} session`;


    getElement(
      "activeSessionText"
    ).textContent =
      `${activeSession.drops.length} drops recorded. Your sequence is ready to resume.`;


    resumeButton.classList.remove(
      "hidden"
    );

  }


  /* =======================================================
     TRACKING SESSIONS
  ======================================================= */

  function openChestTracker(
    chestType
  ) {

    currentChest =
      chestType;


    const existingSession =
      appState.activeSession;


    if (
      !existingSession ||
      existingSession.chest !==
        chestType
    ) {

      appState.activeSession = {

        id:
          createUniqueId(),

        chest:
          chestType,

        startedAt:
          new Date()
            .toISOString(),

        drops: []

      };


      saveLocalState();

    }


    renderTracker();


    showView(
      "trackerView",
      `${capitalise(
        chestType
      )} Tracker`
    );

  }


  function resumeActiveSession() {

    if (
      !appState.activeSession
    ) {

      return;

    }


    currentChest =
      appState
        .activeSession
        .chest;


    renderTracker();


    showView(
      "trackerView",
      `${capitalise(
        currentChest
      )} Tracker`
    );

  }


  function renderTracker() {

    const session =
      appState.activeSession;


    if (!session) {

      return;

    }


    currentChest =
      session.chest;


    getElement(
      "trackerChestLabel"
    ).textContent =
      `${currentChest.toUpperCase()} CHEST`;


    renderDropButtons();

    renderCurrentSequence();

    updatePredictionDisplay();

  }


  /* =======================================================
     REWARD DATA
  ======================================================= */

  function getCurrentChestData() {

    return (
      window.CHEST_DATA?.[
        currentChest
      ] || {
        rewards: [],
        sequence: []
      }
    );

  }


  function getCurrentRewards() {

    return (
      getCurrentChestData()
        .rewards || []
    );

  }


  /* =======================================================
     DROP BUTTONS
  ======================================================= */

  function renderDropButtons(
    searchText = ""
  ) {

    const search =
      searchText
        .trim()
        .toLowerCase();


    const rewards =
      getCurrentRewards()
        .filter(
          (reward) => {

            const searchableText =
              `${reward.name} ${reward.quantity} ${reward.rarity}`
                .toLowerCase();


            return searchableText
              .includes(search);

          }
        );


    const dropContainer =
      getElement(
        "dropButtons"
      );


    if (!rewards.length) {

      dropContainer.innerHTML = `

        <p class="muted-text">
          No rewards have been added for this chest yet.
        </p>

      `;


      return;

    }


    dropContainer.innerHTML =
      rewards
        .map(
          (reward) => `

            <button
              type="button"
              class="drop-button"
              data-drop-id="${escapeHtml(
                reward.id
              )}"
            >

              <strong class="${escapeHtml(
                reward.rarity
              )}-text">

                ${escapeHtml(
                  reward.name
                )}

              </strong>

              <small>

                ${escapeHtml(
                  reward.quantity
                )}

                ·

                ${capitalise(
                  reward.rarity
                )}

              </small>

            </button>

          `
        )
        .join("");

  }


  function addDropToSequence(
    rewardId
  ) {

    const session =
      appState.activeSession;


    if (!session) {

      return;

    }


    const reward =
      getCurrentRewards()
        .find(
          (item) =>
            item.id === rewardId
        );


    if (!reward) {

      console.error(
        "Reward not found:",
        rewardId
      );


      return;

    }


    session.drops.push({

      ...reward,

      loggedAt:
        new Date()
          .toISOString()

    });


    saveLocalState();


    renderCurrentSequence();

    updatePredictionDisplay();

  }


  function undoLastDrop() {

    const drops =
      appState
        .activeSession
        ?.drops;


    if (
      !drops ||
      drops.length === 0
    ) {

      return;

    }


    drops.pop();


    saveLocalState();


    renderCurrentSequence();

    updatePredictionDisplay();

  }


  /* =======================================================
     VISIBLE CURRENT SEQUENCE
  ======================================================= */

  function renderCurrentSequence() {

    const drops =
      appState
        .activeSession
        ?.drops ||
      [];


    getElement(
      "sequenceCount"
    ).textContent =
      drops.length;


    getElement(
      "undoDropButton"
    ).disabled =
      drops.length === 0;


    const sequenceStrip =
      getElement(
        "sequenceStrip"
      );


    if (!drops.length) {

      sequenceStrip.innerHTML = `

        <p class="muted-text empty-message">
          Your recorded drops will appear here instantly.
        </p>

      `;


      return;

    }


    sequenceStrip.innerHTML =
      drops
        .map(
          (
            drop,
            index
          ) => `

            <div class="sequence-item">

              <small>
                #${index + 1}
              </small>

              <strong class="${escapeHtml(
                drop.rarity
              )}-text">

                ${escapeHtml(
                  drop.name
                )}

              </strong>

              <span>
                ${escapeHtml(
                  drop.quantity
                )}
              </span>

            </div>

          `
        )
        .join("");


    sequenceStrip.scrollLeft =
      sequenceStrip.scrollWidth;

  }


  /* =======================================================
     PREDICTION STATUS
  ======================================================= */

  function updatePredictionDisplay() {

    const drops =
      appState
        .activeSession
        ?.drops ||
      [];


    /*
      Temporary confidence display.

      The exact sequence matcher will replace this after
      the Gold and Platinum sequence tables are loaded.
    */

    const confidence =
      Math.min(
        95,
        drops.length * 8
      );


    getElement(
      "confidenceValue"
    ).textContent =
      `${confidence}%`;


    getElement(
      "confidenceRing"
    ).style.background =
      `conic-gradient(
        var(--purple)
        ${confidence * 3.6}deg,
        rgba(255, 255, 255, 0.08)
        0deg
      )`;


    if (!drops.length) {

      getElement(
        "predictionTitle"
      ).textContent =
        "Not enough data";


      getElement(
        "predictionText"
      ).textContent =
        "Add drops to begin building your current sequence.";


      return;

    }


    const knownSequence =
      getCurrentChestData()
        .sequence ||
      [];


    if (!knownSequence.length) {

      getElement(
        "predictionTitle"
      ).textContent =
        "Sequence captured";


      getElement(
        "predictionText"
      ).textContent =
        `${drops.length} drops recorded. Exact matching will activate when the full ${capitalise(
          currentChest
        )} sequence table is loaded.`;


      return;

    }


    getElement(
      "predictionTitle"
    ).textContent =
      "Searching known patterns";


    getElement(
      "predictionText"
    ).textContent =
      "Comparing your recorded drops against the known chest sequence.";

  }


  /* =======================================================
     GENERAL HELPERS
  ======================================================= */

  function capitalise(
    value
  ) {

    if (!value) {

      return "";

    }


    return (
      value
        .charAt(0)
        .toUpperCase() +
      value.slice(1)
    );

  }


  function createUniqueId() {

    if (
      window.crypto &&
      typeof window.crypto
        .randomUUID ===
        "function"
    ) {

      return window.crypto
        .randomUUID();

    }


    return (
      Date.now()
        .toString(36) +
      Math.random()
        .toString(36)
        .slice(2)
    );

  }


  function escapeHtml(
    value
  ) {

    return String(
      value ?? ""
    ).replace(
      /[&<>"']/g,
      (character) => ({

        "&": "&amp;",

        "<": "&lt;",

        ">": "&gt;",

        "\"": "&quot;",

        "'": "&#039;"

      })[character]
    );

  }