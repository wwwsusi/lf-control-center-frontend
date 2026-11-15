import test from 'node:test';
import assert from 'node:assert/strict';
import {uxProjection,todayFocus} from '../web/ux-model.mjs';
import {fixture} from './fixtures/ux-v2.mjs';

test('todayFocus: overdue first, bounded to five, no duplicates, each with a reason',()=>{
 const v=uxProjection(fixture(),'2026-10-10'),f=todayFocus(v);
 assert(f.shown.length<=5);
 assert.equal(new Set(f.shown.map(x=>x.item.id)).size,f.shown.length);
 assert(f.shown.every(x=>x.reason));
 assert.equal(f.shown[0].reason,'Po termíne');
 assert.equal(f.shown[0].item.id,'t3');
});
test('todayFocus limit and total count',()=>{
 const v=uxProjection(fixture(),'2026-10-10');
 const f=todayFocus(v,1);
 assert.equal(f.shown.length,1);
 assert(f.total>=1);
});
