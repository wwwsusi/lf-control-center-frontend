// Weekly anonymous aggregates remain aggregates; never manufacture customer transactions.
const day=86400000;
const iso=d=>new Date(d).toISOString().slice(0,10);
export function historicalPeriods(snapshot){
 const anchor=snapshot.weekly.find(r=>r.period_start&&r.period_end);
 if(!anchor)throw Error('HISTORICAL_PERIOD_UNKNOWN');
 return snapshot.weekly.map(row=>({...row,period_start:row.period_start??iso(Date.parse(anchor.period_start)+(row.week-anchor.week)*7*day),period_end:row.period_end??iso(Date.parse(anchor.period_end)+(row.week-anchor.week)*7*day)}));
}
export function selectHistoricalPeriods(snapshot,from,to){
 const rows=historicalPeriods(snapshot),overlap=rows.filter(r=>r.period_start<=to&&r.period_end>=from);
 return {included:overlap.filter(r=>r.period_start>=from&&r.period_end<=to),partial:overlap.filter(r=>r.period_start<from||r.period_end>to)};
}
export function liveReportingRanges(snapshot,from,to){
 let segments=[{from,to}];
 for(const row of historicalPeriods(snapshot))segments=segments.flatMap(s=>s.to<row.period_start||s.from>row.period_end?[s]:[...(s.from<row.period_start?[{from:s.from,to:iso(Date.parse(row.period_start)-day)}]:[]),...(s.to>row.period_end?[{from:iso(Date.parse(row.period_end)+day),to:s.to}]:[])]);
 return segments;
}
export function mergeLiveReports(reports,period){
 const result={period,coverage:{},attendance:[],sales:{},items:[],limitations:{}};
 const sums=(target,source)=>{for(const [key,value] of Object.entries(source??{})){if(value==null||!Number.isFinite(Number(value)))throw Error('REPORT_VALUE_INVALID');target[key]=String(Math.round(((Number(target[key])||0)+Number(value))*100)/100);}};
 for(const report of reports){sums(result.coverage,report.coverage);sums(result.sales,report.sales);for(const row of report.attendance??[]){let item=result.attendance.find(r=>r.code===row.code);if(!item){item={...row,visit_count:'0'};result.attendance.push(item);}sums(item,{visit_count:row.visit_count});}for(const row of report.items??[])result.items.push(row);if(report.limitations?.multisport_receipts==='PARTIAL_RATE_COVERAGE')result.limitations.multisport_receipts='PARTIAL_RATE_COVERAGE';}
 if(!reports.length)result.coverage.recorded_days='0';
 return result;
}

// A selection may cut a hand-written week. Visits and entry types ARE recorded per day (facts DAY and DAY_ADMISSION),
// so the cut part of such a week is counted exactly. Sales, products and costs exist only as weekly totals: never prorated.
const spanDays=(a,b)=>Math.round((Date.parse(b)-Date.parse(a))/day)+1;
export function partialVisitRows(snapshot,partial,from,to){
 const facts=Array.isArray(snapshot?.facts)?snapshot.facts:[],rows=[],unavailable=[];
 for(const row of partial){
  const start=row.period_start<from?from:row.period_start,end=row.period_end>to?to:row.period_end,need=spanDays(start,end);
  const own=facts.filter(f=>f.period_start===row.period_start);
  const dayFacts=own.filter(f=>f.dimension==='DAY'&&f.key>=start&&f.key<=end&&Number.isFinite(f.units));
  if(dayFacts.length!==need){unavailable.push(row);continue;}
  const mix=code=>{const m=own.filter(f=>f.dimension==='DAY_ADMISSION'&&f.key.slice(11)===code&&f.key.slice(0,10)>=start&&f.key.slice(0,10)<=end);return m.length===need&&m.every(f=>Number.isFinite(f.units))?m.reduce((n,f)=>n+f.units,0):null;};
  rows.push({week:row.week,period_start:row.period_start,period_end:end,from:start,to:end,partial:true,visits:dayFacts.reduce((n,f)=>n+f.units,0),membership:mix('ENTITLEMENT'),single:mix('SINGLE_ENTRY'),multisport:mix('MULTISPORT')});
 }
 return {rows,unavailable};
}
