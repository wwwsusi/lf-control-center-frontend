// Entirely synthetic. No owner data, private document names, file IDs or URLs.
export function demoProjection(now=new Date().toISOString()){
 const source={id:'demo:source',title:'DEMO · syntetický zdroj',status:'ok',last_success_at:now,modified_at:now,url:null};
 const item=(id,kind,title,fields={},related_ids=[])=>({id,kind,title,source_id:source.id,provenance:{owner:'DEMO',anchor:id,identity:'synthetic'},fields,related_ids,links:[],conflicts:[]});
 return {schema_version:1,generated_at:now,sources:[source,{id:'demo:unavailable',title:'DEMO · nedostupný zdroj',status:'error',last_success_at:new Date(Date.parse(now)-86400000).toISOString(),error:'DEMO: zdroj sa nepodarilo obnoviť.',url:null}],items:[
 item('demo:task-a','task','DEMO · Pripraviť otvorený deň',{priority:'P0',category:'CAMPAIGN',task_status:'preparing',next_step:'Potvrdiť prevádzkové podmienky.',owner:'TBD',due:'TBD'},['demo:campaign','demo:service']),
 item('demo:task-b','task','DEMO · Vyhodnotiť skúšobný program',{priority:'P1',category:'STAFF',task_status:'to-do',next_step:'Doložiť skutočné výsledky.',owner:'TBD',due:'Po ukončení programu'}),
 item('demo:decision','decision','DEMO · Potvrdiť termín a zodpovednosť',{blocking:true,evidence_status:'TBD',owner:'TBD'}),
 item('demo:direction','direction','DEMO · Najprv stabilizovať existujúce služby',{evidence_status:'CONFIRMED',summary:'Syntetický strategický smer na ukážku rozhrania.'}),
 item('demo:idea','idea','DEMO · Nový komunitný formát',{evidence_status:'PROPOSED',summary:'Návrh čakajúci na rozhodnutie, bez schváleného plánu.'}),
 {...item('demo:campaign','campaign','DEMO · Otvorený deň',{lifecycle:'PREPARING',placement:'Proposed',objective:'Podporiť návštevnosť.',start:'TBD',owner:'TBD'},['demo:service']),conflicts:[{field:'lifecycle',values:[{value:'PREPARING',source_id:'demo:source'},{value:'TBD',source_id:'demo:unavailable'}]}]},
 item('demo:output','output','DEMO · Facebook pozvánka',{channel:'FACEBOOK / PNG',creative:'DRAFT',approval:'PENDING',publication:'NOT_PUBLISHED',platform_verification:'NOT_PERFORMED',publish_at:'TBD'},['demo:campaign']),
 item('demo:reported','output','DEMO · Oznámený príspevok',{channel:'FACEBOOK',creative:'READY',approval:'APPROVED',publication:'PUBLISHED',platform_verification:'USER_REPORTED',publish_at:'TBD'},['demo:campaign']),
 item('demo:service','service','DEMO · Ukážková služba',{lifecycle:'PILOT',availability:'TBD',availability_status:'TBD',current_price_eur:null,owner:'DEMO',open_questions:'Termín a kapacita TBD.'}),
 item('demo:product','product','DEMO · Ukážkový produkt',{lifecycle:'IDEA',stock_status:'TBD',current_price_eur:null,owner:'DEMO',next_step:'DEMO: typ, sklad a cena zatiaľ nepotvrdené.'}),
 item('demo:change','change','DEMO · Zaznamenaná úprava',{summary:'Syntetický doklad zmeny; nejde o živé business dáta.',evidence_status:'DEMO',date:now})]};
}
