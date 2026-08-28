"use strict";

/*
 * Noir Chest Companion
 * Private HAR chest-event importer
 *
 * Responsibilities:
 * - Read an uploaded .har or .har.zip file
 * - Parse the WD about_v2 response
 * - Detect Gold, Platinum, Draconic, Freedom and Arcane decks
 * - Parse use_gacha requests when the file is a HAR capture
 * - Keep imported capture information in memory only
 * - Notify the rest of Noir when new data becomes available
 */

const LIVE_EVENT_STORAGE_KEY =
  "chestCompanionLiveEventData";

const LIVE_GACHA_STORAGE_KEY =
  "chestCompanionLiveGachaData";

const CHEST_IMPORT_WORKER_URL =
  "chest-har-import-worker.js?v=20260828-audit-2";

const MAX_DIRECT_IMPORT_BYTES =
  128 * 1024 * 1024;

const MAX_MAIN_THREAD_FALLBACK_BYTES =
  32 * 1024 * 1024;

let importGeneration = 0;
let activeCaptureRequest = null;

function cancelledImportError() {
  const error = new Error(
    "The private capture import was cancelled."
  );
  error.code = "IMPORT_CANCELLED";
  return error;
}

function cancelActiveCapture() {
  activeCaptureRequest?.cancel?.();
  activeCaptureRequest = null;
}

function clearLegacyImportStorage() {
  try {
    localStorage.removeItem(
      LIVE_EVENT_STORAGE_KEY
    );
    localStorage.removeItem(
      LIVE_GACHA_STORAGE_KEY
    );
  } catch (error) {
    console.warn(
      "[Chest Companion] Legacy private import data could not be cleared."
    );
  }
}

function clearImportData({
  resetInterface = true,
  clearFileInput = true
} = {}) {
  importGeneration += 1;
  cancelActiveCapture();

  window.currentEventData = null;
  window.currentGachaData = null;
  window.currentEventSourceFile = null;
  window.OnyxTowerInventoryBridge
    ?.clear?.();

  try {
    delete window.ChestCompanionLastImport;
  } catch (error) {
    window.ChestCompanionLastImport = null;
  }

  clearLegacyImportStorage();

  window.dispatchEvent?.(
    new CustomEvent(
      "noir:private-import-cleared"
    )
  );

  if (clearFileInput) {
    const fileInput =
      document.getElementById("eventDataFile");

    if (fileInput) {
      fileInput.value = "";
    }
  }

  [
    "goldPredictorBadge",
    "platinumPredictorBadge",
    "draconicPredictorBadge",
    "freedomPredictorBadge",
    "arcanePredictorBadge"
  ].forEach(id => {
    const predictorBadge =
      document.getElementById(id);
    if (predictorBadge) {
      predictorBadge.textContent =
        "Not detected";
    }
  });

  if (!resetInterface) {
    return;
  }

  const results =
    document.getElementById("eventImportResults");
  const statusText =
    document.getElementById("eventImportStatus");
  const badge =
    document.getElementById("eventImportBadge");

  if (results) {
    results.textContent = "";
    results.classList.add("hidden");
  }

  if (statusText) {
    statusText.textContent =
      "No private event capture is loaded.";
  }

  if (badge) {
    badge.textContent = "Not imported";
    badge.classList.remove(
      "ready",
      "failed",
      "loading"
    );
  }

}

window.OnyxEventImportPrivacy = {
  ...(window.OnyxEventImportPrivacy || {}),
  clearImportData,
  clearPrivateImport: clearImportData
};

/* Sign-out can clear private memory without opening this panel. */
window.clearOnyxChestImportData =
  clearImportData;

clearLegacyImportStorage();

function sanitiseLastImportDiagnostics() {
  const lastImport =
    window.ChestCompanionLastImport;
  const diagnostics =
    lastImport?.diagnostics || {};

  if (!lastImport) {
    return;
  }

  window.ChestCompanionLastImport = {
    kind:
      lastImport.kind === "har"
        ? "har"
        : "json",
    importedAt:
      lastImport.importedAt ||
      new Date().toISOString(),
    diagnostics: {
      eventName:
        diagnostics.eventName || null,
      eventKey:
        diagnostics.eventKey || null,
      rewardPoolCount:
        Number(diagnostics.rewardPoolCount) || 0,
      availableChestTypes:
        Array.isArray(
          diagnostics.availableChestTypes
        )
          ? diagnostics.availableChestTypes
              .map(value => String(value))
              .slice(0, 6)
          : [],
      arcaneBonusVerified:
        diagnostics.arcaneBonusVerified === true,
      doubleArmoryDetected:
        diagnostics.doubleArmoryDetected === true
    }
  };
}

