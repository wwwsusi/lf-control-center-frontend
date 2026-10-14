import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';import {buildPublic} from '../scripts/lib/public-build.mjs';
test('CRM build and direct navigation contain no Control Center modules or data access',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'lf-crm-ui-'));
 try{buildPublic({root:path.resolve(import.meta.dirname,'..'),out,profile:'same-origin'});const crm=fs.readFileSync(path.join(out,'crm/index.html'),'utf8');assert.match(crm,/CRM sa pripravuje/);assert.doesNotMatch(crm,/<(?:script|form|input)\b|dashboard|\/api\/|localStorage|control-center\.html/);assert.equal(crm,fs.readFileSync(path.join(out,'crm.html'),'utf8'));const home=fs.readFileSync(path.join(out,'index.html'),'utf8');assert.match(home,/class="login" href="\.\/crm"/);assert.match(home,/home-actions/);}
 finally{fs.rmSync(out,{recursive:true,force:true});}
});
