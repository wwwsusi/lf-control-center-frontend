import test from 'node:test';
import assert from 'node:assert/strict';
import {percentChange,formatPercent,formatEuro,formatCount,normalizeFacts,weekModel,sumKnown,changes,dailySeries,weekdayAverages,productRanking,monthKeyOfWeek,aggregateByMonth,visitsSeries,mixSeries} from '../web/crm-report-view.mjs';

const row=(week,start,extra={})=>({week,period_start:start,period_end:start,visits:100,membership:50,single:40,multisport:10,recorded_sales:500,report_value:550,multisport_receivable:50,product_cost:null,product_profit:null,...extra});

test('percent change never invents a value from a missing or zero base',()=>{
 assert.equal(percentChange(110,100),10);
 assert.equal(percentChange(90,100),-10);
 for(const [a,b] of [[1,0],[1,null],[null,1],[undefined,5],[NaN,5]])assert.equal(percentChange(a,b),null);
 assert.equal(formatPercent(null),'N/A');
 assert.match(formatPercent(8.333),/^\+8,33\s%$/);
 assert.match(formatPercent(-7.142),/^−7,14\s%$/);
 assert.equal(formatEuro(null),'N/A');assert.equal(formatCount(undefined),'N/A');
});

test('weekly and cumulative changes compare latest vs previous and vs first week',()=>{
 const weeks=weekModel([row(41,'2026-10-05',{visits:200}),row(40,'2026-09-28',{visits:100}),row(42,'2026-10-12',{visits:150})]);
 assert.deepEqual(weeks.map(w=>w.label),['W40','W41','W42']);
 const c=changes(weeks,'visits');
 assert.equal(c.weekly,-25);assert.equal(c.cumulative,50);assert.equal(c.latest,'W42');assert.equal(c.previous,'W41');assert.equal(c.first,'W40');
 assert.deepEqual([changes(weeks.slice(0,1),'visits').weekly,changes([],'visits').latest],[null,null]);
});

test('sums stay unknown when any week has an unknown value',()=>{
 const weeks=weekModel([row(40,'2026-09-28'),row(41,'2026-10-05',{product_cost:12})]);
 assert.equal(sumKnown(weeks,'visits'),200);
 assert.equal(sumKnown(weeks,'cost'),null);
 assert.equal(sumKnown([],'visits'),null);
});

test('facts are accepted only when every row is well formed',()=>{
 const good={period_start:'2026-10-26',dimension:'DAY',key:'2026-10-26',label:'26.10.2026',units:5,value_eur:null,cost_eur:null};
 assert.equal(normalizeFacts({facts:[good]}).length,1);
 assert.deepEqual(normalizeFacts({}),[]);
 assert.deepEqual(normalizeFacts({facts:[good,{...good,dimension:'CUSTOMER'}]}),[]);
 assert.deepEqual(normalizeFacts({facts:[{...good,units:'5'}]}),[]);
 assert.deepEqual(normalizeFacts({facts:[{...good,period_start:'x'}]}),[]);
});

test('weekday averages use only observed days and mark weekends',()=>{
 const weeks=weekModel([row(44,'2026-10-26')]);
 const facts=normalizeFacts({facts:[
  {period_start:'2026-10-26',dimension:'DAY',key:'2026-10-26',label:'26.10.2026',units:40},
  {period_start:'2026-10-26',dimension:'DAY',key:'2026-11-02',label:'02.11.2026',units:60},
  {period_start:'2026-10-26',dimension:'DAY',key:'2026-10-31',label:'31.10.2026',units:10}]});
 const daily=dailySeries(facts,weeks);
 assert.equal(daily.length,3);assert.equal(daily.find(d=>d.date==='2026-10-31').weekend,true);
 const avg=weekdayAverages(daily);
 assert.equal(avg[0].average,50);assert.equal(avg[0].days,2);
 assert.equal(avg[1].average,null);assert.equal(avg[1].days,0);
 assert.equal(avg[5].weekend,true);
});

test('product ranking hides profit that depends on an unknown cost',()=>{
 const weeks=weekModel([row(44,'2026-10-26')]);
 const facts=normalizeFacts({facts:[
  {period_start:'2026-10-26',dimension:'PRODUCT',key:'LF-PROD-003',label:'PRO8',units:2,value_eur:90,cost_eur:67.5},
  {period_start:'2026-10-26',dimension:'PRODUCT',key:'LF-PROD-014',label:'Uterák',units:1,value_eur:3.5,cost_eur:null},
  {period_start:'2026-10-26',dimension:'SERVICE',key:'LF-SVC-001',label:'Tréning',units:3,value_eur:60,cost_eur:null}]});
 assert.deepEqual(productRanking(facts,weeks,'sales').map(r=>r.key),['LF-PROD-003','LF-SVC-001','LF-PROD-014']);
 assert.deepEqual(productRanking(facts,weeks,'profit').map(r=>[r.key,r.value]),[['LF-PROD-003',22.5]]);
 assert.deepEqual(productRanking(facts,[],'sales'),[]);
});

test('a week belongs to the month that contains its Thursday',()=>{
 assert.equal(monthKeyOfWeek('2026-09-28'),'2026-10');
 assert.equal(monthKeyOfWeek('2026-10-26'),'2026-10');
 assert.equal(monthKeyOfWeek('2026-11-02'),'2026-11');
 assert.equal(monthKeyOfWeek('2026-12-28'),'2026-12');
 assert.equal(monthKeyOfWeek('nope'),null);
});

test('month aggregation sums whole weeks and keeps unknown sums unknown',()=>{
 const weeks=weekModel([row(40,'2026-09-28',{visits:216,membership:126,single:59,multisport:31}),row(44,'2026-10-26',{visits:234,membership:131,single:72,multisport:31}),row(45,'2026-11-02',{visits:285,membership:154,single:96,multisport:35})]);
 const months=aggregateByMonth(weeks);
 assert.deepEqual(months.map(m=>[m.key,m.weeks,m.visits,m.membership]),[['2026-10',2,450,257],['2026-11',1,285,154]]);
 const unknown=aggregateByMonth(weekModel([row(41,'2026-10-05',{visits:null}),row(42,'2026-10-12')]));
 assert.equal(unknown[0].visits,null);
});

test('visit and mix series follow the chosen grain; mix per day is not offered',()=>{
 const weeks=weekModel([row(44,'2026-10-26',{visits:234}),row(45,'2026-11-02',{visits:285})]);
 const daily=[{date:'2026-10-31',label:'31.10.2026',value:20,weekend:true},{date:'2026-11-02',label:'02.11.2026',value:58,weekend:false}];
 assert.deepEqual(visitsSeries(weeks,daily,'week'),{labels:['W44','W45'],values:[234,285],bands:[]});
 assert.deepEqual(visitsSeries(weeks,daily,'day'),{labels:['31.10','02.11'],values:[20,58],bands:[0]});
 assert.equal(visitsSeries(weeks,[],'day'),null);
 assert.deepEqual(visitsSeries(weeks,daily,'month').values,[234,285]);
 assert.equal(mixSeries(weeks,'day'),null);
 assert.deepEqual(mixSeries(weeks,'week').labels,['W44','W45']);
 assert.equal(mixSeries(weeks,'month').labels.length,2);
});
