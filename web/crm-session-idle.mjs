export const IDLE_LIMIT_MS=15*60*1000;
export function idleRemaining(lastActivityAt,now=Date.now()){
 if(!Number.isFinite(lastActivityAt)||lastActivityAt<=0||!Number.isFinite(now))return 0;
 return Math.max(0,IDLE_LIMIT_MS-(now-lastActivityAt));
}
export function isTrustedUserActivity(event){return event?.isTrusted===true;}
// Countdown shown in the session bar. Display only: the real logout is scheduled from idleRemaining().
export function formatIdleRemaining(ms){
 if(!Number.isFinite(ms)||ms<=0)return '0:00';
 const total=Math.ceil(ms/1000),minutes=Math.floor(total/60),seconds=total%60;
 return minutes+':'+String(seconds).padStart(2,'0');
}
export function idleState(ms){return !Number.isFinite(ms)||ms<=0?'danger':ms<=60_000?'danger':ms<=180_000?'warn':'ok';}
// Time until the page logs out: the earlier of the 15-minute inactivity limit and the server-side session expiry.
// Returns null when neither is known (nothing is scheduled yet).
export function logoutRemaining(lastActivityAt,expiryDeadline,now=Date.now()){
 const idle=Number.isFinite(lastActivityAt)&&lastActivityAt>0?idleRemaining(lastActivityAt,now):null;
 const hard=Number.isFinite(expiryDeadline)&&expiryDeadline>0?Math.max(0,expiryDeadline-now):null;
 return idle===null?hard:hard===null?idle:Math.min(idle,hard);
}
