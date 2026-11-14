import test from 'node:test';import assert from 'node:assert/strict';
import {filterClients,sortClients,statusKey,daysSince,unitsLeft} from '../web/crm-client-table.mjs';
const today='2026-11-10';
const row=(name,over={})=>({name,phone:'+421900000'+name.length,email:name.toLowerCase().replace(/\s/g,'')+'@x.test',membership:null,last_visit_on:null,owner_summary:{registered_on:'2026-01-01',total_spent_eur:'10.00'},...over});
const m=(over)=>({type:'VISIT_COUNT',activated_on:'2026-10-01',expires_on:'2027-03-01',included_units:'10',consumed:'3',...over});
const rows=[
 row('Anna Valid',{membership:m({}),last_visit_on:'2026-11-08',owner_summary:{registered_on:'2025-05-01',total_spent_eur:'250.50'}}),
 row('Berta Soon',{membership:m({expires_on:'2026-11-12'}),last_visit_on:'2026-10-01',owner_summary:{registered_on:'2026-03-01',total_spent_eur:'80.00'}}),
 row('Cecília Empty',{membership:m({consumed:'10'}),last_visit_on:'2026-08-01'}),
 row('Dana None',{membership:null,last_visit_on:null,owner_summary:{registered_on:'2026-11-01',total_spent_eur:'0.00'}}),
 row('Eva Unknown',{membership:undefined,last_visit_on:'2026-11-09'})
];
test('status key follows validity, exhaustion and absence',()=>{
 assert.deepEqual(rows.map(r=>statusKey(r.membership,today)),['active','soon','invalid','none','unknown']);
 assert.equal(unitsLeft(m({})),7);assert.equal(unitsLeft(m({type:'TIME_ACCESS'})),null);assert.equal(daysSince('2026-11-08',today),2);assert.equal(daysSince(null,today),null);
});
test('filters combine: text, status, last visit and minimum spent',()=>{
 const names=f=>filterClients(rows,{q:'',status:'',visit:'',minSpent:'',...f},today).map(r=>r.name);
 assert.equal(names({}).length,5);
 assert.deepEqual(names({q:'berta'}),['Berta Soon']);assert.deepEqual(names({q:'@x.test'}).length,5);
 assert.deepEqual(names({status:'invalid'}),['Cecília Empty']);assert.deepEqual(names({status:'none'}),['Dana None']);
 assert.deepEqual(names({visit:'7'}),['Anna Valid','Eva Unknown']);assert.deepEqual(names({visit:'over30'}),['Berta Soon','Cecília Empty']);assert.deepEqual(names({visit:'never'}),['Dana None']);
 assert.deepEqual(names({minSpent:'100'}),['Anna Valid']);assert.deepEqual(names({status:'active',visit:'7',minSpent:'100'}),['Anna Valid']);
 assert.deepEqual(names({minSpent:'abc'}).length,5);
});
test('sorting is stable, Slovak-aware and handles missing values',()=>{
 const by=(key,dir)=>sortClients(rows,key,dir,today).map(r=>r.name);
 assert.deepEqual(by('name',1),['Anna Valid','Berta Soon','Cecília Empty','Dana None','Eva Unknown']);assert.equal(by('name',-1)[0],'Eva Unknown');
 assert.equal(by('spent',-1)[0],'Anna Valid');assert.equal(by('last',-1)[0],'Eva Unknown');assert.deepEqual(by('status',1).slice(0,2),['Anna Valid','Berta Soon']);
});
