const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm');
const s = {document:{readyState:'loading',addEventListener(){}},addEventListener(){}};s.window=s;vm.createContext(s);
for (const file of ['base-adviser-catalog-towers.js','onyx-base-command.js']) vm.runInContext(fs.readFileSync(file,'utf8'),s);
const weights={time:.002268982,piercing:0,food:0,elementalEmber:3.3898,iceShard:1.6949,fireShard:1.6949,electrumBar:5.0847,cosmicCharge:3660,bloodstone:11.17};
function totals(type,level) {let value=0,xp=0,seconds=0,costs={};for(const r of s.NoirBaseCatalog.towerLevels[type].filter(r=>r.level<=level)){value+=r.seconds*weights.time;xp+=r.xp;seconds+=r.seconds;for(const p of r.cost.split(/[|;]/).filter(Boolean)){let [k,n]=p.split(':');n=Number(n);value+=weights[k]*n;costs[k]=(costs[k]||0)+n;}}return {value,xp,seconds,costs};}
for(const filter of ['any','wood','bars','embers','barsEmbers']) {
 const input={destinationType:'Ice Flak Tower',destinationLevel:142,targetLevel:185,maximumTowerLevel:185,maxQuantity:20,resourceFilter:filter,sortBy:'xpDebt'};
 const started=Date.now(),r=s.OnyxBaseCommand.planTargetMerge(input);
 assert.equal(r.ok,true,r.message);assert.ok(r.mixedChecked>0);assert.ok(r.options.length);
 for(const o of r.options){let start=totals(input.destinationType,142),xp=start.xp,value=start.value,seconds=0,costs={},quantity=0;for(const d of o.donors){const t=totals(d.sourceType,d.sourceLevel);value+=.45*t.value*d.quantity;xp+=t.xp*d.quantity;seconds+=t.seconds*d.quantity;quantity+=d.quantity;for(const [k,v]of Object.entries(t.costs))costs[k]=(costs[k]||0)+v*d.quantity;}
 let level=142;for(let l=143;l<=185;l++)if(totals(input.destinationType,l).value<=value)level=l;
 assert.equal(o.resultLevel,level);assert.ok(level>=185);assert.equal(o.xpDebt,Math.max(0,xp-totals(input.destinationType,level).xp));assert.equal(o.seconds,seconds);assert.equal(o.quantity,quantity);assert.ok(quantity<=20);assert.deepEqual(JSON.parse(JSON.stringify(o.costs)),costs);
 const allowed={wood:['piercing'],bars:['piercing','electrumBar'],embers:['piercing','elementalEmber'],barsEmbers:['piercing','electrumBar','elementalEmber']}[filter];if(allowed)assert.ok(Object.entries(costs).every(([k,v])=>!v||allowed.includes(k)));
 }
 assert.ok(r.options.every((o,i,a)=>!i||a[i-1].xpDebt<=o.xpDebt));console.log(filter,r.mixedChecked,'mixed candidates',Date.now()-started,'ms');
}
// Independent small case: two different donors beat either matching batch.
s.NoirBaseCatalog={towers:[],towerLevels:{Keep:[{level:1,seconds:1,xp:1,cost:''},{level:2,seconds:4.5,xp:1,cost:''}],A:[{level:1,seconds:6,xp:6,cost:'piercing:1'}],B:[{level:1,seconds:4,xp:4,cost:'piercing:1'}]}};
let r=s.OnyxBaseCommand.planTargetMerge({destinationType:'Keep',destinationLevel:1,targetLevel:2,maximumTowerLevel:2,maxQuantity:2,sourceType:'',sortBy:'time'});
assert.equal(r.ok,true);assert.equal(r.options[0].seconds,10);assert.equal(r.options[0].donors.length,2);assert.equal(r.options[0].xpDebt,9);
console.log('PASS: mixed batch results independently recalculated; bounds and filters respected; synthetic mixed optimum found.');
