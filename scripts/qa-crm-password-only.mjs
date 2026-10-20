// Local browser/synthetic API only; never reaches a provider or database.
import {chromium} from '@playwright/test';import {readFile} from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../dist'),origin='https://crm.test';
const browser=await chromium.launch({executablePath:process.env.LF_BROWSER_EXECUTABLE||'/usr/bin/chromium'});
try{for(const width of [1280,768]){
 const page=await browser.newPage({viewport:{width,height:1024}});let signedIn=false,role='OWNER_ADMIN',submitted,logout=false;const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const req=route.request(),url=new URL(req.url());assert.equal(url.origin,origin);
  const json=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/api/crm/login'){
   submitted=req.postDataJSON();assert.deepEqual(Object.keys(submitted).sort(),['email','password']);signedIn=true;return json(200,{active:true,csrf_token:'synthetic-csrf'});
  }
  if(url.pathname==='/api/crm/logout'){
   assert.equal(req.headers()['x-csrf-token'],'synthetic-csrf');signedIn=false;logout=true;return route.fulfill({status:204});
  }
  if(url.pathname==='/api/crm/session')return json(signedIn?200:401,signedIn?{active:true,role,actor_id:'synthetic-'+role,expires_at:new Date(Date.now()+120000).toISOString(),csrf_token:'synthetic-csrf'}:{code:'AUTH_REQUIRED'});
  if(url.pathname.startsWith('/api/'))throw Error('UNEXPECTED_API');
  const file=path.resolve(root,'.'+(url.pathname==='/crm'?'/crm.html':url.pathname));assert.ok(file.startsWith(root+'/'));
  try{return route.fulfill({body:await readFile(file),contentType:({'.mjs':'text/javascript','.css':'text/css','.html':'text/html','.woff':'font/woff','.png':'image/png'})[path.extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}
 });
 for(const nextRole of ['OWNER_ADMIN','RECEPTION']){
  role=nextRole;logout=false;await page.goto(origin+'/crm');await page.locator('#crm-login').waitFor({state:'visible'});
  assert.equal(await page.locator('[autocomplete="one-time-code"]').count(),0);
  await page.getByLabel('E-mail',{exact:true}).fill('synthetic@example.test');await page.getByLabel('Heslo',{exact:true}).fill('synthetic-password');
  await page.getByRole('button',{name:'Prihlásiť sa',exact:true}).click();await page.locator('#crm-workspace').waitFor({state:'visible'});
  assert.equal(submitted.email,'synthetic@example.test');assert.equal(await page.locator('#crm-password').inputValue(),'');
  assert.equal(await page.locator('[data-view="staff"]').isVisible(),role==='OWNER_ADMIN');
  assert.equal(await page.getByRole('heading',{name:'Kontrola draftov',exact:true}).count(),role==='OWNER_ADMIN'?1:0);
  assert.equal(await page.getByRole('heading',{name:'Moje dnešné storná draftov',exact:true}).count(),role==='OWNER_ADMIN'?1:0);
  await page.getByRole('button',{name:'Odhlásiť sa',exact:true}).click();await page.getByRole('status').filter({hasText:'Bola si odhlásená.'}).waitFor();assert.ok(logout);
  assert.equal(await page.locator('#crm-content').textContent(),'');assert.equal(await page.locator('#crm-workspace').isVisible(),false);
 }
 assert.deepEqual(await page.evaluate(()=>({local:localStorage.length,session:sessionStorage.length})),{local:0,session:0});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);await page.close();
}console.log('PASS password-only synthetic CRM browser: owner/reception, no MFA input/payload, role-specific staff control, CSRF logout, password/data wipe, no storage/overflow; desktop/tablet.');}finally{await browser.close();}
