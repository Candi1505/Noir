const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const appSource = fs.readFileSync("app.js", "utf8");
const plannerSource = fs.readFileSync("chest-planner.js", "utf8");
const ratesSource = fs.readFileSync("chest-drop-rates.js", "utf8");
const liveUiSource = fs.readFileSync("live-predictor-ui.js", "utf8");
const stylesSource = fs.readFileSync("styles.css", "utf8");

assert.doesNotMatch(
  appSource,
  /ChestPredictorEngine\?\.getRewardSequence\?\.\(\)/,
  "The Full Table must not call getRewardSequence without its required profile and rarity."
);
assert.match(
  appSource,
  /const sequence =\s*getSequence\(\s*currentChest\s*\)/,
  "The Full Table must use the same current-chest sequence builder as predictions."
);
assert.doesNotMatch(
  appSource,
  /FULL SEQUENCE TABLE TOGGLE[\s\S]*document\.addEventListener\("DOMContentLoaded"/,
  "Only the application event binder may own the Full Table toggle."
);
assert.match(
  appSource,
  /ChestPredictorCloud[\s\S]*withTimeout\([\s\S]*\.then\(/,
  "Predictor cloud sync must continue independently after access is verified."
);
assert.doesNotMatch(
  appSource,
  /await withTimeout\(\s*window\.ChestPredictorCloud/,
  "Authenticated startup must not await predictor cloud sync."
);
assert.match(
  appSource,
  /function applyDefaultChestPreference\(\)/,
  "A saved favourite chest must be applied as the live predictor default."
);
assert.match(
  appSource,
  /"chest-companion-predictors-ready"[\s\S]*updateCloudBadge\(/,
  "A successful predictor retry must restore the cloud-connected badge."
);
assert.match(
  appSource,
  /super_sigil:\s*savedState\s*\.priorities\s*\?\.super_sigil\s*\|\|\s*\{\}/,
  "Super Sigil priorities must survive an account-state round trip."
);
assert.match(
  appSource,
  /FALLBACK_DATA\[\s*chestType\s*\]\?\.rewards \|\| \[\]/,
  "A live-only chest type must use a null-safe reward fallback."
);

[
  "chest_companion_v2",
  "chestCompanionLivePredictor",
  "onyxCommandStateV1",
  "onyxBaseLayoutV2",
  "onyxBaseLayoutV1",
  "onyxTowerMergeV1",
  "onyxBaseReferenceV1",
  "onyxFortificationCommandV1",
  "chestCompanionDoubleArmory",
  "onyxAtlasManualV1",
  "onyxAtlasModeV1",
  "onyxAtlasFiltersV1"
].forEach(prefix => {
  assert.match(
    appSource,
    new RegExp(`"${prefix}"`),
    `Reset must include ${prefix}.`
  );
});
assert.doesNotMatch(
  appSource,
  /localStorage\.clear\s*\(/,
  "Reset must never clear another player's browser data."
);
assert.match(
  appSource,
  /\.delete\(\s*cleanUserId\s*\)/,
  "Reset must delete only the current player's Atlas snapshot."
);

assert.doesNotMatch(
  ratesSource,
  /localStorage\.getItem\(\s*"chestCompanionPublishedEvent"/,
  "Drop Rates must never revive an old browser-wide event cache."
);
assert.match(
  plannerSource,
  /if \(!currentChestOrder\.length\)/,
  "Planner must handle a known event with no active chest decks."
);
assert.doesNotMatch(
  plannerSource,
  /amountRenderTimer/,
  "Typing in planner amounts must not trigger a destructive overlay re-render."
);
assert.match(
  ratesSource,
  /if \(!currentChestTypes\.length\)/,
  "Drop Rates must handle a known event with no active chest decks."
);
assert.doesNotMatch(
  ratesSource,
  /currentChestTypes\[0\] \|\|\s*"gold"/,
  "A known empty live menu must never fall back to Gold."
);

assert.match(
  liveUiSource,
  /event\.key === "Escape" &&\s*overlay\?\.classList\.contains\(\s*"lp-open"/,
  "Escape must affect the Live Predictor only while its own overlay is open."
);
assert.match(
  liveUiSource,
  /if \(\s*!overlay\?\.classList\.contains\(\s*"lp-open"\s*\)\s*\) \{\s*return;/,
  "Closing an already closed Live Predictor must not unlock the page."
);

assert.doesNotMatch(
  stylesSource,
  /eff-artwork\.jpeg/,
  "The production stylesheet must not request missing artwork."
);
assert.doesNotMatch(
  stylesSource,
  /\nnav\s*\{/,
  "Bottom-navigation rules must not style every nav element in the app."
);

function runtimeContext() {
  const overlay = {
    innerHTML: "",
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
  const context = {
    console,
    Intl,
    setTimeout,
    clearTimeout,
    document: {
      readyState: "loading",
      addEventListener() {},
      getElementById(id) {
        return id === "chestPlannerOverlay" ||
          id === "chestDropRatesOverlay"
          ? overlay
          : null;
      }
    },
    localStorage: {
      getItem() {
        throw new Error("Legacy local event cache must not be read.");
      }
    },
    currentEventData: {
      event: "No active chests",
      decks: {},
      drops: {},
      availabilityKnown: true,
      availableChestTypes: []
    },
    addEventListener() {}
  };
  context.window = context;
  vm.createContext(context);
  return { context, overlay };
}

const runtime = runtimeContext();
vm.runInContext(ratesSource, runtime.context, {
  filename: "chest-drop-rates.js"
});
runtime.context.ChestDropRates.render();
assert.match(runtime.overlay.innerHTML, /No chest decks are active/);
assert.doesNotMatch(runtime.overlay.innerHTML, />Gold</);

vm.runInContext(plannerSource, runtime.context, {
  filename: "chest-planner.js"
});
runtime.context.ChestPlanner.render();
assert.match(runtime.overlay.innerHTML, /No chest decks are active/);
assert.doesNotMatch(runtime.overlay.innerHTML, /Open Gold Chests/);

console.log("Core UI runtime regression tests passed.");
