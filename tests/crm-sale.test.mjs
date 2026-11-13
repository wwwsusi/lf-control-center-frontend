import test from 'node:test';import assert from 'node:assert/strict';
import {cartTotal,byName} from '../web/crm-sale.mjs';
test('cart total sums price times quantity and stays exact for cents',()=>{
 const l=(price,qty)=>({item:{current_price_eur:price},qty});
 assert.equal(cartTotal([]),0);
 assert.equal(Math.round(cartTotal([l('54.00',1),l('45.00',2)])*100),14400);
 assert.equal(Math.round(cartTotal([l('1.40',3),l('3.52',1)])*100),772);
});
test('products sort alphabetically with Slovak collation',()=>{
 const names=['Šport uterák','Vanilka','Elektrolity','BCAA','Čaj','Fľaša'];
 assert.deepEqual(names.map(name=>({name})).sort(byName).map(x=>x.name),['BCAA','Čaj','Elektrolity','Fľaša','Šport uterák','Vanilka']);
});
