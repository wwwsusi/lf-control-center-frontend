// Counter sales: anonymous one-click product sale, and a cart for a known client.
// sale -> confirmation is one chain driven by one explicit click. Every mutation keeps its own request_id,
// so a lost response is verified with a readback and never replayed as a new operation.
import {purchaseLine,purchaseCustomerReference} from './crm-purchase.mjs';
import {entryTile} from './crm-checkin.mjs';
import {showToast} from './crm-toast.mjs';
const AUTH=['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'],DEFINITIVE=['VALIDATION_ERROR','POLICY_BLOCKED','REVISION_CONFLICT','BUSINESS_REJECTED'];
const eur=v=>new Intl.NumberFormat('sk-SK',{style:'currency',currency:'EUR'}).format(Number(v));
const el=(tag,value,cls)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);if(cls)x.className=cls;return x;};
const plural=n=>n+' '+(n===1?'položka':n<5?'položky':'položiek');
export const byName=(a,b)=>String(a.name).localeCompare(String(b.name),'sk');
export function cartTotal(lines){return lines.reduce((n,l)=>n+Number(l.item.current_price_eur)*l.qty,0);}
export function mountSale({root,api,customer=null,cart=false,kinds=['products'],onAuthFailure,onDone=()=>{},bannerMs=3000}){
 const identity=purchaseCustomerReference(customer,customer===null);
 let live=true,busy=false,loading=true,items={products:[],services:[]},kind=kinds[0],lines=new Map(),ctx=null,notice=null,toast=null,celebrating=false,sort='az';
 const controller=new AbortController(),signal=controller.signal,read=body=>api('/api/crm/read',{body,signal});
 const clearToast=()=>{toast?.close(true);toast=null;};
 function finish(){if(!live||!celebrating)return;celebrating=false;toast=null;onDone();}
 function say(k,text,sub){if(k==='ok'){celebrating=true;notice=null;toast?.close(true);toast=showToast({text,sub,ms:bannerMs,onClose:finish});return;}notice={kind:k,text,sub};}
 async function load(){
  try{
   if(kinds.includes('products')){const p=await read({view:'PRODUCT_CATALOGUE'});if(!live)return;items.products=p.items.filter(i=>customer||i.requires_customer!==true);}
   if(kinds.includes('services')){const s=await read({view:'CATALOGUE'});if(!live)return;items.services=s.items.filter(i=>customer||i.requires_customer!==true);}
  }catch(error){if(!live||error.name==='AbortError')return;if(AUTH.includes(error.code)){onAuthFailure(error.code);return;}say('error','Ponuku sa nepodarilo načítať.');}
  finally{if(live){loading=false;render();}}
 }
 async function stageResult(stage,verify){
  const request_id=ctx.req[stage]??=crypto.randomUUID();
  if(verify)return api('/api/crm/readback?request_id='+encodeURIComponent(request_id),{signal});
  let payload;
  if(stage==='create')payload={...identity,lines:ctx.lines.map(l=>purchaseLine(l.item,l.kind,l.qty,identity,l.activationMode))};
  else{
   if(!ctx.checkout){ctx.checkout=await read({view:'OWN_CHECKOUT',sale_id:ctx.saleId});if(!live)return null;}
   const {sale,catalogue,resume_blocked}=ctx.checkout;if(resume_blocked)throw Object.assign(Error('BLOCKED'),{code:'BUSINESS_REJECTED'});
   payload={sale_id:sale.id,expected_revision:sale.revision,customer_revision:sale.customer_id?sale.customer_revision:null,line_fingerprint:sale.line_fingerprint,catalogue};
  }
  return api('/api/crm/operations',{body:{request_id,operation_type:stage==='create'?'CREATE_SALE':'CONFIRM_SALE',payload},signal});
 }
 async function drive(verify=false){
  if(!live||busy||!ctx)return;busy=true;ctx.unverified=false;notice=null;render();
  try{
   while(ctx.stage!=='done'){
    const data=await stageResult(ctx.stage,verify);if(!live||!data)return;verify=false;
    if(data.operation?.state==='REJECTED')throw Object.assign(Error('REJECTED'),{code:'BUSINESS_REJECTED'});
    if(data.operation?.state!=='COMPLETED')throw Error('UNVERIFIED');
    if(ctx.stage==='create'){if(typeof data.projection?.id!=='string')throw Error('UNVERIFIED');ctx.saleId=data.projection.id;ctx.stage='confirm';}
    else ctx.stage='done';
   }
   const label=ctx.label;ctx=null;lines=new Map();say('ok','Nákup bol zaznamenaný.',label);
  }catch(error){
   if(!live||error.name==='AbortError')return;
   if(AUTH.includes(error.code)){onAuthFailure(error.code);return;}
   if(DEFINITIVE.includes(error.code)){say('error',ctx?.saleId?'Nákup sa nepodarilo dokončiť. Nájdeš ho v Rozpracovaných predajoch.':'Nákup sa nepodarilo zapísať. Skontroluj pravidlá a skús znova.');ctx=null;}
   else{ctx.unverified=true;say('error','Výsledok nie je potvrdený. Over ho, nezapisuj nákup znova.');}
  }finally{busy=false;if(live)render();}
 }
 function start(list){if(busy||ctx||celebrating||!list.length)return;
  const label=list.length===1?list[0].item.name+(list[0].qty>1?' × '+list[0].qty:'')+' · '+eur(cartTotal(list)):plural(list.reduce((n,l)=>n+l.qty,0))+' · '+eur(cartTotal(list));
  ctx={lines:list.map(l=>({...l})),saleId:null,stage:'create',req:{},label};drive();}
 const tile=(item)=>{
  const key=kind+':'+item.id,inCart=lines.get(key);
  const label=(cart?'Pridať · ':'Predať · ')+item.name+' · '+eur(item.current_price_eur);
  return entryTile({name:item.name,detail:eur(item.current_price_eur),note:inCart?'V košíku: '+inCart.qty+' ×':null,action:cart?'Pridať':'Predať',label,disabled:busy||celebrating,onClick:()=>{
   if(!cart){start([{item,kind,qty:1}]);return;}
   const line=lines.get(key);lines.set(key,line?{...line,qty:line.qty+1}:{item,kind,qty:1});render();}});
 };
 function bar(list){
  const b=el('div',undefined,'crm-cart-bar');b.setAttribute('role','region');b.setAttribute('aria-label','Košík');
  const total=cartTotal(list),count=list.reduce((n,l)=>n+l.qty,0);
  b.append(el('span','Košík · '+(list.length?plural(count)+' · ':'prázdny · ')+eur(total),'crm-cart-sum'));
  const go=el('button','Zapísať nákup');go.type='button';go.className='crm-cart-go';go.disabled=busy||celebrating||!list.length||list.some(l=>l.item.activation_choices&&!l.activationMode);go.addEventListener('click',()=>start(list));b.append(go);return b;
 }
 function cartLines(list){
  const box=el('div',undefined,'crm-cart-lines');
  for(const [key,l] of lines){
   const row=el('div',undefined,'crm-cart-line');row.append(el('strong',l.item.name));
   const qty=el('span',undefined,'crm-cart-qty');
   for(const [sym,d,lab] of [['−',-1,'Ubrať kus '+l.item.name],['+',1,'Pridať kus '+l.item.name]]){const b=el('button',sym);b.type='button';b.setAttribute('aria-label',lab);b.disabled=busy||celebrating;b.addEventListener('click',()=>{const n=l.qty+d;if(n<1)lines.delete(key);else lines.set(key,{...l,qty:Math.min(n,999)});render();});qty.append(b,...(d<0?[el('span',l.qty,'crm-cart-n')]:[]));}
   row.append(qty,el('span',eur(Number(l.item.current_price_eur)*l.qty),'crm-cart-price'));
   if(l.item.activation_choices){const sel=el('select');sel.setAttribute('aria-label','Aktivácia '+l.item.name);for(const [v,t] of [['','Vyber aktiváciu'],['PURCHASE_DATE','Platí od dnes'],['FIRST_USE','Aktivovať pri prvom vstupe']]){const o=el('option',t);o.value=v;sel.append(o);}sel.value=l.activationMode||'';sel.disabled=busy||celebrating;sel.addEventListener('change',()=>{lines.set(key,{...l,activationMode:sel.value||undefined});render();});row.append(sel);}
   const rm=el('button','Odobrať');rm.type='button';rm.setAttribute('aria-label','Odobrať '+l.item.name);rm.disabled=busy||celebrating;rm.addEventListener('click',()=>{lines.delete(key);render();});row.append(rm);box.append(row);
  }
  return box;
 }
 function render(){
  if(!live)return;root.replaceChildren();
  const list=[...lines.values()];
  if(cart)root.append(bar(list));
  if(notice){const b=el('div',undefined,'crm-banner');b.dataset.kind=notice.kind;b.setAttribute('role',notice.kind==='ok'?'status':'alert');b.append(el('strong',notice.text));if(notice.sub)b.append(el('span',notice.sub));root.append(b);}
  if(ctx?.unverified){const row=el('div',undefined,'crm-recovery');for(const [label,fn] of [['Overiť výsledok',()=>drive(true)],['Zopakovať ten istý zápis',()=>drive(false)]]){const b=el('button',label);b.type='button';b.disabled=busy;b.addEventListener('click',fn);row.append(b);}root.append(row);return;}
  if(loading){root.append(el('p','Načítavam ponuku…'));return;}
  if(cart&&list.length)root.append(cartLines(list));
  const tools=el('div',undefined,'crm-sale-tools');
  if(kinds.length>1){const seg=el('div',undefined,'crm-segment');for(const [k,t] of [['products','Produkty'],['services','Služby']]){const b=el('button',t);b.type='button';b.setAttribute('aria-pressed',String(kind===k));b.addEventListener('click',()=>{kind=k;render();});seg.append(b);}tools.append(seg);}
  const order=el('div',undefined,'crm-segment');order.setAttribute('aria-label','Zoradenie');
  const az=el('button','Zoradiť A–Z');az.type='button';az.setAttribute('aria-pressed','true');
  const top=el('button','Najpredávanejšie · zatiaľ nedostupné');top.type='button';top.disabled=true;top.title='Údaje o predaji recepcia zatiaľ nevidí.';order.append(az,top);tools.append(order);root.append(tools);
  const shown=[...items[kind]].sort(byName);
  if(!shown.length)root.append(el('p','V tejto ponuke zatiaľ nie je nič dostupné.','crm-lead'));
  const grid=el('div',undefined,'crm-price-grid');for(const item of shown)grid.append(tile(item));root.append(grid);
  if(busy)root.append(el('p','Zapisujem nákup…','crm-lead'));
 }
 render();load();
 return {hasPending:()=>busy||Boolean(ctx),dispose(){live=false;clearToast();controller.abort();root.replaceChildren();}};
}
