// LIVE metadata is authoritative; legacy snapshots/demo keep their existing adapter.
let catalog=null,live=false;
const normalize=value=>String(value??'').trim().toUpperCase();
export function configureStatusCatalog(data){live=data?.origin==='supabase';catalog=live?data?.status_catalog:null;}
export function liveStatusCatalog(){return live;}
export function registryStatus(value,domain){
 if(!live||!catalog)return null;
 const code=normalize(value),defs=catalog.definitions||[];
 if(domain)return defs.find(s=>s.domain===domain&&s.code===code)||null;
 const candidates=defs.filter(s=>s.code===code||normalize(s.label_sk)===code);
 if(!candidates.length)return null;
 const first=candidates[0];return candidates.every(s=>s.label_sk===first.label_sk&&s.color_key===first.color_key)?first:null;
}
export function statusLabel(value,domain){return registryStatus(value,domain)?.label_sk??String(value??'TBD');}
export function statusOptions(domain){return (catalog?.definitions||[]).filter(s=>s.domain===domain).sort((a,b)=>a.sort_order-b.sort_order||a.code.localeCompare(b.code));}
export function statusTerminal(value,domain){const meta=registryStatus(value,domain);return live?meta?.is_terminal===true:['COMPLETED','CANCELLED','RETIRED'].includes(normalize(value));}
export function validateStatusCatalog(data){
 if(data?.origin!=='supabase')return;
 const c=data.status_catalog;if(!c||!['colors','domains','definitions','bindings','transitions'].every(k=>Array.isArray(c[k])))throw Error('Chýba register stavov z DB.');
 const colors=new Set(c.colors.map(r=>r.color_key)),domains=new Set(c.domains.map(r=>r.domain)),seen=new Set();
 for(const s of c.definitions){const key=s.domain+':'+s.code;if(seen.has(key)||!domains.has(s.domain)||!colors.has(s.color_key)||!['neutral','warning','info','danger','success','retired','none'].includes(s.color_key)||typeof s.label_sk!=='string'||!Number.isFinite(s.sort_order)||typeof s.is_terminal!=='boolean')throw Error('Neplatná definícia stavu z DB.');seen.add(key);}
}

export function statusDomain(item,field){const tables={task:'management_tasks',service:'services',product:'products',campaign:'campaigns'};return catalog?.bindings?.find(b=>b.table_name===(item.provenance?.anchor||tables[item.kind])&&b.column_name===(field==='task_status'?'status':field))?.domain;}

// One compact legend per view, restricted to domains used by that view.
export const LEGEND_DOMAINS={
 overview:['work','campaign','lifecycle','severity'],tasks:['work','priority'],
 calendar:['work','campaign','lifecycle'],offers:['lifecycle','availability','work','priority'],
 products:['lifecycle','stock','claim','work','priority'],campaigns:['campaign','output_approval','output_publication','priority'],
 sources:['severity','source'],map:['source']
};
export function legendGroups(data,section){
 const c=data?.origin==='supabase'?data.status_catalog:null;
 return (LEGEND_DOMAINS[section]||[]).flatMap(domain=>{
  const definitions=(c?.definitions||[]).filter(s=>s.domain===domain&&s.is_enabled!==false).sort((a,b)=>a.sort_order-b.sort_order||a.code.localeCompare(b.code));
  return definitions.length?[{domain,label:c.domains.find(d=>d.domain===domain)?.label_sk||domain,definitions:definitions.map(s=>({...s,color:c.colors.find(color=>color.color_key===s.color_key)}))}]:[];
 });
}
export function renderStatusLegend({data,section,parent,make,statusBadge}){
 const box=make('aside',null,parent,'status-legend');box.setAttribute('aria-label','Legenda stavov a farieb');
 make('strong','Legenda stavov a farieb',box);
 const groups=legendGroups(data,section);
 if(!groups.length){make('small',data?.origin==='supabase'?'Register pre tento pohľad nie je dostupný.':'Legenda kanonických stavov je dostupná po pripojení k DB.',box);return box;}
 for(const group of groups){const line=make('div',null,box,'status-legend-domain');make('span',group.label+':',line,'status-legend-label');for(const s of group.definitions){const badge=statusBadge(s.code,line,group.domain);badge.title=[s.description,s.color?.label_sk,s.color?.meaning].filter(Boolean).join(' · ');}}
 return box;
}
