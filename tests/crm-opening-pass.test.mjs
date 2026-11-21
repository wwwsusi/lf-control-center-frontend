import test from 'node:test';
import assert from 'node:assert/strict';
import {validThrough,buildPayload,passRuleLabel,remainingLabel} from '../web/crm-opening-pass.mjs';
import {entitlementView} from '../web/crm-client-view.mjs';

test('valid-through follows the database rule (start + N months, clamped to month end)',()=>{
 assert.equal(validThrough('2026-10-20',3),'2027-01-20');
 assert.equal(validThrough('2026-01-31',1),'2026-02-28');
 assert.equal(validThrough('2028-01-31',1),'2028-02-29');
 assert.equal(validThrough('2026-10-05',6),'2027-04-05');
 assert.equal(validThrough('2026-11-18',12),'2027-11-18');
 assert.equal(validThrough('2026-13-01',3),null);
 assert.equal(validThrough('',3),null);
});

test('payloads match the backend contract; time passes never carry used units',()=>{
 const customer={id:'c1',revision:'4'},time={type:'TIME_ACCESS',months:3,included:null},visit={type:'VISIT_COUNT',months:6,included:10};
 assert.deepEqual(buildPayload({customer,rule:time,serviceId:'s1',start:'2026-10-20',used:7}),{customer_id:'c1',expected_revision:'4',service_id:'s1',start_date:'2026-10-20',used_units:'0'});
 assert.deepEqual(buildPayload({customer,rule:visit,serviceId:'s2',start:'2026-10-05',used:4}),{customer_id:'c1',expected_revision:'4',service_id:'s2',start_date:'2026-10-05',used_units:'4'});
 assert.deepEqual(buildPayload({customer,rule:visit,serviceId:'s2',start:'',used:0}),{customer_id:'c1',expected_revision:'4',service_id:'s2',start_date:null,used_units:'0'});
 const entitlement={id:'e1',revision:'2'};
 assert.deepEqual(buildPayload({entitlement,rule:visit,start:'2026-10-01',used:6}),{entitlement_id:'e1',expected_revision:'2',action:'UPDATE',start_date:'2026-10-01',used_units:'6'});
 assert.deepEqual(buildPayload({entitlement,cancel:true}),{entitlement_id:'e1',expected_revision:'2',action:'CANCEL'});
});

test('rule labels are plain Slovak',()=>{
 assert.match(passRuleLabel({type:'TIME_ACCESS',months:1}),/1 mesiac$/);
 assert.match(passRuleLabel({type:'TIME_ACCESS',months:3}),/3 mesiace$/);
 assert.match(passRuleLabel({type:'TIME_ACCESS',months:12}),/12 mesiacov$/);
 assert.match(passRuleLabel({type:'VISIT_COUNT',included:10}),/10 vstupov/);
});

test('entitlement view counts opening used entries with CRM visits and marks taken-over passes',()=>{
 const e={type_at_purchase:'VISIT_COUNT',activated_on:'2026-10-05',expires_on:'2027-04-06',included_units_at_purchase:'10',consumed:'1',opening_used_units:'4',origin:'OPENING_BALANCE',service_name:'10-vstupová permanentka',status:'ENABLED'};
 const v=entitlementView(e,'2026-11-18');
 assert.equal(v.rows[0][0],'10-vstupová permanentka · prevzatá');
 const left=v.rows.find(r=>/Zostáva|Zostatok/i.test(r[0]));
 assert.ok(left,'remaining row present');assert.match(String(left[1]),/5/);
 assert.equal(entitlementView({...e,status:'CANCELLED'},'2026-11-18').chip,'Zrušená');
});

test('profile shows the last valid day, not the exclusive database end',async()=>{
 const {lastValidDay,membershipView}=await import('../web/crm-client-view.mjs');
 assert.equal(lastValidDay('2027-01-21'),'2027-01-20');
 assert.equal(lastValidDay('2026-03-01'),'2026-02-28');
 const v=membershipView({type:'TIME_ACCESS',activated_on:'2026-10-20',expires_on:'2027-01-21',included_units:null,consumed:'0'},'2026-11-18');
 assert.equal(v.rows.find(r=>r[0]==='Do')[1],'20. 1. 2027');
 // expires_on is the first invalid day: on that day the pass is already expired
 assert.match(membershipView({type:'TIME_ACCESS',activated_on:'2026-10-20',expires_on:'2026-11-18',included_units:null,consumed:'0'},'2026-11-18').chip,/vypršala/);
});

test('remaining entries use correct Slovak inflection',()=>{
 assert.equal(remainingLabel(0),'Zostáva 0 vstupov');
 assert.equal(remainingLabel(1),'Zostáva 1 vstup');
 for(const n of [2,3,4])assert.equal(remainingLabel(n),'Zostávajú '+n+' vstupy');
 for(const n of [5,6,10,30])assert.equal(remainingLabel(n),'Zostáva '+n+' vstupov');
});
