import {chromium,webkit,expect} from '@playwright/test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import {catalogueResponse} from './fixtures/catalogue-cards.mjs';
const engine=process.env.LF_UX_BROWSER||'chromium',browser=await ({chromium,webkit})[engine].launch(),root=path.resolve(import.meta.dirname,'../dist');let scenarios=0;
try{for(const [width,height]of [[1440,1000],[820,1100],[375,900]]){
 const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage(),calls=[],errors=[];let active=true,holdProducts=false,release;
 page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{const u=new URL(route.request().url());assert.equal(u.origin,'https://crm.test');if(u.pathname.startsWith('/api/')){const body=route.request().method()==='POST'?route.request().postDataJSON():null;calls.push({path:u.pathname,body});const json=(status,data)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
 if(u.pathname==='/api/crm/session')return json(active?200:401,active?{active:true,role:'RECEPTION',actor_id:'synthetic',workspace_enabled:true,expires_at:new Date(Date.now()+600000).toISOString(),csrf_token:'synthetic'}:{code:'AUTH_REQUIRED'});
 if(u.pathname==='/api/crm/logout'){active=false;return json(200,{logged_out:true});}
 assert.equal(u.pathname,'/api/crm/read');if(body.view==='SESSION_ACTIVITY')return json(200,{read_only:true,expires_at:new Date(Date.now()+600000).toISOString()});assert.ok(['CATALOGUE','PRODUCT_CATALOGUE'].includes(body.view));if(holdProducts&&body.view==='PRODUCT_CATALOGUE')await new Promise(r=>release=r);return json(200,catalogueResponse(body));}
 const file=path.resolve(root,'.'+(u.pathname==='/crm'?'/crm.html':u.pathname));assert.ok(file.startsWith(root+'/'));try{return route.fulfill({body:await fs.readFile(file),contentType:({'.html':'text/html','.mjs':'text/javascript','.css':'text/css'})[path.extname(file)]||'application/octet-stream'});}catch{return route.fulfill({status:404,body:''});}});
 await page.goto('https://crm.test/crm');
 const open=()=>page.locator('.crm-reception-action').filter({has:page.getByRole('heading',{name:'Cenník',exact:true})}).getByRole('button',{name:'Otvoriť',exact:true}).click();
 const category=async value=>{if(width>1000)await page.getByRole('button',{name:'Časové permanentky · 3',exact:true}).click();else await page.getByLabel('Kategória',{exact:true}).selectOption(value);};
 await open();await expect(page.getByText('Zobrazené 9 z 9 položiek')).toBeVisible();
 await page.locator('[data-item-id="svc-10"] .crm-pin').click();await page.locator('[data-item-id="svc-1"] .crm-pin').click();
 assert.deepEqual(await page.locator('.crm-favorites-section .crm-price-card').evaluateAll(nodes=>nodes.map(n=>n.dataset.itemId)),['svc-10','svc-1']);
 await page.getByRole('button',{name:'Iba obľúbené',exact:true}).click();await expect(page.getByText('Zobrazené 2 z 9 položiek')).toBeVisible();await expect(page.locator('.crm-filter-summary')).toContainText('Iba obľúbené');
 await page.getByRole('button',{name:'Späť na prehľad'}).click();await open();await expect(page.getByText('Zobrazené 2 z 9 položiek')).toBeVisible();
 await page.getByRole('button',{name:'Zobraziť všetko',exact:true}).click();await category('time');await page.getByRole('searchbox').fill('mesacna');await expect(page.locator('.crm-filter-summary')).toContainText('Časové permanentky');
 await expect(page.locator('[data-item-id="svc-ms"] .crm-audience-badge')).toHaveText('Študenti / seniori');await expect(page.locator('[data-item-id="svc-ms"] .crm-price-detail')).toContainText('60 rokov');
 await page.getByRole('button',{name:'Produkty',exact:true}).click();await expect(page.getByText('Zobrazené 5 z 5 položiek')).toBeVisible();await page.locator('[data-item-id="p3"] .crm-pin').click();await page.getByRole('searchbox').fill('vanilka');await expect(page.getByText('Zobrazené 1 z 5 položiek')).toBeVisible();
 await page.getByRole('button',{name:'Služby',exact:true}).click();await expect(page.getByRole('searchbox')).toHaveValue('mesacna');await expect(page.getByText('Zobrazené 3 z 9 položiek')).toBeVisible();
 await page.getByRole('button',{name:'Späť na prehľad'}).click();await open();await expect(page.getByRole('searchbox')).toHaveValue('mesacna');await expect(page.getByText('Zobrazené 3 z 9 položiek')).toBeVisible();
 await page.getByRole('button',{name:'Zobraziť všetko',exact:true}).click();await expect(page.locator('.crm-favorites-section .crm-price-card')).toHaveCount(2);
 await fs.mkdir('qa-artifacts/reception-usability',{recursive:true});await page.screenshot({path:`qa-artifacts/reception-usability/${engine}-favorites-${width}.png`,fullPage:true});
 if(width===820){await page.evaluate(()=>window.scrollTo(0,1200));await expect.poll(async()=>Math.round((await page.locator('.crm-catalogue-tools').boundingBox()).y)).toBe(8);await page.screenshot({path:`qa-artifacts/reception-usability/${engine}-sticky-tablet.png`});}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.locator('#crm-logout').click();await expect(page.locator('#crm-workspace')).toBeHidden();active=true;await page.locator('#crm-refresh').click();await open();await expect(page.locator('.crm-favorites-section')).toHaveCount(0);await expect(page.getByRole('searchbox')).toHaveValue('');
 assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>[localStorage.length,sessionStorage.length]),[0,0]);assert.ok(calls.every(c=>['/api/crm/session','/api/crm/read','/api/crm/logout'].includes(c.path)));scenarios++;await context.close();
}console.log(JSON.stringify({status:'PASS',engine,scenarios,favorites_temporary:true,filters_restored:true,audience_badges:true,sticky_tablet:true,logout_clears_preferences:true,business_writes:0}));}finally{await browser.close();}
