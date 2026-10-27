// Actual CRM shell with virtual time and synthetic API. No hosted requests.
import {chromium,webkit,expect} from '@playwright/test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../dist'),engine=process.env.LF_UX_BROWSER||'chromium';
assert.ok(['chromium','webkit'].includes(engine));const browser=await ({chromium,webkit})[engine].launch();
try{
 const page=await browser.newPage(),base=Date.now();let serverNow=base,expires=base+300000,reads=0,polls=0;const errors=[];
 await page.clock.install({time:new Date(base)});page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const u=new URL(route.request().url());assert.equal(u.origin,'https://crm.test');
  const json=(status,body)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(u.pathname==='/api/crm/session'){polls++;return json(200,{active:true,actor_id:'synthetic',role:'RECEPTION',csrf_token:'synthetic',expires_at:new Date(expires).toISOString()});}
  if(u.pathname==='/api/crm/read'){reads++;expires=Math.min(serverNow+300000,base+900000);return json(200,{items:[],next:null,expires_at:new Date(expires).toISOString()});}
  assert.ok(!u.pathname.startsWith('/api/'),'Unexpected API call');
  const file=path.resolve(root,'.'+(u.pathname==='/crm'?'/crm.html':u.pathname));assert.ok(file.startsWith(root+'/'));
  try{return route.fulfill({body:await fs.readFile(file),contentType:({'.html':'text/html','.mjs':'text/javascript','.css':'text/css','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}
 });
 await page.goto('https://crm.test/crm');await expect(page.getByRole('heading',{name:'CRM · Recepcia',exact:true})).toBeVisible();
 await page.clock.pauseAt(new Date(base+1000));serverNow=base+180000;await page.clock.fastForward(179000);
 await page.locator('.crm-card').filter({hasText:'Zoznam klientov'}).getByRole('button',{name:'Otvoriť',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Zoznam klientov',exact:true})).toBeVisible();assert.equal(reads,1);assert.equal(expires,base+480000);
 serverNow=base+301000;await page.clock.fastForward(121000);
 await expect(page.getByRole('heading',{name:'CRM · Recepcia',exact:true})).toBeVisible();
 serverNow=base+481000;await page.clock.fastForward(180000);
 await expect(page.getByRole('heading',{name:'CRM · individuálne prihlásenie',exact:true})).toBeVisible();
 assert.ok(polls>=2);assert.equal(reads,1);assert.equal(expires,base+480000);assert.deepEqual(errors,[]);
 console.log('PASS: authorized activity moves UI expiry, original five-minute timer does not hide active work, background polls do not renew idle.');
}finally{await browser.close();}
