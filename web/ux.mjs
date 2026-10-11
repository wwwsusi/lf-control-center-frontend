import {uxProjection,pragueToday,calendarEvents,monthGrid,moveMonth,availableColumns,loadPreferences,savePreferences,reorderColumn,toggleColumn,visibleColumns,textPreview,campaignTaskBucket,TASK_COLUMNS} from './ux-model.mjs?v=20261011-legends-controls';
import {statusLabel,statusDomain} from './status-model.mjs?v=20261011-legends-controls';
import {statusTone} from './reporting.mjs?v=20261011-legends-controls';
import {day,displayDate} from './operational.mjs?v=20261011-legends-controls';
export function renderLongText(value,parent,make){const text=textPreview(value);if(!text.long)return make('span',text.full||'—',parent);const box=make('details',null,parent,'ux-long-text');make('summary',text.preview+' · Zobraziť / skryť celý text',box);make('p',text.full,box,'ux-full-text');return box;}
export function renderUX({data,section,parent,make,action,detail,statusBadge,tableShell,calendarMonth=pragueToday().slice(0,7),onCalendarMonth=()=>{},storage}){
 const v=uxProjection(data),group=(title,target=parent)=>{const box=make('section',null,target,'dash-group ux-panel');make('h3',title,box);return box;};
 const summary=(title,counts,target)=>{const box=group(title,target),dl=make('dl',null,box,'ux-counts');for(const [label,count]of counts){make('dt',label,dl);make('dd',count==null?'Nedostupné':String(count),dl);}return box;};
 const row=(className='')=>make('div',null,parent,'ux-summary-row '+className);
 const empty=box=>make('p','Žiadne položky v načítanom rozsahu.',box,'empty-row');
 const itemRow=(item,target,{date=null,next=false}={})=>{const card=make('article',null,target,'ux-item');action(item.title,()=>detail(item),card).className='table-title';make('small',item.id,card,'table-id');const meta=make('div',null,card,'ux-item-meta');const code=item.fields.task_status||item.fields.status||item.fields.lifecycle;if(code)statusBadge(code,meta,item.kind==='task'?'work':item.kind==='campaign'?'campaign':'lifecycle');if(date)make('small',(item.kind==='task'?'Termín: ':'Spustenie: ')+displayDate(date),meta);if(item.fields.priority)statusBadge(item.fields.priority,meta,statusDomain(item,'priority'));if(item.fields.owner)make('small',item.fields.owner,meta);if(next)renderLongText(item.fields.next_step,card,make);return card;};
 const taskList=(title,items,target)=>{const box=group(title,target);for(const item of items)itemRow(item,box,{date:day(item.fields.due_date)});if(!items.length)empty(box);return box;};
 if(section==='overview'){
  const first=row();summary('Summary',v.counts,first);summary('Campaign Summary',v.campaigns.groups.map(g=>[g.label,g.available?g.items.length:null]),first);const quality=summary('Kvalita dát',v.quality,first);make('small',v.quality.length?'Dostupné severity z validácie. Počet OK záznamov sa neodvodzuje.':'Severity summary nie je dostupné; počet OK záznamov nie je známy.',quality);
  if(v.uncertain.length){const attention=group('Stav úloh vyžaduje kontrolu · UNCERTAIN');make('p','Niektoré úlohy majú neznámy alebo neaktívny pracovný status. Nezaraďujeme ich medzi otvorené ani dokončené; over ich v kanonickom zdroji.',attention,'conflict-label');for(const item of v.uncertain)itemRow(item,attention,{date:day(item.fields.due_date),next:true});}
  const timed=row();taskList('Due Soon · do 5 dní',v.dueSoon,timed);const launches=group('Upcoming Launches',timed);for(const e of v.launches)itemRow(e.item,launches,{date:e.date});if(!v.launches.length)empty(launches);taskList('Overdue',v.overdue,timed);
  const important=group('Dôležité teraz'),columns=make('div',null,important,'ux-important-grid'),labels={campaigns:'Campaigns & Marketing',management:'Products / Services / Management',it:'IT',other:'Other / Unclassified'};
  for(const bucket of v.important){if(bucket.id==='other'&&!bucket.items.length)continue;const box=group(labels[bucket.id],columns);if(bucket.id==='campaigns'){const classify=item=>campaignTaskBucket(item,v.campaigns.groups);for(const g of v.campaigns.groups.filter(g=>g.id!=='completed').concat([{id:'other',label:'Bez jednoznačného stavu kampane'}])){const selected=bucket.items.filter(i=>classify(i)===g.id);if(g.id==='other'&&!selected.length)continue;const sub=group(g.label,box);for(const item of selected)itemRow(item,sub,{next:true});if(!selected.length)empty(sub);}}else{for(const item of bucket.items)itemRow(item,box,{next:true});if(!bucket.items.length)empty(box);}}
  return;
 }
 if(section==='tasks'){
  const top=row('ux-two');summary('Summary by category',v.categories,top);const statusBox=group('Task Status',top),statusCounts=make('dl',null,statusBox,'ux-counts');for(const [code,count]of v.statuses){statusBadge(code,make('dt',null,statusCounts),'work');make('dd',String(count),statusCounts);}
  if(v.uncertain.length){const attention=group('Stav úloh vyžaduje kontrolu · UNCERTAIN');make('p','Neznámy alebo neaktívny pracovný status; úlohy nie sú automaticky označené ako otvorené ani dokončené.',attention,'conflict-label');for(const item of v.uncertain)itemRow(item,attention,{date:day(item.fields.due_date),next:true});}
  const timed=row('ux-two');taskList('Due Soon · do 5 dní',v.dueSoon,timed);taskList('Overdue',v.overdue,timed);
  renderEntities(v.tasks,'task');return;
 }
 if(section==='campaigns'){
  const top=row('ux-campaign-kpis');for(const g of v.campaigns.groups)summary(g.label,[['Počet',g.available?g.items.length:null]],top);
  for(const g of v.campaigns.groups){const box=group(g.heading),cards=make('div',null,box,'ux-campaign-list');for(const item of g.items)itemRow(item,cards,{date:day(item.fields.launch_date),next:true});if(!g.items.length)make('p',g.available?'Žiadne kampane v tomto stave.':'Corresponding canonical status nie je dostupný.',box,'empty-row');}
  if(v.campaigns.other.length){const box=group('Other / Unclassified');for(const item of v.campaigns.other)itemRow(item,box,{date:day(item.fields.launch_date),next:true});}return;
 }
 function renderEntities(items,kind){
  const columns=kind==='task'?TASK_COLUMNS:availableColumns(items),host=make('div',null,parent,'ux-entities');let browserStorage=storage;
  if(browserStorage===undefined)try{browserStorage=globalThis.localStorage;}catch{browserStorage=null;}
  let prefs=loadPreferences(browserStorage,section,columns),storageFailed=!browserStorage;
  const commit=next=>{prefs=next;storageFailed=!savePreferences(browserStorage,section,prefs);};
  const redraw=(focusLabel=null)=>{host.replaceChildren();const selector=make('details',null,host,'ux-column-selector');make('summary','Stĺpce · zobrazenie a poradie',selector);const controls=make('div',null,selector,'ux-column-controls');
   for(const [index,id]of prefs.order.entries()){const c=columns.find(c=>c.id===id),line=make('div',null,controls,'ux-column-row'),label=make('label',null,line),input=make('input',null,label);input.type='checkbox';input.checked=prefs.visible.includes(id);input.disabled=Boolean(c.required);input.setAttribute('aria-label','Zobraziť '+c.label);make('span',c.label,label);input.onchange=()=>{commit(toggleColumn(prefs,id,input.checked,columns));redraw('Zobraziť '+c.label);};for(const [delta,title]of [[-1,'Posunúť doľava'],[1,'Posunúť doprava']]){const aria=title+' · '+c.label,b=action(delta<0?'←':'→',()=>{commit(reorderColumn(prefs,id,delta));redraw(aria);},line);b.setAttribute('aria-label',aria);b.disabled=delta<0?index===0:index===prefs.order.length-1;}}
   action('Obnoviť predvolené stĺpce',()=>{commit(loadPreferences(null,section,columns));redraw();},selector);
   if(storageFailed)make('small','Nastavenie funguje v tejto relácii; browser storage nie je dostupný.',selector);
   const visible=visibleColumns(prefs,columns),{box,body}=tableShell(kind==='task'?'Úlohy':section==='offers'?'Služby':'Produkty',visible.map(c=>c.label),host,'',true);
   const euro=value=>Number.isFinite(value)?new Intl.NumberFormat('sk-SK',{style:'currency',currency:'EUR'}).format(value):'TBD — cena nepotvrdená';
   for(const item of items){const tr=make('tr',null,body),f=item.fields;for(const c of visible){const td=make('td',null,tr);if(c.id==='name'){action(item.title,()=>detail(item),td).className='table-title';make('small',item.id,td,'table-id');}else if(['lifecycle','availability','priority','status'].includes(c.id)){const field=c.id==='status'?'task_status':c.id==='availability'?(kind==='service'?'availability_status':'stock_status'):c.id;statusBadge(f[field]||(c.id==='status'?f.status:null)||'—',td,c.id==='status'?'work':statusDomain(item,field));}else if(c.id==='next')renderLongText(f.next_step,td,make);else{const value=({price:euro(f.current_price_eur),proposed:euro(f.proposed_price_eur),launch:day(f.launch_date)?displayDate(f.launch_date):'—',due:day(f.due_date)?displayDate(f.due_date):'—',completion:day(f.planned_completion_date)?displayDate(f.planned_completion_date):'—',owner:f.owner,audience:f.audience,units:[f.units,f.unit].filter(v=>v!=null).join(' '),category:f.category||(kind==='task'?'Other / Unclassified':'—'),variant:f.variant_package})[c.id];make('span',value??'—',td);}}}if(!items.length)empty(box);
   if(focusLabel){selector.open=true;[...selector.querySelectorAll('[aria-label]')].find(n=>n.getAttribute('aria-label')===focusLabel)?.focus();}
  };redraw();
 }
 if(section==='offers'||section==='products'){const kind=section==='offers'?'service':'product';renderEntities(data.items.filter(i=>i.kind===kind),kind);return;}

 if(section==='calendar'){
  const box=group('Kalendár'),toolbar=make('div',null,box,'ux-calendar-toolbar');action('← Predchádzajúci mesiac',()=>onCalendarMonth(moveMonth(calendarMonth,-1)),toolbar);make('h4',new Intl.DateTimeFormat('sk-SK',{month:'long',year:'numeric',timeZone:'Europe/Prague'}).format(new Date(calendarMonth+'-15T12:00:00Z')),toolbar);action('Nasledujúci mesiac →',()=>onCalendarMonth(moveMonth(calendarMonth,1)),toolbar);action('Dnes',()=>onCalendarMonth(v.today.slice(0,7)),toolbar);
  const table=make('table',null,box,'ux-calendar');table.setAttribute('aria-label','Mesačný kalendár '+calendarMonth);const thead=make('thead',null,table),head=make('tr',null,thead);for(const name of ['Po','Ut','St','Št','Pi','So','Ne'])make('th',name,head).scope='col';
  const body=make('tbody',null,table),events=calendarEvents(data),monthEvents=events.filter(e=>e.date.startsWith(calendarMonth));
  const event=(e,target,className='ux-calendar-event')=>{const b=action((e.type==='launch'?'Spustenie · ':'Termín · ')+e.item.title,()=>detail(e.item),target),item=e.item,fields=item.fields,code=fields.task_status||fields.status||fields.lifecycle||fields.evidence_status,field=item.kind==='task'?'task_status':item.kind==='campaign'?'status':'lifecycle',domain=statusDomain(item,field)||({task:'work',campaign:'campaign',service:'lifecycle',product:'lifecycle'})[item.kind]||'lifecycle',label=statusLabel(code,domain);b.textContent='';b.className=className;b.title=item.id+' · '+e.date;b.setAttribute('aria-label',(e.type==='launch'?'Spustenie · ':'Termín · ')+item.title+' · '+label);make('span',(e.type==='launch'?'Spustenie · ':'Termín · ')+item.title,b,'ux-calendar-event-title');const status=make('span',null,b,'ux-calendar-status');status.dataset.tone=statusTone(code,domain);const dot=make('span',null,status,'ux-calendar-status-dot');dot.setAttribute('aria-hidden','true');make('span',label,status,'ux-calendar-status-label');};
  const eventCount=n=>n+' '+(n===1?'udalosť':n<5?'udalosti':'udalostí');
  let tr;
  for(const [index,cell]of monthGrid(calendarMonth,v.today).entries()){if(index%7===0)tr=make('tr',null,body);const td=make('td',null,tr);td.className=(!cell.current?'ux-outside ':'')+(cell.today?'ux-today':'');const time=make('time',String(Number(cell.date.slice(-2))),td);time.dateTime=cell.date;if(cell.today)time.setAttribute('aria-current','date');const daily=events.filter(e=>e.date===cell.date);
   if(daily.length){const count=make('span',String(daily.length),td,'ux-mobile-day-count');count.setAttribute('aria-label',eventCount(daily.length));}
   daily.slice(0,2).forEach(e=>event(e,td));if(daily.length>2){const more=make('details',null,td,'ux-calendar-more');make('summary','+'+(daily.length-2)+' ďalších',more);const list=make('div',null,more);daily.slice(2).forEach(e=>event(e,list));}}
  const agenda=make('section',null,box,'ux-mobile-agenda');make('h4','Udalosti v mesiaci',agenda);
  if(!monthEvents.length)make('p','Žiadne udalosti s potvrdeným dátumom.',agenda,'empty-row');
  const byDay=new Map();for(const e of monthEvents){if(!byDay.has(e.date))byDay.set(e.date,[]);byDay.get(e.date).push(e);}
  for(const [date,daily]of byDay){const group=make('details',null,agenda,'ux-agenda-day');group.open=date===v.today;make('summary',displayDate(date)+' · '+eventCount(daily.length),group);const list=make('div',null,group,'ux-agenda-events');for(const e of daily)event(e,list,'ux-agenda-event');}
  return;
 }
}
