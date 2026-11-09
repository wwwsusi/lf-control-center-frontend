import {selectHistoricalPeriods,liveReportingRanges,mergeLiveReports,historicalPeriods} from './crm-report-history.mjs';
// Owner-only live CRM reporting. The backend independently enforces OWNER_ADMIN and UAT denial.
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(className)el.className=className;return el;};
const button=(label,fn)=>{const el=node('button',label);el.type='button';el.addEventListener('click',fn);return el;};
let range=null,selectedSection='overview';
const historicalKeys=['week','period_start','period_end','visits','membership','single','multisport','new_visitors','pass_units','product_units','training_units','zumba_hours','recorded_sales','report_value','sheet_price_value','product_cost','product_profit','multisport_receivable','change_pct'];
function currentMonth(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),v=Object.fromEntries(parts.map(p=>[p.type,p.value]));return {from:v.year+'-'+v.month+'-01',to:v.year+'-'+v.month+'-'+v.day};}
function dateLabel(value){const match=typeof value==='string'&&value.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return 'Dátum na kontrolu';const [,y,m,d]=match,date=new Date(Date.UTC(+y,+m-1,+d));return date.toISOString().slice(0,10)===value?new Intl.DateTimeFormat('sk-SK',{day:'numeric',month:'numeric',year:'numeric',timeZone:'UTC'}).format(date):'Dátum na kontrolu';}
function historicalPeriodLabel(from,to){const start=typeof from==='string'?dateLabel(from):null,end=typeof to==='string'?dateLabel(to):null;if(start&&end)return start+' – '+end;if(start)return 'od '+start;if(end)return 'do '+end;return 'Dátumy v snapshot-e nie sú uvedené';}
function euro(value){if(typeof value!=='string'||!/^-?\d{1,12}(\.\d{1,2})?$/.test(value))return 'Suma na kontrolu';return new Intl.NumberFormat('sk-SK',{style:'currency',currency:'EUR'}).format(Number(value));}
function count(value){if(value===null||value===undefined||value==='')return '—';const n=Number(value);return Number.isSafeInteger(n)&&n>=0?new Intl.NumberFormat('sk-SK').format(n):'—';}
function quantity(value){const n=Number(value);return Number.isFinite(n)&&n>=0?new Intl.NumberFormat('sk-SK',{maximumFractionDigits:3}).format(n):'—';}
export function reportingPeriodError(from,to){
 if(!from||!to)return 'Vyber začiatok aj koniec obdobia.';
 const start=Date.parse(from+'T00:00:00Z'),end=Date.parse(to+'T00:00:00Z');
 if(!Number.isFinite(start)||!Number.isFinite(end))return 'Zadaný dátum nie je platný.';
 const span=(end-start)/86400000;
 if(span<0)return 'Koniec obdobia musí byť rovnaký alebo neskorší ako začiatok.';
 if(span>365)return 'Obdobie môže mať najviac 366 dní.';
 return '';
}
export function reportingCoverageMessage(coverage={}){
 const recorded=Number(coverage?.recorded_days);
 if(!Number.isSafeInteger(recorded)||recorded<0)return 'Úplnosť evidencie sa nepodarilo určiť.';
 if(recorded===0)return 'Za toto obdobie nie sú v CRM evidované pracovné dni. Zobrazené nuly nemožno považovať za potvrdený nulový výsledok.';
 return (Number(coverage.missing_days)>0?'Pre '+count(coverage.missing_days)+' dní chýba evidencia otvorenia; tieto dni nie sú potvrdená nula. ':'')+'CRM eviduje '+count(coverage.recorded_days)+' dní: '+count(coverage.complete_days)+' zatvorených a úplných, '+count(coverage.open_days)+' otvorených, '+count(coverage.unknown_opening_days)+' s neznámym otvorením. V '+count(coverage.incomplete_days)+' dňoch chýbajú údaje; súhrn zahŕňa iba uložené záznamy.';
}
export function multisportReportingMessage(){return 'Potvrdené MultiSport vstupy sa započítavajú ako prijaté úhrady podľa sadzby zo Supabase platnej v deň návštevy: 4,70 € od 1. 1. 2026. Neskoršie vyúčtovanie sa nesmie započítať druhýkrát.';}
export function validateHistoricalSnapshot(snapshot){
 if(!snapshot||snapshot.schema_version!==1||snapshot.source!=='Lady Fitness Reporting MVP · weekly aggregate query'||!Array.isArray(snapshot.weekly)||snapshot.weekly.length<1||snapshot.weekly.length>53||!snapshot.snapshot_period||typeof snapshot.generated_at!=='string'||!/^([a-f0-9]{64})$/.test(snapshot.source_sha256)||!snapshot.limitations||['scope','costs','missing','receipts'].some(key=>typeof snapshot.limitations[key]!=='string'))throw new Error('HISTORICAL_SNAPSHOT_INVALID');
 if(!Array.isArray(snapshot.snapshot_period.weeks)||snapshot.snapshot_period.weeks.join(',')!==snapshot.weekly.map(row=>row.week).join(','))throw new Error('HISTORICAL_SNAPSHOT_INVALID');
 const weeks=new Set();
 for(const row of snapshot.weekly){
  if(!row||Object.keys(row).sort().join('|')!==[...historicalKeys].sort().join('|')||!Number.isInteger(row.week)||row.week<1||row.week>53||weeks.has(row.week))throw new Error('HISTORICAL_SNAPSHOT_INVALID');
  weeks.add(row.week);
  for(const key of historicalKeys.filter(key=>!['period_start','period_end'].includes(key)))if(row[key]!==null&&(!Number.isFinite(row[key])||typeof row[key]!=='number'))throw new Error('HISTORICAL_SNAPSHOT_INVALID');
  for(const key of ['period_start','period_end'])if(row[key]!==null&&(typeof row[key]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row[key])))throw new Error('HISTORICAL_SNAPSHOT_INVALID');
 }
 return snapshot;
}
export function mountReporting({root,api,onAuthFailure,onBack}){
 let live=true,loaded=null,snapshot=null,history=null,sequence=0,controller=null;
 function heading(){root.replaceChildren(node('h2','Reporting'));if(onBack)root.append(button('Späť na prehľad',onBack));}
 async function load(){
  const version=++sequence;controller?.abort();controller=new AbortController();const signal=controller.signal;
  heading();root.append(node('p','Načítavam súhrn za zvolené obdobie…','crm-note'));
  try{
   snapshot=validateHistoricalSnapshot((await api('/api/crm/read',{body:{view:'HISTORICAL_REPORT'},signal})).snapshot);
   if(!live||version!==sequence)return;
   if(!range){const periods=historicalPeriods(snapshot);range={from:periods[0].period_start,to:currentMonth().to};}
   history=selectHistoricalPeriods(snapshot,range.from,range.to);
   const segments=liveReportingRanges(snapshot,range.from,range.to);
   const reports=await Promise.all(segments.map(period=>api('/api/crm/read',{body:{view:'REPORT_SUMMARY',date_from:period.from,date_to:period.to},signal})));
   if(!live||version!==sequence)return;
   loaded=mergeLiveReports(reports,range);draw();
  }catch(error){if(!live||version!==sequence||error.name==='AbortError')return;if(['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'].includes(error.code)){onAuthFailure(error.code);return;}heading();root.append(node('p','Reporting sa nepodarilo načítať úplne. Čiastočný súčet nezobrazujeme.','crm-error'),button('Skúsiť znova',load));}
 }
 function draw(){
  if(!live||!loaded)return;heading();
  const form=node('form',undefined,'crm-report-period'),fromLabel=node('label','Od'),from=node('input'),toLabel=node('label','Do'),to=node('input'),submit=node('button','Zobraziť obdobie'),notice=node('p',undefined,'crm-error');
  for(const [input,value,label] of [[from,range.from,fromLabel],[to,range.to,toLabel]]){input.type='date';input.required=true;input.value=value;label.append(input);}submit.type='submit';notice.setAttribute('role','alert');form.append(fromLabel,toLabel,submit,notice);form.onsubmit=event=>{event.preventDefault();const error=reportingPeriodError(from.value,to.value);if(error){notice.textContent=error;return;}range={from:from.value,to:to.value};load();};root.append(form);
  const presets=node('div');presets.append(button('Tento mesiac',()=>{range=currentMonth();load();}),button('Všetky dostupné týždne',()=>{const rows=historicalPeriods(snapshot);range={from:rows[0].period_start,to:currentMonth().to};load();}));root.append(presets);
  const nav=node('nav',undefined,'crm-report-tabs');nav.setAttribute('aria-label','Sekcie reportingu');for(const [key,label] of [['overview','Prehľad'],['attendance','Návštevnosť'],['sales','Predaj a zisk'],['catalogue','Produkty a služby']]){const tab=button(label,()=>{selectedSection=key;draw();});if(key===selectedSection)tab.setAttribute('aria-current','page');nav.append(tab);}root.append(nav,node('p','Obdobie '+dateLabel(range.from)+' – '+dateLabel(range.to),'crm-note'));
  const rows=history.included,hasHistory=rows.length>0,hasLive=Number(loaded.coverage.recorded_days)>0,sales=loaded.sales;
  const sum=key=>rows.every(r=>Number.isFinite(r[key]))?rows.reduce((n,r)=>n+r[key],0):null;
  const money=value=>value===null?'Neúplné údaje':euro(Number(value).toFixed(2));
  const total=(key,liveKey)=>sum(key)===null?null:sum(key)+(hasLive?Number(sales[liveKey]??0):0);
  const cards=node('div',undefined,'crm-grid');const metric=(title,value,note)=>{const card=node('article',undefined,'crm-card');card.append(node('h3',title),node('p',value),node('p',note,'crm-note'));cards.append(card);};
  if(history.partial.length)root.append(node('p','Výber obsahuje iba časť týždňa '+history.partial.map(r=>'W'+r.week).join(', ')+'. Jeho súhrn nie je započítaný: denné rozdelenie nemáme. Vyber celý týždeň, aby sa zahrnul.','crm-error'));
  root.append(node('p',reportingCoverageMessage(loaded.coverage),'crm-note'));
  if(hasHistory)root.append(node('p','Zahrnuté sú '+rows.length+' anonymné týždenné súhrny bez priradenia ku klientkam. Za tieto týždne sa CRM záznamy nepripočítavajú druhýkrát.','crm-note'));
  if(selectedSection==='overview'||selectedSection==='attendance'){
   const visits=hasHistory||hasLive?(sum('visits')??0)+(hasLive?loaded.attendance.reduce((n,r)=>n+Number(r.visit_count),0):0):null;
   metric('Návštevy',visits===null?'Bez evidencie':count(visits),'Anonymné súhrny a zaúčtované CRM návštevy za neprekrývajúce sa obdobia.');
   if(selectedSection==='attendance')for(const [key,label,code] of [['membership','Permanentky','ENTITLEMENT'],['single','Jednorazové vstupy','SINGLE_ENTRY'],['multisport','MultiSport','MULTISPORT']])metric(label,hasHistory||hasLive?count((sum(key)??0)+(hasLive?Number(loaded.attendance.find(r=>r.code===code)?.visit_count??0):0)):'Bez evidencie','Týždenné súhrny bez klientky; CRM podľa evidovaného typu vstupu.');
  }
  if(selectedSection==='overview'||selectedSection==='sales'){
   metric('Zaznamenaný predaj',hasHistory||hasLive?money(total('recorded_sales','confirmed_sales_eur')):'Bez evidencie','Predaj bez MultiSport úhrad; sám osebe nepotvrdzuje prijatie platby.');
   metric('MultiSport',hasHistory||hasLive?money(total('multisport_receivable','multisport_receipts_eur')):'Bez evidencie','Zahrnutý raz podľa obdobia vstupu; neskoršie vyúčtovanie sa nepripočítava.');
   metric('Predaj a MultiSport spolu',hasHistory||hasLive?money(total('report_value','confirmed_sales_eur')===null?null:total('report_value','confirmed_sales_eur')+(hasLive?Number(sales.multisport_receipts_eur??0):0)):'Bez evidencie','Hodnota predaja a MultiSport; nejde automaticky o potvrdený peňažný tok.');
   metric('Potvrdené CRM platby po refundáciách',hasLive?euro(sales.net_confirmed_payments_eur):'Bez evidencie','Len CRM obdobia. Platby zo súhrnov nemožno bez dokladov označiť za potvrdené.');
   if(selectedSection==='sales'){
    metric('Priame produktové náklady',hasHistory?money(sum('product_cost')):'Bez evidencie','Len zahrnuté anonymné týždenné súhrny; CRM náklady nie sú prepojené.');
    metric('Modelovaný hrubý zisk produktov',hasHistory?money(sum('product_profit')):'Bez evidencie','Len týždenné súhrny. Nezahŕňa nájom, mzdy ani energie; nejde o čistý zisk.');
    root.append(node('p','Priame náklady a zisk zatiaľ nie sú vypočítané pre CRM transakcie. '+multisportReportingMessage(),'crm-note'));
   }
  }
  root.append(cards);
  if(selectedSection==='catalogue'){
   root.append(node('h3','Predané produkty a služby'));const list=node('ul',undefined,'crm-list');for(const row of loaded.items){const li=node('li');li.append(node('strong',row.name),node('p',quantity(row.quantity)+' '+row.unit+' · '+euro(row.sales_eur)));list.append(li);}if(!loaded.items.length)list.append(node('li','V CRM časti obdobia nie sú potvrdené položkové predaje.'));root.append(list);if(hasHistory)root.append(node('p','Anonymné týždenné súhrny: '+count(sum('product_units'))+' produktov, '+count(sum('pass_units'))+' permanentiek, '+count(sum('training_units'))+' tréningov. Dostupný súhrn neobsahuje jednotlivé nákupy ani priradenie ku klientkam.','crm-note'));
  }
  if(hasHistory){const details=node('details'),title=node('summary','Zdrojové týždenné súhrny a pôvod údajov');details.append(title);const table=node('table',undefined,'crm-report-table');table.setAttribute('aria-label','Týždenné súhrny');const head=node('thead'),tr=node('tr');for(const label of ['Týždeň','Obdobie','Návštevy','Predaj a MultiSport'])tr.append(node('th',label));head.append(tr);const body=node('tbody');for(const row of rows){const tr=node('tr');for(const value of ['W'+row.week,historicalPeriodLabel(row.period_start,row.period_end),count(row.visits),money(row.report_value)])tr.append(node('td',value));body.append(tr);}table.append(head,body);const wrap=node('div',undefined,'crm-table-scroll');wrap.append(table);details.append(wrap,node('p','Týždne W40–W42 sú kalendárne zaradené podľa nadväzujúcich dátumov W43–W44 zo zdroja. Podklad vytvorený '+dateLabel(snapshot.generated_at.slice(0,10))+'. Údaje zostávajú súhrnmi, nevytvárajú jednotlivé transakcie.','crm-note'));root.append(details);}
  if(loaded.limitations.multisport_receipts==='PARTIAL_RATE_COVERAGE')root.append(node('p','Niektorým CRM MultiSport vstupom chýba platná sadzba; suma je neúplná.','crm-error'));
 }
 load();return {dispose(){live=false;sequence++;controller?.abort();}};
}
