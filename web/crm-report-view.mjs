// Presentation layer for owner Reporting: KPI cards, week-over-week changes and dependency-free SVG charts.
// The model functions are pure and unit-tested; renderers only build DOM from a model. Unknown stays unknown:
// null is never drawn as a zero bar and never produces a percentage change.
const SVG_NS='http://www.w3.org/2000/svg';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const WEEKDAYS=['Po','Ut','St','Št','Pi','So','Ne'];
const DIMENSIONS=['DAY','ADMISSION','PRODUCT','SERVICE'];
export const SERIES_COLORS={visits:'#ff6398',membership:'#64d8df',single:'#b9a1ff',multisport:'#f5cb77',sales:'#82d5ad',cost:'#f5cb77',profit:'#64d8df'};

const nf=(max=0)=>new Intl.NumberFormat('sk-SK',{maximumFractionDigits:max});
export const formatCount=v=>finite(v)?nf().format(v):'N/A';
export const formatEuroShort=v=>finite(v)?nf().format(v)+' €':'N/A';
export const formatEuro=v=>finite(v)?new Intl.NumberFormat('sk-SK',{style:'currency',currency:'EUR'}).format(v):'N/A';
export function formatPercent(value){
 if(!finite(value))return 'N/A';
 const rounded=Math.round(value*100)/100;
 return (rounded>0?'+':rounded<0?'−':'')+new Intl.NumberFormat('sk-SK',{minimumFractionDigits:2,maximumFractionDigits:2}).format(Math.abs(rounded))+' %';
}
// Missing or zero base means no meaningful change: report N/A, never an invented 0 % or infinity.
export function percentChange(current,base){return finite(current)&&finite(base)&&base!==0?(current-base)/Math.abs(base)*100:null;}

export function normalizeFacts(snapshot){
 const facts=snapshot?.facts;
 if(!Array.isArray(facts)||facts.length>5000)return [];
 const ok=f=>f&&typeof f==='object'&&/^\d{4}-\d{2}-\d{2}$/.test(f.period_start)&&DIMENSIONS.includes(f.dimension)&&typeof f.key==='string'&&typeof f.label==='string'&&['units','value_eur','cost_eur'].every(k=>f[k]===null||f[k]===undefined||finite(f[k]));
 return facts.every(ok)?facts.map(f=>({period_start:f.period_start,dimension:f.dimension,key:f.key,label:f.label,units:f.units??null,value_eur:f.value_eur??null,cost_eur:f.cost_eur??null})):[];
}
export function weekModel(rows){
 return [...rows].sort((a,b)=>a.period_start<b.period_start?-1:1).map(r=>({week:r.week,label:'W'+r.week,period_start:r.period_start,period_end:r.period_end,visits:r.visits??null,membership:r.membership??null,single:r.single??null,multisport:r.multisport??null,sales:r.recorded_sales??null,multisportValue:r.multisport_receivable??null,total:r.report_value??null,cost:r.product_cost??null,profit:r.product_profit??null,productUnits:r.product_units??null,passUnits:r.pass_units??null,trainingUnits:r.training_units??null}));
}
export function sumKnown(weeks,key){return weeks.length&&weeks.every(w=>finite(w[key]))?weeks.reduce((n,w)=>n+w[key],0):null;}
// Weekly change = latest week vs the one before; cumulative change = latest week vs the first included week.
export function changes(weeks,key){
 if(weeks.length<2)return {weekly:null,cumulative:null,latest:weeks.at(-1)?.label??null,previous:null,first:null};
 const last=weeks.at(-1),prev=weeks.at(-2),first=weeks[0];
 return {weekly:percentChange(last[key],prev[key]),cumulative:percentChange(last[key],first[key]),latest:last.label,previous:prev.label,first:first.label};
}
const weekdayIndex=date=>(new Date(date+'T00:00:00Z').getUTCDay()+6)%7;
export function dailySeries(facts,weeks){
 const starts=new Set(weeks.map(w=>w.period_start));
 return facts.filter(f=>f.dimension==='DAY'&&starts.has(f.period_start)).sort((a,b)=>a.key<b.key?-1:1).map(f=>({date:f.key,label:f.label,value:f.units,weekend:weekdayIndex(f.key)>=5}));
}
// Averages use only observed days: a day without a record is not a zero-visit day.
export function weekdayAverages(daily){
 return WEEKDAYS.map((label,i)=>{const days=daily.filter(d=>weekdayIndex(d.date)===i&&finite(d.value));return {label,days:days.length,average:days.length?days.reduce((n,d)=>n+d.value,0)/days.length:null,weekend:i>=5};});
}
export function productRanking(facts,weeks,metric){
 const starts=new Set(weeks.map(w=>w.period_start)),by=new Map();
 for(const f of facts){if(!['PRODUCT','SERVICE'].includes(f.dimension)||!starts.has(f.period_start))continue;const row=by.get(f.key)??{key:f.key,label:f.label,units:0,value:0,cost:0,costKnown:true,valueKnown:true};row.units+=f.units??0;if(finite(f.value_eur))row.value+=f.value_eur;else row.valueKnown=false;if(finite(f.cost_eur))row.cost+=f.cost_eur;else row.costKnown=false;by.set(f.key,row);}
 // Profit is shown only when every contributing value and cost is known.
 const rows=[...by.values()].map(r=>({...r,profit:r.costKnown&&r.valueKnown?r.value-r.cost:null}));
 const pick=metric==='profit'?r=>r.profit:r=>r.valueKnown?r.value:null;
 return rows.filter(r=>pick(r)!==null).sort((a,b)=>pick(b)-pick(a)).slice(0,10).map(r=>({label:r.label,key:r.key,value:pick(r),units:r.units}));
}

