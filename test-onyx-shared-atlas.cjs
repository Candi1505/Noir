const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {stripTypeScriptTypes} = require('node:module');
const {webcrypto} = require('node:crypto');
const grant = {owner:'owner-id',expires_at:new Date(Date.now()+3600000).toISOString()};
function fixture(name, options={}) {
  const calls=[];
  let handler;
  const env={SUPABASE_URL:'https://db.test',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'service',WAR_DRAGONS_OWNER_USER_ID:'owner-id',WAR_DRAGONS_API_KEY:'private-owner-key',WAR_DRAGONS_CLIENT_SECRET:'private-secret'};
  const source=fs.readFileSync(`supabase/functions/${name}/index.ts`,'utf8').replace(/^import .*;\n/, '');
  const context={URL,URLSearchParams,Response,Request,Headers,TextEncoder,TextDecoder,AbortController,DOMException,Date,crypto:webcrypto,setTimeout,clearTimeout,atob,btoa,
    Deno:{env:{get:k=>env[k]},serve:fn=>handler=fn},
    fetch:async(url,init={})=>{
      url=String(url);calls.push({url,init});
      if(url.endsWith('/auth/v1/user')) return Response.json({id: options.owner?'owner-id':'lax-id',app_metadata:options.meta===undefined?{onyx_shared_atlas:grant}:options.meta,user_metadata:{onyx_shared_atlas:grant}});
      if(url.includes('/auth/v1/admin/users/')) return Response.json({});
      if(url.includes('war_dragons_connections')) return Response.json([]);
      if(url.includes('/rpc/claim_war_dragons_critical_request')) return Response.json(0);
      if(url.includes('/rpc/claim_war_dragons_info_request')) return Response.json(0);
      if(url.includes('/api/v2/castle_critical')) return Response.json({'22-A1-0':{fleets:[]}});
      if(url.includes('/api/v2/castle_info')) return Response.json({'22-A1-0':{custom_name:'Keep'}});
      if(url.includes('/castles/metadata/macro')) return Response.json({castles:{'A1-0':{owner_team:'SR',level:2}}});
      if(url.includes('/teams/metadata/macro')) return Response.json({teams:{SR:{power_rank:17,rank:20}}});
      if(url.includes('/my_profile')) return Response.json({name:'Owner private profile',guild_name:'SR'});
      throw Error('Unexpected endpoint: '+url);
    }};
  vm.createContext(context);vm.runInContext(stripTypeScriptTypes(source),context);
  return {calls,request:body=>handler(new Request('https://edge.test',{method:'POST',headers:{origin:'https://candi1505.github.io',authorization:'Bearer test','content-type':'application/json'},body:JSON.stringify(body)}))};
}
(async()=>{
  for(const meta of [{},{onyx_shared_atlas:{...grant,owner:'other'}},{onyx_shared_atlas:{...grant,expires_at:'2000-01-01'}}]) {
    const f=fixture('onyx-war-dragons',{meta});
    assert.equal((await f.request({resource:'atlasCritical',castleIds:['22-A1-0']})).status,403);
    assert.ok(!f.calls.some(c=>c.url.includes('appspot.com')),'uninvited/expired/user_metadata grants cannot reach upstream');
  }
  const f=fixture('onyx-war-dragons');
  assert.equal((await f.request({resource:'profile'})).status,403);
  assert.ok(!f.calls.some(c=>c.url.includes('my_profile')));
  const context=await (await f.request({resource:'atlasContext'})).json();
  assert.equal(context.data.kingdomId,null);
  assert.ok(!f.calls.some(c=>c.url.includes('team/battles')));
  assert.equal((await f.request({resource:'atlasCritical',castleIds:['22-A1-0']})).status,200);
  const rate=f.calls.find(c=>c.url.includes('claim_war_dragons_critical_request'));
  assert.equal(JSON.parse(rate.init.body).p_user_id,'owner-id');
  const macro=await (await f.request({resource:'atlasMacro',kingdomId:22,realmName:'Celestial_Haven'})).json();
  assert.equal(macro.data.playerTeam,null);assert.equal(macro.data.playerApr,null);
  assert.ok(!f.calls.some(c=>c.url.includes('my_profile')));
  assert.ok(!JSON.stringify(macro).includes('private-owner-key'));
  const o=fixture('onyx-war-dragons',{owner:true,meta:{}});
  assert.equal((await o.request({resource:'profile'})).status,200,'owner profile remains available to owner');
  const s=fixture('onyx-war-dragons-oauth');
  const status=await (await s.request({action:'status'})).json();
  assert.equal(status.connectionMode,'shared');assert.equal(status.connected,true);
  assert.deepEqual(status.scopes,['atlas.read']);assert.equal(status.playerId,null);
  await s.request({action:'disconnect'});
  const revoke=s.calls.find(c=>c.url.includes('/auth/v1/admin/users/lax-id'));
  assert.equal(JSON.parse(revoke.init.body).app_metadata.onyx_shared_atlas,null);
  const revoked=fixture('onyx-war-dragons',{meta:{onyx_shared_atlas:null}});
  assert.equal((await revoked.request({resource:'atlasCritical',castleIds:['22-A1-0']})).status,403);
  console.log('Shared Atlas isolation, spoofing, expiration, revocation, owner profile and shared quota checks passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
