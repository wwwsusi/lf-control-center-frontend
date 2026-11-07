// Customer details stay in memory and are cleared when this view is disposed.
export function mountCustomer({root,api,onAuthFailure,onBack,onSaved,customer=null}){
 let live=true,busy=false,pending=null;const controller=new AbortController();
 const el=(tag,value)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;return n;};
 const editing=customer!==null;
 const heading=el('h2',editing?'Opraviť údaje klientky':'Založiť novú klientku'),form=el('form'),notice=el('p');form.className='crm-customer-form';notice.setAttribute('role','status');
 const inputs={};for(const [key,title,type,max] of [['name','Meno klientky','text',200],['phone','Telefón (nepovinné)','tel',50],['email','E-mail (nepovinné)','email',320]]){const label=el('label',title),input=el('input');input.type=type;input.maxLength=max;input.required=key==='name';input.autocomplete='off';input.value=customer?.[key]??'';label.append(input);form.append(label);inputs[key]=input;}
 const save=el('button',editing?'Uložiť opravu':'Založiť klientku');save.type='submit';const verify=el('button','Overiť výsledok'),retry=el('button','Zopakovať tú istú požiadavku'),back=el('button',editing?'Späť ku klientke':'Späť na zoznam klientov');for(const b of [verify,retry,back])b.type='button';verify.hidden=retry.hidden=true;form.append(save);root.replaceChildren(heading,form,notice,verify,retry,back);
 function render(){if(!live)return;for(const input of Object.values(inputs))input.disabled=busy||!!pending;save.disabled=busy||!!pending;verify.hidden=retry.hidden=!pending;verify.disabled=retry.disabled=busy;back.disabled=busy||!!pending;}
 function failure(error){if(!live||error.name==='AbortError')return;if(['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'].includes(error.code)){onAuthFailure(error.code);return;}
  if(['VALIDATION_ERROR','POLICY_BLOCKED','BUSINESS_REJECTED','REVISION_CONFLICT'].includes(error.code)){pending=null;notice.textContent=error.code==='REVISION_CONFLICT'?'Údaje medzičasom zmenila iná obsluha. Vráť sa ku klientke a načítaj jej aktuálne údaje.':editing?'Oprava nebola uložená. Skontroluj údaje a povolenia.':error.code==='POLICY_BLOCKED'?'Založenie klientky nie je povolené aktuálnymi pravidlami.':'Klientka nebola založená. Skontroluj údaje.';}
  else notice.textContent='Výsledok uloženia sa nepodarilo overiť. Over výsledok alebo zopakuj tú istú požiadavku.';
 }
 function complete(data){if(data.operation?.state==='REJECTED'){pending=null;notice.textContent=editing?'Oprava klientky bola zamietnutá.':'Založenie klientky bolo zamietnuté.';return;}
  if(data.operation?.state!=='COMPLETED'||data.operation?.target_type!=='customer'||!data.projection?.id)throw Error('UNVERIFIED');
  pending=null;onSaved(data.projection.id);
 }
 async function send(check=false){if(!live||busy||!pending)return;busy=true;notice.textContent=check?'Overujem výsledok…':editing?'Ukladám opravu…':'Zakladám klientku…';render();try{const data=await api(check?'/api/crm/readback?request_id='+encodeURIComponent(pending.request_id):'/api/crm/operations',{...(check?{}:{body:pending}),signal:controller.signal});if(live)complete(data);}catch(error){failure(error);}finally{busy=false;render();}}
 form.addEventListener('submit',event=>{event.preventDefault();if(busy||pending||!form.reportValidity())return;const name=inputs.name.value.trim();if(!name){inputs.name.focus();return;}pending={request_id:crypto.randomUUID(),operation_type:editing?'UPDATE_CUSTOMER':'CREATE_CUSTOMER',payload:{...(editing?{customer_id:customer.id,expected_revision:customer.revision}:{}),name,phone:inputs.phone.value.trim()||null,email:inputs.email.value.trim()||null}};send();});verify.addEventListener('click',()=>send(true));retry.addEventListener('click',()=>send());back.addEventListener('click',()=>{if(!busy&&!pending)onBack();});
 return {hasPending:()=>busy||!!pending,dispose(){live=false;controller.abort();pending=null;for(const input of Object.values(inputs))input.value='';}};
}
