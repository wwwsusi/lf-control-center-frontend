import test from 'node:test';
import assert from 'node:assert/strict';
import {campaignBuckets,taskState,taskIsOpen,uxProjection} from '../web/ux-model.mjs';
import {renderUX} from '../web/ux.mjs';
import {demoProjection} from '../web/dashboard-demo.mjs';
import {fixture,item} from './fixtures/ux-v2.mjs';

class Node{
 constructor(tag,value){this.tagName=tag.toUpperCase();this.value=value??'';this.children=[];this.attributes={};this.style={};}
 get textContent(){return String(this.value)+this.children.map(c=>c.textContent).join(' ');}
 set textContent(value){this.value=value;this.children=[];}
 append(...nodes){this.children.push(...nodes);}
 replaceChildren(...nodes){this.value='';this.children=nodes;}
 setAttribute(k,v){this.attributes[k]=v;}
 getAttribute(k){return this.attributes[k];}
 querySelectorAll(selector){const matches=n=>selector==='[aria-label]'?n.attributes['aria-label']!==undefined:n.tagName===selector.toUpperCase();return this.children.flatMap(n=>[...(matches(n)?[n]:[]),...n.querySelectorAll(selector)]);}
}
function render(section,data){
 const root=new Node('main');
 const make=(tag,value,parent,className)=>{const n=new Node(tag,value);n.className=className||'';parent?.append(n);return n;};
 const action=(label,fn,parent)=>{const n=make('button',label,parent);n.onclick=fn;return n;};
 const tableShell=(title,columns,parent)=>{const box=make('section',title,parent),table=make('table',null,box),body=make('tbody',null,table);return {box,body};};
 renderUX({data,section,parent:root,make,action,detail:()=>{},statusBadge:(code,target)=>make('span',code,target),tableShell,calendarMonth:'2026-10',storage:null});
 return root.textContent;
}
const legacy=()=>({...demoProjection('2026-10-10T08:00:00Z'),origin:'legacy',mode:'SNAPSHOT'});

test('actual demo legacy lifecycle PREPARING populates preparation bucket, not Other',()=>{
 const data=legacy();
 // The demo intentionally flags conflicting lifecycle evidence. Clear the conflict only in this adapter test.
 data.items.find(i=>i.id==='demo:campaign').conflicts=[];
 const grouped=campaignBuckets(data),preparing=grouped.groups.find(g=>g.id==='preparing');
 assert.deepEqual(preparing.items.map(i=>i.id),['demo:campaign']);
 assert(!grouped.other.some(i=>i.id==='demo:campaign'));
 assert(render('campaigns',data).includes('DEMO · Otvorený deň'));
 assert(render('overview',data).includes('V príprave'));
});

test('legacy lowercase open task statuses stay in important, due and overdue views',()=>{
 const data=legacy(),a=data.items.find(i=>i.id==='demo:task-a'),b=data.items.find(i=>i.id==='demo:task-b');
 a.fields.due_date='2026-10-12';b.fields.due_date='2026-10-09';
 const v=uxProjection(data,'2026-10-10');
 assert.equal(taskState(a),'open');assert.equal(taskState(b),'open');
 assert.deepEqual(v.dueSoon.map(i=>i.id),['demo:task-a']);
 assert.deepEqual(v.overdue.map(i=>i.id),['demo:task-b']);
 assert(v.important.find(g=>g.id==='other').items.some(i=>i.id==='demo:task-a'));
 assert(render('overview',data).includes('DEMO · Pripraviť otvorený deň'));
 assert(render('tasks',data).includes('DEMO · Vyhodnotiť skúšobný program'));
});

test('legacy status adapters recognize original labels and terminal codes without guessing',()=>{
 const data=legacy(),states=['to-do','preparing','running','NEZAČATÉ','V PRÍPRAVE','PREBIEHA','NOT_STARTED','IN_PROGRESS','BLOCKED','COMPLETED','CANCELLED','RETIRED','NOT_A_STATE'];
 data.items=states.map((code,n)=>item('legacy-'+n,'task',{task_status:code,priority:'P1'}));
 uxProjection(data,'2026-10-10');
 assert.deepEqual(data.items.map(taskState),['open','open','open','open','open','open','open','open','open','terminal','terminal','terminal','uncertain']);
 assert.equal(taskIsOpen(data.items.at(-1)),false);
});

