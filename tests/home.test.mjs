import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
test('Landing is static and routes to the preserved authenticated Control Center',()=>{
 const home=fs.readFileSync(new URL('../web/index.html',import.meta.url),'utf8');
 assert(home.includes('href="./control-center.html"'));
 assert(home.includes('assets/lady-fitness-logo.png'));
 assert(!/<(?:script|input|form)\b/i.test(home));
 const app=fs.readFileSync(new URL('../web/control-center.html',import.meta.url),'utf8');
 assert(app.includes('id="connection-dialog"'));
 assert(app.includes('type="password"'));
 assert(app.includes('src="./app.mjs'));
});
