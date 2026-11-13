import test from 'node:test';import assert from 'node:assert/strict';
import {visitLabel,purchaseLabel,entitlementView,skDate,membershipView} from '../web/crm-client-view.mjs';
test('visit and purchase labels read like the counter speaks',()=>{
 assert.equal(visitLabel({admission_code:'ENTITLEMENT'}),'Permanentka');assert.equal(visitLabel({admission_code:'SINGLE_ENTRY'}),'Jednorazový vstup');assert.equal(visitLabel({admission_code:'MULTISPORT'}),'MultiSport');assert.equal(visitLabel({admission_code:'X'}),'Návšteva');
 assert.equal(purchaseLabel({lines:[{name:'PRO8 500 g',quantity:'2.000'},{name:'Shaker 600 ml',quantity:'1'}]}),'PRO8 500 g × 2, Shaker 600 ml');assert.equal(purchaseLabel({lines:[]}),'Nákup');
});
test('entitlement view marks valid, soon, exhausted, expired and cancelled rights',()=>{
 const e=(over)=>({type_at_purchase:'VISIT_COUNT',status:'ENABLED',included_units_at_purchase:'10',consumed:'3',activated_on:'2026-10-01',expires_on:'2027-04-01',...over});
 const today='2026-11-10';
 assert.equal(entitlementView(e({}),today).tone,'success');
 assert.equal(entitlementView(e({consumed:'9'}),today).tone,'warning');
 assert.equal(entitlementView(e({consumed:'10'}),today).tone,'danger');
 assert.equal(entitlementView(e({expires_on:'2026-11-01'}),today).tone,'danger');
 assert.equal(entitlementView(e({expires_on:'2026-11-12'}),today).tone,'warning');
 assert.equal(entitlementView(e({status:'CANCELLED'}),today).chip,'Zrušená');
 assert.equal(entitlementView(e({type_at_purchase:'TIME_ACCESS',included_units_at_purchase:null}),today).rows.at(-1)[1],'Bez limitu vstupov');
 assert.equal(skDate('not a date'),'—');assert.equal(membershipView(undefined).rows.length,0);
});
