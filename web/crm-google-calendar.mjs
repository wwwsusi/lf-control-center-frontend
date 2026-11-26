// Úlohy → Kalendár: the Lady Fitness Google Calendar, embedded read-only from Google.
// No calendar data passes through or is stored by the CRM. Google shows the events only to a
// browser signed in to a Google account that can see this calendar.
export const LF_CALENDAR_ID='lady.fitness.he@gmail.com';
export const CALENDAR_MODES=[['WEEK','Týždeň'],['MONTH','Mesiac'],['AGENDA','Zoznam']];
export function calendarEmbedUrl(mode='WEEK',calendarId=LF_CALENDAR_ID){
 if(!CALENDAR_MODES.some(([m])=>m===mode))mode='WEEK';
 const q=new URLSearchParams({src:calendarId,ctz:'Europe/Prague',mode,hl:'sk',wkst:'2',showPrint:'0',showTitle:'0',showTz:'0',showCalendars:'0'});
 return 'https://calendar.google.com/calendar/embed?'+q.toString();
}
export function calendarOpenUrl(calendarId=LF_CALENDAR_ID){
 return 'https://calendar.google.com/calendar/u/0/r?cid='+encodeURIComponent(calendarId);
}
export function renderGoogleCalendar({parent,make,action,mode,onMode}){
 const box=make('section',undefined,parent,'dash-group crm-gcal');
 const head=make('div',undefined,box,'crm-gcal-head');make('h3','Google Kalendár · '+LF_CALENDAR_ID,head);
 const modes=make('div',undefined,head,'crm-gcal-modes');modes.setAttribute('role','group');modes.setAttribute('aria-label','Zobrazenie kalendára');
 for(const [key,label] of CALENDAR_MODES){const b=action(label,()=>onMode(key),modes);b.setAttribute('aria-pressed',String(key===mode));}
 const open=make('a','Otvoriť v Google Kalendári ↗',head,'detail-link');open.href=calendarOpenUrl();open.target='_blank';open.rel='noopener noreferrer';
 const frame=make('iframe',undefined,box,'crm-gcal-frame');
 frame.title='Google Kalendár Lady Fitness';frame.src=calendarEmbedUrl(mode);frame.loading='lazy';frame.referrerPolicy='strict-origin-when-cross-origin';
 frame.setAttribute('sandbox','allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox');
 make('p','Udalosti zobrazuje priamo Google, CRM ich neukladá. Ak je kalendár prázdny alebo hlási chýbajúci prístup, prihlás sa v tomto prehliadači do Google účtu lady.fitness.he@gmail.com (alebo účtu, s ktorým je kalendár zdieľaný). Úpravy rob v Google Kalendári.',box,'crm-note');
 return box;
}
