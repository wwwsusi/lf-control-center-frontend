import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import test from 'node:test';
import {byId,calc,pctFromPrice,priceEndingInNine,perWeek,defaultDraft,exportDraft,importDraft,summaryText} from '../web/crm-packages-model.mjs';
const service=(n,name,price)=>({business_id:'LF-SVC-'+String(n).padStart(3,'0'),name,unit:'x',price_eur:String(price),lifecycle:'ACTIVE'});
const live=[service(2,'Mesačná',47),service(3,'2-mesačná',90),service(4,'3-mesačná',130),service(15,'Osobný tréning',18),service(30,'Plán',150)];
test('starting proposal uses only live services and database prices',()=>{
 const d=defaultDraft(live),map=byId(live),r=d.packages.map(p=>calc(p,map,d.minutes));
 assert.deepEqual(r.map(x=>x.sum),[83,144,334]);assert.equal(Math.round(r[0].price),79);assert.equal(d.packages[1].pct.toFixed(1),'10.2');
 assert.deepEqual(r.map(x=>x.owner),[120,180,240]);assert.equal(perWeek(5,120),2);assert.equal(perWeek(5,0),null);
 const without=defaultDraft(live.filter(s=>s.business_id!=='LF-SVC-030'));assert.equal(without.packages[2].items.some(i=>i.id==='LF-SVC-030'),false);
});
test('discount and price ending in nine',()=>{
 assert.equal(pctFromPrice(100,79).toFixed(1),'21.0');assert.equal(pctFromPrice(100,150),0);assert.equal(pctFromPrice(0,10),0);
 assert.equal(priceEndingInNine(144,129.3),129);assert.equal(priceEndingInNine(83,83),79);assert.equal(priceEndingInNine(5,5),null);assert.equal(priceEndingInNine(0,0),null);
});
test('saved file round trip keeps the model',()=>{
 const d=defaultDraft(live);d.packages[0].name='Test';d.capHours=7;
 const {draft,dropped}=importDraft(exportDraft(d),live);assert.deepEqual(draft,d);assert.deepEqual(dropped,[]);
});
test('a file of the stand-alone calculator loads; items that are not live are listed and left out',()=>{
 const old={capHours:4,catalog:[{id:'pt',name:'PT',owner:45},{id:'sem',name:'Seminár',owner:0}],packages:[{name:'A',pct:10,items:[{id:'perm1',qty:1},{id:'pt',qty:2},{id:'sem',qty:1}]}]};
 const {draft,dropped}=importDraft(JSON.stringify(old),live);
 assert.deepEqual(draft.packages[0].items,[{id:'LF-SVC-002',qty:1},{id:'LF-SVC-015',qty:2}]);assert.deepEqual(dropped,['Seminár']);assert.equal(draft.minutes['LF-SVC-015'],45);assert.equal(draft.capHours,4);
});
test('foreign or hostile files are refused and values are bounded',()=>{
 for(const bad of ['x','{}','{"packages":[]}','{"packages":[{"name":1,"items":[]}]}','{"packages":[{"name":"a","items":[{}]}]}',JSON.stringify({packages:Array(7).fill({name:'a',items:[]})})])assert.throws(()=>importDraft(bad,live));
 const {draft}=importDraft(JSON.stringify({capHours:1e9,minutes:{__proto__x:1,'LF-SVC-015':-5},packages:[{name:'a'.repeat(200),pct:900,items:[{id:'LF-SVC-015',qty:1e9},{id:'LF-SVC-002',qty:-1}]}]}),live);
 assert.equal(draft.capHours,168);assert.equal(draft.packages[0].pct,100);assert.equal(draft.packages[0].name.length,60);assert.deepEqual(draft.packages[0].items,[{id:'LF-SVC-015',qty:999}]);assert.equal(draft.minutes['LF-SVC-015'],0);
});
test('summary text and no browser storage or markup parsing',()=>{
 assert.match(summaryText(defaultDraft(live),live),/IMPULZ: 79 € \(súčet 83 €/);
 const src=['crm-packages.mjs','crm-packages-model.mjs'].map(f=>readFileSync(new URL('../web/'+f,import.meta.url),'utf8')).join('\n');
 assert(!/innerHTML|insertAdjacentHTML|localStorage|sessionStorage|indexedDB/.test(src));assert(src.includes("view:'PACKAGE_SERVICES'"));
 assert(readFileSync(new URL('../web/crm.html',import.meta.url),'utf8').includes('data-view="calculator" hidden'));
});
test('the tab is named Kalkulačky and opens a menu with the package calculator',async()=>{
 const html=readFileSync(new URL('../web/crm.html',import.meta.url),'utf8');
 assert(html.includes('<button data-view="calculator" hidden>Kalkulačky</button>'));
 const {CALCULATORS}=await import('../web/crm-packages.mjs');
 assert.deepEqual(CALCULATORS.map(c=>c.title),['Tvorba balíčkov']);
});
