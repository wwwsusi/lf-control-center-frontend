import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {SECTIONS,DashboardState} from '../web/dashboard-model.mjs';
import {campaignRelations,uxProjection,campaignBuckets,campaignTaskBucket,taskGroup,calendarEvents,pragueToday,addDays,monthGrid,moveMonth,qualitySummary,availableColumns,normalizePreferences,loadPreferences,savePreferences,reorderColumn,toggleColumn,visibleColumns,textPreview,preferenceKey} from '../web/ux-model.mjs';
import {renderUX,renderLongText} from '../web/ux.mjs';
import {fixture,item} from './fixtures/ux-v2.mjs';
import {demoProjection} from '../web/dashboard-demo.mjs';
class Node{
 constructor(tag,text){this.tagName=tag.toUpperCase();this._text=text??'';this.children=[];this.attrs={};this.dataset={};this.style={};}
 get textContent(){return String(this._text)+this.children.map(n=>n.textContent).join(' ');}
 set textContent(value){this._text=value;this.children=[];}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this._text='';this.children=nodes;}
 setAttribute(k,v){this.attrs[k]=String(v);}
 getAttribute(k){return this.attrs[k];}
 querySelectorAll(selector){const match=n=>selector==='[aria-label]'?n.attrs['aria-label']!==undefined:n.tagName===selector.toUpperCase();return this.children.flatMap(n=>[...(match(n)?[n]:[]),...n.querySelectorAll(selector)]);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
 focus(){this.focused=true;}
}
function harness(section,data=fixture(),extra={}){const parent=new Node('main'),tables=[],opened=[],months=[];const make=(tag,text,target,cls)=>{const n=new Node(tag,text);n.className=cls||'';target?.append(n);return n;},action=(label,fn,target)=>{const b=make('button',label,target);b.type='button';b.onclick=fn;return b;},tableShell=(title,columns,target,note,controls)=>{tables.push({title,columns,controls});const box=make('section',title,target),table=make('table',null,box),body=make('tbody',null,table);return {box,body};};renderUX({data,section,parent,make,action,tableShell,detail:i=>opened.push(i.id),statusBadge:(v,target)=>make('span',v,target),calendarMonth:'2026-10',onCalendarMonth:m=>months.push(m),storage:null,...extra});return {parent,tables,opened,months,make};}
test('navigation has Úlohy and Kalendár, with no NOW or Management label',()=>{assert(SECTIONS.some(([key,label])=>key==='tasks'&&label==='Úlohy'));assert(SECTIONS.some(([key])=>key==='calendar'));assert(!SECTIONS.some(([,label])=>['NOW','Management'].includes(label)));});
test('overview canonical summary, campaign counts and real severities',()=>{const v=uxProjection(fixture(),'2026-10-10');assert.deepEqual(v.counts,[['Úlohy',7],['Kampane',2],['Služby',1],['Produkty',1]]);assert.deepEqual(v.campaigns.groups.map(g=>g.items.length),[1,0,0,1,0]);assert.deepEqual(v.quality,[['WARN',2]]);const ui=harness('overview');assert(!ui.parent.textContent.includes('NEXT STEPS'));assert(!ui.parent.textContent.includes('Register Supabase'));assert(ui.parent.textContent.includes('Other / Unclassified'));});
test('open canonical tasks only; inclusive five calendar days; NULL and terminal excluded',()=>{const v=uxProjection(fixture(),'2026-10-10');assert.deepEqual(v.dueSoon.map(i=>i.id),['t1','t2']);assert.deepEqual(v.overdue.map(i=>i.id),['t3']);assert.deepEqual(v.launches.map(e=>e.item.id),['c1','s1']);});
test('Prague business today and date-only arithmetic survive UTC/DST boundaries',()=>{assert.equal(pragueToday(new Date('2026-10-09T22:30:00Z')),'2026-10-10');assert.equal(pragueToday(new Date('2026-12-31T23:30:00Z')),'2027-01-01');assert.equal(addDays('2026-10-24',5),'2026-10-29');assert.equal(addDays('2026-02-30',1),null);});
test('month grid is Monday-first, includes today and changes across year',()=>{const cells=monthGrid('2026-10','2026-10-10');assert.equal(cells.length,42);assert.equal(cells[0].date,'2026-09-28');assert.equal(cells.filter(c=>c.today).length,1);assert.equal(moveMonth('2026-12',1),'2027-01');assert.equal(moveMonth('2026-01',-1),'2025-12');});
test('canonical event placement uses only task due or entity launch; no duration or fabricated dates',()=>{const events=calendarEvents(fixture());const campaign=events.filter(e=>e.item.kind==='campaign');assert.deepEqual(campaign.map(e=>[e.item.id,e.type,e.date]),[['c1','launch','2026-10-10']]);assert(!events.some(e=>e.item.id==='p1'));assert(!events.some(e=>e.date==='2026-10-20'||e.date==='2026-10-21'));assert(campaign.every(e=>!Object.hasOwn(e,'end')));});
test('calendar event status labels and tone keys follow each DB domain definition',()=>{const data=fixture(),catalog=data.status_catalog;catalog.colors.push({color_key:'info'},{color_key:'warning'},{color_key:'success'});catalog.domains.push({domain:'lifecycle'});const status=(domain,code,label,color)=>{const definition=catalog.definitions.find(d=>d.domain===domain&&d.code===code);if(definition){definition.label_sk=label;definition.color_key=color;}else catalog.definitions.push({domain,code,label_sk:label,color_key:color,sort_order:0,is_terminal:false});};status('work','IN_PROGRESS','Práve prebieha','info');status('campaign','PUBLISHED','Publikované DB','success');status('lifecycle','ACTIVE','Aktívna DB','warning');status('lifecycle','IDEA','Nápad DB','warning');data.items.find(i=>i.id==='p1').fields.launch_date='2026-10-13';const ui=harness('calendar',data),events=ui.parent.querySelectorAll('button').filter(button=>button.className==='ux-calendar-event');const find=id=>events.find(button=>button.title.startsWith(id+' · ')),task=find('t1'),service=find('s1'),product=find('p1'),campaign=find('c1');for(const [button,label,tone]of [[task,'Práve prebieha','info'],[service,'Aktívna DB','warning'],[product,'Nápad DB','warning'],[campaign,'Publikované DB','success']]){const marker=button.children.find(child=>child.className==='ux-calendar-status');assert(marker,button.title+' status marker');assert.equal(marker.dataset.tone,tone);assert.equal(marker.children[0].className,'ux-calendar-status-dot');assert.equal(marker.children[1].textContent,label);assert(button.getAttribute('aria-label').endsWith(' · '+label));}});
test('current category groups project safely; unknown and blocked tasks stay visible',()=>{const data=fixture(),v=uxProjection(data,'2026-10-10');assert.equal(taskGroup(data.items[0]),'campaigns');assert.equal(taskGroup(data.items[1]),'management');assert.equal(taskGroup(data.items[2]),'it');assert.equal(taskGroup(data.items[4]),'other');assert.equal(v.important.flatMap(g=>g.items).length,5);assert(v.important.find(g=>g.id==='other').items.some(i=>i.id==='t5'));});
test('campaign order and actual registry codes; missing bucket stays unavailable',()=>{const data=fixture(),groups=campaignBuckets(data).groups;assert.deepEqual(groups.map(g=>g.id),['draft','preparing','review','published','completed']);assert(!data.status_catalog.definitions.some(d=>d.code==='RUNNING'));data.status_catalog.definitions=data.status_catalog.definitions.filter(d=>d.code!=='IN_REVIEW');assert.equal(campaignBuckets(data).groups.find(g=>g.id==='review').available,false);const ui=harness('campaigns',data);const headings=ui.parent.querySelectorAll('h3').map(n=>n.textContent);assert.deepEqual(headings,['Draft / Idea','V príprave','In Review','Beží / Published','Dokončené']);assert(ui.parent.textContent.includes('Nedostupné'));ui.parent.querySelectorAll('button').find(n=>n.textContent==='Synthetic c1').onclick();assert.deepEqual(ui.opened,['c1']);});
test('task table compact order, long next_step full accessible native disclosure, no source mutation',()=>{const data=fixture(),before=structuredClone(data),ui=harness('tasks',data);assert.deepEqual(ui.tables[0].columns,['Priorita','Kategória','Úloha','Stav','Ďalší krok','Owner']);assert.equal(ui.tables[0].controls,true);const details=ui.parent.querySelectorAll('details').find(n=>n.className==='ux-long-text');assert(details.querySelector('summary'));assert.equal(details.querySelector('p').textContent,'n'.repeat(200));assert.deepEqual(data,before);assert.equal(textPreview('short').long,false);});
test('real severity only, unavailable OK count and issue-only coverage',()=>{assert.deepEqual(qualitySummary({issues:[{severity:'ERROR'},{severity:'WARN'}]}),[['ERROR',1],['WARN',1]]);assert.deepEqual(qualitySummary({issues:[]}),[]);assert.deepEqual(qualitySummary(undefined),[]);});
test('shared default columns, visibility and order persistence, required title',()=>{const columns=availableColumns(fixture().items.filter(i=>i.kind==='service')),memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)};let prefs=loadPreferences(storage,'offers',columns);assert.deepEqual(visibleColumns(prefs,columns).map(c=>c.id),['name','lifecycle','availability','price','owner']);prefs=toggleColumn(prefs,'owner',false,columns);prefs=reorderColumn(prefs,'price',-1);assert(savePreferences(storage,'offers',prefs));assert.deepEqual(loadPreferences(storage,'offers',columns),prefs);assert(!loadPreferences(storage,'products',columns).visible.includes('proposed'));assert(toggleColumn(prefs,'name',false,columns).visible.includes('name'));assert(memory.has(preferenceKey('offers')));});
test('corrupt or unavailable localStorage safely falls back',()=>{const columns=availableColumns(fixture().items.filter(i=>i.kind==='product')),defaults=loadPreferences(null,'products',columns);assert.deepEqual(loadPreferences({getItem:()=>'{oops'},'products',columns),defaults);assert.deepEqual(loadPreferences({getItem(){throw Error('blocked');}},'products',columns),defaults);assert.equal(savePreferences({setItem(){throw Error('blocked');}},'products',defaults),false);assert.equal(savePreferences(null,'products',defaults),false);});
test('rendered column controls use semantic buttons and persist user changes',()=>{const memory=new Map(),storage={getItem:k=>memory.get(k),setItem:(k,v)=>memory.set(k,v)},ui=harness('offers',fixture(),{storage});const owner=ui.parent.querySelectorAll('input').find(n=>n.getAttribute('aria-label')==='Zobraziť Owner');owner.checked=false;owner.onchange();assert(!JSON.parse(memory.get(preferenceKey('offers'))).visible.includes('owner'));const button=ui.parent.querySelectorAll('button').find(n=>n.getAttribute('aria-label')==='Posunúť doľava · Cena');assert.equal(button.type,'button');button.onclick();assert(JSON.parse(memory.get(preferenceKey('offers'))).order.indexOf('price')<3);assert(harness('products').parent.textContent.includes('browser storage'));});
test('calendar renders 42 cells, today, canonical events, extra disclosure and detail reuse',()=>{const data=fixture();data.items.push(item('extra1','task',{task_status:'IN_PROGRESS',due_date:'2026-10-10'}),item('extra2','task',{task_status:'IN_PROGRESS',due_date:'2026-10-10'}));const ui=harness('calendar',data);assert.equal(ui.parent.querySelectorAll('td').length,42);assert.equal(ui.parent.querySelectorAll('th').length,7);assert(ui.parent.querySelectorAll('details').some(n=>n.textContent.includes('ďalších')));ui.parent.querySelectorAll('button').find(n=>n.textContent==='Nasledujúci mesiac →').onclick();assert.deepEqual(ui.months,['2026-11']);ui.parent.querySelectorAll('button').find(n=>n.textContent.includes('Synthetic c1')).onclick();assert.deepEqual(ui.opened,['c1']);});
test('header reload uses existing callback, logout remains server POST, labels and theme preserved',()=>{const html=fs.readFileSync(new URL('../web/control-center.html',import.meta.url),'utf8'),app=fs.readFileSync(new URL('../web/app.mjs',import.meta.url),'utf8'),dashboard=fs.readFileSync(new URL('../web/dashboard.mjs',import.meta.url),'utf8');assert(html.includes('Reload Data'));assert(html.includes('Connect to DB'));assert(html.includes('Logout'));assert.equal((html.match(/id="disconnect"/g)||[]).length,1);assert(html.indexOf('id="disconnect"')<html.indexOf('</header>'));assert(dashboard.includes('await refreshLive()'));assert(app.includes("fetch(endpoint+'/api/logout',{method:'POST',credentials:'include'}"));assert(app.includes("themeButton.onclick"));assert(app.includes("await liveReport({restore:true})"));assert(!app.includes("'/api/report'"));});
test('existing validation rejects bad DTO; failed refresh retains good canonical data',()=>{const state=new DashboardState();state.accept(fixture());const before=structuredClone(state.data);state.fail('failed reload');assert.deepEqual(state.data,before);assert.equal(state.error,'failed reload');assert.throws(()=>state.accept({...fixture(),schema_version:99}));});

