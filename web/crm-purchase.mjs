// New reconstruction: transient state; every mutation requires an explicit click.
const text=(tag,value)=>{const el=document.createElement(tag);el.textContent=String(value);return el;};
const cents=value=>{if(!/^\d+\.\d{2}$/.test(value))throw Error('MONEY');return BigInt(value.replace('.',''));};
const money=value=>`${value/100n}.${String(value%100n).padStart(2,'0')}`;
const eur=value=>new Intl.NumberFormat('sk-SK',{style:'currency',currency:'EUR',maximumFractionDigits:4}).format(Number(value));
const quantity=value=>new Intl.NumberFormat('sk-SK',{maximumFractionDigits:3}).format(Number(value));
export function purchaseCustomerReference(customer,anonymous=false){
 if(customer!==null){if(anonymous||!customer||typeof customer.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(customer.id)||typeof customer.revision!=='string'||!/^[1-9][0-9]{0,17}$/.test(customer.revision))throw Error('Invalid selected customer');return {customer_id:customer.id,customer_revision:customer.revision};}
 if(!anonymous)throw Error('Purchase identity must be selected');return {customer_id:null,customer_revision:null};
}
export function purchaseLine(item,kind,count,identity){
 if(!['products','services'].includes(kind)||!item||typeof item.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(item.id)||typeof item.catalogue_fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(item.catalogue_fingerprint)||!Number.isSafeInteger(count)||count<1||count>999999999)throw Error('Invalid catalogue line');
 if(kind==='services'&&(typeof item.requires_customer!=='boolean'||item.requires_customer&&!identity?.customer_id))throw Error('Customer required');
 return {[kind==='products'?'product_id':'service_id']:item.id,quantity:String(count),catalogue_fingerprint:item.catalogue_fingerprint};
}
export function mountPurchase({root,api,onAuthFailure,saved=false,customer=null,anonymous=false}){
 const identity=saved?null:purchaseCustomerReference(customer,anonymous);
 let live=true,generation=0,busy=false,pending=null,saleId=null,current=null,notice='',items=[],next=null,catalogueKind='products';
 const cart=new Map(),controller=new AbortController();
 const button=(label,fn)=>{const b=text('button',label);b.type='button';b.disabled=busy;b.addEventListener('click',fn);return b;};
 const fail=error=>{if(!live||error.name==='AbortError')return;if(['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'].includes(error.code)){onAuthFailure(error.code);return;}notice=({POLICY_BLOCKED:'Tento postup čaká na schválené pravidlá.',REVISION_CONFLICT:'Údaje sa zmenili. Obnov uložený predaj.',BUSINESS_REJECTED:'Operácia nebola prijatá. Obnov uložený predaj.'})[error.code]||'Výsledok sa nepodarilo overiť.';};
 async function read(body){return api('/api/crm/read',{body,signal:controller.signal});}
 async function loadSale(id){
  if(!live)return;const version=++generation;busy=true;saleId=id;current=null;render();
  try{const data=await read({view:'OWN_CHECKOUT',sale_id:id});if(!live||version!==generation)return;if(customer&&data.sale.customer_id!==customer.id)throw Error('CUSTOMER_MISMATCH');current=data;notice='';}
  catch(error){fail(error);}finally{if(live&&version===generation){busy=false;render();}}
 }
 async function complete(data){
  if(data.operation?.state==='REJECTED'){pending=null;notice='Operácia bola zamietnutá. Skontroluj uložený predaj.';return;}
  if(data.operation?.state!=='COMPLETED'||!data.projection)throw Error('UNVERIFIED');
  if(pending.type==='CREATE_SALE'){saleId=data.projection.id;cart.clear();}
  pending=null;await loadSale(saleId);
 }
 async function mutate(type,payload){
  if(!live||busy||pending)return;
  pending={type,request_id:crypto.randomUUID(),payload};busy=true;notice='Ukladám…';render();
  try{const data=await api('/api/crm/operations',{body:{request_id:pending.request_id,operation_type:type,payload},signal:controller.signal});if(live)await complete(data);}
  catch(error){if(live){fail(error);if(['VALIDATION_ERROR','POLICY_BLOCKED','REVISION_CONFLICT','BUSINESS_REJECTED'].includes(error.code)){pending=null;if(saleId)current=null;}}}
  finally{if(live){busy=false;render();}}
 }
 async function verify(){
  if(!live||busy||!pending)return;busy=true;render();
  try{const data=await api('/api/crm/readback?request_id='+encodeURIComponent(pending.request_id),{signal:controller.signal});if(live)await complete(data);}
  catch(error){fail(error);}finally{if(live){busy=false;render();}}
 }
 function render(){
  if(!live)return;root.replaceChildren(text('h2',saleId?'Uložený predaj':customer?'Nákup · '+customer.name:'Nákup bez klienta'));
  if(notice)root.append(text('p',notice));
  if(pending){root.append(text('p','Nevytváraj nový predaj ani platbu. Najprv over výsledok pôvodnej operácie.'),button('Overiť tú istú operáciu',verify));return;}
  if(saleId){
   if(!current){root.append(button('Obnoviť uložený predaj',()=>loadSale(saleId)));return;}
   const {sale,payment,catalogue,resume_blocked}=current;root.append(text('p',sale.customer_id?'Klientka: '+sale.customer_name:'Bez identifikovanej klientky'));root.append(text('p',`Spolu ${eur(sale.total)} · Prijaté ${eur(sale.paid)}`));
   const list=document.createElement('ul');for(const line of sale.lines)list.append(text('li',`${line.display_name_at_sale} · ${quantity(line.quantity)} ${line.unit_at_sale} · ${eur(line.line_total)}`));root.append(list);
   if(sale.status==='CANCELLED'){root.append(text('p','Predaj bol stornovaný.'));return;}
   if(resume_blocked){root.append(text('p','Predaj vyžaduje kontrolu vlastníka. Zmenili sa údaje alebo katalóg.'),button('Obnoviť uložený predaj',()=>loadSale(saleId)));return;}
   if(sale.status==='DRAFT'){
    const confirm=button('Potvrdiť predaj',()=>mutate('CONFIRM_SALE',{sale_id:sale.id,expected_revision:sale.revision,customer_revision:sale.customer_id?sale.customer_revision:null,line_fingerprint:sale.line_fingerprint,catalogue}));confirm.disabled=busy||!catalogue.length;root.append(confirm);return;
   }
   if(sale.status!=='CONFIRMED'){root.append(text('p','Stav predaja nie je pripravený na platbu.'));return;}
   if(payment){root.append(text('p',`Existujúca platba ${eur(payment.amount)} · ${{CASH:'Hotovosť',CARD:'Karta'}[payment.method]||'Na kontrolu'}`),button('Potvrdiť prijatie platby',()=>mutate('CONFIRM_PAYMENT',{payment_id:payment.id,expected_revision:payment.revision,sale_revision:sale.revision})));return;}
   let outstanding;try{outstanding=cents(sale.total)-cents(sale.paid);}catch{root.append(text('p','Suma vyžaduje kontrolu.'));return;}
   if(outstanding<=0n){root.append(text('p','Predaj a prijatie platby sú potvrdené.'));if(identity)root.append(button('Ďalší nákup',()=>{saleId=null;current=null;notice='';loadCatalogue();}));else root.append(text('p','Pre ďalší nákup znovu vyber klientku alebo nákup bez identifikácie v úvodnej ponuke.'));return;}
   const label=text('label','Spôsob platby'),select=document.createElement('select');for(const [value,name]of [['CASH','Hotovosť'],['CARD','Karta']]){const o=text('option',name);o.value=value;select.append(o);}select.disabled=busy;label.append(select);
   root.append(text('p',`Zostáva prijať ${eur(money(outstanding))}`),label,button('Zaznamenať platbu',()=>mutate('CREATE_PAYMENT',{sale_id:sale.id,sale_revision:sale.revision,method:select.value,amount:money(outstanding)})));return;
  }
  root.append(text('p',customer?'Nákup sa uloží ku klientke '+customer.name+'. Jej existujúca permanentka zostáva zachovaná.':'Predaj bez identifikovanej klientky. Nevytvára návštevu ani permanentku.'));
  const tabs=document.createElement('div');tabs.className='crm-catalogue-tabs';
  for(const [kind,label]of [['products','Produkty'],['services','Služby']]){const tab=button(label,()=>loadCatalogue(undefined,kind));tab.setAttribute('aria-pressed',String(catalogueKind===kind));tabs.append(tab);}root.append(tabs);
  if(!items.length&&!busy)root.append(text('p','Žiadne dostupné položky v tomto katalógu.'));
  for(const product of items){const card=document.createElement('article');card.className='crm-card';card.append(text('h3',product.name),text('p',`${eur(product.current_price_eur)} / ${product.unit}`));
   if(product.category)card.append(text('p',product.category));const key=catalogueKind+':'+product.id;const requiresCustomer=catalogueKind==='services'&&product.requires_customer===true&&!identity.customer_id;
   const add=button('Pridať '+product.name,()=>{if(cart.size>=25&&!cart.has(key))return;const line=cart.get(key);if((line?.quantity??0)>=999999999)return;cart.set(key,{product,kind:catalogueKind,quantity:(line?.quantity??0)+1});render();});add.disabled=busy||requiresCustomer;if(requiresCustomer)card.append(text('p','Pre túto službu najprv vyber klientku.'));card.append(add);root.append(card);}
  if(next)root.append(button('Ďalšie položky',()=>loadCatalogue(next,catalogueKind)));
  for(const [id,line]of cart){const label=text('label',line.product.name+' · množstvo'),input=document.createElement('input');input.type='number';input.min='1';input.max='999999999';input.step='1';input.value=String(line.quantity);input.disabled=busy;input.addEventListener('change',()=>{const n=Number(input.value);if(!Number.isSafeInteger(n)||n<1||n>999999999){input.value=String(line.quantity);return;}line.quantity=n;});label.append(input);root.append(label,button('Odobrať '+line.product.name,()=>{cart.delete(id);render();}));}
  const save=button('Uložiť rozpracovaný predaj',()=>mutate('CREATE_SALE',{...identity,lines:[...cart.values()].map(({product,kind,quantity})=>purchaseLine(product,kind,quantity,identity))}));save.disabled=busy||cart.size===0;root.append(save);
 }
 async function loadCatalogue(after,kind=catalogueKind){
  if(!live||busy)return;busy=true;render();const version=++generation;
  try{const data=await read({view:kind==='products'?'PRODUCT_CATALOGUE':'CATALOGUE',...(after?{after}:{})});if(!live||version!==generation)return;items=after?[...items,...data.items]:data.items;catalogueKind=kind;next=data.next;notice='';}catch(error){fail(error);}finally{if(live&&version===generation){busy=false;render();}}
 }
 async function savedSales(after){
  if(!live||busy)return;busy=true;const version=++generation;root.replaceChildren(text('h2','Rozpracované predaje'));
  try{const data=await read({view:'OWN_CHECKOUTS',...(after?{after}:{})});if(!live||version!==generation)return;busy=false;
   if(!data.items.length)root.append(text('p','V tomto pohľade nie sú uložené predaje.'));
   for(const sale of data.items){const row=document.createElement('article');row.className='crm-card';row.append(text('p',`${sale.customer_name||'Bez identifikovanej klientky'} · ${sale.business_date} · ${{DRAFT:'Rozpracované',CONFIRMED:'Potvrdené',CANCELLED:'Stornované'}[sale.status]||'Na kontrolu'} · ${eur(sale.total)}`),button('Otvoriť uložený predaj',()=>loadSale(sale.id)));root.append(row);}
   if(data.next)root.append(button('Ďalšie predaje',()=>savedSales(data.next)));
  }catch(error){fail(error);if(live)root.append(text('p',notice));}finally{if(live&&version===generation)busy=false;}
 }
 if(saved)savedSales();else loadCatalogue();
 return {dispose(){live=false;generation++;controller.abort();cart.clear();items=[];pending=current=null;saleId=null;}};
}

