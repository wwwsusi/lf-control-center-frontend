import {kpiCard,columnChart,chartCard,unavailable,formatCount,formatCompactNumber} from './crm-report-view.mjs';
// Owner Reporting tab "Sociálne siete": Facebook + Instagram from SOCIAL_MEDIA_REPORT (read-only),
// next to gym visits from the existing weekly report. Meta provides counts only, never follower names.

export const SOCIAL_COLORS={facebook:'#ff6398',instagram:'#b9a1ff',visits:'#64d8df',follows:'#82d5ad'};
const METRICS=['reach','media_views','interactions','new_followers','unfollows','profile_views'];
const n=v=>v===null||v===undefined||!Number.isFinite(Number(v))?null:Number(v);
const add=(a,b)=>a===null&&b===null?null:(a??0)+(b??0);
const pct=(cur,prev)=>cur===null||prev===null||prev===0?null:Math.round((cur-prev)/prev*1000)/10;

export function validateSocialReport(social){
 if(!social||!Array.isArray(social.weekly)||!Array.isArray(social.posts)||typeof social.accounts!=='object')throw new Error('SOCIAL_REPORT_INVALID');
 for(const w of social.weekly){if(!['facebook','instagram'].includes(w.platform)||!/^\d{4}-\d{2}-\d{2}$/.test(w.period_start)||!Number.isInteger(w.week))throw new Error('SOCIAL_REPORT_INVALID');}
 for(const p of social.posts){if(!['facebook','instagram'].includes(p.platform)||typeof p.post_id!=='string')throw new Error('SOCIAL_REPORT_INVALID');}
 return social;
}

// One row per week: {week, period_start, period_end, fb:{...}, ig:{...}, total:{...}, visits}
export function socialWeeks(social,visitRows=[]){
 const visits=new Map(visitRows.map(r=>[r.period_start,n(r.visits)]));
 const byStart=new Map();
 for(const w of social.weekly){
  const row=byStart.get(w.period_start)??{week:w.week,period_start:w.period_start,period_end:w.period_end,fb:null,ig:null};
  row[w.platform==='facebook'?'fb':'ig']=Object.fromEntries(METRICS.map(k=>[k,n(w[k])]));
  byStart.set(w.period_start,row);
 }
 return [...byStart.values()].sort((a,b)=>a.period_start.localeCompare(b.period_start)).map(r=>({...r,total:Object.fromEntries(METRICS.map(k=>[k,add(r.fb?.[k]??null,r.ig?.[k]??null)])),visits:visits.get(r.period_start)??null}));
}

export function sumWeeks(weeks){
 const s=k=>weeks.reduce((acc,w)=>add(acc,w[k.split('.')[0]]?.[k.split('.')[1]]??null),null);
 return {fb:Object.fromEntries(METRICS.map(k=>[k,s('fb.'+k)])),ig:Object.fromEntries(METRICS.map(k=>[k,s('ig.'+k)])),total:Object.fromEntries(METRICS.map(k=>[k,s('total.'+k)])),
  visits:weeks.every(w=>w.visits!==null)?weeks.reduce((a,w)=>a+w.visits,0):null};
}

export function postsInRange(posts,from,to){
 return posts.filter(p=>{const d=p.published_at.slice(0,10);return (!from||d>=from)&&(!to||d<=to);});
}
export function engagementRate(p){return p.reach?Math.round(p.interactions/p.reach*1000)/10:null;}

