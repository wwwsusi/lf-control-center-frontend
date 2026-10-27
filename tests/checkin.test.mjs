import test from 'node:test';import assert from 'node:assert/strict';
import {visitPayload,createVisitWriter,entryMembershipLabel} from '../web/crm-checkin.mjs';
const id=n=>'80000000-0000-4000-8000-'+String(n).padStart(12,'0');
const admission={id:id(1),revision:'2',code:'MULTISPORT'};
const customer={id:id(2),revision:'3',status:'ACTIVE'};
const entitlement={id:id(3),revision:'4',status:'ENABLED',type_at_purchase:'VISIT_COUNT'};
const result={operation:{state:'COMPLETED',target_type:'visit'},projection:{id:id(4),status:'POSTED'}};
test('entry pass displays purchased validity without inventing an activation or changing stored expiry',()=>{
 const pass={consumed:'1',included_units_at_purchase:'10',validity_value_at_purchase:6,validity_unit_at_purchase:'MONTH',activated_on:null,expires_on:null};
 assert.match(entryMembershipLabel(pass),/Platnosť 6 mesiacov od prvého vstupu/);
 const active={...pass,activated_on:'2026-08-31',expires_on:'2027-03-01'},before=structuredClone(active);
 assert.match(entryMembershipLabel(active),/čerpané 1 \/ 10/);assert.match(entryMembershipLabel(active),/Platí do 28\. 2\. 2027 vrátane/);assert.deepEqual(active,before);
 assert.doesNotMatch(entryMembershipLabel({consumed:'0',included_units_at_purchase:'10'}),/Platí do|6 mesiacov/);
 assert.match(entryMembershipLabel({...active,expires_on:'2027-02-30'}),/vyžaduje kontrolu/);
});
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
test('uncertain or wrong-kind readback never reports a saved visit or permits another mutation',async()=>{
 for(const response of [
  {operation:{state:'PROCESSING'}},
  {operation:{state:'COMPLETED',target_type:'sale'},projection:{id:id(4),status:'POSTED'}},
  {operation:{state:'COMPLETED',target_type:'visit'},projection:{id:id(4),status:'CANCELLED'}},
  {operation:{state:'COMPLETED',target_type:'visit'},projection:{id:'invalid',status:'POSTED'}}
 ]){
  const calls=[];let successes=0,latest;
  const writer=createVisitWriter(async(path,options)=>{calls.push({path,options});return calls.length<3?response:result;},{newId:()=>id(10),onSuccess:()=>successes++,onChange:s=>latest=s});
  await writer.submit(visitPayload(admission,customer));
  await writer.submit(visitPayload(admission));
  assert.equal(calls.length,1);assert.equal(successes,0);assert.equal(latest.pending,true);
  await writer.verify();assert.equal(successes,0);assert.equal(latest.pending,true);
  await writer.verify();assert.equal(successes,1);assert.equal(latest.done,true);
  assert.ok(calls.slice(1).every(c=>c.path==='/api/crm/readback?request_id='+id(10)&&!c.options.body));
  await writer.submit(visitPayload(admission));assert.equal(calls.length,3);
 }
});
test('confirmed business rejection releases pending intent without claiming a saved visit',async()=>{
 let calls=0,successes=0,latest,error,sequence=10;
 const bodies=[];const writer=createVisitWriter(async(path,options)=>{bodies.push(options.body);return ++calls===1?{operation:{state:'REJECTED',result_code:'ENTITLEMENT_EXHAUSTED'}}:result;},{newId:()=>id(++sequence),onSuccess:()=>successes++,onError:e=>error=e,onChange:s=>latest=s});
 await writer.submit(visitPayload(admission,customer));
 assert.equal(error.code,'ENTITLEMENT_EXHAUSTED');assert.equal(error.rejected,true);assert.equal(latest.pending,false);assert.equal(latest.done,false);assert.equal(successes,0);
 await writer.verify();assert.equal(calls,1);
 await writer.submit(visitPayload(admission));assert.equal(successes,1);assert.notEqual(bodies[0].request_id,bodies[1].request_id);
 assert.equal(bodies[0].payload.customer_id,customer.id);assert.equal(bodies[1].payload.customer_id,null);
});
