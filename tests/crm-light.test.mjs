import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {generate,lightColor,lightRule,toHsl,parseColor,BEGIN,END} from '../scripts/gen-crm-light.mjs';

const read=f=>fs.readFile(new URL('../'+f,import.meta.url),'utf8');
const lum=h=>{const {r,g,b}=parseColor(h);const c=[r,g,b].map(v=>v/255).map(x=>x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4);return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];};
const contrast=(a,b)=>{const [x,y]=[lum(a),lum(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};

test('the generated light block in crm.css is up to date',async()=>{
 const css=await read('web/crm.css'),a=css.indexOf(BEGIN),b=css.indexOf(END);
 assert.ok(a>0&&b>a,'markers present');
 const sources={};for(const f of ['web/home.css','web/crm.css','web/crm-control-center.css','web/crm-body.css','web/crm-packages.css'])sources[f]=await read(f);
 assert.equal(css.slice(a,b+END.length),generate(f=>sources[f]),'run: node scripts/gen-crm-light.mjs');
});

test('light mapping: dark surfaces turn light, light text turns dark and stays readable',()=>{
 for(const surface of ['#0f1d30','#15243a','#192a40','#142238','#233953']){
  const bg=lightColor(surface,'surface');assert.ok(toHsl(parseColor(bg)).l>0.88,surface+' -> '+bg);
  for(const text of ['#ffffff','#edf2fa','#a4b2c6','#c7d2e3','#64d8df','#9ae1c0','#ff9ca8','#f3ce89']){
   const fg=lightColor(text,'text');assert.ok(fg,text+' is remapped');assert.ok(contrast(fg,bg)>=4.5,`${text} on ${surface}: ${fg} on ${bg} = ${contrast(fg,bg).toFixed(2)}`);
  }
 }
});

test('brand buttons keep their colour and white text; print cards and the printed report are untouched',()=>{
 assert.equal(lightColor('#ed0d5b','surface'),null);
 assert.equal(lightColor('#ffffff','surface'),null);
 assert.equal(lightRule({selector:'.x[aria-pressed=true]',body:'background:var(--pink);color:#fff;border-color:var(--pink)'}),'html[data-theme=light] .x[aria-pressed=true]{background:var(--pink);color:#fff;border-color:var(--pink)}','brand state is repeated unchanged so it still wins');
 assert.equal(lightRule({selector:'.y',body:'padding:4px;margin:0'}),null);
 assert.equal(lightRule({selector:'.y',body:'--rep-cols:4;--rep-text:Inter,sans-serif'}),null,'non-colour tokens are ignored');
 assert.match(lightRule({selector:'.cc',body:'--paper:#101b2b;--ink:#edf2fa;--pink:#ff6398'}),/^html\[data-theme=light\] \.cc\{--paper:#f[0-9a-f]{5};--ink:#[0-3][0-9a-f]{5}\}$/,'surface tokens turn light, text tokens dark, brand pink is left alone');
 assert.equal(lightRule({selector:'.pc-card',body:'background:#101010;color:#ffffff'}),null);
 assert.equal(lightRule({selector:'.lf-report .title',body:'color:#ffffff'}),null);
 assert.match(lightRule({selector:'.a,.b',body:'background:#15243a;color:#edf2fa'}),/^html\[data-theme=light\] \.a,html\[data-theme=light\] \.b\{background:#[0-9a-f]{6};color:#[0-9a-f]{6}\}$/);
});

test('the CRM offers the switch and stores nothing',async()=>{
 const html=await read('web/crm.html'),js=await read('web/crm.mjs');
 assert.match(html,/id="crm-theme"[^>]*aria-pressed="false"/);
 assert.match(js,/getElementById\('crm-theme'\)/);
 assert.doesNotMatch(js,/localStorage|sessionStorage|document\.cookie/);
});
