// Explicit public contract: event definitions only, never captured player state.
const pick=(x,keys)=>Object.fromEntries(keys.filter(k=>x?.[k]!==undefined&&['string','number','boolean'].includes(typeof x[k])).map(k=>[k,x[k]]));
const numbers=x=>Object.fromEntries(Object.entries(x||{}).filter(([,v])=>typeof v==='number'&&Number.isFinite(v)));
const decks=x=>Object.fromEntries(Object.entries(x||{}).filter(([,v])=>Array.isArray(v)&&v.every(Number.isInteger)).map(([k,v])=>[k,[...v]]));
const drops=x=>Object.fromEntries(Object.entries(x||{}).filter(([,v])=>Array.isArray(v)).map(([k,v])=>[k,v.map(d=>pick(d,['id','kind','mu','sdev','drop_type','weight','name','amount','rarity']))]));
const strings=x=>Array.isArray(x)?x.filter(v=>typeof v==='string'):[];
function spin(x){return {...pick(x,['title','desc','description','name','position','id','credit_spin_currency']),costOptions:numbers(x?.costOptions),drops:{default:numbers(x?.drops?.default)},bulk:Array.isArray(x?.bulk)?x.bulk.map(b=>({m:b.m,dropIDs:numbers(b.dropIDs)})):[]};}
function chests(x){return Object.fromEntries(Object.entries(x||{}).map(([k,c])=>[k,{
 ...pick(c,['type','label','key','mainKey','bonusKey','found','ready','available','deckLength','bonusEvery','singleRubyCost','tenPackRubyCost','spinTypeId','bonusDescription','hasRewardPools','availableRewardPoolCount']),
 ...(Array.isArray(c.deck)?{deck:c.deck.filter(Number.isInteger)}:{}),
 ...(c.bonusVerification?.verified===true?{bonusVerification:{verified:true,poolKey:String(c.bonusVerification.poolKey||'')}}:{}),
 ...(c.regularSpinType?{regularSpinType:spin(c.regularSpinType)}:{}),...(c.bonusSpinType?{bonusSpinType:spin(c.bonusSpinType)}:{})
} ]));}
export function sanitiseEvent(e){
 const out={...pick(e,['schema','event','eventName','importedAt','publishedAt','ready','readyChestCount','availabilityKnown','availableChestCount','validFrom','validUntil']),availableChestTypes:strings(e?.availableChestTypes),decks:decks(e?.decks),drops:drops(e?.drops),chests:chests(e?.chests),spinTypes:(e?.spinTypes||[]).map(spin)};
 if(e?.doubleArmory)out.doubleArmory={...pick(e.doubleArmory,['detected','ready','eventName','validFrom','validUntil']),availableChestTypes:strings(e.doubleArmory.availableChestTypes),sides:Object.fromEntries(['assault','breeding'].filter(k=>e.doubleArmory.sides?.[k]).map(k=>{const s=e.doubleArmory.sides[k];return[k,{...pick(s,['type','label','eventKey','ready']),decks:decks(s.decks),drops:drops(s.drops),chests:chests(s.chests)}];}))};
 return out;
}
export function sanitiseRecords(rows){return rows.filter(r=>r.active===true&&r.predictor_data?.schema==='noir-live-event-v1').map(r=>({chest_type:r.chest_type,version:r.version,uploaded_at:r.uploaded_at,predictor_data:{schema:'noir-live-event-v1',chestType:r.chest_type,eventData:sanitiseEvent(r.predictor_data.eventData)}}));}
