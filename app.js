/* =========================================================
   CHEST COMPANION V2
   Complete Main Application

   Built by Cherubim
   Artwork by Eff
========================================================= */

(() => {

  "use strict";


  /* =======================================================
     APP SETTINGS
  ======================================================= */

  const STORAGE_KEY =
    "chest_companion_v2";


  const CLOUD_TIMEOUT_MS =
    7000;


  const DEFAULT_STATE = {

    profile: {

      nickname:
        "Tester",

      alliance_name:
        "",

      favourite_chest:
        ""

    },

    activeSession:
      null,

    history:
      [],

    priorities: {

      gold:
        {},

      platinum:
        {}

    }

  };


  /*
    These temporary rewards allow the app to open and function
    even before the complete Gold and Platinum tables are loaded.
  */

  const FALLBACK_DATA = {

    gold: {

      rewards: [

        {

          id:
            "gold-crystals",

          name:
            "Crystals",

          quantity:
            "",

          rarity:
            "epic"

        },

        {

          id:
            "gold-breeding-tokens",

          name:
            "Breeding Tokens",

          quantity:
            "",

          rarity:
            "legendary"

        },

        {

          id:
            "gold-elemental-shards",

          name:
            "Elemental Shards",

          quantity:
            "",

          rarity:
            "epic"

        },

        {

          id:
            "gold-food",

          name:
            "Food",

          quantity:
            "",

          rarity:
            "epic"

        },

        {

          id:
            "gold-lumber",

          name:
            "Lumber",

          quantity:
            "",

          rarity:
            "epic"

        }

      ],

      sequence:
        []

    },


    platinum: {

      rewards: [

        {

          id:
            "platinum-crystals",

          name:
            "Crystals",

          quantity:
            "",

          rarity:
            "legendary"

        },

        {

          id:
            "platinum-breeding-tokens",

          name:
            "Breeding Tokens",

          quantity:
            "",

          rarity:
            "mythic"

        },

        {

          id:
            "platinum-elemental-shards",

          name:
            "Elemental Shards",

          quantity:
            "",

          rarity:
            "legendary"

        },

        {

          id:
            "platinum-food",

          name:
            "Food",

          quantity:
            "",

          rarity:
            "epic"

        },

        {

          id:
            "platinum-lumber",

          name:
            "Lumber",

          quantity:
            "",

          rarity:
            "epic"

        }

      ],

      sequence:
        []

    }

  };


  /* =======================================================
     APP STATE
  ======================================================= */

  let appState =
    loadLocalState();


  let currentUser =
    null;


  let currentChest =
    appState.activeSession?.chest ||
    "gold";


  let eventsBound =
    false;


  /* =======================================================
     DOM HELPERS
  ======================================================= */

  const getElement =
    (id) =>
      document.getElementById(id);


  const getAllElements =
    (selector) =>
      Array.from(
        document.querySelectorAll(
          selector
        )
      );


  function setText(
    element,
    value
  ) {

    if (!element) {

      return;

    }


    element.textContent =
      String(
        value ?? ""
      );

  }


  /* =======================================================
     GENERAL HELPERS
  ======================================================= */

  function cloneValue(
    value
  ) {

    return JSON.parse(
      JSON.stringify(
        value
      )
    );

  }


  function capitalise(
    value
  ) {

    const text =
      String(
        value || ""
      );


    if (!text) {

      return "";

    }


    return (
      text.charAt(0)
        .toUpperCase() +
      text.slice(1)
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

        "&":
          "&amp;",

        "<":
          "&lt;",

        ">":
          "&gt;",

        "\"":
          "&quot;",

        "'":
          "&#039;"

      })[character]
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

      "-" +

      Math.random()
        .toString(36)
        .slice(2)

    );

  }


  function formatDate(
    value
  ) {

    try {

      return new Intl
        .DateTimeFormat(
          "en-AU",
          {

            dateStyle:
              "medium",

            timeStyle:
              "short"

          }
        )
        .format(
          new Date(value)
        );

    } catch (error) {

      return String(
        value || ""
      );

    }

  }


  function withTimeout(
    promise,
    milliseconds =
      CLOUD_TIMEOUT_MS
  ) {

    return Promise.race([

      promise,

      new Promise(
        (
          resolve,
          reject
        ) => {

          window.setTimeout(
            () => {

              reject(
                new Error(
                  "Cloud connection timed out."
                )
              );

            },
            milliseconds
          );

        }
      )

    ]);

  }


  /* =======================================================
     LOCAL STORAGE
  ======================================================= */

  function loadLocalState() {

    try {

      const savedState =
        JSON.parse(

          localStorage.getItem(
            STORAGE_KEY
          ) ||

          "{}"

        );


      return {

        ...cloneValue(
          DEFAULT_STATE
        ),

        ...savedState,

        profile: {

          ...DEFAULT_STATE.profile,

          ...(
            savedState.profile ||
            {}
          )

        },

        priorities: {

          gold:
            savedState
              .priorities
              ?.gold ||
            {},

          platinum:
            savedState
              .priorities
              ?.platinum ||
            {}

        },

        history:
          Array.isArray(
            savedState.history
          )
            ? savedState.history
            : []

      };

    } catch (error) {

      console.error(
        "Chest Companion could not load local data:",
        error
      );


      return cloneValue(
        DEFAULT_STATE
      );

    }

  }


  function saveLocalState() {

    try {

      localStorage.setItem(

        STORAGE_KEY,

        JSON.stringify(
          appState
        )

      );

    } catch (error) {

      console.error(
        "Chest Companion could not save local data:",
        error
      );

    }

  }


  /* =======================================================
     CHEST DATA HELPERS
  ======================================================= */

  function normaliseReward(
    reward,
    index = 0,
    chestType =
      currentChest
  ) {

    if (
      typeof reward ===
      "string"
    ) {

      return {

        id:
          reward,

        name:
          reward,

        quantity:
          "",

        rarity:
          "epic"

      };

    }


    return {

      id:
        String(

          reward?.id ||

          reward?.key ||

          reward?.slug ||

          `${chestType}-reward-${index}`

        ),

      name:
        String(

          reward?.name ||

          reward?.reward ||

          reward?.label ||

          "Unknown reward"

        ),

      quantity:
        String(

          reward?.quantity ??

          reward?.amount ??

          reward?.value ??

          ""

        ),

      rarity:
        String(

          reward?.rarity ||

          "epic"

        )
          .toLowerCase()

    };

  }


  function getRawChestData(
    chestType =
      currentChest
  ) {

    if (
      window.CHEST_DATA?.[
        chestType
      ]
    ) {

      return window
        .CHEST_DATA[
          chestType
        ];

    }


    if (
      chestType ===
        "gold" &&
      window.GOLD_CHEST_DATA
    ) {

      return window
        .GOLD_CHEST_DATA;

    }


    if (
      chestType ===
        "platinum" &&
      window.PLATINUM_CHEST_DATA
    ) {

      return window
        .PLATINUM_CHEST_DATA;

    }


    return FALLBACK_DATA[
      chestType
    ];

  }


  function getRewards(
    chestType =
      currentChest
  ) {

    const chestData =
      getRawChestData(
        chestType
      );


    const rewardList =

      chestData?.rewards ||

      chestData?.drops ||

      chestData?.items ||

      [];


    const normalisedRewards =
      rewardList.map(
        (
          reward,
          index
        ) =>
          normaliseReward(
            reward,
            index,
            chestType
          )
      );


    if (
      normalisedRewards.length
    ) {

      return normalisedRewards;

    }


    return FALLBACK_DATA[
      chestType
    ].rewards.map(
      (
        reward,
        index
      ) =>
        normaliseReward(
          reward,
          index,
          chestType
        )
    );

  }


  function getSequence(
    chestType =
      currentChest
  ) {

    const chestData =
      getRawChestData(
        chestType
      );


    const sequenceList =

      chestData?.sequence ||

      chestData?.fullSequence ||

      chestData?.table ||

      [];


    return sequenceList.map(
      (
        entry,
        index
      ) =>
        normaliseReward(
          entry,
          index,
          chestType
        )
    );

  }


  function rewardsMatch(
    firstReward,
    secondReward
  ) {

    if (
      !firstReward ||
      !secondReward
    ) {

      return false;

    }


    const firstId =
      String(
        firstReward.id ||
        ""
      )
        .trim()
        .toLowerCase();


    const secondId =
      String(
        secondReward.id ||
        ""
      )
        .trim()
        .toLowerCase();


    if (
      firstId &&
      secondId &&
      firstId === secondId
    ) {

      return true;

    }


    const firstName =
      String(
        firstReward.name ||
        ""
      )
        .trim()
        .toLowerCase();


    const secondName =
      String(
        secondReward.name ||
        ""
      )
        .trim()
        .toLowerCase();


    const firstQuantity =
      String(
        firstReward.quantity ||
        ""
      )
        .trim()
        .toLowerCase();


    const secondQuantity =
      String(
        secondReward.quantity ||
        ""
      )
        .trim()
        .toLowerCase();


    return (

      firstName ===
        secondName &&

      (
        !firstQuantity ||

        !secondQuantity ||

        firstQuantity ===
          secondQuantity
      )

    );

  }


  function resolveSequenceReward(
    sequenceEntry
  ) {

    return (

      getRewards()
        .find(
          (reward) =>
            rewardsMatch(
              reward,
              sequenceEntry
            )
        ) ||

      sequenceEntry

    );

  }


  /* =======================================================
     LOADING AND CLOUD STATUS
  ======================================================= */

  function updateCloudBadge(
    message,
    online =
      false
  ) {

    const cloudBadge =
      getElement(
        "cloudBadge"
      );


    if (!cloudBadge) {

      return;

    }


    cloudBadge.textContent =
      message;


    cloudBadge.classList.toggle(
      "online",
      online
    );

  }


  function openApplicationShell() {

    getElement(
      "loadingScreen"
    )?.classList.add(
      "hidden"
    );


    getElement(
      "appShell"
    )?.classList.remove(
      "hidden"
    );

  }


  async function startApplication() {

    bindEvents();

    loadProfileIntoScreen();

    renderHomeScreen();


    updateCloudBadge(
      "Connecting...",
      false
    );


    setText(

      getElement(
        "loadingStatus"
      ),

      "Connecting to the Crystal Nexus..."

    );


    try {

      if (
        !window
          .ChestDatabase
          ?.initialisePlayer
      ) {

        throw new Error(
          "Database tools are unavailable."
        );

      }


      const player =
        await withTimeout(

          window
            .ChestDatabase
            .initialisePlayer()

        );


      currentUser =
        player?.user ||
        null;


      if (
        player?.profile
      ) {

        appState.profile = {

          nickname:

            player
              .profile
              .nickname ||

            appState
              .profile
              .nickname ||

            "Tester",

          alliance_name:

            player
              .profile
              .alliance_name ||

            appState
              .profile
              .alliance_name ||

            "",

          favourite_chest:

            player
              .profile
              .favourite_chest ||

            appState
              .profile
              .favourite_chest ||

            ""

        };


        saveLocalState();

      }


      updateCloudBadge(
        "Cloud connected",
        true
      );


      setText(

        getElement(
          "loadingStatus"
        ),

        "✓ Connected"

      );

    } catch (error) {

      console.warn(
        "Chest Companion is opening in device mode:",
        error
      );


      updateCloudBadge(
        "Device mode",
        false
      );


      setText(

        getElement(
          "loadingStatus"
        ),

        "Cloud unavailable — opening device mode"

      );

    } finally {

      loadProfileIntoScreen();

      renderHomeScreen();


      window.setTimeout(
        () => {

          openApplicationShell();

        },
        500
      );

    }

  }
    /* =======================================================
     VIEW NAVIGATION
  ======================================================= */

  function showView(
    viewId,
    pageTitle =
      "Chest Companion"
  ) {

    getAllElements(
      ".view"
    ).forEach(
      (view) => {

        view.classList.toggle(

          "active",

          view.id ===
            viewId

        );

      }
    );


    getAllElements(
      ".navigation-button"
    ).forEach(
      (button) => {

        button.classList.toggle(

          "active",

          button.dataset
            .view ===
            viewId

        );

      }
    );


    setText(

      getElement(
        "pageTitle"
      ),

      pageTitle

    );


    if (
      viewId ===
      "historyView"
    ) {

      renderHistory();

    }


    if (
      viewId ===
      "profileView"
    ) {

      loadProfileIntoScreen();

    }


    window.scrollTo({

      top:
        0,

      behavior:
        "smooth"

    });

  }


  /* =======================================================
     PROFILE
  ======================================================= */

  function loadProfileIntoScreen() {

    const profile =
      appState.profile;


    setText(

      getElement(
        "welcomeName"
      ),

      profile.nickname ||
      "Tester"

    );


    const nicknameInput =
      getElement(
        "nicknameInput"
      );


    const allianceInput =
      getElement(
        "allianceInput"
      );


    const favouriteChestInput =
      getElement(
        "favouriteChestInput"
      );


    if (
      nicknameInput
    ) {

      nicknameInput.value =

        profile.nickname ||

        "Tester";

    }


    if (
      allianceInput
    ) {

      allianceInput.value =

        profile.alliance_name ||

        "";

    }


    if (
      favouriteChestInput
    ) {

      favouriteChestInput.value =

        profile.favourite_chest ||

        "";

    }

  }


  async function saveProfile() {

    const saveButton =
      getElement(
        "saveProfileButton"
      );


    const profileMessage =
      getElement(
        "profileMessage"
      );


    const profile = {

      nickname:

        getElement(
          "nicknameInput"
        )
          ?.value
          .trim() ||

        "Tester",

      alliance_name:

        getElement(
          "allianceInput"
        )
          ?.value
          .trim() ||

        "",

      favourite_chest:

        getElement(
          "favouriteChestInput"
        )
          ?.value ||

        ""

    };


    if (
      saveButton
    ) {

      saveButton.disabled =
        true;

    }


    setText(

      profileMessage,

      "Saving..."

    );


    appState.profile =
      profile;


    saveLocalState();

    loadProfileIntoScreen();

    renderHomeScreen();


    try {

      if (

        currentUser?.id &&

        window
          .ChestDatabase
          ?.saveProfile

      ) {

        await withTimeout(

          window
            .ChestDatabase
            .saveProfile(

              currentUser.id,

              profile

            )

        );


        setText(

          profileMessage,

          "Profile saved to the Crystal Nexus."

        );

      } else {

        setText(

          profileMessage,

          "Profile saved on this device."

        );

      }

    } catch (error) {

      console.error(

        "Profile cloud save failed:",

        error

      );


      setText(

        profileMessage,

        "Saved on this device, but cloud sync failed."

      );

    } finally {

      if (
        saveButton
      ) {

        saveButton.disabled =
          false;

      }

    }

  }


  /* =======================================================
     HOME SCREEN
  ======================================================= */

  function renderHomeScreen() {

    setText(

      getElement(
        "welcomeName"
      ),

      appState
        .profile
        .nickname ||

      "Tester"

    );


    const activeSession =
      appState.activeSession;


    const resumeButton =
      getElement(
        "resumeSessionButton"
      );


    if (
      !activeSession
    ) {

      setText(

        getElement(
          "activeSessionTitle"
        ),

        "No active session"

      );


      setText(

        getElement(
          "activeSessionText"
        ),

        "Start Gold or Platinum tracking to build a visible sequence."

      );


      resumeButton
        ?.classList
        .add(
          "hidden"
        );


      return;

    }


    setText(

      getElement(
        "activeSessionTitle"
      ),

      `${capitalise(
        activeSession.chest
      )} session`

    );


    setText(

      getElement(
        "activeSessionText"
      ),

      `${activeSession.drops.length} drops recorded. Your sequence is ready to resume.`

    );


    resumeButton
      ?.classList
      .remove(
        "hidden"
      );

  }


  /* =======================================================
     TRACKER SESSION
  ======================================================= */

  function createSession(
    chestType
  ) {

    return {

      id:
        createUniqueId(),

      chest:
        chestType,

      startedAt:
        new Date()
          .toISOString(),

      drops:
        []

    };

  }


  function openChestTracker(
    chestType
  ) {

    currentChest =
      chestType;


    if (

      !appState
        .activeSession ||

      appState
        .activeSession
        .chest !==
        chestType

    ) {

      appState.activeSession =
        createSession(
          chestType
        );


      saveLocalState();

    }


    renderTrackerScreen();


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


    renderTrackerScreen();


    showView(

      "trackerView",

      `${capitalise(
        currentChest
      )} Tracker`

    );

  }


  function renderTrackerScreen() {

    setText(

      getElement(
        "trackerChestLabel"
      ),

      `${currentChest.toUpperCase()} CHEST`

    );


    const searchInput =
      getElement(
        "dropSearchInput"
      );


    if (
      searchInput
    ) {

      searchInput.value =
        "";

    }


    renderDropButtons();

    renderCurrentSequence();

    renderPriorities();

    renderFullSequenceTable();

    updatePrediction();

    renderStrategy();

  }


  /* =======================================================
     DROP BUTTONS
  ======================================================= */

  function renderDropButtons(
    searchText =
      ""
  ) {

    const dropButtons =
      getElement(
        "dropButtons"
      );


    if (
      !dropButtons
    ) {

      return;

    }


    const searchValue =
      searchText
        .trim()
        .toLowerCase();


    const filteredRewards =
      getRewards()
        .filter(
          (reward) => {

            const searchableText =

              `${reward.name} ${reward.quantity} ${reward.rarity}`

                .toLowerCase();


            return searchableText
              .includes(
                searchValue
              );

          }
        );


    if (
      !filteredRewards.length
    ) {

      dropButtons.innerHTML = `

        <p class="muted-text">

          No matching rewards found.

        </p>

      `;


      return;

    }


    dropButtons.innerHTML =

      filteredRewards
        .map(
          (reward) => `

            <button

              type="button"

              class="drop-button"

              data-drop-id="${escapeHtml(
                reward.id
              )}"

            >

              <strong

                class="${escapeHtml(
                  reward.rarity
                )}-text"

              >

                ${escapeHtml(
                  reward.name
                )}

              </strong>


              <small>

                ${escapeHtml(
                  reward.quantity
                )}

                ${
                  reward.quantity
                    ? " · "
                    : ""
                }

                ${capitalise(
                  reward.rarity
                )}

              </small>

            </button>

          `
        )
        .join("");

  }


  function addDropToSession(
    rewardId
  ) {

    const activeSession =
      appState.activeSession;


    if (
      !activeSession
    ) {

      return;

    }


    const selectedReward =
      getRewards()
        .find(
          (reward) =>
            reward.id ===
            rewardId
        );


    if (
      !selectedReward
    ) {

      console.warn(

        "Chest Companion could not find this reward:",

        rewardId

      );


      return;

    }


    activeSession.drops.push({

      ...selectedReward,

      loggedAt:
        new Date()
          .toISOString()

    });


    saveLocalState();

    renderCurrentSequence();

    updatePrediction();

    renderStrategy();

    renderHomeScreen();

  }


  function undoLastDrop() {

    const drops =
      appState
        .activeSession
        ?.drops;


    if (
      !drops?.length
    ) {

      return;

    }


    drops.pop();


    saveLocalState();

    renderCurrentSequence();

    updatePrediction();

    renderStrategy();

    renderHomeScreen();

  }


  /* =======================================================
     CURRENT SEQUENCE DISPLAY
  ======================================================= */

  function renderCurrentSequence() {

    const drops =

      appState
        .activeSession
        ?.drops ||

      [];


    const sequenceStrip =
      getElement(
        "sequenceStrip"
      );


    setText(

      getElement(
        "sequenceCount"
      ),

      drops.length

    );


    const undoButton =
      getElement(
        "undoDropButton"
      );


    if (
      undoButton
    ) {

      undoButton.disabled =
        drops.length ===
        0;

    }


    if (
      !sequenceStrip
    ) {

      return;

    }


    if (
      !drops.length
    ) {

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


              <strong

                class="${escapeHtml(
                  drop.rarity
                )}-text"

              >

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
     SEQUENCE MATCHING
  ======================================================= */

  function findSequenceMatches() {

    const recordedDrops =

      appState
        .activeSession
        ?.drops ||

      [];


    const fullSequence =
      getSequence();


    if (

      !recordedDrops.length ||

      !fullSequence.length

    ) {

      return [];

    }


    const matchingPositions =
      [];


    for (

      let startingPosition =
        0;

      startingPosition <
        fullSequence.length;

      startingPosition +=
        1

    ) {

      let positionMatches =
        true;


      for (

        let recordedIndex =
          0;

        recordedIndex <
          recordedDrops.length;

        recordedIndex +=
          1

      ) {

        const sequenceEntry =

          fullSequence[

            (
              startingPosition +
              recordedIndex
            ) %

            fullSequence.length

          ];


        const recordedDrop =

          recordedDrops[
            recordedIndex
          ];


        if (

          !rewardsMatch(

            sequenceEntry,

            recordedDrop

          )

        ) {

          positionMatches =
            false;


          break;

        }

      }


      if (
        positionMatches
      ) {

        matchingPositions.push(
          startingPosition
        );

      }

    }


    return matchingPositions;

  }
    /* =======================================================
     PREDICTION ENGINE
  ======================================================= */

  function updatePrediction() {

    const recordedDrops =
      appState.activeSession?.drops || [];

    const fullSequence =
      getSequence();

    const matches =
      findSequenceMatches();

    let confidence = 0;

    let title =
      "Not enough data";

    let prediction =
      "Record more drops to begin identifying your position in the sequence.";


    if (
      recordedDrops.length &&
      !fullSequence.length
    ) {

      confidence =
        Math.min(
          90,
          15 + recordedDrops.length * 8
        );

      title =
        "Sequence Captured";

      prediction =
        `${recordedDrops.length} drops recorded. Exact prediction will activate once the full sequence table has been loaded.`;

    }

    else if (
      recordedDrops.length &&
      matches.length === 1
    ) {

      confidence =
        Math.min(
          99,
          55 + recordedDrops.length * 9
        );

      const nextPosition =

        (
          matches[0] +
          recordedDrops.length
        ) %

        fullSequence.length;


      const nextReward =

        resolveSequenceReward(
          fullSequence[
            nextPosition
          ]
        );


      title =
        "Pattern Located";


      prediction =
        `Likely next reward: ${nextReward.name}${nextReward.quantity ? ` — ${nextReward.quantity}` : ""}`;

    }

    else if (
      recordedDrops.length &&
      matches.length > 1
    ) {

      confidence =
        Math.min(
          94,
          35 + recordedDrops.length * 8
        );

      title =
        "Searching...";

      prediction =
        `${matches.length} possible positions remain.`;

    }

    else if (
      recordedDrops.length
    ) {

      confidence =
        10;

      title =
        "No Match Yet";

      prediction =
        "Continue recording rewards or undo the previous reward if it was incorrect.";

    }


    setText(

      getElement(
        "predictionTitle"
      ),

      title

    );


    setText(

      getElement(
        "predictionText"
      ),

      prediction

    );


    setText(

      getElement(
        "confidenceValue"
      ),

      `${confidence}%`

    );


    const confidenceRing =
      getElement(
        "confidenceRing"
      );


    if (
      confidenceRing
    ) {

      confidenceRing.style.background =

        `conic-gradient(

          var(--purple)

          ${confidence * 3.6}deg,

          rgba(255,255,255,.08)

          0deg

        )`;

    }

  }


  /* =======================================================
     PRIORITIES
  ======================================================= */

  function renderPriorities() {

    const priorityContainer =
      getElement(
        "priorityGroups"
      );

    if (!priorityContainer) {

      return;

    }


    const savedPriorities =

      appState.priorities[
        currentChest
      ] || {};


    priorityContainer.innerHTML =

      getRewards()

        .map(

          (reward) => {

            const priority =

              savedPriorities[
                reward.id
              ] ||

              {

                weight: 50,

                avoid: false

              };


            return `

              <div
                class="priority-row"
                data-priority-id="${reward.id}"
              >

                <div>

                  <strong
                    class="${reward.rarity}-text"
                  >

                    ${reward.name}

                  </strong>

                  <small>

                    ${reward.quantity}

                  </small>

                </div>

                <input

                  class="priority-range"

                  type="range"

                  min="0"

                  max="100"

                  value="${priority.weight}"

                >

                <output
                  class="priority-value"
                >

                  ${priority.weight}

                </output>

                <label>

                  <input

                    class="priority-avoid"

                    type="checkbox"

                    ${priority.avoid ? "checked" : ""}

                  >

                  Avoid

                </label>

              </div>

            `;

          }

        )

        .join("");

  }


  function savePriorities() {

    const newPriorities =
      {};

    getAllElements(

      "#priorityGroups .priority-row"

    ).forEach(

      (row) => {

        newPriorities[
          row.dataset.priorityId
        ] = {

          weight:

            Number(

              row.querySelector(
                ".priority-range"
              ).value

            ),

          avoid:

            row.querySelector(
              ".priority-avoid"
            ).checked

        };

      }

    );


    appState.priorities[
      currentChest
    ] =

      newPriorities;


    saveLocalState();


    renderStrategy();

  }


  /* =======================================================
     STRATEGY PANEL
  ======================================================= */

  function renderStrategy() {

    const strategy =
      getElement(
        "strategyBreakdown"
      );

    if (!strategy) {

      return;

    }


    const priorities =

      appState.priorities[
        currentChest
      ] || {};


    const orderedRewards =

      getRewards()

        .map(

          (reward) => {

            const settings =

              priorities[
                reward.id
              ] ||

              {

                weight: 50,

                avoid: false

              };


            let score =
              settings.weight;


            if (
              reward.rarity ===
              "legendary"
            ) {

              score +=
                20;

            }


            if (
              reward.rarity ===
              "mythic"
            ) {

              score +=
                30;

            }


            if (
              settings.avoid
            ) {

              score -=
                100;

            }


            return {

              reward,

              score,

              avoid:
                settings.avoid

            };

          }

        )

        .sort(

          (a, b) =>

            b.score -
            a.score

        );


    strategy.innerHTML = `

      <p>

        Highest Priority:

        <strong>

          ${orderedRewards[0]?.reward.name || "None"}

        </strong>

      </p>

      <p>

        Priority Score:

        ${orderedRewards[0]?.score || 0}

      </p>

    `;

  }
  
    /* =======================================================
     FULL SEQUENCE TABLE
  ======================================================= */

  function toggleFullTable() {

    const tableContainer =
      getElement("fullSequenceTable");

    const toggleButton =
      getElement("toggleFullTableButton");

    if (!tableContainer) {

      return;

    }

    const isHidden =
      tableContainer.hidden ||
      tableContainer.style.display === "none";

    if (isHidden) {

      tableContainer.hidden = false;
      tableContainer.style.display = "block";

      renderFullSequenceTable();

      if (toggleButton) {

        toggleButton.textContent = "Hide";

      }

    } else {

      tableContainer.hidden = true;
      tableContainer.style.display = "none";

      if (toggleButton) {

        toggleButton.textContent = "Show";

      }

    }

  }
  function renderFullSequenceTable() {

    const tableContainer =
      getElement("fullSequenceTable");

    if (!tableContainer) return;

    const sequence =
      getSequence();

    if (!sequence.length) {

      tableContainer.innerHTML = `
        <p class="muted-text">
          Full sequence data has not been loaded yet.
        </p>
      `;

      return;

    }

    tableContainer.innerHTML = sequence
      .map((reward, index) => {

        const item =
          resolveSequenceReward(reward);

        return `
          <div class="sequence-row">

            <span class="sequence-index">
              ${index + 1}
            </span>

            <strong class="${item.rarity}-text">
              ${item.name}
            </strong>

            <span>
              ${item.quantity}
            </span>

          </div>
        `;

      })
      .join("");

  }


  /* =======================================================
     HISTORY
  ======================================================= */

  function renderHistory() {

    const historyContainer =
      getElement("historyList");

    if (!historyContainer) return;

    const history =
      appState.history || [];

    if (!history.length) {

      historyContainer.innerHTML = `
        <p class="muted-text">
          No completed sessions yet.
        </p>
      `;

      return;

    }

    historyContainer.innerHTML = history.map(session => `

      <div class="history-card">

        <h3>

          ${capitalise(session.chest)} Chest

        </h3>

        <small>

          ${formatDate(session.finishedAt)}

        </small>

        <p>

          ${session.drops.length} drops recorded

        </p>

      </div>

    `).join("");

  }


  function finishSession() {

    if (!appState.activeSession) {

      return;

    }

    appState.activeSession.finishedAt =
      new Date().toISOString();

    appState.history.unshift(
      appState.activeSession
    );

    appState.activeSession =
      null;

    saveLocalState();

    renderHomeScreen();

    renderHistory();

    showView(
      "historyView",
      "History"
    );

  }


  /* =======================================================
     RESET
  ======================================================= */

  function resetApplication() {

    if (
      !confirm(
        "Reset all saved Chest Companion data?"
      )
    ) {

      return;

    }

    localStorage.removeItem(
      STORAGE_KEY
    );

    location.reload();

  }


  /* =======================================================
     EVENT LISTENERS
  ======================================================= */

  function bindEvents() {

    if (eventsBound) {

      return;

    }

    eventsBound = true;


    getAllElements(
      ".navigation-button"
    ).forEach(button => {

      button.addEventListener(
        "click",
        () => {

          showView(
            button.dataset.view,
            button.dataset.title
          );

        }
      );

    });


    getElement(
      "resumeSessionButton"
    )?.addEventListener(
      "click",
      resumeActiveSession
    );


    getElement(
      "saveProfileButton"
    )?.addEventListener(
      "click",
      saveProfile
    );


    getElement(
      "undoDropButton"
    )?.addEventListener(
      "click",
      undoLastDrop
    );


    getElement(
      "finishSessionButton"
    )?.addEventListener(
      "click",
      finishSession
    );


    getElement(
      "savePrioritiesButton"
    )?.addEventListener(
      "click",
      savePriorities
    );
        
    getElement(
      "toggleFullTableButton"
    )?.addEventListener(
      "click",
      toggleFullTable
    );


    getElement(
      "resetLocalDataButton"
    )?.addEventListener(
      "click",
      resetApplication
    );


    getElement(
      "dropSearchInput"
    )?.addEventListener(
      "input",
      event => {

        renderDropButtons(
          event.target.value
        );

      }
    );


    getElement(
      "dropButtons"
    )?.addEventListener(
      "click",
      event => {

        const button =
          event.target.closest(
            "[data-drop-id]"
          );

        if (!button) return;

        addDropToSession(
          button.dataset.dropId
        );

      }
    );


    getAllElements(
      "[data-open-chest]"
    ).forEach(button => {

      button.addEventListener(
        "click",
        () => {

          openChestTracker(
            button.dataset.openChest
          );

        }
      );

    });

  }


  /* =======================================================
     STARTUP
  ======================================================= */

  window.addEventListener(
    "error",
    error => {

      console.error(error);

      openApplicationShell();

    }
  );


  window.addEventListener(
    "unhandledrejection",
    error => {

      console.error(error);

      openApplicationShell();

    }
  );


  if (
    document.readyState ===
    "loading"
  ) {

    document.addEventListener(

      "DOMContentLoaded",

      startApplication,

      {
        once: true
      }

    );

  } else {

    startApplication();

  }

})();