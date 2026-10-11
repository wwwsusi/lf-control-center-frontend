import {validateStatusCatalog} from './status-model.mjs?v=20261009-status-registry';
// Business projections are separate from the graph; explicit imports persist locally.
export const SECTIONS=[['overview','Prehľad'],['tasks','Úlohy'],['calendar','Kalendár'],['offers','Služby'],['products','Produkty'],['campaigns','Kampane'],['sources','Kvalita dát'],['map','Súbory']];
export const TASK_STATUS=Object.freeze({'to-do':'NEZAČATÉ',preparing:'V PRÍPRAVE',running:'PREBIEHA','NEZAČATÉ':'NEZAČATÉ','V PRÍPRAVE':'V PRÍPRAVE','PREBIEHA':'PREBIEHA'});
export function taskLabel(value){return TASK_STATUS[value]||'UNCERTAIN';}
export const dateValue=value=>typeof value==='string'&&Number.isFinite(Date.parse(value))?Date.parse(value):null;
export function freshness(source,now=Date.now()){
 if((source.provider==='drive'||source.id?.startsWith('drive:'))&&['markdown','now','direction','brief'].includes(source.role))return {label:'STALE · legacy Drive Markdown',stale:true,age:null};
 const stamp=dateValue(source.last_success_at);if(stamp===null)return {label:'Bez úspešného čítania',stale:true,age:null};
 if(stamp>now+60000)return {label:'Čas zdroja je v budúcnosti · UNCERTAIN',stale:true,age:null};
 const age=Math.max(0,now-stamp),minutes=Math.floor(age/60000);
 return {label:minutes<1?'Načítané práve teraz':minutes<60?`Načítané pred ${minutes} min`:minutes<1440?`Načítané pred ${Math.floor(minutes/60)} h`:`Načítané pred ${Math.floor(minutes/1440)} d`,age,stale:source.status!=='ok'||age>86400000};
}
export function publicationLabel(item){
 const f=item.fields||{},p=String(f.publication||'TBD'),v=String(f.platform_verification||'TBD');
 if(/PUBLISHED|PUBLIKOVAN/i.test(p)&&!/NOT_PUBLISHED|NEPUBLIK/i.test(p)&&! /NOT_|NEOVER|NOT PERFORMED/i.test(v)&&v==='PLATFORM_VERIFIED'&&item.links?.some(l=>l.role==='publication'))return 'Publikované · platformovo overené';
 if(/PUBLISHED|PUBLIKOVAN/i.test(p)&&! /NOT_PUBLISHED|NEPUBLIK/i.test(p))return 'Publikovanie oznámené · platformovo neoverené';
 return p;
}
export function validateProjection(input){
 validateStatusCatalog(input);
 if(!input||input.schema_version!==1||!Array.isArray(input.sources)||!Array.isArray(input.items)||input.items.length>10000||input.sources.length>300)throw Error('Neplatný dashboard kontrakt.');
 const sourceIds=new Set(),ids=new Set();const checked=structuredClone(input),merged=[];
 for(const s of input.sources){if(!s.id||sourceIds.has(s.id)||!['ok','error','missing','blocked'].includes(s.status))throw Error('Neplatná evidencia zdroja.');sourceIds.add(s.id);}
 for(const item of input.items){if(!item.id||!sourceIds.has(item.source_id)||typeof item.title!=='string'||!item.provenance||!Array.isArray(item.links)||!Array.isArray(item.related_ids)||!item.fields||!Array.isArray(item.conflicts))throw Error('Neplatná položka / provenance.');if(ids.has(item.id)){const prior=merged.find(i=>i.id===item.id);if(prior.kind!=='service'||item.kind!=='service'||!/^LF-SVC-/.test(item.id))throw Error('Duplicate ID');for(const [field,value]of Object.entries(item.fields)){if(prior.fields[field]!==undefined&&prior.fields[field]!==value)prior.conflicts.push({field,values:[{value:prior.fields[field],source_id:prior.source_id},{value,source_id:item.source_id}]});else prior.fields[field]=value;}prior.related_ids=[...new Set([...prior.related_ids,...item.related_ids])];prior.links.push(...item.links);prior.conflicts.push(...item.conflicts);prior.provenance.additional_sources=[...new Set([...(prior.provenance.additional_sources||[]),item.source_id])];}else {ids.add(item.id);merged.push(structuredClone(item));}}
 checked.items=merged;return checked;
}
export const priorityRank=item=>({P0:0,P1:1,P2:2,P3:3}[item.fields.priority]??99);
export function views(data){
 const items=data?.items||[],now=items.filter(i=>i.kind==='task').sort((a,b)=>priorityRank(a)-priorityRank(b)||a.title.localeCompare(b.title,'sk'));
 const campaigns=items.filter(i=>i.kind==='campaign'),outputs=items.filter(i=>i.kind==='output'&&/FACEBOOK/i.test(i.fields.channel||''));
 const linked=new Set([...now,...campaigns.filter(i=>['PREPARING','RUNNING'].includes(i.fields.lifecycle))].flatMap(i=>i.related_ids));
 return {now,next:now.filter(i=>['P0','P1'].includes(i.fields.priority)&&['NEZAČATÉ','V PRÍPRAVE','PREBIEHA'].includes(taskLabel(i.fields.task_status))&&i.fields.next_step&&!/^(TBD|MISSING)$/i.test(i.fields.next_step)&&i.fields.blocked!==true).slice(0,5),campaigns,outputs,offers:items.filter(i=>['service','product'].includes(i.kind)),relevantOffers:items.filter(i=>['service','product'].includes(i.kind)&&linked.has(i.id)),direction:items.filter(i=>i.kind==='direction'),ideas:items.filter(i=>i.kind==='idea'||(i.kind==='service'&&['IDEA','PROPOSED'].includes(i.fields.lifecycle))),activeServices:items.filter(i=>i.kind==='service'&&i.fields.lifecycle==='ACTIVE'),serviceIdeas:items.filter(i=>i.kind==='service'&&['IDEA','PROPOSED'].includes(i.fields.lifecycle)),preparingServices:items.filter(i=>i.kind==='service'&&['PREPARING','PILOT'].includes(i.fields.lifecycle)),otherServices:items.filter(i=>i.kind==='service'&&!['ACTIVE','IDEA','PROPOSED','PREPARING','PILOT'].includes(i.fields.lifecycle)),dataGaps:items.filter(i=>i.kind==='data_gap'||(i.kind==='decision'&&i.fields.decision_type!=='business')),decisions:items.filter(i=>i.kind==='decision'&&i.fields.decision_type==='business').sort((a,b)=>Number(b.fields.blocking===true)-Number(a.fields.blocking===true)),changes:items.filter(i=>i.kind==='change')};
}
export class DashboardState{
 constructor(){this.data=null;this.error='';this.demo=false;this.epoch=0;}
 accept(raw,epoch=this.epoch){if(epoch!==this.epoch)return false;this.data=validateProjection(raw);this.error='';return true;}
 fail(message){this.error=message;}
 clear(){this.epoch++;this.data=null;this.error='';this.demo=false;}
}

