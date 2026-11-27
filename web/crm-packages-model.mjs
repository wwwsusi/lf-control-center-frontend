// Package calculator: pure rules. Services and prices always come from the database (live ones only); the owner models
// packages, discounts and her own time on top of them. Nothing here is stored in the browser or sent to the server.
export const FILE_VERSION=1;
export const MAX_PACKAGES=6,MAX_ITEMS=30,MAX_QTY=999,MAX_MINUTES=100000;
const ID=/^LF-SVC-\d{3}$/;
// Identifiers used by the earlier stand-alone calculator, so its exported files can still be loaded.
export const LEGACY_IDS=Object.freeze({vstup:'LF-SVC-001',perm1:'LF-SVC-002',perm2:'LF-SVC-003',perm3:'LF-SVC-004',perm6:'LF-SVC-009',perm12:'LF-SVC-010',v10:'LF-SVC-005',pt:'LF-SVC-015',plan:'LF-SVC-030',start:'LF-SVC-036'});
export const DEFAULT_MINUTES=Object.freeze({'LF-SVC-015':60,'LF-SVC-030':60});
export const DEFAULT_CAPACITY_HOURS=5;
// Starting proposal. Items that are not live services (seminar, measurement) are not part of it, so two packages keep
// their original discount instead of their original price.
const PROPOSAL=[
 {name:'IMPULZ',items:[['LF-SVC-002',1],['LF-SVC-015',2]],price:79},
 {name:'MOTIVÁCIA',items:[['LF-SVC-003',1],['LF-SVC-015',3]],pct:(1-229/255)*100},
 {name:'PREMENA',items:[['LF-SVC-004',1],['LF-SVC-030',1],['LF-SVC-015',3]],pct:(1-349/395)*100}
];
export const byId=services=>new Map(services.map(s=>[s.business_id,s]));
const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export const num=v=>{const n=parseFloat(String(v??'').replace(',','.'));return Number.isFinite(n)?n:0;};
export const sumOf=(items,map)=>items.reduce((n,i)=>n+(map.has(i.id)?Number(map.get(i.id).price_eur)*i.qty:0),0);
export const pctFromPrice=(sum,price)=>sum>0?clamp((1-price/sum)*100,0,100):0;
export function calc(pack,map,minutes){
 const sum=sumOf(pack.items,map),price=sum*(1-pack.pct/100),owner=pack.items.reduce((n,i)=>n+(map.has(i.id)?(minutes[i.id]||0)*i.qty:0),0);
 return {sum,price,saving:sum-price,owner};
}
// Closest price ending in 9 that stays below the sum of the single services.
export function priceEndingInNine(sum,price){
 if(sum<=0)return null;
 let k=Math.round((price-9)/10)*10+9;
 if(k>=sum)k-=10;
 return k<0?null:k;
}
export const perWeek=(capacityHours,ownerMinutes)=>ownerMinutes>0?Math.floor(capacityHours*60/ownerMinutes):null;
export function defaultDraft(services){
 const map=byId(services);
 return {capHours:DEFAULT_CAPACITY_HOURS,minutes:{...DEFAULT_MINUTES},packages:PROPOSAL.map(p=>{
  const items=p.items.filter(([id])=>map.has(id)).map(([id,qty])=>({id,qty}));
  return {name:p.name,items,pct:p.pct??pctFromPrice(sumOf(items,map),p.price)};
 })};
}
export const exportDraft=draft=>JSON.stringify({version:FILE_VERSION,capHours:draft.capHours,minutes:draft.minutes,packages:draft.packages},null,2);
// Reads a saved file (also one from the stand-alone calculator). Returns {draft,dropped} where dropped lists services
// that are not live any more; throws on anything that is not a calculator file.
export function importDraft(text,services){
 const data=JSON.parse(text),map=byId(services);
 if(!data||typeof data!=='object'||!Array.isArray(data.packages)||!data.packages.length||data.packages.length>MAX_PACKAGES)throw Error('PACKAGE_FILE');
 const oldNames=new Map(Array.isArray(data.catalog)?data.catalog.filter(c=>c&&typeof c.id==='string').map(c=>[c.id,c]):[]);
 const dropped=new Set(),idOf=raw=>Object.hasOwn(LEGACY_IDS,raw)?LEGACY_IDS[raw]:raw;
 const minutes={...DEFAULT_MINUTES};
 const setMinutes=(raw,value)=>{const key=idOf(raw);if(ID.test(key)&&Number.isFinite(value))minutes[key]=clamp(Math.round(value),0,MAX_MINUTES);};
 for(const c of oldNames.values())setMinutes(c.id,Number(c.owner));
 if(data.minutes&&typeof data.minutes==='object')for(const [k,v] of Object.entries(data.minutes))setMinutes(k,Number(v));
 const packages=data.packages.map(p=>{
  if(!p||typeof p.name!=='string'||!Array.isArray(p.items)||p.items.length>MAX_ITEMS)throw Error('PACKAGE_FILE');
  const items=[];
  for(const i of p.items){
   if(!i||typeof i.id!=='string')throw Error('PACKAGE_FILE');
   const key=idOf(i.id),qty=Math.round(Number(i.qty));
   if(!map.has(key)){dropped.add(String(oldNames.get(i.id)?.name??i.id).slice(0,80));continue;}
   if(!(qty>=1))continue;
   const found=items.find(x=>x.id===key);if(found)found.qty=Math.min(MAX_QTY,found.qty+qty);else items.push({id:key,qty:Math.min(MAX_QTY,qty)});
  }
  return {name:p.name.slice(0,60),items,pct:clamp(Number(p.pct)||0,0,100)};
 });
 return {draft:{capHours:clamp(Number(data.capHours??DEFAULT_CAPACITY_HOURS)||0,0,168),minutes,packages},dropped:[...dropped]};
}
export function eur(n){const r=Math.round(n*100)/100;return r.toLocaleString('sk-SK',{minimumFractionDigits:r%1===0?0:2,maximumFractionDigits:2})+' €';}
export const percent=n=>(Math.round(n*10)/10).toLocaleString('sk-SK',{minimumFractionDigits:1,maximumFractionDigits:1})+' %';
export function summaryText(draft,services){
 const map=byId(services),out=[];
 for(const p of draft.packages){
  const r=calc(p,map,draft.minutes);
  out.push(p.name+': '+eur(r.price)+' (súčet '+eur(r.sum)+', zľava '+percent(p.pct)+')');
  for(const i of p.items)if(map.has(i.id))out.push('  - '+i.qty+'× '+map.get(i.id).name);
  out.push('  čas majiteľky: '+r.owner+' min');
 }
 return out.join('\n');
}
