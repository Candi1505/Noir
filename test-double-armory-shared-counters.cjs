'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Core = require('./double-armory-core.js');
const reward = (id, mu = 1) => ({ id, mu, kind: 'curr', drop_type: 'Epic' });
const side = (eventKey, pool) => ({eventKey, ready:true,
  chests:{gold:{ready:true,mainKey:'root',bonusKey:'pool'}},
  decks:{root:[0,0,0],pool:pool.map((_,i)=>i)},
  drops:{root:[{id:'pool',kind:'drop'}],pool:pool.map(id=>reward(id))}});
const data={availableChestTypes:['gold'],sides:{assault:side('assault1',['A','B']),breeding:side('breeding1',['X','Y','Z'])}};
const obs=(armory,code,isBonus=false)=>({armory,reward:{code,amount:1},isBonus});
// Same absolute pool counter, different deck lengths: never rotate a flat list.
const history=[obs('assault','A'),obs('breeding','Y'),obs('assault','A'),obs('breeding','X',true)];
const solution=Core.solve(data,'gold',history,{root:[0],pool:[0]});
assert.equal(solution.matched,true);
assert.deepEqual(solution.states[0].root,[0]); // Three regular draws; bonus doesn't advance root.
assert.equal(Core.forecast(data,'gold',solution,'assault',1)[0].code,'A');
assert.equal(Core.forecast(data,'gold',solution,'breeding',1)[0].code,'Y');
assert.equal(Core.solve(data,'gold',[obs('assault','INVALID')]).matched,false);
assert.deepEqual(Core.forecast(data,'gold',Core.solve(data,'gold',[]),'assault'),[]);
const ambiguous=Core.solve(data,'gold',[obs('assault','A')]);
assert.equal(Core.forecast(data,'gold',ambiguous,'breeding',1)[0].exact,false);
// Missing nested pools and non-fixed amounts cannot become exact rewards.
const broken=structuredClone(data);broken.sides.assault.drops.root[0].id='missing';
assert.equal(Core.solve(broken,'gold',[obs('assault','missing')]).matched,false);
const variable=structuredClone(data);variable.sides.assault.drops.pool[0].sdev=1;
assert.equal(Core.solve(variable,'gold',[obs('assault','A')],{root:[0],pool:[0]}).matched,false);

// Scaled-food aliases require explicit, unambiguous prize metadata.
{
  const context={console,URLSearchParams,Date};context.window=context;
  vm.createContext(context);vm.runInContext(fs.readFileSync('js/har-gacha-parser.js','utf8'),context);
  const prize=(generic='foodConsumable2',amount=1)=>({meta:{item_to_log:{[generic]:amount}},consumables:{foodPack_460000:1}});
  const parseAlias=prizes=>context.HarGachaParser.parse({log:{entries:[
    {request:{url:'https://example.test/about_v2'},response:{content:{text:JSON.stringify({prizes})}}},
    {request:{url:'https://example.test/ext/dragonsong/event/use_gacha',postData:{text:'spin_type=2&count=1'}},response:{content:{text:JSON.stringify({drops:[{id:'foodPack_460000',quantity:1,src:'epic_items'}]})}}}
  ]}}).openings[0].orderedDrops[0];
  assert.equal(parseAlias([prize()]).canonicalCode,'foodConsumable2');
  assert.equal(parseAlias([]).canonicalCode,undefined);
  assert.equal(parseAlias([prize('foodConsumable2',2)]).canonicalCode,undefined);
  assert.equal(parseAlias([prize(),prize('foodConsumable3')]).canonicalCode,undefined);
}

// Optional private replay. No account data, HAR or opening history is committed.
if(process.argv[2]) {
  global.window=global;global.document={readyState:'loading',addEventListener(){}};global.addEventListener=()=>{};
  for(const file of ['event-parser.js','har-event-adapter.js','js/har-gacha-parser.js','double-armory-event-data.js'])
    vm.runInThisContext(fs.readFileSync(file,'utf8'),{filename:file});
  const har=JSON.parse(fs.readFileSync(process.argv[2]));
  const eventData=EventParser.parse(har), gachaData=HarGachaParser.parse(har);
  const parsed={eventData,gachaData,importDiagnostics:ChestCompanionLastImport};
  const prepared=Core.prepareCapture(OnyxDoubleArmoryEvent,parsed);
  assert.equal(prepared.verifiedDrops,12);
  for(const [type,state] of Object.entries(prepared.chests)) {
    assert.equal(Core.solve(OnyxDoubleArmoryEvent,type,state.observations,state.initialState).matched,true);
    assert.equal(Core.solve(OnyxDoubleArmoryEvent,type,state.observations).matched,true);
  }
  // HAR array ordering must not change the chosen setup snapshot or replay.
  har.log.entries.reverse();
  const reversed={eventData:EventParser.parse(har),gachaData:HarGachaParser.parse(har),importDiagnostics:ChestCompanionLastImport};
  assert.deepEqual(Core.prepareCapture(OnyxDoubleArmoryEvent,reversed),prepared);
  const corrupt=structuredClone(parsed);corrupt.gachaData.openings[0].orderedDrops[0].amount=999999999;
  assert.throws(()=>Core.prepareCapture(OnyxDoubleArmoryEvent,corrupt),/does not replay/);
  for(const unsafe of [{scanTruncated:true},{errors:[{}]},{unknownSpinTypes:['unknown']}])
    assert.throws(()=>Core.prepareCapture(OnyxDoubleArmoryEvent,{...parsed,gachaData:{...gachaData,...unsafe}}),/incomplete/);
  const text=fs.readFileSync('double-armory-event-data.js','utf8');
  for(const privateKey of ['deckIndices','deck_indices','orderedDrops','observations','new_curr','request','headers']) assert.equal(text.includes('"'+privateKey+'"'),false);
  console.log('Private capture: 12/12 ordered rewards reproduced; reverse chronology and bad-reward rejection passed.');
  if (process.argv[3]) {
    const followupHar=JSON.parse(fs.readFileSync(process.argv[3]));
    const followup={eventData:EventParser.parse(followupHar),gachaData:HarGachaParser.parse(followupHar),importDiagnostics:ChestCompanionLastImport};
    const next=Core.prepareCapture(OnyxDoubleArmoryEvent,followup);
    assert.equal(next.verifiedDrops,22);
    let matches=0;
    for(const [type,state] of Object.entries(next.chests)) {
      const previous=prepared.chests[type], history=[...previous.observations];
      for(const observation of state.observations) {
        const prediction=Core.forecast(OnyxDoubleArmoryEvent,type,Core.solve(OnyxDoubleArmoryEvent,type,history,previous.initialState),observation.armory,1,observation.isBonus)[0];
        assert.equal(prediction.exact,true);
        assert.equal(Core.signature(prediction),Core.signature(observation.reward));
        history.push(observation);matches++;
      }
    }
    assert.equal(matches,22);
    console.log('Independent follow-up: 22/22 forecasts match new ordered drops, including verified scaled-food identity.');
  }
}
console.log('Double Armoury shared-counter, bonus, ambiguity and missing-data tests passed.');
