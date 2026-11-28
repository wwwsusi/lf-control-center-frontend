// Existing ("opening balance") passes: the owner enters a pass that was bought before CRM start, with its real start date
// and, for entry passes, how many entries were already used. No sale and no payment are created.
// Same pending/verify/retry pattern as crm-customer.mjs: one request id per attempt, never a silent duplicate.
const skDate=v=>{const d=typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v)?new Date(v.slice(0,10)+'T12:00:00Z'):null;return d&&Number.isFinite(d.getTime())?new Intl.DateTimeFormat('sk-SK',{timeZone:'UTC'}).format(d):'—';};
const isoDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
// Last valid day = start + N months (clamped to the month end), the same rule the database applies (exclusive end = +1 day).
export function validThrough(start,months){
 if(!isoDate(start)||!Number.isInteger(months)||months<1)return null;
 const [y,m,d]=start.split('-').map(Number),target=new Date(Date.UTC(y,m-1+months,1));
 const last=new Date(Date.UTC(target.getUTCFullYear(),target.getUTCMonth()+1,0)).getUTCDate();
 target.setUTCDate(Math.min(d,last));return target.toISOString().slice(0,10);
}
export const remainingLabel=n=>n===1?'Zostáva 1 vstup':n>=2&&n<=4?'Zostávajú '+n+' vstupy':'Zostáva '+n+' vstupov';
// months=null: a single-use service without an expiry (START, one body measurement); only an unused one is recorded.
export const isSingleUse=r=>Boolean(r)&&r.months===null;
export const passRuleLabel=r=>isSingleUse(r)?'Jednorazová služba · bez konca platnosti':r.type==='TIME_ACCESS'?'Časová permanentka · platí '+r.months+(r.months===1?' mesiac':r.months<5?' mesiace':' mesiacov'):'Vstupová permanentka · '+r.included+' vstupov · platí 6 mesiacov od prvého použitia';
export function buildPayload({customer,entitlement,rule,serviceId,start,used,cancel=false}){
 if(entitlement)return cancel?{entitlement_id:entitlement.id,expected_revision:entitlement.revision,action:'CANCEL'}:{entitlement_id:entitlement.id,expected_revision:entitlement.revision,action:'UPDATE',start_date:start||null,used_units:String(rule.type==='VISIT_COUNT'?used:0)};
 return {customer_id:customer.id,expected_revision:customer.revision,service_id:serviceId,start_date:start||null,used_units:String(rule.type==='VISIT_COUNT'?used:0)};
}
const ruleOfEntitlement=e=>({type:e.type_at_purchase,months:e.validity_value_at_purchase===null?null:Number(e.validity_value_at_purchase),included:e.included_units_at_purchase===null||e.included_units_at_purchase===undefined?null:Number(e.included_units_at_purchase),name:e.service_name||'Permanentka'});

