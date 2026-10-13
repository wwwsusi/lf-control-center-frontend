// Browser QA only: synthetic DTO; no live business data, server credentials or deployment.
import {chromium,webkit} from '@playwright/test';
import {fixture,item} from '../tests/fixtures/ux-v2.mjs';
import {demoProjection} from '../web/dashboard-demo.mjs';
import {pragueToday,addDays} from '../web/ux-model.mjs';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
const browserName=process.env.LF_UX_BROWSER||'chromium';
const browserType={chromium,webkit}[browserName];
if(!browserType)throw Error('Unsupported synthetic QA browser: '+browserName);
const root=path.resolve(import.meta.dirname,'../dist'),out=path.resolve(import.meta.dirname,'../qa-artifacts',browserName);
await fs.mkdir(out,{recursive:true});
const types={'.mjs':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.woff':'font/woff'};
const server=http.createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));if(!file.startsWith(root+path.sep))throw Error('path');const bytes=await fs.readFile(file);res.setHeader('Content-Type',types[path.extname(file)]||'application/octet-stream');res.end(bytes);}catch{res.statusCode=404;res.end();}});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
const assert=(value,message)=>{if(!value)throw Error(message);};
const data=fixture(),today=pragueToday();
data.items.find(i=>i.id==='t1').fields={task_description:('Long description text with preserved line breaks.\n').repeat(30),...data.items.find(i=>i.id==='t1').fields};
data.items.find(i=>i.id==='t2').fields.task_description='  ';
data.items.find(i=>i.id==='t3').fields.task_description='Short description';
// Synthetic registry metadata tests colors independently of real business records.
data.status_catalog.colors=['neutral','warning','info','danger','success','none'].map(color_key=>({color_key,label_sk:color_key,meaning:'Synthetic '+color_key}));
for(const domain of data.status_catalog.domains)domain.label_sk=domain.domain==='work'?'Stav práce':'Stav kampane';
for(const def of data.status_catalog.definitions){def.color_key=({IN_PROGRESS:'info',PUBLISHED:'info',PREPARING:'warning',IN_REVIEW:'warning',BLOCKED:'danger',COMPLETED:'success',CANCELLED:'neutral',NOT_STARTED:'neutral'})[def.code]||'neutral';def.sort_order=({NOT_STARTED:10,PREPARING:20,IN_PROGRESS:30,BLOCKED:40,COMPLETED:50,CANCELLED:60})[def.code]||0;}
data.generated_at=new Date().toISOString();data.backend_read_at=data.generated_at;
data.items.find(i=>i.id==='t1').fields.due_date=today;data.items.find(i=>i.id==='t2').fields.due_date=addDays(today,5);data.items.find(i=>i.id==='t3').fields.due_date=addDays(today,-1);data.items.find(i=>i.id==='c1').fields.launch_date=today;
data.items.push(item('legacy-fb-task','task',{task_status:'PREPARING',priority:'P1',category:'LF FB kampaň / FB post',next_step:'Synthetic legacy FB work'}));
for(let index=0;index<18;index++)data.items.push(item('many-'+index,'campaign',{status:'PUBLISHED',launch_date:today,owner:index%2?'Synthetic owner':null,next_step:'Synthetic next step'}));
for(let index=0;index<4;index++)data.items.push(item('due-extra-'+index,'task',{task_status:'IN_PROGRESS',category:'STAFF',due_date:today}));
for(const id of ['t2','t3','t4','t6'])data.items.find(i=>i.id===id).related_ids=['c1'];
for(let index=0;index<5;index++){const asset=item('board-file-'+index,'asset',{is_final:index===0});asset.title='Synthetic board file '+index;asset.related_ids=[index%2?'t2':'c1'];asset.links=index===4?[]:[{url:'https://drive.google.com/file/d/synthetic-'+index+'/view'}];data.items.push(asset);}
const browser=await browserType.launch();const errors=[],results=[];let calls=0,logout=0,failed=false,authorized=true;
async function setup(viewport,storageMode=null){
 const context=await browser.newContext({viewport});
 if(storageMode==='blocked')await context.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new Error('Synthetic unavailable storage');}});});
 else if(storageMode==='corrupt')await context.addInitScript(()=>localStorage.setItem('lf-control-center:ux-v2:columns:offers','{oops'));
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/config.json',route=>route.fulfill({json:{connectionMode:'same-origin',eventServiceUrl:'',scope:'Synthetic browser QA'}}));
 await page.route('**/api/**',async route=>{const url=new URL(route.request().url());if(url.pathname==='/api/dashboard'){calls++;assert(!route.request().headers().authorization,'No browser bearer for dashboard');await route.fulfill({status:authorized?(failed?502:200):401,json:authorized&&!failed?data:{error:'Synthetic failure'}});}else if(url.pathname==='/api/logout'){assert(route.request().method()==='POST','Logout server POST');logout++;authorized=false;await route.fulfill({json:{ok:true}});}else await route.fulfill({json:{nodes:[],edges:[],ok:true}});});
 await page.goto(base+'/control-center.html');await page.waitForFunction(()=>window.lfDashboardDiagnostics?.().mode==='LIVE SUPABASE');
 return {context,page};
}
const nav=async(page,label)=>{await page.locator('#dashboard-nav').getByRole('button',{name:label,exact:true}).click();};
const noOverflow=async(page)=>{const sizes=await page.evaluate(()=>({width:innerWidth,body:document.documentElement.scrollWidth}));assert(sizes.body<=sizes.width+1,'Unwanted layout overflow '+JSON.stringify(sizes));const overlaps=await page.locator('header button:not([hidden])').evaluateAll(nodes=>{const boxes=nodes.map(n=>n.getBoundingClientRect());return boxes.some((a,i)=>boxes.some((b,j)=>j>i&&Math.min(a.right,b.right)-Math.max(a.left,b.left)>1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>1));});assert(!overlaps,'Header controls overlap');};
const verifyContrast=async page=>{const failures=await page.evaluate(()=>{
 const rgb=value=>(value.match(/[\d.]+/g)||[]).map(Number),luminance=c=>c.slice(0,3).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;}).reduce((sum,v,index)=>sum+v*[.2126,.7152,.0722][index],0);
 const selectors='.ux-summary-row h3,.ux-counts dt,.ux-counts dd,.ux-item .dash-badge,.ux-calendar time,.ux-calendar-event,.ux-calendar-more summary,.ux-long-text summary,.ux-column-row label,.ux-entities .report-table th';
 return [...document.querySelectorAll(selectors)].filter(n=>n.getBoundingClientRect().height>0).flatMap(n=>{const style=getComputedStyle(n),fg=rgb(style.color);let ancestor=n,bg=null;while(ancestor){const color=rgb(getComputedStyle(ancestor).backgroundColor);if(color.length>=3&&(color.length===3||color[3]===1)){bg=color;break;}ancestor=ancestor.parentElement;}if(!bg)return [{text:n.textContent,reason:'unknown background'}];const l1=luminance(fg),l2=luminance(bg),ratio=(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05),font=parseFloat(style.fontSize),large=font>=24||(font>=18.66&&Number(style.fontWeight)>=700),minimum=large?3:4.5;return ratio+.01<minimum?[{text:n.textContent.slice(0,60),ratio,minimum}]:[];});
 });assert(failures.length===0,'New UI contrast: '+JSON.stringify(failures));};
