import {kpiCard,sumKnown,columnChart,rankingChart,chartCard,unavailable,segmentControl,tableMetricsFor,dailyMix,weekdayChartData,formatOneDecimal,tableModel,reportTable,weekModel,normalizeFacts,changes,dailySeries,weekdayAverages,productRanking,salesSplitSeries,visitsSeries,mixSeries,formatCount,formatEuro,formatEuroShort,formatCompactNumber,SERIES_COLORS} from './crm-report-view.mjs';
import {selectHistoricalPeriods,liveReportingRanges,mergeLiveReports,historicalPeriods,partialVisitRows} from './crm-report-history.mjs';
import {renderSocial,validateSocialReport,socialWeeks,SOCIAL_COLORS} from './crm-social.mjs';
// Owner-only live CRM reporting. The backend independently enforces OWNER_ADMIN and UAT denial.
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(className)el.className=className;return el;};
const button=(label,fn)=>{const el=node('button',label);el.type='button';el.addEventListener('click',fn);return el;};
let range=null,socialData=null,socialLoading=false,socialFailed=false,socialState={selected:null,platform:'all',sort:'date'},selectedSection='overview',productMetric='sales',productKind='all',salesGrain='week',timeGrain='week',tableMetric='visits';
const historicalKeys=['week','period_start','period_end','visits','membership','single','multisport','new_visitors','pass_units','product_units','training_units','zumba_hours','recorded_sales','report_value','sheet_price_value','product_cost','product_profit','multisport_receivable','change_pct'];
function currentMonth(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),v=Object.fromEntries(parts.map(p=>[p.type,p.value]));return {from:v.year+'-'+v.month+'-01',to:v.year+'-'+v.month+'-'+v.day};}
const MONTH_NAME=new Intl.DateTimeFormat('sk-SK',{month:'long',year:'numeric',timeZone:'UTC'});
const monthLabelOf=key=>{const t=MONTH_NAME.format(new Date(key+'-01T00:00:00Z'));return t.charAt(0).toUpperCase()+t.slice(1);};
function monthRange(key){const [y,m]=key.split('-').map(Number),now=currentMonth(),last=String(new Date(Date.UTC(y,m,0)).getUTCDate()).padStart(2,'0');return {from:key+'-01',to:key===now.from.slice(0,7)?now.to:key+'-'+last};}
function monthKeys(firstDate){const keys=[],end=currentMonth().from.slice(0,7);let [y,m]=firstDate.slice(0,7).split('-').map(Number);while(y+'-'+String(m).padStart(2,'0')<=end){keys.push(y+'-'+String(m).padStart(2,'0'));if(++m>12){m=1;y++;}}return keys;}
function shortRange(from,to){const [,m1,d1]=from.split('-').map(Number),[,m2,d2]=to.split('-').map(Number);return m1===m2?d1+'.–'+d2+'. '+m2+'.':d1+'. '+m1+'. – '+d2+'. '+m2+'.';}
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
// Adds Facebook/Instagram weekly reach to week rows (null when the week has no social record).
export function withSocialReach(weeks,social){
 const byStart=social?new Map(socialWeeks(social).map(r=>[r.period_start,r])):new Map();
 return weeks.map(w=>({...w,reach:byStart.get(w.period_start)?.fb?.reach??null,igReach:byStart.get(w.period_start)?.ig?.reach??null}));
}
export function mountReporting({root,api,onAuthFailure,onBack}){
 let live=true,loaded=null,snapshot=null,history=null,sequence=0,controller=null;
 function heading(){const head=node('div',undefined,'crm-report-head');head.append(node('h2','Reporting'));if(onBack)head.append(button('Späť na prehľad',onBack));root.replaceChildren(head);}
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
 function drawSocial(){
  const box=document.createElement('div');root.append(box);
  if(socialData){renderSocial(box,{social:socialData,visitRows:snapshot?.weekly??[],state:socialState,onChange:patch=>{Object.assign(socialState,patch);draw();}});return;}
  box.append(node('p','Načítavam údaje zo sociálnych sietí…','crm-note'));
  if(socialLoading)return;
  requestSocial(error=>{if(live)box.replaceChildren(node('p','Údaje zo sociálnych sietí sa nepodarilo načítať.','crm-error'),button('Skúsiť znova',()=>draw()));});
 }
 // One shared fetch for the Social tab and the Overview reach box; the screen is redrawn when it arrives.
 function requestSocial(onFail){
  socialLoading=true;socialFailed=false;
  api('/api/crm/read',{body:{view:'SOCIAL_MEDIA_REPORT'}}).then(r=>{socialData=validateSocialReport(r.social);socialLoading=false;if(live&&(selectedSection==='social'||selectedSection==='overview'))draw();}).catch(error=>{socialLoading=false;if(!live)return;if(['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'].includes(error?.code)){onAuthFailure(error.code);return;}socialFailed=true;if(selectedSection==='overview'){draw();return;}onFail(error);});
 }
 function draw(){
  if(!live||!loaded)return;heading();
  const rows=history.included,hasHistory=rows.length>0,hasLive=Number(loaded.coverage.recorded_days)>0,sales=loaded.sales;
  const partialVisits=partialVisitRows(snapshot,history.partial,range.from,range.to),visitRows=[...rows,...partialVisits.rows],visitWeeks=weekModel(visitRows),hasVisitHistory=visitRows.length>0;
  const weeks=withSocialReach(weekModel(rows),socialData),facts=normalizeFacts(snapshot),allWeeks=historicalPeriods(snapshot),fullWeeks=withSocialReach(weekModel(allWeeks),socialData);
  // One compact bar: section tabs on the left, period controls on the right (wraps on narrow screens).
  const bar=node('div',undefined,'crm-report-bar');
  const nav=node('nav',undefined,'crm-report-tabs');nav.setAttribute('aria-label','Sekcie reportingu');for(const [key,label] of [['overview','Prehľad'],['attendance','Návštevnosť'],['sales','Predaj a zisk'],['catalogue','Produkty a služby'],['social','Sociálne siete']]){const tab=button(label,()=>{selectedSection=key;draw();});if(key===selectedSection)tab.setAttribute('aria-current','page');nav.append(tab);}
  const period=node('div',undefined,'crm-report-period-group'),selectLabel=node('label'),select=node('select');select.setAttribute('aria-label','Obdobie reportu');selectLabel.append(node('span','Obdobie','crm-sr-only'));
  const optionFor=(value,text)=>{const o=node('option',text);o.value=value;return o;};
  const first=allWeeks[0],isAll=range.from===first.period_start&&range.to>=allWeeks.at(-1).period_end;
  const single=allWeeks.find(w=>w.period_start===range.from&&w.period_end===range.to);
  select.append(optionFor('all','Všetky týždne'),...allWeeks.map(w=>optionFor('w'+w.week,'W'+w.week+' · '+shortRange(w.period_start,w.period_end))),...monthKeys(first.period_start).map(k=>optionFor('m'+k,monthLabelOf(k)+(k===currentMonth().from.slice(0,7)?' (tento mesiac)':''))),optionFor('custom','Vlastné obdobie'));
  const months=monthKeys(first.period_start),monthHit=months.find(k=>{const r=monthRange(k);return r.from===range.from&&r.to===range.to;});
  select.value=isAll?'all':single?'w'+single.week:monthHit?'m'+monthHit:'custom';
  select.onchange=()=>{const v=select.value;if(v==='all'){range={from:first.period_start,to:currentMonth().to};load();}else if(v[0]==='m'&&/^m\d{4}-\d{2}$/.test(v)){range=monthRange(v.slice(1));load();}else if(v==='custom'){root.querySelector('.crm-report-period input')?.focus();}else{const w=allWeeks.find(x=>'w'+x.week===v);range={from:w.period_start,to:w.period_end};load();}};
  selectLabel.append(select);
  const form=node('form',undefined,'crm-report-period'),fromLabel=node('label','Od'),from=node('input'),toLabel=node('label','Do'),to=node('input'),submit=node('button','Zobraziť obdobie'),notice=node('p',undefined,'crm-error');
  for(const [input,value,label] of [[from,range.from,fromLabel],[to,range.to,toLabel]]){input.type='date';input.required=true;input.value=value;label.append(input);}submit.type='submit';notice.setAttribute('role','alert');form.append(fromLabel,toLabel,submit,notice);form.onsubmit=event=>{event.preventDefault();const error=reportingPeriodError(from.value,to.value);if(error){notice.textContent=error;return;}range={from:from.value,to:to.value};load();};
  period.append(selectLabel,form);bar.append(nav,period);root.append(bar);
  if(selectedSection==='social'){period.hidden=true;drawSocial();return;}
  const sources=new Map((snapshot.week_sources??[]).map(s=>[s.week,s.source_kind]));
  // Explanatory notes live in the tooltip of one short status chip instead of paragraphs above the data.
  const info=node('p',undefined,'crm-report-badge'),recordedDays=Number(loaded.coverage.recorded_days);
  const chip=node('span',hasLive?'CRM · '+count(recordedDays)+' dní':'CRM · zatiaľ bez záznamov','crm-chip');chip.tabIndex=0;
  chip.title=reportingCoverageMessage(loaded.coverage)+(hasHistory?' Zahrnuté sú '+rows.length+' anonymné týždenné súhrny bez priradenia ku klientkam; CRM záznamy sa za tieto týždne nepripočítavajú druhýkrát.':'')+(weeks.length>1?' Zmena: '+weeks.at(-1).label+' oproti '+weeks.at(-2).label+'. Zmena kum: '+weeks.at(-1).label+' oproti '+weeks[0].label+'. N/A znamená chýbajúci alebo nulový základ.':'');
  chip.setAttribute('aria-label',chip.title);
  info.append(chip,node('span',hasHistory&&weeks.length?'Údaje '+dateLabel(weeks[0].period_start)+' – '+dateLabel(weeks.at(-1).period_end)+' · '+weeks.length+' '+(weeks.length===1?'týždeň':weeks.length<5?'týždne':'týždňov'):'Bez týždenných súhrnov','crm-note'));
  if(hasHistory&&[...sources.values()].some(v=>v==='CRM'))info.append(node('span','Týždne zo zdroja CRM: '+weeks.filter(w=>sources.get(w.week)==='CRM').map(w=>w.label).join(', '),'crm-note'));
  root.append(info);
  const cut=label=>partialVisits.rows.map(r=>'W'+r.week+' ('+dateLabel(r.from)+' – '+dateLabel(r.to)+')').join(', ');
  if(partialVisits.rows.length)root.append(node('p','Návštevy a typy vstupov zahŕňajú aj časť týždňa '+cut()+' podľa denného rozpisu. Tržby, produkty a náklady máme len za celý týždeň, preto sa počítajú iba z celých týždňov'+(weeks.length?' ('+weeks.map(w=>w.label).join(', ')+')':'')+'.','crm-note'));
  if(partialVisits.unavailable.length)root.append(node('p','Pre časť týždňa '+partialVisits.unavailable.map(r=>'W'+r.week).join(', ')+' chýba denný rozpis návštev, preto nie je započítaná.','crm-error'));
  const sum=key=>rows.every(r=>Number.isFinite(r[key]))?rows.reduce((n,r)=>n+r[key],0):null;
  const money=value=>value===null?'Neúplné údaje':euro(Number(value).toFixed(2));
  const total=(key,liveKey)=>sum(key)===null?null:sum(key)+(hasLive?Number(sales[liveKey]??0):0);
  const chg=key=>changes(weeks,key,fullWeeks);
  const cards=node('div',undefined,'crm-kpi-grid');
  const sumV=key=>visitRows.length&&visitRows.every(r=>Number.isFinite(r[key]))?visitRows.reduce((n,r)=>n+r[key],0):null;
  const visitsTotal=hasVisitHistory||hasLive?(sumV('visits')??0)+(hasLive?loaded.attendance.reduce((n,r)=>n+Number(r.visit_count),0):0):null;
  const noData='Bez evidencie';
  const salesTotal=hasHistory||hasLive?total('recorded_sales','confirmed_sales_eur'):null;
  const msTotal=hasHistory||hasLive?total('multisport_receivable','multisport_receipts_eur'):null;
  const bothTotal=hasHistory||hasLive?(total('report_value','confirmed_sales_eur')===null?null:total('report_value','confirmed_sales_eur')+(hasLive?Number(sales.multisport_receipts_eur??0):0)):null;
  const section=selectedSection;
  if(section==='overview'||section==='attendance')cards.append(kpiCard({title:'Návštevy',value:visitsTotal===null?noData:count(visitsTotal),note:'Vstupy, nie unikátne klientky',change:chg('visits')}));
  if(section==='attendance')for(const [key,label,code] of [['membership','Permanentky','ENTITLEMENT'],['single','Jednorazové vstupy','SINGLE_ENTRY'],['multisport','MultiSport','MULTISPORT']])cards.append(kpiCard({title:label,value:hasVisitHistory||hasLive?count((sumV(key)??0)+(hasLive?Number(loaded.attendance.find(r=>r.code===code)?.visit_count??0):0)):noData,note:'Podľa typu vstupu',hint:'Týždenné súhrny bez klientky; CRM podľa evidovaného typu vstupu.',change:chg(key)}));
  if(section==='overview'||section==='sales'){
   cards.append(kpiCard({title:'Predaj a MultiSport',value:bothTotal===null?noData:money(bothTotal),note:'Tržby vrátane MultiSport',hint:'Vstupy, permanentky, tréningy a produkty plus úhrady od MultiSport za vstupy.',change:chg('total')}));
   if(section==='sales'){cards.append(kpiCard({title:'Zaznamenaný predaj',value:salesTotal===null?noData:money(salesTotal),note:'Bez MultiSport',hint:'Bez MultiSport úhrad; sám osebe nepotvrdzuje prijatie platby.',change:chg('sales')}),kpiCard({title:'MultiSport',value:msTotal===null?noData:money(msTotal),note:'Započítaný raz',hint:'Zahrnutý raz podľa obdobia vstupu; neskoršie vyúčtovanie sa nepripočítava.',change:chg('multisportValue')}));}
   if(section==='overview'){
    // Overview: costs and profit share one box; the former profit box makes room for social reach.
    cards.append(kpiCard({title:'Náklady vs Zisk',value:hasHistory?money(sum('product_profit')):noData,note:hasHistory?'Zisk z produktov · náklady '+money(sum('product_cost')):'Bez evidencie',hint:'Zisk = predajná cena mínus nákupná cena predaných produktov; náklady = ich nákupná cena podľa referenčných cien, nie podľa faktúr. Služby (vstupy, permanentky, tréningy), nájom, mzdy ani energie sa sem nerátajú. Zmena sa týka zisku.',change:chg('profit')}));
    const reach=sumKnown(weeks,'reach'),igReach=sumKnown(weeks,'igReach'),reachLoading=!socialData&&!socialFailed;
    cards.append(kpiCard({title:'Dosah sociálnych sietí',value:reachLoading?'Načítavam…':reach===null?(socialData?'Neúplné údaje':noData):count(reach),note:reach===null?'Facebook · týždenný dosah':'Facebook'+(igReach===null?'':' · Instagram '+count(igReach)+' zvlášť'),hint:'Súčet týždenného dosahu stránky na Facebooku (jedineční ľudia za týždeň) za vybrané týždne. Instagram je uvedený zvlášť, pretože sa dosahy prekrývajú a nedajú sa sčítať.',change:chg('reach'),neutral:true}));
   }else cards.append(kpiCard({title:'Náklady vs Zisk',value:hasHistory?money(sum('product_profit')):noData,note:hasHistory?'Zisk z produktov · náklady '+money(sum('product_cost')):'Bez evidencie',hint:'Zisk = predajná cena mínus nákupná cena predaných produktov; náklady = ich nákupná cena podľa referenčných cien, nie podľa faktúr. Služby (vstupy, permanentky, tréningy), nájom, mzdy ani energie sa sem nerátajú. Zmena sa týka zisku.',change:chg('profit')}));
   if(section==='sales'&&hasLive)cards.append(kpiCard({title:'Potvrdené CRM platby po refundáciách',value:euro(sales.net_confirmed_payments_eur),note:'Len CRM obdobia',hint:'Len CRM obdobia. Platby zo súhrnov nemožno bez dokladov označiť za potvrdené.'}));
  }
  if(section==='overview'&&(weeks.length||visitWeeks.length)){
   // Part 1: each box gets the chart of the same metric directly under it.
   const minis=[[[['Návštevy po týždňoch','visits',SERIES_COLORS.visits]],formatCount,undefined,formatCount,'Návštevy po týždňoch'],[[['Predaj a MultiSport po týždňoch','total',SERIES_COLORS.sales]],formatEuro,formatEuroShort,formatCompactNumber,'Predaj a MultiSport po týždňoch'],[[['Náklady','cost',SERIES_COLORS.cost],['Zisk','profit',SERIES_COLORS.profit]],formatEuro,formatEuroShort,formatCompactNumber,'Náklady a zisk po týždňoch'],[[['Facebook','reach',SOCIAL_COLORS.facebook],['Instagram','igReach',SOCIAL_COLORS.instagram]],formatCount,undefined,formatCount,'Dosah sociálnych sietí po týždňoch']];
   cards.replaceChildren(...[...cards.children].map((card,i)=>{const [defs,format,axisFormat,valueFormat,label]=minis[i],src=defs[0][1]==='visits'?visitWeeks:weeks,col=node('div',undefined,'crm-kpi-col'),box=node('div',undefined,'crm-chart-card crm-mini-chart');box.append(columnChart({labels:src.map(w=>w.label),series:defs.map(([name,key,color])=>({name,color,values:src.map(w=>w[key])})),format,axisFormat,valueFormat,ariaLabel:label,size:'compact'}));col.append(card,box);return col;}));
  }
  if(section==='catalogue'){
   const units=sum('product_units');
   cards.append(kpiCard({title:'Predané produkty',value:units===null?noData:count(units),note:'Kusy v celých týždňoch',hint:'Počet predaných produktov podľa týždenných súhrnov, bez jednotlivých nákupov.',change:chg('productUnits')}),kpiCard({title:'Zaznamenaný predaj',value:salesTotal===null?noData:money(salesTotal),note:'Služby a produkty, bez MultiSport',hint:'Bez MultiSport úhrad; sám osebe nepotvrdzuje prijatie platby.',change:chg('sales')}),kpiCard({title:'Zisk z produktov',value:hasHistory?money(sum('product_profit')):noData,note:'Predajná mínus nákupná cena',hint:'Podľa referenčných nákupných cien, nie podľa faktúr. Služby sa sem nerátajú.',change:chg('profit')}),kpiCard({title:'Náklady na produkty',value:hasHistory?money(sum('product_cost')):noData,note:'Nákupná cena predaných produktov',hint:'Podľa referenčných cien, nie podľa faktúr.',change:chg('cost')}));
  }
  if(section==='overview'&&!socialData&&!socialLoading&&!socialFailed)requestSocial(()=>{});
  cards.dataset.n=String(cards.children.length);if(cards.children.length)root.append(cards);
  const labels=weeks.map(w=>w.label),vlabels=visitWeeks.map(w=>w.label),charts=node('div',undefined,'crm-chart-grid');let overviewTable=null;
  const needWeeks=()=>charts.append(unavailable(weeks.length?'Grafy potrebujú týždenné súhrny za vybrané obdobie.':'Za vybrané obdobie nie sú týždenné súhrny na zobrazenie grafov.'));
  if(!((section==='overview'||section==='attendance')?visitWeeks:weeks).length)needWeeks();
  else if(section==='overview'){
   // Part 2: charts and a table that all follow ONE time grain (days / weeks / months).
   const daily=dailySeries(facts,visitWeeks),grains=[{key:'day',label:'Dni'},{key:'week',label:'Týždne'},{key:'month',label:'Mesiace'}];
   if(timeGrain==='day'&&!daily.length)timeGrain='week';
   const head=node('div',undefined,'crm-part-head');head.append(node('h3','Vývoj v čase','crm-part-title'),segmentControl({options:grains.map(g=>({...g,disabled:g.key==='day'&&!daily.length,title:'Denný rozpis návštev zatiaľ nie je dostupný.'})),value:timeGrain,onPick:g=>{timeGrain=g;draw();},ariaLabel:'Časové zobrazenie grafov a tabuľky'}));root.append(head);
   const mixDaily=dailyMix(facts,visitWeeks),vs=visitsSeries(visitWeeks,daily,timeGrain),ms=mixSeries(visitWeeks,timeGrain,mixDaily),forms={day:'dňoch',week:'týždňoch',month:'mesiacoch'},monthNote='Mesiac = týždne podľa štvrtka; týždeň sa nedelí medzi mesiace.';
   charts.append(
    chartCard('Návštevy',columnChart({labels:vs.labels,series:[{name:'Návštevy',color:SERIES_COLORS.visits,values:vs.values}],bands:vs.bands,ariaLabel:'Návštevy po '+forms[timeGrain]}),timeGrain==='month'?monthNote:timeGrain==='day'?'Víkendy sú zvýraznené.':undefined),
    ms?chartCard('Mix vstupov po '+forms[timeGrain],columnChart({labels:ms.labels,stacked:true,bands:ms.bands??[],series:[{name:'Permanentky',color:SERIES_COLORS.membership,values:ms.membership},{name:'Jednorazové vstupy',color:SERIES_COLORS.single,values:ms.single},{name:'MultiSport',color:SERIES_COLORS.multisport,values:ms.multisport}],ariaLabel:'Mix vstupov po '+forms[timeGrain]}),timeGrain==='month'?monthNote:undefined):Object.assign(chartCard('Mix vstupov',unavailable('Rozpis vstupov po dňoch zatiaľ nemáme. Vyber týždne alebo mesiace.')),{className:'crm-chart-card crm-chart-card-empty'}));
   const wd=weekdayChartData(daily);
   charts.classList.add('crm-chart-grid-3');
   charts.append(daily.length?chartCard('Priemerná návštevnosť podľa dňa v týždni',columnChart({labels:wd.labels,shortLabels:wd.shortLabels,series:[{name:'Priemer návštev za deň',color:SERIES_COLORS.visits,colors:wd.colors,values:wd.values}],format:formatOneDecimal,axisFormat:formatOneDecimal,ariaLabel:'Priemerná návštevnosť podľa dňa v týždni'}),'Priemer za zaznamenané dni; víkend je sivý.'):chartCard('Priemerná návštevnosť podľa dňa v týždni',unavailable('Denný rozpis návštev zatiaľ nie je dostupný.')));
   const fullDaily=dailySeries(facts,fullWeeks),model=tableModel(visitWeeks,daily,timeGrain,tableMetric,mixDaily,{weeks:fullWeeks,daily:fullDaily,dailyMix:dailyMix(facts,fullWeeks)}),pick=node('label',undefined,'crm-metric-pick'),metricSelect=node('select');
   metricSelect.setAttribute('aria-label','Ukazovateľ, ku ktorému sa vzťahujú stĺpce zmien');for(const m of model.columns){const o=node('option',m.label);o.value=m.key;metricSelect.append(o);}
   metricSelect.value=model.metricKey;metricSelect.disabled=model.columns.length<2;if(model.columns.length<2)metricSelect.title='Po dňoch máme len návštevy.';metricSelect.onchange=()=>{tableMetric=metricSelect.value;draw();};
   pick.append(node('span','Zmena podľa'),metricSelect);
   overviewTable=chartCard('Tabuľka',reportTable(model,{rowHeader:timeGrain==='day'?'Deň':timeGrain==='month'?'Mesiac':'Týždeň'}),model.note,pick);overviewTable.classList.add('crm-table-card');
  }else if(section==='attendance'){
   const daily=dailySeries(facts,visitWeeks);
   charts.append(chartCard('Návštevy po týždňoch',columnChart({labels:vlabels,series:[{name:'Návštevy',color:SERIES_COLORS.visits,values:visitWeeks.map(w=>w.visits)}],ariaLabel:'Návštevy po týždňoch'})));
   if(daily.length){
    charts.append(chartCard('Návštevy po dňoch',columnChart({labels:daily.map(d=>d.label.slice(0,5)),series:[{name:'Návštevy',color:SERIES_COLORS.visits,values:daily.map(d=>d.value)}],bands:daily.flatMap((d,i)=>d.weekend?[i]:[]),ariaLabel:'Návštevy po dňoch; víkendy sú zvýraznené'}),'Víkendy sú zvýraznené podkladom.'));
    charts.append(chartCard('Priemerná návštevnosť podľa dňa v týždni',columnChart({labels:weekdayAverages(daily).map(d=>d.label),series:[{name:'Priemer',color:SERIES_COLORS.single,values:weekdayAverages(daily).map(d=>d.average===null?null:Math.round(d.average*10)/10)}],bands:[5,6],format:v=>new Intl.NumberFormat('sk-SK',{maximumFractionDigits:1}).format(v),ariaLabel:'Priemerná návštevnosť podľa dňa v týždni'}),'Priemer len zo dní, ktoré boli zaznamenané; chýbajúci deň sa nepočíta ako nula.'));
   }else charts.append(unavailable('Denný rozpis návštev zatiaľ nie je dostupný.'));
   charts.append(chartCard('Mix vstupov po týždňoch',columnChart({labels:vlabels,stacked:true,series:[{name:'Permanentky',color:SERIES_COLORS.membership,values:visitWeeks.map(w=>w.membership)},{name:'Jednorazové vstupy',color:SERIES_COLORS.single,values:visitWeeks.map(w=>w.single)},{name:'MultiSport',color:SERIES_COLORS.multisport,values:visitWeeks.map(w=>w.multisport)}],ariaLabel:'Mix vstupov po týždňoch'})));
  }else if(section==='sales'){
   charts.append(chartCard('Predaj, priame náklady a zisk po týždňoch',columnChart({labels,series:[{name:'Predaj a MultiSport',color:SERIES_COLORS.sales,values:weeks.map(w=>w.total)},{name:'Priame náklady',color:SERIES_COLORS.cost,values:weeks.map(w=>w.cost)},{name:'Hrubý zisk produktov',color:SERIES_COLORS.profit,values:weeks.map(w=>w.profit)}],format:formatEuro,axisFormat:formatEuroShort,ariaLabel:'Predaj, priame náklady a zisk po týždňoch'}),'N/A znamená, že hodnota nie je známa; nie je to nula.'));
  }
  charts.dataset.n=String(charts.children.length);if(charts.children.length&&section!=='catalogue')root.append(charts);
  if(overviewTable)root.append(overviewTable);
  if(section==='sales')root.append(node('p','Priame náklady a zisk zatiaľ nie sú vypočítané pre CRM transakcie. '+(hasLive?'':'Potvrdené CRM platby zatiaľ nie sú evidované. ')+multisportReportingMessage(),'crm-note'));
  if(section==='catalogue'){
   const split=salesSplitSeries(facts,weeks,salesGrain),sGrains=[{key:'day',label:'Dni'},{key:'week',label:'Týždne'},{key:'month',label:'Mesiace'}],sForms={day:'dňoch',week:'týždňoch',month:'mesiacoch'};
   const splitHead=node('div',undefined,'crm-part-head');splitHead.append(node('h3','Predaj služieb a produktov','crm-part-title'),segmentControl({options:sGrains.map(g=>({...g,title:g.key==='day'?'Predaj po dňoch zatiaľ nemáme, rozpis je týždenný.':undefined})),value:salesGrain,onPick:g=>{salesGrain=g;draw();},ariaLabel:'Časové zobrazenie grafu predaja'}));root.append(splitHead);
   const splitGrid=node('div',undefined,'crm-chart-grid crm-chart-grid-1');splitGrid.append(split?chartCard('Predaj služieb a produktov po '+sForms[salesGrain],columnChart({labels:split.labels,series:[{name:'Predaj služieb',color:SERIES_COLORS.services,values:split.services},{name:'Predaj produktov',color:SERIES_COLORS.products,values:split.products}],format:formatEuro,axisFormat:formatEuroShort,valueFormat:formatCompactNumber,ariaLabel:'Predaj služieb a produktov po '+sForms[salesGrain]}),salesGrain==='month'?'Mesiac = týždne podľa štvrtka; týždeň sa nedelí medzi mesiace.':undefined):chartCard('Predaj služieb a produktov po '+sForms[salesGrain],unavailable(salesGrain==='day'?'Predaj po dňoch zatiaľ nemáme, rozpis je týždenný. Vyber týždne alebo mesiace.':'Rozpis predaja po službách a produktoch zatiaľ nie je dostupný.')));root.append(splitGrid);
   const rankBox=node('section',undefined,'crm-chart-card'),toggle=node('div',undefined,'crm-segment'),kindToggle=node('div',undefined,'crm-segment');
   for(const [key,label] of [['all','Všetko'],['PRODUCT','Produkty'],['SERVICE','Služby']]){const b=button(label,()=>{productKind=key;draw();});if(productKind===key)b.setAttribute('aria-pressed','true');kindToggle.append(b);}
   for(const [key,label] of [['sales','Podľa predaja'],['profit','Podľa hrubého zisku']]){const b=button(label,()=>{productMetric=key;draw();});if(productMetric===key)b.setAttribute('aria-pressed','true');toggle.append(b);}
   rankBox.append(node('h3',(productKind==='PRODUCT'?'Produkty':productKind==='SERVICE'?'Služby':'Produkty a služby')+(productMetric==='sales'?' podľa predaja':' podľa hrubého zisku')),kindToggle,toggle);
   const ranking=productRanking(facts,weeks,productMetric,productKind);
   rankBox.append(ranking.length?rankingChart({rows:ranking,ariaLabel:'Poradie produktov a služieb'}):unavailable(productMetric==='profit'?'Hrubý zisk po položkách nie je dostupný, kým nie sú známe nákupné ceny.':'Rozpis po položkách zatiaľ nie je dostupný.'));
   root.append(rankBox);
   const crmHead=node('div',undefined,'crm-part-head');crmHead.append(node('h3','Predané produkty a služby v CRM','crm-part-title'));root.append(crmHead);const list=node('ul',undefined,'crm-list');for(const row of loaded.items){const li=node('li');li.append(node('strong',row.name),node('p',quantity(row.quantity)+' '+row.unit+' · '+euro(row.sales_eur)));list.append(li);}if(!loaded.items.length)list.append(node('li','V CRM časti obdobia nie sú potvrdené položkové predaje.'));root.append(list);if(hasHistory)root.append(node('p','Anonymné týždenné súhrny: '+count(sum('product_units'))+' produktov, '+count(sum('pass_units'))+' permanentiek, '+count(sum('training_units'))+' tréningov. Dostupný súhrn neobsahuje jednotlivé nákupy ani priradenie ku klientkam.','crm-note'));
  }
  if(hasHistory){const details=node('details'),title=node('summary','Zdrojové týždenné súhrny a pôvod údajov');details.append(title);const table=node('table',undefined,'crm-report-table');table.setAttribute('aria-label','Týždenné súhrny');const head=node('thead'),tr=node('tr');for(const label of ['Týždeň','Obdobie','Zdroj','Návštevy','Predaj a MultiSport'])tr.append(node('th',label));head.append(tr);const body=node('tbody');for(const row of rows){const tr=node('tr');for(const value of ['W'+row.week,historicalPeriodLabel(row.period_start,row.period_end),sources.get(row.week)==='CRM'?'CRM':'Ručný záznam',count(row.visits),money(row.report_value)])tr.append(node('td',value));body.append(tr);}table.append(head,body);const wrap=node('div',undefined,'crm-table-scroll');wrap.append(table);details.append(wrap,node('p','Podklad vytvorený '+dateLabel(snapshot.generated_at.slice(0,10))+'. Údaje zostávajú súhrnmi, nevytvárajú jednotlivé transakcie.','crm-note'));root.append(details);}
  if(loaded.limitations.multisport_receipts==='PARTIAL_RATE_COVERAGE')root.append(node('p','Niektorým CRM MultiSport vstupom chýba platná sadzba; suma je neúplná.','crm-error'));
 }
 load();return {dispose(){live=false;sequence++;controller?.abort();}};
}