test('mobile month keeps day counts and a full-text agenda with reusable detail buttons',()=>{
 const data=fixture(),ui=harness('calendar',data),all=node=>[node,...node.children.flatMap(all)],nodes=all(ui.parent);
 const agenda=nodes.find(n=>n.className==='ux-mobile-agenda');
 assert(agenda,'Mobile agenda must exist');assert(agenda.textContent.includes('Udalosti v mesiaci'));
 assert(nodes.filter(n=>n.className==='ux-mobile-day-count').length>=2,'Canonical dated events get day counters');
 const buttons=nodes.filter(n=>n.className==='ux-agenda-event');
 assert(buttons.length>=2,'Full event labels preserved in mobile agenda');
 buttons[0].onclick();assert.equal(ui.opened.length,1,'Same canonical detail action opens from mobile agenda');
});

test('campaign work cards never inherit campaign publication from task workflow status',()=>{
 const data=fixture(),groups=campaignBuckets(data).groups,task=data.items.find(i=>i.id==='t1');
 assert.equal(task.fields.task_status,'IN_PROGRESS');
 assert.equal(campaignTaskBucket(task,groups),'other','unlinked IN_PROGRESS work is not a published campaign');
 task.related_ids=['c1'];assert.equal(campaignTaskBucket(task,groups),'published','explicit linked PUBLISHED campaign');
 task.related_ids=['c2'];assert.equal(campaignTaskBucket(task,groups),'draft','explicit linked IDEA campaign');
 task.related_ids=['c1','c2'];assert.equal(campaignTaskBucket(task,groups),'other','conflicting linked campaign statuses do not infer state');
 task.related_ids=['unknown'];assert.equal(campaignTaskBucket(task,groups),'other','unknown relation remains visible without fabricated status');
 task.related_ids=[];const ui=harness('overview',data);
 assert(ui.parent.textContent.includes('Bez jednoznačného stavu kampane'),'unlinked work is visibly classified as unknown');
 assert(ui.parent.textContent.includes('Synthetic t1'),'unlinked task remains visible');
});

