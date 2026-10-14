import {chromium,webkit} from '@playwright/test';
import assert from 'node:assert/strict';
import http from 'node:http';import fs from 'node:fs/promises';import path from 'node:path';
const root=path.resolve(import.meta.dirname,'../dist');
const server=http.createServer(async(req,res)=>{try{let pathname=new URL(req.url,'http://localhost').pathname;if(pathname==='/crm'||pathname==='/crm/')pathname='/crm.html';if(pathname==='/')pathname='/index.html';const file=path.resolve(root,'.'+pathname);if(!file.startsWith(root+'/'))throw Error();const bytes=await fs.readFile(file);res.setHeader('Content-Type',({'.html':'text/html','.css':'text/css','.woff':'font/woff'})[path.extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.writeHead(404).end();}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
const type=process.env.LF_UX_BROWSER==='webkit'?webkit:chromium;let browser;
try{browser=await type.launch();for(const viewport of [{width:1440,height:900},{width:768,height:1024},{width:1024,height:768},{width:375,height:812}]){
 const page=await browser.newPage({viewport});let apiCalls=0;page.on('request',r=>{if(r.url().includes('/api/'))apiCalls++;});await page.goto(base);await page.evaluate(()=>document.fonts.ready);
 const styles=await page.locator('.home-actions .login').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect(),s=getComputedStyle(el);return {w:r.width,h:r.height,color:s.backgroundColor,font:s.fontFamily,size:s.fontSize,weight:s.fontWeight};}));assert.equal(styles.length,2);assert.deepEqual(styles[0],styles[1]);assert.equal(styles[0].color,'rgb(237, 13, 91)');
 await page.getByRole('link',{name:'CRM',exact:true}).click();await page.getByRole('heading',{name:'CRM sa pripravuje'}).waitFor();await page.reload();assert.equal(await page.locator('script,input,form').count(),0);assert.equal(apiCalls,0);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.close();
 }console.log('CRM responsive parity, direct navigation/reload and data isolation PASS');}finally{await browser?.close();server.close();}
