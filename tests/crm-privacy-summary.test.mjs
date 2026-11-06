import test from 'node:test';import assert from 'node:assert/strict';import {privacySummary} from '../web/crm-privacy-summary-data.mjs';
const fixture=()=>({summary:{inactive_24_months:'3',blocked_by_service_or_payment:'2',needs_manual_privacy_review:'1'},limitations:{legal_holds:'NOT_CONNECTED',history_review:'NOT_CONNECTED',anonymisation:'NOT_IMPLEMENTED'},actions:{anonymisation_enabled:false}});
test('valid aggregate accepted without extra identifiers',()=>{const f=fixture();f.customer='not returned';assert.deepEqual(privacySummary(f),f.summary);});
test('inconsistent counts rejected',()=>{const f=fixture();f.summary.inactive_24_months='4';assert.throws(()=>privacySummary(f));});
test('unsafe numeric value rejected',()=>{const f=fixture();f.summary.inactive_24_months=3;assert.throws(()=>privacySummary(f));});
test('execution enabled rejected',()=>{const f=fixture();f.actions.anonymisation_enabled=true;assert.throws(()=>privacySummary(f));});
test('missing limitations not interpreted as complete',()=>{const f=fixture();delete f.limitations;assert.throws(()=>privacySummary(f));});
