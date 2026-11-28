import {showToast} from './crm-toast.mjs';
// Visit intent stays in memory. A pending result cannot create another operation.
const uuid=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(v);
const rev=v=>typeof v==='string'&&/^[1-9][0-9]{0,17}$/.test(v);
export function membershipValidityLabel(e){
 if(!e.activated_on)return 'Aktivuje sa prvým vstupom';
 if(typeof e.expires_on!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(e.expires_on))return 'Dátum platnosti vyžaduje kontrolu';
 const end=new Date(e.expires_on+'T00:00:00Z');
 if(!Number.isFinite(end.getTime())||end.toISOString().slice(0,10)!==e.expires_on)return 'Dátum platnosti vyžaduje kontrolu';
 end.setUTCDate(end.getUTCDate()-1);
 return 'Platí do '+new Intl.DateTimeFormat('sk-SK',{timeZone:'UTC'}).format(end)+' vrátane';
}
// The pass name comes from the catalogue; a time pass can run 1, 2, 3, 6 or 12 months, so no length is assumed.
export const passName=e=>e.service_name||(e.type_at_purchase==='TIME_ACCESS'?'Časová permanentka':'Permanentka na vstupy');
const packageDay=value=>{const [y,m,d]=String(value).split('-');return Number(d)+'. '+Number(m)+'. '+y;};
// Why an entitlement bought in a package cannot be used today, or null. The database enforces the same rule.
export function packageBlock(e){
 if(!e.package)return null;
 if(e.package.not_yet_usable)return 'Využitie od '+packageDay(e.package.usable_from);
 return e.package.start_expired?'Nezačaté do '+packageDay(e.package.start_by):null;
}
export function entryMembershipLabel(e){
 const count='Použiť permanentku · čerpané '+e.consumed+' / '+(e.included_units_at_purchase??'neurčené');
 if(e.validity_value_at_purchase===6&&e.validity_unit_at_purchase==='MONTH')return count+' · '+(!e.activated_on?'Platnosť 6 mesiacov od prvého vstupu':membershipValidityLabel(e));
 return count+(e.expires_on?' · '+membershipValidityLabel(e):'');
}
// One tile design for every way of entering: name, optional detail (price), one action line. Used by single entry and MultiSport.
export function entryTile({name,detail=null,note=null,action='Zapísať vstup',label=null,onClick,disabled=false}){
 const b=document.createElement('button');b.type='button';b.className='crm-price-btn';b.disabled=disabled;if(label)b.setAttribute('aria-label',label);
 const n=document.createElement('span');n.textContent=name;b.append(n);
 if(detail){const d=document.createElement('span');d.className='crm-tile-detail';d.textContent=detail;b.append(d);}
 if(note){const m=document.createElement('span');m.textContent=note;b.append(m);}
 const a=document.createElement('strong');a.textContent=action;b.append(a);b.addEventListener('click',onClick);return b;
}
export function entitlementDetail(e){
 if(e.type_at_purchase==='TIME_ACCESS')return {detail:membershipValidityLabel(e),note:null};
 const total=Number(e.included_units_at_purchase),used=Number(e.consumed);
 return {detail:Number.isFinite(total)&&Number.isFinite(used)?'Zostáva '+(total-used)+' z '+total+' vstupov':'Čerpané '+e.consumed+' vstupov',note:e.expires_on?membershipValidityLabel(e):null};
}
export function visitPayload(admission,customer=null,entitlement=null,purchase=null){
 if(!uuid(admission?.id)||!rev(admission?.revision))throw Error('INVALID_ADMISSION');
 if(customer!==null&&(!uuid(customer?.id)||!rev(customer?.revision)||customer.status!=='ACTIVE'))throw Error('INVALID_CUSTOMER');
 if(admission.code==='ENTITLEMENT'){
  if(purchase!==null||!customer||!uuid(entitlement?.id)||!rev(entitlement?.revision)||entitlement.status!=='ENABLED'||!['VISIT_COUNT','TIME_ACCESS'].includes(entitlement.type_at_purchase))throw Error('INVALID_ENTITLEMENT');
 }else if(admission.code==='SINGLE_ENTRY'){
  if(entitlement!==null||!uuid(purchase?.id)||!uuid(purchase?.sale_id)||!rev(purchase?.sale_revision)||purchase.customer_id!==(customer?.id??null))throw Error('INVALID_ENTRY_PURCHASE');
 }else if(admission.code!=='MULTISPORT'||entitlement!==null||purchase!==null)throw Error('UNSUPPORTED_ADMISSION');
 return {customer_id:customer?.id??null,customer_revision:customer?.revision??null,admission_id:admission.id,admission_revision:admission.revision,entitlement_id:entitlement?.id??null,entitlement_revision:entitlement?.revision??null,sale_item_id:purchase?.id??null,sale_revision:purchase?.sale_revision??null};
}
// Connection loss handling: an unconfirmed write is held in memory only (nothing is stored in the browser)
// and the SAME request (same request_id and payload) is replayed when the connection returns. The server
// claims every request_id once, so a replay returns the stored result instead of writing twice.
export const isConnectionLoss=error=>Boolean(error)&&error.name!=='AbortError'&&(error.code==='UNAVAILABLE'||(!error.code&&(error.name==='TypeError'||/fetch|network|load failed/i.test(String(error.message||'')))));
export function createReconnect({isLive,isBusy,run,onGiveUp=()=>{},intervalMs=8000,maxMs=300000}){
 let timer=0,startedAt=0;
 const tick=()=>{if(isBusy())return;if(!isLive()){stop();return;}if(Date.now()-startedAt>maxMs){stop();onGiveUp();return;}if(globalThis.navigator?.onLine===false)return;run();};
 function stop(){clearInterval(timer);timer=0;globalThis.removeEventListener?.('online',tick);}
 function start(){if(timer)return;startedAt=Date.now();timer=setInterval(tick,intervalMs);globalThis.addEventListener?.('online',tick);}
 return {start,stop,active:()=>timer!==0};
}
export const WAITING_TEXT='Bez spojenia. Zápis čaká a odošle sa sám po obnovení spojenia. Zostaň na tejto obrazovke.';
export function createVisitWriter(api,{signal,onChange=()=>{},onSuccess=()=>{},onError=()=>{},newId=()=>crypto.randomUUID(),reconnectMs=8000}={}){
 let live=true,busy=false,pending=null,done=false;
 const reconnect=createReconnect({isLive:()=>live&&!!pending&&!done,isBusy:()=>busy,run:()=>send(),onGiveUp:()=>onError({code:'UNAVAILABLE',gaveUp:true}),intervalMs:reconnectMs});
 const notify=()=>{if(live)onChange({busy,pending:!!pending,done});};
 async function send(readback=false){
  if(!live||busy||!pending)return;busy=true;notify();
  try{
   const data=await api(readback?'/api/crm/readback?request_id='+encodeURIComponent(pending.request_id):'/api/crm/operations',{...(readback?{}:{body:pending}),signal});
   if(!live)return;
   if(data.operation?.state==='REJECTED'){pending=null;reconnect.stop();onError({code:data.operation.result_code||'BUSINESS_REJECTED',rejected:true});return;}
   if(data.operation?.state!=='COMPLETED'||data.operation.target_type!=='visit'||!uuid(data.projection?.id)||data.projection.status!=='POSTED')throw Error('UNVERIFIED');
   pending=null;done=true;reconnect.stop();onSuccess(data.projection);
  }catch(error){if(live&&error.name!=='AbortError'){if(readback&&error.code==='BUSINESS_REJECTED'){pending=null;reconnect.stop();onError({code:'NOT_RECORDED',notRecorded:true});}else if(isConnectionLoss(error)){reconnect.start();onError({code:'UNAVAILABLE',waiting:true});}else{if(!pending||error.code)reconnect.stop();onError(error);}}}
  finally{busy=false;notify();}
 }
 return {submit(payload){if(!live||busy||pending||done)return;pending={request_id:newId(),operation_type:'CHECK_IN',payload:structuredClone(payload)};return send();},verify:()=>send(true),retry:()=>send(),dispose(){live=false;reconnect.stop();pending=null;}};
}
export function mountCheckin({root,api,customer=null,onBack,onAuthFailure,onVisitConfirmed=()=>{},only=null,title=null,backLabel='Späť',doneMs=4000,quick=false,onDone=null}){
 let doneTimer=0,toast=null;const backNow=()=>{clearTimeout(doneTimer);doneTimer=0;onBack();};let live=true,generation=0,admissions=[],entitlements=[],loading=true,message='',entryPurchases=new Map(),state={busy:false,pending:false,done:false};const controller=new AbortController();
 const el=(tag,value)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);return x;};
 const button=(label,action)=>{const x=el('button',label);x.type='button';x.disabled=state.busy;x.addEventListener('click',action);return x;};
 const writer=createVisitWriter(api,{signal:controller.signal,onChange:s=>{state=s;render();},onSuccess:()=>{message='Návšteva bola uložená a overená.';try{onVisitConfirmed();}catch{}if(onDone)toast=showToast({text:message,ms:3000,onClose:()=>{toast=null;if(live)onDone();}});},onError:error=>{if(['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'].includes(error.code)){onAuthFailure(error.code);return;}message=error.waiting?WAITING_TEXT:error.gaveUp?'Spojenie sa neobnovilo. Zápis zostáva nepotvrdený, over ho tlačidlom.':error.notRecorded?'Zápis sa na serveri nenašiel. Nič sa nezapísalo, vstup môžeš zopakovať.':error.rejected?'Návšteva nebola uložená. Skontroluj platnosť permanentky, zostávajúce vstupy a pravidlá vstupu.':error.code==='POLICY_BLOCKED'?'Vstup nie je povolený aktuálnymi pravidlami.':'Výsledok nie je potvrdený. Over tú istú operáciu; nevytváraj nový vstup.';}});
 function render(){
  if(!live)return;root.replaceChildren(...(quick?[]:[el('h2',title??(customer?'Vstup · '+customer.name:'Vstup bez identifikovanej klientky'))]));
  if(message&&!(onDone&&state.done)){const p=el('p',message);p.setAttribute('role','status');root.append(p);}
  if(state.done&&onDone)return;
  if(state.done){const b=el('div',undefined,'crm-banner');b.dataset.kind='ok';b.setAttribute('role','status');b.append(el('strong',message||'Návšteva bola uložená a overená.'));root.replaceChildren(el('h2',title??(customer?'Vstup · '+customer.name:'Vstup bez identifikovanej klientky')),b,button(backLabel,backNow));if(!doneTimer)doneTimer=setTimeout(()=>{doneTimer=0;if(live)onBack();},doneMs);return;}
  if(state.pending){root.append(el('p','Rozpracovaný zápis návštevy. Ďalší vstup je zablokovaný do overenia výsledku.'),button('Overiť ten istý zápis',writer.verify),button('Zopakovať ten istý zápis',writer.retry));return;}
  if(loading){root.append(el('p','Načítavam možnosti vstupu…'));return;}
  if(!admissions.length)root.append(el('p','Nie sú dostupné schválené možnosti vstupu.'));
  if(quick){
   const grid=el('div');grid.className='crm-price-grid';
   for(const a of admissions){
    if(a.code==='MULTISPORT')grid.append(entryTile({name:'MultiSport',label:'Zapísať MultiSport vstup',disabled:state.busy,onClick:()=>writer.submit(visitPayload(a,customer))}));
    else if(a.code==='ENTITLEMENT'&&customer){
     for(const e of entitlements.filter(x=>x.status==='ENABLED'&&['VISIT_COUNT','TIME_ACCESS'].includes(x.type_at_purchase))){const blocked=packageBlock(e),shown=entitlementDetail(e);grid.append(entryTile({name:passName(e),...shown,...(blocked?{note:blocked,action:'Zatiaľ nedostupné'}:{}),label:'Zapísať vstup · '+(e.type_at_purchase==='TIME_ACCESS'?passName(e):'permanentka na vstupy'),disabled:state.busy||blocked!==null,onClick:()=>writer.submit(visitPayload(a,customer,e))}));}
    }
   }
   if(grid.children.length)root.append(grid);
   else root.append(el('p',customer?'Klientka nemá platnú permanentku. Kúp novú nižšie.':'Nie sú dostupné schválené možnosti vstupu.','crm-lead'));
   return;}
  for(const a of admissions){const card=el('article');card.className='crm-card';card.append(el('h3',a.label_sk));
   if(a.code==='MULTISPORT')card.append(button('Zapísať MultiSport vstup',()=>writer.submit(visitPayload(a,customer))));
   else if(a.code==='ENTITLEMENT'){
    if(!customer)card.append(el('p','Najprv vyber klientku v zozname klientov.'));
    const eligible=entitlements.filter(e=>e.status==='ENABLED'&&['VISIT_COUNT','TIME_ACCESS'].includes(e.type_at_purchase));
    for(const e of eligible){const blocked=packageBlock(e),use=button((e.type_at_purchase==='TIME_ACCESS'?'Použiť · '+passName(e)+' · '+membershipValidityLabel(e):entryMembershipLabel(e))+(blocked?' · '+blocked:''),()=>writer.submit(visitPayload(a,customer,e)));if(blocked){use.disabled=true;use.dataset.blocked='true';}card.append(use);}
    if(customer&&!eligible.length)card.append(el('p','Klientka nemá platnú permanentku. Ak chce pokračovať, kúp novú v kroku 1.'));
   }else if(a.code==='SINGLE_ENTRY'){
    const page=entryPurchases.get(a.id);
    card.append(el('p','Vyber nepoužitý vstup z potvrdeného nákupu.'));
    if(!page)card.append(el('p','Predaje pre tento vstup nie sú dostupné.'));
    else{for(const item of page.items)card.append(button('Použiť vstup · '+item.display_name_at_sale+' · '+item.business_date+' · '+item.actual_unit_price+' EUR',()=>writer.submit(visitPayload(a,customer,null,item))));
     if(!page.items.length)card.append(el('p','Zatiaľ nie je čo použiť. Najprv kúp vstup v kroku 1 a potvrď nákup.'));
     if(page.next)card.append(button('Ďalšie predaje',()=>loadEntries(a,page.next)));}
   }else card.append(el('p','Tento typ vstupu zatiaľ nie je podporovaný.'));
   root.append(card);
  }
  root.append(el('p','Oprávnenosť a zostávajúce vstupy overí server pri zápise.'),button(backLabel,onBack));
 }
 async function loadEntries(a,after,version=generation){try{const page=await api('/api/crm/read',{body:{view:'ENTRY_PURCHASES',admission_id:a.id,...(customer?{customer_id:customer.id}:{}),...(after?{after}:{})},signal:controller.signal});if(live&&version===generation){entryPurchases.set(a.id,page);render();}}catch(error){if(!live||version!==generation||error.name==='AbortError')return;if(['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'].includes(error.code))onAuthFailure(error.code);else{message='Predaje pre tento vstup sa nepodarilo načítať.';render();}}}
 async function load(){const version=++generation;try{
  const a=await api('/api/crm/read',{body:{view:'ADMISSIONS'},signal:controller.signal});if(!live||version!==generation)return;admissions=only?a.items.filter(x=>only.includes(x.code)):a.items;
  if(customer){const c=await api('/api/crm/read',{body:{view:'CUSTOMER',customer_id:customer.id},signal:controller.signal});if(!live||version!==generation)return;customer=c.customer;entitlements=c.entitlements;if(c.entitlements_truncated)message='Zobrazených je prvých 20 permanentiek; zoznam nie je úplný.';}
  for(const a of admissions.filter(a=>a.code==='SINGLE_ENTRY'))await loadEntries(a,undefined,version);
 }catch(error){if(!live||version!==generation||error.name==='AbortError')return;if(['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'].includes(error.code))onAuthFailure(error.code);else message='Možnosti vstupu sa nepodarilo načítať.';}finally{if(live&&version===generation){loading=false;render();}}}
 render();load();return {hasPending:()=>state.busy||state.pending,refresh(){if(!live||state.busy||state.pending)return false;loading=true;message='';render();load();return true;},dispose(){live=false;clearTimeout(doneTimer);toast?.close(true);generation++;writer.dispose();controller.abort();root.replaceChildren();}};
}
