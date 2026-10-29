import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {connectionProfile,resolveEndpoint,viewerOptions} from '../web/connection.mjs';import {buildPublic} from '../scripts/lib/public-build.mjs';
test('same-origin profile locks all endpoints to relative paths and cookie credentials; Pages profile stays compatible',()=>{
 const profile=connectionProfile({connectionMode:'same-origin'});assert.equal(resolveEndpoint('https://untrusted.example',profile),'');assert.deepEqual(viewerOptions(profile,'ignored-short-token'),{credentials:'include',headers:{}});
 for(const route of ['login','dashboard','logout','inventory','events'])assert.equal(resolveEndpoint('',profile)+'/api/'+route,'/api/'+route);
 assert.throws(()=>connectionProfile({connectionMode:'same-origin',eventServiceUrl:'https://remote.example'}));
 const remote=connectionProfile({});assert.equal(resolveEndpoint('https://legacy.example',remote),'https://legacy.example');assert.deepEqual(viewerOptions(remote,'legacy'),{credentials:'omit',headers:{Authorization:'Bearer legacy'}});
});
test('same-origin public build removes remote API configuration, includes no snapshots and shares the Pages build allowlist',()=>{
 const root=path.resolve(import.meta.dirname,'..'),temp=fs.mkdtempSync(path.join(os.tmpdir(),'lf-shell-'));try{
  const own=buildPublic({root,out:path.join(temp,'own'),profile:'same-origin'}),pages=buildPublic({root,out:path.join(temp,'pages')});
  assert.deepEqual(fs.readdirSync(own),fs.readdirSync(pages));const config=JSON.parse(fs.readFileSync(path.join(own,'config.json')));assert.equal(config.connectionMode,'same-origin');assert.equal(config.eventServiceUrl,'');assert.deepEqual(config.googlePicker,{clientId:'',apiKey:'',appId:''});
  const graph=JSON.parse(fs.readFileSync(path.join(own,'data/graph.json')));assert.deepEqual(graph.nodes,[]);assert.deepEqual(graph.edges,[]);
  for(const file of fs.readdirSync(own).filter(f=>/\.(mjs|json|html|css)$/.test(f)))assert.doesNotMatch(fs.readFileSync(path.join(own,file),'utf8'),/lf-interactive-file-map-service\.vercel\.app|SUPABASE_SERVICE_ROLE_KEY|SYNTHETIC_PRIVATE_SENTINEL/);
  assert.match(fs.readFileSync(path.join(own,'index.html'),'utf8'),/href="\.\/crm"><strong>CRM recepcia/);
  assert.doesNotMatch(fs.readFileSync(path.join(pages,'index.html'),'utf8'),/CRM recepcia|LF_PRIVATE_CRM_ENTRY/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(pages,'config.json'))).eventServiceUrl,'https://lf-interactive-file-map-service.vercel.app');
 }finally{fs.rmSync(temp,{recursive:true,force:true});}
});