test('real canonical LF FB kampaň / FB post category stays in Campaigns & Marketing without status inference',()=>{
 const data=fixture(),legacy=item('legacy-fb-task','task',{task_status:'PREPARING',priority:'P1',category:'LF FB kampaň / FB post',next_step:'Synthetic campaign work'});
 data.items.push(legacy);
 assert.equal(taskGroup(legacy),'campaigns');
 assert.equal(taskGroup(item('aliased','task',{category:'  LF FB kampaň / FB post  '})),'campaigns');
 assert.equal(taskGroup(item('other','task',{category:'NEW_CATEGORY'})),'other');
 const v=uxProjection(data,'2026-10-10');
 assert(v.important.find(g=>g.id==='campaigns').items.some(i=>i.id===legacy.id));
 assert(!v.important.find(g=>g.id==='other').items.some(i=>i.id===legacy.id));
 assert.equal(campaignTaskBucket(legacy,v.campaigns.groups),'other','task status cannot imply campaign PUBLISHED');
 const ui=harness('overview',data);
 assert(ui.parent.textContent.includes('Synthetic legacy-fb-task'),'legacy task visible in campaign work area');
 assert(ui.parent.textContent.includes('Bez jednoznačného stavu kampane'),'unlinked task remains lifecycle unclassified');
});

