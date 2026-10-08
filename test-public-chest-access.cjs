'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert/strict'),{randomUUID}=require('crypto');
const source=fs.readFileSync('app.js','utf8');
const start=source.slice(source.indexOf('  async function startApplication() {'),source.indexOf('    /* =======================================================\n     VIEW NAVIGATION'));
async function boot(store=new Map(),offline=false){
 const classes=new Map();let shown=0;
 const element=id=>({classList:{add:x=>classes.set(id+':'+x,true),remove:x=>classes.set(id+':'+x,false)}});
 const c={console,crypto:{randomUUID},localStorage:{getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},document:{},CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}},applicationLifecycleGeneration:0,STORAGE_KEY_PREFIX:'test',currentUser:null,appState:{profile:{}},getElement:element,bindEvents(){},loadProfileIntoScreen(){},renderHomeScreen(){},updateCloudBadge(){},setText(){},withTimeout:p=>p,loadLocalState:()=>({profile:{}}),applyDefaultChestPreference(){},openApplicationShell(){shown++}};
 c.window=c;c.setTimeout=f=>{f();return 1};c.dispatchEvent=()=>{};c.ChestDatabase={initialisePlayer:async()=>{if(offline)throw Error('offline');return {user:null}}};c.NoirAccessControl={show(){throw Error('Unexpected login gate')},hide(){},isPasswordRecoveryActive:()=>false};c.LivePredictorEngine={setPlayerIdentity:id=>{c.engineIdentity=id},getActiveChest:()=> 'gold'};c.ChestPredictorCloud={load:async()=>({source:'cloud'})};
 vm.createContext(c);vm.runInContext(fs.readFileSync('player-device-profile.js','utf8'),c);vm.runInContext(start+'\nthis.boot=startApplication;',c);await c.boot();await Promise.resolve();assert.equal(shown,1);assert.equal(c.currentUser.isDevice,true);assert.equal(c.engineIdentity,c.currentUser.id);return c;
}
(async()=>{const store=new Map(),a=await boot(store),b=await boot(store),other=await boot();assert.equal(a.currentUser.id,b.currentUser.id);assert.notEqual(a.currentUser.id,other.currentUser.id);await boot(new Map(),true);
 const {sanitiseEvent}=await import('./supabase/functions/onyx-public-chests/sanitise.mjs');
 const event=sanitiseEvent({event:'Test',deckIndices:{root:999},observations:['private'],sourceFile:'private.har',decks:{root:[0]},drops:{root:[{id:'reward',mu:1,kind:'curr',token:'private'}]},chests:{gold:{key:'root',found:true,index:999}},doubleArmory:{ready:true,sides:{assault:{eventKey:'assault1',decks:{root:[0]},drops:{root:[]},deckIndices:{root:999},chests:{}}}}});
 assert(!JSON.stringify(event).includes('private'));assert(!JSON.stringify(event).includes('999'));assert.equal(event.drops.root[0].id,'reward');
 console.log('Login-free startup, offline startup, persistent independent device profiles and public-data allowlist passed.');
})().catch(e=>{console.error(e);process.exit(1)});
