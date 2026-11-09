import test from 'node:test';
import assert from 'node:assert/strict';
import {multisportReportingMessage,reportingCoverageMessage,reportingPeriodError,validateHistoricalSnapshot} from '../web/crm-reporting.mjs';

test('reporting period accepts a single day and the inclusive 366-day maximum',()=>{
 assert.equal(reportingPeriodError('2026-11-01','2026-11-01'),'');
 assert.equal(reportingPeriodError('2024-02-29','2025-02-28'),'');
});

test('reporting period rejects empty, invalid, reversed and overlong ranges',()=>{
 for(const [from,to] of [
  ['', '2026-11-01'],['2026-11-01',''],['2026-02-30','2026-03-01'],
  ['2026-11-02','2026-11-01'],['2024-02-29','2025-03-01']
 ])assert.notEqual(reportingPeriodError(from,to),'');
});

test('reporting coverage never presents absent working-day records as a zero result',()=>{
 assert.match(reportingCoverageMessage({recorded_days:'0'}),/nemožno považovať za potvrdený nulový výsledok/);
 assert.match(reportingCoverageMessage({}),/nepodarilo určiť/);
});

test('reporting coverage distinguishes closed complete, open, unknown and incomplete days',()=>{
 const label=reportingCoverageMessage({recorded_days:'8',complete_days:'3',open_days:'2',unknown_opening_days:'1',incomplete_days:'4'});
 for(const phrase of ['3 zatvorených a úplných','2 otvorených','1 s neznámym otvorením','V 4 dňoch chýbajú údaje'])assert.ok(label.includes(phrase));
});

test('reporting explains effective MultiSport receipts and prevents settlement duplication',()=>{
 const label=multisportReportingMessage();
 assert.match(label,/Potvrdené MultiSport vstupy sa započítavajú/);
 assert.match(label,/sadzby zo Supabase platnej v deň návštevy/);
 assert.match(label,/4,70 € od 1\. 1\. 2026/);
 assert.match(label,/Neskoršie vyúčtovanie sa nesmie započítať druhýkrát/);
});

test('missing calendar dates remain explicitly unknown even when recorded days are complete',()=>{
 const message=reportingCoverageMessage({recorded_days:'1',complete_days:'1',open_days:'0',unknown_opening_days:'0',incomplete_days:'0',missing_days:'29'});
 assert.match(message,/29 dní chýba evidencia otvorenia/);
 assert.match(message,/nie sú potvrdená nula/);
});

test('historical snapshot accepts only the five-week numeric aggregate allowlist',()=>{
 const keys=['week','period_start','period_end','visits','membership','single','multisport','new_visitors','pass_units','product_units','training_units','zumba_hours','recorded_sales','report_value','sheet_price_value','product_cost','product_profit','multisport_receivable','change_pct'];
 const weekly=Array.from({length:5},(_,i)=>Object.fromEntries(keys.map(key=>[key,key==='week'?40+i:['period_start','period_end'].includes(key)?null:key==='new_visitors'||key==='change_pct'?null:0])));
 const snapshot={schema_version:1,source:'Lady Fitness Reporting MVP · weekly aggregate query',generated_at:'2026-11-01',source_sha256:'a'.repeat(64),limitations:{scope:'scope',costs:'costs',missing:'missing',receipts:'receipts'},weekly,snapshot_period:{from:null,to:null,weeks:[40,41,42,43,44]}};
 assert.equal(validateHistoricalSnapshot(snapshot),snapshot);
});

test('historical snapshot rejects personal fields, duplicate weeks and unsafe numeric values',()=>{
 const keys=['week','period_start','period_end','visits','membership','single','multisport','new_visitors','pass_units','product_units','training_units','zumba_hours','recorded_sales','report_value','sheet_price_value','product_cost','product_profit','multisport_receivable','change_pct'];
 const row=Object.fromEntries(keys.map(key=>[key,key==='week'?40:['period_start','period_end','new_visitors','change_pct'].includes(key)?null:0]));
 const snapshot={schema_version:1,source:'Lady Fitness Reporting MVP · weekly aggregate query',generated_at:'2026-11-01',source_sha256:'b'.repeat(64),limitations:{scope:'scope',costs:'costs',missing:'missing',receipts:'receipts'},weekly:[row,{...row,week:41},{...row,week:42},{...row,week:43},{...row,week:44}],snapshot_period:{weeks:[40,41,42,43,44]}};
 assert.throws(()=>validateHistoricalSnapshot({...snapshot,weekly:snapshot.weekly.map((r,i)=>i===0?{...r,person_label:'Meno'}:r)}));
 assert.throws(()=>validateHistoricalSnapshot({...snapshot,weekly:snapshot.weekly.map((r,i)=>i===1?{...r,week:40}:r)}));
 assert.throws(()=>validateHistoricalSnapshot({...snapshot,weekly:snapshot.weekly.map((r,i)=>i===0?{...r,visits:'0'}:r)}));
});

test('reporting accepts W45 without duplicating or discarding the original five weeks',async()=>{
 const {historyFixture}=await import('./fixtures/report-history.mjs');const s=historyFixture();const before=structuredClone(s.weekly);s.weekly.push({...s.weekly[4],week:45,period_start:'2026-11-02',period_end:'2026-11-08'});s.snapshot_period.weeks.push(45);assert.equal(validateHistoricalSnapshot(s),s);assert.deepEqual(s.weekly.slice(0,5),before);assert.throws(()=>validateHistoricalSnapshot({...s,snapshot_period:{weeks:[40,41,42,43,44]}}));
});