// Axis with round tick values (1, 2, 2.5, 5 x 10^n) so labels are readable.
export function niceScale(min,max,ticks=4){
 const lo=Math.min(0,min),hi=Math.max(max,lo+1),raw=(hi-lo)/ticks,pow=10**Math.floor(Math.log10(raw)),f=raw/pow;
 const step=(f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*pow;
 return {min:Math.floor(lo/step)*step,max:Math.ceil(hi/step)*step,step};
}

// ---- DOM helpers
const node=(tag,text,className)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=String(text);if(className)e.className=className;return e;};
const svgNode=(tag,attrs={},text)=>{const e=document.createElementNS(SVG_NS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=String(text);return e;};

export function kpiCard({title,value,note,change,neutral=false}){
 const card=node('article',undefined,'crm-kpi');card.append(node('h3',title),node('p',value,'crm-kpi-value'),node('p',note,'crm-note'));
 if(change){
  const row=node('div',undefined,'crm-kpi-changes');
  for(const [label,pct,basis] of [['Zmena týždenná',change.weekly,change.latest&&change.previous?change.latest+' / '+change.previous:''],['Zmena kum',change.cumulative,change.latest&&change.first?change.latest+' / '+change.first:'']]){
   const cell=node('div'),strong=node('strong',formatPercent(pct),'crm-kpi-delta');
   strong.dataset.direction=pct===null?'none':neutral?'neutral':pct>0?'up':pct<0?'down':'flat';
   cell.append(node('span',label),strong,node('small',basis));row.append(cell);
  }
  card.append(row);
 }
 return card;
}

// Generic column chart. series: [{name,color,values:[number|null]}]; stacked stacks them; bands marks weekend columns.
export function columnChart({labels,series,stacked=false,format=formatCount,axisFormat,bands=[],ariaLabel,height=240}){
 const wrap=node('div',undefined,'crm-chart');
 const legend=node('ul',undefined,'crm-legend');for(const s of series){const li=node('li');const sw=node('i');sw.style.background=s.color;li.append(sw,s.name);legend.append(li);}
 if(series.length>1)wrap.append(legend);
 const narrow=typeof window!=='undefined'&&window.innerWidth<=560,W=narrow?340:640,H=narrow?Math.min(height,220):height;
 const all=series.flatMap(s=>s.values.filter(finite)),sums=stacked?labels.map((_,i)=>series.every(s=>finite(s.values[i]))?series.reduce((n,s)=>n+s.values[i],0):null).filter(finite):[];
 const scale=niceScale(all.length?Math.min(...all):0,Math.max(1,...sums,...all)),min=scale.min,span=(scale.max-scale.min)||1;
 const ticks=[];for(let v=scale.min;v<=scale.max+scale.step/2;v+=scale.step)ticks.push(Math.round(v*100)/100);
 const tickText=ticks.map(v=>(axisFormat??format)(v)),padL=Math.max(30,Math.max(...tickText.map(t=>t.length))*6+12),padR=8,padT=10,padB=28,innerW=W-padL-padR,innerH=H-padT-padB,y=v=>padT+innerH-((v-min)/span)*innerH;
 const svg=svgNode('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':ariaLabel,class:'crm-chart-svg',preserveAspectRatio:'xMidYMid meet'});
 ticks.forEach((v,i)=>{const yy=y(v);svg.append(svgNode('line',{x1:padL,x2:W-padR,y1:yy,y2:yy,class:'crm-chart-grid'}),svgNode('text',{x:padL-6,y:yy+4,'text-anchor':'end',class:'crm-chart-axis'},tickText[i]));});
 const slot=innerW/Math.max(labels.length,1),every=Math.max(1,Math.ceil(44/slot)),group=stacked?1:series.length,bar=Math.max(2,Math.min(48,slot*0.72/group));
 labels.forEach((label,i)=>{
  const x0=padL+slot*i+slot/2;
  if(bands.includes(i))svg.append(svgNode('rect',{x:padL+slot*i,y:padT,width:slot,height:innerH,class:'crm-chart-band'}));
  let stack=0;
  series.forEach((s,k)=>{
   const v=s.values[i],x=stacked?x0-bar/2:x0-(group*bar)/2+k*bar;
   if(!finite(v)){svg.append(svgNode('text',{x:x+bar/2,y:y(0)-4,'text-anchor':'middle',class:'crm-chart-na'},'N/A'));return;}
   const top=stacked?stack+v:v,base=stacked?stack:0,yTop=y(Math.max(top,base)),yBase=y(Math.min(top,base));
   const rect=svgNode('rect',{x,y:yTop,width:bar,height:Math.max(1,yBase-yTop),rx:3,fill:s.color});rect.append(svgNode('title',{},label+' · '+s.name+': '+format(v)));svg.append(rect);
   if(stacked)stack+=v;
  });
  if(i%every===0)svg.append(svgNode('text',{x:x0,y:H-8,'text-anchor':'middle',class:'crm-chart-axis'},label));
 });
 wrap.append(svg);
 return wrap;
}

