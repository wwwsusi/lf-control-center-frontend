import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const js=fs.readFileSync(new URL('../web/crm.mjs',import.meta.url),'utf8');
test('R1 hides the permanentka entry on the arrival screen until R2 enables it',()=>{
 assert.match(js,/const PERMANENTKY_ENABLED=false;/);
 assert.match(js,/if\(PERMANENTKY_ENABLED\)grid\.append\(choice\('Má permanentku'/);
 assert.ok(!/grid\.append\(choice\('Má permanentku'/.test(js.replace(/if\(PERMANENTKY_ENABLED\)grid\.append\(choice\('Má permanentku'/,'')),'no unconditional permanentka card');
 assert.match(js,/'crm-choice-grid crm-choice-grid-'\+\(PERMANENTKY_ENABLED\?3:2\)/);
});
