/* ============================================================
   CHEST COMPANION V2 — CLOUD PREDICTOR LOADER
   

   Downloads active predictor databases from Supabase and
   exposes them through window.CHEST_DATA.
   ============================================================ */

(function initialiseCloudPredictors(window) {
  "use strict";

  const CLOUD_EVENT =
    "chest-companion-predictors-ready";

  const state = {
    loading: false,
    loaded: false,
    source: "device",
    error: null,
    predictors: {}
  };
  let loadGeneration = 0;

  function invalidate() {
    loadGeneration += 1;
    state.loading = false;
    state.loaded = false;
    state.source = "device";
    state.error = null;
    state.predictors = {};
  }

  function normaliseChestType(value) {
  const chest = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  if (chest.includes("platinum")) {
    return "platinum";
  }

  if (chest.includes("gold")) {
    return "gold";
  }

  if (chest.includes("draconic")) {
    return "draconic";
  }

  if (chest.includes("freedom")) {
    return "freedom";
  }

  if (chest.includes("arcane")) {
    return "arcane";
  }

  if (
    chest.includes("super sigil") ||
    chest.includes("sigil")
  ) {
    return "super_sigil";
  }

  return chest;
}

  function getDatabaseService() {
    return (
      window.ChestDatabase ||
      window.chestDatabase ||
      window.Database ||
      window.database ||
      null
    );
  }

  function dispatchReadyEvent() {
    window.dispatchEvent(
      new CustomEvent(
        CLOUD_EVENT,
        {
          detail: {
            ...state
          }
        }
      )
    );
  }

  function sanitiseEventForPlayer(
    publishedEvent
  ) {
    const eventData =
      JSON.parse(
        JSON.stringify(
          publishedEvent || {}
        )
      );

    // Upload details and captured cursors belong only to the administrator
    // who supplied the HAR. Every player must solve their own position.
    [
      "sourceFile",
      "fileName",
      "filename"
    ].forEach(field => {
      delete eventData[field];
    });

    eventData.deckIndices = {};
    delete eventData.deck_indices;

    const privateChestFields = [
      "index",
      "foundIndex",
      "sourceIndex",
      "currentValue",
      "openedSinceBonus",
      "chestsUntilBonus",
      "nextChestIsBonus"
    ];

    Object.values(
      eventData.chests || {}
    ).forEach(chestData => {
      if (
        !chestData ||
        typeof chestData !== "object"
      ) {
        return;
      }

      privateChestFields.forEach(
        field => {
          delete chestData[field];
        }
      );
    });

    Object.values(
      eventData.doubleArmory?.sides || {}
    ).forEach(sideData => {
      if (
        sideData &&
        typeof sideData === "object"
      ) {
        delete sideData.deckIndices;
        delete sideData.deck_indices;
      }
    });

    return eventData;
  }

  function sanitisePredictorForPlayer(
    publishedPredictor
  ) {
    const predictorData =
      JSON.parse(
        JSON.stringify(
          publishedPredictor || {}
        )
      );

    [
      "sourceFile",
      "fileName",
      "filename"
    ].forEach(field => {
      delete predictorData[field];
    });

    delete predictorData.deckIndices;
    delete predictorData.deck_indices;

    if (
      predictorData.eventData &&
      typeof predictorData.eventData ===
        "object"
    ) {
      predictorData.eventData =
        sanitiseEventForPlayer(
          predictorData.eventData
        );
    }

    return predictorData;
  }

  function installPredictor(record) {
    if (
      !record ||
      !record.predictor_data
    ) {
      return false;
    }

    const chestType =
      normaliseChestType(
        record.chest_type
      );

    if (!chestType) {
      return false;
    }

    window.CHEST_DATA =
      window.CHEST_DATA || {};

    const predictorData =
      sanitisePredictorForPlayer(
        record.predictor_data
      );

    /*
     * predictor_data should contain the complete
     * database object for this chest.
     */
    window.CHEST_DATA[chestType] =
      predictorData;

    state.predictors[chestType] = {
      id: record.id,
      version: record.version || "",
      uploadedAt:
        record.uploaded_at || "",
      database:
        predictorData
    };

    return true;
  }

  function installPublishedEvent(records) {
    const liveRecords = records
      .filter(
        record =>
          record?.predictor_data?.schema ===
            "noir-live-event-v1" &&
          record.predictor_data.eventData
      )
      .sort(
        (left, right) =>
          String(
            right.predictor_data
              .eventData.publishedAt ||
            right.uploaded_at ||
            ""
          ).localeCompare(
            String(
              left.predictor_data
                .eventData.publishedAt ||
              left.uploaded_at ||
              ""
            )
          )
      );

    const newest =
      liveRecords[0]?.predictor_data
        ?.eventData;

    if (!newest) {
      return false;
    }

    const eventData =
      sanitiseEventForPlayer(newest);

    window.currentEventData = eventData;
    window.currentEventSourceFile =
      null;
    window.ChestCompanionPublishedEvent = {
      data: eventData,
      sourceFile: null,
      publishedAt:
        eventData.publishedAt || null
    };

    // Shared deck data remains in page memory. Persisting it under the old
    // global key made it impossible to prove that a prior private import had
    // not been inherited on a shared browser.
    try {
      window.localStorage.removeItem(
        "chestCompanionPublishedEvent"
      );
    } catch (error) {
      // Page-memory data is already authoritative.
    }

    window.dispatchEvent(
      new CustomEvent(
        "noir:event-imported",
        {
          detail: {
            restored: true,
            cloud: true,
            parsed: eventData,
            eventData,
            gachaData: null,
            sourceFile: null
          }
        }
      )
    );

    return true;
  }

  async function load() {
    if (state.loading) {
      return state;
    }

    const operationGeneration =
      ++loadGeneration;
    state.loading = true;
    state.error = null;

    try {
      const databaseService =
        getDatabaseService();

      if (
        !databaseService ||
        typeof databaseService
          .getActivePredictors !==
          "function"
      ) {
        throw new Error(
          "Predictor database service is unavailable."
        );
      }

      const records =
        await databaseService
          .getActivePredictors();

      if (
        operationGeneration !==
          loadGeneration
      ) {
        return state;
      }

      let installedCount = 0;

      records.forEach(record => {
        if (installPredictor(record)) {
          installedCount += 1;
        }
      });

      const eventInstalled =
        installPublishedEvent(records);

      state.loaded = true;
      state.source =
        installedCount > 0 ||
        eventInstalled
          ? "cloud"
          : "device";

      console.info(
        "[Chest Companion] Cloud predictors loaded.",
        {
          installedCount,
          chestTypes:
            Object.keys(
              state.predictors
            )
        }
      );
    } catch (error) {
      if (
        operationGeneration !==
          loadGeneration
      ) {
        return state;
      }
      state.loaded = true;
      state.source = "device";
      state.error =
        error?.message ||
        String(error);

      console.warn(
        "[Chest Companion] Cloud predictors unavailable. Using device data.",
        error
      );
    } finally {
      if (
        operationGeneration ===
          loadGeneration
      ) {
        state.loading = false;
        dispatchReadyEvent();
      }
    }

    return state;
  }

  function getStatus() {
    return {
      loading: state.loading,
      loaded: state.loaded,
      source: state.source,
      error: state.error,
      chestTypes:
        Object.keys(
          state.predictors
        ),
      predictors: {
        ...state.predictors
      }
    };
  }

  window.ChestPredictorCloud =
    Object.freeze({
      load,
      invalidate,
      getStatus,
      eventName: CLOUD_EVENT
    });

  window.addEventListener(
    "noir:event-imported",
    event => {
      if (event?.detail?.privateImport === true) {
        invalidate();
      }
    }
  );
  window.addEventListener(
    "noir:signout-started",
    invalidate
  );
})(window);
