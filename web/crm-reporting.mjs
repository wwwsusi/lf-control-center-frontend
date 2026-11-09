import {kpiCard,columnChart,rankingChart,chartCard,unavailable,weekModel,normalizeFacts,changes,dailySeries,weekdayAverages,productRanking,formatEuro,formatEuroShort,SERIES_COLORS} from './crm-report-view.mjs';
import {selectHistoricalPeriods,liveReportingRanges,mergeLiveReports,historicalPeriods} from './crm-report-history.mjs';
// Owner-only live CRM reporting. The backend independently enforces OWNER_ADMIN and UAT denial.
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(className)el.className=className;return el;};
const button=(label,fn)=>{const el=node('button',label);el.type='button';el.addEventListener('click',fn);return el;};
let range=null,selectedSection='overview',productMetric='sales',customOpen=false;
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
  const rows=history.included,hasHistory=rows.length>0,hasLive=Number(loaded.coverage.recorded_days)>0,sales=loaded.sales;
  const weeks=weekModel(rows),facts=normalizeFacts(snapshot),allWeeks=historicalPeriods(snapshot);
  // Controls: one period selector (all weeks / a single week / custom range) like the original weekly report.
  const controls=node('div',undefined,'crm-report-controls'),selectLabel=node('label','Obdobie'),select=node('select');select.setAttribute('aria-label','Obdobie reportu');
  const optionFor=(value,text)=>{const o=node('option',text);o.value=value;return o;};
  const first=allWeeks[0],isAll=range.from===first.period_start&&range.to>=allWeeks.at(-1).period_end;
  const single=allWeeks.find(w=>w.period_start===range.from&&w.period_end===range.to);
  select.append(optionFor('all','Všetky týždne'),...allWeeks.map(w=>optionFor('w'+w.week,'W'+w.week+' · '+historicalPeriodLabel(w.period_start,w.period_end))),optionFor('month','Tento mesiac'),optionFor('custom','Vlastné obdobie'));
  select.value=isAll?'all':single?'w'+single.week:'custom';
  select.onchange=()=>{const v=select.value;if(v==='all'){range={from:first.period_start,to:currentMonth().to};load();}else if(v==='month'){range=currentMonth();load();}else if(v==='custom'){customOpen=true;draw();}else{const w=allWeeks.find(x=>'w'+x.week===v);range={from:w.period_start,to:w.period_end};load();}};
  selectLabel.append(select);controls.append(selectLabel);root.append(controls);
  const custom=node('details',undefined,'crm-report-custom');custom.open=customOpen||select.value==='custom';custom.append(node('summary','Vlastné obdobie (od – do)'));
  const form=node('form',undefined,'crm-report-period'),fromLabel=node('label','Od'),from=node('input'),toLabel=node('label','Do'),to=node('input'),submit=node('button','Zobraziť obdobie'),notice=node('p',undefined,'crm-error');
  for(const [input,value,label] of [[from,range.from,fromLabel],[to,range.to,toLabel]]){input.type='date';input.required=true;input.value=value;label.append(input);}submit.type='submit';notice.setAttribute('role','alert');form.append(fromLabel,toLabel,submit,notice);form.onsubmit=event=>{event.preventDefault();const error=reportingPeriodError(from.value,to.value);if(error){notice.textContent=error;return;}range={from:from.value,to:to.value};customOpen=false;load();};custom.append(form);root.append(custom);
  const sources=new Map((snapshot.week_sources??[]).map(s=>[s.week,s.source_kind]));
  const badge=node('p',undefined,'crm-report-badge');badge.append(node('span','Historické záznamy · CRM','crm-chip'),node('span',hasHistory&&weeks.length?'Údaje '+dateLabel(weeks[0].period_start)+' – '+dateLabel(weeks.at(-1).period_end)+' · '+weeks.length+' '+(weeks.length===1?'týždeň':weeks.length<5?'týždne':'týždňov'):'Bez týždenných súhrnov','crm-note'));
  if(hasHistory&&[...sources.values()].some(v=>v==='CRM'))badge.append(node('span','Týždne zo zdroja CRM: '+weeks.filter(w=>sources.get(w.week)==='CRM').map(w=>w.label).join(', '),'crm-note'));
  root.append(badge);
  const nav=node('nav',undefined,'crm-report-tabs');nav.setAttribute('aria-label','Sekcie reportingu');for(const [key,label] of [['overview','Prehľad'],['attendance','Návštevnosť'],['sales','Predaj a zisk'],['catalogue','Produkty a služby']]){const tab=button(label,()=>{selectedSection=key;draw();});if(key===selectedSection)tab.setAttribute('aria-current','page');nav.append(tab);}root.append(nav);
  if(history.partial.length)root.append(node('p','Výber obsahuje iba časť týždňa '+history.partial.map(r=>'W'+r.week).join(', ')+'. Jeho súhrn nie je započítaný: denné rozdelenie nemáme. Vyber celý týždeň, aby sa zahrnul.','crm-error'));
  root.append(node('p',reportingCoverageMessage(loaded.coverage),'crm-note'));
  const sum=key=>rows.every(r=>Number.isFinite(r[key]))?rows.reduce((n,r)=>n+r[key],0):null;
  const money=value=>value===null?'Neúplné údaje':euro(Number(value).toFixed(2));
  const total=(key,liveKey)=>sum(key)===null?null:sum(key)+(hasLive?Number(sales[liveKey]??0):0);
  const chg=key=>changes(weeks,key);
  if(weeks.length>1)root.append(node('p','Zmena: posledný vybraný týždeň '+weeks.at(-1).label+' oproti '+weeks.at(-2).label+'. Zmena kum: '+weeks.at(-1).label+' oproti '+weeks[0].label+'. Hlavné hodnoty sú súčty za vybrané obdobie; N/A znamená chýbajúci alebo nulový základ.','crm-note'));
  const cards=node('div',undefined,'crm-kpi-grid');
  const visitsTotal=hasHistory||hasLive?(sum('visits')??0)+(hasLive?loaded.attendance.reduce((n,r)=>n+Number(r.visit_count),0):0):null;
  const noData='Bez evidencie';
  const salesTotal=hasHistory||hasLive?total('recorded_sales','confirmed_sales_eur'):null;
  const msTotal=hasHistory||hasLive?total('multisport_receivable','multisport_receipts_eur'):null;
  const bothTotal=hasHistory||hasLive?(total('report_value','confirmed_sales_eur')===null?null:total('report_value','confirmed_sales_eur')+(hasLive?Number(sales.multisport_receipts_eur??0):0)):null;
  const section=selectedSection;
  if(section==='overview'||section==='attendance')cards.append(kpiCard({title:'Návštevy',value:visitsTotal===null?noData:count(visitsTotal),note:'Počet vstupov, nie unikátne klientky',change:chg('visits')}));
  if(section==='attendance')for(const [key,label,code] of [['membership','Permanentky','ENTITLEMENT'],['single','Jednorazové vstupy','SINGLE_ENTRY'],['multisport','MultiSport','MULTISPORT']])cards.append(kpiCard({title:label,value:hasHistory||hasLive?count((sum(key)??0)+(hasLive?Number(loaded.attendance.find(r=>r.code===code)?.visit_count??0):0)):noData,note:'Týždenné súhrny bez klientky; CRM podľa evidovaného typu vstupu.',change:chg(key)}));
  if(section==='overview'||section==='sales'){
   cards.append(kpiCard({title:'Predaj a MultiSport',value:bothTotal===null?noData:money(bothTotal),note:'Predaj uhradený podľa potvrdenia majiteľa; nejde automaticky o potvrdený peňažný tok.',change:chg('total')}));
   if(section==='sales'){cards.append(kpiCard({title:'Zaznamenaný predaj',value:salesTotal===null?noData:money(salesTotal),note:'Bez MultiSport úhrad; sám osebe nepotvrdzuje prijatie platby.',change:chg('sales')}),kpiCard({title:'MultiSport',value:msTotal===null?noData:money(msTotal),note:'Zahrnutý raz podľa obdobia vstupu; neskoršie vyúčtovanie sa nepripočítava.',change:chg('multisportValue')}));}
   cards.append(kpiCard({title:'Priame náklady',value:hasHistory?money(sum('product_cost')):noData,note:'Len zahrnuté týždenné súhrny; CRM náklady nie sú prepojené.',change:chg('cost'),neutral:true}),kpiCard({title:'Hrubý zisk',value:hasHistory?money(sum('product_profit')):noData,note:'Modelovaný hrubý zisk produktov. Nezahŕňa nájom, mzdy ani energie; nejde o čistý zisk.',change:chg('profit')}));
   if(section==='sales')cards.append(kpiCard({title:'Potvrdené CRM platby po refundáciách',value:hasLive?euro(sales.net_confirmed_payments_eur):noData,note:'Len CRM obdobia. Platby zo súhrnov nemožno bez dokladov označiť za potvrdené.'}));
  }
  if(cards.children.length)root.append(cards);
  const labels=weeks.map(w=>w.label),charts=node('div',undefined,'crm-chart-grid');
  const needWeeks=()=>charts.append(unavailable(weeks.length?'Grafy potrebujú týždenné súhrny za vybrané obdobie.':'Za vybrané obdobie nie sú týždenné súhrny na zobrazenie grafov.'));
  if(!weeks.length)needWeeks();
  else if(section==='overview'){
   charts.append(chartCard('Ako sa mení návštevnosť',columnChart({labels,series:[{name:'Návštevy',color:SERIES_COLORS.visits,values:weeks.map(w=>w.visits)}],ariaLabel:'Návštevy po týždňoch'})),chartCard('Predaj a MultiSport po týždňoch',columnChart({labels,series:[{name:'Predaj a MultiSport',color:SERIES_COLORS.sales,values:weeks.map(w=>w.total)}],format:formatEuro,axisFormat:formatEuroShort,ariaLabel:'Predaj a MultiSport po týždňoch'})),chartCard('Mix vstupov po týždňoch',columnChart({labels,stacked:true,series:[{name:'Permanentky',color:SERIES_COLORS.membership,values:weeks.map(w=>w.membership)},{name:'Jednorazové vstupy',color:SERIES_COLORS.single,values:weeks.map(w=>w.single)},{name:'MultiSport',color:SERIES_COLORS.multisport,values:weeks.map(w=>w.multisport)}],ariaLabel:'Mix vstupov po týždňoch'})));
  }else if(section==='attendance'){
   const daily=dailySeries(facts,weeks);
   charts.append(chartCard('Návštevy po týždňoch',columnChart({labels,series:[{name:'Návštevy',color:SERIES_COLORS.visits,values:weeks.map(w=>w.visits)}],ariaLabel:'Návštevy po týždňoch'})));
   if(daily.length){
    charts.append(chartCard('Návštevy po dňoch',columnChart({labels:daily.map(d=>d.label.slice(0,5)),series:[{name:'Návštevy',color:SERIES_COLORS.visits,values:daily.map(d=>d.value)}],bands:daily.flatMap((d,i)=>d.weekend?[i]:[]),ariaLabel:'Návštevy po dňoch; víkendy sú zvýraznené'}),'Víkendy sú zvýraznené podkladom.'));
    charts.append(chartCard('Priemerná návštevnosť podľa dňa v týždni',columnChart({labels:weekdayAverages(daily).map(d=>d.label),series:[{name:'Priemer',color:SERIES_COLORS.single,values:weekdayAverages(daily).map(d=>d.average===null?null:Math.round(d.average*10)/10)}],bands:[5,6],format:v=>new Intl.NumberFormat('sk-SK',{maximumFractionDigits:1}).format(v),ariaLabel:'Priemerná návštevnosť podľa dňa v týždni'}),'Priemer len zo dní, ktoré boli zaznamenané; chýbajúci deň sa nepočíta ako nula.'));
   }else charts.append(unavailable('Denný rozpis návštev zatiaľ nie je dostupný.'));
   charts.append(chartCard('Mix vstupov po týždňoch',columnChart({labels,stacked:true,series:[{name:'Permanentky',color:SERIES_COLORS.membership,values:weeks.map(w=>w.membership)},{name:'Jednorazové vstupy',color:SERIES_COLORS.single,values:weeks.map(w=>w.single)},{name:'MultiSport',color:SERIES_COLORS.multisport,values:weeks.map(w=>w.multisport)}],ariaLabel:'Mix vstupov po týždňoch'})));
  }else if(section==='sales'){
   charts.append(chartCard('Predaj, priame náklady a zisk po týždňoch',columnChart({labels,series:[{name:'Predaj a MultiSport',color:SERIES_COLORS.sales,values:weeks.map(w=>w.total)},{name:'Priame náklady',color:SERIES_COLORS.cost,values:weeks.map(w=>w.cost)},{name:'Hrubý zisk produktov',color:SERIES_COLORS.profit,values:weeks.map(w=>w.profit)}],format:formatEuro,axisFormat:formatEuroShort,ariaLabel:'Predaj, priame náklady a zisk po týždňoch'}),'N/A znamená, že hodnota nie je známa; nie je to nula.'));
  }
  if(charts.children.length&&section!=='catalogue')root.append(charts);
  if(section==='sales')root.append(node('p','Priame náklady a zisk zatiaľ nie sú vypočítané pre CRM transakcie. '+multisportReportingMessage(),'crm-note'));
  if(section==='catalogue'){
   const rankBox=node('section',undefined,'crm-chart-card'),toggle=node('div',undefined,'crm-segment');
   for(const [key,label] of [['sales','Podľa predaja'],['profit','Podľa hrubého zisku']]){const b=button(label,()=>{productMetric=key;draw();});if(productMetric===key)b.setAttribute('aria-pressed','true');toggle.append(b);}
   rankBox.append(node('h3',productMetric==='sales'?'Produkty a služby podľa predaja':'Produkty a služby podľa hrubého zisku'),toggle);
   const ranking=productRanking(facts,weeks,productMetric);
   rankBox.append(ranking.length?rankingChart({rows:ranking,ariaLabel:'Poradie produktov a služieb'}):unavailable(productMetric==='profit'?'Hrubý zisk po položkách nie je dostupný, kým nie sú známe nákupné ceny.':'Rozpis po položkách zatiaľ nie je dostupný.'));
   root.append(rankBox);
   root.append(node('h3','Predané produkty a služby v CRM'));const list=node('ul',undefined,'crm-list');for(const row of loaded.items){const li=node('li');li.append(node('strong',row.name),node('p',quantity(row.quantity)+' '+row.unit+' · '+euro(row.sales_eur)));list.append(li);}if(!loaded.items.length)list.append(node('li','V CRM časti obdobia nie sú potvrdené položkové predaje.'));root.append(list);if(hasHistory)root.append(node('p','Anonymné týždenné súhrny: '+count(sum('product_units'))+' produktov, '+count(sum('pass_units'))+' permanentiek, '+count(sum('training_units'))+' tréningov. Dostupný súhrn neobsahuje jednotlivé nákupy ani priradenie ku klientkam.','crm-note'));
  }
  if(hasHistory)root.append(node('p','Zahrnuté sú '+rows.length+' anonymné týždenné súhrny bez priradenia ku klientkam. Za tieto týždne sa CRM záznamy nepripočítavajú druhýkrát.','crm-note'));
  if(hasHistory){const details=node('details'),title=node('summary','Zdrojové týždenné súhrny a pôvod údajov');details.append(title);const table=node('table',undefined,'crm-report-table');table.setAttribute('aria-label','Týždenné súhrny');const head=node('thead'),tr=node('tr');for(const label of ['Týždeň','Obdobie','Zdroj','Návštevy','Predaj a MultiSport'])tr.append(node('th',label));head.append(tr);const body=node('tbody');for(const row of rows){const tr=node('tr');for(const value of ['W'+row.week,historicalPeriodLabel(row.period_start,row.period_end),sources.get(row.week)==='CRM'?'CRM':'Ručný záznam',count(row.visits),money(row.report_value)])tr.append(node('td',value));body.append(tr);}table.append(head,body);const wrap=node('div',undefined,'crm-table-scroll');wrap.append(table);details.append(wrap,node('p','Podklad vytvorený '+dateLabel(snapshot.generated_at.slice(0,10))+'. Údaje zostávajú súhrnmi, nevytvárajú jednotlivé transakcie.','crm-note'));root.append(details);}
  if(loaded.limitations.multisport_receipts==='PARTIAL_RATE_COVERAGE')root.append(node('p','Niektorým CRM MultiSport vstupom chýba platná sadzba; suma je neúplná.','crm-error'));
 }
 load();return {dispose(){live=false;sequence++;controller?.abort();}};
}
