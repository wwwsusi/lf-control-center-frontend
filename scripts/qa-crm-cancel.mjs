// Actual CRM shell with a synthetic API. No hosted requests. Same-day cancellation UI.
import {chromium,webkit,expect} from '@playwright/test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../dist'),engine=process.env.LF_UX_BROWSER||'chromium';
assert.ok(['chromium','webkit'].includes(engine));const browser=await ({chromium,webkit})[engine].launch();
const FP='a'.repeat(64);
async function run({role,feature,outcome}){
 const page=await browser.newPage({viewport:{width:1024,height:768}}),errors=[],posts=[],reads=[];let candidates=[
  {kind:'VISIT',id:'11111111-1111-4111-8111-111111111111',revision:'1',occurred_at:new Date().toISOString(),label:'Jednorazový vstup · 6.00 €',linked_sale:true},
  {kind:'SALE',id:'22222222-2222-4222-8222-222222222222',revision:'4',occurred_at:new Date().toISOString(),label:'Predaj · Voda ×1 · 1.40 €',line_fingerprint:FP,linked_sale:false}];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());assert.equal(u.origin,'https://crm.test');
  const json=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(u.pathname==='/api/crm/session')return json(200,{active:true,actor_id:'synthetic',role,csrf_token:'synthetic',expires_at:new Date(Date.now()+600000).toISOString()});
  if(u.pathname==='/api/crm/read'){
   const b=route.request().postDataJSON();reads.push(b.view);
   if(b.view==='TODAY')return json(200,{date:'2026-11-18',day:{opening_status:'OPEN',visits_completeness:'PARTIAL',sales_completeness:'PARTIAL',payments_completeness:'MISSING',revision:'1'},items:[],next:null});
   if(b.view==='CANCEL_CANDIDATES')return feature?json(200,{date:'2026-11-18',items:candidates,reasons:[]}):json(403,{code:'FORBIDDEN'});
   if(b.view==='CANCELLED_TODAY')return role==='OWNER_ADMIN'?json(200,{date:'2026-11-18',items:[{kind:'VISIT',id:'x',cancelled_at:new Date().toISOString(),reason_code:'CUSTOMER_LEFT',label:'MultiSport'}]}):json(403,{code:'FORBIDDEN'});
   return json(200,{items:[],next:null});
  }
  if(u.pathname==='/api/crm/operations'&&outcome==='missing'){posts.push(route.request().postDataJSON());return route.abort('failed');}
  if(u.pathname==='/api/crm/operations'){
   const b=route.request().postDataJSON();posts.push(b);
   if(outcome==='lost')return route.abort('failed');
   if(outcome==='conflict')return json(200,{operation:{state:'REJECTED',result_code:'REVISION_CONFLICT'}});
   candidates=candidates.filter(c=>c.id!==(b.payload.visit_id||b.payload.sale_id));
   return json(200,{operation:{state:'COMPLETED',target_type:b.operation_type==='CANCEL_VISIT'?'visit':'sale'},projection:{id:'x',status:'CANCELLED'}});
  }
  if(u.pathname==='/api/crm/readback'&&outcome==='missing')return json(422,{code:'BUSINESS_REJECTED'});
  if(u.pathname==='/api/crm/readback'){candidates=candidates.filter(c=>c.id!=='11111111-1111-4111-8111-111111111111');return json(200,{operation:{state:'COMPLETED',target_type:'visit'},projection:{id:'x',status:'CANCELLED'}});}
  assert.ok(!u.pathname.startsWith('/api/'),'Unexpected API call '+u.pathname);
  const file=path.resolve(root,'.'+(u.pathname==='/crm'?'/crm.html':u.pathname));assert.ok(file.startsWith(root+'/'));
  try{return route.fulfill({body:await fs.readFile(file),contentType:({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}
 });
 await page.goto('https://crm.test/crm');await expect(page.getByRole('heading',{name:'CRM · Recepcia',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Dnešné záznamy',exact:true}).click();await expect(page.getByRole('heading',{name:/Dnešné záznamy/})).toBeVisible();
 return {page,posts,errors,reads};
}
try{
 // Feature off: the section never appears.
 {const {page,errors}=await run({role:'RECEPTION',feature:false});await page.waitForTimeout(300);await expect(page.locator('.crm-cancel')).toBeHidden();assert.deepEqual(errors,[]);await page.close();}
 // Reception: entry with linked sale -> confirmation text, reason required, exact payload, list refreshed.
 {const {page,posts,errors,reads}=await run({role:'RECEPTION',feature:true});
  await expect(page.locator('.crm-cancel')).toBeVisible();await expect(page.locator('.crm-cancel-row')).toHaveCount(2);
  await expect(page.getByText('Stornované dnes')).toHaveCount(0);
  await page.locator('.crm-cancel-row').first().getByRole('button',{name:'Stornovať',exact:true}).click();
  await expect(page.getByText(/Zruší sa aj naviazaný predaj/)).toBeVisible();
  const go=page.getByRole('button',{name:'Potvrdiť storno',exact:true});await expect(go).toBeDisabled();
  await page.getByLabel('Klientka neodišla alebo nevstúpila').check();await expect(go).toBeEnabled();
  const box=await go.boundingBox();assert.ok(box.height>=56,'touch target');
  const todayReads=()=>reads.filter(v=>v==='TODAY').length,before=todayReads();
  await go.click();await expect(page.locator('.crm-toast')).toContainText('Záznam bol stornovaný');
  assert.equal(posts.length,1);assert.equal(posts[0].operation_type,'CANCEL_VISIT');assert.deepEqual(posts[0].payload,{visit_id:'11111111-1111-4111-8111-111111111111',business_date:'2026-11-18',expected_revision:'1',reason_code:'CUSTOMER_LEFT'});
  await expect(page.locator('.crm-cancel-row')).toHaveCount(1);
  // the whole Today screen is read again, so the cancelled record does not stay in the list above
  await expect.poll(todayReads).toBeGreaterThan(before);await expect(page.locator('.crm-cancel')).toHaveCount(1);
  await page.locator('.crm-cancel-row').first().getByRole('button',{name:'Stornovať',exact:true}).click();await page.getByLabel('Zlý produkt alebo vstup').check();await page.getByRole('button',{name:'Potvrdiť storno',exact:true}).click();
  await expect.poll(()=>posts.length).toBe(2);assert.equal(posts[1].operation_type,'CANCEL_SALE');assert.equal(posts[1].payload.line_fingerprint,FP);assert.equal(posts[1].payload.expected_revision,'4');
  assert.deepEqual(errors,[]);await page.close();}
 // Lost response: result is not confirmed, the verify button re-reads instead of posting again.
 {const {page,posts}=await run({role:'RECEPTION',feature:true,outcome:'lost'});
  await page.locator('.crm-cancel-row').first().getByRole('button',{name:'Stornovať',exact:true}).click();await page.getByLabel('Omyl pri zápise').check();await page.getByRole('button',{name:'Potvrdiť storno',exact:true}).click();
  await expect(page.getByText(/Výsledok nie je potvrdený/)).toBeVisible();
  await page.getByRole('button',{name:'Overiť výsledok',exact:true}).click();await expect(page.locator('.crm-toast')).toContainText('Záznam bol stornovaný');assert.equal(posts.length,1,'no second POST');await page.close();}
 // The request never reached the server: verifying says nothing was cancelled, and the list can be used again.
 {const {page,posts}=await run({role:'RECEPTION',feature:true,outcome:'missing'});
  await page.locator('.crm-cancel-row').first().getByRole('button',{name:'Stornovať',exact:true}).click();await page.getByLabel('Omyl pri zápise').check();await page.getByRole('button',{name:'Potvrdiť storno',exact:true}).click();
  await page.getByRole('button',{name:'Overiť výsledok',exact:true}).click();await expect(page.getByText('Storno sa na serveri nenašlo. Nič sa nestornovalo, môžeš ho zopakovať.',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Späť na zoznam',exact:true}).click();await expect(page.locator('.crm-cancel-row')).toHaveCount(2);assert.equal(posts.length,1);await page.close();}
 // Conflict: message and the list is reloaded.
 {const {page}=await run({role:'RECEPTION',feature:true,outcome:'conflict'});
  await page.locator('.crm-cancel-row').first().getByRole('button',{name:'Stornovať',exact:true}).click();await page.getByLabel('Duplicitný zápis').check();await page.getByRole('button',{name:'Potvrdiť storno',exact:true}).click();
  await expect(page.getByText(/medzitým zmenil/)).toBeVisible();await page.close();}
 // Owner sees the cancelled list with the reason; reception never did.
 {const {page}=await run({role:'OWNER_ADMIN',feature:true});await expect(page.getByText('Stornované dnes')).toBeVisible();await expect(page.getByText(/Klientka neodišla alebo nevstúpila/).first()).toBeVisible();await page.close();}
 console.log('PASS: cancellation section hidden when off; confirmation, fixed reasons, exact payloads for entry and sale, touch targets, lost-response verify without second POST, conflict message, owner-only cancelled list.');
}finally{await browser.close();}
