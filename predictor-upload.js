/* ============================================================
   CHEST COMPANION V2 — EVENT WORKBOOK IMPORTER
   Built by Cherubim

   Reads:
   - CSV
   - XLSX
   - XLSM

   Saves each predictor separately by:
   - Event
   - Chest type

   Examples:
   - breeding:gold
   - breeding:platinum
   - fortification:gold
   - fortification:platinum
   ============================================================ */

(function initialisePredictorUpload(window) {
  "use strict";

  const DATABASE_NAME =
    "ChestCompanionPredictorDatabase";

  const DATABASE_VERSION = 1;

  const STORE_NAME =
    "predictorWorkbooks";

  const EVENT_STORAGE_KEY =
    "chestCompanion:selectedPredictorEvent";

  const EVENT_NAMES = Object.freeze({
    breeding: "Breeding",
    fortification: "Fortification",
    "crystal-caves": "Crystal Caves",
    "temple-raids": "Temple Raids",
    "team-gauntlet": "Team Gauntlet",
    "fight-pits": "Fight Pits"
  });

  const EVENT_ALIASES = Object.freeze({
    breeding: [
      "breeding",
      "breed",
      "breeding event"
    ],

    fortification: [
      "fortification",
      "fort",
      "building"
    ],

    "crystal-caves": [
      "crystal caves",
      "crystal cave",
      "caves",
      "crystal"
    ],

    "temple-raids": [
      "temple raids",
      "temple raid",
      "temple"
    ],

    "team-gauntlet": [
      "team gauntlet",
      "gauntlet"
    ],

    "fight-pits": [
      "fight pits",
      "fight pit",
      "pits"
    ]
  });


  /* ==========================================================
     BASIC HELPERS
  ========================================================== */

  function getEventSelect() {
    return document.getElementById(
      "predictorEventSelect"
    );
  }

  function getSelectedEvent() {
    return getEventSelect()?.value || "";
  }

  function getEventName(eventId) {
    return EVENT_NAMES[eventId] || eventId;
  }

  function getStorageId(
    eventId,
    chestType
  ) {
    return `${eventId}:${chestType}`;
  }

  function getElements(chestType) {
    const prefix =
      chestType === "gold"
        ? "gold"
        : "platinum";

    return {
      fileInput:
        document.getElementById(
          `${prefix}PredictorFile`
        ),

      uploadButton:
        document.getElementById(
          chestType === "gold"
            ? "uploadGoldPredictorButton"
            : "uploadPlatinumPredictorButton"
        ),

      clearButton:
        document.getElementById(
          chestType === "gold"
            ? "clearGoldPredictorButton"
            : "clearPlatinumPredictorButton"
        ),

      status:
        document.getElementById(
          `${prefix}PredictorStatus`
        ),

      badge:
        document.getElementById(
          `${prefix}PredictorBadge`
        ),

      details:
        document.getElementById(
          `${prefix}PredictorDetails`
        )
    };
  }

  function capitaliseChestType(
    chestType
  ) {
    return chestType === "gold"
      ? "Gold"
      : "Platinum";
  }

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatDate(isoDate) {
    if (!isoDate) {
      return "";
    }

    return new Date(
      isoDate
    ).toLocaleString(
      "en-AU",
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    );
  }

  function formatFileSize(bytes) {
    const size =
      Number(bytes) || 0;

    if (size < 1024) {
      return `${size} B`;
    }

    if (size < 1024 * 1024) {
      return `${(
        size / 1024
      ).toFixed(1)} KB`;
    }

    return `${(
      size /
      (1024 * 1024)
    ).toFixed(1)} MB`;
  }

  function normaliseText(value) {
    return String(value ?? "")
      .toLowerCase()
      .replace(/[_-]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normaliseExtension(
    fileName
  ) {
    const parts =
      String(fileName || "")
        .toLowerCase()
        .split(".");

    return parts.length > 1
      ? parts.pop()
      : "";
  }


  /* ==========================================================
     STATUS DISPLAY
  ========================================================== */

  function setStatus(
    chestType,
    message,
    type = "normal"
  ) {
    const { status } =
      getElements(chestType);

    if (!status) {
      return;
    }

    status.textContent = message;

    status.style.color =
      type === "error"
        ? "#ff9cb9"
        : type === "success"
          ? "#65e2b4"
          : "";
  }

  function setBadge(
    chestType,
    text,
    type = "normal"
  ) {
    const { badge } =
      getElements(chestType);

    if (!badge) {
      return;
    }

    badge.textContent = text;

    badge.style.color =
      type === "success"
        ? "#65e2b4"
        : type === "error"
          ? "#ff9cb9"
          : "";
  }

  function clearDetails(
    chestType
  ) {
    const {
      details,
      clearButton
    } = getElements(chestType);

    if (details) {
      details.innerHTML = "";
      details.classList.add(
        "hidden"
      );
    }

    if (clearButton) {
      clearButton.classList.add(
        "hidden"
      );
    }
  }

  function renderDetails(
    chestType,
    workbookRecord
  ) {
    const {
      details,
      clearButton
    } = getElements(chestType);

    if (!details) {
      return;
    }

    const matchedSheets =
      workbookRecord.matchedSheetNames
        ?.length
        ? workbookRecord
            .matchedSheetNames
            .join(", ")
        : "All populated sheets";

    details.innerHTML = `
      <div class="predictor-detail-row">
        <strong>Event</strong>
        <span>${escapeHTML(
          workbookRecord.eventName
        )}</span>
      </div>

      <div class="predictor-detail-row">
        <strong>File</strong>
        <span>${escapeHTML(
          workbookRecord.fileName
        )}</span>
      </div>

      <div class="predictor-detail-row">
        <strong>File size</strong>
        <span>${escapeHTML(
          formatFileSize(
            workbookRecord.fileSize
          )
        )}</span>
      </div>

      <div class="predictor-detail-row">
        <strong>Sheets used</strong>
        <span>${escapeHTML(
          matchedSheets
        )}</span>
      </div>

      <div class="predictor-detail-row">
        <strong>Rows available</strong>
        <span>${escapeHTML(
          workbookRecord.totalRows
        )}</span>
      </div>

      <div class="predictor-detail-row">
        <strong>Imported</strong>
        <span>${escapeHTML(
          formatDate(
            workbookRecord.importedAt
          )
        )}</span>
      </div>
    `;

    details.classList.remove(
      "hidden"
    );

    if (clearButton) {
      clearButton.classList.remove(
        "hidden"
      );
    }
  }


  /* ==========================================================
     INDEXEDDB
  ========================================================== */

  function openDatabase() {
    return new Promise(
      (resolve, reject) => {
        const request =
          indexedDB.open(
            DATABASE_NAME,
            DATABASE_VERSION
          );

        request.addEventListener(
          "upgradeneeded",
          event => {
            const database =
              event.target.result;

            if (
              !database.objectStoreNames
                .contains(STORE_NAME)
            ) {
              database.createObjectStore(
                STORE_NAME,
                {
                  keyPath: "id"
                }
              );
            }
          }
        );

        request.addEventListener(
          "success",
          () => resolve(
            request.result
          )
        );

        request.addEventListener(
          "error",
          () => reject(
            request.error ||
              new Error(
                "Predictor storage could not be opened."
              )
          )
        );
      }
    );
  }

  async function saveWorkbookRecord(
    record
  ) {
    const database =
      await openDatabase();

    return new Promise(
      (resolve, reject) => {
        const transaction =
          database.transaction(
            STORE_NAME,
            "readwrite"
          );

        const store =
          transaction.objectStore(
            STORE_NAME
          );

        store.put(record);

        transaction.addEventListener(
          "complete",
          () => {
            database.close();
            resolve(record);
          }
        );

        transaction.addEventListener(
          "error",
          () => {
            const error =
              transaction.error;

            database.close();

            reject(
              error ||
                new Error(
                  "The predictor workbook could not be saved."
                )
            );
          }
        );
      }
    );
  }

  async function getWorkbookRecord(
    eventId,
    chestType
  ) {
    if (!eventId) {
      return null;
    }

    const database =
      await openDatabase();

    return new Promise(
      (resolve, reject) => {
        const transaction =
          database.transaction(
            STORE_NAME,
            "readonly"
          );

        const store =
          transaction.objectStore(
            STORE_NAME
          );

        const request =
          store.get(
            getStorageId(
              eventId,
              chestType
            )
          );

        request.addEventListener(
          "success",
          () => {
            database.close();

            resolve(
              request.result || null
            );
          }
        );

        request.addEventListener(
          "error",
          () => {
            const error =
              request.error;

            database.close();

            reject(
              error ||
                new Error(
                  "The saved predictor could not be loaded."
                )
            );
          }
        );
      }
    );
  }

  async function deleteWorkbookRecord(
    eventId,
    chestType
  ) {
    const database =
      await openDatabase();

    return new Promise(
      (resolve, reject) => {
        const transaction =
          database.transaction(
            STORE_NAME,
            "readwrite"
          );

        transaction
          .objectStore(STORE_NAME)
          .delete(
            getStorageId(
              eventId,
              chestType
            )
          );

        transaction.addEventListener(
          "complete",
          () => {
            database.close();
            resolve();
          }
        );

        transaction.addEventListener(
          "error",
          () => {
            const error =
              transaction.error;

            database.close();

            reject(
              error ||
                new Error(
                  "The predictor could not be removed."
                )
            );
          }
        );
      }
    );
  }


  /* ==========================================================
     FILE READING
  ========================================================== */

  function validateFile(file) {
    if (!file) {
      throw new Error(
        "Choose a predictor spreadsheet first."
      );
    }

    const extension =
      normaliseExtension(file.name);

    const allowed = [
      "csv",
      "xlsx",
      "xlsm"
    ];

    if (
      !allowed.includes(extension)
    ) {
      throw new Error(
        "Please choose a CSV, XLSX or XLSM file."
      );
    }

    return extension;
  }

  function readFileAsArrayBuffer(
    file
  ) {
    return new Promise(
      (resolve, reject) => {
        const reader =
          new FileReader();

        reader.addEventListener(
          "load",
          () => resolve(
            reader.result
          )
        );

        reader.addEventListener(
          "error",
          () => reject(
            new Error(
              "The spreadsheet could not be read."
            )
          )
        );

        reader.readAsArrayBuffer(
          file
        );
      }
    );
  }

  function removeEmptyEndingCells(
    row
  ) {
    const cleaned =
      Array.isArray(row)
        ? [...row]
        : [];

    while (
      cleaned.length &&
      String(
        cleaned[
          cleaned.length - 1
        ] ?? ""
      ).trim() === ""
    ) {
      cleaned.pop();
    }

    return cleaned;
  }

  function removeEmptyRows(rows) {
    return rows
      .map(
        removeEmptyEndingCells
      )
      .filter(row =>
        row.some(cell =>
          String(cell ?? "")
            .trim() !== ""
        )
      );
  }

  function readWorksheet(
    workbook,
    sheetName
  ) {
    const worksheet =
      workbook.Sheets[sheetName];

    if (!worksheet) {
      return null;
    }

    const rawRows =
      window.XLSX.utils
        .sheet_to_json(
          worksheet,
          {
            header: 1,
            raw: false,
            defval: "",
            blankrows: false
          }
        );

    const rows =
      removeEmptyRows(rawRows);

    if (!rows.length) {
      return null;
    }

    const columnCount =
      rows.reduce(
        (maximum, row) =>
          Math.max(
            maximum,
            row.length
          ),
        0
      );

    return {
      sheetName,
      normalisedSheetName:
        normaliseText(
          sheetName
        ),
      rowCount: rows.length,
      columnCount,
      rows
    };
  }


  /* ==========================================================
     EVENT DETECTION
  ========================================================== */

  function sheetMatchesEvent(
    sheet,
    eventId
  ) {
    const aliases =
      EVENT_ALIASES[eventId] || [];

    const sheetName =
      sheet.normalisedSheetName;

    if (
      aliases.some(alias =>
        sheetName.includes(alias)
      )
    ) {
      return true;
    }

    /*
     * Check a limited preview of worksheet text.
     * This avoids scanning every cell several times.
     */
    const previewText =
      sheet.rows
        .slice(0, 30)
        .flat()
        .map(normaliseText)
        .join(" ");

    return aliases.some(alias =>
      previewText.includes(alias)
    );
  }

  function findEventSheets(
    sheets,
    eventId
  ) {
    const matched =
      sheets.filter(sheet =>
        sheetMatchesEvent(
          sheet,
          eventId
        )
      );

    /*
     * Some community workbooks do not name their
     * sheets after the event. In that case, keep
     * all populated worksheets available to the
     * sequence parser rather than rejecting the file.
     */
    return matched.length
      ? matched
      : sheets;
  }

  function inspectWorkbook(
    workbook,
    chestType,
    eventId,
    file
  ) {
    const sheetNames =
      workbook.SheetNames || [];

    if (!sheetNames.length) {
      throw new Error(
        "The workbook does not contain any worksheets."
      );
    }

    const populatedSheets =
      sheetNames
        .map(sheetName =>
          readWorksheet(
            workbook,
            sheetName
          )
        )
        .filter(Boolean);

    if (
      !populatedSheets.length
    ) {
      throw new Error(
        "No predictor data was found in the workbook."
      );
    }

    const eventSheets =
      findEventSheets(
        populatedSheets,
        eventId
      );

    const totalRows =
      eventSheets.reduce(
        (total, sheet) =>
          total +
          sheet.rowCount,
        0
      );

    if (totalRows < 2) {
      throw new Error(
        "The selected event does not contain enough sequence data."
      );
    }

    const importedAt =
      new Date().toISOString();

    return {
      id: getStorageId(
        eventId,
        chestType
      ),

      schemaVersion: 1,

      chestType,

      eventId,

      eventName:
        getEventName(eventId),

      fileName: file.name,

      fileSize: file.size,

      importedAt,

      workbookSheetNames:
        sheetNames,

      matchedSheetNames:
        eventSheets.map(
          sheet =>
            sheet.sheetName
        ),

      totalRows,

      /*
       * This is the actual workbook content used
       * later by predictor-engine.js.
       */
      sheets: eventSheets
    };
  }


  /* ==========================================================
     IMPORT PROCESS
  ========================================================== */

  async function processWorkbook(
    chestType
  ) {
    const eventId =
      getSelectedEvent();

    const {
      fileInput,
      uploadButton
    } = getElements(chestType);

    if (
      !fileInput ||
      !uploadButton
    ) {
      console.error(
        `[Chest Companion] ${chestType} upload controls were not found.`
      );

      return;
    }

    const file =
      fileInput.files?.[0];

    try {
      if (!eventId) {
        throw new Error(
          "Choose the current event before uploading a sequence file."
        );
      }

      validateFile(file);

      if (!window.XLSX) {
        throw new Error(
          "The spreadsheet reader did not load. Refresh the app and try again."
        );
      }

      uploadButton.disabled =
        true;

      setBadge(
        chestType,
        "Reading"
      );

      setStatus(
        chestType,
        "Reading spreadsheet..."
      );

      const arrayBuffer =
        await readFileAsArrayBuffer(
          file
        );

      const workbook =
        window.XLSX.read(
          arrayBuffer,
          {
            type: "array",
            cellDates: true,
            cellFormula: true,
            cellNF: false,
            cellText: true
          }
        );

      setStatus(
        chestType,
        "Finding sequence data..."
      );

      const record =
        inspectWorkbook(
          workbook,
          chestType,
          eventId,
          file
        );

      setStatus(
        chestType,
        "Saving predictor to this device..."
      );

      await saveWorkbookRecord(
        record
      );

      window.ChestPredictorImports =
        window.ChestPredictorImports ||
        {};

      window.ChestPredictorImports[
        record.id
      ] = record;

      setBadge(
        chestType,
        "Ready",
        "success"
      );

      setStatus(
        chestType,
        `✓ ${capitaliseChestType(
          chestType
        )} predictor ready for ${
          record.eventName
        }.`,
        "success"
      );

      renderDetails(
        chestType,
        record
      );

      updateActivePredictorSummary();

      console.info(
        `[Chest Companion] ${record.id} imported.`,
        record
      );

      window.dispatchEvent(
        new CustomEvent(
          "chest-companion-workbook-imported",
          {
            detail: record
          }
        )
      );
    } catch (error) {
      console.error(
        `[Chest Companion] ${chestType} workbook import failed.`,
        error
      );

      setBadge(
        chestType,
        "Not loaded",
        "error"
      );

      setStatus(
        chestType,
        error?.message ||
          "The spreadsheet could not be imported.",
        "error"
      );
    } finally {
      uploadButton.disabled =
        false;
    }
  }


  /* ==========================================================
     RESTORE SAVED PREDICTORS
  ========================================================== */

  async function refreshChestStatus(
    chestType
  ) {
    const eventId =
      getSelectedEvent();

    clearDetails(
      chestType
    );

    if (!eventId) {
      setBadge(
        chestType,
        "Not loaded"
      );

      setStatus(
        chestType,
        "Choose an event first."
      );

      return null;
    }

    try {
      const record =
        await getWorkbookRecord(
          eventId,
          chestType
        );

      if (!record) {
        setBadge(
          chestType,
          "Not loaded"
        );

        setStatus(
          chestType,
          `No ${capitaliseChestType(
            chestType
          )} sequence file uploaded for ${
            getEventName(eventId)
          }.`
        );

        return null;
      }

      window.ChestPredictorImports =
        window.ChestPredictorImports ||
        {};

      window.ChestPredictorImports[
        record.id
      ] = record;

      setBadge(
        chestType,
        "Ready",
        "success"
      );

      setStatus(
        chestType,
        `✓ ${capitaliseChestType(
          chestType
        )} predictor ready for ${
          record.eventName
        }.`,
        "success"
      );

      renderDetails(
        chestType,
        record
      );

      return record;
    } catch (error) {
      console.error(
        "[Chest Companion] Saved predictor restore failed.",
        error
      );

      setBadge(
        chestType,
        "Storage error",
        "error"
      );

      setStatus(
        chestType,
        "The saved predictor could not be loaded.",
        "error"
      );

      return null;
    }
  }

  async function refreshSelectedEvent() {
    const eventId =
      getSelectedEvent();

    const eventStatus =
      document.getElementById(
        "predictorEventStatus"
      );

    if (eventId) {
      localStorage.setItem(
        EVENT_STORAGE_KEY,
        eventId
      );

      if (eventStatus) {
        eventStatus.textContent =
          `${getEventName(
            eventId
          )} selected. Upload or use its saved predictor files.`;

        eventStatus.style.color =
          "#65e2b4";
      }
    } else {
      localStorage.removeItem(
        EVENT_STORAGE_KEY
      );

      if (eventStatus) {
        eventStatus.textContent =
          "Select the event that is currently active in War Dragons.";

        eventStatus.style.color =
          "";
      }
    }

    await Promise.all([
      refreshChestStatus("gold"),
      refreshChestStatus(
        "platinum"
      )
    ]);

    updateActivePredictorSummary();

    window.dispatchEvent(
      new CustomEvent(
        "chest-companion-event-changed",
        {
          detail: {
            eventId,
            eventName:
              getEventName(eventId)
          }
        }
      )
    );
  }


  /* ==========================================================
     REMOVE PREDICTOR
  ========================================================== */

  async function clearPredictor(
    chestType
  ) {
    const eventId =
      getSelectedEvent();

    if (!eventId) {
      setStatus(
        chestType,
        "Choose an event first.",
        "error"
      );

      return;
    }

    const eventName =
      getEventName(eventId);

    const confirmed =
      window.confirm(
        `Remove the ${capitaliseChestType(
          chestType
        )} predictor for ${eventName}?`
      );

    if (!confirmed) {
      return;
    }

    try {
      await deleteWorkbookRecord(
        eventId,
        chestType
      );

      const importId =
        getStorageId(
          eventId,
          chestType
        );

      if (
        window.ChestPredictorImports
      ) {
        delete window
          .ChestPredictorImports[
            importId
          ];
      }

      const { fileInput } =
        getElements(chestType);

      if (fileInput) {
        fileInput.value = "";
      }

      await refreshChestStatus(
        chestType
      );

      updateActivePredictorSummary();

      window.dispatchEvent(
        new CustomEvent(
          "chest-companion-workbook-removed",
          {
            detail: {
              eventId,
              chestType
            }
          }
        )
      );
    } catch (error) {
      console.error(
        "[Chest Companion] Predictor removal failed.",
        error
      );

      setStatus(
        chestType,
        "The predictor could not be removed.",
        "error"
      );
    }
  }


  /* ==========================================================
     SUMMARY
  ========================================================== */

  async function updateActivePredictorSummary() {
    const heading =
      document.getElementById(
        "activePredictorHeading"
      );

    const summary =
      document.getElementById(
        "activePredictorSummary"
      );

    if (!heading || !summary) {
      return;
    }

    const eventId =
      getSelectedEvent();

    if (!eventId) {
      heading.textContent =
        "No event selected";

      summary.textContent =
        "Choose the current event before uploading a predictor.";

      return;
    }

    const [
      goldRecord,
      platinumRecord
    ] = await Promise.all([
      getWorkbookRecord(
        eventId,
        "gold"
      ),

      getWorkbookRecord(
        eventId,
        "platinum"
      )
    ]);

    const ready = [];

    if (goldRecord) {
      ready.push("Gold");
    }

    if (platinumRecord) {
      ready.push("Platinum");
    }

    if (!ready.length) {
      heading.textContent =
        `${getEventName(
          eventId
        )}: no predictors ready`;

      summary.textContent =
        "Upload a Gold or Platinum sequence spreadsheet to begin.";

      return;
    }

    heading.textContent =
      `${getEventName(
        eventId
      )}: ${ready.join(
        " and "
      )} ready`;

    summary.textContent =
      `${ready.length} predictor${
        ready.length === 1
          ? " is"
          : "s are"
      } saved on this device and ready for sequence tracking.`;
  }


  /* ==========================================================
     EVENT BINDINGS
  ========================================================== */

  function attachUploadControls(
    chestType
  ) {
    const {
      fileInput,
      uploadButton,
      clearButton
    } = getElements(chestType);

    if (
      !fileInput ||
      !uploadButton
    ) {
      return;
    }

    if (
      uploadButton.dataset
        .predictorUploadBound ===
      "true"
    ) {
      return;
    }

    uploadButton.dataset
      .predictorUploadBound =
      "true";

    uploadButton.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();

        processWorkbook(
          chestType
        );
      }
    );

    fileInput.addEventListener(
      "change",
      () => {
        const file =
          fileInput.files?.[0];

        if (!file) {
          refreshChestStatus(
            chestType
          );

          return;
        }

        const eventId =
          getSelectedEvent();

        if (!eventId) {
          setStatus(
            chestType,
            "Choose an event before uploading this file.",
            "error"
          );

          return;
        }

        setStatus(
          chestType,
          `${file.name} selected for ${
            getEventName(eventId)
          }. Tap Upload Sequence.`
        );
      }
    );

    clearButton?.addEventListener(
      "click",
      () => clearPredictor(
        chestType
      )
    );
  }

  function restoreSelectedEvent() {
    const eventSelect =
      getEventSelect();

    if (!eventSelect) {
      return;
    }

    const savedEvent =
      localStorage.getItem(
        EVENT_STORAGE_KEY
      );

    if (
      savedEvent &&
      EVENT_NAMES[savedEvent]
    ) {
      eventSelect.value =
        savedEvent;
    }

    eventSelect.addEventListener(
      "change",
      refreshSelectedEvent
    );
  }


  /* ==========================================================
     PUBLIC API
  ========================================================== */

  async function getActiveWorkbook(
    chestType
  ) {
    const eventId =
      getSelectedEvent();

    if (!eventId) {
      return null;
    }

    return getWorkbookRecord(
      eventId,
      chestType
    );
  }

  async function getWorkbook(
    eventId,
    chestType
  ) {
    return getWorkbookRecord(
      eventId,
      chestType
    );
  }


  /* ==========================================================
     INITIALISE
  ========================================================== */

  async function initialise() {
    attachUploadControls("gold");
    attachUploadControls(
      "platinum"
    );

    restoreSelectedEvent();

    await refreshSelectedEvent();

    console.info(
      "[Chest Companion] Event predictor importer ready."
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

  window.ChestPredictorUpload =
    Object.freeze({
      processGold: () =>
        processWorkbook("gold"),

      processPlatinum: () =>
        processWorkbook(
          "platinum"
        ),

      getActiveWorkbook,

      getWorkbook,

      refresh:
        refreshSelectedEvent,

      getSelectedEvent,

      getEventName
    });
})(window);