"use strict";

/*
 * Noir Chest Companion
 * Live event and HAR chest-history importer
 *
 * Responsibilities:
 * - Read an uploaded .json, .txt or .har file
 * - Parse the War Dragons about_v2 response
 * - Detect Gold, Platinum, Draconic and Freedom decks
 * - Parse use_gacha requests when the file is a HAR capture
 * - Keep imported capture information in memory only
 * - Notify the rest of Noir when new data becomes available
 */

const LIVE_EVENT_STORAGE_KEY =
  "chestCompanionLiveEventData";

const LIVE_GACHA_STORAGE_KEY =
  "chestCompanionLiveGachaData";

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
            HAR CHEST HISTORY
          </p>

          <h3>
            ${gachaOpeningCount}
            opening request${gachaOpeningCount === 1 ? "" : "s"}
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
            No use_gacha history detected
          </h3>

          <p class="muted-text">
            Event data was imported successfully, but this
            file did not contain HAR chest-opening requests.
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

  function parseHarGachaData(rawText) {
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

    let possibleHar;

    try {
      possibleHar = JSON.parse(rawText);
    } catch (error) {
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
    } catch (objectError) {
      /*
       * Some parser versions may expect the original
       * JSON text instead of the already-parsed object.
       */
      try {
        return window.HarGachaParser.parse(
          rawText
        );
      } catch (textError) {
        console.warn(
          "[Chest Companion] HAR gacha requests were found, but they could not be parsed.",
          textError
        );

        return null;
      }
    }
  }

  function saveImportedData(
    parsed,
    gachaData,
    sourceFile
  ) {
    /* Raw administrator imports are never persisted. */
    try {
      localStorage.removeItem(
        LIVE_EVENT_STORAGE_KEY
      );
      localStorage.removeItem(
        LIVE_GACHA_STORAGE_KEY
      );
    } catch (error) {
      console.warn(
        "[Chest Companion] Could not clear legacy import data.",
        error
      );
    }
  }

  function dispatchImportedEvent({
    parsed,
    gachaData,
    sourceFile,
    restored = false
  }) {
    const detail = {
      restored,
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
        "Please choose an about_v2 JSON, text or HAR file first.";

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
    fileInput.disabled = true;

    setBadge(
      "Reading...",
      "loading"
    );

    statusText.textContent =
      `Reading ${file.name}...`;

    results.classList.add("hidden");

    try {
      const rawText =
        await file.text();

      if (!rawText.trim()) {
        throw new Error(
          "The selected event file is empty."
        );
      }

      /*
       * har-event-adapter.js allows EventParser to accept
       * either a direct about_v2 response or a complete HAR.
       */
      const parsed =
        window.EventParser.parse(rawText);

      const gachaData =
        parseHarGachaData(rawText);

      const sourceFile = {
        name: file.name,
        size: file.size,
        type:
          file.type || "unknown",
        importedAt:
          new Date().toISOString()
      };

      window.currentEventData =
        parsed;

      window.currentGachaData =
        gachaData;

      window.currentEventSourceFile =
        sourceFile;

      saveImportedData(
        parsed,
        gachaData,
        sourceFile
      );

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
        `${parsed.readyChestCount || 0} chest deck(s) detected from ${file.name}.${gachaStatus}`;

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

      console.group(
        "🐉 Noir Live Event Import"
      );

      console.log(
        "Source file:",
        sourceFile
      );

      console.log(
        "Parsed event:",
        parsed
      );

      console.log(
        "Parsed gacha history:",
        gachaData
      );

      console.groupEnd();
    } catch (error) {
      console.error(
        "[Chest Companion] Live event import failed:",
        error
      );

      window.currentEventData =
        null;

      window.currentGachaData =
        null;

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
      importButton.disabled =
        false;

      fileInput.disabled =
        false;
    }
  }

  function restoreSavedLiveEvent() {
    /* Restore only sanitised data from Supabase. */
    try {
      localStorage.removeItem(
        LIVE_EVENT_STORAGE_KEY
      );
      localStorage.removeItem(
        LIVE_GACHA_STORAGE_KEY
      );
    } catch (error) {
      console.warn(
        "[Chest Companion] Could not clear legacy import data.",
        error
      );
    }

    return false;
  }

  restoreSavedLiveEvent();

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
        setBadge(
          "Not imported"
        );

        statusText.textContent =
          "No live event data imported.";

        return;
      }

      setBadge(
        "File selected"
      );

      statusText.textContent =
        `${file.name} is ready to import.`;
    }
  );
});
