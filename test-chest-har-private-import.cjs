"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const zlib = require("node:zlib");
const vm = require("node:vm");

const Core = require(
  "./chest-har-import-worker.js"
);

function u16(value) {
  const output = Buffer.alloc(2);
  output.writeUInt16LE(value >>> 0);
  return output;
}

function u32(value) {
  const output = Buffer.alloc(4);
  output.writeUInt32LE(value >>> 0);
  return output;
}

function makeZip(entries) {
  const localParts = [];
  const directoryParts = [];
  let localOffset = 0;

  entries.forEach(entry => {
    const name = Buffer.from(entry.name, "utf8");
    const source = Buffer.from(entry.data || "{}", "utf8");
    const method = entry.method ?? 8;
    const flags = entry.flags ?? 0x0800;
    const compressed = method === 8
      ? zlib.deflateRawSync(source)
      : source;
    const checksum = entry.checksum ??
      Core.crc32(source);
    const compressedSize =
      entry.compressedSize ?? compressed.length;
    const uncompressedSize =
      entry.uncompressedSize ?? source.length;
    const localHeader = Buffer.concat([
      u32(0x04034b50),
      u16(20),
      u16(flags),
      u16(method),
      u16(0),
      u16(0),
      u32(checksum),
      u32(compressedSize),
      u32(uncompressedSize),
      u16(name.length),
      u16(0),
      name
    ]);

    localParts.push(localHeader, compressed);

    directoryParts.push(Buffer.concat([
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(flags),
      u16(method),
      u16(0),
      u16(0),
      u32(checksum),
      u32(compressedSize),
      u32(uncompressedSize),
      u16(name.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(localOffset),
      name
    ]));

    localOffset +=
      localHeader.length + compressed.length;
  });

  const directory = Buffer.concat(directoryParts);
  const end = Buffer.concat([
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(entries.length),
    u16(entries.length),
    u32(directory.length),
    u32(localOffset),
    u16(0)
  ]);

  return Buffer.concat([
    ...localParts,
    directory,
    end
  ]);
}

function namedBlob(bytes, name) {
  const file = new Blob([bytes]);
  Object.defineProperty(file, "name", {
    value: name,
    configurable: false
  });
  return file;
}

async function expectReject(promise, pattern) {
  await assert.rejects(promise, pattern);
}

async function run() {
  assert.ok(
    Core.limits.MAX_UNCOMPRESSED_BYTES <=
      160 * 1024 * 1024,
    "A ZIP must not reserve more than the reviewed mobile memory ceiling."
  );
  assert.ok(
    Core.limits.MAX_COMPRESSION_RATIO <= 64,
    "Highly compressed ZIP bombs must be rejected before allocation."
  );

  const har = JSON.stringify({
    log: {
      version: "1.2",
      entries: []
    }
  });

  const plain = await Core.openCapture(
    namedBlob(har, "capture.har")
  );
  assert.equal(plain.zipped, false);
  assert.equal(
    Buffer.from(plain.buffer).toString("utf8"),
    har
  );

  const privateFragment =
    "PRIVATE_ACCOUNT_TOKEN_DO_NOT_RETURN";
  const workerHar = JSON.stringify({
    log: {
      entries: [
        {
          request: {
            url: "https://example.test/ext/dragonsong/event/use_gacha",
            postData: { text: privateFragment }
          }
        }
      ]
    },
    privateFragment
  });
  const fakeRuntime = {
    EventParser: {
      parse() {
        fakeRuntime.ChestCompanionLastImport = {
          kind: "har",
          diagnostics: {
            eventName: "Safe event",
            eventKey: "safe_event",
            sourceUrl:
              `https://private.test/?${privateFragment}`,
            availableChestTypes: ["gold"]
          }
        };
        return {
          event: "Safe event",
          chests: { gold: { found: true } }
        };
      }
    },
    HarGachaParser: {
      parse() {
        return {
          ready: true,
          requestCount: 1
        };
      }
    },
    OnyxTowerInventoryBridge: {
      clear() {},
      getSnapshot() {
        return {
          schemaVersion: 1,
          ready: false,
          records: [],
          diagnostics: {}
        };
      }
    }
  };
  const parsedCapture =
    await Core.parseCapture(
      namedBlob(workerHar, "private.har"),
      fakeRuntime
    );

  assert.equal(parsedCapture.zipped, false);
  assert.equal(
    parsedCapture.gachaData.requestCount,
    1
  );
  assert.equal(
    parsedCapture.importDiagnostics
      .diagnostics.eventName,
    "Safe event"
  );
  assert.equal(
    JSON.stringify(parsedCapture)
      .includes(privateFragment),
    false,
    "The worker result must contain no raw HAR fragments."
  );
  assert.equal(
    Object.hasOwn(parsedCapture, "buffer"),
    false
  );
  assert.equal(
    Object.hasOwn(parsedCapture, "text"),
    false
  );

  fakeRuntime.HarGachaParser.parse = () => {
    throw new Error(privateFragment);
  };
  const eventOnlyCapture =
    await Core.parseCapture(
      namedBlob(workerHar, "private.har"),
      fakeRuntime
    );
  assert.equal(
    eventOnlyCapture.eventData.event,
    "Safe event"
  );
  assert.equal(eventOnlyCapture.gachaData, null);
  assert.equal(
    JSON.stringify(eventOnlyCapture)
      .includes(privateFragment),
    false,
    "Optional gacha failures must not leak parser details."
  );

  const zipped = await Core.openCapture(
    namedBlob(
      makeZip([
        {
          name: "capture.har",
          data: har
        },
        {
          name: "__MACOSX/._capture.har",
          data: "metadata",
          method: 0
        }
      ]),
      "capture.har.zip"
    )
  );
  assert.equal(zipped.zipped, true);
  assert.equal(
    Buffer.from(zipped.buffer).toString("utf8"),
    har
  );

  await expectReject(
    Core.openCapture(namedBlob(
      makeZip([
        { name: "one.har", data: har },
        { name: "two.har", data: har }
      ]),
      "two.har.zip"
    )),
    /exactly one HAR/i
  );

  await expectReject(
    Core.openCapture(namedBlob(
      makeZip([
        { name: "../private.txt", data: "x" },
        { name: "capture.har", data: har }
      ]),
      "unsafe.har.zip"
    )),
    /unsafe file path/i
  );

  await expectReject(
    Core.openCapture(namedBlob(
      makeZip([
        {
          name: "capture.har",
          data: har,
          flags: 0x0801
        }
      ]),
      "encrypted.har.zip"
    )),
    /encrypted HAR/i
  );

  await expectReject(
    Core.openCapture(namedBlob(
      makeZip([
        {
          name: "capture.har",
          data: har,
          uncompressedSize:
            Core.limits.MAX_UNCOMPRESSED_BYTES + 1
        }
      ]),
      "huge.har.zip"
    )),
    /safe import limits/i
  );

  await expectReject(
    Core.openCapture(namedBlob(
      makeZip([
        {
          name: "capture.har",
          data: har,
          checksum: 1
        }
      ]),
      "corrupt.har.zip"
    )),
    /integrity check/i
  );

  await expectReject(
    Core.openCapture(
      namedBlob("not a zip", "capture.har.zip")
    ),
    /invalid or incomplete/i
  );

  const importerSource = fs.readFileSync(
    "event-import.js",
    "utf8"
  );
  const workerSource = fs.readFileSync(
    "chest-har-import-worker.js",
    "utf8"
  );

  assert.match(
    importerSource,
    /await readPrivateCapture\(\s*file[,)\s]/
  );
  assert.doesNotMatch(
    importerSource,
    /await file\.text\(\)/
  );
  assert.match(
    importerSource,
    /persistence:\s*restored[\s\S]*?"memory-only"/
  );
  assert.match(
    importerSource,
    /clearOnyxChestImportData/
  );
  assert.match(
    importerSource,
    /activeCaptureRequest\?\.cancel\?\.\(\)/,
    "Sign-out clearing must cancel an active capture worker."
  );
  assert.match(
    importerSource,
    /activeImportGeneration !==\s*importGeneration/,
    "A cancelled import must not repopulate private state."
  );
  assert.match(
    importerSource,
    /MAX_MAIN_THREAD_FALLBACK_BYTES\s*=\s*32 \* 1024 \* 1024/,
    "Only a small plain HAR may fall back to main-thread parsing."
  );
  assert.match(
    importerSource,
    /if \(zipped\) \{[\s\S]{0,240}zipped capture could not be parsed privately/i,
    "ZIP import must fail closed when its private worker fails."
  );
  assert.doesNotMatch(
    importerSource,
    /message\.buffer/,
    "The page must never receive raw HAR bytes from the worker."
  );
  assert.match(
    workerSource,
    /importScripts\(\.\.\.PARSER_SCRIPTS\)/,
    "Existing event, gacha and tower parsers must run inside the worker."
  );
  assert.doesNotMatch(
    workerSource,
    /postMessage\([\s\S]{0,300}buffer:\s*result\.buffer/,
    "The worker must never post its raw capture buffer to the page."
  );
  assert.doesNotMatch(
    importerSource,
    /console\.log\([\s\S]{0,80}(parsed|gachaData|sourceFile)/
  );
  assert.doesNotMatch(
    importerSource,
    /localStorage\.setItem/
  );
  assert.doesNotMatch(
    importerSource,
    /file\.name/
  );

  const legacyStorage = new Map([
    ["chestCompanionLiveEventData", "private"],
    ["chestCompanionLiveGachaData", "private"]
  ]);
  const browser = {
    Blob,
    TextDecoder,
    console: {
      info() {},
      warn() {},
      error() {}
    },
    localStorage: {
      getItem: key => legacyStorage.get(key) ?? null,
      removeItem: key => legacyStorage.delete(key),
      setItem: (key, value) =>
        legacyStorage.set(key, String(value))
    },
    document: {
      addEventListener() {},
      getElementById() {
        return null;
      }
    }
  };
  browser.window = browser;
  browser.currentEventData = { private: true };
  browser.currentGachaData = { private: true };
  browser.currentEventSourceFile = { private: true };
  browser.ChestCompanionLastImport = { private: true };

  vm.runInNewContext(
    importerSource,
    browser,
    { filename: "event-import.js" }
  );

  assert.equal(
    legacyStorage.size,
    0,
    "Legacy browser-wide import data must be removed at startup."
  );
  assert.equal(
    typeof browser.clearOnyxChestImportData,
    "function"
  );

  browser.clearOnyxChestImportData({
    resetInterface: false,
    clearFileInput: false
  });
  assert.equal(browser.currentEventData, null);
  assert.equal(browser.currentGachaData, null);
  assert.equal(browser.currentEventSourceFile, null);
  assert.equal(
    Object.hasOwn(
      browser,
      "ChestCompanionLastImport"
    ),
    false
  );

  console.log(
    "Private chest HAR and HAR.ZIP import checks passed."
  );
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
