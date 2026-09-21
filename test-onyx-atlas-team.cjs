const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { stripTypeScriptTypes } = require('node:module');
const vm = require('node:vm');
const source = readFileSync('supabase/functions/onyx-war-dragons/index.ts', 'utf8')
  .replace(/^import .*;\n/, '').split('Deno.serve(')[0];
function fixture(payload, status = 200) {
  const requests = [];
  const context = vm.createContext({ URL, URLSearchParams, AbortController, setTimeout, clearTimeout,
    crypto: require('node:crypto').webcrypto, TextEncoder,
    fetch: async (url, options) => {
      requests.push({ url: String(url), options });
      return { ok: status === 200, status, text: async () => JSON.stringify(payload) };
    }
  });
  vm.runInContext(stripTypeScriptTypes(source), context);
  return { requests, run: body => context.handleAtlasTeam('fixture-key', 'fixture-secret', body) };
}
const body = { teamName: 'SeveredReality', realmName: 'Celestial_Haven', kingdomId: 1 };
test('direct team lookup sends one exact team and releases only its public capital', async () => {
  const f = fixture({ SeveredReality: { capital: [1, 'A123', 2], roster: [{player_name:'private fixture'}] }, OtherTeam: { capital:[1,'A9',0] } });
  const result = await f.run(body);
  assert.equal(result.ok, true);
  assert.equal(result.data.teams.length, 1);
  assert.equal(result.data.teams[0].capitalId, '1-A123-2');
  assert.equal(JSON.stringify(result).includes('roster'), false);
  assert.equal(f.requests[0].options.method, 'GET');
  const query = new URL(f.requests[0].url).searchParams;
  assert.equal(query.get('teams'), 'SeveredReality');
  assert.equal(query.get('k_id'), '1');
  assert.equal(query.get('realm_name'), 'Celestial_Haven');
});
test('missing team remains missing and malformed capital is not a coordinate', async () => {
  assert.equal((await fixture({}).run(body)).data.teams.length, 0);
  assert.equal((await fixture({SeveredReality:{capital:['bad','X',false]}}).run(body)).data.teams[0].capitalId, null);
});
test('invalid request never reaches upstream and rate-limit is preserved', async () => {
  const f = fixture({});
  assert.equal((await f.run({...body, teamName:''})).status, 400);
  assert.equal(f.requests.length, 0);
  assert.equal((await fixture({},429).run(body)).status, 429);
});
