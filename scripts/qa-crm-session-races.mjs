// Synthetic delayed responses only; no deployed login or real staff/customer data.
import {chromium,webkit} from '@playwright/test';
import fs from 'node:fs/promises';import path from 'node:path';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../dist'),base='https://crm.test';
const browser=await (process.env.LF_UX_BROWSER==='webkit'?webkit:chromium).launch();
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
try{
 async function fixture(){
  const page=await browser.newPage();let role='OWNER_ADMIN';const pending={};
  await page.route(base+'/**',async route=>{
   const url=new URL(route.request().url()),method=route.request().method();
   const json=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(url.pathname==='/api/crm/session')return json(200,{active:true,actor_id:'synthetic-owner',role,expires_at:new Date(Date.now()+120000).toISOString(),csrf_token:'synthetic-csrf'});
   if(url.pathname==='/api/crm/staff'&&method==='GET')return json(200,{items:[{actor_id:'synthetic-reception',role:'RECEPTION',active:true}],next:null});
   if(url.pathname==='/api/crm/logout'||url.pathname==='/api/crm/login'||(url.pathname==='/api/crm/staff'&&method==='POST')){
    const gate=pending[url.pathname];gate?.started.resolve();const outcome=gate?await gate.finish.promise:{status:200,data:{}};
    if(outcome.status===204)return route.fulfill({status:204});return json(outcome.status,outcome.data);
   }
   try{const file=path.resolve(root,'.'+(url.pathname==='/crm'?'/crm.html':url.pathname));if(!file.startsWith(root+'/'))throw Error();return route.fulfill({body:await fs.readFile(file),contentType:({'.mjs':'text/javascript','.html':'text/html','.css':'text/css'})[path.extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}
  });
  page.on('dialog',dialog=>dialog.accept());await page.goto(base+'/crm');await page.locator('#crm-workspace').waitFor({state:'visible'});
  const delay=url=>pending[url]={started:deferred(),finish:deferred()};
  return {page,delay,setRole:value=>role=value};
 }
 const hidden=async page=>{assert.equal(await page.locator('#crm-workspace').isVisible(),false);assert.equal(await page.locator('#crm-content').textContent(),'');};
 // Logout must hide sensitive projections before the server acknowledges revocation.
 {
  const {page,delay}=await fixture(),gate=delay('/api/crm/logout');await page.getByRole('button',{name:'Odhlásiť sa',exact:true}).click();await gate.started.promise;
  await hidden(page);gate.finish.resolve({status:204});await page.getByRole('status').filter({hasText:'Bola si odhlásená.'}).waitFor();await page.close();
 }
 // A late successful staff mutation cannot reopen staff details over a newer view.
 {
  const {page,delay}=await fixture();await page.getByRole('button',{name:'Správa prístupov',exact:true}).click();await page.getByRole('button',{name:'Deaktivovať prístup'}).waitFor();
  const gate=delay('/api/crm/staff');await page.getByRole('button',{name:'Deaktivovať prístup'}).click();await gate.started.promise;
  await page.getByRole('button',{name:'Reporting',exact:true}).click();gate.finish.resolve({status:200,data:{staff:{active:false}}});
  await page.waitForTimeout(100);assert.equal(await page.getByRole('heading',{name:'Reporting',exact:true}).count(),1);assert.equal(await page.getByText('ID zamestnankyne:',{exact:false}).count(),0);await page.close();
 }
 // Auth denial during mutation immediately clears the old authorized workspace.
 {
  const {page,delay}=await fixture();await page.getByRole('button',{name:'Správa prístupov',exact:true}).click();await page.getByRole('button',{name:'Deaktivovať prístup'}).waitFor();
  const gate=delay('/api/crm/staff');await page.getByRole('button',{name:'Deaktivovať prístup'}).click();await gate.started.promise;gate.finish.resolve({status:401,data:{code:'AUTH_REQUIRED'}});
  await page.locator('#crm-workspace').waitFor({state:'hidden'});await hidden(page);await page.close();
 }
 // A login response arriving after an explicit hide must not reopen the workspace.
 {
  const {page,delay}=await fixture();await page.getByRole('button',{name:'Skryť údaje',exact:true}).click();
  await page.getByLabel('E-mail',{exact:true}).fill('synthetic@example.test');await page.getByLabel('Heslo',{exact:true}).fill('synthetic-password');
  const gate=delay('/api/crm/login');await page.getByRole('button',{name:'Prihlásiť sa',exact:true}).click();await gate.started.promise;
  await page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));gate.finish.resolve({status:200,data:{active:true,csrf_token:'synthetic-csrf'}});
  await page.waitForTimeout(100);await hidden(page);await page.close();
 }
 console.log('Synthetic delayed logout, staff response isolation, auth denial and hidden-login races PASS');
}finally{await browser.close();}
