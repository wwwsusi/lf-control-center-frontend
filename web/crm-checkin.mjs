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
export function entryMembershipLabel(e){
 const count='Použiť permanentku · čerpané '+e.consumed+' / '+(e.included_units_at_purchase??'neurčené');
 if(e.validity_value_at_purchase===6&&e.validity_unit_at_purchase==='MONTH')return count+' · '+(!e.activated_on?'Platnosť 6 mesiacov od prvého vstupu':membershipValidityLabel(e));
 return count+(e.expires_on?' · '+membershipValidityLabel(e):'');
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
export function createVisitWriter(api,{signal,onChange=()=>{},onSuccess=()=>{},onError=()=>{},newId=()=>crypto.randomUUID()}={}){
 let live=true,busy=false,pending=null,done=false;
 const notify=()=>{if(live)onChange({busy,pending:!!pending,done});};
 async function send(readback=false){
  if(!live||busy||!pending)return;busy=true;notify();
  try{
   const data=await api(readback?'/api/crm/readback?request_id='+encodeURIComponent(pending.request_id):'/api/crm/operations',{...(readback?{}:{body:pending}),signal});
   if(!live)return;
   if(data.operation?.state==='REJECTED'){pending=null;onError({code:data.operation.result_code||'BUSINESS_REJECTED',rejected:true});return;}
   if(data.operation?.state!=='COMPLETED'||data.operation.target_type!=='visit'||!uuid(data.projection?.id)||data.projection.status!=='POSTED')throw Error('UNVERIFIED');
   pending=null;done=true;onSuccess(data.projection);
  }catch(error){if(live&&error.name!=='AbortError')onError(error);}
  finally{busy=false;notify();}
 }
 return {submit(payload){if(!live||busy||pending||done)return;pending={request_id:newId(),operation_type:'CHECK_IN',payload:structuredClone(payload)};return send();},verify:()=>send(true),retry:()=>send(),dispose(){live=false;pending=null;}};
}
export function mountCheckin({root,api,customer=null,onBack,onAuthFailure,onVisitConfirmed=()=>{},only=null,title=null,backLabel='Späť',doneMs=4000,quick=false,onDone=null}){
 let doneTimer=0,toast=null;const backNow=()=>{clearTimeout(doneTimer);doneTimer=0;onBack();};let live=true,generation=0,admissions=[],entitlements=[],loading=true,message='',entryPurchases=new Map(),state={busy:false,pending:false,done:false};const controller=new AbortController();
 const el=(tag,value)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);return x;};
 const button=(label,action)=>{const x=el('button',label);x.type='button';x.disabled=state.busy;x.addEventListener('click',action);return x;};
 const writer=createVisitWriter(api,{signal:controller.signal,onChange:s=>{state=s;render();},onSuccess:()=>{message='Návšteva bola uložená a overená.';try{onVisitConfirmed();}catch{}if(onDone)toast=showToast({text:message,ms:3000,onClose:()=>{toast=null;if(live)onDone();}});},onError:error=>{if(['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'].includes(error.code)){onAuthFailure(error.code);return;}message=error.rejected?'Návšteva nebola uložená. Skontroluj platnosť permanentky, zostávajúce vstupy a pravidlá vstupu.':error.code==='POLICY_BLOCKED'?'Vstup nie je povolený aktuálnymi pravidlami.':'Výsledok nie je potvrdený. Over tú istú operáciu; nevytváraj nový vstup.';}});
 function render(){
  if(!live)return;root.replaceChildren(...(quick?[]:[el('h2',title??(customer?'Vstup · '+customer.name:'Vstup bez identifikovanej klientky'))]));
  if(message){const p=el('p',message);p.setAttribute('role','status');root.append(p);}
  if(state.done&&onDone)return;
  if(state.done){const b=el('div',undefined,'crm-banner');b.dataset.kind='ok';b.setAttribute('role','status');b.append(el('strong',message||'Návšteva bola uložená a overená.'));root.replaceChildren(el('h2',title??(customer?'Vstup · '+customer.name:'Vstup bez identifikovanej klientky')),b,button(backLabel,backNow));if(!doneTimer)doneTimer=setTimeout(()=>{doneTimer=0;if(live)onBack();},doneMs);return;}
  if(state.pending){root.append(el('p','Rozpracovaný zápis návštevy. Ďalší vstup je zablokovaný do overenia výsledku.'),button('Overiť ten istý zápis',writer.verify),button('Zopakovať ten istý zápis',writer.retry));return;}
  if(loading){root.append(el('p','Načítavam možnosti vstupu…'));return;}
  if(!admissions.length)root.append(el('p','Nie sú dostupné schválené možnosti vstupu.'));
  if(quick){for(const a of admissions.filter(x=>x.code==='MULTISPORT')){const b=button('',()=>writer.submit(visitPayload(a,customer)));b.className='crm-action-tile';b.setAttribute('aria-label','Zapísať MultiSport vstup');b.append(el('strong','Zapísať MultiSport vstup'),el('span','Návšteva sa zapíše bez mena.'));root.append(b);}return;}
  for(const a of admissions){const card=el('article');card.className='crm-card';card.append(el('h3',a.label_sk));
   if(a.code==='MULTISPORT')card.append(button('Zapísať MultiSport vstup',()=>writer.submit(visitPayload(a,customer))));
   else if(a.code==='ENTITLEMENT'){
    if(!customer)card.append(el('p','Najprv vyber klientku v zozname klientov.'));
    const eligible=entitlements.filter(e=>e.status==='ENABLED'&&['VISIT_COUNT','TIME_ACCESS'].includes(e.type_at_purchase));
    for(const e of eligible)card.append(button(e.type_at_purchase==='TIME_ACCESS'?'Použiť mesačnú permanentku · '+membershipValidityLabel(e):entryMembershipLabel(e),()=>writer.submit(visitPayload(a,customer,e))));
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
