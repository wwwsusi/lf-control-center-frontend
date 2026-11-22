import assert from 'node:assert/strict';import test from 'node:test';
import {parseCardCode,cardCode,attachReader,CARD_PREFIX} from '../web/crm-scan.mjs';
const ID='58c6f473-dfbc-4360-ad67-c9b97cd16338';
test('card code round-trips and contains only the client id',()=>{
 assert.equal(cardCode(ID),'LF1:'+ID);assert.equal(parseCardCode(cardCode(ID)),ID);
 assert.equal(parseCardCode(' lf1:'+ID.toUpperCase()+' \n'),ID);
});
test('anything that is not exactly LF1:<uuid> is rejected',()=>{
 for(const v of [null,undefined,'',ID,'LF1:','LF1:123','LF2:'+ID,'LF1:'+ID+'x','https://x.test/?c='+ID,'LF1:'+ID.slice(0,-1)+'g'])assert.equal(parseCardCode(v),null,String(v));
 assert.equal(CARD_PREFIX,'LF1:');
});
function fakeDoc(){const l=[];return {addEventListener:(t,f)=>l.push(f),removeEventListener:(t,f)=>l.splice(l.indexOf(f),1),fire:e=>l.slice().forEach(f=>f({ctrlKey:false,metaKey:false,altKey:false,target:{tagName:'BODY'},preventDefault(){},...e})),count:()=>l.length};}
test('reader picks up a fast burst ending with Enter and ignores slow typing and focused fields',async()=>{
 const doc=fakeDoc(),got=[];const off=attachReader({onCode:id=>got.push(id),doc});
 for(const ch of 'LF1:'+ID)doc.fire({key:ch});doc.fire({key:'Enter'});
 assert.deepEqual(got,[ID]);
 for(const ch of 'LF1:'+ID){doc.fire({key:ch});await new Promise(r=>setTimeout(r,70));}doc.fire({key:'Enter'});assert.equal(got.length,1,'slow typing ignored');
 for(const ch of 'LF1:'+ID)doc.fire({key:ch,target:{tagName:'INPUT'}});doc.fire({key:'Enter',target:{tagName:'INPUT'}});assert.equal(got.length,1,'typing in a field is left to the form');
 off();assert.equal(doc.count(),0);
});
