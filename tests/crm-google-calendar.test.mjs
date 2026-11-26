import test from 'node:test';import assert from 'node:assert/strict';
import {calendarOpenUrl,visibleRange,shiftAnchor,mondayOf,dbEvents,googleEvents,eventsByDay,SOURCES,MODES} from '../web/crm-google-calendar.mjs';

const data={items:[
 {id:'LF-TASK-1',kind:'task',title:'Objednať proteín',fields:{due_date:'2026-12-02'}},
 {id:'LF-CAM-13',kind:'campaign',title:'Mikulášska akcia',fields:{launch_date:'2026-12-04'}},
 {id:'LF-SVC-1',kind:'service',title:'Seminár',fields:{launch_date:'2026-12-09'}},
 {id:'LF-TASK-2',kind:'task',title:'Bez dátumu',fields:{}}]};
const calendar={events:[
 {id:'z',title:'ZUMBA AURA GABY',all_day:false,start:{date_time:'2026-12-01T14:00:00.000Z'},end:{date_time:'2026-12-01T15:00:00.000Z'}},
 {id:'h',title:'Zatvorené',all_day:true,start:{date:'2026-12-24'},end:{date:'2026-12-27'}},
 {id:'n',title:'Silvester',all_day:false,start:{date_time:'2026-12-31T22:30:00.000Z'},end:{date_time:'2026-12-31T23:30:00.000Z'}}]};

test('sources, modes and open link',()=>{
 assert.deepEqual(SOURCES.map(([k])=>k),['google','task','campaign','offer']);assert.deepEqual(MODES.map(([k])=>k),['WEEK','MONTH','LIST']);
 assert.equal(calendarOpenUrl(),'https://calendar.google.com/calendar/u/0/r?cid=lady.fitness.he%40gmail.com');
});
test('visible ranges for week, month and list; navigation',()=>{
 assert.equal(mondayOf('2026-11-26'),'2026-11-23');
 assert.deepEqual(visibleRange('WEEK','2026-11-26'),{from:'2026-11-23',to:'2026-11-29'});
 assert.deepEqual(visibleRange('MONTH','2026-12-10'),{from:'2026-11-30',to:'2027-01-10'});
 assert.deepEqual(visibleRange('LIST','2026-11-26'),{from:'2026-11-26',to:'2026-12-26'});
 assert.equal(shiftAnchor('MONTH','2026-12-10',1),'2027-01-01');assert.equal(shiftAnchor('WEEK','2026-11-26',-1),'2026-11-19');
});
test('CRM items map to task / campaign / offer sources by date',()=>{
 const ev=dbEvents(data);
 assert.deepEqual(ev.map(e=>[e.source,e.date]),[['task','2026-12-02'],['campaign','2026-12-04'],['offer','2026-12-09']]);
 assert.match(ev[1].title,/^Spustenie · /);
});
test('Google events use Prague time; all-day events span their days (end exclusive)',()=>{
 const g=googleEvents(calendar);
 const z=g.find(e=>e.title==='ZUMBA AURA GABY');assert.equal(z.date,'2026-12-01');assert.equal(z.time,'15:00');assert.equal(z.end_time,'16:00');
 assert.deepEqual(g.filter(e=>e.title==='Zatvorené').map(e=>e.date),['2026-12-24','2026-12-25','2026-12-26']);
 const s=g.find(e=>e.title==='Silvester');assert.equal(s.date,'2026-12-31');assert.equal(s.time,'23:30');
});
test('filters and range limit what is shown; timed events first by time',()=>{
 const all=[...dbEvents(data),...googleEvents(calendar)],f={google:true,task:true,campaign:true,offer:true};
 const week=eventsByDay(all,f,'2026-11-30','2026-12-06');
 assert.deepEqual([...week.keys()].sort(),['2026-12-01','2026-12-02','2026-12-04']);
 const noGoogle=eventsByDay(all,{...f,google:false},'2026-11-30','2026-12-06');assert.equal(noGoogle.has('2026-12-01'),false);
 const onlyGoogle=eventsByDay(all,{google:true,task:false,campaign:false,offer:false},'2026-12-01','2026-12-31');assert.deepEqual([...onlyGoogle.keys()],['2026-12-01','2026-12-24','2026-12-25','2026-12-26','2026-12-31']);
});
