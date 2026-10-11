export const item=(id,kind,fields={})=>({id,kind,title:'Synthetic '+id,source_id:'s',fields,related_ids:[],links:[],conflicts:[],provenance:{identity:id,owner:'Synthetic',anchor:'test'}});
const definition=(domain,code,terminal=false)=>({domain,code,label_sk:code,color_key:'neutral',sort_order:0,is_terminal:terminal});
export const fixture=()=>({schema_version:1,origin:'supabase',mode:'LIVE_SUPABASE',sources:[{id:'s',title:'Synthetic',status:'ok'}],items:[
 item('t1','task',{task_status:'IN_PROGRESS',priority:'P0',category:'CAMPAIGN',due_date:'2026-10-10',next_step:'n'.repeat(200),owner:null}),
 item('t2','task',{task_status:'PREPARING',category:'BRAND_ASSETS',due_date:'2026-10-15'}),
 item('t3','task',{task_status:'NOT_STARTED',category:'STAFF',due_date:'2026-10-09'}),
 item('t4','task',{task_status:'COMPLETED',category:'STAFF',due_date:'2026-10-01'}),
 item('t5','task',{task_status:'BLOCKED',category:'NEW_CATEGORY',due_date:null}),
 item('t6','task',{task_status:'CANCELLED',due_date:'2026-10-10'}),
 item('t7','task',{task_status:'IN_PROGRESS',category:'MARKETING_SOCIAL',due_date:'2026-10-16'}),
 item('s1','service',{lifecycle:'ACTIVE',availability_status:null,current_price_eur:null,owner:null,launch_date:'2026-10-12',due_date:'2026-10-01',proposed_price_eur:15}),
 item('p1','product',{lifecycle:'IDEA',stock_status:null,current_price_eur:0,owner:null,launch_date:null}),
 item('c1','campaign',{status:'PUBLISHED',launch_date:'2026-10-10',planned_completion_date:'2026-10-20',due_date:'2026-10-21'}),
 item('c2','campaign',{status:'IDEA',launch_date:null})
 ],validation:{summary:[{severity:'WARN',issue_count:2}],issues:[{severity:'WARN'},{severity:'WARN'}]},status_catalog:{colors:[{color_key:'neutral'}],domains:[{domain:'work'},{domain:'campaign'}],bindings:[],transitions:[],definitions:[...['NOT_STARTED','PREPARING','IN_PROGRESS','BLOCKED'].map(c=>definition('work',c)),definition('work','COMPLETED',true),definition('work','CANCELLED',true),...['PUBLISHED','IN_REVIEW','PREPARING','DRAFT','IDEA'].map(c=>definition('campaign',c)),definition('campaign','COMPLETED',true)]}});
