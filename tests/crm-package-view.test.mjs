import test from 'node:test';
import assert from 'node:assert/strict';
import {purchaseLine,packageSummary} from '../web/crm-purchase.mjs';
import {packageBlock} from '../web/crm-checkin.mjs';
import {entitlementView} from '../web/crm-client-view.mjs';
const offer={usable_from:'2027-01-01',start_months:3,contents:[{name:'Osobný tréning',units:2,months:null},{name:'2-mesačná permanentka',units:null,months:2}]};
const item={id:'a0000000-0000-4000-8000-000000000001',catalogue_fingerprint:'a'.repeat(64),requires_customer:true,package:offer};
const buyer={customer_id:'80000000-0000-4000-8000-000000000001'};
test('a package line needs a client and is sold one at a time',()=>{
 assert.equal(purchaseLine(item,'services',1,buyer).quantity,'1');
 assert.throws(()=>purchaseLine(item,'services',2,buyer));
 assert.throws(()=>purchaseLine(item,'services',1,{customer_id:null}));
});
test('the sale card names the content and the first day of use',()=>{
 assert.deepEqual(packageSummary(offer),['Obsahuje: Osobný tréning × 2, 2-mesačná permanentka','Využívanie od 1. 1. 2027, prvý vstup najneskôr do 3 mesiacov od nákupu.']);
});
const terms={name:'MOTIVÁCIA',usable_from:'2027-01-01',not_yet_usable:false,start_by:'2027-02-28',start_expired:false};
test('package entitlements are blocked before the first day and after a missed start',()=>{
 assert.equal(packageBlock({}),null);
 assert.equal(packageBlock({package:terms}),null);
 assert.equal(packageBlock({package:{...terms,not_yet_usable:true}}),'Využitie od 1. 1. 2027');
 assert.equal(packageBlock({package:{...terms,start_expired:true}}),'Nezačaté do 28. 2. 2027');
});
test('the client profile shows which package an entitlement came from',()=>{
 const e={status:'ENABLED',type_at_purchase:'VISIT_COUNT',included_units_at_purchase:'2',consumed:'0',service_name:'Osobný tréning',package:{...terms,not_yet_usable:true}};
 const view=entitlementView(e,'2026-11-28');
 assert.equal(view.tone,'neutral');
 assert.match(view.chip,/^Využitie od /);
 assert.deepEqual(view.rows.at(-1),['Z balíčka','MOTIVÁCIA']);
});
