import {renderUX} from './ux.mjs?v=20261011-legends-controls';
import {pragueToday} from './ux-model.mjs?v=20261011-legends-controls';
import {registryStatus,statusLabel,statusDomain,renderStatusLegend} from './status-model.mjs?v=20261011-legends-controls';
import {enhanceTable,statusTone} from './reporting.mjs?v=20261011-legends-controls';

const views=[['overview','Prehľad'],['tasks','Úlohy'],['calendar','Kalendár'],['campaigns','Kampane'],['sources','Kvalita']];
const make=(tag,text,parent,className)=>{const el=document.createElement(tag);if(text!=null)el.textContent=String(text);if(className)el.className=className;parent?.append(el);return el;};
const action=(label,fn,parent)=>{const el=make('button',label,parent);el.type='button';el.addEventListener('click',fn);return el;};

export function mountControlCenter({root,api,onAuthFailure,onBack}){
 let live=true,loading=false,data=null,section='overview',calendarMonth=pragueToday().slice(0,7),requestController=null;
 const memory=new Map(),storage={getItem:key=>memory.get(key)??null,setItem:(key,value)=>{memory.set(key,String(value));},removeItem:key=>memory.delete(key)};
 const disposeRequest=()=>{requestController?.abort();requestController=null;};

 function detail(item){
  if(!live||!data)return;
  const dialog=make('dialog',undefined,root,'crm-control-detail');dialog.setAttribute('aria-label','Detail kanonickej položky');
  action('Zavrieť',()=>dialog.close(),dialog).className='detail-close';
  make('p','READ-ONLY / CANONICAL EVIDENCIA',dialog,'eyebrow');make('h2',item.title,dialog);make('p','ID: '+item.id,dialog,'detail-id');
  const fields=make('dl',undefined,dialog,'dash-fields');
  for(const [key,value] of Object.entries(item.fields||{})){
   if(value===null||value===undefined||value==='')continue;
   const domain=statusDomain(item,key);make('dt',key,fields);make('dd',domain?statusLabel(value,domain):typeof value==='object'?JSON.stringify(value):String(value),fields);
  }
  if(item.provenance){make('h3','Pôvod',dialog);make('p',[item.provenance.owner,item.provenance.identity,item.provenance.anchor].filter(Boolean).join(' · '),dialog);}
  if(item.links?.length){make('h3','Súvisiace zdroje',dialog);for(const link of item.links){let url;try{url=new URL(link.url);if(url.protocol!=='https:')continue;}catch{continue;}const a=make('a',(link.label||link.role||'Otvoriť zdroj')+' ↗',dialog,'detail-link');a.href=url.href;a.target='_blank';a.rel='noopener noreferrer';}}
  if(item.related_ids?.length){make('h3','Súvisiace položky',dialog);for(const id of item.related_ids){const related=data.items.find(candidate=>candidate.id===id);if(related)action(related.title,()=>{dialog.close();detail(related);},dialog);else make('p',id+' · MISSING / položka nie je v načítanom rozsahu',dialog);}}
  root.append(dialog);dialog.addEventListener('close',()=>dialog.remove(),{once:true});dialog.showModal();
 }

 function render(){
  if(!live||!data)return;
  root.replaceChildren(make('h2','Úlohy'),make('p','Prehľady Control Center používajú existujúce Supabase registre. Zobrazenie je iba na čítanie; kampane nespúšťajú marketingové odosielanie.',root,'crm-note'));
  const nav=make('nav',undefined,root,'crm-control-tabs');nav.setAttribute('aria-label','Podzáložky Úlohy');
  for(const [key,label] of views){const tab=action(label,()=>{section=key;render();},nav);if(section===key){tab.setAttribute('aria-current','page');tab.setAttribute('aria-pressed','true');}}
  const refresh=action(loading?'Načítavam…':'Obnoviť údaje',load,root);refresh.disabled=loading;action('Späť na prehľad',onBack,root).className='crm-control-back';
  const stamp=data.backend_read_at?new Date(data.backend_read_at):null;
  make('p','Zdroj: Supabase · načítané '+(stamp&&Number.isFinite(stamp.getTime())?stamp.toLocaleString('sk-SK',{timeZone:'Europe/Prague'}):'čas nie je potvrdený')+' · bez samostatnej evidencie CRM.',root,'crm-note');
  const host=make('section',undefined,root,'crm-control-center');host.setAttribute('aria-live','polite');
  const statusBadge=(value,parent,domain)=>{const meta=registryStatus(value,domain),badge=make('span',statusLabel(value,domain),parent,'dash-badge');badge.dataset.tone=statusTone(value,domain);badge.title=String(value||'TBD');if(parent.tagName==='TD')parent.dataset.statusRank=meta?String(meta.sort_order):'999999';return badge;};
  const renderLegend=(target)=>renderStatusLegend({data,section,parent:target,make,statusBadge});
  const tableShell=(title,columns,parent,note='',controls=true)=>{const box=make('section',undefined,parent,'dash-group');box.dataset.title=title;make('h3',title,box);if(note)make('p',note,box,'section-note');const wrap=make('div',undefined,box,'table-scroll'),table=make('table',undefined,wrap,'report-table');table.setAttribute('aria-label',title);const head=make('thead',undefined,table),body=make('tbody',undefined,table);if(controls)enhanceTable({table,head,body,columns,box,make,action});else{const row=make('tr',undefined,head);for(const label of columns)make('th',label,row).scope='col';}renderLegend(box);return {box,body};};
  const sectionKey=section;
  renderUX({data,section:sectionKey,parent:host,make,action,detail,statusBadge,tableShell,renderLegend,calendarMonth,onCalendarMonth:next=>{calendarMonth=next;render();},storage});
 }

 async function load(){
  if(!live||loading)return;loading=true;disposeRequest();requestController=new AbortController();
  if(!data)root.replaceChildren(make('h2','Úlohy'),make('p','Načítavam existujúce pohľady Control Center…',null,'crm-note'));
  try{const result=await api('/api/crm/read',{body:{view:'OWNER_CONTROL_CENTER'},signal:requestController.signal});if(!live)return;if(result?.dashboard?.origin!=='supabase'||!Array.isArray(result.dashboard.items)||!result.dashboard.status_catalog){throw new Error('PROJECTION_INVALID');}data=result.dashboard;render();}
  catch(error){if(!live||error.name==='AbortError')return;if(['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'].includes(error.code)){onAuthFailure(error.code);return;}root.replaceChildren(make('h2','Úlohy'),make('p','Pohľady Control Center nie sú dostupné. Existujúci register a záznamy zostali nezmenené.',null,'crm-error'),action('Skúsiť znova',load));}
  finally{loading=false;}
 }
 load();return {dispose(){live=false;disposeRequest();root.replaceChildren();}};
}
