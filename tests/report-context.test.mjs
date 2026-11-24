import test from 'node:test';
import assert from 'node:assert/strict';
import {holidaysSk,calendarFor,fetchWeather,weekContextRows} from '../web/crm-report-context.mjs';

test('Slovak holidays include moving Easter days and fixed ones',()=>{
 const d=new Map(holidaysSk(2026).map(h=>[h.date,h.name]));
 assert.equal(d.get('2026-04-03'),'Veľký piatok');
 assert.equal(d.get('2026-04-06'),'Veľkonočný pondelok');
 assert.equal(d.get('2026-11-17'),'Deň boja za slobodu a demokraciu');
 assert.equal(d.get('2026-12-24'),'Štedrý deň');
 assert.equal(holidaysSk(2026).find(h=>h.date==='2026-12-31').kind,'other');
 assert.equal(new Map(holidaysSk(2027).map(h=>[h.date,h.name])).get('2027-03-26'),'Veľký piatok');
});
test('calendarFor spans a year boundary and flags the summer break',()=>{
 const c=calendarFor('2026-12-28','2027-01-03');
 assert.deepEqual(c.holidays.map(h=>h.date),['2027-01-01']);assert.equal(c.other[0].date,'2026-12-31');assert.equal(c.days.length,7);assert.equal(c.summer,false);
 assert.equal(calendarFor('2026-07-27','2026-08-02').summer,true);
});
test('weather keeps missing days out and never turns them into zero',async()=>{
 const fetchImpl=async url=>{assert.match(url,/latitude=48\.9378/);assert.match(url,/archive-api\.open-meteo\.com/);return {ok:true,json:async()=>({daily:{time:['2026-11-16','2026-11-17','2026-11-18'],temperature_2m_max:[5,9,null],temperature_2m_min:[3,4,null],precipitation_sum:[8,0.2,null]}})};};
 const map=await fetchWeather('2026-11-16','2026-11-18',{fetchImpl});
 assert.equal(map.size,2);assert.equal(map.has('2026-11-18'),false);
 const [row]=weekContextRows([{label:'W47',from:'2026-11-16',to:'2026-11-22',visits:275}],map);
 assert.equal(row.days,7);assert.equal(row.weather.known,2);assert.equal(row.weather.rainyDays,1);assert.equal(row.weather.rainMm,8.2);assert.equal(row.holidays[0].date,'2026-11-17');assert.equal(Math.round(row.perDay*10),393);assert.equal(row.training,null);
});
test('weather failure surfaces as an error and an empty range as an empty map',async()=>{
 await assert.rejects(fetchWeather('2026-11-16','2026-11-18',{fetchImpl:async()=>({ok:false,status:500})}));
 assert.equal((await fetchWeather('2999-01-01','2999-01-02',{fetchImpl:async()=>{throw Error('no call');}})).size,0);
 assert.equal(weekContextRows([{label:'W1',from:'2026-11-16',to:'2026-11-22',visits:null}])[0].weather,null);
});