test('current Supabase categories map into the three requested overview boxes',()=>{
 const categories=['LF FB kampaň / FB post','LF management','IT CRM','IT / AI Agents','IT / Control Center','IT CRM','IT General / Audit'];
 const data=fixture();
 for(const [index,category] of categories.entries())data.items.push(item('category-'+index,'task',{task_status:'IN_PROGRESS',category:' '+category+' '}));
 const v=uxProjection(data,'2026-10-10');
 assert.deepEqual(categories.map(category=>taskGroup(item('category','task',{category}))),['campaigns','management','it','it','it','it','it']);
 assert.deepEqual(['BRAND_ASSETS','STAFF'].map(category=>taskGroup(item('legacy-'+category,'task',{category}))),['other','other']);
 assert.deepEqual(v.important.slice(0,3).map(group=>group.id),['campaigns','management','it']);
 assert.equal(v.important.find(group=>group.id==='campaigns').items.filter(i=>i.id.startsWith('category-')).length,1);
 assert.equal(v.important.find(group=>group.id==='management').items.filter(i=>i.id.startsWith('category-')).length,1);
 assert.equal(v.important.find(group=>group.id==='it').items.filter(i=>i.id.startsWith('category-')).length,5);
 const ui=harness('overview',data);
 for(const label of ['Campaigns & Marketing','Products / Services / Management','IT'])assert(ui.parent.textContent.includes(label));
 assert(!ui.parent.textContent.includes('Brand Assets'));
 assert(!ui.parent.textContent.includes('Staff'));
});

