import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const css=fs.readFileSync(new URL('../web/crm.css',import.meta.url),'utf8');
test('reception type standard defines every token and nothing on a counter screen is below 18px',()=>{
 const tokens=Object.fromEntries([...css.matchAll(/--rc-([a-z]+):([^;}]+)[;}]/g)].map(m=>[m[1],m[2]]));
 for(const name of ['page','box','text','meta','btn','nav','price'])assert.ok(tokens[name],'missing token --rc-'+name);
 for(const [name,value] of Object.entries(tokens)){const px=Number(value.match(/(\d+)px\//)?.[1]);assert.ok(px>=18,'--rc-'+name+' is '+px+'px, minimum is 18px');}
 assert.match(tokens.page,/Oswald/);assert.match(tokens.text,/Inter/);
});
