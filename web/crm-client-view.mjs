// Client profile for the reception: contact, permanentky and their validity, latest visits, past purchases, two actions.
// Visit and purchase history are optional fields of the CUSTOMER read (visits, purchases, with cursors); when the server does not
// send them the profile says so instead of showing an empty list.
export const skDate=v=>{const d=typeof v==='string'&&/^\d{4}-\d{2}-\d{2}/.test(v)?new Date(v.slice(0,10)+'T12:00:00Z'):null;return d&&Number.isFinite(d.getTime())?new Intl.DateTimeFormat('sk-SK',{timeZone:'UTC'}).format(d):'—';};
export function membershipView(m,today=new Date().toISOString().slice(0,10)){
 if(m===undefined)return {tone:'neutral',chip:'Údaje o permanentke nie sú v zozname',rows:[]};
 if(m===null)return {tone:'neutral',chip:'Bez permanentky',rows:[]};
 const time=m.type==='TIME_ACCESS',total=Number(m.included_units),used=Number(m.consumed),left=time?null:total-used,expired=typeof m.expires_on==='string'&&m.expires_on<today;
 const soon=!expired&&typeof m.expires_on==='string'&&Date.parse(m.expires_on)-Date.parse(today)<=7*86400000;
 const exhausted=!time&&Number.isFinite(left)&&left<=0,low=!time&&Number.isFinite(left)&&left>0&&left<=2;
 const tone=expired||exhausted?'danger':soon||low?'warning':'success';
 return {tone,chip:expired?'Neplatná · vypršala':exhausted?'Neplatná · vyčerpaná':soon||low?'Platná · končí čoskoro':'Platná',rows:[[time?'Mesačná permanentka':'Permanentka na vstupy',null],['Od',m.activated_on?skDate(m.activated_on):'Aktivuje sa prvým vstupom'],['Do',m.expires_on?skDate(m.expires_on):'—'],['Zostáva',time?'Bez limitu vstupov':Number.isFinite(left)?Math.max(left,0)+' z '+total+' vstupov':'—']]};
}

