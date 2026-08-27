const fs = require("node:fs");
const path = require("node:path");

const html = fs.readFileSync("index.html", "utf8");
const ids = [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(match => match[1]);
const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
const viewIds = new Set(
  [...html.matchAll(/<section\b[^>]*\bid=["']([^"']+)["'][^>]*\bclass=["'][^"']*\bview\b[^"']*["']/g)]
    .map(match => match[1])
);
const commandViews = [...html.matchAll(/\bdata-command-view=["']([^"']+)["']/g)]
  .map(match => match[1]);
const missingViews = [...new Set(commandViews.filter(viewId => !viewIds.has(viewId)))];
const requiredIds = [
  "homeView",
  "chestCommandView",
  "seasonCommandView",
  "onyxIntelView",
  "onyxSigils",
  "onyxChestEstimate",
  "onyxRouteRows"
];
const missingIds = requiredIds.filter(id => !ids.includes(id));
const requiredFiles = [
  "onyx-command.css",
  "onyx-command.js",
  "season-command-data.js",
  "assets/onyx-command-dragon.webp"
];
const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
const privateCaptureFiles = [];

function walk(directory) {
  fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
    if ([".git", "node_modules"].includes(entry.name)) return;
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) return walk(target);
    if (/\.(har|pcap|pcapng)$/i.test(entry.name) || /\.har\.zip$/i.test(entry.name)) {
      privateCaptureFiles.push(target);
    }
  });
}

walk(".");

const dataIndex = html.indexOf("season-command-data.js");
const uiIndex = html.indexOf("onyx-command.js");
const appIndex = html.indexOf("app.js?v=");
const scriptOrderValid = dataIndex >= 0 && dataIndex < uiIndex && uiIndex < appIndex;

if (
  duplicateIds.length ||
  missingViews.length ||
  missingIds.length ||
  missingFiles.length ||
  privateCaptureFiles.length ||
  !scriptOrderValid
) {
  throw new Error(JSON.stringify({
    duplicateIds,
    missingViews,
    missingIds,
    missingFiles,
    privateCaptureFiles,
    scriptOrderValid
  }, null, 2));
}

console.log(JSON.stringify({
  views: viewIds.size,
  commandLinks: commandViews.length,
  duplicateIds: 0,
  privateCaptures: 0,
  scriptOrderValid,
  status: "PASS"
}, null, 2));
