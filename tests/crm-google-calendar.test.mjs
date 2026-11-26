import test from 'node:test';import assert from 'node:assert/strict';
import {calendarEmbedUrl,calendarOpenUrl,LF_CALENDAR_ID,CALENDAR_MODES} from '../web/crm-google-calendar.mjs';
test('embed URL targets the Lady Fitness calendar in Prague time and Slovak',()=>{
 const u=new URL(calendarEmbedUrl('MONTH'));
 assert.equal(u.origin+u.pathname,'https://calendar.google.com/calendar/embed');
 assert.equal(u.searchParams.get('src'),LF_CALENDAR_ID);assert.equal(u.searchParams.get('ctz'),'Europe/Prague');
 assert.equal(u.searchParams.get('mode'),'MONTH');assert.equal(u.searchParams.get('hl'),'sk');assert.equal(u.searchParams.get('wkst'),'2');
});
test('unknown view falls back to week; open link is https Google Calendar',()=>{
 assert.equal(new URL(calendarEmbedUrl('<script>')).searchParams.get('mode'),'WEEK');
 assert.deepEqual(CALENDAR_MODES.map(([m])=>m),['WEEK','MONTH','AGENDA']);
 assert.match(calendarOpenUrl(),/^https:\/\/calendar\.google\.com\/calendar\/u\/0\/r\?cid=lady\.fitness\.he%40gmail\.com$/);
});
