import test from 'node:test';
import assert from 'node:assert/strict';
import {multisportReportingMessage,reportingCoverageMessage,reportingPeriodError} from '../web/crm-reporting.mjs';

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
