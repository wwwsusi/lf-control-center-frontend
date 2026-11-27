// Same-day cancellation of entries and sales (owner decision 2026-11-18, LF-CRM-CANCEL-2026-11).
// Shown in "Dnešné záznamy". The section stays hidden while the server feature is off. No customer names are shown.
import {showToast} from './crm-toast.mjs';
export const CANCEL_REASON_LABELS=Object.freeze({ENTRY_ERROR:'Omyl pri zápise',WRONG_ITEM:'Zlý produkt alebo vstup',DUPLICATE:'Duplicitný zápis',CUSTOMER_LEFT:'Klientka neodišla alebo nevstúpila',CATALOGUE_CHANGED:'Zmenila sa cena alebo ponuka'});
const HIDDEN_CODES=['FORBIDDEN','POLICY_BLOCKED','CRM_NOT_ACTIVE'];
const DEFINITE=['VALIDATION_ERROR','FORBIDDEN','POLICY_BLOCKED','BUSINESS_REJECTED','REVISION_CONFLICT'];
const ERROR_TEXT={REVISION_CONFLICT:'Záznam sa medzitým zmenil. Zoznam sa obnoví, skús to znova.',BUSINESS_REJECTED:'Tento záznam sa už nedá stornovať (je stornovaný alebo z iného dňa).',POLICY_BLOCKED:'Storno nie je povolené.',FORBIDDEN:'Na storno nemáš oprávnenie.',VALIDATION_ERROR:'Skontroluj výber dôvodu.'};
export const errorText=code=>ERROR_TEXT[code]||'Storno sa nepodarilo. Skús to znova.';
export const NOT_RECORDED_TEXT='Storno sa na serveri nenašlo. Nič sa nestornovalo, môžeš ho zopakovať.';
export const reasonLabel=code=>CANCEL_REASON_LABELS[code]||'Dôvod nie je uvedený';
export function cancellationRequest(item,date,reason,requestId){
 if(!CANCEL_REASON_LABELS[reason])throw Error('REASON');
 if(item.kind==='VISIT')return {request_id:requestId,operation_type:'CANCEL_VISIT',payload:{visit_id:item.id,business_date:date,expected_revision:item.revision,reason_code:reason}};
 if(item.kind==='SALE')return {request_id:requestId,operation_type:'CANCEL_SALE',payload:{sale_id:item.id,business_date:date,expected_revision:item.revision,line_fingerprint:item.line_fingerprint,reason_code:reason}};
 throw Error('KIND');
}
export const confirmText=item=>'Zruší sa: '+item.label+'.'+(item.kind==='VISIT'&&item.linked_sale?' Zruší sa aj naviazaný predaj.':'')+' Záznam ostane v histórii ako stornovaný.';
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(cls)n.className=cls;return n;};
const btn=(text,fn,cls)=>{const b=el('button',text,cls);b.type='button';b.addEventListener('click',fn);return b;};
const time=iso=>{const d=new Date(iso);return Number.isFinite(d.getTime())?d.toLocaleTimeString('sk-SK',{timeZone:'Europe/Prague',hour:'2-digit',minute:'2-digit'}):'';};
export function mountCancellation({root,api,role,date,onAuthFailure=()=>{},onChanged=()=>{}}){
 let live=true,busy=false,pending=null,selected=null,reason='';const controller=new AbortController();
 const section=el('section',undefined,'crm-cancel');section.hidden=true;root.append(section);
 const state={items:[],cancelled:null};
 async function load(){
  try{
   const data=await api('/api/crm/read',{body:{view:'CANCEL_CANDIDATES'},signal:controller.signal});if(!live)return;
   state.items=Array.isArray(data.items)?data.items:[];state.available=true;
   if(role==='OWNER_ADMIN'){try{const gone=await api('/api/crm/read',{body:{view:'CANCELLED_TODAY'},signal:controller.signal});if(live)state.cancelled=Array.isArray(gone.items)?gone.items:[];}catch(e){if(!live)return;state.cancelled=null;}}
   render();
  }catch(error){
   if(!live||error?.name==='AbortError')return;
   if(HIDDEN_CODES.includes(error?.code)){section.hidden=true;section.replaceChildren();return;}
   if(['AUTH_REQUIRED'].includes(error?.code)){onAuthFailure(error.code);return;}
   section.hidden=false;section.replaceChildren(el('h2','Stornovať záznam'),el('p','Zoznam na storno sa nepodarilo načítať.','crm-note'));
  }
 }
 function render(){
  if(!live)return;section.hidden=false;section.replaceChildren(el('h2','Stornovať záznam'),el('p','Len dnešné záznamy. Vstup a jeho predaj sa rušia spolu.','crm-note'));
  if(pending){section.append(statusBox());return;}
  if(selected){section.append(confirmBox());return;}
  if(!state.items.length)section.append(el('p','Dnes nie je čo stornovať.','crm-note'));
  const list=el('ul',undefined,'crm-cancel-list');
  for(const item of state.items){const li=el('li',undefined,'crm-cancel-row');const info=el('div');info.append(el('strong',item.label),el('p',time(item.occurred_at),'crm-note'));li.append(info,btn('Stornovať',()=>{selected=item;reason='';render();},'crm-cancel-open'));list.append(li);}
  section.append(list);
  if(state.cancelled&&state.cancelled.length){
   const box=el('div',undefined,'crm-cancel-done');box.append(el('h3','Stornované dnes (vidí len majiteľka)'));
   const ul=el('ul',undefined,'crm-cancel-list');for(const c of state.cancelled){const li=el('li',undefined,'crm-cancel-row');const info=el('div');info.append(el('strong',c.label),el('p',time(c.cancelled_at)+' · '+reasonLabel(c.reason_code),'crm-note'));li.append(info);ul.append(li);}
   box.append(ul);section.append(box);
  }
 }
 function confirmBox(){
  const box=el('div',undefined,'crm-cancel-confirm');box.append(el('h3','Potvrď storno'),el('p',confirmText(selected),'crm-note'));
  const fs=el('fieldset',undefined,'crm-cancel-reasons');fs.append(el('legend','Dôvod'));
  for(const [code,text] of Object.entries(CANCEL_REASON_LABELS)){const lab=el('label');const input=el('input');input.type='radio';input.name='cancel-reason';input.value=code;input.checked=reason===code;input.addEventListener('change',()=>{reason=code;go.disabled=false;});lab.append(input,el('span',text));fs.append(lab);}
  const go=btn('Potvrdiť storno',()=>submit(),'crm-cancel-go');go.disabled=!reason;
  box.append(fs,el('div',undefined,'crm-cancel-actions'));box.lastChild.append(go,btn('Späť',()=>{selected=null;reason='';render();}));
  return box;
 }
 function statusBox(){
  const box=el('div',undefined,'crm-cancel-confirm');box.setAttribute('role','status');
  box.append(el('p',pending.message,'crm-note'));
  if(pending.unknown)box.append(btn('Overiť výsledok',()=>send(true)));
  if(pending.error)box.append(btn('Späť na zoznam',()=>{pending=null;selected=null;reason='';load();}));
  return box;
 }
 function submit(){
  if(busy||pending||!selected||!reason)return;
  pending={request:cancellationRequest(selected,date,reason,crypto.randomUUID()),message:'Ukladám storno…'};send(false);
 }
 async function send(readback){
  if(busy||!pending)return;busy=true;pending.message=readback?'Overujem výsledok…':'Ukladám storno…';pending.unknown=false;render();
  try{
   const data=await api(readback?'/api/crm/readback?request_id='+encodeURIComponent(pending.request.request_id):'/api/crm/operations',{...(readback?{}:{body:pending.request}),signal:controller.signal});
   if(!live)return;
   if(data.operation?.state==='REJECTED'){const code=data.operation.result_code==='REJECTED'?'BUSINESS_REJECTED':data.operation.result_code;pending={message:errorText(code),error:true};render();return;}
   if(data.operation?.state!=='COMPLETED'||data.projection?.status!=='CANCELLED')throw Error('UNVERIFIED');
   pending=null;selected=null;reason='';showToast({text:'Záznam bol stornovaný'});if(section.isConnected)onChanged();await load();
  }catch(error){
   if(!live||error?.name==='AbortError')return;
   if(error?.code==='AUTH_REQUIRED'){onAuthFailure(error.code);return;}
   // Verifying a request the server never received answers BUSINESS_REJECTED: say that nothing was cancelled.
   if(readback&&error?.code==='BUSINESS_REJECTED')pending={message:NOT_RECORDED_TEXT,error:true};
   else if(DEFINITE.includes(error?.code))pending={message:errorText(error.code),error:true};
   else pending={...pending,message:'Výsledok nie je potvrdený. Over ho, nezapisuj storno znova.',unknown:true};
   render();
  }finally{busy=false;}
 }
 load();
 return {dispose(){live=false;controller.abort();section.remove();},hasPending:()=>Boolean(pending&&!pending.error)};
}
