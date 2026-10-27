// Delayed same-epoch session polls versus actual check-in activity. Synthetic only.
import {chromium,webkit,expect} from '@playwright/test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../dist'),engine=process.env.LF_UX_BROWSER||'chromium';
assert.ok(['chromium','webkit'].includes(engine));const browser=await ({chromium,webkit})[engine].launch();
const id=n=>'80000000-0000-4000-8000-'+String(n).padStart(12,'0');
try{
 for(const releaseAt of [200000,350000]){
  const page=await browser.newPage(),base=Date.now(),customer={id:id(1),name:'Synthetic client',status:'ACTIVE',revision:'1'};
  let serverNow=base,expires=base+300000,polls=0,held=false,delivered=false,deny=false,release;
  const gate=new Promise(r=>release=r);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date(base)});
  await page.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());assert.equal(u.origin,'https://crm.test');
   const json=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
   if(u.pathname==='/api/crm/session'){
    const snapshot={active:true,actor_id:'synthetic',role:'RECEPTION',csrf_token:'synthetic',expires_at:new Date(expires).toISOString()};
    if(++polls===2){held=true;await gate;await json(200,snapshot);delivered=true;return;}
    return json(deny?401:200,deny?{code:'AUTH_REQUIRED'}:snapshot);
   }
   if(u.pathname==='/api/crm/read'){
    const b=req.postDataJSON();
    if(b.view==='CUSTOMERS')return json(200,{items:[customer],next:null});
    if(b.view==='CUSTOMER')return json(200,{customer,entitlements:[{id:id(3),revision:'1',status:'ENABLED',type_at_purchase:'VISIT_COUNT',included_units_at_purchase:'10',consumed:'0',activated_on:null,expires_on:null,validity_value_at_purchase:6,validity_unit_at_purchase:'MONTH'}]});
    if(b.view==='ADMISSIONS')return json(200,{items:[{id:id(2),revision:'1',code:'ENTITLEMENT',label_sk:'Permanentka'}]});
    if(b.view==='PRODUCT_CATALOGUE')return json(200,{items:[],next:null});
    throw Error('Unexpected read');
   }
   if(u.pathname==='/api/crm/operations'){assert.equal(req.postDataJSON().operation_type,'CHECK_IN');expires=Math.min(serverNow+300000,base+900000);return json(200,{operation:{state:'COMPLETED',target_type:'visit'},projection:{id:id(4),status:'POSTED'},expires_at:new Date(expires).toISOString()});}
   assert.ok(!u.pathname.startsWith('/api/'));
   const file=path.resolve(root,'.'+(u.pathname==='/crm'?'/crm.html':u.pathname));assert.ok(file.startsWith(root+'/'));
   try{return route.fulfill({body:await fs.readFile(file),contentType:({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}
  });
  await page.goto('https://crm.test/crm');await expect(page.getByRole('heading',{name:'CRM · Recepcia',exact:true})).toBeVisible();
  await page.locator('.crm-card').filter({hasText:'Zoznam klientov'}).getByRole('button',{name:'Otvoriť',exact:true}).click();
  await page.getByRole('button',{name:'Otvoriť klientku',exact:true}).click();
  const entry=page.getByRole('button',{name:/Použiť permanentku/});await expect(entry).toBeVisible();
  await page.clock.pauseAt(new Date(base+1000));serverNow=base+180000;await page.clock.fastForward(179000);await expect.poll(()=>held).toBe(true);
  await entry.click();await expect(page.getByText('Návšteva bola uložená a overená.',{exact:true})).toBeVisible();assert.equal(expires,base+480000);
  serverNow=base+releaseAt;await page.clock.fastForward(releaseAt-180000);release();await expect.poll(()=>delivered).toBe(true);await page.clock.fastForward(1);
  if(releaseAt<300000){serverNow=base+301000;await page.clock.fastForward(301000-releaseAt);}
  await expect(page.getByRole('heading',{name:'CRM · Recepcia',exact:true})).toBeVisible();
  deny=true;await page.clock.fastForward(61000);await expect(page.getByRole('heading',{name:'CRM · individuálne prihlásenie',exact:true})).toBeVisible();
  assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: future and already-expired delayed polls cannot replace newer same-session activity deadline; later HTTP401 still hides data.');
}finally{await browser.close();}
