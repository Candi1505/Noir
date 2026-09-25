const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sandbox = { document: { readyState: 'loading', addEventListener() {} }, addEventListener() {} };
sandbox.window = sandbox;
vm.createContext(sandbox);
for (const file of ['base-adviser-catalog-towers.js', 'onyx-base-command.js']) vm.runInContext(fs.readFileSync(file,'utf8'),sandbox);
const api = sandbox.OnyxBaseCommand;
const input = { destinationType:'Ice Flak Tower', destinationLevel:142, targetLevel:185, maximumTowerLevel:185, maxQuantity:20, includeMixed:false };
for (const current of [142,182]) {
 const r=api.planTargetMerge({...input,destinationLevel:current});
 assert.equal(r.ok,true,r.message); assert.ok(r.checked>0); assert.ok(r.options.length>0);
 for (const o of r.options) {
  const forward=api.estimateMerge({...input,destinationLevel:current,...o,previewResultLevel:''});
  assert.equal(o.resultLevel,forward.resultLevel); assert.equal(o.xpDebt,forward.xpDebt);
  assert.ok(o.resultLevel>=185); assert.ok(o.quantity<=20);
 }
 assert.ok(r.options.every((o,i,a)=>!i || a[i-1].seconds<=o.seconds));
 console.log(current+' → 185:',r.checked,'candidate batches');
}
for(const change of [{targetLevel:142},{targetLevel:186},{maxQuantity:0},{maxQuantity:101},{destinationLevel:1.5},{destinationType:'No tower'},{sortBy:'invalid'}]) assert.equal(api.planTargetMerge({...input,...change}).ok,false);
const resources=api.planTargetMerge({...input,sortBy:'elementalEmber'});
assert.ok(resources.options.every((o,i,a)=>!i || (a[i-1].costs.elementalEmber||0)<=(o.costs.elementalEmber||0)));
for (const [resourceFilter, allowed] of Object.entries({wood:['piercing'],bars:['piercing','electrumBar'],embers:['piercing','elementalEmber'],barsEmbers:['piercing','electrumBar','elementalEmber']})) {
 const r=api.planTargetMerge({...input,resourceFilter,sortBy:'xpDebt'});
 assert.equal(r.ok,true,r.message); assert.ok(r.options.length>0,resourceFilter);
 assert.ok(r.options.every(o=>Object.entries(o.costs).every(([k,v])=>!v || allowed.includes(k))),resourceFilter+' excludes other currencies');
 assert.ok(r.options.every((o,i,a)=>!i || a[i-1].xpDebt<=o.xpDebt),'XP debt ordering');
 console.log(resourceFilter+':',r.checked,'permitted batches');
}
assert.equal(api.planTargetMerge({...input,resourceFilter:'invalid'}).ok,false);
const forbidden=api.planTargetMerge({...input,resourceFilter:'wood',sourceType:'Ice Flak Tower'});
assert.equal(forbidden.ok,true); assert.equal(forbidden.options.length,0,'Ember construction must not pass wood-only filter');
// Independent small catalogue: time-only rubble, exact boundary and donor limit.
const rows=[1,2,3,4].map(level=>({level,seconds:100,xp:10,cost:'piercing:5'}));
sandbox.NoirBaseCatalog={towerLevels:{Keep:rows,Donor:rows},towers:[]};
const tiny={destinationType:'Keep',destinationLevel:1,targetLevel:3,maximumTowerLevel:4,maxQuantity:2,sourceType:'Donor',includeMixed:false};
const result=api.planTargetMerge(tiny);
assert.equal(result.ok,true); assert.equal(result.options.length,2);
assert.equal(result.options[0].sourceLevel,3); assert.equal(result.options[0].quantity,2);
assert.equal(result.options[0].resultLevel,3); assert.equal(result.options[0].seconds,600);
assert.equal(result.options[0].costs.piercing,30); assert.equal(result.options[0].xpDebt,40);
assert.equal(api.planTargetMerge({...tiny,maxQuantity:1}).options.length,0);
sandbox.NoirBaseCatalog.towerLevels.Keep=[rows[0],rows[2]];
assert.equal(api.planTargetMerge(tiny).ok,false,'Missing level must not be counted as free');
console.log('Target merge checks passed');
