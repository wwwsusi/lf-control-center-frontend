// Local synthetic QA; landing makes no requests for private data.
import {chromium,webkit} from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'../dist');
const types={'.html':'text/html','.css':'text/css','.png':'image/png','.woff':'font/woff','.mjs':'text/javascript','.json':'application/json'};
const browserName=process.env.LF_UX_BROWSER||'chromium';const browserType={chromium,webkit}[browserName];if(!browserType)throw Error('Unsupported synthetic QA browser: '+browserName);const browser=await browserType.launch();const base='https://landing.test';const out=path.resolve(import.meta.dirname,'../qa-artifacts/home/'+browserName);await fs.mkdir(out,{recursive:true});
try{for(const [name,viewport] of [['desktop',{width:1440,height:1000}],['mobile',{width:390,height:844}]]){
 const page=await browser.newPage({viewport,reducedMotion:'reduce'});const requests=[],errors=[];
 await page.route('https://landing.test/**',async route=>{try{const p=new URL(route.request().url()).pathname;const f=path.resolve(root,'.'+(p==='/'?'/index.html':p));if(!f.startsWith(root+path.sep))throw Error('path');await route.fulfill({contentType:types[path.extname(f)]||'application/octet-stream',body:await fs.readFile(f)});}catch{await route.fulfill({status:404,body:''});}});
 page.on('request',r=>requests.push(r.url()));page.on('pageerror',e=>errors.push(e.message));await page.goto(base);await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('img').evaluate(e=>e.complete&&e.naturalWidth>0),true);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 assert.equal(await page.locator('h1').evaluate(e=>getComputedStyle(e).fontFamily.includes('Oswald')),true);
 assert.equal(await page.locator('.login').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
 await page.keyboard.press('Tab');await page.keyboard.press('Tab');assert.equal(await page.locator('.login').evaluate(e=>e===document.activeElement),true);
 assert(!requests.some(u=>/\/api\/|app\.mjs/.test(u)));assert.deepEqual(errors,[]);
 await page.screenshot({path:path.join(out,name+'.png'),fullPage:true});
 await page.keyboard.press('Enter');await page.waitForURL('**/control-center.html');assert.equal(await page.locator('#connection-dialog').count(),1);await page.waitForFunction(()=>typeof window.lfDashboardDiagnostics==='function');assert.deepEqual(errors,[]);await page.close();
 console.log(name+': PASS logo/fonts/responsiveness/keyboard/reduced-motion/no private request/navigation');
}}finally{await browser.close();}
