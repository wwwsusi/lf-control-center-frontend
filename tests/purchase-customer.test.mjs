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
