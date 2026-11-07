import test from 'node:test';import assert from 'node:assert/strict';
import {catalogueGroup,catalogueSelection,cataloguePrice,loadCataloguePages,catalogueAudience,cataloguePreferences,clearCataloguePreferences} from '../web/crm-catalogue.mjs';
const item=(id,business_id,name,category='Dospelí')=>({id,business_id,name,category});
test('presentation groups use exact service IDs without inferring rights from names',()=>{
 assert.equal(catalogueGroup(item('a','LF-SVC-005','Anything'),'SERVICES').key,'visits');
 assert.equal(catalogueGroup(item('b','UNKNOWN','10-vstupová permanentka'),'SERVICES').key,'other');
 assert.equal(catalogueGroup(item('c','LF-SVC-012','Mesačná','Študenti a seniori'),'SERVICES').key,'time');
});
test('whole-catalogue logical order keeps entry and pass sizes predictable and supports accent-free multiword search',()=>{
 const rows=[item('30','LF-SVC-008','30-vstupová'),item('10','LF-SVC-005','10-vstupová'),item('m','LF-SVC-012','Mesačná permanentka','Študenti a seniori'),item('1','LF-SVC-001','Vstup')];
 assert.deepEqual(catalogueSelection(rows).map(i=>i.id),['1','10','30','m']);
 assert.deepEqual(catalogueSelection(rows,{query:'mesacna studenti'}).map(i=>i.id),['m']);
 assert.deepEqual(catalogueSelection(rows,{category:'visits'}).map(i=>i.id),['10','30']);
 assert.equal(catalogueSelection(rows,{query:'neexistuje'}).length,0);
});
test('products retain exact source category and variants; missing category gets an explicit fallback',()=>{
 const p={id:'p',name:'Proteín',category:'Výživa',variant_package:'Vanilka 500 g'};
 assert.equal(catalogueGroup(p,'PRODUCTS').label,'Výživa');
 assert.equal(catalogueSelection([p],{kind:'PRODUCTS',query:'vanilka 500'}).length,1);
 assert.equal(catalogueGroup({name:'Water'},'PRODUCTS').label,'Ostatné produkty');
});
test('missing or invalid money is never a free product or an invented unit price',()=>{
 for(const v of [null,undefined,'',' ','NaN','Infinity','-1','<script>'])assert.equal(cataloguePrice(v),null);
 assert.match(cataloguePrice('0'),/0,00/);assert.match(cataloguePrice('90.00'),/90,00/);assert.ok(!cataloguePrice('90').includes('/'));
});
test('load fetches all pages before global filtering and ordering; preserves server view boundary',async()=>{
 const calls=[];const api=async(p,{body})=>{calls.push(body);return body.after?{items:[item('1','LF-SVC-001','Vstup')],next:null}:{items:[item('30','LF-SVC-008','30-vstupová')],next:'next'};};
 const rows=await loadCataloguePages(api);assert.equal(calls.length,2);assert.deepEqual(calls[1],{view:'PRICE_LIST',kind:'SERVICES',after:'next'});assert.deepEqual(catalogueSelection(rows).map(i=>i.id),['1','30']);
 calls.length=0;await loadCataloguePages(async(p,{body})=>{calls.push(body);return {items:[],next:null};},{kind:'PRODUCTS',mode:'CATALOGUE'});assert.deepEqual(calls,[{view:'PRODUCT_CATALOGUE'}]);
});
test('pagination failure, cancellation and repeated cursors do not return a misleading partial catalogue',async()=>{
 await assert.rejects(()=>loadCataloguePages(async(p,{body})=>{if(body.after)throw Error('OFFLINE');return {items:[item('a','A','A')],next:'next'};}),/OFFLINE/);
 await assert.rejects(()=>loadCataloguePages(async()=>({items:[item('a','A','A')],next:'same'})),/pagination/);
 const c=new AbortController();await assert.rejects(()=>loadCataloguePages(async()=>{c.abort();return {items:[],next:null};},{signal:c.signal}),{name:'AbortError'});
});

test('audience badges keep discounted audience distinct without hiding age conditions',()=>{
 const a=catalogueAudience({business_id:'LF-SVC-012',category:'Študenti do 18 rokov a seniori nad 60 rokov'},'SERVICES');assert.equal(a.label,'Študenti / seniori');assert.match(a.detail,/18/);assert.match(a.detail,/60/);assert.equal(a.type,'discount');
 assert.equal(catalogueAudience({category:'Dospelí'},'SERVICES').type,'adult');assert.equal(catalogueAudience({category:'Nápoje',variant_package:'Citrón 500 ml'},'PRODUCTS').label,'Citrón 500 ml');
});
test('temporary preferences are isolated by actor and view boundary and explicitly clearable',()=>{
 clearCataloguePreferences();const a=cataloguePreferences('owner-a','PRICE_LIST');a.views.SERVICES={query:'mesacna',favorites:['service-a']};assert.equal(cataloguePreferences('owner-a','PRICE_LIST'),a);
 assert.deepEqual(cataloguePreferences('owner-b','PRICE_LIST').views,{});assert.deepEqual(cataloguePreferences('owner-a','CATALOGUE').views,{});
 clearCataloguePreferences();assert.notEqual(cataloguePreferences('owner-a','PRICE_LIST'),a);assert.deepEqual(cataloguePreferences('owner-a','PRICE_LIST').views,{});
});
