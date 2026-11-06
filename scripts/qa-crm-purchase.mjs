// Synthetic protocol-contract browser tests. No provider, hosted DB or deployment.
import {chromium,expect} from '@playwright/test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import path from 'node:path';
import {validate} from '../tests/fixtures/backend-crm-contract.mjs';
import {createHash} from 'node:crypto';
// Frozen validator from verified backend runtime f822b28; source hash prevents drift.
assert.equal(createHash('sha256').update(await readFile(new URL('../tests/fixtures/backend-crm-contract.mjs',import.meta.url))).digest('hex'),'e018aaacd991780df17552559deec94216a0ea811a21889c25b935ed8395a40d');
const base='https://crm.test',root=path.resolve(import.meta.dirname,'../dist');
const product={id:'90000000-0000-4000-8000-000000000001',business_id:'LF-PROD-9001',name:'Synthetic bar',unit:'kus',current_price_eur:'2.50',catalogue_fingerprint:'a'.repeat(64),requires_customer:false};
const browser=await chromium.launch({executablePath:process.env.LF_BROWSER_EXECUTABLE||'/usr/bin/chromium'});
async function fixture(width,known=false){
 const client={id:'80000000-0000-4000-8000-000000000001',name:'Synthetic client',revision:'7',status:'ACTIVE'};
 const page=await browser.newPage({viewport:{width,height:1024}}),errors=[],writes=[],ops=new Map();let sale=null,payment=null,lose=null,blocked=null,hold=false,release=()=>{},heldResolve;
 const held=new Promise(r=>heldResolve=r);
 page.on('pageerror',e=>errors.push(e.message));
 const snapshot=()=>({sale:structuredClone(sale),payment:structuredClone(payment),catalogue:blocked?[]:[{product_id:product.id,catalogue_fingerprint:product.catalogue_fingerprint}],resume_blocked:blocked});
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());assert.equal(url.origin,base);
  const json=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  if(url.pathname==='/api/crm/session')return json(200,{active:true,actor_id:'synthetic-reception',role:'RECEPTION',expires_at:new Date(Date.now()+120000).toISOString(),csrf_token:'synthetic-csrf'});
  if(url.pathname==='/api/crm/read'){
   const body=req.postDataJSON();if(body.view==='CUSTOMERS')return json(200,{items:[client],next:null});if(body.view==='CUSTOMER')return json(200,{customer:client,entitlements:[{type_at_purchase:'TIME_ACCESS',status:'ENABLED',consumed:'0',included_units_at_purchase:null},{type_at_purchase:'VISIT_COUNT',status:'ENABLED',consumed:'2',included_units_at_purchase:'10'}]});if(body.view==='PRODUCT_CATALOGUE')return json(200,{items:[product],next:null});
   if(body.view==='OWN_CHECKOUTS')return json(200,{items:sale?[{id:sale.id,business_date:'2026-10-18',status:sale.status,total:sale.total,paid:sale.paid}]:[],next:null});
   assert.equal(body.view,'OWN_CHECKOUT');assert.equal(body.sale_id,sale.id);return json(200,snapshot());
  }
  if(url.pathname==='/api/crm/readback'){
   const op=ops.get(url.searchParams.get('request_id'));assert.ok(op);return json(200,{operation:{state:'COMPLETED'},projection:op.target==='sale'?sale:{id:'22222222-2222-4222-8222-222222222222',sale_id:sale.id}});
  }
  if(url.pathname==='/api/crm/operations'){
   assert.equal(req.headers()['x-csrf-token'],'synthetic-csrf');const body=validate(req.postDataJSON());writes.push(body);assert.ok(!ops.has(body.request_id),'unexpected mutation replay');let projection,target;
   if(body.operation_type==='CREATE_SALE'){
    assert.equal(sale,null,'duplicate sale');assert.equal(body.payload.customer_id,known?client.id:null);assert.equal(body.payload.customer_revision,known?client.revision:null);assert.deepEqual(body.payload.lines,[{product_id:product.id,quantity:'1',catalogue_fingerprint:product.catalogue_fingerprint}]);
    sale={customer_id:known?client.id:null,customer_name:known?client.name:null,customer_revision:known?client.revision:null,id:'11111111-1111-4111-8111-111111111111',status:'DRAFT',revision:'1',currency:'EUR',total:'2.50',paid:'0.00',line_fingerprint:'b'.repeat(64),lines:[{display_name_at_sale:product.name,unit_at_sale:'kus',quantity:'1.000',line_total:'2.50'}]};projection=sale;target='sale';
   }else if(body.operation_type==='CONFIRM_SALE'){
    assert.equal(sale.status,'DRAFT');assert.equal(body.payload.customer_revision,known?client.revision:null);assert.equal(body.payload.expected_revision,sale.revision);assert.equal(body.payload.line_fingerprint,sale.line_fingerprint);sale.status='CONFIRMED';sale.revision='2';projection=sale;target='sale';
   }else if(body.operation_type==='CREATE_PAYMENT'){
    assert.equal(payment,null,'duplicate payment');assert.equal(sale.status,'CONFIRMED');assert.equal(body.payload.method,'CASH');assert.equal(body.payload.amount,'2.50');
    payment={id:'22222222-2222-4222-8222-222222222222',sale_id:sale.id,status:'PENDING',method:'CASH',amount:'2.50',revision:'1'};projection=payment;target='payment';
   }else{
    assert.equal(body.operation_type,'CONFIRM_PAYMENT');assert.equal(body.payload.payment_id,payment.id);sale.paid='2.50';projection={...payment,status:'CONFIRMED',revision:'2'};payment=null;target='payment';
   }
   ops.set(body.request_id,{target});
   if(hold){heldResolve();await new Promise(r=>release=r);}
   if(lose===body.operation_type){lose=null;return route.abort('failed');}
   return json(200,{operation:{state:'COMPLETED'},projection});
  }
  if(url.pathname.startsWith('/api/'))throw Error('UNEXPECTED_API');
  const file=path.resolve(root,'.'+(url.pathname==='/crm'?'/crm.html':url.pathname));assert.ok(file.startsWith(root+'/'));
  try{return route.fulfill({body:await readFile(file),contentType:({'.mjs':'text/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}
 });
 const card=heading=>page.locator('.crm-card').filter({has:page.getByRole('heading',{name:heading,exact:true})}).getByRole('button',{name:'Otvoriť'});
 const open=async()=>{await page.goto(base+'/crm');if(known){await card('Zoznam klientov').click();await page.getByRole('button',{name:'Otvoriť klientku',exact:true}).click();await expect(page.locator('#crm-content')).toContainText('Časový prístup');await expect(page.locator('#crm-content')).toContainText('Počet vstupov');await page.getByRole('button',{name:'Nakúpiť pre klientku',exact:true}).click();await expect(page.locator('#crm-content')).toContainText('Synthetic client');}else{await card('Prišla nakupovať').click();await page.getByRole('button',{name:'Nákup bez identifikovanej klientky',exact:true}).click();}await page.getByRole('button',{name:'Pridať Synthetic bar',exact:true}).click();};
 return {page,writes,errors,open,held,card,setLose:v=>lose=v,setHold:()=>hold=true,release:()=>release(),setBlocked:()=>blocked='CATALOGUE_CHANGED',sale:()=>sale};
}
try{
 for(const known of [false,true])for(const width of [1280,768,375]){
  const f=await fixture(width,known),p=f.page;try{
   await f.open();assert.equal(f.writes.length,0);f.setLose('CREATE_SALE');await p.getByRole('button',{name:'Uložiť rozpracovaný predaj'}).click();
   await expect(p.getByRole('button',{name:'Overiť tú istú operáciu'})).toBeVisible();assert.equal(f.writes.length,1);
   await p.getByRole('button',{name:'Overiť tú istú operáciu'}).click();await expect(p.getByRole('button',{name:'Potvrdiť predaj',exact:true})).toBeEnabled();assert.equal(f.writes.length,1);
   await p.getByRole('button',{name:'Potvrdiť predaj',exact:true}).click();await expect(p.getByRole('button',{name:'Zaznamenať platbu'})).toBeEnabled();
   f.setLose('CREATE_PAYMENT');await p.getByRole('button',{name:'Zaznamenať platbu'}).click();await expect(p.getByRole('button',{name:'Overiť tú istú operáciu'})).toBeVisible();assert.equal(f.writes.length,3);
   await p.reload();await f.card('Rozpracované predaje').click();await p.getByRole('button',{name:'Otvoriť uložený predaj'}).click();await expect(p.getByRole('button',{name:'Potvrdiť prijatie platby'})).toBeEnabled();if(known)await expect(p.locator('#crm-content')).toContainText('Klientka: Synthetic client');assert.equal(f.writes.length,3);assert.equal(await p.getByRole('button',{name:'Zaznamenať platbu'}).count(),0);
   await p.getByRole('button',{name:'Potvrdiť prijatie platby'}).click();await expect(p.getByText('Predaj a prijatie platby sú potvrdené.',{exact:true})).toBeVisible();assert.equal(f.writes.length,4);
   if(process.env.LF_CRM_SCREENSHOT_DIR&&width===1280)await p.screenshot({path:path.join(process.env.LF_CRM_SCREENSHOT_DIR,'purchase-confirmed.png'),fullPage:true});
   await p.reload();await f.card('Rozpracované predaje').click();await p.getByRole('button',{name:'Otvoriť uložený predaj'}).click();await expect(p.getByText('Predaj a prijatie platby sú potvrdené.',{exact:true})).toBeVisible();assert.equal(f.writes.length,4);
   assert.deepEqual(await p.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(f.errors,[]);
  }finally{await p.close();}
 }
 const f=await fixture(768),p=f.page;try{
  await f.open();f.setHold();await p.getByRole('button',{name:'Uložiť rozpracovaný predaj'}).evaluate(el=>{el.click();el.click();});await f.held;
  assert.equal(f.writes.length,1);await expect(p.getByRole('button',{name:'Overiť tú istú operáciu'})).toBeDisabled();
  await p.getByRole('button',{name:'Skryť údaje',exact:true}).click();f.release();await p.waitForTimeout(100);assert.equal(await p.locator('#crm-content').textContent(),'');assert.equal(await p.locator('#crm-workspace').isVisible(),false);assert.equal(f.writes.length,1);
  await p.reload();f.setBlocked();await f.card('Rozpracované predaje').click();await p.getByRole('button',{name:'Otvoriť uložený predaj'}).click();await expect(p.getByText('Predaj vyžaduje kontrolu vlastníka.',{exact:false})).toBeVisible();assert.equal(await p.getByRole('button',{name:'Potvrdiť predaj',exact:true}).count(),0);assert.equal(f.writes.length,1);assert.deepEqual(f.errors,[]);
 }finally{f.release();await p.close();}
 console.log('PASS reconstructed purchase UI: frozen verified-backend payload validator, anonymous sale/CASH receipt, lost-response readback, reload recovery without replacement, paid read-only, stale catalogue blocked, in-flight controls disabled, late response wipe, no storage/overflow; desktop/tablet. Mock API only, no SQL/provider/deployment proof.');
}finally{await browser.close();}
