import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const html=fs.readFileSync(new URL('../web/crm.html',import.meta.url),'utf8'),js=fs.readFileSync(new URL('../web/crm.mjs',import.meta.url),'utf8');
test('login offers two choices; the PIN keypad is its own section and the admin form keeps the classic fields',()=>{
 for(const id of ['crm-login-choice','crm-choice-reception','crm-choice-admin','crm-login-reception','crm-pin-dots','crm-pin-keys','crm-pin-back','crm-login-back'])assert.ok(html.includes(`id="${id}"`),id);
 const form=html.match(/<form id="crm-login"[\s\S]*?<\/form>/)[0];
 for(const id of ['crm-email','crm-password','crm-mfa','crm-login-submit'])assert.ok(form.includes(`id="${id}"`),id);
 assert.ok(!form.includes('crm-pin-keys'),'PIN keypad is not inside the admin form');
 assert.ok(html.includes('id="crm-access-actions" hidden'));
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

test('the Today view offers the day-opening button to owner and reception only in day mode',()=>{
 const today=js.split('\n').find(l=>l.startsWith('function today('));
 assert.ok(today.includes("if(role==='OWNER_ADMIN'||role==='RECEPTION'){purchase?.dispose();purchase=mountOwner({root:content,api,onAuthFailure:code=>wipe(labels[code]),mode:'day'"));
 // the other owner modes stay owner-only
 assert.ok(js.includes("function openOwner(mode){if(!active||role!=='OWNER_ADMIN')return;"));
});
