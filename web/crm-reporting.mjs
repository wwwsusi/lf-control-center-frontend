// Owner-only live CRM reporting. The backend independently enforces OWNER_ADMIN and UAT denial.
const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(className)el.className=className;return el;};
const button=(label,fn)=>{const el=node('button',label);el.type='button';el.addEventListener('click',fn);return el;};
let range=null,selectedSection='overview';
function currentMonth(){const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()),v=Object.fromEntries(parts.map(p=>[p.type,p.value]));return {from:v.year+'-'+v.month+'-01',to:v.year+'-'+v.month+'-'+v.day};}
function dateLabel(value){const match=typeof value==='string'&&value.match(/^(\d{4})-(\d{2})-(\d{2})$/);if(!match)return 'Dátum na kontrolu';const [,y,m,d]=match,date=new Date(Date.UTC(+y,+m-1,+d));return date.toISOString().slice(0,10)===value?new Intl.DateTimeFormat('sk-SK',{day:'numeric',month:'numeric',year:'numeric',timeZone:'UTC'}).format(date):'Dátum na kontrolu';}
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
export function mountReporting({root,api,onAuthFailure}){
 let live=true,loaded=null,sequence=0,requestController=null;
 async function load(){if(!live)return;const current=++sequence;requestController?.abort();requestController=new AbortController();const period=range??(range=currentMonth());root.replaceChildren(node('h2','Reporting'),node('p','Načítavam súhrn…','crm-note'));try{loaded=await api('/api/crm/read',{body:{view:'REPORT_SUMMARY',date_from:period.from,date_to:period.to},signal:requestController.signal});if(live&&current===sequence)draw();}catch(error){if(!live||current!==sequence||error.name==='AbortError')return;if(['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'].includes(error.code)){onAuthFailure(error.code);return;}const retry=button('Skúsiť znova',()=>load());root.replaceChildren(node('h2','Reporting'),node('p','Súhrn nie je dostupný. Skontroluj pripojenie a skús obnoviť údaje.','crm-error'),retry);}}
 function draw(){
  if(!live||!loaded)return;root.replaceChildren(node('h2','Reporting'));
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

