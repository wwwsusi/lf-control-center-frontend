import test from 'node:test';import assert from 'node:assert/strict';
import {cancellationRequest,confirmText,errorText,reasonLabel,CANCEL_REASON_LABELS} from '../web/crm-cancel.mjs';
const id='11111111-1111-4111-8111-111111111111',rid='22222222-2222-4222-8222-222222222222',date='2026-11-18';
test('reasons are the approved fixed list',()=>{
 assert.deepEqual(Object.keys(CANCEL_REASON_LABELS),['ENTRY_ERROR','WRONG_ITEM','DUPLICATE','CUSTOMER_LEFT','CATALOGUE_CHANGED']);
 assert.equal(reasonLabel('DUPLICATE'),'Duplicitný zápis');assert.equal(reasonLabel('X'),'Dôvod nie je uvedený');
});
test('a visit is cancelled with CANCEL_VISIT and the exact server fields',()=>{
 const r=cancellationRequest({kind:'VISIT',id,revision:'3'},date,'WRONG_ITEM',rid);
 assert.deepEqual(r,{request_id:rid,operation_type:'CANCEL_VISIT',payload:{visit_id:id,business_date:date,expected_revision:'3',reason_code:'WRONG_ITEM'}});
});
test('a sale is cancelled with CANCEL_SALE including the server line fingerprint',()=>{
 const fp='a'.repeat(64),r=cancellationRequest({kind:'SALE',id,revision:'2',line_fingerprint:fp},date,'ENTRY_ERROR',rid);
 assert.deepEqual(r,{request_id:rid,operation_type:'CANCEL_SALE',payload:{sale_id:id,business_date:date,expected_revision:'2',line_fingerprint:fp,reason_code:'ENTRY_ERROR'}});
});
test('unknown reason or kind is refused before any request is built',()=>{
 assert.throws(()=>cancellationRequest({kind:'VISIT',id,revision:'1'},date,'OTHER',rid),/REASON/);
 assert.throws(()=>cancellationRequest({kind:'PAYMENT',id,revision:'1'},date,'ENTRY_ERROR',rid),/KIND/);
});
test('the confirmation says what is cancelled and that a linked sale goes with an entry',()=>{
 assert.match(confirmText({kind:'VISIT',label:'Jednorazový vstup · 6 €',linked_sale:true}),/Zruší sa aj naviazaný predaj/);
 assert.doesNotMatch(confirmText({kind:'SALE',label:'Predaj · Voda ×1'}),/naviazaný/);
 assert.match(errorText('REVISION_CONFLICT'),/medzitým zmenil/);assert.match(errorText('???'),/Storno sa nepodarilo/);
});
