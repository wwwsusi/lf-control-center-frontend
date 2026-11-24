// Context for the visits report: Slovak public holidays (computed, no network) and daily weather for Humenné (Open-Meteo archive).
// The weather request carries only the town's coordinates and a date range; no CRM or personal data leaves the browser.
const pad=n=>String(n).padStart(2,'0');
const iso=(y,m,d)=>y+'-'+pad(m)+'-'+pad(d);
const addDays=(date,n)=>new Date(Date.parse(date+'T00:00:00Z')+n*864e5).toISOString().slice(0,10);
// Anonymous Gregorian algorithm for Easter Sunday.
function easterSunday(y){
 const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),month=Math.floor((h+l-7*m+114)/31),day=((h+l-7*m+114)%31)+1;
 return iso(y,month,day);
}
const FIXED=[[1,1,'Deň vzniku SR'],[1,6,'Traja králi'],[5,1,'Sviatok práce'],[5,8,'Deň víťazstva nad fašizmom'],[7,5,'Sv. Cyril a Metod'],[8,29,'Výročie SNP'],[9,1,'Deň Ústavy SR'],[9,15,'Sedembolestná Panna Mária'],[11,1,'Sviatok všetkých svätých'],[11,17,'Deň boja za slobodu a demokraciu'],[12,24,'Štedrý deň'],[12,25,'1. sviatok vianočný'],[12,26,'2. sviatok vianočný']];
export function holidaysSk(year){
 const easter=easterSunday(year);
 return [...FIXED.map(([m,d,name])=>({date:iso(year,m,d),name,kind:'holiday'})),{date:addDays(easter,-2),name:'Veľký piatok',kind:'holiday'},{date:addDays(easter,1),name:'Veľkonočný pondelok',kind:'holiday'},{date:iso(year,12,31),name:'Silvester (nie štátny sviatok)',kind:'other'}].sort((a,b)=>a.date<b.date?-1:1);
}
export function daysBetween(from,to){const out=[];for(let d=from;d<=to&&out.length<400;d=addDays(d,1))out.push(d);return out;}
const isSummerBreak=date=>{const m=Number(date.slice(5,7));return m===7||m===8;};
// Calendar facts for one date window: statutory holidays, other notable days and whether it falls in the summer school break.
export function calendarFor(from,to){
 const years=new Set([from.slice(0,4),to.slice(0,4)]),all=[...years].flatMap(y=>holidaysSk(Number(y)));
 const days=daysBetween(from,to);
 return {days,holidays:all.filter(h=>h.date>=from&&h.date<=to&&h.kind==='holiday'),other:all.filter(h=>h.date>=from&&h.date<=to&&h.kind==='other'),summer:days.some(isSummerBreak)};
}
export const HUMENNE={latitude:48.9378,longitude:21.9172};
const yesterday=()=>addDays(new Date().toISOString().slice(0,10),-1);
const number=v=>typeof v==='number'&&Number.isFinite(v)?v:null;
// Returns Map(date -> {tmax,tmin,rain}); a day the archive does not have yet stays out of the map (it is never shown as zero).
export async function fetchWeather(from,to,{fetchImpl=globalThis.fetch,signal}={}){
 const end=to<yesterday()?to:yesterday();
 if(from>end)return new Map();
 const url='https://archive-api.open-meteo.com/v1/archive?latitude='+HUMENNE.latitude+'&longitude='+HUMENNE.longitude+'&start_date='+from+'&end_date='+end+'&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Europe%2FBratislava';
 const response=await fetchImpl(url,{signal,credentials:'omit',referrerPolicy:'no-referrer'});
 if(!response.ok)throw Object.assign(new Error('Weather request failed'),{code:'WEATHER_HTTP_'+response.status});
 const daily=(await response.json())?.daily;
 if(!daily||!Array.isArray(daily.time)||!Array.isArray(daily.precipitation_sum))throw Object.assign(new Error('Unexpected weather response'),{code:'WEATHER_SHAPE'});
 const out=new Map();
 daily.time.forEach((date,i)=>{const tmax=number(daily.temperature_2m_max?.[i]),tmin=number(daily.temperature_2m_min?.[i]),rain=number(daily.precipitation_sum?.[i]);if(tmax!==null||tmin!==null||rain!==null)out.set(date,{tmax,tmin,rain});});
 return out;
}
export const RAIN_DAY_MM=1;
const avg=values=>values.length?values.reduce((n,v)=>n+v,0)/values.length:null;
// One row per week: visits (total and per day), holidays and weather. Weather values use only the days we have; `known` says how many.
export function weekContextRows(weeks,weather=null){
 return weeks.map(w=>{
  const from=w.from??w.period_start,to=w.to??w.period_end,cal=calendarFor(from,to),n=cal.days.length;
  const known=weather?cal.days.map(d=>weather.get(d)).filter(Boolean):[];
  const rains=known.map(d=>d.rain).filter(v=>v!==null),maxes=known.map(d=>d.tmax).filter(v=>v!==null),mins=known.map(d=>d.tmin).filter(v=>v!==null);
  return {label:w.label,from,to,days:n,visits:Number.isFinite(w.visits)?w.visits:null,perDay:Number.isFinite(w.visits)&&n?w.visits/n:null,holidays:cal.holidays,other:cal.other,summer:cal.summer,
   weather:weather?{known:known.length,rainyDays:rains.filter(v=>v>=RAIN_DAY_MM).length,rainMm:rains.length?rains.reduce((s,v)=>s+v,0):null,tmax:avg(maxes),tmin:avg(mins)}:null};
 });
}
