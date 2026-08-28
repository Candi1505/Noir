const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const messages = [];
const context = {
  TextDecoder,
  structuredClone,
  atob,
  console: {
    info() {},
    warn(...values) {
      messages.push(values.map(String).join(" | "));
    },
    error(...values) {
      messages.push(values.map(String).join(" | "));
    }
  },
  document: {
    addEventListener() {}
  },
  addEventListener() {}
};
context.window = context;
vm.createContext(context);

vm.runInContext(
  fs.readFileSync("event-parser.js", "utf8"),
  context,
  { filename: "event-parser.js" }
);
vm.runInContext(
  fs.readFileSync("har-event-adapter.js", "utf8"),
  context,
  { filename: "har-event-adapter.js" }
);

const privateFragment = "PRIVATE_TOKEN=abc123";
const malformedHar = {
  log: {
    entries: [
      {
        request: {
          url: "https://example.invalid/ext/dragonsong/event/about_v2"
        },
        response: {
          content: {
            text: privateFragment
          }
        }
      }
    ]
  }
};

assert.throws(
  () => context.EventParser.parse(malformedHar),
  /No usable event intelligence/
);
assert.equal(
  messages.some(message =>
    message.includes(privateFragment)
  ),
  false,
  "Malformed HAR fragments must never be written to the console."
);
assert.equal(
  Object.hasOwn(context, "testEventParser"),
  false,
  "Production must not expose a helper that prints parsed event data."
);

const gachaSource = fs.readFileSync(
  "js/har-gacha-parser.js",
  "utf8"
);
assert.doesNotMatch(
  gachaSource,
  /testHarGachaParser|console\.log\(\s*"Openings:"/,
  "Production must not expose a helper that prints private opening history."
);

console.log("HAR console redaction checks passed.");
