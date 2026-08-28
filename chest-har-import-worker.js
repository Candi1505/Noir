/* ============================================================
   ONYX COMMAND — PRIVATE CHEST HAR READER

   The uploaded capture is opened and parsed inside this worker. The
   file is never uploaded or persisted, and its raw text/bytes never
   cross back into the page. Only the existing parsers' sanitised
   event, opening-history and tower-inventory results are returned.
   ============================================================ */

"use strict";

const ChestHarImportWorker = (() => {
  const MAX_ARCHIVE_BYTES =
    128 * 1024 * 1024;
  const MAX_UNCOMPRESSED_BYTES =
    128 * 1024 * 1024;
  const MAX_ZIP_ENTRIES = 100;
  const MAX_DIRECTORY_BYTES =
    2 * 1024 * 1024;
  const MAX_COMPRESSION_RATIO = 64;
  const PARSER_SCRIPTS = Object.freeze([
    "event-parser.js?v=20260828-audit-2",
    "base-adviser-catalog-towers.js?v=20260828-audit-2",
    "onyx-tower-inventory-bridge.js?v=20260828-audit-2",
    "har-event-adapter.js?v=20260828-audit-2",
    "js/har-gacha-parser.js?v=20260828-audit-2"
  ]);

  function fail(message) {
    throw new Error(message);
  }

  function isZipSignature(bytes) {
    return (
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      (
        (bytes[2] === 0x03 && bytes[3] === 0x04) ||
        (bytes[2] === 0x05 && bytes[3] === 0x06) ||
        (bytes[2] === 0x07 && bytes[3] === 0x08)
      )
    );
  }

  function safeZipPath(name) {
    if (
      !name ||
      name.includes("\u0000") ||
      name.includes("\\") ||
      name.startsWith("/") ||
      /^[a-z]:/i.test(name)
    ) {
      return false;
    }

    return !name
      .split("/")
      .some(part => part === "..");
  }

  function ignoredMetadataPath(name) {
    return (
      name.startsWith("__MACOSX/") ||
      name.split("/").pop()?.startsWith("._")
    );
  }

  function findEndOfCentralDirectory(bytes) {
    const view = new DataView(
      bytes.buffer,
      bytes.byteOffset,
      bytes.byteLength
    );

    for (
      let offset = bytes.byteLength - 22;
      offset >= 0;
      offset -= 1
    ) {
      if (
        view.getUint32(offset, true) !==
          0x06054b50
      ) {
        continue;
      }

      const commentLength =
        view.getUint16(offset + 20, true);

      if (
        offset + 22 + commentLength ===
        bytes.byteLength
      ) {
        return offset;
      }
    }

    return -1;
  }

  function makeCrcTable() {
    const table = new Uint32Array(256);

    for (let index = 0; index < 256; index += 1) {
      let value = index;

      for (let bit = 0; bit < 8; bit += 1) {
        value =
          value & 1
            ? 0xedb88320 ^ (value >>> 1)
            : value >>> 1;
      }

      table[index] = value >>> 0;
    }

    return table;
  }

  const CRC_TABLE = makeCrcTable();

  function crc32(bytes) {
    let value = 0xffffffff;

    for (const byte of bytes) {
      value =
        CRC_TABLE[(value ^ byte) & 0xff] ^
        (value >>> 8);
    }

    return (value ^ 0xffffffff) >>> 0;
  }

  async function readBoundedStream(
    stream,
    advertisedSize
  ) {
    const reader = stream.getReader();
    const output = new Uint8Array(
      advertisedSize
    );
    let size = 0;

    try {
      while (true) {
        const { value, done } =
          await reader.read();

        if (done) {
          break;
        }

        if (!(value instanceof Uint8Array)) {
          fail("The zipped HAR could not be decoded safely.");
        }

        const nextSize =
          size + value.byteLength;

        if (
          nextSize > MAX_UNCOMPRESSED_BYTES ||
          nextSize > advertisedSize
        ) {
          fail("The zipped HAR expands beyond the safe import limit.");
        }

        output.set(value, size);
        size = nextSize;
      }
    } finally {
      reader.releaseLock();
    }

    if (size !== advertisedSize) {
      fail("The zipped HAR size does not match its directory.");
    }

    return output;
  }

  async function openZipHar(file) {
    const tailStart =
      Math.max(0, file.size - 65_557);
    const tailBytes = new Uint8Array(
      await file.slice(tailStart).arrayBuffer()
    );
    const endOffset =
      findEndOfCentralDirectory(tailBytes);

    if (endOffset < 0) {
      fail("The ZIP directory could not be read.");
    }

    const endView = new DataView(
      tailBytes.buffer,
      tailBytes.byteOffset,
      tailBytes.byteLength
    );
    const diskNumber =
      endView.getUint16(endOffset + 4, true);
    const directoryDisk =
      endView.getUint16(endOffset + 6, true);
    const diskEntryCount =
      endView.getUint16(endOffset + 8, true);
    const entryCount =
      endView.getUint16(endOffset + 10, true);
    const directorySize =
      endView.getUint32(endOffset + 12, true);
    const directoryOffset =
      endView.getUint32(endOffset + 16, true);
    const absoluteEndOffset =
      tailStart + endOffset;

    if (
      diskNumber !== 0 ||
      directoryDisk !== 0 ||
      diskEntryCount !== entryCount
    ) {
      fail("Multi-part ZIP captures are not supported.");
    }

    if (
      entryCount === 0xffff ||
      directorySize === 0xffffffff ||
      directoryOffset === 0xffffffff
    ) {
      fail("ZIP64 captures are not supported.");
    }

    if (
      entryCount < 1 ||
      entryCount > MAX_ZIP_ENTRIES ||
      directorySize < 46 ||
      directorySize > MAX_DIRECTORY_BYTES ||
      directoryOffset + directorySize !==
        absoluteEndOffset
    ) {
      fail("The ZIP directory is outside the safe import limits.");
    }

    const directoryBytes = new Uint8Array(
      await file
        .slice(
          directoryOffset,
          directoryOffset + directorySize
        )
        .arrayBuffer()
    );
    const view = new DataView(
      directoryBytes.buffer,
      directoryBytes.byteOffset,
      directoryBytes.byteLength
    );
    const utf8Decoder = new TextDecoder(
      "utf-8",
      { fatal: true }
    );
    const latinDecoder = new TextDecoder(
      "windows-1252"
    );
    const candidates = [];
    let cursor = 0;

    for (
      let index = 0;
      index < entryCount;
      index += 1
    ) {
      if (
        cursor + 46 > directoryBytes.length ||
        view.getUint32(cursor, true) !==
          0x02014b50
      ) {
        fail("The ZIP directory is malformed.");
      }

      const flags =
        view.getUint16(cursor + 8, true);
      const method =
        view.getUint16(cursor + 10, true);
      const checksum =
        view.getUint32(cursor + 16, true);
      const compressedSize =
        view.getUint32(cursor + 20, true);
      const uncompressedSize =
        view.getUint32(cursor + 24, true);
      const nameLength =
        view.getUint16(cursor + 28, true);
      const extraLength =
        view.getUint16(cursor + 30, true);
      const commentLength =
        view.getUint16(cursor + 32, true);
      const diskStart =
        view.getUint16(cursor + 34, true);
      const localOffset =
        view.getUint32(cursor + 42, true);
      const end =
        cursor + 46 + nameLength +
        extraLength + commentLength;

      if (
        nameLength < 1 ||
        end > directoryBytes.length ||
        diskStart !== 0
      ) {
        fail("The ZIP entry is malformed.");
      }

      const nameBytes = directoryBytes.slice(
        cursor + 46,
        cursor + 46 + nameLength
      );
      let name;

      try {
        name = (flags & 0x0800)
          ? utf8Decoder.decode(nameBytes)
          : latinDecoder.decode(nameBytes);
      } catch (error) {
        fail("The ZIP contains an invalid entry name.");
      }

      if (!safeZipPath(name)) {
        fail("The ZIP contains an unsafe file path.");
      }

      const isHar =
        /\.har$/i.test(name) &&
        !ignoredMetadataPath(name);

      if (isHar) {
        if (flags & 1) {
          fail("Encrypted HAR files are not supported.");
        }

        if (method !== 0 && method !== 8) {
          fail("The HAR uses an unsupported ZIP compression method.");
        }

        if (
          compressedSize < 1 ||
          uncompressedSize < 2 ||
          uncompressedSize > MAX_UNCOMPRESSED_BYTES ||
          localOffset + 30 > directoryOffset ||
          (
            compressedSize > 0 &&
            uncompressedSize / compressedSize >
              MAX_COMPRESSION_RATIO
          )
        ) {
          fail("The zipped HAR is outside the safe import limits.");
        }

        candidates.push({
          name,
          flags,
          method,
          checksum,
          compressedSize,
          uncompressedSize,
          localOffset
        });
      }

      cursor = end;
    }

    if (cursor !== directoryBytes.length) {
      fail("The ZIP directory contains trailing data.");
    }

    if (candidates.length !== 1) {
      fail(
        candidates.length
          ? "Choose a ZIP containing exactly one HAR file."
          : "No readable HAR file was found in this ZIP."
      );
    }

    const selected = candidates[0];
    const localBytes = new Uint8Array(
      await file
        .slice(
          selected.localOffset,
          selected.localOffset + 30
        )
        .arrayBuffer()
    );
    const localView = new DataView(
      localBytes.buffer,
      localBytes.byteOffset,
      localBytes.byteLength
    );

    if (
      localBytes.byteLength !== 30 ||
      localView.getUint32(0, true) !==
        0x04034b50
    ) {
      fail("The HAR entry header is malformed.");
    }

    const localFlags =
      localView.getUint16(6, true);
    const localMethod =
      localView.getUint16(8, true);
    const localNameLength =
      localView.getUint16(26, true);
    const localExtraLength =
      localView.getUint16(28, true);
    const localHeaderEnd =
      selected.localOffset + 30 +
      localNameLength + localExtraLength;
    const dataEnd =
      localHeaderEnd + selected.compressedSize;

    if (
      (localFlags & 1) !== 0 ||
      localMethod !== selected.method ||
      dataEnd > directoryOffset
    ) {
      fail("The HAR entry header does not match its directory.");
    }

    const localNameBytes = new Uint8Array(
      await file
        .slice(
          selected.localOffset + 30,
          selected.localOffset + 30 +
            localNameLength
        )
        .arrayBuffer()
    );
    let localName;

    try {
      localName = (localFlags & 0x0800)
        ? utf8Decoder.decode(localNameBytes)
        : latinDecoder.decode(localNameBytes);
    } catch (error) {
      fail("The HAR entry name could not be read.");
    }

    if (localName !== selected.name) {
      fail("The HAR entry name does not match its directory.");
    }

    let stream = file
      .slice(localHeaderEnd, dataEnd)
      .stream();

    if (selected.method === 8) {
      if (typeof DecompressionStream !== "function") {
        fail(
          "This browser cannot open zipped captures. Extract the HAR file first."
        );
      }

      try {
        stream = stream.pipeThrough(
          new DecompressionStream("deflate-raw")
        );
      } catch (error) {
        fail(
          "This browser cannot open zipped captures. Extract the HAR file first."
        );
      }
    }

    const output = await readBoundedStream(
      stream,
      selected.uncompressedSize
    );

    if (crc32(output) !== selected.checksum) {
      fail("The zipped HAR failed its integrity check.");
    }

    return output.buffer;
  }

  async function openCapture(file) {
    if (!(file instanceof Blob)) {
      fail("Choose a supported private event capture.");
    }

    if (
      file.size < 2 ||
      file.size > MAX_ARCHIVE_BYTES
    ) {
      fail("This event capture is outside the safe import limits.");
    }

    const signature = new Uint8Array(
      await file.slice(0, 4).arrayBuffer()
    );
    const zipped = isZipSignature(signature);
    const zipNamed = /\.zip$/i.test(
      String(file.name || "")
    );

    if (zipNamed && !zipped) {
      fail("The selected ZIP capture is invalid or incomplete.");
    }

    if (zipped) {
      return {
        buffer: await openZipHar(file),
        zipped: true
      };
    }

    return {
      buffer: await file.arrayBuffer(),
      zipped: false
    };
  }

  function isHarObject(value) {
    return Boolean(
      value &&
      typeof value === "object" &&
      value.log &&
      Array.isArray(value.log.entries)
    );
  }

  function hasGachaRequests(value) {
    return isHarObject(value) &&
      value.log.entries.some(entry =>
        /\/ext\/dragonsong\/event\/use_gacha(?:\?|$)/i
          .test(String(entry?.request?.url || ""))
      );
  }

  function sanitiseDiagnostics(lastImport) {
    const diagnostics =
      lastImport?.diagnostics || {};

    return {
      kind:
        lastImport?.kind === "har"
          ? "har"
          : "json",
      importedAt: new Date().toISOString(),
      diagnostics: {
        eventName:
          typeof diagnostics.eventName === "string"
            ? diagnostics.eventName.slice(0, 160)
            : null,
        eventKey:
          typeof diagnostics.eventKey === "string"
            ? diagnostics.eventKey.slice(0, 160)
            : null,
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

  function ensureParsers(runtime) {
    if (
      typeof runtime?.EventParser?.parse === "function" &&
      typeof runtime?.HarGachaParser?.parse === "function" &&
      typeof runtime?.OnyxTowerInventoryBridge
        ?.getSnapshot === "function"
    ) {
      return;
    }

    const workerScope =
      typeof self !== "undefined"
        ? self
        : null;

    if (
      !workerScope ||
      runtime !== workerScope ||
      typeof importScripts !== "function"
    ) {
      fail("The private capture parsers are unavailable.");
    }

    runtime.window = runtime;
    importScripts(...PARSER_SCRIPTS);

    if (
      typeof runtime.EventParser?.parse !== "function" ||
      typeof runtime.HarGachaParser?.parse !== "function" ||
      typeof runtime.OnyxTowerInventoryBridge
        ?.getSnapshot !== "function"
    ) {
      fail("The private capture parsers could not start.");
    }
  }

  function decodeJsonBuffer(buffer) {
    let text;

    try {
      text = new TextDecoder(
        "utf-8",
        { fatal: true }
      ).decode(buffer);
    } catch (error) {
      fail(
        "The selected event capture is not valid UTF-8 text."
      );
    }

    if (!text.trim()) {
      fail("The selected event file is empty.");
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      fail(
        "The selected event capture is not valid JSON."
      );
    } finally {
      text = "";
    }
  }

  async function parseCapture(
    file,
    runtime = (
      typeof self !== "undefined"
        ? self
        : null
    )
  ) {
    ensureParsers(runtime);

    const opened = await openCapture(file);
    let importedData;

    try {
      importedData = decodeJsonBuffer(
        opened.buffer
      );
    } finally {
      opened.buffer = null;
    }

    runtime.OnyxTowerInventoryBridge
      ?.clear?.();

    const eventData =
      runtime.EventParser.parse(importedData);
    let gachaData = null;

    if (hasGachaRequests(importedData)) {
      try {
        gachaData =
          runtime.HarGachaParser.parse(
            importedData
          );
      } catch (error) {
        /* Event decks remain usable when optional private opening
         * history is malformed. Do not log capture/parser details. */
        gachaData = null;
      }
    }
    const towerInventory =
      runtime.OnyxTowerInventoryBridge
        ?.getSnapshot?.() || null;
    const importDiagnostics =
      sanitiseDiagnostics(
        runtime.ChestCompanionLastImport
      );

    try {
      delete runtime.ChestCompanionLastImport;
    } catch (error) {
      runtime.ChestCompanionLastImport = null;
    }

    importedData = null;

    return {
      eventData,
      gachaData,
      towerInventory,
      importDiagnostics,
      zipped: opened.zipped === true
    };
  }

  return Object.freeze({
    openCapture,
    parseCapture,
    openZipHar,
    isZipSignature,
    safeZipPath,
    crc32,
    limits: Object.freeze({
      MAX_ARCHIVE_BYTES,
      MAX_UNCOMPRESSED_BYTES,
      MAX_ZIP_ENTRIES,
      MAX_DIRECTORY_BYTES,
      MAX_COMPRESSION_RATIO
    })
  });
})();

if (
  typeof self !== "undefined" &&
  typeof self.addEventListener === "function" &&
  typeof self.postMessage === "function"
) {
  self.addEventListener("message", async event => {
    if (event?.data?.type !== "import") {
      return;
    }

    try {
      const result =
        await ChestHarImportWorker.parseCapture(
          event.data.file
        );

      self.postMessage({
        type: "success",
        eventData: result.eventData,
        gachaData: result.gachaData,
        towerInventory: result.towerInventory,
        importDiagnostics:
          result.importDiagnostics,
        zipped: result.zipped
      });
    } catch (error) {
      self.postMessage({
        type: "error",
        message:
          error instanceof Error
            ? error.message
            : "The private capture could not be read."
      });
    }
  });
}

if (
  typeof module !== "undefined" &&
  module.exports
) {
  module.exports = ChestHarImportWorker;
}
