import fs from 'node:fs';import path from 'node:path';
export const PUBLIC_FILES=['index.html','crm.html','crm.css','crm.mjs','control-center.html','home.css','assets/lady-fitness-logo.png','app.mjs','connection.mjs','model.mjs','dashboard.mjs','ux-model.mjs','ux.mjs','status-model.mjs','operational.mjs','dashboard-model.mjs','dashboard-demo.mjs','reporting.mjs','live-report.mjs','snapshot.mjs','style.css','README.html','config.json'];
export const FONT_FILES=['Inter.woff','Oswald.woff','OFL.txt'];
export function buildPublic({root,out=path.join(root,'dist'),profile='pages'}){
 if(!['pages','same-origin'].includes(profile))throw Error('Unsupported build profile');
 root=path.resolve(root);out=path.resolve(out);if(root===out||root.startsWith(out+path.sep)||out.startsWith(path.join(root,'web')+path.sep)||out===path.join(root,'web'))throw Error('Unsafe build destination');
 fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.join(out,'data'),{recursive:true});fs.mkdirSync(path.join(out,'assets'),{recursive:true});
 for(const f of PUBLIC_FILES)fs.copyFileSync(path.join(root,'web',f),path.join(out,f));
 fs.mkdirSync(path.join(out,'fonts'),{recursive:true});for(const f of FONT_FILES)fs.copyFileSync(path.join(root,'web/fonts',f),path.join(out,'fonts',f));
 if(profile==='same-origin')fs.writeFileSync(path.join(out,'config.json'),JSON.stringify({connectionMode:'same-origin',eventServiceUrl:'',scope:'Same-origin · prihlásená read-only služba; bez globálneho sledovania Codex.'}));
 fs.writeFileSync(path.join(out,'data/graph.json'),JSON.stringify({schema_version:1,nodes:[],edges:[],coverage:{original_imported:false,scope:'Verejný shell bez interných dát.'}}));
 fs.mkdirSync(path.join(out,'crm'),{recursive:true});fs.copyFileSync(path.join(root,'web/crm.html'),path.join(out,'crm/index.html'));
 fs.writeFileSync(path.join(out,'.nojekyll'),'');return out;
}

