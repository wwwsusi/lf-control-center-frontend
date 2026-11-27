import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {todaySummaryModel,todayRows,TODAY_COLUMNS} from '../web/crm-report-view.mjs';

const summary={people:9,visits:10,single_entry:3,multisport:2,entitlement:5,passes:[{name:'Mesačná permanentka',count:3},{name:'10-vstupová permanentka',count:2}],services:[{name:'Mesačná permanentka',count:2}],services_total:2,products:[{name:'PRO8',count:2},{name:'Uterák',count:1}],products_total:3};

test('day summary boxes: three numbers, entry types, passes, products and services',()=>{
 const m=todaySummaryModel(summary);
 assert.deepEqual(m.tiles,[['Ľudia dnes vo fitku',9],['Predané služby',2],['Predané produkty',3]]);
 assert.match(m.note,/Vstupov spolu: 10/);
 assert.deepEqual(m.sections.map(s=>s.title),['Jednorazové vstupy','Cvičili na permanentku','Predané produkty','Predané služby']);
 assert.deepEqual(m.sections[0].rows,[['Jednorazové vstupy',3],['MultiSport vstupy',2]]);
 assert.deepEqual(m.sections[1].rows,[['Mesačná permanentka',3],['10-vstupová permanentka',2]]);
 assert.deepEqual(m.sections[2].rows,[['PRO8',2],['Uterák',1]]);
});

test('empty day shows zeros and friendly texts; an older server without a summary shows nothing',()=>{
 const m=todaySummaryModel({people:0,visits:0,single_entry:0,multisport:0,entitlement:0,passes:[],services:[],services_total:0,products:[],products_total:0});
 assert.deepEqual(m.sections[0].rows,[['Jednorazové vstupy',0],['MultiSport vstupy',0]]);
 assert.equal(m.note,'');assert.equal(m.sections[1].rows.length,0);assert.ok(m.sections[1].empty);
 assert.equal(todaySummaryModel(undefined),null);assert.equal(todaySummaryModel({}),null);
});

test('the today screen renders the summary above the day controls',async()=>{
 const js=await fs.readFile(new URL('../web/crm.mjs',import.meta.url),'utf8');
 assert.match(js,/function showTodaySummary\(summary\)/);
 assert.ok(js.indexOf('showTodaySummary(data.summary)')<js.indexOf("mode:'day',day,date:data.date"),'summary comes before the day controls');
});

test('records table: one row per record with Prague time, client, amount, payment and state',()=>{
 assert.equal(TODAY_COLUMNS.length,7);
 const rows=todayRows([
  {type:'VISIT',time:'2026-11-27T07:05:00Z',status:'POSTED',client:'Anna Nováková',known:true,detail:'10-vstupová permanentka',total:null,paid:null,methods:[]},
  {type:'VISIT',time:'2026-11-27T07:10:00Z',status:'POSTED',client:null,known:false,detail:'MultiSport',total:null,paid:null,methods:[]},
  {type:'SALE',time:'2026-11-27T08:00:00Z',status:'CONFIRMED',client:null,known:true,detail:'Uterák',total:'3.50',paid:'3.50',methods:['CASH']},
  {type:'SALE',time:'2026-11-27T08:30:00Z',status:'CONFIRMED',client:null,known:false,detail:'PRO8',total:'57.00',paid:null,methods:[]},
  {type:'SALE',time:'2026-11-27T09:00:00Z',status:'CANCELLED',client:null,known:false,detail:'Tyčinky',total:'1.00',paid:null,methods:[]}]);
 assert.deepEqual(rows[0].cells.slice(0,4),['08:05','Vstup','Anna Nováková','10-vstupová permanentka']);
 assert.equal(rows[1].cells[2],'Bez mena');
 assert.equal(rows[2].cells[2],'Klientka');
 assert.match(rows[2].cells[4],/3,50/);assert.equal(rows[2].cells[5],'Hotovosť');
 assert.equal(rows[3].cells[5],'Nezaplatené');
 assert.equal(rows[4].cells[6],'Zrušený');assert.equal(rows[4].cancelled,true);assert.equal(rows[4].cells[5],'—');
 assert.equal(todayRows(undefined),null);
});
