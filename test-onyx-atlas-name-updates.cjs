const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = fs.readFileSync('onyx-atlas-castle-hunter-core.js', 'utf8');
const command = fs.readFileSync('onyx-atlas-command.js', 'utf8');
// Expose private orchestration only in the VM, not in production's public API.
const hunter = fs.readFileSync('onyx-atlas-castle-hunter.js', 'utf8').replace(
  '  window.OnyxAtlasCastleHunter = Object.freeze({',
  `  window.testHunter = {
    start(value) { snapshot = value; playerId = 'test-player'; loadedPlayerId = playerId;
      liveScanning = true; cancelLiveScan = false; syncAtlasCommandSnapshot(snapshot);
      return loadCastleDetails(snapshot.records); },
    clearScan, handleLiveButton, handleConnectionState,
    cancelled: () => cancelLiveScan,
    snapshot: () => snapshot
  };
  window.OnyxAtlasCastleHunter = Object.freeze({`
);
function fixture(count = 50) {
  const requests = [], storage = new Map();
  const classes = new Set(['open']);
  const overlay = {
    innerHTML: '', classList: { contains: s => classes.has(s), add: s => classes.add(s), remove: s => classes.delete(s) },
    querySelector: () => null, querySelectorAll: () => [], setAttribute() {}
  };
  const context = {
    console, Date, Intl, setTimeout, clearTimeout,
    localStorage: { getItem: k => storage.get(k) || null, setItem: (k,v) => storage.set(k,v) },
    document: { getElementById: () => overlay, body: { classList: {add(){},remove(){}} }, addEventListener(){}, removeEventListener(){} },
    addEventListener(){},
    OnyxCommandCore: {getCurrentUserId: () => 'test-player'},
    OnyxWarDragonsAPI: { atlasInfo: ids => new Promise((resolve,reject) => requests.push({ids,resolve,reject})) }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(core, context);
  vm.runInContext(command, context);
  vm.runInContext(hunter, context);
  const now = Date.now()/1000;
  const snapshot = {schemaVersion: 2, capturedAt: now, lastLiveAt: now, atlas: {}, records: Array.from({length:count},(_,i)=>({
    coordinate: `22-A1-${i}`, name: '', source: 'official', tier: 2, guards: 500+i,
    criticalObservedAt: now, shield: {state:'down', observedAt:now, endAt:null}
  }))};
  function deliver(index) {
    const req = requests[index];
    req.resolve({records:req.ids.map((coordinate,i)=>({coordinate,available:true,name:`Named Keep ${index*25+i}`,observedAt:now}))});
  }
  return {context, overlay, requests, snapshot, deliver};
}
const tick = () => new Promise(resolve => setImmediate(resolve));

test('name batches keep updating Overview and Castles after leaving Hunter', async () => {
  const f=fixture();
  const task=f.context.testHunter.start(f.snapshot);
  assert.equal(f.requests.length,1);
  f.context.OnyxAtlasCommand.open('overview');
  assert.equal(f.context.testHunter.cancelled(),false);
  f.deliver(0); await tick();
  assert.match(f.overlay.innerHTML, /Named Keep 0/);
  assert.equal(f.requests.length,2,'board repaint must not cancel the next batch');
  f.context.OnyxAtlasCommand.open('castles');
  f.deliver(1); await task;
  const castles=f.context.OnyxAtlasCommand.getLiveState().castles;
  assert.equal(castles[49].name,'Named Keep 49');
  assert.equal(castles[49].id,'22-A1-49','display names must not replace canonical IDs');
  assert.equal(castles[49].troops,549,'name enrichment retains troop observations');
  assert.equal(f.context.testHunter.cancelled(),false);
  // Reopening the target by its original ID renders the newly fetched name.
  f.context.OnyxAtlasCommand.openGloryTarget('22-A1-49');
  assert.match(f.overlay.innerHTML,/Named Keep 49/);
  assert.equal(f.context.OnyxAtlasCastleHunter.castleDetailBatches(f.context.testHunter.snapshot().records).length,0);
});

test('Stop, Clear and closing Atlas reject a late in-flight name response', async () => {
  for (const action of ['stop','clear','close']) {
    const f=fixture(25), task=f.context.testHunter.start(f.snapshot);
    if(action==='stop') await f.context.testHunter.handleLiveButton();
    if(action==='clear') await f.context.testHunter.clearScan();
    if(action==='close') f.context.OnyxAtlasCommand.close();
    f.deliver(0); await task;
    assert.equal(f.context.testHunter.snapshot().records[0].name,'',action);
    assert.equal(f.requests.length,1);
  }
});

test('connection refresh preserves a scan, account change cancels it', async () => {
  const f=fixture(25), task=f.context.testHunter.start(f.snapshot);
  f.context.testHunter.handleConnectionState({detail:{phase:'checking',connected:true,playerId:'test-player'}});
  assert.equal(f.context.testHunter.cancelled(),false);
  f.context.testHunter.handleConnectionState({detail:{phase:'connected',connected:true,playerId:'other-player'}});
  assert.equal(f.context.testHunter.cancelled(),true);
  f.deliver(0); await task;
  assert.equal(f.context.testHunter.snapshot().records[0].name,'');
});

test('Overview cards open the exact castle and expose its coordinate copy action', () => {
  for (const activation of ['click', 'Enter', ' ']) {
    const f = fixture();
    const handlers = {};
    const card = { dataset: {oacLiveTarget: '22-A1-1'}, addEventListener: (name, fn) => {handlers[name] = fn;} };
    f.overlay.querySelectorAll = selector => selector === '[data-oac-live-target]' ? [card] : [];
    f.context.OnyxAtlasCommand.setLiveSnapshot({castles: [
      {id:'22-A1-1', name:'Chosen Castle', shieldState:'vulnerable', mapCoordinates:'X:123 Y:456'},
      {id:'22-A1-10', name:'Different Castle', shieldState:'vulnerable', mapCoordinates:'X:999 Y:999'}
    ]});
    f.context.OnyxAtlasCommand.open('overview');
    assert.match(f.overlay.innerHTML, /role="button" tabindex="0" data-oac-live-target="22-A1-1"/);
    if (activation === 'click') handlers.click();
    else handlers.keydown({key:activation, preventDefault(){}});
    assert.match(f.overlay.innerHTML, /Castle target board/);
    assert.match(f.overlay.innerHTML, /Chosen Castle/);
    assert.doesNotMatch(f.overlay.innerHTML, /Different Castle/);
    assert.match(f.overlay.innerHTML, /data-oac-copy-coordinate="X:123 Y:456"/);
  }
});
