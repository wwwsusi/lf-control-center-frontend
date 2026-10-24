import test from 'node:test';import assert from 'node:assert/strict';
import {visitPayload,createVisitWriter} from '../web/crm-checkin.mjs';
const id=n=>'80000000-0000-4000-8000-'+String(n).padStart(12,'0');
const admission={id:id(1),revision:'2',code:'MULTISPORT'};
const customer={id:id(2),revision:'3',status:'ACTIVE'};
const entitlement={id:id(3),revision:'4',status:'ENABLED',type_at_purchase:'VISIT_COUNT'};
const result={operation:{state:'COMPLETED',target_type:'visit'},projection:{id:id(4),status:'POSTED'}};
test('visit keeps canonical IDs and never substitutes anonymous identity for invalid customer',()=>{
 assert.equal(visitPayload(admission,customer).customer_id,customer.id);
 assert.equal(visitPayload({...admission,code:'ENTITLEMENT'},customer,entitlement).entitlement_id,entitlement.id);
 assert.equal(visitPayload(admission).customer_id,null);
 assert.throws(()=>visitPayload(admission,{...customer,id:'bad'}));
 assert.throws(()=>visitPayload({...admission,code:'ENTITLEMENT'},null,entitlement));
 assert.throws(()=>visitPayload({...admission,code:'SINGLE_ENTRY'}));
});
test('double click produces one operation; uncertain result can only replay the same request',async()=>{
 const calls=[];let reject;const writer=createVisitWriter(async(path,options)=>{calls.push({path,options});if(calls.length===1)return new Promise((_,r)=>reject=r);return result;},{newId:()=>id(5)});
 const first=writer.submit(visitPayload(admission));await writer.submit(visitPayload(admission));assert.equal(calls.length,1);
 reject(Error('synthetic network failure'));await first;
 await writer.submit(visitPayload(admission));assert.equal(calls.length,1);
 await writer.retry();assert.equal(calls.length,2);assert.deepEqual(calls[0].options.body,calls[1].options.body);
 await writer.submit(visitPayload(admission));assert.equal(calls.length,2);
});
test('lost response is reconciled using original request ID without another mutation',async()=>{
 const paths=[];let successes=0;const writer=createVisitWriter(async(path)=>{paths.push(path);if(paths.length===1)throw Error('lost response');return result;},{newId:()=>id(6),onSuccess:()=>successes++});
 await writer.submit(visitPayload(admission));await writer.verify();
 assert.equal(paths[1],'/api/crm/readback?request_id='+id(6));assert.equal(successes,1);
});
test('disposing in-flight visit ignores its response and prevents more requests',async()=>{
 let resolve,successes=0,calls=0;const writer=createVisitWriter(()=>{calls++;return new Promise(r=>resolve=r);},{newId:()=>id(7),onSuccess:()=>successes++});
 const pending=writer.submit(visitPayload(admission));writer.dispose();resolve(result);await pending;await writer.retry();assert.equal(calls,1);assert.equal(successes,0);
});
test('single entry retains exact purchased line and sale revision and rejects another client purchase',()=>{
 const a={...admission,code:'SINGLE_ENTRY'},p={id:id(8),sale_id:id(9),sale_revision:'12',customer_id:customer.id};
 const payload=visitPayload(a,customer,null,p);assert.equal(payload.sale_item_id,p.id);assert.equal(payload.sale_revision,'12');assert.equal(payload.entitlement_id,null);
 assert.throws(()=>visitPayload(a,null,null,p));assert.throws(()=>visitPayload(a,customer,null,{...p,sale_revision:'bad'}));
 assert.equal(visitPayload(a,null,null,{...p,customer_id:null}).customer_id,null);
});