try{
 const {context,page}=await setup({width:1440,height:1000});
 for(const [name,viewport]of [['desktop',{width:1440,height:1000}],['tablet-landscape',{width:1180,height:820}],['tablet-portrait',{width:820,height:1180}],['narrow',{width:390,height:844}]]){
  await page.setViewportSize(viewport);
  for(const theme of ['dark','light']){
   const current=await page.locator('html').getAttribute('data-theme');if(current!==theme)await page.locator('#theme-toggle').click();
   for(const view of ['Prehľad','Úlohy','Kalendár','Služby','Produkty','Kampane']){
    await nav(page,view);await noOverflow(page);await verifyContrast(page);
    if(view==='Kalendár'){assert(await page.locator('.ux-calendar td').count()===42,'Calendar grid cells');assert(await page.locator('.ux-today').count()===1,'Today highlight');
     if(name==='narrow'){assert(await page.locator('.ux-mobile-agenda').isVisible(),'Mobile agenda visible');assert(await page.locator('.ux-mobile-day-count').count()>0,'Month cells show event counts');
      assert(await page.locator('.ux-calendar-event').first().evaluate(n=>getComputedStyle(n).display)==='none','Unusable narrow calendar labels hidden');
      const day=page.locator('.ux-mobile-agenda .ux-agenda-day').first();if(!(await day.evaluate(n=>n.open)))await day.locator('summary').click();
      const link=day.locator('.ux-agenda-event').first();assert(await link.isVisible(),'Agenda has complete readable event titles');await link.click();assert(await page.locator('#dashboard-detail').isVisible(),'Agenda preserves canonical detail action');await page.locator('#dashboard-detail').getByRole('button',{name:'Zavrieť',exact:true}).click();
     }
    }
    if(view==='Kampane'){
     assert(await page.locator('.campaign-board-column').count()===5,'Five board columns');
     const geometry=await page.locator('.campaign-board-column').evaluateAll(cols=>cols.map(c=>({x:c.getBoundingClientRect().x,width:c.getBoundingClientRect().width})));
     assert(geometry.every(c=>c.width>=249),'Cards never narrower than 250px columns');assert(geometry.every((c,i)=>!i||c.x>geometry[i-1].x),'Columns stay horizontal');
     if(name==='narrow')assert(await page.locator('.campaign-board-scroll').evaluate(n=>n.scrollWidth>n.clientWidth),'Internal horizontal scroll');
     const card=page.locator('[data-campaign-id="c1"]');assert(!(await card.innerText()).includes('Synthetic t1'),'No unrelated task');
     assert(await card.locator('a.campaign-file').count()===4,'Real provided asset links only');assert((await card.textContent()).includes('Odkaz nedostupný'),'Missing URL visible');
     const disclosure=card.locator('.campaign-more').first(),toggle=disclosure.locator('summary');await toggle.focus();await page.keyboard.press('Enter');
     await page.waitForFunction(n=>n.getAttribute('aria-expanded')==='true',await toggle.elementHandle());await page.keyboard.press('Enter');await page.waitForFunction(n=>n.getAttribute('aria-expanded')==='false',await toggle.elementHandle());
    }
    if(name==='desktop'&&view==='Prehľad'){const count=await page.locator('.ux-summary-row').first().evaluate(n=>getComputedStyle(n).gridTemplateColumns.split(' ').length);assert(count===3,'Desktop summary 3 columns');}
    await page.screenshot({path:path.join(out,name+'-'+theme+'-'+view+'.png'),fullPage:true});
   }
  }
  results.push(name+' light/dark: navigation, no page overflow, header controls, calendar and new UI text contrast PASS');
 }
 await page.setViewportSize({width:1440,height:1000});await nav(page,'Úlohy');
 const long=page.locator('.ux-long-text').first();await long.locator('summary').focus();await page.keyboard.press('Enter');assert(await long.getAttribute('open')!==null,'Keyboard expands next step');assert((await long.locator('p').innerText()).length===200,'Full next_step preserved');await page.keyboard.press('Enter');assert(await long.getAttribute('open')===null,'Keyboard collapses next step');
 await nav(page,'Kalendár');const heading=await page.locator('.ux-calendar-toolbar h4').innerText();await page.getByRole('button',{name:'Nasledujúci mesiac →'}).click();assert(await page.locator('.ux-calendar-toolbar h4').innerText()!==heading,'Month changes');await page.getByRole('button',{name:'Dnes',exact:true}).click();const more=page.locator('.ux-calendar-more').first();await more.locator('summary').click();await more.getByRole('button').first().click();assert(await page.locator('#dashboard-detail').isVisible(),'Calendar detail reuse');await page.locator('#dashboard-detail').getByRole('button',{name:'Zavrieť',exact:true}).click();
 await nav(page,'Úlohy');

 for(const id of ['t1','t2','t3']){
  await page.locator('table[aria-label="Úlohy"]').getByRole('button',{name:'Synthetic '+id,exact:true}).click();
  const detail=page.locator('#dashboard-detail'),text=detail.locator('.task-description-text');
  if(id==='t2'){assert(await text.count()===0,'Blank description omitted');}
  else {assert(await text.count()===1,'Description present');}
  if(id==='t1'){
   const toggle=detail.getByRole('button',{name:'Zobraziť viac',exact:true});
   assert(await toggle.getAttribute('aria-expanded')==='false','Initially collapsed');
   assert(await text.evaluate(n=>getComputedStyle(n).webkitLineClamp)==='4','Four line clamp');
   await toggle.focus();await page.keyboard.press('Enter');
   const less=detail.getByRole('button',{name:'Zobraziť menej',exact:true});assert(await less.isVisible(),'Collapse control remains visible');assert(await less.getAttribute('aria-expanded')==='true','Expanded aria');
   await less.click();assert(await toggle.getAttribute('aria-expanded')==='false','Collapse restored');
   assert(await text.evaluate(n=>getComputedStyle(n).webkitLineClamp)==='4','Clamp restored');
   const labels=await detail.locator('dt').allTextContents();assert(labels.indexOf('Popis')<labels.indexOf('Ďalší krok'),'Description before next step');
  }
  if(id==='t3')assert(await detail.locator('.task-description-toggle').count()===0,'Short description has no toggle');
  await detail.getByRole('button',{name:'Zavrieť',exact:true}).click();
 }
 assert(await page.locator('.status-legend').count()===1,'Exactly one task legend');
 assert(!(await page.locator('.status-legend').innerText()).includes('PUBLISHED'),'Task legend excludes campaign statuses');
 const statusSummary=page.locator('.ux-panel').filter({has:page.getByRole('heading',{name:'Task Status',exact:true})});
 assert(await statusSummary.locator('.dash-badge').count()>0,'Task Status uses status badges');
 for(const [code,tone]of [['IN_PROGRESS','info'],['PREPARING','warning'],['BLOCKED','danger'],['COMPLETED','success']]){assert(await statusSummary.locator('.dash-badge').filter({hasText:code}).getAttribute('data-tone')===tone,'Task summary registry color '+code);assert(await page.locator('.status-legend .dash-badge').filter({hasText:code}).getAttribute('data-tone')===tone,'Task legend registry color '+code);}
 await page.getByRole('button',{name:'Úloha',exact:true}).click();
 const sortedTitles=await page.locator('table[aria-label="Úlohy"] tbody .table-title').allTextContents();
 assert(sortedTitles[0]==='Synthetic due-extra-0','Task table ascending title sort');
 await page.getByRole('button',{name:'Úloha ↑',exact:true}).click();
 assert((await page.locator('table[aria-label="Úlohy"] tbody .table-title').allTextContents())[0]==='Synthetic t7','Task table descending title sort');
 const taskFilter=page.getByRole('searchbox',{name:'Filtrovať Úlohy · Úloha',exact:true});await taskFilter.fill('Synthetic t1');
 assert(await page.locator('table[aria-label="Úlohy"] tbody tr:visible').count()===1,'Task column filter');
 await page.getByRole('button',{name:'Zrušiť filtre a zoradenie',exact:true}).click();
 assert(await page.locator('table[aria-label="Úlohy"] tbody tr:visible').count()===data.items.filter(i=>i.kind==='task').length,'Task reset restores all rows');
 await page.locator('.ux-column-selector summary').click();
 await page.getByRole('checkbox',{name:'Zobraziť Owner',exact:true}).uncheck();
 await page.getByRole('button',{name:'Posunúť doľava · Stav',exact:true}).click();
 await page.reload();await page.waitForFunction(()=>window.lfDashboardDiagnostics?.().mode==='LIVE SUPABASE');await nav(page,'Úlohy');
 const taskHeaders=await page.locator('table[aria-label="Úlohy"] th').allTextContents();
 assert(!taskHeaders.includes('Owner')&&taskHeaders.indexOf('Stav')<taskHeaders.indexOf('Úloha'),'Task column visibility/order persists');
 for(const label of ['Prehľad','Úlohy','Kalendár','Služby','Produkty','Kampane','Kvalita dát','Súbory']){
  await nav(page,label);assert(await page.locator('.status-legend:visible').count()===1,'One visible legend in '+label);
  const placement=await page.locator('.status-legend:visible').evaluate(legend=>{
   const target=legend.nextElementSibling;
   return Boolean(target&&(target.matches('.table-scroll,.ux-calendar,.ux-campaign-list,.campaign-board-scroll')||target.querySelector('.ux-important-grid,.ux-campaign-list')));
  });
  if(label!=='Súbory')assert(placement,'Legend immediately precedes main table or list in '+label);
  await noOverflow(page);
 }
 await nav(page,'Služby');await page.locator('.ux-column-selector summary').click();const owner=page.getByRole('checkbox',{name:'Zobraziť Owner',exact:true});await owner.uncheck();await page.getByRole('button',{name:'Posunúť doľava · Cena',exact:true}).click();await page.reload();await page.waitForFunction(()=>window.lfDashboardDiagnostics?.().mode==='LIVE SUPABASE');await nav(page,'Služby');const columns=await page.locator('#dashboard .report-table th').allTextContents();assert(!columns.includes('Owner'),'Hidden column persisted');assert(columns.indexOf('Cena')<columns.indexOf('Dostupnosť'),'Column order persisted');
 await nav(page,'Kampane');assert(await page.locator('.campaign-board-column').count()===5,'Five campaign KPIs');assert((await page.locator('#dashboard').innerText()).includes('Žiadne kampane'),'Empty campaign bucket');assert(await page.locator('.campaign-board-card').count()===20,'Many campaigns preserved');
 await nav(page,'Prehľad');assert((await page.locator('#dashboard').innerText()).includes('Synthetic t5'),'Unknown category not lost');
 const campaignColumn=page.locator('.ux-important-grid > .dash-group').first();
 assert((await campaignColumn.innerText()).includes('Synthetic legacy-fb-task'),'Existing canonical LF FB category retained in Campaigns & Marketing');
 const bucketPanels=campaignColumn.locator(':scope > .ux-important-grid > .dash-group');
 const publishedPanel=campaignColumn.locator('.ux-panel').filter({has:page.getByRole('heading',{name:'Beží / Published',exact:true})}).first();
 assert(!(await publishedPanel.innerText()).includes('Synthetic t1'),'Unlinked IN_PROGRESS task must not appear as PUBLISHED campaign');
 assert((await campaignColumn.innerText()).includes('Bez jednoznačného stavu kampane'),'Unlinked campaign-category tasks have a clearly unclassified group');const before=calls;await page.locator('#reload-data').click();await page.waitForTimeout(200);assert(calls===before+1,'Manual reload callback');failed=true;await page.locator('#reload-data').click();await page.waitForTimeout(200);assert((await page.locator('#dashboard').innerText()).includes('STALE / ERROR'),'Failed reload status');assert((await page.locator('#dashboard').innerText()).includes('Synthetic t1'),'Failed reload retains last data');failed=false;
 await page.locator('#disconnect').click();await page.waitForTimeout(200);assert(logout===1,'Server logout called once');assert(await page.locator('#reload-data').isDisabled(),'Disconnected reload state');assert(await page.locator('#connect').innerText()==='Connect to DB','Connect label');await context.close();
 authorized=true;
 for(const mode of ['corrupt','blocked']){const {page,context}=await setup({width:820,height:1180},mode);await nav(page,'Služby');assert((await page.locator('#dashboard .report-table th').allTextContents()).includes('Owner'),'Safe storage defaults');await noOverflow(page);await context.close();}
 // End-to-end browser regression: real file input, JSON parsing, validation, import and navigation.
 const legacy=demoProjection(new Date().toISOString()),template=legacy.items.find(i=>i.kind==='campaign');
 const cases=[
  ['planned','PLANNED / scheduling',[]],['preparing','PREPARING / approval',[]],
  ['proposed','PROPOSED; awaiting brief',[]],['executed','EXECUTED',[]],
  ['published','PUBLISHED',[]],['running','RUNNING',[]],
  ['conflict','PLANNED',[{field:'lifecycle',values:[{value:'PLANNED'},{value:'UNKNOWN'}]}]]
 ];
 for(const [id,lifecycle,conflicts]of cases)legacy.items.push({...structuredClone(template),id:'legacy:fixture:'+id,title:'Synthetic legacy '+id,fields:{...template.fields,lifecycle},conflicts});
 const {page:importPage,context:importContext}=await setup({width:1440,height:1000});
 await importPage.locator('#import').setInputFiles({name:'synthetic-legacy-campaigns.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(legacy))});
 await importPage.waitForFunction(()=>window.lfDashboardDiagnostics?.().mode==='SNAPSHOT'&&window.lfDashboardDiagnostics?.().items>=17);
 assert((await importPage.locator('#dashboard').innerText()).includes('DEMO · Pripraviť otvorený deň'),'Imported snapshot retains legacy tasks');
 await nav(importPage,'Kampane');
 const browserKpi=async label=>{const panel=importPage.locator('.campaign-board-column').filter({has:importPage.getByRole('heading',{name:label,exact:true})});assert(await panel.count()===1,'Campaign KPI exists: '+label);return (await panel.locator('.campaign-count').first().innerText()).trim();};
 assert(await browserKpi('Beží / Published')==='1','Imported explicitly published campaign KPI is 1');
 assert(await browserKpi('V príprave')==='2','PLANNED and PREPARING prefixes included');
 assert(await browserKpi('Draft / Idea')==='1','PROPOSED alias counted as draft');
 assert(await browserKpi('Dokončené')==='1','EXECUTED alias counted as completed');
 for(const [id]of cases)assert(await importPage.getByRole('button',{name:'Synthetic legacy '+id,exact:true}).count()===1,'Imported campaign record preserved '+id);
 assert(await importPage.locator('#dashboard .campaign-board-card').count()===8,'All eight snapshot campaigns including conflicted and RUNNING remain visible');
 const other=importPage.locator('#dashboard .dash-group').filter({has:importPage.getByRole('heading',{name:'Other / Unclassified',exact:true})});
 assert(await other.count()>=1,'Ambiguous legacy stage gets Other heading');
 await importPage.screenshot({path:path.join(out,'synthetic-legacy-json-import.png'),fullPage:true});
 await importContext.close();
 results.push('Real browser file-input legacy JSON import, aliases, conflict and campaign KPIs PASS');
 // Live registry authority: disabled PUBLISHED must not inflate published KPI.
 const livePublished=data.status_catalog.definitions.find(d=>d.domain==='campaign'&&d.code==='PUBLISHED');
 assert(livePublished,'Synthetic PUBLISHED campaign status definition exists');
 livePublished.is_enabled=false;
 const {page:disabledPage,context:disabledContext}=await setup({width:1440,height:1000});
 await nav(disabledPage,'Kampane');
 const publishedKpi=disabledPage.locator('.campaign-board-column').filter({has:disabledPage.getByRole('heading',{name:'Beží / Published',exact:true})});
 assert((await publishedKpi.locator('.campaign-count').first().innerText()).trim()==='Nedostupné','Disabled campaign published KPI is unavailable');
 const otherText=await disabledPage.locator('#dashboard').innerText();
 assert(otherText.includes('Synthetic c1'),'Disabled PUBLISHED campaign remains visible on campaign view');
 await disabledPage.screenshot({path:path.join(out,'synthetic-disabled-campaign-status.png'),fullPage:true});
 await disabledContext.close();livePublished.is_enabled=true;
 results.push('Live Supabase synthetic disabled-campaign status/KPI classification PASS');
 // Owner demo feedback: verify actual in-app synthetic demo navigation (no live Supabase).
 const {page:demoPage,context:demoContext}=await setup({width:1180,height:820});
 await demoPage.getByRole('button',{name:'Pozrieť syntetické demo',exact:true}).click();
 await demoPage.waitForFunction(()=>window.lfDashboardDiagnostics?.().demo===true);
 await nav(demoPage,'Úlohy');
 assert(JSON.stringify(await demoPage.locator('#dashboard .report-table th').allTextContents())===JSON.stringify(['Priorita','Kategória','Úloha','Stav','Ďalší krok','Owner']),'User-requested Tasks column order in demo');
 assert((await demoPage.locator('#dashboard .report-table tbody tr').first().locator('td').nth(1).innerText()).trim()==='Other / Unclassified','Missing demo task category is displayed without inference');
 await nav(demoPage,'Služby');
 const demoServiceHeaders=await demoPage.locator('#dashboard .report-table th').allTextContents();
 assert(demoServiceHeaders.includes('Cena'),'Synthetic service price column visible');
 assert((await demoPage.locator('#dashboard').innerText()).includes('TBD — cena nepotvrdená'),'Unknown demo service price never invented');
 await nav(demoPage,'Produkty');
 const demoProductText=await demoPage.locator('#dashboard').innerText();
 assert(demoProductText.includes('DEMO · Ukážkový produkt'),'Actual demo product present in products view');
 assert((await demoPage.locator('#dashboard .report-table th').allTextContents()).includes('Cena'),'Products price column visible');
 assert(demoProductText.includes('TBD — cena nepotvrdená'),'Unknown demo product price marked unverified');
 await demoPage.screenshot({path:path.join(out,'synthetic-demo-products-feedback.png'),fullPage:true});
 await demoContext.close();
 results.push('Owner synthetic demo: Tasks column order, Services Cena TBD, Products sample visible PASS');
 assert(errors.length===0,'Browser errors: '+errors.join('; '));
 results.push('Keyboard disclosure, month navigation/detail, column persistence, unknown/NULL data, empty/many campaigns, failed reload, logout and storage fallbacks PASS');
 results.push(browserName+' synthetic QA only. This is NOT direct Safari or real-device testing. Screenshots captured; human visual review remains owner review.');
 await fs.writeFile(path.join(out,'results.txt'),results.join('\n')+'\n');console.log(results.join('\n'));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}

