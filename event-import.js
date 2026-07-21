"use strict";

/*
 * Noir Chest Companion
 * Live about_v2 event importer
 *
 * Responsibilities:
 * - Read an uploaded .json or .txt file
 * - Parse the War Dragons about_v2 response
 * - Detect Gold, Platinum, Draconic and Freedom decks
 * - Display developer diagnostics
 * - Store the parsed event data for the rest of the app
 */

const LIVE_EVENT_STORAGE_KEY =
  "chestCompanionLiveEventData";

document.addEventListener("DOMContentLoaded", () => {
  const importButton = document.getElementById("importEventDataButton");
  const fileInput = document.getElementById("eventDataFile");
  const statusText = document.getElementById("eventImportStatus");
  const badge = document.getElementById("eventImportBadge");
  const results = document.getElementById("eventImportResults");

  if (
    !importButton ||
    !fileInput ||
    !statusText ||
    !badge ||
    !results
  ) {
    console.warn(
      "Live event importer could not initialise because one or more interface elements are missing."
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
        return escapeHtml(JSON.stringify(value));
      } catch (error) {
        return "[Object]";
      }
    }

    return escapeHtml(value);
  }

  function createChestRow(chest) {
    const warnings = Array.isArray(chest.warnings)
      ? chest.warnings
      : [];

    const warningText = warnings.length
      ? `
        <details class="developer-warning">
          <summary>
            ${warnings.length} warning${warnings.length === 1 ? "" : "s"}
          </summary>

          <ul>
            ${warnings
              .map(
                warning => `
                  <li>${escapeHtml(warning)}</li>
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
          <strong>${escapeHtml(chest.label)}</strong>
          <small>${escapeHtml(chest.key)}</small>
        </td>

        <td>
          ${chest.found ? "✅" : "❌"}
        </td>

        <td>
          ${formatValue(chest.index)}
        </td>

        <td>
          ${formatValue(chest.deckLength)}
        </td>

        <td>
          ${formatValue(chest.currentValue)}
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

  function renderResults(parsed) {
    const chestRows = Object.values(parsed.chests)
      .map(createChestRow)
      .join("");

    const readyText = parsed.ready
      ? `${parsed.readyChestCount} chest deck(s) ready`
      : "No supported chest decks were detected";

    results.innerHTML = `
      <div class="developer-summary">

        <p class="eyebrow">
          IMPORTED EVENT
        </p>

        <h3>
          ${escapeHtml(parsed.event)}
        </h3>

        <p class="muted-text">
          ${escapeHtml(readyText)}
        </p>

      </div>

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
            ${chestRows}
          </tbody>

        </table>

      </div>

      <details class="developer-details">

        <summary>
          Available deck keys
        </summary>

        <div class="developer-key-list">
          ${
            parsed.availableDeckKeys.length
              ? parsed.availableDeckKeys
                  .map(
                    key => `
                      <code>${escapeHtml(key)}</code>
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
            parsed.availableIndexKeys.length
              ? parsed.availableIndexKeys
                  .map(
                    key => `
                      <code>${escapeHtml(key)}</code>
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
      gold: document.getElementById("goldPredictorBadge"),
      platinum: document.getElementById("platinumPredictorBadge"),
      draconic: document.getElementById("draconicPredictorBadge"),
      freedom: document.getElementById("freedomPredictorBadge")
    };

    Object.entries(badgeMap).forEach(
      ([chestType, chestBadge]) => {
        if (!chestBadge) {
          return;
        }

        const chest = parsed.chests[chestType];

        chestBadge.textContent = chest?.found
          ? "Live data ready"
          : "Not detected";
      }
    );
  }

  async function importEventFile() {
    const file = fileInput.files?.[0];

    if (!file) {
      setBadge("Choose file", "failed");
      statusText.textContent =
        "Please choose an about_v2 JSON or text file first.";

      results.classList.add("hidden");

      return;
    }

    if (typeof window.EventParser !== "function") {
      setBadge("Unavailable", "failed");
      statusText.textContent =
        "The event parser did not load. Check that event-parser.js is included before event-import.js.";

      console.error(
        "EventParser is unavailable. Confirm script order in index.html."
      );

      return;
    }

    importButton.disabled = true;
    fileInput.disabled = true;

    setBadge("Reading...", "loading");

    statusText.textContent =
      `Reading ${file.name}...`;

    results.classList.add("hidden");

    try {
      const rawText = await file.text();

      if (!rawText.trim()) {
        throw new Error(
          "The selected event file is empty."
        );
      }

      const parsed = window.EventParser.parse(rawText);

      window.currentEventData = parsed;
      window.currentEventSourceFile = {
        name: file.name,
        size: file.size,
        type: file.type || "unknown",
        importedAt: new Date().toISOString()
      };
try {
  localStorage.setItem(
    LIVE_EVENT_STORAGE_KEY,
    JSON.stringify({
      data: parsed,
      sourceFile:
        window.currentEventSourceFile
    })
  );
} catch (error) {
  console.warn(
    "[Chest Companion] Could not save live event data.",
    error
  );
}
      setBadge(
        parsed.ready ? "Ready" : "Incomplete",
        parsed.ready ? "ready" : "failed"
      );

      statusText.textContent =
        `${parsed.readyChestCount} chest deck(s) detected from ${file.name}.`;

      renderResults(parsed);
      updateLegacyPredictorBadges(parsed);

      document.dispatchEvent(
        new CustomEvent("noir:event-imported", {
          detail: {
            parsed,
            file: window.currentEventSourceFile
          }
        })
      );

      console.group("🐉 Noir Live Event Import");
      console.log("Source file:", window.currentEventSourceFile);
      console.log("Parsed event:", parsed);
      console.groupEnd();
    } catch (error) {
      console.error(
        "Live event import failed:",
        error
      );

      window.currentEventData = null;

      setBadge("Failed", "failed");

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

      results.classList.remove("hidden");
    } finally {
      importButton.disabled = false;
      fileInput.disabled = false;
    }
  }
function restoreSavedLiveEvent() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(
        LIVE_EVENT_STORAGE_KEY
      ) || "null"
    );

    if (
      !saved ||
      !saved.data ||
      !saved.data.chests
    ) {
      return false;
    }

    window.currentEventData =
      saved.data;

    window.currentEventSourceFile =
      saved.sourceFile || "";

    setBadge("Restored", "ready");

    statusText.textContent =
      saved.sourceFile
        ? `${saved.sourceFile} restored automatically.`
        : "Saved live event data restored automatically.";

    window.dispatchEvent(
      new CustomEvent(
        "noir:event-imported",
        {
          detail: {
            restored: true,
            sourceFile:
              saved.sourceFile || "",
            eventData:
              saved.data
          }
        }
      )
    );

    console.info(
      "[Chest Companion] Saved live event restored."
    );

    return true;
  } catch (error) {
    console.warn(
      "[Chest Companion] Could not restore saved live event.",
      error
    );

    return false;
  }
}

restoreSavedLiveEvent();
  importButton.addEventListener(
    "click",
    importEventFile
  );

  fileInput.addEventListener("change", () => {
    const file = fileInput.files?.[0];

    if (!file) {
      setBadge("Not imported");
      statusText.textContent =
        "No live event data imported.";

      return;
    }

    setBadge("File selected");

    statusText.textContent =
      `${file.name} is ready to import.`;
  });
});