test('legacy running/active lifecycle never gets promoted to published without evidence',()=>{
 const data=legacy();data.items.push(item('running','campaign',{lifecycle:'RUNNING'}),item('active','campaign',{lifecycle:'ACTIVE'}),item('published','campaign',{lifecycle:'PUBLISHED'}));
 const groups=campaignBuckets(data);
 assert(groups.other.some(c=>c.id==='running'));
 assert(groups.other.some(c=>c.id==='active'));
 assert.deepEqual(groups.groups.find(g=>g.id==='published').items.map(i=>i.id),['published']);
});

test('legacy source conflict makes disputed campaign lifecycle unclassified',()=>{
 const data=legacy(),campaign=data.items.find(i=>i.kind==='campaign');
 campaign.conflicts=[{field:'lifecycle',values:[{value:'PREPARING'},{value:'UNKNOWN'}]}];
 const v=uxProjection(data,'2026-10-10');
 assert(v.campaigns.other.some(i=>i.id===campaign.id));
 assert(!v.campaigns.groups.find(g=>g.id==='preparing').items.some(i=>i.id===campaign.id));
});

test('live canonical campaigns never fall back to lifecycle, regardless of legacy fields',()=>{
 const data=fixture(),campaign=data.items.find(i=>i.kind==='campaign');campaign.fields.lifecycle='PREPARING';campaign.fields.status='PUBLISHED';
 let v=uxProjection(data,'2026-10-10');assert(v.campaigns.groups.find(g=>g.id==='published').items.some(i=>i.id===campaign.id));
 campaign.fields.status=null;v=uxProjection(data,'2026-10-10');assert(v.campaigns.other.some(i=>i.id===campaign.id));
 assert(!v.campaigns.groups.find(g=>g.id==='preparing').items.some(i=>i.id===campaign.id));
});

test('missing/disabled canonical live status is not hidden or mislabeled as open/terminal',()=>{
 const data=fixture();
 const unknown=item('live-unknown','task',{task_status:'FUTURE_STATUS',category:'MARKETING_SOCIAL',priority:'P0',due_date:'2026-10-08'});
 const disabled=item('live-disabled','task',{task_status:'PREPARING',category:'STAFF',priority:'P1',due_date:'2026-10-11'});
 data.status_catalog.definitions.find(d=>d.domain==='work'&&d.code==='PREPARING').is_enabled=false;
 data.items.push(unknown,disabled);
 const v=uxProjection(data,'2026-10-10');
 assert.equal(taskState(unknown),'uncertain');assert.equal(taskState(disabled),'uncertain');
 assert.deepEqual(v.uncertain.map(i=>i.id),['live-unknown','live-disabled','t2'],'A disabled canonical status affects all tasks using that status');
 assert(!v.important.flatMap(g=>g.items).some(i=>i.id==='live-unknown'||i.id==='live-disabled'));
 assert(!v.overdue.some(i=>i.id===unknown.id));
 assert(!v.dueSoon.some(i=>i.id===disabled.id));
 for(const section of ['overview','tasks']){
  const displayed=render(section,data);
  assert(displayed.includes('Stav úloh vyžaduje kontrolu · UNCERTAIN'),section+' has explicit attention');
  assert(displayed.includes('Synthetic live-unknown'));
  assert(displayed.includes('Synthetic live-disabled'));
 }
});

test('known live open and terminal statuses remain unaffected by legacy adapter',()=>{
 const data=fixture(),v=uxProjection(data,'2026-10-10');
 assert.deepEqual(v.uncertain,[]);
 assert.deepEqual(v.dueSoon.map(i=>i.id),['t1','t2']);
 assert.deepEqual(v.overdue.map(i=>i.id),['t3']);
 assert.equal(taskState(data.items.find(i=>i.id==='t4')),'terminal');
 assert.equal(taskState(data.items.find(i=>i.id==='t5')),'open');
});

