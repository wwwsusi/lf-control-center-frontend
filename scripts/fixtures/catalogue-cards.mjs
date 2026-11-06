// Synthetic UI examples only; not a second catalogue or a source of current prices.
export const services=[
 ['svc-30','LF-SVC-008','30-vstupová permanentka','Dospelí','162.00','vstup'],
 ['svc-10','LF-SVC-005','10-vstupová permanentka','Dospelí','57.00','vstup'],
 ['svc-1','LF-SVC-001','Jednorazový vstup','Dospelí','6.00','vstup'],
 ['svc-st','LF-SVC-011','Jednorazový vstup','Študenti do 18 rokov a seniori nad 60 rokov','5.00','vstup'],
 ['svc-m','LF-SVC-002','Mesačná permanentka','Dospelí','47.00','mesiac'],
 ['svc-ms','LF-SVC-012','Mesačná permanentka','Študenti do 18 rokov a seniori nad 60 rokov','42.00','mesiac'],
 ['svc-2m','LF-SVC-003','2-mesačná permanentka','Dospelí','90.00','mesiac'],
 ['svc-t','LF-SVC-015','Osobný tréning','Individuálne tréningy','18.00','tréning'],
 ['svc-null','SYNTHETIC-UNKNOWN','Ukážková služba bez uvedenej ceny','Doplnkové služby',null,null]
].map(([id,business_id,name,category,current_price_eur,unit])=>({id,business_id,name,category,current_price_eur,unit}));
export const products=[
 {id:'p1',business_id:'DEMO-001',name:'Minerálna voda',category:'Nápoje',variant_package:'Neperlivá · 500 ml',current_price_eur:'1.50',unit:'kus'},
 {id:'p2',business_id:'DEMO-002',name:'Iontový nápoj',category:'Nápoje',variant_package:'Citrón · 500 ml',current_price_eur:'2.50',unit:'kus'},
 {id:'p3',business_id:'DEMO-003',name:'Proteínová tyčinka',category:'Tyčinky',variant_package:'Čokoláda · 55 g',current_price_eur:'2.20',unit:'kus'},
 {id:'p4',business_id:'DEMO-004',name:'Proteínová tyčinka',category:'Tyčinky',variant_package:'Vanilka · 55 g',current_price_eur:'2.20',unit:'kus'},
 {id:'p5',business_id:'DEMO-005',name:'Proteínový nápoj',category:'Výživa',variant_package:'Jahoda · 30 g',current_price_eur:'2.80',unit:'porcia'}
];
export function catalogueResponse(body){const list=(body.kind==='PRODUCTS'||body.view==='PRODUCT_CATALOGUE')?products:services;return body.after?{items:list.slice(3),next:null}:{items:list.slice(0,3),next:'synthetic-next-page'};}
