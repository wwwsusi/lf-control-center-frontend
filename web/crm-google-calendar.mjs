// Úlohy → Kalendár: one calendar for Google Calendar events (read by the server, never stored)
// and dated CRM items (task deadlines, campaign/service/product launches). Pure helpers are exported for tests.
import {calendarEvents,monthGrid,moveMonth,pragueToday} from './ux-model.mjs';

export const LF_CALENDAR_ID='lady.fitness.he@gmail.com';
export const SOURCES=[['google','Google kalendár'],['task','Úlohy'],['campaign','Kampane'],['offer','Služby a produkty']];
export const MODES=[['WEEK','Týždeň'],['MONTH','Mesiac'],['LIST','Zoznam']];
export function calendarOpenUrl(calendarId=LF_CALENDAR_ID){return 'https://calendar.google.com/calendar/u/0/r?cid='+encodeURIComponent(calendarId);}

const DAY=/^\d{4}-\d{2}-\d{2}$/;
export const addDays=(iso,n)=>{const d=new Date(iso+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10);};
const pragueParts=iso=>{const p=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(iso)).map(x=>[x.type,x.value]));return {date:p.year+'-'+p.month+'-'+p.day,time:p.hour+':'+p.minute};};
export const mondayOf=iso=>{const d=new Date(iso+'T12:00:00Z');return addDays(iso,-((d.getUTCDay()+6)%7));};

// Visible date window for a mode and an anchor date (YYYY-MM-DD).
export function visibleRange(mode,anchor){
 if(mode==='MONTH'){const g=monthGrid(anchor.slice(0,7),anchor);return {from:g[0].date,to:g.at(-1).date};}
 if(mode==='LIST')return {from:anchor,to:addDays(anchor,30)};
 const from=mondayOf(anchor);return {from,to:addDays(from,6)};
}
export function shiftAnchor(mode,anchor,delta){
 if(mode==='MONTH')return moveMonth(anchor.slice(0,7),delta)+'-01';
 return addDays(anchor,delta*(mode==='LIST'?31:7));
}

export function dbEvents(data){
 return calendarEvents(data).map(e=>({source:e.item.kind==='task'?'task':e.item.kind==='campaign'?'campaign':'offer',date:e.date,time:null,title:(e.type==='launch'?'Spustenie · ':'')+e.item.title,item:e.item}));
}
// Google events → one entry per Prague day (multi-day all-day events repeat, end date exclusive, max 31 days).
export function googleEvents(calendar){
 const out=[];
 for(const e of calendar?.events??[]){
  if(e.start?.date&&DAY.test(e.start.date)){
   const end=e.end?.date&&DAY.test(e.end.date)?e.end.date:addDays(e.start.date,1);
   for(let d=e.start.date,i=0;d<end&&i<31;d=addDays(d,1),i++)out.push({source:'google',date:d,time:null,title:e.title,event:e});
  }else if(e.start?.date_time){const s=pragueParts(e.start.date_time),en=e.end?.date_time?pragueParts(e.end.date_time):null;out.push({source:'google',date:s.date,time:s.time,end_time:en&&en.date===s.date?en.time:null,title:e.title,event:e});}
 }
 return out;
}
export function eventsByDay(events,filters,from,to){
 const m=new Map();
 for(const e of events){if(!filters[e.source]||e.date<from||e.date>to)continue;if(!m.has(e.date))m.set(e.date,[]);m.get(e.date).push(e);}
 for(const list of m.values())list.sort((a,b)=>(a.time??'')===(b.time??'')?a.title.localeCompare(b.title,'sk'):(a.time??'').localeCompare(b.time??''));
 return m;
}