function readCaptureWithWorker(
  file,
  isCancelled = () => false
) {
  return new Promise((resolve, reject) => {
    let worker;
    let settled = false;

    if (isCancelled()) {
      reject(cancelledImportError());
      return;
    }

    try {
      worker = new Worker(
        CHEST_IMPORT_WORKER_URL
      );
    } catch (error) {
      reject(
        new Error(
          "The private capture reader could not start."
        )
      );
      return;
    }

    const request = {
      worker,
      cancel: null
    };

    const finish = callback => value => {
      if (settled) return;
      settled = true;
      worker.terminate();
      if (activeCaptureRequest === request) {
        activeCaptureRequest = null;
      }
      callback(value);
    };

    const succeed = finish(resolve);
    const fail = finish(reject);
    request.cancel = () =>
      fail(cancelledImportError());

    activeCaptureRequest?.cancel?.();
    activeCaptureRequest = request;

    worker.addEventListener("message", event => {
      const message = event?.data || {};

      if (message.type === "progress") {
        return;
      }

      if (
        message.type === "success" &&
        message.eventData &&
        typeof message.eventData === "object"
      ) {
        succeed({
          eventData: message.eventData,
          gachaData:
            message.gachaData || null,
          towerInventory:
            message.towerInventory || null,
          importDiagnostics:
            message.importDiagnostics || null,
          zipped: message.zipped === true
        });
        return;
      }

      fail(
        new Error(
          message.message ||
          "The private capture could not be read."
        )
      );
    });

    worker.addEventListener("error", () => {
      fail(
        new Error(
          "The private capture reader stopped unexpectedly."
        )
      );
    });

    try {
      worker.postMessage({
        type: "import",
        file
      });
    } catch (error) {
      fail(
        new Error(
          "The private capture reader could not receive this file."
        )
      );
    }
  });
}