test('legacy campaign aliases and known delimited prefixes preserve historical display grouping',()=>{
 const data=legacy(),base=data.items.find(i=>i.kind==='campaign');
 const scenarios=[
  ['PLANNED','preparing'],['PLANNED / scheduling','preparing'],
  ['PROPOSED','draft'],['PROPOSED; draft brief','draft'],
  ['EXECUTED','completed'],['EXECUTED — reported','completed'],
  ['PREPARING / approval','preparing'],['PUBLISHED. platform proof','published'],
  ['IN_REVIEW / requested changes','review'],['DRAFT / artwork','draft'],
  ['RUNNING','other'],['ACTIVE','other'],['READY','other'],
  ['PLANNED_NOT_REAL','other'],['UNKNOWN:PLANNED','other']
 ];
 for(const [index,[status]] of scenarios.entries())
  data.items.push({...structuredClone(base),id:'alias-'+index,title:'Synthetic alias '+index,fields:{...base.fields,lifecycle:status,status:undefined},conflicts:[]});
 const result=uxProjection(data,'2026-10-10');
 for(const [index,[status,expected]] of scenarios.entries()){
  const id='alias-'+index,bucket=result.campaigns.groups.find(g=>g.items.some(i=>i.id===id))?.id||'other';
  assert.equal(bucket,expected,status+' must be '+expected+' not '+bucket);
 }
 assert.equal(result.campaigns.groups.find(g=>g.id==='preparing').items.length,3);
 assert.equal(result.campaigns.groups.find(g=>g.id==='draft').items.length,3);
 assert.equal(result.campaigns.groups.find(g=>g.id==='completed').items.length,2);
 assert.equal(result.campaigns.groups.find(g=>g.id==='published').items.length,1);
 assert(result.campaigns.other.some(i=>i.id==='alias-10'),'RUNNING must not imply published');
 assert(render('campaigns',data).includes('Synthetic alias 0'));
});

test('a disabled live campaign definition is not published and never increases published KPI',()=>{
 const data=fixture(),campaign=data.items.find(i=>i.id==='c1');
 data.status_catalog.definitions.find(d=>d.domain==='campaign'&&d.code==='PUBLISHED').is_enabled=false;
 const result=uxProjection(data,'2026-10-10'),published=result.campaigns.groups.find(g=>g.id==='published');
 assert.equal(published.available,false,'disabled code is not an available status');
 assert.deepEqual(published.items,[],'disabled published bucket must be empty');
 assert(result.campaigns.other.some(i=>i.id===campaign.id),'record remains visible in Other');
 assert(!result.campaigns.groups.some(g=>g.items.some(i=>i.id===campaign.id)));
 assert.equal(result.campaigns.groups.find(g=>g.id==='draft').items.length,1,'enabled IDEA unaffected');
 const rendered=render('campaigns',data);
 assert(rendered.includes('Other / Unclassified'),'disabled campaign remains visible');
 assert(rendered.includes('Synthetic c1'),'disabled campaign retains record/title');
 assert(rendered.includes('Nedostupné'),'disabled Published KPI is unavailable');
 const linked=item('linked-task','task',{task_status:'IN_PROGRESS',category:'CAMPAIGN'});
 linked.related_ids=[campaign.id];assert.equal(campaignTaskBucket(linked,result.campaigns.groups),'other','no phantom published task from disabled campaign');
});

test('a non-Supabase snapshot must never inherit a previously configured live campaign registry',()=>{
 const live=fixture();live.status_catalog.definitions.find(d=>d.domain==='campaign'&&d.code==='PUBLISHED').is_enabled=false;
 uxProjection(live,'2026-10-10');
 const snapshot=legacy(),existing=snapshot.items.find(i=>i.kind==='campaign');
 existing.fields.lifecycle='PUBLISHED';existing.conflicts=[];
 const legacyResult=uxProjection(snapshot,'2026-10-10');
 assert(legacyResult.campaigns.groups.find(g=>g.id==='published').items.some(i=>i.id===existing.id));
 assert.equal(legacyResult.campaigns.groups.find(g=>g.id==='published').available,true);
});
