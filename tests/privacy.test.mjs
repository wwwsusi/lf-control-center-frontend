import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import '../scripts/build.mjs';
test('Public artifact contains no inventory; build ignores an injected graph',()=>{
 const root=path.resolve(import.meta.dirname,'..'),data=JSON.parse(fs.readFileSync(path.join(root,'dist/data/graph.json')));
 assert.equal(data.nodes.length,0);assert.equal(data.edges.length,0);
 assert.deepEqual(fs.readdirSync(path.join(root,'dist')).sort(),['.nojekyll','README.html','app.mjs','connection.mjs','config.json','data','fonts','index.html','model.mjs','dashboard.mjs','ux-model.mjs','ux.mjs','status-model.mjs','operational.mjs','dashboard-model.mjs','dashboard-demo.mjs','reporting.mjs','live-report.mjs','snapshot.mjs','style.css'].sort());
 for(const name of ['data-private','private-data','.runtime','reference','server','sources'])assert.equal(fs.existsSync(path.join(root,'dist',name)),false);
});
test('Dashboard build ignores a synthetic private payload and retains only allowlisted fonts',async()=>{
 const root=path.resolve(import.meta.dirname,'..'),sentinel=path.join(root,'web/dashboard-private.json');
 try{fs.writeFileSync(sentinel,'{"private":"SYNTHETIC_PRIVATE_SENTINEL"}');await import('../scripts/build.mjs?privacy-sentinel');assert.equal(fs.existsSync(path.join(root,'dist/dashboard-private.json')),false);assert.deepEqual(fs.readdirSync(path.join(root,'dist/fonts')).sort(),['Inter.woff','OFL.txt','Oswald.woff'].sort());for(const file of fs.readdirSync(path.join(root,'dist')).filter(f=>/\.(mjs|html|json|css)$/.test(f)))assert.equal(fs.readFileSync(path.join(root,'dist',file),'utf8').includes('SYNTHETIC_PRIVATE_SENTINEL'),false);}finally{fs.rmSync(sentinel,{force:true});}
});