export function socialInsights(weeks,selected){
 const lines=[];
 if(!weeks.length)return lines;
 if(selected==='all'){
  const top=weeks.reduce((a,b)=>(b.total.reach??0)>(a.total.reach??0)?b:a);
  const t=sumWeeks(weeks);
  lines.push(`Najsilnejší týždeň: W${top.week} (${formatCount(top.total.reach)} ľudí).`);
  lines.push(`Za ${weeks.length} týždňov pribudlo ${formatCount(t.total.new_followers)} sledovateľov (FB ${formatCount(t.fb.new_followers)}, IG ${formatCount(t.ig.new_followers)}).`);
  if(t.total.reach)lines.push(`Facebook tvorí ${Math.round((t.fb.reach??0)/t.total.reach*100)} % dosahu.`);
  return lines;
 }
 const i=weeks.findIndex(w=>w.period_start===selected),cur=weeks[i],prev=weeks[i-1];
 if(!cur)return lines;
 if(prev){const c=pct(cur.total.reach,prev.total.reach);if(c!==null)lines.push(`Dosah ${c>=0?'stúpol':'klesol'} o ${Math.abs(Math.round(c))} % (${formatCount(prev.total.reach)} → ${formatCount(cur.total.reach)}).`);}
 if(cur.total.reach)lines.push(`Facebook tvorí ${Math.round((cur.fb?.reach??0)/cur.total.reach*100)} % dosahu.`);
 if(cur.visits!==null&&prev&&prev.visits!==null)lines.push(`Návštevy fitka: ${formatCount(cur.visits)} (${cur.visits>=prev.visits?'+':''}${cur.visits-prev.visits} oproti minulému týždňu).`);
 else lines.push('Návštevy fitka za tento týždeň ešte nie sú v reportingu.');
 return lines;
}

const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(className)el.className=className;return el;};
const btn=(label,fn,pressed)=>{const el=node('button',label);el.type='button';el.setAttribute('aria-pressed',String(Boolean(pressed)));el.addEventListener('click',fn);return el;};
const dayLabel=iso=>{const d=new Date(iso);return d.getDate()+'. '+(d.getMonth()+1)+'.';};

