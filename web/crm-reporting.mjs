// Owner-only live CRM reporting. The backend independently enforces OWNER_ADMIN and UAT denial.
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(className)el.className=className;return el;};
const button=(label,fn)=>{const el=node('button',label);el.type='button';el.addEventListener('click',fn);return el;};
let range=null,selectedSection='overview';
const historicalKeys=['week','period_start','period_end','visits','membership','single','multisport','new_visitors','pass_units','product_units','training_units','zumba_hours','recorded_sales','report_value','sheet_price_value','product_cost','product_profit','multisport_receivable','change_pct'];
function currentMonth(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),v=Object.fromEntries(parts.map(p=>[p.type,p.value]));return {from:v.year+'-'+v.month+'-01',to:v.year+'-'+v.month+'-'+v.day};}
function dateLabel(value){const match=typeof value==='string'&&value.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return 'Dátum na kontrolu';const [,y,m,d]=match,date=new Date(Date.UTC(+y,+m-1,+d));return date.toISOString().slice(0,10)===value?new Intl.DateTimeFormat('sk-SK',{day:'numeric',month:'numeric',year:'numeric',timeZone:'UTC'}).format(date):'Dátum na kontrolu';}
function historicalPeriodLabel(from,to){const start=typeof from==='string'?dateLabel(from):null,end=typeof to==='string'?dateLabel(to):null;if(start&&end)return start+' – '+end;if(start)return 'od '+start;if(end)return 'do '+end;return 'Dátumy v snapshot-e nie sú uvedené';}
function euro(value){if(typeof value!=='string'||!/^-?\d{1,12}(\.\d{1,2})?$/.test(value))return 'Suma na kontrolu';return new Intl.NumberFormat('sk-SK',{style:'currency',currency:'EUR'}).format(Number(value));}
function count(value){const n=Number(value);return Number.isSafeInteger(n)&&n>=0?new Intl.NumberFormat('sk-SK').format(n):'—';}
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
 if(!snapshot||snapshot.schema_version!==1||snapshot.source!=='Lady Fitness Reporting MVP · weekly aggregate query'||!Array.isArray(snapshot.weekly)||snapshot.weekly.length!==5||!snapshot.snapshot_period||typeof snapshot.generated_at!=='string'||!/^([a-f0-9]{64})$/.test(snapshot.source_sha256)||!snapshot.limitations||['scope','costs','missing','receipts'].some(key=>typeof snapshot.limitations[key]!=='string'))throw new Error('HISTORICAL_SNAPSHOT_INVALID');
 if(!Array.isArray(snapshot.snapshot_period.weeks)||snapshot.snapshot_period.weeks.join(',')!=='40,41,42,43,44')throw new Error('HISTORICAL_SNAPSHOT_INVALID');
 const weeks=new Set();
 for(const row of snapshot.weekly){
  if(!row||Object.keys(row).sort().join('|')!==[...historicalKeys].sort().join('|')||!Number.isInteger(row.week)||row.week<40||row.week>44||weeks.has(row.week))throw new Error('HISTORICAL_SNAPSHOT_INVALID');
  weeks.add(row.week);
  for(const key of historicalKeys.filter(key=>!['period_start','period_end'].includes(key)))if(row[key]!==null&&(!Number.isFinite(row[key])||typeof row[key]!=='number'))throw new Error('HISTORICAL_SNAPSHOT_INVALID');
  for(const key of ['period_start','period_end'])if(row[key]!==null&&(typeof row[key]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(row[key])))throw new Error('HISTORICAL_SNAPSHOT_INVALID');
 }
 return snapshot;
}
export function mountReporting({root,api,onAuthFailure,onBack}){
 let live=true,loaded=null,historical=null,mode='live',sequence=0,requestController=null;
 const back=()=>{if(typeof onBack==='function')root.append(button('Späť na prehľad',onBack));};
 function modeTabs(parent){const nav=node('nav',undefined,'crm-report-tabs');nav.setAttribute('aria-label','Typ reportingu');for(const [key,label] of [['live','Živé CRM'],['historical','Historický snapshot']]){const tab=button(label,()=>{if(mode===key)return;mode=key;load();});if(mode===key)tab.setAttribute('aria-current','page');nav.append(tab);}parent.append(nav);}
 async function load(){if(!live)return;const current=++sequence;requestController?.abort();requestController=new AbortController();const period=mode==='live'?(range??(range=currentMonth())):null;root.replaceChildren(node('h2','Reporting'));back();modeTabs(root);root.append(node('p','Načítavam '+(mode==='live'?'živý CRM súhrn…':'historický snapshot…'),'crm-note'));try{if(mode==='historical'){const result=await api('/api/crm/read',{body:{view:'HISTORICAL_REPORT'},signal:requestController.signal});historical=validateHistoricalSnapshot(result?.snapshot);loaded=null;}else{loaded=await api('/api/crm/read',{body:{view:'REPORT_SUMMARY',date_from:period.from,date_to:period.to},signal:requestController.signal});historical=null;}if(live&&current===sequence)draw();}catch(error){if(!live||current!==sequence||error.name==='AbortError')return;if(['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'].includes(error.code)){onAuthFailure(error.code);return;}const retry=button('Skúsiť znova',()=>load());root.replaceChildren(node('h2','Reporting'));back();modeTabs(root);root.append(node('p',mode==='historical'?'Historický snapshot nie je dostupný. Živé CRM údaje sa tým nemenia. Skontroluj pripojenie a skús obnoviť údaje.':'Súhrn nie je dostupný. Skontroluj pripojenie a skús obnoviť údaje.','crm-error'),retry);}}
 function drawHistorical(){
  if(!live||!historical)return;root.replaceChildren(node('h2','Reporting'));back();modeTabs(root);
  root.append(node('p','Historický snapshot · W40–W44 · zdrojový report vytvorený '+dateLabel(historical.generated_at?.slice?.(0,10))+'. Dátum jednotlivých neskorších opráv nie je samostatne potvrdený.','crm-note'));
  const weeks=historical.weekly,totals=weeks.reduce((acc,row)=>{for(const key of ['visits','report_value','recorded_sales','product_cost','product_profit','multisport_receivable'])acc[key]=(acc[key]??0)+(Number.isFinite(row[key])?row[key]:0);return acc;},{});
  const cards=node('div',undefined,'crm-grid');
  const metric=(label,value,note)=>{const card=node('article',undefined,'crm-card');card.append(node('h3',label),node('p',value),node('p',note,'crm-note'));cards.append(card);};
  metric('Historické návštevy',count(totals.visits),'Súčet týždenných snapshotov W40–W44.');
  metric('Zaznamenaný predaj + MultiSport',euro(String(totals.report_value)),'Pôvodná reportová hodnota; nie je to potvrdená živá CRM úhrada.');
  metric('MultiSport podľa snapshotu',euro(String(totals.multisport_receivable)),'Historická hodnota sa nepripočítava k tomuto reportu druhýkrát.');
  metric('Priame produktové náklady',euro(String(totals.product_cost)),'Historický model; nezahŕňa nájom, mzdy ani energie.');
  metric('Modelovaný hrubý zisk produktov',euro(String(totals.product_profit)),'Historická modelová hodnota, nie čistý zisk fitka.');
  root.append(cards,node('p',''+(historical.limitations?.receipts||'Historické peňažné údaje sa nezlučujú so živým CRM reportingom.'),'crm-note'));
  const table=node('table',undefined,'crm-report-table');table.setAttribute('aria-label','Historické týždenné súhrny');const head=node('thead'),header=node('tr');for(const label of ['Týždeň','Obdobie','Návštevy','Permanentky','Jednorazové vstupy','MultiSport vstupy','Zaznamenaný predaj + MultiSport','Priame náklady produktov','Modelovaný hrubý zisk']){const th=node('th',label);th.scope='col';header.append(th);}head.append(header);const body=node('tbody');
  for(const row of weeks){const tr=node('tr'),period=historicalPeriodLabel(row.period_start,row.period_end);tr.append(node('th','W'+row.week),node('td',period),node('td',count(row.visits)),node('td',count(row.membership)),node('td',count(row.single)),node('td',count(row.multisport)),node('td',euro(String(row.report_value))),node('td',euro(String(row.product_cost))),node('td',euro(String(row.product_profit))));body.append(tr);}
  table.append(head,body);const wrap=node('div',undefined,'crm-table-scroll');wrap.append(table);root.append(wrap,node('p',historical.limitations?.costs,'crm-note'),node('p','Zdroj: '+historical.source+' · SHA-256 '+historical.source_sha256,'crm-note'));
 }
 function draw(){
  if(mode==='historical'){drawHistorical();return;}
  if(!live||!loaded)return;root.replaceChildren(node('h2','Reporting'));back();modeTabs(root);
  const form=node('form',undefined,'crm-report-period'),fromLabel=node('label','Od'),from=node('input'),toLabel=node('label','Do'),to=node('input'),submit=node('button','Zobraziť obdobie'),periodNotice=node('p',undefined,'crm-note');
  from.type='date';from.required=true;from.value=range.from;fromLabel.append(from);to.type='date';to.required=true;to.value=range.to;toLabel.append(to);submit.type='submit';periodNotice.hidden=true;periodNotice.setAttribute('role','alert');form.append(fromLabel,toLabel,submit,periodNotice);root.append(form);
  form.addEventListener('submit',event=>{event.preventDefault();const error=reportingPeriodError(from.value,to.value);if(error){periodNotice.textContent=error;periodNotice.hidden=false;return;}periodNotice.hidden=true;range={from:from.value,to:to.value};load();});
  const nav=node('nav',undefined,'crm-report-tabs');nav.setAttribute('aria-label','Sekcie reportingu');
  for(const [key,label] of [['overview','Prehľad'],['attendance','Návštevnosť'],['sales','Predaj a zisk'],['catalogue','Produkty a služby']]){const tab=button(label,()=>{selectedSection=key;draw();});if(key===selectedSection)tab.setAttribute('aria-current','page');nav.append(tab);}root.append(nav);
  root.append(node('p','Obdobie '+dateLabel(loaded.period.from)+' – '+dateLabel(loaded.period.to)+' · súhrn z evidencie CRM.','crm-note'));
  const coverage=loaded.coverage??{},recordedDays=Number(coverage.recorded_days),coverageNote=reportingCoverageMessage(coverage);
  root.append(node('p',coverageNote,'crm-note'));
  const cards=node('div',undefined,'crm-grid'),sales=loaded.sales??{},visits=(loaded.attendance??[]).reduce((sum,row)=>sum+(Number(row.visit_count)||0),0),noRecordedDays=Number.isSafeInteger(recordedDays)&&recordedDays===0;
  const reportedMoney=value=>noRecordedDays?'Bez evidencie':euro(value),reportedCount=value=>noRecordedDays?'Bez evidencie':count(value);
  const metric=(label,value,detail)=>{const card=node('article',undefined,'crm-card');card.append(node('h3',label),node('p',value),node('p',detail,'crm-note'));cards.append(card);};
  if(selectedSection==='overview'){
   metric('Zaúčtované návštevy',noRecordedDays?'Bez evidencie':count(visits),'Počítajú sa iba návštevy so stavom zaúčtované.');
   metric('Potvrdené predaje',reportedMoney(sales.confirmed_sales_eur),reportedCount(sales.confirmed_sales)+' potvrdených predajov');
   metric('Potvrdené platby po refundáciách',reportedMoney(sales.net_confirmed_payments_eur),reportedMoney(sales.confirmed_receipts_eur)+' prijaté · '+reportedMoney(sales.confirmed_refunds_eur)+' refundované');
   metric('MultiSport úhrady',reportedMoney(sales.multisport_receipts_eur),reportedCount(sales.multisport_confirmed_visits)+' potvrdených vstupov');
   metric('Prijaté úhrady spolu',reportedMoney(sales.total_recognized_receipts_eur),'Platby po refundáciách vrátane MultiSport.');
   root.append(cards,node('h3','Úplnosť evidencie'),node('p',count(coverage.recorded_days)+' evidovaných dní · '+count(coverage.complete_days)+' úplných · '+count(coverage.incomplete_days)+' s chýbajúcimi údajmi.','crm-note'));
  }else if(selectedSection==='attendance'){
   root.append(cards,node('h3','Návštevy podľa typu vstupu'));const list=node('ul',undefined,'crm-list');for(const row of loaded.attendance??[]){const item=node('li');item.append(node('strong',row.label_sk),node('p',noRecordedDays?'Bez evidencie pracovných dní':count(row.visit_count)+' zaúčtovaných návštev'));list.append(item);}if(!(loaded.attendance??[]).length)list.append(node('li',noRecordedDays?'Údaje o návštevnosti nie sú potvrdené; obdobie nemá evidované pracovné dni.':'V tomto období nie sú zaúčtované návštevy.'));root.append(list);
  }else if(selectedSection==='sales'){
   metric('Potvrdené predaje',reportedMoney(sales.confirmed_sales_eur),reportedCount(sales.confirmed_sales)+' predajov podľa dátumu predaja');metric('Prijaté platby',reportedMoney(sales.confirmed_receipts_eur),'Len potvrdené platby podľa dátumu platby.');metric('Refundácie',reportedMoney(sales.confirmed_refunds_eur),'Len potvrdené refundácie podľa dátumu platby.');metric('Platby po refundáciách',reportedMoney(sales.net_confirmed_payments_eur),'Samostatný peňažný tok v zvolenom období.');metric('MultiSport úhrady',reportedMoney(sales.multisport_receipts_eur),reportedCount(sales.multisport_confirmed_visits)+' potvrdených vstupov');metric('Prijaté úhrady spolu',reportedMoney(sales.total_recognized_receipts_eur),'Platby po refundáciách vrátane MultiSport.');root.append(cards,node('p','Priame náklady a zisk zatiaľ nie sú vypočítané: tento živý report ešte neprepája nákladové dáta. '+multisportReportingMessage(),'crm-note'));
  }else{
   root.append(cards,node('h3','Predané produkty a služby'));const list=node('ul',undefined,'crm-list');for(const row of loaded.items??[]){const item=node('li');item.append(node('strong',row.name),node('p',(row.kind==='PRODUCT'?'Produkt':'Služba')+' · '+quantity(row.quantity)+' '+row.unit+' · '+(noRecordedDays?'Bez evidencie':euro(row.sales_eur))+' · '+(noRecordedDays?'Bez evidencie':count(row.confirmed_sales)+' predajov')));list.append(item);}if(!(loaded.items??[]).length)list.append(node('li',noRecordedDays?'Predaje nie sú potvrdené, pretože obdobie nemá evidované pracovné dni.':'V tomto období nie sú potvrdené predaje.'));root.append(list);
  }
  if(loaded.limitations?.multisport_receipts==='PARTIAL_RATE_COVERAGE')root.append(node('p','Pre '+count(sales.multisport_unrated_visits)+' MultiSport vstupov chýba platná sadzba. Súčet úhrad je neúplný.','crm-error'));
  root.append(node('p','Historické zápisy zo staršieho reportu sa nemiešajú so živými CRM transakciami.','crm-note'));
 }
 load();return {dispose(){live=false;sequence++;requestController?.abort();}};
}