export function rankingChart({rows,format=formatEuro,color=SERIES_COLORS.sales,ariaLabel}){
 const wrap=node('div',undefined,'crm-chart');
 const narrow=typeof window!=='undefined'&&window.innerWidth<=560,rowH=30,W=narrow?340:640,padL=narrow?120:190,padR=narrow?64:76,H=Math.max(rows.length,1)*rowH+8;
 const svg=svgNode('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':ariaLabel,class:'crm-chart-svg'});
 const max=Math.max(1,...rows.map(r=>r.value));
 rows.forEach((r,i)=>{
  const yy=4+i*rowH,w=Math.max(2,(W-padL-padR)*r.value/max);
  const cut=narrow?16:26,label=r.label.length>cut?r.label.slice(0,cut-1)+'…':r.label;
  svg.append(svgNode('text',{x:padL-8,y:yy+rowH/2+4,'text-anchor':'end',class:'crm-chart-axis'},label));
  const rect=svgNode('rect',{x:padL,y:yy+4,width:w,height:rowH-10,rx:3,fill:color});rect.append(svgNode('title',{},r.label+': '+format(r.value)));svg.append(rect);
  svg.append(svgNode('text',{x:padL+w+6,y:yy+rowH/2+4,class:'crm-chart-axis'},format(r.value)));
 });
 wrap.append(svg);return wrap;
}

export function chartCard(title,body,note){
 const card=node('section',undefined,'crm-chart-card');card.append(node('h3',title));
 if(note)card.append(node('p',note,'crm-note'));
 card.append(body);return card;
}
export function unavailable(text){return node('p',text,'crm-note crm-chart-empty');}
