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

// Whole-period comparison: later half of the weeks vs the earlier half (middle week skipped when odd).
export function halves(weeks){
 if(weeks.length<2)return null;
 const k=Math.floor(weeks.length/2),early=weeks.slice(0,k),late=weeks.slice(weeks.length-k);
 return {early,late,label:'W'+late[0].week+'–W'+late.at(-1).week+' / W'+early[0].week+'–W'+early.at(-1).week};
}
export function halvesChange(weeks,key){
 const h=halves(weeks);if(!h)return null;
 const a=sumWeeks(h.early).total[key],b=sumWeeks(h.late).total[key];
 return pct(b,a);
}
export function weeklyAverage(weeks,key){
 const vals=weeks.map(w=>w.total[key]).filter(v=>v!==null);
 return vals.length?Math.round(vals.reduce((s,v)=>s+v,0)/vals.length):null;
}
export function periodLabel(weeks){return weeks.length?'W'+weeks[0].week+(weeks.length>1?'–W'+weeks.at(-1).week:''):'';}
// ISO calendar week of a timestamp, counted in Europe/Prague (CW in the posts table).
export function isoWeek(iso){
 const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(iso));
 const d=new Date(p+'T00:00:00Z'),day=(d.getUTCDay()+6)%7;d.setUTCDate(d.getUTCDate()-day+3);
 const y=new Date(Date.UTC(d.getUTCFullYear(),0,4));return 1+Math.round(((d-y)/86400000-3+((y.getUTCDay()+6)%7))/7);
}

export function postsInRange(posts,from,to){
 return posts.filter(p=>{const d=p.published_at.slice(0,10);return (!from||d>=from)&&(!to||d<=to);});
}
export function engagementRate(p){return p.reach?Math.round(p.interactions/p.reach*1000)/10:null;}


const node=(tag,text,className)=>{const el=document.createElement(tag);if(text!==undefined)el.textContent=String(text);if(className)el.className=className;return el;};
const btn=(label,fn,pressed)=>{const el=node('button',label);el.type='button';el.setAttribute('aria-pressed',String(Boolean(pressed)));el.addEventListener('click',fn);return el;};
const dayLabel=iso=>{const d=new Date(iso);return d.getDate()+'. '+(d.getMonth()+1)+'.';};

// Posts newest first ('date') or by a metric, highest first.
export function sortPosts(rows,sort){return rows.slice().sort(sort==='date'?(a,b)=>b.published_at.localeCompare(a.published_at):(a,b)=>(b[sort]??-1)-(a[sort]??-1));}

