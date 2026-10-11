import test from 'node:test';import assert from 'node:assert/strict';
import {configureStatusCatalog,statusLabel,statusDomain,statusTerminal,validateStatusCatalog} from '../web/status-model.mjs?v=20261011-legends-controls';
import {statusTone,statusRank} from '../web/reporting.mjs';
const definition=(domain,code,label,color,order,terminal=false)=>({domain,code,label_sk:label,description:'Synthetic test',color_key:color,sort_order:order,is_terminal:terminal,is_enabled:true,progress_pct:null});
const data=()=>({origin:'supabase',status_catalog:{colors:['neutral','warning','info','danger','success'].map(color_key=>({color_key})),domains:['work','campaign','lifecycle'].map(domain=>({domain})),definitions:[definition('work','IN_PROGRESS','Prebieha','info',30),definition('work','COMPLETED','Dokončené','success',50,true),definition('campaign','COMPLETED','Dokončené','success',40,true),definition('campaign','PUBLISHED','Publikované','info',30),definition('lifecycle','ACTIVE','Aktívne','info',40)],bindings:[{table_name:'management_tasks',column_name:'status',domain:'work'}],transitions:[]}});
test('DB labels, colors, order and terminal flags drive live status rendering',()=>{
 const d=data(),s=d.status_catalog.definitions[0];s.label_sk='Pracujeme';s.color_key='warning';s.sort_order=7;s.is_terminal=true;validateStatusCatalog(d);configureStatusCatalog(d);
 assert.equal(statusLabel('IN_PROGRESS','work'),'Pracujeme');assert.equal(statusTone('IN_PROGRESS','work'),'warning');assert.equal(statusRank('IN_PROGRESS','work'),7);assert.equal(statusTerminal('IN_PROGRESS','work'),true);assert.equal(statusDomain({kind:'task'},'task_status'),'work');
 assert.equal(statusTone('COMPLETED','work'),statusTone('COMPLETED','campaign'));assert.equal(statusTone('ACTIVE','lifecycle'),'info');assert.equal(statusTone('PUBLISHED','campaign'),'info');configureStatusCatalog(null);
});
test('live statuses do not fall back to hardcoded metadata',()=>{
 configureStatusCatalog(data());assert.equal(statusLabel('UNKNOWN','work'),'UNKNOWN');assert.equal(statusTone('UNKNOWN','work'),'neutral');assert.equal(statusRank('UNKNOWN','work'),999999);
 assert.throws(()=>validateStatusCatalog({origin:'supabase'}),/register/);const d=data();d.status_catalog.definitions[0].color_key='unsafe';assert.throws(()=>validateStatusCatalog(d),/definícia/);configureStatusCatalog(null);
});
import {legendGroups,LEGEND_DOMAINS} from '../web/status-model.mjs?v=20261011-legends-controls';
test('legends restrict domains to view content and use enabled canonical labels, colors and ordering',()=>{
 const data={origin:'supabase',status_catalog:{domains:[{domain:'work',label_sk:'DB work'},{domain:'campaign',label_sk:'DB campaign'}],colors:[{color_key:'info',label_sk:'DB blue',meaning:'DB meaning'}],definitions:[
 {domain:'work',code:'LATE',label_sk:'DB later',sort_order:20,color_key:'info',is_enabled:true},
 {domain:'work',code:'EARLY',label_sk:'DB first',sort_order:10,color_key:'info',is_enabled:true},
 {domain:'work',code:'DISABLED',sort_order:0,color_key:'info',is_enabled:false},
 {domain:'campaign',code:'PUBLISHED',sort_order:0,color_key:'info',is_enabled:true}]}};
 const before=structuredClone(data),groups=legendGroups(data,'tasks');assert.deepEqual(groups.map(g=>g.domain),['work']);assert.equal(groups[0].label,'DB work');assert.deepEqual(groups[0].definitions.map(d=>d.code),['EARLY','LATE']);assert.equal(groups[0].definitions[0].color.meaning,'DB meaning');assert.deepEqual(data,before);
 assert.deepEqual(legendGroups({...data,origin:'demo'},'tasks'),[]);
 assert.deepEqual(Object.keys(LEGEND_DOMAINS).sort(),['calendar','campaigns','map','offers','overview','products','sources','tasks']);
});
