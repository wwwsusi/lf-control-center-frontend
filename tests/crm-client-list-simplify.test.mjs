import test from 'node:test';import assert from 'node:assert/strict';
import {detectSearchMode,clientCountLabel} from '../web/crm-client-view.mjs';
import {filterClients} from '../web/crm-client-table.mjs';
test('one search box picks the lookup mode from what was typed',()=>{
 assert.equal(detectSearchMode('Jana'),'NAME');
 assert.equal(detectSearchMode('  Ján Nový '),'NAME');
 assert.equal(detectSearchMode('jana@example.test'),'EMAIL');
 assert.equal(detectSearchMode('+421 905 111 222'),'PHONE');
 assert.equal(detectSearchMode('0905111222'),'PHONE');
 assert.equal(detectSearchMode('0905'),'NAME','too few digits stay a name search');
 assert.equal(detectSearchMode(''),'NAME');
 assert.equal(detectSearchMode(undefined),'NAME');
});
test('the client count reads naturally in Slovak',()=>{
 assert.equal(clientCountLabel(1,1),'1 klientka');assert.equal(clientCountLabel(3,3),'3 klientky');assert.equal(clientCountLabel(8,8),'8 klientok');
 assert.equal(clientCountLabel(2,9),'2 z 9 klientok');assert.equal(clientCountLabel(1,3),'1 z 3 klientky');
});
test('narrowing filters keep working without the removed text filter',()=>{
 const items=[{name:'A',membership:null,owner_summary:{total_spent_eur:'10'}},{name:'B',membership:null,owner_summary:{total_spent_eur:'200'}}];
 assert.equal(filterClients(items,{status:'',visit:'',minSpent:'100'},'2026-11-15').length,1);
 assert.equal(filterClients(items,{q:'b'},'2026-11-15').length,1,'the q filter is still honoured if a state carries it');
});