const el=(tag,value,cls)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);if(cls)x.className=cls;return x;};
const eur=v=>new Intl.NumberFormat('sk-SK',{style:'currency',currency:'EUR'}).format(Number(v));
const ADMISSION={ENTITLEMENT:'Permanentka',SINGLE_ENTRY:'Jednorazový vstup',MULTISPORT:'MultiSport'};
export const visitLabel=v=>ADMISSION[v.admission_code]??'Návšteva';
export const purchaseLabel=p=>(p.lines??[]).map(l=>l.name+(Number(l.quantity)>1?' × '+Number(l.quantity):'')).join(', ')||'Nákup';
export function entitlementView(e,today){
 const view=membershipView({type:e.type_at_purchase,activated_on:e.activated_on,expires_on:e.expires_on,included_units:e.included_units_at_purchase,consumed:e.consumed},today);
 if(e.status&&e.status!=='ENABLED')return {...view,tone:'neutral',chip:'Zrušená'};
 return view;
}
const AUTH=['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'];
export function mountClientProfile({root,api,data,owner=false,onVisit,onShop,onEdit,onBack,onAuthFailure}){
 let live=true;const controller=new AbortController(),c=data.customer;
 const button=(label,fn,cls)=>{const b=el('button',label,cls);b.type='button';b.addEventListener('click',fn);return b;};
 const kv=(label,value)=>{const r=el('div',undefined,'crm-kv crm-kv-stack');r.append(el('span',label),el('strong',value||'—'));return r;};
 const card=(title,cls)=>{const x=el('section',undefined,'crm-card '+(cls||''));x.append(el('h3',title));return x;};
 root.replaceChildren();
 // details box: name, contact, (owner/admin) registration and total spent, correction
 const head=el('section',undefined,'crm-card crm-profile-head');head.append(el('h2',c.name));
 const contact=el('div',undefined,'crm-kv-group crm-contact');contact.append(kv('Tel.',c.phone),kv('E-mail',c.email));head.append(contact);
 if(owner){const o=data.owner_summary,sum=el('div',undefined,'crm-kv-group crm-contact crm-owner-summary');
  sum.append(kv('Registrovaná od',o?.registered_on?skDate(o.registered_on):null),kv('Minula spolu',o&&o.total_spent_eur!==undefined&&o.total_spent_eur!==null?eur(o.total_spent_eur):null));
  if(!o)sum.append(el('p','Údaje o registrácii a útrate zatiaľ server neposiela.','crm-note'));head.append(sum);}
 if(onEdit)head.append(button('Opraviť údaje klientky',onEdit,'crm-profile-edit'));
 root.append(head);
 // actions in their own box below the details
 if(onVisit&&onShop){const box=el('section',undefined,'crm-card crm-profile-actions-box');box.append(el('h3','Čo robí klientka?'));const actions=el('div',undefined,'crm-profile-actions');actions.append(button('Prišla cvičiť',onVisit,'crm-profile-go'),button('Prišla nakupovať',onShop,'crm-profile-go'));box.append(actions);root.append(box);}
 else root.append(el('p','Klientka nie je aktívna. Vstup ani nákup sa nezapíše.','crm-note'));
 const grid=el('div',undefined,'crm-profile-grid');root.append(grid);
 // permanentky and validity
 const ents=card('Permanentky a platnosť');const list=Array.isArray(data.entitlements)?data.entitlements:null;
 if(!list)ents.append(el('p','Údaje o permanentkách nie sú dostupné.','crm-note'));
 else if(!list.length)ents.append(el('p','Klientka nemá žiadnu permanentku.','crm-note'));
 else for(const e of list){const view=entitlementView(e),box=el('div',undefined,'crm-profile-ent');const chip=el('span',view.chip,'crm-chip-status');chip.dataset.tone=view.tone;box.append(chip);
  const rows=el('div',undefined,'crm-kv-group');for(const [label,value] of view.rows)rows.append(value===null?el('p',label,'crm-kv-title'):Object.assign(kv(label,value),{className:'crm-kv'}));box.append(rows);ents.append(box);}
 if(data.entitlements_truncated)ents.append(el('p','Zobrazených je prvých 20 permanentiek.','crm-note'));
 grid.append(ents);
 // history sections
 function history(title,kind,first,next,row,more,empty){
  const box=card(title),body=el('div'),foot=el('div');box.append(body,foot);
  const fill=(items,cursor,append)=>{if(!append)body.replaceChildren();const ul=body.querySelector('ul')??body.appendChild(el('ul',undefined,'crm-history'));for(const it of items)ul.append(row(it));
   foot.replaceChildren();if(cursor)foot.append(button('Ďalšie záznamy',()=>load(cursor,true)));};
  async function load(after,append){try{const page=await api('/api/crm/read',{body:{view:'CUSTOMER_HISTORY',customer_id:c.id,kind,...(after?{after}:{})},signal:controller.signal});if(live)fill(page.items,page.next,append);}
   catch(error){if(!live||error.name==='AbortError')return;if(AUTH.includes(error.code)){onAuthFailure(error.code);return;}foot.replaceChildren(el('p','História sa nepodarila načítať.','crm-note'));}}
  if(first===undefined)body.append(el('p','Údaje nie sú dostupné.','crm-note'));
  else{if(!first.length)body.append(el('p',empty,'crm-note'));else fill(first,null,false);if(next||first.length)foot.append(button(more,()=>load(undefined,false)));}
  return box;
 }
 const visitRow=v=>{const li=el('li');li.append(el('strong',skDate(v.business_date)),el('span',visitLabel(v)));return li;};
 const buyRow=p=>{const li=el('li');li.append(el('strong',skDate(p.business_date)),el('span',purchaseLabel(p)),el('em',p.total!==undefined?eur(p.total):''));return li;};
 grid.append(history('Posledné návštevy','VISITS',data.visits,data.visits_next,visitRow,'Zobraziť všetky návštevy','Zatiaľ žiadne návštevy.'));
 root.append(history('Nákupy v minulosti','PURCHASES',data.purchases,data.purchases_next,buyRow,'Zobraziť všetky nákupy','Zatiaľ žiadne nákupy.'));
 root.append(button('Späť na zoznam',onBack,'crm-profile-back'));
 return {hasPending:()=>false,dispose(){live=false;controller.abort();root.replaceChildren();}};
}
