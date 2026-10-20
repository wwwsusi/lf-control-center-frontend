import test from 'node:test';
import assert from 'node:assert/strict';
import {loginFailureMessage} from '../web/connection.mjs';
test('known session capacity error explains the limit and recovery in Slovak',async()=>{
 const text=await loginFailureMessage(Response.json({code:'SESSION_LIMIT_REACHED',error:'untrusted provider diagnostic'},{status:409}));
 assert.match(text,/najviac 5/);assert.match(text,/Odhlás/);assert.match(text,/vyprší/);assert.ok(!text.includes('diagnostic'));
});
test('unknown or malformed conflict and other failures retain sanitized HTTP fallback',async()=>{
 for(const response of [Response.json({code:'OTHER',error:'SECRET'},{status:409}),new Response('SECRET',{status:409}),Response.json(null,{status:409}),Response.json({code:'SESSION_LIMIT_REACHED',error:'SECRET'},{status:503})]){
  assert.equal(await loginFailureMessage(response),'Prihlásenie zlyhalo: HTTP '+response.status);
 }
});
