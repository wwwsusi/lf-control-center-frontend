// Package calculator screen (owner only). Reads the live services once, then works entirely in memory; the owner keeps a
// model by saving it to a file. The draft survives moving between screens and is dropped on logout.
import {MAX_QTY,MAX_ITEMS,byId,num,calc,pctFromPrice,priceEndingInNine,defaultDraft,exportDraft,importDraft,eur,percent,summaryText} from './crm-packages-model.mjs';
const AUTH=['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'];
let kept=null;
export function clearPackageDraft(){kept=null;}
// Entry screen of the "Kalkulačky" tab: one box per calculator. Add further calculators to this list.
export const CALCULATORS=[{key:'packages',title:'Tvorba balíčkov',text:'Poskladaj balíček z live služieb, nastav zľavu a sleduj čas majiteľky.'}];
export function mountCalculators(options){
 const {root}=options;let current=null,disposed=false;
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 function menu(){
  if(disposed)return;current?.dispose();current=null;
  const grid=el('div',undefined,'crm-calc-grid');
  for(const c of CALCULATORS){
   const card=el('article',undefined,'crm-card crm-calc-card'),open=el('button','Otvoriť');open.type='button';open.setAttribute('aria-label','Otvoriť: '+c.title);
   open.addEventListener('click',()=>{if(!disposed)current=mountPackages({...options,onBack:menu});});
   card.append(el('h3',c.title),el('p',c.text),open);grid.append(card);
  }
  root.replaceChildren(el('h2','Kalkulačky'),grid);
 }
 menu();
 return {hasPending:()=>false,dispose(){disposed=true;current?.dispose();current=null;root.replaceChildren();}};
}
export function mountPackages({root,api,actor,onAuthFailure,onBack=null}){
 let live=true,services=[],map=new Map(),draft=null,printRoot=null;
 const controller=new AbortController();
 const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;};
 const button=(label,fn,cls)=>{const b=el('button',label,cls);b.type='button';b.addEventListener('click',fn);return b;};
 const numberInput=(value,{step='1',min='0',max,label})=>{const i=el('input');i.type='number';i.step=step;i.min=min;if(max!==undefined)i.max=max;i.value=String(value);i.setAttribute('aria-label',label);return i;};
 const wrap=el('section',undefined,'crm-packages'),notice=el('p');notice.setAttribute('role','status');
 const bar=el('div',undefined,'crm-pack-bar'),catalogue=el('details',undefined,'crm-card crm-pack-catalogue'),grid=el('div',undefined,'crm-pack-grid');
 const file=el('input');file.type='file';file.accept='application/json,.json';file.hidden=true;
 function cleanupPrint(){printRoot?.remove();printRoot=null;document.body.classList.remove('crm-pack-print');}
 function say(text){if(live)notice.textContent=text;}
 function replace(next,text){draft=next;kept={actor,draft};renderCatalogue();renderGrid();say(text);}
 function renderCatalogue(){
  const open=catalogue.open,summary=el('summary','Live služby z databázy a čas majiteľky');
  const hours=el('label',undefined,'crm-pack-field');const h=numberInput(draft.capHours,{step:'0.5',max:'168',label:'Hodín týždenne pre balíčky'});
  h.addEventListener('input',()=>{draft.capHours=Math.min(168,Math.max(0,num(h.value)));renderGrid();});hours.append(el('span','Hodín týždenne pre balíčky (majiteľka)'),h);
  const table=el('table',undefined,'crm-pack-table'),head=el('tr'),body=el('tbody');
  for(const t of ['Služba','Cena','Jednotka','Čas majiteľky (min)'])head.append(el('th',t));
  const thead=el('thead');thead.append(head);table.append(thead,body);
  for(const s of services){
   const tr=el('tr'),minutes=numberInput(draft.minutes[s.business_id]||0,{step:'5',label:'Čas majiteľky: '+s.name});
   minutes.addEventListener('input',()=>{draft.minutes[s.business_id]=Math.max(0,Math.round(num(minutes.value)));renderGrid();});
   const name=el('td',s.name);if(s.lifecycle==='PILOT')name.append(' ',el('span','pilot','crm-pack-pilot'));
   const cell=el('td');cell.append(minutes);tr.append(name,el('td',eur(Number(s.price_eur))),el('td',s.unit||'—'),cell);body.append(tr);
  }
  const scroll=el('div',undefined,'crm-pack-scroll');scroll.append(table);
  catalogue.replaceChildren(summary,hours,scroll,el('p','Služby a ceny sa čítajú z databázy a tu sa nemenia. Čas majiteľky je tvoj odhad.','crm-note'));catalogue.open=open;
 }
 function column(pack){
  const col=el('section',undefined,'crm-card crm-pack-col'),name=el('input',undefined,'crm-pack-name');name.value=pack.name;name.maxLength=60;name.setAttribute('aria-label','Názov balíčka');
  name.addEventListener('input',()=>{pack.name=name.value;});
  const list=el('ul',undefined,'crm-pack-lines');
  if(!pack.items.length)list.append(el('li','Zatiaľ bez služieb. Pridaj ich nižšie.','crm-note'));
  pack.items.forEach((item,index)=>{
   const service=map.get(item.id);if(!service)return;
   const li=el('li',undefined,'crm-pack-line'),text=el('div',undefined,'crm-pack-text');
   text.append(el('strong',service.name),el('span',eur(Number(service.price_eur))+' × '+item.qty+' = '+eur(Number(service.price_eur)*item.qty)));
   const qty=el('div',undefined,'crm-pack-qty');
   const less=button('−',()=>{if(item.qty>1)item.qty--;else pack.items.splice(index,1);renderGrid();});less.setAttribute('aria-label','Menej: '+service.name);
   const more=button('+',()=>{item.qty=Math.min(MAX_QTY,item.qty+1);renderGrid();});more.setAttribute('aria-label','Viac: '+service.name);
   const remove=button('×',()=>{pack.items.splice(index,1);renderGrid();});remove.setAttribute('aria-label','Odstrániť: '+service.name);
   qty.append(less,el('output',String(item.qty)),more,remove);li.append(text,qty);list.append(li);
  });
  const select=el('select');select.setAttribute('aria-label','Pridaj službu');const first=el('option','+ Pridaj službu…');first.value='';select.append(first);
  for(const s of services){const o=el('option',s.name+' ('+eur(Number(s.price_eur))+')');o.value=s.business_id;select.append(o);}
  select.addEventListener('change',()=>{if(!select.value)return;const found=pack.items.find(i=>i.id===select.value);if(found)found.qty=Math.min(MAX_QTY,found.qty+1);else if(pack.items.length<MAX_ITEMS)pack.items.push({id:select.value,qty:1});renderGrid();});
  const totals=el('dl',undefined,'crm-pack-totals');
  const row=(label,cls)=>{const x=el('div',undefined,cls),v=el('dd');x.append(el('dt',label),v);totals.append(x);return v;};
  const sumValue=row('Súčet samostatne'),savingValue=row('Úspora klientky'),priceValue=row('Cena balíčka','crm-pack-price');
  const controls=el('div',undefined,'crm-pack-controls');
  const pct=numberInput(0,{step:'0.1',max:'100',label:'Zľava v percentách'}),price=numberInput(0,{label:'Cena po zľave v eurách'});
  const labelled=(text,input)=>{const l=el('label',undefined,'crm-pack-field');l.append(el('span',text),input);return l;};
  controls.append(labelled('Zľava (%)',pct),labelled('Cena po zľave (€)',price));
  const refresh=(skip)=>{
   const r=calc(pack,map,draft.minutes);
   sumValue.textContent=eur(r.sum);savingValue.textContent=eur(r.saving)+' ('+percent(pack.pct)+')';priceValue.textContent=eur(r.price);
   if(skip!==pct)pct.value=String(Math.round(pack.pct*10)/10);if(skip!==price)price.value=String(Math.round(r.price*100)/100);
  };
  pct.addEventListener('input',()=>{pack.pct=Math.min(100,Math.max(0,num(pct.value)));refresh(pct);});
  price.addEventListener('input',()=>{const r=calc(pack,map,draft.minutes);if(r.sum<=0)return;pack.pct=pctFromPrice(r.sum,Math.max(0,num(price.value)));refresh(price);});
  const nine=button('Cena zaokrúhlená na 9 Euro',()=>{const r=calc(pack,map,draft.minutes),k=priceEndingInNine(r.sum,r.price);if(k===null)return;pack.pct=pctFromPrice(r.sum,k);refresh();});
  col.append(name,list,select,totals,controls,nine);refresh();return col;
 }
 function renderGrid(){grid.replaceChildren(...draft.packages.map(column));}
 function save(){
  const url=URL.createObjectURL(new Blob([exportDraft(draft)],{type:'application/json'})),a=el('a');a.href=url;a.download='balicky-lady-fitness.json';
  document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);say('Súbor s balíčkami je pripravený na uloženie.');
 }
 file.addEventListener('change',async()=>{
  const chosen=file.files?.[0];file.value='';if(!chosen)return;
  try{
   if(chosen.size>200000)throw Error('PACKAGE_FILE');
   const {draft:next,dropped}=importDraft(await chosen.text(),services);if(!live)return;
   replace(next,dropped.length?'Načítané. Vynechané služby, ktoré nie sú live: '+dropped.join(', ')+'.':'Balíčky sú načítané.');
  }catch{say('Súbor sa nepodarilo načítať. Vyber súbor uložený z tejto kalkulačky.');}
 });
 // The printed sheet is a plain summary placed outside the page layout, so nothing else of the CRM gets printed.
 function print(){
  cleanupPrint();printRoot=el('div',undefined,'crm-pack-printroot');printRoot.append(el('h1','Lady Fitness · návrh balíčkov'),el('pre',summaryText(draft,services)));
  document.body.append(printRoot);document.body.classList.add('crm-pack-print');window.addEventListener('afterprint',cleanupPrint,{once:true});window.print();
 }
 async function copy(){try{await navigator.clipboard.writeText(summaryText(draft,services));say('Zhrnutie je skopírované.');}catch{say('Kopírovanie sa nepodarilo.');}}
 async function load(){
  root.replaceChildren(el('p','Načítavam služby…','crm-note'));
  try{
   const data=await api('/api/crm/read',{body:{view:'PACKAGE_SERVICES'},signal:controller.signal});if(!live)return;
   services=data.items;map=byId(services);
   draft=kept&&kept.actor===actor?kept.draft:defaultDraft(services);
   // A kept draft may contain a service that stopped being live in the meantime.
   for(const p of draft.packages)p.items=p.items.filter(i=>map.has(i.id));
   kept={actor,draft};
   bar.replaceChildren(...(onBack?[button('← Kalkulačky',onBack)]:[]),button('Uložiť do súboru',save),button('Načítať zo súboru',()=>file.click()),button('Kopírovať zhrnutie',copy),button('Tlačiť',print),
    button('Vrátiť návrh',()=>{if(window.confirm('Vrátiť balíčky na pôvodný návrh? Neuložené úpravy sa stratia.'))replace(defaultDraft(services),'Vrátený pôvodný návrh.');}));
   wrap.replaceChildren(el('h2','Tvorba balíčkov'),el('p','Poskladaj balíček z live služieb a nastav zľavu. Úpravy ostanú len do odhlásenia, preto si ich ulož do súboru.','crm-note'),bar,file,notice,catalogue,grid,
    el('p','Zľavu zadaj v percentách alebo ako cieľovú cenu, druhá hodnota sa dopočíta.','crm-note'));
   renderCatalogue();renderGrid();root.replaceChildren(wrap);
  }catch(error){
   if(!live||error.name==='AbortError')return;if(AUTH.includes(error.code)){onAuthFailure(error.code);return;}
   root.replaceChildren(el('p','Služby sa nepodarilo načítať.','crm-note'),button('Skúsiť znova',load),...(onBack?[button('← Kalkulačky',onBack)]:[]));
  }
 }
 load();
 return {hasPending:()=>false,dispose(){live=false;controller.abort();cleanupPrint();root.replaceChildren();}};
}