const fmtDay=iso=>new Intl.DateTimeFormat('sk-SK',{weekday:'short',day:'numeric',month:'numeric',timeZone:'UTC'}).format(new Date(iso+'T12:00:00Z'));
const fmtTitle=(mode,range,anchor)=>mode==='MONTH'?new Intl.DateTimeFormat('sk-SK',{month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(anchor.slice(0,7)+'-15T12:00:00Z')):range.from.slice(8).replace(/^0/,'')+'. '+Number(range.from.slice(5,7))+'. – '+range.to.slice(8).replace(/^0/,'')+'. '+Number(range.to.slice(5,7))+'. '+range.to.slice(0,4);

// state: {mode, anchor, filters:{google,task,campaign,offer}}; google: {status:'loading'|'ok'|'not_configured'|'error', calendar}
export function renderUnifiedCalendar({parent,make,action,data,state,google,onState,onDetail,onRetryGoogle,today=pragueToday()}){
 const box=make('section',undefined,parent,'dash-group crm-cal');
 const range=visibleRange(state.mode,state.anchor);
 const all=[...dbEvents(data),...(google.status==='ok'?googleEvents(google.calendar):[])];
 const days=eventsByDay(all,state.filters,range.from,range.to);
 const counts=Object.fromEntries(SOURCES.map(([k])=>[k,all.filter(e=>e.source===k&&e.date>=range.from&&e.date<=range.to).length]));

 const bar=make('div',undefined,box,'crm-cal-bar');
 const nav=make('div',undefined,bar,'crm-cal-nav');
 action('←',()=>onState({anchor:shiftAnchor(state.mode,state.anchor,-1)}),nav).setAttribute('aria-label','Predchádzajúce obdobie');
 make('h3',fmtTitle(state.mode,range,state.anchor),nav,'crm-cal-title');
 action('→',()=>onState({anchor:shiftAnchor(state.mode,state.anchor,1)}),nav).setAttribute('aria-label','Nasledujúce obdobie');
 action('Dnes',()=>onState({anchor:today}),nav);
 const modes=make('div',undefined,bar,'crm-cal-seg');modes.setAttribute('role','group');modes.setAttribute('aria-label','Zobrazenie');
 for(const [k,l] of MODES)action(l,()=>onState({mode:k}),modes).setAttribute('aria-pressed',String(state.mode===k));

 const chips=make('div',undefined,box,'crm-cal-filters');chips.setAttribute('role','group');chips.setAttribute('aria-label','Zdroje udalostí');
 for(const [k,l] of SOURCES){const b=action('',()=>onState({filters:{...state.filters,[k]:!state.filters[k]}}),chips);b.className='crm-cal-chip crm-cal-'+k;b.setAttribute('aria-pressed',String(Boolean(state.filters[k])));make('span','',b,'crm-cal-dot');make('span',l,b);make('small',k==='google'&&google.status!=='ok'?'–':String(counts[k]),b);}
 const open=make('a','Otvoriť Google Kalendár ↗',chips,'detail-link crm-cal-open');open.href=calendarOpenUrl();open.target='_blank';open.rel='noopener noreferrer';

 if(state.filters.google&&google.status!=='ok'){
  const msg=google.status==='loading'?'Načítavam Google kalendár…':google.status==='not_configured'?'Google kalendár ešte nie je pripojený. Úlohy a kampane sa zobrazujú normálne.':'Google kalendár sa nepodarilo načítať. Úlohy a kampane sa zobrazujú normálne.';
  const n=make('p',msg,box,google.status==='error'?'crm-error':'crm-note');if(google.status==='error')action('Skúsiť znova',onRetryGoogle,n);
 }

 const chip=(e,parentEl,compact)=>{
  const b=action('',()=>e.item?onDetail(e.item):googleDetail(e),parentEl);b.className='crm-cal-event crm-cal-'+e.source+(compact?' compact':'');
  if(e.time)make('time',e.time,b);make('span',e.title,b);b.title=(e.time?e.time+' · ':'')+e.title;return b;
 };
 const googleDetail=e=>{
  const d=make('dialog',undefined,parent,'crm-cal-dialog');const ev=e.event;make('h3',ev.title,d);
  const whenText=ev.all_day?fmtDay(e.date)+' · celý deň':fmtDay(e.date)+' · '+e.time+(e.end_time?'–'+e.end_time:'');make('p',whenText,d);
  if(ev.location)make('p','📍 '+ev.location,d);if(ev.description)make('p',ev.description,d,'crm-note');
  if(ev.link){const a=make('a','Otvoriť v Google Kalendári ↗',d,'detail-link');a.href=ev.link;a.target='_blank';a.rel='noopener noreferrer';}
  action('Zavrieť',()=>d.close(),d);d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();
 };

 if(state.mode==='MONTH'){
  const table=make('table',undefined,box,'crm-cal-month');table.setAttribute('aria-label','Mesačný kalendár');
  const hr=make('tr',undefined,make('thead',undefined,table));for(const n of ['Po','Ut','St','Št','Pi','So','Ne'])make('th',n,hr).scope='col';
  const body=make('tbody',undefined,table);let tr;
  for(const [i,cell] of monthGrid(state.anchor.slice(0,7),today).entries()){
   if(i%7===0)tr=make('tr',undefined,body);const td=make('td',undefined,tr,(cell.current?'':'outside ')+(cell.today?'today':''));
   make('time',String(Number(cell.date.slice(-2))),td).dateTime=cell.date;
   const list=days.get(cell.date)??[];list.slice(0,3).forEach(e=>chip(e,td,true));
   if(list.length>3){const more=make('details',undefined,td,'crm-cal-more');make('summary','+'+(list.length-3),more);list.slice(3).forEach(e=>chip(e,more,true));}
  }
 }else if(state.mode==='WEEK'){
  const grid=make('div',undefined,box,'crm-cal-week');
  for(let d=range.from;d<=range.to;d=addDays(d,1)){const col=make('div',undefined,grid,'crm-cal-day'+(d===today?' today':''));make('h4',fmtDay(d),col);const list=days.get(d)??[];if(!list.length)make('p','—',col,'crm-note');list.forEach(e=>chip(e,col,false));}
 }else{
  const list=make('div',undefined,box,'crm-cal-list');let any=false;
  for(let d=range.from;d<=range.to;d=addDays(d,1)){const evs=days.get(d);if(!evs?.length)continue;any=true;const row=make('section',undefined,list,'crm-cal-list-day'+(d===today?' today':''));make('h4',fmtDay(d),row);evs.forEach(e=>chip(e,row,false));}
  if(!any)make('p','V tomto období nie sú žiadne udalosti.',list,'crm-note');
 }
 make('p','Google udalosti sa len čítajú, upravuj ich v Google Kalendári. CRM ich neukladá.',box,'crm-note');
 return {range};
}
