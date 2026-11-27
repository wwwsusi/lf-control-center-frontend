import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {todaySummaryModel} from '../web/crm-report-view.mjs';

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
