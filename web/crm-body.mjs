// Client profile → body composition: recorded consent, new measurement, history and the printable report.
// Values live only in memory and on screen; nothing is kept in the browser. Every write uses one request id,
// so an unverified result can be checked or repeated without storing the same thing twice.
import {MAIN_FIELDS,SEGMENTS,RECOMMENDATIONS,DEFAULT_RECOMMENDATIONS,MAX_RECOMMENDATIONS,readValues,num,fmt} from './crm-body-model.mjs';
import {buildReport} from './crm-body-report.mjs';
const AUTH=['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'],FINAL=['VALIDATION_ERROR','POLICY_BLOCKED','BUSINESS_REJECTED','REVISION_CONFLICT','REQUEST_CONFLICT'];
export const localToday=(now=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Bratislava',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const skDay=v=>{const [y,m,d]=String(v).split('-').map(Number);return d+'. '+m+'. '+y;};
export function mountBodyMeasurements({root,api,customer,onBack,onAuthFailure}){
 let live=true,busy=false,pending=null,after=null,data=null,observer=null,printRoot=null,pageStyle=null;
 const controller=new AbortController();
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(label,fn,cls)=>{const b=el('button',label,cls);b.type='button';b.addEventListener('click',fn);return b;};
 const wrap=el('section',undefined,'crm-card crm-body'),title=el('h2','Meranie tela'),who=el('p',customer.name,'crm-note'),screen=el('div',undefined,'crm-body');
 const notice=el('p');notice.setAttribute('role','status');
 const verify=button('Overiť výsledok',()=>send(true)),retry=button('Zopakovať tú istú požiadavku',()=>send(false)),pendingBar=el('div',undefined,'crm-body-actions');
 pendingBar.append(verify,retry);
 wrap.append(title,who,screen,notice,pendingBar);root.replaceChildren(wrap);
 function lock(){
  if(!live)return;const locked=busy||!!pending;
  for(const n of screen.querySelectorAll('button,input'))n.disabled=locked;
  pendingBar.hidden=!pending;verify.disabled=retry.disabled=busy;
 }
 function leaveReport(){observer?.disconnect();observer=null;printRoot?.remove();pageStyle?.remove();printRoot=pageStyle=null;document.body.classList.remove('crm-body-print');}
 function show(...nodes){leaveReport();screen.replaceChildren(...nodes);lock();}
 const actions=(...items)=>{const x=el('div',undefined,'crm-body-actions');x.append(...items);return x;};
 const backToClient=()=>button('Späť ku klientke',()=>{if(live&&!busy&&!pending)onBack();});
 async function load(message=''){
  show(el('p','Načítavam merania…','crm-note'));notice.textContent=message;busy=true;lock();
  try{const out=await api('/api/crm/read',{body:{view:'BODY_MEASUREMENTS',customer_id:customer.id},signal:controller.signal});if(!live)return;data=out;busy=false;overview();}
  catch(error){busy=false;if(!live||error.name==='AbortError')return;if(AUTH.includes(error.code)){onAuthFailure(error.code);return;}
   show(el('p',error.code==='POLICY_BLOCKED'?'Meranie tela zatiaľ nie je zapnuté.':'Merania sa nepodarilo načítať.','crm-note'),actions(button('Skúsiť znova',()=>load()),backToClient()));}
 }
 const base=()=>({customer_id:data.customer.id,expected_revision:String(data.customer.revision)});
 // `after(ok)` runs once the result is known; a refused write keeps the current screen so typed values are not lost.
 function begin(operation_type,payload,done){
  if(busy||pending)return;
  after=done;pending={request_id:crypto.randomUUID(),operation_type,payload:{...base(),...payload}};send(false);
 }
 function refuse(code){
  pending=null;
  if(code==='REVISION_CONFLICT'){load('Údaje sa medzičasom zmenili. Načítali sa znova, zápis sa neuložil.');return;}
  notice.textContent=code==='POLICY_BLOCKED'?'Meranie tela zatiaľ nie je zapnuté.':'Zápis sa neuložil. Skontroluj údaje, dátum a či je klientka aktívna.';
 }
 async function send(check){
  if(!live||busy||!pending)return;busy=true;notice.textContent=check?'Overujem výsledok…':'Ukladám…';lock();
  try{
   const out=await api(check?'/api/crm/readback?request_id='+encodeURIComponent(pending.request_id):'/api/crm/operations',{...(check?{}:{body:pending}),signal:controller.signal});
   if(!live)return;busy=false;
   const state=out.operation?.state;
   if(state==='REJECTED')refuse('BUSINESS_REJECTED');
   else if(state==='COMPLETED'&&out.operation?.target_type==='customer'){const done=after;pending=null;done();}
   else throw Error('UNVERIFIED');
  }catch(error){
   busy=false;if(!live||error.name==='AbortError')return;
   if(AUTH.includes(error.code)){onAuthFailure(error.code);return;}
   if(FINAL.includes(error.code))refuse(error.code);
   else notice.textContent='Výsledok sa nepodarilo overiť. Over výsledok alebo zopakuj tú istú požiadavku.';
  }finally{lock();}
 }
 function overview(){
  if(!data.consent)return consentScreen();
  const active=data.customer.status==='ACTIVE';
  const state=el('p','Súhlas zaznamenaný: podpísaný '+skDay(data.consent.granted_on)+', verzia '+data.consent.consent_version+'.','crm-note');
  const list=el('ul',undefined,'crm-body-list');
  data.items.forEach((m,i)=>{
   const row=el('li',undefined,'crm-body-row'),text=el('div');
   text.append(el('strong',skDay(m.measured_on)),el('span',' · '+fmt(num(m.weight_kg),1)+' kg'+(m.fat_pct===null?'':' · tuk '+fmt(num(m.fat_pct),1)+' %')));
   row.append(text,actions(button('Zobraziť report',()=>{if(!busy&&!pending){notice.textContent='';report(i);}}),button('Zneplatniť',()=>{
    if(busy||pending||!window.confirm('Zneplatniť meranie z '+skDay(m.measured_on)+'? Prestane sa zobrazovať a nedá sa obnoviť.'))return;
    begin('VOID_BODY_MEASUREMENT',{measurement_id:m.id,measurement_revision:m.revision},()=>load('Meranie je zneplatnené.'));})));
   list.append(row);
  });
  const nodes=[state];
  if(active)nodes.push(actions(button('Nové meranie',()=>{if(!busy&&!pending){notice.textContent='';form();}},'crm-profile-go')));
  else nodes.push(el('p','Klientka nie je aktívna. Nové meranie sa nezapíše.','crm-note'));
  nodes.push(data.items.length?list:el('p','Zatiaľ nie je zapísané žiadne meranie.','crm-note'));
  if(data.truncated)nodes.push(el('p','Zobrazených je posledných '+data.items.length+' meraní.','crm-note'));
  nodes.push(actions(backToClient(),button('Odvolať súhlas',()=>{
   if(busy||pending||!window.confirm('Zapísať odvolanie súhlasu? Merania klientky sa v CRM prestanú zobrazovať. Ak žiada aj ich vymazanie, povedz to majiteľke.'))return;
   begin('WITHDRAW_BODY_CONSENT',{consent_id:data.consent.id,consent_revision:data.consent.revision},()=>load('Súhlas je odvolaný. Merania sa už nezobrazujú.'));})));
  show(...nodes);
 }
 function field(label,type='text'){const box=el('label'),input=el('input');input.type=type;input.autocomplete='off';box.append(el('span',label),input);return {box,input};}
 function checkbox(label){const box=el('label',undefined,'crm-body-check'),input=el('input');input.type='checkbox';box.append(input,el('span',label));return {box,input};}
 function consentScreen(){
  if(data.customer.status!=='ACTIVE')return show(el('p','Klientka nemá platný súhlas a nie je aktívna.','crm-note'),actions(backToClient()));
  const signed=field('Dátum podpisu súhlasu','date');signed.input.value=localToday();signed.input.max=localToday();
  const confirm=checkbox('Klientka podpísala súhlas so spracovaním údajov z merania tela (verzia '+data.consent_version+') a má aspoň 18 rokov.');
  const save=button('Zaznamenať súhlas',()=>{
   if(!confirm.input.checked){notice.textContent='Najprv potvrď, že klientka súhlas podpísala.';return;}
   if(!signed.input.value||signed.input.value>localToday()){notice.textContent='Skontroluj dátum podpisu.';return;}
   begin('RECORD_BODY_CONSENT',{granted_on:signed.input.value},()=>load('Súhlas je zaznamenaný.'));
  },'crm-profile-go');
  show(el('p','Bez súhlasu klientky sa meranie nedá zapísať. Najprv jej daj podpísať papierový súhlas.','crm-note'),signed.box,confirm.box,actions(save,backToClient()));
 }
 function form(){
  const latest=data.items[0],inputs={},errors=el('ul',undefined,'crm-body-errors');
  const date=field('Dátum merania','date');date.input.value=localToday();date.input.max=localToday();
  const make=([key,label],grid)=>{const f=field(label);f.input.inputMode='decimal';f.input.name=key;inputs[key]=f.input;grid.append(f.box);};
  const main=el('div',undefined,'crm-body-grid');main.append(date.box);for(const f of MAIN_FIELDS)make(f,main);
  if(latest){inputs.age_years.value=latest.age_years;inputs.height_cm.value=latest.height_cm.replace(/\.0$/,'').replace('.',',');}
  const segments=el('div',undefined,'crm-body-grid crm-body-seg');
  for(const [s,name] of SEGMENTS){make(['seg_'+s+'_muscle_kg',name+': svaly (kg)'],segments);make(['seg_'+s+'_fat_pct',name+': tuk (%)'],segments);}
  const recs=el('div',undefined,'crm-body'),chosen=RECOMMENDATIONS.map(([code,text])=>{const c=checkbox(text);c.input.checked=DEFAULT_RECOMMENDATIONS.includes(code);recs.append(c.box);return [code,c.input];});
  const custom=field('Vlastné odporúčanie (nepíš zdravotné údaje)');custom.input.maxLength=90;
  const save=button('Uložiť meranie',()=>{
   const raw=Object.fromEntries(Object.entries(inputs).map(([k,n])=>[k,n.value])),{values,errors:found}=readValues(raw);
   const codes=chosen.filter(([,n])=>n.checked).map(([c])=>c),own=custom.input.value.trim()||null;
   if(!date.input.value||date.input.value>localToday())found.unshift({key:null,message:'Skontroluj dátum merania.'});
   if(codes.length+(own?1:0)>MAX_RECOMMENDATIONS)found.push({key:null,message:'V reporte je miesto najviac na '+MAX_RECOMMENDATIONS+' odporúčaní.'});
   for(const [k,n] of Object.entries(inputs))n.setAttribute('aria-invalid',String(found.some(e=>e.key===k)));
   errors.replaceChildren(...found.map(e=>el('li',e.message)));
   if(found.length){notice.textContent='Meranie sa neuložilo. Oprav označené údaje.';return;}
   begin('RECORD_BODY_MEASUREMENT',{consent_id:data.consent.id,measured_on:date.input.value,values,recommendation_codes:codes,custom_recommendation:own},()=>load('Meranie je uložené.'));
  },'crm-profile-go');
  show(el('h3','Hodnoty z displeja'),main,el('h3','Segmentálna analýza'),segments,el('h3','Odporúčania trénerky'),recs,custom.box,errors,
   actions(save,button('Zrušiť',()=>{if(!busy&&!pending){notice.textContent='';overview();}})));
 }
 function report(index){
  const options={name:data.customer.name,measurement:data.items[index],previous:data.items[index+1]??null};
  const stage=el('div',undefined,'crm-body-stage'),sheet=el('div',undefined,'crm-body-sheet');sheet.append(buildReport(options));stage.append(sheet);
  show(actions(button('Tlačiť report',()=>{if(live)window.print();},'crm-profile-go'),button('Späť na merania',()=>overview())),
   el('p','V tlačovom okne vyber veľkosť A4 a mierku 100 %. Report sa dá aj uložiť ako PDF.','crm-note'),stage);
  const fit=()=>{const s=Math.min(1,(stage.clientWidth||794)/794);sheet.style.transform='scale('+s+')';stage.style.height=(1123*s)+'px';};
  observer=new ResizeObserver(fit);observer.observe(stage);fit();
  // A second copy outside the page layout is what gets printed: exactly one A4 sheet.
  printRoot=el('div',undefined,'crm-body-printroot');printRoot.append(buildReport(options));document.body.append(printRoot);
  pageStyle=el('style','@page{size:A4 portrait;margin:0}');document.head.append(pageStyle);document.body.classList.add('crm-body-print');
 }
 load();
 return {hasPending:()=>!!pending||(busy&&!!data),dispose(){live=false;controller.abort();pending=null;data=null;leaveReport();root.replaceChildren();}};
}