test('tasks table renders priority, category, task, status and next step in requested order',()=>{
 const ui=harness('tasks',fixture());
 const cells=ui.parent.querySelectorAll('tr')[0].children;
 assert.equal(cells.length,6);
 assert.equal(cells[0].textContent,'P0');
 assert.equal(cells[1].textContent,'CAMPAIGN');
 assert(cells[2].textContent.includes('Synthetic t1'));
 assert.equal(cells[3].textContent,'IN_PROGRESS');
 assert(cells[4].textContent.includes('n'.repeat(200)));
 assert.equal(cells[5].textContent,'—');
});

test('synthetic demo contains a product and shows service price without inventing monetary facts',()=>{
 const data=demoProjection('2026-10-11T10:00:00Z');
 const services=data.items.filter(i=>i.kind==='service'),products=data.items.filter(i=>i.kind==='product');
 assert.equal(services.length,1);
 assert.equal(products.length,1,'Demo must include an explicitly synthetic product');
 assert.equal(services[0].fields.current_price_eur,null,'Unknown service price must not be fabricated');
 assert.equal(products[0].fields.current_price_eur,null,'Unknown product price must not be fabricated');
 const serviceUi=harness('offers',data),productUi=harness('products',data);
 assert(serviceUi.tables[0].columns.includes('Cena'),'Demo services must show price column');
 assert(productUi.tables[0].columns.includes('Cena'),'Demo products must show price column');
 assert(serviceUi.parent.textContent.includes('TBD — cena nepotvrdená'),'Missing service price is explicitly unverified');
 assert(productUi.parent.textContent.includes('DEMO · Ukážkový produkt'),'Demo products view is not blank');
 assert(productUi.parent.textContent.includes('TBD — cena nepotvrdená'));
});

