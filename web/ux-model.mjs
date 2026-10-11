import {configureStatusCatalog,registryStatus,statusOptions,statusTerminal,liveStatusCatalog} from './status-model.mjs?v=20261009-status-registry';
import {day,WORK} from './operational.mjs?v=20261009-supabase-v2';
export const CAMPAIGN_BUCKETS=[
 {id:'published',label:'Beží / Published',heading:'Beží teraz / Published',codes:['PUBLISHED']},
 {id:'review',label:'In Review',heading:'In Review',codes:['IN_REVIEW']},
 {id:'preparing',label:'V príprave',heading:'V príprave',codes:['PREPARING']},
 {id:'draft',label:'Draft / Idea',heading:'Draft / Idea',codes:['DRAFT','IDEA']},
 {id:'completed',label:'Dokončené',heading:'Dokončené',codes:['COMPLETED']}
];
export function pragueToday(now=new Date()){const parts=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);const get=t=>parts.find(p=>p.type===t).value;return get('year')+'-'+get('month')+'-'+get('day');}
export function addDays(value,count){if(!day(value))return null;const date=new Date(value+'T12:00:00Z');date.setUTCDate(date.getUTCDate()+count);return date.toISOString().slice(0,10);}
// Unknown statuses are neither open nor terminal: expose them for review instead of silently dropping tasks.
export function taskState(item){
 const code=String(item.fields.task_status||item.fields.status||'').trim(),normal=code.toUpperCase();
 if(liveStatusCatalog()){
  const meta=registryStatus(code,'work');
  return !meta||meta.is_enabled===false?'uncertain':meta.is_terminal?'terminal':'open';
 }
 if(['COMPLETED','CANCELLED','RETIRED'].includes(normal))return 'terminal';
 if(Object.hasOwn(WORK,normal)||['TO-DO','RUNNING','NEZAČATÉ','V PRÍPRAVE','PREBIEHA'].includes(normal))return 'open';
 return 'uncertain';
}
export const taskIsOpen=item=>taskState(item)==='open';
// Legacy display aliases come from the existing reporting adapter; this does not write canonical status.
const LEGACY_CAMPAIGN_CODES=Object.freeze({
 PUBLISHED:'PUBLISHED',IN_REVIEW:'IN_REVIEW',PREPARING:'PREPARING',PLANNED:'PREPARING',
 DRAFT:'DRAFT',IDEA:'IDEA',PROPOSED:'DRAFT',COMPLETED:'COMPLETED',EXECUTED:'COMPLETED'
});
const campaignCode=(item,origin)=>{
 if(origin==='supabase')return String(item.fields.status||'').trim().toUpperCase();
 if(item.conflicts?.some(c=>['lifecycle','identity'].includes(c.field)))return '';
 const raw=String(item.fields.lifecycle||item.fields.status||'').trim().toUpperCase();
 // Only an explicitly recognized leading lifecycle token is mapped (same delimiters as reporting.mjs).
 const prefix=raw.match(/^([A-Z_]+)(?=[. /;—]|$)/)?.[1];
 // RUNNING/ACTIVE/READY are workflow stages, not proof of a canonical published campaign.
 return LEGACY_CAMPAIGN_CODES[prefix]||'';
};
export function campaignBuckets(data){
 configureStatusCatalog(data);
 const items=data.items.filter(i=>i.kind==='campaign'),known=new Set();
 const groups=CAMPAIGN_BUCKETS.map(bucket=>{
  const codes=bucket.codes.filter(code=>{if(data.origin!=='supabase')return true;const meta=registryStatus(code,'campaign');return Boolean(meta)&&meta.is_enabled!==false;});
  codes.forEach(c=>known.add(c));
  return {...bucket,available:codes.length>0,items:items.filter(i=>codes.includes(campaignCode(i,data.origin)))};
 });
 return {groups,other:items.filter(i=>!known.has(campaignCode(i,data.origin)))};
}
export function campaignTaskBucket(item,groups){
 const linked=new Set(Array.isArray(item.related_ids)?item.related_ids:[]);
 const matched=groups.filter(g=>g.items.some(c=>linked.has(c.id))).map(g=>g.id);
 return matched.length===1 && matched[0]!=='completed'?matched[0]:'other';
}
export function taskGroup(item){return ({CAMPAIGN:'campaigns',CAMPAIGNS:'campaigns',MARKETING_SOCIAL:'campaigns','LF FB KAMPAŇ / FB POST':'campaigns','LF MANAGEMENT':'management','IT CRM':'it','IT / AI AGENTS':'it','IT / CONTROL CENTER':'it','IT GENERAL / AUDIT':'it'})[String(item.fields.category||'').trim().toUpperCase()]||'other';}
export function qualitySummary(validation){const summary=validation?.summary;if(Array.isArray(summary)&&summary.some(r=>Number.isFinite(r.issue_count)&&r.issue_count>=0))return summary.filter(r=>Number.isFinite(r.issue_count)&&r.issue_count>=0).map(r=>[r.severity,r.issue_count]);if(Array.isArray(validation?.issues)){const counts=new Map();for(const issue of validation.issues){const severity=issue.severity||'Unknown';counts.set(severity,(counts.get(severity)||0)+1);}return [...counts];}return [];}
export function calendarEvents(data){return data.items.flatMap(item=>{const type=item.kind==='task'?'due':['service','product','campaign'].includes(item.kind)?'launch':null;const date=type&&day(item.fields[type+'_date']);return date?[{item,type,date}]:[];}).sort((a,b)=>a.date.localeCompare(b.date)||a.item.id.localeCompare(b.item.id));}
export function moveMonth(month,delta){if(!day(month+'-01'))throw Error('Invalid month');const date=new Date(month+'-01T12:00:00Z');date.setUTCMonth(date.getUTCMonth()+delta);return date.toISOString().slice(0,7);}
export function monthGrid(month,today=pragueToday()){if(!day(month+'-01'))throw Error('Invalid month');const first=month+'-01',offset=(new Date(first+'T12:00:00Z').getUTCDay()+6)%7,start=addDays(first,-offset);return Array.from({length:42},(_,index)=>{const date=addDays(start,index);return {date,current:date.startsWith(month),today:date===today};});}
export function uxProjection(data,today=pragueToday()){configureStatusCatalog(data);const tasks=data.items.filter(i=>i.kind==='task').sort((a,b)=>({P0:0,P1:1,P2:2}[a.fields.priority]??9)-({P0:0,P1:1,P2:2}[b.fields.priority]??9)||a.id.localeCompare(b.id)),open=tasks.filter(taskIsOpen),uncertain=tasks.filter(i=>taskState(i)==='uncertain'),countBy=(items,key)=>{const counts=new Map();for(const item of items){const value=key(item)||'Other / Unclassified';counts.set(value,(counts.get(value)||0)+1);}return [...counts];};const statuses=countBy(tasks,i=>i.fields.task_status||i.fields.status);for(const meta of statusOptions('work'))if(!statuses.some(([code])=>code===meta.code))statuses.push([meta.code,0]);return {today,tasks,counts:[['Úlohy',tasks.length],['Kampane',data.items.filter(i=>i.kind==='campaign').length],['Služby',data.items.filter(i=>i.kind==='service').length],['Produkty',data.items.filter(i=>i.kind==='product').length]],categories:countBy(tasks,i=>i.fields.category),statuses,uncertain,dueSoon:open.filter(i=>day(i.fields.due_date)&&i.fields.due_date>=today&&i.fields.due_date<=addDays(today,5)),overdue:open.filter(i=>day(i.fields.due_date)&&i.fields.due_date<today),launches:calendarEvents(data).filter(e=>e.type==='launch'&&e.date>=today),campaigns:campaignBuckets(data),quality:qualitySummary(data.validation),important:['campaigns','management','it','other'].map(id=>({id,items:open.filter(i=>taskGroup(i)===id)}))};}
export const COLUMN_DEFINITIONS=[
 {id:'name',label:'Názov',required:true,default:true},
 {id:'lifecycle',label:'Status / Lifecycle',fields:['lifecycle'],default:true},
 {id:'availability',label:'Dostupnosť',fields:['availability_status','stock_status'],default:true},
 {id:'price',label:'Cena',fields:['current_price_eur'],default:true},
 {id:'owner',label:'Owner',fields:['owner'],default:true},
 {id:'proposed',label:'Navrhovaná cena',fields:['proposed_price_eur']},
 {id:'priority',label:'Priorita',fields:['priority']},
 {id:'launch',label:'Spustenie',fields:['launch_date']},
 {id:'completion',label:'Plán dokončenia',fields:['planned_completion_date']},
 {id:'next',label:'Ďalší krok',fields:['next_step']},
 {id:'audience',label:'Publikum',fields:['audience']},
 {id:'units',label:'Jednotky',fields:['units','unit']},
 {id:'category',label:'Kategória',fields:['category']},
 {id:'variant',label:'Variant / balenie',fields:['variant_package']}
];
export function availableColumns(items){return COLUMN_DEFINITIONS.filter(c=>c.required||c.id==='price'||items.some(i=>c.fields.some(field=>Object.hasOwn(i.fields,field))));}
export function defaultPreferences(columns){return {version:1,order:columns.map(c=>c.id),visible:columns.filter(c=>c.default||c.required).map(c=>c.id)};}
export function normalizePreferences(raw,columns){const defaults=defaultPreferences(columns);if(raw?.version!==1||!Array.isArray(raw.order)||!Array.isArray(raw.visible)||raw.order.some(id=>typeof id!=='string')||raw.visible.some(id=>typeof id!=='string'))return defaults;const valid=new Set(columns.map(c=>c.id)),order=[...new Set(raw.order.filter(id=>valid.has(id)))];for(const id of defaults.order)if(!order.includes(id))order.push(id);const newlyAvailable=defaults.order.filter(id=>!raw.order.includes(id));const visible=[...new Set([...raw.visible.filter(id=>valid.has(id)),...newlyAvailable.filter(id=>columns.find(c=>c.id===id)?.default)])];for(const c of columns)if(c.required&&!visible.includes(c.id))visible.push(c.id);return {version:1,order,visible};}
export const preferenceKey=view=>'lf-control-center:ux-v2:columns:'+view;
export function loadPreferences(storage,view,columns){try{return normalizePreferences(JSON.parse(storage?.getItem(preferenceKey(view))||'null'),columns);}catch{return defaultPreferences(columns);}}
export function savePreferences(storage,view,prefs){try{if(!storage)return false;storage.setItem(preferenceKey(view),JSON.stringify(prefs));return true;}catch{return false;}}
export function reorderColumn(prefs,id,delta){const order=[...prefs.order],index=order.indexOf(id),to=index+delta;if(index>=0&&to>=0&&to<order.length)[order[index],order[to]]=[order[to],order[index]];return {...prefs,order};}
export function toggleColumn(prefs,id,enabled,columns){return normalizePreferences({...prefs,visible:enabled?[...prefs.visible,id]:prefs.visible.filter(v=>v!==id)},columns);}
export function visibleColumns(prefs,columns){return prefs.order.filter(id=>prefs.visible.includes(id)).map(id=>columns.find(c=>c.id===id)).filter(Boolean);}
export function textPreview(value,limit=120){const full=String(value??'');return {full,long:full.length>limit,preview:full.length>limit?full.slice(0,limit).trimEnd()+'…':full};}
