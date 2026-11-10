// One-click anonymous single entry: sale -> confirmation -> visit, driven by one explicit click.
// Every mutation has its own stable request_id, so a lost response is verified with a readback and never replayed as a new operation.
import {purchaseLine} from './crm-purchase.mjs';
import {visitPayload} from './crm-checkin.mjs';
const AUTH=['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'],DEFINITIVE=['VALIDATION_ERROR','POLICY_BLOCKED','REVISION_CONFLICT','BUSINESS_REJECTED'];
const eur=v=>new Intl.NumberFormat('sk-SK',{style:'currency',currency:'EUR'}).format(Number(v));
const el=(tag,value,cls)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);if(cls)x.className=cls;return x;};
export function mountSingleEntry({root,api,onAuthFailure,bannerMs=5000}){
 let live=true,busy=false,items=[],admission=null,leftovers=[],loading=true,ctx=null,notice=null,bannerTimer=0;
 const controller=new AbortController(),signal=controller.signal;
 const read=body=>api('/api/crm/read',{body,signal});
 function say(kind,text,sub){clearTimeout(bannerTimer);notice={kind,text,sub};if(kind==='ok')bannerTimer=setTimeout(()=>{if(live){notice=null;render();}},bannerMs);}
 async function load(){
  try{
   const [a,c]=await Promise.all([read({view:'ADMISSIONS'}),read({view:'CATALOGUE'})]);if(!live)return;
   admission=a.items.find(x=>x.code==='SINGLE_ENTRY')??null;items=c.items.filter(i=>i.requires_customer!==true);
   if(admission){const e=await read({view:'ENTRY_PURCHASES',admission_id:admission.id});if(!live)return;leftovers=e.items.filter(x=>x.customer_id===null);}
  }catch(error){if(!live||error.name==='AbortError')return;if(AUTH.includes(error.code)){onAuthFailure(error.code);return;}say('error','Možnosti vstupu sa nepodarilo načítať.');}
  finally{if(live){loading=false;render();}}
 }
 async function stageResult(stage,verify){
  const request_id=ctx.req[stage]??=crypto.randomUUID();
  if(verify)return api('/api/crm/readback?request_id='+encodeURIComponent(request_id),{signal});
  let payload;
  if(stage==='create')payload={customer_id:null,customer_revision:null,lines:[purchaseLine(ctx.item,'services',1,{customer_id:null,customer_revision:null})]};
  else if(stage==='confirm'){
   if(!ctx.checkout){ctx.checkout=await read({view:'OWN_CHECKOUT',sale_id:ctx.saleId});if(!live)return null;}
   const {sale,catalogue,resume_blocked}=ctx.checkout;if(resume_blocked)throw Object.assign(Error('BLOCKED'),{code:'BUSINESS_REJECTED'});
   payload={sale_id:sale.id,expected_revision:sale.revision,customer_revision:null,line_fingerprint:sale.line_fingerprint,catalogue};
  }else{
   const page=await read({view:'ENTRY_PURCHASES',admission_id:admission.id});if(!live)return null;
   const purchase=page.items.find(x=>x.sale_id===ctx.saleId&&x.customer_id===null);if(!purchase)throw Object.assign(Error('NOT_FOUND'),{code:'BUSINESS_REJECTED'});
   payload=visitPayload(admission,null,null,purchase);
  }
  return api('/api/crm/operations',{body:{request_id,operation_type:{create:'CREATE_SALE',confirm:'CONFIRM_SALE',visit:'CHECK_IN'}[stage],payload},signal});
 }
 async function drive(verify=false){
  if(!live||busy||!ctx)return;busy=true;ctx.unverified=false;notice=null;render();
  try{
   while(ctx.stage!=='done'){
    const data=await stageResult(ctx.stage,verify);if(!live||!data)return;verify=false;
    if(data.operation?.state==='REJECTED')throw Object.assign(Error('REJECTED'),{code:'BUSINESS_REJECTED'});
    if(data.operation?.state!=='COMPLETED')throw Error('UNVERIFIED');
    if(ctx.stage==='create'){if(typeof data.projection?.id!=='string')throw Error('UNVERIFIED');ctx.saleId=data.projection.id;ctx.stage='confirm';}
    else if(ctx.stage==='confirm')ctx.stage='visit';
    else{if(data.operation.target_type!=='visit'||data.projection?.status!=='POSTED')throw Error('UNVERIFIED');ctx.stage='done';}
   }
   say('ok','Návšteva bola uložená a overená.',ctx.label);ctx=null;
  }catch(error){
   if(!live||error.name==='AbortError')return;
   if(AUTH.includes(error.code)){onAuthFailure(error.code);return;}
   if(DEFINITIVE.includes(error.code)||error.code==='BUSINESS_REJECTED'){say('error','Vstup sa nepodarilo zapísať. Skontroluj pravidlá a skús znova.');ctx=null;}
   else{ctx.unverified=true;say('error','Výsledok nie je potvrdený. Over ho, nezapisuj vstup znova.');}
  }finally{
   busy=false;
   if(live){if(!ctx&&admission){try{const e=await read({view:'ENTRY_PURCHASES',admission_id:admission.id});if(live)leftovers=e.items.filter(x=>x.customer_id===null);}catch{}}render();}
  }
 }
 function start(item){if(busy||ctx)return;ctx={item,saleId:null,stage:'create',req:{},label:item.name+' · '+eur(item.current_price_eur)};drive();}
 function useLeftover(x){if(busy||ctx)return;ctx={item:null,saleId:x.sale_id,stage:'visit',req:{},label:x.display_name_at_sale+' · '+eur(x.actual_unit_price)};drive();}
 function render(){
  if(!live)return;root.replaceChildren(el('h2','Jednorazový vstup'));
  root.append(el('p','Vyber cenu. Vstup sa zapíše jedným kliknutím. Platba prebehne na pokladni mimo CRM.','crm-lead'));
  if(notice){const b=el('div',undefined,'crm-banner');b.dataset.kind=notice.kind;b.setAttribute('role',notice.kind==='ok'?'status':'alert');b.append(el('strong',notice.text));if(notice.sub)b.append(el('span',notice.sub));root.append(b);}
  if(ctx?.unverified){const row=el('div',undefined,'crm-recovery');for(const [label,fn] of [['Overiť výsledok',()=>drive(true)],['Zopakovať ten istý zápis',()=>drive(false)]]){const b=el('button',label);b.type='button';b.disabled=busy;b.addEventListener('click',fn);row.append(b);}root.append(row);return;}
  if(loading){root.append(el('p','Načítavam možnosti vstupu…'));return;}
  if(!admission||!items.length){root.append(el('p','Jednorazový vstup nie je dostupný.'));return;}
  const grid=el('div',undefined,'crm-price-grid');
  for(const item of items){const b=el('button',undefined,'crm-price-btn');b.type='button';b.disabled=busy;b.setAttribute('aria-label','Zapísať · '+item.name+' · '+eur(item.current_price_eur));b.append(el('span',item.name),el('strong',eur(item.current_price_eur)));b.addEventListener('click',()=>start(item));grid.append(b);}
  root.append(grid);
  if(busy)root.append(el('p','Zapisujem vstup…','crm-lead'));
  if(leftovers.length){const box=el('section',undefined,'crm-leftover');box.append(el('h3','Zaplatený, ale nezapísaný vstup'),el('p','Predchádzajúci zápis sa nedokončil. Zapíš vstup alebo ho nechaj na kontrolu.'));for(const x of leftovers){const b=el('button','Zapísať vstup · '+x.display_name_at_sale+' · '+eur(x.actual_unit_price));b.type='button';b.disabled=busy;b.addEventListener('click',()=>useLeftover(x));box.append(b);}root.append(box);}
 }
 render();load();
 return {hasPending:()=>busy||Boolean(ctx),dispose(){live=false;clearTimeout(bannerTimer);controller.abort();root.replaceChildren();}};
}