export function mountOpeningPass({root,api,customer,services=[],entitlement=null,onAuthFailure,onBack,onSaved}){
 let live=true,busy=false,pending=null;const controller=new AbortController();
 const el=(tag,value,cls)=>{const n=document.createElement(tag);if(value!==undefined)n.textContent=value;if(cls)n.className=cls;return n;};
 const editing=entitlement!==null,today=new Date().toISOString().slice(0,10);
 const crmUsed=editing?Number(entitlement.consumed||0):0;
 const heading=el('h2',editing?'Upraviť existujúcu službu':'Pridať existujúcu službu'),sub=el('p',customer.name,'crm-note');
 const form=el('form',undefined,'crm-customer-form crm-pass-form'),notice=el('p');notice.setAttribute('role','status');
 const label=(title,control,hint)=>{const l=el('label',title);l.append(control);if(hint)l.append(el('small',hint,'crm-note'));return l;};
 const select=el('select');select.setAttribute('aria-label','Služba');
 if(editing){const o=el('option',entitlement.service_name||'Permanentka');o.value=entitlement.service_id;select.append(o);select.disabled=true;}
 else{const first=el('option','Vyber službu');first.value='';select.append(first);for(const s of services){const o=el('option',s.name+(s.category?' · '+s.category:''));o.value=s.id;select.append(o);}}
 const start=el('input');start.type='date';start.max=today;
 const used=el('input');used.type='number';used.min='0';used.step='1';used.value='0';
 const startLabel=label('Dátum začiatku',start),usedLabel=label('Koľko vstupov už bolo použitých',used);
 const ruleNote=el('p',undefined,'crm-note'),preview=el('p',undefined,'crm-pass-preview');
 const save=el('button',editing?'Uložiť opravu':'Uložiť službu');save.type='submit';
 const verify=el('button','Overiť výsledok'),retry=el('button','Zopakovať tú istú požiadavku'),back=el('button',editing?'Späť ku klientke':'Späť'),cancel=el('button','Zrušiť tento zápis');
 for(const b of [verify,retry,back,cancel])b.type='button';verify.hidden=retry.hidden=true;cancel.hidden=!editing;
 form.append(label('Služba',select),ruleNote,startLabel,usedLabel,preview,save);
 root.replaceChildren(heading,sub,form,notice,verify,retry,cancel,back);
 if(editing){start.value=entitlement.activated_on||'';used.value=String(Number(entitlement.opening_used_units||0));}
 const rule=()=>editing?ruleOfEntitlement(entitlement):(services.find(s=>s.id===select.value)||null);
 function refresh(){
  const r=rule();ruleNote.textContent=r?passRuleLabel(r):'Vyber službu.';
  const single=isSingleUse(r),visit=r?.type==='VISIT_COUNT'&&!single,n=Number(used.value);
  if(single)used.value='0';
  usedLabel.hidden=!visit;if(visit)used.max=String(r.included);
  const needStart=r&&(single||r.type==='TIME_ACCESS'||n>0||crmUsed>0);
  startLabel.hidden=!r||!needStart;start.required=Boolean(needStart);
  startLabel.firstChild.textContent=single?'Dátum nákupu':visit?'Dátum prvého použitia':'Dátum začiatku';
  if(!needStart)start.value='';
  const through=r&&start.value?validThrough(start.value,r.months):null;
  if(single){preview.textContent='Zapisuj len nevyužitú službu. Ak obsahuje meranie tela, klientke pribudne nárok naň.';return;}
  const left=visit&&Number.isFinite(n)?r.included-n-crmUsed:null;
  preview.textContent=r?[through?'Platná do '+skDate(through):(visit?'Platnosť sa spustí prvým vstupom.':''),visit&&left!==null?remainingLabel(Math.max(left,0))+'.':''].filter(Boolean).join(' · '):'';
  if(editing&&crmUsed>0)preview.textContent+=(preview.textContent?' ':'')+'Vstupy zapísané priamo v CRM ('+crmUsed+') sa k tomuto počtu pripočítavajú.';
 }
 function render(){if(!live)return;const lock=busy||!!pending;for(const c of [start,used])c.disabled=lock;select.disabled=lock||editing;save.disabled=lock;cancel.disabled=lock;verify.hidden=retry.hidden=!pending;verify.disabled=retry.disabled=busy;back.disabled=lock;}
 function failure(error){if(!live||error.name==='AbortError')return;if(['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'].includes(error.code)){onAuthFailure(error.code);return;}
  if(['VALIDATION_ERROR','POLICY_BLOCKED','BUSINESS_REJECTED','REVISION_CONFLICT'].includes(error.code)){pending=null;notice.textContent=error.code==='REVISION_CONFLICT'?'Údaje medzičasom zmenila iná obsluha. Vráť sa ku klientke a načítaj jej aktuálne údaje.':error.code==='POLICY_BLOCKED'?'Zápis existujúcich permanentiek nie je zapnutý.':'Zápis nebol uložený. Skontroluj údaje (dátum nesmie byť v budúcnosti, vstupov nemôže byť viac, než permanentka obsahuje).';}
  else notice.textContent='Výsledok uloženia sa nepodarilo overiť. Over výsledok alebo zopakuj tú istú požiadavku.';
 }
 function complete(data){if(data.operation?.state==='REJECTED'){pending=null;notice.textContent='Zápis bol zamietnutý. Skontroluj údaje.';return;}
  if(data.operation?.state!=='COMPLETED'||data.operation?.target_type!=='entitlement')throw Error('UNVERIFIED');
  pending=null;onSaved();
 }
 async function send(check=false){if(!live||busy||!pending)return;busy=true;notice.textContent=check?'Overujem výsledok…':'Ukladám…';render();try{const data=await api(check?'/api/crm/readback?request_id='+encodeURIComponent(pending.request_id):'/api/crm/operations',{...(check?{}:{body:pending}),signal:controller.signal});if(live)complete(data);}catch(error){failure(error);}finally{busy=false;render();}}
 const begin=body=>{pending={request_id:crypto.randomUUID(),operation_type:editing?'CORRECT_ENTITLEMENT':'IMPORT_ENTITLEMENT',payload:body};send();};
 form.noValidate=true;
 form.addEventListener('submit',event=>{event.preventDefault();if(busy||pending)return;const r=rule();if(!r){select.focus();notice.textContent='Vyber službu.';return;}
  if(!startLabel.hidden){if(!start.value){start.focus();notice.textContent=isSingleUse(r)?'Zadaj dátum nákupu.':r.type==='VISIT_COUNT'?'Zadaj dátum prvého použitia.':'Zadaj dátum začiatku platnosti.';return;}if(start.value>today){start.focus();notice.textContent='Dátum nesmie byť v budúcnosti.';return;}}
  notice.textContent='';
  const n=Number(used.value);if(r.type==='VISIT_COUNT'&&(!Number.isInteger(n)||n<0||n>r.included)){used.focus();notice.textContent='Počet použitých vstupov musí byť od 0 do '+r.included+'.';return;}
  begin(buildPayload({customer,entitlement,rule:r,serviceId:select.value,start:start.value,used:r.type==='VISIT_COUNT'?n:0}));});
 cancel.addEventListener('click',()=>{if(busy||pending)return;if(!window.confirm('Zrušiť tento zápis služby? Nezmení to nič v predaji ani v tržbách.'))return;begin(buildPayload({entitlement,cancel:true}));});
 verify.addEventListener('click',()=>send(true));retry.addEventListener('click',()=>send());back.addEventListener('click',()=>{if(!busy&&!pending)onBack();});
 for(const c of [select,start,used])c.addEventListener('input',refresh);refresh();render();
 return {hasPending:()=>busy||!!pending,dispose(){live=false;controller.abort();pending=null;start.value='';used.value='';}};
}
