const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');

const source = readFileSync('supabase/functions/onyx-war-dragons/index.ts', 'utf8')
  .replace(/^import .*;\n/, '').split('Deno.serve(')[0];

function fixture(payload, status = 200) {
  const requests = [];
  const context = vm.createContext({
    URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    crypto: require('node:crypto').webcrypto, TextEncoder,
    fetch: async (url, options) => {
      requests.push({ url: String(url), options });
      return { ok: status === 200, status, text: async () => JSON.stringify(payload) };
    }
  });
  vm.runInContext(stripTypeScriptTypes(source), context);
  return { requests, run: () => context.handleAtlasContext('fixture-key', 'fixture-secret') };
}

test('discovers the current Atlas kingdom from the newest team battle only', async () => {
  const f = fixture({
    cursor: '',
    reports: [
      { ts: 100, place_id: { k_id: 1, region_id: 'A1', cont_idx: 0 }, attacker: { name: 'private' } },
      { ts: 300, place_id: { k_id: 22, region_id: 'A9', cont_idx: 2 }, defender: { name: 'private' } },
      { ts: 200, place_id: { k_id: 7, region_id: 'A4', cont_idx: 1 } }
    ]
  });
  const result = await f.run();
  assert.equal(result.ok, true);
  assert.deepEqual(JSON.parse(JSON.stringify(result.data)), {
    kingdomId: 22,
    evidence: 'recent-team-battle',
    validReportCount: 3
  });
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.equal(new URL(f.requests[0].url).pathname, '/api/v1/atlas/team/battles');
});

test('does not invent a kingdom when battle evidence is absent', async () => {
  const result = await fixture({ reports: [{ ts: 1, place_id: { k_id: 0 } }] }).run();
  assert.equal(result.data.kingdomId, null);
  assert.equal(result.data.evidence, 'unavailable');
  assert.equal(result.data.validReportCount, 0);
});

test('preserves an upstream failure without exposing its payload', async () => {
  const result = await fixture({ private: 'do not release' }, 429).run();
  assert.equal(result.ok, false);
  assert.equal(result.status, 429);
  assert.equal(result.code, 'atlas-context-unavailable');
  assert.equal(JSON.stringify(result).includes('do not release'), false);
});
