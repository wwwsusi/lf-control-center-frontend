import test from 'node:test';
import assert from 'node:assert/strict';
import {IDLE_LIMIT_MS,idleRemaining,isTrustedUserActivity} from '../web/crm-session-idle.mjs';

test('idle timeout is exactly fifteen minutes and expires at the boundary',()=>{
 const last=1_800_000_000_000;
 assert.equal(IDLE_LIMIT_MS,900_000);
 assert.equal(idleRemaining(last,last),900_000);
 assert.equal(idleRemaining(last,last+899_999),1);
 assert.equal(idleRemaining(last,last+900_000),0);
});

test('invalid activity timestamps never extend a session',()=>{
 for(const value of [undefined,null,NaN,Infinity,0,-1])assert.equal(idleRemaining(value,100),0);
 assert.equal(idleRemaining(100,NaN),0);
});

test('only browser-trusted activity events count',()=>{
 assert.equal(isTrustedUserActivity({isTrusted:true}),true);
 for(const event of [undefined,{},null,{isTrusted:false},{isTrusted:1}])assert.equal(isTrustedUserActivity(event),false);
});