test('new price column appears for empty/missing source fields and migrates saved preferences safely',()=>{
 const items=[item('synthetic-empty-price','service',{lifecycle:'PILOT'})];
 const columns=availableColumns(items);
 assert(columns.some(c=>c.id==='price'),'Price is always available to these entity tables');
 const oldPreferences={version:1,order:['name','lifecycle','owner'],visible:['name','lifecycle']};
 const migrated=normalizePreferences(oldPreferences,columns);
 assert(migrated.visible.includes('price'),'New default-visible Cena must appear in existing persisted layout');
 assert(migrated.order.includes('price'),'New Cena appended without losing user order');
 const explicitHidden={...migrated,visible:migrated.visible.filter(x=>x!=='price')};
 assert(!normalizePreferences(explicitHidden,columns).visible.includes('price'),'Explicitly hidden Cena stays hidden');
 const ui=harness('offers',{...fixture(),items});
 assert(ui.tables[0].columns.includes('Cena'));
 assert(ui.parent.textContent.includes('TBD — cena nepotvrdená'));
});


const descendants=n=>[n,...n.children.flatMap(descendants)];
test('board columns counts cards empty states and no mutation',()=>{
 const data=fixture();for(const status of ['IN_REVIEW','PREPARING','COMPLETED'])data.items.push(item(status,'campaign',{status,priority:'P1'}));
 const before=structuredClone(data),ui=harness('campaigns',data),nodes=descendants(ui.parent),columns=nodes.filter(n=>n.className==='campaign-board-column');
 assert.equal(columns.length,5);assert.deepEqual(columns.map(c=>c.children[0].children[1].textContent),['1','1','1','1','1']);
 for(const [index,id]of ['c1','IN_REVIEW','PREPARING','c2','COMPLETED'].entries())assert(descendants(columns[index]).some(n=>n.getAttribute('data-campaign-id')===id));
 assert.deepEqual(data,before);const empty=harness('campaigns',{...data,items:[]});assert.equal(descendants(empty.parent).filter(n=>n.tagName==='P'&&n.textContent==='Žiadne kampane').length,5);
});
test('board explicit tasks files dedupe bounded lists no unrelated links and accessible expansion',()=>{
 const data=fixture(),c=data.items.find(i=>i.id==='c1');
 for(let n=0;n<5;n++){const t=item('related-'+n,'task',{});t.related_ids=['c1'];data.items.push(t);const f=item('file-'+n,'asset',{is_final:n===0});f.title='File '+n;f.related_ids=[n%2?t.id:c.id];f.links=n===4?[]:[{url:'https://drive.google.com/file/d/test'+n+'/view'}];data.items.push(f);}
 const unrelated=item('unrelated','asset',{});unrelated.related_ids=['c2'];unrelated.links=[{url:'https://drive.google.com/file/d/unrelated/view'}];data.items.push(unrelated);
 const relation=campaignRelations(data,c);assert.equal(relation.tasks.length,5);assert.equal(relation.files.length,5);assert.equal(relation.files[0].asset.fields.is_final,true);assert.equal(relation.files.at(-1).url,null);
 const ui=harness('campaigns',data),card=descendants(ui.parent).find(n=>n.getAttribute('data-campaign-id')==='c1');
 assert(!card.textContent.includes('Synthetic t1'));assert(!card.textContent.includes('unrelated'));assert(card.textContent.includes('Odkaz nedostupný'));
 const more=descendants(card).filter(n=>n.className==='campaign-more');assert.equal(more.length,2);for(const d of more){assert.equal(d.children[0].textContent,'+ ďalších 2');assert.equal(d.children[0].getAttribute('aria-expanded'),'false');d.open=true;d.ontoggle();assert.equal(d.children[0].getAttribute('aria-expanded'),'true');}
 const task=descendants(card).find(n=>n.className==='campaign-related-task');task.onclick();assert.equal(ui.opened[0],'related-0');
 assert.equal(descendants(card).filter(n=>n.tagName==='A').length,4);
 const bad=item('bad','asset',{});bad.related_ids=['c1'];bad.links=[{url:'javascript:alert(1)'},{url:'https://evil.example/file'}];data.items.push(bad);assert.equal(campaignRelations(data,c).files.find(x=>x.asset.id==='bad').url,null);
});