// state: {selected:'all'|period_start, platform:'all'|'facebook'|'instagram', sort:'date'|'reach'|'interactions'}
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
 const allBtn=btn(periodLabel(weeks),()=>onChange({selected:'all'}),state.selected==='all');allBtn.title='Všetky uložené týždne spolu';picker.append(allBtn);
 wrap.append(picker);

 const all=state.selected==='all',idx=weeks.findIndex(w=>w.period_start===state.selected);
 const cur=all?sumWeeks(weeks):weeks[idx],prev=all?null:weeks[idx-1]??null,first=weeks[0];
 const from=all?weeks[0].period_start:cur.period_start,to=all?weeks.at(-1).period_end:cur.period_end;
 const posts=postsInRange(social.posts,from,to);
 // Whole-period table lists every stored post, including the week that is still running.
 const tablePosts=all?social.posts:posts;
 const best=posts.slice().sort((a,b)=>(b.reach??0)-(a.reach??0))[0];
 const h=halves(weeks);
 const change=k=>all?(h?{rows:[['Druhá polovica obdobia',halvesChange(weeks,k),h.label]]}:null):{weekly:pct(cur.total[k],prev?.total[k]??null),cumulative:pct(cur.total[k],first.total[k]),latest:'W'+cur.week,previous:prev?'W'+prev.week:'',first:'W'+first.week};
 const split=k=>`FB ${formatCount(cur.fb?.[k])} · IG ${formatCount(cur.ig?.[k])}`+(all?` · Ø ${formatCount(weeklyAverage(weeks,k))} / týždeň`:'');
 const cards=node('div',undefined,'crm-kpi-grid crm-social-kpis');
 cards.append(
  kpiCard({title:all?'Dosah (súčet týždňov)':'Dosah',value:formatCount(cur.total.reach),note:split('reach'),hint:all?'Súčet týždenných dosahov. Ten istý človek oslovený v rôznych týždňoch je započítaný viackrát, takže počet rôznych ľudí je nižší.':'Rôzni ľudia, ktorí videli obsah. FB a IG sa sčítavajú, ten istý človek môže byť v oboch.',change:change('reach')}),
  kpiCard({title:'Videnia',value:formatCount(cur.total.media_views),note:split('media_views'),hint:'Koľkokrát sa obsah zobrazil, aj opakovane tomu istému človeku.',change:change('media_views')}),
  kpiCard({title:'Interakcie',value:formatCount(cur.total.interactions),note:split('interactions'),hint:'Reakcie, kliknutia, uloženia a zdieľania podľa Meta.',change:change('interactions')}),
  kpiCard({title:'Noví sledovatelia',value:formatCount(cur.total.new_followers),note:split('new_followers')+(cur.ig?.unfollows!==null&&cur.ig?.unfollows!==undefined?` (IG odišli ${formatCount(cur.ig.unfollows)})`:''),hint:'Iba počty. Meta neposkytuje mená sledovateľov.',change:change('new_followers')}),
  kpiCard({title:'Návštevy profilu',value:formatCount(cur.total.profile_views),note:split('profile_views'),hint:'Návštevy FB stránky a IG profilu.',change:change('profile_views')}),
  kpiCard({title:'Najlepší príspevok',value:best?formatCount(best.reach):'Žiadny',note:best?(best.platform==='facebook'?'FB':'IG')+' · '+(best.text?best.text.slice(0,40)+(best.text.length>40?'…':''):'bez popisu'):'V tomto období žiadny príspevok',hint:'Príspevok s najväčším dosahom v zvolenom období.'})
 );
 wrap.append(cards);

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
 for(const [k,l] of [['date','Podľa dátumu'],['reach','Podľa dosahu'],['interactions','Podľa interakcií']])plat.append(btn(l,()=>onChange({sort:k}),state.sort===k));
 const rows=sortPosts(tablePosts.filter(p=>state.platform==='all'||p.platform===state.platform),state.sort);
 let body;
 if(!rows.length)body=unavailable('V zvolenom období nie sú žiadne príspevky.');
 else{
  const t=node('table',undefined,'crm-report-table crm-social-posts');const hr=node('tr');for(const h of ['Dátum','CW','Sieť','Príspevok','Dosah','Interakcie','Miera'])hr.append(node('th',h));const th=node('thead');th.append(hr);const tb=node('tbody');
  for(const p of rows){const tr=node('tr'),txt=node('td');const label=p.text||(p.media_type==='REELS'?'Reels bez popisu':'Bez popisu');
   if(p.permalink&&/^https:\/\/(www\.)?(facebook|instagram)\.com\//.test(p.permalink)){const a=node('a',label.length>90?label.slice(0,90)+'…':label);a.href=p.permalink;a.target='_blank';a.rel='noopener noreferrer';txt.append(a);}else txt.append(label.length>90?label.slice(0,90)+'…':label);
   const r=engagementRate(p);const platCell=node('td');platCell.append(node('span',p.platform==='facebook'?'FB':'IG','crm-social-platform crm-social-'+p.platform));
   tr.append(node('td',dayLabel(p.published_at)),node('td','W'+isoWeek(p.published_at)),platCell,txt,node('td',formatCount(p.reach)),node('td',formatCount(p.interactions)),node('td',r===null?'N/A':String(r).replace('.',',')+' %'));tb.append(tr);}
  t.append(th,tb);body=node('div',undefined,'crm-table-scroll');body.append(t);
 }
 wrap.append(chartCard('Príspevky · '+(all?'všetky stiahnuté':'W'+cur.week),body,(all?'Aj príspevky z práve prebiehajúceho týždňa. ':'')+'FB interakcie = reakcie + kliknutia. Miera = interakcie ÷ dosah. Čísla príspevkov sú z posledného stiahnutia.',plat));
 wrap.append(node('p','Zdroj: Meta (stránka LADY Fitness Humenné, @lady.fitness.he), sťahované každý pondelok. Pokryté do '+(social.covered_through?dayLabel(social.covered_through+'T12:00:00Z'):'–'),'crm-note'));
 root.append(wrap);
}