// state: {selected:'all'|period_start, platform:'all'|'facebook'|'instagram', sort:'reach'|'interactions'}
export function renderSocial(root,{social,visitRows,state,onChange}){
 const weeks=socialWeeks(social,visitRows);
 const wrap=node('div',undefined,'crm-social');
 if(!weeks.length){wrap.append(unavailable('Údaje zo sociálnych sietí ešte nie sú stiahnuté. Prvý týždenný beh ich doplní v pondelok ráno.'));root.append(wrap);return;}
 if(state.selected!=='all'&&!weeks.some(w=>w.period_start===state.selected))state.selected=weeks.at(-1).period_start;

 // Account totals
 const acc=node('div',undefined,'crm-social-accounts');
 for(const [key,label] of [['facebook','Facebook'],['instagram','Instagram']]){
  const a=social.accounts?.[key];if(!a)continue;const box=node('div',undefined,'crm-social-account');
  box.append(node('span',label,'crm-social-platform crm-social-'+key));
  for(const [v,t] of [[a.followers_total,'sledovateľov'],[a.following_total,'sleduje'],[a.posts_total,'príspevkov']])if(v!==null&&v!==undefined){const s=node('span');s.append(node('strong',formatCount(v)),' '+t);box.append(s);}
  acc.append(box);
 }
 acc.append(node('p','Stav účtov pri poslednom stiahnutí'+(social.last_synced_at?' ('+dayLabel(social.last_synced_at)+')':'')+'. Facebook stránka nemá „priateľov“, len sledovateľov.','crm-note'));
 wrap.append(acc);

 // Week picker
 const picker=node('div',undefined,'crm-social-weeks');picker.setAttribute('role','group');picker.setAttribute('aria-label','Týždeň');
 for(const w of weeks)picker.append(btn('W'+w.week,()=>onChange({selected:w.period_start}),state.selected===w.period_start));
 picker.append(btn('Všetko',()=>onChange({selected:'all'}),state.selected==='all'));
 wrap.append(picker);

 const all=state.selected==='all',idx=weeks.findIndex(w=>w.period_start===state.selected);
 const cur=all?sumWeeks(weeks):weeks[idx],prev=all?null:weeks[idx-1]??null,first=weeks[0];
 const from=all?weeks[0].period_start:cur.period_start,to=all?weeks.at(-1).period_end:cur.period_end;
 const posts=postsInRange(social.posts,from,to);
 const best=posts.slice().sort((a,b)=>(b.reach??0)-(a.reach??0))[0];
 const change=k=>all?null:{weekly:pct(cur.total[k],prev?.total[k]??null),cumulative:pct(cur.total[k],first.total[k]),latest:'W'+cur.week,previous:prev?'W'+prev.week:'',first:'W'+first.week};
 const split=k=>`FB ${formatCount(cur.fb?.[k])} · IG ${formatCount(cur.ig?.[k])}`;
 const cards=node('div',undefined,'crm-kpi-grid crm-social-kpis');
 cards.append(
  kpiCard({title:'Dosah',value:formatCount(cur.total.reach),note:split('reach'),hint:'Rôzni ľudia, ktorí videli obsah. FB a IG sa sčítavajú, ten istý človek môže byť v oboch.',change:change('reach')}),
  kpiCard({title:'Videnia',value:formatCount(cur.total.media_views),note:split('media_views'),hint:'Koľkokrát sa obsah zobrazil, aj opakovane tomu istému človeku.',change:change('media_views')}),
  kpiCard({title:'Interakcie',value:formatCount(cur.total.interactions),note:split('interactions'),hint:'Reakcie, kliknutia, uloženia a zdieľania podľa Meta.',change:change('interactions')}),
  kpiCard({title:'Noví sledovatelia',value:formatCount(cur.total.new_followers),note:split('new_followers')+(cur.ig?.unfollows!==null&&cur.ig?.unfollows!==undefined?` (IG odišli ${formatCount(cur.ig.unfollows)})`:''),hint:'Iba počty. Meta neposkytuje mená sledovateľov.',change:change('new_followers')}),
  kpiCard({title:'Návštevy profilu',value:formatCount(cur.total.profile_views),note:split('profile_views'),hint:'Návštevy FB stránky a IG profilu.',change:change('profile_views')}),
  kpiCard({title:'Najlepší príspevok',value:best?formatCount(best.reach):'Žiadny',note:best?(best.platform==='facebook'?'FB':'IG')+' · '+(best.text?best.text.slice(0,40)+(best.text.length>40?'…':''):'bez popisu'):'V tomto období žiadny príspevok',hint:'Príspevok s najväčším dosahom v zvolenom období.'})
 );
 wrap.append(cards);

 const lines=socialInsights(weeks,state.selected);
 if(lines.length){const box=node('div',undefined,'crm-social-insight');box.append(node('strong','Čo z toho vyplýva · '+(all?'všetky týždne':'W'+cur.week)));const ul=node('ul');for(const l of lines)ul.append(node('li',l));box.append(ul);wrap.append(box);}

 // Charts over all weeks
 const labels=weeks.map(w=>'W'+w.week),charts=node('div',undefined,'crm-chart-grid');
 charts.append(
  chartCard('Dosah po týždňoch',columnChart({labels,stacked:true,series:[{name:'Facebook',color:SOCIAL_COLORS.facebook,values:weeks.map(w=>w.fb?.reach??null)},{name:'Instagram',color:SOCIAL_COLORS.instagram,values:weeks.map(w=>w.ig?.reach??null)}],valueFormat:formatCompactNumber,ariaLabel:'Dosah Facebook a Instagram po týždňoch'}),'Facebook + Instagram, rôzni ľudia za týždeň.'),
  chartCard('Návštevy fitka',weeks.some(w=>w.visits!==null)?columnChart({labels,series:[{name:'Návštevy',color:SOCIAL_COLORS.visits,values:weeks.map(w=>w.visits)}],ariaLabel:'Návštevy fitka po týždňoch'}):unavailable('Návštevy za tieto týždne ešte nie sú v reportingu.'),'Z týždenného reportingu. Súvis v čase, nie príčina.'),
  chartCard('Interakcie po týždňoch',columnChart({labels,stacked:true,series:[{name:'Facebook',color:SOCIAL_COLORS.facebook,values:weeks.map(w=>w.fb?.interactions??null)},{name:'Instagram',color:SOCIAL_COLORS.instagram,values:weeks.map(w=>w.ig?.interactions??null)}],valueFormat:formatCompactNumber,ariaLabel:'Interakcie po týždňoch'})),
  chartCard('Noví sledovatelia po týždňoch',columnChart({labels,series:[{name:'Facebook',color:SOCIAL_COLORS.facebook,values:weeks.map(w=>w.fb?.new_followers??null)},{name:'Instagram',color:SOCIAL_COLORS.instagram,values:weeks.map(w=>w.ig?.new_followers??null)}],ariaLabel:'Noví sledovatelia po týždňoch'}),'Iba počty. Mená sledovateľov Meta neposkytuje; pozri ich ručne v Meta Business Suite → Publikum.')
 );
 wrap.append(charts);

 // Followers per week table
 const ft=node('table',undefined,'crm-report-table');const fh=node('tr');for(const h of ['Týždeň','FB noví','IG noví','IG odišli'])fh.append(node('th',h));const fhead=node('thead');fhead.append(fh);const fb=node('tbody');
 for(const w of weeks.slice().reverse()){const tr=node('tr');if(w.period_start===state.selected)tr.setAttribute('aria-current','true');tr.append(node('td','W'+w.week+' · '+dayLabel(w.period_start)),node('td',formatCount(w.fb?.new_followers)),node('td',formatCount(w.ig?.new_followers)),node('td',formatCount(w.ig?.unfollows)));fb.append(tr);}
 ft.append(fhead,fb);const fscroll=node('div',undefined,'crm-table-scroll');fscroll.append(ft);
 wrap.append(chartCard('Noví sledovatelia',fscroll,'Meta cez API neposkytuje mená, kto začal sledovať. Mená do CRM neukladáme (osobné údaje).'));

 // Posts table
 const plat=node('div',undefined,'crm-social-filter');plat.setAttribute('role','group');plat.setAttribute('aria-label','Sieť');
 for(const [k,l] of [['all','Všetky'],['facebook','Facebook'],['instagram','Instagram']])plat.append(btn(l,()=>onChange({platform:k}),state.platform===k));
 for(const [k,l] of [['reach','Podľa dosahu'],['interactions','Podľa interakcií']])plat.append(btn(l,()=>onChange({sort:k}),state.sort===k));
 const rows=posts.filter(p=>state.platform==='all'||p.platform===state.platform).sort((a,b)=>(b[state.sort]??-1)-(a[state.sort]??-1));
 let body;
 if(!rows.length)body=unavailable('V zvolenom období nie sú žiadne príspevky.');
 else{
  const t=node('table',undefined,'crm-report-table crm-social-posts');const hr=node('tr');for(const h of ['Dátum','Sieť','Príspevok','Dosah','Interakcie','Miera'])hr.append(node('th',h));const th=node('thead');th.append(hr);const tb=node('tbody');
  for(const p of rows){const tr=node('tr'),txt=node('td');const label=p.text||(p.media_type==='REELS'?'Reels bez popisu':'Bez popisu');
   if(p.permalink&&/^https:\/\/(www\.)?(facebook|instagram)\.com\//.test(p.permalink)){const a=node('a',label.length>90?label.slice(0,90)+'…':label);a.href=p.permalink;a.target='_blank';a.rel='noopener noreferrer';txt.append(a);}else txt.append(label.length>90?label.slice(0,90)+'…':label);
   const r=engagementRate(p);tr.append(node('td',dayLabel(p.published_at)),node('td',p.platform==='facebook'?'FB':'IG','crm-social-platform crm-social-'+p.platform),txt,node('td',formatCount(p.reach)),node('td',formatCount(p.interactions)),node('td',r===null?'N/A':String(r).replace('.',',')+' %'));tb.append(tr);}
  t.append(th,tb);body=node('div',undefined,'crm-table-scroll');body.append(t);
 }
 wrap.append(chartCard('Príspevky'+(all?'':' · W'+cur.week),body,'FB interakcie = reakcie + kliknutia. Miera = interakcie ÷ dosah. Čísla príspevkov sú z posledného stiahnutia.',plat));
 wrap.append(node('p','Zdroj: Meta (stránka LADY Fitness Humenné, @lady.fitness.he), sťahované každý pondelok. Pokryté do '+(social.covered_through?dayLabel(social.covered_through+'T12:00:00Z'):'–')+'.','crm-note'));
 root.append(wrap);
}
