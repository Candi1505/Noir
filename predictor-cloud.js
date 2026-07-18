/* ============================================================
   CHEST COMPANION V2 — CLOUD PREDICTOR LOADER
   Built by Cherubim

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

  function normaliseChestType(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
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

    /*
     * predictor_data should contain the complete
     * database object for this chest.
     */
    window.CHEST_DATA[chestType] =
      record.predictor_data;

    state.predictors[chestType] = {
      id: record.id,
      version: record.version || "",
      uploadedAt:
        record.uploaded_at || "",
      database:
        record.predictor_data
    };

    return true;
  }

  async function load() {
    if (state.loading) {
      return state;
    }

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

      let installedCount = 0;

      records.forEach(record => {
        if (installPredictor(record)) {
          installedCount += 1;
        }
      });

      state.loaded = true;
      state.source =
        installedCount > 0
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
      state.loading = false;
      dispatchReadyEvent();
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
      getStatus,
      eventName: CLOUD_EVENT
    });
})(window);