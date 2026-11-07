// Full existing client workspace with a deterministic synthetic API. No live data.
import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const web=new URL('../web/',import.meta.url),id=n=>'80000000-0000-4000-8000-'+String(n).padStart(12,'0');
const browser=await (process.env.LF_UX_BROWSER==='webkit'?webkit:chromium).launch();
try{
 for(const width of [1440,820,375]){
  const page=await browser.newPage({viewport:{width,height:1000}}),errors=[],writes=[],operations=new Map();
  let client={id:id(1),name:'Synthetic client',phone:null,email:null,status:'ACTIVE',revision:'1'},sale=null,payment=null,entitlement=null,paid=false,consumed=0,lostCorrection=true;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{for(const name of ['setItem','removeItem','clear'])Storage.prototype[name]=()=>{throw Error('Browser storage write forbidden');};});
  await page.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());assert.equal(url.origin,'https://crm.test');
   const json=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'Cache-Control':'no-store'},body:JSON.stringify(data)});
   if(!url.pathname.startsWith('/api/')){
    if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:await readFile(new URL('crm.html',web),'utf8')});
    const file=url.pathname.slice(1);assert.match(file,/^[a-z0-9-]+\.(mjs|css)$|^assets\/lady-fitness-logo\.png$|^fonts\/[A-Za-z0-9-]+\.woff2?$/);
    try{return route.fulfill({contentType:file.endsWith('.mjs')?'text/javascript':file.endsWith('.css')?'text/css':'image/png',body:await readFile(new URL(file,web))});}catch{return route.fulfill({status:404,body:''});}
   }
   if(url.pathname==='/api/crm/session')return json({active:true,actor_id:id(2),role:'OWNER_ADMIN',expires_at:new Date(Date.now()+300000).toISOString(),workspace_enabled:true,csrf_token:'synthetic',owner_tasks_enabled:true});
   if(url.pathname==='/api/crm/readback'){assert.ok(operations.has(url.searchParams.get('request_id')));return json(operations.get(url.searchParams.get('request_id')));}
   const body=request.postDataJSON();assert.equal(request.headers()['x-csrf-token'],'synthetic');
   if(url.pathname==='/api/crm/read'){
    if(body.view==='CUSTOMERS')return json({items:[client],next:null});
    if(body.view==='CUSTOMER')return json({customer:client,can_edit:true,entitlements:entitlement?[{...entitlement,payment_confirmed:paid,consumed:String(consumed),activated_on:consumed?'2026-11-07':null,expires_on:consumed?'2027-05-08':null}]:[],entitlements_truncated:false});
    if(body.view==='ADMISSIONS')return json({items:[{id:id(3),revision:'1',code:'ENTITLEMENT',label_sk:'Permanentka'}]});
    if(body.view==='PRODUCT_CATALOGUE')return json({items:[],next:null});
    if(body.view==='CATALOGUE')return json({items:[{id:id(4),name:'Synthetic 10 vstupov',current_price_eur:'10.00',unit:'vstup',requires_customer:true,catalogue_fingerprint:'a'.repeat(64)}],next:null});
    if(body.view==='OWN_CHECKOUT')return json({sale:{...sale,customer_id:client.id,customer_name:client.name,customer_revision:client.revision,total:'10.00',paid:paid?'10.00':'0.00',line_fingerprint:'a'.repeat(64),lines:[{display_name_at_sale:'Synthetic 10 vstupov',quantity:'1',unit_at_sale:'vstup',line_total:'10.00'}]},payment:payment?.status==='PENDING'?payment:null,catalogue:[{service_id:id(4),catalogue_fingerprint:'a'.repeat(64)}],resume_blocked:null});
    throw Error('Unexpected read '+body.view);
   }
   assert.equal(url.pathname,'/api/crm/operations');writes.push(body);
   assert.equal(new Set(writes.map(w=>w.request_id)).size,writes.length,'No new mutation during recovery');
   let target,projection;
   if(body.operation_type==='UPDATE_CUSTOMER'){
    assert.equal(body.payload.customer_id,client.id);assert.equal(body.payload.expected_revision,'1');
    client={...client,name:body.payload.name,revision:'2'};target='customer';projection=client;
   }else if(body.operation_type==='CREATE_SALE'){
    assert.equal(body.payload.customer_revision,'2');sale={id:id(5),revision:'1',status:'DRAFT'};target='sale';projection=sale;
   }else if(body.operation_type==='CONFIRM_SALE'){
    sale={...sale,revision:'2',status:'CONFIRMED'};entitlement={id:id(6),revision:'1',status:'ENABLED',type_at_purchase:'VISIT_COUNT',included_units_at_purchase:'10',validity_value_at_purchase:6,validity_unit_at_purchase:'MONTH'};target='sale';projection=sale;
   }else if(body.operation_type==='CREATE_PAYMENT'){
    assert.equal(body.payload.method,'CARD');payment={id:id(7),revision:'1',amount:'10.00',method:'CARD',status:'PENDING'};target='payment';projection=payment;
   }else if(body.operation_type==='CONFIRM_PAYMENT'){
    paid=true;payment={...payment,revision:'2',status:'CONFIRMED'};target='payment';projection=payment;
   }else if(body.operation_type==='CHECK_IN'){
    consumed++;target='visit';projection={id:id(8),revision:'1',status:'POSTED'};
   }else throw Error('Unexpected mutation '+body.operation_type);
   const result={operation:{state:'COMPLETED',target_type:target},projection};operations.set(body.request_id,result);
   if(body.operation_type==='UPDATE_CUSTOMER'&&lostCorrection){lostCorrection=false;return json({code:'READBACK_UNAVAILABLE'},503);}
   return json(result);
  });
  await page.goto('https://crm.test/');
  await page.locator('.crm-reception-action').filter({has:page.getByRole('heading',{name:'Zoznam klientov',exact:true})}).getByRole('button',{name:'Otvoriť',exact:true}).click();
  await page.getByRole('button',{name:'Otvoriť klientku',exact:true}).click();
  await page.getByRole('button',{name:'Opraviť údaje klientky',exact:true}).click();
  await page.getByLabel('Meno klientky',{exact:true}).fill('Synthetic corrected client');await page.getByRole('button',{name:'Uložiť opravu',exact:true}).click();
  await expect(page.getByRole('button',{name:'Overiť výsledok',exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Recepcia',exact:true}).click();
  await expect(page.getByRole('button',{name:'Overiť výsledok',exact:true})).toBeVisible();assert.equal(writes.length,1);
  await page.getByRole('button',{name:'Overiť výsledok',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Synthetic corrected client',exact:true})).toBeVisible();
  const checkout=page.getByRole('region',{name:'Nákup klientky'});
  await checkout.getByRole('button',{name:'Služby',exact:true}).click();await checkout.getByRole('button',{name:'Pridať Synthetic 10 vstupov',exact:true}).click();
  await checkout.getByRole('button',{name:'Uložiť rozpracovaný predaj',exact:true}).click();await checkout.getByRole('button',{name:'Potvrdiť predaj',exact:true}).click();
  await expect(checkout.getByText('Nákup je zaznamenaný.',{exact:false})).toBeVisible();
  assert.equal(writes.some(w=>w.operation_type.includes('PAYMENT')),false);
  await page.getByRole('button',{name:/Použiť permanentku · čerpané 0 \/ 10/}).click();
  await expect(page.getByText('Čerpané: 1 / 10',{exact:true})).toBeVisible();
  assert.deepEqual(writes.map(w=>w.operation_type),['UPDATE_CUSTOMER','CREATE_SALE','CONFIRM_SALE','CHECK_IN']);
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.close();
 }
 console.log('PASS: full synthetic client workspace at 1440/820/375px; lost correction readback/navigation guard, current revision, recorded purchase without payment, immediate redemption and immediate balance refresh; no browser storage or external calls.');
}finally{await browser.close();}
