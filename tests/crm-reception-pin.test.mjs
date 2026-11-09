import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const html=fs.readFileSync(new URL('../web/crm.html',import.meta.url),'utf8'),js=fs.readFileSync(new URL('../web/crm.mjs',import.meta.url),'utf8');
test('reception PIN controls live inside the login form so they share its visibility',()=>{
 const form=html.match(/<form id="crm-login"[\s\S]*?<\/form>/)[0];
 for(const id of ['crm-pin-open','crm-pin-pad','crm-pin-dots','crm-pin-keys'])assert.ok(form.includes(`id="${id}"`),id);
 assert.match(form,/id="crm-pin-open" type="button"/);
});
test('PIN login posts exactly {pin} to the existing login endpoint and nothing else',()=>{
 assert.ok(js.includes("api('/api/crm/login',{body:{pin}})"));
 assert.ok(/\/\^\\d\{6\}\$\//.test(js),'six-digit guard');
});
test('PIN is never persisted and is cleared on failure, reset and wipe',()=>{
 const pinCode=js.split('\n').filter(l=>/pin/i.test(l)).join('\n');
 assert.ok(!/localStorage|sessionStorage|indexedDB|document\.cookie/.test(pinCode));
 assert.ok(js.includes("catch(error){if(version!==epoch)return;pinDigits='';pinRender();"));
 assert.ok(js.includes("byId('crm-password').value='';resetPin();"));
});
test('PIN error messages are specific and do not reveal account details',()=>{
 for(const code of ['AUTH_REQUIRED','RATE_LIMITED','POLICY_BLOCKED'])assert.ok(new RegExp(`pinLabels=\\{[^}]*${code}:`).test(js),code);
 assert.ok(!/recepcia-|@/.test(js.match(/const pinLabels=\{[^}]*\}/)[0]));
});
