const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const fixture = require('./tests/fixtures/merge-july-2026.json');
const s = {document: {readyState: 'loading', addEventListener() {}}, addEventListener() {}};
s.window = s;
vm.createContext(s);
for (const file of ['base-adviser-catalog-towers.js', 'onyx-base-command.js']) vm.runInContext(fs.readFileSync(file, 'utf8'), s);
const live = s.NoirBaseCatalog;
const base = {destinationType: 'Charged Volt Tower', destinationLevel: 200, maximumTowerLevel: 208};
for (const [type, rows] of Object.entries(fixture.towerLevels)) {
  for (const row of rows.filter(r => r.level <= 208)) {
    const actual = live.towerLevels[type].find(r => r.level === row.level);
    for (const field of ['cost', 'seconds', 'xp']) assert.equal(actual[field], row[field], `${type} ${row.level}: ${field} must match July HAR`);
  }
}
for (const catalog of [live, {towers: [], towerLevels: fixture.towerLevels}]) {
  s.NoirBaseCatalog = catalog;
  for (const preview of fixture.previews) {
    const r = s.OnyxBaseCommand.estimateMerge({...base, ...preview});
    assert.equal(r.ok, true, r.message);
    assert.equal(r.resultLevel, preview.resultLevel);
    assert.equal(r.xpDebt, preview.xpDebt);
  }
}
const input = {...base, sourceType: 'Electro-Flak Tower', sourceLevel: 41, quantity: 1};
for (const change of [{sourceType: 'Unknown'}, {quantity: 1.5}, {destinationLevel: 200.5}, {previewResultLevel: 'bad'}]) {
  assert.equal(s.OnyxBaseCommand.estimateMerge({...input, ...change}).ok, false);
}
for (const corruption of ['gap', 'xp', 'seconds', 'cost']) {
  const rows = JSON.parse(JSON.stringify(fixture.towerLevels));
  if (corruption === 'gap') rows['Electro-Flak Tower'].splice(9, 1);
  else rows['Electro-Flak Tower'][9][corruption] = corruption === 'cost' ? 'newCurrency:10' : null;
  s.NoirBaseCatalog = {towers: [], towerLevels: rows};
  assert.equal(s.OnyxBaseCommand.estimateMerge(input).ok, false, corruption);
}
s.NoirBaseCatalog = live;
console.log('PASS: July HAR costs/time/XP match catalogue through level 208; all four recorded previews match on both datasets; invalid and incomplete data rejected.');
