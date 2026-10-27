import test from 'node:test';
import assert from 'node:assert/strict';
import {purchaseCustomerReference} from '../web/crm-purchase.mjs';
const customer={id:'80000000-0000-4000-8000-000000000001',revision:'7'};
test('selected customer identity is preserved without new catalogue or client IDs',()=>{
 assert.deepEqual(purchaseCustomerReference(customer),{customer_id:customer.id,customer_revision:'7'});
});
test('anonymous purchase is explicit and invalid selected customer never falls back to null',()=>{
 assert.deepEqual(purchaseCustomerReference(null,true),{customer_id:null,customer_revision:null});
 for(const value of [null,{},undefined,{...customer,id:'bad'},{...customer,revision:null}])assert.throws(()=>purchaseCustomerReference(value));
 assert.throws(()=>purchaseCustomerReference(customer,true));
});

import {purchaseLine} from '../web/crm-purchase.mjs';
const item={id:'a0000000-0000-4000-8000-000000000001',catalogue_fingerprint:'a'.repeat(64),requires_customer:false};
test('checkout lines preserve catalogue kind and UUID without creating another identifier',()=>{
 for(const kind of ['services','products'])assert.deepEqual(purchaseLine(item,kind,2,null),{[kind==='services'?'service_id':'product_id']:item.id,quantity:'2',catalogue_fingerprint:item.catalogue_fingerprint});
});
test('membership service requires identified customer, ordinary service permits explicit anonymous checkout',()=>{
 assert.throws(()=>purchaseLine({...item,requires_customer:true},'services',1,{customer_id:null}));
 assert.equal(purchaseLine({...item,requires_customer:true},'services',1,{customer_id:'selected-client'}).service_id,item.id);
 assert.equal(purchaseLine(item,'services',1,{customer_id:null}).service_id,item.id);
 assert.throws(()=>purchaseLine({...item,requires_customer:undefined},'services',1,null));
});
test('checkout rejects invented catalogue identifiers, fingerprints and invalid quantities',()=>{
 for(const value of [0,-1,1.5,1000000000,'1'])assert.throws(()=>purchaseLine(item,'services',value,null));
 assert.throws(()=>purchaseLine({...item,id:'LF-SVC-002'},'services',1,null));
 assert.throws(()=>purchaseLine({...item,catalogue_fingerprint:'stale'},'products',1,null));
 assert.throws(()=>purchaseLine(item,'other',1,null));
});

test('monthly line requires explicit activation and serializes the chosen option only',()=>{
 const monthly={...item,requires_customer:true,activation_choices:['PURCHASE_DATE','FIRST_USE']},identity={customer_id:'selected-client'};
 for(const choice of monthly.activation_choices)assert.equal(purchaseLine(monthly,'services',1,identity,choice).activation_mode,choice);
 for(const choice of [undefined,'','FIXED_DATE','2026-10-25'])assert.throws(()=>purchaseLine(monthly,'services',1,identity,choice));
 assert.throws(()=>purchaseLine(monthly,'services',1,null,'FIRST_USE'));
 assert.throws(()=>purchaseLine(item,'services',1,identity,'FIRST_USE'));
 assert.throws(()=>purchaseLine(item,'products',1,identity,'FIRST_USE'));
});

import {membershipValidityLabel} from '../web/crm-checkin.mjs';
test('monthly UI shows inclusive last day and no invented expiry for unactivated membership',()=>{
 assert.match(membershipValidityLabel({activated_on:null,expires_on:null}),/prvým vstupom/);
 assert.match(membershipValidityLabel({activated_on:'2027-01-31',expires_on:'2027-03-01'}),/28\.\s*2\.\s*2027 vrátane/);
 assert.match(membershipValidityLabel({activated_on:'2028-01-31',expires_on:'2028-03-01'}),/29\.\s*2\.\s*2028 vrátane/);
 assert.match(membershipValidityLabel({activated_on:'2027-01-31',expires_on:'invalid'}),/kontrolu/);
});