async function readPrivateCapture(
  file,
  isCancelled = () => false
) {
  if (!(file instanceof Blob)) {
    throw new Error(
      "Choose a supported private event capture."
    );
  }

  if (
    file.size < 2 ||
    file.size > MAX_DIRECT_IMPORT_BYTES
  ) {
    throw new Error(
      "This event capture is outside the safe import limits."
    );
  }

  if (isCancelled()) {
    throw cancelledImportError();
  }

  const signature =
    new Uint8Array(
      await file.slice(0, 4).arrayBuffer()
    );

  if (isCancelled()) {
    throw cancelledImportError();
  }
  const zipped =
    signature[0] === 0x50 &&
    signature[1] === 0x4b;

  let result;

  if (typeof Worker === "function") {
    try {
      result = await readCaptureWithWorker(
        file,
        isCancelled
      );
    } catch (error) {
      if (
        error?.code === "IMPORT_CANCELLED"
      ) {
        throw error;
      }

      if (zipped) {
        throw new Error(
          "This zipped capture could not be parsed privately in this browser. Try again or extract a small HAR file first."
        );
      }

      if (
        file.size >
          MAX_MAIN_THREAD_FALLBACK_BYTES
      ) {
        throw new Error(
          "This capture is too large to parse safely without the private background reader. Try again in an up-to-date browser."
        );
      }
    }
  } else {
    if (zipped) {
      throw new Error(
        "This browser cannot privately open zipped captures. Extract the .har file first."
      );
    }

    if (
      file.size >
        MAX_MAIN_THREAD_FALLBACK_BYTES
    ) {
      throw new Error(
        "This capture is too large to parse safely in this browser. Use an up-to-date browser with the private background reader."
      );
    }
  }

  if (result) {
    if (isCancelled()) {
      throw cancelledImportError();
    }
    return {
      ...result,
      workerParsed: true
    };
  }

  let buffer = await file.arrayBuffer();

  if (isCancelled()) {
    buffer = null;
    throw cancelledImportError();
  }
  let text;

  try {
    text = new TextDecoder(
      "utf-8",
      { fatal: true }
    ).decode(buffer);
  } catch (error) {
    throw new Error(
      "The selected event capture is not valid UTF-8 text."
    );
  } finally {
    buffer = null;
  }

  if (!text.trim()) {
    throw new Error(
      "The selected event file is empty."
    );
  }

  let importedData;

  if (isCancelled()) {
    text = "";
    throw cancelledImportError();
  }

  try {
    importedData = JSON.parse(text);
  } catch (error) {
    throw new Error(
      "The selected event capture is not valid JSON."
    );
  } finally {
    text = "";
  }

  if (isCancelled()) {
    importedData = null;
    throw cancelledImportError();
  }

  return {
    importedData,
    zipped: false,
    workerParsed: false
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const importButton =
    document.getElementById("importEventDataButton");

  const fileInput =
    document.getElementById("eventDataFile");

  const statusText =
    document.getElementById("eventImportStatus");

  const badge =
    document.getElementById("eventImportBadge");

  const results =
    document.getElementById("eventImportResults");

  if (
    !importButton ||
    !fileInput ||
    !statusText ||
    !badge ||
    !results
  ) {
    console.warn(
      "[Chest Companion] Live event importer could not initialise because one or more interface elements are missing."
    );

    return;
  }

  function setBadge(text, state = "") {
    badge.textContent = text;

    badge.classList.remove(
      "ready",
      "failed",
      "loading"
    );

    if (state) {
      badge.classList.add(state);
    }
  }

  function showPublishedEvent(eventData) {
    if (!eventData?.chests) return false;

    const eventName =
      eventData.event ||
      eventData.eventName ||
      "Current event";
    const readyCount =
      Number(eventData.readyChestCount) ||
      Object.values(eventData.chests)
        .filter(chest => chest?.ready || chest?.found)
        .length;

    setBadge("Published", "ready");
    statusText.textContent =
      `${eventName} is published with ${readyCount} chest deck(s) ready. Choose a new file only when replacing the live event.`;
    return true;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatValue(value) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      return "—";
    }

    if (typeof value === "object") {
      try {
        return escapeHtml(
          JSON.stringify(value)
        );
      } catch (error) {
        return "[Object]";
      }
    }

    return escapeHtml(value);
  }

  function createChestRow(chest) {
    const warnings = Array.isArray(
      chest?.warnings
    )
      ? chest.warnings
      : [];

    const warningText = warnings.length
      ? `
        <details class="developer-warning">
          <summary>
            ${warnings.length}
            warning${warnings.length === 1 ? "" : "s"}
          </summary>

          <ul>
            ${warnings
              .map(
                warning => `
                  <li>
                    ${escapeHtml(warning)}
                  </li>
                `
              )
              .join("")}
          </ul>
        </details>
      `
      : "";

    return `
      <tr>
        <td>
          <strong>
            ${escapeHtml(chest?.label)}
          </strong>

          <small>
            ${escapeHtml(chest?.key)}
          </small>
        </td>

        <td>
          ${chest?.found ? "✅" : "❌"}
        </td>

        <td>
          ${formatValue(chest?.index)}
        </td>

        <td>
          ${formatValue(chest?.deckLength)}
        </td>

        <td>
          ${formatValue(chest?.currentValue)}
        </td>
      </tr>

      ${
        warningText
          ? `
            <tr>
              <td colspan="5">
                ${warningText}
              </td>
            </tr>
          `
          : ""
      }
    `;
  }

  function getGachaOpeningCount(gachaData) {
    if (!gachaData) {
      return 0;
    }

    const possibleArrays = [
      gachaData.openings,
      gachaData.history,
      gachaData.rewardHistory,
      gachaData.entries,
      gachaData.requests,
      gachaData.results
    ];

    const matchingArray =
      possibleArrays.find(Array.isArray);

    if (matchingArray) {
      return matchingArray.length;
    }

    const possibleCounts = [
      gachaData.openingCount,
      gachaData.requestCount,
      gachaData.historyCount,
      gachaData.totalOpenings,
      gachaData.totalRequests,
      gachaData.processedEntryCount
    ];

    const matchingCount =
      possibleCounts.find(
        value =>
          Number.isFinite(Number(value))
      );

    return matchingCount === undefined
      ? 0
      : Number(matchingCount);
  }

  function getGachaBonusCount(gachaData) {
    if (!gachaData) {
      return 0;
    }

    const possibleArrays = [
      gachaData.bonusClaims,
      gachaData.bonuses
    ];

    const matchingArray =
      possibleArrays.find(Array.isArray);

    if (matchingArray) {
      return matchingArray.length;
    }

    const history =
      gachaData.openings ||
      gachaData.history ||
      gachaData.rewardHistory ||
      gachaData.entries ||
      [];

    if (!Array.isArray(history)) {
      return 0;
    }

    return history.filter(entry =>
      Boolean(
        entry?.bonus ||
        entry?.isBonus ||
        entry?.bonusClaim ||
        entry?.claimType === "bonus" ||
        entry?.claimOptionsType ===
          "claim_Bonus"
      )
    ).length;
  }

  function renderResults(
    parsed,
    gachaData = null
  ) {
    const chests =
      parsed?.chests &&
      typeof parsed.chests === "object"
        ? parsed.chests
        : {};

    const chestRows = Object.values(chests)
      .map(createChestRow)
      .join("");

    const readyText = parsed?.ready
      ? `${parsed.readyChestCount || 0} chest deck(s) ready`
      : "No supported chest decks were detected";

    const gachaOpeningCount =
      getGachaOpeningCount(gachaData);

    const gachaBonusCount =
      getGachaBonusCount(gachaData);

    const gachaSummary = gachaData
      ? `
        <div class="developer-summary">

          <p class="eyebrow">
            PRIVATE CHEST UPDATE
          </p>

          <h3>
            ${gachaOpeningCount}
            opening record${gachaOpeningCount === 1 ? "" : "s"}
          </h3>

          <p class="muted-text">
            ${gachaBonusCount}
            bonus claim${gachaBonusCount === 1 ? "" : "s"}
            detected.
          </p>

        </div>
      `
      : `
        <div class="developer-summary">

          <p class="eyebrow">
            CHEST HISTORY
          </p>

          <h3>
            No opening history detected
          </h3>

          <p class="muted-text">
            Event intelligence was updated successfully, but
            no usable chest-opening history was included.
          </p>

        </div>
      `;

    const availableDeckKeys =
      Array.isArray(parsed?.availableDeckKeys)
        ? parsed.availableDeckKeys
        : [];

    const availableIndexKeys =
      Array.isArray(parsed?.availableIndexKeys)
        ? parsed.availableIndexKeys
        : [];

    results.innerHTML = `
      <div class="developer-summary">

        <p class="eyebrow">
          IMPORTED EVENT
        </p>

        <h3>
          ${escapeHtml(
            parsed?.event || "Unknown event"
          )}
        </h3>

        <p class="muted-text">
          ${escapeHtml(readyText)}
        </p>

      </div>

      ${gachaSummary}

      <div class="developer-table-wrapper">

        <table class="developer-table">

          <thead>
            <tr>
              <th>Chest</th>
              <th>Found</th>
              <th>Index</th>
              <th>Length</th>
              <th>Current</th>
            </tr>
          </thead>

          <tbody>
            ${
              chestRows ||
              `
                <tr>
                  <td colspan="5">
                    No supported chest information was found.
                  </td>
                </tr>
              `
            }
          </tbody>

        </table>

      </div>

      <details class="developer-details">

        <summary>
          Available deck keys
        </summary>

        <div class="developer-key-list">
          ${
            availableDeckKeys.length
              ? availableDeckKeys
                  .map(
                    key => `
                      <code>
                        ${escapeHtml(key)}
                      </code>
                    `
                  )
                  .join("")
              : `
                <span class="muted-text">
                  No deck keys found.
                </span>
              `
          }
        </div>

      </details>

      <details class="developer-details">

        <summary>
          Available deck index keys
        </summary>

        <div class="developer-key-list">
          ${
            availableIndexKeys.length
              ? availableIndexKeys
                  .map(
                    key => `
                      <code>
                        ${escapeHtml(key)}
                      </code>
                    `
                  )
                  .join("")
              : `
                <span class="muted-text">
                  No deck index keys found.
                </span>
              `
          }
        </div>

      </details>
    `;

    results.classList.remove("hidden");
  }

  function updateLegacyPredictorBadges(parsed) {
    const badgeMap = {
      gold:
        document.getElementById(
          "goldPredictorBadge"
        ),

      platinum:
        document.getElementById(
          "platinumPredictorBadge"
        ),

      draconic:
        document.getElementById(
          "draconicPredictorBadge"
        ),

      freedom:
        document.getElementById(
          "freedomPredictorBadge"
        ),

      arcane:
        document.getElementById(
          "arcanePredictorBadge"
        )
    };

    Object.entries(badgeMap).forEach(
      ([chestType, chestBadge]) => {
        if (!chestBadge) {
          return;
        }

        const chest =
          parsed?.chests?.[chestType];

        chestBadge.textContent =
          chest?.found
            ? "Live data ready"
            : "Not detected";
      }
    );
  }

  function parseHarGachaData(possibleHar) {
    if (
      !window.HarGachaParser ||
      typeof window.HarGachaParser.parse !==
        "function"
    ) {
      console.warn(
        "[Chest Companion] HarGachaParser is unavailable. Confirm har-gacha-parser.js loads before event-import.js."
      );

      return null;
    }

    const entries =
      possibleHar?.log?.entries;

    if (!Array.isArray(entries)) {
      return null;
    }

    const hasGachaRequests =
      entries.some(entry => {
        const url = String(
          entry?.request?.url || ""
        );

        return url.includes(
          "/ext/dragonsong/event/use_gacha"
        );
      });

    if (!hasGachaRequests) {
      return null;
    }

    try {
      return window.HarGachaParser.parse(
        possibleHar
      );
    } catch (error) {
      console.warn(
        "[Chest Companion] HAR gacha requests were found, but they could not be parsed."
      );

      return null;
    }
  }

  function keepImportedDataMemoryOnly() {
    /* Raw administrator imports are never persisted. */
    clearLegacyImportStorage();
  }

  function dispatchImportedEvent({
    parsed,
    gachaData,
    sourceFile,
    restored = false
  }) {
    const detail = {
      restored,
      privateImport: !restored,
      persistence: restored
        ? "shared-cloud"
        : "memory-only",
      parsed,
      eventData: parsed,
      gachaData,
      file: sourceFile,
      sourceFile
    };

    document.dispatchEvent(
      new CustomEvent(
        "noir:event-imported",
        { detail }
      )
    );

    window.dispatchEvent(
      new CustomEvent(
        "noir:event-imported",
        { detail }
      )
    );

    /*
     * This additional event gives future predictor
     * components a dedicated chest-history signal.
     */
    if (gachaData) {
      window.dispatchEvent(
        new CustomEvent(
          "noir:gacha-imported",
          {
            detail: {
              restored,
              privateImport: !restored,
              persistence: restored
                ? "shared-cloud"
                : "memory-only",
              gachaData,
              eventData: parsed,
              sourceFile
            }
          }
        )
      );
    }
  }

  async function importEventFile() {
    const file =
      fileInput.files?.[0];

    if (!file) {
      setBadge(
        "Choose file",
        "failed"
      );

      statusText.textContent =
        "Please choose a supported private event update first.";

      results.classList.add("hidden");

      return;
    }

    if (
      typeof window.EventParser !==
      "function"
    ) {
      setBadge(
        "Unavailable",
        "failed"
      );

      statusText.textContent =
        "The event parser did not load. Check that event-parser.js is included before event-import.js.";

      console.error(
        "[Chest Companion] EventParser is unavailable. Confirm the script order in index.html."
      );

      return;
    }

    importButton.disabled = true;
    importButton.dataset.importBusy =
      "true";
    fileInput.disabled = true;

    /* Never leave a previous private capture available when a
     * replacement fails part-way through import. */
    clearImportData({
      resetInterface: false,
      clearFileInput: false
    });
    const activeImportGeneration =
      importGeneration;

    setBadge(
      "Reading...",
      "loading"
    );

    statusText.textContent =
      "Reading the private capture on this device...";

    results.classList.add("hidden");

    try {
      const capture =
        await readPrivateCapture(
          file,
          () =>
            activeImportGeneration !==
              importGeneration
        );

      if (
        activeImportGeneration !==
          importGeneration
      ) {
        throw cancelledImportError();
      }

      let parsed;
      let gachaData;

      if (capture.workerParsed) {
        parsed = capture.eventData;
        gachaData = capture.gachaData;

        window.ChestCompanionLastImport =
          capture.importDiagnostics;
        sanitiseLastImportDiagnostics();

        if (capture.towerInventory) {
          window.OnyxTowerInventoryBridge
            ?.importSnapshot?.(
              capture.towerInventory
            );
        } else {
          window.OnyxTowerInventoryBridge
            ?.clear?.();
        }
      } else {
        let importedData =
          capture.importedData;

        parsed =
          window.EventParser.parse(importedData);
        sanitiseLastImportDiagnostics();
        gachaData =
          parseHarGachaData(importedData);

        capture.importedData = null;
        importedData = null;
      }

      if (
        activeImportGeneration !==
          importGeneration
      ) {
        throw cancelledImportError();
      }

      const sourceFile = {
        format: capture.zipped
          ? "har.zip"
          : "har",
        sizeBytes: file.size,
        importedAt:
          new Date().toISOString()
      };

      window.currentEventData =
        parsed;

      window.currentGachaData =
        gachaData;

      window.currentEventSourceFile =
        sourceFile;

      keepImportedDataMemoryOnly();

      setBadge(
        parsed.ready
          ? "Ready"
          : "Incomplete",
        parsed.ready
          ? "ready"
          : "failed"
      );

      const openingCount =
        getGachaOpeningCount(gachaData);

      const gachaStatus =
        gachaData
          ? ` ${openingCount} chest-opening request${
              openingCount === 1
                ? ""
                : "s"
            } also detected.`
          : " No chest-opening history was detected.";

      statusText.textContent =
        `${parsed.readyChestCount || 0} chest deck(s) detected from the private capture.${gachaStatus}`;

      renderResults(
        parsed,
        gachaData
      );

      updateLegacyPredictorBadges(
        parsed
      );

      dispatchImportedEvent({
        parsed,
        gachaData,
        sourceFile,
        restored: false
      });

      console.info(
        "[Chest Companion] Private capture imported in memory."
      );
    } catch (error) {
      if (
        activeImportGeneration !==
          importGeneration ||
        error?.code === "IMPORT_CANCELLED"
      ) {
        return;
      }

      console.error(
        "[Chest Companion] Private capture import failed."
      );

      clearImportData({
        resetInterface: false,
        clearFileInput: false
      });

      setBadge(
        "Failed",
        "failed"
      );

      statusText.textContent =
        error instanceof Error
          ? error.message
          : "The event file could not be imported.";

      results.innerHTML = `
        <div class="developer-error">

          <strong>
            Import failed
          </strong>

          <p class="muted-text">
            ${escapeHtml(
              error instanceof Error
                ? error.message
                : "Unknown import error."
            )}
          </p>

        </div>
      `;

      results.classList.remove(
        "hidden"
      );
    } finally {
      /* Release the browser's reference to the raw File object. */
      fileInput.value = "";

      delete importButton.dataset
        .importBusy;
      if (
        !importButton.dataset
          .publisherGeneration
      ) {
        importButton.disabled = false;
      }

      fileInput.disabled =
        false;
    }
  }

  function restoreSavedLiveEvent() {
    /* Restore only sanitised data from Supabase. */
    clearLegacyImportStorage();

    return false;
  }

  restoreSavedLiveEvent();

  window.addEventListener(
    "noir:event-imported",
    event => {
      if (event?.detail?.cloud || event?.detail?.restored) {
        showPublishedEvent(
          event.detail.eventData ||
          event.detail.parsed
        );
      }
    }
  );

  setTimeout(() => {
    showPublishedEvent(
      window.ChestCompanionPublishedEvent?.data ||
      window.currentEventData
    );
  }, 0);

  importButton.addEventListener(
    "click",
    importEventFile
  );

  fileInput.addEventListener(
    "change",
    () => {
      const file =
        fileInput.files?.[0];

      if (!file) {
        if (!showPublishedEvent(
          window.ChestCompanionPublishedEvent?.data ||
          window.currentEventData
        )) {
          setBadge(
            "Not imported"
          );

          statusText.textContent =
            "No live event data has been published yet.";
        }

        return;
      }

      setBadge(
        "File selected"
      );

      statusText.textContent =
        "The private capture is ready to import.";
    }
  );
});
