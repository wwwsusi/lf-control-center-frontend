import test from 'node:test';
import assert from 'node:assert/strict';
import {IDLE_LIMIT_MS,idleRemaining,isTrustedUserActivity,formatIdleRemaining,idleState,logoutRemaining} from '../web/crm-session-idle.mjs';

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

test('countdown is formatted as m:ss and rounds up so it never shows 0:00 while time remains',()=>{
 assert.equal(formatIdleRemaining(IDLE_LIMIT_MS),'15:00');
 assert.equal(formatIdleRemaining(IDLE_LIMIT_MS-1),'15:00');
 assert.equal(formatIdleRemaining(61_000),'1:01');
 assert.equal(formatIdleRemaining(59_001),'1:00');
 assert.equal(formatIdleRemaining(1),'0:01');
 for(const value of [0,-5,NaN,undefined,Infinity*0])assert.equal(formatIdleRemaining(value),'0:00');
});

test('countdown turns to warning at three minutes and to danger at one minute',()=>{
 assert.equal(idleState(IDLE_LIMIT_MS),'ok');
 assert.equal(idleState(180_001),'ok');
 assert.equal(idleState(180_000),'warn');
 assert.equal(idleState(60_001),'warn');
 assert.equal(idleState(60_000),'danger');
 assert.equal(idleState(0),'danger');
 assert.equal(idleState(NaN),'danger');
});

test('logout countdown is the earlier of inactivity limit and server expiry',()=>{
 const now=1_800_000_000_000;
 assert.equal(logoutRemaining(now,now+3_600_000,now),IDLE_LIMIT_MS);
 assert.equal(logoutRemaining(now,now+120_000,now),120_000);
 assert.equal(logoutRemaining(0,now+300_000,now),300_000);
 assert.equal(logoutRemaining(now-60_000,0,now),IDLE_LIMIT_MS-60_000);
 assert.equal(logoutRemaining(now,now-1,now),0);
 assert.equal(logoutRemaining(0,0,now),null);
 assert.equal(logoutRemaining(NaN,NaN,now),null);
});
