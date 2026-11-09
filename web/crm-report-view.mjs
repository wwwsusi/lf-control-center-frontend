// Presentation layer for owner Reporting: KPI cards, week-over-week changes and dependency-free SVG charts.
// The model functions are pure and unit-tested; renderers only build DOM from a model. Unknown stays unknown:
// null is never drawn as a zero bar and never produces a percentage change.
const SVG_NS='http://www.w3.org/2000/svg';
const finite=v=>typeof v==='number'&&Number.isFinite(v);
const WEEKDAYS=['Po','Ut','St','Št','Pi','So','Ne'];
const DIMENSIONS=['DAY','DAY_ADMISSION','ADMISSION','PRODUCT','SERVICE'];
export const SERIES_COLORS={weekend:'#8f9aa8',visits:'#ff6398',membership:'#64d8df',single:'#b9a1ff',multisport:'#f5cb77',sales:'#82d5ad',cost:'#f5cb77',profit:'#64d8df'};

const nf=(max=0)=>new Intl.NumberFormat('sk-SK',{maximumFractionDigits:max});
export const formatCount=v=>finite(v)?nf().format(v):'N/A';
export const formatEuroShort=v=>finite(v)?nf().format(v)+' €':'N/A';
export const formatEuro=v=>finite(v)?new Intl.NumberFormat('sk-SK',{style:'currency',currency:'EUR'}).format(v):'N/A';
export function formatPercent(value,{trim=false}={}){
 if(!finite(value))return 'N/A';
 const rounded=Math.round(value*100)/100;
 if(rounded===0)return '0 %';
 return (rounded>0?'+':rounded<0?'−':'')+new Intl.NumberFormat('sk-SK',{minimumFractionDigits:trim?0:2,maximumFractionDigits:2}).format(Math.abs(rounded))+' %';
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
// Changes use the whole history, not only the selected weeks, so a single selected week still has something to compare to:
// weekly = latest selected week vs the week before it in all data; cumulative = vs the first week of all data.
export function changes(weeks,key,allWeeks=weeks){
 const last=weeks.at(-1);
 if(!last)return {weekly:null,cumulative:null,latest:null,previous:null,first:null};
 const index=allWeeks.findIndex(w=>w.period_start===last.period_start),prev=index>0?allWeeks[index-1]:null,first=index>=0?allWeeks[0]:null;
 return {weekly:prev?percentChange(last[key],prev[key]):null,cumulative:first?percentChange(last[key],first[key]):null,latest:last.label,previous:prev?.label??null,first:first?.label??null};
}
const weekdayIndex=date=>(new Date(date+'T00:00:00Z').getUTCDay()+6)%7;
export function dailySeries(facts,weeks){
 const starts=new Set(weeks.map(w=>w.period_start));
 return facts.filter(f=>f.dimension==='DAY'&&starts.has(f.period_start)).sort((a,b)=>a.key<b.key?-1:1).map(f=>({date:f.key,label:f.label,value:f.units,weekend:weekdayIndex(f.key)>=5}));
}
// Entry mix per day (key "YYYY-MM-DD:CODE"). A missing type stays null; it is never treated as zero.
const MIX_CODES={ENTITLEMENT:'membership',SINGLE_ENTRY:'single',MULTISPORT:'multisport'};
export function dailyMix(facts,weeks){
 const starts=new Set(weeks.map(w=>w.period_start)),byDate=new Map();
 for(const f of facts){
  if(f.dimension!=='DAY_ADMISSION'||!starts.has(f.period_start))continue;
  const [date,code]=f.key.split(':'),field=MIX_CODES[code];
  if(!field||!/^\d{4}-\d{2}-\d{2}$/.test(date))continue;
  const row=byDate.get(date)??{date,membership:null,single:null,multisport:null};row[field]=f.units;byDate.set(date,row);
 }
 return [...byDate.values()].sort((a,b)=>a.date<b.date?-1:1);
}
// Averages use only observed days: a day without a record is not a zero-visit day.
export function weekdayAverages(daily){
 return WEEKDAYS.map((label,i)=>{const days=daily.filter(d=>weekdayIndex(d.date)===i&&finite(d.value));return {label,days:days.length,average:days.length?days.reduce((n,d)=>n+d.value,0)/days.length:null,weekend:i>=5};});
}
// Average visits per weekday for the chart: full and short names, one decimal, weekends in grey. Days without a record are not zeros.
const WEEKDAY_FULL=['Pondelok','Utorok','Streda','Štvrtok','Piatok','Sobota','Nedeľa'];
export function weekdayChartData(daily){
 const avg=weekdayAverages(daily);
 return {labels:WEEKDAY_FULL,shortLabels:avg.map(a=>a.label),values:avg.map(a=>a.average===null?null:Math.round(a.average*10)/10),colors:avg.map(a=>a.weekend?SERIES_COLORS.weekend:SERIES_COLORS.visits),days:avg.map(a=>a.days)};
}
export const formatOneDecimal=v=>finite(v)?new Intl.NumberFormat('sk-SK',{maximumFractionDigits:1}).format(v):'N/A';
// ---- Time grain (days / weeks / months). Months follow the week-based convention: a week belongs to the month that
// contains its Thursday (ISO style), because weekly sheets cannot be split across months.
const MONTH_FORMAT=new Intl.DateTimeFormat('sk-SK',{month:'long',year:'numeric',timeZone:'UTC'});
export function monthKeyOfWeek(periodStart){
 const date=new Date(Date.parse(periodStart+'T00:00:00Z')+3*86400000);
 return Number.isFinite(date.getTime())?date.toISOString().slice(0,7):null;
}
export function monthLabel(key){return MONTH_FORMAT.format(new Date(key+'-01T00:00:00Z'));}
export function aggregateByMonth(weeks){
 const groups=new Map();
 for(const w of weeks){const key=monthKeyOfWeek(w.period_start);if(!key)continue;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(w);}
 return [...groups.entries()].sort(([a],[b])=>a<b?-1:1).map(([key,rows])=>{
  const sum=name=>rows.every(r=>finite(r[name]))?rows.reduce((n,r)=>n+r[name],0):null;
  return {key,label:monthLabel(key),weeks:rows.length,visits:sum('visits'),membership:sum('membership'),single:sum('single'),multisport:sum('multisport'),total:sum('total'),productUnits:sum('productUnits'),trainingUnits:sum('trainingUnits'),passUnits:sum('passUnits')};
 });
}
export function visitsSeries(weeks,daily,grain){
 if(grain==='day')return daily.length?{labels:daily.map(d=>d.label.slice(0,5)),values:daily.map(d=>d.value),bands:daily.flatMap((d,i)=>d.weekend?[i]:[])}:null;
 if(grain==='month'){const m=aggregateByMonth(weeks);return {labels:m.map(r=>r.label),values:m.map(r=>r.visits),bands:[]};}
 return {labels:weeks.map(w=>w.label),values:weeks.map(w=>w.visits),bands:[]};
}
// Entry mix per day is not stored yet, so the day grain returns null (the UI disables it instead of guessing).
export function mixSeries(weeks,grain,daily=[]){
 if(grain==='day'){
  if(!daily.length)return null;
  return {labels:daily.map(d=>d.date.slice(8,10)+'.'+d.date.slice(5,7)),membership:daily.map(d=>d.membership),single:daily.map(d=>d.single),multisport:daily.map(d=>d.multisport),bands:daily.flatMap((d,i)=>weekdayIndex(d.date)>=5?[i]:[])};
 }
 const rows=grain==='month'?aggregateByMonth(weeks):weeks;
 return {labels:rows.map(r=>r.label),membership:rows.map(r=>r.membership),single:rows.map(r=>r.single),multisport:rows.map(r=>r.multisport)};
}
// ---- Data table under the charts. Same time grain as the charts; the two change columns refer to the chosen metric.
export const TABLE_METRICS=[{key:'visits',label:'Návštevy'},{key:'total',label:'Predaj + MultiSport'},{key:'productUnits',label:'Produkty ks'},{key:'trainingUnits',label:'Tréningy'},{key:'passUnits',label:'Permanentky'}];
// Per day only visits and, when stored, the entry mix exist; sales, products and trainings are weekly figures.
const DAY_MIX_COLUMNS=[{key:'membershipEntries',label:'S permanentkou'},{key:'singleEntries',label:'Jednorazové'},{key:'multisportEntries',label:'MultiSport'}];
export function tableMetricsFor(grain,hasDailyMix=false){return grain==='day'?[TABLE_METRICS[0],...(hasDailyMix?DAY_MIX_COLUMNS:[])]:TABLE_METRICS;}
const GRAIN_WORDS={day:{adj:'denná',dative:'dňu'},week:{adj:'týždenná',dative:'týždňu'},month:{adj:'mesačná',dative:'mesiacu'}};
const WEEKDAY_SHORT=['Po','Ut','St','Št','Pi','So','Ne'];
// context = {weeks, daily, dailyMix} of the whole history: change columns of the shown rows are computed against the neighbouring rows of the
// full series (so a single shown week still gets its change); months only use the selected weeks.
export function tableModel(weeks,daily,grain,metric,dailyMixRows=[],context={}){
 const allWeeks=context.weeks?.length?context.weeks:weeks,allDaily=context.daily?.length?context.daily:daily,allMix=context.dailyMix?.length?context.dailyMix:dailyMixRows;
 const mixByDate=new Map(allMix.map(r=>[r.date,r]));
 let full,shown;
 if(grain==='day'){
  full=allDaily.map(d=>{const m=mixByDate.get(d.date);return {id:d.date,label:WEEKDAY_SHORT[weekdayIndex(d.date)]+' '+d.label.slice(0,5),visits:d.value,membershipEntries:m?.membership??null,singleEntries:m?.single??null,multisportEntries:m?.multisport??null};});
  shown=new Set(daily.map(d=>d.date));
 }else if(grain==='month'){
  full=aggregateByMonth(weeks).map(r=>({...r,id:r.key}));shown=new Set(full.map(r=>r.id));
 }else{
  full=allWeeks.map(w=>({id:w.period_start,label:w.label,visits:w.visits,total:w.total,productUnits:w.productUnits,trainingUnits:w.trainingUnits,passUnits:w.passUnits}));
  shown=new Set(weeks.map(w=>w.period_start));
 }
 const columns=tableMetricsFor(grain,allMix.length>0);
 const metricKey=columns.some(m=>m.key===metric)?metric:'visits';
 const out=[];
 full.forEach((r,i)=>{if(!shown.has(r.id))return;out.push({label:r.label,values:Object.fromEntries(columns.map(c=>[c.key,r[c.key]??null])),changePrev:i===0?null:percentChange(r[metricKey],full[i-1][metricKey]),changeFirst:percentChange(r[metricKey],full[0][metricKey])});});
 const words=GRAIN_WORDS[grain]??GRAIN_WORDS.week;
 return {rows:out,columns,metricKey,headers:{prev:'Zmena '+words.adj,first:'Zmena kum'},note:'Zmena '+words.adj+' = oproti predchádzajúcemu '+(grain==='month'?'mesiacu':grain==='day'?'dňu':'týždňu')+'; Zmena kum = oproti '+(full[0]?.label??'prvému riadku')+'. Oba stĺpce sa vzťahujú na ukazovateľ vybraný nad tabuľkou. N/A = chýbajúci alebo nulový základ.',firstLabel:full[0]?.label??null};
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

export function kpiCard({title,value,note,hint,change,neutral=false}){
 const card=node('article',undefined,'crm-card crm-kpi');if(hint)card.title=hint;card.append(node('h3',title),node('p',value,'crm-kpi-value'),node('p',note,'crm-note'));
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

// Charts are drawn at the real pixel width of their container (ResizeObserver), so text keeps a constant 12 px
// whatever the card width is, and value labels are shown whenever they fit without overlapping.
const CHAR_W=7; // average glyph width in px at 12 px Inter (digits)
const LABEL_CHAR_W=6.4; // letters are narrower than digits
export const formatNumberRound=v=>finite(v)?nf().format(Math.round(v)):'N/A';
// Short form for small charts: 64, 153, 1,5k, 2,2k.
export const formatCompactNumber=v=>!finite(v)?'N/A':Math.abs(v)>=1000?new Intl.NumberFormat('sk-SK',{maximumFractionDigits:1}).format(Math.round(v/100)/10)+'k':nf().format(Math.round(v));
function responsive(wrap,baseWidth,draw){
 draw(baseWidth);
 if(typeof ResizeObserver!=='function')return;
 let last=baseWidth,frame=0;
 // Redraw on the next animation frame: drawing inside the observer callback changes the observed element in the same frame,
 // which WebKit reports as "ResizeObserver loop completed with undelivered notifications".
 new ResizeObserver(entries=>{const width=Math.floor(entries[0].contentRect.width);if(width>=160&&Math.abs(width-last)>=2){last=width;cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>draw(width));}}).observe(wrap);
}
// series: [{name,color,values:[number|null]}]; stacked stacks them; bands marks weekend columns.
export function columnChart({labels,shortLabels,series,stacked=false,format=formatCount,axisFormat,valueFormat,bands=[],ariaLabel,size='normal'}){
 const compact=size==='compact',wrap=node('div',undefined,'crm-chart'),H=compact?170:270,vf=valueFormat??format;
 const legend=node('ul',undefined,'crm-legend');for(const s of series){const li=node('li');const sw=node('i');sw.style.background=s.color;li.append(sw,s.name);legend.append(li);}
 const all=series.flatMap(s=>s.values.filter(finite)),sums=stacked?labels.map((_,i)=>series.every(s=>finite(s.values[i]))?series.reduce((n,s)=>n+s.values[i],0):null):[];
 const scale=niceScale(all.length?Math.min(...all):0,Math.max(1,...sums.filter(finite),...all)),min=scale.min,span=(scale.max-scale.min)||1;
 const ticks=[];for(let t=scale.min;t<=scale.max+scale.step/2;t+=scale.step)ticks.push(Math.round(t*100)/100);
 const tickText=ticks.map(t=>(axisFormat??format)(t)),padL=Math.max(30,Math.max(...tickText.map(t=>t.length))*CHAR_W+12),padR=8,padT=24,padB=28,innerH=H-padT-padB,y=t=>padT+innerH-((t-min)/span)*innerH;
 const draw=W=>{
  const innerW=W-padL-padR,svg=svgNode('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':ariaLabel,class:'crm-chart-svg'});
  ticks.forEach((t,i)=>{const yy=y(t);svg.append(svgNode('line',{x1:padL,x2:W-padR,y1:yy,y2:yy,class:'crm-chart-grid'}),svgNode('text',{x:padL-6,y:yy+4,'text-anchor':'end',class:'crm-chart-axis'},tickText[i]));});
  const slot=innerW/Math.max(labels.length,1),useShort=shortLabels&&Math.max(...labels.map(l=>String(l).length))*LABEL_CHAR_W+8>slot,shown=useShort?shortLabels:labels,labelW=Math.max(...shown.map(l=>String(l).length))*LABEL_CHAR_W+8,every=Math.max(1,Math.ceil(labelW/slot)),group=stacked?1:series.length,bar=Math.max(2,Math.min(56,slot*0.7/group));
  const fits=(text,room)=>text.length*CHAR_W+2<=room;
  labels.forEach((label,i)=>{
   const x0=padL+slot*i+slot/2;
   if(bands.includes(i))svg.append(svgNode('rect',{x:padL+slot*i,y:padT,width:slot,height:innerH,class:'crm-chart-band'}));
   let stack=0;
   series.forEach((s,k)=>{
    const val=s.values[i],x=stacked?x0-bar/2:x0-(group*bar)/2+k*bar;
    if(!finite(val)){svg.append(svgNode('text',{x:x+bar/2,y:y(0)-4,'text-anchor':'middle',class:'crm-chart-na'},'N/A'));return;}
    const top=stacked?stack+val:val,base=stacked?stack:0,yTop=y(Math.max(top,base)),yBase=y(Math.min(top,base)),h=Math.max(1,yBase-yTop);
    const rect=svgNode('rect',{x,y:yTop,width:bar,height:h,rx:3,fill:s.colors?.[i]??s.color});rect.append(svgNode('title',{},label+' · '+s.name+': '+format(val)));svg.append(rect);
    const text=vf(val);
    if(stacked){if(h>=16&&fits(text,bar))svg.append(svgNode('text',{x:x+bar/2,y:yTop+h/2+4,'text-anchor':'middle',class:'crm-chart-seg'},text));stack+=val;}
    else if(fits(text,group===1?slot-2:bar))svg.append(svgNode('text',{x:x+bar/2,y:val<0?yBase+14:yTop-6,'text-anchor':'middle',class:'crm-chart-value'},text));
   });
   if(stacked&&finite(sums[i])){const text=vf(sums[i]);if(fits(text,slot-2))svg.append(svgNode('text',{x:x0,y:y(sums[i])-6,'text-anchor':'middle',class:'crm-chart-value'},text));}
   if(i%every===0)svg.append(svgNode('text',{x:x0,y:H-8,'text-anchor':'middle',class:'crm-chart-axis'},shown[i]));
  });
  wrap.replaceChildren(...(series.length>1?[legend]:[]),svg);
 };
 responsive(wrap,compact?300:600,draw);
 return wrap;
}

export function rankingChart({rows,format=formatEuro,color=SERIES_COLORS.sales,ariaLabel}){
 const wrap=node('div',undefined,'crm-chart'),rowH=32,H=Math.max(rows.length,1)*rowH+8,max=Math.max(1,...rows.map(r=>r.value)),valueW=Math.max(...rows.map(r=>format(r.value).length),1)*CHAR_W+12;
 const draw=W=>{
  const padL=Math.min(210,Math.max(110,Math.round(W*0.34))),chars=Math.floor((padL-12)/CHAR_W),svg=svgNode('svg',{viewBox:'0 0 '+W+' '+H,role:'img','aria-label':ariaLabel,class:'crm-chart-svg'});
  rows.forEach((r,i)=>{
   const yy=4+i*rowH,w=Math.max(2,(W-padL-valueW)*r.value/max),label=r.label.length>chars?r.label.slice(0,chars-1)+'…':r.label;
   svg.append(svgNode('text',{x:padL-8,y:yy+rowH/2+4,'text-anchor':'end',class:'crm-chart-axis'},label));
   const rect=svgNode('rect',{x:padL,y:yy+5,width:w,height:rowH-12,rx:3,fill:color});rect.append(svgNode('title',{},r.label+': '+format(r.value)));svg.append(rect);
   svg.append(svgNode('text',{x:padL+w+6,y:yy+rowH/2+4,class:'crm-chart-value-end'},format(r.value)));
  });
  wrap.replaceChildren(svg);
 };
 responsive(wrap,560,draw);
 return wrap;
}

export function chartCard(title,body,note,actions){
 const card=node('section',undefined,'crm-chart-card');const head=node('div',undefined,'crm-chart-head');head.append(node('h3',title));if(actions)head.append(actions);card.append(head);
 if(note)card.append(node('p',note,'crm-note'));
 card.append(body);return card;
}
export function unavailable(text){return node('p',text,'crm-note crm-chart-empty');}

// Small segmented switch (days / weeks / months). A disabled option explains why it is unavailable.
export function segmentControl({options,value,onPick,ariaLabel}){
 const wrap=node('div',undefined,'crm-segment');wrap.setAttribute('role','group');wrap.setAttribute('aria-label',ariaLabel);
 for(const o of options){const b=node('button',o.label);b.type='button';b.setAttribute('aria-pressed',String(o.key===value));if(o.disabled){b.disabled=true;b.title=o.title??'';}else b.addEventListener('click',()=>onPick(o.key));wrap.append(b);}
 return wrap;
}

export function reportTable(model,{rowHeader}){
 const wrap=node('div',undefined,'crm-table-scroll crm-data-table'),table=node('table',undefined,'crm-report-table');table.setAttribute('aria-label','Tabuľka vývoja');
 const head=node('thead'),tr=node('tr');
 for(const label of [rowHeader,...model.columns.map(c=>c.label),model.headers.prev,model.headers.first]){const th=node('th',label);th.scope='col';tr.append(th);}
 head.append(tr);
 const body=node('tbody');
 for(const row of model.rows){
  const r=node('tr'),th=node('th',row.label);th.scope='row';r.append(th);
  for(const c of model.columns)r.append(node('td',c.key==='total'?formatEuro(row.values[c.key]):formatCount(row.values[c.key]),'num'));
  for(const pct of [row.changePrev,row.changeFirst]){const td=node('td',formatPercent(pct,{trim:true}),'num delta');td.dataset.direction=pct===null?'none':pct>0?'up':pct<0?'down':'flat';r.append(td);}
  body.append(r);
 }
 table.append(head,body);wrap.append(table);return wrap;
}
