// Access-only wizard. No provider tokens, customer data or persistent browser storage.
export function mountAccess({root,purpose,onBack}){
 let live=true,busy=false,generation=0,csrf=null,stage=null,email='',timer=null;const controller=new AbortController();
 const el=(tag,value)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);return x;};
 const clearSecrets=()=>{for(const x of root.querySelectorAll('input'))x.value='';for(const x of root.querySelectorAll('img'))x.removeAttribute('src');};
 const input=(form,label,type,name,options={})=>{const l=el('label',label),x=el('input');Object.assign(x,{type,name,...options});l.append(x);form.append(l);return x;};
 const button=(label,action)=>{const b=el('button',label);b.type='button';b.disabled=busy;b.addEventListener('click',action);return b;};
 const heading=message=>{clearSecrets();root.replaceChildren(el('h2',purpose==='SETUP'?'Prvé nastavenie prístupu':'Obnova hesla'));if(message)root.append(el('p',message));};
 const call=async(route,body)=>{const r=await fetch('/api/crm/access-'+route,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(body&&csrf?{'X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:controller.signal});let data;try{data=await r.json();}catch{throw Error('UNAVAILABLE');}if(!r.ok)throw Error(data.code||'UNAVAILABLE');return data;};
 function timed(data){if(data.csrf_token)csrf=data.csrf_token;if(data.stage)stage=data.stage;clearTimeout(timer);if(data.expires_at){const end=Date.parse(data.expires_at);if(!Number.isFinite(end)||end<=Date.now())throw Error('AUTH_REQUIRED');timer=setTimeout(()=>{if(!live)return;generation++;busy=false;csrf=null;stage=null;start('Čas nastavenia vypršal. Vyžiadaj nový kód.');},Math.min(end-Date.now(),2147483647));}}
 function adopt(data){try{timed(data);return true;}catch{csrf=null;stage=null;start('Čas nastavenia sa nepodarilo overiť. Vyžiadaj nový kód.');return false;}}
 async function run(action){if(busy||!live)return;busy=true;const version=++generation;root.querySelectorAll('button,input').forEach(x=>x.disabled=true);try{const data=await action();if(!live||version!==generation)return;busy=false;return data;}catch(error){if(!live||version!==generation||error.name==='AbortError')return;busy=false;csrf=null;stage=null;start(error.message==='POLICY_BLOCKED'?'Tento postup čaká na schválené nastavenie.':'Výsledok sa nepodarilo potvrdiť. Skús prihlásenie alebo vyžiadaj nový kód.');}finally{if(live&&version===generation){busy=false;root.querySelectorAll('button,input').forEach(x=>x.disabled=false);}}}
 function form(submit,action){const f=el('form');f.className='crm-access-form';const b=el('button',submit);b.type='submit';f.addEventListener('submit',async e=>{e.preventDefault();if(!f.reportValidity())return;await action(f);});return {f,b};}
 function back(){clearSecrets();onBack();}
 function start(message){heading(message);const {f,b}=form('Poslať overovací kód',async()=>{email=e.value;const data=await run(()=>call('start',{email,purpose}));if(data&&live)verify();});const e=input(f,'E-mail pracovného účtu','email','email',{required:true,maxLength:320,autocomplete:'username',value:email});f.append(b);root.append(el('p','Len pre už pripravený pracovný účet. Nový účet sa týmto nevytvára.'),f,button('Späť na prihlásenie',back));}
 function verify(){heading('Ak je prístup dostupný, kód príde na zadaný e-mail.');const {f,b}=form('Overiť kód z e-mailu',async()=>{const value=c.value;c.value='';const data=await run(()=>call('verify',{email,code:value,purpose}));if(data&&live){if(adopt(data))render(data);}});const c=input(f,'Kód z e-mailu','text','code',{required:true,pattern:'[0-9]{6,10}',minLength:6,maxLength:10,inputMode:'numeric',autocomplete:'one-time-code'});f.append(b);root.append(f,button('Zadať iný e-mail',()=>start()),button('Späť na prihlásenie',back));}
 async function cancel(){const data=await run(()=>call('cancel',{}));if(data&&live)back();}
 function render(data={}){
  heading();if(stage==='COMPLETE'){clearTimeout(timer);csrf=null;root.append(el('p',data.activation_required?'Heslo je nastavené. Prístup ešte musí aktivovať správca.':'Heslo bolo zmenené. Prihlás sa novým heslom.'),button('Späť na prihlásenie',back));return;}
  if(stage==='MFA_ENROLL'){
   root.append(el('p','Nastav overovaciu aplikáciu. Tento krok ešte nesprístupní CRM.'),button('Nastaviť overovaciu aplikáciu',async()=>{const result=await run(()=>call('enroll',{}));if(result&&live){stage=result.stage;render(result);}}));
  }else if(stage==='MFA_READY'){
   if(data.qr_svg&&data.secret){const image=el('img');image.alt='QR kód pre overovaciu aplikáciu';image.width=240;image.height=240;image.src='data:image/svg+xml;base64,'+btoa(unescape(encodeURIComponent(data.qr_svg)));root.append(image,el('p','Kľúč na ručné zadanie: '+data.secret));}
   if(data.can_show_enrollment&&!data.qr_svg)root.append(button('Znova zobraziť QR kód',async()=>{const result=await run(()=>call('enroll',{}));if(result&&live)render(result);}));
   const {f,b}=form('Overiť kód z aplikácie',async()=>{const value=c.value;c.value='';const result=await run(()=>call('mfa',{code:value}));if(result&&live){stage=result.stage;render(result);}});const c=input(f,'Kód z overovacej aplikácie','text','mfa_code',{required:true,pattern:'[0-9]{6}',minLength:6,maxLength:6,inputMode:'numeric',autocomplete:'one-time-code'});f.append(b);root.append(f);
   root.append(el('p','Pri strate overovacej aplikácie kontaktuj správcu. E-mailový kód nenahrádza tento faktor.'));
  }else if(stage==='PASSWORD_READY'){
   const {f,b}=form('Uložiť nové heslo',async()=>{if(a.value!==c.value){c.setCustomValidity('Heslá sa nezhodujú.');c.reportValidity();c.setCustomValidity('');return;}const value=a.value;a.value=c.value='';const result=await run(()=>call('password',{password:value}));if(result&&live){stage=result.stage;render(result);}});const a=input(f,'Nové heslo','password','password',{required:true,minLength:12,maxLength:1024,autocomplete:'new-password'}),c=input(f,'Zopakuj nové heslo','password','confirmation',{required:true,minLength:12,maxLength:1024,autocomplete:'new-password'});f.append(b);root.append(el('p','Použi aspoň 12 znakov. Existujúce CRM prihlásenia budú zrušené.'),f);
  }else {start();return;}
  root.append(button('Zrušiť nastavovanie',cancel));
 }
 async function restore(){const data=await run(()=>call('status'));if(data&&live){if(['SETUP','RECOVERY'].includes(data.purpose))purpose=data.purpose;if(adopt(data))render(data);}}
 start();root.append(button('Pokračovať v rozpracovanom nastavení',restore));
 return {dispose(){live=false;generation++;controller.abort();clearTimeout(timer);csrf=null;email='';stage=null;clearSecrets();root.replaceChildren();}};
}
