// Table view of the client list for the owner/admin: basic fields, status of the permanentka, last visit, registration, total spent,
// with text, status, last-visit and minimum-spent filters and sortable columns. Filters work on the rows that are loaded.
import {skDate,membershipView} from './crm-client-view.mjs';
const el=(tag,value,cls)=>{const x=document.createElement(tag);if(value!==undefined)x.textContent=String(value);if(cls)x.className=cls;return x;};
const eur=v=>new Intl.NumberFormat('sk-SK',{style:'currency',currency:'EUR'}).format(Number(v));
const DAY=86400000;
export const STATUS_OPTIONS=[['','Všetky'],['active','Platná'],['soon','Končí čoskoro'],['invalid','Neplatná'],['none','Bez permanentky']];
export const VISIT_OPTIONS=[['','Všetky'],['7','Do 7 dní'],['30','Do 30 dní'],['over30','Dlhšie ako 30 dní'],['never','Nikdy']];
export function statusKey(m,today){
 if(m===undefined)return 'unknown';if(m===null)return 'none';
 const tone=membershipView(m,today).tone;return tone==='success'?'active':tone==='warning'?'soon':'invalid';
}
export const daysSince=(date,today)=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}/.test(date)?Math.floor((Date.parse(today)-Date.parse(date.slice(0,10)))/DAY):null;
export const unitsLeft=m=>m&&m.type!=='TIME_ACCESS'?Number(m.included_units)-Number(m.consumed):null;
export function filterClients(items,f,today){
 const q=String(f.q||'').trim().toLowerCase(),min=f.minSpent===''||f.minSpent===undefined?null:Number(f.minSpent);
 return items.filter(i=>{
  if(q&&![i.name,i.phone,i.email].some(v=>String(v??'').toLowerCase().includes(q)))return false;
  if(f.status&&statusKey(i.membership,today)!==f.status)return false;
  if(f.visit){const d=daysSince(i.last_visit_on,today);
   if(f.visit==='never'&&d!==null)return false;
   if(f.visit==='7'&&(d===null||d>7))return false;
   if(f.visit==='30'&&(d===null||d>30))return false;
   if(f.visit==='over30'&&(d===null||d<=30))return false;}
  if(min!==null&&Number.isFinite(min)){const spent=Number(i.owner_summary?.total_spent_eur);if(!Number.isFinite(spent)||spent<min)return false;}
  return true;
 });
}
const SORTERS={
 name:i=>String(i.name??'').toLowerCase(),phone:i=>String(i.phone??''),email:i=>String(i.email??'').toLowerCase(),
 status:(i,t)=>({active:0,soon:1,invalid:2,none:3,unknown:4})[statusKey(i.membership,t)],
 expires:i=>i.membership?.expires_on??'',left:i=>unitsLeft(i.membership)??Infinity,
 last:i=>i.last_visit_on??'',registered:i=>i.owner_summary?.registered_on??'',spent:i=>Number(i.owner_summary?.total_spent_eur??-1)
};
export function sortClients(items,key,dir,today){
 const f=SORTERS[key]??SORTERS.name;
 return [...items].sort((a,b)=>{const x=f(a,today),y=f(b,today);const c=typeof x==='number'&&typeof y==='number'?x-y:String(x).localeCompare(String(y),'sk');return (c||String(a.name).localeCompare(String(b.name),'sk'))*dir;});
}
const COLUMNS=[['name','Meno'],['phone','Telefón'],['email','E-mail'],['status','Permanentka'],['expires','Platí do'],['left','Zostáva'],['last','Posledná návšteva'],['registered','Registrovaná od'],['spent','Minula spolu']];
export function mountClientTable({root,state,onOpen,onLoadAll,today=new Date().toISOString().slice(0,10)}){
 const f=state.filters??={q:'',status:'',visit:'',minSpent:''},sort=state.sort??={key:'name',dir:1};
 let items=[];
 const bar=el('div',undefined,'crm-table-filters'),count=el('p',undefined,'crm-note'),wrap=el('div',undefined,'crm-table-scroll'),foot=el('div');
 const field=(label,control)=>{const l=el('label');l.append(el('span',label),control);return l;};
 const input=(key,type,ph)=>{const i=el('input');i.type=type;i.placeholder=ph||'';i.value=f[key];i.addEventListener('input',()=>{f[key]=i.value;draw();});return i;};
 const select=(key,opts)=>{const s=el('select');for(const [v,t] of opts){const o=el('option',t);o.value=v;s.append(o);}s.value=f[key];s.addEventListener('change',()=>{f[key]=s.value;draw();});return s;};
 bar.append(field('Hľadať v zozname',input('q','search','meno, telefón, e-mail')),field('Permanentka',select('status',STATUS_OPTIONS)),field('Posledná návšteva',select('visit',VISIT_OPTIONS)),field('Minula aspoň (€)',input('minSpent','number','0')));
 const reset=el('button','Zrušiť filtre');reset.type='button';reset.addEventListener('click',()=>{Object.assign(f,{q:'',status:'',visit:'',minSpent:''});bar.querySelectorAll('input').forEach(i=>{i.value='';});bar.querySelectorAll('select').forEach(s=>{s.value='';});draw();});bar.append(reset);
 root.replaceChildren(bar,count,wrap,foot);
 function cell(i,key){
  const m=i.membership,o=i.owner_summary;
  if(key==='name')return el('strong',i.name);
  if(key==='status'){const v=membershipView(m,today),c=el('span',v.chip,'crm-chip-status');c.dataset.tone=v.tone;return c;}
  if(key==='expires')return el('span',m?skDate(m.expires_on):'—');
  if(key==='left')return el('span',m?(m.type==='TIME_ACCESS'?'Bez limitu':Math.max(unitsLeft(m),0)+' z '+Number(m.included_units)):'—');
  if(key==='last')return el('span',i.last_visit_on?skDate(i.last_visit_on):'—');
  if(key==='registered')return el('span',o?.registered_on?skDate(o.registered_on):'—');
  if(key==='spent')return el('span',o&&o.total_spent_eur!==undefined&&o.total_spent_eur!==null?eur(o.total_spent_eur):'—');
  return el('span',i[key]||'—');
 }
 function draw(){
  const shown=sortClients(filterClients(items,f,today),sort.key,sort.dir,today);
  count.textContent='Zobrazených '+shown.length+' z '+items.length+' načítaných klientok.';
  const table=el('table',undefined,'crm-client-table');table.setAttribute('aria-label','Zoznam klientok');
  const thead=el('thead'),hr=el('tr');
  for(const [key,label] of COLUMNS){const th=el('th');th.scope='col';th.setAttribute('aria-sort',sort.key===key?(sort.dir>0?'ascending':'descending'):'none');
   const b=el('button',label+(sort.key===key?(sort.dir>0?' ▲':' ▼'):''));b.type='button';b.addEventListener('click',()=>{if(sort.key===key)sort.dir*=-1;else{sort.key=key;sort.dir=1;}draw();});th.append(b);hr.append(th);}
  hr.append(el('th','')); thead.append(hr);table.append(thead);
  const tbody=el('tbody');
  for(const i of shown){const tr=el('tr');for(const [key] of COLUMNS){const td=el('td');td.append(cell(i,key));tr.append(td);}
   const act=el('td'),b=el('button','Otvoriť klientku');b.type='button';b.addEventListener('click',()=>onOpen(i));act.append(b);tr.append(act);tbody.append(tr);}
  if(!shown.length){const tr=el('tr'),td=el('td','Žiadna klientka nezodpovedá filtrom.');td.colSpan=COLUMNS.length+1;tr.append(td);tbody.append(tr);}
  table.append(tbody);wrap.replaceChildren(table);
 }
 return {update(next,more){items=next;draw();foot.replaceChildren();if(more)foot.append(more);}};
}
