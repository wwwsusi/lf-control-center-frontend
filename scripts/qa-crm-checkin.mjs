// Actual check-in component; synthetic API only, no external requests.
import {chromium,webkit,expect} from '@playwright/test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const module=await readFile(new URL('../web/crm-checkin.mjs',import.meta.url),'utf8');
const id=n=>'80000000-0000-4000-8000-'+String(n).padStart(12,'0');
const browserType=process.env.LF_UX_BROWSER==='webkit'?webkit:chromium;
const browser=await browserType.launch(process.env.LF_BROWSER_EXECUTABLE?{executablePath:process.env.LF_BROWSER_EXECUTABLE}:{});
try{
 for(const width of [1440,768]){
  const page=await browser.newPage({viewport:{width,height:1024},hasTouch:width===768});let writes=0;const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const url=new URL(route.request().url());assert.equal(url.origin,'https://crm.test');
   if(url.pathname==='/crm-checkin.mjs')return route.fulfill({contentType:'text/javascript',body:module});
   assert.equal(url.pathname,'/');
   await route.fulfill({contentType:'text/html',body:`<meta name="viewport" content="width=device-width"><main id="root"></main><script type="module">
    import {mountCheckin} from '/crm-checkin.mjs';
    const id=n=>'80000000-0000-4000-8000-'+String(n).padStart(12,'0');
    const customer={id:id(1),revision:'1',status:'ACTIVE',name:'Synthetic client'};
    mountCheckin({root:document.querySelector('#root'),customer,onBack(){},onAuthFailure(){throw Error('Unexpected auth failure')},api:async(path,{body}={})=>{
     if(body?.view==='ADMISSIONS')return {items:[{id:id(2),revision:'1',code:'ENTITLEMENT',label_sk:'Permanentka'}]};
     if(body?.view==='CUSTOMER')return {customer,entitlements:[
      {id:id(3),revision:'1',status:'ENABLED',type_at_purchase:'VISIT_COUNT',included_units_at_purchase:'10',consumed:'0',validity_value_at_purchase:6,validity_unit_at_purchase:'MONTH',activated_on:null,expires_on:null},
      {id:id(4),revision:'1',status:'ENABLED',type_at_purchase:'VISIT_COUNT',included_units_at_purchase:'15',consumed:'2',validity_value_at_purchase:6,validity_unit_at_purchase:'MONTH',activated_on:'2026-08-31',expires_on:'2027-03-01'}]};
     if(path==='/api/crm/operations'){await window.recordWrite(body);return {operation:{state:'REJECTED',result_code:'BUSINESS_REJECTED'}};}
     throw Error('Unexpected API route');
    }});
   </script>`});
  });
  await page.exposeFunction('recordWrite',body=>{writes++;assert.equal(body.operation_type,'CHECK_IN');assert.equal(body.payload.customer_id,id(1));assert.equal(body.payload.entitlement_id,id(4));});
  await page.goto('https://crm.test/');
  await expect(page.getByRole('button',{name:/Platnosť 6 mesiacov od prvého vstupu/})).toBeVisible();
  const active=page.getByRole('button',{name:/čerpané 2 \/ 15.*28\. 2\. 2027 vrátane/});await expect(active).toBeVisible();await active.click();
  await expect(page.getByRole('status')).toHaveText('Návšteva nebola uložená. Skontroluj platnosť permanentky, zostávajúce vstupy a pravidlá vstupu.');
  await expect(page.getByRole('button',{name:'Overiť ten istý zápis'})).toHaveCount(0);
  assert.equal(writes,1);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('PASS: actual check-in component at desktop/tablet widths; first-use/expiry labels, canonical customer/entitlement payload and rejected-visit message. Synthetic API only.');
}finally{await browser.close();}
