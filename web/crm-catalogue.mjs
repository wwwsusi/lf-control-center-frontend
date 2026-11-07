// Presentation only: catalogue cards do not create visits, sales or payments.
const serviceGroups=[
 {key:'entry',label:'Jednorazové vstupy',short:'Vstupy',tone:'cyan',icon:'entry',ids:['LF-SVC-001','LF-SVC-011']},
 {key:'visits',label:'Vstupové permanentky',short:'Vstupové permanentky',tone:'pink',icon:'ticket',ids:['LF-SVC-005','LF-SVC-006','LF-SVC-007','LF-SVC-008']},
 {key:'time',label:'Časové permanentky',short:'Časové permanentky',tone:'violet',icon:'clock',ids:['LF-SVC-002','LF-SVC-012','LF-SVC-003','LF-SVC-004','LF-SVC-009','LF-SVC-010']},
 {key:'training',label:'Tréningy',short:'Tréningy',tone:'amber',icon:'training',ids:['LF-SVC-015','LF-SVC-030']},
 {key:'other',label:'Ďalšie služby',short:'Ďalšie služby',tone:'slate',icon:'grid',ids:[]}
];
// Exact catalogue IDs classify the display only; never infer entitlement rules from names.
export function catalogueGroup(item,kind){
 if(kind==='SERVICES')return serviceGroups.find(g=>g.ids.includes(item.business_id))??serviceGroups.at(-1);
 const label=String(item.category??'').trim()||'Ostatné produkty';let hash=0;for(const c of label)hash=(hash*31+c.charCodeAt(0))>>>0;
 return {key:label,label,short:label,tone:['cyan','pink','violet','amber','green'][hash%5],icon:'product'};
}
const collator=new Intl.Collator('sk',{numeric:true,sensitivity:'base'});
export const catalogueText=value=>String(value??'').normalize('NFD').replace(/\p{Diacritic}/gu,'').toLocaleLowerCase('sk');
export function catalogueSelection(items,{kind='SERVICES',category='ALL',query=''}={}){
 const words=catalogueText(query).trim().split(/\s+/).filter(Boolean);
 return items.filter(item=>(category==='ALL'||catalogueGroup(item,kind).key===category)&&words.every(w=>catalogueText([item.name,item.category,item.variant_package,item.business_id].filter(Boolean).join(' ')).includes(w))).sort((a,b)=>{
  const ga=catalogueGroup(a,kind),gb=catalogueGroup(b,kind);
  const groupOrder=kind==='SERVICES'?serviceGroups.findIndex(g=>g.key===ga.key)-serviceGroups.findIndex(g=>g.key===gb.key):collator.compare(ga.label,gb.label);
  if(groupOrder)return groupOrder;
  if(kind==='SERVICES'){const order=ga.ids.indexOf(a.business_id)-ga.ids.indexOf(b.business_id);if(order)return order;}
  return collator.compare(a.name??'',b.name??'')||collator.compare(a.variant_package??'',b.variant_package??'')||collator.compare(a.id??'',b.id??'');
 });
}
export function cataloguePrice(value){
 if(value===null||value===undefined||!/^\d+(?:\.\d{1,4})?$/.test(String(value)))return null;
 const n=Number(value);return Number.isFinite(n)&&n>=0?new Intl.NumberFormat('sk-SK',{style:'currency',currency:'EUR',maximumFractionDigits:4}).format(n):null;
}
export async function loadCataloguePages(api,{kind='SERVICES',mode='PRICE_LIST',signal}={}){
 const items=[],ids=new Set(),cursors=new Set();let after;
 for(let page=0;page<100;page++){
  const body=mode==='PRICE_LIST'?{view:'PRICE_LIST',kind}:{view:kind==='SERVICES'?'CATALOGUE':'PRODUCT_CATALOGUE'};
  if(after)body.after=after;const data=await api('/api/crm/read',{body,signal});
  if(signal?.aborted)throw new DOMException('Aborted','AbortError');
  if(!Array.isArray(data.items))throw Error('Invalid catalogue response');
  for(const item of data.items){if(!item||typeof item.id!=='string'||typeof item.name!=='string')throw Error('Invalid catalogue item');if(!ids.has(item.id)){ids.add(item.id);items.push(item);}}
  if(data.next==null)return items;
  if(typeof data.next!=='string'||!data.next||cursors.has(data.next)||!data.items.length)throw Error('Invalid catalogue pagination');
  cursors.add(data.next);after=data.next;
 }
 throw Error('Catalogue limit exceeded');
}
// Only transient catalogue preferences, never catalogue rows, credentials or customer data.
const sessions=new Map();
export function clearCataloguePreferences(){sessions.clear();}
export function cataloguePreferences(actor,mode){const key=String(actor)+':'+mode;if(!sessions.has(key))sessions.set(key,{kind:'SERVICES',views:{}});return sessions.get(key);}
export function catalogueAudience(item,kind){
 if(kind==='PRODUCTS')return {label:item.variant_package||item.category||'Produkt',detail:item.variant_package?item.category:null,type:'variant'};
 if(['LF-SVC-011','LF-SVC-012'].includes(item.business_id))return {label:'Študenti / seniori',detail:item.category||null,type:'discount'};
 return {label:item.category||'Pre koho: neuvedené',detail:null,type:item.category==='Dospelí'?'adult':'general'};
}
const el=(tag,text,className)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=String(text);if(className)n.className=className;return n;};
const button=(label,action)=>{const n=el('button',label);n.type='button';n.addEventListener('click',action);return n;};
const paths={star:'M12 3l2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z',entry:'M10 4H5v16h5 M13 8l4 4-4 4 M8 12h9',ticket:'M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4Z M15 7v2m0 2v2m0 2v2',clock:'M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',training:'M4 8v8m3-10v12m10-12v12m3-10v8M7 12h10',grid:'M4 4h6v6H4z M14 4h6v6h-6z M4 14h6v6H4z M14 14h6v6h-6z',product:'M5 7l7-4 7 4v10l-7 4-7-4Z M5 7l7 4 7-4 M12 11v10',people:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M20 21v-2a4 4 0 0 0-3-4 M17 3a4 4 0 0 1 0 8'};
export function catalogueIcon(kind){const wrap=el('span',undefined,'crm-tile-icon');wrap.setAttribute('aria-hidden','true');const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');svg.setAttribute('stroke-width','1.6');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');const path=document.createElementNS(svg.namespaceURI,'path');path.setAttribute('d',paths[kind]??paths.grid);svg.append(path);wrap.append(svg);return wrap;}
export function mountCatalogue({root,api,onBack,onAuthFailure,kind:initialKind='SERVICES',mode='PRICE_LIST',preferences={kind:initialKind,views:{}}}){
 let live=true,seq=0,controller=null,kind=preferences.kind??initialKind,items=[],category='ALL',query='',onlyFavorites=false;
 preferences.views??={};
 const state=()=>preferences.views[kind]??(preferences.views[kind]={category:'ALL',query:'',favorites:[],onlyFavorites:false,scrollY:0});
 const restore=()=>{const saved=state();category=saved.category;query=saved.query;onlyFavorites=saved.onlyFavorites;};
 const remember=()=>{Object.assign(state(),{category,query,onlyFavorites});preferences.kind=kind;};restore();
 const title=el('div',undefined,'crm-catalogue-heading'),caption=el('div');caption.append(el('h2','Cenník'),el('p','Rýchly výber kategórie, prehľadná cena.','crm-note'));title.append(caption,button('Späť na prehľad',onBack));
 const tabs=el('div',undefined,'crm-catalogue-kinds');tabs.setAttribute('aria-label','Typ katalógu');
 const typeButtons=new Map();for(const [key,label,icon]of [['SERVICES','Služby','ticket'],['PRODUCTS','Produkty','product']]){const b=button(label,()=>{if(key===kind)return;remember();state().scrollY=0;kind=key;restore();search.value=query;load();});b.prepend(catalogueIcon(icon));typeButtons.set(key,b);tabs.append(b);}
 const tools=el('div',undefined,'crm-catalogue-tools'),controls=el('div',undefined,'crm-catalogue-controls'),searchLabel=el('label','Vyhľadať položku'),search=el('input');search.type='search';search.placeholder='Názov, kategória alebo variant…';search.autocomplete='off';search.maxLength=200;search.value=query;searchLabel.append(search);
 const categoryLabel=el('label','Kategória', 'crm-catalogue-category-select'),categorySelect=el('select');categorySelect.setAttribute('aria-label','Kategória');categoryLabel.append(categorySelect);categorySelect.addEventListener('change',()=>{category=categorySelect.value;remember();filters();render();});
 const orderLabel=el('label','Zoradenie'),order=el('select');for(const [value,label,disabled]of [['logical','Podľa kategórií',false],['popular','Najpredávanejšie · zatiaľ nedostupné',true]]){const o=el('option',label);o.value=value;o.disabled=disabled;order.append(o);}order.setAttribute('aria-label','Zoradenie');orderLabel.append(order);controls.append(searchLabel,categoryLabel,orderLabel);
 const favoritesToggle=button('Iba obľúbené',()=>{onlyFavorites=!onlyFavorites;remember();filters();render();});favoritesToggle.prepend(catalogueIcon('star'));favoritesToggle.className='crm-favorites-toggle';
 const help=el('p','Obľúbené sú dočasné — po obnovení stránky alebo odhlásení sa vymažú. Predajnosť zatiaľ nie je pripojená.','crm-note crm-catalogue-hint');help.id='crm-catalogue-sort-note';order.setAttribute('aria-describedby',help.id);
 const categories=el('div',undefined,'crm-catalogue-filters');categories.setAttribute('aria-label','Kategórie');
 const status=el('p',undefined,'crm-note crm-catalogue-count');status.setAttribute('role','status');
 const filterSummary=el('div',undefined,'crm-filter-summary'),filterText=el('span'),clear=button('Zobraziť všetko',reset);filterSummary.append(filterText,clear);filterSummary.hidden=true;
 const body=el('div',undefined,'crm-catalogue-body'),note=el('p','Iba prezeranie cenníka. Výber položky nevytvára predaj ani platbu.','crm-note');
 tools.append(controls,favoritesToggle,categories);root.replaceChildren(title,tabs,tools,help,filterSummary,status,body,note);
 search.addEventListener('input',()=>{query=search.value;remember();render();});
 function reset(){category='ALL';query='';onlyFavorites=false;search.value='';remember();filters();render();}
 function card(item,group){
  const c=el('article',undefined,'crm-price-card'),top=el('div',undefined,'crm-price-top'),pinned=state().favorites.includes(item.id),audience=catalogueAudience(item,kind);
  const pin=button(pinned?'Pripnuté':'Pripnúť',()=>{const saved=state();saved.favorites=pinned?saved.favorites.filter(id=>id!==item.id):[...saved.favorites,item.id];remember();filters();render();const next=Array.from(body.querySelectorAll('[data-pin]')).find(b=>b.dataset.pin===item.id);(next??favoritesToggle).focus({preventScroll:true});});
  pin.prepend(catalogueIcon('star'));pin.className='crm-pin';pin.dataset.pin=item.id;pin.setAttribute('aria-label',(pinned?'Odopnúť: ':'Pripnúť: ')+[item.name,item.category,item.variant_package].filter(Boolean).join(' · '));pin.setAttribute('aria-pressed',String(pinned));
  c.dataset.itemId=item.id;c.dataset.tone=group.tone;top.append(catalogueIcon(group.icon),pin);c.append(top,el('h4',item.name));
  const badge=el('p',audience.label,'crm-audience-badge crm-price-audience');badge.dataset.audience=audience.type;c.append(badge);
  if(audience.detail)c.append(el('p',audience.detail,'crm-price-detail'));
  const price=cataloguePrice(item.current_price_eur);c.append(el('p',price??'Cena nie je uvedená',price?'crm-price-value':'crm-price-unknown'));if(item.unit)c.append(el('p','Jednotka: '+item.unit,'crm-price-unit'));return c;
 }
 function section(group,rows,isFavorites=false){
  const s=el('section',undefined,'crm-catalogue-section'+(isFavorites?' crm-favorites-section':''));s.dataset.tone=group.tone;
  const h=el('h3',undefined,'crm-catalogue-group-heading');h.append(catalogueIcon(isFavorites?'star':group.icon),el('span',group.label),el('span',rows.length,'crm-catalogue-group-count'));s.append(h);
  const grid=el('div',undefined,'crm-catalogue-grid');for(const item of rows)grid.append(card(item,isFavorites?catalogueGroup(item,kind):group));s.append(grid);body.append(s);
 }
 function render(){if(!live)return;body.replaceChildren();const selected=catalogueSelection(items,{kind,category,query}),favorites=state().favorites,pinned=favorites.map(id=>selected.find(i=>i.id===id)).filter(Boolean),visible=onlyFavorites?pinned:selected;
  favoritesToggle.setAttribute('aria-pressed',String(onlyFavorites));status.textContent=`Zobrazené ${visible.length} z ${items.length} položiek`;
  filterSummary.hidden=category==='ALL'&&!query.trim()&&!onlyFavorites;filterText.textContent=[category!=='ALL'?'Kategória: '+(catalogueGroupLabel(category)):null,query.trim()?'Hľadanie: „'+query.trim()+'“':null,onlyFavorites?'Iba obľúbené':null].filter(Boolean).join(' · ');
  if(!visible.length){body.append(el('p',onlyFavorites?'V tomto výbere ešte nemáš obľúbené položky. Pripni ich hviezdičkou na karte.':items.length?'Nenašli sa žiadne položky. Skús iný názov alebo kategóriu.':'V katalógu nie sú aktívne položky.','crm-catalogue-empty'));if(items.length)body.append(button('Zrušiť filtre',reset));return;}
  if(pinned.length)section({tone:'amber',label:'Obľúbené',icon:'star'},pinned,true);
  if(onlyFavorites)return;const groups=new Map();for(const item of selected.filter(i=>!favorites.includes(i.id))){const g=catalogueGroup(item,kind);if(!groups.has(g.key))groups.set(g.key,{...g,items:[]});groups.get(g.key).items.push(item);}for(const group of groups.values())section(group,group.items);
 }
 function catalogueGroupLabel(key){return items.map(i=>catalogueGroup(i,kind)).find(g=>g.key===key)?.label??key;}
 function filters(){categories.replaceChildren();categorySelect.replaceChildren();const groups=Array.from(new Map(catalogueSelection(items,{kind}).map(item=>{const g=catalogueGroup(item,kind);return [g.key,g];})).values());
  for(const [key,label,icon,tone]of [['ALL','Všetko','grid','slate'],...groups.map(g=>[g.key,g.label,g.icon,g.tone])]){const count=key==='ALL'?items.length:items.filter(i=>catalogueGroup(i,kind).key===key).length;const b=button(`${label} · ${count}`,()=>{category=key;remember();filters();render();});b.dataset.tone=tone;b.prepend(catalogueIcon(icon));b.setAttribute('aria-pressed',String(category===key));categories.append(b);const option=el('option',`${label} · ${count}`);option.value=key;categorySelect.append(option);}categorySelect.value=category;
 }
 async function load(){const current=++seq;controller?.abort();controller=new AbortController();items=[];categories.replaceChildren();body.replaceChildren();filterSummary.hidden=true;status.textContent='Načítavam celý katalóg…';search.disabled=true;categorySelect.disabled=true;favoritesToggle.disabled=true;
  for(const [key,b]of typeButtons)b.setAttribute('aria-pressed',String(key===kind));
  try{const data=await loadCataloguePages(api,{kind,mode,signal:controller.signal});if(!live||current!==seq)return;items=data;state().favorites=state().favorites.filter(id=>items.some(item=>item.id===id));if(category!=='ALL'&&!items.some(i=>catalogueGroup(i,kind).key===category))category='ALL';search.disabled=false;categorySelect.disabled=false;favoritesToggle.disabled=false;remember();filters();render();const y=state().scrollY;requestAnimationFrame(()=>{if(live&&current===seq&&y>0)window.scrollTo({top:y,behavior:'instant'});});}
  catch(error){if(!live||current!==seq||error.name==='AbortError')return;if(['AUTH_REQUIRED','FORBIDDEN','CRM_NOT_ACTIVE'].includes(error.code)){onAuthFailure(error.code);return;}status.textContent='Cenník sa nepodarilo načítať. Skús načítanie zopakovať; neúplné ceny nezobrazujeme.';body.replaceChildren(button('Načítať cenník znova',load));}
 }
 load();return {dispose(){remember();state().scrollY=window.scrollY;live=false;seq++;controller?.abort();items=[];}};
}