export function metrics(data){
 const v=views(data), stages=new Map();for(const i of v.ideas){const stage=i.fields.evidence_status||i.fields.lifecycle||'TBD';stages.set(stage,(stages.get(stage)||0)+1);}
 return {ideas:v.ideas.length,tasks:v.now.length,campaigns:v.campaigns.length,outputs:v.outputs.length,conflicts:(data?.items||[]).filter(i=>i.conflicts.length).length,stages:[...stages].sort(([a],[b])=>a.localeCompare(b)),partial:(data?.sources||[]).some(s=>s.id!=='coverage:campaign-details'&&s.status!=='ok')};
}

export function campaignCoverage(data){
 const sources=data?.sources||[],campaigns=views(data).campaigns;
 const briefs=sources.filter(s=>s.role==='brief'&&s.provider==='github');
 const missing=campaigns.filter(i=>!i.links.some(l=>l.role==='brief'&&/^https:\/\/github\.com\//.test(l.url)));
 return {briefs:briefs.length,missing:missing.map(i=>i.id),unavailable:briefs.filter(s=>s.status!=='ok').map(s=>s.id)};
}
export function ideaBucket(item){return ['FOCUS NOW','LATER','PARKED'].includes(item.fields.reporting_bucket)?item.fields.reporting_bucket:'UNCLASSIFIED';}

